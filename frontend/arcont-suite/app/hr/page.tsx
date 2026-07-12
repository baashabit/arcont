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
import type { HrOverviewContract, HrWorkforceItemContract } from "@/lib/contracts";
import { fetchHrOverview } from "@/lib/platform-api";

function safetyTone(status: HrWorkforceItemContract["safetyStatus"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function HrPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<HrOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkforceId, setSelectedWorkforceId] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchHrOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("HR overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedWorkforceId((current) => current ?? result.focusWorkforce?.id ?? result.workforces[0]?.id ?? null);
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

  const selectedWorkforce = useMemo(
    () => overview?.workforces.find((item) => item.id === selectedWorkforceId) ?? overview?.focusWorkforce ?? null,
    [overview, selectedWorkforceId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.workforceId === selectedWorkforce?.id) ?? [],
    [overview, selectedWorkforce]
  );

  return (
    <AppShell
      title="HR and workforce"
      eyebrow="Workforce domain"
      description="Crew capacity, contractor readiness and field compliance signals for active construction fronts."
    >
      <ModuleGate moduleKeys={["hr.workforce"]} requiredPermissions={["hr:*"]} title="HR">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Active headcount"
                value={String(overview.summary.activeHeadcount)}
                footnote="People currently assigned across active contractors and fronts."
              />
              <KpiCard
                label="Active contractors"
                value={String(overview.summary.activeContractors)}
                footnote="Contractors currently represented in the active workforce board."
              />
              <KpiCard
                label="Attendance rate"
                value={`${overview.summary.attendanceRate}%`}
                footnote="Attendance signal aggregated from live contractor workforce buckets."
              />
              <KpiCard
                label="Open incidents"
                value={String(overview.summary.openIncidents)}
                footnote="Field issues affecting continuity, compliance or safety posture."
              />
            </section>

            <section className="grid cols2">
              <Card title="Workforce board" description="Live crew capacity, attendance and contractor operating posture.">
                <FilterBar summary={`${overview.workforces.length} workforce buckets in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "workforce ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.workforces}
                  columns={[
                    {
                      key: "contractor",
                      label: "Contractor",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedWorkforceId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.contractorName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.frontName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "capacity",
                      label: "Capacity",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.activeHeadcount} people</strong>
                          <span className="tableCellMuted">{row.attendanceRate}% attendance</span>
                        </div>
                      )
                    },
                    {
                      key: "field",
                      label: "Field signal",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.productivityRate}% productivity</strong>
                          <span className="tableCellMuted">{row.incidentCount} incidents</span>
                        </div>
                      )
                    },
                    {
                      key: "safety",
                      label: "Safety",
                      render: (row) => <Badge tone={safetyTone(row.safetyStatus)}>{row.safetyStatus}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected workforce bucket"
                description="Focused view of the contractor, front and field-control actions that need attention."
                aside={
                  selectedWorkforce ? (
                    <Badge tone={safetyTone(selectedWorkforce.safetyStatus)}>{selectedWorkforce.safetyStatus}</Badge>
                  ) : null
                }
              >
                {selectedWorkforce ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Front</div>
                      <div>{selectedWorkforce.frontName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Attendance</div>
                      <div>{selectedWorkforce.attendanceRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Productivity</div>
                      <div>{selectedWorkforce.productivityRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Compliance expirations</div>
                      <div>{selectedWorkforce.complianceExpirations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>{selectedWorkforce.nextAction}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedWorkforce.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No workforce bucket selected"
                    description="Choose a contractor or front to inspect workforce detail and field actions."
                    primaryAction={{ label: "Stay on HR", href: "/hr" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Workforce risks and blockers" description="Capacity, attendance and compliance issues that can slow active fronts.">
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
            title="HR overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading HR overview" : "HR overview not loaded yet"}
            description="This route now expects a live backend HR response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
