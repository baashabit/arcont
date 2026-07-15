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

type CreateProjectPortfolioItemInput = {
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
  nextMilestone: string;
};

export type ProjectScheduleActivityRecord = {
  id: string;
  companyId: string;
  projectId: string;
  code: string;
  name: string;
  phase: string;
  status: "not_started" | "in_progress" | "blocked" | "completed";
  plannedStart: string;
  plannedFinish: string;
  actualStart: string | null;
  actualFinish: string | null;
  progressPercent: number;
  predecessorIds: string[];
  owner: string;
  nextAction: string;
  updatedAt: string;
};

export type CreateProjectScheduleActivityInput = Omit<
  ProjectScheduleActivityRecord,
  "id" | "status" | "actualStart" | "actualFinish" | "progressPercent" | "updatedAt"
>;

export type UpdateProjectScheduleActivityInput = Pick<
  ProjectScheduleActivityRecord,
  | "companyId"
  | "projectId"
  | "status"
  | "progressPercent"
  | "plannedStart"
  | "plannedFinish"
  | "actualStart"
  | "actualFinish"
  | "predecessorIds"
  | "owner"
  | "nextAction"
> & { activityId: string };

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

type CreateDailyLogEntryInput = {
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
};

type FieldMaterialRequestRecord = {
  id: string;
  companyId: string;
  requisitionId: string | null;
  projectName: string;
  frontName: string;
  requestedBy: string;
  summary: string;
  detail: string;
  requestedVolume: string;
  urgency: "planned" | "watch" | "critical";
  nextAction: string;
  status: "requested" | "converted" | "cancelled";
  createdAt: string;
  updatedAt: string;
};

type CreateFieldMaterialRequestInput = {
  companyId: string;
  projectName: string;
  frontName: string;
  requestedBy: string;
  summary: string;
  detail: string;
  requestedVolume: string;
  category: string;
  requestedItems: number;
  budgetAmount: number;
  approvalHours: number;
  supplierCoverage: number;
  urgency: "planned" | "watch" | "critical";
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

type SupplierControlLineRecord = {
  id: string;
  supplierId: string;
  companyId: string;
  supplierName: string;
  owner: string;
  awardedPackages: number;
  activePackages: number;
  contractedAmount: number;
  concentrationPercent: number;
  bidCoverage: number;
  deliveryHealth: "controlled" | "watch" | "critical";
  approvalPressureHours: number;
  complianceAlerts: number;
  nextAction: string;
  updatedAt: string;
};

type CreateSupplierControlLineInput = Omit<SupplierControlLineRecord, "id" | "supplierId" | "updatedAt">;

type UpdateSupplierControlLineInput = {
  lineId: string;
  deliveryHealth: "controlled" | "watch" | "critical";
  nextAction: string;
};

type SupplierMasterProfileRecord = {
  id: string;
  supplierId: string;
  companyId: string;
  supplierName: string;
  tradeName: string;
  rfc: string;
  fiscalRegime: string;
  cfdiUse: string;
  paymentMethod: string;
  paymentTermsDays: number;
  bankAccountMasked: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  complianceStatus: "complete" | "watch" | "blocked";
  satStatus: "controlled" | "watch" | "critical";
  fiscalPacketCompletion: number;
  lastValidatedAt: string | null;
  nextAction: string;
  updatedAt: string;
};

type SupplierMasterRiskRecord = {
  id: string;
  supplierProfileId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type CreateSupplierMasterProfileInput = Omit<
  SupplierMasterProfileRecord,
  "id" | "supplierId" | "lastValidatedAt" | "updatedAt"
>;

type UpdateSupplierMasterProfileInput = {
  profileId: string;
  complianceStatus: "complete" | "watch" | "blocked";
  satStatus: "controlled" | "watch" | "critical";
  fiscalPacketCompletion: number;
  nextAction: string;
};

type ProcurementRequisitionRecord = {
  id: string;
  companyId: string;
  code: string;
  projectName: string;
  frontName: string;
  requestedBy: string;
  category: string;
  status: "draft" | "submitted" | "approved" | "sourcing" | "blocked";
  requestedItems: number;
  budgetAmount: number;
  urgency: "planned" | "watch" | "critical";
  approvalHours: number;
  supplierCoverage: number;
  nextAction: string;
  updatedAt: string;
};

type ProcurementRequisitionRiskRecord = {
  id: string;
  requisitionId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateProcurementRequisitionInput = {
  requisitionId: string;
  status: "draft" | "submitted" | "approved" | "sourcing" | "blocked";
  nextAction: string;
};

type CreateProcurementRequisitionInput = {
  companyId: string;
  projectName: string;
  frontName: string;
  requestedBy: string;
  category: string;
  status: "draft" | "submitted" | "approved" | "sourcing" | "blocked";
  requestedItems: number;
  budgetAmount: number;
  urgency: "planned" | "watch" | "critical";
  approvalHours: number;
  supplierCoverage: number;
  nextAction: string;
};

type ProcurementPurchaseOrderRecord = {
  id: string;
  companyId: string;
  code: string;
  requisitionCode: string;
  projectName: string;
  supplierName: string;
  buyer: string;
  category: string;
  status: "issued" | "confirmed" | "in_transit" | "partial" | "received" | "blocked";
  totalAmount: number;
  committedEta: string;
  receivedPercent: number;
  invoiceMatchStatus: "matched" | "pending" | "risk";
  logisticsMode: string;
  nextAction: string;
  updatedAt: string;
};

type ProcurementPurchaseOrderRiskRecord = {
  id: string;
  purchaseOrderId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type CreateProcurementPurchaseOrderInput = {
  companyId: string;
  requisitionCode: string;
  projectName: string;
  supplierName: string;
  buyer: string;
  category: string;
  totalAmount: number;
  committedEta: string;
  logisticsMode: string;
  nextAction: string;
};

type UpdateProcurementPurchaseOrderInput = {
  purchaseOrderId: string;
  status: "issued" | "confirmed" | "in_transit" | "partial" | "received" | "blocked";
  nextAction: string;
};

type SyncProcurementPurchaseOrderReceiptInput = {
  purchaseOrderId: string;
  receivedPercent: number;
  status?: "issued" | "confirmed" | "in_transit" | "partial" | "received" | "blocked";
  nextAction?: string;
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

type InventoryReceiptRecord = {
  id: string;
  companyId: string;
  code: string;
  supplierName: string;
  destinationName: string;
  destinationType: string;
  purchaseReference: string;
  etaDate: string;
  receivedDate: string | null;
  status: "draft" | "in_transit" | "received" | "blocked";
  orderedUnits: number;
  receivedUnits: number;
  varianceUnits: number;
  variancePercent: number;
  pendingEvidence: number;
  rejectedUnits: number;
  nextAction: string;
  updatedAt: string;
};

type InventoryReceiptRiskRecord = {
  id: string;
  receiptId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateInventoryReceiptInput = {
  receiptId: string;
  status: "draft" | "in_transit" | "received" | "blocked";
  nextAction: string;
};

type CreateInventoryReceiptInput = {
  companyId: string;
  supplierName: string;
  destinationName: string;
  destinationType: string;
  purchaseReference: string;
  etaDate: string;
  orderedUnits: number;
  receivedUnits: number;
  pendingEvidence: number;
  rejectedUnits: number;
  nextAction: string;
};

type InventoryMovementRecord = {
  id: string;
  companyId: string;
  code: string;
  movementType: "transfer" | "issue" | "return";
  skuName: string;
  sourceName: string;
  destinationName: string;
  requestedBy: string;
  upstreamReceiptCode: string | null;
  purchaseReference: string | null;
  status: "draft" | "in_transit" | "received" | "blocked";
  requestedUnits: number;
  movedUnits: number;
  varianceUnits: number;
  pendingEvidence: number;
  impactLevel: "controlled" | "watch" | "critical";
  nextAction: string;
  updatedAt: string;
};

type InventoryMovementRiskRecord = {
  id: string;
  movementId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type UpdateInventoryMovementInput = {
  movementId: string;
  status: "draft" | "in_transit" | "received" | "blocked";
  nextAction: string;
};

type CreateInventoryMovementInput = {
  companyId: string;
  movementType: "transfer" | "issue" | "return";
  skuName: string;
  sourceName: string;
  destinationName: string;
  requestedBy: string;
  upstreamReceiptCode: string | null;
  purchaseReference: string | null;
  requestedUnits: number;
  movedUnits: number;
  pendingEvidence: number;
  impactLevel: "controlled" | "watch" | "critical";
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

type CreateMachineItemInput = {
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

type AccountsPayableInvoiceRecord = {
  id: string;
  companyId: string;
  supplierProfileId: string | null;
  supplierName: string;
  code: string;
  invoiceNumber: string;
  invoiceUuid: string;
  projectName: string;
  purchaseOrderCode: string | null;
  receiptCode: string | null;
  status: "received" | "matched" | "scheduled" | "blocked" | "paid";
  satStatus: "controlled" | "watch" | "critical";
  complementStatus: "pending" | "complete" | "not_required" | "risk";
  receiptEvidenceStatus: "complete" | "partial" | "missing";
  paymentMethod: string;
  dueDate: string;
  scheduledPaymentDate: string | null;
  receivedAt: string;
  subtotal: number;
  tax: number;
  total: number;
  pendingAmount: number;
  packetCompletion: number;
  nextAction: string;
  updatedAt: string;
};

type AccountsPayableRiskRecord = {
  id: string;
  invoiceId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type CreateAccountsPayableInvoiceInput = {
  companyId: string;
  supplierProfileId?: string | null;
  supplierName: string;
  invoiceNumber: string;
  invoiceUuid: string;
  projectName: string;
  purchaseOrderCode?: string | null;
  receiptCode?: string | null;
  status: "received" | "matched" | "scheduled" | "blocked" | "paid";
  satStatus: "controlled" | "watch" | "critical";
  complementStatus: "pending" | "complete" | "not_required" | "risk";
  receiptEvidenceStatus: "complete" | "partial" | "missing";
  paymentMethod: string;
  dueDate: string;
  scheduledPaymentDate?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  packetCompletion: number;
  nextAction: string;
};

type UpdateAccountsPayableInvoiceInput = {
  invoiceId: string;
  status: "received" | "matched" | "scheduled" | "blocked" | "paid";
  satStatus: "controlled" | "watch" | "critical";
  complementStatus: "pending" | "complete" | "not_required" | "risk";
  scheduledPaymentDate: string | null;
  nextAction: string;
};

type TreasuryPaymentRunInvoiceRecord = {
  invoiceId: string;
  invoiceCode: string;
  supplierName: string;
  total: number;
  scheduledPaymentDate: string | null;
  satStatus: "controlled" | "watch" | "critical";
  complementStatus: "pending" | "complete" | "not_required" | "risk";
  receiptEvidenceStatus: "complete" | "partial" | "missing";
};

type TreasuryPaymentRunRecord = {
  id: string;
  companyId: string;
  code: string;
  bankAccountLabel: string;
  scheduledDate: string;
  status: "draft" | "ready" | "blocked" | "executed";
  totalInvoices: number;
  totalAmount: number;
  criticalInvoices: number;
  owner: string;
  nextAction: string;
  updatedAt: string;
  invoices: TreasuryPaymentRunInvoiceRecord[];
};

type TreasuryPaymentRunRiskRecord = {
  id: string;
  paymentRunId: string;
  title: string;
  category: string;
  severity: "info" | "warning" | "critical";
  owner: string;
  status: string;
};

type CreateTreasuryPaymentRunInput = {
  companyId: string;
  bankAccountLabel: string;
  scheduledDate: string;
  owner: string;
  nextAction: string;
  invoiceIds: string[];
};

type UpdateTreasuryPaymentRunInput = {
  paymentRunId: string;
  status: "draft" | "ready" | "blocked" | "executed";
  nextAction: string;
};

type RemoveTreasuryPaymentRunInvoiceInput = {
  companyId: string;
  paymentRunId: string;
  invoiceId: string;
  nextAction: string;
};

type AddTreasuryPaymentRunInvoiceInput = {
  companyId: string;
  paymentRunId: string;
  invoiceId: string;
  nextAction: string;
};

type MoveTreasuryPaymentRunInvoiceInput = {
  companyId: string;
  sourcePaymentRunId: string;
  targetPaymentRunId: string;
  invoiceId: string;
  nextAction: string;
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

type CreateDocumentControlItemInput = {
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

type CreateQualityInspectionInput = {
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
};

export type PlatformRepository = {
  listCompanies(): Promise<CompanyRecord[]>;
  listModules(): Promise<typeof moduleCatalog>;
  listRoles(): Promise<typeof defaultRoles>;
  listUsers(companyId?: string): Promise<UserRecord[]>;
  listProjects(companyId: string): Promise<ProjectPortfolioItemRecord[]>;
  listProjectScheduleActivities(companyId: string, projectId: string): Promise<ProjectScheduleActivityRecord[]>;
  listProjectRisks(companyId: string): Promise<ProjectRiskRecord[]>;
  listDailyLogEntries(companyId: string): Promise<DailyLogEntryRecord[]>;
  listDailyLogRisks(companyId: string): Promise<DailyLogRiskRecord[]>;
  createDailyLogEntry(input: CreateDailyLogEntryInput): Promise<DailyLogEntryRecord>;
  listFieldMaterialRequests(companyId: string): Promise<FieldMaterialRequestRecord[]>;
  createFieldMaterialRequestAndRequisition(input: CreateFieldMaterialRequestInput): Promise<{
    fieldRequest: FieldMaterialRequestRecord;
    requisition: ProcurementRequisitionRecord;
  }>;
  listProcurementPackages(companyId: string): Promise<ProcurementPackageRecord[]>;
  listProcurementRisks(companyId: string): Promise<ProcurementRiskRecord[]>;
  listSupplierControlLines(companyId: string): Promise<SupplierControlLineRecord[]>;
  listSupplierMasterProfiles(companyId: string): Promise<SupplierMasterProfileRecord[]>;
  listSupplierMasterRisks(companyId: string): Promise<SupplierMasterRiskRecord[]>;
  listProcurementRequisitions(companyId: string): Promise<ProcurementRequisitionRecord[]>;
  listProcurementRequisitionRisks(companyId: string): Promise<ProcurementRequisitionRiskRecord[]>;
  createProcurementRequisition(input: CreateProcurementRequisitionInput): Promise<ProcurementRequisitionRecord>;
  createSupplierControlLine(input: CreateSupplierControlLineInput): Promise<SupplierControlLineRecord>;
  createSupplierMasterProfile(input: CreateSupplierMasterProfileInput): Promise<SupplierMasterProfileRecord>;
  createQualityInspection(input: CreateQualityInspectionInput): Promise<QualityInspectionRecord>;
  listProcurementPurchaseOrders(companyId: string): Promise<ProcurementPurchaseOrderRecord[]>;
  listProcurementPurchaseOrderRisks(companyId: string): Promise<ProcurementPurchaseOrderRiskRecord[]>;
  createProcurementPurchaseOrder(input: CreateProcurementPurchaseOrderInput): Promise<ProcurementPurchaseOrderRecord>;
  syncProcurementPurchaseOrderReceipt(input: SyncProcurementPurchaseOrderReceiptInput): Promise<ProcurementPurchaseOrderRecord>;
  listInventoryLocations(companyId: string): Promise<InventoryLocationRecord[]>;
  listInventoryRisks(companyId: string): Promise<InventoryRiskRecord[]>;
  listInventoryReceipts(companyId: string): Promise<InventoryReceiptRecord[]>;
  listInventoryReceiptRisks(companyId: string): Promise<InventoryReceiptRiskRecord[]>;
  createInventoryReceipt(input: CreateInventoryReceiptInput): Promise<InventoryReceiptRecord>;
  listInventoryMovements(companyId: string): Promise<InventoryMovementRecord[]>;
  listInventoryMovementRisks(companyId: string): Promise<InventoryMovementRiskRecord[]>;
  createInventoryMovement(input: CreateInventoryMovementInput): Promise<InventoryMovementRecord>;
  listMachines(companyId: string): Promise<MachineItemRecord[]>;
  listMachineRisks(companyId: string): Promise<MachineRiskRecord[]>;
  createMachineItem(input: CreateMachineItemInput): Promise<MachineItemRecord>;
  listFinanceItems(companyId: string): Promise<FinanceLedgerItemRecord[]>;
  listFinanceRisks(companyId: string): Promise<FinanceRiskRecord[]>;
  listAccountsPayableInvoices(companyId: string): Promise<AccountsPayableInvoiceRecord[]>;
  listAccountsPayableRisks(companyId: string): Promise<AccountsPayableRiskRecord[]>;
  createAccountsPayableInvoice(input: CreateAccountsPayableInvoiceInput): Promise<AccountsPayableInvoiceRecord>;
  listTreasuryPaymentRuns(companyId: string): Promise<TreasuryPaymentRunRecord[]>;
  listTreasuryPaymentRunRisks(companyId: string): Promise<TreasuryPaymentRunRiskRecord[]>;
  createTreasuryPaymentRun(input: CreateTreasuryPaymentRunInput): Promise<TreasuryPaymentRunRecord>;
  removeTreasuryPaymentRunInvoice(input: RemoveTreasuryPaymentRunInvoiceInput): Promise<TreasuryPaymentRunRecord>;
  addTreasuryPaymentRunInvoice(input: AddTreasuryPaymentRunInvoiceInput): Promise<TreasuryPaymentRunRecord>;
  moveTreasuryPaymentRunInvoice(input: MoveTreasuryPaymentRunInvoiceInput): Promise<TreasuryPaymentRunRecord>;
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
  createDocumentControlItem(input: CreateDocumentControlItemInput): Promise<DocumentControlItemRecord>;
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
  createProjectPortfolioItem(input: CreateProjectPortfolioItemInput): Promise<ProjectPortfolioItemRecord>;
  updateProjectPortfolioItem(input: UpdateProjectPortfolioItemInput): Promise<ProjectPortfolioItemRecord>;
  createProjectScheduleActivity(input: CreateProjectScheduleActivityInput): Promise<ProjectScheduleActivityRecord>;
  updateProjectScheduleActivity(input: UpdateProjectScheduleActivityInput): Promise<ProjectScheduleActivityRecord>;
  updateDailyLogEntry(input: UpdateDailyLogEntryInput): Promise<DailyLogEntryRecord>;
  updateProcurementRequisition(input: UpdateProcurementRequisitionInput): Promise<ProcurementRequisitionRecord>;
  updateProcurementPurchaseOrder(input: UpdateProcurementPurchaseOrderInput): Promise<ProcurementPurchaseOrderRecord>;
  updateCrmLeadBucket(input: UpdateCrmLeadBucketInput): Promise<CrmLeadBucketRecord>;
  updateFinanceLedgerItem(input: UpdateFinanceLedgerItemInput): Promise<FinanceLedgerItemRecord>;
  updateAccountsPayableInvoice(input: UpdateAccountsPayableInvoiceInput): Promise<AccountsPayableInvoiceRecord>;
  updateTreasuryPaymentRun(input: UpdateTreasuryPaymentRunInput): Promise<TreasuryPaymentRunRecord>;
  updateHrWorkforceItem(input: UpdateHrWorkforceItemInput): Promise<HrWorkforceItemRecord>;
  updatePostSaleCase(input: UpdatePostSaleCaseInput): Promise<PostSaleCaseRecord>;
  updateComplianceCase(input: UpdateComplianceCaseInput): Promise<ComplianceCaseRecord>;
  updateIntegrationStream(input: UpdateIntegrationStreamInput): Promise<IntegrationStreamRecord>;
  updateDocumentControlItem(input: UpdateDocumentControlItemInput): Promise<DocumentControlItemRecord>;
  updateInventoryLocation(input: UpdateInventoryLocationInput): Promise<InventoryLocationRecord>;
  updateInventoryReceipt(input: UpdateInventoryReceiptInput): Promise<InventoryReceiptRecord>;
  updateInventoryMovement(input: UpdateInventoryMovementInput): Promise<InventoryMovementRecord>;
  updateMachineItem(input: UpdateMachineItemInput): Promise<MachineItemRecord>;
  updateProcurementPackage(input: UpdateProcurementPackageInput): Promise<ProcurementPackageRecord>;
  updateSupplierControlLine(input: UpdateSupplierControlLineInput): Promise<SupplierControlLineRecord>;
  updateSupplierMasterProfile(input: UpdateSupplierMasterProfileInput): Promise<SupplierMasterProfileRecord>;
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
        "inventory.receiving",
        "inventory.movements",
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
        "inventory.receiving",
        "inventory.movements",
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

  const projectScheduleActivities: ProjectScheduleActivityRecord[] = [
    {
      id: "sch_torre_b_structure",
      companyId: "cmp_arcont_demo",
      projectId: "prj_torre_b",
      code: "TB-STR-010",
      name: "Nucleo y losa nivel 12",
      phase: "Estructura",
      status: "in_progress",
      plannedStart: "2026-07-01",
      plannedFinish: "2026-07-18",
      actualStart: "2026-07-02",
      actualFinish: null,
      progressPercent: 82,
      predecessorIds: [],
      owner: "Superintendencia de obra",
      nextAction: "Cerrar acero de nucleo y confirmar ventana de colado con laboratorio.",
      updatedAt: "2026-07-11T18:20:00.000Z"
    },
    {
      id: "sch_torre_b_facade",
      companyId: "cmp_arcont_demo",
      projectId: "prj_torre_b",
      code: "TB-FAC-020",
      name: "Fachada nivel 10 a 12",
      phase: "Envolvente",
      status: "not_started",
      plannedStart: "2026-07-19",
      plannedFinish: "2026-08-08",
      actualStart: null,
      actualFinish: null,
      progressPercent: 0,
      predecessorIds: ["sch_torre_b_structure"],
      owner: "Coordinacion de acabados",
      nextAction: "Validar liberacion estructural y asegurar muestra de sellado antes de movilizar cuadrilla.",
      updatedAt: "2026-07-11T18:20:00.000Z"
    },
    {
      id: "sch_etapa_2_permits",
      companyId: "cmp_arcont_demo",
      projectId: "prj_etapa_2",
      code: "ET2-PER-010",
      name: "Liberacion de servicios municipales",
      phase: "Permisos",
      status: "blocked",
      plannedStart: "2026-06-24",
      plannedFinish: "2026-07-14",
      actualStart: "2026-06-24",
      actualFinish: null,
      progressPercent: 55,
      predecessorIds: [],
      owner: "Gerencia de permisos",
      nextAction: "Escalar oficio de liberacion y confirmar fecha formal de respuesta del municipio.",
      updatedAt: "2026-07-11T17:10:00.000Z"
    },
    {
      id: "sch_etapa_2_mobilization",
      companyId: "cmp_arcont_demo",
      projectId: "prj_etapa_2",
      code: "ET2-MOB-020",
      name: "Movilizacion de urbanizacion",
      phase: "Movilizacion",
      status: "not_started",
      plannedStart: "2026-07-15",
      plannedFinish: "2026-07-25",
      actualStart: null,
      actualFinish: null,
      progressPercent: 0,
      predecessorIds: ["sch_etapa_2_permits"],
      owner: "Jefatura de obra",
      nextAction: "Preparar frente, equipo y requisiciones para iniciar al liberar permisos.",
      updatedAt: "2026-07-11T17:10:00.000Z"
    },
    {
      id: "sch_cobalto_audit",
      companyId: "cmp_bienestar_gov",
      projectId: "prj_cobalto",
      code: "GOV-AUD-030",
      name: "Tercera supervision de avance",
      phase: "Control gubernamental",
      status: "in_progress",
      plannedStart: "2026-07-08",
      plannedFinish: "2026-07-22",
      actualStart: "2026-07-08",
      actualFinish: null,
      progressPercent: 73,
      predecessorIds: [],
      owner: "Control tecnico",
      nextAction: "Consolidar evidencia de calidad y estimacion para la siguiente supervision.",
      updatedAt: "2026-07-11T16:45:00.000Z"
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

  const fieldMaterialRequests: FieldMaterialRequestRecord[] = [];
  const supplierControlLines: SupplierControlLineRecord[] = [];

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

  const procurementRequisitions: ProcurementRequisitionRecord[] = [
    {
      id: "req_rebar_demo",
      companyId: "cmp_arcont_demo",
      code: "REQ-RBR-01",
      projectName: "Torre B Residencial",
      frontName: "Nucleo vertical",
      requestedBy: "Ramon Cetz",
      category: "Steel",
      status: "submitted",
      requestedItems: 6,
      budgetAmount: 780000,
      urgency: "watch",
      approvalHours: 18,
      supplierCoverage: 1,
      nextAction: "Complete technical validation and route the requisition to buyer review.",
      updatedAt: "2026-07-13T10:15:00.000Z"
    },
    {
      id: "req_formwork_demo",
      companyId: "cmp_arcont_demo",
      code: "REQ-FRM-02",
      projectName: "Etapa 2 Urbanizacion",
      frontName: "Plataforma norte",
      requestedBy: "Nora Pacheco",
      category: "Formwork",
      status: "approved",
      requestedItems: 4,
      budgetAmount: 245000,
      urgency: "planned",
      approvalHours: 9,
      supplierCoverage: 2,
      nextAction: "Convert approved requisition into sourcing package and request final quotations.",
      updatedAt: "2026-07-13T09:20:00.000Z"
    },
    {
      id: "req_prefab_gov",
      companyId: "cmp_bienestar_gov",
      code: "REQ-PRF-03",
      projectName: "Paquete Bienestar Norte",
      frontName: "Pilot housing pad",
      requestedBy: "Lucia Herrera",
      category: "Prefabricated modules",
      status: "blocked",
      requestedItems: 3,
      budgetAmount: 1620000,
      urgency: "critical",
      approvalHours: 31,
      supplierCoverage: 1,
      nextAction: "Resolve specification mismatch before the requisition can move into sourcing.",
      updatedAt: "2026-07-13T08:10:00.000Z"
    },
    {
      id: "req_plumbing_gov",
      companyId: "cmp_bienestar_gov",
      code: "REQ-PLM-04",
      projectName: "Infraestructura Vial y Vivienda",
      frontName: "Campamento principal",
      requestedBy: "Cesar Chan",
      category: "Plumbing kits",
      status: "draft",
      requestedItems: 5,
      budgetAmount: 310000,
      urgency: "watch",
      approvalHours: 0,
      supplierCoverage: 0,
      nextAction: "Finish the scope breakdown and submit the requisition before afternoon planning closes.",
      updatedAt: "2026-07-13T07:55:00.000Z"
    }
  ];

  const procurementRequisitionRisks: ProcurementRequisitionRiskRecord[] = [
    {
      id: "prr_rebar_coverage",
      requisitionId: "req_rebar_demo",
      title: "Rebar requisition still lacks enough supplier coverage",
      category: "Competition",
      severity: "warning",
      owner: "Buyer lead",
      status: "Second supplier pending"
    },
    {
      id: "prr_prefab_spec",
      requisitionId: "req_prefab_gov",
      title: "Prefabricated module requisition blocked by specification mismatch",
      category: "Technical definition",
      severity: "critical",
      owner: "Procurement technical office",
      status: "Engineering clarification open"
    }
  ];

  const procurementPurchaseOrders: ProcurementPurchaseOrderRecord[] = [
    {
      id: "po_rebar_demo",
      companyId: "cmp_arcont_demo",
      code: "PO-RBR-18",
      requisitionCode: "REQ-RBR-01",
      projectName: "Torre B Residencial",
      supplierName: "Aceros del Caribe",
      buyer: "Mariana Salazar",
      category: "Steel",
      status: "confirmed",
      totalAmount: 812000,
      committedEta: "2026-07-18",
      receivedPercent: 0,
      invoiceMatchStatus: "pending",
      logisticsMode: "Direct to jobsite",
      nextAction: "Confirm mill release and secure unloading slot before the first truck departs.",
      updatedAt: "2026-07-13T10:40:00.000Z"
    },
    {
      id: "po_finish_demo",
      companyId: "cmp_arcont_demo",
      code: "PO-FNS-22",
      requisitionCode: "REQ-FRM-02",
      projectName: "Etapa 2 Urbanizacion",
      supplierName: "Concretos Peninsulares",
      buyer: "Felipe Duarte",
      category: "Formwork",
      status: "partial",
      totalAmount: 265000,
      committedEta: "2026-07-15",
      receivedPercent: 68,
      invoiceMatchStatus: "matched",
      logisticsMode: "Cross-dock yard",
      nextAction: "Receive the balance of formwork panels and close the pending quantity variance.",
      updatedAt: "2026-07-13T09:05:00.000Z"
    },
    {
      id: "po_prefab_gov",
      companyId: "cmp_bienestar_gov",
      code: "PO-PRF-07",
      requisitionCode: "REQ-PRF-03",
      projectName: "Paquete Bienestar Norte",
      supplierName: "Modulo Norte Industrial",
      buyer: "Lorena Pech",
      category: "Prefabricated modules",
      status: "blocked",
      totalAmount: 1745000,
      committedEta: "2026-07-24",
      receivedPercent: 0,
      invoiceMatchStatus: "risk",
      logisticsMode: "Factory dispatch",
      nextAction: "Unlock signed technical annex and fiscal packet before authorizing production dispatch.",
      updatedAt: "2026-07-13T08:30:00.000Z"
    },
    {
      id: "po_plumbing_gov",
      companyId: "cmp_bienestar_gov",
      code: "PO-PLM-11",
      requisitionCode: "REQ-PLM-04",
      projectName: "Infraestructura Vial y Vivienda",
      supplierName: "Hidraulica Maya",
      buyer: "Ricardo Uicab",
      category: "Plumbing kits",
      status: "in_transit",
      totalAmount: 328000,
      committedEta: "2026-07-16",
      receivedPercent: 36,
      invoiceMatchStatus: "pending",
      logisticsMode: "Regional carrier",
      nextAction: "Track the second truck and validate delivery evidence against the dispatch manifest.",
      updatedAt: "2026-07-13T07:40:00.000Z"
    }
  ];

  const procurementPurchaseOrderRisks: ProcurementPurchaseOrderRiskRecord[] = [
    {
      id: "ppo_rebar_eta",
      purchaseOrderId: "po_rebar_demo",
      title: "Mill confirmation still missing on the rebar order",
      category: "Logistics",
      severity: "warning",
      owner: "Buyer lead",
      status: "Supplier confirmation pending"
    },
    {
      id: "ppo_prefab_fiscal",
      purchaseOrderId: "po_prefab_gov",
      title: "Blocked prefab order still lacks a compliant fiscal packet",
      category: "Compliance",
      severity: "critical",
      owner: "Procurement controller",
      status: "SAT package under review"
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

  const inventoryReceipts: InventoryReceiptRecord[] = [
    {
      id: "rcv_steel_demo",
      companyId: "cmp_arcont_demo",
      code: "RCV-STEEL-01",
      supplierName: "Aceros del Sureste",
      destinationName: "Central warehouse",
      destinationType: "Warehouse",
      purchaseReference: "PO-RBR-18",
      etaDate: "2026-07-12T13:00:00.000Z",
      receivedDate: null,
      status: "in_transit",
      orderedUnits: 240,
      receivedUnits: 0,
      varianceUnits: 0,
      variancePercent: 0,
      pendingEvidence: 3,
      rejectedUnits: 0,
      nextAction: "Receive the steel shipment and complete unloading evidence before evening cutoff.",
      updatedAt: "2026-07-12T18:10:00.000Z"
    },
    {
      id: "rcv_finish_demo",
      companyId: "cmp_arcont_demo",
      code: "RCV-FIN-02",
      supplierName: "Acabados Peninsulares",
      destinationName: "Jobsite B",
      destinationType: "Jobsite",
      purchaseReference: "PO-FNS-22",
      etaDate: "2026-07-11T16:00:00.000Z",
      receivedDate: null,
      status: "blocked",
      orderedUnits: 96,
      receivedUnits: 72,
      varianceUnits: 24,
      variancePercent: 25,
      pendingEvidence: 5,
      rejectedUnits: 8,
      nextAction: "Resolve damaged tile pallets and upload discrepancy evidence before warehouse acceptance.",
      updatedAt: "2026-07-12T17:35:00.000Z"
    },
    {
      id: "rcv_conc_gov",
      companyId: "cmp_bienestar_gov",
      code: "RCV-CONC-03",
      supplierName: "Concretos Peninsulares",
      destinationName: "Frontline staging area",
      destinationType: "Field staging",
      purchaseReference: "PO-PLM-11",
      etaDate: "2026-07-12T10:30:00.000Z",
      receivedDate: "2026-07-12T11:05:00.000Z",
      status: "received",
      orderedUnits: 18,
      receivedUnits: 18,
      varianceUnits: 0,
      variancePercent: 0,
      pendingEvidence: 0,
      rejectedUnits: 0,
      nextAction: "Archive signed remision and keep the receipt linked to the concrete pour evidence.",
      updatedAt: "2026-07-12T15:20:00.000Z"
    },
    {
      id: "rcv_prefab_gov",
      companyId: "cmp_bienestar_gov",
      code: "RCV-PREF-04",
      supplierName: "Modulos Habitables Norte",
      destinationName: "Prefabrication yard",
      destinationType: "Yard",
      purchaseReference: "PO-PRF-07",
      etaDate: "2026-07-13T14:00:00.000Z",
      receivedDate: null,
      status: "draft",
      orderedUnits: 20,
      receivedUnits: 0,
      varianceUnits: 0,
      variancePercent: 0,
      pendingEvidence: 2,
      rejectedUnits: 0,
      nextAction: "Release inbound checklist and confirm unloading crew before the prefab convoy arrives.",
      updatedAt: "2026-07-12T14:40:00.000Z"
    }
  ];

  const inventoryReceiptRisks: InventoryReceiptRiskRecord[] = [
    {
      id: "irr_finish_damage",
      receiptId: "rcv_finish_demo",
      title: "Damaged tile pallets still pending supplier resolution",
      category: "Quality rejection",
      severity: "critical",
      owner: "Field storekeeper",
      status: "Supplier response pending"
    },
    {
      id: "irr_finish_evidence",
      receiptId: "rcv_finish_demo",
      title: "Receiving evidence pack is still incomplete",
      category: "Documentation",
      severity: "warning",
      owner: "Warehouse analyst",
      status: "Missing signed discrepancy photos"
    },
    {
      id: "irr_steel_eta",
      receiptId: "rcv_steel_demo",
      title: "Inbound steel truck is close to missing the unloading slot",
      category: "ETA slippage",
      severity: "warning",
      owner: "Logistics coordinator",
      status: "Carrier en route to gate"
    }
  ];

  const inventoryMovements: InventoryMovementRecord[] = [
    {
      id: "mov_conduit_demo",
      companyId: "cmp_arcont_demo",
      code: "MOV-CON-01",
      movementType: "transfer",
      skuName: "Conduit 1in",
      sourceName: "Central warehouse",
      destinationName: "Jobsite B",
      requestedBy: "Monica Compras",
      upstreamReceiptCode: "RCV-STEEL-01",
      purchaseReference: "PO-RBR-18",
      status: "in_transit",
      requestedUnits: 180,
      movedUnits: 180,
      varianceUnits: 0,
      pendingEvidence: 2,
      impactLevel: "watch",
      nextAction: "Confirm field receipt and attach unloading evidence before the slab crew starts tomorrow.",
      updatedAt: "2026-07-12T18:20:00.000Z"
    },
    {
      id: "mov_tile_return_demo",
      companyId: "cmp_arcont_demo",
      code: "MOV-TIL-02",
      movementType: "return",
      skuName: "Ceramic tile box",
      sourceName: "Jobsite B",
      destinationName: "Central warehouse",
      requestedBy: "Nora Pacheco",
      upstreamReceiptCode: "RCV-FIN-02",
      purchaseReference: "PO-FNS-22",
      status: "blocked",
      requestedUnits: 24,
      movedUnits: 16,
      varianceUnits: 8,
      pendingEvidence: 4,
      impactLevel: "critical",
      nextAction: "Resolve damaged return boxes and document the discrepancy before warehouse re-entry.",
      updatedAt: "2026-07-12T17:30:00.000Z"
    },
    {
      id: "mov_mesh_gov",
      companyId: "cmp_bienestar_gov",
      code: "MOV-MSH-03",
      movementType: "issue",
      skuName: "Steel mesh panel",
      sourceName: "Prefabrication yard",
      destinationName: "Frontline staging area",
      requestedBy: "Cesar Chan",
      upstreamReceiptCode: "RCV-CONC-03",
      purchaseReference: "PO-PLM-11",
      status: "received",
      requestedUnits: 42,
      movedUnits: 42,
      varianceUnits: 0,
      pendingEvidence: 0,
      impactLevel: "controlled",
      nextAction: "Keep the signed movement note linked to the active foundation package.",
      updatedAt: "2026-07-12T15:40:00.000Z"
    },
    {
      id: "mov_plumbing_gov",
      companyId: "cmp_bienestar_gov",
      code: "MOV-PLM-04",
      movementType: "transfer",
      skuName: "Plumbing kit",
      sourceName: "Prefabrication yard",
      destinationName: "Paquete Bienestar Norte",
      requestedBy: "Lucia Herrera",
      upstreamReceiptCode: "RCV-PREF-04",
      purchaseReference: "PO-PRF-07",
      status: "draft",
      requestedUnits: 32,
      movedUnits: 0,
      varianceUnits: 0,
      pendingEvidence: 1,
      impactLevel: "watch",
      nextAction: "Release the transfer once the destination front confirms storage readiness and unloading labor.",
      updatedAt: "2026-07-12T14:10:00.000Z"
    }
  ];

  const inventoryMovementRisks: InventoryMovementRiskRecord[] = [
    {
      id: "imr_conduit_evidence",
      movementId: "mov_conduit_demo",
      title: "Field unloading evidence still pending for conduit transfer",
      category: "Documentation",
      severity: "warning",
      owner: "Warehouse analyst",
      status: "Waiting for signed field receipt"
    },
    {
      id: "imr_tile_damage",
      movementId: "mov_tile_return_demo",
      title: "Returned tile boxes contain damaged units and variance still open",
      category: "Damage / variance",
      severity: "critical",
      owner: "Inventory lead",
      status: "Physical recount pending"
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

  const accountsPayableInvoices: AccountsPayableInvoiceRecord[] = [
    {
      id: "apinv_steel_demo",
      companyId: "cmp_arcont_demo",
      supplierProfileId: "supm_steel_demo",
      supplierName: "Aceros del Sureste",
      code: "AP-0001",
      invoiceNumber: "FAS-1842",
      invoiceUuid: "0D4B2E47-5C1A-48CC-A503-000000000111",
      projectName: "Torre B Residencial",
      purchaseOrderCode: "PO-RBR-18",
      receiptCode: "RCV-STEEL-01",
      status: "matched",
      satStatus: "watch",
      complementStatus: "pending",
      receiptEvidenceStatus: "partial",
      paymentMethod: "Transferencia",
      dueDate: "2026-07-22",
      scheduledPaymentDate: null,
      receivedAt: "2026-07-12T15:10:00.000Z",
      subtotal: 700000,
      tax: 112000,
      total: 812000,
      pendingAmount: 812000,
      packetCompletion: 86,
      nextAction: "Cerrar evidencia de recepcion firmada y validar complemento antes del siguiente corte de pagos.",
      updatedAt: "2026-07-13T11:10:00.000Z"
    },
    {
      id: "apinv_finish_demo",
      companyId: "cmp_arcont_demo",
      supplierProfileId: null,
      supplierName: "Acabados Peninsulares",
      code: "AP-0002",
      invoiceNumber: "AP-9921",
      invoiceUuid: "7A91F6D1-8234-4B62-9F90-000000000222",
      projectName: "Etapa 2 Urbanizacion",
      purchaseOrderCode: "PO-FNS-22",
      receiptCode: "RCV-FIN-02",
      status: "blocked",
      satStatus: "critical",
      complementStatus: "risk",
      receiptEvidenceStatus: "missing",
      paymentMethod: "Transferencia",
      dueDate: "2026-07-16",
      scheduledPaymentDate: null,
      receivedAt: "2026-07-11T17:00:00.000Z",
      subtotal: 228448.28,
      tax: 36551.72,
      total: 265000,
      pendingAmount: 265000,
      packetCompletion: 62,
      nextAction: "Resolver pallets danados, CFDI observado y evidencia de recepcion antes de liberar pago.",
      updatedAt: "2026-07-13T10:20:00.000Z"
    }
  ];

  const accountsPayableRisks: AccountsPayableRiskRecord[] = [
    {
      id: "apr_demo_steel_packet",
      invoiceId: "apinv_steel_demo",
      title: "Complemento de pago y evidencia de recepcion aun no cierran el expediente",
      category: "SAT / evidence",
      severity: "warning",
      owner: "Fiscal controller",
      status: "Waiting for signed receiving packet"
    },
    {
      id: "apr_demo_finish_block",
      invoiceId: "apinv_finish_demo",
      title: "Factura bloqueada por devolucion parcial y CFDI observado",
      category: "Commercial / fiscal",
      severity: "critical",
      owner: "Treasury lead",
      status: "Blocked until supplier correction and receipt reconciliation"
    }
  ];

  const treasuryPaymentRuns: TreasuryPaymentRunRecord[] = [
    {
      id: "tpr_demo_friday",
      companyId: "cmp_arcont_demo",
      code: "TPR-0001",
      bankAccountLabel: "Banorte Operacion ****4451",
      scheduledDate: "2026-07-24",
      status: "blocked",
      totalInvoices: 2,
      totalAmount: 986000,
      criticalInvoices: 1,
      owner: "Treasury lead",
      nextAction: "Separar factura bloqueada y liberar corrida parcial solo con expediente fiscal y evidencia completos.",
      updatedAt: "2026-07-13T12:10:00.000Z",
      invoices: [
        {
          invoiceId: "apinv_steel_demo",
          invoiceCode: "AP-0001",
          supplierName: "Aceros del Sureste",
          total: 812000,
          scheduledPaymentDate: null,
          satStatus: "watch",
          complementStatus: "pending",
          receiptEvidenceStatus: "partial"
        },
        {
          invoiceId: "apinv_finish_demo",
          invoiceCode: "AP-0002",
          supplierName: "Acabados Peninsulares",
          total: 265000,
          scheduledPaymentDate: null,
          satStatus: "critical",
          complementStatus: "risk",
          receiptEvidenceStatus: "missing"
        }
      ]
    }
  ];

  const treasuryPaymentRunRisks: TreasuryPaymentRunRiskRecord[] = [
    {
      id: "tprr_demo_blocked_invoice",
      paymentRunId: "tpr_demo_friday",
      title: "La corrida incluye una factura bloqueada por CFDI y evidencia incompleta",
      category: "Release rule",
      severity: "critical",
      owner: "Treasury lead",
      status: "Split required before execution"
    }
  ];

  const supplierMasterProfiles: SupplierMasterProfileRecord[] = [
    {
      id: "supm_steel_demo",
      supplierId: "sup_aceros_del_sureste",
      companyId: "cmp_arcont_demo",
      supplierName: "Aceros del Sureste",
      tradeName: "Aceros del Sureste SA de CV",
      rfc: "ASU240101AB1",
      fiscalRegime: "601",
      cfdiUse: "G03",
      paymentMethod: "Transferencia",
      paymentTermsDays: 30,
      bankAccountMasked: "****9012",
      contactName: "Monica Fiscal",
      contactEmail: "fiscal@acerosdelsureste.mx",
      contactPhone: "9991234567",
      complianceStatus: "watch",
      satStatus: "watch",
      fiscalPacketCompletion: 82,
      lastValidatedAt: "2026-07-10T12:00:00.000Z",
      nextAction: "Cerrar validacion de constancia fiscal y complemento de pago antes de la adjudicacion final.",
      updatedAt: "2026-07-11T18:00:00.000Z"
    },
    {
      id: "supm_mep_demo",
      supplierId: "sup_electromec_mx",
      companyId: "cmp_arcont_demo",
      supplierName: "Electromec MX",
      tradeName: "Electromec MX Integraciones",
      rfc: "EMX240101BC2",
      fiscalRegime: "601",
      cfdiUse: "I01",
      paymentMethod: "Transferencia",
      paymentTermsDays: 21,
      bankAccountMasked: "****4455",
      contactName: "Laura Cuentas",
      contactEmail: "cuentas@electromecmx.com",
      contactPhone: "9997654321",
      complianceStatus: "blocked",
      satStatus: "critical",
      fiscalPacketCompletion: 64,
      lastValidatedAt: "2026-07-09T16:30:00.000Z",
      nextAction: "Bloquear alta contable hasta recibir opinion SAT y expediente bancario actualizado.",
      updatedAt: "2026-07-11T17:20:00.000Z"
    }
  ];

  const supplierMasterRisks: SupplierMasterRiskRecord[] = [
    {
      id: "smr_steel_constancia",
      supplierProfileId: "supm_steel_demo",
      title: "Constancia de situacion fiscal pendiente de validacion final",
      category: "SAT",
      severity: "warning",
      owner: "Fiscal controller",
      status: "Awaiting refreshed document"
    },
    {
      id: "smr_mep_opinion",
      supplierProfileId: "supm_mep_demo",
      title: "Opinion de cumplimiento SAT y expediente bancario incompletos",
      category: "Vendor compliance",
      severity: "critical",
      owner: "Procurement controller",
      status: "Vendor blocked until packet is complete"
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
      projectScheduleActivities,
      projectRisks,
      dailyLogEntries,
      dailyLogRisks,
      procurementPackages,
      procurementRisks,
      supplierControlLines,
      supplierMasterProfiles,
      supplierMasterRisks,
      fieldMaterialRequests,
      procurementRequisitions,
      procurementRequisitionRisks,
      procurementPurchaseOrders,
      procurementPurchaseOrderRisks,
      inventoryLocations,
      inventoryRisks,
      inventoryReceipts,
      inventoryReceiptRisks,
      inventoryMovements,
      inventoryMovementRisks,
      machines,
      machineRisks,
      financeItems,
      financeRisks,
      accountsPayableInvoices,
      accountsPayableRisks,
      treasuryPaymentRuns,
      treasuryPaymentRunRisks,
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
    async listProjectScheduleActivities(companyId: string, projectId: string) {
      return state.projectScheduleActivities.filter(
        (activity) => activity.companyId === companyId && activity.projectId === projectId
      );
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
    async listFieldMaterialRequests(companyId: string) {
      return state.fieldMaterialRequests.filter((request) => request.companyId === companyId);
    },
    async createFieldMaterialRequestAndRequisition(input) {
      const now = new Date().toISOString();
      const requisition: ProcurementRequisitionRecord = {
        id: createPrefixedId("req"),
        companyId: input.companyId,
        code: `REQ-FLD-${String(state.procurementRequisitions.filter((item) => item.companyId === input.companyId).length + 1).padStart(3, "0")}`,
        projectName: input.projectName,
        frontName: input.frontName,
        requestedBy: input.requestedBy,
        category: input.category,
        status: "draft",
        requestedItems: input.requestedItems,
        budgetAmount: input.budgetAmount,
        urgency: input.urgency,
        approvalHours: input.approvalHours,
        supplierCoverage: input.supplierCoverage,
        nextAction: `${input.nextAction} · ${input.requestedVolume}`,
        updatedAt: now
      };
      const fieldRequest: FieldMaterialRequestRecord = {
        id: createPrefixedId("fmr"),
        companyId: input.companyId,
        requisitionId: requisition.id,
        projectName: input.projectName,
        frontName: input.frontName,
        requestedBy: input.requestedBy,
        summary: input.summary,
        detail: input.detail,
        requestedVolume: input.requestedVolume,
        urgency: input.urgency,
        nextAction: input.nextAction,
        status: "converted",
        createdAt: now,
        updatedAt: now
      };

      state.procurementRequisitions.unshift(requisition);
      state.fieldMaterialRequests.unshift(fieldRequest);
      if (input.supplierCoverage === 0) {
        state.procurementRequisitionRisks.unshift({
          id: createPrefixedId("reqrisk"),
          requisitionId: requisition.id,
          title: "No supplier route confirmed from field intake",
          category: "Coverage",
          severity: input.urgency === "critical" ? "critical" : "warning",
          owner: "Procurement lead",
          status: "Supplier mapping pending before release"
        });
      }
      if (input.urgency === "critical") {
        state.procurementRequisitionRisks.unshift({
          id: createPrefixedId("reqrisk"),
          requisitionId: requisition.id,
          title: "Critical field request requires same-day procurement triage",
          category: "Urgency",
          severity: "critical",
          owner: "Procurement lead",
          status: "Escalate sourcing decision in current operating window"
        });
      }

      return { fieldRequest, requisition };
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
    async listSupplierControlLines(companyId: string) {
      return state.supplierControlLines.filter((item) => item.companyId === companyId);
    },
    async listSupplierMasterProfiles(companyId: string) {
      return state.supplierMasterProfiles.filter((item) => item.companyId === companyId);
    },
    async listSupplierMasterRisks(companyId: string) {
      const profileIds = new Set(
        state.supplierMasterProfiles.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.supplierMasterRisks.filter((risk) => profileIds.has(risk.supplierProfileId));
    },
    async listProcurementRequisitions(companyId: string) {
      return state.procurementRequisitions.filter((item) => item.companyId === companyId);
    },
    async listProcurementRequisitionRisks(companyId: string) {
      const requisitionIds = new Set(
        state.procurementRequisitions.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.procurementRequisitionRisks.filter((risk) => requisitionIds.has(risk.requisitionId));
    },
    async createProcurementRequisition(input) {
      const requisition: ProcurementRequisitionRecord = {
        id: createPrefixedId("req"),
        companyId: input.companyId,
        code: `REQ-MNL-${String(state.procurementRequisitions.filter((item) => item.companyId === input.companyId).length + 1).padStart(3, "0")}`,
        projectName: input.projectName,
        frontName: input.frontName,
        requestedBy: input.requestedBy,
        category: input.category,
        status: input.status,
        requestedItems: input.requestedItems,
        budgetAmount: input.budgetAmount,
        urgency: input.urgency,
        approvalHours: input.approvalHours,
        supplierCoverage: input.supplierCoverage,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.procurementRequisitions.unshift(requisition);
      return requisition;
    },
    async createSupplierControlLine(input) {
      const supplierId = `sup_${input.supplierName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      const line: SupplierControlLineRecord = {
        id: createPrefixedId("scl"),
        supplierId,
        companyId: input.companyId,
        supplierName: input.supplierName,
        owner: input.owner,
        awardedPackages: input.awardedPackages,
        activePackages: input.activePackages,
        contractedAmount: input.contractedAmount,
        concentrationPercent: input.concentrationPercent,
        bidCoverage: input.bidCoverage,
        deliveryHealth: input.deliveryHealth,
        approvalPressureHours: input.approvalPressureHours,
        complianceAlerts: input.complianceAlerts,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.supplierControlLines.unshift(line);
      return line;
    },
    async createSupplierMasterProfile(input) {
      const supplierId = `sup_${input.supplierName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      const profile: SupplierMasterProfileRecord = {
        id: createPrefixedId("supm"),
        supplierId,
        companyId: input.companyId,
        supplierName: input.supplierName,
        tradeName: input.tradeName,
        rfc: input.rfc,
        fiscalRegime: input.fiscalRegime,
        cfdiUse: input.cfdiUse,
        paymentMethod: input.paymentMethod,
        paymentTermsDays: input.paymentTermsDays,
        bankAccountMasked: input.bankAccountMasked,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        complianceStatus: input.complianceStatus,
        satStatus: input.satStatus,
        fiscalPacketCompletion: input.fiscalPacketCompletion,
        lastValidatedAt: new Date().toISOString(),
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.supplierMasterProfiles.unshift(profile);
      return profile;
    },
    async createAccountsPayableInvoice(input) {
      const sequence = state.accountsPayableInvoices.filter((invoice) => invoice.companyId === input.companyId).length + 1;
      const invoice: AccountsPayableInvoiceRecord = {
        id: createPrefixedId("apin"),
        companyId: input.companyId,
        supplierProfileId: input.supplierProfileId ?? null,
        supplierName: input.supplierName,
        code: `AP-${String(sequence).padStart(4, "0")}`,
        invoiceNumber: input.invoiceNumber,
        invoiceUuid: input.invoiceUuid,
        projectName: input.projectName,
        purchaseOrderCode: input.purchaseOrderCode ?? null,
        receiptCode: input.receiptCode ?? null,
        status: input.status,
        satStatus: input.satStatus,
        complementStatus: input.complementStatus,
        receiptEvidenceStatus: input.receiptEvidenceStatus,
        paymentMethod: input.paymentMethod,
        dueDate: input.dueDate,
        scheduledPaymentDate: input.scheduledPaymentDate ?? null,
        receivedAt: new Date().toISOString(),
        subtotal: input.subtotal,
        tax: input.tax,
        total: input.total,
        pendingAmount: input.status === "paid" ? 0 : input.total,
        packetCompletion: input.packetCompletion,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.accountsPayableInvoices.unshift(invoice);
      return invoice;
    },
    async createTreasuryPaymentRun(input) {
      const sequence = state.treasuryPaymentRuns.filter((run) => run.companyId === input.companyId).length + 1;
      const linkedInvoices = state.accountsPayableInvoices.filter((invoice) => input.invoiceIds.includes(invoice.id));
      const run: TreasuryPaymentRunRecord = {
        id: createPrefixedId("tpr"),
        companyId: input.companyId,
        code: `TPR-${String(sequence).padStart(4, "0")}`,
        bankAccountLabel: input.bankAccountLabel,
        scheduledDate: input.scheduledDate,
        status: "draft",
        totalInvoices: linkedInvoices.length,
        totalAmount: linkedInvoices.reduce((sum, invoice) => sum + invoice.pendingAmount, 0),
        criticalInvoices: linkedInvoices.filter((invoice) => invoice.status === "blocked" || invoice.satStatus === "critical").length,
        owner: input.owner,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString(),
        invoices: linkedInvoices.map((invoice) => ({
          invoiceId: invoice.id,
          invoiceCode: invoice.code,
          supplierName: invoice.supplierName,
          total: invoice.pendingAmount,
          scheduledPaymentDate: invoice.scheduledPaymentDate,
          satStatus: invoice.satStatus,
          complementStatus: invoice.complementStatus,
          receiptEvidenceStatus: invoice.receiptEvidenceStatus
        }))
      };

      state.treasuryPaymentRuns.unshift(run);
      return run;
    },
    async removeTreasuryPaymentRunInvoice(input) {
      const run = state.treasuryPaymentRuns.find((candidate) => candidate.id === input.paymentRunId && candidate.companyId === input.companyId);
      if (!run) {
        throw new Error("Treasury payment run not found in repository");
      }

      run.invoices = run.invoices.filter((invoice) => invoice.invoiceId !== input.invoiceId);
      run.totalInvoices = run.invoices.length;
      run.totalAmount = run.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
      run.criticalInvoices = run.invoices.filter((invoice) => invoice.satStatus === "critical" || invoice.complementStatus === "risk").length;
      run.status = "draft";
      run.nextAction = input.nextAction;
      run.updatedAt = new Date().toISOString();
      return run;
    },
    async addTreasuryPaymentRunInvoice(input) {
      const run = state.treasuryPaymentRuns.find((candidate) => candidate.id === input.paymentRunId && candidate.companyId === input.companyId);
      if (!run) {
        throw new Error("Treasury payment run not found in repository");
      }

      const invoice = state.accountsPayableInvoices.find((candidate) => candidate.id === input.invoiceId && candidate.companyId === input.companyId);
      if (!invoice) {
        throw new Error("Accounts payable invoice not found in repository");
      }

      run.invoices.push({
        invoiceId: invoice.id,
        invoiceCode: invoice.code,
        supplierName: invoice.supplierName,
        total: invoice.pendingAmount,
        scheduledPaymentDate: invoice.scheduledPaymentDate,
        satStatus: invoice.satStatus,
        complementStatus: invoice.complementStatus,
        receiptEvidenceStatus: invoice.receiptEvidenceStatus
      });
      run.totalInvoices = run.invoices.length;
      run.totalAmount = run.invoices.reduce((sum, item) => sum + item.total, 0);
      run.criticalInvoices = run.invoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length;
      run.status = "draft";
      run.nextAction = input.nextAction;
      run.updatedAt = new Date().toISOString();
      return run;
    },
    async moveTreasuryPaymentRunInvoice(input) {
      const sourceRun = state.treasuryPaymentRuns.find(
        (candidate) => candidate.id === input.sourcePaymentRunId && candidate.companyId === input.companyId
      );
      const targetRun = state.treasuryPaymentRuns.find(
        (candidate) => candidate.id === input.targetPaymentRunId && candidate.companyId === input.companyId
      );
      if (!sourceRun || !targetRun) {
        throw new Error("Treasury payment run not found in repository");
      }

      const movedInvoice = sourceRun.invoices.find((invoice) => invoice.invoiceId === input.invoiceId);
      if (!movedInvoice) {
        throw new Error("Treasury payment run invoice not found in repository");
      }

      sourceRun.invoices = sourceRun.invoices.filter((invoice) => invoice.invoiceId !== input.invoiceId);
      sourceRun.totalInvoices = sourceRun.invoices.length;
      sourceRun.totalAmount = sourceRun.invoices.reduce((sum, item) => sum + item.total, 0);
      sourceRun.criticalInvoices = sourceRun.invoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length;
      sourceRun.status = "draft";
      sourceRun.nextAction = input.nextAction;
      sourceRun.updatedAt = new Date().toISOString();

      targetRun.invoices.push(movedInvoice);
      targetRun.totalInvoices = targetRun.invoices.length;
      targetRun.totalAmount = targetRun.invoices.reduce((sum, item) => sum + item.total, 0);
      targetRun.criticalInvoices = targetRun.invoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length;
      targetRun.status = "draft";
      targetRun.nextAction = input.nextAction;
      targetRun.updatedAt = new Date().toISOString();
      return targetRun;
    },
    async listProcurementPurchaseOrders(companyId: string) {
      return state.procurementPurchaseOrders.filter((item) => item.companyId === companyId);
    },
    async listProcurementPurchaseOrderRisks(companyId: string) {
      const purchaseOrderIds = new Set(
        state.procurementPurchaseOrders.filter((item) => item.companyId === companyId).map((item) => item.id)
      );
      return state.procurementPurchaseOrderRisks.filter((risk) => purchaseOrderIds.has(risk.purchaseOrderId));
    },
    async createProcurementPurchaseOrder(input) {
      const now = new Date().toISOString();
      const purchaseOrder: ProcurementPurchaseOrderRecord = {
        id: createPrefixedId("po"),
        companyId: input.companyId,
        code: `PO-MNL-${String(state.procurementPurchaseOrders.filter((item) => item.companyId === input.companyId).length + 1).padStart(2, "0")}`,
        requisitionCode: input.requisitionCode,
        projectName: input.projectName,
        supplierName: input.supplierName,
        buyer: input.buyer,
        category: input.category,
        status: "issued",
        totalAmount: input.totalAmount,
        committedEta: input.committedEta,
        receivedPercent: 0,
        invoiceMatchStatus: "pending",
        logisticsMode: input.logisticsMode,
        nextAction: input.nextAction,
        updatedAt: now
      };

      state.procurementPurchaseOrders.unshift(purchaseOrder);
      return purchaseOrder;
    },
    async syncProcurementPurchaseOrderReceipt(input) {
      const purchaseOrder = state.procurementPurchaseOrders.find((item) => item.id === input.purchaseOrderId);
      if (!purchaseOrder) {
        throw new Error("Procurement purchase order not found in repository");
      }

      purchaseOrder.receivedPercent = input.receivedPercent;
      if (input.status) {
        purchaseOrder.status = input.status;
      }
      if (input.nextAction) {
        purchaseOrder.nextAction = input.nextAction;
      }
      purchaseOrder.updatedAt = new Date().toISOString();
      return purchaseOrder;
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
    async listInventoryReceipts(companyId: string) {
      return state.inventoryReceipts.filter((receipt) => receipt.companyId === companyId);
    },
    async listInventoryReceiptRisks(companyId: string) {
      const receiptIds = new Set(
        state.inventoryReceipts.filter((receipt) => receipt.companyId === companyId).map((receipt) => receipt.id)
      );
      return state.inventoryReceiptRisks.filter((risk) => receiptIds.has(risk.receiptId));
    },
    async createInventoryReceipt(input) {
      const orderedUnits = input.orderedUnits;
      const receivedUnits = input.receivedUnits;
      const varianceUnits = Number((receivedUnits - orderedUnits).toFixed(2));
      const variancePercent = orderedUnits > 0 ? Number(((varianceUnits / orderedUnits) * 100).toFixed(2)) : 0;
      const now = new Date().toISOString();
      const receipt: InventoryReceiptRecord = {
        id: createPrefixedId("receipt"),
        companyId: input.companyId,
        code: `RCV-MNL-${String(state.inventoryReceipts.filter((item) => item.companyId === input.companyId).length + 1).padStart(2, "0")}`,
        supplierName: input.supplierName,
        destinationName: input.destinationName,
        destinationType: input.destinationType,
        purchaseReference: input.purchaseReference,
        etaDate: input.etaDate,
        receivedDate: null,
        status: "draft",
        orderedUnits,
        receivedUnits,
        varianceUnits,
        variancePercent,
        pendingEvidence: input.pendingEvidence,
        rejectedUnits: input.rejectedUnits,
        nextAction: input.nextAction,
        updatedAt: now
      };

      state.inventoryReceipts.unshift(receipt);
      return receipt;
    },
    async listInventoryMovements(companyId: string) {
      return state.inventoryMovements.filter((movement) => movement.companyId === companyId);
    },
    async listInventoryMovementRisks(companyId: string) {
      const movementIds = new Set(
        state.inventoryMovements.filter((movement) => movement.companyId === companyId).map((movement) => movement.id)
      );
      return state.inventoryMovementRisks.filter((risk) => movementIds.has(risk.movementId));
    },
    async createInventoryMovement(input) {
      const requestedUnits = input.requestedUnits;
      const movedUnits = input.movedUnits;
      const varianceUnits = Number((movedUnits - requestedUnits).toFixed(2));
      const now = new Date().toISOString();
      const movement: InventoryMovementRecord = {
        id: createPrefixedId("move"),
        companyId: input.companyId,
        code: `MOV-MNL-${String(state.inventoryMovements.filter((item) => item.companyId === input.companyId).length + 1).padStart(2, "0")}`,
        movementType: input.movementType,
        skuName: input.skuName,
        sourceName: input.sourceName,
        destinationName: input.destinationName,
        requestedBy: input.requestedBy,
        upstreamReceiptCode: input.upstreamReceiptCode,
        purchaseReference: input.purchaseReference,
        status: "draft",
        requestedUnits,
        movedUnits,
        varianceUnits,
        pendingEvidence: input.pendingEvidence,
        impactLevel: input.impactLevel,
        nextAction: input.nextAction,
        updatedAt: now
      };

      state.inventoryMovements.unshift(movement);
      return movement;
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
    async listAccountsPayableInvoices(companyId: string) {
      return state.accountsPayableInvoices.filter((invoice) => invoice.companyId === companyId);
    },
    async listAccountsPayableRisks(companyId: string) {
      const invoiceIds = new Set(
        state.accountsPayableInvoices.filter((invoice) => invoice.companyId === companyId).map((invoice) => invoice.id)
      );
      return state.accountsPayableRisks.filter((risk) => invoiceIds.has(risk.invoiceId));
    },
    async listTreasuryPaymentRuns(companyId: string) {
      return state.treasuryPaymentRuns.filter((run) => run.companyId === companyId);
    },
    async listTreasuryPaymentRunRisks(companyId: string) {
      const runIds = new Set(state.treasuryPaymentRuns.filter((run) => run.companyId === companyId).map((run) => run.id));
      return state.treasuryPaymentRunRisks.filter((risk) => runIds.has(risk.paymentRunId));
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
    async createProjectPortfolioItem(input) {
      const item: ProjectPortfolioItemRecord = {
        id: createPrefixedId("prj"),
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        client: input.client,
        segment: input.segment,
        status: input.status,
        stage: input.stage,
        progress: input.progress,
        scheduleVarianceDays: input.scheduleVarianceDays,
        budgetHealth: input.budgetHealth,
        qualityHolds: input.qualityHolds,
        permitBlockers: input.permitBlockers,
        activeFronts: input.activeFronts,
        updatedAt: new Date().toISOString(),
        nextMilestone: input.nextMilestone
      };

      state.projects.unshift(item);
      return item;
    },
    async createProjectScheduleActivity(input) {
      const item: ProjectScheduleActivityRecord = {
        id: createPrefixedId("sch"),
        companyId: input.companyId,
        projectId: input.projectId,
        code: input.code,
        name: input.name,
        phase: input.phase,
        status: "not_started",
        plannedStart: input.plannedStart,
        plannedFinish: input.plannedFinish,
        actualStart: null,
        actualFinish: null,
        progressPercent: 0,
        predecessorIds: input.predecessorIds,
        owner: input.owner,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.projectScheduleActivities.unshift(item);
      return item;
    },
    async updateProjectScheduleActivity(input) {
      const item = state.projectScheduleActivities.find(
        (candidate) => candidate.id === input.activityId && candidate.companyId === input.companyId && candidate.projectId === input.projectId
      );
      if (!item) {
        throw new Error("Project schedule activity not found in repository");
      }

      item.status = input.status;
      item.progressPercent = input.progressPercent;
      item.plannedStart = input.plannedStart;
      item.plannedFinish = input.plannedFinish;
      item.actualStart = input.actualStart;
      item.actualFinish = input.actualFinish;
      item.predecessorIds = input.predecessorIds;
      item.owner = input.owner;
      item.nextAction = input.nextAction;
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
    async createDailyLogEntry(input) {
      const entry: DailyLogEntryRecord = {
        id: `daily_log_${state.dailyLogEntries.length + 1}_${Date.now()}`,
        companyId: input.companyId,
        projectName: input.projectName,
        frontName: input.frontName,
        supervisor: input.supervisor,
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
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.dailyLogEntries.unshift(entry);
      return entry;
    },
    async updateProcurementRequisition(input) {
      const requisition = state.procurementRequisitions.find((candidate) => candidate.id === input.requisitionId);
      if (!requisition) {
        throw new Error("Procurement requisition not found in repository");
      }

      requisition.status = input.status;
      requisition.nextAction = input.nextAction;
      requisition.updatedAt = new Date().toISOString();
      return requisition;
    },
    async updateProcurementPurchaseOrder(input) {
      const purchaseOrder = state.procurementPurchaseOrders.find((candidate) => candidate.id === input.purchaseOrderId);
      if (!purchaseOrder) {
        throw new Error("Procurement purchase order not found in repository");
      }

      purchaseOrder.status = input.status;
      purchaseOrder.nextAction = input.nextAction;
      purchaseOrder.updatedAt = new Date().toISOString();
      return purchaseOrder;
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
    async updateAccountsPayableInvoice(input) {
      const item = state.accountsPayableInvoices.find((candidate) => candidate.id === input.invoiceId);
      if (!item) {
        throw new Error("Accounts payable invoice not found in repository");
      }

      item.status = input.status;
      item.satStatus = input.satStatus;
      item.complementStatus = input.complementStatus;
      item.scheduledPaymentDate = input.scheduledPaymentDate;
      item.pendingAmount = input.status === "paid" ? 0 : item.total;
      item.nextAction = input.nextAction;
      item.updatedAt = new Date().toISOString();
      return item;
    },
    async updateTreasuryPaymentRun(input) {
      const run = state.treasuryPaymentRuns.find((candidate) => candidate.id === input.paymentRunId);
      if (!run) {
        throw new Error("Treasury payment run not found in repository");
      }

      run.status = input.status;
      run.nextAction = input.nextAction;
      run.updatedAt = new Date().toISOString();
      return run;
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
    async updateInventoryReceipt(input) {
      const receipt = state.inventoryReceipts.find((item) => item.id === input.receiptId);
      if (!receipt) {
        throw new Error("Inventory receipt not found in repository");
      }

      receipt.status = input.status;
      receipt.nextAction = input.nextAction;
      if (input.status === "received" && !receipt.receivedDate) {
        receipt.receivedDate = new Date().toISOString();
      }
      receipt.updatedAt = new Date().toISOString();
      return receipt;
    },
    async updateInventoryMovement(input) {
      const movement = state.inventoryMovements.find((item) => item.id === input.movementId);
      if (!movement) {
        throw new Error("Inventory movement not found in repository");
      }

      movement.status = input.status;
      movement.nextAction = input.nextAction;
      movement.updatedAt = new Date().toISOString();
      return movement;
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
    async createMachineItem(input) {
      const machine: MachineItemRecord = {
        id: `machine_${state.machines.length + 1}_${Date.now()}`,
        companyId: input.companyId,
        code: input.code,
        machineName: input.machineName,
        machineType: input.machineType,
        projectName: input.projectName,
        frontName: input.frontName,
        status: input.status,
        health: input.health,
        availabilityPercent: input.availabilityPercent,
        utilizationPercent: input.utilizationPercent,
        hourMeter: input.hourMeter,
        nextMaintenanceHours: input.nextMaintenanceHours,
        maintenanceDueDate: input.maintenanceDueDate,
        maintenanceBacklog: input.maintenanceBacklog,
        openFailures: input.openFailures,
        criticalOpenFailures: input.criticalOpenFailures,
        lastServiceAt: input.lastServiceAt,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.machines.unshift(machine);
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
    async createDocumentControlItem(input) {
      const item: DocumentControlItemRecord = {
        id: `document_control_${state.documentControlItems.length + 1}_${Date.now()}`,
        companyId: input.companyId,
        code: input.code,
        documentType: input.documentType,
        subject: input.subject,
        projectName: input.projectName,
        owner: input.owner,
        status: input.status,
        revisionCount: input.revisionCount,
        turnaroundDays: input.turnaroundDays,
        openComments: input.openComments,
        health: input.health,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.documentControlItems.unshift(item);
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
    async updateSupplierControlLine(input) {
      const line = state.supplierControlLines.find((item) => item.id === input.lineId);
      if (!line) {
        throw new Error("Supplier control line not found in repository");
      }

      line.deliveryHealth = input.deliveryHealth;
      line.nextAction = input.nextAction;
      line.updatedAt = new Date().toISOString();
      return line;
    },
    async updateSupplierMasterProfile(input) {
      const profile = state.supplierMasterProfiles.find((item) => item.id === input.profileId);
      if (!profile) {
        throw new Error("Supplier master profile not found in repository");
      }

      profile.complianceStatus = input.complianceStatus;
      profile.satStatus = input.satStatus;
      profile.fiscalPacketCompletion = input.fiscalPacketCompletion;
      profile.nextAction = input.nextAction;
      profile.lastValidatedAt = new Date().toISOString();
      profile.updatedAt = new Date().toISOString();
      return profile;
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
    async createQualityInspection(input) {
      const inspection: QualityInspectionRecord = {
        id: `quality_${state.qualityInspections.length + 1}_${Date.now()}`,
        companyId: input.companyId,
        code: input.code,
        areaName: input.areaName,
        checklistName: input.checklistName,
        contractorName: input.contractorName,
        severity: input.severity,
        openFindings: input.openFindings,
        evidenceCompletion: input.evidenceCompletion,
        releaseReadiness: input.releaseReadiness,
        reworkRate: input.reworkRate,
        status: input.status,
        nextAction: input.nextAction,
        updatedAt: new Date().toISOString()
      };

      state.qualityInspections.unshift(inspection);
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

function mapProcurementPackageRow(row: Record<string, unknown>): ProcurementPackageRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    packageName: String(row.package_name),
    projectName: String(row.project_name),
    buyer: String(row.buyer),
    status: row.status as ProcurementPackageRecord["status"],
    budgetAmount: Number(row.budget_amount),
    bidCount: Number(row.bid_count),
    approvalHours: Number(row.approval_hours),
    strategic: Boolean(row.strategic),
    supplierContention: Number(row.supplier_contention),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapProcurementRiskRow(row: Record<string, unknown>): ProcurementRiskRecord {
  return {
    id: String(row.id),
    packageId: String(row.package_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as ProcurementRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapSupplierControlLineRow(row: Record<string, unknown>): SupplierControlLineRecord {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    companyId: String(row.company_id),
    supplierName: String(row.supplier_name),
    owner: String(row.owner_name),
    awardedPackages: Number(row.awarded_packages),
    activePackages: Number(row.active_packages),
    contractedAmount: Number(row.contracted_amount),
    concentrationPercent: Number(row.concentration_percent),
    bidCoverage: Number(row.bid_coverage),
    deliveryHealth: row.delivery_health as SupplierControlLineRecord["deliveryHealth"],
    approvalPressureHours: Number(row.approval_pressure_hours),
    complianceAlerts: Number(row.compliance_alerts),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapSupplierMasterProfileRow(row: Record<string, unknown>): SupplierMasterProfileRecord {
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    companyId: String(row.company_id),
    supplierName: String(row.supplier_name),
    tradeName: String(row.trade_name),
    rfc: String(row.rfc),
    fiscalRegime: String(row.fiscal_regime),
    cfdiUse: String(row.cfdi_use),
    paymentMethod: String(row.payment_method),
    paymentTermsDays: Number(row.payment_terms_days),
    bankAccountMasked: String(row.bank_account_masked),
    contactName: String(row.contact_name),
    contactEmail: String(row.contact_email),
    contactPhone: String(row.contact_phone),
    complianceStatus: row.compliance_status as SupplierMasterProfileRecord["complianceStatus"],
    satStatus: row.sat_status as SupplierMasterProfileRecord["satStatus"],
    fiscalPacketCompletion: Number(row.fiscal_packet_completion),
    lastValidatedAt: row.last_validated_at ? String(row.last_validated_at) : null,
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapSupplierMasterRiskRow(row: Record<string, unknown>): SupplierMasterRiskRecord {
  return {
    id: String(row.id),
    supplierProfileId: String(row.supplier_profile_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as SupplierMasterRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapProcurementRequisitionRow(row: Record<string, unknown>): ProcurementRequisitionRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    projectName: String(row.project_name),
    frontName: String(row.front_name),
    requestedBy: String(row.requested_by),
    category: String(row.category),
    status: row.status as ProcurementRequisitionRecord["status"],
    requestedItems: Number(row.requested_items),
    budgetAmount: Number(row.budget_amount),
    urgency: row.urgency as ProcurementRequisitionRecord["urgency"],
    approvalHours: Number(row.approval_hours),
    supplierCoverage: Number(row.supplier_coverage),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapProcurementRequisitionRiskRow(row: Record<string, unknown>): ProcurementRequisitionRiskRecord {
  return {
    id: String(row.id),
    requisitionId: String(row.requisition_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as ProcurementRequisitionRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapFieldMaterialRequestRow(row: Record<string, unknown>): FieldMaterialRequestRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    requisitionId: row.requisition_id ? String(row.requisition_id) : null,
    projectName: String(row.project_name),
    frontName: String(row.front_name),
    requestedBy: String(row.requested_by),
    summary: String(row.summary),
    detail: String(row.detail),
    requestedVolume: String(row.requested_volume),
    urgency: row.urgency as FieldMaterialRequestRecord["urgency"],
    nextAction: String(row.next_action),
    status: row.status as FieldMaterialRequestRecord["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapProcurementPurchaseOrderRow(row: Record<string, unknown>): ProcurementPurchaseOrderRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    requisitionCode: String(row.requisition_code),
    projectName: String(row.project_name),
    supplierName: String(row.supplier_name),
    buyer: String(row.buyer),
    category: String(row.category),
    status: row.status as ProcurementPurchaseOrderRecord["status"],
    totalAmount: Number(row.total_amount),
    committedEta: String(row.committed_eta),
    receivedPercent: Number(row.received_percent),
    invoiceMatchStatus: row.invoice_match_status as ProcurementPurchaseOrderRecord["invoiceMatchStatus"],
    logisticsMode: String(row.logistics_mode),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapProcurementPurchaseOrderRiskRow(row: Record<string, unknown>): ProcurementPurchaseOrderRiskRecord {
  return {
    id: String(row.id),
    purchaseOrderId: String(row.purchase_order_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as ProcurementPurchaseOrderRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapInventoryReceiptRow(row: Record<string, unknown>): InventoryReceiptRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    supplierName: String(row.supplier_name),
    destinationName: String(row.destination_name),
    destinationType: String(row.destination_type),
    purchaseReference: String(row.purchase_reference),
    etaDate: String(row.eta_date),
    receivedDate: row.received_date ? String(row.received_date) : null,
    status: row.status as InventoryReceiptRecord["status"],
    orderedUnits: Number(row.ordered_units),
    receivedUnits: Number(row.received_units),
    varianceUnits: Number(row.variance_units),
    variancePercent: Number(row.variance_percent),
    pendingEvidence: Number(row.pending_evidence),
    rejectedUnits: Number(row.rejected_units),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapInventoryReceiptRiskRow(row: Record<string, unknown>): InventoryReceiptRiskRecord {
  return {
    id: String(row.id),
    receiptId: String(row.receipt_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as InventoryReceiptRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapInventoryMovementRow(row: Record<string, unknown>): InventoryMovementRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    movementType: row.movement_type as InventoryMovementRecord["movementType"],
    skuName: String(row.sku_name),
    sourceName: String(row.source_name),
    destinationName: String(row.destination_name),
    requestedBy: String(row.requested_by),
    upstreamReceiptCode: row.upstream_receipt_code ? String(row.upstream_receipt_code) : null,
    purchaseReference: row.purchase_reference ? String(row.purchase_reference) : null,
    status: row.status as InventoryMovementRecord["status"],
    requestedUnits: Number(row.requested_units),
    movedUnits: Number(row.moved_units),
    varianceUnits: Number(row.variance_units),
    pendingEvidence: Number(row.pending_evidence),
    impactLevel: row.impact_level as InventoryMovementRecord["impactLevel"],
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapInventoryMovementRiskRow(row: Record<string, unknown>): InventoryMovementRiskRecord {
  return {
    id: String(row.id),
    movementId: String(row.movement_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as InventoryMovementRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapDailyLogEntryRow(row: Record<string, unknown>): DailyLogEntryRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    projectName: String(row.project_name),
    frontName: String(row.front_name),
    supervisor: String(row.supervisor),
    logDate: String(row.log_date),
    shift: row.shift as DailyLogEntryRecord["shift"],
    weather: row.weather as DailyLogEntryRecord["weather"],
    status: row.status as DailyLogEntryRecord["status"],
    progressPercent: Number(row.progress_percent),
    workforceCount: Number(row.workforce_count),
    incidentsCount: Number(row.incidents_count),
    blockersCount: Number(row.blockers_count),
    evidenceCount: Number(row.evidence_count),
    concretePourM3: Number(row.concrete_pour_m3),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapProjectScheduleActivityRow(row: Record<string, unknown>): ProjectScheduleActivityRecord {
  const predecessorIds = Array.isArray(row.predecessor_ids)
    ? row.predecessor_ids.map((value) => String(value))
    : JSON.parse(String(row.predecessor_ids ?? "[]")) as string[];

  return {
    id: String(row.id),
    companyId: String(row.company_id),
    projectId: String(row.project_id),
    code: String(row.code),
    name: String(row.name),
    phase: String(row.phase),
    status: row.status as ProjectScheduleActivityRecord["status"],
    plannedStart: String(row.planned_start).slice(0, 10),
    plannedFinish: String(row.planned_finish).slice(0, 10),
    actualStart: row.actual_start ? String(row.actual_start).slice(0, 10) : null,
    actualFinish: row.actual_finish ? String(row.actual_finish).slice(0, 10) : null,
    progressPercent: Number(row.progress_percent),
    predecessorIds,
    owner: String(row.owner_name),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapDailyLogRiskRow(row: Record<string, unknown>): DailyLogRiskRecord {
  return {
    id: String(row.id),
    logId: String(row.log_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as DailyLogRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapMachineItemRow(row: Record<string, unknown>): MachineItemRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    machineName: String(row.machine_name),
    machineType: String(row.machine_type),
    projectName: String(row.project_name),
    frontName: String(row.front_name),
    status: row.status as MachineItemRecord["status"],
    health: row.health as MachineItemRecord["health"],
    availabilityPercent: Number(row.availability_percent),
    utilizationPercent: Number(row.utilization_percent),
    hourMeter: Number(row.hour_meter),
    nextMaintenanceHours: Number(row.next_maintenance_hours),
    maintenanceDueDate: String(row.maintenance_due_date),
    maintenanceBacklog: Number(row.maintenance_backlog),
    openFailures: Number(row.open_failures),
    criticalOpenFailures: Number(row.critical_open_failures),
    lastServiceAt: String(row.last_service_at),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapMachineRiskRow(row: Record<string, unknown>): MachineRiskRecord {
  return {
    id: String(row.id),
    machineId: String(row.machine_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as MachineRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapFinanceLedgerItemRow(row: Record<string, unknown>): FinanceLedgerItemRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    metricName: String(row.metric_name),
    valueLabel: String(row.value_label),
    trendLabel: String(row.trend_label),
    note: String(row.note),
    cashImpact: Number(row.cash_impact),
    urgentItems: Number(row.urgent_items),
    closeReadiness: Number(row.close_readiness),
    satStatus: row.sat_status as FinanceLedgerItemRecord["satStatus"],
    updatedAt: String(row.updated_at)
  };
}

function mapDocumentControlItemRow(row: Record<string, unknown>): DocumentControlItemRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    documentType: String(row.document_type),
    subject: String(row.subject),
    projectName: String(row.project_name),
    owner: String(row.owner_name),
    status: row.status as DocumentControlItemRecord["status"],
    revisionCount: Number(row.revision_count),
    turnaroundDays: Number(row.turnaround_days),
    openComments: Number(row.open_comments),
    health: row.health as DocumentControlItemRecord["health"],
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapDocumentControlRiskRow(row: Record<string, unknown>): DocumentControlRiskRecord {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as DocumentControlRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapFinanceRiskRow(row: Record<string, unknown>): FinanceRiskRecord {
  return {
    id: String(row.id),
    ledgerId: String(row.ledger_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as FinanceRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapAccountsPayableInvoiceRow(row: Record<string, unknown>): AccountsPayableInvoiceRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    supplierProfileId: row.supplier_profile_id ? String(row.supplier_profile_id) : null,
    supplierName: String(row.supplier_name),
    code: String(row.code),
    invoiceNumber: String(row.invoice_number),
    invoiceUuid: String(row.invoice_uuid),
    projectName: String(row.project_name),
    purchaseOrderCode: row.purchase_order_code ? String(row.purchase_order_code) : null,
    receiptCode: row.receipt_code ? String(row.receipt_code) : null,
    status: row.status as AccountsPayableInvoiceRecord["status"],
    satStatus: row.sat_status as AccountsPayableInvoiceRecord["satStatus"],
    complementStatus: row.complement_status as AccountsPayableInvoiceRecord["complementStatus"],
    receiptEvidenceStatus: row.receipt_evidence_status as AccountsPayableInvoiceRecord["receiptEvidenceStatus"],
    paymentMethod: String(row.payment_method),
    dueDate: String(row.due_date),
    scheduledPaymentDate: row.scheduled_payment_date ? String(row.scheduled_payment_date) : null,
    receivedAt: String(row.received_at),
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    pendingAmount: Number(row.pending_amount),
    packetCompletion: Number(row.packet_completion),
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapAccountsPayableRiskRow(row: Record<string, unknown>): AccountsPayableRiskRecord {
  return {
    id: String(row.id),
    invoiceId: String(row.invoice_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as AccountsPayableRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapTreasuryPaymentRunRiskRow(row: Record<string, unknown>): TreasuryPaymentRunRiskRecord {
  return {
    id: String(row.id),
    paymentRunId: String(row.payment_run_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as TreasuryPaymentRunRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapTreasuryPaymentRunInvoiceRow(row: Record<string, unknown>): TreasuryPaymentRunInvoiceRecord {
  return {
    invoiceId: String(row.invoice_id),
    invoiceCode: String(row.code),
    supplierName: String(row.supplier_name),
    total: Number(row.total),
    scheduledPaymentDate: row.scheduled_payment_date ? String(row.scheduled_payment_date) : null,
    satStatus: row.sat_status as TreasuryPaymentRunInvoiceRecord["satStatus"],
    complementStatus: row.complement_status as TreasuryPaymentRunInvoiceRecord["complementStatus"],
    receiptEvidenceStatus: row.receipt_evidence_status as TreasuryPaymentRunInvoiceRecord["receiptEvidenceStatus"]
  };
}

function mapHrWorkforceRow(row: Record<string, unknown>): HrWorkforceItemRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    contractorName: String(row.contractor_name),
    frontName: String(row.front_name),
    activeHeadcount: Number(row.active_headcount),
    attendanceRate: Number(row.attendance_rate),
    productivityRate: Number(row.productivity_rate),
    complianceExpirations: Number(row.compliance_expirations),
    incidentCount: Number(row.incident_count),
    safetyStatus: row.safety_status as HrWorkforceItemRecord["safetyStatus"],
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapHrRiskRow(row: Record<string, unknown>): HrRiskRecord {
  return {
    id: String(row.id),
    workforceId: String(row.workforce_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as HrRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

function mapQualityInspectionRow(row: Record<string, unknown>): QualityInspectionRecord {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    code: String(row.code),
    areaName: String(row.area_name),
    checklistName: String(row.checklist_name),
    contractorName: String(row.contractor_name),
    severity: row.severity as QualityInspectionRecord["severity"],
    openFindings: Number(row.open_findings),
    evidenceCompletion: Number(row.evidence_completion),
    releaseReadiness: Number(row.release_readiness),
    reworkRate: Number(row.rework_rate),
    status: row.status as QualityInspectionRecord["status"],
    nextAction: String(row.next_action),
    updatedAt: String(row.updated_at)
  };
}

function mapQualityRiskRow(row: Record<string, unknown>): QualityRiskRecord {
  return {
    id: String(row.id),
    inspectionId: String(row.inspection_id),
    title: String(row.title),
    category: String(row.category),
    severity: row.severity as QualityRiskRecord["severity"],
    owner: String(row.owner_name),
    status: String(row.status)
  };
}

export async function seedCatalogs(client: PoolClient) {
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
    async listProjectScheduleActivities(companyId: string, projectId: string) {
      const result = await pool.query(
        `
          select
            id,
            company_id,
            project_id,
            code,
            name,
            phase,
            status,
            planned_start,
            planned_finish,
            actual_start,
            actual_finish,
            progress_percent,
            predecessor_ids,
            owner_name,
            next_action,
            updated_at
          from project_schedule_activities
          where company_id = $1 and project_id = $2
          order by planned_start, code
        `,
        [companyId, projectId]
      );

      return result.rows.map(mapProjectScheduleActivityRow);
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
      const result = await pool.query(
        `
          select
            e.id,
            e.company_id,
            e.project_name,
            e.front_name,
            e.supervisor,
            e.log_date,
            e.shift,
            e.weather,
            e.status,
            e.progress_percent,
            e.workforce_count,
            e.incidents_count,
            e.blockers_count,
            e.evidence_count,
            e.concrete_pour_m3,
            e.next_action,
            e.updated_at
          from daily_log_entries e
          where e.company_id = $1
          order by e.log_date desc, e.updated_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapDailyLogEntryRow);
    },
    async listDailyLogRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.log_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from daily_log_risks r
          inner join daily_log_entries e on e.id = r.log_id
          where e.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapDailyLogRiskRow);
    },
    async listFieldMaterialRequests(companyId: string) {
      const result = await pool.query(
        `
          select
            id,
            company_id,
            requisition_id,
            project_name,
            front_name,
            requested_by,
            summary,
            detail,
            requested_volume,
            urgency,
            next_action,
            status,
            created_at,
            updated_at
          from field_material_requests
          where company_id = $1
          order by created_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapFieldMaterialRequestRow);
    },
    async createFieldMaterialRequestAndRequisition(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");

        const countResult = await client.query(
          `select count(*)::int as total from procurement_requisitions where company_id = $1`,
          [input.companyId]
        );
        const requisitionCode = `REQ-FLD-${String(Number(countResult.rows[0]?.total ?? 0) + 1).padStart(3, "0")}`;
        const requisitionId = createPrefixedId("req");
        const fieldRequestId = createPrefixedId("fmr");

        const requisitionResult = await client.query(
          `
            insert into procurement_requisitions
              (id, company_id, code, project_name, front_name, requested_by, category, status, requested_items, budget_amount, urgency, approval_hours, supplier_coverage, next_action)
            values
              ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, $11, $12, $13)
            returning id, company_id, code, project_name, front_name, requested_by, category, status, requested_items, budget_amount, urgency, approval_hours, supplier_coverage, next_action, updated_at
          `,
          [
            requisitionId,
            input.companyId,
            requisitionCode,
            input.projectName,
            input.frontName,
            input.requestedBy,
            input.category,
            input.requestedItems,
            input.budgetAmount,
            input.urgency,
            input.approvalHours,
            input.supplierCoverage,
            `${input.nextAction} · ${input.requestedVolume}`
          ]
        );

        const fieldRequestResult = await client.query(
          `
            insert into field_material_requests
              (id, company_id, requisition_id, project_name, front_name, requested_by, summary, detail, requested_volume, urgency, next_action, status)
            values
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'converted')
            returning id, company_id, requisition_id, project_name, front_name, requested_by, summary, detail, requested_volume, urgency, next_action, status, created_at, updated_at
          `,
          [
            fieldRequestId,
            input.companyId,
            requisitionId,
            input.projectName,
            input.frontName,
            input.requestedBy,
            input.summary,
            input.detail,
            input.requestedVolume,
            input.urgency,
            input.nextAction
          ]
        );

        if (input.supplierCoverage === 0) {
          await client.query(
            `
              insert into procurement_requisition_risks
                (id, requisition_id, title, category, severity, owner_name, status)
              values
                ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              createPrefixedId("reqrisk"),
              requisitionId,
              "No supplier route confirmed from field intake",
              "Coverage",
              input.urgency === "critical" ? "critical" : "warning",
              "Procurement lead",
              "Supplier mapping pending before release"
            ]
          );
        }

        if (input.urgency === "critical") {
          await client.query(
            `
              insert into procurement_requisition_risks
                (id, requisition_id, title, category, severity, owner_name, status)
              values
                ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              createPrefixedId("reqrisk"),
              requisitionId,
              "Critical field request requires same-day procurement triage",
              "Urgency",
              "critical",
              "Procurement lead",
              "Escalate sourcing decision in current operating window"
            ]
          );
        }

        await client.query("commit");

        return {
          fieldRequest: mapFieldMaterialRequestRow(fieldRequestResult.rows[0]),
          requisition: mapProcurementRequisitionRow(requisitionResult.rows[0])
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async listProcurementPackages(companyId: string) {
      const result = await pool.query(
        `
          select
            id,
            company_id,
            code,
            package_name,
            project_name,
            buyer,
            status,
            budget_amount,
            bid_count,
            approval_hours,
            strategic,
            supplier_contention,
            next_action,
            updated_at
          from procurement_packages
          where company_id = $1
          order by updated_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapProcurementPackageRow);
    },
    async listProcurementRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.package_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from procurement_package_risks r
          inner join procurement_packages p on p.id = r.package_id
          where p.company_id = $1
          order by r.created_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapProcurementRiskRow);
    },
    async listSupplierControlLines(companyId: string) {
      const result = await pool.query(
        `
          select
            id,
            supplier_id,
            company_id,
            supplier_name,
            owner_name,
            awarded_packages,
            active_packages,
            contracted_amount,
            concentration_percent,
            bid_coverage,
            delivery_health,
            approval_pressure_hours,
            compliance_alerts,
            next_action,
            updated_at
          from supplier_control_lines
          where company_id = $1
          order by updated_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapSupplierControlLineRow);
    },
    async listSupplierMasterProfiles(companyId: string) {
      const result = await pool.query(
        `
          select
            id,
            supplier_id,
            company_id,
            supplier_name,
            trade_name,
            rfc,
            fiscal_regime,
            cfdi_use,
            payment_method,
            payment_terms_days,
            bank_account_masked,
            contact_name,
            contact_email,
            contact_phone,
            compliance_status,
            sat_status,
            fiscal_packet_completion,
            last_validated_at,
            next_action,
            updated_at
          from supplier_master_profiles
          where company_id = $1
          order by updated_at desc, supplier_name
        `,
        [companyId]
      );

      return result.rows.map(mapSupplierMasterProfileRow);
    },
    async listSupplierMasterRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.supplier_profile_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from supplier_master_risks r
          inner join supplier_master_profiles p on p.id = r.supplier_profile_id
          where p.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapSupplierMasterRiskRow);
    },
    async listProcurementRequisitions(companyId: string) {
      const result = await pool.query(
        `
          select
            id,
            company_id,
            code,
            project_name,
            front_name,
            requested_by,
            category,
            status,
            requested_items,
            budget_amount,
            urgency,
            approval_hours,
            supplier_coverage,
            next_action,
            updated_at
          from procurement_requisitions
          where company_id = $1
          order by updated_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapProcurementRequisitionRow);
    },
    async listProcurementRequisitionRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.requisition_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from procurement_requisition_risks r
          inner join procurement_requisitions pr on pr.id = r.requisition_id
          where pr.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapProcurementRequisitionRiskRow);
    },
    async createProcurementRequisition(input) {
      const countResult = await pool.query(
        `select count(*)::int as total from procurement_requisitions where company_id = $1`,
        [input.companyId]
      );
      const code = `REQ-MNL-${String(Number(countResult.rows[0]?.total ?? 0) + 1).padStart(3, "0")}`;
      const result = await pool.query(
        `
          insert into procurement_requisitions
            (id, company_id, code, project_name, front_name, requested_by, category, status, requested_items, budget_amount, urgency, approval_hours, supplier_coverage, next_action)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          returning id, company_id, code, project_name, front_name, requested_by, category, status, requested_items, budget_amount, urgency, approval_hours, supplier_coverage, next_action, updated_at
        `,
        [
          createPrefixedId("req"),
          input.companyId,
          code,
          input.projectName,
          input.frontName,
          input.requestedBy,
          input.category,
          input.status,
          input.requestedItems,
          input.budgetAmount,
          input.urgency,
          input.approvalHours,
          input.supplierCoverage,
          input.nextAction
        ]
      );

      return mapProcurementRequisitionRow(result.rows[0]);
    },
    async createSupplierControlLine(input) {
      const supplierId = `sup_${input.supplierName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      const result = await pool.query(
        `
          insert into supplier_control_lines
            (id, supplier_id, company_id, supplier_name, owner_name, awarded_packages, active_packages, contracted_amount, concentration_percent, bid_coverage, delivery_health, approval_pressure_hours, compliance_alerts, next_action)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          returning id, supplier_id, company_id, supplier_name, owner_name, awarded_packages, active_packages, contracted_amount, concentration_percent, bid_coverage, delivery_health, approval_pressure_hours, compliance_alerts, next_action, updated_at
        `,
        [
          createPrefixedId("scl"),
          supplierId,
          input.companyId,
          input.supplierName,
          input.owner,
          input.awardedPackages,
          input.activePackages,
          input.contractedAmount,
          input.concentrationPercent,
          input.bidCoverage,
          input.deliveryHealth,
          input.approvalPressureHours,
          input.complianceAlerts,
          input.nextAction
        ]
      );

      return mapSupplierControlLineRow(result.rows[0]);
    },
    async createSupplierMasterProfile(input) {
      const supplierId = `sup_${input.supplierName.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      const result = await pool.query(
        `
          insert into supplier_master_profiles
            (id, supplier_id, company_id, supplier_name, trade_name, rfc, fiscal_regime, cfdi_use, payment_method, payment_terms_days, bank_account_masked, contact_name, contact_email, contact_phone, compliance_status, sat_status, fiscal_packet_completion, last_validated_at, next_action)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now(), $18)
          returning id, supplier_id, company_id, supplier_name, trade_name, rfc, fiscal_regime, cfdi_use, payment_method, payment_terms_days, bank_account_masked, contact_name, contact_email, contact_phone, compliance_status, sat_status, fiscal_packet_completion, last_validated_at, next_action, updated_at
        `,
        [
          createPrefixedId("supm"),
          supplierId,
          input.companyId,
          input.supplierName,
          input.tradeName,
          input.rfc,
          input.fiscalRegime,
          input.cfdiUse,
          input.paymentMethod,
          input.paymentTermsDays,
          input.bankAccountMasked,
          input.contactName,
          input.contactEmail,
          input.contactPhone,
          input.complianceStatus,
          input.satStatus,
          input.fiscalPacketCompletion,
          input.nextAction
        ]
      );

      return mapSupplierMasterProfileRow(result.rows[0]);
    },
    async createAccountsPayableInvoice(input) {
      const countResult = await pool.query(
        `select count(*)::int as total from accounts_payable_invoices where company_id = $1`,
        [input.companyId]
      );
      const code = `AP-${String(Number(countResult.rows[0]?.total ?? 0) + 1).padStart(4, "0")}`;
      const result = await pool.query(
        `
          insert into accounts_payable_invoices
            (id, company_id, supplier_profile_id, supplier_name, code, invoice_number, invoice_uuid, project_name, purchase_order_code, receipt_code, status, sat_status, complement_status, receipt_evidence_status, payment_method, due_date, scheduled_payment_date, received_at, subtotal, tax, total, pending_amount, packet_completion, next_action)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now(), $18, $19, $20, $21, $22, $23)
          returning id, company_id, supplier_profile_id, supplier_name, code, invoice_number, invoice_uuid, project_name, purchase_order_code, receipt_code, status, sat_status, complement_status, receipt_evidence_status, payment_method, due_date, scheduled_payment_date, received_at, subtotal, tax, total, pending_amount, packet_completion, next_action, updated_at
        `,
        [
          createPrefixedId("apin"),
          input.companyId,
          input.supplierProfileId ?? null,
          input.supplierName,
          code,
          input.invoiceNumber,
          input.invoiceUuid,
          input.projectName,
          input.purchaseOrderCode ?? null,
          input.receiptCode ?? null,
          input.status,
          input.satStatus,
          input.complementStatus,
          input.receiptEvidenceStatus,
          input.paymentMethod,
          input.dueDate,
          input.scheduledPaymentDate ?? null,
          input.subtotal,
          input.tax,
          input.total,
          input.status === "paid" ? 0 : input.total,
          input.packetCompletion,
          input.nextAction
        ]
      );

      return mapAccountsPayableInvoiceRow(result.rows[0]);
    },
    async createTreasuryPaymentRun(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        const countResult = await client.query(
          `select count(*)::int as total from treasury_payment_runs where company_id = $1`,
          [input.companyId]
        );
        const code = `TPR-${String(Number(countResult.rows[0]?.total ?? 0) + 1).padStart(4, "0")}`;
        const runResult = await client.query(
          `
            insert into treasury_payment_runs
              (id, company_id, code, bank_account_label, scheduled_date, status, owner_name, next_action)
            values
              ($1, $2, $3, $4, $5, 'draft', $6, $7)
            returning id, company_id, code, bank_account_label, scheduled_date, status, owner_name, next_action, updated_at
          `,
          [createPrefixedId("tpr"), input.companyId, code, input.bankAccountLabel, input.scheduledDate, input.owner, input.nextAction]
        );

        const run = runResult.rows[0];
        for (const invoiceId of input.invoiceIds) {
          await client.query(
            `
              insert into treasury_payment_run_invoices (payment_run_id, invoice_id)
              values ($1, $2)
            `,
            [String(run.id), invoiceId]
          );
        }

        await client.query("commit");
        const created = (await this.listTreasuryPaymentRuns(input.companyId)).find((candidate) => candidate.id === String(run.id));
        if (!created) {
          throw new Error("Treasury payment run not found after creation");
        }
        return created;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async listProcurementPurchaseOrders(companyId: string) {
      const result = await pool.query(
        `
          select
            po.id,
            po.company_id,
            po.code,
            po.requisition_code,
            po.project_name,
            po.supplier_name,
            po.buyer,
            po.category,
            po.status,
            po.total_amount,
            po.committed_eta,
            po.received_percent,
            po.invoice_match_status,
            po.logistics_mode,
            po.next_action,
            po.updated_at
          from procurement_purchase_orders po
          where po.company_id = $1
          order by po.updated_at desc, po.code
        `,
        [companyId]
      );

      return result.rows.map(mapProcurementPurchaseOrderRow);
    },
    async listProcurementPurchaseOrderRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.purchase_order_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from procurement_purchase_order_risks r
          inner join procurement_purchase_orders po on po.id = r.purchase_order_id
          where po.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapProcurementPurchaseOrderRiskRow);
    },
    async createProcurementPurchaseOrder(input) {
      const countResult = await pool.query(
        `select count(*)::int as total from procurement_purchase_orders where company_id = $1`,
        [input.companyId]
      );
      const code = `PO-MNL-${String(Number(countResult.rows[0]?.total ?? 0) + 1).padStart(2, "0")}`;
      const result = await pool.query(
        `
          insert into procurement_purchase_orders
            (id, company_id, code, requisition_code, project_name, supplier_name, buyer, category, status, total_amount, committed_eta, received_percent, invoice_match_status, logistics_mode, next_action)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, 'issued', $9, $10, 0, 'pending', $11, $12)
          returning id, company_id, code, requisition_code, project_name, supplier_name, buyer, category, status, total_amount, committed_eta, received_percent, invoice_match_status, logistics_mode, next_action, updated_at
        `,
        [
          createPrefixedId("po"),
          input.companyId,
          code,
          input.requisitionCode,
          input.projectName,
          input.supplierName,
          input.buyer,
          input.category,
          input.totalAmount,
          input.committedEta,
          input.logisticsMode,
          input.nextAction
        ]
      );

      return mapProcurementPurchaseOrderRow(result.rows[0]);
    },
    async syncProcurementPurchaseOrderReceipt(input) {
      const result = await pool.query(
        `
          update procurement_purchase_orders
          set received_percent = $2,
              status = coalesce($3, status),
              next_action = coalesce($4, next_action),
              updated_at = now()
          where id = $1
          returning id, company_id, code, requisition_code, project_name, supplier_name, buyer, category, status, total_amount, committed_eta, received_percent, invoice_match_status, logistics_mode, next_action, updated_at
        `,
        [input.purchaseOrderId, input.receivedPercent, input.status ?? null, input.nextAction ?? null]
      );

      if (!result.rows[0]) {
        throw new Error("Procurement purchase order not found in repository");
      }

      return mapProcurementPurchaseOrderRow(result.rows[0]);
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
    async listInventoryReceipts(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.company_id,
            r.code,
            r.supplier_name,
            r.destination_name,
            r.destination_type,
            r.purchase_reference,
            r.eta_date,
            r.received_date,
            r.status,
            r.ordered_units,
            r.received_units,
            r.variance_units,
            r.variance_percent,
            r.pending_evidence,
            r.rejected_units,
            r.next_action,
            r.updated_at
          from inventory_receipts r
          where r.company_id = $1
          order by r.updated_at desc, r.code
        `,
        [companyId]
      );

      return result.rows.map(mapInventoryReceiptRow);
    },
    async listInventoryReceiptRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.receipt_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from inventory_receipt_risks r
          inner join inventory_receipts ir on ir.id = r.receipt_id
          where ir.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapInventoryReceiptRiskRow);
    },
    async createInventoryReceipt(input) {
      const countResult = await pool.query(
        `select count(*)::int as total from inventory_receipts where company_id = $1`,
        [input.companyId]
      );
      const code = `RCV-MNL-${String(Number(countResult.rows[0]?.total ?? 0) + 1).padStart(2, "0")}`;
      const varianceUnits = Number((input.receivedUnits - input.orderedUnits).toFixed(2));
      const variancePercent = input.orderedUnits > 0 ? Number(((varianceUnits / input.orderedUnits) * 100).toFixed(2)) : 0;
      const result = await pool.query(
        `
          insert into inventory_receipts
            (id, company_id, code, supplier_name, destination_name, destination_type, purchase_reference, eta_date, status, ordered_units, received_units, variance_units, variance_percent, pending_evidence, rejected_units, next_action)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9, $10, $11, $12, $13, $14, $15)
          returning id, company_id, code, supplier_name, destination_name, destination_type, purchase_reference, eta_date, received_date, status, ordered_units, received_units, variance_units, variance_percent, pending_evidence, rejected_units, next_action, updated_at
        `,
        [
          createPrefixedId("receipt"),
          input.companyId,
          code,
          input.supplierName,
          input.destinationName,
          input.destinationType,
          input.purchaseReference,
          input.etaDate,
          input.orderedUnits,
          input.receivedUnits,
          varianceUnits,
          variancePercent,
          input.pendingEvidence,
          input.rejectedUnits,
          input.nextAction
        ]
      );

      return mapInventoryReceiptRow(result.rows[0]);
    },
    async listInventoryMovements(companyId: string) {
      const result = await pool.query(
        `
          select
            m.id,
            m.company_id,
            m.code,
            m.movement_type,
            m.sku_name,
            m.source_name,
            m.destination_name,
            m.requested_by,
            m.upstream_receipt_code,
            m.purchase_reference,
            m.status,
            m.requested_units,
            m.moved_units,
            m.variance_units,
            m.pending_evidence,
            m.impact_level,
            m.next_action,
            m.updated_at
          from inventory_movements m
          where m.company_id = $1
          order by m.updated_at desc, m.code
        `,
        [companyId]
      );

      return result.rows.map(mapInventoryMovementRow);
    },
    async listInventoryMovementRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.movement_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from inventory_movement_risks r
          inner join inventory_movements im on im.id = r.movement_id
          where im.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapInventoryMovementRiskRow);
    },
    async createInventoryMovement(input) {
      const countResult = await pool.query(
        `select count(*)::int as total from inventory_movements where company_id = $1`,
        [input.companyId]
      );
      const code = `MOV-MNL-${String(Number(countResult.rows[0]?.total ?? 0) + 1).padStart(2, "0")}`;
      const varianceUnits = Number((input.movedUnits - input.requestedUnits).toFixed(2));
      const result = await pool.query(
        `
          insert into inventory_movements
            (id, company_id, code, movement_type, sku_name, source_name, destination_name, requested_by, upstream_receipt_code, purchase_reference, status, requested_units, moved_units, variance_units, pending_evidence, impact_level, next_action)
          values
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11, $12, $13, $14, $15, $16)
          returning id, company_id, code, movement_type, sku_name, source_name, destination_name, requested_by, upstream_receipt_code, purchase_reference, status, requested_units, moved_units, variance_units, pending_evidence, impact_level, next_action, updated_at
        `,
        [
          createPrefixedId("move"),
          input.companyId,
          code,
          input.movementType,
          input.skuName,
          input.sourceName,
          input.destinationName,
          input.requestedBy,
          input.upstreamReceiptCode,
          input.purchaseReference,
          input.requestedUnits,
          input.movedUnits,
          varianceUnits,
          input.pendingEvidence,
          input.impactLevel,
          input.nextAction
        ]
      );

      return mapInventoryMovementRow(result.rows[0]);
    },
    async listMachines(companyId: string) {
      const result = await pool.query(
        `
          select
            m.id,
            m.company_id,
            m.code,
            m.machine_name,
            m.machine_type,
            m.project_name,
            m.front_name,
            m.status,
            m.health,
            m.availability_percent,
            m.utilization_percent,
            m.hour_meter,
            m.next_maintenance_hours,
            m.maintenance_due_date,
            m.maintenance_backlog,
            m.open_failures,
            m.critical_open_failures,
            m.last_service_at,
            m.next_action,
            m.updated_at
          from machine_items m
          where m.company_id = $1
          order by m.updated_at desc, m.code
        `,
        [companyId]
      );

      return result.rows.map(mapMachineItemRow);
    },
    async listMachineRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.machine_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from machine_risks r
          inner join machine_items m on m.id = r.machine_id
          where m.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapMachineRiskRow);
    },
    async listFinanceItems(companyId: string) {
      const result = await pool.query(
        `
          select
            id,
            company_id,
            code,
            metric_name,
            value_label,
            trend_label,
            note,
            cash_impact,
            urgent_items,
            close_readiness,
            sat_status,
            updated_at
          from finance_ledger_items
          where company_id = $1
          order by updated_at desc, code
        `,
        [companyId]
      );

      return result.rows.map(mapFinanceLedgerItemRow);
    },
    async listFinanceRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.ledger_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from finance_risks r
          inner join finance_ledger_items i on i.id = r.ledger_id
          where i.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapFinanceRiskRow);
    },
    async listAccountsPayableInvoices(companyId: string) {
      const result = await pool.query(
        `
          select
            id,
            company_id,
            supplier_profile_id,
            supplier_name,
            code,
            invoice_number,
            invoice_uuid,
            project_name,
            purchase_order_code,
            receipt_code,
            status,
            sat_status,
            complement_status,
            receipt_evidence_status,
            payment_method,
            due_date,
            scheduled_payment_date,
            received_at,
            subtotal,
            tax,
            total,
            pending_amount,
            packet_completion,
            next_action,
            updated_at
          from accounts_payable_invoices
          where company_id = $1
          order by updated_at desc, due_date asc
        `,
        [companyId]
      );

      return result.rows.map(mapAccountsPayableInvoiceRow);
    },
    async listAccountsPayableRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.invoice_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from accounts_payable_risks r
          inner join accounts_payable_invoices i on i.id = r.invoice_id
          where i.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapAccountsPayableRiskRow);
    },
    async listTreasuryPaymentRuns(companyId: string) {
      const runsResult = await pool.query(
        `
          select
            id,
            company_id,
            code,
            bank_account_label,
            scheduled_date,
            status,
            owner_name,
            next_action,
            updated_at
          from treasury_payment_runs
          where company_id = $1
          order by scheduled_date desc, updated_at desc
        `,
        [companyId]
      );

      const runIds = runsResult.rows.map((row) => String(row.id));
      const invoicesByRun = new Map<string, TreasuryPaymentRunInvoiceRecord[]>();

      if (runIds.length > 0) {
        const invoiceResult = await pool.query(
          `
            select
              tri.payment_run_id,
              i.id as invoice_id,
              i.code,
              i.supplier_name,
              i.total,
              i.pending_amount,
              i.scheduled_payment_date,
              i.sat_status,
              i.complement_status,
              i.receipt_evidence_status
            from treasury_payment_run_invoices tri
            inner join accounts_payable_invoices i on i.id = tri.invoice_id
            where tri.payment_run_id = any($1::text[])
            order by tri.created_at desc
          `,
          [runIds]
        );

        for (const row of invoiceResult.rows) {
          const paymentRunId = String(row.payment_run_id);
          const entry = invoicesByRun.get(paymentRunId) ?? [];
          entry.push(mapTreasuryPaymentRunInvoiceRow(row));
          invoicesByRun.set(paymentRunId, entry);
        }
      }

      return runsResult.rows.map((row) => {
        const invoices = invoicesByRun.get(String(row.id)) ?? [];
        return {
          id: String(row.id),
          companyId: String(row.company_id),
          code: String(row.code),
          bankAccountLabel: String(row.bank_account_label),
          scheduledDate: String(row.scheduled_date),
          status: row.status as TreasuryPaymentRunRecord["status"],
          totalInvoices: invoices.length,
          totalAmount: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
          criticalInvoices: invoices.filter((invoice) => invoice.satStatus === "critical" || invoice.complementStatus === "risk").length,
          owner: String(row.owner_name),
          nextAction: String(row.next_action),
          updatedAt: String(row.updated_at),
          invoices
        };
      });
    },
    async listTreasuryPaymentRunRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.payment_run_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from treasury_payment_run_risks r
          inner join treasury_payment_runs pr on pr.id = r.payment_run_id
          where pr.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapTreasuryPaymentRunRiskRow);
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
      const result = await pool.query(
        `
          select
            w.id,
            w.company_id,
            w.code,
            w.contractor_name,
            w.front_name,
            w.active_headcount,
            w.attendance_rate,
            w.productivity_rate,
            w.compliance_expirations,
            w.incident_count,
            w.safety_status,
            w.next_action,
            w.updated_at
          from hr_workforce_items w
          where w.company_id = $1
          order by w.updated_at desc, w.code
        `,
        [companyId]
      );

      return result.rows.map(mapHrWorkforceRow);
    },
    async listHrRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.workforce_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from hr_workforce_risks r
          inner join hr_workforce_items w on w.id = r.workforce_id
          where w.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapHrRiskRow);
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
      const result = await pool.query(
        `
          select
            d.id,
            d.company_id,
            d.code,
            d.document_type,
            d.subject,
            d.project_name,
            d.owner_name,
            d.status,
            d.revision_count,
            d.turnaround_days,
            d.open_comments,
            d.health,
            d.next_action,
            d.updated_at
          from document_control_items d
          where d.company_id = $1
          order by d.updated_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapDocumentControlItemRow);
    },
    async listDocumentControlRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.item_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from document_control_risks r
          inner join document_control_items d on d.id = r.item_id
          where d.company_id = $1
          order by r.created_at desc
        `,
        [companyId]
      );

      return result.rows.map(mapDocumentControlRiskRow);
    },
    async listQualityInspections(companyId: string) {
      const result = await pool.query(
        `
          select
            q.id,
            q.company_id,
            q.code,
            q.area_name,
            q.checklist_name,
            q.contractor_name,
            q.severity,
            q.open_findings,
            q.evidence_completion,
            q.release_readiness,
            q.rework_rate,
            q.status,
            q.next_action,
            q.updated_at
          from quality_inspections q
          where q.company_id = $1
          order by q.updated_at desc, q.code
        `,
        [companyId]
      );

      return result.rows.map(mapQualityInspectionRow);
    },
    async listQualityRisks(companyId: string) {
      const result = await pool.query(
        `
          select
            r.id,
            r.inspection_id,
            r.title,
            r.category,
            r.severity,
            r.owner_name,
            r.status
          from quality_risks r
          inner join quality_inspections q on q.id = r.inspection_id
          where q.company_id = $1
          order by r.severity desc, r.title
        `,
        [companyId]
      );

      return result.rows.map(mapQualityRiskRow);
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
      const result = await pool.query(
        `
          update project_portfolio
          set status = $2,
              next_milestone = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, external_key, name, client_name, segment, status, stage, progress_percent, schedule_variance_days, budget_health, quality_holds, permit_blockers, active_fronts, updated_at, next_milestone
        `,
        [input.projectId, input.status, input.nextMilestone]
      );

      if (!result.rows[0]) {
        throw new Error("Project portfolio item not found in repository");
      }

      const row = result.rows[0];
      return {
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
      };
    },
    async createProjectPortfolioItem(input) {
      const projectId = createPrefixedId("prj");
      const result = await pool.query(
        `
          insert into project_portfolio (
            id,
            company_id,
            external_key,
            name,
            client_name,
            segment,
            status,
            stage,
            progress_percent,
            schedule_variance_days,
            budget_health,
            quality_holds,
            permit_blockers,
            active_fronts,
            next_milestone
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          returning id, company_id, external_key, name, client_name, segment, status, stage, progress_percent, schedule_variance_days, budget_health, quality_holds, permit_blockers, active_fronts, updated_at, next_milestone
        `,
        [
          projectId,
          input.companyId,
          input.code,
          input.name,
          input.client,
          input.segment,
          input.status,
          input.stage,
          input.progress,
          input.scheduleVarianceDays,
          input.budgetHealth,
          input.qualityHolds,
          input.permitBlockers,
          input.activeFronts,
          input.nextMilestone
        ]
      );

      if (!result.rows[0]) {
        throw new Error("Project portfolio item could not be created");
      }

      const row = result.rows[0];
      return {
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
      };
    },
    async createProjectScheduleActivity(input) {
      const result = await pool.query(
        `
          insert into project_schedule_activities (
            id,
            company_id,
            project_id,
            code,
            name,
            phase,
            status,
            planned_start,
            planned_finish,
            actual_start,
            actual_finish,
            progress_percent,
            predecessor_ids,
            owner_name,
            next_action
          )
          values ($1, $2, $3, $4, $5, $6, 'not_started', $7, $8, null, null, 0, $9::jsonb, $10, $11)
          returning id, company_id, project_id, code, name, phase, status, planned_start, planned_finish, actual_start, actual_finish, progress_percent, predecessor_ids, owner_name, next_action, updated_at
        `,
        [
          createPrefixedId("sch"),
          input.companyId,
          input.projectId,
          input.code,
          input.name,
          input.phase,
          input.plannedStart,
          input.plannedFinish,
          JSON.stringify(input.predecessorIds),
          input.owner,
          input.nextAction
        ]
      );

      if (!result.rows[0]) {
        throw new Error("Project schedule activity could not be created");
      }

      return mapProjectScheduleActivityRow(result.rows[0]);
    },
    async updateProjectScheduleActivity(input) {
      const result = await pool.query(
        `
          update project_schedule_activities
          set status = $4,
              progress_percent = $5,
              planned_start = $6,
              planned_finish = $7,
              actual_start = $8,
              actual_finish = $9,
              predecessor_ids = $10::jsonb,
              owner_name = $11,
              next_action = $12,
              updated_at = now()
          where id = $1 and company_id = $2 and project_id = $3
          returning id, company_id, project_id, code, name, phase, status, planned_start, planned_finish, actual_start, actual_finish, progress_percent, predecessor_ids, owner_name, next_action, updated_at
        `,
        [
          input.activityId,
          input.companyId,
          input.projectId,
          input.status,
          input.progressPercent,
          input.plannedStart,
          input.plannedFinish,
          input.actualStart,
          input.actualFinish,
          JSON.stringify(input.predecessorIds),
          input.owner,
          input.nextAction
        ]
      );

      if (!result.rows[0]) {
        throw new Error("Project schedule activity was not found for this company and project");
      }

      return mapProjectScheduleActivityRow(result.rows[0]);
    },
    async updateDailyLogEntry(input) {
      const result = await pool.query(
        `
          update daily_log_entries
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, project_name, front_name, supervisor, log_date, shift, weather, status, progress_percent, workforce_count, incidents_count, blockers_count, evidence_count, concrete_pour_m3, next_action, updated_at
        `,
        [input.entryId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Daily log entry not found in repository");
      }

      return mapDailyLogEntryRow(result.rows[0]);
    },
    async createDailyLogEntry(input) {
      const result = await pool.query(
        `
          insert into daily_log_entries (
            id,
            company_id,
            project_name,
            front_name,
            supervisor,
            log_date,
            shift,
            weather,
            status,
            progress_percent,
            workforce_count,
            incidents_count,
            blockers_count,
            evidence_count,
            concrete_pour_m3,
            next_action
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15
          )
          returning id, company_id, project_name, front_name, supervisor, log_date, shift, weather, status, progress_percent, workforce_count, incidents_count, blockers_count, evidence_count, concrete_pour_m3, next_action, updated_at
        `,
        [
          input.companyId,
          input.projectName,
          input.frontName,
          input.supervisor,
          input.logDate,
          input.shift,
          input.weather,
          input.status,
          input.progressPercent,
          input.workforceCount,
          input.incidentsCount,
          input.blockersCount,
          input.evidenceCount,
          input.concretePourM3,
          input.nextAction
        ]
      );

      return mapDailyLogEntryRow(result.rows[0]);
    },
    async updateProcurementRequisition(input) {
      const result = await pool.query(
        `
          update procurement_requisitions
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, project_name, front_name, requested_by, category, status, requested_items, budget_amount, urgency, approval_hours, supplier_coverage, next_action, updated_at
        `,
        [input.requisitionId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Procurement requisition not found in repository");
      }

      return mapProcurementRequisitionRow(result.rows[0]);
    },
    async updateProcurementPurchaseOrder(input) {
      const result = await pool.query(
        `
          update procurement_purchase_orders
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, requisition_code, project_name, supplier_name, buyer, category, status, total_amount, committed_eta, received_percent, invoice_match_status, logistics_mode, next_action, updated_at
        `,
        [input.purchaseOrderId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Procurement purchase order not found in repository");
      }

      return mapProcurementPurchaseOrderRow(result.rows[0]);
    },
    async updateCrmLeadBucket(input) {
      void input;
      throw new Error("CRM lead bucket updates are not implemented for the postgres repository yet");
    },
    async updateFinanceLedgerItem(input) {
      const result = await pool.query(
        `
          update finance_ledger_items
          set sat_status = $2,
              note = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, metric_name, value_label, trend_label, note, cash_impact, urgent_items, close_readiness, sat_status, updated_at
        `,
        [input.ledgerId, input.satStatus, input.note]
      );

      if (!result.rows[0]) {
        throw new Error("Finance ledger item not found in repository");
      }

      return mapFinanceLedgerItemRow(result.rows[0]);
    },
    async updateAccountsPayableInvoice(input) {
      const result = await pool.query(
        `
          update accounts_payable_invoices
          set status = $2,
              sat_status = $3,
              complement_status = $4,
              scheduled_payment_date = $5,
              pending_amount = case when $2 = 'paid' then 0 else total end,
              next_action = $6,
              updated_at = now()
          where id = $1
          returning id, company_id, supplier_profile_id, supplier_name, code, invoice_number, invoice_uuid, project_name, purchase_order_code, receipt_code, status, sat_status, complement_status, receipt_evidence_status, payment_method, due_date, scheduled_payment_date, received_at, subtotal, tax, total, pending_amount, packet_completion, next_action, updated_at
        `,
        [
          input.invoiceId,
          input.status,
          input.satStatus,
          input.complementStatus,
          input.scheduledPaymentDate,
          input.nextAction
        ]
      );

      if (!result.rows[0]) {
        throw new Error("Accounts payable invoice not found in repository");
      }

      return mapAccountsPayableInvoiceRow(result.rows[0]);
    },
    async updateTreasuryPaymentRun(input) {
      const result = await pool.query(
        `
          update treasury_payment_runs
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, bank_account_label, scheduled_date, status, owner_name, next_action, updated_at
        `,
        [input.paymentRunId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Treasury payment run not found in repository");
      }

      const companyId = String(result.rows[0].company_id);
      const runId = String(result.rows[0].id);
      const run = (await this.listTreasuryPaymentRuns(companyId)).find((candidate) => candidate.id === runId);
      if (!run) {
        throw new Error("Treasury payment run not found after update");
      }
      return run;
    },
    async removeTreasuryPaymentRunInvoice(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        const deleteResult = await client.query(
          `
            delete from treasury_payment_run_invoices
            where payment_run_id = $1 and invoice_id = $2
          `,
          [input.paymentRunId, input.invoiceId]
        );

        if (deleteResult.rowCount === 0) {
          throw new Error("Treasury payment run invoice not found in repository");
        }

        const runResult = await client.query(
          `
            update treasury_payment_runs
            set status = 'draft',
                next_action = $2,
                updated_at = now()
            where id = $1 and company_id = $3
            returning id, company_id
          `,
          [input.paymentRunId, input.nextAction, input.companyId]
        );

        if (!runResult.rows[0]) {
          throw new Error("Treasury payment run not found in repository");
        }

        await client.query("commit");
        const run = (await this.listTreasuryPaymentRuns(input.companyId)).find((candidate) => candidate.id === input.paymentRunId);
        if (!run) {
          throw new Error("Treasury payment run not found after invoice removal");
        }
        return run;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async addTreasuryPaymentRunInvoice(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        await client.query(
          `
            insert into treasury_payment_run_invoices (payment_run_id, invoice_id)
            values ($1, $2)
          `,
          [input.paymentRunId, input.invoiceId]
        );

        const runResult = await client.query(
          `
            update treasury_payment_runs
            set status = 'draft',
                next_action = $2,
                updated_at = now()
            where id = $1 and company_id = $3
            returning id, company_id
          `,
          [input.paymentRunId, input.nextAction, input.companyId]
        );

        if (!runResult.rows[0]) {
          throw new Error("Treasury payment run not found in repository");
        }

        await client.query("commit");
        const run = (await this.listTreasuryPaymentRuns(input.companyId)).find((candidate) => candidate.id === input.paymentRunId);
        if (!run) {
          throw new Error("Treasury payment run not found after invoice add");
        }
        return run;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async moveTreasuryPaymentRunInvoice(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        const deleteResult = await client.query(
          `
            delete from treasury_payment_run_invoices
            where payment_run_id = $1 and invoice_id = $2
          `,
          [input.sourcePaymentRunId, input.invoiceId]
        );

        if (deleteResult.rowCount === 0) {
          throw new Error("Treasury payment run invoice not found in repository");
        }

        await client.query(
          `
            insert into treasury_payment_run_invoices (payment_run_id, invoice_id)
            values ($1, $2)
          `,
          [input.targetPaymentRunId, input.invoiceId]
        );

        const sourceResult = await client.query(
          `
            update treasury_payment_runs
            set status = 'draft',
                next_action = $2,
                updated_at = now()
            where id = $1 and company_id = $3
            returning id
          `,
          [input.sourcePaymentRunId, input.nextAction, input.companyId]
        );

        const targetResult = await client.query(
          `
            update treasury_payment_runs
            set status = 'draft',
                next_action = $2,
                updated_at = now()
            where id = $1 and company_id = $3
            returning id
          `,
          [input.targetPaymentRunId, input.nextAction, input.companyId]
        );

        if (!sourceResult.rows[0] || !targetResult.rows[0]) {
          throw new Error("Treasury payment run not found in repository");
        }

        await client.query("commit");
        const run = (await this.listTreasuryPaymentRuns(input.companyId)).find((candidate) => candidate.id === input.targetPaymentRunId);
        if (!run) {
          throw new Error("Treasury payment run not found after invoice move");
        }
        return run;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateHrWorkforceItem(input) {
      const result = await pool.query(
        `
          update hr_workforce_items
          set safety_status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, contractor_name, front_name, active_headcount, attendance_rate, productivity_rate, compliance_expirations, incident_count, safety_status, next_action, updated_at
        `,
        [input.workforceId, input.safetyStatus, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("HR workforce item not found in repository");
      }

      return mapHrWorkforceRow(result.rows[0]);
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
    async updateInventoryReceipt(input) {
      const result = await pool.query(
        `
          update inventory_receipts
          set status = $2,
              next_action = $3,
              received_date = case when $2 = 'received' then coalesce(received_date, now()) else received_date end,
              updated_at = now()
          where id = $1
          returning id, company_id, code, supplier_name, destination_name, destination_type, purchase_reference, eta_date, received_date, status, ordered_units, received_units, variance_units, variance_percent, pending_evidence, rejected_units, next_action, updated_at
        `,
        [input.receiptId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Inventory receipt not found in repository");
      }

      return mapInventoryReceiptRow(result.rows[0]);
    },
    async updateInventoryMovement(input) {
      const result = await pool.query(
        `
          update inventory_movements
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, movement_type, sku_name, source_name, destination_name, requested_by, upstream_receipt_code, purchase_reference, status, requested_units, moved_units, variance_units, pending_evidence, impact_level, next_action, updated_at
        `,
        [input.movementId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Inventory movement not found in repository");
      }

      return mapInventoryMovementRow(result.rows[0]);
    },
    async updateMachineItem(input) {
      const result = await pool.query(
        `
          update machine_items
          set status = $2,
              health = $3,
              next_action = $4,
              updated_at = now()
          where id = $1
          returning id, company_id, code, machine_name, machine_type, project_name, front_name, status, health, availability_percent, utilization_percent, hour_meter, next_maintenance_hours, maintenance_due_date, maintenance_backlog, open_failures, critical_open_failures, last_service_at, next_action, updated_at
        `,
        [input.machineId, input.status, input.health, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Machine item not found in repository");
      }

      return mapMachineItemRow(result.rows[0]);
    },
    async createMachineItem(input) {
      const result = await pool.query(
        `
          insert into machine_items (
            id,
            company_id,
            code,
            machine_name,
            machine_type,
            project_name,
            front_name,
            status,
            health,
            availability_percent,
            utilization_percent,
            hour_meter,
            next_maintenance_hours,
            maintenance_due_date,
            maintenance_backlog,
            open_failures,
            critical_open_failures,
            last_service_at,
            next_action
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15,
            $16,
            $17,
            $18
          )
          returning id, company_id, code, machine_name, machine_type, project_name, front_name, status, health, availability_percent, utilization_percent, hour_meter, next_maintenance_hours, maintenance_due_date, maintenance_backlog, open_failures, critical_open_failures, last_service_at, next_action, updated_at
        `,
        [
          input.companyId,
          input.code,
          input.machineName,
          input.machineType,
          input.projectName,
          input.frontName,
          input.status,
          input.health,
          input.availabilityPercent,
          input.utilizationPercent,
          input.hourMeter,
          input.nextMaintenanceHours,
          input.maintenanceDueDate,
          input.maintenanceBacklog,
          input.openFailures,
          input.criticalOpenFailures,
          input.lastServiceAt,
          input.nextAction
        ]
      );

      return mapMachineItemRow(result.rows[0]);
    },
    async updateDocumentControlItem(input) {
      const result = await pool.query(
        `
          update document_control_items
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, document_type, subject, project_name, owner_name, status, revision_count, turnaround_days, open_comments, health, next_action, updated_at
        `,
        [input.itemId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Document control item not found in repository");
      }

      return mapDocumentControlItemRow(result.rows[0]);
    },
    async createDocumentControlItem(input) {
      const result = await pool.query(
        `
          insert into document_control_items (
            id,
            company_id,
            code,
            document_type,
            subject,
            project_name,
            owner_name,
            status,
            revision_count,
            turnaround_days,
            open_comments,
            health,
            next_action
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12
          )
          returning id, company_id, code, document_type, subject, project_name, owner_name, status, revision_count, turnaround_days, open_comments, health, next_action, updated_at
        `,
        [
          input.companyId,
          input.code,
          input.documentType,
          input.subject,
          input.projectName,
          input.owner,
          input.status,
          input.revisionCount,
          input.turnaroundDays,
          input.openComments,
          input.health,
          input.nextAction
        ]
      );

      return mapDocumentControlItemRow(result.rows[0]);
    },
    async updateProcurementPackage(input) {
      const result = await pool.query(
        `
          update procurement_packages
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, package_name, project_name, buyer, status, budget_amount, bid_count, approval_hours, strategic, supplier_contention, next_action, updated_at
        `,
        [input.packageId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Procurement package not found in repository");
      }

      return mapProcurementPackageRow(result.rows[0]);
    },
    async updateSupplierControlLine(input) {
      const result = await pool.query(
        `
          update supplier_control_lines
          set delivery_health = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, supplier_id, company_id, supplier_name, owner_name, awarded_packages, active_packages, contracted_amount, concentration_percent, bid_coverage, delivery_health, approval_pressure_hours, compliance_alerts, next_action, updated_at
        `,
        [input.lineId, input.deliveryHealth, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Supplier control line not found in repository");
      }

      return mapSupplierControlLineRow(result.rows[0]);
    },
    async updateSupplierMasterProfile(input) {
      const result = await pool.query(
        `
          update supplier_master_profiles
          set compliance_status = $2,
              sat_status = $3,
              fiscal_packet_completion = $4,
              next_action = $5,
              last_validated_at = now(),
              updated_at = now()
          where id = $1
          returning id, supplier_id, company_id, supplier_name, trade_name, rfc, fiscal_regime, cfdi_use, payment_method, payment_terms_days, bank_account_masked, contact_name, contact_email, contact_phone, compliance_status, sat_status, fiscal_packet_completion, last_validated_at, next_action, updated_at
        `,
        [input.profileId, input.complianceStatus, input.satStatus, input.fiscalPacketCompletion, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Supplier master profile not found in repository");
      }

      return mapSupplierMasterProfileRow(result.rows[0]);
    },
    async updateQualityInspection(input) {
      const result = await pool.query(
        `
          update quality_inspections
          set status = $2,
              next_action = $3,
              updated_at = now()
          where id = $1
          returning id, company_id, code, area_name, checklist_name, contractor_name, severity, open_findings, evidence_completion, release_readiness, rework_rate, status, next_action, updated_at
        `,
        [input.inspectionId, input.status, input.nextAction]
      );

      if (!result.rows[0]) {
        throw new Error("Quality inspection not found in repository");
      }

      return mapQualityInspectionRow(result.rows[0]);
    },
    async createQualityInspection(input) {
      const result = await pool.query(
        `
          insert into quality_inspections (
            id,
            company_id,
            code,
            area_name,
            checklist_name,
            contractor_name,
            severity,
            open_findings,
            evidence_completion,
            release_readiness,
            rework_rate,
            status,
            next_action
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12
          )
          returning id, company_id, code, area_name, checklist_name, contractor_name, severity, open_findings, evidence_completion, release_readiness, rework_rate, status, next_action, updated_at
        `,
        [
          input.companyId,
          input.code,
          input.areaName,
          input.checklistName,
          input.contractorName,
          input.severity,
          input.openFindings,
          input.evidenceCompletion,
          input.releaseReadiness,
          input.reworkRate,
          input.status,
          input.nextAction
        ]
      );

      return mapQualityInspectionRow(result.rows[0]);
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
