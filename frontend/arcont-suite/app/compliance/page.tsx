"use client";

import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { complianceRows } from "@/lib/route-mocks";

export default function CompliancePage() {
  return (
    <AppShell
      title="Compliance and post-sale"
      eyebrow="Customer continuity"
      description="Warranty, legal folders and operational compliance routed through the same enterprise shell."
    >
      <ModuleGate
        moduleKeys={["compliance.postsale"]}
        requiredPermissions={["compliance:*", "postsale:*"]}
        title="Compliance"
      >
        <Card title="Case pressure" description="This route demonstrates how post-sale and compliance can coexist without becoming an afterthought.">
          <DataTable
            rows={complianceRows}
            columns={[
              { key: "queue", label: "Queue", render: (row) => row[0] },
              { key: "volume", label: "Volume", render: (row) => row[1] },
              { key: "risk", label: "Risk", render: (row) => row[2] },
              { key: "note", label: "Note", render: (row) => row[3] }
            ]}
          />
        </Card>
      </ModuleGate>
    </AppShell>
  );
}
