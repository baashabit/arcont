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

function buildCloseRouteSummary(line: CloseControlLineContract | null) {
  if (!line) {
    return "Use close control as the command lane for finance, compliance and evidence before month-end release.";
  }

  if (line.streamType === "finance") {
    return "Finance-close issues should route through treasury, payables and final close evidence before leadership treats the month as controlled.";
  }

  if (line.streamType === "compliance") {
    return "Compliance-close issues should route through legal, post-sale and document remediation before they distort the close room.";
  }

  return "Document-control issues should route through supporting evidence and close-control checkpoints before the close lane is treated as clean.";
}

function buildCloseOperationalLinks(line: CloseControlLineContract | null) {
  if (!line) {
    return [
      { label: "Open finance", href: "/finance", tone: "button" as const },
      { label: "Open compliance", href: "/compliance", tone: "buttonGhost" as const },
      { label: "Open document control", href: "/document-control", tone: "buttonGhost" as const }
    ];
  }

  if (line.streamType === "finance") {
    return [
      { label: "Open treasury", href: "/treasury/payment-runs", tone: "button" as const },
      { label: "Open cash flow", href: "/cash-flow", tone: "buttonGhost" as const },
      { label: "Open payables", href: "/accounts-payable", tone: "buttonGhost" as const }
    ];
  }

  if (line.streamType === "compliance") {
    return [
      { label: "Open compliance", href: "/compliance", tone: "button" as const },
      { label: "Open document control", href: "/document-control", tone: "buttonGhost" as const },
      { label: "Open finance", href: "/finance", tone: "buttonGhost" as const }
    ];
  }

  return [
    { label: "Open document control", href: "/document-control", tone: "button" as const },
    { label: "Open compliance", href: "/compliance", tone: "buttonGhost" as const },
    { label: "Open finance", href: "/finance", tone: "buttonGhost" as const }
  ];
}

function buildCloseReleaseGate(line: CloseControlLineContract | null) {
  if (!line) {
    return {
      tone: "info" as const,
      label: "No stream selected",
      summary: "Choose a close stream to verify whether it can really move as controlled or still needs intervention.",
      checks: ["Select a stream from the active close board."]
    };
  }

  const checks: string[] = [];

  if (line.closeHealth === "critical") {
    checks.push("Stream is already in critical close posture.");
  }

  if (line.blockingItems > 0) {
    checks.push(`${line.blockingItems} blocker(s) still remain open.`);
  }

  if (line.closeReadiness < 92) {
    checks.push(`Close readiness is only ${line.closeReadiness}%.`);
  }

  if (line.evidenceCompletion < 90) {
    checks.push(`Evidence completion is only ${line.evidenceCompletion}%.`);
  }

  if (line.slaHoursRemaining < 0) {
    checks.push("Close SLA is already overdue.");
  } else if (line.slaHoursRemaining <= 12) {
    checks.push(`Close SLA has only ${line.slaHoursRemaining} hours remaining.`);
  }

  if (checks.length > 0) {
    const hardBlock = line.closeHealth === "critical" || line.blockingItems > 0 || line.slaHoursRemaining < 0
    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not release yet" : "Operate with control",
      summary: hardBlock
        ? "This stream still carries hard blockers before the close room should treat it as controlled."
        : "The stream can continue, but readiness, evidence or timing still need tighter close control.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for controlled close",
    summary: "Readiness, evidence and timing are aligned for a controlled close checkpoint.",
    checks: [
      "Continue into treasury, compliance or document follow-through without rebuilding the same close context.",
      "Keep the same owner and next action attached until the checkpoint is formally closed."
    ]
  };
}

function buildCloseHumanStep(line: CloseControlLineContract | null) {
  if (!line) {
    return "Select a stream to identify the next human move.";
  }

  if (line.closeHealth === "critical" || line.blockingItems > 0) {
    return "Clear the active blocker first, then return to the close room and verify whether readiness and evidence improved enough to downgrade the stream.";
  }

  if (line.closeReadiness < 92 || line.evidenceCompletion < 90) {
    return "Complete missing evidence, raise readiness and keep the upstream owner in the same close-control loop.";
  }

  if (line.slaHoursRemaining <= 12) {
    return "Escalate the stream owner now and secure the final close checkpoint before the window expires.";
  }

  return "Confirm the controlled checkpoint and keep downstream finance or compliance release aligned while context is still current.";
}

function buildCloseWhyNow(line: CloseControlLineContract | null) {
  if (!line) {
    return "Choose a close stream to understand why the close room should care right now.";
  }

  if (line.closeHealth === "critical") {
    return `${line.code} is already in critical close posture, so delay here can immediately distort the month-end release path.`;
  }

  if (line.blockingItems > 0) {
    return `${line.code} still carries ${line.blockingItems} active blocker(s), so the close room should act now before the chain normalizes unresolved debt.`;
  }

  if (line.slaHoursRemaining <= 12) {
    return `${line.code} is already close to the SLA wall, so waiting here can turn a controlled stream into an avoidable close failure.`;
  }

  return `${line.code} is still an active close lane, so the team should protect continuity now instead of assuming the checkpoint will hold by inertia.`;
}

function buildCloseDownstreamEffect(line: CloseControlLineContract | null) {
  if (!line) {
    return "Select a close stream to inspect what it can block downstream.";
  }

  if (line.closeHealth === "critical" || line.blockingItems > 0) {
    return "The downstream effect is delayed close release, weaker finance confidence and more pressure on treasury, compliance or document evidence lanes.";
  }

  if (line.closeReadiness < 92 || line.evidenceCompletion < 90) {
    return "Weak readiness or evidence here can feed back into finance reporting, compliance release and final project close credibility.";
  }

  return "The downstream effect is mainly controlled continuity: keep finance, compliance and evidence lanes aligned so the close stream stays clean.";
}

function buildCloseReportBack(line: CloseControlLineContract | null) {
  if (!line) {
    return "Choose a close stream to define the next report-back window.";
  }

  if (line.closeHealth === "critical" || line.blockingItems > 0) {
    return "Report back before the next close-room cutoff with blocker containment status and the exact release owner.";
  }

  if (line.closeReadiness < 92 || line.evidenceCompletion < 90) {
    return "Report back in the same operating cycle once readiness and evidence are strong enough for the next controlled checkpoint.";
  }

  return "Report back at the next close-control refresh confirming the stream stayed aligned through finance, compliance and evidence follow-through.";
}

export default function CloseControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<CloseControlOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | CloseControlLineContract["closeHealth"]>("all");
  const [streamFilter, setStreamFilter] = useState<"all" | CloseControlLineContract["streamType"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  const filteredLines = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.lines.filter((line) => {
      const matchesHealth = healthFilter === "all" || line.closeHealth === healthFilter;
      const matchesStream = streamFilter === "all" || line.streamType === streamFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        line.streamName.toLowerCase().includes(normalizedSearch) ||
        line.code.toLowerCase().includes(normalizedSearch) ||
        line.streamType.toLowerCase().includes(normalizedSearch) ||
        line.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesStream && matchesSearch;
    });
  }, [healthFilter, overview, searchFilter, streamFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedStory = useMemo(() => buildCloseStory(selectedLine, selectedRisks.length), [selectedLine, selectedRisks.length]);
  const selectedRouteSummary = useMemo(() => buildCloseRouteSummary(selectedLine), [selectedLine]);
  const selectedReleaseGate = useMemo(() => buildCloseReleaseGate(selectedLine), [selectedLine]);
  const selectedHumanStep = useMemo(() => buildCloseHumanStep(selectedLine), [selectedLine]);
  const selectedCloseWhyNow = useMemo(() => buildCloseWhyNow(selectedLine), [selectedLine]);
  const selectedCloseDownstreamEffect = useMemo(() => buildCloseDownstreamEffect(selectedLine), [selectedLine]);
  const selectedCloseReportBack = useMemo(() => buildCloseReportBack(selectedLine), [selectedLine]);
  const selectedOperationalLinks = useMemo(() => buildCloseOperationalLinks(selectedLine), [selectedLine]);

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

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

  async function handleAction(closeHealth: CloseControlLineContract["closeHealth"], suggestedNextAction: string) {
    if (!selectedLine) {
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
                value={String(filteredSummary.trackedStreams)}
                footnote="Finance, compliance and document streams visible in the current filter."
              />
              <KpiCard
                label="Readiness"
                value={`${filteredSummary.averageCloseReadiness}%`}
                footnote="Average close readiness across the visible close subset."
              />
              <KpiCard
                label="Blocked items"
                value={String(filteredSummary.blockedItems)}
                footnote="Open blockers still preventing a clean visible close checkpoint."
              />
              <KpiCard
                label="Fiscal exposure"
                value={`MXN ${filteredSummary.fiscalExposure.toLocaleString()}`}
                footnote="Directional exposure still linked to the visible close subset."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Close checkpoint walkthrough"
                description="Turn close into an operable workflow: monitor blockers, evidence and fiscal exposure instead of a static checklist."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    This page is now usable for tests without backend auth: operators can review streams, change posture and pressure-test the month-end lane.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">close readiness</Badge>
                    <Badge tone="info">compliance</Badge>
                    <Badge tone="info">document support</Badge>
                  </div>
                </div>
              </Card>

              <Card
                title="Close continuity workflow"
                description="Close control is the operating bridge between finance signals, legal-compliance posture and document evidence."
                aside={<Badge tone={filteredSummary.criticalStreams > 0 ? "danger" : filteredSummary.overdueStreams > 0 ? "warning" : "success"}>{filteredSummary.criticalStreams > 0 ? "critical lane" : filteredSummary.overdueStreams > 0 ? "overdue lane" : "stable lane"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Route summary</div><div>{selectedRouteSummary}</div></div>
                  <div className="detailRow"><div className="detailLabel">Checkpoint rule</div><div>No stream should be marked controlled while blockers, low evidence quality or weak readiness remain open.</div></div>
                  <div className="detailRow"><div className="detailLabel">Operator next step</div><div>Move from close board into the exact upstream module causing the month-end friction, then come back and re-check posture.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  {selectedOperationalLinks.map((link) => (
                    <Link key={`${link.href}-${link.label}`} className={link.tone} href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </Card>

              <Card title="Close board" description="Live close control across finance, compliance and document evidence.">
                <FilterBar summary={`${filteredLines.length} close streams match the current operating filters`}>
                  <label className="fieldLabel">
                    Health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="watch">Watch</option>
                      <option value="controlled">Controlled</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Stream
                    <select className="field" value={streamFilter} onChange={(event) => setStreamFilter(event.target.value as typeof streamFilter)}>
                      <option value="all">All</option>
                      <option value="finance">Finance</option>
                      <option value="compliance">Compliance</option>
                      <option value="document_control">Document control</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Stream, code, type or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "close control ready"}</Badge>
                  <Badge tone={filteredSummary.criticalStreams > 0 ? "danger" : filteredSummary.overdueStreams > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalStreams > 0
                      ? `${filteredSummary.criticalStreams} critical`
                      : filteredSummary.overdueStreams > 0
                        ? `${filteredSummary.overdueStreams} overdue`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
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
                    <div className="detailRow">
                      <div className="detailLabel">Release gate</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={selectedReleaseGate.tone}>{selectedReleaseGate.label}</Badge>
                          <span>{selectedReleaseGate.summary}</span>
                        </div>
                        {selectedReleaseGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">
                            {check}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{selectedHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{selectedCloseWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{selectedCloseDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Route summary</div>
                      <div>{selectedRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report back</div>
                      <div>{selectedCloseReportBack}</div>
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
                      {selectedOperationalLinks.map((link) => (
                        <Link key={`${link.href}-${link.label}`} className={link.tone} href={link.href}>
                          {link.label}
                        </Link>
                      ))}
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
            primaryAction={{ label: "Open finance", href: "/finance" }}
            secondaryAction={{ label: "Open compliance", href: "/compliance" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
