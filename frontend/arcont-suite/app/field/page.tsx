"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  projectName?: string | null;
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

type MovementFieldContext = {
  purchaseReference: string;
  upstreamReceiptCode: string;
  destinationName: string;
  requestedBy: string;
  projectName: string;
  nextAction: string;
};

type MovementFieldMatch =
  | { kind: "signal"; signal: FieldSignal }
  | { kind: "request"; request: FieldMaterialRequestContract }
  | null;

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

function captureModeLabel(mode: FieldCaptureMode) {
  switch (mode) {
    case "daily_log":
      return { es: "Bitácora diaria", en: "Daily log" };
    case "quality_incident":
      return { es: "Incidencia de calidad", en: "Quality issue" };
    case "material_request":
      return { es: "Solicitud de material", en: "Material request" };
    case "document_control":
      return { es: "RFI / documento", en: "RFI / document" };
    default:
      return { es: "Falla de equipo", en: "Equipment issue" };
  }
}

function captureConstraintSpanish(form: FieldCaptureForm) {
  switch (form.mode) {
    case "material_request":
      return form.posture === "critical"
        ? { label: "Abastecimiento en riesgo", description: "El frente puede detenerse si compras no confirma la ruta de suministro y la fecha de entrega." }
        : { label: "Solicitud lista para compras", description: "La necesidad ya tiene contexto suficiente para que compras inicie el abastecimiento." };
    case "quality_incident":
      return form.posture === "critical"
        ? { label: "Liberación bloqueada", description: "No cierres este frente hasta que calidad confirme corrección, evidencia y reinspección." }
        : { label: "Seguimiento de calidad", description: "El hallazgo debe tener responsable y fecha de reinspección antes del siguiente corte." };
    case "document_control":
      return { label: "Respuesta técnica pendiente", description: "La ejecución debe esperar la respuesta formal del RFI o la revisión documental correspondiente." };
    case "equipment_issue":
      return form.posture === "critical"
        ? { label: "Equipo bloqueando el frente", description: "Protege el frente, define respaldo y registra quién resolverá la falla." }
        : { label: "Equipo en seguimiento", description: "Confirma mantenimiento o sustitución antes de comprometer el siguiente turno." };
    default:
      return form.posture === "critical"
        ? { label: "Bitácora bajo presión", description: "El siguiente responsable debe conocer el bloqueo y el plan de recuperación antes del cambio de turno." }
        : { label: "Bitácora lista para revisión", description: "El avance y la siguiente acción quedan listos para supervisión y seguimiento." };
  }
}

function captureDestinationSpanish(mode: FieldCaptureMode) {
  switch (mode) {
    case "material_request":
      return { label: "Abrir requisiciones", description: "Después de guardar, continúa en requisiciones para aprobar, cotizar y dar seguimiento al suministro." };
    case "quality_incident":
      return { label: "Abrir calidad", description: "Después de guardar, continúa en calidad para controlar corrección, evidencia y liberación." };
    case "document_control":
      return { label: "Abrir control documental", description: "Después de guardar, emite o continúa el RFI en control documental." };
    case "equipment_issue":
      return { label: "Abrir equipos", description: "Después de guardar, controla la falla, mantenimiento o reemplazo desde equipos." };
    default:
      return { label: "Abrir bitácora diaria", description: "Después de guardar, continúa en la bitácora diaria para la revisión de supervisión." };
  }
}

function routeSpanishLabel(href: string) {
  if (href.startsWith("/projects")) {
    return "Abrir programa";
  }
  if (href.startsWith("/hr")) {
    return "Abrir RH";
  }
  if (href.startsWith("/integrations")) {
    return "Abrir integraciones";
  }

  switch (href) {
    case "/quality":
      return "Abrir calidad";
    case "/equipment":
      return "Abrir equipos";
    case "/procurement/requisitions":
      return "Abrir requisiciones";
    case "/document-control":
      return "Abrir control documental";
    case "/daily-log":
      return "Abrir bitácora diaria";
    default:
      return "Abrir operaciones";
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

function createCaptureExample(mode: FieldCaptureMode, projectName: string): FieldCaptureForm {
  switch (mode) {
    case "daily_log":
      return {
        mode,
        projectName,
        frontName: "Frente Cimentacion",
        owner: "Luis Operaciones",
        summary: "Avance parcial con frente listo para siguiente colado",
        detail: "Se cerraron actividades de acero y el frente queda listo para coordinar el siguiente vaciado.",
        metricLabel: "Progress",
        metricValue: "42",
        category: "Operations",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "Subir evidencia, cerrar bitacora y confirmar cuadrilla del siguiente turno.",
        posture: "watch"
      };
    case "quality_incident":
      return {
        mode,
        projectName,
        frontName: "Frente Acabados",
        owner: "Quality lead",
        summary: "Hallazgos de alineacion en muros interiores",
        detail: "La inspeccion detecto desviacion en tres puntos y falta evidencia completa de correccion.",
        metricLabel: "Open findings",
        metricValue: "3",
        category: "Quality",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "Corregir hallazgos, reinspeccionar y cerrar evidencia en el mismo turno.",
        posture: "critical"
      };
    case "material_request":
      return {
        mode,
        projectName,
        frontName: "Frente Block",
        owner: "Warehouse coordinator",
        summary: "Faltante de block y mortero para continuidad del frente",
        detail: "El consumo actual deja menos de un turno de material disponible en obra.",
        metricLabel: "Requested volume",
        metricValue: "120 m2",
        category: "Field materials",
        requestedItems: "2",
        budgetAmount: "185000",
        supplierCoverage: "2",
        nextAction: "Emitir requisicion y confirmar la primera entrega antes del corte de mañana.",
        posture: "critical"
      };
    case "document_control":
      return {
        mode,
        projectName,
        frontName: "Frente Instalaciones",
        owner: "Document control",
        summary: "RFI por interferencia entre arquitectura e instalaciones",
        detail: "La cuadrilla encontro conflicto de planos en un frente activo que ya impacta continuidad.",
        metricLabel: "Open comments",
        metricValue: "4",
        category: "RFI",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "Emitir RFI, adjuntar evidencia y escalar revision tecnica hoy mismo.",
        posture: "watch"
      };
    default:
      return {
        mode,
        projectName,
        frontName: "Frente Movimiento de tierra",
        owner: "Equipment supervisor",
        summary: "Retroexcavadora fuera de servicio",
        detail: "El equipo quedo detenido en maniobra y ya compromete la continuidad del frente.",
        metricLabel: "Downtime",
        metricValue: "6 h",
        category: "Equipment",
        requestedItems: "1",
        budgetAmount: "0",
        supplierCoverage: "0",
        nextAction: "Abrir contingencia, pedir respaldo y cerrar diagnostico mecanico en campo.",
        posture: "critical"
      };
  }
}

function modeFollowUpLinks(mode: FieldCaptureMode) {
  switch (mode) {
    case "material_request":
      return [
        { label: "Open requisitions", href: "/procurement/requisitions" },
        { label: "Open purchase orders", href: "/procurement/purchase-orders" }
      ];
    case "daily_log":
      return [
        { label: "Open daily log", href: "/daily-log" },
        { label: "Open operations", href: "/operations" }
      ];
    case "quality_incident":
      return [
        { label: "Open quality", href: "/quality" },
        { label: "Open projects", href: "/projects" }
      ];
    case "document_control":
      return [
        { label: "Open document control", href: "/document-control" },
        { label: "Open compliance", href: "/compliance" }
      ];
    default:
      return [
        { label: "Open equipment", href: "/equipment" },
        { label: "Open operations", href: "/operations" }
      ];
  }
}

function buildFieldWorkflowSummary(mode: FieldCaptureMode) {
  switch (mode) {
    case "daily_log":
      return "Capture the front signal in field, formalize it in the daily log and keep operations aligned before the next shift.";
    case "quality_incident":
      return "Capture the issue in field, route it into quality and return only when release readiness is real.";
    case "material_request":
      return "Capture the shortage in field, push it into requisitions or receiving and confirm downstream continuity at the front.";
    case "document_control":
      return "Capture the interference in field, route it into document control and close the technical answer before execution resumes.";
    default:
      return "Capture the equipment issue in field, route it into equipment control and verify the front is protected while the asset recovers.";
  }
}

function buildFieldConstraintSummary(form: FieldCaptureForm) {
  switch (form.mode) {
    case "material_request": {
      const supplierCoverage = Number(form.supplierCoverage) || 0;
      const budgetAmount = Number(form.budgetAmount) || 0;

      if (supplierCoverage === 0) {
        return {
          tone: "danger" as const,
          label: "Supply path not covered",
          description: "This shortage still has no supplier path, so procurement must react before the front loses continuity."
        };
      }

      if (form.posture === "critical" || supplierCoverage < 2) {
        return {
          tone: "warning" as const,
          label: "Tight supply coverage",
          description: `Only ${supplierCoverage} supplier path${supplierCoverage === 1 ? "" : "s"} back this request and the front is still exposed.`
        };
      }

      return {
        tone: "success" as const,
        label: "Material request actionable",
        description: budgetAmount > 0
          ? "The shortage already has budget context and enough supplier coverage to continue into procurement."
          : "The shortage already has enough supplier coverage to continue into procurement."
      };
    }
    case "equipment_issue":
      return {
        tone: form.posture === "critical" ? "danger" as const : "warning" as const,
        label: form.posture === "critical" ? "Machinery is the blocker" : "Machinery needs attention",
        description: "This capture should protect the front first, then continue into equipment control and field replanning."
      };
    case "quality_incident":
      return {
        tone: form.posture === "critical" ? "danger" as const : "warning" as const,
        label: form.posture === "critical" ? "Release blocked by quality" : "Quality follow-up required",
        description: "The next step should happen in quality, not inside field, once the finding is captured with enough context."
      };
    case "document_control":
      return {
        tone: "warning" as const,
        label: "Technical answer pending",
        description: "Execution should continue only after the document issue is routed into formal review and the answer returns to site."
      };
    default:
      return {
        tone: form.posture === "critical" ? "warning" as const : "success" as const,
        label: form.posture === "critical" ? "Daily log under pressure" : "Daily log actionable",
        description: "Use this capture to formalize the front story and then continue in daily log or operations."
      };
  }
}

function buildFieldNextDestination(form: FieldCaptureForm) {
  switch (form.mode) {
    case "material_request":
      return {
        label: "Open requisitions",
        href: "/procurement/requisitions",
        description: "Field should hand this shortage into requisitions first, then continue to purchase orders and receiving."
      };
    case "equipment_issue":
      return {
        label: "Open equipment",
        href: "/equipment",
        description: "The machine issue should move into equipment control while field protects the affected front."
      };
    case "quality_incident":
      return {
        label: "Open quality",
        href: "/quality",
        description: "The captured incident should continue in quality until release readiness is recovered."
      };
    case "document_control":
      return {
        label: "Open document control",
        href: "/document-control",
        description: "The captured interference should continue through the formal RFI or document review path."
      };
    default:
      return {
        label: "Open daily log",
        href: "/daily-log",
        description: "The field note should continue in daily log so supervision can approve, flag or reroute the next move."
      };
  }
}

function buildHumanNextStep(form: FieldCaptureForm) {
  switch (form.mode) {
    case "material_request":
      return "Confirm requested volume, identify who will chase the requisition and define the delivery checkpoint at site.";
    case "equipment_issue":
      return "Protect the front, call maintenance or backup equipment, and document who owns the recovery window.";
    case "quality_incident":
      return "Name the finding owner, define the reinspection moment and keep the front from closing early.";
    case "document_control":
      return "Assign who will emit the RFI, what evidence goes with it and when the answer must return to field.";
    default:
      return "Describe the real next move clearly enough that supervision can act without asking field to restate the same issue.";
  }
}

function buildSignalDestination(signal: FieldSignal | null) {
  if (!signal) {
    return {
      label: "No active module",
      href: "/field",
      description: "Select a field signal to see where the operating handoff should continue."
    };
  }

  switch (signal.area) {
    case "Project anchor":
    case "Project progress":
      return {
        label: "Open project schedule",
        href: signal.projectName ? `/projects?projectName=${encodeURIComponent(signal.projectName)}` : "/projects",
        description: "This signal should continue in project scheduling before field keeps pushing the same front."
      };
    case "Material request":
    case "Materials":
      return {
        label: "Open requisitions",
        href: "/procurement/requisitions",
        description: "This signal should continue through the supply chain before the front runs out of continuity."
      };
    case "Equipment":
      return {
        label: "Open equipment",
        href: "/equipment",
        description: "This signal should continue in equipment control while field protects the affected front."
      };
    case "Quality":
    case "Quality incident":
      return {
        label: "Open quality",
        href: "/quality",
        description: "This signal should continue in quality until release readiness is recovered."
      };
    case "Documentation":
    case "Document control":
      return {
        label: "Open document control",
        href: "/document-control",
        description: "This signal should continue through the formal technical review path."
      };
    case "Daily log":
      return {
        label: "Open daily log",
        href: "/daily-log",
        description: "This field signal should be formalized in daily log so supervision can act on it."
      };
    case "Workforce":
      return {
        label: "Open HR",
        href: "/hr",
        description: "This signal should continue through workforce coverage and attendance control."
      };
    case "Connectivity":
      return {
        label: "Open integrations",
        href: "/integrations",
        description: "This signal should continue through connectivity control before field assumes sync is stable."
      };
    default:
      return {
        label: "Open operations",
        href: "/operations",
        description: "This signal needs cross-domain follow-up from the operations board."
      };
  }
}

function buildSignalHumanStep(signal: FieldSignal | null) {
  if (!signal) {
    return "Select a signal to identify the next human action.";
  }

  if (signal.area === "Equipment") {
    return "Protect the front, confirm whether backup equipment is needed and assign a recovery owner.";
  }

  if (signal.area === "Material request" || signal.area === "Materials") {
    return "Confirm the shortage, define who chases the requisition and state where the delivery lands in field.";
  }

  if (signal.area === "Quality" || signal.area === "Quality incident") {
    return "Assign the finding owner, define the reinspection point and keep the front from closing too early.";
  }

  if (signal.area === "Documentation" || signal.area === "Document control") {
    return "State who emits the document request and when the answer must return to the front.";
  }

  return "Keep the next action concrete enough that the downstream team can continue without asking field to restate the issue.";
}

function buildSignalWhyNow(signal: FieldSignal | null) {
  if (!signal) {
    return "Select a field signal to understand why the front needs action right now.";
  }

  if (signal.posture === "critical") {
    return `${signal.title} is already in critical posture, so waiting now can turn a field issue into a direct production stop.`;
  }

  if (!signal.projectName?.trim()) {
    return `${signal.title} still lacks project context, so this is the point where the handoff can fail before another team even starts.`;
  }

  if (!signal.nextAction?.trim() || signal.nextAction.trim().length < 12) {
    return `${signal.title} already needs a clearer next move, so field should tighten it now before downstream teams work on assumptions.`;
  }

  return `${signal.title} is already a live operating signal, so clarifying its route now prevents field from rewriting the same story in another module.`;
}

function buildSignalDownstreamEffect(signal: FieldSignal | null) {
  if (!signal) {
    return "Select a field signal to inspect which downstream lane will absorb the impact.";
  }

  if (signal.area === "Equipment") {
    return "What happens here now affects equipment continuity, daily supervision and front resequencing at the same time.";
  }

  if (signal.area === "Material request" || signal.area === "Materials") {
    return "What happens here now affects requisitions, purchase orders, receiving and whether the front stays supplied or stops.";
  }

  if (signal.area === "Quality" || signal.area === "Quality incident") {
    return "What happens here now affects release readiness, daily log approval and whether the front continues with hidden rework risk.";
  }

  if (signal.area === "Documentation" || signal.area === "Document control") {
    return "What happens here now affects technical response timing and whether field keeps working with unresolved drawing ambiguity.";
  }

  return "What happens here now affects supervision, operations and the next shift handoff because this signal is already part of active site continuity.";
}

function buildSignalRouteSummary(signal: FieldSignal | null) {
  if (!signal) {
    return "Use field as the first capture layer between site reality and the module that must own the next operating move.";
  }

  if (signal.posture === "critical") {
    return "This signal should route first through containment and front protection before normal downstream continuation.";
  }

  if (signal.area === "Equipment") {
    return "This signal should route through equipment control and then daily supervision without rebuilding the field story.";
  }

  if (signal.area === "Material request" || signal.area === "Materials") {
    return "This signal should route through requisitions, supplier commitment and receiving while preserving front urgency.";
  }

  if (signal.area === "Quality" || signal.area === "Quality incident") {
    return "This signal should route through quality closure before supervision treats the front as releasable.";
  }

  if (signal.area === "Documentation" || signal.area === "Document control") {
    return "This signal should route through document control and technical answer before field assumes continuity is safe.";
  }

  return "This signal can continue through daily log or operations with the current field context intact.";
}

function buildSignalOperationalLinks(signal: FieldSignal | null, destination: { label: string; href: string }) {
  if (!signal) {
    return [
      { label: "Open operations", href: "/operations" },
      { label: "Open daily log", href: "/daily-log" },
      { label: "Open quality", href: "/quality" }
    ];
  }

  if (signal.posture === "critical") {
    return [
      { label: destination.label, href: destination.href },
      { label: "Open operations", href: "/operations" },
      { label: "Open daily log", href: "/daily-log" }
    ];
  }

  if (signal.area === "Equipment") {
    return [
      { label: destination.label, href: destination.href },
      { label: "Open daily log", href: "/daily-log" },
      { label: "Open operations", href: "/operations" }
    ];
  }

  if (signal.area === "Material request" || signal.area === "Materials") {
    return [
      { label: destination.label, href: destination.href },
      { label: "Open receiving", href: "/inventory/receiving" },
      { label: "Open movements", href: "/inventory/movements" }
    ];
  }

  if (signal.area === "Quality" || signal.area === "Quality incident") {
    return [
      { label: destination.label, href: destination.href },
      { label: "Open daily log", href: "/daily-log" },
      { label: "Open operations", href: "/operations" }
    ];
  }

  return [
    { label: destination.label, href: destination.href },
    { label: "Open operations", href: "/operations" },
    { label: "Open daily log", href: "/daily-log" }
  ];
}

function buildSignalReadiness(signal: FieldSignal | null) {
  if (!signal) {
    return {
      tone: "info" as const,
      label: "No signal selected",
      summary: "Choose a field signal to verify whether it is really ready for downstream execution.",
      checks: ["Select a signal from the active field list."]
    };
  }

  const checks: string[] = [];

  if (!signal.projectName?.trim()) {
    checks.push("Project context is still missing for downstream follow-up.");
  }

  if (!signal.owner?.trim()) {
    checks.push("Owner assignment is still missing.");
  }

  if (!signal.nextAction?.trim() || signal.nextAction.trim().length < 12) {
    checks.push("Next action is still too generic for another team to continue without clarification.");
  }

  if (signal.posture === "critical") {
    checks.push("Current posture is critical, so the front must stay protected before normal continuation.");
  }

  if (checks.length > 0) {
    return {
      tone: signal.posture === "critical" ? "danger" as const : "warning" as const,
      label: signal.posture === "critical" ? "Escalate before downstream" : "Needs clearer handoff",
      summary:
        signal.posture === "critical"
          ? "The signal still carries blockers that should be controlled before normal downstream continuation."
          : "The signal can continue, but the handoff should be tightened first.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for downstream",
    summary: "The signal already has enough context to continue into the next module without rewriting the same story.",
    checks: ["Open the recommended module and execute the stated next action."]
  };
}

function resolveCaptureModeFromSignal(signal: FieldSignal): FieldCaptureMode {
  switch (signal.area) {
    case "Quality":
    case "Quality incident":
      return "quality_incident";
    case "Material request":
    case "Materials":
      return "material_request";
    case "Documentation":
    case "Document control":
      return "document_control";
    case "Equipment":
      return "equipment_issue";
    default:
      return "daily_log";
  }
}

function buildCaptureFromSignal(signal: FieldSignal): FieldCaptureForm {
  const mode = resolveCaptureModeFromSignal(signal);
  const base = createCaptureForm(mode);
  const progressMatch = signal.detail.match(/(\d{1,3})%/);
  const countMatch = signal.detail.match(/\b(\d+)\b/);

  return {
    ...base,
    projectName: signal.projectName?.trim() || base.projectName,
    frontName: signal.title.trim(),
    owner: signal.owner.trim() || base.owner,
    summary: signal.title,
    detail: signal.detail,
    metricValue:
      mode === "daily_log"
        ? progressMatch?.[1] ?? base.metricValue
        : countMatch?.[1] ?? base.metricValue,
    category:
      mode === "material_request"
        ? signal.area
        : base.category,
    nextAction: signal.nextAction,
    posture: signal.posture
  };
}

function normalizeMatchValue(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function findClearMovementSignalMatch(signals: FieldSignal[], context: MovementFieldContext) {
  const normalizedProjectName = normalizeMatchValue(context.projectName);
  const normalizedDestinationName = normalizeMatchValue(context.destinationName);
  const normalizedRequestedBy = normalizeMatchValue(context.requestedBy);
  const normalizedNextAction = normalizeMatchValue(context.nextAction);

  const scored = signals
    .map((signal) => {
      let score = 0;
      const signalTitle = normalizeMatchValue(signal.title);
      const signalDetail = normalizeMatchValue(signal.detail);
      const signalProjectName = normalizeMatchValue(signal.projectName);
      const signalOwner = normalizeMatchValue(signal.owner);
      const signalNextAction = normalizeMatchValue(signal.nextAction);

      if (normalizedProjectName && signalProjectName === normalizedProjectName) {
        score += 2;
      }

      if (normalizedDestinationName) {
        if (signalTitle === normalizedDestinationName) {
          score += 3;
        } else if (signalTitle.includes(normalizedDestinationName) || signalDetail.includes(normalizedDestinationName)) {
          score += 2;
        }
      }

      if (normalizedRequestedBy && signalOwner === normalizedRequestedBy) {
        score += 2;
      }

      if (normalizedNextAction) {
        if (signalNextAction === normalizedNextAction) {
          score += 2;
        } else if (signalNextAction.includes(normalizedNextAction) || normalizedNextAction.includes(signalNextAction)) {
          score += 1;
        }
      }

      return { signal, score };
    })
    .filter((entry) => entry.score >= 3)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 1) {
    return scored[0].signal;
  }

  const topScore = scored[0]?.score ?? 0;
  const topMatches = scored.filter((entry) => entry.score === topScore);

  return topScore >= 5 && topMatches.length === 1 ? topMatches[0].signal : null;
}

function findClearMovementRequestMatch(
  requests: FieldMaterialRequestContract[],
  context: MovementFieldContext
) {
  const normalizedProjectName = normalizeMatchValue(context.projectName);
  const normalizedDestinationName = normalizeMatchValue(context.destinationName);
  const normalizedRequestedBy = normalizeMatchValue(context.requestedBy);
  const normalizedPurchaseReference = normalizeMatchValue(context.purchaseReference);
  const normalizedNextAction = normalizeMatchValue(context.nextAction);

  const scored = requests
    .map((request) => {
      let score = 0;
      const requestProjectName = normalizeMatchValue(request.projectName);
      const requestFrontName = normalizeMatchValue(request.frontName);
      const requestOwner = normalizeMatchValue(request.requestedBy);
      const requestSummary = normalizeMatchValue(request.summary);
      const requestDetail = normalizeMatchValue(request.detail);
      const requestNextAction = normalizeMatchValue(request.nextAction);

      if (normalizedProjectName && requestProjectName === normalizedProjectName) {
        score += 2;
      }

      if (normalizedDestinationName) {
        if (requestFrontName === normalizedDestinationName) {
          score += 3;
        } else if (requestFrontName.includes(normalizedDestinationName)) {
          score += 2;
        }
      }

      if (normalizedRequestedBy && requestOwner === normalizedRequestedBy) {
        score += 2;
      }

      if (
        normalizedPurchaseReference &&
        (requestSummary.includes(normalizedPurchaseReference) || requestDetail.includes(normalizedPurchaseReference))
      ) {
        score += 1;
      }

      if (normalizedNextAction) {
        if (requestNextAction === normalizedNextAction) {
          score += 2;
        } else if (requestNextAction.includes(normalizedNextAction) || normalizedNextAction.includes(requestNextAction)) {
          score += 1;
        }
      }

      return { request, score };
    })
    .filter((entry) => entry.score >= 3)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 1) {
    return scored[0].request;
  }

  const topScore = scored[0]?.score ?? 0;
  const topMatches = scored.filter((entry) => entry.score === topScore);

  return topScore >= 5 && topMatches.length === 1 ? topMatches[0].request : null;
}

function buildCaptureFromMovementContext(context: MovementFieldContext, current: FieldCaptureForm) {
  const base = createCaptureForm("material_request");
  const detailParts = [
    context.destinationName ? `Destino / Destination: ${context.destinationName}` : "",
    context.purchaseReference ? `OC / PO: ${context.purchaseReference}` : "",
    context.upstreamReceiptCode ? `Recibo / Receipt: ${context.upstreamReceiptCode}` : ""
  ].filter(Boolean);

  return {
    ...base,
    projectName: context.projectName || current.projectName || base.projectName,
    frontName: context.destinationName || current.frontName || base.frontName,
    owner: context.requestedBy || current.owner || base.owner,
    summary:
      current.summary ||
      (context.purchaseReference
        ? `Continuidad de material / Material continuity ${context.purchaseReference}`
        : base.summary),
    detail: detailParts.join(" · ") || current.detail || base.detail,
    category:
      context.purchaseReference
        ? `Field materials · ${context.purchaseReference}`
        : current.category || base.category,
    nextAction: context.nextAction || current.nextAction || base.nextAction
  };
}

function buildCaptureFromMovementRequest(request: FieldMaterialRequestContract) {
  return {
    ...createCaptureForm("material_request"),
    projectName: request.projectName,
    frontName: request.frontName,
    owner: request.requestedBy,
    summary: request.summary,
    detail: request.detail,
    metricValue: request.requestedVolume,
    nextAction: request.nextAction,
    posture:
      request.urgency === "critical"
        ? "critical"
        : request.urgency === "watch"
          ? "watch"
          : "healthy"
  } satisfies FieldCaptureForm;
}

function buildSchedulePhaseFromSignal(signal: FieldSignal) {
  switch (signal.area) {
    case "Project anchor":
    case "Project progress":
      return "Programación";
    case "Quality":
    case "Quality incident":
      return "Calidad";
    case "Material request":
    case "Materials":
      return "Abastecimiento";
    case "Equipment":
      return "Equipos";
    case "Documentation":
    case "Document control":
      return "Ingeniería";
    case "Workforce":
      return "Recursos";
    default:
      return "Campo";
  }
}

function buildProjectScheduleHref(signal: FieldSignal | null) {
  if (!signal?.projectName?.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    source: "field",
    projectName: signal.projectName,
    frontName: signal.title,
    owner: signal.owner,
    summary: signal.detail,
    nextAction: signal.nextAction,
    scheduleActivityName: signal.title,
    schedulePhase: buildSchedulePhaseFromSignal(signal),
    scheduleNextAction: signal.nextAction
  });

  return `/projects?${params.toString()}`;
}

function FieldPageContent() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const searchParams = useSearchParams();
  const [signals, setSignals] = useState<FieldSignal[]>([]);
  const [customSignals, setCustomSignals] = useState<FieldSignal[]>([]);
  const [projectsOverview, setProjectsOverview] = useState<NonNullable<Awaited<ReturnType<typeof fetchProjectsOverview>>> | null>(null);
  const [materialOverview, setMaterialOverview] = useState<NonNullable<Awaited<ReturnType<typeof fetchFieldMaterialRequestsOverview>>> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<FieldCaptureForm>(() => createCaptureForm("daily_log"));
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [postureFilter, setPostureFilter] = useState<"all" | FieldSignal["posture"]>("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"capture" | "priorities" | "control">("capture");
  const t = (es: string, en: string) => localizeText({ es, en });
  const sourceParam = searchParams.get("source")?.trim() ?? "";
  const projectQuery = searchParams.get("projectName")?.trim() ?? "";
  const purchaseReferenceParam = searchParams.get("purchaseReference")?.trim() ?? "";
  const upstreamReceiptCodeParam = searchParams.get("upstreamReceiptCode")?.trim() ?? "";
  const destinationNameParam = searchParams.get("destinationName")?.trim() ?? "";
  const requestedByParam = searchParams.get("requestedBy")?.trim() ?? "";
  const nextActionParam = searchParams.get("nextAction")?.trim() ?? "";
  const isMovementsSource = sourceParam === "movements";
  const [movementsPreloadDone, setMovementsPreloadDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.allSettled([
      fetchProjectsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchHrOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchQualityOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchInventoryOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchEquipmentOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchFieldMaterialRequestsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchIntegrationOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken }),
      fetchDocumentControlOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
    ])
      .then((results) => {
        if (cancelled) {
          return;
        }

        const [projectsResult, hrResult, qualityResult, inventoryResult, equipmentResult, fieldMaterialsResult, integrationsResult, documentControlResult] =
          results;
        const projects = projectsResult.status === "fulfilled" ? projectsResult.value : null;
        const hr = hrResult.status === "fulfilled" ? hrResult.value : null;
        const quality = qualityResult.status === "fulfilled" ? qualityResult.value : null;
        const inventory = inventoryResult.status === "fulfilled" ? inventoryResult.value : null;
        const equipment = equipmentResult.status === "fulfilled" ? equipmentResult.value : null;
        const fieldMaterials = fieldMaterialsResult.status === "fulfilled" ? fieldMaterialsResult.value : null;
        const integrations = integrationsResult.status === "fulfilled" ? integrationsResult.value : null;
        const documentControl = documentControlResult.status === "fulfilled" ? documentControlResult.value : null;

        setMaterialOverview(fieldMaterials);
        setProjectsOverview(projects);

        const nextSignals: FieldSignal[] = [];

        if (projects) {
          nextSignals.push(
            ...projects.projects.slice(0, 3).map((project) => ({
              id: `project-anchor-${project.id}`,
              title: project.name,
              detail: `${project.activeFronts} fronts · ${project.progress}% progress · ${project.nextMilestone}`,
              owner: project.client,
              area: "Project anchor",
              projectName: project.name,
              nextAction:
                project.status === "planning"
                  ? "Open first field capture or quality checkpoint to activate this project in site execution."
                  : project.nextMilestone,
              posture: (
                project.status === "blocked"
                  ? "critical"
                  : project.status === "at_risk" || project.status === "planning"
                    ? "watch"
                    : "healthy"
              ) as FieldSignal["posture"]
            }))
          );

          if (projects.focusProject) {
            nextSignals.push({
              id: projects.focusProject.id,
              title: projects.focusProject.name,
              detail: `${projects.focusProject.activeFronts} active fronts · ${projects.focusProject.progress}% progress`,
              owner: projects.focusProject.client,
              area: "Project progress",
              projectName: projects.focusProject.name,
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
        }

        if (hr?.focusWorkforce) {
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

        if (quality?.focusInspection) {
          nextSignals.push({
            id: quality.focusInspection.id,
            title: quality.focusInspection.areaName,
            detail: `${quality.focusInspection.openFindings} findings · ${quality.focusInspection.evidenceCompletion}% evidence`,
            owner: quality.focusInspection.contractorName,
            area: "Quality",
            projectName: quality.focusInspection.projectName,
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

        if (inventory?.focusLocation) {
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

        if (equipment?.focusMachine) {
          nextSignals.push({
            id: equipment.focusMachine.id,
            title: equipment.focusMachine.machineName,
            detail: `${equipment.focusMachine.projectName} · ${equipment.focusMachine.frontName} · ${equipment.focusMachine.availabilityPercent}% availability`,
            owner: equipment.focusMachine.machineType,
            area: "Equipment",
            projectName: equipment.focusMachine.projectName,
            nextAction: equipment.focusMachine.nextAction,
            posture: equipment.focusMachine.health
          });
        }

        if (integrations?.focusStream) {
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

        if (documentControl?.focusItem) {
          nextSignals.push({
            id: documentControl.focusItem.id,
            title: documentControl.focusItem.subject,
            detail: `${documentControl.focusItem.documentType} · ${documentControl.focusItem.openComments} comments`,
            owner: documentControl.focusItem.owner,
            area: "Documentation",
            projectName: documentControl.focusItem.projectName,
            nextAction: documentControl.focusItem.nextAction,
            posture: documentControl.focusItem.health
          });
        }

        if (nextSignals.length === 0) {
          setError("Field app did not receive enough actionable site signals yet.");
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken]);

  useEffect(() => {
    if (createForm.projectName || !projectsOverview?.projects.length) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      projectName: projectsOverview.projects[0]?.name ?? current.projectName
    }));
  }, [createForm.projectName, projectsOverview]);

  useEffect(() => {
    if (!projectQuery) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      projectName: projectQuery
    }));
  }, [projectQuery]);

  const combinedSignals = useMemo(() => [...customSignals, ...signals], [customSignals, signals]);
  const movementContext = useMemo<MovementFieldContext>(() => ({
    purchaseReference: purchaseReferenceParam,
    upstreamReceiptCode: upstreamReceiptCodeParam,
    destinationName: destinationNameParam,
    requestedBy: requestedByParam,
    projectName: projectQuery,
    nextAction: nextActionParam
  }), [
    destinationNameParam,
    nextActionParam,
    projectQuery,
    purchaseReferenceParam,
    requestedByParam,
    upstreamReceiptCodeParam
  ]);
  const hasMovementsContext = isMovementsSource && Boolean(
    purchaseReferenceParam ||
      upstreamReceiptCodeParam ||
      destinationNameParam ||
      requestedByParam ||
      projectQuery ||
      nextActionParam
  );
  const visibleSignals = useMemo(() => {
    if (!projectQuery) {
      return combinedSignals;
    }

    const normalizedQuery = projectQuery.toLowerCase();
    return combinedSignals.filter((signal) => {
      const projectName = signal.projectName?.toLowerCase() ?? "";
      const title = signal.title.toLowerCase();
      const detail = signal.detail.toLowerCase();

      return projectName === normalizedQuery || title.includes(normalizedQuery) || detail.includes(normalizedQuery);
    });
  }, [combinedSignals, projectQuery]);

  const areaOptions = useMemo(() => Array.from(new Set(visibleSignals.map((signal) => signal.area))).sort((left, right) => left.localeCompare(right)), [visibleSignals]);

  const filteredSignals = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase();
    return visibleSignals.filter((signal) => {
      const matchesPosture = postureFilter === "all" || signal.posture === postureFilter;
      const matchesArea = areaFilter === "all" || signal.area === areaFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        signal.title.toLowerCase().includes(normalizedSearch) ||
        signal.detail.toLowerCase().includes(normalizedSearch) ||
        signal.owner.toLowerCase().includes(normalizedSearch) ||
        signal.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesPosture && matchesArea && matchesSearch;
    });
  }, [areaFilter, postureFilter, searchFilter, visibleSignals]);

  const filteredMetrics = useMemo(() => {
    const critical = filteredSignals.filter((signal) => signal.posture === "critical").length;
    const watch = filteredSignals.filter((signal) => signal.posture === "watch").length;
    const healthy = filteredSignals.filter((signal) => signal.posture === "healthy").length;

    return {
      capturesToday: filteredSignals.length * 24,
      offlineSync: healthy > 0 ? Math.max(72, 100 - critical * 7) : 0,
      photosLinked: filteredSignals.length * 96,
      checklistDiscipline: Math.max(55, 100 - watch * 6 - critical * 8),
      critical,
      watch
    };
  }, [filteredSignals]);

  const prioritySignals = useMemo(
    () =>
      filteredSignals
        .slice()
        .sort((left, right) => {
          const postureWeight = { critical: 0, watch: 1, healthy: 2 };
          return postureWeight[left.posture] - postureWeight[right.posture];
        })
        .slice(0, 4),
    [filteredSignals]
  );

  const equipmentPriority = useMemo(
    () => prioritySignals.find((signal) => signal.area === "Equipment") ?? null,
    [prioritySignals]
  );
  const movementMatchedSignal = useMemo(
    () => hasMovementsContext ? findClearMovementSignalMatch(combinedSignals, movementContext) : null,
    [combinedSignals, hasMovementsContext, movementContext]
  );
  const movementMatchedRequest = useMemo(
    () => hasMovementsContext && materialOverview?.requests.length
      ? findClearMovementRequestMatch(materialOverview.requests, movementContext)
      : null,
    [hasMovementsContext, materialOverview?.requests, movementContext]
  );
  const movementFieldMatch = useMemo<MovementFieldMatch>(() => {
    if (movementMatchedSignal) {
      return { kind: "signal", signal: movementMatchedSignal };
    }

    if (movementMatchedRequest) {
      return { kind: "request", request: movementMatchedRequest };
    }

    return null;
  }, [movementMatchedRequest, movementMatchedSignal]);
  const selectedSignal = useMemo(
    () => filteredSignals.find((signal) => signal.id === selectedSignalId) ?? prioritySignals[0] ?? filteredSignals[0] ?? null,
    [filteredSignals, prioritySignals, selectedSignalId]
  );
  const followUpLinks = useMemo(() => modeFollowUpLinks(createForm.mode), [createForm.mode]);
  const constraintSummary = useMemo(() => buildFieldConstraintSummary(createForm), [createForm]);
  const nextDestination = useMemo(() => buildFieldNextDestination(createForm), [createForm]);
  const constraintSummarySpanish = useMemo(() => captureConstraintSpanish(createForm), [createForm]);
  const nextDestinationSpanish = useMemo(() => captureDestinationSpanish(createForm.mode), [createForm.mode]);
  const humanNextStep = useMemo(() => buildHumanNextStep(createForm), [createForm]);
  const signalDestination = useMemo(() => buildSignalDestination(selectedSignal), [selectedSignal]);
  const signalHumanStep = useMemo(() => buildSignalHumanStep(selectedSignal), [selectedSignal]);
  const signalWhyNow = useMemo(() => buildSignalWhyNow(selectedSignal), [selectedSignal]);
  const signalDownstreamEffect = useMemo(() => buildSignalDownstreamEffect(selectedSignal), [selectedSignal]);
  const signalRouteSummary = useMemo(() => buildSignalRouteSummary(selectedSignal), [selectedSignal]);
  const signalOperationalLinks = useMemo(
    () => buildSignalOperationalLinks(selectedSignal, signalDestination),
    [selectedSignal, signalDestination]
  );
  const signalReadiness = useMemo(() => buildSignalReadiness(selectedSignal), [selectedSignal]);
  const selectedDestinationSpanishLabel = useMemo(() => routeSpanishLabel(signalDestination.href), [signalDestination.href]);
  const signalScheduleHref = useMemo(() => buildProjectScheduleHref(selectedSignal), [selectedSignal]);
  const movementsContextStatus = hasMovementsContext
    ? movementFieldMatch?.kind === "signal"
      ? t(
          "Match claro con registro de campo; selección automática aplicada.",
          "Clear match with field record; automatic selection applied."
        )
      : movementFieldMatch?.kind === "request"
        ? t(
            "Match claro con solicitud de campo; contexto aplicado para continuar.",
            "Clear match with field request; context applied to continue."
          )
        : t(
            "Contexto aplicado o visible; sin match único todavía.",
            "Context applied or visible; no single clear match yet."
          )
    : null;

  useEffect(() => {
    if (filteredSignals.length === 0) {
      setSelectedSignalId(null);
      return;
    }

    const isVisible = filteredSignals.some((signal) => signal.id === selectedSignalId);
    if (!isVisible) {
      setSelectedSignalId(filteredSignals[0]?.id ?? null);
    }
  }, [filteredSignals, selectedSignalId]);

  useEffect(() => {
    if (!hasMovementsContext || movementsPreloadDone) {
      return;
    }

    if (movementMatchedSignal) {
      setSelectedSignalId(movementMatchedSignal.id);
      setMovementsPreloadDone(true);
      return;
    }

    if (movementMatchedRequest) {
      setCreateForm(buildCaptureFromMovementRequest(movementMatchedRequest));
      setSearchFilter((current) => current || movementMatchedRequest.frontName);
      setWorkspaceView("capture");
      setMovementsPreloadDone(true);
      return;
    }

    setCreateForm((current) => buildCaptureFromMovementContext(movementContext, current));
    setSearchFilter((current) => current || movementContext.destinationName);
    setWorkspaceView("capture");
    setMovementsPreloadDone(true);
  }, [
    hasMovementsContext,
    movementContext,
    movementMatchedRequest,
    movementMatchedSignal,
    movementsPreloadDone
  ]);

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

    if (createForm.mode === "material_request") {
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
      title={{ es: "Avance de obra", en: "Field progress" }}
      eyebrow={{ es: "Ejecución de obra", en: "Site execution" }}
      description={{
        es: "Registra avance, incidencias y necesidades del frente; después envíalas al equipo que las resolverá.",
        en: "Capture progress, issues and site needs, then route them to the team that will resolve them."
      }}
      actions={
        <Badge tone={isDemoMode ? "warning" : "success"}>
          {isLoading ? t("actualizando", "refreshing") : isDemoMode ? t("demo operable", "operable demo") : t("backend activo", "live backend")}
        </Badge>
      }
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title={t("Campo", "Field") }>
        {visibleSignals.length > 0 ? (
          <>
            <section className="fieldWorkbench">
              <div className="fieldWorkbenchIntro">
                <span className="eyebrow">
                  {t("Registro operativo", "Operational capture")}
                  <span className="mono">{t("obra activa", "active site")}</span>
                </span>
                <h2>{t("¿Qué necesitas registrar ahora?", "What do you need to capture now?")}</h2>
                <p>
                  {t(
                    "Elige el tipo de registro, captura lo indispensable y deja listo el siguiente responsable. Los controles detallados quedan fuera de este primer paso.",
                    "Choose the record type, capture the essentials and set the next owner. Detailed controls stay out of this first step."
                  )}
                </p>
                <div className="fieldModeRail" role="list" aria-label={t("Tipos de registro", "Record types")}>
                  {(["daily_log", "quality_incident", "material_request", "document_control", "equipment_issue"] as FieldCaptureMode[]).map((mode) => {
                    const active = createForm.mode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        className={`fieldModeButton ${active ? "fieldModeButtonActive" : ""}`}
                        aria-pressed={active}
                        onClick={() => {
                          setCreateForm((current) => ({
                            ...createCaptureForm(mode),
                            projectName: current.projectName,
                            frontName: current.frontName,
                            owner: current.owner
                          }));
                          setWorkspaceView("capture");
                        }}
                      >
                        {localizeText(captureModeLabel(mode))}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="fieldWorkbenchSnapshot">
                <span>{t("Contexto del registro", "Capture context")}</span>
                <strong>{createForm.projectName || t("Selecciona un proyecto", "Select a project")}</strong>
                <p>{createForm.frontName || t("Frente pendiente", "Front pending")}</p>
                <div className="fieldWorkbenchCounts">
                  <div>
                    <strong>{filteredMetrics.critical}</strong>
                    <span>{t("críticos", "critical")}</span>
                  </div>
                  <div>
                    <strong>{filteredMetrics.watch}</strong>
                    <span>{t("en seguimiento", "watching")}</span>
                  </div>
                  <div>
                    <strong>{materialOverview?.summary.linkedRequisitions ?? 0}</strong>
                    <span>{t("req. ligadas", "linked reqs")}</span>
                  </div>
                </div>
              </div>
            </section>

            {hasMovementsContext ? (
              <section className="grid cols1">
                <Card
                  title={t("Contexto desde movimientos", "Context from movements")}
                  description={t(
                    "La continuidad entre movements y field queda visible sin alterar los filtros o rutas ya existentes.",
                    "Continuity between movements and field is visible without altering existing filters or routes."
                  )}
                  aside={<Badge tone="info">Precargado desde movimientos / Preloaded from movements</Badge>}
                >
                  <div className="detailGrid">
                    {destinationNameParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Destino / frente", "Destination / front")}</div>
                        <div>{destinationNameParam}</div>
                      </div>
                    ) : null}
                    {projectQuery ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Proyecto", "Project")}</div>
                        <div>{projectQuery}</div>
                      </div>
                    ) : null}
                    {requestedByParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Solicitado por", "Requested by")}</div>
                        <div>{requestedByParam}</div>
                      </div>
                    ) : null}
                    {purchaseReferenceParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">Purchase reference</div>
                        <div>{purchaseReferenceParam}</div>
                      </div>
                    ) : null}
                    {upstreamReceiptCodeParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Recibo origen", "Upstream receipt")}</div>
                        <div>{upstreamReceiptCodeParam}</div>
                      </div>
                    ) : null}
                    {nextActionParam ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Siguiente acción", "Next action")}</div>
                        <div>{nextActionParam}</div>
                      </div>
                    ) : null}
                    {movementsContextStatus ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Estado", "Status")}</div>
                        <div>{movementsContextStatus}</div>
                      </div>
                    ) : null}
                    {movementFieldMatch?.kind === "signal" ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Registro vinculado", "Linked field record")}</div>
                        <div>{movementFieldMatch.signal.title}</div>
                      </div>
                    ) : null}
                    {movementFieldMatch?.kind === "request" ? (
                      <div className="detailRow">
                        <div className="detailLabel">{t("Solicitud vinculada", "Linked field request")}</div>
                        <div>{`${movementFieldMatch.request.frontName} · ${movementFieldMatch.request.summary}`}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="row gap wrap" style={{ marginTop: 16 }}>
                    {movementFieldMatch?.kind === "signal" ? (
                      <button type="button" className="buttonGhost" onClick={() => setWorkspaceView("priorities")}>
                        {t("Ver registro seleccionado", "View selected record")}
                      </button>
                    ) : (
                      <button type="button" className="buttonGhost" onClick={() => setWorkspaceView("capture")}>
                        {t("Ver captura precargada", "View preloaded capture")}
                      </button>
                    )}
                    <Link className="buttonGhost" href="/field">
                      {t("Limpiar contexto", "Clear context")}
                    </Link>
                  </div>
                </Card>
              </section>
            ) : null}

            <div className="fieldWorkspaceTabs" role="tablist" aria-label={t("Vistas de campo", "Field views")}>
              {([
                ["capture", t("Registrar", "Capture")],
                ["priorities", t("Pendientes", "Priorities")],
                ["control", t("Control", "Control")]
              ] as const).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={workspaceView === view}
                  className={`fieldWorkspaceTab ${workspaceView === view ? "fieldWorkspaceTabActive" : ""}`}
                  onClick={() => setWorkspaceView(view)}
                >
                  {label}
                </button>
              ))}
            </div>

            {workspaceView === "capture" ? (
              <section className="grid cols2">
                <Card
                  title={t("Nuevo registro", "New record")}
                  description={t("Completa lo mínimo para que el siguiente equipo pueda actuar sin pedirte la misma información otra vez.", "Complete the essentials so the next team can act without asking for the same information again.")}
                  aside={<Badge tone={constraintSummary.tone}>{localizeText(captureModeLabel(createForm.mode))}</Badge>}
                >
                  <div className="captureCompactGrid">
                    <label className="captureField captureFieldWide">
                      <span>{t("Proyecto", "Project")}</span>
                      {projectsOverview?.projects.length ? (
                        <select
                          className="selectField"
                          value={createForm.projectName}
                          onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                        >
                          {projectsOverview.projects.map((project) => (
                            <option key={project.id} value={project.name}>
                              {project.code} · {project.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} />
                      )}
                    </label>
                    <label className="captureField">
                      <span>{t("Frente", "Front")}</span>
                      <input className="field" value={createForm.frontName} onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))} placeholder={t("Ej. Cimentación", "E.g. Foundation")} />
                    </label>
                    <label className="captureField">
                      <span>{t("Responsable", "Owner")}</span>
                      <input className="field" value={createForm.owner} onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))} placeholder={t("Ej. Residente de obra", "E.g. Site superintendent")} />
                    </label>
                    <label className="captureField captureFieldWide">
                      <span>{t("Resumen", "Summary")}</span>
                      <input className="field" value={createForm.summary} onChange={(event) => setCreateForm((current) => ({ ...current, summary: event.target.value }))} placeholder={captureModeMeta(createForm.mode).summaryPlaceholder} />
                    </label>
                    <label className="captureField captureFieldWide">
                      <span>{t("Qué ocurrió", "What happened")}</span>
                      <input className="field" value={createForm.detail} onChange={(event) => setCreateForm((current) => ({ ...current, detail: event.target.value }))} placeholder={captureModeMeta(createForm.mode).detailPlaceholder} />
                    </label>
                    <label className="captureField">
                      <span>{t("Indicador", "Metric")}</span>
                      <input className="field" value={createForm.metricLabel} onChange={(event) => setCreateForm((current) => ({ ...current, metricLabel: event.target.value }))} placeholder={captureModeMeta(createForm.mode).metricLabelPlaceholder} />
                    </label>
                    <label className="captureField">
                      <span>{t("Valor", "Value")}</span>
                      <input className="field" value={createForm.metricValue} onChange={(event) => setCreateForm((current) => ({ ...current, metricValue: event.target.value }))} placeholder={captureModeMeta(createForm.mode).metricValuePlaceholder} />
                    </label>
                    <label className="captureField">
                      <span>{t("Estado", "Status")}</span>
                      <select className="selectField" value={createForm.posture} onChange={(event) => setCreateForm((current) => ({ ...current, posture: event.target.value as FieldSignal["posture"] }))}>
                        <option value="healthy">{t("sin bloqueo", "clear")}</option>
                        <option value="watch">{t("en seguimiento", "watch")}</option>
                        <option value="critical">{t("crítico", "critical")}</option>
                      </select>
                    </label>
                    <label className="captureField captureFieldWide">
                      <span>{t("Siguiente acción", "Next action")}</span>
                      <input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder={captureModeMeta(createForm.mode).nextActionPlaceholder} />
                    </label>
                  </div>

                  {createForm.mode === "material_request" ? (
                    <details className="captureDetails">
                      <summary>{t("Datos de compra y abastecimiento", "Procurement and supply details")}</summary>
                      <div className="captureCompactGrid">
                        <label className="captureField"><span>{t("Categoría", "Category")}</span><input className="field" value={createForm.category} onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))} /></label>
                        <label className="captureField"><span>{t("Partidas", "Items")}</span><input className="field" type="number" min="1" value={createForm.requestedItems} onChange={(event) => setCreateForm((current) => ({ ...current, requestedItems: event.target.value }))} /></label>
                        <label className="captureField"><span>{t("Presupuesto estimado", "Estimated budget")}</span><input className="field" type="number" min="0" value={createForm.budgetAmount} onChange={(event) => setCreateForm((current) => ({ ...current, budgetAmount: event.target.value }))} /></label>
                        <label className="captureField"><span>{t("Proveedores disponibles", "Available suppliers")}</span><input className="field" type="number" min="0" value={createForm.supplierCoverage} onChange={(event) => setCreateForm((current) => ({ ...current, supplierCoverage: event.target.value }))} /></label>
                      </div>
                    </details>
                  ) : null}

                  {error ? <p className="formError">{error}</p> : null}
                  <div className="row gap wrap" style={{ marginTop: 20 }}>
                    <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateSignal()}>
                      {isCreating ? t("Guardando...", "Saving...") : t("Guardar registro", "Save record")}
                    </button>
                    <button type="button" className="buttonGhost" onClick={() => setCreateForm((current) => createCaptureExample(current.mode, current.projectName || projectsOverview?.projects[0]?.name || "Proyecto central"))}>
                      {t("Cargar ejemplo", "Load example")}
                    </button>
                    {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                  </div>
                </Card>

                <div className="fieldWorkspaceSideStack">
                  <Card title={t("Validación rápida", "Quick validation")} description={t("El registro debe dejar claro qué se detiene y quién continúa.", "The record must make clear what is blocked and who continues.")} aside={<Badge tone={constraintSummary.tone}>{t(constraintSummarySpanish.label, constraintSummary.label)}</Badge>}>
                    <p className="sectionText">{t(constraintSummarySpanish.description, constraintSummary.description)}</p>
                    <div className="detailGrid" style={{ marginTop: 16 }}>
                      <div className="detailRow"><div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div><div>{t("Confirma responsable, fecha de respuesta y condición para liberar o continuar el frente.", humanNextStep)}</div></div>
                    </div>
                  </Card>
                  <Card title={t("Entrega al siguiente módulo", "Handoff to next module")} description={t(nextDestinationSpanish.description, nextDestination.description)}>
                    <Link className="button secondary" href={nextDestination.href}>{t(nextDestinationSpanish.label, nextDestination.label)}</Link>
                    <p className="sectionText" style={{ marginTop: 16 }}>{t("Guarda primero el registro; después usa este acceso para continuar el flujo.", "Save the record first, then use this shortcut to continue the flow.")}</p>
                  </Card>
                </div>
              </section>
            ) : null}

            {workspaceView === "priorities" ? (
              <section className="grid cols2">
                <Card title={t("Frentes que requieren decisión", "Fronts needing a decision")} description={t("Filtra los pendientes y abre uno para entender el siguiente movimiento.", "Filter open items and open one to understand the next move.")} aside={<Badge tone={filteredMetrics.critical > 0 ? "danger" : "success"}>{filteredMetrics.critical} {t("críticos", "critical")}</Badge>}>
                  <FilterBar summary={`${filteredSignals.length} ${t("señales visibles", "visible signals")}`}>
                    <select className="field" value={postureFilter} onChange={(event) => setPostureFilter(event.target.value as typeof postureFilter)}>
                      <option value="all">{t("Todos los estados", "All statuses")}</option>
                      <option value="critical">{t("Crítico", "Critical")}</option>
                      <option value="watch">{t("En seguimiento", "Watch")}</option>
                      <option value="healthy">{t("Sin bloqueo", "Clear")}</option>
                    </select>
                    <select className="field" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                      <option value="all">{t("Todas las áreas", "All areas")}</option>
                      {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                    </select>
                    <input className="field" type="search" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} placeholder={t("Buscar frente, responsable o acción", "Search front, owner or action")} />
                  </FilterBar>
                  <div className="list">
                    {filteredSignals.map((signal) => (
                      <button key={signal.id} type="button" className={`listItem ${selectedSignal?.id === signal.id ? "listItemSelected" : ""}`} onClick={() => setSelectedSignalId(signal.id)}>
                        <div><strong>{signal.title}</strong><p>{signal.projectName ? `${signal.projectName} · ${signal.detail}` : signal.detail}</p></div>
                        <Badge tone={postureTone(signal.posture)}>{signal.area}</Badge>
                      </button>
                    ))}
                  </div>
                </Card>

                <Card title={selectedSignal?.title ?? t("Selecciona un pendiente", "Select a pending item")} description={selectedSignal ? `${selectedSignal.area} · ${selectedSignal.owner}` : t("Selecciona un frente de la lista para ver su ruta.", "Select a front from the list to see its route.")}>
                  {selectedSignal ? (
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Qué ocurre", "What is happening")}</div><div>{selectedSignal.detail}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Acción requerida", "Required action")}</div><div>{selectedSignal.nextAction}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Impacto", "Impact")}</div><div>{t("Este pendiente impacta supervisión, la operación y el siguiente turno si no se atiende a tiempo.", signalDownstreamEffect)}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Continuar en", "Continue in")}</div><div>{t(`Este pendiente debe continuar en ${selectedDestinationSpanishLabel}.`, signalDestination.description)}</div></div>
                    </div>
                  ) : <EmptyState title={t("Sin selección", "Nothing selected")} description={t("Elige un registro para continuar.", "Choose a record to continue.")} />}
                  {selectedSignal ? (
                    <div className="row gap wrap" style={{ marginTop: 20 }}>
                      <Link className="button" href={signalDestination.href}>{t(selectedDestinationSpanishLabel, signalDestination.label)}</Link>
                      {signalScheduleHref ? (
                        <Link className="buttonGhost" href={signalScheduleHref}>
                          {t("Abrir programa contextual", "Open contextual schedule")}
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="buttonGhost"
                        onClick={() => {
                          setCreateForm(buildCaptureFromSignal(selectedSignal));
                          setWorkspaceView("capture");
                        }}
                      >
                        {t("Usar como captura", "Use as capture")}
                      </button>
                      <Link className="buttonGhost" href="/operations">{t("Ver operaciones", "Open operations")}</Link>
                    </div>
                  ) : null}
                </Card>
              </section>
            ) : null}

            {workspaceView === "control" ? (
              <>
                <section className="grid cols3">
                  <KpiCard label={t("Frentes críticos", "Critical fronts")} value={String(filteredMetrics.critical)} footnote={t("Requieren una acción o escalamiento hoy.", "Require an action or escalation today.")} />
                  <KpiCard label={t("Evidencia estimada", "Estimated evidence")} value={String(filteredMetrics.photosLinked)} footnote={t("Registros con evidencia por completar o revisar.", "Records with evidence to complete or review.")} />
                  <KpiCard label={t("Requisiciones ligadas", "Linked requisitions")} value={String(materialOverview?.summary.linkedRequisitions ?? 0)} footnote={t("Solicitudes de campo que ya entraron a compras.", "Field requests already sent to procurement.")} />
                </section>
                <section className="grid cols2">
                  <Card title={t("Cadena de abastecimiento", "Supply chain")} description={t("Lo capturado en campo debe continuar hasta la recepción, no quedarse como aviso.", "What is captured in the field must continue through receiving, not remain a notice.")}>
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Solicitudes abiertas", "Open requests")}</div><div>{materialOverview?.summary.openRequests ?? 0}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Solicitudes críticas", "Critical requests")}</div><div>{materialOverview?.summary.criticalRequests ?? 0}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("En foco", "In focus")}</div><div>{materialOverview?.focusRequest ? `${materialOverview.focusRequest.frontName} · ${materialOverview.focusRequest.summary}` : t("Sin solicitud prioritaria", "No priority request")}</div></div>
                    </div>
                    <div className="row gap wrap" style={{ marginTop: 20 }}><Link className="button" href="/procurement/requisitions">{t("Abrir requisiciones", "Open requisitions")}</Link><Link className="buttonGhost" href="/inventory/receiving">{t("Abrir recepción", "Open receiving")}</Link></div>
                  </Card>
                  <Card title={t("Ritmo de supervisión", "Supervision rhythm")} description={t("Usa estos accesos después de capturar; no como sustituto de registrar la operación.", "Use these shortcuts after capturing, not as a substitute for recording the operation.")}>
                    <div className="row gap wrap"><Link className="buttonGhost" href="/daily-log">{t("Bitácora diaria", "Daily log")}</Link><Link className="buttonGhost" href="/quality">{t("Calidad", "Quality")}</Link><Link className="buttonGhost" href="/equipment">{t("Equipos", "Equipment")}</Link></div>
                  </Card>
                </section>
              </>
            ) : null}

            <details className="fieldAdvanced">
              <summary>{t("Abrir contexto y controles avanzados", "Open advanced context and controls")}</summary>
              <div className="fieldAdvancedContent">
            <section className="grid cols4">
              <KpiCard
                label={t("Capturas hoy", "Captures today")}
                value={String(filteredMetrics.capturesToday)}
                footnote={t("Carga direccional de capturas de campo armada con las señales activas actuales.", "Directional field capture load assembled from current live site signals.")}
              />
              <KpiCard
                label={t("Sync offline", "Offline sync")}
                value={`${filteredMetrics.offlineSync}%`}
                footnote={t("Postura práctica de conectividad basada en la salud actual de las señales de obra.", "Practical connectivity posture based on current site signal health.")}
              />
              <KpiCard
                label={t("Fotos ligadas", "Photos linked")}
                value={String(filteredMetrics.photosLinked)}
                footnote={t("Volumen estimado de evidencia ligado a los flujos móviles activos de obra.", "Estimated evidence volume tied to active mobile field workflows.")}
              />
              <KpiCard
                label={t("Checklists", "Checklists")}
                value={`${filteredMetrics.checklistDiscipline}%`}
                footnote={t("Puntaje direccional de disciplina para los flujos actuales de campo.", "Directional discipline score for current field workflows.")}
              />
              <KpiCard
                label={t("Cadena material", "Material chain")}
                value={String(materialOverview?.summary.linkedRequisitions ?? 0)}
                footnote={t("Solicitudes de material de campo ya ligadas a requisiciones vivas de compras.", "Field material requests already linked into live procurement requisitions.")}
              />
            </section>

            <section className="grid cols2">
              <Card
                title={t("Flujo de campo", "Field workflow")}
                description={t("Campo debe actuar como la capa rápida de captura para problemas reales de obra, no como un dashboard aislado.", "Field should act as the fast capture layer for real site issues, not as an isolated dashboard.")}
                aside={<Badge tone={filteredMetrics.critical > 0 ? "danger" : filteredMetrics.watch > 0 ? "warning" : "success"}>{filteredMetrics.critical > 0 ? t("frentes críticos", "critical fronts") : filteredMetrics.watch > 0 ? t("frentes en seguimiento", "watch fronts") : t("frentes estables", "stable fronts")}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">{t("Ruta actual", "Current route")}</div><div>{buildFieldWorkflowSummary(createForm.mode)}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Propósito de captura", "Capture purpose")}</div><div>{t("Usa campo para iniciar el problema con suficiente contexto y que el módulo destino no te pida reescribir la misma historia operativa.", "Use field to start the issue with enough context so the downstream module does not need the user to retype the same operational story.")}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Resultado esperado", "Expected outcome")}</div><div>{t("Después de capturar, salta de inmediato al módulo que realmente resolverá el bloqueo y vuelve solo para confirmar continuidad.", "After capture, jump immediately into the module that will actually resolve the blockage and come back only to confirm continuity.")}</div></div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button" href="/daily-log">{t("Abrir bitácora", "Open daily log")}</Link>
                  <Link className="buttonGhost" href="/quality">{t("Abrir calidad", "Open quality")}</Link>
                  <Link className="buttonGhost" href="/equipment">{t("Abrir equipos", "Open equipment")}</Link>
                  <Link className="buttonGhost" href="/inventory/movements">{t("Abrir movimientos", "Open movements")}</Link>
                </div>
              </Card>
            </section>

            <section className="grid cols3">
              <Card
                title={t("Bloqueo capturado", "Captured blocker")}
                description={t("Qué tipo de restricción operativa está describiendo realmente la captura actual.", "What kind of operational constraint the current capture is actually describing.")}
                aside={<Badge tone={constraintSummary.tone}>{t(constraintSummarySpanish.label, constraintSummary.label)}</Badge>}
              >
                <p className="sectionText">{t(constraintSummarySpanish.description, constraintSummary.description)}</p>
              </Card>
              <Card title={t("Siguiente módulo", "Next module")} description={t("A dónde debe continuar el usuario después de registrar la incidencia de campo.", "Where the user should continue after recording the field issue.")}>
                <p className="sectionText">{t(nextDestinationSpanish.description, nextDestination.description)}</p>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <Link className="button secondary" href={nextDestination.href}>
                    {t(nextDestinationSpanish.label, nextDestination.label)}
                  </Link>
                </div>
              </Card>
              <Card title={t("Siguiente paso humano", "Next human step")} description={t("El relevo debe seguir claro incluso antes de abrir cualquier otro módulo.", "The handoff should still be clear even before any other module opens.")}>
                <p className="sectionText">{t("Confirma responsable, ventana de respuesta y condición de liberación o continuidad del frente.", humanNextStep)}</p>
              </Card>
            </section>

            {isDemoMode ? (
              <Card
                title={t("Modo demo operable", "Operable demo mode")}
                description={t("La captura de campo sigue siendo testeable aunque por ahora solo estén disponibles proyectos y señales de equipo.", "Field capture stays testable even if only projects and equipment signals are currently available.")}
                aside={<Badge tone="warning">{t("grafo vivo parcial", "partial live graph")}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">{t("Que ya funciona", "What works")}</div>
                    <div>{t("Puedes crear capturas locales de campo, filtrar señales y validar la historia entre campo, proyectos y equipos.", "Create local field captures, filter signals and validate the field-to-project-to-equipment story.")}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Walkthrough recomendado", "Best walkthrough")}</div>
                    <div>{t("Abre un proyecto desde Projects, entra a Field, agrega una falla de equipo o bitácora y luego revisa continuidad en Operations.", "Open a project from Projects, jump into Field, add an equipment issue or daily log, then review continuity in Operations.")}</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols2">
              <Card title={t("Flujos de campo", "Field flows")} description={t("La capa móvil ahora refleja la presión viva de obra entre áreas de ejecución.", "The mobile layer now reflects live site pressure across execution areas.")}>
                <FilterBar summary={localizeText({ es: `${filteredSignals.length} señales de campo coinciden con los filtros operativos actuales`, en: `${filteredSignals.length} field signals match the current operating filters` })}>
                  {projectQuery ? (
                    <Badge tone="info">{t("Proyecto", "Project")} {projectQuery}</Badge>
                  ) : null}
                  <select className="field" value={postureFilter} onChange={(event) => setPostureFilter(event.target.value as typeof postureFilter)}>
                    <option value="all">{t("Toda la postura", "All posture")}</option>
                    <option value="critical">{t("Crítico", "Critical")}</option>
                    <option value="watch">{t("En seguimiento", "Watch")}</option>
                    <option value="healthy">{t("Sin bloqueo", "Healthy")}</option>
                  </select>
                  <select className="field" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                    <option value="all">{t("Todas las áreas", "All areas")}</option>
                    {areaOptions.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field"
                    type="search"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder={t("Señal, responsable, detalle o acción", "Signal, owner, detail or action")}
                    style={{ minWidth: 220 }}
                  />
                  <Badge tone={filteredMetrics.critical > 0 ? "danger" : filteredMetrics.watch > 0 ? "warning" : "success"}>
                    {filteredMetrics.critical > 0
                      ? localizeText({ es: `${filteredMetrics.critical} críticas`, en: `${filteredMetrics.critical} critical` })
                      : filteredMetrics.watch > 0
                        ? localizeText({ es: `${filteredMetrics.watch} en seguimiento`, en: `${filteredMetrics.watch} watch` })
                        : t("subset visible estable", "visible subset stable")}
                  </Badge>
                  {projectQuery ? <Link className="buttonGhost" href="/field">{t("Limpiar proyecto", "Clear project")}</Link> : null}
                </FilterBar>
                <div className="list">
                  {filteredSignals.map((signal) => (
                    <button
                      type="button"
                      className="listItem"
                      key={signal.id}
                      onClick={() => setSelectedSignalId(signal.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        border: selectedSignal?.id === signal.id ? "1px solid var(--accent-600)" : undefined,
                        background: selectedSignal?.id === signal.id ? "rgba(15, 118, 110, 0.06)" : undefined
                      }}
                    >
                      <div>
                        <strong>{signal.title}</strong>
                        <p>{signal.projectName ? `${signal.projectName} · ${signal.detail}` : signal.detail}</p>
                      </div>
                      <Badge tone={postureTone(signal.posture)}>{signal.area}</Badge>
                    </button>
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

              <Card
                title={selectedSignal ? selectedSignal.title : "Selected signal"}
                description={
                  selectedSignal
                    ? `${selectedSignal.area} · ${selectedSignal.owner}`
                    : "Choose a field signal to inspect its operating detail."
                }
              >
                {selectedSignal ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div>{selectedSignal.projectName ?? "No project name attached"}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Detail</div>
                      <div>{selectedSignal.detail}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{signalWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{signalDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>{selectedSignal.nextAction}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Recommended module</div>
                      <div>{signalDestination.description}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Route summary</div>
                      <div>{signalRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream readiness</div>
                      <div className="tableCellStack">
                        <Badge tone={signalReadiness.tone}>{signalReadiness.label}</Badge>
                        <span className="tableCellMuted">{signalReadiness.summary}</span>
                        {signalReadiness.checks.map((check) => (
                          <span key={check} className="tableCellMuted">{check}</span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{signalHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
                      <div className="row gap wrap">
                        {signalOperationalLinks.map((link, index) => (
                          <Link key={link.href + link.label} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No signal selected" description="Choose a signal from the field list to inspect its handoff detail." />
                )}
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
                {projectsOverview ? (
                  <div className="detailGrid" style={{ marginBottom: 16 }}>
                    <div className="detailRow">
                      <div className="detailLabel">Project intake</div>
                      <div>{projectsOverview.projects.length} registered projects are already available for direct field capture.</div>
                    </div>
                  </div>
                ) : null}
                {createForm.mode === "material_request" ? (
                  <Card
                    title="Material Request Walkthrough"
                    description="This capture now travels into procurement so the tester can follow one continuous chain."
                    aside={<Badge tone="info">field to requisition to PO</Badge>}
                  >
                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">Step 1</div>
                        <div>Capture the shortage from the front with requested volume, budget and supplier coverage.</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Step 2</div>
                        <div>The system creates the linked requisition so procurement can continue sourcing or approval.</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Step 3</div>
                        <div>Continue into purchase orders and then receiving once supplier commitment is ready.</div>
                      </div>
                    </div>
                    <div className="row gap wrap" style={{ marginTop: 16 }}>
                      <Link className="buttonGhost" href="/procurement/requisitions">
                        Open requisitions
                      </Link>
                      <Link className="buttonGhost" href="/procurement/purchase-orders">
                        Open purchase orders
                      </Link>
                    </div>
                    <div className="detailGrid" style={{ marginTop: 16 }}>
                      <div className="detailRow">
                        <div className="detailLabel">Coverage check</div>
                        <div>{Number(createForm.supplierCoverage) || 0} supplier path(s) currently declared for this shortage.</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">Delivery checkpoint</div>
                        <div>The request should leave field only when the next action states who receives the material and where in the front it lands.</div>
                      </div>
                    </div>
                  </Card>
                ) : null}
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm((current) =>
                        createCaptureExample(
                          current.mode,
                          current.projectName || projectsOverview?.projects[0]?.name || "Proyecto central"
                        )
                      )
                    }
                  >
                    Load demo example
                  </button>
                  {followUpLinks.map((link) => (
                    <Link key={link.href} className="buttonGhost" href={link.href}>
                      {link.label}
                    </Link>
                  ))}
                </div>
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
                    {projectsOverview?.projects.length ? (
                      <select
                        className="selectField"
                        value={createForm.projectName}
                        onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                      >
                        {projectsOverview.projects.map((project) => (
                          <option key={project.id} value={project.name}>
                            {project.code} · {project.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="field"
                        value={createForm.projectName}
                        onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                        placeholder="Residencial Norte"
                      />
                    )}
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
                    {isCreating ? "Saving..." : createForm.mode === "material_request" ? "Create material request" : "Add field signal"}
                  </button>
                  <Link className="buttonGhost" href={nextDestination.href}>
                    {nextDestination.label}
                  </Link>
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
                      <Link className="buttonGhost" href="/procurement/purchase-orders">
                        Open purchase orders
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
                    <div>{visibleSignals.filter((signal) => signal.posture === "critical").length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Watch signals</div>
                    <div>{visibleSignals.filter((signal) => signal.posture === "watch").length}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Healthy signals</div>
                    <div>{visibleSignals.filter((signal) => signal.posture === "healthy").length}</div>
                  </div>
                </div>
              </Card>

              <Card title="Why it matters" description="This is where ARCONT starts feeling real for site teams, not only for office users.">
                <p className="sectionText">
                  The field layer now ties workforce, quality, materials, documentation and connectivity into one mobile-first operating view.
                </p>
              </Card>
            </section>
              </div>
            </details>
          </>
        ) : error ? (
          <EmptyState
            title="Field mobile view unavailable"
            description={error}
            primaryAction={{ label: "Open operations", href: "/operations" }}
            secondaryAction={{ label: "Review login", href: "/login" }}
          />
        ) : projectQuery ? (
          <EmptyState
            title={`No field signals for ${projectQuery}`}
            description="The selected project does not currently expose visible field, quality, equipment or document signals in this mobile layer."
            primaryAction={{ label: "Open all field signals", href: "/field" }}
            secondaryAction={{ label: "Review projects", href: "/projects" }}
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

export default function FieldPage() {
  return (
    <Suspense fallback={null}>
      <FieldPageContent />
    </Suspense>
  );
}
