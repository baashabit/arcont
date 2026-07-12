import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

type ProcurementUpdateService = {
  updatePackage(input: {
    companyId: string;
    packageId: string;
    status: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked";
    nextAction: string;
  }): Promise<{
    id: string;
    companyId: string;
    code: string;
    packageName: string;
    projectName: string;
    buyer: string;
    status: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked";
    budgetAmount: number;
    bidCount: number;
    approvalHours: number;
    strategic: boolean;
    supplierContention: number;
    nextAction: string;
    updatedAt: string;
  }>;
};

function roundCurrency(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function deriveCommittedRatio(
  status: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked"
) {
  switch (status) {
    case "draft":
      return 0.42;
    case "sourcing":
      return 0.71;
    case "awaiting_approval":
      return 0.9;
    case "awarded":
      return 1;
    default:
      return 0.86;
  }
}

export function createCostControlService(
  repository: PlatformRepository,
  procurementService: ProcurementUpdateService
) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("COST_CONTROL_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [packages, packageRisks, projects, inventoryLocations, financeItems] = await Promise.all([
      repository.listProcurementPackages(companyId),
      repository.listProcurementRisks(companyId),
      repository.listProjects(companyId),
      repository.listInventoryLocations(companyId),
      repository.listFinanceItems(companyId)
    ]);

    const totalBudget = packages.reduce((sum, item) => sum + item.budgetAmount, 0);
    const negativeCashPressure = financeItems
      .filter((item) => item.cashImpact < 0)
      .reduce((sum, item) => sum + Math.abs(item.cashImpact), 0);
    const financeUrgency = financeItems.reduce((sum, item) => sum + item.urgentItems, 0);
    const highestInventoryPressure =
      inventoryLocations
        .slice()
        .sort(
          (left, right) =>
            right.openVariances +
            right.urgentReplenishments +
            right.blockedReservations -
            (left.openVariances + left.urgentReplenishments + left.blockedReservations)
        )[0] ?? null;

    const lines = packages.map((pkg) => {
      const project = projects.find((item) => item.name === pkg.projectName) ?? null;
      const projectProgress = project?.progress ?? 0;
      const scheduleVarianceDays = project?.scheduleVarianceDays ?? 0;
      const budgetPressure =
        project?.budgetHealth === "critical" ? 0.09 : project?.budgetHealth === "warning" ? 0.045 : 0.015;
      const supplyPressure = highestInventoryPressure
        ? highestInventoryPressure.openVariances * 0.008 +
          highestInventoryPressure.urgentReplenishments * 0.01 +
          highestInventoryPressure.blockedReservations * 0.007
        : 0;
      const competitionPressure = pkg.bidCount < 2 ? 0.07 : pkg.bidCount < 3 ? 0.03 : 0;
      const approvalPressure = pkg.approvalHours > 48 ? 0.06 : pkg.approvalHours > 24 ? 0.025 : 0;
      const schedulePressure = Math.max(scheduleVarianceDays, 0) * 0.008;
      const financePressure = financeUrgency > 0 ? Math.min(financeUrgency * 0.004, 0.05) : 0;
      const strategicPressure = pkg.strategic ? 0.02 : 0;
      const blockedPressure = pkg.status === "blocked" ? 0.08 : 0;

      const committedCost = roundCurrency(pkg.budgetAmount * deriveCommittedRatio(pkg.status));
      const spentRatio = clamp(projectProgress / 100 + supplyPressure * 0.4 + approvalPressure * 0.3, 0.08, 1.04);
      const spentToDate = roundCurrency(committedCost * spentRatio);
      const forecastFactor =
        1 +
        budgetPressure +
        supplyPressure +
        competitionPressure +
        approvalPressure +
        schedulePressure +
        financePressure +
        strategicPressure +
        blockedPressure;
      const forecastAtCompletion = roundCurrency(pkg.budgetAmount * forecastFactor);
      const varianceAmount = forecastAtCompletion - pkg.budgetAmount;
      const variancePercent =
        pkg.budgetAmount > 0 ? Number(((varianceAmount / pkg.budgetAmount) * 100).toFixed(1)) : 0;
      const cashExposure =
        totalBudget > 0 ? roundCurrency((negativeCashPressure * pkg.budgetAmount) / totalBudget) : 0;
      const riskDrivers: string[] = [];

      if (project?.budgetHealth === "critical") {
        riskDrivers.push("Critical project budget health");
      } else if (project?.budgetHealth === "warning") {
        riskDrivers.push("Project budget drift under watch");
      }

      if (scheduleVarianceDays > 3) {
        riskDrivers.push(`Schedule variance at ${scheduleVarianceDays.toFixed(1)} days`);
      }

      if (pkg.bidCount < 2) {
        riskDrivers.push("Insufficient bid coverage");
      }

      if (pkg.approvalHours > 36) {
        riskDrivers.push(`Approval aging at ${pkg.approvalHours} hours`);
      }

      if (pkg.status === "blocked") {
        riskDrivers.push("Package is blocked in sourcing flow");
      }

      if (highestInventoryPressure && highestInventoryPressure.openVariances > 2) {
        riskDrivers.push(`${highestInventoryPressure.locationName} carries unresolved stock variances`);
      }

      if (financeUrgency > 0) {
        riskDrivers.push(`Finance queue carries ${financeUrgency} urgent items`);
      }

      const controlHealth =
        pkg.status === "blocked" || variancePercent >= 9 || project?.budgetHealth === "critical"
          ? "critical"
          : variancePercent >= 4 || pkg.approvalHours > 24 || project?.budgetHealth === "warning"
            ? "watch"
            : "on_track";

      return {
        id: `cost_${pkg.id}`,
        packageId: pkg.id,
        companyId: pkg.companyId,
        projectId: project?.id ?? null,
        code: pkg.code,
        packageName: pkg.packageName,
        projectName: pkg.projectName,
        buyer: pkg.buyer,
        procurementStatus: pkg.status,
        controlHealth,
        budgetAmount: pkg.budgetAmount,
        committedCost,
        spentToDate,
        forecastAtCompletion,
        varianceAmount,
        variancePercent,
        projectProgress,
        scheduleVarianceDays,
        cashExposure,
        riskDrivers,
        nextAction: pkg.nextAction,
        updatedAt: pkg.updatedAt
      };
    });

    const exceptions = packageRisks
      .map((risk) => {
        const pkg = packages.find((item) => item.id === risk.packageId);
        if (!pkg) {
          return null;
        }

        return {
          id: risk.id,
          lineId: `cost_${risk.packageId}`,
          title: risk.title,
          category: risk.category,
          severity: risk.severity,
          owner: risk.owner,
          status: risk.status
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const focusLine =
      lines
        .slice()
        .sort((left, right) => {
          if (left.controlHealth === "critical" && right.controlHealth !== "critical") {
            return -1;
          }

          if (left.controlHealth !== "critical" && right.controlHealth === "critical") {
            return 1;
          }

          return right.varianceAmount - left.varianceAmount;
        })[0] ?? null;

    return {
      summary: {
        trackedLines: lines.length,
        totalBudget: roundCurrency(lines.reduce((sum, item) => sum + item.budgetAmount, 0)),
        committedCost: roundCurrency(lines.reduce((sum, item) => sum + item.committedCost, 0)),
        forecastAtCompletion: roundCurrency(lines.reduce((sum, item) => sum + item.forecastAtCompletion, 0)),
        forecastVariance: roundCurrency(lines.reduce((sum, item) => sum + item.varianceAmount, 0)),
        criticalLines: lines.filter((item) => item.controlHealth === "critical").length
      },
      lines,
      exceptions,
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
      procurementStatus: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const line = overview.lines.find((item) => item.id === input.lineId);
      if (!line) {
        throw notFound("COST_CONTROL_LINE_NOT_FOUND", "Cost control line not found", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      if (input.procurementStatus === "awarded" && line.controlHealth === "critical") {
        throw validationError(
          "COST_CONTROL_CRITICAL_FORECAST",
          "Cost control line cannot be awarded while forecast drift remains critical",
          {
            lineId: line.id,
            variancePercent: line.variancePercent
          }
        );
      }

      await procurementService.updatePackage({
        companyId: input.companyId,
        packageId: line.packageId,
        status: input.procurementStatus,
        nextAction: input.nextAction
      });

      const refreshedOverview = await buildOverview(input.companyId);
      const refreshedLine = refreshedOverview.lines.find((item) => item.id === input.lineId);
      if (!refreshedLine) {
        throw notFound("COST_CONTROL_LINE_NOT_FOUND", "Cost control line not found after update", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      return refreshedLine;
    }
  };
}
