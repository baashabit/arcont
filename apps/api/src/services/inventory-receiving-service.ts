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
  async function syncPurchaseOrderFromReceipts(companyId: string, purchaseReference: string) {
    const [purchaseOrders, receipts] = await Promise.all([
      repository.listProcurementPurchaseOrders(companyId),
      repository.listInventoryReceipts(companyId)
    ]);

    const purchaseOrder = purchaseOrders.find((item) => item.code === purchaseReference);
    if (!purchaseOrder) {
      return null;
    }

    const linkedReceipts = receipts.filter((item) => item.purchaseReference === purchaseReference);
    if (linkedReceipts.length === 0) {
      return purchaseOrder;
    }

    const totalOrderedUnits = linkedReceipts.reduce((sum, item) => sum + item.orderedUnits, 0);
    const totalReceivedUnits = linkedReceipts.reduce((sum, item) => sum + item.receivedUnits, 0);
    const receivedPercent =
      totalOrderedUnits > 0 ? Number(Math.min(100, (totalReceivedUnits / totalOrderedUnits) * 100).toFixed(1)) : 0;

    const derivedStatus =
      purchaseOrder.status === "blocked"
        ? undefined
        : linkedReceipts.every((item) => item.status === "received") && receivedPercent >= 95
          ? "received"
          : totalReceivedUnits > 0 || linkedReceipts.some((item) => item.status === "received")
            ? "partial"
            : linkedReceipts.some((item) => item.status === "in_transit" || item.status === "draft")
              ? "in_transit"
              : undefined;

    const nextAction =
      derivedStatus === "received"
        ? `Receipt chain closed for ${purchaseReference}; purchase order is now fully received.`
        : derivedStatus === "partial"
          ? `Receipt chain is partially received for ${purchaseReference}; keep remaining balance under warehouse follow-up.`
          : derivedStatus === "in_transit"
            ? `Receipt chain is active for ${purchaseReference}; monitor ETA, evidence and unloading readiness.`
            : undefined;

    return repository.syncProcurementPurchaseOrderReceipt({
      purchaseOrderId: purchaseOrder.id,
      receivedPercent,
      status: derivedStatus,
      nextAction
    });
  }

  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("INVENTORY_RECEIVING_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [receipts, risks, purchaseOrders] = await Promise.all([
      repository.listInventoryReceipts(companyId),
      repository.listInventoryReceiptRisks(companyId),
      repository.listProcurementPurchaseOrders(companyId)
    ]);

    const purchaseOrdersByCode = new Map(purchaseOrders.map((item) => [item.code, item]));
    const receiptViews = receipts.map((receipt) => {
      const purchaseOrder = purchaseOrdersByCode.get(receipt.purchaseReference);
      return {
        ...receipt,
        purchaseOrderOwner: purchaseOrder?.buyer ?? "Unassigned purchasing",
        purchaseOrderStatus: purchaseOrder?.status ?? "unknown",
        invoiceMatchStatus: purchaseOrder?.invoiceMatchStatus ?? "unknown"
      };
    });

    const focusReceipt =
      receiptViews
        .slice()
        .sort((left, right) => {
          if (left.status === "blocked" && right.status !== "blocked") {
            return -1;
          }
          if (left.status !== "blocked" && right.status === "blocked") {
            return 1;
          }
          if ((left.invoiceMatchStatus === "risk") !== (right.invoiceMatchStatus === "risk")) {
            return Number(right.invoiceMatchStatus === "risk") - Number(left.invoiceMatchStatus === "risk");
          }
          if (isOverdue(left) !== isOverdue(right)) {
            return Number(isOverdue(right)) - Number(isOverdue(left));
          }
          return abs(right.varianceUnits) - abs(left.varianceUnits);
        })[0] ?? null;

    return {
      summary: {
        openReceipts: receiptViews.filter((receipt) => receipt.status !== "received").length,
        overdueEta: receiptViews.filter((receipt) => isOverdue(receipt)).length,
        quantityVarianceUnits: receiptViews.reduce((sum, receipt) => sum + abs(receipt.varianceUnits), 0),
        pendingEvidence: receiptViews.reduce((sum, receipt) => sum + receipt.pendingEvidence, 0),
        blockedReceipts: receiptViews.filter((receipt) => receipt.status === "blocked").length,
        receiptsAtCommercialRisk: receiptViews.filter(
          (receipt) => receipt.purchaseOrderStatus === "blocked" || receipt.invoiceMatchStatus === "risk"
        ).length
      },
      receipts: receiptViews,
      risks,
      focusReceipt
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
    },
    async createReceipt(input: {
      companyId: string;
      supplierName: string;
      destinationName: string;
      destinationType: string;
      purchaseReference: string;
      etaDate: string;
      orderedUnits: number;
      receivedUnits: number;
      pendingEvidence: number;
      rejectedUnits: number;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("INVENTORY_RECEIVING_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const supplierName = input.supplierName.trim();
      const destinationName = input.destinationName.trim();
      const destinationType = input.destinationType.trim();
      const purchaseReference = input.purchaseReference.trim();
      const nextAction = input.nextAction.trim();
      const etaTimestamp = Date.parse(input.etaDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (supplierName.length < 3 || destinationName.length < 3 || destinationType.length < 3 || purchaseReference.length < 3) {
        throw validationError(
          "INVENTORY_RECEIVING_INVALID_INPUT",
          "Supplier, destination, destination type and purchase reference require at least 3 characters",
          {
            supplierNameLength: supplierName.length,
            destinationNameLength: destinationName.length,
            destinationTypeLength: destinationType.length,
            purchaseReferenceLength: purchaseReference.length
          }
        );
      }

      if (Number.isNaN(etaTimestamp)) {
        throw validationError("INVENTORY_RECEIVING_INVALID_ETA", "ETA date must be valid", {
          etaDate: input.etaDate
        });
      }

      if (etaTimestamp < today.getTime()) {
        throw validationError("INVENTORY_RECEIVING_PAST_ETA", "ETA date cannot be in the past", {
          etaDate: input.etaDate
        });
      }

      if (input.orderedUnits <= 0 || input.receivedUnits < 0) {
        throw validationError("INVENTORY_RECEIVING_INVALID_UNITS", "Ordered and received units must be valid", {
          orderedUnits: input.orderedUnits,
          receivedUnits: input.receivedUnits
        });
      }

      if (input.pendingEvidence < 0 || input.rejectedUnits < 0) {
        throw validationError("INVENTORY_RECEIVING_INVALID_COUNTS", "Evidence and rejected units must be non-negative", {
          pendingEvidence: input.pendingEvidence,
          rejectedUnits: input.rejectedUnits
        });
      }

      if (input.receivedUnits > input.orderedUnits) {
        throw validationError(
          "INVENTORY_RECEIVING_RECEIVED_EXCEEDS_ORDERED",
          "Received units cannot exceed ordered units",
          {
            orderedUnits: input.orderedUnits,
            receivedUnits: input.receivedUnits
          }
        );
      }

      if (input.rejectedUnits > input.receivedUnits) {
        throw validationError(
          "INVENTORY_RECEIVING_REJECTED_EXCEEDS_RECEIVED",
          "Rejected units cannot exceed received units",
          {
            receivedUnits: input.receivedUnits,
            rejectedUnits: input.rejectedUnits
          }
        );
      }

      if (nextAction.length < 8) {
        throw validationError(
          "INVENTORY_RECEIVING_INVALID_NEXT_ACTION",
          "Next action must be specific before creating a receipt",
          {
            nextActionLength: nextAction.length
          }
        );
      }

      const purchaseOrders = await repository.listProcurementPurchaseOrders(input.companyId);
      const purchaseOrder = purchaseOrders.find((item) => item.code === purchaseReference);
      if (!purchaseOrder) {
        throw notFound("INVENTORY_RECEIVING_PURCHASE_ORDER_NOT_FOUND", "Linked purchase order not found", {
          purchaseReference
        });
      }

      if (!["confirmed", "in_transit", "partial"].includes(purchaseOrder.status)) {
        throw validationError(
          "INVENTORY_RECEIVING_PURCHASE_ORDER_NOT_READY",
          "Receipt requires a purchase order already confirmed or in execution",
          { purchaseOrderStatus: purchaseOrder.status, purchaseReference: input.purchaseReference }
        );
      }

      if (purchaseOrder.supplierName.trim().toLowerCase() !== supplierName.toLowerCase()) {
        throw validationError(
          "INVENTORY_RECEIVING_SUPPLIER_MISMATCH",
          "Receipt supplier must match the linked purchase order supplier",
          {
            purchaseReference,
            purchaseOrderSupplier: purchaseOrder.supplierName,
            supplierName
          }
        );
      }

      const created = await repository.createInventoryReceipt({
        ...input,
        supplierName,
        destinationName,
        destinationType,
        purchaseReference,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "inventory_receipt",
        aggregateId: created.id,
        action: "inventory.receipt.created",
        metadata: {
          receiptCode: created.code,
          purchaseReference: created.purchaseReference,
          supplierName: created.supplierName
        }
      });

      await syncPurchaseOrderFromReceipts(input.companyId, created.purchaseReference);

      const refreshed = await buildOverview(input.companyId);
      return refreshed.receipts.find((item) => item.id === created.id) ?? created;
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

        const purchaseOrders = await repository.listProcurementPurchaseOrders(input.companyId);
        const purchaseOrder = purchaseOrders.find((item) => item.code === receipt.purchaseReference);
        if (purchaseOrder?.invoiceMatchStatus === "risk") {
          throw validationError(
            "INVENTORY_RECEIVING_FISCAL_RISK_OPEN",
            "Receipt cannot be closed as received while the linked purchase order remains at fiscal risk",
            {
              receiptId: receipt.id,
              purchaseReference: receipt.purchaseReference
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

      await syncPurchaseOrderFromReceipts(input.companyId, updatedReceipt.purchaseReference);

      const refreshed = await buildOverview(input.companyId);
      const refreshedReceipt = refreshed.receipts.find((item) => item.id === updatedReceipt.id);
      if (!refreshedReceipt) {
        throw notFound("INVENTORY_RECEIPT_NOT_FOUND", "Inventory receipt not found after update", {
          companyId: input.companyId,
          receiptId: input.receiptId
        });
      }

      return refreshedReceipt;
    }
  };
}
