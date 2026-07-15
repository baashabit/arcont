"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { ModuleGate } from "@/components/domain/module-gate";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { KpiCard } from "@/components/ui/kpi-card";
import type { DocumentControlItemContract, DocumentControlOverviewContract } from "@/lib/contracts";
import {
  createDocumentControlItem,
  fetchComplianceOverview,
  fetchDocumentControlOverview,
  fetchPostSaleOverview,
  updateDocumentControlItem
} from "@/lib/platform-api";

function healthTone(health: DocumentControlItemContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function documentHealthLabel(health: DocumentControlItemContract["health"]) {
  switch (health) {
    case "healthy":
      return { es: "Saludable", en: "Healthy" };
    case "watch":
      return { es: "En vigilancia", en: "Watch" };
    default:
      return { es: "Critico", en: "Critical" };
  }
}

function documentStatusLabel(status: DocumentControlItemContract["status"]) {
  switch (status) {
    case "issued":
      return { es: "Emitido", en: "Issued" };
    case "in_review":
      return { es: "En revision", en: "In review" };
    case "awaiting_response":
      return { es: "Esperando respuesta", en: "Awaiting response" };
    case "blocked":
      return { es: "Bloqueado", en: "Blocked" };
    default:
      return { es: "Aprobado", en: "Approved" };
  }
}

function documentActionLabel(label: string) {
  switch (label) {
    case "Resume review":
      return { es: "Retomar revision", en: "Resume review" };
    case "Start review":
      return { es: "Iniciar revision", en: "Start review" };
    case "Request response":
      return { es: "Solicitar respuesta", en: "Request response" };
    case "Approve item":
      return { es: "Aprobar item", en: "Approve item" };
    case "Block item":
      return { es: "Bloquear item", en: "Block item" };
    case "Return to review":
      return { es: "Volver a revision", en: "Return to review" };
    case "Approve response":
      return { es: "Aprobar respuesta", en: "Approve response" };
    case "Block response":
      return { es: "Bloquear respuesta", en: "Block response" };
    default:
      return { es: label, en: label };
  }
}

function documentLinkLabel(label: string) {
  switch (label) {
    case "Open quality":
      return { es: "Abrir calidad", en: "Open quality" };
    case "Open compliance":
      return { es: "Abrir compliance", en: "Open compliance" };
    case "Open projects":
      return { es: "Abrir proyectos", en: "Open projects" };
    case "Open post-sale":
      return { es: "Abrir postventa", en: "Open post-sale" };
    default:
      return { es: label, en: label };
  }
}

function normalizeDocumentFeedbackCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveDocumentFeedbackCopy(message: string | null) {
  if (!message) {
    return null;
  }

  switch (normalizeDocumentFeedbackCode(message)) {
    case "DOCUMENT_NEXT_ACTION_TOO_SHORT":
      return {
        es: "La siguiente accion debe ser mas especifica antes de guardar este documento.",
        en: "The next action must be more specific before saving this document item."
      };
    case "DOCUMENT_CREATE_FIELDS_INCOMPLETE":
      return {
        es: "Tipo, asunto, proyecto y responsable deben quedar claros antes de crear el item.",
        en: "Type, subject, project and owner must be clear before creating the item."
      };
    case "DOCUMENT_CREATE_NUMBERS_INVALID":
      return {
        es: "Revisiones, dias de respuesta y comentarios abiertos deben ser cero o mayores.",
        en: "Revisions, turnaround days and open comments must be zero or greater."
      };
    case "DOCUMENT_CREATE_APPROVED_BLOCKED":
      return {
        es: "Un item documental no puede nacer ya aprobado.",
        en: "A document item cannot be created already approved."
      };
    case "DOCUMENT_CREATE_HEALTH_CONFLICT":
      return {
        es: "No puede quedar saludable mientras existan comentarios abiertos.",
        en: "It cannot be marked healthy while open comments still exist."
      };
    case "DOCUMENT_CREATE_AWAITING_RESPONSE_REQUIRES_COMMENTS":
      return {
        es: "Esperando respuesta requiere al menos un comentario abierto.",
        en: "Awaiting response requires at least one open comment."
      };
    case "DOCUMENT_ITEM_UPDATE_FAILED":
      return {
        es: "No fue posible actualizar el item documental. Revisa la conexion e intenta de nuevo.",
        en: "The document item could not be updated. Check the connection and try again."
      };
    case "DOCUMENT_ITEM_CREATE_FAILED":
      return {
        es: "No fue posible crear el item documental. Revisa los datos e intenta de nuevo.",
        en: "The document item could not be created. Review the details and try again."
      };
    case "DOCUMENT_ITEM_MOVED_TO_IN_REVIEW":
      return {
        es: "El item paso a revision tecnica.",
        en: "The item moved into technical review."
      };
    case "DOCUMENT_ITEM_MOVED_TO_AWAITING_RESPONSE":
      return {
        es: "El item quedo esperando respuesta formal.",
        en: "The item is now waiting for a formal response."
      };
    case "DOCUMENT_ITEM_MOVED_TO_BLOCKED":
      return {
        es: "El item quedo bloqueado para atencion inmediata.",
        en: "The item is now blocked for immediate attention."
      };
    case "DOCUMENT_ITEM_MOVED_TO_APPROVED":
      return {
        es: "El item fue aprobado y puede continuar aguas abajo.",
        en: "The item was approved and can continue downstream."
      };
    case "DOCUMENT_ITEM_CREATED":
      return {
        es: "El item documental se agrego correctamente a la bandeja operativa.",
        en: "The document item was added successfully to the operating board."
      };
    default:
      return { es: message, en: message };
  }
}

function documentActionOptions(item: DocumentControlItemContract) {
  switch (item.status) {
    case "blocked":
      return [
        {
          label: "Resume review",
          status: "in_review" as const,
          nextAction: "Resume technical review and align the pending coordination response"
        }
      ];
    case "issued":
      return [
        {
          label: "Start review",
          status: "in_review" as const,
          nextAction: "Route issue to reviewers and capture the first consolidated comments"
        }
      ];
    case "in_review":
      return [
        {
          label: "Request response",
          status: "awaiting_response" as const,
          nextAction: "Send review comments and wait for formal answer or reissue"
        },
        {
          label: "Approve item",
          status: "approved" as const,
          nextAction: "Close review loop and keep approval evidence attached to the package"
        },
        {
          label: "Block item",
          status: "blocked" as const,
          nextAction: "Pause workflow and escalate the coordination blocker"
        }
      ];
    case "awaiting_response":
      return [
        {
          label: "Return to review",
          status: "in_review" as const,
          nextAction: "Resume review after receiving the updated response package"
        },
        {
          label: "Approve response",
          status: "approved" as const,
          nextAction: "Accept response and archive final approval evidence"
        },
        {
          label: "Block response",
          status: "blocked" as const,
          nextAction: "Stop the response loop and escalate the unresolved blocker"
        }
      ];
    default:
      return [];
  }
}

type DocumentBridgeContext = {
  compliance: NonNullable<Awaited<ReturnType<typeof fetchComplianceOverview>>>;
  postSale: NonNullable<Awaited<ReturnType<typeof fetchPostSaleOverview>>>;
} | null;

type DocumentOperationalSeed = Pick<
  DocumentControlItemContract,
  "documentType" | "subject" | "projectName" | "owner" | "status" | "openComments" | "health" | "nextAction"
>;

type DocumentModuleHref = "/quality" | "/compliance" | "/projects" | "/post-sale";

function findRelatedComplianceCase(seed: Pick<DocumentOperationalSeed, "projectName" | "subject">, bridge: DocumentBridgeContext) {
  return (
    bridge?.compliance.cases.find(
      (candidate) =>
        candidate.subject.includes(seed.projectName) ||
        candidate.unitOrContract.includes(seed.projectName) ||
        seed.subject.includes(candidate.queueName)
    ) ??
    bridge?.compliance.focusCase ??
    null
  );
}

function findRelatedPostSaleItem(seed: Pick<DocumentOperationalSeed, "projectName" | "subject">, bridge: DocumentBridgeContext) {
  return (
    bridge?.postSale.items.find(
      (candidate) => candidate.projectName === seed.projectName || seed.subject.includes(candidate.assetLabel) || seed.subject.includes(candidate.customerName)
    ) ??
    bridge?.postSale.focusItem ??
    null
  );
}

function buildDocumentQualityArea(seed: DocumentOperationalSeed) {
  if (seed.subject.trim().length >= 3) {
    return seed.subject;
  }

  return `${seed.projectName} · ${seed.documentType}`;
}

function buildDocumentQualityChecklist(seed: DocumentOperationalSeed) {
  if (seed.documentType.toLowerCase() === "rfi") {
    return "Liberacion por RFI";
  }

  if (seed.documentType.toLowerCase() === "submittal") {
    return "Liberacion por submittal";
  }

  return `${seed.documentType} operativo`;
}

function buildDocumentModuleHref(target: DocumentModuleHref, seed: DocumentOperationalSeed, bridge: DocumentBridgeContext) {
  const params = new URLSearchParams();
  const relatedCompliance = findRelatedComplianceCase(seed, bridge);
  const relatedPostSale = findRelatedPostSaleItem(seed, bridge);

  switch (target) {
    case "/quality":
      params.set("source", "document-control");
      params.set("project", seed.projectName);
      params.set("projectName", seed.projectName);
      params.set("areaName", buildDocumentQualityArea(seed));
      params.set("checklistName", buildDocumentQualityChecklist(seed));
      params.set("contractorName", seed.owner);
      params.set("nextAction", seed.nextAction);
      break;
    case "/compliance":
      params.set("source", "document-control");
      params.set("projectName", seed.projectName);
      params.set("subject", relatedCompliance?.subject ?? seed.subject);
      params.set("owner", relatedCompliance?.owner ?? seed.owner);
      params.set("nextAction", seed.nextAction);
      if (relatedPostSale) {
        params.set("assetLabel", relatedPostSale.assetLabel);
        params.set("customerName", relatedPostSale.customerName);
      }
      break;
    case "/projects":
      params.set("projectName", seed.projectName);
      params.set("scheduleActivityName", seed.subject);
      params.set("schedulePhase", seed.documentType);
      params.set("scheduleOwner", seed.owner);
      params.set("scheduleNextAction", seed.nextAction);
      break;
    case "/post-sale":
      params.set("source", "document-control");
      params.set("projectName", seed.projectName);
      params.set("subject", seed.subject);
      params.set("owner", seed.owner);
      params.set("nextAction", seed.nextAction);
      if (relatedPostSale) {
        params.set("assetLabel", relatedPostSale.assetLabel);
        params.set("customerName", relatedPostSale.customerName);
      }
      break;
  }

  const query = params.toString();
  return query.length > 0 ? `${target}?${query}` : target;
}

function buildDocumentBridge(item: DocumentControlItemContract | null, bridge: DocumentBridgeContext) {
  if (!item) {
    return null;
  }

  const relatedCompliance = findRelatedComplianceCase(item, bridge);
  const relatedPostSale = findRelatedPostSaleItem(item, bridge);

  return {
    coordinationSignal:
      item.openComments > 0
        ? `${item.openComments} comments and ${item.revisionCount} revisions still keep coordination active.`
        : "Comment backlog is contained and the item is close to documentary release.",
    complianceSignal: relatedCompliance
      ? `${relatedCompliance.subject} remains at ${relatedCompliance.documentCompletion}% completion with ${relatedCompliance.openFindings} findings open.`
      : "No linked compliance folder is mapped for this controlled document yet.",
    deliverySignal: relatedPostSale
      ? `${relatedPostSale.customerName} still depends on a ${relatedPostSale.caseType} case in ${relatedPostSale.status} state.`
      : "No linked post-sale or handover case is mapped for this controlled document yet."
  };
}

function validateDocumentCreateForm(input: {
  documentType: string;
  subject: string;
  projectName: string;
  owner: string;
  revisionCount: number;
  turnaroundDays: number;
  openComments: number;
  nextAction: string;
  status: DocumentControlItemContract["status"];
  health: DocumentControlItemContract["health"];
}) {
  if ([input.documentType, input.subject, input.projectName, input.owner].some((value) => value.trim().length < 3)) {
    return "DOCUMENT_CREATE_FIELDS_INCOMPLETE";
  }

  if ([input.revisionCount, input.turnaroundDays, input.openComments].some((value) => !Number.isFinite(value) || value < 0)) {
    return "DOCUMENT_CREATE_NUMBERS_INVALID";
  }

  if (input.nextAction.trim().length < 8) {
    return "DOCUMENT_NEXT_ACTION_TOO_SHORT";
  }

  if (input.status === "approved") {
    return "DOCUMENT_CREATE_APPROVED_BLOCKED";
  }

  if (input.openComments > 0 && input.health === "healthy") {
    return "DOCUMENT_CREATE_HEALTH_CONFLICT";
  }

  if (input.status === "awaiting_response" && input.openComments === 0) {
    return "DOCUMENT_CREATE_AWAITING_RESPONSE_REQUIRES_COMMENTS";
  }

  return null;
}

function createDocumentExample() {
  return {
    documentType: "RFI",
    subject: "Interferencia entre estructura e instalaciones en nivel 4",
    projectName: "Torre Demo Acabados",
    owner: "Project coordination",
    status: "issued" as DocumentControlItemContract["status"],
    revisionCount: "0",
    turnaroundDays: "2",
    openComments: "3",
    health: "watch" as DocumentControlItemContract["health"],
    nextAction: "Emitir RFI consolidado y escalar revision tecnica antes del siguiente corte de obra."
  };
}

function buildDocumentContinuityGate(item: DocumentControlItemContract | null) {
  if (!item) {
    return {
      tone: "info" as const,
      label: "No item selected",
      summary: "Choose a document-control item to verify whether it can really continue through review, response or approval.",
      checks: ["Select an item from the current coordination board."]
    };
  }

  const checks: string[] = [];

  if (item.status === "blocked") {
    checks.push("Item is already blocked in coordination flow.");
  }

  if (item.openComments > 0 && item.status === "approved") {
    checks.push("Approved posture conflicts with open comments.");
  }

  if (item.openComments > 0) {
    checks.push(`${item.openComments} comment(s) still remain open.`);
  }

  if (item.turnaroundDays > 10) {
    checks.push(`Turnaround has already stretched to ${item.turnaroundDays} days.`);
  }

  if (item.health === "critical") {
    checks.push("Health posture is critical and still needs coordination recovery.");
  }

  if (checks.length > 0) {
    return {
      tone:
        item.status === "blocked" || item.health === "critical"
          ? "danger" as const
          : "warning" as const,
      label:
        item.status === "blocked" || item.health === "critical"
          ? "Do not advance yet"
          : "Advance with control",
      summary:
        item.status === "blocked" || item.health === "critical"
          ? "The document item still has hard coordination blockers before it should continue downstream."
          : "The item can continue, but review debt or response aging still needs closure first.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready for continuity",
    summary: "Comments, turnaround and health posture are aligned for clean coordination continuity.",
    checks: [
      "Continue into projects, quality or compliance without rebuilding the same issue context.",
      "Keep the same owner and next action attached to the live document item."
    ]
  };
}

function buildDocumentHumanStep(item: DocumentControlItemContract | null) {
  if (!item) {
    return "Select an item to identify the next human move.";
  }

  if (item.status === "blocked") {
    return "Unblock the coordination issue first, then return to review with a concrete response owner.";
  }

  if (item.openComments > 0 || item.status === "awaiting_response") {
    return "Close comment ownership, chase the pending response and re-enter review in the same operating cycle.";
  }

  return "Confirm the final approval owner and archive the release evidence while the response context is still current.";
}

function buildDocumentWhyNow(item: DocumentControlItemContract | null) {
  if (!item) {
    return "Choose a document item to understand why document control should care right now.";
  }

  if (item.status === "blocked" || item.health === "critical") {
    return `${item.code} is effectively blocked, so unresolved document flow here can immediately distort release, customer handover or field continuity.`;
  }

  if (item.openComments > 0) {
    return `${item.code} still carries ${item.openComments} open comments, so acting now prevents the team from normalizing unresolved review debt.`;
  }

  if (item.status === "awaiting_response") {
    return `${item.code} is still waiting on response, so delay here can turn a solvable coordination item into a cross-domain blocker.`;
  }

  return `${item.code} is still operationally active, so document control should protect continuity before another team starts working from stale or incomplete evidence.`;
}

function buildDocumentDownstreamEffect(item: DocumentControlItemContract | null) {
  if (!item) {
    return "Select a document item to inspect what it can block downstream.";
  }

  if (item.status === "blocked" || item.health === "critical" || item.openComments > 0) {
    return "The downstream effect is release delay, compliance friction and weaker handover confidence across projects and quality.";
  }

  if (item.status === "awaiting_response") {
    return "A slow response here can propagate into project continuity, quality release and warranty or customer delivery timing.";
  }

  return "The downstream effect is mainly traceability discipline: keep quality, compliance and delivery teams aligned around the same controlled document context.";
}

function buildDocumentReportBack(item: DocumentControlItemContract | null) {
  if (!item) {
    return "Choose a document item to define the next report-back window.";
  }

  if (item.status === "blocked" || item.health === "critical" || item.openComments > 0) {
    return "Report back before the next release or handover cutoff with comment closure status and the exact response owner.";
  }

  if (item.status === "awaiting_response") {
    return "Report back in the same operating cycle once the missing response is explicit enough to move the item forward.";
  }

  return "Report back at the next document-control refresh confirming the item stayed healthy through review and delivery follow-through.";
}

function buildDocumentRouteSummary(item: DocumentControlItemContract | null) {
  if (!item) {
    return "Use document control as the coordination lane between review comments, technical answers, compliance and final delivery traceability.";
  }

  if (item.status === "blocked" || item.health === "critical") {
    return "This item should route first through coordination recovery before quality, compliance or delivery keep depending on it.";
  }

  if (item.openComments > 0 || item.status === "awaiting_response") {
    return "This item should route through comment closure and formal response before downstream teams assume the package is stable.";
  }

  return "This item can continue through compliance, projects or post-sale with the current controlled-document context intact.";
}

function buildDocumentOperationalLinks(item: DocumentControlItemContract | null, bridge: DocumentBridgeContext) {
  if (!item) {
    return [
      { label: "Open quality", href: "/quality" },
      { label: "Open compliance", href: "/compliance" },
      { label: "Open projects", href: "/projects" }
    ];
  }

  if (item.status === "blocked" || item.health === "critical") {
    return [
      { label: "Open quality", href: buildDocumentModuleHref("/quality", item, bridge) },
      { label: "Open projects", href: buildDocumentModuleHref("/projects", item, bridge) },
      { label: "Open compliance", href: buildDocumentModuleHref("/compliance", item, bridge) }
    ];
  }

  if (item.openComments > 0 || item.status === "awaiting_response") {
    return [
      { label: "Open compliance", href: buildDocumentModuleHref("/compliance", item, bridge) },
      { label: "Open quality", href: buildDocumentModuleHref("/quality", item, bridge) },
      { label: "Open post-sale", href: buildDocumentModuleHref("/post-sale", item, bridge) }
    ];
  }

  return [
    { label: "Open compliance", href: buildDocumentModuleHref("/compliance", item, bridge) },
    { label: "Open post-sale", href: buildDocumentModuleHref("/post-sale", item, bridge) },
    { label: "Open projects", href: buildDocumentModuleHref("/projects", item, bridge) }
  ];
}

function buildDocumentRoutingDesk(item: DocumentControlItemContract | null) {
  if (!item) {
    return {
      primaryLabel: { es: "Calidad", en: "Quality" },
      primaryReason: {
        es: "Selecciona un item para aclarar qué dominio debe absorber primero la presión documental.",
        en: "Select an item to clarify which domain should absorb document pressure first."
      },
      secondaryLabel: { es: "Cumplimiento", en: "Compliance" },
      secondaryReason: {
        es: "Después del dominio fuente, la continuidad debe conservar cumplimiento y trazabilidad del expediente.",
        en: "After the source domain, continuity should preserve compliance and dossier traceability."
      },
      returnRule: {
        es: "Regresa con dueño, respuesta y condición de continuidad ya confirmados.",
        en: "Return with owner, response and continuity condition already confirmed."
      }
    };
  }

  if (item.status === "blocked" || item.health === "critical") {
    return {
      primaryLabel: { es: "Calidad", en: "Quality" },
      primaryReason: {
        es: "El bloqueo documental primero debe aclararse contra la restricción técnica o de liberación que lo mantiene vivo.",
        en: "The document blocker should first be clarified against the technical or release constraint keeping it alive."
      },
      secondaryLabel: { es: "Proyectos", en: "Projects" },
      secondaryReason: {
        es: "Después de calidad, proyecto debe proteger secuencia, frente y responsable operativo sin perder el mismo contexto.",
        en: "After quality, projects should protect sequence, work front and operating owner without losing the same context."
      },
      returnRule: {
        es: "Regresa con el bloqueo técnico contenido, el responsable activo y la ruta exacta para retomar revisión o respuesta.",
        en: "Return with the technical blocker contained, the active owner confirmed and the exact path to resume review or response."
      }
    };
  }

  if (item.openComments > 0 || item.status === "awaiting_response") {
    return {
      primaryLabel: { es: "Cumplimiento", en: "Compliance" },
      primaryReason: {
        es: "Los comentarios abiertos o la respuesta pendiente ya comprometen la defensa del expediente y deben cerrarse con disciplina formal.",
        en: "Open comments or a pending response are already compromising dossier defensibility and should close under formal discipline."
      },
      secondaryLabel: { es: "Calidad", en: "Quality" },
      secondaryReason: {
        es: "Después de cumplimiento, calidad debe confirmar que la respuesta técnica realmente cierra lo observado.",
        en: "After compliance, quality should confirm the technical response actually closes what was observed."
      },
      returnRule: {
        es: "Regresa con comentarios cerrados o con la respuesta formal recibida, responsable visible y siguiente revisión ya calendarizada.",
        en: "Return with comments closed or the formal response received, the owner visible and the next review already scheduled."
      }
    };
  }

  return {
    primaryLabel: { es: "Cumplimiento", en: "Compliance" },
    primaryReason: {
      es: "El paquete ya está estable y ahora la presión principal es sostener aprobación, expediente y liberación formal.",
      en: "The package is already stable and the main pressure is now sustaining approval, dossier integrity and formal release."
    },
    secondaryLabel: { es: "Postventa", en: "Post-sale" },
    secondaryReason: {
      es: "Después de la liberación, postventa o entrega debe absorber la continuidad sin rehacer la historia documental.",
      en: "After release, post-sale or handover should absorb continuity without rebuilding the document story."
    },
    returnRule: {
      es: "Regresa con aprobación defendible, evidencia archivada y el siguiente frente receptor ya enterado.",
      en: "Return with defensible approval, archived evidence and the next receiving lane already informed."
    }
  };
}

function buildCreateDocumentOperationalLinks(input: DocumentOperationalSeed, bridge: DocumentBridgeContext) {
  const hasContext = [input.projectName, input.subject, input.owner].every((value) => value.trim().length >= 3) && input.nextAction.trim().length >= 8;

  if (!hasContext) {
    return [
      { label: "Open projects", href: "/projects" },
      { label: "Open quality", href: "/quality" },
      { label: "Open compliance", href: "/compliance" }
    ];
  }

  return [
    { label: "Open projects", href: buildDocumentModuleHref("/projects", input, bridge) },
    { label: "Open quality", href: buildDocumentModuleHref("/quality", input, bridge) },
    { label: "Open compliance", href: buildDocumentModuleHref("/compliance", input, bridge) }
  ];
}

function buildCreateDocumentGate(input: {
  documentType: string;
  subject: string;
  projectName: string;
  owner: string;
  status: DocumentControlItemContract["status"];
  revisionCount: number;
  turnaroundDays: number;
  openComments: number;
  health: DocumentControlItemContract["health"];
  nextAction: string;
}) {
  const checks: string[] = [];

  if ([input.documentType, input.subject, input.projectName, input.owner].some((value) => value.trim().length < 3)) {
    checks.push("Document type, subject, project and owner still need more specific capture.");
  }

  if ([input.revisionCount, input.turnaroundDays, input.openComments].some((value) => !Number.isFinite(value) || value < 0)) {
    checks.push("Revisions, turnaround days and open comments must be zero or greater.");
  }

  if (input.status === "approved") {
    checks.push("Document items cannot start as approved.");
  }

  if (input.openComments > 0 && input.health === "healthy") {
    checks.push("Healthy status is blocked while open comments remain active.");
  }

  if (input.status === "awaiting_response" && input.openComments === 0) {
    checks.push("Awaiting response requires at least one open comment.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for coordination or response follow-through.");
  }

  if (checks.length > 0) {
    const hardBlock =
      input.status === "approved" ||
      (input.openComments > 0 && input.health === "healthy") ||
      (input.status === "awaiting_response" && input.openComments === 0);

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "The document intake still breaks core traceability rules before it should become a live item."
        : "The item can be created, but coordination should tighten ownership before downstream continuity depends on it.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The intake is coherent enough to become a live technical coordination item.",
    checks: [
      "The created item should be immediately usable by projects, quality or compliance without repeating the same story.",
      "Keep the same owner and next action attached to the live document item."
    ]
  };
}

function buildCreateDocumentHumanStep(input: {
  status: DocumentControlItemContract["status"];
  openComments: number;
  turnaroundDays: number;
  health: DocumentControlItemContract["health"];
  nextAction: string;
}) {
  if (input.status === "awaiting_response" && input.openComments <= 0) {
    return "Add the pending comment or response gap first so the item has a real downstream reason to exist.";
  }

  if (input.openComments > 0 || input.health === "critical") {
    return "Create the item and immediately assign comment ownership so projects, quality or compliance can continue without guessing.";
  }

  if (input.turnaroundDays > 10) {
    return "Clarify who owns the delayed turnaround before the item is normalized into technical debt.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Make the next action more specific before persisting the item.";
  }

  return "Create the item and continue into the exact downstream owner while the technical context is still current.";
}

function DocumentControlPageContent() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const t = (es: string, en: string) => localizeText({ es, en });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefillSignatureRef = useRef<string | null>(null);
  const [overview, setOverview] = useState<DocumentControlOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<DocumentBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | DocumentControlItemContract["health"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>("all");
  const [createForm, setCreateForm] = useState({
    documentType: "RFI",
    subject: "",
    projectName: "Proyecto central",
    owner: "Project coordination",
    status: "issued" as DocumentControlItemContract["status"],
    revisionCount: "0",
    turnaroundDays: "0",
    openComments: "0",
    health: "watch" as DocumentControlItemContract["health"],
    nextAction: ""
  });
  const createFormNumbers = useMemo(
    () => ({
      revisionCount: Number(createForm.revisionCount),
      turnaroundDays: Number(createForm.turnaroundDays),
      openComments: Number(createForm.openComments)
    }),
    [createForm.openComments, createForm.revisionCount, createForm.turnaroundDays]
  );

  useEffect(() => {
    const project = searchParams.get("project");
    const documentType = searchParams.get("documentType");
    setProjectFilter(project && project.length > 0 ? project : "all");
    setDocumentTypeFilter(documentType && documentType.length > 0 ? documentType : "all");
  }, [searchParams]);

  useEffect(() => {
    const source = searchParams.get("source");
    const projectName = searchParams.get("projectName")?.trim() ?? "";
    const documentType = searchParams.get("documentType")?.trim() ?? "";
    const subject = searchParams.get("subject")?.trim() ?? "";
    const owner = searchParams.get("owner")?.trim() ?? "";
    const nextAction = searchParams.get("nextAction")?.trim() ?? "";

    if (source !== "quality" && source !== "post-sale") {
      return;
    }

    const signature = JSON.stringify({
      source,
      projectName,
      documentType,
      subject,
      owner,
      nextAction
    });

    if (prefillSignatureRef.current === signature) {
      return;
    }

    if (![projectName, documentType, subject, owner, nextAction].some((value) => value.length > 0)) {
      return;
    }

    prefillSignatureRef.current = signature;
    setCreateForm((current) => ({
      ...current,
      documentType: documentType || current.documentType,
      subject: subject || current.subject,
      projectName: projectName || current.projectName,
      owner: owner || current.owner,
      nextAction: nextAction || current.nextAction
    }));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchDocumentControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchComplianceOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchPostSaleOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, compliance, postSale]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Document control overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedItemId((current) => current ?? result.focusItem?.id ?? result.items[0]?.id ?? null);
        setBridgeContext(compliance && postSale ? { compliance, postSale } : null);
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

    return Array.from(new Set(overview.items.map((item) => item.projectName))).sort((left, right) => left.localeCompare(right));
  }, [overview]);

  const documentTypeOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.items.map((item) => item.documentType))).sort((left, right) => left.localeCompare(right));
  }, [overview]);

  const filteredItems = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.items.filter(
      (item) =>
        (projectFilter === "all" || item.projectName === projectFilter) &&
        (documentTypeFilter === "all" || item.documentType === documentTypeFilter) &&
        (healthFilter === "all" || item.health === healthFilter) &&
        (normalizedSearch.length === 0 ||
          item.subject.toLowerCase().includes(normalizedSearch) ||
          item.code.toLowerCase().includes(normalizedSearch) ||
          item.owner.toLowerCase().includes(normalizedSearch) ||
          item.nextAction.toLowerCase().includes(normalizedSearch))
    );
  }, [documentTypeFilter, healthFilter, overview, projectFilter, searchFilter]);

  const filteredSummary = useMemo(() => {
    const openRfis = filteredItems.filter((item) => item.documentType === "RFI" && item.status !== "approved").length;
    const activeSubmittals = filteredItems.filter((item) => item.documentType === "Submittal" && item.status !== "approved").length;
    const controlledVersions = filteredItems.reduce((sum, item) => sum + item.revisionCount, 0);
    const averageTurnaroundDays =
      filteredItems.length > 0 ? Number((filteredItems.reduce((sum, item) => sum + item.turnaroundDays, 0) / filteredItems.length).toFixed(1)) : 0;

    return {
      openRfis,
      activeSubmittals,
      controlledVersions,
      averageTurnaroundDays
    };
  }, [filteredItems]);

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedItemId]
  );


  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.itemId === selectedItem?.id) ?? [],
    [overview, selectedItem]
  );

  const filteredRisks = useMemo(() => {
    if (!overview) {
      return [];
    }

    return overview.risks.filter((risk) => {
      const parent = overview.items.find((item) => item.id === risk.itemId);
      return (
        (!!parent && (projectFilter === "all" || parent.projectName === projectFilter)) &&
        (!!parent && (documentTypeFilter === "all" || parent.documentType === documentTypeFilter))
      );
    });
  }, [documentTypeFilter, overview, projectFilter]);

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
    const nextParams = new URLSearchParams(searchParams.toString());

    if (projectFilter === "all") {
      nextParams.delete("project");
    } else {
      nextParams.set("project", projectFilter);
    }

    if (documentTypeFilter === "all") {
      nextParams.delete("documentType");
    } else {
      nextParams.set("documentType", documentTypeFilter);
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [documentTypeFilter, pathname, projectFilter, router, searchParams]);

  const selectedStory = useMemo(() => buildDocumentBridge(selectedItem, bridgeContext), [bridgeContext, selectedItem]);
  const documentContinuityGate = useMemo(() => buildDocumentContinuityGate(selectedItem), [selectedItem]);
  const documentHumanStep = useMemo(() => buildDocumentHumanStep(selectedItem), [selectedItem]);
  const documentWhyNow = useMemo(() => buildDocumentWhyNow(selectedItem), [selectedItem]);
  const documentDownstreamEffect = useMemo(() => buildDocumentDownstreamEffect(selectedItem), [selectedItem]);
  const documentReportBack = useMemo(() => buildDocumentReportBack(selectedItem), [selectedItem]);
  const documentRouteSummary = useMemo(() => buildDocumentRouteSummary(selectedItem), [selectedItem]);
  const documentOperationalLinks = useMemo(() => buildDocumentOperationalLinks(selectedItem, bridgeContext), [bridgeContext, selectedItem]);
  const documentRoutingDesk = useMemo(() => buildDocumentRoutingDesk(selectedItem), [selectedItem]);
  const documentActionFeedback = useMemo(() => resolveDocumentFeedbackCopy(actionMessage), [actionMessage]);
  const documentErrorFeedback = useMemo(() => resolveDocumentFeedbackCopy(actionError), [actionError]);
  const documentCreateFeedback = useMemo(() => resolveDocumentFeedbackCopy(createMessage), [createMessage]);
  const createDocumentGate = useMemo(
    () =>
      buildCreateDocumentGate({
        documentType: createForm.documentType,
        subject: createForm.subject,
        projectName: createForm.projectName,
        owner: createForm.owner,
        status: createForm.status,
        revisionCount: createFormNumbers.revisionCount,
        turnaroundDays: createFormNumbers.turnaroundDays,
        openComments: createFormNumbers.openComments,
        health: createForm.health,
        nextAction: createForm.nextAction
      }),
    [createForm, createFormNumbers]
  );
  const createDocumentHumanStep = useMemo(
    () =>
      buildCreateDocumentHumanStep({
        status: createForm.status,
        openComments: createFormNumbers.openComments,
        turnaroundDays: createFormNumbers.turnaroundDays,
        health: createForm.health,
        nextAction: createForm.nextAction
      }),
    [createForm.health, createForm.nextAction, createForm.status, createFormNumbers]
  );
  const createDocumentOperationalLinks = useMemo(
    () =>
      buildCreateDocumentOperationalLinks(
        {
          documentType: createForm.documentType,
          subject: createForm.subject,
          projectName: createForm.projectName,
          owner: createForm.owner,
          status: createForm.status,
          openComments: createFormNumbers.openComments,
          health: createForm.health,
          nextAction: createForm.nextAction
        },
        bridgeContext
      ),
    [bridgeContext, createForm, createFormNumbers.openComments]
  );

  const actionOptions = useMemo(() => (selectedItem ? documentActionOptions(selectedItem) : []), [selectedItem]);

  useEffect(() => {
    setNextActionDraft(selectedItem?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedItemId, selectedItem?.id, selectedItem?.nextAction]);

  async function handleItemAction(status: DocumentControlItemContract["status"], suggestedNextAction: string) {
    if (!selectedItem) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("DOCUMENT_NEXT_ACTION_TOO_SHORT");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateDocumentControlItem(
      selectedItem.id,
      activeCompany.id,
      {
        status,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.code ?? response.error?.message ?? "DOCUMENT_ITEM_UPDATE_FAILED");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === response.data?.id ? response.data : item));
      const openRfis = items.filter((item) => item.documentType === "RFI" && item.status !== "approved").length;
      const activeSubmittals = items.filter((item) => item.documentType === "Submittal" && item.status !== "approved").length;
      const controlledVersions = items.reduce((sum, item) => sum + item.revisionCount, 0);
      const averageTurnaroundDays =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.turnaroundDays, 0) / items.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          openRfis,
          activeSubmittals,
          controlledVersions,
          averageTurnaroundDays
        },
        items,
        focusItem: current.focusItem?.id === response.data?.id ? response.data : current.focusItem
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(`DOCUMENT_ITEM_MOVED_TO_${response.data.status.toUpperCase()}`);
    setIsSaving(false);
  }

  async function handleCreateItem() {
    if (!overview) {
      return;
    }

    const documentType = createForm.documentType.trim();
    const subject = createForm.subject.trim();
    const projectName = createForm.projectName.trim();
    const owner = createForm.owner.trim();
    const nextAction = createForm.nextAction.trim();
    const revisionCount = Number(createForm.revisionCount);
    const turnaroundDays = Number(createForm.turnaroundDays);
    const openComments = Number(createForm.openComments);

    const validation = validateDocumentCreateForm({
      documentType,
      subject,
      projectName,
      owner,
      revisionCount,
      turnaroundDays,
      openComments,
      nextAction,
      status: createForm.status,
      health: createForm.health
    });
    if (validation) {
      setActionError(validation);
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createDocumentControlItem(
      activeCompany.id,
      {
        documentType,
        subject,
        projectName,
        owner,
        status: createForm.status,
        revisionCount,
        turnaroundDays,
        openComments,
        health: createForm.health,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.code ?? response.error?.message ?? "DOCUMENT_ITEM_CREATE_FAILED");
      setIsCreating(false);
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = [created, ...current.items];
      const openRfis = items.filter((item) => item.documentType === "RFI" && item.status !== "approved").length;
      const activeSubmittals = items.filter((item) => item.documentType === "Submittal" && item.status !== "approved").length;
      const controlledVersions = items.reduce((sum, item) => sum + item.revisionCount, 0);
      const averageTurnaroundDays =
        items.length > 0 ? Number((items.reduce((sum, item) => sum + item.turnaroundDays, 0) / items.length).toFixed(1)) : 0;

      return {
        ...current,
        summary: {
          openRfis,
          activeSubmittals,
          controlledVersions,
          averageTurnaroundDays
        },
        items,
        focusItem: created
      };
    });
    setSelectedItemId(created.id);
    setNextActionDraft(created.nextAction);
    setCreateMessage("DOCUMENT_ITEM_CREATED");
    setCreateForm({
      documentType,
      subject: "",
      projectName,
      owner,
      status: "issued",
      revisionCount: "0",
      turnaroundDays: "0",
      openComments: "0",
      health: "watch",
      nextAction: ""
    });
    setIsCreating(false);
  }

  return (
    <AppShell
      title={t("Control documental y RFI", "Document control and RFI")}
      eyebrow={t("Coordinacion de proyecto", "Project coordination")}
      description={t(
        "Versiones, RFIs, submittals y aprobaciones conectadas con coordinacion real de obra y trazabilidad documental.",
        "Versions, RFIs, submittals and approvals tied to live field coordination and document traceability."
      )}
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title={t("Control documental", "Document control")}>
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label={t("RFIs abiertos", "Open RFIs")}
                value={String(filteredSummary.openRfis)}
                footnote={t("RFIs todavia pendientes de resolucion o respuesta formal.", "RFIs still awaiting resolution or formal response.")}
              />
              <KpiCard
                label={t("Submittals activos", "Active submittals")}
                value={String(filteredSummary.activeSubmittals)}
                footnote={t("Submittals tecnicos hoy moviendose en revision.", "Technical submittals currently moving through review.")}
              />
              <KpiCard
                label={t("Versiones controladas", "Controlled versions")}
                value={String(filteredSummary.controlledVersions)}
                footnote={t("Conteo de revisiones que representa el flujo documental activo.", "Revision count representing active document control flow.")}
              />
              <KpiCard
                label={t("Respuesta", "Turnaround")}
                value={`${filteredSummary.averageTurnaroundDays} d`}
                footnote={t("Promedio actual de respuesta en la bandeja documental.", "Average current response time across document-control items.")}
              />
            </section>

            {isDemoMode ? (
              <Card
                title={t("Modo demo operable", "Operable demo mode")}
                description={t(
                  "Puedes crear y mover RFIs o submittals localmente para probar la coordinacion sin depender todavia del auth productivo.",
                  "You can create and move RFIs or submittals locally to test coordination without depending on production auth yet."
                )}
                aside={<Badge tone="warning">{t("persistido en navegador", "browser persisted")}</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">{t("Que ya funciona", "What already works")}</div>
                    <div>
                      {t(
                        "Crea RFIs o submittals, muevelos entre estados de revision y valida reglas de comentarios, respuesta y continuidad.",
                        "Create RFIs or submittals, move them across review states, and validate comment, response and continuity rules."
                      )}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Prueba recomendada", "Recommended test")}</div>
                    <div>
                      {t(
                        "Crea un nuevo RFI para un proyecto activo, envialo a revision y luego verifica su impacto operativo desde Dashboard u Operations.",
                        "Create a new RFI for an active project, send it to review, then inspect its operating impact from Dashboard or Operations."
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols1">
              <Card
                title={t("Flujo de coordinacion tecnica", "Technical coordination flow")}
                description={t(
                  "Esta pantalla ya debe permitir levantar, revisar y enrutar un tema documental tecnico hacia el siguiente equipo responsable.",
                  "This screen should already let a coordinator raise, review and route a technical document issue to the next responsible team."
                )}
              >
                <p className="sectionText">
                  {t(
                    "Crea un RFI o submittal, muevelo por revision y respuesta, y despues continua hacia `projects`, `quality`, `compliance` o `post-sale` segun si el problema esta frenando ejecucion, liberacion o entrega.",
                    "Create an RFI or submittal, move it through review and response, then continue into `projects`, `quality`, `compliance` or `post-sale` depending on whether the issue is delaying execution, release or handover."
                  )}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title={t("Bandeja documental", "Document board")}
                description={t(
                  "RFIs, submittals, transmittals y notas tecnicas activas con filtros de operacion.",
                  "Live RFIs, submittals, transmittals and technical notes with operating filters."
                )}
              >
                <FilterBar
                  summary={localizeText({
                    es: `${filteredItems.length} items documentales coinciden con los filtros operativos actuales`,
                    en: `${filteredItems.length} document-control items match the current operating filters`
                  })}
                >
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? t("demo operable", "operable demo") : t("backend activo", "live backend")}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("documentos listos", "docs ready")}</Badge>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">{t("Todos los proyectos", "All projects")}</option>
                    {projectOptions.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value)}>
                    <option value="all">{t("Todos los tipos", "All types")}</option>
                    {documentTypeOptions.map((documentType) => (
                      <option key={documentType} value={documentType}>
                        {documentType}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                    <option value="all">{t("Toda la salud", "All health")}</option>
                    <option value="critical">{t("Critico", "Critical")}</option>
                    <option value="watch">{t("En vigilancia", "Watch")}</option>
                    <option value="healthy">{t("Saludable", "Healthy")}</option>
                  </select>
                  <input
                    className="field"
                    type="search"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder={t("Asunto, codigo, responsable o siguiente accion", "Subject, code, owner or next action")}
                    style={{ minWidth: 220 }}
                  />
                  <Badge tone={filteredItems.some((item) => item.health === "critical") ? "danger" : filteredItems.some((item) => item.health === "watch") ? "warning" : "success"}>
                    {filteredItems.some((item) => item.health === "critical")
                      ? t("hay items criticos visibles", "critical items visible")
                      : filteredItems.some((item) => item.health === "watch")
                        ? t("hay items en vigilancia visibles", "watch items visible")
                        : t("subset visible controlado", "visible subset controlled")}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredItems}
                  columns={[
                    {
                      key: "item",
                      label: t("Item", "Item"),
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedItemId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.subject}</strong>
                            <span className="tableCellMuted">{row.documentType} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "project",
                      label: t("Proyecto", "Project"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectName}</strong>
                          <span className="tableCellMuted">{row.owner}</span>
                        </div>
                      )
                    },
                    {
                      key: "flow",
                      label: t("Flujo", "Flow"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{localizeText({ es: `${row.revisionCount} revisiones`, en: `${row.revisionCount} revisions` })}</strong>
                          <span className="tableCellMuted">{localizeText({ es: `${row.openComments} comentarios`, en: `${row.openComments} comments` })}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: t("Salud", "Health"),
                      render: (row) => <Badge tone={healthTone(row.health)}>{localizeText(documentHealthLabel(row.health))}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title={t("Item seleccionado", "Selected item")}
                description={t(
                  "Trazabilidad puntual para el RFI, submittal o incidencia documental activa.",
                  "Focused traceability for the active RFI, submittal or controlled issue."
                )}
                aside={selectedItem ? <Badge tone={healthTone(selectedItem.health)}>{localizeText(documentHealthLabel(selectedItem.health))}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">{t("Proyecto", "Project")}</div>
                      <div>{selectedItem.projectName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Estado", "Status")}</div>
                      <div>
                        <Badge tone={selectedItem.status === "blocked" ? "danger" : selectedItem.status === "approved" ? "success" : "info"}>
                          {localizeText(documentStatusLabel(selectedItem.status))}
                        </Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Respuesta", "Turnaround")}</div>
                      <div>{localizeText({ es: `${selectedItem.turnaroundDays} dias`, en: `${selectedItem.turnaroundDays} days` })}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Comentarios abiertos", "Open comments")}</div>
                      <div>{selectedItem.openComments}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Puerta de continuidad", "Continuity gate")}</div>
                      <div className="tableCellStack">
                        <Badge tone={documentContinuityGate.tone}>{documentContinuityGate.label}</Badge>
                        <span className="tableCellMuted">{documentContinuityGate.summary}</span>
                        {documentContinuityGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">{check}</span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                      <div>{documentHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Modulo responsable", "Responsible module")}</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(documentRoutingDesk.primaryLabel)}</strong>
                        <span className="tableCellMuted">{localizeText(documentRoutingDesk.primaryReason)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Segundo salto", "Secondary jump")}</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(documentRoutingDesk.secondaryLabel)}</strong>
                        <span className="tableCellMuted">{localizeText(documentRoutingDesk.secondaryReason)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Por que importa ahora", "Why now")}</div>
                      <div>{documentWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Impacto aguas abajo", "Downstream effect")}</div>
                      <div>{documentDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Resumen de ruta", "Route summary")}</div>
                      <div>{documentRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Proximo reporte", "Report back")}</div>
                      <div>{documentReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Que debe regresar confirmado", "What must return confirmed")}</div>
                      <div>{localizeText(documentRoutingDesk.returnRule)}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente accion", "Next action")}</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder={t(
                            "Describe la siguiente accion de coordinacion o respuesta",
                            "Describe the next coordination or response action"
                          )}
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Actualizado", "Updated")}</div>
                      <div>{new Date(selectedItem.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Reglas de negocio", "Business rules")}</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">{t("La aprobacion requiere cero comentarios abiertos.", "Approval requires zero open comments.")}</span>
                        <span className="tableCellMuted">{t("La aprobacion se bloquea si la respuesta supera 10 dias sin revalidacion.", "Approval is blocked if turnaround exceeds 10 days without revalidation.")}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Vinculos operativos", "Operational links")}</div>
                      <div className="row gap wrap">
                        {documentOperationalLinks.map((link, index) => (
                          <Link key={link.href + link.label} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                            {localizeText(documentLinkLabel(link.label))}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Acciones", "Actions")}</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          {actionOptions.map((option) => (
                            <button
                              key={option.label}
                              className={option.status === "blocked" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleItemAction(option.status, option.nextAction)}
                            >
                              {isSaving ? t("Guardando...", "Saving...") : localizeText(documentActionLabel(option.label))}
                            </button>
                          ))}
                        </div>
                        {documentActionFeedback ? <span className="tableCellMuted">{localizeText(documentActionFeedback)}</span> : null}
                        {documentErrorFeedback ? <span style={{ color: "var(--danger-700)" }}>{localizeText(documentErrorFeedback)}</span> : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title={t("No hay item documental seleccionado", "No document-control item selected")}
                    description={t(
                      "Elige un item para revisar la trazabilidad actual, bloqueos y siguiente accion.",
                      "Choose an item to inspect the current coordination trace, blockers and next action."
                    )}
                    primaryAction={{ label: t("Permanecer en control documental", "Stay on document control"), href: "/document-control" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title={t("Senal de coordinacion", "Coordination signal")} description={t("Por que el documento seleccionado sigue importando operativamente.", "Why the selected document still matters operationally.")}>
                <p className="sectionText">
                  {selectedStory?.coordinationSignal ?? t("Elige un item para revisar la senal de coordinacion.", "Choose an item to inspect coordination signal.")}
                </p>
              </Card>
              <Card title={t("Dependencia de compliance", "Compliance dependency")} description={t("Expediente o evidencia que sigue dependiendo de este documento.", "Folder or evidence posture still tied to this document.")}>
                <p className="sectionText">
                  {selectedStory?.complianceSignal ?? t("Elige un item para revisar la dependencia de compliance.", "Choose an item to inspect compliance dependency.")}
                </p>
              </Card>
              <Card title={t("Impacto en entrega", "Delivery impact")} description={t("Implicacion en entrega al cliente o garantia del documento seleccionado.", "Customer handover or warranty implication of the selected document.")}>
                <p className="sectionText">
                  {selectedStory?.deliverySignal ?? t("Elige un item para revisar el impacto en entrega.", "Choose an item to inspect delivery impact.")}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card
                title={t("Registrar item documental", "Register document item")}
                description={t(
                  "Crea un RFI, submittal o incidencia documental operable directamente en el backend del tenant.",
                  "Create a live RFI, submittal or controlled issue directly in the tenant backend."
                )}
                aside={
                  searchParams.get("source") === "quality"
                    ? <Badge tone="info">{t("Precargado desde calidad", "Prefilled from quality")}</Badge>
                    : searchParams.get("source") === "post-sale"
                      ? <Badge tone="info">{t("Precargado desde postventa", "Prefilled from post-sale")}</Badge>
                      : null
                }
              >
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDocumentExample())}>
                    {t("Cargar ejemplo demo", "Load demo example")}
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        documentType: "RFI",
                        subject: "Interferencia entre estructura e instalaciones en eje 4",
                        projectName: "Proyecto central",
                        owner: "Coordinacion de proyecto",
                        status: "issued",
                        revisionCount: "0",
                        turnaroundDays: "2",
                        openComments: "2",
                        health: "watch",
                        nextAction: "Emitir RFI consolidado y asignar respuesta antes del siguiente corte."
                      })
                    }
                  >
                    {t("Preset RFI", "RFI preset")}
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        documentType: "Submittal",
                        subject: "Submittal de canceleria para liberacion de fachada",
                        projectName: "Proyecto central",
                        owner: "Proveedor de canceleria",
                        status: "in_review",
                        revisionCount: "1",
                        turnaroundDays: "4",
                        openComments: "3",
                        health: "watch",
                        nextAction: "Concentrar observaciones del despacho y reenviar paquete corregido."
                      })
                    }
                  >
                    {t("Preset submittal", "Submittal preset")}
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        documentType: "RFI",
                        subject: "",
                        projectName: "Proyecto central",
                        owner: "Project coordination",
                        status: "issued",
                        revisionCount: "0",
                        turnaroundDays: "0",
                        openComments: "0",
                        health: "watch",
                        nextAction: ""
                      })
                    }
                  >
                    {t("Reiniciar formulario", "Reset form")}
                  </button>
                  {createDocumentOperationalLinks.map((link) => (
                    <Link key={link.href + link.label} className="buttonGhost" href={link.href}>
                      {localizeText(documentLinkLabel(link.label))}
                    </Link>
                  ))}
                </div>
                {searchParams.get("source") === "quality" ? (
                  <p className="tableCellMuted" style={{ marginBottom: 16 }}>
                    {t(
                      "Esta captura llego desde calidad para no perder proyecto, responsable tecnico y la siguiente accion de liberacion.",
                      "This intake came from quality so project, technical owner and the next release action stay in context."
                    )}
                  </p>
                ) : null}
                {searchParams.get("source") === "post-sale" ? (
                  <p className="tableCellMuted" style={{ marginBottom: 16 }}>
                    {t(
                      "Esta captura llego desde postventa para mantener la trazabilidad de entrega, caso y evidencia documental pendiente.",
                      "This intake came from post-sale to preserve handover, case and pending document evidence traceability."
                    )}
                  </p>
                ) : null}
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">{t("Tipo", "Type")}</div>
                    <select className="selectField" value={createForm.documentType} onChange={(event) => setCreateForm((current) => ({ ...current, documentType: event.target.value }))}>
                      <option value="RFI">RFI</option>
                      <option value="Submittal">Submittal</option>
                      <option value="Transmittal">Transmittal</option>
                      <option value="Meeting note">{t("Nota de reunion", "Meeting note")}</option>
                      <option value="Revision set">{t("Juego de revision", "Revision set")}</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Asunto", "Subject")}</div>
                    <input className="field" value={createForm.subject} onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))} placeholder={t("Describe la interferencia, revision o entrega tecnica", "Describe the interference, review or technical deliverable")} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Proyecto", "Project")}</div>
                    <input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} placeholder={t("Proyecto, frente o paquete", "Project, front or package")} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Responsable", "Owner")}</div>
                    <input className="field" value={createForm.owner} onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))} placeholder={t("Coordinacion, proyectista, proveedor o supervision", "Coordination, designer, supplier or supervision")} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Estado", "Status")}</div>
                    <select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as DocumentControlItemContract["status"] }))}>
                      <option value="issued">{localizeText(documentStatusLabel("issued"))}</option>
                      <option value="in_review">{localizeText(documentStatusLabel("in_review"))}</option>
                      <option value="awaiting_response">{localizeText(documentStatusLabel("awaiting_response"))}</option>
                      <option value="blocked">{localizeText(documentStatusLabel("blocked"))}</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Salud", "Health")}</div>
                    <select className="selectField" value={createForm.health} onChange={(event) => setCreateForm((current) => ({ ...current, health: event.target.value as DocumentControlItemContract["health"] }))}>
                      <option value="healthy">{localizeText(documentHealthLabel("healthy"))}</option>
                      <option value="watch">{localizeText(documentHealthLabel("watch"))}</option>
                      <option value="critical">{localizeText(documentHealthLabel("critical"))}</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Revisiones", "Revisions")}</div>
                    <input className="field" type="number" min="0" value={createForm.revisionCount} onChange={(event) => setCreateForm((current) => ({ ...current, revisionCount: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Dias de respuesta", "Turnaround days")}</div>
                    <input className="field" type="number" min="0" value={createForm.turnaroundDays} onChange={(event) => setCreateForm((current) => ({ ...current, turnaroundDays: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Comentarios abiertos", "Open comments")}</div>
                    <input className="field" type="number" min="0" value={createForm.openComments} onChange={(event) => setCreateForm((current) => ({ ...current, openComments: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Siguiente accion", "Next action")}</div>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder={t(
                        "Describe la siguiente accion concreta de coordinacion o respuesta",
                        "Describe the next concrete coordination or response action"
                      )}
                    />
                  </label>
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Puerta de creacion", "Creation gate")}</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createDocumentGate.tone}>{createDocumentGate.label}</Badge>
                        <span>{createDocumentGate.summary}</span>
                      </div>
                      {createDocumentGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">
                          {check}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                    <div>{createDocumentHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente impacto inmediato", "Immediate downstream")}</div>
                    <div>
                      {createForm.status === "blocked"
                        ? t("Este item debe volver primero a coordinacion tecnica antes de que otro equipo asuma continuidad.", "This item should go back into technical coordination before any downstream team assumes continuity.")
                        : createForm.status === "awaiting_response"
                          ? t("Este item debe continuar hacia el responsable de responder, no quedarse estacionado en control documental.", "This item should continue into the response owner path, not stay parked in document control.")
                          : createForm.health === "critical" || Number(createForm.openComments) > 0
                            ? t("Este item debe continuar hacia proyectos, calidad o compliance con responsables explicitos para los comentarios.", "This item should continue into projects, quality or compliance with explicit comment ownership.")
                            : t("Este item puede continuar al siguiente carril con una historia tecnica suficientemente limpia.", "This item can continue into the next coordination lane with a clean enough technical story.")}
                    </div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateItem()}>
                    {isCreating ? t("Guardando...", "Saving...") : t("Agregar item documental", "Add document item")}
                  </button>
                  {documentCreateFeedback ? <Badge tone="success">{localizeText(documentCreateFeedback)}</Badge> : null}
                  {documentErrorFeedback ? <span style={{ color: "var(--danger-700)" }}>{localizeText(documentErrorFeedback)}</span> : null}
                </div>
              </Card>

              <Card
                title={t("Riesgos y bloqueos documentales", "Document risks and blockers")}
                description={t(
                  "Problemas de coordinacion, versionado y respuesta que hoy afectan la obra activa.",
                  "Coordination, versioning and response issues affecting active work."
                )}
              >
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">{t("Regla de captura", "Capture gate")}</div><div>{t("Los items no pueden nacer aprobados y `awaiting_response` exige comentarios vivos.", "Items cannot start approved, and `awaiting_response` requires live comments.")}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Regla de salud", "Healthy gate")}</div><div>{t("La postura saludable se bloquea mientras existan comentarios o deuda de revision abierta.", "Healthy posture is blocked while comments or review debt remain open.")}</div></div>
                  <div className="detailRow"><div className="detailLabel">{t("Flujo cruzado", "Cross-domain flow")}</div><div>{t("Usa este carril cuando la liberacion de calidad, expedientes o entrega al cliente sigan dependiendo de documentos controlados faltantes.", "Use this lane when quality release, compliance folders or customer handover still depend on missing controlled documents.")}</div></div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <DataTable
                    rows={selectedRisks.length > 0 ? selectedRisks : filteredRisks}
                    columns={[
                      {
                        key: "risk",
                        label: t("Riesgo", "Risk"),
                        render: (risk) => (
                          <div className="tableCellStack">
                            <strong>{risk.title}</strong>
                            <span className="tableCellMuted">{risk.category}</span>
                          </div>
                        )
                      },
                      {
                        key: "severity",
                        label: t("Severidad", "Severity"),
                        render: (risk) => (
                          <Badge tone={risk.severity === "critical" ? "danger" : risk.severity === "warning" ? "warning" : "info"}>
                            {risk.severity}
                          </Badge>
                        )
                      },
                      {
                        key: "owner",
                        label: t("Responsable", "Owner"),
                        render: (risk) => risk.owner
                      },
                      {
                        key: "status",
                        label: t("Accion actual", "Current action"),
                        render: (risk) => risk.status
                      }
                    ]}
                  />
                </div>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title={t("Resumen de control documental no disponible", "Document control overview unavailable")}
            description={error}
            primaryAction={{ label: t("Ir al dashboard", "Go to dashboard"), href: "/dashboard" }}
            secondaryAction={{ label: t("Abrir proyectos", "Open projects"), href: "/projects" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? t("Cargando resumen documental", "Loading document control overview") : t("El resumen documental aun no carga", "Document control overview not loaded yet")}
            description={
              isDemoMode
                ? t("Esta ruta debe cargar senales demo o reales para probar la coordinacion tecnica de punta a punta.", "This route should load demo or live document-control signals so technical coordination can be tested end to end.")
                : t("Esta ruta sigue esperando suficientes senales documentales para el tenant activo.", "This route is still waiting for enough document-control signals for the active tenant.")
            }
            primaryAction={{ label: t("Ir al dashboard", "Go to dashboard"), href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}

export default function DocumentControlPage() {
  return (
    <Suspense fallback={null}>
      <DocumentControlPageContent />
    </Suspense>
  );
}
