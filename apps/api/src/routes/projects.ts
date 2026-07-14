import type { FastifyInstance } from "fastify";
import { CreateProjectPortfolioItemRequestSchema, UpdateProjectPortfolioItemRequestSchema } from "@arcont/contracts";
import { authError } from "../lib/domain-error.js";

function getBearerToken(authorization?: string) {
  if (!authorization) {
    throw authError("AUTH_HEADER_MISSING", "Authorization header is required");
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw authError("AUTH_HEADER_INVALID", "Authorization header must use Bearer token");
  }

  return token;
}

export async function registerProjectsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/projects/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });

    const companyId = session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.projectsService.getPortfolioOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/projects/items", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });
    const input = CreateProjectPortfolioItemRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.projectsService.createProject({
      companyId,
      code: input.code,
      name: input.name,
      client: input.client,
      segment: input.segment,
      status: input.status,
      stage: input.stage,
      progress: input.progress,
      scheduleVarianceDays: input.scheduleVarianceDays,
      budgetHealth: input.budgetHealth,
      qualityHolds: input.qualityHolds,
      permitBlockers: input.permitBlockers,
      activeFronts: input.activeFronts,
      nextMilestone: input.nextMilestone
    });
  });

  app.patch<{ Params: { projectId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/projects/items/:projectId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });
      const input = UpdateProjectPortfolioItemRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.projectsService.updateProject({
        companyId,
        projectId: request.params.projectId,
        status: input.status,
        nextMilestone: input.nextMilestone
      });
    }
  );
}
