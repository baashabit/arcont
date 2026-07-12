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
import type { DocumentControlItemContract, DocumentControlOverviewContract } from "@/lib/contracts";
import { fetchDocumentControlOverview } from "@/lib/platform-api";

function healthTone(health: DocumentControlItemContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function DocumentControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<DocumentControlOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchDocumentControlOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Document control overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedItemId((current) => current ?? result.focusItem?.id ?? result.items[0]?.id ?? null);
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

  const selectedItem = useMemo(
    () => overview?.items.find((item) => item.id === selectedItemId) ?? overview?.focusItem ?? null,
    [overview, selectedItemId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.itemId === selectedItem?.id) ?? [],
    [overview, selectedItem]
  );

  return (
    <AppShell
      title="Document control and RFI"
      eyebrow="Project coordination"
      description="Versions, RFIs, submittals and approvals tied to live field coordination and document traceability."
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Document Control">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open RFIs"
                value={String(overview.summary.openRfis)}
                footnote="RFIs still awaiting resolution or formal response."
              />
              <KpiCard
                label="Active submittals"
                value={String(overview.summary.activeSubmittals)}
                footnote="Technical submittals currently moving through review."
              />
              <KpiCard
                label="Controlled versions"
                value={String(overview.summary.controlledVersions)}
                footnote="Revision count representing active document control flow."
              />
              <KpiCard
                label="Turnaround"
                value={`${overview.summary.averageTurnaroundDays} d`}
                footnote="Average current response time across document-control items."
              />
            </section>

            <section className="grid cols2">
              <Card title="Document board" description="Live RFIs, submittals, transmittals and meeting-note control.">
                <FilterBar summary={`${overview.items.length} document-control items in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "docs ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.items}
                  columns={[
                    {
                      key: "item",
                      label: "Item",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedItemId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.subject}</strong>
                            <span className="tableCellMuted">{row.documentType} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "project",
                      label: "Project",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectName}</strong>
                          <span className="tableCellMuted">{row.owner}</span>
                        </div>
                      )
                    },
                    {
                      key: "flow",
                      label: "Flow",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.revisionCount} revisions</strong>
                          <span className="tableCellMuted">{row.openComments} comments</span>
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
                title="Selected item"
                description="Focused traceability for the active RFI, submittal or controlled issue."
                aside={selectedItem ? <Badge tone={healthTone(selectedItem.health)}>{selectedItem.health}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div>{selectedItem.projectName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedItem.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Turnaround</div>
                      <div>{selectedItem.turnaroundDays} days</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Open comments</div>
                      <div>{selectedItem.openComments}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>{selectedItem.nextAction}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedItem.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No document-control item selected"
                    description="Choose an item to inspect the current coordination trace and blockers."
                    primaryAction={{ label: "Stay on document control", href: "/document-control" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Document risks and blockers" description="Coordination, versioning and response issues affecting active work.">
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
            title="Document control overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading document control overview" : "Document control overview not loaded yet"}
            description="This route now expects a live backend document-control response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
