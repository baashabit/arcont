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
import type { CostControlLineContract, CostControlOverviewContract } from "@/lib/contracts";
import { fetchCostControlOverview, updateCostControlLine } from "@/lib/platform-api";

function healthTone(health: CostControlLineContract["controlHealth"]) {
  switch (health) {
    case "on_track":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function statusTone(status: CostControlLineContract["procurementStatus"]) {
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

function collectionTone(health: CostControlLineContract["collectionHealth"]) {
  switch (health) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function costHealthLabel(health: CostControlLineContract["controlHealth"]) {
  switch (health) {
    case "on_track":
      return { es: "En control", en: "On track" };
    case "watch":
      return { es: "En vigilancia", en: "Watch" };
    default:
      return { es: "Crítico", en: "Critical" };
  }
}

function procurementLabel(status: CostControlLineContract["procurementStatus"]) {
  switch (status) {
    case "draft":
      return { es: "Borrador", en: "Draft" };
    case "sourcing":
      return { es: "En cotización", en: "Sourcing" };
    case "awaiting_approval":
      return { es: "Pendiente de aprobación", en: "Awaiting approval" };
    case "awarded":
      return { es: "Adjudicada", en: "Awarded" };
    default:
      return { es: "Bloqueada", en: "Blocked" };
  }
}

function collectionHealthLabel(health: CostControlLineContract["collectionHealth"]) {
  switch (health) {
    case "controlled":
      return { es: "Controlada", en: "Controlled" };
    case "watch":
      return { es: "En vigilancia", en: "Watch" };
    default:
      return { es: "Crítica", en: "Critical" };
  }
}

function costActionLabel(label: string) {
  const labels: Record<string, { es: string; en: string }> = {
    "Start sourcing": { es: "Iniciar cotización", en: "Start sourcing" },
    "Send to approval": { es: "Enviar a aprobación", en: "Send to approval" },
    "Block line": { es: "Bloquear partida", en: "Block line" },
    "Return to sourcing": { es: "Volver a cotización", en: "Return to sourcing" },
    "Award line": { es: "Adjudicar partida", en: "Award line" },
    "Block approval": { es: "Bloquear aprobación", en: "Block approval" },
    "Resume sourcing": { es: "Reanudar cotización", en: "Resume sourcing" }
  };

  return labels[label] ?? { es: label, en: label };
}

function costRouteLabel(href: string) {
  switch (href) {
    case "/procurement":
      return { es: "Abrir compras", en: "Open procurement" };
    case "/cash-flow":
      return { es: "Abrir flujo de efectivo", en: "Open cash flow" };
    case "/projects":
      return { es: "Abrir proyectos", en: "Open projects" };
    default:
      return { es: "Abrir finanzas", en: "Open finance" };
  }
}

function buildCostHumanStepSpanish(line: CostControlLineContract | null) {
  if (!line) {
    return "Selecciona una partida para definir la acción de recuperación.";
  }

  if (line.controlHealth === "critical") {
    return "Contén la desviación y el riesgo de cobro antes de avanzar la compra o comprometer más costo.";
  }

  if (line.procurementStatus === "draft" || line.procurementStatus === "sourcing") {
    return "Completa la comparación comercial y documenta la cobertura de cotizaciones antes de solicitar aprobación.";
  }

  if (line.procurementStatus === "awaiting_approval") {
    return "Resuelve las diferencias de pronóstico y confirma el responsable de cobro antes de adjudicar la partida.";
  }

  return "Conserva la coordinación entre compras, avance de proyecto y flujo de efectivo hasta cerrar la exposición.";
}

function lineActionOptions(line: CostControlLineContract) {
  switch (line.procurementStatus) {
    case "draft":
      return [
        {
          label: "Start sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Open supplier outreach and lock the first commercial comparison"
        }
      ];
    case "sourcing":
      return [
        {
          label: "Send to approval",
          procurementStatus: "awaiting_approval" as const,
          nextAction: "Freeze proposal comparison and route package for decision"
        },
        {
          label: "Block line",
          procurementStatus: "blocked" as const,
          nextAction: "Stop sourcing and escalate the commercial or technical blocker"
        }
      ];
    case "awaiting_approval":
      return [
        {
          label: "Return to sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Refresh pricing and close the pending commercial gaps"
        },
        {
          label: "Award line",
          procurementStatus: "awarded" as const,
          nextAction: "Align award release with field execution and cash plan"
        },
        {
          label: "Block approval",
          procurementStatus: "blocked" as const,
          nextAction: "Pause approval until the variance driver is contained"
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume sourcing",
          procurementStatus: "sourcing" as const,
          nextAction: "Reopen sourcing after resolving the blocking cause"
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(lines: CostControlLineContract[]) {
  return {
    trackedLines: lines.length,
    totalBudget: lines.reduce((sum, item) => sum + item.budgetAmount, 0),
    committedCost: lines.reduce((sum, item) => sum + item.committedCost, 0),
    forecastAtCompletion: lines.reduce((sum, item) => sum + item.forecastAtCompletion, 0),
    forecastVariance: lines.reduce((sum, item) => sum + item.varianceAmount, 0),
    criticalLines: lines.filter((item) => item.controlHealth === "critical").length,
    cashRiskLines: lines.filter(
      (item) => item.collectionHealth === "critical" || item.overdueCollectionDays > 30
    ).length
  };
}

function pickFocusLine(lines: CostControlLineContract[]) {
  return (
    lines
      .slice()
      .sort((left, right) => {
        if (left.controlHealth === "critical" && right.controlHealth !== "critical") {
          return -1;
        }

        if (left.controlHealth !== "critical" && right.controlHealth === "critical") {
          return 1;
        }

        if (right.overdueCollectionDays !== left.overdueCollectionDays) {
          return right.overdueCollectionDays - left.overdueCollectionDays;
        }

        return right.varianceAmount - left.varianceAmount;
      })[0] ?? null
  );
}

export default function CostControlPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText, uiLanguage } = useAppState();
  const t = (es: string, en: string) => localizeText({ es, en });
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [overview, setOverview] = useState<CostControlOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<"all" | CostControlLineContract["controlHealth"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchCostControlOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Cost control overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedLineId((current) => current ?? result.focusLine?.id ?? result.lines[0]?.id ?? null);
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

  const projectOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.lines.map((item) => item.projectName))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [overview]);

  const filteredLines = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.lines.filter((item) => {
      const matchesProject = projectFilter === "all" || item.projectName === projectFilter;
      const matchesHealth = healthFilter === "all" || item.controlHealth === healthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.packageName.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch) ||
        item.projectName.toLowerCase().includes(normalizedSearch);

      return matchesProject && matchesHealth && matchesSearch;
    });
  }, [healthFilter, overview, projectFilter, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedExceptions = useMemo(
    () => overview?.exceptions.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const actionOptions = useMemo(() => (selectedLine ? lineActionOptions(selectedLine) : []), [selectedLine]);
  const selectedCostHumanStep = uiLanguage === "es" ? buildCostHumanStepSpanish(selectedLine) : selectedLine?.nextAction ?? "Choose a cost line to define the next recovery action.";
  const selectedCostDecision = !selectedLine
    ? t("Selecciona una partida para revisar su postura.", "Select a line to review its posture.")
    : selectedLine.controlHealth === "critical"
      ? t("No avances la partida: la desviación o el cobro siguen comprometiendo el costo real.", "Do not advance the line: variance or collection still compromises real cost.")
      : selectedLine.procurementStatus === "awaiting_approval"
        ? t("La partida requiere una decisión comercial con pronóstico y cobertura de cotizaciones alineados.", "The line needs a commercial decision with forecast and bid coverage aligned.")
        : t("La partida puede seguir, pero conserva compras, avance y cobro alineados.", "The line can continue, but keep procurement, progress and collection aligned.");

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredLines.length === 0) {
      setSelectedLineId(null);
      return;
    }

    const isSelectedVisible = filteredLines.some((item) => item.id === selectedLineId);
    if (!isSelectedVisible) {
      setSelectedLineId(filteredLines[0]?.id ?? null);
    }
  }, [filteredLines, overview, selectedLineId]);

  useEffect(() => {
    setNextActionDraft(selectedLine?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedLineId, selectedLine?.id, selectedLine?.nextAction]);

  async function handleLineAction(
    procurementStatus: CostControlLineContract["procurementStatus"],
    suggestedNextAction: string,
    successMessage?: string
  ) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the line.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateCostControlLine(
      selectedLine.id,
      activeCompany.id,
      {
        procurementStatus,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Cost control line update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const lines = current.lines.map((item) => (item.id === response.data?.id ? response.data : item));

      return {
        ...current,
        summary: recomputeSummary(lines),
        lines,
        focusLine: pickFocusLine(lines)
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(successMessage ?? `Line moved to ${response.data.procurementStatus}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title={t("Control de costos", "Cost control")}
      eyebrow={t("Finanzas de ejecución", "Execution finance")}
      description={t("Desviación presupuestal, presión de pronóstico y acciones de compra ligadas al avance real de proyecto.", "Budget drift, forecast pressure and procurement actions tied to real project progress.")}
    >
      <ModuleGate moduleKeys={["procurement.purchasing"]} requiredPermissions={["procurement:*"]} title={t("Control de costos", "Cost control")}>
        {overview ? (
          <>
            <section className="grid cols2">
              <Card
                title={t("Control de partida", "Cost line control")}
                description={t("Decide si la partida puede avanzar sin aumentar la desviación o la exposición de cobro.", "Decide whether the line can advance without increasing variance or collection exposure.")}
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.controlHealth)}>{localizeText(costHealthLabel(selectedLine.controlHealth))}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">{t("Partida", "Line")}</div><div><strong>{selectedLine.packageName}</strong><div className="tableCellMuted">{selectedLine.code} · {selectedLine.projectName}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Decisión", "Decision")}</div><div className="tableCellStack"><Badge tone={healthTone(selectedLine.controlHealth)}>{localizeText(costHealthLabel(selectedLine.controlHealth))}</Badge><span className="tableCellMuted">{selectedCostDecision}</span></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Presupuesto / pronóstico", "Budget / forecast")}</div><div><strong>MXN {selectedLine.budgetAmount.toLocaleString()} / MXN {selectedLine.forecastAtCompletion.toLocaleString()}</strong><div className="tableCellMuted">{t("Desviación", "Variance")}: MXN {selectedLine.varianceAmount.toLocaleString()} · {selectedLine.variancePercent}%</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Compra", "Procurement")}</div><div><Badge tone={statusTone(selectedLine.procurementStatus)}>{localizeText(procurementLabel(selectedLine.procurementStatus))}</Badge><div className="tableCellMuted">{t("Comprador", "Buyer")}: {selectedLine.buyer}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Exposición de cobro", "Collection exposure")}</div><div><strong>MXN {selectedLine.cashExposure.toLocaleString()}</strong><div className="tableCellMuted">{localizeText(collectionHealthLabel(selectedLine.collectionHealth))} · {selectedLine.overdueCollectionDays} {t("días vencidos", "overdue days")}</div></div></div>
                    <div className="detailRow"><div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div><div>{selectedCostHumanStep}</div></div>
                    <label className="stack"><span className="detailLabel">{t("Próxima acción", "Next action")}</span><input className="field" value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} placeholder={t("Describe la recuperación, contención o adjudicación", "Describe recovery, containment or award")} /></label>
                    <div className="cluster">
                      <button className="button" type="button" disabled={isSaving} onClick={() => void handleLineAction(selectedLine.procurementStatus, selectedLine.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : t("Guardar acción", "Save action")}</button>
                      {actionOptions.map((option) => <button key={option.label} className={option.procurementStatus === "blocked" ? "buttonGhost" : "button"} type="button" disabled={isSaving || (option.procurementStatus === "awarded" && (selectedLine.controlHealth === "critical" || selectedLine.collectionHealth === "critical")) || (option.procurementStatus === "awaiting_approval" && selectedLine.riskDrivers.some((driver) => driver.includes("Insufficient bid coverage")))} onClick={() => void handleLineAction(option.procurementStatus, option.nextAction)}>{isSaving ? t("Guardando...", "Saving...") : localizeText(costActionLabel(option.label))}</button>)}
                    </div>
                    <div className="row gap wrap">{["/procurement", "/cash-flow", "/finance", "/projects"].map((href, index) => <Link key={href} className={index === 0 ? "buttonSecondary" : "buttonGhost"} href={href}>{localizeText(costRouteLabel(href))}</Link>)}</div>
                    {actionMessage ? <Badge tone="success">{actionMessage}</Badge> : null}
                    {actionError ? <Badge tone="danger">{actionError}</Badge> : null}
                  </div>
                ) : <EmptyState title={t("Selecciona una partida", "Select a cost line")} description={t("Elige una partida desde la bandeja para revisar su recuperación.", "Choose a line from the queue to review recovery.")} />}
              </Card>

              <Card title={t("Bandeja de costos", "Cost queue")} description={t("Filtra y cambia de partida sin perder la decisión financiera principal.", "Filter and switch cost lines without losing the primary financial decision.")}>
                <FilterBar summary={t(`${filteredLines.length} partidas coinciden con los filtros actuales`, `${filteredLines.length} lines match the current filters`)}>
                  <label className="fieldLabel">{t("Proyecto", "Project")}<select className="field" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="all">{t("Todos", "All")}</option>{projectOptions.map((projectName) => <option key={projectName} value={projectName}>{projectName}</option>)}</select></label>
                  <label className="fieldLabel">{t("Salud", "Health")}<select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as "all" | CostControlLineContract["controlHealth"])}><option value="all">{t("Todas", "All")}</option><option value="on_track">{t("En control", "On track")}</option><option value="watch">{t("Vigilancia", "Watch")}</option><option value="critical">{t("Crítica", "Critical")}</option></select></label>
                  <label className="fieldLabel">{t("Búsqueda", "Search")}<input className="field" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Partida, clave o proyecto", "Package, code or project")} /></label>
                </FilterBar>
                {filteredLines.length > 0 ? <div className="list">{filteredLines.map((line) => <button key={line.id} type="button" className={`listItem ${selectedLine?.id === line.id ? "listItemSelected" : ""}`} style={{ width: "100%", textAlign: "left", cursor: "pointer" }} onClick={() => setSelectedLineId(line.id)}><div><strong>{line.packageName} · MXN {line.varianceAmount.toLocaleString()}</strong><p>{line.projectName} · {localizeText(procurementLabel(line.procurementStatus))}</p></div><div className="tableCellStack"><Badge tone={healthTone(line.controlHealth)}>{localizeText(costHealthLabel(line.controlHealth))}</Badge><span className="tableCellMuted">{line.projectProgress}% {t("avance", "progress")}</span></div></button>)}</div> : <EmptyState title={t("Sin partidas para estos filtros", "No cost lines for these filters")} description={t("Limpia o cambia los filtros para recuperar la bandeja activa.", "Clear or change filters to recover the active queue.")} />}
              </Card>
            </section>

            <details className="fieldAdvanced">
              <summary>{t("Abrir indicadores, detalle, excepciones y bloqueos", "Open metrics, detail, exceptions and blockers")}</summary>
              <div className="fieldAdvancedContent">
            <section className="grid cols4">
              <KpiCard
                label="Tracked lines"
                value={String(filteredSummary.trackedLines)}
                footnote="Procurement-backed lines tied to project execution pressure."
              />
              <KpiCard
                label="Total budget"
                value={`MXN ${filteredSummary.totalBudget.toLocaleString()}`}
                footnote="Controlled budget baseline across active cost lines."
              />
              <KpiCard
                label="Forecast variance"
                value={`MXN ${filteredSummary.forecastVariance.toLocaleString()}`}
                footnote="Current drift between budget and forecast at completion."
              />
              <KpiCard
                label="Critical lines"
                value={String(filteredSummary.criticalLines)}
                footnote="Lines that should not advance without variance containment."
              />
              <KpiCard
                label="Cash-risk lines"
                value={String(filteredSummary.cashRiskLines)}
                footnote="Lines where forecast pressure is already colliding with collection exposure."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Cost walkthrough"
                description="Operate forecast drift, procurement blockage and cash exposure from a practical execution-finance board."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    This page is already useful for human tests: review line health, push sourcing states and inspect forecast pressure without waiting for production backend flows.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">cost control</Badge>
                    <Badge tone="info">forecast</Badge>
                    <Badge tone="info">cash exposure</Badge>
                  </div>
                </div>
              </Card>

              <Card title="Cost board" description="Budget, commitment and forecast posture across the active company cost lines.">
                <FilterBar summary={`${filteredLines.length} cost lines in the active tenant`}>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">All projects</option>
                    {projectOptions.map((projectName) => (
                      <option key={projectName} value={projectName}>
                        {projectName}
                      </option>
                    ))}
                  </select>
                  <select
                    className="selectField"
                    value={healthFilter}
                    onChange={(event) => setHealthFilter(event.target.value as "all" | CostControlLineContract["controlHealth"])}
                  >
                    <option value="all">All health</option>
                    <option value="on_track">on_track</option>
                    <option value="watch">watch</option>
                    <option value="critical">critical</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search package, code or project"
                  />
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "cost view ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "line",
                      label: "Line",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
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
                      label: "Budget vs forecast",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.budgetAmount.toLocaleString()}</strong>
                          <span className="tableCellMuted">
                            forecast MXN {row.forecastAtCompletion.toLocaleString()}
                          </span>
                        </div>
                      )
                    },
                    {
                      key: "progress",
                      label: "Progress",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectProgress}%</strong>
                          <span className="tableCellMuted">
                            {row.scheduleVarianceDays.toFixed(1)} days variance
                          </span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => (
                        <div className="row gap wrap">
                          <Badge tone={healthTone(row.controlHealth)}>{row.controlHealth}</Badge>
                          <Badge tone={collectionTone(row.collectionHealth)}>{row.collectionHealth}</Badge>
                        </div>
                      )
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected line"
                description="Forecast, cash exposure and recovery actions for the focused cost line."
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.controlHealth)}>{selectedLine.controlHealth}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Procurement status</div>
                      <div className="tagRow">
                        <Badge tone={statusTone(selectedLine.procurementStatus)}>
                          {selectedLine.procurementStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Buyer</div>
                      <div>{selectedLine.buyer}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Collection owner</div>
                      <div>{selectedLine.collectionOwner}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Committed cost</div>
                      <div>MXN {selectedLine.committedCost.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Spent to date</div>
                      <div>MXN {selectedLine.spentToDate.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Cash exposure</div>
                      <div>
                        MXN {selectedLine.cashExposure.toLocaleString()}
                        <div className="tableCellMuted">
                          pending collection MXN {selectedLine.pendingCollection.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Variance</div>
                      <div>
                        MXN {selectedLine.varianceAmount.toLocaleString()} · {selectedLine.variancePercent}%
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Collection aging</div>
                      <div>
                        <Badge tone={collectionTone(selectedLine.collectionHealth)}>{selectedLine.collectionHealth}</Badge>
                        <div className="tableCellMuted">{selectedLine.overdueCollectionDays} overdue days on the cash cycle</div>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Drivers</div>
                      <div className="tableCellStack">
                        {selectedLine.riskDrivers.map((driver) => (
                          <span className="tableCellMuted" key={driver}>
                            {driver}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        <Link className="buttonGhost" href="/procurement">
                          Open procurement
                        </Link>
                        <Link className="buttonGhost" href="/finance">
                          Open finance
                        </Link>
                        <Link className="buttonGhost" href="/cash-flow">
                          Open cash flow
                        </Link>
                        <Link className="buttonGhost" href="/projects">
                          Open projects
                        </Link>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the recovery, containment or award action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Award is blocked while forecast drift stays critical.</span>
                        <span className="tableCellMuted">Approval still requires bid coverage from procurement.</span>
                        <span className="tableCellMuted">Cash-risk lines should not be treated as financially clean even if sourcing advances.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          <button
                            className="button"
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              void handleLineAction(
                                selectedLine.procurementStatus,
                                selectedLine.nextAction,
                                "Cost line action updated."
                              )
                            }
                          >
                            {isSaving ? "Saving..." : "Save next action"}
                          </button>
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.procurementStatus === "blocked" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.procurementStatus === "awarded" &&
                                  (selectedLine.controlHealth === "critical" || selectedLine.collectionHealth === "critical")) ||
                                (option.procurementStatus === "awaiting_approval" &&
                                  selectedLine.riskDrivers.some((driver) => driver.includes("Insufficient bid coverage")))
                              }
                              onClick={() => void handleLineAction(option.procurementStatus, option.nextAction)}
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
                    title="No cost line selected"
                    description="Choose a cost line to inspect drift, cash pressure and recovery actions."
                    primaryAction={{ label: "Stay on cost control", href: "/cost-control" }}
                  />
                )}
              </Card>
            </section>

            <Card title="Exceptions and blockers" description="Commercial, schedule and control exceptions tied to active cost lines.">
              <DataTable
                rows={selectedExceptions.length > 0 ? selectedExceptions : overview.exceptions}
                columns={[
                  {
                    key: "exception",
                    label: "Exception",
                    render: (item) => (
                      <div className="tableCellStack">
                        <strong>{item.title}</strong>
                        <span className="tableCellMuted">{item.category}</span>
                      </div>
                    )
                  },
                  {
                    key: "severity",
                    label: "Severity",
                    render: (item) => (
                      <Badge tone={item.severity === "critical" ? "danger" : item.severity === "warning" ? "warning" : "info"}>
                        {item.severity}
                      </Badge>
                    )
                  },
                  {
                    key: "owner",
                    label: "Owner",
                    render: (item) => item.owner
                  },
                  {
                    key: "status",
                    label: "Current action",
                    render: (item) => item.status
                  }
                ]}
              />
            </Card>
              </div>
            </details>
          </>
        ) : error ? (
          <EmptyState
            title="Cost control overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open budget book", href: "/budget-book" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading cost control overview" : "Cost control overview not loaded yet"}
            description="Open a cost line to test forecast, procurement and cash exposure in demo mode or with the live tenant backend."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
