"use client";

import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";

export default function PlatformSettingsPage() {
  const { activeCompany, activeSettings } = useAppState();

  return (
    <AppShell
      title="Company settings"
      eyebrow="Governance controls"
      description="Operational defaults, fiscal posture and localization for the active tenant."
    >
      <section className="grid cols4">
        <KpiCard label="Timezone" value={activeSettings?.timezone ?? "Pending"} footnote="Used by schedules, logs and operational timestamps." />
        <KpiCard label="Locale" value={activeSettings?.locale ?? "Pending"} footnote="Prepares currency and language formatting across the suite." />
        <KpiCard label="Currency" value={activeSettings?.currency ?? "Pending"} footnote="Base for finance, procurement and dashboards." />
        <KpiCard label="SAT" value={activeSettings?.satEnabled ? "Enabled" : "Disabled"} footnote="Fiscal integration readiness for the tenant." />
      </section>

      <section className="grid cols2">
        <Card title="Configuration detail" description={`Settings aligned to ${activeCompany.tradeName}.`} aside={<Badge tone="gold">{activeCompany.countryCode}</Badge>}>
          <div className="detailGrid">
            <div className="detailRow">
              <div className="detailLabel">Legal entity</div>
              <div>{activeCompany.legalName}</div>
            </div>
            <div className="detailRow">
              <div className="detailLabel">Fiscal regime</div>
              <div>{activeSettings?.fiscalRegime ?? "Pending"}</div>
            </div>
            <div className="detailRow">
              <div className="detailLabel">Fiscal country</div>
              <div>{activeSettings?.fiscalCountry ?? "Pending"}</div>
            </div>
          </div>
        </Card>

        <Card title="Why this matters" description="Settings are not a dead admin page in this foundation. They are the root of platform-wide behavior.">
          <div className="list">
            <div className="listItem">
              <div>
                <strong>Localization baseline</strong>
                <p>Dashboards, money fields and date formats can inherit the tenant locale consistently.</p>
              </div>
            </div>
            <div className="listItem">
              <div>
                <strong>Compliance and reporting</strong>
                <p>Fiscal controls can flow into procurement, finance and post-sale reporting without special-case UI logic.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
