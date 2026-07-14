import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";
import { buildDerivedFinanceState } from "./finance-derived.js";

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

    const [{ items: financeItems, risks: financeRisks, payableInvoices, payableRisks, supplierProfiles, supplierRisks }, complianceCases, complianceRisks, documents, documentRisks] = await Promise.all([
      buildDerivedFinanceState(repository, companyId),
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

    const payableLines = payableInvoices.map((invoice) => {
      if (invoice.status === "paid") {
        return {
          id: `close_ap_${invoice.id}`,
          sourceId: invoice.id,
          companyId: invoice.companyId,
          code: invoice.code,
          streamName: `${invoice.supplierName} / ${invoice.invoiceNumber}`,
          streamType: "finance" as const,
          closeHealth: "controlled" as const,
          closeReadiness: 100,
          blockingItems: 0,
          slaHoursRemaining: 24,
          evidenceCompletion: 100,
          fiscalExposure: 0,
          nextAction: invoice.nextAction,
          updatedAt: invoice.updatedAt
        };
      }

      const invoiceRisks = payableRisks.filter((risk) => risk.invoiceId === invoice.id);
      const supplierProfile = invoice.supplierProfileId
        ? supplierProfiles.find((profile) => profile.id === invoice.supplierProfileId) ?? null
        : null;
      const supplierPacketGap = supplierProfile ? Math.max(0, 100 - supplierProfile.fiscalPacketCompletion) : Math.max(0, 100 - invoice.packetCompletion);
      const evidenceCompletion =
        invoice.receiptEvidenceStatus === "complete" ? 100 : invoice.receiptEvidenceStatus === "partial" ? 72 : 30;
      const complementCompletion =
        invoice.complementStatus === "complete" || invoice.complementStatus === "not_required"
          ? 100
          : invoice.complementStatus === "pending"
            ? 64
            : 20;
      const closeReadiness = roundMetric(invoice.packetCompletion * 0.45 + evidenceCompletion * 0.3 + complementCompletion * 0.25);

      return {
        id: `close_ap_${invoice.id}`,
        sourceId: invoice.id,
        companyId: invoice.companyId,
        code: invoice.code,
        streamName: `${invoice.supplierName} / ${invoice.invoiceNumber}`,
        streamType: "finance" as const,
        closeHealth:
          invoice.status === "blocked" || invoice.satStatus === "critical" || invoice.complementStatus === "risk"
            ? "critical"
            : invoice.status === "scheduled" || invoice.status === "matched"
              ? "watch"
              : "controlled",
        closeReadiness,
        blockingItems: invoiceRisks.length + (supplierPacketGap > 0 ? 1 : 0),
        slaHoursRemaining: invoice.status === "scheduled" ? 12 : invoice.status === "blocked" ? -24 : -6,
        evidenceCompletion: roundMetric((invoice.packetCompletion + evidenceCompletion) / 2),
        fiscalExposure: roundCurrency(invoice.pendingAmount + supplierPacketGap * 1200),
        nextAction: invoice.nextAction,
        updatedAt: invoice.updatedAt
      };
    });

    const lines = [...financeLines, ...payableLines, ...complianceLines, ...documentLines];

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
        .filter((item): item is NonNullable<typeof item> => item !== null),
      ...payableRisks
        .map((risk) => {
          const line = lines.find((item) => item.sourceId === risk.invoiceId && item.code.startsWith("AP-"));
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
      ...supplierRisks
        .map((risk) => {
          const supplierProfile = supplierProfiles.find((profile) => profile.id === risk.supplierProfileId);
          const linkedInvoice = supplierProfile
            ? payableInvoices.find((invoice) => invoice.supplierProfileId === supplierProfile.id && invoice.status !== "paid") ?? null
            : null;
          const line = linkedInvoice ? lines.find((item) => item.sourceId === linkedInvoice.id && item.code.startsWith("AP-")) : null;
          if (!line) {
            return null;
          }
          return {
            id: `supplier-${risk.id}`,
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

      const nextAction = input.nextAction.trim();
      if (nextAction.length < 8) {
        throw validationError("CLOSE_CONTROL_INVALID_NEXT_ACTION", "Next action must be specific", {
          lineId: line.id,
          nextActionLength: nextAction.length
        });
      }

      if (input.closeHealth === line.closeHealth && nextAction === line.nextAction) {
        return line;
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

        if (line.evidenceCompletion < 90) {
          throw validationError(
            "CLOSE_CONTROL_EVIDENCE_LOW",
            "Close stream cannot move to controlled while evidence completion remains below 90%",
            {
              lineId: line.id,
              evidenceCompletion: line.evidenceCompletion
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

      if (line.streamType === "finance" && line.code.startsWith("AP-")) {
        const payableStatus =
          input.closeHealth === "controlled" ? "paid" : input.closeHealth === "critical" ? "blocked" : "scheduled";
        const updated = await repository.updateAccountsPayableInvoice({
          invoiceId: line.sourceId,
          status: payableStatus,
          satStatus: input.closeHealth,
          complementStatus: input.closeHealth === "controlled" ? "complete" : input.closeHealth === "critical" ? "risk" : "pending",
          scheduledPaymentDate: input.closeHealth === "critical" ? null : new Date().toISOString().slice(0, 10),
          nextAction
        });

        await repository.addAuditEvent({
          companyId: input.companyId,
          actorUserId: undefined,
          aggregateType: "close_control_line",
          aggregateId: line.id,
          action: "close-control.line.updated",
          metadata: {
            closeHealth: input.closeHealth,
            invoiceStatus: updated.status,
            nextAction: updated.nextAction
          }
        });
      } else if (line.streamType === "finance") {
        const updated = await repository.updateFinanceLedgerItem({
          ledgerId: line.sourceId,
          satStatus: input.closeHealth,
          note: nextAction
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
          nextAction
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
          nextAction
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
