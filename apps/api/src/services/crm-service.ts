import { notFound, validationError } from "../lib/domain-error.js";
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
    },
    async updateLeadBucket(input: {
      companyId: string;
      leadBucketId: string;
      health: "healthy" | "watch" | "critical";
      signal: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("CRM_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const leadBuckets = await repository.listCrmLeadBuckets(input.companyId);
      const bucket = leadBuckets.find((candidate) => candidate.id === input.leadBucketId);
      if (!bucket) {
        throw notFound("CRM_LEAD_BUCKET_NOT_FOUND", "CRM lead bucket not found", {
          companyId: input.companyId,
          leadBucketId: input.leadBucketId
        });
      }

      const signal = input.signal.trim();
      if (signal.length < 8) {
        throw validationError("CRM_INVALID_SIGNAL", "Commercial signal must be specific", {
          leadBucketId: bucket.id,
          signalLength: signal.length
        });
      }

      if (bucket.health === input.health && bucket.signal === signal) {
        return bucket;
      }

      if (input.health === "healthy" && bucket.conversionRate < 20) {
        throw validationError("CRM_CONVERSION_TOO_LOW", "Lead bucket cannot be marked healthy with low conversion rate", {
          leadBucketId: bucket.id,
          conversionRate: bucket.conversionRate
        });
      }

      if (input.health === "healthy" && bucket.reservations < 10) {
        throw validationError("CRM_RESERVATIONS_TOO_LOW", "Lead bucket needs stronger reservation traction before healthy status", {
          leadBucketId: bucket.id,
          reservations: bucket.reservations
        });
      }

      if (input.health === "healthy" && bucket.forecastRevenue < 1_000_000) {
        throw validationError("CRM_REVENUE_TOO_LOW", "Lead bucket needs stronger forecast revenue before healthy status", {
          leadBucketId: bucket.id,
          forecastRevenue: bucket.forecastRevenue
        });
      }

      if (input.health === "watch" && bucket.conversionRate < 15) {
        throw validationError("CRM_SHOULD_STAY_CRITICAL", "Very low conversion should remain critical instead of watch", {
          leadBucketId: bucket.id,
          conversionRate: bucket.conversionRate
        });
      }

      if (input.health === "watch" && bucket.reservations < 5) {
        throw validationError("CRM_RESERVATIONS_TOO_WEAK_FOR_WATCH", "Very weak reservation traction should remain critical instead of watch", {
          leadBucketId: bucket.id,
          reservations: bucket.reservations
        });
      }

      const updatedBucket = await repository.updateCrmLeadBucket({
        leadBucketId: input.leadBucketId,
        health: input.health,
        signal
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "crm_lead_bucket",
        aggregateId: updatedBucket.id,
        action: "crm.lead_bucket.updated",
        metadata: {
          health: updatedBucket.health,
          signal: updatedBucket.signal
        }
      });

      return updatedBucket;
    }
  };
}
