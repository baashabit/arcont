import {
  defaultRoles,
  moduleCatalog,
  type AuthSessionContract,
  type CompanyContract,
  type CompanyModuleStateContract,
  type ModuleContract,
  type PlatformBootstrapContract,
  type PlatformSettingsContract,
  type RoleContract,
  type UserContract
} from "@/lib/contracts";

export type AppDataSource = "api" | "mock";

export type AppSession = {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresInSeconds?: number;
  authenticated: boolean;
  companyId: string;
  user: UserContract;
  permissions: string[];
};

export type AppData = {
  source: AppDataSource;
  apiBaseUrl: string;
  companies: CompanyContract[];
  modules: ModuleContract[];
  roles: RoleContract[];
  users: UserContract[];
  settings: Record<string, PlatformSettingsContract>;
  companyModules: Record<string, CompanyModuleStateContract[]>;
  session: AppSession;
};

const apiBaseUrl =
  process.env.ARCONT_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

const mockCompanies: CompanyContract[] = [
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
      "procurement.purchasing",
      "inventory.warehouse",
      "finance.accounting",
      "compliance.postsale"
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
      "procurement.purchasing",
      "inventory.warehouse",
      "hr.workforce",
      "integrations.field-data"
    ]
  },
  {
    id: "cmp_vivienda_litoral",
    legalName: "Vivienda Litoral S. de R.L. de C.V.",
    tradeName: "Vivienda Litoral",
    countryCode: "MX",
    taxId: "VLS240101CCC",
    status: "draft",
    enabledModules: ["platform.companies", "platform.identity", "sales.crm", "finance.accounting"]
  }
];

const mockUsers: UserContract[] = [
  {
    id: "usr_platform_owner",
    companyId: "cmp_arcont_demo",
    fullName: "Angel Platform Owner",
    email: "admin@arcont.local",
    roleKey: "platform-owner",
    status: "active"
  },
  {
    id: "usr_commercial_lead",
    companyId: "cmp_arcont_demo",
    fullName: "Mariana Comercial",
    email: "mariana@arcont.local",
    roleKey: "operations-manager",
    status: "active"
  },
  {
    id: "usr_jobsite_manager",
    companyId: "cmp_bienestar_gov",
    fullName: "Daniel Obra",
    email: "obra@arcont.local",
    roleKey: "operations-manager",
    status: "active"
  },
  {
    id: "usr_finance_admin",
    companyId: "cmp_vivienda_litoral",
    fullName: "Lucia Finanzas",
    email: "lucia@arcont.local",
    roleKey: "company-admin",
    status: "invited"
  }
];

const mockSettingsList: PlatformSettingsContract[] = [
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
  },
  {
    companyId: "cmp_vivienda_litoral",
    timezone: "America/Cancun",
    locale: "es-MX",
    currency: "MXN",
    fiscalCountry: "MX",
    satEnabled: false,
    fiscalRegime: "612"
  }
];

export const mockCredentials = [
  {
    email: "admin@arcont.local",
    password: "password123",
    companyId: "cmp_arcont_demo"
  },
  {
    email: "obra@arcont.local",
    password: "password123",
    companyId: "cmp_bienestar_gov"
  }
] as const;

function buildSettingsMap(items: PlatformSettingsContract[]) {
  return Object.fromEntries(items.map((item) => [item.companyId, item]));
}

function buildCompanyModules(companies: CompanyContract[], modules: ModuleContract[]) {
  return Object.fromEntries(
    companies.map((company) => [
      company.id,
      modules.map((module) => ({
        companyId: company.id,
        module,
        enabled: company.enabledModules.includes(module.key)
      }))
    ])
  );
}

async function requestJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      next: { revalidate: 60 }
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getRolePermissions(roles: RoleContract[], roleKey: string) {
  return roles.find((role) => role.key === roleKey)?.permissions ?? [];
}

export function authSessionToAppSession(session: AuthSessionContract): AppSession {
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    tokenType: session.tokenType,
    expiresInSeconds: session.expiresInSeconds,
    authenticated: true,
    companyId: session.company.id,
    user: session.user,
    permissions: session.permissions
  };
}

export function bootstrapToPartialAppData(bootstrap: PlatformBootstrapContract) {
  return {
    company: bootstrap.company,
    settings: bootstrap.settings,
    roles: bootstrap.roles,
    users: bootstrap.companyUsers,
    modules: bootstrap.availableModules,
    companyModules: bootstrap.companyModules,
    session: {
      companyId: bootstrap.company.id,
      user: bootstrap.user,
      permissions: bootstrap.permissions
    }
  };
}

export function buildMockData(): AppData {
  const company = mockCompanies[0];
  const user = mockUsers.find((item) => item.companyId === company.id) ?? mockUsers[0];
  const roles = defaultRoles;

  return {
    source: "mock",
    apiBaseUrl,
    companies: mockCompanies,
    modules: moduleCatalog,
    roles,
    users: mockUsers,
    settings: buildSettingsMap(mockSettingsList),
    companyModules: buildCompanyModules(mockCompanies, moduleCatalog),
    session: {
      authenticated: false,
      companyId: company.id,
      user,
      permissions: getRolePermissions(roles, user.roleKey)
    }
  };
}

export function getMockSession(email: string, password: string, companyId?: string): AuthSessionContract | null {
  const matched = mockCredentials.find(
    (credential) =>
      credential.email === email &&
      credential.password === password &&
      (companyId ? credential.companyId === companyId : true)
  );

  if (!matched) {
    return null;
  }

  const company =
    mockCompanies.find((item) => item.id === (companyId ?? matched.companyId)) ?? mockCompanies[0];
  const user = mockUsers.find((item) => item.email === email) ?? mockUsers[0];
  const permissions = getRolePermissions(defaultRoles, user.roleKey);

  return {
    accessToken: `mock-access-${user.id}`,
    refreshToken: `mock-refresh-${user.id}`,
    tokenType: "Bearer",
    expiresInSeconds: 3600,
    company,
    user,
    permissions
  };
}

export async function loadAppData(): Promise<AppData> {
  const [companiesResponse, modulesResponse, rolesResponse, usersResponse] = await Promise.all([
    requestJson<{ items: CompanyContract[] }>("/platform/companies"),
    requestJson<{ items: ModuleContract[] }>("/platform/modules"),
    requestJson<{ items: RoleContract[] }>("/platform/roles"),
    requestJson<{ items: UserContract[] }>("/platform/users")
  ]);

  if (!companiesResponse || !modulesResponse || !rolesResponse || !usersResponse) {
    return buildMockData();
  }

  const companies = companiesResponse.items;
  const modules = modulesResponse.items;
  const roles = rolesResponse.items;
  const settingsEntries = await Promise.all(
    companies.map(async (company) => {
      const settings = await requestJson<PlatformSettingsContract>(`/platform/settings/${company.id}`);
      return settings ? [company.id, settings] : null;
    })
  );

  const firstCompany = companies[0];
  const users = usersResponse.items;
  const currentUser = users.find((item) => item.companyId === firstCompany.id) ?? users[0];

  if (!firstCompany || !currentUser) {
    return buildMockData();
  }

  return {
    source: "api",
    apiBaseUrl,
    companies,
    modules,
    roles,
    users,
    settings: Object.fromEntries(
      settingsEntries.filter((entry): entry is [string, PlatformSettingsContract] => Boolean(entry))
    ),
    companyModules: buildCompanyModules(companies, modules),
    session: {
      authenticated: false,
      companyId: firstCompany.id,
      user: currentUser,
      permissions: getRolePermissions(roles, currentUser.roleKey)
    }
  };
}
