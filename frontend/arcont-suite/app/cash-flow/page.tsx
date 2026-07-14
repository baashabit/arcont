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
import type { CashFlowLineContract, CashFlowOverviewContract } from "@/lib/contracts";
import {
  fetchAccountsPayableOverview,
  fetchCashFlowOverview,
  fetchSupplierMasterOverview,
  fetchTreasuryPaymentRunsOverview,
  updateCashFlowLine
} from "@/lib/platform-api";

function healthTone(status: CashFlowLineContract["health"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function lineActionOptions(line: CashFlowLineContract) {
  switch (line.health) {
    case "critical":
      return [
        {
          label: "Move to watch",
          health: "watch" as const,
          nextAction: "Contain the short-term gap and keep treasury monitoring active while backlog clears"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          health: "critical" as const,
          nextAction: "Escalate the stream because short-term liquidity pressure remains unresolved"
        },
        {
          label: "Mark controlled",
          health: "controlled" as const,
          nextAction: "Collections, payables and evidence now support a stable weekly cash outlook"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          health: "watch" as const,
          nextAction: "Monitor this stream before treasury drift impacts the next disbursement cycle"
        }
      ];
  }
}

function recomputeSummary(lines: CashFlowLineContract[]) {
  return {
    trackedStreams: lines.length,
    projectedInflows: lines.reduce((sum, item) => sum + item.projectedInflows, 0),
    projectedOutflows: lines.reduce((sum, item) => sum + item.projectedOutflows, 0),
    weeklyNet: lines.reduce((sum, item) => sum + item.weeklyNet, 0),
    criticalStreams: lines.filter((item) => item.health === "critical").length,
    averageConfidence:
      lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.confidencePercent, 0) / lines.length).toFixed(1)) : 0
  };
}

function pickFocusLine(lines: CashFlowLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.health === "critical" && right.health !== "critical") {
          return -1;
        }

        if (left.health !== "critical" && right.health === "critical") {
          return 1;
        }

        return left.weeklyNet - right.weeklyNet;
      })[0] ?? null
  );
}

function buildCashFlowStory(line: CashFlowLineContract | null, riskCount: number) {
  if (!line) {
    return null;
  }

  return {
    liquiditySignal:
      line.weeklyNet < 0
        ? `This stream is projecting a weekly gap of MXN ${Math.abs(line.weeklyNet).toLocaleString()}.`
        : `This stream is projecting a weekly surplus of MXN ${line.weeklyNet.toLocaleString()}.`,
    confidenceSignal:
      line.confidencePercent < 75
        ? `Projection confidence is only ${line.confidencePercent}%, so treasury should treat this stream as volatile.`
        : `Projection confidence is ${line.confidencePercent}%, which is usable for weekly treasury sequencing.`,
    decisionLane:
      riskCount > 0
        ? `${riskCount} mapped treasury blockers remain active and should be worked before the next disbursement cycle.`
        : "No mapped blocker is active; keep follow-up centered on execution discipline and forecast refresh."
  };
}

export default function CashFlowPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<CashFlowOverviewContract | null>(null);
  const [accountsPayableOverview, setAccountsPayableOverview] = useState<Awaited<ReturnType<typeof fetchAccountsPayableOverview>> | null>(null);
  const [supplierMasterOverview, setSupplierMasterOverview] = useState<Awaited<ReturnType<typeof fetchSupplierMasterOverview>> | null>(null);
  const [treasuryOverview, setTreasuryOverview] = useState<Awaited<ReturnType<typeof fetchTreasuryPaymentRunsOverview>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
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

    void Promise.all([
      fetchCashFlowOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchAccountsPayableOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchSupplierMasterOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchTreasuryPaymentRunsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, accountsPayableResult, supplierMasterResult, treasuryResult]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Cash flow overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setAccountsPayableOverview(accountsPayableResult);
        setSupplierMasterOverview(supplierMasterResult);
        setTreasuryOverview(treasuryResult);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
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

  const selectedLine = useMemo(
    () => overview?.lines.find((item) => item.id === selectedLineId) ?? overview?.focusLine ?? null,
    [overview, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedStory = useMemo(() => buildCashFlowStory(selectedLine, selectedRisks.length), [selectedLine, selectedRisks.length]);
  const treasuryChainPressure = useMemo(
    () =>
      (supplierMasterOverview?.summary.criticalSuppliers ?? 0) +
      (supplierMasterOverview?.summary.incompletePackets ?? 0) +
      (accountsPayableOverview?.summary.blockedInvoices ?? 0) +
      (accountsPayableOverview?.summary.overdueInvoices ?? 0) +
      (treasuryOverview?.summary.blockedRuns ?? 0) +
      (treasuryOverview?.unavailableInvoices.length ?? 0),
    [accountsPayableOverview, supplierMasterOverview, treasuryOverview]
  );

  const lineActions = useMemo(() => (selectedLine ? lineActionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleAction(health: CashFlowLineContract["health"], suggestedNextAction: string) {
    if (!selectedLine || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the cash flow stream.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateCashFlowLine(
      selectedLine.id,
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
      setActionError(response.error?.message ?? "Cash flow update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const lines = current.lines.map((item) => (item.id === response.data?.id ? response.data : item));

      return {
        ...current,
        summary: recomputeSummary(lines),
        lines,
        focusLine: pickFocusLine(lines)
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Cash flow stream moved to ${response.data.health}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Cash Flow"
      eyebrow="Treasury execution"
      description="Short-term inflow, outflow and liquidity pressure tied to live operational and fiscal signals."
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title="Cash flow"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked streams"
                value={String(overview.summary.trackedStreams)}
                footnote="Treasury streams actively projected for the current tenant."
              />
              <KpiCard
                label="Projected inflows"
                value={`MXN ${overview.summary.projectedInflows.toLocaleString()}`}
                footnote="Expected short-term cash intake from current operational posture."
              />
              <KpiCard
                label="Projected outflows"
                value={`MXN ${overview.summary.projectedOutflows.toLocaleString()}`}
                footnote="Expected short-term cash drain from costs, payables and fiscal load."
              />
              <KpiCard
                label="Weekly net"
                value={`MXN ${overview.summary.weeklyNet.toLocaleString()}`}
                footnote="Directional weekly liquidity gap or surplus from active streams."
              />
              <KpiCard
                label="Treasury chain"
                value={String(treasuryChainPressure)}
                footnote="Combined pressure from supplier fiscal posture, AP blockers and treasury release lane."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Treasury release lane"
                description="Cash flow now reads supplier fiscal posture, accounts payable blockers and treasury execution in one lane."
                aside={
                  <Badge tone={treasuryChainPressure > 8 ? "danger" : treasuryChainPressure > 3 ? "warning" : "success"}>
                    {treasuryChainPressure > 8 ? "high pressure" : treasuryChainPressure > 3 ? "watch" : "controlled"}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Supplier fiscal blockers</div><div>{supplierMasterOverview?.summary.criticalSuppliers ?? 0} critical and {supplierMasterOverview?.summary.incompletePackets ?? 0} incomplete packets</div></div>
                  <div className="detailRow"><div className="detailLabel">Accounts payable</div><div>{accountsPayableOverview?.summary.blockedInvoices ?? 0} blocked and {accountsPayableOverview?.summary.overdueInvoices ?? 0} overdue invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury execution</div><div>{treasuryOverview?.summary.blockedRuns ?? 0} blocked runs and {treasuryOverview?.unavailableInvoices.length ?? 0} ineligible invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">What this means</div><div>{treasuryChainPressure > 0 ? "Treasury depends on upstream fiscal and AP cleanup before clean release." : "Treasury lane is currently clean enough for predictable short-term execution."}</div></div>
                </div>
              </Card>

              <Card title="Cash flow board" description="Treasury signal board across collections, payables, tax and close pressure.">
                <FilterBar summary={`${overview.lines.length} cash flow streams in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "cash flow ready"}</Badge>
                </FilterBar>

                <DataTable
                  rows={overview.lines}
                  columns={[
                    {
                      key: "stream",
                      label: "Stream",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.streamName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.sourceType}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "movement",
                      label: "Inflow vs outflow",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>+MXN {row.projectedInflows.toLocaleString()}</strong>
                          <span className="tableCellMuted">-MXN {row.projectedOutflows.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "weekly",
                      label: "Weekly net",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.weeklyNet.toLocaleString()}</strong>
                          <span className="tableCellMuted">{row.liquidityCoverageWeeks.toFixed(1)} weeks coverage</span>
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
                description="Liquidity outlook, operating pressure and next treasury action."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.health)}>{selectedLine.health}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Starting cash</div>
                      <div>MXN {selectedLine.startingCash.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Open pressure items</div>
                      <div>{selectedLine.openPressureItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Confidence</div>
                      <div>{selectedLine.confidencePercent}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Liquidity coverage</div>
                      <div>{selectedLine.liquidityCoverageWeeks.toFixed(1)} weeks</div>
                    </div>

                    <label className="stack" htmlFor="cash-flow-next-action">
                      <span className="detailLabel">Next action</span>
                      <textarea
                        id="cash-flow-next-action"
                        className="field"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder="Describe the treasury, collection or payment action required next"
                      />
                    </label>

                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.health, action.nextAction)}
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {actionError ? <EmptyState title="Update blocked" description={actionError} /> : null}
                    {actionMessage ? <EmptyState title="Stream updated" description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState
                    title="Select a stream"
                    description="Choose a treasury stream from the board to inspect liquidity posture and next action."
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Liquidity signal" description="Immediate cash meaning of the selected treasury stream.">
                <p className="sectionText">{selectedStory?.liquiditySignal ?? "Choose a stream to inspect its liquidity signal."}</p>
              </Card>
              <Card title="Forecast confidence" description="How much treasury can trust this stream this week.">
                <p className="sectionText">
                  {selectedStory?.confidenceSignal ?? "Choose a stream to inspect forecast confidence."}
                </p>
              </Card>
              <Card title="Decision lane" description="Next treasury lens for the selected stream.">
                <p className="sectionText">{selectedStory?.decisionLane ?? "Choose a stream to inspect the decision lane."}</p>
              </Card>
            </section>

            <Card title="Cash flow risks" description="Risks affecting collections, payables, fiscal pressure and close continuity.">
              {selectedRisks.length > 0 ? (
                <DataTable
                  rows={selectedRisks}
                  columns={[
                    {
                      key: "risk",
                      label: "Risk",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.title}</strong>
                          <span className="tableCellMuted">{row.category}</span>
                        </div>
                      )
                    },
                    {
                      key: "severity",
                      label: "Severity",
                      render: (row) => (
                        <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>
                          {row.severity}
                        </Badge>
                      )
                    },
                    {
                      key: "owner",
                      label: "Owner",
                      render: (row) => row.owner
                    }
                  ]}
                />
              ) : (
                <EmptyState
                  title="No mapped cash-flow risks"
                  description="Select a treasury stream with active fiscal or cash pressure to inspect its risks."
                />
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title={error ?? "Cash flow unavailable"}
            description="We could not load the treasury projection for the selected company."
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
