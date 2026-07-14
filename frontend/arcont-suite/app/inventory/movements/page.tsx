"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import {
  createInventoryMovement,
  fetchEquipmentOverview,
  fetchInventoryMovementsOverview,
  fetchInventoryReceivingOverview,
  updateInventoryMovement
} from "@/lib/platform-api";

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

function commercialTone(status: InventoryMovementContract["purchaseOrderStatus"]) {
  switch (status) {
    case "received":
      return "success";
    case "blocked":
      return "danger";
    case "in_transit":
    case "partial":
      return "warning";
    case "confirmed":
      return "info";
    default:
      return "gold";
  }
}

function invoiceTone(status: InventoryMovementContract["invoiceMatchStatus"]) {
  switch (status) {
    case "matched":
      return "success";
    case "risk":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "info";
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
    returnsInFlow: movements.filter((movement) => movement.movementType === "return" && movement.status !== "received").length,
    movementsAtCommercialRisk: movements.filter(
      (movement) => movement.purchaseOrderStatus === "blocked" || movement.invoiceMatchStatus === "risk"
    ).length
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
        if ((left.invoiceMatchStatus === "risk") !== (right.invoiceMatchStatus === "risk")) {
          return Number(right.invoiceMatchStatus === "risk") - Number(left.invoiceMatchStatus === "risk");
        }
        return Math.abs(right.varianceUnits) - Math.abs(left.varianceUnits);
      })[0] ?? null
  );
}

type MovementBridgeContext = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
  receiving: NonNullable<Awaited<ReturnType<typeof fetchInventoryReceivingOverview>>>;
} | null;

function buildMovementStory(movement: InventoryMovementContract | null, bridge: MovementBridgeContext) {
  if (!movement) {
    return null;
  }

  const machineSignal = bridge?.equipment.focusMachine ?? null;

  return {
    equipmentSupport: machineSignal
      ? `${machineSignal.machineName} on ${machineSignal.projectName} · ${machineSignal.frontName} is the current asset anchor with status ${machineSignal.status} and health ${machineSignal.health}.`
      : "No equipment anchor is currently linked to this movement lane.",
    maintenanceDependency: machineSignal
      ? `${machineSignal.nextMaintenanceHours} operating hours remain before service, with ${machineSignal.criticalOpenFailures} critical failures still open.`
      : "No maintenance dependency is currently visible for this movement.",
    fieldReleaseEffect:
      movement.impactLevel === "critical"
        ? `${movement.destinationName} is exposed because this movement still carries critical execution impact.`
        : movement.pendingEvidence > 0
          ? `${movement.destinationName} still needs evidence closure before the material handoff is fully reliable.`
          : `${movement.destinationName} currently has a controlled material handoff posture.`
  };
}

function InventoryMovementsPageContent() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<InventoryMovementsOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<MovementBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    movementType: "transfer" as InventoryMovementContract["movementType"],
    skuName: "Block 12x20x40",
    sourceName: "Almacen central",
    destinationName: "Frente 1",
    requestedBy: "Warehouse coordinator",
    upstreamReceiptCode: "",
    purchaseReference: "",
    requestedUnits: "100",
    movedUnits: "0",
    pendingEvidence: "2",
    impactLevel: "watch" as InventoryMovementContract["impactLevel"],
    nextAction: ""
  });
  const purchaseReferenceParam = searchParams.get("purchaseReference")?.trim() ?? "";
  const upstreamReceiptCodeParam = searchParams.get("upstreamReceiptCode")?.trim() ?? "";

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchInventoryMovementsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchInventoryReceivingOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchEquipmentOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, receiving, equipment]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Inventory movements overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedMovementId((current) => current ?? result.focusMovement?.id ?? result.movements[0]?.id ?? null);
        setBridgeContext(equipment && receiving ? { equipment, receiving } : null);
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

  const selectedStory = useMemo(() => buildMovementStory(selectedMovement, bridgeContext), [bridgeContext, selectedMovement]);
  const eligibleReceipts = useMemo(
    () => bridgeContext?.receiving.receipts.filter((item) => item.status === "received") ?? [],
    [bridgeContext]
  );

  useEffect(() => {
    if (createForm.upstreamReceiptCode || eligibleReceipts.length === 0) {
      return;
    }

    const linkedReceipt = eligibleReceipts[0];
    setCreateForm((current) => ({
      ...current,
      upstreamReceiptCode: linkedReceipt.code,
      purchaseReference: linkedReceipt.purchaseReference
    }));
  }, [createForm.upstreamReceiptCode, eligibleReceipts]);

  useEffect(() => {
    if (!purchaseReferenceParam && !upstreamReceiptCodeParam) {
      return;
    }

    const linkedReceipt = eligibleReceipts.find((item) => item.code === upstreamReceiptCodeParam);
    setCreateForm((current) => ({
      ...current,
      upstreamReceiptCode: upstreamReceiptCodeParam || current.upstreamReceiptCode,
      purchaseReference: purchaseReferenceParam || linkedReceipt?.purchaseReference || current.purchaseReference
    }));
  }, [eligibleReceipts, purchaseReferenceParam, upstreamReceiptCodeParam]);

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

    if (status === "received" && selectedMovement.pendingEvidence > 0) {
      setActionError("Movement cannot close while evidence is still pending.");
      return;
    }

    if (status === "received" && Math.abs(selectedMovement.varianceUnits) > 0) {
      setActionError("Movement cannot close while quantity variance remains open.");
      return;
    }

    if (status === "received" && selectedMovement.impactLevel === "critical") {
      setActionError("Movement cannot close while its execution impact remains critical.");
      return;
    }

    if (status === "received" && selectedMovement.invoiceMatchStatus === "risk") {
      setActionError("Movement cannot close while the linked purchase order remains at fiscal risk.");
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

  async function handleCreateMovement() {
    if (!overview || !session.accessToken) {
      return;
    }

    const skuName = createForm.skuName.trim();
    const sourceName = createForm.sourceName.trim();
    const destinationName = createForm.destinationName.trim();
    const requestedBy = createForm.requestedBy.trim();
    const upstreamReceiptCode = createForm.upstreamReceiptCode.trim();
    const purchaseReference = createForm.purchaseReference.trim();
    const nextAction = createForm.nextAction.trim();
    const requestedUnits = Number(createForm.requestedUnits);
    const movedUnits = Number(createForm.movedUnits);
    const pendingEvidence = Number(createForm.pendingEvidence);
    const linkedReceipt = upstreamReceiptCode
      ? eligibleReceipts.find((item) => item.code === upstreamReceiptCode)
      : null;

    if ([skuName, sourceName, destinationName, requestedBy].some((value) => value.length < 3)) {
      setActionError("SKU, source, destination and requester must be defined before creating the movement.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be specific before creating the movement.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(requestedUnits) || requestedUnits <= 0 || !Number.isFinite(movedUnits) || movedUnits < 0) {
      setActionError("Requested units must be greater than zero and moved units cannot be negative.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(pendingEvidence) || pendingEvidence < 0) {
      setActionError("Pending evidence must be a valid non-negative number.");
      setCreateMessage(null);
      return;
    }

    if (movedUnits > requestedUnits) {
      setActionError("Moved units cannot exceed requested units when creating the movement.");
      setCreateMessage(null);
      return;
    }

    if (upstreamReceiptCode && !linkedReceipt) {
      setActionError("The selected upstream receipt is no longer available for movement creation.");
      setCreateMessage(null);
      return;
    }

    if (upstreamReceiptCode && !purchaseReference) {
      setActionError("A purchase reference is required when the movement is linked to an upstream receipt.");
      setCreateMessage(null);
      return;
    }

    if (upstreamReceiptCode && purchaseReference && linkedReceipt?.purchaseReference !== purchaseReference) {
      setActionError("Purchase reference must match the selected upstream receipt before creating the movement.");
      setCreateMessage(null);
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createInventoryMovement(
      activeCompany.id,
      {
        movementType: createForm.movementType,
        skuName,
        sourceName,
        destinationName,
        requestedBy,
        upstreamReceiptCode: upstreamReceiptCode || null,
        purchaseReference: purchaseReference || null,
        requestedUnits,
        movedUnits,
        pendingEvidence,
        impactLevel: createForm.impactLevel,
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Inventory movement creation failed.");
      setIsSaving(false);
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const movements = [created, ...current.movements];
      return {
        ...current,
        summary: recomputeSummary(movements),
        movements,
        focusMovement: pickFocusMovement(movements)
      };
    });
    setSelectedMovementId(created.id);
    setCreateMessage(`${created.code} created for ${created.skuName}.`);
    setCreateForm((current) => ({
      ...current,
      upstreamReceiptCode: upstreamReceiptCodeParam || current.upstreamReceiptCode,
      purchaseReference: purchaseReferenceParam || current.purchaseReference,
      movedUnits: "0",
      pendingEvidence: "2",
      nextAction: ""
    }));
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
              <KpiCard label="Commercial risk" value={String(overview.summary.movementsAtCommercialRisk)} footnote="Movements tied to blocked purchase posture or fiscal packet risk." />
            </section>

            <section className="grid cols3">
              <Card title="Equipment support" description="Current fleet anchor attached to this movement lane.">
                <p className="sectionText">
                  {selectedStory?.equipmentSupport ?? "Choose a movement to inspect equipment support."}
                </p>
              </Card>
              <Card title="Maintenance dependency" description="Service posture that can still distort this handoff.">
                <p className="sectionText">
                  {selectedStory?.maintenanceDependency ?? "Choose a movement to inspect maintenance dependency."}
                </p>
              </Card>
              <Card title="Field release effect" description="How this transfer affects real execution at destination.">
                <p className="sectionText">
                  {selectedStory?.fieldReleaseEffect ?? "Choose a movement to inspect its field release effect."}
                </p>
              </Card>
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
                    {
                      key: "sku",
                      label: "SKU",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.skuName}</strong>
                          <span className="tableCellMuted">{row.upstreamReceiptCode ?? "No upstream receipt"}</span>
                        </div>
                      )
                    },
                    { key: "route", label: "Route", render: (row) => `${row.sourceName} -> ${row.destinationName}` },
                    { key: "variance", label: "Variance", render: (row) => `${row.varianceUnits} u` },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => (
                        <div className="row gap wrap">
                          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                          <Badge tone={commercialTone(row.purchaseOrderStatus)}>{row.purchaseOrderStatus}</Badge>
                        </div>
                      )
                    }
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
                      <Badge tone={commercialTone(selectedMovement.purchaseOrderStatus)}>{selectedMovement.purchaseOrderStatus}</Badge>
                      <Badge tone={invoiceTone(selectedMovement.invoiceMatchStatus)}>{selectedMovement.invoiceMatchStatus}</Badge>
                      <Badge tone={selectedMovement.varianceUnits === 0 ? "success" : "warning"}>
                        {selectedMovement.varianceUnits} units variance
                      </Badge>
                    </div>

                    <div className="row gap wrap">
                      <Link className="buttonGhost" href="/field">
                        Open field
                      </Link>
                      <Link
                        className="buttonGhost"
                        href={`/inventory/receiving?purchaseReference=${encodeURIComponent(selectedMovement.purchaseReference ?? "")}&supplierName=${encodeURIComponent(selectedMovement.purchaseOrderOwner)}`}
                      >
                        Open receiving
                      </Link>
                      <Link className="buttonGhost" href="/equipment">
                        Open equipment
                      </Link>
                    </div>

                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">Upstream receipt</div>
                        <div>{selectedMovement.upstreamReceiptCode ?? "Not linked"}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Purchase order</div>
                        <div>{selectedMovement.purchaseReference ?? "Not linked"}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Purchasing owner</div>
                        <div>{selectedMovement.purchaseOrderOwner}</div>
                      </div>
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

            <section className="grid cols2">
              <Card title="Register stock movement" description="Create a warehouse transfer, issue or return with traceability and handoff context.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Type</div><select className="selectField" value={createForm.movementType} onChange={(event) => setCreateForm((current) => ({ ...current, movementType: event.target.value as InventoryMovementContract["movementType"] }))}><option value="transfer">transfer</option><option value="issue">issue</option><option value="return">return</option></select></label>
                  <label className="detailRow"><div className="detailLabel">SKU</div><input className="field" value={createForm.skuName} onChange={(event) => setCreateForm((current) => ({ ...current, skuName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Source</div><input className="field" value={createForm.sourceName} onChange={(event) => setCreateForm((current) => ({ ...current, sourceName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Destination</div><input className="field" value={createForm.destinationName} onChange={(event) => setCreateForm((current) => ({ ...current, destinationName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Requested by</div><input className="field" value={createForm.requestedBy} onChange={(event) => setCreateForm((current) => ({ ...current, requestedBy: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Upstream receipt</div><select className="selectField" value={createForm.upstreamReceiptCode} onChange={(event) => {
                    const code = event.target.value;
                    const linkedReceipt = eligibleReceipts.find((item) => item.code === code);
                    setCreateForm((current) => ({
                      ...current,
                      upstreamReceiptCode: code,
                      purchaseReference: linkedReceipt?.purchaseReference ?? current.purchaseReference
                    }));
                  }}><option value="">No linked receipt</option>{eligibleReceipts.map((item) => <option key={item.id} value={item.code}>{item.code} · {item.supplierName} · {item.purchaseReference}</option>)}</select></label>
                  <label className="detailRow"><div className="detailLabel">Purchase reference</div><input className="field" value={createForm.purchaseReference} onChange={(event) => setCreateForm((current) => ({ ...current, purchaseReference: event.target.value }))} placeholder="Purchase order code linked to the receipt or movement" /></label>
                  <label className="detailRow"><div className="detailLabel">Requested units</div><input className="field" type="number" min="0" value={createForm.requestedUnits} onChange={(event) => setCreateForm((current) => ({ ...current, requestedUnits: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Moved units</div><input className="field" type="number" min="0" value={createForm.movedUnits} onChange={(event) => setCreateForm((current) => ({ ...current, movedUnits: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Pending evidence</div><input className="field" type="number" min="0" value={createForm.pendingEvidence} onChange={(event) => setCreateForm((current) => ({ ...current, pendingEvidence: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Impact</div><select className="selectField" value={createForm.impactLevel} onChange={(event) => setCreateForm((current) => ({ ...current, impactLevel: event.target.value as InventoryMovementContract["impactLevel"] }))}><option value="controlled">controlled</option><option value="watch">watch</option><option value="critical">critical</option></select></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isSaving} onClick={() => void handleCreateMovement()}>{isSaving ? "Saving..." : "Add movement"}</button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Movement creation rules" description="Warehouse traceability starts with valid upstream context and realistic quantities.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Operational counts</div><div>Requested units must be greater than zero; moved units and evidence cannot be negative.</div></div>
                  <div className="detailRow"><div className="detailLabel">Reference coherence</div><div>If you link an upstream receipt, the purchase reference must stay aligned with that receipt.</div></div>
                  <div className="detailRow"><div className="detailLabel">Upstream gate</div><div>If you link an upstream receipt, backend only accepts receipts already in `received` posture.</div></div>
                  <div className="detailRow"><div className="detailLabel">Close discipline</div><div>Movements still cannot close while evidence, variance, critical impact or fiscal risk remain open.</div></div>
                </div>
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

export default function InventoryMovementsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Inventory movements" eyebrow="Warehouse execution" description="Loading movement context...">
          <section className="grid cols1">
            <Card title="Loading" description="Movement context is being prepared.">
              <p className="sectionText">Preparing movement context.</p>
            </Card>
          </section>
        </AppShell>
      }
    >
      <InventoryMovementsPageContent />
    </Suspense>
  );
}
