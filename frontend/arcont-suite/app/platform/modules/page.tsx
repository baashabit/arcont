"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleBadge } from "@/components/ui/module-badge";

export default function PlatformModulesPage() {
  const {
    activeCompany,
    getCompanyModules,
    isRouteVisible,
    isSavingModules,
    modules,
    refreshCompanyDetail,
    saveCompanyModules,
    source,
    session
  } = useAppState();
  const [scope, setScope] = useState("all");
  const [draftEnabled, setDraftEnabled] = useState<string[]>([]);
  const companyModules = getCompanyModules(activeCompany.id);

  useEffect(() => {
    void refreshCompanyDetail(activeCompany.id);
  }, [activeCompany.id, refreshCompanyDetail]);

  useEffect(() => {
    const enabled = companyModules.filter((entry) => entry.enabled).map((entry) => entry.module.key);
    setDraftEnabled(enabled);
  }, [companyModules]);

  if (!isRouteVisible({ moduleKeys: ["platform.companies"], requiredPermissions: ["modules:*", "company:*"] })) {
    return (
      <AppShell
        title="Module control"
        eyebrow="Visibility matrix"
        description="Shared-contract module catalog with tenant-aware activation and clear platform versus operations scope."
      >
        <EmptyState
          title="Module governance is not available for this session"
          description="The frontend can already hide modules by tenant and permission. This route requires platform or company governance access."
          primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          secondaryAction={{ label: "Review login", href: "/login" }}
        />
      </AppShell>
    );
  }

  const filteredModules = modules.filter((module) => (scope === "all" ? true : module.scope === scope));
  const hasChanges =
    draftEnabled.slice().sort().join("|") !==
    companyModules
      .filter((entry) => entry.enabled)
      .map((entry) => entry.module.key)
      .sort()
      .join("|");

  return (
    <AppShell
      title="Module control"
      eyebrow="Visibility matrix"
      description="Live tenant module management backed by GET and PUT company-modules endpoints."
      actions={
        <button
          className="button"
          type="button"
          disabled={!hasChanges || isSavingModules}
          onClick={() => void saveCompanyModules(activeCompany.id, draftEnabled)}
        >
          {isSavingModules ? "Saving..." : "Save module state"}
        </button>
      }
    >
      <section className="grid cols4">
        <KpiCard label="Catalog size" value={String(modules.length)} footnote="Modules come directly from the shared contracts package." />
        <KpiCard label="Enabled now" value={String(draftEnabled.length)} footnote={`Modules visible for ${activeCompany.tradeName}.`} />
        <KpiCard label="Platform modules" value={String(modules.filter((module) => module.scope === "platform").length)} footnote="Governance capabilities in the base shell." />
        <KpiCard label="Operations modules" value={String(modules.filter((module) => module.scope === "operations").length)} footnote="Line-of-business domains ready to scale route by route." />
      </section>

      <Card title="Catalog by tenant" description="This screen now reads and writes live company module state.">
        <FilterBar summary={`${filteredModules.length} modules in the current view`}>
          <Badge tone={source === "api" && session.authenticated ? "success" : "warning"}>
            {source === "api" && session.authenticated ? "live modules api" : "derived fallback"}
          </Badge>
          <select className="selectField" value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="all">All scopes</option>
            <option value="platform">Platform</option>
            <option value="operations">Operations</option>
          </select>
        </FilterBar>

        <div className="moduleGrid">
          {filteredModules.map((module) => {
            const enabled = draftEnabled.includes(module.key);
            return (
              <div className="moduleCard" key={module.key}>
                <div className="moduleMeta">
                  <div>
                    <h4>{module.name}</h4>
                    <p>{module.description}</p>
                  </div>
                  <ModuleBadge module={module} />
                </div>
                <div className="tagRow">
                  <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "enabled" : "not enabled"}</Badge>
                  <Badge tone="info">{module.scope}</Badge>
                  <Badge tone="gold">{module.key}</Badge>
                </div>
                <div className="emptyActions">
                  <button
                    className={enabled ? "buttonGhost" : "button"}
                    type="button"
                    onClick={() =>
                      setDraftEnabled((current) =>
                        current.includes(module.key)
                          ? current.filter((key) => key !== module.key)
                          : [...current, module.key]
                      )
                    }
                  >
                    {enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}
