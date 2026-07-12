"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import type { CrmLeadBucketContract, CrmOverviewContract } from "@/lib/contracts";
import { fetchCrmOverview } from "@/lib/platform-api";

function healthTone(health: CrmLeadBucketContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function CrmPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<CrmOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchCrmOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("CRM overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedBucketId((current) => current ?? result.focusBucket?.id ?? result.leadBuckets[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

  const selectedBucket = useMemo(
    () => overview?.leadBuckets.find((bucket) => bucket.id === selectedBucketId) ?? overview?.focusBucket ?? null,
    [overview, selectedBucketId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.leadBucketId === selectedBucket?.id) ?? [],
    [overview, selectedBucket]
  );

  return (
    <AppShell
      title="Sales and CRM"
      eyebrow="Customer operations"
      description="Lead pressure, reservations and commercial risk signals connected to the active portfolio."
    >
      <ModuleGate moduleKeys={["sales.crm"]} requiredPermissions={["sales:*"]} title="Sales / CRM">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Qualified leads"
                value={String(overview.summary.qualifiedLeads)}
                footnote="Active opportunities ready for advisor, broker or closer action."
              />
              <KpiCard
                label="Visit conversion"
                value={`${overview.summary.visitConversion}%`}
                footnote="Average conversion signal across the current sales buckets."
              />
              <KpiCard
                label="Reservations"
                value={String(overview.summary.reservations)}
                footnote="Reservations now competing for inventory and documentation bandwidth."
              />
              <KpiCard
                label="Forecast revenue"
                value={`MXN ${overview.summary.forecastRevenue.toLocaleString()}`}
                footnote="Commercial revenue forecast tied to the active tenant pipeline."
              />
            </section>

            <section className="grid cols2">
              <Card title="Commercial board" description="Live project demand, conversion and reservation pressure.">
                <FilterBar summary={`${overview.leadBuckets.length} commercial buckets in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "crm ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.leadBuckets}
                  columns={[
                    {
                      key: "project",
                      label: "Project",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedBucketId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.projectName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.segment}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "pipeline",
                      label: "Pipeline",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.openOpportunities} open</strong>
                          <span className="tableCellMuted">{row.reservations} reservations</span>
                        </div>
                      )
                    },
                    {
                      key: "conversion",
                      label: "Conversion",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.conversionRate}%</strong>
                          <span className="tableCellMuted">MXN {row.forecastRevenue.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.health)}>{row.health}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected commercial bucket"
                description="Focused signal for the active project, segment or housing program."
                aside={selectedBucket ? <Badge tone={healthTone(selectedBucket.health)}>{selectedBucket.health}</Badge> : null}
              >
                {selectedBucket ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Owner</div>
                      <div>{selectedBucket.owner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Segment</div>
                      <div>{selectedBucket.segment}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Open opportunities</div>
                      <div>{selectedBucket.openOpportunities}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Reservations</div>
                      <div>{selectedBucket.reservations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Commercial signal</div>
                      <div>{selectedBucket.signal}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedBucket.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No commercial bucket selected"
                    description="Choose a project or program bucket to inspect the active pipeline and blockers."
                    primaryAction={{ label: "Stay on CRM", href: "/crm" }}
                  />
                )}
              </Card>
            </section>

            <Card title="CRM risks and blockers" description="Commercial friction impacting visits, approvals, reservations or closing readiness.">
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                columns={[
                  {
                    key: "risk",
                    label: "Risk",
                    render: (risk) => (
                      <div className="tableCellStack">
                        <strong>{risk.title}</strong>
                        <span className="tableCellMuted">{risk.category}</span>
                      </div>
                    )
                  },
                  {
                    key: "severity",
                    label: "Severity",
                    render: (risk) => (
                      <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                        {risk.severity}
                      </Badge>
                    )
                  },
                  {
                    key: "owner",
                    label: "Owner",
                    render: (risk) => risk.owner
                  },
                  {
                    key: "status",
                    label: "Current action",
                    render: (risk) => risk.status
                  }
                ]}
              />
            </Card>
          </>
        ) : error ? (
          <EmptyState
            title="CRM overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading CRM overview" : "CRM overview not loaded yet"}
            description="This route now expects a live backend CRM response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
