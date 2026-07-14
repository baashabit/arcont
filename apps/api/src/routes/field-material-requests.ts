import {
  CreateFieldMaterialRequestRequestSchema
} from "@arcont/contracts";
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

export async function registerFieldMaterialRequestsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/field/material-requests/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.fieldMaterialRequestsService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/field/material-requests", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });
    const input = CreateFieldMaterialRequestRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.fieldMaterialRequestsService.createMaterialRequest({
      companyId,
      projectName: input.projectName,
      frontName: input.frontName,
      requestedBy: input.requestedBy,
      summary: input.summary,
      detail: input.detail,
      requestedVolume: input.requestedVolume,
      category: input.category,
      requestedItems: input.requestedItems,
      budgetAmount: input.budgetAmount,
      approvalHours: input.approvalHours,
      supplierCoverage: input.supplierCoverage,
      urgency: input.urgency,
      nextAction: input.nextAction
    });
  });
}
