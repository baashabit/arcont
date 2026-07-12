import { env } from "./config/env.js";
import { getPostgresPool } from "./db/postgres.js";
import {
  createInMemoryPlatformRepository,
  createPostgresPlatformRepository
} from "./repositories/platform-repository.js";
import { createAuthService } from "./services/auth-service.js";
import { createProjectsService } from "./services/projects-service.js";
import { createPlatformService } from "./services/platform-service.js";

export function createContainer() {
  const platformRepository =
    env.ARCONT_DATA_DRIVER === "postgres"
      ? createPostgresPlatformRepository(getPostgresPool())
      : createInMemoryPlatformRepository();
  const platformService = createPlatformService(platformRepository);
  const authService = createAuthService(platformRepository);
  const projectsService = createProjectsService(platformRepository);

  return {
    platformRepository,
    platformService,
    authService,
    projectsService
  };
}
