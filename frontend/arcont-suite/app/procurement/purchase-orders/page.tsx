"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import type { ProcurementPurchaseOrderContract, ProcurementPurchaseOrdersOverviewContract } from "@/lib/contracts";
import {
  createProcurementPurchaseOrder,
  fetchInventoryReceivingOverview,
  fetchProcurementPurchaseOrdersOverview,
  fetchProcurementRequisitionsOverview,
  fetchSupplierControlOverview,
  updateProcurementPurchaseOrder
} from "@/lib/platform-api";

function statusTone(status: ProcurementPurchaseOrderContract["status"]) {
  switch (status) {
    case "received":
      return "success";
    case "blocked":
      return "danger";
    case "partial":
      return "warning";
    case "in_transit":
      return "info";
    default:
      return "gold";
  }
}

function invoiceTone(status: ProcurementPurchaseOrderContract["invoiceMatchStatus"]) {
  switch (status) {
    case "matched":
      return "success";
    case "risk":
      return "danger";
    default:
      return "warning";
  }
}

function purchaseOrderActionOptions(purchaseOrder: ProcurementPurchaseOrderContract) {
  switch (purchaseOrder.status) {
    case "issued":
      return [
        {
          label: "Confirm order",
          status: "confirmed" as const,
          nextAction: "Confirm supplier acceptance, fiscal packet and dispatch window before field mobilization."
        },
        {
          label: "Block order",
          status: "blocked" as const,
          nextAction: "Pause this order until the commercial or technical blocker is resolved."
        }
      ];
    case "confirmed":
      return [
        {
          label: "Move to transit",
          status: "in_transit" as const,
          nextAction: "Release shipment and track the logistics sequence against the committed ETA."
        },
        {
          label: "Block order",
          status: "blocked" as const,
          nextAction: "Hold the order because supplier readiness or documentation is no longer stable."
        }
      ];
    case "in_transit":
      return [
        {
          label: "Mark partial receipt",
          status: "partial" as const,
          nextAction: "Capture partial receipt evidence and keep the remaining balance under active logistics follow-up."
        },
        {
          label: "Mark received",
          status: "received" as const,
          nextAction: "Close the receipt once the full order and invoice evidence are complete."
        },
        {
          label: "Block order",
          status: "blocked" as const,
          nextAction: "Escalate the logistics issue and stop field expectations until the route is stabilized."
        }
      ];
    case "partial":
      return [
        {
          label: "Mark received",
          status: "received" as const,
          nextAction: "Close the order after receiving the remaining quantity and matching invoice support."
        },
        {
          label: "Block order",
          status: "blocked" as const,
          nextAction: "Freeze the order until the remaining quantity or variance is clarified."
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume confirmed",
          status: "confirmed" as const,
          nextAction: "Resume the order after clearing the blocker and confirming supplier commitment again."
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(purchaseOrders: ProcurementPurchaseOrderContract[]) {
  return {
    openOrders: purchaseOrders.filter((item) => item.status !== "received").length,
    inTransitOrders: purchaseOrders.filter((item) => item.status === "in_transit" || item.status === "partial").length,
    blockedOrders: purchaseOrders.filter((item) => item.status === "blocked").length,
    pendingInvoiceMatch: purchaseOrders.filter((item) => item.invoiceMatchStatus !== "matched").length,
    averageReceivedPercent:
      purchaseOrders.length > 0
        ? Number((purchaseOrders.reduce((sum, item) => sum + item.receivedPercent, 0) / purchaseOrders.length).toFixed(1))
        : 0
  };
}

function pickFocusPurchaseOrder(purchaseOrders: ProcurementPurchaseOrderContract[]) {
  return (
    purchaseOrders
      .filter((item) => item.status !== "received")
      .slice()
      .sort((left, right) => {
        if (left.status === "blocked" && right.status !== "blocked") {
          return -1;
        }
        if (left.status !== "blocked" && right.status === "blocked") {
          return 1;
        }
        if (left.invoiceMatchStatus === "risk" && right.invoiceMatchStatus !== "risk") {
          return -1;
        }
        if (left.invoiceMatchStatus !== "risk" && right.invoiceMatchStatus === "risk") {
          return 1;
        }
        return right.totalAmount - left.totalAmount;
      })[0] ?? null
  );
}

type PurchaseOrderBridgeContext = {
  receiving: NonNullable<Awaited<ReturnType<typeof fetchInventoryReceivingOverview>>>;
  supplierControl: NonNullable<Awaited<ReturnType<typeof fetchSupplierControlOverview>>>;
  requisitions: NonNullable<Awaited<ReturnType<typeof fetchProcurementRequisitionsOverview>>>;
} | null;

function buildPurchaseOrderStory(order: ProcurementPurchaseOrderContract | null, bridge: PurchaseOrderBridgeContext) {
  if (!order) {
    return null;
  }

  const linkedReceipts = bridge?.receiving.receipts.filter((item) => item.purchaseReference === order.code) ?? [];
  const receiptSignal = linkedReceipts[0] ?? bridge?.receiving.focusReceipt ?? null;
  const supplierSignal = bridge?.supplierControl.focusLine ?? null;
  const pendingEvidence = linkedReceipts.reduce((sum, item) => sum + item.pendingEvidence, 0);
  const openVariance = linkedReceipts.reduce((sum, item) => sum + Math.abs(item.varianceUnits), 0);

  return {
    supplierDependency: supplierSignal
      ? `${supplierSignal.supplierName} is the current supplier anchor with ${supplierSignal.deliveryHealth} health and ${supplierSignal.concentrationPercent}% concentration.`
      : "No supplier-control anchor is currently visible for this order lane.",
    receivingExposure: receiptSignal
      ? `${linkedReceipts.length} linked receipt(s) carry ${openVariance} units of variance and ${pendingEvidence} evidence items still pending for ${order.code}.`
      : "No inbound receiving exposure is currently in focus for this order.",
    executionPressure:
      order.status === "blocked"
        ? `${order.projectName} is already exposed because ${order.code} is blocked at supplier or logistics level.`
        : order.invoiceMatchStatus === "risk"
          ? `${order.code} still carries fiscal pressure that can destabilize receipt and closeout timing.`
          : `${order.code} is currently supporting execution under a controlled procurement posture.`
  };
}

export default function ProcurementPurchaseOrdersPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ProcurementPurchaseOrdersOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<PurchaseOrderBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    requisitionId: "",
    supplierName: "Proveedor Estrategico",
    buyer: "Procurement lead",
    totalAmount: "150000",
    committedEta: "2026-07-20",
    logisticsMode: "Direct to jobsite",
    nextAction: ""
  });

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchProcurementPurchaseOrdersOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchInventoryReceivingOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchSupplierControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchProcurementRequisitionsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, receiving, supplierControl, requisitions]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Procurement purchase orders overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedPurchaseOrderId(
          (current) => current ?? result.focusPurchaseOrder?.id ?? result.purchaseOrders[0]?.id ?? null
        );
        setBridgeContext(receiving && supplierControl && requisitions ? { receiving, supplierControl, requisitions } : null);
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

  const selectedPurchaseOrder = useMemo(
    () =>
      overview?.purchaseOrders.find((item) => item.id === selectedPurchaseOrderId) ?? overview?.focusPurchaseOrder ?? null,
    [overview, selectedPurchaseOrderId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.purchaseOrderId === selectedPurchaseOrder?.id) ?? [],
    [overview, selectedPurchaseOrder]
  );

  const actionOptions = useMemo(
    () => (selectedPurchaseOrder ? purchaseOrderActionOptions(selectedPurchaseOrder) : []),
    [selectedPurchaseOrder]
  );

  const selectedStory = useMemo(
    () => buildPurchaseOrderStory(selectedPurchaseOrder, bridgeContext),
    [bridgeContext, selectedPurchaseOrder]
  );
  const linkedReceipts = useMemo(
    () =>
      selectedPurchaseOrder
        ? bridgeContext?.receiving.receipts.filter((item) => item.purchaseReference === selectedPurchaseOrder.code) ?? []
        : [],
    [bridgeContext, selectedPurchaseOrder]
  );
  const selectedFieldOrigin = useMemo(() => {
    if (!selectedPurchaseOrder || !bridgeContext) {
      return null;
    }

    const requisition = bridgeContext.requisitions.requisitions.find(
      (item) => item.code === selectedPurchaseOrder.requisitionCode
    );

    if (!requisition) {
      return null;
    }

    return bridgeContext.requisitions.origins.find((item) => item.requisitionId === requisition.id) ?? null;
  }, [bridgeContext, selectedPurchaseOrder]);
  const eligibleRequisitions = useMemo(
    () =>
      bridgeContext?.requisitions.requisitions.filter((item) => item.status === "approved" || item.status === "sourcing") ?? [],
    [bridgeContext]
  );

  useEffect(() => {
    setNextActionDraft(selectedPurchaseOrder?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedPurchaseOrderId, selectedPurchaseOrder?.id, selectedPurchaseOrder?.nextAction]);

  useEffect(() => {
    if (createForm.requisitionId || eligibleRequisitions.length === 0) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      requisitionId: eligibleRequisitions[0]?.id ?? ""
    }));
  }, [createForm.requisitionId, eligibleRequisitions]);

  async function handleAction(status: ProcurementPurchaseOrderContract["status"], suggestedNextAction: string) {
    if (!selectedPurchaseOrder || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the purchase order.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateProcurementPurchaseOrder(
      selectedPurchaseOrder.id,
      activeCompany.id,
      { status, nextAction },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Purchase order update failed.");
      setIsSaving(false);
      return;
    }

    const updatedPurchaseOrder = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const purchaseOrders = current.purchaseOrders.map((item) =>
        item.id === updatedPurchaseOrder.id ? updatedPurchaseOrder : item
      );

      return {
        ...current,
        summary: recomputeSummary(purchaseOrders),
        purchaseOrders,
        focusPurchaseOrder: pickFocusPurchaseOrder(purchaseOrders)
      };
    });

    setNextActionDraft(updatedPurchaseOrder.nextAction);
    setActionMessage(`Purchase order moved to ${updatedPurchaseOrder.status}.`);
    setIsSaving(false);
  }

  async function handleCreatePurchaseOrder() {
    if (!overview || !session.accessToken) {
      return;
    }

    const supplierName = createForm.supplierName.trim();
    const buyer = createForm.buyer.trim();
    const logisticsMode = createForm.logisticsMode.trim();
    const nextAction = createForm.nextAction.trim();
    const totalAmount = Number(createForm.totalAmount);

    if (!createForm.requisitionId || supplierName.length < 3 || buyer.length < 3 || logisticsMode.length < 3) {
      setActionError("Requisition, supplier, buyer and logistics mode must be defined before opening a purchase order.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be specific before opening the purchase order.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setActionError("Total amount must be greater than zero before opening a purchase order.");
      setCreateMessage(null);
      return;
    }

    if (!createForm.committedEta) {
      setActionError("Committed ETA is required before opening a purchase order.");
      setCreateMessage(null);
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createProcurementPurchaseOrder(
      activeCompany.id,
      {
        requisitionId: createForm.requisitionId,
        supplierName,
        buyer,
        totalAmount,
        committedEta: createForm.committedEta,
        logisticsMode,
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Purchase order creation failed.");
      setIsSaving(false);
      return;
    }

    const createdPurchaseOrder = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const purchaseOrders = [createdPurchaseOrder, ...current.purchaseOrders];
      return {
        ...current,
        summary: recomputeSummary(purchaseOrders),
        purchaseOrders,
        focusPurchaseOrder: pickFocusPurchaseOrder(purchaseOrders)
      };
    });

    setSelectedPurchaseOrderId(createdPurchaseOrder.id);
    setNextActionDraft(createdPurchaseOrder.nextAction);
    setCreateMessage(`${createdPurchaseOrder.code} opened from requisition ${createdPurchaseOrder.requisitionCode}.`);
    setCreateForm((current) => ({
      ...current,
      supplierName,
      buyer,
      totalAmount: "150000",
      committedEta: "2026-07-20",
      logisticsMode,
      nextAction: ""
    }));
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Procurement purchase orders"
      eyebrow="Execution domain"
      description="Supplier commitment, transit, receipt readiness and invoice matching in one operational board."
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title="Purchase orders">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Open orders" value={String(overview.summary.openOrders)} footnote="Orders still not fully received." />
              <KpiCard label="In transit" value={String(overview.summary.inTransitOrders)} footnote="Orders actively moving through logistics or partial receipt." />
              <KpiCard label="Blocked orders" value={String(overview.summary.blockedOrders)} footnote="Orders stopped by commercial, fiscal or execution issues." />
              <KpiCard label="Receipt progress" value={`${overview.summary.averageReceivedPercent}%`} footnote="Average receipt completion across current orders." />
            </section>

            <section className="grid cols3">
              <Card title="Supplier dependency" description="Supplier-control signal tied to the selected order.">
                <p className="sectionText">
                  {selectedStory?.supplierDependency ?? "Choose an order to inspect supplier dependency."}
                </p>
              </Card>
              <Card title="Receiving exposure" description="Inbound exposure still attached to this procurement lane.">
                <p className="sectionText">
                  {selectedStory?.receivingExposure ?? "Choose an order to inspect receiving exposure."}
                </p>
              </Card>
              <Card title="Execution pressure" description="Fast read of how this order is affecting real project flow.">
                <p className="sectionText">
                  {selectedStory?.executionPressure ?? "Choose an order to inspect execution pressure."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Purchase order board" description="Supplier execution, ETA control and fiscal matching across the active tenant.">
                <FilterBar summary={`${overview.purchaseOrders.length} purchase orders in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "purchase orders ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.purchaseOrders}
                  columns={[
                    {
                      key: "code",
                      label: "Order",
                      render: (row) => (
                        <button className="buttonGhost" type="button" onClick={() => setSelectedPurchaseOrderId(row.id)}>
                          {row.code}
                        </button>
                      )
                    },
                    { key: "project", label: "Project", render: (row) => row.projectName },
                    { key: "supplier", label: "Supplier", render: (row) => row.supplierName },
                    { key: "eta", label: "ETA", render: (row) => row.committedEta },
                    { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> }
                  ]}
                />
              </Card>

              <Card
                title={selectedPurchaseOrder ? selectedPurchaseOrder.code : "Select a purchase order"}
                description={
                  selectedPurchaseOrder
                    ? `${selectedPurchaseOrder.projectName} · ${selectedPurchaseOrder.supplierName} · ${selectedPurchaseOrder.category}`
                    : "Review the selected order and decide the next procurement execution move."
                }
              >
                {selectedPurchaseOrder ? (
                  <div className="stack">
                    <div className="grid cols2">
                      <KpiCard
                        label="Amount / receipt"
                        value={`MXN ${selectedPurchaseOrder.totalAmount.toLocaleString()}`}
                        footnote={`${selectedPurchaseOrder.receivedPercent}% received`}
                      />
                      <KpiCard
                        label="Route / invoice"
                        value={selectedPurchaseOrder.logisticsMode}
                        footnote={`${selectedPurchaseOrder.invoiceMatchStatus} invoice match`}
                      />
                    </div>

                    <div className="row gap wrap">
                      <Badge tone={statusTone(selectedPurchaseOrder.status)}>{selectedPurchaseOrder.status}</Badge>
                      <Badge tone={invoiceTone(selectedPurchaseOrder.invoiceMatchStatus)}>
                        {selectedPurchaseOrder.invoiceMatchStatus}
                      </Badge>
                      <Badge tone="info">{selectedPurchaseOrder.requisitionCode}</Badge>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="purchase-order-next-action">
                        Next action
                      </label>
                      <textarea
                        id="purchase-order-next-action"
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
                          disabled={
                            isSaving ||
                            (action.status === "received" && selectedPurchaseOrder.receivedPercent < 95) ||
                            (action.status === "received" && selectedPurchaseOrder.invoiceMatchStatus === "risk")
                          }
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {actionError ? <p className="text-danger">{actionError}</p> : null}
                    {actionMessage ? <p className="text-success">{actionMessage}</p> : null}
                    {selectedPurchaseOrder.receivedPercent < 95 ? (
                      <p className="tableCellMuted">Warehouse still reports less than 95% receipt progress for this purchase order.</p>
                    ) : null}

                    <Card title="Field origin" description="Original field pressure that triggered the requisition behind this purchase order, when available.">
                      {selectedFieldOrigin ? (
                        <div className="detailGrid">
                          <div className="detailRow">
                            <div className="detailLabel">Field request</div>
                            <div>{selectedFieldOrigin.fieldRequestId}</div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">Summary</div>
                            <div>{selectedFieldOrigin.summary}</div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">Requested volume</div>
                            <div>{selectedFieldOrigin.requestedVolume}</div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">Urgency</div>
                            <div>{selectedFieldOrigin.urgency}</div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">Field next action</div>
                            <div>{selectedFieldOrigin.nextAction}</div>
                          </div>
                        </div>
                      ) : (
                        <EmptyState
                          title="No field origin linked"
                          description="This purchase order currently comes from a procurement-only requisition or the field trace is unavailable."
                        />
                      )}
                    </Card>

                    <Card title="Purchase order risks" description="Logistics, fiscal and execution issues tied to this order.">
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
                        <EmptyState title="No active risks" description="This purchase order has no explicit risks right now." />
                      )}
                    </Card>

                    <Card title="Linked receipts" description="Inbound receipts already tied to this purchase order.">
                      {linkedReceipts.length > 0 ? (
                        <>
                          <div className="stack">
                            {linkedReceipts.map((receipt) => (
                              <div key={receipt.id} className="row space-between card-section">
                                <div>
                                  <strong>{receipt.code}</strong>
                                  <p>{receipt.destinationName} · {receipt.receivedUnits}/{receipt.orderedUnits} units</p>
                                </div>
                                <div className="tableCellStack" style={{ alignItems: "flex-end" }}>
                                  <Badge tone={receipt.status === "received" ? "success" : receipt.status === "blocked" ? "danger" : "warning"}>
                                    {receipt.status}
                                  </Badge>
                                  <span className="tableCellMuted">{receipt.pendingEvidence} evidence · {receipt.varianceUnits} variance</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="row gap wrap" style={{ marginTop: 16 }}>
                            <Link
                              className="buttonGhost"
                              href={`/inventory/receiving?purchaseReference=${encodeURIComponent(selectedPurchaseOrder.code)}&supplierName=${encodeURIComponent(selectedPurchaseOrder.supplierName)}`}
                            >
                              Open receiving
                            </Link>
                            <Link
                              className="buttonGhost"
                              href={`/inventory/movements?purchaseReference=${encodeURIComponent(selectedPurchaseOrder.code)}&upstreamReceiptCode=${encodeURIComponent(linkedReceipts[0]?.code ?? "")}`}
                            >
                              Open movement
                            </Link>
                          </div>
                        </>
                      ) : (
                        <>
                          <EmptyState title="No linked receipts yet" description="This purchase order still has no receipt opened from the warehouse side." />
                          <div className="row gap wrap" style={{ marginTop: 16 }}>
                            <Link
                              className="button"
                              href={`/inventory/receiving?purchaseReference=${encodeURIComponent(selectedPurchaseOrder.code)}&supplierName=${encodeURIComponent(selectedPurchaseOrder.supplierName)}`}
                            >
                              Create receipt
                            </Link>
                          </div>
                        </>
                      )}
                    </Card>
                  </div>
                ) : (
                  <EmptyState title="No purchase order selected" description="Choose an order from the board to review its detail." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Open purchase order"
                description="Convert an approved procurement requisition into an active supplier commitment with ETA and logistics ownership."
              >
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Requisition</div>
                    <select
                      className="selectField"
                      value={createForm.requisitionId}
                      onChange={(event) => setCreateForm((current) => ({ ...current, requisitionId: event.target.value }))}
                    >
                      <option value="">Select requisition</option>
                      {eligibleRequisitions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {item.projectName} · {item.category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Supplier</div>
                    <input
                      className="field"
                      value={createForm.supplierName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Buyer</div>
                    <input
                      className="field"
                      value={createForm.buyer}
                      onChange={(event) => setCreateForm((current) => ({ ...current, buyer: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Total amount</div>
                    <input
                      className="field"
                      type="number"
                      min="1"
                      value={createForm.totalAmount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, totalAmount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Committed ETA</div>
                    <input
                      className="field"
                      type="date"
                      value={createForm.committedEta}
                      onChange={(event) => setCreateForm((current) => ({ ...current, committedEta: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Logistics mode</div>
                    <input
                      className="field"
                      value={createForm.logisticsMode}
                      onChange={(event) => setCreateForm((current) => ({ ...current, logisticsMode: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder="Confirm supplier acceptance, dispatch plan and receiving slot"
                    />
                  </label>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" onClick={() => void handleCreatePurchaseOrder()} disabled={isSaving}>
                    Open purchase order
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card
                title="Sourcing readiness"
                description="Only approved or sourcing requisitions can open supplier commitment, keeping the procurement chain coherent."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Eligible requisitions</div>
                    <div>{eligibleRequisitions.length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Rule</div>
                    <div>A purchase order now requires an approved or sourcing requisition with supplier coverage.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Impact</div>
                    <div>Opening a PO automatically pushes the requisition into sourcing when needed.</div>
                  </div>
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Purchase orders unavailable"
            description={error ?? "The purchase orders board could not be loaded from the current backend source."}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
