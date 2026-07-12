import {
  AuditEventSchema,
  AuthSessionSchema,
  ComplianceOverviewSchema,
  CrmOverviewSchema,
  CompanyDetailSchema,
  CompanyModuleStateSchema,
  CompanySchema,
  CreatePlatformUserRequestSchema,
  CreatePlatformUserResponseSchema,
  DocumentControlOverviewSchema,
  FinanceOverviewSchema,
  HrOverviewSchema,
  IntegrationOverviewSchema,
  InventoryOverviewSchema,
  ModuleSchema,
  PlatformApiErrorSchema,
  PlatformBootstrapSchema,
  PlatformDashboardSummarySchema,
  PlatformSettingsSchema,
  ProcurementOverviewSchema,
  ProjectPortfolioOverviewSchema,
  PlatformUserDetailSchema,
  RoleSchema,
  UpdatePlatformUserRoleRequestSchema,
  UpdatePlatformUserStatusRequestSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema,
  UserSchema,
  type AuditEventContract,
  type AuthLoginRequestContract,
  type AuthSessionContract,
  type ComplianceOverviewContract,
  type CrmOverviewContract,
  type CompanyDetailContract,
  type CompanyModuleStateContract,
  type CompanyContract,
  type CreatePlatformUserRequestContract,
  type CreatePlatformUserResponseContract,
  type DocumentControlOverviewContract,
  type FinanceOverviewContract,
  type HrOverviewContract,
  type IntegrationOverviewContract,
  type InventoryOverviewContract,
  type ModuleContract,
  type PlatformApiErrorContract,
  type PlatformBootstrapContract,
  type PlatformDashboardSummaryContract,
  type PlatformSettingsContract,
  type ProcurementOverviewContract,
  type ProjectPortfolioOverviewContract,
  type PlatformUserDetailContract,
  type RoleContract,
  type UpdatePlatformUserRoleRequestContract,
  type UpdatePlatformUserStatusRequestContract,
  type UpdateCompanyModulesRequestContract,
  type UpdatePlatformSettingsRequestContract,
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

export async function fetchProcurementOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ProcurementOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/procurement/overview${query}`, options);
  return response ? ProcurementOverviewSchema.parse(response) : null;
}

export async function fetchInventoryOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<InventoryOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/inventory/overview${query}`, options);
  return response ? InventoryOverviewSchema.parse(response) : null;
}

export async function fetchFinanceOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<FinanceOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/finance/overview${query}`, options);
  return response ? FinanceOverviewSchema.parse(response) : null;
}

export async function fetchCrmOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<CrmOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/crm/overview${query}`, options);
  return response ? CrmOverviewSchema.parse(response) : null;
}

export async function fetchComplianceOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<ComplianceOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/compliance/overview${query}`, options);
  return response ? ComplianceOverviewSchema.parse(response) : null;
}

export async function fetchIntegrationOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<IntegrationOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/integrations/overview${query}`, options);
  return response ? IntegrationOverviewSchema.parse(response) : null;
}

export async function fetchDocumentControlOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<DocumentControlOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/document-control/overview${query}`, options);
  return response ? DocumentControlOverviewSchema.parse(response) : null;
}

export async function fetchHrOverview(
  companyId: string | undefined,
  options: RequestOptions
): Promise<HrOverviewContract | null> {
  const query = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const response = await requestJson(`/hr/overview${query}`, options);
  return response ? HrOverviewSchema.parse(response) : null;
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
