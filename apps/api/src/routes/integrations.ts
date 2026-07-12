import type { FastifyInstance } from "fastify";
import { UpdateIntegrationStreamRequestSchema } from "@arcont/contracts";
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

export async function registerIntegrationRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/integrations/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["integrations:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.integrationService.getOverview(companyId);
  });

  app.patch<{ Params: { streamId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/integrations/streams/:streamId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["integrations:*"],
        companyId: request.query.companyId
      });
      const input = UpdateIntegrationStreamRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.integrationService.updateStream({
        companyId,
        streamId: request.params.streamId,
        health: input.health,
        nextAction: input.nextAction
      });
    }
  );
}
