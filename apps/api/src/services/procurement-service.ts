import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked",
  Array<"draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked">
> = {
  draft: ["sourcing", "blocked"],
  sourcing: ["awaiting_approval", "blocked"],
  awaiting_approval: ["awarded", "blocked", "sourcing"],
  awarded: [],
  blocked: ["sourcing", "awaiting_approval"]
};

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
    },
    async updatePackage(input: {
      companyId: string;
      packageId: string;
      status: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PROCUREMENT_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const packages = await repository.listProcurementPackages(input.companyId);
      const procurementPackage = packages.find((item) => item.id === input.packageId);
      if (!procurementPackage) {
        throw notFound("PROCUREMENT_PACKAGE_NOT_FOUND", "Package not found", {
          companyId: input.companyId,
          packageId: input.packageId
        });
      }

      if (procurementPackage.status === input.status && procurementPackage.nextAction === input.nextAction) {
        return procurementPackage;
      }

      if (procurementPackage.status !== input.status) {
        const allowedTransitions = allowedStatusTransitions[procurementPackage.status];
        if (!allowedTransitions.includes(input.status)) {
          throw validationError("PROCUREMENT_INVALID_STATUS_TRANSITION", "Package status transition is not allowed", {
            packageId: procurementPackage.id,
            currentStatus: procurementPackage.status,
            nextStatus: input.status
          });
        }
      }

      if (input.status === "awaiting_approval" && procurementPackage.bidCount < 2) {
        throw validationError("PROCUREMENT_INSUFFICIENT_BIDS", "Package requires at least two bids before approval", {
          packageId: procurementPackage.id,
          bidCount: procurementPackage.bidCount
        });
      }

      if (input.status === "awarded") {
        if (procurementPackage.bidCount < 2 && !procurementPackage.strategic) {
          throw validationError("PROCUREMENT_AWARD_BID_COVERAGE_LOW", "Non-strategic package cannot be awarded with fewer than two bids", {
            packageId: procurementPackage.id,
            bidCount: procurementPackage.bidCount
          });
        }

        if (procurementPackage.strategic && procurementPackage.approvalHours > 48) {
          throw validationError("PROCUREMENT_STRATEGIC_APPROVAL_STALE", "Strategic package approval is stale and must be refreshed before award", {
            packageId: procurementPackage.id,
            approvalHours: procurementPackage.approvalHours
          });
        }
      }

      const updatedPackage = await repository.updateProcurementPackage({
        packageId: input.packageId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "procurement_package",
        aggregateId: updatedPackage.id,
        action: "procurement.package.updated",
        metadata: {
          status: updatedPackage.status,
          nextAction: updatedPackage.nextAction
        }
      });

      return updatedPackage;
    }
  };
}
