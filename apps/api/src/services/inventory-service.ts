import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStockHealthTransitions: Record<
  "healthy" | "watch" | "critical",
  Array<"healthy" | "watch" | "critical">
> = {
  healthy: ["watch"],
  watch: ["healthy", "critical"],
  critical: ["watch"]
};

export function createInventoryService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("INVENTORY_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const locations = await repository.listInventoryLocations(companyId);
      const risks = await repository.listInventoryRisks(companyId);
      const trackedSkus = locations.reduce((sum, location) => sum + location.trackedSkus, 0);
      const averageAccuracy =
        locations.length > 0
          ? Number((locations.reduce((sum, location) => sum + location.accuracy, 0) / locations.length).toFixed(1))
          : 0;
      const focusLocation =
        locations
          .slice()
          .sort((left, right) => {
            if (left.stockHealth === "critical" && right.stockHealth !== "critical") {
              return -1;
            }

            if (left.stockHealth !== "critical" && right.stockHealth === "critical") {
              return 1;
            }

            return right.urgentReplenishments - left.urgentReplenishments;
          })[0] ?? null;

      return {
        summary: {
          trackedSkus,
          accuracy: averageAccuracy,
          openVariances: locations.reduce((sum, location) => sum + location.openVariances, 0),
          urgentReplenishments: locations.reduce((sum, location) => sum + location.urgentReplenishments, 0)
        },
        locations,
        risks,
        focusLocation
      };
    },
    async updateLocation(input: {
      companyId: string;
      locationId: string;
      stockHealth: "healthy" | "watch" | "critical";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("INVENTORY_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const locations = await repository.listInventoryLocations(input.companyId);
      const location = locations.find((item) => item.id === input.locationId);
      if (!location) {
        throw notFound("INVENTORY_LOCATION_NOT_FOUND", "Inventory location not found", {
          companyId: input.companyId,
          locationId: input.locationId
        });
      }

      if (location.stockHealth === input.stockHealth && location.nextAction === input.nextAction) {
        return location;
      }

      if (location.stockHealth !== input.stockHealth) {
        const allowedTransitions = allowedStockHealthTransitions[location.stockHealth];
        if (!allowedTransitions.includes(input.stockHealth)) {
          throw validationError(
            "INVENTORY_INVALID_STOCK_HEALTH_TRANSITION",
            "Inventory stock health transition is not allowed",
            {
              locationId: location.id,
              currentStockHealth: location.stockHealth,
              nextStockHealth: input.stockHealth
            }
          );
        }
      }

      if (input.stockHealth === "healthy") {
        if (location.openVariances > 0) {
          throw validationError(
            "INVENTORY_OPEN_VARIANCES",
            "Inventory location cannot be marked healthy while variances remain open",
            {
              locationId: location.id,
              openVariances: location.openVariances
            }
          );
        }

        if (location.urgentReplenishments > 0) {
          throw validationError(
            "INVENTORY_URGENT_REPLENISHMENTS",
            "Inventory location cannot be marked healthy while urgent replenishments remain",
            {
              locationId: location.id,
              urgentReplenishments: location.urgentReplenishments
            }
          );
        }
      }

      const updatedLocation = await repository.updateInventoryLocation({
        locationId: input.locationId,
        stockHealth: input.stockHealth,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "inventory_location",
        aggregateId: updatedLocation.id,
        action: "inventory.location.updated",
        metadata: {
          stockHealth: updatedLocation.stockHealth,
          nextAction: updatedLocation.nextAction
        }
      });

      return updatedLocation;
    }
  };
}
