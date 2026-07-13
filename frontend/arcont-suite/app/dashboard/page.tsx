"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleBadge } from "@/components/ui/module-badge";
import {
  fetchComplianceOverview,
  fetchCrmOverview,
  fetchDocumentControlOverview,
  fetchFinanceOverview,
  fetchInventoryMovementsOverview,
  fetchInventoryReceivingOverview,
  fetchInventoryOverview,
  fetchProcurementOverview
} from "@/lib/platform-api";

type ExecutiveSnapshot = {
  crm: NonNullable<Awaited<ReturnType<typeof fetchCrmOverview>>>;
  inventory: NonNullable<Awaited<ReturnType<typeof fetchInventoryOverview>>>;
  inventoryReceiving: NonNullable<Awaited<ReturnType<typeof fetchInventoryReceivingOverview>>>;
  inventoryMovements: NonNullable<Awaited<ReturnType<typeof fetchInventoryMovementsOverview>>>;
  procurement: NonNullable<Awaited<ReturnType<typeof fetchProcurementOverview>>>;
  compliance: NonNullable<Awaited<ReturnType<typeof fetchComplianceOverview>>>;
  finance: NonNullable<Awaited<ReturnType<typeof fetchFinanceOverview>>>;
  documentControl: NonNullable<Awaited<ReturnType<typeof fetchDocumentControlOverview>>>;
};

export default function DashboardPage() {
  const {
    activeCompany,
    activeSettings,
    modules,
    dashboardSummary,
    auditEvents,
    source,
    isRefreshingPlatform,
    refreshDashboard,
    refreshAuditTrail,
    getCompanyModules,
    apiBaseUrl,
    session
  } = useAppState();
  const [snapshot, setSnapshot] = useState<ExecutiveSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);

  useEffect(() => {
    if (!dashboardSummary) {
      void refreshDashboard(activeCompany.id);
    }

    if (auditEvents.length === 0) {
      void refreshAuditTrail(activeCompany.id, 8);
    }
  }, [activeCompany.id, auditEvents.length, dashboardSummary, refreshAuditTrail, refreshDashboard]);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setSnapshot(null);
      return;
    }

    let cancelled = false;
    setIsLoadingSnapshot(true);
    setSnapshotError(null);

    void Promise.all([
      fetchCrmOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryReceivingOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryMovementsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchProcurementOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchComplianceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFinanceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([crm, inventory, inventoryReceiving, inventoryMovements, procurement, compliance, finance, documentControl]) => {
        if (cancelled) {
          return;
        }

        if (!crm || !inventory || !inventoryReceiving || !inventoryMovements || !procurement || !compliance || !finance || !documentControl) {
          setSnapshotError("Executive dashboard could not assemble all live operating signals.");
          return;
        }

        setSnapshot({
          crm,
          inventory,
          inventoryReceiving,
          inventoryMovements,
          procurement,
          compliance,
          finance,
          documentControl
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSnapshot(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

  const companyModules = getCompanyModules(activeCompany.id);
  const enabledModules = companyModules.length
    ? companyModules.filter((entry) => entry.enabled).map((entry) => entry.module)
    : modules.filter((module) => activeCompany.enabledModules.includes(module.key));

  const totals = dashboardSummary?.totals;
  const latestAuditEvents = auditEvents.length > 0 ? auditEvents : dashboardSummary?.latestAuditEvents ?? [];

  const bottlenecks = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      {
        title: "Commercial pipeline",
        detail: `${snapshot.crm.summary.reservations} reservations and ${snapshot.crm.summary.qualifiedLeads} qualified leads in active flow.`,
        tone: snapshot.crm.summary.visitConversion < 20 ? "warning" : "success"
      },
      {
        title: "Inventory pressure",
        detail: `${snapshot.inventory.summary.urgentReplenishments} urgent replenishments and ${snapshot.inventory.summary.openVariances} open variances.`,
        tone: snapshot.inventory.summary.urgentReplenishments > 0 ? "warning" : "success"
      },
      {
        title: "Inbound receiving",
        detail: `${snapshot.inventoryReceiving.summary.overdueEta} overdue arrivals and ${snapshot.inventoryReceiving.summary.blockedReceipts} blocked receipts.`,
        tone: snapshot.inventoryReceiving.summary.blockedReceipts > 0 ? "danger" : snapshot.inventoryReceiving.summary.overdueEta > 0 ? "warning" : "success"
      },
      {
        title: "Movement traceability",
        detail: `${snapshot.inventoryMovements.summary.openMovements} open movements and ${snapshot.inventoryMovements.summary.pendingEvidence} pending evidence items.`,
        tone: snapshot.inventoryMovements.summary.criticalMovements > 0 ? "danger" : "info"
      },
      {
        title: "Procurement approvals",
        detail: `${snapshot.procurement.summary.openRequisitions} open requisitions and ${snapshot.procurement.summary.strategicPackages} strategic packages.`,
        tone: snapshot.procurement.summary.averageApprovalHours > 48 ? "danger" : "info"
      },
      {
        title: "Compliance backlog",
        detail: `${snapshot.compliance.summary.atRiskCases} cases at risk and ${snapshot.compliance.summary.openFindings} open findings.`,
        tone: snapshot.compliance.summary.atRiskCases > 0 ? "danger" : "success"
      }
    ];
  }, [snapshot]);

  const executiveKpis = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return {
      activeProspects: snapshot.crm.summary.qualifiedLeads,
      forecastRevenue: snapshot.crm.summary.forecastRevenue,
      blackboardPressure:
        snapshot.procurement.summary.openRequisitions +
        snapshot.compliance.summary.activeCases +
        snapshot.documentControl.summary.openRfis,
      supplyRisk:
        snapshot.procurement.summary.strategicPackages +
        snapshot.inventory.summary.urgentReplenishments +
        snapshot.inventoryReceiving.summary.blockedReceipts +
        snapshot.inventoryMovements.summary.criticalMovements,
      operatingHealth: Math.round(
        (
          snapshot.compliance.summary.averageDocumentCompletion +
          snapshot.documentControl.summary.averageTurnaroundDays * 10 +
          snapshot.finance.summary.closeReadiness
        ) / 3
      )
    };
  }, [snapshot]);

  const alertRows = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [
      {
        area: "Sales",
        signal: snapshot.crm.focusBucket?.signal ?? "No active signal",
        owner: snapshot.crm.focusBucket?.owner ?? "Sales ops",
        posture: snapshot.crm.focusBucket?.health ?? "watch"
      },
      {
        area: "Compliance",
        signal: snapshot.compliance.focusCase?.nextAction ?? "No active action",
        owner: snapshot.compliance.focusCase?.owner ?? "Customer care",
        posture: snapshot.compliance.focusCase?.health ?? "watch"
      },
      {
        area: "Procurement",
        signal: snapshot.procurement.focusPackage?.nextAction ?? "No active action",
        owner: snapshot.procurement.focusPackage?.buyer ?? "Procurement",
        posture: snapshot.procurement.focusPackage?.status ?? "watch"
      },
      {
        area: "Receiving",
        signal: snapshot.inventoryReceiving.focusReceipt?.nextAction ?? "No active action",
        owner: snapshot.inventoryReceiving.focusReceipt?.supplierName ?? "Warehouse",
        posture: snapshot.inventoryReceiving.focusReceipt?.status ?? "watch"
      },
      {
        area: "Movements",
        signal: snapshot.inventoryMovements.focusMovement?.nextAction ?? "No active action",
        owner: snapshot.inventoryMovements.focusMovement?.requestedBy ?? "Warehouse",
        posture: snapshot.inventoryMovements.focusMovement?.impactLevel ?? "watch"
      },
      {
        area: "Document control",
        signal: snapshot.documentControl.focusItem?.nextAction ?? "No active action",
        owner: snapshot.documentControl.focusItem?.owner ?? "Document control",
        posture: snapshot.documentControl.focusItem?.health ?? "watch"
      }
    ];
  }, [snapshot]);

  return (
    <AppShell
      title="Executive dashboard"
      eyebrow="Direction layer"
      description="Cross-area decision support for sales, supply, compliance and operating risk in one live board."
      actions={
        <Badge tone={source === "api" ? "success" : "warning"}>
          {isRefreshingPlatform || isLoadingSnapshot ? "refreshing" : `${source} data source`}
        </Badge>
      }
    >
      {snapshot && executiveKpis ? (
        <>
          <section className="heroPanel">
            <div>
              <h2>Sales, supply, compliance and execution in one direct reading.</h2>
              <p>
                Direction no longer has to jump across isolated tables. This board now composes live commercial,
                inventory, procurement, finance, compliance and document signals for the active tenant.
              </p>
              <div className="heroMetrics">
                <div className="heroMetric">
                  <strong>{executiveKpis.activeProspects}</strong>
                  <span>Qualified opportunities in active flow</span>
                </div>
                <div className="heroMetric">
                  <strong>{snapshot.compliance.summary.atRiskCases}</strong>
                  <span>Compliance and post-sale cases already at risk</span>
                </div>
                <div className="heroMetric">
                  <strong>{snapshot.procurement.summary.openRequisitions}</strong>
                  <span>Procurement requests still pressuring execution</span>
                </div>
              </div>
            </div>

            <Card
              title="Active tenant focus"
              description="A live direction snapshot for the current tenant and enabled module footprint."
              aside={<Badge tone="gold">{activeCompany.status}</Badge>}
            >
              <div className="statStrip">
                <div className="statTile">
                  <strong>{enabledModules.length}</strong>
                  <span>Enabled modules for {activeCompany.tradeName}</span>
                </div>
                <div className="statTile">
                  <strong>{activeSettings?.currency ?? "MXN"}</strong>
                  <span>Operating currency and localization baseline</span>
                </div>
              </div>
              <p className="sectionText">
                Focus company from the platform summary:
                {" "}
                {dashboardSummary?.focusCompany?.tradeName ?? activeCompany.tradeName}
              </p>
            </Card>
          </section>

          <section className="grid cols4">
            <KpiCard
              label="Forecast revenue"
              value={`MXN ${executiveKpis.forecastRevenue.toLocaleString()}`}
              footnote="Commercial forecast from the current CRM board."
            />
            <KpiCard
              label="Supply risk"
              value={String(executiveKpis.supplyRisk)}
              footnote="Strategic package plus replenishment pressure in current flow."
            />
            <KpiCard
              label="Board pressure"
              value={String(executiveKpis.blackboardPressure)}
              footnote="Cross-domain load from procurement, compliance and document control."
            />
            <KpiCard
              label="Operating health"
              value={`${executiveKpis.operatingHealth}%`}
              footnote="Blended directional signal from close, documents and compliance."
            />
          </section>

          <section className="grid cols2">
            <Card title="Inter-area bottlenecks" description="Where direction should pay attention first across the current portfolio.">
              <div className="list">
                {bottlenecks.map((item) => (
                  <div className="listItem" key={item.title}>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <Badge tone={item.tone as "success" | "warning" | "danger" | "info"}>{item.tone}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Tenant module portfolio" description="Enabled suite areas currently available for this company.">
              <div className="moduleGrid">
                {enabledModules.map((module) => (
                  <div key={module.key} className="moduleCard">
                    <div className="moduleMeta">
                      <div>
                        <h4>{module.name}</h4>
                        <p>{module.description}</p>
                      </div>
                      <ModuleBadge module={module} />
                    </div>
                    <div className="tagRow">
                      <Badge tone={module.scope === "platform" ? "gold" : "info"}>{module.scope}</Badge>
                      <Badge tone="neutral">{module.key}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="grid cols3">
            <Card title="Executive pipeline" description="Directors can now read the commercial and operating funnel quickly.">
              <div className="detailGrid">
                <div className="detailRow">
                  <div className="detailLabel">Qualified leads</div>
                  <div>{snapshot.crm.summary.qualifiedLeads}</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Reservations</div>
                  <div>{snapshot.crm.summary.reservations}</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">At-risk cases</div>
                  <div>{snapshot.compliance.summary.atRiskCases}</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Open RFIs</div>
                  <div>{snapshot.documentControl.summary.openRfis}</div>
                </div>
              </div>
            </Card>

            <Card title="Operating health" description="Simple directional status for the most sensitive execution layers.">
              <div className="detailGrid">
                <div className="detailRow">
                  <div className="detailLabel">Finance close</div>
                  <div>{snapshot.finance.summary.closeReadiness}%</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Docs turnaround</div>
                  <div>{snapshot.documentControl.summary.averageTurnaroundDays} d</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Inventory accuracy</div>
                  <div>{snapshot.inventory.summary.accuracy}%</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Approval cycle</div>
                  <div>{snapshot.procurement.summary.averageApprovalHours} h</div>
                </div>
              </div>
            </Card>

            <Card title="Daily alerts" description="Practical alerts that direction can escalate today.">
              <div className="list">
                {alertRows.map((row) => (
                  <div className="listItem" key={row.area}>
                    <div>
                      <strong>{row.area}</strong>
                      <p>{row.signal}</p>
                    </div>
                    <Badge tone="neutral">{row.owner}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      ) : snapshotError ? (
        <EmptyState
          title="Executive dashboard unavailable"
          description={snapshotError}
          primaryAction={{ label: "Open operations", href: "/operations" }}
          secondaryAction={{ label: "Review login", href: "/login" }}
        />
      ) : (
        <>
          <section className="grid cols4">
            <KpiCard
              label="Companies"
              value={String(totals?.companies ?? enabledModules.length)}
              footnote="Read from GET /platform/dashboard/summary when available."
            />
            <KpiCard
              label="Active companies"
              value={String(totals?.activeCompanies ?? 0)}
              footnote="Platform-wide company activation posture."
            />
            <KpiCard
              label="Users"
              value={String(totals?.users ?? 0)}
              footnote="User totals come from the dashboard summary, not local counting."
            />
            <KpiCard
              label="Enabled modules"
              value={String(totals?.enabledModules ?? enabledModules.length)}
              footnote="Combined module activation read across companies."
            />
          </section>

          <Card title="Audit trail" description="Latest platform activity from GET /platform/audit-events and dashboard summary.">
            {latestAuditEvents.length ? (
              <div className="list">
                {latestAuditEvents.map((event) => (
                  <div className="listItem" key={event.id}>
                    <div>
                      <strong>{event.action}</strong>
                      <p>
                        {event.aggregateType}
                        {" "}
                        /
                        {" "}
                        {event.aggregateId}
                        {" "}
                        ·
                        {" "}
                        {new Date(event.createdAt).toLocaleString("es-MX")}
                      </p>
                    </div>
                    <Badge tone="neutral">{event.companyId ?? "platform"}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title={isLoadingSnapshot ? "Loading executive dashboard" : "No executive snapshot available yet"}
                description="The system is still hydrating live directional signals for the active tenant."
                primaryAction={{ label: "Open operations", href: "/operations" }}
              />
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}
