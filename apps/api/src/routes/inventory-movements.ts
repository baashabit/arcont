import { UpdateInventoryMovementRequestSchema } from "@arcont/contracts";
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

export async function registerInventoryMovementsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/inventory/movements/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["inventory:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.inventoryMovementsService.getOverview(companyId);
  });

  app.patch<{ Params: { movementId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/inventory/movements/:movementId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["inventory:*"],
        companyId: request.query.companyId
      });
      const input = UpdateInventoryMovementRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.inventoryMovementsService.updateMovement({
        companyId,
        movementId: request.params.movementId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
