"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { projectMilestones } from "@/lib/route-mocks";

export default function ProjectsPage() {
  return (
    <AppShell
      title="Projects and site control"
      eyebrow="Execution domain"
      description="Construction progress, constraints and operational traceability in a shell designed for supervision-heavy teams."
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Projects">
        <section className="grid cols4">
          <KpiCard label="Active fronts" value="7" footnote="Cross-project visibility to support portfolio supervision." />
          <KpiCard label="Average progress" value="73%" footnote="Surface-level KPI ready to connect to schedule sources later." />
          <KpiCard label="Quality holds" value="14" footnote="A route shaped for control loops, not just static reporting." />
          <KpiCard label="Permit blockers" value="3" footnote="Critical permitting issues visible alongside production signals." />
        </section>

        <Card title="Milestone board" description="Execution-focused snapshot for site control, PMO and directors.">
          <DataTable
            rows={projectMilestones}
            columns={[
              { key: "project", label: "Project", render: (row) => row[0] },
              { key: "stage", label: "Stage", render: (row) => row[1] },
              { key: "progress", label: "Progress", render: (row) => row[2] },
              { key: "variance", label: "Schedule variance", render: (row) => row[3] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
