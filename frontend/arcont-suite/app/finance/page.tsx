"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { financeRows } from "@/lib/route-mocks";

export default function FinancePage() {
  return (
    <AppShell
      title="Finance and accounting"
      eyebrow="Execution domain"
      description="Cash posture, payable pressure and close-readiness with room to absorb real accounting workflows later."
    >
      <ModuleGate moduleKeys={["finance.accounting"]} title="Finance">
        <section className="grid cols4">
          <KpiCard label="Cash position" value="MXN 18.4M" footnote="Executive finance readout integrated into the same shell as operations." />
          <KpiCard label="Urgent payables" value="12" footnote="A signal that can later map to approval queues and ERP integrations." />
          <KpiCard label="Close readiness" value="92%" footnote="Prepared for monthly close and compliance workflows." />
          <KpiCard label="SAT posture" value="Controlled" footnote="Ties directly to company settings and fiscal setup." />
        </section>

        <Card title="Finance board" description="Compact but meaningful coverage for treasury and accounting leadership.">
          <DataTable
            rows={financeRows}
            columns={[
              { key: "metric", label: "Metric", render: (row) => row[0] },
              { key: "value", label: "Value", render: (row) => row[1] },
              { key: "trend", label: "Trend", render: (row) => row[2] },
              { key: "note", label: "Note", render: (row) => row[3] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
