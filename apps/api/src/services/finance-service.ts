import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";
import { buildDerivedFinanceState } from "./finance-derived.js";
import { buildEstimationCollectionOverview } from "./estimation-collection-service.js";

export function createFinanceService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("FINANCE_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [{ items, risks, supplierProfiles }, treasuryRuns, estimationOverview] = await Promise.all([
        buildDerivedFinanceState(repository, companyId),
        repository.listTreasuryPaymentRuns(companyId),
        buildEstimationCollectionOverview(repository, companyId)
      ]);

      const cashPosition = items.reduce((sum, item) => sum + item.cashImpact, 0);
      const urgentPayables = items.reduce((sum, item) => sum + item.urgentItems, 0);
      const supplierExceptions = supplierProfiles.filter(
        (profile) => profile.complianceStatus === "blocked" || profile.satStatus === "critical" || profile.fiscalPacketCompletion < 100
      ).length;
      const paymentReadySuppliers = supplierProfiles.filter(
        (profile) => profile.complianceStatus === "complete" && profile.satStatus === "controlled"
      ).length;
      const closeReadiness =
        items.length > 0
          ? Number((items.reduce((sum, item) => sum + item.closeReadiness, 0) / items.length).toFixed(1))
          : 0;
      const satStatus = items.some((item) => item.satStatus === "critical")
        ? "critical"
        : items.some((item) => item.satStatus === "watch")
          ? "watch"
          : "controlled";
      const blockedTreasuryRuns = treasuryRuns.filter((run) => run.status === "blocked").length;
      const unavailableTreasuryInvoices = treasuryRuns.reduce(
        (sum, run) => sum + run.invoices.filter((invoice) => invoice.satStatus === "critical" || invoice.complementStatus === "risk" || invoice.receiptEvidenceStatus === "missing").length,
        0
      );
      const blockedTreasuryAmount = treasuryRuns
        .filter((run) => run.status === "blocked")
        .reduce((sum, run) => sum + run.totalAmount, 0);
      const blockedInvoiceAmount = items
        .filter((item) => item.satStatus === "critical")
        .reduce((sum, item) => sum + Math.max(Math.abs(item.cashImpact), 0), 0);
      const blockedAmount = Math.max(
        estimationOverview.summary.pendingCollection + blockedTreasuryAmount + blockedInvoiceAmount,
        0
      );
      const financeChainPressure =
        supplierExceptions +
        urgentPayables +
        blockedTreasuryRuns +
        unavailableTreasuryInvoices +
        estimationOverview.summary.overdueCollections +
        estimationOverview.summary.criticalCollections;
      const collectionsPressure =
        estimationOverview.summary.overdueCollections + estimationOverview.summary.criticalCollections;
      const treasuryPressure = blockedTreasuryRuns + unavailableTreasuryInvoices;
      const laneStatus =
        blockedTreasuryRuns > 0 ||
        unavailableTreasuryInvoices > 0 ||
        estimationOverview.summary.criticalCollections > 0
          ? "critical"
          : financeChainPressure > 0
            ? "watch"
            : "controlled";
      const headline =
        laneStatus === "critical"
          ? `${estimationOverview.summary.criticalCollections} critical collection line(s), ${blockedTreasuryRuns} blocked treasury run(s) and ${unavailableTreasuryInvoices} ineligible invoice(s) are constraining cash release.`
          : laneStatus === "watch"
            ? `${estimationOverview.summary.overdueCollections} overdue collection tranche(s) and ${urgentPayables} urgent payable item(s) still need active treasury follow-up.`
            : "Collections, accounts payable and treasury release are currently aligned for predictable cash execution.";
      const topAction =
        blockedTreasuryRuns > 0
          ? "Clear blocked treasury runs first, then release the invoices still failing fiscal or evidence readiness."
          : estimationOverview.summary.overdueCollections > 0
            ? "Push overdue collections and reduce evidence gap before the next treasury cut."
            : supplierExceptions > 0
              ? "Finish supplier fiscal packets so invoices can move cleanly into treasury."
              : "Maintain the current payment lane and refresh collections plus treasury forecast on schedule.";
      const nextMilestone =
        laneStatus === "critical"
          ? "Stabilize collections and unblock treasury before the next disbursement cycle."
          : laneStatus === "watch"
            ? "Reduce overdue collections and urgent payables in the next weekly cash review."
            : "Preserve payment discipline and weekly liquidity confidence.";
      const focusItem =
        items
          .slice()
          .sort((left, right) => {
            if (left.satStatus === "critical" && right.satStatus !== "critical") {
              return -1;
            }

            if (left.satStatus !== "critical" && right.satStatus === "critical") {
              return 1;
            }

            return right.urgentItems - left.urgentItems;
          })[0] ?? null;

      return {
        summary: {
          cashPosition,
          urgentPayables,
          closeReadiness,
          satStatus,
          supplierExceptions,
          paymentReadySuppliers,
          blockedTreasuryRuns,
          unavailableTreasuryInvoices,
          overdueCollections: estimationOverview.summary.overdueCollections,
          criticalCollections: estimationOverview.summary.criticalCollections,
          financeChainPressure
        },
        command: {
          laneStatus,
          collectionsPressure,
          treasuryPressure,
          blockedAmount,
          headline,
          topAction,
          nextMilestone
        },
        items,
        risks,
        focusItem
      };
    },
    async updateLedgerItem(input: {
      companyId: string;
      ledgerId: string;
      satStatus: "controlled" | "watch" | "critical";
      note: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("FINANCE_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const items = await repository.listFinanceItems(input.companyId);
      const item = items.find((candidate) => candidate.id === input.ledgerId);
      if (!item) {
        throw notFound("FINANCE_LEDGER_ITEM_NOT_FOUND", "Finance ledger item not found", {
          companyId: input.companyId,
          ledgerId: input.ledgerId
        });
      }

      if (item.satStatus === input.satStatus && item.note === input.note) {
        return item;
      }

      if (input.satStatus === "controlled") {
        if (item.urgentItems > 0) {
          throw validationError("FINANCE_URGENT_ITEMS_OPEN", "Finance item cannot be marked controlled while urgent items remain", {
            ledgerId: item.id,
            urgentItems: item.urgentItems
          });
        }

        if (item.closeReadiness < 90) {
          throw validationError("FINANCE_CLOSE_READINESS_LOW", "Finance item needs at least 90% close readiness before controlled status", {
            ledgerId: item.id,
            closeReadiness: item.closeReadiness
          });
        }
      }

      if (input.satStatus === "watch" && item.closeReadiness < 75) {
        throw validationError("FINANCE_ESCALATE_TO_CRITICAL", "Low close readiness should stay critical instead of watch", {
          ledgerId: item.id,
          closeReadiness: item.closeReadiness
        });
      }

      const updatedItem = await repository.updateFinanceLedgerItem({
        ledgerId: input.ledgerId,
        satStatus: input.satStatus,
        note: input.note
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "finance_ledger_item",
        aggregateId: updatedItem.id,
        action: "finance.ledger_item.updated",
        metadata: {
          satStatus: updatedItem.satStatus,
          note: updatedItem.note
        }
      });

      return updatedItem;
    }
  };
}
