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
import type { FinanceLedgerItemContract, FinanceOverviewContract, TreasuryPaymentRunsOverviewContract } from "@/lib/contracts";
import {
  fetchAccountsPayableOverview,
  fetchFinanceOverview,
  fetchSupplierMasterOverview,
  fetchTreasuryPaymentRunsOverview,
  updateFinanceLedgerItem
} from "@/lib/platform-api";

function satTone(status: FinanceLedgerItemContract["satStatus"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function financeActionOptions(item: FinanceLedgerItemContract) {
  switch (item.satStatus) {
    case "critical":
      return [
        {
          label: "Move to watch",
          satStatus: "watch" as const,
          note: "Critical exceptions reduced; keep active monitoring until close evidence stabilizes."
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate to critical",
          satStatus: "critical" as const,
          note: "Escalate because fiscal or close pressure remains unresolved."
        },
        {
          label: "Mark controlled",
          satStatus: "controlled" as const,
          note: "Exceptions resolved and fiscal control is back within acceptable posture."
        }
      ];
    case "controlled":
      return [
        {
          label: "Move to watch",
          satStatus: "watch" as const,
          note: "New observations require monitoring before they become critical."
        }
      ];
    default:
      return [];
  }
}

function buildFinanceStory(item: FinanceLedgerItemContract | null, riskCount: number) {
  if (!item) {
    return null;
  }

  return {
    cashSignal:
      item.cashImpact < 0
        ? `This signal is draining MXN ${Math.abs(item.cashImpact).toLocaleString()} from the operating cash posture.`
        : `This signal is contributing MXN ${item.cashImpact.toLocaleString()} back into the operating cash posture.`,
    operatingImpact:
      item.urgentItems > 0
        ? `${item.urgentItems} urgent items are still pushing approvals, payment sequencing or fiscal follow-up.`
        : "Urgent queue is contained and this signal is no longer driving immediate payment pressure.",
    releaseCondition:
      riskCount > 0
        ? `${riskCount} mapped blockers still need owner follow-through before this signal can be treated as controlled.`
        : "No mapped blocker remains; only evidence discipline is needed to preserve control."
  };
}

export default function FinancePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<FinanceOverviewContract | null>(null);
  const [treasuryOverview, setTreasuryOverview] = useState<TreasuryPaymentRunsOverviewContract | null>(null);
  const [accountsPayableOverview, setAccountsPayableOverview] = useState<Awaited<ReturnType<typeof fetchAccountsPayableOverview>> | null>(null);
  const [supplierMasterOverview, setSupplierMasterOverview] = useState<Awaited<ReturnType<typeof fetchSupplierMasterOverview>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
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
      fetchFinanceOverview(activeCompany.id, {
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
          setError("Finance overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setAccountsPayableOverview(accountsPayableResult);
        setSupplierMasterOverview(supplierMasterResult);
        setTreasuryOverview(treasuryResult);
        setSelectedItemId((current) => current ?? result.focusItem?.id ?? result.items[0]?.id ?? null);
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

  const selectedItem = useMemo(
    () => overview?.items.find((item) => item.id === selectedItemId) ?? overview?.focusItem ?? null,
    [overview, selectedItemId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.ledgerId === selectedItem?.id) ?? [],
    [overview, selectedItem]
  );

  const selectedStory = useMemo(() => buildFinanceStory(selectedItem, selectedRisks.length), [selectedItem, selectedRisks.length]);
  const actionOptions = useMemo(() => (selectedItem ? financeActionOptions(selectedItem) : []), [selectedItem]);

  useEffect(() => {
    setNoteDraft(selectedItem?.note ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedItemId, selectedItem?.id, selectedItem?.note]);

  async function handleFinanceAction(
    satStatus: FinanceLedgerItemContract["satStatus"],
    suggestedNote: string
  ) {
    if (!selectedItem || !session.accessToken) {
      return;
    }

    const note = noteDraft.trim() || suggestedNote;
    if (note.length < 8) {
      setActionError("Note must be more specific before updating the finance signal.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateFinanceLedgerItem(
      selectedItem.id,
      activeCompany.id,
      {
        satStatus,
        note
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Finance update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === response.data?.id ? response.data : item));
      const cashPosition = items.reduce((sum, item) => sum + item.cashImpact, 0);
      const urgentPayables = items.reduce((sum, item) => sum + item.urgentItems, 0);
      const closeReadiness =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.closeReadiness, 0) / items.length).toFixed(1)) : 0;
      const satStatusSummary = items.some((item) => item.satStatus === "critical")
        ? "critical"
        : items.some((item) => item.satStatus === "watch")
          ? "watch"
          : "controlled";

      return {
        ...current,
        summary: {
          cashPosition,
          urgentPayables,
          closeReadiness,
          satStatus: satStatusSummary,
          supplierExceptions: current.summary.supplierExceptions,
          paymentReadySuppliers: current.summary.paymentReadySuppliers,
          blockedTreasuryRuns: current.summary.blockedTreasuryRuns,
          unavailableTreasuryInvoices: current.summary.unavailableTreasuryInvoices,
          overdueCollections: current.summary.overdueCollections,
          criticalCollections: current.summary.criticalCollections,
          financeChainPressure: current.summary.financeChainPressure
        },
        command: current.command,
        items,
        focusItem: current.focusItem?.id === response.data?.id ? response.data : current.focusItem
      };
    });

    setNoteDraft(response.data.note);
    setActionMessage(`Finance signal moved to ${response.data.satStatus}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Finance and accounting"
      eyebrow="Execution domain"
      description="Cash posture, payable pressure and close-readiness connected to live operating signals."
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title="Finance"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Cash position"
                value={`MXN ${overview.summary.cashPosition.toLocaleString()}`}
                footnote="Net operating cash posture from the current finance set."
              />
              <KpiCard
                label="Urgent payables"
                value={String(overview.summary.urgentPayables)}
                footnote="Items pushing the next payment run and approval pressure."
              />
              <KpiCard
                label="Close readiness"
                value={`${overview.summary.closeReadiness}%`}
                footnote="Readiness level for close and supporting evidence."
              />
              <KpiCard
                label="SAT posture"
                value={overview.summary.satStatus}
                footnote="Fiscal control signal tied to current exceptions and complements."
                badge={{ label: "fiscal", tone: satTone(overview.summary.satStatus) }}
              />
              <KpiCard
                label="Supplier exceptions"
                value={String(overview.summary.supplierExceptions)}
                footnote="Suppliers still blocked, critical or fiscally incomplete."
              />
              <KpiCard
                label="Finance chain pressure"
                value={String(overview.summary.financeChainPressure)}
                footnote="Combined friction across supplier master, AP and treasury release lane."
              />
            </section>

            {treasuryOverview ? (
              <section className="grid cols3">
                <KpiCard
                  label="Treasury active runs"
                  value={String(treasuryOverview.summary.activeRuns)}
                  footnote="Payment batches still pending full execution."
                />
                <KpiCard
                  label="Treasury ready"
                  value={String(treasuryOverview.summary.readyRuns)}
                  footnote="Runs that can move directly to bank execution."
                />
                <KpiCard
                  label="Unavailable invoices"
                  value={String(treasuryOverview.unavailableInvoices.length)}
                  footnote="Invoices blocked from entering a new treasury batch."
                />
                <KpiCard
                  label="Payment-ready suppliers"
                  value={String(overview.summary.paymentReadySuppliers)}
                  footnote="Suppliers already in complete + controlled fiscal posture."
                />
                <KpiCard
                  label="AP blocked invoices"
                  value={String(accountsPayableOverview?.summary.blockedInvoices ?? 0)}
                  footnote="Invoices blocked before treasury can release them."
                />
              </section>
            ) : null}

            <section className="grid cols2">
              <Card
                title="Finance chain command"
                description="Supplier fiscal posture, accounts payable and treasury batch readiness now read as one release lane."
                aside={
                  <Badge tone={overview.command.laneStatus === "critical" ? "danger" : overview.command.laneStatus === "watch" ? "warning" : "success"}>
                    {overview.command.laneStatus}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Supplier master</div><div>{supplierMasterOverview?.summary.criticalSuppliers ?? 0} critical suppliers and {supplierMasterOverview?.summary.incompletePackets ?? 0} incomplete packets</div></div>
                  <div className="detailRow"><div className="detailLabel">Accounts payable</div><div>{accountsPayableOverview?.summary.blockedInvoices ?? 0} blocked invoices and {accountsPayableOverview?.summary.overdueInvoices ?? 0} overdue invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury</div><div>{treasuryOverview?.summary.blockedRuns ?? 0} blocked runs and {treasuryOverview?.unavailableInvoices.length ?? 0} ineligible invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">Executive read</div><div>{overview.command.headline}</div></div>
                  <div className="detailRow"><div className="detailLabel">Top action</div><div>{overview.command.topAction}</div></div>
                  <div className="detailRow"><div className="detailLabel">Next milestone</div><div>{overview.command.nextMilestone}</div></div>
                  <div className="detailRow"><div className="detailLabel">Blocked amount</div><div>MXN {overview.command.blockedAmount.toLocaleString()}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/supplier-master">Supplier Master</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Accounts Payable</Link>
                  <Link className="buttonGhost" href="/treasury/payment-runs">Treasury Runs</Link>
                </div>
              </Card>

              <Card title="Finance board" description="Treasury, payables and close-readiness in one live view.">
                <FilterBar summary={`${overview.items.length} finance signals in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "finance ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.items}
                  columns={[
                    {
                      key: "metric",
                      label: "Metric",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedItemId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.metricName}</strong>
                            <span className="tableCellMuted">{row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "value",
                      label: "Value",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.valueLabel}</strong>
                          <span className="tableCellMuted">{row.trendLabel}</span>
                        </div>
                      )
                    },
                    {
                      key: "close",
                      label: "Close",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.closeReadiness}%</strong>
                          <span className="tableCellMuted">{row.urgentItems} urgent items</span>
                        </div>
                      )
                    },
                    {
                      key: "sat",
                      label: "SAT",
                      render: (row) => <Badge tone={satTone(row.satStatus)}>{row.satStatus}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected finance signal"
                description="Focused context for the active cash, payable or fiscal signal."
                aside={selectedItem ? <Badge tone={satTone(selectedItem.satStatus)}>{selectedItem.satStatus}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Metric</div>
                      <div>{selectedItem.metricName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Trend</div>
                      <div>{selectedItem.trendLabel}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Urgent items</div>
                      <div>{selectedItem.urgentItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Close readiness</div>
                      <div>{selectedItem.closeReadiness}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Note</div>
                      <div>
                        <input
                          className="field"
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          placeholder="Describe the current fiscal, payable or close action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedItem.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Controlled status requires zero urgent items.</span>
                        <span className="tableCellMuted">Controlled status also requires at least 90% close readiness.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.satStatus === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleFinanceAction(option.satStatus, option.note)}
                            >
                              {isSaving ? "Saving..." : option.label}
                            </button>
                          ))}
                        </div>
                        <div className="row gap wrap">
                          <Link className="button secondary" href="/cash-flow">
                            Open cash flow
                          </Link>
                          <Link className="buttonGhost" href="/accounts-payable">
                            Open accounts payable
                          </Link>
                          <Link className="buttonGhost" href="/treasury/payment-runs">
                            Open treasury
                          </Link>
                        </div>
                        {actionMessage ? <span className="tableCellMuted">{actionMessage}</span> : null}
                        {actionError ? <span style={{ color: "var(--danger-700)" }}>{actionError}</span> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No finance signal selected"
                    description="Choose a row to inspect focus detail and current financial pressure."
                    primaryAction={{ label: "Stay on finance", href: "/finance" }}
                  />
                )}
              </Card>
            </section>

            {treasuryOverview ? (
              <section className="grid cols2">
                <Card
                  title="Treasury bridge"
                  description="Finance and treasury are now linked through payment-run execution and invoice eligibility."
                  aside={<Badge tone={treasuryOverview.summary.blockedRuns > 0 ? "danger" : treasuryOverview.summary.readyRuns > 0 ? "success" : "warning"}>{treasuryOverview.summary.blockedRuns > 0 ? "blocked" : treasuryOverview.summary.readyRuns > 0 ? "ready" : "watch"}</Badge>}
                >
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Scheduled amount</div><div>MXN {treasuryOverview.summary.scheduledAmount.toLocaleString()}</div></div>
                    <div className="detailRow"><div className="detailLabel">Executed runs</div><div>{treasuryOverview.summary.executedRuns}</div></div>
                    <div className="detailRow"><div className="detailLabel">Current focus</div><div>{treasuryOverview.focusRun?.code ?? "No active focus run"}</div></div>
                    <div className="detailRow"><div className="detailLabel">Next treasury action</div><div>{treasuryOverview.focusRun?.nextAction ?? "No treasury action pending"}</div></div>
                  </div>
                  <div className="row gap wrap" style={{ marginTop: 16 }}>
                    <Link className="button" href="/treasury/payment-runs">Open Treasury Runs</Link>
                    <Link className="buttonGhost" href="/accounts-payable">Open Accounts Payable</Link>
                  </div>
                </Card>

                <Card title="Treasury eligibility blockers" description="Invoices that treasury cannot include in the next clean run.">
                  {treasuryOverview.unavailableInvoices.length > 0 ? (
                    <DataTable
                      rows={treasuryOverview.unavailableInvoices.slice(0, 5)}
                      columns={[
                        {
                          key: "invoice",
                          label: "Invoice",
                          render: (item) => (
                            <div className="tableCellStack">
                              <strong>{item.invoiceCode}</strong>
                              <span className="tableCellMuted">{item.supplierName}</span>
                            </div>
                          )
                        },
                        { key: "reason", label: "Reason", render: (item) => item.reasonLabel },
                        {
                          key: "run",
                          label: "Run",
                          render: (item) => item.blockingRunCodes.length > 0 ? item.blockingRunCodes.join(", ") : "Not assigned"
                        }
                      ]}
                    />
                  ) : (
                    <EmptyState title="Treasury lane clear" description="No invoice is blocked from entering a new payment run." />
                  )}
                </Card>
              </section>
            ) : null}

            <section className="grid cols2">
              <Card
                title="Supplier fiscal bridge"
                description="Finance now reads supplier fiscal readiness and exceptions as part of payment control."
                aside={
                  <Badge tone={overview.summary.supplierExceptions > 0 ? "warning" : "success"}>
                    {overview.summary.supplierExceptions > 0 ? "exceptions open" : "supplier lane ready"}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Supplier exceptions</div><div>{overview.summary.supplierExceptions}</div></div>
                  <div className="detailRow"><div className="detailLabel">Payment-ready suppliers</div><div>{overview.summary.paymentReadySuppliers}</div></div>
                  <div className="detailRow"><div className="detailLabel">AP focus</div><div>{accountsPayableOverview?.focusInvoice?.code ?? "No payable invoice focus"}</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury focus</div><div>{treasuryOverview?.focusRun?.code ?? "No treasury focus"}</div></div>
                  <div className="detailRow"><div className="detailLabel">Why it matters</div><div>Invoices and treasury release now depend on real supplier fiscal posture, not only on invoice-side CFDI data.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/supplier-master">Open Supplier Master</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Open Accounts Payable</Link>
                </div>
              </Card>

              <Card title="Operating implication" description="What finance leadership should read from supplier fiscal readiness right now.">
                <p className="sectionText">
                  {overview.summary.supplierExceptions > 0
                    ? `${overview.summary.supplierExceptions} supplier fiscal exception(s) can still block invoice progression or payment sequencing even when the operational invoice looks complete.`
                    : "Supplier fiscal posture is currently aligned enough to keep invoice progression and treasury sequencing clean."}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Cash signal" description="Direct treasury implication of the selected finance signal.">
                <p className="sectionText">{selectedStory?.cashSignal ?? "Choose a finance signal to inspect its cash implication."}</p>
              </Card>
              <Card title="Operating impact" description="Why this signal matters beyond accounting.">
                <p className="sectionText">
                  {selectedStory?.operatingImpact ?? "Choose a finance signal to inspect current operating pressure."}
                </p>
              </Card>
              <Card title="Release condition" description="What still needs to happen before control is real.">
                <p className="sectionText">
                  {selectedStory?.releaseCondition ?? "Choose a finance signal to inspect the release condition."}
                </p>
              </Card>
            </section>

            <Card title="Finance risk watchlist" description="Close, payable and fiscal issues with ownership and current action state.">
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                columns={[
                  {
                    key: "risk",
                    label: "Issue",
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
            title="Finance overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading finance overview" : "Finance overview not loaded yet"}
            description="This route now expects a live backend finance response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
