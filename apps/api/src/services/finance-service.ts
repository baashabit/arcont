import { notFound } from "../lib/domain-error.js";
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
    }
  };
}
