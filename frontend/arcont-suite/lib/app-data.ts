import "server-only";

import {
  defaultRoles,
  moduleCatalog,
  type CompanyContract,
  type ModuleContract,
  type PlatformSettingsContract,
  type RoleContract,
  type UserContract
} from "@/lib/contracts";

export type AppDataSource = "api" | "mock";

export type AppSession = {
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
  session: AppSession;
};

const apiBaseUrl =
  process.env.ARCONT_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001";

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

function buildSettingsMap(items: PlatformSettingsContract[]) {
  return Object.fromEntries(items.map((item) => [item.companyId, item]));
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

function getRolePermissions(roleKey: string) {
  return defaultRoles.find((role) => role.key === roleKey)?.permissions ?? [];
}

function buildMockData(): AppData {
  const company = mockCompanies[0];
  const user = mockUsers.find((item) => item.companyId === company.id) ?? mockUsers[0];

  return {
    source: "mock",
    apiBaseUrl,
    companies: mockCompanies,
    modules: moduleCatalog,
    roles: defaultRoles,
    users: mockUsers,
    settings: buildSettingsMap(mockSettingsList),
    session: {
      companyId: company.id,
      user,
      permissions: getRolePermissions(user.roleKey)
    }
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
    modules: modulesResponse.items,
    roles: rolesResponse.items,
    users,
    settings: Object.fromEntries(
      settingsEntries.filter((entry): entry is [string, PlatformSettingsContract] => Boolean(entry))
    ),
    session: {
      companyId: firstCompany.id,
      user: currentUser,
      permissions: getRolePermissions(currentUser.roleKey)
    }
  };
}
