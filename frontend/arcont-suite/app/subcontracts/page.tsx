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
import type { SubcontractLineContract, SubcontractOverviewContract } from "@/lib/contracts";
import { fetchSubcontractOverview, updateSubcontractLine } from "@/lib/platform-api";

function healthTone(status: SubcontractLineContract["subcontractHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function projectTone(status: SubcontractLineContract["projectStatus"]) {
  switch (status) {
    case "active":
      return "success";
    case "at_risk":
      return "warning";
    case "blocked":
      return "danger";
    case "closed":
      return "info";
    case "planning":
      return "gold";
    default:
      return "neutral";
  }
}

function actionOptions(line: SubcontractLineContract) {
  switch (line.subcontractHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          subcontractHealth: "watch" as const,
          nextAction: "Contain destajo backlog and stabilize the subcontractor crew before normalizing"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          subcontractHealth: "critical" as const,
          nextAction: "Escalate unresolved attendance, compliance or destajo pressure to operations review"
        },
        {
          label: "Mark controlled",
          subcontractHealth: "controlled" as const,
          nextAction: "Destajo backlog is within tolerance and field issues are fully contained"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          subcontractHealth: "watch" as const,
          nextAction: "Start monitoring subcontract drift before productivity drops further"
        }
      ];
  }
}

export default function SubcontractsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<SubcontractOverviewContract | null>(null);
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

    void fetchSubcontractOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Subcontracts overview is unavailable right now.");
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

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleAction(
    subcontractHealth: SubcontractLineContract["subcontractHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the subcontract.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateSubcontractLine(
      selectedLine.id,
      activeCompany.id,
      {
        subcontractHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Subcontract update failed.");
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
        summary: {
          activeSubcontracts: lines.length,
          contractedAmount: lines.reduce((sum, item) => sum + item.contractAmount, 0),
          earnedAmount: lines.reduce((sum, item) => sum + item.earnedAmount, 0),
          paidAmount: lines.reduce((sum, item) => sum + item.paidAmount, 0),
          pendingDestajo: lines.reduce((sum, item) => sum + item.pendingDestajo, 0),
          criticalSubcontracts: lines.filter((item) => item.subcontractHealth === "critical").length
        },
        lines,
        focusLine:
          lines
            .slice()
            .sort((left, right) => {
              if (left.subcontractHealth === "critical" && right.subcontractHealth !== "critical") {
                return -1;
              }

              if (left.subcontractHealth !== "critical" && right.subcontractHealth === "critical") {
                return 1;
              }

              return right.pendingDestajo - left.pendingDestajo;
            })[0] ?? null
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Subcontract moved to ${response.data.subcontractHealth}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Subcontracts and destajo"
      eyebrow="Workforce execution"
      description="Contractor advance, destajo backlog and field readiness connected to active fronts."
    >
      <ModuleGate moduleKeys={["hr.workforce"]} requiredPermissions={["hr:*"]} title="Subcontracts">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Active subcontracts"
                value={String(overview.summary.activeSubcontracts)}
                footnote="Contractor fronts currently tracked in live execution."
              />
              <KpiCard
                label="Contracted"
                value={`MXN ${overview.summary.contractedAmount.toLocaleString()}`}
                footnote="Baseline value currently under contractor execution."
              />
              <KpiCard
                label="Earned"
                value={`MXN ${overview.summary.earnedAmount.toLocaleString()}`}
                footnote="Earned value implied by field advance and current productivity."
              />
              <KpiCard
                label="Pending destajo"
                value={`MXN ${overview.summary.pendingDestajo.toLocaleString()}`}
                footnote="Value still pending to settle between invoiced and paid progress."
              />
            </section>

            <section className="grid cols2">
              <Card title="Subcontract board" description="Destajo, progress and contractor operating posture across active fronts.">
                <FilterBar summary={`${overview.lines.length} subcontract lines in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "subcontracts ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.lines}
                  columns={[
                    {
                      key: "contractor",
                      label: "Contractor",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.contractorName}</strong>
                            <span className="tableCellMuted">{row.frontName} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "progress",
                      label: "Advance",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.progressPercent}% site progress</strong>
                          <span className="tableCellMuted">{row.productivityRate}% productivity</span>
                        </div>
                      )
                    },
                    {
                      key: "destajo",
                      label: "Destajo",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.pendingDestajo.toLocaleString()}</strong>
                          <span className="tableCellMuted">paid MXN {row.paidAmount.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.subcontractHealth)}>{row.subcontractHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected subcontract"
                description="Field posture, contract economics and next subcontractor action."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.subcontractHealth)}>{selectedLine.subcontractHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div className="tagRow">
                        <span>{selectedLine.projectName}</span>
                        <Badge tone={projectTone(selectedLine.projectStatus)}>
                          {selectedLine.projectStatus ?? "unassigned"}
                        </Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Headcount</div>
                      <div>{selectedLine.activeHeadcount} people</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Attendance</div>
                      <div>{selectedLine.attendanceRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Compliance expirations</div>
                      <div>{selectedLine.complianceExpirations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Incidents</div>
                      <div>{selectedLine.incidentCount}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Progress gap</div>
                      <div>{selectedLine.progressGap}% against contractor productivity</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Retention</div>
                      <div>MXN {selectedLine.retentionAmount.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next subcontractor, destajo or compliance action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Controlled is blocked while pending destajo remains high.</span>
                        <span className="tableCellMuted">Controlled is blocked while expirations or incidents remain open.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          <button
                            className="button"
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleAction(selectedLine.subcontractHealth, selectedLine.nextAction)}
                          >
                            {isSaving ? "Saving..." : "Save next action"}
                          </button>
                          {lineActions.map((option) => (
                            <button
                              key={option.label}
                              className={option.subcontractHealth === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleAction(option.subcontractHealth, option.nextAction)}
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
                    title="No subcontract selected"
                    description="Choose a subcontract line to inspect progress, destajo and contractor posture."
                    primaryAction={{ label: "Stay on subcontracts", href: "/subcontracts" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Subcontract risks" description="Capacity, compliance and payment blockers affecting contractor continuity.">
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
            title="Subcontracts overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading subcontracts overview" : "Subcontracts overview not loaded yet"}
            description="This route expects a live backend subcontract response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
