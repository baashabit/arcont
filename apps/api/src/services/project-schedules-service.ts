import { notFound, validationError } from "../lib/domain-error.js";
import type {
  CreateProjectScheduleActivityInput,
  PlatformRepository,
  ProjectScheduleActivityRecord,
  UpdateProjectScheduleActivityInput
} from "../repositories/platform-repository.js";

type ImportProjectScheduleActivityInput = {
  code: string;
  name: string;
  phase: string;
  plannedStart: string;
  plannedFinish: string;
  predecessorCodes: string[];
  owner: string;
  nextAction: string;
};

type ImportProjectScheduleActivitiesInput = {
  companyId: string;
  projectId: string;
  activities: ImportProjectScheduleActivityInput[];
};

function compareDate(left: string, right: string) {
  return left.localeCompare(right);
}

function calculatePlannedProgress(activity: ProjectScheduleActivityRecord, now = new Date()) {
  const start = new Date(`${activity.plannedStart}T00:00:00Z`).getTime();
  const finish = new Date(`${activity.plannedFinish}T23:59:59Z`).getTime();
  const current = now.getTime();

  if (finish <= start) {
    return current >= finish ? 100 : 0;
  }

  return Math.max(0, Math.min(100, ((current - start) / (finish - start)) * 100));
}

function calculateVarianceDays(activities: ProjectScheduleActivityRecord[], now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dayMs = 24 * 60 * 60 * 1000;

  return activities.reduce((largestDelay, activity) => {
    if (activity.status === "completed" || activity.progressPercent >= 100) {
      return largestDelay;
    }

    const plannedFinish = new Date(`${activity.plannedFinish}T00:00:00Z`).getTime();
    return Math.max(largestDelay, Math.max(0, Math.ceil((today - plannedFinish) / dayMs)));
  }, 0);
}

function assertDateRange(plannedStart: string, plannedFinish: string) {
  if (compareDate(plannedStart, plannedFinish) > 0) {
    throw validationError("PROJECT_SCHEDULE_INVALID_DATES", "Planned finish must be on or after planned start", {
      plannedStart,
      plannedFinish
    });
  }
}

function assertCompletionConsistency(input: UpdateProjectScheduleActivityInput) {
  if (input.actualStart && input.actualFinish && compareDate(input.actualStart, input.actualFinish) > 0) {
    throw validationError("PROJECT_SCHEDULE_INVALID_ACTUAL_DATES", "Actual finish must be on or after actual start", {
      actualStart: input.actualStart,
      actualFinish: input.actualFinish
    });
  }

  if (input.status === "completed" && (input.progressPercent !== 100 || !input.actualFinish)) {
    throw validationError(
      "PROJECT_SCHEDULE_COMPLETION_INCOMPLETE",
      "Completed activities require 100% progress and an actual finish date",
      { progressPercent: input.progressPercent, actualFinish: input.actualFinish }
    );
  }

  if (input.status === "not_started" && (input.progressPercent > 0 || input.actualStart || input.actualFinish)) {
    throw validationError(
      "PROJECT_SCHEDULE_NOT_STARTED_INCONSISTENT",
      "Not-started activities cannot carry progress or actual dates",
      { progressPercent: input.progressPercent, actualStart: input.actualStart, actualFinish: input.actualFinish }
    );
  }

  if (input.status === "in_progress" && (!input.actualStart || input.progressPercent === 0)) {
    throw validationError(
      "PROJECT_SCHEDULE_IN_PROGRESS_INCONSISTENT",
      "In-progress activities require an actual start date and measurable progress",
      { progressPercent: input.progressPercent, actualStart: input.actualStart }
    );
  }
}

function assertNoCircularDependencies(
  activities: ProjectScheduleActivityRecord[],
  activityId: string | undefined,
  predecessorIds: string[]
) {
  const dependencies = new Map(activities.map((activity) => [activity.id, activity.predecessorIds]));
  if (activityId) {
    dependencies.set(activityId, predecessorIds);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (currentId: string): boolean => {
    if (visiting.has(currentId)) {
      return true;
    }
    if (visited.has(currentId)) {
      return false;
    }

    visiting.add(currentId);
    const hasCycle = (dependencies.get(currentId) ?? []).some((predecessorId) => visit(predecessorId));
    visiting.delete(currentId);
    visited.add(currentId);
    return hasCycle;
  };

  if ([...dependencies.keys()].some((currentId) => visit(currentId))) {
    throw validationError(
      "PROJECT_SCHEDULE_CIRCULAR_DEPENDENCY",
      "Schedule dependencies cannot contain a circular path",
      { activityId, predecessorIds }
    );
  }
}

function normalizeImportActivity(input: ImportProjectScheduleActivityInput) {
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    phase: input.phase.trim(),
    plannedStart: input.plannedStart,
    plannedFinish: input.plannedFinish,
    predecessorCodes: [...new Set(input.predecessorCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))],
    owner: input.owner.trim(),
    nextAction: input.nextAction.trim()
  };
}

function assertNoCircularDependenciesByCode(
  existingActivities: ProjectScheduleActivityRecord[],
  importedActivities: Array<ReturnType<typeof normalizeImportActivity>>
) {
  const codeById = new Map(existingActivities.map((activity) => [activity.id, activity.code.toUpperCase()]));
  const dependencies = new Map<string, string[]>();

  existingActivities.forEach((activity) => {
    dependencies.set(
      activity.code.toUpperCase(),
      [...new Set(activity.predecessorIds.map((predecessorId) => codeById.get(predecessorId)).filter((code): code is string => Boolean(code)))]
    );
  });

  importedActivities.forEach((activity) => {
    dependencies.set(activity.code, activity.predecessorCodes);
  });

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (currentCode: string): boolean => {
    if (visiting.has(currentCode)) {
      return true;
    }
    if (visited.has(currentCode)) {
      return false;
    }

    visiting.add(currentCode);
    const hasCycle = (dependencies.get(currentCode) ?? []).some((predecessorCode) => visit(predecessorCode));
    visiting.delete(currentCode);
    visited.add(currentCode);
    return hasCycle;
  };

  if ([...dependencies.keys()].some((currentCode) => visit(currentCode))) {
    throw validationError(
      "PROJECT_SCHEDULE_CIRCULAR_DEPENDENCY",
      "Schedule dependencies cannot contain a circular path",
      { importedCodes: importedActivities.map((activity) => activity.code) }
    );
  }
}

export function createProjectSchedulesService(repository: PlatformRepository) {
  async function resolveProject(companyId: string, projectId: string) {
    const project = (await repository.listProjects(companyId)).find((item) => item.id === projectId);
    if (!project) {
      throw notFound("PROJECT_SCHEDULE_PROJECT_NOT_FOUND", "Project was not found for this company", { companyId, projectId });
    }

    return project;
  }

  async function validatePredecessors(
    companyId: string,
    projectId: string,
    predecessorIds: string[],
    activityId?: string
  ) {
    const uniquePredecessors = [...new Set(predecessorIds)];
    if (uniquePredecessors.length !== predecessorIds.length || predecessorIds.includes(activityId ?? "")) {
      throw validationError("PROJECT_SCHEDULE_INVALID_PREDECESSORS", "Predecessors must be unique and cannot reference the same activity", {
        predecessorIds,
        activityId
      });
    }

    const activities = await repository.listProjectScheduleActivities(companyId, projectId);
    const availableIds = new Set(activities.map((activity) => activity.id));
    const missing = uniquePredecessors.filter((predecessorId) => !availableIds.has(predecessorId));
    if (missing.length > 0) {
      throw validationError("PROJECT_SCHEDULE_PREDECESSOR_NOT_FOUND", "Every predecessor must belong to the same project schedule", {
        projectId,
        missing
      });
    }
    return activities;
  }

  async function createActivity(input: CreateProjectScheduleActivityInput) {
    await resolveProject(input.companyId, input.projectId);
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const phase = input.phase.trim();
    const owner = input.owner.trim();
    const nextAction = input.nextAction.trim();
    assertDateRange(input.plannedStart, input.plannedFinish);

    if (![code, name, phase, owner, nextAction].every((value) => value.length >= 3)) {
      throw validationError("PROJECT_SCHEDULE_INVALID_ACTIVITY", "Activity code, name, phase, owner and next action must be specific", {
        codeLength: code.length,
        nameLength: name.length,
        phaseLength: phase.length,
        ownerLength: owner.length,
        nextActionLength: nextAction.length
      });
    }

    if (!/^[A-Z0-9-]+$/.test(code)) {
      throw validationError("PROJECT_SCHEDULE_INVALID_ACTIVITY_CODE", "Activity code must use uppercase letters, numbers or dashes", { code });
    }

    const activities = await repository.listProjectScheduleActivities(input.companyId, input.projectId);
    if (activities.some((activity) => activity.code === code)) {
      throw validationError("PROJECT_SCHEDULE_DUPLICATE_ACTIVITY_CODE", "Activity code already exists in this project schedule", {
        projectId: input.projectId,
        code
      });
    }

    await validatePredecessors(input.companyId, input.projectId, input.predecessorIds);
    const created = await repository.createProjectScheduleActivity({
      ...input,
      code,
      name,
      phase,
      owner,
      nextAction,
      predecessorIds: [...new Set(input.predecessorIds)]
    });

    await repository.addAuditEvent({
      companyId: input.companyId,
      aggregateType: "project_schedule_activity",
      aggregateId: created.id,
      action: "project_schedule.activity.created",
      metadata: { projectId: input.projectId, code: created.code, phase: created.phase }
    });

    return created;
  }

  async function updateActivity(input: UpdateProjectScheduleActivityInput) {
    await resolveProject(input.companyId, input.projectId);
    assertDateRange(input.plannedStart, input.plannedFinish);
    assertCompletionConsistency(input);
    const activities = await validatePredecessors(
      input.companyId,
      input.projectId,
      input.predecessorIds,
      input.activityId
    );
    assertNoCircularDependencies(activities, input.activityId, input.predecessorIds);

    const updated = await repository.updateProjectScheduleActivity({
      ...input,
      owner: input.owner.trim(),
      nextAction: input.nextAction.trim(),
      predecessorIds: [...new Set(input.predecessorIds)]
    });

    await repository.addAuditEvent({
      companyId: input.companyId,
      aggregateType: "project_schedule_activity",
      aggregateId: updated.id,
      action: "project_schedule.activity.updated",
      metadata: { projectId: input.projectId, status: updated.status, progressPercent: updated.progressPercent }
    });

    return updated;
  }

  return {
    async getOverview(companyId: string, projectId: string) {
      const project = await resolveProject(companyId, projectId);
      const activities = await repository.listProjectScheduleActivities(companyId, projectId);
      const baselineStart = activities.reduce<string | null>(
        (earliest, activity) => (!earliest || compareDate(activity.plannedStart, earliest) < 0 ? activity.plannedStart : earliest),
        null
      );
      const baselineFinish = activities.reduce<string | null>(
        (latest, activity) => (!latest || compareDate(activity.plannedFinish, latest) > 0 ? activity.plannedFinish : latest),
        null
      );

      return {
        project,
        summary: {
          totalActivities: activities.length,
          completedActivities: activities.filter((activity) => activity.status === "completed").length,
          blockedActivities: activities.filter((activity) => activity.status === "blocked").length,
          plannedProgress: Number(
            (activities.reduce((sum, activity) => sum + calculatePlannedProgress(activity), 0) / Math.max(activities.length, 1)).toFixed(1)
          ),
          actualProgress: Number(
            (activities.reduce((sum, activity) => sum + activity.progressPercent, 0) / Math.max(activities.length, 1)).toFixed(1)
          ),
          scheduleVarianceDays: calculateVarianceDays(activities),
          baselineStart,
          baselineFinish
        },
        activities: activities.slice().sort((left, right) => compareDate(left.plannedStart, right.plannedStart) || left.code.localeCompare(right.code))
      };
    },

    createActivity,

    async importActivities(input: ImportProjectScheduleActivitiesInput) {
      await resolveProject(input.companyId, input.projectId);
      const existingActivities = await repository.listProjectScheduleActivities(input.companyId, input.projectId);
      const existingCodeMap = new Map(existingActivities.map((activity) => [activity.code.toUpperCase(), activity]));
      const normalizedActivities = input.activities.map(normalizeImportActivity);
      const importCodeSet = new Set<string>();

      normalizedActivities.forEach((activity) => {
        assertDateRange(activity.plannedStart, activity.plannedFinish);

        if (![activity.code, activity.name, activity.phase, activity.owner, activity.nextAction].every((value) => value.length >= 3)) {
          throw validationError(
            "PROJECT_SCHEDULE_INVALID_ACTIVITY",
            "Imported activities require specific code, name, phase, owner and next action",
            { code: activity.code }
          );
        }

        if (!/^[A-Z0-9-]+$/.test(activity.code)) {
          throw validationError("PROJECT_SCHEDULE_INVALID_ACTIVITY_CODE", "Activity code must use uppercase letters, numbers or dashes", {
            code: activity.code
          });
        }

        if (existingCodeMap.has(activity.code) || importCodeSet.has(activity.code)) {
          throw validationError("PROJECT_SCHEDULE_DUPLICATE_ACTIVITY_CODE", "Activity code already exists in this project schedule", {
            projectId: input.projectId,
            code: activity.code
          });
        }

        if (activity.predecessorCodes.includes(activity.code)) {
          throw validationError(
            "PROJECT_SCHEDULE_INVALID_PREDECESSORS",
            "Predecessors must be unique and cannot reference the same activity",
            { code: activity.code, predecessorCodes: activity.predecessorCodes }
          );
        }

        importCodeSet.add(activity.code);
      });

      normalizedActivities.forEach((activity) => {
        const missingCodes = activity.predecessorCodes.filter(
          (code) => !existingCodeMap.has(code) && !importCodeSet.has(code)
        );
        if (missingCodes.length > 0) {
          throw validationError(
            "PROJECT_SCHEDULE_PREDECESSOR_NOT_FOUND",
            "Every predecessor must belong to the same project schedule or import batch",
            { code: activity.code, missingCodes }
          );
        }
      });

      assertNoCircularDependenciesByCode(existingActivities, normalizedActivities);

      const createdByCode = new Map<string, ProjectScheduleActivityRecord>();
      const pending = [...normalizedActivities];
      const createdCodes: string[] = [];
      let linkedToExistingCount = 0;
      let linkedWithinImportCount = 0;

      while (pending.length > 0) {
        const ready = pending.filter((activity) =>
          activity.predecessorCodes.every((code) => existingCodeMap.has(code) || createdByCode.has(code))
        );

        if (ready.length === 0) {
          throw validationError(
            "PROJECT_SCHEDULE_CIRCULAR_DEPENDENCY",
            "Schedule dependencies cannot contain a circular path",
            { projectId: input.projectId }
          );
        }

        for (const activity of ready) {
          const predecessorIds = activity.predecessorCodes.flatMap((code) => {
            const existing = existingCodeMap.get(code);
            if (existing) {
              linkedToExistingCount += 1;
              return [existing.id];
            }

            const created = createdByCode.get(code);
            if (created) {
              linkedWithinImportCount += 1;
              return [created.id];
            }

            return [];
          });

          const created = await createActivity({
            companyId: input.companyId,
            projectId: input.projectId,
            code: activity.code,
            name: activity.name,
            phase: activity.phase,
            plannedStart: activity.plannedStart,
            plannedFinish: activity.plannedFinish,
            predecessorIds,
            owner: activity.owner,
            nextAction: activity.nextAction
          });

          createdByCode.set(activity.code, created);
          createdCodes.push(activity.code);
        }

        const readyCodes = new Set(ready.map((activity) => activity.code));
        for (let index = pending.length - 1; index >= 0; index -= 1) {
          if (readyCodes.has(pending[index].code)) {
            pending.splice(index, 1);
          }
        }
      }

      return {
        createdCount: createdCodes.length,
        linkedToExistingCount,
        linkedWithinImportCount,
        createdCodes
      };
    },

    updateActivity
  };
}
