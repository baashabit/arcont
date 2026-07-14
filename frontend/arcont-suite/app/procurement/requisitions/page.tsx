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
import type { ProcurementRequisitionContract, ProcurementRequisitionsOverviewContract } from "@/lib/contracts";
import {
  createProcurementRequisition,
  fetchProcurementPurchaseOrdersOverview,
  fetchProcurementRequisitionsOverview,
  updateProcurementRequisition
} from "@/lib/platform-api";

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

function requisitionStatusLabel(status: ProcurementRequisitionContract["status"]) {
  switch (status) {
    case "draft":
      return { es: "Borrador", en: "Draft" };
    case "submitted":
      return { es: "Por aprobar", en: "Pending approval" };
    case "approved":
      return { es: "Aprobada", en: "Approved" };
    case "sourcing":
      return { es: "En cotización", en: "Sourcing" };
    default:
      return { es: "Bloqueada", en: "Blocked" };
  }
}

function requisitionUrgencyLabel(urgency: ProcurementRequisitionContract["urgency"]) {
  switch (urgency) {
    case "planned":
      return { es: "Planeada", en: "Planned" };
    case "watch":
      return { es: "Atención", en: "Watch" };
    default:
      return { es: "Crítica", en: "Critical" };
  }
}

function requisitionActionLabel(
  requisition: ProcurementRequisitionContract,
  nextStatus: ProcurementRequisitionContract["status"]
) {
  if (requisition.status === "blocked" && nextStatus === "submitted") {
    return { es: "Reactivar para revisión", en: "Resume for review" };
  }

  switch (nextStatus) {
    case "submitted":
      return { es: "Enviar a aprobación", en: "Submit for approval" };
    case "approved":
      return { es: "Aprobar requisición", en: "Approve requisition" };
    case "sourcing":
      return { es: "Abrir cotización", en: "Open sourcing" };
    case "blocked":
      return { es: "Bloquear requisición", en: "Block requisition" };
    default:
      return { es: "Actualizar requisición", en: "Update requisition" };
  }
}

function buildRequisitionContinuitySpanish(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean
) {
  if (!requisition) {
    return { label: "Selecciona una requisición", description: "Elige una requisición para decidir su siguiente movimiento de abastecimiento." };
  }

  if (requisition.status === "blocked") {
    return { label: "Corrección pendiente", description: "Asigna responsable y elimina el bloqueo antes de enviar esta necesidad a proveedores." };
  }

  if (requisition.urgency === "critical" && requisition.supplierCoverage === 0) {
    return { label: "Cobertura urgente", description: "La necesidad es crítica y aún no tiene una alternativa de proveedor identificada." };
  }

  if (hasPurchaseOrder) {
    return { label: "Orden en continuidad", description: "La requisición ya tiene orden relacionada; confirma recepción y logística sin perder su trazabilidad." };
  }

  if (requisition.status === "approved" || requisition.status === "sourcing") {
    return { label: "Lista para abastecer", description: "Conserva la cobertura de proveedores y convierte la decisión comercial en orden de compra." };
  }

  return { label: "En ruta de aprobación", description: "Confirma el responsable y el siguiente movimiento para evitar que la solicitud envejezca." };
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

function createRequisitionExample() {
  return {
    projectName: "Privada Los Héroes",
    frontName: "Cimentación etapa 2",
    requestedBy: "Residente de obra",
    category: "Solicitud de material de obra",
    status: "submitted" as ProcurementRequisitionContract["status"],
    requestedItems: "12",
    budgetAmount: "248000",
    urgency: "critical" as ProcurementRequisitionContract["urgency"],
    approvalHours: "4",
    supplierCoverage: "3",
    nextAction: "Validar volumen, liberar aprobación y abrir cobertura inmediata con proveedores activos."
  };
}

function buildRequisitionWorkflow(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean,
  hasFieldOrigin: boolean
) {
  if (!requisition) {
    return null;
  }

  return {
    continuity:
      requisition.status === "blocked"
        ? `${requisition.code} is blocked and should be cleared before field demand turns into a real supply delay.`
        : requisition.status === "sourcing"
          ? `${requisition.code} is already in sourcing and should stay connected to supplier coverage and PO conversion.`
          : `${requisition.code} is still moving through approval and should remain actionable from this board.`,
    supplierRead:
      requisition.supplierCoverage > 0
        ? `${requisition.code} already shows ${requisition.supplierCoverage} supplier paths, so sourcing can continue with real options.`
        : `${requisition.code} still has no supplier coverage and needs supplier-master support before it becomes healthy procurement flow.`,
    nextMove: hasPurchaseOrder
      ? `A purchase order already exists for ${requisition.code}, so the next move is logistics and receiving continuity.`
      : hasFieldOrigin
        ? `This requisition already comes from field demand, so the next move is approval and supplier coverage without losing traceability.`
        : `This requisition still needs stronger procurement continuity before it becomes a live order.`
  };
}

function buildRequisitionWhyNow(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean,
  hasFieldOrigin: boolean
) {
  if (!requisition) {
    return "Choose a requisition to understand why procurement should care about it right now.";
  }

  if (requisition.status === "blocked") {
    return `${requisition.code} already has a live blocker, so this is the fastest point where procurement can prevent field delay and budget drift.`;
  }

  if (requisition.urgency === "critical") {
    return `${requisition.code} is critical, so every hour without approval or supplier continuity directly increases execution pressure on ${requisition.projectName}.`;
  }

  if (hasPurchaseOrder) {
    return `${requisition.code} already converted into a purchase order, so this requisition is now the traceability anchor for receiving and downstream payment discipline.`;
  }

  if (hasFieldOrigin) {
    return `${requisition.code} already comes from a persisted field request, so losing continuity here would force the team to rebuild context by hand.`;
  }

  return `${requisition.code} is still the commercial intake point for this need, so procurement should stabilize approval and supplier path before the request goes cold.`;
}

function buildRequisitionDownstreamEffect(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean,
  hasFieldOrigin: boolean
) {
  if (!requisition) {
    return "Select a requisition to inspect which domains are affected next.";
  }

  if (hasPurchaseOrder) {
    return `What happens here now affects purchase-orders, receiving and supplier follow-through because ${requisition.code} already has downstream commercial commitment.`;
  }

  if (requisition.status === "approved" || requisition.status === "sourcing") {
    return `The next move here opens supplier-master and purchase-orders; if continuity is weak, logistics and receiving will inherit the disorder.`;
  }

  if (hasFieldOrigin) {
    return `This requisition is still tied to field demand, so procurement delay here feeds back into field and warehouse coordination immediately.`;
  }

  return `This intake still controls whether the request becomes an actionable sourcing lane or stays trapped before supplier and logistics execution.`;
}

function buildRequisitionReportBack(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean
) {
  if (!requisition) {
    return "Choose a requisition to define when the owner should report back.";
  }

  if (hasPurchaseOrder) {
    return "Report back once the linked PO has a committed supplier, logistics route and receiving path.";
  }

  if (requisition.status === "submitted") {
    return requisition.approvalHours > 8
      ? "Report back as soon as approval owner and release timing are confirmed."
      : "Report back when approval is secured or the request is explicitly blocked.";
  }

  if (requisition.status === "approved") {
    return "Report back when supplier coverage is validated and the requisition is ready to open sourcing or PO conversion.";
  }

  if (requisition.status === "sourcing") {
    return "Report back when supplier award is clear and the requisition can convert into a live purchase order.";
  }

  if (requisition.status === "blocked") {
    return "Report back only with blocker owner, unblock action and the date for re-entry into approval flow.";
  }

  return "Report back when the requisition has a concrete next move and a named approval or procurement owner.";
}

function buildRequisitionHumanStep(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean
) {
  if (!requisition) {
    return "Select a requisition to see the next human move.";
  }

  if (hasPurchaseOrder) {
    return "Jump to the linked purchase order and confirm logistics, ETA and receiving slot instead of reworking the intake.";
  }

  if (requisition.status === "draft") {
    return "Submit this requisition now with a named approval owner and explicit commercial justification.";
  }

  if (requisition.status === "submitted") {
    return "Push approval closure now; do not let the request age without a go/no-go decision.";
  }

  if (requisition.status === "approved") {
    return "Open supplier coverage immediately and move the request into sourcing while the approval is still fresh.";
  }

  if (requisition.status === "sourcing") {
    return "Convert the awarded option into a purchase order and carry the same context into receiving preparation.";
  }

  return "Resolve the blocker with the responsible owner before returning this intake to the active procurement lane.";
}

function buildRequisitionRouteSummary(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean,
  hasFieldOrigin: boolean
) {
  if (!requisition) {
    return "Use requisitions as the intake lane between field demand, supplier coverage and PO conversion.";
  }

  if (requisition.status === "blocked") {
    return "This requisition should route first through unblock and approval cleanup before procurement continues supplier work.";
  }

  if (hasPurchaseOrder) {
    return "This requisition should route through the linked purchase order and then into receiving without rebuilding intake context.";
  }

  if (requisition.status === "approved" || requisition.status === "sourcing") {
    return "This requisition should route through supplier coverage and PO conversion before logistics or receiving inherit the load.";
  }

  if (hasFieldOrigin) {
    return "This requisition should route through approval with field traceability preserved so procurement does not restate the original demand.";
  }

  return "This requisition can continue through approval and sourcing as long as the owner and next action stay explicit.";
}

function buildRequisitionOperationalLinks(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean
) {
  if (!requisition) {
    return [
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open purchase orders", href: "/procurement/purchase-orders" },
      { label: "Open field", href: "/field" }
    ];
  }

  if (requisition.status === "blocked") {
    return [
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open field", href: "/field" },
      { label: "Open purchase orders", href: "/procurement/purchase-orders" }
    ];
  }

  if (hasPurchaseOrder) {
    return [
      { label: "Open purchase orders", href: "/procurement/purchase-orders" },
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open supplier master", href: "/supplier-master" }
    ];
  }

  return [
    { label: "Open supplier master", href: "/supplier-master" },
    { label: "Open purchase orders", href: "/procurement/purchase-orders" },
    { label: "Open field", href: "/field" }
  ];
}

function buildRequisitionReleaseGate(
  requisition: ProcurementRequisitionContract | null,
  hasPurchaseOrder: boolean,
  hasFieldOrigin: boolean
) {
  if (!requisition) {
    return {
      tone: "info" as const,
      label: "No requisition selected",
      summary: "Choose a requisition to verify whether it is really ready for approval, sourcing or PO continuity.",
      checks: ["Select a requisition from the current intake board."]
    };
  }

  const checks: string[] = [];

  if (requisition.status === "blocked") {
    checks.push("Requisition is already blocked and should not continue downstream.");
  }

  if (requisition.status === "draft") {
    checks.push("Requisition is still draft and has not entered formal approval flow.");
  }

  if (requisition.urgency === "critical" && requisition.supplierCoverage === 0) {
    checks.push("Critical urgency still has zero supplier coverage.");
  }

  if (requisition.status === "submitted" && requisition.approvalHours > 24) {
    checks.push(`Approval aging is already ${requisition.approvalHours} hours.`);
  }

  if (requisition.status === "approved" && requisition.supplierCoverage < 1) {
    checks.push("Approved requisition still lacks minimum supplier path for sourcing.");
  }

  if (requisition.status === "sourcing" && !hasPurchaseOrder && requisition.supplierCoverage < 2) {
    checks.push("Sourcing is open but supplier path is still thin and no PO exists yet.");
  }

  if (checks.length > 0) {
    return {
      tone:
        requisition.status === "blocked" || (requisition.urgency === "critical" && requisition.supplierCoverage === 0)
          ? "danger" as const
          : "warning" as const,
      label:
        requisition.status === "blocked" || (requisition.urgency === "critical" && requisition.supplierCoverage === 0)
          ? "Do not advance yet"
          : "Advance with control",
      summary:
        requisition.status === "blocked" || (requisition.urgency === "critical" && requisition.supplierCoverage === 0)
          ? "The requisition still has hard intake blockers before it should continue to sourcing or PO conversion."
          : "The requisition can continue, but approval or supplier discipline still needs closure.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: hasPurchaseOrder ? "Already converted" : hasFieldOrigin ? "Ready for procurement continuity" : "Ready for sourcing",
    summary:
      hasPurchaseOrder
        ? "The requisition already has downstream PO continuity and should now protect logistics and receiving."
        : hasFieldOrigin
          ? "Field traceability, urgency and supplier path are aligned for procurement continuation."
          : "The requisition already carries enough structure to continue cleanly into sourcing.",
    checks: [
      "Keep supplier and field traceability attached to the same requisition.",
      "Move to the next domain without rebuilding intake context."
    ]
  };
}

function buildCreateRequisitionGate(input: {
  status: ProcurementRequisitionContract["status"];
  urgency: ProcurementRequisitionContract["urgency"];
  projectName: string;
  frontName: string;
  requestedBy: string;
  category: string;
  requestedItems: number;
  budgetAmount: number;
  approvalHours: number;
  supplierCoverage: number;
  nextAction: string;
}) {
  const checks: string[] = [];

  if ([input.projectName, input.frontName, input.requestedBy, input.category].some((value) => value.trim().length < 3)) {
    checks.push("Project, front, requester and category still need more specific capture.");
  }

  if (!Number.isFinite(input.requestedItems) || input.requestedItems <= 0) {
    checks.push("Requested items must be greater than zero.");
  }

  if (!Number.isFinite(input.budgetAmount) || input.budgetAmount <= 0) {
    checks.push("Budget amount must be greater than zero.");
  }

  if (!Number.isFinite(input.approvalHours) || input.approvalHours < 0) {
    checks.push("Approval hours must be zero or greater.");
  }

  if (!Number.isFinite(input.supplierCoverage) || input.supplierCoverage < 0) {
    checks.push("Supplier coverage must be zero or greater.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs more operational detail.");
  }

  if (input.urgency === "critical" && input.supplierCoverage === 0) {
    checks.push("Critical requisition still has zero supplier coverage.");
  }

  if (input.status === "approved" && input.supplierCoverage < 1) {
    checks.push("Approved requisition needs at least one supplier path before capture is coherent.");
  }

  if (checks.length > 0) {
    const hardBlock =
      input.urgency === "critical" && input.supplierCoverage === 0 ||
      !Number.isFinite(input.requestedItems) ||
      input.requestedItems <= 0 ||
      !Number.isFinite(input.budgetAmount) ||
      input.budgetAmount <= 0;

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This requisition would enter procurement with hard intake problems."
        : "The requisition can be created, but it still needs tighter commercial or supplier discipline.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The requisition has enough structure to enter the workbench cleanly.",
    checks: [
      "The created requisition will become the current focus item immediately.",
      "Keep supplier traceability and next action attached from the first capture."
    ]
  };
}

function buildCreateRequisitionHumanStep(input: {
  status: ProcurementRequisitionContract["status"];
  urgency: ProcurementRequisitionContract["urgency"];
  supplierCoverage: number;
  nextAction: string;
}) {
  if (input.urgency === "critical" && input.supplierCoverage === 0) {
    return "Add at least one supplier path before capturing this as a critical requisition.";
  }

  if (input.status === "draft") {
    return "Create the draft, then move immediately into submission with a concrete approval owner.";
  }

  if (input.status === "approved") {
    return "Create the approved intake only if supplier continuity is already credible, then jump straight into sourcing.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the first procurement move before persisting the intake.";
  }

  return "Create the requisition and continue directly into approval or sourcing without losing the intake context.";
}

export default function ProcurementRequisitionsPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<ProcurementRequisitionsOverviewContract | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<NonNullable<Awaited<ReturnType<typeof fetchProcurementPurchaseOrdersOverview>>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequisitionId, setSelectedRequisitionId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | ProcurementRequisitionContract["urgency"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"control" | "queue" | "create">("control");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    projectName: "Nueva obra",
    frontName: "Frente 1",
    requestedBy: "Residente de obra",
    category: "Materiales",
    status: "draft" as ProcurementRequisitionContract["status"],
    requestedItems: "3",
    budgetAmount: "125000",
    urgency: "watch" as ProcurementRequisitionContract["urgency"],
    approvalHours: "6",
    supplierCoverage: "2",
    nextAction: ""
  });
  const createFormNumbers = useMemo(
    () => ({
      requestedItems: Number(createForm.requestedItems),
      budgetAmount: Number(createForm.budgetAmount),
      approvalHours: Number(createForm.approvalHours),
      supplierCoverage: Number(createForm.supplierCoverage)
    }),
    [createForm.approvalHours, createForm.budgetAmount, createForm.requestedItems, createForm.supplierCoverage]
  );
  const createRequisitionGate = useMemo(
    () =>
      buildCreateRequisitionGate({
        ...createForm,
        ...createFormNumbers
      }),
    [createForm, createFormNumbers]
  );
  const createRequisitionHumanStep = useMemo(
    () =>
      buildCreateRequisitionHumanStep({
        status: createForm.status,
        urgency: createForm.urgency,
        supplierCoverage: createFormNumbers.supplierCoverage,
        nextAction: createForm.nextAction
      }),
    [createForm.nextAction, createForm.status, createForm.urgency, createFormNumbers.supplierCoverage]
  );
  const t = (es: string, en: string) => localizeText({ es, en });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchProcurementRequisitionsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchProcurementPurchaseOrdersOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, purchaseOrdersResult]) => {
        if (cancelled) {
          return;
        }

        if (!result || !purchaseOrdersResult) {
          setError("Procurement requisitions overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setPurchaseOrders(purchaseOrdersResult);
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  const projectOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.requisitions.map((item) => item.projectName))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [overview]);

  const filteredRequisitions = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.requisitions.filter((item) => {
      const matchesProject = projectFilter === "all" || item.projectName === projectFilter;
      const matchesUrgency = urgencyFilter === "all" || item.urgency === urgencyFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.code.toLowerCase().includes(normalizedSearch) ||
        item.projectName.toLowerCase().includes(normalizedSearch) ||
        item.frontName.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch);

      return matchesProject && matchesUrgency && matchesSearch;
    });
  }, [overview, projectFilter, searchFilter, urgencyFilter]);

  const filteredSummary = useMemo(
    () => recomputeSummary(filteredRequisitions),
    [filteredRequisitions]
  );

  const selectedRequisition = useMemo(
    () => filteredRequisitions.find((item) => item.id === selectedRequisitionId) ?? filteredRequisitions[0] ?? null,
    [filteredRequisitions, selectedRequisitionId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.requisitionId === selectedRequisition?.id) ?? [],
    [overview, selectedRequisition]
  );
  const selectedOrigin = useMemo(
    () => overview?.origins.find((origin) => origin.requisitionId === selectedRequisition?.id) ?? null,
    [overview, selectedRequisition]
  );
  const selectedPurchaseOrder = useMemo(
    () =>
      selectedRequisition
        ? purchaseOrders?.purchaseOrders.find((item) => item.requisitionCode === selectedRequisition.code) ?? null
        : null,
    [purchaseOrders, selectedRequisition]
  );
  const requisitionWorkflow = useMemo(
    () => buildRequisitionWorkflow(selectedRequisition, Boolean(selectedPurchaseOrder), Boolean(selectedOrigin)),
    [selectedOrigin, selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionReleaseGate = useMemo(
    () => buildRequisitionReleaseGate(selectedRequisition, Boolean(selectedPurchaseOrder), Boolean(selectedOrigin)),
    [selectedOrigin, selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionWhyNow = useMemo(
    () => buildRequisitionWhyNow(selectedRequisition, Boolean(selectedPurchaseOrder), Boolean(selectedOrigin)),
    [selectedOrigin, selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionRouteSummary = useMemo(
    () => buildRequisitionRouteSummary(selectedRequisition, Boolean(selectedPurchaseOrder), Boolean(selectedOrigin)),
    [selectedOrigin, selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionDownstreamEffect = useMemo(
    () => buildRequisitionDownstreamEffect(selectedRequisition, Boolean(selectedPurchaseOrder), Boolean(selectedOrigin)),
    [selectedOrigin, selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionReportBack = useMemo(
    () => buildRequisitionReportBack(selectedRequisition, Boolean(selectedPurchaseOrder)),
    [selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionHumanStep = useMemo(
    () => buildRequisitionHumanStep(selectedRequisition, Boolean(selectedPurchaseOrder)),
    [selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionOperationalLinks = useMemo(
    () => buildRequisitionOperationalLinks(selectedRequisition, Boolean(selectedPurchaseOrder)),
    [selectedPurchaseOrder, selectedRequisition]
  );
  const requisitionContinuityCopy = useMemo(
    () => buildRequisitionContinuitySpanish(selectedRequisition, Boolean(selectedPurchaseOrder)),
    [selectedPurchaseOrder, selectedRequisition]
  );

  const actionOptions = useMemo(
    () => (selectedRequisition ? requisitionActionOptions(selectedRequisition) : []),
    [selectedRequisition]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredRequisitions.length === 0) {
      setSelectedRequisitionId(null);
      return;
    }

    const isSelectedVisible = filteredRequisitions.some((item) => item.id === selectedRequisitionId);
    if (!isSelectedVisible) {
      setSelectedRequisitionId(filteredRequisitions[0]?.id ?? null);
    }
  }, [filteredRequisitions, overview, selectedRequisitionId]);

  useEffect(() => {
    setNextActionDraft(selectedRequisition?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedRequisitionId, selectedRequisition?.id, selectedRequisition?.nextAction]);

  async function handleAction(status: ProcurementRequisitionContract["status"], suggestedNextAction: string) {
    if (!selectedRequisition) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError(t("La siguiente acción debe ser más específica antes de actualizar la requisición.", "Next action must be more specific before updating the requisition."));
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
      setActionError(response.error?.message ?? t("No fue posible actualizar la requisición.", "Requisition update failed."));
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
    setActionMessage(t(`La requisición cambió a ${localizeText(requisitionStatusLabel(updatedRequisition.status)).toLowerCase()}.`, `Requisition moved to ${updatedRequisition.status}.`));
    setIsSaving(false);
  }

  async function handleCreateRequisition() {
    if (!overview) {
      return;
    }

    const projectName = createForm.projectName.trim();
    const frontName = createForm.frontName.trim();
    const requestedBy = createForm.requestedBy.trim();
    const category = createForm.category.trim();
    const nextAction = createForm.nextAction.trim();

    if (projectName.length < 3 || frontName.length < 3 || requestedBy.length < 3 || category.length < 3) {
      setActionError(t("Obra, frente, solicitante y categoría deben ser específicos antes de crear la requisición.", "Project, front, requester and category must be specific before creating the requisition."));
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError(t("La siguiente acción debe ser más específica antes de crear la requisición.", "Next action must be more specific before creating the requisition."));
      setCreateMessage(null);
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createProcurementRequisition(
      activeCompany.id,
      {
        projectName,
        frontName,
        requestedBy,
        category,
        status: createForm.status,
        requestedItems: Number(createForm.requestedItems),
        budgetAmount: Number(createForm.budgetAmount),
        urgency: createForm.urgency,
        approvalHours: Number(createForm.approvalHours),
        supplierCoverage: Number(createForm.supplierCoverage),
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? t("No fue posible crear la requisición.", "Requisition creation failed."));
      setIsSaving(false);
      return;
    }

    const createdRequisition = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const requisitions = [createdRequisition, ...current.requisitions];
      return {
        ...current,
        summary: recomputeSummary(requisitions),
        requisitions,
        focusRequisition: pickFocusRequisition(requisitions)
      };
    });

    setSelectedRequisitionId(createdRequisition.id);
    setNextActionDraft(createdRequisition.nextAction);
    setActionError(null);
    setCreateMessage(t(`${createdRequisition.code} se agregó a la bandeja de compras.`, `${createdRequisition.code} added to the procurement workbench.`));
    setCreateForm((current) => ({
      ...current,
      projectName,
      frontName,
      requestedBy,
      category,
      status: "draft",
      requestedItems: "3",
      budgetAmount: "125000",
      urgency: "watch",
      approvalHours: "6",
      supplierCoverage: "2",
      nextAction: ""
    }));
    setIsSaving(false);
  }

  return (
    <AppShell
      title={{ es: "Requisiciones de compra", en: "Purchase requisitions" }}
      eyebrow={{ es: "Abastecimiento", en: "Procurement" }}
      description={{
        es: "Recibe la necesidad de obra, controla la aprobación y envíala a cotización sin perder trazabilidad.",
        en: "Receive site demand, control approval and route it to sourcing without losing traceability."
      }}
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title={t("Requisiciones", "Requisitions")}>
        {overview ? (
          <>
            <section className="requisitionWorkbench">
              <div className="requisitionWorkbenchLead">
                <span className="eyebrow">
                  {t("Solicitud en control", "Request control")}
                  <span className="mono">{t("corte de abastecimiento", "supply cut")}</span>
                </span>
                <h2>{selectedRequisition?.code ?? t("Selecciona una requisición", "Select a requisition")}</h2>
                <p>{t("Registra la necesidad, define su siguiente acción y llévala al proveedor, a la orden o a recepción sin volver a capturar el contexto.", "Capture the need, define its next action and take it to supplier, purchase order or receiving without re-entering context.")}</p>
                <label className="requisitionContextControl">
                  <span>{t("Requisición activa", "Active requisition")}</span>
                  <select className="selectField" value={selectedRequisition?.id ?? ""} onChange={(event) => setSelectedRequisitionId(event.target.value || null)}>
                    {overview.requisitions.map((requisition) => (
                      <option key={requisition.id} value={requisition.id}>
                        {requisition.code} · {requisition.projectName} · {requisition.frontName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="requisitionWorkbenchSnapshot">
                <div className="row gap wrap">
                  {selectedRequisition ? <Badge tone={statusTone(selectedRequisition.status)}>{localizeText(requisitionStatusLabel(selectedRequisition.status))}</Badge> : null}
                  {selectedRequisition ? <Badge tone={urgencyTone(selectedRequisition.urgency)}>{localizeText(requisitionUrgencyLabel(selectedRequisition.urgency))}</Badge> : null}
                </div>
                <strong>{selectedRequisition?.nextAction ?? t("Sin siguiente acción", "No next action")}</strong>
                <p>{selectedRequisition ? `${selectedRequisition.projectName} · ${selectedRequisition.frontName}` : t("Selecciona una necesidad para iniciar", "Select a need to begin")}</p>
                <div className="requisitionWorkbenchMetrics">
                  <div><strong>{selectedRequisition?.requestedItems ?? 0}</strong><span>{t("partidas", "items")}</span></div>
                  <div><strong>{selectedRequisition?.supplierCoverage ?? 0}</strong><span>{t("proveedores", "suppliers")}</span></div>
                  <div><strong>{selectedRequisition ? `MXN ${(selectedRequisition.budgetAmount / 1000).toFixed(0)}k` : "MXN 0"}</strong><span>{t("presupuesto", "budget")}</span></div>
                </div>
              </div>
            </section>

            <div className="requisitionWorkspaceTabs" role="tablist" aria-label={t("Vistas de requisiciones", "Requisition views")}>
              {([
                ["control", t("Control", "Control")],
                ["queue", t("Bandeja", "Queue")],
                ["create", t("Alta", "Create")]
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={workspaceView === view}
                  className={`requisitionWorkspaceTab ${workspaceView === view ? "requisitionWorkspaceTabActive" : ""}`}
                  onClick={() => setWorkspaceView(view)}
                >
                  {label}
                </button>
              ))}
            </div>

            {workspaceView === "control" ? (
              <>
                <section className="grid cols3">
                  <KpiCard label={t("Partidas solicitadas", "Requested items")} value={String(selectedRequisition?.requestedItems ?? 0)} footnote={t("Volumen a validar antes de liberar la compra.", "Volume to validate before releasing the purchase.")} />
                  <KpiCard label={t("Tiempo de aprobación", "Approval aging")} value={`${selectedRequisition?.approvalHours ?? 0}h`} footnote={t("No dejes que la solicitud envejezca sin responsable.", "Do not let the request age without an owner.")} />
                  <KpiCard label={t("Cobertura de proveedor", "Supplier coverage")} value={String(selectedRequisition?.supplierCoverage ?? 0)} footnote={t("Alternativas identificadas para cotizar o adjudicar.", "Alternatives identified to source or award.")} />
                </section>
                <section className="grid cols2">
                  <Card title={t("Siguiente acción", "Next action")} description={t("Actualiza el compromiso que seguirá la solicitud en este corte de abastecimiento.", "Update the commitment that will guide this request in the current supply cut.")}>
                    {selectedRequisition ? (
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">{t("Solicita", "Requested by")}</div><div>{selectedRequisition.requestedBy}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Categoría", "Category")}</div><div>{selectedRequisition.category}</div></div>
                        <label className="detailRow"><div className="detailLabel">{t("Acción comprometida", "Committed action")}</div><textarea id="requisition-next-action" className="textarea" value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} placeholder={t("Ej. Validar cantidades y enviar a aprobación hoy", "E.g. Validate quantities and send for approval today")} /></label>
                      </div>
                    ) : <EmptyState title={t("Sin requisición seleccionada", "No requisition selected")} description={t("Selecciona una solicitud desde la bandeja para actualizarla.", "Select a request from the queue to update it.")} />}
                    {selectedRequisition ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" disabled={isSaving || nextActionDraft.trim().length < 8} onClick={() => void handleAction(selectedRequisition.status, selectedRequisition.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : t("Guardar acción", "Save action")}</button><Link className="buttonGhost" href={`/field?projectName=${encodeURIComponent(selectedRequisition.projectName)}`}>{t("Abrir campo", "Open field")}</Link></div> : null}
                  </Card>

                  <Card title={t("Decisión de abastecimiento", "Supply decision")} description={t(requisitionContinuityCopy.description, requisitionReleaseGate.summary)} aside={<Badge tone={requisitionReleaseGate.tone}>{t(requisitionContinuityCopy.label, requisitionReleaseGate.label)}</Badge>}>
                    <p className="sectionText">{t("El cambio de estado debe conservar presupuesto, urgencia y la ruta real de proveedor de esta necesidad.", "A status change must preserve budget, urgency and the real supplier route for this need.")}</p>
                    <div className="row gap wrap" style={{ marginTop: 18 }}>
                      {selectedRequisition ? actionOptions.map((option) => (
                        <button key={option.label} type="button" className={option.status === "blocked" ? "buttonGhost" : "button"} disabled={isSaving || (option.status === "approved" && selectedRequisition.supplierCoverage < 1) || (option.status === "sourcing" && selectedRequisition.supplierCoverage < 1)} onClick={() => void handleAction(option.status, option.nextAction)}>
                          {isSaving ? t("Guardando...", "Saving...") : localizeText(requisitionActionLabel(selectedRequisition, option.status))}
                        </button>
                      )) : null}
                    </div>
                    {selectedRequisition && actionOptions.length === 0 ? (
                      <div className="stack" style={{ marginTop: 18 }}>
                        <p className="sectionText">{t("La requisición ya está en cotización. Continúa con la orden relacionada o prepara la recepción sin reabrir la captura.", "The requisition is already in sourcing. Continue with its related order or prepare receiving without reopening intake.")}</p>
                        <div className="row gap wrap">
                          <Link className="button" href="/procurement/purchase-orders">{selectedPurchaseOrder ? `${t("Abrir", "Open")} ${selectedPurchaseOrder.code}` : t("Abrir órdenes de compra", "Open purchase orders")}</Link>
                          <Link className="buttonGhost" href={selectedPurchaseOrder ? `/inventory/receiving?purchaseReference=${encodeURIComponent(selectedPurchaseOrder.code)}&supplierName=${encodeURIComponent(selectedPurchaseOrder.supplierName)}` : "/inventory/receiving"}>{t("Preparar recepción", "Prepare receiving")}</Link>
                        </div>
                      </div>
                    ) : null}
                    {actionMessage ? <p className="formSuccess">{actionMessage}</p> : null}
                    {actionError ? <p className="formError">{actionError}</p> : null}
                  </Card>
                </section>
                <section className="grid cols2">
                  <Card title={t("Trazabilidad de obra", "Site traceability")} description={t("La requisición conserva el origen de campo cuando la necesidad nació durante la ejecución.", "The requisition keeps its field origin when demand was raised during execution.")}>
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Origen", "Origin")}</div><div>{selectedOrigin ? `${selectedOrigin.fieldRequestId} · ${selectedOrigin.summary}` : t("Captura directa de compras", "Direct procurement capture")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Necesidad", "Need")}</div><div>{selectedOrigin?.detail ?? selectedRequisition?.category ?? "-"}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Riesgos activos", "Active risks")}</div><div>{selectedRisks.length > 0 ? `${selectedRisks.length} ${t("señal(es) requieren atención", "signal(s) require attention")}` : t("Sin riesgos explícitos", "No explicit risks")}</div></div>
                    </div>
                  </Card>
                  <Card title={t("Continuar el flujo", "Continue the flow")} description={t("La requisición es el vínculo entre necesidad de obra, proveedor, orden y recepción.", "The requisition connects site demand, supplier, purchase order and receiving.")}>
                    <div className="row gap wrap">
                      <Link className="button" href="/supplier-master">{t("Proveedores", "Suppliers")}</Link>
                      <Link className="buttonGhost" href="/procurement/purchase-orders">{t("Órdenes de compra", "Purchase orders")}</Link>
                      <Link className="buttonGhost" href={selectedPurchaseOrder ? `/inventory/receiving?purchaseReference=${encodeURIComponent(selectedPurchaseOrder.code)}&supplierName=${encodeURIComponent(selectedPurchaseOrder.supplierName)}` : "/inventory/receiving"}>{t("Recepción", "Receiving")}</Link>
                    </div>
                  </Card>
                </section>
              </>
            ) : null}

            {workspaceView === "queue" ? (
              <section className="grid cols2">
                <Card title={t("Bandeja de requisiciones", "Requisition queue")} description={t("Filtra, elige una solicitud y regresa a Control para actuar.", "Filter, select a request and return to Control to act.")} aside={<Badge tone={filteredSummary.criticalUrgency > 0 ? "danger" : "success"}>{filteredSummary.criticalUrgency} {t("críticas", "critical")}</Badge>}>
                  <FilterBar summary={`${filteredRequisitions.length} ${t("requisiciones visibles", "visible requisitions")}`}>
                    <select className="field" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">{t("Todas las obras", "All projects")}</option>{projectOptions.map((projectName) => <option key={projectName} value={projectName}>{projectName}</option>)}</select>
                    <select className="field" value={urgencyFilter} onChange={(event) => setUrgencyFilter(event.target.value as typeof urgencyFilter)}><option value="all">{t("Toda urgencia", "All urgency")}</option><option value="planned">{t("Planeada", "Planned")}</option><option value="watch">{t("Atención", "Watch")}</option><option value="critical">{t("Crítica", "Critical")}</option></select>
                    <input className="field" type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Buscar código, obra, frente o categoría", "Search code, project, front or category")} />
                  </FilterBar>
                  {filteredRequisitions.length > 0 ? <div className="list">{filteredRequisitions.map((requisition) => <button key={requisition.id} type="button" className={`listItem ${selectedRequisition?.id === requisition.id ? "listItemSelected" : ""}`} onClick={() => { setSelectedRequisitionId(requisition.id); setWorkspaceView("control"); }}><div><strong>{requisition.code} · {requisition.projectName}</strong><p>{requisition.frontName} · {requisition.requestedItems} {t("partidas", "items")} · MXN {requisition.budgetAmount.toLocaleString()}</p></div><Badge tone={statusTone(requisition.status)}>{localizeText(requisitionStatusLabel(requisition.status))}</Badge></button>)}</div> : <EmptyState title={t("Sin requisiciones para estos filtros", "No requisitions for these filters")} description={t("Limpia los filtros o registra una nueva necesidad.", "Clear filters or register a new need.")} />}
                </Card>
                <Card title={selectedRequisition?.code ?? t("Selecciona una requisición", "Select a requisition")} description={selectedRequisition ? `${selectedRequisition.projectName} · ${selectedRequisition.frontName}` : t("Elige una solicitud desde la bandeja.", "Choose a request from the queue.")}>
                  {selectedRequisition ? <div className="detailGrid"><div className="detailRow"><div className="detailLabel">{t("Estado", "Status")}</div><div><Badge tone={statusTone(selectedRequisition.status)}>{localizeText(requisitionStatusLabel(selectedRequisition.status))}</Badge></div></div><div className="detailRow"><div className="detailLabel">{t("Urgencia", "Urgency")}</div><div><Badge tone={urgencyTone(selectedRequisition.urgency)}>{localizeText(requisitionUrgencyLabel(selectedRequisition.urgency))}</Badge></div></div><div className="detailRow"><div className="detailLabel">{t("Siguiente acción", "Next action")}</div><div>{selectedRequisition.nextAction}</div></div><div className="detailRow"><div className="detailLabel">{t("Cobertura", "Coverage")}</div><div>{selectedRequisition.supplierCoverage} {t("proveedores", "suppliers")}</div></div></div> : null}
                  {selectedRequisition ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" onClick={() => setWorkspaceView("control")}>{t("Abrir control", "Open control")}</button></div> : null}
                </Card>
              </section>
            ) : null}

            {workspaceView === "create" ? (
              <section className="grid cols2">
                <Card title={t("Alta de requisición", "Create requisition")} description={t("Registra una necesidad con los datos que compras, proveedor y almacén requieren para continuar.", "Register a need with the data procurement, supplier and warehouse need to continue.")}>
                  <div className="row gap wrap" style={{ marginBottom: 18 }}><button type="button" className="buttonGhost" onClick={() => setCreateForm(createRequisitionExample())}>{t("Cargar ejemplo", "Load example")}</button><button type="button" className="buttonGhost" onClick={() => setCreateForm((current) => ({ ...current, projectName: "Nueva obra", frontName: "Frente 1", requestedBy: "Residente de obra", category: "Materiales", nextAction: "" }))}>{t("Limpiar esenciales", "Clear essentials")}</button></div>
                  <div className="captureCompactGrid">
                    <label className="captureField"><span>{t("Obra", "Project")}</span><input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Frente", "Front")}</span><input className="field" value={createForm.frontName} onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Solicita", "Requested by")}</span><input className="field" value={createForm.requestedBy} onChange={(event) => setCreateForm((current) => ({ ...current, requestedBy: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Categoría", "Category")}</span><input className="field" value={createForm.category} onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))} placeholder={t("Ej. Acero de refuerzo", "E.g. Reinforcing steel")} /></label>
                    <label className="captureField"><span>{t("Partidas", "Items")}</span><input className="field" type="number" min="1" value={createForm.requestedItems} onChange={(event) => setCreateForm((current) => ({ ...current, requestedItems: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Presupuesto (MXN)", "Budget (MXN)")}</span><input className="field" type="number" min="1" value={createForm.budgetAmount} onChange={(event) => setCreateForm((current) => ({ ...current, budgetAmount: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Urgencia", "Urgency")}</span><select className="selectField" value={createForm.urgency} onChange={(event) => setCreateForm((current) => ({ ...current, urgency: event.target.value as ProcurementRequisitionContract["urgency"] }))}><option value="planned">{t("Planeada", "Planned")}</option><option value="watch">{t("Atención", "Watch")}</option><option value="critical">{t("Crítica", "Critical")}</option></select></label>
                    <label className="captureField captureFieldWide"><span>{t("Primera acción", "First action")}</span><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder={t("Ej. Validar cantidades y enviar a aprobación", "E.g. Validate quantities and send for approval")} /></label>
                  </div>
                  <details className="captureDetails"><summary>{t("Datos de control avanzados", "Advanced control data")}</summary><div className="captureCompactGrid"><label className="captureField"><span>{t("Estado inicial", "Initial status")}</span><select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ProcurementRequisitionContract["status"] }))}>{(["draft", "submitted", "approved", "sourcing", "blocked"] as ProcurementRequisitionContract["status"][]).map((status) => <option key={status} value={status}>{localizeText(requisitionStatusLabel(status))}</option>)}</select></label><label className="captureField"><span>{t("Horas de aprobación", "Approval hours")}</span><input className="field" type="number" min="0" value={createForm.approvalHours} onChange={(event) => setCreateForm((current) => ({ ...current, approvalHours: event.target.value }))} /></label><label className="captureField"><span>{t("Cobertura de proveedores", "Supplier coverage")}</span><input className="field" type="number" min="0" value={createForm.supplierCoverage} onChange={(event) => setCreateForm((current) => ({ ...current, supplierCoverage: event.target.value }))} /></label></div></details>
                  {actionError ? <p className="formError">{actionError}</p> : null}
                  <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" disabled={isSaving} onClick={() => void handleCreateRequisition()}>{isSaving ? t("Creando...", "Creating...") : t("Crear requisición", "Create requisition")}</button>{createMessage ? <Badge tone="success">{createMessage}</Badge> : null}</div>
                </Card>
                <div className="fieldWorkspaceSideStack">
                  <Card title={t("Validación previa", "Pre-creation validation")} description={t("Antes de guardar, confirma que el volumen, presupuesto y proveedor corresponden a una necesidad ejecutable.", "Before saving, confirm volume, budget and supplier correspond to an executable need.")} aside={<Badge tone={createRequisitionGate.tone}>{t(createRequisitionGate.tone === "success" ? "Lista para registrar" : createRequisitionGate.tone === "warning" ? "Registrar con control" : "Completa datos", createRequisitionGate.label)}</Badge>}>
                    <p className="sectionText">{t(createRequisitionGate.tone === "success" ? "La requisición tiene información suficiente para entrar al flujo de aprobación y abastecimiento." : "Revisa los datos esenciales antes de introducir esta solicitud al flujo de compras.", createRequisitionGate.summary)}</p>
                  </Card>
                  <Card title={t("Después del alta", "After creation")} description={t("La solicitud se selecciona automáticamente y queda lista para su siguiente movimiento.", "The request is automatically selected and ready for its next move.")}>
                    <div className="row gap wrap"><Link className="buttonGhost" href="/supplier-master">{t("Abrir proveedores", "Open suppliers")}</Link><Link className="buttonGhost" href="/procurement/purchase-orders">{t("Abrir órdenes", "Open purchase orders")}</Link><Link className="buttonGhost" href="/inventory/receiving">{t("Abrir recepción", "Open receiving")}</Link></div>
                  </Card>
                </div>
              </section>
            ) : null}

            <details className="requisitionAdvanced">
              <summary>{t("Abrir bandeja detallada y controles avanzados", "Open detailed queue and advanced controls")}</summary>
              <div className="requisitionAdvancedContent">
            <section className="grid cols4">
              <KpiCard label="Open requisitions" value={String(filteredSummary.openRequisitions)} footnote="Requests still not handed off to sourcing." />
              <KpiCard label="Pending approval" value={String(filteredSummary.pendingApproval)} footnote="Submitted requisitions still waiting for approval." />
              <KpiCard label="Critical urgency" value={String(filteredSummary.criticalUrgency)} footnote="Requests already carrying execution pressure." />
              <KpiCard label="Supplier coverage" value={`${filteredSummary.supplierCoverage}`} footnote="Average supplier paths already identified per requisition." />
              <KpiCard
                label="Field-origin links"
                value={String(overview.origins.filter((origin) => filteredRequisitions.some((item) => item.id === origin.requisitionId)).length)}
                footnote="Requisitions currently traced back to a persisted field material request within the visible board."
              />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Requisitions can be created and moved locally so the field-to-procurement handoff can be tested before live auth is ready."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Create requisitions, move them through approval and sourcing, and inspect field origin links from one board.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Capture a field material request, review it here as requisition intake, then continue to receiving once a PO exists.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols1">
              <Card
                title="Procurement continuity"
                description="This route should already connect site demand, approval, supplier coverage and downstream receiving."
              >
                <p className="sectionText">
                  Capture the requisition, review urgency and approval posture, then continue into `supplier-master`,
                  `purchase-orders` or `receiving` depending on whether the next constraint is vendor readiness, award or logistics execution.
                </p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/supplier-master">Open supplier master</Link>
                  <Link className="buttonGhost" href="/procurement/purchase-orders">Open purchase orders</Link>
                  <Link className="buttonGhost" href="/inventory/receiving">Open receiving</Link>
                  <Link className="buttonGhost" href="/field">Open field</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Requisition continuity" description="Whether the selected requisition can keep moving without operational friction.">
                <p className="sectionText">
                  {requisitionWorkflow?.continuity ?? "Choose a requisition to inspect continuity."}
                </p>
              </Card>
              <Card title="Supplier readiness" description="How much real supplier path already exists for the selected requisition.">
                <p className="sectionText">
                  {requisitionWorkflow?.supplierRead ?? "Choose a requisition to inspect supplier readiness."}
                </p>
              </Card>
              <Card title="Next recommended move" description="Fast operator guidance for the selected procurement intake.">
                <p className="sectionText">
                  {requisitionWorkflow?.nextMove ?? "Choose a requisition to inspect the next move."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Requisition board" description="Field intake, approval aging and sourcing readiness across the active tenant.">
                <FilterBar summary={`${filteredRequisitions.length} visible requisitions in the active tenant`}>
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
                    value={urgencyFilter}
                    onChange={(event) =>
                      setUrgencyFilter(event.target.value as "all" | ProcurementRequisitionContract["urgency"])
                    }
                  >
                    <option value="all">All urgency</option>
                    <option value="planned">planned</option>
                    <option value="watch">watch</option>
                    <option value="critical">critical</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search code, project, front or category"
                  />
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "requisitions ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredRequisitions}
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
                    { key: "origin", label: "Origin", render: (row) => (row.category === "Field material request" ? "field" : "procurement") },
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

                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">Release gate</div>
                        <div className="tableCellStack">
                          <Badge tone={requisitionReleaseGate.tone}>{requisitionReleaseGate.label}</Badge>
                          <span className="tableCellMuted">{requisitionReleaseGate.summary}</span>
                          {requisitionReleaseGate.checks.map((check) => (
                            <span key={check} className="tableCellMuted">
                              {check}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Why now</div>
                        <div>{requisitionWhyNow}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Downstream effect</div>
                        <div>{requisitionDownstreamEffect}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Route summary</div>
                        <div>{requisitionRouteSummary}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Next human step</div>
                        <div>{requisitionHumanStep}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Report back</div>
                        <div>{requisitionReportBack}</div>
                      </div>
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
                      {requisitionOperationalLinks.map((link, index) => (
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
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                    {selectedPurchaseOrder ? (
                      <div className="row gap wrap">
                        <Link className="button" href="/procurement/purchase-orders">
                          Open {selectedPurchaseOrder.code}
                        </Link>
                        <Link
                          className="buttonGhost"
                          href={`/inventory/receiving?purchaseReference=${encodeURIComponent(selectedPurchaseOrder.code)}&supplierName=${encodeURIComponent(selectedPurchaseOrder.supplierName)}`}
                        >
                          Continue to receiving
                        </Link>
                      </div>
                    ) : null}

                    {actionError ? <p className="text-danger">{actionError}</p> : null}
                    {actionMessage ? <p className="text-success">{actionMessage}</p> : null}

                    <Card title="Field origin" description="Original field-side context attached to this requisition, when available.">
                      {selectedOrigin ? (
                        <>
                          <div className="detailGrid">
                            <div className="detailRow">
                              <div className="detailLabel">Field request</div>
                              <div>{selectedOrigin.fieldRequestId}</div>
                            </div>
                            <div className="detailRow">
                              <div className="detailLabel">Summary</div>
                              <div>{selectedOrigin.summary}</div>
                            </div>
                            <div className="detailRow">
                              <div className="detailLabel">Requested volume</div>
                              <div>{selectedOrigin.requestedVolume}</div>
                            </div>
                            <div className="detailRow">
                              <div className="detailLabel">Field detail</div>
                              <div>{selectedOrigin.detail}</div>
                            </div>
                        <div className="detailRow">
                          <div className="detailLabel">Field next action</div>
                          <div>{selectedOrigin.nextAction}</div>
                        </div>
                      </div>
                      <div className="row gap wrap" style={{ marginTop: 16 }}>
                            <Link className="buttonGhost" href={`/field?projectName=${encodeURIComponent(selectedOrigin.projectName)}`}>
                              Open field
                            </Link>
                            <Link className="buttonGhost" href="/inventory/receiving">
                              Open receiving
                            </Link>
                          </div>
                        </>
                      ) : (
                        <EmptyState
                          title="No field origin linked"
                          description="This requisition was created directly in procurement or its field trace is not available."
                        />
                      )}
                    </Card>

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

            <section className="grid cols2">
              <Card
                title="Capture requisition"
                description="Create a procurement intake directly in the live backend or receive it automatically from field material demand."
              >
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createRequisitionExample())}>
                    Load demo example
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm({
                    projectName: "Nuevo proyecto",
                    frontName: "Frente 1",
                    requestedBy: "Field supervisor",
                    category: "Materials",
                    status: "draft",
                    requestedItems: "3",
                    budgetAmount: "125000",
                    urgency: "watch",
                    approvalHours: "6",
                    supplierCoverage: "2",
                    nextAction: ""
                  })}>
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/supplier-master">Open supplier master</Link>
                </div>
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Project</div>
                    <input
                      className="field"
                      value={createForm.projectName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Front</div>
                    <input
                      className="field"
                      value={createForm.frontName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Requested by</div>
                    <input
                      className="field"
                      value={createForm.requestedBy}
                      onChange={(event) => setCreateForm((current) => ({ ...current, requestedBy: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Category</div>
                    <input
                      className="field"
                      value={createForm.category}
                      onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))}
                      placeholder="Materials"
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Status</div>
                    <select
                      className="selectField"
                      value={createForm.status}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          status: event.target.value as ProcurementRequisitionContract["status"]
                        }))
                      }
                    >
                      <option value="draft">draft</option>
                      <option value="submitted">submitted</option>
                      <option value="approved">approved</option>
                      <option value="sourcing">sourcing</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Requested items</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.requestedItems}
                      onChange={(event) => setCreateForm((current) => ({ ...current, requestedItems: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Budget amount</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.budgetAmount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, budgetAmount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Urgency</div>
                    <select
                      className="selectField"
                      value={createForm.urgency}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          urgency: event.target.value as ProcurementRequisitionContract["urgency"]
                        }))
                      }
                    >
                      <option value="planned">planned</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Approval hours</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.approvalHours}
                      onChange={(event) => setCreateForm((current) => ({ ...current, approvalHours: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Supplier coverage</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.supplierCoverage}
                      onChange={(event) => setCreateForm((current) => ({ ...current, supplierCoverage: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder="Validar cantidades, aprobar compra y abrir cobertura con proveedores"
                    />
                  </label>
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createRequisitionGate.tone}>{createRequisitionGate.label}</Badge>
                        <span>{createRequisitionGate.summary}</span>
                      </div>
                      {createRequisitionGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{createRequisitionHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Immediate downstream</div>
                    <div>
                      {createForm.status === "blocked"
                        ? "This requisition should go back into clarification before procurement or suppliers continue."
                        : createForm.status === "approved" || createForm.status === "sourcing"
                          ? "This requisition should continue into supplier coverage and PO conversion without staying parked in intake."
                          : createForm.urgency === "critical"
                            ? "This requisition should continue into approval with a named owner in the same operating cycle."
                            : "This requisition can continue into approval or sourcing with the current intake context."}
                    </div>
                  </div>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isSaving} onClick={handleCreateRequisition}>
                    {isSaving ? "Creating..." : "Add requisition"}
                  </button>
                  {actionError ? <Badge tone="danger">{actionError}</Badge> : null}
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card
                title="Field-to-procurement path"
                description="This is the first procurement intake shape that can be fed by the field material-request workflow."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Origin</div>
                    <div>
                      {selectedOrigin
                        ? `${selectedOrigin.projectName} · ${selectedOrigin.frontName} raised ${selectedOrigin.summary} from field.`
                        : "Field supervisors or warehouse coordinators can convert urgent material pressure into a requisition."}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Behavior</div>
                    <div>
                      {selectedOrigin
                        ? `${selectedOrigin.fieldRequestId} is already persisted and linked to the selected requisition for traceability.`
                        : "The new requisition enters the board immediately, becomes the focus item and recalculates approval KPIs."}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next backend step</div>
                    <div>
                      {selectedPurchaseOrder
                        ? `${selectedPurchaseOrder.code} is already open for ${selectedPurchaseOrder.supplierName} and continues the chain into logistics and receiving.`
                        : "This field intake already persists through the live field material-request flow and lands in this board as a requisition."}
                    </div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="buttonGhost" href="/supplier-master">
                    Open supplier master
                  </Link>
                  <Link className="buttonGhost" href="/procurement/purchase-orders">
                    Open purchase orders
                  </Link>
                  {selectedPurchaseOrder ? (
                    <Link
                      className="button secondary"
                      href={`/inventory/receiving?purchaseReference=${encodeURIComponent(selectedPurchaseOrder.code)}&supplierName=${encodeURIComponent(selectedPurchaseOrder.supplierName)}`}
                    >
                      Continue to receiving
                    </Link>
                  ) : null}
                </div>
              </Card>
            </section>
              </div>
            </details>
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
