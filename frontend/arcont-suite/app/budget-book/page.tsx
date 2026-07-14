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
import type { BudgetBookLineContract, BudgetBookOverviewContract } from "@/lib/contracts";
import { fetchBudgetBookOverview, updateBudgetBookLine } from "@/lib/platform-api";

function healthTone(status: BudgetBookLineContract["generatorHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function procurementTone(status: BudgetBookLineContract["procurementStatus"]) {
  switch (status) {
    case "awarded":
      return "success";
    case "awaiting_approval":
      return "warning";
    case "blocked":
      return "danger";
    case "sourcing":
      return "info";
    default:
      return "gold";
  }
}

function collectionTone(status: BudgetBookLineContract["collectionHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function actionOptions(line: BudgetBookLineContract) {
  switch (line.procurementStatus) {
    case "draft":
      return [
        {
          label: "Move to sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Launch vendor pricing and complete the first generator support pack"
        }
      ];
    case "sourcing":
      return [
        {
          label: "Send to approval",
          procurementStatus: "awaiting_approval" as const,
          nextAction: "Close comparisons, freeze quantities and route the concept for approval"
        },
        {
          label: "Block concept",
          procurementStatus: "blocked" as const,
          nextAction: "Hold the concept until quantity, evidence or scope drift is corrected"
        }
      ];
    case "awaiting_approval":
      return [
        {
          label: "Award concept",
          procurementStatus: "awarded" as const,
          nextAction: "Freeze the concept baseline and release procurement execution"
        },
        {
          label: "Return sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Reopen sourcing to correct commercial or technical generator gaps"
        }
      ];
    case "awarded":
      return [
        {
          label: "Move to approval",
          procurementStatus: "awaiting_approval" as const,
          nextAction: "Re-open approval because the baseline or generator assumptions changed"
        }
      ];
    default:
      return [
        {
          label: "Resume sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Resolve the blocker and relaunch sourcing with corrected quantities"
        }
      ];
  }
}

function recomputeSummary(lines: BudgetBookLineContract[]) {
  return {
    activeConcepts: lines.length,
    baselineBudget: lines.reduce((sum, item) => sum + item.budgetAmount, 0),
    executedBudget: lines.reduce((sum, item) => sum + item.executedQuantity * item.unitCost, 0),
    estimatedBudget: lines.reduce((sum, item) => sum + item.estimatedQuantity * item.unitCost, 0),
    pendingBudget: lines.reduce((sum, item) => sum + item.pendingQuantity * item.unitCost, 0),
    criticalConcepts: lines.filter((item) => item.generatorHealth === "critical").length,
    conceptsAtCashRisk: lines.filter(
      (item) => item.collectionHealth === "critical" || item.overdueCollectionDays > 30
    ).length
  };
}

function pickFocusLine(lines: BudgetBookLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.generatorHealth === "critical" && right.generatorHealth !== "critical") {
          return -1;
        }

        if (left.generatorHealth !== "critical" && right.generatorHealth === "critical") {
          return 1;
        }

        return right.pendingQuantity * right.unitCost - left.pendingQuantity * left.unitCost;
      })[0] ?? null
  );
}

export default function BudgetBookPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<BudgetBookOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
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

    void fetchBudgetBookOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Budget book overview is unavailable right now.");
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

  const selectedLine = useMemo(
    () => overview?.lines.find((item) => item.id === selectedLineId) ?? overview?.focusLine ?? null,
    [overview, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleAction(
    procurementStatus: BudgetBookLineContract["procurementStatus"],
    suggestedNextAction: string
  ) {
    if (!selectedLine || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the concept.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateBudgetBookLine(
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
      setActionError(response.error?.message ?? "Budget concept update failed.");
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
    setActionMessage(`Concept moved to ${response.data.procurementStatus}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Budget Book"
      eyebrow="Procurement execution"
      description="Catalog of concepts, generator readiness and quantity closure tied to live procurement packages."
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title="Budget book">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Active concepts"
                value={String(overview.summary.activeConcepts)}
                footnote="Concepts currently anchored to live procurement packages."
              />
              <KpiCard
                label="Baseline budget"
                value={`MXN ${overview.summary.baselineBudget.toLocaleString()}`}
                footnote="Budget baseline currently loaded into the concept catalog."
              />
              <KpiCard
                label="Estimated budget"
                value={`MXN ${Math.round(overview.summary.estimatedBudget).toLocaleString()}`}
                footnote="Commercial value already backed by current generators and evidence."
              />
              <KpiCard
                label="Pending budget"
                value={`MXN ${Math.round(overview.summary.pendingBudget).toLocaleString()}`}
                footnote="Value still exposed by incomplete generators, approvals or blocked sourcing."
              />
              <KpiCard
                label="Cash-risk concepts"
                value={String(overview.summary.conceptsAtCashRisk)}
                footnote="Concepts already carrying collection exposure or overdue cash conversion."
              />
            </section>

            <section className="grid cols2">
              <Card title="Concept board" description="Live catalog of budget concepts with quantity closure and procurement posture.">
                <FilterBar summary={`${overview.lines.length} concepts in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "budget book ready"}</Badge>
                </FilterBar>

                <DataTable
                  rows={overview.lines}
                  columns={[
                    {
                      key: "concept",
                      label: "Concept",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.conceptCode}</strong>
                            <span className="tableCellMuted">{row.packageName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "project",
                      label: "Project",
                      render: (row) => row.projectName
                    },
                    {
                      key: "budget",
                      label: "Budget",
                      render: (row) => (
                        <div>
                          <strong>MXN {row.budgetAmount.toLocaleString()}</strong>
                          <div>
                            {row.executedQuantity.toLocaleString()} / {row.quantity.toLocaleString()} {row.unit}
                          </div>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => (
                        <div className="row gap wrap">
                          <Badge tone={healthTone(row.generatorHealth)}>{row.generatorHealth}</Badge>
                          <Badge tone={collectionTone(row.collectionHealth)}>{row.collectionHealth}</Badge>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      label: "Procurement",
                      render: (row) => <Badge tone={procurementTone(row.procurementStatus)}>{row.procurementStatus}</Badge>
                    }
                  ]}
                />
              </Card>

              {selectedLine ? (
                <Card
                  title={`${selectedLine.conceptCode} · ${selectedLine.packageName}`}
                  description="Operational view of quantities, generators and current release action."
                >
                  <section className="stack">
                    <div className="grid cols3">
                      <KpiCard
                        label="Progress"
                        value={`${selectedLine.progressPercent.toFixed(1)}%`}
                        footnote={`${selectedLine.executedQuantity.toLocaleString()} ${selectedLine.unit} already grounded.`}
                      />
                      <KpiCard
                        label="Evidence"
                        value={String(selectedLine.evidenceCount)}
                        footnote="Documents, bids and support artifacts currently attached."
                      />
                      <KpiCard
                        label="Change orders"
                        value={String(selectedLine.changeOrders)}
                        footnote="Commercial pressure currently affecting this concept."
                      />
                      <KpiCard
                        label="Collection aging"
                        value={`${selectedLine.overdueCollectionDays}d`}
                        footnote={`pending collection MXN ${selectedLine.pendingCollection.toLocaleString()}`}
                      />
                    </div>

                    <div className="grid cols2">
                      <KpiCard
                        label="Estimated quantity"
                        value={`${selectedLine.estimatedQuantity.toLocaleString()} ${selectedLine.unit}`}
                        footnote={`Unit cost MXN ${selectedLine.unitCost.toLocaleString()}.`}
                      />
                      <KpiCard
                        label="Pending quantity"
                        value={`${selectedLine.pendingQuantity.toLocaleString()} ${selectedLine.unit}`}
                        footnote="Backlog still open before the concept can close cleanly."
                      />
                      <KpiCard
                        label="Pending to bill"
                        value={`MXN ${selectedLine.pendingToBill.toLocaleString()}`}
                        footnote={`${selectedLine.collectionOwner} owns the downstream collection cycle.`}
                      />
                    </div>

                    <div className="surface-subtle">
                      <strong>Next action</strong>
                      <textarea
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        rows={4}
                        disabled={isSaving}
                      />
                    </div>

                    <div className="cluster">
                      <Badge tone={healthTone(selectedLine.generatorHealth)}>{selectedLine.generatorHealth}</Badge>
                      <Badge tone={procurementTone(selectedLine.procurementStatus)}>{selectedLine.procurementStatus}</Badge>
                      <Badge tone={collectionTone(selectedLine.collectionHealth)}>{selectedLine.collectionHealth}</Badge>
                      <Badge tone="info">{selectedLine.buyer}</Badge>
                    </div>

                    <div className="row gap wrap">
                      <Link className="buttonGhost" href="/procurement">
                        Open procurement
                      </Link>
                      <Link className="buttonGhost" href="/cost-control">
                        Open cost control
                      </Link>
                      <Link className="buttonGhost" href="/finance">
                        Open finance
                      </Link>
                      <Link className="buttonGhost" href="/projects">
                        Open projects
                      </Link>
                    </div>

                    {actionError ? <EmptyState title="Update blocked" description={actionError} /> : null}
                    {actionMessage ? <EmptyState title="Concept updated" description={actionMessage} /> : null}

                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.procurementStatus, action.nextAction)}
                          disabled={
                            isSaving ||
                            (action.procurementStatus === "awarded" &&
                              (selectedLine.pendingQuantity > selectedLine.quantity * 0.12 ||
                                selectedLine.changeOrders > 1 ||
                                selectedLine.collectionHealth === "critical")) ||
                            (action.procurementStatus === "awaiting_approval" && selectedLine.evidenceCount < 2)
                          }
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    <Card
                      title="Active risks"
                      description="Signals inherited from procurement and project control that still impact this concept."
                    >
                      {selectedRisks.length > 0 ? (
                        <DataTable
                          rows={selectedRisks}
                          columns={[
                            {
                              key: "risk",
                              label: "Risk",
                              render: (row) => (
                                <div>
                                  <strong>{row.title}</strong>
                                  <div>{row.category}</div>
                                </div>
                              )
                            },
                            {
                              key: "severity",
                              label: "Severity",
                              render: (row) => <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>{row.severity}</Badge>
                            },
                            {
                              key: "owner",
                              label: "Owner",
                              render: (row) => row.owner
                            }
                          ]}
                        />
                      ) : (
                        <EmptyState
                          title="No open blockers"
                          description="This concept currently has no mapped procurement or project risk."
                        />
                      )}
                    </Card>
                  </section>
                </Card>
              ) : (
                <EmptyState
                  title="Select a concept"
                  description="Choose a budget concept from the board to review quantities, support evidence and release action."
                />
              )}
            </section>
          </>
        ) : (
          <EmptyState
            title={error ?? "Budget book unavailable"}
            description="We could not load the concept catalog for the selected company."
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
