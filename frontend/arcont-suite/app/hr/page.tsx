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
import type { HrOverviewContract, HrWorkforceItemContract } from "@/lib/contracts";
import { fetchHrOverview, updateHrWorkforceItem } from "@/lib/platform-api";

function safetyTone(status: HrWorkforceItemContract["safetyStatus"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function workforceActionOptions(item: HrWorkforceItemContract) {
  switch (item.safetyStatus) {
    case "critical":
      return [
        {
          label: "Move to watch",
          safetyStatus: "watch" as const,
          nextAction: "Stabilize attendance and compliance gaps before returning to controlled posture."
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate to critical",
          safetyStatus: "critical" as const,
          nextAction: "Escalate due to unresolved field risk or contractor non-compliance."
        },
        {
          label: "Mark controlled",
          safetyStatus: "controlled" as const,
          nextAction: "Keep workforce steady and sustain the compliance and safety controls in place."
        }
      ];
    case "controlled":
      return [
        {
          label: "Move to watch",
          safetyStatus: "watch" as const,
          nextAction: "Open monitoring due to early signs of attendance or compliance drift."
        }
      ];
    default:
      return [];
  }
}

export default function HrPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<HrOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkforceId, setSelectedWorkforceId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | HrWorkforceItemContract["safetyStatus"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchHrOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("HR overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedWorkforceId((current) => current ?? result.focusWorkforce?.id ?? result.workforces[0]?.id ?? null);
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

  const filteredWorkforces = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.workforces.filter((item) => {
      const matchesHealth = healthFilter === "all" || item.safetyStatus === healthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.contractorName.toLowerCase().includes(normalizedSearch) ||
        item.frontName.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesSearch;
    });
  }, [healthFilter, overview, searchFilter]);

  const filteredSummary = useMemo(() => {
    const activeHeadcount = filteredWorkforces.reduce((sum, item) => sum + item.activeHeadcount, 0);
    const attendanceRate =
      filteredWorkforces.length > 0
        ? Number((filteredWorkforces.reduce((sum, item) => sum + item.attendanceRate, 0) / filteredWorkforces.length).toFixed(1))
        : 0;
    const openIncidents = filteredWorkforces.reduce((sum, item) => sum + item.incidentCount, 0);

    return {
      activeHeadcount,
      activeContractors: filteredWorkforces.length,
      attendanceRate,
      openIncidents
    };
  }, [filteredWorkforces]);

  const selectedWorkforce = useMemo(
    () => filteredWorkforces.find((item) => item.id === selectedWorkforceId) ?? filteredWorkforces[0] ?? null,
    [filteredWorkforces, selectedWorkforceId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.workforceId === selectedWorkforce?.id) ?? [],
    [overview, selectedWorkforce]
  );

  const actionOptions = useMemo(
    () => (selectedWorkforce ? workforceActionOptions(selectedWorkforce) : []),
    [selectedWorkforce]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredWorkforces.length === 0) {
      setSelectedWorkforceId(null);
      return;
    }

    const isSelectedVisible = filteredWorkforces.some((item) => item.id === selectedWorkforceId);
    if (!isSelectedVisible) {
      setSelectedWorkforceId(filteredWorkforces[0]?.id ?? null);
    }
  }, [filteredWorkforces, overview, selectedWorkforceId]);

  useEffect(() => {
    setNextActionDraft(selectedWorkforce?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedWorkforceId, selectedWorkforce?.id, selectedWorkforce?.nextAction]);

  async function handleWorkforceAction(
    safetyStatus: HrWorkforceItemContract["safetyStatus"],
    suggestedNextAction: string
  ) {
    if (!selectedWorkforce || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the workforce item.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateHrWorkforceItem(
      selectedWorkforce.id,
      activeCompany.id,
      {
        safetyStatus,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "HR update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const workforces = current.workforces.map((item) => (item.id === response.data?.id ? response.data : item));
      const activeHeadcount = workforces.reduce((sum, item) => sum + item.activeHeadcount, 0);
      const attendanceRate =
        workforces.length > 0 ? Number((workforces.reduce((sum, item) => sum + item.attendanceRate, 0) / workforces.length).toFixed(1)) : 0;
      const openIncidents = workforces.reduce((sum, item) => sum + item.incidentCount, 0);

      return {
        ...current,
        summary: {
          activeHeadcount,
          activeContractors: workforces.length,
          attendanceRate,
          openIncidents
        },
        workforces,
        focusWorkforce: current.focusWorkforce?.id === response.data?.id ? response.data : current.focusWorkforce
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Workforce signal moved to ${response.data.safetyStatus}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="HR and workforce"
      eyebrow="Workforce domain"
      description="Crew capacity, contractor readiness and field compliance signals for active construction fronts."
    >
      <ModuleGate moduleKeys={["hr.workforce"]} requiredPermissions={["hr:*"]} title="HR">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Active headcount"
                value={String(filteredSummary.activeHeadcount)}
                footnote="People currently assigned across active contractors and fronts."
              />
              <KpiCard
                label="Active contractors"
                value={String(filteredSummary.activeContractors)}
                footnote="Contractors currently represented in the active workforce board."
              />
              <KpiCard
                label="Attendance rate"
                value={`${filteredSummary.attendanceRate}%`}
                footnote="Attendance signal aggregated from live contractor workforce buckets."
              />
              <KpiCard
                label="Open incidents"
                value={String(filteredSummary.openIncidents)}
                footnote="Field issues affecting continuity, compliance or safety posture."
              />
            </section>

            <section className="grid cols2">
              <Card title="Workforce board" description="Live crew capacity, attendance and contractor operating posture.">
                <FilterBar summary={`${filteredWorkforces.length} workforce buckets in the active tenant`}>
                  <select
                    className="selectField"
                    value={healthFilter}
                    onChange={(event) => setHealthFilter(event.target.value as "all" | HrWorkforceItemContract["safetyStatus"])}
                  >
                    <option value="all">All safety</option>
                    <option value="controlled">controlled</option>
                    <option value="watch">watch</option>
                    <option value="critical">critical</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search contractor, front or code"
                  />
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "workforce ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredWorkforces}
                  columns={[
                    {
                      key: "contractor",
                      label: "Contractor",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedWorkforceId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.contractorName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.frontName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "capacity",
                      label: "Capacity",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.activeHeadcount} people</strong>
                          <span className="tableCellMuted">{row.attendanceRate}% attendance</span>
                        </div>
                      )
                    },
                    {
                      key: "field",
                      label: "Field signal",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.productivityRate}% productivity</strong>
                          <span className="tableCellMuted">{row.incidentCount} incidents</span>
                        </div>
                      )
                    },
                    {
                      key: "safety",
                      label: "Safety",
                      render: (row) => <Badge tone={safetyTone(row.safetyStatus)}>{row.safetyStatus}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected workforce bucket"
                description="Focused view of the contractor, front and field-control actions that need attention."
                aside={
                  selectedWorkforce ? (
                    <Badge tone={safetyTone(selectedWorkforce.safetyStatus)}>{selectedWorkforce.safetyStatus}</Badge>
                  ) : null
                }
              >
                {selectedWorkforce ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Front</div>
                      <div>{selectedWorkforce.frontName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Attendance</div>
                      <div>{selectedWorkforce.attendanceRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Productivity</div>
                      <div>{selectedWorkforce.productivityRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Compliance expirations</div>
                      <div>{selectedWorkforce.complianceExpirations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next workforce, safety or contractor action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedWorkforce.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Controlled requires zero incidents and zero compliance expirations.</span>
                        <span className="tableCellMuted">Attendance below 85% cannot stay only on watch.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.safetyStatus === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleWorkforceAction(option.safetyStatus, option.nextAction)}
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
                    title="No workforce bucket selected"
                    description="Choose a contractor or front to inspect workforce detail and field actions."
                    primaryAction={{ label: "Stay on HR", href: "/hr" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Workforce risks and blockers" description="Capacity, attendance and compliance issues that can slow active fronts.">
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
        ) : error ? (
          <EmptyState
            title="HR overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading HR overview" : "HR overview not loaded yet"}
            description="This route now expects a live backend HR response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
