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
import type { DocumentControlItemContract, DocumentControlOverviewContract } from "@/lib/contracts";
import { fetchDocumentControlOverview, updateDocumentControlItem } from "@/lib/platform-api";

function healthTone(health: DocumentControlItemContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function documentActionOptions(item: DocumentControlItemContract) {
  switch (item.status) {
    case "blocked":
      return [
        {
          label: "Resume review",
          status: "in_review" as const,
          nextAction: "Resume technical review and align the pending coordination response"
        }
      ];
    case "issued":
      return [
        {
          label: "Start review",
          status: "in_review" as const,
          nextAction: "Route issue to reviewers and capture the first consolidated comments"
        }
      ];
    case "in_review":
      return [
        {
          label: "Request response",
          status: "awaiting_response" as const,
          nextAction: "Send review comments and wait for formal answer or reissue"
        },
        {
          label: "Approve item",
          status: "approved" as const,
          nextAction: "Close review loop and keep approval evidence attached to the package"
        },
        {
          label: "Block item",
          status: "blocked" as const,
          nextAction: "Pause workflow and escalate the coordination blocker"
        }
      ];
    case "awaiting_response":
      return [
        {
          label: "Return to review",
          status: "in_review" as const,
          nextAction: "Resume review after receiving the updated response package"
        },
        {
          label: "Approve response",
          status: "approved" as const,
          nextAction: "Accept response and archive final approval evidence"
        },
        {
          label: "Block response",
          status: "blocked" as const,
          nextAction: "Stop the response loop and escalate the unresolved blocker"
        }
      ];
    default:
      return [];
  }
}

export default function DocumentControlPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<DocumentControlOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
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

    void fetchDocumentControlOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Document control overview is unavailable right now.");
          return;
        }

        setOverview(result);
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
    () => overview?.risks.filter((risk) => risk.itemId === selectedItem?.id) ?? [],
    [overview, selectedItem]
  );

  const actionOptions = useMemo(() => (selectedItem ? documentActionOptions(selectedItem) : []), [selectedItem]);

  useEffect(() => {
    setNextActionDraft(selectedItem?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedItemId, selectedItem?.id, selectedItem?.nextAction]);

  async function handleItemAction(status: DocumentControlItemContract["status"], suggestedNextAction: string) {
    if (!selectedItem || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the item.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateDocumentControlItem(
      selectedItem.id,
      activeCompany.id,
      {
        status,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Document item update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === response.data?.id ? response.data : item));
      const openRfis = items.filter((item) => item.documentType === "RFI" && item.status !== "approved").length;
      const activeSubmittals = items.filter((item) => item.documentType === "Submittal" && item.status !== "approved").length;
      const controlledVersions = items.reduce((sum, item) => sum + item.revisionCount, 0);
      const averageTurnaroundDays =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.turnaroundDays, 0) / items.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          openRfis,
          activeSubmittals,
          controlledVersions,
          averageTurnaroundDays
        },
        items,
        focusItem: current.focusItem?.id === response.data?.id ? response.data : current.focusItem
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Item moved to ${response.data.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Document control and RFI"
      eyebrow="Project coordination"
      description="Versions, RFIs, submittals and approvals tied to live field coordination and document traceability."
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Document Control">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open RFIs"
                value={String(overview.summary.openRfis)}
                footnote="RFIs still awaiting resolution or formal response."
              />
              <KpiCard
                label="Active submittals"
                value={String(overview.summary.activeSubmittals)}
                footnote="Technical submittals currently moving through review."
              />
              <KpiCard
                label="Controlled versions"
                value={String(overview.summary.controlledVersions)}
                footnote="Revision count representing active document control flow."
              />
              <KpiCard
                label="Turnaround"
                value={`${overview.summary.averageTurnaroundDays} d`}
                footnote="Average current response time across document-control items."
              />
            </section>

            <section className="grid cols2">
              <Card title="Document board" description="Live RFIs, submittals, transmittals and meeting-note control.">
                <FilterBar summary={`${overview.items.length} document-control items in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "docs ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.items}
                  columns={[
                    {
                      key: "item",
                      label: "Item",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedItemId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.subject}</strong>
                            <span className="tableCellMuted">{row.documentType} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "project",
                      label: "Project",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectName}</strong>
                          <span className="tableCellMuted">{row.owner}</span>
                        </div>
                      )
                    },
                    {
                      key: "flow",
                      label: "Flow",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.revisionCount} revisions</strong>
                          <span className="tableCellMuted">{row.openComments} comments</span>
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
                title="Selected item"
                description="Focused traceability for the active RFI, submittal or controlled issue."
                aside={selectedItem ? <Badge tone={healthTone(selectedItem.health)}>{selectedItem.health}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div>{selectedItem.projectName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedItem.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Turnaround</div>
                      <div>{selectedItem.turnaroundDays} days</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Open comments</div>
                      <div>{selectedItem.openComments}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next coordination or response action"
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
                        <span className="tableCellMuted">Approval requires zero open comments.</span>
                        <span className="tableCellMuted">Approval is blocked if turnaround exceeds 10 days without revalidation.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.status === "blocked" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleItemAction(option.status, option.nextAction)}
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
                    title="No document-control item selected"
                    description="Choose an item to inspect the current coordination trace and blockers."
                    primaryAction={{ label: "Stay on document control", href: "/document-control" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Document risks and blockers" description="Coordination, versioning and response issues affecting active work.">
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
            title="Document control overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading document control overview" : "Document control overview not loaded yet"}
            description="This route now expects a live backend document-control response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
