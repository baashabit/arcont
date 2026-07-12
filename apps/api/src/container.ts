import { env } from "./config/env.js";
import { getPostgresPool } from "./db/postgres.js";
import {
  createInMemoryPlatformRepository,
  createPostgresPlatformRepository
} from "./repositories/platform-repository.js";
import { createAuthService } from "./services/auth-service.js";
import { createCrmService } from "./services/crm-service.js";
import { createCostControlService } from "./services/cost-control-service.js";
import { createComplianceService } from "./services/compliance-service.js";
import { createDocumentControlService } from "./services/document-control-service.js";
import { createEstimationCollectionService } from "./services/estimation-collection-service.js";
import { createFinanceService } from "./services/finance-service.js";
import { createHrService } from "./services/hr-service.js";
import { createIntegrationService } from "./services/integration-service.js";
import { createInventoryService } from "./services/inventory-service.js";
import { createProcurementService } from "./services/procurement-service.js";
import { createProjectsService } from "./services/projects-service.js";
import { createQualityService } from "./services/quality-service.js";
import { createPlatformService } from "./services/platform-service.js";

export function createContainer() {
  const platformRepository =
    env.ARCONT_DATA_DRIVER === "postgres"
      ? createPostgresPlatformRepository(getPostgresPool())
      : createInMemoryPlatformRepository();
  const platformService = createPlatformService(platformRepository);
  const authService = createAuthService(platformRepository);
  const projectsService = createProjectsService(platformRepository);
  const procurementService = createProcurementService(platformRepository);
  const inventoryService = createInventoryService(platformRepository);
  const financeService = createFinanceService(platformRepository);
  const estimationCollectionService = createEstimationCollectionService(platformRepository);
  const costControlService = createCostControlService(platformRepository, procurementService);
  const crmService = createCrmService(platformRepository);
  const complianceService = createComplianceService(platformRepository);
  const documentControlService = createDocumentControlService(platformRepository);
  const hrService = createHrService(platformRepository);
  const integrationService = createIntegrationService(platformRepository);
  const qualityService = createQualityService(platformRepository);

  return {
    platformRepository,
    platformService,
    authService,
    projectsService,
    procurementService,
    inventoryService,
    financeService,
    estimationCollectionService,
    costControlService,
    crmService,
    complianceService,
    documentControlService,
    hrService,
    integrationService,
    qualityService
  };
}
