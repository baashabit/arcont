"use client";

import Link from "next/link";
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
import type { AccountsPayableInvoiceContract, AccountsPayableOverviewContract } from "@/lib/contracts";
import {
  createAccountsPayableInvoice,
  fetchAccountsPayableOverview,
  fetchSupplierMasterOverview,
  updateAccountsPayableInvoice
} from "@/lib/platform-api";

const invoiceUuidPattern = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/;
const emptyCreateForm = {
  supplierProfileId: "",
  supplierName: "",
  invoiceNumber: "",
  invoiceUuid: "",
  projectName: "",
  purchaseOrderCode: "",
  receiptCode: "",
  paymentMethod: "Transferencia",
  dueDate: "2026-07-25",
  subtotal: "100000",
  tax: "16000",
  total: "116000",
  packetCompletion: "80",
  nextAction: ""
};

function createAccountsPayableExample() {
  return {
    supplierProfileId: "",
    supplierName: "Concretos del Sureste",
    invoiceNumber: "FAC-4821",
    invoiceUuid: "A1B2C3D4-E5F6-7890-ABCD-1234567890EF",
    projectName: "Torre Demo",
    purchaseOrderCode: "PO-24031",
    receiptCode: "RCV-102",
    paymentMethod: "Transferencia",
    dueDate: "2026-07-25",
    subtotal: "100000",
    tax: "16000",
    total: "116000",
    packetCompletion: "80",
    nextAction: "Validar CFDI, expediente proveedor y programar corrida de pago."
  };
}

function tone(status: AccountsPayableInvoiceContract["satStatus"] | AccountsPayableInvoiceContract["status"]) {
  switch (status) {
    case "controlled":
    case "paid":
      return "success";
    case "watch":
    case "matched":
    case "received":
      return "warning";
    case "scheduled":
      return "info";
    default:
      return "danger";
  }
}


function buildPaymentReleaseGate(input: {
  invoice: AccountsPayableInvoiceContract | null;
  supplierReady: boolean;
  supplierProfileLabel: string | null;
  paymentDateDraft: string;
}) {
  const { invoice, supplierReady, supplierProfileLabel, paymentDateDraft } = input;

  if (!invoice) {
    return {
      tone: "info" as const,
      label: "No invoice selected",
      summary: "Choose an invoice to verify whether it is really ready for scheduling or payment.",
      checks: ["Select an invoice from the active payables board."]
    };
  }

  const checks: string[] = [];

  if (!supplierReady) {
    checks.push(`Supplier fiscal profile is still not payment-ready${supplierProfileLabel ? ` (${supplierProfileLabel})` : ""}.`);
  }

  if (invoice.satStatus === "critical") {
    checks.push("SAT posture is still critical.");
  }

  if (invoice.complementStatus === "risk") {
    checks.push("Payment complement posture is still at risk.");
  }

  if (invoice.receiptEvidenceStatus === "missing") {
    checks.push("Receiving evidence is still missing for this invoice path.");
  }

  if (invoice.packetCompletion < 100) {
    checks.push(`Fiscal packet is only ${invoice.packetCompletion}% complete.`);
  }

  if ((invoice.status === "scheduled" || invoice.status === "paid") && !paymentDateDraft) {
    checks.push("Payment date is still missing for scheduled or paid flow.");
  }

  if (invoice.status === "blocked") {
    checks.push("Invoice is already blocked and should not move into payment release.");
  }

  if (checks.length > 0) {
    return {
      tone:
        invoice.status === "blocked" || invoice.satStatus === "critical" || invoice.complementStatus === "risk"
          ? "danger" as const
          : "warning" as const,
      label:
        invoice.status === "blocked" || invoice.satStatus === "critical" || invoice.complementStatus === "risk"
          ? "Do not pay yet"
          : "Schedule with control",
      summary:
        invoice.status === "blocked" || invoice.satStatus === "critical" || invoice.complementStatus === "risk"
          ? "The invoice still has hard fiscal or workflow blockers before money should move."
          : "The invoice can continue, but payment release still needs tighter fiscal closure.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: invoice.status === "paid" ? "Already paid" : "Ready for payment release",
    summary:
      invoice.status === "paid"
        ? "The invoice is already fully released and should stay only as financial traceability."
        : "Supplier, SAT, evidence and packet posture are aligned for schedule or payment execution.",
    checks: [
      "Continue into treasury scheduling without rebuilding the same fiscal context.",
      "Keep supplier master and payment-run traceability attached to this invoice."
    ]
  };
}

function buildInvoiceWhyNow(invoice: AccountsPayableInvoiceContract | null) {
  if (!invoice) {
    return "Choose an invoice to understand why it deserves attention right now.";
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return "This invoice is already carrying a hard blocker, so waiting here can freeze payment continuity and supplier confidence.";
  }

  if (invoice.complementStatus === "risk") {
    return "Complement risk means the invoice can still fail the payment path even if receiving and supplier posture look close to ready.";
  }

  if (invoice.packetCompletion < 100) {
    return "An incomplete fiscal packet means this invoice still needs active closure before treasury should trust it.";
  }

  return "This invoice is close enough to release that the next owner should move now instead of leaving it as passive AP inventory.";
}

function buildInvoiceDownstreamEffect(invoice: AccountsPayableInvoiceContract | null) {
  if (!invoice) {
    return "Choose an invoice to inspect what it can block downstream.";
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return "The downstream effect is payment delay, treasury friction and possible supplier execution pressure.";
  }

  if (invoice.receiptEvidenceStatus === "missing") {
    return "Missing evidence here can force AP, supplier master and treasury to work around an invoice that is not really ready.";
  }

  if (invoice.complementStatus === "risk" || invoice.packetCompletion < 100) {
    return "The downstream effect is fiscal exposure and delayed release into the payment-run lane.";
  }

  return "The downstream effect is mostly sequencing discipline: keep supplier master, AP and treasury aligned so payment can move cleanly.";
}

function buildInvoiceReportBack(invoice: AccountsPayableInvoiceContract | null) {
  if (!invoice) {
    return "Choose an invoice to define the next report-back window.";
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return "Report back before the next payment-run cutoff with blocker containment and supplier-release status.";
  }

  if (invoice.complementStatus === "risk" || invoice.packetCompletion < 100) {
    return "Report back in the same operating cycle once fiscal packet and complement posture are truly release-ready.";
  }

  if (invoice.status === "scheduled") {
    return "Report back when treasury confirms the scheduled payment stayed valid and executable.";
  }

  return "Report back on the next AP refresh confirming the invoice either moved forward cleanly or was contained with explicit ownership.";
}

function buildInvoiceHumanStep(invoice: AccountsPayableInvoiceContract | null) {
  if (!invoice) {
    return "Choose an invoice to identify the next human move.";
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return "Clear the fiscal or workflow blocker first, then return to AP only when the release path is genuinely open again.";
  }

  if (invoice.receiptEvidenceStatus === "missing") {
    return "Recover receiving evidence and confirm who owns the missing proof before treasury sees this invoice as real.";
  }

  if (invoice.complementStatus === "risk" || invoice.packetCompletion < 100) {
    return "Close the fiscal packet and complement posture in the same operating cycle before scheduling payment.";
  }

  if (invoice.status === "scheduled") {
    return "Confirm the scheduled payment is still executable and keep treasury aligned on the exact bank run.";
  }

  return "Move into treasury or supplier follow-through now while the invoice is still clean enough to release without rework.";
}

function buildInvoiceRouteSummary(invoice: AccountsPayableInvoiceContract | null) {
  if (!invoice) {
    return "Use AP as the release lane between supplier fiscal control, receiving evidence and treasury execution.";
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return "This invoice should route first through supplier fiscal cleanup and AP containment before treasury touches it.";
  }

  if (invoice.receiptEvidenceStatus === "missing") {
    return "This invoice should route through receiving evidence recovery before AP treats the packet as real.";
  }

  if (invoice.complementStatus === "risk" || invoice.packetCompletion < 100) {
    return "This invoice should route through fiscal packet completion before treasury scheduling or payment execution.";
  }

  if (invoice.status === "scheduled") {
    return "This invoice should route through treasury confirmation so the scheduled payment does not drift out of validity.";
  }

  return "This invoice can continue through treasury execution with supplier and fiscal traceability intact.";
}

function buildInvoiceOperationalLinks(invoice: AccountsPayableInvoiceContract | null) {
  if (!invoice) {
    return [
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open payment runs", href: "/treasury/payment-runs" },
      { label: "Open finance", href: "/finance" }
    ];
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return [
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open finance", href: "/finance" },
      { label: "Open payment runs", href: "/treasury/payment-runs" }
    ];
  }

  if (invoice.receiptEvidenceStatus === "missing") {
    return [
      { label: "Open finance", href: "/finance" },
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open payment runs", href: "/treasury/payment-runs" }
    ];
  }

  if (invoice.complementStatus === "risk" || invoice.packetCompletion < 100) {
    return [
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open finance", href: "/finance" },
      { label: "Open payment runs", href: "/treasury/payment-runs" }
    ];
  }

  return [
    { label: "Open payment runs", href: "/treasury/payment-runs" },
    { label: "Open supplier master", href: "/supplier-master" },
    { label: "Open finance", href: "/finance" }
  ];
}

function buildCreateInvoiceGate(input: {
  supplierName: string;
  supplierProfileReady: boolean;
  supplierProfileLabel: string | null;
  invoiceNumber: string;
  invoiceUuid: string;
  projectName: string;
  purchaseOrderCode: string;
  receiptCode: string;
  subtotal: number;
  tax: number;
  total: number;
  packetCompletion: number;
  dueDate: string;
  nextAction: string;
}) {
  const checks: string[] = [];

  if (input.supplierName.trim().length < 3) {
    checks.push("Supplier name still needs more specific capture.");
  }

  if (input.invoiceNumber.trim().length < 3) {
    checks.push("Invoice number still needs more specific capture.");
  }

  if (!invoiceUuidPattern.test(input.invoiceUuid.trim().toUpperCase())) {
    checks.push("UUID still does not match valid CFDI format.");
  }

  if (input.projectName.trim().length < 3) {
    checks.push("Project name still needs more specific capture.");
  }

  if (!input.dueDate) {
    checks.push("Due date is still missing.");
  }

  if (![input.subtotal, input.tax, input.total].every((value) => Number.isFinite(value) && value >= 0)) {
    checks.push("Subtotal, tax and total must be valid non-negative amounts.");
  } else if (Math.abs(input.total - (input.subtotal + input.tax)) > 0.01) {
    checks.push("Total still does not reconcile against subtotal plus tax.");
  }

  if (!Number.isFinite(input.packetCompletion) || input.packetCompletion < 0 || input.packetCompletion > 100) {
    checks.push("Packet completion must stay between 0 and 100.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for AP follow-through.");
  }

  if (input.packetCompletion < 100) {
    checks.push(`Fiscal packet is only ${input.packetCompletion}% complete at capture time.`);
  }

  if (!input.receiptCode.trim()) {
    checks.push("Receipt code is still missing, so AP is entering with weaker receiving traceability.");
  }

  if (!input.purchaseOrderCode.trim()) {
    checks.push("PO code is still missing, so procurement traceability is thinner than ideal.");
  }

  if (!input.supplierProfileReady) {
    checks.push(
      `Supplier fiscal profile is still not payment-ready${input.supplierProfileLabel ? ` (${input.supplierProfileLabel})` : ""}.`
    );
  }

  if (checks.length > 0) {
    const hardBlock =
      !invoiceUuidPattern.test(input.invoiceUuid.trim().toUpperCase()) ||
      !input.dueDate ||
      ![input.subtotal, input.tax, input.total].every((value) => Number.isFinite(value) && value >= 0) ||
      Math.abs(input.total - (input.subtotal + input.tax)) > 0.01;

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not capture yet" : "Capture with control",
      summary: hardBlock
        ? "This invoice would enter AP with a hard fiscal or accounting blocker."
        : "The invoice can be captured, but fiscal packet or traceability still need tighter discipline.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to capture",
    summary: "The invoice has enough fiscal and operational structure to enter AP cleanly.",
    checks: [
      "The created invoice will become the current focus item immediately.",
      "Keep supplier, PO, receipt and treasury traceability attached from the first AP capture."
    ]
  };
}

function buildCreateInvoiceHumanStep(input: {
  supplierProfileReady: boolean;
  packetCompletion: number;
  receiptCode: string;
  purchaseOrderCode: string;
  nextAction: string;
}) {
  if (!input.supplierProfileReady) {
    return "Complete and control the supplier fiscal profile before expecting this invoice to move cleanly into scheduling.";
  }

  if (!input.receiptCode.trim()) {
    return "Attach the receiving trace first so AP does not inherit an invoice disconnected from real inbound evidence.";
  }

  if (!input.purchaseOrderCode.trim()) {
    return "Link the procurement reference before capture so commercial ownership stays explicit.";
  }

  if (input.packetCompletion < 100) {
    return "Capture the invoice only if someone owns the missing fiscal packet work in the same operating cycle.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the AP follow-through before persisting the invoice.";
  }

  return "Capture the invoice and move immediately into fiscal review or treasury preparation without rebuilding the same context.";
}

export default function AccountsPayablePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<AccountsPayableOverviewContract | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AccountsPayableInvoiceContract["status"]>("all");
  const [satFilter, setSatFilter] = useState<"all" | AccountsPayableInvoiceContract["satStatus"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [paymentDateDraft, setPaymentDateDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [supplierMasterHint, setSupplierMasterHint] = useState<string | null>(null);
  const [supplierMasterOverview, setSupplierMasterOverview] = useState<Awaited<ReturnType<typeof fetchSupplierMasterOverview>> | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchAccountsPayableOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSupplierMasterOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([result, supplierMaster]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Accounts payable overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSupplierMasterOverview(supplierMaster);
        setSelectedId((current) => current ?? result.focusInvoice?.id ?? result.invoices[0]?.id ?? null);
        setSupplierMasterHint(
          supplierMaster?.focusItem
            ? `${supplierMaster.focusItem.supplierName} is the current fiscal anchor with ${supplierMaster.focusItem.complianceStatus} compliance and ${supplierMaster.focusItem.satStatus} SAT posture.`
            : null
        );
        setCreateForm((current) => ({
          ...current,
          supplierProfileId: current.supplierProfileId || supplierMaster?.items[0]?.id || "",
          supplierName:
            current.supplierName || supplierMaster?.items.find((item) => item.id === (current.supplierProfileId || supplierMaster?.items[0]?.id))?.supplierName || ""
        }));
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

  const filteredInvoices = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.invoices.filter((invoice) => {
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesSat = satFilter === "all" || invoice.satStatus === satFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        invoice.code.toLowerCase().includes(normalizedSearch) ||
        invoice.supplierName.toLowerCase().includes(normalizedSearch) ||
        invoice.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
        invoice.projectName.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSat && matchesSearch;
    });
  }, [overview, satFilter, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => {
    const now = Date.now();
    return {
      trackedInvoices: filteredInvoices.length,
      openAmount: Number(filteredInvoices.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)),
      scheduledAmount: Number(
        filteredInvoices.filter((item) => item.status === "scheduled").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)
      ),
      blockedInvoices: filteredInvoices.filter((item) => item.status === "blocked").length,
      criticalInvoices: filteredInvoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length,
      overdueInvoices: filteredInvoices.filter((item) => item.status !== "paid" && Date.parse(item.dueDate) < now).length
    };
  }, [filteredInvoices]);

  const selectedInvoice = useMemo(
    () => filteredInvoices.find((invoice) => invoice.id === selectedId) ?? filteredInvoices[0] ?? null,
    [filteredInvoices, selectedId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.invoiceId === selectedInvoice?.id) ?? [],
    [overview, selectedInvoice]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredInvoices.length === 0) {
      setSelectedId(null);
      return;
    }

    const isSelectedVisible = filteredInvoices.some((invoice) => invoice.id === selectedId);
    if (!isSelectedVisible) {
      setSelectedId(filteredInvoices[0]?.id ?? null);
    }
  }, [filteredInvoices, overview, selectedId]);

  useEffect(() => {
    setNextActionDraft(selectedInvoice?.nextAction ?? "");
    setPaymentDateDraft(selectedInvoice?.scheduledPaymentDate?.slice(0, 10) ?? "");
    setMessage(null);
    setError(null);
  }, [selectedInvoice?.id, selectedInvoice?.nextAction, selectedInvoice?.scheduledPaymentDate]);

  const availableSupplierProfiles = useMemo(() => supplierMasterOverview?.items ?? [], [supplierMasterOverview]);
  const selectedInvoiceSupplierProfile = useMemo(() => {
    if (!selectedInvoice?.supplierProfileId) {
      return null;
    }

    return availableSupplierProfiles.find((item) => item.id === selectedInvoice.supplierProfileId) ?? null;
  }, [availableSupplierProfiles, selectedInvoice?.supplierProfileId]);
  const selectedInvoiceSupplierReadyForPayment = useMemo(
    () =>
      selectedInvoiceSupplierProfile
        ? selectedInvoiceSupplierProfile.complianceStatus === "complete" && selectedInvoiceSupplierProfile.satStatus === "controlled"
        : false,
    [selectedInvoiceSupplierProfile]
  );
  const paymentReleaseGate = useMemo(
    () =>
      buildPaymentReleaseGate({
        invoice: selectedInvoice,
        supplierReady: selectedInvoiceSupplierReadyForPayment,
        supplierProfileLabel: selectedInvoiceSupplierProfile
          ? `${selectedInvoiceSupplierProfile.complianceStatus} / ${selectedInvoiceSupplierProfile.satStatus}`
          : null,
        paymentDateDraft
      }),
    [paymentDateDraft, selectedInvoice, selectedInvoiceSupplierProfile, selectedInvoiceSupplierReadyForPayment]
  );
  const selectedInvoiceWhyNow = useMemo(() => buildInvoiceWhyNow(selectedInvoice), [selectedInvoice]);
  const selectedInvoiceDownstreamEffect = useMemo(() => buildInvoiceDownstreamEffect(selectedInvoice), [selectedInvoice]);
  const selectedInvoiceReportBack = useMemo(() => buildInvoiceReportBack(selectedInvoice), [selectedInvoice]);
  const selectedInvoiceHumanStep = useMemo(() => buildInvoiceHumanStep(selectedInvoice), [selectedInvoice]);
  const selectedInvoiceRouteSummary = useMemo(() => buildInvoiceRouteSummary(selectedInvoice), [selectedInvoice]);
  const selectedInvoiceOperationalLinks = useMemo(() => buildInvoiceOperationalLinks(selectedInvoice), [selectedInvoice]);
  const createSelectedSupplierProfile = useMemo(
    () => availableSupplierProfiles.find((item) => item.id === createForm.supplierProfileId) ?? null,
    [availableSupplierProfiles, createForm.supplierProfileId]
  );
  const createInvoiceGate = useMemo(
    () =>
      buildCreateInvoiceGate({
        supplierName: createForm.supplierName,
        supplierProfileReady: createSelectedSupplierProfile
          ? createSelectedSupplierProfile.complianceStatus === "complete" && createSelectedSupplierProfile.satStatus === "controlled"
          : false,
        supplierProfileLabel: createSelectedSupplierProfile
          ? `${createSelectedSupplierProfile.complianceStatus} / ${createSelectedSupplierProfile.satStatus}`
          : null,
        invoiceNumber: createForm.invoiceNumber,
        invoiceUuid: createForm.invoiceUuid,
        projectName: createForm.projectName,
        purchaseOrderCode: createForm.purchaseOrderCode,
        receiptCode: createForm.receiptCode,
        subtotal: Number(createForm.subtotal),
        tax: Number(createForm.tax),
        total: Number(createForm.total),
        packetCompletion: Number(createForm.packetCompletion),
        dueDate: createForm.dueDate,
        nextAction: createForm.nextAction
      }),
    [createForm, createSelectedSupplierProfile]
  );
  const createInvoiceHumanStep = useMemo(
    () =>
      buildCreateInvoiceHumanStep({
        supplierProfileReady: createSelectedSupplierProfile
          ? createSelectedSupplierProfile.complianceStatus === "complete" && createSelectedSupplierProfile.satStatus === "controlled"
          : false,
        packetCompletion: Number(createForm.packetCompletion),
        receiptCode: createForm.receiptCode,
        purchaseOrderCode: createForm.purchaseOrderCode,
        nextAction: createForm.nextAction
      }),
    [createForm.nextAction, createForm.packetCompletion, createForm.purchaseOrderCode, createForm.receiptCode, createSelectedSupplierProfile]
  );

  useEffect(() => {
    if (!createForm.supplierProfileId) {
      return;
    }

    const selectedProfile = availableSupplierProfiles.find((item) => item.id === createForm.supplierProfileId);
    if (!selectedProfile) {
      return;
    }

    setCreateForm((current) =>
      current.supplierName === selectedProfile.supplierName
        ? current
        : {
            ...current,
            supplierName: selectedProfile.supplierName
          }
    );
  }, [availableSupplierProfiles, createForm.supplierProfileId]);

  function refreshSummary(invoices: AccountsPayableInvoiceContract[]) {
    const now = Date.now();
    return {
      trackedInvoices: invoices.length,
      openAmount: Number(invoices.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)),
      scheduledAmount: Number(
        invoices.filter((item) => item.status === "scheduled").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)
      ),
      blockedInvoices: invoices.filter((item) => item.status === "blocked").length,
      criticalInvoices: invoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length,
      overdueInvoices: invoices.filter((item) => item.status !== "paid" && Date.parse(item.dueDate) < now).length
    };
  }

  async function handleUpdate(
    status: AccountsPayableInvoiceContract["status"],
    satStatus: AccountsPayableInvoiceContract["satStatus"],
    complementStatus: AccountsPayableInvoiceContract["complementStatus"]
  ) {
    if (!selectedInvoice) {
      return;
    }

    const nextAction = nextActionDraft.trim();
    if (nextAction.length < 8) {
      setError("Next action must explain the fiscal or payment follow-up.");
      return;
    }

    if ((status === "scheduled" || status === "paid") && !selectedInvoiceSupplierReadyForPayment) {
      setError("Supplier profile must be complete and controlled before scheduling or paying.");
      return;
    }

    if ((status === "scheduled" || status === "paid") && !paymentDateDraft) {
      setError("Payment date is required before scheduling or paying an invoice.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);
    const response = await updateAccountsPayableInvoice(
      selectedInvoice.id,
      activeCompany.id,
      {
        status,
        satStatus,
        complementStatus,
        scheduledPaymentDate: paymentDateDraft || null,
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Accounts payable update failed.");
      setIsSaving(false);
      return;
    }

    const updated = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const invoices = current.invoices.map((item) => (item.id === updated.id ? updated : item));
      return {
        ...current,
        summary: refreshSummary(invoices),
        invoices,
        focusInvoice: current.focusInvoice?.id === updated.id ? updated : current.focusInvoice
      };
    });
    setMessage(`Invoice ${updated.code} moved to ${updated.status}.`);
    setIsSaving(false);
  }

  async function handleCreate() {
    if (!overview) {
      return;
    }

    const subtotal = Number(createForm.subtotal);
    const tax = Number(createForm.tax);
    const total = Number(createForm.total);
    const packetCompletion = Number(createForm.packetCompletion);
    const supplierName = createForm.supplierName.trim();
    const invoiceNumber = createForm.invoiceNumber.trim();
    const invoiceUuid = createForm.invoiceUuid.trim().toUpperCase();
    const projectName = createForm.projectName.trim();
    const nextAction = createForm.nextAction.trim();

    if (supplierName.length < 3) {
      setError("Supplier name must contain at least 3 characters.");
      return;
    }

    if (invoiceNumber.length < 3) {
      setError("Invoice number must contain at least 3 characters.");
      return;
    }

    if (!invoiceUuidPattern.test(invoiceUuid)) {
      setError("UUID must use a valid CFDI format.");
      return;
    }

    if (projectName.length < 3) {
      setError("Project name must contain at least 3 characters.");
      return;
    }

    if (!createForm.dueDate) {
      setError("Due date is required.");
      return;
    }

    if (![subtotal, tax, total].every((value) => Number.isFinite(value) && value >= 0)) {
      setError("Subtotal, tax and total must be valid non-negative amounts.");
      return;
    }

    if (Math.abs(total - (subtotal + tax)) > 0.01) {
      setError("Total must equal subtotal plus tax.");
      return;
    }

    if (!Number.isFinite(packetCompletion) || packetCompletion < 0 || packetCompletion > 100) {
      setError("Packet completion must be between 0 and 100.");
      return;
    }

    if (nextAction.length < 8) {
      setError("Next action must describe the payables follow-up.");
      return;
    }

    setError(null);
    setMessage(null);

    const response = await createAccountsPayableInvoice(
      activeCompany.id,
      {
        supplierProfileId: createForm.supplierProfileId || null,
        supplierName,
        invoiceNumber,
        invoiceUuid,
        projectName,
        purchaseOrderCode: createForm.purchaseOrderCode.trim() || null,
        receiptCode: createForm.receiptCode.trim() || null,
        status: "received",
        satStatus: "watch",
        complementStatus: "pending",
        receiptEvidenceStatus: "partial",
        paymentMethod: createForm.paymentMethod,
        dueDate: createForm.dueDate,
        scheduledPaymentDate: null,
        subtotal,
        tax,
        total,
        packetCompletion,
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Accounts payable invoice creation failed.");
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const invoices = [created, ...current.invoices];
      return {
        ...current,
        summary: refreshSummary(invoices),
        invoices,
        focusInvoice: created
      };
    });
    setSelectedId(created.id);
    setCreateForm((current) => ({
      ...emptyCreateForm,
      supplierProfileId: current.supplierProfileId || emptyCreateForm.supplierProfileId,
      supplierName:
        availableSupplierProfiles.find((item) => item.id === (current.supplierProfileId || emptyCreateForm.supplierProfileId))?.supplierName || ""
    }));
    setMessage(`${created.code} created for ${created.supplierName}.`);
  }

  return (
    <AppShell
      title="Accounts Payable"
      eyebrow="Finance execution"
      description="Supplier invoices, CFDI posture and payment-run readiness tied to receiving evidence."
    >
      <ModuleGate moduleKeys={["finance.accounting"]} requiredPermissions={["finance:*", "finance:read"]} title="Accounts payable">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Invoices" value={String(filteredSummary.trackedInvoices)} footnote="CXP invoices currently visible in this tenant." />
              <KpiCard label="Open amount" value={`MXN ${filteredSummary.openAmount.toLocaleString()}`} footnote="Pending amount still pressing treasury." />
              <KpiCard label="Blocked" value={String(filteredSummary.blockedInvoices)} footnote="Invoices blocked by fiscal, receipt or commercial issues." />
              <KpiCard label="Overdue" value={String(filteredSummary.overdueInvoices)} footnote="Invoices already past due and still unresolved." />
            </section>

            <section className="grid cols3">
              <Card
                title="Payment readiness walkthrough"
                description="Create invoices, validate fiscal packet posture and move them toward treasury without backend dependency."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    The operator flow is already testable: capture invoice, connect supplier fiscal profile, schedule payment, then release treasury.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">supplier master</Badge>
                    <Badge tone="info">accounts payable</Badge>
                    <Badge tone="info">treasury next</Badge>
                  </div>
                  <div className="actionRow">
                    <Link className="buttonSecondary" href="/supplier-master">
                      Open supplier master
                    </Link>
                    <Link className="buttonGhost" href="/treasury/payment-runs">
                      Open payment runs
                    </Link>
                  </div>
                </div>
              </Card>
            </section>

            <section className="grid cols1">
              <Card
                title="Payment release workflow"
                description="This route should already connect supplier fiscal readiness, invoice capture and treasury release in one usable chain."
              >
                <p className="sectionText">
                  Capture the invoice, verify the linked supplier profile, move it through matching and scheduling, and continue into
                  `supplier-master` or `payment-runs` depending on whether the blocker is fiscal packet or treasury execution.
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Payables board" description="Facturas, CFDI and payment scheduling in one queue.">
                <FilterBar summary={`${filteredInvoices.length} invoices in the active tenant`}>
                  <select
                    className="selectField"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "all" | AccountsPayableInvoiceContract["status"])}
                  >
                    <option value="all">All status</option>
                    <option value="received">received</option>
                    <option value="matched">matched</option>
                    <option value="scheduled">scheduled</option>
                    <option value="blocked">blocked</option>
                    <option value="paid">paid</option>
                  </select>
                  <select
                    className="selectField"
                    value={satFilter}
                    onChange={(event) => setSatFilter(event.target.value as "all" | AccountsPayableInvoiceContract["satStatus"])}
                  >
                    <option value="all">All SAT</option>
                    <option value="controlled">controlled</option>
                    <option value="watch">watch</option>
                    <option value="critical">critical</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search invoice, supplier, number or project"
                  />
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "payables ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredInvoices}
                  columns={[
                    {
                      key: "invoice",
                      label: "Invoice",
                      render: (row) => (
                        <button type="button" className="buttonGhost" onClick={() => setSelectedId(row.id)} style={{ justifyContent: "flex-start", paddingInline: 0 }}>
                          <div className="tableCellStack">
                            <strong>{row.code}</strong>
                            <span className="tableCellMuted">{row.supplierName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "cfdi",
                      label: "CFDI",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.invoiceNumber}</strong>
                          <span className="tableCellMuted">{row.complementStatus}</span>
                        </div>
                      )
                    },
                    {
                      key: "amount",
                      label: "Amount",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.total.toLocaleString()}</strong>
                          <span className="tableCellMuted">Pending MXN {row.pendingAmount.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <Badge tone={tone(row.status)}>{row.status}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected invoice"
                description="Operational and fiscal release conditions before money leaves the company."
                aside={selectedInvoice ? <Badge tone={tone(selectedInvoice.satStatus)}>{selectedInvoice.satStatus}</Badge> : null}
              >
                {selectedInvoice ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Supplier</div><div>{selectedInvoice.supplierName}</div></div>
                    <div className="detailRow"><div className="detailLabel">Supplier profile</div><div>{selectedInvoiceSupplierProfile ? `${selectedInvoiceSupplierProfile.complianceStatus} / ${selectedInvoiceSupplierProfile.satStatus}` : "No linked supplier master profile"}</div></div>
                    <div className="detailRow"><div className="detailLabel">UUID</div><div>{selectedInvoice.invoiceUuid}</div></div>
                    <div className="detailRow"><div className="detailLabel">PO / Receipt</div><div>{selectedInvoice.purchaseOrderCode ?? "No PO"} / {selectedInvoice.receiptCode ?? "No receipt"}</div></div>
                    <div className="detailRow"><div className="detailLabel">Evidence</div><div>{selectedInvoice.receiptEvidenceStatus}</div></div>
                    <div className="detailRow"><div className="detailLabel">Packet</div><div>{selectedInvoice.packetCompletion}%</div></div>
                    <div className="detailRow"><div className="detailLabel">Payment readiness</div><div>{selectedInvoiceSupplierReadyForPayment ? "Supplier profile ready for payment flow" : "Supplier profile still not payment-ready"}</div></div>
                    <div className="detailRow"><div className="detailLabel">Payment release gate</div><div className="tableCellStack"><Badge tone={paymentReleaseGate.tone}>{paymentReleaseGate.label}</Badge><span className="tableCellMuted">{paymentReleaseGate.summary}</span>{paymentReleaseGate.checks.map((check) => <span key={check} className="tableCellMuted">{check}</span>)}</div></div>
                    <div className="detailRow"><div className="detailLabel">Next human step</div><div>{selectedInvoiceHumanStep}</div></div>
                    <div className="detailRow"><div className="detailLabel">Why now</div><div>{selectedInvoiceWhyNow}</div></div>
                    <div className="detailRow"><div className="detailLabel">Downstream effect</div><div>{selectedInvoiceDownstreamEffect}</div></div>
                    <div className="detailRow"><div className="detailLabel">Route summary</div><div>{selectedInvoiceRouteSummary}</div></div>
                    <div className="detailRow"><div className="detailLabel">Report back</div><div>{selectedInvoiceReportBack}</div></div>
                    <label className="detailRow"><div className="detailLabel">Payment date</div><input className="field" type="date" value={paymentDateDraft} onChange={(event) => setPaymentDateDraft(event.target.value)} /></label>
                    <label className="stack">
                      <span className="detailLabel">Next action</span>
                      <textarea className="field" rows={4} value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} />
                    </label>
                    <div className="cluster">
                      <button type="button" className="button" disabled={isSaving} onClick={() => void handleUpdate("matched", "watch", "pending")}>Mark Matched</button>
                      <button type="button" className="button" disabled={isSaving || !selectedInvoiceSupplierReadyForPayment} onClick={() => void handleUpdate("scheduled", "watch", "complete")}>Schedule Payment</button>
                      <button type="button" className="buttonGhost" disabled={isSaving} onClick={() => void handleUpdate("blocked", "critical", "risk")}>Block Invoice</button>
                      <button type="button" className="button" disabled={isSaving || !selectedInvoiceSupplierReadyForPayment} onClick={() => void handleUpdate("paid", "controlled", "complete")}>Mark Paid</button>
                    </div>
                    <div className="row gap wrap">
                      {selectedInvoiceOperationalLinks.map((link) => (
                        <Link key={`${link.href}-${link.label}`} className="buttonGhost" href={link.href}>{link.label}</Link>
                      ))}
                    </div>
                    {!selectedInvoiceSupplierReadyForPayment ? <Badge tone="warning">Complete and control the supplier fiscal profile before scheduling or paying.</Badge> : null}
                    {message ? <Badge tone="success">{message}</Badge> : null}
                    {error ? <Badge tone="danger">{error}</Badge> : null}
                  </div>
                ) : (
                  <EmptyState title="Select an invoice" description="Choose an invoice to inspect fiscal and payment release conditions." />
                )}
              </Card>

              <Card title="Invoice risks" description="Active blockers tied to the selected invoice.">
                {selectedRisks.length > 0 ? (
                  <DataTable
                    rows={selectedRisks}
                    columns={[
                      { key: "risk", label: "Risk", render: (row) => row.title },
                      { key: "category", label: "Category", render: (row) => row.category },
                      {
                        key: "severity",
                        label: "Severity",
                        render: (row) => (
                          <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>
                            {row.severity}
                          </Badge>
                        )
                      }
                    ]}
                  />
                ) : (
                  <EmptyState title="No mapped risks" description="The selected invoice has no mapped blockers right now." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Register invoice" description="Capture a payable invoice directly in the tenant backend.">
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm((current) => ({
                        ...createAccountsPayableExample(),
                        supplierProfileId: current.supplierProfileId,
                        supplierName:
                          availableSupplierProfiles.find((item) => item.id === current.supplierProfileId)?.supplierName ||
                          createAccountsPayableExample().supplierName
                      }))
                    }
                  >
                    Load demo example
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm((current) => ({
                        ...emptyCreateForm,
                        supplierProfileId: current.supplierProfileId || emptyCreateForm.supplierProfileId,
                        supplierName:
                          availableSupplierProfiles.find((item) => item.id === (current.supplierProfileId || emptyCreateForm.supplierProfileId))?.supplierName || ""
                      }))
                    }
                  >
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/supplier-master">Open supplier master</Link>
                  <Link className="buttonGhost" href="/treasury/payment-runs">Open payment runs</Link>
                </div>
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Supplier profile</div><select className="selectField" value={createForm.supplierProfileId} onChange={(event) => setCreateForm((current) => ({ ...current, supplierProfileId: event.target.value }))}><option value="">No linked profile</option>{availableSupplierProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.supplierName} · {profile.complianceStatus} · {profile.satStatus}</option>)}</select></label>
                  <label className="detailRow"><div className="detailLabel">Supplier</div><input className="field" value={createForm.supplierName} onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Invoice number</div><input className="field" value={createForm.invoiceNumber} onChange={(event) => setCreateForm((current) => ({ ...current, invoiceNumber: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">UUID</div><input className="field" value={createForm.invoiceUuid} onChange={(event) => setCreateForm((current) => ({ ...current, invoiceUuid: event.target.value.toUpperCase() }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Project</div><input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">PO code</div><input className="field" value={createForm.purchaseOrderCode} onChange={(event) => setCreateForm((current) => ({ ...current, purchaseOrderCode: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Receipt code</div><input className="field" value={createForm.receiptCode} onChange={(event) => setCreateForm((current) => ({ ...current, receiptCode: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Subtotal</div><input className="field" type="number" value={createForm.subtotal} onChange={(event) => setCreateForm((current) => ({ ...current, subtotal: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Tax</div><input className="field" type="number" value={createForm.tax} onChange={(event) => setCreateForm((current) => ({ ...current, tax: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Total</div><input className="field" type="number" value={createForm.total} onChange={(event) => setCreateForm((current) => ({ ...current, total: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Packet completion</div><input className="field" type="number" value={createForm.packetCompletion} onChange={(event) => setCreateForm((current) => ({ ...current, packetCompletion: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createInvoiceGate.tone}>{createInvoiceGate.label}</Badge>
                        <span>{createInvoiceGate.summary}</span>
                      </div>
                      {createInvoiceGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">{check}</span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{createInvoiceHumanStep}</div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" onClick={() => void handleCreate()}>Add Invoice</button>
                  {supplierMasterHint ? <Badge tone="info">{supplierMasterHint}</Badge> : null}
                </div>
              </Card>

              <Card title="Release rules" description="These constraints prevent fake control or premature payment release.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">SAT control</div><div>Controlled SAT posture requires 100% packet completion.</div></div>
                  <div className="detailRow"><div className="detailLabel">Scheduling</div><div>Scheduled and paid invoices require payment date and at least partial receiving evidence.</div></div>
                  <div className="detailRow"><div className="detailLabel">Supplier fiscal health</div><div>Blocked or critical supplier profiles cannot register invoices for payment flow, and scheduled/paid invoices require supplier fiscal profile in complete + controlled status.</div></div>
                  <div className="detailRow"><div className="detailLabel">Paid state</div><div>Paid invoices require complete or not-required complement status; the pending amount drops to zero.</div></div>
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState title="Accounts payable unavailable" description={error ?? "We could not load accounts payable for this company."} />
        )}
      </ModuleGate>
    </AppShell>
  );
}
