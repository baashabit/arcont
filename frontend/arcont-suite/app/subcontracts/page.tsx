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
import type { SubcontractLineContract, SubcontractOverviewContract } from "@/lib/contracts";
import { fetchSubcontractOverview, updateSubcontractLine } from "@/lib/platform-api";

function healthTone(status: SubcontractLineContract["subcontractHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function projectTone(status: SubcontractLineContract["projectStatus"]) {
  switch (status) {
    case "active":
      return "success";
    case "at_risk":
      return "warning";
    case "blocked":
      return "danger";
    case "closed":
      return "info";
    case "planning":
      return "gold";
    default:
      return "neutral";
  }
}

function subcontractHealthLabel(status: SubcontractLineContract["subcontractHealth"]) {
  switch (status) {
    case "controlled":
      return { es: "Controlado", en: "Controlled" };
    case "watch":
      return { es: "En vigilancia", en: "Watch" };
    default:
      return { es: "Crítico", en: "Critical" };
  }
}

function projectStatusLabel(status: SubcontractLineContract["projectStatus"] | null | undefined) {
  switch (status) {
    case "active":
      return { es: "Activa", en: "Active" };
    case "at_risk":
      return { es: "En riesgo", en: "At risk" };
    case "blocked":
      return { es: "Bloqueada", en: "Blocked" };
    case "closed":
      return { es: "Cerrada", en: "Closed" };
    case "planning":
      return { es: "Planeación", en: "Planning" };
    default:
      return { es: "Sin asignar", en: "Unassigned" };
  }
}

function subcontractActionLabel(label: string) {
  switch (label) {
    case "Move to watch":
      return { es: "Mover a vigilancia", en: "Move to watch" };
    case "Escalate critical":
      return { es: "Escalar a crítico", en: "Escalate critical" };
    case "Mark controlled":
      return { es: "Marcar controlado", en: "Mark controlled" };
    default:
      return { es: label, en: label };
  }
}

function dailyLogStatusLabel(status: SubcontractLineContract["latestDailyLogStatus"]) {
  switch (status) {
    case "draft":
      return { es: "Borrador", en: "Draft" };
    case "submitted":
      return { es: "Enviada", en: "Submitted" };
    case "approved":
      return { es: "Aprobada", en: "Approved" };
    case "flagged":
      return { es: "Observada", en: "Flagged" };
    default:
      return { es: "Sin dato", en: "Unknown" };
  }
}

function riskSeverityLabel(severity: "info" | "warning" | "critical") {
  switch (severity) {
    case "info":
      return { es: "Info", en: "Info" };
    case "warning":
      return { es: "Alerta", en: "Warning" };
    default:
      return { es: "Crítica", en: "Critical" };
  }
}

function actionOptions(line: SubcontractLineContract) {
  switch (line.subcontractHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          subcontractHealth: "watch" as const,
          nextAction: "Contain destajo backlog and stabilize the subcontractor crew before normalizing"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          subcontractHealth: "critical" as const,
          nextAction: "Escalate unresolved attendance, compliance or destajo pressure to operations review"
        },
        {
          label: "Mark controlled",
          subcontractHealth: "controlled" as const,
          nextAction: "Destajo backlog is within tolerance and field issues are fully contained"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          subcontractHealth: "watch" as const,
          nextAction: "Start monitoring subcontract drift before productivity drops further"
        }
      ];
  }
}

function buildSubcontractWhyNow(line: SubcontractLineContract | null, t: (es: string, en: string) => string) {
  if (!line) {
    return t(
      "Selecciona una línea de subcontrato para entender qué se debe contener antes de que la ejecución de obra se desvíe.",
      "Select a subcontract line to understand what must be contained before field execution drifts."
    );
  }

  if (line.subcontractHealth === "critical") {
    return t(
      `El destajo pendiente de MXN ${line.pendingDestajo.toLocaleString()} más una brecha de ${line.progressGap}% ya puso a ${line.contractorName} bajo presión activa de ejecución.`,
      `Pending destajo of MXN ${line.pendingDestajo.toLocaleString()} plus ${line.progressGap}% progress gap already put ${line.contractorName} under active execution pressure.`
    );
  }

  if (line.latestDailyLogStatus === "flagged" || line.qualityReleaseReadiness < 85) {
    return t(
      `${line.frontName} sigue expuesto porque la última postura de campo o calidad aún no es suficientemente estable para dejar este subcontrato sin seguimiento.`,
      `${line.frontName} is still exposed because the latest field or quality posture is not stable enough to leave this subcontract unattended.`
    );
  }

  if (line.complianceExpirations > 0 || line.incidentCount > 0) {
    return t(
      `${line.contractorName} todavía arrastra deuda de cumplimiento o incidentes que puede frenar la continuidad de la cuadrilla si nadie interviene ahora.`,
      `${line.contractorName} still has compliance or incident debt that can stop crew continuity if nobody intervenes now.`
    );
  }

  return t(
    `${line.contractorName} está controlado por ahora, pero asistencia, destajo y liberación aún requieren seguimiento explícito para mantener estable el frente.`,
    `${line.contractorName} is currently controlled, but attendance, destajo and release readiness still need explicit follow-through to keep the front stable.`
  );
}

function buildSubcontractDownstreamEffect(line: SubcontractLineContract | null, t: (es: string, en: string) => string) {
  if (!line) {
    return t(
      "Selecciona una línea de subcontrato para revisar qué otros módulos absorberán el impacto.",
      "Select a subcontract line to inspect what other modules will absorb the impact."
    );
  }

  if (line.pendingDestajo > line.contractAmount * 0.1) {
    return t(
      "Si el destajo sigue sin resolverse, finanzas, compras y control de obra heredarán ruido evitable en pagos y confianza de producción.",
      "If destajo remains unresolved, finance, procurement and project control will inherit preventable noise in payment timing and production confidence."
    );
  }

  if (line.latestDailyLogStatus === "flagged" || line.qualityReleaseReadiness < 85) {
    return t(
      "Si campo y calidad no se recuperan, bitácora, control de liberaciones y preparación de cierre se degradarán detrás de este subcontrato.",
      "If field and quality posture do not recover, daily logs, release control and closeout readiness will degrade behind this subcontract."
    );
  }

  if (line.attendanceRate < 85) {
    return t(
      "Si la asistencia sigue débil, el programa de obra y la planeación de cuadrillas absorberán primero el deslizamiento.",
      "If attendance stays soft, the project schedule and workforce planning lanes will absorb the slippage first."
    );
  }

  return t(
    "Si esta línea se mantiene bajo control, proyectos, RH y calidad pueden seguir operando sin retrabajo aguas abajo desde el carril del contratista.",
    "If this line is kept under control, projects, HR and quality can keep operating without downstream rework from the subcontractor lane."
  );
}

function buildSubcontractReportBack(line: SubcontractLineContract | null, t: (es: string, en: string) => string) {
  if (!line) {
    return t(
      "Selecciona una línea de subcontrato para definir el siguiente punto de control operativo.",
      "Select a subcontract line to define the next operational checkpoint."
    );
  }

  if (line.subcontractHealth === "critical") {
    return t(
      "Reporta en el siguiente ciclo de supervisión una vez confirmados el control del destajo, la recuperación de asistencia y el responsable del bloqueo de campo.",
      "Report back in the next supervisor cycle once destajo containment, attendance recovery and the field blocker owner are confirmed."
    );
  }

  if (line.latestDailyLogStatus === "flagged" || line.qualityReleaseReadiness < 85) {
    return t(
      "Reporta después de la siguiente bitácora de campo y validación de calidad para reevaluar la postura de liberación con evidencia.",
      "Report back after the next field log and quality verification so the release posture can be re-evaluated with evidence."
    );
  }

  if (line.complianceExpirations > 0 || line.incidentCount > 0) {
    return t(
      "Reporta en cuanto queden formalmente liberados los vencimientos de cumplimiento o las acciones por incidente en el carril operativo.",
      "Report back as soon as compliance expirations or incident actions are formally cleared in the operating lane."
    );
  }

  return t(
    "Reporta en la siguiente revisión programada del subcontrato para confirmar que este frente siguió controlado sin nuevo desvío de destajo o calidad.",
    "Report back at the next planned subcontract review to confirm this front stayed controlled without new destajo or quality drift."
  );
}

type SubcontractModuleKey = "field" | "quality" | "projects" | "hr" | "accounts-payable";

function subcontractModuleMeta(module: SubcontractModuleKey) {
  switch (module) {
    case "field":
      return {
        href: "/field",
        label: { es: "Campo", en: "Field" },
        cta: { es: "Abrir campo", en: "Open field" }
      };
    case "quality":
      return {
        href: "/quality",
        label: { es: "Calidad", en: "Quality" },
        cta: { es: "Abrir calidad", en: "Open quality" }
      };
    case "projects":
      return {
        href: "/projects",
        label: { es: "Proyectos", en: "Projects" },
        cta: { es: "Abrir proyectos", en: "Open projects" }
      };
    case "hr":
      return {
        href: "/hr",
        label: { es: "RH", en: "HR" },
        cta: { es: "Abrir RH", en: "Open HR" }
      };
    default:
      return {
        href: "/accounts-payable",
        label: { es: "Cuentas por pagar", en: "Accounts payable" },
        cta: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }
      };
  }
}

function buildSelectedStation(line: SubcontractLineContract | null, t: (es: string, en: string) => string) {
  if (!line) {
    return null;
  }

  if (line.latestDailyLogStatus === "flagged") {
    return {
      responsibleModule: "field" as const,
      responsibleReason: t(
        "Campo debe contener primero la bitácora observada y dejar dueño explícito del bloqueo en frente.",
        "Field must contain the flagged log first and assign an explicit owner to the front blocker."
      ),
      nextModule: line.qualityReleaseReadiness < 85 ? ("quality" as const) : ("projects" as const),
      nextReason: line.qualityReleaseReadiness < 85
        ? t(
            "Después, calidad debe confirmar que la liberación vuelve a postura operable antes de soltar el frente.",
            "Then quality must confirm release posture is operable again before the front is released."
          )
        : t(
            "Después, proyectos debe validar que el frente puede retomar ritmo sin mover el programa.",
            "Then projects must validate the front can resume pace without moving the schedule."
          ),
      returnConfirmation: t(
        "Regresa con la bitácora ya contenida, el bloqueo de campo con responsable y la liberación de calidad lista o fechada.",
        "Return with the log already contained, the field blocker assigned, and quality release ready or scheduled."
      ),
      lane: ["field", "quality", "projects", "hr", "accounts-payable"] as const
    };
  }

  if (line.qualityReleaseReadiness < 85) {
    return {
      responsibleModule: "quality" as const,
      responsibleReason: t(
        "Calidad toma el siguiente turno porque la liberación todavía no deja operar este subcontrato sin riesgo de retrabajo.",
        "Quality owns the next turn because release readiness still does not let this subcontract operate without rework risk."
      ),
      nextModule: "field" as const,
      nextReason: t(
        "En cuanto calidad libere, campo debe confirmar que la cuadrilla puede seguir sin observaciones nuevas.",
        "As soon as quality releases it, field must confirm the crew can continue without new observations."
      ),
      returnConfirmation: t(
        "Regresa con el porcentaje de liberación confirmado, la evidencia de calidad cerrada y la siguiente bitácora de campo habilitada.",
        "Return with confirmed release percentage, closed quality evidence, and the next field log enabled."
      ),
      lane: ["quality", "field", "projects", "hr", "accounts-payable"] as const
    };
  }

  if (line.attendanceRate < 85 || line.complianceExpirations > 0 || line.incidentCount > 0) {
    return {
      responsibleModule: "hr" as const,
      responsibleReason: t(
        "RH es el dueño inmediato porque asistencia, cumplimiento o incidentes pueden cortar la continuidad real de la cuadrilla.",
        "HR is the immediate owner because attendance, compliance, or incidents can cut actual crew continuity."
      ),
      nextModule: "field" as const,
      nextReason: t(
        "Luego campo debe confirmar que la dotación recuperada sí sostiene la ejecución en frente.",
        "Then field must confirm the recovered staffing actually sustains front execution."
      ),
      returnConfirmation: t(
        "Regresa con asistencia recuperada o plan cerrando la brecha, vencimientos resueltos y cuadrilla lista en campo.",
        "Return with attendance recovered or a plan closing the gap, expirations resolved, and the crew ready in field."
      ),
      lane: ["hr", "field", "projects", "quality", "accounts-payable"] as const
    };
  }

  if (line.pendingDestajo > line.contractAmount * 0.1) {
    return {
      responsibleModule: "accounts-payable" as const,
      responsibleReason: t(
        "Cuentas por pagar debe ordenar el carril inmediato porque el destajo pendiente ya compromete la continuidad económica del contratista.",
        "Accounts payable must stabilize the immediate lane because pending destajo already threatens subcontractor economic continuity."
      ),
      nextModule: "projects" as const,
      nextReason: t(
        "Después, proyectos debe decidir si el frente puede seguir al mismo ritmo o necesita reprogramación puntual.",
        "After that, projects must decide whether the front can keep the same pace or needs targeted rescheduling."
      ),
      returnConfirmation: t(
        "Regresa con el destajo validado para pago, la ruta de liberación confirmada y la continuidad del frente respaldada por proyectos.",
        "Return with destajo validated for payment, the release route confirmed, and front continuity backed by projects."
      ),
      lane: ["accounts-payable", "projects", "field", "quality", "hr"] as const
    };
  }

  return {
    responsibleModule: "projects" as const,
    responsibleReason: t(
      "Proyectos queda al frente porque debe sostener el ritmo, absorber la brecha de avance y proteger la continuidad del frente.",
      "Projects leads because it must sustain pace, absorb the progress gap, and protect front continuity."
    ),
    nextModule: "field" as const,
    nextReason: t(
      "Luego campo confirma que el frente sigue ejecutable sin nuevas alertas de calidad, asistencia o destajo.",
      "Then field confirms the front remains executable without new quality, attendance, or destajo alerts."
    ),
    returnConfirmation: t(
      "Regresa con el siguiente hito de frente confirmado, sin desvío nuevo de destajo y con calidad y RH todavía en verde.",
      "Return with the next front milestone confirmed, no new destajo drift, and quality plus HR still green."
    ),
    lane: ["projects", "field", "quality", "hr", "accounts-payable"] as const
  };
}

function recomputeSummary(lines: SubcontractLineContract[]) {
  return {
    activeSubcontracts: lines.length,
    contractedAmount: lines.reduce((sum, item) => sum + item.contractAmount, 0),
    earnedAmount: lines.reduce((sum, item) => sum + item.earnedAmount, 0),
    paidAmount: lines.reduce((sum, item) => sum + item.paidAmount, 0),
    pendingDestajo: lines.reduce((sum, item) => sum + item.pendingDestajo, 0),
    criticalSubcontracts: lines.filter((item) => item.subcontractHealth === "critical").length,
    executionRiskSubcontracts: lines.filter(
      (item) => item.latestDailyLogStatus === "flagged" || item.qualityReleaseReadiness < 75 || item.subcontractHealth === "critical"
    ).length
  };
}

export default function SubcontractsPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const t = (es: string, en: string) => localizeText({ es, en });
  const [overview, setOverview] = useState<SubcontractOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<"all" | SubcontractLineContract["subcontractHealth"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchSubcontractOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Subcontracts overview is unavailable right now.");
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

  const projectOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.lines.map((item) => item.projectName))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [overview]);

  const filteredLines = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.lines.filter((item) => {
      const matchesProject = projectFilter === "all" || item.projectName === projectFilter;
      const matchesHealth = healthFilter === "all" || item.subcontractHealth === healthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.contractorName.toLowerCase().includes(normalizedSearch) ||
        item.frontName.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch);

      return matchesProject && matchesHealth && matchesSearch;
    });
  }, [healthFilter, overview, projectFilter, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedWhyNow = buildSubcontractWhyNow(selectedLine, t);
  const selectedDownstreamEffect = buildSubcontractDownstreamEffect(selectedLine, t);
  const selectedReportBack = buildSubcontractReportBack(selectedLine, t);
  const selectedStation = buildSelectedStation(selectedLine, t);
  const orderedOperationalLinks = selectedStation
    ? selectedStation.lane.map((module) => ({
        module,
        ...subcontractModuleMeta(module)
      }))
    : [];

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredLines.length === 0) {
      setSelectedLineId(null);
      return;
    }

    const isSelectedVisible = filteredLines.some((item) => item.id === selectedLineId);
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
    subcontractHealth: SubcontractLineContract["subcontractHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError(t("La siguiente acción debe ser más específica antes de actualizar el subcontrato.", "Next action must be more specific before updating the subcontract."));
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateSubcontractLine(
      selectedLine.id,
      activeCompany.id,
      {
        subcontractHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? t("La actualización del subcontrato falló.", "Subcontract update failed."));
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
        focusLine:
          lines
            .slice()
            .sort((left, right) => {
              if (left.subcontractHealth === "critical" && right.subcontractHealth !== "critical") {
                return -1;
              }

              if (left.subcontractHealth !== "critical" && right.subcontractHealth === "critical") {
                return 1;
              }

              return right.pendingDestajo - left.pendingDestajo;
            })[0] ?? null
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(
      t(
        `El subcontrato cambió a ${localizeText(subcontractHealthLabel(response.data.subcontractHealth)).toLowerCase()}.`,
        `Subcontract moved to ${response.data.subcontractHealth}.`
      )
    );
    setIsSaving(false);
  }

  return (
    <AppShell
      title={t("Subcontratos y destajo", "Subcontracts and destajo")}
      eyebrow={t("Ejecución de cuadrillas", "Workforce execution")}
      description={t("Avance de contratistas, backlog de destajo y postura de campo conectados con frentes activos.", "Contractor advance, destajo backlog and field readiness connected to active fronts.")}
    >
      <ModuleGate moduleKeys={["hr.workforce"]} requiredPermissions={["hr:*"]} title={t("Subcontratos", "Subcontracts")}>
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label={t("Subcontratos activos", "Active subcontracts")}
                value={String(filteredSummary.activeSubcontracts)}
                footnote={t("Frentes de contratista hoy seguidos en ejecución real.", "Contractor fronts currently tracked in live execution.")}
              />
              <KpiCard
                label={t("Contratado", "Contracted")}
                value={`MXN ${filteredSummary.contractedAmount.toLocaleString()}`}
                footnote={t("Valor base hoy bajo ejecución de contratistas.", "Baseline value currently under contractor execution.")}
              />
              <KpiCard
                label={t("Ganado", "Earned")}
                value={`MXN ${filteredSummary.earnedAmount.toLocaleString()}`}
                footnote={t("Valor ganado según avance de campo y productividad actual.", "Earned value implied by field advance and current productivity.")}
              />
              <KpiCard
                label={t("Destajo pendiente", "Pending destajo")}
                value={`MXN ${filteredSummary.pendingDestajo.toLocaleString()}`}
                footnote={t("Monto aún pendiente por conciliar entre avance pagado y estimado.", "Value still pending to settle between invoiced and paid progress.")}
              />
              <KpiCard
                label={t("Riesgo de ejecución", "Execution risk")}
                value={String(filteredSummary.executionRiskSubcontracts)}
                footnote={t("Subcontratos ya afectados por bitácora observada, baja liberación de calidad o postura crítica.", "Subcontracts already under flagged field logs, poor quality readiness or critical posture.")}
              />
            </section>

            <section className="grid cols2">
              <Card title={t("Mesa de subcontratos", "Subcontract board")} description={t("Destajo, avance y postura operativa del contratista sobre frentes activos.", "Destajo, progress and contractor operating posture across active fronts.")}>
                <FilterBar summary={t(`${filteredLines.length} líneas de subcontrato en la empresa activa`, `${filteredLines.length} subcontract lines in the active tenant`)}>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">{t("Todos los proyectos", "All projects")}</option>
                    {projectOptions.map((projectName) => (
                      <option key={projectName} value={projectName}>
                        {projectName}
                      </option>
                    ))}
                  </select>
                  <select
                    className="selectField"
                    value={healthFilter}
                    onChange={(event) => setHealthFilter(event.target.value as "all" | SubcontractLineContract["subcontractHealth"])}
                  >
                    <option value="all">{t("Toda la salud", "All health")}</option>
                    <option value="controlled">{localizeText(subcontractHealthLabel("controlled"))}</option>
                    <option value="watch">{localizeText(subcontractHealthLabel("watch"))}</option>
                    <option value="critical">{localizeText(subcontractHealthLabel("critical"))}</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder={t("Buscar contratista, frente o clave", "Search contractor, front or code")}
                  />
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? t("backend real", "live backend") : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("subcontratos listos", "subcontracts ready")}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "contractor",
                      label: t("Contratista", "Contractor"),
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.contractorName}</strong>
                            <span className="tableCellMuted">{row.frontName} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "progress",
                      label: t("Avance", "Advance"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.progressPercent}% {t("avance de obra", "site progress")}</strong>
                          <span className="tableCellMuted">{row.productivityRate}% {t("productividad", "productivity")}</span>
                        </div>
                      )
                    },
                    {
                      key: "destajo",
                      label: "Destajo",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.pendingDestajo.toLocaleString()}</strong>
                          <span className="tableCellMuted">paid MXN {row.paidAmount.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: t("Salud", "Health"),
                      render: (row) => <Badge tone={healthTone(row.subcontractHealth)}>{localizeText(subcontractHealthLabel(row.subcontractHealth))}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title={t("Subcontrato seleccionado", "Selected subcontract")}
                description={t("Estación operable para decidir quién toma el siguiente turno, a dónde saltar y con qué evidencia debe regresar este subcontrato.", "Operable station to decide who takes the next turn, where to jump next, and what evidence this subcontract must bring back.")}
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.subcontractHealth)}>{localizeText(subcontractHealthLabel(selectedLine.subcontractHealth))}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    {selectedStation ? (
                      <>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Importa ahora", "Why it matters now")}</div>
                          <div className="tableCellStack">
                            <strong>{selectedWhyNow}</strong>
                            <span className="tableCellMuted">{selectedDownstreamEffect}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Módulo responsable ahora", "Responsible module now")}</div>
                          <div className="tableCellStack">
                            <div className="tagRow">
                              <Badge tone="warning">{localizeText(subcontractModuleMeta(selectedStation.responsibleModule).label)}</Badge>
                              <span>{selectedStation.responsibleReason}</span>
                            </div>
                            <span className="tableCellMuted">
                              {t("Siguiente salto:", "Next hop:")} {localizeText(subcontractModuleMeta(selectedStation.nextModule).label)}. {selectedStation.nextReason}
                            </span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Debe regresar confirmado", "Must return confirmed")}</div>
                          <div className="tableCellStack">
                            <strong>{selectedStation.returnConfirmation}</strong>
                            <span className="tableCellMuted">{selectedReportBack}</span>
                          </div>
                        </div>
                      </>
                    ) : null}
                    <div className="detailRow">
                      <div className="detailLabel">{t("Proyecto", "Project")}</div>
                      <div className="tagRow">
                        <span>{selectedLine.projectName}</span>
                        <Badge tone={projectTone(selectedLine.projectStatus)}>
                          {localizeText(projectStatusLabel(selectedLine.projectStatus))}
                        </Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Personal", "Headcount")}</div>
                      <div>{selectedLine.activeHeadcount} {t("personas", "people")}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Asistencia", "Attendance")}</div>
                      <div>{selectedLine.attendanceRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Vencimientos de cumplimiento", "Compliance expirations")}</div>
                      <div>{selectedLine.complianceExpirations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Incidentes", "Incidents")}</div>
                      <div>{selectedLine.incidentCount}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Brecha de avance", "Progress gap")}</div>
                      <div>{selectedLine.progressGap}% {t("contra productividad del contratista", "against contractor productivity")}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Postura campo / calidad", "Field / quality posture")}</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">{t("última bitácora", "latest log")} {localizeText(dailyLogStatusLabel(selectedLine.latestDailyLogStatus))}</span>
                        <span className="tableCellMuted">{t("liberación de calidad", "quality release readiness")} {selectedLine.qualityReleaseReadiness}%</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Retención", "Retention")}</div>
                      <div>MXN {selectedLine.retentionAmount.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Por qué ahora", "Why now")}</div>
                      <div>{selectedWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Impacto aguas abajo", "Downstream effect")}</div>
                      <div>{selectedDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Próximo reporte", "Report back")}</div>
                      <div>{selectedReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente acción", "Next action")}</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder={t("Describe la siguiente acción de contratista, destajo o cumplimiento", "Describe the next subcontractor, destajo or compliance action")}
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Vínculos operativos", "Operational links")}</div>
                      <div className="row gap wrap">
                        {orderedOperationalLinks.map((link, index) => (
                          <Link
                            key={link.module}
                            className={index === 0 ? "button" : "buttonGhost"}
                            href={link.href}
                          >
                            {localizeText(link.cta)}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Reglas de negocio", "Business rules")}</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">{t("Controlado se bloquea mientras el destajo pendiente siga alto.", "Controlled is blocked while pending destajo remains high.")}</span>
                        <span className="tableCellMuted">{t("Controlado se bloquea mientras existan vencimientos o incidentes abiertos.", "Controlled is blocked while expirations or incidents remain open.")}</span>
                        <span className="tableCellMuted">{t("Controlado ahora también exige al menos 85% de liberación de calidad.", "Controlled now also requires quality readiness of at least 85%.")}</span>
                        <span className="tableCellMuted">{t("Vigilancia se bloquea si la asistencia baja de 85% o la última bitácora sigue observada.", "Watch is blocked while attendance is below 85% or the latest field log remains flagged.")}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Acciones", "Actions")}</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          <button
                            className="button"
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleAction(selectedLine.subcontractHealth, selectedLine.nextAction)}
                          >
                            {isSaving ? t("Guardando...", "Saving...") : t("Guardar siguiente acción", "Save next action")}
                          </button>
                          {lineActions.map((option) => (
                            <button
                              key={option.label}
                              className={option.subcontractHealth === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.subcontractHealth === "controlled" &&
                                  (selectedLine.pendingDestajo > selectedLine.contractAmount * 0.1 ||
                                    selectedLine.complianceExpirations > 0 ||
                                    selectedLine.incidentCount > 0 ||
                                    selectedLine.qualityReleaseReadiness < 85)) ||
                                (option.subcontractHealth === "watch" &&
                                  (selectedLine.attendanceRate < 85 || selectedLine.latestDailyLogStatus === "flagged"))
                              }
                              onClick={() => void handleAction(option.subcontractHealth, option.nextAction)}
                            >
                              {isSaving ? t("Guardando...", "Saving...") : localizeText(subcontractActionLabel(option.label))}
                            </button>
                          ))}
                        </div>
                        {actionMessage ? <span className="tableCellMuted">{actionMessage}</span> : null}
                        {actionError ? <span style={{ color: "var(--danger-700)" }}>{actionError}</span> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title={t("Sin subcontrato seleccionado", "No subcontract selected")}
                    description={t("Elige una línea de subcontrato para revisar avance, destajo y postura del contratista.", "Choose a subcontract line to inspect progress, destajo and contractor posture.")}
                    primaryAction={{ label: t("Seguir en subcontratos", "Stay on subcontracts"), href: "/subcontracts" }}
                  />
                )}
              </Card>
            </section>

            <Card title={t("Riesgos del subcontrato", "Subcontract risks")} description={t("Bloqueadores de capacidad, cumplimiento y pago que afectan la continuidad del contratista.", "Capacity, compliance and payment blockers affecting contractor continuity.")}>
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                columns={[
                  {
                    key: "risk",
                    label: t("Riesgo", "Risk"),
                    render: (risk) => (
                      <div className="tableCellStack">
                        <strong>{risk.title}</strong>
                        <span className="tableCellMuted">{risk.category}</span>
                      </div>
                    )
                  },
                  {
                    key: "severity",
                    label: t("Severidad", "Severity"),
                    render: (risk) => (
                      <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                        {localizeText(riskSeverityLabel(risk.severity))}
                      </Badge>
                    )
                  },
                  {
                    key: "owner",
                    label: t("Responsable", "Owner"),
                    render: (risk) => risk.owner
                  },
                  {
                    key: "status",
                    label: t("Acción actual", "Current action"),
                    render: (risk) => risk.status
                  }
                ]}
              />
            </Card>
          </>
        ) : error ? (
          <EmptyState
            title={t("Vista de subcontratos no disponible", "Subcontracts overview unavailable")}
            description={error}
            primaryAction={{ label: t("Ir al tablero", "Go to dashboard"), href: "/dashboard" }}
            secondaryAction={{ label: t("Revisar acceso", "Review login"), href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? t("Cargando vista de subcontratos", "Loading subcontracts overview") : t("La vista de subcontratos aún no carga", "Subcontracts overview not loaded yet")}
            description={t("Esta ruta espera una respuesta viva del backend de subcontratos para la empresa activa.", "This route expects a live backend subcontract response for the active tenant.")}
            primaryAction={{ label: t("Ir al tablero", "Go to dashboard"), href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
