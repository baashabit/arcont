"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import type { ModuleContract, PlatformSystemReadinessContract, RoleContract, UserContract } from "@/lib/contracts";
import { fetchPlatformSystemReadiness } from "@/lib/platform-api";

function readinessTone(status: "ready" | "warning" | "blocked") {
  switch (status) {
    case "ready":
      return "success";
    case "warning":
      return "warning";
    default:
      return "danger";
  }
}

const requiredPlatformModules = new Set(["platform.companies", "platform.identity"]);

function validateSettingsForm(input: {
  timezone: string;
  locale: string;
  currency: string;
  fiscalCountry: string;
  satEnabled: boolean;
  fiscalRegime: string;
}) {
  if (!input.timezone.includes("/")) {
    return "Timezone must use an IANA zone such as America/Merida.";
  }

  if (input.locale.trim().length < 4) {
    return "Locale must be specific before saving company settings.";
  }

  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) {
    return "Currency must use a 3-letter code such as MXN.";
  }

  if (!/^[A-Z]{2}$/.test(input.fiscalCountry.trim().toUpperCase())) {
    return "Fiscal country must use a 2-letter country code.";
  }

  if (input.fiscalCountry === "MX") {
    if (input.currency !== "MXN") {
      return "Mexican companies must keep MXN as base currency.";
    }

    if (!input.locale.startsWith("es-MX")) {
      return "Mexican companies must keep an es-MX locale.";
    }

    if (input.satEnabled && !/^\d{3}$/.test(input.fiscalRegime.trim())) {
      return "SAT-enabled tenants require a 3-digit fiscal regime.";
    }
  }

  return null;
}

function recommendedModuleTone(enabled: boolean, required: boolean) {
  if (required) {
    return "success" as const;
  }

  return enabled ? "info" as const : "warning" as const;
}

const emptyUserForm = {
  fullName: "",
  email: "",
  roleKey: "",
  status: "invited" as UserContract["status"]
};

export default function PlatformSettingsPage() {
  const {
    activeCompany,
    activeSettings,
    activeUsers,
    apiBaseUrl,
    createUser,
    getCompanyModules,
    isProvisioningCompany,
    isRouteVisible,
    isSavingModules,
    isSavingSettings,
    isSavingUsers,
    modules,
    refreshCompanyDetail,
    roles,
    saveSettings,
    saveCompanyModules,
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
  const [readiness, setReadiness] = useState<PlatformSystemReadinessContract | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);
  const [modulesMessage, setModulesMessage] = useState<string | null>(null);
  const [modulesError, setModulesError] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [modulesFilter, setModulesFilter] = useState("");
  const [usersFilter, setUsersFilter] = useState("");
  const [readinessFilter, setReadinessFilter] = useState<"all" | "ready" | "warning" | "blocked">("all");
  const [userForm, setUserForm] = useState(emptyUserForm);

  useEffect(() => {
    void refreshCompanyDetail(activeCompany.id);
  }, [activeCompany.id, refreshCompanyDetail]);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setReadiness(null);
      return;
    }

    let cancelled = false;

    void fetchPlatformSystemReadiness(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    }).then((result) => {
      if (!cancelled) {
        setReadiness(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

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

  useEffect(() => {
    const currentModules = getCompanyModules(activeCompany.id)
      .filter((entry) => entry.enabled)
      .map((entry) => entry.module.key);
    setModuleKeys(currentModules);
  }, [activeCompany.id, getCompanyModules]);

  useEffect(() => {
    setUserForm((current) => ({
      ...current,
      roleKey: current.roleKey || roles.find((role) => role.scope !== "platform")?.key || ""
    }));
  }, [roles]);

  const companyModules = useMemo(() => getCompanyModules(activeCompany.id), [activeCompany.id, getCompanyModules]);
  const availableRoles = useMemo(() => roles.filter((role) => role.scope !== "platform"), [roles]);
  const enabledModules = useMemo(
    () => companyModules.filter((entry) => moduleKeys.includes(entry.module.key)),
    [companyModules, moduleKeys]
  );
  const operationalModules = useMemo(
    () => modules.filter((module) => module.area !== "platform"),
    [modules]
  );

  const filteredCompanyModules = useMemo(() => {
    const normalizedFilter = modulesFilter.trim().toLowerCase();
    return companyModules.filter((entry) =>
      normalizedFilter.length === 0 ||
      entry.module.name.toLowerCase().includes(normalizedFilter) ||
      entry.module.description.toLowerCase().includes(normalizedFilter) ||
      entry.module.area.toLowerCase().includes(normalizedFilter)
    );
  }, [companyModules, modulesFilter]);

  const filteredReadinessChecks = useMemo(() => {
    if (!readiness) {
      return [];
    }

    return readiness.checks.filter((check) => readinessFilter === "all" || check.status === readinessFilter);
  }, [readiness, readinessFilter]);

  const filteredUsers = useMemo(() => {
    const normalizedFilter = usersFilter.trim().toLowerCase();
    return activeUsers.filter((user) =>
      normalizedFilter.length === 0 ||
      user.fullName.toLowerCase().includes(normalizedFilter) ||
      user.email.toLowerCase().includes(normalizedFilter) ||
      user.roleKey.toLowerCase().includes(normalizedFilter)
    );
  }, [activeUsers, usersFilter]);

  async function handleSaveSettings() {
    const nextForm = {
      timezone: form.timezone.trim(),
      locale: form.locale.trim(),
      currency: form.currency.trim().toUpperCase(),
      fiscalCountry: form.fiscalCountry.trim().toUpperCase(),
      satEnabled: form.satEnabled,
      fiscalRegime: form.fiscalRegime.trim()
    };
    const validationMessage = validateSettingsForm(nextForm);

    if (validationMessage) {
      setSettingsError(validationMessage);
      setSettingsMessage(null);
      return;
    }

    setSettingsError(null);
    setSettingsMessage(null);

    const saved = await saveSettings(activeCompany.id, nextForm);
    if (!saved) {
      setSettingsError("Company settings could not be saved to the live backend.");
      return;
    }

    setForm(saved);
    setSettingsMessage("Company settings persisted successfully.");
  }

  function handleToggleModule(module: ModuleContract) {
    const required = requiredPlatformModules.has(module.key);

    setModuleKeys((current) => {
      if (required) {
        return current.includes(module.key) ? current : [...current, module.key];
      }

      return current.includes(module.key)
        ? current.filter((key) => key !== module.key)
        : [...current, module.key];
    });
    setModulesError(null);
    setModulesMessage(null);
  }

  async function handleSaveModules() {
    const nextModuleKeys = Array.from(new Set([...moduleKeys, ...requiredPlatformModules]));

    if (nextModuleKeys.filter((key) => !requiredPlatformModules.has(key)).length === 0) {
      setModulesError("Enable at least one non-platform module for the tenant.");
      setModulesMessage(null);
      return;
    }

    setModulesError(null);
    setModulesMessage(null);

    const saved = await saveCompanyModules(activeCompany.id, nextModuleKeys);
    if (!saved) {
      setModulesError("Company modules could not be persisted right now.");
      return;
    }

    setModuleKeys(saved.filter((entry) => entry.enabled).map((entry) => entry.module.key));
    setModulesMessage("Enabled modules updated for the active tenant.");
  }

  async function handleCreateUser() {
    const fullName = userForm.fullName.trim();
    const email = userForm.email.trim().toLowerCase();
    const selectedRole = availableRoles.find((role) => role.key === userForm.roleKey);

    if (fullName.length < 3) {
      setUserError("Full name must be specific before creating the user.");
      setUserMessage(null);
      return;
    }

    if (!email.includes("@")) {
      setUserError("A valid email is required before creating the user.");
      setUserMessage(null);
      return;
    }

    if (!selectedRole) {
      setUserError("Select a valid company role before creating the user.");
      setUserMessage(null);
      return;
    }

    setUserError(null);
    setUserMessage(null);

    const result = await createUser({
      companyId: activeCompany.id,
      fullName,
      email,
      roleKey: selectedRole.key,
      status: userForm.status
    });

    if (!result.data) {
      setUserError(result.error?.message ?? "User creation failed.");
      return;
    }

    setUserMessage(
      "temporaryPassword" in result.data
        ? `${result.data.user.fullName} created with temporary password ${result.data.temporaryPassword}.`
        : `${result.data.user.fullName} created successfully.`
    );
    setUserForm({
      ...emptyUserForm,
      roleKey: selectedRole.key
    });
  }

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
          onClick={() => void handleSaveSettings()}
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

      <section className="grid cols4">
        <KpiCard
          label="Enabled modules"
          value={String(enabledModules.length)}
          footnote="Modules currently enabled for this tenant."
        />
        <KpiCard
          label="Active users"
          value={String(activeUsers.filter((user) => user.status === "active").length)}
          footnote="Users already active inside the tenant domain."
        />
        <KpiCard
          label="Readiness score"
          value={readiness ? `${readiness.summary.score}%` : "Pending"}
          footnote="Cross-domain tenant posture for onboarding, demo and rollout readiness."
        />
        <KpiCard
          label="Ready checks"
          value={String(readiness?.summary.readyChecks ?? 0)}
          footnote="Checks already covered by the active tenant setup."
        />
        <KpiCard
          label="Warnings"
          value={String(readiness?.summary.warningChecks ?? 0)}
          footnote="Checks that still need reinforcement before full rollout."
        />
        <KpiCard
          label="Blocked"
          value={String(readiness?.summary.blockedChecks ?? 0)}
          footnote="Checks that will block a realistic production-style demo."
        />
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

          <div className="row gap wrap" style={{ marginTop: 16 }}>
            {settingsError ? <Badge tone="danger">{settingsError}</Badge> : null}
            {settingsMessage ? <Badge tone="success">{settingsMessage}</Badge> : null}
          </div>
        </Card>

        <Card
          title="System readiness"
          description="This tenant score now comes from the backend and checks whether identity, fiscal setup, enabled modules, seeded operations and audit trace are strong enough."
        >
          {readiness ? (
            <>
              <FilterBar summary={`${filteredReadinessChecks.length} readiness checks match the current filter`}>
                <select className="selectField" value={readinessFilter} onChange={(event) => setReadinessFilter(event.target.value as typeof readinessFilter)}>
                  <option value="all">All checks</option>
                  <option value="ready">Ready</option>
                  <option value="warning">Warning</option>
                  <option value="blocked">Blocked</option>
                </select>
              </FilterBar>
              <div className="list">
              {filteredReadinessChecks.map((check) => (
                <div className="listItem" key={check.key}>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.detail}</p>
                    <p>{check.action}</p>
                  </div>
                  <Badge tone={readinessTone(check.status)}>{check.status}</Badge>
                </div>
              ))}
              </div>
            </>
          ) : (
            <div className="list">
              <div className="listItem">
                <div>
                  <strong>Readiness snapshot unavailable</strong>
                  <p>The system could not fetch tenant readiness from the live backend.</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      </section>

      <section className="grid cols3">
        <Card
          title="Module control"
          description="This tenant can enable only the capabilities it really needs while platform identity remains mandatory."
        >
          <FilterBar summary={`${filteredCompanyModules.length} modules match the current search`}>
            <input className="field" type="search" value={modulesFilter} onChange={(event) => setModulesFilter(event.target.value)} placeholder="Module, area or description" style={{ minWidth: 220 }} />
          </FilterBar>
          <div className="list">
            {filteredCompanyModules.map((entry) => {
              const required = requiredPlatformModules.has(entry.module.key);
              const enabled = moduleKeys.includes(entry.module.key);

              return (
                <div className="listItem" key={entry.module.key}>
                  <div>
                    <strong>{entry.module.name}</strong>
                    <p>{entry.module.description}</p>
                    <p>{entry.module.area} · {required ? "required" : "optional"}</p>
                  </div>
                  <button
                    className={enabled ? "button" : "buttonGhost"}
                    type="button"
                    disabled={required}
                    onClick={() => handleToggleModule(entry.module)}
                  >
                    {enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="tagRow" style={{ marginTop: 16 }}>
            {enabledModules.slice(0, 8).map((entry) => (
              <Badge
                key={entry.module.key}
                tone={recommendedModuleTone(true, requiredPlatformModules.has(entry.module.key))}
              >
                {entry.module.name}
              </Badge>
            ))}
          </div>

          <div className="row gap wrap" style={{ marginTop: 16 }}>
            <button className="button" type="button" disabled={isSavingModules} onClick={() => void handleSaveModules()}>
              {isSavingModules ? "Saving..." : "Save modules"}
            </button>
            {modulesError ? <Badge tone="danger">{modulesError}</Badge> : null}
            {modulesMessage ? <Badge tone="success">{modulesMessage}</Badge> : null}
          </div>
        </Card>

        <Card
          title="Tenant users"
          description="Create implementation users directly inside the active company without leaving the platform domain."
        >
          <FilterBar summary={`${filteredUsers.length} users match the current search`}>
            <input className="field" type="search" value={usersFilter} onChange={(event) => setUsersFilter(event.target.value)} placeholder="User, email or role" style={{ minWidth: 220 }} />
          </FilterBar>
          <div className="detailGrid">
            <label className="detailRow">
              <div className="detailLabel">Full name</div>
              <input
                className="field"
                value={userForm.fullName}
                onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))}
                placeholder="Luis Almada"
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Email</div>
              <input
                className="field"
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="luis@empresa.com"
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Role</div>
              <select
                className="selectField"
                value={userForm.roleKey}
                onChange={(event) => setUserForm((current) => ({ ...current, roleKey: event.target.value }))}
              >
                <option value="">Select role</option>
                {availableRoles.map((role: RoleContract) => (
                  <option key={role.key} value={role.key}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="detailRow">
              <div className="detailLabel">Status</div>
              <select
                className="selectField"
                value={userForm.status}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, status: event.target.value as UserContract["status"] }))
                }
              >
                <option value="invited">invited</option>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
          </div>

          <div className="row gap wrap" style={{ marginTop: 16 }}>
            <button className="button" type="button" disabled={isSavingUsers} onClick={() => void handleCreateUser()}>
              {isSavingUsers ? "Creating..." : "Create user"}
            </button>
            {userError ? <Badge tone="danger">{userError}</Badge> : null}
            {userMessage ? <Badge tone="success">{userMessage}</Badge> : null}
          </div>

          <div className="list" style={{ marginTop: 16 }}>
            {filteredUsers.slice(0, 6).map((user) => (
              <div className="listItem" key={user.id}>
                <div>
                  <strong>{user.fullName}</strong>
                  <p>{user.email}</p>
                  <p>{user.roleKey}</p>
                </div>
                <Badge tone={user.status === "active" ? "success" : user.status === "invited" ? "warning" : "danger"}>
                  {user.status}
                </Badge>
              </div>
            ))}
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
            <div className="listItem">
              <div>
                <strong>Startup implementation discipline</strong>
                <p>The tenant can now show whether it is really ready for demos, pilots and production onboarding instead of relying on assumptions.</p>
              </div>
            </div>
            <div className="listItem">
              <div>
                <strong>100% modular rollout</strong>
                <p>Each client can start with just the domains it bought and expand later without redesigning the tenant model.</p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Recommended next actions" description="The platform now exposes the exact tenant actions that should happen next.">
          <div className="list">
            {(readiness?.recommendedActions ?? ["Complete fiscal setup and expand operational data coverage."]).map((action) => (
              <div className="listItem" key={action}>
                <div>
                  <strong>Next step</strong>
                  <p>{action}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Rollout posture" description="A fast operational view of what this tenant can realistically activate next.">
          <div className="list">
            <div className="listItem">
              <div>
                <strong>Provisioning domain</strong>
                <p>{isProvisioningCompany ? "Platform is provisioning a tenant right now." : "Provisioning endpoints are already available for multi-company rollout."}</p>
              </div>
            </div>
            <div className="listItem">
              <div>
                <strong>Operational modules available</strong>
                <p>{operationalModules.length} domains can be packaged commercially without changing the platform kernel.</p>
              </div>
            </div>
            <div className="listItem">
              <div>
                <strong>Current tenant scope</strong>
                <p>{enabledModules.length} modules are enabled for {activeCompany.tradeName} right now.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
