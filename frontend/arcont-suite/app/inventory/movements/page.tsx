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
import type { InventoryMovementContract, InventoryMovementsOverviewContract } from "@/lib/contracts";
import { fetchInventoryMovementsOverview, updateInventoryMovement } from "@/lib/platform-api";

function statusTone(status: InventoryMovementContract["status"]) {
  switch (status) {
    case "received":
      return "success";
    case "in_transit":
      return "info";
    case "blocked":
      return "danger";
    default:
      return "warning";
  }
}

function impactTone(impact: InventoryMovementContract["impactLevel"]) {
  switch (impact) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function actionOptions(movement: InventoryMovementContract) {
  switch (movement.status) {
    case "draft":
      return [
        {
          label: "Release movement",
          status: "in_transit" as const,
          nextAction: "Release the movement and confirm origin plus destination handoff coverage."
        },
        {
          label: "Block movement",
          status: "blocked" as const,
          nextAction: "Stop the movement and document the traceability issue before dispatch."
        }
      ];
    case "in_transit":
      return [
        {
          label: "Mark received",
          status: "received" as const,
          nextAction: "Close the movement after counts, signatures and evidence are fully reconciled."
        },
        {
          label: "Block movement",
          status: "blocked" as const,
          nextAction: "Pause the movement until the variance or handoff blocker is contained."
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume transit",
          status: "in_transit" as const,
          nextAction: "Resume the movement after the current blocker has been resolved."
        }
      ];
    default:
      return [];
    }
}

function recomputeSummary(movements: InventoryMovementContract[]) {
  return {
    openMovements: movements.filter((movement) => movement.status !== "received").length,
    criticalMovements: movements.filter((movement) => movement.impactLevel === "critical").length,
    pendingEvidence: movements.reduce((sum, movement) => sum + movement.pendingEvidence, 0),
    varianceUnits: movements.reduce((sum, movement) => sum + Math.abs(movement.varianceUnits), 0),
    returnsInFlow: movements.filter((movement) => movement.movementType === "return" && movement.status !== "received").length
  };
}

function pickFocusMovement(movements: InventoryMovementContract[]) {
  return (
    movements
      .slice()
      .sort((left, right) => {
        if (left.impactLevel === "critical" && right.impactLevel !== "critical") {
          return -1;
        }
        if (left.impactLevel !== "critical" && right.impactLevel === "critical") {
          return 1;
        }
        return Math.abs(right.varianceUnits) - Math.abs(left.varianceUnits);
      })[0] ?? null
  );
}

export default function InventoryMovementsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<InventoryMovementsOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
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

    void fetchInventoryMovementsOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Inventory movements overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedMovementId((current) => current ?? result.focusMovement?.id ?? result.movements[0]?.id ?? null);
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

  const selectedMovement = useMemo(
    () => overview?.movements.find((item) => item.id === selectedMovementId) ?? overview?.focusMovement ?? null,
    [overview, selectedMovementId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.movementId === selectedMovement?.id) ?? [],
    [overview, selectedMovement]
  );

  const movementActions = useMemo(() => (selectedMovement ? actionOptions(selectedMovement) : []), [selectedMovement]);

  useEffect(() => {
    setNextActionDraft(selectedMovement?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedMovementId, selectedMovement?.id, selectedMovement?.nextAction]);

  async function handleAction(status: InventoryMovementContract["status"], suggestedNextAction: string) {
    if (!selectedMovement || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the movement.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateInventoryMovement(
      selectedMovement.id,
      activeCompany.id,
      { status, nextAction },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Inventory movement update failed.");
      setIsSaving(false);
      return;
    }

    const updatedMovement = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const movements = current.movements.map((item) => (item.id === updatedMovement.id ? updatedMovement : item));
      return {
        ...current,
        summary: recomputeSummary(movements),
        movements,
        focusMovement: pickFocusMovement(movements)
      };
    });

    setNextActionDraft(updatedMovement.nextAction);
    setActionMessage(`Movement moved to ${updatedMovement.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Inventory movements"
      eyebrow="Warehouse execution"
      description="Transfers, site issues and returns controlled with evidence, quantity traceability and operational impact."
    >
      <ModuleGate moduleKeys={["inventory.movements"]} requiredPermissions={["inventory:*"]} title="Movements">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Open movements" value={String(overview.summary.openMovements)} footnote="Moves still not fully closed at destination." />
              <KpiCard label="Critical impact" value={String(overview.summary.criticalMovements)} footnote="Movements currently putting execution or stock traceability at risk." />
              <KpiCard label="Pending evidence" value={String(overview.summary.pendingEvidence)} footnote="Missing proof of dispatch, handoff or receipt." />
              <KpiCard label="Returns in flow" value={String(overview.summary.returnsInFlow)} footnote="Return movements still open between front and warehouse." />
            </section>

            <section className="grid cols2">
              <Card title="Movement board" description="Operational handoffs across warehouses, yards and jobsite fronts.">
                <FilterBar summary={`${overview.movements.length} movements in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "movements ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.movements}
                  columns={[
                    {
                      key: "code",
                      label: "Movement",
                      render: (row) => (
                        <button className="buttonGhost" type="button" onClick={() => setSelectedMovementId(row.id)}>
                          {row.code}
                        </button>
                      )
                    },
                    { key: "sku", label: "SKU", render: (row) => row.skuName },
                    { key: "route", label: "Route", render: (row) => `${row.sourceName} -> ${row.destinationName}` },
                    { key: "variance", label: "Variance", render: (row) => `${row.varianceUnits} u` },
                    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> }
                  ]}
                />
              </Card>

              <Card
                title={selectedMovement ? selectedMovement.code : "Select a movement"}
                description={
                  selectedMovement
                    ? `${selectedMovement.skuName} · ${selectedMovement.sourceName} -> ${selectedMovement.destinationName}`
                    : "Review the selected movement and decide the next stock handoff action."
                }
              >
                {selectedMovement ? (
                  <div className="stack">
                    <div className="grid cols2">
                      <KpiCard
                        label="Requested vs moved"
                        value={`${selectedMovement.movedUnits}/${selectedMovement.requestedUnits}`}
                        footnote={selectedMovement.movementType}
                      />
                      <KpiCard
                        label="Impact / evidence"
                        value={`${selectedMovement.pendingEvidence}`}
                        footnote={`impact ${selectedMovement.impactLevel}`}
                      />
                    </div>

                    <div className="row gap wrap">
                      <Badge tone={statusTone(selectedMovement.status)}>{selectedMovement.status}</Badge>
                      <Badge tone={impactTone(selectedMovement.impactLevel)}>{selectedMovement.impactLevel}</Badge>
                      <Badge tone={selectedMovement.varianceUnits === 0 ? "success" : "warning"}>
                        {selectedMovement.varianceUnits} units variance
                      </Badge>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="movement-next-action">
                        Next action
                      </label>
                      <textarea
                        id="movement-next-action"
                        className="textarea"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                      />
                    </div>

                    <div className="row gap wrap">
                      {movementActions.map((action) => (
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

                    <Card title="Movement risks" description="Current handoff, variance or evidence issues on this movement.">
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
                        <EmptyState title="No active risks" description="This movement has no explicit operational risks right now." />
                      )}
                    </Card>
                  </div>
                ) : (
                  <EmptyState title="No movement selected" description="Choose a movement from the board to review its detail." />
                )}
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Movements unavailable"
            description={error ?? "The inventory movements board could not be loaded from the current backend source."}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
