import type { createContainer } from "../container.js";

declare module "fastify" {
  interface FastifyInstance {
    container: ReturnType<typeof createContainer>;
  }
}
