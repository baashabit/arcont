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
import type {
  EstimationCollectionLineContract,
  EstimationCollectionOverviewContract
} from "@/lib/contracts";
import {
  fetchAccountsPayableOverview,
  fetchCashFlowOverview,
  fetchCrmOverview,
  fetchEstimationCollectionOverview,
  fetchTreasuryPaymentRunsOverview,
  updateEstimationCollectionLine
} from "@/lib/platform-api";

function healthTone(status: EstimationCollectionLineContract["collectionHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function projectStatusTone(status: EstimationCollectionLineContract["projectStatus"]) {
  switch (status) {
    case "active":
      return "success";
    case "at_risk":
      return "warning";
    case "blocked":
      return "danger";
    case "closed":
      return "info";
    default:
      return "gold";
  }
}

function collectionHealthLabel(status: EstimationCollectionLineContract["collectionHealth"]) {
  switch (status) {
    case "controlled":
      return { es: "Controlada", en: "Controlled" };
    case "watch":
      return { es: "En vigilancia", en: "Watch" };
    default:
      return { es: "Crítica", en: "Critical" };
  }
}

function estimationProjectStatusLabel(status: EstimationCollectionLineContract["projectStatus"]) {
  switch (status) {
    case "active":
      return { es: "Activo", en: "Active" };
    case "at_risk":
      return { es: "En riesgo", en: "At risk" };
    case "blocked":
      return { es: "Bloqueado", en: "Blocked" };
    case "closed":
      return { es: "Cerrado", en: "Closed" };
    default:
      return { es: "Planeación", en: "Planning" };
  }
}

function collectionActionLabel(label: string) {
  const labels: Record<string, { es: string; en: string }> = {
    "Move to watch": { es: "Mover a vigilancia", en: "Move to watch" },
    "Escalate critical": { es: "Escalar a crítica", en: "Escalate critical" },
    "Mark controlled": { es: "Marcar controlada", en: "Mark controlled" }
  };

  return labels[label] ?? { es: label, en: label };
}

function estimationRouteLabel(href: string) {
  switch (href) {
    case "/cash-flow":
      return { es: "Abrir flujo de efectivo", en: "Open cash flow" };
    case "/accounts-payable":
      return { es: "Abrir cuentas por pagar", en: "Open accounts payable" };
    case "/document-control":
      return { es: "Abrir control documental", en: "Open document control" };
    case "/close-control":
      return { es: "Abrir control de cierre", en: "Open close control" };
    default:
      return { es: "Abrir finanzas", en: "Open finance" };
  }
}

function buildEstimationHumanStepSpanish(line: EstimationCollectionLineContract | null) {
  if (!line) {
    return "Selecciona una estimación para definir el siguiente movimiento de cobro.";
  }

  if (line.collectionHealth === "critical") {
    return "Contén el tramo vencido más antiguo, confirma evidencia con el revisor del cliente y actualiza el responsable de cobro.";
  }

  if (line.progressGap > 0) {
    return "Cierra primero la brecha entre avance de obra y evidencia antes de tratar la estimación como cobrable.";
  }

  if (line.pendingToBill > 0) {
    return "Completa el paquete de facturación y define la fecha de presentación antes de pasar la presión a tesorería.";
  }

  return "Mantén el seguimiento de cobro y confirma la conversión a efectivo en el siguiente ciclo financiero.";
}

function lineActionOptions(line: EstimationCollectionLineContract) {
  switch (line.collectionHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          collectionHealth: "watch" as const,
          nextAction: "Contain the oldest pending collection items and refresh evidence with the client reviewer"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          collectionHealth: "critical" as const,
          nextAction: "Escalate collection slippage and unresolved evidence gaps to director review"
        },
        {
          label: "Mark controlled",
          collectionHealth: "controlled" as const,
          nextAction: "Pending collection is within tolerance and evidence trail is fully aligned"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          collectionHealth: "watch" as const,
          nextAction: "Start monitoring collection drift before it impacts cash flow"
        }
      ];
  }
}

function recomputeSummary(lines: EstimationCollectionLineContract[]) {
  return {
    trackedProjects: lines.length,
    estimatedPortfolio: lines.reduce((sum, item) => sum + item.estimatedAmount, 0),
    submittedPortfolio: lines.reduce((sum, item) => sum + item.submittedAmount, 0),
    collectedPortfolio: lines.reduce((sum, item) => sum + item.collectedAmount, 0),
    pendingCollection: lines.reduce((sum, item) => sum + item.pendingCollection, 0),
    criticalCollections: lines.filter((item) => item.collectionHealth === "critical").length,
    overdueCollections: lines.filter((item) => item.oldestPendingDays > item.collectionWindowDays).length
  };
}

function pickFocusLine(lines: EstimationCollectionLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.collectionHealth === "critical" && right.collectionHealth !== "critical") {
          return -1;
        }

        if (left.collectionHealth !== "critical" && right.collectionHealth === "critical") {
          return 1;
        }

        if (right.oldestPendingDays !== left.oldestPendingDays) {
          return right.oldestPendingDays - left.oldestPendingDays;
        }

        return right.pendingCollection - left.pendingCollection;
      })[0] ?? null
  );
}

type EstimationBridgeContext = {
  crm: NonNullable<Awaited<ReturnType<typeof fetchCrmOverview>>>;
  cashFlow: NonNullable<Awaited<ReturnType<typeof fetchCashFlowOverview>>>;
  accountsPayable: NonNullable<Awaited<ReturnType<typeof fetchAccountsPayableOverview>>>;
  treasury: NonNullable<Awaited<ReturnType<typeof fetchTreasuryPaymentRunsOverview>>>;
} | null;

function buildEstimationBridge(line: EstimationCollectionLineContract | null, bridge: EstimationBridgeContext) {
  if (!line) {
    return null;
  }

  const linkedBucket = bridge?.crm.leadBuckets.find((bucket) => bucket.projectName === line.projectName) ?? null;
  const linkedCashLine =
    bridge?.cashFlow.lines.find((item) => item.sourceType === "collections") ??
    bridge?.cashFlow.focusLine ??
    null;

  return {
    commercialCoverage: linkedBucket
      ? `${linkedBucket.openOpportunities} open opportunities and ${linkedBucket.reservations} reservations are feeding this collection lane.`
      : "Commercial origin is not yet mapped for this estimation line.",
    billingPressure:
      line.pendingCollection > 0
        ? `MXN ${line.pendingCollection.toLocaleString()} remains uncollected and MXN ${line.pendingToBill.toLocaleString()} is still waiting to be billed.`
        : "No meaningful billing or collection backlog remains on this line.",
    treasuryEffect: linkedCashLine
      ? linkedCashLine.weeklyNet < 0
        ? `Collections are feeding a treasury stream currently running at a weekly gap of MXN ${Math.abs(linkedCashLine.weeklyNet).toLocaleString()}.`
        : `Collections are feeding a treasury stream currently showing a weekly surplus of MXN ${linkedCashLine.weeklyNet.toLocaleString()}.`
      : "Treasury effect is not yet mapped for this estimation line."
  };
}

function buildCollectionWorkflow(line: EstimationCollectionLineContract | null) {
  if (!line) {
    return null;
  }

  return {
    executionRead:
      line.progressGap > 0
        ? `${line.projectName} still has a ${line.progressGap}% gap between field progress and billing evidence, so collection cannot be treated as clean yet.`
        : `${line.projectName} has aligned field evidence and can focus on billing and collection conversion.`,
    collectionRead:
      line.pendingCollection > 0
        ? `MXN ${line.pendingCollection.toLocaleString()} remains exposed in collection and the oldest tranche is already ${line.oldestPendingDays} days old.`
        : `${line.projectName} currently shows no significant collection exposure.`,
    closeoutRead:
      line.closeReadiness < 80
        ? `Closeout readiness is only ${line.closeReadiness}%, so this line still depends on document and compliance discipline.`
      : `Closeout readiness is ${line.closeReadiness}% and the line is structurally closer to controlled cash conversion.`
  };
}

function buildEstimationRoutingDesk(line: EstimationCollectionLineContract | null) {
  if (!line) {
    return {
      primaryHref: "/finance",
      primaryReason: {
        es: "Selecciona una estimación para definir qué dominio toma el siguiente turno.",
        en: "Select an estimation to define which domain should take the next turn."
      },
      secondaryHref: "/cash-flow",
      secondaryReason: {
        es: "Aquí aparecerá el segundo salto operativo cuando exista una línea activa.",
        en: "The secondary operational jump will appear here once a line is active."
      },
      returnRule: {
        es: "Vuelve con responsable, fecha y soporte listos para sostener el cobro.",
        en: "Return with owner, date and support ready to sustain collection."
      }
    };
  }

  if (line.progressGap > 0 || line.evidenceProgress < line.projectProgress) {
    return {
      primaryHref: "/document-control",
      primaryReason: {
        es: "La brecha real está en soporte y evidencia; sin eso la estimación no debe empujarse como cobrable.",
        en: "The real gap is in support and evidence; without it the estimation should not be pushed as collectible."
      },
      secondaryHref: "/close-control",
      secondaryReason: {
        es: "Si la evidencia débil ya compromete el corte, el segundo salto debe ir a cierre para contener el riesgo.",
        en: "If weak evidence is already compromising closeout, the secondary jump should move to close control to contain the risk."
      },
      returnRule: {
        es: "Vuelve cuando el paquete de evidencia ya respalde el avance ejecutado y la fecha de presentación.",
        en: "Return once the evidence pack fully supports executed progress and the submission date."
      }
    };
  }

  if (line.closeReadiness < 80) {
    return {
      primaryHref: "/close-control",
      primaryReason: {
        es: "La preparación de cierre sigue baja y puede convertir una buena estimación en ruido de corte.",
        en: "Close readiness is still weak and can turn a good estimation into close noise."
      },
      secondaryHref: "/document-control",
      secondaryReason: {
        es: "El segundo salto es documentos para cerrar soportes que hoy todavía le pegan al corte.",
        en: "The secondary jump is document control to close support gaps that are still hitting closeout."
      },
      returnRule: {
        es: "Vuelve cuando el corte acepte la línea sin observaciones ocultas de soporte.",
        en: "Return once closeout accepts the line without hidden support observations."
      }
    };
  }

  if (line.pendingToBill > 0 || line.pendingApprovalAmount > 0) {
    return {
      primaryHref: "/finance",
      primaryReason: {
        es: "La fricción principal está en facturación o aprobación, no todavía en caja.",
        en: "The main friction is in billing or approval, not yet in cash conversion."
      },
      secondaryHref: "/document-control",
      secondaryReason: {
        es: "Si finanzas detecta huecos, el segundo salto debe cerrar anexos, estimación y soporte documental.",
        en: "If finance finds gaps, the secondary jump should close annexes, estimation backup and document support."
      },
      returnRule: {
        es: "Vuelve con fecha real de presentación, monto liberado y aprobador confirmado.",
        en: "Return with the real submission date, released amount and approver confirmed."
      }
    };
  }

  if (line.pendingCollection > 0) {
    return {
      primaryHref: "/cash-flow",
      primaryReason: {
        es: "La línea ya vive en conversión a efectivo y la presión principal está en caja y cobranza.",
        en: "This line already lives in cash conversion and the main pressure is now in cash and collection."
      },
      secondaryHref: "/finance",
      secondaryReason: {
        es: "Si tesorería rebota la presión, el segundo salto debe confirmar postura contable y seguimiento financiero.",
        en: "If treasury bounces the pressure back, the secondary jump should confirm accounting posture and finance follow-through."
      },
      returnRule: {
        es: "Vuelve con fecha compromiso de cobro, tramo vencido contenido y efecto esperado en caja.",
        en: "Return with the collection commitment date, contained overdue tranche and expected cash effect."
      }
    };
  }

  return {
    primaryHref: "/finance",
    primaryReason: {
      es: "La línea ya está bastante limpia y finanzas debe confirmar que puede sostenerse como cobro controlado.",
      en: "The line is already fairly clean, and finance should confirm it can be sustained as a controlled collection."
    },
    secondaryHref: "/cash-flow",
    secondaryReason: {
      es: "Después de finanzas, caja debe confirmar que la conversión ya es real y no solo prometida.",
      en: "After finance, cash flow should confirm the conversion is real rather than merely promised."
    },
    returnRule: {
      es: "Vuelve con confirmación de cobro o con la nueva fecha defendible de entrada a caja.",
      en: "Return with collection confirmation or the next defensible date for cash entry."
    }
  };
}

function buildEstimationOperationalRoutes(line: EstimationCollectionLineContract | null) {
  const desk = buildEstimationRoutingDesk(line);
  return [
    desk.primaryHref,
    desk.secondaryHref,
    "/cash-flow",
    "/finance",
    "/accounts-payable",
    "/document-control",
    "/close-control"
  ].filter((href, index, array) => array.indexOf(href) === index);
}

export default function EstimationsPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText, uiLanguage } = useAppState();
  const t = (es: string, en: string) => localizeText({ es, en });
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<EstimationCollectionOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<EstimationBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | EstimationCollectionLineContract["collectionHealth"]>("all");
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | EstimationCollectionLineContract["projectStatus"]>("all");
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
      fetchEstimationCollectionOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchCrmOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchCashFlowOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchAccountsPayableOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchTreasuryPaymentRunsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, crm, cashFlow, accountsPayable, treasury]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Estimations and collections overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
        setBridgeContext(crm && cashFlow && accountsPayable && treasury ? { crm, cashFlow, accountsPayable, treasury } : null);
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
      const matchesHealth = healthFilter === "all" || line.collectionHealth === healthFilter;
      const matchesProjectStatus = projectStatusFilter === "all" || line.projectStatus === projectStatusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        line.projectName.toLowerCase().includes(normalizedSearch) ||
        line.collectionOwner.toLowerCase().includes(normalizedSearch) ||
        line.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesProjectStatus && matchesSearch;
    });
  }, [healthFilter, overview, projectStatusFilter, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedExceptions = useMemo(
    () => overview?.exceptions.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedStory = useMemo(() => buildEstimationBridge(selectedLine, bridgeContext), [bridgeContext, selectedLine]);
  const collectionWorkflow = useMemo(() => buildCollectionWorkflow(selectedLine), [selectedLine]);
  const collectionsChainPressure = useMemo(
    () =>
      (overview?.summary.overdueCollections ?? 0) +
      (overview?.summary.criticalCollections ?? 0) +
      (bridgeContext?.accountsPayable.summary.overdueInvoices ?? 0) +
      (bridgeContext?.treasury.summary.blockedRuns ?? 0) +
      (bridgeContext?.treasury.unavailableInvoices.length ?? 0),
    [bridgeContext, overview]
  );

  const actionOptions = useMemo(() => (selectedLine ? lineActionOptions(selectedLine) : []), [selectedLine]);
  const selectedEstimationHumanStep = uiLanguage === "es" ? buildEstimationHumanStepSpanish(selectedLine) : selectedLine?.nextAction ?? "Choose an estimation to define the next collection move.";
  const selectedRoutingDesk = useMemo(() => buildEstimationRoutingDesk(selectedLine), [selectedLine]);
  const selectedOperationalRoutes = useMemo(() => buildEstimationOperationalRoutes(selectedLine), [selectedLine]);
  const selectedEstimationDecision = !selectedLine
    ? t("Selecciona una estimación para revisar su cobro.", "Select an estimation to review collection.")
    : selectedLine.collectionHealth === "critical"
      ? t("No cierres la cobranza: el tramo vencido o la evidencia siguen en riesgo.", "Do not close collection: the overdue tranche or evidence remains at risk.")
      : selectedLine.progressGap > 0
        ? t("La estimación requiere alinear avance y evidencia antes de convertirse en efectivo.", "The estimation needs field progress and evidence aligned before cash conversion.")
        : t("La estimación puede continuar, pero conserva facturación y cobranza bajo seguimiento.", "The estimation can continue, but keep billing and collection under follow-through.");

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

  async function handleLineAction(
    collectionHealth: EstimationCollectionLineContract["collectionHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the estimation line.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateEstimationCollectionLine(
      selectedLine.id,
      activeCompany.id,
      {
        collectionHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Estimation update failed.");
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
    setActionMessage(`Collection line moved to ${response.data.collectionHealth}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title={t("Estimaciones y cobranza", "Estimations and collections")}
      eyebrow={t("Finanzas de ejecución", "Execution finance")}
      description={t("Trabajo ejecutado, estimaciones presentadas y cobranza pendiente vinculados al avance real de proyecto.", "Executed work, submitted estimations and pending collection tied to real project progress.")}
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title={t("Estimaciones", "Estimations")}
      >
        {overview ? (
          <>
            <section className="grid cols2">
              <Card
                title={t("Control de estimación", "Estimation control")}
                description={t("Decide si el avance ya puede presentarse o cobrarse sin trasladar presión a tesorería.", "Decide whether progress can be billed or collected without shifting pressure to treasury.")}
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.collectionHealth)}>{localizeText(collectionHealthLabel(selectedLine.collectionHealth))}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">{t("Proyecto", "Project")}</div><div><strong>{selectedLine.projectName}</strong><div className="tableCellMuted">{selectedLine.code} · {selectedLine.client}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Decisión", "Decision")}</div><div className="tableCellStack"><Badge tone={healthTone(selectedLine.collectionHealth)}>{localizeText(collectionHealthLabel(selectedLine.collectionHealth))}</Badge><span className="tableCellMuted">{selectedEstimationDecision}</span></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Avance / evidencia", "Progress / evidence")}</div><div><strong>{selectedLine.projectProgress}% / {selectedLine.evidenceProgress}%</strong><div className="tableCellMuted">{t("Brecha de evidencia", "Evidence gap")}: {selectedLine.progressGap}%</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Por facturar", "Pending to bill")}</div><div><strong>MXN {selectedLine.pendingToBill.toLocaleString()}</strong><div className="tableCellMuted">{t("En aprobación", "Approval hold")}: MXN {selectedLine.pendingApprovalAmount.toLocaleString()}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Por cobrar", "Pending collection")}</div><div><strong>MXN {selectedLine.pendingCollection.toLocaleString()}</strong><div className="tableCellMuted">{selectedLine.oldestPendingDays} {t("días del tramo más antiguo", "days on the oldest tranche")} · {selectedLine.billingCycleLabel}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Cierre y responsable", "Closeout and owner")}</div><div><Badge tone={projectStatusTone(selectedLine.projectStatus)}>{localizeText(estimationProjectStatusLabel(selectedLine.projectStatus))}</Badge><div className="tableCellMuted">{selectedLine.closeReadiness}% {t("preparación de cierre", "close readiness")} · {selectedLine.collectionOwner}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div><div>{selectedEstimationHumanStep}</div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Módulo responsable", "Responsible module")}</div><div className="tableCellStack"><strong>{localizeText(estimationRouteLabel(selectedRoutingDesk.primaryHref))}</strong><span className="tableCellMuted">{t(selectedRoutingDesk.primaryReason.es, selectedRoutingDesk.primaryReason.en)}</span></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Segundo salto", "Secondary jump")}</div><div className="tableCellStack"><strong>{localizeText(estimationRouteLabel(selectedRoutingDesk.secondaryHref))}</strong><span className="tableCellMuted">{t(selectedRoutingDesk.secondaryReason.es, selectedRoutingDesk.secondaryReason.en)}</span></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Compromiso al volver", "Return commitment")}</div><div>{t(selectedRoutingDesk.returnRule.es, selectedRoutingDesk.returnRule.en)}</div></div>
                    <label className="stack"><span className="detailLabel">{t("Próxima acción", "Next action")}</span><input className="field" value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} placeholder={t("Describe la acción de cobranza o evidencia", "Describe the collection or evidence action")} /></label>
                    <div className="cluster"><button className="button" type="button" disabled={isSaving} onClick={() => void handleLineAction(selectedLine.collectionHealth, selectedLine.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : t("Guardar acción", "Save action")}</button>{actionOptions.map((option) => <button key={option.label} className={option.collectionHealth === "critical" ? "buttonGhost" : "button"} type="button" disabled={isSaving} onClick={() => void handleLineAction(option.collectionHealth, option.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : localizeText(collectionActionLabel(option.label))}</button>)}</div>
                    <div className="row gap wrap">{selectedOperationalRoutes.map((href, index) => <Link key={href} className={index === 0 ? "buttonSecondary" : "buttonGhost"} href={href}>{index === 0 ? t(`Ir primero a ${localizeText(estimationRouteLabel(href))}`, `Go first to ${localizeText(estimationRouteLabel(href))}`) : localizeText(estimationRouteLabel(href))}</Link>)}</div>
                    {actionMessage ? <Badge tone="success">{actionMessage}</Badge> : null}
                    {actionError ? <Badge tone="danger">{actionError}</Badge> : null}
                  </div>
                ) : <EmptyState title={t("Selecciona una estimación", "Select an estimation")} description={t("Elige un proyecto desde la bandeja para revisar avance, evidencia y cobranza.", "Choose a project from the queue to review progress, evidence and collection.")} />}
              </Card>

              <Card title={t("Bandeja de estimaciones", "Estimation queue")} description={t("Filtra y cambia de proyecto sin perder la decisión de cobro principal.", "Filter and switch projects without losing the primary collection decision.")}>
                <FilterBar summary={t(`${filteredLines.length} estimaciones coinciden con los filtros actuales`, `${filteredLines.length} estimations match the current filters`)}>
                  <label className="fieldLabel">{t("Cobranza", "Collection")}<select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}><option value="all">{t("Todas", "All")}</option><option value="critical">{t("Crítica", "Critical")}</option><option value="watch">{t("Vigilancia", "Watch")}</option><option value="controlled">{t("Controlada", "Controlled")}</option></select></label>
                  <label className="fieldLabel">{t("Proyecto", "Project")}<select className="field" value={projectStatusFilter} onChange={(event) => setProjectStatusFilter(event.target.value as typeof projectStatusFilter)}><option value="all">{t("Todos", "All")}</option><option value="active">{t("Activo", "Active")}</option><option value="at_risk">{t("En riesgo", "At risk")}</option><option value="blocked">{t("Bloqueado", "Blocked")}</option><option value="closed">{t("Cerrado", "Closed")}</option></select></label>
                  <label className="fieldLabel">{t("Búsqueda", "Search")}<input className="field" type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Proyecto, responsable o acción", "Project, owner or action")} /></label>
                </FilterBar>
                {filteredLines.length > 0 ? <div className="list">{filteredLines.map((line) => <button key={line.id} type="button" className={`listItem ${selectedLine?.id === line.id ? "listItemSelected" : ""}`} style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => setSelectedLineId(line.id)}><div><strong>{line.projectName} · MXN {line.pendingCollection.toLocaleString()}</strong><p>{line.client} · {line.evidenceProgress}% {t("evidencia", "evidence")}</p></div><div className="tableCellStack"><Badge tone={healthTone(line.collectionHealth)}>{localizeText(collectionHealthLabel(line.collectionHealth))}</Badge><span className="tableCellMuted">{line.oldestPendingDays} {t("días", "days")}</span></div></button>)}</div> : <EmptyState title={t("Sin estimaciones para estos filtros", "No estimations for these filters")} description={t("Limpia o cambia los filtros para recuperar la bandeja activa.", "Clear or change filters to recover the active queue.")} />}
              </Card>
            </section>

            <details className="fieldAdvanced">
              <summary>{t("Abrir indicadores, continuidad financiera, excepciones y bloqueos", "Open metrics, financial continuity, exceptions and blockers")}</summary>
              <div className="fieldAdvancedContent">
            <section className="grid cols4">
              <KpiCard
                label="Tracked projects"
                value={String(filteredSummary.trackedProjects)}
                footnote="Visible projects with active executed-work and collection posture."
              />
              <KpiCard
                label="Estimated portfolio"
                value={`MXN ${filteredSummary.estimatedPortfolio.toLocaleString()}`}
                footnote="Visible executed-work portfolio at the current baseline."
              />
              <KpiCard
                label="Submitted estimations"
                value={`MXN ${filteredSummary.submittedPortfolio.toLocaleString()}`}
                footnote="Visible work already packaged into billable or collectible estimations."
              />
              <KpiCard
                label="Pending collection"
                value={`MXN ${filteredSummary.pendingCollection.toLocaleString()}`}
                footnote="Visible value still exposed between submitted work and effective collection."
              />
              <KpiCard
                label="Overdue tranches"
                value={String(filteredSummary.overdueCollections)}
                footnote="Visible projects where the oldest pending collection exceeded its expected window."
              />
              <KpiCard
                label="Collections chain"
                value={String(collectionsChainPressure)}
                footnote="Pressure propagated from overdue collections into AP and treasury release."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Collections walkthrough"
                description="Operate the executed-work to cash-conversion lane directly from estimations, even in demo mode."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    The line is now testable by humans: review billing lag, update collection posture and watch how it propagates into AP and treasury pressure.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">estimations</Badge>
                    <Badge tone="info">collections</Badge>
                    <Badge tone="info">treasury impact</Badge>
                  </div>
                </div>
              </Card>

              <Card
                title="Collections to treasury lane"
                description="Estimations now read downstream cash execution, AP aging and treasury blockage as one practical lane."
                aside={
                  <Badge tone={collectionsChainPressure > 8 ? "danger" : collectionsChainPressure > 3 ? "warning" : "success"}>
                    {collectionsChainPressure > 8 ? "high pressure" : collectionsChainPressure > 3 ? "watch" : "controlled"}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Collections</div><div>{overview.summary.overdueCollections} overdue tranches and {overview.summary.criticalCollections} critical collection lines</div></div>
                  <div className="detailRow"><div className="detailLabel">Accounts payable aging</div><div>{bridgeContext?.accountsPayable.summary.overdueInvoices ?? 0} overdue invoices still tightening cash conversion</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury release</div><div>{bridgeContext?.treasury.summary.blockedRuns ?? 0} blocked runs and {bridgeContext?.treasury.unavailableInvoices.length ?? 0} ineligible invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">Executive read</div><div>{collectionsChainPressure > 0 ? "Collection lag is already translating into short-term treasury pressure." : "Collection and treasury lane are currently aligned enough for cleaner cash conversion."}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/accounts-payable">Open accounts payable</Link>
                  <Link className="buttonGhost" href="/treasury/payment-runs">Open treasury</Link>
                  <Link className="buttonGhost" href="/cash-flow">Open cash flow</Link>
                  <Link className="buttonGhost" href="/crm">Open CRM</Link>
                </div>
              </Card>

              <Card title="Estimation board" description="Project progress, evidence gap and collection exposure in one live board.">
                <FilterBar summary={`${filteredLines.length} estimation lines match the current operating filters`}>
                  <label className="fieldLabel">
                    Collection health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="watch">Watch</option>
                      <option value="controlled">Controlled</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Project status
                    <select
                      className="field"
                      value={projectStatusFilter}
                      onChange={(event) => setProjectStatusFilter(event.target.value as typeof projectStatusFilter)}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="at_risk">At risk</option>
                      <option value="blocked">Blocked</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Project, owner or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "estimations ready"}</Badge>
                  <Badge tone={filteredSummary.criticalCollections > 0 ? "danger" : filteredSummary.overdueCollections > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalCollections > 0
                      ? `${filteredSummary.criticalCollections} critical`
                      : filteredSummary.overdueCollections > 0
                        ? `${filteredSummary.overdueCollections} overdue`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "project",
                      label: "Project",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.projectName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.client}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "progress",
                      label: "Execution",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.evidenceProgress}% evidence</strong>
                          <span className="tableCellMuted">{row.projectProgress}% field progress</span>
                        </div>
                      )
                    },
                    {
                      key: "submitted",
                      label: "Submitted vs collected",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.submittedAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">
                            collected MXN {row.collectedAmount.toLocaleString()}
                          </span>
                        </div>
                      )
                    },
                    {
                      key: "aging",
                      label: "Aging",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.oldestPendingDays}d oldest</strong>
                          <span className="tableCellMuted">{row.billingCycleLabel}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Collection",
                      render: (row) => <Badge tone={healthTone(row.collectionHealth)}>{row.collectionHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected line"
                description="Billing readiness, collection pressure and next collection action."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.collectionHealth)}>{selectedLine.collectionHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project status</div>
                      <div className="tagRow">
                        <Badge tone={projectStatusTone(selectedLine.projectStatus)}>{selectedLine.projectStatus}</Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Collection owner</div>
                      <div>{selectedLine.collectionOwner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Billing cycle</div>
                      <div>{selectedLine.billingCycleLabel}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Pending to bill</div>
                      <div>
                        MXN {selectedLine.pendingToBill.toLocaleString()}
                        <div className="tableCellMuted">
                          approval hold MXN {selectedLine.pendingApprovalAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Pending collection</div>
                      <div>
                        MXN {selectedLine.pendingCollection.toLocaleString()}
                        <div className="tableCellMuted">
                          oldest tranche {selectedLine.oldestPendingDays}d of {selectedLine.collectionWindowDays}d expected window
                        </div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Evidence gap</div>
                      <div>{selectedLine.progressGap}% between field and support evidence</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Schedule variance</div>
                      <div>{selectedLine.scheduleVarianceDays.toFixed(1)} days</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Close readiness</div>
                      <div>{selectedLine.closeReadiness}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Responsible module</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(estimationRouteLabel(selectedRoutingDesk.primaryHref))}</strong>
                        <span className="tableCellMuted">{localizeText(selectedRoutingDesk.primaryReason)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Return commitment</div>
                      <div>{localizeText(selectedRoutingDesk.returnRule)}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the collection or evidence action to unblock cash"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Controlled is blocked while pending collection stays too high.</span>
                        <span className="tableCellMuted">Controlled is blocked while evidence still lags field progress.</span>
                        <span className="tableCellMuted">Controlled is blocked while the oldest pending collection already exceeded its window.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          <button
                            className="button"
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleLineAction(selectedLine.collectionHealth, selectedLine.nextAction)}
                          >
                            {isSaving ? "Saving..." : "Save next action"}
                          </button>
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.collectionHealth === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleLineAction(option.collectionHealth, option.nextAction)}
                            >
                              {isSaving ? "Saving..." : option.label}
                            </button>
                          ))}
                        </div>
                        <div className="row gap wrap">
                          {selectedOperationalRoutes.map((href, index) => (
                            <Link key={href} className={index === 0 ? "button secondary" : "buttonGhost"} href={href}>
                              {index === 0 ? `Go first to ${localizeText(estimationRouteLabel(href))}` : localizeText(estimationRouteLabel(href))}
                            </Link>
                          ))}
                        </div>
                        {actionMessage ? <span className="tableCellMuted">{actionMessage}</span> : null}
                        {actionError ? <span style={{ color: "var(--danger-700)" }}>{actionError}</span> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No estimation line selected"
                    description="Choose a project estimation line to inspect billing and collection pressure."
                    primaryAction={{ label: "Stay on estimations", href: "/estimations" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Execution to billing" description="Whether field execution is really ready to become collectible cash.">
                <p className="sectionText">
                  {collectionWorkflow?.executionRead ?? "Choose an estimation line to inspect execution-to-billing continuity."}
                </p>
              </Card>
              <Card title="Collection posture" description="Immediate read of collection exposure on the selected line.">
                <p className="sectionText">
                  {collectionWorkflow?.collectionRead ?? "Choose an estimation line to inspect collection posture."}
                </p>
              </Card>
              <Card title="Closeout dependency" description="Why collections should still stay connected to closeout and compliance.">
                <p className="sectionText">
                  {collectionWorkflow?.closeoutRead ?? "Choose an estimation line to inspect closeout dependency."}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Commercial coverage" description="How much real demand is already sitting behind the selected estimation line.">
                <p className="sectionText">
                  {selectedStory?.commercialCoverage ?? "Choose an estimation line to inspect its commercial coverage."}
                </p>
              </Card>
              <Card title="Billing pressure" description="What remains trapped between field execution and actual collection.">
                <p className="sectionText">
                  {selectedStory?.billingPressure ?? "Choose an estimation line to inspect billing pressure."}
                </p>
              </Card>
              <Card title="Treasury effect" description="Why this line already matters for short-term cash discipline.">
                <p className="sectionText">
                  {selectedStory?.treasuryEffect ?? "Choose an estimation line to inspect treasury effect."}
                </p>
              </Card>
            </section>

            <Card title="Exceptions and blockers" description="Project or financial signals delaying submitted work or effective collection.">
              <DataTable
                rows={selectedExceptions.length > 0 ? selectedExceptions : overview.exceptions}
                columns={[
                  {
                    key: "exception",
                    label: "Exception",
                    render: (item) => (
                      <div className="tableCellStack">
                        <strong>{item.title}</strong>
                        <span className="tableCellMuted">{item.category}</span>
                      </div>
                    )
                  },
                  {
                    key: "severity",
                    label: "Severity",
                    render: (item) => (
                      <Badge tone={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "info"}>
                        {item.severity}
                      </Badge>
                    )
                  },
                  {
                    key: "owner",
                    label: "Owner",
                    render: (item) => item.owner
                  },
                  {
                    key: "status",
                    label: "Current action",
                    render: (item) => item.status
                  }
                ]}
              />
            </Card>
              </div>
            </details>
          </>
        ) : error ? (
          <EmptyState
            title="Estimations overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open cash flow", href: "/cash-flow" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading estimations overview" : "Estimations overview not loaded yet"}
            description="Open an estimation line to test the executed-work and collection lane in demo mode or with the live tenant backend."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
