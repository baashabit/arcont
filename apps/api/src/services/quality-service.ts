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
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("QUALITY_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [inspections, risks, projects, dailyLogs] = await Promise.all([
      repository.listQualityInspections(companyId),
      repository.listQualityRisks(companyId),
      repository.listProjects(companyId),
      repository.listDailyLogEntries(companyId)
    ]);

    const inspectionsBoard = inspections.map((inspection) => {
      const project =
        projects.find((item) => inspection.areaName.includes(item.name) || item.name.includes(inspection.areaName)) ??
        projects.find((item) => item.companyId === companyId) ??
        null;
      const latestDailyLog =
        dailyLogs
          .filter((entry) => entry.projectName === project?.name || entry.frontName === inspection.areaName)
          .slice()
          .sort((left, right) => right.logDate.localeCompare(left.logDate) || right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;

      return {
        ...inspection,
        projectName: project?.name ?? inspection.areaName,
        projectStatus: project?.status ?? "planning",
        latestDailyLogStatus: latestDailyLog?.status ?? "unknown"
      };
    });

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
          if (left.latestDailyLogStatus === "flagged" && right.latestDailyLogStatus !== "flagged") {
            return -1;
          }
          if (left.latestDailyLogStatus !== "flagged" && right.latestDailyLogStatus === "flagged") {
            return 1;
          }
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
        averageReworkRate,
        executionRiskInspections: inspectionsBoard.filter(
          (item) => item.latestDailyLogStatus === "flagged" || item.projectStatus === "blocked" || item.openFindings > 3
        ).length
      },
      inspectionsBoard,
      risks,
      focusInspection
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
    },
    async createInspection(input: {
      companyId: string;
      areaName: string;
      checklistName: string;
      contractorName: string;
      severity: "minor" | "major" | "critical";
      openFindings: number;
      evidenceCompletion: number;
      releaseReadiness: number;
      reworkRate: number;
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
      const areaName = input.areaName.trim();
      const checklistName = input.checklistName.trim();
      const contractorName = input.contractorName.trim();
      const nextAction = input.nextAction.trim();

      if (areaName.length < 3 || checklistName.length < 3 || contractorName.length < 3) {
        throw validationError(
          "QUALITY_INVALID_INPUT",
          "Area, checklist and contractor must be specific",
          {
            areaNameLength: areaName.length,
            checklistNameLength: checklistName.length,
            contractorNameLength: contractorName.length
          }
        );
      }

      if (
        !Number.isFinite(input.openFindings) ||
        !Number.isFinite(input.evidenceCompletion) ||
        !Number.isFinite(input.releaseReadiness) ||
        !Number.isFinite(input.reworkRate)
      ) {
        throw validationError(
          "QUALITY_INVALID_NUMBERS",
          "Quality metrics must be valid numbers",
          {
            openFindings: input.openFindings,
            evidenceCompletion: input.evidenceCompletion,
            releaseReadiness: input.releaseReadiness,
            reworkRate: input.reworkRate
          }
        );
      }

      if (input.openFindings < 0 || input.evidenceCompletion < 0 || input.releaseReadiness < 0 || input.reworkRate < 0) {
        throw validationError(
          "QUALITY_NEGATIVE_METRICS",
          "Quality metrics cannot be negative",
          {
            openFindings: input.openFindings,
            evidenceCompletion: input.evidenceCompletion,
            releaseReadiness: input.releaseReadiness,
            reworkRate: input.reworkRate
          }
        );
      }

      if (input.evidenceCompletion > 100 || input.releaseReadiness > 100 || input.reworkRate > 100) {
        throw validationError(
          "QUALITY_PERCENT_OUT_OF_RANGE",
          "Evidence completion, release readiness and rework rate must stay between 0 and 100",
          {
            evidenceCompletion: input.evidenceCompletion,
            releaseReadiness: input.releaseReadiness,
            reworkRate: input.reworkRate
          }
        );
      }

      if (nextAction.length < 8) {
        throw validationError(
          "QUALITY_INVALID_NEXT_ACTION",
          "Next action must be specific before creating an inspection",
          {
            nextActionLength: nextAction.length
          }
        );
      }

      if (
        inspections.some(
          (item) =>
            item.areaName.trim().toLowerCase() === areaName.toLowerCase() &&
            item.checklistName.trim().toLowerCase() === checklistName.toLowerCase() &&
            item.status !== "released"
        )
      ) {
        throw validationError(
          "QUALITY_INSPECTION_DUPLICATE",
          "An open quality inspection already exists for this area and checklist",
          {
            areaName,
            checklistName
          }
        );
      }

      if (input.status === "released") {
        throw validationError(
          "QUALITY_RELEASE_CREATION_BLOCKED",
          "Inspection cannot start in released status",
          {
            areaName,
            checklistName,
            status: input.status
          }
        );
      }

      const created = await repository.createQualityInspection({
        companyId: input.companyId,
        code: `QLT-${String(inspections.length + 1).padStart(3, "0")}`,
        areaName,
        checklistName,
        contractorName,
        severity: input.severity,
        openFindings: input.openFindings,
        evidenceCompletion: input.evidenceCompletion,
        releaseReadiness: input.releaseReadiness,
        reworkRate: input.reworkRate,
        status: input.status,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "quality_inspection",
        aggregateId: created.id,
        action: "quality.inspection.created",
        metadata: {
          code: created.code,
          areaName: created.areaName,
          severity: created.severity,
          status: created.status
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedInspection = refreshed.inspectionsBoard.find((item) => item.id === created.id);
      if (!refreshedInspection) {
        throw notFound("QUALITY_INSPECTION_NOT_FOUND", "Inspection not found after creation", {
          companyId: input.companyId,
          inspectionId: created.id
        });
      }

      return refreshedInspection;
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

      await repository.updateQualityInspection({
        inspectionId: input.inspectionId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "quality_inspection",
        aggregateId: input.inspectionId,
        action: "quality.inspection.updated",
        metadata: {
          status: input.status,
          nextAction: input.nextAction
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedInspection = refreshed.inspectionsBoard.find((item) => item.id === input.inspectionId);
      if (!refreshedInspection) {
        throw notFound("QUALITY_INSPECTION_NOT_FOUND", "Inspection not found after update", {
          companyId: input.companyId,
          inspectionId: input.inspectionId
        });
      }

      return refreshedInspection;
    }
  };
}
