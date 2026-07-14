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
import type { InventoryReceiptContract, InventoryReceivingOverviewContract } from "@/lib/contracts";
import {
  createInventoryReceipt,
  fetchInventoryReceivingOverview,
  fetchProcurementPurchaseOrdersOverview,
  fetchSupplierControlOverview,
  updateInventoryReceipt
} from "@/lib/platform-api";

function statusTone(status: InventoryReceiptContract["status"]) {
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

function commercialTone(status: InventoryReceiptContract["purchaseOrderStatus"]) {
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

function invoiceTone(status: InventoryReceiptContract["invoiceMatchStatus"]) {
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

function actionOptions(receipt: InventoryReceiptContract) {
  switch (receipt.status) {
    case "draft":
      return [
        {
          label: "Send in transit",
          status: "in_transit" as const,
          nextAction: "Release the inbound shipment and keep the receiving slot confirmed with the destination crew."
        },
        {
          label: "Block receipt",
          status: "blocked" as const,
          nextAction: "Stop the receipt and document the issue before the truck reaches the unloading gate."
        }
      ];
    case "in_transit":
      return [
        {
          label: "Mark received",
          status: "received" as const,
          nextAction: "Close the receipt after evidence, counts and acceptance are fully reconciled."
        },
        {
          label: "Block receipt",
          status: "blocked" as const,
          nextAction: "Pause the receipt and escalate variance, damage or evidence gaps."
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume transit",
          status: "in_transit" as const,
          nextAction: "Resume the inbound flow after the blocker is contained and warehouse is ready again."
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(receipts: InventoryReceiptContract[]) {
  return {
    openReceipts: receipts.filter((receipt) => receipt.status !== "received").length,
    overdueEta: receipts.filter((receipt) => receipt.status !== "received" && Date.parse(receipt.etaDate) < Date.now()).length,
    quantityVarianceUnits: receipts.reduce((sum, receipt) => sum + Math.abs(receipt.varianceUnits), 0),
    pendingEvidence: receipts.reduce((sum, receipt) => sum + receipt.pendingEvidence, 0),
    blockedReceipts: receipts.filter((receipt) => receipt.status === "blocked").length,
    receiptsAtCommercialRisk: receipts.filter(
      (receipt) => receipt.purchaseOrderStatus === "blocked" || receipt.invoiceMatchStatus === "risk"
    ).length
  };
}

function pickFocusReceipt(receipts: InventoryReceiptContract[]) {
  return (
    receipts
      .slice()
      .sort((left, right) => {
        if (left.status === "blocked" && right.status !== "blocked") {
          return -1;
        }
        if (left.status !== "blocked" && right.status === "blocked") {
          return 1;
        }
        if ((left.invoiceMatchStatus === "risk") !== (right.invoiceMatchStatus === "risk")) {
          return Number(right.invoiceMatchStatus === "risk") - Number(left.invoiceMatchStatus === "risk");
        }
        return Math.abs(right.varianceUnits) - Math.abs(left.varianceUnits);
      })[0] ?? null
  );
}

type ReceivingBridgeContext = {
  purchaseOrders: NonNullable<Awaited<ReturnType<typeof fetchProcurementPurchaseOrdersOverview>>>;
  supplierControl: NonNullable<Awaited<ReturnType<typeof fetchSupplierControlOverview>>>;
} | null;

function buildReceivingStory(receipt: InventoryReceiptContract | null, bridge: ReceivingBridgeContext) {
  if (!receipt) {
    return null;
  }

  const purchaseSignal = bridge?.purchaseOrders.focusPurchaseOrder ?? null;
  const supplierSignal = bridge?.supplierControl.focusLine ?? null;

  return {
    purchaseDependency: purchaseSignal
      ? `${purchaseSignal.code} is the current PO anchor with status ${purchaseSignal.status} and ${purchaseSignal.receivedPercent}% receipt progress.`
      : "No purchase-order anchor is currently visible for this receipt lane.",
    supplierPressure: supplierSignal
      ? `${supplierSignal.supplierName} remains at ${supplierSignal.deliveryHealth} delivery health with ${supplierSignal.complianceAlerts} compliance alerts open.`
      : "No supplier-control pressure is currently visible for this inbound flow.",
    warehouseExecution:
      receipt.status === "blocked"
        ? `${receipt.destinationName} is already exposed because this receipt is blocked before clean stock acceptance.`
        : receipt.pendingEvidence > 0 || receipt.varianceUnits !== 0
          ? `${receipt.destinationName} still needs variance and evidence closure before the inbound flow is operationally clean.`
          : `${receipt.destinationName} currently has a controlled inbound execution posture.`
  };
}

function InventoryReceivingPageContent() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<InventoryReceivingOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<ReceivingBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    supplierName: "Proveedor Estrategico",
    destinationName: "Almacen central",
    destinationType: "warehouse",
    purchaseReference: "",
    etaDate: "2026-07-25",
    orderedUnits: "100",
    receivedUnits: "0",
    pendingEvidence: "2",
    rejectedUnits: "0",
    nextAction: ""
  });
  const purchaseReferenceParam = searchParams.get("purchaseReference")?.trim() ?? "";
  const supplierNameParam = searchParams.get("supplierName")?.trim() ?? "";

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchInventoryReceivingOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchProcurementPurchaseOrdersOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchSupplierControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, purchaseOrders, supplierControl]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Inventory receiving overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedReceiptId((current) => current ?? result.focusReceipt?.id ?? result.receipts[0]?.id ?? null);
        setBridgeContext(purchaseOrders && supplierControl ? { purchaseOrders, supplierControl } : null);
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

  const selectedReceipt = useMemo(
    () => overview?.receipts.find((item) => item.id === selectedReceiptId) ?? overview?.focusReceipt ?? null,
    [overview, selectedReceiptId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.receiptId === selectedReceipt?.id) ?? [],
    [overview, selectedReceipt]
  );

  const receiptActions = useMemo(() => (selectedReceipt ? actionOptions(selectedReceipt) : []), [selectedReceipt]);

  const selectedStory = useMemo(() => buildReceivingStory(selectedReceipt, bridgeContext), [bridgeContext, selectedReceipt]);
  const eligiblePurchaseOrders = useMemo(
    () =>
      bridgeContext?.purchaseOrders.purchaseOrders.filter((item) => ["confirmed", "in_transit", "partial"].includes(item.status)) ?? [],
    [bridgeContext]
  );

  useEffect(() => {
    setNextActionDraft(selectedReceipt?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedReceiptId, selectedReceipt?.id, selectedReceipt?.nextAction]);

  useEffect(() => {
    if (createForm.purchaseReference || eligiblePurchaseOrders.length === 0) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      purchaseReference: eligiblePurchaseOrders[0]?.code ?? "",
      supplierName: eligiblePurchaseOrders[0]?.supplierName ?? current.supplierName
    }));
  }, [createForm.purchaseReference, eligiblePurchaseOrders]);

  useEffect(() => {
    if (!purchaseReferenceParam && !supplierNameParam) {
      return;
    }

    const linkedOrder = eligiblePurchaseOrders.find((item) => item.code === purchaseReferenceParam);
    setCreateForm((current) => ({
      ...current,
      purchaseReference: purchaseReferenceParam || current.purchaseReference,
      supplierName: supplierNameParam || linkedOrder?.supplierName || current.supplierName
    }));
  }, [eligiblePurchaseOrders, purchaseReferenceParam, supplierNameParam]);

  async function handleAction(status: InventoryReceiptContract["status"], suggestedNextAction: string) {
    if (!selectedReceipt || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the receipt.");
      return;
    }

    if (status === "received" && selectedReceipt.pendingEvidence > 0) {
      setActionError("Receipt cannot close while evidence is still pending.");
      return;
    }

    if (status === "received" && selectedReceipt.rejectedUnits > 0) {
      setActionError("Receipt cannot close while rejected units remain unresolved.");
      return;
    }

    if (status === "received" && Math.abs(selectedReceipt.varianceUnits) > 0) {
      setActionError("Receipt cannot close while quantity variance remains open.");
      return;
    }

    if (status === "received" && selectedReceipt.invoiceMatchStatus === "risk") {
      setActionError("Receipt cannot close while the linked purchase order remains at fiscal risk.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateInventoryReceipt(
      selectedReceipt.id,
      activeCompany.id,
      { status, nextAction },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Inventory receipt update failed.");
      setIsSaving(false);
      return;
    }

    const updatedReceipt = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const receipts = current.receipts.map((item) => (item.id === updatedReceipt.id ? updatedReceipt : item));
      return {
        ...current,
        summary: recomputeSummary(receipts),
        receipts,
        focusReceipt: pickFocusReceipt(receipts)
      };
    });

    setNextActionDraft(updatedReceipt.nextAction);
    setActionMessage(`Receipt moved to ${updatedReceipt.status}.`);
    setIsSaving(false);
  }

  async function handleCreateReceipt() {
    if (!overview || !session.accessToken) {
      return;
    }

    const supplierName = createForm.supplierName.trim();
    const destinationName = createForm.destinationName.trim();
    const destinationType = createForm.destinationType.trim();
    const purchaseReference = createForm.purchaseReference.trim();
    const nextAction = createForm.nextAction.trim();
    const orderedUnits = Number(createForm.orderedUnits);
    const receivedUnits = Number(createForm.receivedUnits);
    const pendingEvidence = Number(createForm.pendingEvidence);
    const rejectedUnits = Number(createForm.rejectedUnits);
    const linkedOrder = eligiblePurchaseOrders.find((item) => item.code === purchaseReference);
    const etaTimestamp = createForm.etaDate ? Date.parse(createForm.etaDate) : Number.NaN;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (supplierName.length < 3 || destinationName.length < 3 || destinationType.length < 3 || purchaseReference.length < 3) {
      setActionError("Supplier, destination and purchase reference must be defined before creating the receipt.");
      setCreateMessage(null);
      return;
    }

    if (!linkedOrder) {
      setActionError("The selected purchase order is no longer eligible to open a receipt.");
      setCreateMessage(null);
      return;
    }
    if (!createForm.etaDate) {
      setActionError("ETA date is required before creating the receipt.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(etaTimestamp) || etaTimestamp < today.getTime()) {
      setActionError("ETA date cannot be in the past when registering an inbound receipt.");
      setCreateMessage(null);
      return;
    }
    if (nextAction.length < 8) {
      setActionError("Next action must be specific before creating the receipt.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(orderedUnits) || orderedUnits <= 0 || !Number.isFinite(receivedUnits) || receivedUnits < 0) {
      setActionError("Ordered units must be greater than zero and received units cannot be negative.");
      setCreateMessage(null);
      return;
    }

    if (![pendingEvidence, rejectedUnits].every((value) => Number.isFinite(value) && value >= 0)) {
      setActionError("Evidence and rejected units must be valid non-negative numbers.");
      setCreateMessage(null);
      return;
    }

    if (receivedUnits > orderedUnits) {
      setActionError("Received units cannot exceed ordered units on receipt creation.");
      setCreateMessage(null);
      return;
    }

    if (rejectedUnits > receivedUnits) {
      setActionError("Rejected units cannot exceed received units on receipt creation.");
      setCreateMessage(null);
      return;
    }
    setIsSaving(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createInventoryReceipt(
      activeCompany.id,
      {
        supplierName,
        destinationName,
        destinationType,
        purchaseReference,
        etaDate: createForm.etaDate,
        orderedUnits,
        receivedUnits,
        pendingEvidence,
        rejectedUnits,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Receipt creation failed.");
      setIsSaving(false);
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const receipts = [created, ...current.receipts];
      return {
        ...current,
        summary: recomputeSummary(receipts),
        receipts,
        focusReceipt: pickFocusReceipt(receipts)
      };
    });
    setSelectedReceiptId(created.id);
    setCreateMessage(`${created.code} created for ${created.purchaseReference}.`);
    setCreateForm((current) => ({
      ...current,
      supplierName: supplierNameParam || current.supplierName,
      purchaseReference: purchaseReferenceParam || current.purchaseReference,
      receivedUnits: "0",
      pendingEvidence: "2",
      rejectedUnits: "0",
      nextAction: ""
    }));
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Inventory receiving"
      eyebrow="Warehouse execution"
      description="Inbound receipt control for ETA, quantity variance, evidence completeness and destination acceptance."
    >
      <ModuleGate moduleKeys={["inventory.receiving"]} requiredPermissions={["inventory:*"]} title="Receiving">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open receipts"
                value={String(overview.summary.openReceipts)}
                footnote="Inbound receipts not yet fully accepted into stock."
              />
              <KpiCard
                label="Overdue ETA"
                value={String(overview.summary.overdueEta)}
                footnote="Receipts already late against their expected arrival window."
              />
              <KpiCard
                label="Variance units"
                value={String(overview.summary.quantityVarianceUnits)}
                footnote="Absolute quantity gap still open across the current receipt board."
              />
              <KpiCard
                label="Pending evidence"
                value={String(overview.summary.pendingEvidence)}
                footnote="Missing evidence items before receipts can be cleanly closed."
              />
              <KpiCard
                label="Commercial risk"
                value={String(overview.summary.receiptsAtCommercialRisk)}
                footnote="Receipts tied to blocked purchase orders or fiscal packet risk."
              />
            </section>

            <section className="grid cols3">
              <Card title="Purchase dependency" description="Current PO signal tied to the inbound receipt.">
                <p className="sectionText">
                  {selectedStory?.purchaseDependency ?? "Choose a receipt to inspect purchase dependency."}
                </p>
              </Card>
              <Card title="Supplier pressure" description="Supplier-control signal shaping this inbound flow.">
                <p className="sectionText">
                  {selectedStory?.supplierPressure ?? "Choose a receipt to inspect supplier pressure."}
                </p>
              </Card>
              <Card title="Warehouse execution" description="Fast read of the receiving lane at destination.">
                <p className="sectionText">
                  {selectedStory?.warehouseExecution ?? "Choose a receipt to inspect warehouse execution."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Inbound board" description="Receipt posture by supplier, destination and current warehouse acceptance state.">
                <FilterBar summary={`${overview.receipts.length} inbound receipts in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "receiving ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.receipts}
                  columns={[
                    {
                      key: "code",
                      label: "Receipt",
                      render: (row) => (
                        <button className="buttonGhost" type="button" onClick={() => setSelectedReceiptId(row.id)}>
                          {row.code}
                        </button>
                      )
                    },
                    {
                      key: "supplier",
                      label: "Supplier",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.supplierName}</strong>
                          <span className="tableCellMuted">{row.purchaseReference}</span>
                        </div>
                      )
                    },
                    {
                      key: "destination",
                      label: "Destination",
                      render: (row) => row.destinationName
                    },
                    {
                      key: "variance",
                      label: "Variance",
                      render: (row) => `${row.varianceUnits} u`
                    },
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
                title={selectedReceipt ? selectedReceipt.code : "Select a receipt"}
                description={
                  selectedReceipt
                    ? `${selectedReceipt.supplierName} · ${selectedReceipt.destinationName} · ${selectedReceipt.purchaseReference}`
                    : "Review the selected inbound receipt and decide the next warehouse action."
                }
              >
                {selectedReceipt ? (
                  <div className="stack">
                    <div className="grid cols2">
                      <KpiCard
                        label="Ordered vs received"
                        value={`${selectedReceipt.receivedUnits}/${selectedReceipt.orderedUnits}`}
                        footnote={`ETA ${new Date(selectedReceipt.etaDate).toLocaleDateString()}`}
                      />
                      <KpiCard
                        label="Evidence / rejects"
                        value={`${selectedReceipt.pendingEvidence} / ${selectedReceipt.rejectedUnits}`}
                        footnote={`${selectedReceipt.destinationType} destination`}
                      />
                    </div>

                    <div className="row gap wrap">
                      <Badge tone={statusTone(selectedReceipt.status)}>{selectedReceipt.status}</Badge>
                      <Badge tone={commercialTone(selectedReceipt.purchaseOrderStatus)}>{selectedReceipt.purchaseOrderStatus}</Badge>
                      <Badge tone={invoiceTone(selectedReceipt.invoiceMatchStatus)}>{selectedReceipt.invoiceMatchStatus}</Badge>
                      <Badge tone={selectedReceipt.varianceUnits === 0 ? "success" : "warning"}>
                        {selectedReceipt.variancePercent}% variance
                      </Badge>
                      <Badge tone={selectedReceipt.pendingEvidence > 0 ? "warning" : "success"}>
                        {selectedReceipt.pendingEvidence} evidence pending
                      </Badge>
                    </div>

                    <div className="row gap wrap">
                      <Link
                        className="buttonGhost"
                        href={`/procurement/purchase-orders?purchaseReference=${encodeURIComponent(selectedReceipt.purchaseReference)}`}
                      >
                        Open purchase orders
                      </Link>
                      <Link
                        className="buttonGhost"
                        href={`/inventory/movements?purchaseReference=${encodeURIComponent(selectedReceipt.purchaseReference)}&upstreamReceiptCode=${encodeURIComponent(selectedReceipt.code)}`}
                      >
                        Open movements
                      </Link>
                    </div>
                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">Purchase order</div>
                        <div>{selectedReceipt.purchaseReference}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Purchasing owner</div>
                        <div>{selectedReceipt.purchaseOrderOwner}</div>
                      </div>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="receipt-next-action">
                        Next action
                      </label>
                      <textarea
                        id="receipt-next-action"
                        className="textarea"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                      />
                    </div>

                    <div className="row gap wrap">
                      {receiptActions.map((action) => (
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

                    <Card title="Receipt risks" description="Variance, quality or evidence issues still attached to this inbound flow.">
                      {selectedRisks.length > 0 ? (
                        <div className="stack">
                          {selectedRisks.map((risk) => (
                            <div key={risk.id} className="row space-between card-section">
                              <div>
                                <strong>{risk.title}</strong>
                                <p>
                                  {risk.category} · {risk.owner}
                                </p>
                              </div>
                              <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                                {risk.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="No active risks" description="This receipt is not carrying explicit receiving risks right now." />
                      )}
                    </Card>
                  </div>
                ) : (
                  <EmptyState title="No receipt selected" description="Choose a receipt from the inbound board to review its detail." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Register inbound receipt" description="Create a warehouse receipt directly against a live purchase order.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Purchase order</div><select className="selectField" value={createForm.purchaseReference} onChange={(event) => {
                    const nextCode = event.target.value;
                    const linkedOrder = eligiblePurchaseOrders.find((item) => item.code === nextCode);
                    setCreateForm((current) => ({
                      ...current,
                      purchaseReference: nextCode,
                      supplierName: linkedOrder?.supplierName ?? current.supplierName
                    }));
                  }}><option value="">Select purchase order</option>{eligiblePurchaseOrders.map((item) => <option key={item.id} value={item.code}>{item.code} · {item.supplierName} · {item.status}</option>)}</select></label>
                  <label className="detailRow"><div className="detailLabel">Supplier</div><input className="field" value={createForm.supplierName} onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Destination</div><input className="field" value={createForm.destinationName} onChange={(event) => setCreateForm((current) => ({ ...current, destinationName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Destination type</div><input className="field" value={createForm.destinationType} onChange={(event) => setCreateForm((current) => ({ ...current, destinationType: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">ETA</div><input className="field" type="date" value={createForm.etaDate} onChange={(event) => setCreateForm((current) => ({ ...current, etaDate: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Ordered units</div><input className="field" type="number" min="0" value={createForm.orderedUnits} onChange={(event) => setCreateForm((current) => ({ ...current, orderedUnits: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Received units</div><input className="field" type="number" min="0" value={createForm.receivedUnits} onChange={(event) => setCreateForm((current) => ({ ...current, receivedUnits: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Pending evidence</div><input className="field" type="number" min="0" value={createForm.pendingEvidence} onChange={(event) => setCreateForm((current) => ({ ...current, pendingEvidence: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Rejected units</div><input className="field" type="number" min="0" value={createForm.rejectedUnits} onChange={(event) => setCreateForm((current) => ({ ...current, rejectedUnits: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isSaving} onClick={() => void handleCreateReceipt()}>{isSaving ? "Saving..." : "Add receipt"}</button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Receipt creation rules" description="Inbound receipts only start from purchase orders already in operational execution.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Purchase order gate</div><div>Only purchase orders in `confirmed`, `in_transit` or `partial` posture can open a receipt.</div></div>
                  <div className="detailRow"><div className="detailLabel">Operational counts</div><div>Ordered units must be greater than zero; evidence and rejected units cannot be negative.</div></div>
                  <div className="detailRow"><div className="detailLabel">Close discipline</div><div>Receipts still cannot close while evidence, rejected units, variance or fiscal risk remain open.</div></div>
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Receiving unavailable"
            description={error ?? "The inventory receiving board could not be loaded from the current backend source."}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}

export default function InventoryReceivingPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Inventory receiving" eyebrow="Warehouse execution" description="Loading receiving context...">
          <section className="grid cols1">
            <Card title="Loading" description="Receiving context is being prepared.">
              <p className="sectionText">Preparing receiving context.</p>
            </Card>
          </section>
        </AppShell>
      }
    >
      <InventoryReceivingPageContent />
    </Suspense>
  );
}
