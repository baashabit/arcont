import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createFinanceService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("FINANCE_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const items = await repository.listFinanceItems(companyId);
      const risks = await repository.listFinanceRisks(companyId);
      const cashPosition = items.reduce((sum, item) => sum + item.cashImpact, 0);
      const urgentPayables = items.reduce((sum, item) => sum + item.urgentItems, 0);
      const closeReadiness =
        items.length > 0
          ? Number((items.reduce((sum, item) => sum + item.closeReadiness, 0) / items.length).toFixed(1))
          : 0;
      const satStatus = items.some((item) => item.satStatus === "critical")
        ? "critical"
        : items.some((item) => item.satStatus === "watch")
          ? "watch"
          : "controlled";
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
          satStatus
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
