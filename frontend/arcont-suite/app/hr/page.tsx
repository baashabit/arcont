"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { hrRows } from "@/lib/route-mocks";

export default function HrPage() {
  return (
    <AppShell
      title="HR and workforce"
      eyebrow="Workforce domain"
      description="Crew readiness, attendance and compliance cues for labor-intensive operations."
    >
      <ModuleGate moduleKeys={["hr.workforce"]} requiredPermissions={["hr:*"]} title="HR">
        <Card title="Workforce posture" description="A meaningful placeholder would not be enough here, so this route shows operational workforce concerns.">
          <DataTable
            rows={hrRows}
            columns={[
              { key: "area", label: "Area", render: (row) => row[0] },
              { key: "volume", label: "Volume", render: (row) => row[1] },
              { key: "signal", label: "Signal", render: (row) => row[2] },
              { key: "note", label: "Note", render: (row) => row[3] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
