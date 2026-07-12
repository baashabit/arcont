import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createDocumentControlService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("DOCUMENT_CONTROL_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const items = await repository.listDocumentControlItems(companyId);
      const risks = await repository.listDocumentControlRisks(companyId);
      const openRfis = items.filter((item) => item.documentType === "RFI" && item.status !== "approved").length;
      const activeSubmittals = items.filter((item) => item.documentType === "Submittal" && item.status !== "approved").length;
      const controlledVersions = items.reduce((sum, item) => sum + item.revisionCount, 0);
      const averageTurnaroundDays =
        items.length > 0
          ? Number((items.reduce((sum, item) => sum + item.turnaroundDays, 0) / items.length).toFixed(1))
          : 0;
      const focusItem =
        items
          .slice()
          .sort((left, right) => {
            if (left.health === "critical" && right.health !== "critical") {
              return -1;
            }

            if (left.health !== "critical" && right.health === "critical") {
              return 1;
            }

            return right.openComments - left.openComments;
          })[0] ?? null;

      return {
        summary: {
          openRfis,
          activeSubmittals,
          controlledVersions,
          averageTurnaroundDays
        },
        items,
        risks,
        focusItem
      };
    }
  };
}
