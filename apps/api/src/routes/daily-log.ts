import type { FastifyInstance } from "fastify";
import { UpdateDailyLogEntryRequestSchema } from "@arcont/contracts";
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

export async function registerDailyLogRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/daily-log/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.dailyLogService.getOverview(companyId);
  });

  app.patch<{ Params: { entryId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/daily-log/entries/:entryId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });
      const input = UpdateDailyLogEntryRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.dailyLogService.updateEntry({
        companyId,
        entryId: request.params.entryId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
