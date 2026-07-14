import { CreateInventoryReceiptRequestSchema, UpdateInventoryReceiptRequestSchema } from "@arcont/contracts";
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

export async function registerInventoryReceivingRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/inventory/receiving/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["inventory:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.inventoryReceivingService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/inventory/receipts", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["inventory:*"],
      companyId: request.query.companyId
    });
    const input = CreateInventoryReceiptRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.inventoryReceivingService.createReceipt({
      companyId,
      supplierName: input.supplierName,
      destinationName: input.destinationName,
      destinationType: input.destinationType,
      purchaseReference: input.purchaseReference,
      etaDate: input.etaDate,
      orderedUnits: input.orderedUnits,
      receivedUnits: input.receivedUnits,
      pendingEvidence: input.pendingEvidence,
      rejectedUnits: input.rejectedUnits,
      nextAction: input.nextAction
    });
  });

  app.patch<{ Params: { receiptId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/inventory/receipts/:receiptId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["inventory:*"],
        companyId: request.query.companyId
      });
      const input = UpdateInventoryReceiptRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.inventoryReceivingService.updateReceipt({
        companyId,
        receiptId: request.params.receiptId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
