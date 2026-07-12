import type { FastifyInstance } from "fastify";
import { UpdateCrmLeadBucketRequestSchema } from "@arcont/contracts";
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

export async function registerCrmRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/crm/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["sales:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.crmService.getOverview(companyId);
  });

  app.patch<{ Params: { leadBucketId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/crm/lead-buckets/:leadBucketId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["sales:*"],
        companyId: request.query.companyId
      });
      const input = UpdateCrmLeadBucketRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.crmService.updateLeadBucket({
        companyId,
        leadBucketId: request.params.leadBucketId,
        health: input.health,
        signal: input.signal
      });
    }
  );
}
