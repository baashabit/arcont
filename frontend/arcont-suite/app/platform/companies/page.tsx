"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import type { PlatformApiErrorContract, ProvisionCompanyRequestContract } from "@/lib/contracts";

const initialCompanyForm: ProvisionCompanyRequestContract = {
  legalName: "",
  tradeName: "",
  taxId: "",
  countryCode: "MX",
  timezone: "America/Mexico_City",
  locale: "es-MX",
  currency: "MXN",
  fiscalCountry: "MX",
  fiscalRegime: "601",
  adminFullName: "",
  adminEmail: "",
  enabledModules: ["platform.companies", "platform.identity"]
};

function ErrorBanner({ error }: { error: PlatformApiErrorContract["error"] }) {
  return (
    <div className="emptyState" style={{ padding: 20 }}>
      <div className="tagRow">
        <Badge tone="warning">{error.code}</Badge>
        <Badge tone="danger">Provisioning blocked</Badge>
      </div>
      <p style={{ marginTop: 12 }}>{error.message}</p>
    </div>
  );
}

function validateCompanyForm(input: ProvisionCompanyRequestContract) {
  if (input.tradeName.trim().length < 2) {
    return "Trade name must be specific before provisioning the tenant.";
  }

  if (input.legalName.trim().length < 3) {
    return "Legal name must be specific before provisioning the tenant.";
  }

  if (input.taxId.trim().length < 6) {
    return "Tax ID must contain enough information for the tenant.";
  }

  if (input.adminFullName.trim().length < 3) {
    return "Admin full name must be specific before provisioning the tenant.";
  }

  if (!input.adminEmail.includes("@")) {
    return "Admin email must be valid before provisioning the tenant.";
  }

  if (!input.timezone.includes("/")) {
    return "Timezone must use an IANA zone such as America/Merida.";
  }

  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) {
    return "Currency must use a 3-letter code.";
  }

  if (input.fiscalCountry === "MX") {
    if (input.currency !== "MXN") {
      return "Mexican tenants must use MXN currency.";
    }

    if (!input.locale.startsWith("es-MX")) {
      return "Mexican tenants must use an es-MX locale.";
    }

    if (!/^\d{3}$/.test(input.fiscalRegime.trim())) {
      return "Fiscal regime must use a 3-digit SAT code for Mexican tenants.";
    }
  }

  const operationalModules = input.enabledModules.filter(
    (moduleKey) => !["platform.companies", "platform.identity"].includes(moduleKey)
  );
  if (operationalModules.length === 0) {
    return "Enable at least one operational module in addition to the platform kernel.";
  }

  return null;
}

export default function PlatformCompaniesPage() {
  const {
    activeCompany,
    createCompany,
    companies,
    companyDetails,
    getModuleByKey,
    isProvisioningCompany,
    isRefreshingPlatform,
    isRouteVisible,
    modules,
    refreshCompanyDetail,
    setActiveCompanyId,
    source,
    session
  } = useAppState();
  const [query, setQuery] = useState("");
  const [actionError, setActionError] = useState<PlatformApiErrorContract["error"] | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastProvisioned, setLastProvisioned] = useState<{
    companyName: string;
    temporaryPassword: string;
  } | null>(null);
  const [companyForm, setCompanyForm] = useState(initialCompanyForm);

  useEffect(() => {
    if (!companyDetails[activeCompany.id]) {
      void refreshCompanyDetail(activeCompany.id);
    }
  }, [activeCompany.id, companyDetails, refreshCompanyDetail]);

  const visibleCompanies = useMemo(
    () =>
      companies.filter((company) =>
        [company.tradeName, company.legalName, company.taxId, company.countryCode]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [companies, query]
  );

  const defaultModules = useMemo(
    () =>
      modules.filter((module) =>
        ["platform.companies", "platform.identity", "projects.control", "finance.core"].includes(
          module.key
        )
      ),
    [modules]
  );
  const selectedOperationalModules = useMemo(
    () =>
      companyForm.enabledModules.filter(
        (moduleKey) => !["platform.companies", "platform.identity"].includes(moduleKey)
      ),
    [companyForm.enabledModules]
  );

  function toggleModule(moduleKey: string) {
    setCompanyForm((current) => ({
      ...current,
      enabledModules: current.enabledModules.includes(moduleKey)
        ? current.enabledModules.filter((entry) => entry !== moduleKey)
        : [...current.enabledModules, moduleKey]
    }));
  }

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

      {actionError ? <ErrorBanner error={actionError} /> : null}
      {actionMessage ? (
        <Card title="Last tenant action" description="Latest successful platform-company action executed on the portfolio.">
          <div className="tagRow">
            <Badge tone="success">tenant updated</Badge>
            <Badge tone="neutral">{actionMessage}</Badge>
          </div>
        </Card>
      ) : null}

      {lastProvisioned ? (
        <Card title="Tenant provisioned" description="The backend issued the admin bootstrap credential for the newly created company.">
          <div className="tagRow">
            <Badge tone="success">{lastProvisioned.companyName}</Badge>
            <Badge tone="gold">{lastProvisioned.temporaryPassword}</Badge>
          </div>
        </Card>
      ) : null}

      <section className="grid cols2">
        <Card title="Tenant portfolio" description="Each company carries its own module entitlements, settings and user base.">
          <FilterBar summary={`${visibleCompanies.length} tenants match the current search`}>
            <Badge tone={source === "api" && session.authenticated ? "success" : "warning"}>
              {source === "api" && session.authenticated ? "api list" : "fallback list"}
            </Badge>
            <Badge tone={isRefreshingPlatform ? "info" : "gold"}>
              {isRefreshingPlatform ? "refreshing" : "detail ready"}
            </Badge>
            <input
              className="field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by company, tax id or country"
            />
          </FilterBar>
          <DataTable
            rows={visibleCompanies}
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
              },
              {
                key: "actions",
                label: "Actions",
                render: (company) => (
                  <button
                    className="buttonGhost"
                  type="button"
                  onClick={() => {
                    setActionError(null);
                    setActionMessage(null);
                    setActiveCompanyId(company.id);
                  }}
                >
                    Open
                  </button>
                )
              }
            ]}
          />
        </Card>

        <div style={{ display: "grid", gap: 24 }}>
          <Card title="Provision company" description="Creates a new tenant, bootstrap admin user and default settings via POST /platform/provision-company.">
            <div className="detailGrid">
              <label className="detailRow">
                <div className="detailLabel">Trade name</div>
                <input
                  className="field"
                  value={companyForm.tradeName}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, tradeName: event.target.value }))
                  }
                />
              </label>
              <label className="detailRow">
                <div className="detailLabel">Legal name</div>
                <input
                  className="field"
                  value={companyForm.legalName}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, legalName: event.target.value }))
                  }
                />
              </label>
              <label className="detailRow">
                <div className="detailLabel">Tax ID</div>
                <input
                  className="field"
                  value={companyForm.taxId}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, taxId: event.target.value }))
                  }
                />
              </label>
              <label className="detailRow">
                <div className="detailLabel">Admin full name</div>
                <input
                  className="field"
                  value={companyForm.adminFullName}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, adminFullName: event.target.value }))
                  }
                />
              </label>
              <label className="detailRow">
                <div className="detailLabel">Admin email</div>
                <input
                  className="field"
                  value={companyForm.adminEmail}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, adminEmail: event.target.value }))
                  }
                />
              </label>
              <label className="detailRow">
                <div className="detailLabel">Currency</div>
                <input
                  className="field"
                  value={companyForm.currency}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                  }
                />
              </label>
              <label className="detailRow">
                <div className="detailLabel">Timezone</div>
                <input
                  className="field"
                  value={companyForm.timezone}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, timezone: event.target.value }))
                  }
                />
              </label>
              <label className="detailRow">
                <div className="detailLabel">Fiscal regime</div>
                <input
                  className="field"
                  value={companyForm.fiscalRegime}
                  onChange={(event) =>
                    setCompanyForm((current) => ({ ...current, fiscalRegime: event.target.value }))
                  }
                />
              </label>
              <div className="detailRow" style={{ alignItems: "start" }}>
                <div className="detailLabel">Starter modules</div>
                <div className="tagRow">
                  {defaultModules.map((module) => {
                    const enabled = companyForm.enabledModules.includes(module.key);

                    return (
                      <button
                        key={module.key}
                        className={enabled ? "button" : "buttonGhost"}
                        type="button"
                        onClick={() => toggleModule(module.key)}
                      >
                        {module.name}
                      </button>
                    );
                  })}
                  {defaultModules.length === 0 ? <span className="tableCellMuted">No starter modules available.</span> : null}
                </div>
              </div>
            </div>
            <div className="tagRow" style={{ marginTop: 16 }}>
              {selectedOperationalModules.map((moduleKey) => (
                <Badge key={moduleKey} tone="info">
                  {getModuleByKey(moduleKey)?.name ?? moduleKey}
                </Badge>
              ))}
            </div>
            <div className="emptyActions">
              <button
                className="button"
                type="button"
                disabled={isProvisioningCompany}
                onClick={async () => {
                  setActionError(null);
                  setActionMessage(null);
                  setLastProvisioned(null);
                  const normalizedForm = {
                    ...companyForm,
                    tradeName: companyForm.tradeName.trim(),
                    legalName: companyForm.legalName.trim(),
                    taxId: companyForm.taxId.trim().toUpperCase(),
                    adminFullName: companyForm.adminFullName.trim(),
                    adminEmail: companyForm.adminEmail.trim().toLowerCase(),
                    currency: companyForm.currency.trim().toUpperCase(),
                    timezone: companyForm.timezone.trim(),
                    fiscalRegime: companyForm.fiscalRegime.trim()
                  };
                  const validationMessage = validateCompanyForm(normalizedForm);

                  if (validationMessage) {
                    setActionError({
                      code: "PLATFORM_COMPANY_FORM_INVALID",
                      message: validationMessage
                    });
                    return;
                  }

                  const result = await createCompany({
                    ...normalizedForm,
                    enabledModules: normalizedForm.enabledModules.filter((moduleKey) => getModuleByKey(moduleKey))
                  });

                  if (result.error) {
                    setActionError(result.error);
                    return;
                  }

                  if (result.data) {
                    setLastProvisioned({
                      companyName: result.data.company.tradeName,
                      temporaryPassword: result.data.temporaryPassword
                    });
                    setActionMessage(`${result.data.company.tradeName} provisioned with ${result.data.company.enabledModules.length} modules.`);
                    setCompanyForm(initialCompanyForm);
                    setActiveCompanyId(result.data.company.id);
                    await refreshCompanyDetail(result.data.company.id);
                  }
                }}
              >
                {isProvisioningCompany ? "Provisioning..." : "Provision tenant"}
              </button>
            </div>
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
              <div className="detailRow">
                <div className="detailLabel">Fiscal</div>
                <div>{detail.settings.fiscalCountry} · regime {detail.settings.fiscalRegime}</div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Tenant actions</div>
                <div className="row gap wrap">
                  <Link className="button secondary" href="/platform/settings">
                    Open settings
                  </Link>
                  <Link className="buttonGhost" href="/platform/users">
                    Open users
                  </Link>
                </div>
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
        </div>
      </section>
    </AppShell>
  );
}
