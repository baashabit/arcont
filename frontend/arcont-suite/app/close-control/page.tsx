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
import type { CloseControlLineContract, CloseControlOverviewContract } from "@/lib/contracts";
import { fetchCloseControlOverview, updateCloseControlLine } from "@/lib/platform-api";

function healthTone(status: CloseControlLineContract["closeHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function actionOptions(line: CloseControlLineContract) {
  switch (line.closeHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          closeHealth: "watch" as const,
          nextAction: "Contain the blocker and keep the stream under active close supervision"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          closeHealth: "critical" as const,
          nextAction: "Escalate the stream because close evidence or fiscal pressure remains unresolved"
        },
        {
          label: "Mark controlled",
          closeHealth: "controlled" as const,
          nextAction: "Blockers resolved and the stream is ready for a clean close checkpoint"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          closeHealth: "watch" as const,
          nextAction: "Monitor the stream before it turns into a month-end blocker"
        }
      ];
  }
}

function recomputeSummary(lines: CloseControlLineContract[]) {
  return {
    trackedStreams: lines.length,
    averageCloseReadiness:
      lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.closeReadiness, 0) / lines.length).toFixed(1)) : 0,
    criticalStreams: lines.filter((item) => item.closeHealth === "critical").length,
    blockedItems: lines.reduce((sum, item) => sum + item.blockingItems, 0),
    fiscalExposure: lines.reduce((sum, item) => sum + item.fiscalExposure, 0),
    overdueStreams: lines.filter((item) => item.slaHoursRemaining < 0).length
  };
}

function pickFocusLine(lines: CloseControlLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.closeHealth === "critical" && right.closeHealth !== "critical") {
          return -1;
        }
        if (left.closeHealth !== "critical" && right.closeHealth === "critical") {
          return 1;
        }
        return left.slaHoursRemaining - right.slaHoursRemaining;
      })[0] ?? null
  );
}

function buildCloseStory(line: CloseControlLineContract | null, riskCount: number) {
  if (!line) {
    return null;
  }

  return {
    closeExposure:
      line.slaHoursRemaining < 0
        ? `This stream is already overdue by ${Math.abs(line.slaHoursRemaining)} hours and is distorting close discipline.`
        : `This stream still has ${line.slaHoursRemaining} hours before breaching its close window.`,
    unblockLane:
      line.blockingItems > 0
        ? `${line.blockingItems} blockers remain active and must be cleared together with evidence completion.`
        : "The blocker queue is contained; focus should stay on evidence quality and timing.",
    escalationSignal:
      riskCount > 0
        ? `${riskCount} mapped risks remain open and justify active escalation in the close room.`
        : "No mapped escalation remains open; keep the stream under checkpoint monitoring."
  };
}

export default function CloseControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<CloseControlOverviewContract | null>(null);
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

    void fetchCloseControlOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Close control overview is unavailable right now.");
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

  const selectedStory = useMemo(() => buildCloseStory(selectedLine, selectedRisks.length), [selectedLine, selectedRisks.length]);

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleAction(closeHealth: CloseControlLineContract["closeHealth"], suggestedNextAction: string) {
    if (!selectedLine || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the close stream.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateCloseControlLine(
      selectedLine.id,
      activeCompany.id,
      {
        closeHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Close control update failed.");
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
    setActionMessage(`Close stream moved to ${response.data.closeHealth}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Close Control"
      eyebrow="Month-end execution"
      description="Month-end, SAT and support-evidence blockers managed as live operational streams instead of a static checklist."
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title="Close control"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked streams"
                value={String(overview.summary.trackedStreams)}
                footnote="Finance, compliance and document streams participating in the close."
              />
              <KpiCard
                label="Readiness"
                value={`${overview.summary.averageCloseReadiness}%`}
                footnote="Average close readiness across the active close room."
              />
              <KpiCard
                label="Blocked items"
                value={String(overview.summary.blockedItems)}
                footnote="Open blockers still preventing a clean close checkpoint."
              />
              <KpiCard
                label="Fiscal exposure"
                value={`MXN ${overview.summary.fiscalExposure.toLocaleString()}`}
                footnote="Directional exposure still linked to fiscal, evidence or closing exceptions."
              />
            </section>

            <section className="grid cols2">
              <Card title="Close board" description="Live close control across finance, compliance and document evidence.">
                <FilterBar summary={`${overview.lines.length} close streams in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "close control ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.lines}
                  columns={[
                    {
                      key: "stream",
                      label: "Stream",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.streamName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.streamType}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "readiness",
                      label: "Readiness",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.closeReadiness}%</strong>
                          <span className="tableCellMuted">{row.evidenceCompletion}% evidence</span>
                        </div>
                      )
                    },
                    {
                      key: "sla",
                      label: "SLA / blockers",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.slaHoursRemaining} h</strong>
                          <span className="tableCellMuted">{row.blockingItems} blockers</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.closeHealth)}>{row.closeHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected stream"
                description="Focused close action, blockers and fiscal posture for the selected stream."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.closeHealth)}>{selectedLine.closeHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Type</div>
                      <div>{selectedLine.streamType}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Overdue window</div>
                      <div>{selectedLine.slaHoursRemaining} h</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Blockers</div>
                      <div>{selectedLine.blockingItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Fiscal exposure</div>
                      <div>MXN {selectedLine.fiscalExposure.toLocaleString()}</div>
                    </div>

                    <label className="stack" htmlFor="close-control-next-action">
                      <span className="detailLabel">Next action</span>
                      <textarea
                        id="close-control-next-action"
                        className="field"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder="Describe the action required to unblock this close stream"
                      />
                    </label>

                    <div className="row gap wrap">
                      <Link className="buttonGhost" href="/accounts-payable">
                        Open payables
                      </Link>
                      <Link className="buttonGhost" href="/document-control">
                        Open document control
                      </Link>
                      <Link className="buttonGhost" href="/compliance">
                        Open compliance
                      </Link>
                      <Link className="buttonGhost" href="/finance">
                        Open finance
                      </Link>
                      <Link className="buttonGhost" href="/platform/settings">
                        Open settings
                      </Link>
                    </div>

                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.closeHealth, action.nextAction)}
                          disabled={
                            isSaving ||
                            (action.closeHealth === "controlled" &&
                              (selectedLine.blockingItems > 0 ||
                                selectedLine.closeReadiness < 92 ||
                                selectedLine.evidenceCompletion < 90)) ||
                            (action.closeHealth === "watch" && selectedLine.slaHoursRemaining < -8)
                          }
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {actionError ? <EmptyState title="Update blocked" description={actionError} /> : null}
                    {actionMessage ? <EmptyState title="Close stream updated" description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState
                    title="Select a stream"
                    description="Choose a close stream to inspect readiness, blockers and the next close action."
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Close exposure" description="Immediate close implication of the selected stream.">
                <p className="sectionText">{selectedStory?.closeExposure ?? "Choose a stream to inspect close exposure."}</p>
              </Card>
              <Card title="Unblock lane" description="What the close room should attack next.">
                <p className="sectionText">{selectedStory?.unblockLane ?? "Choose a stream to inspect the unblock lane."}</p>
              </Card>
              <Card title="Escalation signal" description="When the selected stream deserves higher attention.">
                <p className="sectionText">
                  {selectedStory?.escalationSignal ?? "Choose a stream to inspect the escalation signal."}
                </p>
              </Card>
            </section>

            <Card title="Close risks" description="Fiscal, evidence and legal blockers still affecting the current close.">
              {selectedRisks.length > 0 ? (
                <DataTable
                  rows={selectedRisks}
                  columns={[
                    {
                      key: "risk",
                      label: "Risk",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.title}</strong>
                          <span className="tableCellMuted">{row.category}</span>
                        </div>
                      )
                    },
                    {
                      key: "severity",
                      label: "Severity",
                      render: (row) => (
                        <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>
                          {row.severity}
                        </Badge>
                      )
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
                  title="No mapped close risks"
                  description="Select a close stream with active blockers to inspect its current risk stack."
                />
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title={error ?? "Close control unavailable"}
            description="We could not load the active close room for the selected company."
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
