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
import type { DailyLogEntryContract, DailyLogOverviewContract } from "@/lib/contracts";
import { fetchDailyLogOverview, updateDailyLogEntry } from "@/lib/platform-api";

function statusTone(status: DailyLogEntryContract["status"]) {
  switch (status) {
    case "approved":
      return "success";
    case "submitted":
      return "info";
    case "flagged":
      return "danger";
    default:
      return "warning";
  }
}

function weatherLabel(weather: DailyLogEntryContract["weather"]) {
  switch (weather) {
    case "clear":
      return "Clear";
    case "windy":
      return "Windy";
    case "rain":
      return "Rain";
    default:
      return "Storm";
  }
}

function actionOptions(entry: DailyLogEntryContract) {
  switch (entry.status) {
    case "draft":
      return [
        {
          label: "Submit log",
          status: "submitted" as const,
          nextAction: "Submit the field log with the current workforce and evidence package."
        },
        {
          label: "Flag issue",
          status: "flagged" as const,
          nextAction: "Raise the blocker and keep this field log under daily operating attention."
        }
      ];
    case "submitted":
      return [
        {
          label: "Approve log",
          status: "approved" as const,
          nextAction: "Approve the field log and release the next execution step to the crew."
        },
        {
          label: "Flag issue",
          status: "flagged" as const,
          nextAction: "Hold this log and escalate the blocker or evidence gap before approval."
        }
      ];
    case "flagged":
      return [
        {
          label: "Return to draft",
          status: "draft" as const,
          nextAction: "Rework the field log package and complete the missing capture before resubmission."
        },
        {
          label: "Resubmit log",
          status: "submitted" as const,
          nextAction: "Resubmit the corrected log for review after containing the field issue."
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(entries: DailyLogEntryContract[]) {
  return {
    submittedToday: entries.filter((entry) => entry.status !== "draft").length,
    approvedLogs: entries.filter((entry) => entry.status === "approved").length,
    flaggedLogs: entries.filter((entry) => entry.status === "flagged").length,
    totalWorkforce: entries.reduce((sum, entry) => sum + entry.workforceCount, 0),
    pendingEvidence: entries.reduce((sum, entry) => sum + (entry.status !== "approved" ? Math.max(0, 12 - entry.evidenceCount) : 0), 0),
    averageProgress:
      entries.length > 0 ? Number((entries.reduce((sum, entry) => sum + entry.progressPercent, 0) / entries.length).toFixed(1)) : 0
  };
}

function pickFocusEntry(entries: DailyLogEntryContract[]) {
  return (
    entries
      .slice()
      .sort((left, right) => {
        const weight = { flagged: 4, submitted: 3, draft: 2, approved: 1 } as const;
        const gap = weight[right.status] - weight[left.status];
        if (gap !== 0) {
          return gap;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })[0] ?? null
  );
}

export default function DailyLogPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<DailyLogOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
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

    void fetchDailyLogOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Daily log overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedEntryId((current) => current ?? result.focusEntry?.id ?? result.entries[0]?.id ?? null);
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

  const selectedEntry = useMemo(
    () => overview?.entries.find((entry) => entry.id === selectedEntryId) ?? overview?.focusEntry ?? null,
    [overview, selectedEntryId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.logId === selectedEntry?.id) ?? [],
    [overview, selectedEntry]
  );

  const entryActions = useMemo(() => (selectedEntry ? actionOptions(selectedEntry) : []), [selectedEntry]);

  useEffect(() => {
    setNextActionDraft(selectedEntry?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedEntryId, selectedEntry?.id, selectedEntry?.nextAction]);

  async function handleAction(status: DailyLogEntryContract["status"], suggestedNextAction: string) {
    if (!selectedEntry || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the daily log.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateDailyLogEntry(
      selectedEntry.id,
      activeCompany.id,
      {
        status,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Daily log update failed.");
      setIsSaving(false);
      return;
    }

    const updatedEntry = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const entries = current.entries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry));

      return {
        ...current,
        summary: recomputeSummary(entries),
        entries,
        focusEntry: pickFocusEntry(entries)
      };
    });

    setNextActionDraft(updatedEntry.nextAction);
    setActionMessage(`Daily log moved to ${updatedEntry.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Daily log"
      eyebrow="Field execution"
      description="Daily site diary for crews, evidence, blockers and shift-by-shift operating discipline."
    >
      <ModuleGate moduleKeys={["projects.daily-log"]} requiredPermissions={["projects:*"]} title="Daily log">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Submitted today"
                value={String(overview.summary.submittedToday)}
                footnote="Logs already out of draft and visible to supervision today."
              />
              <KpiCard
                label="Approved logs"
                value={String(overview.summary.approvedLogs)}
                footnote="Field logs that already cleared review with evidence discipline."
              />
              <KpiCard
                label="Flagged logs"
                value={String(overview.summary.flaggedLogs)}
                footnote="Logs still blocked by issues, evidence gaps or field exceptions."
              />
              <KpiCard
                label="Pending evidence"
                value={String(overview.summary.pendingEvidence)}
                footnote="Directional evidence debt still pending before clean field closure."
              />
            </section>

            <section className="grid cols2">
              <Card title="Daily log board" description="Shift capture, productivity and blocker posture across the active fronts.">
                <FilterBar summary={`${overview.entries.length} logs in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "field diary ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.entries}
                  columns={[
                    {
                      key: "frontName",
                      label: "Front",
                      render: (entry) => (
                        <button type="button" className="button ghost" onClick={() => setSelectedEntryId(entry.id)}>
                          {entry.frontName}
                        </button>
                      )
                    },
                    {
                      key: "projectName",
                      label: "Project",
                      render: (entry) => entry.projectName
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (entry) => <Badge tone={statusTone(entry.status)}>{entry.status}</Badge>
                    },
                    {
                      key: "workforceCount",
                      label: "Crew",
                      render: (entry) => String(entry.workforceCount)
                    },
                    {
                      key: "progressPercent",
                      label: "Progress",
                      render: (entry) => `${entry.progressPercent}%`
                    }
                  ]}
                />
              </Card>

              <Card
                title={selectedEntry ? selectedEntry.frontName : "Select a daily log"}
                description={
                  selectedEntry
                    ? `${selectedEntry.projectName} · ${selectedEntry.logDate} · ${selectedEntry.supervisor}`
                    : "Review the selected field log, blockers and evidence posture."
                }
              >
                {selectedEntry ? (
                  <div className="stack">
                    <div className="grid cols2">
                      <KpiCard label="Crew" value={String(selectedEntry.workforceCount)} footnote={`Shift: ${selectedEntry.shift}`} />
                      <KpiCard
                        label="Progress"
                        value={`${selectedEntry.progressPercent}%`}
                        footnote={`${selectedEntry.concretePourM3} m3 concrete captured`}
                      />
                    </div>

                    <div className="row gap wrap">
                      <Badge tone={statusTone(selectedEntry.status)}>{selectedEntry.status}</Badge>
                      <Badge tone="info">{weatherLabel(selectedEntry.weather)}</Badge>
                      <Badge tone={selectedEntry.blockersCount > 0 ? "danger" : "success"}>
                        {selectedEntry.blockersCount} blockers
                      </Badge>
                      <Badge tone={selectedEntry.incidentsCount > 0 ? "warning" : "success"}>
                        {selectedEntry.incidentsCount} incidents
                      </Badge>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="daily-log-next-action">
                        Next action
                      </label>
                      <textarea
                        id="daily-log-next-action"
                        className="textarea"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                      />
                    </div>

                    <div className="row gap wrap">
                      {entryActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button secondary"
                          onClick={() => void handleAction(action.status, action.nextAction)}
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {actionError ? <p className="text-danger">{actionError}</p> : null}
                    {actionMessage ? <p className="text-success">{actionMessage}</p> : null}

                    <Card title="Field risks" description="Current blockers or evidence issues tied to this daily log.">
                      {selectedRisks.length > 0 ? (
                        <div className="stack">
                          {selectedRisks.map((risk) => (
                            <div key={risk.id} className="row space-between card-section">
                              <div>
                                <strong>{risk.title}</strong>
                                <p>
                                  {risk.category} · {risk.owner}
                                </p>
                              </div>
                              <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                                {risk.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="No active risks" description="This log is not carrying explicit field blockers right now." />
                      )}
                    </Card>
                  </div>
                ) : (
                  <EmptyState title="No log selected" description="Choose a daily log from the board to review field detail." />
                )}
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Daily log unavailable"
            description={error ?? "The field diary could not be loaded from the current backend source."}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
