"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleBadge } from "@/components/ui/module-badge";

function formatAreaLabel(area: string) {
  return area.replace(/_/g, " ");
}

export default function DashboardPage() {
  const {
    activeCompany,
    activeSettings,
    modules,
    dashboardSummary,
    auditEvents,
    source,
    isRefreshingPlatform,
    refreshDashboard,
    refreshAuditTrail,
    getCompanyModules
  } = useAppState();

  useEffect(() => {
    if (!dashboardSummary) {
      void refreshDashboard(activeCompany.id);
    }

    if (auditEvents.length === 0) {
      void refreshAuditTrail(activeCompany.id, 8);
    }
  }, [activeCompany.id, auditEvents.length, dashboardSummary, refreshAuditTrail, refreshDashboard]);

  const companyModules = getCompanyModules(activeCompany.id);
  const enabledModules = companyModules.length
    ? companyModules.filter((entry) => entry.enabled).map((entry) => entry.module)
    : modules.filter((module) => activeCompany.enabledModules.includes(module.key));

  const totals = dashboardSummary?.totals;
  const latestAuditEvents = auditEvents.length > 0 ? auditEvents : dashboardSummary?.latestAuditEvents ?? [];

  return (
    <AppShell
      title="Enterprise dashboard"
      eyebrow="Platform overview"
      description="Cross-domain control for tenant health, operational pressure and module readiness."
      actions={
        <Badge tone={source === "api" ? "success" : "warning"}>
          {isRefreshingPlatform ? "refreshing" : `${source} data source`}
        </Badge>
      }
    >
      <section className="heroPanel">
        <div>
          <h2>ARCONT now surfaces live platform posture, not just static shell metrics.</h2>
          <p>
            Dashboard summary and audit events now prefer the real backend, while preserving the same visual
            shell and a safe local fallback if the API is unavailable.
          </p>
          <div className="heroMetrics">
            <div className="heroMetric">
              <strong>{totals?.companies ?? "--"}</strong>
              <span>Total companies tracked by the current platform summary</span>
            </div>
            <div className="heroMetric">
              <strong>{totals?.activeUsers ?? "--"}</strong>
              <span>Active users visible across the current operational snapshot</span>
            </div>
            <div className="heroMetric">
              <strong>{totals?.auditEvents ?? "--"}</strong>
              <span>Audit events counted by the backend dashboard endpoint</span>
            </div>
          </div>
        </div>

        <Card
          title="Active tenant focus"
          description="The active company still drives route visibility, but platform-wide metrics now come from the real summary endpoint."
          aside={<Badge tone="gold">{activeCompany.status}</Badge>}
        >
          <div className="statStrip">
            <div className="statTile">
              <strong>{enabledModules.length}</strong>
              <span>Enabled modules for {activeCompany.tradeName}</span>
            </div>
            <div className="statTile">
              <strong>{activeSettings?.currency ?? "MXN"}</strong>
              <span>Tenant financial baseline and localization</span>
            </div>
          </div>
          <p className="sectionText">
            Focus company from the platform summary:
            {" "}
            {dashboardSummary?.focusCompany?.tradeName ?? activeCompany.tradeName}
          </p>
        </Card>
      </section>

      <section className="grid cols4">
        <KpiCard
          label="Companies"
          value={String(totals?.companies ?? enabledModules.length)}
          footnote="Read from GET /platform/dashboard/summary when available."
        />
        <KpiCard
          label="Active companies"
          value={String(totals?.activeCompanies ?? 0)}
          footnote="Platform-wide company activation posture."
        />
        <KpiCard
          label="Users"
          value={String(totals?.users ?? 0)}
          footnote="User totals come from the dashboard summary, not local counting."
        />
        <KpiCard
          label="Enabled modules"
          value={String(totals?.enabledModules ?? enabledModules.length)}
          footnote="Combined module activation read across companies."
        />
      </section>

      <section className="grid cols2">
        <Card title="Module activation by area" description="A live rollup of how many companies have each domain enabled.">
          {dashboardSummary?.byArea?.length ? (
            <div className="moduleGrid">
              {dashboardSummary.byArea.map((entry) => (
                <div className="moduleCard" key={entry.area}>
                  <div className="moduleMeta">
                    <div>
                      <h4>{formatAreaLabel(entry.area)}</h4>
                      <p>Companies with this domain enabled in the current platform dataset.</p>
                    </div>
                    <Badge tone="info">{entry.enabledCompanies}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No live platform summary available"
              description="The dashboard keeps rendering with the same shell even when the summary endpoint is unavailable."
              primaryAction={{ label: "Review companies", href: "/platform/companies" }}
            />
          )}
        </Card>

        <Card title="Tenant module portfolio" description="Current active-company modules, hydrated from bootstrap or company-modules endpoint.">
          <div className="moduleGrid">
            {enabledModules.map((module) => (
              <div key={module.key} className="moduleCard">
                <div className="moduleMeta">
                  <div>
                    <h4>{module.name}</h4>
                    <p>{module.description}</p>
                  </div>
                  <ModuleBadge module={module} />
                </div>
                <div className="tagRow">
                  <Badge tone={module.scope === "platform" ? "gold" : "info"}>{module.scope}</Badge>
                  <Badge tone="neutral">{module.key}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <Card title="Audit trail" description="Latest platform activity from GET /platform/audit-events and dashboard summary.">
        {latestAuditEvents.length ? (
          <div className="list">
            {latestAuditEvents.map((event) => (
              <div className="listItem" key={event.id}>
                <div>
                  <strong>{event.action}</strong>
                  <p>
                    {event.aggregateType}
                    {" "}
                    /
                    {" "}
                    {event.aggregateId}
                    {" "}
                    ·
                    {" "}
                    {new Date(event.createdAt).toLocaleString("es-MX")}
                  </p>
                </div>
                <Badge tone="neutral">{event.companyId ?? "platform"}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No audit events available"
            description="The backend did not return audit activity, so the dashboard falls back cleanly without breaking the shell."
            primaryAction={{ label: "Open users", href: "/platform/users" }}
          />
        )}
      </Card>
    </AppShell>
  );
}
