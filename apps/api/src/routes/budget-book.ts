import { UpdateBudgetBookLineRequestSchema } from "@arcont/contracts";
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

export async function registerBudgetBookRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/budget-book/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.budgetBookService.getOverview(companyId);
  });

  app.patch<{ Params: { lineId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/budget-book/lines/:lineId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["procurement:*"],
        companyId: request.query.companyId
      });
      const input = UpdateBudgetBookLineRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.budgetBookService.updateLine({
        companyId,
        lineId: request.params.lineId,
        procurementStatus: input.procurementStatus,
        nextAction: input.nextAction
      });
    }
  );
}
