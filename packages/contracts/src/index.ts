import { z } from "zod";

export const moduleAreas = [
  "platform",
  "sales",
  "projects",
  "procurement",
  "inventory",
  "finance",
  "hr",
  "post_sales",
  "compliance",
  "integrations"
] as const;

export const moduleScopes = ["platform", "operations"] as const;
export const companyStatuses = ["draft", "active", "suspended"] as const;
export const userStatuses = ["invited", "active", "disabled"] as const;

export const ModuleSchema = z.object({
  key: z.string(),
  name: z.string(),
  area: z.enum(moduleAreas),
  scope: z.enum(moduleScopes),
  description: z.string(),
  enabledByDefault: z.boolean()
});

export const CompanySchema = z.object({
  id: z.string(),
  legalName: z.string(),
  tradeName: z.string(),
  countryCode: z.string(),
  taxId: z.string(),
  status: z.enum(companyStatuses),
  enabledModules: z.array(z.string())
});

export const RoleSchema = z.object({
  key: z.string(),
  name: z.string(),
  scope: z.enum(moduleScopes),
  permissions: z.array(z.string())
});

export const UserSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  fullName: z.string(),
  email: z.string().email(),
  roleKey: z.string(),
  status: z.enum(userStatuses)
});

export const PlatformSettingsSchema = z.object({
  companyId: z.string(),
  timezone: z.string(),
  locale: z.string(),
  currency: z.string(),
  fiscalCountry: z.string(),
  satEnabled: z.boolean(),
  fiscalRegime: z.string()
});

export const AuthLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyId: z.string().optional()
});

export const AuthSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  company: CompanySchema,
  user: UserSchema,
  permissions: z.array(z.string())
});

export const CompanyModuleStateSchema = z.object({
  companyId: z.string(),
  module: ModuleSchema,
  enabled: z.boolean()
});

export const PlatformBootstrapSchema = z.object({
  company: CompanySchema,
  settings: PlatformSettingsSchema,
  user: UserSchema,
  roles: z.array(RoleSchema),
  companyUsers: z.array(UserSchema),
  availableModules: z.array(ModuleSchema),
  companyModules: z.array(CompanyModuleStateSchema),
  permissions: z.array(z.string())
});

export type ModuleContract = z.infer<typeof ModuleSchema>;
export type CompanyContract = z.infer<typeof CompanySchema>;
export type RoleContract = z.infer<typeof RoleSchema>;
export type UserContract = z.infer<typeof UserSchema>;
export type PlatformSettingsContract = z.infer<typeof PlatformSettingsSchema>;
export type AuthLoginRequestContract = z.infer<typeof AuthLoginRequestSchema>;
export type AuthSessionContract = z.infer<typeof AuthSessionSchema>;
export type CompanyModuleStateContract = z.infer<typeof CompanyModuleStateSchema>;
export type PlatformBootstrapContract = z.infer<typeof PlatformBootstrapSchema>;

export const moduleCatalog: ModuleContract[] = [
  {
    key: "platform.companies",
    name: "Company Management",
    area: "platform",
    scope: "platform",
    description: "Tenant creation, lifecycle, branding, and settings.",
    enabledByDefault: true
  },
  {
    key: "platform.identity",
    name: "Identity and Access",
    area: "platform",
    scope: "platform",
    description: "Users, roles, permissions, and security policies.",
    enabledByDefault: true
  },
  {
    key: "sales.crm",
    name: "CRM and Sales",
    area: "sales",
    scope: "operations",
    description: "Leads, funnels, units, quotations, and closings.",
    enabledByDefault: false
  },
  {
    key: "projects.control",
    name: "Project Control",
    area: "projects",
    scope: "operations",
    description: "Schedules, progress, site supervision, and quality.",
    enabledByDefault: false
  },
  {
    key: "procurement.purchasing",
    name: "Procurement",
    area: "procurement",
    scope: "operations",
    description: "Requisitions, purchase orders, suppliers, and approvals.",
    enabledByDefault: false
  },
  {
    key: "inventory.warehouse",
    name: "Warehouse",
    area: "inventory",
    scope: "operations",
    description: "Stock, movements, cost traceability, and field supply.",
    enabledByDefault: false
  },
  {
    key: "finance.accounting",
    name: "Finance and Accounting",
    area: "finance",
    scope: "operations",
    description: "Treasury, accounting close, SAT controls, and reports.",
    enabledByDefault: false
  },
  {
    key: "hr.workforce",
    name: "Workforce",
    area: "hr",
    scope: "operations",
    description: "Crew management, attendance, payroll inputs, and safety.",
    enabledByDefault: false
  },
  {
    key: "compliance.postsale",
    name: "Post-sale and Compliance",
    area: "post_sales",
    scope: "operations",
    description: "Warranty, legal folders, handover, and compliance cases.",
    enabledByDefault: false
  },
  {
    key: "integrations.field-data",
    name: "Integrations and Telemetry",
    area: "integrations",
    scope: "operations",
    description: "BIM, CAD, drones, sensors, clocks, and external APIs.",
    enabledByDefault: false
  }
];

export const defaultRoles: RoleContract[] = [
  {
    key: "platform-owner",
    name: "Platform Owner",
    scope: "platform",
    permissions: ["platform:*", "companies:*", "modules:*", "users:*", "settings:*"]
  },
  {
    key: "company-admin",
    name: "Company Admin",
    scope: "operations",
    permissions: ["company:*", "users:read", "users:write", "settings:read", "settings:write"]
  },
  {
    key: "operations-manager",
    name: "Operations Manager",
    scope: "operations",
    permissions: ["sales:*", "projects:*", "procurement:*", "inventory:*", "finance:read"]
  }
];
