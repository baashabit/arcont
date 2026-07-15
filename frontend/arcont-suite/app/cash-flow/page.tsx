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
import type { CashFlowLineContract, CashFlowOverviewContract } from "@/lib/contracts";
import {
  fetchAccountsPayableOverview,
  fetchCashFlowOverview,
  fetchSupplierMasterOverview,
  fetchTreasuryPaymentRunsOverview,
  updateCashFlowLine
} from "@/lib/platform-api";

function healthTone(status: CashFlowLineContract["health"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function cashFlowHealthLabel(status: CashFlowLineContract["health"]) {
  switch (status) {
    case "controlled":
      return { es: "Controlado", en: "Controlled" };
    case "watch":
      return { es: "Vigilancia", en: "Watch" };
    default:
      return { es: "Crítico", en: "Critical" };
  }
}

function cashFlowSourceLabel(sourceType: CashFlowLineContract["sourceType"]) {
  switch (sourceType) {
    case "cash":
      return { es: "Caja", en: "Cash" };
    case "payables":
      return { es: "Cuentas por pagar", en: "Payables" };
    case "collections":
      return { es: "Cobranza", en: "Collections" };
    case "tax":
      return { es: "Fiscal", en: "Tax" };
    default:
      return { es: "Cierre", en: "Close" };
  }
}

type CashFlowQueueInsight = {
  line: CashFlowLineContract;
  lane: {
    tone: "success" | "warning" | "danger" | "info";
    label: { es: string; en: string };
    helper: { es: string; en: string };
  };
};

function buildCashFlowLane(line: CashFlowLineContract): CashFlowQueueInsight["lane"] {
  if (line.health === "critical") {
    return {
      tone: "danger",
      label: { es: "Contención inmediata", en: "Immediate containment" },
      helper: { es: "La secuencia semanal ya está bajo presión real.", en: "Weekly sequencing is already under real pressure." }
    };
  }

  if (line.weeklyNet < 0) {
    return {
      tone: "warning",
      label: { es: "Gap semanal", en: "Weekly gap" },
      helper: { es: "Reordena salida o recupera entrada antes del siguiente corte.", en: "Resequence outflow or recover inflow before the next cutoff." }
    };
  }

  if (line.confidencePercent < 75) {
    return {
      tone: "warning",
      label: { es: "Pronóstico débil", en: "Weak forecast" },
      helper: { es: "Tesorería no debería confiar todavía en esta proyección.", en: "Treasury should not trust this projection yet." }
    };
  }

  if (line.openPressureItems > 0) {
    return {
      tone: "info",
      label: { es: "Seguimiento activo", en: "Active follow-up" },
      helper: { es: "Sigue vivo por pendientes operativos, aunque no esté crítico.", en: "Still active because of open operating items, even if not critical." }
    };
  }

  return {
    tone: "success",
    label: { es: "Listo para continuidad", en: "Ready for continuity" },
    helper: { es: "Puede continuar sin reconstruir el contexto financiero.", en: "Can continue without rebuilding the financial context." }
  };
}

function lineActionOptions(line: CashFlowLineContract) {
  switch (line.health) {
    case "critical":
      return [
        {
          label: "Move to watch",
          health: "watch" as const,
          nextAction: "Contain the short-term gap and keep treasury monitoring active while backlog clears"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          health: "critical" as const,
          nextAction: "Escalate the stream because short-term liquidity pressure remains unresolved"
        },
        {
          label: "Mark controlled",
          health: "controlled" as const,
          nextAction: "Collections, payables and evidence now support a stable weekly cash outlook"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          health: "watch" as const,
          nextAction: "Monitor this stream before treasury drift impacts the next disbursement cycle"
        }
      ];
  }
}

function recomputeSummary(lines: CashFlowLineContract[]) {
  return {
    trackedStreams: lines.length,
    projectedInflows: lines.reduce((sum, item) => sum + item.projectedInflows, 0),
    projectedOutflows: lines.reduce((sum, item) => sum + item.projectedOutflows, 0),
    weeklyNet: lines.reduce((sum, item) => sum + item.weeklyNet, 0),
    criticalStreams: lines.filter((item) => item.health === "critical").length,
    averageConfidence:
      lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.confidencePercent, 0) / lines.length).toFixed(1)) : 0
  };
}

function pickFocusLine(lines: CashFlowLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.health === "critical" && right.health !== "critical") {
          return -1;
        }

        if (left.health !== "critical" && right.health === "critical") {
          return 1;
        }

        return left.weeklyNet - right.weeklyNet;
      })[0] ?? null
  );
}

function buildCashFlowStory(line: CashFlowLineContract | null, riskCount: number) {
  if (!line) {
    return null;
  }

  return {
    liquiditySignal:
      line.weeklyNet < 0
        ? `This stream is projecting a weekly gap of MXN ${Math.abs(line.weeklyNet).toLocaleString()}.`
        : `This stream is projecting a weekly surplus of MXN ${line.weeklyNet.toLocaleString()}.`,
    confidenceSignal:
      line.confidencePercent < 75
        ? `Projection confidence is only ${line.confidencePercent}%, so treasury should treat this stream as volatile.`
        : `Projection confidence is ${line.confidencePercent}%, which is usable for weekly treasury sequencing.`,
    decisionLane:
      riskCount > 0
        ? `${riskCount} mapped treasury blockers remain active and should be worked before the next disbursement cycle.`
        : "No mapped blocker is active; keep follow-up centered on execution discipline and forecast refresh."
  };
}

function buildCashFlowWhyNow(line: CashFlowLineContract | null) {
  if (!line) {
    return "Choose a stream to understand why it deserves attention right now.";
  }

  if (line.health === "critical") {
    return "This stream is already in critical posture, so treasury delay here can immediately distort payment timing and confidence.";
  }

  if (line.weeklyNet < 0) {
    return "A negative weekly net means the stream is already threatening short-term liquidity if left unattended.";
  }

  if (line.confidencePercent < 75) {
    return "Low forecast confidence means direction and treasury may be sequencing payments on unstable assumptions.";
  }

  if (line.openPressureItems > 0) {
    return `${line.openPressureItems} open pressure item(s) still make this stream operationally active, not just a forecast line.`;
  }

  return "This stream is relatively stable, but still needs disciplined follow-through to preserve liquidity continuity.";
}

function buildCashFlowDownstreamEffect(line: CashFlowLineContract | null) {
  if (!line) {
    return "Choose a stream to inspect what it can block downstream.";
  }

  if (line.health === "critical" || line.weeklyNet < 0) {
    return "The downstream effect is payment prioritization, treasury release tension and higher execution pressure on finance and AP.";
  }

  if (line.confidencePercent < 75) {
    return "The downstream effect is sequencing risk: treasury can schedule against a projection that still moves too much.";
  }

  if (line.openPressureItems > 0) {
    return "The downstream effect is operational drag across AP, supplier conversations and weekly cash planning.";
  }

  return "The downstream effect is mostly continuity discipline: keep finance, AP and treasury aligned so the stream stays controlled.";
}

function buildCashFlowReportBack(line: CashFlowLineContract | null) {
  if (!line) {
    return "Choose a stream to define the next report-back window.";
  }

  if (line.health === "critical" || line.weeklyNet < 0) {
    return "Report back before the next disbursement cycle with containment status and updated net liquidity outlook.";
  }

  if (line.confidencePercent < 75) {
    return "Report back once forecast confidence is refreshed enough for treasury to trust the sequence.";
  }

  if (line.openPressureItems > 0) {
    return "Report back in the same operating cycle once the open pressure items are explicitly owned or cleared.";
  }

  return "Report back on the next treasury refresh confirming the stream stayed controlled and predictable.";
}

function buildCashFlowHumanStep(line: CashFlowLineContract | null) {
  if (!line) {
    return "Choose a stream to see the next treasury move.";
  }

  if (line.health === "critical") {
    return "Contain the highest-pressure disbursement or collection item now and assign an owner before treasury sequences anything else around this stream.";
  }

  if (line.weeklyNet < 0) {
    return "Re-sequence the immediate outflow pressure and confirm whether AP or treasury can delay, split or re-prioritize the next cash event.";
  }

  if (line.confidencePercent < 75) {
    return "Refresh the forecast inputs first so treasury is not acting on a stream that still moves too much week to week.";
  }

  if (line.openPressureItems > 0) {
    return "Clear the named pressure items now and confirm which one still blocks a clean treasury or finance decision.";
  }

  return "Keep the stream under weekly review and move directly into treasury or finance execution without rebuilding the liquidity context.";
}

function buildCashFlowRouteSummary(line: CashFlowLineContract | null) {
  if (!line) {
    return "Use cash flow as the weekly liquidity lane between AP, treasury, suppliers and finance sequencing.";
  }

  if (line.health === "critical") {
    return "This stream should route first through treasury containment and payment reprioritization before a wider finance promise is made.";
  }

  if (line.weeklyNet < 0) {
    return "This stream should route through treasury and AP resequencing before the gap starts distorting execution timing.";
  }

  if (line.confidencePercent < 75) {
    return "This stream should route through forecast refresh and finance review before treasury trusts the next move.";
  }

  if (line.openPressureItems > 0) {
    return "This stream should route through the named pressure owner first so liquidity assumptions are not left half-explicit.";
  }

  return "This stream can continue through treasury, finance and AP without rebuilding the same liquidity context.";
}

function buildCashFlowOperationalLinks(line: CashFlowLineContract | null) {
  if (!line) {
    return [
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open accounts payable", href: "/accounts-payable" },
      { label: "Open finance", href: "/finance" }
    ];
  }

  if (line.health === "critical") {
    return [
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open accounts payable", href: "/accounts-payable" },
      { label: "Open supplier master", href: "/supplier-master" }
    ];
  }

  if (line.weeklyNet < 0) {
    return [
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open finance", href: buildCashFlowFinanceHref(line) },
      { label: "Open accounts payable", href: "/accounts-payable" }
    ];
  }

  if (line.confidencePercent < 75) {
    return [
      { label: "Open finance", href: buildCashFlowFinanceHref(line) },
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open supplier master", href: "/supplier-master" }
    ];
  }

  return [
    { label: "Open treasury", href: "/treasury/payment-runs" },
    { label: "Open finance", href: buildCashFlowFinanceHref(line) },
    { label: "Open accounts payable", href: "/accounts-payable" }
  ];
}

function buildCashFlowFinanceHref(line: CashFlowLineContract | null) {
  if (!line) {
    return "/finance";
  }

  const query = new URLSearchParams({
    source: "cash-flow",
    lineCode: line.code,
    streamName: line.streamName,
    sourceType: line.sourceType,
    health: line.health,
    weeklyNet: String(line.weeklyNet),
    openPressureItems: String(line.openPressureItems),
    nextAction: line.nextAction
  });

  return `/finance?${query.toString()}`;
}

function cashFlowLinkLabel(href: string) {
  switch (href) {
    case "/treasury/payment-runs":
      return { es: "Abrir tesorería", en: "Open treasury" };
    case "/accounts-payable":
      return { es: "Abrir CXP", en: "Open accounts payable" };
    case "/supplier-master":
      return { es: "Abrir proveedores", en: "Open supplier master" };
    default:
      return { es: "Abrir finanzas", en: "Open finance" };
  }
}

type PaymentRunCashFlowContext = {
  source: "payment-runs";
  runCode: string;
  runStatus: string;
  runOwner: string;
  criticalInvoices: number;
  totalAmount: number;
  nextAction: string;
};

function buildPaymentRunCashFlowContext(
  searchParams: ReturnType<typeof useSearchParams>
): PaymentRunCashFlowContext | null {
  if (searchParams.get("source") !== "payment-runs") {
    return null;
  }

  const criticalInvoicesValue = Number(searchParams.get("criticalInvoices") ?? "0");
  const totalAmountValue = Number(searchParams.get("totalAmount") ?? "0");

  const context = {
    source: "payment-runs" as const,
    runCode: searchParams.get("runCode")?.trim() ?? "",
    runStatus: searchParams.get("runStatus")?.trim() ?? "",
    runOwner: searchParams.get("runOwner")?.trim() ?? "",
    criticalInvoices: Number.isFinite(criticalInvoicesValue) ? criticalInvoicesValue : 0,
    totalAmount: Number.isFinite(totalAmountValue) ? totalAmountValue : 0,
    nextAction: searchParams.get("nextAction")?.trim() ?? ""
  };

  return Object.values(context).some((value) => (typeof value === "string" ? value.length > 0 : value > 0)) ? context : null;
}

function findBestMatchingCashFlowLine(
  overview: CashFlowOverviewContract,
  context: PaymentRunCashFlowContext
) {
  return (
    overview.lines
      .map((line) => {
        let score = 0;

        if (context.runStatus === "blocked" || context.runStatus === "draft" || context.criticalInvoices > 0) {
          if (line.sourceType === "payables") {
            score += 8;
          }
          if (line.health !== "controlled") {
            score += 2;
          }
        }

        if ((context.runStatus === "ready" || context.runStatus === "executed") && context.criticalInvoices === 0) {
          if (line.sourceType === "cash") {
            score += 8;
          }
          if (line.health === "controlled" || line.health === "watch") {
            score += 2;
          }
        }

        if (context.nextAction.toLowerCase().includes("fiscal") && line.sourceType === "tax") {
          score += 4;
        }

        if (context.nextAction.length > 0 && line.nextAction.toLowerCase().includes(context.nextAction.toLowerCase().slice(0, 12))) {
          score += 1;
        }

        return { line, score };
      })
      .sort((left, right) => right.score - left.score)
      .find((item) => item.score > 0)
      ?.line ?? null
  );
}

export default function CashFlowPage() {
  const searchParams = useSearchParams();
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const t = useCallback((es: string, en: string) => localizeText({ es, en }), [localizeText]);
  const paymentRunContext = useMemo(() => buildPaymentRunCashFlowContext(searchParams), [searchParams]);
  const [overview, setOverview] = useState<CashFlowOverviewContract | null>(null);
  const [accountsPayableOverview, setAccountsPayableOverview] = useState<Awaited<ReturnType<typeof fetchAccountsPayableOverview>> | null>(null);
  const [supplierMasterOverview, setSupplierMasterOverview] = useState<Awaited<ReturnType<typeof fetchSupplierMasterOverview>> | null>(null);
  const [treasuryOverview, setTreasuryOverview] = useState<Awaited<ReturnType<typeof fetchTreasuryPaymentRunsOverview>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | CashFlowLineContract["health"]>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | CashFlowLineContract["sourceType"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [appliedPaymentRunContextKey, setAppliedPaymentRunContextKey] = useState<string | null>(null);
  const [paymentRunMatchedLineId, setPaymentRunMatchedLineId] = useState<string | null>(null);
  const paymentRunContextKey = useMemo(
    () =>
      paymentRunContext
        ? [
            paymentRunContext.source,
            paymentRunContext.runCode,
            paymentRunContext.runStatus,
            paymentRunContext.runOwner,
            String(paymentRunContext.criticalInvoices),
            String(paymentRunContext.totalAmount),
            paymentRunContext.nextAction
          ].join("|")
        : null,
    [paymentRunContext]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchCashFlowOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchAccountsPayableOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchSupplierMasterOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchTreasuryPaymentRunsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, accountsPayableResult, supplierMasterResult, treasuryResult]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Cash flow overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setAccountsPayableOverview(accountsPayableResult);
        setSupplierMasterOverview(supplierMasterResult);
        setTreasuryOverview(treasuryResult);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
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
      const matchesHealth = healthFilter === "all" || line.health === healthFilter;
      const matchesSource = sourceFilter === "all" || line.sourceType === sourceFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        line.streamName.toLowerCase().includes(normalizedSearch) ||
        line.code.toLowerCase().includes(normalizedSearch) ||
        line.sourceType.toLowerCase().includes(normalizedSearch) ||
        line.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesSource && matchesSearch;
    });
  }, [healthFilter, overview, searchFilter, sourceFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedStory = useMemo(() => buildCashFlowStory(selectedLine, selectedRisks.length), [selectedLine, selectedRisks.length]);
  const selectedWhyNow = useMemo(() => buildCashFlowWhyNow(selectedLine), [selectedLine]);
  const selectedDownstreamEffect = useMemo(() => buildCashFlowDownstreamEffect(selectedLine), [selectedLine]);
  const selectedReportBack = useMemo(() => buildCashFlowReportBack(selectedLine), [selectedLine]);
  const selectedHumanStep = useMemo(() => buildCashFlowHumanStep(selectedLine), [selectedLine]);
  const selectedRouteSummary = useMemo(() => buildCashFlowRouteSummary(selectedLine), [selectedLine]);
  const selectedOperationalLinks = useMemo(() => buildCashFlowOperationalLinks(selectedLine), [selectedLine]);
  const treasuryChainPressure = useMemo(
    () =>
      (supplierMasterOverview?.summary.criticalSuppliers ?? 0) +
      (supplierMasterOverview?.summary.incompletePackets ?? 0) +
      (accountsPayableOverview?.summary.blockedInvoices ?? 0) +
      (accountsPayableOverview?.summary.overdueInvoices ?? 0) +
      (treasuryOverview?.summary.blockedRuns ?? 0) +
      (treasuryOverview?.unavailableInvoices.length ?? 0),
    [accountsPayableOverview, supplierMasterOverview, treasuryOverview]
  );

  const lineActions = useMemo(() => (selectedLine ? lineActionOptions(selectedLine) : []), [selectedLine]);
  const queueInsights = useMemo<CashFlowQueueInsight[]>(
    () =>
      filteredLines.map((line) => ({
        line,
        lane: buildCashFlowLane(line)
      })),
    [filteredLines]
  );
  const queueSummary = useMemo(
    () => ({
      negativeWeeklyNet: filteredLines.filter((line) => line.weeklyNet < 0).length,
      lowConfidence: filteredLines.filter((line) => line.confidencePercent < 75).length,
      criticalOrWatch: filteredLines.filter((line) => line.health !== "controlled").length,
      openPressure: filteredLines.reduce((sum, line) => sum + line.openPressureItems, 0)
    }),
    [filteredLines]
  );
  const selectedLineInsight = useMemo(
    () => queueInsights.find((item) => item.line.id === selectedLine?.id) ?? null,
    [queueInsights, selectedLine?.id]
  );
  const paymentRunContextRows = useMemo(
    () =>
      paymentRunContext
        ? [
            { label: t("Corrida", "Payment run"), value: paymentRunContext.runCode },
            { label: t("Estado", "Status"), value: paymentRunContext.runStatus },
            { label: t("Responsable", "Owner"), value: paymentRunContext.runOwner },
            { label: t("Facturas críticas", "Critical invoices"), value: String(paymentRunContext.criticalInvoices) },
            { label: t("Importe total", "Total amount"), value: paymentRunContext.totalAmount > 0 ? `MXN ${paymentRunContext.totalAmount.toLocaleString()}` : "" },
            { label: t("Siguiente acción", "Next action"), value: paymentRunContext.nextAction }
          ].filter((row) => row.value)
        : [],
    [paymentRunContext, t]
  );
  const hasPaymentRunClearMatch =
    Boolean(paymentRunContext) &&
    Boolean(selectedLine) &&
    paymentRunMatchedLineId === selectedLine?.id;

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

  useEffect(() => {
    if (!overview || !paymentRunContext || !paymentRunContextKey || appliedPaymentRunContextKey === paymentRunContextKey) {
      return;
    }

    const matchedLine = findBestMatchingCashFlowLine(overview, paymentRunContext);
    if (matchedLine) {
      setSelectedLineId(matchedLine.id);
      setSourceFilter(matchedLine.sourceType);
      setPaymentRunMatchedLineId(matchedLine.id);
    } else {
      const fallbackSourceType =
        paymentRunContext.runStatus === "ready" || paymentRunContext.runStatus === "executed"
          ? "cash"
          : "payables";
      setSourceFilter(fallbackSourceType);
      setPaymentRunMatchedLineId(null);
    }

    if (paymentRunContext.nextAction.length > 0) {
      setNextActionDraft(paymentRunContext.nextAction);
    }

    setAppliedPaymentRunContextKey(paymentRunContextKey);
  }, [appliedPaymentRunContextKey, overview, paymentRunContext, paymentRunContextKey]);

  async function handleAction(health: CashFlowLineContract["health"], suggestedNextAction: string) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the cash flow stream.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateCashFlowLine(
      selectedLine.id,
      activeCompany.id,
      {
        health,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Cash flow update failed.");
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
    setActionMessage(`Cash flow stream moved to ${response.data.health}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title={t("Flujo de efectivo", "Cash flow")}
      eyebrow={t("Ejecución de tesorería", "Treasury execution")}
      description={t("Entradas, salidas y presión de liquidez de corto plazo conectadas con señales operativas y fiscales vivas.", "Short-term inflow, outflow and liquidity pressure tied to live operational and fiscal signals.")}
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title={t("Flujo de efectivo", "Cash flow")}
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label={t("Flujos visibles", "Tracked streams")}
                value={String(filteredSummary.trackedStreams)}
                footnote={t("Flujos de tesorería visibles con el filtro actual.", "Treasury streams visible in the current operating filter.")}
              />
              <KpiCard
                label={t("Entradas proyectadas", "Projected inflows")}
                value={`MXN ${filteredSummary.projectedInflows.toLocaleString()}`}
                footnote={t("Entrada esperada de corto plazo en el subconjunto visible.", "Expected short-term cash intake from the visible subset.")}
              />
              <KpiCard
                label={t("Salidas proyectadas", "Projected outflows")}
                value={`MXN ${filteredSummary.projectedOutflows.toLocaleString()}`}
                footnote={t("Salida esperada de corto plazo en el subconjunto visible.", "Expected short-term cash drain from the visible subset.")}
              />
              <KpiCard
                label={t("Neto semanal", "Weekly net")}
                value={`MXN ${filteredSummary.weeklyNet.toLocaleString()}`}
                footnote={t("Gap o superávit semanal direccional en los flujos visibles.", "Directional weekly liquidity gap or surplus from visible streams.")}
              />
              <KpiCard
                label={t("Cadena de tesorería", "Treasury chain")}
                value={String(treasuryChainPressure)}
                footnote={t("Presión combinada entre proveedores, CXP y carril de liberación de tesorería.", "Combined pressure from supplier fiscal posture, AP blockers and treasury release lane.")}
              />
            </section>

            {paymentRunContextRows.length > 0 ? (
              <section className="grid cols1">
                <Card
                  title={t("Contexto recibido desde tesorería", "Context received from treasury")}
                  description={
                    hasPaymentRunClearMatch
                      ? t(
                          "Se identificó el carril financiero relacionado y quedó seleccionado automáticamente.",
                          "The related financial lane was identified and selected automatically."
                        )
                      : t(
                          "No hubo un match exacto por referencia, así que se aplicó el carril más coherente y el contexto sigue visible.",
                          "There was no exact reference match, so the most coherent lane was applied and the context remains visible."
                        )
                  }
                  aside={<Badge tone="info">Precargado desde tesorería / Preloaded from treasury</Badge>}
                >
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">{t("Estado del contexto", "Context status")}</div>
                      <div>
                        <Badge tone="info">
                          {hasPaymentRunClearMatch
                            ? t("Contexto aplicado", "Context applied")
                            : t("Contexto visible", "Context visible")}
                        </Badge>
                      </div>
                    </div>
                    {paymentRunContextRows.map((row) => (
                      <div key={row.label} className="detailRow">
                        <div className="detailLabel">{row.label}</div>
                        <div>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}

            <section className="grid cols2">
              <Card
                title={t("Mesa de decisión semanal", "Weekly decision bench")}
                description={t("Usa esta pantalla para decidir qué flujo requiere contención y cuál ya puede seguir a tesorería.", "Use this board to decide which stream needs containment and which one can continue into treasury.")}
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? t("modo demo", "demo mode") : t("backend vivo", "live backend")}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    {t(
                      "La pantalla ya es operable para prueba humana: revisa presión, actualiza salud del flujo y sigue la cadena de liberación hasta CXP y tesorería.",
                      "The screen is now operable for human testing: review pressure, update stream health and follow the release chain through AP and treasury."
                    )}
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">{t("proveedores", "supplier master")}</Badge>
                    <Badge tone="info">{t("cuentas por pagar", "accounts payable")}</Badge>
                    <Badge tone="info">{t("tesorería", "treasury")}</Badge>
                    <Badge tone="info">{t("flujo de efectivo", "cash flow")}</Badge>
                  </div>
                </div>
              </Card>

              <Card
                title={t("Carril de liberación", "Release lane")}
                description={t("Flujo de efectivo ya lee proveedores, CXP y tesorería en un mismo carril operativo.", "Cash flow now reads suppliers, AP and treasury in one operating lane.")}
                aside={
                  <Badge tone={treasuryChainPressure > 8 ? "danger" : treasuryChainPressure > 3 ? "warning" : "success"}>
                    {treasuryChainPressure > 8 ? t("alta presión", "high pressure") : treasuryChainPressure > 3 ? t("vigilancia", "watch") : t("controlado", "controlled")}
                  </Badge>
                }
              >
                <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">{t("Bloqueos fiscales proveedor", "Supplier fiscal blockers")}</div><div>{supplierMasterOverview?.summary.criticalSuppliers ?? 0} {t("críticos y", "critical and")} {supplierMasterOverview?.summary.incompletePackets ?? 0} {t("expedientes incompletos", "incomplete packets")}</div></div>
                <div className="detailRow"><div className="detailLabel">{t("Cuentas por pagar", "Accounts payable")}</div><div>{accountsPayableOverview?.summary.blockedInvoices ?? 0} {t("bloqueadas y", "blocked and")} {accountsPayableOverview?.summary.overdueInvoices ?? 0} {t("vencidas", "overdue invoices")}</div></div>
                <div className="detailRow"><div className="detailLabel">{t("Ejecución tesorería", "Treasury execution")}</div><div>{treasuryOverview?.summary.blockedRuns ?? 0} {t("corridas bloqueadas y", "blocked runs and")} {treasuryOverview?.unavailableInvoices.length ?? 0} {t("facturas inelegibles", "ineligible invoices")}</div></div>
                <div className="detailRow"><div className="detailLabel">{t("Qué significa", "What this means")}</div><div>{treasuryChainPressure > 0 ? t("Tesorería depende de limpieza fiscal y de CXP antes de liberar con calidad.", "Treasury depends on upstream fiscal and AP cleanup before clean release.") : t("El carril de tesorería está suficientemente limpio para una ejecución predecible.", "Treasury lane is currently clean enough for predictable short-term execution.")}</div></div>
              </div>
              <div className="row gap wrap" style={{ marginTop: 16 }}>
                <Link className="button" href="/supplier-master">{t("Abrir proveedores", "Open supplier master")}</Link>
                <Link className="buttonGhost" href="/accounts-payable">{t("Abrir CXP", "Open accounts payable")}</Link>
                <Link className="buttonGhost" href="/treasury/payment-runs">{t("Abrir tesorería", "Open treasury")}</Link>
                <Link className="buttonGhost" href={buildCashFlowFinanceHref(selectedLine)}>{t("Abrir finanzas", "Open finance")}</Link>
              </div>
            </Card>

              <Card title={t("Bandeja de flujo", "Cash flow queue")} description={t("Prioriza los flujos que necesitan contención o los que ya pueden continuar.", "Prioritize the streams that need containment or can already continue.")}>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    marginBottom: 16
                  }}
                >
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Gap semanal", "Weekly gap")}</span>
                    <strong>{queueSummary.negativeWeeklyNet}</strong>
                    <span>{t("flujos con neto negativo", "streams with negative net")}</span>
                  </div>
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Críticos o vigilancia", "Critical or watch")}</span>
                    <strong>{queueSummary.criticalOrWatch}</strong>
                    <span>{t("requieren decisión operativa", "require operating decision")}</span>
                  </div>
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Pronóstico débil", "Weak forecast")}</span>
                    <strong>{queueSummary.lowConfidence}</strong>
                    <span>{t("todavía no confiables para secuenciar", "not yet safe for sequencing")}</span>
                  </div>
                  <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "12px 14px", background: "rgba(255,255,255,0.88)" }}>
                    <span className="detailLabel">{t("Pendientes abiertos", "Open pressure")}</span>
                    <strong>{queueSummary.openPressure}</strong>
                    <span>{t("elementos empujando liquidez", "items pushing liquidity")}</span>
                  </div>
                </div>
                <FilterBar summary={t(`${filteredLines.length} flujos coinciden con los filtros actuales`, `${filteredLines.length} cash flow streams match the current operating filters`)}>
                  <label className="fieldLabel">
                    {t("Salud", "Health")}
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">{t("Todas", "All")}</option>
                      <option value="critical">{t("Crítica", "Critical")}</option>
                      <option value="watch">{t("Vigilancia", "Watch")}</option>
                      <option value="controlled">{t("Controlada", "Controlled")}</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    {t("Origen", "Source")}
                    <select className="field" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}>
                      <option value="all">{t("Todos", "All")}</option>
                      <option value="cash">{t("Caja", "Cash")}</option>
                      <option value="payables">{t("CXP", "Payables")}</option>
                      <option value="collections">{t("Cobranza", "Collections")}</option>
                      <option value="tax">{t("Fiscal", "Tax")}</option>
                      <option value="close">{t("Cierre", "Close")}</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    {t("Búsqueda", "Search")}
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder={t("Flujo, código, origen o siguiente acción", "Stream, code, source or next action")}
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? t("modo demo", "demo mode") : t("backend vivo", "live backend")}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("flujo listo", "cash flow ready")}</Badge>
                  <Badge tone={filteredSummary.criticalStreams > 0 ? "danger" : filteredSummary.weeklyNet < 0 ? "warning" : "success"}>
                    {filteredSummary.criticalStreams > 0
                      ? t(`${filteredSummary.criticalStreams} críticas`, `${filteredSummary.criticalStreams} critical`)
                      : filteredSummary.weeklyNet < 0
                        ? t("neto negativo", "negative net")
                        : t("subconjunto controlado", "visible subset controlled")}
                  </Badge>
                  <Badge tone="info">{filteredSummary.averageConfidence}% {t("confianza", "confidence")}</Badge>
                </FilterBar>
                {queueInsights.length > 0 ? (
                  <div className="list">
                    {queueInsights.map((item) => (
                      <button
                        key={item.line.id}
                        type="button"
                        className={`listItem ${selectedLine?.id === item.line.id ? "listItemSelected" : ""}`}
                        onClick={() => setSelectedLineId(item.line.id)}
                      >
                        <div className="tableCellStack" style={{ alignItems: "flex-start" }}>
                          <strong>{item.line.streamName}</strong>
                          <p>{item.line.code} · {localizeText(cashFlowSourceLabel(item.line.sourceType))}</p>
                          <span className="tableCellMuted">
                            {`+MXN ${item.line.projectedInflows.toLocaleString()} · -MXN ${item.line.projectedOutflows.toLocaleString()} · MXN ${item.line.weeklyNet.toLocaleString()} ${t("neto", "net")}`}
                          </span>
                          <span className="tableCellMuted">
                            {`${item.line.openPressureItems} ${t("pendientes abiertos", "open pressure items")} · ${item.line.confidencePercent}% ${t("confianza", "confidence")}`}
                          </span>
                        </div>
                        <div className="tableCellStack" style={{ alignItems: "flex-end" }}>
                          <Badge tone={item.lane.tone}>{localizeText(item.lane.label)}</Badge>
                          <Badge tone={healthTone(item.line.health)}>{localizeText(cashFlowHealthLabel(item.line.health))}</Badge>
                          <span className="tableCellMuted">{localizeText(item.lane.helper)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState title={t("Sin flujos para estos filtros", "No streams for these filters")} description={t("Limpia o cambia filtros para recuperar la bandeja activa.", "Clear or change filters to recover the active queue.")} />
                )}
              </Card>

              <Card
                title={t("Flujo seleccionado", "Selected stream")}
                description={t("Liquidez, presión operativa y siguiente decisión de tesorería.", "Liquidity, operating pressure and next treasury action.")}
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.health)}>{localizeText(cashFlowHealthLabel(selectedLine.health))}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">{t("Carril operativo", "Operating lane")}</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={selectedLineInsight?.lane.tone ?? "info"}>
                            {selectedLineInsight ? localizeText(selectedLineInsight.lane.label) : t("Sin flujo", "No stream")}
                          </Badge>
                          <Badge tone={healthTone(selectedLine.health)}>{localizeText(cashFlowHealthLabel(selectedLine.health))}</Badge>
                        </div>
                        <span className="tableCellMuted">{selectedLineInsight ? localizeText(selectedLineInsight.lane.helper) : t("Selecciona un flujo para ver el carril operativo.", "Select a stream to inspect the operating lane.")}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Caja inicial", "Starting cash")}</div>
                      <div>MXN {selectedLine.startingCash.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Pendientes abiertos", "Open pressure items")}</div>
                      <div>{selectedLine.openPressureItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Confianza", "Confidence")}</div>
                      <div>{selectedLine.confidencePercent}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Cobertura de liquidez", "Liquidity coverage")}</div>
                      <div>{selectedLine.liquidityCoverageWeeks.toFixed(1)} {t("semanas", "weeks")}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Por qué ahora", "Why now")}</div>
                      <div>{selectedWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Efecto aguas abajo", "Downstream effect")}</div>
                      <div>{selectedDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Ruta sugerida", "Route summary")}</div>
                      <div>{selectedRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Reporte", "Report back")}</div>
                      <div>{selectedReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                      <div>{selectedHumanStep}</div>
                    </div>

                    <label className="stack" htmlFor="cash-flow-next-action">
                      <span className="detailLabel">{t("Siguiente acción", "Next action")}</span>
                      <textarea
                        id="cash-flow-next-action"
                        className="field"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder={t("Describe la acción de tesorería, cobranza o pago que sigue.", "Describe the treasury, collection or payment action required next")}
                      />
                    </label>
                    <div className="row gap wrap">
                      {selectedOperationalLinks.map((link, index) => (
                        <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                          {localizeText(cashFlowLinkLabel(link.href))}
                        </Link>
                      ))}
                    </div>

                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.health, action.nextAction)}
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                    <div className="row gap wrap">
                      <Link className="button secondary" href={buildCashFlowFinanceHref(selectedLine)}>{t("Abrir finanzas", "Open finance")}</Link>
                      <Link className="buttonGhost" href="/accounts-payable">{t("Abrir CXP", "Open accounts payable")}</Link>
                      <Link className="buttonGhost" href="/treasury/payment-runs">{t("Abrir tesorería", "Open treasury")}</Link>
                      <Link className="buttonGhost" href="/supplier-master">{t("Abrir proveedores", "Open supplier master")}</Link>
                    </div>

                    {actionError ? <EmptyState title={t("Actualización bloqueada", "Update blocked")} description={actionError} /> : null}
                    {actionMessage ? <EmptyState title={t("Flujo actualizado", "Stream updated")} description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState
                    title={t("Selecciona un flujo", "Select a stream")}
                    description={t("Elige un flujo desde la bandeja para revisar liquidez y la siguiente acción.", "Choose a stream from the queue to inspect liquidity posture and next action.")}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title={t("Señal de liquidez", "Liquidity signal")} description={t("Significado inmediato en caja del flujo seleccionado.", "Immediate cash meaning of the selected treasury stream.")}>
                <p className="sectionText">{selectedStory?.liquiditySignal ?? t("Selecciona un flujo para revisar su señal de liquidez.", "Choose a stream to inspect its liquidity signal.")}</p>
              </Card>
              <Card title={t("Confianza del pronóstico", "Forecast confidence")} description={t("Qué tanto puede confiar tesorería en este flujo esta semana.", "How much treasury can trust this stream this week.")}>
                <p className="sectionText">
                  {selectedStory?.confidenceSignal ?? t("Selecciona un flujo para revisar la confianza del pronóstico.", "Choose a stream to inspect forecast confidence.")}
                </p>
              </Card>
              <Card title={t("Carril de decisión", "Decision lane")} description={t("Siguiente lente operativo para el flujo seleccionado.", "Next treasury lens for the selected stream.")}>
                <p className="sectionText">{selectedStory?.decisionLane ?? t("Selecciona un flujo para revisar el carril de decisión.", "Choose a stream to inspect the decision lane.")}</p>
              </Card>
            </section>

            <Card title={t("Riesgos del flujo", "Cash flow risks")} description={t("Riesgos que afectan cobranza, CXP, fiscal y continuidad de cierre.", "Risks affecting collections, payables, fiscal pressure and close continuity.")}>
              {selectedRisks.length > 0 ? (
                <DataTable
                  rows={selectedRisks}
                  columns={[
                    {
                      key: "risk",
                      label: t("Riesgo", "Risk"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.title}</strong>
                          <span className="tableCellMuted">{row.category}</span>
                        </div>
                      )
                    },
                    {
                      key: "severity",
                      label: t("Severidad", "Severity"),
                      render: (row) => (
                        <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>
                          {row.severity}
                        </Badge>
                      )
                    },
                    {
                      key: "owner",
                      label: t("Responsable", "Owner"),
                      render: (row) => row.owner
                    }
                  ]}
                />
              ) : (
                <EmptyState
                  title={t("Sin riesgos mapeados", "No mapped cash-flow risks")}
                  description={t("Selecciona un flujo con presión fiscal o de caja para revisar sus riesgos.", "Select a treasury stream with active fiscal or cash pressure to inspect its risks.")}
                />
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title={error ?? t("Flujo no disponible", "Cash flow unavailable")}
            description={t("No pudimos cargar la proyección de tesorería para esta empresa. En demo debe seguir siendo testeable mediante tesorería, CXP y proveedores.", "We could not load the treasury projection for the selected company. In demo mode this screen should still be testable through treasury, AP and supplier flow.")}
            primaryAction={{ label: t("Abrir tesorería", "Open treasury"), href: "/treasury/payment-runs" }}
            secondaryAction={{ label: t("Abrir finanzas", "Open finance"), href: "/finance" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
