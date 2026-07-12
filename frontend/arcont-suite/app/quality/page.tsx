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
import type { QualityInspectionContract, QualityOverviewContract } from "@/lib/contracts";
import { fetchQualityOverview, updateQualityInspection } from "@/lib/platform-api";

function severityTone(severity: QualityInspectionContract["severity"]) {
  switch (severity) {
    case "critical":
      return "danger";
    case "major":
      return "warning";
    default:
      return "info";
  }
}

function qualityActionOptions(inspection: QualityInspectionContract) {
  switch (inspection.status) {
    case "blocked":
      return [
        {
          label: "Resume work",
          status: "in_progress" as const,
          nextAction: "Resume correction crew and capture fresh evidence from the field"
        },
        {
          label: "Move to release review",
          status: "pending_release" as const,
          nextAction: "Confirm remaining punch items and schedule release walkthrough"
        }
      ];
    case "in_progress":
      return [
        {
          label: "Send to release review",
          status: "pending_release" as const,
          nextAction: "Validate evidence package and prepare release walkthrough"
        },
        {
          label: "Block inspection",
          status: "blocked" as const,
          nextAction: "Escalate blocker and hold release until field correction is confirmed"
        }
      ];
    case "pending_release":
      return [
        {
          label: "Reopen correction",
          status: "in_progress" as const,
          nextAction: "Return punch list to field team and update closeout evidence"
        },
        {
          label: "Block release",
          status: "blocked" as const,
          nextAction: "Pause release and document the blocker before the next walkthrough"
        }
      ];
    case "scheduled":
      return [
        {
          label: "Start inspection",
          status: "in_progress" as const,
          nextAction: "Start the checklist in field and upload the first evidence batch"
        }
      ];
    default:
      return [];
  }
}

export default function QualityPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<QualityOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
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

    void fetchQualityOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Quality overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedInspectionId((current) => current ?? result.focusInspection?.id ?? result.inspectionsBoard[0]?.id ?? null);
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

  const selectedInspection = useMemo(
    () => overview?.inspectionsBoard.find((item) => item.id === selectedInspectionId) ?? overview?.focusInspection ?? null,
    [overview, selectedInspectionId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.inspectionId === selectedInspection?.id) ?? [],
    [overview, selectedInspection]
  );

  const actionOptions = useMemo(
    () => (selectedInspection ? qualityActionOptions(selectedInspection) : []),
    [selectedInspection]
  );

  useEffect(() => {
    setNextActionDraft(selectedInspection?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedInspectionId, selectedInspection?.id, selectedInspection?.nextAction]);

  async function handleInspectionAction(status: QualityInspectionContract["status"], suggestedNextAction: string) {
    if (!selectedInspection || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the inspection.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateQualityInspection(
      selectedInspection.id,
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
      setActionError(response.error?.message ?? "Inspection update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const inspectionsBoard = current.inspectionsBoard.map((inspection) =>
        inspection.id === response.data?.id ? response.data : inspection
      );
      const openFindings = inspectionsBoard.reduce((sum, inspection) => sum + inspection.openFindings, 0);
      const releaseReadiness =
        inspectionsBoard.length > 0
          ? Number(
              (inspectionsBoard.reduce((sum, inspection) => sum + inspection.releaseReadiness, 0) / inspectionsBoard.length).toFixed(1)
            )
          : 0;
      const averageReworkRate =
        inspectionsBoard.length > 0
          ? Number((inspectionsBoard.reduce((sum, inspection) => sum + inspection.reworkRate, 0) / inspectionsBoard.length).toFixed(1))
          : 0;

      return {
        ...current,
        summary: {
          inspections: inspectionsBoard.length,
          openFindings,
          releaseReadiness,
          averageReworkRate
        },
        inspectionsBoard,
        focusInspection: current.focusInspection?.id === response.data?.id ? response.data : current.focusInspection
      };
    });
    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Inspection moved to ${response.data.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Quality and inspections"
      eyebrow="Field quality"
      description="Inspections, punch list, evidence and release readiness tied to live field execution."
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Quality">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Inspections"
                value={String(overview.summary.inspections)}
                footnote="Current inspection workload visible for the active tenant."
              />
              <KpiCard
                label="Open findings"
                value={String(overview.summary.openFindings)}
                footnote="Findings still affecting release or reinspection."
              />
              <KpiCard
                label="Release readiness"
                value={`${overview.summary.releaseReadiness}%`}
                footnote="Average release posture across current quality checks."
              />
              <KpiCard
                label="Rework"
                value={`${overview.summary.averageReworkRate}%`}
                footnote="Average rework rate across the current inspection board."
              />
            </section>

            <section className="grid cols2">
              <Card title="Inspection board" description="Live inspection, punch list and non-conformance signals.">
                <FilterBar summary={`${overview.inspectionsBoard.length} quality inspections in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "quality ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.inspectionsBoard}
                  columns={[
                    {
                      key: "inspection",
                      label: "Inspection",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedInspectionId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.areaName}</strong>
                            <span className="tableCellMuted">{row.checklistName} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "contractor",
                      label: "Contractor",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.contractorName}</strong>
                          <span className="tableCellMuted">{row.openFindings} findings</span>
                        </div>
                      )
                    },
                    {
                      key: "release",
                      label: "Release",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.releaseReadiness}%</strong>
                          <span className="tableCellMuted">{row.evidenceCompletion}% evidence</span>
                        </div>
                      )
                    },
                    {
                      key: "severity",
                      label: "Severity",
                      render: (row) => <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected inspection"
                description="Focused view of the active quality issue, evidence and release actions."
                aside={
                  selectedInspection ? <Badge tone={severityTone(selectedInspection.severity)}>{selectedInspection.severity}</Badge> : null
                }
              >
                {selectedInspection ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Checklist</div>
                      <div>{selectedInspection.checklistName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedInspection.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Evidence</div>
                      <div>{selectedInspection.evidenceCompletion}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Rework rate</div>
                      <div>{selectedInspection.reworkRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the field action required to unblock this inspection"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedInspection.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Release review requires at most 3 open findings and at least 85% evidence.</span>
                        <span className="tableCellMuted">Final release requires 0 open findings and at least 90% release readiness.</span>
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
                              onClick={() => void handleInspectionAction(option.status, option.nextAction)}
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
                    title="No inspection selected"
                    description="Choose an inspection to inspect findings, evidence and release posture."
                    primaryAction={{ label: "Stay on quality", href: "/quality" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Quality risks and blockers" description="Issues still blocking release, correction or quality closure.">
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
            title="Quality overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading quality overview" : "Quality overview not loaded yet"}
            description="This route now expects a live backend quality response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
