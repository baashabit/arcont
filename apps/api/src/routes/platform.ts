import * as contracts from "../../../../packages/contracts/dist/index.js";
import type { FastifyInstance } from "fastify";

export async function registerPlatformRoutes(app: FastifyInstance) {
  app.get("/platform/companies", async () => {
    return {
      items: await app.container.platformService.listCompanies()
    };
  });

  app.get("/platform/modules", async () => {
    return {
      items: await app.container.platformService.listModules()
    };
  });

  app.get<{ Params: { companyId: string } }>("/platform/companies/:companyId/modules", async (request) => {
    return {
      items: await app.container.platformService.listCompanyModules(request.params.companyId)
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
    const settings = await app.container.platformService.getSettings(request.params.companyId);

    if (!settings) {
      return reply.status(404).send({
        message: "Settings not found"
      });
    }

    return settings;
  });

  app.get<{ Params: { companyId: string }; Querystring: { userEmail?: string } }>(
    "/platform/bootstrap/:companyId",
    async (request, reply) => {
      const bootstrap = await app.container.platformService.getPlatformBootstrap(
        request.params.companyId,
        request.query.userEmail
      );

      if (!bootstrap) {
        return reply.status(404).send({
          message: "Platform bootstrap not found"
        });
      }

      return bootstrap;
    }
  );

  app.post("/platform/provision-company", async (request, reply) => {
    const input = contracts.ProvisionCompanyRequestSchema.parse(request.body);
    const result = await app.container.platformService.provisionCompany(input);

    return reply.status(201).send(result);
  });
}
