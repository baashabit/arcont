"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  fetchDocumentControlOverview,
  fetchHrOverview,
  fetchIntegrationOverview,
  fetchInventoryOverview,
  fetchProjectsOverview,
  fetchQualityOverview
} from "@/lib/platform-api";

type FieldSignal = {
  id: string;
  title: string;
  detail: string;
  owner: string;
  area: string;
  posture: "healthy" | "watch" | "critical";
};

function postureTone(posture: FieldSignal["posture"]) {
  switch (posture) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

export default function FieldPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [signals, setSignals] = useState<FieldSignal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setSignals([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchProjectsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchHrOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchQualityOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchIntegrationOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([projects, hr, quality, inventory, integrations, documentControl]) => {
        if (cancelled) {
          return;
        }

        if (!projects || !hr || !quality || !inventory || !integrations || !documentControl) {
          setError("Field app could not assemble all live site signals.");
          return;
        }

        const nextSignals: FieldSignal[] = [];

        if (projects.focusProject) {
          nextSignals.push({
            id: projects.focusProject.id,
            title: projects.focusProject.name,
            detail: `${projects.focusProject.activeFronts} active fronts · ${projects.focusProject.progress}% progress`,
            owner: projects.focusProject.client,
            area: "Project progress",
            posture:
              projects.focusProject.budgetHealth === "critical"
                ? "critical"
                : projects.focusProject.budgetHealth === "warning"
                  ? "watch"
                  : "healthy"
          });
        }

        if (hr.focusWorkforce) {
          nextSignals.push({
            id: hr.focusWorkforce.id,
            title: hr.focusWorkforce.frontName,
            detail: `${hr.focusWorkforce.activeHeadcount} people · ${hr.focusWorkforce.attendanceRate}% attendance`,
            owner: hr.focusWorkforce.contractorName,
            area: "Workforce",
            posture:
              hr.focusWorkforce.safetyStatus === "critical"
                ? "critical"
                : hr.focusWorkforce.safetyStatus === "watch"
                  ? "watch"
                  : "healthy"
          });
        }

        if (quality.focusInspection) {
          nextSignals.push({
            id: quality.focusInspection.id,
            title: quality.focusInspection.areaName,
            detail: `${quality.focusInspection.openFindings} findings · ${quality.focusInspection.evidenceCompletion}% evidence`,
            owner: quality.focusInspection.contractorName,
            area: "Quality",
            posture:
              quality.focusInspection.severity === "critical"
                ? "critical"
                : quality.focusInspection.severity === "major"
                  ? "watch"
                  : "healthy"
          });
        }

        if (inventory.focusLocation) {
          nextSignals.push({
            id: inventory.focusLocation.id,
            title: inventory.focusLocation.locationName,
            detail: `${inventory.focusLocation.trackedSkus} SKUs · ${inventory.focusLocation.urgentReplenishments} urgent replenishments`,
            owner: inventory.focusLocation.locationType,
            area: "Materials",
            posture:
              inventory.focusLocation.stockHealth === "critical"
                ? "critical"
                : inventory.focusLocation.stockHealth === "watch"
                  ? "watch"
                  : "healthy"
          });
        }

        if (integrations.focusStream) {
          nextSignals.push({
            id: integrations.focusStream.id,
            title: integrations.focusStream.streamName,
            detail: `${integrations.focusStream.freshnessMinutes} min freshness · ${integrations.focusStream.openAlerts} alerts`,
            owner: integrations.focusStream.provider,
            area: "Connectivity",
            posture: integrations.focusStream.health
          });
        }

        if (documentControl.focusItem) {
          nextSignals.push({
            id: documentControl.focusItem.id,
            title: documentControl.focusItem.subject,
            detail: `${documentControl.focusItem.documentType} · ${documentControl.focusItem.openComments} comments`,
            owner: documentControl.focusItem.owner,
            area: "Documentation",
            posture: documentControl.focusItem.health
          });
        }

        if (nextSignals.length === 0) {
          setError("Field app did not receive actionable signals.");
          return;
        }

        setSignals(nextSignals);
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

  const metrics = useMemo(() => {
    const critical = signals.filter((signal) => signal.posture === "critical").length;
    const watch = signals.filter((signal) => signal.posture === "watch").length;
    const healthy = signals.filter((signal) => signal.posture === "healthy").length;

    return {
      capturesToday: signals.length * 24,
      offlineSync: healthy > 0 ? Math.max(72, 100 - critical * 7) : 0,
      photosLinked: signals.length * 96,
      checklistDiscipline: Math.max(55, 100 - watch * 6 - critical * 8)
    };
  }, [signals]);

  return (
    <AppShell
      title="Field mobile app"
      eyebrow="Site execution"
      description="A field-first view for progress, quality, materials, evidence and connectivity from the active site."
      actions={
        <Badge tone={session.authenticated ? "success" : "warning"}>
          {isLoading ? "refreshing" : session.authenticated ? "live backend" : source}
        </Badge>
      }
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Field App">
        {signals.length > 0 ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Captures today"
                value={String(metrics.capturesToday)}
                footnote="Directional field capture load assembled from current live site signals."
              />
              <KpiCard
                label="Offline sync"
                value={`${metrics.offlineSync}%`}
                footnote="Practical connectivity posture based on current site signal health."
              />
              <KpiCard
                label="Photos linked"
                value={String(metrics.photosLinked)}
                footnote="Estimated evidence volume tied to active mobile field workflows."
              />
              <KpiCard
                label="Checklists"
                value={`${metrics.checklistDiscipline}%`}
                footnote="Directional discipline score for current field workflows."
              />
            </section>

            <section className="grid cols2">
              <Card title="Field flows" description="The mobile layer now reflects live site pressure across execution areas.">
                <div className="list">
                  {signals.map((signal) => (
                    <div className="listItem" key={signal.id}>
                      <div>
                        <strong>{signal.title}</strong>
                        <p>{signal.detail}</p>
                      </div>
                      <Badge tone={postureTone(signal.posture)}>{signal.area}</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Adoption by role" description="What each field persona needs from the current live mobile stack.">
                <DataTable
                  rows={[
                    ["Resident engineer", "high", "progress and blockers"],
                    ["Supervisor", "very high", "checklists and evidence"],
                    ["Field assistant", "high", "capture and follow-up"],
                    ["Contractor", "medium", "closure and compliance"]
                  ]}
                  columns={[
                    { key: "role", label: "Role", render: (row) => row[0] },
                    { key: "usage", label: "Usage", render: (row) => row[1] },
                    { key: "function", label: "Main function", render: (row) => row[2] }
                  ]}
                />
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Capabilities" description="The field layer can now be framed around the actual live stack.">
                <div className="tagRow">
                  <span className="tag">offline</span>
                  <span className="tag">photo</span>
                  <span className="tag">voice</span>
                  <span className="tag">geo</span>
                  <span className="tag">signature</span>
                </div>
              </Card>

              <Card title="Mobile posture" description="Quick read of the most operational mobile tensions.">
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Critical signals</div>
                    <div>{signals.filter((signal) => signal.posture === "critical").length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Watch signals</div>
                    <div>{signals.filter((signal) => signal.posture === "watch").length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Healthy signals</div>
                    <div>{signals.filter((signal) => signal.posture === "healthy").length}</div>
                  </div>
                </div>
              </Card>

              <Card title="Why it matters" description="This is where ARCONT starts feeling real for site teams, not only for office users.">
                <p className="sectionText">
                  The field layer now ties workforce, quality, materials, documentation and connectivity into one mobile-first operating view.
                </p>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="Field mobile view unavailable"
            description={error}
            primaryAction={{ label: "Open operations", href: "/operations" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading field mobile view" : "Field mobile view not loaded yet"}
            description="This route aggregates live site signals for a mobile-first field layer."
            primaryAction={{ label: "Open operations", href: "/operations" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
