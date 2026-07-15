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
import type { SubcontractLineContract, SubcontractOverviewContract } from "@/lib/contracts";
import { createSubcontractLine, fetchSubcontractOverview, updateSubcontractLine } from "@/lib/platform-api";

function healthTone(status: SubcontractLineContract["subcontractHealth"]) {
  switch (status) {
    case "controlled":
      return "success";
    case "watch":
      return "warning";
    default:
      return "danger";
  }
}

function projectTone(status: SubcontractLineContract["projectStatus"]) {
  switch (status) {
    case "active":
      return "success";
    case "at_risk":
      return "warning";
    case "blocked":
      return "danger";
    case "closed":
      return "info";
    case "planning":
      return "gold";
    default:
      return "neutral";
  }
}

function subcontractHealthLabel(status: SubcontractLineContract["subcontractHealth"]) {
  switch (status) {
    case "controlled":
      return { es: "Controlado", en: "Controlled" };
    case "watch":
      return { es: "En vigilancia", en: "Watch" };
    default:
      return { es: "Critico", en: "Critical" };
  }
}

function projectStatusLabel(status: SubcontractLineContract["projectStatus"] | null | undefined) {
  switch (status) {
    case "active":
      return { es: "Activa", en: "Active" };
    case "at_risk":
      return { es: "En riesgo", en: "At risk" };
    case "blocked":
      return { es: "Bloqueada", en: "Blocked" };
    case "closed":
      return { es: "Cerrada", en: "Closed" };
    case "planning":
      return { es: "Planeacion", en: "Planning" };
    default:
      return { es: "Sin asignar", en: "Unassigned" };
  }
}

function subcontractActionLabel(label: string) {
  switch (label) {
    case "Move to watch":
      return { es: "Mover a vigilancia", en: "Move to watch" };
    case "Escalate critical":
      return { es: "Escalar a critico", en: "Escalate critical" };
    case "Mark controlled":
      return { es: "Marcar controlado", en: "Mark controlled" };
    default:
      return { es: label, en: label };
  }
}

function dailyLogStatusLabel(status: SubcontractLineContract["latestDailyLogStatus"]) {
  switch (status) {
    case "draft":
      return { es: "Borrador", en: "Draft" };
    case "submitted":
      return { es: "Enviada", en: "Submitted" };
    case "approved":
      return { es: "Aprobada", en: "Approved" };
    case "flagged":
      return { es: "Observada", en: "Flagged" };
    default:
      return { es: "Sin dato", en: "Unknown" };
  }
}

function riskSeverityLabel(severity: "info" | "warning" | "critical") {
  switch (severity) {
    case "info":
      return { es: "Info", en: "Info" };
    case "warning":
      return { es: "Alerta", en: "Warning" };
    default:
      return { es: "Critica", en: "Critical" };
  }
}

function actionOptions(line: SubcontractLineContract) {
  switch (line.subcontractHealth) {
    case "critical":
      return [
        {
          label: "Move to watch",
          subcontractHealth: "watch" as const,
          nextAction: "Contain destajo backlog and stabilize the subcontractor crew before normalizing"
        }
      ];
    case "watch":
      return [
        {
          label: "Escalate critical",
          subcontractHealth: "critical" as const,
          nextAction: "Escalate unresolved attendance, compliance or destajo pressure to operations review"
        },
        {
          label: "Mark controlled",
          subcontractHealth: "controlled" as const,
          nextAction: "Destajo backlog is within tolerance and field issues are fully contained"
        }
      ];
    default:
      return [
        {
          label: "Move to watch",
          subcontractHealth: "watch" as const,
          nextAction: "Start monitoring subcontract drift before productivity drops further"
        }
      ];
  }
}

function buildSubcontractWhyNow(line: SubcontractLineContract | null, t: (es: string, en: string) => string) {
  if (!line) {
    return t(
      "Selecciona una linea de subcontrato para entender que se debe contener antes de que la ejecucion de obra se desvie.",
      "Select a subcontract line to understand what must be contained before field execution drifts."
    );
  }

  if (line.subcontractHealth === "critical") {
    return t(
      `El destajo pendiente de MXN ${line.pendingDestajo.toLocaleString()} mas una brecha de ${line.progressGap}% ya puso a ${line.contractorName} bajo presion activa de ejecucion.`,
      `Pending destajo of MXN ${line.pendingDestajo.toLocaleString()} plus ${line.progressGap}% progress gap already put ${line.contractorName} under active execution pressure.`
    );
  }

  if (line.latestDailyLogStatus === "flagged" || line.qualityReleaseReadiness < 85) {
    return t(
      `${line.frontName} sigue expuesto porque la ultima postura de campo o calidad aun no es suficientemente estable para dejar este subcontrato sin seguimiento.`,
      `${line.frontName} is still exposed because the latest field or quality posture is not stable enough to leave this subcontract unattended.`
    );
  }

  if (line.complianceExpirations > 0 || line.incidentCount > 0) {
    return t(
      `${line.contractorName} todavia arrastra deuda de cumplimiento o incidentes que puede frenar la continuidad de la cuadrilla si nadie interviene ahora.`,
      `${line.contractorName} still has compliance or incident debt that can stop crew continuity if nobody intervenes now.`
    );
  }

  return t(
    `${line.contractorName} esta controlado por ahora, pero asistencia, destajo y liberacion aun requieren seguimiento explicito para mantener estable el frente.`,
    `${line.contractorName} is currently controlled, but attendance, destajo and release readiness still need explicit follow-through to keep the front stable.`
  );
}

function buildSubcontractDownstreamEffect(line: SubcontractLineContract | null, t: (es: string, en: string) => string) {
  if (!line) {
    return t(
      "Selecciona una linea de subcontrato para revisar que otros modulos absorberan el impacto.",
      "Select a subcontract line to inspect what other modules will absorb the impact."
    );
  }

  if (line.pendingDestajo > line.contractAmount * 0.1) {
    return t(
      "Si el destajo sigue sin resolverse, finanzas, compras y control de obra heredaran ruido evitable en pagos y confianza de produccion.",
      "If destajo remains unresolved, finance, procurement and project control will inherit preventable noise in payment timing and production confidence."
    );
  }

  if (line.latestDailyLogStatus === "flagged" || line.qualityReleaseReadiness < 85) {
    return t(
      "Si campo y calidad no se recuperan, bitacora, control de liberaciones y preparacion de cierre se degradaran detras de este subcontrato.",
      "If field and quality posture do not recover, daily logs, release control and closeout readiness will degrade behind this subcontract."
    );
  }

  if (line.attendanceRate < 85) {
    return t(
      "Si la asistencia sigue debil, el programa de obra y la planeacion de cuadrillas absorberan primero el deslizamiento.",
      "If attendance stays soft, the project schedule and workforce planning lanes will absorb the slippage first."
    );
  }

  return t(
    "Si esta linea se mantiene bajo control, proyectos, RH y calidad pueden seguir operando sin retrabajo aguas abajo desde el carril del contratista.",
    "If this line is kept under control, projects, HR and quality can keep operating without downstream rework from the subcontractor lane."
  );
}

function buildSubcontractReportBack(line: SubcontractLineContract | null, t: (es: string, en: string) => string) {
  if (!line) {
    return t(
      "Selecciona una linea de subcontrato para definir el siguiente punto de control operativo.",
      "Select a subcontract line to define the next operational checkpoint."
    );
  }

  if (line.subcontractHealth === "critical") {
    return t(
      "Reporta en el siguiente ciclo de supervision una vez confirmados el control del destajo, la recuperacion de asistencia y el responsable del bloqueo de campo.",
      "Report back in the next supervisor cycle once destajo containment, attendance recovery and the field blocker owner are confirmed."
    );
  }

  if (line.latestDailyLogStatus === "flagged" || line.qualityReleaseReadiness < 85) {
    return t(
      "Reporta despues de la siguiente bitacora de campo y validacion de calidad para reevaluar la postura de liberacion con evidencia.",
      "Report back after the next field log and quality verification so the release posture can be re-evaluated with evidence."
    );
  }

  if (line.complianceExpirations > 0 || line.incidentCount > 0) {
    return t(
      "Reporta en cuanto queden formalmente liberados los vencimientos de cumplimiento o las acciones por incidente en el carril operativo.",
      "Report back as soon as compliance expirations or incident actions are formally cleared in the operating lane."
    );
  }

  return t(
    "Reporta en la siguiente revision programada del subcontrato para confirmar que este frente siguio controlado sin nuevo desvio de destajo o calidad.",
    "Report back at the next planned subcontract review to confirm this front stayed controlled without new destajo or quality drift."
  );
}

function buildSubcontractSelectedStation(line: SubcontractLineContract | null) {
  const pushLink = (
    links: Array<{ label: { es: string; en: string }; href: string }>,
    label: { es: string; en: string },
    href: string
  ) => {
    if (!links.some((item) => item.href === href)) {
      links.push({ label, href });
    }
  };

  if (!line) {
    const links: Array<{ label: { es: string; en: string }; href: string }> = [];
    pushLink(links, { es: "Abrir campo", en: "Open field" }, "/field");
    pushLink(links, { es: "Abrir proyectos", en: "Open projects" }, "/projects");
    pushLink(links, { es: "Abrir calidad", en: "Open quality" }, "/quality");
    return {
      primaryLabel: { es: "Campo", en: "Field" },
      primaryReason: {
        es: "Selecciona un subcontrato para aclarar qué dominio debe absorber primero la presión del frente.",
        en: "Select a subcontract to clarify which domain should first absorb front pressure."
      },
      secondaryLabel: { es: "Proyectos", en: "Projects" },
      secondaryReason: {
        es: "Después del primer dominio, la continuidad debe conservar programa y productividad del contratista.",
        en: "After the first domain, continuity should preserve schedule and subcontractor productivity."
      },
      returnRule: {
        es: "Regresa con responsable, frente y siguiente corte ya confirmados.",
        en: "Return with owner, front and next checkpoint already confirmed."
      },
      links
    };
  }

  const qualityHref = buildQualityPrefillHref({
    projectName: line.projectName,
    frontName: line.frontName,
    contractorName: line.contractorName,
    nextAction: line.nextAction
  });
  const accountsPayableHref = `/accounts-payable?source=subcontracts&supplierName=${encodeURIComponent(line.contractorName)}&projectName=${encodeURIComponent(line.projectName)}&purchaseOrderCode=${encodeURIComponent(line.code)}&nextAction=${encodeURIComponent(line.nextAction)}`;
  const links: Array<{ label: { es: string; en: string }; href: string }> = [];

  if (line.pendingDestajo > line.contractAmount * 0.1) {
    pushLink(links, { es: "Abrir CXP", en: "Open AP" }, accountsPayableHref);
    pushLink(links, { es: "Abrir campo", en: "Open field" }, "/field");
    pushLink(links, { es: "Abrir proyectos", en: "Open projects" }, "/projects");
    pushLink(links, { es: "Abrir calidad", en: "Open quality" }, qualityHref);
    return {
      primaryLabel: { es: "Cuentas por pagar", en: "Accounts payable" },
      primaryReason: {
        es: "El destajo pendiente ya está presionando dinero y confianza del contratista; CXP debe contener primero ese carril.",
        en: "Pending destajo is already pressuring money and subcontractor trust, so AP should contain that lane first."
      },
      secondaryLabel: { es: "Campo", en: "Field" },
      secondaryReason: {
        es: "Después del impacto económico, campo debe sostener el frente y confirmar quién absorbe la recuperación operativa.",
        en: "After the economic impact, field should sustain the front and confirm who absorbs operational recovery."
      },
      returnRule: {
        es: "Regresa con destajo contenido, responsable de frente confirmado y efecto de pago ya aclarado.",
        en: "Return with destajo contained, front owner confirmed and payment impact already clarified."
      },
      links
    };
  }

  if (line.latestDailyLogStatus === "flagged" || line.qualityReleaseReadiness < 85) {
    pushLink(links, { es: "Abrir calidad", en: "Open quality" }, qualityHref);
    pushLink(links, { es: "Abrir campo", en: "Open field" }, "/field");
    pushLink(links, { es: "Abrir proyectos", en: "Open projects" }, "/projects");
    pushLink(links, { es: "Abrir CXP", en: "Open AP" }, accountsPayableHref);
    return {
      primaryLabel: { es: "Calidad", en: "Quality" },
      primaryReason: {
        es: "La liberación de calidad o la última bitácora siguen observadas; calidad debe absorber primero la continuidad técnica.",
        en: "Quality release or the latest field log is still flagged, so quality should absorb technical continuity first."
      },
      secondaryLabel: { es: "Campo", en: "Field" },
      secondaryReason: {
        es: "Después de calidad, campo debe resecuenciar el frente y proteger la ejecución real del contratista.",
        en: "After quality, field should resequence the front and protect the subcontractor's real execution."
      },
      returnRule: {
        es: "Regresa con liberación reevaluada, evidencia visible y siguiente frente operativo ya confirmado.",
        en: "Return with release re-evaluated, evidence visible and the next operating front already confirmed."
      },
      links
    };
  }

  if (line.complianceExpirations > 0 || line.incidentCount > 0 || line.attendanceRate < 85) {
    pushLink(links, { es: "Abrir RH", en: "Open HR" }, "/hr");
    pushLink(links, { es: "Abrir campo", en: "Open field" }, "/field");
    pushLink(links, { es: "Abrir proyectos", en: "Open projects" }, "/projects");
    pushLink(links, { es: "Abrir CXP", en: "Open AP" }, accountsPayableHref);
    return {
      primaryLabel: { es: "RH", en: "HR" },
      primaryReason: {
        es: "Asistencia, vencimientos o incidentes ya presionan la continuidad contractual y RH debe contener primero la disciplina del contratista.",
        en: "Attendance, expirations or incidents are already pressuring contractual continuity, so HR should first contain subcontractor discipline."
      },
      secondaryLabel: { es: "Campo", en: "Field" },
      secondaryReason: {
        es: "Después de RH, campo debe confirmar cómo sigue el frente con la cuadrilla realmente disponible.",
        en: "After HR, field should confirm how the front continues with the crew actually available."
      },
      returnRule: {
        es: "Regresa con asistencia o cumplimiento regularizados y con el frente nuevamente sostenible.",
        en: "Return with attendance or compliance regularized and the front sustainable again."
      },
      links
    };
  }

  pushLink(links, { es: "Abrir proyectos", en: "Open projects" }, "/projects");
  pushLink(links, { es: "Abrir campo", en: "Open field" }, "/field");
  pushLink(links, { es: "Abrir CXP", en: "Open AP" }, accountsPayableHref);
  pushLink(links, { es: "Abrir calidad", en: "Open quality" }, qualityHref);
  return {
    primaryLabel: { es: "Proyectos", en: "Projects" },
    primaryReason: {
      es: "La línea está controlada y el siguiente turno útil es sostener programa, productividad y continuidad contractual.",
      en: "The line is controlled and the next useful turn is sustaining schedule, productivity and contractual continuity."
    },
    secondaryLabel: { es: "Campo", en: "Field" },
    secondaryReason: {
      es: "Después de proyectos, campo debe absorber la ejecución diaria sin perder la misma trazabilidad del contratista.",
      en: "After projects, field should absorb day-to-day execution without losing the same subcontractor traceability."
    },
    returnRule: {
      es: "Regresa con programa, frente y seguimiento económico ya confirmados sobre el mismo subcontrato.",
      en: "Return with schedule, front and economic follow-through already confirmed on the same subcontract."
    },
    links
  };
}

function recomputeSummary(lines: SubcontractLineContract[]) {
  return {
    activeSubcontracts: lines.length,
    contractedAmount: lines.reduce((sum, item) => sum + item.contractAmount, 0),
    earnedAmount: lines.reduce((sum, item) => sum + item.earnedAmount, 0),
    paidAmount: lines.reduce((sum, item) => sum + item.paidAmount, 0),
    pendingDestajo: lines.reduce((sum, item) => sum + item.pendingDestajo, 0),
    criticalSubcontracts: lines.filter((item) => item.subcontractHealth === "critical").length,
    executionRiskSubcontracts: lines.filter(
      (item) => item.latestDailyLogStatus === "flagged" || item.qualityReleaseReadiness < 75 || item.subcontractHealth === "critical"
    ).length
  };
}

const emptyCreateForm = {
  code: "",
  contractorName: "",
  projectName: "",
  frontName: "",
  activeHeadcount: "12",
  attendanceRate: "92",
  productivityRate: "86",
  complianceExpirations: "0",
  incidentCount: "0",
  subcontractHealth: "controlled" as SubcontractLineContract["subcontractHealth"],
  nextAction: ""
};

function normalizeFeedbackCode(value: string | null) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveSubcontractFeedbackCopy(message: string | null) {
  switch (normalizeFeedbackCode(message)) {
    case "SUBCONTRACT_CREATE_FIELDS_INCOMPLETE":
      return {
        es: "Proyecto, frente, contratista, codigo y siguiente accion deben quedar claros antes de dar de alta el subcontrato.",
        en: "Project, front, contractor, code and next action must be clear before creating the subcontract."
      };
    case "SUBCONTRACT_CREATE_NUMBERS_INVALID":
      return {
        es: "Personal, asistencia, productividad, vencimientos e incidentes deben tener valores numericos validos.",
        en: "Headcount, attendance, productivity, expirations and incidents must have valid numeric values."
      };
    case "SUBCONTRACT_CREATE_DUPLICATE_CODE":
    case "SUBCONTRACTS_DUPLICATE_CODE":
      return {
        es: "La clave del subcontrato ya existe en la empresa activa.",
        en: "The subcontract code already exists in the active company."
      };
    case "SUBCONTRACTS_CONTROLLED_WITH_OPEN_ISSUES":
      return {
        es: "No abras un subcontrato como controlado si todavia trae vencimientos o incidentes abiertos.",
        en: "Do not create a controlled subcontract while expirations or incidents are still open."
      };
    case "SUBCONTRACTS_CONTROLLED_WITH_LOW_ATTENDANCE":
      return {
        es: "No abras un subcontrato como controlado si la asistencia todavia es menor a 85%.",
        en: "Do not create a controlled subcontract while attendance is still below 85%."
      };
    case "SUBCONTRACT_CREATED":
      return {
        es: "El subcontrato ya quedo disponible en la mesa operativa.",
        en: "The subcontract is now available on the operating board."
      };
    case "SUBCONTRACT_CREATE_FAILED":
      return {
        es: "No fue posible crear el subcontrato. Revisa la captura e intenta de nuevo.",
        en: "The subcontract could not be created. Review the capture and try again."
      };
    default:
      return message ? { es: message, en: message } : null;
  }
}

function buildQualityPrefillHref(input: {
  projectName: string;
  frontName: string;
  contractorName: string;
  nextAction: string;
}) {
  const params = new URLSearchParams({
    source: "subcontracts",
    project: input.projectName,
    projectName: input.projectName,
    areaName: input.frontName,
    contractorName: input.contractorName,
    checklistName: `Liberacion ${input.frontName}`,
    nextAction: input.nextAction
  });

  return `/quality?${params.toString()}`;
}

export default function SubcontractsPage() {
  const { activeCompany, apiBaseUrl, session, source, localizeText } = useAppState();
  const t = (es: string, en: string) => localizeText({ es, en });
  const [overview, setOverview] = useState<SubcontractOverviewContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState<"all" | SubcontractLineContract["subcontractHealth"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchSubcontractOverview(activeCompany.id, {
      apiBaseUrl,
      accessToken: session.accessToken
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (!result) {
          setError("Subcontracts overview is unavailable right now.");
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
  }, [activeCompany.id, apiBaseUrl, session.accessToken, session.authenticated]);

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
      const matchesHealth = healthFilter === "all" || item.subcontractHealth === healthFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        item.contractorName.toLowerCase().includes(normalizedSearch) ||
        item.frontName.toLowerCase().includes(normalizedSearch) ||
        item.code.toLowerCase().includes(normalizedSearch);

      return matchesProject && matchesHealth && matchesSearch;
    });
  }, [healthFilter, overview, projectFilter, searchFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredLines), [filteredLines]);

  const selectedLine = useMemo(
    () => filteredLines.find((item) => item.id === selectedLineId) ?? filteredLines[0] ?? null,
    [filteredLines, selectedLineId]
  );

  const selectedRisks = useMemo(
    () => overview?.risks.filter((item) => item.lineId === selectedLine?.id) ?? [],
    [overview, selectedLine]
  );

  const selectedWhyNow = buildSubcontractWhyNow(selectedLine, t);
  const selectedDownstreamEffect = buildSubcontractDownstreamEffect(selectedLine, t);
  const selectedReportBack = buildSubcontractReportBack(selectedLine, t);
  const selectedStation = useMemo(() => buildSubcontractSelectedStation(selectedLine), [selectedLine]);
  const createGateChecks = useMemo(() => {
    const checks: string[] = [];
    if (
      [
        createForm.code,
        createForm.contractorName,
        createForm.projectName,
        createForm.frontName,
        createForm.nextAction
      ].some((value) => value.trim().length < 3)
    ) {
      checks.push(
        localizeText({
          es: "Completa proyecto, frente, contratista, clave y siguiente accion con suficiente detalle.",
          en: "Complete project, front, contractor, code and next action with enough detail."
        })
      );
    }

    const numericValues = [
      Number.parseInt(createForm.activeHeadcount, 10),
      Number.parseFloat(createForm.attendanceRate),
      Number.parseFloat(createForm.productivityRate),
      Number.parseInt(createForm.complianceExpirations, 10),
      Number.parseInt(createForm.incidentCount, 10)
    ];
    if (numericValues.some((value) => Number.isNaN(value))) {
      checks.push(
        localizeText({
          es: "Asegura que personal, asistencia, productividad, vencimientos e incidentes tengan valores numericos validos.",
          en: "Make sure headcount, attendance, productivity, expirations and incidents use valid numeric values."
        })
      );
    }

    const attendanceRate = Number.parseFloat(createForm.attendanceRate);
    const complianceExpirations = Number.parseInt(createForm.complianceExpirations, 10);
    const incidentCount = Number.parseInt(createForm.incidentCount, 10);
    if (
      createForm.subcontractHealth === "controlled" &&
      ((Number.isFinite(complianceExpirations) && complianceExpirations > 0) ||
        (Number.isFinite(incidentCount) && incidentCount > 0))
    ) {
      checks.push(
        localizeText({
          es: "Controlado se bloquea si todavia hay vencimientos o incidentes abiertos.",
          en: "Controlled is blocked while expirations or incidents are still open."
        })
      );
    }
    if (
      createForm.subcontractHealth === "controlled" &&
      Number.isFinite(attendanceRate) &&
      attendanceRate < 85
    ) {
      checks.push(
        localizeText({
          es: "Controlado se bloquea si la asistencia inicial esta por debajo de 85%.",
          en: "Controlled is blocked if initial attendance is below 85%."
        })
      );
    }

    return checks;
  }, [createForm, localizeText]);
  const createGateTone =
    createGateChecks.length === 0 ? "success" : createForm.subcontractHealth === "critical" ? "warning" : "danger";
  const createGateLabel =
    createGateChecks.length === 0
      ? t("Listo para alta", "Ready to create")
      : createForm.subcontractHealth === "critical"
        ? t("Crear con contencion", "Create with containment")
        : t("No crear todavia", "Do not create yet");
  const createHumanStep =
    createForm.subcontractHealth === "critical"
      ? t(
          "Abre el subcontrato solo si ya sabes quien va a contener el destajo, la asistencia o el incidente en el mismo ciclo.",
          "Create the subcontract only if you already know who will contain destajo, attendance or the incident in the same cycle."
        )
      : createForm.subcontractHealth === "watch"
        ? t(
            "Crea el subcontrato y continua hacia campo, calidad o RH antes de que la desviacion escale.",
            "Create the subcontract and continue into field, quality or HR before the drift escalates."
          )
        : t(
            "Crea el subcontrato y continua directo a seguimiento de campo, calidad y control de obra.",
            "Create the subcontract and continue directly into field, quality and project-control follow-through."
          );
  const createNextModule =
    createForm.subcontractHealth === "critical"
      ? t("Campo + calidad + cuentas por pagar", "Field + quality + accounts payable")
      : createForm.subcontractHealth === "watch"
        ? t("Campo + calidad", "Field + quality")
        : t("Proyectos + campo + RH", "Projects + field + HR");

  const lineActions = useMemo(() => (selectedLine ? actionOptions(selectedLine) : []), [selectedLine]);

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

  useEffect(() => {
    if (projectOptions.length === 0) {
      return;
    }

    setCreateForm((current) =>
      current.projectName.trim().length > 0 ? current : { ...current, projectName: projectOptions[0] }
    );
  }, [projectOptions]);

  async function handleAction(
    subcontractHealth: SubcontractLineContract["subcontractHealth"],
    suggestedNextAction: string
  ) {
    if (!selectedLine) {
      return;
    }

    const nextAction = nextActionDraft.trim() || suggestedNextAction;
    if (nextAction.length < 8) {
      setActionError(t("La siguiente accion debe ser mas especifica antes de actualizar el subcontrato.", "Next action must be more specific before updating the subcontract."));
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    const response = await updateSubcontractLine(
      selectedLine.id,
      activeCompany.id,
      {
        subcontractHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      setActionError(response.error?.message ?? t("La actualizacion del subcontrato fallo.", "Subcontract update failed."));
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
        focusLine:
          lines
            .slice()
            .sort((left, right) => {
              if (left.subcontractHealth === "critical" && right.subcontractHealth !== "critical") {
                return -1;
              }

              if (left.subcontractHealth !== "critical" && right.subcontractHealth === "critical") {
                return 1;
              }

              return right.pendingDestajo - left.pendingDestajo;
            })[0] ?? null
      };
    });

    setNextActionDraft(response.data.nextAction);
    setActionMessage(
      t(
        `El subcontrato cambio a ${localizeText(subcontractHealthLabel(response.data.subcontractHealth)).toLowerCase()}.`,
        `Subcontract moved to ${response.data.subcontractHealth}.`
      )
    );
    setIsSaving(false);
  }

  async function handleCreateSubcontract() {
    const code = createForm.code.trim().toUpperCase();
    const contractorName = createForm.contractorName.trim();
    const projectName = createForm.projectName.trim();
    const frontName = createForm.frontName.trim();
    const nextAction = createForm.nextAction.trim();

    if ([code, contractorName, projectName, frontName, nextAction].some((value) => value.length < 3)) {
      setCreateError(localizeText(resolveSubcontractFeedbackCopy("SUBCONTRACT_CREATE_FIELDS_INCOMPLETE")!));
      setCreateMessage(null);
      return;
    }

    if (overview?.lines.some((line) => line.code.trim().toUpperCase() === code)) {
      setCreateError(localizeText(resolveSubcontractFeedbackCopy("SUBCONTRACT_CREATE_DUPLICATE_CODE")!));
      setCreateMessage(null);
      return;
    }

    const activeHeadcount = Number.parseInt(createForm.activeHeadcount, 10);
    const attendanceRate = Number.parseFloat(createForm.attendanceRate);
    const productivityRate = Number.parseFloat(createForm.productivityRate);
    const complianceExpirations = Number.parseInt(createForm.complianceExpirations, 10);
    const incidentCount = Number.parseInt(createForm.incidentCount, 10);

    if (
      [activeHeadcount, attendanceRate, productivityRate, complianceExpirations, incidentCount].some((value) => Number.isNaN(value))
    ) {
      setCreateError(localizeText(resolveSubcontractFeedbackCopy("SUBCONTRACT_CREATE_NUMBERS_INVALID")!));
      setCreateMessage(null);
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    setCreateMessage(null);

    const response = await createSubcontractLine(
      activeCompany.id,
      {
        code,
        contractorName,
        projectName,
        frontName,
        activeHeadcount,
        attendanceRate,
        productivityRate,
        complianceExpirations,
        incidentCount,
        subcontractHealth: createForm.subcontractHealth,
        nextAction
      },
      {
        apiBaseUrl,
        accessToken: session.accessToken
      }
    );

    if (!response.data) {
      const feedback =
        resolveSubcontractFeedbackCopy(response.error?.code ?? response.error?.message ?? null) ??
        resolveSubcontractFeedbackCopy("SUBCONTRACT_CREATE_FAILED");
      setCreateError(localizeText(feedback ?? { es: "No fue posible crear el subcontrato.", en: "Subcontract creation failed." }));
      setIsCreating(false);
      return;
    }

    setOverview((current) => {
      if (!current) {
        return current;
      }

      const lines = [response.data!, ...current.lines.filter((item) => item.id !== response.data!.id)];
      return {
        ...current,
        summary: recomputeSummary(lines),
        lines,
        focusLine:
          lines
            .slice()
            .sort((left, right) => {
              if (left.subcontractHealth === "critical" && right.subcontractHealth !== "critical") {
                return -1;
              }
              if (left.subcontractHealth !== "critical" && right.subcontractHealth === "critical") {
                return 1;
              }
              return right.pendingDestajo - left.pendingDestajo;
            })[0] ?? null
      };
    });
    setSelectedLineId(response.data.id);
    setProjectFilter("all");
    setHealthFilter("all");
    setSearchFilter("");
    setCreateForm((current) => ({
      ...emptyCreateForm,
      projectName: current.projectName
    }));
    setCreateMessage(localizeText(resolveSubcontractFeedbackCopy("SUBCONTRACT_CREATED")!));
    setIsCreating(false);
  }

  return (
    <AppShell
      title={t("Subcontratos y destajo", "Subcontracts and destajo")}
      eyebrow={t("Ejecucion de cuadrillas", "Workforce execution")}
      description={t("Avance de contratistas, backlog de destajo y postura de campo conectados con frentes activos.", "Contractor advance, destajo backlog and field readiness connected to active fronts.")}
    >
      <ModuleGate moduleKeys={["hr.workforce"]} requiredPermissions={["hr:*"]} title={t("Subcontratos", "Subcontracts")}>
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label={t("Subcontratos activos", "Active subcontracts")}
                value={String(filteredSummary.activeSubcontracts)}
                footnote={t("Frentes de contratista hoy seguidos en ejecucion real.", "Contractor fronts currently tracked in live execution.")}
              />
              <KpiCard
                label={t("Contratado", "Contracted")}
                value={`MXN ${filteredSummary.contractedAmount.toLocaleString()}`}
                footnote={t("Valor base hoy bajo ejecucion de contratistas.", "Baseline value currently under contractor execution.")}
              />
              <KpiCard
                label={t("Ganado", "Earned")}
                value={`MXN ${filteredSummary.earnedAmount.toLocaleString()}`}
                footnote={t("Valor ganado segun avance de campo y productividad actual.", "Earned value implied by field advance and current productivity.")}
              />
              <KpiCard
                label={t("Destajo pendiente", "Pending destajo")}
                value={`MXN ${filteredSummary.pendingDestajo.toLocaleString()}`}
                footnote={t("Monto aun pendiente por conciliar entre avance pagado y estimado.", "Value still pending to settle between invoiced and paid progress.")}
              />
              <KpiCard
                label={t("Riesgo de ejecucion", "Execution risk")}
                value={String(filteredSummary.executionRiskSubcontracts)}
                footnote={t("Subcontratos ya afectados por bitacora observada, baja liberacion de calidad o postura critica.", "Subcontracts already under flagged field logs, poor quality readiness or critical posture.")}
              />
            </section>

            <section className="grid cols2">
              <Card title={t("Mesa de subcontratos", "Subcontract board")} description={t("Destajo, avance y postura operativa del contratista sobre frentes activos.", "Destajo, progress and contractor operating posture across active fronts.")}>
                <FilterBar summary={t(`${filteredLines.length} lineas de subcontrato en la empresa activa`, `${filteredLines.length} subcontract lines in the active tenant`)}>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">{t("Todos los proyectos", "All projects")}</option>
                    {projectOptions.map((projectName) => (
                      <option key={projectName} value={projectName}>
                        {projectName}
                      </option>
                    ))}
                  </select>
                  <select
                    className="selectField"
                    value={healthFilter}
                    onChange={(event) => setHealthFilter(event.target.value as "all" | SubcontractLineContract["subcontractHealth"])}
                  >
                    <option value="all">{t("Toda la salud", "All health")}</option>
                    <option value="controlled">{localizeText(subcontractHealthLabel("controlled"))}</option>
                    <option value="watch">{localizeText(subcontractHealthLabel("watch"))}</option>
                    <option value="critical">{localizeText(subcontractHealthLabel("critical"))}</option>
                  </select>
                  <input
                    className="field"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder={t("Buscar contratista, frente o clave", "Search contractor, front or code")}
                  />
                  <Badge tone={session.authenticated ? "success" : "warning"}>
                    {session.authenticated ? t("backend real", "live backend") : source}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("subcontratos listos", "subcontracts ready")}</Badge>
                </FilterBar>
                <DataTable
                  rows={filteredLines}
                  columns={[
                    {
                      key: "contractor",
                      label: t("Contratista", "Contractor"),
                      render: (row) => (
                        <button
                          className="buttonGhost"
                          type="button"
                          onClick={() => setSelectedLineId(row.id)}
                          style={{ justifyContent: "flex-start", paddingInline: 0 }}
                        >
                          <div className="tableCellStack">
                            <strong>{row.contractorName}</strong>
                            <span className="tableCellMuted">{row.frontName} · {row.code}</span>
                          </div>
                        </button>
                      )
                    },
                    {
                      key: "progress",
                      label: t("Avance", "Advance"),
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.progressPercent}% {t("avance de obra", "site progress")}</strong>
                          <span className="tableCellMuted">{row.productivityRate}% {t("productividad", "productivity")}</span>
                        </div>
                      )
                    },
                    {
                      key: "destajo",
                      label: "Destajo",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>MXN {row.pendingDestajo.toLocaleString()}</strong>
                          <span className="tableCellMuted">paid MXN {row.paidAmount.toLocaleString()}</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: t("Salud", "Health"),
                      render: (row) => <Badge tone={healthTone(row.subcontractHealth)}>{localizeText(subcontractHealthLabel(row.subcontractHealth))}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title={t("Subcontrato seleccionado", "Selected subcontract")}
                description={t("Postura de campo, economia del contrato y siguiente movimiento del contratista.", "Field posture, contract economics and next subcontractor action.")}
                aside={selectedLine ? <Badge tone={healthTone(selectedLine.subcontractHealth)}>{localizeText(subcontractHealthLabel(selectedLine.subcontractHealth))}</Badge> : null}
              >
                {selectedLine ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">{t("Proyecto", "Project")}</div>
                      <div className="tagRow">
                        <span>{selectedLine.projectName}</span>
                        <Badge tone={projectTone(selectedLine.projectStatus)}>
                          {localizeText(projectStatusLabel(selectedLine.projectStatus))}
                        </Badge>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Personal", "Headcount")}</div>
                      <div>{selectedLine.activeHeadcount} {t("personas", "people")}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Asistencia", "Attendance")}</div>
                      <div>{selectedLine.attendanceRate}%</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Vencimientos de cumplimiento", "Compliance expirations")}</div>
                      <div>{selectedLine.complianceExpirations}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Incidentes", "Incidents")}</div>
                      <div>{selectedLine.incidentCount}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Brecha de avance", "Progress gap")}</div>
                      <div>{selectedLine.progressGap}% {t("contra productividad del contratista", "against contractor productivity")}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Postura campo / calidad", "Field / quality posture")}</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">{t("ultima bitacora", "latest log")} {localizeText(dailyLogStatusLabel(selectedLine.latestDailyLogStatus))}</span>
                        <span className="tableCellMuted">{t("liberacion de calidad", "quality release readiness")} {selectedLine.qualityReleaseReadiness}%</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Retencion", "Retention")}</div>
                      <div>MXN {selectedLine.retentionAmount.toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Por que ahora", "Why now")}</div>
                      <div>{selectedWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Impacto aguas abajo", "Downstream effect")}</div>
                      <div>{selectedDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Módulo responsable", "Responsible module")}</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(selectedStation.primaryLabel)}</strong>
                        <span className="tableCellMuted">{localizeText(selectedStation.primaryReason)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Segundo salto", "Secondary jump")}</div>
                      <div className="tableCellStack">
                        <strong>{localizeText(selectedStation.secondaryLabel)}</strong>
                        <span className="tableCellMuted">{localizeText(selectedStation.secondaryReason)}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Proximo reporte", "Report back")}</div>
                      <div>{selectedReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Que debe regresar confirmado", "What must return confirmed")}</div>
                      <div>{localizeText(selectedStation.returnRule)}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Siguiente accion", "Next action")}</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder={t("Describe la siguiente accion de contratista, destajo o cumplimiento", "Describe the next subcontractor, destajo or compliance action")}
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Vinculos operativos", "Operational links")}</div>
                      <div className="row gap wrap">
                        {selectedStation.links.map((link, index) => (
                          <Link key={`${link.href}-${link.label.en}`} className={index === 0 ? "button" : "buttonGhost"} href={link.href}>
                            {index === 0 ? t(`Ir primero a ${localizeText(selectedStation.primaryLabel)}`, `Go first to ${localizeText(selectedStation.primaryLabel)}`) : localizeText(link.label)}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Reglas de negocio", "Business rules")}</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">{t("Controlado se bloquea mientras el destajo pendiente siga alto.", "Controlled is blocked while pending destajo remains high.")}</span>
                        <span className="tableCellMuted">{t("Controlado se bloquea mientras existan vencimientos o incidentes abiertos.", "Controlled is blocked while expirations or incidents remain open.")}</span>
                        <span className="tableCellMuted">{t("Controlado ahora tambien exige al menos 85% de liberacion de calidad.", "Controlled now also requires quality readiness of at least 85%.")}</span>
                        <span className="tableCellMuted">{t("Vigilancia se bloquea si la asistencia baja de 85% o la ultima bitacora sigue observada.", "Watch is blocked while attendance is below 85% or the latest field log remains flagged.")}</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">{t("Acciones", "Actions")}</div>
                      <div className="tableCellStack">
                        <div className="emptyActions">
                          <button
                            className="button"
                            type="button"
                            disabled={isSaving}
                            onClick={() => void handleAction(selectedLine.subcontractHealth, selectedLine.nextAction)}
                          >
                            {isSaving ? t("Guardando...", "Saving...") : t("Guardar siguiente accion", "Save next action")}
                          </button>
                          {lineActions.map((option) => (
                            <button
                              key={option.label}
                              className={option.subcontractHealth === "critical" ? "buttonGhost" : "button"}
                              type="button"
                              disabled={
                                isSaving ||
                                (option.subcontractHealth === "controlled" &&
                                  (selectedLine.pendingDestajo > selectedLine.contractAmount * 0.1 ||
                                    selectedLine.complianceExpirations > 0 ||
                                    selectedLine.incidentCount > 0 ||
                                    selectedLine.qualityReleaseReadiness < 85)) ||
                                (option.subcontractHealth === "watch" &&
                                  (selectedLine.attendanceRate < 85 || selectedLine.latestDailyLogStatus === "flagged"))
                              }
                              onClick={() => void handleAction(option.subcontractHealth, option.nextAction)}
                            >
                              {isSaving ? t("Guardando...", "Saving...") : localizeText(subcontractActionLabel(option.label))}
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
                    title={t("Sin subcontrato seleccionado", "No subcontract selected")}
                    description={t("Elige una linea de subcontrato para revisar avance, destajo y postura del contratista.", "Choose a subcontract line to inspect progress, destajo and contractor posture.")}
                    primaryAction={{ label: t("Seguir en subcontratos", "Stay on subcontracts"), href: "/subcontracts" }}
                  />
                )}
              </Card>

              <Card
                title={t("Alta operable de subcontrato", "Operable subcontract intake")}
                description={t("Captura un nuevo frente de contratista y dejalo listo para seguimiento inmediato.", "Capture a new contractor front and make it ready for immediate follow-through.")}
                aside={<Badge tone={createGateTone}>{createGateLabel}</Badge>}
              >
                <div className="captureCompactGrid">
                  <label className="captureField">
                    <span>{t("Proyecto", "Project")}</span>
                    {projectOptions.length > 0 ? (
                      <select
                        className="selectField"
                        value={createForm.projectName}
                        onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                      >
                        <option value="">{t("Selecciona proyecto", "Select project")}</option>
                        {projectOptions.map((projectName) => (
                          <option key={projectName} value={projectName}>
                            {projectName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="field"
                        value={createForm.projectName}
                        onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))}
                        placeholder={t("Nombre del proyecto", "Project name")}
                      />
                    )}
                  </label>
                  <label className="captureField">
                    <span>{t("Clave", "Code")}</span>
                    <input
                      className="field"
                      value={createForm.code}
                      onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                      placeholder="SUB-EST-03"
                    />
                  </label>
                  <label className="captureField" style={{ gridColumn: "1 / -1" }}>
                    <span>{t("Contratista", "Contractor")}</span>
                    <input
                      className="field"
                      value={createForm.contractorName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, contractorName: event.target.value }))}
                      placeholder={t("Ej. Concretos y Estructuras del Caribe", "E.g. Caribbean concrete and structures")}
                    />
                  </label>
                  <label className="captureField" style={{ gridColumn: "1 / -1" }}>
                    <span>{t("Frente", "Front")}</span>
                    <input
                      className="field"
                      value={createForm.frontName}
                      onChange={(event) => setCreateForm((current) => ({ ...current, frontName: event.target.value }))}
                      placeholder={t("Ej. Torre 2 · estructura nivel 9", "E.g. Tower 2 · structure level 9")}
                    />
                  </label>
                  <label className="captureField">
                    <span>{t("Personal activo", "Active headcount")}</span>
                    <input
                      className="field"
                      type="number"
                      min="1"
                      value={createForm.activeHeadcount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, activeHeadcount: event.target.value }))}
                    />
                  </label>
                  <label className="captureField">
                    <span>{t("Salud inicial", "Initial health")}</span>
                    <select
                      className="selectField"
                      value={createForm.subcontractHealth}
                      onChange={(event) =>
                        setCreateForm((current) => ({
                          ...current,
                          subcontractHealth: event.target.value as SubcontractLineContract["subcontractHealth"]
                        }))
                      }
                    >
                      <option value="controlled">{localizeText(subcontractHealthLabel("controlled"))}</option>
                      <option value="watch">{localizeText(subcontractHealthLabel("watch"))}</option>
                      <option value="critical">{localizeText(subcontractHealthLabel("critical"))}</option>
                    </select>
                  </label>
                  <label className="captureField">
                    <span>{t("Asistencia %", "Attendance %")}</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.attendanceRate}
                      onChange={(event) => setCreateForm((current) => ({ ...current, attendanceRate: event.target.value }))}
                    />
                  </label>
                  <label className="captureField">
                    <span>{t("Productividad %", "Productivity %")}</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      max="100"
                      value={createForm.productivityRate}
                      onChange={(event) => setCreateForm((current) => ({ ...current, productivityRate: event.target.value }))}
                    />
                  </label>
                  <label className="captureField">
                    <span>{t("Vencimientos", "Expirations")}</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.complianceExpirations}
                      onChange={(event) =>
                        setCreateForm((current) => ({ ...current, complianceExpirations: event.target.value }))
                      }
                    />
                  </label>
                  <label className="captureField">
                    <span>{t("Incidentes", "Incidents")}</span>
                    <input
                      className="field"
                      type="number"
                      min="0"
                      value={createForm.incidentCount}
                      onChange={(event) => setCreateForm((current) => ({ ...current, incidentCount: event.target.value }))}
                    />
                  </label>
                  <label className="captureField" style={{ gridColumn: "1 / -1" }}>
                    <span>{t("Siguiente accion", "Next action")}</span>
                    <input
                      className="field"
                      value={createForm.nextAction}
                      onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))}
                      placeholder={t("Ej. Liberar frente, validar calidad y alinear destajo con control de obra", "E.g. Release front, validate quality and align destajo with project control")}
                    />
                  </label>
                </div>

                <div className="detailGrid" style={{ marginTop: 18 }}>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Paso humano", "Human step")}</div>
                    <div>{createHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Siguiente modulo", "Next module")}</div>
                    <div>{createNextModule}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">{t("Checklist de alta", "Intake checklist")}</div>
                    <div className="tableCellStack">
                      {createGateChecks.length > 0 ? (
                        createGateChecks.map((check) => (
                          <span key={check} className="tableCellMuted">
                            {check}
                          </span>
                        ))
                      ) : (
                        <span className="tableCellMuted">
                          {t(
                            "El subcontrato puede darse de alta y brincar de inmediato a seguimiento operativo.",
                            "The subcontract can be created and moved directly into operating follow-through."
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="row gap wrap" style={{ marginTop: 18 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateSubcontract()}>
                    {isCreating ? t("Creando...", "Creating...") : t("Dar de alta subcontrato", "Create subcontract")}
                  </button>
                  <Link className="buttonGhost" href="/projects">
                    {t("Abrir proyectos", "Open projects")}
                  </Link>
                  <Link
                    className="buttonGhost"
                    href={buildQualityPrefillHref({
                      projectName: createForm.projectName,
                      frontName: createForm.frontName,
                      contractorName: createForm.contractorName,
                      nextAction: createForm.nextAction
                    })}
                  >
                    {t("Abrir calidad", "Open quality")}
                  </Link>
                  <Link
                    className="buttonGhost"
                    href={`/accounts-payable?source=subcontracts&supplierName=${encodeURIComponent(createForm.contractorName)}&projectName=${encodeURIComponent(createForm.projectName)}&purchaseOrderCode=${encodeURIComponent(createForm.code)}&nextAction=${encodeURIComponent(createForm.nextAction)}`}
                  >
                    {t("Abrir cuentas por pagar", "Open accounts payable")}
                  </Link>
                </div>

                {createMessage ? <p className="formSuccess">{createMessage}</p> : null}
                {createError ? <p className="formError">{createError}</p> : null}
              </Card>
            </section>

            <Card title={t("Riesgos del subcontrato", "Subcontract risks")} description={t("Bloqueadores de capacidad, cumplimiento y pago que afectan la continuidad del contratista.", "Capacity, compliance and payment blockers affecting contractor continuity.")}>
              <DataTable
                rows={selectedRisks.length > 0 ? selectedRisks : overview.risks}
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
                        {localizeText(riskSeverityLabel(risk.severity))}
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
            </Card>
          </>
        ) : error ? (
          <EmptyState
            title={t("Vista de subcontratos no disponible", "Subcontracts overview unavailable")}
            description={error}
            primaryAction={{ label: t("Ir al tablero", "Go to dashboard"), href: "/dashboard" }}
            secondaryAction={{ label: t("Revisar acceso", "Review login"), href: "/login" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? t("Cargando vista de subcontratos", "Loading subcontracts overview") : t("La vista de subcontratos aun no carga", "Subcontracts overview not loaded yet")}
            description={t("Esta ruta puede cargar subcontratos del backend o desde los datos de respaldo disponibles.", "This route can load tenant subcontract data from the backend or available fallback data.")}
            primaryAction={{ label: t("Ir al tablero", "Go to dashboard"), href: "/dashboard" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
