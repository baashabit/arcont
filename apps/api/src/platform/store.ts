import {
  defaultRoles,
  moduleCatalog
} from "../../../../packages/contracts/dist/index.js";

const companies = [
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

const users = [
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

const settings = [
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

export function listCompanies() {
  return companies;
}

export function listModules() {
  return moduleCatalog;
}

export function listUsers(companyId?: string) {
  if (!companyId) {
    return users;
  }

  return users.filter((user) => user.companyId === companyId);
}

export function listRoles() {
  return defaultRoles;
}

export function listCompanyModules(companyId: string) {
  const company = companies.find((item) => item.id === companyId);

  if (!company) {
    return [];
  }

  return moduleCatalog.map((module) => ({
    companyId,
    module,
    enabled: company.enabledModules.includes(module.key)
  }));
}

export function getSettings(companyId: string) {
  return settings.find((item) => item.companyId === companyId);
}

export function getPlatformBootstrap(
  companyId: string,
  userEmail?: string
) {
  const company = companies.find((item) => item.id === companyId);
  const companySettings = getSettings(companyId);
  const companyUsers = listUsers(companyId);

  if (!company || !companySettings || companyUsers.length === 0) {
    return undefined;
  }

  const user =
    companyUsers.find((item) => item.email === userEmail) ??
    companyUsers.find((item) => item.roleKey === "platform-owner") ??
    companyUsers[0];

  const permissions = defaultRoles.find((item) => item.key === user.roleKey)?.permissions ?? [];

  return {
    company,
    settings: companySettings,
    user,
    roles: defaultRoles,
    companyUsers,
    availableModules: moduleCatalog,
    companyModules: listCompanyModules(companyId),
    permissions
  };
}

export function createSession(email: string, companyId?: string) {
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
