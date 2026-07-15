import {
  AccountsPayableInvoiceSchema,
  AccountsPayableOverviewSchema,
  CreateTreasuryPaymentRunRequestSchema,
  AuditEventSchema,
  AuthSessionSchema,
  BudgetBookLineSchema,
  BudgetBookOverviewSchema,
  CashFlowLineSchema,
  CashFlowOverviewSchema,
  CloseControlLineSchema,
  CloseControlOverviewSchema,
  SupplierControlLineSchema,
  SupplierControlOverviewSchema,
  SupplierMasterOverviewSchema,
  SupplierMasterProfileSchema,
  ComplianceCaseSchema,
  ComplianceOverviewSchema,
  CostControlLineSchema,
  CostControlOverviewSchema,
  CrmLeadBucketSchema,
  CrmOverviewSchema,
  CompanyDetailSchema,
  CompanyModuleStateSchema,
  CompanySchema,
  CreateAccountsPayableInvoiceRequestSchema,
  CreateSubcontractLineRequestSchema,
  CreateProjectPortfolioItemRequestSchema,
  CreateProjectScheduleActivityRequestSchema,
  ImportProjectScheduleActivitiesRequestSchema,
  ImportProjectScheduleActivitiesResponseSchema,
  CreateDocumentControlItemRequestSchema,
  CreateFieldMaterialRequestRequestSchema,
  CreateFieldMaterialRequestResponseSchema,
  CreateDailyLogEntryRequestSchema,
  CreateInventoryMovementRequestSchema,
  CreateInventoryReceiptRequestSchema,
  CreateMachineItemRequestSchema,
  CreateQualityInspectionRequestSchema,
  CreateProcurementPurchaseOrderRequestSchema,
  CreateProcurementRequisitionRequestSchema,
  CreateSupplierControlLineRequestSchema,
  CreateSupplierMasterProfileRequestSchema,
  CreatePlatformUserRequestSchema,
  CreatePlatformUserResponseSchema,
  DailyLogEntrySchema,
  DailyLogOverviewSchema,
  DocumentControlItemSchema,
  DocumentControlOverviewSchema,
  EquipmentOverviewSchema,
  EstimationCollectionLineSchema,
  EstimationCollectionOverviewSchema,
  FinanceOverviewSchema,
  FinanceLedgerItemSchema,
  FieldMaterialRequestOverviewSchema,
  HrWorkforceItemSchema,
  HrOverviewSchema,
  IntegrationOverviewSchema,
  IntegrationStreamSchema,
  InventoryLocationSchema,
  InventoryOverviewSchema,
  InventoryReceiptSchema,
  InventoryReceivingOverviewSchema,
  InventoryMovementSchema,
  InventoryMovementsOverviewSchema,
  MachineItemSchema,
  ModuleSchema,
  PostSaleCaseSchema,
  PostSaleOverviewSchema,
  PlatformApiErrorSchema,
  PlatformBootstrapSchema,
  PlatformDashboardSummarySchema,
  PlatformSettingsSchema,
  ProvisionCompanyRequestSchema,
  ProvisionCompanyResponseSchema,
  ProcurementOverviewSchema,
  ProcurementPackageSchema,
  ProcurementPurchaseOrderSchema,
  ProcurementPurchaseOrdersOverviewSchema,
  ProcurementRequisitionSchema,
  ProcurementRequisitionsOverviewSchema,
  ProjectPortfolioItemSchema,
  ProjectPortfolioOverviewSchema,
  ProjectScheduleActivitySchema,
  ProjectScheduleOverviewSchema,
  QualityInspectionSchema,
  QualityOverviewSchema,
  PlatformUserDetailSchema,
  RoleSchema,
  SubcontractLineSchema,
  SubcontractOverviewSchema,
  UpdateAccountsPayableInvoiceRequestSchema,
  UpdateTreasuryPaymentRunRequestSchema,
  UpdateSubcontractLineRequestSchema,
  UpdateComplianceCaseRequestSchema,
  UpdateCostControlLineRequestSchema,
  UpdateCrmLeadBucketRequestSchema,
  UpdateDocumentControlItemRequestSchema,
  UpdateEstimationCollectionLineRequestSchema,
  UpdateFinanceLedgerItemRequestSchema,
  UpdateHrWorkforceItemRequestSchema,
  UpdateIntegrationStreamRequestSchema,
  UpdateInventoryLocationRequestSchema,
  UpdateInventoryReceiptRequestSchema,
  UpdateInventoryMovementRequestSchema,
  UpdateMachineItemRequestSchema,
  UpdatePostSaleCaseRequestSchema,
  UpdateProjectPortfolioItemRequestSchema,
  UpdateProjectScheduleActivityRequestSchema,
  UpdateProcurementPackageRequestSchema,
  UpdateProcurementPurchaseOrderRequestSchema,
  UpdateProcurementRequisitionRequestSchema,
  UpdatePlatformUserRoleRequestSchema,
  UpdatePlatformUserStatusRequestSchema,
  UpdateBudgetBookLineRequestSchema,
  UpdateCashFlowLineRequestSchema,
  UpdateCloseControlLineRequestSchema,
  UpdateSupplierControlLineRequestSchema,
  UpdateSupplierMasterProfileRequestSchema,
  UpdateDailyLogEntryRequestSchema,
  UpdateQualityInspectionRequestSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema,
  UserSchema,
  type AccountsPayableInvoiceContract,
  type AccountsPayableOverviewContract,
  type CreateProjectPortfolioItemRequestContract,
  type CreateProjectScheduleActivityRequestContract,
  type ImportProjectScheduleActivitiesRequestContract,
  type ImportProjectScheduleActivitiesResponseContract,
  type CreateTreasuryPaymentRunRequestContract,
  type AuditEventContract,
  type AuthLoginRequestContract,
  type AuthSessionContract,
  type BudgetBookLineContract,
  type BudgetBookOverviewContract,
  type CashFlowLineContract,
  type CashFlowOverviewContract,
  type CloseControlLineContract,
  type CloseControlOverviewContract,
  type SupplierControlLineContract,
  type SupplierControlOverviewContract,
  type SupplierMasterOverviewContract,
  type SupplierMasterProfileContract,
  type ComplianceCaseContract,
  type ComplianceOverviewContract,
  type CostControlLineContract,
  type CostControlOverviewContract,
  type CrmLeadBucketContract,
  type CrmOverviewContract,
  type CompanyDetailContract,
  type CompanyModuleStateContract,
  type CompanyContract,
  type CreateAccountsPayableInvoiceRequestContract,
  type CreateSubcontractLineRequestContract,
  type CreateDocumentControlItemRequestContract,
  type CreateDailyLogEntryRequestContract,
  type CreateFieldMaterialRequestRequestContract,
  type CreateFieldMaterialRequestResponseContract,
  type CreateInventoryMovementRequestContract,
  type CreateInventoryReceiptRequestContract,
  type CreateMachineItemRequestContract,
  type CreateQualityInspectionRequestContract,
  type CreateProcurementPurchaseOrderRequestContract,
  type CreateSupplierControlLineRequestContract,
  type CreateSupplierMasterProfileRequestContract,
  type CreatePlatformUserRequestContract,
  type CreatePlatformUserResponseContract,
  type CreateProcurementRequisitionRequestContract,
  type DailyLogEntryContract,
  type DailyLogOverviewContract,
  type DocumentControlItemContract,
  type DocumentControlOverviewContract,
  type EquipmentOverviewContract,
  type EstimationCollectionLineContract,
  type EstimationCollectionOverviewContract,
  type FinanceLedgerItemContract,
  type FinanceOverviewContract,
  type FieldMaterialRequestOverviewContract,
  type HrWorkforceItemContract,
  type HrOverviewContract,
  type IntegrationOverviewContract,
  type IntegrationStreamContract,
  type InventoryLocationContract,
  type InventoryOverviewContract,
  type InventoryReceiptContract,
  type InventoryReceivingOverviewContract,
  type InventoryMovementContract,
  type InventoryMovementsOverviewContract,
  type MachineItemContract,
  type ModuleContract,
  type PostSaleCaseContract,
  type PostSaleOverviewContract,
  type PlatformApiErrorContract,
  type PlatformBootstrapContract,
  type PlatformDashboardSummaryContract,
  type PlatformSystemReadinessContract,
  PlatformSystemReadinessSchema,
  type PlatformSettingsContract,
  type ProvisionCompanyRequestContract,
  type ProvisionCompanyResponseContract,
  type ProcurementOverviewContract,
  type ProcurementPackageContract,
  type ProcurementPurchaseOrderContract,
  type ProcurementPurchaseOrdersOverviewContract,
  type ProcurementRequisitionContract,
  type ProcurementRequisitionsOverviewContract,
  type ProjectPortfolioItemContract,
  type ProjectPortfolioOverviewContract,
  type ProjectScheduleActivityContract,
  type ProjectScheduleOverviewContract,
  type QualityInspectionContract,
  type QualityOverviewContract,
  type PlatformUserDetailContract,
  type RoleContract,
  type SubcontractLineContract,
  type SubcontractOverviewContract,
  type UpdateComplianceCaseRequestContract,
  type UpdateAccountsPayableInvoiceRequestContract,
  type UpdateTreasuryPaymentRunRequestContract,
  type TreasuryPaymentRunContract,
  type TreasuryPaymentRunsOverviewContract,
  TreasuryPaymentRunSchema,
  TreasuryPaymentRunsOverviewSchema,
  type UpdateCostControlLineRequestContract,
  type UpdateCrmLeadBucketRequestContract,
  type UpdateDocumentControlItemRequestContract,
  type UpdateEstimationCollectionLineRequestContract,
  type UpdateFinanceLedgerItemRequestContract,
  type UpdateHrWorkforceItemRequestContract,
  type UpdateIntegrationStreamRequestContract,
  type UpdateInventoryLocationRequestContract,
  type UpdateInventoryReceiptRequestContract,
  type UpdateInventoryMovementRequestContract,
  type UpdateMachineItemRequestContract,
  type UpdatePostSaleCaseRequestContract,
  type UpdateProjectPortfolioItemRequestContract,
  type UpdateProjectScheduleActivityRequestContract,
  type UpdateProcurementPackageRequestContract,
  type UpdateProcurementPurchaseOrderRequestContract,
  type UpdateProcurementRequisitionRequestContract,
  type UpdatePlatformUserRoleRequestContract,
  type UpdatePlatformUserStatusRequestContract,
  type UpdateBudgetBookLineRequestContract,
  type UpdateCashFlowLineRequestContract,
  type UpdateCloseControlLineRequestContract,
  type UpdateSupplierControlLineRequestContract,
  type UpdateSupplierMasterProfileRequestContract,
  type UpdateDailyLogEntryRequestContract,
  type UpdateQualityInspectionRequestContract,
  type UpdateCompanyModulesRequestContract,
  type UpdatePlatformSettingsRequestContract,
  type UpdateSubcontractLineRequestContract,
  type UserContract
} from "@/lib/contracts";
import {
  addDemoTreasuryPaymentRunInvoice,
  createDemoAccountsPayableInvoice,
  createDemoSubcontractLine,
  createDemoDailyLogEntry,
  createDemoDocumentControlItem,
  createDemoFieldMaterialRequest,
  createDemoInventoryMovement,
  createDemoInventoryReceipt,
  getDemoProcurementOverview,
  createDemoQualityInspection,
  createDemoProcurementPurchaseOrder,
  createDemoProcurementRequisition,
  createDemoProjectPortfolioItem,
  createDemoProjectScheduleActivity,
  importDemoProjectScheduleActivities,
  createDemoTreasuryPaymentRun,
  getDemoBudgetBookOverview,
  getDemoCashFlowOverview,
  getDemoCloseControlOverview,
  getDemoComplianceOverview,
  getDemoCostControlOverview,
  getDemoCrmOverview,
  getDemoEstimationCollectionOverview,
  getDemoFinanceOverview,
  getDemoHrOverview,
  createDemoMachineItem,
  createDemoSupplierControlLine,
  createDemoSupplierMasterProfile,
  getDemoAccountsPayableOverview,
  getDemoDailyLogOverview,
  getDemoDocumentControlOverview,
  getDemoEquipmentOverview,
  getDemoFieldMaterialRequestsOverview,
  getDemoInventoryMovementsOverview,
  getDemoInventoryReceivingOverview,
  getDemoProcurementPurchaseOrdersOverview,
  getDemoProcurementRequisitionsOverview,
  getDemoProjectsOverview,
  getDemoProjectScheduleOverview,
  getDemoPostSaleOverview,
  getDemoQualityOverview,
  getDemoSubcontractOverview,
  getDemoSupplierControlOverview,
  getDemoSupplierMasterOverview,
  getDemoTreasuryPaymentRunsOverview,
  moveDemoTreasuryPaymentRunInvoice,
  removeDemoTreasuryPaymentRunInvoice,
  updateDemoDailyLogEntry,
  updateDemoDocumentControlItem,
  updateDemoAccountsPayableInvoice,
  updateDemoBudgetBookLine,
  updateDemoCashFlowLine,
  updateDemoCloseControlLine,
  updateDemoComplianceCase,
  updateDemoCostControlLine,
  updateDemoCrmLeadBucket,
  updateDemoEstimationCollectionLine,
  updateDemoFinanceLedgerItem,
  updateDemoHrWorkforceItem,
  updateDemoInventoryMovement,
  updateDemoInventoryReceipt,
  updateDemoProcurementPackage,
  updateDemoProcurementPurchaseOrder,
  updateDemoProcurementRequisition,
  updateDemoQualityInspection,
  updateDemoMachineItem,
  updateDemoPostSaleCase,
  updateDemoProjectPortfolioItem,
  updateDemoProjectScheduleActivity,
  updateDemoSubcontractLine,
  updateDemoSupplierControlLine,
  updateDemoSupplierMasterProfile,
  updateDemoTreasuryPaymentRun
} from "@/lib/demo-operations-store";

type RequestOptions = {
  apiBaseUrl: string;
  accessToken?: string;
};

export type ApiResult<T> = {
  data: T | null;
  error: PlatformApiErrorContract["error"] | null;
};

async function requestJson<T>(
  path: string,
  { apiBaseUrl, accessToken }: RequestOptions,
  init?: RequestInit
): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function requestResult<T>(
  path: string,
  { apiBaseUrl, accessToken }: RequestOptions,
  init?: RequestInit
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const parsedError = PlatformApiErrorSchema.safeParse(json);
      return {
        data: null,
        error: parsedError.success
          ? parsedError.data.error
          : {
              code: "PLATFORM_REQUEST_FAILED",
              message: "The platform request failed."
            }
      };
    }

    return {
      data: json as T,
      error: null
    };
  } catch {
    return {
      data: null,
      error: {
        code: "PLATFORM_NETWORK_UNAVAILABLE",
        message: "The platform backend is unavailable right now."
      }
    };
  }
}

export async function loginWithApi(
  credentials: AuthLoginRequestContract,
  options: RequestOptions
): Promise<AuthSessionContract | null> {
  const response = await requestJson("/auth/login", options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(credentials)
  });

  return response ? AuthSessionSchema.parse(response) : null;
}

export async function fetchBootstrap(
  companyId: string,
  userEmail: string,
  options: RequestOptions
): Promise<PlatformBootstrapContract | null> {
  const response = await requestJson(
    `/platform/bootstrap/${companyId}?userEmail=${encodeURIComponent(userEmail)}`,
    options
  );

  return response ? PlatformBootstrapSchema.parse(response) : null;
}

export async function fetchCompanies(options: RequestOptions): Promise<CompanyContract[] | null> {
  const response = await requestJson<{ items: CompanyContract[] }>("/platform/companies", options);
  return response ? CompanySchema.array().parse(response.items) : null;
}

export async function fetchCompanyDetail(
  companyId: string,
  options: RequestOptions
): Promise<CompanyDetailContract | null> {
  const response = await requestJson(`/platform/companies/${companyId}`, options);
  return response ? CompanyDetailSchema.parse(response) : null;
}

export async function provisionCompany(
  input: ProvisionCompanyRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProvisionCompanyResponseContract>> {
  const payload = ProvisionCompanyRequestSchema.parse(input);
  const response = await requestResult("/platform/provision-company", options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProvisionCompanyResponseSchema.parse(response.data),
    error: null
  };
}

export async function fetchModules(options: RequestOptions): Promise<ModuleContract[] | null> {
  const response = await requestJson<{ items: ModuleContract[] }>("/platform/modules", options);
  return response ? ModuleSchema.array().parse(response.items) : null;
}

export async function fetchRoles(options: RequestOptions): Promise<RoleContract[] | null> {
  const response = await requestJson<{ items: RoleContract[] }>("/platform/roles", options);
  return response ? RoleSchema.array().parse(response.items) : null;
}

export async function fetchUsers(
  companyId: string | undefined,
  options: RequestOptions
): Promise<UserContract[] | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson<{ items: UserContract[] }>(`/platform/users${query}`, options);
  return response ? UserSchema.array().parse(response.items) : null;
}

export async function fetchSettings(
  companyId: string,
  options: RequestOptions
): Promise<PlatformSettingsContract | null> {
  const response = await requestJson(`/platform/settings/${companyId}`, options);
  return response ? PlatformSettingsSchema.parse(response) : null;
}

export async function updateSettings(
  companyId: string,
  input: UpdatePlatformSettingsRequestContract,
  options: RequestOptions
): Promise<PlatformSettingsContract | null> {
  const payload = UpdatePlatformSettingsRequestSchema.parse(input);
  const response = await requestJson(`/platform/settings/${companyId}`, options, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return response ? PlatformSettingsSchema.parse(response) : null;
}

export async function fetchCompanyModules(
  companyId: string,
  options: RequestOptions
): Promise<CompanyModuleStateContract[] | null> {
  const response = await requestJson<{ items: CompanyModuleStateContract[] }>(
    `/platform/companies/${companyId}/modules`,
    options
  );

  return response ? CompanyModuleStateSchema.array().parse(response.items) : null;
}

export async function updateCompanyModules(
  companyId: string,
  input: UpdateCompanyModulesRequestContract,
  options: RequestOptions
): Promise<CompanyModuleStateContract[] | null> {
  const payload = UpdateCompanyModulesRequestSchema.parse(input);
  const response = await requestJson<{ items: CompanyModuleStateContract[] }>(
    `/platform/companies/${companyId}/modules`,
    options,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  return response ? CompanyModuleStateSchema.array().parse(response.items) : null;
}

export async function fetchDashboardSummary(
  companyId: string | undefined,
  options: RequestOptions
): Promise<PlatformDashboardSummaryContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/platform/dashboard/summary${query}`, options);
  return response ? PlatformDashboardSummarySchema.parse(response) : null;
}

export async function fetchPlatformSystemReadiness(
  companyId: string | undefined,
  options: RequestOptions
): Promise<PlatformSystemReadinessContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/platform/readiness${query}`, options);
  return response ? PlatformSystemReadinessSchema.parse(response) : null;
}

export async function fetchAuditEvents(
  companyId: string | undefined,
  limit: number | undefined,
  options: RequestOptions
): Promise<AuditEventContract[] | null> {
  const searchParams = new URLSearchParams();
  if (companyId) {
    searchParams.set("companyId", companyId);
  }
  if (limit) {
    searchParams.set("limit", String(limit));
  }

  const query = searchParams.toString();
  const response = await requestJson<{ items: AuditEventContract[] }>(
    `/platform/audit-events${query ? `?${query}` : ""}`,
    options
  );

  return response ? AuditEventSchema.array().parse(response.items) : null;
}

export async function fetchProjectsOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProjectPortfolioOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoProjectsOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/projects/overview${query}`, options);
  if (response) {
    return ProjectPortfolioOverviewSchema.parse(response);
  }

  return companyId ? getDemoProjectsOverview(companyId) : null;
}

export async function updateProjectPortfolioItem(
  projectId: string,
  companyId: string | undefined,
  input: UpdateProjectPortfolioItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProjectPortfolioItemContract>> {
  const payload = UpdateProjectPortfolioItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoProjectPortfolioItem(companyId, projectId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "PROJECTS_DEMO_NOT_FOUND",
            message: "Demo project not found.",
            details: {
              projectId,
              companyId
            }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/projects/items/${projectId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoProjectPortfolioItem(companyId, projectId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProjectPortfolioItemSchema.parse(response.data),
    error: null
  };
}

export async function createProjectPortfolioItem(
  companyId: string | undefined,
  input: CreateProjectPortfolioItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProjectPortfolioItemContract>> {
  const payload = CreateProjectPortfolioItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoProjectPortfolioItem(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/projects/items${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoProjectPortfolioItem(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProjectPortfolioItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchProjectScheduleOverview(
  projectId: string,
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProjectScheduleOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoProjectScheduleOverview(companyId, projectId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/projects/${projectId}/schedule${query}`, options);
  if (response) {
    return ProjectScheduleOverviewSchema.parse(response);
  }

  return companyId ? getDemoProjectScheduleOverview(companyId, projectId) : null;
}

export async function createProjectScheduleActivity(
  projectId: string,
  companyId: string | undefined,
  input: CreateProjectScheduleActivityRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProjectScheduleActivityContract>> {
  const payload = CreateProjectScheduleActivityRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const created = createDemoProjectScheduleActivity(companyId, projectId, payload);
    return {
      data: created,
      error: created
        ? null
        : {
            code: "PROJECT_SCHEDULE_DEMO_NOT_FOUND",
            message: "Demo project schedule was not found.",
            details: { companyId, projectId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/projects/${projectId}/schedule/activities${query}`, options, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    const fallback = companyId ? createDemoProjectScheduleActivity(companyId, projectId, payload) : null;
    return fallback ? { data: fallback, error: null } : { data: null, error: response.error };
  }

  return { data: ProjectScheduleActivitySchema.parse(response.data), error: null };
}

export async function importProjectScheduleActivities(
  projectId: string,
  companyId: string | undefined,
  input: ImportProjectScheduleActivitiesRequestContract,
  options: RequestOptions
): Promise<ApiResult<ImportProjectScheduleActivitiesResponseContract>> {
  const payload = ImportProjectScheduleActivitiesRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    try {
      const imported = importDemoProjectScheduleActivities(companyId, projectId, payload);
      return imported
        ? { data: imported, error: null }
        : {
            data: null,
            error: {
              code: "PROJECT_SCHEDULE_DEMO_NOT_FOUND",
              message: "Demo project schedule was not found.",
              details: { companyId, projectId }
            }
          };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "PROJECT_SCHEDULE_IMPORT_FAILED",
          message: error instanceof Error ? error.message : "Demo project schedule import failed."
        }
      };
    }
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/projects/${projectId}/schedule/import${query}`, options, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (!companyId) {
      return { data: null, error: response.error };
    }

    try {
      const fallback = importDemoProjectScheduleActivities(companyId, projectId, payload);
      return fallback ? { data: fallback, error: null } : { data: null, error: response.error };
    } catch (error) {
      return {
        data: null,
        error: {
          code: "PROJECT_SCHEDULE_IMPORT_FAILED",
          message: error instanceof Error ? error.message : "Demo project schedule import failed."
        }
      };
    }
  }

  return { data: ImportProjectScheduleActivitiesResponseSchema.parse(response.data), error: null };
}

export async function updateProjectScheduleActivity(
  projectId: string,
  activityId: string,
  companyId: string | undefined,
  input: UpdateProjectScheduleActivityRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProjectScheduleActivityContract>> {
  const payload = UpdateProjectScheduleActivityRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoProjectScheduleActivity(companyId, projectId, activityId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "PROJECT_SCHEDULE_DEMO_ACTIVITY_NOT_FOUND",
            message: "Demo project schedule activity was not found.",
            details: { companyId, projectId, activityId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/projects/${projectId}/schedule/activities/${activityId}${query}`, options, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    const fallback = companyId
      ? updateDemoProjectScheduleActivity(companyId, projectId, activityId, payload)
      : null;
    return fallback ? { data: fallback, error: null } : { data: null, error: response.error };
  }

  return { data: ProjectScheduleActivitySchema.parse(response.data), error: null };
}

export async function fetchProcurementOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProcurementOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoProcurementOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/procurement/overview${query}`, options);
  if (response) {
    return ProcurementOverviewSchema.parse(response);
  }

  return companyId ? getDemoProcurementOverview(companyId) : null;
}

export async function updateProcurementPackage(
  packageId: string,
  companyId: string | undefined,
  input: UpdateProcurementPackageRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProcurementPackageContract>> {
  const payload = UpdateProcurementPackageRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoProcurementPackage(companyId, packageId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "PROCUREMENT_DEMO_NOT_FOUND",
            message: "Demo procurement package not found.",
            details: { companyId, packageId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/procurement/packages/${packageId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoProcurementPackage(companyId, packageId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProcurementPackageSchema.parse(response.data),
    error: null
  };
}

export async function fetchProcurementRequisitionsOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProcurementRequisitionsOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoProcurementRequisitionsOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/procurement/requisitions/overview${query}`, options);
  if (response) {
    return ProcurementRequisitionsOverviewSchema.parse(response);
  }

  return companyId ? getDemoProcurementRequisitionsOverview(companyId) : null;
}

export async function createProcurementRequisition(
  companyId: string | undefined,
  input: CreateProcurementRequisitionRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProcurementRequisitionContract>> {
  const payload = CreateProcurementRequisitionRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoProcurementRequisition(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/procurement/requisitions${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoProcurementRequisition(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProcurementRequisitionSchema.parse(response.data),
    error: null
  };
}

export async function updateProcurementRequisition(
  requisitionId: string,
  companyId: string | undefined,
  input: UpdateProcurementRequisitionRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProcurementRequisitionContract>> {
  const payload = UpdateProcurementRequisitionRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoProcurementRequisition(companyId, requisitionId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "PROCUREMENT_REQUISITION_DEMO_NOT_FOUND",
            message: "Demo requisition not found.",
            details: { requisitionId, companyId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/procurement/requisitions/${requisitionId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoProcurementRequisition(companyId, requisitionId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProcurementRequisitionSchema.parse(response.data),
    error: null
  };
}

export async function createFieldMaterialRequest(
  companyId: string | undefined,
  input: CreateFieldMaterialRequestRequestContract,
  options: RequestOptions
): Promise<ApiResult<CreateFieldMaterialRequestResponseContract>> {
  const payload = CreateFieldMaterialRequestRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoFieldMaterialRequest(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/field/material-requests${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoFieldMaterialRequest(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CreateFieldMaterialRequestResponseSchema.parse(response.data),
    error: null
  };
}

export async function fetchFieldMaterialRequestsOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<FieldMaterialRequestOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoFieldMaterialRequestsOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/field/material-requests/overview${query}`, options);
  if (response) {
    return FieldMaterialRequestOverviewSchema.parse(response);
  }

  return companyId ? getDemoFieldMaterialRequestsOverview(companyId) : null;
}

export async function fetchProcurementPurchaseOrdersOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProcurementPurchaseOrdersOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoProcurementPurchaseOrdersOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/procurement/purchase-orders/overview${query}`, options);
  if (response) {
    return ProcurementPurchaseOrdersOverviewSchema.parse(response);
  }

  return companyId ? getDemoProcurementPurchaseOrdersOverview(companyId) : null;
}

export async function createProcurementPurchaseOrder(
  companyId: string | undefined,
  input: CreateProcurementPurchaseOrderRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProcurementPurchaseOrderContract>> {
  const payload = CreateProcurementPurchaseOrderRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoProcurementPurchaseOrder(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/procurement/purchase-orders${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoProcurementPurchaseOrder(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProcurementPurchaseOrderSchema.parse(response.data),
    error: null
  };
}

export async function updateProcurementPurchaseOrder(
  purchaseOrderId: string,
  companyId: string | undefined,
  input: UpdateProcurementPurchaseOrderRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProcurementPurchaseOrderContract>> {
  const payload = UpdateProcurementPurchaseOrderRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoProcurementPurchaseOrder(companyId, purchaseOrderId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "PROCUREMENT_PURCHASE_ORDER_DEMO_NOT_FOUND",
            message: "Demo purchase order not found.",
            details: { purchaseOrderId, companyId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/procurement/purchase-orders/${purchaseOrderId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoProcurementPurchaseOrder(companyId, purchaseOrderId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ProcurementPurchaseOrderSchema.parse(response.data),
    error: null
  };
}

export async function fetchBudgetBookOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<BudgetBookOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoBudgetBookOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/budget-book/overview${query}`, options);
  if (response) {
    return BudgetBookOverviewSchema.parse(response);
  }

  return companyId ? getDemoBudgetBookOverview(companyId) : null;
}

export async function updateBudgetBookLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateBudgetBookLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<BudgetBookLineContract>> {
  const payload = UpdateBudgetBookLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoBudgetBookLine(companyId, lineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "BUDGET_BOOK_DEMO_NOT_FOUND",
            message: "Demo budget concept not found.",
            details: { companyId, lineId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/budget-book/lines/${lineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoBudgetBookLine(companyId, lineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: BudgetBookLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchCashFlowOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CashFlowOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoCashFlowOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/cash-flow/overview${query}`, options);
  if (response) {
    return CashFlowOverviewSchema.parse(response);
  }

  return companyId ? getDemoCashFlowOverview(companyId) : null;
}

export async function updateCashFlowLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateCashFlowLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<CashFlowLineContract>> {
  const payload = UpdateCashFlowLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoCashFlowLine(companyId, lineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "CASH_FLOW_DEMO_NOT_FOUND",
            message: "Demo cash flow line not found.",
            details: { companyId, lineId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/cash-flow/lines/${lineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoCashFlowLine(companyId, lineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CashFlowLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchCloseControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CloseControlOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoCloseControlOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/close-control/overview${query}`, options);
  if (response) {
    return CloseControlOverviewSchema.parse(response);
  }

  return companyId ? getDemoCloseControlOverview(companyId) : null;
}

export async function updateCloseControlLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateCloseControlLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<CloseControlLineContract>> {
  const payload = UpdateCloseControlLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoCloseControlLine(companyId, lineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "CLOSE_CONTROL_DEMO_NOT_FOUND",
            message: "Demo close control line not found.",
            details: { companyId, lineId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/close-control/lines/${lineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoCloseControlLine(companyId, lineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CloseControlLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchSupplierControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<SupplierControlOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoSupplierControlOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/supplier-control/overview${query}`, options);
  if (response) {
    return SupplierControlOverviewSchema.parse(response);
  }

  return companyId ? getDemoSupplierControlOverview(companyId) : null;
}

export async function updateSupplierControlLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateSupplierControlLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<SupplierControlLineContract>> {
  const payload = UpdateSupplierControlLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoSupplierControlLine(companyId, lineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "SUPPLIER_CONTROL_DEMO_NOT_FOUND",
            message: "Demo supplier lane not found.",
            details: { lineId, companyId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/supplier-control/lines/${lineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoSupplierControlLine(companyId, lineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: SupplierControlLineSchema.parse(response.data),
    error: null
  };
}

export async function createSupplierControlLine(
  companyId: string | undefined,
  input: CreateSupplierControlLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<SupplierControlLineContract>> {
  const payload = CreateSupplierControlLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoSupplierControlLine(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/supplier-control/lines${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoSupplierControlLine(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: SupplierControlLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchSupplierMasterOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<SupplierMasterOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoSupplierMasterOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/supplier-master/overview${query}`, options);
  if (response) {
    return SupplierMasterOverviewSchema.parse(response);
  }

  return companyId ? getDemoSupplierMasterOverview(companyId) : null;
}

export async function createSupplierMasterProfile(
  companyId: string | undefined,
  input: CreateSupplierMasterProfileRequestContract,
  options: RequestOptions
): Promise<ApiResult<SupplierMasterProfileContract>> {
  const payload = CreateSupplierMasterProfileRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoSupplierMasterProfile(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/supplier-master/profiles${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoSupplierMasterProfile(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: SupplierMasterProfileSchema.parse(response.data),
    error: null
  };
}

export async function updateSupplierMasterProfile(
  profileId: string,
  companyId: string | undefined,
  input: UpdateSupplierMasterProfileRequestContract,
  options: RequestOptions
): Promise<ApiResult<SupplierMasterProfileContract>> {
  const payload = UpdateSupplierMasterProfileRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoSupplierMasterProfile(companyId, profileId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "SUPPLIER_MASTER_DEMO_NOT_FOUND",
            message: "Demo supplier profile not found.",
            details: { profileId, companyId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/supplier-master/profiles/${profileId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoSupplierMasterProfile(companyId, profileId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: SupplierMasterProfileSchema.parse(response.data),
    error: null
  };
}

export async function fetchCostControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CostControlOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoCostControlOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/cost-control/overview${query}`, options);
  if (response) {
    return CostControlOverviewSchema.parse(response);
  }

  return companyId ? getDemoCostControlOverview(companyId) : null;
}

export async function updateCostControlLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateCostControlLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<CostControlLineContract>> {
  const payload = UpdateCostControlLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoCostControlLine(companyId, lineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "COST_CONTROL_DEMO_NOT_FOUND",
            message: "Demo cost-control line not found.",
            details: { companyId, lineId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/cost-control/lines/${lineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoCostControlLine(companyId, lineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CostControlLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchInventoryOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<InventoryOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/inventory/overview${query}`, options);
  return response ? InventoryOverviewSchema.parse(response) : null;
}

export async function updateInventoryLocation(
  locationId: string,
  companyId: string | undefined,
  input: UpdateInventoryLocationRequestContract,
  options: RequestOptions
): Promise<ApiResult<InventoryLocationContract>> {
  const payload = UpdateInventoryLocationRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/inventory/locations/${locationId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: InventoryLocationSchema.parse(response.data),
    error: null
  };
}

export async function fetchInventoryReceivingOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<InventoryReceivingOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoInventoryReceivingOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/inventory/receiving/overview${query}`, options);
  if (response) {
    return InventoryReceivingOverviewSchema.parse(response);
  }

  return companyId ? getDemoInventoryReceivingOverview(companyId) : null;
}

export async function createInventoryReceipt(
  companyId: string | undefined,
  input: CreateInventoryReceiptRequestContract,
  options: RequestOptions
): Promise<ApiResult<InventoryReceiptContract>> {
  const payload = CreateInventoryReceiptRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoInventoryReceipt(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/inventory/receipts${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoInventoryReceipt(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: InventoryReceiptSchema.parse(response.data),
    error: null
  };
}

export async function updateInventoryReceipt(
  receiptId: string,
  companyId: string | undefined,
  input: UpdateInventoryReceiptRequestContract,
  options: RequestOptions
): Promise<ApiResult<InventoryReceiptContract>> {
  const payload = UpdateInventoryReceiptRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoInventoryReceipt(companyId, receiptId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "INVENTORY_RECEIPT_DEMO_NOT_FOUND",
            message: "Demo inventory receipt not found.",
            details: {
              receiptId,
              companyId
            }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/inventory/receipts/${receiptId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoInventoryReceipt(companyId, receiptId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: InventoryReceiptSchema.parse(response.data),
    error: null
  };
}

export async function fetchInventoryMovementsOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<InventoryMovementsOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoInventoryMovementsOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/inventory/movements/overview${query}`, options);
  if (response) {
    return InventoryMovementsOverviewSchema.parse(response);
  }

  return companyId ? getDemoInventoryMovementsOverview(companyId) : null;
}

export async function createInventoryMovement(
  companyId: string | undefined,
  input: CreateInventoryMovementRequestContract,
  options: RequestOptions
): Promise<ApiResult<InventoryMovementContract>> {
  const payload = CreateInventoryMovementRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoInventoryMovement(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/inventory/movements${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoInventoryMovement(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: InventoryMovementSchema.parse(response.data),
    error: null
  };
}

export async function updateInventoryMovement(
  movementId: string,
  companyId: string | undefined,
  input: UpdateInventoryMovementRequestContract,
  options: RequestOptions
): Promise<ApiResult<InventoryMovementContract>> {
  const payload = UpdateInventoryMovementRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoInventoryMovement(companyId, movementId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "INVENTORY_MOVEMENT_DEMO_NOT_FOUND",
            message: "Demo inventory movement not found.",
            details: {
              movementId,
              companyId
            }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/inventory/movements/${movementId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoInventoryMovement(companyId, movementId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: InventoryMovementSchema.parse(response.data),
    error: null
  };
}

export async function fetchEquipmentOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<EquipmentOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoEquipmentOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/equipment/overview${query}`, options);
  if (response) {
    return EquipmentOverviewSchema.parse(response);
  }

  return companyId ? getDemoEquipmentOverview(companyId) : null;
}

export async function createMachineItem(
  companyId: string | undefined,
  input: CreateMachineItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<MachineItemContract>> {
  const payload = CreateMachineItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoMachineItem(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/equipment/machines${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoMachineItem(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: MachineItemSchema.parse(response.data),
    error: null
  };
}

export async function updateMachineItem(
  machineId: string,
  companyId: string | undefined,
  input: UpdateMachineItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<MachineItemContract>> {
  const payload = UpdateMachineItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoMachineItem(companyId, machineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "EQUIPMENT_DEMO_NOT_FOUND",
            message: "Demo machine not found.",
            details: {
              machineId,
              companyId
            }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/equipment/machines/${machineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoMachineItem(companyId, machineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: MachineItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchDailyLogOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<DailyLogOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoDailyLogOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/daily-log/overview${query}`, options);
  if (response) {
    return DailyLogOverviewSchema.parse(response);
  }

  return companyId ? getDemoDailyLogOverview(companyId) : null;
}

export async function createDailyLogEntry(
  companyId: string | undefined,
  input: CreateDailyLogEntryRequestContract,
  options: RequestOptions
): Promise<ApiResult<DailyLogEntryContract>> {
  const payload = CreateDailyLogEntryRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoDailyLogEntry(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/daily-log/entries${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoDailyLogEntry(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: DailyLogEntrySchema.parse(response.data),
    error: null
  };
}

export async function updateDailyLogEntry(
  entryId: string,
  companyId: string | undefined,
  input: UpdateDailyLogEntryRequestContract,
  options: RequestOptions
): Promise<ApiResult<DailyLogEntryContract>> {
  const payload = UpdateDailyLogEntryRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoDailyLogEntry(companyId, entryId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "DAILY_LOG_DEMO_NOT_FOUND",
            message: "Demo daily log not found.",
            details: {
              entryId,
              companyId
            }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/daily-log/entries/${entryId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoDailyLogEntry(companyId, entryId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: DailyLogEntrySchema.parse(response.data),
    error: null
  };
}

export async function fetchFinanceOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<FinanceOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoFinanceOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/finance/overview${query}`, options);
  if (response) {
    return FinanceOverviewSchema.parse(response);
  }

  return companyId ? getDemoFinanceOverview(companyId) : null;
}

export async function updateFinanceLedgerItem(
  ledgerId: string,
  companyId: string | undefined,
  input: UpdateFinanceLedgerItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<FinanceLedgerItemContract>> {
  const payload = UpdateFinanceLedgerItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoFinanceLedgerItem(companyId, ledgerId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "FINANCE_DEMO_NOT_FOUND",
            message: "Demo finance signal not found.",
            details: { companyId, ledgerId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/finance/items/${ledgerId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoFinanceLedgerItem(companyId, ledgerId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: FinanceLedgerItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchAccountsPayableOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<AccountsPayableOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoAccountsPayableOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/accounts-payable/overview${query}`, options);
  if (response) {
    return AccountsPayableOverviewSchema.parse(response);
  }

  return companyId ? getDemoAccountsPayableOverview(companyId) : null;
}

export async function createAccountsPayableInvoice(
  companyId: string | undefined,
  input: CreateAccountsPayableInvoiceRequestContract,
  options: RequestOptions
): Promise<ApiResult<AccountsPayableInvoiceContract>> {
  const payload = CreateAccountsPayableInvoiceRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoAccountsPayableInvoice(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/accounts-payable/invoices${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoAccountsPayableInvoice(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: AccountsPayableInvoiceSchema.parse(response.data),
    error: null
  };
}

export async function updateAccountsPayableInvoice(
  invoiceId: string,
  companyId: string | undefined,
  input: UpdateAccountsPayableInvoiceRequestContract,
  options: RequestOptions
): Promise<ApiResult<AccountsPayableInvoiceContract>> {
  const payload = UpdateAccountsPayableInvoiceRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoAccountsPayableInvoice(companyId, invoiceId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "ACCOUNTS_PAYABLE_DEMO_NOT_FOUND",
            message: "Demo accounts payable invoice not found.",
            details: { companyId, invoiceId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/accounts-payable/invoices/${invoiceId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoAccountsPayableInvoice(companyId, invoiceId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: AccountsPayableInvoiceSchema.parse(response.data),
    error: null
  };
}

export async function fetchTreasuryPaymentRunsOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<TreasuryPaymentRunsOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoTreasuryPaymentRunsOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/treasury/payment-runs/overview${query}`, options);
  if (response) {
    return TreasuryPaymentRunsOverviewSchema.parse(response);
  }

  return companyId ? getDemoTreasuryPaymentRunsOverview(companyId) : null;
}

export async function createTreasuryPaymentRun(
  companyId: string | undefined,
  input: CreateTreasuryPaymentRunRequestContract,
  options: RequestOptions
): Promise<ApiResult<TreasuryPaymentRunContract>> {
  const payload = CreateTreasuryPaymentRunRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoTreasuryPaymentRun(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/treasury/payment-runs${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoTreasuryPaymentRun(companyId, payload),
        error: null
      };
    }

    return { data: null, error: response.error };
  }

  return {
    data: TreasuryPaymentRunSchema.parse(response.data),
    error: null
  };
}

export async function updateTreasuryPaymentRun(
  paymentRunId: string,
  companyId: string | undefined,
  input: UpdateTreasuryPaymentRunRequestContract,
  options: RequestOptions
): Promise<ApiResult<TreasuryPaymentRunContract>> {
  const payload = UpdateTreasuryPaymentRunRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoTreasuryPaymentRun(companyId, paymentRunId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "TREASURY_PAYMENT_RUN_DEMO_NOT_FOUND",
            message: "Demo payment run not found.",
            details: { companyId, paymentRunId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/treasury/payment-runs/${paymentRunId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoTreasuryPaymentRun(companyId, paymentRunId, payload);
      if (fallback) {
        return { data: fallback, error: null };
      }
    }

    return { data: null, error: response.error };
  }

  return {
    data: TreasuryPaymentRunSchema.parse(response.data),
    error: null
  };
}

export async function removeTreasuryPaymentRunInvoice(
  paymentRunId: string,
  invoiceId: string,
  companyId: string | undefined,
  nextAction: string,
  options: RequestOptions
): Promise<ApiResult<TreasuryPaymentRunContract>> {
  const payload = { nextAction };
  if (companyId && !options.accessToken) {
    const updated = removeDemoTreasuryPaymentRunInvoice(companyId, paymentRunId, invoiceId, nextAction);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "TREASURY_PAYMENT_RUN_INVOICE_DEMO_NOT_FOUND",
            message: "Demo payment run invoice was not found.",
            details: { companyId, paymentRunId, invoiceId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/treasury/payment-runs/${paymentRunId}/invoices/${invoiceId}${query}`, options, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = removeDemoTreasuryPaymentRunInvoice(companyId, paymentRunId, invoiceId, nextAction);
      if (fallback) {
        return { data: fallback, error: null };
      }
    }

    return { data: null, error: response.error };
  }

  return {
    data: TreasuryPaymentRunSchema.parse(response.data),
    error: null
  };
}

export async function addTreasuryPaymentRunInvoice(
  paymentRunId: string,
  companyId: string | undefined,
  invoiceId: string,
  nextAction: string,
  options: RequestOptions
): Promise<ApiResult<TreasuryPaymentRunContract>> {
  const payload = { invoiceId, nextAction };
  if (companyId && !options.accessToken) {
    const updated = addDemoTreasuryPaymentRunInvoice(companyId, paymentRunId, invoiceId, nextAction);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "TREASURY_PAYMENT_RUN_ADD_INVOICE_DEMO_FAILED",
            message: "Demo add invoice into payment run failed.",
            details: { companyId, paymentRunId, invoiceId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/treasury/payment-runs/${paymentRunId}/invoices${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = addDemoTreasuryPaymentRunInvoice(companyId, paymentRunId, invoiceId, nextAction);
      if (fallback) {
        return { data: fallback, error: null };
      }
    }

    return { data: null, error: response.error };
  }

  return {
    data: TreasuryPaymentRunSchema.parse(response.data),
    error: null
  };
}

export async function moveTreasuryPaymentRunInvoice(
  sourcePaymentRunId: string,
  invoiceId: string,
  companyId: string | undefined,
  targetPaymentRunId: string,
  nextAction: string,
  options: RequestOptions
): Promise<ApiResult<TreasuryPaymentRunContract>> {
  const payload = { targetPaymentRunId, nextAction };
  if (companyId && !options.accessToken) {
    const updated = moveDemoTreasuryPaymentRunInvoice(companyId, sourcePaymentRunId, invoiceId, targetPaymentRunId, nextAction);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "TREASURY_PAYMENT_RUN_MOVE_INVOICE_DEMO_FAILED",
            message: "Demo move invoice between payment runs failed.",
            details: { companyId, sourcePaymentRunId, invoiceId, targetPaymentRunId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(
    `/treasury/payment-runs/${sourcePaymentRunId}/invoices/${invoiceId}/move${query}`,
    options,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  if (!response.data) {
    if (companyId) {
      const fallback = moveDemoTreasuryPaymentRunInvoice(companyId, sourcePaymentRunId, invoiceId, targetPaymentRunId, nextAction);
      if (fallback) {
        return { data: fallback, error: null };
      }
    }

    return { data: null, error: response.error };
  }

  return {
    data: TreasuryPaymentRunSchema.parse(response.data),
    error: null
  };
}

export async function fetchEstimationCollectionOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<EstimationCollectionOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoEstimationCollectionOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/estimations/overview${query}`, options);
  if (response) {
    return EstimationCollectionOverviewSchema.parse(response);
  }

  return companyId ? getDemoEstimationCollectionOverview(companyId) : null;
}

export async function updateEstimationCollectionLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateEstimationCollectionLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<EstimationCollectionLineContract>> {
  const payload = UpdateEstimationCollectionLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoEstimationCollectionLine(companyId, lineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "ESTIMATION_DEMO_NOT_FOUND",
            message: "Demo estimation line not found.",
            details: { companyId, lineId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/estimations/lines/${lineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoEstimationCollectionLine(companyId, lineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: EstimationCollectionLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchCrmOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CrmOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoCrmOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/crm/overview${query}`, options);
  if (response) {
    return CrmOverviewSchema.parse(response);
  }

  return companyId ? getDemoCrmOverview(companyId) : null;
}

export async function updateCrmLeadBucket(
  leadBucketId: string,
  companyId: string | undefined,
  input: UpdateCrmLeadBucketRequestContract,
  options: RequestOptions
): Promise<ApiResult<CrmLeadBucketContract>> {
  const payload = UpdateCrmLeadBucketRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoCrmLeadBucket(companyId, leadBucketId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "CRM_DEMO_NOT_FOUND",
            message: "Demo CRM bucket not found.",
            details: { companyId, leadBucketId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/crm/lead-buckets/${leadBucketId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoCrmLeadBucket(companyId, leadBucketId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CrmLeadBucketSchema.parse(response.data),
    error: null
  };
}

export async function fetchComplianceOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ComplianceOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoComplianceOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/compliance/overview${query}`, options);
  if (response) {
    return ComplianceOverviewSchema.parse(response);
  }

  return companyId ? getDemoComplianceOverview(companyId) : null;
}

export async function updateComplianceCase(
  caseId: string,
  companyId: string | undefined,
  input: UpdateComplianceCaseRequestContract,
  options: RequestOptions
): Promise<ApiResult<ComplianceCaseContract>> {
  const payload = UpdateComplianceCaseRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoComplianceCase(companyId, caseId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "COMPLIANCE_DEMO_NOT_FOUND",
            message: "Demo compliance case not found.",
            details: { companyId, caseId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/compliance/cases/${caseId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoComplianceCase(companyId, caseId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: ComplianceCaseSchema.parse(response.data),
    error: null
  };
}

export async function fetchPostSaleOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<PostSaleOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoPostSaleOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/post-sale/overview${query}`, options);
  if (response) {
    return PostSaleOverviewSchema.parse(response);
  }

  return companyId ? getDemoPostSaleOverview(companyId) : null;
}

export async function updatePostSaleCase(
  caseId: string,
  companyId: string | undefined,
  input: UpdatePostSaleCaseRequestContract,
  options: RequestOptions
): Promise<ApiResult<PostSaleCaseContract>> {
  const payload = UpdatePostSaleCaseRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoPostSaleCase(companyId, caseId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "POST_SALE_DEMO_NOT_FOUND",
            message: "Demo post-sale case not found.",
            details: { companyId, caseId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/post-sale/cases/${caseId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoPostSaleCase(companyId, caseId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: PostSaleCaseSchema.parse(response.data),
    error: null
  };
}

export async function fetchIntegrationOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<IntegrationOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/integrations/overview${query}`, options);
  return response ? IntegrationOverviewSchema.parse(response) : null;
}

export async function updateIntegrationStream(
  streamId: string,
  companyId: string | undefined,
  input: UpdateIntegrationStreamRequestContract,
  options: RequestOptions
): Promise<ApiResult<IntegrationStreamContract>> {
  const payload = UpdateIntegrationStreamRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/integrations/streams/${streamId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: IntegrationStreamSchema.parse(response.data),
    error: null
  };
}

export async function fetchDocumentControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<DocumentControlOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoDocumentControlOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/document-control/overview${query}`, options);
  if (response) {
    return DocumentControlOverviewSchema.parse(response);
  }

  return companyId ? getDemoDocumentControlOverview(companyId) : null;
}

export async function createDocumentControlItem(
  companyId: string | undefined,
  input: CreateDocumentControlItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<DocumentControlItemContract>> {
  const payload = CreateDocumentControlItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoDocumentControlItem(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/document-control/items${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoDocumentControlItem(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: DocumentControlItemSchema.parse(response.data),
    error: null
  };
}

export async function updateDocumentControlItem(
  itemId: string,
  companyId: string | undefined,
  input: UpdateDocumentControlItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<DocumentControlItemContract>> {
  const payload = UpdateDocumentControlItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoDocumentControlItem(companyId, itemId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "DOCUMENT_CONTROL_DEMO_NOT_FOUND",
            message: "Demo document item not found.",
            details: {
              itemId,
              companyId
            }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/document-control/items/${itemId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoDocumentControlItem(companyId, itemId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: DocumentControlItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchQualityOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<QualityOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoQualityOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/quality/overview${query}`, options);
  if (response) {
    return QualityOverviewSchema.parse(response);
  }

  return companyId ? getDemoQualityOverview(companyId) : null;
}

export async function updateQualityInspection(
  inspectionId: string,
  companyId: string | undefined,
  input: UpdateQualityInspectionRequestContract,
  options: RequestOptions
): Promise<ApiResult<QualityInspectionContract>> {
  const payload = UpdateQualityInspectionRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoQualityInspection(companyId, inspectionId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "QUALITY_DEMO_NOT_FOUND",
            message: "Demo quality inspection not found.",
            details: { companyId, inspectionId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/quality/inspections/${inspectionId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoQualityInspection(companyId, inspectionId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: QualityInspectionSchema.parse(response.data),
    error: null
  };
}

export async function createQualityInspection(
  companyId: string | undefined,
  input: CreateQualityInspectionRequestContract,
  options: RequestOptions
): Promise<ApiResult<QualityInspectionContract>> {
  const payload = CreateQualityInspectionRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoQualityInspection(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/quality/inspections${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoQualityInspection(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: QualityInspectionSchema.parse(response.data),
    error: null
  };
}

export async function fetchHrOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<HrOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoHrOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/hr/overview${query}`, options);
  if (response) {
    return HrOverviewSchema.parse(response);
  }

  return companyId ? getDemoHrOverview(companyId) : null;
}

export async function updateHrWorkforceItem(
  workforceId: string,
  companyId: string | undefined,
  input: UpdateHrWorkforceItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<HrWorkforceItemContract>> {
  const payload = UpdateHrWorkforceItemRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoHrWorkforceItem(companyId, workforceId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "HR_WORKFORCE_DEMO_NOT_FOUND",
            message: "Demo workforce item not found.",
            details: { companyId, workforceId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/hr/workforces/${workforceId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoHrWorkforceItem(companyId, workforceId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: HrWorkforceItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchSubcontractOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<SubcontractOverviewContract | null> {
  if (companyId && !options.accessToken) {
    return getDemoSubcontractOverview(companyId);
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/subcontracts/overview${query}`, options);
  if (response) {
    return SubcontractOverviewSchema.parse(response);
  }

  return companyId ? getDemoSubcontractOverview(companyId) : null;
}

export async function createSubcontractLine(
  companyId: string | undefined,
  input: CreateSubcontractLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<SubcontractLineContract>> {
  const payload = CreateSubcontractLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    return {
      data: createDemoSubcontractLine(companyId, payload),
      error: null
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/subcontracts/lines${query}`, options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      return {
        data: createDemoSubcontractLine(companyId, payload),
        error: null
      };
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: SubcontractLineSchema.parse(response.data),
    error: null
  };
}

export async function updateSubcontractLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateSubcontractLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<SubcontractLineContract>> {
  const payload = UpdateSubcontractLineRequestSchema.parse(input);
  if (companyId && !options.accessToken) {
    const updated = updateDemoSubcontractLine(companyId, lineId, payload);
    return {
      data: updated,
      error: updated
        ? null
        : {
            code: "SUBCONTRACT_DEMO_NOT_FOUND",
            message: "Demo subcontract line not found.",
            details: { companyId, lineId }
          }
    };
  }

  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/subcontracts/lines/${lineId}${query}`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    if (companyId) {
      const fallback = updateDemoSubcontractLine(companyId, lineId, payload);
      if (fallback) {
        return {
          data: fallback,
          error: null
        };
      }
    }

    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: SubcontractLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchUserDetail(
  userId: string,
  options: RequestOptions
): Promise<ApiResult<PlatformUserDetailContract>> {
  const response = await requestResult(`/platform/users/${userId}`, options);

  if (!response.data) {
    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: PlatformUserDetailSchema.parse(response.data),
    error: null
  };
}

export async function createPlatformUser(
  input: CreatePlatformUserRequestContract,
  options: RequestOptions
): Promise<ApiResult<CreatePlatformUserResponseContract>> {
  const payload = CreatePlatformUserRequestSchema.parse(input);
  const response = await requestResult("/platform/users", options, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CreatePlatformUserResponseSchema.parse(response.data),
    error: null
  };
}

export async function updatePlatformUserRole(
  userId: string,
  input: UpdatePlatformUserRoleRequestContract,
  options: RequestOptions
): Promise<ApiResult<CreatePlatformUserResponseContract>> {
  const payload = UpdatePlatformUserRoleRequestSchema.parse(input);
  const response = await requestResult(`/platform/users/${userId}/role`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CreatePlatformUserResponseSchema.parse(response.data),
    error: null
  };
}

export async function updatePlatformUserStatus(
  userId: string,
  input: UpdatePlatformUserStatusRequestContract,
  options: RequestOptions
): Promise<ApiResult<CreatePlatformUserResponseContract>> {
  const payload = UpdatePlatformUserStatusRequestSchema.parse(input);
  const response = await requestResult(`/platform/users/${userId}/status`, options, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.data) {
    return {
      data: null,
      error: response.error
    };
  }

  return {
    data: CreatePlatformUserResponseSchema.parse(response.data),
    error: null
  };
}
