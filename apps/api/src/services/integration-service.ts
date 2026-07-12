import { notFound } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createIntegrationService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("INTEGRATION_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const streams = await repository.listIntegrationStreams(companyId);
      const risks = await repository.listIntegrationRisks(companyId);
      const criticalAlerts = streams
        .filter((item) => item.health === "critical")
        .reduce((sum, item) => sum + item.openAlerts, 0);
      const averageCoverage =
        streams.length > 0
          ? Number((streams.reduce((sum, item) => sum + item.automationCoverage, 0) / streams.length).toFixed(1))
          : 0;
      const linkedAssets = streams.reduce((sum, item) => sum + item.linkedAssets, 0);
      const focusStream =
        streams
          .slice()
          .sort((left, right) => {
            if (left.health === "critical" && right.health !== "critical") {
              return -1;
            }

            if (left.health !== "critical" && right.health === "critical") {
              return 1;
            }

            return right.openAlerts - left.openAlerts;
          })[0] ?? null;

      return {
        summary: {
          liveStreams: streams.length,
          criticalAlerts,
          averageCoverage,
          linkedAssets
        },
        streams,
        risks,
        focusStream
      };
    }
  };
}
