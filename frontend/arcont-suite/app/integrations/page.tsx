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
import type { IntegrationOverviewContract, IntegrationStreamContract } from "@/lib/contracts";
import { fetchIntegrationOverview } from "@/lib/platform-api";

function healthTone(health: IntegrationStreamContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function IntegrationsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<IntegrationOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchIntegrationOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Integration overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedStreamId((current) => current ?? result.focusStream?.id ?? result.streams[0]?.id ?? null);
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

  const selectedStream = useMemo(
    () => overview?.streams.find((item) => item.id === selectedStreamId) ?? overview?.focusStream ?? null,
    [overview, selectedStreamId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.streamId === selectedStream?.id) ?? [],
    [overview, selectedStream]
  );

  return (
    <AppShell
      title="Integrations, telemetry and AI"
      eyebrow="Connected operations"
      description="BIM, IoT, RTK drones and external connectivity represented as live operational streams."
    >
      <ModuleGate
        moduleKeys={["integrations.field-data"]}
        requiredPermissions={["integrations:*"]}
        title="Integrations"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Live streams"
                value={String(overview.summary.liveStreams)}
                footnote="Connected BIM, telemetry and field-data streams active in the current tenant."
              />
              <KpiCard
                label="Critical alerts"
                value={String(overview.summary.criticalAlerts)}
                footnote="Alerts currently concentrated in the highest-risk connected streams."
              />
              <KpiCard
                label="Automation coverage"
                value={`${overview.summary.averageCoverage}%`}
                footnote="Current coverage of useful automations and structured signal routing."
              />
              <KpiCard
                label="Linked assets"
                value={String(overview.summary.linkedAssets)}
                footnote="Assets, model objects or field elements already tied into the connected stack."
              />
            </section>

            <section className="grid cols2">
              <Card title="Connected stack" description="Live stream health across BIM, telemetry, drones and remote site connectivity.">
                <FilterBar summary={`${overview.streams.length} integration streams in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "integrations ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.streams}
                  columns={[
                    {
                      key: "stream",
                      label: "Stream",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedStreamId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.streamName}</strong>
                            <span className="tableCellMuted">{row.provider} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "domain",
                      label: "Domain",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.domain}</strong>
                          <span className="tableCellMuted">{row.linkedAssets} linked assets</span>
                        </div>
                      )
                    },
                    {
                      key: "signal",
                      label: "Signal",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.openAlerts} alerts</strong>
                          <span className="tableCellMuted">{row.freshnessMinutes} min freshness</span>
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
                title="Selected stream"
                description="Focused context for the stream currently carrying the most operational attention."
                aside={selectedStream ? <Badge tone={healthTone(selectedStream.health)}>{selectedStream.health}</Badge> : null}
              >
                {selectedStream ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Provider</div>
                      <div>{selectedStream.provider}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Domain</div>
                      <div>{selectedStream.domain}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Freshness</div>
                      <div>{selectedStream.freshnessMinutes} minutes</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Automation coverage</div>
                      <div>{selectedStream.automationCoverage}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>{selectedStream.nextAction}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedStream.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No integration stream selected"
                    description="Choose a stream to inspect the active operational signal and the next action."
                    primaryAction={{ label: "Stay on integrations", href: "/integrations" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Integration risks and blockers" description="Issues affecting connected field data, BIM continuity and remote telemetry.">
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
            title="Integration overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading integration overview" : "Integration overview not loaded yet"}
            description="This route now expects a live backend integration response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
