"use client";

import { useEffect, useMemo, useState } from "react";
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
} | null;

function buildEquipmentStory(machine: MachineItemContract | null, bridge: EquipmentBridgeContext) {
  if (!machine) {
    return null;
  }

  const movementSignal = bridge?.movements.focusMovement ?? null;
  const qualitySignal = bridge?.quality.focusInspection ?? null;

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
    qualityConstraint: qualitySignal
      ? `${qualitySignal.code} remains ${qualitySignal.status} with ${qualitySignal.openFindings} open findings and ${qualitySignal.releaseReadiness}% release readiness.`
      : "No quality-release constraint is currently attached to the active equipment lane."
  };
}

export default function EquipmentPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<EquipmentOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<EquipmentBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
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
  });

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

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
      fetchQualityOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, movements, quality]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Equipment overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedMachineId((current) => current ?? result.focusMachine?.id ?? result.machines[0]?.id ?? null);
        setBridgeContext(movements && quality ? { movements, quality } : null);
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

  const selectedMachine = useMemo(
    () => overview?.machines.find((item) => item.id === selectedMachineId) ?? overview?.focusMachine ?? null,
    [overview, selectedMachineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.machineId === selectedMachine?.id) ?? [],
    [overview, selectedMachine]
  );

  const affectedFronts = useMemo(() => {
    if (!overview) {
      return 0;
    }

    return new Set(
      overview.machines
        .filter((item) => item.status !== "available" || item.health !== "healthy")
        .map((item) => `${item.projectName}::${item.frontName}`)
    ).size;
  }, [overview]);

  const equipmentStory = useMemo(() => {
    return buildEquipmentStory(selectedMachine, bridgeContext);
  }, [bridgeContext, selectedMachine]);

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
    if (!selectedMachine || !session.accessToken) {
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
    if (!overview || !session.accessToken) {
      return;
    }

    const machineName = createForm.machineName.trim();
    const machineType = createForm.machineType.trim();
    const projectName = createForm.projectName.trim();
    const frontName = createForm.frontName.trim();
    const nextAction = createForm.nextAction.trim();

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
        availabilityPercent: Number(createForm.availabilityPercent),
        utilizationPercent: Number(createForm.utilizationPercent),
        hourMeter: Number(createForm.hourMeter),
        nextMaintenanceHours: Number(createForm.nextMaintenanceHours),
        maintenanceBacklog: Number(createForm.maintenanceBacklog),
        openFailures: Number(createForm.openFailures),
        criticalOpenFailures: Number(createForm.criticalOpenFailures),
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
      machineName: "",
      machineType: createForm.machineType,
      projectName,
      frontName,
      status: "available",
      health: "healthy",
      availabilityPercent: "92",
      utilizationPercent: "68",
      hourMeter: "0",
      nextMaintenanceHours: "80",
      maintenanceBacklog: "0",
      openFailures: "0",
      criticalOpenFailures: "0",
      nextAction: ""
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
                value={overview.summary.trackedMachines.toLocaleString()}
                footnote="Equipment units currently controlled in the active tenant."
              />
              <KpiCard
                label="Available"
                value={String(overview.summary.availableMachines)}
                footnote="Machines ready for dispatch without open blocking conditions."
              />
              <KpiCard
                label="Overdue maintenance"
                value={String(overview.summary.overdueMaintenance)}
                footnote="Units that still cannot clear maintenance exposure."
              />
              <KpiCard
                label="Critical failures"
                value={String(overview.summary.criticalOpenFailures)}
                footnote="Open critical breakdown signals across the active fleet."
              />
              <KpiCard
                label="Affected fronts"
                value={String(affectedFronts)}
                footnote="Active fronts currently exposed to equipment downtime, maintenance or degraded health."
              />
            </section>

            <section className="grid cols3">
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
              <Card title="Quality constraint" description="Release and corrective-work signal around the selected machine.">
                <p className="sectionText">
                  {equipmentStory?.qualityConstraint ?? "Choose an asset to inspect quality constraints."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Fleet posture" description="Availability, maintenance and utilization by machine.">
                <FilterBar summary={`${overview.machines.length} machines in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "equipment ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.machines}
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
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedMachine.updatedAt).toLocaleString()}</div>
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

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateMachine()}>
                    {isCreating ? "Saving..." : "Add machine"}
                  </button>
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
