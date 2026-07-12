import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createComplianceService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("COMPLIANCE_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const cases = await repository.listComplianceCases(companyId);
      const risks = await repository.listComplianceRisks(companyId);
      const activeCases = cases.filter((item) => item.status !== "closed").length;
      const atRiskCases = cases.filter((item) => item.health !== "healthy").length;
      const averageDocumentCompletion =
        cases.length > 0
          ? Number((cases.reduce((sum, item) => sum + item.documentCompletion, 0) / cases.length).toFixed(1))
          : 0;
      const openFindings = cases.reduce((sum, item) => sum + item.openFindings, 0);
      const focusCase =
        cases
          .slice()
          .sort((left, right) => {
            if (left.health === "critical" && right.health !== "critical") {
              return -1;
            }

            if (left.health !== "critical" && right.health === "critical") {
              return 1;
            }

            return left.slaHoursRemaining - right.slaHoursRemaining;
          })[0] ?? null;

      return {
        summary: {
          activeCases,
          atRiskCases,
          averageDocumentCompletion,
          openFindings
        },
        cases,
        risks,
        focusCase
      };
    }
  };
}
