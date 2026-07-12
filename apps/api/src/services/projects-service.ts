import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createProjectsService(repository: PlatformRepository) {
  return {
    async getPortfolioOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("PROJECTS_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const projects = await repository.listProjects(companyId);
      const risks = await repository.listProjectRisks(companyId);
      const activeProjects = projects.filter((project) =>
        ["active", "at_risk", "blocked"].includes(project.status)
      );
      const totalProgress = activeProjects.reduce((sum, project) => sum + project.progress, 0);
      const focusProject =
        activeProjects
          .slice()
          .sort((left, right) => {
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
          permitBlockers: activeProjects.reduce((sum, project) => sum + project.permitBlockers, 0)
        },
        projects,
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

      if (project.status === input.status && project.nextMilestone === input.nextMilestone) {
        return project;
      }

      if (input.status === "active" && project.permitBlockers > 2) {
        throw validationError("PROJECTS_PERMIT_BLOCKERS", "Project cannot move to active while permit blockers remain too high", {
          projectId: project.id,
          permitBlockers: project.permitBlockers
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
      }

      const updatedProject = await repository.updateProjectPortfolioItem({
        projectId: input.projectId,
        status: input.status,
        nextMilestone: input.nextMilestone
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "project_portfolio_item",
        aggregateId: updatedProject.id,
        action: "projects.portfolio_item.updated",
        metadata: {
          status: updatedProject.status,
          nextMilestone: updatedProject.nextMilestone
        }
      });

      return updatedProject;
    }
  };
}
