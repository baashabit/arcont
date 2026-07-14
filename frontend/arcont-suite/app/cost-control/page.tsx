"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import type { CostControlLineContract, CostControlOverviewContract } from "@/lib/contracts";
import { fetchCostControlOverview, updateCostControlLine } from "@/lib/platform-api";

function healthTone(health: CostControlLineContract["controlHealth"]) {
  switch (health) {
    case "on_track":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function statusTone(status: CostControlLineContract["procurementStatus"]) {
  switch (status) {
    case "awarded":
      return "success";
    case "blocked":
      return "danger";
    case "awaiting_approval":
      return "warning";
    case "sourcing":
      return "info";
    default:
      return "gold";
  }
}

function collectionTone(health: CostControlLineContract["collectionHealth"]) {
  switch (health) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function lineActionOptions(line: CostControlLineContract) {
  switch (line.procurementStatus) {
    case "draft":
      return [
        {
          label: "Start sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Open supplier outreach and lock the first commercial comparison"
        }
      ];
    case "sourcing":
      return [
        {
          label: "Send to approval",
          procurementStatus: "awaiting_approval" as const,
          nextAction: "Freeze proposal comparison and route package for decision"
        },
        {
          label: "Block line",
          procurementStatus: "blocked" as const,
          nextAction: "Stop sourcing and escalate the commercial or technical blocker"
        }
      ];
    case "awaiting_approval":
      return [
        {
          label: "Return to sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Refresh pricing and close the pending commercial gaps"
        },
        {
          label: "Award line",
          procurementStatus: "awarded" as const,
          nextAction: "Align award release with field execution and cash plan"
        },
        {
          label: "Block approval",
          procurementStatus: "blocked" as const,
          nextAction: "Pause approval until the variance driver is contained"
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Reopen sourcing after resolving the blocking cause"
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(lines: CostControlLineContract[]) {
  return {
    trackedLines: lines.length,
    totalBudget: lines.reduce((sum, item) => sum + item.budgetAmount, 0),
    committedCost: lines.reduce((sum, item) => sum + item.committedCost, 0),
    forecastAtCompletion: lines.reduce((sum, item) => sum + item.forecastAtCompletion, 0),
    forecastVariance: lines.reduce((sum, item) => sum + item.varianceAmount, 0),
    criticalLines: lines.filter((item) => item.controlHealth === "critical").length,
    cashRiskLines: lines.filter(
      (item) => item.collectionHealth === "critical" || item.overdueCollectionDays > 30
    ).length
  };
}

function pickFocusLine(lines: CostControlLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.controlHealth === "critical" && right.controlHealth !== "critical") {
          return -1;
        }

        if (left.controlHealth !== "critical" && right.controlHealth === "critical") {
          return 1;
        }

        if (right.overdueCollectionDays !== left.overdueCollectionDays) {
          return right.overdueCollectionDays - left.overdueCollectionDays;
        }

        return right.varianceAmount - left.varianceAmount;
      })[0] ?? null
  );
}

export default function CostControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<CostControlOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<"all" | CostControlLineContract["controlHealth"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchCostControlOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Cost control overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  const projectOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.lines.map((item) => item.projectName))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [overview]);

  const filteredLines = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.lines.filter((item) => {
      const matchesProject = projectFilter === "all" || item.projectName === projectFilter;
      const matchesHealth = healthFilter === "all" || item.controlHealth === healthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.packageName.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch) ||
        item.projectName.toLowerCase().includes(normalizedSearch);

      return matchesProject && matchesHealth && matchesSearch;
    });
  }, [healthFilter, overview, projectFilter, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedExceptions = useMemo(
    () => overview?.exceptions.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const actionOptions = useMemo(() => (selectedLine ? lineActionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredLines.length === 0) {
      setSelectedLineId(null);
      return;
    }

    const isSelectedVisible = filteredLines.some((item) => item.id === selectedLineId);
    if (!isSelectedVisible) {
      setSelectedLineId(filteredLines[0]?.id ?? null);
    }
  }, [filteredLines, overview, selectedLineId]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleLineAction(
    procurementStatus: CostControlLineContract["procurementStatus"],
    suggestedNextAction: string,
    successMessage?: string
  ) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the line.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateCostControlLine(
      selectedLine.id,
      activeCompany.id,
      {
        procurementStatus,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Cost control line update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const lines = current.lines.map((item) => (item.id === response.data?.id ? response.data : item));

      return {
        ...current,
        summary: recomputeSummary(lines),
        lines,
        focusLine: pickFocusLine(lines)
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(successMessage ?? `Line moved to ${response.data.procurementStatus}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Cost control"
      eyebrow="Execution finance"
      description="Budget drift, forecast pressure and procurement-backed cost actions tied to real project progress."
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title="Cost control">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked lines"
                value={String(filteredSummary.trackedLines)}
                footnote="Procurement-backed lines tied to project execution pressure."
              />
              <KpiCard
                label="Total budget"
                value={`MXN ${filteredSummary.totalBudget.toLocaleString()}`}
                footnote="Controlled budget baseline across active cost lines."
              />
              <KpiCard
                label="Forecast variance"
                value={`MXN ${filteredSummary.forecastVariance.toLocaleString()}`}
                footnote="Current drift between budget and forecast at completion."
              />
              <KpiCard
                label="Critical lines"
                value={String(filteredSummary.criticalLines)}
                footnote="Lines that should not advance without variance containment."
              />
              <KpiCard
                label="Cash-risk lines"
                value={String(filteredSummary.cashRiskLines)}
                footnote="Lines where forecast pressure is already colliding with collection exposure."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Cost walkthrough"
                description="Operate forecast drift, procurement blockage and cash exposure from a practical execution-finance board."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    This page is already useful for human tests: review line health, push sourcing states and inspect forecast pressure without waiting for production backend flows.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">cost control</Badge>
                    <Badge tone="info">forecast</Badge>
                    <Badge tone="info">cash exposure</Badge>
                  </div>
                </div>
              </Card>

              <Card title="Cost board" description="Budget, commitment and forecast posture across the active company cost lines.">
                <FilterBar summary={`${filteredLines.length} cost lines in the active tenant`}>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">All projects</option>
                    {projectOptions.map((projectName) => (
                      <option key={projectName} value={projectName}>
                        {projectName}
                      </option>
                    ))}
                  </select>
                  <select
                    className="selectField"
                    value={healthFilter}
                    onChange={(event) => setHealthFilter(event.target.value as "all" | CostControlLineContract["controlHealth"])}
                  >
                    <option value="all">All health</option>
                    <option value="on_track">on_track</option>
                    <option value="watch">watch</option>
                    <option value="critical">critical</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search package, code or project"
                  />
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "cost view ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "line",
                      label: "Line",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.packageName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.projectName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "budget",
                      label: "Budget vs forecast",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.budgetAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">
                            forecast MXN {row.forecastAtCompletion.toLocaleString()}
                          </span>
                        </div>
                      )
                    },
                    {
                      key: "progress",
                      label: "Progress",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectProgress}%</strong>
                          <span className="tableCellMuted">
                            {row.scheduleVarianceDays.toFixed(1)} days variance
                          </span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => (
                        <div className="row gap wrap">
                          <Badge tone={healthTone(row.controlHealth)}>{row.controlHealth}</Badge>
                          <Badge tone={collectionTone(row.collectionHealth)}>{row.collectionHealth}</Badge>
                        </div>
                      )
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected line"
                description="Forecast, cash exposure and recovery actions for the focused cost line."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.controlHealth)}>{selectedLine.controlHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Procurement status</div>
                      <div className="tagRow">
                        <Badge tone={statusTone(selectedLine.procurementStatus)}>
                          {selectedLine.procurementStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Buyer</div>
                      <div>{selectedLine.buyer}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Collection owner</div>
                      <div>{selectedLine.collectionOwner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Committed cost</div>
                      <div>MXN {selectedLine.committedCost.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Spent to date</div>
                      <div>MXN {selectedLine.spentToDate.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Cash exposure</div>
                      <div>
                        MXN {selectedLine.cashExposure.toLocaleString()}
                        <div className="tableCellMuted">
                          pending collection MXN {selectedLine.pendingCollection.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Variance</div>
                      <div>
                        MXN {selectedLine.varianceAmount.toLocaleString()} · {selectedLine.variancePercent}%
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Collection aging</div>
                      <div>
                        <Badge tone={collectionTone(selectedLine.collectionHealth)}>{selectedLine.collectionHealth}</Badge>
                        <div className="tableCellMuted">{selectedLine.overdueCollectionDays} overdue days on the cash cycle</div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Drivers</div>
                      <div className="tableCellStack">
                        {selectedLine.riskDrivers.map((driver) => (
                          <span className="tableCellMuted" key={driver}>
                            {driver}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        <Link className="buttonGhost" href="/procurement">
                          Open procurement
                        </Link>
                        <Link className="buttonGhost" href="/finance">
                          Open finance
                        </Link>
                        <Link className="buttonGhost" href="/cash-flow">
                          Open cash flow
                        </Link>
                        <Link className="buttonGhost" href="/projects">
                          Open projects
                        </Link>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the recovery, containment or award action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Award is blocked while forecast drift stays critical.</span>
                        <span className="tableCellMuted">Approval still requires bid coverage from procurement.</span>
                        <span className="tableCellMuted">Cash-risk lines should not be treated as financially clean even if sourcing advances.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          <button
                            className="button"
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void handleLineAction(
                                selectedLine.procurementStatus,
                                selectedLine.nextAction,
                                "Cost line action updated."
                              )
                            }
                          >
                            {isSaving ? "Saving..." : "Save next action"}
                          </button>
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.procurementStatus === "blocked" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.procurementStatus === "awarded" &&
                                  (selectedLine.controlHealth === "critical" || selectedLine.collectionHealth === "critical")) ||
                                (option.procurementStatus === "awaiting_approval" &&
                                  selectedLine.riskDrivers.some((driver) => driver.includes("Insufficient bid coverage")))
                              }
                              onClick={() => void handleLineAction(option.procurementStatus, option.nextAction)}
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
                    title="No cost line selected"
                    description="Choose a cost line to inspect drift, cash pressure and recovery actions."
                    primaryAction={{ label: "Stay on cost control", href: "/cost-control" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Exceptions and blockers" description="Commercial, schedule and control exceptions tied to active cost lines.">
              <DataTable
                rows={selectedExceptions.length > 0 ? selectedExceptions : overview.exceptions}
                columns={[
                  {
                    key: "exception",
                    label: "Exception",
                    render: (item) => (
                      <div className="tableCellStack">
                        <strong>{item.title}</strong>
                        <span className="tableCellMuted">{item.category}</span>
                      </div>
                    )
                  },
                  {
                    key: "severity",
                    label: "Severity",
                    render: (item) => (
                      <Badge tone={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "info"}>
                        {item.severity}
                      </Badge>
                    )
                  },
                  {
                    key: "owner",
                    label: "Owner",
                    render: (item) => item.owner
                  },
                  {
                    key: "status",
                    label: "Current action",
                    render: (item) => item.status
                  }
                ]}
              />
            </Card>
          </>
        ) : error ? (
          <EmptyState
            title="Cost control overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open budget book", href: "/budget-book" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading cost control overview" : "Cost control overview not loaded yet"}
            description="Open a cost line to test forecast, procurement and cash exposure in demo mode or with the live tenant backend."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
