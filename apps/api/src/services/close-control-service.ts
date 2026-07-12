import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

function roundCurrency(value: number) {
  return Math.round(value);
}

export function createCloseControlService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("CLOSE_CONTROL_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [financeItems, financeRisks, complianceCases, complianceRisks, documents, documentRisks] = await Promise.all([
      repository.listFinanceItems(companyId),
      repository.listFinanceRisks(companyId),
      repository.listComplianceCases(companyId),
      repository.listComplianceRisks(companyId),
      repository.listDocumentControlItems(companyId),
      repository.listDocumentControlRisks(companyId)
    ]);

    const financeLines = financeItems.map((item) => ({
      id: `close_fin_${item.id}`,
      sourceId: item.id,
      companyId: item.companyId,
      code: item.code,
      streamName: item.metricName,
      streamType: "finance" as const,
      closeHealth: item.satStatus,
      closeReadiness: item.closeReadiness,
      blockingItems: item.urgentItems,
      slaHoursRemaining: item.closeReadiness >= 90 ? 24 : item.closeReadiness >= 80 ? 8 : -12,
      evidenceCompletion: item.closeReadiness,
      fiscalExposure: Math.abs(item.cashImpact < 0 ? item.cashImpact : item.cashImpact * 0.08),
      nextAction: item.note,
      updatedAt: item.updatedAt
    }));

    const complianceLines = complianceCases.map((item) => ({
      id: `close_cmp_${item.id}`,
      sourceId: item.id,
      companyId: item.companyId,
      code: item.code,
      streamName: item.subject,
      streamType: "compliance" as const,
      closeHealth: item.health === "healthy" ? "controlled" : item.health,
      closeReadiness: item.documentCompletion,
      blockingItems: item.openFindings,
      slaHoursRemaining: item.slaHoursRemaining,
      evidenceCompletion: item.documentCompletion,
      fiscalExposure: roundCurrency(item.openFindings * 35000 + (item.health === "critical" ? 180000 : 0)),
      nextAction: item.nextAction,
      updatedAt: item.updatedAt
    }));

    const documentLines = documents.map((item) => ({
      id: `close_doc_${item.id}`,
      sourceId: item.id,
      companyId: item.companyId,
      code: item.code,
      streamName: item.subject,
      streamType: "document_control" as const,
      closeHealth: item.health === "healthy" ? "controlled" : item.health,
      closeReadiness: Math.max(0, Math.min(100, roundMetric(100 - item.turnaroundDays * 4 - item.openComments * 6))),
      blockingItems: item.openComments,
      slaHoursRemaining: item.status === "approved" ? 24 : item.turnaroundDays > 7 ? -10 : 6,
      evidenceCompletion: Math.max(0, Math.min(100, roundMetric(100 - item.openComments * 7 - item.revisionCount * 3))),
      fiscalExposure: roundCurrency(item.openComments * 15000 + item.revisionCount * 8000),
      nextAction: item.nextAction,
      updatedAt: item.updatedAt
    }));

    const lines = [...financeLines, ...complianceLines, ...documentLines];

    const risks = [
      ...financeRisks
        .map((risk) => {
          const line = lines.find((item) => item.sourceId === risk.ledgerId && item.streamType === "finance");
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
        .filter((item): item is NonNullable<typeof item> => item !== null),
      ...complianceRisks
        .map((risk) => {
          const line = lines.find((item) => item.sourceId === risk.caseId && item.streamType === "compliance");
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
        .filter((item): item is NonNullable<typeof item> => item !== null),
      ...documentRisks
        .map((risk) => {
          const line = lines.find((item) => item.sourceId === risk.itemId && item.streamType === "document_control");
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
        .filter((item): item is NonNullable<typeof item> => item !== null)
    ];

    const focusLine =
      lines
        .slice()
        .sort((left, right) => {
          if (left.closeHealth === "critical" && right.closeHealth !== "critical") {
            return -1;
          }
          if (left.closeHealth !== "critical" && right.closeHealth === "critical") {
            return 1;
          }
          return left.slaHoursRemaining - right.slaHoursRemaining;
        })[0] ?? null;

    return {
      summary: {
        trackedStreams: lines.length,
        averageCloseReadiness:
          lines.length > 0 ? roundMetric(lines.reduce((sum, item) => sum + item.closeReadiness, 0) / lines.length) : 0,
        criticalStreams: lines.filter((item) => item.closeHealth === "critical").length,
        blockedItems: lines.reduce((sum, item) => sum + item.blockingItems, 0),
        fiscalExposure: roundCurrency(lines.reduce((sum, item) => sum + item.fiscalExposure, 0)),
        overdueStreams: lines.filter((item) => item.slaHoursRemaining < 0).length
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
      closeHealth: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const line = overview.lines.find((item) => item.id === input.lineId);
      if (!line) {
        throw notFound("CLOSE_CONTROL_LINE_NOT_FOUND", "Close control stream not found", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      if (input.closeHealth === "controlled") {
        if (line.blockingItems > 0) {
          throw validationError(
            "CLOSE_CONTROL_BLOCKERS_OPEN",
            "Close stream cannot move to controlled while blocking items remain open",
            {
              lineId: line.id,
              blockingItems: line.blockingItems
            }
          );
        }

        if (line.closeReadiness < 92) {
          throw validationError(
            "CLOSE_CONTROL_READINESS_LOW",
            "Close stream needs at least 92% readiness before controlled status",
            {
              lineId: line.id,
              closeReadiness: line.closeReadiness
            }
          );
        }
      }

      if (input.closeHealth === "watch" && line.slaHoursRemaining < -8) {
        throw validationError(
          "CLOSE_CONTROL_KEEP_CRITICAL",
          "Stream should remain critical while the close SLA is deeply overdue",
          {
            lineId: line.id,
            slaHoursRemaining: line.slaHoursRemaining
          }
        );
      }

      if (line.streamType === "finance") {
        const updated = await repository.updateFinanceLedgerItem({
          ledgerId: line.sourceId,
          satStatus: input.closeHealth,
          note: input.nextAction
        });

        await repository.addAuditEvent({
          companyId: input.companyId,
          actorUserId: undefined,
          aggregateType: "close_control_line",
          aggregateId: line.id,
          action: "close-control.line.updated",
          metadata: {
            closeHealth: updated.satStatus,
            nextAction: updated.note
          }
        });
      } else if (line.streamType === "compliance") {
        const status =
          input.closeHealth === "controlled" ? "closed" : input.closeHealth === "critical" ? "at_risk" : "in_progress";
        const updated = await repository.updateComplianceCase({
          caseId: line.sourceId,
          status,
          nextAction: input.nextAction
        });

        await repository.addAuditEvent({
          companyId: input.companyId,
          actorUserId: undefined,
          aggregateType: "close_control_line",
          aggregateId: line.id,
          action: "close-control.line.updated",
          metadata: {
            closeHealth: input.closeHealth,
            status: updated.status,
            nextAction: updated.nextAction
          }
        });
      } else {
        const status =
          input.closeHealth === "controlled" ? "approved" : input.closeHealth === "critical" ? "blocked" : "in_review";
        const updated = await repository.updateDocumentControlItem({
          itemId: line.sourceId,
          status,
          nextAction: input.nextAction
        });

        await repository.addAuditEvent({
          companyId: input.companyId,
          actorUserId: undefined,
          aggregateType: "close_control_line",
          aggregateId: line.id,
          action: "close-control.line.updated",
          metadata: {
            closeHealth: input.closeHealth,
            status: updated.status,
            nextAction: updated.nextAction
          }
        });
      }

      const refreshed = await buildOverview(input.companyId);
      const refreshedLine = refreshed.lines.find((item) => item.id === input.lineId);
      if (!refreshedLine) {
        throw notFound("CLOSE_CONTROL_LINE_NOT_FOUND", "Close control stream not found after update", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      return refreshedLine;
    }
  };
}
