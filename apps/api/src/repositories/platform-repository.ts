import type { Pool, PoolClient } from "pg";
import {
  defaultRoles,
  moduleCatalog
} from "../../../../packages/contracts/dist/index.js";
import type {
  AuditEventInput,
  AuditEventRecord,
  AuthFailureReason,
  CompanyRecord,
  CreatePlatformUserInput,
  ProvisionCompanyInput,
  RefreshTokenRecord,
  SettingsRecord,
  UpdateCompanyModulesInput,
  UpdatePlatformSettingsInput,
  UpdatePlatformUserRoleInput,
  UpdatePlatformUserStatusInput,
  UserRecord
} from "../domain/platform/entities.js";
import { createPrefixedId } from "../lib/ids.js";
import { generateTemporaryPassword, hashPassword } from "../lib/passwords.js";

type ProjectPortfolioItemRecord = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  client: string;
  segment: string;
  status: "planning" | "active" | "at_risk" | "blocked" | "closed";
  stage: string;
  progress: number;
  scheduleVarianceDays: number;
  budgetHealth: "on_track" | "warning" | "critical";
  qualityHolds: number;
  permitBlockers: number;
  activeFronts: number;
  updatedAt: string;
  nextMilestone: string;
};

type ProjectRiskRecord = {
  id: string;
  projectId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateProjectPortfolioItemInput = {
  projectId: string;
  status: "planning" | "active" | "at_risk" | "blocked" | "closed";
  nextMilestone: string;
};

type DailyLogEntryRecord = {
  id: string;
  companyId: string;
  projectName: string;
  frontName: string;
  supervisor: string;
  logDate: string;
  shift: "morning" | "mixed" | "night";
  weather: "clear" | "windy" | "rain" | "storm";
  status: "draft" | "submitted" | "approved" | "flagged";
  progressPercent: number;
  workforceCount: number;
  incidentsCount: number;
  blockersCount: number;
  evidenceCount: number;
  concretePourM3: number;
  nextAction: string;
  updatedAt: string;
};

type DailyLogRiskRecord = {
  id: string;
  logId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateDailyLogEntryInput = {
  entryId: string;
  status: "draft" | "submitted" | "approved" | "flagged";
  nextAction: string;
};

type ProcurementPackageRecord = {
  id: string;
  companyId: string;
  code: string;
  packageName: string;
  projectName: string;
  buyer: string;
  status: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked";
  budgetAmount: number;
  bidCount: number;
  approvalHours: number;
  strategic: boolean;
  supplierContention: number;
  nextAction: string;
  updatedAt: string;
};

type ProcurementRiskRecord = {
  id: string;
  packageId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateProcurementPackageInput = {
  packageId: string;
  status: "draft" | "sourcing" | "awaiting_approval" | "awarded" | "blocked";
  nextAction: string;
};

type InventoryLocationRecord = {
  id: string;
  companyId: string;
  code: string;
  locationName: string;
  locationType: string;
  trackedSkus: number;
  accuracy: number;
  openVariances: number;
  urgentReplenishments: number;
  blockedReservations: number;
  stockHealth: "healthy" | "watch" | "critical";
  nextAction: string;
  updatedAt: string;
};

type InventoryRiskRecord = {
  id: string;
  locationId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateInventoryLocationInput = {
  locationId: string;
  stockHealth: "healthy" | "watch" | "critical";
  nextAction: string;
};

type MachineItemRecord = {
  id: string;
  companyId: string;
  code: string;
  machineName: string;
  machineType: string;
  projectName: string;
  frontName: string;
  status: "available" | "maintenance" | "down";
  health: "healthy" | "watch" | "critical";
  availabilityPercent: number;
  utilizationPercent: number;
  hourMeter: number;
  nextMaintenanceHours: number;
  maintenanceDueDate: string;
  maintenanceBacklog: number;
  openFailures: number;
  criticalOpenFailures: number;
  lastServiceAt: string;
  nextAction: string;
  updatedAt: string;
};

type MachineRiskRecord = {
  id: string;
  machineId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateMachineItemInput = {
  machineId: string;
  status: "available" | "maintenance" | "down";
  health: "healthy" | "watch" | "critical";
  nextAction: string;
};

type FinanceLedgerItemRecord = {
  id: string;
  companyId: string;
  code: string;
  metricName: string;
  valueLabel: string;
  trendLabel: string;
  note: string;
  cashImpact: number;
  urgentItems: number;
  closeReadiness: number;
  satStatus: "controlled" | "watch" | "critical";
  updatedAt: string;
};

type FinanceRiskRecord = {
  id: string;
  ledgerId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateFinanceLedgerItemInput = {
  ledgerId: string;
  satStatus: "controlled" | "watch" | "critical";
  note: string;
};

type CrmLeadBucketRecord = {
  id: string;
  companyId: string;
  code: string;
  projectName: string;
  segment: string;
  openOpportunities: number;
  conversionRate: number;
  reservations: number;
  forecastRevenue: number;
  health: "healthy" | "watch" | "critical";
  signal: string;
  owner: string;
  updatedAt: string;
};

type CrmRiskRecord = {
  id: string;
  leadBucketId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateCrmLeadBucketInput = {
  leadBucketId: string;
  health: "healthy" | "watch" | "critical";
  signal: string;
};

type HrWorkforceItemRecord = {
  id: string;
  companyId: string;
  code: string;
  contractorName: string;
  frontName: string;
  activeHeadcount: number;
  attendanceRate: number;
  productivityRate: number;
  complianceExpirations: number;
  incidentCount: number;
  safetyStatus: "controlled" | "watch" | "critical";
  nextAction: string;
  updatedAt: string;
};

type HrRiskRecord = {
  id: string;
  workforceId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateHrWorkforceItemInput = {
  workforceId: string;
  safetyStatus: "controlled" | "watch" | "critical";
  nextAction: string;
};

type PostSaleCaseRecord = {
  id: string;
  companyId: string;
  code: string;
  caseType: "delivery" | "warranty" | "incident";
  projectName: string;
  customerName: string;
  assetLabel: string;
  owner: string;
  status: "reported" | "triaged" | "scheduled" | "in_progress" | "customer_validation" | "blocked" | "closed";
  priority: "standard" | "urgent" | "critical";
  slaHoursRemaining: number;
  openFindings: number;
  pendingVisits: number;
  customerSatisfaction: number;
  nextAction: string;
  health: "healthy" | "watch" | "critical";
  updatedAt: string;
};

type PostSaleRiskRecord = {
  id: string;
  caseId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdatePostSaleCaseInput = {
  caseId: string;
  status: "reported" | "triaged" | "scheduled" | "in_progress" | "customer_validation" | "blocked" | "closed";
  nextAction: string;
};

type ComplianceCaseRecord = {
  id: string;
  companyId: string;
  code: string;
  queueName: string;
  subject: string;
  unitOrContract: string;
  owner: string;
  status: "monitoring" | "in_progress" | "at_risk" | "blocked" | "closed";
  documentCompletion: number;
  slaHoursRemaining: number;
  openFindings: number;
  health: "healthy" | "watch" | "critical";
  nextAction: string;
  updatedAt: string;
};

type ComplianceRiskRecord = {
  id: string;
  caseId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateComplianceCaseInput = {
  caseId: string;
  status: "monitoring" | "in_progress" | "at_risk" | "blocked" | "closed";
  nextAction: string;
};

type IntegrationStreamRecord = {
  id: string;
  companyId: string;
  code: string;
  streamName: string;
  provider: string;
  domain: string;
  health: "healthy" | "watch" | "critical";
  freshnessMinutes: number;
  openAlerts: number;
  linkedAssets: number;
  automationCoverage: number;
  nextAction: string;
  updatedAt: string;
};

type IntegrationRiskRecord = {
  id: string;
  streamId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateIntegrationStreamInput = {
  streamId: string;
  health: "healthy" | "watch" | "critical";
  nextAction: string;
};

type DocumentControlItemRecord = {
  id: string;
  companyId: string;
  code: string;
  documentType: string;
  subject: string;
  projectName: string;
  owner: string;
  status: "issued" | "in_review" | "awaiting_response" | "approved" | "blocked";
  revisionCount: number;
  turnaroundDays: number;
  openComments: number;
  health: "healthy" | "watch" | "critical";
  nextAction: string;
  updatedAt: string;
};

type DocumentControlRiskRecord = {
  id: string;
  itemId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateDocumentControlItemInput = {
  itemId: string;
  status: "issued" | "in_review" | "awaiting_response" | "approved" | "blocked";
  nextAction: string;
};

type QualityInspectionRecord = {
  id: string;
  companyId: string;
  code: string;
  areaName: string;
  checklistName: string;
  contractorName: string;
  severity: "minor" | "major" | "critical";
  openFindings: number;
  evidenceCompletion: number;
  releaseReadiness: number;
  reworkRate: number;
  status: "scheduled" | "in_progress" | "pending_release" | "released" | "blocked";
  nextAction: string;
  updatedAt: string;
};

type QualityRiskRecord = {
  id: string;
  inspectionId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateQualityInspectionInput = {
  inspectionId: string;
  status: "scheduled" | "in_progress" | "pending_release" | "released" | "blocked";
  nextAction: string;
};

export type PlatformRepository = {
  listCompanies(): Promise<CompanyRecord[]>;
  listModules(): Promise<typeof moduleCatalog>;
  listRoles(): Promise<typeof defaultRoles>;
  listUsers(companyId?: string): Promise<UserRecord[]>;
  listProjects(companyId: string): Promise<ProjectPortfolioItemRecord[]>;
  listProjectRisks(companyId: string): Promise<ProjectRiskRecord[]>;
  listDailyLogEntries(companyId: string): Promise<DailyLogEntryRecord[]>;
  listDailyLogRisks(companyId: string): Promise<DailyLogRiskRecord[]>;
  listProcurementPackages(companyId: string): Promise<ProcurementPackageRecord[]>;
  listProcurementRisks(companyId: string): Promise<ProcurementRiskRecord[]>;
  listInventoryLocations(companyId: string): Promise<InventoryLocationRecord[]>;
  listInventoryRisks(companyId: string): Promise<InventoryRiskRecord[]>;
  listMachines(companyId: string): Promise<MachineItemRecord[]>;
  listMachineRisks(companyId: string): Promise<MachineRiskRecord[]>;
  listFinanceItems(companyId: string): Promise<FinanceLedgerItemRecord[]>;
  listFinanceRisks(companyId: string): Promise<FinanceRiskRecord[]>;
  listCrmLeadBuckets(companyId: string): Promise<CrmLeadBucketRecord[]>;
  listCrmRisks(companyId: string): Promise<CrmRiskRecord[]>;
  listHrWorkforces(companyId: string): Promise<HrWorkforceItemRecord[]>;
  listHrRisks(companyId: string): Promise<HrRiskRecord[]>;
  listPostSaleCases(companyId: string): Promise<PostSaleCaseRecord[]>;
  listPostSaleRisks(companyId: string): Promise<PostSaleRiskRecord[]>;
  listComplianceCases(companyId: string): Promise<ComplianceCaseRecord[]>;
  listComplianceRisks(companyId: string): Promise<ComplianceRiskRecord[]>;
  listIntegrationStreams(companyId: string): Promise<IntegrationStreamRecord[]>;
  listIntegrationRisks(companyId: string): Promise<IntegrationRiskRecord[]>;
  listDocumentControlItems(companyId: string): Promise<DocumentControlItemRecord[]>;
  listDocumentControlRisks(companyId: string): Promise<DocumentControlRiskRecord[]>;
  listQualityInspections(companyId: string): Promise<QualityInspectionRecord[]>;
  listQualityRisks(companyId: string): Promise<QualityRiskRecord[]>;
  getCompanyById(companyId: string): Promise<CompanyRecord | undefined>;
  getUserById(userId: string): Promise<UserRecord | undefined>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  getRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  listRefreshTokensByUser(userId: string, companyId: string): Promise<RefreshTokenRecord[]>;
  companyTaxIdExists(taxId: string): Promise<boolean>;
  userEmailExists(email: string): Promise<boolean>;
  getSettings(companyId: string): Promise<SettingsRecord | undefined>;
  saveProvisionedCompany(input: ProvisionCompanyInput): Promise<{
    company: CompanyRecord;
    adminUser: UserRecord;
    settings: SettingsRecord;
    temporaryPassword: string;
  }>;
  saveRefreshToken(input: Omit<RefreshTokenRecord, "id" | "createdAt">): Promise<RefreshTokenRecord>;
  revokeRefreshToken(tokenHash: string): Promise<boolean>;
  revokeRefreshTokenById(tokenId: string, userId: string, companyId: string): Promise<boolean>;
  revokeRefreshTokens(userId: string, companyId: string): Promise<number>;
  recordAuthFailure(email: string, reason: AuthFailureReason, companyId?: string): Promise<void>;
  addAuditEvent(event: AuditEventInput): Promise<void>;
  updateSettings(input: UpdatePlatformSettingsInput): Promise<SettingsRecord>;
  replaceCompanyModules(input: UpdateCompanyModulesInput): Promise<CompanyRecord>;
  createUser(input: CreatePlatformUserInput): Promise<{
    user: UserRecord;
    temporaryPassword: string;
  }>;
  updateUserRole(input: UpdatePlatformUserRoleInput): Promise<UserRecord>;
  updateUserStatus(input: UpdatePlatformUserStatusInput): Promise<UserRecord>;
  updateProjectPortfolioItem(input: UpdateProjectPortfolioItemInput): Promise<ProjectPortfolioItemRecord>;
  updateDailyLogEntry(input: UpdateDailyLogEntryInput): Promise<DailyLogEntryRecord>;
  updateCrmLeadBucket(input: UpdateCrmLeadBucketInput): Promise<CrmLeadBucketRecord>;
  updateFinanceLedgerItem(input: UpdateFinanceLedgerItemInput): Promise<FinanceLedgerItemRecord>;
  updateHrWorkforceItem(input: UpdateHrWorkforceItemInput): Promise<HrWorkforceItemRecord>;
  updatePostSaleCase(input: UpdatePostSaleCaseInput): Promise<PostSaleCaseRecord>;
  updateComplianceCase(input: UpdateComplianceCaseInput): Promise<ComplianceCaseRecord>;
  updateIntegrationStream(input: UpdateIntegrationStreamInput): Promise<IntegrationStreamRecord>;
  updateDocumentControlItem(input: UpdateDocumentControlItemInput): Promise<DocumentControlItemRecord>;
  updateInventoryLocation(input: UpdateInventoryLocationInput): Promise<InventoryLocationRecord>;
  updateMachineItem(input: UpdateMachineItemInput): Promise<MachineItemRecord>;
  updateProcurementPackage(input: UpdateProcurementPackageInput): Promise<ProcurementPackageRecord>;
  updateQualityInspection(input: UpdateQualityInspectionInput): Promise<QualityInspectionRecord>;
  listAuditEvents(companyId?: string, limit?: number): Promise<AuditEventRecord[]>;
};

function createSeedState() {
  const companies: CompanyRecord[] = [
    {
      id: "cmp_arcont_demo",
      legalName: "ARCONT Demo Constructora, S.A. de C.V.",
      tradeName: "ARCONT Demo",
      countryCode: "MX",
      taxId: "ADC240101AAA",
      status: "active",
      enabledModules: [
        "platform.companies",
        "platform.identity",
        "sales.crm",
        "projects.control",
        "projects.daily-log",
        "procurement.purchasing",
        "inventory.warehouse",
        "inventory.equipment",
        "finance.accounting",
        "hr.workforce",
        "compliance.postsale",
        "integrations.field-data"
      ]
    },
    {
      id: "cmp_bienestar_gov",
      legalName: "Infraestructura Bienestar del Sureste, S.A.P.I. de C.V.",
      tradeName: "Bienestar Sureste",
      countryCode: "MX",
      taxId: "IBS240101BBB",
      status: "active",
      enabledModules: [
        "platform.companies",
        "platform.identity",
        "projects.control",
        "projects.daily-log",
        "procurement.purchasing",
        "inventory.warehouse",
        "inventory.equipment",
        "hr.workforce",
        "integrations.field-data"
      ]
    }
  ];

  const users: UserRecord[] = [
    {
      id: "usr_platform_owner",
      companyId: "cmp_arcont_demo",
      fullName: "Angel Platform Owner",
      email: "admin@arcont.local",
      roleKey: "platform-owner",
      status: "active",
      passwordHash: hashPassword("password123")
    },
    {
      id: "usr_ops_manager",
      companyId: "cmp_bienestar_gov",
      fullName: "Daniel Obra",
      email: "obra@arcont.local",
      roleKey: "operations-manager",
      status: "active",
      passwordHash: hashPassword("password123")
    }
  ];

  const projects: ProjectPortfolioItemRecord[] = [
    {
      id: "prj_torre_b",
      companyId: "cmp_arcont_demo",
      code: "ARB-TB-01",
      name: "Torre B Residencial",
      client: "Capital Habitat",
      segment: "Vertical housing",
      status: "active",
      stage: "Structural progress",
      progress: 84,
      scheduleVarianceDays: 2.1,
      budgetHealth: "warning",
      qualityHolds: 5,
      permitBlockers: 0,
      activeFronts: 4,
      updatedAt: "2026-07-11T18:20:00.000Z",
      nextMilestone: "Level 12 slab pour"
    },
    {
      id: "prj_etapa_2",
      companyId: "cmp_arcont_demo",
      code: "ARB-ET2-02",
      name: "Etapa 2 Urbanizacion",
      client: "ARCONT Desarrollos",
      segment: "Horizontal housing",
      status: "at_risk",
      stage: "Permits and kickoff",
      progress: 61,
      scheduleVarianceDays: 4.3,
      budgetHealth: "critical",
      qualityHolds: 3,
      permitBlockers: 2,
      activeFronts: 2,
      updatedAt: "2026-07-11T17:10:00.000Z",
      nextMilestone: "Municipal utility approval"
    },
    {
      id: "prj_cobalto",
      companyId: "cmp_bienestar_gov",
      code: "IBS-GOV-07",
      name: "Infraestructura Vial y Vivienda",
      client: "Gobierno Federal",
      segment: "Government housing",
      status: "active",
      stage: "Government control",
      progress: 73,
      scheduleVarianceDays: 1.6,
      budgetHealth: "on_track",
      qualityHolds: 6,
      permitBlockers: 1,
      activeFronts: 5,
      updatedAt: "2026-07-11T16:45:00.000Z",
      nextMilestone: "Third supervision audit"
    },
    {
      id: "prj_bienestar_norte",
      companyId: "cmp_bienestar_gov",
      code: "IBS-BN-11",
      name: "Paquete Bienestar Norte",
      client: "SEDATU",
      segment: "Government housing",
      status: "blocked",
      stage: "Site readiness",
      progress: 48,
      scheduleVarianceDays: 6.2,
      budgetHealth: "warning",
      qualityHolds: 0,
      permitBlockers: 3,
      activeFronts: 1,
      updatedAt: "2026-07-11T15:30:00.000Z",
      nextMilestone: "Land release and mobilization"
    }
  ];

  const projectRisks: ProjectRiskRecord[] = [
    {
      id: "rsk_etapa_2_permits",
      projectId: "prj_etapa_2",
      title: "Utility permit package still pending",
      category: "Permits",
      severity: "critical",
      owner: "Permitting PM",
      status: "Escalated with municipality"
    },
    {
      id: "rsk_torre_b_concrete",
      projectId: "prj_torre_b",
      title: "Concrete cycle slipping on tower core",
      category: "Schedule",
      severity: "warning",
      owner: "Site superintendent",
      status: "Recovery sequence in progress"
    },
    {
      id: "rsk_bn_land_release",
      projectId: "prj_bienestar_norte",
      title: "Land release blocks full mobilization",
      category: "Government control",
      severity: "critical",
      owner: "Regional director",
      status: "Awaiting final release letter"
    },
    {
      id: "rsk_cobalto_quality",
      projectId: "prj_cobalto",
      title: "Repeated rebar inspection comments",
      category: "Quality",
      severity: "warning",
      owner: "Quality lead",
      status: "Crew retraining scheduled"
    }
  ];

  const dailyLogEntries: DailyLogEntryRecord[] = [
    {
      id: "dlg_torre_b_0712",
      companyId: "cmp_arcont_demo",
      projectName: "Torre B Residencial",
      frontName: "Tower core",
      supervisor: "Ramon Cetz",
      logDate: "2026-07-12",
      shift: "morning",
      weather: "clear",
      status: "submitted",
      progressPercent: 62,
      workforceCount: 46,
      incidentsCount: 0,
      blockersCount: 0,
      evidenceCount: 28,
      concretePourM3: 84,
      nextAction: "Validate pour evidence and approve the tower core daily log before the evening shift.",
      updatedAt: "2026-07-12T18:10:00.000Z"
    },
    {
      id: "dlg_etapa2_0712",
      companyId: "cmp_arcont_demo",
      projectName: "Etapa 2 Urbanizacion",
      frontName: "Storm drain trench",
      supervisor: "Nora Pacheco",
      logDate: "2026-07-12",
      shift: "mixed",
      weather: "rain",
      status: "flagged",
      progressPercent: 38,
      workforceCount: 31,
      incidentsCount: 1,
      blockersCount: 2,
      evidenceCount: 6,
      concretePourM3: 0,
      nextAction: "Document rainfall impact, close the utility crossing blocker, and upload missing trench evidence.",
      updatedAt: "2026-07-12T17:25:00.000Z"
    },
    {
      id: "dlg_vial_0712",
      companyId: "cmp_bienestar_gov",
      projectName: "Infraestructura Vial y Vivienda",
      frontName: "Subgrade preparation",
      supervisor: "Cesar Chan",
      logDate: "2026-07-12",
      shift: "morning",
      weather: "windy",
      status: "approved",
      progressPercent: 71,
      workforceCount: 52,
      incidentsCount: 0,
      blockersCount: 0,
      evidenceCount: 34,
      concretePourM3: 0,
      nextAction: "Release next front and keep compaction evidence attached to the approved log.",
      updatedAt: "2026-07-12T16:45:00.000Z"
    },
    {
      id: "dlg_bn_0712",
      companyId: "cmp_bienestar_gov",
      projectName: "Paquete Bienestar Norte",
      frontName: "Pilot housing pad",
      supervisor: "Lucia Herrera",
      logDate: "2026-07-12",
      shift: "night",
      weather: "storm",
      status: "draft",
      progressPercent: 24,
      workforceCount: 18,
      incidentsCount: 0,
      blockersCount: 1,
      evidenceCount: 2,
      concretePourM3: 18,
      nextAction: "Complete the pending night-shift evidence pack before routing this log for review.",
      updatedAt: "2026-07-12T15:50:00.000Z"
    }
  ];

  const dailyLogRisks: DailyLogRiskRecord[] = [
    {
      id: "dlr_etapa2_rain",
      logId: "dlg_etapa2_0712",
      title: "Rain event interrupted trench productivity and left evidence gaps",
      category: "Weather",
      severity: "warning",
      owner: "Field coordinator",
      status: "Pending recovery sequence"
    },
    {
      id: "dlr_etapa2_utility",
      logId: "dlg_etapa2_0712",
      title: "Utility crossing approval still blocks the next trench segment",
      category: "Permits",
      severity: "critical",
      owner: "Construction manager",
      status: "Escalated with utility representative"
    },
    {
      id: "dlr_bn_evidence",
      logId: "dlg_bn_0712",
      title: "Night shift log still missing core evidence pack",
      category: "Documentation",
      severity: "warning",
      owner: "Site engineer",
      status: "Waiting for upload from field tablet"
    }
  ];

  const procurementPackages: ProcurementPackageRecord[] = [
    {
      id: "pkg_steel_demo",
      companyId: "cmp_arcont_demo",
      code: "PO-STEEL-01",
      packageName: "Steel package",
      projectName: "Torre B Residencial",
      buyer: "Monica Compras",
      status: "awaiting_approval",
      budgetAmount: 4800000,
      bidCount: 3,
      approvalHours: 38,
      strategic: true,
      supplierContention: 3,
      nextAction: "Director approval before award",
      updatedAt: "2026-07-11T18:05:00.000Z"
    },
    {
      id: "pkg_mep_demo",
      companyId: "cmp_arcont_demo",
      code: "PO-MEP-04",
      packageName: "MEP materials",
      projectName: "Etapa 2 Urbanizacion",
      buyer: "Luis Cadena",
      status: "sourcing",
      budgetAmount: 2100000,
      bidCount: 2,
      approvalHours: 24,
      strategic: false,
      supplierContention: 2,
      nextAction: "Close third bid to compare totals",
      updatedAt: "2026-07-11T17:15:00.000Z"
    },
    {
      id: "pkg_concrete_gov",
      companyId: "cmp_bienestar_gov",
      code: "PO-CONC-09",
      packageName: "Concrete supply",
      projectName: "Infraestructura Vial y Vivienda",
      buyer: "Andrea Supply",
      status: "awarded",
      budgetAmount: 1600000,
      bidCount: 4,
      approvalHours: 16,
      strategic: false,
      supplierContention: 4,
      nextAction: "Track first delivery window",
      updatedAt: "2026-07-11T16:10:00.000Z"
    },
    {
      id: "pkg_prefab_gov",
      companyId: "cmp_bienestar_gov",
      code: "PO-PREF-12",
      packageName: "Prefabricated bathroom modules",
      projectName: "Paquete Bienestar Norte",
      buyer: "Andrea Supply",
      status: "blocked",
      budgetAmount: 5900000,
      bidCount: 1,
      approvalHours: 52,
      strategic: true,
      supplierContention: 1,
      nextAction: "Resolve supplier technical deviation",
      updatedAt: "2026-07-11T15:05:00.000Z"
    }
  ];

  const procurementRisks: ProcurementRiskRecord[] = [
    {
      id: "prk_steel_approval",
      packageId: "pkg_steel_demo",
      title: "Approval aging beyond target SLA",
      category: "Approvals",
      severity: "warning",
      owner: "Commercial director",
      status: "Waiting for final sign-off"
    },
    {
      id: "prk_prefab_supplier",
      packageId: "pkg_prefab_gov",
      title: "Single supplier package with technical deviation",
      category: "Supplier risk",
      severity: "critical",
      owner: "Procurement manager",
      status: "Engineering review open"
    },
    {
      id: "prk_mep_contention",
      packageId: "pkg_mep_demo",
      title: "Low bid contention for MEP package",
      category: "Competition",
      severity: "warning",
      owner: "Buyer lead",
      status: "Searching alternate vendors"
    }
  ];

  const inventoryLocations: InventoryLocationRecord[] = [
    {
      id: "inv_central_demo",
      companyId: "cmp_arcont_demo",
      code: "WH-CEN-01",
      locationName: "Central warehouse",
      locationType: "Warehouse",
      trackedSkus: 4280,
      accuracy: 97.9,
      openVariances: 2,
      urgentReplenishments: 0,
      blockedReservations: 1,
      stockHealth: "healthy",
      nextAction: "Cycle count on finishing materials aisle",
      updatedAt: "2026-07-11T18:00:00.000Z"
    },
    {
      id: "inv_jobsite_demo",
      companyId: "cmp_arcont_demo",
      code: "SITE-TB-02",
      locationName: "Jobsite B",
      locationType: "Jobsite",
      trackedSkus: 1140,
      accuracy: 95.4,
      openVariances: 3,
      urgentReplenishments: 2,
      blockedReservations: 4,
      stockHealth: "watch",
      nextAction: "Replenish conduit and anchors before Friday",
      updatedAt: "2026-07-11T17:35:00.000Z"
    },
    {
      id: "inv_yard_gov",
      companyId: "cmp_bienestar_gov",
      code: "YARD-BN-03",
      locationName: "Prefabrication yard",
      locationType: "Yard",
      trackedSkus: 620,
      accuracy: 98.6,
      openVariances: 1,
      urgentReplenishments: 1,
      blockedReservations: 0,
      stockHealth: "healthy",
      nextAction: "Confirm next steel mesh transfer",
      updatedAt: "2026-07-11T16:20:00.000Z"
    },
    {
      id: "inv_field_gov",
      companyId: "cmp_bienestar_gov",
      code: "SITE-BN-04",
      locationName: "Frontline staging area",
      locationType: "Field staging",
      trackedSkus: 780,
      accuracy: 93.2,
      openVariances: 4,
      urgentReplenishments: 3,
      blockedReservations: 2,
      stockHealth: "critical",
      nextAction: "Resolve missing plumbing kit receipts",
      updatedAt: "2026-07-11T15:40:00.000Z"
    }
  ];

  const inventoryRisks: InventoryRiskRecord[] = [
    {
      id: "ivr_jobsite_gap",
      locationId: "inv_jobsite_demo",
      title: "Anchors below safety stock for slab sequence",
      category: "Replenishment",
      severity: "warning",
      owner: "Warehouse lead",
      status: "Transfer requested from central warehouse"
    },
    {
      id: "ivr_field_receipts",
      locationId: "inv_field_gov",
      title: "Unposted field receipts distort available stock",
      category: "Traceability",
      severity: "critical",
      owner: "Field storekeeper",
      status: "Backlog under reconciliation"
    },
    {
      id: "ivr_central_cycle",
      locationId: "inv_central_demo",
      title: "Cycle count variance in finishing materials",
      category: "Variance",
      severity: "info",
      owner: "Inventory analyst",
      status: "Scheduled for next count window"
    }
  ];

  const machines: MachineItemRecord[] = [
    {
      id: "eq_exc_demo",
      companyId: "cmp_arcont_demo",
      code: "EQ-EXC-01",
      machineName: "Excavadora 320GC",
      machineType: "Excavadora",
      projectName: "Etapa 2 Urbanizacion",
      frontName: "Plataforma norte",
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
      nextAction: "Inspect bucket pin wear before next excavation cycle",
      updatedAt: "2026-07-11T17:25:00.000Z"
    },
    {
      id: "eq_crane_demo",
      companyId: "cmp_arcont_demo",
      code: "EQ-CRN-04",
      machineName: "Grua torre TC-8",
      machineType: "Grua torre",
      projectName: "Torre B Residencial",
      frontName: "Nucleo vertical",
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
      nextAction: "Close slew brake failure and release signed maintenance ticket",
      updatedAt: "2026-07-11T18:15:00.000Z"
    },
    {
      id: "eq_gen_gov",
      companyId: "cmp_bienestar_gov",
      code: "EQ-GEN-07",
      machineName: "Generador 150 kVA",
      machineType: "Generador",
      projectName: "Infraestructura Vial y Vivienda",
      frontName: "Campamento principal",
      status: "down",
      health: "critical",
      availabilityPercent: 51,
      utilizationPercent: 69,
      hourMeter: 5280,
      nextMaintenanceHours: 0,
      maintenanceDueDate: "2026-07-08T20:00:00.000Z",
      maintenanceBacklog: 1,
      openFailures: 3,
      criticalOpenFailures: 2,
      lastServiceAt: "2026-06-22T09:00:00.000Z",
      nextAction: "Replace alternator module and keep backup rental online",
      updatedAt: "2026-07-11T14:40:00.000Z"
    },
    {
      id: "eq_loader_gov",
      companyId: "cmp_bienestar_gov",
      code: "EQ-LDR-11",
      machineName: "Cargador frontal 938",
      machineType: "Cargador",
      projectName: "Paquete Bienestar Norte",
      frontName: "Patio de prefabricados",
      status: "available",
      health: "healthy",
      availabilityPercent: 96,
      utilizationPercent: 66,
      hourMeter: 2360,
      nextMaintenanceHours: 160,
      maintenanceDueDate: "2026-07-29T18:00:00.000Z",
      maintenanceBacklog: 0,
      openFailures: 0,
      criticalOpenFailures: 0,
      lastServiceAt: "2026-07-03T10:30:00.000Z",
      nextAction: "Keep tire inspection in weekly operator checklist",
      updatedAt: "2026-07-11T13:20:00.000Z"
    }
  ];

  const machineRisks: MachineRiskRecord[] = [
    {
      id: "mrk_crane_brake",
      machineId: "eq_crane_demo",
      title: "Slew brake failure keeps tower crane out of safe release window",
      category: "Critical failure",
      severity: "critical",
      owner: "Maintenance supervisor",
      status: "Brake kit on site and technician assigned"
    },
    {
      id: "mrk_exc_bucket",
      machineId: "eq_exc_demo",
      title: "Bucket pin wear may degrade trench precision this week",
      category: "Condition watch",
      severity: "warning",
      owner: "Equipment lead",
      status: "Inspection added to next shift handoff"
    },
    {
      id: "mrk_gen_alternator",
      machineId: "eq_gen_gov",
      title: "Alternator fault leaves remote backbone dependent on rental backup",
      category: "Power continuity",
      severity: "critical",
      owner: "Field infrastructure",
      status: "Replacement module requested with emergency priority"
    },
    {
      id: "mrk_loader_oil",
      machineId: "eq_loader_gov",
      title: "Hydraulic oil sample should be repeated after heavy yard sequence",
      category: "Predictive maintenance",
      severity: "info",
      owner: "Workshop planner",
      status: "Sample scheduled in next preventive cycle"
    }
  ];

  const financeItems: FinanceLedgerItemRecord[] = [
    {
      id: "fin_cash_demo",
      companyId: "cmp_arcont_demo",
      code: "FIN-CASH-01",
      metricName: "Cash position",
      valueLabel: "MXN 18.4M",
      trendLabel: "Forecast +6%",
      note: "Within policy and enough to absorb current construction cycle.",
      cashImpact: 18400000,
      urgentItems: 0,
      closeReadiness: 92,
      satStatus: "controlled",
      updatedAt: "2026-07-11T18:10:00.000Z"
    },
    {
      id: "fin_ap_demo",
      companyId: "cmp_arcont_demo",
      code: "FIN-AP-02",
      metricName: "Accounts payable",
      valueLabel: "MXN 6.7M",
      trendLabel: "12 urgent",
      note: "Two blocked invoices tied to incomplete receiving evidence.",
      cashImpact: -6700000,
      urgentItems: 12,
      closeReadiness: 86,
      satStatus: "watch",
      updatedAt: "2026-07-11T17:40:00.000Z"
    },
    {
      id: "fin_rev_gov",
      companyId: "cmp_bienestar_gov",
      code: "FIN-REV-07",
      metricName: "Revenue recognition",
      valueLabel: "MXN 42.1M",
      trendLabel: "92% posted",
      note: "Recognition pace aligned to supervision and work estimates.",
      cashImpact: 42100000,
      urgentItems: 4,
      closeReadiness: 90,
      satStatus: "controlled",
      updatedAt: "2026-07-11T16:55:00.000Z"
    },
    {
      id: "fin_tax_gov",
      companyId: "cmp_bienestar_gov",
      code: "FIN-TAX-09",
      metricName: "SAT posture",
      valueLabel: "Watch",
      trendLabel: "2 CFDI exceptions",
      note: "Exceptions linked to supplier complement mismatches.",
      cashImpact: -350000,
      urgentItems: 2,
      closeReadiness: 81,
      satStatus: "watch",
      updatedAt: "2026-07-11T15:50:00.000Z"
    }
  ];

  const financeRisks: FinanceRiskRecord[] = [
    {
      id: "frk_ap_blocked",
      ledgerId: "fin_ap_demo",
      title: "Blocked invoices delay next payment run",
      category: "Accounts payable",
      severity: "warning",
      owner: "Treasury lead",
      status: "Waiting for warehouse evidence"
    },
    {
      id: "frk_tax_cfdi",
      ledgerId: "fin_tax_gov",
      title: "CFDI complement mismatches need correction",
      category: "Fiscal compliance",
      severity: "critical",
      owner: "Tax analyst",
      status: "Supplier correction requested"
    },
    {
      id: "frk_rev_estimate",
      ledgerId: "fin_rev_gov",
      title: "Estimate approval must close before recognition cutoff",
      category: "Close",
      severity: "warning",
      owner: "Controller",
      status: "Pending final supervision signature"
    }
  ];

  const crmLeadBuckets: CrmLeadBucketRecord[] = [
    {
      id: "crm_nativa_demo",
      companyId: "cmp_arcont_demo",
      code: "CRM-NAT-01",
      projectName: "Residencial Nativa",
      segment: "Investor",
      openOpportunities: 34,
      conversionRate: 19,
      reservations: 11,
      forecastRevenue: 21800000,
      health: "watch",
      signal: "2 demos pending",
      owner: "Mariana Comercial",
      updatedAt: "2026-07-11T18:00:00.000Z"
    },
    {
      id: "crm_distrito_demo",
      companyId: "cmp_arcont_demo",
      code: "CRM-DIS-02",
      projectName: "Distrito Norte",
      segment: "Primary home",
      openOpportunities: 28,
      conversionRate: 24,
      reservations: 13,
      forecastRevenue: 26700000,
      health: "healthy",
      signal: "Bank pre-approval signal",
      owner: "Mariana Comercial",
      updatedAt: "2026-07-11T17:20:00.000Z"
    },
    {
      id: "crm_cobalto_gov",
      companyId: "cmp_bienestar_gov",
      code: "CRM-COB-07",
      projectName: "Puerto Cobalto",
      segment: "Government housing",
      openOpportunities: 17,
      conversionRate: 13,
      reservations: 6,
      forecastRevenue: 12800000,
      health: "watch",
      signal: "Tender validation ongoing",
      owner: "Daniel Obra",
      updatedAt: "2026-07-11T16:30:00.000Z"
    },
    {
      id: "crm_bienestar_gov",
      companyId: "cmp_bienestar_gov",
      code: "CRM-BIE-09",
      projectName: "Paquete Bienestar Sur",
      segment: "Government housing",
      openOpportunities: 22,
      conversionRate: 15,
      reservations: 8,
      forecastRevenue: 17300000,
      health: "critical",
      signal: "Land release still delays closing certainty",
      owner: "Regional PMO",
      updatedAt: "2026-07-11T15:40:00.000Z"
    }
  ];

  const crmRisks: CrmRiskRecord[] = [
    {
      id: "crk_nativa_docs",
      leadBucketId: "crm_nativa_demo",
      title: "Reservation backlog tied to missing document kits",
      category: "Closing",
      severity: "warning",
      owner: "Sales ops",
      status: "Checklist reinforcement in progress"
    },
    {
      id: "crk_bienestar_land",
      leadBucketId: "crm_bienestar_gov",
      title: "Land release uncertainty weakens forecast confidence",
      category: "Government control",
      severity: "critical",
      owner: "Regional PMO",
      status: "Waiting for final release confirmation"
    },
    {
      id: "crk_cobalto_tender",
      leadBucketId: "crm_cobalto_gov",
      title: "Tender validation extends cycle beyond target",
      category: "Cycle time",
      severity: "warning",
      owner: "Commercial coordinator",
      status: "Documents under review"
    }
  ];

  const hrWorkforces: HrWorkforceItemRecord[] = [
    {
      id: "wrk_torre_b_demo",
      companyId: "cmp_arcont_demo",
      code: "WF-101",
      contractorName: "Acabados del Sureste",
      frontName: "Torre B",
      activeHeadcount: 86,
      attendanceRate: 94,
      productivityRate: 91,
      complianceExpirations: 1,
      incidentCount: 0,
      safetyStatus: "controlled",
      nextAction: "Keep crew mix stable for interior finishing push",
      updatedAt: "2026-07-10T14:10:00.000Z"
    },
    {
      id: "wrk_torre_c_demo",
      companyId: "cmp_arcont_demo",
      code: "WF-114",
      contractorName: "Electro Norte",
      frontName: "Torre C",
      activeHeadcount: 42,
      attendanceRate: 88,
      productivityRate: 79,
      complianceExpirations: 2,
      incidentCount: 1,
      safetyStatus: "watch",
      nextAction: "Reinforce material coordination and attendance tracking",
      updatedAt: "2026-07-10T16:45:00.000Z"
    },
    {
      id: "wrk_urbanizacion_demo",
      companyId: "cmp_arcont_demo",
      code: "WF-123",
      contractorName: "Urbaniza MX",
      frontName: "Urbanizacion",
      activeHeadcount: 61,
      attendanceRate: 81,
      productivityRate: 72,
      complianceExpirations: 4,
      incidentCount: 2,
      safetyStatus: "critical",
      nextAction: "Assign replacement crews and close expiring contractor files",
      updatedAt: "2026-07-10T17:20:00.000Z"
    },
    {
      id: "wrk_bienestar_gov",
      companyId: "cmp_bienestar_gov",
      code: "WF-201",
      contractorName: "Cuadrillas Bienestar Oriente",
      frontName: "Poligono 3",
      activeHeadcount: 118,
      attendanceRate: 93,
      productivityRate: 84,
      complianceExpirations: 3,
      incidentCount: 1,
      safetyStatus: "watch",
      nextAction: "Close RTK attendance gaps before federal supervision visit",
      updatedAt: "2026-07-10T13:35:00.000Z"
    }
  ];

  const hrRisks: HrRiskRecord[] = [
    {
      id: "hrk_urbanizacion_capacity",
      workforceId: "wrk_urbanizacion_demo",
      title: "Urbanizacion front below required crew capacity",
      category: "capacity",
      severity: "critical",
      owner: "Site operations",
      status: "Assigning replacement subcontractor and redistributing crews"
    },
    {
      id: "hrk_torre_c_docs",
      workforceId: "wrk_torre_c_demo",
      title: "Electrical contractor policies expiring this week",
      category: "compliance",
      severity: "warning",
      owner: "Contract admin",
      status: "Collecting renewed insurance and safety evidence"
    },
    {
      id: "hrk_bienestar_attendance",
      workforceId: "wrk_bienestar_gov",
      title: "Attendance logs need reconciliation with field devices",
      category: "attendance",
      severity: "info",
      owner: "Field HR",
      status: "Reconciling checker export with site attendance roster"
    }
  ];

  const postSaleCases: PostSaleCaseRecord[] = [
    {
      id: "psc_handover_torre_b",
      companyId: "cmp_arcont_demo",
      code: "PS-DEL-088",
      caseType: "delivery",
      projectName: "Torre B Residencial",
      customerName: "Comite nivel 14",
      assetLabel: "14 unidades",
      owner: "Customer care",
      status: "customer_validation",
      priority: "urgent",
      slaHoursRemaining: 12,
      openFindings: 1,
      pendingVisits: 1,
      customerSatisfaction: 88,
      nextAction: "Close the final punch item and obtain the handover acceptance signatures",
      health: "watch",
      updatedAt: "2026-07-11T08:40:00.000Z"
    },
    {
      id: "psc_filtracion_b1406",
      companyId: "cmp_arcont_demo",
      code: "PS-WAR-1208",
      caseType: "warranty",
      projectName: "Torre B Residencial",
      customerName: "Fam. Valdez",
      assetLabel: "Unidad B-1406",
      owner: "Brigada Postventa 2",
      status: "in_progress",
      priority: "urgent",
      slaHoursRemaining: 18,
      openFindings: 1,
      pendingVisits: 1,
      customerSatisfaction: 72,
      nextAction: "Complete the corrective visit and capture signed customer closeout evidence",
      health: "watch",
      updatedAt: "2026-07-11T09:30:00.000Z"
    },
    {
      id: "psc_elevador_cobalto",
      companyId: "cmp_bienestar_gov",
      code: "PS-INC-224",
      caseType: "incident",
      projectName: "Infraestructura Vial y Vivienda",
      customerName: "Supervision federal",
      assetLabel: "Modulo de acceso 3",
      owner: "Regional PMO",
      status: "blocked",
      priority: "critical",
      slaHoursRemaining: -9,
      openFindings: 3,
      pendingVisits: 2,
      customerSatisfaction: 54,
      nextAction: "Release the supplier root-cause report and recover the blocked incident response",
      health: "critical",
      updatedAt: "2026-07-11T12:00:00.000Z"
    },
    {
      id: "psc_canceles_nativa",
      companyId: "cmp_arcont_demo",
      code: "PS-WAR-1331",
      caseType: "warranty",
      projectName: "Residencial Nativa",
      customerName: "Alejandra Cuevas",
      assetLabel: "Casa 27",
      owner: "Brigada Postventa 1",
      status: "scheduled",
      priority: "standard",
      slaHoursRemaining: 34,
      openFindings: 2,
      pendingVisits: 1,
      customerSatisfaction: 81,
      nextAction: "Confirm the scheduled visit window and carry the updated hardware replacement kit",
      health: "healthy",
      updatedAt: "2026-07-11T10:05:00.000Z"
    },
    {
      id: "psc_entrega_sur",
      companyId: "cmp_bienestar_gov",
      code: "PS-DEL-305",
      caseType: "delivery",
      projectName: "Paquete Bienestar Sur",
      customerName: "Comite vecinal",
      assetLabel: "8 viviendas",
      owner: "Entrega social",
      status: "triaged",
      priority: "urgent",
      slaHoursRemaining: 6,
      openFindings: 4,
      pendingVisits: 1,
      customerSatisfaction: 66,
      nextAction: "Prioritize unresolved utility punch items before the next community handover slot",
      health: "critical",
      updatedAt: "2026-07-11T11:20:00.000Z"
    }
  ];

  const postSaleRisks: PostSaleRiskRecord[] = [
    {
      id: "psr_handover_signoff",
      caseId: "psc_handover_torre_b",
      title: "One legal sign-off still blocks complete delivery acceptance",
      category: "handover",
      severity: "warning",
      owner: "Customer care",
      status: "Awaiting final homeowner signature pack"
    },
    {
      id: "psr_filtracion_repeat",
      caseId: "psc_filtracion_b1406",
      title: "Warranty case risks repeat visit if moisture test is not documented",
      category: "warranty",
      severity: "warning",
      owner: "Brigada Postventa 2",
      status: "Technician evidence checklist still open"
    },
    {
      id: "psr_incident_supplier",
      caseId: "psc_elevador_cobalto",
      title: "Supplier root cause is overdue and the SLA breach is already critical",
      category: "incident",
      severity: "critical",
      owner: "Regional PMO",
      status: "Escalated with supplier management and supervision"
    },
    {
      id: "psr_canceles_parts",
      caseId: "psc_canceles_nativa",
      title: "Replacement hardware must arrive before the scheduled customer visit",
      category: "materials",
      severity: "info",
      owner: "Brigada Postventa 1",
      status: "Kit release confirmed from warehouse"
    },
    {
      id: "psr_entrega_utilities",
      caseId: "psc_entrega_sur",
      title: "Utility punch items still prevent clean delivery to the community committee",
      category: "delivery",
      severity: "critical",
      owner: "Entrega social",
      status: "Cross-team utility closure plan requested"
    }
  ];

  const complianceCases: ComplianceCaseRecord[] = [
    {
      id: "cmpc_urbanizacion_addendum",
      companyId: "cmp_arcont_demo",
      code: "CMP-401",
      queueName: "Legal contracts",
      subject: "Urbanizacion etapa 2 addendum",
      unitOrContract: "Contrato URB-E2-14",
      owner: "Legal interno",
      status: "blocked",
      documentCompletion: 82,
      slaHoursRemaining: -6,
      openFindings: 2,
      health: "critical",
      nextAction: "Collect signed addendum and update approved contract version",
      updatedAt: "2026-07-11T11:15:00.000Z"
    },
    {
      id: "cmpc_promesas_homologacion",
      companyId: "cmp_arcont_demo",
      code: "CMP-417",
      queueName: "Sales closing",
      subject: "Promesas con clausula legacy",
      unitOrContract: "9 promesas pendientes",
      owner: "Sales ops",
      status: "at_risk",
      documentCompletion: 91,
      slaHoursRemaining: 18,
      openFindings: 3,
      health: "watch",
      nextAction: "Homologate templates before next signing wave",
      updatedAt: "2026-07-11T10:10:00.000Z"
    },
    {
      id: "cmpc_postventa_filtracion",
      companyId: "cmp_arcont_demo",
      code: "PST-1208",
      queueName: "Warranty",
      subject: "Filtracion menor en unidad B-1406",
      unitOrContract: "Unidad B-1406",
      owner: "Brigada Postventa 2",
      status: "in_progress",
      documentCompletion: 96,
      slaHoursRemaining: 18,
      openFindings: 1,
      health: "watch",
      nextAction: "Complete visit evidence and capture customer sign-off",
      updatedAt: "2026-07-11T09:30:00.000Z"
    },
    {
      id: "cmpc_handover_torre_b",
      companyId: "cmp_arcont_demo",
      code: "HND-088",
      queueName: "Handover",
      subject: "Entrega Torre B nivel 14",
      unitOrContract: "14 unidades",
      owner: "Customer care",
      status: "monitoring",
      documentCompletion: 94,
      slaHoursRemaining: 36,
      openFindings: 1,
      health: "healthy",
      nextAction: "Close remaining legal signatures before final handover pack",
      updatedAt: "2026-07-11T08:40:00.000Z"
    },
    {
      id: "cmpc_bienestar_evidence",
      companyId: "cmp_bienestar_gov",
      code: "GOV-224",
      queueName: "Government compliance",
      subject: "Expediente federal de evidencia",
      unitOrContract: "Paquete Bienestar Sur",
      owner: "Regional PMO",
      status: "at_risk",
      documentCompletion: 76,
      slaHoursRemaining: 10,
      openFindings: 4,
      health: "critical",
      nextAction: "Upload missing evidence and validate federal checklist",
      updatedAt: "2026-07-11T12:00:00.000Z"
    }
  ];

  const complianceRisks: ComplianceRiskRecord[] = [
    {
      id: "cmpr_addendum_version",
      caseId: "cmpc_urbanizacion_addendum",
      title: "Approved contract version is still missing in the legal folder",
      category: "versioning",
      severity: "critical",
      owner: "Legal interno",
      status: "Waiting for final signature and folder replacement"
    },
    {
      id: "cmpr_promesa_clause",
      caseId: "cmpc_promesas_homologacion",
      title: "Legacy clause exposure remains open across pending sales promises",
      category: "contract risk",
      severity: "warning",
      owner: "Sales ops",
      status: "Template update in progress before new signatures"
    },
    {
      id: "cmpr_postventa_signoff",
      caseId: "cmpc_postventa_filtracion",
      title: "Warranty case needs signed closure evidence from customer",
      category: "post-sale",
      severity: "info",
      owner: "Brigada Postventa 2",
      status: "Visit scheduled and closeout evidence pending"
    },
    {
      id: "cmpr_gov_checklist",
      caseId: "cmpc_bienestar_evidence",
      title: "Federal evidence checklist has missing support files",
      category: "government compliance",
      severity: "critical",
      owner: "Regional PMO",
      status: "Escalated for same-day evidence upload"
    }
  ];

  const integrationStreams: IntegrationStreamRecord[] = [
    {
      id: "int_revit_demo",
      companyId: "cmp_arcont_demo",
      code: "INT-501",
      streamName: "BIM sync",
      provider: "Autodesk Revit",
      domain: "Digital twin",
      health: "healthy",
      freshnessMinutes: 12,
      openAlerts: 0,
      linkedAssets: 2184,
      automationCoverage: 86,
      nextAction: "Extend asset metadata mapping to handover packages",
      updatedAt: "2026-07-11T12:20:00.000Z"
    },
    {
      id: "int_iot_demo",
      companyId: "cmp_arcont_demo",
      code: "INT-518",
      streamName: "Site sensors",
      provider: "IoT gateways",
      domain: "Telemetry",
      health: "watch",
      freshnessMinutes: 7,
      openAlerts: 2,
      linkedAssets: 426,
      automationCoverage: 78,
      nextAction: "Recover two offline gateways and normalize alert routing",
      updatedAt: "2026-07-11T12:24:00.000Z"
    },
    {
      id: "int_rtk_demo",
      companyId: "cmp_arcont_demo",
      code: "INT-532",
      streamName: "Drone RTK supervision",
      provider: "Field drone mesh",
      domain: "Progress capture",
      health: "watch",
      freshnessMinutes: 95,
      openAlerts: 1,
      linkedAssets: 164,
      automationCoverage: 67,
      nextAction: "Close weather-delayed flight gap and regenerate weekly orthomosaic",
      updatedAt: "2026-07-11T10:55:00.000Z"
    },
    {
      id: "int_starlink_gov",
      companyId: "cmp_bienestar_gov",
      code: "INT-610",
      streamName: "Remote site backbone",
      provider: "Starlink",
      domain: "Connectivity",
      health: "critical",
      freshnessMinutes: 45,
      openAlerts: 3,
      linkedAssets: 89,
      automationCoverage: 59,
      nextAction: "Stabilize remote link before next field data synchronization window",
      updatedAt: "2026-07-11T11:05:00.000Z"
    }
  ];

  const integrationRisks: IntegrationRiskRecord[] = [
    {
      id: "intr_gateway_alert",
      streamId: "int_iot_demo",
      title: "Two gateways remain offline and are degrading sensor continuity",
      category: "telemetry",
      severity: "warning",
      owner: "Connected operations",
      status: "Remote restart attempted and field visit pending"
    },
    {
      id: "intr_drone_backlog",
      streamId: "int_rtk_demo",
      title: "Weekly drone capture backlog is delaying progress reconciliation",
      category: "drone supervision",
      severity: "warning",
      owner: "VDC team",
      status: "Waiting for next safe weather window and RTK validation"
    },
    {
      id: "intr_starlink_outage",
      streamId: "int_starlink_gov",
      title: "Remote backbone instability threatens field synchronization",
      category: "connectivity",
      severity: "critical",
      owner: "Field infrastructure",
      status: "Escalated to connectivity provider and local redundancy under review"
    }
  ];

  const documentControlItems: DocumentControlItemRecord[] = [
    {
      id: "doc_rfi_torrec_demo",
      companyId: "cmp_arcont_demo",
      code: "RFI-218",
      documentType: "RFI",
      subject: "Cruce MEP con acabados",
      projectName: "Torre C",
      owner: "Project coordination",
      status: "awaiting_response",
      revisionCount: 2,
      turnaroundDays: 8.4,
      openComments: 6,
      health: "critical",
      nextAction: "Escalate response to design coordination and close field clash path",
      updatedAt: "2026-07-11T09:40:00.000Z"
    },
    {
      id: "doc_submittal_canceleria_demo",
      companyId: "cmp_arcont_demo",
      code: "SUB-144",
      documentType: "Submittal",
      subject: "Canceleria premium revision package",
      projectName: "Residencial Nativa",
      owner: "Procurement technical office",
      status: "in_review",
      revisionCount: 3,
      turnaroundDays: 4.1,
      openComments: 4,
      health: "watch",
      nextAction: "Resolve architect comments and reissue supplier package",
      updatedAt: "2026-07-11T10:25:00.000Z"
    },
    {
      id: "doc_transmittal_ifc_demo",
      companyId: "cmp_arcont_demo",
      code: "TRM-077",
      documentType: "Transmittal",
      subject: "IFC nivel 12 issued set",
      projectName: "Distrito Norte",
      owner: "Document control",
      status: "approved",
      revisionCount: 1,
      turnaroundDays: 1.2,
      openComments: 0,
      health: "healthy",
      nextAction: "Keep receipt evidence tied to contractor package",
      updatedAt: "2026-07-11T08:10:00.000Z"
    },
    {
      id: "doc_gov_minuta_bienestar",
      companyId: "cmp_bienestar_gov",
      code: "MIN-302",
      documentType: "Meeting note",
      subject: "Minuta de observaciones federales",
      projectName: "Paquete Bienestar Sur",
      owner: "Regional PMO",
      status: "blocked",
      revisionCount: 1,
      turnaroundDays: 6.7,
      openComments: 5,
      health: "critical",
      nextAction: "Close government observations and reissue evidence pack",
      updatedAt: "2026-07-11T11:30:00.000Z"
    }
  ];

  const documentControlRisks: DocumentControlRiskRecord[] = [
    {
      id: "docrfi_clash",
      itemId: "doc_rfi_torrec_demo",
      title: "Field clash remains unresolved and is now beyond target response window",
      category: "rfi",
      severity: "critical",
      owner: "Project coordination",
      status: "Escalated to design review with site team waiting for answer"
    },
    {
      id: "docsub_vendor_loop",
      itemId: "doc_submittal_canceleria_demo",
      title: "Supplier submittal is cycling through repeated technical comments",
      category: "submittal",
      severity: "warning",
      owner: "Procurement technical office",
      status: "Preparing consolidated response to avoid a fourth review loop"
    },
    {
      id: "docgov_minute",
      itemId: "doc_gov_minuta_bienestar",
      title: "Federal observation minute is blocking downstream evidence approval",
      category: "government control",
      severity: "critical",
      owner: "Regional PMO",
      status: "Waiting for corrected attachments and formal reissue"
    }
  ];

  const qualityInspections: QualityInspectionRecord[] = [
    {
      id: "qlt_torrec_bath_demo",
      companyId: "cmp_arcont_demo",
      code: "QIN-320",
      areaName: "Torre C · Banos muestra",
      checklistName: "Acabados y sellos",
      contractorName: "Acabados del Sureste",
      severity: "critical",
      openFindings: 5,
      evidenceCompletion: 82,
      releaseReadiness: 61,
      reworkRate: 6.2,
      status: "blocked",
      nextAction: "Correct alignment and upload closeout evidence before release",
      updatedAt: "2026-07-11T10:05:00.000Z"
    },
    {
      id: "qlt_torreb_lvl12_demo",
      companyId: "cmp_arcont_demo",
      code: "QIN-334",
      areaName: "Torre B · Acabados nivel 12",
      checklistName: "Punch list menor",
      contractorName: "Acabados del Sureste",
      severity: "major",
      openFindings: 3,
      evidenceCompletion: 91,
      releaseReadiness: 78,
      reworkRate: 3.6,
      status: "pending_release",
      nextAction: "Close cosmetic punch items and confirm release walk",
      updatedAt: "2026-07-11T09:00:00.000Z"
    },
    {
      id: "qlt_urbanizacion_demo",
      companyId: "cmp_arcont_demo",
      code: "QIN-347",
      areaName: "Urbanizacion E2",
      checklistName: "Base y nivelacion",
      contractorName: "Urbaniza MX",
      severity: "major",
      openFindings: 4,
      evidenceCompletion: 74,
      releaseReadiness: 68,
      reworkRate: 4.9,
      status: "in_progress",
      nextAction: "Finish base correction and attach georeferenced evidence",
      updatedAt: "2026-07-11T08:45:00.000Z"
    },
    {
      id: "qlt_bienestar_demo",
      companyId: "cmp_bienestar_gov",
      code: "QIN-402",
      areaName: "Paquete Bienestar Sur",
      checklistName: "Inspeccion de liberacion",
      contractorName: "Cuadrillas Bienestar Oriente",
      severity: "major",
      openFindings: 6,
      evidenceCompletion: 79,
      releaseReadiness: 65,
      reworkRate: 5.1,
      status: "blocked",
      nextAction: "Close federal observations before next release gate",
      updatedAt: "2026-07-11T11:15:00.000Z"
    }
  ];

  const qualityRisks: QualityRiskRecord[] = [
    {
      id: "qltr_torrec_seal",
      inspectionId: "qlt_torrec_bath_demo",
      title: "Canceleria alignment and wet seal issue still blocks release",
      category: "finish quality",
      severity: "critical",
      owner: "Site quality",
      status: "Waiting for contractor correction and new inspection round"
    },
    {
      id: "qltr_urbanizacion_base",
      inspectionId: "qlt_urbanizacion_demo",
      title: "Base and leveling issue still open in urbanization front",
      category: "field release",
      severity: "warning",
      owner: "Field QA",
      status: "Reinspection planned after contractor correction"
    },
    {
      id: "qltr_bienestar_release",
      inspectionId: "qlt_bienestar_demo",
      title: "Government release package still lacks complete evidence set",
      category: "handover quality",
      severity: "critical",
      owner: "Regional PMO",
      status: "Coordinating evidence closure with field and compliance"
    }
  ];

  const settings: SettingsRecord[] = [
    {
      companyId: "cmp_arcont_demo",
      timezone: "America/Merida",
      locale: "es-MX",
      currency: "MXN",
      fiscalCountry: "MX",
      satEnabled: true,
      fiscalRegime: "601"
    },
    {
      companyId: "cmp_bienestar_gov",
      timezone: "America/Mexico_City",
      locale: "es-MX",
      currency: "MXN",
      fiscalCountry: "MX",
      satEnabled: true,
      fiscalRegime: "603"
    }
  ];

  const refreshTokens: RefreshTokenRecord[] = [];
  const auditEvents: AuditEventRecord[] = [];

    return {
      companies,
      users,
      projects,
      projectRisks,
      dailyLogEntries,
      dailyLogRisks,
      procurementPackages,
      procurementRisks,
      inventoryLocations,
      inventoryRisks,
      machines,
      machineRisks,
      financeItems,
      financeRisks,
      crmLeadBuckets,
      crmRisks,
      hrWorkforces,
      hrRisks,
      postSaleCases,
      postSaleRisks,
      complianceCases,
      complianceRisks,
      integrationStreams,
      integrationRisks,
      documentControlItems,
      documentControlRisks,
      qualityInspections,
      qualityRisks,
      settings,
      refreshTokens,
      auditEvents
    };
}

export function createInMemoryPlatformRepository(): PlatformRepository {
  const state = createSeedState();

  return {
    async listCompanies() {
      return state.companies;
    },
    async listModules() {
      return moduleCatalog;
    },
    async listRoles() {
      return defaultRoles;
    },
    async listProjects(companyId: string) {
      return state.projects.filter((project) => project.companyId === companyId);
    },
    async listProjectRisks(companyId: string) {
      const projectIds = new Set(
        state.projects.filter((project) => project.companyId === companyId).map((project) => project.id)
      );
      return state.projectRisks.filter((risk) => projectIds.has(risk.projectId));
    },
    async listDailyLogEntries(companyId: string) {
      return state.dailyLogEntries.filter((entry) => entry.companyId === companyId);
    },
    async listDailyLogRisks(companyId: string) {
      const logIds = new Set(
        state.dailyLogEntries.filter((entry) => entry.companyId === companyId).map((entry) => entry.id)
      );
      return state.dailyLogRisks.filter((risk) => logIds.has(risk.logId));
    },
    async listProcurementPackages(companyId: string) {
      return state.procurementPackages.filter((item) => item.companyId === companyId);
    },
    async listProcurementRisks(companyId: string) {
      const packageIds = new Set(
        state.procurementPackages.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.procurementRisks.filter((risk) => packageIds.has(risk.packageId));
    },
    async listInventoryLocations(companyId: string) {
      return state.inventoryLocations.filter((location) => location.companyId === companyId);
    },
    async listInventoryRisks(companyId: string) {
      const locationIds = new Set(
        state.inventoryLocations.filter((location) => location.companyId === companyId).map((location) => location.id)
      );
      return state.inventoryRisks.filter((risk) => locationIds.has(risk.locationId));
    },
    async listMachines(companyId: string) {
      return state.machines.filter((machine) => machine.companyId === companyId);
    },
    async listMachineRisks(companyId: string) {
      const machineIds = new Set(
        state.machines.filter((machine) => machine.companyId === companyId).map((machine) => machine.id)
      );
      return state.machineRisks.filter((risk) => machineIds.has(risk.machineId));
    },
    async listFinanceItems(companyId: string) {
      return state.financeItems.filter((item) => item.companyId === companyId);
    },
    async listFinanceRisks(companyId: string) {
      const itemIds = new Set(
        state.financeItems.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.financeRisks.filter((risk) => itemIds.has(risk.ledgerId));
    },
    async listCrmLeadBuckets(companyId: string) {
      return state.crmLeadBuckets.filter((bucket) => bucket.companyId === companyId);
    },
    async listCrmRisks(companyId: string) {
      const bucketIds = new Set(
        state.crmLeadBuckets.filter((bucket) => bucket.companyId === companyId).map((bucket) => bucket.id)
      );
      return state.crmRisks.filter((risk) => bucketIds.has(risk.leadBucketId));
    },
    async listHrWorkforces(companyId: string) {
      return state.hrWorkforces.filter((item) => item.companyId === companyId);
    },
    async listHrRisks(companyId: string) {
      const workforceIds = new Set(
        state.hrWorkforces.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.hrRisks.filter((risk) => workforceIds.has(risk.workforceId));
    },
    async listPostSaleCases(companyId: string) {
      return state.postSaleCases.filter((item) => item.companyId === companyId);
    },
    async listPostSaleRisks(companyId: string) {
      const caseIds = new Set(
        state.postSaleCases.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.postSaleRisks.filter((risk) => caseIds.has(risk.caseId));
    },
    async listComplianceCases(companyId: string) {
      return state.complianceCases.filter((item) => item.companyId === companyId);
    },
    async listComplianceRisks(companyId: string) {
      const caseIds = new Set(
        state.complianceCases.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.complianceRisks.filter((risk) => caseIds.has(risk.caseId));
    },
    async listIntegrationStreams(companyId: string) {
      return state.integrationStreams.filter((item) => item.companyId === companyId);
    },
    async listIntegrationRisks(companyId: string) {
      const streamIds = new Set(
        state.integrationStreams.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.integrationRisks.filter((risk) => streamIds.has(risk.streamId));
    },
    async listDocumentControlItems(companyId: string) {
      return state.documentControlItems.filter((item) => item.companyId === companyId);
    },
    async listDocumentControlRisks(companyId: string) {
      const itemIds = new Set(
        state.documentControlItems.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.documentControlRisks.filter((risk) => itemIds.has(risk.itemId));
    },
    async listQualityInspections(companyId: string) {
      return state.qualityInspections.filter((item) => item.companyId === companyId);
    },
    async listQualityRisks(companyId: string) {
      const inspectionIds = new Set(
        state.qualityInspections.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.qualityRisks.filter((risk) => inspectionIds.has(risk.inspectionId));
    },
    async listUsers(companyId?: string) {
      if (!companyId) {
        return state.users;
      }

      return state.users.filter((user) => user.companyId === companyId);
    },
    async getCompanyById(companyId: string) {
      return state.companies.find((company) => company.id === companyId);
    },
    async getUserByEmail(email: string) {
      return state.users.find((user) => user.email === email);
    },
    async getUserById(userId: string) {
      return state.users.find((user) => user.id === userId);
    },
    async getRefreshTokenByHash(tokenHash: string) {
      return state.refreshTokens.find((token) => token.tokenHash === tokenHash);
    },
    async listRefreshTokensByUser(userId: string, companyId: string) {
      return state.refreshTokens
        .filter((token) => token.userId === userId && token.companyId === companyId)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async companyTaxIdExists(taxId: string) {
      return state.companies.some((company) => company.taxId.toLowerCase() === taxId.toLowerCase());
    },
    async userEmailExists(email: string) {
      return state.users.some((user) => user.email.toLowerCase() === email.toLowerCase());
    },
    async getSettings(companyId: string) {
      return state.settings.find((item) => item.companyId === companyId);
    },
    async saveProvisionedCompany(input: ProvisionCompanyInput) {
      const company: CompanyRecord = {
        id: createPrefixedId("cmp"),
        legalName: input.legalName,
        tradeName: input.tradeName,
        countryCode: input.countryCode,
        taxId: input.taxId,
        status: "active",
        enabledModules: Array.from(new Set(input.enabledModules))
      };

      const temporaryPassword = generateTemporaryPassword();
      const adminUser: UserRecord = {
        id: createPrefixedId("usr"),
        companyId: company.id,
        fullName: input.adminFullName,
        email: input.adminEmail,
        roleKey: "company-admin",
        status: "active",
        passwordHash: hashPassword(temporaryPassword)
      };

      const settings: SettingsRecord = {
        companyId: company.id,
        timezone: input.timezone,
        locale: input.locale,
        currency: input.currency,
        fiscalCountry: input.fiscalCountry,
        satEnabled: input.fiscalCountry === "MX",
        fiscalRegime: input.fiscalRegime
      };

      state.companies.push(company);
      state.users.push(adminUser);
      state.settings.push(settings);

      await this.addAuditEvent({
        companyId: company.id,
        actorUserId: adminUser.id,
        aggregateType: "company",
        aggregateId: company.id,
        action: "platform.company.provisioned",
        metadata: {
          enabledModules: company.enabledModules
        }
      });

      return {
        company,
        adminUser,
        settings,
        temporaryPassword
      };
    },
    async saveRefreshToken(input) {
      const record: RefreshTokenRecord = {
        id: createPrefixedId("rtk"),
        createdAt: new Date().toISOString(),
        ...input
      };

      state.refreshTokens.push(record);
      return record;
    },
    async revokeRefreshToken(tokenHash: string) {
      const token = state.refreshTokens.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
      if (!token) {
        return false;
      }

      token.revokedAt = new Date().toISOString();
      return true;
    },
    async revokeRefreshTokenById(tokenId: string, userId: string, companyId: string) {
      const token = state.refreshTokens.find(
        (item) =>
          item.id === tokenId &&
          item.userId === userId &&
          item.companyId === companyId &&
          !item.revokedAt
      );

      if (!token) {
        return false;
      }

      token.revokedAt = new Date().toISOString();
      return true;
    },
    async revokeRefreshTokens(userId: string, companyId: string) {
      let revoked = 0;

      for (const token of state.refreshTokens) {
        if (token.userId === userId && token.companyId === companyId && !token.revokedAt) {
          token.revokedAt = new Date().toISOString();
          revoked += 1;
        }
      }

      return revoked;
    },
    async recordAuthFailure(email: string, reason: AuthFailureReason, companyId?: string) {
      await this.addAuditEvent({
        companyId,
        aggregateType: "session",
        aggregateId: email,
        action: "auth.login.failed",
        metadata: {
          email,
          reason
        }
      });
    },
    async addAuditEvent(event) {
      state.auditEvents.push({
        id: createPrefixedId("aud"),
        companyId: event.companyId ?? null,
        actorUserId: event.actorUserId ?? null,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        action: event.action,
        metadata: event.metadata,
        createdAt: new Date().toISOString()
      });
    },
    async updateSettings(input) {
      const current = state.settings.find((item) => item.companyId === input.companyId);
      if (!current) {
        throw new Error("Settings not found in repository");
      }

      current.timezone = input.timezone;
      current.locale = input.locale;
      current.currency = input.currency;
      current.fiscalCountry = input.fiscalCountry;
      current.satEnabled = input.satEnabled;
      current.fiscalRegime = input.fiscalRegime;

      return current;
    },
    async replaceCompanyModules(input) {
      const company = state.companies.find((item) => item.id === input.companyId);
      if (!company) {
        throw new Error("Company not found in repository");
      }

      company.enabledModules = Array.from(new Set(input.enabledModules));
      return company;
    },
    async createUser(input) {
      const temporaryPassword = generateTemporaryPassword();
      const user: UserRecord = {
        id: createPrefixedId("usr"),
        companyId: input.companyId,
        fullName: input.fullName,
        email: input.email,
        roleKey: input.roleKey,
        status: input.status,
        passwordHash: hashPassword(temporaryPassword)
      };

      state.users.push(user);

      return {
        user,
        temporaryPassword
      };
    },
    async updateUserRole(input) {
      const user = state.users.find((item) => item.id === input.userId);
      if (!user) {
        throw new Error("User not found in repository");
      }

      user.roleKey = input.roleKey;
      return user;
    },
    async updateUserStatus(input) {
      const user = state.users.find((item) => item.id === input.userId);
      if (!user) {
        throw new Error("User not found in repository");
      }

      user.status = input.status;
      return user;
    },
    async updateProjectPortfolioItem(input) {
      const item = state.projects.find((candidate) => candidate.id === input.projectId);
      if (!item) {
        throw new Error("Project portfolio item not found in repository");
      }

      item.status = input.status;
      item.nextMilestone = input.nextMilestone;
      item.updatedAt = new Date().toISOString();
      return item;
    },
    async updateDailyLogEntry(input) {
      const entry = state.dailyLogEntries.find((candidate) => candidate.id === input.entryId);
      if (!entry) {
        throw new Error("Daily log entry not found in repository");
      }

      entry.status = input.status;
      entry.nextAction = input.nextAction;
      entry.updatedAt = new Date().toISOString();
      return entry;
    },
    async updateCrmLeadBucket(input) {
      const item = state.crmLeadBuckets.find((candidate) => candidate.id === input.leadBucketId);
      if (!item) {
        throw new Error("CRM lead bucket not found in repository");
      }

      item.health = input.health;
      item.signal = input.signal;
      item.updatedAt = new Date().toISOString();
      return item;
    },
    async updateFinanceLedgerItem(input) {
      const item = state.financeItems.find((candidate) => candidate.id === input.ledgerId);
      if (!item) {
        throw new Error("Finance ledger item not found in repository");
      }

      item.satStatus = input.satStatus;
      item.note = input.note;
      item.updatedAt = new Date().toISOString();
      return item;
    },
    async updateHrWorkforceItem(input) {
      const item = state.hrWorkforces.find((candidate) => candidate.id === input.workforceId);
      if (!item) {
        throw new Error("HR workforce item not found in repository");
      }

      item.safetyStatus = input.safetyStatus;
      item.nextAction = input.nextAction;
      item.updatedAt = new Date().toISOString();
      return item;
    },
    async updatePostSaleCase(input) {
      const postSaleCase = state.postSaleCases.find((item) => item.id === input.caseId);
      if (!postSaleCase) {
        throw new Error("Post-sale case not found in repository");
      }

      postSaleCase.status = input.status;
      postSaleCase.nextAction = input.nextAction;
      postSaleCase.updatedAt = new Date().toISOString();
      return postSaleCase;
    },
    async updateComplianceCase(input) {
      const complianceCase = state.complianceCases.find((item) => item.id === input.caseId);
      if (!complianceCase) {
        throw new Error("Compliance case not found in repository");
      }

      complianceCase.status = input.status;
      complianceCase.nextAction = input.nextAction;
      complianceCase.updatedAt = new Date().toISOString();
      return complianceCase;
    },
    async updateIntegrationStream(input) {
      const stream = state.integrationStreams.find((item) => item.id === input.streamId);
      if (!stream) {
        throw new Error("Integration stream not found in repository");
      }

      stream.health = input.health;
      stream.nextAction = input.nextAction;
      stream.updatedAt = new Date().toISOString();
      return stream;
    },
    async updateInventoryLocation(input) {
      const location = state.inventoryLocations.find((item) => item.id === input.locationId);
      if (!location) {
        throw new Error("Inventory location not found in repository");
      }

      location.stockHealth = input.stockHealth;
      location.nextAction = input.nextAction;
      location.updatedAt = new Date().toISOString();
      return location;
    },
    async updateMachineItem(input) {
      const machine = state.machines.find((item) => item.id === input.machineId);
      if (!machine) {
        throw new Error("Machine item not found in repository");
      }

      machine.status = input.status;
      machine.health = input.health;
      machine.nextAction = input.nextAction;
      machine.updatedAt = new Date().toISOString();
      return machine;
    },
    async updateDocumentControlItem(input) {
      const item = state.documentControlItems.find((candidate) => candidate.id === input.itemId);
      if (!item) {
        throw new Error("Document control item not found in repository");
      }

      item.status = input.status;
      item.nextAction = input.nextAction;
      item.updatedAt = new Date().toISOString();
      return item;
    },
    async updateProcurementPackage(input) {
      const procurementPackage = state.procurementPackages.find((item) => item.id === input.packageId);
      if (!procurementPackage) {
        throw new Error("Procurement package not found in repository");
      }

      procurementPackage.status = input.status;
      procurementPackage.nextAction = input.nextAction;
      procurementPackage.updatedAt = new Date().toISOString();
      return procurementPackage;
    },
    async updateQualityInspection(input) {
      const inspection = state.qualityInspections.find((item) => item.id === input.inspectionId);
      if (!inspection) {
        throw new Error("Quality inspection not found in repository");
      }

      inspection.status = input.status;
      inspection.nextAction = input.nextAction;
      inspection.updatedAt = new Date().toISOString();
      return inspection;
    },
    async listAuditEvents(companyId?: string, limit = 50) {
      const items = companyId
        ? state.auditEvents.filter((event) => event.companyId === companyId)
        : state.auditEvents;

      return items.slice().reverse().slice(0, limit);
    }
  };
}

function mapCompanyRow(row: Record<string, string | string[]>) {
  return {
    id: String(row.id),
    legalName: String(row.legal_name),
    tradeName: String(row.trade_name),
    countryCode: String(row.country_code),
    taxId: String(row.tax_id),
    status: row.status as CompanyRecord["status"],
    enabledModules: (row.enabled_modules as string[]) ?? []
  };
}

function mapUserRow(row: Record<string, string>) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    fullName: String(row.full_name),
    email: String(row.email),
    roleKey: String(row.role_key),
    status: row.status as UserRecord["status"],
    passwordHash: String(row.password_hash)
  };
}

function mapSettingsRow(row: Record<string, string | boolean>) {
  return {
    companyId: String(row.company_id),
    timezone: String(row.timezone),
    locale: String(row.locale),
    currency: String(row.currency),
    fiscalCountry: String(row.fiscal_country),
    satEnabled: Boolean(row.sat_enabled),
    fiscalRegime: String(row.fiscal_regime)
  };
}

function mapAuditEventRow(row: Record<string, unknown>): AuditEventRecord {
  return {
    id: String(row.id),
    companyId: row.company_id ? String(row.company_id) : null,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    aggregateType: String(row.aggregate_type),
    aggregateId: String(row.aggregate_id),
    action: String(row.action),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at)
  };
}

async function seedCatalogs(client: PoolClient) {
  for (const module of moduleCatalog) {
    await client.query(
      `
        insert into platform_modules (module_key, name, area, scope, description, enabled_by_default)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (module_key) do update
          set name = excluded.name,
              area = excluded.area,
              scope = excluded.scope,
              description = excluded.description,
              enabled_by_default = excluded.enabled_by_default
      `,
      [module.key, module.name, module.area, module.scope, module.description, module.enabledByDefault]
    );
  }

  for (const role of defaultRoles) {
    await client.query(
      `
        insert into platform_roles (role_key, name, scope)
        values ($1, $2, $3)
        on conflict (role_key) do update
          set name = excluded.name,
              scope = excluded.scope
      `,
      [role.key, role.name, role.scope]
    );

    await client.query("delete from platform_role_permissions where role_key = $1", [role.key]);

    for (const permission of role.permissions) {
      await client.query(
        `
          insert into platform_role_permissions (role_key, permission_key)
          values ($1, $2)
          on conflict do nothing
        `,
        [role.key, permission]
      );
    }
  }
}

export function createPostgresPlatformRepository(pool: Pool): PlatformRepository {
  return {
    async listCompanies() {
      const result = await pool.query(
        `
          select
            c.id,
            c.legal_name,
            c.trade_name,
            c.country_code,
            c.tax_id,
            c.status,
            coalesce(array_agg(cm.module_key order by cm.module_key) filter (where cm.enabled), '{}') as enabled_modules
          from platform_companies c
          left join platform_company_modules cm on cm.company_id = c.id
          where c.deleted_at is null
          group by c.id, c.legal_name, c.trade_name, c.country_code, c.tax_id, c.status
          order by c.trade_name
        `
      );

      return result.rows.map(mapCompanyRow);
    },
    async listModules() {
      return moduleCatalog;
    },
    async listRoles() {
      return defaultRoles;
    },
    async listProjects(companyId: string) {
      const result = await pool.query(
        `
          select
            p.id,
            p.company_id,
            p.external_key,
            p.name,
            p.client_name,
            p.segment,
            p.status,
            p.stage,
            p.progress_percent,
            p.schedule_variance_days,
            p.budget_health,
            p.quality_holds,
            p.permit_blockers,
            p.active_fronts,
            p.updated_at,
            p.next_milestone
          from project_portfolio p
          where p.company_id = $1
          order by p.updated_at desc
        `,
        [companyId]
      );

      return result.rows.map((row) => ({
        id: String(row.id),
        companyId: String(row.company_id),
        code: String(row.external_key),
        name: String(row.name),
        client: String(row.client_name),
        segment: String(row.segment),
        status: row.status as ProjectPortfolioItemRecord["status"],
        stage: String(row.stage),
        progress: Number(row.progress_percent),
        scheduleVarianceDays: Number(row.schedule_variance_days),
        budgetHealth: row.budget_health as ProjectPortfolioItemRecord["budgetHealth"],
        qualityHolds: Number(row.quality_holds),
        permitBlockers: Number(row.permit_blockers),
        activeFronts: Number(row.active_fronts),
        updatedAt: String(row.updated_at),
        nextMilestone: String(row.next_milestone)
      }));
    },
    async listProjectRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.project_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from project_risks r
          inner join project_portfolio p on p.id = r.project_id
          where p.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map((row) => ({
        id: String(row.id),
        projectId: String(row.project_id),
        title: String(row.title),
        category: String(row.category),
        severity: row.severity as ProjectRiskRecord["severity"],
        owner: String(row.owner_name),
        status: String(row.status)
      }));
    },
    async listDailyLogEntries(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listDailyLogRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listProcurementPackages(companyId: string) {
      const items = await this.listCompanies();
      void items;
      return [];
    },
    async listProcurementRisks(companyId: string) {
      const items = await this.listCompanies();
      void items;
      return [];
    },
    async listInventoryLocations(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listInventoryRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listMachines(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listMachineRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listFinanceItems(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listFinanceRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listCrmLeadBuckets(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listCrmRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listHrWorkforces(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listHrRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listPostSaleCases(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listPostSaleRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listComplianceCases(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listComplianceRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listIntegrationStreams(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listIntegrationRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listDocumentControlItems(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listDocumentControlRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listQualityInspections(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listQualityRisks(companyId: string) {
      const items = await this.listCompanies();
      void companyId;
      void items;
      return [];
    },
    async listUsers(companyId?: string) {
      const result = companyId
        ? await pool.query(
            `
              select id, company_id, full_name, email, role_key, status, password_hash
              from platform_users
              where deleted_at is null and company_id = $1
              order by full_name
            `,
            [companyId]
          )
        : await pool.query(
            `
              select id, company_id, full_name, email, role_key, status, password_hash
              from platform_users
              where deleted_at is null
              order by full_name
            `
          );

      return result.rows.map(mapUserRow);
    },
    async getCompanyById(companyId: string) {
      const result = await pool.query(
        `
          select
            c.id,
            c.legal_name,
            c.trade_name,
            c.country_code,
            c.tax_id,
            c.status,
            coalesce(array_agg(cm.module_key order by cm.module_key) filter (where cm.enabled), '{}') as enabled_modules
          from platform_companies c
          left join platform_company_modules cm on cm.company_id = c.id
          where c.id = $1 and c.deleted_at is null
          group by c.id, c.legal_name, c.trade_name, c.country_code, c.tax_id, c.status
        `,
        [companyId]
      );

      return result.rows[0] ? mapCompanyRow(result.rows[0]) : undefined;
    },
    async getUserByEmail(email: string) {
      const result = await pool.query(
        `
          select id, company_id, full_name, email, role_key, status, password_hash
          from platform_users
          where email = $1 and deleted_at is null
          limit 1
        `,
        [email]
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : undefined;
    },
    async getUserById(userId: string) {
      const result = await pool.query(
        `
          select id, company_id, full_name, email, role_key, status, password_hash
          from platform_users
          where id = $1 and deleted_at is null
          limit 1
        `,
        [userId]
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : undefined;
    },
    async getRefreshTokenByHash(tokenHash: string) {
      const result = await pool.query(
        `
          select id, user_id, company_id, token_hash, expires_at, created_at, revoked_at
          from auth_refresh_tokens
          where token_hash = $1
          limit 1
        `,
        [tokenHash]
      );

      const row = result.rows[0];
      if (!row) {
        return undefined;
      }

      return {
        id: String(row.id),
        userId: String(row.user_id),
        companyId: String(row.company_id),
        tokenHash: String(row.token_hash),
        expiresAt: String(row.expires_at),
        createdAt: String(row.created_at),
        revokedAt: row.revoked_at ? String(row.revoked_at) : undefined
      };
    },
    async listRefreshTokensByUser(userId: string, companyId: string) {
      const result = await pool.query(
        `
          select id, user_id, company_id, token_hash, expires_at, created_at, revoked_at
          from auth_refresh_tokens
          where user_id = $1 and company_id = $2
          order by created_at desc
        `,
        [userId, companyId]
      );

      return result.rows.map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        companyId: String(row.company_id),
        tokenHash: String(row.token_hash),
        expiresAt: String(row.expires_at),
        createdAt: String(row.created_at),
        revokedAt: row.revoked_at ? String(row.revoked_at) : undefined
      }));
    },
    async companyTaxIdExists(taxId: string) {
      const result = await pool.query(
        `
          select 1
          from platform_companies
          where lower(tax_id) = lower($1) and deleted_at is null
          limit 1
        `,
        [taxId]
      );

      return Boolean(result.rowCount);
    },
    async userEmailExists(email: string) {
      const result = await pool.query(
        `
          select 1
          from platform_users
          where lower(email) = lower($1) and deleted_at is null
          limit 1
        `,
        [email]
      );

      return Boolean(result.rowCount);
    },
    async getSettings(companyId: string) {
      const result = await pool.query(
        `
          select company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime
          from platform_company_settings
          where company_id = $1
          limit 1
        `,
        [companyId]
      );

      return result.rows[0] ? mapSettingsRow(result.rows[0]) : undefined;
    },
    async saveProvisionedCompany(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        await seedCatalogs(client);

        const company: CompanyRecord = {
          id: createPrefixedId("cmp"),
          legalName: input.legalName,
          tradeName: input.tradeName,
          countryCode: input.countryCode,
          taxId: input.taxId,
          status: "active",
          enabledModules: Array.from(new Set(input.enabledModules))
        };

        const temporaryPassword = generateTemporaryPassword();
        const adminUser: UserRecord = {
          id: createPrefixedId("usr"),
          companyId: company.id,
          fullName: input.adminFullName,
          email: input.adminEmail,
          roleKey: "company-admin",
          status: "active",
          passwordHash: hashPassword(temporaryPassword)
        };

        const settings: SettingsRecord = {
          companyId: company.id,
          timezone: input.timezone,
          locale: input.locale,
          currency: input.currency,
          fiscalCountry: input.fiscalCountry,
          satEnabled: input.fiscalCountry === "MX",
          fiscalRegime: input.fiscalRegime
        };

        await client.query(
          `
            insert into platform_companies
              (id, external_key, legal_name, trade_name, country_code, tax_id, status)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [company.id, company.id, company.legalName, company.tradeName, company.countryCode, company.taxId, company.status]
        );

        await client.query(
          `
            insert into platform_users
              (id, company_id, full_name, email, role_key, status, password_hash)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            adminUser.id,
            adminUser.companyId,
            adminUser.fullName,
            adminUser.email,
            adminUser.roleKey,
            adminUser.status,
            adminUser.passwordHash
          ]
        );

        await client.query(
          `
            insert into platform_company_settings
              (company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            settings.companyId,
            settings.timezone,
            settings.locale,
            settings.currency,
            settings.fiscalCountry,
            settings.satEnabled,
            settings.fiscalRegime
          ]
        );

        for (const moduleKey of company.enabledModules) {
          await client.query(
            `
              insert into platform_company_modules
                (company_id, module_key, enabled, activated_by)
              values ($1, $2, true, $3)
              on conflict (company_id, module_key) do update
                set enabled = excluded.enabled,
                    activated_by = excluded.activated_by
            `,
            [company.id, moduleKey, adminUser.id]
          );
        }

        await client.query(
          `
            insert into audit_events
              (id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata)
            values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
          [
            createPrefixedId("aud"),
            company.id,
            adminUser.id,
            "company",
            company.id,
            "platform.company.provisioned",
            JSON.stringify({ enabledModules: company.enabledModules })
          ]
        );

        await client.query("commit");

        return {
          company,
          adminUser,
          settings,
          temporaryPassword
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async saveRefreshToken(input) {
      const record: RefreshTokenRecord = {
        id: createPrefixedId("rtk"),
        createdAt: new Date().toISOString(),
        ...input
      };

      await pool.query(
        `
          insert into auth_refresh_tokens
            (id, user_id, company_id, token_hash, expires_at, created_at, revoked_at)
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          record.id,
          record.userId,
          record.companyId,
          record.tokenHash,
          record.expiresAt,
          record.createdAt,
          record.revokedAt ?? null
        ]
      );

      return record;
    },
    async revokeRefreshToken(tokenHash: string) {
      const result = await pool.query(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where token_hash = $1 and revoked_at is null
        `,
        [tokenHash]
      );

      return (result.rowCount ?? 0) > 0;
    },
    async revokeRefreshTokenById(tokenId: string, userId: string, companyId: string) {
      const result = await pool.query(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where id = $1 and user_id = $2 and company_id = $3 and revoked_at is null
        `,
        [tokenId, userId, companyId]
      );

      return (result.rowCount ?? 0) > 0;
    },
    async revokeRefreshTokens(userId: string, companyId: string) {
      const result = await pool.query(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where user_id = $1 and company_id = $2 and revoked_at is null
        `,
        [userId, companyId]
      );

      return result.rowCount ?? 0;
    },
    async recordAuthFailure(email: string, reason: AuthFailureReason, companyId?: string) {
      await this.addAuditEvent({
        companyId,
        aggregateType: "session",
        aggregateId: email,
        action: "auth.login.failed",
        metadata: {
          email,
          reason
        }
      });
    },
    async addAuditEvent(event) {
      await pool.query(
        `
          insert into audit_events
            (id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          createPrefixedId("aud"),
          event.companyId ?? null,
          event.actorUserId ?? null,
          event.aggregateType,
          event.aggregateId,
          event.action,
          JSON.stringify(event.metadata)
        ]
      );
    },
    async updateSettings(input) {
      const result = await pool.query(
        `
          update platform_company_settings
          set timezone = $2,
              locale = $3,
              currency = $4,
              fiscal_country = $5,
              sat_enabled = $6,
              fiscal_regime = $7,
              updated_at = now()
          where company_id = $1
          returning company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime
        `,
        [
          input.companyId,
          input.timezone,
          input.locale,
          input.currency,
          input.fiscalCountry,
          input.satEnabled,
          input.fiscalRegime
        ]
      );

      if (!result.rows[0]) {
        throw new Error("Settings not found in repository");
      }

      return mapSettingsRow(result.rows[0]);
    },
    async replaceCompanyModules(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        await seedCatalogs(client);

        const company = await this.getCompanyById(input.companyId);
        if (!company) {
          throw new Error("Company not found in repository");
        }

        await client.query("delete from platform_company_modules where company_id = $1", [input.companyId]);

        for (const moduleKey of input.enabledModules) {
          await client.query(
            `
              insert into platform_company_modules
                (company_id, module_key, enabled, activated_by)
              values ($1, $2, true, $3)
            `,
            [input.companyId, moduleKey, input.actorUserId ?? null]
          );
        }

        await client.query("commit");

        return {
          ...company,
          enabledModules: Array.from(new Set(input.enabledModules))
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async createUser(input) {
      const temporaryPassword = generateTemporaryPassword();
      const user: UserRecord = {
        id: createPrefixedId("usr"),
        companyId: input.companyId,
        fullName: input.fullName,
        email: input.email,
        roleKey: input.roleKey,
        status: input.status,
        passwordHash: hashPassword(temporaryPassword)
      };

      await pool.query(
        `
          insert into platform_users
            (id, company_id, full_name, email, role_key, status, password_hash)
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          user.id,
          user.companyId,
          user.fullName,
          user.email,
          user.roleKey,
          user.status,
          user.passwordHash
        ]
      );

      return {
        user,
        temporaryPassword
      };
    },
    async updateUserRole(input) {
      const result = await pool.query(
        `
          update platform_users
          set role_key = $2,
              updated_at = now()
          where id = $1 and deleted_at is null
          returning id, company_id, full_name, email, role_key, status, password_hash
        `,
        [input.userId, input.roleKey]
      );

      if (!result.rows[0]) {
        throw new Error("User not found in repository");
      }

      return mapUserRow(result.rows[0]);
    },
    async updateUserStatus(input) {
      const result = await pool.query(
        `
          update platform_users
          set status = $2,
              updated_at = now()
          where id = $1 and deleted_at is null
          returning id, company_id, full_name, email, role_key, status, password_hash
        `,
        [input.userId, input.status]
      );

      if (!result.rows[0]) {
        throw new Error("User not found in repository");
      }

      return mapUserRow(result.rows[0]);
    },
    async updateProjectPortfolioItem(input) {
      void input;
      throw new Error("Project portfolio updates are not implemented for the postgres repository yet");
    },
    async updateDailyLogEntry(input) {
      void input;
      throw new Error("Daily log updates are not implemented for the postgres repository yet");
    },
    async updateCrmLeadBucket(input) {
      void input;
      throw new Error("CRM lead bucket updates are not implemented for the postgres repository yet");
    },
    async updateFinanceLedgerItem(input) {
      void input;
      throw new Error("Finance ledger updates are not implemented for the postgres repository yet");
    },
    async updateHrWorkforceItem(input) {
      void input;
      throw new Error("HR workforce updates are not implemented for the postgres repository yet");
    },
    async updatePostSaleCase(input) {
      void input;
      throw new Error("Post-sale case updates are not implemented for the postgres repository yet");
    },
    async updateComplianceCase(input) {
      void input;
      throw new Error("Compliance case updates are not implemented for the postgres repository yet");
    },
    async updateIntegrationStream(input) {
      void input;
      throw new Error("Integration stream updates are not implemented for the postgres repository yet");
    },
    async updateInventoryLocation(input) {
      void input;
      throw new Error("Inventory location updates are not implemented for the postgres repository yet");
    },
    async updateMachineItem(input) {
      void input;
      throw new Error("Machine item updates are not implemented for the postgres repository yet");
    },
    async updateDocumentControlItem(input) {
      void input;
      throw new Error("Document control item updates are not implemented for the postgres repository yet");
    },
    async updateProcurementPackage(input) {
      void input;
      throw new Error("Procurement package updates are not implemented for the postgres repository yet");
    },
    async updateQualityInspection(input) {
      void input;
      throw new Error("Quality inspection updates are not implemented for the postgres repository yet");
    },
    async listAuditEvents(companyId?: string, limit = 50) {
      const result = companyId
        ? await pool.query(
            `
              select id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata, created_at
              from audit_events
              where company_id = $1
              order by created_at desc
              limit $2
            `,
            [companyId, limit]
          )
        : await pool.query(
            `
              select id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata, created_at
              from audit_events
              order by created_at desc
              limit $1
            `,
            [limit]
          );

      return result.rows.map(mapAuditEventRow);
    }
  };
}
