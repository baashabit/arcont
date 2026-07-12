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
import type { CrmLeadBucketContract, CrmOverviewContract } from "@/lib/contracts";
import { fetchCrmOverview, updateCrmLeadBucket } from "@/lib/platform-api";

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

export default function CrmPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<CrmOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
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

    void fetchCrmOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("CRM overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedBucketId((current) => current ?? result.focusBucket?.id ?? result.leadBuckets[0]?.id ?? null);
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

  const selectedBucket = useMemo(
    () => overview?.leadBuckets.find((bucket) => bucket.id === selectedBucketId) ?? overview?.focusBucket ?? null,
    [overview, selectedBucketId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.leadBucketId === selectedBucket?.id) ?? [],
    [overview, selectedBucket]
  );

  const actionOptions = useMemo(() => (selectedBucket ? crmActionOptions(selectedBucket) : []), [selectedBucket]);

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
                value={String(overview.summary.qualifiedLeads)}
                footnote="Active opportunities ready for advisor, broker or closer action."
              />
              <KpiCard
                label="Visit conversion"
                value={`${overview.summary.visitConversion}%`}
                footnote="Average conversion signal across the current sales buckets."
              />
              <KpiCard
                label="Reservations"
                value={String(overview.summary.reservations)}
                footnote="Reservations now competing for inventory and documentation bandwidth."
              />
              <KpiCard
                label="Forecast revenue"
                value={`MXN ${overview.summary.forecastRevenue.toLocaleString()}`}
                footnote="Commercial revenue forecast tied to the active tenant pipeline."
              />
            </section>

            <section className="grid cols2">
              <Card title="Commercial board" description="Live project demand, conversion and reservation pressure.">
                <FilterBar summary={`${overview.leadBuckets.length} commercial buckets in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "crm ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.leadBuckets}
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
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedBucket.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Healthy requires conversion of at least 20%.</span>
                        <span className="tableCellMuted">Healthy also requires at least 10 reservations in the bucket.</span>
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
                              disabled={isSaving}
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
