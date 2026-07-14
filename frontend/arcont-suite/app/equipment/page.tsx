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

function buildEquipmentStory(machine: MachineItemContract | null, bridge: EquipmentBridgeContext) {
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
        ? `${machine.projectName} · ${machine.frontName} is directly exposed because this machine is down.`
        : machine.status === "maintenance"
          ? `${machine.projectName} · ${machine.frontName} is running under maintenance pressure.`
          : `${machine.projectName} · ${machine.frontName} currently has this machine available for dispatch.`,
    maintenanceSignal: isMaintenanceOverdue(machine)
      ? `Maintenance is already overdue and this asset should not be treated as stable for field planning.`
      : `${machine.nextMaintenanceHours} operating hours remain before the next service window.`,
    criticalAsset:
      machine.criticalOpenFailures > 0
        ? `${machine.criticalOpenFailures} critical failures still need closure before safe release.`
        : "No critical failure is currently open on the selected asset.",
    inventoryDependency: movementSignal
      ? `${movementSignal.code} is the current stock-movement anchor with ${movementSignal.pendingEvidence} pending evidence items and ${movementSignal.impactLevel} impact.`
      : "No inventory movement is currently in focus for this asset lane.",
    materialPressure: fieldMaterialSignal
      ? `${fieldMaterialSignal.summary} remains ${fieldMaterialSignal.status} with ${fieldMaterialSignal.requestedVolume} pending for this front.`
      : "No direct field material request is currently attached to this asset lane.",
    qualityConstraint: qualitySignal
      ? `${qualitySignal.code} remains ${qualitySignal.status} with ${qualitySignal.openFindings} open findings and ${qualitySignal.releaseReadiness}% release readiness.`
      : "No quality-release constraint is currently attached to the active equipment lane."
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
    return "Availability must stay between 0% and 100%.";
  }

  if (!Number.isFinite(input.utilizationPercent) || input.utilizationPercent < 0 || input.utilizationPercent > 100) {
    return "Utilization must stay between 0% and 100%.";
  }

  if (!Number.isFinite(input.hourMeter) || input.hourMeter < 0) {
    return "Hour meter must be zero or greater.";
  }

  if (!Number.isFinite(input.nextMaintenanceHours) || input.nextMaintenanceHours < 0) {
    return "Next maintenance hours must be zero or greater.";
  }

  if (!Number.isFinite(input.maintenanceBacklog) || input.maintenanceBacklog < 0) {
    return "Maintenance backlog must be zero or greater.";
  }

  if (!Number.isFinite(input.openFailures) || input.openFailures < 0) {
    return "Open failures must be zero or greater.";
  }

  if (!Number.isFinite(input.criticalOpenFailures) || input.criticalOpenFailures < 0) {
    return "Critical failures must be zero or greater.";
  }

  if (input.openFailures < input.criticalOpenFailures) {
    return "Open failures cannot be lower than critical failures.";
  }

  if (input.status === "available" && input.criticalOpenFailures > 0) {
    return "Available status is blocked while critical failures remain open.";
  }

  if (
    input.health === "healthy" &&
    (input.criticalOpenFailures > 0 || input.nextMaintenanceHours <= 0 || input.maintenanceBacklog > 0)
  ) {
    return "Healthy status requires no critical failures and no overdue maintenance pressure.";
  }

  return null;
}

function createMachineExample() {
  return {
    machineName: "Retroexcavadora John Deere 310L",
    machineType: "Retroexcavadora",
    projectName: "Villas del Mayab",
    frontName: "Frente terracerias",
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

function buildDispatchReadiness(machine: MachineItemContract | null) {
  if (!machine) {
    return {
      tone: "info" as const,
      label: "Select an asset",
      description: "Choose a machine to verify if it can really be dispatched to field."
    };
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return {
      tone: "danger" as const,
      label: "Blocked for dispatch",
      description: "The machine should stay out of field assignment until the breakdown or critical failures are closed."
    };
  }

  if (isMaintenanceOverdue(machine) || machine.health !== "healthy") {
    return {
      tone: "warning" as const,
      label: "Dispatch with caution",
      description: "Maintenance timing or health posture still requires supervision before releasing this asset."
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for dispatch",
    description: "This asset can move into field planning without an obvious maintenance or failure blocker."
  };
}

function buildEquipmentDestination(machine: MachineItemContract | null) {
  if (!machine) {
    return {
      label: "No active route",
      description: "Select a machine to decide which module should take the next step.",
      href: "/equipment"
    };
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return {
      label: "Escalate to field",
      description: "Production continuity is already exposed, so the front should be replanned from field execution.",
      href: "/field"
    };
  }

  if (isMaintenanceOverdue(machine) || machine.status === "maintenance") {
    return {
      label: "Review inventory flow",
      description: "Maintenance recovery should stay aligned with inbound material and movements for the affected front.",
      href: "/inventory/movements"
    };
  }

  return {
    label: "Validate quality release",
    description: "If the asset is mechanically stable, confirm release posture before full field continuity.",
    href: "/quality"
  };
}

function buildFrontContinuity(machine: MachineItemContract | null) {
  if (!machine) {
    return {
      label: "Select an asset",
      description: "Choose a machine to understand how it affects the active front before dispatch or escalation."
    };
  }

  if (machine.status === "down") {
    return {
      label: "Front exposed",
      description: `${machine.projectName} · ${machine.frontName} should be replanned immediately because this asset is already down.`
    };
  }

  if (machine.status === "maintenance" || machine.health === "critical") {
    return {
      label: "Front at risk",
      description: `${machine.projectName} · ${machine.frontName} still depends on maintenance recovery before it can run with confidence.`
    };
  }

  if (machine.health === "watch" || isMaintenanceOverdue(machine)) {
    return {
      label: "Front under watch",
      description: `${machine.projectName} · ${machine.frontName} can continue, but dispatch should stay coordinated with field and maintenance.`
    };
  }

  return {
    label: "Front covered",
    description: `${machine.projectName} · ${machine.frontName} currently has asset support without an obvious dispatch blocker.`
  };
}

function buildFieldHandoff(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to see what field teams should do next.";
  }

  if (machine.status === "down") {
    return "Field should protect the front, switch sequence if possible and confirm whether replacement equipment is required today.";
  }

  if (machine.status === "maintenance") {
    return "Field should confirm whether work can continue around the maintenance window or whether the front must pause until release.";
  }

  if (machine.health === "watch") {
    return "Field should keep the machine operating under supervision and report any new symptom before the next shift cut-off.";
  }

  return "Field can continue with normal execution, but the next action should still confirm who receives and uses the asset at the front.";
}

function buildReleaseCheckpoint(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to verify the final checkpoint before release to field.";
  }

  if (machine.criticalOpenFailures > 0) {
    return "Critical failures must close before the asset can be treated as releasable for any front.";
  }

  if (isMaintenanceOverdue(machine)) {
    return "Maintenance exposure still needs an explicit go/no-go decision before this asset returns to normal dispatch.";
  }

  if (machine.health === "watch") {
    return "Release can happen only with an owner, supervision window and a clear next report-back to maintenance.";
  }

  return "The asset can be released if the operator, receiving front and next shift handoff are already confirmed.";
}

function buildDownstreamChain(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to visualize the next downstream chain.";
  }

  if (machine.status === "down") {
    return "Equipment -> Field replanning -> Daily log -> Operations follow-up";
  }

  if (machine.status === "maintenance") {
    return "Equipment -> Inventory movements -> Field confirmation -> Daily log";
  }

  if (machine.health === "watch") {
    return "Equipment -> Field supervision -> Quality or daily log verification";
  }

  return "Equipment -> Field execution -> Daily log closeout";
}

function buildOperatingBottleneck(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to identify the main operational bottleneck.";
  }

  if (machine.criticalOpenFailures > 0) {
    return "Critical failures are the main bottleneck and block normal dispatch.";
  }

  if (isMaintenanceOverdue(machine)) {
    return "Overdue maintenance is the main bottleneck and still limits safe release.";
  }

  if (machine.health === "watch") {
    return "Condition watch is the main bottleneck; field can continue only with closer supervision.";
  }

  return "No hard bottleneck is visible; the main task is disciplined release and front handoff.";
}

function buildImmediateCommand(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to see the immediate command.";
  }

  if (machine.status === "down") {
    return "Protect the front, isolate the asset and trigger replacement or resequencing now.";
  }

  if (machine.status === "maintenance") {
    return "Close the maintenance gate, confirm release criteria and tell field whether the front pauses or continues around it.";
  }

  if (machine.health === "watch") {
    return "Release only with owner, monitoring window and clear report-back to maintenance and field.";
  }

  return "Confirm operator, receiving front and next-shift handoff, then release the asset into execution.";
}

function buildCommandOwner(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to identify the current owner.";
  }

  if (machine.status === "down") {
    return "Maintenance lead with field supervision";
  }

  if (machine.status === "maintenance") {
    return "Maintenance lead and dispatch coordinator";
  }

  if (machine.health === "watch") {
    return "Dispatch coordinator with resident engineer";
  }

  return "Dispatch coordinator and receiving front owner";
}

function buildDispatchConfirmation(machine: MachineItemContract | null) {
  if (!machine) {
    return "Select a machine to define the required confirmation.";
  }

  if (machine.status === "down") {
    return "Confirm replacement plan or resequencing before the next field cutoff.";
  }

  if (machine.status === "maintenance") {
    return "Confirm release criteria, operator handoff and whether the front pauses or continues around maintenance.";
  }

  if (machine.health === "watch") {
    return "Confirm monitoring window, escalation threshold and report-back timing for the next shift.";
  }

  return "Confirm operator, front receiver and daily-log handoff before releasing the asset.";
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

function buildDispatchPacketStatus(machine: MachineItemContract | null) {
  if (!machine) {
    return {
      tone: "info" as const,
      label: "Select an asset",
      summary: "Choose a machine to summarize dispatch status."
    };
  }

  if (machine.status === "down" || machine.criticalOpenFailures > 0) {
    return {
      tone: "danger" as const,
      label: "Dispatch blocked",
      summary: "The asset should not leave control until failures or replacement decisions are closed."
    };
  }

  if (machine.status === "maintenance" || isMaintenanceOverdue(machine) || machine.health === "watch") {
    return {
      tone: "warning" as const,
      label: "Dispatch under watch",
      summary: "The asset can only move with explicit supervision, confirmation and report-back discipline."
    };
  }

  return {
    tone: "success" as const,
    label: "Dispatch aligned",
    summary: "The asset is close to operational release if front, operator and handoff are confirmed."
  };
}

function buildCrossPressureSummary(story: ReturnType<typeof buildEquipmentStory>) {
  if (!story) {
    return "Select a machine to review cross-pressure from inventory, materials and quality.";
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
}) {
  if (input.criticalOpenFailures > 0) {
    return "Contain the critical failure first so the machine does not open as dispatchable by mistake.";
  }

  if (input.status === "maintenance" || input.maintenanceBacklog > 0 || input.nextMaintenanceHours <= 0) {
    return "Create the asset only with an explicit maintenance closeout owner and release condition.";
  }

  if (input.health === "watch") {
    return "Create the asset and assign same-shift supervision before sending it to the front.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the immediate maintenance or dispatch action before persisting the machine.";
  }

  return "Create the machine and continue directly into field dispatch, movement support or quality follow-through.";
}

export default function EquipmentPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
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
    return buildEquipmentStory(selectedMachine, bridgeContext);
  }, [bridgeContext, selectedMachine]);
  const dispatchReadiness = useMemo(() => buildDispatchReadiness(selectedMachine), [selectedMachine]);
  const equipmentDestination = useMemo(() => buildEquipmentDestination(selectedMachine), [selectedMachine]);
  const frontContinuity = useMemo(() => buildFrontContinuity(selectedMachine), [selectedMachine]);
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
      }),
    [createForm.health, createForm.nextAction, createForm.status, createFormNumbers]
  );
  const fieldHandoff = useMemo(() => buildFieldHandoff(selectedMachine), [selectedMachine]);
  const releaseCheckpoint = useMemo(() => buildReleaseCheckpoint(selectedMachine), [selectedMachine]);
  const downstreamChain = useMemo(() => buildDownstreamChain(selectedMachine), [selectedMachine]);
  const operatingBottleneck = useMemo(() => buildOperatingBottleneck(selectedMachine), [selectedMachine]);
  const immediateCommand = useMemo(() => buildImmediateCommand(selectedMachine), [selectedMachine]);
  const commandOwner = useMemo(() => buildCommandOwner(selectedMachine), [selectedMachine]);
  const dispatchConfirmation = useMemo(() => buildDispatchConfirmation(selectedMachine), [selectedMachine]);
  const reportBackWindow = useMemo(() => buildReportBackWindow(selectedMachine), [selectedMachine]);
  const selectedWhyNow = useMemo(() => buildEquipmentWhyNow(selectedMachine), [selectedMachine]);
  const selectedDownstreamEffect = useMemo(() => buildEquipmentDownstreamEffect(selectedMachine), [selectedMachine]);
  const selectedHumanStep = useMemo(() => buildEquipmentHumanStep(selectedMachine), [selectedMachine]);
  const selectedRouteSummary = useMemo(() => buildEquipmentRouteSummary(selectedMachine), [selectedMachine]);
  const selectedOperationalLinks = useMemo(() => buildEquipmentOperationalLinks(selectedMachine), [selectedMachine]);
  const dispatchPacketStatus = useMemo(() => buildDispatchPacketStatus(selectedMachine), [selectedMachine]);
  const crossPressureSummary = useMemo(() => buildCrossPressureSummary(equipmentStory), [equipmentStory]);

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
    setNextActionDraft(selectedMachine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedMachineId, selectedMachine?.id, selectedMachine?.nextAction]);

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
      setActionError("Next action must be more specific before updating the machine.");
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
      setActionError(response.error?.message ?? "Equipment update failed.");
      setIsSaving(false);
      return;
    }

    const updatedMachine = response.data;

    setOverview((current) => (current ? deriveOverview(current, updatedMachine) : current));
    setNextActionDraft(updatedMachine.nextAction);
    setActionMessage(`Machine moved to ${updatedMachine.status} / ${updatedMachine.health}.`);
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
      setActionError("Machine, type, project and front must be specific before creating equipment.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before creating the machine.");
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
      setActionError(response.error?.message ?? "Equipment creation failed.");
      setIsCreating(false);
      return;
    }

    const newMachine = response.data;
    setOverview((current) => (current ? deriveOverview(current, newMachine) : current));
    setSelectedMachineId(newMachine.id);
    setNextActionDraft(newMachine.nextAction);
    setCreateMessage(`${newMachine.code} added to the equipment workbench.`);
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
      title="Equipment and maintenance"
      eyebrow="Execution domain"
      description="Machinery availability, operating hours, failures and maintenance readiness tied to active fronts."
    >
      <ModuleGate moduleKeys={["inventory.equipment"]} requiredPermissions={["inventory:*"]} title="Equipment">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked machines"
                value={filteredSummary.trackedMachines.toLocaleString()}
                footnote="Equipment units currently controlled in the active tenant."
              />
              <KpiCard
                label="Available"
                value={String(filteredSummary.availableMachines)}
                footnote="Machines ready for dispatch without open blocking conditions."
              />
              <KpiCard
                label="Overdue maintenance"
                value={String(filteredSummary.overdueMaintenance)}
                footnote="Units that still cannot clear maintenance exposure."
              />
              <KpiCard
                label="Critical failures"
                value={String(filteredSummary.criticalOpenFailures)}
                footnote="Open critical breakdown signals across the active fleet."
              />
              <KpiCard
                label="Affected fronts"
                value={String(affectedFronts)}
                footnote="Active fronts currently exposed to equipment downtime, maintenance or degraded health."
              />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Equipment actions are persisted locally in this browser so field and maintenance flows can be tested immediately."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Teams can inspect machines, change status or health, and register new assets without waiting for production auth.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Move one machine from maintenance to available, then create a new asset tied to an active project front.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols3">
              <Card
                title="Equipment workflow"
                description="Equipment should connect maintenance, inventory support and field release in one operating route."
                aside={<Badge tone={filteredSummary.criticalOpenFailures > 0 ? "danger" : filteredSummary.overdueMaintenance > 0 ? "warning" : "success"}>{filteredSummary.criticalOpenFailures > 0 ? "critical lane" : filteredSummary.overdueMaintenance > 0 ? "maintenance watch" : "stable lane"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Asset readiness</div><div>Availability alone is not enough; maintenance and failure posture decide if a machine is truly dispatchable.</div></div>
                  <div className="detailRow"><div className="detailLabel">Material continuity</div><div>Equipment lanes should stay aligned with inbound material and site movements when the front depends on both.</div></div>
                  <div className="detailRow"><div className="detailLabel">Field release</div><div>After stabilizing the machine, operators should jump directly into field or quality follow-up instead of stopping in maintenance only.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/inventory/movements">Open movements</Link>
                  <Link className="buttonGhost" href="/inventory/receiving">Open receiving</Link>
                  <Link className="buttonGhost" href="/field">Open field</Link>
                </div>
              </Card>

              <Card title="Field execution impact" description="What the selected asset means for active production fronts.">
                <p className="sectionText">
                  {equipmentStory?.fieldImpact ?? "Choose an asset to inspect its field execution impact."}
                </p>
              </Card>
              <Card title="Maintenance pressure" description="Immediate maintenance posture for the selected machine.">
                <p className="sectionText">
                  {equipmentStory?.maintenanceSignal ?? "Choose an asset to inspect its maintenance pressure."}
                </p>
              </Card>
              <Card title="Critical asset for today" description="Fast read for dispatch, resident engineers and field supervisors.">
                <p className="sectionText">
                  {equipmentStory?.criticalAsset ?? "Choose an asset to inspect today's critical condition."}
                </p>
              </Card>
              <Card title="Inventory dependency" description="Warehouse and material-handling pressure attached to this asset lane.">
                <p className="sectionText">
                  {equipmentStory?.inventoryDependency ?? "Choose an asset to inspect inventory dependency."}
                </p>
              </Card>
              <Card title="Material request pressure" description="Whether the front already carries a live supply request tied to this asset lane.">
                <p className="sectionText">
                  {equipmentStory?.materialPressure ?? "Choose an asset to inspect field material pressure."}
                </p>
              </Card>
              <Card title="Quality constraint" description="Release and corrective-work signal around the selected machine.">
                <p className="sectionText">
                  {equipmentStory?.qualityConstraint ?? "Choose an asset to inspect quality constraints."}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card
                title="Dispatch readiness"
                description="Whether the selected machine can truly leave maintenance control and support field execution."
                aside={<Badge tone={dispatchReadiness.tone}>{dispatchReadiness.label}</Badge>}
              >
                <p className="sectionText">{dispatchReadiness.description}</p>
              </Card>
              <Card title="Next route" description="Best module to continue the machine workflow from the current blocker.">
                <p className="sectionText">{equipmentDestination.description}</p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href={equipmentDestination.href}>
                    {equipmentDestination.label}
                  </Link>
                </div>
              </Card>
              <Card title="Dispatcher checklist" description="Minimum controls before releasing machinery to the front.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Failures</div><div>No critical failures open for a machine that will be dispatched.</div></div>
                  <div className="detailRow"><div className="detailLabel">Maintenance</div><div>Do not release overdue maintenance without an explicit operational decision.</div></div>
                  <div className="detailRow"><div className="detailLabel">Follow-up</div><div>Every machine needs a next action that tells maintenance or field what happens next.</div></div>
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Front continuity"
                description="How the selected asset is shaping real execution continuity at the front."
                aside={<Badge tone={frontContinuity.label === "Front exposed" ? "danger" : frontContinuity.label === "Front at risk" || frontContinuity.label === "Front under watch" ? "warning" : "success"}>{frontContinuity.label}</Badge>}
              >
                <p className="sectionText">{frontContinuity.description}</p>
              </Card>
              <Card title="Field handoff" description="What field teams should do next once equipment status is known.">
                <p className="sectionText">{fieldHandoff}</p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href="/field">
                    Open field
                  </Link>
                  <Link className="buttonGhost" href="/daily-log">
                    Open daily log
                  </Link>
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Release checkpoint" description="Final gate before the machine is treated as truly usable in field.">
                <p className="sectionText">{releaseCheckpoint}</p>
              </Card>
              <Card title="Downstream chain" description="What operational chain should happen after the equipment decision.">
                <p className="sectionText">{downstreamChain}</p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Operating bottleneck" description="The main reason this asset is still pressuring execution right now.">
                <p className="sectionText">{operatingBottleneck}</p>
              </Card>
              <Card title="Immediate command" description="What dispatch, maintenance or field should do now without further interpretation.">
                <p className="sectionText">{immediateCommand}</p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Fleet posture" description="Availability, maintenance and utilization by machine.">
                <FilterBar summary={`${filteredMachines.length} machines match the current operating filters`}>
                  <label className="fieldLabel">
                    Status
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">All</option>
                      <option value="available">Available</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="down">Down</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="healthy">Healthy</option>
                      <option value="watch">Watch</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Project / front
                    <input
                      className="field"
                      type="search"
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                      placeholder="Project or front"
                    />
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Asset search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Machine, type, code or action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "equipment ready"}</Badge>
                  <Badge tone={filteredSummary.criticalOpenFailures > 0 ? "danger" : filteredSummary.overdueMaintenance > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalOpenFailures > 0
                      ? `${filteredSummary.criticalOpenFailures} critical failures`
                      : filteredSummary.overdueMaintenance > 0
                        ? `${filteredSummary.overdueMaintenance} overdue`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredMachines}
                  columns={[
                    {
                      key: "machine",
                      label: "Machine",
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
                      label: "Front",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectName}</strong>
                          <span className="tableCellMuted">{row.frontName}</span>
                        </div>
                      )
                    },
                    {
                      key: "hours",
                      label: "Hours",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.hourMeter.toLocaleString()} h</strong>
                          <span className="tableCellMuted">{row.nextMaintenanceHours} h to next service</span>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => (
                        <div className="tableCellStack">
                          <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                          <Badge tone={healthTone(row.health)}>{row.health}</Badge>
                        </div>
                      )
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected machine"
                description="Focused equipment context for dispatch, maintenance and failure control."
                aside={
                  selectedMachine ? (
                    <div className="tableCellStack">
                      <Badge tone={statusTone(selectedMachine.status)}>{selectedMachine.status}</Badge>
                      <Badge tone={healthTone(selectedMachine.health)}>{selectedMachine.health}</Badge>
                    </div>
                  ) : null
                }
              >
                {selectedMachine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Front</div>
                      <div>
                        {selectedMachine.projectName} · {selectedMachine.frontName}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Availability</div>
                      <div>{selectedMachine.availabilityPercent}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Utilization</div>
                      <div>{selectedMachine.utilizationPercent}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Maintenance due</div>
                      <div>
                        {new Date(selectedMachine.maintenanceDueDate).toLocaleString()}
                        {isMaintenanceOverdue(selectedMachine) ? " · overdue" : ""}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Failures</div>
                      <div>
                        {selectedMachine.openFailures} open · {selectedMachine.criticalOpenFailures} critical
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{selectedWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{selectedDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Route summary</div>
                      <div>{selectedRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next operational or maintenance action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Dispatch packet</div>
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
                      <div className="detailLabel">Cross-pressure</div>
                      <div className="tableCellStack">
                        <span>{crossPressureSummary}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedMachine.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Command owner</div>
                      <div>{commandOwner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Dispatch confirmation</div>
                      <div>{dispatchConfirmation}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{selectedHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report-back window</div>
                      <div>{reportBackWindow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Available is blocked while maintenance is overdue.</span>
                        <span className="tableCellMuted">Available is blocked while critical failures remain open.</span>
                        <span className="tableCellMuted">Healthy requires available status and no blocking conditions.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Linked actions</div>
                      <div className="row gap wrap">
                        {selectedOperationalLinks.map((link, index) => (
                          <Link key={link.href + link.label} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status actions</div>
                      <div className="emptyActions">
                        {statusOptions.map((option) => (
                          <button
                            key={option.label}
                            className={option.status === "down" ? "buttonGhost" : "button"}
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleMachineAction(option.status, option.health, option.nextAction)}
                          >
                            {isSaving ? "Saving..." : option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Health actions</div>
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
                              {isSaving ? "Saving..." : option.label}
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
                    title="No machine selected"
                    description="Choose a machine from the table to inspect availability, maintenance and open failures."
                    primaryAction={{ label: "Stay on equipment", href: "/equipment" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Register machine"
                description="Create a new equipment lane directly in the tenant backend and reflect it immediately on the board."
              >
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Machine</div>
                    <input
                      className="field"
                      value={createForm.machineName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, machineName: event.target.value }))}
                      placeholder="Excavadora CAT 320"
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Type</div>
                    <input
                      className="field"
                      value={createForm.machineType}
                      onChange={(event) => setCreateForm((current) => ({ ...current, machineType: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Project</div>
                    <input
                      className="field"
                      value={createForm.projectName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Front</div>
                    <input
                      className="field"
                      value={createForm.frontName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Status</div>
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
                      <option value="available">available</option>
                      <option value="maintenance">maintenance</option>
                      <option value="down">down</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Health</div>
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
                      <option value="healthy">healthy</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Availability %</div>
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
                    <div className="detailLabel">Utilization %</div>
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
                    <div className="detailLabel">Hour meter</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.hourMeter}
                      onChange={(event) => setCreateForm((current) => ({ ...current, hourMeter: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next maintenance h</div>
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
                    <div className="detailLabel">Maintenance backlog</div>
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
                    <div className="detailLabel">Open failures</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.openFailures}
                      onChange={(event) => setCreateForm((current) => ({ ...current, openFailures: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Critical failures</div>
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
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder="Liberar operador, revisar servicio y confirmar salida a obra"
                    />
                  </label>
                </div>

                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
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
                    <div className="detailLabel">Next human step</div>
                    <div>{createMachineHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Immediate downstream</div>
                    <div>
                      {createForm.criticalOpenFailures !== "0"
                        ? "Keep the asset out of field dispatch and movement support until failures are contained."
                        : createForm.status === "maintenance" || createForm.health === "watch"
                          ? "Route the asset through controlled maintenance or supervised dispatch before treating it as clean field capacity."
                          : "The machine can continue into field dispatch, inventory support and quality follow-through with normal supervision."}
                    </div>
                  </div>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateMachine()}>
                    {isCreating ? "Saving..." : "Add machine"}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachineExample())}>
                    Load demo example
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("dispatch_ready"))}>
                    Dispatch-ready preset
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("maintenance_hold"))}>
                    Maintenance preset
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachinePreset("critical_breakdown"))}>
                    Breakdown preset
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createMachineEmptyForm())}>
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/inventory/movements">Review movements</Link>
                  <Link className="buttonGhost" href="/field">Review field</Link>
                  <Link className="buttonGhost" href="/operations">Review operations</Link>
                  <Link className="buttonGhost" href="/quality">Review quality</Link>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
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
