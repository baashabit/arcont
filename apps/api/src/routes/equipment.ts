import { CreateMachineItemRequestSchema, UpdateMachineItemRequestSchema } from "@arcont/contracts";
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

export async function registerEquipmentRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/equipment/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["inventory:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.equipmentService.getOverview(companyId);
  });

  app.post<{ Body: unknown; Querystring: { companyId?: string } }>("/equipment/machines", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["inventory:*"],
      companyId: request.query.companyId
    });
    const input = CreateMachineItemRequestSchema.parse(request.body);

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.equipmentService.createMachine({
      companyId,
      machineName: input.machineName,
      machineType: input.machineType,
      projectName: input.projectName,
      frontName: input.frontName,
      status: input.status,
      health: input.health,
      availabilityPercent: input.availabilityPercent,
      utilizationPercent: input.utilizationPercent,
      hourMeter: input.hourMeter,
      nextMaintenanceHours: input.nextMaintenanceHours,
      maintenanceBacklog: input.maintenanceBacklog,
      openFailures: input.openFailures,
      criticalOpenFailures: input.criticalOpenFailures,
      nextAction: input.nextAction
    });
  });

  app.patch<{ Params: { machineId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/equipment/machines/:machineId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["inventory:*"],
        companyId: request.query.companyId
      });
      const input = UpdateMachineItemRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.equipmentService.updateMachine({
        companyId,
        machineId: request.params.machineId,
        status: input.status,
        health: input.health,
        nextAction: input.nextAction
      });
    }
  );
}
