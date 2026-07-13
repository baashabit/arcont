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
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("INVENTORY_MOVEMENTS_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [movements, risks] = await Promise.all([
        repository.listInventoryMovements(companyId),
        repository.listInventoryMovementRisks(companyId)
      ]);

      const focusMovement =
        movements
          .slice()
          .sort((left, right) => {
            if (left.impactLevel === "critical" && right.impactLevel !== "critical") {
              return -1;
            }
            if (left.impactLevel !== "critical" && right.impactLevel === "critical") {
              return 1;
            }
            return abs(right.varianceUnits) - abs(left.varianceUnits);
          })[0] ?? null;

      return {
        summary: {
          openMovements: movements.filter((movement) => movement.status !== "received").length,
          criticalMovements: movements.filter((movement) => movement.impactLevel === "critical").length,
          pendingEvidence: movements.reduce((sum, movement) => sum + movement.pendingEvidence, 0),
          varianceUnits: movements.reduce((sum, movement) => sum + abs(movement.varianceUnits), 0),
          returnsInFlow: movements.filter((movement) => movement.movementType === "return" && movement.status !== "received").length
        },
        movements,
        risks,
        focusMovement
      };
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

      return updatedMovement;
    }
  };
}
