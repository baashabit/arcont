import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedIntegrationHealthTransitions: Record<
  "healthy" | "watch" | "critical",
  Array<"healthy" | "watch" | "critical">
> = {
  healthy: ["watch"],
  watch: ["healthy", "critical"],
  critical: ["watch"]
};

const maxHealthyFreshnessMinutes = 30;

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
    },
    async updateStream(input: {
      companyId: string;
      streamId: string;
      health: "healthy" | "watch" | "critical";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("INTEGRATION_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const streams = await repository.listIntegrationStreams(input.companyId);
      const stream = streams.find((item) => item.id === input.streamId);
      if (!stream) {
        throw notFound("INTEGRATION_STREAM_NOT_FOUND", "Integration stream not found", {
          companyId: input.companyId,
          streamId: input.streamId
        });
      }

      const nextAction = input.nextAction.trim();
      if (nextAction.length < 8) {
        throw validationError("INTEGRATION_INVALID_NEXT_ACTION", "Next action must be specific", {
          streamId: stream.id,
          nextActionLength: nextAction.length
        });
      }

      if (stream.health === input.health && stream.nextAction === nextAction) {
        return stream;
      }

      if (stream.health !== input.health) {
        const allowedTransitions = allowedIntegrationHealthTransitions[stream.health];
        if (!allowedTransitions.includes(input.health)) {
          throw validationError(
            "INTEGRATION_INVALID_HEALTH_TRANSITION",
            "Integration stream health transition is not allowed",
            {
              streamId: stream.id,
              currentHealth: stream.health,
              nextHealth: input.health
            }
          );
        }
      }

      if (input.health === "healthy") {
        if (stream.openAlerts > 0) {
          throw validationError(
            "INTEGRATION_OPEN_ALERTS",
            "Integration stream cannot be marked healthy while alerts remain open",
            {
              streamId: stream.id,
              openAlerts: stream.openAlerts
            }
          );
        }

        if (stream.freshnessMinutes > maxHealthyFreshnessMinutes) {
          throw validationError(
            "INTEGRATION_FRESHNESS_TOO_HIGH",
            "Integration stream cannot be marked healthy while freshness is stale",
            {
              streamId: stream.id,
              freshnessMinutes: stream.freshnessMinutes,
              maxHealthyFreshnessMinutes
            }
          );
        }

        if (stream.automationCoverage < 75) {
          throw validationError(
            "INTEGRATION_COVERAGE_TOO_LOW",
            "Integration stream cannot be marked healthy while automation coverage remains too low",
            {
              streamId: stream.id,
              automationCoverage: stream.automationCoverage
            }
          );
        }
      }

      if (input.health === "watch" && stream.openAlerts > 8) {
        throw validationError(
          "INTEGRATION_SHOULD_REMAIN_CRITICAL",
          "Integration stream should remain critical while alert volume stays too high",
          {
            streamId: stream.id,
            openAlerts: stream.openAlerts
          }
        );
      }

      if (input.health === "watch" && stream.freshnessMinutes > 120) {
        throw validationError(
          "INTEGRATION_FRESHNESS_TOO_STALE_FOR_WATCH",
          "Integration stream should remain critical while freshness is severely stale",
          {
            streamId: stream.id,
            freshnessMinutes: stream.freshnessMinutes
          }
        );
      }

      const updatedStream = await repository.updateIntegrationStream({
        streamId: input.streamId,
        health: input.health,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "integration_stream",
        aggregateId: updatedStream.id,
        action: "integration.stream.updated",
        metadata: {
          health: updatedStream.health,
          nextAction: updatedStream.nextAction
        }
      });

      return updatedStream;
    }
  };
}
