export type NavigationItem = {
  href: string;
  label: string;
  description: string;
  domain:
    | "platform"
    | "sales"
    | "projects"
    | "procurement"
    | "inventory"
    | "finance"
    | "hr"
    | "compliance"
    | "integrations";
  moduleKeys?: string[];
  requiredPermissions?: string[];
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Executive control tower",
    domain: "platform"
  },
  {
    href: "/platform/companies",
    label: "Companies",
    description: "Tenants and lifecycle",
    domain: "platform",
    moduleKeys: ["platform.companies"],
    requiredPermissions: ["companies:*"]
  },
  {
    href: "/platform/modules",
    label: "Modules",
    description: "Catalog and visibility",
    domain: "platform",
    moduleKeys: ["platform.companies"],
    requiredPermissions: ["modules:*", "company:*"]
  },
  {
    href: "/platform/users",
    label: "Users",
    description: "Identity and roles",
    domain: "platform",
    moduleKeys: ["platform.identity"],
    requiredPermissions: ["users:*", "users:read"]
  },
  {
    href: "/platform/settings",
    label: "Settings",
    description: "Company controls",
    domain: "platform",
    moduleKeys: ["platform.identity"],
    requiredPermissions: ["settings:*", "settings:read"]
  },
  {
    href: "/crm",
    label: "Sales / CRM",
    description: "Pipeline and demand",
    domain: "sales",
    moduleKeys: ["sales.crm"],
    requiredPermissions: ["sales:*"]
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Site control and progress",
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/document-control",
    label: "Document Control",
    description: "RFI and revisions",
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/operations",
    label: "Operations",
    description: "Cross-domain blackboard",
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/procurement",
    label: "Procurement",
    description: "Requests and sourcing",
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*"]
  },
  {
    href: "/inventory",
    label: "Inventory",
    description: "Warehouse and stock",
    domain: "inventory",
    moduleKeys: ["inventory.warehouse"],
    requiredPermissions: ["inventory:*"]
  },
  {
    href: "/finance",
    label: "Finance",
    description: "Treasury and close",
    domain: "finance",
    moduleKeys: ["finance.accounting"],
    requiredPermissions: ["finance:*", "finance:read"]
  },
  {
    href: "/hr",
    label: "HR",
    description: "Workforce and safety",
    domain: "hr",
    moduleKeys: ["hr.workforce"],
    requiredPermissions: ["hr:*"]
  },
  {
    href: "/compliance",
    label: "Compliance",
    description: "Post-sale and cases",
    domain: "compliance",
    moduleKeys: ["compliance.postsale"],
    requiredPermissions: ["compliance:*", "postsale:*"]
  },
  {
    href: "/integrations",
    label: "Integrations",
    description: "BIM, telemetry, AI",
    domain: "integrations",
    moduleKeys: ["integrations.field-data"],
    requiredPermissions: ["integrations:*"]
  }
];

export const navigationGroups = [
  { key: "platform", label: "Platform" },
  { key: "sales", label: "Sales" },
  { key: "projects", label: "Projects" },
  { key: "procurement", label: "Procurement" },
  { key: "inventory", label: "Inventory" },
  { key: "finance", label: "Finance" },
  { key: "hr", label: "HR" },
  { key: "compliance", label: "Compliance" },
  { key: "integrations", label: "Integrations" }
] as const;
