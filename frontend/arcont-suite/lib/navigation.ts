import { localizedText, type LocalizedText } from "@/lib/i18n";

export type NavigationItem = {
  href: string;
  label: LocalizedText;
  description: LocalizedText;
  domain:
    | "platform"
    | "sales"
    | "projects"
    | "procurement"
    | "inventory"
    | "finance"
    | "hr"
    | "post_sales"
    | "compliance"
    | "integrations";
  moduleKeys?: string[];
  requiredPermissions?: string[];
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: localizedText("Inicio", "Home"),
    description: localizedText("Punto de partida y lanzador de flujos", "Start here and launch workflows"),
    domain: "platform"
  },
  {
    href: "/dashboard",
    label: localizedText("Tablero", "Dashboard"),
    description: localizedText("Torre de control ejecutiva", "Executive control tower"),
    domain: "platform"
  },
  {
    href: "/platform/companies",
    label: localizedText("Empresas", "Companies"),
    description: localizedText("Tenants y ciclo de vida", "Tenants and lifecycle"),
    domain: "platform",
    moduleKeys: ["platform.companies"],
    requiredPermissions: ["companies:*"]
  },
  {
    href: "/platform/modules",
    label: localizedText("Módulos", "Modules"),
    description: localizedText("Catálogo y visibilidad", "Catalog and visibility"),
    domain: "platform",
    moduleKeys: ["platform.companies"],
    requiredPermissions: ["modules:*", "company:*"]
  },
  {
    href: "/platform/users",
    label: localizedText("Usuarios", "Users"),
    description: localizedText("Identidad y roles", "Identity and roles"),
    domain: "platform",
    moduleKeys: ["platform.identity"],
    requiredPermissions: ["users:*", "users:read"]
  },
  {
    href: "/platform/settings",
    label: localizedText("Configuración", "Settings"),
    description: localizedText("Controles de empresa", "Company controls"),
    domain: "platform",
    moduleKeys: ["platform.identity"],
    requiredPermissions: ["settings:*", "settings:read"]
  },
  {
    href: "/crm",
    label: localizedText("Ventas / CRM", "Sales / CRM"),
    description: localizedText("Pipeline y demanda", "Pipeline and demand"),
    domain: "sales",
    moduleKeys: ["sales.crm"],
    requiredPermissions: ["sales:*"]
  },
  {
    href: "/projects",
    label: localizedText("Proyectos", "Projects"),
    description: localizedText("Control de obra y avance", "Site control and progress"),
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/document-control",
    label: localizedText("Control documental", "Document Control"),
    description: localizedText("RFI y revisiones", "RFI and revisions"),
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/operations",
    label: localizedText("Operaciones", "Operations"),
    description: localizedText("Blackboard transversal", "Cross-domain blackboard"),
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/quality",
    label: localizedText("Calidad", "Quality"),
    description: localizedText("Inspecciones y punch list", "Inspections and punch list"),
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/field",
    label: localizedText("Campo", "Field App"),
    description: localizedText("Ejecución móvil en obra", "Mobile site execution"),
    domain: "projects",
    moduleKeys: ["projects.control"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/daily-log",
    label: localizedText("Bitácora diaria", "Daily Log"),
    description: localizedText("Bitácora de obra y cuadrillas", "Site diary and crews"),
    domain: "projects",
    moduleKeys: ["projects.daily-log"],
    requiredPermissions: ["projects:*"]
  },
  {
    href: "/copilot",
    label: localizedText("Copiloto IA", "AI Copilot"),
    description: localizedText("Asistente con contexto operativo", "Context-aware assistant"),
    domain: "integrations",
    moduleKeys: ["integrations.field-data"],
    requiredPermissions: ["integrations:*"]
  },
  {
    href: "/procurement",
    label: localizedText("Compras", "Procurement"),
    description: localizedText("Solicitudes y abastecimiento", "Requests and sourcing"),
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*"]
  },
  {
    href: "/procurement/requisitions",
    label: localizedText("Requisiciones", "Requisitions"),
    description: localizedText("Entrada y aprobaciones", "Intake and approvals"),
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*"]
  },
  {
    href: "/procurement/purchase-orders",
    label: localizedText("Órdenes de compra", "Purchase Orders"),
    description: localizedText("Ejecución y recepción", "Execution and receiving"),
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*"]
  },
  {
    href: "/budget-book",
    label: localizedText("Libro de presupuesto", "Budget Book"),
    description: localizedText("Catálogo y generadores", "Catalog and generators"),
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*"]
  },
  {
    href: "/supplier-control",
    label: localizedText("Control de proveedores", "Supplier Control"),
    description: localizedText("Salud y concentración de proveedores", "Vendor health and concentration"),
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*"]
  },
  {
    href: "/supplier-master",
    label: localizedText("Maestro de proveedores", "Supplier Master"),
    description: localizedText("Expediente fiscal y comercial", "Fiscal and commercial packet"),
    domain: "procurement",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*", "finance:*", "finance:read"]
  },
  {
    href: "/cost-control",
    label: localizedText("Control de costos", "Cost Control"),
    description: localizedText("Presupuesto, forecast y desviación", "Budget, forecast and drift"),
    domain: "finance",
    moduleKeys: ["procurement.purchasing"],
    requiredPermissions: ["procurement:*"]
  },
  {
    href: "/inventory",
    label: localizedText("Inventario", "Inventory"),
    description: localizedText("Almacén y existencias", "Warehouse and stock"),
    domain: "inventory",
    moduleKeys: ["inventory.warehouse"],
    requiredPermissions: ["inventory:*"]
  },
  {
    href: "/inventory/receiving",
    label: localizedText("Recepción", "Receiving"),
    description: localizedText("Entradas y variaciones", "Inbound receipts and variance"),
    domain: "inventory",
    moduleKeys: ["inventory.receiving"],
    requiredPermissions: ["inventory:*"]
  },
  {
    href: "/inventory/movements",
    label: localizedText("Movimientos", "Movements"),
    description: localizedText("Transferencias y devoluciones", "Transfers and returns"),
    domain: "inventory",
    moduleKeys: ["inventory.movements"],
    requiredPermissions: ["inventory:*"]
  },
  {
    href: "/equipment",
    label: localizedText("Equipos", "Equipment"),
    description: localizedText("Maquinaria y mantenimiento", "Machinery and maintenance"),
    domain: "inventory",
    moduleKeys: ["inventory.equipment"],
    requiredPermissions: ["inventory:*"]
  },
  {
    href: "/finance",
    label: localizedText("Finanzas", "Finance"),
    description: localizedText("Tesorería y cierre", "Treasury and close"),
    domain: "finance",
    moduleKeys: ["finance.accounting"],
    requiredPermissions: ["finance:*", "finance:read"]
  },
  {
    href: "/accounts-payable",
    label: localizedText("Cuentas por pagar", "Accounts Payable"),
    description: localizedText("Facturas, CFDI y corrida de pago", "Invoices, CFDI and payment run"),
    domain: "finance",
    moduleKeys: ["finance.accounting"],
    requiredPermissions: ["finance:*", "finance:read"]
  },
  {
    href: "/treasury/payment-runs",
    label: localizedText("Corridas de pago", "Payment Runs"),
    description: localizedText("Lotes de dispersión de tesorería", "Treasury disbursement batches"),
    domain: "finance",
    moduleKeys: ["finance.accounting"],
    requiredPermissions: ["finance:*", "finance:read"]
  },
  {
    href: "/cash-flow",
    label: localizedText("Flujo de efectivo", "Cash Flow"),
    description: localizedText("Control de entradas y salidas", "Inflow and outflow control"),
    domain: "finance",
    moduleKeys: ["finance.accounting"],
    requiredPermissions: ["finance:*", "finance:read"]
  },
  {
    href: "/close-control",
    label: localizedText("Control de cierre", "Close Control"),
    description: localizedText("Bloqueos de cierre y SAT", "Close and SAT blockers"),
    domain: "finance",
    moduleKeys: ["finance.accounting"],
    requiredPermissions: ["finance:*", "finance:read"]
  },
  {
    href: "/estimations",
    label: localizedText("Estimaciones", "Estimations"),
    description: localizedText("Obra ejecutada y cobranza", "Executed work and collections"),
    domain: "finance",
    moduleKeys: ["finance.accounting"],
    requiredPermissions: ["finance:*", "finance:read"]
  },
  {
    href: "/hr",
    label: localizedText("RH", "HR"),
    description: localizedText("Personal y seguridad", "Workforce and safety"),
    domain: "hr",
    moduleKeys: ["hr.workforce"],
    requiredPermissions: ["hr:*"]
  },
  {
    href: "/subcontracts",
    label: localizedText("Subcontratos", "Subcontracts"),
    description: localizedText("Destajo y avance de contratistas", "Destajo and contractor advance"),
    domain: "hr",
    moduleKeys: ["hr.workforce"],
    requiredPermissions: ["hr:*"]
  },
  {
    href: "/post-sale",
    label: localizedText("Postventa", "Post-sale"),
    description: localizedText("Entregas, garantías y SLA", "Deliveries, warranties and SLA"),
    domain: "post_sales",
    moduleKeys: ["compliance.postsale"],
    requiredPermissions: ["compliance:*", "postsale:*"]
  },
  {
    href: "/compliance",
    label: localizedText("Cumplimiento", "Compliance"),
    description: localizedText("Expedientes y seguimiento", "Post-sale and cases"),
    domain: "compliance",
    moduleKeys: ["compliance.postsale"],
    requiredPermissions: ["compliance:*", "postsale:*"]
  },
  {
    href: "/integrations",
    label: localizedText("Integraciones", "Integrations"),
    description: localizedText("BIM, telemetría e IA", "BIM, telemetry, AI"),
    domain: "integrations",
    moduleKeys: ["integrations.field-data"],
    requiredPermissions: ["integrations:*"]
  }
];

export const navigationGroups = [
  { key: "platform", label: localizedText("Plataforma", "Platform") },
  { key: "sales", label: localizedText("Ventas", "Sales") },
  { key: "projects", label: localizedText("Proyectos", "Projects") },
  { key: "procurement", label: localizedText("Compras", "Procurement") },
  { key: "inventory", label: localizedText("Inventario", "Inventory") },
  { key: "finance", label: localizedText("Finanzas", "Finance") },
  { key: "hr", label: localizedText("RH", "HR") },
  { key: "post_sales", label: localizedText("Postventa", "Post-sale") },
  { key: "compliance", label: localizedText("Cumplimiento", "Compliance") },
  { key: "integrations", label: localizedText("Integraciones", "Integrations") }
] as const;
