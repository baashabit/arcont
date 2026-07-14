import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundMetric(value: number) {
  return Number(value.toFixed(2));
}

function roundCurrency(value: number) {
  return Math.round(value);
}

function collectionOwnerFor(projectSegment: string, client: string) {
  if (projectSegment === "Government housing" || client.toLowerCase().includes("gobierno") || client === "SEDATU") {
    return "Government estimations desk";
  }

  if (projectSegment === "Vertical housing") {
    return "Collections coordinator";
  }

  return "Project controls and billing";
}

function conceptCodeFromPackage(code: string, index: number) {
  const suffix = String(index + 1).padStart(3, "0");
  return `GEN-${code.replace(/[^A-Z0-9]/gi, "").slice(-6).toUpperCase()}-${suffix}`;
}

function deriveGeneratorHealth(input: {
  procurementStatus: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked";
  pendingRatio: number;
  changeOrders: number;
  projectBudgetHealth?: "on_track" | "warning" | "critical";
}) {
  if (
    input.procurementStatus === "blocked" ||
    input.pendingRatio > 0.42 ||
    input.changeOrders >= 3 ||
    input.projectBudgetHealth === "critical"
  ) {
    return "critical" as const;
  }

  if (
    input.procurementStatus === "draft" ||
    input.procurementStatus === "sourcing" ||
    input.procurementStatus === "awaiting_approval" ||
    input.pendingRatio > 0.18 ||
    input.changeOrders >= 1 ||
    input.projectBudgetHealth === "warning"
  ) {
    return "watch" as const;
  }

  return "controlled" as const;
}

export function createBudgetBookService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("BUDGET_BOOK_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [projects, projectRisks, procurementPackages, procurementRisks, documentItems, financeItems] = await Promise.all([
      repository.listProjects(companyId),
      repository.listProjectRisks(companyId),
      repository.listProcurementPackages(companyId),
      repository.listProcurementRisks(companyId),
      repository.listDocumentControlItems(companyId),
      repository.listFinanceItems(companyId)
    ]);

    const lines = procurementPackages.map((pkg, index) => {
      const project =
        projects.find((item) => item.name.includes(pkg.projectName) || pkg.projectName.includes(item.name)) ??
        projects.find((item) => item.companyId === pkg.companyId) ??
        null;
      const evidenceCount = documentItems.filter((item) => item.projectName === pkg.projectName).length + pkg.bidCount;
      const financeAnchor =
        financeItems.find((item) => item.companyId === pkg.companyId && item.metricName.toLowerCase().includes("revenue")) ??
        financeItems.find((item) => item.companyId === pkg.companyId && item.cashImpact > 0) ??
        financeItems.find((item) => item.companyId === pkg.companyId) ??
        null;
      const unit = pkg.strategic ? "lot" : "m2";
      const quantity = pkg.strategic ? 1 : Math.max(120, Math.round(pkg.budgetAmount / 8500));
      const unitCost = roundMetric(pkg.budgetAmount / quantity);
      const statusFactor =
        pkg.status === "awarded"
          ? 0.92
          : pkg.status === "awaiting_approval"
            ? 0.74
            : pkg.status === "sourcing"
              ? 0.58
              : pkg.status === "draft"
                ? 0.36
                : 0.2;
      const projectFactor = clamp((project?.progress ?? 52) / 100, 0.22, 1);
      const executedRatio = clamp(statusFactor * projectFactor, 0.08, 0.97);
      const progressPercent = roundMetric(executedRatio * 100);
      const executedQuantity = roundMetric(quantity * executedRatio);
      const estimatedQuantity = roundMetric(
        quantity *
          clamp(
            executedRatio + (project?.qualityHolds ?? 0) * -0.015 + evidenceCount * 0.01 - pkg.approvalHours * 0.0015,
            0.1,
            1
          )
      );
      const pendingQuantity = roundMetric(Math.max(quantity - estimatedQuantity, 0));
      const changeOrders =
        (project?.budgetHealth === "critical" ? 2 : project?.budgetHealth === "warning" ? 1 : 0) +
        (pkg.strategic ? 1 : 0) +
        (pkg.supplierContention <= 1 ? 1 : 0);
      const generatorHealth = deriveGeneratorHealth({
        procurementStatus: pkg.status,
        pendingRatio: quantity > 0 ? pendingQuantity / quantity : 0,
        changeOrders,
        projectBudgetHealth: project?.budgetHealth
      });
      const pendingToBill = financeAnchor
        ? roundCurrency(
            pkg.budgetAmount *
              clamp((1 - financeAnchor.closeReadiness / 100) * 0.18 + pkg.approvalHours * 0.0015, 0.02, 0.22)
          )
        : 0;
      const pendingCollection = financeAnchor
        ? roundCurrency(
            pkg.budgetAmount *
              clamp((1 - financeAnchor.closeReadiness / 100) * 0.26 + financeAnchor.urgentItems * 0.01, 0.03, 0.28)
          )
        : 0;
      const overdueCollectionDays = financeAnchor
        ? Math.round(
            clamp(
              pendingCollection / Math.max(pkg.budgetAmount, 1) * 30 +
                (project?.budgetHealth === "critical" ? 14 : project?.budgetHealth === "warning" ? 8 : 3) +
                financeAnchor.urgentItems * 2,
              2,
              75
            )
          )
        : 0;
      const collectionHealth =
        overdueCollectionDays > 30 || pendingCollection > pkg.budgetAmount * 0.14
          ? "critical"
          : overdueCollectionDays > 18 || pendingCollection > pkg.budgetAmount * 0.06
            ? "watch"
            : "controlled";

      return {
        id: `bgt_${pkg.id}`,
        packageId: pkg.id,
        companyId: pkg.companyId,
        projectId: project?.id ?? null,
        code: pkg.code,
        conceptCode: conceptCodeFromPackage(pkg.code, index),
        projectName: pkg.projectName,
        packageName: pkg.packageName,
        buyer: pkg.buyer,
        unit,
        quantity,
        unitCost,
        budgetAmount: pkg.budgetAmount,
        executedQuantity,
        estimatedQuantity,
        pendingQuantity,
        progressPercent,
        evidenceCount,
        changeOrders,
        generatorHealth,
        collectionHealth,
        collectionOwner: collectionOwnerFor(project?.segment ?? "", project?.client ?? ""),
        pendingCollection,
        pendingToBill,
        overdueCollectionDays,
        procurementStatus: pkg.status,
        nextAction: pkg.nextAction,
        updatedAt: pkg.updatedAt
      };
    });

    const packageToLine = new Map(lines.map((line) => [line.packageId, line.id]));
    const projectToLine = new Map(
      lines.filter((line) => line.projectId).map((line) => [line.projectId as string, line.id])
    );

    const risks = [
      ...procurementRisks
        .map((risk) => {
          const lineId = packageToLine.get(risk.packageId);
          if (!lineId) {
            return null;
          }

          return {
            id: risk.id,
            lineId,
            title: risk.title,
            category: risk.category,
            severity: risk.severity,
            owner: risk.owner,
            status: risk.status
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      ...projectRisks
        .map((risk) => {
          const lineId = projectToLine.get(risk.projectId);
          if (!lineId) {
            return null;
          }

          return {
            id: risk.id,
            lineId,
            title: risk.title,
            category: risk.category,
            severity: risk.severity,
            owner: risk.owner,
            status: risk.status
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    ];

    const focusLine =
      lines
        .slice()
        .sort((left, right) => {
          if (left.generatorHealth === "critical" && right.generatorHealth !== "critical") {
            return -1;
          }

          if (left.generatorHealth !== "critical" && right.generatorHealth === "critical") {
            return 1;
          }

          return right.pendingQuantity * right.unitCost - left.pendingQuantity * left.unitCost;
        })[0] ?? null;

    return {
      summary: {
        activeConcepts: lines.length,
        baselineBudget: roundCurrency(lines.reduce((sum, item) => sum + item.budgetAmount, 0)),
        executedBudget: roundCurrency(lines.reduce((sum, item) => sum + item.executedQuantity * item.unitCost, 0)),
        estimatedBudget: roundCurrency(lines.reduce((sum, item) => sum + item.estimatedQuantity * item.unitCost, 0)),
        pendingBudget: roundCurrency(lines.reduce((sum, item) => sum + item.pendingQuantity * item.unitCost, 0)),
        criticalConcepts: lines.filter((item) => item.generatorHealth === "critical").length,
        conceptsAtCashRisk: lines.filter(
          (item) => item.collectionHealth === "critical" || item.overdueCollectionDays > 30
        ).length
      },
      lines,
      risks,
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
        throw notFound("BUDGET_BOOK_LINE_NOT_FOUND", "Budget concept not found", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      const nextAction = input.nextAction.trim();
      if (nextAction.length < 8) {
        throw validationError("BUDGET_BOOK_INVALID_NEXT_ACTION", "Next action must be specific", {
          lineId: line.id,
          nextActionLength: nextAction.length
        });
      }

      if (input.procurementStatus === line.procurementStatus && nextAction === line.nextAction) {
        return line;
      }

      if (input.procurementStatus === "awarded") {
        if (line.pendingQuantity > line.quantity * 0.12) {
          throw validationError(
            "BUDGET_BOOK_PENDING_GENERATOR_TOO_HIGH",
            "A concept cannot be awarded while generator backlog remains too high",
            {
              lineId: line.id,
              pendingQuantity: line.pendingQuantity
            }
          );
        }

        if (line.changeOrders > 1) {
          throw validationError(
            "BUDGET_BOOK_CHANGE_CONTROL_OPEN",
            "A concept cannot be awarded while change pressure remains open",
            {
              lineId: line.id,
              changeOrders: line.changeOrders
            }
          );
        }

        if (line.collectionHealth === "critical") {
          throw validationError(
            "BUDGET_BOOK_COLLECTION_RISK_OPEN",
            "A concept cannot be awarded while collection exposure remains critical",
            {
              lineId: line.id,
              overdueCollectionDays: line.overdueCollectionDays,
              collectionHealth: line.collectionHealth
            }
          );
        }
      }

      if (input.procurementStatus === "awaiting_approval" && line.evidenceCount < 2) {
        throw validationError(
          "BUDGET_BOOK_EVIDENCE_INCOMPLETE",
          "The concept needs at least baseline technical evidence before approval",
          {
            lineId: line.id,
            evidenceCount: line.evidenceCount
          }
        );
      }

      const updatedPackage = await repository.updateProcurementPackage({
        packageId: line.packageId,
        status: input.procurementStatus,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "budget_book_line",
        aggregateId: line.id,
        action: "budget-book.line.updated",
        metadata: {
          procurementStatus: updatedPackage.status,
          nextAction: updatedPackage.nextAction
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedLine = refreshed.lines.find((item) => item.id === input.lineId);
      if (!refreshedLine) {
        throw notFound("BUDGET_BOOK_LINE_NOT_FOUND", "Budget concept not found after update", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      return refreshedLine;
    }
  };
}
