import {
  CreatePlatformUserRequestSchema,
  ProvisionCompanyRequestSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema,
  UpdatePlatformUserRoleRequestSchema,
  UpdatePlatformUserStatusRequestSchema
} from "../../../../packages/contracts/dist/index.js";
import type { FastifyInstance } from "fastify";
import { authError, forbiddenError } from "../lib/domain-error.js";

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

export async function registerPlatformRoutes(app: FastifyInstance) {
  app.get("/platform/companies", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken);

    return {
      items:
        session.role.scope === "platform"
          ? await app.container.platformService.listCompanies()
          : [session.company]
    };
  });

  app.get<{ Params: { companyId: string } }>("/platform/companies/:companyId", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    await app.container.authService.authorize(accessToken, {
      companyId: request.params.companyId
    });

    return app.container.platformService.getCompanyDetail(request.params.companyId);
  });

  app.get("/platform/modules", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    await app.container.authService.authorize(accessToken);

    return {
      items: await app.container.platformService.listModules()
    };
  });

  app.get<{ Querystring: { companyId?: string } }>("/platform/dashboard/summary", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId : session.company.id;

    return app.container.platformService.getDashboardSummary(companyId);
  });

  app.get<{ Params: { companyId: string } }>("/platform/companies/:companyId/modules", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    await app.container.authService.authorize(accessToken, {
      companyId: request.params.companyId
    });

    return {
      items: await app.container.platformService.listCompanyModules(request.params.companyId)
    };
  });

  app.put<{ Params: { companyId: string } }>("/platform/companies/:companyId/modules", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["modules:write", "modules:*", "company:*", "platform:*"],
      companyId: request.params.companyId
    });
    const input = UpdateCompanyModulesRequestSchema.parse(request.body);

    return {
      items: await app.container.platformService.replaceCompanyModules({
        companyId: request.params.companyId,
        enabledModules: input.enabledModules,
        actorUserId: session.user.id
      })
    };
  });

  app.get("/platform/roles", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["users:read", "users:write", "company:*", "platform:*"]
    });

    return {
      items: await app.container.platformService.listRoles()
    };
  });

  app.get<{ Querystring: { companyId?: string } }>("/platform/users", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["users:read", "users:*", "company:*", "platform:*"],
      companyId: request.query.companyId
    });

    return {
      items: await app.container.platformService.listUsers(
        session.role.scope === "platform" ? request.query.companyId : session.company.id
      )
    };
  });

  app.get<{ Params: { userId: string } }>("/platform/users/:userId", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["users:read", "users:*", "company:*", "platform:*"]
    });
    const detail = await app.container.platformService.getUserDetail(request.params.userId);

    if (session.role.scope !== "platform" && detail.company.id !== session.company.id) {
      throw forbiddenError("AUTH_COMPANY_SCOPE_FORBIDDEN", "Session cannot access the requested company");
    }

    return detail;
  });

  app.post("/platform/users", async (request, reply) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const input = CreatePlatformUserRequestSchema.parse(request.body);
    await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["users:write", "users:*", "company:*", "platform:*"],
      companyId: input.companyId
    });

    const result = await app.container.platformService.createUser(input);

    return reply.status(201).send(result);
  });

  app.patch<{ Params: { userId: string } }>("/platform/users/:userId/role", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const input = UpdatePlatformUserRoleRequestSchema.parse(request.body);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["users:write", "users:*", "company:*", "platform:*"]
    });
    const detail = await app.container.platformService.getUserDetail(request.params.userId);

    if (session.role.scope !== "platform" && detail.company.id !== session.company.id) {
      throw forbiddenError("AUTH_COMPANY_SCOPE_FORBIDDEN", "Session cannot access the requested company");
    }

    return app.container.platformService.updateUserRole({
      userId: request.params.userId,
      roleKey: input.roleKey
    });
  });

  app.patch<{ Params: { userId: string } }>("/platform/users/:userId/status", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const input = UpdatePlatformUserStatusRequestSchema.parse(request.body);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["users:write", "users:*", "company:*", "platform:*"]
    });
    const detail = await app.container.platformService.getUserDetail(request.params.userId);

    if (session.role.scope !== "platform" && detail.company.id !== session.company.id) {
      throw forbiddenError("AUTH_COMPANY_SCOPE_FORBIDDEN", "Session cannot access the requested company");
    }

    return app.container.platformService.updateUserStatus({
      userId: request.params.userId,
      status: input.status
    });
  });

  app.get<{ Params: { companyId: string } }>("/platform/settings/:companyId", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["settings:read", "settings:*", "company:*", "platform:*"],
      companyId: request.params.companyId
    });

    return app.container.platformService.getSettings(request.params.companyId);
  });

  app.put<{ Params: { companyId: string } }>("/platform/settings/:companyId", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["settings:write", "settings:*", "company:*", "platform:*"],
      companyId: request.params.companyId
    });
    const input = UpdatePlatformSettingsRequestSchema.parse(request.body);

    return app.container.platformService.updateSettings({
      companyId: request.params.companyId,
      ...input
    });
  });

  app.get<{ Params: { companyId: string }; Querystring: { userEmail?: string } }>(
    "/platform/bootstrap/:companyId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      await app.container.authService.authorize(accessToken, {
        companyId: request.params.companyId
      });

      return app.container.platformService.getPlatformBootstrap(
        request.params.companyId,
        request.query.userEmail
      );
    }
  );

  app.post("/platform/provision-company", async (request, reply) => {
    const accessToken = getBearerToken(request.headers.authorization);
    await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["companies:write", "companies:*", "platform:*"],
      platformOnly: true
    });
    const input = ProvisionCompanyRequestSchema.parse(request.body);
    const result = await app.container.platformService.provisionCompany(input);

    return reply.status(201).send(result);
  });

  app.get<{ Querystring: { companyId?: string; limit?: number } }>("/platform/audit-events", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      companyId: request.query.companyId
    });

    return {
      items: await app.container.platformService.listAuditEvents(
        session.role.scope === "platform" ? request.query.companyId : session.company.id,
        request.query.limit
      )
    };
  });
}
