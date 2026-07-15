"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import type { FinanceLedgerItemContract, FinanceOverviewContract, TreasuryPaymentRunsOverviewContract } from "@/lib/contracts";
import {
  fetchAccountsPayableOverview,
  fetchFinanceOverview,
  fetchSupplierMasterOverview,
  fetchTreasuryPaymentRunsOverview,
  updateFinanceLedgerItem
} from "@/lib/platform-api";

function satTone(status: FinanceLedgerItemContract["satStatus"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function financeActionOptions(item: FinanceLedgerItemContract) {
  switch (item.satStatus) {
    case "critical":
      return [
        {
          label: "Move to watch",
          satStatus: "watch" as const,
          note: "Critical exceptions reduced; keep active monitoring until close evidence stabilizes."
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate to critical",
          satStatus: "critical" as const,
          note: "Escalate because fiscal or close pressure remains unresolved."
        },
        {
          label: "Mark controlled",
          satStatus: "controlled" as const,
          note: "Exceptions resolved and fiscal control is back within acceptable posture."
        }
      ];
    case "controlled":
      return [
        {
          label: "Move to watch",
          satStatus: "watch" as const,
          note: "New observations require monitoring before they become critical."
        }
      ];
    default:
      return [];
  }
}

function buildFinanceStory(item: FinanceLedgerItemContract | null, riskCount: number) {
  if (!item) {
    return null;
  }

  return {
    cashSignal:
      item.cashImpact < 0
        ? `This signal is draining MXN ${Math.abs(item.cashImpact).toLocaleString()} from the operating cash posture.`
        : `This signal is contributing MXN ${item.cashImpact.toLocaleString()} back into the operating cash posture.`,
    operatingImpact:
      item.urgentItems > 0
        ? `${item.urgentItems} urgent items are still pushing approvals, payment sequencing or fiscal follow-up.`
        : "Urgent queue is contained and this signal is no longer driving immediate payment pressure.",
    releaseCondition:
      riskCount > 0
        ? `${riskCount} mapped blockers still need owner follow-through before this signal can be treated as controlled.`
        : "No mapped blocker remains; only evidence discipline is needed to preserve control."
  };
}

function buildFinanceReleaseGate(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return {
      tone: "info" as const,
      label: "No finance signal selected",
      summary: "Choose a finance signal to verify whether it can really operate as controlled or still needs intervention.",
      checks: ["Select a finance row from the active board."]
    };
  }

  const checks: string[] = [];

  if (item.satStatus === "critical") {
    checks.push("Signal is already in critical fiscal posture.");
  }

  if (item.urgentItems > 0) {
    checks.push(`${item.urgentItems} urgent item(s) still remain open.`);
  }

  if (item.closeReadiness < 90) {
    checks.push(`Close readiness is only ${item.closeReadiness}%.`);
  }

  if (item.cashImpact < 0) {
    checks.push(`Cash impact remains negative at MXN ${Math.abs(item.cashImpact).toLocaleString()}.`);
  }

  if (checks.length > 0) {
    const hardBlock = item.satStatus === "critical" || item.urgentItems > 0;
    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not release yet" : "Operate with control",
      summary: hardBlock
        ? "This signal still carries hard blockers before finance should treat it as controlled."
        : "The signal can continue, but readiness or cash posture still need tighter financial control.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for continuity",
    summary: "Urgency, readiness and cash posture are aligned for controlled financial continuity.",
    checks: [
      "Continue into treasury, payables or supplier fiscal follow-through without rebuilding the same context.",
      "Keep the same owner and note attached until the financial checkpoint is formally closed."
    ]
  };
}

function buildFinanceHumanStep(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return "Select a finance signal to identify the next human move.";
  }

  if (item.satStatus === "critical" || item.urgentItems > 0) {
    return "Clear the urgent fiscal or payable blocker first, then re-check whether the signal can fall back into a controlled posture.";
  }

  if (item.closeReadiness < 90) {
    return "Raise close readiness and keep the responsible finance owner in the same operating cycle before treating this lane as stable.";
  }

  if (item.cashImpact < 0) {
    return "Protect the cash position before promoting this signal as a safe downstream release condition.";
  }

  return "Confirm the controlled checkpoint and keep treasury, payables and supplier follow-through aligned while context is still current.";
}

function buildFinanceWhyNow(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return "Select a finance signal to understand why it deserves attention right now.";
  }

  if (item.satStatus === "critical") {
    return "SAT posture is already critical, so finance delay here can immediately distort treasury, AP and supplier confidence.";
  }

  if (item.urgentItems > 0) {
    return `${item.urgentItems} urgent finance item(s) are still open, so this lane is already active operating pressure rather than passive accounting status.`;
  }

  if (item.closeReadiness < 90) {
    return "Close readiness is still weak enough that finance can distort treasury or payables timing if not tightened now.";
  }

  if (item.cashImpact < 0) {
    return "Negative cash impact means this signal can affect short-term treasury confidence even if accounting posture looks manageable.";
  }

  return "This signal is relatively stable, but finance still needs to preserve continuity across treasury, AP and supplier fiscal follow-through.";
}

function buildFinanceDownstreamEffect(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return "Select a finance signal to inspect what it can block downstream.";
  }

  if (item.satStatus === "critical" || item.urgentItems > 0) {
    return "This signal can immediately block accounts payable release, treasury execution and supplier confidence if left unresolved.";
  }

  if (item.closeReadiness < 90) {
    return "Weak close readiness can propagate into treasury timing, management reporting and operational release confidence.";
  }

  if (item.cashImpact < 0) {
    return "Negative cash pressure here can force treasury prioritization and alter payment sequencing upstream.";
  }

  return "The downstream effect is mainly continuity discipline: keep AP, treasury and supplier posture aligned so the lane stays controlled.";
}

function buildFinanceReportBackWindow(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return "Select a finance signal to define the next report-back window.";
  }

  if (item.satStatus === "critical" || item.urgentItems > 0) {
    return "Report back before the next treasury or AP cutoff with blocker containment status and the exact released checkpoint.";
  }

  if (item.closeReadiness < 90) {
    return "Report back in the same operating cycle once close readiness crosses the controlled threshold.";
  }

  if (item.cashImpact < 0) {
    return "Report back as soon as treasury confirms the negative cash effect is contained or resequenced.";
  }

  return "Report back on the next finance refresh confirming the lane stayed controlled through treasury, payables and supplier follow-through.";
}

function buildFinanceRouteSummary(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return "Use finance as the command lane between supplier posture, payables, treasury release and close readiness.";
  }

  if (item.satStatus === "critical" || item.urgentItems > 0) {
    return "This lane should route first through payables and treasury containment before anyone treats the checkpoint as released.";
  }

  if (item.closeReadiness < 90) {
    return "This lane should route through close-evidence cleanup and finance ownership before treasury trusts the release path.";
  }

  if (item.cashImpact < 0) {
    return "This lane should route through treasury sequencing and cash prioritization before supplier promises are widened.";
  }

  return "This lane can continue through treasury, AP and supplier follow-through without rebuilding the same finance context.";
}

function buildFinanceOperationalLinks(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return [
      { label: "Open finance", href: "/finance" },
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open payables", href: "/accounts-payable" }
    ];
  }

  if (item.satStatus === "critical" || item.urgentItems > 0) {
    return [
      { label: "Open payables", href: "/accounts-payable" },
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open supplier master", href: "/supplier-master" }
    ];
  }

  if (item.closeReadiness < 90) {
    return [
      { label: "Open close control", href: buildFinanceCloseControlHref(item) },
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open finance", href: "/finance" },
      { label: "Open supplier master", href: "/supplier-master" }
    ];
  }

  if (item.cashImpact < 0) {
    return [
      { label: "Open treasury", href: "/treasury/payment-runs" },
      { label: "Open cash flow", href: "/cash-flow" },
      { label: "Open payables", href: "/accounts-payable" }
    ];
  }

  return [
    { label: "Open treasury", href: "/treasury/payment-runs" },
    { label: "Open payables", href: "/accounts-payable" },
    { label: "Open supplier master", href: "/supplier-master" }
  ];
}

function buildFinanceCloseControlHref(item: FinanceLedgerItemContract | null) {
  if (!item) {
    return "/close-control";
  }

  const query = new URLSearchParams({
    source: "finance",
    metricName: item.metricName,
    satStatus: item.satStatus,
    closeReadiness: String(item.closeReadiness),
    urgentItems: String(item.urgentItems),
    cashImpact: String(item.cashImpact),
    note: item.note
  });

  return `/close-control?${query.toString()}`;
}

type CashFlowFinanceContext = {
  source: "cash-flow";
  lineCode: string;
  streamName: string;
  sourceType: string;
  health: string;
  weeklyNet: number;
  openPressureItems: number;
  nextAction: string;
};

function buildCashFlowFinanceContext(
  searchParams: ReturnType<typeof useSearchParams>
): CashFlowFinanceContext | null {
  if (searchParams.get("source") !== "cash-flow") {
    return null;
  }

  const weeklyNetValue = Number(searchParams.get("weeklyNet") ?? "0");
  const openPressureItemsValue = Number(searchParams.get("openPressureItems") ?? "0");

  const context = {
    source: "cash-flow" as const,
    lineCode: searchParams.get("lineCode")?.trim() ?? "",
    streamName: searchParams.get("streamName")?.trim() ?? "",
    sourceType: searchParams.get("sourceType")?.trim() ?? "",
    health: searchParams.get("health")?.trim() ?? "",
    weeklyNet: Number.isFinite(weeklyNetValue) ? weeklyNetValue : 0,
    openPressureItems: Number.isFinite(openPressureItemsValue) ? openPressureItemsValue : 0,
    nextAction: searchParams.get("nextAction")?.trim() ?? ""
  };

  return Object.values(context).some((value) => (typeof value === "string" ? value.length > 0 : value !== 0)) ? context : null;
}

function findBestMatchingFinanceItem(
  overview: FinanceOverviewContract,
  context: CashFlowFinanceContext
) {
  return (
    overview.items
      .map((item) => {
        let score = 0;
        const metricName = item.metricName.toLowerCase();

        if (context.sourceType === "cash" && metricName.includes("cash")) {
          score += 8;
        }

        if (context.sourceType === "payables" && metricName.includes("payable")) {
          score += 8;
        }

        if ((context.sourceType === "tax" || context.sourceType === "close") && (metricName.includes("close") || metricName.includes("fiscal"))) {
          score += 8;
        }

        if (context.health === "critical" && item.satStatus === "critical") {
          score += 2;
        }

        if (context.openPressureItems > 0 && item.urgentItems > 0) {
          score += 1;
        }

        if (context.weeklyNet < 0 && item.cashImpact < 0) {
          score += 1;
        }

        return { item, score };
      })
      .sort((left, right) => right.score - left.score)
      .find((item) => item.score > 0)
      ?.item ?? null
  );
}

export default function FinancePage() {
  const searchParams = useSearchParams();
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const cashFlowContext = useMemo(() => buildCashFlowFinanceContext(searchParams), [searchParams]);
  const [overview, setOverview] = useState<FinanceOverviewContract | null>(null);
  const [treasuryOverview, setTreasuryOverview] = useState<TreasuryPaymentRunsOverviewContract | null>(null);
  const [accountsPayableOverview, setAccountsPayableOverview] = useState<Awaited<ReturnType<typeof fetchAccountsPayableOverview>> | null>(null);
  const [supplierMasterOverview, setSupplierMasterOverview] = useState<Awaited<ReturnType<typeof fetchSupplierMasterOverview>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [satFilter, setSatFilter] = useState<"all" | FinanceLedgerItemContract["satStatus"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [appliedCashFlowContextKey, setAppliedCashFlowContextKey] = useState<string | null>(null);
  const [cashFlowMatchedItemId, setCashFlowMatchedItemId] = useState<string | null>(null);
  const cashFlowContextKey = useMemo(
    () =>
      cashFlowContext
        ? [
            cashFlowContext.source,
            cashFlowContext.lineCode,
            cashFlowContext.streamName,
            cashFlowContext.sourceType,
            cashFlowContext.health,
            String(cashFlowContext.weeklyNet),
            String(cashFlowContext.openPressureItems),
            cashFlowContext.nextAction
          ].join("|")
        : null,
    [cashFlowContext]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchFinanceOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchAccountsPayableOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchSupplierMasterOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchTreasuryPaymentRunsOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, accountsPayableResult, supplierMasterResult, treasuryResult]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Finance overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setAccountsPayableOverview(accountsPayableResult);
        setSupplierMasterOverview(supplierMasterResult);
        setTreasuryOverview(treasuryResult);
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  const filteredItems = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.items.filter((item) => {
      const matchesSat = satFilter === "all" || item.satStatus === satFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.metricName.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch) ||
        item.valueLabel.toLowerCase().includes(normalizedSearch);

      return matchesSat && matchesSearch;
    });
  }, [overview, satFilter, searchFilter]);

  const filteredSummary = useMemo(() => {
    const cashPosition = filteredItems.reduce((sum, item) => sum + item.cashImpact, 0);
    const urgentPayables = filteredItems.reduce((sum, item) => sum + item.urgentItems, 0);
    const closeReadiness =
      filteredItems.length > 0
        ? Number((filteredItems.reduce((sum, item) => sum + item.closeReadiness, 0) / filteredItems.length).toFixed(1))
        : 0;
    const satStatusSummary: FinanceLedgerItemContract["satStatus"] = filteredItems.some((item) => item.satStatus === "critical")
      ? "critical"
      : filteredItems.some((item) => item.satStatus === "watch")
        ? "watch"
        : "controlled";

    return {
      cashPosition,
      urgentPayables,
      closeReadiness,
      satStatus: satStatusSummary,
      supplierExceptions: overview?.summary.supplierExceptions ?? 0,
      paymentReadySuppliers: overview?.summary.paymentReadySuppliers ?? 0,
      blockedTreasuryRuns: overview?.summary.blockedTreasuryRuns ?? 0,
      unavailableTreasuryInvoices: overview?.summary.unavailableTreasuryInvoices ?? 0,
      overdueCollections: overview?.summary.overdueCollections ?? 0,
      criticalCollections: overview?.summary.criticalCollections ?? 0,
      financeChainPressure: overview?.summary.financeChainPressure ?? 0
    };
  }, [filteredItems, overview]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedItemId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.ledgerId === selectedItem?.id) ?? [],
    [overview, selectedItem]
  );

  const selectedStory = useMemo(() => buildFinanceStory(selectedItem, selectedRisks.length), [selectedItem, selectedRisks.length]);
  const selectedReleaseGate = useMemo(() => buildFinanceReleaseGate(selectedItem), [selectedItem]);
  const selectedHumanStep = useMemo(() => buildFinanceHumanStep(selectedItem), [selectedItem]);
  const selectedWhyNow = useMemo(() => buildFinanceWhyNow(selectedItem), [selectedItem]);
  const selectedDownstreamEffect = useMemo(() => buildFinanceDownstreamEffect(selectedItem), [selectedItem]);
  const selectedReportBack = useMemo(() => buildFinanceReportBackWindow(selectedItem), [selectedItem]);
  const selectedRouteSummary = useMemo(() => buildFinanceRouteSummary(selectedItem), [selectedItem]);
  const selectedOperationalLinks = useMemo(() => buildFinanceOperationalLinks(selectedItem), [selectedItem]);
  const actionOptions = useMemo(() => (selectedItem ? financeActionOptions(selectedItem) : []), [selectedItem]);
  const cashFlowContextRows = useMemo(
    () =>
      cashFlowContext
        ? [
            { label: "Cash-flow line", value: cashFlowContext.lineCode },
            { label: "Stream", value: cashFlowContext.streamName },
            { label: "Source type", value: cashFlowContext.sourceType },
            { label: "Health", value: cashFlowContext.health },
            { label: "Weekly net", value: `MXN ${cashFlowContext.weeklyNet.toLocaleString()}` },
            { label: "Open pressure", value: String(cashFlowContext.openPressureItems) },
            { label: "Next action", value: cashFlowContext.nextAction }
          ].filter((row) => row.value)
        : [],
    [cashFlowContext]
  );
  const hasCashFlowClearMatch =
    Boolean(cashFlowContext) &&
    Boolean(selectedItem) &&
    cashFlowMatchedItemId === selectedItem?.id;

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }

    const isSelectedVisible = filteredItems.some((item) => item.id === selectedItemId);
    if (!isSelectedVisible) {
      setSelectedItemId(filteredItems[0]?.id ?? null);
    }
  }, [filteredItems, overview, selectedItemId]);

  useEffect(() => {
    setNoteDraft(selectedItem?.note ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedItemId, selectedItem?.id, selectedItem?.note]);

  useEffect(() => {
    if (!overview || !cashFlowContext || !cashFlowContextKey || appliedCashFlowContextKey === cashFlowContextKey) {
      return;
    }

    const matchedItem = findBestMatchingFinanceItem(overview, cashFlowContext);
    if (matchedItem) {
      setSelectedItemId(matchedItem.id);
      setCashFlowMatchedItemId(matchedItem.id);
    } else {
      setCashFlowMatchedItemId(null);
    }

    if (cashFlowContext.nextAction.length > 0) {
      setNoteDraft(cashFlowContext.nextAction);
    }

    setAppliedCashFlowContextKey(cashFlowContextKey);
  }, [appliedCashFlowContextKey, cashFlowContext, cashFlowContextKey, overview]);

  async function handleFinanceAction(
    satStatus: FinanceLedgerItemContract["satStatus"],
    suggestedNote: string
  ) {
    if (!selectedItem) {
      return;
    }

    const note = noteDraft.trim() || suggestedNote;
    if (note.length < 8) {
      setActionError("Note must be more specific before updating the finance signal.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateFinanceLedgerItem(
      selectedItem.id,
      activeCompany.id,
      {
        satStatus,
        note
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? "Finance update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === response.data?.id ? response.data : item));
      const cashPosition = items.reduce((sum, item) => sum + item.cashImpact, 0);
      const urgentPayables = items.reduce((sum, item) => sum + item.urgentItems, 0);
      const closeReadiness =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.closeReadiness, 0) / items.length).toFixed(1)) : 0;
      const satStatusSummary = items.some((item) => item.satStatus === "critical")
        ? "critical"
        : items.some((item) => item.satStatus === "watch")
          ? "watch"
          : "controlled";

      return {
        ...current,
        summary: {
          cashPosition,
          urgentPayables,
          closeReadiness,
          satStatus: satStatusSummary,
          supplierExceptions: current.summary.supplierExceptions,
          paymentReadySuppliers: current.summary.paymentReadySuppliers,
          blockedTreasuryRuns: current.summary.blockedTreasuryRuns,
          unavailableTreasuryInvoices: current.summary.unavailableTreasuryInvoices,
          overdueCollections: current.summary.overdueCollections,
          criticalCollections: current.summary.criticalCollections,
          financeChainPressure: current.summary.financeChainPressure
        },
        command: current.command,
        items,
        focusItem: current.focusItem?.id === response.data?.id ? response.data : current.focusItem
      };
    });

    setNoteDraft(response.data.note);
    setActionMessage(`Finance signal moved to ${response.data.satStatus}.`);
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Finance and accounting"
      eyebrow="Execution domain"
      description="Cash posture, payable pressure and close-readiness connected to live operating signals."
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title="Finance"
      >
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Cash position"
                value={`MXN ${filteredSummary.cashPosition.toLocaleString()}`}
                footnote="Net operating cash posture from the current finance set."
              />
              <KpiCard
                label="Urgent payables"
                value={String(filteredSummary.urgentPayables)}
                footnote="Items pushing the next payment run and approval pressure."
              />
              <KpiCard
                label="Close readiness"
                value={`${filteredSummary.closeReadiness}%`}
                footnote="Readiness level for close and supporting evidence."
              />
              <KpiCard
                label="SAT posture"
                value={filteredSummary.satStatus}
                footnote="Fiscal control signal tied to current exceptions and complements."
                badge={{ label: "fiscal", tone: satTone(filteredSummary.satStatus) }}
              />
              <KpiCard
                label="Supplier exceptions"
                value={String(filteredSummary.supplierExceptions)}
                footnote="Suppliers still blocked, critical or fiscally incomplete."
              />
              <KpiCard
                label="Finance chain pressure"
                value={String(filteredSummary.financeChainPressure)}
                footnote="Combined friction across supplier master, AP and treasury release lane."
              />
            </section>

            {cashFlowContextRows.length > 0 ? (
              <section className="grid cols1">
                <Card
                  title="Cash-flow context"
                  description={
                    hasCashFlowClearMatch
                      ? "A related finance signal was identified and selected from cash flow."
                      : "No exact finance signal match was found, so the incoming cash-flow context stays visible for manual continuation."
                  }
                  aside={<Badge tone="info">Precargado desde flujo de efectivo / Preloaded from cash flow</Badge>}
                >
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Context status</div>
                      <div>
                        <Badge tone="info">{hasCashFlowClearMatch ? "Context applied" : "Context visible"}</Badge>
                      </div>
                    </div>
                    {cashFlowContextRows.map((row) => (
                      <div key={row.label} className="detailRow">
                        <div className="detailLabel">{row.label}</div>
                        <div>{row.value}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}

            <section className="grid cols2">
              <Card
                title="Finance command walkthrough"
                description="Use finance as the cross-domain command view for supplier posture, AP pressure, treasury release and close readiness."
                aside={<Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>}
              >
                <div className="stackSm">
                  <p className="textMuted">
                    This command layer is now testable without backend auth so operators can validate the financial story and escalation flow end to end.
                  </p>
                  <div className="badgeRow">
                    <Badge tone="info">supplier posture</Badge>
                    <Badge tone="info">accounts payable</Badge>
                    <Badge tone="info">treasury</Badge>
                    <Badge tone="info">close readiness</Badge>
                  </div>
                </div>
              </Card>
            </section>

            {treasuryOverview ? (
              <section className="grid cols3">
                <KpiCard
                  label="Treasury active runs"
                  value={String(treasuryOverview.summary.activeRuns)}
                  footnote="Payment batches still pending full execution."
                />
                <KpiCard
                  label="Treasury ready"
                  value={String(treasuryOverview.summary.readyRuns)}
                  footnote="Runs that can move directly to bank execution."
                />
                <KpiCard
                  label="Unavailable invoices"
                  value={String(treasuryOverview.unavailableInvoices.length)}
                  footnote="Invoices blocked from entering a new treasury batch."
                />
                <KpiCard
                  label="Payment-ready suppliers"
                  value={String(overview.summary.paymentReadySuppliers)}
                  footnote="Suppliers already in complete + controlled fiscal posture."
                />
                <KpiCard
                  label="AP blocked invoices"
                  value={String(accountsPayableOverview?.summary.blockedInvoices ?? 0)}
                  footnote="Invoices blocked before treasury can release them."
                />
              </section>
            ) : null}

            <section className="grid cols2">
              <Card
                title="Finance chain command"
                description="Supplier fiscal posture, accounts payable and treasury batch readiness now read as one release lane."
                aside={
                  <Badge tone={overview.command.laneStatus === "critical" ? "danger" : overview.command.laneStatus === "watch" ? "warning" : "success"}>
                    {overview.command.laneStatus}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Supplier master</div><div>{supplierMasterOverview?.summary.criticalSuppliers ?? 0} critical suppliers and {supplierMasterOverview?.summary.incompletePackets ?? 0} incomplete packets</div></div>
                  <div className="detailRow"><div className="detailLabel">Accounts payable</div><div>{accountsPayableOverview?.summary.blockedInvoices ?? 0} blocked invoices and {accountsPayableOverview?.summary.overdueInvoices ?? 0} overdue invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury</div><div>{treasuryOverview?.summary.blockedRuns ?? 0} blocked runs and {treasuryOverview?.unavailableInvoices.length ?? 0} ineligible invoices</div></div>
                  <div className="detailRow"><div className="detailLabel">Executive read</div><div>{overview.command.headline}</div></div>
                  <div className="detailRow"><div className="detailLabel">Top action</div><div>{overview.command.topAction}</div></div>
                  <div className="detailRow"><div className="detailLabel">Next milestone</div><div>{overview.command.nextMilestone}</div></div>
                  <div className="detailRow"><div className="detailLabel">Blocked amount</div><div>MXN {overview.command.blockedAmount.toLocaleString()}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/supplier-master">Supplier Master</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Accounts Payable</Link>
                  <Link className="buttonGhost" href="/treasury/payment-runs">Treasury Runs</Link>
                  <Link className="buttonGhost" href="/cash-flow">Cash Flow</Link>
                </div>
              </Card>

              <Card title="Finance board" description="Treasury, payables and close-readiness in one live view.">
                <FilterBar summary={`${filteredItems.length} finance signals in the active tenant`}>
                  <select
                    className="selectField"
                    value={satFilter}
                    onChange={(event) => setSatFilter(event.target.value as "all" | FinanceLedgerItemContract["satStatus"])}
                  >
                    <option value="all">All SAT</option>
                    <option value="controlled">controlled</option>
                    <option value="watch">watch</option>
                    <option value="critical">critical</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Search metric, code or value"
                  />
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? "demo mode" : "live backend"}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "finance ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredItems}
                  columns={[
                    {
                      key: "metric",
                      label: "Metric",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedItemId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.metricName}</strong>
                            <span className="tableCellMuted">{row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "value",
                      label: "Value",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.valueLabel}</strong>
                          <span className="tableCellMuted">{row.trendLabel}</span>
                        </div>
                      )
                    },
                    {
                      key: "close",
                      label: "Close",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.closeReadiness}%</strong>
                          <span className="tableCellMuted">{row.urgentItems} urgent items</span>
                        </div>
                      )
                    },
                    {
                      key: "sat",
                      label: "SAT",
                      render: (row) => <Badge tone={satTone(row.satStatus)}>{row.satStatus}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected finance signal"
                description="Focused context for the active cash, payable or fiscal signal."
                aside={selectedItem ? <Badge tone={satTone(selectedItem.satStatus)}>{selectedItem.satStatus}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Metric</div>
                      <div>{selectedItem.metricName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Trend</div>
                      <div>{selectedItem.trendLabel}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Urgent items</div>
                      <div>{selectedItem.urgentItems}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Close readiness</div>
                      <div>{selectedItem.closeReadiness}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Release gate</div>
                      <div className="tableCellStack">
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <Badge tone={selectedReleaseGate.tone}>{selectedReleaseGate.label}</Badge>
                          <span>{selectedReleaseGate.summary}</span>
                        </div>
                        {selectedReleaseGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">
                            {check}
                          </span>
                        ))}
                      </div>
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
                      <div className="detailLabel">Route summary</div>
                      <div>{selectedRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report back</div>
                      <div>{selectedReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Note</div>
                      <div>
                        <input
                          className="field"
                          value={noteDraft}
                          onChange={(event) => setNoteDraft(event.target.value)}
                          placeholder="Describe the current fiscal, payable or close action"
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
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedItem.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Controlled status requires zero urgent items.</span>
                        <span className="tableCellMuted">Controlled status also requires at least 90% close readiness.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.satStatus === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleFinanceAction(option.satStatus, option.note)}
                            >
                              {isSaving ? "Saving..." : option.label}
                            </button>
                          ))}
                        </div>
                        <div className="row gap wrap">
                          <Link className="button secondary" href="/cash-flow">
                            Open cash flow
                          </Link>
                          <Link className="buttonGhost" href="/accounts-payable">
                            Open accounts payable
                          </Link>
                          <Link className="buttonGhost" href="/treasury/payment-runs">
                            Open treasury
                          </Link>
                          <Link className="buttonGhost" href="/supplier-master">
                            Open supplier master
                          </Link>
                          <Link className="buttonGhost" href="/estimations">
                            Open estimations
                          </Link>
                          <Link className="buttonGhost" href="/dashboard">
                            Open dashboard
                          </Link>
                        </div>
                        {actionMessage ? <span className="tableCellMuted">{actionMessage}</span> : null}
                        {actionError ? <span style={{ color: "var(--danger-700)" }}>{actionError}</span> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="No finance signal selected"
                    description="Choose a row to inspect focus detail and current financial pressure."
                    primaryAction={{ label: "Stay on finance", href: "/finance" }}
                  />
                )}
              </Card>
            </section>

            {treasuryOverview ? (
              <section className="grid cols2">
                <Card
                  title="Treasury bridge"
                  description="Finance and treasury are now linked through payment-run execution and invoice eligibility."
                  aside={<Badge tone={treasuryOverview.summary.blockedRuns > 0 ? "danger" : treasuryOverview.summary.readyRuns > 0 ? "success" : "warning"}>{treasuryOverview.summary.blockedRuns > 0 ? "blocked" : treasuryOverview.summary.readyRuns > 0 ? "ready" : "watch"}</Badge>}
                >
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Scheduled amount</div><div>MXN {treasuryOverview.summary.scheduledAmount.toLocaleString()}</div></div>
                    <div className="detailRow"><div className="detailLabel">Executed runs</div><div>{treasuryOverview.summary.executedRuns}</div></div>
                    <div className="detailRow"><div className="detailLabel">Current focus</div><div>{treasuryOverview.focusRun?.code ?? "No active focus run"}</div></div>
                    <div className="detailRow"><div className="detailLabel">Next treasury action</div><div>{treasuryOverview.focusRun?.nextAction ?? "No treasury action pending"}</div></div>
                  </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/treasury/payment-runs">Open Treasury Runs</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Open Accounts Payable</Link>
                  <Link className="buttonGhost" href="/cash-flow">Open Cash Flow</Link>
                </div>
              </Card>

                <Card title="Treasury eligibility blockers" description="Invoices that treasury cannot include in the next clean run.">
                  {treasuryOverview.unavailableInvoices.length > 0 ? (
                    <DataTable
                      rows={treasuryOverview.unavailableInvoices.slice(0, 5)}
                      columns={[
                        {
                          key: "invoice",
                          label: "Invoice",
                          render: (item) => (
                            <div className="tableCellStack">
                              <strong>{item.invoiceCode}</strong>
                              <span className="tableCellMuted">{item.supplierName}</span>
                            </div>
                          )
                        },
                        { key: "reason", label: "Reason", render: (item) => item.reasonLabel },
                        {
                          key: "run",
                          label: "Run",
                          render: (item) => item.blockingRunCodes.length > 0 ? item.blockingRunCodes.join(", ") : "Not assigned"
                        }
                      ]}
                    />
                  ) : (
                    <EmptyState title="Treasury lane clear" description="No invoice is blocked from entering a new payment run." />
                  )}
                </Card>
              </section>
            ) : null}

            <section className="grid cols2">
              <Card
                title="Supplier fiscal bridge"
                description="Finance now reads supplier fiscal readiness and exceptions as part of payment control."
                aside={
                  <Badge tone={overview.summary.supplierExceptions > 0 ? "warning" : "success"}>
                    {overview.summary.supplierExceptions > 0 ? "exceptions open" : "supplier lane ready"}
                  </Badge>
                }
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Supplier exceptions</div><div>{overview.summary.supplierExceptions}</div></div>
                  <div className="detailRow"><div className="detailLabel">Payment-ready suppliers</div><div>{overview.summary.paymentReadySuppliers}</div></div>
                  <div className="detailRow"><div className="detailLabel">AP focus</div><div>{accountsPayableOverview?.focusInvoice?.code ?? "No payable invoice focus"}</div></div>
                  <div className="detailRow"><div className="detailLabel">Treasury focus</div><div>{treasuryOverview?.focusRun?.code ?? "No treasury focus"}</div></div>
                  <div className="detailRow"><div className="detailLabel">Why it matters</div><div>Invoices and treasury release now depend on real supplier fiscal posture, not only on invoice-side CFDI data.</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/supplier-master">Open Supplier Master</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Open Accounts Payable</Link>
                </div>
              </Card>

              <Card title="Operating implication" description="What finance leadership should read from supplier fiscal readiness right now.">
                <p className="sectionText">
                  {overview.summary.supplierExceptions > 0
                    ? `${overview.summary.supplierExceptions} supplier fiscal exception(s) can still block invoice progression or payment sequencing even when the operational invoice looks complete.`
                    : "Supplier fiscal posture is currently aligned enough to keep invoice progression and treasury sequencing clean."}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Cash signal" description="Direct treasury implication of the selected finance signal.">
                <p className="sectionText">{selectedStory?.cashSignal ?? "Choose a finance signal to inspect its cash implication."}</p>
              </Card>
              <Card title="Operating impact" description="Why this signal matters beyond accounting.">
                <p className="sectionText">
                  {selectedStory?.operatingImpact ?? "Choose a finance signal to inspect current operating pressure."}
                </p>
              </Card>
              <Card title="Release condition" description="What still needs to happen before control is real.">
                <p className="sectionText">
                  {selectedStory?.releaseCondition ?? "Choose a finance signal to inspect the release condition."}
                </p>
              </Card>
            </section>

            <Card title="Finance risk watchlist" description="Close, payable and fiscal issues with ownership and current action state.">
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
            title="Finance overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open treasury", href: "/treasury/payment-runs" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading finance overview" : "Finance overview not loaded yet"}
            description="This route should be operable with live or demo finance data for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open cash flow", href: "/cash-flow" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
