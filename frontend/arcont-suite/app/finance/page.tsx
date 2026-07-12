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
import { fetchFinanceOverview, updateFinanceLedgerItem } from "@/lib/platform-api";

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

function financeActionOptions(item: FinanceLedgerItemContract) {
  switch (item.satStatus) {
    case "critical":
      return [
        {
          label: "Move to watch",
          satStatus: "watch" as const,
          note: "Critical exceptions reduced; keep active monitoring until close evidence stabilizes."
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate to critical",
          satStatus: "critical" as const,
          note: "Escalate because fiscal or close pressure remains unresolved."
        },
        {
          label: "Mark controlled",
          satStatus: "controlled" as const,
          note: "Exceptions resolved and fiscal control is back within acceptable posture."
        }
      ];
    case "controlled":
      return [
        {
          label: "Move to watch",
          satStatus: "watch" as const,
          note: "New observations require monitoring before they become critical."
        }
      ];
    default:
      return [];
  }
}

export default function FinancePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<FinanceOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const actionOptions = useMemo(() => (selectedItem ? financeActionOptions(selectedItem) : []), [selectedItem]);

  useEffect(() => {
    setNoteDraft(selectedItem?.note ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedItemId, selectedItem?.id, selectedItem?.note]);

  async function handleFinanceAction(
    satStatus: FinanceLedgerItemContract["satStatus"],
    suggestedNote: string
  ) {
    if (!selectedItem || !session.accessToken) {
      return;
    }

    const note = noteDraft.trim() || suggestedNote;
    if (note.length < 8) {
      setActionError("Note must be more specific before updating the finance signal.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateFinanceLedgerItem(
      selectedItem.id,
      activeCompany.id,
      {
        satStatus,
        note
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Finance update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === response.data?.id ? response.data : item));
      const cashPosition = items.reduce((sum, item) => sum + item.cashImpact, 0);
      const urgentPayables = items.reduce((sum, item) => sum + item.urgentItems, 0);
      const closeReadiness =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.closeReadiness, 0) / items.length).toFixed(1)) : 0;
      const satStatusSummary = items.some((item) => item.satStatus === "critical")
        ? "critical"
        : items.some((item) => item.satStatus === "watch")
          ? "watch"
          : "controlled";

      return {
        ...current,
        summary: {
          cashPosition,
          urgentPayables,
          closeReadiness,
          satStatus: satStatusSummary
        },
        items,
        focusItem: current.focusItem?.id === response.data?.id ? response.data : current.focusItem
      };
    });

    setNoteDraft(response.data.note);
    setActionMessage(`Finance signal moved to ${response.data.satStatus}.`);
    setIsSaving(false);
  }

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
                      <div>
                        <input
                          className="field"
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          placeholder="Describe the current fiscal, payable or close action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedItem.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Controlled status requires zero urgent items.</span>
                        <span className="tableCellMuted">Controlled status also requires at least 90% close readiness.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.satStatus === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleFinanceAction(option.satStatus, option.note)}
                            >
                              {isSaving ? "Saving..." : option.label}
                            </button>
                          ))}
                        </div>
                        {actionMessage ? <span className="tableCellMuted">{actionMessage}</span> : null}
                        {actionError ? <span style={{ color: "var(--danger-700)" }}>{actionError}</span> : null}
                      </div>
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
