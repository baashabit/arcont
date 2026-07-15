"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { TreasuryPaymentRunContract, TreasuryPaymentRunsOverviewContract } from "@/lib/contracts";
import {
  addTreasuryPaymentRunInvoice,
  createTreasuryPaymentRun,
  fetchTreasuryPaymentRunsOverview,
  moveTreasuryPaymentRunInvoice,
  removeTreasuryPaymentRunInvoice,
  updateTreasuryPaymentRun
} from "@/lib/platform-api";

const emptyCreateForm = {
  bankAccountLabel: "Banorte Operacion ****4451",
  scheduledDate: "2026-07-25",
  owner: "Treasury lead",
  nextAction: ""
};

function createPaymentRunExample() {
  return {
    bankAccountLabel: "BBVA Dispersions Norte ****8821",
    scheduledDate: "2026-07-29",
    owner: "Mesa de tesoreria",
    nextAction: "Liberar lote con proveedores completos y confirmar evidencia bancaria antes de las 15:00"
  };
}

function tone(status: TreasuryPaymentRunContract["status"]) {
  switch (status) {
    case "executed":
      return "success";
    case "ready":
      return "info";
    case "draft":
      return "warning";
    default:
      return "danger";
  }
}

function paymentRunLinkLabel(label: string) {
  switch (label) {
    case "Open accounts payable":
      return { es: "Abrir cuentas por pagar", en: "Open accounts payable" };
    case "Open supplier master":
      return { es: "Abrir proveedores", en: "Open supplier master" };
    case "Open cash flow":
      return { es: "Abrir flujo de efectivo", en: "Open cash flow" };
    default:
      return { es: "Abrir finanzas", en: "Open finance" };
  }
}

function paymentRunActionLabel(action: "ready" | "blocked" | "executed") {
  switch (action) {
    case "ready":
      return { es: "Marcar listo", en: "Mark ready" };
    case "blocked":
      return { es: "Bloquear corrida", en: "Block run" };
    default:
      return { es: "Ejecutar corrida", en: "Execute run" };
  }
}

function unavailableTone(reasonCode: TreasuryPaymentRunsOverviewContract["unavailableInvoices"][number]["reasonCode"]) {
  switch (reasonCode) {
    case "already_paid":
      return "success";
    case "already_assigned":
      return "warning";
    default:
      return "danger";
  }
}

type AccountsPayablePaymentRunContext = {
  source: "accounts-payable";
  invoiceCode: string;
  supplierName: string;
  projectName: string;
  purchaseOrderCode: string;
  receiptCode: string;
  nextAction: string;
};

function normalizePaymentRunContextValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildAccountsPayablePaymentRunContext(
  searchParams: ReturnType<typeof useSearchParams>
): AccountsPayablePaymentRunContext | null {
  if (searchParams.get("source") !== "accounts-payable") {
    return null;
  }

  const context = {
    source: "accounts-payable" as const,
    invoiceCode: searchParams.get("invoiceCode")?.trim() ?? "",
    supplierName: searchParams.get("supplierName")?.trim() ?? "",
    projectName: searchParams.get("projectName")?.trim() ?? "",
    purchaseOrderCode: searchParams.get("purchaseOrderCode")?.trim() ?? "",
    receiptCode: searchParams.get("receiptCode")?.trim() ?? "",
    nextAction: searchParams.get("nextAction")?.trim() ?? ""
  };

  return Object.values(context).some((value) => typeof value === "string" && value.length > 0) ? context : null;
}

function findBestMatchingPaymentRun(
  overview: TreasuryPaymentRunsOverviewContract,
  context: AccountsPayablePaymentRunContext
) {
  const normalizedInvoiceCode = normalizePaymentRunContextValue(context.invoiceCode);
  const normalizedSupplierName = normalizePaymentRunContextValue(context.supplierName);

  return (
    overview.runs
      .map((run) => {
        let score = 0;

        run.invoices.forEach((invoice) => {
          if (normalizedInvoiceCode && normalizePaymentRunContextValue(invoice.invoiceCode) === normalizedInvoiceCode) {
            score += 8;
          }

          if (normalizedSupplierName && normalizePaymentRunContextValue(invoice.supplierName) === normalizedSupplierName) {
            score += 2;
          }
        });

        return { run, score };
      })
      .sort((left, right) => right.score - left.score)
      .find((item) => item.score > 0)
      ?.run ?? null
  );
}

function findMatchingEligibleInvoiceIds(
  overview: TreasuryPaymentRunsOverviewContract,
  context: AccountsPayablePaymentRunContext
) {
  const normalizedInvoiceCode = normalizePaymentRunContextValue(context.invoiceCode);
  const normalizedSupplierName = normalizePaymentRunContextValue(context.supplierName);

  return overview.eligibleInvoices
    .filter((invoice) => {
      if (normalizedInvoiceCode && normalizePaymentRunContextValue(invoice.code) === normalizedInvoiceCode) {
        return true;
      }

      return normalizedSupplierName.length > 0 && normalizePaymentRunContextValue(invoice.supplierName) === normalizedSupplierName;
    })
    .map((invoice) => invoice.id);
}

function buildPaymentRunCashFlowHref(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return "/cash-flow";
  }

  const query = new URLSearchParams({
    source: "payment-runs",
    runCode: run.code,
    runStatus: run.status,
    runOwner: run.owner,
    criticalInvoices: String(run.criticalInvoices),
    totalAmount: String(run.totalAmount),
    nextAction: run.nextAction
  });

  return `/cash-flow?${query.toString()}`;
}

function buildCreatePaymentRunGate(input: {
  bankAccountLabel: string;
  scheduledDate: string;
  owner: string;
  nextAction: string;
  selectedInvoiceCount: number;
  selectedInvoiceAmount: number;
  availableEligibleInvoices: number;
}) {
  const checks: string[] = [];

  if (input.bankAccountLabel.trim().length < 8) {
    checks.push("Bank account label still needs more descriptive treasury capture.");
  }

  if (!input.scheduledDate) {
    checks.push("Scheduled date is still missing.");
  }

  if (input.owner.trim().length < 3) {
    checks.push("Treasury owner still needs more specific capture.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for release follow-through.");
  }

  if (input.selectedInvoiceCount === 0) {
    checks.push("At least one eligible invoice must be selected before creating a payment run.");
  }

  if (input.availableEligibleInvoices === 0) {
    checks.push("There are no eligible invoices available to assemble into a run right now.");
  }

  if (input.selectedInvoiceAmount <= 0 && input.selectedInvoiceCount > 0) {
    checks.push("Selected invoices still do not form a valid treasury amount.");
  }

  if (checks.length > 0) {
    const hardBlock = !input.scheduledDate || input.selectedInvoiceCount === 0 || input.availableEligibleInvoices === 0;

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This treasury batch would open with a hard readiness blocker."
        : "The batch can be created, but treasury discipline still needs tightening before it becomes truly releasable.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The payment run has enough structure to enter treasury review cleanly.",
    checks: [
      "The created run will become the current focus batch immediately.",
      "Keep AP, supplier and bank execution traceability attached from the first treasury assembly."
    ]
  };
}

function buildCreatePaymentRunHumanStep(input: {
  selectedInvoiceCount: number;
  scheduledDate: string;
  nextAction: string;
}) {
  if (input.selectedInvoiceCount === 0) {
    return "Select the payable invoices first so treasury is not creating an empty batch.";
  }

  if (!input.scheduledDate) {
    return "Set the execution date before creating the batch so cash timing stays explicit.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the treasury release plan before persisting the batch.";
  }

  return "Create the run and immediately review whether it should stay draft or move toward ready without rebuilding the AP context.";
}

function buildSelectedRunGate(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return {
      tone: "info" as const,
      label: "No run selected",
      summary: "Choose a treasury run to verify whether it is really ready, blocked or still draft.",
      checks: ["Select a run from the active treasury board."]
    };
  }

  const checks: string[] = [];

  if (run.status === "blocked") {
    checks.push("Run is already blocked at treasury level.");
  }

  if (run.criticalInvoices > 0) {
    checks.push(`${run.criticalInvoices} critical invoice(s) still threaten clean execution.`);
  }

  if (run.totalInvoices <= 0) {
    checks.push("Run still has no invoices attached.");
  }

  if (run.status === "draft") {
    checks.push("Run is still draft and has not reached ready posture.");
  }

  if (checks.length > 0) {
    const hardBlock = run.status === "blocked" || run.totalInvoices <= 0 || run.criticalInvoices > 0;
    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not execute yet" : "Operate with control",
      summary: hardBlock
        ? "This treasury batch still carries blockers before bank execution should be trusted."
        : "The batch can continue, but treasury should tighten the release lane first.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: run.status === "executed" ? "Already executed" : "Ready for treasury continuity",
    summary:
      run.status === "executed"
        ? "The batch is already executed and should stay only as financial traceability."
        : "Invoice count, risk and posture are aligned for treasury continuity.",
    checks: [
      "Continue into bank execution or AP follow-through without rebuilding the same run context.",
      "Keep the same owner and next action attached until the batch is fully closed."
    ]
  };
}

function buildSelectedRunHumanStep(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return "Choose a treasury run to identify the next human move.";
  }

  if (run.status === "blocked") {
    return "Clear the blocking invoice or treasury dependency first, then return only when the batch can move again.";
  }

  if (run.criticalInvoices > 0) {
    return "Contain the critical invoices first and confirm whether they should stay, move or leave the batch.";
  }

  if (run.status === "draft") {
    return "Validate the batch composition now and decide whether it is ready or still needs AP cleanup.";
  }

  if (run.status === "ready") {
    return "Confirm bank execution conditions and keep AP informed so the run does not decay before payment.";
  }

  return "Close the traceability loop and verify the executed batch no longer carries unresolved AP residue.";
}

function buildSelectedRunWhyNow(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return "Choose a treasury run to understand why it deserves attention right now.";
  }

  if (run.status === "blocked") {
    return "This batch is already blocked, so delay here can freeze payment continuity across multiple suppliers at once.";
  }

  if (run.criticalInvoices > 0) {
    return "Critical invoices are already inside the batch, so treasury should act before the run normalizes bad release quality.";
  }

  if (run.status === "draft") {
    return "The run is still draft, so treasury should decide now whether it can become real execution or needs more cleanup.";
  }

  if (run.status === "ready") {
    return "The run is close enough to bank execution that treasury delay can turn a good batch into stale release posture.";
  }

  return "This run is already executed, but treasury should still preserve clean traceability and downstream confirmation.";
}

function buildSelectedRunDownstreamEffect(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return "Choose a treasury run to inspect what it can block downstream.";
  }

  if (run.status === "blocked" || run.criticalInvoices > 0) {
    return "The downstream effect is supplier distrust, AP congestion and distorted finance timing across the payment chain.";
  }

  if (run.status === "draft") {
    return "An unstable draft run can propagate confusion back into AP, supplier release and short-term cash sequencing.";
  }

  if (run.status === "ready") {
    return "If this ready batch stalls, treasury confidence and supplier release timing can degrade together.";
  }

  return "The downstream effect is mostly reconciliation discipline: keep AP, suppliers and finance aligned after execution.";
}

function buildSelectedRunReportBack(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return "Choose a treasury run to define the next report-back window.";
  }

  if (run.status === "blocked" || run.criticalInvoices > 0) {
    return "Report back before the next treasury cutoff with blocker containment and invoice-release status.";
  }

  if (run.status === "draft") {
    return "Report back in the same operating cycle once the batch is either ready or explicitly resequenced.";
  }

  if (run.status === "ready") {
    return "Report back as soon as bank execution timing is confirmed and still valid.";
  }

  return "Report back on the next treasury refresh confirming execution stayed reconciled and clean.";
}

function buildSelectedRunLinks(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return [
      { label: "Open accounts payable", href: "/accounts-payable" },
      { label: "Open finance", href: "/finance" },
      { label: "Open cash flow", href: "/cash-flow" }
    ];
  }

  if (run.status === "blocked" || run.criticalInvoices > 0) {
    return [
      { label: "Open accounts payable", href: "/accounts-payable" },
      { label: "Open supplier master", href: "/supplier-master" },
      { label: "Open cash flow", href: buildPaymentRunCashFlowHref(run) }
    ];
  }

  if (run.status === "draft") {
    return [
      { label: "Open accounts payable", href: "/accounts-payable" },
      { label: "Open finance", href: "/finance" },
      { label: "Open cash flow", href: buildPaymentRunCashFlowHref(run) }
    ];
  }

  return [
    { label: "Open finance", href: "/finance" },
    { label: "Open cash flow", href: buildPaymentRunCashFlowHref(run) },
    { label: "Open accounts payable", href: "/accounts-payable" }
  ];
}

function buildSelectedRunDesk(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return {
      primaryLabel: { es: "Cuentas por pagar", en: "Accounts payable" },
      primaryReason: {
        es: "Selecciona una corrida para definir qué dominio debe absorber primero la presión del lote.",
        en: "Select a run to define which domain should absorb batch pressure first."
      },
      secondaryLabel: { es: "Finanzas", en: "Finance" },
      secondaryReason: {
        es: "Después de la fuente del problema, finanzas debe sostener postura de liberación e impacto de caja.",
        en: "After the problem source, finance should sustain release posture and cash impact."
      },
      returnRule: {
        es: "Regresa con dueño, lote y condición de liberación ya confirmados.",
        en: "Return with owner, batch and release condition already confirmed."
      }
    };
  }

  if (run.status === "blocked" || run.criticalInvoices > 0) {
    return {
      primaryLabel: { es: "Cuentas por pagar", en: "Accounts payable" },
      primaryReason: {
        es: "La corrida está bloqueada por calidad de factura o disciplina de liberación; AP debe limpiar primero la composición del lote.",
        en: "The run is blocked by invoice quality or release discipline, so AP should clean batch composition first."
      },
      secondaryLabel: { es: "Proveedores", en: "Supplier master" },
      secondaryReason: {
        es: "Después de AP, proveedores debe sostener cobertura, datos y compromiso comercial de las facturas críticas.",
        en: "After AP, supplier management should sustain coverage, data and commercial commitment for critical invoices."
      },
      returnRule: {
        es: "Regresa con facturas críticas contenidas, proveedor confirmado y la corrida lista para revalidarse.",
        en: "Return with critical invoices contained, supplier confirmed and the run ready to be revalidated."
      }
    };
  }

  if (run.status === "draft") {
    return {
      primaryLabel: { es: "Cuentas por pagar", en: "Accounts payable" },
      primaryReason: {
        es: "El lote todavía depende de depuración operativa antes de que tesorería lo trate como liberable.",
        en: "The batch still depends on operating cleanup before treasury can treat it as releasable."
      },
      secondaryLabel: { es: "Finanzas", en: "Finance" },
      secondaryReason: {
        es: "Después de limpiar AP, finanzas debe confirmar impacto y postura de ejecución del lote.",
        en: "After cleaning AP, finance should confirm batch impact and execution posture."
      },
      returnRule: {
        es: "Regresa con composición validada, siguiente corte definido y criterio claro para pasarlo a listo.",
        en: "Return with validated composition, next cutoff defined and clear criteria to move it into ready."
      }
    };
  }

  return {
    primaryLabel: { es: "Finanzas", en: "Finance" },
    primaryReason: {
      es: "La corrida ya está madura y ahora la presión principal es sostener ejecución, caja y trazabilidad financiera.",
      en: "The run is already mature and the main pressure is now sustaining execution, cash and financial traceability."
    },
    secondaryLabel: { es: "Flujo de efectivo", en: "Cash flow" },
    secondaryReason: {
      es: "Después de finanzas, flujo de efectivo debe absorber cobertura y secuencia de salida sin perder el mismo contexto.",
      en: "After finance, cash flow should absorb coverage and outflow sequencing without losing the same context."
    },
    returnRule: {
      es: "Regresa con fecha de ejecución, cobertura de caja y conciliación esperada ya confirmadas.",
      en: "Return with execution date, cash coverage and expected reconciliation already confirmed."
    }
  };
}

export default function TreasuryPaymentRunsPage() {
  const searchParams = useSearchParams();
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const t = (es: string, en: string) => localizeText({ es, en });
  const accountsPayableContext = useMemo(() => buildAccountsPayablePaymentRunContext(searchParams), [searchParams]);
  const [overview, setOverview] = useState<TreasuryPaymentRunsOverviewContract | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TreasuryPaymentRunContract["status"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedEligibleInvoiceId, setSelectedEligibleInvoiceId] = useState<string>("");
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [appliedAccountsPayableContextKey, setAppliedAccountsPayableContextKey] = useState<string | null>(null);
  const [accountsPayableMatchedRunId, setAccountsPayableMatchedRunId] = useState<string | null>(null);
  const accountsPayableContextKey = useMemo(
    () =>
      accountsPayableContext
        ? [
            accountsPayableContext.source,
            accountsPayableContext.invoiceCode,
            accountsPayableContext.supplierName,
            accountsPayableContext.projectName,
            accountsPayableContext.purchaseOrderCode,
            accountsPayableContext.receiptCode,
            accountsPayableContext.nextAction
          ].join("|")
        : null,
    [accountsPayableContext]
  );

  async function reloadOverview() {
    const runs = await fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken });
    setOverview(runs);
    setSelectedId((current) => current ?? runs?.focusRun?.id ?? runs?.runs[0]?.id ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
      .then((runs) => {
        if (cancelled) {
          return;
        }
        setOverview(runs);
        setSelectedId((current) => current ?? runs?.focusRun?.id ?? runs?.runs[0]?.id ?? null);
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

  const filteredRuns = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.runs.filter((run) => {
      const matchesStatus = statusFilter === "all" || run.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        run.code.toLowerCase().includes(normalizedSearch) ||
        run.bankAccountLabel.toLowerCase().includes(normalizedSearch) ||
        run.owner.toLowerCase().includes(normalizedSearch) ||
        run.nextAction.toLowerCase().includes(normalizedSearch) ||
        run.invoices.some(
          (invoice) =>
            invoice.invoiceCode.toLowerCase().includes(normalizedSearch) ||
            invoice.supplierName.toLowerCase().includes(normalizedSearch)
        );

      return matchesStatus && matchesSearch;
    });
  }, [overview, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredRuns), [filteredRuns]);

  const selectedRun = useMemo(
    () => filteredRuns.find((run) => run.id === selectedId) ?? filteredRuns[0] ?? null,
    [filteredRuns, selectedId]
  );
  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.paymentRunId === selectedRun?.id) ?? [],
    [overview, selectedRun]
  );
  const selectedRunGate = useMemo(() => buildSelectedRunGate(selectedRun), [selectedRun]);
  const selectedRunHumanStep = useMemo(() => buildSelectedRunHumanStep(selectedRun), [selectedRun]);
  const selectedRunWhyNow = useMemo(() => buildSelectedRunWhyNow(selectedRun), [selectedRun]);
  const selectedRunDownstreamEffect = useMemo(() => buildSelectedRunDownstreamEffect(selectedRun), [selectedRun]);
  const selectedRunReportBack = useMemo(() => buildSelectedRunReportBack(selectedRun), [selectedRun]);
  const selectedRunLinks = useMemo(() => buildSelectedRunLinks(selectedRun), [selectedRun]);
  const selectedRunDesk = useMemo(() => buildSelectedRunDesk(selectedRun), [selectedRun]);
  const eligibleInvoices = useMemo(
    () => overview?.eligibleInvoices ?? [],
    [overview]
  );
  const unavailableInvoices = useMemo(
    () => overview?.unavailableInvoices ?? [],
    [overview]
  );
  const selectedCreateInvoices = useMemo(
    () => eligibleInvoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id)),
    [eligibleInvoices, selectedInvoiceIds]
  );
  const createPaymentRunGate = useMemo(
    () =>
      buildCreatePaymentRunGate({
        bankAccountLabel: form.bankAccountLabel,
        scheduledDate: form.scheduledDate,
        owner: form.owner,
        nextAction: form.nextAction,
        selectedInvoiceCount: selectedCreateInvoices.length,
        selectedInvoiceAmount: selectedCreateInvoices.reduce((sum, invoice) => sum + invoice.pendingAmount, 0),
        availableEligibleInvoices: eligibleInvoices.length
      }),
    [eligibleInvoices.length, form.bankAccountLabel, form.nextAction, form.owner, form.scheduledDate, selectedCreateInvoices]
  );
  const createPaymentRunHumanStep = useMemo(
    () =>
      buildCreatePaymentRunHumanStep({
        selectedInvoiceCount: selectedCreateInvoices.length,
        scheduledDate: form.scheduledDate,
        nextAction: form.nextAction
      }),
    [form.nextAction, form.scheduledDate, selectedCreateInvoices.length]
  );
  const availableTargetRuns = useMemo(
    () => overview?.runs.filter((run) => run.id !== selectedRun?.id && run.status !== "executed") ?? [],
    [overview, selectedRun?.id]
  );
  const accountsPayableContextRows = useMemo(
    () =>
      accountsPayableContext
        ? [
            { label: "Invoice", value: accountsPayableContext.invoiceCode },
            { label: "Supplier", value: accountsPayableContext.supplierName },
            { label: "Project", value: accountsPayableContext.projectName },
            { label: "PO code", value: accountsPayableContext.purchaseOrderCode },
            { label: "Receipt code", value: accountsPayableContext.receiptCode },
            { label: "Next action", value: accountsPayableContext.nextAction }
          ].filter((row) => row.value)
        : [],
    [accountsPayableContext]
  );
  const hasAccountsPayableRunMatch =
    Boolean(accountsPayableContext) &&
    Boolean(selectedRun) &&
    accountsPayableMatchedRunId === selectedRun?.id;

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredRuns.length === 0) {
      setSelectedId(null);
      return;
    }

    const isSelectedVisible = filteredRuns.some((run) => run.id === selectedId);
    if (!isSelectedVisible) {
      setSelectedId(filteredRuns[0]?.id ?? null);
    }
  }, [filteredRuns, overview, selectedId]);

  useEffect(() => {
    setNextActionDraft(selectedRun?.nextAction ?? "");
    setMessage(null);
    setError(null);
  }, [selectedRun?.id, selectedRun?.nextAction]);

  useEffect(() => {
    if (
      !overview ||
      !accountsPayableContext ||
      !accountsPayableContextKey ||
      appliedAccountsPayableContextKey === accountsPayableContextKey
    ) {
      return;
    }

    const preloadTerms = [
      accountsPayableContext.invoiceCode,
      accountsPayableContext.supplierName,
      accountsPayableContext.projectName,
      accountsPayableContext.purchaseOrderCode
    ].filter(Boolean);
    if (preloadTerms.length > 0) {
      setSearchFilter(preloadTerms.join(" "));
    }

    if (accountsPayableContext.nextAction.length > 0) {
      setForm((current) => ({
        ...current,
        nextAction: accountsPayableContext.nextAction || current.nextAction
      }));
    }

    const matchedRun = findBestMatchingPaymentRun(overview, accountsPayableContext);
    if (matchedRun) {
      setSelectedId(matchedRun.id);
      setAccountsPayableMatchedRunId(matchedRun.id);
      setAppliedAccountsPayableContextKey(accountsPayableContextKey);
      return;
    }

    const matchedEligibleInvoiceIds = findMatchingEligibleInvoiceIds(overview, accountsPayableContext);
    if (matchedEligibleInvoiceIds.length > 0) {
      setSelectedInvoiceIds(matchedEligibleInvoiceIds);
    }

    setAccountsPayableMatchedRunId(null);
    setAppliedAccountsPayableContextKey(accountsPayableContextKey);
  }, [accountsPayableContext, accountsPayableContextKey, appliedAccountsPayableContextKey, overview]);

  function recomputeSummary(runs: TreasuryPaymentRunContract[]) {
    return {
      activeRuns: runs.filter((run) => run.status !== "executed").length,
      scheduledAmount: runs.filter((run) => run.status !== "executed").reduce((sum, run) => sum + run.totalAmount, 0),
      blockedRuns: runs.filter((run) => run.status === "blocked").length,
      executedRuns: runs.filter((run) => run.status === "executed").length,
      criticalInvoices: runs.reduce((sum, run) => sum + run.criticalInvoices, 0),
      readyRuns: runs.filter((run) => run.status === "ready").length,
      duplicateAssignments: 0
    };
  }

  async function handleUpdate(status: TreasuryPaymentRunContract["status"]) {
    if (!selectedRun) {
      return;
    }

    const nextAction = nextActionDraft.trim();
    if (nextAction.length < 8) {
      setError("Next action must describe the treasury release follow-up.");
      return;
    }

    if (status === "executed" && selectedRun.status !== "ready") {
      setError("Only runs already marked ready can be executed.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await updateTreasuryPaymentRun(
      selectedRun.id,
      activeCompany.id,
      { status, nextAction },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Payment run update failed.");
      return;
    }
    const updated = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }
      const runs = current.runs.map((run) => (run.id === updated.id ? updated : run));
      return { ...current, summary: recomputeSummary(runs), runs, focusRun: updated };
    });
    setMessage(`Payment run moved to ${updated.status}.`);
  }

  async function handleCreate() {
    if (form.bankAccountLabel.trim().length < 8) {
      setError("Bank account label must be descriptive enough for treasury operations.");
      return;
    }

    if (!form.scheduledDate) {
      setError("Scheduled date is required.");
      return;
    }

    if (form.owner.trim().length < 3) {
      setError("Owner must contain at least 3 characters.");
      return;
    }

    if (form.nextAction.trim().length < 8) {
      setError("Next action must describe the release plan.");
      return;
    }

    if (selectedInvoiceIds.length === 0) {
      setError("Select at least one eligible invoice before creating a payment run.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await createTreasuryPaymentRun(
      activeCompany.id,
      {
        bankAccountLabel: form.bankAccountLabel.trim(),
        scheduledDate: form.scheduledDate,
        owner: form.owner.trim(),
        nextAction: form.nextAction.trim(),
        invoiceIds: selectedInvoiceIds
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Payment run creation failed.");
      return;
    }
    const created = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }
      const runs = [created, ...current.runs];
      return { ...current, summary: recomputeSummary(runs), runs, focusRun: created };
    });
    setSelectedId(created.id);
    setSelectedInvoiceIds([]);
    setForm(emptyCreateForm);
    setMessage(`${created.code} created.`);
  }

  async function handleRemoveInvoice(invoiceId: string) {
    if (!selectedRun) {
      return;
    }

    setMessage(null);
    setError(null);
    const response = await removeTreasuryPaymentRunInvoice(
      selectedRun.id,
      invoiceId,
      activeCompany.id,
      nextActionDraft || "Separated invoice from treasury batch for revalidation.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Invoice removal from payment run failed.");
      return;
    }

    await reloadOverview();
    setMessage(`Invoice removed from ${selectedRun.code}; run returned to draft for revalidation.`);
  }

  async function handleAddInvoiceToRun() {
    if (!selectedRun) {
      return;
    }

    if (!selectedEligibleInvoiceId) {
      setError("Select one eligible invoice before adding it to the run.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await addTreasuryPaymentRunInvoice(
      selectedRun.id,
      activeCompany.id,
      selectedEligibleInvoiceId,
      nextActionDraft || "Added eligible invoice into treasury batch for updated release review.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Invoice add into payment run failed.");
      return;
    }

    setSelectedEligibleInvoiceId("");
    await reloadOverview();
    setMessage(`Invoice added into ${selectedRun.code}; run returned to draft for revalidation.`);
  }

  async function handleMoveInvoice(invoiceId: string) {
    if (!selectedRun) {
      return;
    }

    const targetPaymentRunId = moveTargets[invoiceId];
    if (!targetPaymentRunId) {
      setError("Choose a target run before moving the invoice.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await moveTreasuryPaymentRunInvoice(
      selectedRun.id,
      invoiceId,
      activeCompany.id,
      targetPaymentRunId,
      nextActionDraft || "Moved invoice into another treasury batch for cleaner release sequencing.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Invoice move between payment runs failed.");
      return;
    }

    setMoveTargets((current) => ({ ...current, [invoiceId]: "" }));
    await reloadOverview();
    setMessage(`Invoice moved out of ${selectedRun.code} into another open run.`);
  }

  return (
    <AppShell title="Treasury Payment Runs" eyebrow="Treasury execution" description="Batch and release supplier payments with fiscal and evidence controls.">
      <ModuleGate moduleKeys={["finance.accounting"]} requiredPermissions={["finance:*", "finance:read"]} title="Treasury payment runs">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Active runs" value={String(filteredSummary.activeRuns)} footnote="Visible treasury batches still in play." />
              <KpiCard label="Scheduled amount" value={`MXN ${filteredSummary.scheduledAmount.toLocaleString()}`} footnote="Pending disbursement volume across visible open runs." />
              <KpiCard label="Blocked runs" value={String(filteredSummary.blockedRuns)} footnote="Visible runs held by fiscal or evidence blockers." />
              <KpiCard label="Ready runs" value={String(filteredSummary.readyRuns)} footnote="Visible runs that can move to execution." />
              <KpiCard label="Duplicate assignments" value={String(filteredSummary.duplicateAssignments)} footnote="Invoices duplicated across visible active runs must be rebalanced." />
            </section>

            {accountsPayableContextRows.length > 0 ? (
              <section className="grid cols1">
                <Card
                  title="Accounts-payable context"
                  description={
                    hasAccountsPayableRunMatch
                      ? "A related treasury run was found and opened from accounts payable."
                      : selectedInvoiceIds.length > 0
                        ? "No open run matched cleanly, so eligible invoices were preselected for a new treasury batch."
                        : "No clear run matched. Treasury keeps the AP context visible for manual continuation."
                  }
                  aside={<Badge tone="info">Precargada desde cuentas por pagar / Preloaded from accounts payable</Badge>}
                >
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Context status</div>
                      <div>
                        <Badge tone="info">
                          {hasAccountsPayableRunMatch
                            ? "Context applied"
                            : selectedInvoiceIds.length > 0
                              ? "Eligible invoices preselected"
                              : "Context visible"}
                        </Badge>
                      </div>
                    </div>
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

            <section className="grid cols3">
              <Card
                title="Treasury walkthrough"
                description="Assemble payment batches from validated invoices, rebalance them, then release execution."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    This screen now supports human testing of the full treasury loop: create run, add or remove invoices, move them between runs and mark execution posture.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">accounts payable</Badge>
                    <Badge tone="info">treasury</Badge>
                    <Badge tone="info">release flow</Badge>
                  </div>
                </div>
              </Card>

              <Card
                title="Payment release workflow"
                description="Use treasury as the execution bridge between accounts payable, supplier readiness and real bank release."
                aside={<Badge tone={filteredSummary.blockedRuns > 0 ? "danger" : filteredSummary.readyRuns > 0 ? "warning" : "success"}>{filteredSummary.blockedRuns > 0 ? "blocked" : filteredSummary.readyRuns > 0 ? "ready to release" : "stable"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Upstream check</div><div>Validate supplier fiscal packet and invoice evidence before the batch is even assembled.</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury action</div><div>Group invoices by release lane, move them between runs and avoid executing false-ready batches.</div></div>
                  <div className="detailRow"><div className="detailLabel">Downstream continuity</div><div>Confirm finance and cash-flow impact immediately after the batch is marked ready or executed.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/accounts-payable">Open accounts payable</Link>
                  <Link className="buttonGhost" href="/supplier-master">Open supplier master</Link>
                  <Link className="buttonGhost" href={buildPaymentRunCashFlowHref(selectedRun)}>Open cash flow</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Payment run board" description="Treasury batches and current release posture.">
                <FilterBar summary={`${filteredRuns.length} runs match the current operating filters`}>
                  <label className="fieldLabel">
                    Status
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">All</option>
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                      <option value="blocked">Blocked</option>
                      <option value="executed">Executed</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Run, bank account, owner or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "treasury ready"}</Badge>
                  <Badge tone={filteredSummary.blockedRuns > 0 ? "danger" : filteredSummary.readyRuns > 0 ? "warning" : "success"}>
                    {filteredSummary.blockedRuns > 0
                      ? `${filteredSummary.blockedRuns} blocked`
                      : filteredSummary.readyRuns > 0
                        ? `${filteredSummary.readyRuns} ready`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredRuns}
                  columns={[
                    {
                      key: "run",
                      label: "Run",
                      render: (row) => (
                        <button className="buttonGhost" type="button" onClick={() => setSelectedId(row.id)} style={{ justifyContent: "flex-start", paddingInline: 0 }}>
                          <div className="tableCellStack">
                            <strong>{row.code}</strong>
                            <span className="tableCellMuted">{row.bankAccountLabel}</span>
                          </div>
                        </button>
                      )
                    },
                    { key: "date", label: "Date", render: (row) => row.scheduledDate },
                    { key: "amount", label: "Amount", render: (row) => `MXN ${row.totalAmount.toLocaleString()}` },
                    { key: "status", label: "Status", render: (row) => <Badge tone={tone(row.status)}>{row.status}</Badge> }
                  ]}
                />
              </Card>

              <Card title="Selected run" description="Treasury release posture for the active batch." aside={selectedRun ? <Badge tone={tone(selectedRun.status)}>{selectedRun.status}</Badge> : null}>
                {selectedRun ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Owner</div><div>{selectedRun.owner}</div></div>
                    <div className="detailRow"><div className="detailLabel">Invoices</div><div>{selectedRun.totalInvoices}</div></div>
                    <div className="detailRow"><div className="detailLabel">Critical invoices</div><div>{selectedRun.criticalInvoices}</div></div>
                    <div className="detailRow">
                      <div className="detailLabel">Treasury gate</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={selectedRunGate.tone}>{selectedRunGate.label}</Badge>
                          <span>{selectedRunGate.summary}</span>
                        </div>
                        {selectedRunGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">{check}</span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow"><div className="detailLabel">Next human step</div><div>{selectedRunHumanStep}</div></div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Módulo responsable", "Responsible module")}</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(selectedRunDesk.primaryLabel)}</strong>
                        <span className="tableCellMuted">{localizeText(selectedRunDesk.primaryReason)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Segundo salto", "Secondary jump")}</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(selectedRunDesk.secondaryLabel)}</strong>
                        <span className="tableCellMuted">{localizeText(selectedRunDesk.secondaryReason)}</span>
                      </div>
                    </div>
                    <div className="detailRow"><div className="detailLabel">Why now</div><div>{selectedRunWhyNow}</div></div>
                    <div className="detailRow"><div className="detailLabel">Downstream effect</div><div>{selectedRunDownstreamEffect}</div></div>
                    <div className="detailRow"><div className="detailLabel">Report back</div><div>{selectedRunReportBack}</div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Qué debe regresar confirmado", "What must return confirmed")}</div><div>{localizeText(selectedRunDesk.returnRule)}</div></div>
                    <label className="stack">
                      <span className="detailLabel">Next action</span>
                      <textarea className="field" rows={4} value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} />
                    </label>
                    <div className="cluster">
                      <button className="button" type="button" onClick={() => void handleUpdate("ready")}>{localizeText(paymentRunActionLabel("ready"))}</button>
                      <button className="buttonGhost" type="button" onClick={() => void handleUpdate("blocked")}>{localizeText(paymentRunActionLabel("blocked"))}</button>
                      <button className="button" type="button" onClick={() => void handleUpdate("executed")}>{localizeText(paymentRunActionLabel("executed"))}</button>
                    </div>
                    <div className="row gap wrap">
                      {selectedRunLinks.map((link, index) => (
                        <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>{localizeText(paymentRunLinkLabel(link.label))}</Link>
                      ))}
                    </div>
                    {selectedRun.status !== "executed" ? (
                      <div className="detailRow">
                        <div className="detailLabel">Add eligible invoice</div>
                        <div className="row gap wrap" style={{ flex: 1 }}>
                          <select className="field" value={selectedEligibleInvoiceId} onChange={(event) => setSelectedEligibleInvoiceId(event.target.value)}>
                            <option value="">Select eligible invoice</option>
                            {eligibleInvoices.map((invoice) => (
                              <option key={invoice.id} value={invoice.id}>
                                {invoice.code} · {invoice.supplierName} · MXN {invoice.pendingAmount.toLocaleString()}
                              </option>
                            ))}
                          </select>
                          <button className="button" type="button" disabled={!selectedEligibleInvoiceId} onClick={() => void handleAddInvoiceToRun()}>
                            Add
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="stack">
                      {selectedRun.invoices.map((invoice) => (
                        <div key={invoice.invoiceId} className="detailRow">
                          <div className="detailLabel">{invoice.invoiceCode}</div>
                          <div className="tableCellStack" style={{ alignItems: "flex-start" }}>
                            <span>{invoice.supplierName} · MXN {invoice.total.toLocaleString()}</span>
                            <span className="tableCellMuted">{invoice.complementStatus} / {invoice.receiptEvidenceStatus}</span>
                          </div>
                          {selectedRun.status !== "executed" ? (
                            <div className="row gap wrap">
                              <button className="buttonGhost" type="button" onClick={() => void handleRemoveInvoice(invoice.invoiceId)}>
                                Separate
                              </button>
                              {availableTargetRuns.length > 0 ? (
                                <>
                                  <select
                                    className="field"
                                    value={moveTargets[invoice.invoiceId] ?? ""}
                                    onChange={(event) =>
                                      setMoveTargets((current) => ({ ...current, [invoice.invoiceId]: event.target.value }))
                                    }
                                  >
                                    <option value="">Move to run</option>
                                    {availableTargetRuns.map((run) => (
                                      <option key={run.id} value={run.id}>
                                        {run.code} · MXN {run.totalAmount.toLocaleString()}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    className="button"
                                    type="button"
                                    disabled={!moveTargets[invoice.invoiceId]}
                                    onClick={() => void handleMoveInvoice(invoice.invoiceId)}
                                  >
                                    Move
                                  </button>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {message ? <Badge tone="success">{message}</Badge> : null}
                    {error ? <Badge tone="danger">{error}</Badge> : null}
                  </div>
                ) : (
                  <EmptyState title="Select a run" description="Choose a treasury batch to inspect release conditions." />
                )}
              </Card>

              <Card title="Run risks" description="Current blockers on the selected payment run.">
                {selectedRisks.length > 0 ? (
                  <DataTable
                    rows={selectedRisks}
                    columns={[
                      { key: "risk", label: "Risk", render: (row) => row.title },
                      { key: "category", label: "Category", render: (row) => row.category },
                      { key: "severity", label: "Severity", render: (row) => <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>{row.severity}</Badge> }
                    ]}
                  />
                ) : (
                  <EmptyState title="No mapped risks" description="The selected run currently has no explicit treasury risk." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Create payment run" description="Select payable invoices and create a treasury batch.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Bank account</div><input className="field" value={form.bankAccountLabel} onChange={(event) => setForm((current) => ({ ...current, bankAccountLabel: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Scheduled date</div><input className="field" type="date" value={form.scheduledDate} onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Owner</div><input className="field" value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={form.nextAction} onChange={(event) => setForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="stack" style={{ marginTop: 12 }}>
                  {eligibleInvoices.length > 0 ? (
                    eligibleInvoices.map((invoice) => (
                      <label key={invoice.id} className="detailRow">
                        <div className="detailLabel">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.includes(invoice.id)}
                            onChange={(event) =>
                              setSelectedInvoiceIds((current) =>
                                event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id)
                              )
                            }
                          />
                        </div>
                        <div>{invoice.code} · {invoice.supplierName} · MXN {invoice.pendingAmount.toLocaleString()}</div>
                      </label>
                    ))
                  ) : (
                    <EmptyState
                      title="No eligible invoices"
                      description="All current invoices are either already assigned, paid, fiscally blocked or missing receiving evidence."
                    />
                  )}
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createPaymentRunGate.tone}>{createPaymentRunGate.label}</Badge>
                        <span>{createPaymentRunGate.summary}</span>
                      </div>
                      {createPaymentRunGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">{check}</span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{createPaymentRunHumanStep}</div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button className="button" type="button" onClick={() => void handleCreate()}>Create Run</button>
                  <button className="buttonGhost" type="button" onClick={() => setForm(createPaymentRunExample())}>Load demo example</button>
                  <button className="buttonGhost" type="button" onClick={() => { setForm(emptyCreateForm); setSelectedInvoiceIds([]); }}>Reset form</button>
                  <Link className="buttonGhost" href="/accounts-payable">Review AP</Link>
                  <Link className="buttonGhost" href="/supplier-master">Review suppliers</Link>
                </div>
              </Card>

              <Card title="Release rules" description="Treasury should not execute batches with fake readiness.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Ready / executed</div><div>Runs cannot advance if any invoice remains critical, risky or with missing receipt evidence.</div></div>
                  <div className="detailRow"><div className="detailLabel">Executed</div><div>A run must first be `ready` before it can be executed.</div></div>
                  <div className="detailRow"><div className="detailLabel">Scope</div><div>The batch is linked directly to payable invoices already living in CXP.</div></div>
                </div>
                <div className="stack" style={{ marginTop: 16 }}>
                  {unavailableInvoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.invoiceId} className="detailRow">
                      <div className="detailLabel">
                        <Badge tone={unavailableTone(invoice.reasonCode)}>{invoice.reasonCode}</Badge>
                      </div>
                      <div>
                        {invoice.invoiceCode} · {invoice.supplierName} · {invoice.reasonLabel}
                        {invoice.blockingRunCodes.length > 0 ? ` (${invoice.blockingRunCodes.join(", ")})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Treasury payment runs unavailable"
            description={error ?? "We could not load treasury payment runs for this company."}
            primaryAction={{ label: "Go to accounts payable", href: "/accounts-payable" }}
            secondaryAction={{ label: "Open finance", href: "/finance" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
