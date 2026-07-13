import { env } from "./config/env.js";
import { getPostgresPool } from "./db/postgres.js";
import {
  createInMemoryPlatformRepository,
  createPostgresPlatformRepository
} from "./repositories/platform-repository.js";
import { createAuthService } from "./services/auth-service.js";
import { createBudgetBookService } from "./services/budget-book-service.js";
import { createCashFlowService } from "./services/cash-flow-service.js";
import { createCloseControlService } from "./services/close-control-service.js";
import { createCrmService } from "./services/crm-service.js";
import { createCostControlService } from "./services/cost-control-service.js";
import { createComplianceService } from "./services/compliance-service.js";
import { createDocumentControlService } from "./services/document-control-service.js";
import { createDailyLogService } from "./services/daily-log-service.js";
import { createEquipmentService } from "./services/equipment-service.js";
import { createEstimationCollectionService } from "./services/estimation-collection-service.js";
import { createFinanceService } from "./services/finance-service.js";
import { createHrService } from "./services/hr-service.js";
import { createIntegrationService } from "./services/integration-service.js";
import { createInventoryService } from "./services/inventory-service.js";
import { createInventoryMovementsService } from "./services/inventory-movements-service.js";
import { createInventoryReceivingService } from "./services/inventory-receiving-service.js";
import { createProcurementService } from "./services/procurement-service.js";
import { createProcurementRequisitionsService } from "./services/procurement-requisitions-service.js";
import { createProjectsService } from "./services/projects-service.js";
import { createQualityService } from "./services/quality-service.js";
import { createPlatformService } from "./services/platform-service.js";
import { createSubcontractsService } from "./services/subcontracts-service.js";
import { createPostSaleService } from "./services/post-sale-service.js";
import { createSupplierControlService } from "./services/supplier-control-service.js";

export function createContainer() {
  const platformRepository =
    env.ARCONT_DATA_DRIVER === "postgres"
      ? createPostgresPlatformRepository(getPostgresPool())
      : createInMemoryPlatformRepository();
  const platformService = createPlatformService(platformRepository);
  const authService = createAuthService(platformRepository);
  const projectsService = createProjectsService(platformRepository);
  const dailyLogService = createDailyLogService(platformRepository);
  const procurementService = createProcurementService(platformRepository);
  const procurementRequisitionsService = createProcurementRequisitionsService(platformRepository);
  const budgetBookService = createBudgetBookService(platformRepository);
  const cashFlowService = createCashFlowService(platformRepository);
  const closeControlService = createCloseControlService(platformRepository);
  const inventoryService = createInventoryService(platformRepository);
  const inventoryMovementsService = createInventoryMovementsService(platformRepository);
  const inventoryReceivingService = createInventoryReceivingService(platformRepository);
  const equipmentService = createEquipmentService(platformRepository);
  const financeService = createFinanceService(platformRepository);
  const estimationCollectionService = createEstimationCollectionService(platformRepository);
  const costControlService = createCostControlService(platformRepository, procurementService);
  const crmService = createCrmService(platformRepository);
  const complianceService = createComplianceService(platformRepository);
  const documentControlService = createDocumentControlService(platformRepository);
  const hrService = createHrService(platformRepository);
  const integrationService = createIntegrationService(platformRepository);
  const qualityService = createQualityService(platformRepository);
  const subcontractsService = createSubcontractsService(platformRepository);
  const postSaleService = createPostSaleService(platformRepository);
  const supplierControlService = createSupplierControlService(platformRepository);

  return {
    platformRepository,
    platformService,
    authService,
    projectsService,
    dailyLogService,
    procurementService,
    procurementRequisitionsService,
    budgetBookService,
    cashFlowService,
    closeControlService,
    inventoryService,
    inventoryMovementsService,
    inventoryReceivingService,
    equipmentService,
    financeService,
    estimationCollectionService,
    costControlService,
    crmService,
    complianceService,
    documentControlService,
    hrService,
    integrationService,
    qualityService,
    postSaleService,
    subcontractsService,
    supplierControlService
  };
}
