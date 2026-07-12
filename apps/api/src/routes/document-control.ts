import type { FastifyInstance } from "fastify";
import { UpdateDocumentControlItemRequestSchema } from "@arcont/contracts";
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

export async function registerDocumentControlRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { companyId?: string } }>("/document-control/overview", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    const session = await app.container.authService.authorize(accessToken, {
      requiredPermissions: ["projects:*"],
      companyId: request.query.companyId
    });

    const companyId =
      session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

    return app.container.documentControlService.getOverview(companyId);
  });

  app.patch<{ Params: { itemId: string }; Body: unknown; Querystring: { companyId?: string } }>(
    "/document-control/items/:itemId",
    async (request) => {
      const accessToken = getBearerToken(request.headers.authorization);
      const session = await app.container.authService.authorize(accessToken, {
        requiredPermissions: ["projects:*"],
        companyId: request.query.companyId
      });
      const input = UpdateDocumentControlItemRequestSchema.parse(request.body);

      const companyId =
        session.role.scope === "platform" ? request.query.companyId ?? session.company.id : session.company.id;

      return app.container.documentControlService.updateItem({
        companyId,
        itemId: request.params.itemId,
        status: input.status,
        nextAction: input.nextAction
      });
    }
  );
}
