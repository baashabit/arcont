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
import { createDailyLogEntry, fetchDailyLogOverview, fetchEquipmentOverview, updateDailyLogEntry } from "@/lib/platform-api";

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
      entries.length > 0 ? Number((entries.reduce((sum, entry) => sum + entry.progressPercent, 0) / entries.length).toFixed(1)) : 0,
    executionRiskLogs: entries.filter(
      (entry) => entry.status === "flagged" || entry.qualityOpenFindings > 3 || entry.subcontractHealth === "critical"
    ).length
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

type DailyLogEquipmentBridge = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
} | null;

function buildDailyLogEquipmentStory(entry: DailyLogEntryContract | null, bridge: DailyLogEquipmentBridge) {
  if (!entry) {
    return null;
  }

  const linkedMachines =
    bridge?.equipment.machines.filter((item) => item.projectName === entry.projectName && item.frontName === entry.frontName) ?? [];
  const constrainedMachines = linkedMachines.filter((item) => item.status !== "available" || item.health !== "healthy");

  return {
    equipmentSupport:
      linkedMachines.length > 0
        ? `${linkedMachines.length} tracked machines support this front, with ${constrainedMachines.length} already degraded.`
        : "No tracked machine is currently mapped to this front.",
    executionConstraint:
      constrainedMachines.length > 0
        ? `${constrainedMachines[0]?.machineName ?? "A constrained asset"} is affecting the shift under ${constrainedMachines[0]?.status ?? "constraint"} posture.`
        : "Equipment is not the primary execution constraint on this daily log.",
    nextEquipmentMove:
      constrainedMachines.length > 0
        ? constrainedMachines[0]?.nextAction ?? "Recover equipment continuity before the next field cutoff."
        : "No immediate equipment move is currently dominating this front."
  };
}

export default function DailyLogPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<DailyLogOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<DailyLogEquipmentBridge>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    projectName: "Nuevo proyecto",
    frontName: "Frente 1",
    supervisor: "Resident engineer",
    logDate: new Date().toISOString().slice(0, 10),
    shift: "morning" as DailyLogEntryContract["shift"],
    weather: "clear" as DailyLogEntryContract["weather"],
    status: "draft" as DailyLogEntryContract["status"],
    progressPercent: "0",
    workforceCount: "18",
    incidentsCount: "0",
    blockersCount: "0",
    evidenceCount: "4",
    concretePourM3: "0",
    projectStatus: "active" as DailyLogEntryContract["projectStatus"],
    qualityOpenFindings: "0",
    qualityReleaseReadiness: "92",
    subcontractHealth: "controlled" as DailyLogEntryContract["subcontractHealth"],
    pendingDestajo: "0",
    nextAction: ""
  });

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchDailyLogOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchEquipmentOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, equipment]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Daily log overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedEntryId((current) => current ?? result.focusEntry?.id ?? result.entries[0]?.id ?? null);
        setBridgeContext(equipment ? { equipment } : null);
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

  const selectedStory = useMemo(
    () => buildDailyLogEquipmentStory(selectedEntry, bridgeContext),
    [bridgeContext, selectedEntry]
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

    if (status === "approved" && selectedEntry.evidenceCount < 4) {
      setActionError("Daily log needs at least 4 evidence items before approval.");
      return;
    }

    if (status === "approved" && selectedEntry.blockersCount > 0) {
      setActionError("Daily log cannot be approved while blockers remain open.");
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

  async function handleCreateEntry() {
    if (!overview || !session.accessToken) {
      return;
    }

    const projectName = createForm.projectName.trim();
    const frontName = createForm.frontName.trim();
    const supervisor = createForm.supervisor.trim();
    const nextAction = createForm.nextAction.trim();

    if (projectName.length < 3 || frontName.length < 3 || supervisor.length < 3) {
      setActionError("Project, front and supervisor must be specific before creating the daily log.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before creating the daily log.");
      setCreateMessage(null);
      return;
    }

    const progressPercent = Number(createForm.progressPercent);
    const workforceCount = Number(createForm.workforceCount);
    const blockersCount = Number(createForm.blockersCount);
    const incidentsCount = Number(createForm.incidentsCount);
    const evidenceCount = Number(createForm.evidenceCount);
    const concretePourM3 = Number(createForm.concretePourM3);

    if (!createForm.logDate) {
      setActionError("Log date is required before creating the daily log.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
      setActionError("Progress percent must be between 0 and 100.");
      setCreateMessage(null);
      return;
    }

    if (![workforceCount, blockersCount, incidentsCount, evidenceCount].every((value) => Number.isFinite(value) && value >= 0)) {
      setActionError("Crew, blockers, incidents and evidence must be valid non-negative numbers.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(concretePourM3) || concretePourM3 < 0) {
      setActionError("Concrete volume must be a valid non-negative number.");
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createDailyLogEntry(
      activeCompany.id,
      {
        projectName,
        frontName,
        supervisor,
        logDate: createForm.logDate,
        shift: createForm.shift,
        weather: createForm.weather,
        status: createForm.status,
        progressPercent,
        workforceCount,
        incidentsCount,
        blockersCount,
        evidenceCount,
        concretePourM3,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Daily log creation failed.");
      setIsCreating(false);
      return;
    }

    const newEntry = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const entries = [newEntry, ...current.entries];
      return {
        ...current,
        summary: recomputeSummary(entries),
        entries,
        focusEntry: pickFocusEntry(entries)
      };
    });
    setSelectedEntryId(newEntry.id);
    setNextActionDraft(newEntry.nextAction);
    setCreateMessage(`${frontName} daily log added to the workbench.`);
    setCreateForm((current) => ({
      ...current,
      frontName,
      projectName,
      supervisor,
      logDate: new Date().toISOString().slice(0, 10),
      status: "draft",
      progressPercent: "0",
      workforceCount: "18",
      incidentsCount: "0",
      blockersCount: "0",
      evidenceCount: "4",
      concretePourM3: "0",
      qualityOpenFindings: "0",
      qualityReleaseReadiness: "92",
      pendingDestajo: "0",
      nextAction: ""
    }));
    setIsCreating(false);
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
              <KpiCard
                label="Execution risk"
                value={String(overview.summary.executionRiskLogs)}
                footnote="Logs already carrying field, quality or subcontract execution risk."
              />
            </section>

            <section className="grid cols3">
              <Card title="Equipment support" description="How much asset support is currently mapped to this field front.">
                <p className="sectionText">
                  {selectedStory?.equipmentSupport ?? "Choose a daily log to inspect equipment support."}
                </p>
              </Card>
              <Card title="Execution constraint" description="Whether asset posture is already limiting this shift.">
                <p className="sectionText">
                  {selectedStory?.executionConstraint ?? "Choose a daily log to inspect equipment constraint."}
                </p>
              </Card>
              <Card title="Next equipment move" description="Immediate asset action required for the selected front.">
                <p className="sectionText">
                  {selectedStory?.nextEquipmentMove ?? "Choose a daily log to inspect the next equipment move."}
                </p>
              </Card>
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
                      <Badge tone={selectedEntry.projectStatus === "blocked" ? "danger" : selectedEntry.projectStatus === "at_risk" ? "warning" : "success"}>
                        {selectedEntry.projectStatus}
                      </Badge>
                      <Badge tone={selectedEntry.subcontractHealth === "critical" ? "danger" : selectedEntry.subcontractHealth === "watch" ? "warning" : "success"}>
                        {selectedEntry.subcontractHealth}
                      </Badge>
                      <Badge tone={selectedEntry.blockersCount > 0 ? "danger" : "success"}>
                        {selectedEntry.blockersCount} blockers
                      </Badge>
                      <Badge tone={selectedEntry.incidentsCount > 0 ? "warning" : "success"}>
                        {selectedEntry.incidentsCount} incidents
                      </Badge>
                    </div>

                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">Quality posture</div>
                        <div>
                          {selectedEntry.qualityOpenFindings} open findings
                          <div className="tableCellMuted">{selectedEntry.qualityReleaseReadiness}% release readiness</div>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Pending destajo</div>
                        <div>MXN {selectedEntry.pendingDestajo.toLocaleString()}</div>
                      </div>
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

            <section className="grid cols2">
              <Card
                title="Capture daily log"
                description="Create a new field diary entry in the tenant workbench before wiring live POST endpoints."
              >
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Project</div>
                    <input
                      className="field"
                      value={createForm.projectName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Front</div>
                    <input
                      className="field"
                      value={createForm.frontName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Supervisor</div>
                    <input
                      className="field"
                      value={createForm.supervisor}
                      onChange={(event) => setCreateForm((current) => ({ ...current, supervisor: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Date</div>
                    <input
                      className="field"
                      type="date"
                      value={createForm.logDate}
                      onChange={(event) => setCreateForm((current) => ({ ...current, logDate: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Shift</div>
                    <select
                      className="selectField"
                      value={createForm.shift}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, shift: event.target.value as DailyLogEntryContract["shift"] }))
                      }
                    >
                      <option value="morning">morning</option>
                      <option value="mixed">mixed</option>
                      <option value="night">night</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Weather</div>
                    <select
                      className="selectField"
                      value={createForm.weather}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          weather: event.target.value as DailyLogEntryContract["weather"]
                        }))
                      }
                    >
                      <option value="clear">clear</option>
                      <option value="windy">windy</option>
                      <option value="rain">rain</option>
                      <option value="storm">storm</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Status</div>
                    <select
                      className="selectField"
                      value={createForm.status}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          status: event.target.value as DailyLogEntryContract["status"]
                        }))
                      }
                    >
                      <option value="draft">draft</option>
                      <option value="submitted">submitted</option>
                      <option value="approved">approved</option>
                      <option value="flagged">flagged</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Progress %</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.progressPercent}
                      onChange={(event) => setCreateForm((current) => ({ ...current, progressPercent: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Crew</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.workforceCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, workforceCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Blockers</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.blockersCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, blockersCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Incidents</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.incidentsCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, incidentsCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Evidence</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.evidenceCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, evidenceCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Concrete m3</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.concretePourM3}
                      onChange={(event) => setCreateForm((current) => ({ ...current, concretePourM3: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Project status</div>
                    <select
                      className="selectField"
                      value={createForm.projectStatus}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          projectStatus: event.target.value as DailyLogEntryContract["projectStatus"]
                        }))
                      }
                    >
                      <option value="on_track">on_track</option>
                      <option value="at_risk">at_risk</option>
                      <option value="blocked">blocked</option>
                      <option value="completed">completed</option>
                      <option value="unknown">unknown</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Quality findings</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.qualityOpenFindings}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, qualityOpenFindings: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Release readiness %</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.qualityReleaseReadiness}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, qualityReleaseReadiness: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Subcontract health</div>
                    <select
                      className="selectField"
                      value={createForm.subcontractHealth}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          subcontractHealth: event.target.value as DailyLogEntryContract["subcontractHealth"]
                        }))
                      }
                    >
                      <option value="controlled">controlled</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                      <option value="unknown">unknown</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Pending destajo</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.pendingDestajo}
                      onChange={(event) => setCreateForm((current) => ({ ...current, pendingDestajo: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder="Cerrar evidencia, alinear cuadrilla y liberar revisión del residente"
                    />
                  </label>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateEntry()}>
                    {isCreating ? "Saving..." : "Add daily log"}
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card
                title="Capture rules"
                description="This keeps the daily-log workflow useful before backend creation endpoints are implemented."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Scope</div>
                    <div>New entries stay inside the active tenant session and immediately affect the field diary board.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Focus</div>
                    <div>The new daily log becomes the active selected record so the supervisor can continue working on it.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Backend path</div>
                    <div>This form already persists through `POST /daily-log/entries`, so field supervision is no longer browser-only.</div>
                  </div>
                </div>
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
