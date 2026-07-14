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

function abs(value: number) {
  return Math.abs(value);
}

export function createInventoryMovementsService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("INVENTORY_MOVEMENTS_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [movements, risks, receipts, purchaseOrders] = await Promise.all([
      repository.listInventoryMovements(companyId),
      repository.listInventoryMovementRisks(companyId),
      repository.listInventoryReceipts(companyId),
      repository.listProcurementPurchaseOrders(companyId)
    ]);

    const receiptsByCode = new Map(receipts.map((item) => [item.code, item]));
    const purchaseOrdersByCode = new Map(purchaseOrders.map((item) => [item.code, item]));

    const movementViews = movements.map((movement) => {
      const linkedReceipt = movement.upstreamReceiptCode ? receiptsByCode.get(movement.upstreamReceiptCode) : null;
      const purchaseOrder = movement.purchaseReference ? purchaseOrdersByCode.get(movement.purchaseReference) : null;

      return {
        ...movement,
        purchaseReference: movement.purchaseReference ?? linkedReceipt?.purchaseReference ?? null,
        purchaseOrderOwner: purchaseOrder?.buyer ?? "Unassigned purchasing",
        purchaseOrderStatus: purchaseOrder?.status ?? "unknown",
        invoiceMatchStatus: purchaseOrder?.invoiceMatchStatus ?? "unknown"
      };
    });

    const focusMovement =
      movementViews
        .slice()
        .sort((left, right) => {
          if (left.impactLevel === "critical" && right.impactLevel !== "critical") {
            return -1;
          }
          if (left.impactLevel !== "critical" && right.impactLevel === "critical") {
            return 1;
          }
          if ((left.invoiceMatchStatus === "risk") !== (right.invoiceMatchStatus === "risk")) {
            return Number(right.invoiceMatchStatus === "risk") - Number(left.invoiceMatchStatus === "risk");
          }
          return abs(right.varianceUnits) - abs(left.varianceUnits);
        })[0] ?? null;

    return {
      summary: {
        openMovements: movementViews.filter((movement) => movement.status !== "received").length,
        criticalMovements: movementViews.filter((movement) => movement.impactLevel === "critical").length,
        pendingEvidence: movementViews.reduce((sum, movement) => sum + movement.pendingEvidence, 0),
        varianceUnits: movementViews.reduce((sum, movement) => sum + abs(movement.varianceUnits), 0),
        returnsInFlow: movementViews.filter((movement) => movement.movementType === "return" && movement.status !== "received").length,
        movementsAtCommercialRisk: movementViews.filter(
          (movement) => movement.purchaseOrderStatus === "blocked" || movement.invoiceMatchStatus === "risk"
        ).length
      },
      movements: movementViews,
      risks,
      focusMovement
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
    },
    async createMovement(input: {
      companyId: string;
      movementType: "transfer" | "issue" | "return";
      skuName: string;
      sourceName: string;
      destinationName: string;
      requestedBy: string;
      upstreamReceiptCode: string | null;
      purchaseReference: string | null;
      requestedUnits: number;
      movedUnits: number;
      pendingEvidence: number;
      impactLevel: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("INVENTORY_MOVEMENTS_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const skuName = input.skuName.trim();
      const sourceName = input.sourceName.trim();
      const destinationName = input.destinationName.trim();
      const requestedBy = input.requestedBy.trim();
      const upstreamReceiptCode = input.upstreamReceiptCode?.trim() || null;
      const purchaseReference = input.purchaseReference?.trim() || null;
      const nextAction = input.nextAction.trim();

      if (
        skuName.length < 3 ||
        sourceName.length < 3 ||
        destinationName.length < 3 ||
        requestedBy.length < 3
      ) {
        throw validationError(
          "INVENTORY_MOVEMENT_INVALID_INPUT",
          "SKU, source, destination and requester must be specific",
          {
            skuNameLength: skuName.length,
            sourceNameLength: sourceName.length,
            destinationNameLength: destinationName.length,
            requestedByLength: requestedBy.length
          }
        );
      }

      if (input.requestedUnits <= 0 || input.movedUnits < 0) {
        throw validationError("INVENTORY_MOVEMENT_INVALID_UNITS", "Requested and moved units must be valid", {
          requestedUnits: input.requestedUnits,
          movedUnits: input.movedUnits
        });
      }

      if (input.pendingEvidence < 0) {
        throw validationError("INVENTORY_MOVEMENT_INVALID_EVIDENCE", "Pending evidence must be non-negative", {
          pendingEvidence: input.pendingEvidence
        });
      }

      if (input.movedUnits > input.requestedUnits) {
        throw validationError(
          "INVENTORY_MOVEMENT_MOVED_EXCEEDS_REQUESTED",
          "Moved units cannot exceed requested units",
          {
            requestedUnits: input.requestedUnits,
            movedUnits: input.movedUnits
          }
        );
      }

      if (nextAction.length < 8) {
        throw validationError(
          "INVENTORY_MOVEMENT_INVALID_NEXT_ACTION",
          "Next action must be specific before creating a movement",
          {
            nextActionLength: nextAction.length
          }
        );
      }

      if (upstreamReceiptCode) {
        const receipts = await repository.listInventoryReceipts(input.companyId);
        const linkedReceipt = receipts.find((item) => item.code === upstreamReceiptCode);
        if (!linkedReceipt) {
          throw notFound("INVENTORY_MOVEMENT_RECEIPT_NOT_FOUND", "Linked receipt not found", {
            upstreamReceiptCode
          });
        }

        if (linkedReceipt.status !== "received") {
          throw validationError(
            "INVENTORY_MOVEMENT_RECEIPT_NOT_READY",
            "Movement can only start from a received receipt",
            { upstreamReceiptCode, receiptStatus: linkedReceipt.status }
          );
        }

        if (purchaseReference && linkedReceipt.purchaseReference !== purchaseReference) {
          throw validationError(
            "INVENTORY_MOVEMENT_PURCHASE_REFERENCE_MISMATCH",
            "Movement purchase reference must match the linked receipt purchase reference",
            {
              upstreamReceiptCode,
              receiptPurchaseReference: linkedReceipt.purchaseReference,
              purchaseReference
            }
          );
        }
      }

      if (purchaseReference) {
        const purchaseOrders = await repository.listProcurementPurchaseOrders(input.companyId);
        const purchaseOrder = purchaseOrders.find((item) => item.code === purchaseReference);
        if (!purchaseOrder) {
          throw notFound("INVENTORY_MOVEMENT_PURCHASE_ORDER_NOT_FOUND", "Linked purchase order not found", {
            purchaseReference
          });
        }
      }

      const created = await repository.createInventoryMovement({
        ...input,
        skuName,
        sourceName,
        destinationName,
        requestedBy,
        upstreamReceiptCode,
        purchaseReference,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "inventory_movement",
        aggregateId: created.id,
        action: "inventory.movement.created",
        metadata: {
          movementCode: created.code,
          skuName: created.skuName,
          movementType: created.movementType
        }
      });

      const refreshed = await buildOverview(input.companyId);
      return refreshed.movements.find((item) => item.id === created.id) ?? created;
    },
    async updateMovement(input: {
      companyId: string;
      movementId: string;
      status: "draft" | "in_transit" | "received" | "blocked";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("INVENTORY_MOVEMENTS_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const movements = await repository.listInventoryMovements(input.companyId);
      const movement = movements.find((item) => item.id === input.movementId);
      if (!movement) {
        throw notFound("INVENTORY_MOVEMENT_NOT_FOUND", "Inventory movement not found", {
          companyId: input.companyId,
          movementId: input.movementId
        });
      }

      if (movement.status === input.status && movement.nextAction === input.nextAction) {
        return movement;
      }

      if (movement.status !== input.status) {
        const allowed = allowedStatusTransitions[movement.status];
        if (!allowed.includes(input.status)) {
          throw validationError(
            "INVENTORY_MOVEMENT_INVALID_STATUS_TRANSITION",
            "Movement status transition is not allowed",
            {
              movementId: movement.id,
              currentStatus: movement.status,
              nextStatus: input.status
            }
          );
        }
      }

      if (input.status === "received" && movement.pendingEvidence > 0) {
        throw validationError(
          "INVENTORY_MOVEMENT_PENDING_EVIDENCE",
          "Movement cannot be closed while evidence is pending",
          {
            movementId: movement.id,
            pendingEvidence: movement.pendingEvidence
          }
        );
      }

      if (input.status === "received" && abs(movement.varianceUnits) > 0) {
        throw validationError(
          "INVENTORY_MOVEMENT_VARIANCE_OPEN",
          "Movement cannot be closed while quantity variance remains open",
          {
            movementId: movement.id,
            varianceUnits: movement.varianceUnits
          }
        );
      }

      if (input.status === "received" && movement.impactLevel === "critical") {
        throw validationError(
          "INVENTORY_MOVEMENT_CRITICAL_IMPACT",
          "Movement cannot be closed while impact remains critical",
          {
            movementId: movement.id,
            impactLevel: movement.impactLevel
          }
        );
      }

      if (input.status === "received") {
        const purchaseOrders = await repository.listProcurementPurchaseOrders(input.companyId);
        const purchaseOrder = movement.purchaseReference
          ? purchaseOrders.find((item) => item.code === movement.purchaseReference)
          : null;

        if (purchaseOrder?.invoiceMatchStatus === "risk") {
          throw validationError(
            "INVENTORY_MOVEMENT_FISCAL_RISK_OPEN",
            "Movement cannot be closed while the linked purchase order remains at fiscal risk",
            {
              movementId: movement.id,
              purchaseReference: movement.purchaseReference
            }
          );
        }
      }

      const updatedMovement = await repository.updateInventoryMovement({
        movementId: input.movementId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "inventory_movement",
        aggregateId: updatedMovement.id,
        action: "inventory.movement.updated",
        metadata: {
          status: updatedMovement.status,
          nextAction: updatedMovement.nextAction
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedMovement = refreshed.movements.find((item) => item.id === updatedMovement.id);
      if (!refreshedMovement) {
        throw notFound("INVENTORY_MOVEMENT_NOT_FOUND", "Inventory movement not found after update", {
          companyId: input.companyId,
          movementId: input.movementId
        });
      }

      return refreshedMovement;
    }
  };
}
