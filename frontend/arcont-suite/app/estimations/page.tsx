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
import type {
  EstimationCollectionLineContract,
  EstimationCollectionOverviewContract
} from "@/lib/contracts";
import {
  fetchEstimationCollectionOverview,
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

export default function EstimationsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<EstimationCollectionOverviewContract | null>(null);
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

    void fetchEstimationCollectionOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Estimations and collections overview is unavailable right now.");
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

  const selectedExceptions = useMemo(
    () => overview?.exceptions.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const actionOptions = useMemo(() => (selectedLine ? lineActionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleLineAction(
    collectionHealth: EstimationCollectionLineContract["collectionHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine || !session.accessToken) {
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
        summary: {
          trackedProjects: lines.length,
          estimatedPortfolio: lines.reduce((sum, item) => sum + item.estimatedAmount, 0),
          submittedPortfolio: lines.reduce((sum, item) => sum + item.submittedAmount, 0),
          collectedPortfolio: lines.reduce((sum, item) => sum + item.collectedAmount, 0),
          pendingCollection: lines.reduce((sum, item) => sum + item.pendingCollection, 0),
          criticalCollections: lines.filter((item) => item.collectionHealth === "critical").length
        },
        lines,
        focusLine:
          lines
            .slice()
            .sort((left, right) => {
              if (left.collectionHealth === "critical" && right.collectionHealth !== "critical") {
                return -1;
              }

              if (left.collectionHealth !== "critical" && right.collectionHealth === "critical") {
                return 1;
              }

              return right.pendingCollection - left.pendingCollection;
            })[0] ?? null
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
                value={String(overview.summary.trackedProjects)}
                footnote="Projects with active executed-work and collection posture."
              />
              <KpiCard
                label="Estimated portfolio"
                value={`MXN ${overview.summary.estimatedPortfolio.toLocaleString()}`}
                footnote="Theoretical executed-work portfolio at current baseline."
              />
              <KpiCard
                label="Submitted estimations"
                value={`MXN ${overview.summary.submittedPortfolio.toLocaleString()}`}
                footnote="Work already packaged into billable or collectible estimations."
              />
              <KpiCard
                label="Pending collection"
                value={`MXN ${overview.summary.pendingCollection.toLocaleString()}`}
                footnote="Value still exposed between submitted work and effective collection."
              />
            </section>

            <section className="grid cols2">
              <Card title="Estimation board" description="Project progress, evidence gap and collection exposure in one live board.">
                <FilterBar summary={`${overview.lines.length} estimation lines in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "estimations ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.lines}
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
                      <div className="detailLabel">Pending to bill</div>
                      <div>MXN {selectedLine.pendingToBill.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Pending collection</div>
                      <div>MXN {selectedLine.pendingCollection.toLocaleString()}</div>
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
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading estimations overview" : "Estimations overview not loaded yet"}
            description="This route expects a live backend estimations response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
