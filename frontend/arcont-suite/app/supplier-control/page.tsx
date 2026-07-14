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
import type { SupplierControlLineContract, SupplierControlOverviewContract } from "@/lib/contracts";
import {
  createSupplierControlLine,
  fetchInventoryReceivingOverview,
  fetchProcurementPurchaseOrdersOverview,
  fetchSupplierControlOverview,
  updateSupplierControlLine
} from "@/lib/platform-api";

function healthTone(status: SupplierControlLineContract["deliveryHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function actionOptions(line: SupplierControlLineContract) {
  switch (line.deliveryHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          deliveryHealth: "watch" as const,
          nextAction: "Contain the current supplier blocker and keep the vendor under daily operating review"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          deliveryHealth: "critical" as const,
          nextAction: "Escalate supplier concentration, compliance or approval pressure to procurement leadership"
        },
        {
          label: "Mark controlled",
          deliveryHealth: "controlled" as const,
          nextAction: "Supplier risk is contained and competition plus compliance are back within tolerance"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          deliveryHealth: "watch" as const,
          nextAction: "Start monitoring this supplier before concentration or approval aging worsens"
        }
      ];
  }
}

function recomputeSummary(lines: SupplierControlLineContract[]) {
  return {
    trackedSuppliers: lines.length,
    concentratedSuppliers: lines.filter((item) => item.concentrationPercent >= 28).length,
    awardedVolume: lines.reduce((sum, item) => sum + (item.awardedPackages > 0 ? item.contractedAmount : 0), 0),
    averageBidCoverage:
      lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.bidCoverage, 0) / lines.length).toFixed(1)) : 0,
    criticalSuppliers: lines.filter((item) => item.deliveryHealth === "critical").length,
    complianceAlerts: lines.reduce((sum, item) => sum + item.complianceAlerts, 0)
  };
}

function pickFocusLine(lines: SupplierControlLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.deliveryHealth === "critical" && right.deliveryHealth !== "critical") {
          return -1;
        }
        if (left.deliveryHealth !== "critical" && right.deliveryHealth === "critical") {
          return 1;
        }
        return right.contractedAmount - left.contractedAmount;
      })[0] ?? null
  );
}

type SupplierBridgeContext = {
  purchaseOrders: NonNullable<Awaited<ReturnType<typeof fetchProcurementPurchaseOrdersOverview>>>;
  receiving: NonNullable<Awaited<ReturnType<typeof fetchInventoryReceivingOverview>>>;
} | null;

function buildSupplierBridge(line: SupplierControlLineContract | null, bridge: SupplierBridgeContext) {
  if (!line) {
    return null;
  }

  const purchaseSignal = bridge?.purchaseOrders.focusPurchaseOrder ?? null;
  const receivingSignal = bridge?.receiving.focusReceipt ?? null;

  return {
    executionImpact:
      line.deliveryHealth === "critical"
        ? `${line.supplierName} is already threatening live execution through concentration, blocked packages or approval aging.`
        : line.deliveryHealth === "watch"
          ? `${line.supplierName} still needs active review before it becomes an execution blocker.`
          : `${line.supplierName} is currently operating within acceptable delivery posture.`,
    procurementDependency: purchaseSignal
      ? `${purchaseSignal.code} is the current PO anchor with status ${purchaseSignal.status} and invoice posture ${purchaseSignal.invoiceMatchStatus}.`
      : "No linked purchase-order anchor is currently in focus.",
    receivingExposure: receivingSignal
      ? `${receivingSignal.code} remains at ${receivingSignal.status} with PO posture ${receivingSignal.purchaseOrderStatus} and invoice posture ${receivingSignal.invoiceMatchStatus}.`
      : "No linked receiving exposure is currently in focus."
  };
}

function buildSupplierContinuationGate(line: SupplierControlLineContract | null) {
  if (!line) {
    return {
      tone: "info" as const,
      label: "No supplier selected",
      summary: "Choose a supplier to verify whether commercial continuity is really under control.",
      checks: ["Select a supplier lane to review concentration, approvals and compliance posture."]
    };
  }

  const checks: string[] = [];

  if (line.deliveryHealth === "critical") {
    checks.push("Delivery health is already critical, so new volume should not be released normally.");
  }

  if (line.concentrationPercent >= 35) {
    checks.push(`Concentration is ${line.concentrationPercent}%, so dependency is already too high.`);
  }

  if (line.bidCoverage < 2) {
    checks.push(`Bid coverage is only ${line.bidCoverage.toFixed(1)}, so competition is still too thin.`);
  }

  if (line.approvalPressureHours >= 24) {
    checks.push(`Approval pressure has aged to ${line.approvalPressureHours.toFixed(1)} hours.`);
  }

  if (line.complianceAlerts > 0) {
    checks.push(`${line.complianceAlerts} compliance alert(s) still need closure.`);
  }

  if (checks.length > 0) {
    return {
      tone:
        line.deliveryHealth === "critical" || line.concentrationPercent >= 35 || line.complianceAlerts > 0
          ? "danger" as const
          : "warning" as const,
      label:
        line.deliveryHealth === "critical" || line.concentrationPercent >= 35 || line.complianceAlerts > 0
          ? "Do not expand volume"
          : "Expand with control",
      summary:
        line.deliveryHealth === "critical" || line.concentrationPercent >= 35 || line.complianceAlerts > 0
          ? "The supplier still has hard commercial blockers before more volume should be committed."
          : "The supplier can continue operating, but the lane still needs active supervision before more commitments.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Commercial lane aligned",
    summary: "Competition, approvals and compliance are currently stable enough for normal continuation.",
    checks: [
      "Confirm the next PO or receiving milestone is already owned.",
      "Keep the next action aligned with procurement and receiving follow-through."
    ]
  };
}

function buildSupplierWhyNow(line: SupplierControlLineContract | null) {
  if (!line) {
    return "Select a supplier lane to understand which commercial pressure should be contained now.";
  }

  if (line.deliveryHealth === "critical") {
    return `${line.supplierName} already carries critical delivery posture with ${line.concentrationPercent}% concentration and ${line.approvalPressureHours.toFixed(1)} approval hours under stress.`;
  }

  if (line.complianceAlerts > 0) {
    return `${line.supplierName} still has ${line.complianceAlerts} compliance alert(s), so more volume would amplify avoidable operating risk.`;
  }

  if (line.bidCoverage < 2 || line.concentrationPercent >= 28) {
    return `${line.supplierName} still needs tighter competition and concentration control before procurement treats this lane as comfortably stable.`;
  }

  return `${line.supplierName} is currently controlled, but the lane still needs explicit follow-through to keep competition, approvals and continuity aligned.`;
}

function buildSupplierDownstreamEffect(line: SupplierControlLineContract | null) {
  if (!line) {
    return "Select a supplier lane to inspect what downstream teams will inherit the pressure.";
  }

  if (line.deliveryHealth === "critical") {
    return "If this supplier remains critical, requisitions, purchase orders, receiving and accounts payable will all inherit avoidable friction.";
  }

  if (line.complianceAlerts > 0) {
    return "If compliance alerts remain open, receiving-critical volume and fiscal release timing will degrade next.";
  }

  if (line.bidCoverage < 2) {
    return "If competition stays thin, procurement loses negotiating room and projects absorb concentration risk as soon as volume grows.";
  }

  return "If this lane stays controlled, procurement, receiving and payment release can continue without unnecessary supplier noise.";
}

function buildSupplierReportBack(line: SupplierControlLineContract | null) {
  if (!line) {
    return "Select a supplier lane to define the next procurement checkpoint.";
  }

  if (line.deliveryHealth === "critical") {
    return "Report back in the next procurement cut once containment owner, alternative source and approval unblock are confirmed.";
  }

  if (line.complianceAlerts > 0) {
    return "Report back as soon as the compliance alert is formally closed and the supplier lane can re-enter normal release.";
  }

  if (line.bidCoverage < 2 || line.concentrationPercent >= 28) {
    return "Report back after the next sourcing or negotiation checkpoint with updated coverage and concentration posture.";
  }

  return "Report back in the next supplier review confirming the lane stayed controlled and ready for normal continuation.";
}

function buildSupplierHumanStep(line: SupplierControlLineContract | null) {
  if (!line) {
    return "Select a supplier lane to identify the next human move.";
  }

  if (line.deliveryHealth === "critical") {
    return "Contain the supplier blocker first, confirm the alternative source and keep procurement leadership on the same cycle.";
  }

  if (line.complianceAlerts > 0) {
    return "Close the compliance alert now before more volume or approvals continue through this lane.";
  }

  if (line.bidCoverage < 2 || line.concentrationPercent >= 28) {
    return "Open the next sourcing or negotiation step now so competition and concentration improve before the lane hardens.";
  }

  return "Keep the next package, approval and receiving milestone aligned while the supplier lane is still controlled.";
}

function buildSupplierRouteSummary(line: SupplierControlLineContract | null) {
  if (!line) {
    return "Use supplier control as the commercial bridge between supplier master, purchasing, receiving and payables.";
  }

  if (line.deliveryHealth === "critical") {
    return "This lane should route first through procurement containment and supplier escalation before more packages continue downstream.";
  }

  if (line.complianceAlerts > 0) {
    return "This lane should route through supplier master and compliance cleanup before receiving or payables trust it.";
  }

  if (line.bidCoverage < 2 || line.concentrationPercent >= 28) {
    return "This lane should route through sourcing and package competition before volume concentration widens further.";
  }

  return "This lane can continue through purchase orders, receiving and payables without rebuilding the same supplier context.";
}

function buildSupplierOperationalLinks(line: SupplierControlLineContract | null) {
  if (!line) {
    return [
      { label: "Open purchase orders", href: "/procurement/purchase-orders" },
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open receiving", href: "/inventory/receiving" }
    ];
  }

  if (line.deliveryHealth === "critical") {
    return [
      { label: "Open purchase orders", href: "/procurement/purchase-orders" },
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open accounts payable", href: "/accounts-payable" }
    ];
  }

  if (line.complianceAlerts > 0) {
    return [
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open accounts payable", href: "/accounts-payable" },
      { label: "Open receiving", href: "/inventory/receiving" }
    ];
  }

  return [
    { label: "Open purchase orders", href: "/procurement/purchase-orders" },
    { label: "Open receiving", href: "/inventory/receiving" },
    { label: "Open accounts payable", href: "/accounts-payable" }
  ];
}

function validateSupplierCreateForm(input: {
  awardedPackages: number;
  activePackages: number;
  contractedAmount: number;
  concentrationPercent: number;
  bidCoverage: number;
  approvalPressureHours: number;
  complianceAlerts: number;
}) {
  if (!Number.isFinite(input.awardedPackages) || input.awardedPackages < 0) {
    return "Awarded packages must be zero or greater.";
  }

  if (!Number.isFinite(input.activePackages) || input.activePackages < 0) {
    return "Active packages must be zero or greater.";
  }

  if (input.awardedPackages < input.activePackages) {
    return "Awarded packages cannot be lower than active packages.";
  }

  if (!Number.isFinite(input.contractedAmount) || input.contractedAmount <= 0) {
    return "Contracted amount must be greater than zero.";
  }

  if (!Number.isFinite(input.concentrationPercent) || input.concentrationPercent < 0 || input.concentrationPercent > 100) {
    return "Concentration must stay between 0% and 100%.";
  }

  if (!Number.isFinite(input.bidCoverage) || input.bidCoverage < 0 || input.bidCoverage > 10) {
    return "Bid coverage must stay between 0 and 10.";
  }

  if (!Number.isFinite(input.approvalPressureHours) || input.approvalPressureHours < 0) {
    return "Approval pressure must be zero or greater.";
  }

  if (!Number.isFinite(input.complianceAlerts) || input.complianceAlerts < 0) {
    return "Compliance alerts must be zero or greater.";
  }

  return null;
}

function createSupplierControlExample() {
  return {
    supplierName: "Concretos del Sureste",
    owner: "Procurement lead",
    awardedPackages: "3",
    activePackages: "2",
    contractedAmount: "2850000",
    concentrationPercent: "31",
    bidCoverage: "2.1",
    deliveryHealth: "watch" as SupplierControlLineContract["deliveryHealth"],
    approvalPressureHours: "12",
    complianceAlerts: "1",
    nextAction: "Asegurar proveedor alterno y cerrar expediente comercial antes de liberar mas volumen."
  };
}

function buildCreateSupplierGate(input: {
  supplierName: string;
  owner: string;
  awardedPackages: number;
  activePackages: number;
  contractedAmount: number;
  concentrationPercent: number;
  bidCoverage: number;
  deliveryHealth: SupplierControlLineContract["deliveryHealth"];
  approvalPressureHours: number;
  complianceAlerts: number;
  nextAction: string;
}) {
  const checks: string[] = [];

  if ([input.supplierName, input.owner].some((value) => value.trim().length < 3)) {
    checks.push("Supplier name and owner still need more specific capture.");
  }

  if (!Number.isFinite(input.awardedPackages) || input.awardedPackages < 0) {
    checks.push("Awarded packages must be zero or greater.");
  }

  if (!Number.isFinite(input.activePackages) || input.activePackages < 0) {
    checks.push("Active packages must be zero or greater.");
  }

  if (input.awardedPackages < input.activePackages) {
    checks.push("Awarded packages cannot be lower than active packages.");
  }

  if (!Number.isFinite(input.contractedAmount) || input.contractedAmount <= 0) {
    checks.push("Contracted amount must be greater than zero.");
  }

  if (!Number.isFinite(input.concentrationPercent) || input.concentrationPercent < 0 || input.concentrationPercent > 100) {
    checks.push("Concentration must stay between 0% and 100%.");
  }

  if (!Number.isFinite(input.bidCoverage) || input.bidCoverage < 0 || input.bidCoverage > 10) {
    checks.push("Bid coverage must stay between 0 and 10.");
  }

  if (input.bidCoverage < 2) {
    checks.push("Bid coverage is still too thin for a clean supplier lane.");
  }

  if (!Number.isFinite(input.approvalPressureHours) || input.approvalPressureHours < 0) {
    checks.push("Approval pressure must be zero or greater.");
  }

  if (input.approvalPressureHours >= 24) {
    checks.push("Approval pressure is already too old for a clean new supplier lane.");
  }

  if (!Number.isFinite(input.complianceAlerts) || input.complianceAlerts < 0) {
    checks.push("Compliance alerts must be zero or greater.");
  }

  if (input.complianceAlerts > 0) {
    checks.push("Compliance alerts still need closure before this lane should be treated as fully clean.");
  }

  if (input.deliveryHealth === "critical") {
    checks.push("Critical health at creation means the supplier should only open with explicit containment.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for procurement follow-through.");
  }

  if (checks.length > 0) {
    const hardBlock =
      !Number.isFinite(input.contractedAmount) ||
      input.contractedAmount <= 0 ||
      input.awardedPackages < input.activePackages ||
      input.concentrationPercent > 100 ||
      input.bidCoverage < 1 ||
      input.complianceAlerts > 0 ||
      input.deliveryHealth === "critical";

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This supplier lane would open with a hard commercial blocker."
        : "The supplier can be created, but procurement discipline still needs tightening.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The supplier lane has enough structure to enter procurement execution cleanly.",
    checks: [
      "The created supplier will become the current focus lane immediately.",
      "Keep competition, approvals and next action attached from the first capture."
    ]
  };
}

function buildCreateSupplierHumanStep(input: {
  bidCoverage: number;
  complianceAlerts: number;
  approvalPressureHours: number;
  nextAction: string;
}) {
  if (input.complianceAlerts > 0) {
    return "Close the commercial or fiscal alert first so the supplier does not open already compromised.";
  }

  if (input.bidCoverage < 2) {
    return "Strengthen competitive coverage before creating the supplier lane.";
  }

  if (input.approvalPressureHours >= 24) {
    return "Clear approval aging before opening the supplier so the first PO does not start under pressure.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the immediate procurement action before persisting the supplier lane.";
  }

  return "Create the supplier lane and continue directly into requisition, purchase-order or receiving follow-through.";
}

export default function SupplierControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<SupplierControlOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<SupplierBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | SupplierControlLineContract["deliveryHealth"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    supplierName: "",
    owner: "Procurement lead",
    awardedPackages: "1",
    activePackages: "1",
    contractedAmount: "1250000",
    concentrationPercent: "18",
    bidCoverage: "2.5",
    deliveryHealth: "controlled" as SupplierControlLineContract["deliveryHealth"],
    approvalPressureHours: "8",
    complianceAlerts: "0",
    nextAction: ""
  });
  const createFormNumbers = useMemo(
    () => ({
      awardedPackages: Number(createForm.awardedPackages),
      activePackages: Number(createForm.activePackages),
      contractedAmount: Number(createForm.contractedAmount),
      concentrationPercent: Number(createForm.concentrationPercent),
      bidCoverage: Number(createForm.bidCoverage),
      approvalPressureHours: Number(createForm.approvalPressureHours),
      complianceAlerts: Number(createForm.complianceAlerts)
    }),
    [createForm.activePackages, createForm.approvalPressureHours, createForm.awardedPackages, createForm.bidCoverage, createForm.complianceAlerts, createForm.concentrationPercent, createForm.contractedAmount]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchSupplierControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchProcurementPurchaseOrdersOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchInventoryReceivingOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, purchaseOrders, receiving]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Supplier control overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
        setBridgeContext(purchaseOrders && receiving ? { purchaseOrders, receiving } : null);
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

  const filteredLines = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.lines.filter((line) => {
      const matchesHealth = healthFilter === "all" || line.deliveryHealth === healthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        line.supplierName.toLowerCase().includes(normalizedSearch) ||
        line.owner.toLowerCase().includes(normalizedSearch) ||
        line.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesSearch;
    });
  }, [healthFilter, overview, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedStory = useMemo(() => buildSupplierBridge(selectedLine, bridgeContext), [bridgeContext, selectedLine]);
  const continuationGate = useMemo(() => buildSupplierContinuationGate(selectedLine), [selectedLine]);
  const selectedHumanStep = useMemo(() => buildSupplierHumanStep(selectedLine), [selectedLine]);
  const selectedWhyNow = useMemo(() => buildSupplierWhyNow(selectedLine), [selectedLine]);
  const selectedDownstreamEffect = useMemo(() => buildSupplierDownstreamEffect(selectedLine), [selectedLine]);
  const selectedReportBack = useMemo(() => buildSupplierReportBack(selectedLine), [selectedLine]);
  const selectedRouteSummary = useMemo(() => buildSupplierRouteSummary(selectedLine), [selectedLine]);
  const selectedOperationalLinks = useMemo(() => buildSupplierOperationalLinks(selectedLine), [selectedLine]);
  const createSupplierGate = useMemo(
    () =>
      buildCreateSupplierGate({
        supplierName: createForm.supplierName,
        owner: createForm.owner,
        awardedPackages: createFormNumbers.awardedPackages,
        activePackages: createFormNumbers.activePackages,
        contractedAmount: createFormNumbers.contractedAmount,
        concentrationPercent: createFormNumbers.concentrationPercent,
        bidCoverage: createFormNumbers.bidCoverage,
        deliveryHealth: createForm.deliveryHealth,
        approvalPressureHours: createFormNumbers.approvalPressureHours,
        complianceAlerts: createFormNumbers.complianceAlerts,
        nextAction: createForm.nextAction
      }),
    [createForm, createFormNumbers]
  );
  const createSupplierHumanStep = useMemo(
    () =>
      buildCreateSupplierHumanStep({
        bidCoverage: createFormNumbers.bidCoverage,
        complianceAlerts: createFormNumbers.complianceAlerts,
        approvalPressureHours: createFormNumbers.approvalPressureHours,
        nextAction: createForm.nextAction
      }),
    [createForm.nextAction, createFormNumbers]
  );

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredLines.length === 0) {
      setSelectedLineId(null);
      return;
    }

    const isSelectedVisible = filteredLines.some((line) => line.id === selectedLineId);
    if (!isSelectedVisible) {
      setSelectedLineId(filteredLines[0]?.id ?? null);
    }
  }, [filteredLines, overview, selectedLineId]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleAction(
    deliveryHealth: SupplierControlLineContract["deliveryHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the supplier.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateSupplierControlLine(
      selectedLine.id,
      activeCompany.id,
      {
        deliveryHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Supplier control update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const lines = current.lines.map((item) => (item.id === response.data?.id ? response.data : item));

      return {
        ...current,
        summary: recomputeSummary(lines),
        lines,
        focusLine: pickFocusLine(lines)
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Supplier moved to ${response.data.deliveryHealth}.`);
    setIsSaving(false);
  }

  async function handleCreateSupplier() {
    if (!overview) {
      return;
    }

    const supplierName = createForm.supplierName.trim();
    const owner = createForm.owner.trim();
    const nextAction = createForm.nextAction.trim();
    const numericInput = {
      awardedPackages: Number(createForm.awardedPackages),
      activePackages: Number(createForm.activePackages),
      contractedAmount: Number(createForm.contractedAmount),
      concentrationPercent: Number(createForm.concentrationPercent),
      bidCoverage: Number(createForm.bidCoverage),
      approvalPressureHours: Number(createForm.approvalPressureHours),
      complianceAlerts: Number(createForm.complianceAlerts)
    };

    if (supplierName.length < 3 || owner.length < 3) {
      setActionError("Supplier name and owner must be specific before creating the supplier lane.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before creating the supplier lane.");
      setCreateMessage(null);
      return;
    }

    const numericValidation = validateSupplierCreateForm(numericInput);
    if (numericValidation) {
      setActionError(numericValidation);
      setCreateMessage(null);
      return;
    }

    const response = await createSupplierControlLine(
      activeCompany.id,
      {
        supplierName,
        owner,
        awardedPackages: numericInput.awardedPackages,
        activePackages: numericInput.activePackages,
        contractedAmount: numericInput.contractedAmount,
        concentrationPercent: numericInput.concentrationPercent,
        bidCoverage: numericInput.bidCoverage,
        deliveryHealth: createForm.deliveryHealth,
        approvalPressureHours: numericInput.approvalPressureHours,
        complianceAlerts: numericInput.complianceAlerts,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Supplier creation failed.");
      setCreateMessage(null);
      return;
    }

    const createdLine = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const lines = [createdLine, ...current.lines];
      return {
        ...current,
        summary: recomputeSummary(lines),
        lines,
        focusLine: pickFocusLine(lines)
      };
    });
    setSelectedLineId(createdLine.id);
    setNextActionDraft(nextAction);
    setActionError(null);
    setCreateMessage(`${supplierName} added to the supplier workbench.`);
    setCreateForm({
      supplierName: "",
      owner,
      awardedPackages: "1",
      activePackages: "1",
      contractedAmount: "1250000",
      concentrationPercent: "18",
      bidCoverage: "2.5",
      deliveryHealth: "controlled",
      approvalPressureHours: "8",
      complianceAlerts: "0",
      nextAction: ""
    });
  }

  return (
    <AppShell
      title="Supplier Control"
      eyebrow="Commercial execution"
      description="Supplier concentration, competition and operating reliability managed as a live procurement board."
    >
      <ModuleGate
        moduleKeys={["procurement.purchasing"]}
        requiredPermissions={["procurement:*"]}
        title="Supplier control"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked suppliers"
                value={String(filteredSummary.trackedSuppliers)}
                footnote="Suppliers currently carrying live contracted volume in the tenant."
              />
              <KpiCard
                label="Concentrated"
                value={String(filteredSummary.concentratedSuppliers)}
                footnote="Suppliers already above concentration tolerance."
              />
              <KpiCard
                label="Awarded volume"
                value={`MXN ${filteredSummary.awardedVolume.toLocaleString()}`}
                footnote="Volume already sitting on suppliers with at least one awarded package."
              />
              <KpiCard
                label="Compliance alerts"
                value={String(filteredSummary.complianceAlerts)}
                footnote="Open commercial or operating alerts still attached to the current supplier base."
              />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Supplier concentration and delivery posture can be tested locally before procurement auth and live data are fully enabled."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Create supplier lanes, move them between controlled, watch and critical, and inspect their effect on purchasing and receiving.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Register a concentrated supplier, escalate it to critical, then contain it to validate the board before live procurement is connected.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols1">
              <Card
                title="Supplier continuity workflow"
                description="This route should already let the operator move from supplier concentration to fiscal readiness and then to payment release."
              >
                <p className="sectionText">
                  Work the supplier lane, inspect purchase-order and receiving exposure, then continue into `supplier-master`,
                  `accounts-payable` or `purchase-orders` depending on whether the blocker is commercial, documentary or payment-related.
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Execution impact" description="How this supplier is already shaping real delivery posture.">
                <p className="sectionText">
                  {selectedStory?.executionImpact ?? "Choose a supplier to inspect execution impact."}
                </p>
              </Card>
              <Card title="Procurement dependency" description="Purchase-order signal currently attached to the supplier lane.">
                <p className="sectionText">
                  {selectedStory?.procurementDependency ?? "Choose a supplier to inspect procurement dependency."}
                </p>
              </Card>
              <Card title="Receiving exposure" description="Inbound exposure still tied to this supplier posture.">
                <p className="sectionText">
                  {selectedStory?.receivingExposure ?? "Choose a supplier to inspect receiving exposure."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Supplier board" description="Commercial concentration, bid coverage and approval pressure across the current supplier base.">
                <FilterBar summary={`${filteredLines.length} supplier lines match the current operating filters`}>
                  <label className="fieldLabel">
                    Delivery health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="watch">Watch</option>
                      <option value="controlled">Controlled</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Supplier, owner or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "supplier control ready"}</Badge>
                  <Badge tone={filteredSummary.criticalSuppliers > 0 ? "danger" : filteredSummary.concentratedSuppliers > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalSuppliers > 0
                      ? `${filteredSummary.criticalSuppliers} critical`
                      : filteredSummary.concentratedSuppliers > 0
                        ? `${filteredSummary.concentratedSuppliers} concentrated`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "supplier",
                      label: "Supplier",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.supplierName}</strong>
                            <span className="tableCellMuted">{row.owner}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "volume",
                      label: "Volume",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.contractedAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">{row.concentrationPercent}% concentration</span>
                        </div>
                      )
                    },
                    {
                      key: "coverage",
                      label: "Coverage",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.bidCoverage.toFixed(1)} bids</strong>
                          <span className="tableCellMuted">{row.approvalPressureHours.toFixed(1)} h approval pressure</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.deliveryHealth)}>{row.deliveryHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected supplier"
                description="Commercial posture, concentration and the next supplier-control action."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.deliveryHealth)}>{selectedLine.deliveryHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Awarded packages</div>
                      <div>{selectedLine.awardedPackages}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Active packages</div>
                      <div>{selectedLine.activePackages}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Bid coverage</div>
                      <div>{selectedLine.bidCoverage.toFixed(1)}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Compliance alerts</div>
                      <div>{selectedLine.complianceAlerts}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{selectedHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{selectedWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{selectedDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report back</div>
                      <div>{selectedReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Route summary</div>
                      <div>{selectedRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Continuation gate</div>
                      <div className="tableCellStack">
                        <Badge tone={continuationGate.tone}>{continuationGate.label}</Badge>
                        <span className="tableCellMuted">{continuationGate.summary}</span>
                        {continuationGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">
                            {check}
                          </span>
                        ))}
                      </div>
                    </div>

                    <label className="stack" htmlFor="supplier-control-next-action">
                      <span className="detailLabel">Next action</span>
                      <textarea
                        id="supplier-control-next-action"
                        className="field"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder="Describe the next supplier, competition or escalation action"
                      />
                    </label>

                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.deliveryHealth, action.nextAction)}
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                    <div className="row gap wrap">
                      {selectedOperationalLinks.map((link, index) => (
                        <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                          {link.label}
                        </Link>
                      ))}
                    </div>

                    {actionError ? <EmptyState title="Update blocked" description={actionError} /> : null}
                    {actionMessage ? <EmptyState title="Supplier updated" description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState
                    title="Select a supplier"
                    description="Choose a supplier from the board to inspect concentration, alerts and next action."
                  />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Register supplier lane"
                description={
                  isDemoMode
                    ? "Create a supplier-control record in local demo persistence so the board can be tested end to end."
                    : "Create a new supplier-control record directly in the tenant backend."
                }
              >
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createSupplierControlExample())}>
                    Load demo example
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        supplierName: "",
                        owner: "Procurement lead",
                        awardedPackages: "1",
                        activePackages: "1",
                        contractedAmount: "1250000",
                        concentrationPercent: "18",
                        bidCoverage: "2.5",
                        deliveryHealth: "controlled",
                        approvalPressureHours: "8",
                        complianceAlerts: "0",
                        nextAction: ""
                      })
                    }
                  >
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/supplier-master">Open supplier master</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Open accounts payable</Link>
                </div>
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Supplier</div>
                    <input
                      className="field"
                      value={createForm.supplierName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))}
                      placeholder="Concretos del Sureste"
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Owner</div>
                    <input
                      className="field"
                      value={createForm.owner}
                      onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Awarded packages</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.awardedPackages}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, awardedPackages: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Active packages</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.activePackages}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, activePackages: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Contracted amount</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.contractedAmount}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, contractedAmount: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Concentration %</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.concentrationPercent}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, concentrationPercent: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Bid coverage</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={createForm.bidCoverage}
                      onChange={(event) => setCreateForm((current) => ({ ...current, bidCoverage: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Health</div>
                    <select
                      className="selectField"
                      value={createForm.deliveryHealth}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          deliveryHealth: event.target.value as SupplierControlLineContract["deliveryHealth"]
                        }))
                      }
                    >
                      <option value="controlled">controlled</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Approval pressure h</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.approvalPressureHours}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, approvalPressureHours: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Compliance alerts</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.complianceAlerts}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, complianceAlerts: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder="Cerrar competencia, validar expediente fiscal y amarrar ventana de entrega"
                    />
                  </label>
                </div>

                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createSupplierGate.tone}>{createSupplierGate.label}</Badge>
                        <span>{createSupplierGate.summary}</span>
                      </div>
                      {createSupplierGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{createSupplierHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Immediate downstream</div>
                    <div>
                      {createForm.deliveryHealth === "critical"
                        ? "Do not release live requisitions or purchase orders until the supplier lane is contained."
                        : createFormNumbers.complianceAlerts > 0
                          ? "Keep the supplier out of receiving-critical volume until compliance is cleared."
                          : "The supplier can continue into requisitions, purchase orders and receiving with normal supervision."}
                    </div>
                  </div>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" onClick={() => void handleCreateSupplier()}>
                    Add supplier lane
                  </button>
                  <Link className="buttonGhost" href="/procurement/requisitions">Open requisitions</Link>
                  <Link className="buttonGhost" href="/procurement/purchase-orders">Open purchase orders</Link>
                  <Link className="buttonGhost" href="/inventory/receiving">Open receiving</Link>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card
                title="Workbench rules"
                description="The creation flow now writes directly into the tenant workbench and stays aligned with backend rules."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Scope</div>
                    <div>New supplier lanes are stored in the active tenant and immediately reshape concentration metrics.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Selection</div>
                    <div>The new supplier becomes the selected lane so procurement can act on it immediately.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Backend path</div>
                    <div>This intake already uses `POST /supplier-control/lines` and remains consistent with future procurement integrations.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Operational handoff</div>
                    <div>The first useful action after creation should be obvious enough to continue straight into requisitions, purchase orders or receiving.</div>
                  </div>
                </div>
              </Card>
            </section>

            <Card title="Supplier risks" description="Open supplier, competition and approval risks mapped to the selected supplier.">
              {selectedRisks.length > 0 ? (
                <DataTable
                  rows={selectedRisks}
                  columns={[
                    {
                      key: "risk",
                      label: "Risk",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.title}</strong>
                          <span className="tableCellMuted">{row.category}</span>
                        </div>
                      )
                    },
                    {
                      key: "severity",
                      label: "Severity",
                      render: (row) => (
                        <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>
                          {row.severity}
                        </Badge>
                      )
                    },
                    {
                      key: "owner",
                      label: "Owner",
                      render: (row) => row.owner
                    }
                  ]}
                />
              ) : (
                <EmptyState
                  title="No mapped supplier risks"
                  description="Select a supplier with active pressure to inspect its current commercial risks."
                />
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title={error ?? "Supplier control unavailable"}
            description="We could not load the live supplier board for the selected company."
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
