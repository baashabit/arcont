"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { EquipmentOverviewContract, MachineItemContract } from "@/lib/contracts";
import {
  createMachineItem,
  fetchEquipmentOverview,
  fetchFieldMaterialRequestsOverview,
  fetchInventoryMovementsOverview,
  fetchQualityOverview,
  updateMachineItem
} from "@/lib/platform-api";

function statusTone(status: MachineItemContract["status"]) {
  switch (status) {
    case "available":
      return "success";
    case "maintenance":
      return "warning";
    default:
      return "danger";
  }
}

function healthTone(health: MachineItemContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function equipmentStatusLabel(status: MachineItemContract["status"]) {
  switch (status) {
    case "available":
      return { es: "Disponible", en: "Available" };
    case "maintenance":
      return { es: "Mantenimiento", en: "Maintenance" };
    default:
      return { es: "Fuera de servicio", en: "Down" };
  }
}

function equipmentHealthLabel(health: MachineItemContract["health"]) {
  switch (health) {
    case "healthy":
      return { es: "Saludable", en: "Healthy" };
    case "watch":
      return { es: "En vigilancia", en: "Watch" };
    default:
      return { es: "Critico", en: "Critical" };
  }
}

function equipmentActionLabel(label: string) {
  switch (label) {
    case "Move to maintenance":
      return { es: "Mover a mantenimiento", en: "Move to maintenance" };
    case "Take down":
      return { es: "Sacar de servicio", en: "Take down" };
    case "Return to available":
      return { es: "Regresar a disponible", en: "Return to available" };
    case "Escalate to down":
      return { es: "Escalar a fuera de servicio", en: "Escalate to down" };
    case "Send to maintenance":
      return { es: "Enviar a mantenimiento", en: "Send to maintenance" };
    case "Move to watch":
      return { es: "Mover a vigilancia", en: "Move to watch" };
    case "Recover healthy":
      return { es: "Recuperar a saludable", en: "Recover healthy" };
    case "Escalate critical":
      return { es: "Escalar a critico", en: "Escalate critical" };
    case "Stabilize to watch":
      return { es: "Estabilizar a vigilancia", en: "Stabilize to watch" };
    default:
      return { es: label, en: label };
  }
}

function equipmentLinkLabel(label: string) {
  switch (label) {
    case "Open movements":
    case "Review movements":
      return { es: "Abrir movimientos", en: "Open movements" };
    case "Open receiving":
      return { es: "Abrir recepcion", en: "Open receiving" };
    case "Open field":
    case "Review field":
      return { es: "Abrir campo", en: "Open field" };
    case "Open daily log":
      return { es: "Abrir bitacora diaria", en: "Open daily log" };
    case "Open quality":
    case "Review quality":
      return { es: "Abrir calidad", en: "Open quality" };
    case "Review operations":
      return { es: "Abrir operaciones", en: "Open operations" };
    default:
      return { es: label, en: label };
  }
}

function normalizeEquipmentFeedbackCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveEquipmentFeedbackCopy(message: string | null) {
  if (!message) {
    return null;
  }

  switch (normalizeEquipmentFeedbackCode(message)) {
    case "EQUIPMENT_NEXT_ACTION_TOO_SHORT":
      return {
        es: "La siguiente accion debe ser mas especifica antes de guardar el equipo.",
        en: "The next action must be more specific before saving the machine."
      };
    case "EQUIPMENT_CREATE_FIELDS_INCOMPLETE":
      return {
        es: "Maquina, tipo, proyecto y frente deben quedar claros antes de crear el equipo.",
        en: "Machine, type, project and front must be clear before creating the asset."
      };
    case "EQUIPMENT_AVAILABILITY_INVALID":
      return {
        es: "La disponibilidad debe mantenerse entre 0% y 100%.",
        en: "Availability must stay between 0% and 100%."
      };
    case "EQUIPMENT_UTILIZATION_INVALID":
      return {
        es: "La utilizacion debe mantenerse entre 0% y 100%.",
        en: "Utilization must stay between 0% and 100%."
      };
    case "EQUIPMENT_HOUR_METER_INVALID":
      return {
        es: "El horometro debe ser cero o mayor.",
        en: "Hour meter must be zero or greater."
      };
    case "EQUIPMENT_NEXT_MAINTENANCE_INVALID":
      return {
        es: "Las horas a siguiente mantenimiento deben ser cero o mayores.",
        en: "Next maintenance hours must be zero or greater."
      };
    case "EQUIPMENT_MAINTENANCE_BACKLOG_INVALID":
      return {
        es: "El backlog de mantenimiento debe ser cero o mayor.",
        en: "Maintenance backlog must be zero or greater."
      };
    case "EQUIPMENT_OPEN_FAILURES_INVALID":
      return {
        es: "Las fallas abiertas deben ser cero o mayores.",
        en: "Open failures must be zero or greater."
      };
    case "EQUIPMENT_CRITICAL_FAILURES_INVALID":
      return {
        es: "Las fallas criticas deben ser cero o mayores.",
        en: "Critical failures must be zero or greater."
      };
    case "EQUIPMENT_FAILURE_CONFLICT":
      return {
        es: "Las fallas abiertas no pueden ser menores que las fallas criticas.",
        en: "Open failures cannot be lower than critical failures."
      };
    case "EQUIPMENT_AVAILABLE_BLOCKED_BY_CRITICAL":
      return {
        es: "Disponible se bloquea mientras existan fallas criticas abiertas.",
        en: "Available status is blocked while critical failures remain open."
      };
    case "EQUIPMENT_HEALTHY_BLOCKED_BY_MAINTENANCE":
      return {
        es: "Saludable requiere cero fallas criticas y nada de presion vencida de mantenimiento.",
        en: "Healthy status requires no critical failures and no overdue maintenance pressure."
      };
    case "EQUIPMENT_UPDATE_FAILED":
      return {
        es: "No fue posible actualizar el equipo. Revisa la conexion e intenta de nuevo.",
        en: "The machine could not be updated. Check the connection and try again."
      };
    case "EQUIPMENT_CREATE_FAILED":
      return {
        es: "No fue posible crear el equipo. Revisa los datos e intenta de nuevo.",
        en: "The machine could not be created. Review the details and try again."
      };
    case "EQUIPMENT_MACHINE_UPDATED":
      return {
        es: "El equipo fue actualizado correctamente en la bandeja operativa.",
        en: "The machine was updated successfully on the operating board."
      };
    case "EQUIPMENT_MACHINE_CREATED":
      return {
        es: "El equipo se agrego correctamente a la mesa operativa.",
        en: "The machine was added successfully to the operating workbench."
      };
    default:
      return { es: message, en: message };
  }
}

function isMaintenanceOverdue(
  machine: Pick<MachineItemContract, "maintenanceDueDate" | "nextMaintenanceHours" | "maintenanceBacklog">
) {
  return (
    machine.maintenanceBacklog > 0 ||
    machine.nextMaintenanceHours <= 0 ||
    Date.parse(machine.maintenanceDueDate) <= Date.now()
  );
}

function recomputeSummary(machines: MachineItemContract[]) {
  return {
    trackedMachines: machines.length,
    availableMachines: machines.filter((item) => item.status === "available").length,
    machinesInMaintenance: machines.filter((item) => item.status === "maintenance").length,
    overdueMaintenance: machines.filter((item) => isMaintenanceOverdue(item)).length,
    criticalOpenFailures: machines.reduce((sum, item) => sum + item.criticalOpenFailures, 0),
    averageAvailability:
      machines.length > 0
        ? Number((machines.reduce((sum, item) => sum + item.availabilityPercent, 0) / machines.length).toFixed(1))
        : 0
  };
}

function deriveOverview(current: EquipmentOverviewContract, updatedMachine: MachineItemContract): EquipmentOverviewContract {
  const machines = current.machines.some((item) => item.id === updatedMachine.id)
    ? current.machines.map((item) => (item.id === updatedMachine.id ? updatedMachine : item))
    : [updatedMachine, ...current.machines];
  const focusMachine =
    machines
      .slice()
      .sort((left, right) => {
        if (left.criticalOpenFailures !== right.criticalOpenFailures) {
          return right.criticalOpenFailures - left.criticalOpenFailures;
        }

        const leftOverdue = isMaintenanceOverdue(left) ? 1 : 0;
        const rightOverdue = isMaintenanceOverdue(right) ? 1 : 0;
        if (leftOverdue !== rightOverdue) {
          return rightOverdue - leftOverdue;
        }

        if (left.status !== right.status) {
          const leftRank = left.status === "down" ? 2 : left.status === "maintenance" ? 1 : 0;
          const rightRank = right.status === "down" ? 2 : right.status === "maintenance" ? 1 : 0;
          return rightRank - leftRank;
        }

        return left.availabilityPercent - right.availabilityPercent;
      })[0] ?? null;

  return {
    ...current,
    summary: {
      trackedMachines: machines.length,
      availableMachines: machines.filter((item) => item.status === "available").length,
      machinesInMaintenance: machines.filter((item) => item.status === "maintenance").length,
      overdueMaintenance: machines.filter((item) => isMaintenanceOverdue(item)).length,
      criticalOpenFailures: machines.reduce((sum, item) => sum + item.criticalOpenFailures, 0),
      averageAvailability:
        machines.length > 0
          ? Number((machines.reduce((sum, item) => sum + item.availabilityPercent, 0) / machines.length).toFixed(1))
          : 0
    },
    machines,
    focusMachine
  };
}

type EquipmentBridgeContext = {
  movements: NonNullable<Awaited<ReturnType<typeof fetchInventoryMovementsOverview>>>;
  quality: NonNullable<Awaited<ReturnType<typeof fetchQualityOverview>>>;
  fieldMaterials: NonNullable<Awaited<ReturnType<typeof fetchFieldMaterialRequestsOverview>>>;
} | null;

type TranslateFn = (es: string, en: string) => string;

type EquipmentContextualPreload = {
  source: "field" | "quality";
  projectName: string;
  frontName: string;
  owner: string;
  nextAction: string;
};

function normalizeFieldValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function buildContextualPreload(searchParams: ReturnType<typeof useSearchParams>): EquipmentContextualPreload | null {
  const source = searchParams.get("source");
  if (source !== "field" && source !== "quality") {
    return null;
  }

  const projectName = searchParams.get("projectName")?.trim() ?? "";
  const frontName =
    source === "quality"
      ? searchParams.get("areaName")?.trim() ?? ""
      : searchParams.get("frontName")?.trim() ?? "";
  const owner =
    source === "quality"
      ? searchParams.get("contractorName")?.trim() ?? ""
      : searchParams.get("owner")?.trim() ?? "";
  const nextAction = searchParams.get("nextAction")?.trim() ?? "";

  if (!projectName && !frontName && !owner && !nextAction) {
    return null;
  }

  return {
    source,
    projectName,
    frontName,
    owner,
    nextAction
  };
}

function findRelatedMachine(overview: EquipmentOverviewContract, preload: EquipmentContextualPreload) {
  const projectName = normalizeFieldValue(preload.projectName);
  const frontName = normalizeFieldValue(preload.frontName);

  for (const machine of overview.machines) {
    const machineProject = normalizeFieldValue(machine.projectName);
    const machineFront = normalizeFieldValue(machine.frontName);

    if (projectName && frontName && machineProject === projectName && machineFront === frontName) {
      return machine;
    }
  }

  return null;
}

function contextualPreloadBadgeLabel(preload: EquipmentContextualPreload | null) {
  if (!preload) {
    return null;
  }

  return preload.source === "quality"
    ? "Precargado desde calidad / Preloaded from quality"
    : "Precargado desde campo / Preloaded from field";
}

function contextualPreloadTitle(preload: EquipmentContextualPreload, t: TranslateFn) {
  return preload.source === "quality"
    ? t("Lectura desde calidad", "Quality preload")
    : t("Lectura desde campo", "Field preload");
}

function contextualPreloadSummary(preload: EquipmentContextualPreload, t: TranslateFn) {
  return preload.source === "quality"
    ? t("Contexto recibido desde calidad", "Context received from quality")
    : t("Contexto recibido desde campo", "Context received from field");
}

function contextualPreloadOperationalSummary(preload: EquipmentContextualPreload, t: TranslateFn) {
  return preload.source === "quality"
    ? t("Contexto operativo recibido desde calidad", "Operational context received from quality")
    : t("Contexto operativo recibido", "Operational context received");
}

function contextualPreloadAppliedCopy(preload: EquipmentContextualPreload, t: TranslateFn) {
  return preload.source === "quality"
    ? t(
        "Esta captura llego desde calidad y se aplico como precarga inicial.",
        "This intake came from quality and was applied as the initial preload."
      )
    : t(
        "Esta captura llego desde campo y se aplico como precarga inicial.",
        "This intake came from field and was applied as the initial preload."
      );
}

function contextualPreloadJumpCopy(preload: EquipmentContextualPreload, t: TranslateFn) {
  return preload.source === "quality"
    ? t("Salto operativo desde calidad", "Operational jump from quality")
    : t("Salto operativo desde campo", "Operational jump from field");
}

function buildEquipmentStory(machine: MachineItemContract | null, bridge: EquipmentBridgeContext, t: TranslateFn) {
  if (!machine) {
    return null;
  }

  const movementSignal = bridge?.movements.focusMovement ?? null;
  const qualitySignal = bridge?.quality.focusInspection ?? null;
  const fieldMaterialSignal =
    bridge?.fieldMaterials.requests.find(
      (request) => request.projectName === machine.projectName && request.frontName === machine.frontName
    ) ?? bridge?.fieldMaterials.focusRequest ?? null;

  return {
    fieldImpact:
      machine.status === "down"
        ? `${machine.projectName} · ${machine.frontName} ${t("queda expuesto directamente porque esta maquina esta fuera de servicio.", "is directly exposed because this machine is down.")}`
        : machine.status === "maintenance"
          ? `${machine.projectName} · ${machine.frontName} ${t("esta operando bajo presion de mantenimiento.", "is running under maintenance pressure.")}`
          : `${machine.projectName} · ${machine.frontName} ${t("cuenta hoy con esta maquina disponible para despacho.", "currently has this machine available for dispatch.")}`,
    maintenanceSignal: isMaintenanceOverdue(machine)
      ? t("El mantenimiento ya esta vencido y este activo no debe tratarse como estable para planeacion de campo.", "Maintenance is already overdue and this asset should not be treated as stable for field planning.")
      : `${machine.nextMaintenanceHours} ${t("horas operativas restantes antes de la siguiente ventana de servicio.", "operating hours remain before the next service window.")}`,
    criticalAsset:
      machine.criticalOpenFailures > 0
        ? `${machine.criticalOpenFailures} ${t("fallas criticas todavia necesitan cierre antes de liberar con seguridad.", "critical failures still need closure before safe release.")}`
        : t("No hay una falla critica abierta en el activo seleccionado.", "No critical failure is currently open on the selected asset."),
    inventoryDependency: movementSignal
      ? `${movementSignal.code} ${t("es el ancla actual de movimientos con", "is the current stock-movement anchor with")} ${movementSignal.pendingEvidence} ${t("evidencias pendientes y un impacto", "pending evidence items and")} ${movementSignal.impactLevel}.`
      : t("No hay un movimiento de inventario en foco para este carril de equipo.", "No inventory movement is currently in focus for this asset lane."),
    materialPressure: fieldMaterialSignal
      ? `${fieldMaterialSignal.summary} ${t("sigue en estado", "remains")} ${fieldMaterialSignal.status} ${t("con", "with")} ${fieldMaterialSignal.requestedVolume} ${t("pendiente para este frente.", "pending for this front.")}`
      : t("No hay una solicitud directa de material de campo ligada a este carril de equipo.", "No direct field material request is currently attached to this asset lane."),
    qualityConstraint: qualitySignal
      ? `${qualitySignal.code} ${t("sigue", "remains")} ${qualitySignal.status} ${t("con", "with")} ${qualitySignal.openFindings} ${t("hallazgos abiertos y", "open findings and")} ${qualitySignal.releaseReadiness}% ${t("de liberacion.", "release readiness.")}`
      : t("No hay una restriccion de calidad o liberacion ligada al carril activo de equipo.", "No quality-release constraint is currently attached to the active equipment lane.")
  };
}

function validateMachineCreateForm(input: {
  availabilityPercent: number;
  utilizationPercent: number;
  hourMeter: number;
  nextMaintenanceHours: number;
  maintenanceBacklog: number;
  openFailures: number;
  criticalOpenFailures: number;
  status: MachineItemContract["status"];
  health: MachineItemContract["health"];
}) {
  if (!Number.isFinite(input.availabilityPercent) || input.availabilityPercent < 0 || input.availabilityPercent > 100) {
    return "EQUIPMENT_AVAILABILITY_INVALID";
  }

  if (!Number.isFinite(input.utilizationPercent) || input.utilizationPercent < 0 || input.utilizationPercent > 100) {
    return "EQUIPMENT_UTILIZATION_INVALID";
  }

  if (!Number.isFinite(input.hourMeter) || input.hourMeter < 0) {
    return "EQUIPMENT_HOUR_METER_INVALID";
  }

  if (!Number.isFinite(input.nextMaintenanceHours) || input.nextMaintenanceHours < 0) {
    return "EQUIPMENT_NEXT_MAINTENANCE_INVALID";
  }

  if (!Number.isFinite(input.maintenanceBacklog) || input.maintenanceBacklog < 0) {
    return "EQUIPMENT_MAINTENANCE_BACKLOG_INVALID";
  }

  if (!Number.isFinite(input.openFailures) || input.openFailures < 0) {
    return "EQUIPMENT_OPEN_FAILURES_INVALID";
  }

  if (!Number.isFinite(input.criticalOpenFailures) || input.criticalOpenFailures < 0) {
    return "EQUIPMENT_CRITICAL_FAILURES_INVALID";
  }

  if (input.openFailures < input.criticalOpenFailures) {
    return "EQUIPMENT_FAILURE_CONFLICT";
  }

  if (input.status === "available" && input.criticalOpenFailures > 0) {
    return "EQUIPMENT_AVAILABLE_BLOCKED_BY_CRITICAL";
  }

  if (
    input.health === "healthy" &&
    (input.criticalOpenFailures > 0 || input.nextMaintenanceHours <= 0 || input.maintenanceBacklog > 0)
  ) {
    return "EQUIPMENT_HEALTHY_BLOCKED_BY_MAINTENANCE";
  }

  return null;
}

function createMachineExample() {
  return {
    machineName: "Retroexcavadora John Deere 310L",
    machineType: "Retroexcavadora",
    projectName: "Villas del Mayab",
    frontName: "Frente terracerias",
    owner: "",
    status: "maintenance" as MachineItemContract["status"],
    health: "watch" as MachineItemContract["health"],
    availabilityPercent: "74",
    utilizationPercent: "81",
    hourMeter: "2480",
    nextMaintenanceHours: "12",
    maintenanceBacklog: "1",
    openFailures: "2",
    criticalOpenFailures: "0",
    nextAction: "Cerrar servicio preventivo y validar liberacion con supervisor de maquinaria antes de reasignar a obra"
  };
}

function createMachinePreset(
  preset: "dispatch_ready" | "maintenance_hold" | "critical_breakdown"
): ReturnType<typeof createMachineExample> {
  switch (preset) {
    case "dispatch_ready":
      return {
        machineName: "Excavadora CAT 320",
        machineType: "Excavadora",
        projectName: "Residencial Arena",
        frontName: "Frente cimentacion",
        owner: "",
        status: "available" as MachineItemContract["status"],
        health: "healthy" as MachineItemContract["health"],
        availabilityPercent: "95",
        utilizationPercent: "72",
        hourMeter: "1680",
        nextMaintenanceHours: "96",
        maintenanceBacklog: "0",
        openFailures: "0",
        criticalOpenFailures: "0",
        nextAction: "Asignar operador y confirmar salida de equipo para el siguiente frente de excavacion."
      };
    case "maintenance_hold":
      return createMachineExample();
    default:
      return {
        machineName: "Motoniveladora Komatsu GD655",
        machineType: "Motoniveladora",
        projectName: "Villas del Mayab",
        frontName: "Frente vialidades",
        owner: "",
        status: "down" as MachineItemContract["status"],
        health: "critical" as MachineItemContract["health"],
        availabilityPercent: "12",
        utilizationPercent: "0",
        hourMeter: "4120",
        nextMaintenanceHours: "0",
        maintenanceBacklog: "3",
        openFailures: "4",
        criticalOpenFailures: "2",
        nextAction: "Aislar equipo, abrir orden critica y reprogramar frente con maquinaria de reemplazo."
      };
  }
}

function createMachineEmptyForm() {
  return {
    machineName: "",
    machineType: "Excavator",
    projectName: "Nuevo proyecto",
    frontName: "Frente 1",
    owner: "",
    status: "available" as MachineItemContract["status"],
    health: "healthy" as MachineItemContract["health"],
    availabilityPercent: "92",
    utilizationPercent: "68",
    hourMeter: "1200",
    nextMaintenanceHours: "80",
    maintenanceBacklog: "0",
    openFailures: "0",
    criticalOpenFailures: "0",
    nextAction: ""
  };
}

function buildDispatchReadiness(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return {
      tone: "info" as const,
      label: t("Selecciona un activo", "Select an asset"),
      description: t("Elige una maquina para verificar si realmente puede despacharse a campo.", "Choose a machine to verify if it can really be dispatched to field.")
    };
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return {
      tone: "danger" as const,
      label: t("Bloqueado para despacho", "Blocked for dispatch"),
      description: t("La maquina debe mantenerse fuera de asignacion a campo hasta cerrar la averia o las fallas criticas.", "The machine should stay out of field assignment until the breakdown or critical failures are closed.")
    };
  }

  if (isMaintenanceOverdue(machine) || machine.health !== "healthy") {
    return {
      tone: "warning" as const,
      label: t("Despachar con cautela", "Dispatch with caution"),
      description: t("El tiempo de mantenimiento o la salud del activo todavia requieren supervision antes de liberarlo.", "Maintenance timing or health posture still requires supervision before releasing this asset.")
    };
  }

  return {
    tone: "success" as const,
    label: t("Listo para despacho", "Ready for dispatch"),
    description: t("Este activo puede entrar a planeacion de campo sin un bloqueo evidente por mantenimiento o falla.", "This asset can move into field planning without an obvious maintenance or failure blocker.")
  };
}

function buildEquipmentDestination(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return {
      label: t("Sin ruta activa", "No active route"),
      description: t("Selecciona una maquina para decidir que modulo debe tomar el siguiente paso.", "Select a machine to decide which module should take the next step."),
      href: "/equipment"
    };
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return {
      label: t("Escalar a campo", "Escalate to field"),
      description: t("La continuidad productiva ya esta expuesta, asi que el frente debe replanearse desde ejecucion de campo.", "Production continuity is already exposed, so the front should be replanned from field execution."),
      href: "/field"
    };
  }

  if (isMaintenanceOverdue(machine) || machine.status === "maintenance") {
    return {
      label: t("Revisar flujo de inventario", "Review inventory flow"),
      description: t("La recuperacion de mantenimiento debe seguir alineada con materiales y movimientos para el frente afectado.", "Maintenance recovery should stay aligned with inbound material and movements for the affected front."),
      href: "/inventory/movements"
    };
  }

  return {
    label: t("Validar liberacion de calidad", "Validate quality release"),
    description: t("Si el activo ya es mecanicamente estable, confirma la postura de liberacion antes de la continuidad total del frente.", "If the asset is mechanically stable, confirm release posture before full field continuity."),
    href: "/quality"
  };
}

function buildFrontContinuity(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return {
      key: "none" as const,
      label: "Select an asset",
      description: t("Selecciona una maquina para entender como afecta al frente activo antes de despachar o escalar.", "Choose a machine to understand how it affects the active front before dispatch or escalation.")
    };
  }

  if (machine.status === "down") {
    return {
      key: "exposed" as const,
      label: "Front exposed",
      description: `${machine.projectName} · ${machine.frontName} ${t("debe replanearse de inmediato porque este activo ya esta fuera de servicio.", "should be replanned immediately because this asset is already down.")}`
    };
  }

  if (machine.status === "maintenance" || machine.health === "critical") {
    return {
      key: "risk" as const,
      label: "Front at risk",
      description: `${machine.projectName} · ${machine.frontName} ${t("todavia depende de la recuperacion de mantenimiento antes de operar con confianza.", "still depends on maintenance recovery before it can run with confidence.")}`
    };
  }

  if (machine.health === "watch" || isMaintenanceOverdue(machine)) {
    return {
      key: "watch" as const,
      label: "Front under watch",
      description: `${machine.projectName} · ${machine.frontName} ${t("puede continuar, pero el despacho debe seguir coordinado con campo y mantenimiento.", "can continue, but dispatch should stay coordinated with field and maintenance.")}`
    };
  }

  return {
    key: "covered" as const,
    label: "Front covered",
    description: `${machine.projectName} · ${machine.frontName} ${t("cuenta hoy con soporte de activo sin un bloqueo evidente de despacho.", "currently has asset support without an obvious dispatch blocker.")}`
  };
}

function frontContinuityLabel(key: "none" | "exposed" | "risk" | "watch" | "covered") {
  switch (key) {
    case "none":
      return { es: "Selecciona un activo", en: "Select an asset" };
    case "exposed":
      return { es: "Frente expuesto", en: "Front exposed" };
    case "risk":
      return { es: "Frente en riesgo", en: "Front at risk" };
    case "watch":
      return { es: "Frente en vigilancia", en: "Front under watch" };
    default:
      return { es: "Frente cubierto", en: "Front covered" };
  }
}

function buildFieldHandoff(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return t("Selecciona una maquina para ver que debe hacer campo despues.", "Select a machine to see what field teams should do next.");
  }

  if (machine.status === "down") {
    return t("Campo debe proteger el frente, resecuenciar si es posible y confirmar hoy mismo si necesita reemplazo.", "Field should protect the front, switch sequence if possible and confirm whether replacement equipment is required today.");
  }

  if (machine.status === "maintenance") {
    return t("Campo debe confirmar si el trabajo puede rodear la ventana de mantenimiento o si el frente debe pausar hasta la liberacion.", "Field should confirm whether work can continue around the maintenance window or whether the front must pause until release.");
  }

  if (machine.health === "watch") {
    return t("Campo debe operar la maquina bajo supervision y reportar cualquier sintoma nuevo antes del siguiente corte.", "Field should keep the machine operating under supervision and report any new symptom before the next shift cut-off.");
  }

  return t("Campo puede continuar normalmente, pero la siguiente accion todavia debe confirmar quien recibe y usa el activo en el frente.", "Field can continue with normal execution, but the next action should still confirm who receives and uses the asset at the front.");
}

function buildReleaseCheckpoint(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return t("Selecciona una maquina para validar el punto final antes de liberar a campo.", "Select a machine to verify the final checkpoint before release to field.");
  }

  if (machine.criticalOpenFailures > 0) {
    return t("Las fallas criticas deben cerrar antes de tratar este activo como liberable para cualquier frente.", "Critical failures must close before the asset can be treated as releasable for any front.");
  }

  if (isMaintenanceOverdue(machine)) {
    return t("La exposicion de mantenimiento todavia necesita una decision explicita de si sale o no antes de volver al despacho normal.", "Maintenance exposure still needs an explicit go/no-go decision before this asset returns to normal dispatch.");
  }

  if (machine.health === "watch") {
    return t("La liberacion solo puede ocurrir con responsable, ventana de supervision y un siguiente reporte claro a mantenimiento.", "Release can happen only with an owner, supervision window and a clear next report-back to maintenance.");
  }

  return t("El activo puede liberarse si ya estan confirmados operador, frente receptor y relevo del siguiente turno.", "The asset can be released if the operator, receiving front and next shift handoff are already confirmed.");
}

function buildDownstreamChain(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return t("Selecciona una maquina para visualizar la cadena aguas abajo.", "Select a machine to visualize the next downstream chain.");
  }

  if (machine.status === "down") {
    return t("Equipos -> Replaneacion de campo -> Bitacora diaria -> Seguimiento de operaciones", "Equipment -> Field replanning -> Daily log -> Operations follow-up");
  }

  if (machine.status === "maintenance") {
    return t("Equipos -> Movimientos de inventario -> Confirmacion de campo -> Bitacora diaria", "Equipment -> Inventory movements -> Field confirmation -> Daily log");
  }

  if (machine.health === "watch") {
    return t("Equipos -> Supervision de campo -> Calidad o validacion en bitacora", "Equipment -> Field supervision -> Quality or daily log verification");
  }

  return t("Equipos -> Ejecucion de campo -> Cierre de bitacora", "Equipment -> Field execution -> Daily log closeout");
}

function buildOperatingBottleneck(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return t("Selecciona una maquina para identificar el cuello operativo principal.", "Select a machine to identify the main operational bottleneck.");
  }

  if (machine.criticalOpenFailures > 0) {
    return t("Las fallas criticas son el principal cuello y bloquean el despacho normal.", "Critical failures are the main bottleneck and block normal dispatch.");
  }

  if (isMaintenanceOverdue(machine)) {
    return t("El mantenimiento vencido es el principal cuello y todavia limita una liberacion segura.", "Overdue maintenance is the main bottleneck and still limits safe release.");
  }

  if (machine.health === "watch") {
    return t("La condicion en vigilancia es el principal cuello; campo solo puede continuar con supervision mas cercana.", "Condition watch is the main bottleneck; field can continue only with closer supervision.");
  }

  return t("No se ve un cuello duro; la tarea principal es liberar con disciplina y cerrar el relevo al frente.", "No hard bottleneck is visible; the main task is disciplined release and front handoff.");
}

function buildImmediateCommand(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return t("Selecciona una maquina para ver la instruccion inmediata.", "Select a machine to see the immediate command.");
  }

  if (machine.status === "down") {
    return t("Protege el frente, aisla el activo y dispara ahora mismo reemplazo o replaneacion.", "Protect the front, isolate the asset and trigger replacement or resequencing now.");
  }

  if (machine.status === "maintenance") {
    return t("Cierra la puerta de mantenimiento, confirma criterios de liberacion y avisa a campo si el frente pausa o continua.", "Close the maintenance gate, confirm release criteria and tell field whether the front pauses or continues around it.");
  }

  if (machine.health === "watch") {
    return t("Libera solo con responsable, ventana de monitoreo y reporte claro a mantenimiento y campo.", "Release only with owner, monitoring window and clear report-back to maintenance and field.");
  }

  return t("Confirma operador, frente receptor y relevo del siguiente turno; despues libera el activo a ejecucion.", "Confirm operator, receiving front and next-shift handoff, then release the asset into execution.");
}

function buildCommandOwner(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return t("Selecciona una maquina para identificar al responsable actual.", "Select a machine to identify the current owner.");
  }

  if (machine.status === "down") {
    return t("Lider de mantenimiento con supervision de campo", "Maintenance lead with field supervision");
  }

  if (machine.status === "maintenance") {
    return t("Lider de mantenimiento y coordinador de despacho", "Maintenance lead and dispatch coordinator");
  }

  if (machine.health === "watch") {
    return t("Coordinador de despacho con residente de obra", "Dispatch coordinator with resident engineer");
  }

  return t("Coordinador de despacho y responsable del frente receptor", "Dispatch coordinator and receiving front owner");
}

function buildDispatchConfirmation(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return t("Selecciona una maquina para definir la confirmacion requerida.", "Select a machine to define the required confirmation.");
  }

  if (machine.status === "down") {
    return t("Confirma el plan de reemplazo o la resecuenciacion antes del siguiente corte de campo.", "Confirm replacement plan or resequencing before the next field cutoff.");
  }

  if (machine.status === "maintenance") {
    return t("Confirma criterios de liberacion, relevo de operador y si el frente pausa o continua alrededor del mantenimiento.", "Confirm release criteria, operator handoff and whether the front pauses or continues around maintenance.");
  }

  if (machine.health === "watch") {
    return t("Confirma la ventana de monitoreo, el umbral de escalamiento y el momento del siguiente reporte para el turno.", "Confirm monitoring window, escalation threshold and report-back timing for the next shift.");
  }

  return t("Confirma operador, frente receptor y relevo en bitacora antes de liberar el activo.", "Confirm operator, front receiver and daily-log handoff before releasing the asset.");
}

function buildReportBackWindow(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to define when the team must report back.";
  }

  if (machine.status === "down") {
    return "Report back before the next field cutoff with replacement status or resequencing confirmed.";
  }

  if (machine.status === "maintenance") {
    return "Report back as soon as maintenance closeout is known and before the front commits the next production step.";
  }

  if (machine.health === "watch") {
    return "Report back in the same shift with condition status and whether the watch posture is increasing or stabilizing.";
  }

  return "Report back at the next shift handoff confirming the asset actually reached and served the intended front.";
}

function buildEquipmentWhyNow(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to understand what equipment pressure needs attention right now.";
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return `${machine.machineName} is already blocking continuity because it is ${machine.status} with ${machine.criticalOpenFailures} critical failure(s) still open.`;
  }

  if (machine.status === "maintenance" || isMaintenanceOverdue(machine)) {
    return `${machine.machineName} is still under maintenance pressure, so release decisions now directly shape whether ${machine.frontName} can keep moving.`;
  }

  if (machine.health === "watch") {
    return `${machine.machineName} can still run, but the current watch posture means the next shift can degrade quickly without tighter supervision.`;
  }

  return `${machine.machineName} is close to clean dispatch, so the useful question now is whether handoff and field ownership are actually confirmed.`;
}

function buildEquipmentDownstreamEffect(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to inspect which downstream chain absorbs the impact.";
  }

  if (machine.status === "down") {
    return "If this asset stays down, field replanning, daily logs and operations follow-up will absorb the disruption immediately.";
  }

  if (machine.status === "maintenance" || isMaintenanceOverdue(machine)) {
    return "If maintenance recovery stalls, inventory support, field execution and quality release will all feel the delay next.";
  }

  if (machine.health === "watch") {
    return "If the watch posture worsens, dispatch, field supervision and maintenance will all re-enter the loop within the same shift.";
  }

  return "If release stays disciplined, this asset should flow cleanly into field execution and daily-log closeout without extra escalation.";
}

function buildEquipmentHumanStep(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to define the next human handoff.";
  }

  if (machine.status === "down") {
    return "Tell field whether to replace the machine or resequence the front before the next production cutoff.";
  }

  if (machine.status === "maintenance") {
    return "Tell maintenance and dispatch exactly who owns release criteria and whether the front pauses or continues around the service window.";
  }

  if (machine.health === "watch") {
    return "Tell the receiving front and shift supervisor the monitoring window and escalation trigger before dispatch.";
  }

  return "Tell the operator and receiving front owner the exact handoff time so the asset does not stay 'available' only on paper.";
}

function buildEquipmentRouteSummary(machine: MachineItemContract | null) {
  if (!machine) {
    return "Use equipment as the control point between maintenance, dispatch, field continuity and quality release.";
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return "This machine should route first through containment and front replanning before field or quality keep depending on it.";
  }

  if (machine.status === "maintenance" || isMaintenanceOverdue(machine)) {
    return "This machine should route through maintenance recovery and dispatch validation before the front assumes clean availability.";
  }

  if (machine.health === "watch") {
    return "This machine should route through supervised field release and tighter report-back before normal continuity is assumed.";
  }

  return "This machine can continue through field execution and daily supervision with the current equipment context intact.";
}

function buildEquipmentOperationalLinks(machine: MachineItemContract | null) {
  if (!machine) {
    return [
      { label: "Open movements", href: "/inventory/movements" },
      { label: "Open field", href: "/field" },
      { label: "Open quality", href: "/quality" }
    ];
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open daily log", href: "/daily-log" },
      { label: "Open movements", href: "/inventory/movements" }
    ];
  }

  if (machine.status === "maintenance" || isMaintenanceOverdue(machine)) {
    return [
      { label: "Open movements", href: "/inventory/movements" },
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open field", href: "/field" }
    ];
  }

  if (machine.health === "watch") {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open quality", href: "/quality" },
      { label: "Open daily log", href: "/daily-log" }
    ];
  }

  return [
    { label: "Open quality", href: "/quality" },
    { label: "Open field", href: "/field" },
    { label: "Open movements", href: "/inventory/movements" }
  ];
}

function buildDispatchPacketStatus(machine: MachineItemContract | null, t: TranslateFn) {
  if (!machine) {
    return {
      tone: "info" as const,
      label: t("Selecciona un activo", "Select an asset"),
      summary: t("Elige una maquina para resumir el estado de despacho.", "Choose a machine to summarize dispatch status.")
    };
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return {
      tone: "danger" as const,
      label: t("Despacho bloqueado", "Dispatch blocked"),
      summary: t("El activo no debe salir de control hasta cerrar fallas o decisiones de reemplazo.", "The asset should not leave control until failures or replacement decisions are closed.")
    };
  }

  if (machine.status === "maintenance" || isMaintenanceOverdue(machine) || machine.health === "watch") {
    return {
      tone: "warning" as const,
      label: t("Despacho en vigilancia", "Dispatch under watch"),
      summary: t("El activo solo puede moverse con supervision explicita, confirmacion y disciplina de reporte.", "The asset can only move with explicit supervision, confirmation and report-back discipline.")
    };
  }

  return {
    tone: "success" as const,
    label: t("Despacho alineado", "Dispatch aligned"),
    summary: t("El activo esta cerca de la liberacion operativa si ya estan confirmados frente, operador y relevo.", "The asset is close to operational release if front, operator and handoff are confirmed.")
  };
}

function buildCrossPressureSummary(story: ReturnType<typeof buildEquipmentStory>, t: TranslateFn) {
  if (!story) {
    return t("Selecciona una maquina para revisar la presion cruzada entre inventario, materiales y calidad.", "Select a machine to review cross-pressure from inventory, materials and quality.");
  }

  const signals = [
    story.inventoryDependency,
    story.materialPressure,
    story.qualityConstraint
  ]
    .filter(Boolean)
    .join(" ");

  return signals;
}

function buildCreateMachineGate(input: {
  machineName: string;
  machineType: string;
  projectName: string;
  frontName: string;
  availabilityPercent: number;
  utilizationPercent: number;
  hourMeter: number;
  nextMaintenanceHours: number;
  maintenanceBacklog: number;
  openFailures: number;
  criticalOpenFailures: number;
  status: MachineItemContract["status"];
  health: MachineItemContract["health"];
  nextAction: string;
}) {
  const checks: string[] = [];

  if ([input.machineName, input.machineType, input.projectName, input.frontName].some((value) => value.trim().length < 3)) {
    checks.push("Machine, type, project and front still need more specific capture.");
  }

  if (!Number.isFinite(input.availabilityPercent) || input.availabilityPercent < 0 || input.availabilityPercent > 100) {
    checks.push("Availability must stay between 0% and 100%.");
  }

  if (!Number.isFinite(input.utilizationPercent) || input.utilizationPercent < 0 || input.utilizationPercent > 100) {
    checks.push("Utilization must stay between 0% and 100%.");
  }

  if (!Number.isFinite(input.hourMeter) || input.hourMeter < 0) {
    checks.push("Hour meter must be zero or greater.");
  }

  if (!Number.isFinite(input.nextMaintenanceHours) || input.nextMaintenanceHours < 0) {
    checks.push("Next maintenance hours must be zero or greater.");
  }

  if (!Number.isFinite(input.maintenanceBacklog) || input.maintenanceBacklog < 0) {
    checks.push("Maintenance backlog must be zero or greater.");
  }

  if (!Number.isFinite(input.openFailures) || input.openFailures < 0) {
    checks.push("Open failures must be zero or greater.");
  }

  if (!Number.isFinite(input.criticalOpenFailures) || input.criticalOpenFailures < 0) {
    checks.push("Critical failures must be zero or greater.");
  }

  if (input.openFailures < input.criticalOpenFailures) {
    checks.push("Open failures cannot be lower than critical failures.");
  }

  if (input.status === "available" && input.criticalOpenFailures > 0) {
    checks.push("Available status is blocked while critical failures remain open.");
  }

  if (
    input.health === "healthy" &&
    (input.criticalOpenFailures > 0 || input.nextMaintenanceHours <= 0 || input.maintenanceBacklog > 0)
  ) {
    checks.push("Healthy status requires no critical failures and no overdue maintenance pressure.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for dispatch or maintenance follow-through.");
  }

  if (checks.length > 0) {
    const hardBlock =
      input.status === "available" && input.criticalOpenFailures > 0 ||
      input.openFailures < input.criticalOpenFailures ||
      (input.health === "healthy" &&
        (input.criticalOpenFailures > 0 || input.nextMaintenanceHours <= 0 || input.maintenanceBacklog > 0));

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This asset would open with a hard maintenance or safety blocker."
        : "The machine can be created, but dispatch discipline still needs tightening.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The machine has enough structure to enter equipment control cleanly.",
    checks: [
      "The created machine will become the current focus item immediately.",
      "Keep maintenance, dispatch and next-action context attached from the first capture."
    ]
  };
}

function buildCreateMachineHumanStep(input: {
  status: MachineItemContract["status"];
  health: MachineItemContract["health"];
  nextMaintenanceHours: number;
  maintenanceBacklog: number;
  criticalOpenFailures: number;
  nextAction: string;
}, t: TranslateFn) {
  if (input.criticalOpenFailures > 0) {
    return t("Conten primero la falla critica para que la maquina no se abra por error como despachable.", "Contain the critical failure first so the machine does not open as dispatchable by mistake.");
  }

  if (input.status === "maintenance" || input.maintenanceBacklog > 0 || input.nextMaintenanceHours <= 0) {
    return t("Crea el activo solo con un responsable explicito de cierre de mantenimiento y una condicion de liberacion.", "Create the asset only with an explicit maintenance closeout owner and release condition.");
  }

  if (input.health === "watch") {
    return t("Crea el activo y asigna supervision en el mismo turno antes de enviarlo al frente.", "Create the asset and assign same-shift supervision before sending it to the front.");
  }

  if (input.nextAction.trim().length < 8) {
    return t("Aclara la accion inmediata de mantenimiento o despacho antes de persistir la maquina.", "Clarify the immediate maintenance or dispatch action before persisting the machine.");
  }

  return t("Crea la maquina y continua directo hacia despacho de campo, soporte de movimientos o seguimiento de calidad.", "Create the machine and continue directly into field dispatch, movement support or quality follow-through.");
}

function localizeCreateMachineGateLabel(label: string) {
  switch (label) {
    case "Do not create yet":
      return { es: "No crear todavia", en: "Do not create yet" };
    case "Create with control":
      return { es: "Crear con control", en: "Create with control" };
    case "Ready to create":
      return { es: "Lista para crear", en: "Ready to create" };
    default:
      return { es: label, en: label };
  }
}

function localizeCreateMachineGateSummary(summary: string) {
  switch (summary) {
    case "This asset would open with a hard maintenance or safety blocker.":
      return {
        es: "Este activo abriria con un bloqueo duro de mantenimiento o seguridad.",
        en: "This asset would open with a hard maintenance or safety blocker."
      };
    case "The machine can be created, but dispatch discipline still needs tightening.":
      return {
        es: "La maquina puede crearse, pero la disciplina de despacho todavia necesita apretarse.",
        en: "The machine can be created, but dispatch discipline still needs tightening."
      };
    case "The machine has enough structure to enter equipment control cleanly.":
      return {
        es: "La maquina ya tiene estructura suficiente para entrar limpia al control de equipos.",
        en: "The machine has enough structure to enter equipment control cleanly."
      };
    default:
      return { es: summary, en: summary };
  }
}

export default function EquipmentPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const searchParams = useSearchParams();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const t = (es: string, en: string) => localizeText({ es, en });
  const contextualPreload = buildContextualPreload(searchParams);
  const [overview, setOverview] = useState<EquipmentOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<EquipmentBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | MachineItemContract["status"]>("all");
  const [healthFilter, setHealthFilter] = useState<"all" | MachineItemContract["health"]>("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(createMachineEmptyForm);
  const [activeContextualPreload, setActiveContextualPreload] = useState<EquipmentContextualPreload | null>(null);
  const contextualPreloadRef = useRef<{
    applied: boolean;
    nextAction: string | null;
    selectedMachineId: string | null;
  }>({
    applied: false,
    nextAction: null,
    selectedMachineId: null
  });
  const createFormNumbers = useMemo(
    () => ({
      availabilityPercent: Number(createForm.availabilityPercent),
      utilizationPercent: Number(createForm.utilizationPercent),
      hourMeter: Number(createForm.hourMeter),
      nextMaintenanceHours: Number(createForm.nextMaintenanceHours),
      maintenanceBacklog: Number(createForm.maintenanceBacklog),
      openFailures: Number(createForm.openFailures),
      criticalOpenFailures: Number(createForm.criticalOpenFailures)
    }),
    [
      createForm.availabilityPercent,
      createForm.criticalOpenFailures,
      createForm.hourMeter,
      createForm.maintenanceBacklog,
      createForm.nextMaintenanceHours,
      createForm.openFailures,
      createForm.utilizationPercent
    ]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchEquipmentOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchInventoryMovementsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchFieldMaterialRequestsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchQualityOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, movements, fieldMaterials, quality]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Equipment overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedMachineId((current) => current ?? result.focusMachine?.id ?? result.machines[0]?.id ?? null);
        setBridgeContext(movements && quality && fieldMaterials ? { movements, quality, fieldMaterials } : null);
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

  const filteredMachines = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedProject = projectFilter.trim().toLowerCase();
    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.machines.filter((machine) => {
      const matchesStatus = statusFilter === "all" || machine.status === statusFilter;
      const matchesHealth = healthFilter === "all" || machine.health === healthFilter;
      const matchesProject =
        normalizedProject.length === 0 ||
        machine.projectName.toLowerCase().includes(normalizedProject) ||
        machine.frontName.toLowerCase().includes(normalizedProject);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        machine.machineName.toLowerCase().includes(normalizedSearch) ||
        machine.machineType.toLowerCase().includes(normalizedSearch) ||
        machine.code.toLowerCase().includes(normalizedSearch) ||
        machine.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesHealth && matchesProject && matchesSearch;
    });
  }, [healthFilter, overview, projectFilter, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredMachines), [filteredMachines]);

  const selectedMachine = useMemo(
    () => filteredMachines.find((item) => item.id === selectedMachineId) ?? filteredMachines[0] ?? null,
    [filteredMachines, selectedMachineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.machineId === selectedMachine?.id) ?? [],
    [overview, selectedMachine]
  );

  const affectedFronts = useMemo(() => {
    return new Set(
      filteredMachines
        .filter((item) => item.status !== "available" || item.health !== "healthy")
        .map((item) => `${item.projectName}::${item.frontName}`)
    ).size;
  }, [filteredMachines]);

  const equipmentStory = useMemo(() => {
    return buildEquipmentStory(selectedMachine, bridgeContext, (es, en) => localizeText({ es, en }));
  }, [bridgeContext, localizeText, selectedMachine]);
  const dispatchReadiness = useMemo(
    () => buildDispatchReadiness(selectedMachine, (es, en) => localizeText({ es, en })),
    [localizeText, selectedMachine]
  );
  const equipmentDestination = useMemo(
    () => buildEquipmentDestination(selectedMachine, (es, en) => localizeText({ es, en })),
    [localizeText, selectedMachine]
  );
  const frontContinuity = useMemo(() => buildFrontContinuity(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const createMachineGate = useMemo(
    () =>
      buildCreateMachineGate({
        machineName: createForm.machineName,
        machineType: createForm.machineType,
        projectName: createForm.projectName,
        frontName: createForm.frontName,
        availabilityPercent: createFormNumbers.availabilityPercent,
        utilizationPercent: createFormNumbers.utilizationPercent,
        hourMeter: createFormNumbers.hourMeter,
        nextMaintenanceHours: createFormNumbers.nextMaintenanceHours,
        maintenanceBacklog: createFormNumbers.maintenanceBacklog,
        openFailures: createFormNumbers.openFailures,
        criticalOpenFailures: createFormNumbers.criticalOpenFailures,
        status: createForm.status,
        health: createForm.health,
        nextAction: createForm.nextAction
      }),
    [createForm, createFormNumbers]
  );
  const createMachineHumanStep = useMemo(
    () =>
      buildCreateMachineHumanStep({
        status: createForm.status,
        health: createForm.health,
        nextMaintenanceHours: createFormNumbers.nextMaintenanceHours,
        maintenanceBacklog: createFormNumbers.maintenanceBacklog,
        criticalOpenFailures: createFormNumbers.criticalOpenFailures,
        nextAction: createForm.nextAction
      }, (es, en) => localizeText({ es, en })),
    [createForm.health, createForm.nextAction, createForm.status, createFormNumbers, localizeText]
  );
  const fieldHandoff = useMemo(() => buildFieldHandoff(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const releaseCheckpoint = useMemo(() => buildReleaseCheckpoint(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const downstreamChain = useMemo(() => buildDownstreamChain(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const operatingBottleneck = useMemo(() => buildOperatingBottleneck(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const immediateCommand = useMemo(() => buildImmediateCommand(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const commandOwner = useMemo(() => buildCommandOwner(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const dispatchConfirmation = useMemo(() => buildDispatchConfirmation(selectedMachine, (es, en) => localizeText({ es, en })), [localizeText, selectedMachine]);
  const reportBackWindow = useMemo(() => buildReportBackWindow(selectedMachine), [selectedMachine]);
  const selectedWhyNow = useMemo(() => buildEquipmentWhyNow(selectedMachine), [selectedMachine]);
  const selectedDownstreamEffect = useMemo(() => buildEquipmentDownstreamEffect(selectedMachine), [selectedMachine]);
  const selectedHumanStep = useMemo(() => buildEquipmentHumanStep(selectedMachine), [selectedMachine]);
  const selectedRouteSummary = useMemo(() => buildEquipmentRouteSummary(selectedMachine), [selectedMachine]);
  const selectedOperationalLinks = useMemo(() => buildEquipmentOperationalLinks(selectedMachine), [selectedMachine]);
  const dispatchPacketStatus = useMemo(
    () => buildDispatchPacketStatus(selectedMachine, (es, en) => localizeText({ es, en })),
    [localizeText, selectedMachine]
  );
  const crossPressureSummary = useMemo(
    () => buildCrossPressureSummary(equipmentStory, (es, en) => localizeText({ es, en })),
    [equipmentStory, localizeText]
  );
  const equipmentActionFeedback = useMemo(() => resolveEquipmentFeedbackCopy(actionMessage), [actionMessage]);
  const equipmentErrorFeedback = useMemo(() => resolveEquipmentFeedbackCopy(actionError), [actionError]);
  const equipmentCreateFeedback = useMemo(() => resolveEquipmentFeedbackCopy(createMessage), [createMessage]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredMachines.length === 0) {
      setSelectedMachineId(null);
      return;
    }

    const isSelectedVisible = filteredMachines.some((machine) => machine.id === selectedMachineId);
    if (!isSelectedVisible) {
      setSelectedMachineId(filteredMachines[0]?.id ?? null);
    }
  }, [filteredMachines, overview, selectedMachineId]);

  useEffect(() => {
    if (contextualPreloadRef.current.applied || !contextualPreload) {
      return;
    }

    contextualPreloadRef.current.applied = true;
    setActiveContextualPreload(contextualPreload);
    setCreateForm((current) => ({
      ...current,
      projectName: contextualPreload.projectName || current.projectName,
      frontName: contextualPreload.frontName || current.frontName,
      owner: contextualPreload.owner || current.owner,
      nextAction: contextualPreload.nextAction || current.nextAction
    }));

    if (!overview) {
      return;
    }

    const relatedMachine = findRelatedMachine(overview, contextualPreload);

    if (relatedMachine) {
      contextualPreloadRef.current.selectedMachineId = relatedMachine.id;
      setSelectedMachineId(relatedMachine.id);
      if (contextualPreload.nextAction) {
        contextualPreloadRef.current.nextAction = contextualPreload.nextAction;
      }
    }
  }, [contextualPreload, overview]);

  const statusOptions = useMemo(() => {
    if (!selectedMachine) {
      return [];
    }

    switch (selectedMachine.status) {
      case "available":
        return [
          {
            label: "Move to maintenance",
            status: "maintenance" as const,
            health: selectedMachine.health,
            nextAction: "Start the planned maintenance window and document release criteria"
          },
          {
            label: "Take down",
            status: "down" as const,
            health: "critical" as const,
            nextAction: "Protect the front and isolate the machine from active dispatch"
          }
        ];
      case "maintenance":
        return [
          {
            label: "Return to available",
            status: "available" as const,
            health: "healthy" as const,
            nextAction: "Confirm maintenance closeout, release inspection and operator handoff"
          },
          {
            label: "Escalate to down",
            status: "down" as const,
            health: "critical" as const,
            nextAction: "Escalate the failed maintenance outcome and keep the machine out of dispatch"
          }
        ];
      default:
        return [
          {
            label: "Send to maintenance",
            status: "maintenance" as const,
            health: "watch" as const,
            nextAction: "Move the machine into maintenance workflow and track repair progress"
          }
        ];
    }
  }, [selectedMachine]);

  const healthOptions = useMemo(() => {
    if (!selectedMachine) {
      return [];
    }

    switch (selectedMachine.health) {
      case "healthy":
        return [
          {
            label: "Move to watch",
            status: selectedMachine.status,
            health: "watch" as const,
            nextAction: "Inspect the emerging condition signal before it affects availability"
          }
        ];
      case "watch":
        return [
          {
            label: "Recover healthy",
            status: "available" as const,
            health: "healthy" as const,
            nextAction: "Confirm the machine is clear of overdue maintenance and critical failures"
          },
          {
            label: "Escalate critical",
            status: selectedMachine.status === "available" ? "down" : selectedMachine.status,
            health: "critical" as const,
            nextAction: "Escalate the equipment risk and protect active production fronts"
          }
        ];
      default:
        return [
          {
            label: "Stabilize to watch",
            status: selectedMachine.status === "down" ? "maintenance" : selectedMachine.status,
            health: "watch" as const,
            nextAction: "Reduce the failure posture and keep remediation active until safe recovery"
          }
        ];
    }
  }, [selectedMachine]);

  useEffect(() => {
    if (
      selectedMachine?.id &&
      contextualPreloadRef.current.selectedMachineId === selectedMachine.id &&
      contextualPreloadRef.current.nextAction
    ) {
      setNextActionDraft(contextualPreloadRef.current.nextAction);
      contextualPreloadRef.current.selectedMachineId = null;
      contextualPreloadRef.current.nextAction = null;
    } else {
      setNextActionDraft(selectedMachine?.nextAction ?? "");
    }
    setActionError(null);
    setActionMessage(null);
  }, [selectedMachineId, selectedMachine?.id, selectedMachine?.nextAction]);

  const isContextuallySelectedMachine = Boolean(
    activeContextualPreload &&
      selectedMachine &&
      normalizeFieldValue(selectedMachine.projectName) === normalizeFieldValue(activeContextualPreload.projectName) &&
      normalizeFieldValue(selectedMachine.frontName) === normalizeFieldValue(activeContextualPreload.frontName)
  );

  async function handleMachineAction(
    status: MachineItemContract["status"],
    health: MachineItemContract["health"],
    suggestedNextAction: string
  ) {
    if (!selectedMachine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("EQUIPMENT_NEXT_ACTION_TOO_SHORT");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateMachineItem(
      selectedMachine.id,
      activeCompany.id,
      {
        status,
        health,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.code ?? response.error?.message ?? "EQUIPMENT_UPDATE_FAILED");
      setIsSaving(false);
      return;
    }

    const updatedMachine = response.data;

    setOverview((current) => (current ? deriveOverview(current, updatedMachine) : current));
    setNextActionDraft(updatedMachine.nextAction);
    setActionMessage("EQUIPMENT_MACHINE_UPDATED");
    setIsSaving(false);
  }

  async function handleCreateMachine() {
    if (!overview) {
      return;
    }

    const machineName = createForm.machineName.trim();
    const machineType = createForm.machineType.trim();
    const projectName = createForm.projectName.trim();
    const frontName = createForm.frontName.trim();
    const nextAction = createForm.nextAction.trim();
    const numericInput = {
      availabilityPercent: Number(createForm.availabilityPercent),
      utilizationPercent: Number(createForm.utilizationPercent),
      hourMeter: Number(createForm.hourMeter),
      nextMaintenanceHours: Number(createForm.nextMaintenanceHours),
      maintenanceBacklog: Number(createForm.maintenanceBacklog),
      openFailures: Number(createForm.openFailures),
      criticalOpenFailures: Number(createForm.criticalOpenFailures),
      status: createForm.status,
      health: createForm.health
    };

    if (machineName.length < 3 || machineType.length < 3 || projectName.length < 3 || frontName.length < 3) {
      setActionError("EQUIPMENT_CREATE_FIELDS_INCOMPLETE");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("EQUIPMENT_NEXT_ACTION_TOO_SHORT");
      setCreateMessage(null);
      return;
    }

    const numericValidation = validateMachineCreateForm(numericInput);
    if (numericValidation) {
      setActionError(numericValidation);
      setCreateMessage(null);
      return;
    }
    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createMachineItem(
      activeCompany.id,
      {
        machineName,
        machineType,
        projectName,
        frontName,
        status: createForm.status,
        health: createForm.health,
        availabilityPercent: numericInput.availabilityPercent,
        utilizationPercent: numericInput.utilizationPercent,
        hourMeter: numericInput.hourMeter,
        nextMaintenanceHours: numericInput.nextMaintenanceHours,
        maintenanceBacklog: numericInput.maintenanceBacklog,
        openFailures: numericInput.openFailures,
        criticalOpenFailures: numericInput.criticalOpenFailures,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.code ?? response.error?.message ?? "EQUIPMENT_CREATE_FAILED");
      setIsCreating(false);
      return;
    }

    const newMachine = response.data;
    setOverview((current) => (current ? deriveOverview(current, newMachine) : current));
    setSelectedMachineId(newMachine.id);
    setNextActionDraft(newMachine.nextAction);
    setCreateMessage("EQUIPMENT_MACHINE_CREATED");
    setCreateForm({
      ...createMachineEmptyForm(),
      machineType: createForm.machineType,
      projectName,
      frontName,
      hourMeter: "0"
    });
    setIsCreating(false);
  }

  return (
    <AppShell
      title={t("Equipos y mantenimiento", "Equipment and maintenance")}
      eyebrow={t("Dominio de ejecucion", "Execution domain")}
      description={t(
        "Disponibilidad de maquinaria, horas de operacion, fallas y liberacion de mantenimiento conectadas con frentes activos.",
        "Machinery availability, operating hours, failures and maintenance readiness tied to active fronts."
      )}
    >
      <ModuleGate moduleKeys={["inventory.equipment"]} requiredPermissions={["inventory:*"]} title={t("Equipos", "Equipment")}>
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label={t("Maquinas controladas", "Tracked machines")}
                value={filteredSummary.trackedMachines.toLocaleString()}
                footnote={t("Unidades de equipo actualmente controladas en el tenant activo.", "Equipment units currently controlled in the active tenant.")}
              />
              <KpiCard
                label={t("Disponibles", "Available")}
                value={String(filteredSummary.availableMachines)}
                footnote={t("Maquinas listas para despacho sin bloqueos abiertos.", "Machines ready for dispatch without open blocking conditions.")}
              />
              <KpiCard
                label={t("Mantenimiento vencido", "Overdue maintenance")}
                value={String(filteredSummary.overdueMaintenance)}
                footnote={t("Unidades que todavia no pueden liberar su exposicion de mantenimiento.", "Units that still cannot clear maintenance exposure.")}
              />
              <KpiCard
                label={t("Fallas criticas", "Critical failures")}
                value={String(filteredSummary.criticalOpenFailures)}
                footnote={t("Senales criticas de averia abiertas en la flotilla activa.", "Open critical breakdown signals across the active fleet.")}
              />
              <KpiCard
                label={t("Frentes afectados", "Affected fronts")}
                value={String(affectedFronts)}
                footnote={t("Frentes activos hoy expuestos a paro, mantenimiento o salud degradada del equipo.", "Active fronts currently exposed to equipment downtime, maintenance or degraded health.")}
              />
            </section>

            {isDemoMode ? (
              <Card
                title={t("Modo demo operable", "Operable demo mode")}
                description={t(
                  "Las acciones sobre equipo se guardan localmente en este navegador para probar de inmediato flujos de mantenimiento y campo.",
                  "Equipment actions are persisted locally in this browser so field and maintenance flows can be tested immediately."
                )}
                aside={<Badge tone="warning">{t("persistido en navegador", "browser persisted")}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">{t("Que ya funciona", "What already works")}</div>
                    <div>{t("Los equipos pueden inspeccionarse, cambiar estado o salud y registrar nuevos activos sin esperar auth productivo.", "Teams can inspect machines, change status or health, and register new assets without waiting for production auth.")}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Prueba recomendada", "Recommended test")}</div>
                    <div>{t("Mueve una maquina de mantenimiento a disponible y luego registra un nuevo activo ligado a un frente activo.", "Move one machine from maintenance to available, then create a new asset tied to an active project front.")}</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols2">
              <Card
                title={t("Consola de despacho", "Dispatch console")}
                description={t(
                  "Lectura rapida para decidir si el activo sale a obra, se contiene o se manda a mantenimiento.",
                  "Fast read to decide whether the asset goes to site, is contained, or moves into maintenance."
                )}
                aside={
                  <div className="tableCellStack">
                    <Badge tone={dispatchReadiness.tone}>{dispatchReadiness.label}</Badge>
                  </div>
                }
              >
                {selectedMachine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">{t("Activo", "Asset")}</div>
                      <div className="tableCellStack">
                        <strong>{selectedMachine.machineName}</strong>
                        <span className="tableCellMuted">{selectedMachine.code} · {selectedMachine.machineType}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Frente actual", "Current front")}</div>
                      <div>{selectedMachine.projectName} · {selectedMachine.frontName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Postura", "Posture")}</div>
                      <div className="row gap wrap">
                        <Badge tone={statusTone(selectedMachine.status)}>{localizeText(equipmentStatusLabel(selectedMachine.status))}</Badge>
                        <Badge tone={healthTone(selectedMachine.health)}>{localizeText(equipmentHealthLabel(selectedMachine.health))}</Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente ruta", "Next route")}</div>
                      <div className="tableCellStack">
                        <strong>{equipmentDestination.label}</strong>
                        <span className="tableCellMuted">{equipmentDestination.description}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente accion", "Next action")}</div>
                      <div>{nextActionDraft || selectedMachine.nextAction}</div>
                    </div>
                    {activeContextualPreload ? (
                      <div className="detailRow">
                        <div className="detailLabel">{contextualPreloadTitle(activeContextualPreload, t)}</div>
                        <div className="tableCellStack">
                          <span>
                            {[activeContextualPreload.projectName, activeContextualPreload.frontName].filter(Boolean).join(" · ") ||
                              contextualPreloadOperationalSummary(activeContextualPreload, t)}
                          </span>
                          {activeContextualPreload.owner ? (
                            <span className="tableCellMuted">
                              {t("Responsable sugerido", "Suggested owner")}: {activeContextualPreload.owner}
                            </span>
                          ) : null}
                          {activeContextualPreload.nextAction ? (
                            <span className="tableCellMuted">
                              {t("Siguiente accion sugerida", "Suggested next action")}: {activeContextualPreload.nextAction}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title={t("Sin activo seleccionado", "No asset selected")}
                    description={t("Selecciona una maquina para decidir despacho, contencion o mantenimiento.", "Select a machine to decide dispatch, containment or maintenance.")}
                    primaryAction={{ label: t("Seguir en equipos", "Stay on equipment"), href: "/equipment" }}
                  />
                )}
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href={equipmentDestination.href}>{equipmentDestination.label}</Link>
                  {selectedOperationalLinks.slice(0, 2).map((link) => (
                    <Link key={`${link.href}-${link.label}`} className="buttonGhost" href={link.href}>
                      {localizeText(equipmentLinkLabel(link.label))}
                    </Link>
                  ))}
                </div>
              </Card>

              <Card
                title={t("Alta rapida de maquinaria", "Quick machine intake")}
                description={t(
                  "Arranca pruebas con presets reales para despacho, mantenimiento o averia critica.",
                  "Start walkthroughs with realistic presets for dispatch, maintenance or critical breakdown."
                )}
              >
                <div className="detailGrid">
                  {activeContextualPreload ? (
                    <div className="detailRow">
                      <div className="detailLabel">{t("Prelectura operativa", "Operational pre-read")}</div>
                      <div className="tableCellStack">
                        <strong>
                          {[activeContextualPreload.projectName, activeContextualPreload.frontName].filter(Boolean).join(" · ") ||
                            contextualPreloadSummary(activeContextualPreload, t)}
                        </strong>
                        {activeContextualPreload.owner ? <span className="tableCellMuted">{activeContextualPreload.owner}</span> : null}
                        {activeContextualPreload.nextAction ? <span className="tableCellMuted">{activeContextualPreload.nextAction}</span> : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="detailRow">
                    <div className="detailLabel">{t("Chequeo previo", "Pre-check")}</div>
                    <div className="tableCellStack">
                      <Badge tone={createMachineGate.tone}>{localizeText(localizeCreateMachineGateLabel(createMachineGate.label))}</Badge>
                      <span className="tableCellMuted">{localizeText(localizeCreateMachineGateSummary(createMachineGate.summary))}</span>
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente relevo", "Next handoff")}</div>
                    <div>{createMachineHumanStep}</div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachineExample())}>{t("Ejemplo demo", "Demo example")}</button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("dispatch_ready"))}>{t("Preset despacho", "Dispatch preset")}</button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("maintenance_hold"))}>{t("Preset mantenimiento", "Maintenance preset")}</button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("critical_breakdown"))}>{t("Preset averia", "Breakdown preset")}</button>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card
                title={t("Flujo de equipo", "Equipment workflow")}
                description={t("El equipo debe conectar mantenimiento, soporte de inventario y liberacion a campo en una sola ruta operativa.", "Equipment should connect maintenance, inventory support and field release in one operating route.")}
                aside={<Badge tone={filteredSummary.criticalOpenFailures > 0 ? "danger" : filteredSummary.overdueMaintenance > 0 ? "warning" : "success"}>{filteredSummary.criticalOpenFailures > 0 ? t("carril critico", "critical lane") : filteredSummary.overdueMaintenance > 0 ? t("mantenimiento en vigilancia", "maintenance watch") : t("carril estable", "stable lane")}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">{t("Liberacion de activo", "Asset readiness")}</div><div>{t("La disponibilidad sola no basta; mantenimiento y fallas deciden si una maquina realmente puede despacharse.", "Availability alone is not enough; maintenance and failure posture decide if a machine is truly dispatchable.")}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Continuidad material", "Material continuity")}</div><div>{t("El carril de equipo debe seguir alineado con materiales entrantes y movimientos cuando el frente depende de ambos.", "Equipment lanes should stay aligned with inbound material and site movements when the front depends on both.")}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Liberacion a campo", "Field release")}</div><div>{t("Despues de estabilizar la maquina, el operador debe saltar directo a campo o calidad y no quedarse atorado solo en mantenimiento.", "After stabilizing the machine, operators should jump directly into field or quality follow-up instead of stopping in maintenance only.")}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/inventory/movements">{t("Abrir movimientos", "Open movements")}</Link>
                  <Link className="buttonGhost" href="/inventory/receiving">{t("Abrir recepcion", "Open receiving")}</Link>
                  <Link className="buttonGhost" href="/field">{t("Abrir campo", "Open field")}</Link>
                </div>
              </Card>

              <Card title={t("Impacto en campo", "Field execution impact")} description={t("Que significa este activo para los frentes activos de produccion.", "What the selected asset means for active production fronts.")}>
                <p className="sectionText">
                  {equipmentStory?.fieldImpact ?? t("Selecciona un activo para revisar su impacto en campo.", "Choose an asset to inspect its field execution impact.")}
                </p>
              </Card>
              <Card title={t("Presion de mantenimiento", "Maintenance pressure")} description={t("Postura inmediata de mantenimiento para la maquina seleccionada.", "Immediate maintenance posture for the selected machine.")}>
                <p className="sectionText">
                  {equipmentStory?.maintenanceSignal ?? t("Selecciona un activo para revisar su presion de mantenimiento.", "Choose an asset to inspect its maintenance pressure.")}
                </p>
              </Card>
              <Card title={t("Activo critico de hoy", "Critical asset for today")} description={t("Lectura rapida para despacho, residentes y supervision de campo.", "Fast read for dispatch, resident engineers and field supervisors.")}>
                <p className="sectionText">
                  {equipmentStory?.criticalAsset ?? t("Selecciona un activo para revisar su condicion critica de hoy.", "Choose an asset to inspect today's critical condition.")}
                </p>
              </Card>
              <Card title={t("Dependencia de inventario", "Inventory dependency")} description={t("Presion de almacen y maniobras ligada a este carril de equipo.", "Warehouse and material-handling pressure attached to this asset lane.")}>
                <p className="sectionText">
                  {equipmentStory?.inventoryDependency ?? t("Selecciona un activo para revisar la dependencia de inventario.", "Choose an asset to inspect inventory dependency.")}
                </p>
              </Card>
              <Card title={t("Presion por solicitud de material", "Material request pressure")} description={t("Si el frente ya carga una solicitud viva de suministro ligada a este carril.", "Whether the front already carries a live supply request tied to this asset lane.")}>
                <p className="sectionText">
                  {equipmentStory?.materialPressure ?? t("Selecciona un activo para revisar la presion de material en campo.", "Choose an asset to inspect field material pressure.")}
                </p>
              </Card>
              <Card title={t("Restriccion de calidad", "Quality constraint")} description={t("Senal de liberacion y correccion alrededor de la maquina seleccionada.", "Release and corrective-work signal around the selected machine.")}>
                <p className="sectionText">
                  {equipmentStory?.qualityConstraint ?? t("Selecciona un activo para revisar sus restricciones de calidad.", "Choose an asset to inspect quality constraints.")}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card
                title={t("Listo para despacho", "Dispatch readiness")}
                description={t("Si la maquina seleccionada realmente puede salir de control de mantenimiento y soportar ejecucion de campo.", "Whether the selected machine can truly leave maintenance control and support field execution.")}
                aside={<Badge tone={dispatchReadiness.tone}>{dispatchReadiness.label}</Badge>}
              >
                <p className="sectionText">{dispatchReadiness.description}</p>
              </Card>
              <Card title={t("Siguiente ruta", "Next route")} description={t("Mejor modulo para continuar el flujo de la maquina desde el bloqueo actual.", "Best module to continue the machine workflow from the current blocker.")}>
                <p className="sectionText">{equipmentDestination.description}</p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href={equipmentDestination.href}>
                    {equipmentDestination.label}
                  </Link>
                </div>
              </Card>
              <Card title={t("Checklist de despacho", "Dispatcher checklist")} description={t("Controles minimos antes de liberar maquinaria al frente.", "Minimum controls before releasing machinery to the front.")}>
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">{t("Fallas", "Failures")}</div><div>{t("No debe haber fallas criticas abiertas en una maquina que se va a despachar.", "No critical failures open for a machine that will be dispatched.")}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Mantenimiento", "Maintenance")}</div><div>{t("No liberes mantenimiento vencido sin una decision operativa explicita.", "Do not release overdue maintenance without an explicit operational decision.")}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Seguimiento", "Follow-up")}</div><div>{t("Toda maquina necesita una siguiente accion que indique a mantenimiento o campo que ocurre despues.", "Every machine needs a next action that tells maintenance or field what happens next.")}</div></div>
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title={t("Continuidad del frente", "Front continuity")}
                description={t("Como el activo seleccionado esta moldeando la continuidad real de ejecucion en el frente.", "How the selected asset is shaping real execution continuity at the front.")}
                aside={<Badge tone={frontContinuity.key === "exposed" ? "danger" : frontContinuity.key === "risk" || frontContinuity.key === "watch" ? "warning" : "success"}>{localizeText(frontContinuityLabel(frontContinuity.key))}</Badge>}
              >
                <p className="sectionText">{frontContinuity.description}</p>
              </Card>
              <Card title={t("Relevo a campo", "Field handoff")} description={t("Que debe hacer campo una vez que ya se conoce el estado del equipo.", "What field teams should do next once equipment status is known.")}>
                <p className="sectionText">{fieldHandoff}</p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href="/field">
                    {t("Abrir campo", "Open field")}
                  </Link>
                  <Link className="buttonGhost" href="/daily-log">
                    {t("Abrir bitacora diaria", "Open daily log")}
                  </Link>
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title={t("Punto final de liberacion", "Release checkpoint")} description={t("Puerta final antes de tratar la maquina como realmente utilizable en campo.", "Final gate before the machine is treated as truly usable in field.")}>
                <p className="sectionText">{releaseCheckpoint}</p>
              </Card>
              <Card title={t("Cadena aguas abajo", "Downstream chain")} description={t("Que cadena operativa debe ocurrir despues de la decision sobre equipo.", "What operational chain should happen after the equipment decision.")}>
                <p className="sectionText">{downstreamChain}</p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title={t("Cuello operativo", "Operating bottleneck")} description={t("La razon principal por la que este activo sigue presionando la ejecucion ahora mismo.", "The main reason this asset is still pressuring execution right now.")}>
                <p className="sectionText">{operatingBottleneck}</p>
              </Card>
              <Card title={t("Comando inmediato", "Immediate command")} description={t("Lo que despacho, mantenimiento o campo debe hacer ahora sin mas interpretacion.", "What dispatch, maintenance or field should do now without further interpretation.")}>
                <p className="sectionText">{immediateCommand}</p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title={t("Bandeja de flotilla", "Fleet posture")} description={t("Disponibilidad, mantenimiento y utilizacion por maquina.", "Availability, maintenance and utilization by machine.")}>
                <FilterBar summary={localizeText({ es: `${filteredMachines.length} maquinas coinciden con los filtros operativos actuales`, en: `${filteredMachines.length} machines match the current operating filters` })}>
                  <label className="fieldLabel">
                    {t("Estado", "Status")}
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">{t("Todos", "All")}</option>
                      <option value="available">{localizeText(equipmentStatusLabel("available"))}</option>
                      <option value="maintenance">{localizeText(equipmentStatusLabel("maintenance"))}</option>
                      <option value="down">{localizeText(equipmentStatusLabel("down"))}</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    {t("Salud", "Health")}
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">{t("Todas", "All")}</option>
                      <option value="healthy">{localizeText(equipmentHealthLabel("healthy"))}</option>
                      <option value="watch">{localizeText(equipmentHealthLabel("watch"))}</option>
                      <option value="critical">{localizeText(equipmentHealthLabel("critical"))}</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    {t("Proyecto / frente", "Project / front")}
                    <input
                      className="field"
                      type="search"
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                      placeholder={t("Proyecto o frente", "Project or front")}
                    />
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    {t("Busqueda de activo", "Asset search")}
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder={t("Maquina, tipo, codigo o accion", "Machine, type, code or action")}
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? t("demo operable", "operable demo") : t("backend activo", "live backend")}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("equipo listo", "equipment ready")}</Badge>
                  <Badge tone={filteredSummary.criticalOpenFailures > 0 ? "danger" : filteredSummary.overdueMaintenance > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalOpenFailures > 0
                      ? localizeText({ es: `${filteredSummary.criticalOpenFailures} fallas criticas`, en: `${filteredSummary.criticalOpenFailures} critical failures` })
                      : filteredSummary.overdueMaintenance > 0
                        ? localizeText({ es: `${filteredSummary.overdueMaintenance} vencidas`, en: `${filteredSummary.overdueMaintenance} overdue` })
                        : t("subset visible controlado", "visible subset controlled")}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredMachines}
                  columns={[
                    {
                      key: "machine",
                      label: t("Maquina", "Machine"),
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedMachineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.machineName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.machineType}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "front",
                      label: t("Frente", "Front"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectName}</strong>
                          <span className="tableCellMuted">{row.frontName}</span>
                        </div>
                      )
                    },
                    {
                      key: "hours",
                      label: t("Horas", "Hours"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.hourMeter.toLocaleString()} h</strong>
                          <span className="tableCellMuted">{localizeText({ es: `${row.nextMaintenanceHours} h al siguiente servicio`, en: `${row.nextMaintenanceHours} h to next service` })}</span>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      label: t("Estado", "Status"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <Badge tone={statusTone(row.status)}>{localizeText(equipmentStatusLabel(row.status))}</Badge>
                          <Badge tone={healthTone(row.health)}>{localizeText(equipmentHealthLabel(row.health))}</Badge>
                        </div>
                      )
                    }
                  ]}
                />
              </Card>

              <Card
                title={t("Maquina seleccionada", "Selected machine")}
                description={t("Contexto puntual del equipo para despacho, mantenimiento y control de fallas.", "Focused equipment context for dispatch, maintenance and failure control.")}
                aside={
                  selectedMachine ? (
                    <div className="tableCellStack">
                      {isContextuallySelectedMachine && activeContextualPreload ? (
                        <Badge tone="info">{contextualPreloadBadgeLabel(activeContextualPreload)}</Badge>
                      ) : null}
                      <Badge tone={statusTone(selectedMachine.status)}>{localizeText(equipmentStatusLabel(selectedMachine.status))}</Badge>
                      <Badge tone={healthTone(selectedMachine.health)}>{localizeText(equipmentHealthLabel(selectedMachine.health))}</Badge>
                    </div>
                  ) : null
                }
              >
                {selectedMachine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">{t("Frente", "Front")}</div>
                      <div>
                        {selectedMachine.projectName} · {selectedMachine.frontName}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Disponibilidad", "Availability")}</div>
                      <div>{selectedMachine.availabilityPercent}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Utilizacion", "Utilization")}</div>
                      <div>{selectedMachine.utilizationPercent}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Mantenimiento", "Maintenance due")}</div>
                      <div>
                        {new Date(selectedMachine.maintenanceDueDate).toLocaleString()}
                        {isMaintenanceOverdue(selectedMachine) ? ` · ${t("vencido", "overdue")}` : ""}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Fallas", "Failures")}</div>
                      <div>
                        {localizeText({ es: `${selectedMachine.openFailures} abiertas · ${selectedMachine.criticalOpenFailures} criticas`, en: `${selectedMachine.openFailures} open · ${selectedMachine.criticalOpenFailures} critical` })}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Por que ahora", "Why now")}</div>
                      <div>{selectedWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Impacto aguas abajo", "Downstream effect")}</div>
                      <div>{selectedDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Resumen de ruta", "Route summary")}</div>
                      <div>{selectedRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente accion", "Next action")}</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder={t("Describe la siguiente accion operativa o de mantenimiento", "Describe the next operational or maintenance action")}
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Paquete de despacho", "Dispatch packet")}</div>
                      <div className="tableCellStack">
                        <Badge tone={dispatchPacketStatus.tone}>{dispatchPacketStatus.label}</Badge>
                        <strong>{operatingBottleneck}</strong>
                        <span className="tableCellMuted">{dispatchPacketStatus.summary}</span>
                        <span className="tableCellMuted">{immediateCommand}</span>
                        <span className="tableCellMuted">{commandOwner}</span>
                        <span className="tableCellMuted">{reportBackWindow}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Presion cruzada", "Cross-pressure")}</div>
                      <div className="tableCellStack">
                        <span>{crossPressureSummary}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Actualizado", "Updated")}</div>
                      <div>{new Date(selectedMachine.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Responsable", "Command owner")}</div>
                      <div>{commandOwner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Confirmacion de despacho", "Dispatch confirmation")}</div>
                      <div>{dispatchConfirmation}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                      <div>{selectedHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Ventana de reporte", "Report-back window")}</div>
                      <div>{reportBackWindow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Reglas de negocio", "Business rules")}</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">{t("Disponible se bloquea si el mantenimiento esta vencido.", "Available is blocked while maintenance is overdue.")}</span>
                        <span className="tableCellMuted">{t("Disponible se bloquea mientras existan fallas criticas abiertas.", "Available is blocked while critical failures remain open.")}</span>
                        <span className="tableCellMuted">{t("Saludable requiere estado disponible y sin bloqueos.", "Healthy requires available status and no blocking conditions.")}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Vinculos operativos", "Linked actions")}</div>
                      <div className="row gap wrap">
                        {selectedOperationalLinks.map((link, index) => (
                          <Link key={link.href + link.label} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                            {localizeText(equipmentLinkLabel(link.label))}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Acciones de estado", "Status actions")}</div>
                      <div className="emptyActions">
                        {statusOptions.map((option) => (
                          <button
                            key={option.label}
                            className={option.status === "down" ? "buttonGhost" : "button"}
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleMachineAction(option.status, option.health, option.nextAction)}
                          >
                            {isSaving ? t("Guardando...", "Saving...") : localizeText(equipmentActionLabel(option.label))}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Acciones de salud", "Health actions")}</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {healthOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.health === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleMachineAction(option.status, option.health, option.nextAction)}
                            >
                              {isSaving ? t("Guardando...", "Saving...") : localizeText(equipmentActionLabel(option.label))}
                            </button>
                          ))}
                        </div>
                        {equipmentActionFeedback ? <span className="tableCellMuted">{localizeText(equipmentActionFeedback)}</span> : null}
                        {equipmentErrorFeedback ? <span style={{ color: "var(--danger-700)" }}>{localizeText(equipmentErrorFeedback)}</span> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title={t("No hay maquina seleccionada", "No machine selected")}
                    description={t("Elige una maquina de la tabla para revisar disponibilidad, mantenimiento y fallas abiertas.", "Choose a machine from the table to inspect availability, maintenance and open failures.")}
                    primaryAction={{ label: t("Permanecer en equipos", "Stay on equipment"), href: "/equipment" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title={t("Registrar maquinaria", "Register machine")}
                description={t("Crea un nuevo carril de equipo directamente en el backend del tenant y reflejalo de inmediato en la bandeja.", "Create a new equipment lane directly in the tenant backend and reflect it immediately on the board.")}
                aside={activeContextualPreload ? <Badge tone="info">{contextualPreloadBadgeLabel(activeContextualPreload)}</Badge> : null}
              >
                <div className="detailGrid">
                  {activeContextualPreload ? (
                    <div className="detailRow">
                      <div className="detailLabel">{t("Contexto recibido", "Received context")}</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">
                          {contextualPreloadAppliedCopy(activeContextualPreload, t)}
                        </span>
                        <strong>
                          {[activeContextualPreload.projectName, activeContextualPreload.frontName].filter(Boolean).join(" · ") ||
                            contextualPreloadJumpCopy(activeContextualPreload, t)}
                        </strong>
                        {activeContextualPreload.owner ? (
                          <span className="tableCellMuted">
                            {t("Responsable sugerido", "Suggested owner")}: {activeContextualPreload.owner}
                          </span>
                        ) : null}
                        {activeContextualPreload.nextAction ? (
                          <span className="tableCellMuted">
                            {t("Siguiente accion sugerida", "Suggested next action")}: {activeContextualPreload.nextAction}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <label className="detailRow">
                    <div className="detailLabel">{t("Maquina", "Machine")}</div>
                    <input
                      className="field"
                      value={createForm.machineName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, machineName: event.target.value }))}
                      placeholder={t("Excavadora CAT 320", "CAT 320 excavator")}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Tipo", "Type")}</div>
                    <input
                      className="field"
                      value={createForm.machineType}
                      onChange={(event) => setCreateForm((current) => ({ ...current, machineType: event.target.value }))}
                      placeholder={t("Retroexcavadora, grua, minicargador...", "Backhoe, crane, skid steer...")}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Proyecto", "Project")}</div>
                    <input
                      className="field"
                      value={createForm.projectName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                      placeholder={t("Proyecto o contrato", "Project or contract")}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Frente", "Front")}</div>
                    <input
                      className="field"
                      value={createForm.frontName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))}
                      placeholder={t("Frente o zona de trabajo", "Front or work zone")}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Responsable", "Owner")}</div>
                    <input
                      className="field"
                      value={createForm.owner}
                      onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))}
                      placeholder={t("Responsable operativo sugerido", "Suggested operational owner")}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Estado", "Status")}</div>
                    <select
                      className="selectField"
                      value={createForm.status}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          status: event.target.value as MachineItemContract["status"]
                        }))
                      }
                    >
                      <option value="available">{localizeText(equipmentStatusLabel("available"))}</option>
                      <option value="maintenance">{localizeText(equipmentStatusLabel("maintenance"))}</option>
                      <option value="down">{localizeText(equipmentStatusLabel("down"))}</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Salud", "Health")}</div>
                    <select
                      className="selectField"
                      value={createForm.health}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          health: event.target.value as MachineItemContract["health"]
                        }))
                      }
                    >
                      <option value="healthy">{localizeText(equipmentHealthLabel("healthy"))}</option>
                      <option value="watch">{localizeText(equipmentHealthLabel("watch"))}</option>
                      <option value="critical">{localizeText(equipmentHealthLabel("critical"))}</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Disponibilidad %", "Availability %")}</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.availabilityPercent}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, availabilityPercent: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Utilizacion %", "Utilization %")}</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.utilizationPercent}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, utilizationPercent: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Horometro", "Hour meter")}</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.hourMeter}
                      onChange={(event) => setCreateForm((current) => ({ ...current, hourMeter: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Siguiente mantenimiento h", "Next maintenance h")}</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.nextMaintenanceHours}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, nextMaintenanceHours: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Backlog mantenimiento", "Maintenance backlog")}</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.maintenanceBacklog}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, maintenanceBacklog: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Fallas abiertas", "Open failures")}</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.openFailures}
                      onChange={(event) => setCreateForm((current) => ({ ...current, openFailures: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Fallas criticas", "Critical failures")}</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.criticalOpenFailures}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, criticalOpenFailures: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Siguiente accion", "Next action")}</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder={t("Liberar operador, revisar servicio y confirmar salida a obra", "Release operator, review service and confirm dispatch to site")}
                    />
                  </label>
                </div>

                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Puerta de creacion", "Creation gate")}</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createMachineGate.tone}>{createMachineGate.label}</Badge>
                        <span>{createMachineGate.summary}</span>
                      </div>
                      {createMachineGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                    <div>{createMachineHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente impacto inmediato", "Immediate downstream")}</div>
                    <div>
                      {createForm.criticalOpenFailures !== "0"
                        ? t("Manten el activo fuera de despacho a campo y soporte de movimientos hasta contener las fallas.", "Keep the asset out of field dispatch and movement support until failures are contained.")
                        : createForm.status === "maintenance" || createForm.health === "watch"
                          ? t("Pasa el activo por mantenimiento controlado o despacho supervisado antes de tratarlo como capacidad limpia de campo.", "Route the asset through controlled maintenance or supervised dispatch before treating it as clean field capacity.")
                          : t("La maquina puede continuar a despacho a campo, soporte de inventario y seguimiento de calidad con supervision normal.", "The machine can continue into field dispatch, inventory support and quality follow-through with normal supervision.")}
                    </div>
                  </div>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateMachine()}>
                    {isCreating ? t("Guardando...", "Saving...") : t("Agregar maquina", "Add machine")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachineExample())}>{t("Cargar ejemplo demo", "Load demo example")}</button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("dispatch_ready"))}>{t("Preset despacho", "Dispatch-ready preset")}</button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("maintenance_hold"))}>{t("Preset mantenimiento", "Maintenance preset")}</button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("critical_breakdown"))}>{t("Preset averia", "Breakdown preset")}</button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachineEmptyForm())}>{t("Reiniciar formulario", "Reset form")}</button>
                  <Link className="buttonGhost" href="/inventory/movements">{t("Abrir movimientos", "Open movements")}</Link>
                  <Link className="buttonGhost" href="/field">{t("Abrir campo", "Open field")}</Link>
                  <Link className="buttonGhost" href="/operations">{t("Abrir operaciones", "Open operations")}</Link>
                  <Link className="buttonGhost" href="/quality">{t("Abrir calidad", "Open quality")}</Link>
                  {equipmentCreateFeedback ? <Badge tone="success">{localizeText(equipmentCreateFeedback)}</Badge> : null}
                  {equipmentErrorFeedback ? <span style={{ color: "var(--danger-700)" }}>{localizeText(equipmentErrorFeedback)}</span> : null}
                </div>
              </Card>

              <Card
                title="Workbench rules"
                description="These creation rules keep the workbench coherent until live POST endpoints exist."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Scope</div>
                    <div>New machines stay inside the current tenant session and immediately recalculate the board.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Selection</div>
                    <div>The newly created machine becomes the active focus item for dispatch and maintenance review.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Backend path</div>
                    <div>This form already persists through `POST /equipment/machines`, so the equipment lane is now backed by the API.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Starter presets</div>
                    <div>Use the preset buttons to simulate dispatch-ready assets, maintenance holds or full breakdown scenarios.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Operational handoff</div>
                    <div>The first useful action after creation should be obvious enough to continue straight into dispatch, maintenance or field support.</div>
                  </div>
                </div>
              </Card>
            </section>

            <Card
              title="Equipment risk watchlist"
              description="Operational risks affecting maintenance, breakdowns and dispatch confidence."
            >
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                columns={[
                  {
                    key: "risk",
                    label: "Risk",
                    render: (risk) => (
                      <div className="tableCellStack">
                        <strong>{risk.title}</strong>
                        <span className="tableCellMuted">{risk.category}</span>
                      </div>
                    )
                  },
                  {
                    key: "severity",
                    label: "Severity",
                    render: (risk) => (
                      <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                        {risk.severity}
                      </Badge>
                    )
                  },
                  {
                    key: "owner",
                    label: "Owner",
                    render: (risk) => risk.owner
                  },
                  {
                    key: "status",
                    label: "Current action",
                    render: (risk) => risk.status
                  }
                ]}
              />
            </Card>
          </>
        ) : (
          <EmptyState
            title={error ?? "Equipment overview unavailable"}
            description="We could not load the live equipment status for the selected company."
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
