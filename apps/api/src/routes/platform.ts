import type { FastifyInstance } from "fastify";
import { getSettings, listCompanies, listModules, listRoles, listUsers } from "../platform/store.js";

export async function registerPlatformRoutes(app: FastifyInstance) {
  app.get("/platform/companies", async () => {
    return {
      items: listCompanies()
    };
  });

  app.get("/platform/modules", async () => {
    return {
      items: listModules()
    };
  });

  app.get("/platform/roles", async () => {
    return {
      items: listRoles()
    };
  });

  app.get<{ Querystring: { companyId?: string } }>("/platform/users", async (request) => {
    return {
      items: listUsers(request.query.companyId)
    };
  });

  app.get<{ Params: { companyId: string } }>("/platform/settings/:companyId", async (request, reply) => {
    const settings = getSettings(request.params.companyId);

    if (!settings) {
      return reply.status(404).send({
        message: "Settings not found"
      });
    }

    return settings;
  });
}
