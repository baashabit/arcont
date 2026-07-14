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
import type { ProjectPortfolioItemContract, ProjectPortfolioOverviewContract } from "@/lib/contracts";
import { createProjectPortfolioItem, fetchEquipmentOverview, fetchProjectsOverview, updateProjectPortfolioItem } from "@/lib/platform-api";

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

function budgetTone(budgetHealth: ProjectPortfolioItemContract["budgetHealth"]) {
  switch (budgetHealth) {
    case "on_track":
      return "success";
    case "warning":
      return "warning";
    default:
      return "danger";
  }
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

function buildProjectWorkflow(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return "Use projects as the operating anchor that routes PMO, site control and executive follow-up into the right module.";
  }

  if (project.status === "blocked") {
    return "A blocked project should jump immediately into field, document control, quality or cost follow-up before PMO treats it as recoverable.";
  }

  if (project.status === "at_risk") {
    return "An at-risk project should coordinate recovery across field, quality, equipment and cost before the next milestone slips again.";
  }

  return "An active or planning project should keep milestone, site continuity and technical-release lanes aligned from one control point.";
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

function buildProjectHumanStep(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return "Select a project to identify the next human move.";
  }

  if (project.status === "blocked") {
    return `Open the blocking domain now and keep ${project.client} informed before the next milestone review.`;
  }

  if (project.latestDailyLogStatus === "flagged" || project.qualityHolds > 0 || project.permitBlockers > 0) {
    return `Coordinate PMO, site supervision and the blocking domain before committing the next milestone.`;
  }

  return `Confirm the next milestone owner and keep field, quality and equipment aligned through the next operating cutoff.`;
}

function buildProjectWhyNow(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return "Select a project to understand why it deserves attention right now.";
  }

  if (project.status === "blocked") {
    return "The project is already blocked, so leaving it at portfolio level only delays real recovery work.";
  }

  if (project.latestDailyLogStatus === "flagged") {
    return "Field already flagged this project, so PMO should treat it as a live execution risk rather than a passive portfolio update.";
  }

  if (project.qualityHolds > 0 || project.qualityReleaseReadiness < 75) {
    return "Quality pressure is already affecting continuity, so milestone confidence is weaker than the schedule alone suggests.";
  }

  if (project.permitBlockers > 0) {
    return "Permit blockers are already reducing continuity confidence and can slip the next milestone if ignored.";
  }

  return "The project is stable enough to keep moving, but the next milestone still needs an explicit owner and downstream continuity.";
}

function buildProjectDownstreamEffect(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return "Select a project to inspect what can get blocked downstream.";
  }

  if (project.status === "blocked" || project.permitBlockers > 2) {
    return "Project-level blockers can immediately freeze field sequencing, technical coordination, quality release and financial confidence.";
  }

  if (project.qualityHolds > 0 || project.qualityReleaseReadiness < 75) {
    return "Quality pressure here can stop downstream closeout, customer delivery and subcontract continuity even if field wants to keep moving.";
  }

  if (project.latestDailyLogStatus === "flagged") {
    return "A flagged daily log can quickly propagate into operations, equipment recovery and milestone slippage if PMO does not react now.";
  }

  return "The next downstream effect is mostly milestone discipline: keep field, quality and technical coordination aligned before variance widens.";
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

function buildProjectRelatedLinks(project: ProjectPortfolioItemContract | null) {
  if (!project) {
    return [
      { label: "Open projects", href: "/projects" },
      { label: "Open field", href: "/field" },
      { label: "Open dashboard", href: "/dashboard" }
    ];
  }

  if (project.status === "blocked" || project.permitBlockers > 2) {
    return [
      { label: "Open document control", href: "/document-control" },
      { label: "Open field", href: "/field" },
      { label: "Open operations", href: "/operations" }
    ];
  }

  if (project.qualityHolds > 0 || project.qualityReleaseReadiness < 75) {
    return [
      { label: "Open quality", href: "/quality" },
      { label: "Open daily log", href: "/daily-log" },
      { label: "Open field", href: "/field" }
    ];
  }

  if (project.latestDailyLogStatus === "flagged") {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open operations", href: "/operations" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  return [
    { label: "Open field", href: "/field" },
    { label: "Open quality", href: "/quality" },
    { label: "Open finance", href: "/finance" }
  ];
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

function buildProjectCreateHumanStep(input: {
  status: ProjectPortfolioItemContract["status"];
  permitBlockers: number;
  qualityHolds: number;
  progress: number;
  nextMilestone: string;
}) {
  if (input.status === "active" && input.permitBlockers > 2) {
    return "Reduce permit blockers before trying to open this project as active.";
  }

  if (input.status === "closed" && (input.progress < 100 || input.qualityHolds > 0 || input.permitBlockers > 0)) {
    return "Close the remaining quality or permit gaps before capturing this project as closed.";
  }

  if (input.nextMilestone.trim().length < 8) {
    return "Clarify the next milestone before persisting the intake so PMO can hand off the project cleanly.";
  }

  return "Create the project and immediately continue into field, quality or document control based on the first milestone.";
}

function buildProjectCreateWhyNow(input: {
  status: ProjectPortfolioItemContract["status"];
  permitBlockers: number;
  qualityHolds: number;
  progress: number;
  nextMilestone: string;
}) {
  if (input.status === "blocked") {
    return "Capturing a blocked project without an explicit downstream path only hides recovery work that operations should start now.";
  }

  if (input.status === "active" && input.progress <= 0) {
    return "An active project starting at 0% needs an immediate field and PMO alignment so the first milestone does not become fiction.";
  }

  if (input.permitBlockers > 0) {
    return "Permit blockers already exist at intake, so PMO should route the project into execution control with ownership from day one.";
  }

  if (input.qualityHolds > 0) {
    return "Quality pressure is already present at intake, so the first release path should be explicit before the project spreads downstream noise.";
  }

  if (input.nextMilestone.trim().length >= 8) {
    return "The next milestone is explicit enough to anchor the first operational handoff immediately after creation.";
  }

  return "This intake is still early, so creation should leave a clear next module instead of a passive portfolio record.";
}

function buildProjectCreateDownstreamEffect(input: {
  status: ProjectPortfolioItemContract["status"];
  permitBlockers: number;
  qualityHolds: number;
  progress: number;
}) {
  if (input.status === "blocked" || input.permitBlockers > 2) {
    return "Downstream impact is immediate: field continuity, document release and milestone confidence can freeze until the blocker owner is explicit.";
  }

  if (input.qualityHolds > 0) {
    return "Quality holds at intake can block field release, subcontract continuity and close readiness before the project stabilizes.";
  }

  if (input.status === "active" && input.progress <= 0) {
    return "An active project with no progress can quickly distort PMO visibility, equipment planning and field sequencing.";
  }

  return "The main downstream effect is continuity setup: once created, the project should move straight into field, quality or close follow-through without re-capturing context.";
}

function buildProjectCreateLinks(input: {
  status: ProjectPortfolioItemContract["status"];
  permitBlockers: number;
  qualityHolds: number;
  progress: number;
}) {
  if (input.status === "blocked" || input.permitBlockers > 2) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open document control", href: "/document-control" },
      { label: "Open close control", href: "/close-control" }
    ];
  }

  if (input.qualityHolds > 0) {
    return [
      { label: "Open quality", href: "/quality" },
      { label: "Open field", href: "/field" },
      { label: "Open daily log", href: "/daily-log" }
    ];
  }

  if (input.status === "active" && input.progress <= 0) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open operations", href: "/operations" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  return [
    { label: "Open field", href: "/field" },
    { label: "Open quality", href: "/quality" },
    { label: "Open close control", href: "/close-control" }
  ];
}

export default function ProjectsPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<ProjectPortfolioOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<ProjectEquipmentBridge>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectPortfolioItemContract["status"]>("all");
  const [budgetHealthFilter, setBudgetHealthFilter] = useState<"all" | ProjectPortfolioItemContract["budgetHealth"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"control" | "portfolio" | "create">("control");
  const [nextMilestoneDraft, setNextMilestoneDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
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
  const createProjectHumanStep = useMemo(() => buildProjectCreateHumanStep({
    status: createForm.status,
    permitBlockers: createFormNumbers.permitBlockers,
    qualityHolds: createFormNumbers.qualityHolds,
    progress: createFormNumbers.progress,
    nextMilestone: createForm.nextMilestone
  }), [createForm.nextMilestone, createForm.status, createFormNumbers.permitBlockers, createFormNumbers.progress, createFormNumbers.qualityHolds]);
  const createProjectWhyNow = useMemo(() => buildProjectCreateWhyNow({
    status: createForm.status,
    permitBlockers: createFormNumbers.permitBlockers,
    qualityHolds: createFormNumbers.qualityHolds,
    progress: createFormNumbers.progress,
    nextMilestone: createForm.nextMilestone
  }), [createForm.nextMilestone, createForm.status, createFormNumbers.permitBlockers, createFormNumbers.progress, createFormNumbers.qualityHolds]);
  const createProjectDownstreamEffect = useMemo(() => buildProjectCreateDownstreamEffect({
    status: createForm.status,
    permitBlockers: createFormNumbers.permitBlockers,
    qualityHolds: createFormNumbers.qualityHolds,
    progress: createFormNumbers.progress
  }), [createForm.status, createFormNumbers.permitBlockers, createFormNumbers.progress, createFormNumbers.qualityHolds]);
  const createProjectLinks = useMemo(() => buildProjectCreateLinks({
    status: createForm.status,
    permitBlockers: createFormNumbers.permitBlockers,
    qualityHolds: createFormNumbers.qualityHolds,
    progress: createFormNumbers.progress
  }), [createForm.status, createFormNumbers.permitBlockers, createFormNumbers.progress, createFormNumbers.qualityHolds]);

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

  const selectedStory = useMemo(
    () => buildProjectEquipmentStory(selectedProject, bridgeContext),
    [bridgeContext, selectedProject]
  );
  const projectContinuityGate = useMemo(() => buildProjectContinuityGate(selectedProject), [selectedProject]);
  const projectHumanStep = useMemo(() => buildProjectHumanStep(selectedProject), [selectedProject]);
  const projectWhyNow = useMemo(() => buildProjectWhyNow(selectedProject), [selectedProject]);
  const projectDownstreamEffect = useMemo(() => buildProjectDownstreamEffect(selectedProject), [selectedProject]);
  const projectReportBackWindow = useMemo(() => buildProjectReportBackWindow(selectedProject), [selectedProject]);
  const projectRelatedLinks = useMemo(() => buildProjectRelatedLinks(selectedProject), [selectedProject]);
  const projectContinuityCopy = useMemo(() => buildProjectContinuitySpanish(selectedProject), [selectedProject]);

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
    setNextMilestoneDraft(selectedProject?.nextMilestone ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedProjectId, selectedProject?.id, selectedProject?.nextMilestone]);

  async function handleProjectAction(
    status: ProjectPortfolioItemContract["status"],
    suggestedMilestone: string
  ) {
    if (!selectedProject) {
      return;
    }

    const nextMilestone = nextMilestoneDraft.trim() || suggestedMilestone;
    if (nextMilestone.length < 8) {
      setActionError("Next milestone must be more specific before updating the project.");
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
      setActionError(response.error?.message ?? "Project update failed.");
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
    setActionMessage(`Project moved to ${response.data.status}.`);
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
      setActionError(response.error?.message ?? "Project creation failed.");
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
    setCreateMessage(`${createdProject.code} added to the active portfolio.`);
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

            {workspaceView === "control" ? (
              <>
                <section className="grid cols3">
                  <KpiCard label={t("Avance físico", "Physical progress")} value={`${selectedProject?.progress ?? 0}%`} footnote={t("Progreso declarado para la obra seleccionada.", "Declared progress for the selected project.")} />
                  <KpiCard label={t("Bloqueos de calidad", "Quality holds")} value={String(selectedProject?.qualityHolds ?? 0)} footnote={t("No cierres el hito sin resolverlos.", "Do not close the milestone until they are resolved.")} />
                  <KpiCard label={t("Bloqueos de permiso", "Permit blockers")} value={String(selectedProject?.permitBlockers ?? 0)} footnote={t("Requieren responsable y fecha explícita.", "Require an explicit owner and date.")} />
                </section>
                <section className="grid cols2">
                  <Card title={t("Continuidad y siguiente hito", "Continuity and next milestone")} description={t("Actualiza el compromiso que guiará el siguiente corte operativo.", "Update the commitment that will guide the next operating cut.")}>
                    {selectedProject ? (
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">{t("Etapa", "Stage")}</div><div>{selectedProject.stage}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Bitácora más reciente", "Latest daily log")}</div><div><Badge tone={selectedProject.latestDailyLogStatus === "flagged" ? "danger" : selectedProject.latestDailyLogStatus === "approved" ? "success" : "warning"}>{selectedProject.latestDailyLogStatus}</Badge></div></div>
                        <label className="detailRow"><div className="detailLabel">{t("Siguiente hito", "Next milestone")}</div><input className="field" value={nextMilestoneDraft} onChange={(event) => setNextMilestoneDraft(event.target.value)} placeholder={t("Ej. Liberar cimentación y arrancar columnas", "E.g. Release foundations and start columns")} /></label>
                      </div>
                    ) : <EmptyState title={t("Sin obra seleccionada", "No project selected")} description={t("Selecciona una obra desde la lista para actualizar su continuidad.", "Select a project from the list to update continuity.")} />}
                    {selectedProject ? (
                      <div className="row gap wrap" style={{ marginTop: 20 }}>
                        <button type="button" className="button" disabled={isSaving || nextMilestoneDraft.trim().length < 8} onClick={() => void handleProjectAction(selectedProject.status, selectedProject.nextMilestone)}>
                          {isSaving ? t("Guardando...", "Saving...") : t("Guardar hito", "Save milestone")}
                        </button>
                        <Link className="buttonGhost" href={`/field?projectName=${encodeURIComponent(selectedProject.name)}`}>{t("Abrir campo", "Open field")}</Link>
                      </div>
                    ) : null}
                  </Card>

                  <Card title={t("Decisión de hoy", "Today's decision")} description={t(projectContinuityCopy.description, projectContinuityGate.summary)} aside={<Badge tone={projectContinuityGate.tone}>{t(projectContinuityCopy.label, projectContinuityGate.label)}</Badge>}>
                    <p className="sectionText">{t("Elige un cambio de estado únicamente cuando la obra pueda sostenerlo con sus bloqueos actuales.", "Choose a status change only when the project can sustain it with its current blockers.")}</p>
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
                    {actionMessage ? <p className="formSuccess">{actionMessage}</p> : null}
                    {actionError ? <p className="formError">{actionError}</p> : null}
                  </Card>
                </section>
                <section className="grid cols2">
                  <Card title={t("Ir al frente que resuelve", "Go to the resolving team")} description={t("La obra es el contexto; el bloqueo se resuelve en campo, calidad, equipos o documentos.", "The project is context; the blocker is resolved in field, quality, equipment or documents.")}>
                    <div className="row gap wrap">
                      <Link className="button" href={selectedProject ? `/field?projectName=${encodeURIComponent(selectedProject.name)}` : "/field"}>{t("Avance de obra", "Field progress")}</Link>
                      <Link className="buttonGhost" href="/quality">{t("Calidad", "Quality")}</Link>
                      <Link className="buttonGhost" href="/document-control">{t("Control documental", "Document control")}</Link>
                      <Link className="buttonGhost" href="/equipment">{t("Equipos", "Equipment")}</Link>
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

            {workspaceView === "create" ? (
              <section className="grid cols2">
                <Card title={t("Alta de obra", "Create project")} description={t("Crea una obra con los datos que necesitarán campo, calidad, equipos y compras desde el primer día.", "Create a project with the data field, quality, equipment and procurement need from day one.")}>
                  <div className="row gap wrap" style={{ marginBottom: 18 }}>
                    <button type="button" className="buttonGhost" onClick={() => setCreateForm(createProjectExample())}>{t("Cargar ejemplo", "Load example")}</button>
                    <button type="button" className="buttonGhost" onClick={() => setCreateForm((current) => ({ ...current, code: "", name: "", client: "", nextMilestone: "" }))}>{t("Limpiar esenciales", "Clear essentials")}</button>
                  </div>
                  <div className="captureCompactGrid">
                    <label className="captureField"><span>{t("Código", "Code")}</span><input className="field" value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="ARB-NVO-03" /></label>
                    <label className="captureField"><span>{t("Cliente", "Client")}</span><input className="field" value={createForm.client} onChange={(event) => setCreateForm((current) => ({ ...current, client: event.target.value }))} placeholder={t("Ej. Desarrolladora Norte", "E.g. North Developer")} /></label>
                    <label className="captureField captureFieldWide"><span>{t("Nombre de la obra", "Project name")}</span><input className="field" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder={t("Ej. Conjunto Residencial Norte", "E.g. North Residential Complex")} /></label>
                    <label className="captureField"><span>{t("Segmento", "Segment")}</span><input className="field" value={createForm.segment} onChange={(event) => setCreateForm((current) => ({ ...current, segment: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Etapa", "Stage")}</span><input className="field" value={createForm.stage} onChange={(event) => setCreateForm((current) => ({ ...current, stage: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Estado inicial", "Initial status")}</span><select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ProjectPortfolioItemContract["status"] }))}>{(["planning", "active", "at_risk", "blocked", "closed"] as ProjectPortfolioItemContract["status"][]).map((status) => <option key={status} value={status}>{localizeText(projectStatusLabel(status))}</option>)}</select></label>
                    <label className="captureField"><span>{t("Frentes activos", "Active fronts")}</span><input className="field" type="number" min="0" value={createForm.activeFronts} onChange={(event) => setCreateForm((current) => ({ ...current, activeFronts: event.target.value }))} /></label>
                    <label className="captureField"><span>{t("Avance inicial", "Initial progress")}</span><input className="field" type="number" min="0" max="100" value={createForm.progress} onChange={(event) => setCreateForm((current) => ({ ...current, progress: event.target.value }))} /></label>
                    <label className="captureField captureFieldWide"><span>{t("Primer hito", "First milestone")}</span><input className="field" value={createForm.nextMilestone} onChange={(event) => setCreateForm((current) => ({ ...current, nextMilestone: event.target.value }))} placeholder={t("Ej. Liberar permiso y movilizar el primer frente", "E.g. Release permit and mobilize the first front")} /></label>
                  </div>
                  <details className="captureDetails">
                    <summary>{t("Datos de control avanzados", "Advanced control data")}</summary>
                    <div className="captureCompactGrid">
                      <label className="captureField"><span>{t("Desviación (días)", "Variance (days)")}</span><input className="field" type="number" step="0.1" value={createForm.scheduleVarianceDays} onChange={(event) => setCreateForm((current) => ({ ...current, scheduleVarianceDays: event.target.value }))} /></label>
                      <label className="captureField"><span>{t("Salud de presupuesto", "Budget health")}</span><select className="selectField" value={createForm.budgetHealth} onChange={(event) => setCreateForm((current) => ({ ...current, budgetHealth: event.target.value as ProjectPortfolioItemContract["budgetHealth"] }))}><option value="on_track">{t("En control", "On track")}</option><option value="warning">{t("Alerta", "Warning")}</option><option value="critical">{t("Crítica", "Critical")}</option></select></label>
                      <label className="captureField"><span>{t("Retenciones de calidad", "Quality holds")}</span><input className="field" type="number" min="0" value={createForm.qualityHolds} onChange={(event) => setCreateForm((current) => ({ ...current, qualityHolds: event.target.value }))} /></label>
                      <label className="captureField"><span>{t("Bloqueos de permiso", "Permit blockers")}</span><input className="field" type="number" min="0" value={createForm.permitBlockers} onChange={(event) => setCreateForm((current) => ({ ...current, permitBlockers: event.target.value }))} /></label>
                    </div>
                  </details>
                  {actionError ? <p className="formError">{actionError}</p> : null}
                  <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateProject()}>{isCreating ? t("Creando...", "Creating...") : t("Crear obra", "Create project")}</button>{createMessage ? <Badge tone="success">{createMessage}</Badge> : null}</div>
                </Card>
                <div className="fieldWorkspaceSideStack">
                  <Card title={t("Validación previa", "Pre-creation validation")} description={t("Las reglas protegen la continuidad desde el alta.", "Rules protect continuity from project creation.")} aside={<Badge tone={createProjectGate.tone}>{t(createProjectGate.tone === "success" ? "Lista para crear" : createProjectGate.tone === "warning" ? "Crear con control" : "Completa datos", createProjectGate.label)}</Badge>}>
                    <p className="sectionText">{t("La obra debe tener código, cliente, etapa, frentes y un primer hito claro. El estado activo exige avance y bloqueos bajo control.", createProjectGate.summary)}</p>
                  </Card>
                  <Card title={t("Después del alta", "After creation")} description={t("La nueva obra queda disponible inmediatamente para el flujo operativo.", "The new project becomes available to the operating flow immediately.")}>
                    <div className="row gap wrap"><Link className="buttonGhost" href="/field">{t("Abrir campo", "Open field")}</Link><Link className="buttonGhost" href="/quality">{t("Abrir calidad", "Open quality")}</Link><Link className="buttonGhost" href="/document-control">{t("Abrir documentos", "Open documents")}</Link></div>
                  </Card>
                </div>
              </section>
            ) : null}

            <details className="projectAdvanced">
              <summary>{t("Abrir cartera detallada y controles avanzados", "Open detailed portfolio and advanced controls")}</summary>
              <div className="projectAdvancedContent">
            <section className="grid cols2">
              <Card
                title="Project operating lane"
                description="Use this screen as the main operating point for selecting a project, deciding the next move and jumping into the right execution module."
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
                      ? "risk lane"
                      : filteredSummary.permitBlockers > 0
                        ? "permit watch"
                        : "stable lane"}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Current route</div>
                    <div>{buildProjectWorkflow(selectedProject)}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Operator move</div>
                    <div>Select a project, update milestone or status, then jump directly into field, quality, equipment or document control.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Current selection</div>
                    <div>{selectedProject ? `${selectedProject.name} · ${selectedProject.code}` : "No project selected yet."}</div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/field">Open field</Link>
                  <Link className="buttonGhost" href="/operations">Open operations</Link>
                  <Link className="buttonGhost" href="/quality">Open quality</Link>
                  <Link className="buttonGhost" href="/document-control">Open document control</Link>
                </div>
              </Card>

              <Card
                title="Use this route first"
                description="This module is no longer just a portfolio list. It should let a human decide where execution attention goes next."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">1. Read posture</div>
                    <div>Use the KPIs and selected project panel to confirm if continuity is stable, at risk or blocked.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">2. Adjust</div>
                    <div>Update next milestone or move the project into the correct execution state.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">3. Continue</div>
                    <div>Leave projects quickly and continue in the domain that resolves the blocker, not just where it is observed.</div>
                  </div>
                </div>
              </Card>
            </section>

            <section className="grid cols4">
              <KpiCard
                label="Active fronts"
                value={String(filteredSummary.activeProjects)}
                footnote="Live portfolio count scoped to the active tenant."
              />
              <KpiCard
                label="Average progress"
                value={`${filteredSummary.averageProgress}%`}
                footnote="Average physical progress across active execution work."
              />
              <KpiCard
                label="Quality holds"
                value={String(filteredSummary.qualityHolds)}
                footnote="Open quality pressure points that still affect flow."
                badge={{ label: "field control", tone: "warning" }}
              />
              <KpiCard
                label="Permit blockers"
                value={String(filteredSummary.permitBlockers)}
                footnote="Critical blockers tied to permits, release or supervision."
                badge={{ label: "watchlist", tone: filteredSummary.permitBlockers > 0 ? "danger" : "success" }}
              />
              <KpiCard
                label="Execution risk"
                value={String(filteredSummary.executionRiskProjects)}
                footnote="Projects where field log, quality or subcontract posture already signal execution risk."
              />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="This workspace stays usable even before the live tenant backend is connected."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Working mode</div>
                    <div>Project changes are persisted locally in this browser so operations teams can run realistic walkthroughs immediately.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">What to test</div>
                    <div className="tableCellStack">
                      <span className="tableCellMuted">1. Filter and select a real project.</span>
                      <span className="tableCellMuted">2. Change milestone or status and validate business constraints.</span>
                      <span className="tableCellMuted">3. Register a new project and keep tracking it from this same screen.</span>
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols3">
              <Card title="Equipment coverage" description="How much real field equipment is mapped to the selected project.">
                <p className="sectionText">
                  {selectedStory?.equipmentCoverage ?? "Choose a project to inspect equipment coverage."}
                </p>
              </Card>
              <Card title="Field execution impact" description="What equipment posture means for the active production sequence.">
                <p className="sectionText">
                  {selectedStory?.fieldExecution ?? "Choose a project to inspect equipment impact."}
                </p>
              </Card>
              <Card title="Dispatch signal" description="Immediate equipment-driven action required for the selected project.">
                <p className="sectionText">
                  {selectedStory?.dispatchSignal ?? "Choose a project to inspect dispatch signal."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Project portfolio" description="Execution snapshot for PMO, supervision and directors.">
                <FilterBar summary={`${filteredProjects.length} projects match the current operating filters`}>
                  <label className="fieldLabel">
                    Status
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">All</option>
                      <option value="planning">Planning</option>
                      <option value="active">Active</option>
                      <option value="at_risk">At risk</option>
                      <option value="blocked">Blocked</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Budget
                    <select className="field" value={budgetHealthFilter} onChange={(event) => setBudgetHealthFilter(event.target.value as typeof budgetHealthFilter)}>
                      <option value="all">All</option>
                      <option value="on_track">On track</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Project, code, client or milestone"
                    />
                  </label>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "portfolio ready"}</Badge>
                  <Badge tone={filteredSummary.executionRiskProjects > 0 ? "danger" : filteredSummary.permitBlockers > 0 ? "warning" : "success"}>
                    {filteredSummary.executionRiskProjects > 0
                      ? `${filteredSummary.executionRiskProjects} at risk`
                      : filteredSummary.permitBlockers > 0
                        ? `${filteredSummary.permitBlockers} permit blockers`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                {filteredProjects.length > 0 ? (
                  <DataTable
                    rows={filteredProjects}
                    columns={[
                      {
                        key: "project",
                        label: "Project",
                        render: (project) => (
                          <button
                            className="buttonGhost"
                            type="button"
                            onClick={() => setSelectedProjectId(project.id)}
                            style={{ justifyContent: "flex-start", paddingInline: 0 }}
                          >
                            <div className="tableCellStack">
                              <strong>{project.name}</strong>
                              <span className="tableCellMuted">{project.code} · {project.segment}</span>
                            </div>
                          </button>
                        )
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (project) => <Badge tone={statusTone(project.status)}>{project.status}</Badge>
                      },
                      {
                        key: "progress",
                        label: "Progress",
                        render: (project) => (
                          <div className="tableCellStack">
                            <strong>{project.progress}%</strong>
                            <span className="tableCellMuted">{project.stage}</span>
                          </div>
                        )
                      },
                      {
                        key: "variance",
                        label: "Schedule variance",
                        render: (project) => (
                          <div className="tableCellStack">
                            <strong>{project.scheduleVarianceDays.toFixed(1)} days</strong>
                            <span className="tableCellMuted">{project.nextMilestone}</span>
                          </div>
                        )
                      },
                      {
                        key: "budget",
                        label: "Budget",
                        render: (project) => <Badge tone={budgetTone(project.budgetHealth)}>{project.budgetHealth}</Badge>
                      }
                    ]}
                  />
                ) : (
                  <EmptyState
                    title="No projects match the current filters"
                    description="Clear filters or register a new project so the portfolio becomes operable again."
                    primaryAction={{ label: "Stay on projects", href: "/projects" }}
                    secondaryAction={{ label: "Open field", href: "/field" }}
                  />
                )}
              </Card>

              <Card
                title="Selected project"
                description="Focused project context for the active selection."
                aside={selectedProject ? <Badge tone={statusTone(selectedProject.status)}>{selectedProject.status}</Badge> : null}
              >
                {selectedProject ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Client</div>
                      <div>{selectedProject.client}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Active fronts</div>
                      <div>{selectedProject.activeFronts}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Quality holds</div>
                      <div>{selectedProject.qualityHolds}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Permit blockers</div>
                      <div>{selectedProject.permitBlockers}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Latest daily log</div>
                      <div>
                        <Badge tone={selectedProject.latestDailyLogStatus === "flagged" ? "danger" : selectedProject.latestDailyLogStatus === "submitted" ? "info" : selectedProject.latestDailyLogStatus === "approved" ? "success" : "warning"}>
                          {selectedProject.latestDailyLogStatus}
                        </Badge>
                        <div className="tableCellMuted">{selectedProject.latestDailyLogDate ?? "No log linked yet"}</div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Quality / subcontract</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">release readiness {selectedProject.qualityReleaseReadiness}%</span>
                        <span className="tableCellMuted">
                          subcontract {selectedProject.subcontractHealth} · pending destajo MXN {selectedProject.pendingDestajo.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Continuity gate</div>
                      <div className="tableCellStack">
                        <Badge tone={projectContinuityGate.tone}>{projectContinuityGate.label}</Badge>
                        <span className="tableCellMuted">{projectContinuityGate.summary}</span>
                        {projectContinuityGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">{check}</span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{projectHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{projectWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{projectDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report back</div>
                      <div>{projectReportBackWindow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        {projectRelatedLinks.map((link) => (
                          <Link key={`${link.href}-${link.label}`} className="buttonGhost" href={link.href}>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next milestone</div>
                      <div>
                        <input
                          className="field"
                          value={nextMilestoneDraft}
                          onChange={(event) => setNextMilestoneDraft(event.target.value)}
                          placeholder="Describe the next delivery, permit or site milestone"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedProject.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Active status is blocked when permit blockers are greater than 2.</span>
                        <span className="tableCellMuted">Closed status requires zero quality holds and zero permit blockers.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.status === "blocked" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.status === "active" && selectedProject.permitBlockers > 2) ||
                                (option.status === "active" && selectedProject.latestDailyLogStatus === "flagged") ||
                                (option.status === "closed" &&
                                  (selectedProject.qualityHolds > 0 ||
                                    selectedProject.permitBlockers > 0 ||
                                    selectedProject.progress < 100 ||
                                    selectedProject.latestDailyLogStatus === "flagged"))
                              }
                              onClick={() => void handleProjectAction(option.status, option.nextMilestone)}
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
                    title="No project selected"
                    description="Choose a row from the portfolio or create a new project to inspect continuity, blockers and next moves."
                    primaryAction={{ label: "Stay on projects", href: "/projects" }}
                    secondaryAction={{ label: "Open field", href: "/field" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Risk and blocker watchlist" description="Construction risks with ownership and current action state.">
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

            <section className="grid cols2">
              <Card title="Register project" description="Create a new project directly in the tenant portfolio and start tracking it immediately.">
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createProjectExample())}>
                    Load demo example
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        code: "",
                        name: "",
                        client: "",
                        segment: "Residential",
                        status: "planning",
                        stage: "Preconstruction",
                        progress: "0",
                        scheduleVarianceDays: "0",
                        budgetHealth: "on_track",
                        qualityHolds: "0",
                        permitBlockers: "0",
                        activeFronts: "1",
                        nextMilestone: ""
                      })
                    }
                  >
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/field">Open field</Link>
                  <Link className="buttonGhost" href="/document-control">Open document control</Link>
                </div>
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Code</div><input className="field" value={createForm.code} onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="ARB-NVO-03" /></label>
                  <label className="detailRow"><div className="detailLabel">Project name</div><input className="field" value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} placeholder="Conjunto Residencial Norte" /></label>
                  <label className="detailRow"><div className="detailLabel">Client</div><input className="field" value={createForm.client} onChange={(event) => setCreateForm((current) => ({ ...current, client: event.target.value }))} placeholder="Desarrolladora Norte" /></label>
                  <label className="detailRow"><div className="detailLabel">Segment</div><input className="field" value={createForm.segment} onChange={(event) => setCreateForm((current) => ({ ...current, segment: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Status</div><select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as ProjectPortfolioItemContract["status"] }))}><option value="planning">planning</option><option value="active">active</option><option value="at_risk">at_risk</option><option value="blocked">blocked</option><option value="closed">closed</option></select></label>
                  <label className="detailRow"><div className="detailLabel">Stage</div><input className="field" value={createForm.stage} onChange={(event) => setCreateForm((current) => ({ ...current, stage: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Progress %</div><input className="field" type="number" min="0" max="100" value={createForm.progress} onChange={(event) => setCreateForm((current) => ({ ...current, progress: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Variance days</div><input className="field" type="number" step="0.1" value={createForm.scheduleVarianceDays} onChange={(event) => setCreateForm((current) => ({ ...current, scheduleVarianceDays: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Budget health</div><select className="selectField" value={createForm.budgetHealth} onChange={(event) => setCreateForm((current) => ({ ...current, budgetHealth: event.target.value as ProjectPortfolioItemContract["budgetHealth"] }))}><option value="on_track">on_track</option><option value="warning">warning</option><option value="critical">critical</option></select></label>
                  <label className="detailRow"><div className="detailLabel">Quality holds</div><input className="field" type="number" min="0" value={createForm.qualityHolds} onChange={(event) => setCreateForm((current) => ({ ...current, qualityHolds: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Permit blockers</div><input className="field" type="number" min="0" value={createForm.permitBlockers} onChange={(event) => setCreateForm((current) => ({ ...current, permitBlockers: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Active fronts</div><input className="field" type="number" min="0" value={createForm.activeFronts} onChange={(event) => setCreateForm((current) => ({ ...current, activeFronts: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next milestone</div><input className="field" value={createForm.nextMilestone} onChange={(event) => setCreateForm((current) => ({ ...current, nextMilestone: event.target.value }))} placeholder="Municipal permit release and first front mobilization" /></label>
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow"><div className="detailLabel">Creation gate</div><div className="tableCellStack"><div className="row gap wrap" style={{ alignItems: "center" }}><Badge tone={createProjectGate.tone}>{createProjectGate.label}</Badge><span>{createProjectGate.summary}</span></div>{createProjectGate.checks.map((check) => (<span key={check} className="tableCellMuted">{check}</span>))}</div></div>
                  <div className="detailRow"><div className="detailLabel">Next human step</div><div>{createProjectHumanStep}</div></div>
                  <div className="detailRow"><div className="detailLabel">Why now</div><div>{createProjectWhyNow}</div></div>
                  <div className="detailRow"><div className="detailLabel">Downstream effect</div><div>{createProjectDownstreamEffect}</div></div>
                  <div className="detailRow"><div className="detailLabel">Immediate downstream</div><div className="row gap wrap">{createProjectLinks.map((link) => (<Link key={`${link.href}-${link.label}`} className="buttonGhost" href={link.href}>{link.label}</Link>))}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateProject()}>
                    {isCreating ? "Creating..." : "Add project"}
                  </button>
                  <Link className="buttonGhost" href="/quality">Open quality</Link>
                  <Link className="buttonGhost" href="/close-control">Open close control</Link>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Project creation rules" description="The portfolio intake now persists directly to the backend and enforces the same operational constraints.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Unique code</div><div>Project codes stay unique per tenant to avoid duplicate portfolio tracking.</div></div>
                  <div className="detailRow"><div className="detailLabel">Active gate</div><div>Projects cannot start as `active` when permit blockers are above 2.</div></div>
                  <div className="detailRow"><div className="detailLabel">Closed gate</div><div>`closed` requires 100% progress, zero quality holds and zero permit blockers.</div></div>
                  <div className="detailRow"><div className="detailLabel">Operational continuity</div><div>The created project becomes selectable immediately for field, quality and equipment flows.</div></div>
                </div>
              </Card>
            </section>
              </div>
            </details>
          </>
        ) : error ? (
          <EmptyState
            title="Projects portfolio unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open field", href: "/field" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading projects portfolio" : "Projects portfolio not loaded yet"}
            description={
              isDemoMode
                ? "This route should load demo or live project portfolio data so operators can continue into field and technical coordination."
                : "This route expects the live portfolio response for the active tenant."
            }
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
