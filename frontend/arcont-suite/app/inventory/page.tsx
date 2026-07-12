"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { inventoryRows } from "@/lib/route-mocks";

export default function InventoryPage() {
  return (
    <AppShell
      title="Inventory and warehouse"
      eyebrow="Execution domain"
      description="Traceable stock posture for central warehouses, jobsites and replenishment decisions."
    >
      <ModuleGate moduleKeys={["inventory.warehouse"]} requiredPermissions={["inventory:*"]} title="Inventory">
        <section className="grid cols4">
          <KpiCard label="Tracked SKUs" value="6,040" footnote="Multi-location stock structure grounded in operational language." />
          <KpiCard label="Accuracy" value="97.2%" footnote="Supports future cycle-count and variance analysis." />
          <KpiCard label="Open variances" value="7" footnote="Control signals tied to field supply reliability." />
          <KpiCard label="Urgent replenishments" value="5" footnote="Early proof that this route is not just a static stock table." />
        </section>

        <Card title="Warehouse health" description="First useful layer for stock traceability and supply execution.">
          <DataTable
            rows={inventoryRows}
            columns={[
              { key: "location", label: "Location", render: (row) => row[0] },
              { key: "coverage", label: "Coverage", render: (row) => row[1] },
              { key: "accuracy", label: "Accuracy", render: (row) => row[2] },
              { key: "signal", label: "Signal", render: (row) => row[3] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
