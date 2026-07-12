import { UpdateCashFlowLineRequestSchema } from "@arcont/contracts";
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

export async function registerCashFlowRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/cash-flow/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["finance:*", "finance:read"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.cashFlowService.getOverview(companyId);
  });

  app.patch<{ Params: { lineId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/cash-flow/lines/:lineId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["finance:*", "finance:read"],
        companyId: request.query.companyId
      });
      const input = UpdateCashFlowLineRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.cashFlowService.updateLine({
        companyId,
        lineId: request.params.lineId,
        health: input.health,
        nextAction: input.nextAction
      });
    }
  );
}
