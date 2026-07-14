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
import type { ProjectPortfolioItemContract, ProjectPortfolioOverviewContract } from "@/lib/contracts";
import { createProjectPortfolioItem, fetchEquipmentOverview, fetchProjectsOverview, updateProjectPortfolioItem } from "@/lib/platform-api";

function statusTone(status: ProjectPortfolioItemContract["status"]) {
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

function budgetTone(budgetHealth: ProjectPortfolioItemContract["budgetHealth"]) {
  switch (budgetHealth) {
    case "on_track":
      return "success";
    case "warning":
      return "warning";
    default:
      return "danger";
  }
}

function projectActionOptions(project: ProjectPortfolioItemContract) {
  switch (project.status) {
    case "planning":
      return [
        {
          label: "Start project",
          status: "active" as const,
          nextMilestone: "Mobilization and first production front release"
        }
      ];
    case "active":
      return [
        {
          label: "Mark at risk",
          status: "at_risk" as const,
          nextMilestone: "Recovery plan review with PMO and supervision"
        },
        {
          label: "Block project",
          status: "blocked" as const,
          nextMilestone: "Escalate blocker and freeze affected fronts"
        },
        {
          label: "Close project",
          status: "closed" as const,
          nextMilestone: "Administrative closeout and final handover"
        }
      ];
    case "at_risk":
      return [
        {
          label: "Recover to active",
          status: "active" as const,
          nextMilestone: "Resume baseline production sequence"
        },
        {
          label: "Block project",
          status: "blocked" as const,
          nextMilestone: "Escalate unresolved blocker to steering review"
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume as active",
          status: "active" as const,
          nextMilestone: "Restart fronts after blocker release"
        },
        {
          label: "Move to at risk",
          status: "at_risk" as const,
          nextMilestone: "Track controlled restart with recovery plan"
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(projects: ProjectPortfolioItemContract[]) {
  const activeProjects = projects.filter((project) => ["active", "at_risk", "blocked"].includes(project.status));
  return {
    activeProjects: activeProjects.length,
    averageProgress:
      activeProjects.length > 0
        ? Number((activeProjects.reduce((sum, project) => sum + project.progress, 0) / activeProjects.length).toFixed(1))
        : 0,
    qualityHolds: activeProjects.reduce((sum, project) => sum + project.qualityHolds, 0),
    permitBlockers: activeProjects.reduce((sum, project) => sum + project.permitBlockers, 0),
    executionRiskProjects: activeProjects.filter(
      (project) =>
        project.latestDailyLogStatus === "flagged" ||
        project.subcontractHealth === "critical" ||
        project.qualityReleaseReadiness < 75
    ).length
  };
}

function pickFocusProject(projects: ProjectPortfolioItemContract[]) {
  const activeProjects = projects.filter((project) => ["active", "at_risk", "blocked"].includes(project.status));
  return (
    activeProjects
      .slice()
      .sort((left, right) => {
        if (left.latestDailyLogStatus === "flagged" && right.latestDailyLogStatus !== "flagged") {
          return -1;
        }

        if (left.latestDailyLogStatus !== "flagged" && right.latestDailyLogStatus === "flagged") {
          return 1;
        }

        if (left.status === "at_risk" && right.status !== "at_risk") {
          return -1;
        }

        if (left.status !== "at_risk" && right.status === "at_risk") {
          return 1;
        }

        return right.scheduleVarianceDays - left.scheduleVarianceDays;
      })[0] ?? null
  );
}

type ProjectEquipmentBridge = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
} | null;

function buildProjectEquipmentStory(project: ProjectPortfolioItemContract | null, bridge: ProjectEquipmentBridge) {
  if (!project) {
    return null;
  }

  const linkedMachines = bridge?.equipment.machines.filter((item) => item.projectName === project.name) ?? [];
  const constrainedMachines = linkedMachines.filter((item) => item.status !== "available" || item.health !== "healthy");

  return {
    equipmentCoverage:
      linkedMachines.length > 0
        ? `${linkedMachines.length} tracked machines are mapped to this project, with ${constrainedMachines.length} already under constraint.`
        : "No tracked equipment is currently mapped to this project.",
    fieldExecution:
      constrainedMachines.length > 0
        ? `${constrainedMachines[0]?.machineName ?? "A critical machine"} is already affecting field continuity in ${constrainedMachines[0]?.frontName ?? "an active front"}.`
        : "Equipment posture is not currently the leading execution constraint on this project.",
    dispatchSignal:
      constrainedMachines.length > 0
        ? constrainedMachines[0]?.nextAction ?? "Recover constrained machine availability before the next production cycle."
        : "Dispatch posture remains stable across mapped equipment."
  };
}

function validateProjectCreateForm(input: {
  code: string;
  name: string;
  client: string;
  segment: string;
  stage: string;
  progress: number;
  scheduleVarianceDays: number;
  qualityHolds: number;
  permitBlockers: number;
  activeFronts: number;
  nextMilestone: string;
  status: ProjectPortfolioItemContract["status"];
}) {
  if ([input.code, input.name, input.client, input.segment, input.stage].some((value) => value.trim().length < 3)) {
    return "Code, name, client, segment and stage must be specific before creating a project.";
  }

  if (!/^[A-Z0-9-]+$/.test(input.code.trim().toUpperCase())) {
    return "Project code must use uppercase letters, numbers or dashes.";
  }

  if (input.nextMilestone.trim().length < 8) {
    return "Next milestone must be more specific before creating a project.";
  }

  if (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 100) {
    return "Progress must stay between 0% and 100%.";
  }

  if (!Number.isFinite(input.scheduleVarianceDays)) {
    return "Schedule variance must be a valid number.";
  }

  if ([input.qualityHolds, input.permitBlockers, input.activeFronts].some((value) => !Number.isFinite(value) || value < 0)) {
    return "Quality holds, permit blockers and active fronts must be zero or greater.";
  }

  if (input.status === "active" && input.permitBlockers > 2) {
    return "Active status is blocked while permit blockers stay above 2.";
  }

  if (input.status === "closed" && (input.progress < 100 || input.qualityHolds > 0 || input.permitBlockers > 0)) {
    return "Closed status requires 100% progress with zero quality holds and zero permit blockers.";
  }

  return null;
}

export default function ProjectsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ProjectPortfolioOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<ProjectEquipmentBridge>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [nextMilestoneDraft, setNextMilestoneDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    client: "",
    segment: "Residential",
    status: "planning" as ProjectPortfolioItemContract["status"],
    stage: "Preconstruction",
    progress: "0",
    scheduleVarianceDays: "0",
    budgetHealth: "on_track" as ProjectPortfolioItemContract["budgetHealth"],
    qualityHolds: "0",
    permitBlockers: "0",
    activeFronts: "1",
    nextMilestone: ""
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
      fetchProjectsOverview(activeCompany.id, {
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
          setError("Projects portfolio is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedProjectId((current) => current ?? result.focusProject?.id ?? result.projects[0]?.id ?? null);
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

  const selectedProject = useMemo(
    () => overview?.projects.find((project) => project.id === selectedProjectId) ?? overview?.focusProject ?? null,
    [overview, selectedProjectId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.projectId === selectedProject?.id) ?? [],
    [overview, selectedProject]
  );

  const selectedStory = useMemo(
    () => buildProjectEquipmentStory(selectedProject, bridgeContext),
    [bridgeContext, selectedProject]
  );

  const actionOptions = useMemo(() => (selectedProject ? projectActionOptions(selectedProject) : []), [selectedProject]);

  useEffect(() => {
    setNextMilestoneDraft(selectedProject?.nextMilestone ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedProjectId, selectedProject?.id, selectedProject?.nextMilestone]);

  async function handleProjectAction(
    status: ProjectPortfolioItemContract["status"],
    suggestedMilestone: string
  ) {
    if (!selectedProject || !session.accessToken) {
      return;
    }

    const nextMilestone = nextMilestoneDraft.trim() || suggestedMilestone;
    if (nextMilestone.length < 8) {
      setActionError("Next milestone must be more specific before updating the project.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateProjectPortfolioItem(
      selectedProject.id,
      activeCompany.id,
      {
        status,
        nextMilestone
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Project update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const projects = current.projects.map((project) => (project.id === response.data?.id ? response.data : project));

      return {
        ...current,
        summary: recomputeSummary(projects),
        projects,
        focusProject: pickFocusProject(projects)
      };
    });

    setNextMilestoneDraft(response.data.nextMilestone);
    setActionMessage(`Project moved to ${response.data.status}.`);
    setIsSaving(false);
  }

  async function handleCreateProject() {
    if (!overview || !session.accessToken) {
      return;
    }

    const payload = {
      code: createForm.code.trim().toUpperCase(),
      name: createForm.name.trim(),
      client: createForm.client.trim(),
      segment: createForm.segment.trim(),
      status: createForm.status,
      stage: createForm.stage.trim(),
      progress: Number(createForm.progress),
      scheduleVarianceDays: Number(createForm.scheduleVarianceDays),
      budgetHealth: createForm.budgetHealth,
      qualityHolds: Number(createForm.qualityHolds),
      permitBlockers: Number(createForm.permitBlockers),
      activeFronts: Number(createForm.activeFronts),
      nextMilestone: createForm.nextMilestone.trim()
    };

    const validation = validateProjectCreateForm(payload);
    if (validation) {
      setActionError(validation);
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createProjectPortfolioItem(activeCompany.id, payload, {
      apiBaseUrl,
      accessToken: session.accessToken
    });

    if (!response.data) {
      setActionError(response.error?.message ?? "Project creation failed.");
      setIsCreating(false);
      return;
    }

    const createdProject = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const projects = [createdProject, ...current.projects];
      return {
        ...current,
        summary: recomputeSummary(projects),
        projects,
        focusProject: pickFocusProject(projects)
      };
    });

    setSelectedProjectId(createdProject.id);
    setNextMilestoneDraft(createdProject.nextMilestone);
    setCreateMessage(`${createdProject.code} added to the active portfolio.`);
    setCreateForm({
      code: "",
      name: "",
      client: payload.client,
      segment: payload.segment,
      status: "planning",
      stage: payload.stage,
      progress: "0",
      scheduleVarianceDays: "0",
      budgetHealth: "on_track",
      qualityHolds: "0",
      permitBlockers: "0",
      activeFronts: "1",
      nextMilestone: ""
    });
    setIsCreating(false);
  }

  return (
    <AppShell
      title="Projects and site control"
      eyebrow="Execution domain"
      description="Real portfolio visibility for construction progress, blockers, quality pressure and milestone readiness."
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Projects">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Active fronts"
                value={String(overview.summary.activeProjects)}
                footnote="Live portfolio count scoped to the active tenant."
              />
              <KpiCard
                label="Average progress"
                value={`${overview.summary.averageProgress}%`}
                footnote="Average physical progress across active execution work."
              />
              <KpiCard
                label="Quality holds"
                value={String(overview.summary.qualityHolds)}
                footnote="Open quality pressure points that still affect flow."
                badge={{ label: "field control", tone: "warning" }}
              />
              <KpiCard
                label="Permit blockers"
                value={String(overview.summary.permitBlockers)}
                footnote="Critical blockers tied to permits, release or supervision."
                badge={{ label: "watchlist", tone: overview.summary.permitBlockers > 0 ? "danger" : "success" }}
              />
              <KpiCard
                label="Execution risk"
                value={String(overview.summary.executionRiskProjects)}
                footnote="Projects where field log, quality or subcontract posture already signal execution risk."
              />
            </section>

            <section className="grid cols3">
              <Card title="Equipment coverage" description="How much real field equipment is mapped to the selected project.">
                <p className="sectionText">
                  {selectedStory?.equipmentCoverage ?? "Choose a project to inspect equipment coverage."}
                </p>
              </Card>
              <Card title="Field execution impact" description="What equipment posture means for the active production sequence.">
                <p className="sectionText">
                  {selectedStory?.fieldExecution ?? "Choose a project to inspect equipment impact."}
                </p>
              </Card>
              <Card title="Dispatch signal" description="Immediate equipment-driven action required for the selected project.">
                <p className="sectionText">
                  {selectedStory?.dispatchSignal ?? "Choose a project to inspect dispatch signal."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Project portfolio" description="Execution snapshot for PMO, supervision and directors.">
                <FilterBar summary={`${overview.projects.length} projects in the tenant portfolio`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "portfolio ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.projects}
                  columns={[
                    {
                      key: "project",
                      label: "Project",
                      render: (project) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedProjectId(project.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{project.name}</strong>
                            <span className="tableCellMuted">{project.code} · {project.segment}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (project) => <Badge tone={statusTone(project.status)}>{project.status}</Badge>
                    },
                    {
                      key: "progress",
                      label: "Progress",
                      render: (project) => (
                        <div className="tableCellStack">
                          <strong>{project.progress}%</strong>
                          <span className="tableCellMuted">{project.stage}</span>
                        </div>
                      )
                    },
                    {
                      key: "variance",
                      label: "Schedule variance",
                      render: (project) => (
                        <div className="tableCellStack">
                          <strong>{project.scheduleVarianceDays.toFixed(1)} days</strong>
                          <span className="tableCellMuted">{project.nextMilestone}</span>
                        </div>
                      )
                    },
                    {
                      key: "budget",
                      label: "Budget",
                      render: (project) => <Badge tone={budgetTone(project.budgetHealth)}>{project.budgetHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected project"
                description="Focused project context for the active selection."
                aside={selectedProject ? <Badge tone={statusTone(selectedProject.status)}>{selectedProject.status}</Badge> : null}
              >
                {selectedProject ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Client</div>
                      <div>{selectedProject.client}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Active fronts</div>
                      <div>{selectedProject.activeFronts}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Quality holds</div>
                      <div>{selectedProject.qualityHolds}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Permit blockers</div>
                      <div>{selectedProject.permitBlockers}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Latest daily log</div>
                      <div>
                        <Badge tone={selectedProject.latestDailyLogStatus === "flagged" ? "danger" : selectedProject.latestDailyLogStatus === "submitted" ? "info" : selectedProject.latestDailyLogStatus === "approved" ? "success" : "warning"}>
                          {selectedProject.latestDailyLogStatus}
                        </Badge>
                        <div className="tableCellMuted">{selectedProject.latestDailyLogDate ?? "No log linked yet"}</div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Quality / subcontract</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">release readiness {selectedProject.qualityReleaseReadiness}%</span>
                        <span className="tableCellMuted">
                          subcontract {selectedProject.subcontractHealth} · pending destajo MXN {selectedProject.pendingDestajo.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        <Link className="buttonGhost" href="/field">
                          Open field
                        </Link>
                        <Link className="buttonGhost" href="/quality">
                          Open quality
                        </Link>
                        <Link className="buttonGhost" href="/cost-control">
                          Open cost control
                        </Link>
                        <Link className="buttonGhost" href="/equipment">
                          Open equipment
                        </Link>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next milestone</div>
                      <div>
                        <input
                          className="field"
                          value={nextMilestoneDraft}
                          onChange={(event) => setNextMilestoneDraft(event.target.value)}
                          placeholder="Describe the next delivery, permit or site milestone"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedProject.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Active status is blocked when permit blockers are greater than 2.</span>
                        <span className="tableCellMuted">Closed status requires zero quality holds and zero permit blockers.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.status === "blocked" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.status === "active" && selectedProject.permitBlockers > 2) ||
                                (option.status === "active" && selectedProject.latestDailyLogStatus === "flagged") ||
                                (option.status === "closed" &&
                                  (selectedProject.qualityHolds > 0 ||
                                    selectedProject.permitBlockers > 0 ||
                                    selectedProject.progress < 100 ||
                                    selectedProject.latestDailyLogStatus === "flagged"))
                              }
                              onClick={() => void handleProjectAction(option.status, option.nextMilestone)}
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
                    title="No project selected"
                    description="Choose a row from the portfolio to inspect detail and constraints."
                    primaryAction={{ label: "Stay on projects", href: "/projects" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Risk and blocker watchlist" description="Construction risks with ownership and current action state.">
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                columns={[
                  {
                    key: "risk",
                    label: "Risk",
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

            <section className="grid cols2">
              <Card title="Register project" description="Create a new project directly in the tenant portfolio and start tracking it immediately.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Code</div><input className="field" value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="ARB-NVO-03" /></label>
                  <label className="detailRow"><div className="detailLabel">Project name</div><input className="field" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Conjunto Residencial Norte" /></label>
                  <label className="detailRow"><div className="detailLabel">Client</div><input className="field" value={createForm.client} onChange={(event) => setCreateForm((current) => ({ ...current, client: event.target.value }))} placeholder="Desarrolladora Norte" /></label>
                  <label className="detailRow"><div className="detailLabel">Segment</div><input className="field" value={createForm.segment} onChange={(event) => setCreateForm((current) => ({ ...current, segment: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Status</div><select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ProjectPortfolioItemContract["status"] }))}><option value="planning">planning</option><option value="active">active</option><option value="at_risk">at_risk</option><option value="blocked">blocked</option><option value="closed">closed</option></select></label>
                  <label className="detailRow"><div className="detailLabel">Stage</div><input className="field" value={createForm.stage} onChange={(event) => setCreateForm((current) => ({ ...current, stage: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Progress %</div><input className="field" type="number" min="0" max="100" value={createForm.progress} onChange={(event) => setCreateForm((current) => ({ ...current, progress: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Variance days</div><input className="field" type="number" step="0.1" value={createForm.scheduleVarianceDays} onChange={(event) => setCreateForm((current) => ({ ...current, scheduleVarianceDays: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Budget health</div><select className="selectField" value={createForm.budgetHealth} onChange={(event) => setCreateForm((current) => ({ ...current, budgetHealth: event.target.value as ProjectPortfolioItemContract["budgetHealth"] }))}><option value="on_track">on_track</option><option value="warning">warning</option><option value="critical">critical</option></select></label>
                  <label className="detailRow"><div className="detailLabel">Quality holds</div><input className="field" type="number" min="0" value={createForm.qualityHolds} onChange={(event) => setCreateForm((current) => ({ ...current, qualityHolds: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Permit blockers</div><input className="field" type="number" min="0" value={createForm.permitBlockers} onChange={(event) => setCreateForm((current) => ({ ...current, permitBlockers: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Active fronts</div><input className="field" type="number" min="0" value={createForm.activeFronts} onChange={(event) => setCreateForm((current) => ({ ...current, activeFronts: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next milestone</div><input className="field" value={createForm.nextMilestone} onChange={(event) => setCreateForm((current) => ({ ...current, nextMilestone: event.target.value }))} placeholder="Municipal permit release and first front mobilization" /></label>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateProject()}>
                    {isCreating ? "Creating..." : "Add project"}
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Project creation rules" description="The portfolio intake now persists directly to the backend and enforces the same operational constraints.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Unique code</div><div>Project codes stay unique per tenant to avoid duplicate portfolio tracking.</div></div>
                  <div className="detailRow"><div className="detailLabel">Active gate</div><div>Projects cannot start as `active` when permit blockers are above 2.</div></div>
                  <div className="detailRow"><div className="detailLabel">Closed gate</div><div>`closed` requires 100% progress, zero quality holds and zero permit blockers.</div></div>
                  <div className="detailRow"><div className="detailLabel">Operational continuity</div><div>The created project becomes selectable immediately for field, quality and equipment flows.</div></div>
                </div>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="Projects portfolio unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading projects portfolio" : "Projects portfolio not loaded yet"}
            description="This route now expects a live backend portfolio response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
