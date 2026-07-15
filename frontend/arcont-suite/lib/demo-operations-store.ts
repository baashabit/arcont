import type {
  AccountsPayableInvoiceContract,
  AccountsPayableOverviewContract,
  AccountsPayableRiskContract,
  BudgetBookLineContract,
  BudgetBookOverviewContract,
  BudgetBookRiskContract,
  CashFlowLineContract,
  CashFlowOverviewContract,
  CashFlowRiskContract,
  CloseControlLineContract,
  CloseControlOverviewContract,
  CloseControlRiskContract,
  ComplianceCaseContract,
  ComplianceOverviewContract,
  ComplianceRiskContract,
  CostControlExceptionContract,
  CostControlLineContract,
  CostControlOverviewContract,
  CrmLeadBucketContract,
  CrmOverviewContract,
  CrmRiskContract,
  FinanceLedgerItemContract,
  FinanceOverviewContract,
  FinanceRiskContract,
  HrOverviewContract,
  HrRiskContract,
  HrWorkforceItemContract,
  CreateAccountsPayableInvoiceRequestContract,
  CreateSubcontractLineRequestContract,
  CreateTreasuryPaymentRunRequestContract,
  CreateProjectPortfolioItemRequestContract,
  CreateProjectScheduleActivityRequestContract,
  ImportProjectScheduleActivitiesRequestContract,
  ImportProjectScheduleActivitiesResponseContract,
  CreateMachineItemRequestContract,
  CreateDailyLogEntryRequestContract,
  CreateFieldMaterialRequestRequestContract,
  CreateFieldMaterialRequestResponseContract,
  CreateInventoryMovementRequestContract,
  CreateInventoryReceiptRequestContract,
  CreateProcurementPurchaseOrderRequestContract,
  CreateProcurementRequisitionRequestContract,
  DailyLogEntryContract,
  DailyLogOverviewContract,
  DailyLogRiskContract,
  CreateDocumentControlItemRequestContract,
  DocumentControlItemContract,
  DocumentControlOverviewContract,
  DocumentControlRiskContract,
  EquipmentOverviewContract,
  EstimationCollectionExceptionContract,
  EstimationCollectionLineContract,
  EstimationCollectionOverviewContract,
  CreateSupplierControlLineRequestContract,
  CreateSupplierMasterProfileRequestContract,
  FieldMaterialRequestContract,
  FieldMaterialRequestOverviewContract,
  InventoryMovementContract,
  InventoryMovementRiskContract,
  InventoryMovementsOverviewContract,
  InventoryReceiptContract,
  InventoryReceiptRiskContract,
  InventoryReceivingOverviewContract,
  MachineItemContract,
  MachineRiskContract,
  CreateQualityInspectionRequestContract,
  ProcurementRequisitionContract,
  ProcurementRequisitionRiskContract,
  ProcurementRequisitionsOverviewContract,
  ProcurementOverviewContract,
  ProcurementPackageContract,
  ProcurementPurchaseOrderContract,
  ProcurementPurchaseOrderRiskContract,
  ProcurementPurchaseOrdersOverviewContract,
  ProcurementRiskContract,
  PostSaleCaseContract,
  PostSaleOverviewContract,
  PostSaleRiskContract,
  ProjectPortfolioItemContract,
  ProjectPortfolioOverviewContract,
  ProjectRiskContract,
  ProjectScheduleActivityContract,
  ProjectScheduleOverviewContract,
  QualityInspectionContract,
  QualityOverviewContract,
  QualityRiskContract,
  SubcontractLineContract,
  SubcontractOverviewContract,
  SubcontractRiskContract,
  SupplierControlLineContract,
  SupplierControlOverviewContract,
  SupplierControlRiskContract,
  SupplierMasterOverviewContract,
  SupplierMasterProfileContract,
  SupplierMasterRiskContract,
  TreasuryPaymentRunContract,
  TreasuryPaymentRunInvoiceContract,
  TreasuryPaymentRunRiskContract,
  TreasuryPaymentRunsOverviewContract,
  UpdateMachineItemRequestContract,
  UpdateAccountsPayableInvoiceRequestContract,
  UpdateBudgetBookLineRequestContract,
  UpdateCashFlowLineRequestContract,
  UpdateCloseControlLineRequestContract,
  UpdateComplianceCaseRequestContract,
  UpdateCostControlLineRequestContract,
  UpdateCrmLeadBucketRequestContract,
  UpdateEstimationCollectionLineRequestContract,
  UpdateFinanceLedgerItemRequestContract,
  UpdateHrWorkforceItemRequestContract,
  UpdatePostSaleCaseRequestContract,
  UpdateTreasuryPaymentRunRequestContract,
  UpdateDailyLogEntryRequestContract,
  UpdateDocumentControlItemRequestContract,
  UpdateInventoryMovementRequestContract,
  UpdateInventoryReceiptRequestContract,
  UpdateProcurementPackageRequestContract,
  UpdateProcurementPurchaseOrderRequestContract,
  UpdateProcurementRequisitionRequestContract,
  UpdateQualityInspectionRequestContract,
  UpdateSupplierControlLineRequestContract,
  UpdateSupplierMasterProfileRequestContract,
  UpdateSubcontractLineRequestContract,
  UpdateProjectPortfolioItemRequestContract,
  UpdateProjectScheduleActivityRequestContract
} from "@/lib/contracts";

const projectStoragePrefix = "arcont.demo.projects";
const projectRiskStoragePrefix = "arcont.demo.project-risks";
const projectScheduleStoragePrefix = "arcont.demo.project-schedules";
const equipmentStoragePrefix = "arcont.demo.equipment";
const equipmentRiskStoragePrefix = "arcont.demo.equipment-risks";
const dailyLogStoragePrefix = "arcont.demo.daily-logs";
const dailyLogRiskStoragePrefix = "arcont.demo.daily-log-risks";
const procurementStoragePrefix = "arcont.demo.procurement";
const procurementRiskStoragePrefix = "arcont.demo.procurement-risks";
const documentControlStoragePrefix = "arcont.demo.document-control";
const documentControlRiskStoragePrefix = "arcont.demo.document-control-risks";
const qualityStoragePrefix = "arcont.demo.quality";
const qualityRiskStoragePrefix = "arcont.demo.quality-risks";
const hrStoragePrefix = "arcont.demo.hr-workforces";
const hrRiskStoragePrefix = "arcont.demo.hr-risks";
const subcontractStoragePrefix = "arcont.demo.subcontracts";
const subcontractRiskStoragePrefix = "arcont.demo.subcontract-risks";
const supplierControlStoragePrefix = "arcont.demo.supplier-control";
const supplierControlRiskStoragePrefix = "arcont.demo.supplier-control-risks";
const supplierMasterStoragePrefix = "arcont.demo.supplier-master";
const supplierMasterRiskStoragePrefix = "arcont.demo.supplier-master-risks";
const procurementPurchaseOrderStoragePrefix = "arcont.demo.procurement-purchase-orders";
const procurementPurchaseOrderRiskStoragePrefix = "arcont.demo.procurement-purchase-order-risks";
const fieldMaterialRequestStoragePrefix = "arcont.demo.field-material-requests";
const procurementRequisitionStoragePrefix = "arcont.demo.procurement-requisitions";
const procurementRequisitionRiskStoragePrefix = "arcont.demo.procurement-requisition-risks";
const procurementRequisitionOriginStoragePrefix = "arcont.demo.procurement-requisition-origins";
const inventoryMovementStoragePrefix = "arcont.demo.inventory-movements";
const inventoryMovementRiskStoragePrefix = "arcont.demo.inventory-movement-risks";
const inventoryReceiptStoragePrefix = "arcont.demo.inventory-receipts";
const inventoryReceiptRiskStoragePrefix = "arcont.demo.inventory-receipt-risks";
const accountsPayableStoragePrefix = "arcont.demo.accounts-payable";
const accountsPayableRiskStoragePrefix = "arcont.demo.accounts-payable-risks";
const treasuryPaymentRunStoragePrefix = "arcont.demo.treasury-payment-runs";
const treasuryPaymentRunRiskStoragePrefix = "arcont.demo.treasury-payment-run-risks";
const cashFlowStoragePrefix = "arcont.demo.cash-flow";
const cashFlowRiskStoragePrefix = "arcont.demo.cash-flow-risks";
const closeControlStoragePrefix = "arcont.demo.close-control";
const closeControlRiskStoragePrefix = "arcont.demo.close-control-risks";
const financeStoragePrefix = "arcont.demo.finance";
const financeRiskStoragePrefix = "arcont.demo.finance-risks";
const budgetBookStoragePrefix = "arcont.demo.budget-book";
const budgetBookRiskStoragePrefix = "arcont.demo.budget-book-risks";
const estimationStoragePrefix = "arcont.demo.estimations";
const estimationExceptionStoragePrefix = "arcont.demo.estimation-exceptions";
const costControlStoragePrefix = "arcont.demo.cost-control";
const costControlExceptionStoragePrefix = "arcont.demo.cost-control-exceptions";
const complianceStoragePrefix = "arcont.demo.compliance";
const complianceRiskStoragePrefix = "arcont.demo.compliance-risks";
const crmStoragePrefix = "arcont.demo.crm";
const crmRiskStoragePrefix = "arcont.demo.crm-risks";
const postSaleStoragePrefix = "arcont.demo.post-sale";
const postSaleRiskStoragePrefix = "arcont.demo.post-sale-risks";

function getProjectStorageKey(companyId: string) {
  return `${projectStoragePrefix}.${companyId}`;
}

function getProjectRiskStorageKey(companyId: string) {
  return `${projectRiskStoragePrefix}.${companyId}`;
}

function getProjectScheduleStorageKey(companyId: string, projectId: string) {
  return `${projectScheduleStoragePrefix}.${companyId}.${projectId}`;
}

function getEquipmentStorageKey(companyId: string) {
  return `${equipmentStoragePrefix}.${companyId}`;
}

function getEquipmentRiskStorageKey(companyId: string) {
  return `${equipmentRiskStoragePrefix}.${companyId}`;
}

function getDailyLogStorageKey(companyId: string) {
  return `${dailyLogStoragePrefix}.${companyId}`;
}

function getDailyLogRiskStorageKey(companyId: string) {
  return `${dailyLogRiskStoragePrefix}.${companyId}`;
}

function getProcurementStorageKey(companyId: string) {
  return `${procurementStoragePrefix}.${companyId}`;
}

function getProcurementRiskStorageKey(companyId: string) {
  return `${procurementRiskStoragePrefix}.${companyId}`;
}

function getDocumentControlStorageKey(companyId: string) {
  return `${documentControlStoragePrefix}.${companyId}`;
}

function getDocumentControlRiskStorageKey(companyId: string) {
  return `${documentControlRiskStoragePrefix}.${companyId}`;
}

function getQualityStorageKey(companyId: string) {
  return `${qualityStoragePrefix}.${companyId}`;
}

function getQualityRiskStorageKey(companyId: string) {
  return `${qualityRiskStoragePrefix}.${companyId}`;
}

function getHrStorageKey(companyId: string) {
  return `${hrStoragePrefix}.${companyId}`;
}

function getHrRiskStorageKey(companyId: string) {
  return `${hrRiskStoragePrefix}.${companyId}`;
}

function getSubcontractStorageKey(companyId: string) {
  return `${subcontractStoragePrefix}.${companyId}`;
}

function getSubcontractRiskStorageKey(companyId: string) {
  return `${subcontractRiskStoragePrefix}.${companyId}`;
}

function getSupplierControlStorageKey(companyId: string) {
  return `${supplierControlStoragePrefix}.${companyId}`;
}

function getSupplierControlRiskStorageKey(companyId: string) {
  return `${supplierControlRiskStoragePrefix}.${companyId}`;
}

function getSupplierMasterStorageKey(companyId: string) {
  return `${supplierMasterStoragePrefix}.${companyId}`;
}

function getSupplierMasterRiskStorageKey(companyId: string) {
  return `${supplierMasterRiskStoragePrefix}.${companyId}`;
}

function getProcurementPurchaseOrderStorageKey(companyId: string) {
  return `${procurementPurchaseOrderStoragePrefix}.${companyId}`;
}

function getProcurementPurchaseOrderRiskStorageKey(companyId: string) {
  return `${procurementPurchaseOrderRiskStoragePrefix}.${companyId}`;
}

function getFieldMaterialRequestStorageKey(companyId: string) {
  return `${fieldMaterialRequestStoragePrefix}.${companyId}`;
}

function getProcurementRequisitionStorageKey(companyId: string) {
  return `${procurementRequisitionStoragePrefix}.${companyId}`;
}

function getProcurementRequisitionRiskStorageKey(companyId: string) {
  return `${procurementRequisitionRiskStoragePrefix}.${companyId}`;
}

function getProcurementRequisitionOriginStorageKey(companyId: string) {
  return `${procurementRequisitionOriginStoragePrefix}.${companyId}`;
}

function getInventoryReceiptStorageKey(companyId: string) {
  return `${inventoryReceiptStoragePrefix}.${companyId}`;
}

function getInventoryReceiptRiskStorageKey(companyId: string) {
  return `${inventoryReceiptRiskStoragePrefix}.${companyId}`;
}

function getInventoryMovementStorageKey(companyId: string) {
  return `${inventoryMovementStoragePrefix}.${companyId}`;
}

function getInventoryMovementRiskStorageKey(companyId: string) {
  return `${inventoryMovementRiskStoragePrefix}.${companyId}`;
}

function getAccountsPayableStorageKey(companyId: string) {
  return `${accountsPayableStoragePrefix}.${companyId}`;
}

function getAccountsPayableRiskStorageKey(companyId: string) {
  return `${accountsPayableRiskStoragePrefix}.${companyId}`;
}

function getTreasuryPaymentRunStorageKey(companyId: string) {
  return `${treasuryPaymentRunStoragePrefix}.${companyId}`;
}

function getTreasuryPaymentRunRiskStorageKey(companyId: string) {
  return `${treasuryPaymentRunRiskStoragePrefix}.${companyId}`;
}

function getCashFlowStorageKey(companyId: string) {
  return `${cashFlowStoragePrefix}.${companyId}`;
}

function getCashFlowRiskStorageKey(companyId: string) {
  return `${cashFlowRiskStoragePrefix}.${companyId}`;
}

function getCloseControlStorageKey(companyId: string) {
  return `${closeControlStoragePrefix}.${companyId}`;
}

function getCloseControlRiskStorageKey(companyId: string) {
  return `${closeControlRiskStoragePrefix}.${companyId}`;
}

function getFinanceStorageKey(companyId: string) {
  return `${financeStoragePrefix}.${companyId}`;
}

function getFinanceRiskStorageKey(companyId: string) {
  return `${financeRiskStoragePrefix}.${companyId}`;
}

function getBudgetBookStorageKey(companyId: string) {
  return `${budgetBookStoragePrefix}.${companyId}`;
}

function getBudgetBookRiskStorageKey(companyId: string) {
  return `${budgetBookRiskStoragePrefix}.${companyId}`;
}

function getEstimationStorageKey(companyId: string) {
  return `${estimationStoragePrefix}.${companyId}`;
}

function getEstimationExceptionStorageKey(companyId: string) {
  return `${estimationExceptionStoragePrefix}.${companyId}`;
}

function getCostControlStorageKey(companyId: string) {
  return `${costControlStoragePrefix}.${companyId}`;
}

function getCostControlExceptionStorageKey(companyId: string) {
  return `${costControlExceptionStoragePrefix}.${companyId}`;
}

function getComplianceStorageKey(companyId: string) {
  return `${complianceStoragePrefix}.${companyId}`;
}

function getComplianceRiskStorageKey(companyId: string) {
  return `${complianceRiskStoragePrefix}.${companyId}`;
}

function getCrmStorageKey(companyId: string) {
  return `${crmStoragePrefix}.${companyId}`;
}

function getCrmRiskStorageKey(companyId: string) {
  return `${crmRiskStoragePrefix}.${companyId}`;
}

function getPostSaleStorageKey(companyId: string) {
  return `${postSaleStoragePrefix}.${companyId}`;
}

function getPostSaleRiskStorageKey(companyId: string) {
  return `${postSaleRiskStoragePrefix}.${companyId}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

function createProjectSeed(companyId: string): ProjectPortfolioItemContract[] {
  return [
    {
      id: `prj_demo_torre_${companyId}`,
      companyId,
      code: "AR-TD-01",
      name: "Torre Demo",
      client: "Cliente Demo",
      segment: "Vertical housing",
      status: "active",
      stage: "Structure",
      progress: 42,
      scheduleVarianceDays: 3,
      budgetHealth: "warning",
      qualityHolds: 1,
      permitBlockers: 0,
      activeFronts: 2,
      latestDailyLogStatus: "submitted",
      latestDailyLogDate: "2026-07-13",
      qualityReleaseReadiness: 84,
      subcontractHealth: "controlled",
      pendingDestajo: 0,
      updatedAt: nowIso(),
      nextMilestone: "Liberar cimentacion y arrancar columnas."
    },
    {
      id: `prj_demo_acabados_${companyId}`,
      companyId,
      code: "AR-ACB-02",
      name: "Torre Demo Acabados",
      client: "Cliente Demo",
      segment: "Vertical housing",
      status: "at_risk",
      stage: "Finishes",
      progress: 68,
      scheduleVarianceDays: 7,
      budgetHealth: "critical",
      qualityHolds: 2,
      permitBlockers: 1,
      activeFronts: 1,
      latestDailyLogStatus: "flagged",
      latestDailyLogDate: "2026-07-12",
      qualityReleaseReadiness: 62,
      subcontractHealth: "critical",
      pendingDestajo: 185000,
      updatedAt: nowIso(),
      nextMilestone: "Contener diferencia de acabados y recuperar cuadrilla."
    }
  ];
}

function createProjectRiskSeed(companyId: string): ProjectRiskContract[] {
  return [
    {
      id: `prr_demo_quality_${companyId}`,
      projectId: `prj_demo_torre_${companyId}`,
      title: "El frente de acabados mantiene hallazgos de calidad abiertos",
      category: "Quality",
      severity: "warning",
      owner: "Project manager",
      status: "Containment in progress"
    },
    {
      id: `prr_demo_equipment_${companyId}`,
      projectId: `prj_demo_torre_${companyId}`,
      title: "La grua mantiene una restriccion mecanica que presiona la secuencia",
      category: "Equipment",
      severity: "critical",
      owner: "Operations lead",
      status: "Maintenance release pending"
    },
    {
      id: `prr_demo_finishes_${companyId}`,
      projectId: `prj_demo_acabados_${companyId}`,
      title: "El frente de acabados mantiene faltantes y reproceso sobre punch list",
      category: "Execution",
      severity: "critical",
      owner: "Resident engineer",
      status: "Same-day containment required"
    }
  ];
}

function createProjectScheduleSeed(companyId: string, projectId: string): ProjectScheduleActivityContract[] {
  return [
    {
      id: `sch_structure_${projectId}`,
      companyId,
      projectId,
      code: "EST-010",
      name: "Liberar frente estructural",
      phase: "Estructura",
      status: "in_progress",
      plannedStart: "2026-07-01",
      plannedFinish: "2026-07-18",
      actualStart: "2026-07-02",
      actualFinish: null,
      progressPercent: 68,
      predecessorIds: [],
      owner: "Superintendencia de obra",
      nextAction: "Confirmar liberacion de acero y ventana de colado.",
      updatedAt: nowIso()
    },
    {
      id: `sch_envelope_${projectId}`,
      companyId,
      projectId,
      code: "ENV-020",
      name: "Preparar siguiente frente de envolvente",
      phase: "Envolvente",
      status: "not_started",
      plannedStart: "2026-07-19",
      plannedFinish: "2026-08-08",
      actualStart: null,
      actualFinish: null,
      progressPercent: 0,
      predecessorIds: [`sch_structure_${projectId}`],
      owner: "Coordinacion de acabados",
      nextAction: "Validar liberacion estructural antes de movilizar cuadrilla.",
      updatedAt: nowIso()
    }
  ];
}

function createEquipmentSeed(companyId: string): MachineItemContract[] {
  return [
    {
      id: `eq_demo_exc_${companyId}`,
      companyId,
      code: "EQ-EXC-01",
      machineName: "Excavadora 320GC",
      machineType: "Excavadora",
      projectName: "Torre Demo",
      frontName: "Frente Cimentacion",
      status: "available",
      health: "watch",
      availabilityPercent: 92,
      utilizationPercent: 74,
      hourMeter: 1840,
      nextMaintenanceHours: 110,
      maintenanceDueDate: "2026-07-18T18:00:00.000Z",
      maintenanceBacklog: 0,
      openFailures: 1,
      criticalOpenFailures: 0,
      lastServiceAt: "2026-06-28T15:00:00.000Z",
      nextAction: "Inspeccionar desgaste de pernos de cucharon antes del siguiente ciclo.",
      updatedAt: nowIso()
    },
    {
      id: `eq_demo_crane_${companyId}`,
      companyId,
      code: "EQ-CRN-04",
      machineName: "Grua torre TC-8",
      machineType: "Grua torre",
      projectName: "Torre Demo Acabados",
      frontName: "Jobsite B",
      status: "maintenance",
      health: "critical",
      availabilityPercent: 64,
      utilizationPercent: 58,
      hourMeter: 4120,
      nextMaintenanceHours: 0,
      maintenanceDueDate: "2026-07-09T13:00:00.000Z",
      maintenanceBacklog: 2,
      openFailures: 2,
      criticalOpenFailures: 1,
      lastServiceAt: "2026-06-10T11:30:00.000Z",
      nextAction: "Cerrar falla del freno de giro y liberar ticket de mantenimiento firmado.",
      updatedAt: nowIso()
    }
  ];
}

function createEquipmentRiskSeed(companyId: string): MachineRiskContract[] {
  return [
    {
      id: `mkr_demo_crane_${companyId}`,
      machineId: `eq_demo_crane_${companyId}`,
      title: "La grua mantiene una falla critica abierta en el freno de giro",
      category: "Mechanical",
      severity: "critical",
      owner: "Maintenance lead",
      status: "Repair in progress"
    },
    {
      id: `mkr_demo_exc_${companyId}`,
      machineId: `eq_demo_exc_${companyId}`,
      title: "La excavadora requiere inspeccion preventiva antes del siguiente frente",
      category: "Preventive maintenance",
      severity: "warning",
      owner: "Equipment planner",
      status: "Inspection pending"
    }
  ];
}

function createDailyLogSeed(companyId: string): DailyLogEntryContract[] {
  return [
    {
      id: `dlg_demo_core_${companyId}`,
      companyId,
      projectName: "Torre Demo",
      frontName: "Frente Cimentacion",
      supervisor: "Luis Operaciones",
      logDate: "2026-07-13",
      shift: "morning",
      weather: "clear",
      status: "submitted",
      progressPercent: 42,
      workforceCount: 24,
      incidentsCount: 0,
      blockersCount: 0,
      evidenceCount: 9,
      concretePourM3: 18,
      projectStatus: "active",
      qualityOpenFindings: 1,
      qualityReleaseReadiness: 84,
      subcontractHealth: "controlled",
      pendingDestajo: 0,
      nextAction: "Liberar frente de acero y preparar vaciado de cimentacion.",
      updatedAt: nowIso()
    },
    {
      id: `dlg_demo_finishes_${companyId}`,
      companyId,
      projectName: "Torre Demo Acabados",
      frontName: "Jobsite B",
      supervisor: "Luis Operaciones",
      logDate: "2026-07-12",
      shift: "mixed",
      weather: "rain",
      status: "flagged",
      progressPercent: 68,
      workforceCount: 18,
      incidentsCount: 1,
      blockersCount: 2,
      evidenceCount: 6,
      concretePourM3: 0,
      projectStatus: "at_risk",
      qualityOpenFindings: 4,
      qualityReleaseReadiness: 62,
      subcontractHealth: "critical",
      pendingDestajo: 185000,
      nextAction: "Contener diferencia de acabados y reprogramar cuadrilla de colocacion.",
      updatedAt: nowIso()
    }
  ];
}

function createDailyLogRiskSeed(companyId: string): DailyLogRiskContract[] {
  return [
    {
      id: `dlr_demo_finishes_${companyId}`,
      logId: `dlg_demo_finishes_${companyId}`,
      title: "La bitacora del frente de acabados mantiene bloqueadores abiertos",
      category: "Execution",
      severity: "critical",
      owner: "Resident engineer",
      status: "Needs same-day containment"
    },
    {
      id: `dlr_demo_weather_${companyId}`,
      logId: `dlg_demo_finishes_${companyId}`,
      title: "La lluvia redujo rendimiento y evidencia completa de cierre",
      category: "Weather / evidence",
      severity: "warning",
      owner: "Field supervisor",
      status: "Pending updated evidence pack"
    }
  ];
}

function createHrSeed(companyId: string): HrWorkforceItemContract[] {
  return [
    {
      id: `hr_demo_structure_${companyId}`,
      companyId,
      code: "WF-301",
      contractorName: "Estructuras del Sureste",
      frontName: "Frente Cimentacion",
      activeHeadcount: 24,
      attendanceRate: 94,
      productivityRate: 91,
      complianceExpirations: 0,
      incidentCount: 0,
      safetyStatus: "controlled",
      nextAction: "Mantener disciplina de acceso, seguridad y vaciado para sostener el frente estable.",
      updatedAt: nowIso()
    },
    {
      id: `hr_demo_finishes_${companyId}`,
      companyId,
      code: "WF-302",
      contractorName: "Acabados Integrales",
      frontName: "Jobsite B",
      activeHeadcount: 18,
      attendanceRate: 78,
      productivityRate: 68,
      complianceExpirations: 2,
      incidentCount: 1,
      safetyStatus: "critical",
      nextAction: "Recuperar asistencia, cerrar cumplimiento vencido y contener el frente antes del siguiente corte.",
      updatedAt: nowIso()
    }
  ];
}

function createHrRiskSeed(companyId: string): HrRiskContract[] {
  return [
    {
      id: `hrr_demo_finishes_attendance_${companyId}`,
      workforceId: `hr_demo_finishes_${companyId}`,
      title: "La cuadrilla de acabados ya cayo por debajo del umbral de asistencia operativo.",
      category: "Attendance",
      severity: "critical",
      owner: "Workforce coordinator",
      status: "Recovery plan required today"
    },
    {
      id: `hrr_demo_finishes_compliance_${companyId}`,
      workforceId: `hr_demo_finishes_${companyId}`,
      title: "Persisten vencimientos de cumplimiento que ponen en riesgo la continuidad del contratista.",
      category: "Compliance",
      severity: "warning",
      owner: "Safety lead",
      status: "Document refresh pending"
    },
    {
      id: `hrr_demo_structure_followup_${companyId}`,
      workforceId: `hr_demo_structure_${companyId}`,
      title: "La cuadrilla estructural esta estable pero depende de mantener control preventivo de acceso y maniobras.",
      category: "Preventive control",
      severity: "info",
      owner: "Resident engineer",
      status: "Monitor next pour window"
    }
  ];
}

function createProcurementSeed(companyId: string): ProcurementPackageContract[] {
  return [
    {
      id: `pkg_struct_${companyId}`,
      companyId,
      code: "PKG-401",
      packageName: "Estructura y acero principal",
      projectName: "Torre Demo",
      buyer: "Strategic buyer",
      status: "awaiting_approval",
      budgetAmount: 2480000,
      bidCount: 3,
      approvalHours: 36,
      strategic: true,
      supplierContention: 3,
      nextAction: "Freeze comparison sheet and route the final award package to direction this afternoon.",
      updatedAt: nowIso()
    },
    {
      id: `pkg_finishes_${companyId}`,
      companyId,
      code: "PKG-402",
      packageName: "Acabados interiores",
      projectName: "Torre Demo Acabados",
      buyer: "Site buyer",
      status: "blocked",
      budgetAmount: 684000,
      bidCount: 2,
      approvalHours: 58,
      strategic: false,
      supplierContention: 2,
      nextAction: "Resolve technical clarifications and reopen sourcing before the field team runs short on finishes.",
      updatedAt: nowIso()
    },
    {
      id: `pkg_bienestar_${companyId}`,
      companyId,
      code: "PKG-403",
      packageName: "Paquete urbanizacion bienestar",
      projectName: "Vivienda Bienestar Norte",
      buyer: "Government programs buyer",
      status: "sourcing",
      budgetAmount: 1320000,
      bidCount: 1,
      approvalHours: 14,
      strategic: true,
      supplierContention: 1,
      nextAction: "Open second and third supplier lanes to avoid a single-source decision in the welfare program.",
      updatedAt: nowIso()
    }
  ];
}

function createProcurementRiskSeed(companyId: string): ProcurementRiskContract[] {
  return [
    {
      id: `prkr_struct_${companyId}`,
      packageId: `pkg_struct_${companyId}`,
      title: "Strategic package is waiting on approval while field execution is already near commitment point",
      category: "Approval cycle",
      severity: "warning",
      owner: "Procurement director",
      status: "Approval route active today"
    },
    {
      id: `prkr_finishes_${companyId}`,
      packageId: `pkg_finishes_${companyId}`,
      title: "Blocked finishes package can still delay execution recovery on the active tower",
      category: "Technical blocker",
      severity: "critical",
      owner: "Site buyer",
      status: "Cross-functional unblock required"
    }
  ];
}

function createDocumentControlSeed(companyId: string): DocumentControlItemContract[] {
  return [
    {
      id: `doc_demo_rfi_${companyId}`,
      companyId,
      code: "RFI-024",
      documentType: "RFI",
      subject: "Interferencia entre estructura e instalaciones en Jobsite B",
      projectName: "Torre Demo Acabados",
      owner: "Project coordination",
      status: "in_review",
      revisionCount: 2,
      turnaroundDays: 4,
      openComments: 3,
      health: "critical",
      nextAction: "Consolidar comentarios y emitir respuesta coordinada antes del siguiente corte.",
      updatedAt: nowIso()
    },
    {
      id: `doc_demo_submittal_${companyId}`,
      companyId,
      code: "SUB-011",
      documentType: "Submittal",
      subject: "Submittal de acabados para aprobacion final",
      projectName: "Torre Demo",
      owner: "Project coordination",
      status: "awaiting_response",
      revisionCount: 1,
      turnaroundDays: 3,
      openComments: 2,
      health: "watch",
      nextAction: "Esperar respuesta de proveedor y validar muestra final en obra.",
      updatedAt: nowIso()
    }
  ];
}

function createDocumentControlRiskSeed(companyId: string): DocumentControlRiskContract[] {
  return [
    {
      id: `dcr_demo_rfi_${companyId}`,
      itemId: `doc_demo_rfi_${companyId}`,
      title: "La interferencia de planos sigue abierta sobre frente activo",
      category: "Coordination",
      severity: "critical",
      owner: "Project manager",
      status: "Technical response pending"
    },
    {
      id: `dcr_demo_submittal_${companyId}`,
      itemId: `doc_demo_submittal_${companyId}`,
      title: "El submittal no puede cerrar mientras siga la respuesta del proveedor",
      category: "Submittal response",
      severity: "warning",
      owner: "Document control",
      status: "Vendor answer pending"
    }
  ];
}

function createQualitySeed(companyId: string): QualityInspectionContract[] {
  return [
    {
      id: `qli_demo_finishes_${companyId}`,
      companyId,
      code: "QLT-031",
      projectName: "Torre Demo Acabados",
      areaName: "Frente Acabados",
      checklistName: "Liberacion de muros y detalles",
      contractorName: "Acabados Integrales",
      severity: "critical",
      openFindings: 4,
      evidenceCompletion: 62,
      releaseReadiness: 48,
      reworkRate: 18,
      status: "blocked",
      nextAction: "Corregir hallazgos mayores y completar evidencia antes de reactivar la liberacion.",
      latestDailyLogStatus: "flagged",
      projectStatus: "at_risk",
      updatedAt: nowIso()
    },
    {
      id: `qli_demo_structure_${companyId}`,
      companyId,
      code: "QLT-032",
      projectName: "Torre Demo",
      areaName: "Frente Cimentacion",
      checklistName: "Revision de acero y colado",
      contractorName: "Estructuras del Sureste",
      severity: "major",
      openFindings: 2,
      evidenceCompletion: 88,
      releaseReadiness: 84,
      reworkRate: 7,
      status: "pending_release",
      nextAction: "Cerrar punch menor y ejecutar walkthrough final de liberacion.",
      latestDailyLogStatus: "submitted",
      projectStatus: "active",
      updatedAt: nowIso()
    }
  ];
}

function createQualityRiskSeed(companyId: string): QualityRiskContract[] {
  return [
    {
      id: `qlr_demo_finishes_${companyId}`,
      inspectionId: `qli_demo_finishes_${companyId}`,
      title: "La liberacion de acabados sigue bloqueada por hallazgos mayores y evidencia incompleta",
      category: "Release / evidence",
      severity: "critical",
      owner: "Quality lead",
      status: "Immediate correction required"
    },
    {
      id: `qlr_demo_structure_${companyId}`,
      inspectionId: `qli_demo_structure_${companyId}`,
      title: "El walkthrough final aun depende de cerrar punch menor en cimentacion",
      category: "Punch list",
      severity: "warning",
      owner: "Resident engineer",
      status: "Final walkthrough pending"
    }
  ];
}

function createSubcontractSeed(companyId: string): SubcontractLineContract[] {
  return [
    {
      id: `sub_demo_structure_${companyId}`,
      workforceId: `wf_demo_structure_${companyId}`,
      companyId,
      projectId: `prj_demo_torre_${companyId}`,
      code: "SUB-EST-01",
      contractorName: "Estructuras del Sureste",
      frontName: "Frente Cimentacion",
      projectName: "Torre Demo",
      projectStatus: "active",
      subcontractHealth: "controlled",
      latestDailyLogStatus: "submitted",
      qualityReleaseReadiness: 84,
      contractAmount: 1850000,
      earnedAmount: 777000,
      invoicedAmount: 710000,
      paidAmount: 710000,
      retentionAmount: 71000,
      pendingDestajo: 0,
      productivityRate: 91,
      attendanceRate: 94,
      complianceExpirations: 0,
      incidentCount: 0,
      activeHeadcount: 24,
      progressPercent: 42,
      progressGap: 3,
      nextAction: "Liberar acero y confirmar vaciado de cimentacion con supervision.",
      updatedAt: nowIso()
    },
    {
      id: `sub_demo_finishes_${companyId}`,
      workforceId: `wf_demo_finishes_${companyId}`,
      companyId,
      projectId: `prj_demo_acabados_${companyId}`,
      code: "SUB-ACA-02",
      contractorName: "Acabados Integrales",
      frontName: "Jobsite B",
      projectName: "Torre Demo Acabados",
      projectStatus: "at_risk",
      subcontractHealth: "critical",
      latestDailyLogStatus: "flagged",
      qualityReleaseReadiness: 62,
      contractAmount: 2150000,
      earnedAmount: 1462000,
      invoicedAmount: 1335000,
      paidAmount: 1150000,
      retentionAmount: 95000,
      pendingDestajo: 185000,
      productivityRate: 68,
      attendanceRate: 78,
      complianceExpirations: 2,
      incidentCount: 1,
      activeHeadcount: 18,
      progressPercent: 68,
      progressGap: 12,
      nextAction: "Contener diferencia de destajo, recuperar asistencia y revalidar liberacion de calidad.",
      updatedAt: nowIso()
    }
  ];
}

function createSubcontractRiskSeed(companyId: string): SubcontractRiskContract[] {
  return [
    {
      id: `subr_demo_finishes_destajo_${companyId}`,
      lineId: `sub_demo_finishes_${companyId}`,
      title: "El destajo pendiente ya esta afectando continuidad y confianza de pago al contratista.",
      category: "Destajo / payment timing",
      severity: "critical",
      owner: "Project controls",
      status: "Same-day containment pending"
    },
    {
      id: `subr_demo_finishes_quality_${companyId}`,
      lineId: `sub_demo_finishes_${companyId}`,
      title: "La liberacion de calidad sigue insuficiente para sostener el frente sin retrabajo.",
      category: "Quality release",
      severity: "warning",
      owner: "Quality lead",
      status: "Field recheck required"
    },
    {
      id: `subr_demo_structure_followup_${companyId}`,
      lineId: `sub_demo_structure_${companyId}`,
      title: "El frente estructural esta estable pero depende de mantener disciplina de liberacion y vaciado.",
      category: "Execution follow-up",
      severity: "info",
      owner: "Resident engineer",
      status: "Monitor next pour window"
    }
  ];
}

function createSupplierControlSeed(companyId: string): SupplierControlLineContract[] {
  return [
    {
      id: `supc_demo_steel_${companyId}`,
      supplierId: `sup_steel_${companyId}`,
      companyId,
      supplierName: "Aceros del Sureste",
      owner: "Procurement lead",
      awardedPackages: 3,
      activePackages: 2,
      contractedAmount: 2850000,
      concentrationPercent: 31,
      bidCoverage: 2.1,
      deliveryHealth: "watch",
      approvalPressureHours: 12,
      complianceAlerts: 1,
      nextAction: "Asegurar proveedor alterno para el siguiente frente y contener concentracion antes de nueva adjudicacion.",
      updatedAt: nowIso()
    },
    {
      id: `supc_demo_form_${companyId}`,
      supplierId: `sup_form_${companyId}`,
      companyId,
      supplierName: "Cimbra del Sureste",
      owner: "Site buyer",
      awardedPackages: 2,
      activePackages: 2,
      contractedAmount: 1640000,
      concentrationPercent: 24,
      bidCoverage: 1.4,
      deliveryHealth: "critical",
      approvalPressureHours: 22,
      complianceAlerts: 3,
      nextAction: "Destrabar cumplimiento comercial y plan de entrega antes de liberar mas volumen hacia obra.",
      updatedAt: nowIso()
    }
  ];
}

function createSupplierControlRiskSeed(companyId: string): SupplierControlRiskContract[] {
  return [
    {
      id: `supcr_demo_steel_${companyId}`,
      lineId: `supc_demo_steel_${companyId}`,
      title: "La concentracion de volumen ya rebasa tolerancia para el siguiente paquete",
      category: "Supplier concentration",
      severity: "warning",
      owner: "Procurement lead",
      status: "Competition recovery in progress"
    },
    {
      id: `supcr_demo_form_${companyId}`,
      lineId: `supc_demo_form_${companyId}`,
      title: "El proveedor mantiene alertas de cumplimiento y presiona recepcion en obra",
      category: "Compliance / delivery",
      severity: "critical",
      owner: "Site buyer",
      status: "Executive escalation required"
    }
  ];
}

function createSupplierMasterSeed(companyId: string): SupplierMasterProfileContract[] {
  return [
    {
      id: `supm_demo_steel_${companyId}`,
      supplierId: `sup_steel_${companyId}`,
      companyId,
      supplierName: "Aceros del Sureste",
      tradeName: "Aceros Sureste SA de CV",
      rfc: "ASU240101AB1",
      fiscalRegime: "601",
      cfdiUse: "G03",
      paymentMethod: "Transferencia",
      paymentTermsDays: 30,
      bankAccountMasked: "****1024",
      contactName: "Ana Basto",
      contactEmail: "ana.basto@acerosdelsureste.mx",
      contactPhone: "9991234567",
      complianceStatus: "watch",
      satStatus: "watch",
      fiscalPacketCompletion: 82,
      lastValidatedAt: nowIso(),
      nextAction: "Completar opinion positiva SAT y actualizar constancia bancaria antes del siguiente pago.",
      updatedAt: nowIso()
    },
    {
      id: `supm_demo_form_${companyId}`,
      supplierId: `sup_form_${companyId}`,
      companyId,
      supplierName: "Cimbra del Sureste",
      tradeName: "Cimbra del Sureste Integral",
      rfc: "CSI240101CD2",
      fiscalRegime: "601",
      cfdiUse: "G03",
      paymentMethod: "Transferencia",
      paymentTermsDays: 45,
      bankAccountMasked: "****8891",
      contactName: "Luis Chan",
      contactEmail: "luis.chan@cimbrasureste.mx",
      contactPhone: "9997654321",
      complianceStatus: "blocked",
      satStatus: "critical",
      fiscalPacketCompletion: 58,
      lastValidatedAt: null,
      nextAction: "Detener alta financiera hasta recibir opinion SAT vigente y expediente completo del proveedor.",
      updatedAt: nowIso()
    }
  ];
}

function createSupplierMasterRiskSeed(companyId: string): SupplierMasterRiskContract[] {
  return [
    {
      id: `supmr_demo_steel_${companyId}`,
      supplierProfileId: `supm_demo_steel_${companyId}`,
      title: "El expediente fiscal sigue incompleto para liberar el siguiente ciclo de pago",
      category: "Fiscal packet",
      severity: "warning",
      owner: "Accounts payable lead",
      status: "Pending updated SAT opinion"
    },
    {
      id: `supmr_demo_form_${companyId}`,
      supplierProfileId: `supm_demo_form_${companyId}`,
      title: "El proveedor mantiene bloqueo SAT y no puede avanzar hacia pago o nueva adjudicacion",
      category: "SAT / compliance",
      severity: "critical",
      owner: "Finance controller",
      status: "Blocked until evidence is renewed"
    }
  ];
}

function createInventoryReceiptSeed(companyId: string): InventoryReceiptContract[] {
  return [
    {
      id: `irc_demo_central_${companyId}`,
      companyId,
      code: "RCV-301",
      supplierName: "Proveedor Estrategico",
      destinationName: "Almacen central",
      destinationType: "warehouse",
      purchaseReference: "PO-4102",
      purchaseOrderOwner: "Procurement lead",
      purchaseOrderStatus: "in_transit",
      invoiceMatchStatus: "pending",
      etaDate: "2026-07-18",
      receivedDate: null,
      status: "in_transit",
      orderedUnits: 120,
      receivedUnits: 0,
      varianceUnits: 120,
      variancePercent: 100,
      pendingEvidence: 2,
      rejectedUnits: 0,
      nextAction: "Mantener ventana de descarga confirmada y validar evidencia inicial al arribo.",
      updatedAt: nowIso()
    },
    {
      id: `irc_demo_jobsite_${companyId}`,
      companyId,
      code: "RCV-302",
      supplierName: "Cimbra del Sureste",
      destinationName: "Jobsite B",
      destinationType: "jobsite",
      purchaseReference: "PO-4096",
      purchaseOrderOwner: "Site buyer",
      purchaseOrderStatus: "partial",
      invoiceMatchStatus: "risk",
      etaDate: "2026-07-12",
      receivedDate: null,
      status: "blocked",
      orderedUnits: 80,
      receivedUnits: 64,
      varianceUnits: 16,
      variancePercent: 20,
      pendingEvidence: 4,
      rejectedUnits: 3,
      nextAction: "Contener diferencia de cantidad, evidencias y paquete fiscal antes de liberar el frente.",
      updatedAt: nowIso()
    }
  ];
}

function createInventoryReceiptRiskSeed(companyId: string): InventoryReceiptRiskContract[] {
  return [
    {
      id: `irr_demo_jobsite_${companyId}`,
      receiptId: `irc_demo_jobsite_${companyId}`,
      title: "La recepcion mantiene diferencia de cantidad y evidencia incompleta",
      category: "Receiving variance",
      severity: "critical",
      owner: "Warehouse lead",
      status: "Containment required"
    },
    {
      id: `irr_demo_central_${companyId}`,
      receiptId: `irc_demo_central_${companyId}`,
      title: "La recepcion sigue en transito y aun no cierra su paquete de evidencia",
      category: "Inbound execution",
      severity: "warning",
      owner: "Procurement lead",
      status: "Monitor ETA"
    }
  ];
}

function createInventoryMovementSeed(companyId: string): InventoryMovementContract[] {
  return [
    {
      id: `mov_demo_transfer_${companyId}`,
      companyId,
      code: "MOV-211",
      movementType: "transfer",
      skuName: "Block 12x20x40",
      sourceName: "Almacen central",
      destinationName: "Frente 1",
      requestedBy: "Warehouse coordinator",
      upstreamReceiptCode: "RCV-301",
      purchaseReference: "PO-4102",
      purchaseOrderOwner: "Procurement lead",
      purchaseOrderStatus: "received",
      invoiceMatchStatus: "matched",
      status: "draft",
      requestedUnits: 120,
      movedUnits: 0,
      varianceUnits: 120,
      pendingEvidence: 2,
      impactLevel: "watch",
      nextAction: "Liberar la salida y confirmar recepcion de material con firma en frente.",
      updatedAt: nowIso()
    },
    {
      id: `mov_demo_return_${companyId}`,
      companyId,
      code: "MOV-212",
      movementType: "return",
      skuName: "Panel de cimbra",
      sourceName: "Jobsite B",
      destinationName: "Patio de equipos",
      requestedBy: "Field supervisor",
      upstreamReceiptCode: "RCV-302",
      purchaseReference: "PO-4096",
      purchaseOrderOwner: "Site buyer",
      purchaseOrderStatus: "partial",
      invoiceMatchStatus: "risk",
      status: "blocked",
      requestedUnits: 36,
      movedUnits: 28,
      varianceUnits: 8,
      pendingEvidence: 3,
      impactLevel: "critical",
      nextAction: "Cerrar diferencias del retorno y completar evidencia fotografica antes de reingresar a patio.",
      updatedAt: nowIso()
    }
  ];
}

function createInventoryMovementRiskSeed(companyId: string): InventoryMovementRiskContract[] {
  return [
    {
      id: `imr_demo_return_${companyId}`,
      movementId: `mov_demo_return_${companyId}`,
      title: "El retorno sigue bloqueado por diferencia de cantidad y paquete de evidencia incompleto",
      category: "Material return",
      severity: "critical",
      owner: "Field supervisor",
      status: "Containment required"
    },
    {
      id: `imr_demo_transfer_${companyId}`,
      movementId: `mov_demo_transfer_${companyId}`,
      title: "El traslado requiere cierre de evidencia para asegurar trazabilidad completa",
      category: "Traceability",
      severity: "warning",
      owner: "Warehouse coordinator",
      status: "Dispatch follow-up"
    }
  ];
}

function createProcurementPurchaseOrderSeed(companyId: string): ProcurementPurchaseOrderContract[] {
  return [
    {
      id: `po_demo_foundation_${companyId}`,
      companyId,
      code: "PO-4102",
      requisitionCode: "REQ-FLD-001",
      projectName: "Torre Demo",
      supplierName: "Aceros del Sureste",
      buyer: "Procurement lead",
      category: "Steel / formwork",
      status: "in_transit",
      totalAmount: 420000,
      committedEta: "2026-07-18",
      receivedPercent: 0,
      invoiceMatchStatus: "pending",
      logisticsMode: "Direct to jobsite",
      nextAction: "Confirmar arribo del primer frente y mantener evidencia comercial completa para recepcion.",
      updatedAt: nowIso()
    },
    {
      id: `po_demo_finishes_${companyId}`,
      companyId,
      code: "PO-4096",
      requisitionCode: "REQ-FLD-002",
      projectName: "Torre Demo Acabados",
      supplierName: "Cimbra del Sureste",
      buyer: "Site buyer",
      category: "Finishes",
      status: "blocked",
      totalAmount: 185000,
      committedEta: "2026-07-14",
      receivedPercent: 80,
      invoiceMatchStatus: "risk",
      logisticsMode: "Cross-dock to jobsite",
      nextAction: "Destrabar evidencia fiscal y diferencia de surtido antes de cerrar la orden en obra.",
      updatedAt: nowIso()
    }
  ];
}

function createProcurementPurchaseOrderRiskSeed(companyId: string): ProcurementPurchaseOrderRiskContract[] {
  return [
    {
      id: `por_demo_foundation_${companyId}`,
      purchaseOrderId: `po_demo_foundation_${companyId}`,
      title: "La orden sigue en transito y todavia no cierra su paquete de evidencia para recepcion",
      category: "Inbound execution",
      severity: "warning",
      owner: "Procurement lead",
      status: "Track arrival"
    },
    {
      id: `por_demo_finishes_${companyId}`,
      purchaseOrderId: `po_demo_finishes_${companyId}`,
      title: "La orden mantiene riesgo fiscal y diferencia de surtido ligada al proveedor",
      category: "Fiscal / quantity variance",
      severity: "critical",
      owner: "Site buyer",
      status: "Executive containment required"
    }
  ];
}

function createFieldMaterialRequestSeed(companyId: string): FieldMaterialRequestContract[] {
  return [
    {
      id: `fld_demo_foundation_${companyId}`,
      companyId,
      requisitionId: `req_demo_foundation_${companyId}`,
      projectName: "Torre Demo",
      frontName: "Frente Cimentacion",
      requestedBy: "Luis Operaciones",
      summary: "Acero y cimbra para cimentacion inmediata",
      detail: "El frente ya consume stock comprometido y requiere liberar surtido para no frenar el siguiente colado.",
      requestedVolume: "42 ton",
      urgency: "watch",
      nextAction: "Convertir solicitud de campo en requisicion y asegurar la primera ventana de entrega.",
      status: "converted",
      createdAt: nowIso(),
      updatedAt: nowIso()
    },
    {
      id: `fld_demo_finishes_${companyId}`,
      companyId,
      requisitionId: `req_demo_finishes_${companyId}`,
      projectName: "Torre Demo Acabados",
      frontName: "Jobsite B",
      requestedBy: "Luis Operaciones",
      summary: "Faltante de acabados para cierre de frente",
      detail: "El frente perdera continuidad si no se repone material antes del siguiente corte de suministro.",
      requestedVolume: "180 m2",
      urgency: "critical",
      nextAction: "Escalar compra y confirmar proveedor disponible para sostener el frente activo.",
      status: "requested",
      createdAt: nowIso(),
      updatedAt: nowIso()
    }
  ];
}

function createAccountsPayableSeed(companyId: string): AccountsPayableInvoiceContract[] {
  return [
    {
      id: `ap_inv_01_${companyId}`,
      companyId,
      supplierProfileId: `supm_demo_steel_${companyId}`,
      supplierName: "Aceros del Sureste",
      code: "AP-2401",
      invoiceNumber: "AS-8841",
      invoiceUuid: "8C1F52C2-7B1A-4D80-9A43-1A2BC3D4E5F6",
      projectName: "Proyecto central",
      purchaseOrderCode: "PO-2407-14",
      receiptCode: "REC-2407-09",
      status: "scheduled",
      satStatus: "controlled",
      complementStatus: "complete",
      receiptEvidenceStatus: "complete",
      paymentMethod: "Transferencia",
      dueDate: "2026-07-18",
      scheduledPaymentDate: "2026-07-16",
      receivedAt: "2026-07-10T15:10:00.000Z",
      subtotal: 120000,
      tax: 19200,
      total: 139200,
      pendingAmount: 139200,
      packetCompletion: 100,
      nextAction: "Confirm treasury slot and release payment packet.",
      updatedAt: nowIso()
    },
    {
      id: `ap_inv_02_${companyId}`,
      companyId,
      supplierProfileId: `supm_demo_form_${companyId}`,
      supplierName: "Cimbra del Sureste",
      code: "AP-2402",
      invoiceNumber: "CDS-2217",
      invoiceUuid: "A2B34C56-7890-4DEF-A123-4567890ABCDE",
      projectName: "Torre Demo",
      purchaseOrderCode: "PO-2407-11",
      receiptCode: "REC-2407-12",
      status: "blocked",
      satStatus: "critical",
      complementStatus: "risk",
      receiptEvidenceStatus: "partial",
      paymentMethod: "Transferencia",
      dueDate: "2026-07-14",
      scheduledPaymentDate: null,
      receivedAt: "2026-07-09T11:45:00.000Z",
      subtotal: 86000,
      tax: 13760,
      total: 99760,
      pendingAmount: 99760,
      packetCompletion: 62,
      nextAction: "Resolve CFDI complement mismatch and complete receiving evidence.",
      updatedAt: nowIso()
    },
    {
      id: `ap_inv_03_${companyId}`,
      companyId,
      supplierProfileId: null,
      supplierName: "Renta de Equipos Costa",
      code: "AP-2403",
      invoiceNumber: "REC-1180",
      invoiceUuid: "F1E2D3C4-B5A6-4789-8123-ABCDEF456789",
      projectName: "Torre Demo Acabados",
      purchaseOrderCode: null,
      receiptCode: null,
      status: "received",
      satStatus: "watch",
      complementStatus: "pending",
      receiptEvidenceStatus: "missing",
      paymentMethod: "Transferencia",
      dueDate: "2026-07-21",
      scheduledPaymentDate: null,
      receivedAt: "2026-07-12T13:20:00.000Z",
      subtotal: 42000,
      tax: 6720,
      total: 48720,
      pendingAmount: 48720,
      packetCompletion: 54,
      nextAction: "Link supplier fiscal profile and attach signed receipt packet.",
      updatedAt: nowIso()
    }
  ];
}

function createAccountsPayableRiskSeed(companyId: string): AccountsPayableRiskContract[] {
  return [
    {
      id: `ap_risk_cfdi_${companyId}`,
      invoiceId: `ap_inv_02_${companyId}`,
      title: "CFDI complement is incomplete against the scheduled payment packet",
      category: "Fiscal",
      severity: "critical",
      owner: "Accounts payable lead",
      status: "Waiting supplier complement"
    },
    {
      id: `ap_risk_receipt_${companyId}`,
      invoiceId: `ap_inv_03_${companyId}`,
      title: "Receiving evidence is still missing from field and warehouse",
      category: "Receiving",
      severity: "warning",
      owner: "Warehouse coordinator",
      status: "Collect signatures and photos"
    }
  ];
}

function toTreasuryInvoice(invoice: AccountsPayableInvoiceContract): TreasuryPaymentRunInvoiceContract {
  return {
    invoiceId: invoice.id,
    invoiceCode: invoice.code,
    supplierName: invoice.supplierName,
    total: invoice.pendingAmount,
    scheduledPaymentDate: invoice.scheduledPaymentDate,
    satStatus: invoice.satStatus,
    complementStatus: invoice.complementStatus,
    receiptEvidenceStatus: invoice.receiptEvidenceStatus
  };
}

function createTreasuryPaymentRunSeed(companyId: string): TreasuryPaymentRunContract[] {
  const invoices = createAccountsPayableSeed(companyId);
  const seedInvoice = invoices.find((invoice) => invoice.id === `ap_inv_01_${companyId}`) ?? invoices[0];
  return seedInvoice
    ? [
        {
          id: `tpr_demo_01_${companyId}`,
          companyId,
          code: "TR-2401",
          bankAccountLabel: "Banorte Operacion ****4451",
          scheduledDate: "2026-07-16",
          status: "ready",
          totalInvoices: 1,
          totalAmount: seedInvoice.pendingAmount,
          criticalInvoices: 0,
          owner: "Treasury lead",
          nextAction: "Release first ready supplier payment after final treasury check.",
          updatedAt: nowIso(),
          invoices: [toTreasuryInvoice(seedInvoice)]
        }
      ]
    : [];
}

function createTreasuryPaymentRunRiskSeed(companyId: string): TreasuryPaymentRunRiskContract[] {
  return [
    {
      id: `tpr_risk_01_${companyId}`,
      paymentRunId: `tpr_demo_01_${companyId}`,
      title: "Final bank release window must be confirmed before treasury cut-off",
      category: "Treasury timing",
      severity: "warning",
      owner: "Treasury lead",
      status: "Awaiting same-day bank confirmation"
    }
  ];
}

function createCashFlowSeed(companyId: string): CashFlowLineContract[] {
  return [
    {
      id: `cfl_cash_${companyId}`,
      ledgerId: `ledger_cash_${companyId}`,
      companyId,
      code: "CF-101",
      streamName: "Operating cash lane",
      sourceType: "cash",
      health: "watch",
      startingCash: 1850000,
      projectedInflows: 950000,
      projectedOutflows: 1120000,
      weeklyNet: -170000,
      liquidityCoverageWeeks: 2.6,
      openPressureItems: 3,
      confidencePercent: 78,
      nextAction: "Protect short-term disbursements and refresh the weekly cash lane after treasury release.",
      updatedAt: nowIso()
    },
    {
      id: `cfl_payables_${companyId}`,
      ledgerId: `ledger_payables_${companyId}`,
      companyId,
      code: "CF-102",
      streamName: "Accounts payable release",
      sourceType: "payables",
      health: "critical",
      startingCash: 1850000,
      projectedInflows: 0,
      projectedOutflows: 238960,
      weeklyNet: -238960,
      liquidityCoverageWeeks: 2.1,
      openPressureItems: 4,
      confidencePercent: 64,
      nextAction: "Clear blocked invoices and realign payment sequence before the next treasury cut-off.",
      updatedAt: nowIso()
    },
    {
      id: `cfl_tax_${companyId}`,
      ledgerId: `ledger_tax_${companyId}`,
      companyId,
      code: "CF-103",
      streamName: "Fiscal commitments",
      sourceType: "tax",
      health: "watch",
      startingCash: 1850000,
      projectedInflows: 0,
      projectedOutflows: 148000,
      weeklyNet: -148000,
      liquidityCoverageWeeks: 3.1,
      openPressureItems: 2,
      confidencePercent: 72,
      nextAction: "Confirm SAT packet posture and reserve the weekly tax lane inside treasury planning.",
      updatedAt: nowIso()
    }
  ];
}

function createCashFlowRiskSeed(companyId: string): CashFlowRiskContract[] {
  return [
    {
      id: `cfr_payables_${companyId}`,
      lineId: `cfl_payables_${companyId}`,
      title: "Blocked AP invoices are still distorting the weekly disbursement plan",
      category: "Payables",
      severity: "critical",
      owner: "Accounts payable lead",
      status: "Treasury sequencing pending"
    },
    {
      id: `cfr_tax_${companyId}`,
      lineId: `cfl_tax_${companyId}`,
      title: "Fiscal evidence and supplier packet posture still reduce treasury confidence",
      category: "Fiscal",
      severity: "warning",
      owner: "Finance controller",
      status: "Evidence refresh in progress"
    }
  ];
}

function createCloseControlSeed(companyId: string): CloseControlLineContract[] {
  return [
    {
      id: `ccl_finance_${companyId}`,
      sourceId: `ledger_payables_${companyId}`,
      companyId,
      code: "CC-201",
      streamName: "Finance close pack",
      streamType: "finance",
      closeHealth: "watch",
      closeReadiness: 74,
      blockingItems: 3,
      slaHoursRemaining: 18,
      evidenceCompletion: 76,
      fiscalExposure: 238960,
      nextAction: "Finish AP support pack and validate close evidence before the next checkpoint.",
      updatedAt: nowIso()
    },
    {
      id: `ccl_compliance_${companyId}`,
      sourceId: `supm_demo_form_${companyId}`,
      companyId,
      code: "CC-202",
      streamName: "Supplier compliance close lane",
      streamType: "compliance",
      closeHealth: "critical",
      closeReadiness: 58,
      blockingItems: 4,
      slaHoursRemaining: -6,
      evidenceCompletion: 61,
      fiscalExposure: 99760,
      nextAction: "Resolve SAT and fiscal packet blockers before month-end treasury release is frozen.",
      updatedAt: nowIso()
    },
    {
      id: `ccl_docs_${companyId}`,
      sourceId: `doc_demo_rfi_${companyId}`,
      companyId,
      code: "CC-203",
      streamName: "Document support evidence",
      streamType: "document_control",
      closeHealth: "watch",
      closeReadiness: 81,
      blockingItems: 2,
      slaHoursRemaining: 26,
      evidenceCompletion: 84,
      fiscalExposure: 42000,
      nextAction: "Close support evidence gaps from document control and attach them to the month-end packet.",
      updatedAt: nowIso()
    }
  ];
}

function createCloseControlRiskSeed(companyId: string): CloseControlRiskContract[] {
  return [
    {
      id: `ccr_compliance_${companyId}`,
      lineId: `ccl_compliance_${companyId}`,
      title: "Supplier compliance stream is already overdue for the current close window",
      category: "Compliance",
      severity: "critical",
      owner: "Finance controller",
      status: "Executive unblock required"
    }
  ];
}

function createFinanceSeed(companyId: string): FinanceLedgerItemContract[] {
  return [
    {
      id: `fin_cash_${companyId}`,
      companyId,
      code: "FIN-301",
      metricName: "Operating cash posture",
      valueLabel: "MXN 1.85M starting cash",
      trendLabel: "Weekly net at watch",
      note: "Protect the short-term disbursement lane and refresh operating cash after treasury release.",
      cashImpact: -170000,
      urgentItems: 3,
      closeReadiness: 76,
      satStatus: "watch",
      updatedAt: nowIso()
    },
    {
      id: `fin_ap_${companyId}`,
      companyId,
      code: "FIN-302",
      metricName: "Accounts payable pressure",
      valueLabel: "MXN 238,960 blocked",
      trendLabel: "Treasury release constrained",
      note: "Blocked invoices and incomplete supplier packets are still constraining treasury release.",
      cashImpact: -238960,
      urgentItems: 4,
      closeReadiness: 64,
      satStatus: "critical",
      updatedAt: nowIso()
    },
    {
      id: `fin_close_${companyId}`,
      companyId,
      code: "FIN-303",
      metricName: "Month-end close readiness",
      valueLabel: "74% average readiness",
      trendLabel: "Close lane under watch",
      note: "Keep close evidence synchronized with AP, treasury and compliance owners.",
      cashImpact: 0,
      urgentItems: 2,
      closeReadiness: 74,
      satStatus: "watch",
      updatedAt: nowIso()
    }
  ];
}

function createFinanceRiskSeed(companyId: string): FinanceRiskContract[] {
  return [
    {
      id: `finr_ap_${companyId}`,
      ledgerId: `fin_ap_${companyId}`,
      title: "Accounts payable blockers are still cascading into treasury and close readiness",
      category: "Payables chain",
      severity: "critical",
      owner: "Finance controller",
      status: "Cross-functional unblock required"
    }
  ];
}

function createBudgetBookSeed(companyId: string): BudgetBookLineContract[] {
  return [
    {
      id: `bb_foundation_${companyId}`,
      packageId: `pkg_foundation_${companyId}`,
      companyId,
      projectId: `prj_demo_torre_${companyId}`,
      code: "BB-401",
      conceptCode: "CIM-001",
      projectName: "Torre Demo",
      packageName: "Cimentacion y acero",
      buyer: "Procurement lead",
      unit: "m3",
      quantity: 420,
      unitCost: 2850,
      budgetAmount: 1197000,
      executedQuantity: 180,
      estimatedQuantity: 210,
      pendingQuantity: 210,
      progressPercent: 50,
      evidenceCount: 18,
      changeOrders: 1,
      generatorHealth: "watch",
      collectionHealth: "watch",
      collectionOwner: "Collections lead",
      pendingCollection: 320000,
      pendingToBill: 185000,
      overdueCollectionDays: 12,
      procurementStatus: "sourcing",
      nextAction: "Freeze quantities and complete vendor comparison for the next procurement release.",
      updatedAt: nowIso()
    },
    {
      id: `bb_finishes_${companyId}`,
      packageId: `pkg_finishes_${companyId}`,
      companyId,
      projectId: `prj_demo_acabados_${companyId}`,
      code: "BB-402",
      conceptCode: "ACB-014",
      projectName: "Torre Demo Acabados",
      packageName: "Acabados interiores",
      buyer: "Site buyer",
      unit: "m2",
      quantity: 980,
      unitCost: 640,
      budgetAmount: 627200,
      executedQuantity: 620,
      estimatedQuantity: 700,
      pendingQuantity: 280,
      progressPercent: 71,
      evidenceCount: 11,
      changeOrders: 2,
      generatorHealth: "critical",
      collectionHealth: "critical",
      collectionOwner: "Project controller",
      pendingCollection: 268000,
      pendingToBill: 142000,
      overdueCollectionDays: 38,
      procurementStatus: "blocked",
      nextAction: "Resolve generator gaps and unblock sourcing before the finish package slips further.",
      updatedAt: nowIso()
    }
  ];
}

function createBudgetBookRiskSeed(companyId: string): BudgetBookRiskContract[] {
  return [
    {
      id: `bbr_finishes_${companyId}`,
      lineId: `bb_finishes_${companyId}`,
      title: "Finish package still carries blocked procurement and overdue collection exposure",
      category: "Generator / cash",
      severity: "critical",
      owner: "Project controller",
      status: "Immediate containment required"
    }
  ];
}

function createEstimationSeed(companyId: string): EstimationCollectionLineContract[] {
  return [
    {
      id: `est_torre_${companyId}`,
      companyId,
      projectId: `prj_demo_torre_${companyId}`,
      financeLedgerId: `fin_cash_${companyId}`,
      code: "EST-501",
      projectName: "Torre Demo",
      client: "Cliente Demo",
      segment: "Vertical housing",
      collectionOwner: "Collections lead",
      billingCycleLabel: "Julio corte 2",
      projectStatus: "active",
      collectionHealth: "watch",
      estimatedAmount: 980000,
      executedAmount: 920000,
      submittedAmount: 740000,
      collectedAmount: 510000,
      pendingToBill: 180000,
      pendingCollection: 230000,
      pendingApprovalAmount: 95000,
      evidenceProgress: 82,
      projectProgress: 68,
      progressGap: 14,
      scheduleVarianceDays: 3,
      closeReadiness: 77,
      oldestPendingDays: 19,
      collectionWindowDays: 21,
      nextAction: "Close evidence and billing comments to convert the next submitted tranche faster.",
      updatedAt: nowIso()
    },
    {
      id: `est_acabados_${companyId}`,
      companyId,
      projectId: `prj_demo_acabados_${companyId}`,
      financeLedgerId: `fin_ap_${companyId}`,
      code: "EST-502",
      projectName: "Torre Demo Acabados",
      client: "Cliente Demo",
      segment: "Vertical housing",
      collectionOwner: "Commercial controller",
      billingCycleLabel: "Julio corte 1",
      projectStatus: "at_risk",
      collectionHealth: "critical",
      estimatedAmount: 760000,
      executedAmount: 700000,
      submittedAmount: 460000,
      collectedAmount: 210000,
      pendingToBill: 160000,
      pendingCollection: 250000,
      pendingApprovalAmount: 120000,
      evidenceProgress: 63,
      projectProgress: 74,
      progressGap: -11,
      scheduleVarianceDays: 7,
      closeReadiness: 62,
      oldestPendingDays: 34,
      collectionWindowDays: 21,
      nextAction: "Escalate client review and close evidence gaps before the overdue tranche expands.",
      updatedAt: nowIso()
    }
  ];
}

function createEstimationExceptionSeed(companyId: string): EstimationCollectionExceptionContract[] {
  return [
    {
      id: `este_acabados_${companyId}`,
      lineId: `est_acabados_${companyId}`,
      title: "Client review cycle remains stalled and keeps the oldest tranche overdue",
      category: "Collection aging",
      severity: "critical",
      owner: "Commercial controller",
      status: "Escalation in progress"
    }
  ];
}

function createCostControlSeed(companyId: string): CostControlLineContract[] {
  return [
    {
      id: `cctl_foundation_${companyId}`,
      packageId: `pkg_foundation_${companyId}`,
      companyId,
      projectId: `prj_demo_torre_${companyId}`,
      code: "CCL-601",
      packageName: "Cimentacion y acero",
      projectName: "Torre Demo",
      buyer: "Procurement lead",
      collectionOwner: "Collections lead",
      procurementStatus: "awaiting_approval",
      controlHealth: "watch",
      collectionHealth: "watch",
      budgetAmount: 1197000,
      committedCost: 980000,
      spentToDate: 610000,
      forecastAtCompletion: 1254000,
      varianceAmount: 57000,
      variancePercent: 4.8,
      projectProgress: 68,
      scheduleVarianceDays: 3,
      cashExposure: 185000,
      pendingCollection: 230000,
      overdueCollectionDays: 19,
      riskDrivers: ["Steel price drift", "Generator alignment", "Pending approval"],
      nextAction: "Close approval loop and align award decision with cash conversion timing.",
      updatedAt: nowIso()
    },
    {
      id: `cctl_finishes_${companyId}`,
      packageId: `pkg_finishes_${companyId}`,
      companyId,
      projectId: `prj_demo_acabados_${companyId}`,
      code: "CCL-602",
      packageName: "Acabados interiores",
      projectName: "Torre Demo Acabados",
      buyer: "Site buyer",
      collectionOwner: "Commercial controller",
      procurementStatus: "blocked",
      controlHealth: "critical",
      collectionHealth: "critical",
      budgetAmount: 627200,
      committedCost: 588000,
      spentToDate: 492000,
      forecastAtCompletion: 708000,
      varianceAmount: 80800,
      variancePercent: 12.9,
      projectProgress: 74,
      scheduleVarianceDays: 7,
      cashExposure: 250000,
      pendingCollection: 250000,
      overdueCollectionDays: 34,
      riskDrivers: ["Overdue collection", "Blocked procurement", "Finish rework"],
      nextAction: "Contain variance and unblock package before additional cost drift reaches close.",
      updatedAt: nowIso()
    }
  ];
}

function createCostControlExceptionSeed(companyId: string): CostControlExceptionContract[] {
  return [
    {
      id: `cce_finishes_${companyId}`,
      lineId: `cctl_finishes_${companyId}`,
      title: "Forecast drift remains above tolerance while collections are already overdue",
      category: "Forecast / cash",
      severity: "critical",
      owner: "Project controller",
      status: "Director review pending"
    }
  ];
}

function createComplianceSeed(companyId: string): ComplianceCaseContract[] {
  return [
    {
      id: `comp_handover_${companyId}`,
      companyId,
      code: "CMP-701",
      queueName: "Handover",
      subject: "Entrega documental Torre Demo",
      unitOrContract: "Torre Demo",
      owner: "Compliance lead",
      status: "in_progress",
      documentCompletion: 82,
      slaHoursRemaining: 18,
      openFindings: 2,
      health: "watch",
      nextAction: "Close missing signatures and consolidate final handover packet.",
      updatedAt: nowIso()
    },
    {
      id: `comp_warranty_${companyId}`,
      companyId,
      code: "CMP-702",
      queueName: "Warranty",
      subject: "Garantias acabados cliente demo",
      unitOrContract: "Torre Demo Acabados",
      owner: "Post-sale coordinator",
      status: "at_risk",
      documentCompletion: 61,
      slaHoursRemaining: -6,
      openFindings: 4,
      health: "critical",
      nextAction: "Escalate overdue warranty folder and attach missing support evidence immediately.",
      updatedAt: nowIso()
    }
  ];
}

function createComplianceRiskSeed(companyId: string): ComplianceRiskContract[] {
  return [
    {
      id: `cmpr_warranty_${companyId}`,
      caseId: `comp_warranty_${companyId}`,
      title: "Warranty folder is already overdue and still lacks closure evidence",
      category: "SLA / evidence",
      severity: "critical",
      owner: "Post-sale coordinator",
      status: "Executive escalation required"
    }
  ];
}

function createCrmSeed(companyId: string): CrmLeadBucketContract[] {
  return [
    {
      id: `crm_vertical_${companyId}`,
      companyId,
      code: "CRM-801",
      projectName: "Torre Demo",
      segment: "Vertical housing",
      openOpportunities: 28,
      conversionRate: 24,
      reservations: 14,
      forecastRevenue: 4680000,
      health: "healthy",
      signal: "Qualified visits and reservations are sustaining a stable closing pace this week.",
      owner: "Commercial lead",
      updatedAt: nowIso()
    },
    {
      id: `crm_bienestar_${companyId}`,
      companyId,
      code: "CRM-802",
      projectName: "Vivienda Bienestar Norte",
      segment: "Government housing",
      openOpportunities: 17,
      conversionRate: 13,
      reservations: 4,
      forecastRevenue: 920000,
      health: "watch",
      signal: "Pipeline still depends on permit timing and stronger reservation follow-through.",
      owner: "Government sales desk",
      updatedAt: nowIso()
    },
    {
      id: `crm_finishes_${companyId}`,
      companyId,
      code: "CRM-803",
      projectName: "Torre Demo Acabados",
      segment: "Vertical housing",
      openOpportunities: 11,
      conversionRate: 9,
      reservations: 2,
      forecastRevenue: 540000,
      health: "critical",
      signal: "Closings are slipping because customer confidence is being hit by delivery friction.",
      owner: "Closing manager",
      updatedAt: nowIso()
    }
  ];
}

function createCrmRiskSeed(companyId: string): CrmRiskContract[] {
  return [
    {
      id: `crmr_bienestar_${companyId}`,
      leadBucketId: `crm_bienestar_${companyId}`,
      title: "Reservation flow is still too light for the government housing lane",
      category: "Demand quality",
      severity: "warning",
      owner: "Commercial lead",
      status: "Broker and field campaign adjustment in progress"
    },
    {
      id: `crmr_finishes_${companyId}`,
      leadBucketId: `crm_finishes_${companyId}`,
      title: "Delivery friction is already depressing closing confidence",
      category: "Customer continuity",
      severity: "critical",
      owner: "Closing manager",
      status: "Post-sale and sales alignment required"
    }
  ];
}

function createPostSaleSeed(companyId: string): PostSaleCaseContract[] {
  return [
    {
      id: `psc_delivery_${companyId}`,
      companyId,
      code: "PSC-901",
      caseType: "delivery",
      projectName: "Torre Demo",
      customerName: "Ana Martinez",
      assetLabel: "Depto A-1204",
      owner: "Handover coordinator",
      status: "customer_validation",
      priority: "standard",
      slaHoursRemaining: 22,
      openFindings: 0,
      pendingVisits: 1,
      customerSatisfaction: 92,
      nextAction: "Collect final signature and archive the handover evidence pack.",
      health: "healthy",
      updatedAt: nowIso()
    },
    {
      id: `psc_warranty_${companyId}`,
      companyId,
      code: "PSC-902",
      caseType: "warranty",
      projectName: "Torre Demo Acabados",
      customerName: "Jose Gomez",
      assetLabel: "Depto B-804",
      owner: "Warranty brigade",
      status: "in_progress",
      priority: "urgent",
      slaHoursRemaining: -3,
      openFindings: 3,
      pendingVisits: 2,
      customerSatisfaction: 61,
      nextAction: "Finish corrective works and capture signed evidence before another missed SLA.",
      health: "critical",
      updatedAt: nowIso()
    },
    {
      id: `psc_incident_${companyId}`,
      companyId,
      code: "PSC-903",
      caseType: "incident",
      projectName: "Vivienda Bienestar Norte",
      customerName: "Delegacion Regional",
      assetLabel: "Cluster 3",
      owner: "Field response lead",
      status: "triaged",
      priority: "critical",
      slaHoursRemaining: 10,
      openFindings: 2,
      pendingVisits: 1,
      customerSatisfaction: 74,
      nextAction: "Lock site visit, crew and evidence route for the government inspection window.",
      health: "watch",
      updatedAt: nowIso()
    }
  ];
}

function createPostSaleRiskSeed(companyId: string): PostSaleRiskContract[] {
  return [
    {
      id: `psr_warranty_${companyId}`,
      caseId: `psc_warranty_${companyId}`,
      title: "Warranty case is already under SLA breach with pending corrective evidence",
      category: "SLA / execution",
      severity: "critical",
      owner: "Warranty brigade",
      status: "Same-day containment required"
    },
    {
      id: `psr_incident_${companyId}`,
      caseId: `psc_incident_${companyId}`,
      title: "Government inspection case still lacks confirmed field slot",
      category: "Scheduling",
      severity: "warning",
      owner: "Field response lead",
      status: "Visit coordination in progress"
    }
  ];
}

function createProcurementRequisitionSeed(companyId: string): ProcurementRequisitionContract[] {
  return [
    {
      id: `req_demo_foundation_${companyId}`,
      companyId,
      code: "REQ-FLD-001",
      projectName: "Torre Demo",
      frontName: "Frente Cimentacion",
      requestedBy: "Luis Operaciones",
      category: "Steel / formwork",
      status: "approved",
      requestedItems: 6,
      budgetAmount: 420000,
      urgency: "watch",
      approvalHours: 12,
      supplierCoverage: 2,
      nextAction: "Convertir requisicion aprobada en orden de compra y confirmar primer frente de entrega.",
      updatedAt: nowIso()
    },
    {
      id: `req_demo_finishes_${companyId}`,
      companyId,
      code: "REQ-FLD-002",
      projectName: "Torre Demo Acabados",
      frontName: "Jobsite B",
      requestedBy: "Luis Operaciones",
      category: "Finishes",
      status: "sourcing",
      requestedItems: 4,
      budgetAmount: 185000,
      urgency: "critical",
      approvalHours: 18,
      supplierCoverage: 1,
      nextAction: "Completar comparativo de proveedor y amarrar evidencia de campo antes de adjudicar.",
      updatedAt: nowIso()
    }
  ];
}

function createProcurementRequisitionRiskSeed(companyId: string): ProcurementRequisitionRiskContract[] {
  return [
    {
      id: `prrq_demo_foundation_${companyId}`,
      requisitionId: `req_demo_foundation_${companyId}`,
      title: "La requisicion de cimentacion sigue atada al primer frente de entrega",
      category: "Execution dependency",
      severity: "warning",
      owner: "Procurement lead",
      status: "PO conversion pending"
    },
    {
      id: `prrq_demo_finishes_${companyId}`,
      requisitionId: `req_demo_finishes_${companyId}`,
      title: "La requisicion de acabados mantiene competencia limitada y presion del frente",
      category: "Supplier contention",
      severity: "critical",
      owner: "Buyer lead",
      status: "Commercial resolution open"
    }
  ];
}

function createProcurementRequisitionOriginSeed(companyId: string): ProcurementRequisitionsOverviewContract["origins"] {
  return [
    {
      requisitionId: `req_demo_foundation_${companyId}`,
      fieldRequestId: "fld_demo_foundation",
      projectName: "Torre Demo",
      frontName: "Frente Cimentacion",
      requestedBy: "Luis Operaciones",
      summary: "Acero y cimbra para cimentacion inmediata",
      detail: "El frente ya consume stock comprometido y requiere liberar surtido de acero y formaleta para no frenar el colado.",
      requestedVolume: "42 ton",
      urgency: "watch",
      status: "converted",
      nextAction: "Cerrar requisicion y coordinar ventana de descarga en cimentacion.",
      createdAt: nowIso()
    },
    {
      requisitionId: `req_demo_finishes_${companyId}`,
      fieldRequestId: "fld_demo_finishes",
      projectName: "Torre Demo Acabados",
      frontName: "Jobsite B",
      requestedBy: "Luis Operaciones",
      summary: "Saldo de acabados para remate de frentes",
      detail: "El frente de acabados mantiene faltantes que ya pegan en cuadrilla, evidencia y cierre de punch list.",
      requestedVolume: "96 cajas",
      urgency: "critical",
      status: "converted",
      nextAction: "Sostener frente con compra urgente y validar recepcion completa en obra.",
      createdAt: nowIso()
    }
  ];
}

function readStorage<T>(key: string, seedFactory: () => T): T {
  if (typeof window === "undefined") {
    return seedFactory();
  }

  const stored = window.localStorage.getItem(key);
  if (!stored) {
    const seed = seedFactory();
    window.localStorage.setItem(key, JSON.stringify(seed));
    return clone(seed);
  }

  try {
    return JSON.parse(stored) as T;
  } catch {
    const seed = seedFactory();
    window.localStorage.setItem(key, JSON.stringify(seed));
    return clone(seed);
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function hasOverdueMaintenance(machine: MachineItemContract) {
  return (
    machine.maintenanceBacklog > 0 ||
    machine.nextMaintenanceHours <= 0 ||
    Date.parse(machine.maintenanceDueDate) <= Date.now()
  );
}

function pickFocusProject(projects: ProjectPortfolioItemContract[]) {
  const activeProjects = projects.filter((project) => ["active", "at_risk", "blocked"].includes(project.status));
  return (
    activeProjects
      .slice()
      .sort((left, right) => {
        if (left.latestDailyLogStatus === "flagged" && right.latestDailyLogStatus !== "flagged") {
          return -1;
        }

        if (left.latestDailyLogStatus !== "flagged" && right.latestDailyLogStatus === "flagged") {
          return 1;
        }

        if (left.status === "at_risk" && right.status !== "at_risk") {
          return -1;
        }

        if (left.status !== "at_risk" && right.status === "at_risk") {
          return 1;
        }

        return right.scheduleVarianceDays - left.scheduleVarianceDays;
      })[0] ?? null
  );
}

function buildProjectsOverview(
  projects: ProjectPortfolioItemContract[],
  risks: ProjectRiskContract[]
): ProjectPortfolioOverviewContract {
  const activeProjects = projects.filter((project) => ["active", "at_risk", "blocked"].includes(project.status));

  return {
    summary: {
      activeProjects: activeProjects.length,
      averageProgress:
        activeProjects.length > 0
          ? Number((activeProjects.reduce((sum, project) => sum + project.progress, 0) / activeProjects.length).toFixed(1))
          : 0,
      qualityHolds: activeProjects.reduce((sum, project) => sum + project.qualityHolds, 0),
      permitBlockers: activeProjects.reduce((sum, project) => sum + project.permitBlockers, 0),
      executionRiskProjects: activeProjects.filter(
        (project) =>
          project.latestDailyLogStatus === "flagged" ||
          project.subcontractHealth === "critical" ||
          project.qualityReleaseReadiness < 75
      ).length
    },
    projects,
    risks,
    focusProject: pickFocusProject(projects)
  };
}

function calculatePlannedScheduleProgress(activity: ProjectScheduleActivityContract, now = new Date()) {
  const start = new Date(`${activity.plannedStart}T00:00:00Z`).getTime();
  const finish = new Date(`${activity.plannedFinish}T23:59:59Z`).getTime();
  const current = now.getTime();

  if (finish <= start) {
    return current >= finish ? 100 : 0;
  }

  return Math.max(0, Math.min(100, ((current - start) / (finish - start)) * 100));
}

function buildProjectScheduleOverview(
  project: ProjectPortfolioItemContract,
  activities: ProjectScheduleActivityContract[]
): ProjectScheduleOverviewContract {
  const sortedActivities = activities
    .slice()
    .sort((left, right) => left.plannedStart.localeCompare(right.plannedStart) || left.code.localeCompare(right.code));
  const baselineStart = sortedActivities[0]?.plannedStart ?? null;
  const baselineFinish = sortedActivities.reduce<string | null>(
    (latest, activity) => (!latest || activity.plannedFinish > latest ? activity.plannedFinish : latest),
    null
  );
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const scheduleVarianceDays = sortedActivities.reduce((largestDelay, activity) => {
    if (activity.status === "completed" || activity.progressPercent >= 100) {
      return largestDelay;
    }

    const plannedFinish = new Date(`${activity.plannedFinish}T00:00:00Z`).getTime();
    return Math.max(largestDelay, Math.max(0, Math.ceil((today - plannedFinish) / (24 * 60 * 60 * 1000))));
  }, 0);

  return {
    project,
    summary: {
      totalActivities: sortedActivities.length,
      completedActivities: sortedActivities.filter((activity) => activity.status === "completed").length,
      blockedActivities: sortedActivities.filter((activity) => activity.status === "blocked").length,
      plannedProgress: Number(
        (
          sortedActivities.reduce((sum, activity) => sum + calculatePlannedScheduleProgress(activity, now), 0) /
          Math.max(sortedActivities.length, 1)
        ).toFixed(1)
      ),
      actualProgress: Number(
        (sortedActivities.reduce((sum, activity) => sum + activity.progressPercent, 0) / Math.max(sortedActivities.length, 1)).toFixed(1)
      ),
      scheduleVarianceDays,
      baselineStart,
      baselineFinish
    },
    activities: sortedActivities
  };
}

function buildEquipmentOverview(
  machines: MachineItemContract[],
  risks: MachineRiskContract[]
): EquipmentOverviewContract {
  const availableMachines = machines.filter((machine) => machine.status === "available").length;
  const machinesInMaintenance = machines.filter((machine) => machine.status === "maintenance").length;
  const overdueMaintenance = machines.filter((machine) => hasOverdueMaintenance(machine)).length;
  const criticalOpenFailures = machines.reduce((sum, machine) => sum + machine.criticalOpenFailures, 0);
  const averageAvailability =
    machines.length > 0
      ? Number((machines.reduce((sum, machine) => sum + machine.availabilityPercent, 0) / machines.length).toFixed(1))
      : 0;

  const focusMachine =
    machines
      .slice()
      .sort((left, right) => {
        if (left.criticalOpenFailures !== right.criticalOpenFailures) {
          return right.criticalOpenFailures - left.criticalOpenFailures;
        }

        const leftOverdue = hasOverdueMaintenance(left) ? 1 : 0;
        const rightOverdue = hasOverdueMaintenance(right) ? 1 : 0;
        if (leftOverdue !== rightOverdue) {
          return rightOverdue - leftOverdue;
        }

        return left.availabilityPercent - right.availabilityPercent;
      })[0] ?? null;

  return {
    summary: {
      trackedMachines: machines.length,
      availableMachines,
      machinesInMaintenance,
      overdueMaintenance,
      criticalOpenFailures,
      averageAvailability
    },
    machines,
    risks,
    focusMachine
  };
}

function recomputeDailyLogSummary(entries: DailyLogEntryContract[]) {
  return {
    submittedToday: entries.filter((entry) => entry.status !== "draft").length,
    approvedLogs: entries.filter((entry) => entry.status === "approved").length,
    flaggedLogs: entries.filter((entry) => entry.status === "flagged").length,
    totalWorkforce: entries.reduce((sum, entry) => sum + entry.workforceCount, 0),
    pendingEvidence: entries.reduce((sum, entry) => sum + (entry.status !== "approved" ? Math.max(0, 12 - entry.evidenceCount) : 0), 0),
    averageProgress:
      entries.length > 0 ? Number((entries.reduce((sum, entry) => sum + entry.progressPercent, 0) / entries.length).toFixed(1)) : 0,
    executionRiskLogs: entries.filter(
      (entry) => entry.status === "flagged" || entry.qualityOpenFindings > 3 || entry.subcontractHealth === "critical"
    ).length
  };
}

function buildProcurementOverview(
  packages: ProcurementPackageContract[],
  risks: ProcurementRiskContract[]
): ProcurementOverviewContract {
  const openPackages = packages.filter((item) => item.status !== "awarded");
  return {
    summary: {
      openRequisitions: openPackages.length,
      averageApprovalHours:
        openPackages.length > 0
          ? Number((openPackages.reduce((sum, item) => sum + item.approvalHours, 0) / openPackages.length).toFixed(1))
          : 0,
      strategicPackages: packages.filter((item) => item.strategic).length,
      averageBidCount:
        packages.length > 0 ? Number((packages.reduce((sum, item) => sum + item.bidCount, 0) / packages.length).toFixed(1)) : 0
    },
    packages,
    risks,
    focusPackage:
      packages
        .slice()
        .sort((left, right) => {
          if (left.status === "blocked" && right.status !== "blocked") return -1;
          if (left.status !== "blocked" && right.status === "blocked") return 1;
          if (left.strategic !== right.strategic) return Number(right.strategic) - Number(left.strategic);
          return right.approvalHours - left.approvalHours;
        })[0] ?? null
  };
}

function pickFocusDailyLogEntry(entries: DailyLogEntryContract[]) {
  return (
    entries
      .slice()
      .sort((left, right) => {
        const weight = { flagged: 4, submitted: 3, draft: 2, approved: 1 } as const;
        const gap = weight[right.status] - weight[left.status];
        if (gap !== 0) {
          return gap;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })[0] ?? null
  );
}

function buildDailyLogOverview(
  entries: DailyLogEntryContract[],
  risks: DailyLogRiskContract[]
): DailyLogOverviewContract {
  return {
    summary: recomputeDailyLogSummary(entries),
    entries,
    risks,
    focusEntry: pickFocusDailyLogEntry(entries)
  };
}

function buildDocumentControlOverview(
  items: DocumentControlItemContract[],
  risks: DocumentControlRiskContract[]
): DocumentControlOverviewContract {
  return {
    summary: {
      openRfis: items.filter((item) => item.documentType === "RFI" && item.status !== "approved").length,
      activeSubmittals: items.filter((item) => item.documentType === "Submittal" && item.status !== "approved").length,
      controlledVersions: items.reduce((sum, item) => sum + item.revisionCount, 0),
      averageTurnaroundDays:
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.turnaroundDays, 0) / items.length).toFixed(1)) : 0
    },
    items,
    risks,
    focusItem:
      items
        .slice()
        .sort((left, right) => {
          if (left.health === "critical" && right.health !== "critical") {
            return -1;
          }
          if (left.health !== "critical" && right.health === "critical") {
            return 1;
          }
          return right.openComments - left.openComments;
        })[0] ?? null
  };
}

function buildSupplierControlOverview(
  lines: SupplierControlLineContract[],
  risks: SupplierControlRiskContract[]
): SupplierControlOverviewContract {
  return {
    summary: {
      trackedSuppliers: lines.length,
      concentratedSuppliers: lines.filter((item) => item.concentrationPercent >= 28).length,
      awardedVolume: lines.reduce((sum, item) => sum + (item.awardedPackages > 0 ? item.contractedAmount : 0), 0),
      averageBidCoverage:
        lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.bidCoverage, 0) / lines.length).toFixed(1)) : 0,
      criticalSuppliers: lines.filter((item) => item.deliveryHealth === "critical").length,
      complianceAlerts: lines.reduce((sum, item) => sum + item.complianceAlerts, 0)
    },
    lines,
    risks,
    focusLine:
      lines
        .slice()
        .sort((left, right) => {
          if (left.deliveryHealth === "critical" && right.deliveryHealth !== "critical") return -1;
          if (left.deliveryHealth !== "critical" && right.deliveryHealth === "critical") return 1;
          return right.contractedAmount - left.contractedAmount;
        })[0] ?? null
  };
}

function buildSupplierMasterOverview(
  items: SupplierMasterProfileContract[],
  risks: SupplierMasterRiskContract[]
): SupplierMasterOverviewContract {
  return {
    summary: {
      totalSuppliers: items.length,
      criticalSuppliers: items.filter((item) => item.satStatus === "critical" || item.complianceStatus === "blocked").length,
      incompletePackets: items.filter((item) => item.fiscalPacketCompletion < 100).length,
      averageFiscalPacketCompletion:
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.fiscalPacketCompletion, 0) / items.length).toFixed(1)) : 0
    },
    items,
    risks,
    focusItem:
      items
        .slice()
        .sort((left, right) => {
          const leftCritical = left.satStatus === "critical" || left.complianceStatus === "blocked";
          const rightCritical = right.satStatus === "critical" || right.complianceStatus === "blocked";
          if (leftCritical && !rightCritical) return -1;
          if (!leftCritical && rightCritical) return 1;
          return left.fiscalPacketCompletion - right.fiscalPacketCompletion;
        })[0] ?? null
  };
}

function buildProcurementPurchaseOrdersOverview(
  purchaseOrders: ProcurementPurchaseOrderContract[],
  risks: ProcurementPurchaseOrderRiskContract[]
): ProcurementPurchaseOrdersOverviewContract {
  return {
    summary: {
      openOrders: purchaseOrders.filter((item) => item.status !== "received").length,
      inTransitOrders: purchaseOrders.filter((item) => item.status === "in_transit" || item.status === "partial").length,
      blockedOrders: purchaseOrders.filter((item) => item.status === "blocked").length,
      pendingInvoiceMatch: purchaseOrders.filter((item) => item.invoiceMatchStatus !== "matched").length,
      averageReceivedPercent:
        purchaseOrders.length > 0
          ? Number((purchaseOrders.reduce((sum, item) => sum + item.receivedPercent, 0) / purchaseOrders.length).toFixed(1))
          : 0
    },
    purchaseOrders,
    risks,
    focusPurchaseOrder:
      purchaseOrders
        .filter((item) => item.status !== "received")
        .slice()
        .sort((left, right) => {
          if (left.status === "blocked" && right.status !== "blocked") return -1;
          if (left.status !== "blocked" && right.status === "blocked") return 1;
          if (left.invoiceMatchStatus === "risk" && right.invoiceMatchStatus !== "risk") return -1;
          if (left.invoiceMatchStatus !== "risk" && right.invoiceMatchStatus === "risk") return 1;
          return right.totalAmount - left.totalAmount;
        })[0] ?? null
  };
}

function buildFieldMaterialRequestOverview(requests: FieldMaterialRequestContract[]): FieldMaterialRequestOverviewContract {
  return {
    summary: {
      openRequests: requests.filter((request) => request.status === "requested").length,
      convertedRequests: requests.filter((request) => request.status === "converted").length,
      criticalRequests: requests.filter((request) => request.urgency === "critical").length,
      linkedRequisitions: requests.filter((request) => request.requisitionId).length,
      averageSupplierCoverage: requests.length > 0 ? 1.5 : 0
    },
    requests,
    focusRequest:
      requests
        .slice()
        .sort((left, right) => {
          if (left.urgency === "critical" && right.urgency !== "critical") return -1;
          if (left.urgency !== "critical" && right.urgency === "critical") return 1;
          return right.updatedAt.localeCompare(left.updatedAt);
        })[0] ?? null
  };
}

function buildProcurementRequisitionsOverview(
  requisitions: ProcurementRequisitionContract[],
  risks: ProcurementRequisitionRiskContract[],
  origins: ProcurementRequisitionsOverviewContract["origins"]
): ProcurementRequisitionsOverviewContract {
  const openRequisitions = requisitions.filter((item) => item.status !== "sourcing");
  return {
    summary: {
      openRequisitions: openRequisitions.length,
      pendingApproval: requisitions.filter((item) => item.status === "submitted").length,
      criticalUrgency: requisitions.filter((item) => item.urgency === "critical").length,
      averageApprovalHours:
        openRequisitions.length > 0
          ? Number((openRequisitions.reduce((sum, item) => sum + item.approvalHours, 0) / openRequisitions.length).toFixed(1))
          : 0,
      supplierCoverage:
        requisitions.length > 0
          ? Number((requisitions.reduce((sum, item) => sum + item.supplierCoverage, 0) / requisitions.length).toFixed(1))
          : 0
    },
    requisitions,
    risks,
    origins,
    focusRequisition:
      requisitions
        .slice()
        .sort((left, right) => {
          if (left.status === "blocked" && right.status !== "blocked") return -1;
          if (left.status !== "blocked" && right.status === "blocked") return 1;
          if (left.urgency === "critical" && right.urgency !== "critical") return -1;
          if (left.urgency !== "critical" && right.urgency === "critical") return 1;
          return right.budgetAmount - left.budgetAmount;
        })[0] ?? null
  };
}

function buildInventoryReceivingOverview(
  receipts: InventoryReceiptContract[],
  risks: InventoryReceiptRiskContract[]
): InventoryReceivingOverviewContract {
  return {
    summary: {
      openReceipts: receipts.filter((receipt) => receipt.status !== "received").length,
      overdueEta: receipts.filter((receipt) => receipt.status !== "received" && Date.parse(receipt.etaDate) < Date.now()).length,
      quantityVarianceUnits: receipts.reduce((sum, receipt) => sum + Math.abs(receipt.varianceUnits), 0),
      pendingEvidence: receipts.reduce((sum, receipt) => sum + receipt.pendingEvidence, 0),
      blockedReceipts: receipts.filter((receipt) => receipt.status === "blocked").length,
      receiptsAtCommercialRisk: receipts.filter(
        (receipt) => receipt.purchaseOrderStatus === "blocked" || receipt.invoiceMatchStatus === "risk"
      ).length
    },
    receipts,
    risks,
    focusReceipt:
      receipts
        .slice()
        .sort((left, right) => {
          if (left.status === "blocked" && right.status !== "blocked") return -1;
          if (left.status !== "blocked" && right.status === "blocked") return 1;
          if ((left.invoiceMatchStatus === "risk") !== (right.invoiceMatchStatus === "risk")) {
            return Number(right.invoiceMatchStatus === "risk") - Number(left.invoiceMatchStatus === "risk");
          }
          return Math.abs(right.varianceUnits) - Math.abs(left.varianceUnits);
        })[0] ?? null
  };
}

function buildInventoryMovementsOverview(
  movements: InventoryMovementContract[],
  risks: InventoryMovementRiskContract[]
): InventoryMovementsOverviewContract {
  return {
    summary: {
      openMovements: movements.filter((movement) => movement.status !== "received").length,
      criticalMovements: movements.filter((movement) => movement.impactLevel === "critical").length,
      pendingEvidence: movements.reduce((sum, movement) => sum + movement.pendingEvidence, 0),
      varianceUnits: movements.reduce((sum, movement) => sum + Math.abs(movement.varianceUnits), 0),
      returnsInFlow: movements.filter((movement) => movement.movementType === "return" && movement.status !== "received").length,
      movementsAtCommercialRisk: movements.filter(
        (movement) => movement.purchaseOrderStatus === "blocked" || movement.invoiceMatchStatus === "risk"
      ).length
    },
    movements,
    risks,
    focusMovement:
      movements
        .slice()
        .sort((left, right) => {
          if (left.impactLevel === "critical" && right.impactLevel !== "critical") return -1;
          if (left.impactLevel !== "critical" && right.impactLevel === "critical") return 1;
          if ((left.invoiceMatchStatus === "risk") !== (right.invoiceMatchStatus === "risk")) {
            return Number(right.invoiceMatchStatus === "risk") - Number(left.invoiceMatchStatus === "risk");
          }
          return Math.abs(right.varianceUnits) - Math.abs(left.varianceUnits);
        })[0] ?? null
  };
}

function buildAccountsPayableOverview(
  invoices: AccountsPayableInvoiceContract[],
  risks: AccountsPayableRiskContract[]
): AccountsPayableOverviewContract {
  return {
    summary: {
      trackedInvoices: invoices.length,
      openAmount: Number(invoices.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)),
      scheduledAmount: Number(invoices.filter((item) => item.status === "scheduled").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)),
      blockedInvoices: invoices.filter((item) => item.status === "blocked").length,
      criticalInvoices: invoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length,
      overdueInvoices: invoices.filter((item) => item.status !== "paid" && Date.parse(item.dueDate) < Date.now()).length
    },
    invoices,
    risks,
    focusInvoice:
      invoices
        .slice()
        .sort((left, right) => {
          if (left.status === "blocked" && right.status !== "blocked") return -1;
          if (left.status !== "blocked" && right.status === "blocked") return 1;
          if (left.satStatus === "critical" && right.satStatus !== "critical") return -1;
          if (left.satStatus !== "critical" && right.satStatus === "critical") return 1;
          return Date.parse(left.dueDate) - Date.parse(right.dueDate);
        })[0] ?? null
  };
}

function buildCashFlowOverview(lines: CashFlowLineContract[], risks: CashFlowRiskContract[]): CashFlowOverviewContract {
  return {
    summary: {
      trackedStreams: lines.length,
      projectedInflows: lines.reduce((sum, item) => sum + item.projectedInflows, 0),
      projectedOutflows: lines.reduce((sum, item) => sum + item.projectedOutflows, 0),
      weeklyNet: lines.reduce((sum, item) => sum + item.weeklyNet, 0),
      criticalStreams: lines.filter((item) => item.health === "critical").length,
      averageConfidence: lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.confidencePercent, 0) / lines.length).toFixed(1)) : 0
    },
    lines,
    risks,
    focusLine:
      lines
        .slice()
        .sort((left, right) => {
          if (left.health === "critical" && right.health !== "critical") return -1;
          if (left.health !== "critical" && right.health === "critical") return 1;
          return left.weeklyNet - right.weeklyNet;
        })[0] ?? null
  };
}

function buildCloseControlOverview(lines: CloseControlLineContract[], risks: CloseControlRiskContract[]): CloseControlOverviewContract {
  return {
    summary: {
      trackedStreams: lines.length,
      averageCloseReadiness: lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.closeReadiness, 0) / lines.length).toFixed(1)) : 0,
      criticalStreams: lines.filter((item) => item.closeHealth === "critical").length,
      blockedItems: lines.reduce((sum, item) => sum + item.blockingItems, 0),
      fiscalExposure: lines.reduce((sum, item) => sum + item.fiscalExposure, 0),
      overdueStreams: lines.filter((item) => item.slaHoursRemaining < 0).length
    },
    lines,
    risks,
    focusLine:
      lines
        .slice()
        .sort((left, right) => {
          if (left.closeHealth === "critical" && right.closeHealth !== "critical") return -1;
          if (left.closeHealth !== "critical" && right.closeHealth === "critical") return 1;
          return left.slaHoursRemaining - right.slaHoursRemaining;
        })[0] ?? null
  };
}

function buildFinanceOverview(items: FinanceLedgerItemContract[], risks: FinanceRiskContract[]): FinanceOverviewContract {
  const cashPosition = items.reduce((sum, item) => sum + item.cashImpact, 0);
  const urgentPayables = items.reduce((sum, item) => sum + item.urgentItems, 0);
  const closeReadiness = items.length > 0 ? Number((items.reduce((sum, item) => sum + item.closeReadiness, 0) / items.length).toFixed(1)) : 0;
  const satStatus: FinanceLedgerItemContract["satStatus"] = items.some((item) => item.satStatus === "critical")
    ? "critical"
    : items.some((item) => item.satStatus === "watch")
      ? "watch"
      : "controlled";

  return {
    summary: {
      cashPosition,
      urgentPayables,
      closeReadiness,
      satStatus,
      supplierExceptions: 1,
      paymentReadySuppliers: 1,
      blockedTreasuryRuns: 0,
      unavailableTreasuryInvoices: 2,
      overdueCollections: 0,
      criticalCollections: 0,
      financeChainPressure: 6
    },
    command: {
      laneStatus: satStatus,
      collectionsPressure: 0,
      treasuryPressure: 3,
      blockedAmount: 238960,
      headline: "Finance lane is tracking payables and close pressure in one operating view.",
      topAction: "Unblock AP and stabilize treasury sequencing before the next close checkpoint.",
      nextMilestone: "Release payment-ready suppliers while month-end evidence catches up."
    },
    items,
    risks,
    focusItem:
      items
        .slice()
        .sort((left, right) => {
          if (left.satStatus === "critical" && right.satStatus !== "critical") return -1;
          if (left.satStatus !== "critical" && right.satStatus === "critical") return 1;
          return right.urgentItems - left.urgentItems;
        })[0] ?? null
  };
}

function buildBudgetBookOverview(lines: BudgetBookLineContract[], risks: BudgetBookRiskContract[]): BudgetBookOverviewContract {
  return {
    summary: {
      activeConcepts: lines.length,
      baselineBudget: lines.reduce((sum, item) => sum + item.budgetAmount, 0),
      executedBudget: lines.reduce((sum, item) => sum + item.executedQuantity * item.unitCost, 0),
      estimatedBudget: lines.reduce((sum, item) => sum + item.estimatedQuantity * item.unitCost, 0),
      pendingBudget: lines.reduce((sum, item) => sum + item.pendingQuantity * item.unitCost, 0),
      criticalConcepts: lines.filter((item) => item.generatorHealth === "critical").length,
      conceptsAtCashRisk: lines.filter((item) => item.collectionHealth === "critical" || item.overdueCollectionDays > 30).length
    },
    lines,
    risks,
    focusLine:
      lines
        .slice()
        .sort((left, right) => {
          if (left.generatorHealth === "critical" && right.generatorHealth !== "critical") return -1;
          if (left.generatorHealth !== "critical" && right.generatorHealth === "critical") return 1;
          return right.pendingQuantity * right.unitCost - left.pendingQuantity * left.unitCost;
        })[0] ?? null
  };
}

function buildEstimationOverview(
  lines: EstimationCollectionLineContract[],
  exceptions: EstimationCollectionExceptionContract[]
): EstimationCollectionOverviewContract {
  return {
    summary: {
      trackedProjects: lines.length,
      estimatedPortfolio: lines.reduce((sum, item) => sum + item.estimatedAmount, 0),
      submittedPortfolio: lines.reduce((sum, item) => sum + item.submittedAmount, 0),
      collectedPortfolio: lines.reduce((sum, item) => sum + item.collectedAmount, 0),
      pendingCollection: lines.reduce((sum, item) => sum + item.pendingCollection, 0),
      criticalCollections: lines.filter((item) => item.collectionHealth === "critical").length,
      overdueCollections: lines.filter((item) => item.oldestPendingDays > item.collectionWindowDays).length
    },
    lines,
    exceptions,
    focusLine:
      lines
        .slice()
        .sort((left, right) => {
          if (left.collectionHealth === "critical" && right.collectionHealth !== "critical") return -1;
          if (left.collectionHealth !== "critical" && right.collectionHealth === "critical") return 1;
          if (right.oldestPendingDays !== left.oldestPendingDays) return right.oldestPendingDays - left.oldestPendingDays;
          return right.pendingCollection - left.pendingCollection;
        })[0] ?? null
  };
}

function buildCostControlOverview(
  lines: CostControlLineContract[],
  exceptions: CostControlExceptionContract[]
): CostControlOverviewContract {
  return {
    summary: {
      trackedLines: lines.length,
      totalBudget: lines.reduce((sum, item) => sum + item.budgetAmount, 0),
      committedCost: lines.reduce((sum, item) => sum + item.committedCost, 0),
      forecastAtCompletion: lines.reduce((sum, item) => sum + item.forecastAtCompletion, 0),
      forecastVariance: lines.reduce((sum, item) => sum + item.varianceAmount, 0),
      criticalLines: lines.filter((item) => item.controlHealth === "critical").length,
      cashRiskLines: lines.filter((item) => item.collectionHealth === "critical" || item.overdueCollectionDays > 30).length
    },
    lines,
    exceptions,
    focusLine:
      lines
        .slice()
        .sort((left, right) => {
          if (left.controlHealth === "critical" && right.controlHealth !== "critical") return -1;
          if (left.controlHealth !== "critical" && right.controlHealth === "critical") return 1;
          if (right.overdueCollectionDays !== left.overdueCollectionDays) return right.overdueCollectionDays - left.overdueCollectionDays;
          return right.varianceAmount - left.varianceAmount;
        })[0] ?? null
  };
}

function buildQualityOverview(
  inspectionsBoard: QualityInspectionContract[],
  risks: QualityRiskContract[]
): QualityOverviewContract {
  return {
    summary: {
      inspections: inspectionsBoard.length,
      openFindings: inspectionsBoard.reduce((sum, item) => sum + item.openFindings, 0),
      releaseReadiness:
        inspectionsBoard.length > 0
          ? Number((inspectionsBoard.reduce((sum, item) => sum + item.releaseReadiness, 0) / inspectionsBoard.length).toFixed(1))
          : 0,
      averageReworkRate:
        inspectionsBoard.length > 0
          ? Number((inspectionsBoard.reduce((sum, item) => sum + item.reworkRate, 0) / inspectionsBoard.length).toFixed(1))
          : 0,
      executionRiskInspections: inspectionsBoard.filter(
        (item) => item.latestDailyLogStatus === "flagged" || item.projectStatus === "blocked" || item.openFindings > 3
      ).length
    },
    inspectionsBoard,
    risks,
    focusInspection:
      inspectionsBoard
        .slice()
        .sort((left, right) => {
          if (left.severity === "critical" && right.severity !== "critical") return -1;
          if (left.severity !== "critical" && right.severity === "critical") return 1;
          return right.openFindings - left.openFindings;
        })[0] ?? null
  };
}

function buildComplianceOverview(
  cases: ComplianceCaseContract[],
  risks: ComplianceRiskContract[]
): ComplianceOverviewContract {
  return {
    summary: {
      activeCases: cases.filter((item) => item.status !== "closed").length,
      atRiskCases: cases.filter((item) => item.health !== "healthy").length,
      averageDocumentCompletion: cases.length > 0 ? Number((cases.reduce((sum, item) => sum + item.documentCompletion, 0) / cases.length).toFixed(1)) : 0,
      openFindings: cases.reduce((sum, item) => sum + item.openFindings, 0)
    },
    cases,
    risks,
    focusCase:
      cases
        .slice()
        .sort((left, right) => {
          if (left.health === "critical" && right.health !== "critical") return -1;
          if (left.health !== "critical" && right.health === "critical") return 1;
          return left.slaHoursRemaining - right.slaHoursRemaining;
        })[0] ?? null
  };
}

function buildCrmOverview(
  leadBuckets: CrmLeadBucketContract[],
  risks: CrmRiskContract[]
): CrmOverviewContract {
  return {
    summary: {
      qualifiedLeads: leadBuckets.reduce((sum, item) => sum + item.openOpportunities, 0),
      visitConversion:
        leadBuckets.length > 0 ? Number((leadBuckets.reduce((sum, item) => sum + item.conversionRate, 0) / leadBuckets.length).toFixed(1)) : 0,
      reservations: leadBuckets.reduce((sum, item) => sum + item.reservations, 0),
      forecastRevenue: leadBuckets.reduce((sum, item) => sum + item.forecastRevenue, 0)
    },
    leadBuckets,
    risks,
    focusBucket:
      leadBuckets
        .slice()
        .sort((left, right) => {
          if (left.health === "critical" && right.health !== "critical") return -1;
          if (left.health !== "critical" && right.health === "critical") return 1;
          return left.reservations - right.reservations;
        })[0] ?? null
  };
}

function buildPostSaleOverview(
  items: PostSaleCaseContract[],
  risks: PostSaleRiskContract[]
): PostSaleOverviewContract {
  return {
    summary: {
      openCases: items.filter((item) => item.status !== "closed").length,
      criticalCases: items.filter((item) => item.health === "critical").length,
      overdueSlaCases: items.filter((item) => item.slaHoursRemaining < 0).length,
      pendingCustomerSignoff: items.filter((item) => item.status === "customer_validation").length
    },
    items,
    risks,
    focusItem:
      items
        .slice()
        .sort((left, right) => {
          if (left.health === "critical" && right.health !== "critical") return -1;
          if (left.health !== "critical" && right.health === "critical") return 1;
          return left.slaHoursRemaining - right.slaHoursRemaining;
        })[0] ?? null
  };
}

function summarizeRun(run: TreasuryPaymentRunContract): TreasuryPaymentRunContract {
  const totalAmount = run.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const criticalInvoices = run.invoices.filter(
    (invoice) =>
      invoice.satStatus === "critical" ||
      invoice.complementStatus === "risk" ||
      invoice.receiptEvidenceStatus === "missing"
  ).length;
  return {
    ...run,
    totalInvoices: run.invoices.length,
    totalAmount,
    criticalInvoices
  };
}

function buildTreasuryPaymentRunsOverview(
  companyId: string,
  runs: TreasuryPaymentRunContract[],
  risks: TreasuryPaymentRunRiskContract[]
): TreasuryPaymentRunsOverviewContract {
  const invoices = readStorage(getAccountsPayableStorageKey(companyId), () => createAccountsPayableSeed(companyId));
  const assignedInvoiceIds = new Set(runs.flatMap((run) => run.invoices.map((invoice) => invoice.invoiceId)));
  const eligibleInvoices = invoices.filter((invoice) => {
    const isOperationallyReady =
      (invoice.status === "matched" || invoice.status === "scheduled") &&
      invoice.satStatus === "controlled" &&
      (invoice.complementStatus === "complete" || invoice.complementStatus === "not_required") &&
      invoice.receiptEvidenceStatus === "complete";
    return isOperationallyReady && !assignedInvoiceIds.has(invoice.id) && invoice.status !== "paid";
  });

  const unavailableInvoices = invoices
    .filter((invoice) => !eligibleInvoices.some((eligible) => eligible.id === invoice.id))
    .map((invoice) => {
      const blockingRunCodes = runs.filter((run) => run.invoices.some((item) => item.invoiceId === invoice.id)).map((run) => run.code);
      let reasonCode: TreasuryPaymentRunsOverviewContract["unavailableInvoices"][number]["reasonCode"] = "invoice_blocked";
      let reasonLabel = "Invoice is not ready for treasury release.";

      if (invoice.status === "paid") {
        reasonCode = "already_paid";
        reasonLabel = "Invoice is already paid.";
      } else if (blockingRunCodes.length > 0) {
        reasonCode = "already_assigned";
        reasonLabel = "Invoice is already assigned to an open payment run.";
      } else if (invoice.satStatus !== "controlled" || invoice.complementStatus === "risk") {
        reasonCode = "fiscal_blocked";
        reasonLabel = "Fiscal posture is not controlled enough for treasury.";
      } else if (invoice.receiptEvidenceStatus !== "complete") {
        reasonCode = "evidence_missing";
        reasonLabel = "Receiving evidence is still incomplete.";
      }

      return {
        invoiceId: invoice.id,
        invoiceCode: invoice.code,
        supplierName: invoice.supplierName,
        pendingAmount: invoice.pendingAmount,
        status: invoice.status,
        reasonCode,
        reasonLabel,
        blockingRunCodes
      };
    });

  const normalizedRuns = runs.map(summarizeRun);
  return {
    summary: {
      activeRuns: normalizedRuns.filter((run) => run.status !== "executed").length,
      scheduledAmount: normalizedRuns.filter((run) => run.status !== "executed").reduce((sum, run) => sum + run.totalAmount, 0),
      blockedRuns: normalizedRuns.filter((run) => run.status === "blocked").length,
      executedRuns: normalizedRuns.filter((run) => run.status === "executed").length,
      criticalInvoices: normalizedRuns.reduce((sum, run) => sum + run.criticalInvoices, 0),
      readyRuns: normalizedRuns.filter((run) => run.status === "ready").length,
      duplicateAssignments: 0
    },
    runs: normalizedRuns,
    risks,
    focusRun:
      normalizedRuns
        .slice()
        .sort((left, right) => {
          if (left.status === "blocked" && right.status !== "blocked") return -1;
          if (left.status !== "blocked" && right.status === "blocked") return 1;
          if (left.criticalInvoices !== right.criticalInvoices) return right.criticalInvoices - left.criticalInvoices;
          return left.scheduledDate.localeCompare(right.scheduledDate);
        })[0] ?? null,
    eligibleInvoices,
    unavailableInvoices
  };
}

export function getDemoProjectsOverview(companyId: string): ProjectPortfolioOverviewContract {
  const projects = readStorage(getProjectStorageKey(companyId), () => createProjectSeed(companyId));
  const risks = readStorage(getProjectRiskStorageKey(companyId), () => createProjectRiskSeed(companyId));
  return buildProjectsOverview(projects, risks);
}

export function createDemoProjectPortfolioItem(
  companyId: string,
  input: CreateProjectPortfolioItemRequestContract
): ProjectPortfolioItemContract {
  const projectsKey = getProjectStorageKey(companyId);
  const projects = readStorage(projectsKey, () => createProjectSeed(companyId));
  const created: ProjectPortfolioItemContract = {
    id: `prj_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    client: input.client.trim(),
    segment: input.segment.trim(),
    status: input.status,
    stage: input.stage.trim(),
    progress: input.progress,
    scheduleVarianceDays: input.scheduleVarianceDays,
    budgetHealth: input.budgetHealth,
    qualityHolds: input.qualityHolds,
    permitBlockers: input.permitBlockers,
    activeFronts: input.activeFronts,
    latestDailyLogStatus: "unknown",
    latestDailyLogDate: null,
    qualityReleaseReadiness: input.status === "closed" ? 100 : 82,
    subcontractHealth: input.status === "at_risk" || input.status === "blocked" ? "watch" : "unknown",
    pendingDestajo: 0,
    updatedAt: nowIso(),
    nextMilestone: input.nextMilestone.trim()
  };

  writeStorage(projectsKey, [created, ...projects]);
  return created;
}

export function updateDemoProjectPortfolioItem(
  companyId: string,
  projectId: string,
  input: UpdateProjectPortfolioItemRequestContract
): ProjectPortfolioItemContract | null {
  const projectsKey = getProjectStorageKey(companyId);
  const projects = readStorage(projectsKey, () => createProjectSeed(companyId));
  const currentProject = projects.find((project) => project.id === projectId);
  if (!currentProject) {
    return null;
  }

  const updated: ProjectPortfolioItemContract = {
    ...currentProject,
    status: input.status,
    nextMilestone: input.nextMilestone.trim(),
    updatedAt: nowIso(),
    subcontractHealth:
      input.status === "closed" ? "controlled" : input.status === "blocked" ? "critical" : currentProject.subcontractHealth
  };

  writeStorage(
    projectsKey,
    projects.map((project) => (project.id === projectId ? updated : project))
  );

  return updated;
}

export function getDemoProjectScheduleOverview(
  companyId: string,
  projectId: string
): ProjectScheduleOverviewContract | null {
  const projects = readStorage(getProjectStorageKey(companyId), () => createProjectSeed(companyId));
  const project = projects.find((candidate) => candidate.id === projectId);
  if (!project) {
    return null;
  }

  const activities = readStorage(getProjectScheduleStorageKey(companyId, projectId), () =>
    createProjectScheduleSeed(companyId, projectId)
  );
  return buildProjectScheduleOverview(project, activities);
}

export function createDemoProjectScheduleActivity(
  companyId: string,
  projectId: string,
  input: CreateProjectScheduleActivityRequestContract
): ProjectScheduleActivityContract | null {
  const overview = getDemoProjectScheduleOverview(companyId, projectId);
  if (!overview) {
    return null;
  }

  const activitiesKey = getProjectScheduleStorageKey(companyId, projectId);
  const activities = readStorage(activitiesKey, () => createProjectScheduleSeed(companyId, projectId));
  const created: ProjectScheduleActivityContract = {
    id: `sch_${crypto.randomUUID()}`,
    companyId,
    projectId,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    phase: input.phase.trim(),
    status: "not_started",
    plannedStart: input.plannedStart,
    plannedFinish: input.plannedFinish,
    actualStart: null,
    actualFinish: null,
    progressPercent: 0,
    predecessorIds: [...new Set(input.predecessorIds)],
    owner: input.owner.trim(),
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(activitiesKey, [created, ...activities]);
  return created;
}

export function importDemoProjectScheduleActivities(
  companyId: string,
  projectId: string,
  input: ImportProjectScheduleActivitiesRequestContract
): ImportProjectScheduleActivitiesResponseContract | null {
  const overview = getDemoProjectScheduleOverview(companyId, projectId);
  if (!overview) {
    return null;
  }

  const existingActivities = overview.activities;
  const existingCodeMap = new Map(existingActivities.map((activity) => [activity.code.toUpperCase(), activity]));
  const importedCodeSet = new Set<string>();
  const createdCodes: string[] = [];
  let linkedToExistingCount = 0;
  let linkedWithinImportCount = 0;

  input.activities.forEach((activity) => {
    const normalizedCode = activity.code.trim().toUpperCase();
    if (existingCodeMap.has(normalizedCode) || importedCodeSet.has(normalizedCode)) {
      throw new Error(`Duplicate schedule code in demo import: ${normalizedCode}`);
    }

    importedCodeSet.add(normalizedCode);
  });

  const createdByCode = new Map<string, ProjectScheduleActivityContract>();
  const pending = input.activities.map((activity) => ({
    ...activity,
    code: activity.code.trim().toUpperCase(),
    predecessorCodes: [...new Set(activity.predecessorCodes.map((code) => code.trim().toUpperCase()).filter(Boolean))]
  }));

  while (pending.length > 0) {
    const ready = pending.filter((activity) =>
      activity.predecessorCodes.every((code) => existingCodeMap.has(code) || createdByCode.has(code))
    );

    if (ready.length === 0) {
      throw new Error("Demo project schedule import has unresolved or circular dependencies.");
    }

    ready.forEach((activity) => {
      const predecessorIds = activity.predecessorCodes.flatMap((code) => {
        const existing = existingCodeMap.get(code);
        if (existing) {
          linkedToExistingCount += 1;
          return [existing.id];
        }

        const created = createdByCode.get(code);
        if (created) {
          linkedWithinImportCount += 1;
          return [created.id];
        }

        return [];
      });

      const created = createDemoProjectScheduleActivity(companyId, projectId, {
        code: activity.code,
        name: activity.name,
        phase: activity.phase,
        plannedStart: activity.plannedStart,
        plannedFinish: activity.plannedFinish,
        predecessorIds,
        owner: activity.owner,
        nextAction: activity.nextAction
      });

      if (!created) {
        throw new Error(`Demo project schedule activity could not be created: ${activity.code}`);
      }

      createdByCode.set(activity.code, created);
      createdCodes.push(activity.code);
    });

    const readyCodes = new Set(ready.map((activity) => activity.code));
    for (let index = pending.length - 1; index >= 0; index -= 1) {
      if (readyCodes.has(pending[index].code)) {
        pending.splice(index, 1);
      }
    }
  }

  return {
    createdCount: createdCodes.length,
    linkedToExistingCount,
    linkedWithinImportCount,
    createdCodes
  };
}

export function updateDemoProjectScheduleActivity(
  companyId: string,
  projectId: string,
  activityId: string,
  input: UpdateProjectScheduleActivityRequestContract
): ProjectScheduleActivityContract | null {
  const activitiesKey = getProjectScheduleStorageKey(companyId, projectId);
  const activities = readStorage(activitiesKey, () => createProjectScheduleSeed(companyId, projectId));
  const current = activities.find((activity) => activity.id === activityId);
  if (!current) {
    return null;
  }

  const updated: ProjectScheduleActivityContract = {
    ...current,
    ...input,
    predecessorIds: [...new Set(input.predecessorIds)],
    owner: input.owner.trim(),
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    activitiesKey,
    activities.map((activity) => (activity.id === activityId ? updated : activity))
  );

  return updated;
}

export function getDemoEquipmentOverview(companyId: string): EquipmentOverviewContract {
  const machines = readStorage(getEquipmentStorageKey(companyId), () => createEquipmentSeed(companyId));
  const risks = readStorage(getEquipmentRiskStorageKey(companyId), () => createEquipmentRiskSeed(companyId));
  return buildEquipmentOverview(machines, risks);
}

export function getDemoDailyLogOverview(companyId: string): DailyLogOverviewContract {
  const entries = readStorage(getDailyLogStorageKey(companyId), () => createDailyLogSeed(companyId));
  const risks = readStorage(getDailyLogRiskStorageKey(companyId), () => createDailyLogRiskSeed(companyId));
  return buildDailyLogOverview(entries, risks);
}

export function getDemoProcurementOverview(companyId: string): ProcurementOverviewContract {
  const packages = readStorage(getProcurementStorageKey(companyId), () => createProcurementSeed(companyId));
  const risks = readStorage(getProcurementRiskStorageKey(companyId), () => createProcurementRiskSeed(companyId));
  return buildProcurementOverview(packages, risks);
}

export function getDemoDocumentControlOverview(companyId: string): DocumentControlOverviewContract {
  const items = readStorage(getDocumentControlStorageKey(companyId), () => createDocumentControlSeed(companyId));
  const risks = readStorage(getDocumentControlRiskStorageKey(companyId), () => createDocumentControlRiskSeed(companyId));
  return buildDocumentControlOverview(items, risks);
}

export function getDemoQualityOverview(companyId: string): QualityOverviewContract {
  const inspectionsBoard = readStorage(getQualityStorageKey(companyId), () => createQualitySeed(companyId));
  const risks = readStorage(getQualityRiskStorageKey(companyId), () => createQualityRiskSeed(companyId));
  return buildQualityOverview(inspectionsBoard, risks);
}

export function getDemoHrOverview(companyId: string): HrOverviewContract {
  const workforces = readStorage(getHrStorageKey(companyId), () => createHrSeed(companyId));
  const risks = readStorage(getHrRiskStorageKey(companyId), () => createHrRiskSeed(companyId));
  const focusWorkforce =
    workforces
      .slice()
      .sort((left, right) => {
        if (left.safetyStatus === "critical" && right.safetyStatus !== "critical") {
          return -1;
        }
        if (left.safetyStatus !== "critical" && right.safetyStatus === "critical") {
          return 1;
        }
        return left.attendanceRate - right.attendanceRate;
      })[0] ?? null;

  return {
    summary: {
      activeHeadcount: workforces.reduce((sum, item) => sum + item.activeHeadcount, 0),
      activeContractors: workforces.length,
      attendanceRate:
        workforces.length > 0
          ? Number((workforces.reduce((sum, item) => sum + item.attendanceRate, 0) / workforces.length).toFixed(1))
          : 0,
      openIncidents: workforces.reduce((sum, item) => sum + item.incidentCount, 0)
    },
    workforces,
    risks,
    focusWorkforce
  };
}

export function getDemoSubcontractOverview(companyId: string): SubcontractOverviewContract {
  const lines = readStorage(getSubcontractStorageKey(companyId), () => createSubcontractSeed(companyId));
  const risks = readStorage(getSubcontractRiskStorageKey(companyId), () => createSubcontractRiskSeed(companyId));
  const focusLine =
    lines
      .slice()
      .sort((left, right) => {
        if (left.subcontractHealth === "critical" && right.subcontractHealth !== "critical") {
          return -1;
        }
        if (left.subcontractHealth !== "critical" && right.subcontractHealth === "critical") {
          return 1;
        }
        return right.pendingDestajo - left.pendingDestajo;
      })[0] ?? null;

  return {
    summary: {
      activeSubcontracts: lines.length,
      contractedAmount: lines.reduce((sum, item) => sum + item.contractAmount, 0),
      earnedAmount: lines.reduce((sum, item) => sum + item.earnedAmount, 0),
      paidAmount: lines.reduce((sum, item) => sum + item.paidAmount, 0),
      pendingDestajo: lines.reduce((sum, item) => sum + item.pendingDestajo, 0),
      criticalSubcontracts: lines.filter((item) => item.subcontractHealth === "critical").length,
      executionRiskSubcontracts: lines.filter(
        (item) => item.latestDailyLogStatus === "flagged" || item.qualityReleaseReadiness < 75 || item.subcontractHealth === "critical"
      ).length
    },
    lines,
    risks,
    focusLine
  };
}

export function getDemoSupplierControlOverview(companyId: string): SupplierControlOverviewContract {
  const lines = readStorage(getSupplierControlStorageKey(companyId), () => createSupplierControlSeed(companyId));
  const risks = readStorage(getSupplierControlRiskStorageKey(companyId), () => createSupplierControlRiskSeed(companyId));
  return buildSupplierControlOverview(lines, risks);
}

export function getDemoSupplierMasterOverview(companyId: string): SupplierMasterOverviewContract {
  const items = readStorage(getSupplierMasterStorageKey(companyId), () => createSupplierMasterSeed(companyId));
  const risks = readStorage(getSupplierMasterRiskStorageKey(companyId), () => createSupplierMasterRiskSeed(companyId));
  return buildSupplierMasterOverview(items, risks);
}

export function getDemoProcurementPurchaseOrdersOverview(companyId: string): ProcurementPurchaseOrdersOverviewContract {
  const purchaseOrders = readStorage(getProcurementPurchaseOrderStorageKey(companyId), () => createProcurementPurchaseOrderSeed(companyId));
  const risks = readStorage(getProcurementPurchaseOrderRiskStorageKey(companyId), () => createProcurementPurchaseOrderRiskSeed(companyId));
  return buildProcurementPurchaseOrdersOverview(purchaseOrders, risks);
}

export function getDemoFieldMaterialRequestsOverview(companyId: string): FieldMaterialRequestOverviewContract {
  const requests = readStorage(getFieldMaterialRequestStorageKey(companyId), () => createFieldMaterialRequestSeed(companyId));
  return buildFieldMaterialRequestOverview(requests);
}

export function getDemoProcurementRequisitionsOverview(companyId: string): ProcurementRequisitionsOverviewContract {
  const requisitions = readStorage(getProcurementRequisitionStorageKey(companyId), () => createProcurementRequisitionSeed(companyId));
  const risks = readStorage(getProcurementRequisitionRiskStorageKey(companyId), () => createProcurementRequisitionRiskSeed(companyId));
  const origins = readStorage(getProcurementRequisitionOriginStorageKey(companyId), () => createProcurementRequisitionOriginSeed(companyId));
  return buildProcurementRequisitionsOverview(requisitions, risks, origins);
}

export function getDemoInventoryReceivingOverview(companyId: string): InventoryReceivingOverviewContract {
  const receipts = readStorage(getInventoryReceiptStorageKey(companyId), () => createInventoryReceiptSeed(companyId));
  const risks = readStorage(getInventoryReceiptRiskStorageKey(companyId), () => createInventoryReceiptRiskSeed(companyId));
  return buildInventoryReceivingOverview(receipts, risks);
}

export function getDemoInventoryMovementsOverview(companyId: string): InventoryMovementsOverviewContract {
  const movements = readStorage(getInventoryMovementStorageKey(companyId), () => createInventoryMovementSeed(companyId));
  const risks = readStorage(getInventoryMovementRiskStorageKey(companyId), () => createInventoryMovementRiskSeed(companyId));
  return buildInventoryMovementsOverview(movements, risks);
}

export function getDemoAccountsPayableOverview(companyId: string): AccountsPayableOverviewContract {
  const invoices = readStorage(getAccountsPayableStorageKey(companyId), () => createAccountsPayableSeed(companyId));
  const risks = readStorage(getAccountsPayableRiskStorageKey(companyId), () => createAccountsPayableRiskSeed(companyId));
  return buildAccountsPayableOverview(invoices, risks);
}

export function getDemoTreasuryPaymentRunsOverview(companyId: string): TreasuryPaymentRunsOverviewContract {
  const runs = readStorage(getTreasuryPaymentRunStorageKey(companyId), () => createTreasuryPaymentRunSeed(companyId));
  const risks = readStorage(getTreasuryPaymentRunRiskStorageKey(companyId), () => createTreasuryPaymentRunRiskSeed(companyId));
  return buildTreasuryPaymentRunsOverview(companyId, runs, risks);
}

export function getDemoCashFlowOverview(companyId: string): CashFlowOverviewContract {
  const lines = readStorage(getCashFlowStorageKey(companyId), () => createCashFlowSeed(companyId));
  const risks = readStorage(getCashFlowRiskStorageKey(companyId), () => createCashFlowRiskSeed(companyId));
  return buildCashFlowOverview(lines, risks);
}

export function getDemoCloseControlOverview(companyId: string): CloseControlOverviewContract {
  const lines = readStorage(getCloseControlStorageKey(companyId), () => createCloseControlSeed(companyId));
  const risks = readStorage(getCloseControlRiskStorageKey(companyId), () => createCloseControlRiskSeed(companyId));
  return buildCloseControlOverview(lines, risks);
}

export function getDemoFinanceOverview(companyId: string): FinanceOverviewContract {
  const items = readStorage(getFinanceStorageKey(companyId), () => createFinanceSeed(companyId));
  const risks = readStorage(getFinanceRiskStorageKey(companyId), () => createFinanceRiskSeed(companyId));
  return buildFinanceOverview(items, risks);
}

export function getDemoBudgetBookOverview(companyId: string): BudgetBookOverviewContract {
  const lines = readStorage(getBudgetBookStorageKey(companyId), () => createBudgetBookSeed(companyId));
  const risks = readStorage(getBudgetBookRiskStorageKey(companyId), () => createBudgetBookRiskSeed(companyId));
  return buildBudgetBookOverview(lines, risks);
}

export function getDemoEstimationCollectionOverview(companyId: string): EstimationCollectionOverviewContract {
  const lines = readStorage(getEstimationStorageKey(companyId), () => createEstimationSeed(companyId));
  const exceptions = readStorage(getEstimationExceptionStorageKey(companyId), () => createEstimationExceptionSeed(companyId));
  return buildEstimationOverview(lines, exceptions);
}

export function getDemoCostControlOverview(companyId: string): CostControlOverviewContract {
  const lines = readStorage(getCostControlStorageKey(companyId), () => createCostControlSeed(companyId));
  const exceptions = readStorage(getCostControlExceptionStorageKey(companyId), () => createCostControlExceptionSeed(companyId));
  return buildCostControlOverview(lines, exceptions);
}

export function getDemoComplianceOverview(companyId: string): ComplianceOverviewContract {
  const cases = readStorage(getComplianceStorageKey(companyId), () => createComplianceSeed(companyId));
  const risks = readStorage(getComplianceRiskStorageKey(companyId), () => createComplianceRiskSeed(companyId));
  return buildComplianceOverview(cases, risks);
}

export function getDemoCrmOverview(companyId: string): CrmOverviewContract {
  const leadBuckets = readStorage(getCrmStorageKey(companyId), () => createCrmSeed(companyId));
  const risks = readStorage(getCrmRiskStorageKey(companyId), () => createCrmRiskSeed(companyId));
  return buildCrmOverview(leadBuckets, risks);
}

export function getDemoPostSaleOverview(companyId: string): PostSaleOverviewContract {
  const items = readStorage(getPostSaleStorageKey(companyId), () => createPostSaleSeed(companyId));
  const risks = readStorage(getPostSaleRiskStorageKey(companyId), () => createPostSaleRiskSeed(companyId));
  return buildPostSaleOverview(items, risks);
}

export function createDemoMachineItem(
  companyId: string,
  input: CreateMachineItemRequestContract
): MachineItemContract {
  const machinesKey = getEquipmentStorageKey(companyId);
  const machines = readStorage(machinesKey, () => createEquipmentSeed(companyId));
  const created: MachineItemContract = {
    id: `eq_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `EQ-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    machineName: input.machineName.trim(),
    machineType: input.machineType.trim(),
    projectName: input.projectName.trim(),
    frontName: input.frontName.trim(),
    status: input.status,
    health: input.health,
    availabilityPercent: input.availabilityPercent,
    utilizationPercent: input.utilizationPercent,
    hourMeter: input.hourMeter,
    nextMaintenanceHours: input.nextMaintenanceHours,
    maintenanceDueDate: new Date(Date.now() + Math.max(input.nextMaintenanceHours, 1) * 60 * 60 * 1000).toISOString(),
    maintenanceBacklog: input.maintenanceBacklog,
    openFailures: input.openFailures,
    criticalOpenFailures: input.criticalOpenFailures,
    lastServiceAt: nowIso(),
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(machinesKey, [created, ...machines]);
  return created;
}

export function updateDemoMachineItem(
  companyId: string,
  machineId: string,
  input: UpdateMachineItemRequestContract
): MachineItemContract | null {
  const machinesKey = getEquipmentStorageKey(companyId);
  const machines = readStorage(machinesKey, () => createEquipmentSeed(companyId));
  const currentMachine = machines.find((machine) => machine.id === machineId);
  if (!currentMachine) {
    return null;
  }

  const updated: MachineItemContract = {
    ...currentMachine,
    status: input.status,
    health: input.health,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    machinesKey,
    machines.map((machine) => (machine.id === machineId ? updated : machine))
  );

  return updated;
}

export function createDemoDailyLogEntry(
  companyId: string,
  input: CreateDailyLogEntryRequestContract
): DailyLogEntryContract {
  const entriesKey = getDailyLogStorageKey(companyId);
  const entries = readStorage(entriesKey, () => createDailyLogSeed(companyId));
  const created: DailyLogEntryContract = {
    id: `dlg_${companyId}_${crypto.randomUUID()}`,
    companyId,
    projectName: input.projectName.trim(),
    frontName: input.frontName.trim(),
    supervisor: input.supervisor.trim(),
    logDate: input.logDate,
    shift: input.shift,
    weather: input.weather,
    status: input.status,
    progressPercent: input.progressPercent,
    workforceCount: input.workforceCount,
    incidentsCount: input.incidentsCount,
    blockersCount: input.blockersCount,
    evidenceCount: input.evidenceCount,
    concretePourM3: input.concretePourM3,
    projectStatus: input.blockersCount > 0 ? "at_risk" : "active",
    qualityOpenFindings: input.blockersCount > 0 ? 2 : 0,
    qualityReleaseReadiness: input.blockersCount > 0 ? 72 : 92,
    subcontractHealth: input.blockersCount > 0 ? "watch" : "controlled",
    pendingDestajo: 0,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(entriesKey, [created, ...entries]);
  return created;
}

export function updateDemoDailyLogEntry(
  companyId: string,
  entryId: string,
  input: UpdateDailyLogEntryRequestContract
): DailyLogEntryContract | null {
  const entriesKey = getDailyLogStorageKey(companyId);
  const entries = readStorage(entriesKey, () => createDailyLogSeed(companyId));
  const currentEntry = entries.find((entry) => entry.id === entryId);
  if (!currentEntry) {
    return null;
  }

  const updated: DailyLogEntryContract = {
    ...currentEntry,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    entriesKey,
    entries.map((entry) => (entry.id === entryId ? updated : entry))
  );

  return updated;
}

export function updateDemoProcurementPackage(
  companyId: string,
  packageId: string,
  input: UpdateProcurementPackageRequestContract
): ProcurementPackageContract | null {
  const key = getProcurementStorageKey(companyId);
  const packages = readStorage(key, () => createProcurementSeed(companyId));
  const current = packages.find((item) => item.id === packageId);
  if (!current) {
    return null;
  }

  const updated: ProcurementPackageContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    key,
    packages.map((item) => (item.id === packageId ? updated : item))
  );

  return updated;
}

export function createDemoDocumentControlItem(
  companyId: string,
  input: CreateDocumentControlItemRequestContract
): DocumentControlItemContract {
  const itemsKey = getDocumentControlStorageKey(companyId);
  const items = readStorage(itemsKey, () => createDocumentControlSeed(companyId));
  const created: DocumentControlItemContract = {
    id: `doc_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `${input.documentType.slice(0, 3).toUpperCase()}-${Math.random().toString().slice(2, 5)}`,
    documentType: input.documentType.trim(),
    subject: input.subject.trim(),
    projectName: input.projectName.trim(),
    owner: input.owner.trim(),
    status: input.status,
    revisionCount: input.revisionCount,
    turnaroundDays: input.turnaroundDays,
    openComments: input.openComments,
    health: input.health,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(itemsKey, [created, ...items]);
  return created;
}

export function updateDemoDocumentControlItem(
  companyId: string,
  itemId: string,
  input: UpdateDocumentControlItemRequestContract
): DocumentControlItemContract | null {
  const itemsKey = getDocumentControlStorageKey(companyId);
  const items = readStorage(itemsKey, () => createDocumentControlSeed(companyId));
  const currentItem = items.find((item) => item.id === itemId);
  if (!currentItem) {
    return null;
  }

  const updated: DocumentControlItemContract = {
    ...currentItem,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    itemsKey,
    items.map((item) => (item.id === itemId ? updated : item))
  );

  return updated;
}

export function updateDemoQualityInspection(
  companyId: string,
  inspectionId: string,
  input: UpdateQualityInspectionRequestContract
): QualityInspectionContract | null {
  const key = getQualityStorageKey(companyId);
  const inspectionsBoard = readStorage(key, () => createQualitySeed(companyId));
  const current = inspectionsBoard.find((item) => item.id === inspectionId);
  if (!current) {
    return null;
  }

  const updated: QualityInspectionContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    key,
    inspectionsBoard.map((item) => (item.id === inspectionId ? updated : item))
  );

  return updated;
}

export function updateDemoHrWorkforceItem(
  companyId: string,
  workforceId: string,
  input: UpdateHrWorkforceItemRequestContract
): HrWorkforceItemContract | null {
  const key = getHrStorageKey(companyId);
  const workforces = readStorage(key, () => createHrSeed(companyId));
  const current = workforces.find((item) => item.id === workforceId);
  if (!current) {
    return null;
  }

  const updated: HrWorkforceItemContract = {
    ...current,
    safetyStatus: input.safetyStatus,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    key,
    workforces.map((item) => (item.id === workforceId ? updated : item))
  );

  return updated;
}

export function createDemoSubcontractLine(
  companyId: string,
  input: CreateSubcontractLineRequestContract
): SubcontractLineContract {
  const key = getSubcontractStorageKey(companyId);
  const lines = readStorage(key, () => createSubcontractSeed(companyId));
  const projects = readStorage(getProjectStorageKey(companyId), () => createProjectSeed(companyId));
  const normalizedProjectName = input.projectName.trim();
  const normalizedFrontName = input.frontName.trim();
  const normalizedCode = input.code.trim().toUpperCase();
  const project =
    projects.find((item) => item.name.trim().toLowerCase() === normalizedProjectName.toLowerCase()) ??
    projects.find(
      (item) =>
        item.name.trim().toLowerCase().includes(normalizedProjectName.toLowerCase()) ||
        normalizedProjectName.toLowerCase().includes(item.name.trim().toLowerCase())
    ) ??
    null;
  const frontName =
    normalizedFrontName.toLowerCase().includes(normalizedProjectName.toLowerCase())
      ? normalizedFrontName
      : `${normalizedProjectName} · ${normalizedFrontName}`;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const qualityReleaseReadiness = project?.qualityReleaseReadiness ?? clamp(
    (input.subcontractHealth === "controlled" ? 90 : input.subcontractHealth === "watch" ? 82 : 72) -
      input.complianceExpirations * 3 -
      input.incidentCount * 5,
    40,
    100
  );
  const progressPercent = project?.progress ?? clamp(
    Math.round(input.productivityRate + (input.subcontractHealth === "controlled" ? 4 : input.subcontractHealth === "watch" ? 1 : -4)),
    20,
    100
  );
  const progressGap = Number((progressPercent - input.productivityRate).toFixed(1));
  const contractAmount = Math.round(
    input.activeHeadcount * 185000 + input.productivityRate * 12000 + (project?.activeFronts ?? 1) * 210000
  );
  const earnedAmount = Math.round(
    contractAmount * clamp(progressPercent / 100 - input.complianceExpirations * 0.02, 0.15, 1)
  );
  const invoicedAmount = Math.round(
    earnedAmount * clamp(input.attendanceRate / 100 + input.productivityRate / 250, 0.35, 0.96)
  );
  const paidAmount = Math.round(
    invoicedAmount * clamp(1 - input.incidentCount * 0.08 - input.complianceExpirations * 0.05, 0.42, 0.95)
  );
  const retentionAmount = Math.round(invoicedAmount * 0.1);
  const latestDailyLogStatus =
    input.subcontractHealth === "critical" || input.incidentCount > 0
      ? "flagged"
      : input.subcontractHealth === "watch"
        ? "submitted"
        : "approved";
  const line: SubcontractLineContract = {
    id: `sub_demo_${Date.now()}_${lines.length + 1}`,
    workforceId: `wf_demo_${Date.now()}_${lines.length + 1}`,
    companyId,
    projectId: project?.id ?? null,
    code: normalizedCode,
    contractorName: input.contractorName.trim(),
    frontName,
    projectName: project?.name ?? normalizedProjectName,
    projectStatus: project?.status ?? (input.subcontractHealth === "critical" ? "at_risk" : "active"),
    subcontractHealth: input.subcontractHealth,
    latestDailyLogStatus,
    qualityReleaseReadiness,
    contractAmount,
    earnedAmount,
    invoicedAmount,
    paidAmount,
    retentionAmount,
    pendingDestajo: Math.max(invoicedAmount - paidAmount, 0),
    productivityRate: input.productivityRate,
    attendanceRate: input.attendanceRate,
    complianceExpirations: input.complianceExpirations,
    incidentCount: input.incidentCount,
    activeHeadcount: input.activeHeadcount,
    progressPercent,
    progressGap,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(key, [line, ...lines]);

  return line;
}

export function updateDemoSubcontractLine(
  companyId: string,
  lineId: string,
  input: UpdateSubcontractLineRequestContract
): SubcontractLineContract | null {
  const key = getSubcontractStorageKey(companyId);
  const lines = readStorage(key, () => createSubcontractSeed(companyId));
  const current = lines.find((line) => line.id === lineId);
  if (!current) {
    return null;
  }

  const updated: SubcontractLineContract = {
    ...current,
    subcontractHealth: input.subcontractHealth,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    key,
    lines.map((line) => (line.id === lineId ? updated : line))
  );

  return updated;
}

export function createDemoQualityInspection(
  companyId: string,
  input: CreateQualityInspectionRequestContract
): QualityInspectionContract {
  const key = getQualityStorageKey(companyId);
  const inspectionsBoard = readStorage(key, () => createQualitySeed(companyId));
  const [projectName, frontName] = input.areaName.split(" · ");
  const created: QualityInspectionContract = {
    id: `qli_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `QLT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    projectName: projectName?.trim() || "Proyecto central",
    areaName: frontName?.trim() || input.areaName.trim(),
    checklistName: input.checklistName.trim(),
    contractorName: input.contractorName.trim(),
    severity: input.severity,
    openFindings: input.openFindings,
    evidenceCompletion: input.evidenceCompletion,
    releaseReadiness: input.releaseReadiness,
    reworkRate: input.reworkRate,
    status: input.status,
    nextAction: input.nextAction.trim(),
    latestDailyLogStatus: input.status === "blocked" ? "flagged" : "submitted",
    projectStatus: input.status === "blocked" ? "at_risk" : "active",
    updatedAt: nowIso()
  };

  writeStorage(key, [created, ...inspectionsBoard]);
  return created;
}

export function createDemoSupplierControlLine(
  companyId: string,
  input: CreateSupplierControlLineRequestContract
): SupplierControlLineContract {
  const key = getSupplierControlStorageKey(companyId);
  const lines = readStorage(key, () => createSupplierControlSeed(companyId));
  const created: SupplierControlLineContract = {
    id: `supc_${companyId}_${crypto.randomUUID()}`,
    supplierId: `sup_${companyId}_${crypto.randomUUID()}`,
    companyId,
    supplierName: input.supplierName.trim(),
    owner: input.owner.trim(),
    awardedPackages: input.awardedPackages,
    activePackages: input.activePackages,
    contractedAmount: input.contractedAmount,
    concentrationPercent: input.concentrationPercent,
    bidCoverage: input.bidCoverage,
    deliveryHealth: input.deliveryHealth,
    approvalPressureHours: input.approvalPressureHours,
    complianceAlerts: input.complianceAlerts,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(key, [created, ...lines]);
  return created;
}

export function updateDemoSupplierControlLine(
  companyId: string,
  lineId: string,
  input: UpdateSupplierControlLineRequestContract
): SupplierControlLineContract | null {
  const key = getSupplierControlStorageKey(companyId);
  const lines = readStorage(key, () => createSupplierControlSeed(companyId));
  const current = lines.find((line) => line.id === lineId);
  if (!current) {
    return null;
  }

  const updated: SupplierControlLineContract = {
    ...current,
    deliveryHealth: input.deliveryHealth,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    lines.map((line) => (line.id === lineId ? updated : line))
  );
  return updated;
}

export function createDemoSupplierMasterProfile(
  companyId: string,
  input: CreateSupplierMasterProfileRequestContract
): SupplierMasterProfileContract {
  const key = getSupplierMasterStorageKey(companyId);
  const items = readStorage(key, () => createSupplierMasterSeed(companyId));
  const created: SupplierMasterProfileContract = {
    id: `supm_${companyId}_${crypto.randomUUID()}`,
    supplierId: `sup_${companyId}_${crypto.randomUUID()}`,
    companyId,
    supplierName: input.supplierName.trim(),
    tradeName: input.tradeName.trim(),
    rfc: input.rfc.trim().toUpperCase(),
    fiscalRegime: input.fiscalRegime.trim(),
    cfdiUse: input.cfdiUse.trim(),
    paymentMethod: input.paymentMethod.trim(),
    paymentTermsDays: input.paymentTermsDays,
    bankAccountMasked: input.bankAccountMasked.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim(),
    contactPhone: input.contactPhone.trim(),
    complianceStatus: input.complianceStatus,
    satStatus: input.satStatus,
    fiscalPacketCompletion: input.fiscalPacketCompletion,
    lastValidatedAt: input.fiscalPacketCompletion >= 100 ? nowIso() : null,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(key, [created, ...items]);
  return created;
}

export function updateDemoSupplierMasterProfile(
  companyId: string,
  profileId: string,
  input: UpdateSupplierMasterProfileRequestContract
): SupplierMasterProfileContract | null {
  const key = getSupplierMasterStorageKey(companyId);
  const items = readStorage(key, () => createSupplierMasterSeed(companyId));
  const current = items.find((item) => item.id === profileId);
  if (!current) {
    return null;
  }

  const updated: SupplierMasterProfileContract = {
    ...current,
    complianceStatus: input.complianceStatus,
    satStatus: input.satStatus,
    fiscalPacketCompletion: input.fiscalPacketCompletion,
    lastValidatedAt: input.fiscalPacketCompletion >= 100 ? nowIso() : current.lastValidatedAt,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    items.map((item) => (item.id === profileId ? updated : item))
  );
  return updated;
}

export function createDemoAccountsPayableInvoice(
  companyId: string,
  input: CreateAccountsPayableInvoiceRequestContract
): AccountsPayableInvoiceContract {
  const key = getAccountsPayableStorageKey(companyId);
  const invoices = readStorage(key, () => createAccountsPayableSeed(companyId));
  const created: AccountsPayableInvoiceContract = {
    id: `ap_${companyId}_${crypto.randomUUID()}`,
    companyId,
    supplierProfileId: input.supplierProfileId ?? null,
    supplierName: input.supplierName.trim(),
    code: `AP-${String(invoices.length + 2401).padStart(4, "0")}`,
    invoiceNumber: input.invoiceNumber.trim(),
    invoiceUuid: input.invoiceUuid.trim().toUpperCase(),
    projectName: input.projectName.trim(),
    purchaseOrderCode: input.purchaseOrderCode ?? null,
    receiptCode: input.receiptCode ?? null,
    status: input.status,
    satStatus: input.satStatus,
    complementStatus: input.complementStatus,
    receiptEvidenceStatus: input.receiptEvidenceStatus,
    paymentMethod: input.paymentMethod.trim(),
    dueDate: input.dueDate,
    scheduledPaymentDate: input.scheduledPaymentDate ?? null,
    receivedAt: nowIso(),
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    pendingAmount: input.status === "paid" ? 0 : input.total,
    packetCompletion: input.packetCompletion,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(key, [created, ...invoices]);
  return created;
}

export function updateDemoAccountsPayableInvoice(
  companyId: string,
  invoiceId: string,
  input: UpdateAccountsPayableInvoiceRequestContract
): AccountsPayableInvoiceContract | null {
  const key = getAccountsPayableStorageKey(companyId);
  const invoices = readStorage(key, () => createAccountsPayableSeed(companyId));
  const current = invoices.find((invoice) => invoice.id === invoiceId);
  if (!current) {
    return null;
  }

  const updated: AccountsPayableInvoiceContract = {
    ...current,
    status: input.status,
    satStatus: input.satStatus,
    complementStatus: input.complementStatus,
    scheduledPaymentDate: input.scheduledPaymentDate,
    pendingAmount: input.status === "paid" ? 0 : current.total,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };

  writeStorage(
    key,
    invoices.map((invoice) => (invoice.id === invoiceId ? updated : invoice))
  );
  return updated;
}

export function createDemoTreasuryPaymentRun(
  companyId: string,
  input: CreateTreasuryPaymentRunRequestContract
): TreasuryPaymentRunContract | null {
  const runKey = getTreasuryPaymentRunStorageKey(companyId);
  const invoiceKey = getAccountsPayableStorageKey(companyId);
  const runs = readStorage(runKey, () => createTreasuryPaymentRunSeed(companyId));
  const invoices = readStorage(invoiceKey, () => createAccountsPayableSeed(companyId));
  const selectedInvoices = invoices.filter((invoice) => input.invoiceIds.includes(invoice.id));
  if (selectedInvoices.length === 0) {
    return null;
  }

  const created = summarizeRun({
    id: `tpr_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `TR-${String(runs.length + 2401).padStart(4, "0")}`,
    bankAccountLabel: input.bankAccountLabel.trim(),
    scheduledDate: input.scheduledDate,
    status: "draft",
    totalInvoices: 0,
    totalAmount: 0,
    criticalInvoices: 0,
    owner: input.owner.trim(),
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso(),
    invoices: selectedInvoices.map((invoice) => toTreasuryInvoice(invoice))
  });

  writeStorage(runKey, [created, ...runs]);
  writeStorage(
    invoiceKey,
    invoices.map((invoice) =>
      input.invoiceIds.includes(invoice.id)
        ? {
            ...invoice,
            status: invoice.status === "matched" ? "scheduled" : invoice.status,
            scheduledPaymentDate: input.scheduledDate,
            updatedAt: nowIso()
          }
        : invoice
    )
  );
  return created;
}

export function updateDemoTreasuryPaymentRun(
  companyId: string,
  paymentRunId: string,
  input: UpdateTreasuryPaymentRunRequestContract
): TreasuryPaymentRunContract | null {
  const key = getTreasuryPaymentRunStorageKey(companyId);
  const runs = readStorage(key, () => createTreasuryPaymentRunSeed(companyId));
  const current = runs.find((run) => run.id === paymentRunId);
  if (!current) {
    return null;
  }

  const updated = summarizeRun({
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  });
  writeStorage(
    key,
    runs.map((run) => (run.id === paymentRunId ? updated : run))
  );
  return updated;
}

export function removeDemoTreasuryPaymentRunInvoice(
  companyId: string,
  paymentRunId: string,
  invoiceId: string,
  nextAction: string
): TreasuryPaymentRunContract | null {
  const runKey = getTreasuryPaymentRunStorageKey(companyId);
  const invoiceKey = getAccountsPayableStorageKey(companyId);
  const runs = readStorage(runKey, () => createTreasuryPaymentRunSeed(companyId));
  const invoices = readStorage(invoiceKey, () => createAccountsPayableSeed(companyId));
  const current = runs.find((run) => run.id === paymentRunId);
  if (!current) {
    return null;
  }

  const updated = summarizeRun({
    ...current,
    status: "draft",
    nextAction: nextAction.trim(),
    updatedAt: nowIso(),
    invoices: current.invoices.filter((invoice) => invoice.invoiceId !== invoiceId)
  });

  writeStorage(
    runKey,
    runs.map((run) => (run.id === paymentRunId ? updated : run))
  );
  writeStorage(
    invoiceKey,
    invoices.map((invoice) =>
      invoice.id === invoiceId
        ? {
            ...invoice,
            status: invoice.status === "paid" ? "paid" : "matched",
            scheduledPaymentDate: null,
            updatedAt: nowIso()
          }
        : invoice
    )
  );
  return updated;
}

export function addDemoTreasuryPaymentRunInvoice(
  companyId: string,
  paymentRunId: string,
  invoiceId: string,
  nextAction: string
): TreasuryPaymentRunContract | null {
  const runKey = getTreasuryPaymentRunStorageKey(companyId);
  const invoiceKey = getAccountsPayableStorageKey(companyId);
  const runs = readStorage(runKey, () => createTreasuryPaymentRunSeed(companyId));
  const invoices = readStorage(invoiceKey, () => createAccountsPayableSeed(companyId));
  const current = runs.find((run) => run.id === paymentRunId);
  const invoice = invoices.find((item) => item.id === invoiceId);
  if (!current || !invoice || current.invoices.some((item) => item.invoiceId === invoiceId)) {
    return null;
  }

  const updated = summarizeRun({
    ...current,
    status: "draft",
    nextAction: nextAction.trim(),
    updatedAt: nowIso(),
    invoices: [...current.invoices, toTreasuryInvoice({ ...invoice, scheduledPaymentDate: current.scheduledDate })]
  });

  writeStorage(
    runKey,
    runs.map((run) => (run.id === paymentRunId ? updated : run))
  );
  writeStorage(
    invoiceKey,
    invoices.map((item) =>
      item.id === invoiceId
        ? {
            ...item,
            status: item.status === "matched" ? "scheduled" : item.status,
            scheduledPaymentDate: current.scheduledDate,
            updatedAt: nowIso()
          }
        : item
    )
  );
  return updated;
}

export function moveDemoTreasuryPaymentRunInvoice(
  companyId: string,
  paymentRunId: string,
  invoiceId: string,
  targetPaymentRunId: string,
  nextAction: string
): TreasuryPaymentRunContract | null {
  const key = getTreasuryPaymentRunStorageKey(companyId);
  const runs = readStorage(key, () => createTreasuryPaymentRunSeed(companyId));
  const source = runs.find((run) => run.id === paymentRunId);
  const target = runs.find((run) => run.id === targetPaymentRunId);
  if (!source || !target) {
    return null;
  }

  const movingInvoice = source.invoices.find((invoice) => invoice.invoiceId === invoiceId);
  if (!movingInvoice || target.invoices.some((invoice) => invoice.invoiceId === invoiceId)) {
    return null;
  }

  const updatedSource = summarizeRun({
    ...source,
    status: "draft",
    nextAction: nextAction.trim(),
    updatedAt: nowIso(),
    invoices: source.invoices.filter((invoice) => invoice.invoiceId !== invoiceId)
  });
  const updatedTarget = summarizeRun({
    ...target,
    status: "draft",
    nextAction: nextAction.trim(),
    updatedAt: nowIso(),
    invoices: [...target.invoices, { ...movingInvoice, scheduledPaymentDate: target.scheduledDate }]
  });

  writeStorage(
    key,
    runs.map((run) => {
      if (run.id === paymentRunId) return updatedSource;
      if (run.id === targetPaymentRunId) return updatedTarget;
      return run;
    })
  );
  return updatedSource;
}

export function updateDemoCashFlowLine(
  companyId: string,
  lineId: string,
  input: UpdateCashFlowLineRequestContract
): CashFlowLineContract | null {
  const key = getCashFlowStorageKey(companyId);
  const lines = readStorage(key, () => createCashFlowSeed(companyId));
  const current = lines.find((line) => line.id === lineId);
  if (!current) {
    return null;
  }

  const updated: CashFlowLineContract = {
    ...current,
    health: input.health,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    lines.map((line) => (line.id === lineId ? updated : line))
  );
  return updated;
}

export function updateDemoCloseControlLine(
  companyId: string,
  lineId: string,
  input: UpdateCloseControlLineRequestContract
): CloseControlLineContract | null {
  const key = getCloseControlStorageKey(companyId);
  const lines = readStorage(key, () => createCloseControlSeed(companyId));
  const current = lines.find((line) => line.id === lineId);
  if (!current) {
    return null;
  }

  const updated: CloseControlLineContract = {
    ...current,
    closeHealth: input.closeHealth,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    lines.map((line) => (line.id === lineId ? updated : line))
  );
  return updated;
}

export function updateDemoFinanceLedgerItem(
  companyId: string,
  ledgerId: string,
  input: UpdateFinanceLedgerItemRequestContract
): FinanceLedgerItemContract | null {
  const key = getFinanceStorageKey(companyId);
  const items = readStorage(key, () => createFinanceSeed(companyId));
  const current = items.find((item) => item.id === ledgerId);
  if (!current) {
    return null;
  }

  const updated: FinanceLedgerItemContract = {
    ...current,
    satStatus: input.satStatus,
    note: input.note.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    items.map((item) => (item.id === ledgerId ? updated : item))
  );
  return updated;
}

export function updateDemoBudgetBookLine(
  companyId: string,
  lineId: string,
  input: UpdateBudgetBookLineRequestContract
): BudgetBookLineContract | null {
  const key = getBudgetBookStorageKey(companyId);
  const lines = readStorage(key, () => createBudgetBookSeed(companyId));
  const current = lines.find((line) => line.id === lineId);
  if (!current) {
    return null;
  }

  const updated: BudgetBookLineContract = {
    ...current,
    procurementStatus: input.procurementStatus,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    lines.map((line) => (line.id === lineId ? updated : line))
  );
  return updated;
}

export function updateDemoEstimationCollectionLine(
  companyId: string,
  lineId: string,
  input: UpdateEstimationCollectionLineRequestContract
): EstimationCollectionLineContract | null {
  const key = getEstimationStorageKey(companyId);
  const lines = readStorage(key, () => createEstimationSeed(companyId));
  const current = lines.find((line) => line.id === lineId);
  if (!current) {
    return null;
  }

  const updated: EstimationCollectionLineContract = {
    ...current,
    collectionHealth: input.collectionHealth,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    lines.map((line) => (line.id === lineId ? updated : line))
  );
  return updated;
}

export function updateDemoCostControlLine(
  companyId: string,
  lineId: string,
  input: UpdateCostControlLineRequestContract
): CostControlLineContract | null {
  const key = getCostControlStorageKey(companyId);
  const lines = readStorage(key, () => createCostControlSeed(companyId));
  const current = lines.find((line) => line.id === lineId);
  if (!current) {
    return null;
  }

  const updated: CostControlLineContract = {
    ...current,
    procurementStatus: input.procurementStatus,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    lines.map((line) => (line.id === lineId ? updated : line))
  );
  return updated;
}

export function updateDemoComplianceCase(
  companyId: string,
  caseId: string,
  input: UpdateComplianceCaseRequestContract
): ComplianceCaseContract | null {
  const key = getComplianceStorageKey(companyId);
  const cases = readStorage(key, () => createComplianceSeed(companyId));
  const current = cases.find((item) => item.id === caseId);
  if (!current) {
    return null;
  }

  const updated: ComplianceCaseContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    cases.map((item) => (item.id === caseId ? updated : item))
  );
  return updated;
}

export function updateDemoCrmLeadBucket(
  companyId: string,
  leadBucketId: string,
  input: UpdateCrmLeadBucketRequestContract
): CrmLeadBucketContract | null {
  const key = getCrmStorageKey(companyId);
  const leadBuckets = readStorage(key, () => createCrmSeed(companyId));
  const current = leadBuckets.find((item) => item.id === leadBucketId);
  if (!current) {
    return null;
  }

  const updated: CrmLeadBucketContract = {
    ...current,
    health: input.health,
    signal: input.signal.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    leadBuckets.map((item) => (item.id === leadBucketId ? updated : item))
  );
  return updated;
}

export function updateDemoPostSaleCase(
  companyId: string,
  caseId: string,
  input: UpdatePostSaleCaseRequestContract
): PostSaleCaseContract | null {
  const key = getPostSaleStorageKey(companyId);
  const items = readStorage(key, () => createPostSaleSeed(companyId));
  const current = items.find((item) => item.id === caseId);
  if (!current) {
    return null;
  }

  const updated: PostSaleCaseContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    items.map((item) => (item.id === caseId ? updated : item))
  );
  return updated;
}

export function createDemoProcurementPurchaseOrder(
  companyId: string,
  input: CreateProcurementPurchaseOrderRequestContract
): ProcurementPurchaseOrderContract {
  const key = getProcurementPurchaseOrderStorageKey(companyId);
  const purchaseOrders = readStorage(key, () => createProcurementPurchaseOrderSeed(companyId));
  const requisitionLookup = {
    foundation: {
      requisitionId: `req_demo_foundation_${companyId}`,
      requisitionCode: "REQ-FLD-001",
      projectName: "Torre Demo",
      category: "Steel / formwork"
    },
    finishes: {
      requisitionId: `req_demo_finishes_${companyId}`,
      requisitionCode: "REQ-FLD-002",
      projectName: "Torre Demo Acabados",
      category: "Finishes"
    }
  };
  const linked =
    input.requisitionId === requisitionLookup.foundation.requisitionId
      ? requisitionLookup.foundation
      : input.requisitionId === requisitionLookup.finishes.requisitionId
        ? requisitionLookup.finishes
        : {
            requisitionId: input.requisitionId,
            requisitionCode: `REQ-${Math.random().toString().slice(2, 6)}`,
            projectName: "Nuevo proyecto",
            category: "Procurement package"
          };

  const created: ProcurementPurchaseOrderContract = {
    id: `po_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `PO-${Math.random().toString().slice(2, 6)}`,
    requisitionCode: linked.requisitionCode,
    projectName: linked.projectName,
    supplierName: input.supplierName.trim(),
    buyer: input.buyer.trim(),
    category: linked.category,
    status: "issued",
    totalAmount: input.totalAmount,
    committedEta: input.committedEta,
    receivedPercent: 0,
    invoiceMatchStatus: "pending",
    logisticsMode: input.logisticsMode.trim(),
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(key, [created, ...purchaseOrders]);
  return created;
}

export function createDemoFieldMaterialRequest(
  companyId: string,
  input: CreateFieldMaterialRequestRequestContract
): CreateFieldMaterialRequestResponseContract {
  const requestKey = getFieldMaterialRequestStorageKey(companyId);
  const requests = readStorage(requestKey, () => createFieldMaterialRequestSeed(companyId));
  const requisitionKey = getProcurementRequisitionStorageKey(companyId);
  const requisitions = readStorage(requisitionKey, () => createProcurementRequisitionSeed(companyId));
  const requisitionId = `req_${companyId}_${crypto.randomUUID()}`;
  const fieldRequest: FieldMaterialRequestContract = {
    id: `fld_${companyId}_${crypto.randomUUID()}`,
    companyId,
    requisitionId,
    projectName: input.projectName.trim(),
    frontName: input.frontName.trim(),
    requestedBy: input.requestedBy.trim(),
    summary: input.summary.trim(),
    detail: input.detail.trim(),
    requestedVolume: input.requestedVolume.trim(),
    urgency: input.urgency,
    nextAction: input.nextAction.trim(),
    status: "converted",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const requisition: ProcurementRequisitionContract = {
    id: requisitionId,
    companyId,
    code: `REQ-${Math.random().toString().slice(2, 6)}`,
    projectName: input.projectName.trim(),
    frontName: input.frontName.trim(),
    requestedBy: input.requestedBy.trim(),
    category: input.category.trim(),
    status: "submitted",
    requestedItems: input.requestedItems,
    budgetAmount: input.budgetAmount,
    urgency: input.urgency,
    approvalHours: input.approvalHours,
    supplierCoverage: input.supplierCoverage,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(requestKey, [{ ...fieldRequest, requisitionId: requisition.id }, ...requests]);
  writeStorage(requisitionKey, [requisition, ...requisitions]);
  return {
    fieldRequest: { ...fieldRequest, requisitionId: requisition.id },
    requisition
  };
}

export function updateDemoProcurementPurchaseOrder(
  companyId: string,
  purchaseOrderId: string,
  input: UpdateProcurementPurchaseOrderRequestContract
): ProcurementPurchaseOrderContract | null {
  const key = getProcurementPurchaseOrderStorageKey(companyId);
  const purchaseOrders = readStorage(key, () => createProcurementPurchaseOrderSeed(companyId));
  const current = purchaseOrders.find((item) => item.id === purchaseOrderId);
  if (!current) {
    return null;
  }

  const statusToReceivedPercent = {
    issued: 0,
    confirmed: 0,
    in_transit: 0,
    partial: Math.max(current.receivedPercent, 60),
    received: 100,
    blocked: current.receivedPercent
  } satisfies Record<ProcurementPurchaseOrderContract["status"], number>;

  const updated: ProcurementPurchaseOrderContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    receivedPercent: statusToReceivedPercent[input.status],
    invoiceMatchStatus:
      input.status === "received"
        ? "matched"
        : input.status === "blocked"
          ? "risk"
          : current.invoiceMatchStatus,
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    purchaseOrders.map((item) => (item.id === purchaseOrderId ? updated : item))
  );
  return updated;
}

export function createDemoProcurementRequisition(
  companyId: string,
  input: CreateProcurementRequisitionRequestContract
): ProcurementRequisitionContract {
  const key = getProcurementRequisitionStorageKey(companyId);
  const requisitions = readStorage(key, () => createProcurementRequisitionSeed(companyId));
  const created: ProcurementRequisitionContract = {
    id: `req_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `REQ-${Math.random().toString().slice(2, 6)}`,
    projectName: input.projectName.trim(),
    frontName: input.frontName.trim(),
    requestedBy: input.requestedBy.trim(),
    category: input.category.trim(),
    status: input.status,
    requestedItems: input.requestedItems,
    budgetAmount: input.budgetAmount,
    urgency: input.urgency,
    approvalHours: input.approvalHours,
    supplierCoverage: input.supplierCoverage,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(key, [created, ...requisitions]);
  return created;
}

export function updateDemoProcurementRequisition(
  companyId: string,
  requisitionId: string,
  input: UpdateProcurementRequisitionRequestContract
): ProcurementRequisitionContract | null {
  const key = getProcurementRequisitionStorageKey(companyId);
  const requisitions = readStorage(key, () => createProcurementRequisitionSeed(companyId));
  const current = requisitions.find((item) => item.id === requisitionId);
  if (!current) {
    return null;
  }

  const updated: ProcurementRequisitionContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    requisitions.map((item) => (item.id === requisitionId ? updated : item))
  );
  return updated;
}

export function createDemoInventoryReceipt(
  companyId: string,
  input: CreateInventoryReceiptRequestContract
): InventoryReceiptContract {
  const key = getInventoryReceiptStorageKey(companyId);
  const receipts = readStorage(key, () => createInventoryReceiptSeed(companyId));
  const varianceUnits = input.orderedUnits - input.receivedUnits;
  const variancePercent = Number(((Math.abs(varianceUnits) / input.orderedUnits) * 100).toFixed(1));
  const created: InventoryReceiptContract = {
    id: `rcv_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `RCV-${Math.random().toString().slice(2, 6)}`,
    supplierName: input.supplierName.trim(),
    destinationName: input.destinationName.trim(),
    destinationType: input.destinationType.trim(),
    purchaseReference: input.purchaseReference.trim().toUpperCase(),
    purchaseOrderOwner: "Receiving coordinator",
    purchaseOrderStatus: input.receivedUnits === 0 ? "confirmed" : input.receivedUnits < input.orderedUnits ? "partial" : "received",
    invoiceMatchStatus: input.pendingEvidence > 0 ? "pending" : "matched",
    etaDate: input.etaDate,
    receivedDate: input.receivedUnits > 0 ? nowIso() : null,
    status: input.receivedUnits >= input.orderedUnits && input.pendingEvidence === 0 && input.rejectedUnits === 0 ? "received" : "draft",
    orderedUnits: input.orderedUnits,
    receivedUnits: input.receivedUnits,
    varianceUnits,
    variancePercent,
    pendingEvidence: input.pendingEvidence,
    rejectedUnits: input.rejectedUnits,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(key, [created, ...receipts]);
  return created;
}

export function updateDemoInventoryReceipt(
  companyId: string,
  receiptId: string,
  input: UpdateInventoryReceiptRequestContract
): InventoryReceiptContract | null {
  const key = getInventoryReceiptStorageKey(companyId);
  const receipts = readStorage(key, () => createInventoryReceiptSeed(companyId));
  const current = receipts.find((receipt) => receipt.id === receiptId);
  if (!current) {
    return null;
  }

  const updated: InventoryReceiptContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    receivedDate: input.status === "received" ? current.receivedDate ?? nowIso() : current.receivedDate,
    purchaseOrderStatus:
      input.status === "received"
        ? "received"
        : input.status === "in_transit"
          ? "in_transit"
          : input.status === "blocked"
            ? "blocked"
            : current.purchaseOrderStatus,
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    receipts.map((receipt) => (receipt.id === receiptId ? updated : receipt))
  );
  return updated;
}

export function createDemoInventoryMovement(
  companyId: string,
  input: CreateInventoryMovementRequestContract
): InventoryMovementContract {
  const key = getInventoryMovementStorageKey(companyId);
  const movements = readStorage(key, () => createInventoryMovementSeed(companyId));
  const varianceUnits = input.requestedUnits - input.movedUnits;
  const created: InventoryMovementContract = {
    id: `mov_${companyId}_${crypto.randomUUID()}`,
    companyId,
    code: `MOV-${Math.random().toString().slice(2, 6)}`,
    movementType: input.movementType,
    skuName: input.skuName.trim(),
    sourceName: input.sourceName.trim(),
    destinationName: input.destinationName.trim(),
    requestedBy: input.requestedBy.trim(),
    upstreamReceiptCode: input.upstreamReceiptCode,
    purchaseReference: input.purchaseReference,
    purchaseOrderOwner: "Warehouse coordinator",
    purchaseOrderStatus: input.purchaseReference ? "received" : "unknown",
    invoiceMatchStatus: input.pendingEvidence > 0 ? "pending" : "matched",
    status: input.movedUnits >= input.requestedUnits && input.pendingEvidence === 0 ? "received" : "draft",
    requestedUnits: input.requestedUnits,
    movedUnits: input.movedUnits,
    varianceUnits,
    pendingEvidence: input.pendingEvidence,
    impactLevel: input.impactLevel,
    nextAction: input.nextAction.trim(),
    updatedAt: nowIso()
  };
  writeStorage(key, [created, ...movements]);
  return created;
}

export function updateDemoInventoryMovement(
  companyId: string,
  movementId: string,
  input: UpdateInventoryMovementRequestContract
): InventoryMovementContract | null {
  const key = getInventoryMovementStorageKey(companyId);
  const movements = readStorage(key, () => createInventoryMovementSeed(companyId));
  const current = movements.find((movement) => movement.id === movementId);
  if (!current) {
    return null;
  }

  const updated: InventoryMovementContract = {
    ...current,
    status: input.status,
    nextAction: input.nextAction.trim(),
    purchaseOrderStatus:
      input.status === "received"
        ? "received"
        : input.status === "in_transit"
          ? "in_transit"
          : input.status === "blocked"
            ? "blocked"
            : current.purchaseOrderStatus,
    updatedAt: nowIso()
  };
  writeStorage(
    key,
    movements.map((movement) => (movement.id === movementId ? updated : movement))
  );
  return updated;
}
