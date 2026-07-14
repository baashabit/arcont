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
import type { TreasuryPaymentRunContract, TreasuryPaymentRunsOverviewContract } from "@/lib/contracts";
import {
  addTreasuryPaymentRunInvoice,
  createTreasuryPaymentRun,
  fetchTreasuryPaymentRunsOverview,
  moveTreasuryPaymentRunInvoice,
  removeTreasuryPaymentRunInvoice,
  updateTreasuryPaymentRun
} from "@/lib/platform-api";

const emptyCreateForm = {
  bankAccountLabel: "Banorte Operacion ****4451",
  scheduledDate: "2026-07-25",
  owner: "Treasury lead",
  nextAction: ""
};

function tone(status: TreasuryPaymentRunContract["status"]) {
  switch (status) {
    case "executed":
      return "success";
    case "ready":
      return "info";
    case "draft":
      return "warning";
    default:
      return "danger";
  }
}

function unavailableTone(reasonCode: TreasuryPaymentRunsOverviewContract["unavailableInvoices"][number]["reasonCode"]) {
  switch (reasonCode) {
    case "already_paid":
      return "success";
    case "already_assigned":
      return "warning";
    default:
      return "danger";
  }
}

export default function TreasuryPaymentRunsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<TreasuryPaymentRunsOverviewContract | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TreasuryPaymentRunContract["status"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedEligibleInvoiceId, setSelectedEligibleInvoiceId] = useState<string>("");
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  async function reloadOverview() {
    if (!session.accessToken) {
      return;
    }

    const runs = await fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken });
    setOverview(runs);
    setSelectedId((current) => current ?? runs?.focusRun?.id ?? runs?.runs[0]?.id ?? null);
  }

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
      .then((runs) => {
        if (cancelled) {
          return;
        }
        setOverview(runs);
        setSelectedId((current) => current ?? runs?.focusRun?.id ?? runs?.runs[0]?.id ?? null);
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

  const filteredRuns = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.runs.filter((run) => {
      const matchesStatus = statusFilter === "all" || run.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        run.code.toLowerCase().includes(normalizedSearch) ||
        run.bankAccountLabel.toLowerCase().includes(normalizedSearch) ||
        run.owner.toLowerCase().includes(normalizedSearch) ||
        run.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [overview, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredRuns), [filteredRuns]);

  const selectedRun = useMemo(
    () => filteredRuns.find((run) => run.id === selectedId) ?? filteredRuns[0] ?? null,
    [filteredRuns, selectedId]
  );
  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.paymentRunId === selectedRun?.id) ?? [],
    [overview, selectedRun]
  );
  const eligibleInvoices = useMemo(
    () => overview?.eligibleInvoices ?? [],
    [overview]
  );
  const unavailableInvoices = useMemo(
    () => overview?.unavailableInvoices ?? [],
    [overview]
  );
  const availableTargetRuns = useMemo(
    () => overview?.runs.filter((run) => run.id !== selectedRun?.id && run.status !== "executed") ?? [],
    [overview, selectedRun?.id]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredRuns.length === 0) {
      setSelectedId(null);
      return;
    }

    const isSelectedVisible = filteredRuns.some((run) => run.id === selectedId);
    if (!isSelectedVisible) {
      setSelectedId(filteredRuns[0]?.id ?? null);
    }
  }, [filteredRuns, overview, selectedId]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredRuns.length === 0) {
      setSelectedId(null);
      return;
    }

    const isSelectedVisible = filteredRuns.some((run) => run.id === selectedId);
    if (!isSelectedVisible) {
      setSelectedId(filteredRuns[0]?.id ?? null);
    }
  }, [filteredRuns, overview, selectedId]);

  useEffect(() => {
    setNextActionDraft(selectedRun?.nextAction ?? "");
    setMessage(null);
    setError(null);
  }, [selectedRun?.id, selectedRun?.nextAction]);

  function recomputeSummary(runs: TreasuryPaymentRunContract[]) {
    return {
      activeRuns: runs.filter((run) => run.status !== "executed").length,
      scheduledAmount: runs.filter((run) => run.status !== "executed").reduce((sum, run) => sum + run.totalAmount, 0),
      blockedRuns: runs.filter((run) => run.status === "blocked").length,
      executedRuns: runs.filter((run) => run.status === "executed").length,
      criticalInvoices: runs.reduce((sum, run) => sum + run.criticalInvoices, 0),
      readyRuns: runs.filter((run) => run.status === "ready").length,
      duplicateAssignments: 0
    };
  }

  async function handleUpdate(status: TreasuryPaymentRunContract["status"]) {
    if (!selectedRun || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim();
    if (nextAction.length < 8) {
      setError("Next action must describe the treasury release follow-up.");
      return;
    }

    if (status === "executed" && selectedRun.status !== "ready") {
      setError("Only runs already marked ready can be executed.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await updateTreasuryPaymentRun(
      selectedRun.id,
      activeCompany.id,
      { status, nextAction },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Payment run update failed.");
      return;
    }
    const updated = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }
      const runs = current.runs.map((run) => (run.id === updated.id ? updated : run));
      return { ...current, summary: recomputeSummary(runs), runs, focusRun: updated };
    });
    setMessage(`Payment run moved to ${updated.status}.`);
  }

  async function handleCreate() {
    if (!session.accessToken) {
      return;
    }

    if (form.bankAccountLabel.trim().length < 8) {
      setError("Bank account label must be descriptive enough for treasury operations.");
      return;
    }

    if (!form.scheduledDate) {
      setError("Scheduled date is required.");
      return;
    }

    if (form.owner.trim().length < 3) {
      setError("Owner must contain at least 3 characters.");
      return;
    }

    if (form.nextAction.trim().length < 8) {
      setError("Next action must describe the release plan.");
      return;
    }

    if (selectedInvoiceIds.length === 0) {
      setError("Select at least one eligible invoice before creating a payment run.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await createTreasuryPaymentRun(
      activeCompany.id,
      {
        bankAccountLabel: form.bankAccountLabel.trim(),
        scheduledDate: form.scheduledDate,
        owner: form.owner.trim(),
        nextAction: form.nextAction.trim(),
        invoiceIds: selectedInvoiceIds
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Payment run creation failed.");
      return;
    }
    const created = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }
      const runs = [created, ...current.runs];
      return { ...current, summary: recomputeSummary(runs), runs, focusRun: created };
    });
    setSelectedId(created.id);
    setSelectedInvoiceIds([]);
    setForm(emptyCreateForm);
    setMessage(`${created.code} created.`);
  }

  async function handleRemoveInvoice(invoiceId: string) {
    if (!selectedRun || !session.accessToken) {
      return;
    }

    setMessage(null);
    setError(null);
    const response = await removeTreasuryPaymentRunInvoice(
      selectedRun.id,
      invoiceId,
      activeCompany.id,
      nextActionDraft || "Separated invoice from treasury batch for revalidation.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Invoice removal from payment run failed.");
      return;
    }

    await reloadOverview();
    setMessage(`Invoice removed from ${selectedRun.code}; run returned to draft for revalidation.`);
  }

  async function handleAddInvoiceToRun() {
    if (!selectedRun || !session.accessToken) {
      return;
    }

    if (!selectedEligibleInvoiceId) {
      setError("Select one eligible invoice before adding it to the run.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await addTreasuryPaymentRunInvoice(
      selectedRun.id,
      activeCompany.id,
      selectedEligibleInvoiceId,
      nextActionDraft || "Added eligible invoice into treasury batch for updated release review.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Invoice add into payment run failed.");
      return;
    }

    setSelectedEligibleInvoiceId("");
    await reloadOverview();
    setMessage(`Invoice added into ${selectedRun.code}; run returned to draft for revalidation.`);
  }

  async function handleMoveInvoice(invoiceId: string) {
    if (!selectedRun || !session.accessToken) {
      return;
    }

    const targetPaymentRunId = moveTargets[invoiceId];
    if (!targetPaymentRunId) {
      setError("Choose a target run before moving the invoice.");
      return;
    }

    setMessage(null);
    setError(null);
    const response = await moveTreasuryPaymentRunInvoice(
      selectedRun.id,
      invoiceId,
      activeCompany.id,
      targetPaymentRunId,
      nextActionDraft || "Moved invoice into another treasury batch for cleaner release sequencing.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Invoice move between payment runs failed.");
      return;
    }

    setMoveTargets((current) => ({ ...current, [invoiceId]: "" }));
    await reloadOverview();
    setMessage(`Invoice moved out of ${selectedRun.code} into another open run.`);
  }

  return (
    <AppShell title="Treasury Payment Runs" eyebrow="Treasury execution" description="Batch and release supplier payments with fiscal and evidence controls.">
      <ModuleGate moduleKeys={["finance.accounting"]} requiredPermissions={["finance:*", "finance:read"]} title="Treasury payment runs">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Active runs" value={String(filteredSummary.activeRuns)} footnote="Visible treasury batches still in play." />
              <KpiCard label="Scheduled amount" value={`MXN ${filteredSummary.scheduledAmount.toLocaleString()}`} footnote="Pending disbursement volume across visible open runs." />
              <KpiCard label="Blocked runs" value={String(filteredSummary.blockedRuns)} footnote="Visible runs held by fiscal or evidence blockers." />
              <KpiCard label="Ready runs" value={String(filteredSummary.readyRuns)} footnote="Visible runs that can move to execution." />
              <KpiCard label="Duplicate assignments" value={String(filteredSummary.duplicateAssignments)} footnote="Invoices duplicated across visible active runs must be rebalanced." />
            </section>

            <section className="grid cols3">
              <Card title="Payment run board" description="Treasury batches and current release posture.">
                <FilterBar summary={`${filteredRuns.length} runs match the current operating filters`}>
                  <label className="fieldLabel">
                    Status
                    <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="all">All</option>
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                      <option value="blocked">Blocked</option>
                      <option value="executed">Executed</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Run, bank account, owner or next action"
                    />
                  </label>
                  <Badge tone={session.authenticated ? "success" : "warning"}>{session.authenticated ? "live backend" : source}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "treasury ready"}</Badge>
                  <Badge tone={filteredSummary.blockedRuns > 0 ? "danger" : filteredSummary.readyRuns > 0 ? "warning" : "success"}>
                    {filteredSummary.blockedRuns > 0
                      ? `${filteredSummary.blockedRuns} blocked`
                      : filteredSummary.readyRuns > 0
                        ? `${filteredSummary.readyRuns} ready`
                        : "visible subset controlled"}
                  </Badge>
                  <Badge tone={filteredSummary.blockedRuns > 0 ? "danger" : filteredSummary.readyRuns > 0 ? "warning" : "success"}>
                    {filteredSummary.blockedRuns > 0
                      ? `${filteredSummary.blockedRuns} blocked`
                      : filteredSummary.readyRuns > 0
                        ? `${filteredSummary.readyRuns} ready`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredRuns}
                  columns={[
                    {
                      key: "run",
                      label: "Run",
                      render: (row) => (
                        <button className="buttonGhost" type="button" onClick={() => setSelectedId(row.id)} style={{ justifyContent: "flex-start", paddingInline: 0 }}>
                          <div className="tableCellStack">
                            <strong>{row.code}</strong>
                            <span className="tableCellMuted">{row.bankAccountLabel}</span>
                          </div>
                        </button>
                      )
                    },
                    { key: "date", label: "Date", render: (row) => row.scheduledDate },
                    { key: "amount", label: "Amount", render: (row) => `MXN ${row.totalAmount.toLocaleString()}` },
                    { key: "status", label: "Status", render: (row) => <Badge tone={tone(row.status)}>{row.status}</Badge> }
                  ]}
                />
              </Card>

              <Card title="Selected run" description="Treasury release posture for the active batch." aside={selectedRun ? <Badge tone={tone(selectedRun.status)}>{selectedRun.status}</Badge> : null}>
                {selectedRun ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Owner</div><div>{selectedRun.owner}</div></div>
                    <div className="detailRow"><div className="detailLabel">Invoices</div><div>{selectedRun.totalInvoices}</div></div>
                    <div className="detailRow"><div className="detailLabel">Critical invoices</div><div>{selectedRun.criticalInvoices}</div></div>
                    <label className="stack">
                      <span className="detailLabel">Next action</span>
                      <textarea className="field" rows={4} value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} />
                    </label>
                    <div className="cluster">
                      <button className="button" type="button" onClick={() => void handleUpdate("ready")}>Mark Ready</button>
                      <button className="buttonGhost" type="button" onClick={() => void handleUpdate("blocked")}>Block Run</button>
                      <button className="button" type="button" onClick={() => void handleUpdate("executed")}>Execute Run</button>
                    </div>
                    {selectedRun.status !== "executed" ? (
                      <div className="detailRow">
                        <div className="detailLabel">Add eligible invoice</div>
                        <div className="row gap wrap" style={{ flex: 1 }}>
                          <select className="field" value={selectedEligibleInvoiceId} onChange={(event) => setSelectedEligibleInvoiceId(event.target.value)}>
                            <option value="">Select eligible invoice</option>
                            {eligibleInvoices.map((invoice) => (
                              <option key={invoice.id} value={invoice.id}>
                                {invoice.code} · {invoice.supplierName} · MXN {invoice.pendingAmount.toLocaleString()}
                              </option>
                            ))}
                          </select>
                          <button className="button" type="button" disabled={!selectedEligibleInvoiceId} onClick={() => void handleAddInvoiceToRun()}>
                            Add
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div className="stack">
                      {selectedRun.invoices.map((invoice) => (
                        <div key={invoice.invoiceId} className="detailRow">
                          <div className="detailLabel">{invoice.invoiceCode}</div>
                          <div className="tableCellStack" style={{ alignItems: "flex-start" }}>
                            <span>{invoice.supplierName} · MXN {invoice.total.toLocaleString()}</span>
                            <span className="tableCellMuted">{invoice.complementStatus} / {invoice.receiptEvidenceStatus}</span>
                          </div>
                          {selectedRun.status !== "executed" ? (
                            <div className="row gap wrap">
                              <button className="buttonGhost" type="button" onClick={() => void handleRemoveInvoice(invoice.invoiceId)}>
                                Separate
                              </button>
                              {availableTargetRuns.length > 0 ? (
                                <>
                                  <select
                                    className="field"
                                    value={moveTargets[invoice.invoiceId] ?? ""}
                                    onChange={(event) =>
                                      setMoveTargets((current) => ({ ...current, [invoice.invoiceId]: event.target.value }))
                                    }
                                  >
                                    <option value="">Move to run</option>
                                    {availableTargetRuns.map((run) => (
                                      <option key={run.id} value={run.id}>
                                        {run.code} · MXN {run.totalAmount.toLocaleString()}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    className="button"
                                    type="button"
                                    disabled={!moveTargets[invoice.invoiceId]}
                                    onClick={() => void handleMoveInvoice(invoice.invoiceId)}
                                  >
                                    Move
                                  </button>
                                </>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {message ? <Badge tone="success">{message}</Badge> : null}
                    {error ? <Badge tone="danger">{error}</Badge> : null}
                  </div>
                ) : (
                  <EmptyState title="Select a run" description="Choose a treasury batch to inspect release conditions." />
                )}
              </Card>

              <Card title="Run risks" description="Current blockers on the selected payment run.">
                {selectedRisks.length > 0 ? (
                  <DataTable
                    rows={selectedRisks}
                    columns={[
                      { key: "risk", label: "Risk", render: (row) => row.title },
                      { key: "category", label: "Category", render: (row) => row.category },
                      { key: "severity", label: "Severity", render: (row) => <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>{row.severity}</Badge> }
                    ]}
                  />
                ) : (
                  <EmptyState title="No mapped risks" description="The selected run currently has no explicit treasury risk." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Create payment run" description="Select payable invoices and create a treasury batch.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Bank account</div><input className="field" value={form.bankAccountLabel} onChange={(event) => setForm((current) => ({ ...current, bankAccountLabel: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Scheduled date</div><input className="field" type="date" value={form.scheduledDate} onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Owner</div><input className="field" value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={form.nextAction} onChange={(event) => setForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="stack" style={{ marginTop: 12 }}>
                  {eligibleInvoices.length > 0 ? (
                    eligibleInvoices.map((invoice) => (
                      <label key={invoice.id} className="detailRow">
                        <div className="detailLabel">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.includes(invoice.id)}
                            onChange={(event) =>
                              setSelectedInvoiceIds((current) =>
                                event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id)
                              )
                            }
                          />
                        </div>
                        <div>{invoice.code} · {invoice.supplierName} · MXN {invoice.pendingAmount.toLocaleString()}</div>
                      </label>
                    ))
                  ) : (
                    <EmptyState
                      title="No eligible invoices"
                      description="All current invoices are either already assigned, paid, fiscally blocked or missing receiving evidence."
                    />
                  )}
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button className="button" type="button" onClick={() => void handleCreate()}>Create Run</button>
                </div>
              </Card>

              <Card title="Release rules" description="Treasury should not execute batches with fake readiness.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Ready / executed</div><div>Runs cannot advance if any invoice remains critical, risky or with missing receipt evidence.</div></div>
                  <div className="detailRow"><div className="detailLabel">Executed</div><div>A run must first be `ready` before it can be executed.</div></div>
                  <div className="detailRow"><div className="detailLabel">Scope</div><div>The batch is linked directly to payable invoices already living in CXP.</div></div>
                </div>
                <div className="stack" style={{ marginTop: 16 }}>
                  {unavailableInvoices.slice(0, 5).map((invoice) => (
                    <div key={invoice.invoiceId} className="detailRow">
                      <div className="detailLabel">
                        <Badge tone={unavailableTone(invoice.reasonCode)}>{invoice.reasonCode}</Badge>
                      </div>
                      <div>
                        {invoice.invoiceCode} · {invoice.supplierName} · {invoice.reasonLabel}
                        {invoice.blockingRunCodes.length > 0 ? ` (${invoice.blockingRunCodes.join(", ")})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState title="Treasury payment runs unavailable" description={error ?? "We could not load treasury payment runs for this company."} />
        )}
      </ModuleGate>
    </AppShell>
  );
}
