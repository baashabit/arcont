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
import {
  fetchComplianceOverview,
  fetchDocumentControlOverview,
  fetchFinanceOverview,
  fetchHrOverview,
  fetchIntegrationOverview,
  fetchInventoryOverview,
  fetchProcurementOverview,
  fetchProjectsOverview
} from "@/lib/platform-api";

type BlackboardTask = {
  id: string;
  lane: "new" | "in_progress" | "risk" | "closed";
  title: string;
  detail: string;
  owner: string;
  dueLabel: string;
  domain: string;
  severity: "info" | "warning" | "critical";
};

function severityTone(severity: BlackboardTask["severity"]) {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

function laneLabel(lane: BlackboardTask["lane"]) {
  switch (lane) {
    case "new":
      return "New";
    case "in_progress":
      return "In progress";
    case "risk":
      return "Risk";
    default:
      return "Closed";
  }
}

function deriveLaneFromSignal(input: {
  severity: BlackboardTask["severity"];
  isClosed?: boolean;
  hours?: number;
}) {
  if (input.isClosed) {
    return "closed" as const;
  }

  if (input.severity === "critical" || (typeof input.hours === "number" && input.hours < 0)) {
    return "risk" as const;
  }

  if (typeof input.hours === "number" && input.hours <= 24) {
    return "new" as const;
  }

  return "in_progress" as const;
}

export default function OperationsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [tasks, setTasks] = useState<BlackboardTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setTasks([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.allSettled([
      fetchProjectsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchProcurementOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFinanceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchHrOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchComplianceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchIntegrationOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then((results) => {
        if (cancelled) {
          return;
        }

        const [
          projectsResult,
          procurementResult,
          inventoryResult,
          financeResult,
          hrResult,
          complianceResult,
          integrationsResult,
          documentControlResult
        ] = results;

        const nextTasks: BlackboardTask[] = [];

        if (projectsResult.status === "fulfilled" && projectsResult.value) {
          for (const risk of projectsResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · project control`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Projects",
              severity: risk.severity
            });
          }
        }

        if (procurementResult.status === "fulfilled" && procurementResult.value) {
          for (const risk of procurementResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · sourcing`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Procurement",
              severity: risk.severity
            });
          }
        }

        if (inventoryResult.status === "fulfilled" && inventoryResult.value) {
          for (const risk of inventoryResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · supply`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Inventory",
              severity: risk.severity
            });
          }
        }

        if (financeResult.status === "fulfilled" && financeResult.value) {
          for (const risk of financeResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · finance`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Finance",
              severity: risk.severity
            });
          }
        }

        if (hrResult.status === "fulfilled" && hrResult.value) {
          for (const risk of hrResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · workforce`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "HR",
              severity: risk.severity
            });
          }
        }

        if (complianceResult.status === "fulfilled" && complianceResult.value) {
          for (const item of complianceResult.value.cases.slice(0, 2)) {
            nextTasks.push({
              id: item.id,
              lane: deriveLaneFromSignal({
                severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info",
                hours: item.slaHoursRemaining
              }),
              title: item.subject,
              detail: `${item.queueName} · ${item.unitOrContract}`,
              owner: item.owner,
              dueLabel: `${item.slaHoursRemaining}h`,
              domain: "Compliance",
              severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info"
            });
          }
        }

        if (integrationsResult.status === "fulfilled" && integrationsResult.value) {
          for (const risk of integrationsResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · connected ops`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Integrations",
              severity: risk.severity
            });
          }
        }

        if (documentControlResult.status === "fulfilled" && documentControlResult.value) {
          for (const item of documentControlResult.value.items.slice(0, 2)) {
            nextTasks.push({
              id: item.id,
              lane: deriveLaneFromSignal({
                severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info"
              }),
              title: item.subject,
              detail: `${item.documentType} · ${item.projectName}`,
              owner: item.owner,
              dueLabel: `${item.turnaroundDays} d`,
              domain: "Document control",
              severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info"
            });
          }
        }

        if (nextTasks.length === 0) {
          setError("Operations blackboard did not receive live signals.");
          return;
        }

        setTasks(nextTasks);
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

  const lanes = useMemo(
    () => ({
      new: tasks.filter((task) => task.lane === "new"),
      in_progress: tasks.filter((task) => task.lane === "in_progress"),
      risk: tasks.filter((task) => task.lane === "risk"),
      closed: tasks.filter((task) => task.lane === "closed")
    }),
    [tasks]
  );

  const summary = useMemo(() => {
    const openTasks = tasks.filter((task) => task.lane !== "closed");
    const dueSoon = tasks.filter((task) => task.lane === "new" || task.lane === "risk");
    const criticalResolved = tasks.filter((task) => task.lane === "closed" && task.severity === "critical").length;
    const complianceRate = tasks.length > 0 ? Math.round(((tasks.length - lanes.risk.length) / tasks.length) * 100) : 0;

    return {
      openTasks: openTasks.length,
      dueSoon: dueSoon.length,
      complianceRate,
      criticalResolved
    };
  }, [lanes.risk.length, tasks]);

  return (
    <AppShell
      title="Operations blackboard"
      eyebrow="Cross-domain coordination"
      description="A single live view of what is blocked, what is aging and who owns the next move across the operating stack."
      actions={
        <Badge tone={session.authenticated ? "success" : "warning"}>
          {isLoading ? "refreshing" : session.authenticated ? "live backend" : source}
        </Badge>
      }
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Operations">
        {tasks.length > 0 ? (
          <>
            <section className="heroPanel">
              <div>
                <h2>One board for execution pressure, ownership and weekly commitments.</h2>
                <p>
                  Instead of jumping between modules, the team can now see the cross-domain backlog, owners,
                  compliance pressure and immediate blockers in a single live cockpit.
                </p>
                <div className="heroMetrics">
                  <div className="heroMetric">
                    <strong>{summary.openTasks}</strong>
                    <span>Open signals still requiring action</span>
                  </div>
                  <div className="heroMetric">
                    <strong>{summary.dueSoon}</strong>
                    <span>Signals demanding immediate follow-up</span>
                  </div>
                  <div className="heroMetric">
                    <strong>{summary.complianceRate}%</strong>
                    <span>Rolling operating compliance across the current board</span>
                  </div>
                </div>
              </div>

              <Card
                title="Board posture"
                description="Cross-functional health built from the live module overviews already available in ARCONT."
                aside={<Badge tone="gold">{activeCompany.tradeName}</Badge>}
              >
                <div className="statStrip">
                  <div className="statTile">
                    <strong>{lanes.risk.length}</strong>
                    <span>Signals already in risk lane</span>
                  </div>
                  <div className="statTile">
                    <strong>{summary.criticalResolved}</strong>
                    <span>Critical signals already resolved</span>
                  </div>
                </div>
                <p className="sectionText">
                  This board now blends projects, procurement, finance, workforce, compliance, integrations and document control.
                </p>
              </Card>
            </section>

            <section className="grid cols4">
              <KpiCard
                label="Open tasks"
                value={String(summary.openTasks)}
                footnote="All live signals that still require action or follow-up."
              />
              <KpiCard
                label="Due this cycle"
                value={String(summary.dueSoon)}
                footnote="Signals concentrated in new or risk lanes."
              />
              <KpiCard
                label="Rolling compliance"
                value={`${summary.complianceRate}%`}
                footnote="Share of the current board not already in risk."
              />
              <KpiCard
                label="Risk lane"
                value={String(lanes.risk.length)}
                footnote="Signals already blocked, overdue or critical."
              />
            </section>

            <section className="grid cols2">
              <Card title="Operational board" description="Live cross-domain signals grouped by execution lane.">
                <div className="moduleGrid">
                  {(["new", "in_progress", "risk", "closed"] as const).map((lane) => (
                    <div className="moduleCard" key={lane}>
                      <div className="moduleMeta">
                        <div>
                          <h4>{laneLabel(lane)}</h4>
                          <p>{lanes[lane].length} signals in this lane.</p>
                        </div>
                        <Badge tone={lane === "risk" ? "danger" : lane === "closed" ? "success" : "info"}>
                          {lanes[lane].length}
                        </Badge>
                      </div>
                      <div className="list">
                        {lanes[lane].slice(0, 3).map((task) => (
                          <div className="listItem" key={task.id}>
                            <div>
                              <strong>{task.title}</strong>
                              <p>{task.detail}</p>
                            </div>
                            <Badge tone={severityTone(task.severity)}>{task.domain}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Signals by owner and domain" description="Focused table to decide who must move next and from which area.">
                <FilterBar summary={`${tasks.length} live cross-domain signals`}>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "board ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={tasks}
                  columns={[
                    {
                      key: "task",
                      label: "Signal",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.title}</strong>
                          <span className="tableCellMuted">{row.detail}</span>
                        </div>
                      )
                    },
                    {
                      key: "owner",
                      label: "Owner",
                      render: (row) => row.owner
                    },
                    {
                      key: "domain",
                      label: "Domain",
                      render: (row) => <Badge tone="neutral">{row.domain}</Badge>
                    },
                    {
                      key: "due",
                      label: "Next signal",
                      render: (row) => row.dueLabel
                    }
                  ]}
                />
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Execution indicators" description="Simple cross-domain quality metrics for the current board.">
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">At time</div>
                    <div>{summary.complianceRate}%</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Risk lane</div>
                    <div>{lanes.risk.length} signals</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Need reassignment</div>
                    <div>{tasks.filter((task) => task.severity !== "info").length}</div>
                  </div>
                </div>
              </Card>

              <Card title="Compliance alerts" description="Signals the operating team should prioritize first.">
                <div className="list">
                  {tasks
                    .filter((task) => task.severity !== "info")
                    .slice(0, 3)
                    .map((task) => (
                      <div className="listItem" key={task.id}>
                        <div>
                          <strong>{task.title}</strong>
                          <p>{task.owner}</p>
                        </div>
                        <Badge tone={severityTone(task.severity)}>{task.domain}</Badge>
                      </div>
                    ))}
                </div>
              </Card>

              <Card title="Why this matters" description="What improves versus keeping each signal buried in its own module.">
                <div className="tagRow">
                  <span className="tag">Priorities visible</span>
                  <span className="tag">Owners visible</span>
                  <span className="tag">Cross-domain focus</span>
                  <span className="tag">Less chasing</span>
                  <span className="tag">Weekly execution</span>
                </div>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="Operations blackboard unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading operations blackboard" : "Operations blackboard not loaded yet"}
            description="This route aggregates live signals from the other operating modules for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
