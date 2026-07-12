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
import { fetchProjectsOverview } from "@/lib/platform-api";

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

export default function ProjectsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ProjectPortfolioOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

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
                      <div>{selectedProject.nextMilestone}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedProject.updatedAt).toLocaleString()}</div>
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
