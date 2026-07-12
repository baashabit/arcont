import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";
import { createContainer } from "./container.js";
import { env } from "./config/env.js";
import { DomainError } from "./lib/domain-error.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerComplianceRoutes } from "./routes/compliance.js";
import { registerCrmRoutes } from "./routes/crm.js";
import { registerDocumentControlRoutes } from "./routes/document-control.js";
import { registerFinanceRoutes } from "./routes/finance.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerHrRoutes } from "./routes/hr.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerInventoryRoutes } from "./routes/inventory.js";
import { registerPlatformRoutes } from "./routes/platform.js";
import { registerProcurementRoutes } from "./routes/procurement.js";
import { registerProjectsRoutes } from "./routes/projects.js";
import { registerQualityRoutes } from "./routes/quality.js";

export async function buildApp() {
  const app = Fastify({
    logger: true
  });
  const container = createContainer();

  app.decorate("container", container);

  await app.register(cors, {
    origin: env.ARCONT_API_ORIGIN
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null
        }
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: "REQUEST_VALIDATION_FAILED",
          message: "Request validation failed",
          details: error.issues
        }
      });
    }

    app.log.error(error);

    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
        details: null
      }
    });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPlatformRoutes(app);
  await registerProjectsRoutes(app);
  await registerProcurementRoutes(app);
  await registerInventoryRoutes(app);
  await registerFinanceRoutes(app);
  await registerCrmRoutes(app);
  await registerComplianceRoutes(app);
  await registerDocumentControlRoutes(app);
  await registerHrRoutes(app);
  await registerIntegrationRoutes(app);
  await registerQualityRoutes(app);

  return app;
}
