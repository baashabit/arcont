import {
  CreateAccountsPayableInvoiceRequestSchema,
  UpdateAccountsPayableInvoiceRequestSchema
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

export async function registerAccountsPayableRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/accounts-payable/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["finance:*", "finance:read"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.accountsPayableService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/accounts-payable/invoices", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["finance:*"],
      companyId: request.query.companyId
    });
    const input = CreateAccountsPayableInvoiceRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.accountsPayableService.createInvoice({
      companyId,
      supplierProfileId: input.supplierProfileId ?? null,
      supplierName: input.supplierName,
      invoiceNumber: input.invoiceNumber,
      invoiceUuid: input.invoiceUuid,
      projectName: input.projectName,
      purchaseOrderCode: input.purchaseOrderCode ?? null,
      receiptCode: input.receiptCode ?? null,
      status: input.status,
      satStatus: input.satStatus,
      complementStatus: input.complementStatus,
      receiptEvidenceStatus: input.receiptEvidenceStatus,
      paymentMethod: input.paymentMethod,
      dueDate: input.dueDate,
      scheduledPaymentDate: input.scheduledPaymentDate ?? null,
      subtotal: input.subtotal,
      tax: input.tax,
      total: input.total,
      packetCompletion: input.packetCompletion,
      nextAction: input.nextAction
    });
  });

  app.patch<{ Params: { invoiceId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/accounts-payable/invoices/:invoiceId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["finance:*"],
        companyId: request.query.companyId
      });
      const input = UpdateAccountsPayableInvoiceRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.accountsPayableService.updateInvoice({
        companyId,
        invoiceId: request.params.invoiceId,
        status: input.status,
        satStatus: input.satStatus,
        complementStatus: input.complementStatus,
        scheduledPaymentDate: input.scheduledPaymentDate,
        nextAction: input.nextAction
      });
    }
  );
}
