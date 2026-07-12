import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundCurrency(value: number) {
  return Math.round(value);
}

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

function supplierNameForPackage(packageName: string, companyId: string) {
  const lower = packageName.toLowerCase();
  if (lower.includes("steel")) {
    return companyId === "cmp_bienestar_gov" ? "Aceros del Sureste Gov" : "Aceros del Sureste";
  }
  if (lower.includes("mep")) {
    return "Electromec MX";
  }
  if (lower.includes("concrete")) {
    return "Concretos Peninsulares";
  }
  if (lower.includes("prefabricated")) {
    return "Modulos Habitables Norte";
  }
  return "Proveedor Estrategico";
}

function supplierIdFromName(name: string) {
  return `sup_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
}

export function createSupplierControlService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("SUPPLIER_CONTROL_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [packages, risks] = await Promise.all([
      repository.listProcurementPackages(companyId),
      repository.listProcurementRisks(companyId)
    ]);

    const totalVolume = packages.reduce((sum, item) => sum + item.budgetAmount, 0);
    const grouped = new Map<
      string,
      {
        supplierId: string;
        supplierName: string;
        companyId: string;
        owner: string;
        packages: typeof packages;
      }
    >();

    for (const pkg of packages) {
      const supplierName = supplierNameForPackage(pkg.packageName, pkg.companyId);
      const supplierId = supplierIdFromName(supplierName);
      const current = grouped.get(supplierId);

      if (current) {
        current.packages.push(pkg);
      } else {
        grouped.set(supplierId, {
          supplierId,
          supplierName,
          companyId: pkg.companyId,
          owner: pkg.buyer,
          packages: [pkg]
        });
      }
    }

    const lines = Array.from(grouped.values()).map((group) => {
      const contractedAmount = roundCurrency(group.packages.reduce((sum, item) => sum + item.budgetAmount, 0));
      const awardedPackages = group.packages.filter((item) => item.status === "awarded").length;
      const activePackages = group.packages.filter((item) => item.status !== "awarded").length;
      const concentrationPercent = totalVolume > 0 ? roundMetric((contractedAmount / totalVolume) * 100) : 0;
      const bidCoverage = roundMetric(group.packages.reduce((sum, item) => sum + item.bidCount, 0) / group.packages.length);
      const approvalPressureHours = roundMetric(
        group.packages.reduce((sum, item) => sum + item.approvalHours, 0) / group.packages.length
      );
      const complianceAlerts = group.packages.reduce(
        (sum, item) =>
          sum +
          (item.status === "blocked" ? 1 : 0) +
          (item.supplierContention <= 1 ? 1 : 0) +
          (item.approvalHours > 36 ? 1 : 0),
        0
      );
      const deliveryHealth =
        complianceAlerts >= 3 || concentrationPercent >= 45 || bidCoverage < 1.5
          ? "critical"
          : complianceAlerts > 0 || concentrationPercent >= 28 || approvalPressureHours > 24
            ? "watch"
            : "controlled";
      const nextAction =
        group.packages.find((item) => item.status === "blocked")?.nextAction ??
        group.packages.slice().sort((left, right) => right.approvalHours - left.approvalHours)[0]?.nextAction ??
        "Keep supplier under normal operating review";
      const updatedAt = group.packages.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]?.updatedAt;

      return {
        id: `supplier_${group.supplierId}`,
        supplierId: group.supplierId,
        companyId: group.companyId,
        supplierName: group.supplierName,
        owner: group.owner,
        awardedPackages,
        activePackages,
        contractedAmount,
        concentrationPercent,
        bidCoverage,
        deliveryHealth,
        approvalPressureHours,
        complianceAlerts,
        nextAction,
        updatedAt: updatedAt ?? new Date().toISOString()
      };
    });

    const risksBySupplier = risks.map((risk) => {
      const pkg = packages.find((item) => item.id === risk.packageId);
      if (!pkg) {
        return null;
      }
      const supplierName = supplierNameForPackage(pkg.packageName, pkg.companyId);
      const supplierId = supplierIdFromName(supplierName);
      const line = lines.find((item) => item.supplierId === supplierId);
      if (!line) {
        return null;
      }
      return {
        id: risk.id,
        lineId: line.id,
        title: risk.title,
        category: risk.category,
        severity: risk.severity,
        owner: risk.owner,
        status: risk.status
      };
    });

    const mappedRisks = risksBySupplier.filter((item): item is NonNullable<typeof item> => item !== null);

    const focusLine =
      lines
        .slice()
        .sort((left, right) => {
          if (left.deliveryHealth === "critical" && right.deliveryHealth !== "critical") {
            return -1;
          }
          if (left.deliveryHealth !== "critical" && right.deliveryHealth === "critical") {
            return 1;
          }
          return right.contractedAmount - left.contractedAmount;
        })[0] ?? null;

    return {
      summary: {
        trackedSuppliers: lines.length,
        concentratedSuppliers: lines.filter((item) => item.concentrationPercent >= 28).length,
        awardedVolume: roundCurrency(
          lines.reduce((sum, item) => sum + (item.awardedPackages > 0 ? item.contractedAmount : 0), 0)
        ),
        averageBidCoverage: lines.length > 0 ? roundMetric(lines.reduce((sum, item) => sum + item.bidCoverage, 0) / lines.length) : 0,
        criticalSuppliers: lines.filter((item) => item.deliveryHealth === "critical").length,
        complianceAlerts: lines.reduce((sum, item) => sum + item.complianceAlerts, 0)
      },
      lines,
      risks: mappedRisks,
      focusLine
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
    },
    async updateLine(input: {
      companyId: string;
      lineId: string;
      deliveryHealth: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const line = overview.lines.find((item) => item.id === input.lineId);
      if (!line) {
        throw notFound("SUPPLIER_CONTROL_LINE_NOT_FOUND", "Supplier control line not found", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      if (input.deliveryHealth === "controlled") {
        if (line.complianceAlerts > 0) {
          throw validationError(
            "SUPPLIER_CONTROL_ALERTS_OPEN",
            "Supplier cannot move to controlled while compliance alerts remain open",
            {
              lineId: line.id,
              complianceAlerts: line.complianceAlerts
            }
          );
        }

        if (line.bidCoverage < 2) {
          throw validationError(
            "SUPPLIER_CONTROL_BID_COVERAGE_LOW",
            "Supplier needs stronger bid coverage before controlled status",
            {
              lineId: line.id,
              bidCoverage: line.bidCoverage
            }
          );
        }
      }

      if (input.deliveryHealth === "watch" && line.concentrationPercent >= 45) {
        throw validationError(
          "SUPPLIER_CONTROL_KEEP_CRITICAL",
          "Highly concentrated supplier should remain critical until exposure drops",
          {
            lineId: line.id,
            concentrationPercent: line.concentrationPercent
          }
        );
      }

      const packageToUpdate =
        (await repository.listProcurementPackages(input.companyId))
          .filter((item) => supplierIdFromName(supplierNameForPackage(item.packageName, item.companyId)) === line.supplierId)
          .slice()
          .sort((left, right) => right.approvalHours - left.approvalHours)[0] ?? null;

      if (!packageToUpdate) {
        throw notFound("SUPPLIER_CONTROL_PACKAGE_NOT_FOUND", "Supplier package anchor not found", {
          companyId: input.companyId,
          supplierId: line.supplierId
        });
      }

      const nextStatus =
        input.deliveryHealth === "controlled"
          ? "awarded"
          : input.deliveryHealth === "critical"
            ? "blocked"
            : packageToUpdate.status === "draft"
              ? "sourcing"
              : packageToUpdate.status;

      const updatedPackage = await repository.updateProcurementPackage({
        packageId: packageToUpdate.id,
        status: nextStatus,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "supplier_control_line",
        aggregateId: line.id,
        action: "supplier-control.line.updated",
        metadata: {
          deliveryHealth: input.deliveryHealth,
          packageStatus: updatedPackage.status,
          nextAction: updatedPackage.nextAction
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedLine = refreshed.lines.find((item) => item.id === input.lineId);
      if (!refreshedLine) {
        throw notFound("SUPPLIER_CONTROL_LINE_NOT_FOUND", "Supplier control line not found after update", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      return refreshedLine;
    }
  };
}
