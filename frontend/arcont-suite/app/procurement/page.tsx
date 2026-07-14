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
import type { ProcurementOverviewContract, ProcurementPackageContract } from "@/lib/contracts";
import { fetchProcurementOverview, updateProcurementPackage } from "@/lib/platform-api";

function statusTone(status: ProcurementPackageContract["status"]) {
  switch (status) {
    case "awarded":
      return "success";
    case "blocked":
      return "danger";
    case "awaiting_approval":
      return "warning";
    case "sourcing":
      return "info";
    default:
      return "gold";
  }
}

function procurementActionOptions(procurementPackage: ProcurementPackageContract) {
  switch (procurementPackage.status) {
    case "blocked":
      return [
        {
          label: "Resume sourcing",
          status: "sourcing" as const,
          nextAction: "Resume supplier engagement and close the pending technical gap"
        }
      ];
    case "draft":
      return [
        {
          label: "Start sourcing",
          status: "sourcing" as const,
          nextAction: "Launch RFQ and open supplier outreach for this package"
        }
      ];
    case "sourcing":
      return [
        {
          label: "Send to approval",
          status: "awaiting_approval" as const,
          nextAction: "Freeze comparison sheet and route approval package to decision makers"
        },
        {
          label: "Block package",
          status: "blocked" as const,
          nextAction: "Pause package and escalate the supplier or technical blocker"
        }
      ];
    case "awaiting_approval":
      return [
        {
          label: "Return to sourcing",
          status: "sourcing" as const,
          nextAction: "Reopen supplier comparison and refresh pricing coverage"
        },
        {
          label: "Award package",
          status: "awarded" as const,
          nextAction: "Issue award notice and align the first execution milestone"
        },
        {
          label: "Block approval",
          status: "blocked" as const,
          nextAction: "Stop approval route and document the blocker for resolution"
        }
      ];
    default:
      return [];
  }
}

export default function ProcurementPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ProcurementOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ProcurementPackageContract["status"]>("all");
  const [strategicFilter, setStrategicFilter] = useState<"all" | "strategic" | "standard">("all");
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

    void fetchProcurementOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Procurement overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedPackageId((current) => current ?? result.focusPackage?.id ?? result.packages[0]?.id ?? null);
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

  const filteredPackages = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.packages.filter((procurementPackage) => {
      const matchesStatus = statusFilter === "all" || procurementPackage.status === statusFilter;
      const matchesStrategic =
        strategicFilter === "all" ||
        (strategicFilter === "strategic" && procurementPackage.strategic) ||
        (strategicFilter === "standard" && !procurementPackage.strategic);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        procurementPackage.packageName.toLowerCase().includes(normalizedSearch) ||
        procurementPackage.code.toLowerCase().includes(normalizedSearch) ||
        procurementPackage.projectName.toLowerCase().includes(normalizedSearch) ||
        procurementPackage.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesStrategic && matchesSearch;
    });
  }, [overview, searchFilter, statusFilter, strategicFilter]);

  const filteredSummary = useMemo(() => {
    const openPackages = filteredPackages.filter((item) => item.status !== "awarded");
    const averageApprovalHours =
      openPackages.length > 0
        ? Number((openPackages.reduce((sum, item) => sum + item.approvalHours, 0) / openPackages.length).toFixed(1))
        : 0;
    const averageBidCount =
      filteredPackages.length > 0
        ? Number((filteredPackages.reduce((sum, item) => sum + item.bidCount, 0) / filteredPackages.length).toFixed(1))
        : 0;

    return {
      openRequisitions: openPackages.length,
      averageApprovalHours,
      strategicPackages: filteredPackages.filter((item) => item.strategic).length,
      averageBidCount
    };
  }, [filteredPackages]);

  const selectedPackage = useMemo(
    () => filteredPackages.find((item) => item.id === selectedPackageId) ?? filteredPackages[0] ?? null,
    [filteredPackages, selectedPackageId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.packageId === selectedPackage?.id) ?? [],
    [overview, selectedPackage]
  );

  const actionOptions = useMemo(
    () => (selectedPackage ? procurementActionOptions(selectedPackage) : []),
    [selectedPackage]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredPackages.length === 0) {
      setSelectedPackageId(null);
      return;
    }

    const isSelectedVisible = filteredPackages.some((procurementPackage) => procurementPackage.id === selectedPackageId);
    if (!isSelectedVisible) {
      setSelectedPackageId(filteredPackages[0]?.id ?? null);
    }
  }, [filteredPackages, overview, selectedPackageId]);

  useEffect(() => {
    setNextActionDraft(selectedPackage?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedPackageId, selectedPackage?.id, selectedPackage?.nextAction]);

  async function handlePackageAction(status: ProcurementPackageContract["status"], suggestedNextAction: string) {
    if (!selectedPackage || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the package.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateProcurementPackage(
      selectedPackage.id,
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
      setActionError(response.error?.message ?? "Package update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const packages = current.packages.map((item) => (item.id === response.data?.id ? response.data : item));
      const openPackages = packages.filter((item) => item.status !== "awarded");
      const averageApprovalHours =
        openPackages.length > 0
          ? Number((openPackages.reduce((sum, item) => sum + item.approvalHours, 0) / openPackages.length).toFixed(1))
          : 0;
      const averageBidCount =
        packages.length > 0 ? Number((packages.reduce((sum, item) => sum + item.bidCount, 0) / packages.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          openRequisitions: openPackages.length,
          averageApprovalHours,
          strategicPackages: packages.filter((item) => item.strategic).length,
          averageBidCount
        },
        packages,
        focusPackage: current.focusPackage?.id === response.data?.id ? response.data : current.focusPackage
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Package moved to ${response.data.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Procurement"
      eyebrow="Execution domain"
      description="Spend control, sourcing throughput and approval posture for construction-heavy buying cycles."
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title="Procurement">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open requisitions"
                value={String(filteredSummary.openRequisitions)}
                footnote="Visible buying pressure still moving through sourcing or approvals."
              />
              <KpiCard
                label="Avg approval time"
                value={`${filteredSummary.averageApprovalHours}h`}
                footnote="Current cycle time for visible open packages."
              />
              <KpiCard
                label="Strategic packages"
                value={String(filteredSummary.strategicPackages)}
                footnote="Visible packages large enough to require director-level attention."
              />
              <KpiCard
                label="Supplier contention"
                value={`${filteredSummary.averageBidCount}`}
                footnote="Average bid competition across the visible procurement flow."
              />
            </section>

            <section className="grid cols2">
              <Card title="Sourcing board" description="Live packages, budget pressure and award readiness.">
                <FilterBar summary={`${filteredPackages.length} packages match the current operating filters`}>
                  <label className="fieldLabel">
                    Status
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">All</option>
                      <option value="draft">Draft</option>
                      <option value="sourcing">Sourcing</option>
                      <option value="awaiting_approval">Awaiting approval</option>
                      <option value="blocked">Blocked</option>
                      <option value="awarded">Awarded</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Scope
                    <select className="field" value={strategicFilter} onChange={(event) => setStrategicFilter(event.target.value as typeof strategicFilter)}>
                      <option value="all">All</option>
                      <option value="strategic">Strategic</option>
                      <option value="standard">Standard</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Package, code, project or next action"
                    />
                  </label>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "board ready"}</Badge>
                  <Badge tone={filteredPackages.some((item) => item.status === "blocked") ? "danger" : filteredSummary.strategicPackages > 0 ? "warning" : "success"}>
                    {filteredPackages.some((item) => item.status === "blocked")
                      ? "blocked packages visible"
                      : filteredSummary.strategicPackages > 0
                        ? `${filteredSummary.strategicPackages} strategic`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredPackages}
                  columns={[
                    {
                      key: "package",
                      label: "Package",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedPackageId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.packageName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.projectName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "budget",
                      label: "Budget",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.budgetAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">{row.bidCount} bids</span>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    },
                    {
                      key: "action",
                      label: "Next action",
                      render: (row) => row.nextAction
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected package"
                description="Commercial, sourcing and approval context for the focused package."
                aside={selectedPackage ? <Badge tone={statusTone(selectedPackage.status)}>{selectedPackage.status}</Badge> : null}
              >
                {selectedPackage ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Buyer</div>
                      <div>{selectedPackage.buyer}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div>{selectedPackage.projectName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Approval cycle</div>
                      <div>{selectedPackage.approvalHours} hours</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Competition</div>
                      <div>{selectedPackage.supplierContention} suppliers competing</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Strategic</div>
                      <div>{selectedPackage.strategic ? "Yes" : "No"}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next procurement move or blocker resolution"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedPackage.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Approval requires at least 2 bids on the package.</span>
                        <span className="tableCellMuted">Award blocks strategic packages with stale approvals over 48 hours.</span>
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
                              onClick={() => void handlePackageAction(option.status, option.nextAction)}
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
                    title="No package selected"
                    description="Choose a package from the sourcing board to inspect detail and blockers."
                    primaryAction={{ label: "Stay on procurement", href: "/procurement" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Supply risks and blockers" description="Packages under approval, supplier or execution pressure.">
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
            title="Procurement overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading procurement overview" : "Procurement overview not loaded yet"}
            description="This route now expects a live backend procurement response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
