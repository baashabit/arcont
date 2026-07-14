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
import type { SupplierMasterOverviewContract, SupplierMasterProfileContract } from "@/lib/contracts";
import {
  createSupplierMasterProfile,
  fetchSupplierControlOverview,
  fetchSupplierMasterOverview,
  updateSupplierMasterProfile
} from "@/lib/platform-api";

const rfcPattern = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/;
const emptyCreateForm = {
  supplierName: "",
  tradeName: "",
  rfc: "",
  fiscalRegime: "601",
  cfdiUse: "G03",
  paymentMethod: "Transferencia",
  paymentTermsDays: "30",
  bankAccountMasked: "****0000",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  complianceStatus: "watch" as SupplierMasterProfileContract["complianceStatus"],
  satStatus: "watch" as SupplierMasterProfileContract["satStatus"],
  fiscalPacketCompletion: "70",
  nextAction: ""
};

function tone(status: SupplierMasterProfileContract["satStatus"] | SupplierMasterProfileContract["complianceStatus"]) {
  switch (status) {
    case "controlled":
    case "complete":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function SupplierMasterPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<SupplierMasterOverviewContract | null>(null);
  const [supplierControlNote, setSupplierControlNote] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void Promise.all([
      fetchSupplierMasterOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSupplierControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([master, supplierControl]) => {
        if (cancelled) {
          return;
        }

        setOverview(master);
        setSelectedId((current) => current ?? master?.focusItem?.id ?? master?.items[0]?.id ?? null);
        setSupplierControlNote(
          supplierControl?.focusLine
            ? `${supplierControl.focusLine.supplierName} is the current supplier-control anchor with ${supplierControl.focusLine.deliveryHealth} delivery health.`
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

  const selectedItem = useMemo(
    () => overview?.items.find((item) => item.id === selectedId) ?? overview?.focusItem ?? null,
    [overview, selectedId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.supplierProfileId === selectedItem?.id) ?? [],
    [overview, selectedItem]
  );

  useEffect(() => {
    setNextActionDraft(selectedItem?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedItem?.id, selectedItem?.nextAction]);

  async function handleUpdate(
    complianceStatus: SupplierMasterProfileContract["complianceStatus"],
    satStatus: SupplierMasterProfileContract["satStatus"],
    fiscalPacketCompletion: number
  ) {
    if (!selectedItem || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim();
    if (nextAction.length < 8) {
      setActionError("Next action must describe the fiscal or compliance follow-up in at least 8 characters.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);
    const response = await updateSupplierMasterProfile(
      selectedItem.id,
      activeCompany.id,
      {
        complianceStatus,
        satStatus,
        fiscalPacketCompletion,
        nextAction
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Supplier profile update failed.");
      setIsSaving(false);
      return;
    }

    const updated = response.data;
    setIsSaving(false);
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === updated.id ? updated : item));
      const averageFiscalPacketCompletion =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.fiscalPacketCompletion, 0) / items.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          totalSuppliers: items.length,
          criticalSuppliers: items.filter((item) => item.satStatus === "critical" || item.complianceStatus === "blocked").length,
          incompletePackets: items.filter((item) => item.fiscalPacketCompletion < 100).length,
          averageFiscalPacketCompletion
        },
        items,
        focusItem: current.focusItem?.id === updated.id ? updated : current.focusItem
      };
    });
    setActionMessage(`Supplier master profile moved to ${updated.satStatus}.`);
  }

  async function handleCreate() {
    if (!session.accessToken || !overview) {
      return;
    }

    const paymentTermsDays = Number(createForm.paymentTermsDays);
    const fiscalPacketCompletion = Number(createForm.fiscalPacketCompletion);
    const contactPhoneDigits = createForm.contactPhone.replace(/\D/g, "");

    if (createForm.supplierName.trim().length < 3) {
      setCreateError("Supplier name must contain at least 3 characters.");
      return;
    }

    if (createForm.tradeName.trim().length < 3) {
      setCreateError("Trade name must contain at least 3 characters.");
      return;
    }

    if (!rfcPattern.test(createForm.rfc.trim().toUpperCase())) {
      setCreateError("RFC must follow a valid SAT format.");
      return;
    }

    if (!createForm.contactEmail.includes("@")) {
      setCreateError("Contact email must be valid.");
      return;
    }

    if (contactPhoneDigits.length < 10) {
      setCreateError("Contact phone must contain at least 10 digits.");
      return;
    }

    if (!Number.isFinite(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 180) {
      setCreateError("Payment terms must be between 0 and 180 days.");
      return;
    }

    if (!Number.isFinite(fiscalPacketCompletion) || fiscalPacketCompletion < 0 || fiscalPacketCompletion > 100) {
      setCreateError("Packet completion must be between 0 and 100.");
      return;
    }

    if (createForm.nextAction.trim().length < 8) {
      setCreateError("Next action must clearly describe the onboarding follow-up.");
      return;
    }

    setCreateError(null);
    setCreateMessage(null);
    setActionError(null);

    const response = await createSupplierMasterProfile(
      activeCompany.id,
      {
        supplierName: createForm.supplierName.trim(),
        tradeName: createForm.tradeName.trim(),
        rfc: createForm.rfc.trim().toUpperCase(),
        fiscalRegime: createForm.fiscalRegime,
        cfdiUse: createForm.cfdiUse,
        paymentMethod: createForm.paymentMethod,
        paymentTermsDays,
        bankAccountMasked: createForm.bankAccountMasked,
        contactName: createForm.contactName.trim(),
        contactEmail: createForm.contactEmail.trim(),
        contactPhone: createForm.contactPhone.trim(),
        complianceStatus: createForm.complianceStatus,
        satStatus: createForm.satStatus,
        fiscalPacketCompletion,
        nextAction: createForm.nextAction.trim()
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Supplier master creation failed.");
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = [created, ...current.items];
      const averageFiscalPacketCompletion =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.fiscalPacketCompletion, 0) / items.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          totalSuppliers: items.length,
          criticalSuppliers: items.filter((item) => item.satStatus === "critical" || item.complianceStatus === "blocked").length,
          incompletePackets: items.filter((item) => item.fiscalPacketCompletion < 100).length,
          averageFiscalPacketCompletion
        },
        items,
        focusItem: created
      };
    });

    setSelectedId(created.id);
    setCreateForm(emptyCreateForm);
    setCreateMessage(`${created.supplierName} added to supplier master.`);
  }

  return (
    <AppShell
      title="Supplier Master"
      eyebrow="Commercial and fiscal control"
      description="Master supplier packet for SAT, banking, CFDI and payment readiness."
    >
      <ModuleGate
        moduleKeys={["procurement.purchasing"]}
        requiredPermissions={["procurement:*", "finance:*", "finance:read"]}
        title="Supplier master"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard label="Suppliers" value={String(overview.summary.totalSuppliers)} footnote="Profiles already registered in the tenant master." />
              <KpiCard label="Critical" value={String(overview.summary.criticalSuppliers)} footnote="Suppliers blocked by fiscal or compliance posture." />
              <KpiCard label="Incomplete packets" value={String(overview.summary.incompletePackets)} footnote="Profiles still missing full fiscal packet closure." />
              <KpiCard label="Packet completion" value={`${overview.summary.averageFiscalPacketCompletion}%`} footnote="Average fiscal packet completion across the active supplier base." />
            </section>

            <section className="grid cols3">
              <Card title="Supplier master board" description="RFC, SAT and payment packet readiness for strategic vendors.">
                <FilterBar summary={`${overview.items.length} supplier profiles in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>{session.authenticated ? "live backend" : source}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "supplier master ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.items}
                  columns={[
                    {
                      key: "supplier",
                      label: "Supplier",
                      render: (row) => (
                        <button type="button" className="buttonGhost" onClick={() => setSelectedId(row.id)} style={{ justifyContent: "flex-start", paddingInline: 0 }}>
                          <div className="tableCellStack">
                            <strong>{row.supplierName}</strong>
                            <span className="tableCellMuted">{row.rfc}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "packet",
                      label: "Packet",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.fiscalPacketCompletion}%</strong>
                          <span className="tableCellMuted">{row.paymentTermsDays} days</span>
                        </div>
                      )
                    },
                    {
                      key: "sat",
                      label: "SAT",
                      render: (row) => <Badge tone={tone(row.satStatus)}>{row.satStatus}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected supplier"
                description="Packet completion, fiscal posture and next action for the current supplier."
                aside={selectedItem ? <Badge tone={tone(selectedItem.satStatus)}>{selectedItem.satStatus}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Trade name</div><div>{selectedItem.tradeName}</div></div>
                    <div className="detailRow"><div className="detailLabel">Payment terms</div><div>{selectedItem.paymentTermsDays} days</div></div>
                    <div className="detailRow"><div className="detailLabel">CFDI use</div><div>{selectedItem.cfdiUse}</div></div>
                    <div className="detailRow"><div className="detailLabel">Bank account</div><div>{selectedItem.bankAccountMasked}</div></div>
                    <div className="detailRow"><div className="detailLabel">Compliance</div><div><Badge tone={tone(selectedItem.complianceStatus)}>{selectedItem.complianceStatus}</Badge></div></div>
                    <div className="detailRow"><div className="detailLabel">Supplier control</div><div>{supplierControlNote ?? "No supplier-control anchor visible right now."}</div></div>
                    <label className="stack">
                      <span className="detailLabel">Next action</span>
                      <textarea className="field" rows={4} value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} />
                    </label>
                    <div className="cluster">
                      <button type="button" className="button" disabled={isSaving} onClick={() => void handleUpdate("watch", "watch", Math.max(selectedItem.fiscalPacketCompletion, 80))}>
                        Move To Watch
                      </button>
                      <button type="button" className="buttonGhost" disabled={isSaving} onClick={() => void handleUpdate("blocked", "critical", Math.min(selectedItem.fiscalPacketCompletion, 85))}>
                        Escalate Critical
                      </button>
                      <button type="button" className="button" disabled={isSaving} onClick={() => void handleUpdate("complete", "controlled", 100)}>
                        Mark Controlled
                      </button>
                    </div>
                    {actionError ? <EmptyState title="Update blocked" description={actionError} /> : null}
                    {actionMessage ? <EmptyState title="Profile updated" description={actionMessage} /> : null}
                  </div>
                ) : (
                  <EmptyState title="Select a supplier" description="Choose a supplier profile to inspect fiscal and payment posture." />
                )}
              </Card>

              <Card title="Supplier risks" description="Open fiscal or compliance blockers for the selected supplier.">
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
                  <EmptyState title="No mapped risks" description="The selected supplier currently has no mapped fiscal or compliance blockers." />
                )}
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Register supplier profile" description="Create a supplier master profile directly in the tenant backend.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Supplier</div><input className="field" value={createForm.supplierName} onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Trade name</div><input className="field" value={createForm.tradeName} onChange={(event) => setCreateForm((current) => ({ ...current, tradeName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">RFC</div><input className="field" value={createForm.rfc} onChange={(event) => setCreateForm((current) => ({ ...current, rfc: event.target.value.toUpperCase() }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Contact email</div><input className="field" value={createForm.contactEmail} onChange={(event) => setCreateForm((current) => ({ ...current, contactEmail: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Contact name</div><input className="field" value={createForm.contactName} onChange={(event) => setCreateForm((current) => ({ ...current, contactName: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Contact phone</div><input className="field" value={createForm.contactPhone} onChange={(event) => setCreateForm((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Payment terms</div><input className="field" type="number" value={createForm.paymentTermsDays} onChange={(event) => setCreateForm((current) => ({ ...current, paymentTermsDays: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Packet completion</div><input className="field" type="number" value={createForm.fiscalPacketCompletion} onChange={(event) => setCreateForm((current) => ({ ...current, fiscalPacketCompletion: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" onClick={() => void handleCreate()}>
                    Add Supplier Profile
                  </button>
                  {createError ? <Badge tone="danger">{createError}</Badge> : null}
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Commercial and fiscal rules" description="This master is the bridge between procurement execution and accounting readiness.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">SAT packet</div><div>RFC, regime, CFDI use and banking packet now live in tenant data instead of ad hoc notes.</div></div>
                  <div className="detailRow"><div className="detailLabel">Payments</div><div>Payment terms and bank reference are ready to feed future payables and complement workflows.</div></div>
                  <div className="detailRow"><div className="detailLabel">Operations link</div><div>The same supplier can be referenced by `supplier-control`, purchase orders and SAT-risk flows.</div></div>
                </div>
              </Card>
            </section>
          </>
        ) : (
          <EmptyState title="Supplier master unavailable" description="We could not load the supplier fiscal and commercial master for this company." />
        )}
      </ModuleGate>
    </AppShell>
  );
}
