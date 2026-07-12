import {
  AuditEventSchema,
  AuthSessionSchema,
  CompanyDetailSchema,
  CompanyModuleStateSchema,
  CompanySchema,
  ModuleSchema,
  PlatformBootstrapSchema,
  PlatformDashboardSummarySchema,
  PlatformSettingsSchema,
  RoleSchema,
  UpdateCompanyModulesRequestSchema,
  UpdatePlatformSettingsRequestSchema,
  UserSchema,
  type AuditEventContract,
  type AuthLoginRequestContract,
  type AuthSessionContract,
  type CompanyDetailContract,
  type CompanyModuleStateContract,
  type CompanyContract,
  type ModuleContract,
  type PlatformBootstrapContract,
  type PlatformDashboardSummaryContract,
  type PlatformSettingsContract,
  type RoleContract,
  type UpdateCompanyModulesRequestContract,
  type UpdatePlatformSettingsRequestContract,
  type UserContract
} from "@/lib/contracts";

type RequestOptions = {
  apiBaseUrl: string;
  accessToken?: string;
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
