import { UpdateEstimationCollectionLineRequestSchema } from "@arcont/contracts";
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

export async function registerEstimationsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/estimations/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["finance:*", "finance:read"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.estimationCollectionService.getOverview(companyId);
  });

  app.patch<{ Params: { lineId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/estimations/lines/:lineId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["finance:*"],
        companyId: request.query.companyId
      });
      const input = UpdateEstimationCollectionLineRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.estimationCollectionService.updateLine({
        companyId,
        lineId: request.params.lineId,
        collectionHealth: input.collectionHealth,
        nextAction: input.nextAction
      });
    }
  );
}
