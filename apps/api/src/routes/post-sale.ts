import { UpdatePostSaleCaseRequestSchema } from "@arcont/contracts";
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

export async function registerPostSaleRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/post-sale/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["compliance:*", "postsale:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.postSaleService.getOverview(companyId);
  });

  app.patch<{ Params: { caseId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/post-sale/cases/:caseId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["compliance:*", "postsale:*"],
        companyId: request.query.companyId
      });
      const input = UpdatePostSaleCaseRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.postSaleService.updateCase({
        companyId,
        caseId: request.params.caseId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
