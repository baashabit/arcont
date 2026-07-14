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
import {
  fetchInventoryReceivingOverview,
  fetchProcurementPurchaseOrdersOverview,
  fetchSupplierControlOverview,
  updateSupplierControlLine
} from "@/lib/platform-api";

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

type SupplierBridgeContext = {
  purchaseOrders: NonNullable<Awaited<ReturnType<typeof fetchProcurementPurchaseOrdersOverview>>>;
  receiving: NonNullable<Awaited<ReturnType<typeof fetchInventoryReceivingOverview>>>;
} | null;

function buildSupplierBridge(line: SupplierControlLineContract | null, bridge: SupplierBridgeContext) {
  if (!line) {
    return null;
  }

  const purchaseSignal = bridge?.purchaseOrders.focusPurchaseOrder ?? null;
  const receivingSignal = bridge?.receiving.focusReceipt ?? null;

  return {
    executionImpact:
      line.deliveryHealth === "critical"
        ? `${line.supplierName} is already threatening live execution through concentration, blocked packages or approval aging.`
        : line.deliveryHealth === "watch"
          ? `${line.supplierName} still needs active review before it becomes an execution blocker.`
          : `${line.supplierName} is currently operating within acceptable delivery posture.`,
    procurementDependency: purchaseSignal
      ? `${purchaseSignal.code} is the current PO anchor with status ${purchaseSignal.status} and invoice posture ${purchaseSignal.invoiceMatchStatus}.`
      : "No linked purchase-order anchor is currently in focus.",
    receivingExposure: receivingSignal
      ? `${receivingSignal.code} remains at ${receivingSignal.status} with PO posture ${receivingSignal.purchaseOrderStatus} and invoice posture ${receivingSignal.invoiceMatchStatus}.`
      : "No linked receiving exposure is currently in focus."
  };
}

export default function SupplierControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<SupplierControlOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<SupplierBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    supplierName: "",
    owner: "Procurement lead",
    awardedPackages: "1",
    activePackages: "1",
    contractedAmount: "1250000",
    concentrationPercent: "18",
    bidCoverage: "2.5",
    deliveryHealth: "controlled" as SupplierControlLineContract["deliveryHealth"],
    approvalPressureHours: "8",
    complianceAlerts: "0",
    nextAction: ""
  });

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchSupplierControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchProcurementPurchaseOrdersOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchInventoryReceivingOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, purchaseOrders, receiving]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Supplier control overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
        setBridgeContext(purchaseOrders && receiving ? { purchaseOrders, receiving } : null);
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

  const selectedStory = useMemo(() => buildSupplierBridge(selectedLine, bridgeContext), [bridgeContext, selectedLine]);

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

  function handleCreateSupplier() {
    if (!overview) {
      return;
    }

    const supplierName = createForm.supplierName.trim();
    const owner = createForm.owner.trim();
    const nextAction = createForm.nextAction.trim();

    if (supplierName.length < 3 || owner.length < 3) {
      setActionError("Supplier name and owner must be specific before creating the supplier lane.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before creating the supplier lane.");
      setCreateMessage(null);
      return;
    }

    const now = new Date();
    const lineId = `local-supplier-line-${now.getTime()}`;
    const supplierId = `local-supplier-${overview.lines.length + 1}`;

    const newLine: SupplierControlLineContract = {
      id: lineId,
      supplierId,
      companyId: activeCompany.id,
      supplierName,
      owner,
      awardedPackages: Number(createForm.awardedPackages),
      activePackages: Number(createForm.activePackages),
      contractedAmount: Number(createForm.contractedAmount),
      concentrationPercent: Number(createForm.concentrationPercent),
      bidCoverage: Number(createForm.bidCoverage),
      deliveryHealth: createForm.deliveryHealth,
      approvalPressureHours: Number(createForm.approvalPressureHours),
      complianceAlerts: Number(createForm.complianceAlerts),
      nextAction,
      updatedAt: now.toISOString()
    };

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const lines = [...current.lines, newLine];
      return {
        ...current,
        summary: recomputeSummary(lines),
        lines,
        focusLine: pickFocusLine(lines)
      };
    });
    setSelectedLineId(lineId);
    setNextActionDraft(nextAction);
    setActionError(null);
    setCreateMessage(`${supplierName} added to the supplier workbench.`);
    setCreateForm({
      supplierName: "",
      owner,
      awardedPackages: "1",
      activePackages: "1",
      contractedAmount: "1250000",
      concentrationPercent: "18",
      bidCoverage: "2.5",
      deliveryHealth: "controlled",
      approvalPressureHours: "8",
      complianceAlerts: "0",
      nextAction: ""
    });
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

            <section className="grid cols3">
              <Card title="Execution impact" description="How this supplier is already shaping real delivery posture.">
                <p className="sectionText">
                  {selectedStory?.executionImpact ?? "Choose a supplier to inspect execution impact."}
                </p>
              </Card>
              <Card title="Procurement dependency" description="Purchase-order signal currently attached to the supplier lane.">
                <p className="sectionText">
                  {selectedStory?.procurementDependency ?? "Choose a supplier to inspect procurement dependency."}
                </p>
              </Card>
              <Card title="Receiving exposure" description="Inbound exposure still tied to this supplier posture.">
                <p className="sectionText">
                  {selectedStory?.receivingExposure ?? "Choose a supplier to inspect receiving exposure."}
                </p>
              </Card>
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

            <section className="grid cols2">
              <Card
                title="Register supplier lane"
                description="Create a new supplier-control record in the tenant workbench before live POST endpoints are added."
              >
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Supplier</div>
                    <input
                      className="field"
                      value={createForm.supplierName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, supplierName: event.target.value }))}
                      placeholder="Concretos del Sureste"
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Owner</div>
                    <input
                      className="field"
                      value={createForm.owner}
                      onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Awarded packages</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.awardedPackages}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, awardedPackages: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Active packages</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.activePackages}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, activePackages: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Contracted amount</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.contractedAmount}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, contractedAmount: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Concentration %</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.concentrationPercent}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, concentrationPercent: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Bid coverage</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={createForm.bidCoverage}
                      onChange={(event) => setCreateForm((current) => ({ ...current, bidCoverage: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Health</div>
                    <select
                      className="selectField"
                      value={createForm.deliveryHealth}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          deliveryHealth: event.target.value as SupplierControlLineContract["deliveryHealth"]
                        }))
                      }
                    >
                      <option value="controlled">controlled</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Approval pressure h</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.approvalPressureHours}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, approvalPressureHours: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Compliance alerts</div>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.complianceAlerts}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, complianceAlerts: event.target.value }))
                      }
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder="Cerrar competencia, validar expediente fiscal y amarrar ventana de entrega"
                    />
                  </label>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" onClick={handleCreateSupplier}>
                    Add supplier lane
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card
                title="Workbench rules"
                description="The creation flow stays coherent now and maps cleanly to a future backend endpoint."
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Scope</div>
                    <div>New supplier lanes stay in the active tenant session and immediately reshape concentration metrics.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Selection</div>
                    <div>The new supplier becomes the selected lane so procurement can act on it immediately.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Backend path</div>
                    <div>This same intake can later point to `POST /supplier-control/lines` without changing the UX.</div>
                  </div>
                </div>
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
