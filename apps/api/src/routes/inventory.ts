import type { FastifyInstance } from "fastify";
import { UpdateInventoryLocationRequestSchema } from "@arcont/contracts";
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

export async function registerInventoryRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/inventory/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["inventory:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.inventoryService.getOverview(companyId);
  });

  app.patch<{ Params: { locationId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/inventory/locations/:locationId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["inventory:*"],
        companyId: request.query.companyId
      });
      const input = UpdateInventoryLocationRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.inventoryService.updateLocation({
        companyId,
        locationId: request.params.locationId,
        stockHealth: input.stockHealth,
        nextAction: input.nextAction
      });
    }
  );
}
