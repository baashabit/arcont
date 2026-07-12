import { AuthLoginRequestSchema } from "../../../../packages/contracts/dist/index.js";
import type { FastifyInstance } from "fastify";

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const credentials = AuthLoginRequestSchema.parse(request.body);
    const session = await app.container.authService.login(
      credentials.email,
      credentials.password,
      credentials.companyId
    );

    if (!session) {
      return reply.status(401).send({
        message: "Invalid credentials"
      });
    }

    return session;
  });
}
