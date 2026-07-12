"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  fetchComplianceOverview,
  fetchCrmOverview,
  fetchDocumentControlOverview,
  fetchProcurementOverview,
  fetchQualityOverview
} from "@/lib/platform-api";

type CopilotContext = {
  crm: NonNullable<Awaited<ReturnType<typeof fetchCrmOverview>>>;
  procurement: NonNullable<Awaited<ReturnType<typeof fetchProcurementOverview>>>;
  compliance: NonNullable<Awaited<ReturnType<typeof fetchComplianceOverview>>>;
  quality: NonNullable<Awaited<ReturnType<typeof fetchQualityOverview>>>;
  documentControl: NonNullable<Awaited<ReturnType<typeof fetchDocumentControlOverview>>>;
};

export default function CopilotPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [context, setContext] = useState<CopilotContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setContext(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchCrmOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchProcurementOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchComplianceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchQualityOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([crm, procurement, compliance, quality, documentControl]) => {
        if (cancelled) {
          return;
        }

        if (!crm || !procurement || !compliance || !quality || !documentControl) {
          setError("Copilot could not assemble enough live context.");
          return;
        }

        setContext({
          crm,
          procurement,
          compliance,
          quality,
          documentControl
        });
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

  const suggestions = useMemo(() => {
    if (!context) {
      return [];
    }

    return [
      {
        title: "Which sales are at risk this week",
        detail: `Cross ${context.crm.summary.reservations} reservations with ${context.compliance.summary.atRiskCases} at-risk compliance cases.`
      },
      {
        title: "Summarize blockers in the highest-pressure front",
        detail: `Cross ${context.quality.summary.openFindings} quality findings with ${context.procurement.summary.openRequisitions} open requisitions.`
      },
      {
        title: "Draft a committee update",
        detail: `Use forecast revenue, document backlog and procurement pressure from the live executive state.`
      },
      {
        title: "Which contractors are driving rework",
        detail: `Cross ${context.quality.summary.averageReworkRate}% average rework with active quality inspections and findings.`
      }
    ];
  }, [context]);

  const responseBlocks = useMemo(() => {
    if (!context) {
      return [];
    }

    const salesRiskCount = Math.min(context.compliance.summary.atRiskCases, context.crm.summary.reservations);
    const topCommercialSignal = context.crm.focusBucket?.signal ?? "Commercial signals are stable right now.";
    const topQualitySignal = context.quality.focusInspection?.nextAction ?? "No critical quality action in focus.";
    const topDocumentSignal = context.documentControl.focusItem?.nextAction ?? "No document-control escalation in focus.";

    return [
      {
        title: "Sales at risk",
        detail: `Detected ${salesRiskCount} sales paths where reservations and downstream compliance pressure overlap. ${topCommercialSignal}`
      },
      {
        title: "Main operating focus",
        detail: `Current pressure is concentrated in quality and supply execution. ${topQualitySignal}`
      },
      {
        title: "Suggested actions",
        detail: `Prioritize document closure, unblock procurement approvals and resolve the active field-quality signal. ${topDocumentSignal}`
      },
      {
        title: "Ready to share",
        detail: "This summary can be converted into an executive note, field follow-up or committee briefing."
      }
    ];
  }, [context]);

  const aiMetrics = useMemo(() => {
    if (!context) {
      return null;
    }

    const connectedData = Math.round(
      (
        context.compliance.summary.averageDocumentCompletion +
        context.quality.summary.releaseReadiness +
        Math.max(60, 100 - context.procurement.summary.averageApprovalHours / 2)
      ) / 3
    );

    return {
      connectedData,
      auditableResponses: Math.max(70, connectedData - 5),
      suggestedAutomations: Math.max(55, Math.round((context.procurement.summary.openRequisitions + context.documentControl.summary.openRfis) / 2))
    };
  }, [context]);

  return (
    <AppShell
      title="AI operations copilot"
      eyebrow="Context-aware AI"
      description="A contextual assistant view grounded in live commercial, operational, quality and compliance signals."
      actions={
        <Badge tone={session.authenticated ? "success" : "warning"}>
          {isLoading ? "refreshing" : session.authenticated ? "live context" : source}
        </Badge>
      }
    >
      <ModuleGate
        moduleKeys={["integrations.field-data"]}
        requiredPermissions={["integrations:*"]}
        title="AI Copilot"
      >
        {context && aiMetrics ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Connected data"
                value={`${aiMetrics.connectedData}%`}
                footnote="Directional score for how much live operating context the copilot can already use."
              />
              <KpiCard
                label="Auditable responses"
                value={`${aiMetrics.auditableResponses}%`}
                footnote="Responses grounded in live module overviews instead of generic free text."
              />
              <KpiCard
                label="Suggested automations"
                value={`${aiMetrics.suggestedAutomations}%`}
                footnote="Potential to automate follow-ups and summaries from current operating signals."
              />
              <KpiCard
                label="Cross-area coverage"
                value="5 domains"
                footnote="Sales, procurement, compliance, quality and document control already in context."
              />
            </section>

            <section className="grid cols2">
              <Card title="Suggested prompts" description="Questions the copilot can answer immediately from live context.">
                <div className="list">
                  {suggestions.map((item) => (
                    <div className="listItem" key={item.title}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Contextual answer" description="A grounded operating response assembled from current live signals.">
                <div className="list">
                  {responseBlocks.map((item) => (
                    <div className="listItem" key={item.title}>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Copilot skills" description="The assistant now sits on top of real operating context.">
                <div className="tagRow">
                  <span className="tag">summarize</span>
                  <span className="tag">draft</span>
                  <span className="tag">alert</span>
                  <span className="tag">compare</span>
                  <span className="tag">query</span>
                </div>
              </Card>

              <Card title="AI maturity" description="Directional quality of the current copilot layer.">
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Connected data</div>
                    <div>{aiMetrics.connectedData}%</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Auditable answers</div>
                    <div>{aiMetrics.auditableResponses}%</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Suggested automations</div>
                    <div>{aiMetrics.suggestedAutomations}%</div>
                  </div>
                </div>
              </Card>

              <Card title="Why it matters" description="This is where ARCONT starts to feel like applied AI, not a disconnected chatbot.">
                <p className="sectionText">
                  The copilot is now grounded in the live state of sales, supply, quality, compliance and document control for the active tenant.
                </p>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="AI copilot unavailable"
            description={error}
            primaryAction={{ label: "Open dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading AI copilot context" : "AI copilot not loaded yet"}
            description="This route assembles live operating context before presenting suggestions and contextual answers."
            primaryAction={{ label: "Open dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
