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
import { KpiCard } from "@/components/ui/kpi-card";
import type { FieldMaterialRequestContract } from "@/lib/contracts";
import {
  createDailyLogEntry,
  createDocumentControlItem,
  createMachineItem,
  createFieldMaterialRequest,
  createQualityInspection,
  fetchEquipmentOverview,
  fetchFieldMaterialRequestsOverview,
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
  nextAction: string;
};

type FieldCaptureMode = "daily_log" | "quality_incident" | "material_request" | "equipment_issue" | "document_control";

type FieldCaptureForm = {
  mode: FieldCaptureMode;
  projectName: string;
  frontName: string;
  owner: string;
  summary: string;
  detail: string;
  metricLabel: string;
  metricValue: string;
  category: string;
  requestedItems: string;
  budgetAmount: string;
  supplierCoverage: string;
  nextAction: string;
  posture: FieldSignal["posture"];
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

function captureModeMeta(mode: FieldCaptureMode) {
  switch (mode) {
    case "daily_log":
      return {
        title: "Daily log capture",
        area: "Daily log",
        summaryPlaceholder: "Frente B avance de albañilería",
        detailPlaceholder: "4 cuadrillas activas, colado parcial y un frente detenido por replanteo",
        metricLabelPlaceholder: "Progress",
        metricValuePlaceholder: "68%",
        nextActionPlaceholder: "Cerrar bitácora, subir fotos y liberar siguiente frente"
      };
    case "quality_incident":
      return {
        title: "Quality incident",
        area: "Quality incident",
        summaryPlaceholder: "Muros con desplome en eje 4",
        detailPlaceholder: "Se detectaron 3 hallazgos mayores y falta evidencia fotográfica completa",
        metricLabelPlaceholder: "Open findings",
        metricValuePlaceholder: "3",
        nextActionPlaceholder: "Corregir hallazgos, reinspeccionar y cerrar evidencia"
      };
    case "material_request":
      return {
        title: "Material request",
        area: "Material request",
        summaryPlaceholder: "Faltante de block y mortero",
        detailPlaceholder: "El frente consumirá el saldo actual antes del siguiente corte de suministro",
        metricLabelPlaceholder: "Requested volume",
        metricValuePlaceholder: "120 m2",
        nextActionPlaceholder: "Solicitar surtido, confirmar ruta y validar recepción en obra"
      };
    case "document_control":
      return {
        title: "Document issue",
        area: "Document control",
        summaryPlaceholder: "RFI por interferencia de planos",
        detailPlaceholder: "La cuadrilla detectó conflicto entre arquitectura e instalaciones en frente activo",
        metricLabelPlaceholder: "Open comments",
        metricValuePlaceholder: "4",
        nextActionPlaceholder: "Emitir RFI, consolidar evidencia y enrutar revisión técnica"
      };
    default:
      return {
        title: "Equipment issue",
        area: "Equipment issue",
        summaryPlaceholder: "Retroexcavadora fuera de servicio",
        detailPlaceholder: "La unidad perdió disponibilidad durante la maniobra de excavación",
        metricLabelPlaceholder: "Downtime",
        metricValuePlaceholder: "6 h",
        nextActionPlaceholder: "Aislar equipo, pedir respaldo y abrir revisión mecánica"
      };
  }
}

function createCaptureForm(mode: FieldCaptureMode): FieldCaptureForm {
  switch (mode) {
    case "daily_log":
      return {
        mode,
        projectName: "Proyecto central",
        frontName: "Frente 1",
        owner: "Resident engineer",
        summary: "",
        detail: "",
        metricLabel: "Progress",
        metricValue: "",
        category: "Operations",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "",
        posture: "watch"
      };
    case "quality_incident":
      return {
        mode,
        projectName: "Proyecto central",
        frontName: "Frente 1",
        owner: "Quality lead",
        summary: "",
        detail: "",
        metricLabel: "Open findings",
        metricValue: "",
        category: "Quality",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "",
        posture: "critical"
      };
    case "material_request":
      return {
        mode,
        projectName: "Proyecto central",
        frontName: "Frente 1",
        owner: "Warehouse coordinator",
        summary: "",
        detail: "",
        metricLabel: "Requested volume",
        metricValue: "",
        category: "Field materials",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "",
        posture: "watch"
      };
    case "document_control":
      return {
        mode,
        projectName: "Proyecto central",
        frontName: "Frente 1",
        owner: "Document control",
        summary: "",
        detail: "",
        metricLabel: "Open comments",
        metricValue: "",
        category: "RFI",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "",
        posture: "watch"
      };
    default:
      return {
        mode,
        projectName: "Proyecto central",
        frontName: "Frente 1",
        owner: "Equipment supervisor",
        summary: "",
        detail: "",
        metricLabel: "Downtime",
        metricValue: "",
        category: "Equipment",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "",
        posture: "critical"
      };
  }
}

export default function FieldPage() {
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const [signals, setSignals] = useState<FieldSignal[]>([]);
  const [customSignals, setCustomSignals] = useState<FieldSignal[]>([]);
  const [materialOverview, setMaterialOverview] = useState<NonNullable<Awaited<ReturnType<typeof fetchFieldMaterialRequestsOverview>>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<FieldCaptureForm>(() => createCaptureForm("daily_log"));

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
      fetchEquipmentOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFieldMaterialRequestsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchIntegrationOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then(([projects, hr, quality, inventory, equipment, fieldMaterials, integrations, documentControl]) => {
        if (cancelled) {
          return;
        }

        if (!projects || !hr || !quality || !inventory || !equipment || !fieldMaterials || !integrations || !documentControl) {
          setError("Field app could not assemble all live site signals.");
          return;
        }

        setMaterialOverview(fieldMaterials);

        const nextSignals: FieldSignal[] = [];

        if (projects.focusProject) {
          nextSignals.push({
            id: projects.focusProject.id,
            title: projects.focusProject.name,
            detail: `${projects.focusProject.activeFronts} active fronts · ${projects.focusProject.progress}% progress`,
            owner: projects.focusProject.client,
            area: "Project progress",
            nextAction:
              projects.focusProject.progress >= 85
                ? "Close remaining fronts and protect turnover readiness."
                : "Review blockers in active fronts and recover weekly progress rhythm.",
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
            nextAction:
              hr.focusWorkforce.attendanceRate < 90
                ? "Recover attendance continuity before the next production cutoff."
                : "Keep crew coverage stable and verify shift discipline on site.",
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
            nextAction:
              quality.focusInspection.openFindings > 0
                ? "Close critical findings and complete missing field evidence."
                : "Protect release readiness and keep inspection cadence stable.",
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
            nextAction:
              inventory.focusLocation.urgentReplenishments > 0
                ? "Accelerate replenishment and confirm receipts before crews stop."
                : "Sustain stock control and traceability across active fronts.",
            posture:
              inventory.focusLocation.stockHealth === "critical"
                ? "critical"
                : inventory.focusLocation.stockHealth === "watch"
                  ? "watch"
                  : "healthy"
          });
        }

        if (equipment.focusMachine) {
          nextSignals.push({
            id: equipment.focusMachine.id,
            title: equipment.focusMachine.machineName,
            detail: `${equipment.focusMachine.projectName} · ${equipment.focusMachine.frontName} · ${equipment.focusMachine.availabilityPercent}% availability`,
            owner: equipment.focusMachine.machineType,
            area: "Equipment",
            nextAction: equipment.focusMachine.nextAction,
            posture: equipment.focusMachine.health
          });
        }

        if (integrations.focusStream) {
          nextSignals.push({
            id: integrations.focusStream.id,
            title: integrations.focusStream.streamName,
            detail: `${integrations.focusStream.freshnessMinutes} min freshness · ${integrations.focusStream.openAlerts} alerts`,
            owner: integrations.focusStream.provider,
            area: "Connectivity",
            nextAction: integrations.focusStream.nextAction,
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
            nextAction: documentControl.focusItem.nextAction,
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

  const combinedSignals = useMemo(() => [...customSignals, ...signals], [customSignals, signals]);

  const metrics = useMemo(() => {
    const critical = combinedSignals.filter((signal) => signal.posture === "critical").length;
    const watch = combinedSignals.filter((signal) => signal.posture === "watch").length;
    const healthy = combinedSignals.filter((signal) => signal.posture === "healthy").length;

    return {
      capturesToday: combinedSignals.length * 24,
      offlineSync: healthy > 0 ? Math.max(72, 100 - critical * 7) : 0,
      photosLinked: combinedSignals.length * 96,
      checklistDiscipline: Math.max(55, 100 - watch * 6 - critical * 8)
    };
  }, [combinedSignals]);

  const prioritySignals = useMemo(
    () =>
      combinedSignals
        .slice()
        .sort((left, right) => {
          const postureWeight = { critical: 0, watch: 1, healthy: 2 };
          return postureWeight[left.posture] - postureWeight[right.posture];
        })
        .slice(0, 4),
    [combinedSignals]
  );

  const equipmentPriority = useMemo(
    () => prioritySignals.find((signal) => signal.area === "Equipment") ?? null,
    [prioritySignals]
  );

  async function handleCreateSignal() {
    const title = createForm.summary.trim();
    const detail = createForm.detail.trim();
    const frontName = createForm.frontName.trim();
    const owner = createForm.owner.trim();
    const metricLabel = createForm.metricLabel.trim();
    const metricValue = createForm.metricValue.trim();
    const projectName = createForm.projectName.trim();
    const category = createForm.category.trim();
    const modeMeta = captureModeMeta(createForm.mode);
    const nextAction = createForm.nextAction.trim();

    if (title.length < 3 || detail.length < 6 || projectName.length < 3 || frontName.length < 3 || owner.length < 3) {
      setError("Field capture needs a clear project, summary, detail, front and owner.");
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setError("Field capture needs a concrete next action.");
      setCreateMessage(null);
      return;
    }

    if (metricLabel.length < 2 || metricValue.length < 1) {
      setError("Field capture needs a clear metric label and metric value.");
      setCreateMessage(null);
      return;
    }

    if (createForm.mode === "daily_log") {
      const progressMatch = Number.parseFloat(metricValue.replace("%", "").trim());
      if (!Number.isFinite(progressMatch) || progressMatch < 0 || progressMatch > 100) {
        setError("Daily log capture needs a progress metric between 0 and 100.");
        setCreateMessage(null);
        return;
      }
    }

    if (createForm.mode === "material_request") {
      const requestedItems = Number(createForm.requestedItems);
      const budgetAmount = Number(createForm.budgetAmount);
      const supplierCoverage = Number(createForm.supplierCoverage);

      if (category.length < 3 || metricValue.length < 2) {
        setError("Material request needs a usable category and requested volume.");
        setCreateMessage(null);
        return;
      }

      if (!Number.isFinite(requestedItems) || requestedItems <= 0) {
        setError("Material request needs at least one requested item.");
        setCreateMessage(null);
        return;
      }

      if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
        setError("Material request budget must be a valid non-negative amount.");
        setCreateMessage(null);
        return;
      }

      if (!Number.isFinite(supplierCoverage) || supplierCoverage < 0) {
        setError("Supplier coverage must be a valid non-negative number.");
        setCreateMessage(null);
        return;
      }

      if (supplierCoverage > 10) {
        setError("Supplier coverage cannot exceed 10 active supplier paths in this capture.");
        setCreateMessage(null);
        return;
      }
    }

    if (createForm.mode === "quality_incident") {
      const openFindings = Number(createForm.metricValue);
      if (!Number.isFinite(openFindings) || openFindings < 1) {
        setError("Quality incident needs at least one open finding.");
        setCreateMessage(null);
        return;
      }
    }

    let signalId = `local-field-signal-${Date.now()}`;
    let persistedRequisitionCode: string | null = null;
    let persistedRequisitionId: string | null = null;
    const materialUrgency: FieldMaterialRequestContract["urgency"] =
      createForm.posture === "critical"
        ? "critical"
        : createForm.posture === "watch"
          ? "watch"
          : "planned";
    let persistedDailyLog = false;
    let persistedQuality = false;
    let persistedDocument = false;
    let persistedEquipment = false;

    setIsCreating(true);

    if (createForm.mode === "daily_log" && session.accessToken) {
      const progressMatch = Number.parseFloat(metricValue.replace("%", "").trim());
      const response = await createDailyLogEntry(
        activeCompany.id,
        {
          projectName,
          frontName,
          supervisor: owner,
          logDate: new Date().toISOString().slice(0, 10),
          shift: "mixed",
          weather: "clear",
          status: createForm.posture === "critical" ? "flagged" : "draft",
          progressPercent: Number.isFinite(progressMatch) ? progressMatch : 0,
          workforceCount: 1,
          incidentsCount: 0,
          blockersCount: createForm.posture === "critical" ? 1 : 0,
          evidenceCount: 1,
          concretePourM3: 0,
          nextAction
        },
        {
          apiBaseUrl,
          accessToken: session.accessToken
        }
      );

      if (!response.data) {
        setError(response.error?.message ?? "Field daily log could not be persisted.");
        setCreateMessage(null);
        setIsCreating(false);
        return;
      }

      signalId = response.data.id;
      persistedDailyLog = true;
    }

    if (createForm.mode === "material_request" && session.accessToken) {
      const response = await createFieldMaterialRequest(
        activeCompany.id,
        {
          projectName,
          frontName,
          requestedBy: owner,
          summary: title,
          detail,
          requestedVolume: metricValue || "Pending quantity",
          category,
          requestedItems: Number(createForm.requestedItems) || 1,
          budgetAmount: Number(createForm.budgetAmount) || 0,
          approvalHours: 0,
          supplierCoverage: Number(createForm.supplierCoverage) || 0,
          urgency: materialUrgency,
          nextAction
        },
        {
          apiBaseUrl,
          accessToken: session.accessToken
        }
      );

      if (!response.data) {
        setError(response.error?.message ?? "Field material request could not be persisted.");
        setCreateMessage(null);
        setIsCreating(false);
        return;
      }

      signalId = response.data.fieldRequest.id;
      persistedRequisitionId = response.data.requisition.id;
      persistedRequisitionCode = response.data.requisition.code;
    }

    if (createForm.mode === "quality_incident" && session.accessToken) {
      const openFindings = Math.max(1, Number(createForm.metricValue) || 1);
      const response = await createQualityInspection(
        activeCompany.id,
        {
          areaName: `${projectName} · ${frontName}`,
          checklistName: title,
          contractorName: owner,
          severity:
            createForm.posture === "critical"
              ? "critical"
              : createForm.posture === "watch"
                ? "major"
                : "minor",
          openFindings,
          evidenceCompletion: createForm.posture === "critical" ? 55 : 75,
          releaseReadiness: createForm.posture === "critical" ? 40 : 68,
          reworkRate: createForm.posture === "critical" ? 18 : 9,
          status: createForm.posture === "critical" ? "blocked" : "in_progress",
          nextAction
        },
        {
          apiBaseUrl,
          accessToken: session.accessToken
        }
      );

      if (!response.data) {
        setError(response.error?.message ?? "Field quality incident could not be persisted.");
        setCreateMessage(null);
        setIsCreating(false);
        return;
      }

      signalId = response.data.id;
      persistedQuality = true;
    }

    if (createForm.mode === "document_control" && session.accessToken) {
      const openComments = Math.max(0, Number(createForm.metricValue) || 0);
      const response = await createDocumentControlItem(
        activeCompany.id,
        {
          documentType: category || "RFI",
          subject: title,
          projectName,
          owner,
          status: createForm.posture === "critical" ? "blocked" : "issued",
          revisionCount: 0,
          turnaroundDays: 0,
          openComments,
          health: createForm.posture,
          nextAction
        },
        {
          apiBaseUrl,
          accessToken: session.accessToken
        }
      );

      if (!response.data) {
        setError(response.error?.message ?? "Field document issue could not be persisted.");
        setCreateMessage(null);
        setIsCreating(false);
        return;
      }

      signalId = response.data.id;
      persistedDocument = true;
    }

    if (createForm.mode === "equipment_issue" && session.accessToken) {
      const response = await createMachineItem(
        activeCompany.id,
        {
          machineName: title,
          machineType: category || "Field equipment",
          projectName,
          frontName,
          status: createForm.posture === "critical" ? "down" : "maintenance",
          health: createForm.posture === "healthy" ? "watch" : createForm.posture,
          availabilityPercent: createForm.posture === "critical" ? 0 : 35,
          utilizationPercent: 0,
          hourMeter: 0,
          nextMaintenanceHours: 0,
          maintenanceBacklog: 1,
          openFailures: 1,
          criticalOpenFailures: createForm.posture === "critical" ? 1 : 0,
          nextAction
        },
        {
          apiBaseUrl,
          accessToken: session.accessToken
        }
      );

      if (!response.data) {
        setError(response.error?.message ?? "Field equipment issue could not be persisted.");
        setCreateMessage(null);
        setIsCreating(false);
        return;
      }

      signalId = response.data.id;
      persistedEquipment = true;
    }

    const newSignal: FieldSignal = {
      id: signalId,
      title: `${frontName} · ${title}`,
      detail: metricValue ? `${detail} · ${metricLabel}: ${metricValue}` : detail,
      owner,
      area: modeMeta.area,
      posture: createForm.posture,
      nextAction
    };

    setCustomSignals((current) => [newSignal, ...current]);
    if (createForm.mode === "material_request" && persistedRequisitionCode) {
      setMaterialOverview((current) => {
        if (!current) {
          return current;
        }

        const syntheticRequest: FieldMaterialRequestContract = {
          id: signalId,
          companyId: activeCompany.id,
          requisitionId: persistedRequisitionId,
          projectName,
          frontName,
          requestedBy: owner,
          summary: title,
          detail,
          requestedVolume: metricValue || "Pending quantity",
          urgency: materialUrgency,
          nextAction,
          status: "converted",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const requests = [
          syntheticRequest,
          ...current.requests
        ];

        return {
          summary: {
            openRequests: current.summary.openRequests + 1,
            convertedRequests: current.summary.convertedRequests + 1,
            criticalRequests:
              current.summary.criticalRequests + (createForm.posture === "critical" ? 1 : 0),
            linkedRequisitions: current.summary.linkedRequisitions + 1,
            averageSupplierCoverage: current.summary.averageSupplierCoverage
          },
          requests,
          focusRequest: requests[0]
        };
      });
    }
    setError(null);
    setCreateMessage(
      persistedRequisitionCode
        ? `${modeMeta.title} added for ${frontName} and linked to ${persistedRequisitionCode}.`
        : persistedDailyLog
          ? `${modeMeta.title} added for ${frontName} and persisted to daily log.`
          : persistedQuality
            ? `${modeMeta.title} added for ${frontName} and persisted to quality.`
            : persistedDocument
              ? `${modeMeta.title} added for ${frontName} and persisted to document control.`
              : persistedEquipment
                ? `${modeMeta.title} added for ${frontName} and persisted to equipment.`
        : `${modeMeta.title} added for ${frontName}.`
    );
    setCreateForm((current) => ({
      ...createCaptureForm(current.mode),
      projectName,
      frontName,
      owner
    }));
    setIsCreating(false);
  }

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
        {combinedSignals.length > 0 ? (
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
              <KpiCard
                label="Material chain"
                value={String(materialOverview?.summary.linkedRequisitions ?? 0)}
                footnote="Field material requests already linked into live procurement requisitions."
              />
            </section>

            <section className="grid cols2">
              <Card title="Field flows" description="The mobile layer now reflects live site pressure across execution areas.">
                <div className="list">
                  {combinedSignals.map((signal) => (
                    <div className="listItem" key={signal.id}>
                      <div>
                        <strong>{signal.title}</strong>
                        <p>{signal.detail}</p>
                      </div>
                      <Badge tone={postureTone(signal.posture)}>{signal.area}</Badge>
                    </div>
                  ))}
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href="/procurement/requisitions">
                    Open requisitions
                  </Link>
                  <Link className="buttonGhost" href="/inventory/receiving">
                    Open receiving
                  </Link>
                  <Link className="buttonGhost" href="/inventory/movements">
                    Open movements
                  </Link>
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

            <Card
              title="Immediate field priorities"
              description="The mobile layer now exposes the next operational actions, not just the current posture."
            >
              <DataTable
                rows={prioritySignals}
                columns={[
                  {
                    key: "signal",
                    label: "Signal",
                    render: (signal) => (
                      <div className="tableCellStack">
                        <strong>{signal.title}</strong>
                        <span className="tableCellMuted">{signal.area}</span>
                      </div>
                    )
                  },
                  { key: "owner", label: "Owner", render: (signal) => signal.owner },
                  {
                    key: "posture",
                    label: "Posture",
                    render: (signal) => <Badge tone={postureTone(signal.posture)}>{signal.posture}</Badge>
                  },
                  {
                    key: "nextAction",
                    label: "Next action",
                    render: (signal) => signal.nextAction
                  }
                ]}
              />
            </Card>

            <section className="grid cols3">
              <Card title="Equipment impact" description="How asset readiness is already shaping today's field execution.">
                <p className="sectionText">
                  {equipmentPriority
                    ? `${equipmentPriority.title} is currently affecting ${equipmentPriority.detail}.`
                    : "No equipment signal is currently leading today's field picture."}
                </p>
              </Card>

              <Card title="Maintenance pressure" description="The field layer now includes asset readiness, not only people and materials.">
                <p className="sectionText">
                  {equipmentPriority
                    ? equipmentPriority.nextAction
                    : "Equipment maintenance pressure is not the leading field constraint right now."}
                </p>
              </Card>

              <Card title="Critical asset today" description="Fast read for supervisors before the next field cutoff.">
                <p className="sectionText">
                  {equipmentPriority
                    ? `${equipmentPriority.title} is the current asset to watch under ${equipmentPriority.owner}.`
                    : "No critical asset is currently dominating the site execution view."}
                </p>
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Capture field workflow" description="Create a structured field record for the main mobile workflows already expected on site.">
                <div className="tagRow" style={{ marginBottom: 16 }}>
                  {(["daily_log", "quality_incident", "material_request", "document_control", "equipment_issue"] as FieldCaptureMode[]).map((mode) => {
                    const meta = captureModeMeta(mode);
                    const active = createForm.mode === mode;

                    return (
                      <button
                        key={mode}
                        type="button"
                        className={active ? "button" : "buttonGhost"}
                        onClick={() =>
                          setCreateForm((current) => ({
                            ...createCaptureForm(mode),
                            projectName: current.projectName,
                            frontName: current.frontName,
                            owner: current.owner
                          }))
                        }
                      >
                        {meta.title}
                      </button>
                    );
                  })}
                </div>

                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Project</div>
                    <input
                      className="field"
                      value={createForm.projectName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                      placeholder="Residencial Norte"
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Front</div>
                    <input
                      className="field"
                      value={createForm.frontName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))}
                      placeholder="Frente B"
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Owner</div>
                    <input
                      className="field"
                      value={createForm.owner}
                      onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Summary</div>
                    <input
                      className="field"
                      value={createForm.summary}
                      onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))}
                      placeholder={captureModeMeta(createForm.mode).summaryPlaceholder}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Detail</div>
                    <input
                      className="field"
                      value={createForm.detail}
                      onChange={(event) => setCreateForm((current) => ({ ...current, detail: event.target.value }))}
                      placeholder={captureModeMeta(createForm.mode).detailPlaceholder}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Metric label</div>
                    <input
                      className="field"
                      value={createForm.metricLabel}
                      onChange={(event) => setCreateForm((current) => ({ ...current, metricLabel: event.target.value }))}
                      placeholder={captureModeMeta(createForm.mode).metricLabelPlaceholder}
                    />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Metric value</div>
                    <input
                      className="field"
                      value={createForm.metricValue}
                      onChange={(event) => setCreateForm((current) => ({ ...current, metricValue: event.target.value }))}
                      placeholder={captureModeMeta(createForm.mode).metricValuePlaceholder}
                    />
                  </label>
                  {createForm.mode === "material_request" || createForm.mode === "document_control" ? (
                    <>
                      <label className="detailRow">
                        <div className="detailLabel">Category</div>
                        <input
                          className="field"
                          value={createForm.category}
                          onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))}
                          placeholder="Field materials"
                        />
                      </label>
                      <label className="detailRow">
                        <div className="detailLabel">Requested items</div>
                        <input
                          className="field"
                          type="number"
                          min="1"
                          value={createForm.requestedItems}
                          onChange={(event) => setCreateForm((current) => ({ ...current, requestedItems: event.target.value }))}
                        />
                      </label>
                      <label className="detailRow">
                        <div className="detailLabel">Estimated budget</div>
                        <input
                          className="field"
                          type="number"
                          min="0"
                          value={createForm.budgetAmount}
                          onChange={(event) => setCreateForm((current) => ({ ...current, budgetAmount: event.target.value }))}
                        />
                      </label>
                      <label className="detailRow">
                        <div className="detailLabel">Supplier coverage</div>
                        <input
                          className="field"
                          type="number"
                          min="0"
                          value={createForm.supplierCoverage}
                          onChange={(event) => setCreateForm((current) => ({ ...current, supplierCoverage: event.target.value }))}
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="detailRow">
                    <div className="detailLabel">Posture</div>
                    <select
                      className="selectField"
                      value={createForm.posture}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          posture: event.target.value as FieldSignal["posture"]
                        }))
                      }
                    >
                      <option value="healthy">healthy</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder={captureModeMeta(createForm.mode).nextActionPlaceholder}
                    />
                  </label>
                </div>

                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateSignal()}>
                    {isCreating ? "Saving..." : "Add field signal"}
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Workflow map" description="These are the first four field flows worth productizing before building a full native mobile stack.">
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">Daily log</div>
                    <div>Production progress, crew status, weather and evidence closure for the shift. Already persisted.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Quality incident</div>
                    <div>Findings, reinspection pressure and release blockers tied to execution quality. Already persisted.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Material request</div>
                    <div>Urgent replenishment, route confirmation and receipt readiness from the field edge. Already persisted.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Document issue</div>
                    <div>RFIs, document clashes and review loops raised from the field edge. Already persisted.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Equipment issue</div>
                    <div>Breakdown, downtime and dispatch substitution before the front loses continuity. Already persisted to equipment.</div>
                  </div>
                </div>
              </Card>

              <Card title="Material request chain" description="Field replenishment pressure already linked to procurement follow-up.">
                {materialOverview ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Open field requests</div>
                      <div>{materialOverview.summary.openRequests}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Linked requisitions</div>
                      <div>{materialOverview.summary.linkedRequisitions}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Critical requests</div>
                      <div>{materialOverview.summary.criticalRequests}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Focus request</div>
                      <div>
                        {materialOverview.focusRequest
                          ? `${materialOverview.focusRequest.frontName} · ${materialOverview.focusRequest.summary}`
                          : "No field request in focus"}
                      </div>
                    </div>
                    <div className="row gap wrap" style={{ marginTop: 12 }}>
                      <Link className="button secondary" href="/procurement/requisitions">
                        Open requisitions
                      </Link>
                      <Link className="buttonGhost" href="/inventory/receiving">
                        Open receiving
                      </Link>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="Material chain unavailable"
                    description="Field material requests could not be assembled for this tenant right now."
                  />
                )}
              </Card>

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
                    <div>{combinedSignals.filter((signal) => signal.posture === "critical").length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Watch signals</div>
                    <div>{combinedSignals.filter((signal) => signal.posture === "watch").length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Healthy signals</div>
                    <div>{combinedSignals.filter((signal) => signal.posture === "healthy").length}</div>
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
