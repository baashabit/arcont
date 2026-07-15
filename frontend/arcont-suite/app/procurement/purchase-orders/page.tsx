"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

function purchaseOrderStatusLabel(status: ProcurementPurchaseOrderContract["status"]) {
  switch (status) {
    case "issued":
      return { es: "Emitida", en: "Issued" };
    case "confirmed":
      return { es: "Confirmada", en: "Confirmed" };
    case "in_transit":
      return { es: "En tránsito", en: "In transit" };
    case "partial":
      return { es: "Recepción parcial", en: "Partial receipt" };
    case "blocked":
      return { es: "Bloqueada", en: "Blocked" };
    default:
      return { es: "Recibida", en: "Received" };
  }
}

function invoiceMatchLabel(status: ProcurementPurchaseOrderContract["invoiceMatchStatus"]) {
  switch (status) {
    case "matched":
      return { es: "Factura conciliada", en: "Invoice matched" };
    case "risk":
      return { es: "Riesgo fiscal", en: "Fiscal risk" };
    default:
      return { es: "Validación pendiente", en: "Pending validation" };
  }
}

function purchaseOrderActionLabel(
  purchaseOrder: ProcurementPurchaseOrderContract,
  nextStatus: ProcurementPurchaseOrderContract["status"]
) {
  if (purchaseOrder.status === "blocked" && nextStatus === "confirmed") {
    return { es: "Reactivar orden", en: "Resume order" };
  }

  switch (nextStatus) {
    case "confirmed":
      return { es: "Confirmar orden", en: "Confirm order" };
    case "in_transit":
      return { es: "Enviar a tránsito", en: "Move to transit" };
    case "partial":
      return { es: "Registrar recepción parcial", en: "Mark partial receipt" };
    case "received":
      return { es: "Marcar recibida", en: "Mark received" };
    case "blocked":
      return { es: "Bloquear orden", en: "Block order" };
    default:
      return { es: "Actualizar orden", en: "Update order" };
  }
}

function buildPurchaseOrderContinuitySpanish(order: ProcurementPurchaseOrderContract | null, linkedReceiptCount: number) {
  if (!order) {
    return {
      label: "Selecciona una orden",
      description: "Elige una orden para continuar del compromiso comercial a la recepción."
    };
  }

  if (order.status === "blocked") {
    return {
      label: "Desbloqueo requerido",
      description: "Asigna responsable, resuelve el bloqueo y confirma de nuevo el compromiso del proveedor antes de afectar la obra."
    };
  }

  if (order.invoiceMatchStatus === "risk") {
    return {
      label: "Validación fiscal",
      description: "La orden puede avanzar, pero necesita corregir la evidencia fiscal antes de liberar pagos o cierre."
    };
  }

  if (linkedReceiptCount > 0) {
    return {
      label: "Recepción en curso",
      description: "La orden ya tiene entrada ligada; termina evidencia, variaciones y movimientos sin duplicar la captura."
    };
  }

  if (order.status === "confirmed" || order.status === "in_transit" || order.status === "partial") {
    return {
      label: "Preparar recepción",
      description: "Mantén la fecha comprometida y prepara al almacén antes de que el proveedor llegue a obra."
    };
  }

  return {
    label: "Compromiso por confirmar",
    description: "Confirma aceptación, fecha y logística para convertir la requisición en una entrega ejecutable."
  };
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

function createPurchaseOrderExample(requisitionId?: string) {
  return {
    requisitionId: requisitionId || "",
    supplierName: "Concretos del Sureste",
    buyer: "Procurement coordinator",
    totalAmount: "248000",
    committedEta: "2026-08-02",
    logisticsMode: "Direct to jobsite",
    nextAction: "Confirmar surtido, salida de unidad y ventana de recepcion antes de movilizar cuadrilla."
  };
}

type RequisitionPreloadContext = {
  source: "requisitions";
  requisitionCode: string;
  projectName: string;
  frontName: string;
  requestedBy: string;
  category: string;
  nextAction: string;
};

type AccountsPayablePurchaseOrderPreloadContext = {
  source: "accounts-payable";
  purchaseOrderCode: string;
  supplierName: string;
  projectName: string;
  receiptCode: string;
  nextAction: string;
};

function normalizePurchaseOrderPreloadValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildRequisitionPreloadContext(
  searchParams: ReturnType<typeof useSearchParams>
): RequisitionPreloadContext | null {
  if (searchParams.get("source") !== "requisitions") {
    return null;
  }

  const context = {
    source: "requisitions" as const,
    requisitionCode: searchParams.get("requisitionCode")?.trim() ?? "",
    projectName: searchParams.get("projectName")?.trim() ?? "",
    frontName: searchParams.get("frontName")?.trim() ?? "",
    requestedBy: searchParams.get("requestedBy")?.trim() || searchParams.get("owner")?.trim() || "",
    category: searchParams.get("category")?.trim() ?? "",
    nextAction: searchParams.get("nextAction")?.trim() ?? ""
  };

  return Object.values(context).some((value) => typeof value === "string" && value.length > 0) ? context : null;
}

function buildAccountsPayablePurchaseOrderPreloadContext(
  searchParams: ReturnType<typeof useSearchParams>
): AccountsPayablePurchaseOrderPreloadContext | null {
  if (searchParams.get("source") !== "accounts-payable") {
    return null;
  }

  const context = {
    source: "accounts-payable" as const,
    purchaseOrderCode: searchParams.get("purchaseOrderCode")?.trim() ?? "",
    supplierName: searchParams.get("supplierName")?.trim() ?? "",
    projectName: searchParams.get("projectName")?.trim() ?? "",
    receiptCode: searchParams.get("receiptCode")?.trim() ?? "",
    nextAction: searchParams.get("nextAction")?.trim() ?? ""
  };

  return Object.values(context).some((value) => typeof value === "string" && value.length > 0) ? context : null;
}

function findBestMatchingPurchaseOrder(
  overview: ProcurementPurchaseOrdersOverviewContract,
  context: RequisitionPreloadContext
) {
  const normalizedRequisitionCode = normalizePurchaseOrderPreloadValue(context.requisitionCode);
  const normalizedProjectName = normalizePurchaseOrderPreloadValue(context.projectName);
  const normalizedFrontName = normalizePurchaseOrderPreloadValue(context.frontName);
  const normalizedCategory = normalizePurchaseOrderPreloadValue(context.category);
  const normalizedNextAction = normalizePurchaseOrderPreloadValue(context.nextAction);

  return (
    overview.purchaseOrders
      .map((order) => {
        let score = 0;

        if (normalizedRequisitionCode && normalizePurchaseOrderPreloadValue(order.requisitionCode) === normalizedRequisitionCode) {
          score += 8;
        }

        if (normalizedProjectName && normalizePurchaseOrderPreloadValue(order.projectName) === normalizedProjectName) {
          score += 4;
        }

        if (normalizedCategory && normalizePurchaseOrderPreloadValue(order.category).includes(normalizedCategory)) {
          score += 3;
        }

        if (normalizedFrontName && normalizePurchaseOrderPreloadValue(order.category).includes(normalizedFrontName)) {
          score += 2;
        }

        if (normalizedNextAction && normalizePurchaseOrderPreloadValue(order.nextAction).includes(normalizedNextAction)) {
          score += 1;
        }

        return { order, score };
      })
      .sort((left, right) => right.score - left.score)
      .find((item, index, collection) => item.score > 0 && (index === 0 || item.score > (collection[1]?.score ?? 0)))
      ?.order ?? null
  );
}

function findBestMatchingPurchaseOrderFromAccountsPayable(
  overview: ProcurementPurchaseOrdersOverviewContract,
  context: AccountsPayablePurchaseOrderPreloadContext
) {
  const normalizedPurchaseOrderCode = normalizePurchaseOrderPreloadValue(context.purchaseOrderCode);
  const normalizedSupplierName = normalizePurchaseOrderPreloadValue(context.supplierName);
  const normalizedProjectName = normalizePurchaseOrderPreloadValue(context.projectName);
  const normalizedNextAction = normalizePurchaseOrderPreloadValue(context.nextAction);

  return (
    overview.purchaseOrders
      .map((order) => {
        let score = 0;

        if (normalizedPurchaseOrderCode && normalizePurchaseOrderPreloadValue(order.code) === normalizedPurchaseOrderCode) {
          score += 10;
        }

        if (normalizedSupplierName && normalizePurchaseOrderPreloadValue(order.supplierName) === normalizedSupplierName) {
          score += 4;
        }

        if (normalizedProjectName && normalizePurchaseOrderPreloadValue(order.projectName) === normalizedProjectName) {
          score += 3;
        }

        if (normalizedNextAction && normalizePurchaseOrderPreloadValue(order.nextAction).includes(normalizedNextAction)) {
          score += 1;
        }

        return { order, score };
      })
      .sort((left, right) => right.score - left.score)
      .find((item, index, collection) => item.score > 0 && (index === 0 || item.score > (collection[1]?.score ?? 0)))
      ?.order ?? null
  );
}

function findMatchingEligibleRequisition(
  requisitionsOverview: NonNullable<PurchaseOrderBridgeContext>["requisitions"],
  context: RequisitionPreloadContext
) {
  const normalizedRequisitionCode = normalizePurchaseOrderPreloadValue(context.requisitionCode);
  const normalizedProjectName = normalizePurchaseOrderPreloadValue(context.projectName);
  const normalizedFrontName = normalizePurchaseOrderPreloadValue(context.frontName);
  const normalizedCategory = normalizePurchaseOrderPreloadValue(context.category);

  return (
    requisitionsOverview.requisitions.find((item) => {
      if (item.status !== "approved" && item.status !== "sourcing") {
        return false;
      }

      if (normalizedRequisitionCode && normalizePurchaseOrderPreloadValue(item.code) === normalizedRequisitionCode) {
        return true;
      }

      return (
        (!normalizedProjectName || normalizePurchaseOrderPreloadValue(item.projectName) === normalizedProjectName) &&
        (!normalizedFrontName || normalizePurchaseOrderPreloadValue(item.frontName) === normalizedFrontName) &&
        (!normalizedCategory || normalizePurchaseOrderPreloadValue(item.category).includes(normalizedCategory))
      );
    }) ?? null
  );
}

function buildPurchaseOrderWorkflow(
  order: ProcurementPurchaseOrderContract | null,
  linkedReceiptCount: number,
  hasFieldOrigin: boolean
) {
  if (!order) {
    return null;
  }

  return {
    continuity:
      order.status === "blocked"
        ? `${order.code} is blocked and should be cleared before procurement pressure becomes a field execution issue.`
        : order.status === "received"
          ? `${order.code} is already received, so the next operational focus should move to movements, consumption or closeout.`
          : `${order.code} is still active and should keep moving cleanly from supplier commitment into receiving.`,
    receivingRead:
      linkedReceiptCount > 0
        ? `${order.code} already has ${linkedReceiptCount} linked receipt path(s), so the receiving lane is already in motion.`
        : `${order.code} still has no linked inbound receipt, so the next move is to prepare receiving continuity.`,
    nextMove: hasFieldOrigin
      ? "Keep the field trace alive while confirming supplier commitment and inbound execution."
      : order.invoiceMatchStatus === "risk"
        ? "Reduce fiscal risk before this order becomes a clean closeable receipt."
        : "Move the order into transit or receiving without losing supplier and field context."
  };
}

function buildPurchaseOrderWhyNow(
  order: ProcurementPurchaseOrderContract | null,
  linkedReceiptCount: number,
  hasFieldOrigin: boolean
) {
  if (!order) {
    return "Choose an order to understand why procurement should intervene right now.";
  }

  if (order.status === "blocked") {
    return `${order.code} is blocked, so procurement still has the last real chance to prevent supplier or logistics friction from hitting the project directly.`;
  }

  if (order.invoiceMatchStatus === "risk") {
    return `${order.code} already carries fiscal mismatch risk, so delaying action now can contaminate receiving closeout and payment release later.`;
  }

  if (order.status === "in_transit" || order.status === "partial") {
    return `${order.code} is already in active logistics execution, so every missing decision now affects receipt timing, field planning and supplier confidence.`;
  }

  if (linkedReceiptCount > 0) {
    return `${order.code} already has receiving activity, so this PO is no longer just sourcing context; it is live operating flow.`;
  }

  if (hasFieldOrigin) {
    return `${order.code} comes from traced field pressure, so keeping it vague here would break continuity across requisition, supplier and warehouse teams.`;
  }

  return `${order.code} is the current commercial commitment point, so procurement should stabilize supplier and logistics ownership before execution accelerates.`;
}

function buildPurchaseOrderDownstreamEffect(
  order: ProcurementPurchaseOrderContract | null,
  linkedReceiptCount: number
) {
  if (!order) {
    return "Select an order to inspect which downstream domains depend on it.";
  }

  if (linkedReceiptCount > 0) {
    return `What changes here now affects receiving, inventory movements and accounts-payable because the PO already has inbound execution attached.`;
  }

  if (order.status === "confirmed" || order.status === "in_transit" || order.status === "partial") {
    return `The next move here directly conditions receiving slot discipline, supplier-control follow-up and whether AP later gets a clean fiscal packet.`;
  }

  if (order.invoiceMatchStatus === "risk") {
    return `If the fiscal mismatch is not corrected here, receiving and AP will inherit a preventable closeout problem.`;
  }

  return `This PO still determines whether procurement opens a clean downstream lane or hands off confusion into warehouse and finance.`;
}

function buildPurchaseOrderReportBack(
  order: ProcurementPurchaseOrderContract | null,
  linkedReceiptCount: number
) {
  if (!order) {
    return "Choose an order to define when the responsible owner should report back.";
  }

  if (order.status === "issued") {
    return "Report back when supplier acceptance, ETA and fiscal packet ownership are all confirmed.";
  }

  if (order.status === "confirmed") {
    return "Report back when dispatch is released and receiving already has a committed slot.";
  }

  if (order.status === "in_transit") {
    return linkedReceiptCount > 0
      ? "Report back with receipt evidence, variance status and the remaining balance still on route."
      : "Report back when the first receipt opens or when the ETA slips materially.";
  }

  if (order.status === "partial") {
    return "Report back when the remaining quantity, variance explanation and invoice match are all clear.";
  }

  if (order.status === "blocked") {
    return "Report back only with blocker owner, unblock action and the date to resume supplier execution.";
  }

  return "Report back when the order is fully received and the fiscal packet is clean enough for downstream payment release.";
}

function buildPurchaseOrderHumanStep(
  order: ProcurementPurchaseOrderContract | null,
  linkedReceiptCount: number
) {
  if (!order) {
    return "Select an order to see the next human move.";
  }

  if (order.status === "issued") {
    return "Confirm supplier acceptance now and assign a real owner for fiscal packet and ETA closure.";
  }

  if (order.status === "confirmed") {
    return "Release dispatch and make sure receiving is expecting this exact order, not just the supplier.";
  }

  if (order.status === "in_transit") {
    return linkedReceiptCount > 0
      ? "Follow the open receipt, close evidence gaps and keep the remaining quantity under logistics control."
      : "Open the receiving path now before the truck arrives and the warehouse team works blind.";
  }

  if (order.status === "partial") {
    return "Resolve the missing balance and variance immediately before the order becomes a lingering commercial exception.";
  }

  if (order.status === "blocked") {
    return "Escalate the blocker with supplier or logistics owner and do not let field planning assume this PO is healthy.";
  }

  return "Close receiving and fiscal evidence cleanly so the order can leave procurement without rework.";
}

function buildPurchaseOrderRouteSummary(
  order: ProcurementPurchaseOrderContract | null,
  linkedReceiptCount: number,
  hasFieldOrigin: boolean
) {
  if (!order) {
    return "Use purchase orders as the execution bridge between requisition, supplier commitment, receiving and invoice readiness.";
  }

  if (order.status === "blocked") {
    return "This order should route first through supplier and commercial unblock before warehouse or field depend on it.";
  }

  if (linkedReceiptCount > 0) {
    return "This order should route through linked receipts and then into movements or AP without rebuilding procurement context.";
  }

  if (order.status === "confirmed" || order.status === "in_transit" || order.status === "partial") {
    return "This order should route through receiving preparation and logistics execution before finance or field assume continuity.";
  }

  if (hasFieldOrigin) {
    return "This order should preserve field traceability while moving into supplier confirmation and inbound execution.";
  }

  return "This order can continue through supplier execution and receiving with the current procurement context intact.";
}

function buildContextualHref(path: string, params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return;
    }

    const normalizedValue = value.trim();
    if (normalizedValue.length === 0) {
      return;
    }

    query.set(key, normalizedValue);
  });

  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function buildPurchaseOrderReceivingHref(order: ProcurementPurchaseOrderContract | null) {
  if (!order) {
    return "/inventory/receiving";
  }

  return buildContextualHref("/inventory/receiving", {
    source: "purchase-orders",
    purchaseReference: order.code,
    supplierName: order.supplierName,
    projectName: order.projectName,
    nextAction: order.nextAction
  });
}

function buildPurchaseOrderMovementsHref(order: ProcurementPurchaseOrderContract | null, linkedReceiptCode?: string | null) {
  if (!order) {
    return "/inventory/movements";
  }

  return buildContextualHref("/inventory/movements", {
    source: "purchase-orders",
    purchaseReference: order.code,
    upstreamReceiptCode: linkedReceiptCode ?? null
  });
}

function buildPurchaseOrderSupplierControlHref(order: ProcurementPurchaseOrderContract | null) {
  if (!order) {
    return "/supplier-control";
  }

  return buildContextualHref("/supplier-control", {
    source: "purchase-orders",
    supplierName: order.supplierName,
    projectName: order.projectName,
    nextAction: order.nextAction
  });
}

function buildPurchaseOrderAccountsPayableHref(order: ProcurementPurchaseOrderContract | null, linkedReceiptCode?: string | null) {
  if (!order) {
    return "/accounts-payable";
  }

  return buildContextualHref("/accounts-payable", {
    source: "purchase-orders",
    supplierName: order.supplierName,
    projectName: order.projectName,
    purchaseOrderCode: order.code,
    receiptCode: linkedReceiptCode ?? null,
    nextAction: order.nextAction
  });
}

function buildPurchaseOrderOperationalLinks(
  order: ProcurementPurchaseOrderContract | null,
  linkedReceiptCount: number,
  linkedReceiptCode?: string | null
) {
  if (!order) {
    return [
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open supplier control", href: "/supplier-control" },
      { label: "Open accounts payable", href: "/accounts-payable" }
    ];
  }

  if (order.status === "blocked") {
    return [
      { label: "Open supplier control", href: buildPurchaseOrderSupplierControlHref(order) },
      { label: "Open receiving", href: buildPurchaseOrderReceivingHref(order) },
      { label: "Open accounts payable", href: buildPurchaseOrderAccountsPayableHref(order, linkedReceiptCode) }
    ];
  }

  if (linkedReceiptCount > 0) {
    return [
      { label: "Open receiving", href: buildPurchaseOrderReceivingHref(order) },
      { label: "Open movement", href: buildPurchaseOrderMovementsHref(order, linkedReceiptCode) },
      { label: "Open accounts payable", href: buildPurchaseOrderAccountsPayableHref(order, linkedReceiptCode) }
    ];
  }

  return [
    { label: "Open receiving", href: buildPurchaseOrderReceivingHref(order) },
    { label: "Open supplier control", href: buildPurchaseOrderSupplierControlHref(order) },
    { label: "Open accounts payable", href: buildPurchaseOrderAccountsPayableHref(order, linkedReceiptCode) }
  ];
}

function buildCreatePurchaseOrderGate(input: {
  requisitionId: string;
  supplierName: string;
  buyer: string;
  totalAmount: number;
  committedEta: string;
  logisticsMode: string;
  nextAction: string;
}) {
  const checks: string[] = [];

  if (!input.requisitionId) {
    checks.push("A valid requisition still needs to be selected.");
  }

  if ([input.supplierName, input.buyer, input.logisticsMode].some((value) => value.trim().length < 3)) {
    checks.push("Supplier, buyer and logistics mode still need more specific capture.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs to be concrete enough for supplier or warehouse follow-through.");
  }

  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    checks.push("Total amount must be greater than zero.");
  }

  if (!input.committedEta) {
    checks.push("Committed ETA is still missing.");
  }

  if (checks.length > 0) {
    const hardBlock = !input.requisitionId || !Number.isFinite(input.totalAmount) || input.totalAmount <= 0 || !input.committedEta;
    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not open yet" : "Open with control",
      summary: hardBlock
        ? "This purchase order would open with a hard procurement continuity blocker."
        : "The purchase order can open, but logistics or ownership still need tighter discipline.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to open",
    summary: "The PO intake is coherent enough to open supplier commitment cleanly.",
    checks: [
      "The opened PO will become the current focus item immediately.",
      "Keep requisition, supplier and receiving traceability attached from the first opening."
    ]
  };
}

function buildCreatePurchaseOrderHumanStep(input: {
  requisitionId: string;
  logisticsMode: string;
  nextAction: string;
  committedEta: string;
}) {
  if (!input.requisitionId) {
    return "Select the requisition first so the supplier commitment stays anchored to a real intake.";
  }

  if (!input.committedEta) {
    return "Set the committed ETA before opening the order so receiving can plan the slot.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the supplier acceptance or receiving step before persisting the PO.";
  }

  if (input.logisticsMode.trim().length < 3) {
    return "Define the logistics mode before opening the order so downstream handling stays explicit.";
  }

  return "Open the purchase order and continue immediately into receiving preparation or supplier follow-through without losing the requisition context.";
}

export default function ProcurementPurchaseOrdersPage() {
  const searchParams = useSearchParams();
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const t = useCallback((es: string, en: string) => localizeText({ es, en }), [localizeText]);
  const [overview, setOverview] = useState<ProcurementPurchaseOrdersOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<PurchaseOrderBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ProcurementPurchaseOrderContract["status"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [requisitionMatchedPurchaseOrderId, setRequisitionMatchedPurchaseOrderId] = useState<string | null>(null);
  const [appliedRequisitionPreloadKey, setAppliedRequisitionPreloadKey] = useState<string | null>(null);
  const [accountsPayableMatchedPurchaseOrderId, setAccountsPayableMatchedPurchaseOrderId] = useState<string | null>(null);
  const [appliedAccountsPayablePreloadKey, setAppliedAccountsPayablePreloadKey] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<"control" | "queue" | "create">("control");
  const [createForm, setCreateForm] = useState({
    requisitionId: "",
    supplierName: "Proveedor Estrategico",
    buyer: "Procurement lead",
    totalAmount: "150000",
    committedEta: "2026-07-20",
    logisticsMode: "Direct to jobsite",
    nextAction: ""
  });
  const createPurchaseOrderGate = useMemo(() => buildCreatePurchaseOrderGate({
    requisitionId: createForm.requisitionId,
    supplierName: createForm.supplierName,
    buyer: createForm.buyer,
    totalAmount: Number(createForm.totalAmount),
    committedEta: createForm.committedEta,
    logisticsMode: createForm.logisticsMode,
    nextAction: createForm.nextAction
  }), [createForm]);
  const createPurchaseOrderHumanStep = useMemo(() => buildCreatePurchaseOrderHumanStep({
    requisitionId: createForm.requisitionId,
    logisticsMode: createForm.logisticsMode,
    nextAction: createForm.nextAction,
    committedEta: createForm.committedEta
  }), [createForm]);
  const requisitionPreloadContext = useMemo(() => buildRequisitionPreloadContext(searchParams), [searchParams]);
  const requisitionPreloadKey = useMemo(
    () =>
      requisitionPreloadContext
        ? [
            requisitionPreloadContext.source,
            requisitionPreloadContext.requisitionCode,
            requisitionPreloadContext.projectName,
            requisitionPreloadContext.frontName,
            requisitionPreloadContext.requestedBy,
            requisitionPreloadContext.category,
            requisitionPreloadContext.nextAction
          ].join("|")
        : null,
    [requisitionPreloadContext]
  );
  const accountsPayablePreloadContext = useMemo(
    () => buildAccountsPayablePurchaseOrderPreloadContext(searchParams),
    [searchParams]
  );
  const accountsPayablePreloadKey = useMemo(
    () =>
      accountsPayablePreloadContext
        ? [
            accountsPayablePreloadContext.source,
            accountsPayablePreloadContext.purchaseOrderCode,
            accountsPayablePreloadContext.supplierName,
            accountsPayablePreloadContext.projectName,
            accountsPayablePreloadContext.receiptCode,
            accountsPayablePreloadContext.nextAction
          ].join("|")
        : null,
    [accountsPayablePreloadContext]
  );

  useEffect(() => {
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  useEffect(() => {
    if (!overview || !requisitionPreloadContext || !requisitionPreloadKey || appliedRequisitionPreloadKey === requisitionPreloadKey) {
      return;
    }

    const exactProjectExists =
      requisitionPreloadContext.projectName.length > 0 &&
      overview.purchaseOrders.some((item) => item.projectName === requisitionPreloadContext.projectName);
    if (exactProjectExists) {
      setProjectFilter(requisitionPreloadContext.projectName);
    }

    const preloadTerms = [
      requisitionPreloadContext.requisitionCode,
      requisitionPreloadContext.projectName,
      requisitionPreloadContext.frontName,
      requisitionPreloadContext.category
    ].filter(Boolean);
    if (preloadTerms.length > 0) {
      setSearchFilter(preloadTerms.join(" "));
    }

    const matchedPurchaseOrder = findBestMatchingPurchaseOrder(overview, requisitionPreloadContext);
    if (matchedPurchaseOrder) {
      setSelectedPurchaseOrderId(matchedPurchaseOrder.id);
      setRequisitionMatchedPurchaseOrderId(matchedPurchaseOrder.id);
      setWorkspaceView("control");
      setAppliedRequisitionPreloadKey(requisitionPreloadKey);
      return;
    }

    setRequisitionMatchedPurchaseOrderId(null);

    const matchedRequisition = bridgeContext
      ? findMatchingEligibleRequisition(bridgeContext.requisitions, requisitionPreloadContext)
      : null;
    if (matchedRequisition) {
      setCreateForm((current) => ({
        ...current,
        requisitionId: matchedRequisition.id,
        nextAction: requisitionPreloadContext.nextAction || current.nextAction
      }));
      setWorkspaceView("create");
    } else {
      setWorkspaceView("queue");
    }

    setAppliedRequisitionPreloadKey(requisitionPreloadKey);
  }, [appliedRequisitionPreloadKey, bridgeContext, overview, requisitionPreloadContext, requisitionPreloadKey]);

  useEffect(() => {
    if (
      !overview ||
      !accountsPayablePreloadContext ||
      !accountsPayablePreloadKey ||
      appliedAccountsPayablePreloadKey === accountsPayablePreloadKey
    ) {
      return;
    }

    const exactProjectExists =
      accountsPayablePreloadContext.projectName.length > 0 &&
      overview.purchaseOrders.some((item) => item.projectName === accountsPayablePreloadContext.projectName);
    if (exactProjectExists) {
      setProjectFilter(accountsPayablePreloadContext.projectName);
    }

    const preloadTerms = [
      accountsPayablePreloadContext.purchaseOrderCode,
      accountsPayablePreloadContext.supplierName,
      accountsPayablePreloadContext.projectName,
      accountsPayablePreloadContext.receiptCode
    ].filter(Boolean);
    if (preloadTerms.length > 0) {
      setSearchFilter(preloadTerms.join(" "));
    }

    const matchedPurchaseOrder = findBestMatchingPurchaseOrderFromAccountsPayable(overview, accountsPayablePreloadContext);
    if (matchedPurchaseOrder) {
      setSelectedPurchaseOrderId(matchedPurchaseOrder.id);
      setAccountsPayableMatchedPurchaseOrderId(matchedPurchaseOrder.id);
      setWorkspaceView("control");
      setAppliedAccountsPayablePreloadKey(accountsPayablePreloadKey);
      return;
    }

    setAccountsPayableMatchedPurchaseOrderId(null);
    setWorkspaceView("queue");
    setAppliedAccountsPayablePreloadKey(accountsPayablePreloadKey);
  }, [accountsPayablePreloadContext, accountsPayablePreloadKey, appliedAccountsPayablePreloadKey, overview]);

  const projectOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.purchaseOrders.map((item) => item.projectName))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [overview]);

  const filteredPurchaseOrders = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.purchaseOrders.filter((item) => {
      const matchesProject = projectFilter === "all" || item.projectName === projectFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.code.toLowerCase().includes(normalizedSearch) ||
        item.requisitionCode.toLowerCase().includes(normalizedSearch) ||
        item.projectName.toLowerCase().includes(normalizedSearch) ||
        item.supplierName.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch) ||
        item.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesProject && matchesStatus && matchesSearch;
    });
  }, [overview, projectFilter, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => {
    return {
      openOrders: filteredPurchaseOrders.filter((item) => item.status !== "received").length,
      inTransitOrders: filteredPurchaseOrders.filter((item) => item.status === "in_transit" || item.status === "partial").length,
      blockedOrders: filteredPurchaseOrders.filter((item) => item.status === "blocked").length,
      averageReceivedPercent:
        filteredPurchaseOrders.length > 0
          ? Number(
              (
                filteredPurchaseOrders.reduce((sum, item) => sum + item.receivedPercent, 0) / filteredPurchaseOrders.length
              ).toFixed(1)
            )
          : 0
    };
  }, [filteredPurchaseOrders]);

  const selectedPurchaseOrder = useMemo(
    () => filteredPurchaseOrders.find((item) => item.id === selectedPurchaseOrderId) ?? filteredPurchaseOrders[0] ?? null,
    [filteredPurchaseOrders, selectedPurchaseOrderId]
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
  const purchaseOrderWorkflow = useMemo(
    () => buildPurchaseOrderWorkflow(selectedPurchaseOrder, linkedReceipts.length, Boolean(selectedFieldOrigin)),
    [linkedReceipts.length, selectedFieldOrigin, selectedPurchaseOrder]
  );
  const purchaseOrderWhyNow = useMemo(
    () => buildPurchaseOrderWhyNow(selectedPurchaseOrder, linkedReceipts.length, Boolean(selectedFieldOrigin)),
    [linkedReceipts.length, selectedFieldOrigin, selectedPurchaseOrder]
  );
  const purchaseOrderDownstreamEffect = useMemo(
    () => buildPurchaseOrderDownstreamEffect(selectedPurchaseOrder, linkedReceipts.length),
    [linkedReceipts.length, selectedPurchaseOrder]
  );
  const purchaseOrderReportBack = useMemo(
    () => buildPurchaseOrderReportBack(selectedPurchaseOrder, linkedReceipts.length),
    [linkedReceipts.length, selectedPurchaseOrder]
  );
  const purchaseOrderHumanStep = useMemo(
    () => buildPurchaseOrderHumanStep(selectedPurchaseOrder, linkedReceipts.length),
    [linkedReceipts.length, selectedPurchaseOrder]
  );
  const purchaseOrderRouteSummary = useMemo(
    () => buildPurchaseOrderRouteSummary(selectedPurchaseOrder, linkedReceipts.length, Boolean(selectedFieldOrigin)),
    [linkedReceipts.length, selectedFieldOrigin, selectedPurchaseOrder]
  );
  const purchaseOrderOperationalLinks = useMemo(
    () => buildPurchaseOrderOperationalLinks(selectedPurchaseOrder, linkedReceipts.length, linkedReceipts[0]?.code ?? null),
    [linkedReceipts, selectedPurchaseOrder]
  );
  const eligibleRequisitions = useMemo(
    () =>
      bridgeContext?.requisitions.requisitions.filter((item) => item.status === "approved" || item.status === "sourcing") ?? [],
    [bridgeContext]
  );
  const purchaseOrderContinuityCopy = useMemo(
    () => buildPurchaseOrderContinuitySpanish(selectedPurchaseOrder, linkedReceipts.length),
    [linkedReceipts.length, selectedPurchaseOrder]
  );
  const requisitionContextRows = useMemo(
    () =>
      requisitionPreloadContext
        ? [
            { label: t("Requisición", "Requisition"), value: requisitionPreloadContext.requisitionCode },
            { label: t("Proyecto", "Project"), value: requisitionPreloadContext.projectName },
            { label: t("Frente", "Front"), value: requisitionPreloadContext.frontName },
            { label: t("Solicita", "Requested by"), value: requisitionPreloadContext.requestedBy },
            { label: t("Categoría", "Category"), value: requisitionPreloadContext.category },
            { label: t("Siguiente acción", "Next action"), value: requisitionPreloadContext.nextAction }
          ].filter((row) => row.value)
        : [],
    [requisitionPreloadContext, t]
  );
  const accountsPayableContextRows = useMemo(
    () =>
      accountsPayablePreloadContext
        ? [
            { label: t("Código OC", "PO code"), value: accountsPayablePreloadContext.purchaseOrderCode },
            { label: t("Proveedor", "Supplier"), value: accountsPayablePreloadContext.supplierName },
            { label: t("Proyecto", "Project"), value: accountsPayablePreloadContext.projectName },
            { label: t("Código de recepción", "Receipt code"), value: accountsPayablePreloadContext.receiptCode },
            { label: t("Siguiente acción", "Next action"), value: accountsPayablePreloadContext.nextAction }
          ].filter((row) => row.value)
        : [],
    [accountsPayablePreloadContext, t]
  );
  const hasRequisitionClearMatch =
    Boolean(requisitionPreloadContext) &&
    Boolean(selectedPurchaseOrder) &&
    requisitionMatchedPurchaseOrderId === selectedPurchaseOrder?.id;
  const hasAccountsPayableClearMatch =
    Boolean(accountsPayablePreloadContext) &&
    Boolean(selectedPurchaseOrder) &&
    accountsPayableMatchedPurchaseOrderId === selectedPurchaseOrder?.id;
  const selectedPurchaseOrderReceivingHref = buildPurchaseOrderReceivingHref(selectedPurchaseOrder);
  const selectedPurchaseOrderMovementHref = buildPurchaseOrderMovementsHref(selectedPurchaseOrder, linkedReceipts[0]?.code ?? null);
  const selectedPurchaseOrderSupplierControlHref = buildPurchaseOrderSupplierControlHref(selectedPurchaseOrder);
  const selectedPurchaseOrderAccountsPayableHref = buildPurchaseOrderAccountsPayableHref(
    selectedPurchaseOrder,
    linkedReceipts[0]?.code ?? null
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredPurchaseOrders.length === 0) {
      setSelectedPurchaseOrderId(null);
      return;
    }

    const isSelectedVisible = filteredPurchaseOrders.some((item) => item.id === selectedPurchaseOrderId);
    if (!isSelectedVisible) {
      setSelectedPurchaseOrderId(filteredPurchaseOrders[0]?.id ?? null);
    }
  }, [filteredPurchaseOrders, overview, selectedPurchaseOrderId]);

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
    if (!selectedPurchaseOrder) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError(t("La siguiente acción debe ser más específica antes de actualizar la orden.", "Next action must be more specific before updating the purchase order."));
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
      setActionError(response.error?.message ?? t("No fue posible actualizar la orden de compra.", "Purchase order update failed."));
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
    setActionMessage(t(`La orden cambió a ${localizeText(purchaseOrderStatusLabel(updatedPurchaseOrder.status)).toLowerCase()}.`, `Purchase order moved to ${updatedPurchaseOrder.status}.`));
    setIsSaving(false);
  }

  async function handleCreatePurchaseOrder() {
    if (!overview) {
      return;
    }

    const supplierName = createForm.supplierName.trim();
    const buyer = createForm.buyer.trim();
    const logisticsMode = createForm.logisticsMode.trim();
    const nextAction = createForm.nextAction.trim();
    const totalAmount = Number(createForm.totalAmount);

    if (!createForm.requisitionId || supplierName.length < 3 || buyer.length < 3 || logisticsMode.length < 3) {
      setActionError(t("Define requisición, proveedor, comprador y logística antes de abrir una orden.", "Requisition, supplier, buyer and logistics mode must be defined before opening a purchase order."));
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError(t("La primera acción debe ser específica antes de abrir la orden.", "Next action must be specific before opening the purchase order."));
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setActionError(t("El importe total debe ser mayor a cero antes de abrir una orden.", "Total amount must be greater than zero before opening a purchase order."));
      setCreateMessage(null);
      return;
    }

    if (!createForm.committedEta) {
      setActionError(t("La fecha comprometida es obligatoria antes de abrir una orden.", "Committed ETA is required before opening a purchase order."));
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
      setActionError(response.error?.message ?? t("No fue posible crear la orden de compra.", "Purchase order creation failed."));
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
    setWorkspaceView("control");
    setCreateMessage(t(`${createdPurchaseOrder.code} se abrió desde la requisición ${createdPurchaseOrder.requisitionCode}.`, `${createdPurchaseOrder.code} opened from requisition ${createdPurchaseOrder.requisitionCode}.`));
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
      title={{ es: "Órdenes de compra", en: "Purchase orders" }}
      eyebrow={{ es: "Abastecimiento", en: "Procurement" }}
      description={{
        es: "Controla el compromiso del proveedor, la logística y la recepción desde una sola orden operable.",
        en: "Control supplier commitment, logistics and receiving from one operable order."
      }}
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title={t("Órdenes de compra", "Purchase orders")}>
        {overview ? (
          <>
            <section className="purchaseOrderWorkbench">
              <div className="purchaseOrderWorkbenchLead">
                <span className="eyebrow">
                  {t("Compromiso de compra", "Purchase commitment")}
                  <span className="mono">{t("corte de recepción", "receiving cut")}</span>
                </span>
                {requisitionPreloadContext ? (
                  <div className="row gap wrap" style={{ marginTop: 12 }}>
                    <Badge tone="info">Precargado desde requisiciones / Preloaded from requisitions</Badge>
                  </div>
                ) : null}
                {accountsPayablePreloadContext ? (
                  <div className="row gap wrap" style={{ marginTop: 12 }}>
                    <Badge tone="info">Precargado desde cuentas por pagar / Preloaded from accounts payable</Badge>
                  </div>
                ) : null}
                <h2>{selectedPurchaseOrder?.code ?? t("Selecciona una orden", "Select a purchase order")}</h2>
                <p>{t("Convierte una requisición aprobada en un compromiso controlado y acompáñalo hasta recepción, movimiento y factura sin volver a capturar datos.", "Turn an approved requisition into a controlled commitment and carry it to receiving, movement and invoice without re-entering data.")}</p>
                <label className="purchaseOrderContextControl">
                  <span>{t("Orden activa", "Active purchase order")}</span>
                  <select className="selectField" value={selectedPurchaseOrder?.id ?? ""} onChange={(event) => setSelectedPurchaseOrderId(event.target.value || null)}>
                    {overview.purchaseOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.code} · {order.projectName} · {order.supplierName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="purchaseOrderWorkbenchSnapshot">
                <div className="row gap wrap">
                  {selectedPurchaseOrder ? <Badge tone={statusTone(selectedPurchaseOrder.status)}>{localizeText(purchaseOrderStatusLabel(selectedPurchaseOrder.status))}</Badge> : null}
                  {selectedPurchaseOrder ? <Badge tone={invoiceTone(selectedPurchaseOrder.invoiceMatchStatus)}>{localizeText(invoiceMatchLabel(selectedPurchaseOrder.invoiceMatchStatus))}</Badge> : null}
                  {requisitionPreloadContext ? <Badge tone="info">{hasRequisitionClearMatch ? t("Contexto aplicado", "Context applied") : t("Contexto visible", "Context visible")}</Badge> : null}
                  {accountsPayablePreloadContext ? <Badge tone="info">{hasAccountsPayableClearMatch ? t("Contexto aplicado", "Context applied") : t("Contexto visible", "Context visible")}</Badge> : null}
                </div>
                <strong>{selectedPurchaseOrder?.nextAction ?? t("Sin siguiente acción", "No next action")}</strong>
                <p>{selectedPurchaseOrder ? `${selectedPurchaseOrder.projectName} · ${selectedPurchaseOrder.supplierName}` : t("Selecciona una orden para comenzar", "Select an order to begin")}</p>
                <div className="purchaseOrderWorkbenchMetrics">
                  <div><strong>{selectedPurchaseOrder?.receivedPercent ?? 0}%</strong><span>{t("recibido", "received")}</span></div>
                  <div><strong>{linkedReceipts.length}</strong><span>{t("entradas", "receipts")}</span></div>
                  <div><strong>{selectedPurchaseOrder ? `MXN ${(selectedPurchaseOrder.totalAmount / 1000).toFixed(0)}k` : "MXN 0"}</strong><span>{t("importe", "amount")}</span></div>
                </div>
              </div>
            </section>

            {requisitionPreloadContext && !hasRequisitionClearMatch ? (
              <section className="grid cols1">
                <Card
                  title={t("Contexto recibido desde requisiciones", "Context received from requisitions")}
                  description={t("No hubo una orden clara para abrir. Se aplicaron filtros y, si era posible, se preparó el alta desde la requisición elegible.", "No clear order was found to open. Filters were applied and, when possible, the create flow was prepared from the eligible requisition.")}
                  aside={<Badge tone="info">Precargado desde requisiciones / Preloaded from requisitions</Badge>}
                >
                  <div className="detailGrid">
                    {requisitionContextRows.map((row) => (
                      <div key={row.label} className="detailRow">
                        <div className="detailLabel">{row.label}</div>
                        <div>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}

            {accountsPayablePreloadContext && !hasAccountsPayableClearMatch ? (
              <section className="grid cols1">
                <Card
                  title={t("Contexto recibido desde cuentas por pagar", "Context received from accounts payable")}
                  description={t("No hubo una orden clara para abrir. Se aplicaron filtros para mantener visible la OC vinculada por CXP.", "No clear order was found to open. Filters were applied so the PO linked from AP stays visible.")}
                  aside={<Badge tone="info">Precargado desde cuentas por pagar / Preloaded from accounts payable</Badge>}
                >
                  <div className="detailGrid">
                    {accountsPayableContextRows.map((row) => (
                      <div key={row.label} className="detailRow">
                        <div className="detailLabel">{row.label}</div>
                        <div>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}

            <div className="purchaseOrderWorkspaceTabs" role="tablist" aria-label={t("Vistas de órdenes de compra", "Purchase order views")}>
              {([
                ["control", t("Control", "Control")],
                ["queue", t("Órdenes", "Orders")],
                ["create", t("Alta", "Create")]
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={workspaceView === view}
                  className={`purchaseOrderWorkspaceTab ${workspaceView === view ? "purchaseOrderWorkspaceTabActive" : ""}`}
                  onClick={() => setWorkspaceView(view)}
                >
                  {label}
                </button>
              ))}
            </div>

            {workspaceView === "control" ? (
              <>
                <section className="grid cols3">
                  <KpiCard label={t("Importe comprometido", "Committed amount")} value={selectedPurchaseOrder ? `MXN ${selectedPurchaseOrder.totalAmount.toLocaleString()}` : "MXN 0"} footnote={t("Valor comercial que ya depende de esta orden.", "Commercial value already depending on this order.")} />
                  <KpiCard label={t("Fecha comprometida", "Committed ETA")} value={selectedPurchaseOrder?.committedEta ?? "-"} footnote={t("Fecha que debe conocer recepción y obra.", "Date receiving and site must know.")} />
                  <KpiCard label={t("Progreso de recepción", "Receipt progress")} value={`${selectedPurchaseOrder?.receivedPercent ?? 0}%`} footnote={t("No cierres la orden hasta completar recepción y evidencia.", "Do not close the order until receipt and evidence are complete.")} />
                </section>

                <section className="grid cols2">
                  <Card title={t("Siguiente acción", "Next action")} description={t("Actualiza el compromiso concreto que seguirá compras, proveedor o almacén.", "Update the concrete commitment procurement, supplier or warehouse will follow.")}>
                    {selectedPurchaseOrder ? (
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">{t("Proveedor", "Supplier")}</div><div>{selectedPurchaseOrder.supplierName}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Requisición", "Requisition")}</div><div>{selectedPurchaseOrder.requisitionCode}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Logística", "Logistics")}</div><div>{selectedPurchaseOrder.logisticsMode}</div></div>
                        <label className="detailRow"><div className="detailLabel">{t("Acción comprometida", "Committed action")}</div><textarea id="purchase-order-next-action" className="textarea" value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} placeholder={t("Ej. Confirmar salida y ventana de descarga hoy", "E.g. Confirm dispatch and unloading window today")} /></label>
                      </div>
                    ) : <EmptyState title={t("Sin orden seleccionada", "No purchase order selected")} description={t("Elige una orden desde la bandeja para actualizarla.", "Select an order from the queue to update it.")} />}
                    {selectedPurchaseOrder ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" disabled={isSaving || nextActionDraft.trim().length < 8} onClick={() => void handleAction(selectedPurchaseOrder.status, selectedPurchaseOrder.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : t("Guardar acción", "Save action")}</button><Link className="buttonGhost" href={selectedPurchaseOrderSupplierControlHref}>{t("Abrir proveedor", "Open supplier")}</Link></div> : null}
                  </Card>

                  <Card title={t("Decisión operativa", "Operational decision")} description={t(purchaseOrderContinuityCopy.description, selectedPurchaseOrder ? "Keep status changes connected to supplier commitment, receiving and fiscal readiness." : "Select an order to decide its next operational step.")} aside={<Badge tone={selectedPurchaseOrder?.invoiceMatchStatus === "risk" ? "danger" : selectedPurchaseOrder?.status === "blocked" ? "danger" : "success"}>{t(purchaseOrderContinuityCopy.label, selectedPurchaseOrder?.status === "blocked" ? "Unblock required" : "Ready to continue")}</Badge>}>
                    {requisitionPreloadContext ? (
                      <div className="detailGrid" style={{ marginBottom: 18 }}>
                        <div className="detailRow">
                          <div className="detailLabel">Requisition</div>
                          <div>
                            <Badge tone="info">Precargado desde requisiciones / Preloaded from requisitions</Badge>
                          </div>
                        </div>
                        {requisitionContextRows.map((row) => (
                          <div key={row.label} className="detailRow">
                            <div className="detailLabel">{row.label}</div>
                            <div>{row.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {accountsPayablePreloadContext ? (
                      <div className="detailGrid" style={{ marginBottom: 18 }}>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Cuentas por pagar", "Accounts payable")}</div>
                          <div>
                            <Badge tone="info">Precargado desde cuentas por pagar / Preloaded from accounts payable</Badge>
                          </div>
                        </div>
                        {accountsPayableContextRows.map((row) => (
                          <div key={row.label} className="detailRow">
                            <div className="detailLabel">{row.label}</div>
                            <div>{row.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <p className="sectionText">{t("Cada cambio debe conservar la fecha, la logística y la trazabilidad de la requisición que originó esta compra.", "Every change must keep the date, logistics and requisition traceability that originated this purchase.")}</p>
                    <div className="row gap wrap" style={{ marginTop: 18 }}>
                      {selectedPurchaseOrder ? actionOptions.map((option) => (
                        <button key={option.label} type="button" className={option.status === "blocked" ? "buttonGhost" : "button"} disabled={isSaving || (option.status === "received" && selectedPurchaseOrder.receivedPercent < 95) || (option.status === "received" && selectedPurchaseOrder.invoiceMatchStatus === "risk")} onClick={() => void handleAction(option.status, option.nextAction)}>
                          {isSaving ? t("Guardando...", "Saving...") : localizeText(purchaseOrderActionLabel(selectedPurchaseOrder, option.status))}
                        </button>
                      )) : null}
                    </div>
                    {selectedPurchaseOrder?.receivedPercent && selectedPurchaseOrder.receivedPercent < 95 ? <p className="tableCellMuted" style={{ marginTop: 16 }}>{t("La recepción debe alcanzar al menos 95% antes de cerrar esta orden.", "Receipt must reach at least 95% before closing this order.")}</p> : null}
                    {selectedPurchaseOrder?.invoiceMatchStatus === "risk" ? <p className="tableCellMuted" style={{ marginTop: 8 }}>{t("Corrige el riesgo fiscal antes de marcar la orden como recibida.", "Resolve fiscal risk before marking the order received.")}</p> : null}
                    {selectedPurchaseOrder && actionOptions.length === 0 ? <div className="row gap wrap" style={{ marginTop: 18 }}><Link className="button" href={selectedPurchaseOrderReceivingHref}>{t("Ver recepción", "View receiving")}</Link><Link className="buttonGhost" href={selectedPurchaseOrderMovementHref}>{t("Ver movimientos", "View movements")}</Link></div> : null}
                    {actionMessage ? <p className="formSuccess">{actionMessage}</p> : null}
                    {actionError ? <p className="formError">{actionError}</p> : null}
                  </Card>
                </section>

                <section className="grid cols2">
                  <Card title={t("Continuar el flujo", "Continue the flow")} description={t("La orden mantiene la misma referencia al pasar a recepción, almacén y cuentas por pagar.", "The order keeps the same reference as it moves to receiving, warehouse and accounts payable.")}>
                    {selectedPurchaseOrder ? <div className="row gap wrap"><Link className="button" href={selectedPurchaseOrderReceivingHref}>{t("Preparar recepción", "Prepare receiving")}</Link><Link className="buttonGhost" href={selectedPurchaseOrderMovementHref}>{t("Movimientos", "Movements")}</Link><Link className="buttonGhost" href={selectedPurchaseOrderAccountsPayableHref}>{t("Cuentas por pagar", "Accounts payable")}</Link></div> : null}
                  </Card>
                  <Card title={t("Señales de ejecución", "Execution signals")} description={t("Lectura rápida de recepción, proveedor y riesgos asociados a la orden activa.", "Fast read of receipt, supplier and risk signals associated with the active order.")}>
                    <div className="detailGrid"><div className="detailRow"><div className="detailLabel">{t("Entradas ligadas", "Linked receipts")}</div><div>{linkedReceipts.length}</div></div><div className="detailRow"><div className="detailLabel">{t("Riesgos activos", "Active risks")}</div><div>{selectedRisks.length > 0 ? `${selectedRisks.length} ${t("requieren atención", "need attention")}` : t("Sin riesgos explícitos", "No explicit risks")}</div></div><div className="detailRow"><div className="detailLabel">{t("Origen de obra", "Site origin")}</div><div>{selectedFieldOrigin ? selectedFieldOrigin.fieldRequestId : t("Captura directa de compras", "Direct procurement capture")}</div></div></div>
                  </Card>
                </section>
              </>
            ) : null}

            {workspaceView === "queue" ? (
              <section className="grid cols2">
                <Card title={t("Bandeja de órdenes", "Purchase order queue")} description={t("Filtra, elige una orden y regresa a Control para ejecutar el siguiente movimiento.", "Filter, select an order and return to Control to execute the next move.")} aside={<Badge tone={filteredSummary.blockedOrders > 0 ? "danger" : "success"}>{filteredSummary.blockedOrders} {t("bloqueadas", "blocked")}</Badge>}>
                  <FilterBar summary={`${filteredPurchaseOrders.length} ${t("órdenes visibles", "visible orders")}`}>
                    <select className="field" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">{t("Todas las obras", "All projects")}</option>{projectOptions.map((projectName) => <option key={projectName} value={projectName}>{projectName}</option>)}</select>
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">{t("Todos los estados", "All statuses")}</option>{(["issued", "confirmed", "in_transit", "partial", "blocked", "received"] as ProcurementPurchaseOrderContract["status"][]).map((status) => <option key={status} value={status}>{localizeText(purchaseOrderStatusLabel(status))}</option>)}</select>
                    <input className="field" type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Buscar orden, obra, proveedor o categoría", "Search order, project, supplier or category")} />
                  </FilterBar>
                  {filteredPurchaseOrders.length > 0 ? <div className="list">{filteredPurchaseOrders.map((order) => <button key={order.id} type="button" className={`listItem ${selectedPurchaseOrder?.id === order.id ? "listItemSelected" : ""}`} onClick={() => { setSelectedPurchaseOrderId(order.id); setWorkspaceView("control"); }}><div><strong>{order.code} · {order.projectName}</strong><p>{order.supplierName} · {order.receivedPercent}% {t("recibido", "received")} · MXN {order.totalAmount.toLocaleString()}</p></div><Badge tone={statusTone(order.status)}>{localizeText(purchaseOrderStatusLabel(order.status))}</Badge></button>)}</div> : <EmptyState title={t("Sin órdenes para estos filtros", "No orders for these filters")} description={t("Limpia los filtros o abre una orden desde una requisición elegible.", "Clear filters or open an order from an eligible requisition.")} />}
                </Card>
                <Card title={selectedPurchaseOrder?.code ?? t("Selecciona una orden", "Select a purchase order")} description={selectedPurchaseOrder ? `${selectedPurchaseOrder.projectName} · ${selectedPurchaseOrder.supplierName}` : t("Elige una orden desde la bandeja.", "Choose an order from the queue.")}>
                  {selectedPurchaseOrder ? <div className="detailGrid"><div className="detailRow"><div className="detailLabel">{t("Estado", "Status")}</div><div><Badge tone={statusTone(selectedPurchaseOrder.status)}>{localizeText(purchaseOrderStatusLabel(selectedPurchaseOrder.status))}</Badge></div></div><div className="detailRow"><div className="detailLabel">{t("Fecha comprometida", "Committed ETA")}</div><div>{selectedPurchaseOrder.committedEta}</div></div><div className="detailRow"><div className="detailLabel">{t("Recepción", "Receipt")}</div><div>{selectedPurchaseOrder.receivedPercent}%</div></div><div className="detailRow"><div className="detailLabel">{t("Siguiente acción", "Next action")}</div><div>{selectedPurchaseOrder.nextAction}</div></div></div> : null}
                  {selectedPurchaseOrder ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" onClick={() => setWorkspaceView("control")}>{t("Abrir control", "Open control")}</button></div> : null}
                </Card>
              </section>
            ) : null}

            {workspaceView === "create" ? (
              <section className="grid cols2">
                <Card title={t("Alta de orden de compra", "Create purchase order")} description={t("Abre un compromiso de proveedor solo desde una requisición aprobada o en cotización.", "Open a supplier commitment only from an approved or sourcing requisition.")}>
                  {requisitionPreloadContext ? (
                    <div className="detailGrid" style={{ marginBottom: 18 }}>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Contexto recibido", "Received context")}</div>
                        <div>
                          <Badge tone="info">Precargado desde requisiciones / Preloaded from requisitions</Badge>
                        </div>
                      </div>
                      {requisitionContextRows.map((row) => (
                        <div key={row.label} className="detailRow">
                          <div className="detailLabel">{row.label}</div>
                          <div>{row.value}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="row gap wrap" style={{ marginBottom: 18 }}><button type="button" className="buttonGhost" onClick={() => setCreateForm(createPurchaseOrderExample(eligibleRequisitions[0]?.id))}>{t("Cargar ejemplo", "Load example")}</button><button type="button" className="buttonGhost" onClick={() => setCreateForm((current) => ({ ...current, requisitionId: eligibleRequisitions[0]?.id ?? "", supplierName: "Proveedor estratégico", buyer: "Comprador responsable", totalAmount: "150000", committedEta: "2026-07-20", logisticsMode: "Entrega directa a obra", nextAction: "" }))}>{t("Limpiar esenciales", "Clear essentials")}</button></div>
                  <div className="captureCompactGrid">
                    <label className="captureField captureFieldWide"><span>{t("Requisición de origen", "Source requisition")}</span><select className="selectField" value={createForm.requisitionId} onChange={(event) => setCreateForm((current) => ({ ...current, requisitionId: event.target.value }))}><option value="">{t("Selecciona una requisición", "Select a requisition")}</option>{eligibleRequisitions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.projectName} · {item.category}</option>)}</select></label>
                    <label className="captureField"><span>{t("Proveedor", "Supplier")}</span><input className="field" value={createForm.supplierName} onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Comprador", "Buyer")}</span><input className="field" value={createForm.buyer} onChange={(event) => setCreateForm((current) => ({ ...current, buyer: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Importe total (MXN)", "Total amount (MXN)")}</span><input className="field" type="number" min="1" value={createForm.totalAmount} onChange={(event) => setCreateForm((current) => ({ ...current, totalAmount: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Fecha comprometida", "Committed ETA")}</span><input className="field" type="date" value={createForm.committedEta} onChange={(event) => setCreateForm((current) => ({ ...current, committedEta: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Logística", "Logistics")}</span><input className="field" value={createForm.logisticsMode} onChange={(event) => setCreateForm((current) => ({ ...current, logisticsMode: event.target.value }))} placeholder={t("Ej. Entrega directa a obra", "E.g. Direct to jobsite")} /></label>
                    <label className="captureField captureFieldWide"><span>{t("Primera acción", "First action")}</span><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder={t("Ej. Confirmar surtido y ventana de recepción", "E.g. Confirm supply and receiving window")} /></label>
                  </div>
                  {actionError ? <p className="formError">{actionError}</p> : null}
                  <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" disabled={isSaving} onClick={() => void handleCreatePurchaseOrder()}>{isSaving ? t("Creando...", "Creating...") : t("Abrir orden de compra", "Open purchase order")}</button>{createMessage ? <Badge tone="success">{createMessage}</Badge> : null}</div>
                </Card>
                <div className="fieldWorkspaceSideStack">
                  <Card title={t("Validación previa", "Pre-creation validation")} description={t("Confirma que la requisición, el compromiso y la recepción prevista son coherentes antes de persistir.", "Confirm requisition, commitment and planned receiving are coherent before persisting.")} aside={<Badge tone={createPurchaseOrderGate.tone}>{t(createPurchaseOrderGate.tone === "success" ? "Lista para abrir" : createPurchaseOrderGate.tone === "warning" ? "Abrir con control" : "Completa datos", createPurchaseOrderGate.label)}</Badge>}>
                    <p className="sectionText">{t(createPurchaseOrderGate.tone === "success" ? "La orden tiene contexto suficiente para iniciar el compromiso comercial y preparar recepción." : "Revisa los datos esenciales antes de introducir este compromiso a la cadena de abastecimiento.", createPurchaseOrderGate.summary)}</p>
                    <div className="detailGrid" style={{ marginTop: 16 }}><div className="detailRow"><div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div><div>{t(createForm.requisitionId && createForm.committedEta && createForm.nextAction.trim().length >= 8 ? "Abre la orden y prepara la recepción sin perder la referencia de la requisición." : "Completa la requisición, la fecha y la primera acción antes de abrir la orden.", createPurchaseOrderHumanStep)}</div></div></div>
                  </Card>
                  <Card title={t("Después del alta", "After creation")} description={t("La orden se selecciona automáticamente para confirmar, enviar a tránsito o preparar recepción.", "The order is automatically selected to confirm, move to transit or prepare receiving.")}>
                    <div className="row gap wrap"><Link className="buttonGhost" href="/procurement/requisitions">{t("Requisiciones", "Requisitions")}</Link><Link className="buttonGhost" href="/supplier-control">{t("Proveedores", "Suppliers")}</Link><Link className="buttonGhost" href="/inventory/receiving">{t("Recepción", "Receiving")}</Link></div>
                  </Card>
                </div>
              </section>
            ) : null}

            <details className="purchaseOrderAdvanced">
              <summary>{t("Abrir tablero detallado y controles avanzados", "Open detailed board and advanced controls")}</summary>
              <div className="purchaseOrderAdvancedContent">
            <section className="grid cols4">
              <KpiCard label="Open orders" value={String(filteredSummary.openOrders)} footnote="Orders still not fully received." />
              <KpiCard label="In transit" value={String(filteredSummary.inTransitOrders)} footnote="Orders actively moving through logistics or partial receipt." />
              <KpiCard label="Blocked orders" value={String(filteredSummary.blockedOrders)} footnote="Orders stopped by commercial, fiscal or execution issues." />
              <KpiCard label="Receipt progress" value={`${filteredSummary.averageReceivedPercent}%`} footnote="Average receipt completion across visible orders." />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Purchase orders can be exercised locally before live auth and ERP-style integrations are enabled."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Create purchase orders from requisitions, move them across issued, transit, blocked and received states, and inspect links to supplier control and receiving.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Open a PO from a requisition, push it to transit, then block or receive it to validate fiscal and logistics pressure in one board.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols1">
              <Card
                title="Purchase order continuity"
                description="This route should already connect requisition award, supplier commitment, receiving and downstream payment readiness."
              >
                <p className="sectionText">
                  Open the purchase order, stabilize supplier commitment, then continue into `receiving`,
                  `supplier-control` or `accounts-payable` depending on whether the next friction is logistics, supplier execution or fiscal release.
                </p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/procurement/requisitions">Open requisitions</Link>
                  <Link className="buttonGhost" href="/inventory/receiving">Open receiving</Link>
                  <Link className="buttonGhost" href="/supplier-control">Open supplier control</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Open accounts payable</Link>
                </div>
              </Card>
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

            <section className="grid cols3">
              <Card title="Order continuity" description="Whether the selected order can keep moving without major friction.">
                <p className="sectionText">
                  {purchaseOrderWorkflow?.continuity ?? "Choose an order to inspect continuity."}
                </p>
              </Card>
              <Card title="Receiving readiness" description="How ready the selected order is to continue into inbound execution.">
                <p className="sectionText">
                  {purchaseOrderWorkflow?.receivingRead ?? "Choose an order to inspect receiving readiness."}
                </p>
              </Card>
              <Card title="Next recommended move" description="Fast operator guidance for the selected purchase order.">
                <p className="sectionText">
                  {purchaseOrderWorkflow?.nextMove ?? "Choose an order to inspect the next move."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Purchase order board" description="Supplier execution, ETA control and fiscal matching across the active tenant.">
                <FilterBar summary={`${filteredPurchaseOrders.length} purchase orders in the active tenant`}>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">All projects</option>
                    {projectOptions.map((projectName) => (
                      <option key={projectName} value={projectName}>
                        {projectName}
                      </option>
                    ))}
                  </select>
                  <select
                    className="selectField"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as "all" | ProcurementPurchaseOrderContract["status"])
                    }
                  >
                    <option value="all">All status</option>
                    <option value="issued">issued</option>
                    <option value="confirmed">confirmed</option>
                    <option value="in_transit">in_transit</option>
                    <option value="partial">partial</option>
                    <option value="blocked">blocked</option>
                    <option value="received">received</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search order, project, supplier or category"
                  />
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "purchase orders ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredPurchaseOrders}
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

                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">Why now</div>
                        <div>{purchaseOrderWhyNow}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Downstream effect</div>
                        <div>{purchaseOrderDownstreamEffect}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Route summary</div>
                        <div>{purchaseOrderRouteSummary}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Next human step</div>
                        <div>{purchaseOrderHumanStep}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Report back</div>
                        <div>{purchaseOrderReportBack}</div>
                      </div>
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
                      {purchaseOrderOperationalLinks.map((link, index) => (
                        <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                          {link.label}
                        </Link>
                      ))}
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
                              href={selectedPurchaseOrderReceivingHref}
                            >
                              Open receiving
                            </Link>
                            <Link
                              className="buttonGhost"
                              href={selectedPurchaseOrderMovementHref}
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
                              href={selectedPurchaseOrderReceivingHref}
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
                description={
                  isDemoMode
                    ? "Convert an approved procurement requisition into a locally persisted supplier commitment with ETA and logistics ownership."
                    : "Convert an approved procurement requisition into an active supplier commitment with ETA and logistics ownership."
                }
              >
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() => setCreateForm(createPurchaseOrderExample(eligibleRequisitions[0]?.id))}
                  >
                    Load demo example
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        requisitionId: eligibleRequisitions[0]?.id ?? "",
                        supplierName: "Proveedor Estrategico",
                        buyer: "Procurement lead",
                        totalAmount: "150000",
                        committedEta: "2026-07-20",
                        logisticsMode: "Direct to jobsite",
                        nextAction: ""
                      })
                    }
                  >
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/procurement/requisitions">Open requisitions</Link>
                </div>
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
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createPurchaseOrderGate.tone}>{createPurchaseOrderGate.label}</Badge>
                        <span>{createPurchaseOrderGate.summary}</span>
                      </div>
                      {createPurchaseOrderGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">{check}</span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{createPurchaseOrderHumanStep}</div>
                  </div>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" onClick={() => void handleCreatePurchaseOrder()} disabled={isSaving}>
                    Open purchase order
                  </button>
                  <Link className="buttonGhost" href="/inventory/receiving">Open receiving</Link>
                  <Link className="buttonGhost" href="/supplier-control">Open supplier control</Link>
                  {actionError ? <Badge tone="danger">{actionError}</Badge> : null}
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
              </div>
            </details>
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
