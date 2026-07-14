import {
  AddTreasuryPaymentRunInvoiceRequestSchema,
  CreateTreasuryPaymentRunRequestSchema,
  MoveTreasuryPaymentRunInvoiceRequestSchema,
  RemoveTreasuryPaymentRunInvoiceRequestSchema,
  UpdateTreasuryPaymentRunRequestSchema
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

export async function registerTreasuryPaymentRunsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/treasury/payment-runs/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["finance:*", "finance:read"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.treasuryPaymentRunsService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/treasury/payment-runs", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["finance:*"],
      companyId: request.query.companyId
    });
    const input = CreateTreasuryPaymentRunRequestSchema.parse(request.body);
    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.treasuryPaymentRunsService.createRun({
      companyId,
      bankAccountLabel: input.bankAccountLabel,
      scheduledDate: input.scheduledDate,
      owner: input.owner,
      nextAction: input.nextAction,
      invoiceIds: input.invoiceIds
    });
  });

  app.patch<{ Params: { paymentRunId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/treasury/payment-runs/:paymentRunId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["finance:*"],
        companyId: request.query.companyId
      });
      const input = UpdateTreasuryPaymentRunRequestSchema.parse(request.body);
      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.treasuryPaymentRunsService.updateRun({
        companyId,
        paymentRunId: request.params.paymentRunId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );

  app.delete<{ Params: { paymentRunId: string; invoiceId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/treasury/payment-runs/:paymentRunId/invoices/:invoiceId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["finance:*"],
        companyId: request.query.companyId
      });
      const input = RemoveTreasuryPaymentRunInvoiceRequestSchema.parse(request.body);
      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.treasuryPaymentRunsService.removeInvoice({
        companyId,
        paymentRunId: request.params.paymentRunId,
        invoiceId: request.params.invoiceId,
        nextAction: input.nextAction
      });
    }
  );

  app.post<{ Params: { paymentRunId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/treasury/payment-runs/:paymentRunId/invoices",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["finance:*"],
        companyId: request.query.companyId
      });
      const input = AddTreasuryPaymentRunInvoiceRequestSchema.parse(request.body);
      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.treasuryPaymentRunsService.addInvoice({
        companyId,
        paymentRunId: request.params.paymentRunId,
        invoiceId: input.invoiceId,
        nextAction: input.nextAction
      });
    }
  );

  app.post<{ Params: { paymentRunId: string; invoiceId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/treasury/payment-runs/:paymentRunId/invoices/:invoiceId/move",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["finance:*"],
        companyId: request.query.companyId
      });
      const input = MoveTreasuryPaymentRunInvoiceRequestSchema.parse(request.body);
      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.treasuryPaymentRunsService.moveInvoice({
        companyId,
        sourcePaymentRunId: request.params.paymentRunId,
        targetPaymentRunId: input.targetPaymentRunId,
        invoiceId: request.params.invoiceId,
        nextAction: input.nextAction
      });
    }
  );
}
