"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";

export default function PlatformUsersPage() {
  const { activeCompany, activeUsers, roles } = useAppState();
  const [query, setQuery] = useState("");

  const visibleUsers = activeUsers.filter((user) =>
    [user.fullName, user.email, user.roleKey].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AppShell
      title="Identity and users"
      eyebrow="Platform identity"
      description="Company-aware users, roles and lifecycle states ready to connect with richer access-control flows."
    >
      <section className="grid cols4">
        <KpiCard label="Users in tenant" value={String(activeUsers.length)} footnote={`Identity view scoped to ${activeCompany.tradeName}.`} />
        <KpiCard label="Active users" value={String(activeUsers.filter((user) => user.status === "active").length)} footnote="Operationally available accounts." />
        <KpiCard label="Invitations" value={String(activeUsers.filter((user) => user.status === "invited").length)} footnote="Pending onboarding and access provisioning." />
        <KpiCard label="Roles" value={String(roles.length)} footnote="Roles come from the shared contract package." />
      </section>

      <Card title="Tenant user roster" description="Filtering and role lookup are already wired at the shell level.">
        <FilterBar summary={`${visibleUsers.length} users match the current search`}>
          <input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email or role" />
        </FilterBar>
        <DataTable
          rows={visibleUsers}
          columns={[
            {
              key: "user",
              label: "User",
              render: (user) => (
                <div className="tableCellStack">
                  <strong>{user.fullName}</strong>
                  <span className="tableCellMuted">{user.email}</span>
                </div>
              )
            },
            {
              key: "role",
              label: "Role",
              render: (user) => (
                <div className="tableCellStack">
                  <strong>{roles.find((role) => role.key === user.roleKey)?.name ?? user.roleKey}</strong>
                  <span className="tableCellMuted mono">{user.roleKey}</span>
                </div>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (user) => <Badge tone={user.status === "active" ? "success" : user.status === "invited" ? "warning" : "danger"}>{user.status}</Badge>
            }
          ]}
        />
      </Card>
    </AppShell>
  );
}
