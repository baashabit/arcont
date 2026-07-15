"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

function paymentRouteLabel(href: string) {
  switch (href) {
    case "/supplier-master":
      return { es: "Abrir proveedores", en: "Open suppliers" };
    case "/treasury/payment-runs":
      return { es: "Abrir corridas de pago", en: "Open payment runs" };
    default:
      return { es: "Abrir finanzas", en: "Open finance" };
  }
}

function invoiceStatusLabel(status: AccountsPayableInvoiceContract["status"]) {
  switch (status) {
    case "received":
      return { es: "Recibida", en: "Received" };
    case "matched":
      return { es: "Conciliada", en: "Matched" };
    case "scheduled":
      return { es: "Programada", en: "Scheduled" };
    case "blocked":
      return { es: "Bloqueada", en: "Blocked" };
    default:
      return { es: "Pagada", en: "Paid" };
  }
}

function invoiceSatLabel(status: AccountsPayableInvoiceContract["satStatus"]) {
  switch (status) {
    case "controlled":
      return { es: "SAT controlado", en: "SAT controlled" };
    case "watch":
      return { es: "SAT en vigilancia", en: "SAT watch" };
    default:
      return { es: "SAT crítico", en: "SAT critical" };
  }
}

function invoiceEvidenceLabel(status: AccountsPayableInvoiceContract["receiptEvidenceStatus"]) {
  switch (status) {
    case "complete":
      return { es: "Recepción completa", en: "Receiving complete" };
    case "partial":
      return { es: "Recepción parcial", en: "Receiving partial" };
    default:
      return { es: "Recepción faltante", en: "Receiving missing" };
  }
}

function buildInvoiceDuePulse(invoice: AccountsPayableInvoiceContract) {
  if (invoice.status === "paid") {
    return {
      tone: "success" as const,
      label: { es: "Pagada", en: "Paid" },
      helper: { es: "Sin presión de vencimiento", en: "No due pressure" },
      daysUntilDue: null
    };
  }

  if (invoice.status === "scheduled" && invoice.scheduledPaymentDate) {
    return {
      tone: "info" as const,
      label: { es: "Pago programado", en: "Payment scheduled" },
      helper: { es: `Corre para ${invoice.scheduledPaymentDate}`, en: `Runs on ${invoice.scheduledPaymentDate}` },
      daysUntilDue: null
    };
  }

  const daysUntilDue = Math.ceil((Date.parse(invoice.dueDate) - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysUntilDue < 0) {
    return {
      tone: "danger" as const,
      label: { es: "Vencida", en: "Overdue" },
      helper: {
        es: `${Math.abs(daysUntilDue)} día(s) fuera de fecha`,
        en: `${Math.abs(daysUntilDue)} day(s) overdue`
      },
      daysUntilDue
    };
  }

  if (daysUntilDue <= 3) {
    return {
      tone: "warning" as const,
      label: { es: "Vence pronto", en: "Due soon" },
      helper: { es: `Vence en ${daysUntilDue} día(s)`, en: `Due in ${daysUntilDue} day(s)` },
      daysUntilDue
    };
  }

  return {
    tone: "success" as const,
    label: { es: "En tiempo", en: "On time" },
    helper: { es: `Vence en ${daysUntilDue} día(s)`, en: `Due in ${daysUntilDue} day(s)` },
    daysUntilDue
  };
}

function buildInvoiceReleaseLane(
  invoice: AccountsPayableInvoiceContract,
  supplierReady: boolean
) {
  if (invoice.status === "paid") {
    return {
      key: "paid",
      tone: "success" as const,
      label: { es: "Pagada", en: "Paid" },
      helper: {
        es: "Mantener conciliación y trazabilidad",
        en: "Keep reconciliation and traceability"
      }
    };
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return {
      key: "blocked",
      tone: "danger" as const,
      label: { es: "Bloqueo fiscal", en: "Fiscal blocker" },
      helper: {
        es: "No liberar hasta contener SAT o flujo",
        en: "Do not release until SAT or workflow is contained"
      }
    };
  }

  if (!supplierReady) {
    return {
      key: "supplier",
      tone: "warning" as const,
      label: { es: "Proveedor", en: "Supplier" },
      helper: {
        es: "Completa cumplimiento y SAT del proveedor",
        en: "Complete supplier compliance and SAT posture"
      }
    };
  }

  if (invoice.receiptEvidenceStatus !== "complete") {
    return {
      key: "receiving",
      tone: "warning" as const,
      label: { es: "Recepción", en: "Receiving" },
      helper: {
        es: "Recupera evidencia antes de tesorería",
        en: "Recover receiving evidence before treasury"
      }
    };
  }

  if (invoice.complementStatus === "risk" || invoice.complementStatus === "pending" || invoice.packetCompletion < 100) {
    return {
      key: "fiscal_packet",
      tone: "warning" as const,
      label: { es: "Expediente fiscal", en: "Fiscal packet" },
      helper: {
        es: "Completa complemento y expediente",
        en: "Complete complement and packet"
      }
    };
  }

  if (invoice.status === "scheduled") {
    return {
      key: "scheduled",
      tone: "info" as const,
      label: { es: "En corrida", en: "In payment run" },
      helper: {
        es: "Sigue pendiente de ejecución bancaria",
        en: "Still pending bank execution"
      }
    };
  }

  return {
    key: "treasury_ready",
    tone: "success" as const,
    label: { es: "Lista para tesorería", en: "Ready for treasury" },
    helper: {
      es: "Puede pasar a programación de pago",
      en: "Can move into payment scheduling"
    }
  };
}

function buildInvoiceHumanStepSpanish(invoice: AccountsPayableInvoiceContract | null) {
  if (!invoice) {
    return "Selecciona una factura para definir el siguiente movimiento.";
  }

  if (invoice.status === "blocked" || invoice.satStatus === "critical") {
    return "Resuelve primero el bloqueo fiscal o de flujo y vuelve a cuentas por pagar cuando la liberación sea real.";
  }

  if (invoice.receiptEvidenceStatus === "missing") {
    return "Recupera la evidencia de recepción y confirma quién es responsable antes de enviar la factura a tesorería.";
  }

  if (invoice.complementStatus === "risk" || invoice.packetCompletion < 100) {
    return "Completa el expediente fiscal y el complemento en este mismo ciclo antes de programar el pago.";
  }

  if (invoice.status === "scheduled") {
    return "Confirma que el pago programado sigue siendo ejecutable y conserva la corrida bancaria exacta.";
  }

  return "Continúa a tesorería o al seguimiento de proveedor mientras la factura sigue limpia para liberarse sin retrabajo.";
}

function buildPaymentReleaseGateChecksSpanish(input: {
  invoice: AccountsPayableInvoiceContract | null;
  supplierReady: boolean;
  supplierProfileLabel: string | null;
  paymentDateDraft: string;
}) {
  const { invoice, supplierReady, supplierProfileLabel, paymentDateDraft } = input;

  if (!invoice) {
    return ["Selecciona una factura desde la bandeja activa."];
  }

  const checks: string[] = [];
  if (!supplierReady) {
    checks.push(`El perfil fiscal del proveedor aún no está listo para pago${supplierProfileLabel ? ` (${supplierProfileLabel})` : ""}.`);
  }
  if (invoice.satStatus === "critical") {
    checks.push("La postura ante SAT sigue en estado crítico.");
  }
  if (invoice.complementStatus === "risk") {
    checks.push("El complemento de pago sigue en riesgo.");
  }
  if (invoice.receiptEvidenceStatus === "missing") {
    checks.push("Aún falta la evidencia de recepción para esta factura.");
  }
  if (invoice.packetCompletion < 100) {
    checks.push(`El expediente fiscal solo está completo al ${invoice.packetCompletion}%.`);
  }
  if ((invoice.status === "scheduled" || invoice.status === "paid") && !paymentDateDraft) {
    checks.push("Aún falta la fecha de pago para una factura programada o pagada.");
  }
  if (invoice.status === "blocked") {
    checks.push("La factura ya está bloqueada y no debe pasar a liberación de pago.");
  }

  return checks.length > 0
    ? checks
    : [
        "Continúa a la programación de tesorería sin reconstruir el contexto fiscal.",
        "Conserva la trazabilidad de proveedor y corrida de pago en esta factura."
      ];
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

function buildCreateInvoiceGateChecksSpanish(input: {
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
    checks.push("El nombre del proveedor todavía necesita una captura más específica.");
  }

  if (input.invoiceNumber.trim().length < 3) {
    checks.push("El número de factura todavía necesita una captura más específica.");
  }

  if (!invoiceUuidPattern.test(input.invoiceUuid.trim().toUpperCase())) {
    checks.push("El UUID todavía no coincide con un formato CFDI válido.");
  }

  if (input.projectName.trim().length < 3) {
    checks.push("El nombre de la obra todavía necesita una captura más específica.");
  }

  if (!input.dueDate) {
    checks.push("Todavía falta la fecha de vencimiento.");
  }

  if (![input.subtotal, input.tax, input.total].every((value) => Number.isFinite(value) && value >= 0)) {
    checks.push("Subtotal, impuesto y total deben ser importes válidos no negativos.");
  } else if (Math.abs(input.total - (input.subtotal + input.tax)) > 0.01) {
    checks.push("El total todavía no concilia contra subtotal más impuesto.");
  }

  if (!Number.isFinite(input.packetCompletion) || input.packetCompletion < 0 || input.packetCompletion > 100) {
    checks.push("El expediente debe mantenerse entre 0 y 100.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("La siguiente acción todavía necesita suficiente detalle para seguimiento de CXP.");
  }

  if (input.packetCompletion < 100) {
    checks.push(`El expediente fiscal solo está completo al ${input.packetCompletion}% al momento de captura.`);
  }

  if (!input.receiptCode.trim()) {
    checks.push("Todavía falta el código de recepción, así que CXP entra con trazabilidad de recepción más débil.");
  }

  if (!input.purchaseOrderCode.trim()) {
    checks.push("Todavía falta la OC, así que la trazabilidad de compras es más delgada de lo ideal.");
  }

  if (!input.supplierProfileReady) {
    checks.push(`El perfil fiscal del proveedor todavía no está listo para pago${input.supplierProfileLabel ? ` (${input.supplierProfileLabel})` : ""}.`);
  }

  return checks.length > 0
    ? checks
    : [
        "La factura creada quedará como foco actual de inmediato.",
        "Conserva proveedor, OC, recepción y trazabilidad de tesorería desde la primera captura de CXP."
      ];
}

function buildCreateInvoiceHumanStepSpanish(input: {
  supplierProfileReady: boolean;
  packetCompletion: number;
  receiptCode: string;
  purchaseOrderCode: string;
  nextAction: string;
}) {
  if (!input.supplierProfileReady) {
    return "Completa y controla el perfil fiscal del proveedor antes de esperar que esta factura pase limpia a programación.";
  }

  if (!input.receiptCode.trim()) {
    return "Adjunta primero la trazabilidad de recepción para que CXP no herede una factura desconectada de la evidencia real.";
  }

  if (!input.purchaseOrderCode.trim()) {
    return "Liga la referencia de compras antes de capturar para que la responsabilidad comercial siga explícita.";
  }

  if (input.packetCompletion < 100) {
    return "Captura la factura solo si alguien es dueño del cierre del expediente fiscal en este mismo ciclo operativo.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Aclara el seguimiento de CXP antes de persistir la factura.";
  }

  return "Captura la factura y muévela de inmediato a revisión fiscal o preparación de tesorería sin reconstruir el mismo contexto.";
}

export default function AccountsPayablePage() {
  const { activeCompany, apiBaseUrl, session, localizeText, uiLanguage } = useAppState();
  const t = useCallback((es: string, en: string) => localizeText({ es, en }), [localizeText]);
  const [overview, setOverview] = useState<AccountsPayableOverviewContract | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AccountsPayableInvoiceContract["status"]>("all");
  const [satFilter, setSatFilter] = useState<"all" | AccountsPayableInvoiceContract["satStatus"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [paymentDateDraft, setPaymentDateDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [supplierMasterHint, setSupplierMasterHint] = useState<string | null>(null);
  const [supplierMasterOverview, setSupplierMasterOverview] = useState<Awaited<ReturnType<typeof fetchSupplierMasterOverview>> | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  useEffect(() => {
    let cancelled = false;
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
          setError(t("El resumen de cuentas por pagar no está disponible ahora mismo.", "Accounts payable overview is unavailable right now."));
          return;
        }

        setOverview(result);
        setSupplierMasterOverview(supplierMaster);
        setSelectedId((current) => current ?? result.focusInvoice?.id ?? result.invoices[0]?.id ?? null);
        setSupplierMasterHint(
          supplierMaster?.focusItem
            ? t(
                `${supplierMaster.focusItem.supplierName} es el ancla fiscal actual con cumplimiento ${supplierMaster.focusItem.complianceStatus} y postura SAT ${supplierMaster.focusItem.satStatus}.`,
                `${supplierMaster.focusItem.supplierName} is the current fiscal anchor with ${supplierMaster.focusItem.complianceStatus} compliance and ${supplierMaster.focusItem.satStatus} SAT posture.`
              )
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
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, session.accessToken, t]);

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
  const supplierProfilesById = useMemo(
    () => new Map(availableSupplierProfiles.map((profile) => [profile.id, profile])),
    [availableSupplierProfiles]
  );
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
  const selectedInvoiceHumanStep = useMemo(() => buildInvoiceHumanStep(selectedInvoice), [selectedInvoice]);
  const selectedInvoiceOperationalLinks = useMemo(() => buildInvoiceOperationalLinks(selectedInvoice), [selectedInvoice]);
  const selectedInvoiceGateLabel = !selectedInvoice
    ? t("Sin factura seleccionada", "No invoice selected")
    : paymentReleaseGate.tone === "success"
      ? selectedInvoice.status === "paid"
        ? t("Pago registrado", "Already paid")
        : t("Lista para liberar", "Ready for payment release")
      : paymentReleaseGate.tone === "danger"
        ? t("No pagar todavía", "Do not pay yet")
        : t("Programar con control", "Schedule with control");
  const selectedInvoiceGateSummary = !selectedInvoice
    ? t("Elige una factura desde la bandeja para revisar su liberación.", "Choose an invoice from the queue to review release.")
    : paymentReleaseGate.tone === "success"
      ? t("Proveedor, SAT, evidencia y expediente están alineados para el siguiente movimiento financiero.", "Supplier, SAT, evidence and packet are aligned for the next financial move.")
      : paymentReleaseGate.tone === "danger"
        ? t("Hay un bloqueo fiscal o de flujo que debe resolverse antes de mover dinero.", "A fiscal or workflow blocker must be resolved before money moves.")
        : t("La factura puede avanzar, pero necesita cierre fiscal adicional antes de liberarse.", "The invoice can advance, but needs tighter fiscal closure before release.");
  const selectedInvoiceGateChecksSpanish = useMemo(
    () =>
      buildPaymentReleaseGateChecksSpanish({
        invoice: selectedInvoice,
        supplierReady: selectedInvoiceSupplierReadyForPayment,
        supplierProfileLabel: selectedInvoiceSupplierProfile
          ? `${selectedInvoiceSupplierProfile.complianceStatus} / ${selectedInvoiceSupplierProfile.satStatus}`
          : null,
        paymentDateDraft
      }),
    [paymentDateDraft, selectedInvoice, selectedInvoiceSupplierProfile, selectedInvoiceSupplierReadyForPayment]
  );
  const selectedInvoiceHumanStepLocalized = uiLanguage === "es" ? buildInvoiceHumanStepSpanish(selectedInvoice) : selectedInvoiceHumanStep;
  const paymentQueueInsights = useMemo(
    () =>
      filteredInvoices.map((invoice) => {
        const supplierProfile = invoice.supplierProfileId ? supplierProfilesById.get(invoice.supplierProfileId) ?? null : null;
        const supplierReady = supplierProfile
          ? supplierProfile.complianceStatus === "complete" && supplierProfile.satStatus === "controlled"
          : false;

        return {
          invoice,
          supplierProfile,
          supplierReady,
          duePulse: buildInvoiceDuePulse(invoice),
          releaseLane: buildInvoiceReleaseLane(invoice, supplierReady)
        };
      }),
    [filteredInvoices, supplierProfilesById]
  );
  const paymentQueueSummary = useMemo(
    () => ({
      readyForTreasury: paymentQueueInsights.filter((item) => item.releaseLane.key === "treasury_ready").length,
      scheduled: paymentQueueInsights.filter((item) => item.invoice.status === "scheduled").length,
      overdue: paymentQueueInsights.filter((item) => typeof item.duePulse.daysUntilDue === "number" && item.duePulse.daysUntilDue < 0).length,
      fiscalAttention: paymentQueueInsights.filter((item) => ["blocked", "supplier", "receiving", "fiscal_packet"].includes(item.releaseLane.key))
        .length
    }),
    [paymentQueueInsights]
  );
  const selectedInvoiceInsight = useMemo(
    () => paymentQueueInsights.find((item) => item.invoice.id === selectedInvoice?.id) ?? null,
    [paymentQueueInsights, selectedInvoice?.id]
  );
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
  const createInvoiceGateLabel = createInvoiceGate.tone === "success"
    ? t("Lista para capturar", "Ready to capture")
    : createInvoiceGate.tone === "danger"
      ? t("No capturar todavía", "Do not capture yet")
      : t("Capturar con control", "Capture with control");
  const createInvoiceGateSummary = createInvoiceGate.tone === "success"
    ? t("La factura ya trae suficiente estructura fiscal y operativa para entrar limpia a CXP.", "The invoice already has enough fiscal and operational structure to enter AP cleanly.")
    : createInvoiceGate.tone === "danger"
      ? t("Esta factura abriría CXP con un bloqueo fiscal o contable duro.", "This invoice would open AP with a hard fiscal or accounting blocker.")
      : t("La factura puede capturarse, pero expediente o trazabilidad todavía necesitan más disciplina.", "The invoice can be captured, but packet or traceability still need tighter discipline.");
  const createInvoiceGateChecksSpanish = useMemo(
    () =>
      buildCreateInvoiceGateChecksSpanish({
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
  const createInvoiceHumanStepLocalized = uiLanguage === "es"
    ? buildCreateInvoiceHumanStepSpanish({
        supplierProfileReady: createSelectedSupplierProfile
          ? createSelectedSupplierProfile.complianceStatus === "complete" && createSelectedSupplierProfile.satStatus === "controlled"
          : false,
        packetCompletion: Number(createForm.packetCompletion),
        receiptCode: createForm.receiptCode,
        purchaseOrderCode: createForm.purchaseOrderCode,
        nextAction: createForm.nextAction
      })
    : createInvoiceHumanStep;

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
      setError(t("La próxima acción debe explicar el seguimiento fiscal o de pago.", "Next action must explain the fiscal or payment follow-up."));
      return;
    }

    if ((status === "scheduled" || status === "paid") && !selectedInvoiceSupplierReadyForPayment) {
      setError(t("El perfil del proveedor debe estar completo y controlado antes de programar o pagar.", "Supplier profile must be complete and controlled before scheduling or paying."));
      return;
    }

    if ((status === "scheduled" || status === "paid") && !paymentDateDraft) {
      setError(t("La fecha de pago es obligatoria antes de programar o pagar una factura.", "Payment date is required before scheduling or paying an invoice."));
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
      setError(response.error?.message ?? t("La actualización de cuentas por pagar falló.", "Accounts payable update failed."));
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
    setMessage(
      t(
        `La factura ${updated.code} pasó a ${invoiceStatusLabel(updated.status).es}.`,
        `Invoice ${updated.code} moved to ${invoiceStatusLabel(updated.status).en}.`
      )
    );
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
      setError(t("El nombre del proveedor debe contener al menos 3 caracteres.", "Supplier name must contain at least 3 characters."));
      return;
    }

    if (invoiceNumber.length < 3) {
      setError(t("El número de factura debe contener al menos 3 caracteres.", "Invoice number must contain at least 3 characters."));
      return;
    }

    if (!invoiceUuidPattern.test(invoiceUuid)) {
      setError(t("El UUID debe usar un formato CFDI válido.", "UUID must use a valid CFDI format."));
      return;
    }

    if (projectName.length < 3) {
      setError(t("El nombre de la obra debe contener al menos 3 caracteres.", "Project name must contain at least 3 characters."));
      return;
    }

    if (!createForm.dueDate) {
      setError(t("La fecha de vencimiento es obligatoria.", "Due date is required."));
      return;
    }

    if (![subtotal, tax, total].every((value) => Number.isFinite(value) && value >= 0)) {
      setError(t("Subtotal, impuesto y total deben ser importes válidos no negativos.", "Subtotal, tax and total must be valid non-negative amounts."));
      return;
    }

    if (Math.abs(total - (subtotal + tax)) > 0.01) {
      setError(t("El total debe ser igual a subtotal más impuesto.", "Total must equal subtotal plus tax."));
      return;
    }

    if (!Number.isFinite(packetCompletion) || packetCompletion < 0 || packetCompletion > 100) {
      setError(t("El expediente debe estar entre 0 y 100.", "Packet completion must be between 0 and 100."));
      return;
    }

    if (nextAction.length < 8) {
      setError(t("La próxima acción debe describir el seguimiento de cuentas por pagar.", "Next action must describe the payables follow-up."));
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
      setError(response.error?.message ?? t("La creación de la factura de cuentas por pagar falló.", "Accounts payable invoice creation failed."));
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
    setMessage(
      t(
        `${created.code} creada para ${created.supplierName}.`,
        `${created.code} created for ${created.supplierName}.`
      )
    );
  }

  return (
    <AppShell
      title={t("Cuentas por pagar", "Accounts payable")}
      eyebrow={t("Ejecución financiera", "Finance execution")}
      description={t("Facturas de proveedor, postura CFDI y liberación hacia tesorería con evidencia de recepción.", "Supplier invoices, CFDI posture and treasury release backed by receiving evidence.")}
    >
      <ModuleGate moduleKeys={["finance.accounting"]} requiredPermissions={["finance:*", "finance:read"]} title={t("Cuentas por pagar", "Accounts payable")}>
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label={t("Pendiente visible", "Visible open amount")}
                value={`MXN ${filteredSummary.openAmount.toLocaleString()}`}
                footnote={t("Importe todavía presionando la liberación financiera.", "Amount still pressing financial release.")}
              />
              <KpiCard
                label={t("Listas para tesorería", "Ready for treasury")}
                value={String(paymentQueueSummary.readyForTreasury)}
                footnote={t("Facturas que ya pueden entrar a corrida de pago.", "Invoices that can already move into a payment run.")}
              />
              <KpiCard
                label={t("Vencidas", "Overdue")}
                value={String(paymentQueueSummary.overdue)}
                footnote={t("Facturas fuera de fecha que requieren contención inmediata.", "Invoices already past due and needing immediate containment.")}
              />
              <KpiCard
                label={t("Atención fiscal", "Fiscal attention")}
                value={String(paymentQueueSummary.fiscalAttention)}
                footnote={t("Facturas detenidas por proveedor, recepción o expediente.", "Invoices stopped by supplier, receiving or packet posture.")}
              />
            </section>

            <section className="grid cols2">
              <Card
                title={t("Control de factura", "Invoice control")}
                description={t("Revisa la puerta fiscal y decide el siguiente movimiento antes de comprometer efectivo.", "Review the fiscal gate and decide the next move before committing cash.")}
                aside={selectedInvoice ? <Badge tone={paymentReleaseGate.tone}>{selectedInvoiceGateLabel}</Badge> : null}
              >
                {selectedInvoice ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">{t("Factura", "Invoice")}</div><div><strong>{selectedInvoice.code}</strong><div className="tableCellMuted">{selectedInvoice.invoiceNumber} · {selectedInvoice.projectName}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Proveedor", "Supplier")}</div><div>{selectedInvoice.supplierName}</div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Importe pendiente", "Pending amount")}</div><div><strong>MXN {selectedInvoice.pendingAmount.toLocaleString()}</strong><div className="tableCellMuted">{t("Vence", "Due")} {selectedInvoice.dueDate}</div></div></div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Carril operativo", "Operational lane")}</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={selectedInvoiceInsight?.releaseLane.tone ?? "info"}>
                            {selectedInvoiceInsight ? localizeText(selectedInvoiceInsight.releaseLane.label) : t("Sin factura", "No invoice")}
                          </Badge>
                          {selectedInvoiceInsight ? (
                            <Badge tone={selectedInvoiceInsight.duePulse.tone}>{localizeText(selectedInvoiceInsight.duePulse.label)}</Badge>
                          ) : null}
                        </div>
                        <span className="tableCellMuted">
                          {selectedInvoiceInsight
                            ? `${localizeText(selectedInvoiceInsight.releaseLane.helper)} · ${localizeText(selectedInvoiceInsight.duePulse.helper)}`
                            : t("Selecciona una factura para ver su carril operativo.", "Select an invoice to inspect its operating lane.")}
                        </span>
                      </div>
                    </div>
                    <div className="detailRow"><div className="detailLabel">{t("Puerta de pago", "Payment gate")}</div><div className="tableCellStack"><Badge tone={paymentReleaseGate.tone}>{selectedInvoiceGateLabel}</Badge><span className="tableCellMuted">{selectedInvoiceGateSummary}</span>{(uiLanguage === "es" ? selectedInvoiceGateChecksSpanish : paymentReleaseGate.checks).map((check) => <span key={check} className="tableCellMuted">{check}</span>)}</div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div><div>{selectedInvoiceHumanStepLocalized}</div></div>
                    <label className="detailRow"><div className="detailLabel">{t("Fecha de pago", "Payment date")}</div><input className="field" type="date" value={paymentDateDraft} onChange={(event) => setPaymentDateDraft(event.target.value)} /></label>
                    <label className="stack"><span className="detailLabel">{t("Próxima acción", "Next action")}</span><textarea className="field" rows={3} value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} /></label>
                    <div className="cluster">
                      <button type="button" className="button" disabled={isSaving} onClick={() => void handleUpdate("matched", "watch", "pending")}>{t("Marcar conciliada", "Mark matched")}</button>
                      <button type="button" className="button" disabled={isSaving || !selectedInvoiceSupplierReadyForPayment} onClick={() => void handleUpdate("scheduled", "watch", "complete")}>{t("Programar pago", "Schedule payment")}</button>
                      <button type="button" className="buttonGhost" disabled={isSaving} onClick={() => void handleUpdate("blocked", "critical", "risk")}>{t("Bloquear factura", "Block invoice")}</button>
                      <button type="button" className="button" disabled={isSaving || !selectedInvoiceSupplierReadyForPayment} onClick={() => void handleUpdate("paid", "controlled", "complete")}>{t("Marcar pagada", "Mark paid")}</button>
                    </div>
                    <div className="row gap wrap">{selectedInvoiceOperationalLinks.map((link, index) => <Link key={`${link.href}-${link.label}`} className={index === 0 ? "buttonSecondary" : "buttonGhost"} href={link.href}>{localizeText(paymentRouteLabel(link.href))}</Link>)}</div>
                    {!selectedInvoiceSupplierReadyForPayment ? <Badge tone="warning">{t("Completa y controla el perfil fiscal del proveedor antes de programar o pagar.", "Complete and control the supplier fiscal profile before scheduling or paying.")}</Badge> : null}
                    {message ? <Badge tone="success">{message}</Badge> : null}
                    {error ? <Badge tone="danger">{error}</Badge> : null}
                  </div>
                ) : <EmptyState title={t("Selecciona una factura", "Select an invoice")} description={t("Elige una factura desde la bandeja para revisar sus condiciones de liberación.", "Choose an invoice from the queue to review release conditions.")} />}
              </Card>

              <Card title={t("Bandeja de pago", "Payment queue")} description={t("Filtra, prioriza y cambia de factura sin perder el contexto de liberación.", "Filter, prioritize and switch invoices without losing release context.")}>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    marginBottom: 16
                  }}
                >
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Listas", "Ready")}</span>
                    <strong>{paymentQueueSummary.readyForTreasury}</strong>
                    <span>{t("pueden brincar a tesorería", "can jump into treasury")}</span>
                  </div>
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Programadas", "Scheduled")}</span>
                    <strong>{paymentQueueSummary.scheduled}</strong>
                    <span>{t("ya ligadas a fecha o corrida", "already tied to a date or run")}</span>
                  </div>
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Vencidas", "Overdue")}</span>
                    <strong>{paymentQueueSummary.overdue}</strong>
                    <span>{t("requieren contención inmediata", "need immediate containment")}</span>
                  </div>
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Atención fiscal", "Fiscal attention")}</span>
                    <strong>{paymentQueueSummary.fiscalAttention}</strong>
                    <span>{t("detenidas fuera de tesorería", "stopped before treasury")}</span>
                  </div>
                </div>
                <FilterBar summary={t(`${filteredInvoices.length} facturas coinciden con los filtros actuales`, `${filteredInvoices.length} invoices match the current filters`)}>
                  <label className="fieldLabel">{t("Estado", "Status")}<select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | AccountsPayableInvoiceContract["status"])}><option value="all">{t("Todos", "All")}</option><option value="received">{t("Recibida", "Received")}</option><option value="matched">{t("Conciliada", "Matched")}</option><option value="scheduled">{t("Programada", "Scheduled")}</option><option value="blocked">{t("Bloqueada", "Blocked")}</option><option value="paid">{t("Pagada", "Paid")}</option></select></label>
                  <label className="fieldLabel">SAT<select className="field" value={satFilter} onChange={(event) => setSatFilter(event.target.value as "all" | AccountsPayableInvoiceContract["satStatus"])}><option value="all">{t("Todos", "All")}</option><option value="controlled">{t("Controlado", "Controlled")}</option><option value="watch">{t("Vigilancia", "Watch")}</option><option value="critical">{t("Crítico", "Critical")}</option></select></label>
                  <label className="fieldLabel">{t("Búsqueda", "Search")}<input className="field" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Factura, proveedor, CFDI o proyecto", "Invoice, supplier, CFDI or project")} /></label>
                </FilterBar>
                {paymentQueueInsights.length > 0 ? (
                  <div className="list">
                    {paymentQueueInsights.map((item) => (
                      <button
                        key={item.invoice.id}
                        type="button"
                        className={`listItem ${selectedInvoice?.id === item.invoice.id ? "listItemSelected" : ""}`}
                        onClick={() => setSelectedId(item.invoice.id)}
                      >
                        <div className="tableCellStack" style={{ alignItems: "flex-start" }}>
                          <strong>{item.invoice.code} · MXN {item.invoice.pendingAmount.toLocaleString()}</strong>
                          <p>{item.invoice.supplierName} · {item.invoice.projectName}</p>
                          <span className="tableCellMuted">
                            {item.invoice.invoiceNumber} · {localizeText(item.duePulse.helper)} · {item.invoice.packetCompletion}% {t("expediente", "packet")}
                          </span>
                        </div>
                        <div className="tableCellStack" style={{ alignItems: "flex-end" }}>
                          <Badge tone={item.releaseLane.tone}>{localizeText(item.releaseLane.label)}</Badge>
                          <Badge tone={tone(item.invoice.satStatus)}>{localizeText(invoiceSatLabel(item.invoice.satStatus))}</Badge>
                          <span className="tableCellMuted">
                            {localizeText(invoiceStatusLabel(item.invoice.status))} · {localizeText(invoiceEvidenceLabel(item.invoice.receiptEvidenceStatus))}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={t("Sin facturas para estos filtros", "No invoices for these filters")} description={t("Limpia o cambia los filtros para recuperar la bandeja activa.", "Clear or change filters to recover the active queue.")} />
                )}
              </Card>
            </section>

            <details className="fieldAdvanced">
              <summary>{t("Abrir trazabilidad ampliada, riesgos y alta de factura", "Open extended traceability, risks and invoice capture")}</summary>
              <div className="fieldAdvancedContent">
                <section className="grid cols4">
                  <KpiCard label={t("Facturas visibles", "Visible invoices")} value={String(filteredSummary.trackedInvoices)} footnote={t("Facturas de CXP visibles en la empresa actual.", "AP invoices currently visible in the active company.")} />
                  <KpiCard label={t("Importe abierto", "Open amount")} value={`MXN ${filteredSummary.openAmount.toLocaleString()}`} footnote={t("Importe todavía presionando salida a tesorería.", "Amount still pressing treasury release.")} />
                  <KpiCard label={t("Bloqueadas", "Blocked")} value={String(filteredSummary.blockedInvoices)} footnote={t("Facturas detenidas por SAT, recepción o traza comercial.", "Invoices blocked by SAT, receiving or commercial traceability.")} />
                  <KpiCard label={t("Vencidas", "Overdue")} value={String(filteredSummary.overdueInvoices)} footnote={t("Facturas fuera de fecha que todavía no cierran su liberación.", "Invoices already past due and still unresolved for release.")} />
                </section>

                <section className="grid cols2">
                  <Card
                    title={t("Trazabilidad ampliada de factura", "Extended invoice traceability")}
                    description={t("Rastrea proveedor, recepción y puerta fiscal sin duplicar la bandeja principal.", "Track supplier, receiving and fiscal gate without duplicating the main queue.")}
                    aside={selectedInvoice ? <Badge tone={tone(selectedInvoice.satStatus)}>{localizeText(invoiceSatLabel(selectedInvoice.satStatus))}</Badge> : null}
                  >
                    {selectedInvoice ? (
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">{t("Proveedor", "Supplier")}</div><div>{selectedInvoice.supplierName}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Perfil de proveedor", "Supplier profile")}</div><div>{selectedInvoiceSupplierProfile ? `${selectedInvoiceSupplierProfile.complianceStatus} / ${selectedInvoiceSupplierProfile.satStatus}` : t("Sin perfil maestro ligado", "No linked supplier master profile")}</div></div>
                        <div className="detailRow"><div className="detailLabel">UUID</div><div>{selectedInvoice.invoiceUuid}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("OC / recepción", "PO / receipt")}</div><div>{selectedInvoice.purchaseOrderCode ?? t("Sin OC", "No PO")} / {selectedInvoice.receiptCode ?? t("Sin recepción", "No receipt")}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Evidencia", "Evidence")}</div><div>{localizeText(invoiceEvidenceLabel(selectedInvoice.receiptEvidenceStatus))}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Expediente fiscal", "Fiscal packet")}</div><div>{selectedInvoice.packetCompletion}% · {selectedInvoice.complementStatus}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Puerta de pago", "Payment gate")}</div><div className="tableCellStack"><Badge tone={paymentReleaseGate.tone}>{selectedInvoiceGateLabel}</Badge><span className="tableCellMuted">{selectedInvoiceGateSummary}</span>{(uiLanguage === "es" ? selectedInvoiceGateChecksSpanish : paymentReleaseGate.checks).map((check) => <span key={check} className="tableCellMuted">{check}</span>)}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div><div>{selectedInvoiceHumanStepLocalized}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Accesos operativos", "Operational links")}</div><div className="row gap wrap">{selectedInvoiceOperationalLinks.map((link) => <Link key={`${link.href}-${link.label}`} className="buttonGhost" href={link.href}>{localizeText(paymentRouteLabel(link.href))}</Link>)}</div></div>
                      </div>
                    ) : (
                      <EmptyState title={t("Selecciona una factura", "Select an invoice")} description={t("Elige una factura para revisar su trazabilidad fiscal y de recepción.", "Choose an invoice to inspect its fiscal and receiving traceability.")} />
                    )}
                  </Card>

                  <Card title={t("Riesgos de factura", "Invoice risks")} description={t("Bloqueos activos atados a la factura seleccionada.", "Active blockers tied to the selected invoice.")}>
                    {selectedRisks.length > 0 ? (
                      <DataTable
                        rows={selectedRisks}
                        columns={[
                          { key: "risk", label: t("Riesgo", "Risk"), render: (row) => row.title },
                          { key: "category", label: t("Categoría", "Category"), render: (row) => row.category },
                          {
                            key: "severity",
                            label: t("Severidad", "Severity"),
                            render: (row) => (
                              <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>
                                {row.severity}
                              </Badge>
                            )
                          }
                        ]}
                      />
                    ) : (
                      <EmptyState title={t("Sin riesgos ligados", "No mapped risks")} description={t("La factura seleccionada no tiene bloqueos ligados en este momento.", "The selected invoice has no mapped blockers right now.")} />
                    )}
                  </Card>
                </section>

                <section className="grid cols2">
                  <Card title={t("Alta de factura", "Register invoice")} description={t("Captura una factura directamente en el backend del tenant con trazabilidad mínima suficiente.", "Capture an invoice directly in the tenant backend with enough minimum traceability.")}>
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
                        {t("Cargar ejemplo demo", "Load demo example")}
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
                        {t("Reiniciar formulario", "Reset form")}
                      </button>
                      <Link className="buttonGhost" href="/supplier-master">{t("Abrir proveedores", "Open suppliers")}</Link>
                      <Link className="buttonGhost" href="/treasury/payment-runs">{t("Abrir corridas de pago", "Open payment runs")}</Link>
                    </div>
                    <div className="detailGrid">
                      <label className="detailRow"><div className="detailLabel">{t("Perfil de proveedor", "Supplier profile")}</div><select className="selectField" value={createForm.supplierProfileId} onChange={(event) => setCreateForm((current) => ({ ...current, supplierProfileId: event.target.value }))}><option value="">{t("Sin perfil ligado", "No linked profile")}</option>{availableSupplierProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.supplierName} · {profile.complianceStatus} · {profile.satStatus}</option>)}</select></label>
                      <label className="detailRow"><div className="detailLabel">{t("Proveedor", "Supplier")}</div><input className="field" value={createForm.supplierName} onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Número de factura", "Invoice number")}</div><input className="field" value={createForm.invoiceNumber} onChange={(event) => setCreateForm((current) => ({ ...current, invoiceNumber: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">UUID</div><input className="field" value={createForm.invoiceUuid} onChange={(event) => setCreateForm((current) => ({ ...current, invoiceUuid: event.target.value.toUpperCase() }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Obra", "Project")}</div><input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Código OC", "PO code")}</div><input className="field" value={createForm.purchaseOrderCode} onChange={(event) => setCreateForm((current) => ({ ...current, purchaseOrderCode: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Código de recepción", "Receipt code")}</div><input className="field" value={createForm.receiptCode} onChange={(event) => setCreateForm((current) => ({ ...current, receiptCode: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Subtotal", "Subtotal")}</div><input className="field" type="number" value={createForm.subtotal} onChange={(event) => setCreateForm((current) => ({ ...current, subtotal: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Impuesto", "Tax")}</div><input className="field" type="number" value={createForm.tax} onChange={(event) => setCreateForm((current) => ({ ...current, tax: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Total", "Total")}</div><input className="field" type="number" value={createForm.total} onChange={(event) => setCreateForm((current) => ({ ...current, total: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Expediente", "Packet completion")}</div><input className="field" type="number" value={createForm.packetCompletion} onChange={(event) => setCreateForm((current) => ({ ...current, packetCompletion: event.target.value }))} /></label>
                      <label className="detailRow"><div className="detailLabel">{t("Próxima acción", "Next action")}</div><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                    </div>
                    <div className="detailGrid" style={{ marginTop: 16 }}>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Puerta de captura", "Creation gate")}</div>
                        <div className="tableCellStack">
                          <div className="row gap wrap" style={{ alignItems: "center" }}>
                            <Badge tone={createInvoiceGate.tone}>{createInvoiceGateLabel}</Badge>
                            <span>{createInvoiceGateSummary}</span>
                          </div>
                          {(uiLanguage === "es" ? createInvoiceGateChecksSpanish : createInvoiceGate.checks).map((check) => (
                            <span key={check} className="tableCellMuted">{check}</span>
                          ))}
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                        <div>{createInvoiceHumanStepLocalized}</div>
                      </div>
                    </div>
                    <div className="row gap wrap" style={{ marginTop: 16 }}>
                      <button type="button" className="button" onClick={() => void handleCreate()}>{t("Agregar factura", "Add invoice")}</button>
                      {supplierMasterHint ? <Badge tone="info">{supplierMasterHint}</Badge> : null}
                      {message ? <Badge tone="success">{message}</Badge> : null}
                      {error ? <Badge tone="danger">{error}</Badge> : null}
                    </div>
                  </Card>

                  <Card title={t("Reglas de liberación", "Release rules")} description={t("Restricciones que evitan control falso o salida prematura a pago.", "Constraints that prevent fake control or premature payment release.")}>
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Control SAT", "SAT control")}</div><div>{t("La postura SAT controlada exige expediente al 100%.", "Controlled SAT posture requires 100% packet completion.")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Programación", "Scheduling")}</div><div>{t("Las facturas programadas o pagadas exigen fecha de pago y al menos evidencia parcial de recepción.", "Scheduled and paid invoices require payment date and at least partial receiving evidence.")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Salud fiscal del proveedor", "Supplier fiscal health")}</div><div>{t("Perfiles bloqueados o críticos no deben entrar al flujo de pago; programadas o pagadas exigen proveedor completo y controlado.", "Blocked or critical supplier profiles should not enter payment flow; scheduled or paid invoices require a complete and controlled supplier profile.")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Estado pagada", "Paid state")}</div><div>{t("Una factura pagada exige complemento completo o no requerido, y el pendiente debe caer a cero.", "A paid invoice requires a complete or not-required complement status, and pending amount must drop to zero.")}</div></div>
                    </div>
                  </Card>
                </section>
              </div>
            </details>
          </>
        ) : (
          <EmptyState title={t("Cuentas por pagar no disponible", "Accounts payable unavailable")} description={error ?? t("No pudimos cargar cuentas por pagar para esta empresa.", "We could not load accounts payable for this company.")} />
        )}
      </ModuleGate>
    </AppShell>
  );
}
