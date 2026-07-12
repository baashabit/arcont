"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { integrationRows } from "@/lib/route-mocks";

export default function IntegrationsPage() {
  return (
    <AppShell
      title="Integrations, telemetry and AI"
      eyebrow="Connected operations"
      description="External systems, field telemetry and future intelligence layers represented inside the platform shell."
    >
      <ModuleGate
        moduleKeys={["integrations.field-data"]}
        requiredPermissions={["integrations:*"]}
        title="Integrations"
      >
        <Card title="Connected stack" description="A useful integration route starts by exposing source health and business confidence.">
          <DataTable
            rows={integrationRows}
            columns={[
              { key: "stream", label: "Stream", render: (row) => row[0] },
              { key: "system", label: "System", render: (row) => row[1] },
              { key: "status", label: "Status", render: (row) => row[2] },
              { key: "note", label: "Note", render: (row) => row[3] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
