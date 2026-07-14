import {
  CreateProcurementPurchaseOrderRequestSchema,
  UpdateProcurementPurchaseOrderRequestSchema
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

export async function registerProcurementPurchaseOrdersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/procurement/purchase-orders/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.procurementPurchaseOrdersService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/procurement/purchase-orders", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });
    const input = CreateProcurementPurchaseOrderRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.procurementPurchaseOrdersService.createPurchaseOrder({
      companyId,
      requisitionId: input.requisitionId,
      supplierName: input.supplierName,
      buyer: input.buyer,
      totalAmount: input.totalAmount,
      committedEta: input.committedEta,
      logisticsMode: input.logisticsMode,
      nextAction: input.nextAction
    });
  });

  app.patch<{ Params: { purchaseOrderId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/procurement/purchase-orders/:purchaseOrderId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["procurement:*"],
        companyId: request.query.companyId
      });
      const input = UpdateProcurementPurchaseOrderRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.procurementPurchaseOrdersService.updatePurchaseOrder({
        companyId,
        purchaseOrderId: request.params.purchaseOrderId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
