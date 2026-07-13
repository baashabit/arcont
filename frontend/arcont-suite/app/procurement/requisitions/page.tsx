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
import type { ProcurementRequisitionContract, ProcurementRequisitionsOverviewContract } from "@/lib/contracts";
import { fetchProcurementRequisitionsOverview, updateProcurementRequisition } from "@/lib/platform-api";

function statusTone(status: ProcurementRequisitionContract["status"]) {
  switch (status) {
    case "sourcing":
      return "info";
    case "approved":
      return "success";
    case "blocked":
      return "danger";
    case "submitted":
      return "warning";
    default:
      return "gold";
  }
}

function urgencyTone(urgency: ProcurementRequisitionContract["urgency"]) {
  switch (urgency) {
    case "critical":
      return "danger";
    case "watch":
      return "warning";
    default:
      return "success";
  }
}

function requisitionActionOptions(requisition: ProcurementRequisitionContract) {
  switch (requisition.status) {
    case "draft":
      return [
        {
          label: "Submit requisition",
          status: "submitted" as const,
          nextAction: "Submit the requisition for approval with complete scope, quantities and justification."
        }
      ];
    case "submitted":
      return [
        {
          label: "Approve requisition",
          status: "approved" as const,
          nextAction: "Approve the requisition and hand it to procurement for market validation."
        },
        {
          label: "Block requisition",
          status: "blocked" as const,
          nextAction: "Block the requisition until scope, urgency or budget definition is clarified."
        }
      ];
    case "approved":
      return [
        {
          label: "Move to sourcing",
          status: "sourcing" as const,
          nextAction: "Open sourcing and request quotations from the covered supplier base."
        },
        {
          label: "Block requisition",
          status: "blocked" as const,
          nextAction: "Pause this approved requisition until the technical or commercial blocker is cleared."
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume submitted",
          status: "submitted" as const,
          nextAction: "Resume the requisition after clarifying the blocker and route it back to review."
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(requisitions: ProcurementRequisitionContract[]) {
  const openRequisitions = requisitions.filter((item) => item.status !== "sourcing");
  return {
    openRequisitions: openRequisitions.length,
    pendingApproval: requisitions.filter((item) => item.status === "submitted").length,
    criticalUrgency: requisitions.filter((item) => item.urgency === "critical").length,
    averageApprovalHours:
      openRequisitions.length > 0
        ? Number((openRequisitions.reduce((sum, item) => sum + item.approvalHours, 0) / openRequisitions.length).toFixed(1))
        : 0,
    supplierCoverage:
      requisitions.length > 0
        ? Number((requisitions.reduce((sum, item) => sum + item.supplierCoverage, 0) / requisitions.length).toFixed(1))
        : 0
  };
}

function pickFocusRequisition(requisitions: ProcurementRequisitionContract[]) {
  return (
    requisitions
      .slice()
      .sort((left, right) => {
        if (left.status === "blocked" && right.status !== "blocked") {
          return -1;
        }
        if (left.status !== "blocked" && right.status === "blocked") {
          return 1;
        }
        if (left.urgency === "critical" && right.urgency !== "critical") {
          return -1;
        }
        if (left.urgency !== "critical" && right.urgency === "critical") {
          return 1;
        }
        return right.budgetAmount - left.budgetAmount;
      })[0] ?? null
  );
}

export default function ProcurementRequisitionsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ProcurementRequisitionsOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | null>(null);
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

    void fetchProcurementRequisitionsOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Procurement requisitions overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedRequisitionId((current) => current ?? result.focusRequisition?.id ?? result.requisitions[0]?.id ?? null);
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

  const selectedRequisition = useMemo(
    () => overview?.requisitions.find((item) => item.id === selectedRequisitionId) ?? overview?.focusRequisition ?? null,
    [overview, selectedRequisitionId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.requisitionId === selectedRequisition?.id) ?? [],
    [overview, selectedRequisition]
  );

  const actionOptions = useMemo(
    () => (selectedRequisition ? requisitionActionOptions(selectedRequisition) : []),
    [selectedRequisition]
  );

  useEffect(() => {
    setNextActionDraft(selectedRequisition?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedRequisitionId, selectedRequisition?.id, selectedRequisition?.nextAction]);

  async function handleAction(status: ProcurementRequisitionContract["status"], suggestedNextAction: string) {
    if (!selectedRequisition || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the requisition.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateProcurementRequisition(
      selectedRequisition.id,
      activeCompany.id,
      { status, nextAction },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Requisition update failed.");
      setIsSaving(false);
      return;
    }

    const updatedRequisition = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const requisitions = current.requisitions.map((item) => (item.id === updatedRequisition.id ? updatedRequisition : item));
      return {
        ...current,
        summary: recomputeSummary(requisitions),
        requisitions,
        focusRequisition: pickFocusRequisition(requisitions)
      };
    });

    setNextActionDraft(updatedRequisition.nextAction);
    setActionMessage(`Requisition moved to ${updatedRequisition.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Procurement requisitions"
      eyebrow="Execution domain"
      description="Site intake, approval discipline and sourcing handoff for field buying needs."
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title="Requisitions">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Open requisitions" value={String(overview.summary.openRequisitions)} footnote="Requests still not handed off to sourcing." />
              <KpiCard label="Pending approval" value={String(overview.summary.pendingApproval)} footnote="Submitted requisitions still waiting for approval." />
              <KpiCard label="Critical urgency" value={String(overview.summary.criticalUrgency)} footnote="Requests already carrying execution pressure." />
              <KpiCard label="Supplier coverage" value={`${overview.summary.supplierCoverage}`} footnote="Average supplier paths already identified per requisition." />
            </section>

            <section className="grid cols2">
              <Card title="Requisition board" description="Field intake, approval aging and sourcing readiness across the active tenant.">
                <FilterBar summary={`${overview.requisitions.length} requisitions in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "requisitions ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.requisitions}
                  columns={[
                    {
                      key: "code",
                      label: "Requisition",
                      render: (row) => (
                        <button className="buttonGhost" type="button" onClick={() => setSelectedRequisitionId(row.id)}>
                          {row.code}
                        </button>
                      )
                    },
                    { key: "project", label: "Project", render: (row) => row.projectName },
                    { key: "front", label: "Front", render: (row) => row.frontName },
                    { key: "urgency", label: "Urgency", render: (row) => <Badge tone={urgencyTone(row.urgency)}>{row.urgency}</Badge> },
                    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> }
                  ]}
                />
              </Card>

              <Card
                title={selectedRequisition ? selectedRequisition.code : "Select a requisition"}
                description={
                  selectedRequisition
                    ? `${selectedRequisition.projectName} · ${selectedRequisition.frontName} · ${selectedRequisition.category}`
                    : "Review the selected requisition and decide the next procurement action."
                }
              >
                {selectedRequisition ? (
                  <div className="stack">
                    <div className="grid cols2">
                      <KpiCard label="Items / amount" value={`${selectedRequisition.requestedItems}`} footnote={`MXN ${selectedRequisition.budgetAmount.toLocaleString()}`} />
                      <KpiCard label="Approval / coverage" value={`${selectedRequisition.approvalHours}h`} footnote={`${selectedRequisition.supplierCoverage} suppliers`} />
                    </div>

                    <div className="row gap wrap">
                      <Badge tone={statusTone(selectedRequisition.status)}>{selectedRequisition.status}</Badge>
                      <Badge tone={urgencyTone(selectedRequisition.urgency)}>{selectedRequisition.urgency}</Badge>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="requisition-next-action">
                        Next action
                      </label>
                      <textarea
                        id="requisition-next-action"
                        className="textarea"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                      />
                    </div>

                    <div className="row gap wrap">
                      {actionOptions.map((action) => (
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

                    <Card title="Requisition risks" description="Current blockers or sourcing readiness gaps on this request.">
                      {selectedRisks.length > 0 ? (
                        <div className="stack">
                          {selectedRisks.map((risk) => (
                            <div key={risk.id} className="row space-between card-section">
                              <div>
                                <strong>{risk.title}</strong>
                                <p>{risk.category} · {risk.owner}</p>
                              </div>
                              <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                                {risk.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="No active risks" description="This requisition has no explicit procurement risks right now." />
                      )}
                    </Card>
                  </div>
                ) : (
                  <EmptyState title="No requisition selected" description="Choose a requisition from the board to review its detail." />
                )}
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Requisitions unavailable"
            description={error ?? "The requisitions board could not be loaded from the current backend source."}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
