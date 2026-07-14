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

function QualityPageContent() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
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

  useEffect(() => {
    const project = searchParams.get("project");
    const area = searchParams.get("area");
    setProjectFilter(project && project.length > 0 ? project : "all");
    setAreaFilter(area && area.length > 0 ? area : "all");
  }, [searchParams]);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

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
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

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

  useEffect(() => {
    setNextActionDraft(selectedInspection?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedInspectionId, selectedInspection?.id, selectedInspection?.nextAction]);

  async function handleInspectionAction(status: QualityInspectionContract["status"], suggestedNextAction: string) {
    if (!selectedInspection || !session.accessToken) {
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
    if (!overview || !session.accessToken) {
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
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
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
                        <Link className="buttonGhost" href="/document-control">Open document control</Link>
                        <Link className="buttonGhost" href="/field">Open field</Link>
                        <Link className="buttonGhost" href="/equipment">Open equipment</Link>
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
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateInspection()}>
                    {isCreating ? "Saving..." : "Add inspection"}
                  </button>
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
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading quality overview" : "Quality overview not loaded yet"}
            description="This route now expects a live backend quality response for the active tenant."
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
