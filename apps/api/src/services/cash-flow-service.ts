import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

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

    const [financeItems, financeRisks, estimationOverview, costPackages] = await Promise.all([
      repository.listFinanceItems(companyId),
      repository.listFinanceRisks(companyId),
      repository.listProjects(companyId).then(() => repository.listFinanceItems(companyId)),
      repository.listProcurementPackages(companyId)
    ]);

    const pendingCollectionBase = roundCurrency(
      costPackages.reduce((sum, item) => sum + item.budgetAmount * (item.status === "awarded" ? 0.18 : 0.09), 0)
    );
    const projectedCostBase = roundCurrency(
      costPackages.reduce(
        (sum, item) => sum + item.budgetAmount * (item.status === "awarded" ? 0.24 : item.status === "awaiting_approval" ? 0.17 : 0.11),
        0
      )
    );

    const lines = financeItems.map((item, index) => {
      const sourceType = sourceTypeFromMetric(item.metricName);
      const packageAnchor = costPackages[index % Math.max(costPackages.length, 1)];
      const projectedInflows =
        sourceType === "collections" || sourceType === "cash"
          ? roundCurrency(Math.max(item.cashImpact, 0) * 0.16 + pendingCollectionBase * (sourceType === "cash" ? 0.18 : 0.27))
          : roundCurrency(pendingCollectionBase * 0.08);
      const projectedOutflows =
        sourceType === "payables"
          ? roundCurrency(Math.abs(item.cashImpact) * 0.34 + projectedCostBase * 0.18)
          : sourceType === "tax"
            ? roundCurrency(Math.abs(item.cashImpact) * 0.7 + item.urgentItems * 25000)
            : sourceType === "close"
              ? roundCurrency(projectedCostBase * 0.12 + item.urgentItems * 18000)
              : roundCurrency(projectedCostBase * 0.2);
      const startingCash = roundCurrency(item.cashImpact);
      const weeklyNet = startingCash + projectedInflows - projectedOutflows;
      const liquidityCoverageWeeks =
        projectedOutflows > 0 ? Number((Math.max(startingCash + projectedInflows, 0) / projectedOutflows).toFixed(1)) : 0;
      const openPressureItems = item.urgentItems + (packageAnchor?.approvalHours && packageAnchor.approvalHours > 24 ? 1 : 0);
      const confidencePercent = clamp(
        item.closeReadiness -
          item.urgentItems * 4 -
          (packageAnchor?.status === "blocked" ? 18 : packageAnchor?.status === "awaiting_approval" ? 8 : 0),
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
