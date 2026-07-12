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
import type { ProcurementOverviewContract, ProcurementPackageContract } from "@/lib/contracts";
import { fetchProcurementOverview } from "@/lib/platform-api";

function statusTone(status: ProcurementPackageContract["status"]) {
  switch (status) {
    case "awarded":
      return "success";
    case "blocked":
      return "danger";
    case "awaiting_approval":
      return "warning";
    case "sourcing":
      return "info";
    default:
      return "gold";
  }
}

export default function ProcurementPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<ProcurementOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setOverview(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchProcurementOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Procurement overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedPackageId((current) => current ?? result.focusPackage?.id ?? result.packages[0]?.id ?? null);
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

  const selectedPackage = useMemo(
    () => overview?.packages.find((item) => item.id === selectedPackageId) ?? overview?.focusPackage ?? null,
    [overview, selectedPackageId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.packageId === selectedPackage?.id) ?? [],
    [overview, selectedPackage]
  );

  return (
    <AppShell
      title="Procurement"
      eyebrow="Execution domain"
      description="Spend control, sourcing throughput and approval posture for construction-heavy buying cycles."
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title="Procurement">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open requisitions"
                value={String(overview.summary.openRequisitions)}
                footnote="Open buying pressure still moving through sourcing or approvals."
              />
              <KpiCard
                label="Avg approval time"
                value={`${overview.summary.averageApprovalHours}h`}
                footnote="Current cycle time for open packages in the tenant."
              />
              <KpiCard
                label="Strategic packages"
                value={String(overview.summary.strategicPackages)}
                footnote="Packages large enough to require director-level attention."
              />
              <KpiCard
                label="Supplier contention"
                value={`${overview.summary.averageBidCount}`}
                footnote="Average bid competition across current procurement flow."
              />
            </section>

            <section className="grid cols2">
              <Card title="Sourcing board" description="Live packages, budget pressure and award readiness.">
                <FilterBar summary={`${overview.packages.length} packages in the active tenant`}>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "board ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={overview.packages}
                  columns={[
                    {
                      key: "package",
                      label: "Package",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedPackageId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.packageName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.projectName}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "budget",
                      label: "Budget",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.budgetAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">{row.bidCount} bids</span>
                        </div>
                      )
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    },
                    {
                      key: "action",
                      label: "Next action",
                      render: (row) => row.nextAction
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected package"
                description="Commercial, sourcing and approval context for the focused package."
                aside={selectedPackage ? <Badge tone={statusTone(selectedPackage.status)}>{selectedPackage.status}</Badge> : null}
              >
                {selectedPackage ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Buyer</div>
                      <div>{selectedPackage.buyer}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div>{selectedPackage.projectName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Approval cycle</div>
                      <div>{selectedPackage.approvalHours} hours</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Competition</div>
                      <div>{selectedPackage.supplierContention} suppliers competing</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Strategic</div>
                      <div>{selectedPackage.strategic ? "Yes" : "No"}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedPackage.updatedAt).toLocaleString()}</div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No package selected"
                    description="Choose a package from the sourcing board to inspect detail and blockers."
                    primaryAction={{ label: "Stay on procurement", href: "/procurement" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Supply risks and blockers" description="Packages under approval, supplier or execution pressure.">
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
            title="Procurement overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading procurement overview" : "Procurement overview not loaded yet"}
            description="This route now expects a live backend procurement response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
