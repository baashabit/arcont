import {
  CreateSupplierMasterProfileRequestSchema,
  UpdateSupplierMasterProfileRequestSchema
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

export async function registerSupplierMasterRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/supplier-master/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*", "finance:*", "finance:read"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.supplierMasterService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/supplier-master/profiles", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["procurement:*"],
      companyId: request.query.companyId
    });
    const input = CreateSupplierMasterProfileRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.supplierMasterService.createProfile({
      companyId,
      supplierName: input.supplierName,
      tradeName: input.tradeName,
      rfc: input.rfc,
      fiscalRegime: input.fiscalRegime,
      cfdiUse: input.cfdiUse,
      paymentMethod: input.paymentMethod,
      paymentTermsDays: input.paymentTermsDays,
      bankAccountMasked: input.bankAccountMasked,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      complianceStatus: input.complianceStatus,
      satStatus: input.satStatus,
      fiscalPacketCompletion: input.fiscalPacketCompletion,
      nextAction: input.nextAction
    });
  });

  app.patch<{ Params: { profileId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/supplier-master/profiles/:profileId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["procurement:*"],
        companyId: request.query.companyId
      });
      const input = UpdateSupplierMasterProfileRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.supplierMasterService.updateProfile({
        companyId,
        profileId: request.params.profileId,
        complianceStatus: input.complianceStatus,
        satStatus: input.satStatus,
        fiscalPacketCompletion: input.fiscalPacketCompletion,
        nextAction: input.nextAction
      });
    }
  );
}
