import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedHealthTransitions: Record<
  "healthy" | "watch" | "critical",
  Array<"healthy" | "watch" | "critical">
> = {
  healthy: ["watch"],
  watch: ["healthy", "critical"],
  critical: ["watch"]
};

const allowedStatusTransitions: Record<
  "available" | "maintenance" | "down",
  Array<"available" | "maintenance" | "down">
> = {
  available: ["maintenance", "down"],
  maintenance: ["available", "down"],
  down: ["maintenance"]
};

function hasOverdueMaintenance(machine: {
  maintenanceDueDate: string;
  nextMaintenanceHours: number;
  maintenanceBacklog: number;
}) {
  return (
    machine.maintenanceBacklog > 0 ||
    machine.nextMaintenanceHours <= 0 ||
    Date.parse(machine.maintenanceDueDate) <= Date.now()
  );
}

export function createEquipmentService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("EQUIPMENT_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const machines = await repository.listMachines(companyId);
      const risks = await repository.listMachineRisks(companyId);
      const overdueMaintenance = machines.filter((machine) => hasOverdueMaintenance(machine)).length;
      const availableMachines = machines.filter((machine) => machine.status === "available").length;
      const machinesInMaintenance = machines.filter((machine) => machine.status === "maintenance").length;
      const criticalOpenFailures = machines.reduce((sum, machine) => sum + machine.criticalOpenFailures, 0);
      const averageAvailability =
        machines.length > 0
          ? Number((machines.reduce((sum, machine) => sum + machine.availabilityPercent, 0) / machines.length).toFixed(1))
          : 0;
      const focusMachine =
        machines
          .slice()
          .sort((left, right) => {
            if (left.criticalOpenFailures !== right.criticalOpenFailures) {
              return right.criticalOpenFailures - left.criticalOpenFailures;
            }

            const leftOverdue = hasOverdueMaintenance(left) ? 1 : 0;
            const rightOverdue = hasOverdueMaintenance(right) ? 1 : 0;
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
        summary: {
          trackedMachines: machines.length,
          availableMachines,
          machinesInMaintenance,
          overdueMaintenance,
          criticalOpenFailures,
          averageAvailability
        },
        machines,
        risks,
        focusMachine
      };
    },
    async updateMachine(input: {
      companyId: string;
      machineId: string;
      status: "available" | "maintenance" | "down";
      health: "healthy" | "watch" | "critical";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("EQUIPMENT_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const machines = await repository.listMachines(input.companyId);
      const machine = machines.find((item) => item.id === input.machineId);
      if (!machine) {
        throw notFound("EQUIPMENT_MACHINE_NOT_FOUND", "Machine not found", {
          companyId: input.companyId,
          machineId: input.machineId
        });
      }

      if (
        machine.status === input.status &&
        machine.health === input.health &&
        machine.nextAction === input.nextAction
      ) {
        return machine;
      }

      if (machine.status !== input.status) {
        const allowedTransitions = allowedStatusTransitions[machine.status];
        if (!allowedTransitions.includes(input.status)) {
          throw validationError("EQUIPMENT_INVALID_STATUS_TRANSITION", "Machine status transition is not allowed", {
            machineId: machine.id,
            currentStatus: machine.status,
            nextStatus: input.status
          });
        }
      }

      if (machine.health !== input.health) {
        const allowedTransitions = allowedHealthTransitions[machine.health];
        if (!allowedTransitions.includes(input.health)) {
          throw validationError("EQUIPMENT_INVALID_HEALTH_TRANSITION", "Machine health transition is not allowed", {
            machineId: machine.id,
            currentHealth: machine.health,
            nextHealth: input.health
          });
        }
      }

      const maintenanceOverdue = hasOverdueMaintenance(machine);
      const hasCriticalFailure = machine.criticalOpenFailures > 0;

      if (input.status === "available" && maintenanceOverdue) {
        throw validationError(
          "EQUIPMENT_MAINTENANCE_OVERDUE",
          "Machine cannot be marked available while maintenance is overdue",
          {
            machineId: machine.id,
            maintenanceDueDate: machine.maintenanceDueDate,
            nextMaintenanceHours: machine.nextMaintenanceHours,
            maintenanceBacklog: machine.maintenanceBacklog
          }
        );
      }

      if (input.status === "available" && hasCriticalFailure) {
        throw validationError(
          "EQUIPMENT_CRITICAL_FAILURE_OPEN",
          "Machine cannot be marked available while a critical failure remains open",
          {
            machineId: machine.id,
            criticalOpenFailures: machine.criticalOpenFailures
          }
        );
      }

      if (input.health === "healthy" && input.status !== "available") {
        throw validationError(
          "EQUIPMENT_HEALTHY_REQUIRES_AVAILABLE",
          "Machine can only be healthy when it is available",
          {
            machineId: machine.id,
            nextStatus: input.status
          }
        );
      }

      if (input.health === "healthy" && maintenanceOverdue) {
        throw validationError(
          "EQUIPMENT_HEALTHY_BLOCKED_BY_MAINTENANCE",
          "Machine cannot be marked healthy while maintenance is overdue",
          {
            machineId: machine.id,
            maintenanceDueDate: machine.maintenanceDueDate
          }
        );
      }

      if (input.health === "healthy" && hasCriticalFailure) {
        throw validationError(
          "EQUIPMENT_HEALTHY_BLOCKED_BY_FAILURE",
          "Machine cannot be marked healthy while a critical failure remains open",
          {
            machineId: machine.id,
            criticalOpenFailures: machine.criticalOpenFailures
          }
        );
      }

      if (input.status === "available" && input.health === "critical") {
        throw validationError(
          "EQUIPMENT_AVAILABLE_CRITICAL_CONFLICT",
          "Machine cannot be marked available while health remains critical",
          {
            machineId: machine.id
          }
        );
      }

      const updatedMachine = await repository.updateMachineItem({
        machineId: input.machineId,
        status: input.status,
        health: input.health,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "machine_item",
        aggregateId: updatedMachine.id,
        action: "equipment.machine.updated",
        metadata: {
          status: updatedMachine.status,
          health: updatedMachine.health,
          nextAction: updatedMachine.nextAction
        }
      });

      return updatedMachine;
    },
    async createMachine(input: {
      companyId: string;
      machineName: string;
      machineType: string;
      projectName: string;
      frontName: string;
      status: "available" | "maintenance" | "down";
      health: "healthy" | "watch" | "critical";
      availabilityPercent: number;
      utilizationPercent: number;
      hourMeter: number;
      nextMaintenanceHours: number;
      maintenanceBacklog: number;
      openFailures: number;
      criticalOpenFailures: number;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("EQUIPMENT_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const machines = await repository.listMachines(input.companyId);
      const machineName = input.machineName.trim();
      const machineType = input.machineType.trim();
      const projectName = input.projectName.trim();
      const frontName = input.frontName.trim();
      const nextAction = input.nextAction.trim();

      if (machineName.length < 3 || machineType.length < 3 || projectName.length < 3 || frontName.length < 3) {
        throw validationError(
          "EQUIPMENT_INVALID_INPUT",
          "Machine, type, project and front must be specific",
          {
            machineNameLength: machineName.length,
            machineTypeLength: machineType.length,
            projectNameLength: projectName.length,
            frontNameLength: frontName.length
          }
        );
      }

      if (
        input.availabilityPercent < 0 ||
        input.availabilityPercent > 100 ||
        input.utilizationPercent < 0 ||
        input.utilizationPercent > 100
      ) {
        throw validationError(
          "EQUIPMENT_INVALID_PERCENTAGES",
          "Availability and utilization must stay between 0 and 100",
          {
            availabilityPercent: input.availabilityPercent,
            utilizationPercent: input.utilizationPercent
          }
        );
      }

      if (
        [input.hourMeter, input.nextMaintenanceHours, input.maintenanceBacklog, input.openFailures, input.criticalOpenFailures].some(
          (value) => !Number.isFinite(value) || value < 0
        )
      ) {
        throw validationError(
          "EQUIPMENT_INVALID_METRICS",
          "Hours, backlog and failure counters must be zero or greater",
          {
            hourMeter: input.hourMeter,
            nextMaintenanceHours: input.nextMaintenanceHours,
            maintenanceBacklog: input.maintenanceBacklog,
            openFailures: input.openFailures,
            criticalOpenFailures: input.criticalOpenFailures
          }
        );
      }

      if (nextAction.length < 8) {
        throw validationError(
          "EQUIPMENT_INVALID_NEXT_ACTION",
          "Next action must be specific before creating a machine",
          {
            nextActionLength: nextAction.length
          }
        );
      }

      if (
        machines.some(
          (item) =>
            item.machineName.trim().toLowerCase() === machineName.toLowerCase() &&
            item.projectName.trim().toLowerCase() === projectName.toLowerCase() &&
            item.frontName.trim().toLowerCase() === frontName.toLowerCase()
        )
      ) {
        throw validationError(
          "EQUIPMENT_MACHINE_DUPLICATE",
          "A machine with the same name already exists on this project front",
          {
            companyId: input.companyId,
            machineName,
            projectName,
            frontName
          }
        );
      }

      if (input.criticalOpenFailures > input.openFailures) {
        throw validationError(
          "EQUIPMENT_CRITICAL_FAILURES_INVALID",
          "Critical failures cannot exceed total open failures",
          {
            criticalOpenFailures: input.criticalOpenFailures,
            openFailures: input.openFailures
          }
        );
      }

      if (input.status === "available" && input.criticalOpenFailures > 0) {
        throw validationError(
          "EQUIPMENT_CRITICAL_FAILURE_OPEN",
          "Machine cannot start as available while a critical failure remains open",
          {
            criticalOpenFailures: input.criticalOpenFailures
          }
        );
      }

      if (input.status === "available" && (input.maintenanceBacklog > 0 || input.nextMaintenanceHours <= 0)) {
        throw validationError(
          "EQUIPMENT_MAINTENANCE_OVERDUE",
          "Machine cannot start as available while maintenance is overdue",
          {
            maintenanceBacklog: input.maintenanceBacklog,
            nextMaintenanceHours: input.nextMaintenanceHours
          }
        );
      }

      if (input.health === "healthy" && input.status !== "available") {
        throw validationError(
          "EQUIPMENT_HEALTHY_REQUIRES_AVAILABLE",
          "Machine can only start as healthy when it is available",
          {
            status: input.status
          }
        );
      }

      if (input.health === "healthy" && (input.maintenanceBacklog > 0 || input.nextMaintenanceHours <= 0)) {
        throw validationError(
          "EQUIPMENT_HEALTHY_BLOCKED_BY_MAINTENANCE",
          "Machine cannot start as healthy while maintenance is overdue",
          {
            maintenanceBacklog: input.maintenanceBacklog,
            nextMaintenanceHours: input.nextMaintenanceHours
          }
        );
      }

      if (input.health === "healthy" && input.criticalOpenFailures > 0) {
        throw validationError(
          "EQUIPMENT_HEALTHY_BLOCKED_BY_FAILURE",
          "Machine cannot start as healthy while a critical failure remains open",
          {
            criticalOpenFailures: input.criticalOpenFailures
          }
        );
      }

      if (input.status === "available" && input.health === "critical") {
        throw validationError(
          "EQUIPMENT_AVAILABLE_CRITICAL_CONFLICT",
          "Machine cannot start as available while health remains critical",
          {
            health: input.health
          }
        );
      }

      const now = new Date();
      const createdMachine = await repository.createMachineItem({
        companyId: input.companyId,
        code: `EQ-${String(machines.length + 1).padStart(3, "0")}`,
        machineName,
        machineType,
        projectName,
        frontName,
        status: input.status,
        health: input.health,
        availabilityPercent: input.availabilityPercent,
        utilizationPercent: input.utilizationPercent,
        hourMeter: input.hourMeter,
        nextMaintenanceHours: input.nextMaintenanceHours,
        maintenanceDueDate: new Date(
          now.getTime() + Math.max(input.nextMaintenanceHours, 1) * 60 * 60 * 1000
        ).toISOString(),
        maintenanceBacklog: input.maintenanceBacklog,
        openFailures: input.openFailures,
        criticalOpenFailures: input.criticalOpenFailures,
        lastServiceAt: now.toISOString(),
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "machine_item",
        aggregateId: createdMachine.id,
        action: "equipment.machine.created",
        metadata: {
          code: createdMachine.code,
          status: createdMachine.status,
          health: createdMachine.health,
          projectName: createdMachine.projectName,
          frontName: createdMachine.frontName
        }
      });

      return createdMachine;
    }
  };
}
