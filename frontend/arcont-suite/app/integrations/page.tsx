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
import type { IntegrationOverviewContract, IntegrationStreamContract } from "@/lib/contracts";
import { fetchIntegrationOverview, updateIntegrationStream } from "@/lib/platform-api";

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

function buildStreamImpact(stream: IntegrationStreamContract | null, riskCount: number) {
  if (!stream) {
    return null;
  }

  const fieldExposure =
    stream.health === "critical"
      ? "Field capture and operational sync are directly exposed."
      : stream.health === "watch"
        ? "Field execution can continue, but evidence and telemetry may degrade."
        : "The connected flow is supporting normal field execution.";

  const recoveryLane =
    stream.domain === "Connectivity"
      ? "Recover backbone stability and protect offline-first field continuity."
      : stream.domain === "Progress capture"
        ? "Restore drone cadence so project control can trust progress evidence."
        : stream.domain === "Telemetry"
          ? "Normalize live sensor continuity before alert fatigue spreads."
          : "Keep BIM and digital coordination synchronized with downstream consumers.";

  const executiveSignal =
    riskCount > 0
      ? `${riskCount} active blockers remain tied to this stream and need coordinated recovery.`
      : "No explicit blocker is open, but the stream still needs active monitoring.";

  return {
    fieldExposure,
    recoveryLane,
    executiveSignal
  };
}

export default function IntegrationsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<IntegrationOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
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

  const selectedImpact = useMemo(
    () => buildStreamImpact(selectedStream, selectedRisks.length),
    [selectedRisks.length, selectedStream]
  );

  const actionOptions = useMemo(() => {
    if (!selectedStream) {
      return [];
    }

    switch (selectedStream.health) {
      case "healthy":
        return [
          {
            label: "Move to watch",
            health: "watch" as const,
            nextAction: "Investigate the weak signal and coordinate corrective action across connected systems"
          }
        ];
      case "watch":
        return [
          {
            label: "Recover healthy",
            health: "healthy" as const,
            nextAction: "Confirm alerts are closed and freshness is stable before closing the stream"
          },
          {
            label: "Escalate critical",
            health: "critical" as const,
            nextAction: "Escalate the degraded stream and protect downstream field execution immediately"
          }
        ];
      default:
        return [
          {
            label: "Stabilize to watch",
            health: "watch" as const,
            nextAction: "Stabilize the stream and keep remediation active until field sync is dependable"
          }
        ];
    }
  }, [selectedStream]);

  useEffect(() => {
    setNextActionDraft(selectedStream?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedStreamId, selectedStream?.id, selectedStream?.nextAction]);

  async function handleStreamAction(
    health: IntegrationStreamContract["health"],
    suggestedNextAction: string,
    successMessage?: string
  ) {
    if (!selectedStream || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the stream.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateIntegrationStream(
      selectedStream.id,
      activeCompany.id,
      {
        health,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Integration stream update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const streams = current.streams.map((item) => (item.id === response.data?.id ? response.data : item));
      const focusStream =
        streams
          .slice()
          .sort((left, right) => {
            if (left.health === "critical" && right.health !== "critical") {
              return -1;
            }

            if (left.health !== "critical" && right.health === "critical") {
              return 1;
            }

            return right.openAlerts - left.openAlerts;
          })[0] ?? null;
      const averageCoverage =
        streams.length > 0
          ? Number((streams.reduce((sum, item) => sum + item.automationCoverage, 0) / streams.length).toFixed(1))
          : 0;

      return {
        ...current,
        summary: {
          liveStreams: streams.length,
          criticalAlerts: streams
            .filter((item) => item.health === "critical")
            .reduce((sum, item) => sum + item.openAlerts, 0),
          averageCoverage,
          linkedAssets: streams.reduce((sum, item) => sum + item.linkedAssets, 0)
        },
        streams,
        focusStream
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(successMessage ?? `Stream moved to ${response.data.health}.`);
    setIsSaving(false);
  }

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
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next integration recovery or stabilization action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        <Link className="buttonGhost" href="/field">
                          Open field
                        </Link>
                        <Link className="buttonGhost" href="/document-control">
                          Open document control
                        </Link>
                        <Link className="buttonGhost" href="/quality">
                          Open quality
                        </Link>
                        <Link className="buttonGhost" href="/projects">
                          Open projects
                        </Link>
                        <Link className="buttonGhost" href="/copilot">
                          Open copilot
                        </Link>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedStream.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Healthy is blocked while open alerts remain.</span>
                        <span className="tableCellMuted">Healthy is blocked when freshness is above 30 minutes.</span>
                        <span className="tableCellMuted">Healthy now also requires automation coverage of at least 75%.</span>
                        <span className="tableCellMuted">Watch is blocked while alerts stay above 8 or freshness stays above 120 minutes.</span>
                        <span className="tableCellMuted">Health transitions move one step at a time.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          <button
                            className="button"
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void handleStreamAction(
                                selectedStream.health,
                                selectedStream.nextAction,
                                "Next action updated."
                              )
                            }
                          >
                            {isSaving ? "Saving..." : "Save next action"}
                          </button>
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.health === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.health === "healthy" &&
                                  (selectedStream.openAlerts > 0 ||
                                    selectedStream.freshnessMinutes > 30 ||
                                    selectedStream.automationCoverage < 75)) ||
                                (option.health === "watch" &&
                                  (selectedStream.openAlerts > 8 || selectedStream.freshnessMinutes > 120))
                              }
                              onClick={() => void handleStreamAction(option.health, option.nextAction)}
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
                    title="No integration stream selected"
                    description="Choose a stream to inspect the active operational signal and the next action."
                    primaryAction={{ label: "Stay on integrations", href: "/integrations" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Field exposure" description="What this stream means for crews and mobile execution right now.">
                <p className="sectionText">
                  {selectedImpact?.fieldExposure ?? "Choose a stream to inspect downstream field exposure."}
                </p>
              </Card>

              <Card title="Recovery lane" description="Operational playbook to stabilize the selected connected workflow.">
                <p className="sectionText">
                  {selectedImpact?.recoveryLane ?? "Choose a stream to inspect the recovery path."}
                </p>
              </Card>

              <Card title="Executive signal" description="How the selected stream should be escalated in operating reviews.">
                <p className="sectionText">
                  {selectedImpact?.executiveSignal ?? "Choose a stream to inspect the executive escalation signal."}
                </p>
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
