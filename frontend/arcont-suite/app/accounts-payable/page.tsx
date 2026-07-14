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
import type { AccountsPayableInvoiceContract, AccountsPayableOverviewContract } from "@/lib/contracts";
import {
  createAccountsPayableInvoice,
  fetchAccountsPayableOverview,
  fetchSupplierMasterOverview,
  updateAccountsPayableInvoice
} from "@/lib/platform-api";

const invoiceUuidPattern = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/;
const emptyCreateForm = {
  supplierProfileId: "",
  supplierName: "",
  invoiceNumber: "",
  invoiceUuid: "",
  projectName: "",
  purchaseOrderCode: "",
  receiptCode: "",
  paymentMethod: "Transferencia",
  dueDate: "2026-07-25",
  subtotal: "100000",
  tax: "16000",
  total: "116000",
  packetCompletion: "80",
  nextAction: ""
};

function tone(status: AccountsPayableInvoiceContract["satStatus"] | AccountsPayableInvoiceContract["status"]) {
  switch (status) {
    case "controlled":
    case "paid":
      return "success";
    case "watch":
    case "matched":
    case "received":
      return "warning";
    case "scheduled":
      return "info";
    default:
      return "danger";
  }
}

export default function AccountsPayablePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<AccountsPayableOverviewContract | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | AccountsPayableInvoiceContract["status"]>("all");
  const [satFilter, setSatFilter] = useState<"all" | AccountsPayableInvoiceContract["satStatus"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [paymentDateDraft, setPaymentDateDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [supplierMasterHint, setSupplierMasterHint] = useState<string | null>(null);
  const [supplierMasterOverview, setSupplierMasterOverview] = useState<Awaited<ReturnType<typeof fetchSupplierMasterOverview>> | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchAccountsPayableOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSupplierMasterOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([result, supplierMaster]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Accounts payable overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSupplierMasterOverview(supplierMaster);
        setSelectedId((current) => current ?? result.focusInvoice?.id ?? result.invoices[0]?.id ?? null);
        setSupplierMasterHint(
          supplierMaster?.focusItem
            ? `${supplierMaster.focusItem.supplierName} is the current fiscal anchor with ${supplierMaster.focusItem.complianceStatus} compliance and ${supplierMaster.focusItem.satStatus} SAT posture.`
            : null
        );
        setCreateForm((current) => ({
          ...current,
          supplierProfileId: current.supplierProfileId || supplierMaster?.items[0]?.id || "",
          supplierName:
            current.supplierName || supplierMaster?.items.find((item) => item.id === (current.supplierProfileId || supplierMaster?.items[0]?.id))?.supplierName || ""
        }));
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

  const filteredInvoices = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.invoices.filter((invoice) => {
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesSat = satFilter === "all" || invoice.satStatus === satFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        invoice.code.toLowerCase().includes(normalizedSearch) ||
        invoice.supplierName.toLowerCase().includes(normalizedSearch) ||
        invoice.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
        invoice.projectName.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSat && matchesSearch;
    });
  }, [overview, satFilter, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => {
    const now = Date.now();
    return {
      trackedInvoices: filteredInvoices.length,
      openAmount: Number(filteredInvoices.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)),
      scheduledAmount: Number(
        filteredInvoices.filter((item) => item.status === "scheduled").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)
      ),
      blockedInvoices: filteredInvoices.filter((item) => item.status === "blocked").length,
      criticalInvoices: filteredInvoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length,
      overdueInvoices: filteredInvoices.filter((item) => item.status !== "paid" && Date.parse(item.dueDate) < now).length
    };
  }, [filteredInvoices]);

  const selectedInvoice = useMemo(
    () => filteredInvoices.find((invoice) => invoice.id === selectedId) ?? filteredInvoices[0] ?? null,
    [filteredInvoices, selectedId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.invoiceId === selectedInvoice?.id) ?? [],
    [overview, selectedInvoice]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredInvoices.length === 0) {
      setSelectedId(null);
      return;
    }

    const isSelectedVisible = filteredInvoices.some((invoice) => invoice.id === selectedId);
    if (!isSelectedVisible) {
      setSelectedId(filteredInvoices[0]?.id ?? null);
    }
  }, [filteredInvoices, overview, selectedId]);

  useEffect(() => {
    setNextActionDraft(selectedInvoice?.nextAction ?? "");
    setPaymentDateDraft(selectedInvoice?.scheduledPaymentDate?.slice(0, 10) ?? "");
    setMessage(null);
    setError(null);
  }, [selectedInvoice?.id, selectedInvoice?.nextAction, selectedInvoice?.scheduledPaymentDate]);

  const availableSupplierProfiles = useMemo(() => supplierMasterOverview?.items ?? [], [supplierMasterOverview]);
  const selectedInvoiceSupplierProfile = useMemo(() => {
    if (!selectedInvoice?.supplierProfileId) {
      return null;
    }

    return availableSupplierProfiles.find((item) => item.id === selectedInvoice.supplierProfileId) ?? null;
  }, [availableSupplierProfiles, selectedInvoice?.supplierProfileId]);
  const selectedInvoiceSupplierReadyForPayment = useMemo(
    () =>
      selectedInvoiceSupplierProfile
        ? selectedInvoiceSupplierProfile.complianceStatus === "complete" && selectedInvoiceSupplierProfile.satStatus === "controlled"
        : false,
    [selectedInvoiceSupplierProfile]
  );

  useEffect(() => {
    if (!createForm.supplierProfileId) {
      return;
    }

    const selectedProfile = availableSupplierProfiles.find((item) => item.id === createForm.supplierProfileId);
    if (!selectedProfile) {
      return;
    }

    setCreateForm((current) =>
      current.supplierName === selectedProfile.supplierName
        ? current
        : {
            ...current,
            supplierName: selectedProfile.supplierName
          }
    );
  }, [availableSupplierProfiles, createForm.supplierProfileId]);

  function refreshSummary(invoices: AccountsPayableInvoiceContract[]) {
    const now = Date.now();
    return {
      trackedInvoices: invoices.length,
      openAmount: Number(invoices.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)),
      scheduledAmount: Number(
        invoices.filter((item) => item.status === "scheduled").reduce((sum, item) => sum + item.pendingAmount, 0).toFixed(1)
      ),
      blockedInvoices: invoices.filter((item) => item.status === "blocked").length,
      criticalInvoices: invoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length,
      overdueInvoices: invoices.filter((item) => item.status !== "paid" && Date.parse(item.dueDate) < now).length
    };
  }

  async function handleUpdate(
    status: AccountsPayableInvoiceContract["status"],
    satStatus: AccountsPayableInvoiceContract["satStatus"],
    complementStatus: AccountsPayableInvoiceContract["complementStatus"]
  ) {
    if (!selectedInvoice || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim();
    if (nextAction.length < 8) {
      setError("Next action must explain the fiscal or payment follow-up.");
      return;
    }

    if ((status === "scheduled" || status === "paid") && !selectedInvoiceSupplierReadyForPayment) {
      setError("Supplier profile must be complete and controlled before scheduling or paying.");
      return;
    }

    if ((status === "scheduled" || status === "paid") && !paymentDateDraft) {
      setError("Payment date is required before scheduling or paying an invoice.");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setError(null);
    const response = await updateAccountsPayableInvoice(
      selectedInvoice.id,
      activeCompany.id,
      {
        status,
        satStatus,
        complementStatus,
        scheduledPaymentDate: paymentDateDraft || null,
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Accounts payable update failed.");
      setIsSaving(false);
      return;
    }

    const updated = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const invoices = current.invoices.map((item) => (item.id === updated.id ? updated : item));
      return {
        ...current,
        summary: refreshSummary(invoices),
        invoices,
        focusInvoice: current.focusInvoice?.id === updated.id ? updated : current.focusInvoice
      };
    });
    setMessage(`Invoice ${updated.code} moved to ${updated.status}.`);
    setIsSaving(false);
  }

  async function handleCreate() {
    if (!session.accessToken || !overview) {
      return;
    }

    const subtotal = Number(createForm.subtotal);
    const tax = Number(createForm.tax);
    const total = Number(createForm.total);
    const packetCompletion = Number(createForm.packetCompletion);
    const supplierName = createForm.supplierName.trim();
    const invoiceNumber = createForm.invoiceNumber.trim();
    const invoiceUuid = createForm.invoiceUuid.trim().toUpperCase();
    const projectName = createForm.projectName.trim();
    const nextAction = createForm.nextAction.trim();

    if (supplierName.length < 3) {
      setError("Supplier name must contain at least 3 characters.");
      return;
    }

    if (invoiceNumber.length < 3) {
      setError("Invoice number must contain at least 3 characters.");
      return;
    }

    if (!invoiceUuidPattern.test(invoiceUuid)) {
      setError("UUID must use a valid CFDI format.");
      return;
    }

    if (projectName.length < 3) {
      setError("Project name must contain at least 3 characters.");
      return;
    }

    if (!createForm.dueDate) {
      setError("Due date is required.");
      return;
    }

    if (![subtotal, tax, total].every((value) => Number.isFinite(value) && value >= 0)) {
      setError("Subtotal, tax and total must be valid non-negative amounts.");
      return;
    }

    if (Math.abs(total - (subtotal + tax)) > 0.01) {
      setError("Total must equal subtotal plus tax.");
      return;
    }

    if (!Number.isFinite(packetCompletion) || packetCompletion < 0 || packetCompletion > 100) {
      setError("Packet completion must be between 0 and 100.");
      return;
    }

    if (nextAction.length < 8) {
      setError("Next action must describe the payables follow-up.");
      return;
    }

    setError(null);
    setMessage(null);

    const response = await createAccountsPayableInvoice(
      activeCompany.id,
      {
        supplierProfileId: createForm.supplierProfileId || null,
        supplierName,
        invoiceNumber,
        invoiceUuid,
        projectName,
        purchaseOrderCode: createForm.purchaseOrderCode.trim() || null,
        receiptCode: createForm.receiptCode.trim() || null,
        status: "received",
        satStatus: "watch",
        complementStatus: "pending",
        receiptEvidenceStatus: "partial",
        paymentMethod: createForm.paymentMethod,
        dueDate: createForm.dueDate,
        scheduledPaymentDate: null,
        subtotal,
        tax,
        total,
        packetCompletion,
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? "Accounts payable invoice creation failed.");
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const invoices = [created, ...current.invoices];
      return {
        ...current,
        summary: refreshSummary(invoices),
        invoices,
        focusInvoice: created
      };
    });
    setSelectedId(created.id);
    setCreateForm((current) => ({
      ...emptyCreateForm,
      supplierProfileId: current.supplierProfileId || emptyCreateForm.supplierProfileId,
      supplierName:
        availableSupplierProfiles.find((item) => item.id === (current.supplierProfileId || emptyCreateForm.supplierProfileId))?.supplierName || ""
    }));
    setMessage(`${created.code} created for ${created.supplierName}.`);
  }

  return (
    <AppShell
      title="Accounts Payable"
      eyebrow="Finance execution"
      description="Supplier invoices, CFDI posture and payment-run readiness tied to receiving evidence."
    >
      <ModuleGate moduleKeys={["finance.accounting"]} requiredPermissions={["finance:*", "finance:read"]} title="Accounts payable">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Invoices" value={String(filteredSummary.trackedInvoices)} footnote="CXP invoices currently visible in this tenant." />
              <KpiCard label="Open amount" value={`MXN ${filteredSummary.openAmount.toLocaleString()}`} footnote="Pending amount still pressing treasury." />
              <KpiCard label="Blocked" value={String(filteredSummary.blockedInvoices)} footnote="Invoices blocked by fiscal, receipt or commercial issues." />
              <KpiCard label="Overdue" value={String(filteredSummary.overdueInvoices)} footnote="Invoices already past due and still unresolved." />
            </section>

            <section className="grid cols3">
              <Card title="Payables board" description="Facturas, CFDI and payment scheduling in one queue.">
                <FilterBar summary={`${filteredInvoices.length} invoices in the active tenant`}>
                  <select
                    className="selectField"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as "all" | AccountsPayableInvoiceContract["status"])}
                  >
                    <option value="all">All status</option>
                    <option value="received">received</option>
                    <option value="matched">matched</option>
                    <option value="scheduled">scheduled</option>
                    <option value="blocked">blocked</option>
                    <option value="paid">paid</option>
                  </select>
                  <select
                    className="selectField"
                    value={satFilter}
                    onChange={(event) => setSatFilter(event.target.value as "all" | AccountsPayableInvoiceContract["satStatus"])}
                  >
                    <option value="all">All SAT</option>
                    <option value="controlled">controlled</option>
                    <option value="watch">watch</option>
                    <option value="critical">critical</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search invoice, supplier, number or project"
                  />
                  <Badge tone={session.authenticated ? "success" : "warning"}>{session.authenticated ? "live backend" : source}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "payables ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredInvoices}
                  columns={[
                    {
                      key: "invoice",
                      label: "Invoice",
                      render: (row) => (
                        <button type="button" className="buttonGhost" onClick={() => setSelectedId(row.id)} style={{ justifyContent: "flex-start", paddingInline: 0 }}>
                          <div className="tableCellStack">
                            <strong>{row.code}</strong>
                            <span className="tableCellMuted">{row.supplierName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "cfdi",
                      label: "CFDI",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.invoiceNumber}</strong>
                          <span className="tableCellMuted">{row.complementStatus}</span>
                        </div>
                      )
                    },
                    {
                      key: "amount",
                      label: "Amount",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.total.toLocaleString()}</strong>
                          <span className="tableCellMuted">Pending MXN {row.pendingAmount.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <Badge tone={tone(row.status)}>{row.status}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected invoice"
                description="Operational and fiscal release conditions before money leaves the company."
                aside={selectedInvoice ? <Badge tone={tone(selectedInvoice.satStatus)}>{selectedInvoice.satStatus}</Badge> : null}
              >
                {selectedInvoice ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Supplier</div><div>{selectedInvoice.supplierName}</div></div>
                    <div className="detailRow"><div className="detailLabel">Supplier profile</div><div>{selectedInvoiceSupplierProfile ? `${selectedInvoiceSupplierProfile.complianceStatus} / ${selectedInvoiceSupplierProfile.satStatus}` : "No linked supplier master profile"}</div></div>
                    <div className="detailRow"><div className="detailLabel">UUID</div><div>{selectedInvoice.invoiceUuid}</div></div>
                    <div className="detailRow"><div className="detailLabel">PO / Receipt</div><div>{selectedInvoice.purchaseOrderCode ?? "No PO"} / {selectedInvoice.receiptCode ?? "No receipt"}</div></div>
                    <div className="detailRow"><div className="detailLabel">Evidence</div><div>{selectedInvoice.receiptEvidenceStatus}</div></div>
                    <div className="detailRow"><div className="detailLabel">Packet</div><div>{selectedInvoice.packetCompletion}%</div></div>
                    <div className="detailRow"><div className="detailLabel">Payment readiness</div><div>{selectedInvoiceSupplierReadyForPayment ? "Supplier profile ready for payment flow" : "Supplier profile still not payment-ready"}</div></div>
                    <label className="detailRow"><div className="detailLabel">Payment date</div><input className="field" type="date" value={paymentDateDraft} onChange={(event) => setPaymentDateDraft(event.target.value)} /></label>
                    <label className="stack">
                      <span className="detailLabel">Next action</span>
                      <textarea className="field" rows={4} value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} />
                    </label>
                    <div className="cluster">
                      <button type="button" className="button" disabled={isSaving} onClick={() => void handleUpdate("matched", "watch", "pending")}>Mark Matched</button>
                      <button type="button" className="button" disabled={isSaving || !selectedInvoiceSupplierReadyForPayment} onClick={() => void handleUpdate("scheduled", "watch", "complete")}>Schedule Payment</button>
                      <button type="button" className="buttonGhost" disabled={isSaving} onClick={() => void handleUpdate("blocked", "critical", "risk")}>Block Invoice</button>
                      <button type="button" className="button" disabled={isSaving || !selectedInvoiceSupplierReadyForPayment} onClick={() => void handleUpdate("paid", "controlled", "complete")}>Mark Paid</button>
                    </div>
                    {!selectedInvoiceSupplierReadyForPayment ? <Badge tone="warning">Complete and control the supplier fiscal profile before scheduling or paying.</Badge> : null}
                    {message ? <Badge tone="success">{message}</Badge> : null}
                    {error ? <Badge tone="danger">{error}</Badge> : null}
                  </div>
                ) : (
                  <EmptyState title="Select an invoice" description="Choose an invoice to inspect fiscal and payment release conditions." />
                )}
              </Card>

              <Card title="Invoice risks" description="Active blockers tied to the selected invoice.">
                {selectedRisks.length > 0 ? (
                  <DataTable
                    rows={selectedRisks}
                    columns={[
                      { key: "risk", label: "Risk", render: (row) => row.title },
                      { key: "category", label: "Category", render: (row) => row.category },
                      {
                        key: "severity",
                        label: "Severity",
                        render: (row) => (
                          <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>
                            {row.severity}
                          </Badge>
                        )
                      }
                    ]}
                  />
                ) : (
                  <EmptyState title="No mapped risks" description="The selected invoice has no mapped blockers right now." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Register invoice" description="Capture a payable invoice directly in the tenant backend.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Supplier profile</div><select className="selectField" value={createForm.supplierProfileId} onChange={(event) => setCreateForm((current) => ({ ...current, supplierProfileId: event.target.value }))}><option value="">No linked profile</option>{availableSupplierProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.supplierName} · {profile.complianceStatus} · {profile.satStatus}</option>)}</select></label>
                  <label className="detailRow"><div className="detailLabel">Supplier</div><input className="field" value={createForm.supplierName} onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Invoice number</div><input className="field" value={createForm.invoiceNumber} onChange={(event) => setCreateForm((current) => ({ ...current, invoiceNumber: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">UUID</div><input className="field" value={createForm.invoiceUuid} onChange={(event) => setCreateForm((current) => ({ ...current, invoiceUuid: event.target.value.toUpperCase() }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Project</div><input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">PO code</div><input className="field" value={createForm.purchaseOrderCode} onChange={(event) => setCreateForm((current) => ({ ...current, purchaseOrderCode: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Receipt code</div><input className="field" value={createForm.receiptCode} onChange={(event) => setCreateForm((current) => ({ ...current, receiptCode: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Subtotal</div><input className="field" type="number" value={createForm.subtotal} onChange={(event) => setCreateForm((current) => ({ ...current, subtotal: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Tax</div><input className="field" type="number" value={createForm.tax} onChange={(event) => setCreateForm((current) => ({ ...current, tax: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Total</div><input className="field" type="number" value={createForm.total} onChange={(event) => setCreateForm((current) => ({ ...current, total: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Packet completion</div><input className="field" type="number" value={createForm.packetCompletion} onChange={(event) => setCreateForm((current) => ({ ...current, packetCompletion: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" onClick={() => void handleCreate()}>Add Invoice</button>
                  {supplierMasterHint ? <Badge tone="info">{supplierMasterHint}</Badge> : null}
                </div>
              </Card>

              <Card title="Release rules" description="These constraints prevent fake control or premature payment release.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">SAT control</div><div>Controlled SAT posture requires 100% packet completion.</div></div>
                  <div className="detailRow"><div className="detailLabel">Scheduling</div><div>Scheduled and paid invoices require payment date and at least partial receiving evidence.</div></div>
                  <div className="detailRow"><div className="detailLabel">Supplier fiscal health</div><div>Blocked or critical supplier profiles cannot register invoices for payment flow, and scheduled/paid invoices require supplier fiscal profile in complete + controlled status.</div></div>
                  <div className="detailRow"><div className="detailLabel">Paid state</div><div>Paid invoices require complete or not-required complement status; the pending amount drops to zero.</div></div>
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState title="Accounts payable unavailable" description={error ?? "We could not load accounts payable for this company."} />
        )}
      </ModuleGate>
    </AppShell>
  );
}
