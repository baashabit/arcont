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
import type { PostSaleCaseContract, PostSaleOverviewContract } from "@/lib/contracts";
import { fetchPostSaleOverview, updatePostSaleCase } from "@/lib/platform-api";

function healthTone(health: PostSaleCaseContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function priorityTone(priority: PostSaleCaseContract["priority"]) {
  switch (priority) {
    case "critical":
      return "danger";
    case "urgent":
      return "warning";
    default:
      return "info";
  }
}

function caseTypeLabel(caseType: PostSaleCaseContract["caseType"]) {
  switch (caseType) {
    case "delivery":
      return "Delivery";
    case "warranty":
      return "Warranty";
    default:
      return "Incident";
  }
}

function postSaleActionOptions(item: PostSaleCaseContract) {
  switch (item.status) {
    case "reported":
      return [
        {
          label: "Triage case",
          status: "triaged" as const,
          nextAction: "Validate scope, assign owner and classify the SLA impact before dispatch"
        },
        {
          label: "Block case",
          status: "blocked" as const,
          nextAction: "Stop the case and document the dependency that prevents triage"
        }
      ];
    case "triaged":
      return [
        {
          label: "Schedule visit",
          status: "scheduled" as const,
          nextAction: "Lock the visit slot, crew and materials required for customer attention"
        },
        {
          label: "Start execution",
          status: "in_progress" as const,
          nextAction: "Dispatch the assigned team and start corrective work immediately"
        },
        {
          label: "Block case",
          status: "blocked" as const,
          nextAction: "Escalate the blocker before committing the next customer action"
        }
      ];
    case "scheduled":
      return [
        {
          label: "Start execution",
          status: "in_progress" as const,
          nextAction: "Execute the scheduled attention and capture field evidence in real time"
        },
        {
          label: "Block schedule",
          status: "blocked" as const,
          nextAction: "Pause the scheduled visit and escalate the unresolved dependency"
        }
      ];
    case "in_progress":
      return [
        {
          label: "Send to validation",
          status: "customer_validation" as const,
          nextAction: "Request customer validation with full evidence and closeout notes"
        },
        {
          label: "Block work",
          status: "blocked" as const,
          nextAction: "Stop execution and escalate the field or supplier blocker"
        }
      ];
    case "customer_validation":
      return [
        {
          label: "Resume case",
          status: "in_progress" as const,
          nextAction: "Reopen corrective work based on the customer validation gap"
        },
        {
          label: "Close case",
          status: "closed" as const,
          nextAction: "Archive evidence, confirm sign-off and close the post-sale loop"
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume triage",
          status: "triaged" as const,
          nextAction: "Reopen the case and recover the stalled owner coordination"
        },
        {
          label: "Schedule recovery",
          status: "scheduled" as const,
          nextAction: "Lock a new customer attention slot after clearing the blocker"
        }
      ];
    default:
      return [];
  }
}

function pickFocusItem(items: PostSaleCaseContract[]) {
  return (
    items
      .slice()
      .sort((left, right) => {
        if (left.health === "critical" && right.health !== "critical") {
          return -1;
        }

        if (left.health !== "critical" && right.health === "critical") {
          return 1;
        }

        return left.slaHoursRemaining - right.slaHoursRemaining;
      })[0] ?? null
  );
}

export default function PostSalePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<PostSaleOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
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

    void fetchPostSaleOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Post-sale overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedCaseId((current) => current ?? result.focusItem?.id ?? result.items[0]?.id ?? null);
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

  const selectedCase = useMemo(
    () => overview?.items.find((item) => item.id === selectedCaseId) ?? overview?.focusItem ?? null,
    [overview, selectedCaseId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.caseId === selectedCase?.id) ?? [],
    [overview, selectedCase]
  );

  const actionOptions = useMemo(() => (selectedCase ? postSaleActionOptions(selectedCase) : []), [selectedCase]);

  useEffect(() => {
    setNextActionDraft(selectedCase?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedCaseId, selectedCase?.id, selectedCase?.nextAction]);

  async function handleCaseAction(
    status: PostSaleCaseContract["status"],
    suggestedNextAction: string
  ) {
    if (!selectedCase || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the case.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updatePostSaleCase(
      selectedCase.id,
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
      setActionError(response.error?.message ?? "Post-sale case update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === response.data?.id ? response.data : item));

      return {
        ...current,
        summary: {
          openCases: items.filter((item) => item.status !== "closed").length,
          criticalCases: items.filter((item) => item.health === "critical").length,
          overdueSlaCases: items.filter((item) => item.slaHoursRemaining < 0).length,
          pendingCustomerSignoff: items.filter((item) => item.status === "customer_validation").length
        },
        items,
        focusItem: pickFocusItem(items)
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Case moved to ${response.data.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Post-sale, warranties and handover"
      eyebrow="Customer continuity"
      description="Deliveries, warranty claims, incidents and SLA pressure managed as an operational queue, not a passive report."
    >
      <ModuleGate
        moduleKeys={["compliance.postsale"]}
        requiredPermissions={["compliance:*", "postsale:*"]}
        title="Post-sale"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open cases"
                value={String(overview.summary.openCases)}
                footnote="Deliveries, warranties and incidents still under active attention."
              />
              <KpiCard
                label="Critical cases"
                value={String(overview.summary.criticalCases)}
                footnote="Queues under severe customer, findings or response pressure."
              />
              <KpiCard
                label="Overdue SLA"
                value={String(overview.summary.overdueSlaCases)}
                footnote="Cases already breaching their expected response or resolution target."
              />
              <KpiCard
                label="Awaiting sign-off"
                value={String(overview.summary.pendingCustomerSignoff)}
                footnote="Cases waiting for explicit customer validation before clean closure."
              />
            </section>

            <section className="grid cols2">
              <Card title="Post-sale board" description="Operational queue across deliveries, warranty brigades and customer incidents.">
                <FilterBar summary={`${overview.items.length} post-sale cases in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "post-sale ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.items}
                  columns={[
                    {
                      key: "case",
                      label: "Case",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedCaseId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.assetLabel}</strong>
                            <span className="tableCellMuted">
                              {caseTypeLabel(row.caseType)} · {row.code}
                            </span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "customer",
                      label: "Customer",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.customerName}</strong>
                          <span className="tableCellMuted">{row.projectName}</span>
                        </div>
                      )
                    },
                    {
                      key: "sla",
                      label: "SLA / findings",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.slaHoursRemaining} h</strong>
                          <span className="tableCellMuted">
                            {row.openFindings} findings · {row.pendingVisits} visits
                          </span>
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
                title="Selected case"
                description="Focused customer context, SLA posture and the next executable action."
                aside={selectedCase ? <Badge tone={healthTone(selectedCase.health)}>{selectedCase.health}</Badge> : null}
              >
                {selectedCase ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Case type</div>
                      <div className="tableCellStack">
                        <span>{caseTypeLabel(selectedCase.caseType)}</span>
                        <Badge tone={priorityTone(selectedCase.priority)}>{selectedCase.priority}</Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Project / asset</div>
                      <div className="tableCellStack">
                        <strong>{selectedCase.projectName}</strong>
                        <span className="tableCellMuted">{selectedCase.assetLabel}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Owner</div>
                      <div>{selectedCase.owner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedCase.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Customer</div>
                      <div>{selectedCase.customerName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next field, customer or coordination step"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">SLA posture</div>
                      <div className="tableCellStack">
                        <strong>{selectedCase.slaHoursRemaining} hours remaining</strong>
                        <span className="tableCellMuted">
                          {selectedCase.openFindings} open findings · {selectedCase.pendingVisits} pending visits
                        </span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Customer pulse</div>
                      <div>{selectedCase.customerSatisfaction}% satisfaction</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedCase.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Closure requires zero open findings across the selected case.</span>
                        <span className="tableCellMuted">Closure is blocked if the SLA remains critically breached or the case health is critical.</span>
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
                              onClick={() => void handleCaseAction(option.status, option.nextAction)}
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
                    title="No case selected"
                    description="Choose a delivery, warranty or incident case to inspect the SLA and move the workflow."
                    primaryAction={{ label: "Stay on post-sale", href: "/post-sale" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Risks and exceptions" description="Current blockers, customer risks and exception drivers for the selected case or full queue.">
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
            title="Post-sale overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        ) : (
          <EmptyState
            title="Loading post-sale"
            description="Pulling deliveries, warranties, incidents and customer SLA posture."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
