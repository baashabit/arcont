"use client";

import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleBadge } from "@/components/ui/module-badge";
import { dashboardAlerts } from "@/lib/route-mocks";

export default function DashboardPage() {
  const { activeCompany, activeSettings, modules, users, source } = useAppState();
  const enabledModules = modules.filter((module) => activeCompany.enabledModules.includes(module.key));

  return (
    <AppShell
      title="Enterprise dashboard"
      eyebrow="Platform overview"
      description="Cross-domain control for tenant health, operational pressure and module readiness."
      actions={<Badge tone={source === "api" ? "success" : "warning"}>{source} data source</Badge>}
    >
      <section className="heroPanel">
        <div>
          <h2>ARCONT is ready to orchestrate platform governance and frontline execution.</h2>
          <p>
            The shell now understands tenant context, module visibility, reusable enterprise patterns and API
            fallback. Each route demonstrates a product capability instead of a placeholder screen.
          </p>
          <div className="heroMetrics">
            <div className="heroMetric">
              <strong>{enabledModules.length}</strong>
              <span>Modules live for {activeCompany.tradeName}</span>
            </div>
            <div className="heroMetric">
              <strong>{users.filter((user) => user.companyId === activeCompany.id).length}</strong>
              <span>Users governed under the active tenant</span>
            </div>
            <div className="heroMetric">
              <strong>{activeSettings?.currency ?? "MXN"}</strong>
              <span>Fiscal baseline and locale controls in place</span>
            </div>
          </div>
        </div>

        <Card
          title="Operating posture"
          description="A compact readout of what matters first for the active tenant."
          aside={<Badge tone="gold">{activeCompany.status}</Badge>}
        >
          <div className="statStrip">
            <div className="statTile">
              <strong>97.4%</strong>
              <span>Control coverage across enabled domains</span>
            </div>
            <div className="statTile">
              <strong>11</strong>
              <span>Critical workflows mapped in the shell foundation</span>
            </div>
          </div>
          <p className="sectionText">
            Tenant switching and module gating are handled in the frontend state layer, so future auth and
            bootstrap flows can plug into the same shell.
          </p>
        </Card>
      </section>

      <section className="grid cols4">
        <KpiCard label="Tenant status" value={activeCompany.tradeName} footnote="Company context drives all route visibility and platform settings." />
        <KpiCard label="Modules enabled" value={String(enabledModules.length)} footnote="Catalogued from shared contracts, not hardcoded UI labels." />
        <KpiCard label="Active locale" value={activeSettings?.locale ?? "es-MX"} footnote="Settings can already fall back safely when the API is not running." />
        <KpiCard label="Role focus" value="Platform-first" footnote="Foundation supports governance and operations without splitting the UX into separate products." />
      </section>

      <section className="grid cols2">
        <Card title="Risk board" description="Signals that explain where leadership attention is needed.">
          <div className="list">
            {dashboardAlerts.map((alert) => (
              <div className="listItem" key={alert.title}>
                <div>
                  <strong>{alert.title}</strong>
                  <p>{alert.detail}</p>
                </div>
                <Badge tone={alert.tone}>{alert.tone}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Module portfolio" description="Enabled domains for the current tenant, mapped from shared contracts.">
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
    </AppShell>
  );
}
