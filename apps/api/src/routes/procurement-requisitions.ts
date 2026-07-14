import {
  CreateProcurementRequisitionRequestSchema,
  UpdateProcurementRequisitionRequestSchema
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

export async function registerProcurementRequisitionsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/procurement/requisitions/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.procurementRequisitionsService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/procurement/requisitions", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });
    const input = CreateProcurementRequisitionRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.procurementRequisitionsService.createRequisition({
      companyId,
      projectName: input.projectName,
      frontName: input.frontName,
      requestedBy: input.requestedBy,
      category: input.category,
      status: input.status,
      requestedItems: input.requestedItems,
      budgetAmount: input.budgetAmount,
      urgency: input.urgency,
      approvalHours: input.approvalHours,
      supplierCoverage: input.supplierCoverage,
      nextAction: input.nextAction
    });
  });

  app.patch<{ Params: { requisitionId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/procurement/requisitions/:requisitionId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["procurement:*"],
        companyId: request.query.companyId
      });
      const input = UpdateProcurementRequisitionRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.procurementRequisitionsService.updateRequisition({
        companyId,
        requisitionId: request.params.requisitionId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
