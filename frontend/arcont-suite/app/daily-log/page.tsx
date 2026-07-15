"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { DailyLogEntryContract, DailyLogOverviewContract } from "@/lib/contracts";
import type { LocalizedText } from "@/lib/i18n";
import { createDailyLogEntry, fetchDailyLogOverview, fetchEquipmentOverview, updateDailyLogEntry } from "@/lib/platform-api";

type Translate = (es: string, en: string) => string;

type DailyLogEquipmentBridge = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
} | null;

type DailyLogCreateForm = {
  projectName: string;
  frontName: string;
  supervisor: string;
  logDate: string;
  shift: DailyLogEntryContract["shift"];
  weather: DailyLogEntryContract["weather"];
  status: DailyLogEntryContract["status"];
  progressPercent: string;
  workforceCount: string;
  incidentsCount: string;
  blockersCount: string;
  evidenceCount: string;
  concretePourM3: string;
  projectStatus: DailyLogEntryContract["projectStatus"];
  qualityOpenFindings: string;
  qualityReleaseReadiness: string;
  subcontractHealth: DailyLogEntryContract["subcontractHealth"];
  pendingDestajo: string;
  nextAction: string;
};

type DailyLogPreloadSource = "field" | "quality";

type DailyLogContextualPreload = {
  source: DailyLogPreloadSource;
  projectName: string;
  frontName: string;
  supervisor: string;
  nextAction: string;
  qualityOpenFindings: string;
  qualityReleaseReadiness: string;
};

function normalizeDailyLogValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildDailyLogContextualPreload(
  searchParams: ReturnType<typeof useSearchParams>
): DailyLogContextualPreload | null {
  const source = searchParams.get("source")?.trim();

  if (source === "field") {
    const projectName = searchParams.get("projectName")?.trim() ?? "";
    const frontName = searchParams.get("frontName")?.trim() ?? "";
    const supervisor = searchParams.get("owner")?.trim() ?? "";
    const nextAction = searchParams.get("nextAction")?.trim() ?? "";

    if (![projectName, frontName, supervisor, nextAction].some((value) => value.length > 0)) {
      return null;
    }

    return {
      source,
      projectName,
      frontName,
      supervisor,
      nextAction,
      qualityOpenFindings: "",
      qualityReleaseReadiness: ""
    };
  }

  if (source === "quality") {
    const projectName = searchParams.get("projectName")?.trim() ?? "";
    const frontName = searchParams.get("areaName")?.trim() || searchParams.get("frontName")?.trim() || "";
    const supervisor = searchParams.get("contractorName")?.trim() ?? "";
    const nextAction = searchParams.get("nextAction")?.trim() ?? "";
    const qualityOpenFindings = searchParams.get("openFindings")?.trim() ?? "";
    const qualityReleaseReadiness = searchParams.get("releaseReadiness")?.trim() ?? "";

    if (
      ![projectName, frontName, supervisor, nextAction, qualityOpenFindings, qualityReleaseReadiness].some(
        (value) => value.length > 0
      )
    ) {
      return null;
    }

    return {
      source,
      projectName,
      frontName,
      supervisor,
      nextAction,
      qualityOpenFindings,
      qualityReleaseReadiness
    };
  }

  return null;
}

function findRelatedDailyLogEntry(
  overview: DailyLogOverviewContract | null,
  preload: DailyLogContextualPreload
) {
  if (!overview) {
    return null;
  }

  const projectName = normalizeDailyLogValue(preload.projectName);
  const frontName = normalizeDailyLogValue(preload.frontName);

  if (!projectName || !frontName) {
    return null;
  }

  return (
    overview.entries.find(
      (entry) =>
        normalizeDailyLogValue(entry.projectName) === projectName &&
        normalizeDailyLogValue(entry.frontName) === frontName
    ) ?? null
  );
}

function statusTone(status: DailyLogEntryContract["status"]) {
  switch (status) {
    case "approved":
      return "success";
    case "submitted":
      return "info";
    case "flagged":
      return "danger";
    default:
      return "warning";
  }
}

function statusLabel(status: DailyLogEntryContract["status"]): LocalizedText {
  switch (status) {
    case "approved":
      return { es: "Aprobada", en: "Approved" };
    case "submitted":
      return { es: "Enviada", en: "Submitted" };
    case "flagged":
      return { es: "Marcada", en: "Flagged" };
    default:
      return { es: "Borrador", en: "Draft" };
  }
}

function weatherLabel(weather: DailyLogEntryContract["weather"]): LocalizedText {
  switch (weather) {
    case "clear":
      return { es: "Despejado", en: "Clear" };
    case "windy":
      return { es: "Ventoso", en: "Windy" };
    case "rain":
      return { es: "Lluvia", en: "Rain" };
    default:
      return { es: "Tormenta", en: "Storm" };
  }
}

function shiftLabel(shift: DailyLogEntryContract["shift"]): LocalizedText {
  switch (shift) {
    case "night":
      return { es: "Noche", en: "Night" };
    case "mixed":
      return { es: "Mixto", en: "Mixed" };
    default:
      return { es: "Mañana", en: "Morning" };
  }
}

function projectStatusLabel(status: DailyLogEntryContract["projectStatus"]): LocalizedText {
  switch (status) {
    case "active":
      return { es: "Activo", en: "Active" };
    case "at_risk":
      return { es: "En riesgo", en: "At risk" };
    case "blocked":
      return { es: "Bloqueado", en: "Blocked" };
    case "planning":
      return { es: "Planeación", en: "Planning" };
    case "closed":
      return { es: "Cerrado", en: "Closed" };
    default:
      return { es: "Desconocido", en: "Unknown" };
  }
}

function projectStatusTone(status: DailyLogEntryContract["projectStatus"]) {
  switch (status) {
    case "blocked":
      return "danger";
    case "at_risk":
      return "warning";
    case "active":
    case "planning":
      return "info";
    case "closed":
      return "success";
    default:
      return "info";
  }
}

function subcontractHealthLabel(status: DailyLogEntryContract["subcontractHealth"]): LocalizedText {
  switch (status) {
    case "controlled":
      return { es: "Controlado", en: "Controlled" };
    case "watch":
      return { es: "Vigilancia", en: "Watch" };
    case "critical":
      return { es: "Crítico", en: "Critical" };
    default:
      return { es: "Desconocido", en: "Unknown" };
  }
}

function subcontractHealthTone(status: DailyLogEntryContract["subcontractHealth"]) {
  switch (status) {
    case "critical":
      return "danger";
    case "watch":
      return "warning";
    case "controlled":
      return "success";
    default:
      return "info";
  }
}

function actionOptions(entry: DailyLogEntryContract, t: Translate) {
  switch (entry.status) {
    case "draft":
      return [
        {
          label: t("Enviar bitácora", "Submit log"),
          status: "submitted" as const,
          nextAction: t(
            "Enviar la bitácora con cuadrilla y evidencia del turno actual.",
            "Submit the log with the current shift crew and evidence."
          )
        },
        {
          label: t("Marcar incidencia", "Flag issue"),
          status: "flagged" as const,
          nextAction: t(
            "Escalar el bloqueo y mantener esta bitácora bajo atención operativa diaria.",
            "Escalate the blocker and keep this log under daily operational attention."
          )
        }
      ];
    case "submitted":
      return [
        {
          label: t("Aprobar bitácora", "Approve log"),
          status: "approved" as const,
          nextAction: t(
            "Aprobar la bitácora y liberar el siguiente paso operativo para la cuadrilla.",
            "Approve the log and release the next operating step for the crew."
          )
        },
        {
          label: t("Marcar incidencia", "Flag issue"),
          status: "flagged" as const,
          nextAction: t(
            "Detener esta bitácora y escalar el bloqueo o la brecha de evidencia antes de aprobar.",
            "Hold this log and escalate the blocker or evidence gap before approval."
          )
        }
      ];
    case "flagged":
      return [
        {
          label: t("Volver a borrador", "Return to draft"),
          status: "draft" as const,
          nextAction: t(
            "Rehacer el paquete de bitácora y completar la captura faltante antes de reenviar.",
            "Rework the log package and complete the missing capture before resubmitting."
          )
        },
        {
          label: t("Reenviar bitácora", "Resubmit log"),
          status: "submitted" as const,
          nextAction: t(
            "Reenviar la bitácora corregida después de contener el problema de campo.",
            "Resubmit the corrected log after containing the field issue."
          )
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(entries: DailyLogEntryContract[]) {
  return {
    submittedToday: entries.filter((entry) => entry.status !== "draft").length,
    approvedLogs: entries.filter((entry) => entry.status === "approved").length,
    flaggedLogs: entries.filter((entry) => entry.status === "flagged").length,
    totalWorkforce: entries.reduce((sum, entry) => sum + entry.workforceCount, 0),
    pendingEvidence: entries.reduce((sum, entry) => sum + (entry.status !== "approved" ? Math.max(0, 12 - entry.evidenceCount) : 0), 0),
    averageProgress:
      entries.length > 0 ? Number((entries.reduce((sum, entry) => sum + entry.progressPercent, 0) / entries.length).toFixed(1)) : 0,
    executionRiskLogs: entries.filter(
      (entry) => entry.status === "flagged" || entry.qualityOpenFindings > 3 || entry.subcontractHealth === "critical"
    ).length
  };
}

function pickFocusEntry(entries: DailyLogEntryContract[]) {
  return (
    entries
      .slice()
      .sort((left, right) => {
        const weight = { flagged: 4, submitted: 3, draft: 2, approved: 1 } as const;
        const gap = weight[right.status] - weight[left.status];
        if (gap !== 0) {
          return gap;
        }
        return right.updatedAt.localeCompare(left.updatedAt);
      })[0] ?? null
  );
}

function createDefaultCreateForm(): DailyLogCreateForm {
  return {
    projectName: "Proyecto nuevo",
    frontName: "Frente 01",
    supervisor: "Residente de obra",
    logDate: new Date().toISOString().slice(0, 10),
    shift: "morning",
    weather: "clear",
    status: "draft",
    progressPercent: "0",
    workforceCount: "18",
    incidentsCount: "0",
    blockersCount: "0",
    evidenceCount: "4",
    concretePourM3: "0",
    projectStatus: "active",
    qualityOpenFindings: "0",
    qualityReleaseReadiness: "92",
    subcontractHealth: "controlled",
    pendingDestajo: "0",
    nextAction: ""
  };
}

function createDailyLogExample(): DailyLogCreateForm {
  return {
    projectName: "Torre Demo",
    frontName: "Frente Cimentacion",
    supervisor: "Luis Operaciones",
    logDate: new Date().toISOString().slice(0, 10),
    shift: "morning",
    weather: "clear",
    status: "draft",
    progressPercent: "42",
    workforceCount: "24",
    incidentsCount: "0",
    blockersCount: "1",
    evidenceCount: "6",
    concretePourM3: "18",
    projectStatus: "at_risk",
    qualityOpenFindings: "2",
    qualityReleaseReadiness: "84",
    subcontractHealth: "watch",
    pendingDestajo: "0",
    nextAction: "Cerrar evidencia del frente y liberar acero antes del siguiente vaciado."
  };
}

function createDailyLogPreset(preset: "concrete_pour" | "quality_hold" | "equipment_delay"): DailyLogCreateForm {
  const base = createDailyLogExample();

  switch (preset) {
    case "concrete_pour":
      return {
        ...base,
        frontName: "Frente Vaciado Losa",
        progressPercent: "58",
        blockersCount: "0",
        evidenceCount: "10",
        concretePourM3: "36",
        projectStatus: "active",
        qualityOpenFindings: "0",
        qualityReleaseReadiness: "96",
        subcontractHealth: "controlled",
        nextAction: "Confirmar curado, liberar evidencia del vaciado y programar avance del siguiente frente."
      };
    case "quality_hold":
      return {
        ...base,
        frontName: "Frente Acero y Cimbra",
        progressPercent: "34",
        blockersCount: "2",
        evidenceCount: "5",
        concretePourM3: "0",
        projectStatus: "at_risk",
        qualityOpenFindings: "4",
        qualityReleaseReadiness: "61",
        subcontractHealth: "watch",
        nextAction: "Cerrar observaciones de calidad y documentar liberacion antes de reactivar el frente."
      };
    default:
      return {
        ...base,
        frontName: "Frente Movimiento de Tierras",
        progressPercent: "27",
        blockersCount: "1",
        incidentsCount: "1",
        evidenceCount: "7",
        concretePourM3: "0",
        projectStatus: "at_risk",
        qualityOpenFindings: "1",
        qualityReleaseReadiness: "82",
        subcontractHealth: "watch",
        nextAction: "Sustituir equipo detenido y reprogramar la cuadrilla antes del siguiente corte operativo."
      };
  }
}

function buildDailyLogEquipmentStory(entry: DailyLogEntryContract | null, bridge: DailyLogEquipmentBridge, t: Translate) {
  if (!entry) {
    return null;
  }

  const linkedMachines =
    bridge?.equipment.machines.filter((item) => item.projectName === entry.projectName && item.frontName === entry.frontName) ?? [];
  const constrainedMachines = linkedMachines.filter((item) => item.status !== "available" || item.health !== "healthy");

  return {
    equipmentSupport:
      linkedMachines.length > 0
        ? t(
            `${linkedMachines.length} equipos rastreados soportan este frente y ${constrainedMachines.length} ya operan degradados.`,
            `${linkedMachines.length} tracked machines support this front and ${constrainedMachines.length} are already degraded.`
          )
        : t("No hay equipo rastreado asignado a este frente.", "No tracked machine is currently mapped to this front."),
    executionConstraint:
      constrainedMachines.length > 0
        ? t(
            `${constrainedMachines[0]?.machineName ?? "Un activo restringido"} está afectando el turno bajo postura ${constrainedMachines[0]?.status ?? "restringida"}.`,
            `${constrainedMachines[0]?.machineName ?? "A constrained asset"} is affecting the shift under ${constrainedMachines[0]?.status ?? "constraint"} posture.`
          )
        : t("El equipo no es la restricción principal de ejecución en esta bitácora.", "Equipment is not the primary execution constraint on this daily log."),
    nextEquipmentMove:
      constrainedMachines.length > 0
        ? constrainedMachines[0]?.nextAction ?? t("Recuperar continuidad del equipo antes del siguiente corte operativo.", "Recover equipment continuity before the next field cutoff.")
        : t("No hay una maniobra inmediata de equipo dominando este frente.", "No immediate equipment move is currently dominating this front.")
  };
}

function buildApprovalReadiness(entry: DailyLogEntryContract | null, t: Translate) {
  if (!entry) {
    return {
      tone: "info" as const,
      label: t("Selecciona una bitácora", "Select a log"),
      description: t(
        "Elige una bitácora para revisar si realmente está lista para aprobación o escalamiento.",
        "Choose a log to inspect whether it is actually ready for review or escalation."
      )
    };
  }

  if (entry.blockersCount > 0) {
    return {
      tone: "danger" as const,
      label: t("Bloqueada para aprobar", "Blocked for approval"),
      description: t(
        `${entry.blockersCount} bloqueos siguen abiertos, así que debe volver a campo u operaciones antes de aprobar.`,
        `${entry.blockersCount} blockers remain open, so supervision should route this back into field or operations before approval.`
      )
    };
  }

  if (entry.evidenceCount < 4 || entry.qualityOpenFindings > 2) {
    return {
      tone: "warning" as const,
      label: t("Necesita más soporte", "Needs more support"),
      description: t(
        "La evidencia o la postura de calidad todavía son débiles para liberar el siguiente turno sin deuda.",
        "Evidence volume or quality findings are still weak for a clean release of the next shift."
      )
    };
  }

  return {
    tone: "success" as const,
    label: t("Lista para revisión", "Ready for review"),
    description: t(
      "La bitácora ya tiene la postura mínima para pasar por supervisión sin huecos obvios.",
      "The log already has the minimum operating posture to move through supervision without obvious gaps."
    )
  };
}

function buildEscalationDestination(entry: DailyLogEntryContract | null, nextActionDraft: string, t: Translate) {
  if (!entry) {
    return {
      label: t("Sin destino activo", "No active destination"),
      description: t("Selecciona una bitácora para identificar el siguiente módulo operativo.", "Select a daily log to identify the next operating module."),
      href: "/daily-log"
    };
  }

  if (entry.blockersCount > 0) {
    return {
      label: t("Escalar en campo", "Escalate in field"),
      description: t("La ejecución del frente sigue bloqueada, así que el seguimiento debe suceder en campo.", "Front execution still has blockers, so the crew-level follow-up should happen in field."),
      href: "/field"
    };
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return {
      label: t("Enviar a calidad", "Route to quality"),
      description: t("La liberación está limitada por hallazgos o evidencia incompleta.", "Release posture is being constrained by findings or missing readiness evidence."),
      href: buildQualityHrefFromDailyLog(entry, nextActionDraft)
    };
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return {
      label: t("Coordinar en operaciones", "Coordinate in operations"),
      description: t("La continuidad del subcontrato requiere atención transversal antes del siguiente turno.", "Commercial or subcontract continuity needs cross-domain attention before the next shift."),
      href: buildOperationsHrefFromDailyLog(entry, nextActionDraft)
    };
  }

  return {
    label: t("Revisar equipo", "Check equipment"),
    description: t("Si el frente no está bloqueado por calidad o campo, confirma la continuidad de activos.", "If the front is not blocked by quality or field, confirm asset continuity for the next move."),
    href: "/equipment"
  };
}

function buildDownstreamReadiness(entry: DailyLogEntryContract | null, t: Translate) {
  if (!entry) {
    return {
      tone: "info" as const,
      label: t("Sin bitácora seleccionada", "No log selected"),
      summary: t("Elige una bitácora para validar si el turno ya puede bajar a la siguiente operación.", "Choose a daily log to verify whether the shift story is really ready for downstream execution."),
      checks: [t("Selecciona una bitácora activa de la cola.", "Select an active daily log from the queue.")]
    };
  }

  const checks: string[] = [];

  if (entry.blockersCount > 0) {
    checks.push(
      t(
        `${entry.blockersCount} bloqueo(s) todavía impiden la continuación normal del frente.`,
        `${entry.blockersCount} blocker(s) still keep the front from normal continuation.`
      )
    );
  }

  if (entry.evidenceCount < 4) {
    checks.push(t(`La evidencia está en ${entry.evidenceCount}, debajo del mínimo operativo.`, `Evidence is only ${entry.evidenceCount}, below the minimum operating support.`));
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    checks.push(
      t(
        `La postura de calidad sigue débil con ${entry.qualityReleaseReadiness}% de liberación y ${entry.qualityOpenFindings} hallazgo(s) abiertos.`,
        `Quality posture is still weak at ${entry.qualityReleaseReadiness}% readiness with ${entry.qualityOpenFindings} open finding(s).`
      )
    );
  }

  if (!entry.nextAction?.trim() || entry.nextAction.trim().length < 12) {
    checks.push(t("La siguiente acción todavía es demasiado vaga para el siguiente equipo o turno.", "Next action is still too vague for the next team or shift."));
  }

  if (checks.length > 0) {
    return {
      tone: entry.blockersCount > 0 ? "danger" as const : "warning" as const,
      label: entry.blockersCount > 0 ? t("Detener antes de bajar", "Hold before downstream") : t("Requiere mejor relevo", "Needs tighter handoff"),
      summary:
        entry.blockersCount > 0
          ? t("El turno todavía trae bloqueos que deben contenerse antes de continuar.", "The shift still carries blockers that should be contained before normal continuation.")
          : t("El turno puede seguir, pero el relevo necesita más evidencia o claridad.", "The shift can continue, but the handoff still needs more evidence or clarity."),
      checks
    };
  }

  return {
    tone: "success" as const,
    label: t("Lista para continuidad", "Ready for downstream"),
    summary: t("La bitácora ya tiene suficiente contexto para que el siguiente equipo continúe sin reconstruir la historia del turno.", "The log already has enough operating context for the next team to continue without reconstructing the shift story."),
    checks: [t("Abre el módulo destino y ejecuta la siguiente acción en el mismo ciclo operativo.", "Open the destination module and execute the stated next action in the same operating cycle.")]
  };
}

function buildDailyLogWhyNow(entry: DailyLogEntryContract | null, t: Translate) {
  if (!entry) {
    return t("Selecciona una bitácora para entender por qué este turno requiere atención inmediata.", "Select a daily log to understand why this shift needs attention right now.");
  }

  if (entry.status === "flagged" || entry.blockersCount > 0) {
    return t(
      `${entry.frontName} ya trae ${entry.blockersCount} bloqueo(s) bajo postura ${entry.status}, así que el siguiente turno se puede degradar si supervisión espera.`,
      `${entry.frontName} already carries ${entry.blockersCount} blocker(s) under ${entry.status} posture, so the next shift can degrade immediately if supervision waits.`
    );
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return t(
      `${entry.frontName} todavía tiene una liberación débil, así que aprobar o ignorar esta bitácora pasaría deuda de calidad al siguiente ciclo.`,
      `${entry.frontName} still has weak release posture, so approving or ignoring this log now would pass quality debt into the next operating cycle.`
    );
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return t(
      `${entry.frontName} sigue expuesto por presión de subcontrato o destajo, así que esta bitácora importa más allá del reporte del turno.`,
      `${entry.frontName} is still commercially exposed through subcontract or destajo pressure, so this log matters beyond simple shift reporting.`
    );
  }

  return t(
    `${entry.frontName} está cerca de continuidad normal, así que la decisión útil ahora es si supervisión puede liberar el siguiente movimiento sin reconstruir el turno después.`,
    `${entry.frontName} is close to normal continuity, so the useful decision now is whether supervision can release the next move without rebuilding the shift story later.`
  );
}

function buildDailyLogHumanStep(entry: DailyLogEntryContract | null, t: Translate) {
  if (!entry) {
    return t("Selecciona una bitácora para identificar el siguiente relevo humano.", "Select a daily log to identify the next human handoff.");
  }

  if (entry.blockersCount > 0) {
    return t("Di exactamente qué bloqueo se está conteniendo, quién lo resuelve y si el siguiente turno arranca o espera.", "Tell the field owner exactly which blocker is being contained, who owns it and whether the next shift starts or waits.");
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return t("Di a calidad y campo quién toma la corrección y cuándo regresa la reinspección a supervisión.", "Tell quality and field who owns the corrective action and when the reinspection decision returns to supervision.");
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return t("Di a operaciones quién debe estabilizar la ruta del subcontrato antes de comprometer más producción.", "Tell operations who must stabilize the subcontract lane before the next shift commits more production.");
  }

  return t("Di al siguiente supervisor o residente qué se liberó y qué debe revisarse en el siguiente relevo.", "Tell the next supervisor or resident engineer exactly what was released and what must be checked at the next shift handoff.");
}

function buildDailyLogReportBack(entry: DailyLogEntryContract | null, t: Translate) {
  if (!entry) {
    return t("Selecciona una bitácora para definir cuándo debe regresar el responsable.", "Select a daily log to define when the responsible owner should report back.");
  }

  if (entry.status === "flagged" || entry.blockersCount > 0) {
    return t("Reporta en el mismo ciclo operativo con dueño del bloqueo, contención y decisión de arranque o espera.", "Report back in the same operating cycle with blocker owner, containment result and go/no-go for the next shift.");
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return t("Reporta cuando la evidencia de calidad y la liberación ya sean explícitas y defendibles.", "Report back once quality evidence and release posture are explicit enough to survive approval without hidden debt.");
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return t("Reporta cuando la presión de subcontrato o destajo ya tenga dueño y recuperación asignada.", "Report back when subcontract or destajo pressure is already assigned and operations owns the next recovery move.");
  }

  return t("Reporta en el siguiente checkpoint de supervisión confirmando que el relevo siguió ejecutable.", "Report back at the next supervision checkpoint confirming the shift handoff stayed coherent and executable.");
}

function buildDailyLogRouteSummary(entry: DailyLogEntryContract | null, t: Translate) {
  if (!entry) {
    return t("Usa bitácora como ruta formal entre captura en campo, revisión de supervisión y el siguiente módulo dueño de continuidad.", "Use daily log as the formal route between field capture, supervision review and the next module that owns execution continuity.");
  }

  if (entry.blockersCount > 0 || entry.status === "flagged") {
    return t("Esta bitácora debe pasar primero por contención en campo y recuperación del frente antes de liberar el turno.", "This log should route first through field containment and front recovery before supervision treats the shift as released.");
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return t("Esta bitácora debe pasar por cierre de calidad antes de heredar una liberación débil al siguiente turno.", "This log should route through quality closure before the next shift inherits a weak release posture.");
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return t("Esta bitácora debe pasar por coordinación operativa antes de comprometer más producción con subcontrato inestable.", "This log should route through operations coordination before the next shift commits more production on unstable subcontract footing.");
  }

  return t("Esta bitácora puede seguir por equipo o seguimiento normal de campo con la historia del turno intacta.", "This log can continue through equipment or normal field follow-through with the current shift story intact.");
}

function buildQualityHrefFromDailyLog(entry: DailyLogEntryContract | null, nextActionDraft: string) {
  if (!entry?.projectName?.trim()) {
    return "/quality";
  }

  const params = new URLSearchParams({
    source: "daily-log",
    projectName: entry.projectName
  });

  if (entry.frontName.trim()) {
    params.set("areaName", entry.frontName.trim());
  }

  if (entry.supervisor.trim()) {
    params.set("contractorName", entry.supervisor.trim());
  }

  params.set("checklistName", `Seguimiento de bitácora - ${entry.frontName}`);
  params.set("openFindings", String(entry.qualityOpenFindings));
  params.set("releaseReadiness", String(entry.qualityReleaseReadiness));

  const nextAction = nextActionDraft.trim() || entry.nextAction;
  if (nextAction.trim()) {
    params.set("nextAction", nextAction.trim());
  }

  return `/quality?${params.toString()}`;
}

function buildOperationsHrefFromDailyLog(entry: DailyLogEntryContract | null, nextActionDraft: string) {
  if (!entry?.projectName?.trim()) {
    return "/operations";
  }

  const params = new URLSearchParams({
    source: "daily-log",
    projectName: entry.projectName
  });

  if (entry.frontName.trim()) {
    params.set("frontName", entry.frontName.trim());
  }

  if (entry.supervisor.trim()) {
    params.set("owner", entry.supervisor.trim());
  }

  params.set("pendingDestajo", String(entry.pendingDestajo));
  params.set("subcontractHealth", entry.subcontractHealth);

  const nextAction = nextActionDraft.trim() || entry.nextAction;
  if (nextAction.trim()) {
    params.set("nextAction", nextAction.trim());
  }

  return `/operations?${params.toString()}`;
}

function buildDailyLogOperationalLinks(entry: DailyLogEntryContract | null, nextActionDraft: string, t: Translate) {
  if (!entry) {
    return [
      { label: t("Abrir campo", "Open field"), href: "/field" },
      { label: t("Abrir operaciones", "Open operations"), href: "/operations" },
      { label: t("Abrir equipo", "Open equipment"), href: "/equipment" }
    ];
  }

  if (entry.blockersCount > 0 || entry.status === "flagged") {
    return [
      { label: t("Abrir campo", "Open field"), href: "/field" },
      { label: t("Abrir operaciones", "Open operations"), href: buildOperationsHrefFromDailyLog(entry, nextActionDraft) },
      { label: t("Abrir calidad", "Open quality"), href: "/quality" }
    ];
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return [
      { label: t("Abrir calidad", "Open quality"), href: buildQualityHrefFromDailyLog(entry, nextActionDraft) },
      { label: t("Abrir campo", "Open field"), href: "/field" },
      { label: t("Abrir operaciones", "Open operations"), href: buildOperationsHrefFromDailyLog(entry, nextActionDraft) }
    ];
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return [
      { label: t("Abrir operaciones", "Open operations"), href: buildOperationsHrefFromDailyLog(entry, nextActionDraft) },
      { label: t("Abrir campo", "Open field"), href: "/field" },
      { label: t("Abrir equipo", "Open equipment"), href: "/equipment" }
    ];
  }

  return [
    { label: t("Abrir equipo", "Open equipment"), href: "/equipment" },
    { label: t("Abrir campo", "Open field"), href: "/field" },
    { label: t("Abrir operaciones", "Open operations"), href: buildOperationsHrefFromDailyLog(entry, nextActionDraft) }
  ];
}

function buildDailyLogRouteDesk(entry: DailyLogEntryContract | null, nextActionDraft: string, t: Translate) {
  if (!entry) {
    return {
      primaryLink: {
        label: t("Abrir bitácora", "Open daily log"),
        href: "/daily-log",
        reason: t("Selecciona una bitácora para definir quién toma el siguiente turno.", "Select a daily log to define who takes the next shift.")
      },
      secondaryLink: {
        label: t("Abrir campo", "Open field"),
        href: "/field",
        reason: t("Cuando exista un frente activo, aquí se aclarará el segundo salto operativo.", "Once an active front exists, this will clarify the secondary operational jump.")
      },
      returnRule: t("Vuelve con dueño, evidencia y condición de continuidad ya confirmados.", "Return with owner, evidence and continuation condition already confirmed.")
    };
  }

  if (entry.blockersCount > 0 || entry.status === "flagged") {
    return {
      primaryLink: {
        label: t("Escalar en campo", "Escalate in field"),
        href: "/field",
        reason: t("El frente sigue bloqueado y la contención principal todavía debe vivir con la cuadrilla en campo.", "The front is still blocked and primary containment still belongs with the crew in field.")
      },
      secondaryLink: {
        label: t("Abrir operaciones", "Open operations"),
        href: buildOperationsHrefFromDailyLog(entry, nextActionDraft),
        reason: t("Después de contener el bloqueo, operaciones debe absorber coordinación, destajo o presión transversal del frente.", "After containing the blocker, operations should absorb coordination, destajo or cross-domain pressure from the front.")
      },
      returnRule: t("Vuelve cuando el bloqueo tenga dueño, contención explícita y decisión clara de arranque o espera.", "Return once the blocker has an owner, explicit containment and a clear go-or-wait decision.")
    };
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return {
      primaryLink: {
        label: t("Enviar a calidad", "Route to quality"),
        href: buildQualityHrefFromDailyLog(entry, nextActionDraft),
        reason: t("La liberación del turno sigue débil y calidad debe tomar primero la corrección o la reinspección.", "Shift release is still weak and quality should take corrective work or reinspection first.")
      },
      secondaryLink: {
        label: t("Abrir campo", "Open field"),
        href: "/field",
        reason: t("Campo debe ejecutar la corrección y regresar con evidencia suficiente para que calidad no reconstruya la historia del turno.", "Field should execute the correction and come back with enough evidence so quality does not have to rebuild the shift story.")
      },
      returnRule: t("Vuelve cuando calidad y campo dejen explícitos los hallazgos resueltos y la nueva postura de liberación.", "Return once quality and field make the resolved findings and new release posture explicit.")
    };
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return {
      primaryLink: {
        label: t("Coordinar en operaciones", "Coordinate in operations"),
        href: buildOperationsHrefFromDailyLog(entry, nextActionDraft),
        reason: t("La presión real está en subcontrato o destajo y operaciones debe ordenar la recuperación antes del siguiente turno.", "Real pressure sits in subcontract or destajo posture, so operations should organize recovery before the next shift.")
      },
      secondaryLink: {
        label: t("Abrir campo", "Open field"),
        href: "/field",
        reason: t("Campo confirma si el frente sigue ejecutable una vez que operaciones reasigne dueño, cuadrilla o prioridad.", "Field confirms whether the front remains executable once operations reassigns owner, crew or priority.")
      },
      returnRule: t("Vuelve cuando la presión de subcontrato tenga responsable, recuperación asignada y efecto claro sobre el turno siguiente.", "Return once subcontract pressure has a clear owner, assigned recovery and a concrete effect on the next shift.")
    };
  }

  return {
    primaryLink: {
      label: t("Revisar equipo", "Check equipment"),
      href: "/equipment",
      reason: t("Si el frente ya no está bloqueado, el siguiente control útil es confirmar la continuidad real de activos.", "If the front is no longer blocked, the next useful control is confirming real asset continuity.")
    },
    secondaryLink: {
      label: t("Abrir campo", "Open field"),
      href: "/field",
      reason: t("Después de equipo, campo debe confirmar que el relevo puede correr sin reconstruir contexto del turno.", "After equipment, field should confirm the handoff can continue without rebuilding shift context.")
    },
    returnRule: t("Vuelve con liberación de activos confirmada y siguiente acción lista para el nuevo relevo.", "Return with asset release confirmed and the next action ready for the new handoff.")
  };
}

function buildDailyLogOrderedLinks(entry: DailyLogEntryContract | null, nextActionDraft: string, t: Translate) {
  const routeDesk = buildDailyLogRouteDesk(entry, nextActionDraft, t);
  const links = [
    { label: routeDesk.primaryLink.label, href: routeDesk.primaryLink.href },
    { label: routeDesk.secondaryLink.label, href: routeDesk.secondaryLink.href },
    ...buildDailyLogOperationalLinks(entry, nextActionDraft, t)
  ];

  return links.filter((link, index, array) => array.findIndex((candidate) => candidate.href === link.href) === index);
}

function buildDailyLogSchedulePhase(entry: DailyLogEntryContract) {
  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return "Calidad";
  }

  if (entry.blockersCount > 0 || entry.status === "flagged") {
    return "Recuperación";
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return "Coordinación";
  }

  return "Ejecución";
}

function buildDailyLogScheduleHref(entry: DailyLogEntryContract | null, nextActionDraft: string) {
  if (!entry?.projectName?.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    projectName: entry.projectName,
    scheduleActivityName: entry.frontName,
    schedulePhase: buildDailyLogSchedulePhase(entry),
    scheduleOwner: entry.supervisor,
    scheduleNextAction: nextActionDraft.trim() || entry.nextAction
  });

  return `/projects?${params.toString()}`;
}

function buildCreateDailyLogGate(
  input: {
    projectName: string;
    frontName: string;
    supervisor: string;
    logDate: string;
    progressPercent: number;
    workforceCount: number;
    blockersCount: number;
    incidentsCount: number;
    evidenceCount: number;
    concretePourM3: number;
    status: DailyLogEntryContract["status"];
    qualityOpenFindings: number;
    qualityReleaseReadiness: number;
    pendingDestajo: number;
    nextAction: string;
  },
  t: Translate
) {
  const checks: string[] = [];

  if ([input.projectName, input.frontName, input.supervisor].some((value) => value.trim().length < 3)) {
    checks.push(t("Proyecto, frente y supervisor todavía requieren captura específica.", "Project, front and supervisor still need specific capture."));
  }

  if (!input.logDate) {
    checks.push(t("Falta la fecha de la bitácora.", "Log date is still missing."));
  }

  if (!Number.isFinite(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100) {
    checks.push(t("El avance debe permanecer entre 0 y 100.", "Progress must stay between 0 and 100."));
  }

  if (![input.workforceCount, input.blockersCount, input.incidentsCount, input.evidenceCount].every((value) => Number.isFinite(value) && value >= 0)) {
    checks.push(t("Cuadrilla, bloqueos, incidentes y evidencia deben ser números válidos no negativos.", "Crew, blockers, incidents and evidence must be valid non-negative numbers."));
  }

  if (!Number.isFinite(input.concretePourM3) || input.concretePourM3 < 0) {
    checks.push(t("El volumen de concreto debe ser un número válido no negativo.", "Concrete volume must be a valid non-negative number."));
  }

  if (!Number.isFinite(input.qualityOpenFindings) || input.qualityOpenFindings < 0) {
    checks.push(t("Los hallazgos de calidad deben ser un número válido no negativo.", "Quality findings must be a valid non-negative number."));
  }

  if (!Number.isFinite(input.qualityReleaseReadiness) || input.qualityReleaseReadiness < 0 || input.qualityReleaseReadiness > 100) {
    checks.push(t("La liberación debe permanecer entre 0 y 100.", "Release readiness must stay between 0 and 100."));
  }

  if (!Number.isFinite(input.pendingDestajo) || input.pendingDestajo < 0) {
    checks.push(t("El destajo pendiente debe ser un número válido no negativo.", "Pending destajo must be a valid non-negative number."));
  }

  if (input.status === "approved" && input.blockersCount > 0) {
    checks.push(t("No se puede crear aprobada mientras existan bloqueos abiertos.", "Approved status is blocked while blockers remain open."));
  }

  if (input.status === "approved" && input.evidenceCount < 4) {
    checks.push(t("El estado aprobado requiere al menos 4 evidencias.", "Approved status requires at least 4 evidence items."));
  }

  if (input.nextAction.trim().length < 8) {
    checks.push(t("La siguiente acción necesita suficiente detalle para el próximo turno o módulo.", "Next action still needs enough detail for the next shift or module."));
  }

  if (checks.length > 0) {
    const hardBlock =
      (input.status === "approved" && input.blockersCount > 0) ||
      (input.status === "approved" && input.evidenceCount < 4);

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? t("No crear todavía", "Do not create yet") : t("Crear con control", "Create with control"),
      summary: hardBlock
        ? t("Esta bitácora nacería con un bloqueo duro de supervisión.", "This daily log would open with a hard supervision blocker.")
        : t("La bitácora puede crearse, pero el relevo del turno aún necesita ajuste.", "The log can be created, but the shift handoff still needs tightening."),
      checks
    };
  }

  return {
    tone: "success" as const,
    label: t("Lista para crear", "Ready to create"),
    summary: t("La bitácora ya tiene estructura suficiente para entrar limpia a supervisión diaria.", "The log has enough structure to enter daily supervision cleanly."),
    checks: [
      t("La bitácora creada se volverá el foco actual de inmediato.", "The created log will become the current focus entry immediately."),
      t("Mantén explícitos bloqueos, evidencia y siguiente acción desde la primera captura.", "Keep blockers, evidence and next action explicit from the first capture.")
    ]
  };
}

function buildCreateDailyLogHumanStep(
  input: {
    blockersCount: number;
    qualityOpenFindings: number;
    qualityReleaseReadiness: number;
    evidenceCount: number;
    pendingDestajo: number;
    nextAction: string;
  },
  t: Translate
) {
  if (input.blockersCount > 0) {
    return t("Aclara quién toma el bloqueo y si el siguiente turno queda protegido antes de guardar.", "Clarify who owns the blocker and whether the next shift is protected before saving this log.");
  }

  if (input.qualityOpenFindings > 2 || input.qualityReleaseReadiness < 75) {
    return t("Aclara quién toma la corrección de calidad antes de tratar este turno como continuidad limpia.", "Clarify who owns corrective quality work before this shift is treated as ready for clean continuation.");
  }

  if (input.evidenceCount < 4) {
    return t("Completa el paquete mínimo de evidencia antes de esperar un relevo limpio de supervisión.", "Complete the minimum evidence package before expecting a clean supervision handoff.");
  }

  if (input.pendingDestajo > 0) {
    return t("Di a operaciones cómo se contendrá la presión de subcontrato o destajo antes del siguiente turno.", "Tell operations how the subcontract or destajo pressure will be contained before the next shift.");
  }

  if (input.nextAction.trim().length < 8) {
    return t("Reescribe la siguiente acción para que el siguiente supervisor continúe sin pedir contexto.", "Rewrite the next action so the next supervisor can continue without asking for more context.");
  }

  return t("Crea la bitácora y continúa directo a revisión, campo u operaciones con una historia limpia del turno.", "Create the log and continue directly into review, field follow-up or operations with a clean shift story.");
}

function actionGuard(entry: DailyLogEntryContract, status: DailyLogEntryContract["status"], t: Translate) {
  if (status === "approved" && entry.evidenceCount < 4) {
    return t("Requiere al menos 4 evidencias antes de aprobar.", "Requires at least 4 evidence items before approval.");
  }

  if (status === "approved" && entry.blockersCount > 0) {
    return t("No puede aprobarse mientras existan bloqueos abiertos.", "Cannot be approved while blockers remain open.");
  }

  return null;
}

export default function DailyLogPage() {
  const { activeCompany, apiBaseUrl, session, source, uiLanguage, localizeText } = useAppState();
  const t = useCallback((es: string, en: string) => localizeText({ es, en }), [localizeText]);
  const searchParams = useSearchParams();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const contextualPreload = useMemo(() => buildDailyLogContextualPreload(searchParams), [searchParams]);
  const [overview, setOverview] = useState<DailyLogOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<DailyLogEquipmentBridge>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | DailyLogEntryContract["status"]>("all");
  const [shiftFilter, setShiftFilter] = useState<"all" | DailyLogEntryContract["shift"]>("all");
  const [weatherFilter, setWeatherFilter] = useState<"all" | DailyLogEntryContract["weather"]>("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [workspaceView, setWorkspaceView] = useState<"control" | "capture" | "queue">("control");
  const [createForm, setCreateForm] = useState<DailyLogCreateForm>(createDefaultCreateForm);
  const [activeContextualPreload, setActiveContextualPreload] = useState<DailyLogContextualPreload | null>(null);
  const contextualPreloadRef = useRef<{
    formApplied: boolean;
    selectionApplied: boolean;
    selectedEntryId: string | null;
    nextAction: string | null;
  }>({
    formApplied: false,
    selectionApplied: false,
    selectedEntryId: null,
    nextAction: null
  });
  const createFormNumbers = useMemo(
    () => ({
      progressPercent: Number(createForm.progressPercent),
      workforceCount: Number(createForm.workforceCount),
      blockersCount: Number(createForm.blockersCount),
      incidentsCount: Number(createForm.incidentsCount),
      evidenceCount: Number(createForm.evidenceCount),
      concretePourM3: Number(createForm.concretePourM3),
      qualityOpenFindings: Number(createForm.qualityOpenFindings),
      qualityReleaseReadiness: Number(createForm.qualityReleaseReadiness),
      pendingDestajo: Number(createForm.pendingDestajo)
    }),
    [
      createForm.blockersCount,
      createForm.concretePourM3,
      createForm.evidenceCount,
      createForm.incidentsCount,
      createForm.pendingDestajo,
      createForm.progressPercent,
      createForm.qualityOpenFindings,
      createForm.qualityReleaseReadiness,
      createForm.workforceCount
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchDailyLogOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchEquipmentOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, equipment]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError(t("La vista de bitácora no está disponible por ahora.", "Daily log overview is unavailable right now."));
          return;
        }

        setOverview(result);
        setSelectedEntryId((current) => current ?? result.focusEntry?.id ?? result.entries[0]?.id ?? null);
        setBridgeContext(equipment ? { equipment } : null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, session.accessToken, t]);

  useEffect(() => {
    if (!contextualPreload) {
      return;
    }

    setActiveContextualPreload(contextualPreload);

    if (!contextualPreloadRef.current.formApplied) {
      contextualPreloadRef.current.formApplied = true;
      setCreateForm((current) => ({
        ...current,
        projectName: contextualPreload.projectName || current.projectName,
        frontName: contextualPreload.frontName || current.frontName,
        supervisor: contextualPreload.supervisor || current.supervisor,
        nextAction: contextualPreload.nextAction || current.nextAction,
        qualityOpenFindings: contextualPreload.qualityOpenFindings || current.qualityOpenFindings,
        qualityReleaseReadiness: contextualPreload.qualityReleaseReadiness || current.qualityReleaseReadiness
      }));
    }

    if (!overview || contextualPreloadRef.current.selectionApplied) {
      return;
    }

    contextualPreloadRef.current.selectionApplied = true;
    const relatedEntry = findRelatedDailyLogEntry(overview, contextualPreload);

    if (relatedEntry) {
      contextualPreloadRef.current.selectedEntryId = relatedEntry.id;
      contextualPreloadRef.current.nextAction = contextualPreload.nextAction || null;
      setSelectedEntryId(relatedEntry.id);
      setWorkspaceView("control");
    }
  }, [contextualPreload, overview]);

  const filteredEntries = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedProject = projectFilter.trim().toLowerCase();
    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.entries.filter((entry) => {
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      const matchesShift = shiftFilter === "all" || entry.shift === shiftFilter;
      const matchesWeather = weatherFilter === "all" || entry.weather === weatherFilter;
      const matchesProject =
        normalizedProject.length === 0 ||
        entry.projectName.toLowerCase().includes(normalizedProject) ||
        entry.frontName.toLowerCase().includes(normalizedProject);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        entry.supervisor.toLowerCase().includes(normalizedSearch) ||
        entry.nextAction.toLowerCase().includes(normalizedSearch) ||
        entry.frontName.toLowerCase().includes(normalizedSearch) ||
        entry.projectName.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesShift && matchesWeather && matchesProject && matchesSearch;
    });
  }, [overview, projectFilter, searchFilter, shiftFilter, statusFilter, weatherFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredEntries), [filteredEntries]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedEntryId) ?? filteredEntries[0] ?? null,
    [filteredEntries, selectedEntryId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.logId === selectedEntry?.id) ?? [],
    [overview, selectedEntry]
  );

  const selectedStory = useMemo(() => buildDailyLogEquipmentStory(selectedEntry, bridgeContext, t), [bridgeContext, selectedEntry, t]);
  const approvalReadiness = useMemo(() => buildApprovalReadiness(selectedEntry, t), [selectedEntry, t]);
  const escalationDestination = useMemo(
    () => buildEscalationDestination(selectedEntry, nextActionDraft, t),
    [nextActionDraft, selectedEntry, t]
  );
  const downstreamReadiness = useMemo(() => buildDownstreamReadiness(selectedEntry, t), [selectedEntry, t]);
  const selectedWhyNow = useMemo(() => buildDailyLogWhyNow(selectedEntry, t), [selectedEntry, t]);
  const selectedHumanStep = useMemo(() => buildDailyLogHumanStep(selectedEntry, t), [selectedEntry, t]);
  const selectedReportBack = useMemo(() => buildDailyLogReportBack(selectedEntry, t), [selectedEntry, t]);
  const selectedRouteSummary = useMemo(() => buildDailyLogRouteSummary(selectedEntry, t), [selectedEntry, t]);
  const selectedRouteDesk = useMemo(
    () => buildDailyLogRouteDesk(selectedEntry, nextActionDraft, t),
    [nextActionDraft, selectedEntry, t]
  );
  const selectedOrderedOperationalLinks = useMemo(
    () => buildDailyLogOrderedLinks(selectedEntry, nextActionDraft, t),
    [nextActionDraft, selectedEntry, t]
  );
  const selectedScheduleHref = useMemo(() => buildDailyLogScheduleHref(selectedEntry, nextActionDraft), [nextActionDraft, selectedEntry]);
  const entryActions = useMemo(() => (selectedEntry ? actionOptions(selectedEntry, t) : []), [selectedEntry, t]);
  const createGate = useMemo(
    () =>
      buildCreateDailyLogGate(
        {
          projectName: createForm.projectName,
          frontName: createForm.frontName,
          supervisor: createForm.supervisor,
          logDate: createForm.logDate,
          progressPercent: createFormNumbers.progressPercent,
          workforceCount: createFormNumbers.workforceCount,
          blockersCount: createFormNumbers.blockersCount,
          incidentsCount: createFormNumbers.incidentsCount,
          evidenceCount: createFormNumbers.evidenceCount,
          concretePourM3: createFormNumbers.concretePourM3,
          status: createForm.status,
          qualityOpenFindings: createFormNumbers.qualityOpenFindings,
          qualityReleaseReadiness: createFormNumbers.qualityReleaseReadiness,
          pendingDestajo: createFormNumbers.pendingDestajo,
          nextAction: createForm.nextAction
        },
        t
      ),
    [createForm, createFormNumbers, t]
  );
  const createHumanStep = useMemo(
    () =>
      buildCreateDailyLogHumanStep(
        {
          blockersCount: createFormNumbers.blockersCount,
          qualityOpenFindings: createFormNumbers.qualityOpenFindings,
          qualityReleaseReadiness: createFormNumbers.qualityReleaseReadiness,
          evidenceCount: createFormNumbers.evidenceCount,
          pendingDestajo: createFormNumbers.pendingDestajo,
          nextAction: createForm.nextAction
        },
        t
      ),
    [createForm.nextAction, createFormNumbers, t]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredEntries.length === 0) {
      setSelectedEntryId(null);
      return;
    }

    const isSelectedVisible = filteredEntries.some((entry) => entry.id === selectedEntryId);
    if (!isSelectedVisible) {
      setSelectedEntryId(filteredEntries[0]?.id ?? null);
    }
  }, [filteredEntries, overview, selectedEntryId]);

  useEffect(() => {
    if (
      selectedEntry?.id &&
      contextualPreloadRef.current.selectedEntryId === selectedEntry.id &&
      contextualPreloadRef.current.nextAction
    ) {
      setNextActionDraft(contextualPreloadRef.current.nextAction);
      contextualPreloadRef.current.selectedEntryId = null;
      contextualPreloadRef.current.nextAction = null;
    } else {
      setNextActionDraft(selectedEntry?.nextAction ?? "");
    }
    setActionError(null);
    setActionMessage(null);
  }, [selectedEntryId, selectedEntry?.id, selectedEntry?.nextAction]);

  const isContextuallySelectedEntry = Boolean(
    activeContextualPreload &&
      selectedEntry &&
      normalizeDailyLogValue(selectedEntry.projectName) === normalizeDailyLogValue(activeContextualPreload.projectName) &&
      normalizeDailyLogValue(selectedEntry.frontName) === normalizeDailyLogValue(activeContextualPreload.frontName)
  );

  async function handleAction(status: DailyLogEntryContract["status"], suggestedNextAction: string) {
    if (!selectedEntry) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError(t("La siguiente acción debe ser más específica antes de actualizar la bitácora.", "Next action must be more specific before updating the daily log."));
      return;
    }

    if (status === "approved" && selectedEntry.evidenceCount < 4) {
      setActionError(t("La bitácora necesita al menos 4 evidencias antes de aprobar.", "Daily log needs at least 4 evidence items before approval."));
      return;
    }

    if (status === "approved" && selectedEntry.blockersCount > 0) {
      setActionError(t("La bitácora no puede aprobarse mientras existan bloqueos abiertos.", "Daily log cannot be approved while blockers remain open."));
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateDailyLogEntry(
      selectedEntry.id,
      activeCompany.id,
      {
        status,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? t("Falló la actualización de la bitácora.", "Daily log update failed."));
      setIsSaving(false);
      return;
    }

    const updatedEntry = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const entries = current.entries.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry));

      return {
        ...current,
        summary: recomputeSummary(entries),
        entries,
        focusEntry: pickFocusEntry(entries)
      };
    });

    setNextActionDraft(updatedEntry.nextAction);
    setActionMessage(
      t(
        `Bitácora actualizada: ${localizeText(statusLabel(updatedEntry.status)).toLowerCase()} y relevo listo para seguimiento.`,
        `Daily log updated: now ${localizeText(statusLabel(updatedEntry.status)).toLowerCase()} and ready for follow-through.`
      )
    );
    setIsSaving(false);
  }

  async function handleCreateEntry() {
    if (!overview) {
      return;
    }

    const projectName = createForm.projectName.trim();
    const frontName = createForm.frontName.trim();
    const supervisor = createForm.supervisor.trim();
    const nextAction = createForm.nextAction.trim();

    if (projectName.length < 3 || frontName.length < 3 || supervisor.length < 3) {
      setActionError(t("Proyecto, frente y supervisor deben ser específicos antes de crear la bitácora.", "Project, front and supervisor must be specific before creating the daily log."));
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError(t("La siguiente acción debe ser más específica antes de crear la bitácora.", "Next action must be more specific before creating the daily log."));
      setCreateMessage(null);
      return;
    }

    const progressPercent = Number(createForm.progressPercent);
    const workforceCount = Number(createForm.workforceCount);
    const blockersCount = Number(createForm.blockersCount);
    const incidentsCount = Number(createForm.incidentsCount);
    const evidenceCount = Number(createForm.evidenceCount);
    const concretePourM3 = Number(createForm.concretePourM3);

    if (!createForm.logDate) {
      setActionError(t("La fecha es obligatoria antes de crear la bitácora.", "Log date is required before creating the daily log."));
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
      setActionError(t("El avance debe estar entre 0 y 100.", "Progress percent must be between 0 and 100."));
      setCreateMessage(null);
      return;
    }

    if (![workforceCount, blockersCount, incidentsCount, evidenceCount].every((value) => Number.isFinite(value) && value >= 0)) {
      setActionError(t("Cuadrilla, bloqueos, incidentes y evidencia deben ser números válidos no negativos.", "Crew, blockers, incidents and evidence must be valid non-negative numbers."));
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(concretePourM3) || concretePourM3 < 0) {
      setActionError(t("El volumen de concreto debe ser un número válido no negativo.", "Concrete volume must be a valid non-negative number."));
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createDailyLogEntry(
      activeCompany.id,
      {
        projectName,
        frontName,
        supervisor,
        logDate: createForm.logDate,
        shift: createForm.shift,
        weather: createForm.weather,
        status: createForm.status,
        progressPercent,
        workforceCount,
        incidentsCount,
        blockersCount,
        evidenceCount,
        concretePourM3,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? t("Falló la creación de la bitácora.", "Daily log creation failed."));
      setIsCreating(false);
      return;
    }

    const newEntry = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const entries = [newEntry, ...current.entries];
      return {
        ...current,
        summary: recomputeSummary(entries),
        entries,
        focusEntry: pickFocusEntry(entries)
      };
    });
    setSelectedEntryId(newEntry.id);
    setNextActionDraft(newEntry.nextAction);
    setCreateMessage(
      t(
        `${frontName} quedó registrada y ya está al frente de la cola operativa.`,
        `${frontName} was logged and is now leading the operating queue.`
      )
    );
    setWorkspaceView("control");
    setCreateForm((current) => ({
      ...current,
      frontName,
      projectName,
      supervisor,
      logDate: new Date().toISOString().slice(0, 10),
      status: "draft",
      progressPercent: "0",
      workforceCount: "18",
      incidentsCount: "0",
      blockersCount: "0",
      evidenceCount: "4",
      concretePourM3: "0",
      qualityOpenFindings: "0",
      qualityReleaseReadiness: "92",
      pendingDestajo: "0",
      nextAction: ""
    }));
    setIsCreating(false);
  }

  return (
    <AppShell
      title={{ es: "Bitácora diaria", en: "Daily log" }}
      eyebrow={{ es: "Ejecución de campo", en: "Field execution" }}
      description={{
        es: "Puesto de mando para capturar el turno, ordenar bloqueos y dejar el siguiente movimiento claro para campo y supervisión.",
        en: "Operator console for capturing the shift, sorting blockers and leaving the next move clear for field and supervision."
      }}
    >
      <ModuleGate moduleKeys={["projects.daily-log"]} requiredPermissions={["projects:*"]} title="Daily log">
        {overview ? (
          <div className="stack" lang={uiLanguage}>
            <section className="grid cols4">
              <KpiCard label={t("Enviadas hoy", "Submitted today")} value={String(filteredSummary.submittedToday)} footnote={t("visibles fuera de borrador", "visible outside draft")} />
              <KpiCard label={t("Aprobadas", "Approved logs")} value={String(filteredSummary.approvedLogs)} footnote={t("liberadas por supervisión", "released by supervision")} />
              <KpiCard label={t("Marcadas", "Flagged logs")} value={String(filteredSummary.flaggedLogs)} footnote={t("requieren contención", "require containment")} />
              <KpiCard label={t("Evidencia pendiente", "Pending evidence")} value={String(filteredSummary.pendingEvidence)} footnote={t("deuda visible del subconjunto", "visible subset debt")} />
              <KpiCard label={t("Riesgo de ejecución", "Execution risk")} value={String(filteredSummary.executionRiskLogs)} footnote={t("frentes con riesgo activo", "fronts with active risk")} />
            </section>

            <div className="projectWorkspaceTabs" role="tablist" aria-label={t("Vistas de bitácora", "Daily log views")}>
              {([
                ["control", t("Control", "Control")],
                ["capture", t("Captura", "Capture")],
                ["queue", t("Mesa amplia", "Wide table")]
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={workspaceView === view}
                  className={`projectWorkspaceTab ${workspaceView === view ? "projectWorkspaceTabActive" : ""}`}
                  onClick={() => setWorkspaceView(view)}
                >
                  {label}
                </button>
              ))}
            </div>

            {workspaceView === "control" ? (
            <section className="grid cols2">
              <Card
                title={selectedEntry ? selectedEntry.frontName : t("Selecciona una bitácora activa", "Select an active log")}
                description={
                  selectedEntry
                    ? `${selectedEntry.projectName} · ${selectedEntry.logDate} · ${selectedEntry.supervisor}`
                    : t("Abre un frente de la cola para capturar decisiones del turno y dejar el relevo listo.", "Open a front from the queue to record shift decisions and leave the handoff ready.")
                }
                aside={
                  selectedEntry ? (
                    <div className="tableCellStack">
                      {isContextuallySelectedEntry && activeContextualPreload ? (
                        <Badge tone="info">
                          {activeContextualPreload.source === "quality"
                            ? t("Precargado desde calidad", "Preloaded from quality")
                            : t("Precargado desde campo", "Preloaded from field")}
                        </Badge>
                      ) : null}
                      <Badge tone={statusTone(selectedEntry.status)}>{localizeText(statusLabel(selectedEntry.status))}</Badge>
                    </div>
                  ) : null
                }
              >
                {selectedEntry ? (
                  <div className="stack">
                    <p className="tableCellMuted">
                      {t(
                        "Usa este panel como tablero del turno: confirma avance, corrige la siguiente acción y mueve la bitácora sólo cuando el relevo quede operable.",
                        "Use this panel as the live shift board: confirm progress, tighten the next action and move the log only when the handoff is operational."
                      )}
                    </p>

                    <div className="row gap wrap">
                      <Badge tone="info">{t("Turno", "Shift")}: {localizeText(shiftLabel(selectedEntry.shift))}</Badge>
                      <Badge tone="info">{t("Clima", "Weather")}: {localizeText(weatherLabel(selectedEntry.weather))}</Badge>
                      <Badge tone={projectStatusTone(selectedEntry.projectStatus)}>{localizeText(projectStatusLabel(selectedEntry.projectStatus))}</Badge>
                      <Badge tone={subcontractHealthTone(selectedEntry.subcontractHealth)}>{localizeText(subcontractHealthLabel(selectedEntry.subcontractHealth))}</Badge>
                    </div>

                    <div className="grid cols3">
                      <KpiCard label={t("Avance", "Progress")} value={`${selectedEntry.progressPercent}%`} footnote={`${selectedEntry.concretePourM3} m3`} />
                      <KpiCard label={t("Cuadrilla", "Crew")} value={String(selectedEntry.workforceCount)} footnote={t("personal en sitio", "people on site")} />
                      <KpiCard label={t("Evidencia", "Evidence")} value={String(selectedEntry.evidenceCount)} footnote={t("items capturados", "captured items")} />
                    </div>

                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">{t("Bloqueos / Incidencias", "Blockers / Incidents")}</div>
                        <div>{selectedEntry.blockersCount} / {selectedEntry.incidentsCount}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Calidad", "Quality")}</div>
                        <div>{selectedEntry.qualityOpenFindings} {t("hallazgos abiertos", "open findings")} · {selectedEntry.qualityReleaseReadiness}% {t("liberación", "readiness")}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Señal subcontrato", "Subcontract signal")}</div>
                        <div>MXN {selectedEntry.pendingDestajo.toLocaleString()} · {localizeText(subcontractHealthLabel(selectedEntry.subcontractHealth))}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Estado actual", "Current status")}</div>
                        <div className="tableCellStack">
                          <Badge tone={approvalReadiness.tone}>{approvalReadiness.label}</Badge>
                          <span className="tableCellMuted">{approvalReadiness.description}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                        <div>{selectedHumanStep}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Módulo responsable", "Responsible module")}</div>
                        <div className="tableCellStack">
                          <strong>{selectedRouteDesk.primaryLink.label}</strong>
                          <span className="tableCellMuted">{selectedRouteDesk.primaryLink.reason}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Segundo salto", "Secondary jump")}</div>
                        <div className="tableCellStack">
                          <strong>{selectedRouteDesk.secondaryLink.label}</strong>
                          <span className="tableCellMuted">{selectedRouteDesk.secondaryLink.reason}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Compromiso al volver", "Return commitment")}</div>
                        <div>{selectedRouteDesk.returnRule}</div>
                      </div>
                      {isContextuallySelectedEntry && activeContextualPreload ? (
                        <div className="detailRow">
                          <div className="detailLabel">{t("Contexto recibido", "Received context")}</div>
                          <div className="tableCellStack">
                            <strong>
                              {activeContextualPreload.source === "quality"
                                ? t("La inspección de calidad ya aterrizó este frente en bitácora.", "The quality inspection already landed this front in daily log.")
                                : t("La captura de campo ya aterrizó este frente en bitácora.", "The field capture already landed this front in daily log.")}
                            </strong>
                            <span className="tableCellMuted">
                              {[activeContextualPreload.projectName, activeContextualPreload.frontName].filter(Boolean).join(" · ")}
                            </span>
                            {activeContextualPreload.supervisor ? (
                              <span className="tableCellMuted">
                                {t("Responsable sugerido", "Suggested owner")}: {activeContextualPreload.supervisor}
                              </span>
                            ) : null}
                            {activeContextualPreload.nextAction ? (
                              <span className="tableCellMuted">
                                {t("Siguiente acción sugerida", "Suggested next action")}: {activeContextualPreload.nextAction}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      <div className="detailRow">
                        <div className="detailLabel">{t("Equipo", "Equipment")}</div>
                        <div className="tableCellStack">
                          <span>{selectedStory?.equipmentSupport ?? t("Sin lectura de equipo.", "No equipment reading available.")}</span>
                          <span className="tableCellMuted">{selectedStory?.executionConstraint}</span>
                          <span className="tableCellMuted">{selectedStory?.nextEquipmentMove}</span>
                        </div>
                      </div>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="daily-log-next-action">
                        {t("Siguiente acción para el relevo", "Next action for handoff")}
                      </label>
                      <p className="tableCellMuted">
                        {t(
                          "Escribe qué sigue, quién lo toma y qué condición debe quedar resuelta antes del siguiente corte operativo.",
                          "Write what happens next, who owns it and what must be resolved before the next operating cutoff."
                        )}
                      </p>
                      <textarea
                        id="daily-log-next-action"
                        className="textarea"
                        rows={4}
                        lang={uiLanguage}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder={t(
                          "Ej. Cerrar colado del eje B, subir evidencia final y liberar revisión con residente de noche.",
                          "Example: Close pour on grid B, upload final evidence and release review with the night resident engineer."
                        )}
                      />
                    </div>

                    <div className="stack">
                      <p className="tableCellMuted">
                        {t(
                          "Elige la acción que realmente deja el frente listo para el siguiente dueño. Si el botón se bloquea, corrige primero la evidencia o los bloqueos.",
                          "Pick the action that truly leaves the front ready for its next owner. If a button is blocked, fix evidence or blockers first."
                        )}
                      </p>
                      <div className="row gap wrap">
                        {entryActions.map((action) => {
                          const guard = actionGuard(selectedEntry, action.status, t);
                          return (
                            <button
                              key={action.label}
                              type="button"
                              className="button secondary"
                              onClick={() => void handleAction(action.status, action.nextAction)}
                              disabled={isSaving || Boolean(guard)}
                              title={guard ?? undefined}
                            >
                              {isSaving ? t("Guardando...", "Saving...") : action.label}
                            </button>
                          );
                        })}
                      </div>
                      {entryActions.map((action) => {
                        const guard = actionGuard(selectedEntry, action.status, t);
                        return guard ? <p key={action.label} className="tableCellMuted">{action.label}: {guard}</p> : null;
                      })}
                    </div>

                    <div className="row gap wrap">
                      <Link className="button" href={selectedOrderedOperationalLinks[0]?.href ?? escalationDestination.href}>
                        {selectedOrderedOperationalLinks[0]
                          ? t(`Ir primero a ${selectedOrderedOperationalLinks[0].label}`, `Go first to ${selectedOrderedOperationalLinks[0].label}`)
                          : escalationDestination.label}
                      </Link>
                      {selectedScheduleHref ? (
                        <Link className="buttonGhost" href={selectedScheduleHref}>
                          {t("Escalar al programa", "Escalate to schedule")}
                        </Link>
                      ) : null}
                      <button type="button" className="buttonGhost" onClick={() => setWorkspaceView("capture")}>
                        {t("Registrar nuevo frente", "Log new front")}
                      </button>
                      {selectedOrderedOperationalLinks.slice(1).map((link) => (
                        <Link key={link.href + link.label} className="buttonGhost" href={link.href}>
                          {link.label}
                        </Link>
                      ))}
                    </div>

                    {actionError ? <p className="text-danger">{actionError}</p> : null}
                    {actionMessage ? <p className="text-success">{actionMessage}</p> : null}
                  </div>
                ) : (
                  <EmptyState
                    title={t("Sin frente en revisión", "No front under review")}
                    description={t(
                      "Selecciona una bitácora de la cola para revisar evidencia, decidir el siguiente movimiento y cerrar el relevo del turno.",
                      "Select a log from the queue to review evidence, decide the next move and close the shift handoff."
                    )}
                  />
                )}
              </Card>

              <Card
                title={t("Cola de frentes", "Front queue")}
                description={t(
                  "Ordena la revisión del día y entra al frente correcto sin perder tiempo en la tabla completa.",
                  "Sort today’s review and jump into the right front without losing time in the full table."
                )}
                aside={<Badge tone={isLoading ? "info" : isDemoMode ? "warning" : "success"}>{isLoading ? t("Actualizando", "Refreshing") : isDemoMode ? t("Demo operable", "Operable demo") : t("Backend vivo", "Live backend")}</Badge>}
              >
                <FilterBar summary={t(`${filteredEntries.length} frentes visibles en cola`, `${filteredEntries.length} fronts visible in queue`)}>
                  <label className="fieldLabel">
                    {t("Estado", "Status")}
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">{t("Todos", "All")}</option>
                      {(["draft", "submitted", "approved", "flagged"] as DailyLogEntryContract["status"][]).map((status) => (
                        <option key={status} value={status}>{localizeText(statusLabel(status))}</option>
                      ))}
                    </select>
                  </label>
                  <label className="fieldLabel">
                    {t("Turno", "Shift")}
                    <select className="field" value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value as typeof shiftFilter)}>
                      <option value="all">{t("Todos", "All")}</option>
                      {(["morning", "night", "mixed"] as DailyLogEntryContract["shift"][]).map((shift) => (
                        <option key={shift} value={shift}>{localizeText(shiftLabel(shift))}</option>
                      ))}
                    </select>
                  </label>
                  <label className="fieldLabel">
                    {t("Clima", "Weather")}
                    <select className="field" value={weatherFilter} onChange={(event) => setWeatherFilter(event.target.value as typeof weatherFilter)}>
                      <option value="all">{t("Todos", "All")}</option>
                      {(["clear", "windy", "rain", "storm"] as DailyLogEntryContract["weather"][]).map((weather) => (
                        <option key={weather} value={weather}>{localizeText(weatherLabel(weather))}</option>
                      ))}
                    </select>
                  </label>
                  <label className="fieldLabel">
                    {t("Proyecto / frente", "Project / front")}
                    <input
                      className="field"
                      type="search"
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                      placeholder={t("Ej. Torre Norte o Losa 3", "Example: North Tower or Slab 3")}
                    />
                  </label>
                  <label className="fieldLabel">
                    {t("Buscar", "Search")}
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder={t("Supervisor, frente o siguiente acción", "Supervisor, front or next action")}
                    />
                  </label>
                </FilterBar>

                {filteredEntries.length > 0 ? (
                  <div className="list">
                    {filteredEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className={`listItem ${selectedEntry?.id === entry.id ? "listItemSelected" : ""}`}
                        onClick={() => setSelectedEntryId(entry.id)}
                      >
                        <div>
                          <strong>{entry.frontName}</strong>
                          <p>{entry.projectName} · {localizeText(shiftLabel(entry.shift))} · {entry.progressPercent}%</p>
                          <p>{entry.workforceCount} {t("personas en sitio", "people on site")} · {entry.evidenceCount} {t("evidencias", "evidence items")} · {entry.blockersCount} {t("bloqueos", "blockers")}</p>
                        </div>
                        <Badge tone={statusTone(entry.status)}>{localizeText(statusLabel(entry.status))}</Badge>
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={t("La cola quedó vacía", "Queue is empty")}
                    description={t(
                      "Ajusta filtros o registra un nuevo frente para volver a tener algo operable en este turno.",
                      "Adjust filters or log a new front to get an operable item back into this shift."
                    )}
                  />
                )}
              </Card>
            </section>
            ) : null}

            {workspaceView === "capture" ? (
            <section className="grid cols2">
              <Card
                title={t("Registrar frente del turno", "Log the shift front")}
                description={t(
                  "Captura la historia mínima de campo para que supervisión y el siguiente relevo puedan continuar sin pedir contexto extra.",
                  "Capture the minimum field story so supervision and the next handoff can continue without asking for extra context."
                )}
              >
                <p className="tableCellMuted">
                  {t(
                    "Llena primero proyecto, frente, responsable y siguiente acción. Los presets sirven para arrancar rápido, pero la captura final debe hablar como el equipo en campo.",
                    "Fill project, front, owner and next action first. Presets help you start fast, but the final capture should read like the field team actually works."
                  )}
                </p>

                {activeContextualPreload ? (
                  <div className="detailRow" style={{ marginBottom: 16 }}>
                    <div className="detailLabel">{t("Contexto recibido", "Received context")}</div>
                    <div className="tableCellStack">
                      <Badge tone="info">
                        {activeContextualPreload.source === "quality"
                          ? t("Precargado desde calidad", "Preloaded from quality")
                          : t("Precargado desde campo", "Preloaded from field")}
                      </Badge>
                      <span>
                        {activeContextualPreload.source === "quality"
                          ? t(
                              "La bitácora ya trae proyecto, frente, responsable y señal de liberación desde calidad.",
                              "The log already brings project, front, owner and release signal from quality."
                            )
                          : t(
                              "La bitácora ya trae proyecto, frente, responsable y siguiente acción desde campo.",
                              "The log already brings project, front, owner and next action from field."
                            )}
                      </span>
                      <span className="tableCellMuted">
                        {[activeContextualPreload.projectName, activeContextualPreload.frontName].filter(Boolean).join(" · ")}
                      </span>
                      {activeContextualPreload.supervisor ? (
                        <span className="tableCellMuted">
                          {t("Responsable sugerido", "Suggested owner")}: {activeContextualPreload.supervisor}
                        </span>
                      ) : null}
                      {activeContextualPreload.nextAction ? (
                        <span className="tableCellMuted">
                          {t("Siguiente acción sugerida", "Suggested next action")}: {activeContextualPreload.nextAction}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDailyLogExample())}>
                    {t("Ejemplo guiado", "Guided example")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDefaultCreateForm())}>
                    {t("Nueva captura", "New capture")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDailyLogPreset("concrete_pour"))}>
                    {t("Preset colado", "Concrete pour preset")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDailyLogPreset("quality_hold"))}>
                    {t("Preset calidad", "Quality hold preset")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDailyLogPreset("equipment_delay"))}>
                    {t("Preset equipo", "Equipment delay preset")}
                  </button>
                </div>

                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">{t("Proyecto", "Project")}</div>
                    <input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} placeholder={t("Nombre del proyecto o paquete", "Project or package name")} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Frente / zona", "Front / zone")}</div>
                    <input className="field" value={createForm.frontName} onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))} placeholder={t("Ej. Muro perimetral norte", "Example: North perimeter wall")} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Responsable del turno", "Shift owner")}</div>
                    <input className="field" value={createForm.supervisor} onChange={(event) => setCreateForm((current) => ({ ...current, supervisor: event.target.value }))} placeholder={t("Nombre del residente o supervisor", "Resident engineer or supervisor name")} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Fecha del parte", "Log date")}</div>
                    <input className="field" type="date" value={createForm.logDate} onChange={(event) => setCreateForm((current) => ({ ...current, logDate: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Turno", "Shift")}</div>
                    <select className="selectField" value={createForm.shift} onChange={(event) => setCreateForm((current) => ({ ...current, shift: event.target.value as DailyLogEntryContract["shift"] }))}>
                      {(["morning", "night", "mixed"] as DailyLogEntryContract["shift"][]).map((shift) => (
                        <option key={shift} value={shift}>{localizeText(shiftLabel(shift))}</option>
                      ))}
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Clima", "Weather")}</div>
                    <select className="selectField" value={createForm.weather} onChange={(event) => setCreateForm((current) => ({ ...current, weather: event.target.value as DailyLogEntryContract["weather"] }))}>
                      {(["clear", "windy", "rain", "storm"] as DailyLogEntryContract["weather"][]).map((weather) => (
                        <option key={weather} value={weather}>{localizeText(weatherLabel(weather))}</option>
                      ))}
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Estado de arranque", "Starting status")}</div>
                    <select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as DailyLogEntryContract["status"] }))}>
                      {(["draft", "submitted", "approved", "flagged"] as DailyLogEntryContract["status"][]).map((status) => (
                        <option key={status} value={status}>{localizeText(statusLabel(status))}</option>
                      ))}
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Avance del frente %", "Front progress %")}</div>
                    <input className="field" type="number" min="0" max="100" value={createForm.progressPercent} onChange={(event) => setCreateForm((current) => ({ ...current, progressPercent: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Cuadrilla activa", "Active crew")}</div>
                    <input className="field" type="number" min="0" value={createForm.workforceCount} onChange={(event) => setCreateForm((current) => ({ ...current, workforceCount: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Bloqueos", "Blockers")}</div>
                    <input className="field" type="number" min="0" value={createForm.blockersCount} onChange={(event) => setCreateForm((current) => ({ ...current, blockersCount: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Incidencias", "Incidents")}</div>
                    <input className="field" type="number" min="0" value={createForm.incidentsCount} onChange={(event) => setCreateForm((current) => ({ ...current, incidentsCount: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Evidencia cargada", "Evidence logged")}</div>
                    <input className="field" type="number" min="0" value={createForm.evidenceCount} onChange={(event) => setCreateForm((current) => ({ ...current, evidenceCount: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Concreto m3", "Concrete m3")}</div>
                    <input className="field" type="number" min="0" value={createForm.concretePourM3} onChange={(event) => setCreateForm((current) => ({ ...current, concretePourM3: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Siguiente acción operativa", "Next operating action")}</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder={t(
                        "Ej. Reponer cimbra en eje 4 y avisar a calidad para liberar antes del turno noche",
                        "Example: Replace formwork on grid 4 and alert quality for release before night shift"
                      )}
                    />
                  </label>
                </div>

                <details className="captureDetails" style={{ marginTop: 16 }}>
                  <summary>{t("Datos operativos avanzados", "Advanced operational data")}</summary>
                  <div className="detailGrid" style={{ marginTop: 16 }}>
                    <label className="detailRow">
                      <div className="detailLabel">{t("Estado proyecto", "Project status")}</div>
                      <select className="selectField" value={createForm.projectStatus} onChange={(event) => setCreateForm((current) => ({ ...current, projectStatus: event.target.value as DailyLogEntryContract["projectStatus"] }))}>
                        {(["planning", "active", "at_risk", "blocked", "closed"] as DailyLogEntryContract["projectStatus"][]).map((status) => (
                          <option key={status} value={status}>{localizeText(projectStatusLabel(status))}</option>
                        ))}
                      </select>
                    </label>
                    <label className="detailRow">
                      <div className="detailLabel">{t("Hallazgos calidad", "Quality findings")}</div>
                      <input className="field" type="number" min="0" value={createForm.qualityOpenFindings} onChange={(event) => setCreateForm((current) => ({ ...current, qualityOpenFindings: event.target.value }))} />
                    </label>
                    <label className="detailRow">
                      <div className="detailLabel">{t("Liberación %", "Release readiness %")}</div>
                      <input className="field" type="number" min="0" max="100" value={createForm.qualityReleaseReadiness} onChange={(event) => setCreateForm((current) => ({ ...current, qualityReleaseReadiness: event.target.value }))} />
                    </label>
                    <label className="detailRow">
                      <div className="detailLabel">{t("Señal subcontrato", "Subcontract health")}</div>
                      <select className="selectField" value={createForm.subcontractHealth} onChange={(event) => setCreateForm((current) => ({ ...current, subcontractHealth: event.target.value as DailyLogEntryContract["subcontractHealth"] }))}>
                        {(["controlled", "watch", "critical", "unknown"] as DailyLogEntryContract["subcontractHealth"][]).map((status) => (
                          <option key={status} value={status}>{localizeText(subcontractHealthLabel(status))}</option>
                        ))}
                      </select>
                    </label>
                    <label className="detailRow">
                      <div className="detailLabel">{t("Destajo pendiente", "Pending destajo")}</div>
                      <input className="field" type="number" min="0" value={createForm.pendingDestajo} onChange={(event) => setCreateForm((current) => ({ ...current, pendingDestajo: event.target.value }))} />
                    </label>
                  </div>
                </details>

                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Chequeo antes de guardar", "Pre-save check")}</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createGate.tone}>{createGate.label}</Badge>
                        <span>{createGate.summary}</span>
                      </div>
                      {createGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">{check}</span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Instrucción para el relevo", "Handoff instruction")}</div>
                    <div>{createHumanStep}</div>
                  </div>
                </div>

                {actionError ? <p className="text-danger" style={{ marginTop: 16 }}>{actionError}</p> : null}

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateEntry()}>
                    {isCreating ? t("Guardando parte...", "Saving log...") : t("Registrar bitácora del turno", "Log shift entry")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setWorkspaceView("queue")}>
                    {t("Abrir mesa amplia", "Open wide table")}
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card
                title={t("Relieve y destino", "Handoff and routing")}
                description={t("Resume qué hacer ahora y a dónde debe saltar la operación.", "Summarize what to do now and where operations should jump next.")}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">{t("Por qué ahora", "Why now")}</div>
                    <div>{selectedWhyNow}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Ruta operativa", "Operational route")}</div>
                    <div>{selectedRouteSummary}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Regreso esperado", "Expected report-back")}</div>
                    <div>{selectedReportBack}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Destino recomendado", "Recommended route")}</div>
                    <div className="tableCellStack">
                      <strong>{escalationDestination.label}</strong>
                      <span className="tableCellMuted">{escalationDestination.description}</span>
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Lista para continuidad", "Downstream readiness")}</div>
                    <div className="tableCellStack">
                      <Badge tone={downstreamReadiness.tone}>{downstreamReadiness.label}</Badge>
                      <span className="tableCellMuted">{downstreamReadiness.summary}</span>
                      {downstreamReadiness.checks.map((check) => (
                        <span key={check} className="tableCellMuted">{check}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </section>
            ) : null}

            {workspaceView === "queue" ? (
              <section className="stack">
                {isDemoMode ? (
                  <Card
                    title={t("Modo demo operable", "Operable demo mode")}
                    description={t("Las bitácoras se pueden crear y mover localmente en este navegador.", "Daily logs can be created and moved across statuses locally in this browser.")}
                    aside={<Badge tone="warning">{t("persistencia local", "browser-persisted")}</Badge>}
                  >
                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">{t("Qué funciona", "What works")}</div>
                        <div>{t("Crear bitácoras, enviarlas o marcarlas, y probar reglas de evidencia y bloqueos.", "Create logs, submit or flag them, and test evidence or blocker rules.")}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Prueba sugerida", "Recommended test")}</div>
                        <div>{t("Crea una bitácora para un frente activo, envíala y confirma cómo salta a operaciones.", "Create a log for an active front, submit it and verify how it jumps into Operations.")}</div>
                      </div>
                    </div>
                  </Card>
                ) : null}

                <section className="grid cols3">
                  <Card title={t("Continuidad de bitácora", "Daily log continuity")} description={t("La bitácora debe sostener el puente entre campo, supervisión y seguimiento.", "The log should be the formal checkpoint between field execution, supervision and follow-through.")}>
                    <p className="sectionText">{selectedRouteSummary}</p>
                  </Card>
                  <Card title={t("Restricción de equipo", "Equipment constraint")} description={t("Qué está limitando este turno desde activos.", "What is limiting this shift from the asset side.")}>
                    <p className="sectionText">{selectedStory?.executionConstraint ?? t("Selecciona una bitácora para revisar la restricción de equipo.", "Choose a daily log to inspect equipment constraint.")}</p>
                  </Card>
                  <Card title={t("Checklist supervisor", "Supervisor checklist")} description={t("Disciplina mínima antes de cerrar el turno.", "Minimum discipline before closing the shift story.")}>
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Evidencia", "Evidence")}</div><div>{t("Al menos 4 evidencias útiles para revisión.", "At least 4 usable evidence items for review.")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Bloqueos", "Blockers")}</div><div>{t("Ningún bloqueo abierto si el estado va a aprobado.", "No open blockers if the log is moving to approved.")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Siguiente movimiento", "Next move")}</div><div>{t("La siguiente acción debe decir quién actúa y dónde continúa.", "The next action must clearly say who acts next and where follow-up continues.")}</div></div>
                    </div>
                  </Card>
                </section>

                <Card title={t("Tabla completa de bitácoras", "Full daily log table")} description={t("Vista amplia para revisar el subconjunto filtrado.", "Wide view for reviewing the filtered subset.")}>
                  <DataTable
                    rows={filteredEntries}
                    columns={[
                      {
                        key: "frontName",
                        label: t("Frente", "Front"),
                        render: (entry) => (
                          <button type="button" className="button ghost" onClick={() => { setSelectedEntryId(entry.id); setWorkspaceView("control"); }}>
                            {entry.frontName}
                          </button>
                        )
                      },
                      {
                        key: "projectName",
                        label: t("Proyecto", "Project"),
                        render: (entry) => entry.projectName
                      },
                      {
                        key: "status",
                        label: t("Estado", "Status"),
                        render: (entry) => <Badge tone={statusTone(entry.status)}>{localizeText(statusLabel(entry.status))}</Badge>
                      },
                      {
                        key: "workforceCount",
                        label: t("Cuadrilla", "Crew"),
                        render: (entry) => String(entry.workforceCount)
                      },
                      {
                        key: "progressPercent",
                        label: t("Avance", "Progress"),
                        render: (entry) => `${entry.progressPercent}%`
                      }
                    ]}
                  />
                </Card>

                <Card title={t("Riesgos del frente", "Field risks")} description={t("Bloqueos o huecos de evidencia ligados a la bitácora seleccionada.", "Current blockers or evidence issues tied to the selected log.")}>
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
                    <EmptyState title={t("Sin riesgos activos", "No active risks")} description={t("Esta bitácora no carga bloqueos explícitos ahora mismo.", "This log is not carrying explicit field blockers right now.")} />
                  )}
                </Card>
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState title={t("Bitácora no disponible", "Daily log unavailable")} description={error ?? t("No se pudo cargar la bitácora desde la fuente actual.", "The field diary could not be loaded from the current source.")} />
        )}
      </ModuleGate>
    </AppShell>
  );
}
