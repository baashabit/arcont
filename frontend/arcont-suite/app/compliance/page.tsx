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
import type { ComplianceCaseContract, ComplianceOverviewContract } from "@/lib/contracts";
import { fetchComplianceOverview } from "@/lib/platform-api";

function healthTone(health: ComplianceCaseContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function CompliancePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ComplianceOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchComplianceOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Compliance overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedCaseId((current) => current ?? result.focusCase?.id ?? result.cases[0]?.id ?? null);
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

  const selectedCase = useMemo(
    () => overview?.cases.find((item) => item.id === selectedCaseId) ?? overview?.focusCase ?? null,
    [overview, selectedCaseId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.caseId === selectedCase?.id) ?? [],
    [overview, selectedCase]
  );

  return (
    <AppShell
      title="Compliance and post-sale"
      eyebrow="Customer continuity"
      description="Legal, handover and warranty pressure in one live queue for document-heavy construction operations."
    >
      <ModuleGate
        moduleKeys={["compliance.postsale"]}
        requiredPermissions={["compliance:*", "postsale:*"]}
        title="Compliance"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Active cases"
                value={String(overview.summary.activeCases)}
                footnote="Open legal, handover and warranty items currently under management."
              />
              <KpiCard
                label="At-risk cases"
                value={String(overview.summary.atRiskCases)}
                footnote="Cases under document, SLA or approval pressure."
              />
              <KpiCard
                label="Document completion"
                value={`${overview.summary.averageDocumentCompletion}%`}
                footnote="Average completion across active folders, contracts and handover packs."
              />
              <KpiCard
                label="Open findings"
                value={String(overview.summary.openFindings)}
                footnote="Outstanding issues still affecting closure readiness and compliance health."
              />
            </section>

            <section className="grid cols2">
              <Card title="Compliance board" description="Live legal, post-sale and handover queues tied to the active tenant.">
                <FilterBar summary={`${overview.cases.length} compliance queues in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "compliance ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.cases}
                  columns={[
                    {
                      key: "queue",
                      label: "Queue",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedCaseId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.subject}</strong>
                            <span className="tableCellMuted">{row.queueName} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "object",
                      label: "Object",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.unitOrContract}</strong>
                          <span className="tableCellMuted">{row.owner}</span>
                        </div>
                      )
                    },
                    {
                      key: "completion",
                      label: "Readiness",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.documentCompletion}% docs</strong>
                          <span className="tableCellMuted">{row.openFindings} findings</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.health)}>{row.health}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected case"
                description="Focused context for the active contract, unit, handover or warranty case."
                aside={selectedCase ? <Badge tone={healthTone(selectedCase.health)}>{selectedCase.health}</Badge> : null}
              >
                {selectedCase ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Owner</div>
                      <div>{selectedCase.owner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedCase.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">SLA remaining</div>
                      <div>{selectedCase.slaHoursRemaining} hours</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Document completion</div>
                      <div>{selectedCase.documentCompletion}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>{selectedCase.nextAction}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedCase.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No compliance case selected"
                    description="Choose a case from the board to inspect legal, handover or post-sale detail."
                    primaryAction={{ label: "Stay on compliance", href: "/compliance" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Compliance risks and blockers" description="Document, contract and post-sale issues impacting closure and governance.">
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
            title="Compliance overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading compliance overview" : "Compliance overview not loaded yet"}
            description="This route now expects a live backend compliance response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
