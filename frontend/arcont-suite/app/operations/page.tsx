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

export default function OperationsPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [tasks, setTasks] = useState<BlackboardTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session.authenticated || !session.accessToken) {
      setTasks([]);
      return;
    }

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
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

  const lanes = useMemo(
    () => ({
      new: tasks.filter((task) => task.lane === "new"),
      in_progress: tasks.filter((task) => task.lane === "in_progress"),
      risk: tasks.filter((task) => task.lane === "risk"),
      closed: tasks.filter((task) => task.lane === "closed")
    }),
    [tasks]
  );

  const summary = useMemo(() => {
    const openTasks = tasks.filter((task) => task.lane !== "closed");
    const dueSoon = tasks.filter((task) => task.lane === "new" || task.lane === "risk");
    const criticalResolved = tasks.filter((task) => task.lane === "closed" && task.severity === "critical").length;
    const complianceRate = tasks.length > 0 ? Math.round(((tasks.length - lanes.risk.length) / tasks.length) * 100) : 0;

    return {
      openTasks: openTasks.length,
      dueSoon: dueSoon.length,
      complianceRate,
      criticalResolved,
      fieldChainPressure: tasks.filter((task) =>
        ["Daily log", "Field materials", "Quality", "Equipment", "Document control", "Procurement", "POs"].includes(task.domain)
      ).length
    };
  }, [lanes.risk.length, tasks]);

  const priorityActions = useMemo(
    () => tasks.filter((task) => task.lane === "risk" || task.severity === "critical").slice(0, 4),
    [tasks]
  );
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

    for (const task of tasks) {
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
  }, [tasks]);
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

    for (const task of tasks) {
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
  }, [tasks]);

  return (
    <AppShell
      title="Operations blackboard"
      eyebrow="Cross-domain coordination"
      description="A single live view of what is blocked, what is aging and who owns the next move across the operating stack."
      actions={
        <Badge tone={session.authenticated ? "success" : "warning"}>
          {isLoading ? "refreshing" : session.authenticated ? "live backend" : source}
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
                <FilterBar summary={`${tasks.length} live cross-domain signals`}>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "board ready"}</Badge>
                </FilterBar>
                <DataTable
                  rows={tasks}
                  columns={[
                    {
                      key: "task",
                      label: "Signal",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.title}</strong>
                          <span className="tableCellMuted">{row.detail}</span>
                        </div>
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

              <Card title="Flow Shortcuts" description="Direct entry points into the cross-domain chains that are already active.">
                <div className="row gap wrap">
                  <Link className="button" href="/procurement/requisitions">Field to requisitions</Link>
                  <Link className="buttonGhost" href="/procurement/purchase-orders">Requisitions to PO</Link>
                  <Link className="buttonGhost" href="/inventory/receiving">PO to receiving</Link>
                  <Link className="buttonGhost" href="/supplier-control">Supplier blockers</Link>
                  <Link className="buttonGhost" href="/supplier-master">Supplier fiscal</Link>
                  <Link className="buttonGhost" href="/accounts-payable">Invoice blockers</Link>
                  <Link className="buttonGhost" href="/equipment">Equipment blockers</Link>
                  <Link className="buttonGhost" href="/treasury/payment-runs">Treasury release</Link>
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
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading operations blackboard" : "Operations blackboard not loaded yet"}
            description="This route aggregates live signals from the other operating modules for the active tenant."
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
