import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

function statusWeight(status: "draft" | "submitted" | "approved" | "flagged") {
  switch (status) {
    case "flagged":
      return 4;
    case "submitted":
      return 3;
    case "draft":
      return 2;
    default:
      return 1;
  }
}

export function createDailyLogService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("DAILY_LOG_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [entries, risks, projects, qualityInspections, hrWorkforces] = await Promise.all([
      repository.listDailyLogEntries(companyId),
      repository.listDailyLogRisks(companyId),
      repository.listProjects(companyId),
      repository.listQualityInspections(companyId),
      repository.listHrWorkforces(companyId)
    ]);

    const entryViews = entries.map((entry) => {
      const project =
        projects.find((item) => item.name === entry.projectName) ??
        projects.find((item) => entry.projectName.includes(item.name) || item.name.includes(entry.projectName)) ??
        null;
      const relatedInspections = qualityInspections.filter((inspection) =>
        inspection.areaName.includes(entry.frontName) ||
        inspection.areaName.includes(entry.projectName) ||
        entry.projectName.includes(inspection.areaName)
      );
      const qualityOpenFindings = relatedInspections.reduce((sum, inspection) => sum + inspection.openFindings, 0);
      const qualityReleaseReadiness =
        relatedInspections.length > 0
          ? roundMetric(
              relatedInspections.reduce((sum, inspection) => sum + inspection.releaseReadiness, 0) /
                relatedInspections.length
            )
          : 100;
      const relatedWorkforce =
        hrWorkforces.find((item) => item.frontName === entry.frontName) ??
        hrWorkforces.find((item) => entry.frontName.includes(item.frontName) || item.frontName.includes(entry.frontName)) ??
        null;

      return {
        ...entry,
        projectStatus: project?.status ?? "planning",
        qualityOpenFindings,
        qualityReleaseReadiness,
        subcontractHealth: relatedWorkforce?.safetyStatus ?? "unknown",
        pendingDestajo:
          relatedWorkforce
            ? Math.max(
                Math.round(
                  relatedWorkforce.activeHeadcount * 185000 +
                    relatedWorkforce.productivityRate * 12000 -
                    (relatedWorkforce.activeHeadcount * 185000 +
                      relatedWorkforce.productivityRate * 12000) *
                      Math.max(0.42, 1 - relatedWorkforce.incidentCount * 0.08 - relatedWorkforce.complianceExpirations * 0.05)
                ),
                0
              )
            : 0
      };
    });

    const today = entryViews
      .map((entry) => entry.logDate)
      .sort((left, right) => right.localeCompare(left))[0];

    const focusEntry =
      entryViews
        .slice()
        .sort((left, right) => {
          const statusGap = statusWeight(right.status) - statusWeight(left.status);
          if (statusGap !== 0) {
            return statusGap;
          }
          return right.updatedAt.localeCompare(left.updatedAt);
        })[0] ?? null;

    return {
      summary: {
        submittedToday: entries.filter((entry) => entry.logDate === today && entry.status !== "draft").length,
        approvedLogs: entryViews.filter((entry) => entry.status === "approved").length,
        flaggedLogs: entryViews.filter((entry) => entry.status === "flagged").length,
        totalWorkforce: entryViews.reduce((sum, entry) => sum + entry.workforceCount, 0),
        pendingEvidence: entryViews.reduce(
          (sum, entry) => sum + (entry.status !== "approved" ? Math.max(0, 12 - entry.evidenceCount) : 0),
          0
        ),
        averageProgress:
          entryViews.length > 0 ? roundMetric(entryViews.reduce((sum, entry) => sum + entry.progressPercent, 0) / entryViews.length) : 0,
        executionRiskLogs: entryViews.filter(
          (entry) =>
            entry.status === "flagged" ||
            entry.qualityOpenFindings > 3 ||
            entry.subcontractHealth === "critical"
        ).length
      },
      entries: entryViews,
      risks,
      focusEntry
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
    },
    async createEntry(input: {
      companyId: string;
      projectName: string;
      frontName: string;
      supervisor: string;
      logDate: string;
      shift: "morning" | "mixed" | "night";
      weather: "clear" | "windy" | "rain" | "storm";
      status: "draft" | "submitted" | "approved" | "flagged";
      progressPercent: number;
      workforceCount: number;
      incidentsCount: number;
      blockersCount: number;
      evidenceCount: number;
      concretePourM3: number;
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const projectName = input.projectName.trim();
      const frontName = input.frontName.trim();
      const supervisor = input.supervisor.trim();
      const nextAction = input.nextAction.trim();

      if (projectName.length < 3 || frontName.length < 3 || supervisor.length < 3) {
        throw validationError(
          "DAILY_LOG_INVALID_INPUT",
          "Project, front and supervisor must be specific",
          {
            projectNameLength: projectName.length,
            frontNameLength: frontName.length,
            supervisorLength: supervisor.length
          }
        );
      }

      if (Number.isNaN(Date.parse(input.logDate))) {
        throw validationError("DAILY_LOG_INVALID_DATE", "Daily log date must be valid", {
          logDate: input.logDate
        });
      }

      if (input.progressPercent < 0 || input.progressPercent > 100) {
        throw validationError("DAILY_LOG_INVALID_PROGRESS", "Progress percent must stay between 0 and 100", {
          progressPercent: input.progressPercent
        });
      }

      if (
        [input.workforceCount, input.incidentsCount, input.blockersCount, input.evidenceCount, input.concretePourM3].some(
          (value) => !Number.isFinite(value) || value < 0
        )
      ) {
        throw validationError(
          "DAILY_LOG_INVALID_COUNTS",
          "Workforce, incidents, blockers, evidence and concrete metrics must be zero or greater",
          {
            workforceCount: input.workforceCount,
            incidentsCount: input.incidentsCount,
            blockersCount: input.blockersCount,
            evidenceCount: input.evidenceCount,
            concretePourM3: input.concretePourM3
          }
        );
      }

      if (nextAction.length < 8) {
        throw validationError(
          "DAILY_LOG_INVALID_NEXT_ACTION",
          "Next action must be specific before creating a daily log entry",
          {
            nextActionLength: nextAction.length
          }
        );
      }

      if (
        overview.entries.some(
          (entry) =>
            entry.projectName.trim().toLowerCase() === projectName.toLowerCase() &&
            entry.frontName.trim().toLowerCase() === frontName.toLowerCase() &&
            entry.logDate === input.logDate &&
            entry.shift === input.shift
        )
      ) {
        throw validationError(
          "DAILY_LOG_DUPLICATE_SHIFT",
          "A daily log already exists for this front, date and shift",
          {
            projectName,
            frontName,
            logDate: input.logDate,
            shift: input.shift
          }
        );
      }

      if (input.status === "submitted" || input.status === "approved") {
        if (input.workforceCount === 0) {
          throw validationError("DAILY_LOG_EMPTY_CREW", "Daily log cannot be submitted without workforce captured", {
            projectName,
            frontName
          });
        }

        if (input.evidenceCount === 0) {
          throw validationError("DAILY_LOG_MISSING_EVIDENCE", "Daily log needs at least one evidence item before submission", {
            projectName,
            frontName
          });
        }
      }

      if (input.status === "approved") {
        throw validationError(
          "DAILY_LOG_APPROVAL_SEQUENCE",
          "Daily log cannot start as approved; create it in draft or submitted first",
          {
            projectName,
            frontName,
            status: input.status
          }
        );
      }

      const created = await repository.createDailyLogEntry({
        companyId: input.companyId,
        projectName,
        frontName,
        supervisor,
        logDate: input.logDate,
        shift: input.shift,
        weather: input.weather,
        status: input.status,
        progressPercent: input.progressPercent,
        workforceCount: input.workforceCount,
        incidentsCount: input.incidentsCount,
        blockersCount: input.blockersCount,
        evidenceCount: input.evidenceCount,
        concretePourM3: input.concretePourM3,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "daily_log_entry",
        aggregateId: created.id,
        action: "daily-log.entry.created",
        metadata: {
          projectName: created.projectName,
          frontName: created.frontName,
          logDate: created.logDate,
          shift: created.shift,
          status: created.status
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedEntry = refreshed.entries.find((entry) => entry.id === created.id);
      if (!refreshedEntry) {
        throw notFound("DAILY_LOG_ENTRY_NOT_FOUND", "Daily log entry not found after creation", {
          companyId: input.companyId,
          entryId: created.id
        });
      }

      return refreshedEntry;
    },
    async updateEntry(input: {
      companyId: string;
      entryId: string;
      status: "draft" | "submitted" | "approved" | "flagged";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const currentEntry = overview.entries.find((entry) => entry.id === input.entryId);

      if (!currentEntry) {
        throw notFound("DAILY_LOG_ENTRY_NOT_FOUND", "Daily log entry not found", {
          companyId: input.companyId,
          entryId: input.entryId
        });
      }

      if (input.status === "submitted") {
        if (currentEntry.workforceCount === 0) {
          throw validationError("DAILY_LOG_EMPTY_CREW", "Daily log cannot be submitted without workforce captured", {
            entryId: currentEntry.id
          });
        }

        if (currentEntry.evidenceCount === 0) {
          throw validationError("DAILY_LOG_MISSING_EVIDENCE", "Daily log needs at least one evidence item before submission", {
            entryId: currentEntry.id
          });
        }
      }

      if (input.status === "approved") {
        if (currentEntry.status === "draft") {
          throw validationError("DAILY_LOG_APPROVAL_SEQUENCE", "Daily log must be submitted before approval", {
            entryId: currentEntry.id,
            status: currentEntry.status
          });
        }

        if (currentEntry.blockersCount > 0) {
          throw validationError("DAILY_LOG_BLOCKERS_OPEN", "Daily log with open blockers cannot move to approved", {
            entryId: currentEntry.id,
            blockersCount: currentEntry.blockersCount
          });
        }

        if (currentEntry.evidenceCount < 8) {
          throw validationError("DAILY_LOG_EVIDENCE_LOW", "Daily log needs stronger evidence coverage before approval", {
            entryId: currentEntry.id,
            evidenceCount: currentEntry.evidenceCount
          });
        }
      }

      if (input.status === "draft" && currentEntry.status === "approved") {
        throw validationError("DAILY_LOG_APPROVED_LOCKED", "Approved daily logs cannot move back to draft", {
          entryId: currentEntry.id
        });
      }

      await repository.updateDailyLogEntry({
        entryId: input.entryId,
        status: input.status,
        nextAction: input.nextAction
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedEntry = refreshed.entries.find((entry) => entry.id === input.entryId);
      if (!refreshedEntry) {
        throw notFound("DAILY_LOG_ENTRY_NOT_FOUND", "Daily log entry not found after update", {
          companyId: input.companyId,
          entryId: input.entryId
        });
      }

      return refreshedEntry;
    }
  };
}
