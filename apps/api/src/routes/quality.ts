import type { FastifyInstance } from "fastify";
import { CreateQualityInspectionRequestSchema, UpdateQualityInspectionRequestSchema } from "@arcont/contracts";
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

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/quality/inspections", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });
    const input = CreateQualityInspectionRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.qualityService.createInspection({
      companyId,
      areaName: input.areaName,
      checklistName: input.checklistName,
      contractorName: input.contractorName,
      severity: input.severity,
      openFindings: input.openFindings,
      evidenceCompletion: input.evidenceCompletion,
      releaseReadiness: input.releaseReadiness,
      reworkRate: input.reworkRate,
      status: input.status,
      nextAction: input.nextAction
    });
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
