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
import type { DailyLogEntryContract, DailyLogOverviewContract } from "@/lib/contracts";
import { createDailyLogEntry, fetchDailyLogOverview, fetchEquipmentOverview, updateDailyLogEntry } from "@/lib/platform-api";

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

function weatherLabel(weather: DailyLogEntryContract["weather"]) {
  switch (weather) {
    case "clear":
      return "Clear";
    case "windy":
      return "Windy";
    case "rain":
      return "Rain";
    default:
      return "Storm";
  }
}

function actionOptions(entry: DailyLogEntryContract) {
  switch (entry.status) {
    case "draft":
      return [
        {
          label: "Submit log",
          status: "submitted" as const,
          nextAction: "Submit the field log with the current workforce and evidence package."
        },
        {
          label: "Flag issue",
          status: "flagged" as const,
          nextAction: "Raise the blocker and keep this field log under daily operating attention."
        }
      ];
    case "submitted":
      return [
        {
          label: "Approve log",
          status: "approved" as const,
          nextAction: "Approve the field log and release the next execution step to the crew."
        },
        {
          label: "Flag issue",
          status: "flagged" as const,
          nextAction: "Hold this log and escalate the blocker or evidence gap before approval."
        }
      ];
    case "flagged":
      return [
        {
          label: "Return to draft",
          status: "draft" as const,
          nextAction: "Rework the field log package and complete the missing capture before resubmission."
        },
        {
          label: "Resubmit log",
          status: "submitted" as const,
          nextAction: "Resubmit the corrected log for review after containing the field issue."
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

function createDailyLogExample() {
  return {
    projectName: "Torre Demo",
    frontName: "Frente Cimentacion",
    supervisor: "Luis Operaciones",
    logDate: new Date().toISOString().slice(0, 10),
    shift: "morning" as DailyLogEntryContract["shift"],
    weather: "clear" as DailyLogEntryContract["weather"],
    status: "draft" as DailyLogEntryContract["status"],
    progressPercent: "42",
    workforceCount: "24",
    incidentsCount: "0",
    blockersCount: "1",
    evidenceCount: "6",
    concretePourM3: "18",
    projectStatus: "at_risk" as DailyLogEntryContract["projectStatus"],
    qualityOpenFindings: "2",
    qualityReleaseReadiness: "84",
    subcontractHealth: "watch" as DailyLogEntryContract["subcontractHealth"],
    pendingDestajo: "0",
    nextAction: "Cerrar evidencia del frente y liberar acero antes del siguiente vaciado."
  };
}

function createDailyLogPreset(
  preset: "concrete_pour" | "quality_hold" | "equipment_delay"
): ReturnType<typeof createDailyLogExample> {
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

type DailyLogEquipmentBridge = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
} | null;

function buildDailyLogEquipmentStory(entry: DailyLogEntryContract | null, bridge: DailyLogEquipmentBridge) {
  if (!entry) {
    return null;
  }

  const linkedMachines =
    bridge?.equipment.machines.filter((item) => item.projectName === entry.projectName && item.frontName === entry.frontName) ?? [];
  const constrainedMachines = linkedMachines.filter((item) => item.status !== "available" || item.health !== "healthy");

  return {
    equipmentSupport:
      linkedMachines.length > 0
        ? `${linkedMachines.length} tracked machines support this front, with ${constrainedMachines.length} already degraded.`
        : "No tracked machine is currently mapped to this front.",
    executionConstraint:
      constrainedMachines.length > 0
        ? `${constrainedMachines[0]?.machineName ?? "A constrained asset"} is affecting the shift under ${constrainedMachines[0]?.status ?? "constraint"} posture.`
        : "Equipment is not the primary execution constraint on this daily log.",
    nextEquipmentMove:
      constrainedMachines.length > 0
        ? constrainedMachines[0]?.nextAction ?? "Recover equipment continuity before the next field cutoff."
        : "No immediate equipment move is currently dominating this front."
  };
}

function buildDailyLogWorkflow(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return "Use daily log as the formal handoff between what happened in field and what supervision will act on next.";
  }

  if (entry.status === "flagged") {
    return "A flagged log should jump immediately into field, equipment or quality remediation before the next shift starts.";
  }

  if (entry.status === "submitted") {
    return "A submitted log should either clear evidence and blockers for approval, or be rerouted back into field follow-up.";
  }

  return "An approved or draft log should keep production continuity, evidence discipline and next-shift planning aligned.";
}

function buildApprovalReadiness(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return {
      tone: "info" as const,
      label: "Select a log",
      description: "Choose a daily log to inspect whether it is actually ready for review or escalation."
    };
  }

  if (entry.blockersCount > 0) {
    return {
      tone: "danger" as const,
      label: "Blocked for approval",
      description: `${entry.blockersCount} blockers remain open, so supervision should route this back into field or operations before approval.`
    };
  }

  if (entry.evidenceCount < 4 || entry.qualityOpenFindings > 2) {
    return {
      tone: "warning" as const,
      label: "Needs more support",
      description: "Evidence volume or quality findings are still weak for a clean release of the next shift."
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for review",
    description: "The log already has the minimum operating posture to move through supervision without obvious gaps."
  };
}

function buildEscalationDestination(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return {
      label: "No active destination",
      description: "Select a daily log to identify the next operating module.",
      href: "/daily-log"
    };
  }

  if (entry.blockersCount > 0) {
    return {
      label: "Escalate in field",
      description: "Front execution still has blockers, so the crew-level follow-up should happen in field.",
      href: "/field"
    };
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return {
      label: "Route to quality",
      description: "Release posture is being constrained by findings or missing readiness evidence.",
      href: "/quality"
    };
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return {
      label: "Coordinate in operations",
      description: "Commercial or subcontract continuity needs cross-domain attention before the next shift.",
      href: "/operations"
    };
  }

  return {
    label: "Check equipment",
    description: "If the front is not blocked by quality or field, confirm asset continuity for the next move.",
    href: "/equipment"
  };
}

function buildDownstreamReadiness(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return {
      tone: "info" as const,
      label: "No log selected",
      summary: "Choose a daily log to verify whether the shift story is really ready for downstream execution.",
      checks: ["Select an active daily log from the board."]
    };
  }

  const checks: string[] = [];

  if (entry.blockersCount > 0) {
    checks.push(`${entry.blockersCount} blocker(s) still keep the front from normal continuation.`);
  }

  if (entry.evidenceCount < 4) {
    checks.push(`Evidence is only ${entry.evidenceCount}, below the minimum operating support.`);
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    checks.push(`Quality posture is still weak at ${entry.qualityReleaseReadiness}% readiness with ${entry.qualityOpenFindings} open finding(s).`);
  }

  if (!entry.nextAction?.trim() || entry.nextAction.trim().length < 12) {
    checks.push("Next action is still too vague for the next team or shift.");
  }

  if (checks.length > 0) {
    return {
      tone: entry.blockersCount > 0 ? "danger" as const : "warning" as const,
      label: entry.blockersCount > 0 ? "Hold before downstream" : "Needs tighter handoff",
      summary:
        entry.blockersCount > 0
          ? "The shift still carries blockers that should be contained before normal continuation."
          : "The shift can continue, but the handoff still needs more evidence or clarity.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for downstream",
    summary: "The log already has enough operating context for the next team to continue without reconstructing the shift story.",
    checks: ["Open the destination module and execute the stated next action in the same operating cycle."]
  };
}

function buildDailyLogWhyNow(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return "Select a daily log to understand why this shift needs attention right now.";
  }

  if (entry.status === "flagged" || entry.blockersCount > 0) {
    return `${entry.frontName} already carries ${entry.blockersCount} blocker(s) under ${entry.status} posture, so the next shift can degrade immediately if supervision waits.`;
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return `${entry.frontName} still has weak release posture, so approving or ignoring this log now would pass quality debt into the next operating cycle.`;
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return `${entry.frontName} is still commercially exposed through subcontract or destajo pressure, so this log matters beyond simple shift reporting.`;
  }

  return `${entry.frontName} is close to normal continuity, so the useful decision now is whether supervision can release the next move without rebuilding the shift story later.`;
}

function buildDailyLogDownstreamEffect(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return "Select a daily log to inspect which downstream lane will absorb the impact.";
  }

  if (entry.blockersCount > 0) {
    return "If blockers stay open, field replanning and operations follow-up will inherit the disruption before the next shift starts.";
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return "If release posture stays weak, quality and close-control will inherit incomplete evidence and avoidable rework.";
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return "If subcontract pressure is not contained, operations and commercial coordination will inherit the instability next.";
  }

  return "If this log is handled cleanly, field, equipment and operations can continue without reconstructing the same shift context.";
}

function buildDailyLogHumanStep(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return "Select a daily log to identify the next human handoff.";
  }

  if (entry.blockersCount > 0) {
    return "Tell the field owner exactly which blocker is being contained, who owns it and whether the next shift starts or waits.";
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return "Tell quality and field who owns the corrective action and when the reinspection decision returns to supervision.";
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return "Tell operations who must stabilize the subcontract lane before the next shift commits more production.";
  }

  return "Tell the next supervisor or resident engineer exactly what was released and what must be checked at the next shift handoff.";
}

function buildDailyLogReportBack(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return "Select a daily log to define when the responsible owner should report back.";
  }

  if (entry.status === "flagged" || entry.blockersCount > 0) {
    return "Report back in the same operating cycle with blocker owner, containment result and go/no-go for the next shift.";
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return "Report back once quality evidence and release posture are explicit enough to survive approval without hidden debt.";
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return "Report back when subcontract or destajo pressure is already assigned and operations owns the next recovery move.";
  }

  return "Report back at the next supervision checkpoint confirming the shift handoff stayed coherent and executable.";
}

function buildDailyLogRouteSummary(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return "Use daily log as the formal route between field capture, supervision review and the next module that owns execution continuity.";
  }

  if (entry.blockersCount > 0 || entry.status === "flagged") {
    return "This log should route first through field containment and front recovery before supervision treats the shift as released.";
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return "This log should route through quality closure before the next shift inherits a weak release posture.";
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return "This log should route through operations coordination before the next shift commits more production on unstable subcontract footing.";
  }

  return "This log can continue through equipment or normal field follow-through with the current shift story intact.";
}

function buildDailyLogOperationalLinks(entry: DailyLogEntryContract | null) {
  if (!entry) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open operations", href: "/operations" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  if (entry.blockersCount > 0 || entry.status === "flagged") {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open operations", href: "/operations" },
      { label: "Open quality", href: "/quality" }
    ];
  }

  if (entry.qualityOpenFindings > 2 || entry.qualityReleaseReadiness < 75) {
    return [
      { label: "Open quality", href: "/quality" },
      { label: "Open field", href: "/field" },
      { label: "Open operations", href: "/operations" }
    ];
  }

  if (entry.subcontractHealth === "critical" || entry.pendingDestajo > 0) {
    return [
      { label: "Open operations", href: "/operations" },
      { label: "Open field", href: "/field" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  return [
    { label: "Open equipment", href: "/equipment" },
    { label: "Open field", href: "/field" },
    { label: "Open operations", href: "/operations" }
  ];
}

function buildCreateDailyLogGate(input: {
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
  subcontractHealth: DailyLogEntryContract["subcontractHealth"];
  pendingDestajo: number;
  nextAction: string;
}) {
  const checks: string[] = [];

  if ([input.projectName, input.frontName, input.supervisor].some((value) => value.trim().length < 3)) {
    checks.push("Project, front and supervisor still need specific capture.");
  }

  if (!input.logDate) {
    checks.push("Log date is still missing.");
  }

  if (!Number.isFinite(input.progressPercent) || input.progressPercent < 0 || input.progressPercent > 100) {
    checks.push("Progress must stay between 0 and 100.");
  }

  if (![input.workforceCount, input.blockersCount, input.incidentsCount, input.evidenceCount].every((value) => Number.isFinite(value) && value >= 0)) {
    checks.push("Crew, blockers, incidents and evidence must be valid non-negative numbers.");
  }

  if (!Number.isFinite(input.concretePourM3) || input.concretePourM3 < 0) {
    checks.push("Concrete volume must be a valid non-negative number.");
  }

  if (!Number.isFinite(input.qualityOpenFindings) || input.qualityOpenFindings < 0) {
    checks.push("Quality findings must be a valid non-negative number.");
  }

  if (!Number.isFinite(input.qualityReleaseReadiness) || input.qualityReleaseReadiness < 0 || input.qualityReleaseReadiness > 100) {
    checks.push("Release readiness must stay between 0 and 100.");
  }

  if (!Number.isFinite(input.pendingDestajo) || input.pendingDestajo < 0) {
    checks.push("Pending destajo must be a valid non-negative number.");
  }

  if (input.status === "approved" && input.blockersCount > 0) {
    checks.push("Approved status is blocked while blockers remain open.");
  }

  if (input.status === "approved" && input.evidenceCount < 4) {
    checks.push("Approved status requires at least 4 evidence items.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for the next shift or module.");
  }

  if (checks.length > 0) {
    const hardBlock =
      (input.status === "approved" && input.blockersCount > 0) ||
      (input.status === "approved" && input.evidenceCount < 4);

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This daily log would open with a hard supervision blocker."
        : "The log can be created, but the shift handoff still needs tightening.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The log has enough structure to enter daily supervision cleanly.",
    checks: [
      "The created log will become the current focus entry immediately.",
      "Keep blockers, evidence and next action explicit from the first capture."
    ]
  };
}

function buildCreateDailyLogHumanStep(input: {
  blockersCount: number;
  qualityOpenFindings: number;
  qualityReleaseReadiness: number;
  evidenceCount: number;
  pendingDestajo: number;
  nextAction: string;
}) {
  if (input.blockersCount > 0) {
    return "Clarify who owns the blocker and whether the next shift is protected before saving this log.";
  }

  if (input.qualityOpenFindings > 2 || input.qualityReleaseReadiness < 75) {
    return "Clarify who owns corrective quality work before this shift is treated as ready for clean continuation.";
  }

  if (input.evidenceCount < 4) {
    return "Complete the minimum evidence package before expecting a clean supervision handoff.";
  }

  if (input.pendingDestajo > 0) {
    return "Tell operations how the subcontract or destajo pressure will be contained before the next shift.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Rewrite the next action so the next supervisor can continue without asking for more context.";
  }

  return "Create the log and continue directly into review, field follow-up or operations with a clean shift story.";
}

export default function DailyLogPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
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
  const [createForm, setCreateForm] = useState({
    projectName: "Nuevo proyecto",
    frontName: "Frente 1",
    supervisor: "Resident engineer",
    logDate: new Date().toISOString().slice(0, 10),
    shift: "morning" as DailyLogEntryContract["shift"],
    weather: "clear" as DailyLogEntryContract["weather"],
    status: "draft" as DailyLogEntryContract["status"],
    progressPercent: "0",
    workforceCount: "18",
    incidentsCount: "0",
    blockersCount: "0",
    evidenceCount: "4",
    concretePourM3: "0",
    projectStatus: "active" as DailyLogEntryContract["projectStatus"],
    qualityOpenFindings: "0",
    qualityReleaseReadiness: "92",
    subcontractHealth: "controlled" as DailyLogEntryContract["subcontractHealth"],
    pendingDestajo: "0",
    nextAction: ""
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
          setError("Daily log overview is unavailable right now.");
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

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

  const selectedStory = useMemo(
    () => buildDailyLogEquipmentStory(selectedEntry, bridgeContext),
    [bridgeContext, selectedEntry]
  );

  const entryActions = useMemo(() => (selectedEntry ? actionOptions(selectedEntry) : []), [selectedEntry]);
  const approvalReadiness = useMemo(() => buildApprovalReadiness(selectedEntry), [selectedEntry]);
  const escalationDestination = useMemo(() => buildEscalationDestination(selectedEntry), [selectedEntry]);
  const downstreamReadiness = useMemo(() => buildDownstreamReadiness(selectedEntry), [selectedEntry]);
  const selectedWhyNow = useMemo(() => buildDailyLogWhyNow(selectedEntry), [selectedEntry]);
  const selectedDownstreamEffect = useMemo(() => buildDailyLogDownstreamEffect(selectedEntry), [selectedEntry]);
  const selectedHumanStep = useMemo(() => buildDailyLogHumanStep(selectedEntry), [selectedEntry]);
  const selectedReportBack = useMemo(() => buildDailyLogReportBack(selectedEntry), [selectedEntry]);
  const selectedRouteSummary = useMemo(() => buildDailyLogRouteSummary(selectedEntry), [selectedEntry]);
  const selectedOperationalLinks = useMemo(() => buildDailyLogOperationalLinks(selectedEntry), [selectedEntry]);
  const createGate = useMemo(
    () =>
      buildCreateDailyLogGate({
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
        subcontractHealth: createForm.subcontractHealth,
        pendingDestajo: createFormNumbers.pendingDestajo,
        nextAction: createForm.nextAction
      }),
    [createForm, createFormNumbers]
  );
  const createHumanStep = useMemo(
    () =>
      buildCreateDailyLogHumanStep({
        blockersCount: createFormNumbers.blockersCount,
        qualityOpenFindings: createFormNumbers.qualityOpenFindings,
        qualityReleaseReadiness: createFormNumbers.qualityReleaseReadiness,
        evidenceCount: createFormNumbers.evidenceCount,
        pendingDestajo: createFormNumbers.pendingDestajo,
        nextAction: createForm.nextAction
      }),
    [createForm.nextAction, createFormNumbers]
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
    setNextActionDraft(selectedEntry?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedEntryId, selectedEntry?.id, selectedEntry?.nextAction]);

  async function handleAction(status: DailyLogEntryContract["status"], suggestedNextAction: string) {
    if (!selectedEntry) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the daily log.");
      return;
    }

    if (status === "approved" && selectedEntry.evidenceCount < 4) {
      setActionError("Daily log needs at least 4 evidence items before approval.");
      return;
    }

    if (status === "approved" && selectedEntry.blockersCount > 0) {
      setActionError("Daily log cannot be approved while blockers remain open.");
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
      setActionError(response.error?.message ?? "Daily log update failed.");
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
    setActionMessage(`Daily log moved to ${updatedEntry.status}.`);
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
      setActionError("Project, front and supervisor must be specific before creating the daily log.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before creating the daily log.");
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
      setActionError("Log date is required before creating the daily log.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
      setActionError("Progress percent must be between 0 and 100.");
      setCreateMessage(null);
      return;
    }

    if (![workforceCount, blockersCount, incidentsCount, evidenceCount].every((value) => Number.isFinite(value) && value >= 0)) {
      setActionError("Crew, blockers, incidents and evidence must be valid non-negative numbers.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(concretePourM3) || concretePourM3 < 0) {
      setActionError("Concrete volume must be a valid non-negative number.");
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
      setActionError(response.error?.message ?? "Daily log creation failed.");
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
    setCreateMessage(`${frontName} daily log added to the workbench.`);
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
      title="Daily log"
      eyebrow="Field execution"
      description="Daily site diary for crews, evidence, blockers and shift-by-shift operating discipline."
    >
      <ModuleGate moduleKeys={["projects.daily-log"]} requiredPermissions={["projects:*"]} title="Daily log">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Submitted today"
                value={String(filteredSummary.submittedToday)}
                footnote="Visible logs already out of draft and visible to supervision today."
              />
              <KpiCard
                label="Approved logs"
                value={String(filteredSummary.approvedLogs)}
                footnote="Visible field logs that already cleared review with evidence discipline."
              />
              <KpiCard
                label="Flagged logs"
                value={String(filteredSummary.flaggedLogs)}
                footnote="Visible logs still blocked by issues, evidence gaps or field exceptions."
              />
              <KpiCard
                label="Pending evidence"
                value={String(filteredSummary.pendingEvidence)}
                footnote="Directional evidence debt still pending before clean field closure."
              />
              <KpiCard
                label="Execution risk"
                value={String(filteredSummary.executionRiskLogs)}
                footnote="Visible logs already carrying field, quality or subcontract execution risk."
              />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Daily logs can be created and moved across statuses locally in this browser."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Create bitacoras, submit or flag them, and test evidence or blocker rules before production auth is wired.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Create a new log for an active front, then submit it and verify how it appears in Operations.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols1">
              <Card
                title="Daily supervision workflow"
                description="This route should already let a supervisor capture, review and push the next operational move without leaving the workbench."
              >
                <p className="sectionText">
                  Create or update the daily log, move it across `draft`, `submitted`, `approved` or `flagged`, then continue into
                  `field`, `operations` or `equipment` depending on whether the issue is execution, coordination or asset continuity.
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Daily log continuity"
                description="Daily log should be the formal checkpoint between front execution, field capture and quality follow-through."
                aside={<Badge tone={filteredSummary.flaggedLogs > 0 ? "danger" : filteredSummary.executionRiskLogs > 0 ? "warning" : "success"}>{filteredSummary.flaggedLogs > 0 ? "flagged lane" : filteredSummary.executionRiskLogs > 0 ? "risk lane" : "stable lane"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Current route</div><div>{buildDailyLogWorkflow(selectedEntry)}</div></div>
                  <div className="detailRow"><div className="detailLabel">Supervisor use</div><div>Approve only when the field story, evidence and blockers are coherent enough for the next shift.</div></div>
                  <div className="detailRow"><div className="detailLabel">Downstream jump</div><div>Move into `field`, `quality`, `operations` or `equipment` depending on what is actually blocking execution.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/field">Open field</Link>
                  <Link className="buttonGhost" href="/quality">Open quality</Link>
                  <Link className="buttonGhost" href="/operations">Open operations</Link>
                  <Link className="buttonGhost" href="/equipment">Open equipment</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Equipment support" description="How much asset support is currently mapped to this field front.">
                <p className="sectionText">
                  {selectedStory?.equipmentSupport ?? "Choose a daily log to inspect equipment support."}
                </p>
              </Card>
              <Card title="Execution constraint" description="Whether asset posture is already limiting this shift.">
                <p className="sectionText">
                  {selectedStory?.executionConstraint ?? "Choose a daily log to inspect equipment constraint."}
                </p>
              </Card>
              <Card title="Next equipment move" description="Immediate asset action required for the selected front.">
                <p className="sectionText">
                  {selectedStory?.nextEquipmentMove ?? "Choose a daily log to inspect the next equipment move."}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card
                title="Approval readiness"
                description="Whether the selected log can actually clear supervision right now."
                aside={<Badge tone={approvalReadiness.tone}>{approvalReadiness.label}</Badge>}
              >
                <p className="sectionText">{approvalReadiness.description}</p>
              </Card>
              <Card title="Escalation destination" description="Best next module based on the selected operating constraint.">
                <p className="sectionText">{escalationDestination.description}</p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href={escalationDestination.href}>
                    {escalationDestination.label}
                  </Link>
                </div>
              </Card>
              <Card title="Supervisor checklist" description="Minimum discipline before closing the shift story.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Evidence</div><div>At least 4 usable evidence items for review.</div></div>
                  <div className="detailRow"><div className="detailLabel">Blockers</div><div>No open blockers if the log is going to approved status.</div></div>
                  <div className="detailRow"><div className="detailLabel">Next move</div><div>The next action must clearly say who acts next and where the follow-up continues.</div></div>
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Daily log board" description="Shift capture, productivity and blocker posture across the active fronts.">
                <FilterBar summary={`${filteredEntries.length} logs match the current operating filters`}>
                  <label className="fieldLabel">
                    Status
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">All</option>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="approved">Approved</option>
                      <option value="flagged">Flagged</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Shift
                    <select className="field" value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value as typeof shiftFilter)}>
                      <option value="all">All</option>
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="night">Night</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Weather
                    <select className="field" value={weatherFilter} onChange={(event) => setWeatherFilter(event.target.value as typeof weatherFilter)}>
                      <option value="all">All</option>
                      <option value="clear">Clear</option>
                      <option value="windy">Windy</option>
                      <option value="rain">Rain</option>
                      <option value="storm">Storm</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 200 }}>
                    Project
                    <input
                      className="field"
                      type="search"
                      value={projectFilter}
                      onChange={(event) => setProjectFilter(event.target.value)}
                      placeholder="Project or front"
                    />
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Supervisor or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "field diary ready"}</Badge>
                  <Badge tone={filteredSummary.flaggedLogs > 0 ? "danger" : filteredSummary.executionRiskLogs > 0 ? "warning" : "success"}>
                    {filteredSummary.flaggedLogs > 0
                      ? `${filteredSummary.flaggedLogs} flagged`
                      : filteredSummary.executionRiskLogs > 0
                        ? `${filteredSummary.executionRiskLogs} at risk`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredEntries}
                  columns={[
                    {
                      key: "frontName",
                      label: "Front",
                      render: (entry) => (
                        <button type="button" className="button ghost" onClick={() => setSelectedEntryId(entry.id)}>
                          {entry.frontName}
                        </button>
                      )
                    },
                    {
                      key: "projectName",
                      label: "Project",
                      render: (entry) => entry.projectName
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (entry) => <Badge tone={statusTone(entry.status)}>{entry.status}</Badge>
                    },
                    {
                      key: "workforceCount",
                      label: "Crew",
                      render: (entry) => String(entry.workforceCount)
                    },
                    {
                      key: "progressPercent",
                      label: "Progress",
                      render: (entry) => `${entry.progressPercent}%`
                    }
                  ]}
                />
              </Card>

              <Card
                title={selectedEntry ? selectedEntry.frontName : "Select a daily log"}
                description={
                  selectedEntry
                    ? `${selectedEntry.projectName} · ${selectedEntry.logDate} · ${selectedEntry.supervisor}`
                    : "Review the selected field log, blockers and evidence posture."
                }
              >
                {selectedEntry ? (
                  <div className="stack">
                    <div className="grid cols2">
                      <KpiCard label="Crew" value={String(selectedEntry.workforceCount)} footnote={`Shift: ${selectedEntry.shift}`} />
                      <KpiCard
                        label="Progress"
                        value={`${selectedEntry.progressPercent}%`}
                        footnote={`${selectedEntry.concretePourM3} m3 concrete captured`}
                      />
                    </div>

                    <div className="row gap wrap">
                      <Badge tone={statusTone(selectedEntry.status)}>{selectedEntry.status}</Badge>
                      <Badge tone="info">{weatherLabel(selectedEntry.weather)}</Badge>
                      <Badge tone={selectedEntry.projectStatus === "blocked" ? "danger" : selectedEntry.projectStatus === "at_risk" ? "warning" : "success"}>
                        {selectedEntry.projectStatus}
                      </Badge>
                      <Badge tone={selectedEntry.subcontractHealth === "critical" ? "danger" : selectedEntry.subcontractHealth === "watch" ? "warning" : "success"}>
                        {selectedEntry.subcontractHealth}
                      </Badge>
                      <Badge tone={selectedEntry.blockersCount > 0 ? "danger" : "success"}>
                        {selectedEntry.blockersCount} blockers
                      </Badge>
                      <Badge tone={selectedEntry.incidentsCount > 0 ? "warning" : "success"}>
                        {selectedEntry.incidentsCount} incidents
                      </Badge>
                    </div>

                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">Quality posture</div>
                        <div>
                          {selectedEntry.qualityOpenFindings} open findings
                          <div className="tableCellMuted">{selectedEntry.qualityReleaseReadiness}% release readiness</div>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Pending destajo</div>
                        <div>MXN {selectedEntry.pendingDestajo.toLocaleString()}</div>
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
                        <div className="detailLabel">Next human step</div>
                        <div>{selectedHumanStep}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Report back</div>
                        <div>{selectedReportBack}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Downstream readiness</div>
                        <div className="tableCellStack">
                          <Badge tone={downstreamReadiness.tone}>{downstreamReadiness.label}</Badge>
                          <span className="tableCellMuted">{downstreamReadiness.summary}</span>
                          {downstreamReadiness.checks.map((check) => (
                            <span key={check} className="tableCellMuted">{check}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="daily-log-next-action">
                        Next action
                      </label>
                      <textarea
                        id="daily-log-next-action"
                        className="textarea"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                      />
                    </div>

                    <div className="row gap wrap">
                      {entryActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button secondary"
                          onClick={() => void handleAction(action.status, action.nextAction)}
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                      {selectedOperationalLinks.map((link) => (
                        <Link key={link.href + link.label} className="buttonGhost" href={link.href}>
                          {link.label}
                        </Link>
                      ))}
                    </div>

                    {actionError ? <p className="text-danger">{actionError}</p> : null}
                    {actionMessage ? <p className="text-success">{actionMessage}</p> : null}

                    <Card title="Field risks" description="Current blockers or evidence issues tied to this daily log.">
                      {selectedRisks.length > 0 ? (
                        <div className="stack">
                          {selectedRisks.map((risk) => (
                            <div key={risk.id} className="row space-between card-section">
                              <div>
                                <strong>{risk.title}</strong>
                                <p>
                                  {risk.category} · {risk.owner}
                                </p>
                              </div>
                              <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                                {risk.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="No active risks" description="This log is not carrying explicit field blockers right now." />
                      )}
                    </Card>
                  </div>
                ) : (
                  <EmptyState title="No log selected" description="Choose a daily log from the board to review field detail." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Capture daily log"
                description="Create a new field diary entry in the tenant workbench before wiring live POST endpoints."
              >
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() => setCreateForm(createDailyLogExample())}
                  >
                    Load demo example
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        projectName: "Nuevo proyecto",
                        frontName: "Frente 1",
                        supervisor: "Resident engineer",
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
                      })
                    }
                  >
                    Reset form
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDailyLogPreset("concrete_pour"))}>
                    Concrete pour preset
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDailyLogPreset("quality_hold"))}>
                    Quality hold preset
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDailyLogPreset("equipment_delay"))}>
                    Equipment delay preset
                  </button>
                  <Link className="buttonGhost" href="/field">Open field</Link>
                  <Link className="buttonGhost" href="/operations">Open operations</Link>
                </div>
                <div className="detailGrid">
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
                    <div className="detailLabel">Supervisor</div>
                    <input
                      className="field"
                      value={createForm.supervisor}
                      onChange={(event) => setCreateForm((current) => ({ ...current, supervisor: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Date</div>
                    <input
                      className="field"
                      type="date"
                      value={createForm.logDate}
                      onChange={(event) => setCreateForm((current) => ({ ...current, logDate: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Shift</div>
                    <select
                      className="selectField"
                      value={createForm.shift}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, shift: event.target.value as DailyLogEntryContract["shift"] }))
                      }
                    >
                      <option value="morning">morning</option>
                      <option value="mixed">mixed</option>
                      <option value="night">night</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Weather</div>
                    <select
                      className="selectField"
                      value={createForm.weather}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          weather: event.target.value as DailyLogEntryContract["weather"]
                        }))
                      }
                    >
                      <option value="clear">clear</option>
                      <option value="windy">windy</option>
                      <option value="rain">rain</option>
                      <option value="storm">storm</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Status</div>
                    <select
                      className="selectField"
                      value={createForm.status}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          status: event.target.value as DailyLogEntryContract["status"]
                        }))
                      }
                    >
                      <option value="draft">draft</option>
                      <option value="submitted">submitted</option>
                      <option value="approved">approved</option>
                      <option value="flagged">flagged</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Progress %</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.progressPercent}
                      onChange={(event) => setCreateForm((current) => ({ ...current, progressPercent: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Crew</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.workforceCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, workforceCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Blockers</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.blockersCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, blockersCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Incidents</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.incidentsCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, incidentsCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Evidence</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.evidenceCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, evidenceCount: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Concrete m3</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.concretePourM3}
                      onChange={(event) => setCreateForm((current) => ({ ...current, concretePourM3: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Project status</div>
                    <select
                      className="selectField"
                      value={createForm.projectStatus}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          projectStatus: event.target.value as DailyLogEntryContract["projectStatus"]
                        }))
                      }
                    >
                      <option value="on_track">on_track</option>
                      <option value="at_risk">at_risk</option>
                      <option value="blocked">blocked</option>
                      <option value="completed">completed</option>
                      <option value="unknown">unknown</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Quality findings</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.qualityOpenFindings}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, qualityOpenFindings: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Release readiness %</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.qualityReleaseReadiness}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, qualityReleaseReadiness: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Subcontract health</div>
                    <select
                      className="selectField"
                      value={createForm.subcontractHealth}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          subcontractHealth: event.target.value as DailyLogEntryContract["subcontractHealth"]
                        }))
                      }
                    >
                      <option value="controlled">controlled</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                      <option value="unknown">unknown</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Pending destajo</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.pendingDestajo}
                      onChange={(event) => setCreateForm((current) => ({ ...current, pendingDestajo: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder="Cerrar evidencia, alinear cuadrilla y liberar revisión del residente"
                    />
                  </label>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <div className="detailGrid" style={{ width: "100%" }}>
                    <div className="detailRow">
                      <div className="detailLabel">Creation gate</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={createGate.tone}>{createGate.label}</Badge>
                          <span>{createGate.summary}</span>
                        </div>
                        {createGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">
                            {check}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{createHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Immediate downstream</div>
                      <div>
                        {Number(createForm.blockersCount) > 0
                          ? "Do not treat this shift as clean continuity yet; it should go back into field or operations first."
                          : Number(createForm.qualityOpenFindings) > 2 || Number(createForm.qualityReleaseReadiness) < 75
                            ? "This log should continue into quality review before the shift is treated as safely releasable."
                            : createForm.subcontractHealth === "critical" || Number(createForm.pendingDestajo) > 0
                              ? "This log should continue into operations because subcontract or destajo pressure still shapes the next shift."
                              : "The log can continue into supervision review with a clean enough shift story."}
                      </div>
                    </div>
                  </div>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateEntry()}>
                    {isCreating ? "Saving..." : "Add daily log"}
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card
                title="Capture rules"
                description="This keeps the daily-log workflow useful before backend creation endpoints are implemented."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Scope</div>
                    <div>New entries stay inside the active tenant session and immediately affect the field diary board.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Focus</div>
                    <div>The new daily log becomes the active selected record so the supervisor can continue working on it.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Backend path</div>
                    <div>This form already persists through `POST /daily-log/entries`, so field supervision is no longer browser-only.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next destinations</div>
                    <div>Use `Field` for frontline capture, `Operations` for cross-domain follow-up and `Equipment` when asset continuity becomes the blocker.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Starter presets</div>
                    <div>Use the preset buttons to simulate common scenarios like concrete pours, quality holds or equipment delays without retyping the full capture.</div>
                  </div>
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Daily log unavailable"
            description={error ?? "The field diary could not be loaded from the current source."}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
