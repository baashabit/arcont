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
    moduleKeys: ["platform.companies"]
  },
  {
    href: "/platform/modules",
    label: "Modules",
    description: "Catalog and visibility",
    domain: "platform",
    moduleKeys: ["platform.companies"]
  },
  {
    href: "/platform/users",
    label: "Users",
    description: "Identity and roles",
    domain: "platform",
    moduleKeys: ["platform.identity"]
  },
  {
    href: "/platform/settings",
    label: "Settings",
    description: "Company controls",
    domain: "platform",
    moduleKeys: ["platform.identity"]
  },
  {
    href: "/crm",
    label: "Sales / CRM",
    description: "Pipeline and demand",
    domain: "sales",
    moduleKeys: ["sales.crm"]
  },
  {
    href: "/projects",
    label: "Projects",
    description: "Site control and progress",
    domain: "projects",
    moduleKeys: ["projects.control"]
  },
  {
    href: "/procurement",
    label: "Procurement",
    description: "Requests and sourcing",
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"]
  },
  {
    href: "/inventory",
    label: "Inventory",
    description: "Warehouse and stock",
    domain: "inventory",
    moduleKeys: ["inventory.warehouse"]
  },
  {
    href: "/finance",
    label: "Finance",
    description: "Treasury and close",
    domain: "finance",
    moduleKeys: ["finance.accounting"]
  },
  {
    href: "/hr",
    label: "HR",
    description: "Workforce and safety",
    domain: "hr",
    moduleKeys: ["hr.workforce"]
  },
  {
    href: "/compliance",
    label: "Compliance",
    description: "Post-sale and cases",
    domain: "compliance",
    moduleKeys: ["compliance.postsale"]
  },
  {
    href: "/integrations",
    label: "Integrations",
    description: "BIM, telemetry, AI",
    domain: "integrations",
    moduleKeys: ["integrations.field-data"]
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
