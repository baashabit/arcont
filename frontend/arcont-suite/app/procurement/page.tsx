"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { procurementRows } from "@/lib/route-mocks";

export default function ProcurementPage() {
  return (
    <AppShell
      title="Procurement"
      eyebrow="Execution domain"
      description="Spend control, sourcing throughput and approval posture for construction-heavy buying cycles."
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} title="Procurement">
        <section className="grid cols4">
          <KpiCard label="Open requisitions" value="37" footnote="Requests with enough context to show procurement pressure from day one." />
          <KpiCard label="Avg approval time" value="29h" footnote="Designed to scale into SLA and audit reporting." />
          <KpiCard label="Strategic packages" value="8" footnote="High-value packages that need executive-level monitoring." />
          <KpiCard label="Supplier contention" value="3.2 bids" footnote="Healthy competition indicator for current sourcing rounds." />
        </section>

        <Card title="Sourcing board" description="Operational structure for requisitions, bids and award readiness.">
          <DataTable
            rows={procurementRows}
            columns={[
              { key: "package", label: "Package", render: (row) => row[0] },
              { key: "budget", label: "Budget", render: (row) => row[1] },
              { key: "bids", label: "Bids", render: (row) => row[2] },
              { key: "status", label: "Status", render: (row) => row[3] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
