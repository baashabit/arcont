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

function buildCrmWorkflow(bucket: CrmLeadBucketContract | null) {
  if (!bucket) {
    return "Use CRM as the commercial origin that should already explain downstream collection and cash-flow pressure.";
  }

  if (bucket.health === "critical") {
    return "A critical commercial bucket should trigger immediate review across collections, cash flow and project readiness before revenue is treated as dependable.";
  }

  if (bucket.health === "watch") {
    return "A watch bucket should be stabilized before reservations and projected cash are used as operating assumptions.";
  }

  return "A healthy bucket should still stay connected to collections, finance and project delivery readiness.";
}

function buildCrmContinuationGate(bucket: CrmLeadBucketContract | null) {
  if (!bucket) {
    return {
      tone: "info" as const,
      label: "No bucket selected",
      summary: "Choose a commercial bucket to verify whether demand is really stable enough to support downstream planning.",
      checks: ["Select a bucket from the active commercial board."]
    };
  }

  const checks: string[] = [];

  if (bucket.health === "critical") {
    checks.push("Bucket is already in critical commercial posture.");
  }

  if (bucket.conversionRate < 20) {
    checks.push(`Conversion is only ${bucket.conversionRate}%.`);
  }

  if (bucket.reservations < 10) {
    checks.push(`${bucket.reservations} reservation(s) still leave the lane below stable demand threshold.`);
  }

  if (bucket.forecastRevenue < 1_000_000) {
    checks.push(`Forecast revenue is only MXN ${bucket.forecastRevenue.toLocaleString()}.`);
  }

  if (bucket.openOpportunities < 5) {
    checks.push(`${bucket.openOpportunities} open opportunity(ies) still leave the bucket with a thin pipeline.`);
  }

  if (checks.length > 0) {
    return {
      tone: bucket.health === "critical" || bucket.reservations < 5 || bucket.conversionRate < 15 ? "danger" as const : "warning" as const,
      label: bucket.health === "critical" || bucket.reservations < 5 || bucket.conversionRate < 15 ? "Do not trust yet" : "Continue with control",
      summary:
        bucket.health === "critical" || bucket.reservations < 5 || bucket.conversionRate < 15
          ? "This bucket still carries hard commercial weakness before finance or delivery should trust it."
          : "The bucket can continue, but conversion, reservations or forecast still need tighter commercial control.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for continuity",
    summary: "Demand, reservations and forecast posture are aligned for controlled downstream planning.",
    checks: [
      "Continue into estimations, finance or projects without rebuilding the same commercial context.",
      "Keep the same owner and active signal attached while the commercial window is still current."
    ]
  };
}

function buildCrmHumanStep(bucket: CrmLeadBucketContract | null) {
  if (!bucket) {
    return "Select a bucket to identify the next human move.";
  }

  if (bucket.health === "critical") {
    return "Escalate the commercial owner now and recover visits, closing certainty or reservation traction before using this lane in downstream assumptions.";
  }

  if (bucket.reservations < 10 || bucket.conversionRate < 20) {
    return "Push the next commercial conversion action, secure more reservations and re-check the finance bridge in the same cycle.";
  }

  if (bucket.forecastRevenue < 1_000_000) {
    return "Protect forecast quality before handing this lane to finance or project planning as a dependable signal.";
  }

  return "Confirm the next downstream jump and keep collections, cash flow and project readiness aligned while traction is still fresh.";
}

function buildCrmWhyNow(bucket: CrmLeadBucketContract | null) {
  if (!bucket) {
    return "Select a commercial bucket to understand why it deserves attention right now.";
  }

  if (bucket.health === "critical") {
    return "The bucket is already critical, so delay here can contaminate collections, forecast and project assumptions immediately.";
  }

  if (bucket.reservations < 10) {
    return "Reservation traction is still weak, so this lane should not be treated as dependable demand yet.";
  }

  if (bucket.conversionRate < 20) {
    return "Conversion is below the stable threshold, so the next downstream promise is weaker than the pipeline headline suggests.";
  }

  return "The lane looks commercially stable enough to keep moving, but it still needs an explicit downstream handoff while traction is current.";
}

function buildCrmDownstreamEffect(bucket: CrmLeadBucketContract | null) {
  if (!bucket) {
    return "Select a commercial bucket to inspect what downstream lane will absorb the impact.";
  }

  if (bucket.health === "critical") {
    return "The downstream effect is weaker collections, more treasury uncertainty and lower confidence when projects or delivery plan around this demand.";
  }

  if (bucket.reservations < 10 || bucket.conversionRate < 20) {
    return "Weak commercial traction here can distort estimations, cash flow and project-readiness decisions before the portfolio notices.";
  }

  return "The downstream effect is mostly continuity alignment: keep estimations, finance and projects using the same commercial reality.";
}

function buildCrmReportBack(bucket: CrmLeadBucketContract | null) {
  if (!bucket) {
    return "Select a commercial bucket to define the next report-back window.";
  }

  if (bucket.health === "critical") {
    return "Report back before the next commercial cutoff with owner confirmation and evidence that conversion or reservations actually recovered.";
  }

  if (bucket.reservations < 10 || bucket.conversionRate < 20) {
    return "Report back in the same operating cycle once the next conversion action and reservation movement are explicit.";
  }

  return "Report back at the next commercial rhythm check confirming the lane stayed coherent through collections, finance and project planning.";
}

function buildCrmOperationalLinks(bucket: CrmLeadBucketContract | null) {
  if (!bucket) {
    return [
      { label: "Open estimations", href: "/estimations" },
      { label: "Open cash flow", href: "/cash-flow" },
      { label: "Open finance", href: "/finance" }
    ];
  }

  if (bucket.health === "critical") {
    return [
      { label: "Open estimations", href: "/estimations" },
      { label: "Open cash flow", href: "/cash-flow" },
      { label: "Open projects", href: "/projects" }
    ];
  }

  if (bucket.reservations < 10 || bucket.conversionRate < 20) {
    return [
      { label: "Open estimations", href: "/estimations" },
      { label: "Open finance", href: "/finance" },
      { label: "Open projects", href: "/projects" }
    ];
  }

  return [
    { label: "Open projects", href: "/projects" },
    { label: "Open finance", href: "/finance" },
    { label: "Open post-sale", href: "/post-sale" }
  ];
}

export default function CrmPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.accessToken;
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

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
  const selectedContinuationGate = useMemo(() => buildCrmContinuationGate(selectedBucket), [selectedBucket]);
  const selectedHumanStep = useMemo(() => buildCrmHumanStep(selectedBucket), [selectedBucket]);
  const selectedWhyNow = useMemo(() => buildCrmWhyNow(selectedBucket), [selectedBucket]);
  const selectedDownstreamEffect = useMemo(() => buildCrmDownstreamEffect(selectedBucket), [selectedBucket]);
  const selectedReportBack = useMemo(() => buildCrmReportBack(selectedBucket), [selectedBucket]);
  const selectedOperationalLinks = useMemo(() => buildCrmOperationalLinks(selectedBucket), [selectedBucket]);

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
    if (!selectedBucket) {
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

            <section className="grid cols1">
              <Card
                title="Commercial workflow"
                description="This route should already be usable for human validation, even before the live tenant backend is connected."
              >
                <p className="sectionText">
                  Use the board to filter buckets, open one commercial lane, rewrite the active signal and move it between
                  `critical`, `watch` and `healthy`. The linked shortcuts connect the commercial queue to estimations,
                  cash-flow and finance so the operator can understand downstream impact without leaving the operating flow.
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Commercial continuity"
                description="CRM should be the first layer of the customer chain, not a disconnected sales board."
                aside={<Badge tone={filteredBuckets.some((bucket) => bucket.health === "critical") ? "danger" : filteredBuckets.some((bucket) => bucket.health === "watch") ? "warning" : "success"}>{filteredBuckets.some((bucket) => bucket.health === "critical") ? "critical pipeline" : filteredBuckets.some((bucket) => bucket.health === "watch") ? "watch pipeline" : "stable pipeline"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Current route</div><div>{buildCrmWorkflow(selectedBucket)}</div></div>
                  <div className="detailRow"><div className="detailLabel">Commercial use</div><div>Use this view to decide whether demand is strong enough to support collection, treasury and delivery assumptions.</div></div>
                  <div className="detailRow"><div className="detailLabel">Expected jump</div><div>Move into estimations, cash flow, finance or projects depending on where the customer chain actually becomes fragile.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/estimations">Open estimations</Link>
                  <Link className="buttonGhost" href="/cash-flow">Open cash flow</Link>
                  <Link className="buttonGhost" href="/finance">Open finance</Link>
                  <Link className="buttonGhost" href="/post-sale">Open post-sale</Link>
                </div>
              </Card>
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
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? `demo mode · ${source}` : "live backend"}
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
                      <div className="detailLabel">Continuation gate</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={selectedContinuationGate.tone}>{selectedContinuationGate.label}</Badge>
                          <span>{selectedContinuationGate.summary}</span>
                        </div>
                        {selectedContinuationGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">{check}</span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{selectedHumanStep}</div>
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
                      <div className="detailLabel">Report back</div>
                      <div>{selectedReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        {selectedOperationalLinks.map((link) => (
                          <Link key={`${link.href}-${link.label}`} className="buttonGhost" href={link.href}>
                            {link.label}
                          </Link>
                        ))}
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
            secondaryAction={{ label: "Open estimations", href: "/estimations" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading CRM overview" : "CRM overview not loaded yet"}
            description={
              isDemoMode
                ? "This route should load demo CRM data for the active company so commercial teams can validate the workflow."
                : "This route expects the live CRM backend for the active tenant."
            }
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
