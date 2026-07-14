import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "issued" | "confirmed" | "in_transit" | "partial" | "received" | "blocked",
  Array<"issued" | "confirmed" | "in_transit" | "partial" | "received" | "blocked">
> = {
  issued: ["confirmed", "blocked"],
  confirmed: ["in_transit", "blocked"],
  in_transit: ["partial", "received", "blocked"],
  partial: ["received", "blocked"],
  received: [],
  blocked: ["confirmed", "in_transit"]
};

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

export function createProcurementPurchaseOrdersService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("PROCUREMENT_PURCHASE_ORDERS_COMPANY_NOT_FOUND", "Company not found", { companyId });
      }

      const [purchaseOrders, risks] = await Promise.all([
        repository.listProcurementPurchaseOrders(companyId),
        repository.listProcurementPurchaseOrderRisks(companyId)
      ]);

      const openOrders = purchaseOrders.filter((item) => item.status !== "received");
      const focusPurchaseOrder =
        openOrders
          .slice()
          .sort((left, right) => {
            if (left.status === "blocked" && right.status !== "blocked") {
              return -1;
            }
            if (left.status !== "blocked" && right.status === "blocked") {
              return 1;
            }
            if (left.invoiceMatchStatus === "risk" && right.invoiceMatchStatus !== "risk") {
              return -1;
            }
            if (left.invoiceMatchStatus !== "risk" && right.invoiceMatchStatus === "risk") {
              return 1;
            }
            return right.totalAmount - left.totalAmount;
          })[0] ?? null;

      return {
        summary: {
          openOrders: openOrders.length,
          inTransitOrders: purchaseOrders.filter((item) => item.status === "in_transit" || item.status === "partial").length,
          blockedOrders: purchaseOrders.filter((item) => item.status === "blocked").length,
          pendingInvoiceMatch: purchaseOrders.filter((item) => item.invoiceMatchStatus !== "matched").length,
          averageReceivedPercent:
            purchaseOrders.length > 0
              ? roundMetric(purchaseOrders.reduce((sum, item) => sum + item.receivedPercent, 0) / purchaseOrders.length)
              : 0
        },
        purchaseOrders,
        risks,
        focusPurchaseOrder
      };
    },
    async createPurchaseOrder(input: {
      companyId: string;
      requisitionId: string;
      supplierName: string;
      buyer: string;
      totalAmount: number;
      committedEta: string;
      logisticsMode: string;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PROCUREMENT_PURCHASE_ORDERS_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const supplierName = input.supplierName.trim();
      const buyer = input.buyer.trim();
      const logisticsMode = input.logisticsMode.trim();
      const nextAction = input.nextAction.trim();
      const committedEtaTimestamp = Date.parse(input.committedEta);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (supplierName.length < 3 || buyer.length < 3 || logisticsMode.length < 3) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_INVALID_INPUT",
          "Supplier, buyer and logistics mode require at least 3 characters",
          {
            supplierNameLength: supplierName.length,
            buyerLength: buyer.length,
            logisticsModeLength: logisticsMode.length
          }
        );
      }

      if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_INVALID_AMOUNT",
          "Purchase order amount must be greater than zero",
          {
            totalAmount: input.totalAmount
          }
        );
      }

      if (Number.isNaN(committedEtaTimestamp)) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_INVALID_ETA",
          "Committed ETA must be a valid date",
          {
            committedEta: input.committedEta
          }
        );
      }

      if (committedEtaTimestamp < today.getTime()) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_PAST_ETA",
          "Committed ETA cannot be in the past",
          {
            committedEta: input.committedEta
          }
        );
      }

      if (nextAction.length < 8) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_INVALID_NEXT_ACTION",
          "Next action must be specific before creating a purchase order",
          {
            nextActionLength: nextAction.length
          }
        );
      }

      const requisitions = await repository.listProcurementRequisitions(input.companyId);
      const requisition = requisitions.find((item) => item.id === input.requisitionId);
      if (!requisition) {
        throw notFound("PROCUREMENT_REQUISITION_NOT_FOUND", "Requisition not found", {
          companyId: input.companyId,
          requisitionId: input.requisitionId
        });
      }

      if (!["approved", "sourcing"].includes(requisition.status)) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_REQUIRES_APPROVED_REQUISITION",
          "Purchase order requires an approved or sourcing requisition",
          {
            requisitionId: requisition.id,
            requisitionStatus: requisition.status
          }
        );
      }

      if (requisition.supplierCoverage < 1) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_SUPPLIER_COVERAGE_REQUIRED",
          "Requisition needs at least one supplier path before creating a purchase order",
          {
            requisitionId: requisition.id,
            supplierCoverage: requisition.supplierCoverage
          }
        );
      }

      const purchaseOrders = await repository.listProcurementPurchaseOrders(input.companyId);
      const duplicateOpenOrder = purchaseOrders.find(
        (item) =>
          item.requisitionCode === requisition.code &&
          item.supplierName.trim().toLowerCase() === supplierName.toLowerCase() &&
          item.status !== "received"
      );
      if (duplicateOpenOrder) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_DUPLICATE_OPEN_ORDER",
          "An open purchase order already exists for this requisition and supplier",
          {
            purchaseOrderId: duplicateOpenOrder.id,
            purchaseOrderCode: duplicateOpenOrder.code,
            requisitionId: requisition.id
          }
        );
      }

      const purchaseOrder = await repository.createProcurementPurchaseOrder({
        companyId: input.companyId,
        requisitionCode: requisition.code,
        projectName: requisition.projectName,
        supplierName,
        buyer,
        category: requisition.category,
        totalAmount: input.totalAmount,
        committedEta: input.committedEta,
        logisticsMode,
        nextAction
      });

      if (requisition.status !== "sourcing") {
        await repository.updateProcurementRequisition({
          requisitionId: requisition.id,
          status: "sourcing",
          nextAction: `Purchase order ${purchaseOrder.code} opened with ${purchaseOrder.supplierName}. ${nextAction}`
        });
      }

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "procurement_purchase_order",
        aggregateId: purchaseOrder.id,
        action: "procurement.purchase-order.created",
        metadata: {
          purchaseOrderCode: purchaseOrder.code,
          requisitionCode: purchaseOrder.requisitionCode,
          supplierName: purchaseOrder.supplierName,
          totalAmount: purchaseOrder.totalAmount
        }
      });

      return purchaseOrder;
    },
    async updatePurchaseOrder(input: {
      companyId: string;
      purchaseOrderId: string;
      status: "issued" | "confirmed" | "in_transit" | "partial" | "received" | "blocked";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PROCUREMENT_PURCHASE_ORDERS_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const purchaseOrders = await repository.listProcurementPurchaseOrders(input.companyId);
      const purchaseOrder = purchaseOrders.find((item) => item.id === input.purchaseOrderId);
      if (!purchaseOrder) {
        throw notFound("PROCUREMENT_PURCHASE_ORDER_NOT_FOUND", "Purchase order not found", {
          companyId: input.companyId,
          purchaseOrderId: input.purchaseOrderId
        });
      }

      if (purchaseOrder.status === input.status && purchaseOrder.nextAction === input.nextAction) {
        return purchaseOrder;
      }

      if (purchaseOrder.status !== input.status) {
        const allowed = allowedStatusTransitions[purchaseOrder.status];
        if (!allowed.includes(input.status)) {
          throw validationError(
            "PROCUREMENT_PURCHASE_ORDER_INVALID_TRANSITION",
            "Purchase order status transition is not allowed",
            {
              purchaseOrderId: purchaseOrder.id,
              currentStatus: purchaseOrder.status,
              nextStatus: input.status
            }
          );
        }
      }

      if (input.status === "confirmed" && purchaseOrder.invoiceMatchStatus === "risk") {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_FISCAL_RISK",
          "Purchase order cannot be confirmed while the fiscal packet remains at risk",
          {
            purchaseOrderId: purchaseOrder.id,
            invoiceMatchStatus: purchaseOrder.invoiceMatchStatus
          }
        );
      }

      if (input.status === "received" && purchaseOrder.receivedPercent < 95) {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_RECEIPT_INCOMPLETE",
          "Purchase order cannot be received until the receipt progress is materially complete",
          {
            purchaseOrderId: purchaseOrder.id,
            receivedPercent: purchaseOrder.receivedPercent
          }
        );
      }

      if (input.status === "received" && purchaseOrder.invoiceMatchStatus === "risk") {
        throw validationError(
          "PROCUREMENT_PURCHASE_ORDER_INVOICE_RISK",
          "Purchase order cannot close as received while invoice matching remains at risk",
          {
            purchaseOrderId: purchaseOrder.id,
            invoiceMatchStatus: purchaseOrder.invoiceMatchStatus
          }
        );
      }

      const updatedPurchaseOrder = await repository.updateProcurementPurchaseOrder({
        purchaseOrderId: input.purchaseOrderId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "procurement_purchase_order",
        aggregateId: updatedPurchaseOrder.id,
        action: "procurement.purchase-order.updated",
        metadata: {
          status: updatedPurchaseOrder.status,
          nextAction: updatedPurchaseOrder.nextAction
        }
      });

      return updatedPurchaseOrder;
    }
  };
}
