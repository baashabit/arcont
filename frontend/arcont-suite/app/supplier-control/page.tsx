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
import type { SupplierControlLineContract, SupplierControlOverviewContract } from "@/lib/contracts";
import { fetchSupplierControlOverview, updateSupplierControlLine } from "@/lib/platform-api";

function healthTone(status: SupplierControlLineContract["deliveryHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function actionOptions(line: SupplierControlLineContract) {
  switch (line.deliveryHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          deliveryHealth: "watch" as const,
          nextAction: "Contain the current supplier blocker and keep the vendor under daily operating review"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          deliveryHealth: "critical" as const,
          nextAction: "Escalate supplier concentration, compliance or approval pressure to procurement leadership"
        },
        {
          label: "Mark controlled",
          deliveryHealth: "controlled" as const,
          nextAction: "Supplier risk is contained and competition plus compliance are back within tolerance"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          deliveryHealth: "watch" as const,
          nextAction: "Start monitoring this supplier before concentration or approval aging worsens"
        }
      ];
  }
}

function recomputeSummary(lines: SupplierControlLineContract[]) {
  return {
    trackedSuppliers: lines.length,
    concentratedSuppliers: lines.filter((item) => item.concentrationPercent >= 28).length,
    awardedVolume: lines.reduce((sum, item) => sum + (item.awardedPackages > 0 ? item.contractedAmount : 0), 0),
    averageBidCoverage:
      lines.length > 0 ? Number((lines.reduce((sum, item) => sum + item.bidCoverage, 0) / lines.length).toFixed(1)) : 0,
    criticalSuppliers: lines.filter((item) => item.deliveryHealth === "critical").length,
    complianceAlerts: lines.reduce((sum, item) => sum + item.complianceAlerts, 0)
  };
}

function pickFocusLine(lines: SupplierControlLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.deliveryHealth === "critical" && right.deliveryHealth !== "critical") {
          return -1;
        }
        if (left.deliveryHealth !== "critical" && right.deliveryHealth === "critical") {
          return 1;
        }
        return right.contractedAmount - left.contractedAmount;
      })[0] ?? null
  );
}

export default function SupplierControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<SupplierControlOverviewContract | null>(null);
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

    void fetchSupplierControlOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Supplier control overview is unavailable right now.");
          return;
        }

        setOverview(result);
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

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleAction(
    deliveryHealth: SupplierControlLineContract["deliveryHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the supplier.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateSupplierControlLine(
      selectedLine.id,
      activeCompany.id,
      {
        deliveryHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Supplier control update failed.");
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
    setActionMessage(`Supplier moved to ${response.data.deliveryHealth}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Supplier Control"
      eyebrow="Commercial execution"
      description="Supplier concentration, competition and operating reliability managed as a live procurement board."
    >
      <ModuleGate
        moduleKeys={["procurement.purchasing"]}
        requiredPermissions={["procurement:*"]}
        title="Supplier control"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked suppliers"
                value={String(overview.summary.trackedSuppliers)}
                footnote="Suppliers currently carrying live contracted volume in the tenant."
              />
              <KpiCard
                label="Concentrated"
                value={String(overview.summary.concentratedSuppliers)}
                footnote="Suppliers already above concentration tolerance."
              />
              <KpiCard
                label="Awarded volume"
                value={`MXN ${overview.summary.awardedVolume.toLocaleString()}`}
                footnote="Volume already sitting on suppliers with at least one awarded package."
              />
              <KpiCard
                label="Compliance alerts"
                value={String(overview.summary.complianceAlerts)}
                footnote="Open commercial or operating alerts still attached to the current supplier base."
              />
            </section>

            <section className="grid cols2">
              <Card title="Supplier board" description="Commercial concentration, bid coverage and approval pressure across the current supplier base.">
                <FilterBar summary={`${overview.lines.length} supplier lines in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "supplier control ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.lines}
                  columns={[
                    {
                      key: "supplier",
                      label: "Supplier",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.supplierName}</strong>
                            <span className="tableCellMuted">{row.owner}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "volume",
                      label: "Volume",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.contractedAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">{row.concentrationPercent}% concentration</span>
                        </div>
                      )
                    },
                    {
                      key: "coverage",
                      label: "Coverage",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.bidCoverage.toFixed(1)} bids</strong>
                          <span className="tableCellMuted">{row.approvalPressureHours.toFixed(1)} h approval pressure</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.deliveryHealth)}>{row.deliveryHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected supplier"
                description="Commercial posture, concentration and the next supplier-control action."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.deliveryHealth)}>{selectedLine.deliveryHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Awarded packages</div>
                      <div>{selectedLine.awardedPackages}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Active packages</div>
                      <div>{selectedLine.activePackages}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Bid coverage</div>
                      <div>{selectedLine.bidCoverage.toFixed(1)}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Compliance alerts</div>
                      <div>{selectedLine.complianceAlerts}</div>
                    </div>

                    <label className="stack" htmlFor="supplier-control-next-action">
                      <span className="detailLabel">Next action</span>
                      <textarea
                        id="supplier-control-next-action"
                        className="field"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                        placeholder="Describe the next supplier, competition or escalation action"
                      />
                    </label>

                    <div className="cluster">
                      {lineActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button"
                          onClick={() => void handleAction(action.deliveryHealth, action.nextAction)}
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {actionError ? <EmptyState title="Update blocked" description={actionError} /> : null}
                    {actionMessage ? <EmptyState title="Supplier updated" description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState
                    title="Select a supplier"
                    description="Choose a supplier from the board to inspect concentration, alerts and next action."
                  />
                )}
              </Card>
            </section>

            <Card title="Supplier risks" description="Open supplier, competition and approval risks mapped to the selected supplier.">
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
                  title="No mapped supplier risks"
                  description="Select a supplier with active pressure to inspect its current commercial risks."
                />
              )}
            </Card>
          </>
        ) : (
          <EmptyState
            title={error ?? "Supplier control unavailable"}
            description="We could not load the live supplier board for the selected company."
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
