import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";
import { buildDerivedFinanceState } from "./finance-derived.js";
import { buildEstimationCollectionOverview } from "./estimation-collection-service.js";

function roundCurrency(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sourceTypeFromMetric(metricName: string) {
  const name = metricName.toLowerCase();
  if (name.includes("cash")) {
    return "cash" as const;
  }
  if (name.includes("payable")) {
    return "payables" as const;
  }
  if (name.includes("tax") || name.includes("sat")) {
    return "tax" as const;
  }
  if (name.includes("revenue")) {
    return "collections" as const;
  }
  return "close" as const;
}

export function createCashFlowService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("CASH_FLOW_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [{ items: financeItems, risks: financeRisks, payableInvoices }, costPackages, treasuryRuns, estimationOverview] = await Promise.all([
      buildDerivedFinanceState(repository, companyId),
      repository.listProcurementPackages(companyId),
      repository.listTreasuryPaymentRuns(companyId),
      buildEstimationCollectionOverview(repository, companyId)
    ]);

    const scheduledPayables = payableInvoices
      .filter((invoice) => invoice.status === "scheduled")
      .reduce((sum, invoice) => sum + invoice.pendingAmount, 0);
    const matchedPayables = payableInvoices
      .filter((invoice) => invoice.status === "matched" || invoice.status === "received")
      .reduce((sum, invoice) => sum + invoice.pendingAmount, 0);
    const blockedPayables = payableInvoices
      .filter((invoice) => invoice.status === "blocked")
      .reduce((sum, invoice) => sum + invoice.pendingAmount, 0);
    const activeTreasuryRuns = treasuryRuns.filter((run) => run.status !== "executed");
    const blockedTreasuryRuns = treasuryRuns.filter((run) => run.status === "blocked");
    const scheduledTreasuryAmount = activeTreasuryRuns.reduce((sum, run) => sum + run.totalAmount, 0);
    const treasuryCriticalInvoices = activeTreasuryRuns.reduce((sum, run) => sum + run.criticalInvoices, 0);

    const pendingCollectionBase = Math.max(
      estimationOverview.summary.pendingCollection,
      roundCurrency(costPackages.reduce((sum, item) => sum + item.budgetAmount * (item.status === "awarded" ? 0.18 : 0.09), 0))
    );
    const projectedCostBase = roundCurrency(
      costPackages.reduce(
        (sum, item) => sum + item.budgetAmount * (item.status === "awarded" ? 0.24 : item.status === "awaiting_approval" ? 0.17 : 0.11),
        0
      )
    );
    const pendingApprovalBase = roundCurrency(
      estimationOverview.lines.reduce((sum, line) => sum + line.pendingApprovalAmount, 0)
    );

    const lines = financeItems.map((item, index) => {
      const sourceType = sourceTypeFromMetric(item.metricName);
      const packageAnchor = costPackages[index % Math.max(costPackages.length, 1)];
      const projectedInflows =
        sourceType === "collections" || sourceType === "cash"
          ? roundCurrency(
              Math.max(item.cashImpact, 0) * 0.16 +
                pendingCollectionBase * (sourceType === "cash" ? 0.18 : 0.27) +
                estimationOverview.summary.collectedPortfolio * (sourceType === "collections" ? 0.06 : 0.03)
            )
          : roundCurrency(pendingCollectionBase * 0.08 + estimationOverview.summary.submittedPortfolio * 0.02);
      const projectedOutflows =
        sourceType === "payables"
          ? roundCurrency(
              Math.abs(item.cashImpact) * 0.18 +
                scheduledPayables * 0.7 +
                matchedPayables * 0.26 +
                blockedPayables * 0.08 +
                scheduledTreasuryAmount * 0.11
            )
          : sourceType === "tax"
            ? roundCurrency(
                Math.abs(item.cashImpact) * 0.7 +
                  blockedPayables * 0.15 +
                  item.urgentItems * 25000 +
                  treasuryCriticalInvoices * 18000
              )
            : sourceType === "close"
              ? roundCurrency(
                  projectedCostBase * 0.12 +
                    item.urgentItems * 18000 +
                    pendingApprovalBase * 0.22
                )
              : roundCurrency(projectedCostBase * 0.2 + scheduledTreasuryAmount * 0.05);
      const startingCash = roundCurrency(item.cashImpact);
      const weeklyNet = startingCash + projectedInflows - projectedOutflows;
      const liquidityCoverageWeeks =
        projectedOutflows > 0 ? Number((Math.max(startingCash + projectedInflows, 0) / projectedOutflows).toFixed(1)) : 0;
      const openPressureItems =
        item.urgentItems +
        (packageAnchor?.approvalHours && packageAnchor.approvalHours > 24 ? 1 : 0) +
        (sourceType === "payables" ? payableInvoices.filter((invoice) => invoice.status === "blocked").length : 0) +
        blockedTreasuryRuns.length +
        estimationOverview.summary.overdueCollections;
      const confidencePercent = clamp(
        item.closeReadiness -
          item.urgentItems * 4 -
          (sourceType === "payables" ? payableInvoices.filter((invoice) => invoice.receiptEvidenceStatus === "missing").length * 6 : 0) -
          (packageAnchor?.status === "blocked" ? 18 : packageAnchor?.status === "awaiting_approval" ? 8 : 0) -
          blockedTreasuryRuns.length * 5 -
          estimationOverview.summary.overdueCollections * 3,
        18,
        98
      );

      return {
        id: `cash_${item.id}`,
        ledgerId: item.id,
        companyId: item.companyId,
        code: item.code,
        streamName: item.metricName,
        sourceType,
        health: item.satStatus,
        startingCash,
        projectedInflows,
        projectedOutflows,
        weeklyNet,
        liquidityCoverageWeeks,
        openPressureItems,
        confidencePercent,
        nextAction: item.note,
        updatedAt: item.updatedAt
      };
    });

    const risks = financeRisks
      .map((risk) => {
        const line = lines.find((item) => item.ledgerId === risk.ledgerId);
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
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const focusLine =
      lines
        .slice()
        .sort((left, right) => {
          if (left.health === "critical" && right.health !== "critical") {
            return -1;
          }

          if (left.health !== "critical" && right.health === "critical") {
            return 1;
          }

          return left.weeklyNet - right.weeklyNet;
        })[0] ?? null;

    return {
      summary: {
        trackedStreams: lines.length,
        projectedInflows: roundCurrency(lines.reduce((sum, item) => sum + item.projectedInflows, 0)),
        projectedOutflows: roundCurrency(lines.reduce((sum, item) => sum + item.projectedOutflows, 0)),
        weeklyNet: roundCurrency(lines.reduce((sum, item) => sum + item.weeklyNet, 0)),
        criticalStreams: lines.filter((item) => item.health === "critical").length,
        averageConfidence:
          lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.confidencePercent, 0) / lines.length).toFixed(1)) : 0
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
      health: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const line = overview.lines.find((item) => item.id === input.lineId);
      if (!line) {
        throw notFound("CASH_FLOW_LINE_NOT_FOUND", "Cash flow stream not found", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      if (input.health === "controlled") {
        if (line.weeklyNet < 0) {
          throw validationError(
            "CASH_FLOW_NEGATIVE_WEEKLY_NET",
            "Cash flow stream cannot be marked controlled while weekly net remains negative",
            {
              lineId: line.id,
              weeklyNet: line.weeklyNet
            }
          );
        }

        if (line.confidencePercent < 85) {
          throw validationError(
            "CASH_FLOW_CONFIDENCE_LOW",
            "Cash flow stream needs at least 85% confidence before controlled status",
            {
              lineId: line.id,
              confidencePercent: line.confidencePercent
            }
          );
        }
      }

      if (input.health === "watch" && line.weeklyNet < -250000) {
        throw validationError(
          "CASH_FLOW_KEEP_CRITICAL",
          "Heavy weekly cash gap should remain critical instead of watch",
          {
            lineId: line.id,
            weeklyNet: line.weeklyNet
          }
        );
      }

      const updatedItem = await repository.updateFinanceLedgerItem({
        ledgerId: line.ledgerId,
        satStatus: input.health,
        note: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "cash_flow_line",
        aggregateId: line.id,
        action: "cash-flow.line.updated",
        metadata: {
          health: updatedItem.satStatus,
          nextAction: updatedItem.note
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedLine = refreshed.lines.find((item) => item.id === input.lineId);
      if (!refreshedLine) {
        throw notFound("CASH_FLOW_LINE_NOT_FOUND", "Cash flow stream not found after update", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      return refreshedLine;
    }
  };
}
