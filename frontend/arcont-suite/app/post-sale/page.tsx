"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
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
import type { PostSaleCaseContract, PostSaleOverviewContract } from "@/lib/contracts";
import {
  fetchComplianceOverview,
  fetchDocumentControlOverview,
  fetchPostSaleOverview,
  updatePostSaleCase
} from "@/lib/platform-api";

function healthTone(health: PostSaleCaseContract["health"]) {
  switch (health) {
    case "healthy":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function priorityTone(priority: PostSaleCaseContract["priority"]) {
  switch (priority) {
    case "critical":
      return "danger";
    case "urgent":
      return "warning";
    default:
      return "info";
  }
}

function caseTypeLabel(caseType: PostSaleCaseContract["caseType"]) {
  switch (caseType) {
    case "delivery":
      return "Delivery";
    case "warranty":
      return "Warranty";
    default:
      return "Incident";
  }
}

function postSaleActionOptions(item: PostSaleCaseContract) {
  switch (item.status) {
    case "reported":
      return [
        {
          label: "Triage case",
          status: "triaged" as const,
          nextAction: "Validate scope, assign owner and classify the SLA impact before dispatch"
        },
        {
          label: "Block case",
          status: "blocked" as const,
          nextAction: "Stop the case and document the dependency that prevents triage"
        }
      ];
    case "triaged":
      return [
        {
          label: "Schedule visit",
          status: "scheduled" as const,
          nextAction: "Lock the visit slot, crew and materials required for customer attention"
        },
        {
          label: "Start execution",
          status: "in_progress" as const,
          nextAction: "Dispatch the assigned team and start corrective work immediately"
        },
        {
          label: "Block case",
          status: "blocked" as const,
          nextAction: "Escalate the blocker before committing the next customer action"
        }
      ];
    case "scheduled":
      return [
        {
          label: "Start execution",
          status: "in_progress" as const,
          nextAction: "Execute the scheduled attention and capture field evidence in real time"
        },
        {
          label: "Block schedule",
          status: "blocked" as const,
          nextAction: "Pause the scheduled visit and escalate the unresolved dependency"
        }
      ];
    case "in_progress":
      return [
        {
          label: "Send to validation",
          status: "customer_validation" as const,
          nextAction: "Request customer validation with full evidence and closeout notes"
        },
        {
          label: "Block work",
          status: "blocked" as const,
          nextAction: "Stop execution and escalate the field or supplier blocker"
        }
      ];
    case "customer_validation":
      return [
        {
          label: "Resume case",
          status: "in_progress" as const,
          nextAction: "Reopen corrective work based on the customer validation gap"
        },
        {
          label: "Close case",
          status: "closed" as const,
          nextAction: "Archive evidence, confirm sign-off and close the post-sale loop"
        }
      ];
    case "blocked":
      return [
        {
          label: "Resume triage",
          status: "triaged" as const,
          nextAction: "Reopen the case and recover the stalled owner coordination"
        },
        {
          label: "Schedule recovery",
          status: "scheduled" as const,
          nextAction: "Lock a new customer attention slot after clearing the blocker"
        }
      ];
    default:
      return [];
  }
}

function pickFocusItem(items: PostSaleCaseContract[]) {
  return (
    items
      .slice()
      .sort((left, right) => {
        if (left.health === "critical" && right.health !== "critical") {
          return -1;
        }

        if (left.health !== "critical" && right.health === "critical") {
          return 1;
        }

        return left.slaHoursRemaining - right.slaHoursRemaining;
      })[0] ?? null
  );
}

type PostSaleBridgeContext = {
  compliance: NonNullable<Awaited<ReturnType<typeof fetchComplianceOverview>>>;
  documents: NonNullable<Awaited<ReturnType<typeof fetchDocumentControlOverview>>>;
} | null;

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;
type ModuleHref = "/post-sale" | "/compliance" | "/document-control" | "/quality" | "/projects";

type DocumentControlPreloadContext = {
  source: string | null;
  projectName: string | null;
  subject: string | null;
  owner: string | null;
  nextAction: string | null;
  assetLabel: string | null;
  customerName: string | null;
};

type PostSaleContextMatch = {
  item: PostSaleCaseContract;
  isExact: boolean;
  score: number;
};

function normalizeContextValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function buildDocumentControlContextSummary(context: DocumentControlPreloadContext) {
  const segments = [
    context.projectName ? `Proyecto / Project: ${context.projectName}` : null,
    context.subject ? `Asunto / Subject: ${context.subject}` : null,
    context.owner ? `Responsable / Owner: ${context.owner}` : null,
    context.assetLabel ? `Activo / Asset: ${context.assetLabel}` : null,
    context.customerName ? `Cliente / Customer: ${context.customerName}` : null,
    context.nextAction ? `Siguiente acción / Next action: ${context.nextAction}` : null
  ].filter(Boolean);

  return segments.join(" · ");
}

function findDocumentControlRelatedCase(
  items: PostSaleCaseContract[],
  context: DocumentControlPreloadContext
): PostSaleContextMatch | null {
  if (context.source !== "document-control") {
    return null;
  }

  const params = [
    { value: normalizeContextValue(context.projectName), fields: ["projectName"] as const },
    { value: normalizeContextValue(context.owner), fields: ["owner"] as const },
    { value: normalizeContextValue(context.assetLabel), fields: ["assetLabel"] as const },
    { value: normalizeContextValue(context.customerName), fields: ["customerName"] as const },
    { value: normalizeContextValue(context.subject), fields: ["projectName", "assetLabel", "customerName", "nextAction"] as const }
  ].filter((entry) => entry.value.length > 0);

  if (params.length === 0) {
    return null;
  }

  let bestMatch: PostSaleContextMatch | null = null;

  for (const item of items) {
    let exactMatches = 0;
    let partialMatches = 0;

    for (const param of params) {
      for (const field of param.fields) {
        const candidateValue = normalizeContextValue(item[field]);
        if (!candidateValue) {
          continue;
        }

        if (candidateValue === param.value) {
          exactMatches += 1;
          break;
        }

        if (candidateValue.includes(param.value) || param.value.includes(candidateValue)) {
          partialMatches += 1;
          break;
        }
      }
    }

    const score = exactMatches * 10 + partialMatches * 3;
    if (score === 0) {
      continue;
    }

    const candidateMatch = {
      item,
      isExact: exactMatches > 0,
      score
    };

    if (
      !bestMatch ||
      candidateMatch.score > bestMatch.score ||
      (candidateMatch.score === bestMatch.score && candidateMatch.item.slaHoursRemaining < bestMatch.item.slaHoursRemaining)
    ) {
      bestMatch = candidateMatch;
    }
  }

  return bestMatch;
}

function findRelatedComplianceCase(item: PostSaleCaseContract, bridge: PostSaleBridgeContext) {
  return (
    bridge?.compliance.cases.find(
      (candidate) =>
        candidate.subject.includes(item.assetLabel) ||
        candidate.unitOrContract.includes(item.assetLabel) ||
        candidate.subject.includes(item.customerName) ||
        candidate.unitOrContract.includes(item.customerName)
    ) ?? bridge?.compliance.focusCase ?? null
  );
}

function findRelatedDocumentItem(item: PostSaleCaseContract, bridge: PostSaleBridgeContext) {
  return bridge?.documents.items.find((candidate) => candidate.projectName === item.projectName) ?? bridge?.documents.focusItem ?? null;
}

function buildPostSaleModuleHref(moduleHref: ModuleHref, item: PostSaleCaseContract | null, bridge: PostSaleBridgeContext) {
  if (!item) {
    return moduleHref;
  }

  const params = new URLSearchParams();
  const relatedDocument = findRelatedDocumentItem(item, bridge);

  switch (moduleHref) {
    case "/quality":
      params.set("project", item.projectName);
      break;
    case "/document-control":
      params.set("project", item.projectName);
      if (relatedDocument?.documentType) {
        params.set("documentType", relatedDocument.documentType);
      }
      break;
    case "/projects":
      params.set("projectName", item.projectName);
      params.set("scheduleActivityName", `${caseTypeLabel(item.caseType)} · ${item.assetLabel}`);
      params.set("schedulePhase", "Post-sale");
      params.set("scheduleOwner", item.owner);
      params.set("scheduleNextAction", item.nextAction);
      break;
    default:
      break;
  }

  const query = params.toString();
  return query.length > 0 ? `${moduleHref}?${query}` : moduleHref;
}

function buildPostSaleBridge(item: PostSaleCaseContract | null, bridge: PostSaleBridgeContext) {
  if (!item) {
    return null;
  }

  const relatedCompliance = findRelatedComplianceCase(item, bridge);
  const relatedDocument = findRelatedDocumentItem(item, bridge);

  return {
    deliverySignal:
      item.caseType === "delivery"
        ? `${caseTypeLabel(item.caseType)} case is carrying ${item.openFindings} open findings with ${item.slaHoursRemaining} SLA hours remaining.`
        : `${caseTypeLabel(item.caseType)} attention is active and still depends on disciplined closeout evidence.`,
    complianceSignal: relatedCompliance
      ? `${relatedCompliance.subject} is at ${relatedCompliance.documentCompletion}% completion with ${relatedCompliance.slaHoursRemaining} SLA hours remaining.`
      : "No linked compliance folder is mapped for this case yet.",
    documentSignal: relatedDocument
      ? `${relatedDocument.documentType} "${relatedDocument.subject}" still carries ${relatedDocument.openComments} comments and ${relatedDocument.turnaroundDays} turnaround days.`
      : "No linked document-control item is mapped for this case yet."
  };
}

function buildPostSaleWorkflow(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Use post-sale as the live customer continuity lane between delivery, warranty, evidence and final sign-off.";
  }

  if (item.status === "blocked") {
    return "A blocked post-sale case should jump immediately into compliance, documents or quality before the customer wait compounds.";
  }

  if (item.status === "customer_validation") {
    return "A validation-stage case should close fast only if evidence, visits and findings are coherent enough for real sign-off.";
  }

  return "An active post-sale case should keep triage, execution and customer closure aligned in the same queue.";
}

function buildPostSaleWhyNow(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a post-sale case to understand what should be solved now before customer continuity degrades.";
  }

  if (item.health === "critical" || item.slaHoursRemaining < 0) {
    return `${item.assetLabel} is already under customer pressure because the case is ${item.health} with ${item.slaHoursRemaining} SLA hours remaining.`;
  }

  if (item.openFindings > 0 || item.pendingVisits > 0) {
    return `${item.assetLabel} still needs coordinated findings closure and visit execution before the promise to the customer becomes harder to keep.`;
  }

  if (item.status === "customer_validation") {
    return `The case is close to closure, but ${item.customerName} still needs a clean validation cycle with evidence that fully supports sign-off.`;
  }

  return `${item.customerName} already expects continuity on ${item.assetLabel}, so this case still needs disciplined follow-through even if the queue looks stable.`;
}

function buildPostSaleDownstreamEffect(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a case to inspect what downstream lane will absorb the impact.";
  }

  if (item.caseType === "delivery") {
    return "If this delivery case stalls, compliance, document control and revenue recognition around final handover will absorb the delay.";
  }

  if (item.openFindings > 0) {
    return "If findings remain open, quality, field execution and customer success will inherit repeated visits and avoidable coordination cost.";
  }

  if (item.status === "blocked") {
    return "If the blocker is not cleared, the queue will spill into compliance or document control and keep closure metrics artificially stuck.";
  }

  return "If this case is resolved cleanly, post-sale can release pressure from quality, compliance and project teams instead of feeding rework back into them.";
}

function buildPostSaleHumanStep(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a case to identify the next human move.";
  }

  if (item.status === "blocked") {
    return "Clear the blocking dependency first, confirm the owner and only then reopen the customer commitment.";
  }

  if (item.status === "customer_validation") {
    return "Run the customer validation touchpoint now and state clearly whether the case closes or reopens with evidence.";
  }

  if (item.pendingVisits > 0) {
    return "Lock the next visit, assign the crew and keep the customer informed of the exact service window.";
  }

  if (item.openFindings > 0) {
    return "Close the remaining findings with evidence before promising final closure to the customer.";
  }

  return "Confirm the next owner, the next customer touchpoint and the exact module that receives the case if continuity breaks.";
}

function buildPostSaleOperationalLinks(item: PostSaleCaseContract | null, bridge: PostSaleBridgeContext) {
  const dedupe = (links: Array<{ label: { es: string; en: string }; href: string }>) =>
    links.filter((link, index, collection) => collection.findIndex((candidate) => candidate.href === link.href) === index);

  if (!item) {
    return dedupe([
      { label: { es: "Abrir post-venta", en: "Open post-sale" }, href: "/post-sale" },
      { label: { es: "Abrir cumplimiento", en: "Open compliance" }, href: "/compliance" },
      { label: { es: "Abrir control documental", en: "Open document control" }, href: "/document-control" }
    ]);
  }

  if (item.status === "blocked") {
    return dedupe([
      { label: { es: "Abrir cumplimiento", en: "Open compliance" }, href: buildPostSaleModuleHref("/compliance", item, bridge) },
      { label: { es: "Abrir control documental", en: "Open document control" }, href: buildPostSaleModuleHref("/document-control", item, bridge) },
      { label: { es: "Abrir proyectos", en: "Open projects" }, href: buildPostSaleModuleHref("/projects", item, bridge) }
    ]);
  }

  if (item.openFindings > 0) {
    return dedupe([
      { label: { es: "Abrir calidad", en: "Open quality" }, href: buildPostSaleModuleHref("/quality", item, bridge) },
      { label: { es: "Abrir proyectos", en: "Open projects" }, href: buildPostSaleModuleHref("/projects", item, bridge) },
      { label: { es: "Abrir cumplimiento", en: "Open compliance" }, href: buildPostSaleModuleHref("/compliance", item, bridge) }
    ]);
  }

  if (item.caseType === "delivery") {
    return dedupe([
      { label: { es: "Abrir control documental", en: "Open document control" }, href: buildPostSaleModuleHref("/document-control", item, bridge) },
      { label: { es: "Abrir cumplimiento", en: "Open compliance" }, href: buildPostSaleModuleHref("/compliance", item, bridge) },
      { label: { es: "Abrir proyectos", en: "Open projects" }, href: buildPostSaleModuleHref("/projects", item, bridge) }
    ]);
  }

  return dedupe([
    { label: { es: "Abrir calidad", en: "Open quality" }, href: buildPostSaleModuleHref("/quality", item, bridge) },
    { label: { es: "Abrir proyectos", en: "Open projects" }, href: buildPostSaleModuleHref("/projects", item, bridge) },
    { label: { es: "Abrir post-venta", en: "Open post-sale" }, href: "/post-sale" }
  ]);
}

function buildPostSaleReturnConfirmation(
  item: PostSaleCaseContract | null,
  targetModuleHref: ModuleHref,
  bridge: PostSaleBridgeContext
) {
  if (!item) {
    return {
      es: "Regresa con el siguiente frente responsable confirmado.",
      en: "Return with the next responsible lane confirmed."
    };
  }

  const relatedCompliance = findRelatedComplianceCase(item, bridge);
  const relatedDocument = findRelatedDocumentItem(item, bridge);

  switch (targetModuleHref) {
    case "/quality":
      return {
        es: `Regresa con responsable por cada uno de los ${item.openFindings} hallazgos, evidencia mínima definida y criterio claro para reabrir o cerrar.`,
        en: `Return with an owner for each of the ${item.openFindings} findings, minimum evidence defined and a clear reopen-or-close criterion.`
      };
    case "/document-control":
      return {
        es: `Regresa con ${relatedDocument?.openComments ?? 0} comentarios documentales resueltos o con la evidencia exacta que siga faltando para liberar salida.`,
        en: `Return with the ${relatedDocument?.openComments ?? 0} document comments resolved or with the exact evidence still missing to release exit.`
      };
    case "/compliance":
      return {
        es:
          item.status === "customer_validation"
            ? "Regresa con validación del cliente defendible y con firma final cerrada o con el hueco exacto que obliga reapertura."
            : `Regresa con la carpeta de cumplimiento cerrada o con el porcentaje pendiente (${relatedCompliance?.documentCompletion ?? 0}%) y el entregable faltante claramente identificado.`,
        en:
          item.status === "customer_validation"
            ? "Return with defensible customer validation and either final sign-off closed or the exact gap forcing reopening."
            : `Return with the compliance folder closed or with the pending percentage (${relatedCompliance?.documentCompletion ?? 0}%) and the missing deliverable clearly identified.`
      };
    case "/projects":
      return {
        es: "Regresa con visita, cuadrilla o frente confirmado, fecha comprometida y siguiente contacto con cliente ya definido.",
        en: "Return with the visit, crew or work front confirmed, a committed date and the next customer touchpoint already defined."
      };
    default:
      return {
        es: "Regresa con el siguiente movimiento operativo confirmado.",
        en: "Return with the next operating move confirmed."
      };
  }
}

function buildPostSaleReportBack(item: PostSaleCaseContract | null) {
  if (!item) {
    return "Select a case to define the next customer-facing checkpoint.";
  }

  if (item.status === "blocked") {
    return "Report back as soon as the blocker owner confirms the dependency is cleared and the case can re-enter execution.";
  }

  if (item.status === "customer_validation") {
    return "Report back right after the customer validation touchpoint with explicit sign-off or the exact gap that reopens the case.";
  }

  if (item.pendingVisits > 0 || item.openFindings > 0) {
    return "Report back after the next visit and findings update so the SLA and closure path can be recalculated with evidence.";
  }

  return "Report back in the next operating cycle with the confirmed customer response and updated closure posture.";
}

function buildPostSaleTargetModule(item: PostSaleCaseContract | null, bridge: PostSaleBridgeContext) {
  if (!item) {
    return {
      href: "/post-sale",
      moduleHref: "/post-sale" as const,
      tone: "info" as const,
      moduleCode: "POST-SALE",
      moduleLabel: { es: "Post-venta", en: "Post-sale" },
      ownerLabel: { es: "Operador de post-venta", en: "Post-sale operator" },
      whyLabel: {
        es: "Selecciona un caso para enrutarlo al módulo exacto que puede destrabarlo.",
        en: "Select a case to route it to the exact module that can unblock it."
      },
      impactLabel: {
        es: "Sin caso seleccionado no hay impacto aguas abajo definido.",
        en: "Without a selected case there is no defined downstream impact."
      },
      nextStepLabel: {
        es: "Elige un caso y confirma el siguiente frente responsable.",
        en: "Choose a case and confirm the next responsible lane."
      },
      returnLabel: {
        es: "Regresa con el siguiente frente responsable confirmado.",
        en: "Return with the next responsible lane confirmed."
      }
    };
  }

  const relatedCompliance = findRelatedComplianceCase(item, bridge);
  const relatedDocument = findRelatedDocumentItem(item, bridge);

  if (item.openFindings > 0) {
    return {
      href: buildPostSaleModuleHref("/quality", item, bridge),
      moduleHref: "/quality" as const,
      tone: item.health === "critical" ? "danger" : "warning",
      moduleCode: "QUALITY",
      moduleLabel: { es: "Calidad", en: "Quality" },
      ownerLabel: { es: "Coordinación de calidad", en: "Quality coordination" },
      whyLabel: {
        es: `El caso todavía arrastra ${item.openFindings} hallazgos abiertos y calidad es el frente que puede liberar el cierre técnico.`,
        en: `The case still carries ${item.openFindings} open findings, and quality is the lane that can release technical closure.`
      },
      impactLabel: {
        es: "Si no se corrigen los hallazgos, el cliente absorberá visitas repetidas, retrabajo y una validación final débil.",
        en: "If the findings are not corrected, the customer will absorb repeated visits, rework and a weak final validation."
      },
      nextStepLabel: {
        es: "Abre Calidad, asigna responsable por hallazgo y confirma la evidencia mínima antes de regresar a post-venta.",
        en: "Open Quality, assign an owner per finding and confirm the minimum evidence before returning to post-sale."
      },
      returnLabel: buildPostSaleReturnConfirmation(item, "/quality", bridge)
    } as const;
  }

  if (relatedDocument && relatedDocument.openComments > 0) {
    return {
      href: buildPostSaleModuleHref("/document-control", item, bridge),
      moduleHref: "/document-control" as const,
      tone: relatedDocument.openComments > 3 ? "warning" : "info",
      moduleCode: "DOCS",
      moduleLabel: { es: "Control documental", en: "Document control" },
      ownerLabel: { es: "Responsable documental", en: "Document controller" },
      whyLabel: {
        es: `El expediente de ${item.projectName} aún tiene ${relatedDocument.openComments} comentarios abiertos que pueden frenar el cierre o la entrega.`,
        en: `The ${item.projectName} file still has ${relatedDocument.openComments} open comments that can stop closure or handover.`
      },
      impactLabel: {
        es: "Si la carpeta documental no queda limpia, cumplimiento, entrega y firma final seguirán expuestos a observaciones.",
        en: "If the document file is not cleared, compliance, handover and final sign-off will remain exposed to observations."
      },
      nextStepLabel: {
        es: "Abre Control documental, limpia comentarios pendientes y deja lista la evidencia exacta que el cliente o auditor revisará.",
        en: "Open Document control, clear pending comments and prepare the exact evidence the customer or auditor will review."
      },
      returnLabel: buildPostSaleReturnConfirmation(item, "/document-control", bridge)
    } as const;
  }

  if (item.status === "customer_validation" || (relatedCompliance && relatedCompliance.documentCompletion < 100)) {
    return {
      href: buildPostSaleModuleHref("/compliance", item, bridge),
      moduleHref: "/compliance" as const,
      tone: item.status === "customer_validation" ? "warning" : "info",
      moduleCode: "COMP",
      moduleLabel: { es: "Cumplimiento", en: "Compliance" },
      ownerLabel: { es: "Responsable de cumplimiento", en: "Compliance lead" },
      whyLabel: {
        es:
          item.status === "customer_validation"
            ? "La validación del cliente solo es defendible si el expediente legal y de entrega está completo."
            : `El caso todavía depende de una carpeta de cumplimiento al ${relatedCompliance?.documentCompletion ?? 0}% para sostener el cierre.`,
        en:
          item.status === "customer_validation"
            ? "Customer validation is only defensible if the legal and handover file is complete."
            : `The case still depends on a ${relatedCompliance?.documentCompletion ?? 0}% complete compliance folder to sustain closure.`
      },
      impactLabel: {
        es: "Si cumplimiento queda incompleto, la firma final puede reabrirse aunque la atención técnica ya haya terminado.",
        en: "If compliance remains incomplete, final sign-off can reopen even if technical attention is already finished."
      },
      nextStepLabel: {
        es: "Abre Cumplimiento, confirma entregables obligatorios y valida que la evidencia soporte el cierre frente al cliente.",
        en: "Open Compliance, confirm required deliverables and verify the evidence supports closure in front of the customer."
      },
      returnLabel: buildPostSaleReturnConfirmation(item, "/compliance", bridge)
    } as const;
  }

  return {
    href: buildPostSaleModuleHref("/projects", item, bridge),
    moduleHref: "/projects" as const,
    tone: item.pendingVisits > 0 || item.status === "scheduled" ? "warning" : "success",
    moduleCode: "PROJ",
    moduleLabel: { es: "Proyectos", en: "Projects" },
    ownerLabel: { es: "Responsable de proyecto", en: "Project manager" },
    whyLabel: {
      es: "La continuidad del caso depende de coordinación operativa, visita y ejecución en campo más que de una liberación documental.",
      en: "Case continuity depends on operational coordination, site visits and field execution more than on a documentary release."
    },
    impactLabel: {
      es: "Si proyecto no toma el siguiente turno, la atención al cliente perderá ventana, cuadrilla o secuencia de ejecución.",
      en: "If projects does not take the next turn, customer attention will lose its slot, crew or execution sequence."
    },
    nextStepLabel: {
      es: "Abre Proyectos, confirma la visita o frente exacto y devuelve a post-venta un compromiso operativo con fecha.",
      en: "Open Projects, confirm the exact visit or work front and return an operational commitment with a date to post-sale."
    },
    returnLabel: buildPostSaleReturnConfirmation(item, "/projects", bridge)
  } as const;
}

function buildPostSaleContinuationPlan(
  item: PostSaleCaseContract | null,
  bridge: PostSaleBridgeContext,
  targetModuleHref: ModuleHref
) {
  const relatedCompliance = item ? findRelatedComplianceCase(item, bridge) : null;
  const relatedDocument = item ? findRelatedDocumentItem(item, bridge) : null;

  return [
    {
      key: "compliance",
      href: buildPostSaleModuleHref("/compliance", item, bridge),
      label: { es: "Cumplimiento", en: "Compliance" },
      ownerLabel: { es: "Cumplimiento", en: "Compliance" },
      tone:
        targetModuleHref === "/compliance"
          ? ("warning" as BadgeTone)
          : relatedCompliance && relatedCompliance.documentCompletion < 100
            ? ("info" as BadgeTone)
            : ("success" as BadgeTone),
      statusLabel:
        targetModuleHref === "/compliance"
          ? { es: "Siguiente módulo", en: "Next module" }
          : relatedCompliance && relatedCompliance.documentCompletion < 100
            ? { es: "Debe quedar listo", en: "Must be readied" }
            : { es: "Sin bloqueo visible", en: "No visible blocker" },
      description:
        targetModuleHref === "/compliance"
          ? {
              es: "La evidencia de cierre y validación final depende de una carpeta defendible frente al cliente.",
              en: "Closure evidence and final validation depend on a defensible customer-facing file."
            }
          : relatedCompliance && relatedCompliance.documentCompletion < 100
            ? {
                es: `La carpeta asociada sigue en ${relatedCompliance.documentCompletion}% y todavía puede reabrir el cierre.`,
                en: `The linked folder is still at ${relatedCompliance.documentCompletion}% and can still reopen closure.`
              }
            : {
                es: "No hay hueco de cumplimiento dominante, pero conviene mantener el expediente listo para firma.",
                en: "There is no dominant compliance gap, but the file should stay ready for sign-off."
              },
      nextStep:
        targetModuleHref === "/compliance"
          ? {
              es: "Validar entregables obligatorios y sostener el cierre frente al cliente.",
              en: "Validate required deliverables and sustain closure in front of the customer."
            }
          : {
              es: "Mantener el expediente listo para firma y sin observaciones nuevas.",
              en: "Keep the file ready for sign-off and free of new observations."
            },
      ctaLabel:
        targetModuleHref === "/compliance"
          ? { es: "Ir primero a cumplimiento", en: "Go first to compliance" }
          : { es: "Abrir cumplimiento", en: "Open compliance" },
      priorityRank: targetModuleHref === "/compliance" ? 0 : relatedCompliance && relatedCompliance.documentCompletion < 100 ? 1 : 4
    },
    {
      key: "quality",
      href: buildPostSaleModuleHref("/quality", item, bridge),
      label: { es: "Calidad", en: "Quality" },
      ownerLabel: { es: "Calidad", en: "Quality" },
      tone: item?.openFindings ? (targetModuleHref === "/quality" ? ("danger" as BadgeTone) : ("warning" as BadgeTone)) : ("success" as BadgeTone),
      statusLabel:
        targetModuleHref === "/quality"
          ? { es: "Siguiente módulo", en: "Next module" }
          : item?.openFindings
            ? { es: "Debe intervenir", en: "Needs intervention" }
            : { es: "Cobertura suficiente", en: "Covered" },
      description: item?.openFindings
        ? {
            es: `${item.openFindings} hallazgos abiertos siguen exponiendo retrabajo, visitas repetidas o una entrega técnica débil.`,
            en: `${item.openFindings} open findings still expose rework, repeated visits or weak technical handover.`
          }
        : {
            es: "No hay hallazgos abiertos dominando el caso en este momento.",
            en: "No open findings are dominating the case right now."
          },
      nextStep: item?.openFindings
        ? {
            es: "Asignar responsable por hallazgo y exigir evidencia mínima antes de devolver el caso.",
            en: "Assign an owner per finding and require minimum evidence before returning the case."
          }
        : {
            es: "Mantener calidad lista para absorber cualquier reapertura técnica.",
            en: "Keep quality ready to absorb any technical reopening."
          },
      ctaLabel:
        targetModuleHref === "/quality"
          ? { es: "Ir primero a calidad", en: "Go first to quality" }
          : { es: "Abrir calidad", en: "Open quality" },
      priorityRank: targetModuleHref === "/quality" ? 0 : item?.openFindings ? 1 : 4
    },
    {
      key: "document-control",
      href: buildPostSaleModuleHref("/document-control", item, bridge),
      label: { es: "Control documental", en: "Document control" },
      ownerLabel: { es: "Control documental", en: "Document control" },
      tone:
        targetModuleHref === "/document-control"
          ? ("warning" as BadgeTone)
          : relatedDocument && relatedDocument.openComments > 0
            ? ("info" as BadgeTone)
            : ("success" as BadgeTone),
      statusLabel:
        targetModuleHref === "/document-control"
          ? { es: "Siguiente módulo", en: "Next module" }
          : relatedDocument && relatedDocument.openComments > 0
            ? { es: "Pendiente por limpiar", en: "Needs cleanup" }
            : { es: "Sin fricción visible", en: "No visible friction" },
      description:
        targetModuleHref === "/document-control"
          ? {
              es: "El expediente documental es el cuello de botella más claro antes de cerrar o entregar.",
              en: "The document file is the clearest bottleneck before closure or handover."
            }
          : relatedDocument && relatedDocument.openComments > 0
            ? {
                es: `${relatedDocument.openComments} comentarios siguen abiertos sobre ${relatedDocument.documentType.toLowerCase()} y pueden frenar la salida del caso.`,
                en: `${relatedDocument.openComments} comments remain open on the ${relatedDocument.documentType.toLowerCase()} and can stop case exit.`
              }
            : {
                es: "No se ve un cuello documental dominante para este caso.",
                en: "There is no dominant document bottleneck visible for this case."
              },
      nextStep:
        targetModuleHref === "/document-control"
          ? {
              es: "Limpiar comentarios y dejar exacta la evidencia que sostendrá entrega o cierre.",
              en: "Clear comments and finalize the exact evidence that will sustain handover or closure."
            }
          : {
              es: "Conservar el expediente limpio para que no reaparezca como bloqueo de última milla.",
              en: "Keep the file clean so it does not reappear as a last-mile blocker."
            },
      ctaLabel:
        targetModuleHref === "/document-control"
          ? { es: "Ir primero a control documental", en: "Go first to document control" }
          : { es: "Abrir control documental", en: "Open document control" },
      priorityRank: targetModuleHref === "/document-control" ? 0 : relatedDocument && relatedDocument.openComments > 0 ? 1 : 4
    },
    {
      key: "projects",
      href: buildPostSaleModuleHref("/projects", item, bridge),
      label: { es: "Proyectos", en: "Projects" },
      ownerLabel: { es: "Proyectos", en: "Projects" },
      tone:
        targetModuleHref === "/projects"
          ? ("warning" as BadgeTone)
          : item && (item.pendingVisits > 0 || item.status === "scheduled" || item.status === "in_progress")
            ? ("info" as BadgeTone)
            : ("success" as BadgeTone),
      statusLabel:
        targetModuleHref === "/projects"
          ? { es: "Siguiente módulo", en: "Next module" }
          : item && (item.pendingVisits > 0 || item.status === "scheduled" || item.status === "in_progress")
            ? { es: "Debe coordinar", en: "Needs coordination" }
            : { es: "Sin tensión operativa", en: "No operating tension" },
      description:
        item && (targetModuleHref === "/projects" || item.pendingVisits > 0 || item.status === "scheduled" || item.status === "in_progress")
          ? {
              es: `La ejecución depende de ${item.pendingVisits} visita(s) pendiente(s) y de una secuencia operativa estable en campo.`,
              en: `Execution depends on ${item.pendingVisits} pending visit(s) and a stable field sequence.`
            }
          : {
              es: "Proyectos no es el frente dominante ahora, pero sigue sosteniendo agenda y cuadrilla.",
              en: "Projects is not the dominant lane now, but it still supports schedule and crew continuity."
            },
      nextStep:
        targetModuleHref === "/projects"
          ? {
              es: "Confirmar visita, cuadrilla o frente exacto y devolver una fecha comprometida a post-venta.",
              en: "Confirm the exact visit, crew or work front and return a committed date to post-sale."
            }
          : {
              es: "Mantener agenda, cuadrilla y secuencia listas para no romper continuidad operativa.",
              en: "Keep schedule, crew and sequence ready to avoid breaking operational continuity."
            },
      ctaLabel:
        targetModuleHref === "/projects"
          ? { es: "Ir primero a proyectos", en: "Go first to projects" }
          : { es: "Abrir proyectos", en: "Open projects" },
      priorityRank:
        targetModuleHref === "/projects"
          ? 0
          : item && (item.pendingVisits > 0 || item.status === "scheduled" || item.status === "in_progress")
            ? 2
            : 4
    }
  ].sort((left, right) => left.priorityRank - right.priorityRank || left.key.localeCompare(right.key));
}

export default function PostSalePage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const searchParams = useSearchParams();
  const t = (es: string, en: string) => localizeText({ es, en });
  const isDemoMode = !session.accessToken;
  const [overview, setOverview] = useState<PostSaleOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<PostSaleBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<"all" | PostSaleCaseContract["health"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | PostSaleCaseContract["priority"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const didApplyDocumentControlContextRef = useRef(false);
  const didApplyDocumentControlNextActionRef = useRef<string | null>(null);

  const documentControlContext = useMemo<DocumentControlPreloadContext>(
    () => ({
      source: searchParams.get("source"),
      projectName: searchParams.get("projectName"),
      subject: searchParams.get("subject"),
      owner: searchParams.get("owner"),
      nextAction: searchParams.get("nextAction"),
      assetLabel: searchParams.get("assetLabel"),
      customerName: searchParams.get("customerName")
    }),
    [searchParams]
  );

  const documentControlMatch = useMemo(
    () => findDocumentControlRelatedCase(overview?.items ?? [], documentControlContext),
    [documentControlContext, overview?.items]
  );
  const shouldShowDocumentControlPreload = documentControlContext.source === "document-control";
  const documentControlContextSummary = useMemo(
    () => buildDocumentControlContextSummary(documentControlContext),
    [documentControlContext]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchPostSaleOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchComplianceOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchDocumentControlOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, compliance, documents]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Post-sale overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedCaseId((current) => current ?? result.focusItem?.id ?? result.items[0]?.id ?? null);
        setBridgeContext(compliance && documents ? { compliance, documents } : null);
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

  const filteredCases = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.items.filter((item) => {
      const matchesHealth = healthFilter === "all" || item.health === healthFilter;
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.projectName.toLowerCase().includes(normalizedSearch) ||
        item.customerName.toLowerCase().includes(normalizedSearch) ||
        item.assetLabel.toLowerCase().includes(normalizedSearch) ||
        item.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesHealth && matchesPriority && matchesSearch;
    });
  }, [healthFilter, overview, priorityFilter, searchFilter]);

  const filteredSummary = useMemo(() => {
    const openCases = filteredCases.filter((item) => item.status !== "closed");
    const averageSlaHours =
      openCases.length > 0 ? Number((openCases.reduce((sum, item) => sum + item.slaHoursRemaining, 0) / openCases.length).toFixed(1)) : 0;
    return {
      openCases: openCases.length,
      criticalCases: filteredCases.filter((item) => item.health === "critical").length,
      urgentCases: filteredCases.filter((item) => item.priority === "urgent" || item.priority === "critical").length,
      averageSlaHours
    };
  }, [filteredCases]);

  const selectedCase = useMemo(
    () => filteredCases.find((item) => item.id === selectedCaseId) ?? filteredCases[0] ?? null,
    [filteredCases, selectedCaseId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.caseId === selectedCase?.id) ?? [],
    [overview, selectedCase]
  );

  const selectedStory = useMemo(() => buildPostSaleBridge(selectedCase, bridgeContext), [bridgeContext, selectedCase]);
  const selectedHumanStep = useMemo(() => buildPostSaleHumanStep(selectedCase), [selectedCase]);
  const selectedWhyNow = useMemo(() => buildPostSaleWhyNow(selectedCase), [selectedCase]);
  const selectedDownstreamEffect = useMemo(() => buildPostSaleDownstreamEffect(selectedCase), [selectedCase]);
  const selectedReportBack = useMemo(() => buildPostSaleReportBack(selectedCase), [selectedCase]);
  const selectedTargetModule = useMemo(() => buildPostSaleTargetModule(selectedCase, bridgeContext), [bridgeContext, selectedCase]);
  const selectedContinuationPlan = useMemo(
    () => buildPostSaleContinuationPlan(selectedCase, bridgeContext, selectedTargetModule.moduleHref),
    [bridgeContext, selectedCase, selectedTargetModule.moduleHref]
  );
  const selectedOperationalLinks = useMemo(() => {
    if (selectedContinuationPlan.length > 0) {
      return selectedContinuationPlan.map((lane) => ({
        href: lane.href,
        label: lane.priorityRank === 0 ? lane.ctaLabel : { es: `Abrir ${lane.label.es}`, en: `Open ${lane.label.en}` }
      }));
    }

    return buildPostSaleOperationalLinks(selectedCase, bridgeContext);
  }, [bridgeContext, selectedCase, selectedContinuationPlan]);
  const selectedSecondJump = selectedContinuationPlan[1] ?? null;

  const actionOptions = useMemo(() => (selectedCase ? postSaleActionOptions(selectedCase) : []), [selectedCase]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredCases.length === 0) {
      setSelectedCaseId(null);
      return;
    }

    const isSelectedVisible = filteredCases.some((item) => item.id === selectedCaseId);
    if (!isSelectedVisible) {
      setSelectedCaseId(filteredCases[0]?.id ?? null);
    }
  }, [filteredCases, overview, selectedCaseId]);

  useEffect(() => {
    if (didApplyDocumentControlContextRef.current || !overview || documentControlContext.source !== "document-control") {
      return;
    }

    didApplyDocumentControlContextRef.current = true;

    if (documentControlMatch) {
      setSelectedCaseId(documentControlMatch.item.id);
      if (documentControlMatch.item.projectName) {
        setSearchFilter((current) => current || documentControlMatch.item.projectName);
      }
    }
  }, [documentControlContext.source, documentControlMatch, overview]);

  useEffect(() => {
    setNextActionDraft(selectedCase?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedCaseId, selectedCase?.id, selectedCase?.nextAction]);

  useEffect(() => {
    if (
      documentControlContext.source !== "document-control" ||
      !documentControlContext.nextAction ||
      !selectedCase ||
      !documentControlMatch ||
      selectedCase.id !== documentControlMatch.item.id ||
      didApplyDocumentControlNextActionRef.current === selectedCase.id
    ) {
      return;
    }

    setNextActionDraft(documentControlContext.nextAction);
    didApplyDocumentControlNextActionRef.current = selectedCase.id;
  }, [documentControlContext, documentControlMatch, selectedCase]);

  async function handleCaseAction(
    status: PostSaleCaseContract["status"],
    suggestedNextAction: string
  ) {
    if (!selectedCase) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError("Next action must be more specific before updating the case.");
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updatePostSaleCase(
      selectedCase.id,
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
      setActionError(response.error?.message ?? "Post-sale case update failed.");
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const items = current.items.map((item) => (item.id === response.data?.id ? response.data : item));

      return {
        ...current,
        summary: {
          openCases: items.filter((item) => item.status !== "closed").length,
          criticalCases: items.filter((item) => item.health === "critical").length,
          overdueSlaCases: items.filter((item) => item.slaHoursRemaining < 0).length,
          pendingCustomerSignoff: items.filter((item) => item.status === "customer_validation").length
        },
        items,
        focusItem: pickFocusItem(items)
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(t(`El caso cambió a ${response.data.status}.`, `Case moved to ${response.data.status}.`));
    setIsSaving(false);
  }

  return (
    <AppShell
      title="Post-sale, warranties and handover"
      eyebrow="Customer continuity"
      description="Deliveries, warranty claims, incidents and SLA pressure managed as an operational queue, not a passive report."
    >
      <ModuleGate
        moduleKeys={["compliance.postsale"]}
        requiredPermissions={["compliance:*", "postsale:*"]}
        title="Post-sale"
      >
        {overview ? (
          <>
            <section className="grid cols2">
              <Card
                title={t("Control del caso seleccionado", "Selected case control")}
                description={t(
                  "Lleva el caso elegido directo a su módulo accionable, conserva el contexto visible y ejecuta el siguiente movimiento desde aquí.",
                  "Drive the chosen case straight into its actionable module, keep visible context, and execute the next move from here."
                )}
                aside={
                  selectedCase ? (
                    <div className="row gap wrap" style={{ justifyContent: "flex-end" }}>
                      {shouldShowDocumentControlPreload ? (
                        <Badge tone="info">{t("Precargado desde control documental", "Preloaded from document control")}</Badge>
                      ) : null}
                      <Badge tone={healthTone(selectedCase.health)}>{selectedCase.health}</Badge>
                    </div>
                  ) : null
                }
              >
                {selectedCase ? (
                  <>
                    <div className="grid cols1" style={{ marginBottom: 16 }}>
                      <Card
                        title={t("Selected signal / señal accionable", "Selected signal / actionable signal")}
                        description={t(
                          "Convierte el caso activo en una decisión operativa: por qué importa, qué impacto deja, quién actúa y a qué módulo debe saltar ahora.",
                          "Turn the active case into an operating decision: why it matters, what impact it creates, who acts, and which module it should jump to now."
                        )}
                        aside={
                          <div className="row gap wrap" style={{ justifyContent: "flex-end" }}>
                            {shouldShowDocumentControlPreload ? (
                              <Badge tone="info">{t("Precargado desde control documental", "Preloaded from document control")}</Badge>
                            ) : null}
                            <Badge tone={selectedTargetModule.tone}>{localizeText(selectedTargetModule.moduleLabel)}</Badge>
                          </div>
                        }
                      >
                        {shouldShowDocumentControlPreload ? (
                          <div className="detailRow" style={{ marginBottom: 16 }}>
                            <div className="detailLabel">{t("Prelectura operativa", "Operational pre-read")}</div>
                            <div className="tableCellStack">
                              <strong>
                                {documentControlMatch?.isExact
                                  ? t("Caso relacionado identificado", "Related case identified")
                                  : t("Sin match exacto: contexto visible conservado", "No exact match: visible context preserved")}
                              </strong>
                              <span>{documentControlContextSummary || t("Contexto documental recibido sin campos visibles.", "Document-control context received without visible fields.")}</span>
                            </div>
                          </div>
                        ) : null}
                        <div className="grid cols3" style={{ marginBottom: 16 }}>
                          <KpiCard
                            label={t("Impacto inmediato", "Immediate impact")}
                            value={selectedCase.health === "critical" ? t("Alto", "High") : selectedCase.priority === "critical" || selectedCase.priority === "urgent" ? t("Medio", "Medium") : t("Controlado", "Controlled")}
                            footnote={selectedWhyNow}
                          />
                          <KpiCard
                            label={t("Humano que actúa", "Human that acts")}
                            value={localizeText(selectedTargetModule.ownerLabel)}
                            footnote={`${t("Propietario actual", "Current owner")}: ${selectedCase.owner}`}
                          />
                          <KpiCard
                            label={t("Módulo siguiente", "Next module")}
                            value={localizeText(selectedTargetModule.moduleLabel)}
                            footnote={localizeText(selectedTargetModule.nextStepLabel)}
                          />
                        </div>

                        <div className="detailGrid">
                          <div className="detailRow">
                            <div className="detailLabel">{t("Módulo objetivo exacto", "Exact target module")}</div>
                            <div className="tableCellStack">
                              <strong>{localizeText(selectedTargetModule.moduleLabel)}</strong>
                              <span className="tableCellMuted">{selectedTargetModule.moduleCode}</span>
                              <span className="tableCellMuted">{localizeText(selectedTargetModule.nextStepLabel)}</span>
                            </div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Por qué importa ahora", "Why it matters now")}</div>
                            <div>{selectedWhyNow}</div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Siguiente responsable", "Next responsible owner")}</div>
                            <div className="tableCellStack">
                              <strong>{localizeText(selectedTargetModule.ownerLabel)}</strong>
                              <span className="tableCellMuted">{selectedCase.owner}</span>
                            </div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Módulo responsable inmediato", "Immediate responsible module")}</div>
                            <div className="tableCellStack">
                              <strong>{localizeText(selectedTargetModule.moduleLabel)}</strong>
                              <span className="tableCellMuted">{localizeText(selectedTargetModule.whyLabel)}</span>
                            </div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Segundo salto operativo", "Second operating jump")}</div>
                            <div className="tableCellStack">
                              <strong>{selectedSecondJump ? localizeText(selectedSecondJump.label) : t("Mantener post-venta", "Keep post-sale active")}</strong>
                              <span className="tableCellMuted">
                                {selectedSecondJump ? localizeText(selectedSecondJump.nextStep) : selectedDownstreamEffect}
                              </span>
                            </div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Qué debe regresar confirmado", "What must return confirmed")}</div>
                            <div>{localizeText(selectedTargetModule.returnLabel)}</div>
                          </div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Ruta accionable", "Actionable route")}</div>
                            <div className="row gap wrap">
                              {selectedOperationalLinks.map((link, index) => (
                                <Link
                                  key={`${link.href}-${localizeText(link.label)}`}
                                  className={index === 0 ? "button" : "buttonGhost"}
                                  href={link.href}
                                >
                                  {index === 0
                                    ? t(
                                        `Ir primero a ${localizeText(selectedTargetModule.moduleLabel)}`,
                                        `Go first to ${localizeText(selectedTargetModule.moduleLabel)}`
                                      )
                                    : localizeText(link.label)}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid cols2" style={{ marginTop: 16 }}>
                          <Card
                            title={t("Impacto y continuidad", "Impact and continuity")}
                            description={t(
                              "Resumen corto para operar el caso sin leer toda la analítica secundaria.",
                              "Short summary to operate the case without reading all secondary analytics."
                            )}
                          >
                            <div className="detailGrid">
                              <div className="detailRow">
                                <div className="detailLabel">{t("Por qué importa", "Why it matters")}</div>
                                <div>{selectedWhyNow}</div>
                              </div>
                              <div className="detailRow">
                                <div className="detailLabel">{t("Impacto real", "Real impact")}</div>
                                <div>{selectedDownstreamEffect}</div>
                              </div>
                              <div className="detailRow">
                                <div className="detailLabel">{t("Próximo gesto humano", "Next human move")}</div>
                                <div>{selectedHumanStep}</div>
                              </div>
                              <div className="detailRow">
                                <div className="detailLabel">{t("Momento de regreso", "Report-back point")}</div>
                                <div>{selectedReportBack}</div>
                              </div>
                              <div className="detailRow">
                                <div className="detailLabel">{t("Debe volver confirmado", "Must come back confirmed")}</div>
                                <div>{localizeText(selectedTargetModule.returnLabel)}</div>
                              </div>
                            </div>
                          </Card>

                          <Card
                            title={t("Mesa operable por dominio", "Actionable domain desk")}
                            description={t(
                              "Mesa corta para brincar al dominio correcto sin perder continuidad del caso seleccionado.",
                              "Short desk to jump into the correct domain without losing continuity for the selected case."
                            )}
                          >
                            <div className="detailGrid">
                              {selectedContinuationPlan.map((lane) => (
                                <div className="detailRow" key={lane.key}>
                                  <div className="detailLabel">
                                    <div className="tableCellStack">
                                      <strong>{localizeText(lane.label)}</strong>
                                      <Badge tone={lane.tone}>{localizeText(lane.statusLabel)}</Badge>
                                    </div>
                                  </div>
                                  <div className="tableCellStack">
                                    <span>{localizeText(lane.description)}</span>
                                    <span className="tableCellMuted">{localizeText(lane.nextStep)}</span>
                                    <Link href={lane.href} className={lane.priorityRank === 0 ? "button" : "buttonGhost"}>
                                      {localizeText(lane.ctaLabel)}
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Card>
                        </div>
                      </Card>
                    </div>

                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">{t("Tipo de caso", "Case type")}</div>
                        <div className="tableCellStack">
                          <span>{caseTypeLabel(selectedCase.caseType)}</span>
                          <Badge tone={priorityTone(selectedCase.priority)}>{selectedCase.priority}</Badge>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Proyecto / activo", "Project / asset")}</div>
                        <div className="tableCellStack">
                          <strong>{selectedCase.projectName}</strong>
                          <span className="tableCellMuted">{selectedCase.assetLabel}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Responsable actual", "Current owner")}</div>
                        <div>{selectedCase.owner}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Estado", "Status")}</div>
                        <div>{selectedCase.status}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Cliente", "Customer")}</div>
                        <div>{selectedCase.customerName}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Próximo paso humano", "Next human step")}</div>
                        <div>{selectedHumanStep}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Módulo responsable", "Responsible module")}</div>
                        <div className="tableCellStack">
                          <strong>{localizeText(selectedTargetModule.moduleLabel)}</strong>
                          <span className="tableCellMuted">{localizeText(selectedTargetModule.ownerLabel)}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Compromiso al volver", "Return commitment")}</div>
                        <div>{selectedReportBack}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Puente operativo", "Operational bridge")}</div>
                        <div>{buildPostSaleWorkflow(selectedCase)}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Siguiente acción", "Next action")}</div>
                        <div>
                          <input
                            className="field"
                            value={nextActionDraft}
                            onChange={(event) => setNextActionDraft(event.target.value)}
                            placeholder={t("Describe el siguiente paso de campo, cliente o coordinación", "Describe the next field, customer or coordination step")}
                          />
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Postura de SLA", "SLA posture")}</div>
                        <div className="tableCellStack">
                          <strong>{t(`${selectedCase.slaHoursRemaining} horas restantes`, `${selectedCase.slaHoursRemaining} hours remaining`)}</strong>
                          <span className="tableCellMuted">
                            {t(
                              `${selectedCase.openFindings} hallazgos abiertos · ${selectedCase.pendingVisits} visitas pendientes`,
                              `${selectedCase.openFindings} open findings · ${selectedCase.pendingVisits} pending visits`
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Pulso del cliente", "Customer pulse")}</div>
                        <div>{t(`${selectedCase.customerSatisfaction}% satisfacción`, `${selectedCase.customerSatisfaction}% satisfaction`)}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Actualizado", "Updated")}</div>
                        <div>{new Date(selectedCase.updatedAt).toLocaleString()}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Reglas de negocio", "Business rules")}</div>
                        <div className="tableCellStack">
                          <span className="tableCellMuted">Closure requires zero open findings across the selected case.</span>
                          <span className="tableCellMuted">Closure is blocked if the SLA remains critically breached or the case health is critical.</span>
                          <span className="tableCellMuted">Customer validation is blocked while findings remain open or health stays critical.</span>
                          <span className="tableCellMuted">Closure now also requires the case to come from customer validation.</span>
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
                                disabled={
                                  isSaving ||
                                  (option.status === "customer_validation" &&
                                    (selectedCase.openFindings > 0 || selectedCase.health === "critical")) ||
                                  (option.status === "closed" &&
                                    (selectedCase.openFindings > 0 ||
                                      selectedCase.slaHoursRemaining < -4 ||
                                      selectedCase.health === "critical" ||
                                      selectedCase.status !== "customer_validation"))
                                }
                                onClick={() => void handleCaseAction(option.status, option.nextAction)}
                              >
                                {isSaving ? t("Guardando...", "Saving...") : option.label}
                              </button>
                            ))}
                          </div>
                          {actionMessage ? <span className="tableCellMuted">{actionMessage}</span> : null}
                          {actionError ? <span style={{ color: "var(--danger-700)" }}>{actionError}</span> : null}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No case selected"
                    description="Choose a delivery, warranty or incident case to inspect the SLA and move the workflow."
                    primaryAction={{ label: "Stay on post-sale", href: "/post-sale" }}
                  />
                )}
              </Card>

              <Card
                title={t("Cola operativa", "Operational queue")}
                description={t(
                  "Filtra la bandeja y cambia de caso sin perder la mesa de trabajo principal.",
                  "Filter the queue and switch cases without losing the main workbench."
                )}
              >
                <FilterBar summary={t(`${filteredCases.length} casos de post-venta coinciden con los filtros actuales`, `${filteredCases.length} post-sale cases match the current operating filters`)}>
                  <label className="fieldLabel">
                    {t("Salud", "Health")}
                    <select className="field" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                      <option value="all">{t("Todas", "All")}</option>
                      <option value="critical">{t("Crítica", "Critical")}</option>
                      <option value="watch">{t("En vigilancia", "Watch")}</option>
                      <option value="healthy">{t("Saludable", "Healthy")}</option>
                    </select>
                  </label>
                  <label className="fieldLabel">
                    {t("Prioridad", "Priority")}
                    <select className="field" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}>
                      <option value="all">{t("Todas", "All")}</option>
                      <option value="critical">{t("Crítica", "Critical")}</option>
                      <option value="urgent">{t("Urgente", "Urgent")}</option>
                      <option value="normal">{t("Normal", "Normal")}</option>
                    </select>
                  </label>
                  <label className="fieldLabel" style={{ minWidth: 220 }}>
                    {t("Búsqueda", "Search")}
                    <input
                      className="field"
                      type="search"
                      value={searchFilter}
                      onChange={(event) => setSearchFilter(event.target.value)}
                      placeholder={t("Proyecto, cliente, activo o siguiente acción", "Project, customer, asset or next action")}
                    />
                  </label>
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? t(`modo demo · ${source}`, `demo mode · ${source}`) : t("backend en vivo", "live backend")}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("post-venta lista", "post-sale ready")}</Badge>
                  <Badge tone={filteredSummary.criticalCases > 0 ? "danger" : filteredSummary.urgentCases > 0 ? "warning" : "success"}>
                    {filteredSummary.criticalCases > 0
                      ? t(`${filteredSummary.criticalCases} críticos`, `${filteredSummary.criticalCases} critical`)
                      : filteredSummary.urgentCases > 0
                        ? t(`${filteredSummary.urgentCases} urgentes`, `${filteredSummary.urgentCases} urgent`)
                        : t("subconjunto visible controlado", "visible subset controlled")}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredCases}
                  columns={[
                    {
                      key: "case",
                      label: t("Caso", "Case"),
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedCaseId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.assetLabel}</strong>
                            <span className="tableCellMuted">
                              {caseTypeLabel(row.caseType)} · {row.code}
                            </span>
                            {shouldShowDocumentControlPreload && documentControlMatch?.item.id === row.id ? (
                              <Badge tone="info">{t("Precargado desde control documental", "Preloaded from document control")}</Badge>
                            ) : null}
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "customer",
                      label: t("Cliente", "Customer"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.customerName}</strong>
                          <span className="tableCellMuted">{row.projectName}</span>
                        </div>
                      )
                    },
                    {
                      key: "sla",
                      label: t("SLA / hallazgos", "SLA / findings"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.slaHoursRemaining} h</strong>
                          <span className="tableCellMuted">
                            {row.openFindings} findings · {row.pendingVisits} visits
                          </span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: t("Salud", "Health"),
                      render: (row) => <Badge tone={healthTone(row.health)}>{row.health}</Badge>
                    }
                  ]}
                />
              </Card>
            </section>

            <section className="grid cols1">
              <Card
                title={t("Detalles operativos", "Operational details")}
                description={t(
                  "Analítica secundaria, continuidad ampliada y riesgos detrás de una sección claramente separada del control principal.",
                  "Secondary analytics, expanded continuity and risks behind a section clearly separated from the main control."
                )}
              >
                <details>
                  <summary>{t("Abrir detalles de continuidad, analítica y riesgos", "Open continuity, analytics and risk details")}</summary>
                  <div className="grid cols4" style={{ marginTop: 16 }}>
                    <KpiCard
                      label="Open cases"
                      value={String(filteredSummary.openCases)}
                      footnote="Deliveries, warranties and incidents still under active attention."
                    />
                    <KpiCard
                      label="Critical cases"
                      value={String(filteredSummary.criticalCases)}
                      footnote="Queues under severe customer, findings or response pressure."
                    />
                    <KpiCard
                      label="Overdue SLA"
                      value={String(overview.summary.overdueSlaCases)}
                      footnote="Cases already breaching their expected response or resolution target."
                    />
                    <KpiCard
                      label="Awaiting sign-off"
                      value={String(overview.summary.pendingCustomerSignoff)}
                      footnote="Cases waiting for explicit customer validation before clean closure."
                    />
                  </div>

                  <div className="grid cols2" style={{ marginTop: 16 }}>
                    <Card
                      title="Post-sale continuity"
                      description="Post-sale should connect delivery, warranty, compliance and documentation in a single customer lane."
                      aside={<Badge tone={filteredSummary.criticalCases > 0 ? "danger" : filteredSummary.urgentCases > 0 ? "warning" : "success"}>{filteredSummary.criticalCases > 0 ? "critical queue" : filteredSummary.urgentCases > 0 ? "urgent queue" : "stable queue"}</Badge>}
                    >
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">Current route</div><div>{buildPostSaleWorkflow(selectedCase)}</div></div>
                        <div className="detailRow"><div className="detailLabel">Customer use</div><div>Use this queue to keep the customer promise alive while checking legal, quality and evidence dependencies in parallel.</div></div>
                        <div className="detailRow"><div className="detailLabel">Expected jump</div><div>Move into compliance, document control or quality based on the real reason the case is not yet closable.</div></div>
                      </div>
                      <div className="row gap wrap" style={{ marginTop: 16 }}>
                        <Link className="button" href="/compliance">Open compliance</Link>
                        <Link className="buttonGhost" href="/document-control">Open document control</Link>
                        <Link className="buttonGhost" href="/quality">Open quality</Link>
                        <Link className="buttonGhost" href="/crm">Open CRM</Link>
                      </div>
                    </Card>

                    <Card
                      title={t("Señales del caso seleccionado", "Selected case signals")}
                      description={t(
                        "Lectura secundaria de entrega, cumplimiento y dependencia documental del caso activo.",
                        "Secondary readout of delivery, compliance and document dependency for the active case."
                      )}
                    >
                      <div className="detailGrid">
                        <div className="detailRow">
                          <div className="detailLabel">{t("Señal de entrega", "Delivery signal")}</div>
                          <div>{selectedStory?.deliverySignal ?? "Choose a case to inspect delivery continuity."}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Carpeta de cumplimiento", "Compliance folder")}</div>
                          <div>{selectedStory?.complianceSignal ?? "Choose a case to inspect linked compliance posture."}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Dependencia documental", "Document dependency")}</div>
                          <div>{selectedStory?.documentSignal ?? "Choose a case to inspect document dependency."}</div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <Card title="Risks and exceptions" description="Current blockers, customer risks and exception drivers for the selected case or full queue.">
                      <DataTable
                        rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
                        columns={[
                          {
                            key: "risk",
                            label: "Risk",
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
                  </div>
                </details>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="Post-sale overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open compliance", href: "/compliance" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading post-sale" : "Post-sale overview not loaded yet"}
            description={
              isDemoMode
                ? "This route should load demo deliveries, warranties and incidents so human users can validate the queue."
                : "Pulling deliveries, warranties, incidents and customer SLA posture."
            }
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
