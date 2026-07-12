import {
  ProvisionCompanyRequestSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema
} from "../../../../packages/contracts/dist/index.js";
import type { FastifyInstance } from "fastify";

export async function registerPlatformRoutes(app: FastifyInstance) {
  app.get("/platform/companies", async () => {
    return {
      items: await app.container.platformService.listCompanies()
    };
  });

  app.get<{ Params: { companyId: string } }>("/platform/companies/:companyId", async (request) => {
    return app.container.platformService.getCompanyDetail(request.params.companyId);
  });

  app.get("/platform/modules", async () => {
    return {
      items: await app.container.platformService.listModules()
    };
  });

  app.get<{ Querystring: { companyId?: string } }>("/platform/dashboard/summary", async (request) => {
    return app.container.platformService.getDashboardSummary(request.query.companyId);
  });

  app.get<{ Params: { companyId: string } }>("/platform/companies/:companyId/modules", async (request) => {
    return {
      items: await app.container.platformService.listCompanyModules(request.params.companyId)
    };
  });

  app.put<{ Params: { companyId: string } }>("/platform/companies/:companyId/modules", async (request) => {
    const input = UpdateCompanyModulesRequestSchema.parse(request.body);

    return {
      items: await app.container.platformService.replaceCompanyModules({
        companyId: request.params.companyId,
        enabledModules: input.enabledModules
      })
    };
  });

  app.get("/platform/roles", async () => {
    return {
      items: await app.container.platformService.listRoles()
    };
  });

  app.get<{ Querystring: { companyId?: string } }>("/platform/users", async (request) => {
    return {
      items: await app.container.platformService.listUsers(request.query.companyId)
    };
  });

  app.get<{ Params: { companyId: string } }>("/platform/settings/:companyId", async (request, reply) => {
    return app.container.platformService.getSettings(request.params.companyId);
  });

  app.put<{ Params: { companyId: string } }>("/platform/settings/:companyId", async (request) => {
    const input = UpdatePlatformSettingsRequestSchema.parse(request.body);

    return app.container.platformService.updateSettings({
      companyId: request.params.companyId,
      ...input
    });
  });

  app.get<{ Params: { companyId: string }; Querystring: { userEmail?: string } }>(
    "/platform/bootstrap/:companyId",
    async (request) => {
      return app.container.platformService.getPlatformBootstrap(
        request.params.companyId,
        request.query.userEmail
      );
    }
  );

  app.post("/platform/provision-company", async (request, reply) => {
    const input = ProvisionCompanyRequestSchema.parse(request.body);
    const result = await app.container.platformService.provisionCompany(input);

    return reply.status(201).send(result);
  });

  app.get<{ Querystring: { companyId?: string; limit?: number } }>("/platform/audit-events", async (request) => {
    return {
      items: await app.container.platformService.listAuditEvents(
        request.query.companyId,
        request.query.limit
      )
    };
  });
}
