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
import type { CrmLeadBucketContract, CrmOverviewContract } from "@/lib/contracts";
import {
  fetchCashFlowOverview,
  fetchCrmOverview,
  fetchEstimationCollectionOverview,
  updateCrmLeadBucket
} from "@/lib/platform-api";

function healthTone(health: CrmLeadBucketContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function crmActionOptions(bucket: CrmLeadBucketContract) {
  switch (bucket.health) {
    case "critical":
      return [
        {
          label: "Move to watch",
          health: "watch" as const,
          signal: "Risk reduced, but the pipeline still needs active monitoring."
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate to critical",
          health: "critical" as const,
          signal: "Escalate because conversion or closing certainty remains weak."
        },
        {
          label: "Mark healthy",
          health: "healthy" as const,
          signal: "Pipeline traction and reservation signal are back within target."
        }
      ];
    case "healthy":
      return [
        {
          label: "Move to watch",
          health: "watch" as const,
          signal: "Open a watch signal due to early friction in visits or closing."
        }
      ];
    default:
      return [];
  }
}

type CommercialBridgeContext = {
  estimations: NonNullable<Awaited<ReturnType<typeof fetchEstimationCollectionOverview>>>;
  cashFlow: NonNullable<Awaited<ReturnType<typeof fetchCashFlowOverview>>>;
} | null;

function buildCommercialBridge(bucket: CrmLeadBucketContract | null, bridge: CommercialBridgeContext) {
  if (!bucket) {
    return null;
  }

  const linkedLine = bridge?.estimations.lines.find((line) => line.projectName === bucket.projectName) ?? null;
  const linkedCashLine =
    bridge?.cashFlow.lines.find((line) => line.sourceType === "collections") ??
    bridge?.cashFlow.focusLine ??
    null;

  const demandSignal =
    bucket.reservations >= 10
      ? `${bucket.reservations} reservations already justify active delivery and closing readiness.`
      : `${bucket.reservations} reservations still need stronger closing traction before the bucket becomes dependable.`;

  const collectionSignal = linkedLine
    ? `Estimated downstream exposure is MXN ${linkedLine.pendingCollection.toLocaleString()} pending collection and MXN ${linkedLine.pendingToBill.toLocaleString()} pending to bill.`
    : "This bucket still has no mapped estimation and collection bridge.";

  const treasurySignal = linkedCashLine
    ? linkedCashLine.weeklyNet < 0
      ? `Current treasury posture tied to this lane is under pressure with a weekly gap of MXN ${Math.abs(linkedCashLine.weeklyNet).toLocaleString()}.`
      : `Current treasury posture tied to this lane shows a weekly surplus of MXN ${linkedCashLine.weeklyNet.toLocaleString()}.`
    : "Treasury linkage is not yet available for this bucket.";

  return {
    demandSignal,
    collectionSignal,
    treasurySignal
  };
}

export default function CrmPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<CrmOverviewContract | null>(null);
  const [commercialBridge, setCommercialBridge] = useState<CommercialBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | CrmLeadBucketContract["health"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [signalDraft, setSignalDraft] = useState("");
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

    void Promise.all([
      fetchCrmOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchEstimationCollectionOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchCashFlowOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, estimations, cashFlow]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("CRM overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedBucketId((current) => current ?? result.focusBucket?.id ?? result.leadBuckets[0]?.id ?? null);

        setCommercialBridge(
          estimations && cashFlow
            ? {
                estimations,
                cashFlow
              }
            : null
        );
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

  const filteredBuckets = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.leadBuckets.filter((bucket) => {
      const matchesHealth = healthFilter === "all" || bucket.health === healthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        bucket.projectName.toLowerCase().includes(normalizedSearch) ||
        bucket.segment.toLowerCase().includes(normalizedSearch) ||
        bucket.owner.toLowerCase().includes(normalizedSearch) ||
        bucket.signal.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesSearch;
    });
  }, [healthFilter, overview, searchFilter]);

  const filteredSummary = useMemo(() => {
    const qualifiedLeads = filteredBuckets.reduce((sum, bucket) => sum + bucket.openOpportunities, 0);
    const reservations = filteredBuckets.reduce((sum, bucket) => sum + bucket.reservations, 0);
    const forecastRevenue = filteredBuckets.reduce((sum, bucket) => sum + bucket.forecastRevenue, 0);
    const visitConversion =
      filteredBuckets.length > 0
        ? Number((filteredBuckets.reduce((sum, bucket) => sum + bucket.conversionRate, 0) / filteredBuckets.length).toFixed(1))
        : 0;

    return {
      qualifiedLeads,
      visitConversion,
      reservations,
      forecastRevenue
    };
  }, [filteredBuckets]);

  const selectedBucket = useMemo(
    () => filteredBuckets.find((bucket) => bucket.id === selectedBucketId) ?? filteredBuckets[0] ?? null,
    [filteredBuckets, selectedBucketId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.leadBucketId === selectedBucket?.id) ?? [],
    [overview, selectedBucket]
  );

  const selectedStory = useMemo(() => buildCommercialBridge(selectedBucket, commercialBridge), [commercialBridge, selectedBucket]);

  const actionOptions = useMemo(() => (selectedBucket ? crmActionOptions(selectedBucket) : []), [selectedBucket]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredBuckets.length === 0) {
      setSelectedBucketId(null);
      return;
    }

    const isSelectedVisible = filteredBuckets.some((bucket) => bucket.id === selectedBucketId);
    if (!isSelectedVisible) {
      setSelectedBucketId(filteredBuckets[0]?.id ?? null);
    }
  }, [filteredBuckets, overview, selectedBucketId]);

  useEffect(() => {
    setSignalDraft(selectedBucket?.signal ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedBucketId, selectedBucket?.id, selectedBucket?.signal]);

  async function handleBucketAction(
    health: CrmLeadBucketContract["health"],
    suggestedSignal: string
  ) {
    if (!selectedBucket || !session.accessToken) {
      return;
    }

    const signal = signalDraft.trim() || suggestedSignal;
    if (signal.length < 8) {
      setActionError("Commercial signal must be more specific before updating the bucket.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateCrmLeadBucket(
      selectedBucket.id,
      activeCompany.id,
      {
        health,
        signal
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "CRM update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const leadBuckets = current.leadBuckets.map((bucket) => (bucket.id === response.data?.id ? response.data : bucket));
      const qualifiedLeads = leadBuckets.reduce((sum, bucket) => sum + bucket.openOpportunities, 0);
      const reservations = leadBuckets.reduce((sum, bucket) => sum + bucket.reservations, 0);
      const forecastRevenue = leadBuckets.reduce((sum, bucket) => sum + bucket.forecastRevenue, 0);
      const visitConversion =
        leadBuckets.length > 0 ? Number((leadBuckets.reduce((sum, bucket) => sum + bucket.conversionRate, 0) / leadBuckets.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          qualifiedLeads,
          visitConversion,
          reservations,
          forecastRevenue
        },
        leadBuckets,
        focusBucket: current.focusBucket?.id === response.data?.id ? response.data : current.focusBucket
      };
    });

    setSignalDraft(response.data.signal);
    setActionMessage(`CRM bucket moved to ${response.data.health}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Sales and CRM"
      eyebrow="Customer operations"
      description="Lead pressure, reservations and commercial risk signals connected to the active portfolio."
    >
      <ModuleGate moduleKeys={["sales.crm"]} requiredPermissions={["sales:*"]} title="Sales / CRM">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Qualified leads"
                value={String(filteredSummary.qualifiedLeads)}
                footnote="Visible opportunities ready for advisor, broker or closer action."
              />
              <KpiCard
                label="Visit conversion"
                value={`${filteredSummary.visitConversion}%`}
                footnote="Average conversion signal across the visible sales buckets."
              />
              <KpiCard
                label="Reservations"
                value={String(filteredSummary.reservations)}
                footnote="Visible reservations competing for inventory and documentation bandwidth."
              />
              <KpiCard
                label="Forecast revenue"
                value={`MXN ${filteredSummary.forecastRevenue.toLocaleString()}`}
                footnote="Commercial revenue forecast tied to the visible tenant pipeline."
              />
            </section>

            <section className="grid cols2">
              <Card title="Commercial board" description="Live project demand, conversion and reservation pressure.">
                <FilterBar summary={`${filteredBuckets.length} commercial buckets match the current operating filters`}>
                  <label className="fieldLabel">
                    Health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="watch">Watch</option>
                      <option value="healthy">Healthy</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Project, segment, owner or signal"
                    />
                  </label>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "crm ready"}</Badge>
                  <Badge tone={filteredBuckets.some((bucket) => bucket.health === "critical") ? "danger" : filteredBuckets.some((bucket) => bucket.health === "watch") ? "warning" : "success"}>
                    {filteredBuckets.some((bucket) => bucket.health === "critical")
                      ? "critical buckets visible"
                      : filteredBuckets.some((bucket) => bucket.health === "watch")
                        ? "watch buckets visible"
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredBuckets}
                  columns={[
                    {
                      key: "project",
                      label: "Project",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedBucketId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.projectName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.segment}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "pipeline",
                      label: "Pipeline",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.openOpportunities} open</strong>
                          <span className="tableCellMuted">{row.reservations} reservations</span>
                        </div>
                      )
                    },
                    {
                      key: "conversion",
                      label: "Conversion",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.conversionRate}%</strong>
                          <span className="tableCellMuted">MXN {row.forecastRevenue.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.health)}>{row.health}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected commercial bucket"
                description="Focused signal for the active project, segment or housing program."
                aside={selectedBucket ? <Badge tone={healthTone(selectedBucket.health)}>{selectedBucket.health}</Badge> : null}
              >
                {selectedBucket ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Owner</div>
                      <div>{selectedBucket.owner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Segment</div>
                      <div>{selectedBucket.segment}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Open opportunities</div>
                      <div>{selectedBucket.openOpportunities}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Reservations</div>
                      <div>{selectedBucket.reservations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Commercial signal</div>
                      <div>
                        <input
                          className="field"
                          value={signalDraft}
                          onChange={(event) => setSignalDraft(event.target.value)}
                          placeholder="Describe the active commercial signal or blocker"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        <Link className="buttonGhost" href="/estimations">
                          Open estimations
                        </Link>
                        <Link className="buttonGhost" href="/cash-flow">
                          Open cash flow
                        </Link>
                        <Link className="buttonGhost" href="/finance">
                          Open finance
                        </Link>
                        <Link className="buttonGhost" href="/projects">
                          Open projects
                        </Link>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedBucket.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Healthy requires conversion of at least 20%.</span>
                        <span className="tableCellMuted">Healthy also requires at least 10 reservations in the bucket.</span>
                        <span className="tableCellMuted">Healthy now also requires at least MXN 1,000,000 forecast revenue.</span>
                        <span className="tableCellMuted">Watch is blocked when reservations are still below 5.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.health === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.health === "healthy" &&
                                  (selectedBucket.conversionRate < 20 ||
                                    selectedBucket.reservations < 10 ||
                                    selectedBucket.forecastRevenue < 1_000_000)) ||
                                (option.health === "watch" &&
                                  (selectedBucket.conversionRate < 15 || selectedBucket.reservations < 5))
                              }
                              onClick={() => void handleBucketAction(option.health, option.signal)}
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
                    title="No commercial bucket selected"
                    description="Choose a project or program bucket to inspect the active pipeline and blockers."
                    primaryAction={{ label: "Stay on CRM", href: "/crm" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Demand signal" description="What the selected bucket means from a pure commercial standpoint.">
                <p className="sectionText">{selectedStory?.demandSignal ?? "Choose a bucket to inspect demand quality."}</p>
              </Card>
              <Card title="Collection bridge" description="How the selected bucket translates into billing and collection pressure.">
                <p className="sectionText">
                  {selectedStory?.collectionSignal ?? "Choose a bucket to inspect its collection bridge."}
                </p>
              </Card>
              <Card title="Treasury signal" description="Why sales quality already matters for short-term cash posture.">
                <p className="sectionText">
                  {selectedStory?.treasurySignal ?? "Choose a bucket to inspect its treasury signal."}
                </p>
              </Card>
            </section>

            <Card title="CRM risks and blockers" description="Commercial friction impacting visits, approvals, reservations or closing readiness.">
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
            title="CRM overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading CRM overview" : "CRM overview not loaded yet"}
            description="This route now expects a live backend CRM response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
