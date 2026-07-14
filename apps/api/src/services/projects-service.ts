import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedProjectTransitions: Record<
  "planning" | "active" | "at_risk" | "blocked" | "closed",
  Array<"planning" | "active" | "at_risk" | "blocked" | "closed">
> = {
  planning: ["active", "blocked"],
  active: ["at_risk", "blocked", "closed"],
  at_risk: ["active", "blocked", "closed"],
  blocked: ["active", "at_risk"],
  closed: []
};

export function createProjectsService(repository: PlatformRepository) {
  return {
    async getPortfolioOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("PROJECTS_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [projects, risks, dailyLogs, qualityInspections, hrWorkforces] = await Promise.all([
        repository.listProjects(companyId),
        repository.listProjectRisks(companyId),
        repository.listDailyLogEntries(companyId),
        repository.listQualityInspections(companyId),
        repository.listHrWorkforces(companyId)
      ]);

      const projectViews = projects.map((project) => {
        const projectDailyLogs = dailyLogs.filter((entry) => entry.projectName === project.name);
        const latestDailyLog =
          projectDailyLogs
            .slice()
            .sort((left, right) => right.logDate.localeCompare(left.logDate) || right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
        const projectFrontNames = new Set(projectDailyLogs.map((entry) => entry.frontName));
        const projectInspections = qualityInspections.filter(
          (inspection) =>
            inspection.areaName.includes(project.name) ||
            project.name.includes(inspection.areaName) ||
            Array.from(projectFrontNames).some(
              (frontName) =>
                inspection.areaName.includes(frontName) ||
                frontName.includes(inspection.areaName)
            )
        );
        const releaseReadiness =
          projectInspections.length > 0
            ? Number(
                (
                  projectInspections.reduce((sum, inspection) => sum + inspection.releaseReadiness, 0) /
                  projectInspections.length
                ).toFixed(1)
              )
            : 100;
        const projectSubcontracts = hrWorkforces.filter(
          (workforce) =>
            workforce.frontName.includes(project.name) ||
            project.name.includes(workforce.frontName) ||
            Array.from(projectFrontNames).some(
              (frontName) =>
                workforce.frontName.includes(frontName) ||
                frontName.includes(workforce.frontName)
            )
        );
        const pendingDestajo = projectSubcontracts.reduce((sum, workforce) => {
          const earnedProxy = workforce.activeHeadcount * 185000 + workforce.productivityRate * 12000;
          const paidProxy = earnedProxy * Math.max(0.42, 1 - workforce.incidentCount * 0.08 - workforce.complianceExpirations * 0.05);
          return sum + Math.max(Math.round(earnedProxy - paidProxy), 0);
        }, 0);
        const subcontractHealth =
          projectSubcontracts.some((workforce) => workforce.safetyStatus === "critical")
            ? "critical"
            : projectSubcontracts.some((workforce) => workforce.safetyStatus === "watch")
              ? "watch"
              : projectSubcontracts.length > 0
                ? "controlled"
                : "unknown";

        return {
          ...project,
          latestDailyLogStatus: latestDailyLog?.status ?? "unknown",
          latestDailyLogDate: latestDailyLog?.logDate ?? null,
          qualityReleaseReadiness: releaseReadiness,
          subcontractHealth,
          pendingDestajo
        };
      });

      const activeProjects = projectViews.filter((project) =>
        ["active", "at_risk", "blocked"].includes(project.status)
      );
      const totalProgress = activeProjects.reduce((sum, project) => sum + project.progress, 0);
      const focusProject =
        activeProjects
          .slice()
          .sort((left, right) => {
            if (left.latestDailyLogStatus === "flagged" && right.latestDailyLogStatus !== "flagged") {
              return -1;
            }
            if (left.latestDailyLogStatus !== "flagged" && right.latestDailyLogStatus === "flagged") {
              return 1;
            }
            if (left.status === "at_risk" && right.status !== "at_risk") {
              return -1;
            }

            if (left.status !== "at_risk" && right.status === "at_risk") {
              return 1;
            }

            return right.scheduleVarianceDays - left.scheduleVarianceDays;
          })[0] ?? null;

      return {
        summary: {
          activeProjects: activeProjects.length,
          averageProgress: activeProjects.length > 0 ? Number((totalProgress / activeProjects.length).toFixed(1)) : 0,
          qualityHolds: activeProjects.reduce((sum, project) => sum + project.qualityHolds, 0),
          permitBlockers: activeProjects.reduce((sum, project) => sum + project.permitBlockers, 0),
          executionRiskProjects: activeProjects.filter(
            (project) =>
              project.latestDailyLogStatus === "flagged" ||
              project.subcontractHealth === "critical" ||
              project.qualityReleaseReadiness < 75
          ).length
        },
        projects: projectViews,
        risks,
        focusProject
      };
    },
    async updateProject(input: {
      companyId: string;
      projectId: string;
      status: "planning" | "active" | "at_risk" | "blocked" | "closed";
      nextMilestone: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PROJECTS_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const projects = await repository.listProjects(input.companyId);
      const project = projects.find((candidate) => candidate.id === input.projectId);
      if (!project) {
        throw notFound("PROJECTS_PROJECT_NOT_FOUND", "Project not found", {
          companyId: input.companyId,
          projectId: input.projectId
        });
      }

      const overview = await this.getPortfolioOverview(input.companyId);
      const enrichedProject = overview.projects.find((candidate) => candidate.id === input.projectId);
      if (!enrichedProject) {
        throw notFound("PROJECTS_PROJECT_NOT_FOUND", "Project overview not found", {
          companyId: input.companyId,
          projectId: input.projectId
        });
      }

      if (project.status === input.status && project.nextMilestone === input.nextMilestone) {
        return enrichedProject;
      }

      const nextMilestone = input.nextMilestone.trim();
      if (nextMilestone.length < 8) {
        throw validationError("PROJECTS_INVALID_NEXT_MILESTONE", "Next milestone must be specific", {
          projectId: project.id,
          nextMilestoneLength: nextMilestone.length
        });
      }

      if (project.status !== input.status) {
        const allowedTransitions = allowedProjectTransitions[project.status];
        if (!allowedTransitions.includes(input.status)) {
          throw validationError("PROJECTS_INVALID_STATUS_TRANSITION", "Project status transition is not allowed", {
            projectId: project.id,
            currentStatus: project.status,
            nextStatus: input.status
          });
        }
      }

      if (input.status === "active" && project.permitBlockers > 2) {
        throw validationError("PROJECTS_PERMIT_BLOCKERS", "Project cannot move to active while permit blockers remain too high", {
          projectId: project.id,
          permitBlockers: project.permitBlockers
        });
      }

      if (input.status === "active" && enrichedProject.latestDailyLogStatus === "flagged") {
        throw validationError("PROJECTS_FLAGGED_DAILY_LOG", "Project cannot return to active while latest field log remains flagged", {
          projectId: project.id,
          latestDailyLogStatus: enrichedProject.latestDailyLogStatus
        });
      }

      if (input.status === "closed") {
        if (project.qualityHolds > 0) {
          throw validationError("PROJECTS_QUALITY_HOLDS", "Project cannot close while quality holds remain open", {
            projectId: project.id,
            qualityHolds: project.qualityHolds
          });
        }

        if (project.permitBlockers > 0) {
          throw validationError("PROJECTS_OPEN_PERMITS", "Project cannot close while permit blockers remain", {
            projectId: project.id,
            permitBlockers: project.permitBlockers
          });
        }

        if (project.progress < 100) {
          throw validationError("PROJECTS_PROGRESS_INCOMPLETE", "Project cannot close while progress remains below 100%", {
            projectId: project.id,
            progress: project.progress
          });
        }

        if (enrichedProject.latestDailyLogStatus === "flagged") {
          throw validationError("PROJECTS_FLAGGED_CLOSEOUT", "Project cannot close while the latest field log remains flagged", {
            projectId: project.id,
            latestDailyLogStatus: enrichedProject.latestDailyLogStatus
          });
        }
      }

      await repository.updateProjectPortfolioItem({
        projectId: input.projectId,
        status: input.status,
        nextMilestone
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "project_portfolio_item",
        aggregateId: input.projectId,
        action: "projects.portfolio_item.updated",
        metadata: {
          status: input.status,
          nextMilestone
        }
      });

      const refreshed = await this.getPortfolioOverview(input.companyId);
      const refreshedProject = refreshed.projects.find((candidate) => candidate.id === input.projectId);
      if (!refreshedProject) {
        throw notFound("PROJECTS_PROJECT_NOT_FOUND", "Project not found after update", {
          companyId: input.companyId,
          projectId: input.projectId
        });
      }

      return refreshedProject;
    }
  };
}
