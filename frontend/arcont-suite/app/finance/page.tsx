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
import type { FinanceLedgerItemContract, FinanceOverviewContract } from "@/lib/contracts";
import { fetchFinanceOverview } from "@/lib/platform-api";

function satTone(status: FinanceLedgerItemContract["satStatus"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function FinancePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<FinanceOverviewContract | null>(null);
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

    void fetchFinanceOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Finance overview is unavailable right now.");
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
    () => overview?.risks.filter((risk) => risk.ledgerId === selectedItem?.id) ?? [],
    [overview, selectedItem]
  );

  return (
    <AppShell
      title="Finance and accounting"
      eyebrow="Execution domain"
      description="Cash posture, payable pressure and close-readiness connected to live operating signals."
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title="Finance"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Cash position"
                value={`MXN ${overview.summary.cashPosition.toLocaleString()}`}
                footnote="Net operating cash posture from the current finance set."
              />
              <KpiCard
                label="Urgent payables"
                value={String(overview.summary.urgentPayables)}
                footnote="Items pushing the next payment run and approval pressure."
              />
              <KpiCard
                label="Close readiness"
                value={`${overview.summary.closeReadiness}%`}
                footnote="Readiness level for close and supporting evidence."
              />
              <KpiCard
                label="SAT posture"
                value={overview.summary.satStatus}
                footnote="Fiscal control signal tied to current exceptions and complements."
                badge={{ label: "fiscal", tone: satTone(overview.summary.satStatus) }}
              />
            </section>

            <section className="grid cols2">
              <Card title="Finance board" description="Treasury, payables and close-readiness in one live view.">
                <FilterBar summary={`${overview.items.length} finance signals in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "finance ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.items}
                  columns={[
                    {
                      key: "metric",
                      label: "Metric",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedItemId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.metricName}</strong>
                            <span className="tableCellMuted">{row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "value",
                      label: "Value",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.valueLabel}</strong>
                          <span className="tableCellMuted">{row.trendLabel}</span>
                        </div>
                      )
                    },
                    {
                      key: "close",
                      label: "Close",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.closeReadiness}%</strong>
                          <span className="tableCellMuted">{row.urgentItems} urgent items</span>
                        </div>
                      )
                    },
                    {
                      key: "sat",
                      label: "SAT",
                      render: (row) => <Badge tone={satTone(row.satStatus)}>{row.satStatus}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected finance signal"
                description="Focused context for the active cash, payable or fiscal signal."
                aside={selectedItem ? <Badge tone={satTone(selectedItem.satStatus)}>{selectedItem.satStatus}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Metric</div>
                      <div>{selectedItem.metricName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Trend</div>
                      <div>{selectedItem.trendLabel}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Urgent items</div>
                      <div>{selectedItem.urgentItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Close readiness</div>
                      <div>{selectedItem.closeReadiness}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Note</div>
                      <div>{selectedItem.note}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedItem.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No finance signal selected"
                    description="Choose a row to inspect focus detail and current financial pressure."
                    primaryAction={{ label: "Stay on finance", href: "/finance" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Finance risk watchlist" description="Close, payable and fiscal issues with ownership and current action state.">
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                columns={[
                  {
                    key: "risk",
                    label: "Issue",
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
            title="Finance overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading finance overview" : "Finance overview not loaded yet"}
            description="This route now expects a live backend finance response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
