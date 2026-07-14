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
import type { PlatformApiErrorContract, UserContract } from "@/lib/contracts";

function ErrorBanner({ error }: { error: PlatformApiErrorContract["error"] }) {
  const tone = error.code === "PLATFORM_LAST_ACTIVE_USER" ? "danger" : "warning";

  return (
    <div className="emptyState" style={{ padding: 20 }}>
      <div className="tagRow">
        <Badge tone={tone}>{error.code}</Badge>
        {error.code === "PLATFORM_LAST_ACTIVE_USER" ? (
          <Badge tone="danger">Cannot disable last active user</Badge>
        ) : null}
      </div>
      <p style={{ marginTop: 12 }}>{error.message}</p>
    </div>
  );
}

function validateUserCreateForm(input: {
  fullName: string;
  email: string;
  roleKey: string;
}) {
  if (input.fullName.trim().length < 3) {
    return "Full name must be specific before creating the user.";
  }

  if (!input.email.includes("@")) {
    return "A valid email is required before creating the user.";
  }

  if (!input.roleKey) {
    return "Select a role before creating the user.";
  }

  return null;
}

export default function PlatformUsersPage() {
  const {
    activeCompany,
    activeUsers,
    changeUserRole,
    changeUserStatus,
    companies,
    createUser,
    isRefreshingPlatform,
    isRouteVisible,
    isSavingUsers,
    refreshUserDetail,
    refreshUsers,
    roles,
    session,
    source,
    userDetails
  } = useAppState();
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<PlatformApiErrorContract["error"] | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastCreatedPassword, setLastCreatedPassword] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    companyId: activeCompany.id,
    fullName: "",
    email: "",
    roleKey: roles[0]?.key ?? "",
    status: "invited" as UserContract["status"]
  });
  const [detailDraft, setDetailDraft] = useState({
    roleKey: "",
    status: "active" as UserContract["status"]
  });

  useEffect(() => {
    setCreateForm((current) => ({
      ...current,
      companyId: activeCompany.id
    }));
    void refreshUsers(activeCompany.id);
  }, [activeCompany.id, refreshUsers]);

  useEffect(() => {
    if (!selectedUserId && activeUsers[0]) {
      setSelectedUserId(activeUsers[0].id);
    }
  }, [activeUsers, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      return;
    }

    void refreshUserDetail(selectedUserId);
  }, [refreshUserDetail, selectedUserId]);

  const selectedDetail = selectedUserId ? userDetails[selectedUserId] : null;

  useEffect(() => {
    if (!selectedDetail) {
      return;
    }

    setDetailDraft({
      roleKey: selectedDetail.user.roleKey,
      status: selectedDetail.user.status
    });
  }, [selectedDetail]);

  const visibleUsers = useMemo(
    () =>
      activeUsers.filter((user) =>
        [user.fullName, user.email, user.roleKey, activeCompany.tradeName]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [activeCompany.tradeName, activeUsers, query]
  );
  const activeUserCount = useMemo(
    () => activeUsers.filter((user) => user.status === "active").length,
    [activeUsers]
  );
  const availableRoles = useMemo(() => roles.filter((role) => role.scope !== "platform"), [roles]);

  if (!isRouteVisible({ moduleKeys: ["platform.identity"], requiredPermissions: ["users:*", "users:read"] })) {
    return (
      <AppShell
        title="Identity and users"
        eyebrow="Platform identity"
        description="Company-aware users, roles and lifecycle states ready to connect with richer access-control flows."
      >
        <EmptyState
          title="User administration is not available for this session"
          description="The route is gated by platform identity module visibility and user management permissions."
          primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          secondaryAction={{ label: "Review login", href: "/login" }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Identity and users"
      eyebrow="Platform identity"
      description="Live user administration for the active tenant, backed by platform user endpoints and normalized backend errors."
    >
      <section className="grid cols4">
        <KpiCard label="Users in tenant" value={String(activeUsers.length)} footnote={`Identity view scoped to ${activeCompany.tradeName}.`} />
        <KpiCard label="Active users" value={String(activeUserCount)} footnote="Operationally available accounts." />
        <KpiCard label="Invitations" value={String(activeUsers.filter((user) => user.status === "invited").length)} footnote="Pending onboarding and access provisioning." />
        <KpiCard label="Roles" value={String(roles.length)} footnote="Roles are read from the live platform catalog." />
      </section>

      {actionError ? <ErrorBanner error={actionError} /> : null}
      {actionMessage ? (
        <Card title="Last identity action" description="Latest successful user-management action applied to the active tenant.">
          <div className="tagRow">
            <Badge tone="success">identity updated</Badge>
            <Badge tone="neutral">{actionMessage}</Badge>
          </div>
        </Card>
      ) : null}

      {lastCreatedPassword ? (
        <Card title="Temporary password issued" description="The backend returned a temporary credential for the newly created user.">
          <div className="tagRow">
            <Badge tone="success">user created</Badge>
            <Badge tone="gold">{lastCreatedPassword}</Badge>
          </div>
        </Card>
      ) : null}

      <section className="grid cols2">
        <Card title="Tenant user roster" description="This list now consumes GET /platform/users?companyId=... for the active tenant.">
          <FilterBar summary={`${visibleUsers.length} users match the current search`}>
            <Badge tone={source === "api" && session.authenticated ? "success" : "warning"}>
              {source === "api" && session.authenticated ? "live users api" : "fallback users"}
            </Badge>
            <Badge tone={isRefreshingPlatform ? "info" : "neutral"}>
              {isRefreshingPlatform ? "refreshing" : companies.find((company) => company.id === activeCompany.id)?.tradeName}
            </Badge>
            <input
              className="field"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email or role"
            />
          </FilterBar>
          <DataTable
            rows={visibleUsers}
            columns={[
              {
                key: "name",
                label: "Name",
                render: (user) => (
                  <div className="tableCellStack">
                    <strong>{user.fullName}</strong>
                    <span className="tableCellMuted mono">{user.id}</span>
                  </div>
                )
              },
              {
                key: "email",
                label: "Email",
                render: (user) => user.email
              },
              {
                key: "company",
                label: "Company",
                render: () => activeCompany.tradeName
              },
              {
                key: "role",
                label: "Role",
                render: (user) =>
                  roles.find((role) => role.key === user.roleKey)?.name ?? user.roleKey
              },
              {
                key: "status",
                label: "Status",
                render: (user) => (
                  <Badge
                    tone={
                      user.status === "active"
                        ? "success"
                        : user.status === "invited"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {user.status}
                  </Badge>
                )
              },
              {
                key: "actions",
                label: "Actions",
                render: (user) => (
                  <button
                    className="buttonGhost"
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setActionError(null);
                    }}
                  >
                    View
                  </button>
                )
              }
            ]}
          />
        </Card>

        <Card title="Create user" description="Creates a platform user through POST /platform/users.">
          <div className="detailGrid">
            <label className="detailRow">
              <div className="detailLabel">Company</div>
              <select
                className="selectField"
                value={createForm.companyId}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, companyId: event.target.value }))
                }
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.tradeName}
                  </option>
                ))}
              </select>
            </label>
            <label className="detailRow">
              <div className="detailLabel">Full name</div>
              <input
                className="field"
                value={createForm.fullName}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Email</div>
              <input
                className="field"
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label className="detailRow">
              <div className="detailLabel">Role</div>
              <select
                className="selectField"
                value={createForm.roleKey}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, roleKey: event.target.value }))
                }
              >
                <option value="">Select role</option>
                {availableRoles.map((role) => (
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
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    status: event.target.value as UserContract["status"]
                  }))
                }
              >
                <option value="invited">invited</option>
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </label>
          </div>
          <div className="emptyActions">
            <button
              className="button"
              type="button"
              disabled={isSavingUsers}
              onClick={async () => {
                setActionError(null);
                setActionMessage(null);
                setLastCreatedPassword(null);
                const normalizedForm = {
                  ...createForm,
                  fullName: createForm.fullName.trim(),
                  email: createForm.email.trim().toLowerCase()
                };
                const validationMessage = validateUserCreateForm(normalizedForm);

                if (validationMessage) {
                  setActionError({
                    code: "PLATFORM_USER_FORM_INVALID",
                    message: validationMessage
                  });
                  return;
                }

                const result = await createUser(normalizedForm);

                if (result.error) {
                  setActionError(result.error);
                  return;
                }

                if (result.data && "temporaryPassword" in result.data) {
                  setLastCreatedPassword(result.data.temporaryPassword);
                  setActionMessage(`${result.data.user.fullName} created in ${activeCompany.tradeName}.`);
                  setCreateForm((current) => ({
                    ...current,
                    fullName: "",
                    email: ""
                  }));
                  setSelectedUserId(result.data.user.id);
                }
              }}
            >
              {isSavingUsers ? "Creating..." : "Create user"}
            </button>
          </div>
        </Card>
      </section>

      <Card title="User detail" description="Detail, role change and status change are backed by live user endpoints.">
        {selectedDetail ? (
          <div className="grid cols2">
            <div className="detailGrid">
              <div className="detailRow">
                <div className="detailLabel">Name</div>
                <div>{selectedDetail.user.fullName}</div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Email</div>
                <div>{selectedDetail.user.email}</div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Company</div>
                <div>{selectedDetail.company.tradeName}</div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Permissions</div>
                <div className="tagRow">
                  {selectedDetail.permissions.map((permission) => (
                    <span className="tag" key={permission}>
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
              <div className="detailRow">
                <div className="detailLabel">Tenant actions</div>
                <div className="row gap wrap">
                  <Link className="button secondary" href="/platform/settings">
                    Open settings
                  </Link>
                  <Link className="buttonGhost" href="/platform/companies">
                    Open companies
                  </Link>
                </div>
              </div>
            </div>

            <div className="detailGrid">
              <label className="detailRow">
                <div className="detailLabel">Role</div>
                <select
                  className="selectField"
                  value={detailDraft.roleKey}
                  onChange={(event) =>
                    setDetailDraft((current) => ({ ...current, roleKey: event.target.value }))
                  }
                >
                  {availableRoles.map((role) => (
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
                  value={detailDraft.status}
                  onChange={(event) =>
                    setDetailDraft((current) => ({
                      ...current,
                      status: event.target.value as UserContract["status"]
                    }))
                  }
                >
                  <option value="invited">invited</option>
                  <option value="active">active</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
              <div className="emptyActions">
                <button
                  className="button"
                  type="button"
                  disabled={isSavingUsers || detailDraft.roleKey === selectedDetail.user.roleKey}
                  onClick={async () => {
                    setActionError(null);
                    setActionMessage(null);
                    const result = await changeUserRole(selectedDetail.user.id, {
                      roleKey: detailDraft.roleKey
                    });

                    if (result.error) {
                      setActionError(result.error);
                      return;
                    }

                    setActionMessage(`Role updated for ${selectedDetail.user.fullName}.`);
                  }}
                >
                  {isSavingUsers ? "Saving..." : "Change role"}
                </button>
                <button
                  className="buttonGhost"
                  type="button"
                  disabled={isSavingUsers || detailDraft.status === selectedDetail.user.status}
                  onClick={async () => {
                    setActionError(null);
                    setActionMessage(null);
                    if (
                      selectedDetail.user.status === "active" &&
                      detailDraft.status !== "active" &&
                      activeUserCount <= 1
                    ) {
                      setActionError({
                        code: "PLATFORM_LAST_ACTIVE_USER",
                        message: "Cannot disable the last active user in the tenant."
                      });
                      return;
                    }

                    const result = await changeUserStatus(selectedDetail.user.id, {
                      status: detailDraft.status
                    });

                    if (result.error) {
                      setActionError(result.error);
                      return;
                    }

                    setActionMessage(`Status updated for ${selectedDetail.user.fullName}.`);
                  }}
                >
                  {isSavingUsers ? "Saving..." : "Change status"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Select a user to inspect details"
            description="The detail panel consumes GET /platform/users/:userId and lets you update role and status from the same workspace."
            primaryAction={{ label: "Stay on users", href: "/platform/users" }}
          />
        )}
      </Card>
    </AppShell>
  );
}
