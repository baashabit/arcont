import type { FastifyInstance } from "fastify";
import { UpdateHrWorkforceItemRequestSchema } from "@arcont/contracts";
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

export async function registerHrRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/hr/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["hr:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.hrService.getOverview(companyId);
  });

  app.patch<{ Params: { workforceId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/hr/workforces/:workforceId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["hr:*"],
        companyId: request.query.companyId
      });
      const input = UpdateHrWorkforceItemRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.hrService.updateWorkforceItem({
        companyId,
        workforceId: request.params.workforceId,
        safetyStatus: input.safetyStatus,
        nextAction: input.nextAction
      });
    }
  );
}
