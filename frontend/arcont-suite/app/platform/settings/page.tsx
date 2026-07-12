"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";

export default function PlatformSettingsPage() {
  const {
    activeCompany,
    activeSettings,
    isRouteVisible,
    isSavingSettings,
    refreshCompanyDetail,
    saveSettings,
    source,
    session
  } = useAppState();
  const [form, setForm] = useState({
    timezone: "",
    locale: "",
    currency: "",
    fiscalCountry: "",
    satEnabled: false,
    fiscalRegime: ""
  });

  useEffect(() => {
    void refreshCompanyDetail(activeCompany.id);
  }, [activeCompany.id, refreshCompanyDetail]);

  useEffect(() => {
    setForm({
      timezone: activeSettings?.timezone ?? "",
      locale: activeSettings?.locale ?? "",
      currency: activeSettings?.currency ?? "",
      fiscalCountry: activeSettings?.fiscalCountry ?? "",
      satEnabled: activeSettings?.satEnabled ?? false,
      fiscalRegime: activeSettings?.fiscalRegime ?? ""
    });
  }, [activeSettings]);

  if (!isRouteVisible({ moduleKeys: ["platform.identity"], requiredPermissions: ["settings:*", "settings:read"] })) {
    return (
      <AppShell
        title="Company settings"
        eyebrow="Governance controls"
        description="Operational defaults, fiscal posture and localization for the active tenant."
      >
        <EmptyState
          title="Settings access is not available for this session"
          description="This route is controlled by company settings permissions and the active tenant identity module."
          primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          secondaryAction={{ label: "Review login", href: "/login" }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Company settings"
      eyebrow="Governance controls"
      description="Operational defaults, fiscal posture and localization for the active tenant."
      actions={
        <button
          className="button"
          type="button"
          disabled={isSavingSettings}
          onClick={() => void saveSettings(activeCompany.id, form)}
        >
          {isSavingSettings ? "Saving..." : "Save settings"}
        </button>
      }
    >
      <section className="grid cols4">
        <KpiCard label="Timezone" value={activeSettings?.timezone ?? "Pending"} footnote="Used by schedules, logs and operational timestamps." />
        <KpiCard label="Locale" value={activeSettings?.locale ?? "Pending"} footnote="Prepares currency and language formatting across the suite." />
        <KpiCard label="Currency" value={activeSettings?.currency ?? "Pending"} footnote="Base for finance, procurement and dashboards." />
        <KpiCard label="SAT" value={activeSettings?.satEnabled ? "Enabled" : "Disabled"} footnote="Fiscal integration readiness for the tenant." />
      </section>

      <section className="grid cols2">
        <Card
          title="Configuration detail"
          description={`Settings aligned to ${activeCompany.tradeName}. This form now persists through PUT /platform/settings/:companyId.`}
          aside={
            <div className="tagRow">
              <Badge tone={source === "api" && session.authenticated ? "success" : "warning"}>
                {source === "api" && session.authenticated ? "live settings api" : "fallback settings"}
              </Badge>
              <Badge tone="gold">{activeCompany.countryCode}</Badge>
            </div>
          }
        >
          <div className="detailGrid">
            <label className="detailRow">
              <div className="detailLabel">Timezone</div>
              <input
                className="field"
                value={form.timezone}
                onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Locale</div>
              <input
                className="field"
                value={form.locale}
                onChange={(event) => setForm((current) => ({ ...current, locale: event.target.value }))}
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Currency</div>
              <input
                className="field"
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Fiscal country</div>
              <input
                className="field"
                value={form.fiscalCountry}
                onChange={(event) =>
                  setForm((current) => ({ ...current, fiscalCountry: event.target.value.toUpperCase() }))
                }
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Fiscal regime</div>
              <input
                className="field"
                value={form.fiscalRegime}
                onChange={(event) => setForm((current) => ({ ...current, fiscalRegime: event.target.value }))}
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">SAT enabled</div>
              <button
                className={form.satEnabled ? "button" : "buttonGhost"}
                type="button"
                onClick={() => setForm((current) => ({ ...current, satEnabled: !current.satEnabled }))}
              >
                {form.satEnabled ? "Enabled" : "Disabled"}
              </button>
            </label>
          </div>
        </Card>

        <Card title="Why this matters" description="Settings are now editable against the real backend without changing the enterprise shell language.">
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
