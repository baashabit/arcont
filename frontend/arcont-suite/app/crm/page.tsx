"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { crmLeads } from "@/lib/route-mocks";

export default function CrmPage() {
  return (
    <AppShell
      title="Sales and CRM"
      eyebrow="Customer operations"
      description="Lead pressure, conversion and unit demand in a structure meant to grow into a full commercial cockpit."
    >
      <ModuleGate moduleKeys={["sales.crm"]} title="Sales / CRM">
        <section className="grid cols4">
          <KpiCard label="Qualified leads" value="188" footnote="Highest-priority opportunities ready for advisor action." />
          <KpiCard label="Visit conversion" value="24%" footnote="Structured as a reusable KPI pattern for the rest of the suite." />
          <KpiCard label="Reservations" value="54" footnote="Direct link between CRM signals and unit inventory pressure." />
          <KpiCard label="Forecast revenue" value="MXN 74.8M" footnote="Commercial readout designed for executive and frontline users." />
        </section>

        <section className="grid cols2">
          <Card title="Pipeline health" description="Commercial work with enough substance to validate the shell direction.">
            <div className="list">
              <div className="listItem">
                <div>
                  <strong>Top funnel demand</strong>
                  <p>Marketing and broker channels are feeding a stable pipeline, but intent scoring is still uneven by project.</p>
                </div>
              </div>
              <div className="listItem">
                <div>
                  <strong>Reservation risk</strong>
                  <p>Document collection and mortgage pre-approvals remain the main drag on close velocity.</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Priority segments" description="Quick segmentation makes this route usable from day one.">
            <div className="tagRow">
              <span className="tag">investor demand</span>
              <span className="tag">primary home</span>
              <span className="tag">government housing</span>
              <span className="tag">repeat buyers</span>
            </div>
          </Card>
        </section>

        <Card title="Opportunity board" description="A minimal but real view of portfolio-level lead pressure.">
          <DataTable
            rows={crmLeads}
            columns={[
              { key: "project", label: "Project", render: (row) => row[0] },
              { key: "segment", label: "Segment", render: (row) => row[1] },
              { key: "volume", label: "Open opportunities", render: (row) => row[2] },
              { key: "conversion", label: "Conversion", render: (row) => row[3] },
              { key: "signal", label: "Signal", render: (row) => row[4] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
