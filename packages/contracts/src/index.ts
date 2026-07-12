import { z } from "zod";

export const moduleAreas = [
  "platform",
  "sales",
  "projects",
  "procurement",
  "inventory",
  "finance",
  "hr",
  "post_sales",
  "compliance",
  "integrations"
] as const;

export const moduleScopes = ["platform", "operations"] as const;
export const companyStatuses = ["draft", "active", "suspended"] as const;
export const userStatuses = ["invited", "active", "disabled"] as const;
export const projectStatuses = ["planning", "active", "at_risk", "blocked", "closed"] as const;
export const projectBudgetHealth = ["on_track", "warning", "critical"] as const;

export const ModuleSchema = z.object({
  key: z.string(),
  name: z.string(),
  area: z.enum(moduleAreas),
  scope: z.enum(moduleScopes),
  description: z.string(),
  enabledByDefault: z.boolean()
});

export const CompanySchema = z.object({
  id: z.string(),
  legalName: z.string(),
  tradeName: z.string(),
  countryCode: z.string(),
  taxId: z.string(),
  status: z.enum(companyStatuses),
  enabledModules: z.array(z.string())
});

export const RoleSchema = z.object({
  key: z.string(),
  name: z.string(),
  scope: z.enum(moduleScopes),
  permissions: z.array(z.string())
});

export const UserSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  roleKey: z.string(),
  status: z.enum(userStatuses)
});

export const PlatformSettingsSchema = z.object({
  companyId: z.string(),
  timezone: z.string(),
  locale: z.string(),
  currency: z.string(),
  fiscalCountry: z.string(),
  satEnabled: z.boolean(),
  fiscalRegime: z.string()
});

export const AuthLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyId: z.string().optional()
});

export const AuthRefreshRequestSchema = z.object({
  refreshToken: z.string().min(16)
});

export const AuthLogoutRequestSchema = z.object({
  refreshToken: z.string().min(16).optional()
});

export const AuthSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresInSeconds: z.number().int().positive(),
  company: CompanySchema,
  user: UserSchema,
  permissions: z.array(z.string())
});

export const AuthCurrentSessionSchema = z.object({
  company: CompanySchema,
  user: UserSchema,
  role: RoleSchema,
  permissions: z.array(z.string())
});

export const AuthLogoutResponseSchema = z.object({
  revokedTokens: z.number().int().nonnegative()
});

export const AuthSessionActivitySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
  current: z.boolean()
});

export const AuthSessionActivitiesSchema = z.object({
  items: z.array(AuthSessionActivitySchema)
});

export const ProjectRiskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const ProjectPortfolioItemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  client: z.string(),
  segment: z.string(),
  status: z.enum(projectStatuses),
  stage: z.string(),
  progress: z.number().min(0).max(100),
  scheduleVarianceDays: z.number(),
  budgetHealth: z.enum(projectBudgetHealth),
  qualityHolds: z.number().int().nonnegative(),
  permitBlockers: z.number().int().nonnegative(),
  activeFronts: z.number().int().nonnegative(),
  updatedAt: z.string(),
  nextMilestone: z.string()
});

export const ProjectPortfolioOverviewSchema = z.object({
  summary: z.object({
    activeProjects: z.number().int().nonnegative(),
    averageProgress: z.number().min(0).max(100),
    qualityHolds: z.number().int().nonnegative(),
    permitBlockers: z.number().int().nonnegative()
  }),
  projects: z.array(ProjectPortfolioItemSchema),
  risks: z.array(ProjectRiskSchema),
  focusProject: ProjectPortfolioItemSchema.nullable()
});

export const UpdateProjectPortfolioItemRequestSchema = z.object({
  status: z.enum(projectStatuses),
  nextMilestone: z.string().min(8)
});

export const ProcurementRiskSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const ProcurementPackageSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  packageName: z.string(),
  projectName: z.string(),
  buyer: z.string(),
  status: z.enum(["draft", "sourcing", "awaiting_approval", "awarded", "blocked"]),
  budgetAmount: z.number().nonnegative(),
  bidCount: z.number().int().nonnegative(),
  approvalHours: z.number().nonnegative(),
  strategic: z.boolean(),
  supplierContention: z.number().nonnegative(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const ProcurementOverviewSchema = z.object({
  summary: z.object({
    openRequisitions: z.number().int().nonnegative(),
    averageApprovalHours: z.number().nonnegative(),
    strategicPackages: z.number().int().nonnegative(),
    averageBidCount: z.number().nonnegative()
  }),
  packages: z.array(ProcurementPackageSchema),
  risks: z.array(ProcurementRiskSchema),
  focusPackage: ProcurementPackageSchema.nullable()
});

export const UpdateProcurementPackageRequestSchema = z.object({
  status: z.enum(["draft", "sourcing", "awaiting_approval", "awarded", "blocked"]),
  nextAction: z.string().min(8)
});

export const CostControlExceptionSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const CostControlLineSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  companyId: z.string(),
  projectId: z.string().nullable(),
  code: z.string(),
  packageName: z.string(),
  projectName: z.string(),
  buyer: z.string(),
  procurementStatus: z.enum(["draft", "sourcing", "awaiting_approval", "awarded", "blocked"]),
  controlHealth: z.enum(["on_track", "watch", "critical"]),
  budgetAmount: z.number().nonnegative(),
  committedCost: z.number().nonnegative(),
  spentToDate: z.number().nonnegative(),
  forecastAtCompletion: z.number().nonnegative(),
  varianceAmount: z.number(),
  variancePercent: z.number(),
  projectProgress: z.number().min(0).max(100),
  scheduleVarianceDays: z.number(),
  cashExposure: z.number().nonnegative(),
  riskDrivers: z.array(z.string()),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const CostControlOverviewSchema = z.object({
  summary: z.object({
    trackedLines: z.number().int().nonnegative(),
    totalBudget: z.number().nonnegative(),
    committedCost: z.number().nonnegative(),
    forecastAtCompletion: z.number().nonnegative(),
    forecastVariance: z.number(),
    criticalLines: z.number().int().nonnegative()
  }),
  lines: z.array(CostControlLineSchema),
  exceptions: z.array(CostControlExceptionSchema),
  focusLine: CostControlLineSchema.nullable()
});

export const UpdateCostControlLineRequestSchema = z.object({
  procurementStatus: z.enum(["draft", "sourcing", "awaiting_approval", "awarded", "blocked"]),
  nextAction: z.string().min(8)
});

export const InventoryRiskSchema = z.object({
  id: z.string(),
  locationId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const InventoryLocationSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  locationName: z.string(),
  locationType: z.string(),
  trackedSkus: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(100),
  openVariances: z.number().int().nonnegative(),
  urgentReplenishments: z.number().int().nonnegative(),
  blockedReservations: z.number().int().nonnegative(),
  stockHealth: z.enum(["healthy", "watch", "critical"]),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const InventoryOverviewSchema = z.object({
  summary: z.object({
    trackedSkus: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(100),
    openVariances: z.number().int().nonnegative(),
    urgentReplenishments: z.number().int().nonnegative()
  }),
  locations: z.array(InventoryLocationSchema),
  risks: z.array(InventoryRiskSchema),
  focusLocation: InventoryLocationSchema.nullable()
});

export const UpdateInventoryLocationRequestSchema = z.object({
  stockHealth: z.enum(["healthy", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const FinanceRiskSchema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const FinanceLedgerItemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  metricName: z.string(),
  valueLabel: z.string(),
  trendLabel: z.string(),
  note: z.string(),
  cashImpact: z.number(),
  urgentItems: z.number().int().nonnegative(),
  closeReadiness: z.number().min(0).max(100),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  updatedAt: z.string()
});

export const FinanceOverviewSchema = z.object({
  summary: z.object({
    cashPosition: z.number(),
    urgentPayables: z.number().int().nonnegative(),
    closeReadiness: z.number().min(0).max(100),
    satStatus: z.enum(["controlled", "watch", "critical"])
  }),
  items: z.array(FinanceLedgerItemSchema),
  risks: z.array(FinanceRiskSchema),
  focusItem: FinanceLedgerItemSchema.nullable()
});

export const UpdateFinanceLedgerItemRequestSchema = z.object({
  satStatus: z.enum(["controlled", "watch", "critical"]),
  note: z.string().min(8)
});

export const CrmRiskSchema = z.object({
  id: z.string(),
  leadBucketId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const CrmLeadBucketSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  projectName: z.string(),
  segment: z.string(),
  openOpportunities: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(100),
  reservations: z.number().int().nonnegative(),
  forecastRevenue: z.number().nonnegative(),
  health: z.enum(["healthy", "watch", "critical"]),
  signal: z.string(),
  owner: z.string(),
  updatedAt: z.string()
});

export const CrmOverviewSchema = z.object({
  summary: z.object({
    qualifiedLeads: z.number().int().nonnegative(),
    visitConversion: z.number().min(0).max(100),
    reservations: z.number().int().nonnegative(),
    forecastRevenue: z.number().nonnegative()
  }),
  leadBuckets: z.array(CrmLeadBucketSchema),
  risks: z.array(CrmRiskSchema),
  focusBucket: CrmLeadBucketSchema.nullable()
});

export const UpdateCrmLeadBucketRequestSchema = z.object({
  health: z.enum(["healthy", "watch", "critical"]),
  signal: z.string().min(8)
});

export const HrRiskSchema = z.object({
  id: z.string(),
  workforceId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const HrWorkforceItemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  contractorName: z.string(),
  frontName: z.string(),
  activeHeadcount: z.number().int().nonnegative(),
  attendanceRate: z.number().min(0).max(100),
  productivityRate: z.number().min(0).max(100),
  complianceExpirations: z.number().int().nonnegative(),
  incidentCount: z.number().int().nonnegative(),
  safetyStatus: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const HrOverviewSchema = z.object({
  summary: z.object({
    activeHeadcount: z.number().int().nonnegative(),
    activeContractors: z.number().int().nonnegative(),
    attendanceRate: z.number().min(0).max(100),
    openIncidents: z.number().int().nonnegative()
  }),
  workforces: z.array(HrWorkforceItemSchema),
  risks: z.array(HrRiskSchema),
  focusWorkforce: HrWorkforceItemSchema.nullable()
});

export const UpdateHrWorkforceItemRequestSchema = z.object({
  safetyStatus: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const ComplianceRiskSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const ComplianceCaseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  queueName: z.string(),
  subject: z.string(),
  unitOrContract: z.string(),
  owner: z.string(),
  status: z.enum(["monitoring", "in_progress", "at_risk", "blocked", "closed"]),
  documentCompletion: z.number().min(0).max(100),
  slaHoursRemaining: z.number(),
  openFindings: z.number().int().nonnegative(),
  health: z.enum(["healthy", "watch", "critical"]),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const ComplianceOverviewSchema = z.object({
  summary: z.object({
    activeCases: z.number().int().nonnegative(),
    atRiskCases: z.number().int().nonnegative(),
    averageDocumentCompletion: z.number().min(0).max(100),
    openFindings: z.number().int().nonnegative()
  }),
  cases: z.array(ComplianceCaseSchema),
  risks: z.array(ComplianceRiskSchema),
  focusCase: ComplianceCaseSchema.nullable()
});

export const UpdateComplianceCaseRequestSchema = z.object({
  status: z.enum(["monitoring", "in_progress", "at_risk", "blocked", "closed"]),
  nextAction: z.string().min(8)
});

export const IntegrationRiskSchema = z.object({
  id: z.string(),
  streamId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const IntegrationStreamSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  streamName: z.string(),
  provider: z.string(),
  domain: z.string(),
  health: z.enum(["healthy", "watch", "critical"]),
  freshnessMinutes: z.number().int().nonnegative(),
  openAlerts: z.number().int().nonnegative(),
  linkedAssets: z.number().int().nonnegative(),
  automationCoverage: z.number().min(0).max(100),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const IntegrationOverviewSchema = z.object({
  summary: z.object({
    liveStreams: z.number().int().nonnegative(),
    criticalAlerts: z.number().int().nonnegative(),
    averageCoverage: z.number().min(0).max(100),
    linkedAssets: z.number().int().nonnegative()
  }),
  streams: z.array(IntegrationStreamSchema),
  risks: z.array(IntegrationRiskSchema),
  focusStream: IntegrationStreamSchema.nullable()
});

export const UpdateIntegrationStreamRequestSchema = z.object({
  health: z.enum(["healthy", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const DocumentControlRiskSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const DocumentControlItemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  documentType: z.string(),
  subject: z.string(),
  projectName: z.string(),
  owner: z.string(),
  status: z.enum(["issued", "in_review", "awaiting_response", "approved", "blocked"]),
  revisionCount: z.number().int().nonnegative(),
  turnaroundDays: z.number().nonnegative(),
  openComments: z.number().int().nonnegative(),
  health: z.enum(["healthy", "watch", "critical"]),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const DocumentControlOverviewSchema = z.object({
  summary: z.object({
    openRfis: z.number().int().nonnegative(),
    activeSubmittals: z.number().int().nonnegative(),
    controlledVersions: z.number().int().nonnegative(),
    averageTurnaroundDays: z.number().nonnegative()
  }),
  items: z.array(DocumentControlItemSchema),
  risks: z.array(DocumentControlRiskSchema),
  focusItem: DocumentControlItemSchema.nullable()
});

export const UpdateDocumentControlItemRequestSchema = z.object({
  status: z.enum(["issued", "in_review", "awaiting_response", "approved", "blocked"]),
  nextAction: z.string().min(8)
});

export const QualityRiskSchema = z.object({
  id: z.string(),
  inspectionId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const QualityInspectionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  areaName: z.string(),
  checklistName: z.string(),
  contractorName: z.string(),
  severity: z.enum(["minor", "major", "critical"]),
  openFindings: z.number().int().nonnegative(),
  evidenceCompletion: z.number().min(0).max(100),
  releaseReadiness: z.number().min(0).max(100),
  reworkRate: z.number().min(0),
  status: z.enum(["scheduled", "in_progress", "pending_release", "released", "blocked"]),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const QualityOverviewSchema = z.object({
  summary: z.object({
    inspections: z.number().int().nonnegative(),
    openFindings: z.number().int().nonnegative(),
    releaseReadiness: z.number().min(0).max(100),
    averageReworkRate: z.number().min(0)
  }),
  inspectionsBoard: z.array(QualityInspectionSchema),
  risks: z.array(QualityRiskSchema),
  focusInspection: QualityInspectionSchema.nullable()
});

export const UpdateQualityInspectionRequestSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "pending_release", "released", "blocked"]),
  nextAction: z.string().min(8)
});

export const CompanyModuleStateSchema = z.object({
  companyId: z.string(),
  module: ModuleSchema,
  enabled: z.boolean()
});

export const PlatformBootstrapSchema = z.object({
  company: CompanySchema,
  settings: PlatformSettingsSchema,
  user: UserSchema,
  roles: z.array(RoleSchema),
  companyUsers: z.array(UserSchema),
  availableModules: z.array(ModuleSchema),
  companyModules: z.array(CompanyModuleStateSchema),
  permissions: z.array(z.string())
});

export const ProvisionCompanyRequestSchema = z.object({
  legalName: z.string().min(3),
  tradeName: z.string().min(2),
  taxId: z.string().min(6),
  countryCode: z.string().length(2).default("MX"),
  timezone: z.string().default("America/Mexico_City"),
  locale: z.string().default("es-MX"),
  currency: z.string().length(3).default("MXN"),
  fiscalCountry: z.string().length(2).default("MX"),
  fiscalRegime: z.string().default("601"),
  adminFullName: z.string().min(3),
  adminEmail: z.string().email(),
  enabledModules: z.array(z.string()).default([
    "platform.companies",
    "platform.identity"
  ])
});

export const ProvisionCompanyResponseSchema = z.object({
  company: CompanySchema,
  adminUser: UserSchema,
  settings: PlatformSettingsSchema,
  companyModules: z.array(CompanyModuleStateSchema),
  temporaryPassword: z.string()
});

export const UpdatePlatformSettingsRequestSchema = z.object({
  timezone: z.string(),
  locale: z.string(),
  currency: z.string().length(3),
  fiscalCountry: z.string().length(2),
  satEnabled: z.boolean(),
  fiscalRegime: z.string()
});

export const UpdateCompanyModulesRequestSchema = z.object({
  enabledModules: z.array(z.string()).min(1)
});

export const CreatePlatformUserRequestSchema = z.object({
  companyId: z.string(),
  fullName: z.string().min(3),
  email: z.string().email(),
  roleKey: z.string(),
  status: z.enum(userStatuses).default("invited")
});

export const UpdatePlatformUserRoleRequestSchema = z.object({
  roleKey: z.string()
});

export const UpdatePlatformUserStatusRequestSchema = z.object({
  status: z.enum(userStatuses)
});

export const AuditEventSchema = z.object({
  id: z.string(),
  companyId: z.string().nullable(),
  actorUserId: z.string().nullable(),
  aggregateType: z.string(),
  aggregateId: z.string(),
  action: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string()
});

export const CompanyDetailSchema = z.object({
  company: CompanySchema,
  settings: PlatformSettingsSchema,
  companyModules: z.array(CompanyModuleStateSchema),
  users: z.array(UserSchema),
  stats: z.object({
    totalUsers: z.number().int().nonnegative(),
    activeUsers: z.number().int().nonnegative(),
    enabledModuleCount: z.number().int().nonnegative(),
    disabledModuleCount: z.number().int().nonnegative()
  })
});

export const PlatformDashboardSummarySchema = z.object({
  totals: z.object({
    companies: z.number().int().nonnegative(),
    activeCompanies: z.number().int().nonnegative(),
    users: z.number().int().nonnegative(),
    activeUsers: z.number().int().nonnegative(),
    enabledModules: z.number().int().nonnegative(),
    auditEvents: z.number().int().nonnegative()
  }),
  byArea: z.array(
    z.object({
      area: z.enum(moduleAreas),
      enabledCompanies: z.number().int().nonnegative()
    })
  ),
  latestAuditEvents: z.array(AuditEventSchema),
  focusCompany: CompanySchema.nullable()
});

export const PlatformUserDetailSchema = z.object({
  user: UserSchema,
  company: CompanySchema,
  role: RoleSchema,
  permissions: z.array(z.string())
});

export const CreatePlatformUserResponseSchema = z.object({
  user: UserSchema,
  temporaryPassword: z.string(),
  role: RoleSchema,
  permissions: z.array(z.string())
});
export type ModuleContract = z.infer<typeof ModuleSchema>;
export type CompanyContract = z.infer<typeof CompanySchema>;
export type RoleContract = z.infer<typeof RoleSchema>;
export type UserContract = z.infer<typeof UserSchema>;
export type PlatformSettingsContract = z.infer<typeof PlatformSettingsSchema>;
export type AuthLoginRequestContract = z.infer<typeof AuthLoginRequestSchema>;
export type AuthRefreshRequestContract = z.infer<typeof AuthRefreshRequestSchema>;
export type AuthLogoutRequestContract = z.infer<typeof AuthLogoutRequestSchema>;
export type AuthSessionContract = z.infer<typeof AuthSessionSchema>;
export type AuthCurrentSessionContract = z.infer<typeof AuthCurrentSessionSchema>;
export type AuthLogoutResponseContract = z.infer<typeof AuthLogoutResponseSchema>;
export type AuthSessionActivityContract = z.infer<typeof AuthSessionActivitySchema>;
export type AuthSessionActivitiesContract = z.infer<typeof AuthSessionActivitiesSchema>;
export type ProjectRiskContract = z.infer<typeof ProjectRiskSchema>;
export type ProjectPortfolioItemContract = z.infer<typeof ProjectPortfolioItemSchema>;
export type ProjectPortfolioOverviewContract = z.infer<typeof ProjectPortfolioOverviewSchema>;
export type UpdateProjectPortfolioItemRequestContract = z.infer<typeof UpdateProjectPortfolioItemRequestSchema>;
export type ProcurementRiskContract = z.infer<typeof ProcurementRiskSchema>;
export type ProcurementPackageContract = z.infer<typeof ProcurementPackageSchema>;
export type ProcurementOverviewContract = z.infer<typeof ProcurementOverviewSchema>;
export type UpdateProcurementPackageRequestContract = z.infer<typeof UpdateProcurementPackageRequestSchema>;
export type CostControlExceptionContract = z.infer<typeof CostControlExceptionSchema>;
export type CostControlLineContract = z.infer<typeof CostControlLineSchema>;
export type CostControlOverviewContract = z.infer<typeof CostControlOverviewSchema>;
export type UpdateCostControlLineRequestContract = z.infer<typeof UpdateCostControlLineRequestSchema>;
export type InventoryRiskContract = z.infer<typeof InventoryRiskSchema>;
export type InventoryLocationContract = z.infer<typeof InventoryLocationSchema>;
export type InventoryOverviewContract = z.infer<typeof InventoryOverviewSchema>;
export type UpdateInventoryLocationRequestContract = z.infer<typeof UpdateInventoryLocationRequestSchema>;
export type FinanceRiskContract = z.infer<typeof FinanceRiskSchema>;
export type FinanceLedgerItemContract = z.infer<typeof FinanceLedgerItemSchema>;
export type FinanceOverviewContract = z.infer<typeof FinanceOverviewSchema>;
export type UpdateFinanceLedgerItemRequestContract = z.infer<typeof UpdateFinanceLedgerItemRequestSchema>;
export type CrmRiskContract = z.infer<typeof CrmRiskSchema>;
export type CrmLeadBucketContract = z.infer<typeof CrmLeadBucketSchema>;
export type CrmOverviewContract = z.infer<typeof CrmOverviewSchema>;
export type UpdateCrmLeadBucketRequestContract = z.infer<typeof UpdateCrmLeadBucketRequestSchema>;
export type HrRiskContract = z.infer<typeof HrRiskSchema>;
export type HrWorkforceItemContract = z.infer<typeof HrWorkforceItemSchema>;
export type HrOverviewContract = z.infer<typeof HrOverviewSchema>;
export type UpdateHrWorkforceItemRequestContract = z.infer<typeof UpdateHrWorkforceItemRequestSchema>;
export type ComplianceRiskContract = z.infer<typeof ComplianceRiskSchema>;
export type ComplianceCaseContract = z.infer<typeof ComplianceCaseSchema>;
export type ComplianceOverviewContract = z.infer<typeof ComplianceOverviewSchema>;
export type UpdateComplianceCaseRequestContract = z.infer<typeof UpdateComplianceCaseRequestSchema>;
export type IntegrationRiskContract = z.infer<typeof IntegrationRiskSchema>;
export type IntegrationStreamContract = z.infer<typeof IntegrationStreamSchema>;
export type IntegrationOverviewContract = z.infer<typeof IntegrationOverviewSchema>;
export type UpdateIntegrationStreamRequestContract = z.infer<typeof UpdateIntegrationStreamRequestSchema>;
export type DocumentControlRiskContract = z.infer<typeof DocumentControlRiskSchema>;
export type DocumentControlItemContract = z.infer<typeof DocumentControlItemSchema>;
export type DocumentControlOverviewContract = z.infer<typeof DocumentControlOverviewSchema>;
export type UpdateDocumentControlItemRequestContract = z.infer<typeof UpdateDocumentControlItemRequestSchema>;
export type QualityRiskContract = z.infer<typeof QualityRiskSchema>;
export type QualityInspectionContract = z.infer<typeof QualityInspectionSchema>;
export type QualityOverviewContract = z.infer<typeof QualityOverviewSchema>;
export type UpdateQualityInspectionRequestContract = z.infer<typeof UpdateQualityInspectionRequestSchema>;
export type CompanyModuleStateContract = z.infer<typeof CompanyModuleStateSchema>;
export type PlatformBootstrapContract = z.infer<typeof PlatformBootstrapSchema>;
export type ProvisionCompanyRequestContract = z.infer<typeof ProvisionCompanyRequestSchema>;
export type ProvisionCompanyResponseContract = z.infer<typeof ProvisionCompanyResponseSchema>;
export type UpdatePlatformSettingsRequestContract = z.infer<typeof UpdatePlatformSettingsRequestSchema>;
export type UpdateCompanyModulesRequestContract = z.infer<typeof UpdateCompanyModulesRequestSchema>;
export type CreatePlatformUserRequestContract = z.infer<typeof CreatePlatformUserRequestSchema>;
export type UpdatePlatformUserRoleRequestContract = z.infer<typeof UpdatePlatformUserRoleRequestSchema>;
export type UpdatePlatformUserStatusRequestContract = z.infer<typeof UpdatePlatformUserStatusRequestSchema>;
export type AuditEventContract = z.infer<typeof AuditEventSchema>;
export type CompanyDetailContract = z.infer<typeof CompanyDetailSchema>;
export type PlatformDashboardSummaryContract = z.infer<typeof PlatformDashboardSummarySchema>;
export type PlatformUserDetailContract = z.infer<typeof PlatformUserDetailSchema>;
export type CreatePlatformUserResponseContract = z.infer<typeof CreatePlatformUserResponseSchema>;

export const moduleCatalog: ModuleContract[] = [
  {
    key: "platform.companies",
    name: "Company Management",
    area: "platform",
    scope: "platform",
    description: "Tenant creation, lifecycle, branding, and settings.",
    enabledByDefault: true
  },
  {
    key: "platform.identity",
    name: "Identity and Access",
    area: "platform",
    scope: "platform",
    description: "Users, roles, permissions, and security policies.",
    enabledByDefault: true
  },
  {
    key: "sales.crm",
    name: "CRM and Sales",
    area: "sales",
    scope: "operations",
    description: "Leads, funnels, units, quotations, and closings.",
    enabledByDefault: false
  },
  {
    key: "projects.control",
    name: "Project Control",
    area: "projects",
    scope: "operations",
    description: "Schedules, progress, site supervision, and quality.",
    enabledByDefault: false
  },
  {
    key: "procurement.purchasing",
    name: "Procurement",
    area: "procurement",
    scope: "operations",
    description: "Requisitions, purchase orders, suppliers, and approvals.",
    enabledByDefault: false
  },
  {
    key: "inventory.warehouse",
    name: "Warehouse",
    area: "inventory",
    scope: "operations",
    description: "Stock, movements, cost traceability, and field supply.",
    enabledByDefault: false
  },
  {
    key: "finance.accounting",
    name: "Finance and Accounting",
    area: "finance",
    scope: "operations",
    description: "Treasury, accounting close, SAT controls, and reports.",
    enabledByDefault: false
  },
  {
    key: "hr.workforce",
    name: "Workforce",
    area: "hr",
    scope: "operations",
    description: "Crew management, attendance, payroll inputs, and safety.",
    enabledByDefault: false
  },
  {
    key: "compliance.postsale",
    name: "Post-sale and Compliance",
    area: "post_sales",
    scope: "operations",
    description: "Warranty, legal folders, handover, and compliance cases.",
    enabledByDefault: false
  },
  {
    key: "integrations.field-data",
    name: "Integrations and Telemetry",
    area: "integrations",
    scope: "operations",
    description: "BIM, CAD, drones, sensors, clocks, and external APIs.",
    enabledByDefault: false
  }
];

export const defaultRoles: RoleContract[] = [
  {
    key: "platform-owner",
    name: "Platform Owner",
    scope: "platform",
    permissions: ["platform:*", "companies:*", "modules:*", "users:*", "settings:*"]
  },
  {
    key: "company-admin",
    name: "Company Admin",
    scope: "operations",
    permissions: ["company:*", "users:read", "users:write", "settings:read", "settings:write"]
  },
  {
    key: "operations-manager",
    name: "Operations Manager",
    scope: "operations",
    permissions: ["sales:*", "projects:*", "procurement:*", "inventory:*", "finance:read"]
  }
];
