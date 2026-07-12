import { z } from "zod";
import {
  AuditEventSchema,
  AuthSessionSchema,
  AuthSessionActivitiesSchema,
  AuthSessionActivitySchema,
  ComplianceCaseSchema,
  ComplianceOverviewSchema,
  ComplianceRiskSchema,
  CrmLeadBucketSchema,
  CrmOverviewSchema,
  CrmRiskSchema,
  DocumentControlItemSchema,
  DocumentControlOverviewSchema,
  DocumentControlRiskSchema,
  CompanyDetailSchema,
  CompanySchema,
  CompanyModuleStateSchema,
  FinanceLedgerItemSchema,
  FinanceOverviewSchema,
  FinanceRiskSchema,
  HrOverviewSchema,
  HrRiskSchema,
  HrWorkforceItemSchema,
  IntegrationOverviewSchema,
  IntegrationRiskSchema,
  IntegrationStreamSchema,
  InventoryLocationSchema,
  InventoryOverviewSchema,
  InventoryRiskSchema,
  ModuleSchema,
  PlatformBootstrapSchema,
  PlatformDashboardSummarySchema,
  PlatformSettingsSchema,
  ProcurementOverviewSchema,
  ProcurementPackageSchema,
  ProcurementRiskSchema,
  ProjectPortfolioItemSchema,
  ProjectPortfolioOverviewSchema,
  ProjectRiskSchema,
  QualityInspectionSchema,
  QualityOverviewSchema,
  QualityRiskSchema,
  ProvisionCompanyRequestSchema,
  ProvisionCompanyResponseSchema,
  RoleSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema,
  UserSchema,
  defaultRoles,
  moduleAreas,
  moduleCatalog,
  moduleScopes,
  userStatuses
} from "@arcont/contracts";

export {
  AuditEventSchema,
  AuthSessionSchema,
  AuthSessionActivitiesSchema,
  AuthSessionActivitySchema,
  ComplianceCaseSchema,
  ComplianceOverviewSchema,
  ComplianceRiskSchema,
  CrmLeadBucketSchema,
  CrmOverviewSchema,
  CrmRiskSchema,
  DocumentControlItemSchema,
  DocumentControlOverviewSchema,
  DocumentControlRiskSchema,
  CompanyDetailSchema,
  CompanySchema,
  CompanyModuleStateSchema,
  FinanceLedgerItemSchema,
  FinanceOverviewSchema,
  FinanceRiskSchema,
  HrOverviewSchema,
  HrRiskSchema,
  HrWorkforceItemSchema,
  IntegrationOverviewSchema,
  IntegrationRiskSchema,
  IntegrationStreamSchema,
  InventoryLocationSchema,
  InventoryOverviewSchema,
  InventoryRiskSchema,
  ModuleSchema,
  PlatformSettingsSchema,
  ProcurementOverviewSchema,
  ProcurementPackageSchema,
  ProcurementRiskSchema,
  ProjectPortfolioItemSchema,
  ProjectPortfolioOverviewSchema,
  ProjectRiskSchema,
  QualityInspectionSchema,
  QualityOverviewSchema,
  QualityRiskSchema,
  PlatformBootstrapSchema,
  PlatformDashboardSummarySchema,
  ProvisionCompanyRequestSchema,
  ProvisionCompanyResponseSchema,
  RoleSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema,
  UserSchema,
  defaultRoles,
  moduleAreas,
  moduleCatalog,
  moduleScopes,
  userStatuses
};

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

export const PlatformApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional()
  })
});

export type {
  AuditEventContract,
  AuthLoginRequestContract,
  AuthSessionContract,
  AuthSessionActivitiesContract,
  AuthSessionActivityContract,
  ComplianceCaseContract,
  ComplianceOverviewContract,
  ComplianceRiskContract,
  CrmLeadBucketContract,
  CrmOverviewContract,
  CrmRiskContract,
  DocumentControlItemContract,
  DocumentControlOverviewContract,
  DocumentControlRiskContract,
  CompanyDetailContract,
  CompanyContract,
  CompanyModuleStateContract,
  FinanceLedgerItemContract,
  FinanceOverviewContract,
  FinanceRiskContract,
  HrOverviewContract,
  HrRiskContract,
  HrWorkforceItemContract,
  IntegrationOverviewContract,
  IntegrationRiskContract,
  IntegrationStreamContract,
  InventoryLocationContract,
  InventoryOverviewContract,
  InventoryRiskContract,
  ModuleContract,
  PlatformBootstrapContract,
  PlatformDashboardSummaryContract,
  PlatformSettingsContract,
  ProcurementOverviewContract,
  ProcurementPackageContract,
  ProcurementRiskContract,
  ProjectPortfolioItemContract,
  ProjectPortfolioOverviewContract,
  ProjectRiskContract,
  QualityInspectionContract,
  QualityOverviewContract,
  QualityRiskContract,
  ProvisionCompanyRequestContract,
  ProvisionCompanyResponseContract,
  RoleContract,
  UpdateCompanyModulesRequestContract,
  UpdatePlatformSettingsRequestContract,
  UserContract
} from "@arcont/contracts";

export type CreatePlatformUserRequestContract = z.infer<typeof CreatePlatformUserRequestSchema>;
export type UpdatePlatformUserRoleRequestContract = z.infer<typeof UpdatePlatformUserRoleRequestSchema>;
export type UpdatePlatformUserStatusRequestContract = z.infer<typeof UpdatePlatformUserStatusRequestSchema>;
export type PlatformUserDetailContract = z.infer<typeof PlatformUserDetailSchema>;
export type CreatePlatformUserResponseContract = z.infer<typeof CreatePlatformUserResponseSchema>;
export type PlatformApiErrorContract = z.infer<typeof PlatformApiErrorSchema>;
