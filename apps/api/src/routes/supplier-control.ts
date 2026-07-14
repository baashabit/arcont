import {
  CreateSupplierControlLineRequestSchema,
  UpdateSupplierControlLineRequestSchema
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

export async function registerSupplierControlRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/supplier-control/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.supplierControlService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/supplier-control/lines", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });
    const input = CreateSupplierControlLineRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.supplierControlService.createLine({
      companyId,
      supplierName: input.supplierName,
      owner: input.owner,
      awardedPackages: input.awardedPackages,
      activePackages: input.activePackages,
      contractedAmount: input.contractedAmount,
      concentrationPercent: input.concentrationPercent,
      bidCoverage: input.bidCoverage,
      deliveryHealth: input.deliveryHealth,
      approvalPressureHours: input.approvalPressureHours,
      complianceAlerts: input.complianceAlerts,
      nextAction: input.nextAction
    });
  });

  app.patch<{ Params: { lineId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/supplier-control/lines/:lineId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["procurement:*"],
        companyId: request.query.companyId
      });
      const input = UpdateSupplierControlLineRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.supplierControlService.updateLine({
        companyId,
        lineId: request.params.lineId,
        deliveryHealth: input.deliveryHealth,
        nextAction: input.nextAction
      });
    }
  );
}
