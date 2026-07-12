import {
  AuthLoginRequestSchema,
  AuthLogoutRequestSchema,
  AuthRefreshRequestSchema
} from "../../../../packages/contracts/dist/index.js";
import type { FastifyInstance } from "fastify";
import { authError } from "../lib/domain-error.js";

function getBearerToken(authorization?: string) {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return undefined;
  }

  return token;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request) => {
    const credentials = AuthLoginRequestSchema.parse(request.body);
    const session = await app.container.authService.login(
      credentials.email,
      credentials.password,
      credentials.companyId
    );

    return session;
  });

  app.post("/auth/refresh", async (request) => {
    const input = AuthRefreshRequestSchema.parse(request.body);
    return app.container.authService.refresh(input.refreshToken);
  });

  app.get("/auth/me", async (request) => {
    const accessToken = getBearerToken(request.headers.authorization);
    if (!accessToken) {
      throw authError("AUTH_HEADER_MISSING", "Authorization header is required");
    }

    return app.container.authService.getCurrentSession(accessToken);
  });

  app.post("/auth/logout", async (request) => {
    const input = AuthLogoutRequestSchema.parse(request.body ?? {});
    const accessToken = getBearerToken(request.headers.authorization);

    return app.container.authService.logout(accessToken, input.refreshToken);
  });
}
