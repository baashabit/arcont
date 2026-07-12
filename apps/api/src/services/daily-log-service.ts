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

    const [entries, risks] = await Promise.all([
      repository.listDailyLogEntries(companyId),
      repository.listDailyLogRisks(companyId)
    ]);

    const today = entries
      .map((entry) => entry.logDate)
      .sort((left, right) => right.localeCompare(left))[0];

    const focusEntry =
      entries
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
        approvedLogs: entries.filter((entry) => entry.status === "approved").length,
        flaggedLogs: entries.filter((entry) => entry.status === "flagged").length,
        totalWorkforce: entries.reduce((sum, entry) => sum + entry.workforceCount, 0),
        pendingEvidence: entries.reduce(
          (sum, entry) => sum + (entry.status !== "approved" ? Math.max(0, 12 - entry.evidenceCount) : 0),
          0
        ),
        averageProgress:
          entries.length > 0 ? roundMetric(entries.reduce((sum, entry) => sum + entry.progressPercent, 0) / entries.length) : 0
      },
      entries,
      risks,
      focusEntry
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
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

      return repository.updateDailyLogEntry({
        entryId: input.entryId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  };
}
