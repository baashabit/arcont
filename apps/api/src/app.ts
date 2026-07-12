import cors from "@fastify/cors";
import Fastify from "fastify";
import { createContainer } from "./container.js";
import { env } from "./config/env.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPlatformRoutes } from "./routes/platform.js";

export async function buildApp() {
  const app = Fastify({
    logger: true
  });
  const container = createContainer();

  app.decorate("container", container);

  await app.register(cors, {
    origin: env.ARCONT_API_ORIGIN
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPlatformRoutes(app);

  return app;
}
