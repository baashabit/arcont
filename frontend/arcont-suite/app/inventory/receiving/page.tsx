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

function createReceivingExample(purchaseReference?: string, supplierName?: string) {
  return {
    supplierName: supplierName || "Concretos del Sureste",
    destinationName: "Frente urbanizacion norte",
    destinationType: "jobsite",
    purchaseReference: purchaseReference || "PO-7821",
    etaDate: "2026-07-30",
    orderedUnits: "180",
    receivedUnits: "0",
    pendingEvidence: "3",
    rejectedUnits: "0",
    nextAction: "Confirmar arribo, descarga y evidencia fotografica antes de liberar el ingreso a almacen o frente"
  };
}

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

function buildReceiptWhyNow(receipt: InventoryReceiptContract | null) {
  if (!receipt) {
    return "Choose a receipt to understand why warehouse should intervene right now.";
  }

  if (receipt.status === "blocked") {
    return `${receipt.code} is blocked, so this is the last point to contain inbound disruption before it becomes field shortage or supplier conflict.`;
  }

  if (receipt.invoiceMatchStatus === "risk") {
    return `${receipt.code} already carries fiscal mismatch pressure, so receiving discipline now protects both stock acceptance and downstream AP flow.`;
  }

  if (receipt.varianceUnits !== 0 || receipt.pendingEvidence > 0) {
    return `${receipt.code} still has quantity or evidence gaps, so the team should resolve them now before this inbound lane becomes fake inventory certainty.`;
  }

  if (receipt.status === "in_transit") {
    return `${receipt.code} is already moving physically, so a delayed warehouse decision now affects unload timing and destination crew planning immediately.`;
  }

  return `${receipt.code} is the active acceptance point for this material flow, so warehouse should stabilize it before it disappears into movements or field usage.`;
}

function buildReceiptDownstreamEffect(receipt: InventoryReceiptContract | null) {
  if (!receipt) {
    return "Select a receipt to inspect which downstream domains depend on it.";
  }

  if (receipt.status === "received" && receipt.pendingEvidence === 0 && receipt.varianceUnits === 0) {
    return "What happens here now affects inventory movements, field consumption and AP traceability because the receipt is already clean enough to release downstream.";
  }

  if (receipt.invoiceMatchStatus === "risk") {
    return "If the warehouse closes this badly, AP and treasury inherit a fiscal problem tied to a receipt that never became truly clean.";
  }

  if (receipt.purchaseOrderStatus === "blocked") {
    return "The downstream effect is cross-domain friction: procurement, supplier-control and warehouse all keep working around the same unresolved commercial issue.";
  }

  return "This receipt still controls whether movements, field support and invoice matching will continue with real evidence or with operational ambiguity.";
}

function buildReceiptReportBack(receipt: InventoryReceiptContract | null) {
  if (!receipt) {
    return "Choose a receipt to define when the receiving owner should report back.";
  }

  if (receipt.status === "blocked") {
    return "Report back only with blocker owner, containment action and the date to resume unload or acceptance.";
  }

  if (receipt.pendingEvidence > 0) {
    return "Report back in the same operating cycle once pending evidence is complete and attached to the receipt.";
  }

  if (receipt.varianceUnits !== 0 || receipt.rejectedUnits > 0) {
    return "Report back when variance, rejects and commercial disposition are fully agreed with procurement and destination owner.";
  }

  if (receipt.status === "in_transit") {
    return "Report back when the unload actually happens or when ETA slips enough to affect destination planning.";
  }

  return "Report back when the receipt is cleanly accepted and ready to continue into movements or field consumption.";
}

function buildReceiptHumanStep(receipt: InventoryReceiptContract | null) {
  if (!receipt) {
    return "Select a receipt to see the next human move.";
  }

  if (receipt.status === "blocked") {
    return "Escalate the blocker now and do not let the destination team assume this inbound flow is still healthy.";
  }

  if (receipt.status === "draft") {
    return "Release the inbound flow into transit only after the destination and unload owner are confirmed.";
  }

  if (receipt.pendingEvidence > 0) {
    return "Assign the missing evidence immediately before anyone treats this receipt as operationally closed.";
  }

  if (receipt.varianceUnits !== 0 || receipt.rejectedUnits > 0) {
    return "Resolve count discrepancy and reject disposition before releasing material into stock or field use.";
  }

  if (receipt.invoiceMatchStatus === "risk") {
    return "Coordinate with procurement and AP now so receipt closure does not hide a fiscal mismatch.";
  }

  return "Finish clean acceptance and continue directly into movements or field delivery without rebuilding receipt context.";
}

function buildReceiptRouteSummary(receipt: InventoryReceiptContract | null) {
  if (!receipt) {
    return "Use receiving as the acceptance lane between purchase orders, warehouse traceability, movements and AP readiness.";
  }

  if (receipt.status === "blocked") {
    return "This receipt should route first through containment and variance resolution before warehouse or field continue depending on it.";
  }

  if (receipt.invoiceMatchStatus === "risk") {
    return "This receipt should route through procurement and AP cleanup before anyone treats the inbound flow as financially clean.";
  }

  if (receipt.varianceUnits !== 0 || receipt.pendingEvidence > 0) {
    return "This receipt should route through evidence and quantity reconciliation before it opens downstream movements or field usage.";
  }

  if (receipt.status === "in_transit") {
    return "This receipt should route through unload and acceptance readiness before the destination crew assumes material is effectively available.";
  }

  return "This receipt can continue through movements, field consumption and AP traceability with the current context intact.";
}

function buildReceiptOperationalLinks(receipt: InventoryReceiptContract | null) {
  if (!receipt) {
    return [
      { label: "Open purchase orders", href: "/procurement/purchase-orders" },
      { label: "Open movement", href: "/inventory/movements" },
      { label: "Open accounts payable", href: "/accounts-payable" }
    ];
  }

  if (receipt.status === "blocked") {
    return [
      { label: "Open purchase orders", href: "/procurement/purchase-orders" },
      { label: "Open supplier control", href: "/supplier-control" },
      { label: "Open accounts payable", href: "/accounts-payable" }
    ];
  }

  if (receipt.invoiceMatchStatus === "risk") {
    return [
      { label: "Open accounts payable", href: "/accounts-payable" },
      { label: "Open purchase orders", href: "/procurement/purchase-orders" },
      { label: "Open supplier control", href: "/supplier-control" }
    ];
  }

  return [
    { label: "Open movement", href: "/inventory/movements" },
    { label: "Open purchase orders", href: "/procurement/purchase-orders" },
    { label: "Open accounts payable", href: "/accounts-payable" }
  ];
}

function buildReceiptAcceptanceGate(receipt: InventoryReceiptContract | null) {
  if (!receipt) {
    return {
      tone: "info" as const,
      label: "No receipt selected",
      summary: "Choose an inbound receipt to verify whether it can really be accepted and released downstream.",
      checks: ["Select a receipt from the current inbound board."]
    };
  }

  const checks: string[] = [];

  if (receipt.status === "blocked") {
    checks.push("Receipt is already blocked and cannot move into clean stock acceptance.");
  }

  if (receipt.pendingEvidence > 0) {
    checks.push(`${receipt.pendingEvidence} evidence item(s) are still missing before closure.`);
  }

  if (receipt.rejectedUnits > 0) {
    checks.push(`${receipt.rejectedUnits} rejected unit(s) still need containment or return handling.`);
  }

  if (receipt.varianceUnits !== 0) {
    checks.push(`${receipt.varianceUnits} unit variance remains open against the ordered quantity.`);
  }

  if (receipt.purchaseOrderStatus === "blocked") {
    checks.push("Linked purchase order posture is blocked.");
  }

  if (receipt.invoiceMatchStatus === "risk") {
    checks.push("Invoice match is still at fiscal risk.");
  }

  if (checks.length > 0) {
    return {
      tone:
        receipt.status === "blocked" || receipt.purchaseOrderStatus === "blocked" || receipt.invoiceMatchStatus === "risk"
          ? "danger" as const
          : "warning" as const,
      label:
        receipt.status === "blocked" || receipt.purchaseOrderStatus === "blocked" || receipt.invoiceMatchStatus === "risk"
          ? "Do not receive yet"
          : "Receive with control",
      summary:
        receipt.status === "blocked" || receipt.purchaseOrderStatus === "blocked" || receipt.invoiceMatchStatus === "risk"
          ? "The inbound flow still has hard blockers before it should be treated as accepted."
          : "The inbound flow can continue, but warehouse and commercial checks still need closure first.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for clean acceptance",
    summary: "Counts, evidence and commercial posture are currently aligned for downstream release.",
    checks: [
      "Confirm the receiving destination is ready to consume or store the material.",
      "Continue into movements or field support without rewriting the same receipt context."
    ]
  };
}

function buildCreateReceiptGate(input: {
  supplierName: string;
  destinationName: string;
  destinationType: string;
  purchaseReference: string;
  etaDate: string;
  orderedUnits: number;
  receivedUnits: number;
  pendingEvidence: number;
  rejectedUnits: number;
  nextAction: string;
  linkedOrderExists: boolean;
}) {
  const checks: string[] = [];

  if ([input.supplierName, input.destinationName, input.destinationType, input.purchaseReference].some((value) => value.trim().length < 3)) {
    checks.push("Supplier, destination and purchase reference still need more specific capture.");
  }

  if (!input.linkedOrderExists) {
    checks.push("The selected purchase order is no longer eligible to open a receipt.");
  }

  if (!input.etaDate) {
    checks.push("ETA date is still missing.");
  }

  if (!Number.isFinite(input.orderedUnits) || input.orderedUnits <= 0) {
    checks.push("Ordered units must be greater than zero.");
  }

  if (!Number.isFinite(input.receivedUnits) || input.receivedUnits < 0) {
    checks.push("Received units must be zero or greater.");
  }

  if (input.receivedUnits > input.orderedUnits) {
    checks.push("Received units still exceed ordered units.");
  }

  if (!Number.isFinite(input.pendingEvidence) || input.pendingEvidence < 0) {
    checks.push("Pending evidence must be zero or greater.");
  }

  if (!Number.isFinite(input.rejectedUnits) || input.rejectedUnits < 0) {
    checks.push("Rejected units must be zero or greater.");
  }

  if (input.rejectedUnits > input.receivedUnits) {
    checks.push("Rejected units cannot exceed received units.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for warehouse follow-through.");
  }

  if (checks.length > 0) {
    const hardBlock =
      !input.linkedOrderExists ||
      !input.etaDate ||
      !Number.isFinite(input.orderedUnits) ||
      input.orderedUnits <= 0 ||
      input.receivedUnits > input.orderedUnits;

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This inbound receipt would enter the warehouse lane with a hard execution blocker."
        : "The receipt can be created, but evidence or quantity discipline still needs tightening.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The inbound receipt has enough structure to enter warehouse execution cleanly.",
    checks: [
      "The created receipt will become the current focus item immediately.",
      "Keep PO, destination and next action attached from the first inbound capture."
    ]
  };
}

function buildCreateReceiptHumanStep(input: {
  etaDate: string;
  nextAction: string;
  linkedOrderExists: boolean;
  pendingEvidence: number;
}) {
  if (!input.linkedOrderExists) {
    return "Reconfirm the purchase order first so the receipt stays anchored to a valid procurement flow.";
  }

  if (!input.etaDate) {
    return "Set the inbound ETA before creating the receipt so the destination crew can prepare the slot.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the unload and evidence step before persisting the inbound receipt.";
  }

  if (input.pendingEvidence > 0) {
    return "Create the receipt and immediately assign who closes the pending evidence at destination.";
  }

  return "Create the receipt and continue directly into movement planning or clean warehouse acceptance.";
}

function InventoryReceivingPageContent() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
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
  const createFormNumbers = useMemo(
    () => ({
      orderedUnits: Number(createForm.orderedUnits),
      receivedUnits: Number(createForm.receivedUnits),
      pendingEvidence: Number(createForm.pendingEvidence),
      rejectedUnits: Number(createForm.rejectedUnits)
    }),
    [createForm.orderedUnits, createForm.pendingEvidence, createForm.receivedUnits, createForm.rejectedUnits]
  );
  const purchaseReferenceParam = searchParams.get("purchaseReference")?.trim() ?? "";
  const supplierNameParam = searchParams.get("supplierName")?.trim() ?? "";

  useEffect(() => {
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  const eligiblePurchaseOrders = useMemo(
    () =>
      bridgeContext?.purchaseOrders.purchaseOrders.filter((item) => ["confirmed", "in_transit", "partial"].includes(item.status)) ?? [],
    [bridgeContext]
  );
  const createReceiptLinkedOrder = useMemo(
    () => eligiblePurchaseOrders.find((item) => item.code === createForm.purchaseReference) ?? null,
    [createForm.purchaseReference, eligiblePurchaseOrders]
  );
  const createReceiptGate = useMemo(
    () =>
      buildCreateReceiptGate({
        supplierName: createForm.supplierName,
        destinationName: createForm.destinationName,
        destinationType: createForm.destinationType,
        purchaseReference: createForm.purchaseReference,
        etaDate: createForm.etaDate,
        orderedUnits: createFormNumbers.orderedUnits,
        receivedUnits: createFormNumbers.receivedUnits,
        pendingEvidence: createFormNumbers.pendingEvidence,
        rejectedUnits: createFormNumbers.rejectedUnits,
        nextAction: createForm.nextAction,
        linkedOrderExists: Boolean(createReceiptLinkedOrder)
      }),
    [createForm, createFormNumbers, createReceiptLinkedOrder]
  );
  const createReceiptHumanStep = useMemo(
    () =>
      buildCreateReceiptHumanStep({
        etaDate: createForm.etaDate,
        nextAction: createForm.nextAction,
        linkedOrderExists: Boolean(createReceiptLinkedOrder),
        pendingEvidence: createFormNumbers.pendingEvidence
      }),
    [createForm.etaDate, createForm.nextAction, createFormNumbers.pendingEvidence, createReceiptLinkedOrder]
  );
  const filteredReceipts = useMemo(() => {
    if (!overview) {
      return [];
    }

    return overview.receipts.filter((receipt) => {
      const matchesPurchaseReference = !purchaseReferenceParam || receipt.purchaseReference === purchaseReferenceParam;
      const matchesSupplierName =
        !supplierNameParam || receipt.supplierName.toLowerCase().includes(supplierNameParam.toLowerCase());

      return matchesPurchaseReference && matchesSupplierName;
    });
  }, [overview, purchaseReferenceParam, supplierNameParam]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredReceipts), [filteredReceipts]);

  const selectedReceipt = useMemo(
    () => filteredReceipts.find((item) => item.id === selectedReceiptId) ?? filteredReceipts[0] ?? null,
    [filteredReceipts, selectedReceiptId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.receiptId === selectedReceipt?.id) ?? [],
    [overview, selectedReceipt]
  );

  const receiptActions = useMemo(() => (selectedReceipt ? actionOptions(selectedReceipt) : []), [selectedReceipt]);

  const selectedStory = useMemo(() => buildReceivingStory(selectedReceipt, bridgeContext), [bridgeContext, selectedReceipt]);
  const acceptanceGate = useMemo(() => buildReceiptAcceptanceGate(selectedReceipt), [selectedReceipt]);
  const receiptWhyNow = useMemo(() => buildReceiptWhyNow(selectedReceipt), [selectedReceipt]);
  const receiptDownstreamEffect = useMemo(() => buildReceiptDownstreamEffect(selectedReceipt), [selectedReceipt]);
  const receiptReportBack = useMemo(() => buildReceiptReportBack(selectedReceipt), [selectedReceipt]);
  const receiptHumanStep = useMemo(() => buildReceiptHumanStep(selectedReceipt), [selectedReceipt]);
  const receiptRouteSummary = useMemo(() => buildReceiptRouteSummary(selectedReceipt), [selectedReceipt]);
  const receiptOperationalLinks = useMemo(() => buildReceiptOperationalLinks(selectedReceipt), [selectedReceipt]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredReceipts.length === 0) {
      setSelectedReceiptId(null);
      return;
    }

    const isSelectedVisible = filteredReceipts.some((item) => item.id === selectedReceiptId);
    if (!isSelectedVisible) {
      setSelectedReceiptId(filteredReceipts[0]?.id ?? null);
    }
  }, [filteredReceipts, overview, selectedReceiptId]);

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
    if (!selectedReceipt) {
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
    if (!overview) {
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

    if (!linkedOrder && !isDemoMode) {
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
                value={String(filteredSummary.openReceipts)}
                footnote="Inbound receipts not yet fully accepted into stock."
              />
              <KpiCard
                label="Overdue ETA"
                value={String(filteredSummary.overdueEta)}
                footnote="Receipts already late against their expected arrival window."
              />
              <KpiCard
                label="Variance units"
                value={String(filteredSummary.quantityVarianceUnits)}
                footnote="Absolute quantity gap still open across the current receipt board."
              />
              <KpiCard
                label="Pending evidence"
                value={String(filteredSummary.pendingEvidence)}
                footnote="Missing evidence items before receipts can be cleanly closed."
              />
              <KpiCard
                label="Commercial risk"
                value={String(filteredSummary.receiptsAtCommercialRisk)}
                footnote="Receipts tied to blocked purchase orders or fiscal packet risk."
              />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Receiving can be tested locally even before procurement, auth and warehouse integrations are fully live."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Create inbound receipts, move them across transit and blockage states, and validate operational constraints from one board.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Open a receipt for a supplier, simulate warehouse friction, then clear it once evidence and quantity variance are aligned.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols3">
              <Card
                title="Receiving workflow"
                description="Inbound receiving should connect procurement, warehouse acceptance and downstream material flow in one operable lane."
                aside={<Badge tone={filteredSummary.blockedReceipts > 0 ? "danger" : filteredSummary.overdueEta > 0 ? "warning" : "success"}>{filteredSummary.blockedReceipts > 0 ? "blocked lane" : filteredSummary.overdueEta > 0 ? "eta watch" : "stable lane"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Upstream</div><div>Receipt creation should start from a real PO already moving through procurement execution.</div></div>
                  <div className="detailRow"><div className="detailLabel">Warehouse step</div><div>Counts, rejects and evidence decide whether the inbound flow is usable or still risky.</div></div>
                  <div className="detailRow"><div className="detailLabel">Downstream</div><div>Once received cleanly, the material should continue into movements, equipment support or field execution without retyping context.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/procurement/purchase-orders">Open purchase orders</Link>
                  <Link className="buttonGhost" href="/inventory/movements">Open movements</Link>
                  <Link className="buttonGhost" href="/equipment">Open equipment</Link>
                </div>
              </Card>

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
                <FilterBar summary={`${filteredReceipts.length} inbound receipts in the active tenant`}>
                  {purchaseReferenceParam ? <Badge tone="info">{purchaseReferenceParam}</Badge> : null}
                  {supplierNameParam ? <Badge tone="info">{supplierNameParam}</Badge> : null}
                  {purchaseReferenceParam || supplierNameParam ? (
                    <Link className="buttonGhost" href="/inventory/receiving">
                      Clear context
                    </Link>
                  ) : null}
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "receiving ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredReceipts}
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
                      <Link className="buttonGhost" href="/equipment">
                        Open equipment
                      </Link>
                      <Link className="buttonGhost" href="/field">
                        Open field
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
                      <div className="detailRow">
                        <div className="detailLabel">Acceptance gate</div>
                        <div className="tableCellStack">
                          <Badge tone={acceptanceGate.tone}>{acceptanceGate.label}</Badge>
                          <span className="tableCellMuted">{acceptanceGate.summary}</span>
                          {acceptanceGate.checks.map((check) => (
                            <span key={check} className="tableCellMuted">
                              {check}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Why now</div>
                        <div>{receiptWhyNow}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Downstream effect</div>
                        <div>{receiptDownstreamEffect}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Route summary</div>
                        <div>{receiptRouteSummary}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Next human step</div>
                        <div>{receiptHumanStep}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Report back</div>
                        <div>{receiptReportBack}</div>
                      </div>
                    </div>

                    <div className="row gap wrap">
                      {receiptOperationalLinks.map((link, index) => (
                        <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                          {link.label}
                        </Link>
                      ))}
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
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createReceiptGate.tone}>{createReceiptGate.label}</Badge>
                        <span>{createReceiptGate.summary}</span>
                      </div>
                      {createReceiptGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{createReceiptHumanStep}</div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isSaving} onClick={() => void handleCreateReceipt()}>{isSaving ? "Saving..." : "Add receipt"}</button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm(
                        createReceivingExample(
                          purchaseReferenceParam || eligiblePurchaseOrders[0]?.code,
                          supplierNameParam || eligiblePurchaseOrders[0]?.supplierName
                        )
                      )
                    }
                  >
                    Load demo example
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm(
                        createReceivingExample(
                          purchaseReferenceParam || eligiblePurchaseOrders[0]?.code,
                          supplierNameParam || eligiblePurchaseOrders[0]?.supplierName
                        )
                      )
                    }
                  >
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/procurement/purchase-orders">Review PO</Link>
                  <Link className="buttonGhost" href="/inventory/movements">Review movements</Link>
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
            primaryAction={{ label: "Open purchase orders", href: "/procurement/purchase-orders" }}
            secondaryAction={{ label: "Open movements", href: "/inventory/movements" }}
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
