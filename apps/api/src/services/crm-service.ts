import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createCrmService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("CRM_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const leadBuckets = await repository.listCrmLeadBuckets(companyId);
      const risks = await repository.listCrmRisks(companyId);
      const qualifiedLeads = leadBuckets.reduce((sum, bucket) => sum + bucket.openOpportunities, 0);
      const reservations = leadBuckets.reduce((sum, bucket) => sum + bucket.reservations, 0);
      const forecastRevenue = leadBuckets.reduce((sum, bucket) => sum + bucket.forecastRevenue, 0);
      const visitConversion =
        leadBuckets.length > 0
          ? Number((leadBuckets.reduce((sum, bucket) => sum + bucket.conversionRate, 0) / leadBuckets.length).toFixed(1))
          : 0;
      const focusBucket =
        leadBuckets
          .slice()
          .sort((left, right) => {
            if (left.health === "critical" && right.health !== "critical") {
              return -1;
            }

            if (left.health !== "critical" && right.health === "critical") {
              return 1;
            }

            return right.forecastRevenue - left.forecastRevenue;
          })[0] ?? null;

      return {
        summary: {
          qualifiedLeads,
          visitConversion,
          reservations,
          forecastRevenue
        },
        leadBuckets,
        risks,
        focusBucket
      };
    }
  };
}
