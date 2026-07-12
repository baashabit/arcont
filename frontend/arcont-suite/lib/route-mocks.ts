export const dashboardAlerts = [
  {
    title: "Close risk in compliance handover",
    detail: "12 units are waiting for legal folders and final sign-off within the next 5 days.",
    tone: "danger" as const
  },
  {
    title: "Procurement approvals aging out",
    detail: "9 high-value requests have spent more than 48 hours without owner action.",
    tone: "warning" as const
  },
  {
    title: "Warehouse variance under control",
    detail: "Cycle count deviation remains below 1.8% for the current cut-off.",
    tone: "success" as const
  }
];

export const crmLeads = [
  ["Residencial Nativa", "Investor", "34", "19%", "2 demos pending"],
  ["Distrito Norte", "Primary home", "28", "24%", "Bank pre-approval signal"],
  ["Puerto Cobalto", "Government housing", "17", "13%", "Tender validation ongoing"]
];

export const projectMilestones = [
  ["Torre B", "Structural progress", "84%", "2.1 days"],
  ["Etapa 2", "Permits and kickoff", "61%", "4.3 days"],
  ["Infraestructura vial", "Government control", "73%", "1.6 days"]
];

export const procurementRows = [
  ["Steel package", "MXN 4.8M", "3 bids", "Awaiting finance sign-off"],
  ["MEP materials", "MXN 2.1M", "2 bids", "Vendor negotiation"],
  ["Concrete supply", "MXN 1.6M", "4 bids", "Ready for award"]
];

export const inventoryRows = [
  ["Central warehouse", "4,280 SKUs", "97.9%", "2 open variances"],
  ["Jobsite B", "1,140 SKUs", "95.4%", "Field replenishment needed"],
  ["Prefabrication yard", "620 SKUs", "98.6%", "Healthy stock"]
];

export const financeRows = [
  ["Cash position", "MXN 18.4M", "Forecast +6%", "Within policy"],
  ["Accounts payable", "MXN 6.7M", "12 urgent", "2 blocked invoices"],
  ["Revenue recognition", "MXN 42.1M", "92% posted", "Close running"]
];

export const hrRows = [
  ["Active workforce", "428 people", "91% attendance", "2 crews short on safety refresh"],
  ["Subcontractors", "17 partners", "8 expiring policies", "Document chase required"],
  ["Payroll inputs", "136 pending", "1.2 day SLA", "Stable"]
];

export const complianceRows = [
  ["Warranty cases", "26 open", "11 SLA risk", "Prioritize plumbing wave"],
  ["Document folders", "94% complete", "8 missing signatures", "Legal queue"],
  ["Government compliance", "3 open items", "Next audit in 9 days", "Evidence collection"]
];

export const integrationRows = [
  ["BIM sync", "Navisworks", "Healthy", "Last sync 12 min ago"],
  ["Telemetry", "Site sensors", "Degraded", "2 gateways offline"],
  ["AI assistants", "Demand forecast", "Pilot", "Confidence 81%"]
];
