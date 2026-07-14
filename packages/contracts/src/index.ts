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
  latestDailyLogStatus: z.enum(["draft", "submitted", "approved", "flagged", "unknown"]),
  latestDailyLogDate: z.string().nullable(),
  qualityReleaseReadiness: z.number().min(0).max(100),
  subcontractHealth: z.enum(["controlled", "watch", "critical", "unknown"]),
  pendingDestajo: z.number().nonnegative(),
  updatedAt: z.string(),
  nextMilestone: z.string()
});

export const ProjectPortfolioOverviewSchema = z.object({
  summary: z.object({
    activeProjects: z.number().int().nonnegative(),
    averageProgress: z.number().min(0).max(100),
    qualityHolds: z.number().int().nonnegative(),
    permitBlockers: z.number().int().nonnegative(),
    executionRiskProjects: z.number().int().nonnegative()
  }),
  projects: z.array(ProjectPortfolioItemSchema),
  risks: z.array(ProjectRiskSchema),
  focusProject: ProjectPortfolioItemSchema.nullable()
});

export const UpdateProjectPortfolioItemRequestSchema = z.object({
  status: z.enum(projectStatuses),
  nextMilestone: z.string().min(8)
});

export const CreateProjectPortfolioItemRequestSchema = z.object({
  code: z.string().min(3),
  name: z.string().min(3),
  client: z.string().min(3),
  segment: z.string().min(3),
  status: z.enum(projectStatuses),
  stage: z.string().min(3),
  progress: z.number().min(0).max(100),
  scheduleVarianceDays: z.number(),
  budgetHealth: z.enum(projectBudgetHealth),
  qualityHolds: z.number().int().nonnegative(),
  permitBlockers: z.number().int().nonnegative(),
  activeFronts: z.number().int().nonnegative(),
  nextMilestone: z.string().min(8)
});

export const DailyLogRiskSchema = z.object({
  id: z.string(),
  logId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const DailyLogEntrySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  projectName: z.string(),
  frontName: z.string(),
  supervisor: z.string(),
  logDate: z.string(),
  shift: z.enum(["morning", "mixed", "night"]),
  weather: z.enum(["clear", "windy", "rain", "storm"]),
  status: z.enum(["draft", "submitted", "approved", "flagged"]),
  progressPercent: z.number().min(0).max(100),
  workforceCount: z.number().int().nonnegative(),
  incidentsCount: z.number().int().nonnegative(),
  blockersCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  concretePourM3: z.number().nonnegative(),
  projectStatus: z.enum(projectStatuses),
  qualityOpenFindings: z.number().int().nonnegative(),
  qualityReleaseReadiness: z.number().min(0).max(100),
  subcontractHealth: z.enum(["controlled", "watch", "critical", "unknown"]),
  pendingDestajo: z.number().nonnegative(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const DailyLogOverviewSchema = z.object({
  summary: z.object({
    submittedToday: z.number().int().nonnegative(),
    approvedLogs: z.number().int().nonnegative(),
    flaggedLogs: z.number().int().nonnegative(),
    totalWorkforce: z.number().int().nonnegative(),
    pendingEvidence: z.number().int().nonnegative(),
    averageProgress: z.number().min(0).max(100),
    executionRiskLogs: z.number().int().nonnegative()
  }),
  entries: z.array(DailyLogEntrySchema),
  risks: z.array(DailyLogRiskSchema),
  focusEntry: DailyLogEntrySchema.nullable()
});

export const UpdateDailyLogEntryRequestSchema = z.object({
  status: z.enum(["draft", "submitted", "approved", "flagged"]),
  nextAction: z.string().min(8)
});

export const CreateDailyLogEntryRequestSchema = z.object({
  projectName: z.string().min(3),
  frontName: z.string().min(3),
  supervisor: z.string().min(3),
  logDate: z.string().min(10),
  shift: z.enum(["morning", "mixed", "night"]),
  weather: z.enum(["clear", "windy", "rain", "storm"]),
  status: z.enum(["draft", "submitted", "approved", "flagged"]),
  progressPercent: z.number().min(0).max(100),
  workforceCount: z.number().int().nonnegative(),
  incidentsCount: z.number().int().nonnegative(),
  blockersCount: z.number().int().nonnegative(),
  evidenceCount: z.number().int().nonnegative(),
  concretePourM3: z.number().nonnegative(),
  nextAction: z.string().min(8)
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

export const ProcurementRequisitionRiskSchema = z.object({
  id: z.string(),
  requisitionId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const ProcurementRequisitionSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  projectName: z.string(),
  frontName: z.string(),
  requestedBy: z.string(),
  category: z.string(),
  status: z.enum(["draft", "submitted", "approved", "sourcing", "blocked"]),
  requestedItems: z.number().int().nonnegative(),
  budgetAmount: z.number().nonnegative(),
  urgency: z.enum(["planned", "watch", "critical"]),
  approvalHours: z.number().nonnegative(),
  supplierCoverage: z.number().int().nonnegative(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const ProcurementRequisitionOriginSchema = z.object({
  requisitionId: z.string(),
  fieldRequestId: z.string(),
  projectName: z.string(),
  frontName: z.string(),
  requestedBy: z.string(),
  summary: z.string(),
  detail: z.string(),
  requestedVolume: z.string(),
  urgency: z.enum(["planned", "watch", "critical"]),
  status: z.enum(["requested", "converted", "cancelled"]),
  nextAction: z.string(),
  createdAt: z.string()
});

export const ProcurementRequisitionsOverviewSchema = z.object({
  summary: z.object({
    openRequisitions: z.number().int().nonnegative(),
    pendingApproval: z.number().int().nonnegative(),
    criticalUrgency: z.number().int().nonnegative(),
    averageApprovalHours: z.number().nonnegative(),
    supplierCoverage: z.number().nonnegative()
  }),
  requisitions: z.array(ProcurementRequisitionSchema),
  risks: z.array(ProcurementRequisitionRiskSchema),
  origins: z.array(ProcurementRequisitionOriginSchema),
  focusRequisition: ProcurementRequisitionSchema.nullable()
});

export const CreateProcurementRequisitionRequestSchema = z.object({
  projectName: z.string().min(3),
  frontName: z.string().min(3),
  requestedBy: z.string().min(3),
  category: z.string().min(3),
  status: z.enum(["draft", "submitted", "approved", "sourcing", "blocked"]).default("draft"),
  requestedItems: z.number().int().nonnegative(),
  budgetAmount: z.number().nonnegative(),
  urgency: z.enum(["planned", "watch", "critical"]),
  approvalHours: z.number().nonnegative(),
  supplierCoverage: z.number().int().nonnegative(),
  nextAction: z.string().min(8)
});

export const UpdateProcurementRequisitionRequestSchema = z.object({
  status: z.enum(["draft", "submitted", "approved", "sourcing", "blocked"]),
  nextAction: z.string().min(8)
});

export const FieldMaterialRequestSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  requisitionId: z.string().nullable(),
  projectName: z.string(),
  frontName: z.string(),
  requestedBy: z.string(),
  summary: z.string(),
  detail: z.string(),
  requestedVolume: z.string(),
  urgency: z.enum(["planned", "watch", "critical"]),
  nextAction: z.string(),
  status: z.enum(["requested", "converted", "cancelled"]),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const CreateFieldMaterialRequestRequestSchema = z.object({
  projectName: z.string().min(3),
  frontName: z.string().min(3),
  requestedBy: z.string().min(3),
  summary: z.string().min(3),
  detail: z.string().min(6),
  requestedVolume: z.string().min(1),
  category: z.string().min(3).default("Field materials"),
  requestedItems: z.number().int().positive().default(1),
  budgetAmount: z.number().nonnegative().default(0),
  approvalHours: z.number().nonnegative().default(0),
  supplierCoverage: z.number().int().nonnegative().default(0),
  urgency: z.enum(["planned", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const CreateFieldMaterialRequestResponseSchema = z.object({
  fieldRequest: FieldMaterialRequestSchema,
  requisition: ProcurementRequisitionSchema
});

export const FieldMaterialRequestOverviewSchema = z.object({
  summary: z.object({
    openRequests: z.number().int().nonnegative(),
    convertedRequests: z.number().int().nonnegative(),
    criticalRequests: z.number().int().nonnegative(),
    linkedRequisitions: z.number().int().nonnegative(),
    averageSupplierCoverage: z.number().nonnegative()
  }),
  requests: z.array(FieldMaterialRequestSchema),
  focusRequest: FieldMaterialRequestSchema.nullable()
});

export const ProcurementPurchaseOrderRiskSchema = z.object({
  id: z.string(),
  purchaseOrderId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const ProcurementPurchaseOrderSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  requisitionCode: z.string(),
  projectName: z.string(),
  supplierName: z.string(),
  buyer: z.string(),
  category: z.string(),
  status: z.enum(["issued", "confirmed", "in_transit", "partial", "received", "blocked"]),
  totalAmount: z.number().nonnegative(),
  committedEta: z.string(),
  receivedPercent: z.number().min(0).max(100),
  invoiceMatchStatus: z.enum(["matched", "pending", "risk"]),
  logisticsMode: z.string(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const ProcurementPurchaseOrdersOverviewSchema = z.object({
  summary: z.object({
    openOrders: z.number().int().nonnegative(),
    inTransitOrders: z.number().int().nonnegative(),
    blockedOrders: z.number().int().nonnegative(),
    pendingInvoiceMatch: z.number().int().nonnegative(),
    averageReceivedPercent: z.number().nonnegative()
  }),
  purchaseOrders: z.array(ProcurementPurchaseOrderSchema),
  risks: z.array(ProcurementPurchaseOrderRiskSchema),
  focusPurchaseOrder: ProcurementPurchaseOrderSchema.nullable()
});

export const CreateProcurementPurchaseOrderRequestSchema = z.object({
  requisitionId: z.string().min(3),
  supplierName: z.string().min(3),
  buyer: z.string().min(3),
  totalAmount: z.number().positive(),
  committedEta: z.string(),
  logisticsMode: z.string().min(3),
  nextAction: z.string().min(8)
});

export const UpdateProcurementPurchaseOrderRequestSchema = z.object({
  status: z.enum(["issued", "confirmed", "in_transit", "partial", "received", "blocked"]),
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
  collectionOwner: z.string(),
  procurementStatus: z.enum(["draft", "sourcing", "awaiting_approval", "awarded", "blocked"]),
  controlHealth: z.enum(["on_track", "watch", "critical"]),
  collectionHealth: z.enum(["controlled", "watch", "critical"]),
  budgetAmount: z.number().nonnegative(),
  committedCost: z.number().nonnegative(),
  spentToDate: z.number().nonnegative(),
  forecastAtCompletion: z.number().nonnegative(),
  varianceAmount: z.number(),
  variancePercent: z.number(),
  projectProgress: z.number().min(0).max(100),
  scheduleVarianceDays: z.number(),
  cashExposure: z.number().nonnegative(),
  pendingCollection: z.number().nonnegative(),
  overdueCollectionDays: z.number().int().nonnegative(),
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
    criticalLines: z.number().int().nonnegative(),
    cashRiskLines: z.number().int().nonnegative()
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

export const InventoryReceiptRiskSchema = z.object({
  id: z.string(),
  receiptId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const InventoryReceiptSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  supplierName: z.string(),
  destinationName: z.string(),
  destinationType: z.string(),
  purchaseReference: z.string(),
  purchaseOrderOwner: z.string(),
  purchaseOrderStatus: z.enum(["issued", "confirmed", "in_transit", "partial", "received", "blocked", "unknown"]),
  invoiceMatchStatus: z.enum(["matched", "pending", "risk", "unknown"]),
  etaDate: z.string(),
  receivedDate: z.string().nullable(),
  status: z.enum(["draft", "in_transit", "received", "blocked"]),
  orderedUnits: z.number().nonnegative(),
  receivedUnits: z.number().nonnegative(),
  varianceUnits: z.number(),
  variancePercent: z.number(),
  pendingEvidence: z.number().int().nonnegative(),
  rejectedUnits: z.number().int().nonnegative(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const InventoryReceivingOverviewSchema = z.object({
  summary: z.object({
    openReceipts: z.number().int().nonnegative(),
    overdueEta: z.number().int().nonnegative(),
    quantityVarianceUnits: z.number().nonnegative(),
    pendingEvidence: z.number().int().nonnegative(),
    blockedReceipts: z.number().int().nonnegative(),
    receiptsAtCommercialRisk: z.number().int().nonnegative()
  }),
  receipts: z.array(InventoryReceiptSchema),
  risks: z.array(InventoryReceiptRiskSchema),
  focusReceipt: InventoryReceiptSchema.nullable()
});

export const UpdateInventoryReceiptRequestSchema = z.object({
  status: z.enum(["draft", "in_transit", "received", "blocked"]),
  nextAction: z.string().min(8)
});

export const CreateInventoryReceiptRequestSchema = z.object({
  supplierName: z.string().min(3),
  destinationName: z.string().min(3),
  destinationType: z.string().min(3),
  purchaseReference: z.string().min(3),
  etaDate: z.string().min(10),
  orderedUnits: z.number().positive(),
  receivedUnits: z.number().nonnegative(),
  pendingEvidence: z.number().int().nonnegative(),
  rejectedUnits: z.number().int().nonnegative(),
  nextAction: z.string().min(8)
});

export const InventoryMovementRiskSchema = z.object({
  id: z.string(),
  movementId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const InventoryMovementSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  movementType: z.enum(["transfer", "issue", "return"]),
  skuName: z.string(),
  sourceName: z.string(),
  destinationName: z.string(),
  requestedBy: z.string(),
  upstreamReceiptCode: z.string().nullable(),
  purchaseReference: z.string().nullable(),
  purchaseOrderOwner: z.string(),
  purchaseOrderStatus: z.enum(["issued", "confirmed", "in_transit", "partial", "received", "blocked", "unknown"]),
  invoiceMatchStatus: z.enum(["matched", "pending", "risk", "unknown"]),
  status: z.enum(["draft", "in_transit", "received", "blocked"]),
  requestedUnits: z.number().nonnegative(),
  movedUnits: z.number().nonnegative(),
  varianceUnits: z.number(),
  pendingEvidence: z.number().int().nonnegative(),
  impactLevel: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const InventoryMovementsOverviewSchema = z.object({
  summary: z.object({
    openMovements: z.number().int().nonnegative(),
    criticalMovements: z.number().int().nonnegative(),
    pendingEvidence: z.number().int().nonnegative(),
    varianceUnits: z.number().nonnegative(),
    returnsInFlow: z.number().int().nonnegative(),
    movementsAtCommercialRisk: z.number().int().nonnegative()
  }),
  movements: z.array(InventoryMovementSchema),
  risks: z.array(InventoryMovementRiskSchema),
  focusMovement: InventoryMovementSchema.nullable()
});

export const UpdateInventoryMovementRequestSchema = z.object({
  status: z.enum(["draft", "in_transit", "received", "blocked"]),
  nextAction: z.string().min(8)
});

export const CreateInventoryMovementRequestSchema = z.object({
  movementType: z.enum(["transfer", "issue", "return"]),
  skuName: z.string().min(3),
  sourceName: z.string().min(3),
  destinationName: z.string().min(3),
  requestedBy: z.string().min(3),
  upstreamReceiptCode: z.string().min(3).nullable(),
  purchaseReference: z.string().min(3).nullable(),
  requestedUnits: z.number().positive(),
  movedUnits: z.number().nonnegative(),
  pendingEvidence: z.number().int().nonnegative(),
  impactLevel: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const MachineRiskSchema = z.object({
  id: z.string(),
  machineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const MachineItemSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  machineName: z.string(),
  machineType: z.string(),
  projectName: z.string(),
  frontName: z.string(),
  status: z.enum(["available", "maintenance", "down"]),
  health: z.enum(["healthy", "watch", "critical"]),
  availabilityPercent: z.number().min(0).max(100),
  utilizationPercent: z.number().min(0).max(100),
  hourMeter: z.number().nonnegative(),
  nextMaintenanceHours: z.number().nonnegative(),
  maintenanceDueDate: z.string(),
  maintenanceBacklog: z.number().int().nonnegative(),
  openFailures: z.number().int().nonnegative(),
  criticalOpenFailures: z.number().int().nonnegative(),
  lastServiceAt: z.string(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const EquipmentOverviewSchema = z.object({
  summary: z.object({
    trackedMachines: z.number().int().nonnegative(),
    availableMachines: z.number().int().nonnegative(),
    machinesInMaintenance: z.number().int().nonnegative(),
    overdueMaintenance: z.number().int().nonnegative(),
    criticalOpenFailures: z.number().int().nonnegative(),
    averageAvailability: z.number().min(0).max(100)
  }),
  machines: z.array(MachineItemSchema),
  risks: z.array(MachineRiskSchema),
  focusMachine: MachineItemSchema.nullable()
});

export const UpdateMachineItemRequestSchema = z.object({
  status: z.enum(["available", "maintenance", "down"]),
  health: z.enum(["healthy", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const CreateMachineItemRequestSchema = z.object({
  machineName: z.string().min(3),
  machineType: z.string().min(3),
  projectName: z.string().min(3),
  frontName: z.string().min(3),
  status: z.enum(["available", "maintenance", "down"]),
  health: z.enum(["healthy", "watch", "critical"]),
  availabilityPercent: z.number().min(0).max(100),
  utilizationPercent: z.number().min(0).max(100),
  hourMeter: z.number().nonnegative(),
  nextMaintenanceHours: z.number().nonnegative(),
  maintenanceBacklog: z.number().int().nonnegative(),
  openFailures: z.number().int().nonnegative(),
  criticalOpenFailures: z.number().int().nonnegative(),
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
    satStatus: z.enum(["controlled", "watch", "critical"]),
    supplierExceptions: z.number().int().nonnegative(),
    paymentReadySuppliers: z.number().int().nonnegative(),
    blockedTreasuryRuns: z.number().int().nonnegative(),
    unavailableTreasuryInvoices: z.number().int().nonnegative(),
    overdueCollections: z.number().int().nonnegative(),
    criticalCollections: z.number().int().nonnegative(),
    financeChainPressure: z.number().int().nonnegative()
  }),
  command: z.object({
    laneStatus: z.enum(["controlled", "watch", "critical"]),
    collectionsPressure: z.number().int().nonnegative(),
    treasuryPressure: z.number().int().nonnegative(),
    blockedAmount: z.number().nonnegative(),
    headline: z.string(),
    topAction: z.string(),
    nextMilestone: z.string()
  }),
  items: z.array(FinanceLedgerItemSchema),
  risks: z.array(FinanceRiskSchema),
  focusItem: FinanceLedgerItemSchema.nullable()
});

export const UpdateFinanceLedgerItemRequestSchema = z.object({
  satStatus: z.enum(["controlled", "watch", "critical"]),
  note: z.string().min(8)
});

export const AccountsPayableRiskSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const AccountsPayableInvoiceSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  supplierProfileId: z.string().nullable(),
  supplierName: z.string(),
  code: z.string(),
  invoiceNumber: z.string(),
  invoiceUuid: z.string(),
  projectName: z.string(),
  purchaseOrderCode: z.string().nullable(),
  receiptCode: z.string().nullable(),
  status: z.enum(["received", "matched", "scheduled", "blocked", "paid"]),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  complementStatus: z.enum(["pending", "complete", "not_required", "risk"]),
  receiptEvidenceStatus: z.enum(["complete", "partial", "missing"]),
  paymentMethod: z.string(),
  dueDate: z.string(),
  scheduledPaymentDate: z.string().nullable(),
  receivedAt: z.string(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  pendingAmount: z.number().nonnegative(),
  packetCompletion: z.number().min(0).max(100),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const AccountsPayableOverviewSchema = z.object({
  summary: z.object({
    trackedInvoices: z.number().int().nonnegative(),
    openAmount: z.number().nonnegative(),
    scheduledAmount: z.number().nonnegative(),
    blockedInvoices: z.number().int().nonnegative(),
    criticalInvoices: z.number().int().nonnegative(),
    overdueInvoices: z.number().int().nonnegative()
  }),
  invoices: z.array(AccountsPayableInvoiceSchema),
  risks: z.array(AccountsPayableRiskSchema),
  focusInvoice: AccountsPayableInvoiceSchema.nullable()
});

export const CreateAccountsPayableInvoiceRequestSchema = z.object({
  supplierProfileId: z.string().nullable().optional(),
  supplierName: z.string().min(3),
  invoiceNumber: z.string().min(3),
  invoiceUuid: z.string().min(12),
  projectName: z.string().min(3),
  purchaseOrderCode: z.string().nullable().optional(),
  receiptCode: z.string().nullable().optional(),
  status: z.enum(["received", "matched", "scheduled", "blocked", "paid"]),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  complementStatus: z.enum(["pending", "complete", "not_required", "risk"]),
  receiptEvidenceStatus: z.enum(["complete", "partial", "missing"]),
  paymentMethod: z.string().min(3),
  dueDate: z.string(),
  scheduledPaymentDate: z.string().nullable().optional(),
  subtotal: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  packetCompletion: z.number().min(0).max(100),
  nextAction: z.string().min(8)
});

export const UpdateAccountsPayableInvoiceRequestSchema = z.object({
  status: z.enum(["received", "matched", "scheduled", "blocked", "paid"]),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  complementStatus: z.enum(["pending", "complete", "not_required", "risk"]),
  scheduledPaymentDate: z.string().nullable(),
  nextAction: z.string().min(8)
});

export const TreasuryPaymentRunInvoiceSchema = z.object({
  invoiceId: z.string(),
  invoiceCode: z.string(),
  supplierName: z.string(),
  total: z.number().nonnegative(),
  scheduledPaymentDate: z.string().nullable(),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  complementStatus: z.enum(["pending", "complete", "not_required", "risk"]),
  receiptEvidenceStatus: z.enum(["complete", "partial", "missing"])
});

export const TreasuryPaymentRunRiskSchema = z.object({
  id: z.string(),
  paymentRunId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const TreasuryPaymentRunUnavailableInvoiceSchema = z.object({
  invoiceId: z.string(),
  invoiceCode: z.string(),
  supplierName: z.string(),
  pendingAmount: z.number().nonnegative(),
  status: z.enum(["received", "matched", "scheduled", "blocked", "paid"]),
  reasonCode: z.enum(["already_paid", "already_assigned", "fiscal_blocked", "evidence_missing", "invoice_blocked"]),
  reasonLabel: z.string(),
  blockingRunCodes: z.array(z.string())
});

export const TreasuryPaymentRunSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  bankAccountLabel: z.string(),
  scheduledDate: z.string(),
  status: z.enum(["draft", "ready", "blocked", "executed"]),
  totalInvoices: z.number().int().nonnegative(),
  totalAmount: z.number().nonnegative(),
  criticalInvoices: z.number().int().nonnegative(),
  owner: z.string(),
  nextAction: z.string(),
  updatedAt: z.string(),
  invoices: z.array(TreasuryPaymentRunInvoiceSchema)
});

export const TreasuryPaymentRunsOverviewSchema = z.object({
  summary: z.object({
    activeRuns: z.number().int().nonnegative(),
    scheduledAmount: z.number().nonnegative(),
    blockedRuns: z.number().int().nonnegative(),
    executedRuns: z.number().int().nonnegative(),
    criticalInvoices: z.number().int().nonnegative(),
    readyRuns: z.number().int().nonnegative(),
    duplicateAssignments: z.number().int().nonnegative()
  }),
  runs: z.array(TreasuryPaymentRunSchema),
  risks: z.array(TreasuryPaymentRunRiskSchema),
  focusRun: TreasuryPaymentRunSchema.nullable(),
  eligibleInvoices: z.array(AccountsPayableInvoiceSchema),
  unavailableInvoices: z.array(TreasuryPaymentRunUnavailableInvoiceSchema)
});

export const CreateTreasuryPaymentRunRequestSchema = z.object({
  bankAccountLabel: z.string().min(3),
  scheduledDate: z.string(),
  owner: z.string().min(3),
  nextAction: z.string().min(8),
  invoiceIds: z.array(z.string()).min(1)
});

export const UpdateTreasuryPaymentRunRequestSchema = z.object({
  status: z.enum(["draft", "ready", "blocked", "executed"]),
  nextAction: z.string().min(8)
});

export const RemoveTreasuryPaymentRunInvoiceRequestSchema = z.object({
  nextAction: z.string().min(8)
});

export const AddTreasuryPaymentRunInvoiceRequestSchema = z.object({
  invoiceId: z.string().min(3),
  nextAction: z.string().min(8)
});

export const MoveTreasuryPaymentRunInvoiceRequestSchema = z.object({
  targetPaymentRunId: z.string().min(3),
  nextAction: z.string().min(8)
});

export const EstimationCollectionExceptionSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const EstimationCollectionLineSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  projectId: z.string(),
  financeLedgerId: z.string(),
  code: z.string(),
  projectName: z.string(),
  client: z.string(),
  segment: z.string(),
  collectionOwner: z.string(),
  billingCycleLabel: z.string(),
  projectStatus: z.enum(projectStatuses),
  collectionHealth: z.enum(["controlled", "watch", "critical"]),
  estimatedAmount: z.number().nonnegative(),
  executedAmount: z.number().nonnegative(),
  submittedAmount: z.number().nonnegative(),
  collectedAmount: z.number().nonnegative(),
  pendingToBill: z.number().nonnegative(),
  pendingCollection: z.number().nonnegative(),
  pendingApprovalAmount: z.number().nonnegative(),
  evidenceProgress: z.number().min(0).max(100),
  projectProgress: z.number().min(0).max(100),
  progressGap: z.number(),
  scheduleVarianceDays: z.number(),
  closeReadiness: z.number().min(0).max(100),
  oldestPendingDays: z.number().int().nonnegative(),
  collectionWindowDays: z.number().int().positive(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const EstimationCollectionOverviewSchema = z.object({
  summary: z.object({
    trackedProjects: z.number().int().nonnegative(),
    estimatedPortfolio: z.number().nonnegative(),
    submittedPortfolio: z.number().nonnegative(),
    collectedPortfolio: z.number().nonnegative(),
    pendingCollection: z.number().nonnegative(),
    criticalCollections: z.number().int().nonnegative(),
    overdueCollections: z.number().int().nonnegative()
  }),
  lines: z.array(EstimationCollectionLineSchema),
  exceptions: z.array(EstimationCollectionExceptionSchema),
  focusLine: EstimationCollectionLineSchema.nullable()
});

export const UpdateEstimationCollectionLineRequestSchema = z.object({
  collectionHealth: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const BudgetBookRiskSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const BudgetBookLineSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  companyId: z.string(),
  projectId: z.string().nullable(),
  code: z.string(),
  conceptCode: z.string(),
  projectName: z.string(),
  packageName: z.string(),
  buyer: z.string(),
  unit: z.string(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  budgetAmount: z.number().nonnegative(),
  executedQuantity: z.number().nonnegative(),
  estimatedQuantity: z.number().nonnegative(),
  pendingQuantity: z.number().nonnegative(),
  progressPercent: z.number().min(0).max(100),
  evidenceCount: z.number().int().nonnegative(),
  changeOrders: z.number().int().nonnegative(),
  generatorHealth: z.enum(["controlled", "watch", "critical"]),
  collectionHealth: z.enum(["controlled", "watch", "critical"]),
  collectionOwner: z.string(),
  pendingCollection: z.number().nonnegative(),
  pendingToBill: z.number().nonnegative(),
  overdueCollectionDays: z.number().int().nonnegative(),
  procurementStatus: z.enum(["draft", "sourcing", "awaiting_approval", "awarded", "blocked"]),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const BudgetBookOverviewSchema = z.object({
  summary: z.object({
    activeConcepts: z.number().int().nonnegative(),
    baselineBudget: z.number().nonnegative(),
    executedBudget: z.number().nonnegative(),
    estimatedBudget: z.number().nonnegative(),
    pendingBudget: z.number().nonnegative(),
    criticalConcepts: z.number().int().nonnegative(),
    conceptsAtCashRisk: z.number().int().nonnegative()
  }),
  lines: z.array(BudgetBookLineSchema),
  risks: z.array(BudgetBookRiskSchema),
  focusLine: BudgetBookLineSchema.nullable()
});

export const UpdateBudgetBookLineRequestSchema = z.object({
  procurementStatus: z.enum(["draft", "sourcing", "awaiting_approval", "awarded", "blocked"]),
  nextAction: z.string().min(8)
});

export const CashFlowRiskSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const CashFlowLineSchema = z.object({
  id: z.string(),
  ledgerId: z.string(),
  companyId: z.string(),
  code: z.string(),
  streamName: z.string(),
  sourceType: z.enum(["cash", "payables", "collections", "tax", "close"]),
  health: z.enum(["controlled", "watch", "critical"]),
  startingCash: z.number(),
  projectedInflows: z.number().nonnegative(),
  projectedOutflows: z.number().nonnegative(),
  weeklyNet: z.number(),
  liquidityCoverageWeeks: z.number().min(0),
  openPressureItems: z.number().int().nonnegative(),
  confidencePercent: z.number().min(0).max(100),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const CashFlowOverviewSchema = z.object({
  summary: z.object({
    trackedStreams: z.number().int().nonnegative(),
    projectedInflows: z.number().nonnegative(),
    projectedOutflows: z.number().nonnegative(),
    weeklyNet: z.number(),
    criticalStreams: z.number().int().nonnegative(),
    averageConfidence: z.number().min(0).max(100)
  }),
  lines: z.array(CashFlowLineSchema),
  risks: z.array(CashFlowRiskSchema),
  focusLine: CashFlowLineSchema.nullable()
});

export const UpdateCashFlowLineRequestSchema = z.object({
  health: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const CloseControlRiskSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const CloseControlLineSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  companyId: z.string(),
  code: z.string(),
  streamName: z.string(),
  streamType: z.enum(["finance", "compliance", "document_control"]),
  closeHealth: z.enum(["controlled", "watch", "critical"]),
  closeReadiness: z.number().min(0).max(100),
  blockingItems: z.number().int().nonnegative(),
  slaHoursRemaining: z.number(),
  evidenceCompletion: z.number().min(0).max(100),
  fiscalExposure: z.number().nonnegative(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const CloseControlOverviewSchema = z.object({
  summary: z.object({
    trackedStreams: z.number().int().nonnegative(),
    averageCloseReadiness: z.number().min(0).max(100),
    criticalStreams: z.number().int().nonnegative(),
    blockedItems: z.number().int().nonnegative(),
    fiscalExposure: z.number().nonnegative(),
    overdueStreams: z.number().int().nonnegative()
  }),
  lines: z.array(CloseControlLineSchema),
  risks: z.array(CloseControlRiskSchema),
  focusLine: CloseControlLineSchema.nullable()
});

export const UpdateCloseControlLineRequestSchema = z.object({
  closeHealth: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const SupplierControlRiskSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const SupplierControlLineSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  companyId: z.string(),
  supplierName: z.string(),
  owner: z.string(),
  awardedPackages: z.number().int().nonnegative(),
  activePackages: z.number().int().nonnegative(),
  contractedAmount: z.number().nonnegative(),
  concentrationPercent: z.number().min(0).max(100),
  bidCoverage: z.number().min(0).max(10),
  deliveryHealth: z.enum(["controlled", "watch", "critical"]),
  approvalPressureHours: z.number().nonnegative(),
  complianceAlerts: z.number().int().nonnegative(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const SupplierControlOverviewSchema = z.object({
  summary: z.object({
    trackedSuppliers: z.number().int().nonnegative(),
    concentratedSuppliers: z.number().int().nonnegative(),
    awardedVolume: z.number().nonnegative(),
    averageBidCoverage: z.number().min(0).max(10),
    criticalSuppliers: z.number().int().nonnegative(),
    complianceAlerts: z.number().int().nonnegative()
  }),
  lines: z.array(SupplierControlLineSchema),
  risks: z.array(SupplierControlRiskSchema),
  focusLine: SupplierControlLineSchema.nullable()
});

export const SupplierMasterRiskSchema = z.object({
  id: z.string(),
  supplierProfileId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const SupplierMasterProfileSchema = z.object({
  id: z.string(),
  supplierId: z.string(),
  companyId: z.string(),
  supplierName: z.string(),
  tradeName: z.string(),
  rfc: z.string(),
  fiscalRegime: z.string(),
  cfdiUse: z.string(),
  paymentMethod: z.string(),
  paymentTermsDays: z.number().int().nonnegative(),
  bankAccountMasked: z.string(),
  contactName: z.string(),
  contactEmail: z.string().email(),
  contactPhone: z.string(),
  complianceStatus: z.enum(["complete", "watch", "blocked"]),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  fiscalPacketCompletion: z.number().min(0).max(100),
  lastValidatedAt: z.string().nullable(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const SupplierMasterOverviewSchema = z.object({
  summary: z.object({
    totalSuppliers: z.number().int().nonnegative(),
    criticalSuppliers: z.number().int().nonnegative(),
    incompletePackets: z.number().int().nonnegative(),
    averageFiscalPacketCompletion: z.number().min(0).max(100)
  }),
  items: z.array(SupplierMasterProfileSchema),
  risks: z.array(SupplierMasterRiskSchema),
  focusItem: SupplierMasterProfileSchema.nullable()
});

export const CreateSupplierControlLineRequestSchema = z.object({
  supplierName: z.string().min(3),
  owner: z.string().min(3),
  awardedPackages: z.number().int().nonnegative(),
  activePackages: z.number().int().nonnegative(),
  contractedAmount: z.number().nonnegative(),
  concentrationPercent: z.number().min(0).max(100),
  bidCoverage: z.number().min(0).max(10),
  deliveryHealth: z.enum(["controlled", "watch", "critical"]),
  approvalPressureHours: z.number().nonnegative(),
  complianceAlerts: z.number().int().nonnegative(),
  nextAction: z.string().min(8)
});

export const UpdateSupplierControlLineRequestSchema = z.object({
  deliveryHealth: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const CreateSupplierMasterProfileRequestSchema = z.object({
  supplierName: z.string().min(3),
  tradeName: z.string().min(3),
  rfc: z.string().min(12).max(13),
  fiscalRegime: z.string().min(3),
  cfdiUse: z.string().min(2),
  paymentMethod: z.string().min(2),
  paymentTermsDays: z.number().int().nonnegative(),
  bankAccountMasked: z.string().min(4),
  contactName: z.string().min(3),
  contactEmail: z.string().email(),
  contactPhone: z.string().min(8),
  complianceStatus: z.enum(["complete", "watch", "blocked"]),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  fiscalPacketCompletion: z.number().min(0).max(100),
  nextAction: z.string().min(8)
});

export const UpdateSupplierMasterProfileRequestSchema = z.object({
  complianceStatus: z.enum(["complete", "watch", "blocked"]),
  satStatus: z.enum(["controlled", "watch", "critical"]),
  fiscalPacketCompletion: z.number().min(0).max(100),
  nextAction: z.string().min(8)
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

export const SubcontractRiskSchema = z.object({
  id: z.string(),
  lineId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const PostSaleRiskSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  title: z.string(),
  category: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  owner: z.string(),
  status: z.string()
});

export const SubcontractLineSchema = z.object({
  id: z.string(),
  workforceId: z.string(),
  companyId: z.string(),
  projectId: z.string().nullable(),
  code: z.string(),
  contractorName: z.string(),
  frontName: z.string(),
  projectName: z.string(),
  projectStatus: z.enum(projectStatuses).nullable(),
  subcontractHealth: z.enum(["controlled", "watch", "critical"]),
  latestDailyLogStatus: z.enum(["draft", "submitted", "approved", "flagged", "unknown"]),
  qualityReleaseReadiness: z.number().min(0).max(100),
  contractAmount: z.number().nonnegative(),
  earnedAmount: z.number().nonnegative(),
  invoicedAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  retentionAmount: z.number().nonnegative(),
  pendingDestajo: z.number().nonnegative(),
  productivityRate: z.number().min(0).max(100),
  attendanceRate: z.number().min(0).max(100),
  complianceExpirations: z.number().int().nonnegative(),
  incidentCount: z.number().int().nonnegative(),
  activeHeadcount: z.number().int().nonnegative(),
  progressPercent: z.number().min(0).max(100),
  progressGap: z.number(),
  nextAction: z.string(),
  updatedAt: z.string()
});

export const SubcontractOverviewSchema = z.object({
  summary: z.object({
    activeSubcontracts: z.number().int().nonnegative(),
    contractedAmount: z.number().nonnegative(),
    earnedAmount: z.number().nonnegative(),
    paidAmount: z.number().nonnegative(),
    pendingDestajo: z.number().nonnegative(),
    criticalSubcontracts: z.number().int().nonnegative(),
    executionRiskSubcontracts: z.number().int().nonnegative()
  }),
  lines: z.array(SubcontractLineSchema),
  risks: z.array(SubcontractRiskSchema),
  focusLine: SubcontractLineSchema.nullable()
});

export const UpdateSubcontractLineRequestSchema = z.object({
  subcontractHealth: z.enum(["controlled", "watch", "critical"]),
  nextAction: z.string().min(8)
});

export const PostSaleCaseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  caseType: z.enum(["delivery", "warranty", "incident"]),
  projectName: z.string(),
  customerName: z.string(),
  assetLabel: z.string(),
  owner: z.string(),
  status: z.enum(["reported", "triaged", "scheduled", "in_progress", "customer_validation", "blocked", "closed"]),
  priority: z.enum(["standard", "urgent", "critical"]),
  slaHoursRemaining: z.number(),
  openFindings: z.number().int().nonnegative(),
  pendingVisits: z.number().int().nonnegative(),
  customerSatisfaction: z.number().min(0).max(100),
  nextAction: z.string(),
  health: z.enum(["healthy", "watch", "critical"]),
  updatedAt: z.string()
});

export const PostSaleOverviewSchema = z.object({
  summary: z.object({
    openCases: z.number().int().nonnegative(),
    criticalCases: z.number().int().nonnegative(),
    overdueSlaCases: z.number().int().nonnegative(),
    pendingCustomerSignoff: z.number().int().nonnegative()
  }),
  items: z.array(PostSaleCaseSchema),
  risks: z.array(PostSaleRiskSchema),
  focusItem: PostSaleCaseSchema.nullable()
});

export const UpdatePostSaleCaseRequestSchema = z.object({
  status: z.enum(["reported", "triaged", "scheduled", "in_progress", "customer_validation", "blocked", "closed"]),
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

export const CreateDocumentControlItemRequestSchema = z.object({
  documentType: z.string().min(3),
  subject: z.string().min(3),
  projectName: z.string().min(3),
  owner: z.string().min(3),
  status: z.enum(["issued", "in_review", "awaiting_response", "approved", "blocked"]),
  revisionCount: z.number().int().nonnegative(),
  turnaroundDays: z.number().nonnegative(),
  openComments: z.number().int().nonnegative(),
  health: z.enum(["healthy", "watch", "critical"]),
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
  projectName: z.string(),
  projectStatus: z.enum(projectStatuses),
  latestDailyLogStatus: z.enum(["draft", "submitted", "approved", "flagged", "unknown"]),
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
    averageReworkRate: z.number().min(0),
    executionRiskInspections: z.number().int().nonnegative()
  }),
  inspectionsBoard: z.array(QualityInspectionSchema),
  risks: z.array(QualityRiskSchema),
  focusInspection: QualityInspectionSchema.nullable()
});

export const UpdateQualityInspectionRequestSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "pending_release", "released", "blocked"]),
  nextAction: z.string().min(8)
});

export const CreateQualityInspectionRequestSchema = z.object({
  areaName: z.string().min(3),
  checklistName: z.string().min(3),
  contractorName: z.string().min(3),
  severity: z.enum(["minor", "major", "critical"]),
  openFindings: z.number().int().nonnegative(),
  evidenceCompletion: z.number().min(0).max(100),
  releaseReadiness: z.number().min(0).max(100),
  reworkRate: z.number().min(0),
  status: z.enum(["scheduled", "in_progress", "pending_release", "released", "blocked"]),
  nextAction: z.string().min(8)
});

export const PlatformReadinessCheckSchema = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["ready", "warning", "blocked"]),
  detail: z.string(),
  action: z.string()
});

export const PlatformSystemReadinessSchema = z.object({
  companyId: z.string(),
  summary: z.object({
    score: z.number().int().min(0).max(100),
    readyChecks: z.number().int().nonnegative(),
    warningChecks: z.number().int().nonnegative(),
    blockedChecks: z.number().int().nonnegative()
  }),
  checks: z.array(PlatformReadinessCheckSchema),
  recommendedActions: z.array(z.string())
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
export type CreateProjectPortfolioItemRequestContract = z.infer<typeof CreateProjectPortfolioItemRequestSchema>;
export type DailyLogRiskContract = z.infer<typeof DailyLogRiskSchema>;
export type DailyLogEntryContract = z.infer<typeof DailyLogEntrySchema>;
export type DailyLogOverviewContract = z.infer<typeof DailyLogOverviewSchema>;
export type UpdateDailyLogEntryRequestContract = z.infer<typeof UpdateDailyLogEntryRequestSchema>;
export type CreateDailyLogEntryRequestContract = z.infer<typeof CreateDailyLogEntryRequestSchema>;
export type ProcurementRiskContract = z.infer<typeof ProcurementRiskSchema>;
export type ProcurementPackageContract = z.infer<typeof ProcurementPackageSchema>;
export type ProcurementOverviewContract = z.infer<typeof ProcurementOverviewSchema>;
export type UpdateProcurementPackageRequestContract = z.infer<typeof UpdateProcurementPackageRequestSchema>;
export type ProcurementRequisitionRiskContract = z.infer<typeof ProcurementRequisitionRiskSchema>;
export type ProcurementRequisitionContract = z.infer<typeof ProcurementRequisitionSchema>;
export type ProcurementRequisitionsOverviewContract = z.infer<typeof ProcurementRequisitionsOverviewSchema>;
export type CreateProcurementRequisitionRequestContract = z.infer<typeof CreateProcurementRequisitionRequestSchema>;
export type UpdateProcurementRequisitionRequestContract = z.infer<typeof UpdateProcurementRequisitionRequestSchema>;
export type FieldMaterialRequestContract = z.infer<typeof FieldMaterialRequestSchema>;
export type FieldMaterialRequestOverviewContract = z.infer<typeof FieldMaterialRequestOverviewSchema>;
export type CreateFieldMaterialRequestRequestContract = z.infer<typeof CreateFieldMaterialRequestRequestSchema>;
export type CreateFieldMaterialRequestResponseContract = z.infer<typeof CreateFieldMaterialRequestResponseSchema>;
export type ProcurementPurchaseOrderRiskContract = z.infer<typeof ProcurementPurchaseOrderRiskSchema>;
export type ProcurementPurchaseOrderContract = z.infer<typeof ProcurementPurchaseOrderSchema>;
export type ProcurementPurchaseOrdersOverviewContract = z.infer<typeof ProcurementPurchaseOrdersOverviewSchema>;
export type CreateProcurementPurchaseOrderRequestContract = z.infer<typeof CreateProcurementPurchaseOrderRequestSchema>;
export type UpdateProcurementPurchaseOrderRequestContract = z.infer<typeof UpdateProcurementPurchaseOrderRequestSchema>;
export type CostControlExceptionContract = z.infer<typeof CostControlExceptionSchema>;
export type CostControlLineContract = z.infer<typeof CostControlLineSchema>;
export type CostControlOverviewContract = z.infer<typeof CostControlOverviewSchema>;
export type UpdateCostControlLineRequestContract = z.infer<typeof UpdateCostControlLineRequestSchema>;
export type InventoryRiskContract = z.infer<typeof InventoryRiskSchema>;
export type InventoryLocationContract = z.infer<typeof InventoryLocationSchema>;
export type InventoryOverviewContract = z.infer<typeof InventoryOverviewSchema>;
export type UpdateInventoryLocationRequestContract = z.infer<typeof UpdateInventoryLocationRequestSchema>;
export type InventoryReceiptRiskContract = z.infer<typeof InventoryReceiptRiskSchema>;
export type InventoryReceiptContract = z.infer<typeof InventoryReceiptSchema>;
export type InventoryReceivingOverviewContract = z.infer<typeof InventoryReceivingOverviewSchema>;
export type CreateInventoryReceiptRequestContract = z.infer<typeof CreateInventoryReceiptRequestSchema>;
export type UpdateInventoryReceiptRequestContract = z.infer<typeof UpdateInventoryReceiptRequestSchema>;
export type InventoryMovementRiskContract = z.infer<typeof InventoryMovementRiskSchema>;
export type InventoryMovementContract = z.infer<typeof InventoryMovementSchema>;
export type InventoryMovementsOverviewContract = z.infer<typeof InventoryMovementsOverviewSchema>;
export type CreateInventoryMovementRequestContract = z.infer<typeof CreateInventoryMovementRequestSchema>;
export type UpdateInventoryMovementRequestContract = z.infer<typeof UpdateInventoryMovementRequestSchema>;
export type MachineRiskContract = z.infer<typeof MachineRiskSchema>;
export type MachineItemContract = z.infer<typeof MachineItemSchema>;
export type EquipmentOverviewContract = z.infer<typeof EquipmentOverviewSchema>;
export type UpdateMachineItemRequestContract = z.infer<typeof UpdateMachineItemRequestSchema>;
export type CreateMachineItemRequestContract = z.infer<typeof CreateMachineItemRequestSchema>;
export type FinanceRiskContract = z.infer<typeof FinanceRiskSchema>;
export type FinanceLedgerItemContract = z.infer<typeof FinanceLedgerItemSchema>;
export type FinanceOverviewContract = z.infer<typeof FinanceOverviewSchema>;
export type UpdateFinanceLedgerItemRequestContract = z.infer<typeof UpdateFinanceLedgerItemRequestSchema>;
export type AccountsPayableRiskContract = z.infer<typeof AccountsPayableRiskSchema>;
export type AccountsPayableInvoiceContract = z.infer<typeof AccountsPayableInvoiceSchema>;
export type AccountsPayableOverviewContract = z.infer<typeof AccountsPayableOverviewSchema>;
export type CreateAccountsPayableInvoiceRequestContract = z.infer<typeof CreateAccountsPayableInvoiceRequestSchema>;
export type UpdateAccountsPayableInvoiceRequestContract = z.infer<typeof UpdateAccountsPayableInvoiceRequestSchema>;
export type TreasuryPaymentRunInvoiceContract = z.infer<typeof TreasuryPaymentRunInvoiceSchema>;
export type TreasuryPaymentRunRiskContract = z.infer<typeof TreasuryPaymentRunRiskSchema>;
export type TreasuryPaymentRunContract = z.infer<typeof TreasuryPaymentRunSchema>;
export type TreasuryPaymentRunsOverviewContract = z.infer<typeof TreasuryPaymentRunsOverviewSchema>;
export type CreateTreasuryPaymentRunRequestContract = z.infer<typeof CreateTreasuryPaymentRunRequestSchema>;
export type UpdateTreasuryPaymentRunRequestContract = z.infer<typeof UpdateTreasuryPaymentRunRequestSchema>;
export type EstimationCollectionExceptionContract = z.infer<typeof EstimationCollectionExceptionSchema>;
export type EstimationCollectionLineContract = z.infer<typeof EstimationCollectionLineSchema>;
export type EstimationCollectionOverviewContract = z.infer<typeof EstimationCollectionOverviewSchema>;
export type UpdateEstimationCollectionLineRequestContract = z.infer<typeof UpdateEstimationCollectionLineRequestSchema>;
export type BudgetBookRiskContract = z.infer<typeof BudgetBookRiskSchema>;
export type BudgetBookLineContract = z.infer<typeof BudgetBookLineSchema>;
export type BudgetBookOverviewContract = z.infer<typeof BudgetBookOverviewSchema>;
export type UpdateBudgetBookLineRequestContract = z.infer<typeof UpdateBudgetBookLineRequestSchema>;
export type CashFlowRiskContract = z.infer<typeof CashFlowRiskSchema>;
export type CashFlowLineContract = z.infer<typeof CashFlowLineSchema>;
export type CashFlowOverviewContract = z.infer<typeof CashFlowOverviewSchema>;
export type UpdateCashFlowLineRequestContract = z.infer<typeof UpdateCashFlowLineRequestSchema>;
export type CloseControlRiskContract = z.infer<typeof CloseControlRiskSchema>;
export type CloseControlLineContract = z.infer<typeof CloseControlLineSchema>;
export type CloseControlOverviewContract = z.infer<typeof CloseControlOverviewSchema>;
export type UpdateCloseControlLineRequestContract = z.infer<typeof UpdateCloseControlLineRequestSchema>;
export type SupplierControlRiskContract = z.infer<typeof SupplierControlRiskSchema>;
export type SupplierControlLineContract = z.infer<typeof SupplierControlLineSchema>;
export type SupplierControlOverviewContract = z.infer<typeof SupplierControlOverviewSchema>;
export type SupplierMasterRiskContract = z.infer<typeof SupplierMasterRiskSchema>;
export type SupplierMasterProfileContract = z.infer<typeof SupplierMasterProfileSchema>;
export type SupplierMasterOverviewContract = z.infer<typeof SupplierMasterOverviewSchema>;
export type CreateSupplierControlLineRequestContract = z.infer<typeof CreateSupplierControlLineRequestSchema>;
export type UpdateSupplierControlLineRequestContract = z.infer<typeof UpdateSupplierControlLineRequestSchema>;
export type CreateSupplierMasterProfileRequestContract = z.infer<typeof CreateSupplierMasterProfileRequestSchema>;
export type UpdateSupplierMasterProfileRequestContract = z.infer<typeof UpdateSupplierMasterProfileRequestSchema>;
export type CrmRiskContract = z.infer<typeof CrmRiskSchema>;
export type CrmLeadBucketContract = z.infer<typeof CrmLeadBucketSchema>;
export type CrmOverviewContract = z.infer<typeof CrmOverviewSchema>;
export type UpdateCrmLeadBucketRequestContract = z.infer<typeof UpdateCrmLeadBucketRequestSchema>;
export type HrRiskContract = z.infer<typeof HrRiskSchema>;
export type HrWorkforceItemContract = z.infer<typeof HrWorkforceItemSchema>;
export type HrOverviewContract = z.infer<typeof HrOverviewSchema>;
export type UpdateHrWorkforceItemRequestContract = z.infer<typeof UpdateHrWorkforceItemRequestSchema>;
export type SubcontractRiskContract = z.infer<typeof SubcontractRiskSchema>;
export type SubcontractLineContract = z.infer<typeof SubcontractLineSchema>;
export type SubcontractOverviewContract = z.infer<typeof SubcontractOverviewSchema>;
export type UpdateSubcontractLineRequestContract = z.infer<typeof UpdateSubcontractLineRequestSchema>;
export type PostSaleRiskContract = z.infer<typeof PostSaleRiskSchema>;
export type PostSaleCaseContract = z.infer<typeof PostSaleCaseSchema>;
export type PostSaleOverviewContract = z.infer<typeof PostSaleOverviewSchema>;
export type UpdatePostSaleCaseRequestContract = z.infer<typeof UpdatePostSaleCaseRequestSchema>;
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
export type CreateDocumentControlItemRequestContract = z.infer<typeof CreateDocumentControlItemRequestSchema>;
export type QualityRiskContract = z.infer<typeof QualityRiskSchema>;
export type QualityInspectionContract = z.infer<typeof QualityInspectionSchema>;
export type QualityOverviewContract = z.infer<typeof QualityOverviewSchema>;
export type UpdateQualityInspectionRequestContract = z.infer<typeof UpdateQualityInspectionRequestSchema>;
export type CreateQualityInspectionRequestContract = z.infer<typeof CreateQualityInspectionRequestSchema>;
export type PlatformReadinessCheckContract = z.infer<typeof PlatformReadinessCheckSchema>;
export type PlatformSystemReadinessContract = z.infer<typeof PlatformSystemReadinessSchema>;
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
    key: "projects.daily-log",
    name: "Daily Log",
    area: "projects",
    scope: "operations",
    description: "Daily field diary, crew capture, blockers, and evidence discipline.",
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
    key: "inventory.receiving",
    name: "Inventory Receiving",
    area: "inventory",
    scope: "operations",
    description: "Inbound receipts, quantity variance, evidence, and warehouse acceptance control.",
    enabledByDefault: false
  },
  {
    key: "inventory.movements",
    name: "Inventory Movements",
    area: "inventory",
    scope: "operations",
    description: "Transfers, site issues, returns, and movement traceability across warehouses and fronts.",
    enabledByDefault: false
  },
  {
    key: "inventory.equipment",
    name: "Equipment and Maintenance",
    area: "inventory",
    scope: "operations",
    description: "Machinery availability, maintenance, failures, and operating criticality.",
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
  },
  {
    key: "finance-manager",
    name: "Finance Manager",
    scope: "operations",
    permissions: ["finance:*", "finance:read"]
  }
];
