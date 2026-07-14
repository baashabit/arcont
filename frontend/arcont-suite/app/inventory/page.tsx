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
import type { InventoryLocationContract, InventoryOverviewContract } from "@/lib/contracts";
import { fetchInventoryOverview, updateInventoryLocation } from "@/lib/platform-api";

function stockTone(stockHealth: InventoryLocationContract["stockHealth"]) {
  switch (stockHealth) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function recomputeSummary(locations: InventoryLocationContract[]) {
  const accuracy =
    locations.length > 0
      ? Number((locations.reduce((sum, item) => sum + item.accuracy, 0) / locations.length).toFixed(1))
      : 0;

  return {
    trackedSkus: locations.reduce((sum, item) => sum + item.trackedSkus, 0),
    accuracy,
    openVariances: locations.reduce((sum, item) => sum + item.openVariances, 0),
    urgentReplenishments: locations.reduce((sum, item) => sum + item.urgentReplenishments, 0)
  };
}

export default function InventoryPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [overview, setOverview] = useState<InventoryOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | InventoryLocationContract["stockHealth"]>("all");
  const [locationTypeFilter, setLocationTypeFilter] = useState<"all" | InventoryLocationContract["locationType"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
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

    void fetchInventoryOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Inventory overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedLocationId((current) => current ?? result.focusLocation?.id ?? result.locations[0]?.id ?? null);
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

  const filteredLocations = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.locations.filter((location) => {
      const matchesHealth = healthFilter === "all" || location.stockHealth === healthFilter;
      const matchesType = locationTypeFilter === "all" || location.locationType === locationTypeFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        location.locationName.toLowerCase().includes(normalizedSearch) ||
        location.code.toLowerCase().includes(normalizedSearch) ||
        location.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesType && matchesSearch;
    });
  }, [healthFilter, locationTypeFilter, overview, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLocations), [filteredLocations]);

  const selectedLocation = useMemo(
    () => filteredLocations.find((item) => item.id === selectedLocationId) ?? filteredLocations[0] ?? null,
    [filteredLocations, selectedLocationId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.locationId === selectedLocation?.id) ?? [],
    [overview, selectedLocation]
  );

  const actionOptions = useMemo(() => {
    if (!selectedLocation) {
      return [];
    }

    switch (selectedLocation.stockHealth) {
      case "healthy":
        return [
          {
            label: "Move to watch",
            stockHealth: "watch" as const,
            nextAction: "Investigate the emerging stock issue and align a corrective inventory action"
          }
        ];
      case "watch":
        return [
          {
            label: "Recover healthy",
            stockHealth: "healthy" as const,
            nextAction: "Confirm the location is clear of variances and urgent replenishments"
          },
          {
            label: "Escalate critical",
            stockHealth: "critical" as const,
            nextAction: "Escalate the location and protect execution from the stock disruption"
          }
        ];
      default:
        return [
          {
            label: "Stabilize to watch",
            stockHealth: "watch" as const,
            nextAction: "Stabilize stock pressure and keep corrective actions in motion"
          }
        ];
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredLocations.length === 0) {
      setSelectedLocationId(null);
      return;
    }

    const isSelectedVisible = filteredLocations.some((location) => location.id === selectedLocationId);
    if (!isSelectedVisible) {
      setSelectedLocationId(filteredLocations[0]?.id ?? null);
    }
  }, [filteredLocations, overview, selectedLocationId]);

  useEffect(() => {
    setNextActionDraft(selectedLocation?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLocationId, selectedLocation?.id, selectedLocation?.nextAction]);

  async function handleLocationAction(
    stockHealth: InventoryLocationContract["stockHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLocation || !session.accessToken) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the location.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateInventoryLocation(
      selectedLocation.id,
      activeCompany.id,
      {
        stockHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Inventory location update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const locations = current.locations.map((item) => (item.id === response.data?.id ? response.data : item));
      const focusLocation =
        locations
          .slice()
          .sort((left, right) => {
            if (left.stockHealth === "critical" && right.stockHealth !== "critical") {
              return -1;
            }

            if (left.stockHealth !== "critical" && right.stockHealth === "critical") {
              return 1;
            }

            return right.urgentReplenishments - left.urgentReplenishments;
          })[0] ?? null;

      return {
        ...current,
        summary: recomputeSummary(locations),
        locations,
        focusLocation
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`Location moved to ${response.data.stockHealth}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Inventory and warehouse"
      eyebrow="Execution domain"
      description="Traceable stock posture for central warehouses, jobsites and replenishment decisions."
    >
      <ModuleGate moduleKeys={["inventory.warehouse"]} requiredPermissions={["inventory:*"]} title="Inventory">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Tracked SKUs"
                value={filteredSummary.trackedSkus.toLocaleString()}
                footnote="Visible SKU coverage across the filtered warehouse network."
              />
              <KpiCard
                label="Accuracy"
                value={`${filteredSummary.accuracy}%`}
                footnote="Average stock accuracy across the visible location subset."
              />
              <KpiCard
                label="Open variances"
                value={String(filteredSummary.openVariances)}
                footnote="Visible variance signals that still need reconciliation."
              />
              <KpiCard
                label="Urgent replenishments"
                value={String(filteredSummary.urgentReplenishments)}
                footnote="Visible locations that need supply action before execution stops."
              />
            </section>

            <section className="grid cols2">
              <Card title="Warehouse health" description="Live stock, accuracy and replenishment posture by location.">
                <FilterBar summary={`${filteredLocations.length} inventory nodes match the current operating filters`}>
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
                    Type
                    <select
                      className="field"
                      value={locationTypeFilter}
                      onChange={(event) => setLocationTypeFilter(event.target.value as typeof locationTypeFilter)}
                    >
                      <option value="all">All</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="yard">Yard</option>
                      <option value="jobsite">Jobsite</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder="Location, code or next action"
                    />
                  </label>
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? "live backend" : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "inventory ready"}</Badge>
                  <Badge tone={filteredSummary.openVariances > 0 ? "danger" : filteredSummary.urgentReplenishments > 0 ? "warning" : "success"}>
                    {filteredSummary.openVariances > 0
                      ? `${filteredSummary.openVariances} variances`
                      : filteredSummary.urgentReplenishments > 0
                        ? `${filteredSummary.urgentReplenishments} urgent`
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLocations}
                  columns={[
                    {
                      key: "location",
                      label: "Location",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLocationId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.locationName}</strong>
                            <span className="tableCellMuted">{row.code} · {row.locationType}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "coverage",
                      label: "Coverage",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.trackedSkus.toLocaleString()} SKUs</strong>
                          <span className="tableCellMuted">{row.blockedReservations} blocked reservations</span>
                        </div>
                      )
                    },
                    {
                      key: "accuracy",
                      label: "Accuracy",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.accuracy}%</strong>
                          <span className="tableCellMuted">{row.openVariances} open variances</span>
                        </div>
                      )
                    },
                    {
                      key: "signal",
                      label: "Signal",
                      render: (row) => <Badge tone={stockTone(row.stockHealth)}>{row.stockHealth}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected location"
                description="Focused stock and replenishment context for the active location."
                aside={selectedLocation ? <Badge tone={stockTone(selectedLocation.stockHealth)}>{selectedLocation.stockHealth}</Badge> : null}
              >
                {selectedLocation ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Type</div>
                      <div>{selectedLocation.locationType}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Tracked SKUs</div>
                      <div>{selectedLocation.trackedSkus.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Urgent replenishments</div>
                      <div>{selectedLocation.urgentReplenishments}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Blocked reservations</div>
                      <div>{selectedLocation.blockedReservations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next replenishment or variance action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedLocation.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Healthy is blocked while open variances remain.</span>
                        <span className="tableCellMuted">Healthy is also blocked while urgent replenishments remain.</span>
                        <span className="tableCellMuted">Stock health transitions move one step at a time.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.stockHealth === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleLocationAction(option.stockHealth, option.nextAction)}
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
                    title="No location selected"
                    description="Choose a location from the table to inspect stock pressure and next actions."
                    primaryAction={{ label: "Stay on inventory", href: "/inventory" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Variance and replenishment watchlist" description="Operational inventory issues with ownership and current action state.">
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                columns={[
                  {
                    key: "risk",
                    label: "Issue",
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
            title="Inventory overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading inventory overview" : "Inventory overview not loaded yet"}
            description="This route now expects a live backend inventory response for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
