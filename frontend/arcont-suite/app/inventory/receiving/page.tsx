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
import type { InventoryReceiptContract, InventoryReceivingOverviewContract } from "@/lib/contracts";
import { fetchInventoryReceivingOverview, updateInventoryReceipt } from "@/lib/platform-api";

function statusTone(status: InventoryReceiptContract["status"]) {
  switch (status) {
    case "received":
      return "success";
    case "in_transit":
      return "info";
    case "blocked":
      return "danger";
    default:
      return "warning";
  }
}

function actionOptions(receipt: InventoryReceiptContract) {
  switch (receipt.status) {
    case "draft":
      return [
        {
          label: "Send in transit",
          status: "in_transit" as const,
          nextAction: "Release the inbound shipment and keep the receiving slot confirmed with the destination crew."
        },
        {
          label: "Block receipt",
          status: "blocked" as const,
          nextAction: "Stop the receipt and document the issue before the truck reaches the unloading gate."
        }
      ];
    case "in_transit":
      return [
        {
          label: "Mark received",
          status: "received" as const,
          nextAction: "Close the receipt after evidence, counts and acceptance are fully reconciled."
        },
        {
          label: "Block receipt",
          status: "blocked" as const,
          nextAction: "Pause the receipt and escalate variance, damage or evidence gaps."
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume transit",
          status: "in_transit" as const,
          nextAction: "Resume the inbound flow after the blocker is contained and warehouse is ready again."
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(receipts: InventoryReceiptContract[]) {
  return {
    openReceipts: receipts.filter((receipt) => receipt.status !== "received").length,
    overdueEta: receipts.filter((receipt) => receipt.status !== "received" && Date.parse(receipt.etaDate) < Date.now()).length,
    quantityVarianceUnits: receipts.reduce((sum, receipt) => sum + Math.abs(receipt.varianceUnits), 0),
    pendingEvidence: receipts.reduce((sum, receipt) => sum + receipt.pendingEvidence, 0),
    blockedReceipts: receipts.filter((receipt) => receipt.status === "blocked").length
  };
}

function pickFocusReceipt(receipts: InventoryReceiptContract[]) {
  return (
    receipts
      .slice()
      .sort((left, right) => {
        if (left.status === "blocked" && right.status !== "blocked") {
          return -1;
        }
        if (left.status !== "blocked" && right.status === "blocked") {
          return 1;
        }
        return Math.abs(right.varianceUnits) - Math.abs(left.varianceUnits);
      })[0] ?? null
  );
}

export default function InventoryReceivingPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<InventoryReceivingOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
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

    void fetchInventoryReceivingOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Inventory receiving overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedReceiptId((current) => current ?? result.focusReceipt?.id ?? result.receipts[0]?.id ?? null);
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

  const selectedReceipt = useMemo(
    () => overview?.receipts.find((item) => item.id === selectedReceiptId) ?? overview?.focusReceipt ?? null,
    [overview, selectedReceiptId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.receiptId === selectedReceipt?.id) ?? [],
    [overview, selectedReceipt]
  );

  const receiptActions = useMemo(() => (selectedReceipt ? actionOptions(selectedReceipt) : []), [selectedReceipt]);

  useEffect(() => {
    setNextActionDraft(selectedReceipt?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedReceiptId, selectedReceipt?.id, selectedReceipt?.nextAction]);

  async function handleAction(status: InventoryReceiptContract["status"], suggestedNextAction: string) {
    if (!selectedReceipt || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the receipt.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateInventoryReceipt(
      selectedReceipt.id,
      activeCompany.id,
      { status, nextAction },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Inventory receipt update failed.");
      setIsSaving(false);
      return;
    }

    const updatedReceipt = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const receipts = current.receipts.map((item) => (item.id === updatedReceipt.id ? updatedReceipt : item));
      return {
        ...current,
        summary: recomputeSummary(receipts),
        receipts,
        focusReceipt: pickFocusReceipt(receipts)
      };
    });

    setNextActionDraft(updatedReceipt.nextAction);
    setActionMessage(`Receipt moved to ${updatedReceipt.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Inventory receiving"
      eyebrow="Warehouse execution"
      description="Inbound receipt control for ETA, quantity variance, evidence completeness and destination acceptance."
    >
      <ModuleGate moduleKeys={["inventory.receiving"]} requiredPermissions={["inventory:*"]} title="Receiving">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open receipts"
                value={String(overview.summary.openReceipts)}
                footnote="Inbound receipts not yet fully accepted into stock."
              />
              <KpiCard
                label="Overdue ETA"
                value={String(overview.summary.overdueEta)}
                footnote="Receipts already late against their expected arrival window."
              />
              <KpiCard
                label="Variance units"
                value={String(overview.summary.quantityVarianceUnits)}
                footnote="Absolute quantity gap still open across the current receipt board."
              />
              <KpiCard
                label="Pending evidence"
                value={String(overview.summary.pendingEvidence)}
                footnote="Missing evidence items before receipts can be cleanly closed."
              />
            </section>

            <section className="grid cols2">
              <Card title="Inbound board" description="Receipt posture by supplier, destination and current warehouse acceptance state.">
                <FilterBar summary={`${overview.receipts.length} inbound receipts in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "receiving ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.receipts}
                  columns={[
                    {
                      key: "code",
                      label: "Receipt",
                      render: (row) => (
                        <button className="buttonGhost" type="button" onClick={() => setSelectedReceiptId(row.id)}>
                          {row.code}
                        </button>
                      )
                    },
                    {
                      key: "supplier",
                      label: "Supplier",
                      render: (row) => row.supplierName
                    },
                    {
                      key: "destination",
                      label: "Destination",
                      render: (row) => row.destinationName
                    },
                    {
                      key: "variance",
                      label: "Variance",
                      render: (row) => `${row.varianceUnits} u`
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title={selectedReceipt ? selectedReceipt.code : "Select a receipt"}
                description={
                  selectedReceipt
                    ? `${selectedReceipt.supplierName} · ${selectedReceipt.destinationName} · ${selectedReceipt.purchaseReference}`
                    : "Review the selected inbound receipt and decide the next warehouse action."
                }
              >
                {selectedReceipt ? (
                  <div className="stack">
                    <div className="grid cols2">
                      <KpiCard
                        label="Ordered vs received"
                        value={`${selectedReceipt.receivedUnits}/${selectedReceipt.orderedUnits}`}
                        footnote={`ETA ${new Date(selectedReceipt.etaDate).toLocaleDateString()}`}
                      />
                      <KpiCard
                        label="Evidence / rejects"
                        value={`${selectedReceipt.pendingEvidence} / ${selectedReceipt.rejectedUnits}`}
                        footnote={`${selectedReceipt.destinationType} destination`}
                      />
                    </div>

                    <div className="row gap wrap">
                      <Badge tone={statusTone(selectedReceipt.status)}>{selectedReceipt.status}</Badge>
                      <Badge tone={selectedReceipt.varianceUnits === 0 ? "success" : "warning"}>
                        {selectedReceipt.variancePercent}% variance
                      </Badge>
                      <Badge tone={selectedReceipt.pendingEvidence > 0 ? "warning" : "success"}>
                        {selectedReceipt.pendingEvidence} evidence pending
                      </Badge>
                    </div>

                    <div className="stack">
                      <label className="label" htmlFor="receipt-next-action">
                        Next action
                      </label>
                      <textarea
                        id="receipt-next-action"
                        className="textarea"
                        rows={4}
                        value={nextActionDraft}
                        onChange={(event) => setNextActionDraft(event.target.value)}
                      />
                    </div>

                    <div className="row gap wrap">
                      {receiptActions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          className="button secondary"
                          onClick={() => void handleAction(action.status, action.nextAction)}
                          disabled={isSaving}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>

                    {actionError ? <p className="text-danger">{actionError}</p> : null}
                    {actionMessage ? <p className="text-success">{actionMessage}</p> : null}

                    <Card title="Receipt risks" description="Variance, quality or evidence issues still attached to this inbound flow.">
                      {selectedRisks.length > 0 ? (
                        <div className="stack">
                          {selectedRisks.map((risk) => (
                            <div key={risk.id} className="row space-between card-section">
                              <div>
                                <strong>{risk.title}</strong>
                                <p>
                                  {risk.category} · {risk.owner}
                                </p>
                              </div>
                              <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                                {risk.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title="No active risks" description="This receipt is not carrying explicit receiving risks right now." />
                      )}
                    </Card>
                  </div>
                ) : (
                  <EmptyState title="No receipt selected" description="Choose a receipt from the inbound board to review its detail." />
                )}
              </Card>
            </section>
          </>
        ) : (
          <EmptyState
            title="Receiving unavailable"
            description={error ?? "The inventory receiving board could not be loaded from the current backend source."}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
