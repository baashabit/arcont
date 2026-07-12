import { notFound } from "../lib/domain-error.js";
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
    }
  };
}
