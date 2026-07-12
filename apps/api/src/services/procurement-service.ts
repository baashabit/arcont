import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createProcurementService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("PROCUREMENT_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const packages = await repository.listProcurementPackages(companyId);
      const risks = await repository.listProcurementRisks(companyId);
      const openPackages = packages.filter((item) => item.status !== "awarded");
      const averageApprovalHours =
        openPackages.length > 0
          ? Number(
              (openPackages.reduce((sum, item) => sum + item.approvalHours, 0) / openPackages.length).toFixed(1)
            )
          : 0;
      const averageBidCount =
        packages.length > 0
          ? Number((packages.reduce((sum, item) => sum + item.bidCount, 0) / packages.length).toFixed(1))
          : 0;
      const focusPackage =
        openPackages
          .slice()
          .sort((left, right) => {
            if (left.status === "blocked" && right.status !== "blocked") {
              return -1;
            }

            if (left.status !== "blocked" && right.status === "blocked") {
              return 1;
            }

            return right.budgetAmount - left.budgetAmount;
          })[0] ?? null;

      return {
        summary: {
          openRequisitions: openPackages.length,
          averageApprovalHours,
          strategicPackages: packages.filter((item) => item.strategic).length,
          averageBidCount
        },
        packages,
        risks,
        focusPackage
      };
    }
  };
}
