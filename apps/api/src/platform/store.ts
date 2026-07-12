import {
  defaultRoles,
  moduleCatalog,
  type AuthSessionContract,
  type CompanyContract,
  type PlatformSettingsContract,
  type UserContract
} from "../../../../packages/contracts/dist/index.js";

const companies: CompanyContract[] = [
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
      "finance.accounting"
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
  }
];

const users: UserContract[] = [
  {
    id: "usr_platform_owner",
    companyId: "cmp_arcont_demo",
    fullName: "Angel Platform Owner",
    email: "admin@arcont.local",
    roleKey: "platform-owner",
    status: "active"
  },
  {
    id: "usr_ops_manager",
    companyId: "cmp_bienestar_gov",
    fullName: "Daniel Obra",
    email: "obra@arcont.local",
    roleKey: "operations-manager",
    status: "active"
  }
];

const settings: PlatformSettingsContract[] = [
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

export function listCompanies(): CompanyContract[] {
  return companies;
}

export function listModules() {
  return moduleCatalog;
}

export function listUsers(companyId?: string): UserContract[] {
  if (!companyId) {
    return users;
  }

  return users.filter((user) => user.companyId === companyId);
}

export function listRoles() {
  return defaultRoles;
}

export function getSettings(companyId: string): PlatformSettingsContract | undefined {
  return settings.find((item) => item.companyId === companyId);
}

export function createSession(email: string, companyId?: string): AuthSessionContract | undefined {
  const user = users.find((item) => item.email === email);
  if (!user) {
    return undefined;
  }

  const company =
    companies.find((item) => item.id === (companyId ?? user.companyId)) ??
    companies.find((item) => item.id === user.companyId);

  if (!company) {
    return undefined;
  }

  const role = defaultRoles.find((item) => item.key === user.roleKey);

  return {
    accessToken: `demo-access-${user.id}`,
    refreshToken: `demo-refresh-${user.id}`,
    company,
    user,
    permissions: role?.permissions ?? []
  };
}
