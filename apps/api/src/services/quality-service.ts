import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "scheduled" | "in_progress" | "pending_release" | "released" | "blocked",
  Array<"scheduled" | "in_progress" | "pending_release" | "released" | "blocked">
> = {
  scheduled: ["in_progress", "blocked"],
  in_progress: ["pending_release", "blocked"],
  pending_release: ["in_progress", "released", "blocked"],
  released: [],
  blocked: ["in_progress", "pending_release"]
};

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
    },
    async updateInspection(input: {
      companyId: string;
      inspectionId: string;
      status: "scheduled" | "in_progress" | "pending_release" | "released" | "blocked";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("QUALITY_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const inspections = await repository.listQualityInspections(input.companyId);
      const inspection = inspections.find((item) => item.id === input.inspectionId);
      if (!inspection) {
        throw notFound("QUALITY_INSPECTION_NOT_FOUND", "Inspection not found", {
          companyId: input.companyId,
          inspectionId: input.inspectionId
        });
      }

      if (inspection.status === input.status && inspection.nextAction === input.nextAction) {
        return inspection;
      }

      if (inspection.status !== input.status) {
        const allowedTransitions = allowedStatusTransitions[inspection.status];
        if (!allowedTransitions.includes(input.status)) {
          throw validationError("QUALITY_INVALID_STATUS_TRANSITION", "Inspection status transition is not allowed", {
            inspectionId: inspection.id,
            currentStatus: inspection.status,
            nextStatus: input.status
          });
        }
      }

      if (input.status === "pending_release") {
        if (inspection.openFindings > 3) {
          throw validationError("QUALITY_RELEASE_FINDINGS_BLOCKED", "Inspection still has too many open findings for release review", {
            inspectionId: inspection.id,
            openFindings: inspection.openFindings
          });
        }

        if (inspection.evidenceCompletion < 85) {
          throw validationError("QUALITY_RELEASE_EVIDENCE_INCOMPLETE", "Inspection evidence must be at least 85% before release review", {
            inspectionId: inspection.id,
            evidenceCompletion: inspection.evidenceCompletion
          });
        }
      }

      if (input.status === "released") {
        if (inspection.openFindings > 0) {
          throw validationError("QUALITY_RELEASE_OPEN_FINDINGS", "Inspection cannot be released while open findings remain", {
            inspectionId: inspection.id,
            openFindings: inspection.openFindings
          });
        }

        if (inspection.releaseReadiness < 90) {
          throw validationError("QUALITY_RELEASE_READINESS_LOW", "Inspection release readiness must be at least 90% before release", {
            inspectionId: inspection.id,
            releaseReadiness: inspection.releaseReadiness
          });
        }
      }

      const updatedInspection = await repository.updateQualityInspection({
        inspectionId: input.inspectionId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "quality_inspection",
        aggregateId: updatedInspection.id,
        action: "quality.inspection.updated",
        metadata: {
          status: updatedInspection.status,
          nextAction: updatedInspection.nextAction
        }
      });

      return updatedInspection;
    }
  };
}
