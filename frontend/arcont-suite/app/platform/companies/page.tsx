"use client";

import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";

export default function PlatformCompaniesPage() {
  const { companies, modules } = useAppState();

  return (
    <AppShell
      title="Platform companies"
      eyebrow="Tenant governance"
      description="Tenant inventory, activation posture and enabled modules for a modular ARCONT rollout."
    >
      <section className="grid cols4">
        <KpiCard label="Companies" value={String(companies.length)} footnote="Multi-company base loaded from contracts-aligned entities." />
        <KpiCard label="Active tenants" value={String(companies.filter((company) => company.status === "active").length)} footnote="Production-ready companies in the current dataset." />
        <KpiCard label="Draft tenants" value={String(companies.filter((company) => company.status === "draft").length)} footnote="Tenants still staging module activation and settings." />
        <KpiCard label="Catalog breadth" value={String(modules.length)} footnote="Shared platform and operations modules available for provisioning." />
      </section>

      <Card title="Tenant portfolio" description="Each company carries its own module entitlements, settings and user base.">
        <FilterBar summary={`${companies.length} tenants under platform governance`}>
          <Badge tone="gold">multi-tenant</Badge>
          <Badge tone="info">enterprise ready</Badge>
        </FilterBar>
        <DataTable
          rows={companies}
          columns={[
            {
              key: "company",
              label: "Company",
              render: (company) => (
                <div className="tableCellStack">
                  <strong>{company.tradeName}</strong>
                  <span className="tableCellMuted">{company.legalName}</span>
                </div>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (company) => <Badge tone={company.status === "active" ? "success" : company.status === "draft" ? "warning" : "danger"}>{company.status}</Badge>
            },
            {
              key: "country",
              label: "Country",
              render: (company) => (
                <div className="tableCellStack">
                  <strong>{company.countryCode}</strong>
                  <span className="tableCellMuted mono">{company.taxId}</span>
                </div>
              )
            },
            {
              key: "modules",
              label: "Modules",
              render: (company) => (
                <div className="tableCellStack">
                  <strong>{company.enabledModules.length} enabled</strong>
                  <span className="tableCellMuted">{company.enabledModules.slice(0, 3).join(", ")}</span>
                </div>
              )
            }
          ]}
        />
      </Card>
    </AppShell>
  );
}
