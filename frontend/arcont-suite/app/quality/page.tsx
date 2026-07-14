"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import type { QualityInspectionContract, QualityOverviewContract } from "@/lib/contracts";
import { createQualityInspection, fetchEquipmentOverview, fetchQualityOverview, updateQualityInspection } from "@/lib/platform-api";

function severityTone(severity: QualityInspectionContract["severity"]) {
  switch (severity) {
    case "critical":
      return "danger";
    case "major":
      return "warning";
    default:
      return "info";
  }
}

function qualityActionOptions(inspection: QualityInspectionContract) {
  switch (inspection.status) {
    case "blocked":
      return [
        {
          label: "Resume work",
          status: "in_progress" as const,
          nextAction: "Resume correction crew and capture fresh evidence from the field"
        },
        {
          label: "Move to release review",
          status: "pending_release" as const,
          nextAction: "Confirm remaining punch items and schedule release walkthrough"
        }
      ];
    case "in_progress":
      return [
        {
          label: "Send to release review",
          status: "pending_release" as const,
          nextAction: "Validate evidence package and prepare release walkthrough"
        },
        {
          label: "Block inspection",
          status: "blocked" as const,
          nextAction: "Escalate blocker and hold release until field correction is confirmed"
        }
      ];
    case "pending_release":
      return [
        {
          label: "Reopen correction",
          status: "in_progress" as const,
          nextAction: "Return punch list to field team and update closeout evidence"
        },
        {
          label: "Block release",
          status: "blocked" as const,
          nextAction: "Pause release and document the blocker before the next walkthrough"
        }
      ];
    case "scheduled":
      return [
        {
          label: "Start inspection",
          status: "in_progress" as const,
          nextAction: "Start the checklist in field and upload the first evidence batch"
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(inspectionsBoard: QualityInspectionContract[]) {
  const openFindings = inspectionsBoard.reduce((sum, inspection) => sum + inspection.openFindings, 0);
  const releaseReadiness =
    inspectionsBoard.length > 0
      ? Number((inspectionsBoard.reduce((sum, inspection) => sum + inspection.releaseReadiness, 0) / inspectionsBoard.length).toFixed(1))
      : 0;
  const averageReworkRate =
    inspectionsBoard.length > 0
      ? Number((inspectionsBoard.reduce((sum, inspection) => sum + inspection.reworkRate, 0) / inspectionsBoard.length).toFixed(1))
      : 0;

  return {
    inspections: inspectionsBoard.length,
    openFindings,
    releaseReadiness,
    averageReworkRate,
    executionRiskInspections: inspectionsBoard.filter(
      (item) => item.latestDailyLogStatus === "flagged" || item.projectStatus === "blocked" || item.openFindings > 3
    ).length
  };
}

type QualityBridgeContext = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
} | null;

function buildQualityStory(inspection: QualityInspectionContract | null, bridge: QualityBridgeContext) {
  if (!inspection) {
    return null;
  }

  const machineSignal = bridge?.equipment.focusMachine ?? null;

  return {
    equipmentReadiness: machineSignal
      ? `${machineSignal.machineName} is the current asset anchor with status ${machineSignal.status}, health ${machineSignal.health} and ${machineSignal.availabilityPercent}% availability.`
      : "No equipment anchor is currently visible for this inspection lane.",
    fieldCorrectionSupport:
      inspection.status === "blocked"
        ? `${inspection.contractorName} still needs an immediate correction push before release can resume.`
        : `${inspection.contractorName} is moving under ${inspection.openFindings} open findings and ${inspection.evidenceCompletion}% evidence completion.`,
    releaseConstraint: machineSignal
      ? `${inspection.code} and ${machineSignal.machineName} together define today's release posture: ${inspection.releaseReadiness}% readiness with ${machineSignal.criticalOpenFailures} critical failures still open on the asset side.`
      : `${inspection.code} currently carries a standalone release constraint with ${inspection.openFindings} open findings.`
  };
}

function createQualityExample() {
  return {
    projectName: "Torre Demo Acabados",
    areaName: "Frente Acabados",
    checklistName: "Liberacion de muros y detalles",
    contractorName: "Acabados Integrales",
    severity: "critical" as QualityInspectionContract["severity"],
    openFindings: "4",
    evidenceCompletion: "62",
    releaseReadiness: "48",
    reworkRate: "18",
    status: "blocked" as QualityInspectionContract["status"],
    nextAction: "Corregir hallazgos mayores y completar evidencia antes de reactivar la liberacion."
  };
}

function createQualityPreset(
  preset: "release_ready" | "evidence_gap" | "blocked_release"
): ReturnType<typeof createQualityExample> {
  switch (preset) {
    case "release_ready":
      return {
        projectName: "Torre Demo Acabados",
        areaName: "Frente Acabados",
        checklistName: "Liberacion final de detalles",
        contractorName: "Acabados Integrales",
        severity: "major" as QualityInspectionContract["severity"],
        openFindings: "1",
        evidenceCompletion: "94",
        releaseReadiness: "92",
        reworkRate: "4",
        status: "pending_release" as QualityInspectionContract["status"],
        nextAction: "Cerrar observación menor y ejecutar walkthrough final de liberacion."
      };
    case "evidence_gap":
      return {
        projectName: "Torre Demo Acabados",
        areaName: "Frente Pintura",
        checklistName: "Evidencia de liberacion por area",
        contractorName: "Pinturas del Sureste",
        severity: "major" as QualityInspectionContract["severity"],
        openFindings: "2",
        evidenceCompletion: "58",
        releaseReadiness: "63",
        reworkRate: "9",
        status: "in_progress" as QualityInspectionContract["status"],
        nextAction: "Completar evidencia faltante y reservar reinspeccion antes del siguiente cierre."
      };
    default:
      return createQualityExample();
  }
}

function buildCreateInspectionGate(input: {
  projectName: string;
  areaName: string;
  checklistName: string;
  contractorName: string;
  severity: QualityInspectionContract["severity"];
  status: QualityInspectionContract["status"];
  openFindings: number;
  evidenceCompletion: number;
  releaseReadiness: number;
  reworkRate: number;
  nextAction: string;
}) {
  const checks: string[] = [];

  if ([input.projectName, input.areaName, input.checklistName, input.contractorName].some((value) => value.trim().length < 3)) {
    checks.push("Project, area, checklist and contractor still need more specific capture.");
  }

  if (!Number.isFinite(input.openFindings) || input.openFindings < 0) {
    checks.push("Open findings must be a valid non-negative number.");
  }

  if (!Number.isFinite(input.evidenceCompletion) || input.evidenceCompletion < 0 || input.evidenceCompletion > 100) {
    checks.push("Evidence completion must stay between 0 and 100.");
  }

  if (!Number.isFinite(input.releaseReadiness) || input.releaseReadiness < 0 || input.releaseReadiness > 100) {
    checks.push("Release readiness must stay between 0 and 100.");
  }

  if (!Number.isFinite(input.reworkRate) || input.reworkRate < 0) {
    checks.push("Rework rate must be a valid non-negative number.");
  }

  if (input.status === "pending_release" && input.openFindings > 3) {
    checks.push("Pending release inspections require at most 3 open findings.");
  }

  if (input.status === "pending_release" && input.evidenceCompletion < 85) {
    checks.push("Pending release inspections require at least 85% evidence.");
  }

  if (input.releaseReadiness < input.evidenceCompletion - 45) {
    checks.push("Release readiness looks too weak compared with current evidence posture.");
  }

  if (input.severity === "critical" && input.status === "pending_release" && input.releaseReadiness < 90) {
    checks.push("Critical inspections should not enter release review below 90% release readiness.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for correction or release follow-through.");
  }

  if (checks.length > 0) {
    const hardBlock =
      (input.status === "pending_release" && input.openFindings > 3) ||
      (input.status === "pending_release" && input.evidenceCompletion < 85) ||
      (input.severity === "critical" && input.status === "pending_release" && input.releaseReadiness < 90);

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This inspection would open with a hard release blocker."
        : "The inspection can be created, but release discipline still needs tightening.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The inspection has enough structure to enter the release lane cleanly.",
    checks: [
      "The created inspection will become the current focus item immediately.",
      "Keep findings, evidence and next release action attached from the first capture."
    ]
  };
}

function buildCreateInspectionHumanStep(input: {
  status: QualityInspectionContract["status"];
  openFindings: number;
  evidenceCompletion: number;
  releaseReadiness: number;
  nextAction: string;
}) {
  if (input.status === "pending_release" && input.evidenceCompletion < 85) {
    return "Close the evidence gap first so release review does not start already compromised.";
  }

  if (input.status === "pending_release" && input.openFindings > 3) {
    return "Reduce open findings before moving this inspection into release review.";
  }

  if (input.releaseReadiness < 75) {
    return "Create the inspection and route the next action straight into field correction before promising release.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Clarify the immediate correction or release step before persisting the inspection.";
  }

  return "Create the inspection and continue directly into field correction, evidence closure or release walkthrough.";
}

function buildCreateInspectionDestination(input: {
  status: QualityInspectionContract["status"];
  evidenceCompletion: number;
  releaseReadiness: number;
  openFindings: number;
}) {
  if (input.status === "blocked" || input.openFindings > 3) {
    return {
      label: "Open field",
      href: "/field",
      description: "Correction work still belongs in field before quality can treat release as real."
    };
  }

  if (input.evidenceCompletion < 85) {
    return {
      label: "Open document control",
      href: "/document-control",
      description: "Evidence posture is still weak, so the next move should reinforce technical documentation."
    };
  }

  if (input.releaseReadiness < 75) {
    return {
      label: "Open daily log",
      href: "/daily-log",
      description: "The release lane is still weak enough that site supervision should see the continuity impact."
    };
  }

  return {
    label: "Open compliance",
    href: "/compliance",
    description: "If findings and evidence are under control, continue into release and compliance discipline."
  };
}

function buildQualityWorkflow(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return "Use quality as the technical release lane between field execution, correction work and final release posture.";
  }

  if (inspection.status === "blocked") {
    return "A blocked inspection should route immediately back into field correction, evidence capture and asset continuity before release is reconsidered.";
  }

  if (inspection.status === "pending_release") {
    return "A pending-release inspection should close findings and evidence fast so the team can make a clean release decision.";
  }

  return "An active inspection should keep field correction, contractor follow-up and release readiness aligned in the same lane.";
}

function buildQualityWhyNow(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return "Select an inspection to understand why quality should act right now.";
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return `${inspection.areaName} is already under blocked or heavy-findings posture, so delaying action now will keep release and site continuity artificially stuck.`;
  }

  if (inspection.evidenceCompletion < 85) {
    return `${inspection.areaName} still lacks enough evidence to support a credible release decision, so waiting only passes weak closeout downstream.`;
  }

  if (inspection.releaseReadiness < 75 || inspection.projectStatus === "blocked") {
    return `${inspection.areaName} still carries weak release posture, so this inspection matters now because field and closeout decisions still depend on it.`;
  }

  return `${inspection.areaName} is near release, so the useful action now is to close the last technical gaps before another review cycle is wasted.`;
}

function buildQualityDownstreamEffect(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return "Select an inspection to inspect which downstream lane absorbs the impact.";
  }

  if (inspection.status === "blocked") {
    return "If this inspection stays blocked, field execution, daily supervision and release planning will all inherit the stall next.";
  }

  if (inspection.evidenceCompletion < 85) {
    return "If evidence remains weak, document control, compliance and close-control will inherit incomplete release support and avoidable rework.";
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return "If findings or readiness do not improve, field correction and final release sequencing will keep looping around the same unresolved area.";
  }

  return "If this inspection closes cleanly, release, compliance and downstream turnover can move without rebuilding the technical story.";
}

function buildQualityHumanStep(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return "Select an inspection to define the next human handoff.";
  }

  if (inspection.status === "blocked") {
    return "Tell field and the contractor exactly what must be corrected, who owns it and when the next walkthrough happens.";
  }

  if (inspection.evidenceCompletion < 85) {
    return "Tell the evidence owner what is still missing before anyone treats this area as ready for release review.";
  }

  if (inspection.openFindings > 0) {
    return "Tell the contractor which findings remain open and when quality expects the corrected package back for reinspection.";
  }

  return "Tell the release owner and downstream control team that the area is ready for the next formal release step.";
}

function buildQualityReportBack(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return "Select an inspection to define when the responsible owner should report back.";
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return "Report back in the same operating cycle with correction ownership, evidence status and the next reinspection moment.";
  }

  if (inspection.evidenceCompletion < 85) {
    return "Report back once the missing evidence is explicit enough to support release review without hidden gaps.";
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return "Report back when findings and readiness are already aligned enough for a credible release decision.";
  }

  return "Report back at the next release checkpoint confirming the area truly moved out of correction and into clean release posture.";
}

function buildQualityRouteSummary(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return "Use quality as the release lane between field correction, evidence control and final compliance-ready closure.";
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return "This inspection should route first through field correction and evidence recovery before release is considered credible again.";
  }

  if (inspection.evidenceCompletion < 85) {
    return "This inspection should route through stronger evidence and document discipline before downstream teams assume release is defensible.";
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return "This inspection should route through correction closure and reinspection before compliance or closeout inherit the same weak area.";
  }

  return "This inspection can continue through compliance and downstream turnover with the current technical story intact.";
}

function buildQualityOperationalLinks(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open document control", href: "/document-control" },
      { label: "Open compliance", href: "/compliance" }
    ];
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open daily log", href: "/daily-log" },
      { label: "Open equipment", href: "/equipment" }
    ];
  }

  if (inspection.evidenceCompletion < 85) {
    return [
      { label: "Open document control", href: "/document-control" },
      { label: "Open field", href: "/field" },
      { label: "Open compliance", href: "/compliance" }
    ];
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return [
      { label: "Open field", href: "/field" },
      { label: "Open compliance", href: "/compliance" },
      { label: "Open daily log", href: "/daily-log" }
    ];
  }

  return [
    { label: "Open compliance", href: "/compliance" },
    { label: "Open document control", href: "/document-control" },
    { label: "Open field", href: "/field" }
  ];
}

function QualityPageContent() {
  const { activeCompany, apiBaseUrl, session } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<QualityOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<QualityBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | QualityInspectionContract["severity"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | QualityInspectionContract["status"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [createForm, setCreateForm] = useState({
    projectName: "Proyecto central",
    areaName: "Frente 1",
    checklistName: "Inspeccion de calidad",
    contractorName: "Contratista principal",
    severity: "major" as QualityInspectionContract["severity"],
    openFindings: "2",
    evidenceCompletion: "70",
    releaseReadiness: "65",
    reworkRate: "8",
    status: "in_progress" as QualityInspectionContract["status"],
    nextAction: ""
  });
  const createFormNumbers = useMemo(
    () => ({
      openFindings: Number(createForm.openFindings),
      evidenceCompletion: Number(createForm.evidenceCompletion),
      releaseReadiness: Number(createForm.releaseReadiness),
      reworkRate: Number(createForm.reworkRate)
    }),
    [createForm.evidenceCompletion, createForm.openFindings, createForm.releaseReadiness, createForm.reworkRate]
  );

  useEffect(() => {
    const project = searchParams.get("project");
    const area = searchParams.get("area");
    setProjectFilter(project && project.length > 0 ? project : "all");
    setAreaFilter(area && area.length > 0 ? area : "all");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchQualityOverview(activeCompany.id, {
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
          setError("Quality overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedInspectionId((current) => current ?? result.focusInspection?.id ?? result.inspectionsBoard[0]?.id ?? null);
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

  const selectedInspection = useMemo(
    () => overview?.inspectionsBoard.find((item) => item.id === selectedInspectionId) ?? overview?.focusInspection ?? null,
    [overview, selectedInspectionId]
  );

  const projectOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.inspectionsBoard.map((item) => item.projectName))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [overview]);

  const areaOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    const scopedInspections =
      projectFilter === "all"
        ? overview.inspectionsBoard
        : overview.inspectionsBoard.filter((item) => item.projectName === projectFilter);

    return Array.from(new Set(scopedInspections.map((item) => item.areaName))).sort((left, right) => left.localeCompare(right));
  }, [overview, projectFilter]);

  const filteredInspections = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.inspectionsBoard.filter(
      (item) =>
        (projectFilter === "all" || item.projectName === projectFilter) &&
        (areaFilter === "all" || item.areaName === areaFilter) &&
        (severityFilter === "all" || item.severity === severityFilter) &&
        (statusFilter === "all" || item.status === statusFilter) &&
        (normalizedSearch.length === 0 ||
          item.contractorName.toLowerCase().includes(normalizedSearch) ||
          item.checklistName.toLowerCase().includes(normalizedSearch) ||
          item.code.toLowerCase().includes(normalizedSearch) ||
          item.nextAction.toLowerCase().includes(normalizedSearch))
    );
  }, [areaFilter, overview, projectFilter, searchFilter, severityFilter, statusFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredInspections), [filteredInspections]);

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.inspectionId === selectedInspection?.id) ?? [],
    [overview, selectedInspection]
  );
  const selectedWhyNow = useMemo(() => buildQualityWhyNow(selectedInspection), [selectedInspection]);
  const selectedDownstreamEffect = useMemo(() => buildQualityDownstreamEffect(selectedInspection), [selectedInspection]);
  const selectedHumanStep = useMemo(() => buildQualityHumanStep(selectedInspection), [selectedInspection]);
  const selectedReportBack = useMemo(() => buildQualityReportBack(selectedInspection), [selectedInspection]);
  const selectedRouteSummary = useMemo(() => buildQualityRouteSummary(selectedInspection), [selectedInspection]);
  const selectedOperationalLinks = useMemo(() => buildQualityOperationalLinks(selectedInspection), [selectedInspection]);

  const filteredRisks = useMemo(() => {
    if (!overview) {
      return [];
    }

    return overview.risks.filter((risk) => {
      const parent = overview.inspectionsBoard.find((item) => item.id === risk.inspectionId);
      return (
        (!!parent && (projectFilter === "all" || parent.projectName === projectFilter)) &&
        (!!parent && (areaFilter === "all" || parent.areaName === areaFilter))
      );
    });
  }, [areaFilter, overview, projectFilter]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredInspections.length === 0) {
      setSelectedInspectionId(null);
      return;
    }

    const isSelectedVisible = filteredInspections.some((item) => item.id === selectedInspectionId);
    if (!isSelectedVisible) {
      setSelectedInspectionId(filteredInspections[0]?.id ?? null);
    }
  }, [filteredInspections, overview, selectedInspectionId]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (projectFilter === "all") {
      nextParams.delete("project");
    } else {
      nextParams.set("project", projectFilter);
    }

    if (areaFilter === "all") {
      nextParams.delete("area");
    } else {
      nextParams.set("area", areaFilter);
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [areaFilter, pathname, projectFilter, router, searchParams]);

  const actionOptions = useMemo(
    () => (selectedInspection ? qualityActionOptions(selectedInspection) : []),
    [selectedInspection]
  );

  const selectedStory = useMemo(() => buildQualityStory(selectedInspection, bridgeContext), [bridgeContext, selectedInspection]);
  const createInspectionGate = useMemo(
    () =>
      buildCreateInspectionGate({
        projectName: createForm.projectName,
        areaName: createForm.areaName,
        checklistName: createForm.checklistName,
        contractorName: createForm.contractorName,
        severity: createForm.severity,
        status: createForm.status,
        openFindings: createFormNumbers.openFindings,
        evidenceCompletion: createFormNumbers.evidenceCompletion,
        releaseReadiness: createFormNumbers.releaseReadiness,
        reworkRate: createFormNumbers.reworkRate,
        nextAction: createForm.nextAction
      }),
    [createForm, createFormNumbers]
  );
  const createInspectionHumanStep = useMemo(
    () =>
      buildCreateInspectionHumanStep({
        status: createForm.status,
        openFindings: createFormNumbers.openFindings,
        evidenceCompletion: createFormNumbers.evidenceCompletion,
        releaseReadiness: createFormNumbers.releaseReadiness,
        nextAction: createForm.nextAction
      }),
    [createForm.nextAction, createForm.status, createFormNumbers]
  );
  const createInspectionDestination = useMemo(
    () =>
      buildCreateInspectionDestination({
        status: createForm.status,
        evidenceCompletion: createFormNumbers.evidenceCompletion,
        releaseReadiness: createFormNumbers.releaseReadiness,
        openFindings: createFormNumbers.openFindings
      }),
    [createForm.status, createFormNumbers]
  );

  useEffect(() => {
    setNextActionDraft(selectedInspection?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedInspectionId, selectedInspection?.id, selectedInspection?.nextAction]);

  async function handleInspectionAction(status: QualityInspectionContract["status"], suggestedNextAction: string) {
    if (!selectedInspection) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the inspection.");
      return;
    }

    if (status === "pending_release" && (selectedInspection.openFindings > 3 || selectedInspection.evidenceCompletion < 85)) {
      setActionError("Release review requires at most 3 open findings and at least 85% evidence.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateQualityInspection(
      selectedInspection.id,
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
      setActionError(response.error?.message ?? "Inspection update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const inspectionsBoard = current.inspectionsBoard.map((inspection) =>
        inspection.id === response.data?.id ? response.data : inspection
      );
      return {
        ...current,
        summary: recomputeSummary(inspectionsBoard),
        inspectionsBoard,
        focusInspection: current.focusInspection?.id === response.data?.id ? response.data : current.focusInspection
      };
    });
    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Inspection moved to ${response.data.status}.`);
    setIsSaving(false);
  }

  async function handleCreateInspection() {
    if (!overview) {
      return;
    }

    const projectName = createForm.projectName.trim();
    const areaName = createForm.areaName.trim();
    const checklistName = createForm.checklistName.trim();
    const contractorName = createForm.contractorName.trim();
    const nextAction = createForm.nextAction.trim();

    if (projectName.length < 3 || areaName.length < 3 || checklistName.length < 3 || contractorName.length < 3) {
      setActionError("Project, area, checklist and contractor must be specific before creating the inspection.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before creating the inspection.");
      setCreateMessage(null);
      return;
    }

    const openFindings = Number(createForm.openFindings);
    const evidenceCompletion = Number(createForm.evidenceCompletion);
    const releaseReadiness = Number(createForm.releaseReadiness);
    const reworkRate = Number(createForm.reworkRate);

    if (!Number.isFinite(openFindings) || openFindings < 0) {
      setActionError("Open findings must be a valid non-negative number.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(evidenceCompletion) || evidenceCompletion < 0 || evidenceCompletion > 100) {
      setActionError("Evidence completion must be between 0 and 100.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(releaseReadiness) || releaseReadiness < 0 || releaseReadiness > 100) {
      setActionError("Release readiness must be between 0 and 100.");
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(reworkRate) || reworkRate < 0) {
      setActionError("Rework rate must be a valid non-negative number.");
      setCreateMessage(null);
      return;
    }

    if (createForm.status === "pending_release" && (openFindings > 3 || evidenceCompletion < 85)) {
      setActionError("Pending release inspections require at most 3 findings and at least 85% evidence.");
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createQualityInspection(
      activeCompany.id,
      {
        areaName: `${projectName} · ${areaName}`,
        checklistName,
        contractorName,
        severity: createForm.severity,
        openFindings,
        evidenceCompletion,
        releaseReadiness,
        reworkRate,
        status: createForm.status,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Inspection creation failed.");
      setIsCreating(false);
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const inspectionsBoard = [created, ...current.inspectionsBoard];
      return {
        ...current,
        summary: recomputeSummary(inspectionsBoard),
        inspectionsBoard,
        focusInspection: created
      };
    });
    setSelectedInspectionId(created.id);
    setNextActionDraft(created.nextAction);
    setCreateMessage(`${created.code} added to the quality board.`);
    setCreateForm({
      projectName,
      areaName,
      checklistName: "Inspeccion de calidad",
      contractorName,
      severity: "major",
      openFindings: "2",
      evidenceCompletion: "70",
      releaseReadiness: "65",
      reworkRate: "8",
      status: "in_progress",
      nextAction: ""
    });
    setIsCreating(false);
  }

  return (
    <AppShell
      title="Quality and inspections"
      eyebrow="Field quality"
      description="Inspections, punch list, evidence and release readiness tied to live field execution."
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Quality">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Inspections"
                value={String(filteredSummary.inspections)}
                footnote="Visible inspection workload for the current operating filter."
              />
              <KpiCard
                label="Open findings"
                value={String(filteredSummary.openFindings)}
                footnote="Visible findings still affecting release or reinspection."
              />
              <KpiCard
                label="Release readiness"
                value={`${filteredSummary.releaseReadiness}%`}
                footnote="Average release posture across the visible quality subset."
              />
              <KpiCard
                label="Rework"
                value={`${filteredSummary.averageReworkRate}%`}
                footnote="Average rework rate across the visible inspection board."
              />
              <KpiCard
                label="Execution risk"
                value={String(filteredSummary.executionRiskInspections)}
                footnote="Visible inspections already under blockage, flagged logs or heavy findings."
              />
            </section>

            <section className="grid cols1">
              <Card
                title="Release workflow"
                description="This route should already let site and quality teams move from findings to release without depending on a live auth-only flow."
              >
                <p className="sectionText">
                  Select an inspection, move it between correction and release states, and continue into `document-control`,
                  `field`, `equipment` or `compliance` depending on whether the blocker is evidence, coordination, asset continuity or closeout posture.
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Quality continuity"
                description="Quality should bridge field execution, technical evidence and release control instead of acting as a standalone checklist."
                aside={<Badge tone={filteredSummary.executionRiskInspections > 0 ? "danger" : filteredSummary.openFindings > 0 ? "warning" : "success"}>{filteredSummary.executionRiskInspections > 0 ? "risk lane" : filteredSummary.openFindings > 0 ? "open findings" : "stable lane"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Current route</div><div>{buildQualityWorkflow(selectedInspection)}</div></div>
                  <div className="detailRow"><div className="detailLabel">Technical rule</div><div>Release should happen only when findings, evidence and field constraints are coherent enough for a real handoff.</div></div>
                  <div className="detailRow"><div className="detailLabel">Operational jump</div><div>Move into `field`, `daily-log`, `equipment` or `document-control` according to the actual reason release is not clean yet.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/field">Open field</Link>
                  <Link className="buttonGhost" href="/daily-log">Open daily log</Link>
                  <Link className="buttonGhost" href="/equipment">Open equipment</Link>
                  <Link className="buttonGhost" href="/document-control">Open document control</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Equipment readiness" description="Current fleet posture attached to quality release.">
                <p className="sectionText">
                  {selectedStory?.equipmentReadiness ?? "Choose an inspection to inspect equipment readiness."}
                </p>
              </Card>
              <Card title="Field correction support" description="How the contractor correction flow is behaving right now.">
                <p className="sectionText">
                  {selectedStory?.fieldCorrectionSupport ?? "Choose an inspection to inspect correction support."}
                </p>
              </Card>
              <Card title="Release constraint" description="Joint constraint between asset readiness and inspection closure.">
                <p className="sectionText">
                  {selectedStory?.releaseConstraint ?? "Choose an inspection to inspect release constraints."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Inspection board" description="Live inspection, punch list and non-conformance signals.">
                <FilterBar summary={`${filteredInspections.length} quality inspections match the current operating filters`}>
                  <Badge tone={!session.accessToken ? "warning" : "success"}>
                    {!session.accessToken ? "demo mode" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "quality ready"}</Badge>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">All projects</option>
                    {projectOptions.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                    <option value="all">All areas</option>
                    {areaOptions.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}>
                    <option value="all">All severity</option>
                    <option value="critical">Critical</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                  <select className="selectField" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                    <option value="all">All status</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In progress</option>
                    <option value="pending_release">Pending release</option>
                    <option value="blocked">Blocked</option>
                  </select>
                  <input
                    className="field"
                    type="search"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Contractor, checklist, code or next action"
                    style={{ minWidth: 220 }}
                  />
                  <Badge tone={filteredSummary.executionRiskInspections > 0 ? "danger" : filteredSummary.openFindings > 0 ? "warning" : "success"}>
                    {filteredSummary.executionRiskInspections > 0
                      ? `${filteredSummary.executionRiskInspections} at risk`
                      : filteredSummary.openFindings > 0
                        ? `${filteredSummary.openFindings} findings`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredInspections}
                  columns={[
                    {
                      key: "inspection",
                      label: "Inspection",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedInspectionId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.areaName}</strong>
                            <span className="tableCellMuted">{row.checklistName} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "contractor",
                      label: "Contractor",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.contractorName}</strong>
                          <span className="tableCellMuted">{row.openFindings} findings</span>
                        </div>
                      )
                    },
                    {
                      key: "release",
                      label: "Release",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.releaseReadiness}%</strong>
                          <span className="tableCellMuted">{row.evidenceCompletion}% evidence</span>
                        </div>
                      )
                    },
                    {
                      key: "severity",
                      label: "Severity",
                      render: (row) => <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected inspection"
                description="Focused view of the active quality issue, evidence and release actions."
                aside={
                  selectedInspection ? <Badge tone={severityTone(selectedInspection.severity)}>{selectedInspection.severity}</Badge> : null
                }
              >
                {selectedInspection ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div className="tableCellStack">
                        <span>{selectedInspection.projectName}</span>
                        <span className="tableCellMuted">
                          {selectedInspection.projectStatus} · latest log {selectedInspection.latestDailyLogStatus}
                        </span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Checklist</div>
                      <div>{selectedInspection.checklistName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedInspection.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Evidence</div>
                      <div>{selectedInspection.evidenceCompletion}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Rework rate</div>
                      <div>{selectedInspection.reworkRate}%</div>
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
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the field action required to unblock this inspection"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedInspection.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Release review requires at most 3 open findings and at least 85% evidence.</span>
                        <span className="tableCellMuted">Final release requires 0 open findings and at least 90% release readiness.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        {selectedOperationalLinks.map((link, index) => (
                          <Link key={link.href + link.label} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                            {link.label}
                          </Link>
                        ))}
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
                              disabled={isSaving}
                              onClick={() => void handleInspectionAction(option.status, option.nextAction)}
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
                    title="No inspection selected"
                    description="Choose an inspection to inspect findings, evidence and release posture."
                    primaryAction={{ label: "Stay on quality", href: "/quality" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Register inspection" description="Create a live quality incident directly in the tenant backend.">
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityExample())}>
                    Load demo example
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityPreset("release_ready"))}>
                    Release-ready preset
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityPreset("evidence_gap"))}>
                    Evidence-gap preset
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityPreset("blocked_release"))}>
                    Blocked-release preset
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        projectName: "Proyecto central",
                        areaName: "Frente 1",
                        checklistName: "Inspeccion de calidad",
                        contractorName: "Contratista principal",
                        severity: "major",
                        openFindings: "2",
                        evidenceCompletion: "70",
                        releaseReadiness: "65",
                        reworkRate: "8",
                        status: "in_progress",
                        nextAction: ""
                      })
                    }
                  >
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/document-control">Open document control</Link>
                  <Link className="buttonGhost" href="/compliance">Open compliance</Link>
                </div>
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Project</div>
                    <input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Area</div>
                    <input className="field" value={createForm.areaName} onChange={(event) => setCreateForm((current) => ({ ...current, areaName: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Checklist</div>
                    <input className="field" value={createForm.checklistName} onChange={(event) => setCreateForm((current) => ({ ...current, checklistName: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Contractor</div>
                    <input className="field" value={createForm.contractorName} onChange={(event) => setCreateForm((current) => ({ ...current, contractorName: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Severity</div>
                    <select className="selectField" value={createForm.severity} onChange={(event) => setCreateForm((current) => ({ ...current, severity: event.target.value as QualityInspectionContract["severity"] }))}>
                      <option value="minor">minor</option>
                      <option value="major">major</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Status</div>
                    <select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as QualityInspectionContract["status"] }))}>
                      <option value="scheduled">scheduled</option>
                      <option value="in_progress">in_progress</option>
                      <option value="pending_release">pending_release</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Open findings</div>
                    <input className="field" type="number" min="0" value={createForm.openFindings} onChange={(event) => setCreateForm((current) => ({ ...current, openFindings: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Evidence %</div>
                    <input className="field" type="number" min="0" max="100" value={createForm.evidenceCompletion} onChange={(event) => setCreateForm((current) => ({ ...current, evidenceCompletion: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Release %</div>
                    <input className="field" type="number" min="0" max="100" value={createForm.releaseReadiness} onChange={(event) => setCreateForm((current) => ({ ...current, releaseReadiness: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Rework %</div>
                    <input className="field" type="number" min="0" value={createForm.reworkRate} onChange={(event) => setCreateForm((current) => ({ ...current, reworkRate: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder="Describe the correction or release action required" />
                  </label>
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createInspectionGate.tone}>{createInspectionGate.label}</Badge>
                        <span>{createInspectionGate.summary}</span>
                      </div>
                      {createInspectionGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{createInspectionHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Immediate downstream</div>
                    <div className="tableCellStack">
                      <span>{createInspectionDestination.description}</span>
                      <span className="tableCellMuted">The quality lane should move immediately into the real correction or release domain, not stop at registration.</span>
                    </div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateInspection()}>
                    {isCreating ? "Saving..." : "Add inspection"}
                  </button>
                  <Link className="buttonGhost" href={createInspectionDestination.href}>
                    {createInspectionDestination.label}
                  </Link>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Quality risks and blockers" description="Issues still blocking release, correction or quality closure.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Release gate</div><div>`pending_release` requires at most 3 findings and at least 85% evidence.</div></div>
                  <div className="detailRow"><div className="detailLabel">Final closure</div><div>Release should not be treated as real while findings remain open or readiness stays below 90%.</div></div>
                  <div className="detailRow"><div className="detailLabel">Execution bridge</div><div>This lane should move together with field correction, equipment readiness and document evidence, not in isolation.</div></div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <DataTable
                    rows={selectedRisks.length > 0 ? selectedRisks : filteredRisks}
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
                </div>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="Quality overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open field", href: "/field" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading quality overview" : "Quality overview not loaded yet"}
            description={
              !session.accessToken
                ? "This route should load demo or live quality data so release walkthroughs can be tested end to end."
                : "This route expects the live quality response for the active tenant."
            }
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}

export default function QualityPage() {
  return (
    <Suspense fallback={null}>
      <QualityPageContent />
    </Suspense>
  );
}
