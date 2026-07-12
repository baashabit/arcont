"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";

export default function PlatformCompaniesPage() {
  const {
    activeCompany,
    companies,
    companyDetails,
    isRefreshingPlatform,
    isRouteVisible,
    modules,
    refreshCompanyDetail,
    source,
    session
  } = useAppState();

  useEffect(() => {
    if (!companyDetails[activeCompany.id]) {
      void refreshCompanyDetail(activeCompany.id);
    }
  }, [activeCompany.id, companyDetails, refreshCompanyDetail]);

  if (!isRouteVisible({ moduleKeys: ["platform.companies"], requiredPermissions: ["companies:*"] })) {
    return (
      <AppShell
        title="Platform companies"
        eyebrow="Tenant governance"
        description="Tenant inventory, activation posture and enabled modules for a modular ARCONT rollout."
      >
        <EmptyState
          title="Company governance is not available for this session"
          description="This route is controlled by platform-level permissions and the active tenant modules."
          primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          secondaryAction={{ label: "Review login", href: "/login" }}
        />
      </AppShell>
    );
  }

  const detail = companyDetails[activeCompany.id];

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

      <section className="grid cols2">
        <Card title="Tenant portfolio" description="Each company carries its own module entitlements, settings and user base.">
          <FilterBar summary={`${companies.length} tenants under platform governance`}>
            <Badge tone={source === "api" && session.authenticated ? "success" : "warning"}>
              {source === "api" && session.authenticated ? "api list" : "fallback list"}
            </Badge>
            <Badge tone={isRefreshingPlatform ? "info" : "gold"}>
              {isRefreshingPlatform ? "refreshing" : "detail ready"}
            </Badge>
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

        <Card
          title="Selected tenant detail"
          description="This panel now consumes GET /platform/companies/:companyId for the active tenant."
          aside={<Badge tone="gold">{activeCompany.tradeName}</Badge>}
        >
          {detail ? (
            <div className="detailGrid">
              <div className="detailRow">
                <div className="detailLabel">Legal entity</div>
                <div>{detail.company.legalName}</div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Users</div>
                <div>{detail.stats.totalUsers} total · {detail.stats.activeUsers} active</div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Modules</div>
                <div>{detail.stats.enabledModuleCount} enabled · {detail.stats.disabledModuleCount} disabled</div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Locale</div>
                <div>{detail.settings.locale} · {detail.settings.timezone}</div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Company detail not loaded yet"
              description="The list is already available, but tenant detail still falls back until the company detail endpoint responds."
              primaryAction={{ label: "Stay on companies", href: "/platform/companies" }}
            />
          )}
        </Card>
      </section>
    </AppShell>
  );
}
