import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "draft" | "in_transit" | "received" | "blocked",
  Array<"draft" | "in_transit" | "received" | "blocked">
> = {
  draft: ["in_transit", "blocked"],
  in_transit: ["received", "blocked"],
  received: [],
  blocked: ["in_transit"]
};

function isOverdue(receipt: { etaDate: string; status: "draft" | "in_transit" | "received" | "blocked" }) {
  return receipt.status !== "received" && Date.parse(receipt.etaDate) < Date.now();
}

function abs(value: number) {
  return Math.abs(value);
}

export function createInventoryReceivingService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("INVENTORY_RECEIVING_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [receipts, risks] = await Promise.all([
        repository.listInventoryReceipts(companyId),
        repository.listInventoryReceiptRisks(companyId)
      ]);

      const focusReceipt =
        receipts
          .slice()
          .sort((left, right) => {
            if (left.status === "blocked" && right.status !== "blocked") {
              return -1;
            }
            if (left.status !== "blocked" && right.status === "blocked") {
              return 1;
            }
            if (isOverdue(left) !== isOverdue(right)) {
              return Number(isOverdue(right)) - Number(isOverdue(left));
            }
            return abs(right.varianceUnits) - abs(left.varianceUnits);
          })[0] ?? null;

      return {
        summary: {
          openReceipts: receipts.filter((receipt) => receipt.status !== "received").length,
          overdueEta: receipts.filter((receipt) => isOverdue(receipt)).length,
          quantityVarianceUnits: receipts.reduce((sum, receipt) => sum + abs(receipt.varianceUnits), 0),
          pendingEvidence: receipts.reduce((sum, receipt) => sum + receipt.pendingEvidence, 0),
          blockedReceipts: receipts.filter((receipt) => receipt.status === "blocked").length
        },
        receipts,
        risks,
        focusReceipt
      };
    },
    async updateReceipt(input: {
      companyId: string;
      receiptId: string;
      status: "draft" | "in_transit" | "received" | "blocked";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("INVENTORY_RECEIVING_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const receipts = await repository.listInventoryReceipts(input.companyId);
      const receipt = receipts.find((item) => item.id === input.receiptId);
      if (!receipt) {
        throw notFound("INVENTORY_RECEIPT_NOT_FOUND", "Inventory receipt not found", {
          companyId: input.companyId,
          receiptId: input.receiptId
        });
      }

      if (receipt.status === input.status && receipt.nextAction === input.nextAction) {
        return receipt;
      }

      if (receipt.status !== input.status) {
        const allowed = allowedStatusTransitions[receipt.status];
        if (!allowed.includes(input.status)) {
          throw validationError(
            "INVENTORY_RECEIVING_INVALID_STATUS_TRANSITION",
            "Receipt status transition is not allowed",
            {
              receiptId: receipt.id,
              currentStatus: receipt.status,
              nextStatus: input.status
            }
          );
        }
      }

      if (input.status === "received") {
        if (receipt.pendingEvidence > 0) {
          throw validationError(
            "INVENTORY_RECEIVING_PENDING_EVIDENCE",
            "Receipt cannot be closed as received while evidence is pending",
            {
              receiptId: receipt.id,
              pendingEvidence: receipt.pendingEvidence
            }
          );
        }

        if (receipt.rejectedUnits > 0) {
          throw validationError(
            "INVENTORY_RECEIVING_REJECTED_UNITS",
            "Receipt cannot be closed as received while rejected units remain unresolved",
            {
              receiptId: receipt.id,
              rejectedUnits: receipt.rejectedUnits
            }
          );
        }

        if (abs(receipt.varianceUnits) > 0) {
          throw validationError(
            "INVENTORY_RECEIVING_VARIANCE_OPEN",
            "Receipt cannot be closed as received while quantity variance remains open",
            {
              receiptId: receipt.id,
              varianceUnits: receipt.varianceUnits
            }
          );
        }
      }

      const updatedReceipt = await repository.updateInventoryReceipt({
        receiptId: input.receiptId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "inventory_receipt",
        aggregateId: updatedReceipt.id,
        action: "inventory.receipt.updated",
        metadata: {
          status: updatedReceipt.status,
          nextAction: updatedReceipt.nextAction
        }
      });

      return updatedReceipt;
    }
  };
}
