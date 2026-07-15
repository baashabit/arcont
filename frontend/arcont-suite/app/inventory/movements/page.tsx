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

function createMovementExample(upstreamReceiptCode?: string, purchaseReference?: string) {
  return {
    movementType: "transfer" as InventoryMovementContract["movementType"],
    skuName: "Acero corrugado 3/8",
    sourceName: "Almacen central",
    destinationName: "Frente cimentacion",
    requestedBy: "Residente de obra",
    upstreamReceiptCode: upstreamReceiptCode || "",
    purchaseReference: purchaseReference || "",
    requestedUnits: "120",
    movedUnits: "0",
    pendingEvidence: "2",
    impactLevel: "watch" as InventoryMovementContract["impactLevel"],
    nextAction: "Despachar material, confirmar salida y validar entrega con evidencia de recepcion en frente"
  };
}

function findClearReceivingMovementMatch(
  movements: InventoryMovementContract[],
  upstreamReceiptCode: string,
  purchaseReference: string
) {
  const normalizedUpstreamReceiptCode = upstreamReceiptCode.trim();
  const normalizedPurchaseReference = purchaseReference.trim();
  const exactMatches = movements.filter((movement) => {
    const matchesUpstream = normalizedUpstreamReceiptCode
      ? movement.upstreamReceiptCode === normalizedUpstreamReceiptCode
      : true;
    const matchesPurchase = normalizedPurchaseReference
      ? movement.purchaseReference === normalizedPurchaseReference
      : true;

    return matchesUpstream && matchesPurchase;
  });

  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  if (normalizedUpstreamReceiptCode) {
    const upstreamMatches = movements.filter((movement) => movement.upstreamReceiptCode === normalizedUpstreamReceiptCode);
    if (upstreamMatches.length === 1) {
      return upstreamMatches[0];
    }
  }

  if (normalizedPurchaseReference) {
    const purchaseMatches = movements.filter((movement) => movement.purchaseReference === normalizedPurchaseReference);
    if (purchaseMatches.length === 1) {
      return purchaseMatches[0];
    }
  }

  return null;
}

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

function buildMovementWorkflow(
  movement: InventoryMovementContract | null,
  hasUpstreamReceipt: boolean
) {
  if (!movement) {
    return null;
  }

  return {
    continuity:
      movement.status === "blocked"
        ? `${movement.code} is blocked and should be cleared before the destination front loses material continuity.`
        : movement.status === "received"
          ? `${movement.code} is already received, so the next focus should move to field consumption, return control or closeout traceability.`
          : `${movement.code} is still in active handoff and should keep moving cleanly from stock to destination.`,
    traceability: hasUpstreamReceipt
      ? `${movement.code} is still tied to an upstream receipt, so inbound-to-field traceability remains intact.`
      : `${movement.code} has no upstream receipt anchor, so the operator should confirm the handoff story is still defensible.`,
    nextMove:
      movement.impactLevel === "critical"
        ? "Protect the destination front first, then close evidence and quantity gaps before treating this movement as resolved."
        : movement.pendingEvidence > 0
          ? "Complete evidence and receiving confirmation before closing the route."
          : "Close the movement or continue directly into field execution with clean traceability."
  };
}

function buildMovementWhyNow(
  movement: InventoryMovementContract | null,
  hasUpstreamReceipt: boolean
) {
  if (!movement) {
    return "Choose a movement to understand why operations should care about it right now.";
  }

  if (movement.status === "blocked") {
    return `${movement.code} is blocked, so this is the last point to prevent stock ambiguity from turning into field delay or warehouse rework.`;
  }

  if (movement.impactLevel === "critical") {
    return `${movement.code} already has critical execution impact, so every unresolved handoff issue now directly affects ${movement.destinationName}.`;
  }

  if (movement.pendingEvidence > 0 || movement.varianceUnits !== 0) {
    return `${movement.code} still has evidence or quantity gaps, so closing it badly now would create fake certainty in stock-to-field traceability.`;
  }

  if (!hasUpstreamReceipt) {
    return `${movement.code} no longer has a strong upstream anchor, so this is where the operator must defend the movement story before it goes cold.`;
  }

  return `${movement.code} is the active release point between warehouse and destination, so the team should stabilize it before it disappears into field consumption.`;
}

function buildMovementDownstreamEffect(movement: InventoryMovementContract | null) {
  if (!movement) {
    return "Select a movement to inspect which downstream domains depend on it.";
  }

  if (movement.status === "received" && movement.pendingEvidence === 0 && movement.varianceUnits === 0) {
    return "What happens here now affects field execution, equipment support and closeout traceability because the movement is already clean enough to release downstream.";
  }

  if (movement.invoiceMatchStatus === "risk" || movement.purchaseOrderStatus === "blocked") {
    return "A weak movement closeout here feeds commercial and fiscal noise back into procurement, AP and field teams at the same time.";
  }

  if (movement.pendingEvidence > 0 || movement.varianceUnits !== 0) {
    return "If this handoff stays dirty, field and warehouse will keep operating around material that was never cleanly transferred.";
  }

  return "This movement still controls whether destination teams receive material with real traceability or with operational ambiguity.";
}

function buildMovementReportBack(movement: InventoryMovementContract | null) {
  if (!movement) {
    return "Choose a movement to define when the owner should report back.";
  }

  if (movement.status === "blocked") {
    return "Report back only with blocker owner, containment action and the date to resume dispatch or receipt.";
  }

  if (movement.pendingEvidence > 0) {
    return "Report back in the same operating cycle once destination evidence is complete and attached to the handoff.";
  }

  if (movement.varianceUnits !== 0) {
    return "Report back when variance is reconciled and both origin and destination agree on the moved quantity.";
  }

  if (movement.status === "in_transit") {
    return "Report back when the destination confirms receipt or when the route slips enough to affect execution planning.";
  }

  return "Report back when the movement is fully received and no traceability gap remains open.";
}

function buildMovementHumanStep(movement: InventoryMovementContract | null) {
  if (!movement) {
    return "Select a movement to see the next human move.";
  }

  if (movement.status === "blocked") {
    return "Escalate the blocker now and do not let the destination team plan around material that is not actually moving.";
  }

  if (movement.status === "draft") {
    return "Release the movement only after confirming who hands off at origin and who receives at destination.";
  }

  if (movement.pendingEvidence > 0) {
    return "Assign the missing evidence immediately before anyone treats this movement as operationally closed.";
  }

  if (movement.varianceUnits !== 0) {
    return "Resolve the quantity discrepancy before the movement is accepted into stock, front or equipment usage.";
  }

  if (movement.invoiceMatchStatus === "risk") {
    return "Coordinate with procurement or AP now so a clean physical handoff does not hide a fiscal mismatch.";
  }

  return "Finish clean handoff and continue directly into field or equipment execution without rebuilding context.";
}

function buildMovementRouteSummary(
  movement: InventoryMovementContract | null,
  hasUpstreamReceipt: boolean
) {
  if (!movement) {
    return "Use movements as the controlled bridge between receiving, warehouse traceability, field release and equipment support.";
  }

  if (movement.status === "blocked") {
    return "This movement should route first through containment and handoff recovery before field or equipment keep depending on it.";
  }

  if (movement.invoiceMatchStatus === "risk" || movement.purchaseOrderStatus === "blocked") {
    return "This movement should route through receiving and procurement cleanup before the destination assumes clean continuity.";
  }

  if (movement.pendingEvidence > 0 || movement.varianceUnits !== 0) {
    return "This movement should route through evidence and quantity reconciliation before it is treated as a real downstream release.";
  }

  if (!hasUpstreamReceipt) {
    return "This movement should route through destination confirmation and operator ownership because the upstream anchor is already weak.";
  }

  return "This movement can continue through field execution or equipment support with the current traceability context intact.";
}

function buildMovementOperationalLinks(
  movement: InventoryMovementContract | null,
  hasUpstreamReceipt: boolean
) {
  if (!movement) {
    return [
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open field", href: "/field" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  if (movement.status === "blocked") {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  if (movement.invoiceMatchStatus === "risk" || movement.purchaseOrderStatus === "blocked") {
    return [
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open supplier control", href: "/supplier-control" },
      { label: "Open accounts payable", href: "/accounts-payable" }
    ];
  }

  if (movement.pendingEvidence > 0 || movement.varianceUnits !== 0) {
    return [
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open field", href: "/field" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  if (!hasUpstreamReceipt) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open equipment", href: "/equipment" },
      { label: "Open receiving", href: "/inventory/receiving" }
    ];
  }

  return [
    { label: "Open field", href: "/field" },
    { label: "Open equipment", href: "/equipment" },
    { label: "Open receiving", href: "/inventory/receiving" }
  ];
}

function buildFieldHrefFromMovement(movement: InventoryMovementContract) {
  const params = new URLSearchParams({
    source: "movements",
    destinationName: movement.destinationName,
    requestedBy: movement.requestedBy,
    nextAction: movement.nextAction
  });

  if (movement.purchaseReference) {
    params.set("purchaseReference", movement.purchaseReference);
  }

  if (movement.upstreamReceiptCode) {
    params.set("upstreamReceiptCode", movement.upstreamReceiptCode);
  }

  return `/field?${params.toString()}`;
}

function buildCreateMovementGate(input: {
  movementType: InventoryMovementContract["movementType"];
  skuName: string;
  sourceName: string;
  destinationName: string;
  requestedBy: string;
  upstreamReceiptCode: string;
  purchaseReference: string;
  requestedUnits: number;
  movedUnits: number;
  pendingEvidence: number;
  impactLevel: InventoryMovementContract["impactLevel"];
  nextAction: string;
  linkedReceiptPurchaseReference?: string | null;
}) {
  const checks: string[] = [];

  if ([input.skuName, input.sourceName, input.destinationName, input.requestedBy].some((value) => value.trim().length < 3)) {
    checks.push("SKU, source, destination and requester still need more specific capture.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for warehouse or field follow-through.");
  }

  if (!Number.isFinite(input.requestedUnits) || input.requestedUnits <= 0) {
    checks.push("Requested units must be greater than zero.");
  }

  if (!Number.isFinite(input.movedUnits) || input.movedUnits < 0) {
    checks.push("Moved units must be zero or greater.");
  }

  if (input.movedUnits > input.requestedUnits) {
    checks.push("Moved units cannot exceed requested units.");
  }

  if (!Number.isFinite(input.pendingEvidence) || input.pendingEvidence < 0) {
    checks.push("Pending evidence must be zero or greater.");
  }

  if (input.upstreamReceiptCode && !input.purchaseReference) {
    checks.push("Purchase reference is required when linking an upstream receipt.");
  }

  if (
    input.upstreamReceiptCode &&
    input.linkedReceiptPurchaseReference &&
    input.purchaseReference &&
    input.purchaseReference !== input.linkedReceiptPurchaseReference
  ) {
    checks.push("Purchase reference must stay aligned with the selected upstream receipt.");
  }

  if (checks.length > 0) {
    const hardBlock =
      !Number.isFinite(input.requestedUnits) ||
      input.requestedUnits <= 0 ||
      input.movedUnits > input.requestedUnits ||
      Boolean(input.upstreamReceiptCode && input.linkedReceiptPurchaseReference && input.purchaseReference !== input.linkedReceiptPurchaseReference);

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This movement would enter the warehouse lane with a hard traceability blocker."
        : "The movement can be created, but evidence or handoff discipline still needs tightening.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The stock movement has enough structure to persist cleanly.",
    checks: [
      "The created movement will become the current focus item immediately.",
      "Keep source, destination and upstream traceability attached from the first capture."
    ]
  };
}

function buildCreateMovementHumanStep(input: {
  upstreamReceiptCode: string;
  purchaseReference: string;
  nextAction: string;
  pendingEvidence: number;
}) {
  if (input.upstreamReceiptCode && !input.purchaseReference) {
    return "Restore the purchase reference before creating the movement so the upstream receipt remains defensible.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the handoff step before persisting the movement.";
  }

  if (input.pendingEvidence > 0) {
    return "Create the movement and immediately assign who closes the pending evidence at destination.";
  }

  return "Create the movement and continue directly into field or equipment follow-through without losing warehouse context.";
}

function InventoryMovementsPageContent() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
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
  const createFormNumbers = useMemo(() => ({
    requestedUnits: Number(createForm.requestedUnits),
    movedUnits: Number(createForm.movedUnits),
    pendingEvidence: Number(createForm.pendingEvidence)
  }), [createForm.movedUnits, createForm.pendingEvidence, createForm.requestedUnits]);
  const sourceParam = searchParams.get("source")?.trim() ?? "";
  const purchaseReferenceParam = searchParams.get("purchaseReference")?.trim() ?? "";
  const upstreamReceiptCodeParam = searchParams.get("upstreamReceiptCode")?.trim() ?? "";
  const supplierNameParam = searchParams.get("supplierName")?.trim() ?? "";
  const projectNameParam = searchParams.get("projectName")?.trim() ?? "";
  const nextActionParam = searchParams.get("nextAction")?.trim() ?? "";
  const isReceivingSource = sourceParam === "receiving";
  const [receivingPreloadDone, setReceivingPreloadDone] = useState(false);

  useEffect(() => {
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  const eligibleReceipts = useMemo(
    () => bridgeContext?.receiving.receipts.filter((item) => item.status === "received") ?? [],
    [bridgeContext]
  );
  const createMovementLinkedReceipt = useMemo(
    () => eligibleReceipts.find((item) => item.code === createForm.upstreamReceiptCode) ?? null,
    [createForm.upstreamReceiptCode, eligibleReceipts]
  );
  const createMovementGate = useMemo(() => buildCreateMovementGate({
    movementType: createForm.movementType,
    skuName: createForm.skuName,
    sourceName: createForm.sourceName,
    destinationName: createForm.destinationName,
    requestedBy: createForm.requestedBy,
    upstreamReceiptCode: createForm.upstreamReceiptCode,
    purchaseReference: createForm.purchaseReference,
    requestedUnits: createFormNumbers.requestedUnits,
    movedUnits: createFormNumbers.movedUnits,
    pendingEvidence: createFormNumbers.pendingEvidence,
    impactLevel: createForm.impactLevel,
    nextAction: createForm.nextAction,
    linkedReceiptPurchaseReference: createMovementLinkedReceipt?.purchaseReference ?? null
  }), [createForm, createFormNumbers, createMovementLinkedReceipt]);
  const createMovementHumanStep = useMemo(() => buildCreateMovementHumanStep({
    upstreamReceiptCode: createForm.upstreamReceiptCode,
    purchaseReference: createForm.purchaseReference,
    nextAction: createForm.nextAction,
    pendingEvidence: createFormNumbers.pendingEvidence
  }), [createForm.nextAction, createForm.purchaseReference, createForm.upstreamReceiptCode, createFormNumbers.pendingEvidence]);
  const filteredMovements = useMemo(() => {
    if (!overview) {
      return [];
    }

    return overview.movements.filter((movement) => {
      const matchesPurchaseReference = !purchaseReferenceParam || movement.purchaseReference === purchaseReferenceParam;
      const matchesUpstreamReceipt =
        !upstreamReceiptCodeParam || movement.upstreamReceiptCode === upstreamReceiptCodeParam;

      return matchesPurchaseReference && matchesUpstreamReceipt;
    });
  }, [overview, purchaseReferenceParam, upstreamReceiptCodeParam]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredMovements), [filteredMovements]);
  const receivingMatchedMovement = useMemo(
    () =>
      overview && isReceivingSource
        ? findClearReceivingMovementMatch(overview.movements, upstreamReceiptCodeParam, purchaseReferenceParam)
        : null,
    [isReceivingSource, overview, purchaseReferenceParam, upstreamReceiptCodeParam]
  );
  const hasReceivingContext =
    isReceivingSource &&
    Boolean(
      purchaseReferenceParam ||
      upstreamReceiptCodeParam ||
      supplierNameParam ||
      projectNameParam ||
      nextActionParam
    );
  const receivingContextStatus = hasReceivingContext
    ? receivingMatchedMovement
      ? "Movimiento relacionado identificado y seleccionado / Related movement identified and selected"
      : "Contexto aplicado o visible; sin match único todavía / Context applied or visible; no single clear match yet"
    : null;

  const selectedMovement = useMemo(
    () => filteredMovements.find((item) => item.id === selectedMovementId) ?? filteredMovements[0] ?? null,
    [filteredMovements, selectedMovementId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.movementId === selectedMovement?.id) ?? [],
    [overview, selectedMovement]
  );

  const movementActions = useMemo(() => (selectedMovement ? actionOptions(selectedMovement) : []), [selectedMovement]);

  const selectedStory = useMemo(() => buildMovementStory(selectedMovement, bridgeContext), [bridgeContext, selectedMovement]);
  const movementWorkflow = useMemo(
    () => buildMovementWorkflow(selectedMovement, Boolean(selectedMovement?.upstreamReceiptCode)),
    [selectedMovement]
  );
  const movementWhyNow = useMemo(
    () => buildMovementWhyNow(selectedMovement, Boolean(selectedMovement?.upstreamReceiptCode)),
    [selectedMovement]
  );
  const movementDownstreamEffect = useMemo(() => buildMovementDownstreamEffect(selectedMovement), [selectedMovement]);
  const movementReportBack = useMemo(() => buildMovementReportBack(selectedMovement), [selectedMovement]);
  const movementHumanStep = useMemo(() => buildMovementHumanStep(selectedMovement), [selectedMovement]);
  const movementRouteSummary = useMemo(
    () => buildMovementRouteSummary(selectedMovement, Boolean(selectedMovement?.upstreamReceiptCode)),
    [selectedMovement]
  );
  const movementOperationalLinks = useMemo(
    () => buildMovementOperationalLinks(selectedMovement, Boolean(selectedMovement?.upstreamReceiptCode)),
    [selectedMovement]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredMovements.length === 0) {
      setSelectedMovementId(null);
      return;
    }

    const isSelectedVisible = filteredMovements.some((item) => item.id === selectedMovementId);
    if (!isSelectedVisible) {
      setSelectedMovementId(filteredMovements[0]?.id ?? null);
    }
  }, [filteredMovements, overview, selectedMovementId]);

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
    if (!hasReceivingContext || !overview || receivingPreloadDone) {
      return;
    }

    if (receivingMatchedMovement) {
      setSelectedMovementId(receivingMatchedMovement.id);
      setNextActionDraft(receivingMatchedMovement.nextAction);
      setReceivingPreloadDone(true);
      return;
    }

    setCreateForm((current) => ({
      ...current,
      upstreamReceiptCode: upstreamReceiptCodeParam || current.upstreamReceiptCode,
      purchaseReference: purchaseReferenceParam || current.purchaseReference,
      nextAction: nextActionParam || current.nextAction
    }));
    setReceivingPreloadDone(true);
  }, [
    hasReceivingContext,
    nextActionParam,
    overview,
    purchaseReferenceParam,
    receivingMatchedMovement,
    receivingPreloadDone,
    upstreamReceiptCodeParam
  ]);

  useEffect(() => {
    setNextActionDraft(selectedMovement?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedMovementId, selectedMovement?.id, selectedMovement?.nextAction]);

  async function handleAction(status: InventoryMovementContract["status"], suggestedNextAction: string) {
    if (!selectedMovement) {
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
    if (!overview) {
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

    if (upstreamReceiptCode && !linkedReceipt && !isDemoMode) {
      setActionError("The selected upstream receipt is no longer available for movement creation.");
      setCreateMessage(null);
      return;
    }

    if (upstreamReceiptCode && !purchaseReference) {
      setActionError("A purchase reference is required when the movement is linked to an upstream receipt.");
      setCreateMessage(null);
      return;
    }

    if (upstreamReceiptCode && purchaseReference && linkedReceipt && linkedReceipt.purchaseReference !== purchaseReference) {
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
              <KpiCard label="Open movements" value={String(filteredSummary.openMovements)} footnote="Moves still not fully closed at destination." />
              <KpiCard label="Critical impact" value={String(filteredSummary.criticalMovements)} footnote="Movements currently putting execution or stock traceability at risk." />
              <KpiCard label="Pending evidence" value={String(filteredSummary.pendingEvidence)} footnote="Missing proof of dispatch, handoff or receipt." />
              <KpiCard label="Returns in flow" value={String(filteredSummary.returnsInFlow)} footnote="Return movements still open between front and warehouse." />
              <KpiCard label="Commercial risk" value={String(filteredSummary.movementsAtCommercialRisk)} footnote="Movements tied to blocked purchase posture or fiscal packet risk." />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Material handoffs can be exercised locally so warehouse-to-field traceability is testable before live integrations are ready."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Create transfers or returns, move them through dispatch states, and validate closure constraints from one board.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Generate a transfer from warehouse to front, then simulate evidence gaps or variance before marking the movement as received.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols3">
              <Card
                title="Movement workflow"
                description="Movements should carry inbound context forward into warehouse-to-field execution without losing traceability."
                aside={<Badge tone={filteredSummary.criticalMovements > 0 ? "danger" : filteredSummary.pendingEvidence > 0 ? "warning" : "success"}>{filteredSummary.criticalMovements > 0 ? "critical lane" : filteredSummary.pendingEvidence > 0 ? "evidence watch" : "stable lane"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Input source</div><div>Use clean receipts as the operational origin before releasing a stock movement.</div></div>
                  <div className="detailRow"><div className="detailLabel">Execution</div><div>Dispatch, handoff evidence and quantity reconciliation decide whether the route is actually usable.</div></div>
                  <div className="detailRow"><div className="detailLabel">Destination effect</div><div>Every movement should directly support field, equipment or return control instead of stopping at logistics-only visibility.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/inventory/receiving">Open receiving</Link>
                  <Link className="buttonGhost" href="/equipment">Open equipment</Link>
                  <Link className="buttonGhost" href="/field">Open field</Link>
                </div>
              </Card>

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

            {hasReceivingContext ? (
              <section className="grid cols1">
                <Card
                  title="Contexto desde recepción / Receiving context"
                  description="Continuidad visible entre receiving y movements sin rehacer el flujo actual / Visible continuity between receiving and movements without rebuilding the current flow."
                  aside={<Badge tone="info">Precargado desde recepción / Preloaded from receiving</Badge>}
                >
                  <div className="detailGrid">
                    {purchaseReferenceParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">Purchase reference</div>
                        <div>{purchaseReferenceParam}</div>
                      </div>
                    ) : null}
                    {upstreamReceiptCodeParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">Upstream receipt</div>
                        <div>{upstreamReceiptCodeParam}</div>
                      </div>
                    ) : null}
                    {supplierNameParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">Proveedor / Supplier</div>
                        <div>{supplierNameParam}</div>
                      </div>
                    ) : null}
                    {projectNameParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">Proyecto / Project</div>
                        <div>{projectNameParam}</div>
                      </div>
                    ) : null}
                    {nextActionParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">Siguiente acción / Next action</div>
                        <div>{nextActionParam}</div>
                      </div>
                    ) : null}
                    {receivingContextStatus ? (
                      <div className="detailRow">
                        <div className="detailLabel">Estado / Status</div>
                        <div>{receivingContextStatus}</div>
                      </div>
                    ) : null}
                    {receivingMatchedMovement ? (
                      <div className="detailRow">
                        <div className="detailLabel">Movimiento vinculado / Linked movement</div>
                        <div>{receivingMatchedMovement.code}</div>
                      </div>
                    ) : null}
                  </div>
                </Card>
              </section>
            ) : null}

            <section className="grid cols3">
              <Card title="Movement continuity" description="Whether the selected movement can keep moving without operational friction.">
                <p className="sectionText">
                  {movementWorkflow?.continuity ?? "Choose a movement to inspect continuity."}
                </p>
              </Card>
              <Card title="Traceability posture" description="How defensible the stock-to-front trace remains right now.">
                <p className="sectionText">
                  {movementWorkflow?.traceability ?? "Choose a movement to inspect traceability posture."}
                </p>
              </Card>
              <Card title="Next recommended move" description="Fast operator guidance for the selected movement.">
                <p className="sectionText">
                  {movementWorkflow?.nextMove ?? "Choose a movement to inspect the next move."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Movement board" description="Operational handoffs across warehouses, yards and jobsite fronts.">
                <FilterBar summary={`${filteredMovements.length} movements in the active tenant`}>
                  {purchaseReferenceParam ? <Badge tone="info">{purchaseReferenceParam}</Badge> : null}
                  {upstreamReceiptCodeParam ? <Badge tone="info">{upstreamReceiptCodeParam}</Badge> : null}
                  {purchaseReferenceParam || upstreamReceiptCodeParam ? (
                    <Link className="buttonGhost" href="/inventory/movements">
                      Clear context
                    </Link>
                  ) : null}
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "movements ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredMovements}
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
                      {movementOperationalLinks.map((link, index) => (
                        <Link
                          key={link.href + link.label}
                          className={index === 0 ? "button secondary" : "buttonGhost"}
                          href={
                            link.href === "/inventory/receiving"
                              ? `/inventory/receiving?purchaseReference=${encodeURIComponent(selectedMovement.purchaseReference ?? "")}&supplierName=${encodeURIComponent(selectedMovement.purchaseOrderOwner)}`
                              : link.href === "/field"
                                ? buildFieldHrefFromMovement(selectedMovement)
                                : link.href
                          }
                        >
                          {link.label}
                        </Link>
                      ))}
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
                      <div className="detailRow">
                        <div className="detailLabel">Why now</div>
                        <div>{movementWhyNow}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Downstream effect</div>
                        <div>{movementDownstreamEffect}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Route summary</div>
                        <div>{movementRouteSummary}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Next human step</div>
                        <div>{movementHumanStep}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Report back</div>
                        <div>{movementReportBack}</div>
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
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow"><div className="detailLabel">Creation gate</div><div className="tableCellStack"><div className="row gap wrap" style={{ alignItems: "center" }}><Badge tone={createMovementGate.tone}>{createMovementGate.label}</Badge><span>{createMovementGate.summary}</span></div>{createMovementGate.checks.map((check) => (<span key={check} className="tableCellMuted">{check}</span>))}</div></div>
                  <div className="detailRow"><div className="detailLabel">Next human step</div><div>{createMovementHumanStep}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isSaving} onClick={() => void handleCreateMovement()}>{isSaving ? "Saving..." : "Add movement"}</button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm(
                        createMovementExample(
                          upstreamReceiptCodeParam || eligibleReceipts[0]?.code,
                          purchaseReferenceParam || eligibleReceipts[0]?.purchaseReference
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
                        createMovementExample(
                          upstreamReceiptCodeParam || eligibleReceipts[0]?.code,
                          purchaseReferenceParam || eligibleReceipts[0]?.purchaseReference
                        )
                      )
                    }
                  >
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/inventory/receiving">Review receiving</Link>
                  <Link className="buttonGhost" href="/equipment">Review equipment</Link>
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
            primaryAction={{ label: "Open receiving", href: "/inventory/receiving" }}
            secondaryAction={{ label: "Open equipment", href: "/equipment" }}
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
