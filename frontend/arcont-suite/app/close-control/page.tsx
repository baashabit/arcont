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
import type { CloseControlLineContract, CloseControlOverviewContract } from "@/lib/contracts";
import { fetchCloseControlOverview, updateCloseControlLine } from "@/lib/platform-api";

function healthTone(status: CloseControlLineContract["closeHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function closeHealthLabel(status: CloseControlLineContract["closeHealth"]) {
  switch (status) {
    case "controlled":
      return { es: "Controlado", en: "Controlled" };
    case "watch":
      return { es: "En observación", en: "Watch" };
    default:
      return { es: "Crítico", en: "Critical" };
  }
}

function closeStreamLabel(streamType: CloseControlLineContract["streamType"]) {
  switch (streamType) {
    case "finance":
      return { es: "Finanzas", en: "Finance" };
    case "compliance":
      return { es: "Cumplimiento", en: "Compliance" };
    default:
      return { es: "Documentos", en: "Document control" };
  }
}

function closeActionLabel(
  line: CloseControlLineContract,
  nextHealth: CloseControlLineContract["closeHealth"]
) {
  if (line.closeHealth === "critical" && nextHealth === "watch") {
    return { es: "Contener y pasar a observación", en: "Contain and move to watch" };
  }

  switch (nextHealth) {
    case "critical":
      return { es: "Escalar a crítico", en: "Escalate to critical" };
    case "controlled":
      return { es: "Marcar controlado", en: "Mark controlled" };
    default:
      return { es: "Pasar a observación", en: "Move to watch" };
  }
}

function buildCloseContinuitySpanish(line: CloseControlLineContract | null) {
  if (!line) {
    return {
      label: "Selecciona un frente de cierre",
      description: "Elige un frente para priorizar la evidencia, responsable y módulo que debe actuar."
    };
  }

  if (line.closeHealth === "critical" || line.blockingItems > 0 || line.slaHoursRemaining < 0) {
    return {
      label: "Intervención inmediata",
      description: "El cierre no puede tratar este frente como controlado hasta liberar bloqueos, evidencia y responsable."
    };
  }

  if (line.closeReadiness < 92 || line.evidenceCompletion < 90) {
    return {
      label: "Evidencia por completar",
      description: "La operación continúa con control, pero la calidad de evidencia aún impide cerrar con seguridad."
    };
  }

  if (line.slaHoursRemaining <= 12) {
    return {
      label: "Ventana de cierre corta",
      description: "Confirma al responsable y el siguiente entregable antes de que venza la ventana del cierre."
    };
  }

  return {
    label: "Listo para checkpoint",
    description: "El frente tiene postura, evidencia y tiempo suficientes para continuar al módulo responsable."
  };
}

function closeLinkLabel(href: string) {
  switch (href) {
    case "/treasury/payment-runs":
      return { es: "Abrir tesorería", en: "Open treasury" };
    case "/cash-flow":
      return { es: "Abrir flujo de efectivo", en: "Open cash flow" };
    case "/accounts-payable":
      return { es: "Abrir cuentas por pagar", en: "Open accounts payable" };
    case "/compliance":
      return { es: "Abrir cumplimiento", en: "Open compliance" };
    case "/document-control":
      return { es: "Abrir documentos", en: "Open document control" };
    default:
      return { es: "Abrir finanzas", en: "Open finance" };
  }
}

function buildCloseGateChecksSpanish(line: CloseControlLineContract | null) {
  if (!line) {
    return ["Selecciona un frente desde la mesa de cierre."];
  }

  const checks: string[] = [];
  if (line.closeHealth === "critical") checks.push("El frente ya tiene postura crítica.");
  if (line.blockingItems > 0) checks.push(`${line.blockingItems} bloqueo(s) siguen abiertos.`);
  if (line.closeReadiness < 92) checks.push(`La preparación de cierre es de ${line.closeReadiness}%.`);
  if (line.evidenceCompletion < 90) checks.push(`La evidencia completa es de ${line.evidenceCompletion}%.`);
  if (line.slaHoursRemaining < 0) checks.push("La ventana de cierre ya venció.");
  else if (line.slaHoursRemaining <= 12) checks.push(`Quedan solo ${line.slaHoursRemaining} horas de ventana.`);

  return checks;
}

function buildCloseReadoutSpanish(line: CloseControlLineContract | null) {
  if (!line) {
    return {
      whyNow: "Selecciona un frente para entender la prioridad del corte.",
      impact: "Selecciona un frente para revisar el impacto que puede llegar a otros dominios.",
      reportBack: "Define el responsable y la fecha de retorno desde la mesa de cierre."
    };
  }

  const whyNow =
    line.closeHealth === "critical"
      ? `${line.code} ya está crítico; retrasarlo puede comprometer la liberación de cierre.`
      : line.blockingItems > 0
        ? `${line.code} mantiene ${line.blockingItems} bloqueo(s) que deben resolverse antes del checkpoint.`
        : line.slaHoursRemaining <= 12
          ? `${line.code} está cerca de su límite de tiempo y requiere confirmación inmediata.`
          : `${line.code} sigue activo y debe conservar responsable y evidencia hasta el siguiente checkpoint.`;
  const impact =
    line.streamType === "finance"
      ? "Una demora afecta tesorería, cuentas por pagar y la liberación financiera del corte."
      : line.streamType === "compliance"
        ? "Una demora afecta cumplimiento, evidencia documental y la capacidad de liberar el cierre."
        : "Una demora deja incompleta la evidencia que requieren finanzas y cumplimiento para cerrar.";
  const reportBack =
    line.slaHoursRemaining <= 12 || line.closeHealth === "critical"
      ? "Reporta antes del siguiente corte con responsable, bloqueo resuelto y evidencia verificable."
      : "Reporta en el siguiente checkpoint con la evidencia completada y la postura actualizada.";

  return { whyNow, impact, reportBack };
}

function actionOptions(line: CloseControlLineContract) {
  switch (line.closeHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          closeHealth: "watch" as const,
          nextAction: "Contain the blocker and keep the stream under active close supervision"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          closeHealth: "critical" as const,
          nextAction: "Escalate the stream because close evidence or fiscal pressure remains unresolved"
        },
        {
          label: "Mark controlled",
          closeHealth: "controlled" as const,
          nextAction: "Blockers resolved and the stream is ready for a clean close checkpoint"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          closeHealth: "watch" as const,
          nextAction: "Monitor the stream before it turns into a month-end blocker"
        }
      ];
  }
}

function recomputeSummary(lines: CloseControlLineContract[]) {
  return {
    trackedStreams: lines.length,
    averageCloseReadiness:
      lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.closeReadiness, 0) / lines.length).toFixed(1)) : 0,
    criticalStreams: lines.filter((item) => item.closeHealth === "critical").length,
    blockedItems: lines.reduce((sum, item) => sum + item.blockingItems, 0),
    fiscalExposure: lines.reduce((sum, item) => sum + item.fiscalExposure, 0),
    overdueStreams: lines.filter((item) => item.slaHoursRemaining < 0).length
  };
}

function pickFocusLine(lines: CloseControlLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.closeHealth === "critical" && right.closeHealth !== "critical") {
          return -1;
        }
        if (left.closeHealth !== "critical" && right.closeHealth === "critical") {
          return 1;
        }
        return left.slaHoursRemaining - right.slaHoursRemaining;
      })[0] ?? null
  );
}

function buildCloseStory(line: CloseControlLineContract | null, riskCount: number) {
  if (!line) {
    return null;
  }

  return {
    closeExposure:
      line.slaHoursRemaining < 0
        ? `This stream is already overdue by ${Math.abs(line.slaHoursRemaining)} hours and is distorting close discipline.`
        : `This stream still has ${line.slaHoursRemaining} hours before breaching its close window.`,
    unblockLane:
      line.blockingItems > 0
        ? `${line.blockingItems} blockers remain active and must be cleared together with evidence completion.`
        : "The blocker queue is contained; focus should stay on evidence quality and timing.",
    escalationSignal:
      riskCount > 0
        ? `${riskCount} mapped risks remain open and justify active escalation in the close room.`
        : "No mapped escalation remains open; keep the stream under checkpoint monitoring."
  };
}

function buildCloseRouteSummary(line: CloseControlLineContract | null) {
  if (!line) {
    return "Use close control as the command lane for finance, compliance and evidence before month-end release.";
  }

  if (line.streamType === "finance") {
    return "Finance-close issues should route through treasury, payables and final close evidence before leadership treats the month as controlled.";
  }

  if (line.streamType === "compliance") {
    return "Compliance-close issues should route through legal, post-sale and document remediation before they distort the close room.";
  }

  return "Document-control issues should route through supporting evidence and close-control checkpoints before the close lane is treated as clean.";
}

function buildCloseOperationalLinks(line: CloseControlLineContract | null) {
  if (!line) {
    return [
      { label: "Open finance", href: "/finance", tone: "button" as const },
      { label: "Open compliance", href: "/compliance", tone: "buttonGhost" as const },
      { label: "Open document control", href: "/document-control", tone: "buttonGhost" as const }
    ];
  }

  if (line.streamType === "finance") {
    return [
      { label: "Open treasury", href: "/treasury/payment-runs", tone: "button" as const },
      { label: "Open cash flow", href: "/cash-flow", tone: "buttonGhost" as const },
      { label: "Open payables", href: "/accounts-payable", tone: "buttonGhost" as const }
    ];
  }

  if (line.streamType === "compliance") {
    return [
      { label: "Open compliance", href: "/compliance", tone: "button" as const },
      { label: "Open document control", href: "/document-control", tone: "buttonGhost" as const },
      { label: "Open finance", href: "/finance", tone: "buttonGhost" as const }
    ];
  }

  return [
    { label: "Open document control", href: "/document-control", tone: "button" as const },
    { label: "Open compliance", href: "/compliance", tone: "buttonGhost" as const },
    { label: "Open finance", href: "/finance", tone: "buttonGhost" as const }
  ];
}

function buildCloseReleaseGate(line: CloseControlLineContract | null) {
  if (!line) {
    return {
      tone: "info" as const,
      label: "No stream selected",
      summary: "Choose a close stream to verify whether it can really move as controlled or still needs intervention.",
      checks: ["Select a stream from the active close board."]
    };
  }

  const checks: string[] = [];

  if (line.closeHealth === "critical") {
    checks.push("Stream is already in critical close posture.");
  }

  if (line.blockingItems > 0) {
    checks.push(`${line.blockingItems} blocker(s) still remain open.`);
  }

  if (line.closeReadiness < 92) {
    checks.push(`Close readiness is only ${line.closeReadiness}%.`);
  }

  if (line.evidenceCompletion < 90) {
    checks.push(`Evidence completion is only ${line.evidenceCompletion}%.`);
  }

  if (line.slaHoursRemaining < 0) {
    checks.push("Close SLA is already overdue.");
  } else if (line.slaHoursRemaining <= 12) {
    checks.push(`Close SLA has only ${line.slaHoursRemaining} hours remaining.`);
  }

  if (checks.length > 0) {
    const hardBlock = line.closeHealth === "critical" || line.blockingItems > 0 || line.slaHoursRemaining < 0
    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not release yet" : "Operate with control",
      summary: hardBlock
        ? "This stream still carries hard blockers before the close room should treat it as controlled."
        : "The stream can continue, but readiness, evidence or timing still need tighter close control.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for controlled close",
    summary: "Readiness, evidence and timing are aligned for a controlled close checkpoint.",
    checks: [
      "Continue into treasury, compliance or document follow-through without rebuilding the same close context.",
      "Keep the same owner and next action attached until the checkpoint is formally closed."
    ]
  };
}

function buildCloseHumanStep(line: CloseControlLineContract | null) {
  if (!line) {
    return "Select a stream to identify the next human move.";
  }

  if (line.closeHealth === "critical" || line.blockingItems > 0) {
    return "Clear the active blocker first, then return to the close room and verify whether readiness and evidence improved enough to downgrade the stream.";
  }

  if (line.closeReadiness < 92 || line.evidenceCompletion < 90) {
    return "Complete missing evidence, raise readiness and keep the upstream owner in the same close-control loop.";
  }

  if (line.slaHoursRemaining <= 12) {
    return "Escalate the stream owner now and secure the final close checkpoint before the window expires.";
  }

  return "Confirm the controlled checkpoint and keep downstream finance or compliance release aligned while context is still current.";
}

function buildCloseWhyNow(line: CloseControlLineContract | null) {
  if (!line) {
    return "Choose a close stream to understand why the close room should care right now.";
  }

  if (line.closeHealth === "critical") {
    return `${line.code} is already in critical close posture, so delay here can immediately distort the month-end release path.`;
  }

  if (line.blockingItems > 0) {
    return `${line.code} still carries ${line.blockingItems} active blocker(s), so the close room should act now before the chain normalizes unresolved debt.`;
  }

  if (line.slaHoursRemaining <= 12) {
    return `${line.code} is already close to the SLA wall, so waiting here can turn a controlled stream into an avoidable close failure.`;
  }

  return `${line.code} is still an active close lane, so the team should protect continuity now instead of assuming the checkpoint will hold by inertia.`;
}

function buildCloseDownstreamEffect(line: CloseControlLineContract | null) {
  if (!line) {
    return "Select a close stream to inspect what it can block downstream.";
  }

  if (line.closeHealth === "critical" || line.blockingItems > 0) {
    return "The downstream effect is delayed close release, weaker finance confidence and more pressure on treasury, compliance or document evidence lanes.";
  }

  if (line.closeReadiness < 92 || line.evidenceCompletion < 90) {
    return "Weak readiness or evidence here can feed back into finance reporting, compliance release and final project close credibility.";
  }

  return "The downstream effect is mainly controlled continuity: keep finance, compliance and evidence lanes aligned so the close stream stays clean.";
}

function buildCloseReportBack(line: CloseControlLineContract | null) {
  if (!line) {
    return "Choose a close stream to define the next report-back window.";
  }

  if (line.closeHealth === "critical" || line.blockingItems > 0) {
    return "Report back before the next close-room cutoff with blocker containment status and the exact release owner.";
  }

  if (line.closeReadiness < 92 || line.evidenceCompletion < 90) {
    return "Report back in the same operating cycle once readiness and evidence are strong enough for the next controlled checkpoint.";
  }

  return "Report back at the next close-control refresh confirming the stream stayed aligned through finance, compliance and evidence follow-through.";
}

type FinanceCloseControlContext = {
  source: "finance";
  metricName: string;
  satStatus: string;
  closeReadiness: number;
  urgentItems: number;
  cashImpact: number;
  note: string;
};

function buildFinanceCloseControlContext(
  searchParams: ReturnType<typeof useSearchParams>
): FinanceCloseControlContext | null {
  if (searchParams.get("source") !== "finance") {
    return null;
  }

  const closeReadinessValue = Number(searchParams.get("closeReadiness") ?? "0");
  const urgentItemsValue = Number(searchParams.get("urgentItems") ?? "0");
  const cashImpactValue = Number(searchParams.get("cashImpact") ?? "0");

  const context = {
    source: "finance" as const,
    metricName: searchParams.get("metricName")?.trim() ?? "",
    satStatus: searchParams.get("satStatus")?.trim() ?? "",
    closeReadiness: Number.isFinite(closeReadinessValue) ? closeReadinessValue : 0,
    urgentItems: Number.isFinite(urgentItemsValue) ? urgentItemsValue : 0,
    cashImpact: Number.isFinite(cashImpactValue) ? cashImpactValue : 0,
    note: searchParams.get("note")?.trim() ?? ""
  };

  return Object.values(context).some((value) => (typeof value === "string" ? value.length > 0 : value !== 0)) ? context : null;
}

function buildFinanceCloseControlContextKey(context: FinanceCloseControlContext | null) {
  if (!context) {
    return null;
  }

  return [
    context.source,
    context.metricName,
    context.satStatus,
    context.closeReadiness,
    context.urgentItems,
    context.cashImpact,
    context.note
  ].join("|");
}

function inferCloseStreamTypeFromFinance(context: FinanceCloseControlContext): CloseControlLineContract["streamType"] {
  const text = `${context.metricName} ${context.note} ${context.satStatus}`.toLowerCase();

  if (
    context.satStatus === "critical" ||
    text.includes("sat") ||
    text.includes("fiscal") ||
    text.includes("cfdi") ||
    text.includes("tax")
  ) {
    return "compliance";
  }

  if (
    text.includes("document") ||
    text.includes("evidence") ||
    text.includes("support") ||
    text.includes("expediente")
  ) {
    return "document_control";
  }

  return "finance";
}

function findBestMatchingCloseLine(
  lines: CloseControlLineContract[],
  context: FinanceCloseControlContext
) {
  const inferredType = inferCloseStreamTypeFromFinance(context);
  const normalizedMetric = context.metricName.toLowerCase();
  const normalizedNote = context.note.toLowerCase();

  return (
    lines
      .slice()
      .sort((left, right) => {
        const score = (line: CloseControlLineContract) => {
          let total = 0;
          if (line.streamType === inferredType) total += 6;
          if (normalizedMetric.includes("close") && line.streamName.toLowerCase().includes("close")) total += 2;
          if (normalizedMetric.includes("cash") && line.streamType === "finance") total += 2;
          if (normalizedNote.includes("support") && line.streamType === "document_control") total += 2;
          if ((normalizedNote.includes("sat") || normalizedNote.includes("fiscal")) && line.streamType === "compliance") total += 2;
          if (context.closeReadiness < 70 && line.closeHealth === "critical") total += 1;
          if (context.urgentItems > 0 && line.blockingItems > 0) total += 1;
          return total;
        };

        return score(right) - score(left);
      })[0] ?? null
  );
}

function buildCloseRoutingDesk(line: CloseControlLineContract | null) {
  if (!line) {
    return {
      primaryLabel: { es: "Finanzas", en: "Finance" },
      primaryReason: {
        es: "Selecciona un frente para identificar el módulo responsable.",
        en: "Select a stream to identify the responsible module."
      },
      secondaryLabel: { es: "Cumplimiento", en: "Compliance" },
      secondaryReason: {
        es: "Cuando exista un frente, aquí se aclarará el segundo salto operativo.",
        en: "Once a stream is selected, this will clarify the secondary operational jump."
      },
      returnRule: {
        es: "Vuelve a control de cierre con responsable, evidencia y fecha confirmados.",
        en: "Return to close control with owner, evidence and date confirmed."
      }
    };
  }

  if (line.streamType === "finance") {
    return {
      primaryLabel: { es: "Tesorería", en: "Treasury" },
      primaryReason: {
        es: "La presión del cierre ya impacta corrida de pagos, caja y liberación financiera.",
        en: "Close pressure is already affecting payment sequencing, cash and financial release."
      },
      secondaryLabel: { es: "Cuentas por pagar", en: "Accounts payable" },
      secondaryReason: {
        es: "Si el bloqueo sigue en soporte o facturas, destrábalo en CXP antes de tratar el corte como controlado.",
        en: "If the blocker still lives in support or invoices, clear it in payables before treating the cut as controlled."
      },
      returnRule: {
        es: "Regresa cuando la corrida, el soporte y la fecha real de liberación queden explícitos.",
        en: "Come back once the run, support pack and real release date are explicit."
      }
    };
  }

  if (line.streamType === "compliance") {
    return {
      primaryLabel: { es: "Cumplimiento", en: "Compliance" },
      primaryReason: {
        es: "El cuello de botella está en SAT, paquete fiscal o postura legal; ahí debe vivir la contención principal.",
        en: "The bottleneck is in SAT, fiscal packet or legal posture, so primary containment belongs in compliance."
      },
      secondaryLabel: { es: "Control documental", en: "Document control" },
      secondaryReason: {
        es: "Si falta soporte verificable, el segundo salto es documentos para cerrar la evidencia que sostiene el corte.",
        en: "If verifiable support is missing, the secondary jump is document control to close the evidence package that supports the cut."
      },
      returnRule: {
        es: "Vuelve cuando el expediente fiscal tenga dueño, evidencia y ventana de resolución defendible.",
        en: "Return once the fiscal folder has an owner, evidence and a defensible resolution window."
      }
    };
  }

  return {
    primaryLabel: { es: "Control documental", en: "Document control" },
    primaryReason: {
      es: "El cierre depende primero de soporte y trazabilidad documental antes de tratar cualquier liberación como limpia.",
      en: "Close first depends on support and document traceability before any release can be treated as clean."
    },
    secondaryLabel: { es: "Cumplimiento", en: "Compliance" },
    secondaryReason: {
      es: "Si el faltante documental ya toca gobierno, SAT o paquete legal, el segundo salto debe pasar por cumplimiento.",
      en: "If the document gap already affects government, tax or legal packets, the secondary jump should move through compliance."
    },
    returnRule: {
      es: "Vuelve cuando los soportes críticos estén adjuntos y listos para sostener la liberación del corte.",
      en: "Return once the critical supporting files are attached and ready to sustain the close release."
    }
  };
}

export default function CloseControlPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText, uiLanguage } = useAppState();
  const searchParams = useSearchParams();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<CloseControlOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | CloseControlLineContract["closeHealth"]>("all");
  const [streamFilter, setStreamFilter] = useState<"all" | CloseControlLineContract["streamType"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"control" | "queue">("control");
  const [appliedFinanceContextKey, setAppliedFinanceContextKey] = useState<string | null>(null);
  const [financeMatchedLineId, setFinanceMatchedLineId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchCloseControlOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Close control overview is unavailable right now.");
          return;
        }

        setOverview(result);
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
      const matchesHealth = healthFilter === "all" || line.closeHealth === healthFilter;
      const matchesStream = streamFilter === "all" || line.streamType === streamFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        line.streamName.toLowerCase().includes(normalizedSearch) ||
        line.code.toLowerCase().includes(normalizedSearch) ||
        line.streamType.toLowerCase().includes(normalizedSearch) ||
        line.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesStream && matchesSearch;
    });
  }, [healthFilter, overview, searchFilter, streamFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);
  const financePreload = useMemo(() => buildFinanceCloseControlContext(searchParams), [searchParams]);
  const financeContextKey = useMemo(() => buildFinanceCloseControlContextKey(financePreload), [financePreload]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedStory = useMemo(() => buildCloseStory(selectedLine, selectedRisks.length), [selectedLine, selectedRisks.length]);
  const selectedRouteSummary = useMemo(() => buildCloseRouteSummary(selectedLine), [selectedLine]);
  const selectedReleaseGate = useMemo(() => buildCloseReleaseGate(selectedLine), [selectedLine]);
  const selectedHumanStep = useMemo(() => buildCloseHumanStep(selectedLine), [selectedLine]);
  const selectedCloseWhyNow = useMemo(() => buildCloseWhyNow(selectedLine), [selectedLine]);
  const selectedCloseDownstreamEffect = useMemo(() => buildCloseDownstreamEffect(selectedLine), [selectedLine]);
  const selectedCloseReportBack = useMemo(() => buildCloseReportBack(selectedLine), [selectedLine]);
  const selectedOperationalLinks = useMemo(() => buildCloseOperationalLinks(selectedLine), [selectedLine]);
  const selectedCloseContinuity = useMemo(() => buildCloseContinuitySpanish(selectedLine), [selectedLine]);
  const selectedCloseGateChecksSpanish = useMemo(() => buildCloseGateChecksSpanish(selectedLine), [selectedLine]);
  const selectedCloseReadoutSpanish = useMemo(() => buildCloseReadoutSpanish(selectedLine), [selectedLine]);
  const selectedRoutingDesk = useMemo(() => buildCloseRoutingDesk(selectedLine), [selectedLine]);
  const financeMatchedLine = useMemo(
    () => overview?.lines.find((line) => line.id === financeMatchedLineId) ?? null,
    [financeMatchedLineId, overview]
  );
  const activeFinancePreload = useMemo(() => {
    if (!financePreload || !financeContextKey || appliedFinanceContextKey !== financeContextKey) {
      return null;
    }

    return financePreload;
  }, [appliedFinanceContextKey, financeContextKey, financePreload]);
  const t = (es: string, en: string) => localizeText({ es, en });

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    if (!overview || !financePreload || !financeContextKey || appliedFinanceContextKey === financeContextKey) {
      return;
    }

    const inferredType = inferCloseStreamTypeFromFinance(financePreload);
    const matchedLine =
      findBestMatchingCloseLine(overview.lines, financePreload) ??
      overview.lines.find((line) => line.streamType === inferredType) ??
      overview.focusLine ??
      overview.lines[0] ??
      null;

    setWorkspaceView("control");
    setHealthFilter("all");
    setStreamFilter(matchedLine?.streamType ?? inferredType);
    setSearchFilter("");
    setSelectedLineId(matchedLine?.id ?? null);
    setFinanceMatchedLineId(matchedLine?.id ?? null);
    setAppliedFinanceContextKey(financeContextKey);
  }, [appliedFinanceContextKey, financeContextKey, financePreload, overview]);

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

  async function handleAction(closeHealth: CloseControlLineContract["closeHealth"], suggestedNextAction: string) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError(t("La siguiente acción debe ser más específica antes de actualizar el frente de cierre.", "Next action must be more specific before updating the close stream."));
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateCloseControlLine(
      selectedLine.id,
      activeCompany.id,
      {
        closeHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? t("No fue posible actualizar el frente de cierre.", "Close control update failed."));
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
    setActionMessage(t(`El frente cambió a ${localizeText(closeHealthLabel(response.data.closeHealth)).toLowerCase()}.`, `Close stream moved to ${response.data.closeHealth}.`));
    setIsSaving(false);
  }

  return (
    <AppShell
      title={{ es: "Control de cierre", en: "Close control" }}
      eyebrow={{ es: "Cierre financiero", en: "Financial close" }}
      description={{
        es: "Coordina los bloqueos de cierre, evidencia y exposición fiscal como frentes operables.",
        en: "Coordinate close blockers, evidence and fiscal exposure as operable workstreams."
      }}
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title={t("Control de cierre", "Close control")}
      >
        {overview ? (
          <>
            <section className="closeWorkbench">
              <div className="closeWorkbenchLead">
                <span className="eyebrow">
                  {t("Mesa de cierre", "Close room")}
                  <span className="mono">{t("corte operativo", "operating cut")}</span>
                </span>
                <h2>{selectedLine?.streamName ?? t("Selecciona un frente", "Select a workstream")}</h2>
                <p>{t("Concentra los bloqueos que afectan el cierre y envíalos al módulo responsable sin perder evidencia, responsable ni fecha límite.", "Concentrate close blockers and route them to the responsible module without losing evidence, owner or deadline.")}</p>
                {activeFinancePreload ? (
                  <div className="stackSm" style={{ marginTop: 12 }}>
                    <div className="row gap wrap">
                      <Badge tone="info">{t("Precargado desde finanzas", "Preloaded from finance")}</Badge>
                      {financeMatchedLine ? <Badge tone="warning">{financeMatchedLine.code}</Badge> : null}
                    </div>
                    <p className="textMuted">
                      {financeMatchedLine
                        ? t(
                            `Finanzas abrió ${financeMatchedLine.streamName} por ${activeFinancePreload.metricName || "la señal seleccionada"} con ${activeFinancePreload.closeReadiness}% de preparación y ${activeFinancePreload.urgentItems} urgencia(s).`,
                            `Finance opened ${financeMatchedLine.streamName} from ${activeFinancePreload.metricName || "the selected signal"} with ${activeFinancePreload.closeReadiness}% readiness and ${activeFinancePreload.urgentItems} urgent item(s).`
                          )
                        : t(
                            `Finanzas llegó con la señal ${activeFinancePreload.metricName || "seleccionada"}; elige el frente correcto y conserva el contexto del corte.`,
                            `Finance arrived with ${activeFinancePreload.metricName || "the selected"} signal; choose the right stream and keep the close context intact.`
                          )}
                    </p>
                  </div>
                ) : null}
                <label className="closeContextControl">
                  <span>{t("Frente de cierre activo", "Active close workstream")}</span>
                  <select className="selectField" value={selectedLine?.id ?? ""} onChange={(event) => setSelectedLineId(event.target.value || null)}>
                    {overview.lines.map((line) => <option key={line.id} value={line.id}>{line.code} · {line.streamName}</option>)}
                  </select>
                </label>
              </div>

              <div className="closeWorkbenchSnapshot">
                <div className="row gap wrap">
                  {selectedLine ? <Badge tone={healthTone(selectedLine.closeHealth)}>{localizeText(closeHealthLabel(selectedLine.closeHealth))}</Badge> : null}
                  {selectedLine ? <Badge tone={selectedLine.slaHoursRemaining < 0 ? "danger" : selectedLine.slaHoursRemaining <= 12 ? "warning" : "info"}>{selectedLine.slaHoursRemaining < 0 ? t(`${Math.abs(selectedLine.slaHoursRemaining)}h vencido`, `${Math.abs(selectedLine.slaHoursRemaining)}h overdue`) : t(`${selectedLine.slaHoursRemaining}h disponibles`, `${selectedLine.slaHoursRemaining}h remaining`)}</Badge> : null}
                </div>
                <strong>{selectedLine?.nextAction ?? t("Sin siguiente acción", "No next action")}</strong>
                <p>{selectedLine ? `${localizeText(closeStreamLabel(selectedLine.streamType))} · ${t("responsable de cierre", "close owner")}` : t("Selecciona un frente para intervenir", "Select a workstream to intervene")}</p>
                <div className="closeWorkbenchMetrics">
                  <div><strong>{selectedLine?.closeReadiness ?? 0}%</strong><span>{t("preparación", "readiness")}</span></div>
                  <div><strong>{selectedLine?.evidenceCompletion ?? 0}%</strong><span>{t("evidencia", "evidence")}</span></div>
                  <div><strong>{selectedLine?.blockingItems ?? 0}</strong><span>{t("bloqueos", "blockers")}</span></div>
                </div>
              </div>
            </section>

            <div className="closeWorkspaceTabs" role="tablist" aria-label={t("Vistas de control de cierre", "Close control views")}>
              {([ ["control", t("Control", "Control")], ["queue", t("Bandeja", "Queue")] ] as const).map(([view, label]) => (
                <button key={view} type="button" role="tab" aria-selected={workspaceView === view} className={`closeWorkspaceTab ${workspaceView === view ? "closeWorkspaceTabActive" : ""}`} onClick={() => setWorkspaceView(view)}>{label}</button>
              ))}
            </div>

            {workspaceView === "control" ? (
              <>
                <section className="grid cols3">
                  <KpiCard label={t("Exposición fiscal", "Fiscal exposure")} value={selectedLine ? `MXN ${selectedLine.fiscalExposure.toLocaleString()}` : "MXN 0"} footnote={t("Importe que aún depende de resolver este frente.", "Amount still dependent on resolving this workstream.")} />
                  <KpiCard label={t("Evidencia completa", "Evidence complete")} value={`${selectedLine?.evidenceCompletion ?? 0}%`} footnote={t("No controles el cierre sin soporte verificable.", "Do not control close without verifiable support.")} />
                  <KpiCard label={t("Bloqueos activos", "Active blockers")} value={String(selectedLine?.blockingItems ?? 0)} footnote={t("Resuelve primero lo que impide liberar el checkpoint.", "Resolve what prevents release of the checkpoint first.")} />
                </section>

                <section className="grid cols2">
                  <Card title={t("Siguiente acción", "Next action")} description={t("Registra el compromiso puntual que debe ejecutar el dueño del frente antes del corte.", "Record the specific commitment the workstream owner must execute before the cut.")}>
                    {selectedLine ? <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Tipo de frente", "Workstream type")}</div><div>{localizeText(closeStreamLabel(selectedLine.streamType))}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Ventana", "Window")}</div><div>{selectedLine.slaHoursRemaining < 0 ? t(`${Math.abs(selectedLine.slaHoursRemaining)} horas vencido`, `${Math.abs(selectedLine.slaHoursRemaining)} hours overdue`) : t(`${selectedLine.slaHoursRemaining} horas disponibles`, `${selectedLine.slaHoursRemaining} hours remaining`)}</div></div>
                      <label className="detailRow"><div className="detailLabel">{t("Acción comprometida", "Committed action")}</div><textarea id="close-control-next-action" className="textarea" value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} placeholder={t("Ej. Validar CFDI, evidencia y autorización antes de las 17:00", "E.g. Validate invoice, evidence and approval before 17:00")} /></label>
                    </div> : <EmptyState title={t("Sin frente seleccionado", "No workstream selected")} description={t("Elige un frente desde la bandeja para actualizarlo.", "Select a workstream from the queue to update it.")} />}
                    {selectedLine ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" disabled={isSaving || nextActionDraft.trim().length < 8} onClick={() => void handleAction(selectedLine.closeHealth, selectedLine.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : t("Guardar acción", "Save action")}</button><Link className="buttonGhost" href={selectedOperationalLinks[0]?.href ?? "/finance"}>{localizeText(closeLinkLabel(selectedOperationalLinks[0]?.href ?? "/finance"))}</Link></div> : null}
                  </Card>

                  <Card title={t("Decisión de cierre", "Close decision")} description={t(selectedCloseContinuity.description, selectedReleaseGate.summary)} aside={<Badge tone={selectedReleaseGate.tone}>{t(selectedCloseContinuity.label, selectedReleaseGate.label)}</Badge>}>
                    <p className="sectionText">{t("El estado solo cambia cuando bloqueos, evidencia, preparación y tiempo permiten sostener la decisión en auditoría.", "Status changes only when blockers, evidence, readiness and time support the decision under audit.")}</p>
                    <div className="row gap wrap" style={{ marginTop: 18 }}>
                      {selectedLine ? lineActions.map((action) => <button key={action.label} type="button" className={action.closeHealth === "critical" ? "buttonGhost" : "button"} disabled={isSaving || (action.closeHealth === "controlled" && (selectedLine.blockingItems > 0 || selectedLine.closeReadiness < 92 || selectedLine.evidenceCompletion < 90)) || (action.closeHealth === "watch" && selectedLine.slaHoursRemaining < -8)} onClick={() => void handleAction(action.closeHealth, action.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : localizeText(closeActionLabel(selectedLine, action.closeHealth))}</button>) : null}
                    </div>
                    {selectedReleaseGate.checks.length > 0 ? <div className="stackSm" style={{ marginTop: 16 }}>{(uiLanguage === "es" ? selectedCloseGateChecksSpanish : selectedReleaseGate.checks).map((check) => <div key={check} className="tableCellMuted">{check}</div>)}</div> : null}
                    {actionError ? <p className="formError">{actionError}</p> : null}
                    {actionMessage ? <p className="formSuccess">{actionMessage}</p> : null}
                  </Card>
                </section>

                <section className="grid cols2">
                  <Card title={t("Resolver en el módulo correcto", "Resolve in the right module")} description={t("El frente conserva contexto al abrir la fuente que tiene el siguiente movimiento real.", "The workstream keeps context when opening the source with the real next move.")}>
                    <div className="row gap wrap">{selectedOperationalLinks.map((link, index) => <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button" : "buttonGhost"} href={link.href}>{localizeText(closeLinkLabel(link.href))}</Link>)}</div>
                    <div className="detailGrid" style={{ marginTop: 18 }}>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Módulo responsable", "Responsible module")}</div>
                        <div className="tableCellStack">
                          <strong>{localizeText(selectedRoutingDesk.primaryLabel)}</strong>
                          <span className="tableCellMuted">{t(selectedRoutingDesk.primaryReason.es, selectedRoutingDesk.primaryReason.en)}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Segundo salto", "Secondary jump")}</div>
                        <div className="tableCellStack">
                          <strong>{localizeText(selectedRoutingDesk.secondaryLabel)}</strong>
                          <span className="tableCellMuted">{t(selectedRoutingDesk.secondaryReason.es, selectedRoutingDesk.secondaryReason.en)}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Condición de retorno", "Return condition")}</div>
                        <div>{t(selectedRoutingDesk.returnRule.es, selectedRoutingDesk.returnRule.en)}</div>
                      </div>
                    </div>
                  </Card>
                  <Card title={t("Lectura para el corte", "Cut readout")} description={t("Señales que debe conocer quien coordina el cierre antes de liberar el frente.", "Signals the close coordinator must know before releasing the workstream.")}>
                    <div className="detailGrid"><div className="detailRow"><div className="detailLabel">{t("Por qué ahora", "Why now")}</div><div>{t(selectedCloseReadoutSpanish.whyNow, selectedCloseWhyNow)}</div></div><div className="detailRow"><div className="detailLabel">{t("Impacto", "Impact")}</div><div>{t(selectedCloseReadoutSpanish.impact, selectedCloseDownstreamEffect)}</div></div><div className="detailRow"><div className="detailLabel">{t("Reportar", "Report back")}</div><div>{t(selectedCloseReadoutSpanish.reportBack, selectedCloseReportBack)}</div></div></div>
                  </Card>
                </section>
              </>
            ) : null}

            {workspaceView === "queue" ? (
              <section className="grid cols2">
                <Card title={t("Bandeja de cierre", "Close queue")} description={t("Filtra los frentes, selecciona uno y vuelve a Control para intervenir.", "Filter workstreams, select one and return to Control to intervene.")} aside={<Badge tone={filteredSummary.criticalStreams > 0 ? "danger" : "success"}>{filteredSummary.criticalStreams} {t("críticos", "critical")}</Badge>}>
                  <FilterBar summary={`${filteredLines.length} ${t("frentes visibles", "visible workstreams")}`}>
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}><option value="all">{t("Toda salud", "All health")}</option><option value="critical">{t("Crítico", "Critical")}</option><option value="watch">{t("Observación", "Watch")}</option><option value="controlled">{t("Controlado", "Controlled")}</option></select>
                    <select className="field" value={streamFilter} onChange={(event) => setStreamFilter(event.target.value as typeof streamFilter)}><option value="all">{t("Todos los frentes", "All workstreams")}</option>{(["finance", "compliance", "document_control"] as CloseControlLineContract["streamType"][]).map((stream) => <option key={stream} value={stream}>{localizeText(closeStreamLabel(stream))}</option>)}</select>
                    <input className="field" type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Buscar frente, código o acción", "Search workstream, code or action")} />
                  </FilterBar>
                  {filteredLines.length > 0 ? <div className="list">{filteredLines.map((line) => <button key={line.id} type="button" className={`listItem ${selectedLine?.id === line.id ? "listItemSelected" : ""}`} onClick={() => { setSelectedLineId(line.id); setWorkspaceView("control"); }}><div><strong>{line.code} · {line.streamName}</strong><p>{localizeText(closeStreamLabel(line.streamType))} · {line.blockingItems} {t("bloqueos", "blockers")} · {line.evidenceCompletion}% {t("evidencia", "evidence")}</p></div><Badge tone={healthTone(line.closeHealth)}>{localizeText(closeHealthLabel(line.closeHealth))}</Badge></button>)}</div> : <EmptyState title={t("Sin frentes para estos filtros", "No workstreams for these filters")} description={t("Limpia los filtros para recuperar la mesa de cierre.", "Clear filters to recover the close room.")} />}
                </Card>
                <Card title={selectedLine?.streamName ?? t("Selecciona un frente", "Select a workstream")} description={selectedLine ? `${selectedLine.code} · ${localizeText(closeStreamLabel(selectedLine.streamType))}` : t("Elige un frente desde la bandeja.", "Choose a workstream from the queue.")}>
                  {selectedLine ? <div className="detailGrid"><div className="detailRow"><div className="detailLabel">{t("Salud", "Health")}</div><div><Badge tone={healthTone(selectedLine.closeHealth)}>{localizeText(closeHealthLabel(selectedLine.closeHealth))}</Badge></div></div><div className="detailRow"><div className="detailLabel">{t("Preparación", "Readiness")}</div><div>{selectedLine.closeReadiness}%</div></div><div className="detailRow"><div className="detailLabel">{t("Evidencia", "Evidence")}</div><div>{selectedLine.evidenceCompletion}%</div></div><div className="detailRow"><div className="detailLabel">{t("Siguiente acción", "Next action")}</div><div>{selectedLine.nextAction}</div></div></div> : null}
                  {selectedLine ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" onClick={() => setWorkspaceView("control")}>{t("Abrir control", "Open control")}</button></div> : null}
                </Card>
              </section>
            ) : null}

            <details className="closeAdvanced">
              <summary>{t("Abrir tablero detallado y controles avanzados", "Open detailed board and advanced controls")}</summary>
              <div className="closeAdvancedContent">
            <section className="grid cols4">
              <KpiCard
                label="Tracked streams"
                value={String(filteredSummary.trackedStreams)}
                footnote="Finance, compliance and document streams visible in the current filter."
              />
              <KpiCard
                label="Readiness"
                value={`${filteredSummary.averageCloseReadiness}%`}
                footnote="Average close readiness across the visible close subset."
              />
              <KpiCard
                label="Blocked items"
                value={String(filteredSummary.blockedItems)}
                footnote="Open blockers still preventing a clean visible close checkpoint."
              />
              <KpiCard
                label="Fiscal exposure"
                value={`MXN ${filteredSummary.fiscalExposure.toLocaleString()}`}
                footnote="Directional exposure still linked to the visible close subset."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Close checkpoint walkthrough"
                description="Turn close into an operable workflow: monitor blockers, evidence and fiscal exposure instead of a static checklist."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    This page is now usable for tests without backend auth: operators can review streams, change posture and pressure-test the month-end lane.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">close readiness</Badge>
                    <Badge tone="info">compliance</Badge>
                    <Badge tone="info">document support</Badge>
                  </div>
                </div>
              </Card>

              <Card
                title="Close continuity workflow"
                description="Close control is the operating bridge between finance signals, legal-compliance posture and document evidence."
                aside={<Badge tone={filteredSummary.criticalStreams > 0 ? "danger" : filteredSummary.overdueStreams > 0 ? "warning" : "success"}>{filteredSummary.criticalStreams > 0 ? "critical lane" : filteredSummary.overdueStreams > 0 ? "overdue lane" : "stable lane"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Route summary</div><div>{selectedRouteSummary}</div></div>
                  <div className="detailRow"><div className="detailLabel">Checkpoint rule</div><div>No stream should be marked controlled while blockers, low evidence quality or weak readiness remain open.</div></div>
                  <div className="detailRow"><div className="detailLabel">Operator next step</div><div>Move from close board into the exact upstream module causing the month-end friction, then come back and re-check posture.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  {selectedOperationalLinks.map((link) => (
                    <Link key={`${link.href}-${link.label}`} className={link.tone} href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </Card>

              <Card title="Close board" description="Live close control across finance, compliance and document evidence.">
                <FilterBar summary={`${filteredLines.length} close streams match the current operating filters`}>
                  <label className="fieldLabel">
                    Health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="watch">Watch</option>
                      <option value="controlled">Controlled</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Stream
                    <select className="field" value={streamFilter} onChange={(event) => setStreamFilter(event.target.value as typeof streamFilter)}>
                      <option value="all">All</option>
                      <option value="finance">Finance</option>
                      <option value="compliance">Compliance</option>
                      <option value="document_control">Document control</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Stream, code, type or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "close control ready"}</Badge>
                  <Badge tone={filteredSummary.criticalStreams > 0 ? "danger" : filteredSummary.overdueStreams > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalStreams > 0
                      ? `${filteredSummary.criticalStreams} critical`
                      : filteredSummary.overdueStreams > 0
                        ? `${filteredSummary.overdueStreams} overdue`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "stream",
                      label: "Stream",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.streamName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.streamType}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "readiness",
                      label: "Readiness",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.closeReadiness}%</strong>
                          <span className="tableCellMuted">{row.evidenceCompletion}% evidence</span>
                        </div>
                      )
                    },
                    {
                      key: "sla",
                      label: "SLA / blockers",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.slaHoursRemaining} h</strong>
                          <span className="tableCellMuted">{row.blockingItems} blockers</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.closeHealth)}>{row.closeHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected stream"
                description="Focused close action, blockers and fiscal posture for the selected stream."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.closeHealth)}>{localizeText(closeHealthLabel(selectedLine.closeHealth))}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Type</div>
                      <div>{localizeText(closeStreamLabel(selectedLine.streamType))}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Overdue window</div>
                      <div>
                        {selectedLine.slaHoursRemaining < 0
                          ? t(`${Math.abs(selectedLine.slaHoursRemaining)} horas vencido`, `${Math.abs(selectedLine.slaHoursRemaining)} h overdue`)
                          : t(`${selectedLine.slaHoursRemaining} horas disponibles`, `${selectedLine.slaHoursRemaining} h remaining`)}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Blockers</div>
                      <div>{selectedLine.blockingItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Fiscal exposure</div>
                      <div>MXN {selectedLine.fiscalExposure.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Release gate</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={selectedReleaseGate.tone}>{selectedReleaseGate.label}</Badge>
                          <span>{selectedReleaseGate.summary}</span>
                        </div>
                        {selectedReleaseGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">
                            {check}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{selectedHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Owning module</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(selectedRoutingDesk.primaryLabel)}</strong>
                        <span className="tableCellMuted">{t(selectedRoutingDesk.primaryReason.es, selectedRoutingDesk.primaryReason.en)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Secondary jump</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(selectedRoutingDesk.secondaryLabel)}</strong>
                        <span className="tableCellMuted">{t(selectedRoutingDesk.secondaryReason.es, selectedRoutingDesk.secondaryReason.en)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{selectedCloseWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{selectedCloseDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Route summary</div>
                      <div>{selectedRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report back</div>
                      <div>{selectedCloseReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Return condition</div>
                      <div>{t(selectedRoutingDesk.returnRule.es, selectedRoutingDesk.returnRule.en)}</div>
                    </div>

                    <label className="stack" htmlFor="close-control-next-action">
                      <span className="detailLabel">Next action</span>
                      <textarea
                        id="close-control-next-action"
                        className="field"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder="Describe the action required to unblock this close stream"
                      />
                    </label>

                    <div className="row gap wrap">
                      {selectedOperationalLinks.map((link, index) => (
                        <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                          {localizeText(closeLinkLabel(link.href))}
                        </Link>
                      ))}
                      <Link className="buttonGhost" href="/platform/settings">
                        {t("Abrir configuración", "Open settings")}
                      </Link>
                    </div>

                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.closeHealth, action.nextAction)}
                          disabled={
                            isSaving ||
                            (action.closeHealth === "controlled" &&
                              (selectedLine.blockingItems > 0 ||
                                selectedLine.closeReadiness < 92 ||
                                selectedLine.evidenceCompletion < 90)) ||
                            (action.closeHealth === "watch" && selectedLine.slaHoursRemaining < -8)
                          }
                        >
                          {isSaving ? t("Guardando...", "Saving...") : localizeText(closeActionLabel(selectedLine, action.closeHealth))}
                        </button>
                      ))}
                    </div>

                    {actionError ? <EmptyState title="Update blocked" description={actionError} /> : null}
                    {actionMessage ? <EmptyState title="Close stream updated" description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState
                    title="Select a stream"
                    description="Choose a close stream to inspect readiness, blockers and the next close action."
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Close exposure" description="Immediate close implication of the selected stream.">
                <p className="sectionText">{selectedStory?.closeExposure ?? "Choose a stream to inspect close exposure."}</p>
              </Card>
              <Card title="Unblock lane" description="What the close room should attack next.">
                <p className="sectionText">{selectedStory?.unblockLane ?? "Choose a stream to inspect the unblock lane."}</p>
              </Card>
              <Card title="Escalation signal" description="When the selected stream deserves higher attention.">
                <p className="sectionText">
                  {selectedStory?.escalationSignal ?? "Choose a stream to inspect the escalation signal."}
                </p>
              </Card>
            </section>

            <Card title="Close risks" description="Fiscal, evidence and legal blockers still affecting the current close.">
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
                  title="No mapped close risks"
                  description="Select a close stream with active blockers to inspect its current risk stack."
                />
              )}
            </Card>
              </div>
            </details>
          </>
        ) : (
          <EmptyState
            title={error ?? "Close control unavailable"}
            description="We could not load the active close room for the selected company."
            primaryAction={{ label: "Open finance", href: "/finance" }}
            secondaryAction={{ label: "Open compliance", href: "/compliance" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
