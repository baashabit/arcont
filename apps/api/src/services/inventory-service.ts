import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

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
    }
  };
}
