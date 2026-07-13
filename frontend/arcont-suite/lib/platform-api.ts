import {
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
  ComplianceCaseSchema,
  ComplianceOverviewSchema,
  CostControlLineSchema,
  CostControlOverviewSchema,
  CrmLeadBucketSchema,
  CrmOverviewSchema,
  CompanyDetailSchema,
  CompanyModuleStateSchema,
  CompanySchema,
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
  ProcurementRequisitionSchema,
  ProcurementRequisitionsOverviewSchema,
  ProjectPortfolioItemSchema,
  ProjectPortfolioOverviewSchema,
  QualityInspectionSchema,
  QualityOverviewSchema,
  PlatformUserDetailSchema,
  RoleSchema,
  SubcontractLineSchema,
  SubcontractOverviewSchema,
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
  UpdateProcurementPackageRequestSchema,
  UpdateProcurementRequisitionRequestSchema,
  UpdatePlatformUserRoleRequestSchema,
  UpdatePlatformUserStatusRequestSchema,
  UpdateBudgetBookLineRequestSchema,
  UpdateCashFlowLineRequestSchema,
  UpdateCloseControlLineRequestSchema,
  UpdateSupplierControlLineRequestSchema,
  UpdateDailyLogEntryRequestSchema,
  UpdateQualityInspectionRequestSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema,
  UserSchema,
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
  type ComplianceCaseContract,
  type ComplianceOverviewContract,
  type CostControlLineContract,
  type CostControlOverviewContract,
  type CrmLeadBucketContract,
  type CrmOverviewContract,
  type CompanyDetailContract,
  type CompanyModuleStateContract,
  type CompanyContract,
  type CreatePlatformUserRequestContract,
  type CreatePlatformUserResponseContract,
  type DailyLogEntryContract,
  type DailyLogOverviewContract,
  type DocumentControlItemContract,
  type DocumentControlOverviewContract,
  type EquipmentOverviewContract,
  type EstimationCollectionLineContract,
  type EstimationCollectionOverviewContract,
  type FinanceLedgerItemContract,
  type FinanceOverviewContract,
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
  type PlatformSettingsContract,
  type ProvisionCompanyRequestContract,
  type ProvisionCompanyResponseContract,
  type ProcurementOverviewContract,
  type ProcurementPackageContract,
  type ProcurementRequisitionContract,
  type ProcurementRequisitionsOverviewContract,
  type ProjectPortfolioItemContract,
  type ProjectPortfolioOverviewContract,
  type QualityInspectionContract,
  type QualityOverviewContract,
  type PlatformUserDetailContract,
  type RoleContract,
  type SubcontractLineContract,
  type SubcontractOverviewContract,
  type UpdateComplianceCaseRequestContract,
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
  type UpdateProcurementPackageRequestContract,
  type UpdateProcurementRequisitionRequestContract,
  type UpdatePlatformUserRoleRequestContract,
  type UpdatePlatformUserStatusRequestContract,
  type UpdateBudgetBookLineRequestContract,
  type UpdateCashFlowLineRequestContract,
  type UpdateCloseControlLineRequestContract,
  type UpdateSupplierControlLineRequestContract,
  type UpdateDailyLogEntryRequestContract,
  type UpdateQualityInspectionRequestContract,
  type UpdateCompanyModulesRequestContract,
  type UpdatePlatformSettingsRequestContract,
  type UpdateSubcontractLineRequestContract,
  type UserContract
} from "@/lib/contracts";

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
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/projects/overview${query}`, options);
  return response ? ProjectPortfolioOverviewSchema.parse(response) : null;
}

export async function updateProjectPortfolioItem(
  projectId: string,
  companyId: string | undefined,
  input: UpdateProjectPortfolioItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProjectPortfolioItemContract>> {
  const payload = UpdateProjectPortfolioItemRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/projects/items/${projectId}${query}`, options, {
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
    data: ProjectPortfolioItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchProcurementOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProcurementOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/procurement/overview${query}`, options);
  return response ? ProcurementOverviewSchema.parse(response) : null;
}

export async function updateProcurementPackage(
  packageId: string,
  companyId: string | undefined,
  input: UpdateProcurementPackageRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProcurementPackageContract>> {
  const payload = UpdateProcurementPackageRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/procurement/packages/${packageId}${query}`, options, {
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
    data: ProcurementPackageSchema.parse(response.data),
    error: null
  };
}

export async function fetchProcurementRequisitionsOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProcurementRequisitionsOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/procurement/requisitions/overview${query}`, options);
  return response ? ProcurementRequisitionsOverviewSchema.parse(response) : null;
}

export async function updateProcurementRequisition(
  requisitionId: string,
  companyId: string | undefined,
  input: UpdateProcurementRequisitionRequestContract,
  options: RequestOptions
): Promise<ApiResult<ProcurementRequisitionContract>> {
  const payload = UpdateProcurementRequisitionRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/procurement/requisitions/${requisitionId}${query}`, options, {
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
    data: ProcurementRequisitionSchema.parse(response.data),
    error: null
  };
}

export async function fetchBudgetBookOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<BudgetBookOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/budget-book/overview${query}`, options);
  return response ? BudgetBookOverviewSchema.parse(response) : null;
}

export async function updateBudgetBookLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateBudgetBookLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<BudgetBookLineContract>> {
  const payload = UpdateBudgetBookLineRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/budget-book/lines/${lineId}${query}`, options, {
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
    data: BudgetBookLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchCashFlowOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CashFlowOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/cash-flow/overview${query}`, options);
  return response ? CashFlowOverviewSchema.parse(response) : null;
}

export async function updateCashFlowLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateCashFlowLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<CashFlowLineContract>> {
  const payload = UpdateCashFlowLineRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/cash-flow/lines/${lineId}${query}`, options, {
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
    data: CashFlowLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchCloseControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CloseControlOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/close-control/overview${query}`, options);
  return response ? CloseControlOverviewSchema.parse(response) : null;
}

export async function updateCloseControlLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateCloseControlLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<CloseControlLineContract>> {
  const payload = UpdateCloseControlLineRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/close-control/lines/${lineId}${query}`, options, {
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
    data: CloseControlLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchSupplierControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<SupplierControlOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/supplier-control/overview${query}`, options);
  return response ? SupplierControlOverviewSchema.parse(response) : null;
}

export async function updateSupplierControlLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateSupplierControlLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<SupplierControlLineContract>> {
  const payload = UpdateSupplierControlLineRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/supplier-control/lines/${lineId}${query}`, options, {
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
    data: SupplierControlLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchCostControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CostControlOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/cost-control/overview${query}`, options);
  return response ? CostControlOverviewSchema.parse(response) : null;
}

export async function updateCostControlLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateCostControlLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<CostControlLineContract>> {
  const payload = UpdateCostControlLineRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/cost-control/lines/${lineId}${query}`, options, {
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
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/inventory/receiving/overview${query}`, options);
  return response ? InventoryReceivingOverviewSchema.parse(response) : null;
}

export async function updateInventoryReceipt(
  receiptId: string,
  companyId: string | undefined,
  input: UpdateInventoryReceiptRequestContract,
  options: RequestOptions
): Promise<ApiResult<InventoryReceiptContract>> {
  const payload = UpdateInventoryReceiptRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/inventory/receipts/${receiptId}${query}`, options, {
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
    data: InventoryReceiptSchema.parse(response.data),
    error: null
  };
}

export async function fetchInventoryMovementsOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<InventoryMovementsOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/inventory/movements/overview${query}`, options);
  return response ? InventoryMovementsOverviewSchema.parse(response) : null;
}

export async function updateInventoryMovement(
  movementId: string,
  companyId: string | undefined,
  input: UpdateInventoryMovementRequestContract,
  options: RequestOptions
): Promise<ApiResult<InventoryMovementContract>> {
  const payload = UpdateInventoryMovementRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/inventory/movements/${movementId}${query}`, options, {
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
    data: InventoryMovementSchema.parse(response.data),
    error: null
  };
}

export async function fetchEquipmentOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<EquipmentOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/equipment/overview${query}`, options);
  return response ? EquipmentOverviewSchema.parse(response) : null;
}

export async function updateMachineItem(
  machineId: string,
  companyId: string | undefined,
  input: UpdateMachineItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<MachineItemContract>> {
  const payload = UpdateMachineItemRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/equipment/machines/${machineId}${query}`, options, {
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
    data: MachineItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchDailyLogOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<DailyLogOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/daily-log/overview${query}`, options);
  return response ? DailyLogOverviewSchema.parse(response) : null;
}

export async function updateDailyLogEntry(
  entryId: string,
  companyId: string | undefined,
  input: UpdateDailyLogEntryRequestContract,
  options: RequestOptions
): Promise<ApiResult<DailyLogEntryContract>> {
  const payload = UpdateDailyLogEntryRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/daily-log/entries/${entryId}${query}`, options, {
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
    data: DailyLogEntrySchema.parse(response.data),
    error: null
  };
}

export async function fetchFinanceOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<FinanceOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/finance/overview${query}`, options);
  return response ? FinanceOverviewSchema.parse(response) : null;
}

export async function updateFinanceLedgerItem(
  ledgerId: string,
  companyId: string | undefined,
  input: UpdateFinanceLedgerItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<FinanceLedgerItemContract>> {
  const payload = UpdateFinanceLedgerItemRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/finance/items/${ledgerId}${query}`, options, {
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
    data: FinanceLedgerItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchEstimationCollectionOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<EstimationCollectionOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/estimations/overview${query}`, options);
  return response ? EstimationCollectionOverviewSchema.parse(response) : null;
}

export async function updateEstimationCollectionLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateEstimationCollectionLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<EstimationCollectionLineContract>> {
  const payload = UpdateEstimationCollectionLineRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/estimations/lines/${lineId}${query}`, options, {
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
    data: EstimationCollectionLineSchema.parse(response.data),
    error: null
  };
}

export async function fetchCrmOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CrmOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/crm/overview${query}`, options);
  return response ? CrmOverviewSchema.parse(response) : null;
}

export async function updateCrmLeadBucket(
  leadBucketId: string,
  companyId: string | undefined,
  input: UpdateCrmLeadBucketRequestContract,
  options: RequestOptions
): Promise<ApiResult<CrmLeadBucketContract>> {
  const payload = UpdateCrmLeadBucketRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/crm/lead-buckets/${leadBucketId}${query}`, options, {
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
    data: CrmLeadBucketSchema.parse(response.data),
    error: null
  };
}

export async function fetchComplianceOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ComplianceOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/compliance/overview${query}`, options);
  return response ? ComplianceOverviewSchema.parse(response) : null;
}

export async function updateComplianceCase(
  caseId: string,
  companyId: string | undefined,
  input: UpdateComplianceCaseRequestContract,
  options: RequestOptions
): Promise<ApiResult<ComplianceCaseContract>> {
  const payload = UpdateComplianceCaseRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/compliance/cases/${caseId}${query}`, options, {
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
    data: ComplianceCaseSchema.parse(response.data),
    error: null
  };
}

export async function fetchPostSaleOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<PostSaleOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/post-sale/overview${query}`, options);
  return response ? PostSaleOverviewSchema.parse(response) : null;
}

export async function updatePostSaleCase(
  caseId: string,
  companyId: string | undefined,
  input: UpdatePostSaleCaseRequestContract,
  options: RequestOptions
): Promise<ApiResult<PostSaleCaseContract>> {
  const payload = UpdatePostSaleCaseRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/post-sale/cases/${caseId}${query}`, options, {
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
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/document-control/overview${query}`, options);
  return response ? DocumentControlOverviewSchema.parse(response) : null;
}

export async function updateDocumentControlItem(
  itemId: string,
  companyId: string | undefined,
  input: UpdateDocumentControlItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<DocumentControlItemContract>> {
  const payload = UpdateDocumentControlItemRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/document-control/items/${itemId}${query}`, options, {
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
    data: DocumentControlItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchQualityOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<QualityOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/quality/overview${query}`, options);
  return response ? QualityOverviewSchema.parse(response) : null;
}

export async function updateQualityInspection(
  inspectionId: string,
  companyId: string | undefined,
  input: UpdateQualityInspectionRequestContract,
  options: RequestOptions
): Promise<ApiResult<QualityInspectionContract>> {
  const payload = UpdateQualityInspectionRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/quality/inspections/${inspectionId}${query}`, options, {
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
    data: QualityInspectionSchema.parse(response.data),
    error: null
  };
}

export async function fetchHrOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<HrOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/hr/overview${query}`, options);
  return response ? HrOverviewSchema.parse(response) : null;
}

export async function updateHrWorkforceItem(
  workforceId: string,
  companyId: string | undefined,
  input: UpdateHrWorkforceItemRequestContract,
  options: RequestOptions
): Promise<ApiResult<HrWorkforceItemContract>> {
  const payload = UpdateHrWorkforceItemRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/hr/workforces/${workforceId}${query}`, options, {
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
    data: HrWorkforceItemSchema.parse(response.data),
    error: null
  };
}

export async function fetchSubcontractOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<SubcontractOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/subcontracts/overview${query}`, options);
  return response ? SubcontractOverviewSchema.parse(response) : null;
}

export async function updateSubcontractLine(
  lineId: string,
  companyId: string | undefined,
  input: UpdateSubcontractLineRequestContract,
  options: RequestOptions
): Promise<ApiResult<SubcontractLineContract>> {
  const payload = UpdateSubcontractLineRequestSchema.parse(input);
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestResult(`/subcontracts/lines/${lineId}${query}`, options, {
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
