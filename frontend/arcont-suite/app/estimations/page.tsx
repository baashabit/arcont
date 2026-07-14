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
import type {
  EstimationCollectionLineContract,
  EstimationCollectionOverviewContract
} from "@/lib/contracts";
import {
  fetchAccountsPayableOverview,
  fetchCashFlowOverview,
  fetchCrmOverview,
  fetchEstimationCollectionOverview,
  fetchTreasuryPaymentRunsOverview,
  updateEstimationCollectionLine
} from "@/lib/platform-api";

function healthTone(status: EstimationCollectionLineContract["collectionHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function projectStatusTone(status: EstimationCollectionLineContract["projectStatus"]) {
  switch (status) {
    case "active":
      return "success";
    case "at_risk":
      return "warning";
    case "blocked":
      return "danger";
    case "closed":
      return "info";
    default:
      return "gold";
  }
}

function lineActionOptions(line: EstimationCollectionLineContract) {
  switch (line.collectionHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          collectionHealth: "watch" as const,
          nextAction: "Contain the oldest pending collection items and refresh evidence with the client reviewer"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          collectionHealth: "critical" as const,
          nextAction: "Escalate collection slippage and unresolved evidence gaps to director review"
        },
        {
          label: "Mark controlled",
          collectionHealth: "controlled" as const,
          nextAction: "Pending collection is within tolerance and evidence trail is fully aligned"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          collectionHealth: "watch" as const,
          nextAction: "Start monitoring collection drift before it impacts cash flow"
        }
      ];
  }
}

function recomputeSummary(lines: EstimationCollectionLineContract[]) {
  return {
    trackedProjects: lines.length,
    estimatedPortfolio: lines.reduce((sum, item) => sum + item.estimatedAmount, 0),
    submittedPortfolio: lines.reduce((sum, item) => sum + item.submittedAmount, 0),
    collectedPortfolio: lines.reduce((sum, item) => sum + item.collectedAmount, 0),
    pendingCollection: lines.reduce((sum, item) => sum + item.pendingCollection, 0),
    criticalCollections: lines.filter((item) => item.collectionHealth === "critical").length,
    overdueCollections: lines.filter((item) => item.oldestPendingDays > item.collectionWindowDays).length
  };
}

function pickFocusLine(lines: EstimationCollectionLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.collectionHealth === "critical" && right.collectionHealth !== "critical") {
          return -1;
        }

        if (left.collectionHealth !== "critical" && right.collectionHealth === "critical") {
          return 1;
        }

        if (right.oldestPendingDays !== left.oldestPendingDays) {
          return right.oldestPendingDays - left.oldestPendingDays;
        }

        return right.pendingCollection - left.pendingCollection;
      })[0] ?? null
  );
}

type EstimationBridgeContext = {
  crm: NonNullable<Awaited<ReturnType<typeof fetchCrmOverview>>>;
  cashFlow: NonNullable<Awaited<ReturnType<typeof fetchCashFlowOverview>>>;
  accountsPayable: NonNullable<Awaited<ReturnType<typeof fetchAccountsPayableOverview>>>;
  treasury: NonNullable<Awaited<ReturnType<typeof fetchTreasuryPaymentRunsOverview>>>;
} | null;

function buildEstimationBridge(line: EstimationCollectionLineContract | null, bridge: EstimationBridgeContext) {
  if (!line) {
    return null;
  }

  const linkedBucket = bridge?.crm.leadBuckets.find((bucket) => bucket.projectName === line.projectName) ?? null;
  const linkedCashLine =
    bridge?.cashFlow.lines.find((item) => item.sourceType === "collections") ??
    bridge?.cashFlow.focusLine ??
    null;

  return {
    commercialCoverage: linkedBucket
      ? `${linkedBucket.openOpportunities} open opportunities and ${linkedBucket.reservations} reservations are feeding this collection lane.`
      : "Commercial origin is not yet mapped for this estimation line.",
    billingPressure:
      line.pendingCollection > 0
        ? `MXN ${line.pendingCollection.toLocaleString()} remains uncollected and MXN ${line.pendingToBill.toLocaleString()} is still waiting to be billed.`
        : "No meaningful billing or collection backlog remains on this line.",
    treasuryEffect: linkedCashLine
      ? linkedCashLine.weeklyNet < 0
        ? `Collections are feeding a treasury stream currently running at a weekly gap of MXN ${Math.abs(linkedCashLine.weeklyNet).toLocaleString()}.`
        : `Collections are feeding a treasury stream currently showing a weekly surplus of MXN ${linkedCashLine.weeklyNet.toLocaleString()}.`
      : "Treasury effect is not yet mapped for this estimation line."
  };
}

function buildCollectionWorkflow(line: EstimationCollectionLineContract | null) {
  if (!line) {
    return null;
  }

  return {
    executionRead:
      line.progressGap > 0
        ? `${line.projectName} still has a ${line.progressGap}% gap between field progress and billing evidence, so collection cannot be treated as clean yet.`
        : `${line.projectName} has aligned field evidence and can focus on billing and collection conversion.`,
    collectionRead:
      line.pendingCollection > 0
        ? `MXN ${line.pendingCollection.toLocaleString()} remains exposed in collection and the oldest tranche is already ${line.oldestPendingDays} days old.`
        : `${line.projectName} currently shows no significant collection exposure.`,
    closeoutRead:
      line.closeReadiness < 80
        ? `Closeout readiness is only ${line.closeReadiness}%, so this line still depends on document and compliance discipline.`
        : `Closeout readiness is ${line.closeReadiness}% and the line is structurally closer to controlled cash conversion.`
  };
}

export default function EstimationsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<EstimationCollectionOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<EstimationBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | EstimationCollectionLineContract["collectionHealth"]>("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | EstimationCollectionLineContract["projectStatus"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchEstimationCollectionOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchCrmOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchCashFlowOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchAccountsPayableOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchTreasuryPaymentRunsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, crm, cashFlow, accountsPayable, treasury]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Estimations and collections overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
        setBridgeContext(crm && cashFlow && accountsPayable && treasury ? { crm, cashFlow, accountsPayable, treasury } : null);
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

  const filteredLines = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.lines.filter((line) => {
      const matchesHealth = healthFilter === "all" || line.collectionHealth === healthFilter;
      const matchesProjectStatus = projectStatusFilter === "all" || line.projectStatus === projectStatusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        line.projectName.toLowerCase().includes(normalizedSearch) ||
        line.collectionOwner.toLowerCase().includes(normalizedSearch) ||
        line.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesProjectStatus && matchesSearch;
    });
  }, [healthFilter, overview, projectStatusFilter, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedExceptions = useMemo(
    () => overview?.exceptions.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedStory = useMemo(() => buildEstimationBridge(selectedLine, bridgeContext), [bridgeContext, selectedLine]);
  const collectionWorkflow = useMemo(() => buildCollectionWorkflow(selectedLine), [selectedLine]);
  const collectionsChainPressure = useMemo(
    () =>
      (overview?.summary.overdueCollections ?? 0) +
      (overview?.summary.criticalCollections ?? 0) +
      (bridgeContext?.accountsPayable.summary.overdueInvoices ?? 0) +
      (bridgeContext?.treasury.summary.blockedRuns ?? 0) +
      (bridgeContext?.treasury.unavailableInvoices.length ?? 0),
    [bridgeContext, overview]
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

    const isSelectedVisible = filteredLines.some((line) => line.id === selectedLineId);
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
    collectionHealth: EstimationCollectionLineContract["collectionHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the estimation line.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateEstimationCollectionLine(
      selectedLine.id,
      activeCompany.id,
      {
        collectionHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Estimation update failed.");
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
    setActionMessage(`Collection line moved to ${response.data.collectionHealth}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Estimations and collections"
      eyebrow="Execution finance"
      description="Executed work, submitted estimations and pending collection tied back to project progress."
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title="Estimations"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked projects"
                value={String(filteredSummary.trackedProjects)}
                footnote="Visible projects with active executed-work and collection posture."
              />
              <KpiCard
                label="Estimated portfolio"
                value={`MXN ${filteredSummary.estimatedPortfolio.toLocaleString()}`}
                footnote="Visible executed-work portfolio at the current baseline."
              />
              <KpiCard
                label="Submitted estimations"
                value={`MXN ${filteredSummary.submittedPortfolio.toLocaleString()}`}
                footnote="Visible work already packaged into billable or collectible estimations."
              />
              <KpiCard
                label="Pending collection"
                value={`MXN ${filteredSummary.pendingCollection.toLocaleString()}`}
                footnote="Visible value still exposed between submitted work and effective collection."
              />
              <KpiCard
                label="Overdue tranches"
                value={String(filteredSummary.overdueCollections)}
                footnote="Visible projects where the oldest pending collection exceeded its expected window."
              />
              <KpiCard
                label="Collections chain"
                value={String(collectionsChainPressure)}
                footnote="Pressure propagated from overdue collections into AP and treasury release."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Collections walkthrough"
                description="Operate the executed-work to cash-conversion lane directly from estimations, even in demo mode."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    The line is now testable by humans: review billing lag, update collection posture and watch how it propagates into AP and treasury pressure.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">estimations</Badge>
                    <Badge tone="info">collections</Badge>
                    <Badge tone="info">treasury impact</Badge>
                  </div>
                </div>
              </Card>

              <Card
                title="Collections to treasury lane"
                description="Estimations now read downstream cash execution, AP aging and treasury blockage as one practical lane."
                aside={
                  <Badge tone={collectionsChainPressure > 8 ? "danger" : collectionsChainPressure > 3 ? "warning" : "success"}>
                    {collectionsChainPressure > 8 ? "high pressure" : collectionsChainPressure > 3 ? "watch" : "controlled"}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Collections</div><div>{overview.summary.overdueCollections} overdue tranches and {overview.summary.criticalCollections} critical collection lines</div></div>
                  <div className="detailRow"><div className="detailLabel">Accounts payable aging</div><div>{bridgeContext?.accountsPayable.summary.overdueInvoices ?? 0} overdue invoices still tightening cash conversion</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury release</div><div>{bridgeContext?.treasury.summary.blockedRuns ?? 0} blocked runs and {bridgeContext?.treasury.unavailableInvoices.length ?? 0} ineligible invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">Executive read</div><div>{collectionsChainPressure > 0 ? "Collection lag is already translating into short-term treasury pressure." : "Collection and treasury lane are currently aligned enough for cleaner cash conversion."}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/accounts-payable">Open accounts payable</Link>
                  <Link className="buttonGhost" href="/treasury/payment-runs">Open treasury</Link>
                  <Link className="buttonGhost" href="/cash-flow">Open cash flow</Link>
                  <Link className="buttonGhost" href="/crm">Open CRM</Link>
                </div>
              </Card>

              <Card title="Estimation board" description="Project progress, evidence gap and collection exposure in one live board.">
                <FilterBar summary={`${filteredLines.length} estimation lines match the current operating filters`}>
                  <label className="fieldLabel">
                    Collection health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="watch">Watch</option>
                      <option value="controlled">Controlled</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Project status
                    <select
                      className="field"
                      value={projectStatusFilter}
                      onChange={(event) => setProjectStatusFilter(event.target.value as typeof projectStatusFilter)}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="at_risk">At risk</option>
                      <option value="blocked">Blocked</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Project, owner or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "estimations ready"}</Badge>
                  <Badge tone={filteredSummary.criticalCollections > 0 ? "danger" : filteredSummary.overdueCollections > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalCollections > 0
                      ? `${filteredSummary.criticalCollections} critical`
                      : filteredSummary.overdueCollections > 0
                        ? `${filteredSummary.overdueCollections} overdue`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "project",
                      label: "Project",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.projectName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.client}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "progress",
                      label: "Execution",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.evidenceProgress}% evidence</strong>
                          <span className="tableCellMuted">{row.projectProgress}% field progress</span>
                        </div>
                      )
                    },
                    {
                      key: "submitted",
                      label: "Submitted vs collected",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.submittedAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">
                            collected MXN {row.collectedAmount.toLocaleString()}
                          </span>
                        </div>
                      )
                    },
                    {
                      key: "aging",
                      label: "Aging",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.oldestPendingDays}d oldest</strong>
                          <span className="tableCellMuted">{row.billingCycleLabel}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Collection",
                      render: (row) => <Badge tone={healthTone(row.collectionHealth)}>{row.collectionHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected line"
                description="Billing readiness, collection pressure and next collection action."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.collectionHealth)}>{selectedLine.collectionHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project status</div>
                      <div className="tagRow">
                        <Badge tone={projectStatusTone(selectedLine.projectStatus)}>{selectedLine.projectStatus}</Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Collection owner</div>
                      <div>{selectedLine.collectionOwner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Billing cycle</div>
                      <div>{selectedLine.billingCycleLabel}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Pending to bill</div>
                      <div>
                        MXN {selectedLine.pendingToBill.toLocaleString()}
                        <div className="tableCellMuted">
                          approval hold MXN {selectedLine.pendingApprovalAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Pending collection</div>
                      <div>
                        MXN {selectedLine.pendingCollection.toLocaleString()}
                        <div className="tableCellMuted">
                          oldest tranche {selectedLine.oldestPendingDays}d of {selectedLine.collectionWindowDays}d expected window
                        </div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Evidence gap</div>
                      <div>{selectedLine.progressGap}% between field and support evidence</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Schedule variance</div>
                      <div>{selectedLine.scheduleVarianceDays.toFixed(1)} days</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Close readiness</div>
                      <div>{selectedLine.closeReadiness}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the collection or evidence action to unblock cash"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Controlled is blocked while pending collection stays too high.</span>
                        <span className="tableCellMuted">Controlled is blocked while evidence still lags field progress.</span>
                        <span className="tableCellMuted">Controlled is blocked while the oldest pending collection already exceeded its window.</span>
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
                            onClick={() => void handleLineAction(selectedLine.collectionHealth, selectedLine.nextAction)}
                          >
                            {isSaving ? "Saving..." : "Save next action"}
                          </button>
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.collectionHealth === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleLineAction(option.collectionHealth, option.nextAction)}
                            >
                              {isSaving ? "Saving..." : option.label}
                            </button>
                          ))}
                        </div>
                        <div className="row gap wrap">
                          <Link className="button secondary" href="/cash-flow">
                            Open cash flow
                          </Link>
                          <Link className="buttonGhost" href="/finance">
                            Open finance
                          </Link>
                          <Link className="buttonGhost" href="/accounts-payable">
                            Open accounts payable
                          </Link>
                          <Link className="buttonGhost" href="/document-control">
                            Open document control
                          </Link>
                          <Link className="buttonGhost" href="/close-control">
                            Open close control
                          </Link>
                        </div>
                        {actionMessage ? <span className="tableCellMuted">{actionMessage}</span> : null}
                        {actionError ? <span style={{ color: "var(--danger-700)" }}>{actionError}</span> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No estimation line selected"
                    description="Choose a project estimation line to inspect billing and collection pressure."
                    primaryAction={{ label: "Stay on estimations", href: "/estimations" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Execution to billing" description="Whether field execution is really ready to become collectible cash.">
                <p className="sectionText">
                  {collectionWorkflow?.executionRead ?? "Choose an estimation line to inspect execution-to-billing continuity."}
                </p>
              </Card>
              <Card title="Collection posture" description="Immediate read of collection exposure on the selected line.">
                <p className="sectionText">
                  {collectionWorkflow?.collectionRead ?? "Choose an estimation line to inspect collection posture."}
                </p>
              </Card>
              <Card title="Closeout dependency" description="Why collections should still stay connected to closeout and compliance.">
                <p className="sectionText">
                  {collectionWorkflow?.closeoutRead ?? "Choose an estimation line to inspect closeout dependency."}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Commercial coverage" description="How much real demand is already sitting behind the selected estimation line.">
                <p className="sectionText">
                  {selectedStory?.commercialCoverage ?? "Choose an estimation line to inspect its commercial coverage."}
                </p>
              </Card>
              <Card title="Billing pressure" description="What remains trapped between field execution and actual collection.">
                <p className="sectionText">
                  {selectedStory?.billingPressure ?? "Choose an estimation line to inspect billing pressure."}
                </p>
              </Card>
              <Card title="Treasury effect" description="Why this line already matters for short-term cash discipline.">
                <p className="sectionText">
                  {selectedStory?.treasuryEffect ?? "Choose an estimation line to inspect treasury effect."}
                </p>
              </Card>
            </section>

            <Card title="Exceptions and blockers" description="Project or financial signals delaying submitted work or effective collection.">
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
            title="Estimations overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open cash flow", href: "/cash-flow" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading estimations overview" : "Estimations overview not loaded yet"}
            description="Open an estimation line to test the executed-work and collection lane in demo mode or with the live tenant backend."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
