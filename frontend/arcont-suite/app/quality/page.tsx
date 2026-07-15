"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import type { QualityInspectionContract, QualityOverviewContract } from "@/lib/contracts";
import { createQualityInspection, fetchEquipmentOverview, fetchQualityOverview, updateQualityInspection } from "@/lib/platform-api";

type TranslateFn = (spanish: string, english: string) => string;

function severityTone(severity: QualityInspectionContract["severity"]) {
  switch (severity) {
    case "critical":
      return "danger";
    case "major":
      return "warning";
    default:
      return "info";
  }
}

function qualityActionOptions(inspection: QualityInspectionContract) {
  switch (inspection.status) {
    case "blocked":
      return [
        {
          label: { es: "Reactivar correccion en campo", en: "Reactivate field correction" },
          status: "in_progress" as const,
          nextAction: "Resume correction crew and capture fresh evidence from the field"
        },
        {
          label: { es: "Pasar a revision de liberacion", en: "Move into release review" },
          status: "pending_release" as const,
          nextAction: "Confirm remaining punch items and schedule release walkthrough"
        }
      ];
    case "in_progress":
      return [
        {
          label: { es: "Lista para revision de liberacion", en: "Ready for release review" },
          status: "pending_release" as const,
          nextAction: "Validate evidence package and prepare release walkthrough"
        },
        {
          label: { es: "Declarar bloqueo de liberacion", en: "Declare release blocker" },
          status: "blocked" as const,
          nextAction: "Escalate blocker and hold release until field correction is confirmed"
        }
      ];
    case "pending_release":
      return [
        {
          label: { es: "Regresar a correccion", en: "Return to correction" },
          status: "in_progress" as const,
          nextAction: "Return punch list to field team and update closeout evidence"
        },
        {
          label: { es: "Detener walkthrough de liberacion", en: "Stop release walkthrough" },
          status: "blocked" as const,
          nextAction: "Pause release and document the blocker before the next walkthrough"
        }
      ];
    case "scheduled":
      return [
        {
          label: { es: "Arrancar recorrido de calidad", en: "Start quality walkthrough" },
          status: "in_progress" as const,
          nextAction: "Start the checklist in field and upload the first evidence batch"
        }
      ];
    default:
      return [];
  }
}

function recomputeSummary(inspectionsBoard: QualityInspectionContract[]) {
  const openFindings = inspectionsBoard.reduce((sum, inspection) => sum + inspection.openFindings, 0);
  const releaseReadiness =
    inspectionsBoard.length > 0
      ? Number((inspectionsBoard.reduce((sum, inspection) => sum + inspection.releaseReadiness, 0) / inspectionsBoard.length).toFixed(1))
      : 0;
  const averageReworkRate =
    inspectionsBoard.length > 0
      ? Number((inspectionsBoard.reduce((sum, inspection) => sum + inspection.reworkRate, 0) / inspectionsBoard.length).toFixed(1))
      : 0;

  return {
    inspections: inspectionsBoard.length,
    openFindings,
    releaseReadiness,
    averageReworkRate,
    executionRiskInspections: inspectionsBoard.filter(
      (item) => item.latestDailyLogStatus === "flagged" || item.projectStatus === "blocked" || item.openFindings > 3
    ).length
  };
}

type QualityBridgeContext = {
  equipment: NonNullable<Awaited<ReturnType<typeof fetchEquipmentOverview>>>;
} | null;

function buildQualityStory(inspection: QualityInspectionContract | null, bridge: QualityBridgeContext, t: TranslateFn) {
  if (!inspection) {
    return null;
  }

  const machineSignal = bridge?.equipment.focusMachine ?? null;

  return {
    equipmentReadiness: machineSignal
      ? t(
          `${machineSignal.machineName} es el activo de referencia ahora mismo con estado ${machineSignal.status}, salud ${machineSignal.health} y ${machineSignal.availabilityPercent}% de disponibilidad.`,
          `${machineSignal.machineName} is the current asset anchor with status ${machineSignal.status}, health ${machineSignal.health} and ${machineSignal.availabilityPercent}% availability.`
        )
      : t("No hay un activo de referencia visible para este carril de inspeccion.", "No equipment anchor is currently visible for this inspection lane."),
    fieldCorrectionSupport:
      inspection.status === "blocked"
        ? t(
            `${inspection.contractorName} todavia necesita una correccion inmediata antes de reactivar la liberacion.`,
            `${inspection.contractorName} still needs an immediate correction push before release can resume.`
          )
        : t(
            `${inspection.contractorName} avanza con ${inspection.openFindings} hallazgos abiertos y ${inspection.evidenceCompletion}% de evidencia cargada.`,
            `${inspection.contractorName} is moving under ${inspection.openFindings} open findings and ${inspection.evidenceCompletion}% evidence completion.`
          ),
    releaseConstraint: machineSignal
      ? t(
          `${inspection.code} y ${machineSignal.machineName} definen la postura de liberacion de hoy: ${inspection.releaseReadiness}% de liberacion con ${machineSignal.criticalOpenFailures} fallas criticas abiertas del lado del activo.`,
          `${inspection.code} and ${machineSignal.machineName} together define today's release posture: ${inspection.releaseReadiness}% readiness with ${machineSignal.criticalOpenFailures} critical failures still open on the asset side.`
        )
      : t(
          `${inspection.code} hoy carga una restriccion de liberacion propia con ${inspection.openFindings} hallazgos abiertos.`,
          `${inspection.code} currently carries a standalone release constraint with ${inspection.openFindings} open findings.`
        )
  };
}

function createQualityExample() {
  return {
    projectName: "Torre Demo Acabados",
    areaName: "Frente Acabados",
    checklistName: "Liberacion de muros y detalles",
    contractorName: "Acabados Integrales",
    severity: "critical" as QualityInspectionContract["severity"],
    openFindings: "4",
    evidenceCompletion: "62",
    releaseReadiness: "48",
    reworkRate: "18",
    status: "blocked" as QualityInspectionContract["status"],
    nextAction: "Corregir hallazgos mayores y completar evidencia antes de reactivar la liberacion."
  };
}

function createQualityPreset(
  preset: "release_ready" | "evidence_gap" | "blocked_release"
): ReturnType<typeof createQualityExample> {
  switch (preset) {
    case "release_ready":
      return {
        projectName: "Torre Demo Acabados",
        areaName: "Frente Acabados",
        checklistName: "Liberacion final de detalles",
        contractorName: "Acabados Integrales",
        severity: "major" as QualityInspectionContract["severity"],
        openFindings: "1",
        evidenceCompletion: "94",
        releaseReadiness: "92",
        reworkRate: "4",
        status: "pending_release" as QualityInspectionContract["status"],
        nextAction: "Cerrar observación menor y ejecutar walkthrough final de liberacion."
      };
    case "evidence_gap":
      return {
        projectName: "Torre Demo Acabados",
        areaName: "Frente Pintura",
        checklistName: "Evidencia de liberacion por area",
        contractorName: "Pinturas del Sureste",
        severity: "major" as QualityInspectionContract["severity"],
        openFindings: "2",
        evidenceCompletion: "58",
        releaseReadiness: "63",
        reworkRate: "9",
        status: "in_progress" as QualityInspectionContract["status"],
        nextAction: "Completar evidencia faltante y reservar reinspeccion antes del siguiente cierre."
      };
    default:
      return createQualityExample();
  }
}

function buildCreateInspectionGate(input: {
  projectName: string;
  areaName: string;
  checklistName: string;
  contractorName: string;
  severity: QualityInspectionContract["severity"];
  status: QualityInspectionContract["status"];
  openFindings: number;
  evidenceCompletion: number;
  releaseReadiness: number;
  reworkRate: number;
  nextAction: string;
}) {
  const checks: string[] = [];

  if ([input.projectName, input.areaName, input.checklistName, input.contractorName].some((value) => value.trim().length < 3)) {
    checks.push("Project, area, checklist and contractor still need more specific capture.");
  }

  if (!Number.isFinite(input.openFindings) || input.openFindings < 0) {
    checks.push("Open findings must be a valid non-negative number.");
  }

  if (!Number.isFinite(input.evidenceCompletion) || input.evidenceCompletion < 0 || input.evidenceCompletion > 100) {
    checks.push("Evidence completion must stay between 0 and 100.");
  }

  if (!Number.isFinite(input.releaseReadiness) || input.releaseReadiness < 0 || input.releaseReadiness > 100) {
    checks.push("Release readiness must stay between 0 and 100.");
  }

  if (!Number.isFinite(input.reworkRate) || input.reworkRate < 0) {
    checks.push("Rework rate must be a valid non-negative number.");
  }

  if (input.status === "pending_release" && input.openFindings > 3) {
    checks.push("Pending release inspections require at most 3 open findings.");
  }

  if (input.status === "pending_release" && input.evidenceCompletion < 85) {
    checks.push("Pending release inspections require at least 85% evidence.");
  }

  if (input.releaseReadiness < input.evidenceCompletion - 45) {
    checks.push("Release readiness looks too weak compared with current evidence posture.");
  }

  if (input.severity === "critical" && input.status === "pending_release" && input.releaseReadiness < 90) {
    checks.push("Critical inspections should not enter release review below 90% release readiness.");
  }

  if (input.nextAction.trim().length < 8) {
    checks.push("Next action still needs enough detail for correction or release follow-through.");
  }

  if (checks.length > 0) {
    const hardBlock =
      (input.status === "pending_release" && input.openFindings > 3) ||
      (input.status === "pending_release" && input.evidenceCompletion < 85) ||
      (input.severity === "critical" && input.status === "pending_release" && input.releaseReadiness < 90);

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock ? "Do not create yet" : "Create with control",
      summary: hardBlock
        ? "This inspection would open with a hard release blocker."
        : "The inspection can be created, but release discipline still needs tightening.",
      checks
    };
  }

  return {
    tone: "success" as const,
    label: "Ready to create",
    summary: "The inspection has enough structure to enter the release lane cleanly.",
    checks: [
      "The created inspection will become the current focus item immediately.",
      "Keep findings, evidence and next release action attached from the first capture."
    ]
  };
}

function buildCreateInspectionHumanStep(
  input: {
  status: QualityInspectionContract["status"];
  openFindings: number;
  evidenceCompletion: number;
  releaseReadiness: number;
  nextAction: string;
},
  t: TranslateFn
) {
  if (input.status === "pending_release" && input.evidenceCompletion < 85) {
    return t(
      "Cierra primero la brecha de evidencia para que la revision de liberacion no arranque comprometida.",
      "Close the evidence gap first so release review does not start already compromised."
    );
  }

  if (input.status === "pending_release" && input.openFindings > 3) {
    return t(
      "Reduce los hallazgos abiertos antes de mover esta inspeccion a revision de liberacion.",
      "Reduce open findings before moving this inspection into release review."
    );
  }

  if (input.releaseReadiness < 75) {
    return t(
      "Crea la inspeccion y manda la siguiente accion directo a correccion en campo antes de prometer liberacion.",
      "Create the inspection and route the next action straight into field correction before promising release."
    );
  }

  if (input.nextAction.trim().length < 8) {
    return t(
      "Aclara el paso inmediato de correccion o liberacion antes de guardar la inspeccion.",
      "Clarify the immediate correction or release step before persisting the inspection."
    );
  }

  return t(
    "Crea la inspeccion y continua directo a correccion, cierre de evidencia o walkthrough de liberacion.",
    "Create the inspection and continue directly into field correction, evidence closure or release walkthrough."
  );
}

function buildCreateInspectionDestination(
  input: {
  status: QualityInspectionContract["status"];
  evidenceCompletion: number;
  releaseReadiness: number;
  openFindings: number;
},
  t: TranslateFn
) {
  if (input.status === "blocked" || input.openFindings > 3) {
    return {
      label: { es: "Abrir campo", en: "Open field" },
      href: "/field",
      description: t(
        "La correccion todavia pertenece a campo antes de que calidad trate la liberacion como real.",
        "Correction work still belongs in field before quality can treat release as real."
      )
    };
  }

  if (input.evidenceCompletion < 85) {
    return {
      label: { es: "Abrir control documental", en: "Open document control" },
      href: "/document-control",
      description: t(
        "La postura de evidencia sigue debil, asi que el siguiente movimiento debe reforzar la documentacion tecnica.",
        "Evidence posture is still weak, so the next move should reinforce technical documentation."
      )
    };
  }

  if (input.releaseReadiness < 75) {
    return {
      label: { es: "Abrir bitacora", en: "Open daily log" },
      href: "/daily-log",
      description: t(
        "El carril de liberacion sigue debil y supervision debe ver el impacto en continuidad.",
        "The release lane is still weak enough that site supervision should see the continuity impact."
      )
    };
  }

  return {
    label: { es: "Abrir cumplimiento", en: "Open compliance" },
    href: "/compliance",
    description: t(
      "Si hallazgos y evidencia ya estan bajo control, continua hacia liberacion y cumplimiento.",
      "If findings and evidence are under control, continue into release and compliance discipline."
    )
  };
}

function buildQualityWorkflow(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return t(
      "Usa calidad como el carril tecnico entre ejecucion en campo, correccion y liberacion final.",
      "Use quality as the technical release lane between field execution, correction work and final release posture."
    );
  }

  if (inspection.status === "blocked") {
    return t(
      "Una inspeccion bloqueada debe volver de inmediato a correccion en campo, captura de evidencia y continuidad de activos antes de reconsiderar la liberacion.",
      "A blocked inspection should route immediately back into field correction, evidence capture and asset continuity before release is reconsidered."
    );
  }

  if (inspection.status === "pending_release") {
    return t(
      "Una inspeccion pendiente de liberacion debe cerrar rapido hallazgos y evidencia para tomar una decision limpia de liberacion.",
      "A pending-release inspection should close findings and evidence fast so the team can make a clean release decision."
    );
  }

  return t(
    "Una inspeccion activa debe mantener alineados correccion en campo, seguimiento al contratista y liberacion.",
    "An active inspection should keep field correction, contractor follow-up and release readiness aligned in the same lane."
  );
}

function buildQualityWhyNow(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return t("Selecciona una inspeccion para entender por que calidad debe actuar ahora.", "Select an inspection to understand why quality should act right now.");
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return t(
      `${inspection.areaName} ya esta en bloqueo o con demasiados hallazgos, asi que retrasar la accion mantendra atoradas la liberacion y la continuidad de obra.`,
      `${inspection.areaName} is already under blocked or heavy-findings posture, so delaying action now will keep release and site continuity artificially stuck.`
    );
  }

  if (inspection.evidenceCompletion < 85) {
    return t(
      `${inspection.areaName} todavia no tiene evidencia suficiente para sostener una liberacion creible, asi que esperar solo pasa un cierre debil aguas abajo.`,
      `${inspection.areaName} still lacks enough evidence to support a credible release decision, so waiting only passes weak closeout downstream.`
    );
  }

  if (inspection.releaseReadiness < 75 || inspection.projectStatus === "blocked") {
    return t(
      `${inspection.areaName} sigue con una postura debil de liberacion, y esta inspeccion importa ahora porque campo y cierre todavia dependen de ella.`,
      `${inspection.areaName} still carries weak release posture, so this inspection matters now because field and closeout decisions still depend on it.`
    );
  }

  return t(
    `${inspection.areaName} esta cerca de liberar, asi que la accion util ahora es cerrar las ultimas brechas tecnicas antes de desperdiciar otro ciclo de revision.`,
    `${inspection.areaName} is near release, so the useful action now is to close the last technical gaps before another review cycle is wasted.`
  );
}

function buildQualityDownstreamEffect(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return t("Selecciona una inspeccion para ver que carril aguas abajo absorbe el impacto.", "Select an inspection to inspect which downstream lane absorbs the impact.");
  }

  if (inspection.status === "blocked") {
    return t(
      "Si esta inspeccion sigue bloqueada, ejecucion en campo, supervision diaria y planeacion de liberacion heredaran el freno.",
      "If this inspection stays blocked, field execution, daily supervision and release planning will all inherit the stall next."
    );
  }

  if (inspection.evidenceCompletion < 85) {
    return t(
      "Si la evidencia sigue debil, control documental, cumplimiento y cierre heredaran soporte incompleto y retrabajo evitable.",
      "If evidence remains weak, document control, compliance and close-control will inherit incomplete release support and avoidable rework."
    );
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return t(
      "Si hallazgos o liberacion no mejoran, la correccion en campo y la secuencia final de liberacion seguiran girando sobre la misma area sin resolver.",
      "If findings or readiness do not improve, field correction and final release sequencing will keep looping around the same unresolved area."
    );
  }

  return t(
    "Si esta inspeccion cierra limpia, liberacion, cumplimiento y entrega aguas abajo podran avanzar sin reconstruir la historia tecnica.",
    "If this inspection closes cleanly, release, compliance and downstream turnover can move without rebuilding the technical story."
  );
}

function buildQualityHumanStep(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return t("Selecciona una inspeccion para definir el siguiente relevo humano.", "Select an inspection to define the next human handoff.");
  }

  if (inspection.status === "blocked") {
    return t(
      "Indica a campo y al contratista exactamente que debe corregirse, quien lo toma y cuando ocurre el siguiente walkthrough.",
      "Tell field and the contractor exactly what must be corrected, who owns it and when the next walkthrough happens."
    );
  }

  if (inspection.evidenceCompletion < 85) {
    return t(
      "Indica al responsable de evidencia que falta antes de que alguien trate esta area como lista para revision de liberacion.",
      "Tell the evidence owner what is still missing before anyone treats this area as ready for release review."
    );
  }

  if (inspection.openFindings > 0) {
    return t(
      "Indica al contratista que hallazgos siguen abiertos y cuando calidad espera el paquete corregido para reinspeccion.",
      "Tell the contractor which findings remain open and when quality expects the corrected package back for reinspection."
    );
  }

  return t(
    "Indica al responsable de liberacion y al equipo de control aguas abajo que el area esta lista para el siguiente paso formal.",
    "Tell the release owner and downstream control team that the area is ready for the next formal release step."
  );
}

function buildQualityReportBack(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return t("Selecciona una inspeccion para definir cuando debe reportar el responsable.", "Select an inspection to define when the responsible owner should report back.");
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return t(
      "Pide reporte en el mismo ciclo operativo con responsable de correccion, estado de evidencia y proxima reinspeccion.",
      "Report back in the same operating cycle with correction ownership, evidence status and the next reinspection moment."
    );
  }

  if (inspection.evidenceCompletion < 85) {
    return t(
      "Pide reporte cuando la evidencia faltante ya este explicita y pueda sostener la revision sin huecos ocultos.",
      "Report back once the missing evidence is explicit enough to support release review without hidden gaps."
    );
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return t(
      "Pide reporte cuando hallazgos y liberacion ya esten alineados para una decision creible.",
      "Report back when findings and readiness are already aligned enough for a credible release decision."
    );
  }

  return t(
    "Pide reporte en el siguiente checkpoint confirmando que el area salio de correccion y entro en liberacion limpia.",
    "Report back at the next release checkpoint confirming the area truly moved out of correction and into clean release posture."
  );
}

function buildQualityRouteSummary(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return t(
      "Usa calidad como el carril de liberacion entre correccion en campo, control de evidencia y cierre listo para cumplimiento.",
      "Use quality as the release lane between field correction, evidence control and final compliance-ready closure."
    );
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return t(
      "Esta inspeccion debe pasar primero por correccion en campo y recuperacion de evidencia antes de volver a considerar creible la liberacion.",
      "This inspection should route first through field correction and evidence recovery before release is considered credible again."
    );
  }

  if (inspection.evidenceCompletion < 85) {
    return t(
      "Esta inspeccion debe pasar por una disciplina mas fuerte de evidencia y control documental antes de que otros equipos asuman que la liberacion es defendible.",
      "This inspection should route through stronger evidence and document discipline before downstream teams assume release is defensible."
    );
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return t(
      "Esta inspeccion debe pasar por cierre de correccion y reinspeccion antes de que cumplimiento o closeout hereden la misma area debil.",
      "This inspection should route through correction closure and reinspection before compliance or closeout inherit the same weak area."
    );
  }

  return t(
    "Esta inspeccion puede seguir hacia cumplimiento y entrega aguas abajo con la historia tecnica actual intacta.",
    "This inspection can continue through compliance and downstream turnover with the current technical story intact."
  );
}

function buildQualityOperationalLinks(inspection: QualityInspectionContract | null) {
  if (!inspection) {
    return [
      { label: { es: "Abrir campo", en: "Open field" }, href: "/field" },
      { label: { es: "Abrir bitacora", en: "Open daily log" }, href: "/daily-log" },
      { label: { es: "Abrir equipo", en: "Open equipment" }, href: "/equipment" },
      { label: { es: "Abrir control documental", en: "Open document control" }, href: "/document-control" }
    ];
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return [
      { label: { es: "Abrir campo", en: "Open field" }, href: "/field" },
      { label: { es: "Abrir bitacora", en: "Open daily log" }, href: "/daily-log" },
      { label: { es: "Abrir equipo", en: "Open equipment" }, href: "/equipment" }
    ];
  }

  if (inspection.evidenceCompletion < 85) {
    return [
      { label: { es: "Abrir campo", en: "Open field" }, href: "/field" },
      { label: { es: "Abrir bitacora", en: "Open daily log" }, href: "/daily-log" },
      { label: { es: "Abrir equipo", en: "Open equipment" }, href: "/equipment" },
      { label: { es: "Abrir control documental", en: "Open document control" }, href: "/document-control" },
    ];
  }

  if (inspection.releaseReadiness < 75 || inspection.openFindings > 0) {
    return [
      { label: { es: "Abrir campo", en: "Open field" }, href: "/field" },
      { label: { es: "Abrir bitacora", en: "Open daily log" }, href: "/daily-log" },
      { label: { es: "Abrir equipo", en: "Open equipment" }, href: "/equipment" },
      { label: { es: "Abrir control documental", en: "Open document control" }, href: "/document-control" }
    ];
  }

  return [
    { label: { es: "Abrir campo", en: "Open field" }, href: "/field" },
    { label: { es: "Abrir bitacora", en: "Open daily log" }, href: "/daily-log" },
    { label: { es: "Abrir equipo", en: "Open equipment" }, href: "/equipment" },
    { label: { es: "Abrir control documental", en: "Open document control" }, href: "/document-control" }
  ];
}

function buildQualityImmediateModule(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return {
      module: t("Calidad", "Quality"),
      lane: "quality",
      reason: t(
        "Toma una inspeccion primero para decidir que modulo absorbe el siguiente relevo operativo.",
        "Pick an inspection first to decide which module should absorb the next operating handoff."
      )
    };
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return {
      module: t("Campo", "Field"),
      lane: "field",
      reason: t(
        "Campo toma el frente primero porque la correccion fisica y la reasignacion inmediata siguen siendo el cuello de botella real.",
        "Field owns the front first because physical correction and immediate crew reassignment are still the real bottleneck."
      )
    };
  }

  if (inspection.evidenceCompletion < 85) {
    return {
      module: t("Control documental", "Document control"),
      lane: "document-control",
      reason: t(
        "Control documental toma el relevo inmediato porque la liberacion no se sostiene todavia sin evidencia tecnica completa.",
        "Document control takes the immediate handoff because release still cannot stand without a complete technical evidence package."
      )
    };
  }

  if (inspection.projectStatus === "blocked" || inspection.latestDailyLogStatus === "flagged") {
    return {
      module: t("Bitacora diaria", "Daily log"),
      lane: "daily-log",
      reason: t(
        "Bitacora diaria debe absorber el siguiente paso porque la continuidad del frente sigue marcada y supervision necesita dejarla explicita.",
        "Daily log should absorb the next step because front continuity is still flagged and site supervision needs to make that visible."
      )
    };
  }

  return {
    module: t("Equipo", "Equipment"),
    lane: "equipment",
    reason: t(
      "Equipo queda como responsable inmediato para confirmar que la liberacion no esta escondiendo una restriccion de activos o disponibilidad.",
      "Equipment becomes the immediate owner to confirm release is not hiding an asset or availability constraint."
    )
  };
}

function buildQualitySecondJump(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return {
      module: t("Campo", "Field"),
      lane: "field",
      reason: t(
        "Despues del primer relevo, campo suele absorber el segundo salto para ejecutar lo que calidad termine definiendo.",
        "After the first handoff, field usually absorbs the second jump to execute what quality ends up defining."
      )
    };
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return {
      module: t("Bitacora diaria", "Daily log"),
      lane: "daily-log",
      reason: t(
        "Despues de correccion en campo, bitacora diaria debe dejar visible el bloqueo removido, el responsable y la fecha real de reinspeccion.",
        "After field correction, the daily log should make the removed blocker, owner and real reinspection date explicit."
      )
    };
  }

  if (inspection.evidenceCompletion < 85) {
    return {
      module: t("Campo", "Field"),
      lane: "field",
      reason: t(
        "Despues del ajuste documental, campo debe cerrar la captura faltante en origen para que la evidencia no regrese incompleta.",
        "After the document fix, field must close the missing capture at the source so evidence does not come back incomplete."
      )
    };
  }

  if (inspection.projectStatus === "blocked" || inspection.latestDailyLogStatus === "flagged") {
    return {
      module: t("Equipo", "Equipment"),
      lane: "equipment",
      reason: t(
        "Con la continuidad del frente aclarada, equipo debe validar que no quede una restriccion de activos escondida antes de liberar.",
        "Once front continuity is clarified, equipment must validate that no hidden asset constraint remains before release."
      )
    };
  }

  return {
    module: t("Control documental", "Document control"),
    lane: "document-control",
    reason: t(
      "Despues de confirmar activos, control documental debe consolidar la evidencia final para que calidad pueda cerrar sin reconstruir la historia.",
      "After asset confirmation, document control should consolidate the final evidence so quality can close without rebuilding the story."
    )
  };
}

function buildQualityPrimaryCta(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return {
      label: t("Seguir en calidad", "Stay on quality"),
      href: "/quality",
      reason: t(
        "Toma una inspeccion primero para abrir el modulo correcto.",
        "Pick an inspection first to open the right module."
      )
    };
  }

  if (inspection.status === "scheduled") {
    return {
      label: t("Abrir field y arrancar recorrido", "Open field and start walkthrough"),
      href: "/field",
      reason: t(
        "Una inspeccion programada todavia necesita arrancar el checklist y capturar la primera evidencia en campo.",
        "A scheduled inspection still needs to start the checklist and capture the first field evidence."
      )
    };
  }

  if (inspection.status === "blocked") {
    return {
      label: t("Abrir field para reactivar correccion", "Open field to reactivate correction"),
      href: "/field",
      reason: t(
        "El estado bloqueado exige mover primero la correccion fisica antes de cualquier promesa de liberacion.",
        "Blocked status requires moving physical correction first before any release promise."
      )
    };
  }

  if (inspection.status === "pending_release" && inspection.openFindings > 0) {
    return {
      label: t("Abrir field para cerrar hallazgos", "Open field to close findings"),
      href: "/field",
      reason: t(
        "Una pendiente de liberacion con hallazgos abiertos debe regresar a cierre puntual antes del walkthrough final.",
        "A pending-release inspection with open findings must return to targeted closure before the final walkthrough."
      )
    };
  }

  if (inspection.evidenceCompletion < 85) {
    return {
      label: t("Abrir document-control para cerrar evidencia", "Open document control to close evidence"),
      href: "/document-control",
      reason: t(
        "Sin 85% de evidencia, el siguiente movimiento util es cerrar el paquete documental antes de insistir en liberacion.",
        "Without 85% evidence, the useful next move is to close the document package before pushing release again."
      )
    };
  }

  if (inspection.projectStatus === "blocked" || inspection.latestDailyLogStatus === "flagged") {
    return {
      label: t("Abrir daily-log para aclarar continuidad", "Open daily log to clarify continuity"),
      href: "/daily-log",
      reason: t(
        "La supervision todavia necesita dejar explicita la continuidad del frente antes de sostener la liberacion.",
        "Supervision still needs to make front continuity explicit before release can stand."
      )
    };
  }

  if (inspection.status === "pending_release") {
    return {
      label: t("Abrir equipment para sostener liberacion", "Open equipment to support release"),
      href: "/equipment",
      reason: t(
        "Una pendiente de liberacion limpia debe validar que activos y disponibilidad no escondan la siguiente caida operativa.",
        "A clean pending-release item should validate that assets and availability are not hiding the next operating failure."
      )
    };
  }

  return {
    label: t("Abrir equipment para confirmar restriccion", "Open equipment to confirm constraint"),
    href: "/equipment",
    reason: t(
      "En proceso y sin huecos fuertes de evidencia, el cuello real ya suele estar en activos y postura de liberacion.",
      "In progress and without major evidence gaps, the real bottleneck usually shifts to assets and release posture."
    )
  };
}

function buildQualityReturnConfirmation(inspection: QualityInspectionContract | null, t: TranslateFn) {
  if (!inspection) {
    return t(
      "Cuando vuelvas a calidad, regresa con responsable, siguiente modulo y criterio de reinspeccion ya confirmados.",
      "When you return to quality, come back with owner, next module and reinspection criteria already confirmed."
    );
  }

  if (inspection.status === "blocked" || inspection.openFindings > 3) {
    return t(
      "Regresa a calidad con la correccion ejecutada, responsable nombrado, siguiente walkthrough agendado y evidencia minima ya cargada.",
      "Return to quality with correction executed, owner named, next walkthrough scheduled and minimum evidence already uploaded."
    );
  }

  if (inspection.evidenceCompletion < 85) {
    return t(
      "Regresa a calidad con el paquete documental completo, huecos de evidencia cerrados y la reinspeccion ya justificable sin supuestos.",
      "Return to quality with the document package complete, evidence gaps closed and reinspection already defensible without assumptions."
    );
  }

  if (inspection.projectStatus === "blocked" || inspection.latestDailyLogStatus === "flagged") {
    return t(
      "Regresa a calidad con la continuidad del frente aclarada en bitacora, restricciones visibles y el siguiente paso de liberacion acordado.",
      "Return to quality with front continuity clarified in the daily log, constraints made visible and the next release step agreed."
    );
  }

  return t(
    "Regresa a calidad con disponibilidad de equipo confirmada, sin restriccion critica abierta y con via libre para liberar o cerrar hallazgos.",
    "Return to quality with equipment availability confirmed, no critical constraint left open and a clear path to release or close findings."
  );
}

function localizeSeverity(severity: QualityInspectionContract["severity"], t: (spanish: string, english: string) => string) {
  switch (severity) {
    case "critical":
      return t("critica", "critical");
    case "major":
      return t("mayor", "major");
    default:
      return t("menor", "minor");
  }
}

function localizeInspectionStatus(status: QualityInspectionContract["status"], t: (spanish: string, english: string) => string) {
  switch (status) {
    case "scheduled":
      return t("programada", "scheduled");
    case "in_progress":
      return t("en proceso", "in progress");
    case "pending_release":
      return t("pendiente liberacion", "pending release");
    default:
      return t("bloqueada", "blocked");
  }
}

function localizeProjectStatus(status: string, t: (spanish: string, english: string) => string) {
  switch (status) {
    case "blocked":
      return t("bloqueado", "blocked");
    case "at_risk":
      return t("en riesgo", "at risk");
    case "delayed":
      return t("retrasado", "delayed");
    case "on_track":
      return t("en ruta", "on track");
    default:
      return status;
  }
}

function localizeDailyLogStatus(status: string, t: (spanish: string, english: string) => string) {
  switch (status) {
    case "flagged":
      return t("marcada", "flagged");
    case "attention":
      return t("con atencion", "attention");
    case "clear":
      return t("limpia", "clear");
    default:
      return status;
  }
}

function QualityPageContent() {
  const appState = useAppState() as ReturnType<typeof useAppState> & {
    t?: (spanish: string, english?: string) => string;
    localizeText?: (value: string | { es?: string; en?: string }) => string;
  };
  const { activeCompany, apiBaseUrl, session } = appState;
  const localizeText = useMemo(
    () =>
      appState.localizeText ??
      ((value: string | { es?: string; en?: string }) => (typeof value === "string" ? value : value.es ?? value.en ?? "")),
    [appState.localizeText]
  );
  const t = useCallback((spanish: string, english: string) => localizeText({ es: spanish, en: english }), [localizeText]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<QualityOverviewContract | null>(null);
  const [bridgeContext, setBridgeContext] = useState<QualityBridgeContext>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | QualityInspectionContract["severity"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | QualityInspectionContract["status"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [createForm, setCreateForm] = useState({
    projectName: "Proyecto central",
    areaName: "Frente 1",
    checklistName: "Liberacion de acabados por frente",
    contractorName: "Contratista principal",
    severity: "major" as QualityInspectionContract["severity"],
    openFindings: "2",
    evidenceCompletion: "70",
    releaseReadiness: "65",
    reworkRate: "8",
    status: "in_progress" as QualityInspectionContract["status"],
    nextAction: ""
  });
  const createFormNumbers = useMemo(
    () => ({
      openFindings: Number(createForm.openFindings),
      evidenceCompletion: Number(createForm.evidenceCompletion),
      releaseReadiness: Number(createForm.releaseReadiness),
      reworkRate: Number(createForm.reworkRate)
    }),
    [createForm.evidenceCompletion, createForm.openFindings, createForm.releaseReadiness, createForm.reworkRate]
  );

  useEffect(() => {
    const project = searchParams.get("project");
    const area = searchParams.get("area");
    setProjectFilter(project && project.length > 0 ? project : "all");
    setAreaFilter(area && area.length > 0 ? area : "all");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      fetchQualityOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      }),
      fetchEquipmentOverview(activeCompany.id, {
        apiBaseUrl,
        accessToken: session.accessToken
      })
    ])
      .then(([result, equipment]) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Quality overview is unavailable right now.");
          return;
        }

        setOverview(result);
        setSelectedInspectionId((current) => current ?? result.focusInspection?.id ?? result.inspectionsBoard[0]?.id ?? null);
        setBridgeContext(equipment ? { equipment } : null);
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

  const selectedInspection = useMemo(
    () => overview?.inspectionsBoard.find((item) => item.id === selectedInspectionId) ?? overview?.focusInspection ?? null,
    [overview, selectedInspectionId]
  );

  const projectOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    return Array.from(new Set(overview.inspectionsBoard.map((item) => item.projectName))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [overview]);

  const areaOptions = useMemo(() => {
    if (!overview) {
      return [];
    }

    const scopedInspections =
      projectFilter === "all"
        ? overview.inspectionsBoard
        : overview.inspectionsBoard.filter((item) => item.projectName === projectFilter);

    return Array.from(new Set(scopedInspections.map((item) => item.areaName))).sort((left, right) => left.localeCompare(right));
  }, [overview, projectFilter]);

  const filteredInspections = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.inspectionsBoard.filter(
      (item) =>
        (projectFilter === "all" || item.projectName === projectFilter) &&
        (areaFilter === "all" || item.areaName === areaFilter) &&
        (severityFilter === "all" || item.severity === severityFilter) &&
        (statusFilter === "all" || item.status === statusFilter) &&
        (normalizedSearch.length === 0 ||
          item.contractorName.toLowerCase().includes(normalizedSearch) ||
          item.checklistName.toLowerCase().includes(normalizedSearch) ||
          item.code.toLowerCase().includes(normalizedSearch) ||
          item.nextAction.toLowerCase().includes(normalizedSearch))
    );
  }, [areaFilter, overview, projectFilter, searchFilter, severityFilter, statusFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredInspections), [filteredInspections]);

  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.inspectionId === selectedInspection?.id) ?? [],
    [overview, selectedInspection]
  );
  const selectedWhyNow = useMemo(() => buildQualityWhyNow(selectedInspection, t), [selectedInspection, t]);
  const selectedDownstreamEffect = useMemo(() => buildQualityDownstreamEffect(selectedInspection, t), [selectedInspection, t]);
  const selectedHumanStep = useMemo(() => buildQualityHumanStep(selectedInspection, t), [selectedInspection, t]);
  const selectedReportBack = useMemo(() => buildQualityReportBack(selectedInspection, t), [selectedInspection, t]);
  const selectedRouteSummary = useMemo(() => buildQualityRouteSummary(selectedInspection, t), [selectedInspection, t]);
  const selectedOperationalLinks = useMemo(() => buildQualityOperationalLinks(selectedInspection), [selectedInspection]);
  const selectedImmediateModule = useMemo(() => buildQualityImmediateModule(selectedInspection, t), [selectedInspection, t]);
  const selectedSecondJump = useMemo(() => buildQualitySecondJump(selectedInspection, t), [selectedInspection, t]);
  const selectedPrimaryCta = useMemo(() => buildQualityPrimaryCta(selectedInspection, t), [selectedInspection, t]);
  const selectedReturnConfirmation = useMemo(() => buildQualityReturnConfirmation(selectedInspection, t), [selectedInspection, t]);
  const selectedReleaseBlockers = useMemo(() => {
    if (!selectedInspection) {
      return [];
    }

    const blockers: string[] = [];

    if (selectedInspection.openFindings > 3) {
      blockers.push(
        t(
          `${selectedInspection.openFindings} hallazgos abiertos: baja a 3 o menos antes de enviar a revision de liberacion.`,
          `${selectedInspection.openFindings} open findings: reduce to 3 or fewer before sending to release review.`
        )
      );
    }

    if (selectedInspection.evidenceCompletion < 85) {
      blockers.push(
        t(
          `${selectedInspection.evidenceCompletion}% de evidencia: sube a 85% o mas para sostener el walkthrough.`,
          `${selectedInspection.evidenceCompletion}% evidence: raise to 85% or more to support the walkthrough.`
        )
      );
    }

    if (selectedInspection.severity === "critical" && selectedInspection.releaseReadiness < 90) {
      blockers.push(
        t(
          `Severidad critica con ${selectedInspection.releaseReadiness}% de liberacion: no cierres hasta llegar a 90% o mas.`,
          `Critical severity with ${selectedInspection.releaseReadiness}% readiness: do not close until it reaches 90% or more.`
        )
      );
    }

    if (selectedInspection.projectStatus === "blocked" || selectedInspection.latestDailyLogStatus === "flagged") {
      blockers.push(
        t(
          `La continuidad del proyecto sigue ${selectedInspection.projectStatus} y la bitacora esta ${selectedInspection.latestDailyLogStatus}; valida si el frente realmente puede liberar hoy.`,
          `Project continuity is still ${selectedInspection.projectStatus} and the daily log is ${selectedInspection.latestDailyLogStatus}; confirm whether the front can truly release today.`
        )
      );
    }

    return blockers;
  }, [selectedInspection, t]);
  const selectedOperatorHeading = useMemo(() => {
    if (!selectedInspection) {
      return t("Selecciona una inspeccion para operar la liberacion", "Select an inspection to operate the release lane");
    }

    return t(
      `${selectedInspection.areaName} · ${selectedInspection.checklistName}`,
      `${selectedInspection.areaName} · ${selectedInspection.checklistName}`
    );
  }, [selectedInspection, t]);
  const selectedNextMoveSummary = useMemo(() => {
    if (!selectedInspection) {
      return t("Toma una inspeccion de la cola o registra una nueva para arrancar el walkthrough.", "Pick an inspection from the queue or register a new one to start the walkthrough.");
    }

    if (selectedInspection.status === "blocked") {
      return t("Regresa a correccion en campo, asigna responsable y define reinspeccion hoy.", "Return to field correction, assign an owner, and set the reinspection today.");
    }

    if (selectedInspection.evidenceCompletion < 85) {
      return t("Cierra primero evidencia faltante y luego reintenta la revision de liberacion.", "Close missing evidence first, then retry release review.");
    }

    if (selectedInspection.openFindings > 0) {
      return t("Cierra hallazgos abiertos y actualiza la siguiente accion antes del walkthrough final.", "Close open findings and update the next action before the final walkthrough.");
    }

    return t("Confirma el walkthrough final y mueve el frente al siguiente control formal.", "Confirm the final walkthrough and move the front into the next formal control.");
  }, [selectedInspection, t]);

  const filteredRisks = useMemo(() => {
    if (!overview) {
      return [];
    }

    return overview.risks.filter((risk) => {
      const parent = overview.inspectionsBoard.find((item) => item.id === risk.inspectionId);
      return (
        (!!parent && (projectFilter === "all" || parent.projectName === projectFilter)) &&
        (!!parent && (areaFilter === "all" || parent.areaName === areaFilter))
      );
    });
  }, [areaFilter, overview, projectFilter]);

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredInspections.length === 0) {
      setSelectedInspectionId(null);
      return;
    }

    const isSelectedVisible = filteredInspections.some((item) => item.id === selectedInspectionId);
    if (!isSelectedVisible) {
      setSelectedInspectionId(filteredInspections[0]?.id ?? null);
    }
  }, [filteredInspections, overview, selectedInspectionId]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (projectFilter === "all") {
      nextParams.delete("project");
    } else {
      nextParams.set("project", projectFilter);
    }

    if (areaFilter === "all") {
      nextParams.delete("area");
    } else {
      nextParams.set("area", areaFilter);
    }

    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [areaFilter, pathname, projectFilter, router, searchParams]);

  const actionOptions = useMemo(
    () => (selectedInspection ? qualityActionOptions(selectedInspection) : []),
    [selectedInspection]
  );

  const selectedStory = useMemo(() => buildQualityStory(selectedInspection, bridgeContext, t), [bridgeContext, selectedInspection, t]);
  const createInspectionGate = useMemo(
    () =>
      buildCreateInspectionGate({
        projectName: createForm.projectName,
        areaName: createForm.areaName,
        checklistName: createForm.checklistName,
        contractorName: createForm.contractorName,
        severity: createForm.severity,
        status: createForm.status,
        openFindings: createFormNumbers.openFindings,
        evidenceCompletion: createFormNumbers.evidenceCompletion,
        releaseReadiness: createFormNumbers.releaseReadiness,
        reworkRate: createFormNumbers.reworkRate,
        nextAction: createForm.nextAction
      }),
    [createForm, createFormNumbers]
  );
  const createInspectionHumanStep = useMemo(
    () =>
      buildCreateInspectionHumanStep({
        status: createForm.status,
        openFindings: createFormNumbers.openFindings,
        evidenceCompletion: createFormNumbers.evidenceCompletion,
        releaseReadiness: createFormNumbers.releaseReadiness,
        nextAction: createForm.nextAction
      }, t),
    [createForm.nextAction, createForm.status, createFormNumbers, t]
  );
  const createInspectionDestination = useMemo(
    () =>
      buildCreateInspectionDestination({
        status: createForm.status,
        evidenceCompletion: createFormNumbers.evidenceCompletion,
        releaseReadiness: createFormNumbers.releaseReadiness,
        openFindings: createFormNumbers.openFindings
      }, t),
    [createForm.status, createFormNumbers, t]
  );

  useEffect(() => {
    setNextActionDraft(selectedInspection?.nextAction ?? "");
    setActionError(null);
    setActionMessage(null);
  }, [selectedInspectionId, selectedInspection?.id, selectedInspection?.nextAction]);

  async function handleInspectionAction(status: QualityInspectionContract["status"], suggestedNextAction: string) {
    if (!selectedInspection) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError(t("La siguiente accion debe ser mas especifica antes de actualizar la inspeccion.", "Next action must be more specific before updating the inspection."));
      return;
    }

    if (status === "pending_release" && (selectedInspection.openFindings > 3 || selectedInspection.evidenceCompletion < 85)) {
      setActionError(t("La revision de liberacion requiere maximo 3 hallazgos abiertos y al menos 85% de evidencia.", "Release review requires at most 3 open findings and at least 85% evidence."));
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateQualityInspection(
      selectedInspection.id,
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
      setActionError(response.error?.message ?? t("La actualizacion de la inspeccion fallo.", "Inspection update failed."));
      setIsSaving(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const inspectionsBoard = current.inspectionsBoard.map((inspection) =>
        inspection.id === response.data?.id ? response.data : inspection
      );
      return {
        ...current,
        summary: recomputeSummary(inspectionsBoard),
        inspectionsBoard,
        focusInspection: current.focusInspection?.id === response.data?.id ? response.data : current.focusInspection
      };
    });
    setNextActionDraft(response.data.nextAction);
    setActionMessage(
      t(
        `Inspeccion movida a ${localizeInspectionStatus(response.data.status, t)}. Siguiente accion guardada.`,
        `Inspection moved to ${localizeInspectionStatus(response.data.status, t)}. Next action saved.`
      )
    );
    setIsSaving(false);
  }

  async function handleCreateInspection() {
    if (!overview) {
      return;
    }

    const projectName = createForm.projectName.trim();
    const areaName = createForm.areaName.trim();
    const checklistName = createForm.checklistName.trim();
    const contractorName = createForm.contractorName.trim();
    const nextAction = createForm.nextAction.trim();

    if (projectName.length < 3 || areaName.length < 3 || checklistName.length < 3 || contractorName.length < 3) {
      setActionError(t("Proyecto, frente, checklist y contratista deben ser especificos antes de crear la inspeccion.", "Project, area, checklist and contractor must be specific before creating the inspection."));
      setCreateMessage(null);
      return;
    }

    if (nextAction.length < 8) {
      setActionError(t("La siguiente accion debe ser mas especifica antes de crear la inspeccion.", "Next action must be more specific before creating the inspection."));
      setCreateMessage(null);
      return;
    }

    const openFindings = Number(createForm.openFindings);
    const evidenceCompletion = Number(createForm.evidenceCompletion);
    const releaseReadiness = Number(createForm.releaseReadiness);
    const reworkRate = Number(createForm.reworkRate);

    if (!Number.isFinite(openFindings) || openFindings < 0) {
      setActionError(t("Los hallazgos abiertos deben ser un numero valido no negativo.", "Open findings must be a valid non-negative number."));
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(evidenceCompletion) || evidenceCompletion < 0 || evidenceCompletion > 100) {
      setActionError(t("La evidencia debe quedar entre 0 y 100.", "Evidence completion must be between 0 and 100."));
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(releaseReadiness) || releaseReadiness < 0 || releaseReadiness > 100) {
      setActionError(t("La liberacion debe quedar entre 0 y 100.", "Release readiness must be between 0 and 100."));
      setCreateMessage(null);
      return;
    }

    if (!Number.isFinite(reworkRate) || reworkRate < 0) {
      setActionError(t("El retrabajo debe ser un numero valido no negativo.", "Rework rate must be a valid non-negative number."));
      setCreateMessage(null);
      return;
    }

    if (createForm.status === "pending_release" && (openFindings > 3 || evidenceCompletion < 85)) {
      setActionError(t("Las inspecciones pendientes de liberacion requieren maximo 3 hallazgos y al menos 85% de evidencia.", "Pending release inspections require at most 3 findings and at least 85% evidence."));
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setActionError(null);
    setCreateMessage(null);

    const response = await createQualityInspection(
      activeCompany.id,
      {
        areaName: `${projectName} · ${areaName}`,
        checklistName,
        contractorName,
        severity: createForm.severity,
        openFindings,
        evidenceCompletion,
        releaseReadiness,
        reworkRate,
        status: createForm.status,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? t("La creacion de la inspeccion fallo.", "Inspection creation failed."));
      setIsCreating(false);
      return;
    }

    const created = response.data;
    setOverview((current) => {
      if (!current) {
        return current;
      }

      const inspectionsBoard = [created, ...current.inspectionsBoard];
      return {
        ...current,
        summary: recomputeSummary(inspectionsBoard),
        inspectionsBoard,
        focusInspection: created
      };
    });
    setSelectedInspectionId(created.id);
    setNextActionDraft(created.nextAction);
    setCreateMessage(t(`${created.code} se agrego a la cola operativa de calidad.`, `${created.code} added to the quality operating queue.`));
    setCreateForm({
      projectName,
      areaName,
      checklistName: "Liberacion de acabados por frente",
      contractorName,
      severity: "major",
      openFindings: "2",
      evidenceCompletion: "70",
      releaseReadiness: "65",
      reworkRate: "8",
      status: "in_progress",
      nextAction: ""
    });
    setIsCreating(false);
  }

  return (
    <AppShell
      title={t("Mesa operativa de calidad", "Quality operations workspace")}
      eyebrow={t("Liberacion de calidad", "Quality release")}
      description={t(
        "Opera inspecciones, walkthroughs, bloqueos de liberacion y evidencia desde un solo carril para campo y cierre.",
        "Operate inspections, walkthroughs, release blockers, and evidence from one lane for field teams and closeout."
      )}
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title={t("Calidad", "Quality")}>
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label={t("Inspecciones visibles", "Visible inspections")}
                value={String(filteredSummary.inspections)}
                footnote={t("Carga operable en la cola filtrada.", "Operable load inside the filtered queue.")}
              />
              <KpiCard
                label={t("Hallazgos abiertos", "Open findings")}
                value={String(filteredSummary.openFindings)}
                footnote={t("Pendientes que todavia frenan reinspeccion o liberacion.", "Pending items still slowing reinspection or release.")}
              />
              <KpiCard
                label={t("Liberacion promedio", "Average readiness")}
                value={`${filteredSummary.releaseReadiness}%`}
                footnote={t("Postura visible de liberacion para este subconjunto.", "Visible release posture for this subset.")}
              />
              <KpiCard
                label={t("Frentes en riesgo", "At-risk fronts")}
                value={String(filteredSummary.executionRiskInspections)}
                footnote={t("Inspecciones bloqueadas, marcadas o saturadas de hallazgos.", "Inspections already blocked, flagged, or overloaded with findings.")}
              />
            </section>

            <section className="grid cols1">
              <Card
                title={t("Cola viva de inspeccion", "Live inspection queue")}
                description={t(
                  "Toma el frente correcto primero y deja visible el siguiente movimiento operativo.",
                  "Take the right front first and keep the next operating move visible."
                )}
              >
                <FilterBar summary={t(`${filteredInspections.length} inspecciones operables en la cola`, `${filteredInspections.length} operable inspections in queue`)}>
                  <Badge tone={!session.accessToken ? "warning" : "success"}>
                    {!session.accessToken ? t("modo demo", "demo mode") : t("backend en vivo", "live backend")}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("cola lista", "queue ready")}</Badge>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">{t("Todos los proyectos", "All projects")}</option>
                    {projectOptions.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
                    <option value="all">{t("Todos los frentes", "All fronts")}</option>
                    {areaOptions.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value as typeof severityFilter)}>
                    <option value="all">{t("Toda severidad", "All severity")}</option>
                    <option value="critical">{t("Critica", "Critical")}</option>
                    <option value="major">{t("Mayor", "Major")}</option>
                    <option value="minor">{t("Menor", "Minor")}</option>
                  </select>
                  <select className="selectField" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                    <option value="all">{t("Todo estado", "All status")}</option>
                    <option value="scheduled">{t("Programada", "Scheduled")}</option>
                    <option value="in_progress">{t("En proceso", "In progress")}</option>
                    <option value="pending_release">{t("Pendiente liberacion", "Pending release")}</option>
                    <option value="blocked">{t("Bloqueada", "Blocked")}</option>
                  </select>
                  <input
                    className="field"
                    type="search"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder={t("Busca frente, checklist, contratista, codigo o accion", "Search front, checklist, contractor, code, or action")}
                    style={{ minWidth: 220 }}
                  />
                  <Badge tone={filteredSummary.executionRiskInspections > 0 ? "danger" : filteredSummary.openFindings > 0 ? "warning" : "success"}>
                    {filteredSummary.executionRiskInspections > 0
                      ? t(`${filteredSummary.executionRiskInspections} en riesgo`, `${filteredSummary.executionRiskInspections} at risk`)
                      : filteredSummary.openFindings > 0
                        ? t(`${filteredSummary.openFindings} hallazgos`, `${filteredSummary.openFindings} findings`)
                        : t("cola bajo control", "queue under control")}
                  </Badge>
                </FilterBar>
                <div className="tableCellStack" style={{ gap: 10 }}>
                  {filteredInspections.slice(0, 6).map((inspection) => {
                    const isSelected = inspection.id === selectedInspectionId;
                    return (
                      <button
                        key={inspection.id}
                        className={isSelected ? "button secondary" : "buttonGhost"}
                        type="button"
                        onClick={() => setSelectedInspectionId(inspection.id)}
                        style={{
                          alignItems: "flex-start",
                          display: "flex",
                          gap: 14,
                          height: "auto",
                          justifyContent: "space-between",
                          minHeight: 72,
                          paddingBlock: 12,
                          textAlign: "left",
                          width: "100%"
                        }}
                      >
                        <div className="tableCellStack" style={{ flex: "1 1 auto", minWidth: 0, gap: 4 }}>
                          <strong style={{ whiteSpace: "normal" }}>{inspection.areaName}</strong>
                          <span className="tableCellMuted">
                            {inspection.checklistName} · {inspection.contractorName} · {inspection.code}
                          </span>
                          <span className="tableCellMuted">
                            {inspection.projectName} · {inspection.openFindings} {t("hallazgos", "findings")} · {inspection.evidenceCompletion}% {t("evidencia", "evidence")} · {inspection.releaseReadiness}% {t("liberacion", "readiness")}
                          </span>
                        </div>
                        <div className="row gap wrap" style={{ alignItems: "flex-start", flex: "0 0 auto", justifyContent: "flex-end", rowGap: 8 }}>
                          <Badge tone={severityTone(inspection.severity)}>{localizeSeverity(inspection.severity, t)}</Badge>
                          <Badge tone={inspection.status === "blocked" ? "danger" : inspection.status === "pending_release" ? "warning" : "info"}>
                            {localizeInspectionStatus(inspection.status, t)}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                  {filteredInspections.length > 6 ? (
                    <span className="tableCellMuted">
                      {t(
                        `${filteredInspections.length - 6} inspecciones mas quedan abajo de este primer corte.`,
                        `${filteredInspections.length - 6} more inspections remain below this first cut.`
                      )}
                    </span>
                  ) : null}
                  {filteredInspections.length === 0 ? (
                    <EmptyState
                      title={t("No hay inspecciones en esta vista", "No inspections in this view")}
                      description={t(
                        "Ajusta o limpia filtros para recuperar la cola operativa, o registra una inspeccion nueva abajo.",
                        "Adjust or clear filters to recover the operating queue, or register a new inspection below."
                      )}
                      primaryAction={{ label: t("Ver toda la calidad", "View all quality"), href: "/quality" }}
                    />
                  ) : null}
                </div>
              </Card>
            </section>

            <section className="grid cols2">
              <div className="tableCellStack" style={{ gap: 16 }}>
                <Card
                  title={t("Inspeccion activa", "Active inspection")}
                  description={t(
                    "Estacion operable para decidir quien toma el frente ahora, a que modulo salta y con que confirmacion debe regresar a calidad.",
                    "Operable station to decide who owns the front now, which module it jumps to, and what must come back confirmed to quality."
                  )}
                  aside={
                    <Badge
                      tone={
                        filteredSummary.executionRiskInspections > 0
                          ? "danger"
                          : filteredSummary.openFindings > 0
                            ? "warning"
                            : "success"
                      }
                    >
                      {filteredSummary.executionRiskInspections > 0
                        ? t("carril en riesgo", "risk lane")
                        : filteredSummary.openFindings > 0
                          ? t("hallazgos abiertos", "open findings")
                          : t("carril estable", "stable lane")}
                    </Badge>
                  }
                >
                  {selectedInspection ? (
                    <>
                      <div className="tableCellStack" style={{ gap: 8, marginBottom: 12 }}>
                        <strong style={{ fontSize: "1.05rem", lineHeight: 1.3 }}>{selectedOperatorHeading}</strong>
                        <span className="tableCellMuted">
                          {selectedInspection.projectName} · {selectedInspection.contractorName} · {selectedInspection.code}
                        </span>
                      </div>
                      <div className="detailGrid">
                        <div className="detailRow">
                          <div className="detailLabel">{t("Por que importa", "Why it matters")}</div>
                          <div className="tableCellStack">
                            <span>{selectedWhyNow}</span>
                            <span className="tableCellMuted">{selectedDownstreamEffect}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Ahora", "Now")}</div>
                          <div className="tableCellStack">
                            <span>{selectedNextMoveSummary}</span>
                            <span className="tableCellMuted">{selectedInspection.nextAction}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Modulo responsable inmediato", "Immediate owning module")}</div>
                          <div className="tableCellStack">
                            <span>
                              {selectedImmediateModule.module} · {selectedInspection.contractorName}
                            </span>
                            <span className="tableCellMuted">{selectedImmediateModule.reason}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Segundo salto operativo", "Second operating jump")}</div>
                          <div className="tableCellStack">
                            <span>{selectedSecondJump.module}</span>
                            <span className="tableCellMuted">{selectedSecondJump.reason}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Ruta operativa", "Operating route")}</div>
                          <div className="tableCellStack">
                            <span>{selectedRouteSummary}</span>
                            <span className="tableCellMuted">
                              {t(
                                "Continua en `field`, `daily-log`, `equipment` o `document-control` sin romper el hilo de esta inspeccion.",
                                "Continue into `field`, `daily-log`, `equipment`, or `document-control` without breaking the thread of this inspection."
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Debe regresar confirmado", "Must return confirmed")}</div>
                          <div>{selectedReturnConfirmation}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("CTA principal", "Primary CTA")}</div>
                          <div className="tableCellStack" style={{ gap: 10 }}>
                            <div className="row gap wrap" style={{ alignItems: "center" }}>
                              <Link className="button" href={selectedPrimaryCta.href}>
                                {selectedPrimaryCta.label}
                              </Link>
                              <span className="tableCellMuted">
                                {selectedImmediateModule.lane} → {selectedSecondJump.lane} → quality
                              </span>
                            </div>
                            <span className="tableCellMuted">{selectedPrimaryCta.reason}</span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Bloqueos", "Blockers")}</div>
                          <div className="tableCellStack">
                            {selectedReleaseBlockers.length > 0 ? (
                              selectedReleaseBlockers.slice(0, 2).map((blocker) => (
                                <span key={blocker} className="tableCellMuted">
                                  {blocker}
                                </span>
                              ))
                            ) : (
                              <span>{t("Sin bloqueos fuertes visibles para este frente.", "No strong blockers are visible for this front.")}</span>
                            )}
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Estado visible", "Visible status")}</div>
                          <div className="row gap wrap" style={{ alignItems: "center" }}>
                            <Badge tone={severityTone(selectedInspection.severity)}>{localizeSeverity(selectedInspection.severity, t)}</Badge>
                            <Badge tone={selectedInspection.status === "blocked" ? "danger" : selectedInspection.status === "pending_release" ? "warning" : "info"}>
                              {localizeInspectionStatus(selectedInspection.status, t)}
                            </Badge>
                            <span className="tableCellMuted">
                              {localizeProjectStatus(selectedInspection.projectStatus, t)} · {t("bitacora", "log")} {localizeDailyLogStatus(selectedInspection.latestDailyLogStatus, t)}
                            </span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("KPIs del frente", "Front KPIs")}</div>
                          <div className="tableCellStack">
                            <span>
                              {selectedInspection.openFindings} {t("hallazgos", "findings")} · {selectedInspection.evidenceCompletion}% {t("evidencia", "evidence")} · {selectedInspection.releaseReadiness}% {t("liberacion", "readiness")}
                            </span>
                            <span className="tableCellMuted">{t("Revision de liberacion: maximo 3 hallazgos y 85%+ de evidencia.", "Release review: at most 3 findings and 85%+ evidence.")}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      title={t("No hay frente activo", "No active front selected")}
                      description={t(
                        "Selecciona una inspeccion de la cola para operar correccion, evidencia o liberacion.",
                        "Select an inspection from the queue to operate correction, evidence, or release."
                      )}
                      primaryAction={{ label: t("Seguir en calidad", "Stay on quality"), href: "/quality" }}
                    />
                  )}
                </Card>

                <Card title={t("Acciones de inspeccion", "Inspection actions")} description={t("Actualiza el estado con una instruccion concreta y manda el siguiente relevo humano.", "Update the status with a concrete instruction and send the next human handoff.")}>
                  {selectedInspection ? (
                    <>
                      <div className="detailGrid">
                        <div className="detailRow">
                          <div className="detailLabel">{t("Siguiente accion", "Next action")}</div>
                          <div className="tableCellStack">
                            <input
                              className="field"
                              value={nextActionDraft}
                              onChange={(event) => setNextActionDraft(event.target.value)}
                              placeholder={t(
                                "Ejemplo: cerrar resanes en nivel 12 y subir fotos firmadas antes de las 17:00",
                                "Example: close touch-ups on level 12 and upload signed photos before 5:00 PM"
                              )}
                            />
                            <span className="tableCellMuted">
                              {t("Escribe la instruccion operativa que debe ejecutarse hoy.", "Write the operating instruction that must be executed today.")}
                            </span>
                          </div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Pide a la cuadrilla", "Tell the crew")}</div>
                          <div>{selectedHumanStep}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Pide reporte", "Ask for report-back")}</div>
                          <div>{selectedReportBack}</div>
                        </div>
                        <div className="detailRow">
                          <div className="detailLabel">{t("Abrir carriles", "Open lanes")}</div>
                          <div className="tableCellStack" style={{ gap: 10 }}>
                            <span className="tableCellMuted">
                              {t(
                                "Sigue este orden operativo para no perder continuidad entre ejecucion, supervision, activos y evidencia.",
                                "Use this operating order to preserve continuity across execution, supervision, assets, and evidence."
                              )}
                            </span>
                            <div className="row gap wrap">
                              {selectedOperationalLinks.map((link, index) => (
                                <Link key={link.href} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                                  {localizeText(link.label)}
                                </Link>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="emptyActions" style={{ marginTop: 14 }}>
                        {actionOptions.map((option) => (
                          <button
                            key={option.status}
                            className={option.status === "blocked" ? "buttonGhost" : "button"}
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleInspectionAction(option.status, option.nextAction)}
                          >
                            {isSaving ? t("Guardando...", "Saving...") : localizeText(option.label)}
                          </button>
                        ))}
                      </div>
                      {actionMessage ? <p className="sectionText" style={{ marginTop: 14 }}>{actionMessage}</p> : null}
                      {actionError ? <p style={{ color: "var(--danger-700)", marginTop: 14 }}>{actionError}</p> : null}
                    </>
                  ) : (
                    <EmptyState
                      title={t("Primero toma una inspeccion", "Pick an inspection first")}
                      description={t(
                        "Los controles se habilitan cuando eliges un frente desde la cola viva.",
                        "Controls turn on when you choose a front from the live queue."
                      )}
                      primaryAction={{ label: t("Volver a calidad", "Return to quality"), href: "/quality" }}
                    />
                  )}
                </Card>
              </div>
            </section>

            <section className="grid cols2">
              <Card
                title={t("Detalle de inspeccion seleccionada", "Selected inspection detail")}
                description={t(
                  "Narrativa corta, contexto tecnico y referencias para entender por que este frente manda la liberacion.",
                  "Short narrative, technical context, and references for why this front is driving release."
                )}
              >
                {selectedInspection ? (
                  <>
                    <div className="detailGrid" style={{ marginBottom: 16 }}>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Por que ahora", "Why now")}</div>
                        <div className="tableCellStack">
                          <span>{selectedWhyNow}</span>
                          <span className="tableCellMuted">{selectedRouteSummary}</span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Efecto aguas abajo", "Downstream effect")}</div>
                        <div>{selectedDownstreamEffect}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Checklist", "Checklist")}</div>
                        <div className="tableCellStack">
                          <span>{selectedInspection.checklistName}</span>
                          <span className="tableCellMuted">{t("Retrabajo", "Rework")} {selectedInspection.reworkRate}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="detailGrid">
                      <div className="detailRow">
                        <div className="detailLabel">{t("Proyecto", "Project")}</div>
                        <div className="tableCellStack">
                          <span>{selectedInspection.projectName}</span>
                          <span className="tableCellMuted">
                            {localizeProjectStatus(selectedInspection.projectStatus, t)} · {t("bitacora", "log")} {localizeDailyLogStatus(selectedInspection.latestDailyLogStatus, t)}
                          </span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Frente", "Front")}</div>
                        <div>{selectedInspection.areaName}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Contratista", "Contractor")}</div>
                        <div>{selectedInspection.contractorName}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Estado", "Status")}</div>
                        <div className="row gap wrap" style={{ alignItems: "center" }}>
                          <span>{localizeInspectionStatus(selectedInspection.status, t)}</span>
                          <Badge tone={severityTone(selectedInspection.severity)}>{localizeSeverity(selectedInspection.severity, t)}</Badge>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Liberacion", "Readiness")}</div>
                        <div>{selectedInspection.releaseReadiness}%</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Hallazgos", "Findings")}</div>
                        <div>{selectedInspection.openFindings}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Evidencia", "Evidence")}</div>
                        <div>{selectedInspection.evidenceCompletion}%</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Responsable", "Owner")}</div>
                        <div>{selectedRisks[0]?.owner ?? selectedInspection.contractorName}</div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Reglas de liberacion", "Release rules")}</div>
                        <div className="tableCellStack">
                          <span>{t("Revision: maximo 3 hallazgos abiertos y al menos 85% de evidencia.", "Review: at most 3 open findings and at least 85% evidence.")}</span>
                          <span className="tableCellMuted">
                            {t("Cierre final: 0 hallazgos abiertos y 90%+ de liberacion.", "Final closure: 0 open findings and 90%+ readiness.")}
                          </span>
                        </div>
                      </div>
                      <div className="detailRow">
                        <div className="detailLabel">{t("Actualizado", "Updated")}</div>
                        <div>{new Date(selectedInspection.updatedAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title={t("No hay frente activo", "No active front selected")}
                    description={t(
                      "Selecciona una inspeccion de la cola o registra una nueva para empezar el recorrido de calidad.",
                      "Select an inspection from the queue or register a new one to start the quality walkthrough."
                    )}
                    primaryAction={{ label: t("Seguir en calidad", "Stay on quality"), href: "/quality" }}
                  />
                )}
              </Card>

              <Card title={t("Registrar nueva inspeccion", "Register new inspection")} description={t("Captura un frente de calidad listo para correccion, reinspection o walkthrough de liberacion.", "Capture a quality front ready for correction, reinspection, or the release walkthrough.")}>
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityExample())}>
                    {t("Cargar ejemplo demo", "Load demo example")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityPreset("release_ready"))}>
                    {t("Preset listo para liberar", "Release-ready preset")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityPreset("evidence_gap"))}>
                    {t("Preset con brecha de evidencia", "Evidence-gap preset")}
                  </button>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createQualityPreset("blocked_release"))}>
                    {t("Preset de liberacion bloqueada", "Blocked-release preset")}
                  </button>
                  <button
                    type="button"
                    className="buttonGhost"
                    onClick={() =>
                      setCreateForm({
                        projectName: "Proyecto central",
                        areaName: "Frente 1",
                        checklistName: "Liberacion de acabados por frente",
                        contractorName: "Contratista principal",
                        severity: "major",
                        openFindings: "2",
                        evidenceCompletion: "70",
                        releaseReadiness: "65",
                        reworkRate: "8",
                        status: "in_progress",
                        nextAction: ""
                      })
                    }
                  >
                    {t("Restablecer formulario", "Reset form")}
                  </button>
                  <Link className="buttonGhost" href="/document-control">{t("Abrir control documental", "Open document control")}</Link>
                  <Link className="buttonGhost" href="/compliance">{t("Abrir cumplimiento", "Open compliance")}</Link>
                </div>
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">{t("Proyecto", "Project")}</div>
                    <div className="tableCellStack">
                      <input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} placeholder={t("Ejemplo: Torre Norte", "Example: North Tower")} />
                      <span className="tableCellMuted">{t("Usa el nombre real del proyecto o torre donde correra la liberacion.", "Use the actual project or tower name where release will run.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Frente / area", "Front / area")}</div>
                    <div className="tableCellStack">
                      <input className="field" value={createForm.areaName} onChange={(event) => setCreateForm((current) => ({ ...current, areaName: event.target.value }))} placeholder={t("Ejemplo: Nivel 12 pasillo oriente", "Example: Level 12 east corridor")} />
                      <span className="tableCellMuted">{t("Captura la zona exacta que la cuadrilla y calidad van a caminar.", "Capture the exact zone the crew and quality team will walk.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Checklist / prueba", "Checklist / test")}</div>
                    <div className="tableCellStack">
                      <input className="field" value={createForm.checklistName} onChange={(event) => setCreateForm((current) => ({ ...current, checklistName: event.target.value }))} placeholder={t("Ejemplo: Liberacion de pintura y resanes", "Example: Paint and touch-up release")} />
                      <span className="tableCellMuted">{t("Nombra la prueba o liberacion que se va a ejecutar, no solo el modulo.", "Name the test or release being executed, not just the module.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Contratista", "Contractor")}</div>
                    <div className="tableCellStack">
                      <input className="field" value={createForm.contractorName} onChange={(event) => setCreateForm((current) => ({ ...current, contractorName: event.target.value }))} placeholder={t("Ejemplo: Acabados Integrales", "Example: Integral Finishes")} />
                      <span className="tableCellMuted">{t("Registra al responsable que devolvera correcciones y evidencia.", "Register the owner who will return corrections and evidence.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Severidad", "Severity")}</div>
                    <select className="selectField" value={createForm.severity} onChange={(event) => setCreateForm((current) => ({ ...current, severity: event.target.value as QualityInspectionContract["severity"] }))}>
                      <option value="minor">{t("menor", "minor")}</option>
                      <option value="major">{t("mayor", "major")}</option>
                      <option value="critical">{t("critica", "critical")}</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Estado", "Status")}</div>
                    <select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as QualityInspectionContract["status"] }))}>
                      <option value="scheduled">{t("programada", "scheduled")}</option>
                      <option value="in_progress">{t("en proceso", "in progress")}</option>
                      <option value="pending_release">{t("pendiente liberacion", "pending release")}</option>
                      <option value="blocked">{t("bloqueada", "blocked")}</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Hallazgos abiertos", "Open findings")}</div>
                    <div className="tableCellStack">
                      <input className="field" type="number" min="0" value={createForm.openFindings} onChange={(event) => setCreateForm((current) => ({ ...current, openFindings: event.target.value }))} />
                      <span className="tableCellMuted">{t("Para `pendiente liberacion`, mantenlo en 3 o menos.", "For `pending release`, keep this at 3 or fewer.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Evidencia %", "Evidence %")}</div>
                    <div className="tableCellStack">
                      <input className="field" type="number" min="0" max="100" value={createForm.evidenceCompletion} onChange={(event) => setCreateForm((current) => ({ ...current, evidenceCompletion: event.target.value }))} />
                      <span className="tableCellMuted">{t("La revision de liberacion arranca en 85% o mas.", "Release review starts at 85% or more.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Liberacion %", "Release %")}</div>
                    <div className="tableCellStack">
                      <input className="field" type="number" min="0" max="100" value={createForm.releaseReadiness} onChange={(event) => setCreateForm((current) => ({ ...current, releaseReadiness: event.target.value }))} />
                      <span className="tableCellMuted">{t("Usa 90% o mas para una liberacion critica realmente lista.", "Use 90% or more for a critical release that is truly ready.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Retrabajo %", "Rework %")}</div>
                    <div className="tableCellStack">
                      <input className="field" type="number" min="0" value={createForm.reworkRate} onChange={(event) => setCreateForm((current) => ({ ...current, reworkRate: event.target.value }))} />
                      <span className="tableCellMuted">{t("Usalo para reflejar si la zona ya esta ciclando demasiadas correcciones.", "Use this to reflect whether the zone is already looping through too many corrections.")}</span>
                    </div>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">{t("Siguiente accion comprometida", "Committed next action")}</div>
                    <div className="tableCellStack">
                      <input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder={t("Ejemplo: cerrar plafon pendiente y subir evidencia firmada antes de reinspeccion", "Example: close pending ceiling work and upload signed evidence before reinspection")} />
                      <span className="tableCellMuted">{t("Describe exactamente que debe pasar para que calidad vuelva a caminar el frente.", "Describe exactly what must happen before quality walks the front again.")}</span>
                    </div>
                  </label>
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Control de creacion", "Creation gate")}</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createInspectionGate.tone}>{localizeText({ es: createInspectionGate.label === "Do not create yet" ? "No crear todavia" : createInspectionGate.label === "Create with control" ? "Crear con control" : "Lista para crear", en: createInspectionGate.label })}</Badge>
                        <span>{localizeText({ es: createInspectionGate.summary === "This inspection would open with a hard release blocker." ? "Esta inspeccion abriria con un bloqueo fuerte de liberacion." : createInspectionGate.summary === "The inspection can be created, but release discipline still needs tightening." ? "La inspeccion puede crearse, pero la disciplina de liberacion todavia debe ajustarse." : "La inspeccion tiene suficiente estructura para entrar limpia al carril de liberacion.", en: createInspectionGate.summary })}</span>
                      </div>
                      {createInspectionGate.checks.map((check) => (
                        <span key={check} className="tableCellMuted">
                          {localizeText({
                            es:
                              check === "The created inspection will become the current focus item immediately."
                                ? "La inspeccion creada se volvera el foco actual de inmediato."
                                : check === "Keep findings, evidence and next release action attached from the first capture."
                                  ? "Mantiene hallazgos, evidencia y siguiente accion desde el primer registro."
                                  : check === "Project, area, checklist and contractor still need more specific capture."
                                    ? "Proyecto, area, checklist y contratista todavia requieren mayor detalle."
                                    : check === "Open findings must be a valid non-negative number."
                                      ? "Los hallazgos abiertos deben ser un numero valido no negativo."
                                      : check === "Evidence completion must stay between 0 and 100."
                                        ? "La evidencia debe mantenerse entre 0 y 100."
                                        : check === "Release readiness must stay between 0 and 100."
                                          ? "La liberacion debe mantenerse entre 0 y 100."
                                          : check === "Rework rate must be a valid non-negative number."
                                            ? "El retrabajo debe ser un numero valido no negativo."
                                            : check === "Pending release inspections require at most 3 open findings."
                                              ? "Las inspecciones pendientes de liberacion requieren maximo 3 hallazgos abiertos."
                                              : check === "Pending release inspections require at least 85% evidence."
                                                ? "Las inspecciones pendientes de liberacion requieren al menos 85% de evidencia."
                                                : check === "Release readiness looks too weak compared with current evidence posture."
                                                  ? "La liberacion se ve demasiado debil frente a la evidencia actual."
                                                  : check === "Critical inspections should not enter release review below 90% release readiness."
                                                    ? "Las inspecciones criticas no deben entrar a revision por debajo de 90% de liberacion."
                                                    : "La siguiente accion todavia requiere suficiente detalle para correccion o liberacion.",
                            en: check
                          })}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente paso humano", "Next human step")}</div>
                    <div>{createInspectionHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente destino", "Immediate downstream")}</div>
                    <div className="tableCellStack">
                      <span>{createInspectionDestination.description}</span>
                      <span className="tableCellMuted">{t("El carril de calidad debe moverse de inmediato al dominio real de correccion o liberacion, no detenerse en el registro.", "The quality lane should move immediately into the real correction or release domain, not stop at registration.")}</span>
                    </div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateInspection()}>
                    {isCreating ? t("Guardando...", "Saving...") : t("Registrar y tomar inspeccion", "Register and take inspection")}
                  </button>
                  <Link className="buttonGhost" href={createInspectionDestination.href}>
                    {localizeText(createInspectionDestination.label)}
                  </Link>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>
            </section>

            <section className="grid cols1">
              <details>
                <summary className="buttonGhost" style={{ display: "inline-flex" }}>
                  {t("Detalles operativos", "Operational details")}
                </summary>
                <div className="tableCellStack" style={{ marginTop: 16 }}>
                  <section className="grid cols4">
                    <KpiCard
                      label={t("Inspecciones", "Inspections")}
                      value={String(filteredSummary.inspections)}
                      footnote={t("Carga visible de inspecciones para el filtro operativo actual.", "Visible inspection workload for the current operating filter.")}
                    />
                    <KpiCard
                      label={t("Hallazgos abiertos", "Open findings")}
                      value={String(filteredSummary.openFindings)}
                      footnote={t("Hallazgos visibles que todavia afectan liberacion o reinspeccion.", "Visible findings still affecting release or reinspection.")}
                    />
                    <KpiCard
                      label={t("Liberacion", "Release readiness")}
                      value={`${filteredSummary.releaseReadiness}%`}
                      footnote={t("Postura promedio de liberacion dentro del subconjunto visible.", "Average release posture across the visible quality subset.")}
                    />
                    <KpiCard
                      label={t("Retrabajo", "Rework")}
                      value={`${filteredSummary.averageReworkRate}%`}
                      footnote={t("Promedio de retrabajo en la cola visible de inspecciones.", "Average rework rate across the visible inspection board.")}
                    />
                    <KpiCard
                      label={t("Riesgo operativo", "Execution risk")}
                      value={String(filteredSummary.executionRiskInspections)}
                      footnote={t("Inspecciones visibles ya en bloqueo, bitacoras marcadas o con muchos hallazgos.", "Visible inspections already under blockage, flagged logs or heavy findings.")}
                    />
                  </section>

                  <section className="grid cols1">
                    <Card
                      title={t("Flujo de liberacion", "Release workflow")}
                      description={t("Esta ruta ya debe permitir mover hallazgos hacia liberacion sin depender de un flujo solo con autenticacion.", "This route should already let site and quality teams move from findings to release without depending on a live auth-only flow.")}
                    >
                      <p className="sectionText">
                        {t(
                          "Selecciona una inspeccion, muevela entre correccion y liberacion, y continua hacia `document-control`, `field`, `equipment` o `compliance` segun si el bloqueo es evidencia, coordinacion, continuidad de activos o postura de cierre.",
                          "Select an inspection, move it between correction and release states, and continue into `document-control`, `field`, `equipment` or `compliance` depending on whether the blocker is evidence, coordination, asset continuity or closeout posture."
                        )}
                      </p>
                    </Card>
                  </section>

                  <section className="grid cols2">
                    <Card
                      title={t("Continuidad de calidad", "Quality continuity")}
                      description={t("Calidad debe conectar la ejecucion en campo, la evidencia tecnica y el control de liberacion en lugar de actuar como checklist aislado.", "Quality should bridge field execution, technical evidence and release control instead of acting as a standalone checklist.")}
                      aside={<Badge tone={filteredSummary.executionRiskInspections > 0 ? "danger" : filteredSummary.openFindings > 0 ? "warning" : "success"}>{filteredSummary.executionRiskInspections > 0 ? t("carril en riesgo", "risk lane") : filteredSummary.openFindings > 0 ? t("hallazgos abiertos", "open findings") : t("carril estable", "stable lane")}</Badge>}
                    >
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">{t("Ruta actual", "Current route")}</div><div>{buildQualityWorkflow(selectedInspection, t)}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Regla tecnica", "Technical rule")}</div><div>{t("La liberacion debe ocurrir solo cuando hallazgos, evidencia y restricciones de campo sean coherentes para un traspaso real.", "Release should happen only when findings, evidence and field constraints are coherent enough for a real handoff.")}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Salto operativo", "Operational jump")}</div><div>{t("Mueve el frente por `field`, `daily-log`, `equipment` y `document-control` segun donde siga rota la continuidad real antes de pedir liberacion.", "Move the front through `field`, `daily-log`, `equipment`, and `document-control` according to where real continuity is still broken before asking for release.")}</div></div>
                      </div>
                      <div className="row gap wrap" style={{ marginTop: 16 }}>
                        <Link className="button" href="/field">{t("Abrir campo", "Open field")}</Link>
                        <Link className="buttonGhost" href="/daily-log">{t("Abrir bitacora", "Open daily log")}</Link>
                        <Link className="buttonGhost" href="/equipment">{t("Abrir equipo", "Open equipment")}</Link>
                        <Link className="buttonGhost" href="/document-control">{t("Abrir control documental", "Open document control")}</Link>
                      </div>
                    </Card>
                  </section>

                  <section className="grid cols3">
                    <Card title={t("Disponibilidad de equipo", "Equipment readiness")} description={t("Postura actual de flotilla ligada a la liberacion de calidad.", "Current fleet posture attached to quality release.")}>
                      <p className="sectionText">
                        {selectedStory?.equipmentReadiness ?? t("Elige una inspeccion para revisar la disponibilidad de equipo.", "Choose an inspection to inspect equipment readiness.")}
                      </p>
                    </Card>
                    <Card title={t("Soporte de correccion en campo", "Field correction support")} description={t("Como se comporta ahora mismo el flujo de correccion del contratista.", "How the contractor correction flow is behaving right now.")}>
                      <p className="sectionText">
                        {selectedStory?.fieldCorrectionSupport ?? t("Elige una inspeccion para revisar el soporte de correccion.", "Choose an inspection to inspect correction support.")}
                      </p>
                    </Card>
                    <Card title={t("Restriccion de liberacion", "Release constraint")} description={t("Restriccion conjunta entre disponibilidad de activos y cierre de inspeccion.", "Joint constraint between asset readiness and inspection closure.")}>
                      <p className="sectionText">
                        {selectedStory?.releaseConstraint ?? t("Elige una inspeccion para revisar las restricciones de liberacion.", "Choose an inspection to inspect release constraints.")}
                      </p>
                    </Card>
                  </section>

                  <section className="grid cols2">
                    <Card title={t("Detalle de inspeccion seleccionada", "Selected inspection detail")} description={t("Narrativa ampliada, campos de actualizacion y referencias de reglas de liberacion.", "Expanded inspection narrative, update fields and release rule references.")}>
                      {selectedInspection ? (
                        <div className="detailGrid">
                          <div className="detailRow"><div className="detailLabel">{t("Checklist", "Checklist")}</div><div>{selectedInspection.checklistName}</div></div>
                          <div className="detailRow"><div className="detailLabel">{t("Retrabajo", "Rework rate")}</div><div>{selectedInspection.reworkRate}%</div></div>
                          <div className="detailRow"><div className="detailLabel">{t("Por que ahora", "Why now")}</div><div>{selectedWhyNow}</div></div>
                          <div className="detailRow"><div className="detailLabel">{t("Efecto aguas abajo", "Downstream effect")}</div><div>{selectedDownstreamEffect}</div></div>
                          <div className="detailRow"><div className="detailLabel">{t("Resumen de ruta", "Route summary")}</div><div>{selectedRouteSummary}</div></div>
                          <div className="detailRow"><div className="detailLabel">{t("Actualizado", "Updated")}</div><div>{new Date(selectedInspection.updatedAt).toLocaleString()}</div></div>
                          <div className="detailRow">
                            <div className="detailLabel">{t("Reglas de negocio", "Business rules")}</div>
                            <div className="tableCellStack">
                              <span className="tableCellMuted">{t("La revision de liberacion requiere maximo 3 hallazgos abiertos y al menos 85% de evidencia.", "Release review requires at most 3 open findings and at least 85% evidence.")}</span>
                              <span className="tableCellMuted">{t("La liberacion final requiere 0 hallazgos abiertos y al menos 90% de liberacion.", "Final release requires 0 open findings and at least 90% release readiness.")}</span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </Card>

                    <Card title={t("Riesgos y bloqueos de calidad", "Quality risks and blockers")} description={t("Temas que todavia bloquean la liberacion, la correccion o el cierre de calidad.", "Issues still blocking release, correction or quality closure.")}>
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">{t("Puerta de liberacion", "Release gate")}</div><div>{t("`pending_release` requiere maximo 3 hallazgos y al menos 85% de evidencia.", "`pending_release` requires at most 3 findings and at least 85% evidence.")}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Cierre final", "Final closure")}</div><div>{t("La liberacion no debe tratarse como real mientras haya hallazgos abiertos o la liberacion siga por debajo de 90%.", "Release should not be treated as real while findings remain open or readiness stays below 90%.")}</div></div>
                        <div className="detailRow"><div className="detailLabel">{t("Puente operativo", "Execution bridge")}</div><div>{t("Este carril debe moverse junto con la correccion en campo, la disponibilidad de equipo y la evidencia documental, no en aislamiento.", "This lane should move together with field correction, equipment readiness and document evidence, not in isolation.")}</div></div>
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
                </div>
              </details>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title={t("Resumen de calidad no disponible", "Quality overview unavailable")}
            description={
              error === "Quality overview is unavailable right now."
                ? t("El resumen de calidad no esta disponible ahora mismo.", "Quality overview is unavailable right now.")
                : error
            }
            primaryAction={{ label: t("Ir al dashboard", "Go to dashboard"), href: "/dashboard" }}
            secondaryAction={{ label: t("Abrir campo", "Open field"), href: "/field" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? t("Cargando resumen de calidad", "Loading quality overview") : t("El resumen de calidad aun no carga", "Quality overview not loaded yet")}
            description={
              !session.accessToken
                ? t("Esta ruta debe cargar datos demo o en vivo para probar walkthroughs de liberacion de punta a punta.", "This route should load demo or live quality data so release walkthroughs can be tested end to end.")
                : t("Esta ruta espera la respuesta de calidad en vivo para el tenant activo.", "This route expects the live quality response for the active tenant.")
            }
            primaryAction={{ label: t("Ir al dashboard", "Go to dashboard"), href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}

export default function QualityPage() {
  return (
    <Suspense fallback={null}>
      <QualityPageContent />
    </Suspense>
  );
}
