import type { FastifyInstance } from "fastify";
import { UpdateQualityInspectionRequestSchema } from "@arcont/contracts";
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

export async function registerQualityRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/quality/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.qualityService.getOverview(companyId);
  });

  app.patch<{ Params: { inspectionId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/quality/inspections/:inspectionId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });
      const input = UpdateQualityInspectionRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.qualityService.updateInspection({
        companyId,
        inspectionId: request.params.inspectionId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
