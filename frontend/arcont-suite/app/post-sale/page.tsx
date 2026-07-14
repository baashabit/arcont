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
import type { PostSaleCaseContract, PostSaleOverviewContract } from "@/lib/contracts";
import {
  fetchComplianceOverview,
  fetchDocumentControlOverview,
  fetchPostSaleOverview,
  updatePostSaleCase
} from "@/lib/platform-api";

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

type PostSaleBridgeContext = {
  compliance: NonNullable<Awaited<ReturnType<typeof fetchComplianceOverview>>>;
  documents: NonNullable<Awaited<ReturnType<typeof fetchDocumentControlOverview>>>;
} | null;

function buildPostSaleBridge(item: PostSaleCaseContract | null, bridge: PostSaleBridgeContext) {
  if (!item) {
    return null;
  }

  const relatedCompliance =
    bridge?.compliance.cases.find(
      (candidate) =>
        candidate.subject.includes(item.assetLabel) ||
        candidate.unitOrContract.includes(item.assetLabel) ||
        candidate.subject.includes(item.customerName) ||
        candidate.unitOrContract.includes(item.customerName)
    ) ??
    bridge?.compliance.focusCase ??
    null;
  const relatedDocument =
    bridge?.documents.items.find((candidate) => candidate.projectName === item.projectName) ?? bridge?.documents.focusItem ?? null;

  return {
    deliverySignal:
      item.caseType === "delivery"
        ? `${caseTypeLabel(item.caseType)} case is carrying ${item.openFindings} open findings with ${item.slaHoursRemaining} SLA hours remaining.`
        : `${caseTypeLabel(item.caseType)} attention is active and still depends on disciplined closeout evidence.`,
    complianceSignal: relatedCompliance
      ? `${relatedCompliance.subject} is at ${relatedCompliance.documentCompletion}% completion with ${relatedCompliance.slaHoursRemaining} SLA hours remaining.`
      : "No linked compliance folder is mapped for this case yet.",
    documentSignal: relatedDocument
      ? `${relatedDocument.documentType} "${relatedDocument.subject}" still carries ${relatedDocument.openComments} comments and ${relatedDocument.turnaroundDays} turnaround days.`
      : "No linked document-control item is mapped for this case yet."
  };
}

function buildPostSaleWorkflow(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Use post-sale as the live customer continuity lane between delivery, warranty, evidence and final sign-off.";
  }

  if (item.status === "blocked") {
    return "A blocked post-sale case should jump immediately into compliance, documents or quality before the customer wait compounds.";
  }

  if (item.status === "customer_validation") {
    return "A validation-stage case should close fast only if evidence, visits and findings are coherent enough for real sign-off.";
  }

  return "An active post-sale case should keep triage, execution and customer closure aligned in the same queue.";
}

function buildPostSaleWhyNow(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a post-sale case to understand what should be solved now before customer continuity degrades.";
  }

  if (item.health === "critical" || item.slaHoursRemaining < 0) {
    return `${item.assetLabel} is already under customer pressure because the case is ${item.health} with ${item.slaHoursRemaining} SLA hours remaining.`;
  }

  if (item.openFindings > 0 || item.pendingVisits > 0) {
    return `${item.assetLabel} still needs coordinated findings closure and visit execution before the promise to the customer becomes harder to keep.`;
  }

  if (item.status === "customer_validation") {
    return `The case is close to closure, but ${item.customerName} still needs a clean validation cycle with evidence that fully supports sign-off.`;
  }

  return `${item.customerName} already expects continuity on ${item.assetLabel}, so this case still needs disciplined follow-through even if the queue looks stable.`;
}

function buildPostSaleDownstreamEffect(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a case to inspect what downstream lane will absorb the impact.";
  }

  if (item.caseType === "delivery") {
    return "If this delivery case stalls, compliance, document control and revenue recognition around final handover will absorb the delay.";
  }

  if (item.openFindings > 0) {
    return "If findings remain open, quality, field execution and customer success will inherit repeated visits and avoidable coordination cost.";
  }

  if (item.status === "blocked") {
    return "If the blocker is not cleared, the queue will spill into compliance or document control and keep closure metrics artificially stuck.";
  }

  return "If this case is resolved cleanly, post-sale can release pressure from quality, compliance and project teams instead of feeding rework back into them.";
}

function buildPostSaleHumanStep(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a case to identify the next human move.";
  }

  if (item.status === "blocked") {
    return "Clear the blocking dependency first, confirm the owner and only then reopen the customer commitment.";
  }

  if (item.status === "customer_validation") {
    return "Run the customer validation touchpoint now and state clearly whether the case closes or reopens with evidence.";
  }

  if (item.pendingVisits > 0) {
    return "Lock the next visit, assign the crew and keep the customer informed of the exact service window.";
  }

  if (item.openFindings > 0) {
    return "Close the remaining findings with evidence before promising final closure to the customer.";
  }

  return "Confirm the next owner, the next customer touchpoint and the exact module that receives the case if continuity breaks.";
}

function buildPostSaleOperationalLinks(item: PostSaleCaseContract | null) {
  if (!item) {
    return [
      { label: "Open post-sale", href: "/post-sale" },
      { label: "Open compliance", href: "/compliance" },
      { label: "Open document control", href: "/document-control" }
    ];
  }

  if (item.status === "blocked") {
    return [
      { label: "Open compliance", href: "/compliance" },
      { label: "Open document control", href: "/document-control" },
      { label: "Open projects", href: "/projects" }
    ];
  }

  if (item.openFindings > 0) {
    return [
      { label: "Open quality", href: "/quality" },
      { label: "Open projects", href: "/projects" },
      { label: "Open compliance", href: "/compliance" }
    ];
  }

  if (item.caseType === "delivery") {
    return [
      { label: "Open document control", href: "/document-control" },
      { label: "Open compliance", href: "/compliance" },
      { label: "Open projects", href: "/projects" }
    ];
  }

  return [
    { label: "Open quality", href: "/quality" },
    { label: "Open projects", href: "/projects" },
    { label: "Open post-sale", href: "/post-sale" }
  ];
}

function buildPostSaleReportBack(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a case to define the next customer-facing checkpoint.";
  }

  if (item.status === "blocked") {
    return "Report back as soon as the blocker owner confirms the dependency is cleared and the case can re-enter execution.";
  }

  if (item.status === "customer_validation") {
    return "Report back right after the customer validation touchpoint with explicit sign-off or the exact gap that reopens the case.";
  }

  if (item.pendingVisits > 0 || item.openFindings > 0) {
    return "Report back after the next visit and findings update so the SLA and closure path can be recalculated with evidence.";
  }

  return "Report back in the next operating cycle with the confirmed customer response and updated closure posture.";
}

export default function PostSalePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.accessToken;
  const [overview, setOverview] = useState<PostSaleOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<PostSaleBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | PostSaleCaseContract["health"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | PostSaleCaseContract["priority"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchPostSaleOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchComplianceOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchDocumentControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, compliance, documents]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Post-sale overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedCaseId((current) => current ?? result.focusItem?.id ?? result.items[0]?.id ?? null);
        setBridgeContext(compliance && documents ? { compliance, documents } : null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  const filteredCases = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.items.filter((item) => {
      const matchesHealth = healthFilter === "all" || item.health === healthFilter;
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.projectName.toLowerCase().includes(normalizedSearch) ||
        item.customerName.toLowerCase().includes(normalizedSearch) ||
        item.assetLabel.toLowerCase().includes(normalizedSearch) ||
        item.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesPriority && matchesSearch;
    });
  }, [healthFilter, overview, priorityFilter, searchFilter]);

  const filteredSummary = useMemo(() => {
    const openCases = filteredCases.filter((item) => item.status !== "closed");
    const averageSlaHours =
      openCases.length > 0 ? Number((openCases.reduce((sum, item) => sum + item.slaHoursRemaining, 0) / openCases.length).toFixed(1)) : 0;
    return {
      openCases: openCases.length,
      criticalCases: filteredCases.filter((item) => item.health === "critical").length,
      urgentCases: filteredCases.filter((item) => item.priority === "urgent" || item.priority === "critical").length,
      averageSlaHours
    };
  }, [filteredCases]);

  const selectedCase = useMemo(
    () => filteredCases.find((item) => item.id === selectedCaseId) ?? filteredCases[0] ?? null,
    [filteredCases, selectedCaseId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.caseId === selectedCase?.id) ?? [],
    [overview, selectedCase]
  );

  const selectedStory = useMemo(() => buildPostSaleBridge(selectedCase, bridgeContext), [bridgeContext, selectedCase]);
  const selectedHumanStep = useMemo(() => buildPostSaleHumanStep(selectedCase), [selectedCase]);
  const selectedWhyNow = useMemo(() => buildPostSaleWhyNow(selectedCase), [selectedCase]);
  const selectedDownstreamEffect = useMemo(() => buildPostSaleDownstreamEffect(selectedCase), [selectedCase]);
  const selectedReportBack = useMemo(() => buildPostSaleReportBack(selectedCase), [selectedCase]);
  const selectedOperationalLinks = useMemo(() => buildPostSaleOperationalLinks(selectedCase), [selectedCase]);

  const actionOptions = useMemo(() => (selectedCase ? postSaleActionOptions(selectedCase) : []), [selectedCase]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredCases.length === 0) {
      setSelectedCaseId(null);
      return;
    }

    const isSelectedVisible = filteredCases.some((item) => item.id === selectedCaseId);
    if (!isSelectedVisible) {
      setSelectedCaseId(filteredCases[0]?.id ?? null);
    }
  }, [filteredCases, overview, selectedCaseId]);

  useEffect(() => {
    setNextActionDraft(selectedCase?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedCaseId, selectedCase?.id, selectedCase?.nextAction]);

  async function handleCaseAction(
    status: PostSaleCaseContract["status"],
    suggestedNextAction: string
  ) {
    if (!selectedCase) {
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
                value={String(filteredSummary.openCases)}
                footnote="Deliveries, warranties and incidents still under active attention."
              />
              <KpiCard
                label="Critical cases"
                value={String(filteredSummary.criticalCases)}
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

            <section className="grid cols1">
              <Card
                title="Customer continuity workflow"
                description="This queue should already let an operator test real handover and warranty motion before the final backend rollout."
              >
                <p className="sectionText">
                  Pick a case, update the next action, move it through triage, scheduling, execution and validation, and use the linked modules to inspect compliance and document dependencies that still block customer closure.
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title="Post-sale continuity"
                description="Post-sale should connect delivery, warranty, compliance and documentation in a single customer lane."
                aside={<Badge tone={filteredSummary.criticalCases > 0 ? "danger" : filteredSummary.urgentCases > 0 ? "warning" : "success"}>{filteredSummary.criticalCases > 0 ? "critical queue" : filteredSummary.urgentCases > 0 ? "urgent queue" : "stable queue"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Current route</div><div>{buildPostSaleWorkflow(selectedCase)}</div></div>
                  <div className="detailRow"><div className="detailLabel">Customer use</div><div>Use this queue to keep the customer promise alive while checking legal, quality and evidence dependencies in parallel.</div></div>
                  <div className="detailRow"><div className="detailLabel">Expected jump</div><div>Move into compliance, document control or quality based on the real reason the case is not yet closable.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/compliance">Open compliance</Link>
                  <Link className="buttonGhost" href="/document-control">Open document control</Link>
                  <Link className="buttonGhost" href="/quality">Open quality</Link>
                  <Link className="buttonGhost" href="/crm">Open CRM</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Customer delivery signal" description="What the selected case means for real handover or warranty continuity.">
                <p className="sectionText">
                  {selectedStory?.deliverySignal ?? "Choose a case to inspect delivery continuity."}
                </p>
              </Card>
              <Card title="Compliance folder" description="Linked legal or handover completion posture behind the case.">
                <p className="sectionText">
                  {selectedStory?.complianceSignal ?? "Choose a case to inspect linked compliance posture."}
                </p>
              </Card>
              <Card title="Document dependency" description="Document-control signal that can still delay customer closure.">
                <p className="sectionText">
                  {selectedStory?.documentSignal ?? "Choose a case to inspect document dependency."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Post-sale board" description="Operational queue across deliveries, warranty brigades and customer incidents.">
                <FilterBar summary={`${filteredCases.length} post-sale cases match the current operating filters`}>
                  <label className="fieldLabel">
                    Health
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="watch">Watch</option>
                      <option value="healthy">Healthy</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Priority
                    <select className="field" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}>
                      <option value="all">All</option>
                      <option value="critical">Critical</option>
                      <option value="urgent">Urgent</option>
                      <option value="normal">Normal</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Project, customer, asset or next action"
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? `demo mode · ${source}` : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "post-sale ready"}</Badge>
                  <Badge tone={filteredSummary.criticalCases > 0 ? "danger" : filteredSummary.urgentCases > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalCases > 0
                      ? `${filteredSummary.criticalCases} critical`
                      : filteredSummary.urgentCases > 0
                        ? `${filteredSummary.urgentCases} urgent`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredCases}
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
                      <div className="detailLabel">Next human step</div>
                      <div>{selectedHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{selectedWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{selectedDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report back</div>
                      <div>{selectedReportBack}</div>
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
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        {selectedOperationalLinks.map((link) => (
                          <Link key={`${link.href}-${link.label}`} className="buttonGhost" href={link.href}>
                            {link.label}
                          </Link>
                        ))}
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
                        <span className="tableCellMuted">Customer validation is blocked while findings remain open or health stays critical.</span>
                        <span className="tableCellMuted">Closure now also requires the case to come from customer validation.</span>
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
                              disabled={
                                isSaving ||
                                (option.status === "customer_validation" &&
                                  (selectedCase.openFindings > 0 || selectedCase.health === "critical")) ||
                                (option.status === "closed" &&
                                  (selectedCase.openFindings > 0 ||
                                    selectedCase.slaHoursRemaining < -4 ||
                                    selectedCase.health === "critical" ||
                                    selectedCase.status !== "customer_validation"))
                              }
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
            secondaryAction={{ label: "Open compliance", href: "/compliance" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading post-sale" : "Post-sale overview not loaded yet"}
            description={
              isDemoMode
                ? "This route should load demo deliveries, warranties and incidents so human users can validate the queue."
                : "Pulling deliveries, warranties, incidents and customer SLA posture."
            }
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
