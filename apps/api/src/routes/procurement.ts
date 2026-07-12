import type { FastifyInstance } from "fastify";
import { UpdateProcurementPackageRequestSchema } from "@arcont/contracts";
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

export async function registerProcurementRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/procurement/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.procurementService.getOverview(companyId);
  });

  app.patch<{ Params: { packageId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/procurement/packages/:packageId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["procurement:*"],
        companyId: request.query.companyId
      });
      const input = UpdateProcurementPackageRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.procurementService.updatePackage({
        companyId,
        packageId: request.params.packageId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
