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

function lineActionOptions(line: CashFlowLineContract) {
  switch (line.health) {
    case "critical":
      return [
        {
          label: { es: "Mover a atencion", en: "Move to watch" },
          health: "watch" as const,
          nextAction: "Contain the short-term gap and keep treasury monitoring active while backlog clears"
        }
      ];
    case "watch":
      return [
        {
          label: { es: "Escalar a critica", en: "Escalate critical" },
          health: "critical" as const,
          nextAction: "Escalate the stream because short-term liquidity pressure remains unresolved"
        },
        {
          label: { es: "Marcar controlada", en: "Mark controlled" },
          health: "controlled" as const,
          nextAction: "Collections, payables and evidence now support a stable weekly cash outlook"
        }
      ];
    default:
      return [
        {
          label: { es: "Mover a atencion", en: "Move to watch" },
          health: "watch" as const,
          nextAction: "Monitor this stream before treasury drift impacts the next disbursement cycle"
        }
      ];
  }
}

function cashFlowHealthLabel(status: CashFlowLineContract["health"]) {
  switch (status) {
    case "controlled":
      return { es: "Controlada", en: "Controlled" };
    case "watch":
      return { es: "Atencion", en: "Watch" };
    default:
      return { es: "Critica", en: "Critical" };
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
      return { es: "Impuestos", en: "Tax" };
    default:
      return { es: "Cierre", en: "Close" };
  }
}

function cashFlowStreamLabel(streamName: string) {
  switch (streamName) {
    case "Accounts payable release":
      return { es: "Liberacion de cuentas por pagar", en: "Accounts payable release" };
    case "Operating cash lane":
      return { es: "Carril operativo de caja", en: "Operating cash lane" };
    case "Fiscal commitments":
      return { es: "Compromisos fiscales", en: "Fiscal commitments" };
    default:
      return { es: streamName, en: streamName };
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

function buildCashFlowHumanStepLabel(line: CashFlowLineContract | null) {
  if (!line) {
    return {
      es: "Selecciona una corriente para ver el siguiente movimiento de tesoreria.",
      en: "Choose a stream to see the next treasury move."
    };
  }

  if (line.health === "critical") {
    return {
      es: "Conten ahora la salida o cobranza de mayor presion y asigna un responsable antes de que tesoreria secuencie cualquier otro movimiento alrededor de esta corriente.",
      en: "Contain the highest-pressure disbursement or collection item now and assign an owner before treasury sequences anything else around this stream."
    };
  }

  if (line.weeklyNet < 0) {
    return {
      es: "Re-secuencia la presion inmediata de salidas y confirma si cuentas por pagar o tesoreria pueden diferir, dividir o repriorizar el siguiente evento de caja.",
      en: "Re-sequence the immediate outflow pressure and confirm whether AP or treasury can delay, split or re-prioritize the next cash event."
    };
  }

  if (line.confidencePercent < 75) {
    return {
      es: "Actualiza primero los insumos del pronostico para que tesoreria no opere sobre una corriente que aun cambia demasiado de una semana a otra.",
      en: "Refresh the forecast inputs first so treasury is not acting on a stream that still moves too much week to week."
    };
  }

  if (line.openPressureItems > 0) {
    return {
      es: "Resuelve ahora los puntos de presion nombrados y confirma cual de ellos sigue bloqueando una decision limpia de tesoreria o finanzas.",
      en: "Clear the named pressure items now and confirm which one still blocks a clean treasury or finance decision."
    };
  }

  return {
    es: "Manten la corriente en revision semanal y pasa directo a la ejecucion de tesoreria o finanzas sin reconstruir el contexto de liquidez.",
    en: "Keep the stream under weekly review and move directly into treasury or finance execution without rebuilding the liquidity context."
  };
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
      { label: { es: "Abrir tesoreria", en: "Open treasury" }, href: "/treasury/payment-runs" },
      { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" },
      { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" }
    ];
  }

  if (line.health === "critical") {
    return [
      { label: { es: "Abrir tesoreria", en: "Open treasury" }, href: "/treasury/payment-runs" },
      { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" },
      { label: { es: "Abrir catalogo de proveedores", en: "Open supplier master" }, href: "/supplier-master" }
    ];
  }

  if (line.weeklyNet < 0) {
    return [
      { label: { es: "Abrir tesoreria", en: "Open treasury" }, href: "/treasury/payment-runs" },
      { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" },
      { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" }
    ];
  }

  if (line.confidencePercent < 75) {
    return [
      { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" },
      { label: { es: "Abrir tesoreria", en: "Open treasury" }, href: "/treasury/payment-runs" },
      { label: { es: "Abrir catalogo de proveedores", en: "Open supplier master" }, href: "/supplier-master" }
    ];
  }

  return [
    { label: { es: "Abrir tesoreria", en: "Open treasury" }, href: "/treasury/payment-runs" },
    { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" },
    { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" }
  ];
}

function buildCashFlowSelectedStation(
  line: CashFlowLineContract | null,
  treasuryChainPressure: number
) {
  if (!line) {
    return null;
  }

  const treasuryCta = {
    label: { es: "Ir a tesoreria ahora", en: "Go to treasury now" },
    href: "/treasury/payment-runs"
  };
  const accountsPayableCta = {
    label: { es: "Ir a cuentas por pagar", en: "Go to accounts payable" },
    href: "/accounts-payable"
  };
  const supplierMasterCta = {
    label: { es: "Ir a catalogo de proveedores", en: "Go to supplier master" },
    href: "/supplier-master"
  };
  const financeCta = {
    label: { es: "Ir a finanzas", en: "Go to finance" },
    href: "/finance"
  };

  if (line.health === "critical" || line.weeklyNet < 0 || treasuryChainPressure >= 8) {
    return {
      immediateModule: {
        es: "Tesoreria debe tomar esta corriente de inmediato para contener la salida, ajustar secuencia y proteger la siguiente corrida.",
        en: "Treasury should take this stream immediately to contain the outflow, resequence timing and protect the next run."
      },
      secondHop:
        line.sourceType === "payables"
          ? {
              es: "Segundo salto operativo: cuentas por pagar para re-priorizar o dividir facturas antes de liberar.",
              en: "Second operating hop: accounts payable to reprioritize or split invoices before release."
            }
          : {
              es: "Segundo salto operativo: finanzas para validar el supuesto de caja que respalda la nueva secuencia.",
              en: "Second operating hop: finance to validate the cash assumption backing the new sequence."
            },
      returnConfirmed: {
        es: "Debe regresar confirmado el monto contenido, la fecha re-secuenciada y quien queda responsable hasta el siguiente ciclo de desembolso.",
        en: "It should come back with the contained amount, the resequenced date and the named owner through the next disbursement cycle confirmed."
      },
      primaryCta: treasuryCta,
      ctaReason: {
        es: "CTA principal recomendado: contener liquidez antes de prometer otra salida.",
        en: "Recommended primary CTA: contain liquidity before committing another outflow."
      }
    };
  }

  if (line.sourceType === "payables") {
    return {
      immediateModule: {
        es: "Cuentas por pagar es el responsable inmediato para limpiar bloqueo, prioridad y elegibilidad de factura en esta corriente.",
        en: "Accounts payable is the immediate owner to clear invoice blockage, priority and release readiness for this stream."
      },
      secondHop: {
        es: "Segundo salto operativo: tesoreria para ejecutar la corrida con la nueva prioridad ya depurada.",
        en: "Second operating hop: treasury to run the disbursement with the cleaned priority set."
      },
      returnConfirmed: {
        es: "Debe regresar confirmado que facturas salen, cuales se difieren y que monto queda listo para liberacion real.",
        en: "It should come back confirming which invoices move, which ones are deferred and what amount is actually ready for release."
      },
      primaryCta: accountsPayableCta,
      ctaReason: {
        es: "CTA principal recomendado: resolver el bloqueo operativo donde nace la presion.",
        en: "Recommended primary CTA: clear the operating blocker where the pressure starts."
      }
    };
  }

  if (line.sourceType === "tax") {
    return {
      immediateModule: {
        es: "Finanzas es el responsable inmediato para confirmar calendario fiscal, monto comprometido y margen real de maniobra.",
        en: "Finance is the immediate owner to confirm the tax calendar, committed amount and actual room to maneuver."
      },
      secondHop: {
        es: "Segundo salto operativo: tesoreria para secuenciar el pago fiscal ya confirmado contra el resto de salidas.",
        en: "Second operating hop: treasury to sequence the confirmed tax payment against the rest of the outflows."
      },
      returnConfirmed: {
        es: "Debe regresar confirmado el vencimiento valido, el monto final y si el flujo semanal sigue sosteniendo ese compromiso.",
        en: "It should come back confirming the valid due date, the final amount and whether the weekly flow still supports that commitment."
      },
      primaryCta: financeCta,
      ctaReason: {
        es: "CTA principal recomendado: fijar el compromiso fiscal antes de que tesoreria confie la secuencia.",
        en: "Recommended primary CTA: lock the tax commitment before treasury trusts the sequence."
      }
    };
  }

  if (line.confidencePercent < 75 || line.sourceType === "collections" || line.sourceType === "close") {
    return {
      immediateModule: {
        es: "Finanzas debe tomar esta corriente primero para corregir el supuesto, fecha o evidencia que sigue moviendo el pronostico.",
        en: "Finance should take this stream first to correct the assumption, date or evidence still moving the forecast."
      },
      secondHop: {
        es: "Segundo salto operativo: tesoreria para volver a secuenciar con el pronostico ya estabilizado.",
        en: "Second operating hop: treasury to resequence once the forecast is stabilized."
      },
      returnConfirmed: {
        es: "Debe regresar confirmado el dato corregido, la nueva confianza del pronostico y el impacto neto semanal esperado.",
        en: "It should come back with the corrected input, the refreshed forecast confidence and the expected weekly net impact confirmed."
      },
      primaryCta: financeCta,
      ctaReason: {
        es: "CTA principal recomendado: arreglar el supuesto antes de ejecutar caja con ruido.",
        en: "Recommended primary CTA: fix the assumption before executing cash on noisy inputs."
      }
    };
  }

  if (line.openPressureItems > 0) {
    return {
      immediateModule: {
        es: "Catalogo de proveedores debe tomar el frente inmediato para limpiar expediente o friccion documental que sigue arrastrando la corriente.",
        en: "Supplier master should take the immediate front to clear the supplier packet or document friction still dragging this stream."
      },
      secondHop: {
        es: "Segundo salto operativo: tesoreria para ejecutar una vez que el proveedor deje de bloquear la liberacion.",
        en: "Second operating hop: treasury to execute once the supplier stops blocking release."
      },
      returnConfirmed: {
        es: "Debe regresar confirmado que el expediente quedo completo, que la restriccion desaparecio y que la corriente vuelve a ser ejecutable.",
        en: "It should come back confirming the packet is complete, the restriction is gone and the stream is executable again."
      },
      primaryCta: supplierMasterCta,
      ctaReason: {
        es: "CTA principal recomendado: quitar primero la friccion aguas arriba que sigue frenando liquidez.",
        en: "Recommended primary CTA: remove the upstream friction that is still slowing liquidity."
      }
    };
  }

  return {
    immediateModule: {
      es: "Tesoreria puede continuar como responsable inmediato porque la corriente ya esta suficientemente clara para ejecutar sin reconstruir contexto.",
      en: "Treasury can continue as the immediate owner because the stream is already clear enough to execute without rebuilding context."
    },
    secondHop: {
      es: "Segundo salto operativo: finanzas para cerrar seguimiento y sostener el proximo refresco semanal.",
      en: "Second operating hop: finance to close follow-up and sustain the next weekly refresh."
    },
    returnConfirmed: {
      es: "Debe regresar confirmado que la ejecucion salio como se planeo y que el neto semanal se mantuvo controlado.",
      en: "It should come back confirming execution landed as planned and the weekly net stayed controlled."
    },
    primaryCta: treasuryCta,
    ctaReason: {
      es: "CTA principal recomendado: ejecutar desde tesoreria sin volver a abrir un circuito ya resuelto.",
      en: "Recommended primary CTA: execute from treasury without reopening a lane that is already resolved."
    }
  };
}

export default function CashFlowPage() {
  const { activeCompany, apiBaseUrl, session, source, uiLanguage, localizeText } = useAppState();
  const t = (es: string, en: string) => localizeText({ es, en });
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
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
  const selectedHumanStep = useMemo(() => localizeText(buildCashFlowHumanStepLabel(selectedLine)), [localizeText, selectedLine]);
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
  const selectedStation = useMemo(
    () => buildCashFlowSelectedStation(selectedLine, treasuryChainPressure),
    [selectedLine, treasuryChainPressure]
  );

  const lineActions = useMemo(() => (selectedLine ? lineActionOptions(selectedLine) : []), [selectedLine]);
  const selectedHealthLabel = selectedLine ? localizeText(cashFlowHealthLabel(selectedLine.health)) : null;
  const selectedSourceLabel = selectedLine ? localizeText(cashFlowSourceLabel(selectedLine.sourceType)) : null;
  const selectedStreamLabel = selectedLine ? localizeText(cashFlowStreamLabel(selectedLine.streamName)) : null;

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
      title={{ es: "Flujo de efectivo", en: "Cash flow" }}
      eyebrow={{ es: "Mesa de liquidez", en: "Liquidity workbench" }}
      description={{
        es: "Opera liquidez semanal con senales ligadas de tesoreria, cuentas por pagar, proveedores y finanzas.",
        en: "Operate weekly liquidity with linked treasury, accounts payable, supplier and finance signals."
      }}
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title={t("Flujo de efectivo", "Cash flow")}
      >
        {overview ? (
          <>
            <section className="grid cols2" lang={uiLanguage}>
              <Card
                title={selectedStreamLabel ?? t("Mesa de liquidez", "Liquidity workbench")}
                description={
                  selectedLine
                    ? `${selectedLine.code} · ${selectedSourceLabel}`
                    : t("Selecciona una corriente para abrir su control de liquidez semanal.", "Select a stream to open its weekly liquidity control.")
                }
                aside={
                  selectedLine ? <Badge tone={healthTone(selectedLine.health)}>{selectedHealthLabel}</Badge> : <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? t("modo demo", "demo mode") : t("backend real", "live backend")}</Badge>
                }
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">{t("Caja inicial", "Starting cash")}</div>
                      <div>MXN {selectedLine.startingCash.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Entradas proyectadas", "Projected inflows")}</div>
                      <div>MXN {selectedLine.projectedInflows.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Salidas proyectadas", "Projected outflows")}</div>
                      <div>MXN {selectedLine.projectedOutflows.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Neto semanal", "Weekly net")}</div>
                      <div>MXN {selectedLine.weeklyNet.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Cobertura", "Coverage")}</div>
                      <div>{selectedLine.liquidityCoverageWeeks.toFixed(1)} {t("semanas", "weeks")}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Confianza", "Confidence")}</div>
                      <div>{selectedLine.confidencePercent}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Presion abierta", "Open pressure")}</div>
                      <div>{selectedLine.openPressureItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                      <div>{selectedHumanStep}</div>
                    </div>
                    {selectedStation ? (
                      <>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Modulo responsable inmediato", "Immediate responsible module")}</div>
                          <div>{localizeText(selectedStation.immediateModule)}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Segundo salto operativo", "Second operating hop")}</div>
                          <div>{localizeText(selectedStation.secondHop)}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Debe regresar confirmado", "What must come back confirmed")}</div>
                          <div>{localizeText(selectedStation.returnConfirmed)}</div>
                        </div>
                      </>
                    ) : null}
                    <div className="detailRow">
                      <div className="detailLabel">{t("Senales ligadas", "Linked pressure chain")}</div>
                      <div>{treasuryChainPressure} {t("puntos de presion aguas arriba", "upstream pressure points")}</div>
                    </div>
                    {selectedStation ? (
                      <div className="stack" style={{ gap: 10 }}>
                        <div className="detailRow">
                          <div className="detailLabel">{t("CTA principal recomendado", "Recommended primary CTA")}</div>
                          <div>{localizeText(selectedStation.ctaReason)}</div>
                        </div>
                        <div className="row gap wrap">
                          <Link className="button" href={selectedStation.primaryCta.href}>
                            {localizeText(selectedStation.primaryCta.label)}
                          </Link>
                        </div>
                      </div>
                    ) : null}
                    <label className="stack" htmlFor="cash-flow-next-action">
                      <span className="detailLabel">{t("Siguiente accion", "Next action")}</span>
                      <textarea
                        id="cash-flow-next-action"
                        className="field"
                        rows={4}
                        lang={uiLanguage}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder={t("Describe la accion siguiente de tesoreria, cobranza o pago", "Describe the next treasury, collection or payment action")}
                      />
                    </label>
                    <div className="row gap wrap">
                      {selectedOperationalLinks.map((link, index) => (
                        <Link key={`${link.href}-${link.label.en}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                          {localizeText(link.label)}
                        </Link>
                      ))}
                    </div>
                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.health}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.health, action.nextAction)}
                          disabled={isSaving}
                        >
                          {localizeText(action.label)}
                        </button>
                      ))}
                    </div>
                    {actionError ? <EmptyState title={t("Actualizacion bloqueada", "Update blocked")} description={actionError} /> : null}
                    {actionMessage ? <EmptyState title={t("Corriente actualizada", "Stream updated")} description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState
                    title={t("Selecciona una corriente", "Select a stream")}
                    description={t("Elige una corriente de liquidez para revisar postura, cobertura y accion siguiente.", "Choose a liquidity stream to review posture, coverage and next action.")}
                  />
                )}
              </Card>

              <Card
                title={t("Cola de corrientes", "Stream queue")}
                description={t("Cambia de corriente rapido con los filtros actuales activos.", "Switch streams quickly with the current filters still applied.")}
                aside={<Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("lista para operar", "ready to operate")}</Badge>}
              >
                <FilterBar summary={`${filteredLines.length} ${t("corrientes visibles", "visible streams")}`}>
                  <label className="fieldLabel">
                    {t("Salud", "Health")}
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">{t("Todas", "All")}</option>
                      <option value="critical">{t("Criticas", "Critical")}</option>
                      <option value="watch">{t("Atencion", "Watch")}</option>
                      <option value="controlled">{t("Controladas", "Controlled")}</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    {t("Origen", "Source")}
                    <select className="field" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as typeof sourceFilter)}>
                      <option value="all">{t("Todos", "All")}</option>
                      <option value="cash">{t("Caja", "Cash")}</option>
                      <option value="payables">{t("Cuentas por pagar", "Payables")}</option>
                      <option value="collections">{t("Cobranza", "Collections")}</option>
                      <option value="tax">{t("Impuestos", "Tax")}</option>
                      <option value="close">{t("Cierre", "Close")}</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    {t("Buscar", "Search")}
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder={t("Corriente, codigo, origen o accion", "Stream, code, source or action")}
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? t("modo demo", "demo mode") : t("backend real", "live backend")}</Badge>
                  <Badge tone={filteredSummary.criticalStreams > 0 ? "danger" : filteredSummary.weeklyNet < 0 ? "warning" : "success"}>
                    {filteredSummary.criticalStreams > 0
                      ? `${filteredSummary.criticalStreams} ${t("criticas", "critical")}`
                      : filteredSummary.weeklyNet < 0
                        ? t("neto negativo", "negative net")
                        : t("subconjunto controlado", "visible subset controlled")}
                  </Badge>
                  <Badge tone="info">{filteredSummary.averageConfidence}% {t("confianza", "confidence")}</Badge>
                </FilterBar>

                {filteredLines.length > 0 ? (
                  <div className="list">
                    {filteredLines.map((line) => (
                      <button
                        key={line.id}
                        type="button"
                        className={`listItem ${selectedLine?.id === line.id ? "listItemSelected" : ""}`}
                        onClick={() => setSelectedLineId(line.id)}
                      >
                        <div>
                          <strong>{localizeText(cashFlowStreamLabel(line.streamName))}</strong>
                          <p>{line.code} · {localizeText(cashFlowSourceLabel(line.sourceType))} · MXN {line.weeklyNet.toLocaleString()}</p>
                        </div>
                        <Badge tone={healthTone(line.health)}>{localizeText(cashFlowHealthLabel(line.health))}</Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={t("Sin corrientes para estos filtros", "No streams for these filters")}
                    description={t("Limpia filtros o busca otra corriente para volver a la mesa activa.", "Clear filters or search a different stream to return to the active workbench.")}
                  />
                )}
              </Card>
            </section>

            <details className="captureDetails" lang={uiLanguage}>
              <summary>{t("Detalles operativos", "Operational details")}</summary>
              <div className="stack">
                <section className="grid cols4">
                  <KpiCard
                    label={t("Corrientes visibles", "Tracked streams")}
                    value={String(filteredSummary.trackedStreams)}
                    footnote={t("Corrientes de tesoreria visibles en los filtros actuales.", "Treasury streams visible in the current operating filter.")}
                  />
                  <KpiCard
                    label={t("Entradas proyectadas", "Projected inflows")}
                    value={`MXN ${filteredSummary.projectedInflows.toLocaleString()}`}
                    footnote={t("Entrada esperada de efectivo a corto plazo en el subconjunto visible.", "Expected short-term cash intake from the visible subset.")}
                  />
                  <KpiCard
                    label={t("Salidas proyectadas", "Projected outflows")}
                    value={`MXN ${filteredSummary.projectedOutflows.toLocaleString()}`}
                    footnote={t("Salida esperada de efectivo a corto plazo en el subconjunto visible.", "Expected short-term cash drain from the visible subset.")}
                  />
                  <KpiCard
                    label={t("Neto semanal", "Weekly net")}
                    value={`MXN ${filteredSummary.weeklyNet.toLocaleString()}`}
                    footnote={t("Brecha o superavit semanal de liquidez del subconjunto visible.", "Directional weekly liquidity gap or surplus from visible streams.")}
                  />
                  <KpiCard
                    label={t("Cadena de tesoreria", "Treasury chain")}
                    value={String(treasuryChainPressure)}
                    footnote={t("Presion combinada entre proveedores, cuentas por pagar y liberacion de tesoreria.", "Combined pressure from supplier fiscal posture, AP blockers and treasury release lane.")}
                  />
                </section>

                <section className="grid cols2">
                  <Card
                    title={t("Ruta de liberacion de tesoreria", "Treasury release lane")}
                    description={t("La liquidez consolida postura fiscal de proveedores, bloqueos de CxP y ejecucion de tesoreria.", "Liquidity reads supplier fiscal posture, AP blockers and treasury execution in one lane.")}
                    aside={
                      <Badge tone={treasuryChainPressure > 8 ? "danger" : treasuryChainPressure > 3 ? "warning" : "success"}>
                        {treasuryChainPressure > 8 ? t("alta presion", "high pressure") : treasuryChainPressure > 3 ? t("atencion", "watch") : t("controlada", "controlled")}
                      </Badge>
                    }
                  >
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Bloqueos fiscales de proveedor", "Supplier fiscal blockers")}</div><div>{supplierMasterOverview?.summary.criticalSuppliers ?? 0} {t("criticos", "critical")} {t("y", "and")} {supplierMasterOverview?.summary.incompletePackets ?? 0} {t("expedientes incompletos", "incomplete packets")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Cuentas por pagar", "Accounts payable")}</div><div>{accountsPayableOverview?.summary.blockedInvoices ?? 0} {t("facturas bloqueadas", "blocked invoices")} {t("y", "and")} {accountsPayableOverview?.summary.overdueInvoices ?? 0} {t("vencidas", "overdue")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Ejecucion de tesoreria", "Treasury execution")}</div><div>{treasuryOverview?.summary.blockedRuns ?? 0} {t("corridas bloqueadas", "blocked runs")} {t("y", "and")} {treasuryOverview?.unavailableInvoices.length ?? 0} {t("facturas inelegibles", "ineligible invoices")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Lectura operativa", "What this means")}</div><div>{treasuryChainPressure > 0 ? t("Tesoreria depende de limpieza fiscal y de CxP antes de liberar sin friccion.", "Treasury depends on upstream fiscal and AP cleanup before clean release.") : t("La ruta de tesoreria esta suficientemente limpia para una ejecucion predecible.", "Treasury lane is currently clean enough for predictable short-term execution.")}</div></div>
                    </div>
                    <div className="row gap wrap" style={{ marginTop: 16 }}>
                      <Link className="button" href="/supplier-master">{t("Abrir catalogo de proveedores", "Open supplier master")}</Link>
                      <Link className="buttonGhost" href="/accounts-payable">{t("Abrir cuentas por pagar", "Open accounts payable")}</Link>
                      <Link className="buttonGhost" href="/treasury/payment-runs">{t("Abrir tesoreria", "Open treasury")}</Link>
                      <Link className="buttonGhost" href="/finance">{t("Abrir finanzas", "Open finance")}</Link>
                    </div>
                  </Card>

                  <Card title={t("Tablero completo de corrientes", "Full stream board")} description={t("Vista extendida de entradas, salidas, cobertura y salud.", "Extended view of inflows, outflows, coverage and health.")}>
                    <DataTable
                      rows={filteredLines}
                      columns={[
                        {
                          key: "stream",
                          label: t("Corriente", "Stream"),
                          render: (row) => (
                            <button
                              className="buttonGhost"
                            type="button"
                            onClick={() => setSelectedLineId(row.id)}
                            style={{ justifyContent: "flex-start", paddingInline: 0 }}
                          >
                            <div className="tableCellStack">
                                <strong>{localizeText(cashFlowStreamLabel(row.streamName))}</strong>
                                <span className="tableCellMuted">{row.code} · {localizeText(cashFlowSourceLabel(row.sourceType))}</span>
                              </div>
                            </button>
                          )
                        },
                        {
                          key: "movement",
                          label: t("Entradas vs salidas", "Inflow vs outflow"),
                          render: (row) => (
                            <div className="tableCellStack">
                              <strong>+MXN {row.projectedInflows.toLocaleString()}</strong>
                              <span className="tableCellMuted">-MXN {row.projectedOutflows.toLocaleString()}</span>
                            </div>
                          )
                        },
                        {
                          key: "weekly",
                          label: t("Neto semanal", "Weekly net"),
                          render: (row) => (
                            <div className="tableCellStack">
                              <strong>MXN {row.weeklyNet.toLocaleString()}</strong>
                              <span className="tableCellMuted">{row.liquidityCoverageWeeks.toFixed(1)} {t("semanas de cobertura", "weeks coverage")}</span>
                            </div>
                          )
                        },
                        {
                          key: "health",
                          label: t("Salud", "Health"),
                          render: (row) => <Badge tone={healthTone(row.health)}>{localizeText(cashFlowHealthLabel(row.health))}</Badge>
                        }
                      ]}
                    />
                  </Card>
                </section>

                <section className="grid cols3">
                  <Card title={t("Senal de liquidez", "Liquidity signal")} description={t("Lectura inmediata del impacto de caja.", "Immediate cash meaning of the selected stream.")}>
                    <p className="sectionText">{selectedStory?.liquiditySignal ?? t("Selecciona una corriente para revisar su senal de liquidez.", "Choose a stream to inspect its liquidity signal.")}</p>
                  </Card>
                  <Card title={t("Confianza del pronostico", "Forecast confidence")} description={t("Que tanto puede confiar tesoreria esta semana.", "How much treasury can trust this stream this week.")}>
                    <p className="sectionText">{selectedStory?.confidenceSignal ?? t("Selecciona una corriente para revisar su confianza.", "Choose a stream to inspect forecast confidence.")}</p>
                  </Card>
                  <Card title={t("Carril de decision", "Decision lane")} description={t("Siguiente lente operativo para la corriente activa.", "Next treasury lens for the selected stream.")}>
                    <p className="sectionText">{selectedStory?.decisionLane ?? t("Selecciona una corriente para revisar el carril de decision.", "Choose a stream to inspect the decision lane.")}</p>
                  </Card>
                </section>

                <section className="grid cols2">
                  <Card title={t("Narrativa operativa", "Operational narrative")} description={t("Contexto extendido para seguimiento y reporte.", "Extended context for follow-up and report-back.")}>
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Por que ahora", "Why now")}</div><div>{selectedWhyNow}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Efecto aguas abajo", "Downstream effect")}</div><div>{selectedDownstreamEffect}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Resumen de ruta", "Route summary")}</div><div>{selectedRouteSummary}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Ventana de reporte", "Report back")}</div><div>{selectedReportBack}</div></div>
                    </div>
                  </Card>

                  <Card title={t("Riesgos de flujo de efectivo", "Cash flow risks")} description={t("Riesgos que afectan cobranza, pagos, presion fiscal y continuidad de cierre.", "Risks affecting collections, payables, fiscal pressure and close continuity.")}>
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
                        description={t("Selecciona una corriente con presion fiscal o de caja para inspeccionar riesgos.", "Select a stream with active fiscal or cash pressure to inspect its risks.")}
                      />
                    )}
                  </Card>
                </section>
              </div>
            </details>
          </>
        ) : (
          <EmptyState
            title={error ?? t("Flujo de efectivo no disponible", "Cash flow unavailable")}
            description={t("No pudimos cargar la proyeccion de tesoreria para la empresa seleccionada. En modo demo esta pantalla debe seguir siendo util desde tesoreria, CxP y proveedores.", "We could not load the treasury projection for the selected company. In demo mode this screen should still be testable through the connected treasury, AP and supplier flow.")}
            primaryAction={{ label: t("Abrir tesoreria", "Open treasury"), href: "/treasury/payment-runs" }}
            secondaryAction={{ label: t("Abrir finanzas", "Open finance"), href: "/finance" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
