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
import type { ProjectPortfolioItemContract, ProjectPortfolioOverviewContract } from "@/lib/contracts";
import { fetchProjectsOverview, updateProjectPortfolioItem } from "@/lib/platform-api";

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

export default function ProjectsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ProjectPortfolioOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [nextMilestoneDraft, setNextMilestoneDraft] = useState("");
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

    void fetchProjectsOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Projects portfolio is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedProjectId((current) => current ?? result.focusProject?.id ?? result.projects[0]?.id ?? null);
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
      const activeProjects = projects.filter((project) => ["active", "at_risk", "blocked"].includes(project.status));
      const averageProgress =
        activeProjects.length > 0 ? Number((activeProjects.reduce((sum, project) => sum + project.progress, 0) / activeProjects.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          activeProjects: activeProjects.length,
          averageProgress,
          qualityHolds: activeProjects.reduce((sum, project) => sum + project.qualityHolds, 0),
          permitBlockers: activeProjects.reduce((sum, project) => sum + project.permitBlockers, 0)
        },
        projects,
        focusProject: current.focusProject?.id === response.data?.id ? response.data : current.focusProject
      };
    });

    setNextMilestoneDraft(response.data.nextMilestone);
    setActionMessage(`Project moved to ${response.data.status}.`);
    setIsSaving(false);
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
                              disabled={isSaving}
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
