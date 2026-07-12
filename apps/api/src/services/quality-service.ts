import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createQualityService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("QUALITY_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const inspectionsBoard = await repository.listQualityInspections(companyId);
      const risks = await repository.listQualityRisks(companyId);
      const openFindings = inspectionsBoard.reduce((sum, item) => sum + item.openFindings, 0);
      const releaseReadiness =
        inspectionsBoard.length > 0
          ? Number((inspectionsBoard.reduce((sum, item) => sum + item.releaseReadiness, 0) / inspectionsBoard.length).toFixed(1))
          : 0;
      const averageReworkRate =
        inspectionsBoard.length > 0
          ? Number((inspectionsBoard.reduce((sum, item) => sum + item.reworkRate, 0) / inspectionsBoard.length).toFixed(1))
          : 0;
      const focusInspection =
        inspectionsBoard
          .slice()
          .sort((left, right) => {
            const leftRank = left.severity === "critical" ? 2 : left.severity === "major" ? 1 : 0;
            const rightRank = right.severity === "critical" ? 2 : right.severity === "major" ? 1 : 0;
            if (leftRank !== rightRank) {
              return rightRank - leftRank;
            }

            return right.openFindings - left.openFindings;
          })[0] ?? null;

      return {
        summary: {
          inspections: inspectionsBoard.length,
          openFindings,
          releaseReadiness,
          averageReworkRate
        },
        inspectionsBoard,
        risks,
        focusInspection
      };
    }
  };
}
