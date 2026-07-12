import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "reported" | "triaged" | "scheduled" | "in_progress" | "customer_validation" | "blocked" | "closed",
  Array<"reported" | "triaged" | "scheduled" | "in_progress" | "customer_validation" | "blocked" | "closed">
> = {
  reported: ["triaged", "blocked"],
  triaged: ["scheduled", "in_progress", "blocked"],
  scheduled: ["in_progress", "blocked"],
  in_progress: ["customer_validation", "blocked"],
  customer_validation: ["in_progress", "blocked", "closed"],
  blocked: ["triaged", "scheduled", "in_progress"],
  closed: []
};

function rankHealth(health: "healthy" | "watch" | "critical") {
  switch (health) {
    case "critical":
      return 0;
    case "watch":
      return 1;
    default:
      return 2;
  }
}

export function createPostSaleService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("POST_SALE_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [items, risks] = await Promise.all([
        repository.listPostSaleCases(companyId),
        repository.listPostSaleRisks(companyId)
      ]);

      const focusItem =
        items
          .slice()
          .sort((left, right) => {
            const healthDelta = rankHealth(left.health) - rankHealth(right.health);
            if (healthDelta !== 0) {
              return healthDelta;
            }

            return left.slaHoursRemaining - right.slaHoursRemaining;
          })[0] ?? null;

      return {
        summary: {
          openCases: items.filter((item) => item.status !== "closed").length,
          criticalCases: items.filter((item) => item.health === "critical").length,
          overdueSlaCases: items.filter((item) => item.slaHoursRemaining < 0).length,
          pendingCustomerSignoff: items.filter((item) => item.status === "customer_validation").length
        },
        items,
        risks,
        focusItem
      };
    },
    async updateCase(input: {
      companyId: string;
      caseId: string;
      status: "reported" | "triaged" | "scheduled" | "in_progress" | "customer_validation" | "blocked" | "closed";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("POST_SALE_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const cases = await repository.listPostSaleCases(input.companyId);
      const postSaleCase = cases.find((item) => item.id === input.caseId);
      if (!postSaleCase) {
        throw notFound("POST_SALE_CASE_NOT_FOUND", "Post-sale case not found", {
          companyId: input.companyId,
          caseId: input.caseId
        });
      }

      if (postSaleCase.status === input.status && postSaleCase.nextAction === input.nextAction) {
        return postSaleCase;
      }

      if (postSaleCase.status !== input.status) {
        const allowedTransitions = allowedStatusTransitions[postSaleCase.status];
        if (!allowedTransitions.includes(input.status)) {
          throw validationError("POST_SALE_INVALID_STATUS_TRANSITION", "Post-sale case status transition is not allowed", {
            caseId: postSaleCase.id,
            currentStatus: postSaleCase.status,
            nextStatus: input.status
          });
        }
      }

      if (input.status === "closed") {
        if (postSaleCase.openFindings > 0) {
          throw validationError("POST_SALE_OPEN_FINDINGS", "Post-sale case cannot be closed while findings remain open", {
            caseId: postSaleCase.id,
            openFindings: postSaleCase.openFindings
          });
        }

        if (postSaleCase.slaHoursRemaining < -4 || postSaleCase.health === "critical") {
          throw validationError(
            "POST_SALE_CRITICAL_SLA",
            "Post-sale case cannot be closed while the SLA remains critically breached",
            {
              caseId: postSaleCase.id,
              slaHoursRemaining: postSaleCase.slaHoursRemaining,
              health: postSaleCase.health
            }
          );
        }
      }

      const updatedCase = await repository.updatePostSaleCase({
        caseId: input.caseId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "post_sale_case",
        aggregateId: updatedCase.id,
        action: "post-sale.case.updated",
        metadata: {
          status: updatedCase.status,
          nextAction: updatedCase.nextAction
        }
      });

      return updatedCase;
    }
  };
}
