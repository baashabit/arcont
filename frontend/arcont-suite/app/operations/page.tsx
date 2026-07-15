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
import {
  fetchAccountsPayableOverview,
  fetchCashFlowOverview,
  fetchComplianceOverview,
  fetchDailyLogOverview,
  fetchDocumentControlOverview,
  fetchEquipmentOverview,
  fetchEstimationCollectionOverview,
  fetchFieldMaterialRequestsOverview,
  fetchFinanceOverview,
  fetchHrOverview,
  fetchIntegrationOverview,
  fetchInventoryMovementsOverview,
  fetchInventoryReceivingOverview,
  fetchInventoryOverview,
  fetchPostSaleOverview,
  fetchProcurementOverview,
  fetchProcurementPurchaseOrdersOverview,
  fetchProjectsOverview,
  fetchQualityOverview,
  fetchSupplierMasterOverview,
  fetchSupplierControlOverview,
  fetchSubcontractOverview,
  fetchTreasuryPaymentRunsOverview
} from "@/lib/platform-api";

type BlackboardTask = {
  id: string;
  lane: "new" | "in_progress" | "risk" | "closed";
  title: string;
  detail: string;
  owner: string;
  dueLabel: string;
  domain: string;
  severity: "info" | "warning" | "critical";
};

type DailyLogPreloadContext = {
  source: "daily-log";
  projectName: string;
  frontName: string;
  owner: string;
  nextAction: string;
  pendingDestajo: string;
  subcontractHealth: string;
};

type ProjectsPreloadContext = {
  source: "projects";
  projectName: string;
  frontName: string;
  owner: string;
  summary: string;
  nextAction: string;
  schedulePhase: string;
  scheduleActivityName: string;
};

function normalizePreloadValue(value: string | null) {
  return value?.trim() ?? "";
}

function normalizePreloadMatchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function taskMatchesPreload(task: BlackboardTask, context: DailyLogPreloadContext) {
  const values = [context.frontName, context.projectName, context.owner]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    return false;
  }

  const haystack = [task.dueLabel, task.detail, task.owner, task.title]
    .join(" ")
    .toLowerCase();

  return values.some((value) => haystack.includes(value));
}

function pickTaskFromPreload(tasks: BlackboardTask[], context: DailyLogPreloadContext) {
  const dailyLogMatches = tasks.filter((task) => task.domain === "Daily log" && taskMatchesPreload(task, context));
  if (dailyLogMatches.length > 0) {
    return dailyLogMatches[0];
  }

  const genericMatches = tasks.filter((task) => taskMatchesPreload(task, context));
  if (genericMatches.length > 0) {
    return genericMatches[0];
  }

  return null;
}

function scoreTaskFromProjectsPreload(task: BlackboardTask, context: ProjectsPreloadContext) {
  const normalizedHaystack = normalizePreloadMatchValue([task.title, task.detail, task.owner, task.dueLabel, task.domain].join(" "));
  const normalizedDomain = normalizePreloadMatchValue(task.domain);
  let score = 0;

  const includeScore = (value: string, points: number) => {
    const normalizedValue = normalizePreloadMatchValue(value);
    if (normalizedValue.length < 3) {
      return;
    }

    if (normalizedHaystack.includes(normalizedValue)) {
      score += points;
    }
  };

  includeScore(context.projectName, 4);
  includeScore(context.frontName, 3);
  includeScore(context.scheduleActivityName, 4);
  includeScore(context.nextAction, 3);
  includeScore(context.summary, 2);
  includeScore(context.owner, 2);
  includeScore(context.schedulePhase, 1);

  if (context.schedulePhase && normalizedDomain === "projects") {
    score += 1;
  }

  return score;
}

function resolveProjectsPreloadMatch(tasks: BlackboardTask[], context: ProjectsPreloadContext) {
  const scoredMatches = tasks
    .map((task) => ({ task, score: scoreTaskFromProjectsPreload(task, context) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scoredMatches.length === 0) {
    return {
      matchedTask: null,
      hasClearMatch: false
    };
  }

  const [bestMatch, secondMatch] = scoredMatches;
  const hasClearMatch =
    bestMatch.score >= 4 && (!secondMatch || bestMatch.score >= secondMatch.score + 2);

  return {
    matchedTask: hasClearMatch ? bestMatch.task : null,
    hasClearMatch
  };
}

function severityTone(severity: BlackboardTask["severity"]) {
  switch (severity) {
    case "critical":
      return "danger";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

function laneLabel(lane: BlackboardTask["lane"]) {
  switch (lane) {
    case "new":
      return "New";
    case "in_progress":
      return "In progress";
    case "risk":
      return "Risk";
    default:
      return "Closed";
  }
}

function deriveLaneFromSignal(input: {
  severity: BlackboardTask["severity"];
  isClosed?: boolean;
  hours?: number;
}) {
  if (input.isClosed) {
    return "closed" as const;
  }

  if (input.severity === "critical" || (typeof input.hours === "number" && input.hours < 0)) {
    return "risk" as const;
  }

  if (typeof input.hours === "number" && input.hours <= 24) {
    return "new" as const;
  }

  return "in_progress" as const;
}

function primaryHrefForTask(task: BlackboardTask) {
  switch (task.domain) {
    case "Projects":
      return "/projects";
    case "Daily log":
      return "/daily-log";
    case "Procurement":
      return "/procurement/requisitions";
    case "POs":
      return "/procurement/purchase-orders";
    case "Supplier control":
      return "/supplier-control";
    case "Supplier master":
      return "/supplier-master";
    case "Accounts payable":
      return "/accounts-payable";
    case "Inventory":
      return "/inventory";
    case "Receiving":
      return "/inventory/receiving";
    case "Movements":
      return "/inventory/movements";
    case "Collections":
      return "/estimations";
    case "Cash flow":
      return "/cash-flow";
    case "Finance":
      return "/finance";
    case "Treasury runs":
      return "/treasury/payment-runs";
    case "HR":
      return "/hr";
    case "Quality":
      return "/quality";
    case "Subcontracts":
      return "/subcontracts";
    case "Equipment":
      return "/equipment";
    case "Compliance":
      return "/compliance";
    case "Post-sale":
      return "/post-sale";
    case "Integrations":
      return "/integrations";
    case "Document control":
      return "/document-control";
    default:
      return "/operations";
  }
}

function buildOperationsWorkflow(tasks: BlackboardTask[]) {
  if (tasks.length === 0) {
    return "Use operations as the cross-domain blackboard that routes executive pressure into the exact working module.";
  }

  const riskCount = tasks.filter((task) => task.lane === "risk").length;
  if (riskCount > 0) {
    return `${riskCount} blackboard items are already in risk lane, so operations should dispatch teams into the exact blocked domain before pressure compounds.`;
  }

  return "Operations should sequence cross-domain work, keep lane ownership visible and reduce the need to hunt through separate modules.";
}

function buildTaskOperatingState(task: BlackboardTask | null) {
  if (!task) {
    return {
      tone: "info" as const,
      label: "No signal selected",
      summary: "Choose a board signal to understand who should move next and where the work should continue.",
      checks: ["Select a signal from the current operations table."]
    };
  }

  const checks: string[] = [];

  if (task.lane === "risk") {
    checks.push("This signal is already in risk lane and should move immediately inside the owning domain.");
  }

  if (task.severity === "critical") {
    checks.push("Severity is critical, so continuation should happen in the owner module before more board triage.");
  }

  if (task.lane === "new") {
    checks.push("This is still intake pressure and needs first-touch ownership.");
  }

  if (task.lane === "in_progress") {
    checks.push("The signal is already moving, so operations should protect follow-through instead of re-triaging it.");
  }

  if (task.lane === "closed") {
    checks.push("This signal is closed and should only be reopened if a new blocker appears.");
  }

  return {
    tone: task.lane === "risk" || task.severity === "critical" ? "danger" as const : task.lane === "new" ? "warning" as const : task.lane === "closed" ? "success" as const : "info" as const,
    label: task.lane === "risk" ? "Act now" : task.lane === "new" ? "Assign now" : task.lane === "closed" ? "Closed" : "Follow through",
    summary:
      task.lane === "risk"
        ? "Operations should stop browsing and send the team directly into the blocked domain."
        : task.lane === "new"
          ? "Operations should confirm first owner and move this out of intake quickly."
          : task.lane === "closed"
            ? "The signal is already resolved; keep it as traceability, not active workload."
            : "The signal already has motion; the next value is disciplined continuation.",
    checks
  };
}

function buildTaskHumanStep(task: BlackboardTask | null) {
  if (!task) {
    return "Select a signal to identify the next human move.";
  }

  if (task.lane === "risk") {
    return `Contact ${task.owner}, open ${task.domain} and contain the blocker before the next operating cutoff.`;
  }

  if (task.lane === "new") {
    return `Assign ${task.owner} as first responder and decide whether ${task.domain} should absorb the work immediately.`;
  }

  if (task.lane === "closed") {
    return `Keep ${task.domain} as the historical owner and reopen only if a fresh signal appears.`;
  }

  return `Keep ${task.owner} moving inside ${task.domain} and verify the next signal before the board refresh.`;
}

function buildTaskWhyNow(task: BlackboardTask | null) {
  if (!task) {
    return "Select a signal to understand why it deserves attention right now.";
  }

  if (task.severity === "critical") {
    return `${task.domain} is already carrying a critical signal, so waiting at board level only increases execution risk.`;
  }

  if (task.lane === "risk") {
    return `${task.domain} already sits in risk lane and should be treated as an active operating blocker, not just a dashboard item.`;
  }

  if (task.lane === "new") {
    return `${task.domain} is still at intake stage, so fast first ownership prevents this from turning into avoidable risk.`;
  }

  if (task.lane === "closed") {
    return `${task.domain} is already closed, so the value now is traceability rather than further escalation.`;
  }

  return `${task.domain} is already in motion and should keep progressing cleanly instead of being re-triaged.`;
}

function buildTaskDownstreamEffect(task: BlackboardTask | null) {
  if (!task) {
    return "Select a signal to inspect what it can block downstream.";
  }

  switch (task.domain) {
    case "Projects":
      return "Project slippage can immediately distort field sequencing, procurement timing and cash expectations.";
    case "Daily log":
      return "A weak daily-log handoff can hide site blockers from operations and quality until the next cutoff.";
    case "Procurement":
    case "POs":
    case "Supplier control":
    case "Supplier master":
      return "Supply-side blockers can quickly propagate into receiving, field continuity and accounts payable timing.";
    case "Receiving":
    case "Movements":
    case "Inventory":
      return "Inventory-side friction can stop equipment support or field continuity even when commercial commitments are already in place.";
    case "Equipment":
      return "Equipment pressure can halt field execution and force operations to resequence active fronts.";
    case "Quality":
    case "Document control":
    case "Compliance":
      return "Control-side blockers can prevent release, closeout or safe continuation even when the front looks operational.";
    case "Finance":
    case "Cash flow":
    case "Accounts payable":
    case "Treasury runs":
    case "Collections":
      return "Financial blockers can freeze procurement, supplier confidence or execution continuity if not resolved on time.";
    default:
      return `This ${task.domain} signal should be resolved in its owner module before downstream teams start improvising around it.`;
  }
}

function buildTaskReportBackWindow(task: BlackboardTask | null) {
  if (!task) {
    return "Select a signal to define the next report-back window.";
  }

  if (task.severity === "critical" || task.lane === "risk") {
    return "Report back before the next operating cutoff with containment status and the next unblocked owner.";
  }

  if (task.lane === "new") {
    return "Report back once first ownership is confirmed and the task leaves intake.";
  }

  if (task.lane === "closed") {
    return "Report back only if a fresh blocker reopens the same chain.";
  }

  return "Report back on the next board refresh confirming the signal really advanced inside the owner module.";
}

function buildTaskRouteSummary(task: BlackboardTask | null) {
  if (!task) {
    return "Use operations as the orchestration layer that routes each blocker into the exact domain that must resolve it.";
  }

  if (task.lane === "risk" || task.severity === "critical") {
    return "This signal should route first through its owner module and immediate containment before more board triage happens.";
  }

  if (task.lane === "new") {
    return "This signal should route through first ownership and then leave intake quickly so it does not grow into preventable risk.";
  }

  if (task.lane === "closed") {
    return "This signal can stay as traceability only; normal routing should focus on live blockers instead.";
  }

  return "This signal should continue inside its owner module with operations protecting continuity rather than re-triaging it.";
}

function buildTaskRelatedLinks(task: BlackboardTask | null) {
  if (!task) {
    return [
      { label: "Open operations", href: "/operations" },
      { label: "Open field", href: "/field" },
      { label: "Open dashboard", href: "/dashboard" }
    ];
  }

  switch (task.domain) {
    case "Procurement":
    case "POs":
    case "Supplier control":
      return [
        { label: `Open ${task.domain}`, href: primaryHrefForTask(task) },
        { label: "Open receiving", href: "/inventory/receiving" },
        { label: "Open field", href: "/field" }
      ];
    case "Receiving":
    case "Movements":
    case "Inventory":
      return [
        { label: `Open ${task.domain}`, href: primaryHrefForTask(task) },
        { label: "Open equipment", href: "/equipment" },
        { label: "Open field", href: "/field" }
      ];
    case "Equipment":
      return [
        { label: "Open equipment", href: "/equipment" },
        { label: "Open field", href: "/field" },
        { label: "Open operations", href: "/operations" }
      ];
    case "Quality":
    case "Document control":
    case "Compliance":
      return [
        { label: `Open ${task.domain}`, href: primaryHrefForTask(task) },
        { label: "Open projects", href: "/projects" },
        { label: "Open field", href: "/field" }
      ];
    case "Finance":
    case "Cash flow":
    case "Accounts payable":
    case "Treasury runs":
    case "Collections":
      return [
        { label: `Open ${task.domain}`, href: primaryHrefForTask(task) },
        { label: "Open procurement", href: "/procurement/requisitions" },
        { label: "Open dashboard", href: "/dashboard" }
      ];
    default:
      return [
        { label: `Open ${task.domain}`, href: primaryHrefForTask(task) },
        { label: "Open field", href: "/field" },
        { label: "Open daily log", href: "/daily-log" }
      ];
  }
}

export default function OperationsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const searchParams = useSearchParams();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const [tasks, setTasks] = useState<BlackboardTask[]>([]);
  const [laneFilter, setLaneFilter] = useState<"all" | BlackboardTask["lane"]>("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [appliedDailyLogPreloadKey, setAppliedDailyLogPreloadKey] = useState<string | null>(null);
  const [appliedProjectsPreloadKey, setAppliedProjectsPreloadKey] = useState<string | null>(null);

  const dailyLogPreload = useMemo(() => {
    if (searchParams.get("source") !== "daily-log") {
      return null;
    }

    return {
      source: "daily-log" as const,
      projectName: normalizePreloadValue(searchParams.get("projectName")),
      frontName: normalizePreloadValue(searchParams.get("frontName")),
      owner: normalizePreloadValue(searchParams.get("owner")),
      nextAction: normalizePreloadValue(searchParams.get("nextAction")),
      pendingDestajo: normalizePreloadValue(searchParams.get("pendingDestajo")),
      subcontractHealth: normalizePreloadValue(searchParams.get("subcontractHealth"))
    };
  }, [searchParams]);
  const dailyLogPreloadKey = useMemo(
    () =>
      dailyLogPreload
        ? [
            dailyLogPreload.source,
            dailyLogPreload.projectName,
            dailyLogPreload.frontName,
            dailyLogPreload.owner,
            dailyLogPreload.nextAction,
            dailyLogPreload.pendingDestajo,
            dailyLogPreload.subcontractHealth
          ].join("|")
        : null,
    [dailyLogPreload]
  );
  const projectsPreload = useMemo(() => {
    if (searchParams.get("source") !== "projects") {
      return null;
    }

    return {
      source: "projects" as const,
      projectName: normalizePreloadValue(searchParams.get("projectName")),
      frontName: normalizePreloadValue(searchParams.get("frontName")),
      owner: normalizePreloadValue(searchParams.get("owner")),
      summary: normalizePreloadValue(searchParams.get("summary")),
      nextAction: normalizePreloadValue(searchParams.get("nextAction")),
      schedulePhase: normalizePreloadValue(searchParams.get("schedulePhase")),
      scheduleActivityName: normalizePreloadValue(searchParams.get("scheduleActivityName"))
    };
  }, [searchParams]);
  const projectsPreloadKey = useMemo(
    () =>
      projectsPreload
        ? [
            projectsPreload.source,
            projectsPreload.projectName,
            projectsPreload.frontName,
            projectsPreload.owner,
            projectsPreload.summary,
            projectsPreload.nextAction,
            projectsPreload.schedulePhase,
            projectsPreload.scheduleActivityName
          ].join("|")
        : null,
    [projectsPreload]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.allSettled([
      fetchProjectsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDailyLogOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFieldMaterialRequestsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchProcurementOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchProcurementPurchaseOrdersOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSupplierControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSupplierMasterOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchAccountsPayableOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchQualityOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSubcontractOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchEquipmentOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryReceivingOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryMovementsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchEstimationCollectionOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchCashFlowOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFinanceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchHrOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchComplianceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchPostSaleOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchIntegrationOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then((results) => {
        if (cancelled) {
          return;
        }

        const [
          projectsResult,
          dailyLogResult,
          fieldMaterialsResult,
          procurementResult,
          procurementPurchaseOrdersResult,
          supplierControlResult,
          supplierMasterResult,
          accountsPayableResult,
          treasuryRunsResult,
          qualityResult,
          subcontractsResult,
          equipmentResult,
          inventoryResult,
          inventoryReceivingResult,
          inventoryMovementsResult,
          estimationsResult,
          cashFlowResult,
          financeResult,
          hrResult,
          complianceResult,
          postSaleResult,
          integrationsResult,
          documentControlResult
        ] = results;

        const nextTasks: BlackboardTask[] = [];

        if (projectsResult.status === "fulfilled" && projectsResult.value) {
          for (const risk of projectsResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · project control`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Projects",
              severity: risk.severity
            });
          }

          if (projectsResult.value.summary.executionRiskProjects > 0) {
            nextTasks.push({
              id: "projects_execution_risk",
              lane: "risk",
              title: "Projects already carry compounded execution risk",
              detail: `${projectsResult.value.summary.executionRiskProjects} projects are under field, quality or subcontract pressure`,
              owner: projectsResult.value.focusProject?.client ?? "PMO",
              dueLabel: projectsResult.value.focusProject?.nextMilestone ?? "Portfolio recovery review",
              domain: "Projects",
              severity: "critical"
            });
          }
        }

        if (dailyLogResult.status === "fulfilled" && dailyLogResult.value && dailyLogResult.value.summary.executionRiskLogs > 0) {
          nextTasks.push({
            id: "daily_log_execution_risk",
            lane: "risk",
            title: "Field logs are already flagging execution pressure",
            detail: `${dailyLogResult.value.summary.executionRiskLogs} logs carry blocker, quality or subcontract risk`,
            owner: dailyLogResult.value.focusEntry?.supervisor ?? "Field control",
            dueLabel: dailyLogResult.value.focusEntry?.frontName ?? "Field log escalation",
            domain: "Daily log",
            severity: "critical"
          });
        }

        if (fieldMaterialsResult.status === "fulfilled" && fieldMaterialsResult.value) {
          const focusRequest = fieldMaterialsResult.value.focusRequest;

          if (focusRequest) {
            nextTasks.push({
              id: focusRequest.id,
              lane: deriveLaneFromSignal({
                severity: focusRequest.urgency === "critical" ? "critical" : focusRequest.urgency === "watch" ? "warning" : "info"
              }),
              title: focusRequest.summary,
              detail: `${focusRequest.projectName} · ${focusRequest.frontName} · ${focusRequest.requestedVolume}`,
              owner: focusRequest.requestedBy,
              dueLabel: focusRequest.nextAction,
              domain: "Field materials",
              severity: focusRequest.urgency === "critical" ? "critical" : focusRequest.urgency === "watch" ? "warning" : "info"
            });
          }

          if (
            fieldMaterialsResult.value.summary.criticalRequests > 0 ||
            fieldMaterialsResult.value.summary.linkedRequisitions > 0
          ) {
            nextTasks.push({
              id: "field_material_chain_pressure",
              lane: fieldMaterialsResult.value.summary.criticalRequests > 0 ? "risk" : "in_progress",
              title: "Field material demand is already feeding the supply chain",
              detail: `${fieldMaterialsResult.value.summary.linkedRequisitions} linked requisitions and ${fieldMaterialsResult.value.summary.criticalRequests} critical field requests remain active`,
              owner: focusRequest?.requestedBy ?? "Field supply",
              dueLabel: focusRequest?.nextAction ?? "Field-to-procurement follow-up",
              domain: "Field materials",
              severity: fieldMaterialsResult.value.summary.criticalRequests > 0 ? "critical" : "warning"
            });
          }
        }

        if (procurementResult.status === "fulfilled" && procurementResult.value) {
          for (const risk of procurementResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · sourcing`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Procurement",
              severity: risk.severity
            });
          }
        }

        if (procurementPurchaseOrdersResult.status === "fulfilled" && procurementPurchaseOrdersResult.value) {
          for (const risk of procurementPurchaseOrdersResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · purchase order execution`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "POs",
              severity: risk.severity
            });
          }
        }

        if (supplierControlResult.status === "fulfilled" && supplierControlResult.value) {
          for (const risk of supplierControlResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · supplier dependency`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Supplier control",
              severity: risk.severity
            });
          }

          if (
            supplierControlResult.value.summary.criticalSuppliers > 0 ||
            supplierControlResult.value.summary.concentratedSuppliers > 0
          ) {
            nextTasks.push({
              id: "supplier_control_execution_risk",
              lane: "risk",
              title: "Supplier concentration or alerts are already threatening execution",
              detail: `${supplierControlResult.value.summary.criticalSuppliers} critical suppliers and ${supplierControlResult.value.summary.complianceAlerts} active alerts remain open`,
              owner: supplierControlResult.value.focusLine?.supplierName ?? "Supplier control",
              dueLabel: supplierControlResult.value.focusLine?.nextAction ?? "Supplier escalation",
              domain: "Supplier control",
              severity: "critical"
            });
          }
        }

        if (supplierMasterResult.status === "fulfilled" && supplierMasterResult.value) {
          for (const risk of supplierMasterResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · supplier fiscal control`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Supplier master",
              severity: risk.severity
            });
          }

          if (
            supplierMasterResult.value.summary.criticalSuppliers > 0 ||
            supplierMasterResult.value.summary.incompletePackets > 0
          ) {
            nextTasks.push({
              id: "supplier_master_fiscal_pressure",
              lane: supplierMasterResult.value.summary.criticalSuppliers > 0 ? "risk" : "in_progress",
              title: "Supplier fiscal readiness is still constraining payment flow",
              detail: `${supplierMasterResult.value.summary.criticalSuppliers} critical suppliers and ${supplierMasterResult.value.summary.incompletePackets} incomplete packets remain open`,
              owner: supplierMasterResult.value.focusItem?.supplierName ?? "Fiscal control",
              dueLabel: supplierMasterResult.value.focusItem?.nextAction ?? "Supplier fiscal follow-up",
              domain: "Supplier master",
              severity: supplierMasterResult.value.summary.criticalSuppliers > 0 ? "critical" : "warning"
            });
          }
        }

        if (accountsPayableResult.status === "fulfilled" && accountsPayableResult.value) {
          for (const risk of accountsPayableResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · payable release`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Accounts payable",
              severity: risk.severity
            });
          }

          if (
            accountsPayableResult.value.summary.blockedInvoices > 0 ||
            accountsPayableResult.value.summary.overdueInvoices > 0
          ) {
            nextTasks.push({
              id: "accounts_payable_release_pressure",
              lane: "risk",
              title: "Accounts payable already carries blocked or overdue invoice pressure",
              detail: `${accountsPayableResult.value.summary.blockedInvoices} blocked invoices and ${accountsPayableResult.value.summary.overdueInvoices} overdue invoices remain active`,
              owner: accountsPayableResult.value.focusInvoice?.supplierName ?? "Accounts payable",
              dueLabel: accountsPayableResult.value.focusInvoice?.nextAction ?? "Invoice release follow-up",
              domain: "Accounts payable",
              severity: "critical"
            });
          }
        }

        if (treasuryRunsResult.status === "fulfilled" && treasuryRunsResult.value) {
          for (const risk of treasuryRunsResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · treasury batch release`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Treasury runs",
              severity: risk.severity
            });
          }

          if (
            treasuryRunsResult.value.summary.blockedRuns > 0 ||
            treasuryRunsResult.value.unavailableInvoices.length > 0
          ) {
            nextTasks.push({
              id: "treasury_batch_release_pressure",
              lane: treasuryRunsResult.value.summary.blockedRuns > 0 ? "risk" : "in_progress",
              title: "Treasury batches still cannot close a clean release cycle",
              detail: `${treasuryRunsResult.value.summary.blockedRuns} blocked runs and ${treasuryRunsResult.value.unavailableInvoices.length} unavailable invoices still constrain payment release`,
              owner: treasuryRunsResult.value.focusRun?.owner ?? "Treasury",
              dueLabel:
                treasuryRunsResult.value.focusRun?.nextAction ??
                treasuryRunsResult.value.unavailableInvoices[0]?.reasonLabel ??
                "Treasury release review",
              domain: "Treasury runs",
              severity: treasuryRunsResult.value.summary.blockedRuns > 0 ? "critical" : "warning"
            });
          }
        }
        if (inventoryResult.status === "fulfilled" && inventoryResult.value) {
          for (const risk of inventoryResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · supply`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Inventory",
              severity: risk.severity
            });
          }
        }

        if (inventoryReceivingResult.status === "fulfilled" && inventoryReceivingResult.value) {
          for (const risk of inventoryReceivingResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · inbound receiving`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Receiving",
              severity: risk.severity
            });
          }

          if (inventoryReceivingResult.value.summary.receiptsAtCommercialRisk > 0) {
            nextTasks.push({
              id: "inventory_receiving_commercial_risk",
              lane: "risk",
              title: "Commercial blockers are still attached to inbound receipts",
              detail: `${inventoryReceivingResult.value.summary.receiptsAtCommercialRisk} receipts still depend on blocked PO posture or fiscal risk`,
              owner: inventoryReceivingResult.value.focusReceipt?.purchaseOrderOwner ?? "Procurement control",
              dueLabel: inventoryReceivingResult.value.focusReceipt?.purchaseReference ?? "Linked PO review",
              domain: "Receiving",
              severity: "critical"
            });
          }
        }

        if (inventoryMovementsResult.status === "fulfilled" && inventoryMovementsResult.value) {
          for (const risk of inventoryMovementsResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · stock movement`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Movements",
              severity: risk.severity
            });
          }

          if (inventoryMovementsResult.value.summary.movementsAtCommercialRisk > 0) {
            nextTasks.push({
              id: "inventory_movements_commercial_risk",
              lane: "risk",
              title: "Commercial blockers still travel downstream into stock movements",
              detail: `${inventoryMovementsResult.value.summary.movementsAtCommercialRisk} movements still depend on blocked PO posture or fiscal risk`,
              owner: inventoryMovementsResult.value.focusMovement?.purchaseOrderOwner ?? "Procurement control",
              dueLabel: inventoryMovementsResult.value.focusMovement?.purchaseReference ?? "Linked PO review",
              domain: "Movements",
              severity: "critical"
            });
          }
        }

        if (estimationsResult.status === "fulfilled" && estimationsResult.value) {
          for (const exception of estimationsResult.value.exceptions.slice(0, 2)) {
            nextTasks.push({
              id: exception.id,
              lane: deriveLaneFromSignal({ severity: exception.severity }),
              title: exception.title,
              detail: `${exception.category} · collections`,
              owner: exception.owner,
              dueLabel: exception.status,
              domain: "Collections",
              severity: exception.severity
            });
          }

          if (estimationsResult.value.summary.overdueCollections > 0) {
            nextTasks.push({
              id: "estimations_overdue_collections",
              lane: "risk",
              title: "Overdue collection tranches already exceed their expected window",
              detail: `${estimationsResult.value.summary.overdueCollections} project collection lines need escalation`,
              owner: estimationsResult.value.focusLine?.collectionOwner ?? "Collections",
              dueLabel: estimationsResult.value.focusLine
                ? `${estimationsResult.value.focusLine.oldestPendingDays}d oldest tranche`
                : "Collection aging review",
              domain: "Collections",
              severity: "critical"
            });
          }
        }

        if (cashFlowResult.status === "fulfilled" && cashFlowResult.value) {
          for (const risk of cashFlowResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · treasury`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Cash flow",
              severity: risk.severity
            });
          }

          if (cashFlowResult.value.summary.weeklyNet < 0 || cashFlowResult.value.summary.criticalStreams > 0) {
            nextTasks.push({
              id: "cash_flow_treasury_pressure",
              lane: "risk",
              title: "Treasury already reflects pressure from collections, tax or payables",
              detail: `${cashFlowResult.value.summary.criticalStreams} critical treasury streams and MXN ${cashFlowResult.value.summary.weeklyNet.toLocaleString()} weekly net`,
              owner: cashFlowResult.value.focusLine?.streamName ?? "Treasury",
              dueLabel: cashFlowResult.value.focusLine?.nextAction ?? "Treasury review",
              domain: "Cash flow",
              severity: "critical"
            });
          }
        }

        if (financeResult.status === "fulfilled" && financeResult.value) {
          for (const risk of financeResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · finance`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Finance",
              severity: risk.severity
            });
          }
        }

        if (hrResult.status === "fulfilled" && hrResult.value) {
          for (const risk of hrResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · workforce`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "HR",
              severity: risk.severity
            });
          }
        }

        if (qualityResult.status === "fulfilled" && qualityResult.value && qualityResult.value.summary.executionRiskInspections > 0) {
          nextTasks.push({
            id: "quality_execution_risk",
            lane: "risk",
            title: "Quality release is still being dragged by field issues",
            detail: `${qualityResult.value.summary.executionRiskInspections} inspections still sit under flagged logs, blocked projects or heavy findings`,
            owner: qualityResult.value.focusInspection?.contractorName ?? "Quality",
            dueLabel: qualityResult.value.focusInspection?.projectName ?? "Release recovery",
            domain: "Quality",
            severity: "critical"
          });
        }

        if (subcontractsResult.status === "fulfilled" && subcontractsResult.value && subcontractsResult.value.summary.executionRiskSubcontracts > 0) {
          nextTasks.push({
            id: "subcontracts_execution_risk",
            lane: "risk",
            title: "Subcontract continuity is already under operating pressure",
            detail: `${subcontractsResult.value.summary.executionRiskSubcontracts} subcontract lines remain exposed through field, quality or destajo posture`,
            owner: subcontractsResult.value.focusLine?.contractorName ?? "Subcontracts",
            dueLabel: subcontractsResult.value.focusLine?.frontName ?? "Subcontract recovery",
            domain: "Subcontracts",
            severity: "critical"
          });
        }

        if (equipmentResult.status === "fulfilled" && equipmentResult.value) {
          for (const risk of equipmentResult.value.risks.slice(0, 2)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · equipment`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Equipment",
              severity: risk.severity
            });
          }

          if (
            equipmentResult.value.summary.overdueMaintenance > 0 ||
            equipmentResult.value.summary.criticalOpenFailures > 0
          ) {
            nextTasks.push({
              id: "equipment_front_pressure",
              lane: "risk",
              title: "Equipment readiness is already constraining active fronts",
              detail: `${equipmentResult.value.summary.overdueMaintenance} overdue maintenance items and ${equipmentResult.value.summary.criticalOpenFailures} critical failures remain open`,
              owner: equipmentResult.value.focusMachine?.machineName ?? "Equipment control",
              dueLabel: equipmentResult.value.focusMachine?.nextAction ?? "Equipment recovery",
              domain: "Equipment",
              severity: "critical"
            });
          }
        }

        if (complianceResult.status === "fulfilled" && complianceResult.value) {
          for (const item of complianceResult.value.cases.slice(0, 2)) {
            nextTasks.push({
              id: item.id,
              lane: deriveLaneFromSignal({
                severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info",
                hours: item.slaHoursRemaining
              }),
              title: item.subject,
              detail: `${item.queueName} · ${item.unitOrContract}`,
              owner: item.owner,
              dueLabel: `${item.slaHoursRemaining}h`,
              domain: "Compliance",
              severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info"
            });
          }
        }

        if (postSaleResult.status === "fulfilled" && postSaleResult.value) {
          for (const item of postSaleResult.value.items.slice(0, 2)) {
            nextTasks.push({
              id: item.id,
              lane: deriveLaneFromSignal({
                severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info",
                hours: item.slaHoursRemaining
              }),
              title: `${item.assetLabel} · ${item.caseType}`,
              detail: `${item.customerName} · ${item.projectName}`,
              owner: item.owner,
              dueLabel: `${item.slaHoursRemaining}h`,
              domain: "Post-sale",
              severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info"
            });
          }

          if (postSaleResult.value.summary.overdueSlaCases > 0) {
            nextTasks.push({
              id: "post_sale_overdue_sla",
              lane: "risk",
              title: "Customer delivery or warranty cases are already outside SLA",
              detail: `${postSaleResult.value.summary.overdueSlaCases} cases already breached their expected response window`,
              owner: postSaleResult.value.focusItem?.owner ?? "Post-sale",
              dueLabel: postSaleResult.value.focusItem?.nextAction ?? "Customer recovery",
              domain: "Post-sale",
              severity: "critical"
            });
          }
        }

        if (integrationsResult.status === "fulfilled" && integrationsResult.value) {
          for (const risk of integrationsResult.value.risks.slice(0, 1)) {
            nextTasks.push({
              id: risk.id,
              lane: deriveLaneFromSignal({ severity: risk.severity }),
              title: risk.title,
              detail: `${risk.category} · connected ops`,
              owner: risk.owner,
              dueLabel: risk.status,
              domain: "Integrations",
              severity: risk.severity
            });
          }
        }

        if (documentControlResult.status === "fulfilled" && documentControlResult.value) {
          for (const item of documentControlResult.value.items.slice(0, 2)) {
            nextTasks.push({
              id: item.id,
              lane: deriveLaneFromSignal({
                severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info"
              }),
              title: item.subject,
              detail: `${item.documentType} · ${item.projectName}`,
              owner: item.owner,
              dueLabel: `${item.turnaroundDays} d`,
              domain: "Document control",
              severity: item.health === "critical" ? "critical" : item.health === "watch" ? "warning" : "info"
            });
          }

          if (
            documentControlResult.value.summary.openRfis > 0 ||
            documentControlResult.value.summary.activeSubmittals > 0
          ) {
            nextTasks.push({
              id: "document_control_execution_pressure",
              lane: "risk",
              title: "Field execution is still feeding document coordination pressure",
              detail: `${documentControlResult.value.summary.openRfis} open RFIs and ${documentControlResult.value.summary.activeSubmittals} active submittals are still live in execution flow`,
              owner: documentControlResult.value.focusItem?.owner ?? "Document control",
              dueLabel: documentControlResult.value.focusItem?.nextAction ?? "Document resolution",
              domain: "Document control",
              severity: "critical"
            });
          }
        }

        if (nextTasks.length === 0) {
          setError("Operations blackboard did not receive live signals.");
          return;
        }

        setTasks(nextTasks);
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

  const domainOptions = useMemo(() => Array.from(new Set(tasks.map((task) => task.domain))).sort((left, right) => left.localeCompare(right)), [tasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesLane = laneFilter === "all" || task.lane === laneFilter;
      const matchesDomain = domainFilter === "all" || task.domain === domainFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        task.title.toLowerCase().includes(normalizedSearch) ||
        task.detail.toLowerCase().includes(normalizedSearch) ||
        task.owner.toLowerCase().includes(normalizedSearch) ||
        task.dueLabel.toLowerCase().includes(normalizedSearch);

      return matchesLane && matchesDomain && matchesSearch;
    });
  }, [domainFilter, laneFilter, searchFilter, tasks]);

  const selectedTask = useMemo(
    () => filteredTasks.find((task) => task.id == selectedTaskId) ?? filteredTasks[0] ?? null,
    [filteredTasks, selectedTaskId]
  );

  const selectedTaskState = useMemo(() => buildTaskOperatingState(selectedTask), [selectedTask]);
  const selectedTaskHumanStep = useMemo(() => buildTaskHumanStep(selectedTask), [selectedTask]);
  const selectedTaskWhyNow = useMemo(() => buildTaskWhyNow(selectedTask), [selectedTask]);
  const selectedTaskDownstreamEffect = useMemo(() => buildTaskDownstreamEffect(selectedTask), [selectedTask]);
  const selectedTaskReportBackWindow = useMemo(() => buildTaskReportBackWindow(selectedTask), [selectedTask]);
  const selectedTaskRouteSummary = useMemo(() => buildTaskRouteSummary(selectedTask), [selectedTask]);
  const selectedTaskLinks = useMemo(() => buildTaskRelatedLinks(selectedTask), [selectedTask]);

  useEffect(() => {
    if (filteredTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }

    const visible = filteredTasks.some((task) => task.id === selectedTaskId);
    if (!visible) {
      setSelectedTaskId(filteredTasks[0]?.id ?? null);
    }
  }, [filteredTasks, selectedTaskId]);

  useEffect(() => {
    if (!dailyLogPreload || !dailyLogPreloadKey || appliedDailyLogPreloadKey === dailyLogPreloadKey || tasks.length === 0) {
      return;
    }

    const preloadTerms = [dailyLogPreload.projectName, dailyLogPreload.frontName, dailyLogPreload.owner].filter(Boolean);
    if (preloadTerms.length > 0) {
      setSearchFilter(preloadTerms.join(" "));
    }

    const matchedTask = pickTaskFromPreload(tasks, dailyLogPreload);
    if (matchedTask) {
      setSelectedTaskId(matchedTask.id);
    }

    setAppliedDailyLogPreloadKey(dailyLogPreloadKey);
  }, [appliedDailyLogPreloadKey, dailyLogPreload, dailyLogPreloadKey, tasks]);
  const projectsPreloadResolution = useMemo(
    () => (projectsPreload ? resolveProjectsPreloadMatch(tasks, projectsPreload) : null),
    [projectsPreload, tasks]
  );

  useEffect(() => {
    if (
      !projectsPreload ||
      !projectsPreloadKey ||
      appliedProjectsPreloadKey === projectsPreloadKey ||
      tasks.length === 0
    ) {
      return;
    }

    const preloadTerms = [
      projectsPreload.projectName,
      projectsPreload.frontName,
      projectsPreload.owner,
      projectsPreload.summary,
      projectsPreload.nextAction,
      projectsPreload.scheduleActivityName,
      projectsPreload.schedulePhase
    ].filter(Boolean);

    setLaneFilter("all");
    setDomainFilter("all");
    if (preloadTerms.length > 0) {
      setSearchFilter(preloadTerms.join(" "));
    }

    if (projectsPreloadResolution?.matchedTask) {
      setSelectedTaskId(projectsPreloadResolution.matchedTask.id);
    }

    setAppliedProjectsPreloadKey(projectsPreloadKey);
  }, [appliedProjectsPreloadKey, projectsPreload, projectsPreloadKey, projectsPreloadResolution, tasks.length]);

  const lanes = useMemo(
    () => ({
      new: filteredTasks.filter((task) => task.lane === "new"),
      in_progress: filteredTasks.filter((task) => task.lane === "in_progress"),
      risk: filteredTasks.filter((task) => task.lane === "risk"),
      closed: filteredTasks.filter((task) => task.lane === "closed")
    }),
    [filteredTasks]
  );

  const summary = useMemo(() => {
    const openTasks = filteredTasks.filter((task) => task.lane !== "closed");
    const dueSoon = filteredTasks.filter((task) => task.lane === "new" || task.lane === "risk");
    const criticalResolved = filteredTasks.filter((task) => task.lane === "closed" && task.severity === "critical").length;
    const complianceRate = filteredTasks.length > 0 ? Math.round(((filteredTasks.length - lanes.risk.length) / filteredTasks.length) * 100) : 0;

    return {
      openTasks: openTasks.length,
      dueSoon: dueSoon.length,
      complianceRate,
      criticalResolved,
      fieldChainPressure: filteredTasks.filter((task) =>
        ["Daily log", "Field materials", "Quality", "Equipment", "Document control", "Procurement", "POs"].includes(task.domain)
      ).length
    };
  }, [filteredTasks, lanes.risk.length]);

  const priorityActions = useMemo(
    () => filteredTasks.filter((task) => task.lane === "risk" || task.severity === "critical").slice(0, 4),
    [filteredTasks]
  );
  const showDailyLogPreloadOnSelectedCard = Boolean(dailyLogPreload && selectedTask && taskMatchesPreload(selectedTask, dailyLogPreload));
  const showProjectsPreloadOnSelectedCard = Boolean(
    projectsPreload &&
      projectsPreloadResolution?.matchedTask &&
      selectedTask &&
      projectsPreloadResolution.matchedTask.id === selectedTask.id
  );
  const chainWalkthrough = useMemo(() => {
    const countFor = (domains: string[]) => filteredTasks.filter((task) => domains.includes(task.domain)).length;

    return [
      {
        label: "Field demand",
        value: countFor(["Daily log", "Field materials"]),
        href: "/field",
        cta: "Open field"
      },
      {
        label: "Requisition intake",
        value: countFor(["Procurement"]),
        href: "/procurement/requisitions",
        cta: "Open requisitions"
      },
      {
        label: "PO execution",
        value: countFor(["POs", "Supplier control", "Supplier master"]),
        href: "/procurement/purchase-orders",
        cta: "Open purchase orders"
      },
      {
        label: "Inbound flow",
        value: countFor(["Receiving", "Movements", "Inventory"]),
        href: "/inventory/receiving",
        cta: "Open receiving"
      },
      {
        label: "Financial release",
        value: countFor(["Accounts payable", "Treasury runs", "Cash flow", "Finance"]),
        href: "/accounts-payable",
        cta: "Open finance chain"
      }
    ];
  }, [filteredTasks]);
  const ownerWorkload = useMemo(() => {
    const grouped = new Map<
      string,
      {
        owner: string;
        total: number;
        risk: number;
        domains: Set<string>;
        topSignal: string;
      }
    >();

    for (const task of filteredTasks) {
      const current = grouped.get(task.owner);
      if (current) {
        current.total += 1;
        current.risk += task.lane === "risk" || task.severity === "critical" ? 1 : 0;
        current.domains.add(task.domain);
      } else {
        grouped.set(task.owner, {
          owner: task.owner,
          total: 1,
          risk: task.lane === "risk" || task.severity === "critical" ? 1 : 0,
          domains: new Set([task.domain]),
          topSignal: task.title
        });
      }
    }

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        domains: Array.from(item.domains)
      }))
      .sort((left, right) => {
        if (left.risk !== right.risk) {
          return right.risk - left.risk;
        }
        return right.total - left.total;
      })
      .slice(0, 6);
  }, [filteredTasks]);
  const domainBlockers = useMemo(() => {
    const grouped = new Map<
      string,
      {
        domain: string;
        total: number;
        risk: number;
        owner: string;
        topSignal: string;
      }
    >();

    for (const task of filteredTasks) {
      const current = grouped.get(task.domain);
      const taskRisk = task.lane === "risk" || task.severity === "critical" ? 1 : 0;
      if (current) {
        current.total += 1;
        current.risk += taskRisk;
      } else {
        grouped.set(task.domain, {
          domain: task.domain,
          total: 1,
          risk: taskRisk,
          owner: task.owner,
          topSignal: task.title
        });
      }
    }

    return Array.from(grouped.values())
      .sort((left, right) => {
        if (left.risk !== right.risk) {
          return right.risk - left.risk;
        }
        return right.total - left.total;
      })
      .slice(0, 6);
  }, [filteredTasks]);

  return (
    <AppShell
      title="Operations blackboard"
      eyebrow="Cross-domain coordination"
      description="A single live view of what is blocked, what is aging and who owns the next move across the operating stack."
      actions={
        <Badge tone={isDemoMode ? "warning" : "success"}>
          {isLoading ? "refreshing" : isDemoMode ? "demo operable" : "live backend"}
        </Badge>
      }
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Operations">
        {tasks.length > 0 ? (
          <>
            <section className="heroPanel">
              <div>
                <h2>One board for execution pressure, ownership and weekly commitments.</h2>
                <p>
                  Instead of jumping between modules, the team can now see the cross-domain backlog, owners,
                  compliance pressure and immediate blockers in a single live cockpit.
                </p>
                <div className="heroMetrics">
                  <div className="heroMetric">
                    <strong>{summary.openTasks}</strong>
                    <span>Open signals still requiring action</span>
                  </div>
                  <div className="heroMetric">
                    <strong>{summary.dueSoon}</strong>
                    <span>Signals demanding immediate follow-up</span>
                  </div>
                <div className="heroMetric">
                  <strong>{summary.complianceRate}%</strong>
                  <span>Rolling operating compliance across the current board</span>
                </div>
                <div className="heroMetric">
                  <strong>{summary.fieldChainPressure}</strong>
                  <span>Signals already traveling across field, quality, equipment, docs and buying flow</span>
                </div>
              </div>
            </div>

              <Card
                title="Board posture"
                description="Cross-functional health built from the live module overviews already available in ARCONT."
                aside={<Badge tone="gold">{activeCompany.tradeName}</Badge>}
              >
                <div className="statStrip">
                  <div className="statTile">
                    <strong>{lanes.risk.length}</strong>
                    <span>Signals already in risk lane</span>
                  </div>
                  <div className="statTile">
                    <strong>{summary.criticalResolved}</strong>
                    <span>Critical signals already resolved</span>
                  </div>
                </div>
                <p className="sectionText">
                  This board now blends projects, field capture, quality, equipment, procurement, finance, compliance, integrations and document control.
                </p>
                {isDemoMode ? (
                  <p className="sectionText" style={{ marginTop: 12 }}>
                    Demo mode keeps this board usable from the seeded project and equipment flows while the rest of the tenant stack is still being connected.
                  </p>
                ) : null}
              </Card>
            </section>

            <section className="grid cols4">
              <KpiCard
                label="Open tasks"
                value={String(summary.openTasks)}
                footnote="All live signals that still require action or follow-up."
              />
              <KpiCard
                label="Due this cycle"
                value={String(summary.dueSoon)}
                footnote="Signals concentrated in new or risk lanes."
              />
              <KpiCard
                label="Rolling compliance"
                value={`${summary.complianceRate}%`}
                footnote="Share of the current board not already in risk."
              />
              <KpiCard
                label="Risk lane"
                value={String(lanes.risk.length)}
                footnote="Signals already blocked, overdue or critical."
              />
              <KpiCard
                label="Field chain"
                value={String(summary.fieldChainPressure)}
                footnote="Signals already propagating from field into quality, equipment, documents or buying."
              />
            </section>

            <section className="grid cols2">
              <Card
                title="Operations command lane"
                description="Operations should be the central blackboard for sequencing pressure across field, supply, finance and close control."
                aside={<Badge tone={lanes.risk.length > 0 ? "danger" : lanes.new.length > 0 ? "warning" : "success"}>{lanes.risk.length > 0 ? "risk-loaded" : lanes.new.length > 0 ? "new intake" : "stable board"}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Current route</div><div>{buildOperationsWorkflow(filteredTasks)}</div></div>
                  <div className="detailRow"><div className="detailLabel">Executive use</div><div>Use this board to decide which domain should act next without reopening every module first.</div></div>
                  <div className="detailRow"><div className="detailLabel">Expected jump</div><div>Every critical task should send the user directly to the module where the issue will actually be worked.</div></div>
                  {projectsPreload && !showProjectsPreloadOnSelectedCard ? (
                    <>
                      <div className="detailRow">
                        <div className="detailLabel">Context</div>
                        <div><Badge tone="info">Precargado desde programa / Preloaded from schedule</Badge></div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Match status</div>
                        <div>
                          {projectsPreloadResolution?.hasClearMatch
                            ? "A clear blackboard match was applied automatically."
                            : "No clear blackboard match was found; search context stays visible and applied."}
                        </div>
                      </div>
                      {projectsPreload.projectName ? (
                        <div className="detailRow"><div className="detailLabel">Project</div><div>{projectsPreload.projectName}</div></div>
                      ) : null}
                      {projectsPreload.frontName ? (
                        <div className="detailRow"><div className="detailLabel">Front</div><div>{projectsPreload.frontName}</div></div>
                      ) : null}
                      {projectsPreload.scheduleActivityName ? (
                        <div className="detailRow"><div className="detailLabel">Target activity</div><div>{projectsPreload.scheduleActivityName}</div></div>
                      ) : null}
                      {projectsPreload.schedulePhase ? (
                        <div className="detailRow"><div className="detailLabel">Phase</div><div>{projectsPreload.schedulePhase}</div></div>
                      ) : null}
                      {projectsPreload.owner ? (
                        <div className="detailRow"><div className="detailLabel">Owner context</div><div>{projectsPreload.owner}</div></div>
                      ) : null}
                      {projectsPreload.summary ? (
                        <div className="detailRow"><div className="detailLabel">Summary</div><div>{projectsPreload.summary}</div></div>
                      ) : null}
                      {projectsPreload.nextAction ? (
                        <div className="detailRow"><div className="detailLabel">Next action</div><div>{projectsPreload.nextAction}</div></div>
                      ) : null}
                    </>
                  ) : null}
                  {dailyLogPreload && !showDailyLogPreloadOnSelectedCard ? (
                    <>
                      <div className="detailRow">
                        <div className="detailLabel">Context</div>
                        <div><Badge tone="warning">Precargado desde bitácora / Preloaded from daily log</Badge></div>
                      </div>
                      <div className="detailRow"><div className="detailLabel">Project</div><div>{dailyLogPreload.projectName || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Front</div><div>{dailyLogPreload.frontName || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Owner</div><div>{dailyLogPreload.owner || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Next action</div><div>{dailyLogPreload.nextAction || "N/A"}</div></div>
                      {dailyLogPreload.pendingDestajo ? (
                        <div className="detailRow"><div className="detailLabel">Pending destajo</div><div>{dailyLogPreload.pendingDestajo}</div></div>
                      ) : null}
                      {dailyLogPreload.subcontractHealth ? (
                        <div className="detailRow"><div className="detailLabel">Subcontract health</div><div>{dailyLogPreload.subcontractHealth}</div></div>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/dashboard">Open dashboard</Link>
                  <Link className="buttonGhost" href="/projects">Open projects</Link>
                  <Link className="buttonGhost" href="/field">Open field</Link>
                  <Link className="buttonGhost" href="/finance">Open finance</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Field-to-operations chain" description="The key operating route is now explicit so testers can follow one real flow instead of browsing modules at random.">
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">1. Capture in field</div>
                    <div>Create a field signal or daily log for the active front and confirm the next operational action.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">2. Validate in daily log</div>
                    <div>Submit or flag the bitacora so supervision pressure becomes visible and actionable.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">3. Escalate the chain</div>
                    <div>Continue into requisitions, purchase orders, receiving or finance depending on the blocker source.</div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/field">Open field</Link>
                  <Link className="buttonGhost" href="/daily-log">Open daily log</Link>
                  <Link className="buttonGhost" href="/procurement/requisitions">Open requisitions</Link>
                </div>
              </Card>

              <Card title="Operational board" description="Live cross-domain signals grouped by execution lane.">
                <div className="moduleGrid">
                  {(["new", "in_progress", "risk", "closed"] as const).map((lane) => (
                    <div className="moduleCard" key={lane}>
                      <div className="moduleMeta">
                        <div>
                          <h4>{laneLabel(lane)}</h4>
                          <p>{lanes[lane].length} signals in this lane.</p>
                        </div>
                        <Badge tone={lane === "risk" ? "danger" : lane === "closed" ? "success" : "info"}>
                          {lanes[lane].length}
                        </Badge>
                      </div>
                      <div className="list">
                        {lanes[lane].slice(0, 3).map((task) => (
                          <div className="listItem" key={task.id}>
                            <div>
                              <strong>{task.title}</strong>
                              <p>{task.detail}</p>
                            </div>
                            <Badge tone={severityTone(task.severity)}>{task.domain}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Signals by owner and domain" description="Focused table to decide who must move next and from which area.">
                <FilterBar summary={`${filteredTasks.length} live cross-domain signals match the current operating filters`}>
                  <label className="fieldLabel">
                    Lane
                    <select className="field" value={laneFilter} onChange={(event) => setLaneFilter(event.target.value as typeof laneFilter)}>
                      <option value="all">All</option>
                      <option value="new">New</option>
                      <option value="in_progress">In progress</option>
                      <option value="risk">Risk</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    Domain
                    <select className="field" value={domainFilter} onChange={(event) => setDomainFilter(event.target.value)}>
                      <option value="all">All</option>
                      {domainOptions.map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    Search
                    <input className="field" type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder="Signal, owner, detail or next label" />
                  </label>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "board ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredTasks}
                  columns={[
                    {
                      key: "task",
                      label: "Signal",
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedTaskId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.title}</strong>
                            <span className="tableCellMuted">{row.detail}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "owner",
                      label: "Owner",
                      render: (row) => row.owner
                    },
                    {
                      key: "domain",
                      label: "Domain",
                      render: (row) => <Badge tone="neutral">{row.domain}</Badge>
                    },
                    {
                      key: "due",
                      label: "Next signal",
                      render: (row) => row.dueLabel
                    }
                  ]}
                />
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title={selectedTask ? selectedTask.title : "Selected signal"}
                description={selectedTask ? `${selectedTask.domain} · ${selectedTask.owner}` : "Choose a board signal to inspect its real continuity path."}
                aside={<Badge tone={selectedTaskState.tone}>{selectedTaskState.label}</Badge>}
              >
                <div className="detailGrid">
                  {showProjectsPreloadOnSelectedCard ? (
                    <>
                      <div className="detailRow">
                        <div className="detailLabel">Context</div>
                        <div><Badge tone="info">Precargado desde programa / Preloaded from schedule</Badge></div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Match status</div>
                        <div>Clear blackboard match applied automatically from schedule context.</div>
                      </div>
                      <div className="detailRow"><div className="detailLabel">Project</div><div>{projectsPreload?.projectName || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Front</div><div>{projectsPreload?.frontName || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Target activity</div><div>{projectsPreload?.scheduleActivityName || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Phase</div><div>{projectsPreload?.schedulePhase || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Owner context</div><div>{projectsPreload?.owner || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Summary</div><div>{projectsPreload?.summary || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Next action</div><div>{projectsPreload?.nextAction || "N/A"}</div></div>
                    </>
                  ) : null}
                  {showDailyLogPreloadOnSelectedCard ? (
                    <>
                      <div className="detailRow">
                        <div className="detailLabel">Context</div>
                        <div><Badge tone="warning">Precargado desde bitácora / Preloaded from daily log</Badge></div>
                      </div>
                      <div className="detailRow"><div className="detailLabel">Project</div><div>{dailyLogPreload?.projectName || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Front</div><div>{dailyLogPreload?.frontName || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Owner context</div><div>{dailyLogPreload?.owner || "N/A"}</div></div>
                      <div className="detailRow"><div className="detailLabel">Next action</div><div>{dailyLogPreload?.nextAction || "N/A"}</div></div>
                      {dailyLogPreload?.pendingDestajo ? (
                        <div className="detailRow"><div className="detailLabel">Pending destajo</div><div>{dailyLogPreload.pendingDestajo}</div></div>
                      ) : null}
                      {dailyLogPreload?.subcontractHealth ? (
                        <div className="detailRow"><div className="detailLabel">Subcontract health</div><div>{dailyLogPreload.subcontractHealth}</div></div>
                      ) : null}
                    </>
                  ) : null}
                  <div className="detailRow"><div className="detailLabel">Domain</div><div>{selectedTask?.domain ?? "No domain selected"}</div></div>
                  <div className="detailRow"><div className="detailLabel">Owner</div><div>{selectedTask?.owner ?? "No owner selected"}</div></div>
                  <div className="detailRow"><div className="detailLabel">Next signal</div><div>{selectedTask?.dueLabel ?? "No next signal"}</div></div>
                  <div className="detailRow"><div className="detailLabel">Operating state</div><div className="tableCellStack"><span className="tableCellMuted">{selectedTaskState.summary}</span>{selectedTaskState.checks.map((check) => (<span key={check} className="tableCellMuted">{check}</span>))}</div></div>
                  <div className="detailRow"><div className="detailLabel">Why now</div><div>{selectedTaskWhyNow}</div></div>
                  <div className="detailRow"><div className="detailLabel">Next human step</div><div>{selectedTaskHumanStep}</div></div>
                  <div className="detailRow"><div className="detailLabel">Downstream effect</div><div>{selectedTaskDownstreamEffect}</div></div>
                  <div className="detailRow"><div className="detailLabel">Route summary</div><div>{selectedTaskRouteSummary}</div></div>
                  <div className="detailRow"><div className="detailLabel">Report back</div><div>{selectedTaskReportBackWindow}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  {selectedTaskLinks.map((link, index) => (
                    <Link key={`${link.href}-${link.label}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </Card>

              <Card title="Jump Actions" description="Open the exact module owning the current blocker instead of chasing it manually.">
                <div className="list">
                  {priorityActions.map((task) => (
                    <div className="listItem" key={task.id}>
                      <div>
                        <strong>{task.title}</strong>
                        <p>{task.domain} · {task.owner}</p>
                      </div>
                      <div className="row gap wrap">
                        <Badge tone={severityTone(task.severity)}>{task.dueLabel}</Badge>
                        <Link className="buttonGhost" href={primaryHrefForTask(task)}>
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Supply Chain Walkthrough" description="Follow the exact operating chain from field demand to payment release without losing context.">
                <div className="list">
                  {chainWalkthrough.map((step) => (
                    <div className="listItem" key={step.label}>
                      <div>
                        <strong>{step.label}</strong>
                        <p>{step.value} live signals currently sit in this step of the chain.</p>
                      </div>
                      <div className="row gap wrap">
                        <Badge tone={step.value > 0 ? "warning" : "success"}>{step.value}</Badge>
                        <Link className="buttonGhost" href={step.href}>
                          {step.cta}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/field">Start from field</Link>
                  <Link className="buttonGhost" href="/supplier-control">Open supplier blockers</Link>
                  <Link className="buttonGhost" href="/treasury/payment-runs">Open treasury release</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Execution indicators" description="Simple cross-domain quality metrics for the current board.">
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">At time</div>
                    <div>{summary.complianceRate}%</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Risk lane</div>
                    <div>{lanes.risk.length} signals</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Need reassignment</div>
                    <div>{tasks.filter((task) => task.severity !== "info").length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Field chain</div>
                    <div>{summary.fieldChainPressure} signals</div>
                  </div>
                </div>
              </Card>

              <Card title="Compliance alerts" description="Signals the operating team should prioritize first.">
                <div className="list">
                  {tasks
                    .filter((task) => task.severity !== "info")
                    .slice(0, 3)
                    .map((task) => (
                      <div className="listItem" key={task.id}>
                        <div>
                          <strong>{task.title}</strong>
                          <p>{task.owner}</p>
                        </div>
                        <Badge tone={severityTone(task.severity)}>{task.domain}</Badge>
                      </div>
                    ))}
                </div>
              </Card>

              <Card title="Owner workload" description="Who is currently carrying the heaviest cross-domain pressure.">
                <div className="list">
                  {ownerWorkload.map((item) => (
                    <div className="listItem" key={item.owner}>
                      <div>
                        <strong>{item.owner}</strong>
                        <p>{item.topSignal}</p>
                      </div>
                      <div className="tableCellStack" style={{ alignItems: "flex-end" }}>
                        <Badge tone={item.risk > 0 ? "danger" : "info"}>{item.risk} risk</Badge>
                        <span className="tableCellMuted">{item.total} signals · {item.domains.join(", ")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Top Blockers by Domain" description="Which domains are currently concentrating the highest operational pressure.">
                <div className="list">
                  {domainBlockers.map((item) => (
                    <div className="listItem" key={item.domain}>
                      <div>
                        <strong>{item.domain}</strong>
                        <p>{item.topSignal}</p>
                      </div>
                      <div className="tableCellStack" style={{ alignItems: "flex-end" }}>
                        <Badge tone={item.risk > 0 ? "danger" : "info"}>{item.risk} risk</Badge>
                        <span className="tableCellMuted">{item.total} signals · {item.owner}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Weekly Handoff" description="Suggested weekly review sequence for the current operating pressure.">
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">1. Field to buying</div>
                    <div>Review field materials, requisitions and PO continuity before site blockers age further.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">2. Supplier and asset</div>
                    <div>Escalate concentrated suppliers and critical equipment before execution windows are lost.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">3. Finance release</div>
                    <div>Close supplier fiscal, payables and treasury blockers after supply posture is clarified.</div>
                  </div>
                </div>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="Operations blackboard unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open field", href: "/field" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading operations blackboard" : "Operations blackboard not loaded yet"}
            description={
              isDemoMode
                ? "This route should aggregate demo and live-operable signals from field, daily log, supply chain and finance."
                : "This route aggregates live signals from the other operating modules for the active tenant."
            }
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
