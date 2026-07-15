import {
  CreateProjectScheduleActivityRequestSchema,
  ImportProjectScheduleActivitiesRequestSchema,
  UpdateProjectScheduleActivityRequestSchema
} from "@arcont/contracts";
import type { FastifyInstance } from "fastify";
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

function resolveCompanyId(session: { role: { scope: string }; company: { id: string } }, requestedCompanyId?: string) {
  return session.role.scope === "platform" ? requestedCompanyId ?? session.company.id : session.company.id;
}

export async function registerProjectSchedulesRoutes(app: FastifyInstance) {
  app.get<{ Params: { projectId: string }; Querystring: { companyId?: string } }>(
    "/projects/:projectId/schedule",
    async (request) => {
      const session = await app.container.authService.authorize(getBearerToken(request.headers.authorization), {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });

      return app.container.projectSchedulesService.getOverview(resolveCompanyId(session, request.query.companyId), request.params.projectId);
    }
  );

  app.post<{ Params: { projectId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/projects/:projectId/schedule/activities",
    async (request) => {
      const session = await app.container.authService.authorize(getBearerToken(request.headers.authorization), {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });
      const input = CreateProjectScheduleActivityRequestSchema.parse(request.body);

      return app.container.projectSchedulesService.createActivity({
        ...input,
        companyId: resolveCompanyId(session, request.query.companyId),
        projectId: request.params.projectId
      });
    }
  );

  app.post<{ Params: { projectId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/projects/:projectId/schedule/import",
    async (request) => {
      const session = await app.container.authService.authorize(getBearerToken(request.headers.authorization), {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });
      const input = ImportProjectScheduleActivitiesRequestSchema.parse(request.body);

      return app.container.projectSchedulesService.importActivities({
        companyId: resolveCompanyId(session, request.query.companyId),
        projectId: request.params.projectId,
        activities: input.activities
      });
    }
  );

  app.patch<{ Params: { projectId: string; activityId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/projects/:projectId/schedule/activities/:activityId",
    async (request) => {
      const session = await app.container.authService.authorize(getBearerToken(request.headers.authorization), {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });
      const input = UpdateProjectScheduleActivityRequestSchema.parse(request.body);

      return app.container.projectSchedulesService.updateActivity({
        ...input,
        companyId: resolveCompanyId(session, request.query.companyId),
        projectId: request.params.projectId,
        activityId: request.params.activityId
      });
    }
  );
}
