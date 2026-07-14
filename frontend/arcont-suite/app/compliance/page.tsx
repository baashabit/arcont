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
import type { ComplianceCaseContract, ComplianceOverviewContract } from "@/lib/contracts";
import {
  fetchComplianceOverview,
  fetchDocumentControlOverview,
  fetchPostSaleOverview,
  updateComplianceCase
} from "@/lib/platform-api";

function healthTone(health: ComplianceCaseContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function complianceActionOptions(complianceCase: ComplianceCaseContract) {
  switch (complianceCase.status) {
    case "blocked":
      return [
        {
          label: "Resume case",
          status: "in_progress" as const,
          nextAction: "Resume case handling and close the current blocker with the responsible team"
        }
      ];
    case "monitoring":
      return [
        {
          label: "Start handling",
          status: "in_progress" as const,
          nextAction: "Activate the case owner and gather the required evidence package"
        },
        {
          label: "Escalate risk",
          status: "at_risk" as const,
          nextAction: "Escalate the case because SLA or documentation risk is increasing"
        }
      ];
    case "in_progress":
      return [
        {
          label: "Mark at risk",
          status: "at_risk" as const,
          nextAction: "Escalate due to findings, documents or SLA pressure"
        },
        {
          label: "Block case",
          status: "blocked" as const,
          nextAction: "Pause the case and document the external blocker"
        },
        {
          label: "Close case",
          status: "closed" as const,
          nextAction: "Archive closure evidence and confirm all obligations are complete"
        }
      ];
    case "at_risk":
      return [
        {
          label: "Resume execution",
          status: "in_progress" as const,
          nextAction: "Stabilize the case and execute the recovery plan"
        },
        {
          label: "Block case",
          status: "blocked" as const,
          nextAction: "Stop progress and escalate the unresolved blocker"
        },
        {
          label: "Close case",
          status: "closed" as const,
          nextAction: "Finalize the case and archive the compliance evidence"
        }
      ];
    default:
      return [];
  }
}

type ComplianceBridgeContext = {
  postSale: NonNullable<Awaited<ReturnType<typeof fetchPostSaleOverview>>>;
  documents: NonNullable<Awaited<ReturnType<typeof fetchDocumentControlOverview>>>;
} | null;

function buildComplianceBridge(complianceCase: ComplianceCaseContract | null, bridge: ComplianceBridgeContext) {
  if (!complianceCase) {
    return null;
  }

  const relatedPostSale =
    bridge?.postSale.items.find(
      (item) =>
        complianceCase.subject.includes(item.assetLabel) ||
        complianceCase.unitOrContract.includes(item.assetLabel) ||
        complianceCase.subject.includes(item.customerName) ||
        complianceCase.unitOrContract.includes(item.customerName)
    ) ??
    bridge?.postSale.focusItem ??
    null;
  const relatedDocument =
    bridge?.documents.items.find(
      (item) =>
        item.projectName.includes(complianceCase.unitOrContract) ||
        complianceCase.subject.includes(item.projectName) ||
        item.subject.includes(complianceCase.queueName)
    ) ??
    bridge?.documents.focusItem ??
    null;

  return {
    closureSignal:
      complianceCase.openFindings > 0
        ? `${complianceCase.openFindings} findings still keep this folder under closure pressure.`
        : "Open findings are contained; closure depends mainly on signatures and evidence quality.",
    customerSignal: relatedPostSale
      ? `${relatedPostSale.customerName} still carries a ${relatedPostSale.status} ${relatedPostSale.caseType} case with ${relatedPostSale.slaHoursRemaining} SLA hours remaining.`
      : "No linked post-sale case is mapped for this compliance folder yet.",
    documentSignal: relatedDocument
      ? `${relatedDocument.documentType} "${relatedDocument.subject}" remains at ${relatedDocument.status} with ${relatedDocument.openComments} comments open.`
      : "No linked document-control signal is mapped for this compliance folder yet."
  };
}

export default function CompliancePage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ComplianceOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<ComplianceBridgeContext>(null);
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

    void Promise.all([
      fetchComplianceOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchPostSaleOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchDocumentControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, postSale, documents]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Compliance overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedCaseId((current) => current ?? result.focusCase?.id ?? result.cases[0]?.id ?? null);
        setBridgeContext(postSale && documents ? { postSale, documents } : null);
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
    () => overview?.cases.find((item) => item.id === selectedCaseId) ?? overview?.focusCase ?? null,
    [overview, selectedCaseId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.caseId === selectedCase?.id) ?? [],
    [overview, selectedCase]
  );

  const selectedStory = useMemo(() => buildComplianceBridge(selectedCase, bridgeContext), [bridgeContext, selectedCase]);

  const actionOptions = useMemo(() => (selectedCase ? complianceActionOptions(selectedCase) : []), [selectedCase]);

  useEffect(() => {
    setNextActionDraft(selectedCase?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedCaseId, selectedCase?.id, selectedCase?.nextAction]);

  async function handleCaseAction(status: ComplianceCaseContract["status"], suggestedNextAction: string) {
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

    const response = await updateComplianceCase(
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
      setActionError(response.error?.message ?? "Compliance case update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const cases = current.cases.map((item) => (item.id === response.data?.id ? response.data : item));
      const activeCases = cases.filter((item) => item.status !== "closed").length;
      const atRiskCases = cases.filter((item) => item.health !== "healthy").length;
      const averageDocumentCompletion =
        cases.length > 0 ? Number((cases.reduce((sum, item) => sum + item.documentCompletion, 0) / cases.length).toFixed(1)) : 0;
      const openFindings = cases.reduce((sum, item) => sum + item.openFindings, 0);

      return {
        ...current,
        summary: {
          activeCases,
          atRiskCases,
          averageDocumentCompletion,
          openFindings
        },
        cases,
        focusCase: current.focusCase?.id === response.data?.id ? response.data : current.focusCase
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Case moved to ${response.data.status}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Compliance and post-sale"
      eyebrow="Customer continuity"
      description="Legal, handover and warranty pressure in one live queue for document-heavy construction operations."
    >
      <ModuleGate
        moduleKeys={["compliance.postsale"]}
        requiredPermissions={["compliance:*", "postsale:*"]}
        title="Compliance"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Active cases"
                value={String(overview.summary.activeCases)}
                footnote="Open legal, handover and warranty items currently under management."
              />
              <KpiCard
                label="At-risk cases"
                value={String(overview.summary.atRiskCases)}
                footnote="Cases under document, SLA or approval pressure."
              />
              <KpiCard
                label="Document completion"
                value={`${overview.summary.averageDocumentCompletion}%`}
                footnote="Average completion across active folders, contracts and handover packs."
              />
              <KpiCard
                label="Open findings"
                value={String(overview.summary.openFindings)}
                footnote="Outstanding issues still affecting closure readiness and compliance health."
              />
            </section>

            <section className="grid cols2">
              <Card title="Compliance board" description="Live legal, post-sale and handover queues tied to the active tenant.">
                <FilterBar summary={`${overview.cases.length} compliance queues in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "compliance ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.cases}
                  columns={[
                    {
                      key: "queue",
                      label: "Queue",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedCaseId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.subject}</strong>
                            <span className="tableCellMuted">{row.queueName} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "object",
                      label: "Object",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.unitOrContract}</strong>
                          <span className="tableCellMuted">{row.owner}</span>
                        </div>
                      )
                    },
                    {
                      key: "completion",
                      label: "Readiness",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.documentCompletion}% docs</strong>
                          <span className="tableCellMuted">{row.openFindings} findings</span>
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
                description="Focused context for the active contract, unit, handover or warranty case."
                aside={selectedCase ? <Badge tone={healthTone(selectedCase.health)}>{selectedCase.health}</Badge> : null}
              >
                {selectedCase ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Owner</div>
                      <div>{selectedCase.owner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedCase.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">SLA remaining</div>
                      <div>{selectedCase.slaHoursRemaining} hours</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Document completion</div>
                      <div>{selectedCase.documentCompletion}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next compliance, handover or post-sale move"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        <Link className="buttonGhost" href="/post-sale">
                          Open post-sale
                        </Link>
                        <Link className="buttonGhost" href="/document-control">
                          Open document control
                        </Link>
                        <Link className="buttonGhost" href="/close-control">
                          Open close control
                        </Link>
                        <Link className="buttonGhost" href="/projects">
                          Open projects
                        </Link>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedCase.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Closure requires zero open findings.</span>
                        <span className="tableCellMuted">Closure also requires at least 95% document completion and no breached SLA.</span>
                        <span className="tableCellMuted">In-progress now requires at least 40% document baseline.</span>
                        <span className="tableCellMuted">At-risk should not be used when the folder is healthy and has zero findings.</span>
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
                                (option.status === "closed" &&
                                  (selectedCase.openFindings > 0 ||
                                    selectedCase.documentCompletion < 95 ||
                                    selectedCase.slaHoursRemaining < 0)) ||
                                (option.status === "in_progress" && selectedCase.documentCompletion < 40) ||
                                (option.status === "at_risk" &&
                                  selectedCase.health === "healthy" &&
                                  selectedCase.openFindings === 0)
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
                    title="No compliance case selected"
                    description="Choose a case from the board to inspect legal, handover or post-sale detail."
                    primaryAction={{ label: "Stay on compliance", href: "/compliance" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Closure signal" description="What still keeps the selected folder from a clean closure posture.">
                <p className="sectionText">
                  {selectedStory?.closureSignal ?? "Choose a case to inspect closure signal."}
                </p>
              </Card>
              <Card title="Customer continuity" description="How this folder is already affecting handover or post-sale continuity.">
                <p className="sectionText">
                  {selectedStory?.customerSignal ?? "Choose a case to inspect customer continuity."}
                </p>
              </Card>
              <Card title="Document dependency" description="Controlled-document signal still attached to the selected folder.">
                <p className="sectionText">
                  {selectedStory?.documentSignal ?? "Choose a case to inspect document dependency."}
                </p>
              </Card>
            </section>

            <Card title="Compliance risks and blockers" description="Document, contract and post-sale issues impacting closure and governance.">
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
            title="Compliance overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading compliance overview" : "Compliance overview not loaded yet"}
            description="This route now expects a live backend compliance response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
