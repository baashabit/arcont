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
import type {
  ImportProjectScheduleActivityContract,
  ProjectPortfolioItemContract,
  ProjectPortfolioOverviewContract,
  ProjectScheduleActivityContract,
  ProjectScheduleOverviewContract
} from "@/lib/contracts";
import {
  createProjectPortfolioItem,
  createProjectScheduleActivity,
  fetchEquipmentOverview,
  fetchProjectsOverview,
  fetchProjectScheduleOverview,
  importProjectScheduleActivities,
  updateProjectPortfolioItem,
  updateProjectScheduleActivity
} from "@/lib/platform-api";

function statusTone(status: ProjectPortfolioItemContract["status"]) {
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

function scheduleStatusTone(status: ProjectScheduleActivityContract["status"]) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "blocked":
      return "danger" as const;
    case "in_progress":
      return "warning" as const;
    default:
      return "info" as const;
  }
}

function scheduleStatusLabel(status: ProjectScheduleActivityContract["status"]) {
  switch (status) {
    case "completed":
      return { es: "Terminada", en: "Completed" };
    case "blocked":
      return { es: "Bloqueada", en: "Blocked" };
    case "in_progress":
      return { es: "En proceso", en: "In progress" };
    default:
      return { es: "Sin iniciar", en: "Not started" };
  }
}

function normalizeContextValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const scheduleDayMs = 24 * 60 * 60 * 1000;

type ProjectScheduleBoardLane = {
  activity: ProjectScheduleActivityContract;
  leftPercent: number;
  widthPercent: number;
  progressPercent: number;
  predecessorLabels: string[];
  isReadyToStart: boolean;
  startsThisWeek: boolean;
  isDelayed: boolean;
  varianceDays: number;
};

type BilingualCopy = {
  es: string;
  en: string;
};

type ProjectStationLink = {
  href: string;
  label: BilingualCopy;
};

type ProjectSelectedStation = {
  whyNow: BilingualCopy;
  immediateModule: BilingualCopy;
  nextJump: BilingualCopy;
  returnCommitment: BilingualCopy;
  links: ProjectStationLink[];
};

function scheduleDateValue(date: string) {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function scheduleDateOffsetDays(startDate: string, endDate: string) {
  return Math.round((scheduleDateValue(endDate) - scheduleDateValue(startDate)) / scheduleDayMs);
}

function scheduleInclusiveDays(startDate: string, endDate: string) {
  return Math.max(1, scheduleDateOffsetDays(startDate, endDate) + 1);
}

function addScheduleDays(date: string, days: number) {
  return new Date(scheduleDateValue(date) + days * scheduleDayMs).toISOString().slice(0, 10);
}

function buildProjectScheduleBoard(overview: ProjectScheduleOverviewContract | null) {
  if (!overview || overview.activities.length === 0 || !overview.summary.baselineStart || !overview.summary.baselineFinish) {
    return {
      baselineStart: overview?.summary.baselineStart ?? null,
      baselineFinish: overview?.summary.baselineFinish ?? null,
      totalDays: 0,
      readyToStartCount: 0,
      startsThisWeekCount: 0,
      delayedCount: 0,
      phaseCount: 0,
      lanes: [] as ProjectScheduleBoardLane[]
    };
  }

  const baselineStart = overview.summary.baselineStart;
  const baselineFinish = overview.summary.baselineFinish;
  const totalDays = scheduleInclusiveDays(baselineStart, baselineFinish);
  const today = new Date().toISOString().slice(0, 10);
  const weekLimit = addScheduleDays(today, 7);
  const activityMap = new Map(overview.activities.map((activity) => [activity.id, activity]));
  const lanes = overview.activities
    .slice()
    .sort((left, right) => left.plannedStart.localeCompare(right.plannedStart) || left.code.localeCompare(right.code))
    .map<ProjectScheduleBoardLane>((activity) => {
      const plannedOffsetDays = scheduleDateOffsetDays(baselineStart, activity.plannedStart);
      const plannedDays = scheduleInclusiveDays(activity.plannedStart, activity.plannedFinish);
      const baseWidthPercent = (plannedDays / totalDays) * 100;
      const leftPercent = Math.max(0, Math.min(100, (plannedOffsetDays / totalDays) * 100));
      const widthPercent = Math.min(100 - leftPercent, Math.max(baseWidthPercent, 8));
      const predecessorLabels = activity.predecessorIds
        .map((predecessorId) => activityMap.get(predecessorId))
        .filter((predecessor): predecessor is ProjectScheduleActivityContract => Boolean(predecessor))
        .map((predecessor) => `${predecessor.code} · ${predecessor.name}`);
      const isReadyToStart =
        activity.status === "not_started" &&
        activity.predecessorIds.every((predecessorId) => activityMap.get(predecessorId)?.status === "completed");
      const isDelayed =
        activity.status !== "completed" && activity.progressPercent < 100 && activity.plannedFinish < today;
      const startsThisWeek =
        activity.status === "not_started" && activity.plannedStart >= today && activity.plannedStart <= weekLimit;

      return {
        activity,
        leftPercent,
        widthPercent,
        progressPercent:
          activity.progressPercent > 0 ? Math.max(Math.min(activity.progressPercent, 100), 10) : 0,
        predecessorLabels,
        isReadyToStart,
        startsThisWeek,
        isDelayed,
        varianceDays: isDelayed ? scheduleDateOffsetDays(activity.plannedFinish, today) : 0
      };
    });

  return {
    baselineStart,
    baselineFinish,
    totalDays,
    readyToStartCount: lanes.filter((lane) => lane.isReadyToStart).length,
    startsThisWeekCount: lanes.filter((lane) => lane.startsThisWeek).length,
    delayedCount: lanes.filter((lane) => lane.isDelayed).length,
    phaseCount: new Set(overview.activities.map((activity) => activity.phase)).size,
    lanes
  };
}

function projectStatusLabel(status: ProjectPortfolioItemContract["status"]) {
  switch (status) {
    case "planning":
      return { es: "Planeación", en: "Planning" };
    case "active":
      return { es: "Activa", en: "Active" };
    case "at_risk":
      return { es: "En riesgo", en: "At risk" };
    case "blocked":
      return { es: "Bloqueada", en: "Blocked" };
    default:
      return { es: "Cerrada", en: "Closed" };
  }
}

function projectActionLabel(status: ProjectPortfolioItemContract["status"]) {
  switch (status) {
    case "active":
      return { es: "Activar / recuperar", en: "Activate / recover" };
    case "at_risk":
      return { es: "Marcar en riesgo", en: "Mark at risk" };
    case "blocked":
      return { es: "Bloquear obra", en: "Block project" };
    case "closed":
      return { es: "Cerrar obra", en: "Close project" };
    default:
      return { es: "Pasar a planeación", en: "Move to planning" };
  }
}

function normalizeProjectFeedbackCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveProjectFeedbackCopy(message: string | null) {
  if (!message) {
    return null;
  }

  switch (normalizeProjectFeedbackCode(message)) {
    case "PROJECT_UPDATE_FAILED":
      return {
        es: "No fue posible actualizar la programación de la obra. Revisa la conexión e intenta de nuevo.",
        en: "The project schedule could not be updated. Check the connection and try again."
      };
    case "PROJECT_CREATION_FAILED":
      return {
        es: "No fue posible registrar la obra en la programación. Revisa los datos e intenta de nuevo.",
        en: "The project could not be added to the schedule. Review the details and try again."
      };
    case "PROJECT_CODE_ALREADY_EXISTS":
    case "DUPLICATE_PROJECT_CODE":
    case "CODE_ALREADY_EXISTS":
      return {
        es: "Ese código ya existe en la cartera. Usa un código único para evitar duplicados.",
        en: "That code already exists in the portfolio. Use a unique code to avoid duplicates."
      };
    case "NEXT_MILESTONE_TOO_SHORT":
      return {
        es: "Define un siguiente hito más específico para que operación sepa qué programar.",
        en: "Define a more specific next milestone so operations knows what to schedule."
      };
    case "PROJECT_MOVED_TO_ACTIVE":
      return {
        es: "Programación actualizada: la obra quedó activa y lista para seguimiento operativo.",
        en: "Schedule updated: the project is now active and ready for operational follow-up."
      };
    case "PROJECT_MOVED_TO_AT_RISK":
      return {
        es: "Programación actualizada: la obra quedó en riesgo para seguimiento de recuperación.",
        en: "Schedule updated: the project is now at risk for recovery follow-up."
      };
    case "PROJECT_MOVED_TO_BLOCKED":
      return {
        es: "Programación actualizada: la obra quedó bloqueada para atención inmediata.",
        en: "Schedule updated: the project is now blocked for immediate attention."
      };
    case "PROJECT_MOVED_TO_CLOSED":
      return {
        es: "Programación actualizada: la obra quedó cerrada en la cartera.",
        en: "Schedule updated: the project is now closed in the portfolio."
      };
    case "PROJECT_MOVED_TO_PLANNING":
      return {
        es: "Programación actualizada: la obra regresó a planeación.",
        en: "Schedule updated: the project moved back to planning."
      };
    case "PROJECT_ADDED_TO_THE_ACTIVE_PORTFOLIO":
      return {
        es: "La obra se agregó correctamente y ya está disponible en la programación operativa.",
        en: "The project was added successfully and is now available in the operational schedule."
      };
    default:
      return { es: message, en: message };
  }
}

function buildProjectContinuitySpanish(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return { label: "Selecciona una obra", description: "Elige una obra para revisar su continuidad y definir el siguiente movimiento." };
  }

  if (project.status === "blocked" || project.permitBlockers > 2) {
    return { label: "Recuperación obligatoria", description: "La obra no debe avanzar hasta asignar al responsable del bloqueo y definir su fecha de liberación." };
  }

  if (project.latestDailyLogStatus === "flagged" || project.qualityHolds > 0 || project.qualityReleaseReadiness < 75) {
    return { label: "Continuidad en riesgo", description: "Coordina campo, calidad y el responsable técnico antes de comprometer el siguiente hito." };
  }

  return { label: "Continuidad controlada", description: "La obra puede continuar; confirma responsable y fecha del siguiente hito antes del próximo corte." };
}

function projectActionOptions(project: ProjectPortfolioItemContract) {
  switch (project.status) {
    case "planning":
      return [
        {
          label: "Start project",
          status: "active" as const,
          nextMilestone: "Mobilization and first production front release"
        }
      ];
    case "active":
      return [
        {
          label: "Mark at risk",
          status: "at_risk" as const,
          nextMilestone: "Recovery plan review with PMO and supervision"
        },
        {
          label: "Block project",
          status: "blocked" as const,
          nextMilestone: "Escalate blocker and freeze affected fronts"
        },
        {
          label: "Close project",
          status: "closed" as const,
          nextMilestone: "Administrative closeout and final handover"
        }
      ];
    case "at_risk":
      return [
        {
          label: "Recover to active",
          status: "active" as const,
          nextMilestone: "Resume baseline production sequence"
        },
        {
          label: "Block project",
          status: "blocked" as const,
          nextMilestone: "Escalate unresolved blocker to steering review"
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume as active",
          status: "active" as const,
          nextMilestone: "Restart fronts after blocker release"
        },
        {
          label: "Move to at risk",
          status: "at_risk" as const,
          nextMilestone: "Track controlled restart with recovery plan"
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(projects: ProjectPortfolioItemContract[]) {
  const activeProjects = projects.filter((project) => ["active", "at_risk", "blocked"].includes(project.status));
  return {
    activeProjects: activeProjects.length,
    averageProgress:
      activeProjects.length > 0
        ? Number((activeProjects.reduce((sum, project) => sum + project.progress, 0) / activeProjects.length).toFixed(1))
        : 0,
    qualityHolds: activeProjects.reduce((sum, project) => sum + project.qualityHolds, 0),
    permitBlockers: activeProjects.reduce((sum, project) => sum + project.permitBlockers, 0),
    executionRiskProjects: activeProjects.filter(
      (project) =>
        project.latestDailyLogStatus === "flagged" ||
        project.subcontractHealth === "critical" ||
        project.qualityReleaseReadiness < 75
    ).length
  };
}

function pickFocusProject(projects: ProjectPortfolioItemContract[]) {
  const activeProjects = projects.filter((project) => ["active", "at_risk", "blocked"].includes(project.status));
  return (
    activeProjects
      .slice()
      .sort((left, right) => {
        if (left.latestDailyLogStatus === "flagged" && right.latestDailyLogStatus !== "flagged") {
          return -1;
        }

        if (left.latestDailyLogStatus !== "flagged" && right.latestDailyLogStatus === "flagged") {
          return 1;
        }

        if (left.status === "at_risk" && right.status !== "at_risk") {
          return -1;
        }

        if (left.status !== "at_risk" && right.status === "at_risk") {
          return 1;
        }

        return right.scheduleVarianceDays - left.scheduleVarianceDays;
      })[0] ?? null
  );
}

type ProjectEquipmentBridge = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
} | null;

function buildProjectEquipmentStory(project: ProjectPortfolioItemContract | null, bridge: ProjectEquipmentBridge) {
  if (!project) {
    return null;
  }

  const linkedMachines = bridge?.equipment.machines.filter((item) => item.projectName === project.name) ?? [];
  const constrainedMachines = linkedMachines.filter((item) => item.status !== "available" || item.health !== "healthy");

  return {
    equipmentCoverage:
      linkedMachines.length > 0
        ? `${linkedMachines.length} tracked machines are mapped to this project, with ${constrainedMachines.length} already under constraint.`
        : "No tracked equipment is currently mapped to this project.",
    fieldExecution:
      constrainedMachines.length > 0
        ? `${constrainedMachines[0]?.machineName ?? "A critical machine"} is already affecting field continuity in ${constrainedMachines[0]?.frontName ?? "an active front"}.`
        : "Equipment posture is not currently the leading execution constraint on this project.",
    dispatchSignal:
      constrainedMachines.length > 0
        ? constrainedMachines[0]?.nextAction ?? "Recover constrained machine availability before the next production cycle."
        : "Dispatch posture remains stable across mapped equipment."
  };
}

function buildProjectContinuityGate(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return {
      tone: "info" as const,
      label: "No project selected",
      summary: "Choose a project to verify whether continuity is stable, recoverable or blocked.",
      checks: ["Select a project from the current portfolio board."]
    };
  }

  const checks: string[] = [];

  if (project.status === "blocked") {
    checks.push("Project is already blocked at portfolio level.");
  }

  if (project.permitBlockers > 2) {
    checks.push(`${project.permitBlockers} permit blockers still prevent clean continuity.`);
  }

  if (project.qualityHolds > 0) {
    checks.push(`${project.qualityHolds} quality hold(s) still affect release continuity.`);
  }

  if (project.latestDailyLogStatus === "flagged") {
    checks.push("Latest daily log is flagged, so field continuity is not yet stable.");
  }

  if (project.qualityReleaseReadiness < 75) {
    checks.push(`Quality release readiness is only ${project.qualityReleaseReadiness}%.`);
  }

  if (project.subcontractHealth === "critical") {
    checks.push("Subcontract posture is critical and can destabilize next milestones.");
  }

  if (checks.length > 0) {
    return {
      tone:
        project.status === "blocked" || project.permitBlockers > 2 || project.latestDailyLogStatus === "flagged"
          ? "danger" as const
          : "warning" as const,
      label:
        project.status === "blocked" || project.permitBlockers > 2 || project.latestDailyLogStatus === "flagged"
          ? "Recover before continuing"
          : "Continue with control",
      summary:
        project.status === "blocked" || project.permitBlockers > 2 || project.latestDailyLogStatus === "flagged"
          ? "The project still has hard executive or field blockers before continuity should be treated as normal."
          : "The project can continue, but PMO and operations still need disciplined recovery follow-through.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Continuity aligned",
    summary: "Execution, quality and milestone posture are currently aligned for normal continuity.",
    checks: [
      "Continue into field, quality or equipment without rebuilding project context.",
      "Keep the next milestone and owning domain aligned in the same operating cycle."
    ]
  };
}

function buildProjectReportBackWindow(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return "Select a project to define the next report-back window.";
  }

  if (project.status === "blocked") {
    return "Report back before the next executive cutoff with blocker containment status and the exact owning domain.";
  }

  if (project.latestDailyLogStatus === "flagged" || project.qualityHolds > 0) {
    return "Report back in the same operating cycle once field or quality confirms whether the next milestone is still defensible.";
  }

  if (project.permitBlockers > 0) {
    return "Report back as soon as permit ownership and unblock timing are explicit.";
  }

  return "Report back at the next milestone review confirming the project stayed aligned through field, quality and equipment.";
}

function buildProjectSelectedStation(
  project: ProjectPortfolioItemContract | null,
  hrefs: { field: string; operations: string; procurement: string; subcontracts: string }
): ProjectSelectedStation {
  if (!project) {
    return {
      whyNow: {
        es: "Selecciona una obra para explicar por qué importa este corte operativo.",
        en: "Select a project to explain why this operating cut matters now."
      },
      immediateModule: {
        es: "Módulo responsable inmediato pendiente de selección.",
        en: "Immediate responsible module pending selection."
      },
      nextJump: {
        es: "El siguiente salto operativo se define cuando haya una obra activa.",
        en: "The next operating jump is defined once there is an active project."
      },
      returnCommitment: {
        es: "Regresa con el hito, responsable y confirmación del siguiente frente.",
        en: "Come back with the milestone, owner and next-front confirmation."
      },
      links: [
        { href: hrefs.field, label: { es: "Abrir campo", en: "Open field" } },
        { href: hrefs.operations, label: { es: "Abrir operaciones", en: "Open operations" } },
        { href: hrefs.procurement, label: { es: "Abrir procurement", en: "Open procurement" } },
        { href: hrefs.subcontracts, label: { es: "Abrir subcontratos", en: "Open subcontracts" } }
      ]
    };
  }

  const fieldLink = { href: hrefs.field, label: { es: "Abrir campo", en: "Open field" } };
  const operationsLink = { href: hrefs.operations, label: { es: "Abrir operaciones", en: "Open operations" } };
  const procurementLink = {
    href: hrefs.procurement,
    label: { es: "Abrir procurement", en: "Open procurement" }
  };
  const subcontractsLink = {
    href: hrefs.subcontracts,
    label: { es: "Abrir subcontratos", en: "Open subcontracts" }
  };

  if (project.latestDailyLogStatus === "flagged") {
    return {
      whyNow: {
        es: "La última señal de campo sigue con alerta y puede romper el siguiente frente si no se aterriza en este mismo corte.",
        en: "The latest field signal is still flagged and can break the next front if it is not grounded in this same cut."
      },
      immediateModule: {
        es: "Field toma la responsabilidad inmediata para aclarar avance real, restricciones y liberación del frente.",
        en: "Field takes immediate ownership to clarify actual progress, constraints and front release."
      },
      nextJump: {
        es: "Después el salto operativo va a Operations para reprogramar la secuencia con la evidencia de campo ya cerrada.",
        en: "After that, the operating jump goes to Operations to resequence work with field evidence already closed."
      },
      returnCommitment: {
        es: "Debe regresar confirmado qué frente sí quedó liberado, qué bloqueo sigue vivo y si procurement o subcontracts reciben acción inmediata.",
        en: "It must come back with the released front, the blocker still alive, and whether procurement or subcontracts take the next action."
      },
      links: [fieldLink, operationsLink, procurementLink, subcontractsLink]
    };
  }

  if (project.permitBlockers > 0) {
    return {
      whyNow: {
        es: "El siguiente hito depende de liberar abastecimiento o permisos antes de mover otro frente.",
        en: "The next milestone depends on releasing supply or permits before moving another front."
      },
      immediateModule: {
        es: "Procurement queda responsable inmediato de confirmar fecha, insumo crítico y receptor en obra.",
        en: "Procurement becomes the immediate owner to confirm date, critical supply and receiving team on site."
      },
      nextJump: {
        es: "Con esa confirmación, el siguiente salto operativo va a Field para validar que el frente realmente puede arrancar.",
        en: "With that confirmation, the next operating jump goes to Field to validate that the front can actually start."
      },
      returnCommitment: {
        es: "Debe regresar confirmado qué insumo o permiso quedó liberado, cuándo entra al frente y qué ajuste debe reflejar Operations.",
        en: "It must come back confirming which supply or permit was released, when it reaches the front and what update Operations must reflect."
      },
      links: [procurementLink, fieldLink, operationsLink, subcontractsLink]
    };
  }

  if (project.subcontractHealth === "critical" || project.pendingDestajo > 0) {
    return {
      whyNow: {
        es: "La continuidad depende de que el subcontrato sostenga cuadrilla, alcance y cobro sin romper la secuencia.",
        en: "Continuity depends on the subcontract sustaining crew, scope and payment without breaking the sequence."
      },
      immediateModule: {
        es: "Subcontracts toma la responsabilidad inmediata para fijar compromiso de cuadrilla, alcance y cierre de destajo.",
        en: "Subcontracts takes immediate ownership to lock crew commitment, scope and destajo closeout."
      },
      nextJump: {
        es: "Después el salto operativo va a Operations para reprogramar con capacidad real del subcontrato ya confirmada.",
        en: "After that, the operating jump goes to Operations to reschedule with confirmed subcontract capacity."
      },
      returnCommitment: {
        es: "Debe regresar confirmado quién entra, en qué fecha, con qué alcance y si Field recibe continuidad limpia en el siguiente frente.",
        en: "It must come back confirming who enters, on what date, with what scope and whether Field receives clean continuity on the next front."
      },
      links: [subcontractsLink, operationsLink, fieldLink, procurementLink]
    };
  }

  return {
    whyNow: {
      es: "La obra está lo bastante estable para empujar el siguiente frente, pero solo si Operations mantiene alineados campo, compras y subcontratos.",
      en: "The project is stable enough to push the next front, but only if Operations keeps field, procurement and subcontracts aligned."
    },
    immediateModule: {
      es: "Operations es responsable inmediato de dejar secuencia, receptor y fecha de corte visibles para todos.",
      en: "Operations is the immediate owner to keep sequence, receiver and cutoff date visible for everyone."
    },
    nextJump: {
      es: "El siguiente salto operativo va a Field para ejecutar con el frente, insumos y soporte ya comprometidos.",
      en: "The next operating jump goes to Field to execute with the front, supplies and support already committed."
    },
    returnCommitment: {
      es: "Debe regresar confirmado que el frente arrancó, que procurement y subcontracts sostienen el compromiso y que el programa sigue defendible.",
      en: "It must come back confirming the front started, procurement and subcontracts are sustaining the commitment, and the schedule remains defensible."
    },
    links: [operationsLink, fieldLink, procurementLink, subcontractsLink]
  };
}

function validateProjectCreateForm(input: {
  code: string;
  name: string;
  client: string;
  segment: string;
  stage: string;
  progress: number;
  scheduleVarianceDays: number;
  qualityHolds: number;
  permitBlockers: number;
  activeFronts: number;
  nextMilestone: string;
  status: ProjectPortfolioItemContract["status"];
}) {
  if ([input.code, input.name, input.client, input.segment, input.stage].some((value) => value.trim().length < 3)) {
    return "Code, name, client, segment and stage must be specific before creating a project.";
  }

  if (!/^[A-Z0-9-]+$/.test(input.code.trim().toUpperCase())) {
    return "Project code must use uppercase letters, numbers or dashes.";
  }

  if (input.nextMilestone.trim().length < 8) {
    return "Next milestone must be more specific before creating a project.";
  }

  if (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 100) {
    return "Progress must stay between 0% and 100%.";
  }

  if (!Number.isFinite(input.scheduleVarianceDays)) {
    return "Schedule variance must be a valid number.";
  }

  if ([input.qualityHolds, input.permitBlockers, input.activeFronts].some((value) => !Number.isFinite(value) || value < 0)) {
    return "Quality holds, permit blockers and active fronts must be zero or greater.";
  }

  if (input.status === "active" && input.permitBlockers > 2) {
    return "Active status is blocked while permit blockers stay above 2.";
  }

  if (input.status === "closed" && (input.progress < 100 || input.qualityHolds > 0 || input.permitBlockers > 0)) {
    return "Closed status requires 100% progress with zero quality holds and zero permit blockers.";
  }

  return null;
}

function createProjectExample() {
  return {
    code: "ARB-NVO-03",
    name: "Conjunto Residencial Norte",
    client: "Desarrolladora Norte",
    segment: "Residential",
    status: "planning" as ProjectPortfolioItemContract["status"],
    stage: "Preconstruction",
    progress: "0",
    scheduleVarianceDays: "0",
    budgetHealth: "on_track" as ProjectPortfolioItemContract["budgetHealth"],
    qualityHolds: "0",
    permitBlockers: "0",
    activeFronts: "1",
    nextMilestone: "Municipal permit release and first front mobilization"
  };
}

function buildProjectCreateGate(input: {
  code: string;
  name: string;
  client: string;
  segment: string;
  stage: string;
  progress: number;
  scheduleVarianceDays: number;
  qualityHolds: number;
  permitBlockers: number;
  activeFronts: number;
  nextMilestone: string;
  status: ProjectPortfolioItemContract["status"];
}) {
  const validationError = validateProjectCreateForm(input);
  const checks: string[] = [];

  if (validationError) {
    checks.push(validationError);
  }

  if (input.status === "planning" && input.activeFronts <= 0) {
    checks.push("Planning intake should still define at least one active front for downstream continuity.");
  }

  if (input.status === "active" && input.progress <= 0) {
    checks.push("Active intake should not start with zero progress.");
  }

  if (input.status === "closed" && input.scheduleVarianceDays > 0) {
    checks.push("Closed intake still shows positive schedule delay and needs a stronger closure explanation.");
  }

  if (checks.length > 0) {
    const hardBlock = Boolean(validationError);
    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This project intake still breaks core portfolio rules before persistence."
        : "The project can be created, but PMO should tighten the intake before trusting downstream continuity.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The project intake is coherent enough to enter the live portfolio cleanly.",
    checks: [
      "The created project will become selectable immediately for field, quality and equipment flows.",
      "Keep the milestone owner and status posture attached from the first PMO capture."
    ]
  };
}

function formatSchedulePredecessorCodes(
  predecessorIds: string[],
  overview: ProjectScheduleOverviewContract | null
) {
  if (!overview || predecessorIds.length === 0) {
    return "";
  }

  const codeById = new Map(overview.activities.map((activity) => [activity.id, activity.code]));
  return predecessorIds
    .map((predecessorId) => codeById.get(predecessorId))
    .filter((code): code is string => Boolean(code))
    .join(", ");
}

function resolveSchedulePredecessorCodes(
  predecessorCodes: string,
  activities: ProjectScheduleActivityContract[]
) {
  const codes = [...new Set(predecessorCodes
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean))];
  const idByCode = new Map(activities.map((activity) => [activity.code.toUpperCase(), activity.id]));
  const missingCodes = codes.filter((code) => !idByCode.has(code));

  return {
    predecessorIds: codes.flatMap((code) => {
      const id = idByCode.get(code);
      return id ? [id] : [];
    }),
    missingCodes
  };
}

function resolveScheduleFeedbackCopy(message: string | null) {
  if (!message) {
    return null;
  }

  switch (normalizeProjectFeedbackCode(message)) {
    case "PROJECT_SCHEDULE_LOAD_FAILED":
      return {
        es: "No se pudo cargar el programa de esta obra. Intenta de nuevo o revisa la conexión.",
        en: "The schedule for this project could not be loaded. Retry or check the connection."
      };
    case "PROJECT_SCHEDULE_INVALID_PROGRESS":
      return {
        es: "El avance real debe mantenerse entre 0% y 100%.",
        en: "Actual progress must stay between 0% and 100%."
      };
    case "PROJECT_SCHEDULE_COMPLETION_INCOMPLETE":
      return {
        es: "Para terminar una actividad necesitas 100% y fecha real de fin.",
        en: "Completed activities require 100% progress and an actual finish date."
      };
    case "PROJECT_SCHEDULE_NOT_STARTED_INCONSISTENT":
      return {
        es: "Una actividad sin iniciar no puede llevar avance real ni fechas reales.",
        en: "A not-started activity cannot carry actual progress or actual dates."
      };
    case "PROJECT_SCHEDULE_IN_PROGRESS_INCONSISTENT":
      return {
        es: "Una actividad en proceso debe arrancar con fecha real y avance mayor a cero.",
        en: "An in-progress activity needs an actual start date and progress above zero."
      };
    case "PROJECT_SCHEDULE_INVALID_ACTUAL_DATES":
      return {
        es: "La fecha real de fin no puede quedar antes de la fecha real de inicio.",
        en: "Actual finish cannot be earlier than actual start."
      };
    case "PROJECT_SCHEDULE_INVALID_DATES":
    case "PROJECT_SCHEDULE_INVALID_CREATE_INPUT":
      return {
        es: "Revisa fechas, responsable y siguiente acción antes de guardar el programa.",
        en: "Review dates, owner and next action before saving the schedule."
      };
    case "PROJECT_SCHEDULE_INVALID_PREDECESSORS":
      return {
        es: "Las dependencias deben ser únicas y no pueden referenciar la misma actividad.",
        en: "Dependencies must be unique and cannot reference the same activity."
      };
    case "PROJECT_SCHEDULE_PREDECESSOR_NOT_FOUND":
      return {
        es: "Algún código de dependencia no existe en el programa de esta obra.",
        en: "One or more dependency codes do not exist in this project schedule."
      };
    case "PROJECT_SCHEDULE_CIRCULAR_DEPENDENCY":
      return {
        es: "La secuencia propuesta crea una dependencia circular en el programa.",
        en: "The proposed sequence creates a circular dependency in the schedule."
      };
    case "PROJECT_SCHEDULE_DUPLICATE_ACTIVITY_CODE":
      return {
        es: "Ese código de actividad ya existe dentro de esta obra.",
        en: "That activity code already exists within this project."
      };
    case "PROJECT_SCHEDULE_INVALID_ACTIVITY_CODE":
      return {
        es: "El código de actividad solo puede usar mayúsculas, números y guiones.",
        en: "Activity code can only use uppercase letters, numbers and dashes."
      };
    case "PROJECT_SCHEDULE_ACTIVITY_UPDATED":
      return {
        es: "La actividad quedó reprogramada y su avance real fue actualizado.",
        en: "The activity was rescheduled and its actual progress was updated."
      };
    case "PROJECT_SCHEDULE_ACTIVITY_CREATED":
      return {
        es: "La actividad fue agregada al programa y ya está disponible para seguimiento.",
        en: "The activity was added to the schedule and is now available for follow-up."
      };
    case "PROJECT_SCHEDULE_ACTIVITY_CREATED_WITHOUT_REFRESH":
      return {
        es: "La actividad se creó, pero el tablero no pudo refrescarse automáticamente.",
        en: "The activity was created, but the board could not refresh automatically."
      };
    case "PROJECT_SCHEDULE_IMPORT_EMPTY":
      return {
        es: "Pega o carga un CSV con actividades antes de importar.",
        en: "Paste or upload a CSV with activities before importing."
      };
    case "PROJECT_SCHEDULE_IMPORT_INVALID_HEADERS":
      return {
        es: "El CSV no trae las columnas mínimas requeridas para importar el programa.",
        en: "The CSV is missing the minimum required schedule columns."
      };
    case "PROJECT_SCHEDULE_IMPORT_INVALID_ROWS":
      return {
        es: "El CSV tiene filas incompletas. Revisa código, fechas, responsable y siguiente acción.",
        en: "The CSV has incomplete rows. Review code, dates, owner and next action."
      };
    case "PROJECT_SCHEDULE_IMPORT_FILE_READ_FAILED":
      return {
        es: "No fue posible leer el archivo CSV seleccionado.",
        en: "The selected CSV file could not be read."
      };
    case "PROJECT_SCHEDULE_IMPORT_FAILED":
      return {
        es: "La importación del programa no pudo completarse. Revisa columnas, secuencia y duplicados.",
        en: "The schedule import could not be completed. Review columns, sequence and duplicates."
      };
    case "PROJECT_SCHEDULE_IMPORT_COMPLETED":
      return {
        es: "El lote de actividades fue importado y quedó listo en el programa.",
        en: "The activity batch was imported and is now available in the schedule."
      };
    default:
      return { es: message, en: message };
  }
}

const projectScheduleCsvTemplate = [
  "code,name,phase,plannedStart,plannedFinish,predecessorCodes,owner,nextAction",
  'CIV-010,Trazo y nivelación,Preparación,2026-07-15,2026-07-17,,Superintendencia,"Liberar trazo y validar eje base con topografía"',
  'CIV-020,Excavación de zapatas,Cimentación,2026-07-18,2026-07-22,CIV-010,Movimiento de tierras,"Cerrar excavación y preparar plantilla para revisión"',
  'EST-030,Armado de acero de cimentación,Estructura,2026-07-23,2026-07-27,CIV-020,Residente estructura,"Confirmar habilitado y liberar inspección antes del colado"'
].join("\n");

function parseCsvMatrix(csv: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const nextCharacter = csv[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function normalizeCsvHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function resolveProjectScheduleCsvHeader(header: string) {
  const normalized = normalizeCsvHeader(header);

  if (["code", "codigo", "activitycode"].includes(normalized)) {
    return "code" as const;
  }
  if (["name", "actividad", "activity", "nombre"].includes(normalized)) {
    return "name" as const;
  }
  if (["phase", "fase"].includes(normalized)) {
    return "phase" as const;
  }
  if (["plannedstart", "inicioplan", "fechainicioplan", "startdate"].includes(normalized)) {
    return "plannedStart" as const;
  }
  if (["plannedfinish", "finplan", "fechafinplan", "finishdate"].includes(normalized)) {
    return "plannedFinish" as const;
  }
  if (["predecessorcodes", "predecesorascodigos", "predecessors", "dependencias", "precedences"].includes(normalized)) {
    return "predecessorCodes" as const;
  }
  if (["owner", "responsable"].includes(normalized)) {
    return "owner" as const;
  }
  if (["nextaction", "siguienteaccion", "nextstep"].includes(normalized)) {
    return "nextAction" as const;
  }

  return null;
}

function parseProjectScheduleCsv(csv: string): ImportProjectScheduleActivityContract[] {
  const matrix = parseCsvMatrix(csv.trim());
  if (matrix.length === 0) {
    throw new Error("PROJECT_SCHEDULE_IMPORT_EMPTY");
  }

  const headerRow = matrix[0];
  const headerMap = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const resolved = resolveProjectScheduleCsvHeader(header);
    if (resolved) {
      headerMap.set(resolved, index);
    }
  });

  const requiredHeaders = ["code", "name", "phase", "plannedStart", "plannedFinish", "owner", "nextAction"] as const;
  if (requiredHeaders.some((header) => !headerMap.has(header))) {
    throw new Error("PROJECT_SCHEDULE_IMPORT_INVALID_HEADERS");
  }

  const rows = matrix.slice(1).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length === 0) {
    throw new Error("PROJECT_SCHEDULE_IMPORT_EMPTY");
  }

  return rows.map((row) => {
    const read = (key: typeof requiredHeaders[number] | "predecessorCodes") =>
      row[headerMap.get(key) ?? -1]?.trim() ?? "";

    const activity = {
      code: read("code").toUpperCase(),
      name: read("name"),
      phase: read("phase"),
      plannedStart: read("plannedStart"),
      plannedFinish: read("plannedFinish"),
      predecessorCodes: read("predecessorCodes")
        .split(/[|;,]+/g)
        .map((code) => code.trim().toUpperCase())
        .filter(Boolean),
      owner: read("owner"),
      nextAction: read("nextAction")
    };

    if (
      ![activity.code, activity.name, activity.phase, activity.plannedStart, activity.plannedFinish, activity.owner, activity.nextAction].every(
        (value) => value.length > 0
      )
    ) {
      throw new Error("PROJECT_SCHEDULE_IMPORT_INVALID_ROWS");
    }

    return activity;
  });
}

function buildScheduleCodePrefix(phase: string) {
  const cleaned = normalizeCsvHeader(phase).replace(/[^a-z0-9]/g, "").toUpperCase();
  return (cleaned.slice(0, 3) || "ACT").padEnd(3, "X");
}

function suggestNextScheduleCode(
  overview: ProjectScheduleOverviewContract | null,
  phase: string
) {
  const prefix = buildScheduleCodePrefix(phase);
  const matcher = new RegExp(`^${prefix}-?(\\d+)$`);
  const highestSequence = overview?.activities.reduce((highest, activity) => {
    const match = activity.code.toUpperCase().match(matcher);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0) ?? 0;
  const nextSequence = highestSequence <= 0 ? 10 : Math.ceil((highestSequence + 1) / 10) * 10;
  return `${prefix}-${String(nextSequence).padStart(3, "0")}`;
}

type FieldSchedulePreloadContext = {
  source: string;
  projectName: string;
  frontName: string;
  owner: string;
  summary: string;
  nextAction: string;
  schedulePhase: string;
  scheduleActivityName: string;
  matchedProjectId: string | null;
  matchedActivityId: string | null;
  hasClearProjectMatch: boolean;
  hasClearActivityMatch: boolean;
};

function findClearProjectMatch(
  projects: ProjectPortfolioItemContract[],
  context: Pick<FieldSchedulePreloadContext, "projectName" | "frontName" | "summary" | "nextAction">
) {
  const normalizedProjectName = normalizeContextValue(context.projectName);
  const normalizedFrontName = normalizeContextValue(context.frontName);
  const normalizedSummary = normalizeContextValue(context.summary);
  const normalizedNextAction = normalizeContextValue(context.nextAction);

  const scored = projects
    .map((project) => {
      let score = 0;
      const projectName = normalizeContextValue(project.name);
      const projectCode = normalizeContextValue(project.code);
      const projectStage = normalizeContextValue(project.stage);
      const projectMilestone = normalizeContextValue(project.nextMilestone);

      if (normalizedProjectName) {
        if (projectName === normalizedProjectName) {
          score += 6;
        } else if (projectName.includes(normalizedProjectName) || normalizedProjectName.includes(projectName)) {
          score += 4;
        } else if (projectCode === normalizedProjectName) {
          score += 5;
        }
      }

      if (normalizedFrontName && (projectMilestone.includes(normalizedFrontName) || projectStage.includes(normalizedFrontName))) {
        score += 1;
      }

      if (normalizedSummary && projectMilestone.includes(normalizedSummary)) {
        score += 1;
      }

      if (normalizedNextAction && projectMilestone.includes(normalizedNextAction)) {
        score += 2;
      }

      return { project, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 1) {
    return scored[0].project;
  }

  const topScore = scored[0]?.score ?? 0;
  const topMatches = scored.filter((entry) => entry.score === topScore);
  return topScore >= 5 && topMatches.length === 1 ? topMatches[0].project : null;
}

function findClearScheduleActivityMatch(
  activities: ProjectScheduleActivityContract[],
  context: Pick<FieldSchedulePreloadContext, "frontName" | "owner" | "summary" | "nextAction" | "schedulePhase" | "scheduleActivityName">
) {
  const normalizedFrontName = normalizeContextValue(context.frontName);
  const normalizedOwner = normalizeContextValue(context.owner);
  const normalizedSummary = normalizeContextValue(context.summary);
  const normalizedNextAction = normalizeContextValue(context.nextAction);
  const normalizedSchedulePhase = normalizeContextValue(context.schedulePhase);
  const normalizedScheduleActivityName = normalizeContextValue(context.scheduleActivityName);

  const scored = activities
    .map((activity) => {
      let score = 0;
      const activityName = normalizeContextValue(activity.name);
      const activityPhase = normalizeContextValue(activity.phase);
      const activityOwner = normalizeContextValue(activity.owner);
      const activityNextAction = normalizeContextValue(activity.nextAction);

      if (normalizedScheduleActivityName) {
        if (activityName === normalizedScheduleActivityName) {
          score += 6;
        } else if (
          activityName.includes(normalizedScheduleActivityName) ||
          normalizedScheduleActivityName.includes(activityName)
        ) {
          score += 4;
        }
      }

      if (normalizedSummary) {
        if (activityName === normalizedSummary) {
          score += 4;
        } else if (activityName.includes(normalizedSummary) || normalizedSummary.includes(activityName)) {
          score += 2;
        }
      }

      if (normalizedSchedulePhase && activityPhase === normalizedSchedulePhase) {
        score += 2;
      }

      if (normalizedOwner && activityOwner === normalizedOwner) {
        score += 2;
      }

      if (normalizedNextAction) {
        if (activityNextAction === normalizedNextAction) {
          score += 3;
        } else if (activityNextAction.includes(normalizedNextAction) || normalizedNextAction.includes(activityNextAction)) {
          score += 1;
        }
      }

      if (normalizedFrontName && (activityName.includes(normalizedFrontName) || activityNextAction.includes(normalizedFrontName))) {
        score += 1;
      }

      return { activity, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 1) {
    return scored[0].activity;
  }

  const topScore = scored[0]?.score ?? 0;
  const topMatches = scored.filter((entry) => entry.score === topScore);
  return topScore >= 5 && topMatches.length === 1 ? topMatches[0].activity : null;
}

export default function ProjectsPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const searchParams = useSearchParams();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<ProjectPortfolioOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<ProjectEquipmentBridge>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectPortfolioItemContract["status"]>("all");
  const [budgetHealthFilter, setBudgetHealthFilter] = useState<"all" | ProjectPortfolioItemContract["budgetHealth"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"control" | "portfolio" | "schedule" | "create">("control");
  const [nextMilestoneDraft, setNextMilestoneDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [scheduleOverview, setScheduleOverview] = useState<ProjectScheduleOverviewContract | null>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null);
  const [scheduleActivityId, setScheduleActivityId] = useState<string | null>(null);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<"all" | ProjectScheduleActivityContract["status"]>("all");
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  const [isScheduleImporting, setIsScheduleImporting] = useState(false);
  const [scheduleImportCsv, setScheduleImportCsv] = useState("");
  const [scheduleImportFileName, setScheduleImportFileName] = useState("");
  const [scheduleImportResult, setScheduleImportResult] = useState<{
    createdCount: number;
    linkedToExistingCount: number;
    linkedWithinImportCount: number;
  } | null>(null);
  const [scheduleEditForm, setScheduleEditForm] = useState({
    status: "not_started" as ProjectScheduleActivityContract["status"],
    progressPercent: "0",
    plannedStart: "",
    plannedFinish: "",
    actualStart: "",
    actualFinish: "",
    owner: "",
    predecessorCodes: "",
    nextAction: ""
  });
  const [scheduleCreateForm, setScheduleCreateForm] = useState({
    code: "",
    name: "",
    phase: "",
    plannedStart: "",
    plannedFinish: "",
    predecessorCodes: "",
    owner: "",
    nextAction: ""
  });
  const [appliedScheduleSeed, setAppliedScheduleSeed] = useState("");
  const [fieldPreloadContext, setFieldPreloadContext] = useState<FieldSchedulePreloadContext | null>(null);
  const [hasAppliedFieldProjectPreload, setHasAppliedFieldProjectPreload] = useState(false);
  const [hasAppliedFieldActivityPreload, setHasAppliedFieldActivityPreload] = useState(false);
  const sourceParam = searchParams.get("source")?.trim() ?? "";
  const projectQuery = searchParams.get("projectName")?.trim().toLowerCase() ?? "";
  const frontNameParam = searchParams.get("frontName")?.trim() ?? "";
  const ownerParam = searchParams.get("owner")?.trim() ?? "";
  const summaryParam = searchParams.get("summary")?.trim() ?? "";
  const nextActionParam = searchParams.get("nextAction")?.trim() ?? "";
  const scheduleSeedName = searchParams.get("scheduleActivityName")?.trim() ?? "";
  const scheduleSeedPhase = searchParams.get("schedulePhase")?.trim() ?? "";
  const scheduleSeedOwner = searchParams.get("scheduleOwner")?.trim() ?? ownerParam;
  const scheduleSeedNextAction = searchParams.get("scheduleNextAction")?.trim() ?? nextActionParam;
  const scheduleSeedSignature = [projectQuery, scheduleSeedName, scheduleSeedPhase, scheduleSeedOwner, scheduleSeedNextAction]
    .map((value) => value.trim())
    .join("|");
  const isFieldSource = sourceParam === "field";
  const t = (es: string, en: string) => localizeText({ es, en });
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    client: "",
    segment: "Residential",
    status: "planning" as ProjectPortfolioItemContract["status"],
    stage: "Preconstruction",
    progress: "0",
    scheduleVarianceDays: "0",
    budgetHealth: "on_track" as ProjectPortfolioItemContract["budgetHealth"],
    qualityHolds: "0",
    permitBlockers: "0",
    activeFronts: "1",
    nextMilestone: ""
  });
  const createFormNumbers = useMemo(() => ({
    progress: Number(createForm.progress),
    scheduleVarianceDays: Number(createForm.scheduleVarianceDays),
    qualityHolds: Number(createForm.qualityHolds),
    permitBlockers: Number(createForm.permitBlockers),
    activeFronts: Number(createForm.activeFronts)
  }), [createForm.activeFronts, createForm.permitBlockers, createForm.progress, createForm.qualityHolds, createForm.scheduleVarianceDays]);
  const createProjectGate = useMemo(() => buildProjectCreateGate({
    code: createForm.code.trim().toUpperCase(),
    name: createForm.name.trim(),
    client: createForm.client.trim(),
    segment: createForm.segment.trim(),
    stage: createForm.stage.trim(),
    progress: createFormNumbers.progress,
    scheduleVarianceDays: createFormNumbers.scheduleVarianceDays,
    qualityHolds: createFormNumbers.qualityHolds,
    permitBlockers: createFormNumbers.permitBlockers,
    activeFronts: createFormNumbers.activeFronts,
    nextMilestone: createForm.nextMilestone.trim(),
    status: createForm.status
  }), [createForm.code, createForm.name, createForm.client, createForm.segment, createForm.stage, createForm.nextMilestone, createForm.status, createFormNumbers]);
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchProjectsOverview(activeCompany.id, {
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
          setError("Projects portfolio is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedProjectId((current) => current ?? result.focusProject?.id ?? result.projects[0]?.id ?? null);
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  useEffect(() => {
    if (!selectedProjectId) {
      setScheduleOverview(null);
      setScheduleActivityId(null);
      return;
    }

    let cancelled = false;
    setIsScheduleLoading(true);
    setScheduleError(null);

    void fetchProjectScheduleOverview(selectedProjectId, activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setScheduleOverview(null);
          setScheduleError("PROJECT_SCHEDULE_LOAD_FAILED");
          return;
        }

        setScheduleOverview(result);
        setScheduleActivityId((current) =>
          result.activities.some((activity) => activity.id === current) ? current : result.activities[0]?.id ?? null
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsScheduleLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, selectedProjectId, session.accessToken]);

  const filteredProjects = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.projects.filter((project) => {
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesBudget = budgetHealthFilter === "all" || project.budgetHealth === budgetHealthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        project.code.toLowerCase().includes(normalizedSearch) ||
        project.client.toLowerCase().includes(normalizedSearch) ||
        project.nextMilestone.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesBudget && matchesSearch;
    });
  }, [budgetHealthFilter, overview, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredProjects), [filteredProjects]);

  const selectedProject = useMemo(
    () => filteredProjects.find((project) => project.id === selectedProjectId) ?? filteredProjects[0] ?? null,
    [filteredProjects, selectedProjectId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.projectId === selectedProject?.id) ?? [],
    [overview, selectedProject]
  );

  const filteredScheduleActivities = useMemo(
    () =>
      scheduleOverview?.activities.filter(
        (activity) => scheduleStatusFilter === "all" || activity.status === scheduleStatusFilter
      ) ?? [],
    [scheduleOverview, scheduleStatusFilter]
  );

  const selectedScheduleActivity = useMemo(
    () =>
      filteredScheduleActivities.find((activity) => activity.id === scheduleActivityId) ??
      scheduleOverview?.activities.find((activity) => activity.id === scheduleActivityId) ??
      filteredScheduleActivities[0] ??
      null,
    [filteredScheduleActivities, scheduleActivityId, scheduleOverview]
  );
  const scheduleBoard = useMemo(() => buildProjectScheduleBoard(scheduleOverview), [scheduleOverview]);
  const selectedScheduleLane = useMemo(
    () => scheduleBoard.lanes.find((lane) => lane.activity.id === selectedScheduleActivity?.id) ?? null,
    [scheduleBoard.lanes, selectedScheduleActivity?.id]
  );
  const suggestedScheduleCode = useMemo(
    () =>
      suggestNextScheduleCode(
        scheduleOverview,
        scheduleCreateForm.phase || scheduleSeedPhase || selectedScheduleActivity?.phase || "Actividad"
      ),
    [scheduleCreateForm.phase, scheduleOverview, scheduleSeedPhase, selectedScheduleActivity?.phase]
  );

  const selectedStory = useMemo(
    () => buildProjectEquipmentStory(selectedProject, bridgeContext),
    [bridgeContext, selectedProject]
  );
  const projectContinuityGate = useMemo(() => buildProjectContinuityGate(selectedProject), [selectedProject]);
  const projectReportBackWindow = useMemo(() => buildProjectReportBackWindow(selectedProject), [selectedProject]);
  const projectContinuityCopy = useMemo(() => buildProjectContinuitySpanish(selectedProject), [selectedProject]);
  const projectActionFeedback = useMemo(() => resolveProjectFeedbackCopy(actionMessage), [actionMessage]);
  const projectErrorFeedback = useMemo(() => resolveProjectFeedbackCopy(actionError), [actionError]);
  const projectCreateFeedback = useMemo(() => resolveProjectFeedbackCopy(createMessage), [createMessage]);
  const scheduleErrorFeedback = useMemo(() => resolveScheduleFeedbackCopy(scheduleError), [scheduleError]);
  const scheduleMessageFeedback = useMemo(() => resolveScheduleFeedbackCopy(scheduleMessage), [scheduleMessage]);
  const operationsContextHref = useMemo(() => {
    const params = new URLSearchParams({ source: "projects" });

    if (selectedProject?.name) {
      params.set("projectName", selectedProject.name);
    }

    if (selectedScheduleActivity?.name) {
      params.set("frontName", selectedScheduleActivity.name);
      params.set("scheduleActivityName", selectedScheduleActivity.name);
    }

    if (selectedScheduleActivity?.phase) {
      params.set("schedulePhase", selectedScheduleActivity.phase);
    }

    if (selectedScheduleActivity?.owner) {
      params.set("owner", selectedScheduleActivity.owner);
    }

    const summary = nextMilestoneDraft.trim() || selectedProject?.nextMilestone || "";
    if (summary) {
      params.set("summary", summary);
    }

    const nextAction = selectedScheduleActivity?.nextAction || summary;
    if (nextAction) {
      params.set("nextAction", nextAction);
    }

    return `/operations?${params.toString()}`;
  }, [nextMilestoneDraft, selectedProject?.name, selectedProject?.nextMilestone, selectedScheduleActivity?.name, selectedScheduleActivity?.nextAction, selectedScheduleActivity?.owner, selectedScheduleActivity?.phase]);
  const fieldContextHref = useMemo(
    () => (selectedProject ? `/field?projectName=${encodeURIComponent(selectedProject.name)}` : "/field"),
    [selectedProject]
  );
  const selectedProjectStation = useMemo(
    () =>
      buildProjectSelectedStation(selectedProject, {
        field: fieldContextHref,
        operations: operationsContextHref,
        procurement: "/procurement/requisitions",
        subcontracts: "/subcontracts"
      }),
    [fieldContextHref, operationsContextHref, selectedProject]
  );
  const scheduleImportPreview = useMemo(() => {
    if (scheduleImportCsv.trim().length === 0) {
      return { rows: [] as ImportProjectScheduleActivityContract[], error: null as string | null };
    }

    try {
      return { rows: parseProjectScheduleCsv(scheduleImportCsv), error: null as string | null };
    } catch (error) {
      return {
        rows: [] as ImportProjectScheduleActivityContract[],
        error: error instanceof Error ? error.message : "PROJECT_SCHEDULE_IMPORT_FAILED"
      };
    }
  }, [scheduleImportCsv]);

  const actionOptions = useMemo(() => (selectedProject ? projectActionOptions(selectedProject) : []), [selectedProject]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    const isSelectedVisible = filteredProjects.some((project) => project.id === selectedProjectId);
    if (!isSelectedVisible) {
      setSelectedProjectId(filteredProjects[0]?.id ?? null);
    }
  }, [filteredProjects, overview, selectedProjectId]);

  useEffect(() => {
    if (!overview || !projectQuery || isFieldSource) {
      return;
    }

    const match = overview.projects.find((project) => project.name.trim().toLowerCase() === projectQuery);
    if (!match) {
      return;
    }

    setSelectedProjectId(match.id);
    setWorkspaceView("schedule");
  }, [isFieldSource, overview, projectQuery]);

  useEffect(() => {
    if (!overview || !isFieldSource || hasAppliedFieldProjectPreload) {
      return;
    }

    const projectName = searchParams.get("projectName")?.trim() ?? "";
    const context = {
      source: sourceParam,
      projectName,
      frontName: frontNameParam,
      owner: ownerParam,
      summary: summaryParam,
      nextAction: nextActionParam,
      schedulePhase: scheduleSeedPhase,
      scheduleActivityName: scheduleSeedName,
      matchedProjectId: null,
      matchedActivityId: null,
      hasClearProjectMatch: false,
      hasClearActivityMatch: false
    } satisfies FieldSchedulePreloadContext;

    const matchedProject = findClearProjectMatch(overview.projects, context);

    if (matchedProject) {
      setSelectedProjectId(matchedProject.id);
      setWorkspaceView("schedule");
    } else {
      setWorkspaceView(projectName ? "create" : "schedule");
      setSearchFilter(projectName || frontNameParam || summaryParam);
      setCreateForm((current) => ({
        ...current,
        name: projectName || current.name,
        client: ownerParam || current.client,
        nextMilestone: nextActionParam || summaryParam || current.nextMilestone
      }));
      setScheduleCreateForm((current) => ({
        ...current,
        name: scheduleSeedName || frontNameParam || summaryParam || current.name,
        phase: scheduleSeedPhase || current.phase,
        owner: scheduleSeedOwner || current.owner,
        nextAction: scheduleSeedNextAction || current.nextAction
      }));
    }

    setFieldPreloadContext({
      ...context,
      matchedProjectId: matchedProject?.id ?? null,
      matchedActivityId: null,
      hasClearProjectMatch: Boolean(matchedProject),
      hasClearActivityMatch: false
    });
    setHasAppliedFieldProjectPreload(true);
  }, [
    frontNameParam,
    hasAppliedFieldProjectPreload,
    isFieldSource,
    nextActionParam,
    overview,
    ownerParam,
    scheduleSeedName,
    scheduleSeedNextAction,
    scheduleSeedOwner,
    scheduleSeedPhase,
    searchParams,
    sourceParam,
    summaryParam
  ]);

  useEffect(() => {
    if (!selectedProject || !scheduleSeedSignature || scheduleSeedSignature === "||||") {
      return;
    }

    if (appliedScheduleSeed === scheduleSeedSignature) {
      return;
    }

    const seedStart = new Date().toISOString().slice(0, 10);
    const seedFinish = addScheduleDays(seedStart, 3);

    setScheduleCreateForm((current) => ({
      ...current,
      code: current.code || suggestNextScheduleCode(scheduleOverview, scheduleSeedPhase || current.phase || "Actividad"),
      name: scheduleSeedName || current.name,
      phase: scheduleSeedPhase || current.phase,
      owner: scheduleSeedOwner || current.owner,
      nextAction: scheduleSeedNextAction || current.nextAction,
      plannedStart: current.plannedStart || seedStart,
      plannedFinish: current.plannedFinish || seedFinish
    }));
    setWorkspaceView("schedule");
    setAppliedScheduleSeed(scheduleSeedSignature);
  }, [
    appliedScheduleSeed,
    scheduleSeedName,
    scheduleSeedNextAction,
    scheduleSeedOwner,
    scheduleSeedPhase,
    scheduleSeedSignature,
    scheduleOverview,
    selectedProject
  ]);

  useEffect(() => {
    if (!scheduleOverview || !isFieldSource || !selectedProject || !hasAppliedFieldProjectPreload || hasAppliedFieldActivityPreload) {
      return;
    }

    const matchedActivity = findClearScheduleActivityMatch(scheduleOverview.activities, {
      frontName: frontNameParam,
      owner: ownerParam,
      summary: summaryParam,
      nextAction: nextActionParam,
      schedulePhase: scheduleSeedPhase,
      scheduleActivityName: scheduleSeedName
    });

    const seedStart = new Date().toISOString().slice(0, 10);
    const seedFinish = addScheduleDays(seedStart, 3);

    if (matchedActivity) {
      setScheduleActivityId(matchedActivity.id);
    } else {
      setScheduleCreateForm((current) => ({
        ...current,
        code: current.code || suggestNextScheduleCode(scheduleOverview, scheduleSeedPhase || current.phase || "Campo"),
        name: current.name || scheduleSeedName || frontNameParam || summaryParam,
        phase: current.phase || scheduleSeedPhase,
        owner: current.owner || scheduleSeedOwner,
        nextAction: current.nextAction || scheduleSeedNextAction || summaryParam,
        plannedStart: current.plannedStart || seedStart,
        plannedFinish: current.plannedFinish || seedFinish
      }));
    }

    setWorkspaceView("schedule");
    setFieldPreloadContext((current) =>
      current
        ? {
            ...current,
            matchedProjectId: selectedProject.id,
            matchedActivityId: matchedActivity?.id ?? null,
            hasClearProjectMatch: true,
            hasClearActivityMatch: Boolean(matchedActivity)
          }
        : {
            source: sourceParam,
            projectName: searchParams.get("projectName")?.trim() ?? "",
            frontName: frontNameParam,
            owner: ownerParam,
            summary: summaryParam,
            nextAction: nextActionParam,
            schedulePhase: scheduleSeedPhase,
            scheduleActivityName: scheduleSeedName,
            matchedProjectId: selectedProject.id,
            matchedActivityId: matchedActivity?.id ?? null,
            hasClearProjectMatch: true,
            hasClearActivityMatch: Boolean(matchedActivity)
          }
    );
    setHasAppliedFieldActivityPreload(true);
  }, [
    frontNameParam,
    hasAppliedFieldActivityPreload,
    hasAppliedFieldProjectPreload,
    isFieldSource,
    nextActionParam,
    ownerParam,
    scheduleOverview,
    scheduleSeedName,
    scheduleSeedNextAction,
    scheduleSeedOwner,
    scheduleSeedPhase,
    searchParams,
    selectedProject,
    sourceParam,
    summaryParam
  ]);

  useEffect(() => {
    setNextMilestoneDraft(selectedProject?.nextMilestone ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedProjectId, selectedProject?.id, selectedProject?.nextMilestone]);

  useEffect(() => {
    if (!selectedScheduleActivity) {
      return;
    }

    setScheduleEditForm({
      status: selectedScheduleActivity.status,
      progressPercent: String(selectedScheduleActivity.progressPercent),
      plannedStart: selectedScheduleActivity.plannedStart,
      plannedFinish: selectedScheduleActivity.plannedFinish,
      actualStart: selectedScheduleActivity.actualStart ?? "",
      actualFinish: selectedScheduleActivity.actualFinish ?? "",
      owner: selectedScheduleActivity.owner,
      predecessorCodes: formatSchedulePredecessorCodes(selectedScheduleActivity.predecessorIds, scheduleOverview),
      nextAction: selectedScheduleActivity.nextAction
    });
    setScheduleError(null);
    setScheduleMessage(null);
  }, [scheduleOverview, selectedScheduleActivity]);

  useEffect(() => {
    setScheduleImportResult(null);
  }, [selectedProject?.id]);

  async function handleProjectAction(
    status: ProjectPortfolioItemContract["status"],
    suggestedMilestone: string
  ) {
    if (!selectedProject) {
      return;
    }

    const nextMilestone = nextMilestoneDraft.trim() || suggestedMilestone;
    if (nextMilestone.length < 8) {
      setActionError("NEXT_MILESTONE_TOO_SHORT");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateProjectPortfolioItem(
      selectedProject.id,
      activeCompany.id,
      {
        status,
        nextMilestone
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.code ?? response.error?.message ?? "PROJECT_UPDATE_FAILED");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const projects = current.projects.map((project) => (project.id === response.data?.id ? response.data : project));

      return {
        ...current,
        summary: recomputeSummary(projects),
        projects,
        focusProject: pickFocusProject(projects)
      };
    });

    setNextMilestoneDraft(response.data.nextMilestone);
    setActionMessage(`PROJECT_MOVED_TO_${response.data.status.toUpperCase()}`);
    setIsSaving(false);
  }

  async function handleCreateProject() {
    if (!overview) {
      return;
    }

    const payload = {
      code: createForm.code.trim().toUpperCase(),
      name: createForm.name.trim(),
      client: createForm.client.trim(),
      segment: createForm.segment.trim(),
      status: createForm.status,
      stage: createForm.stage.trim(),
      progress: Number(createForm.progress),
      scheduleVarianceDays: Number(createForm.scheduleVarianceDays),
      budgetHealth: createForm.budgetHealth,
      qualityHolds: Number(createForm.qualityHolds),
      permitBlockers: Number(createForm.permitBlockers),
      activeFronts: Number(createForm.activeFronts),
      nextMilestone: createForm.nextMilestone.trim()
    };

    const validation = validateProjectCreateForm(payload);
    if (validation) {
      setActionError(validation);
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createProjectPortfolioItem(activeCompany.id, payload, {
      apiBaseUrl,
      accessToken: session.accessToken
    });

    if (!response.data) {
      setActionError(response.error?.code ?? response.error?.message ?? "PROJECT_CREATION_FAILED");
      setIsCreating(false);
      return;
    }

    const createdProject = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const projects = [createdProject, ...current.projects];
      return {
        ...current,
        summary: recomputeSummary(projects),
        projects,
        focusProject: pickFocusProject(projects)
      };
    });

    setSelectedProjectId(createdProject.id);
    setNextMilestoneDraft(createdProject.nextMilestone);
    setCreateMessage("PROJECT_ADDED_TO_THE_ACTIVE_PORTFOLIO");
    setCreateForm({
      code: "",
      name: "",
      client: payload.client,
      segment: payload.segment,
      status: "planning",
      stage: payload.stage,
      progress: "0",
      scheduleVarianceDays: "0",
      budgetHealth: "on_track",
      qualityHolds: "0",
      permitBlockers: "0",
      activeFronts: "1",
      nextMilestone: ""
    });
    setIsCreating(false);
  }

  async function refreshProjectSchedule(projectId: string) {
    const result = await fetchProjectScheduleOverview(projectId, activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    });

    if (!result) {
      setScheduleError("PROJECT_SCHEDULE_LOAD_FAILED");
      return null;
    }

    setScheduleOverview(result);
    return result;
  }

  async function handleScheduleUpdate() {
    if (!selectedProject || !selectedScheduleActivity) {
      return;
    }

    const progressPercent = Number(scheduleEditForm.progressPercent);
    const predecessorResolution = resolveSchedulePredecessorCodes(
      scheduleEditForm.predecessorCodes,
      scheduleOverview?.activities ?? []
    );
    const today = new Date().toISOString().slice(0, 10);
    const status = scheduleEditForm.status;
    const plannedStart = scheduleEditForm.plannedStart;
    const plannedFinish = scheduleEditForm.plannedFinish;
    const owner = scheduleEditForm.owner.trim();
    const actualStart =
      status === "not_started" ? null : scheduleEditForm.actualStart || selectedScheduleActivity.actualStart || today;
    const actualFinish =
      status === "completed" ? scheduleEditForm.actualFinish || today : scheduleEditForm.actualFinish || null;

    if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
      setScheduleError("PROJECT_SCHEDULE_INVALID_PROGRESS");
      return;
    }

    if (status === "completed" && progressPercent !== 100) {
      setScheduleError("PROJECT_SCHEDULE_COMPLETION_INCOMPLETE");
      return;
    }

    if (status === "not_started" && progressPercent > 0) {
      setScheduleError("PROJECT_SCHEDULE_NOT_STARTED_INCONSISTENT");
      return;
    }

    if (status === "in_progress" && progressPercent === 0) {
      setScheduleError("PROJECT_SCHEDULE_IN_PROGRESS_INCONSISTENT");
      return;
    }

    if (!plannedStart || !plannedFinish || plannedStart > plannedFinish || owner.length < 3) {
      setScheduleError("PROJECT_SCHEDULE_INVALID_DATES");
      return;
    }

    if (actualStart && actualFinish && actualStart > actualFinish) {
      setScheduleError("PROJECT_SCHEDULE_INVALID_ACTUAL_DATES");
      return;
    }

    if (predecessorResolution.missingCodes.length > 0) {
      setScheduleError("PROJECT_SCHEDULE_PREDECESSOR_NOT_FOUND");
      return;
    }

    if (predecessorResolution.predecessorIds.includes(selectedScheduleActivity.id)) {
      setScheduleError("PROJECT_SCHEDULE_INVALID_PREDECESSORS");
      return;
    }

    setIsScheduleSaving(true);
    setScheduleError(null);
    setScheduleMessage(null);
    const response = await updateProjectScheduleActivity(
      selectedProject.id,
      selectedScheduleActivity.id,
      activeCompany.id,
      {
        status,
        progressPercent,
        plannedStart,
        plannedFinish,
        actualStart,
        actualFinish,
        predecessorIds: predecessorResolution.predecessorIds,
        owner,
        nextAction: scheduleEditForm.nextAction.trim()
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setScheduleError(response.error?.code ?? "PROJECT_SCHEDULE_UPDATE_FAILED");
      setIsScheduleSaving(false);
      return;
    }

    await refreshProjectSchedule(selectedProject.id);
    setScheduleMessage("PROJECT_SCHEDULE_ACTIVITY_UPDATED");
    setIsScheduleSaving(false);
  }

  async function handleScheduleCreate() {
    if (!selectedProject) {
      return;
    }

    const payload = {
      code: scheduleCreateForm.code.trim().toUpperCase(),
      name: scheduleCreateForm.name.trim(),
      phase: scheduleCreateForm.phase.trim(),
      plannedStart: scheduleCreateForm.plannedStart,
      plannedFinish: scheduleCreateForm.plannedFinish,
      predecessorIds: resolveSchedulePredecessorCodes(
        scheduleCreateForm.predecessorCodes,
        scheduleOverview?.activities ?? []
      ),
      owner: scheduleCreateForm.owner.trim(),
      nextAction: scheduleCreateForm.nextAction.trim()
    };

    if (payload.predecessorIds.missingCodes.length > 0) {
      setScheduleError("PROJECT_SCHEDULE_PREDECESSOR_NOT_FOUND");
      return;
    }

    if (
      ![payload.code, payload.name, payload.phase, payload.owner, payload.nextAction].every((value) => value.length >= 3) ||
      !payload.plannedStart ||
      !payload.plannedFinish ||
      payload.plannedStart > payload.plannedFinish
    ) {
      setScheduleError("PROJECT_SCHEDULE_INVALID_CREATE_INPUT");
      return;
    }

    setIsScheduleSaving(true);
    setScheduleError(null);
    setScheduleMessage(null);
    const response = await createProjectScheduleActivity(selectedProject.id, activeCompany.id, {
      ...payload,
      predecessorIds: payload.predecessorIds.predecessorIds
    }, {
      apiBaseUrl,
      accessToken: session.accessToken
    });

    if (!response.data) {
      setScheduleError(response.error?.code ?? "PROJECT_SCHEDULE_CREATE_FAILED");
      setIsScheduleSaving(false);
      return;
    }

    const refreshed = await refreshProjectSchedule(selectedProject.id);
    setScheduleActivityId(response.data.id);
    setScheduleCreateForm({
      code: "",
      name: "",
      phase: "",
      plannedStart: "",
      plannedFinish: "",
      predecessorCodes: "",
      owner: "",
      nextAction: ""
    });
    setScheduleMessage(
      refreshed ? "PROJECT_SCHEDULE_ACTIVITY_CREATED" : "PROJECT_SCHEDULE_ACTIVITY_CREATED_WITHOUT_REFRESH"
    );
    setIsScheduleSaving(false);
  }

  async function handleScheduleImportFile(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      setScheduleImportCsv(content);
      setScheduleImportFileName(file.name);
      setScheduleError(null);
      setScheduleMessage(null);
      setScheduleImportResult(null);
    } catch {
      setScheduleError("PROJECT_SCHEDULE_IMPORT_FILE_READ_FAILED");
    }
  }

  async function handleScheduleImport() {
    if (!selectedProject) {
      return;
    }

    if (scheduleImportCsv.trim().length === 0) {
      setScheduleError("PROJECT_SCHEDULE_IMPORT_EMPTY");
      return;
    }

    let activities: ImportProjectScheduleActivityContract[];
    try {
      activities = parseProjectScheduleCsv(scheduleImportCsv);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : "PROJECT_SCHEDULE_IMPORT_FAILED");
      return;
    }

    setIsScheduleImporting(true);
    setScheduleError(null);
    setScheduleMessage(null);
    setScheduleImportResult(null);

    const response = await importProjectScheduleActivities(
      selectedProject.id,
      activeCompany.id,
      { activities },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setScheduleError(response.error?.code ?? response.error?.message ?? "PROJECT_SCHEDULE_IMPORT_FAILED");
      setIsScheduleImporting(false);
      return;
    }

    const importResult = response.data;
    const refreshed = await refreshProjectSchedule(selectedProject.id);
    if (refreshed && importResult.createdCodes.length > 0) {
      const latestImported =
        refreshed.activities.find((activity) => activity.code === importResult.createdCodes[importResult.createdCodes.length - 1]) ?? null;
      if (latestImported) {
        setScheduleActivityId(latestImported.id);
      }
    }

    setScheduleImportResult({
      createdCount: importResult.createdCount,
      linkedToExistingCount: importResult.linkedToExistingCount,
      linkedWithinImportCount: importResult.linkedWithinImportCount
    });
    setScheduleMessage("PROJECT_SCHEDULE_IMPORT_COMPLETED");
    setScheduleImportCsv("");
    setScheduleImportFileName("");
    setIsScheduleImporting(false);
  }

  function handleScheduleCodeSuggestion() {
    const phase = scheduleCreateForm.phase || scheduleSeedPhase || selectedScheduleActivity?.phase || "Actividad";
    setScheduleCreateForm((current) => ({
      ...current,
      code: suggestedScheduleCode,
      phase: current.phase || phase
    }));
  }

  function handleScheduleChainFromSelected() {
    if (!selectedScheduleActivity) {
      return;
    }

    const plannedStart = addScheduleDays(selectedScheduleActivity.plannedFinish, 1);
    const plannedFinish = addScheduleDays(plannedStart, 3);
    setScheduleCreateForm((current) => ({
      ...current,
      code: current.code || suggestedScheduleCode,
      phase: current.phase || selectedScheduleActivity.phase,
      plannedStart: current.plannedStart || plannedStart,
      plannedFinish: current.plannedFinish || plannedFinish,
      predecessorCodes: current.predecessorCodes || selectedScheduleActivity.code,
      owner: current.owner || selectedScheduleActivity.owner,
      nextAction:
        current.nextAction ||
        t(
          `Continuar después de ${selectedScheduleActivity.code} y confirmar liberación del siguiente frente.`,
          `Continue after ${selectedScheduleActivity.code} and confirm release for the next front.`
        )
    }));
  }

  return (
    <AppShell
      title={{ es: "Obras y proyectos", en: "Projects and site control" }}
      eyebrow={{ es: "Control de ejecución", en: "Execution control" }}
      description={{
        es: "Selecciona una obra, confirma su continuidad y envía cada bloqueo al frente que puede resolverlo.",
        en: "Select a project, confirm continuity and route every blocker to the team that can resolve it."
      }}
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title={t("Proyectos", "Projects")}>
        {overview ? (
          <>
            <section className="projectWorkbench">
              <div className="projectWorkbenchLead">
                <span className="eyebrow">
                  {t("Obra en control", "Project control")}
                  <span className="mono">{t("corte operativo", "operating cut")}</span>
                </span>
                <h2>{selectedProject?.name ?? t("Selecciona una obra", "Select a project")}</h2>
                <p>
                  {t(
                    "Esta vista concentra la decisión inmediata. Actualiza el hito, define el estado y entra al módulo que realmente resolverá el bloqueo.",
                    "This view concentrates the immediate decision. Update the milestone, define the status and enter the module that will resolve the blocker."
                  )}
                </p>
                <label className="projectContextControl">
                  <span>{t("Obra activa", "Active project")}</span>
                  <select className="selectField" value={selectedProject?.id ?? ""} onChange={(event) => setSelectedProjectId(event.target.value || null)}>
                    {overview.projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.code} · {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="projectWorkbenchSnapshot">
                <div className="row gap wrap">
                  {selectedProject ? <Badge tone={statusTone(selectedProject.status)}>{localizeText(projectStatusLabel(selectedProject.status))}</Badge> : null}
                  <Badge tone={projectContinuityGate.tone}>{t(projectContinuityCopy.label, projectContinuityGate.label)}</Badge>
                </div>
                <strong>{selectedProject?.nextMilestone ?? t("Sin hito definido", "No milestone defined")}</strong>
                <p>{selectedProject?.client ?? t("Selecciona una obra para iniciar", "Select a project to begin")}</p>
                <div className="projectWorkbenchMetrics">
                  <div><strong>{selectedProject?.progress ?? 0}%</strong><span>{t("avance", "progress")}</span></div>
                  <div><strong>{selectedProject?.scheduleVarianceDays.toFixed(1) ?? "0.0"}</strong><span>{t("días var.", "days variance")}</span></div>
                  <div><strong>{selectedProject?.activeFronts ?? 0}</strong><span>{t("frentes", "fronts")}</span></div>
                </div>
              </div>
            </section>

            <div className="projectWorkspaceTabs" role="tablist" aria-label={t("Vistas de proyectos", "Project views")}>
              {([
                ["control", t("Control", "Control")],
                ["portfolio", t("Obras", "Projects")],
                ["schedule", t("Programa", "Schedule")],
                ["create", t("Alta", "Create")]
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

            {fieldPreloadContext ? (
              <section className="grid cols1">
                <Card
                  title={t("Contexto recibido desde campo", "Context received from field")}
                  description={
                    fieldPreloadContext.hasClearProjectMatch && fieldPreloadContext.hasClearActivityMatch
                      ? t(
                          "Se encontró una obra y una actividad claras; el tablero quedó seleccionado automáticamente.",
                          "A clear project and activity were found; the board was selected automatically."
                        )
                      : fieldPreloadContext.hasClearProjectMatch
                        ? t(
                            "Se encontró una obra clara; la actividad quedó como contexto visible y el formulario de alta está listo.",
                            "A clear project was found; the activity stayed as visible context and the creation form is ready."
                          )
                        : t(
                            "No hubo match claro de obra; el contexto quedó visible y el alta de obra o actividad quedó preparada para continuar.",
                            "No clear project match was found; the context stays visible and the project or activity intake is prepared to continue."
                          )
                  }
                  aside={<Badge tone="info">Precargado desde campo / Preloaded from field</Badge>}
                >
                  <div className="detailGrid">
                    {fieldPreloadContext.projectName ? (
                      <div className="detailRow"><div className="detailLabel">{t("Proyecto", "Project")}</div><div>{fieldPreloadContext.projectName}</div></div>
                    ) : null}
                    {fieldPreloadContext.frontName ? (
                      <div className="detailRow"><div className="detailLabel">{t("Frente", "Front")}</div><div>{fieldPreloadContext.frontName}</div></div>
                    ) : null}
                    {fieldPreloadContext.scheduleActivityName ? (
                      <div className="detailRow"><div className="detailLabel">{t("Actividad objetivo", "Target activity")}</div><div>{fieldPreloadContext.scheduleActivityName}</div></div>
                    ) : null}
                    {fieldPreloadContext.schedulePhase ? (
                      <div className="detailRow"><div className="detailLabel">{t("Fase", "Phase")}</div><div>{fieldPreloadContext.schedulePhase}</div></div>
                    ) : null}
                    {fieldPreloadContext.owner ? (
                      <div className="detailRow"><div className="detailLabel">{t("Responsable", "Owner")}</div><div>{fieldPreloadContext.owner}</div></div>
                    ) : null}
                    {fieldPreloadContext.summary ? (
                      <div className="detailRow"><div className="detailLabel">{t("Resumen", "Summary")}</div><div>{fieldPreloadContext.summary}</div></div>
                    ) : null}
                    {fieldPreloadContext.nextAction ? (
                      <div className="detailRow"><div className="detailLabel">{t("Siguiente acción", "Next action")}</div><div>{fieldPreloadContext.nextAction}</div></div>
                    ) : null}
                    <div className="detailRow">
                      <div className="detailLabel">{t("Estado del match", "Match status")}</div>
                      <div>
                        {fieldPreloadContext.hasClearProjectMatch && fieldPreloadContext.hasClearActivityMatch
                          ? t("Match claro de obra y actividad aplicado.", "Clear project and activity match applied.")
                          : fieldPreloadContext.hasClearProjectMatch
                            ? t("Match claro de obra aplicado; actividad solo visible como contexto.", "Clear project match applied; activity kept only as visible context.")
                            : t("Sin match claro; contexto visible y formularios preparados.", "No clear match; context is visible and the forms are prepared.")}
                      </div>
                    </div>
                  </div>
                </Card>
              </section>
            ) : null}

            {workspaceView === "control" ? (
              <>
                <section className="grid cols3">
                  <KpiCard label={t("Avance físico", "Physical progress")} value={`${selectedProject?.progress ?? 0}%`} footnote={t("Progreso declarado para la obra seleccionada.", "Declared progress for the selected project.")} />
                  <KpiCard label={t("Bloqueos de calidad", "Quality holds")} value={String(selectedProject?.qualityHolds ?? 0)} footnote={t("No cierres el hito sin resolverlos.", "Do not close the milestone until they are resolved.")} />
                  <KpiCard label={t("Bloqueos de permiso", "Permit blockers")} value={String(selectedProject?.permitBlockers ?? 0)} footnote={t("Requieren responsable y fecha explícita.", "Require an explicit owner and date.")} />
                </section>
                <section className="grid cols2">
                  <Card title={t("Programación inmediata y siguiente hito", "Immediate schedule and next milestone")} description={t("Usa la obra seleccionada como estación operable: explica por qué importa ahora, quién responde ya, cuál es el siguiente salto y qué debe regresar confirmado.", "Use the selected project as an operable station: explain why it matters now, who owns it now, what the next jump is and what must come back confirmed.")}>
                    {selectedProject ? (
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">{t("Por qué importa ahora", "Why it matters now")}</div><div>{t(selectedProjectStation.whyNow.es, selectedProjectStation.whyNow.en)}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Módulo responsable inmediato", "Immediate responsible module")}</div><div>{t(selectedProjectStation.immediateModule.es, selectedProjectStation.immediateModule.en)}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Siguiente salto operativo", "Next operating jump")}</div><div>{t(selectedProjectStation.nextJump.es, selectedProjectStation.nextJump.en)}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Debe regresar confirmado", "Must return confirmed")}</div><div>{t(selectedProjectStation.returnCommitment.es, selectedProjectStation.returnCommitment.en)}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Etapa actual", "Current stage")}</div><div>{selectedProject.stage}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Última señal de campo", "Latest field signal")}</div><div><Badge tone={selectedProject.latestDailyLogStatus === "flagged" ? "danger" : selectedProject.latestDailyLogStatus === "approved" ? "success" : "warning"}>{selectedProject.latestDailyLogStatus === "flagged" ? t("Con alerta", "Flagged") : selectedProject.latestDailyLogStatus === "approved" ? t("Aprobada", "Approved") : t("En revisión", "Submitted")}</Badge></div></div>
                        <label className="detailRow"><div className="detailLabel">{t("Siguiente hito programado", "Next scheduled milestone")}</div><input className="field" value={nextMilestoneDraft} onChange={(event) => setNextMilestoneDraft(event.target.value)} placeholder={t("Ej. Liberar cimentación, arrancar columnas y confirmar frente responsable", "E.g. Release foundations, start columns and confirm the responsible front")} /></label>
                      </div>
                    ) : <EmptyState title={t("Sin obra para programar", "No project selected for scheduling")} description={t("Selecciona una obra para ajustar su siguiente hito y dejar claro qué sigue en este corte.", "Select a project to adjust its next milestone and make the next operating move explicit.")} />}
                    {selectedProject ? (
                      <div className="row gap wrap" style={{ marginTop: 20 }}>
                        <button type="button" className="button" disabled={isSaving || nextMilestoneDraft.trim().length < 8} onClick={() => void handleProjectAction(selectedProject.status, selectedProject.nextMilestone)}>
                          {isSaving ? t("Guardando...", "Saving...") : t("Guardar programación", "Save schedule")}
                        </button>
                      </div>
                    ) : null}
                  </Card>

                  <Card title={t("Estado que debe reflejar el programa", "Status the schedule should reflect")} description={t(projectContinuityCopy.description, projectContinuityGate.summary)} aside={<Badge tone={projectContinuityGate.tone}>{t(projectContinuityCopy.label, projectContinuityGate.label)}</Badge>}>
                    <p className="sectionText">{t("Usa este cambio solo cuando el programa real ya pueda sostenerlo. Si hay dudas, conserva el estado actual y actualiza el hito.", "Use this change only when the real execution schedule can support it. If there is doubt, keep the current status and update the milestone instead.")}</p>
                    <div className="row gap wrap" style={{ marginTop: 18 }}>
                      {selectedProject
                        ? actionOptions.map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              className={option.status === "blocked" ? "buttonGhost" : "button"}
                              disabled={
                                isSaving ||
                                (option.status === "active" && selectedProject.permitBlockers > 2) ||
                                (option.status === "active" && selectedProject.latestDailyLogStatus === "flagged") ||
                                (option.status === "closed" && (selectedProject.qualityHolds > 0 || selectedProject.permitBlockers > 0 || selectedProject.progress < 100 || selectedProject.latestDailyLogStatus === "flagged"))
                              }
                              onClick={() => void handleProjectAction(option.status, option.nextMilestone)}
                            >
                              {isSaving ? t("Guardando...", "Saving...") : localizeText(projectActionLabel(option.status))}
                            </button>
                          ))
                        : null}
                    </div>
                    {projectActionFeedback ? <p className="formSuccess">{localizeText(projectActionFeedback)}</p> : null}
                    {projectErrorFeedback ? <p className="formError">{localizeText(projectErrorFeedback)}</p> : null}
                  </Card>
                </section>
                <section className="grid cols2">
                  <Card title={t("Ir al frente que resuelve", "Go to the resolving team")} description={t("Prioriza continuidad real entre field, operations, procurement y subcontracts desde la misma selección.", "Prioritize real continuity across field, operations, procurement and subcontracts from the same selection.")}>
                    <div className="row gap wrap">
                      {selectedProjectStation.links.map((link, index) => (
                        <Link key={`${link.href}-${link.label.en}`} className={index === 0 ? "button" : "buttonGhost"} href={link.href}>
                          {t(link.label.es, link.label.en)}
                        </Link>
                      ))}
                    </div>
                  </Card>
                  <Card title={t("Riesgo operativo", "Operational risk")} description={t("Vista corta para decidir si el siguiente hito es defendible.", "Short view to decide whether the next milestone is defensible.")}>
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Calidad", "Quality")}</div><div>{selectedProject ? `${selectedProject.qualityReleaseReadiness}% ${t("listo para liberar", "release readiness")}` : "-"}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Subcontrato", "Subcontract")}</div><div>{selectedProject ? selectedProject.subcontractHealth : "-"}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Equipo", "Equipment")}</div><div>{t(selectedStory?.fieldExecution ? "Revisar la afectación en equipos antes del siguiente corte." : "Sin señal crítica de equipo en este momento.", selectedStory?.fieldExecution ?? "No equipment signal available.")}</div></div>
                    </div>
                  </Card>
                </section>
              </>
            ) : null}

            {workspaceView === "portfolio" ? (
              <section className="grid cols2">
                <Card title={t("Cartera de obras", "Project portfolio")} description={t("Filtra, selecciona una obra y regresa a Control para actuar.", "Filter, select a project and return to Control to act.")} aside={<Badge tone={filteredSummary.executionRiskProjects > 0 ? "danger" : "success"}>{filteredSummary.executionRiskProjects} {t("en riesgo", "at risk")}</Badge>}>
                  <FilterBar summary={`${filteredProjects.length} ${t("obras visibles", "visible projects")}`}>
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">{t("Todos los estados", "All statuses")}</option>
                      <option value="planning">{t("Planeación", "Planning")}</option>
                      <option value="active">{t("Activa", "Active")}</option>
                      <option value="at_risk">{t("En riesgo", "At risk")}</option>
                      <option value="blocked">{t("Bloqueada", "Blocked")}</option>
                      <option value="closed">{t("Cerrada", "Closed")}</option>
                    </select>
                    <select className="field" value={budgetHealthFilter} onChange={(event) => setBudgetHealthFilter(event.target.value as typeof budgetHealthFilter)}>
                      <option value="all">{t("Todo el presupuesto", "All budget posture")}</option>
                      <option value="on_track">{t("En control", "On track")}</option>
                      <option value="warning">{t("Con presión", "Warning")}</option>
                      <option value="critical">{t("Crítico", "Critical")}</option>
                    </select>
                    <input className="field" type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Buscar obra, código o cliente", "Search project, code or client")} />
                  </FilterBar>
                  {filteredProjects.length > 0 ? (
                    <div className="list">
                      {filteredProjects.map((project) => (
                        <button key={project.id} type="button" className={`listItem ${selectedProject?.id === project.id ? "listItemSelected" : ""}`} onClick={() => { setSelectedProjectId(project.id); setWorkspaceView("control"); }}>
                          <div><strong>{project.name}</strong><p>{project.code} · {project.client} · {project.progress}% {t("avance", "progress")}</p></div>
                          <Badge tone={statusTone(project.status)}>{localizeText(projectStatusLabel(project.status))}</Badge>
                        </button>
                      ))}
                    </div>
                  ) : <EmptyState title={t("Sin obras para estos filtros", "No projects for these filters")} description={t("Limpia los filtros o da de alta una nueva obra.", "Clear filters or create a new project.")} />}
                </Card>
                <Card title={selectedProject?.name ?? t("Selecciona una obra", "Select a project")} description={selectedProject ? `${selectedProject.code} · ${selectedProject.client}` : t("Elige una obra desde la cartera.", "Choose a project from the portfolio.")}>
                  {selectedProject ? (
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Estado", "Status")}</div><div><Badge tone={statusTone(selectedProject.status)}>{localizeText(projectStatusLabel(selectedProject.status))}</Badge></div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Avance / desviación", "Progress / variance")}</div><div>{selectedProject.progress}% · {selectedProject.scheduleVarianceDays.toFixed(1)} {t("días", "days")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Hito", "Milestone")}</div><div>{selectedProject.nextMilestone}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Frentes activos", "Active fronts")}</div><div>{selectedProject.activeFronts}</div></div>
                    </div>
                  ) : null}
                  {selectedProject ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" onClick={() => setWorkspaceView("control")}>{t("Abrir control", "Open control")}</button></div> : null}
                </Card>
              </section>
            ) : null}

            {workspaceView === "schedule" ? (
              <section className="grid cols2">
                <Card
                  title={t("Programa de obra", "Project schedule")}
                  description={t(
                    "Selecciona una actividad y mantiene visible la secuencia que libera el siguiente frente.",
                    "Select an activity and keep the sequence that releases the next front visible."
                  )}
                  aside={
                    scheduleOverview ? (
                      <Badge tone={scheduleOverview.summary.blockedActivities > 0 ? "danger" : "info"}>
                        {scheduleOverview.summary.blockedActivities} {t("bloqueadas", "blocked")}
                      </Badge>
                    ) : null
                  }
                >
                  {scheduleOverview ? (
                    <>
                      <div className="projectWorkbenchMetrics" style={{ marginBottom: 18 }}>
                        <div><strong>{scheduleOverview.summary.actualProgress}%</strong><span>{t("avance real", "actual progress")}</span></div>
                        <div><strong>{scheduleOverview.summary.plannedProgress}%</strong><span>{t("plan", "planned")}</span></div>
                        <div><strong>{scheduleOverview.summary.scheduleVarianceDays}</strong><span>{t("días var.", "days variance")}</span></div>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gap: 12,
                          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                          marginBottom: 18
                        }}
                      >
                        <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "14px 16px", background: "rgba(255, 255, 255, 0.86)" }}>
                          <span className="detailLabel">{t("Listas para arrancar", "Ready to start")}</span>
                          <strong>{scheduleBoard.readyToStartCount}</strong>
                          <span>{t("sin bloquear la secuencia", "without blocking sequence")}</span>
                        </div>
                        <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "14px 16px", background: "rgba(255, 255, 255, 0.86)" }}>
                          <span className="detailLabel">{t("Arrancan esta semana", "Starting this week")}</span>
                          <strong>{scheduleBoard.startsThisWeekCount}</strong>
                          <span>{t("según la línea base", "according to baseline")}</span>
                        </div>
                        <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "14px 16px", background: "rgba(255, 255, 255, 0.86)" }}>
                          <span className="detailLabel">{t("Con atraso", "Delayed")}</span>
                          <strong>{scheduleBoard.delayedCount}</strong>
                          <span>{t("requieren contención", "need containment")}</span>
                        </div>
                        <div style={{ display: "grid", gap: 4, borderRadius: 18, border: "1px solid rgba(21, 31, 41, 0.08)", padding: "14px 16px", background: "rgba(255, 255, 255, 0.86)" }}>
                          <span className="detailLabel">{t("Fases activas", "Active phases")}</span>
                          <strong>{scheduleBoard.phaseCount}</strong>
                          <span>
                            {scheduleBoard.baselineStart && scheduleBoard.baselineFinish
                              ? `${scheduleBoard.baselineStart} → ${scheduleBoard.baselineFinish}`
                              : t("sin línea base", "no baseline")}
                          </span>
                        </div>
                      </div>
                      <FilterBar summary={`${filteredScheduleActivities.length} ${t("actividades visibles", "visible activities")}`}>
                        {isFieldSource ? (
                          <Badge tone="info">Precargado desde campo / Preloaded from field</Badge>
                        ) : null}
                        <select className="field" value={scheduleStatusFilter} onChange={(event) => setScheduleStatusFilter(event.target.value as typeof scheduleStatusFilter)}>
                          <option value="all">{t("Todos los estados", "All statuses")}</option>
                          <option value="not_started">{t("Sin iniciar", "Not started")}</option>
                          <option value="in_progress">{t("En proceso", "In progress")}</option>
                          <option value="blocked">{t("Bloqueada", "Blocked")}</option>
                          <option value="completed">{t("Terminada", "Completed")}</option>
                        </select>
                      </FilterBar>
                      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
                        <div style={{ minWidth: 760, display: "grid", gap: 12 }}>
                          {scheduleBoard.lanes
                            .filter((lane) => scheduleStatusFilter === "all" || lane.activity.status === scheduleStatusFilter)
                            .map((lane) => (
                              <button
                                key={lane.activity.id}
                                type="button"
                                onClick={() => setScheduleActivityId(lane.activity.id)}
                                className={selectedScheduleActivity?.id === lane.activity.id ? "listItemSelected" : ""}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "minmax(220px, 280px) minmax(320px, 1fr) auto",
                                  gap: 16,
                                  alignItems: "center",
                                  textAlign: "left",
                                  borderRadius: 20,
                                  border: selectedScheduleActivity?.id === lane.activity.id ? "1px solid rgba(232, 114, 61, 0.45)" : "1px solid rgba(21, 31, 41, 0.08)",
                                  background:
                                    selectedScheduleActivity?.id === lane.activity.id
                                      ? "linear-gradient(135deg, rgba(255, 244, 236, 0.96), rgba(255, 255, 255, 0.98))"
                                      : "rgba(255, 255, 255, 0.92)",
                                  padding: "16px 18px",
                                  boxShadow:
                                    selectedScheduleActivity?.id === lane.activity.id
                                      ? "0 18px 30px rgba(232, 114, 61, 0.12)"
                                      : "0 10px 24px rgba(21, 31, 41, 0.05)"
                                }}
                              >
                                <div style={{ display: "grid", gap: 6 }}>
                                  <strong>{lane.activity.code} · {lane.activity.name}</strong>
                                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                                    {lane.activity.phase} · {lane.activity.owner}
                                  </span>
                                  <span style={{ color: "var(--muted)", fontSize: 13 }}>
                                    {lane.predecessorLabels.length > 0
                                      ? `${t("Depende de", "Depends on")} ${lane.predecessorLabels.length} ${t("actividad(es)", "activity/activities")}`
                                      : t("Sin predecesoras", "No predecessors")}
                                  </span>
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      fontSize: 12,
                                      color: "var(--muted)"
                                    }}
                                  >
                                    <span>{lane.activity.plannedStart}</span>
                                    <span>{lane.activity.plannedFinish}</span>
                                  </div>
                                  <div
                                    style={{
                                      position: "relative",
                                      height: 48,
                                      borderRadius: 18,
                                      background: "linear-gradient(180deg, rgba(236, 240, 243, 0.96), rgba(247, 249, 251, 0.98))",
                                      overflow: "hidden"
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "absolute",
                                        inset: "50% 14px auto 14px",
                                        height: 4,
                                        borderRadius: 999,
                                        transform: "translateY(-50%)",
                                        background: "rgba(21, 31, 41, 0.08)"
                                      }}
                                    />
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: `${lane.leftPercent}%`,
                                        width: `${lane.widthPercent}%`,
                                        top: 10,
                                        bottom: 10,
                                        borderRadius: 999,
                                        background:
                                          lane.activity.status === "completed"
                                            ? "linear-gradient(135deg, #2f9e44, #6dcf7c)"
                                            : lane.isDelayed
                                              ? "linear-gradient(135deg, #c94747, #f08b68)"
                                              : lane.isReadyToStart
                                                ? "linear-gradient(135deg, #2463eb, #62a5ff)"
                                                : "linear-gradient(135deg, #d8dee4, #edf1f5)"
                                      }}
                                    >
                                      {lane.progressPercent > 0 ? (
                                        <div
                                          style={{
                                            width: `${lane.progressPercent}%`,
                                            height: "100%",
                                            borderRadius: 999,
                                            background: "rgba(255, 255, 255, 0.28)"
                                          }}
                                        />
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: "grid", justifyItems: "end", gap: 8 }}>
                                  <Badge tone={scheduleStatusTone(lane.activity.status)}>
                                    {localizeText(scheduleStatusLabel(lane.activity.status))}
                                  </Badge>
                                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                                    {lane.isDelayed
                                      ? `${t("Atraso", "Delay")} ${lane.varianceDays} ${t("d", "d")}`
                                      : lane.isReadyToStart
                                        ? t("Lista para arranque", "Ready for start")
                                        : lane.startsThisWeek
                                          ? t("Arranca esta semana", "Starts this week")
                                          : `${lane.activity.progressPercent}% ${t("real", "actual")}`}
                                  </span>
                                </div>
                              </button>
                            ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title={isScheduleLoading ? t("Cargando programa", "Loading schedule") : t("Programa no disponible", "Schedule unavailable")}
                      description={t("Selecciona una obra o vuelve a intentar la carga del programa.", "Select a project or retry loading the schedule.")}
                    />
                  )}
                </Card>

                <div className="stack">
                  <Card
                    title={selectedScheduleActivity ? `${selectedScheduleActivity.code} · ${selectedScheduleActivity.name}` : t("Selecciona una actividad", "Select an activity")}
                    description={t(
                      "Actualiza solo el estado y la evidencia que realmente cambió en el frente.",
                      "Update only the status and evidence that actually changed in the field."
                    )}
                    aside={selectedScheduleActivity ? <Badge tone={scheduleStatusTone(selectedScheduleActivity.status)}>{localizeText(scheduleStatusLabel(selectedScheduleActivity.status))}</Badge> : null}
                  >
                    {selectedScheduleActivity ? (
                      <>
                        <div className="detailGrid">
                          <div className="detailRow"><div className="detailLabel">{t("Fase / responsable", "Phase / owner")}</div><div>{selectedScheduleActivity.phase} · {selectedScheduleActivity.owner}</div></div>
                          <div className="detailRow"><div className="detailLabel">{t("Ventana base", "Baseline window")}</div><div>{selectedScheduleActivity.plannedStart} → {selectedScheduleActivity.plannedFinish}</div></div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Predecesoras", "Predecessors")}</div>
                            <div>
                              {selectedScheduleLane?.predecessorLabels.length
                                ? selectedScheduleLane.predecessorLabels.join(" / ")
                                : t("Sin predecesoras", "No predecessors")}
                            </div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Pulso de liberación", "Release pulse")}</div>
                            <div>
                              {selectedScheduleLane?.isDelayed
                                ? `${t("Actividad atrasada", "Delayed activity")} · ${selectedScheduleLane.varianceDays} ${t("días fuera de línea base", "days behind baseline")}`
                                : selectedScheduleLane?.isReadyToStart
                                  ? t("Lista para iniciar sin romper secuencia", "Ready to start without breaking sequence")
                                  : selectedScheduleLane?.startsThisWeek
                                    ? t("Debe arrancar esta semana", "Should start this week")
                                    : t("Mantén visible la siguiente acción del frente", "Keep the next field action visible")}
                            </div>
                          </div>
                        </div>
                        <div className="captureCompactGrid" style={{ marginTop: 18 }}>
                          <label className="captureField"><span>{t("Estado", "Status")}</span><select className="selectField" value={scheduleEditForm.status} onChange={(event) => setScheduleEditForm((current) => ({ ...current, status: event.target.value as ProjectScheduleActivityContract["status"] }))}><option value="not_started">{t("Sin iniciar", "Not started")}</option><option value="in_progress">{t("En proceso", "In progress")}</option><option value="blocked">{t("Bloqueada", "Blocked")}</option><option value="completed">{t("Terminada", "Completed")}</option></select></label>
                          <label className="captureField"><span>{t("Avance real %", "Actual progress %")}</span><input className="field" type="number" min="0" max="100" value={scheduleEditForm.progressPercent} onChange={(event) => setScheduleEditForm((current) => ({ ...current, progressPercent: event.target.value }))} /></label>
                          <label className="captureField"><span>{t("Inicio plan", "Planned start")}</span><input className="field" type="date" value={scheduleEditForm.plannedStart} onChange={(event) => setScheduleEditForm((current) => ({ ...current, plannedStart: event.target.value }))} /></label>
                          <label className="captureField"><span>{t("Fin plan", "Planned finish")}</span><input className="field" type="date" value={scheduleEditForm.plannedFinish} onChange={(event) => setScheduleEditForm((current) => ({ ...current, plannedFinish: event.target.value }))} /></label>
                          <label className="captureField"><span>{t("Inicio real", "Actual start")}</span><input className="field" type="date" value={scheduleEditForm.actualStart} onChange={(event) => setScheduleEditForm((current) => ({ ...current, actualStart: event.target.value }))} /></label>
                          <label className="captureField"><span>{t("Fin real", "Actual finish")}</span><input className="field" type="date" value={scheduleEditForm.actualFinish} onChange={(event) => setScheduleEditForm((current) => ({ ...current, actualFinish: event.target.value }))} /></label>
                          <label className="captureField"><span>{t("Responsable", "Owner")}</span><input className="field" value={scheduleEditForm.owner} onChange={(event) => setScheduleEditForm((current) => ({ ...current, owner: event.target.value }))} placeholder={t("Superintendencia", "Superintendence")} /></label>
                          <label className="captureField" style={{ gridColumn: "1 / -1" }}><span>{t("Dependencias por código", "Dependencies by code")}</span><input className="field" value={scheduleEditForm.predecessorCodes} onChange={(event) => setScheduleEditForm((current) => ({ ...current, predecessorCodes: event.target.value.toUpperCase() }))} placeholder={t("Ej. CIV-010, EST-020", "E.g. CIV-010, EST-020")} /></label>
                          <label className="captureField" style={{ gridColumn: "1 / -1" }}><span>{t("Siguiente acción", "Next action")}</span><input className="field" value={scheduleEditForm.nextAction} onChange={(event) => setScheduleEditForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                        </div>
                        <div className="row gap wrap" style={{ marginTop: 18 }}>
                          <button type="button" className="button" disabled={isScheduleSaving || scheduleEditForm.nextAction.trim().length < 3} onClick={() => void handleScheduleUpdate()}>{isScheduleSaving ? t("Guardando...", "Saving...") : t("Guardar avance", "Save progress")}</button>
                          <Link className="buttonGhost" href={selectedProject ? `/field?projectName=${encodeURIComponent(selectedProject.name)}` : "/field"}>{t("Abrir frente", "Open field")}</Link>
                          <Link className="buttonGhost" href="/daily-log">{t("Abrir bitácora", "Open daily log")}</Link>
                        </div>
                      </>
                    ) : (
                      <EmptyState title={t("Sin actividad seleccionada", "No activity selected")} description={t("Elige una actividad de la cola para registrar su avance real.", "Choose an activity from the queue to record actual progress.")} />
                    )}
                  </Card>

                  <Card title={t("Agregar actividad", "Add activity")} description={t("Crea una actividad accionable y, si aplica, enlázala con su predecesora.", "Create an actionable activity and link it to its predecessor when applicable.")}>
                    <div className="row gap wrap" style={{ marginBottom: 18 }}>
                      <button type="button" className="buttonGhost" onClick={handleScheduleCodeSuggestion}>
                        {t("Usar código sugerido", "Use suggested code")}
                      </button>
                      {selectedScheduleActivity ? (
                        <button type="button" className="buttonGhost" onClick={handleScheduleChainFromSelected}>
                          {t("Encadenar después de seleccionada", "Chain after selected")}
                        </button>
                      ) : null}
                      <Badge tone="info">{t("Sugerencia", "Suggestion")}: {suggestedScheduleCode}</Badge>
                    </div>
                    <div className="captureCompactGrid">
                      <label className="captureField"><span>{t("Código", "Code")}</span><input className="field" value={scheduleCreateForm.code} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="EST-030" /></label>
                      <label className="captureField"><span>{t("Fase", "Phase")}</span><input className="field" value={scheduleCreateForm.phase} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, phase: event.target.value }))} placeholder={t("Estructura", "Structure")} /></label>
                      <label className="captureField" style={{ gridColumn: "1 / -1" }}><span>{t("Actividad", "Activity")}</span><input className="field" value={scheduleCreateForm.name} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("Ej. Liberar cimbra de nivel 12", "E.g. Release level 12 formwork")} /></label>
                      <label className="captureField"><span>{t("Inicio plan", "Planned start")}</span><input className="field" type="date" value={scheduleCreateForm.plannedStart} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, plannedStart: event.target.value }))} /></label>
                      <label className="captureField"><span>{t("Fin plan", "Planned finish")}</span><input className="field" type="date" value={scheduleCreateForm.plannedFinish} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, plannedFinish: event.target.value }))} /></label>
                      <label className="captureField"><span>{t("Responsable", "Owner")}</span><input className="field" value={scheduleCreateForm.owner} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, owner: event.target.value }))} placeholder={t("Superintendencia", "Superintendence")} /></label>
                      <label className="captureField" style={{ gridColumn: "1 / -1" }}><span>{t("Dependencias por código", "Dependencies by code")}</span><input className="field" value={scheduleCreateForm.predecessorCodes} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, predecessorCodes: event.target.value.toUpperCase() }))} placeholder={t("Ej. CIV-010, EST-020 o vacío si arranca libre", "E.g. CIV-010, EST-020 or leave blank when it starts free")} /></label>
                      <label className="captureField" style={{ gridColumn: "1 / -1" }}><span>{t("Siguiente acción", "Next action")}</span><input className="field" value={scheduleCreateForm.nextAction} onChange={(event) => setScheduleCreateForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder={t("Ej. Confirmar liberación con supervisión", "E.g. Confirm release with supervision")} /></label>
                    </div>
                    <div className="row gap wrap" style={{ marginTop: 18 }}>
                      <button type="button" className="button" disabled={isScheduleSaving} onClick={() => void handleScheduleCreate()}>{isScheduleSaving ? t("Guardando...", "Saving...") : t("Agregar al programa", "Add to schedule")}</button>
                    </div>
                    {scheduleMessageFeedback ? <p className="formSuccess">{localizeText(scheduleMessageFeedback)}</p> : null}
                    {scheduleErrorFeedback ? <p className="formError">{localizeText(scheduleErrorFeedback)}</p> : null}
                  </Card>

                  <Card title={t("Importar programa desde CSV", "Import schedule from CSV")} description={t("Carga varias actividades con dependencias por código para poblar el programa sin capturarlas una por una.", "Load multiple activities with code-based dependencies to populate the schedule without entering them one by one.")}>
                    <div className="row gap wrap" style={{ marginBottom: 18 }}>
                      <label className="buttonGhost" style={{ cursor: "pointer" }}>
                        {t("Cargar archivo CSV", "Upload CSV file")}
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          style={{ display: "none" }}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            void handleScheduleImportFile(file);
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button type="button" className="buttonGhost" onClick={() => { setScheduleImportCsv(projectScheduleCsvTemplate); setScheduleImportFileName("template.csv"); setScheduleImportResult(null); }}>
                        {t("Cargar plantilla", "Load template")}
                      </button>
                      <button type="button" className="buttonGhost" onClick={() => { setScheduleImportCsv(""); setScheduleImportFileName(""); setScheduleImportResult(null); }}>
                        {t("Limpiar importación", "Clear import")}
                      </button>
                      {scheduleImportFileName ? <Badge tone="info">{scheduleImportFileName}</Badge> : null}
                    </div>

                    <label className="captureField" style={{ display: "grid", gap: 8 }}>
                      <span>{t("Contenido CSV", "CSV content")}</span>
                      <textarea
                        className="textarea"
                        rows={8}
                        value={scheduleImportCsv}
                        onChange={(event) => {
                          setScheduleImportCsv(event.target.value);
                          setScheduleImportResult(null);
                        }}
                        placeholder={projectScheduleCsvTemplate}
                      />
                    </label>

                    <div className="detailGrid" style={{ marginTop: 18 }}>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Columnas esperadas", "Expected columns")}</div>
                        <div><code>code,name,phase,plannedStart,plannedFinish,predecessorCodes,owner,nextAction</code></div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Dependencias", "Dependencies")}</div>
                        <div>{t("Usa códigos separados por coma, punto y coma o barra vertical dentro de la columna `predecessorCodes`.", "Use codes separated by comma, semicolon or pipe inside the `predecessorCodes` column.")}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Vista previa", "Preview")}</div>
                        <div className="tableCellStack">
                          {scheduleImportPreview.error ? (
                            <span className="formError">{localizeText(resolveScheduleFeedbackCopy(scheduleImportPreview.error) ?? { es: scheduleImportPreview.error, en: scheduleImportPreview.error })}</span>
                          ) : scheduleImportPreview.rows.length > 0 ? (
                            <>
                              <span>{t(`${scheduleImportPreview.rows.length} actividades listas para importarse.`, `${scheduleImportPreview.rows.length} activities ready to import.`)}</span>
                              {scheduleImportPreview.rows.slice(0, 3).map((activity) => (
                                <span key={activity.code} className="tableCellMuted">
                                  {activity.code} · {activity.name} · {activity.plannedStart} → {activity.plannedFinish}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="tableCellMuted">{t("Carga o pega un CSV para ver la validación previa.", "Upload or paste a CSV to preview pre-validation.")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {scheduleImportResult ? (
                      <div className="row gap wrap" style={{ marginTop: 18 }}>
                        <Badge tone="success">{scheduleImportResult.createdCount} {t("actividades creadas", "activities created")}</Badge>
                        <Badge tone="info">{scheduleImportResult.linkedToExistingCount} {t("ligadas a existentes", "linked to existing")}</Badge>
                        <Badge tone="info">{scheduleImportResult.linkedWithinImportCount} {t("ligadas dentro del lote", "linked within batch")}</Badge>
                      </div>
                    ) : null}

                    <div className="row gap wrap" style={{ marginTop: 18 }}>
                      <button type="button" className="button" disabled={isScheduleImporting || scheduleImportPreview.error !== null || scheduleImportCsv.trim().length === 0} onClick={() => void handleScheduleImport()}>
                        {isScheduleImporting ? t("Importando...", "Importing...") : t("Importar al programa", "Import into schedule")}
                      </button>
                      <Link className="buttonGhost" href={selectedProject ? `/field?projectName=${encodeURIComponent(selectedProject.name)}` : "/field"}>
                        {t("Abrir obra en campo", "Open project in field")}
                      </Link>
                    </div>
                  </Card>
                </div>
              </section>
            ) : null}

            {workspaceView === "create" ? (
              <section className="grid cols2">
                <Card title={t("Alta de obra para programación", "Add project to the schedule")} description={t("Captura solo lo necesario para que el equipo pueda programar, mover frentes y detectar bloqueos desde el primer día.", "Capture only what operators need to schedule work, move fronts and spot blockers from day one.")}>
                  <div className="row gap wrap" style={{ marginBottom: 18 }}>
                    <button type="button" className="buttonGhost" onClick={() => setCreateForm(createProjectExample())}>{t("Cargar ejemplo útil", "Load working example")}</button>
                    <button type="button" className="buttonGhost" onClick={() => setCreateForm((current) => ({ ...current, code: "", name: "", client: "", nextMilestone: "" }))}>{t("Limpiar datos clave", "Clear key fields")}</button>
                  </div>
                  <p className="sectionText">{t("Llena primero código, cliente, nombre y primer hito. Después ajusta el resto solo si cambia cómo se programará la obra.", "Fill in code, client, project name and first milestone first. Then adjust the rest only if it changes how the project will be scheduled.")}</p>
                  <div className="captureCompactGrid">
                    <label className="captureField"><span>{t("Código de obra", "Project code")}</span><input className="field" value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="ARB-NVO-03" /></label>
                    <label className="captureField"><span>{t("Cliente responsable", "Client account")}</span><input className="field" value={createForm.client} onChange={(event) => setCreateForm((current) => ({ ...current, client: event.target.value }))} placeholder={t("Ej. Desarrolladora Norte", "E.g. North Developer")} /></label>
                    <label className="captureField captureFieldWide"><span>{t("Nombre visible en programación", "Name shown in the schedule")}</span><input className="field" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("Ej. Conjunto Residencial Norte", "E.g. North Residential Complex")} /></label>
                    <label className="captureField"><span>{t("Segmento de obra", "Project segment")}</span><input className="field" value={createForm.segment} onChange={(event) => setCreateForm((current) => ({ ...current, segment: event.target.value }))} placeholder={t("Ej. Residencial, industrial o urbanización", "E.g. Residential, industrial or infrastructure")} /></label>
                    <label className="captureField"><span>{t("Etapa que verá operación", "Stage shown to operations")}</span><input className="field" value={createForm.stage} onChange={(event) => setCreateForm((current) => ({ ...current, stage: event.target.value }))} placeholder={t("Ej. Preconstrucción, cimentación o acabados", "E.g. Preconstruction, foundations or finishes")} /></label>
                    <label className="captureField"><span>{t("Estado inicial en programa", "Initial schedule status")}</span><select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ProjectPortfolioItemContract["status"] }))}>{(["planning", "active", "at_risk", "blocked", "closed"] as ProjectPortfolioItemContract["status"][]).map((status) => <option key={status} value={status}>{localizeText(projectStatusLabel(status))}</option>)}</select></label>
                    <label className="captureField"><span>{t("Frentes que arrancan activos", "Fronts starting active")}</span><input className="field" type="number" min="0" value={createForm.activeFronts} onChange={(event) => setCreateForm((current) => ({ ...current, activeFronts: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Avance inicial reportado (%)", "Initial reported progress (%)")}</span><input className="field" type="number" min="0" max="100" value={createForm.progress} onChange={(event) => setCreateForm((current) => ({ ...current, progress: event.target.value }))} /></label>
                    <label className="captureField captureFieldWide"><span>{t("Primer hito programable", "First schedulable milestone")}</span><input className="field" value={createForm.nextMilestone} onChange={(event) => setCreateForm((current) => ({ ...current, nextMilestone: event.target.value }))} placeholder={t("Ej. Liberar permiso, movilizar primer frente y confirmar responsable de arranque", "E.g. Release permit, mobilize the first front and confirm the start owner")} /></label>
                  </div>
                  <details className="captureDetails">
                    <summary>{t("Datos avanzados para afinar la programación", "Advanced fields for schedule fine-tuning")}</summary>
                    <div className="captureCompactGrid">
                      <label className="captureField"><span>{t("Desviación contra línea base (días)", "Variance vs baseline (days)")}</span><input className="field" type="number" step="0.1" value={createForm.scheduleVarianceDays} onChange={(event) => setCreateForm((current) => ({ ...current, scheduleVarianceDays: event.target.value }))} /></label>
                      <label className="captureField"><span>{t("Salud presupuestal visible", "Visible budget health")}</span><select className="selectField" value={createForm.budgetHealth} onChange={(event) => setCreateForm((current) => ({ ...current, budgetHealth: event.target.value as ProjectPortfolioItemContract["budgetHealth"] }))}><option value="on_track">{t("En control", "On track")}</option><option value="warning">{t("Alerta", "Warning")}</option><option value="critical">{t("Crítica", "Critical")}</option></select></label>
                      <label className="captureField"><span>{t("Retenciones de calidad abiertas", "Open quality holds")}</span><input className="field" type="number" min="0" value={createForm.qualityHolds} onChange={(event) => setCreateForm((current) => ({ ...current, qualityHolds: event.target.value }))} /></label>
                      <label className="captureField"><span>{t("Bloqueos de permiso activos", "Active permit blockers")}</span><input className="field" type="number" min="0" value={createForm.permitBlockers} onChange={(event) => setCreateForm((current) => ({ ...current, permitBlockers: event.target.value }))} /></label>
                    </div>
                  </details>
                  {projectErrorFeedback ? <p className="formError">{localizeText(projectErrorFeedback)}</p> : null}
                  <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateProject()}>{isCreating ? t("Creando...", "Creating...") : t("Agregar a programación", "Add to schedule")}</button>{projectCreateFeedback ? <Badge tone="success">{localizeText(projectCreateFeedback)}</Badge> : null}</div>
                </Card>
                <div className="fieldWorkspaceSideStack">
                  <Card title={t("Checklist antes de guardar", "Checklist before saving")} description={t("Estas reglas evitan cargar una obra difícil de operar desde el primer corte.", "These rules prevent loading a project that is hard to operate from the first cut.")} aside={<Badge tone={createProjectGate.tone}>{t(createProjectGate.tone === "success" ? "Lista para crear" : createProjectGate.tone === "warning" ? "Crear con control" : "Completa datos", createProjectGate.label)}</Badge>}>
                    <p className="sectionText">{t("Confirma código único, etapa entendible, frentes iniciales y un primer hito accionable. Si el estado es activo, el avance y los bloqueos deben ser coherentes.", createProjectGate.summary)}</p>
                  </Card>
                  <Card title={t("Siguiente paso recomendado", "Recommended next step")} description={t("Después de guardar, abre el módulo donde el equipo continuará con esta misma obra.", "After saving, open the module where the team will continue working on this same project.")}>
                    <div className="row gap wrap"><Link className="buttonGhost" href="/field">{t("Abrir campo", "Open field")}</Link><Link className="buttonGhost" href="/quality">{t("Abrir calidad", "Open quality")}</Link><Link className="buttonGhost" href="/document-control">{t("Abrir documentos", "Open documents")}</Link></div>
                  </Card>
                </div>
              </section>
            ) : null}

            <details className="projectAdvanced">
              <summary>{t("Abrir diagnósticos avanzados", "Open advanced diagnostics")}</summary>
              <div className="projectAdvancedContent">
                <section className="grid cols2">
                  <Card
                    title={t("Carril operativo", "Operating lane")}
                    description={t(
                      "Esta capa resume la postura de la obra sin duplicar las pestañas principales de control, programa y alta.",
                      "This layer summarizes project posture without duplicating the main control, schedule and intake tabs."
                    )}
                    aside={
                      <Badge
                        tone={
                          filteredSummary.executionRiskProjects > 0
                            ? "danger"
                            : filteredSummary.permitBlockers > 0
                              ? "warning"
                              : "success"
                        }
                      >
                        {filteredSummary.executionRiskProjects > 0
                          ? t("carril en riesgo", "risk lane")
                          : filteredSummary.permitBlockers > 0
                            ? t("vigilancia de permisos", "permit watch")
                            : t("carril estable", "stable lane")}
                      </Badge>
                    }
                  >
                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">{t("Ruta actual", "Current route")}</div>
                        <div>
                          {selectedProject
                            ? localizeText(projectStatusLabel(selectedProject.status))
                            : t("Selecciona una obra para leer su postura actual.", "Select a project to read its current posture.")}
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Foco de este corte", "Focus for this cut")}</div>
                        <div>
                          {selectedProject
                            ? (nextMilestoneDraft.trim() || selectedProject.nextMilestone)
                            : t("Aún no hay un hito activo para revisar.", "There is no active milestone to review yet.")}
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Selección actual", "Current selection")}</div>
                        <div>{selectedProject ? `${selectedProject.name} · ${selectedProject.code}` : t("Sin obra seleccionada.", "No project selected.")}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Módulo responsable inmediato", "Immediate responsible module")}</div>
                        <div>
                          {t(selectedProjectStation.immediateModule.es, selectedProjectStation.immediateModule.en)}
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Siguiente salto operativo", "Next operating jump")}</div>
                        <div>{t(selectedProjectStation.nextJump.es, selectedProjectStation.nextJump.en)}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Confirmar al volver", "Confirm when returning")}</div>
                        <div>{t(selectedProjectStation.returnCommitment.es, selectedProjectStation.returnCommitment.en)}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Continuidad priorizada", "Prioritized continuity")}</div>
                        <div>
                          {t(
                            "Trabaja la secuencia field → operations → procurement → subcontracts según el bloqueo dominante, sin reconstruir contexto.",
                            "Work the field → operations → procurement → subcontracts sequence according to the dominant blocker, without rebuilding context."
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="row gap wrap" style={{ marginTop: 16 }}>
                      {selectedProjectStation.links.map((link, index) => (
                        <Link key={`${link.href}-${link.label.es}-overview`} className={index === 0 ? "button" : "buttonGhost"} href={link.href}>
                          {t(link.label.es, link.label.en)}
                        </Link>
                      ))}
                    </div>
                  </Card>

                  <Card
                    title={t("Cómo usar esta capa", "How to use this layer")}
                    description={t(
                      "Piensa en esta sección como un tablero de lectura y continuidad, no como una segunda pantalla para volver a capturar lo mismo.",
                      "Think of this section as a continuity and reading board, not as a second screen to capture the same information again."
                    )}
                  >
                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">1. {t("Leer señal", "Read signal")}</div>
                        <div>{t("Confirma si la obra está estable, en vigilancia o en riesgo antes de mover el estado.", "Confirm whether the project is stable, under watch or at risk before moving status.")}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">2. {t("Fijar responsable", "Fix owner")}</div>
                        <div>{t("Asegura que el siguiente hito y el frente responsable queden explícitos en el corte actual.", "Make sure the next milestone and the responsible front are explicit in the current cut.")}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">3. {t("Continuar", "Continue")}</div>
                        <div>{t("Salta rápido al módulo que resuelve el bloqueo, no solo al que lo muestra.", "Jump quickly into the module that resolves the blocker, not only the one that displays it.")}</div>
                      </div>
                    </div>
                  </Card>
                </section>

                <section className="grid cols4">
                  <KpiCard
                    label={t("Frentes activos", "Active fronts")}
                    value={String(filteredSummary.activeProjects)}
                    footnote={t("Obras activas visibles para la empresa actual.", "Active projects visible for the current company.")}
                  />
                  <KpiCard
                    label={t("Avance promedio", "Average progress")}
                    value={`${filteredSummary.averageProgress}%`}
                    footnote={t("Promedio físico de las obras filtradas.", "Physical average across the filtered projects.")}
                  />
                  <KpiCard
                    label={t("Bloqueos de calidad", "Quality holds")}
                    value={String(filteredSummary.qualityHolds)}
                    footnote={t("Presión abierta que todavía puede frenar liberaciones.", "Open pressure still capable of slowing releases.")}
                    badge={{ label: t("control de campo", "field control"), tone: "warning" }}
                  />
                  <KpiCard
                    label={t("Bloqueos de permiso", "Permit blockers")}
                    value={String(filteredSummary.permitBlockers)}
                    footnote={t("Restricciones críticas ligadas a permisos, liberación o supervisión.", "Critical restrictions tied to permits, release or supervision.")}
                    badge={{ label: t("vigilancia", "watchlist"), tone: filteredSummary.permitBlockers > 0 ? "danger" : "success" }}
                  />
                  <KpiCard
                    label={t("Obras en riesgo", "Projects at risk")}
                    value={String(filteredSummary.executionRiskProjects)}
                    footnote={t("Obras donde campo, calidad o subcontrato ya presionan la continuidad.", "Projects where field, quality or subcontract posture already pressure continuity.")}
                  />
                </section>

                {isDemoMode ? (
                  <Card
                    title={t("Modo demo operable", "Operable demo mode")}
                    description={t(
                      "La cartera sigue siendo utilizable incluso antes de conectar el backend real del tenant.",
                      "The portfolio remains usable even before the live tenant backend is connected."
                    )}
                    aside={<Badge tone="warning">{t("persistido en navegador", "browser-persisted")}</Badge>}
                  >
                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">{t("Modo de trabajo", "Working mode")}</div>
                        <div>{t("Los cambios se conservan localmente en este navegador para que el equipo pueda hacer pruebas operativas realistas.", "Changes are kept locally in this browser so the team can run realistic operational walkthroughs.")}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Qué validar", "What to validate")}</div>
                        <div className="tableCellStack">
                          <span className="tableCellMuted">1. {t("Filtra y selecciona una obra real.", "Filter and select a real project.")}</span>
                          <span className="tableCellMuted">2. {t("Ajusta el hito o estado y valida restricciones.", "Adjust the milestone or status and validate constraints.")}</span>
                          <span className="tableCellMuted">3. {t("Continúa hacia campo, calidad o documentos sin perder contexto.", "Continue into field, quality or documents without losing context.")}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : null}

                <section className="grid cols3">
                  <Card title={t("Cobertura de equipo", "Equipment coverage")} description={t("Qué tanto equipo real está soportando esta obra.", "How much real equipment is supporting this project.")}>
                    <p className="sectionText">
                      {selectedStory?.equipmentCoverage ?? t("Selecciona una obra para revisar la cobertura de equipo.", "Select a project to inspect equipment coverage.")}
                    </p>
                  </Card>
                  <Card title={t("Impacto en campo", "Field execution impact")} description={t("Cómo pega hoy la postura de equipo sobre la secuencia de producción.", "How equipment posture is affecting the production sequence today.")}>
                    <p className="sectionText">
                      {selectedStory?.fieldExecution ?? t("Selecciona una obra para revisar su impacto en campo.", "Select a project to inspect its field impact.")}
                    </p>
                  </Card>
                  <Card title={t("Señal de despacho", "Dispatch signal")} description={t("Acción inmediata de equipo que debe empujar continuidad.", "Immediate equipment action that should push continuity.")}>
                    <p className="sectionText">
                      {selectedStory?.dispatchSignal ?? t("Selecciona una obra para revisar la señal de despacho.", "Select a project to inspect the dispatch signal.")}
                    </p>
                  </Card>
                </section>

                <section className="grid cols2">
                  <Card
                    title={selectedProject ? t("Diagnóstico de la obra", "Project diagnosis") : t("Selecciona una obra", "Select a project")}
                    description={selectedProject ? `${selectedProject.code} · ${selectedProject.client}` : t("Elige una obra desde cartera o control para revisar continuidad y restricciones.", "Choose a project from portfolio or control to review continuity and constraints.")}
                    aside={selectedProject ? <Badge tone={statusTone(selectedProject.status)}>{localizeText(projectStatusLabel(selectedProject.status))}</Badge> : null}
                  >
                    {selectedProject ? (
                      <div className="detailGrid">
                        <div className="detailRow">
                          <div className="detailLabel">{t("Cliente", "Client")}</div>
                          <div>{selectedProject.client}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Frentes activos", "Active fronts")}</div>
                          <div>{selectedProject.activeFronts}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Última bitácora", "Latest daily log")}</div>
                          <div className="tableCellStack">
                            <Badge tone={selectedProject.latestDailyLogStatus === "flagged" ? "danger" : selectedProject.latestDailyLogStatus === "approved" ? "success" : "warning"}>
                              {selectedProject.latestDailyLogStatus === "flagged"
                                ? t("Con alerta", "Flagged")
                                : selectedProject.latestDailyLogStatus === "approved"
                                  ? t("Aprobada", "Approved")
                                  : t("En revisión", "Submitted")}
                            </Badge>
                            <span className="tableCellMuted">{selectedProject.latestDailyLogDate ?? t("Sin bitácora ligada", "No linked daily log yet")}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Calidad / subcontrato", "Quality / subcontract")}</div>
                          <div className="tableCellStack">
                            <span className="tableCellMuted">{selectedProject.qualityReleaseReadiness}% {t("de liberación", "release readiness")}</span>
                            <span className="tableCellMuted">
                              {t("subcontrato", "subcontract")} {selectedProject.subcontractHealth} · {t("destajo pendiente", "pending destajo")} MXN {selectedProject.pendingDestajo.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Puerta de continuidad", "Continuity gate")}</div>
                          <div className="tableCellStack">
                            <Badge tone={projectContinuityGate.tone}>{t(projectContinuityCopy.label, projectContinuityGate.label)}</Badge>
                            <span className="tableCellMuted">{t(projectContinuityCopy.description, projectContinuityGate.summary)}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Por qué importa ahora", "Why it matters now")}</div>
                          <div>{t(selectedProjectStation.whyNow.es, selectedProjectStation.whyNow.en)}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Módulo responsable", "Responsible module")}</div>
                          <div>{t(selectedProjectStation.immediateModule.es, selectedProjectStation.immediateModule.en)}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Próximo paso", "Next step")}</div>
                          <div>
                            {selectedProject.permitBlockers > 0
                              ? t("Resuelve permisos antes de empujar el siguiente hito.", "Resolve permits before pushing the next milestone.")
                              : selectedProject.qualityHolds > 0
                                ? t("Cierra calidad antes de liberar continuidad.", "Close quality before releasing continuity.")
                                : selectedProject.latestDailyLogStatus === "flagged"
                                  ? t("Aclara la alerta de bitácora y vuelve a validar campo.", "Resolve the daily-log alert and validate field again.")
                                  : t("Mantén programa, campo y abastecimiento alineados con el siguiente frente.", "Keep schedule, field and supply aligned with the next front.")}
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Ventana de respuesta", "Response window")}</div>
                          <div>{projectReportBackWindow}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Debe regresar confirmado", "Must return confirmed")}</div>
                          <div>{t(selectedProjectStation.returnCommitment.es, selectedProjectStation.returnCommitment.en)}</div>
                        </div>
                      </div>
                    ) : (
                      <EmptyState
                        title={t("Sin obra seleccionada", "No project selected")}
                        description={t("Selecciona una obra para revisar riesgos, continuidad y enlaces operativos.", "Select a project to inspect risks, continuity and operational links.")}
                        primaryAction={{ label: t("Ir a cartera", "Go to portfolio"), href: "/projects" }}
                        secondaryAction={{ label: t("Abrir campo", "Open field"), href: "/field" }}
                      />
                    )}
                  </Card>

                  <Card title={t("Riesgos y bloqueos", "Risks and blockers")} description={t("Riesgos vivos de construcción con responsable y acción actual.", "Live construction risks with owner and current action.")}>
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
                              {risk.severity}
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
                </section>
              </div>
            </details>
          </>
        ) : error ? (
          <EmptyState
            title={t("Cartera de obras no disponible", "Projects portfolio unavailable")}
            description={error}
            primaryAction={{ label: t("Ir al dashboard", "Go to dashboard"), href: "/dashboard" }}
            secondaryAction={{ label: t("Abrir campo", "Open field"), href: "/field" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? t("Cargando cartera de obras", "Loading projects portfolio") : t("La cartera de obras aún no carga", "Projects portfolio not loaded yet")}
            description={
              isDemoMode
                ? t("Esta ruta debe cargar datos demo o reales de cartera para que operación continúe hacia campo y coordinación técnica.", "This route should load demo or live project portfolio data so operators can continue into field and technical coordination.")
                : t("Esta ruta espera la respuesta en vivo de cartera para el tenant activo.", "This route expects the live portfolio response for the active tenant.")
            }
            primaryAction={{ label: t("Ir al dashboard", "Go to dashboard"), href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
