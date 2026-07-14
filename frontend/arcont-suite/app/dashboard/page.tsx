"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleBadge } from "@/components/ui/module-badge";
import {
  fetchAccountsPayableOverview,
  fetchCashFlowOverview,
  fetchComplianceOverview,
  fetchCrmOverview,
  fetchDailyLogOverview,
  fetchDocumentControlOverview,
  fetchEquipmentOverview,
  fetchEstimationCollectionOverview,
  fetchFieldMaterialRequestsOverview,
  fetchFinanceOverview,
  fetchProjectsOverview,
  fetchInventoryMovementsOverview,
  fetchInventoryReceivingOverview,
  fetchInventoryOverview,
  fetchPostSaleOverview,
  fetchProcurementOverview,
  fetchProcurementPurchaseOrdersOverview,
  fetchQualityOverview,
  fetchSupplierMasterOverview,
  fetchSupplierControlOverview,
  fetchSubcontractOverview,
  fetchTreasuryPaymentRunsOverview
} from "@/lib/platform-api";

type ExecutiveSnapshot = {
  crm: NonNullable<Awaited<ReturnType<typeof fetchCrmOverview>>>;
  projects: NonNullable<Awaited<ReturnType<typeof fetchProjectsOverview>>>;
  dailyLog: NonNullable<Awaited<ReturnType<typeof fetchDailyLogOverview>>>;
  quality: NonNullable<Awaited<ReturnType<typeof fetchQualityOverview>>>;
  subcontracts: NonNullable<Awaited<ReturnType<typeof fetchSubcontractOverview>>>;
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
  fieldMaterials: NonNullable<Awaited<ReturnType<typeof fetchFieldMaterialRequestsOverview>>>;
  inventory: NonNullable<Awaited<ReturnType<typeof fetchInventoryOverview>>>;
  inventoryReceiving: NonNullable<Awaited<ReturnType<typeof fetchInventoryReceivingOverview>>>;
  inventoryMovements: NonNullable<Awaited<ReturnType<typeof fetchInventoryMovementsOverview>>>;
  estimations: NonNullable<Awaited<ReturnType<typeof fetchEstimationCollectionOverview>>>;
  cashFlow: NonNullable<Awaited<ReturnType<typeof fetchCashFlowOverview>>>;
  procurement: NonNullable<Awaited<ReturnType<typeof fetchProcurementOverview>>>;
  procurementPurchaseOrders: NonNullable<Awaited<ReturnType<typeof fetchProcurementPurchaseOrdersOverview>>>;
  supplierControl: NonNullable<Awaited<ReturnType<typeof fetchSupplierControlOverview>>>;
  supplierMaster: NonNullable<Awaited<ReturnType<typeof fetchSupplierMasterOverview>>>;
  treasury: NonNullable<Awaited<ReturnType<typeof fetchTreasuryPaymentRunsOverview>>>;
  accountsPayable: NonNullable<Awaited<ReturnType<typeof fetchAccountsPayableOverview>>>;
  compliance: NonNullable<Awaited<ReturnType<typeof fetchComplianceOverview>>>;
  postSale: NonNullable<Awaited<ReturnType<typeof fetchPostSaleOverview>>>;
  finance: NonNullable<Awaited<ReturnType<typeof fetchFinanceOverview>>>;
  documentControl: NonNullable<Awaited<ReturnType<typeof fetchDocumentControlOverview>>>;
};

type RecentSiteSignal = {
  id: string;
  project: string;
  area: string;
  title: string;
  detail: string;
  owner: string;
  href: string;
  tone: "success" | "warning" | "danger" | "info";
};

type RecentSiteSignalGroup = {
  project: string;
  items: RecentSiteSignal[];
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
      fetchProjectsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDailyLogOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchQualityOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSubcontractOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchEquipmentOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFieldMaterialRequestsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryReceivingOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryMovementsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchEstimationCollectionOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchCashFlowOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchProcurementOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchProcurementPurchaseOrdersOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSupplierControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchSupplierMasterOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchAccountsPayableOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchComplianceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchPostSaleOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFinanceOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([
          crm,
          projects,
          dailyLog,
          quality,
          subcontracts,
          equipment,
          fieldMaterials,
          inventory,
          inventoryReceiving,
          inventoryMovements,
          estimations,
          cashFlow,
          procurement,
          procurementPurchaseOrders,
          supplierControl,
          supplierMaster,
          accountsPayable,
          treasury,
          compliance,
          postSale,
          finance,
          documentControl
        ]) => {
        if (cancelled) {
          return;
        }

        if (
          !crm ||
          !projects ||
          !dailyLog ||
          !quality ||
          !subcontracts ||
          !equipment ||
          !fieldMaterials ||
          !inventory ||
          !inventoryReceiving ||
          !inventoryMovements ||
          !estimations ||
          !cashFlow ||
          !procurement ||
          !procurementPurchaseOrders ||
          !supplierControl ||
          !supplierMaster ||
          !accountsPayable ||
          !treasury ||
          !compliance ||
          !postSale ||
          !finance ||
          !documentControl
        ) {
          setSnapshotError("Executive dashboard could not assemble all live operating signals.");
          return;
        }

        setSnapshot({
          crm,
          projects,
          dailyLog,
          quality,
          subcontracts,
          equipment,
          fieldMaterials,
          inventory,
          inventoryReceiving,
          inventoryMovements,
          estimations,
          cashFlow,
          procurement,
          procurementPurchaseOrders,
          supplierControl,
          supplierMaster,
          accountsPayable,
          treasury,
          compliance,
          postSale,
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
        title: "Portfolio intake",
        detail: `${snapshot.projects.projects.length} projects are registered, latest intake: ${snapshot.projects.projects[0]?.code ?? "n/a"} · ${snapshot.projects.projects[0]?.name ?? "No recent project"}.`,
        tone:
          snapshot.projects.projects[0]?.status === "blocked"
            ? "danger"
            : snapshot.projects.projects[0]?.status === "planning" || snapshot.projects.projects[0]?.status === "at_risk"
              ? "warning"
              : "success"
      },
      {
        title: "Commercial pipeline",
        detail: `${snapshot.crm.summary.reservations} reservations and ${snapshot.crm.summary.qualifiedLeads} qualified leads in active flow.`,
        tone: snapshot.crm.summary.visitConversion < 20 ? "warning" : "success"
      },
      {
        title: "Execution discipline",
        detail: `${snapshot.projects.summary.executionRiskProjects} projects at execution risk, ${snapshot.dailyLog.summary.executionRiskLogs} logs under field pressure and ${snapshot.quality.summary.executionRiskInspections} inspections under release stress.`,
        tone:
          snapshot.projects.summary.executionRiskProjects > 0 ||
          snapshot.dailyLog.summary.executionRiskLogs > 0 ||
          snapshot.quality.summary.executionRiskInspections > 0
            ? "danger"
            : "success"
      },
      {
        title: "Inventory pressure",
        detail: `${snapshot.inventory.summary.urgentReplenishments} urgent replenishments and ${snapshot.inventory.summary.openVariances} open variances.`,
        tone: snapshot.inventory.summary.urgentReplenishments > 0 ? "warning" : "success"
      },
      {
        title: "Equipment readiness",
        detail: `${snapshot.equipment.summary.overdueMaintenance} overdue maintenance items and ${snapshot.equipment.summary.criticalOpenFailures} critical failures are still affecting field equipment.`,
        tone:
          snapshot.equipment.summary.criticalOpenFailures > 0 || snapshot.equipment.summary.overdueMaintenance > 0
            ? "danger"
            : snapshot.equipment.summary.machinesInMaintenance > 0
              ? "warning"
              : "success"
      },
      {
        title: "Field-to-backoffice chain",
        detail: `${snapshot.dailyLog.summary.executionRiskLogs} risky field logs, ${snapshot.quality.summary.executionRiskInspections} inspections under stress, ${snapshot.fieldMaterials.summary.linkedRequisitions} field-linked requisitions, ${snapshot.documentControl.summary.openRfis} open RFIs and ${snapshot.procurement.summary.openRequisitions} open requisitions are already connected in the operating chain.`,
        tone:
          snapshot.dailyLog.summary.executionRiskLogs > 0 ||
          snapshot.quality.summary.executionRiskInspections > 0 ||
          snapshot.fieldMaterials.summary.criticalRequests > 0 ||
          snapshot.documentControl.summary.openRfis > 0 ||
          snapshot.procurement.summary.openRequisitions > 0
            ? "danger"
            : "success"
      },
      {
        title: "Inbound receiving",
        detail: `${snapshot.inventoryReceiving.summary.overdueEta} overdue arrivals, ${snapshot.inventoryReceiving.summary.blockedReceipts} blocked receipts and ${snapshot.inventoryReceiving.summary.receiptsAtCommercialRisk} at commercial risk.`,
        tone:
          snapshot.inventoryReceiving.summary.blockedReceipts > 0 || snapshot.inventoryReceiving.summary.receiptsAtCommercialRisk > 0
            ? "danger"
            : snapshot.inventoryReceiving.summary.overdueEta > 0
              ? "warning"
              : "success"
      },
      {
        title: "Movement traceability",
        detail: `${snapshot.inventoryMovements.summary.openMovements} open movements, ${snapshot.inventoryMovements.summary.pendingEvidence} pending evidence items and ${snapshot.inventoryMovements.summary.movementsAtCommercialRisk} at commercial risk.`,
        tone:
          snapshot.inventoryMovements.summary.criticalMovements > 0 || snapshot.inventoryMovements.summary.movementsAtCommercialRisk > 0
            ? "danger"
            : "info"
      },
      {
        title: "Procurement approvals",
        detail: `${snapshot.procurement.summary.openRequisitions} open requisitions and ${snapshot.procurement.summary.strategicPackages} strategic packages.`,
        tone: snapshot.procurement.summary.averageApprovalHours > 48 ? "danger" : "info"
      },
      {
        title: "Purchase order execution",
        detail: `${snapshot.procurementPurchaseOrders.summary.inTransitOrders} orders in transit and ${snapshot.procurementPurchaseOrders.summary.blockedOrders} blocked.`,
        tone:
          snapshot.procurementPurchaseOrders.summary.blockedOrders > 0
            ? "danger"
            : snapshot.procurementPurchaseOrders.summary.pendingInvoiceMatch > 0
              ? "warning"
              : "success"
      },
      {
        title: "Supplier dependency",
        detail: `${snapshot.supplierControl.summary.criticalSuppliers} critical suppliers, ${snapshot.supplierControl.summary.concentratedSuppliers} concentrated and ${snapshot.supplierControl.summary.complianceAlerts} active alerts.`,
        tone:
          snapshot.supplierControl.summary.criticalSuppliers > 0
            ? "danger"
            : snapshot.supplierControl.summary.concentratedSuppliers > 0
              ? "warning"
              : "success"
      },
      {
        title: "Supplier fiscal readiness",
        detail: `${snapshot.supplierMaster.summary.criticalSuppliers} fiscal-critical suppliers, ${snapshot.supplierMaster.summary.incompletePackets} incomplete packets and ${snapshot.finance.summary.paymentReadySuppliers} suppliers already ready for payment flow.`,
        tone:
          snapshot.supplierMaster.summary.criticalSuppliers > 0
            ? "danger"
            : snapshot.supplierMaster.summary.incompletePackets > 0
              ? "warning"
              : "success"
      },
      {
        title: "Accounts payable release",
        detail: `${snapshot.accountsPayable.summary.blockedInvoices} blocked invoices, ${snapshot.accountsPayable.summary.overdueInvoices} overdue and MXN ${snapshot.accountsPayable.summary.openAmount.toLocaleString()} still open in payables.`,
        tone:
          snapshot.accountsPayable.summary.blockedInvoices > 0 || snapshot.accountsPayable.summary.overdueInvoices > 0
            ? "danger"
            : snapshot.accountsPayable.summary.criticalInvoices > 0
              ? "warning"
              : "success"
      },
      {
        title: "Collections aging",
        detail: `MXN ${snapshot.estimations.summary.pendingCollection.toLocaleString()} pending, ${snapshot.estimations.summary.criticalCollections} critical lines and ${snapshot.estimations.summary.overdueCollections} overdue tranches.`,
        tone:
          snapshot.estimations.summary.criticalCollections > 0 || snapshot.estimations.summary.overdueCollections > 0
            ? "danger"
            : "warning"
      },
      {
        title: "Treasury outlook",
        detail: `MXN ${snapshot.cashFlow.summary.weeklyNet.toLocaleString()} weekly net, ${snapshot.treasury.summary.activeRuns} active runs and ${snapshot.treasury.unavailableInvoices.length} invoices currently ineligible for a new batch.`,
        tone:
          snapshot.cashFlow.summary.weeklyNet < 0 ||
          snapshot.cashFlow.summary.criticalStreams > 0 ||
          snapshot.treasury.summary.blockedRuns > 0
            ? "danger"
            : snapshot.treasury.summary.readyRuns === 0
              ? "warning"
              : "success"
      },
      {
        title: "Finance release chain",
        detail: `${snapshot.finance.command.headline} Next: ${snapshot.finance.command.topAction}`,
        tone:
          snapshot.finance.command.laneStatus === "critical"
            ? "danger"
            : snapshot.finance.command.laneStatus === "watch"
              ? "warning"
              : "success"
      },
      {
        title: "Compliance backlog",
        detail: `${snapshot.compliance.summary.atRiskCases} cases at risk and ${snapshot.compliance.summary.openFindings} open findings.`,
        tone: snapshot.compliance.summary.atRiskCases > 0 ? "danger" : "success"
      },
      {
        title: "Handover and warranty",
        detail: `${snapshot.postSale.summary.openCases} open cases, ${snapshot.postSale.summary.criticalCases} critical and ${snapshot.postSale.summary.overdueSlaCases} already overdue.`,
        tone:
          snapshot.postSale.summary.criticalCases > 0 || snapshot.postSale.summary.overdueSlaCases > 0
            ? "danger"
            : snapshot.postSale.summary.pendingCustomerSignoff > 0
              ? "warning"
              : "success"
      }
    ];
  }, [snapshot]);

  const recentSiteSignals = useMemo<RecentSiteSignal[]>(() => {
    if (!snapshot) {
      return [];
    }

    const rows: RecentSiteSignal[] = [];

    if (snapshot.projects.projects[0]) {
      rows.push({
        id: `project-${snapshot.projects.projects[0].id}`,
        project: snapshot.projects.projects[0].name,
        area: "Projects",
        title: snapshot.projects.projects[0].code,
        detail: snapshot.projects.projects[0].nextMilestone,
        owner: snapshot.projects.projects[0].client,
        href: "/projects",
        tone:
          snapshot.projects.projects[0].status === "blocked"
            ? "danger"
            : snapshot.projects.projects[0].status === "at_risk" || snapshot.projects.projects[0].status === "planning"
              ? "warning"
              : "success"
      });
    }

    if (snapshot.dailyLog.focusEntry) {
      rows.push({
        id: `daily-log-${snapshot.dailyLog.focusEntry.id}`,
        project: snapshot.dailyLog.focusEntry.projectName,
        area: "Daily log",
        title: snapshot.dailyLog.focusEntry.frontName,
        detail: `${snapshot.dailyLog.focusEntry.progressPercent}% progress · ${snapshot.dailyLog.focusEntry.nextAction}`,
        owner: snapshot.dailyLog.focusEntry.supervisor,
        href: "/field",
        tone:
          snapshot.dailyLog.focusEntry.status === "flagged"
            ? "danger"
            : snapshot.dailyLog.focusEntry.status === "submitted"
              ? "info"
              : "success"
      });
    }

    if (snapshot.quality.focusInspection) {
      rows.push({
        id: `quality-${snapshot.quality.focusInspection.id}`,
        project: snapshot.quality.focusInspection.projectName,
        area: "Quality",
        title: snapshot.quality.focusInspection.areaName,
        detail: `${snapshot.quality.focusInspection.openFindings} findings · ${snapshot.quality.focusInspection.nextAction}`,
        owner: snapshot.quality.focusInspection.contractorName,
        href: "/quality",
        tone:
          snapshot.quality.focusInspection.severity === "critical"
            ? "danger"
            : snapshot.quality.focusInspection.severity === "major"
              ? "warning"
              : "info"
      });
    }

    if (snapshot.documentControl.focusItem) {
      rows.push({
        id: `document-${snapshot.documentControl.focusItem.id}`,
        project: snapshot.documentControl.focusItem.projectName,
        area: "Document control",
        title: snapshot.documentControl.focusItem.subject,
        detail: `${snapshot.documentControl.focusItem.documentType} · ${snapshot.documentControl.focusItem.nextAction}`,
        owner: snapshot.documentControl.focusItem.owner,
        href: "/document-control",
        tone:
          snapshot.documentControl.focusItem.health === "critical"
            ? "danger"
            : snapshot.documentControl.focusItem.health === "watch"
              ? "warning"
              : "success"
      });
    }

    return rows;
  }, [snapshot]);

  const recentSiteSignalGroups = useMemo<RecentSiteSignalGroup[]>(() => {
    const groups = new Map<string, RecentSiteSignal[]>();

    for (const signal of recentSiteSignals) {
      const projectSignals = groups.get(signal.project) ?? [];
      projectSignals.push(signal);
      groups.set(signal.project, projectSignals);
    }

    return Array.from(groups.entries()).map(([project, items]) => ({
      project,
      items
    }));
  }, [recentSiteSignals]);

  const executiveKpis = useMemo(() => {
    if (!snapshot) {
      return null;
    }

    return {
      activeProspects: snapshot.crm.summary.qualifiedLeads,
      forecastRevenue: snapshot.crm.summary.forecastRevenue,
      blackboardPressure:
        snapshot.procurement.summary.openRequisitions +
        snapshot.procurementPurchaseOrders.summary.blockedOrders +
        snapshot.supplierControl.summary.criticalSuppliers +
        snapshot.compliance.summary.activeCases +
        snapshot.postSale.summary.openCases +
        snapshot.documentControl.summary.openRfis +
        snapshot.estimations.summary.criticalCollections +
        snapshot.estimations.summary.overdueCollections +
        snapshot.cashFlow.summary.criticalStreams +
        snapshot.accountsPayable.summary.blockedInvoices,
      fieldChainPressure:
        snapshot.dailyLog.summary.executionRiskLogs +
        snapshot.quality.summary.executionRiskInspections +
        snapshot.fieldMaterials.summary.criticalRequests +
        snapshot.documentControl.summary.openRfis +
        snapshot.documentControl.summary.activeSubmittals +
        snapshot.equipment.summary.overdueMaintenance +
        snapshot.equipment.summary.criticalOpenFailures +
        snapshot.procurement.summary.openRequisitions,
      supplyRisk:
        snapshot.procurement.summary.strategicPackages +
        snapshot.procurementPurchaseOrders.summary.inTransitOrders +
        snapshot.supplierControl.summary.concentratedSuppliers +
        snapshot.supplierMaster.summary.criticalSuppliers +
        snapshot.equipment.summary.overdueMaintenance +
        snapshot.equipment.summary.criticalOpenFailures +
        snapshot.inventory.summary.urgentReplenishments +
        snapshot.inventoryReceiving.summary.blockedReceipts +
        snapshot.inventoryReceiving.summary.receiptsAtCommercialRisk +
        snapshot.inventoryMovements.summary.criticalMovements +
        snapshot.inventoryMovements.summary.movementsAtCommercialRisk,
      financeChainPressure:
        snapshot.finance.summary.financeChainPressure,
      operatingHealth: Math.round(
        (
          snapshot.projects.summary.averageProgress +
          (100 - Math.min(snapshot.dailyLog.summary.executionRiskLogs * 10, 100)) +
          snapshot.quality.summary.releaseReadiness +
          (100 - Math.min(snapshot.subcontracts.summary.executionRiskSubcontracts * 12, 100)) +
          (100 - Math.min(snapshot.documentControl.summary.openRfis * 8, 100)) +
          snapshot.compliance.summary.averageDocumentCompletion +
          snapshot.finance.summary.closeReadiness
        ) / 6
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
        area: "Purchase orders",
        signal: snapshot.procurementPurchaseOrders.focusPurchaseOrder?.nextAction ?? "No active action",
        owner: snapshot.procurementPurchaseOrders.focusPurchaseOrder?.buyer ?? "Procurement",
        posture: snapshot.procurementPurchaseOrders.focusPurchaseOrder?.status ?? "watch"
      },
      {
        area: "Supplier control",
        signal: snapshot.supplierControl.focusLine?.nextAction ?? "No active action",
        owner: snapshot.supplierControl.focusLine?.supplierName ?? "Procurement control",
        posture: snapshot.supplierControl.focusLine?.deliveryHealth ?? "watch"
      },
      {
        area: "Supplier master",
        signal: snapshot.supplierMaster.focusItem?.nextAction ?? "No active action",
        owner: snapshot.supplierMaster.focusItem?.supplierName ?? "Fiscal control",
        posture: snapshot.supplierMaster.focusItem?.satStatus ?? "watch"
      },
      {
        area: "Accounts payable",
        signal: snapshot.accountsPayable.focusInvoice?.nextAction ?? "No active action",
        owner: snapshot.accountsPayable.focusInvoice?.supplierName ?? "Accounts payable",
        posture: snapshot.accountsPayable.focusInvoice?.status ?? "watch"
      },
      {
        area: "Projects",
        signal: snapshot.projects.focusProject?.nextMilestone ?? "No active milestone",
        owner: snapshot.projects.focusProject?.client ?? "PMO",
        posture: snapshot.projects.focusProject?.latestDailyLogStatus ?? "watch"
      },
      {
        area: "Field materials",
        signal: snapshot.fieldMaterials.focusRequest?.nextAction ?? "No active action",
        owner: snapshot.fieldMaterials.focusRequest?.requestedBy ?? "Field supply",
        posture: snapshot.fieldMaterials.focusRequest?.urgency ?? "watch"
      },
      {
        area: "Daily log",
        signal: snapshot.dailyLog.focusEntry?.nextAction ?? "No active action",
        owner: snapshot.dailyLog.focusEntry?.supervisor ?? "Field control",
        posture: snapshot.dailyLog.focusEntry?.subcontractHealth ?? "watch"
      },
      {
        area: "Quality",
        signal: snapshot.quality.focusInspection?.nextAction ?? "No active action",
        owner: snapshot.quality.focusInspection?.contractorName ?? "Quality",
        posture: snapshot.quality.focusInspection?.latestDailyLogStatus ?? "watch"
      },
      {
        area: "Subcontracts",
        signal: snapshot.subcontracts.focusLine?.nextAction ?? "No active action",
        owner: snapshot.subcontracts.focusLine?.contractorName ?? "Subcontracts",
        posture: snapshot.subcontracts.focusLine?.latestDailyLogStatus ?? "watch"
      },
      {
        area: "Equipment",
        signal: snapshot.equipment.focusMachine?.nextAction ?? "No active action",
        owner: snapshot.equipment.focusMachine?.machineName ?? "Equipment control",
        posture: snapshot.equipment.focusMachine?.health ?? "watch"
      },
      {
        area: "Receiving",
        signal: snapshot.inventoryReceiving.focusReceipt?.nextAction ?? "No active action",
        owner: snapshot.inventoryReceiving.focusReceipt?.purchaseOrderOwner ?? "Warehouse",
        posture: snapshot.inventoryReceiving.focusReceipt?.purchaseOrderStatus ?? "watch"
      },
      {
        area: "Movements",
        signal: snapshot.inventoryMovements.focusMovement?.nextAction ?? "No active action",
        owner: snapshot.inventoryMovements.focusMovement?.purchaseOrderOwner ?? "Warehouse",
        posture: snapshot.inventoryMovements.focusMovement?.purchaseOrderStatus ?? "watch"
      },
      {
        area: "Collections",
        signal: snapshot.estimations.focusLine?.nextAction ?? "No active action",
        owner: snapshot.estimations.focusLine?.client ?? "Finance",
        posture: snapshot.estimations.focusLine?.collectionHealth ?? "watch"
      },
      {
        area: "Cash flow",
        signal: snapshot.cashFlow.focusLine?.nextAction ?? "No active action",
        owner: snapshot.cashFlow.focusLine?.streamName ?? "Treasury",
        posture: snapshot.cashFlow.focusLine?.health ?? "watch"
      },
      {
        area: "Treasury runs",
        signal:
          snapshot.treasury.focusRun?.nextAction ??
          (snapshot.treasury.unavailableInvoices[0]
            ? `${snapshot.treasury.unavailableInvoices[0].invoiceCode} blocked: ${snapshot.treasury.unavailableInvoices[0].reasonLabel}`
            : "No treasury blocker mapped"),
        owner: snapshot.treasury.focusRun?.owner ?? "Treasury",
        posture: snapshot.treasury.focusRun?.status ?? "watch"
      },
      {
        area: "Post-sale",
        signal: snapshot.postSale.focusItem?.nextAction ?? "No active action",
        owner: snapshot.postSale.focusItem?.owner ?? "Post-sale",
        posture: snapshot.postSale.focusItem?.health ?? "watch"
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
                <div className="heroMetric">
                  <strong>{snapshot.treasury.summary.activeRuns}</strong>
                  <span>Treasury runs active with {snapshot.treasury.unavailableInvoices.length} ineligible invoices</span>
                </div>
                <div className="heroMetric">
                  <strong>{executiveKpis.fieldChainPressure}</strong>
                  <span>Signals already chained from field into quality, documents, equipment and buying</span>
                </div>
                <div className="heroMetric">
                  <strong>{executiveKpis.financeChainPressure}</strong>
                  <span>Supplier fiscal, AP and treasury blockers already affecting payment release</span>
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
              label="Field chain"
              value={String(executiveKpis.fieldChainPressure)}
              footnote="Pressure already propagated from field into quality, documents, equipment and buying."
            />
            <KpiCard
              label="Finance chain"
              value={String(executiveKpis.financeChainPressure)}
              footnote="Pressure across supplier master, urgent payables and treasury release blockers."
            />
            <KpiCard
              label="Operating health"
              value={`${executiveKpis.operatingHealth}%`}
              footnote="Blended directional signal from close, documents and compliance."
            />
            <KpiCard
              label="Portfolio records"
              value={String(snapshot.projects.projects.length)}
              footnote="Projects currently available to feed field, quality and operations capture."
            />
          </section>

          <section className="grid cols2">
            <Card title="Latest project intake" description="Newest portfolio record already available for downstream field execution.">
              <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">Project</div><div>{snapshot.projects.projects[0]?.name ?? "No project available"}</div></div>
                <div className="detailRow"><div className="detailLabel">Code / status</div><div>{snapshot.projects.projects[0] ? `${snapshot.projects.projects[0].code} · ${snapshot.projects.projects[0].status}` : "No recent intake"}</div></div>
                <div className="detailRow"><div className="detailLabel">Next milestone</div><div>{snapshot.projects.projects[0]?.nextMilestone ?? "No milestone captured yet"}</div></div>
              </div>
              <div className="row gap wrap" style={{ marginTop: 16 }}>
                <Link className="buttonGhost" href="/projects">Open projects</Link>
                <Link className="buttonGhost" href="/field">Open field</Link>
              </div>
            </Card>

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
            <Card title="Field chain actions" description="Jump directly into the currently active field-to-supply thread.">
              <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">Field request</div><div>{snapshot.fieldMaterials.focusRequest?.summary ?? "No active field request"}</div></div>
                <div className="detailRow"><div className="detailLabel">Requisition</div><div>{snapshot.procurementPurchaseOrders.focusPurchaseOrder?.requisitionCode ?? snapshot.procurement.focusPackage?.code ?? "No requisition/PO focus"}</div></div>
                <div className="detailRow"><div className="detailLabel">Receiving</div><div>{snapshot.inventoryReceiving.focusReceipt?.code ?? "No receipt focus"}</div></div>
              </div>
              <div className="row gap wrap" style={{ marginTop: 16 }}>
                <Link className="button" href="/procurement/requisitions">Open requisitions</Link>
                <Link className="buttonGhost" href="/procurement/purchase-orders">Open purchase orders</Link>
                <Link className="buttonGhost" href="/inventory/receiving">Open receiving</Link>
              </div>
            </Card>

            <Card title="Asset and supplier actions" description="Direction can jump into the current supplier and equipment blockers immediately.">
              <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">Supplier focus</div><div>{snapshot.supplierControl.focusLine?.supplierName ?? "No supplier focus"}</div></div>
                <div className="detailRow"><div className="detailLabel">Equipment focus</div><div>{snapshot.equipment.focusMachine?.machineName ?? "No equipment focus"}</div></div>
                <div className="detailRow"><div className="detailLabel">Movement focus</div><div>{snapshot.inventoryMovements.focusMovement?.code ?? "No movement focus"}</div></div>
              </div>
              <div className="row gap wrap" style={{ marginTop: 16 }}>
                <Link className="button" href="/supplier-control">Open supplier control</Link>
                <Link className="buttonGhost" href="/equipment">Open equipment</Link>
                <Link className="buttonGhost" href="/inventory/movements">Open movements</Link>
              </div>
            </Card>

            <Card title="Finance and release actions" description="Open the finance lanes currently constraining payment or close readiness.">
              <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">Command</div><div>{snapshot.finance.command.headline}</div></div>
                <div className="detailRow"><div className="detailLabel">Supplier fiscal focus</div><div>{snapshot.supplierMaster.focusItem?.supplierName ?? "No supplier fiscal focus"}</div></div>
                <div className="detailRow"><div className="detailLabel">Payables focus</div><div>{snapshot.accountsPayable.focusInvoice?.code ?? "No payable invoice focus"}</div></div>
                <div className="detailRow"><div className="detailLabel">Treasury focus</div><div>{snapshot.treasury.focusRun?.code ?? "No treasury run focus"}</div></div>
                <div className="detailRow"><div className="detailLabel">Collections focus</div><div>{snapshot.estimations.focusLine?.client ?? "No collection focus"}</div></div>
              </div>
              <div className="row gap wrap" style={{ marginTop: 16 }}>
                <Link className="buttonGhost" href="/supplier-master">Open supplier master</Link>
                <Link className="button" href="/treasury/payment-runs">Open treasury</Link>
                <Link className="buttonGhost" href="/accounts-payable">Open payables</Link>
                <Link className="buttonGhost" href="/finance">Open finance</Link>
              </div>
            </Card>
          </section>

          <section className="grid cols2">
            <Card
              title="Treasury release posture"
              description="Payment-run availability and blockers exposed directly to direction."
              aside={<Badge tone={snapshot.treasury.summary.blockedRuns > 0 ? "danger" : snapshot.treasury.summary.readyRuns > 0 ? "success" : "warning"}>{snapshot.treasury.summary.blockedRuns > 0 ? "blocked" : snapshot.treasury.summary.readyRuns > 0 ? "ready" : "watch"}</Badge>}
            >
              <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">Open runs</div><div>{snapshot.treasury.summary.activeRuns}</div></div>
                <div className="detailRow"><div className="detailLabel">Ready runs</div><div>{snapshot.treasury.summary.readyRuns}</div></div>
                <div className="detailRow"><div className="detailLabel">Blocked runs</div><div>{snapshot.treasury.summary.blockedRuns}</div></div>
                <div className="detailRow"><div className="detailLabel">Unavailable invoices</div><div>{snapshot.treasury.unavailableInvoices.length}</div></div>
                <div className="detailRow"><div className="detailLabel">Current focus</div><div>{snapshot.treasury.focusRun?.code ?? "No active focus run"}</div></div>
              </div>
              <div className="row gap wrap" style={{ marginTop: 16 }}>
                <Link className="button" href="/treasury/payment-runs">Open Treasury Runs</Link>
                <Link className="buttonGhost" href="/accounts-payable">Review Accounts Payable</Link>
              </div>
            </Card>

            <Card
              title="Finance command lane"
              description="A single executive read for collections, payables and treasury release."
              aside={<Badge tone={snapshot.finance.command.laneStatus === "critical" ? "danger" : snapshot.finance.command.laneStatus === "watch" ? "warning" : "success"}>{snapshot.finance.command.laneStatus}</Badge>}
            >
              <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">Headline</div><div>{snapshot.finance.command.headline}</div></div>
                <div className="detailRow"><div className="detailLabel">Top action</div><div>{snapshot.finance.command.topAction}</div></div>
                <div className="detailRow"><div className="detailLabel">Next milestone</div><div>{snapshot.finance.command.nextMilestone}</div></div>
                <div className="detailRow"><div className="detailLabel">Blocked amount</div><div>MXN {snapshot.finance.command.blockedAmount.toLocaleString()}</div></div>
              </div>
            </Card>
          </section>

          <section className="grid cols2">
            <Card title="Treasury blockers" description="Why treasury cannot assemble the next clean batch right now.">
              {snapshot.treasury.unavailableInvoices.length > 0 ? (
                <div className="detailGrid">
                  {snapshot.treasury.unavailableInvoices.slice(0, 4).map((invoice) => (
                    <div key={invoice.invoiceId} className="detailRow">
                      <div className="detailLabel">{invoice.invoiceCode}</div>
                      <div>
                        {invoice.reasonLabel}
                        {invoice.blockingRunCodes.length > 0 ? ` (${invoice.blockingRunCodes.join(", ")})` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="Treasury lane is clear" description="No invoice is currently blocked from entering a new treasury run." />
              )}
            </Card>

            <Card title="Collections pressure" description="Commercial collections feeding current treasury certainty.">
              <div className="detailGrid">
                <div className="detailRow"><div className="detailLabel">Pending collection</div><div>MXN {snapshot.estimations.summary.pendingCollection.toLocaleString()}</div></div>
                <div className="detailRow"><div className="detailLabel">Critical lines</div><div>{snapshot.finance.summary.criticalCollections}</div></div>
                <div className="detailRow"><div className="detailLabel">Overdue lines</div><div>{snapshot.finance.summary.overdueCollections}</div></div>
                <div className="detailRow"><div className="detailLabel">Collections pressure</div><div>{snapshot.finance.command.collectionsPressure}</div></div>
              </div>
            </Card>
          </section>

          <section className="grid cols3">
            <Card title="Recent site signals" description="Latest project-linked operating signals already visible to direction.">
              <div className="list">
                {recentSiteSignalGroups.map((group) => (
                  <div className="listItem" key={group.project}>
                    <div>
                      <strong>{group.project}</strong>
                      <p>{group.items.map((item) => `${item.area}: ${item.title}`).join(" · ")}</p>
                    </div>
                    <div className="row gap wrap">
                      <Badge tone="info">{group.items.length} signals</Badge>
                      <Link className="buttonGhost" href={`/field?projectName=${encodeURIComponent(group.project)}`}>Open field</Link>
                    </div>
                  </div>
                ))}
              </div>
              <div className="list" style={{ marginTop: 16 }}>
                {recentSiteSignals.map((signal) => (
                  <div className="listItem" key={signal.id}>
                    <div>
                      <strong>{signal.project} · {signal.area}</strong>
                      <p>{signal.title} · {signal.detail}</p>
                    </div>
                    <div className="row gap wrap">
                      <Badge tone={signal.tone}>{signal.owner}</Badge>
                      <Link className="buttonGhost" href={signal.href}>Open</Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

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
