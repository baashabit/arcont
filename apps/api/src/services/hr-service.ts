import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createHrService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("HR_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const workforces = await repository.listHrWorkforces(companyId);
      const risks = await repository.listHrRisks(companyId);
      const activeHeadcount = workforces.reduce((sum, item) => sum + item.activeHeadcount, 0);
      const attendanceRate =
        workforces.length > 0
          ? Number((workforces.reduce((sum, item) => sum + item.attendanceRate, 0) / workforces.length).toFixed(1))
          : 0;
      const openIncidents = workforces.reduce((sum, item) => sum + item.incidentCount, 0);
      const focusWorkforce =
        workforces
          .slice()
          .sort((left, right) => {
            if (left.safetyStatus === "critical" && right.safetyStatus !== "critical") {
              return -1;
            }

            if (left.safetyStatus !== "critical" && right.safetyStatus === "critical") {
              return 1;
            }

            return right.complianceExpirations - left.complianceExpirations;
          })[0] ?? null;

      return {
        summary: {
          activeHeadcount,
          activeContractors: workforces.length,
          attendanceRate,
          openIncidents
        },
        workforces,
        risks,
        focusWorkforce
      };
    }
  };
}
