"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { TreasuryPaymentRunContract, TreasuryPaymentRunsOverviewContract } from "@/lib/contracts";
import {
  addTreasuryPaymentRunInvoice,
  createTreasuryPaymentRun,
  fetchTreasuryPaymentRunsOverview,
  moveTreasuryPaymentRunInvoice,
  removeTreasuryPaymentRunInvoice,
  updateTreasuryPaymentRun
} from "@/lib/platform-api";

type BilingualText = {
  es: string;
  en: string;
};

const emptyCreateForm = {
  bankAccountLabel: "Banorte Operacion ****4451",
  scheduledDate: "2026-07-25",
  owner: "Treasury lead",
  nextAction: ""
};

function createPaymentRunExample() {
  return {
    bankAccountLabel: "BBVA Dispersions Norte ****8821",
    scheduledDate: "2026-07-29",
    owner: "Mesa de tesoreria",
    nextAction: "Liberar lote con proveedores completos y confirmar evidencia bancaria antes de las 15:00"
  };
}

function tone(status: TreasuryPaymentRunContract["status"]) {
  switch (status) {
    case "executed":
      return "success";
    case "ready":
      return "info";
    case "draft":
      return "warning";
    default:
      return "danger";
  }
}

function unavailableTone(reasonCode: TreasuryPaymentRunsOverviewContract["unavailableInvoices"][number]["reasonCode"]) {
  switch (reasonCode) {
    case "already_paid":
      return "success";
    case "already_assigned":
      return "warning";
    default:
      return "danger";
  }
}

function buildCreatePaymentRunGate(input: {
  bankAccountLabel: string;
  scheduledDate: string;
  owner: string;
  nextAction: string;
  selectedInvoiceCount: number;
  selectedInvoiceAmount: number;
  availableEligibleInvoices: number;
}) {
  const checks: BilingualText[] = [];

  if (input.bankAccountLabel.trim().length < 8) {
    checks.push({
      es: "La cuenta bancaria todavía necesita una captura más descriptiva para tesorería.",
      en: "The bank account label still needs more descriptive treasury capture."
    });
  }

  if (!input.scheduledDate) {
    checks.push({ es: "Todavía falta la fecha programada.", en: "The scheduled date is still missing." });
  }

  if (input.owner.trim().length < 3) {
    checks.push({
      es: "El responsable de tesorería todavía necesita una captura más específica.",
      en: "The treasury owner still needs more specific capture."
    });
  }

  if (input.nextAction.trim().length < 8) {
    checks.push({
      es: "La siguiente acción todavía necesita suficiente detalle para dar seguimiento a la liberación.",
      en: "The next action still needs enough detail for release follow-through."
    });
  }

  if (input.selectedInvoiceCount === 0) {
    checks.push({
      es: "Debes seleccionar al menos una factura elegible antes de crear una corrida.",
      en: "At least one eligible invoice must be selected before creating a payment run."
    });
  }

  if (input.availableEligibleInvoices === 0) {
    checks.push({
      es: "No hay facturas elegibles disponibles para armar una corrida en este momento.",
      en: "There are no eligible invoices available to assemble into a run right now."
    });
  }

  if (input.selectedInvoiceAmount <= 0 && input.selectedInvoiceCount > 0) {
    checks.push({
      es: "Las facturas seleccionadas todavía no forman un monto válido para tesorería.",
      en: "The selected invoices still do not form a valid treasury amount."
    });
  }

  if (checks.length > 0) {
    const hardBlock = !input.scheduledDate || input.selectedInvoiceCount === 0 || input.availableEligibleInvoices === 0;

    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock
        ? { es: "No crear aún", en: "Do not create yet" }
        : { es: "Crear con control", en: "Create with control" },
      summary: hardBlock
        ? {
            es: "Este lote de tesorería arrancaría con un bloqueo duro de preparación.",
            en: "This treasury batch would open with a hard readiness blocker."
          }
        : {
            es: "La corrida se puede crear, pero la disciplina operativa todavía debe apretarse antes de liberarla.",
            en: "The batch can be created, but treasury discipline still needs tightening before it becomes truly releasable."
          },
      checks
    };
  }

  return {
    tone: "success" as const,
    label: { es: "Lista para crear", en: "Ready to create" },
    summary: {
      es: "La corrida tiene suficiente estructura para entrar limpia a revisión de tesorería.",
      en: "The payment run has enough structure to enter treasury review cleanly."
    },
    checks: [
      {
        es: "La corrida creada se volverá el lote de enfoque inmediatamente.",
        en: "The created run will become the current focus batch immediately."
      },
      {
        es: "Conserva la trazabilidad de CXP, proveedor y ejecución bancaria desde el primer armado.",
        en: "Keep AP, supplier and bank execution traceability attached from the first treasury assembly."
      }
    ]
  };
}

function buildCreatePaymentRunHumanStep(input: {
  selectedInvoiceCount: number;
  scheduledDate: string;
  nextAction: string;
}) {
  if (input.selectedInvoiceCount === 0) {
    return {
      es: "Selecciona primero las facturas por pagar para que tesorería no cree un lote vacío.",
      en: "Select the payable invoices first so treasury is not creating an empty batch."
    };
  }

  if (!input.scheduledDate) {
    return {
      es: "Define la fecha de ejecución antes de crear la corrida para mantener explícito el calendario de caja.",
      en: "Set the execution date before creating the batch so cash timing stays explicit."
    };
  }

  if (input.nextAction.trim().length < 8) {
    return {
      es: "Aclara el plan de liberación de tesorería antes de guardar la corrida.",
      en: "Clarify the treasury release plan before persisting the batch."
    };
  }

  return {
    es: "Crea la corrida y revísala de inmediato para decidir si se queda en borrador o puede avanzar a lista sin reconstruir el contexto de CXP.",
    en: "Create the run and immediately review whether it should stay draft or move toward ready without rebuilding the AP context."
  };
}

function buildSelectedRunGate(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return {
      tone: "info" as const,
      label: { es: "Sin corrida seleccionada", en: "No run selected" },
      summary: {
        es: "Elige una corrida de tesorería para validar si de verdad está lista, bloqueada o sigue en borrador.",
        en: "Choose a treasury run to verify whether it is really ready, blocked or still draft."
      },
      checks: [{ es: "Selecciona una corrida desde la bandeja activa de tesorería.", en: "Select a run from the active treasury board." }]
    };
  }

  const checks: BilingualText[] = [];

  if (run.status === "blocked") {
    checks.push({ es: "La corrida ya está bloqueada a nivel tesorería.", en: "The run is already blocked at treasury level." });
  }

  if (run.criticalInvoices > 0) {
    checks.push({
      es: `${run.criticalInvoices} factura(s) crítica(s) todavía amenazan una ejecución limpia.`,
      en: `${run.criticalInvoices} critical invoice(s) still threaten clean execution.`
    });
  }

  if (run.totalInvoices <= 0) {
    checks.push({ es: "La corrida todavía no tiene facturas asociadas.", en: "The run still has no invoices attached." });
  }

  if (run.status === "draft") {
    checks.push({
      es: "La corrida sigue en borrador y todavía no alcanza una postura de lista.",
      en: "The run is still draft and has not reached ready posture."
    });
  }

  if (checks.length > 0) {
    const hardBlock = run.status === "blocked" || run.totalInvoices <= 0 || run.criticalInvoices > 0;
    return {
      tone: hardBlock ? "danger" as const : "warning" as const,
      label: hardBlock
        ? { es: "No ejecutar aún", en: "Do not execute yet" }
        : { es: "Operar con control", en: "Operate with control" },
      summary: hardBlock
        ? {
            es: "Este lote de tesorería todavía carga bloqueos antes de confiar su ejecución bancaria.",
            en: "This treasury batch still carries blockers before bank execution should be trusted."
          }
        : {
            es: "La corrida puede seguir, pero tesorería debe apretar primero el carril de liberación.",
            en: "The batch can continue, but treasury should tighten the release lane first."
          },
      checks
    };
  }

  return {
    tone: "success" as const,
    label: run.status === "executed" ? { es: "Ya ejecutada", en: "Already executed" } : { es: "Lista para continuidad", en: "Ready for treasury continuity" },
    summary:
      run.status === "executed"
        ? {
            es: "La corrida ya fue ejecutada y debe quedarse solo como trazabilidad financiera.",
            en: "The batch is already executed and should stay only as financial traceability."
          }
        : {
            es: "La cantidad de facturas, el riesgo y la postura operativa ya están alineados para continuidad de tesorería.",
            en: "Invoice count, risk and posture are aligned for treasury continuity."
          },
    checks: [
      {
        es: "Continúa a ejecución bancaria o seguimiento de CXP sin reconstruir el mismo contexto de corrida.",
        en: "Continue into bank execution or AP follow-through without rebuilding the same run context."
      },
      {
        es: "Conserva el mismo responsable y la misma siguiente acción hasta cerrar el lote por completo.",
        en: "Keep the same owner and next action attached until the batch is fully closed."
      }
    ]
  };
}

function buildSelectedRunWhyNow(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return {
      es: "Selecciona una corrida para entender por qué merece atención en este momento.",
      en: "Choose a treasury run to understand why it deserves attention right now."
    };
  }

  if (run.status === "blocked") {
    return {
      es: "Este lote ya está bloqueado, así que cualquier demora aquí puede congelar al mismo tiempo la continuidad de pago de varios proveedores.",
      en: "This batch is already blocked, so delay here can freeze payment continuity across multiple suppliers at once."
    };
  }

  if (run.criticalInvoices > 0) {
    return {
      es: "Ya hay facturas críticas dentro del lote, así que tesorería debe actuar antes de normalizar una mala calidad de liberación.",
      en: "Critical invoices are already inside the batch, so treasury should act before the run normalizes bad release quality."
    };
  }

  if (run.status === "draft") {
    return {
      es: "La corrida sigue en borrador, así que tesorería debe decidir ahora si realmente puede ejecutarse o necesita más limpieza.",
      en: "The run is still draft, so treasury should decide now whether it can become real execution or needs more cleanup."
    };
  }

  if (run.status === "ready") {
    return {
      es: "La corrida ya está lo bastante cerca de ejecución bancaria como para que una demora de tesorería convierta un buen lote en una liberación obsoleta.",
      en: "The run is close enough to bank execution that treasury delay can turn a good batch into stale release posture."
    };
  }

  return {
    es: "La corrida ya está ejecutada, pero tesorería todavía debe conservar una trazabilidad limpia y confirmación hacia abajo.",
    en: "This run is already executed, but treasury should still preserve clean traceability and downstream confirmation."
  };
}

function buildSelectedRunDownstreamEffect(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return {
      es: "Selecciona una corrida para revisar qué puede bloquear aguas abajo.",
      en: "Choose a treasury run to inspect what it can block downstream."
    };
  }

  if (run.status === "blocked" || run.criticalInvoices > 0) {
    return {
      es: "El efecto aguas abajo es desconfianza del proveedor, congestión en CXP y distorsión del calendario financiero en toda la cadena de pagos.",
      en: "The downstream effect is supplier distrust, AP congestion and distorted finance timing across the payment chain."
    };
  }

  if (run.status === "draft") {
    return {
      es: "Una corrida inestable en borrador puede propagar confusión hacia CXP, la liberación de proveedores y la secuencia de caja de corto plazo.",
      en: "An unstable draft run can propagate confusion back into AP, supplier release and short-term cash sequencing."
    };
  }

  if (run.status === "ready") {
    return {
      es: "Si este lote listo se estanca, la confianza de tesorería y el calendario de liberación a proveedores pueden degradarse al mismo tiempo.",
      en: "If this ready batch stalls, treasury confidence and supplier release timing can degrade together."
    };
  }

  return {
    es: "El efecto aguas abajo es sobre todo disciplina de conciliación: mantener alineados a CXP, proveedores y finanzas después de ejecutar.",
    en: "The downstream effect is mostly reconciliation discipline: keep AP, suppliers and finance aligned after execution."
  };
}

function buildSelectedRunReportBack(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return {
      es: "Selecciona una corrida para definir la siguiente ventana de reporte.",
      en: "Choose a treasury run to define the next report-back window."
    };
  }

  if (run.status === "blocked" || run.criticalInvoices > 0) {
    return {
      es: "Reporta antes del siguiente corte de tesorería con la contención del bloqueo y el estatus de liberación de facturas.",
      en: "Report back before the next treasury cutoff with blocker containment and invoice-release status."
    };
  }

  if (run.status === "draft") {
    return {
      es: "Reporta dentro del mismo ciclo operativo una vez que la corrida quede lista o se re-secuencie explícitamente.",
      en: "Report back in the same operating cycle once the batch is either ready or explicitly resequenced."
    };
  }

  if (run.status === "ready") {
    return {
      es: "Reporta tan pronto se confirme que el calendario de ejecución bancaria sigue vigente.",
      en: "Report back as soon as bank execution timing is confirmed and still valid."
    };
  }

  return {
    es: "Reporta en la siguiente actualización de tesorería confirmando que la ejecución se mantuvo conciliada y limpia.",
    en: "Report back on the next treasury refresh confirming execution stayed reconciled and clean."
  };
}

function buildSelectedRunLinks(run: TreasuryPaymentRunContract | null) {
  if (!run) {
    return [
      { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" },
      { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" },
      { label: { es: "Abrir flujo de efectivo", en: "Open cash flow" }, href: "/cash-flow" }
    ];
  }

  if (run.status === "blocked" || run.criticalInvoices > 0) {
    return [
      { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" },
      { label: { es: "Abrir catálogo de proveedores", en: "Open supplier master" }, href: "/supplier-master" },
      { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" }
    ];
  }

  if (run.status === "draft") {
    return [
      { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" },
      { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" },
      { label: { es: "Abrir flujo de efectivo", en: "Open cash flow" }, href: "/cash-flow" }
    ];
  }

  return [
    { label: { es: "Abrir finanzas", en: "Open finance" }, href: "/finance" },
    { label: { es: "Abrir flujo de efectivo", en: "Open cash flow" }, href: "/cash-flow" },
    { label: { es: "Abrir cuentas por pagar", en: "Open accounts payable" }, href: "/accounts-payable" }
  ];
}

export default function TreasuryPaymentRunsPage() {
  const { activeCompany, apiBaseUrl, session, source, uiLanguage, localizeText } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const t = useCallback((es: string, en: string) => localizeText({ es, en }), [localizeText]);
  const [overview, setOverview] = useState<TreasuryPaymentRunsOverviewContract | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | TreasuryPaymentRunContract["status"]>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"workbench" | "queue" | "details">("workbench");
  const [nextActionDraft, setNextActionDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedEligibleInvoiceId, setSelectedEligibleInvoiceId] = useState<string>("");
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  async function reloadOverview() {
    const runs = await fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken });
    setOverview(runs);
    setSelectedId((current) => current ?? runs?.focusRun?.id ?? runs?.runs[0]?.id ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void fetchTreasuryPaymentRunsOverview(activeCompany.id, { apiBaseUrl, accessToken: session.accessToken })
      .then((runs) => {
        if (cancelled) {
          return;
        }
        setOverview(runs);
        setSelectedId((current) => current ?? runs?.focusRun?.id ?? runs?.runs[0]?.id ?? null);
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

  const filteredRuns = useMemo(() => {
    if (!overview) {
      return [];
    }

    const normalizedSearch = searchFilter.trim().toLowerCase();
    return overview.runs.filter((run) => {
      const matchesStatus = statusFilter === "all" || run.status === statusFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        run.code.toLowerCase().includes(normalizedSearch) ||
        run.bankAccountLabel.toLowerCase().includes(normalizedSearch) ||
        run.owner.toLowerCase().includes(normalizedSearch) ||
        run.nextAction.toLowerCase().includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [overview, searchFilter, statusFilter]);

  const filteredSummary = useMemo(() => recomputeSummary(filteredRuns), [filteredRuns]);

  const selectedRun = useMemo(
    () => filteredRuns.find((run) => run.id === selectedId) ?? filteredRuns[0] ?? null,
    [filteredRuns, selectedId]
  );
  const selectedRisks = useMemo(
    () => overview?.risks.filter((risk) => risk.paymentRunId === selectedRun?.id) ?? [],
    [overview, selectedRun]
  );
  const selectedRunGate = useMemo(() => buildSelectedRunGate(selectedRun), [selectedRun]);
  const selectedRunWhyNow = useMemo(() => buildSelectedRunWhyNow(selectedRun), [selectedRun]);
  const selectedRunDownstreamEffect = useMemo(() => buildSelectedRunDownstreamEffect(selectedRun), [selectedRun]);
  const selectedRunReportBack = useMemo(() => buildSelectedRunReportBack(selectedRun), [selectedRun]);
  const selectedRunLinks = useMemo(() => buildSelectedRunLinks(selectedRun), [selectedRun]);
  const selectedRunGateLabel = useMemo(() => {
    if (!selectedRun) {
      return t("Sin corrida seleccionada", "No run selected");
    }
    if (selectedRun.status === "executed") {
      return t("Ya ejecutada", "Already executed");
    }
    if (selectedRunGate.tone === "danger") {
      return t("No ejecutar aún", "Do not execute yet");
    }
    if (selectedRunGate.tone === "warning") {
      return t("Operar con control", "Operate with control");
    }
    return t("Lista para continuidad", "Ready for continuity");
  }, [selectedRun, selectedRunGate.tone, t]);
  const selectedRunGateSummary = useMemo(() => {
    if (!selectedRun) {
      return t("Selecciona una corrida para validar si realmente está lista, bloqueada o todavía en borrador.", "Select a run to validate whether it is really ready, blocked or still draft.");
    }
    if (selectedRun.status === "blocked") {
      return t("La corrida ya tiene un bloqueo activo de tesorería y no debe avanzar al banco.", "The run already carries an active treasury block and should not advance to the bank.");
    }
    if (selectedRun.criticalInvoices > 0) {
      return t("Todavía hay facturas críticas dentro del lote y eso invalida una liberación limpia.", "Critical invoices are still inside the batch, which invalidates a clean release.");
    }
    if (selectedRun.totalInvoices <= 0) {
      return t("La corrida no tiene facturas asociadas y necesita recomposición antes de seguir.", "The run has no invoices attached and needs recomposition before continuing.");
    }
    if (selectedRun.status === "draft") {
      return t("La corrida sigue en borrador y requiere validación operativa antes de marcarse lista.", "The run is still draft and needs operating validation before being marked ready.");
    }
    if (selectedRun.status === "ready") {
      return t("La corrida ya tiene postura suficiente para confirmar condiciones bancarias y ejecutar.", "The run has enough posture to confirm banking conditions and execute.");
    }
    return t("La corrida queda solo para trazabilidad y conciliación posterior.", "The run stays as traceability and post-execution reconciliation only.");
  }, [selectedRun, t]);
  const selectedRunHumanStepCopy = useMemo(() => {
    if (!selectedRun) {
      return t("Selecciona una corrida para identificar el siguiente movimiento humano.", "Choose a run to identify the next human move.");
    }
    if (selectedRun.status === "blocked") {
      return t("Resuelve primero el bloqueo fiscal, documental o de factura y regresa cuando el lote pueda moverse.", "Resolve the fiscal, documentary or invoice block first, then return when the batch can move again.");
    }
    if (selectedRun.criticalInvoices > 0) {
      return t("Contén las facturas críticas y decide si deben quedarse, moverse o salir de la corrida.", "Contain the critical invoices and decide whether they should stay, move or leave the run.");
    }
    if (selectedRun.status === "draft") {
      return t("Valida la composición del lote ahora y decide si ya puede quedar lista o todavía requiere limpieza de CXP.", "Validate the batch composition now and decide whether it can be ready or still needs AP cleanup.");
    }
    if (selectedRun.status === "ready") {
      return t("Confirma condiciones bancarias y conserva informada a CXP antes de que la corrida se degrade.", "Confirm banking conditions and keep AP informed before the run degrades.");
    }
    return t("Cierra la trazabilidad y confirma que la corrida ejecutada no dejó residuos operativos pendientes.", "Close traceability and confirm the executed run did not leave unresolved operating residue.");
  }, [selectedRun, t]);
  const eligibleInvoices = useMemo(
    () => overview?.eligibleInvoices ?? [],
    [overview]
  );
  const unavailableInvoices = useMemo(
    () => overview?.unavailableInvoices ?? [],
    [overview]
  );
  const selectedCreateInvoices = useMemo(
    () => eligibleInvoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id)),
    [eligibleInvoices, selectedInvoiceIds]
  );
  const createPaymentRunGate = useMemo(
    () =>
      buildCreatePaymentRunGate({
        bankAccountLabel: form.bankAccountLabel,
        scheduledDate: form.scheduledDate,
        owner: form.owner,
        nextAction: form.nextAction,
        selectedInvoiceCount: selectedCreateInvoices.length,
        selectedInvoiceAmount: selectedCreateInvoices.reduce((sum, invoice) => sum + invoice.pendingAmount, 0),
        availableEligibleInvoices: eligibleInvoices.length
      }),
    [eligibleInvoices.length, form.bankAccountLabel, form.nextAction, form.owner, form.scheduledDate, selectedCreateInvoices]
  );
  const createPaymentRunHumanStep = useMemo(
    () =>
      buildCreatePaymentRunHumanStep({
        selectedInvoiceCount: selectedCreateInvoices.length,
        scheduledDate: form.scheduledDate,
        nextAction: form.nextAction
      }),
    [form.nextAction, form.scheduledDate, selectedCreateInvoices.length]
  );
  const availableTargetRuns = useMemo(
    () => overview?.runs.filter((run) => run.id !== selectedRun?.id && run.status !== "executed") ?? [],
    [overview, selectedRun?.id]
  );
  const executableActions = useMemo(() => {
    if (!selectedRun) {
      return [];
    }

    const actions = [t("Bloquear corrida", "Block run")];
    if (selectedRun.status !== "executed") {
      actions.unshift(t("Separar o mover facturas", "Separate or move invoices"));
      actions.unshift(t("Actualizar siguiente acción", "Update next action"));
    }
    if (selectedRun.status === "draft" || selectedRun.status === "blocked") {
      actions.unshift(t("Marcar lista", "Mark ready"));
    }
    if (selectedRun.status === "ready") {
      actions.unshift(t("Ejecutar corrida", "Execute run"));
    }

    return actions;
  }, [selectedRun, t]);
  const restrictedActions = useMemo(() => {
    if (!selectedRun) {
      return [t("Sin corrida seleccionada todavía.", "No run selected yet.")];
    }

    const restrictions: string[] = [];

    if (selectedRun.status !== "ready") {
      restrictions.push(t("No se puede ejecutar hasta que la corrida esté en estado lista.", "Cannot execute until the run is already in ready status."));
    }
    if (selectedRun.criticalInvoices > 0) {
      restrictions.push(
        t(
          "Las facturas críticas deben resolverse antes de confiar la liberación bancaria.",
          "Critical invoices must be resolved before bank release can be trusted."
        )
      );
    }
    if (selectedRun.totalInvoices <= 0) {
      restrictions.push(t("No debe quedar una corrida sin facturas.", "A run should not be left without invoices."));
    }
    if (selectedRun.status === "executed") {
      restrictions.push(t("Las corridas ejecutadas quedan solo para trazabilidad; ya no admiten rebalanceo.", "Executed runs stay traceability-only and no longer allow rebalancing."));
    }

    return restrictions.length > 0 ? restrictions : [t("Sin restricciones operativas inmediatas.", "No immediate operating restrictions.")];
  }, [selectedRun, t]);

  function paymentRunStatusLabel(status: TreasuryPaymentRunContract["status"]) {
    switch (status) {
      case "draft":
        return { es: "Borrador", en: "Draft" };
      case "ready":
        return { es: "Lista", en: "Ready" };
      case "blocked":
        return { es: "Bloqueada", en: "Blocked" };
      case "executed":
        return { es: "Ejecutada", en: "Executed" };
      default:
        return { es: status, en: status };
    }
  }

  useEffect(() => {
    if (!overview) {
      return;
    }

    if (filteredRuns.length === 0) {
      setSelectedId(null);
      return;
    }

    const isSelectedVisible = filteredRuns.some((run) => run.id === selectedId);
    if (!isSelectedVisible) {
      setSelectedId(filteredRuns[0]?.id ?? null);
    }
  }, [filteredRuns, overview, selectedId]);

  useEffect(() => {
    setNextActionDraft(selectedRun?.nextAction ?? "");
    setMessage(null);
    setError(null);
  }, [selectedRun?.id, selectedRun?.nextAction]);

  function recomputeSummary(runs: TreasuryPaymentRunContract[]) {
    return {
      activeRuns: runs.filter((run) => run.status !== "executed").length,
      scheduledAmount: runs.filter((run) => run.status !== "executed").reduce((sum, run) => sum + run.totalAmount, 0),
      blockedRuns: runs.filter((run) => run.status === "blocked").length,
      executedRuns: runs.filter((run) => run.status === "executed").length,
      criticalInvoices: runs.reduce((sum, run) => sum + run.criticalInvoices, 0),
      readyRuns: runs.filter((run) => run.status === "ready").length,
      duplicateAssignments: 0
    };
  }

  async function handleUpdate(status: TreasuryPaymentRunContract["status"]) {
    if (!selectedRun) {
      return;
    }

    const nextAction = nextActionDraft.trim();
    if (nextAction.length < 8) {
      setError(t("La siguiente acción debe describir el seguimiento de liberación de tesorería.", "Next action must describe the treasury release follow-up."));
      return;
    }

    if (status === "executed" && selectedRun.status !== "ready") {
      setError(t("Solo las corridas ya marcadas como listas pueden ejecutarse.", "Only runs already marked ready can be executed."));
      return;
    }

    setMessage(null);
    setError(null);
    const response = await updateTreasuryPaymentRun(
      selectedRun.id,
      activeCompany.id,
      { status, nextAction },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? t("La actualización de la corrida falló.", "Payment run update failed."));
      return;
    }
    const updated = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }
      const runs = current.runs.map((run) => (run.id === updated.id ? updated : run));
      return { ...current, summary: recomputeSummary(runs), runs, focusRun: updated };
    });
    setMessage(
      t(
        `La corrida cambió a ${localizeText(paymentRunStatusLabel(updated.status)).toLowerCase()}.`,
        `Payment run moved to ${localizeText(paymentRunStatusLabel(updated.status)).toLowerCase()}.`
      )
    );
  }

  async function handleCreate() {
    if (form.bankAccountLabel.trim().length < 8) {
      setError(t("La cuenta bancaria debe ser suficientemente descriptiva para la operación de tesorería.", "Bank account label must be descriptive enough for treasury operations."));
      return;
    }

    if (!form.scheduledDate) {
      setError(t("La fecha programada es obligatoria.", "Scheduled date is required."));
      return;
    }

    if (form.owner.trim().length < 3) {
      setError(t("El responsable debe contener al menos 3 caracteres.", "Owner must contain at least 3 characters."));
      return;
    }

    if (form.nextAction.trim().length < 8) {
      setError(t("La siguiente acción debe describir el plan de liberación.", "Next action must describe the release plan."));
      return;
    }

    if (selectedInvoiceIds.length === 0) {
      setError(t("Selecciona al menos una factura elegible antes de crear la corrida.", "Select at least one eligible invoice before creating a payment run."));
      return;
    }

    setMessage(null);
    setError(null);
    const response = await createTreasuryPaymentRun(
      activeCompany.id,
      {
        bankAccountLabel: form.bankAccountLabel.trim(),
        scheduledDate: form.scheduledDate,
        owner: form.owner.trim(),
        nextAction: form.nextAction.trim(),
        invoiceIds: selectedInvoiceIds
      },
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? t("La creación de la corrida falló.", "Payment run creation failed."));
      return;
    }
    const created = response.data;

    setOverview((current) => {
      if (!current) {
        return current;
      }
      const runs = [created, ...current.runs];
      return { ...current, summary: recomputeSummary(runs), runs, focusRun: created };
    });
    setSelectedId(created.id);
    setSelectedInvoiceIds([]);
    setForm(emptyCreateForm);
    setMessage(t(`${created.code} creada.`, `${created.code} created.`));
  }

  async function handleRemoveInvoice(invoiceId: string) {
    if (!selectedRun) {
      return;
    }

    setMessage(null);
    setError(null);
    const response = await removeTreasuryPaymentRunInvoice(
      selectedRun.id,
      invoiceId,
      activeCompany.id,
      nextActionDraft || "Separated invoice from treasury batch for revalidation.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? t("La separación de la factura desde la corrida falló.", "Invoice removal from payment run failed."));
      return;
    }

    await reloadOverview();
    setMessage(
      t(
        `Se separó la factura de ${selectedRun.code}; la corrida volvió a borrador para revalidación.`,
        `Invoice removed from ${selectedRun.code}; run returned to draft for revalidation.`
      )
    );
  }

  async function handleAddInvoiceToRun() {
    if (!selectedRun) {
      return;
    }

    if (!selectedEligibleInvoiceId) {
      setError(t("Selecciona una factura elegible antes de agregarla a la corrida.", "Select one eligible invoice before adding it to the run."));
      return;
    }

    setMessage(null);
    setError(null);
    const response = await addTreasuryPaymentRunInvoice(
      selectedRun.id,
      activeCompany.id,
      selectedEligibleInvoiceId,
      nextActionDraft || "Added eligible invoice into treasury batch for updated release review.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? t("La incorporación de la factura a la corrida falló.", "Invoice add into payment run failed."));
      return;
    }

    setSelectedEligibleInvoiceId("");
    await reloadOverview();
    setMessage(
      t(
        `La factura se agregó a ${selectedRun.code}; la corrida volvió a borrador para revalidación.`,
        `Invoice added into ${selectedRun.code}; run returned to draft for revalidation.`
      )
    );
  }

  async function handleMoveInvoice(invoiceId: string) {
    if (!selectedRun) {
      return;
    }

    const targetPaymentRunId = moveTargets[invoiceId];
    if (!targetPaymentRunId) {
      setError(t("Elige una corrida destino antes de mover la factura.", "Choose a target run before moving the invoice."));
      return;
    }

    setMessage(null);
    setError(null);
    const response = await moveTreasuryPaymentRunInvoice(
      selectedRun.id,
      invoiceId,
      activeCompany.id,
      targetPaymentRunId,
      nextActionDraft || "Moved invoice into another treasury batch for cleaner release sequencing.",
      { apiBaseUrl, accessToken: session.accessToken }
    );

    if (!response.data) {
      setError(response.error?.message ?? t("El movimiento de la factura entre corridas falló.", "Invoice move between payment runs failed."));
      return;
    }

    setMoveTargets((current) => ({ ...current, [invoiceId]: "" }));
    await reloadOverview();
    setMessage(
      t(
        `La factura salió de ${selectedRun.code} hacia otra corrida abierta.`,
        `Invoice moved out of ${selectedRun.code} into another open run.`
      )
    );
  }

  return (
    <AppShell
      title={t("Corridas de pago de tesorería", "Treasury payment runs")}
      eyebrow={t("Ejecución de tesorería", "Treasury execution")}
      description={t(
        "Agrupa y libera pagos a proveedores con controles fiscales y de evidencia.",
        "Batch and release supplier payments with fiscal and evidence controls."
      )}
    >
      <ModuleGate
        moduleKeys={["finance.accounting"]}
        requiredPermissions={["finance:*", "finance:read"]}
        title={t("Corridas de pago de tesorería", "Treasury payment runs")}
      >
        {overview ? (
          <>
            <section className="stack" lang={uiLanguage}>
              <div className="row gap wrap" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="stack" style={{ maxWidth: 840 }}>
                  <span className="eyebrow">
                    {t("Workbench de tesorería", "Treasury workbench")}
                    <span className="mono">{t("corridas de pago", "payment runs")}</span>
                  </span>
                  <h2>{selectedRun?.code ?? t("Selecciona una corrida", "Select a payment run")}</h2>
                  <p>
                    {t(
                      "Controla la corrida activa arriba del pliegue: confirma la puerta de tesorería, el responsable, la siguiente acción humana y rebalancea facturas sin salir del lote.",
                      "Control the active run above the fold: confirm the treasury gate, owner, next human action and rebalance invoices without leaving the batch."
                    )}
                  </p>
                </div>
                <div className="row gap wrap">
                  <Badge tone={isDemoMode ? "warning" : "success"}>{isDemoMode ? t("modo demo", "demo mode") : t("backend real", "live backend")}</Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? t("actualizando", "refreshing") : t("lista para operar", "ready to operate")}</Badge>
                </div>
              </div>

              <div className="row gap wrap" role="tablist" aria-label={t("Vistas de corridas de pago", "Payment run views")}>
                {([
                  ["workbench", t("Control", "Control")],
                  ["queue", t("Bandeja", "Queue")],
                  ["details", t("Detalles operativos", "Operational details")]
                ] as const).map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    role="tab"
                    aria-selected={workspaceView === view}
                    className={workspaceView === view ? "button" : "buttonGhost"}
                    onClick={() => setWorkspaceView(view)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {workspaceView === "workbench" ? (
              <section className="grid cols2" lang={uiLanguage}>
                <Card
                  title={t("Corrida seleccionada", "Selected payment run")}
                  description={t("Resumen inmediato para decidir si la corrida puede seguir, bloquearse o ejecutarse.", "Immediate summary to decide whether the run can continue, be blocked or be executed.")}
                  aside={selectedRun ? <Badge tone={tone(selectedRun.status)}>{localizeText(paymentRunStatusLabel(selectedRun.status))}</Badge> : null}
                >
                  {selectedRun ? (
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Puerta de tesorería", "Treasury gate")}</div><div className="tableCellStack"><div className="row gap wrap" style={{ alignItems: "center" }}><Badge tone={selectedRunGate.tone}>{selectedRunGateLabel}</Badge><span>{selectedRunGateSummary}</span></div></div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Responsable", "Owner")}</div><div>{selectedRun.owner}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Valor", "Value")}</div><div>{`MXN ${selectedRun.totalAmount.toLocaleString()}`}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Facturas", "Invoices")}</div><div>{selectedRun.totalInvoices}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Siguiente acción humana", "Next human action")}</div><div>{selectedRunHumanStepCopy}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Acciones ejecutables", "Executable actions")}</div><div>{executableActions.join(" · ")}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Acciones restringidas", "Restricted actions")}</div><div className="tableCellStack">{restrictedActions.map((item) => <span key={item}>{item}</span>)}</div></div>
                      <label className="detailRow">
                        <div className="detailLabel">{t("Siguiente acción", "Next action")}</div>
                        <textarea className="field" rows={4} lang={uiLanguage} value={nextActionDraft} onChange={(event) => setNextActionDraft(event.target.value)} />
                      </label>
                      <div className="cluster">
                        <button className="button" type="button" onClick={() => void handleUpdate("ready")}>{t("Marcar lista", "Mark ready")}</button>
                        <button className="buttonGhost" type="button" onClick={() => void handleUpdate("blocked")}>{t("Bloquear corrida", "Block run")}</button>
                        <button className="button" type="button" onClick={() => void handleUpdate("executed")}>{t("Ejecutar corrida", "Execute run")}</button>
                      </div>
                      <div className="row gap wrap">
                        {selectedRunLinks.map((link, index) => (
                          <Link key={`${link.href}-${link.label.en}`} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                            {localizeText(link.label)}
                          </Link>
                        ))}
                      </div>
                      {message ? <Badge tone="success">{message}</Badge> : null}
                      {error ? <Badge tone="danger">{error}</Badge> : null}
                    </div>
                  ) : (
                    <EmptyState title={t("Selecciona una corrida", "Select a payment run")} description={t("Elige una corrida de tesorería para abrir su control operativo.", "Choose a treasury run to open its operating control.")} />
                  )}
                </Card>

                <Card title={t("Bandeja de corridas", "Run queue")} description={t("Cambia de lote rápido y vuelve al control sin perder filtros.", "Switch batches quickly and return to control without losing filters.")}>
                  <FilterBar summary={`${filteredRuns.length} ${t("corridas visibles", "visible runs")}`}>
                    <label className="fieldLabel">
                      {t("Estado", "Status")}
                      <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                        <option value="all">{t("Todos", "All")}</option>
                        <option value="draft">{t("Borrador", "Draft")}</option>
                        <option value="ready">{t("Lista", "Ready")}</option>
                        <option value="blocked">{t("Bloqueada", "Blocked")}</option>
                        <option value="executed">{t("Ejecutada", "Executed")}</option>
                      </select>
                    </label>
                    <label className="fieldLabel" style={{ minWidth: 220 }}>
                      {t("Buscar", "Search")}
                      <input
                        className="field"
                        type="search"
                        value={searchFilter}
                        onChange={(event) => setSearchFilter(event.target.value)}
                        placeholder={t("Corrida, cuenta, responsable o siguiente acción", "Run, account, owner or next action")}
                      />
                    </label>
                    <Badge tone={filteredSummary.blockedRuns > 0 ? "danger" : filteredSummary.readyRuns > 0 ? "warning" : "success"}>
                      {filteredSummary.blockedRuns > 0
                        ? `${filteredSummary.blockedRuns} ${t("bloqueadas", "blocked")}`
                        : filteredSummary.readyRuns > 0
                          ? `${filteredSummary.readyRuns} ${t("listas", "ready")}`
                          : t("subset visible controlado", "visible subset controlled")}
                    </Badge>
                  </FilterBar>
                  {filteredRuns.length > 0 ? (
                    <div className="stack">
                      {filteredRuns.map((row) => {
                        const isSelected = row.id === selectedRun?.id;

                        return (
                          <button
                            key={row.id}
                            className={`listItem ${isSelected ? "listItemSelected" : ""}`}
                            type="button"
                            onClick={() => {
                              setSelectedId(row.id);
                              setWorkspaceView("workbench");
                            }}
                            style={{ width: "100%", alignItems: "stretch", justifyContent: "flex-start", padding: 16, textAlign: "left" }}
                          >
                            <div className="stack" style={{ width: "100%", gap: 12 }}>
                              <div className="row gap wrap" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div className="tableCellStack" style={{ alignItems: "flex-start" }}>
                                  <strong>{row.code}</strong>
                                  <span className="tableCellMuted">{row.bankAccountLabel}</span>
                                </div>
                                <Badge tone={tone(row.status)}>{localizeText(paymentRunStatusLabel(row.status))}</Badge>
                              </div>
                              <div className="row gap wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
                                <span className="tableCellMuted">{t("Fecha", "Date")}: {row.scheduledDate}</span>
                                <strong>{`MXN ${row.totalAmount.toLocaleString()}`}</strong>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState
                      title={t("Sin corridas visibles", "No visible runs")}
                      description={t(
                        "Ajusta los filtros para recuperar corridas en la bandeja principal.",
                        "Adjust filters to bring runs back into the primary queue."
                      )}
                    />
                  )}
                </Card>
              </section>
            ) : null}

            {workspaceView === "queue" ? (
              <section className="grid cols2" lang={uiLanguage}>
                <Card title={t("Cola completa de corridas", "Full run queue")} description={t("Usa esta vista cuando necesites explorar la bandeja completa antes de volver al control.", "Use this view when you need the full queue before returning to control.")}>
                  <FilterBar summary={`${filteredRuns.length} ${t("corridas coinciden con los filtros", "runs match current filters")}`}>
                    <label className="fieldLabel">
                      {t("Estado", "Status")}
                      <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                        <option value="all">{t("Todos", "All")}</option>
                        <option value="draft">{t("Borrador", "Draft")}</option>
                        <option value="ready">{t("Lista", "Ready")}</option>
                        <option value="blocked">{t("Bloqueada", "Blocked")}</option>
                        <option value="executed">{t("Ejecutada", "Executed")}</option>
                      </select>
                    </label>
                    <label className="fieldLabel" style={{ minWidth: 220 }}>
                      {t("Buscar", "Search")}
                      <input
                        className="field"
                        type="search"
                        value={searchFilter}
                        onChange={(event) => setSearchFilter(event.target.value)}
                        placeholder={t("Corrida, cuenta, responsable o siguiente acción", "Run, account, owner or next action")}
                      />
                    </label>
                  </FilterBar>
                  <DataTable
                    rows={filteredRuns}
                    columns={[
                      {
                        key: "run",
                        label: t("Corrida", "Run"),
                        render: (row) => (
                          <button className="buttonGhost" type="button" onClick={() => setSelectedId(row.id)} style={{ justifyContent: "flex-start", paddingInline: 0 }}>
                            <div className="tableCellStack">
                              <strong>{row.code}</strong>
                              <span className="tableCellMuted">{row.bankAccountLabel}</span>
                            </div>
                          </button>
                        )
                      },
                      { key: "date", label: t("Fecha", "Date"), render: (row) => row.scheduledDate },
                      { key: "amount", label: t("Valor", "Value"), render: (row) => `MXN ${row.totalAmount.toLocaleString()}` },
                      { key: "status", label: t("Estado", "Status"), render: (row) => <Badge tone={tone(row.status)}>{localizeText(paymentRunStatusLabel(row.status))}</Badge> }
                    ]}
                  />
                </Card>
                <Card title={selectedRun?.code ?? t("Selecciona una corrida", "Select a payment run")} description={selectedRun ? `${selectedRun.bankAccountLabel} · ${selectedRun.owner}` : t("Elige una corrida desde la bandeja.", "Choose a run from the queue.")}>
                  {selectedRun ? (
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">{t("Estado", "Status")}</div><div><Badge tone={tone(selectedRun.status)}>{localizeText(paymentRunStatusLabel(selectedRun.status))}</Badge></div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Puerta", "Gate")}</div><div><Badge tone={selectedRunGate.tone}>{selectedRunGateLabel}</Badge></div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Siguiente acción", "Next action")}</div><div>{selectedRun.nextAction}</div></div>
                      <div className="detailRow"><div className="detailLabel">{t("Facturas críticas", "Critical invoices")}</div><div>{selectedRun.criticalInvoices}</div></div>
                    </div>
                  ) : null}
                  {selectedRun ? <div className="row gap wrap" style={{ marginTop: 20 }}><button type="button" className="button" onClick={() => setWorkspaceView("workbench")}>{t("Abrir control", "Open control")}</button></div> : null}
                </Card>
              </section>
            ) : null}

            {workspaceView === "details" ? (
              <section className="stack" id="operational-details">
                <Card
                  title="Operational details"
                  description="Secondary treasury context, run creation and broader risk review."
                  aside={<Badge tone={filteredSummary.blockedRuns > 0 ? "danger" : filteredSummary.readyRuns > 0 ? "warning" : "success"}>{filteredSummary.blockedRuns > 0 ? "blocked" : filteredSummary.readyRuns > 0 ? "ready to release" : "stable"}</Badge>}
                >
                  <div className="detailGrid">
                    <div className="detailRow"><div className="detailLabel">Upstream check</div><div>Validate supplier fiscal packet and invoice evidence before the batch is even assembled.</div></div>
                    <div className="detailRow"><div className="detailLabel">Treasury action</div><div>Group invoices by release lane, move them between runs and avoid executing false-ready batches.</div></div>
                    <div className="detailRow"><div className="detailLabel">Downstream continuity</div><div>Confirm finance and cash-flow impact immediately after the batch is marked ready or executed.</div></div>
                    <div className="detailRow"><div className="detailLabel">Why now</div><div>{localizeText(selectedRunWhyNow)}</div></div>
                    <div className="detailRow"><div className="detailLabel">Downstream effect</div><div>{localizeText(selectedRunDownstreamEffect)}</div></div>
                    <div className="detailRow"><div className="detailLabel">Report back</div><div>{localizeText(selectedRunReportBack)}</div></div>
                  </div>
                  <div className="row gap wrap" style={{ marginTop: 16 }}>
                    <Link className="button" href="/accounts-payable">{t("Abrir cuentas por pagar", "Open accounts payable")}</Link>
                    <Link className="buttonGhost" href="/supplier-master">{t("Abrir catálogo de proveedores", "Open supplier master")}</Link>
                    <Link className="buttonGhost" href="/cash-flow">{t("Abrir flujo de efectivo", "Open cash flow")}</Link>
                  </div>
                </Card>

                <section className="grid cols4">
                  <KpiCard label="Active runs" value={String(filteredSummary.activeRuns)} footnote="Visible treasury batches still in play." />
                  <KpiCard label="Scheduled amount" value={`MXN ${filteredSummary.scheduledAmount.toLocaleString()}`} footnote="Pending disbursement volume across visible open runs." />
                  <KpiCard label="Blocked runs" value={String(filteredSummary.blockedRuns)} footnote="Visible runs held by fiscal or evidence blockers." />
                  <KpiCard label="Ready runs" value={String(filteredSummary.readyRuns)} footnote="Visible runs that can move to execution." />
                  <KpiCard label="Duplicate assignments" value={String(filteredSummary.duplicateAssignments)} footnote="Invoices duplicated across visible active runs must be rebalanced." />
                </section>

                <section className="grid cols2">
                  <Card title="Run composition" description="Invoices in the selected run and all supported rebalance operations.">
                    {selectedRun ? (
                      <div className="detailGrid">
                        <div className="detailRow"><div className="detailLabel">Critical invoices</div><div>{selectedRun.criticalInvoices}</div></div>
                        {selectedRun.status !== "executed" ? (
                          <div className="detailRow">
                            <div className="detailLabel">Add eligible invoice</div>
                            <div className="row gap wrap" style={{ flex: 1 }}>
                              <select className="field" value={selectedEligibleInvoiceId} onChange={(event) => setSelectedEligibleInvoiceId(event.target.value)}>
                                <option value="">Select eligible invoice</option>
                                {eligibleInvoices.map((invoice) => (
                                  <option key={invoice.id} value={invoice.id}>
                                    {invoice.code} · {invoice.supplierName} · MXN {invoice.pendingAmount.toLocaleString()}
                                  </option>
                                ))}
                              </select>
                              <button className="button" type="button" disabled={!selectedEligibleInvoiceId} onClick={() => void handleAddInvoiceToRun()}>
                                Add
                              </button>
                            </div>
                          </div>
                        ) : null}
                        <div className="stack">
                          {selectedRun.invoices.map((invoice) => (
                            <div key={invoice.invoiceId} className="detailRow">
                              <div className="detailLabel">{invoice.invoiceCode}</div>
                              <div className="tableCellStack" style={{ alignItems: "flex-start" }}>
                                <span>{invoice.supplierName} · MXN {invoice.total.toLocaleString()}</span>
                                <span className="tableCellMuted">{invoice.complementStatus} / {invoice.receiptEvidenceStatus}</span>
                              </div>
                              {selectedRun.status !== "executed" ? (
                                <div className="row gap wrap">
                                  <button className="buttonGhost" type="button" onClick={() => void handleRemoveInvoice(invoice.invoiceId)}>
                                    Separate
                                  </button>
                                  {availableTargetRuns.length > 0 ? (
                                    <>
                                      <select
                                        className="field"
                                        value={moveTargets[invoice.invoiceId] ?? ""}
                                        onChange={(event) =>
                                          setMoveTargets((current) => ({ ...current, [invoice.invoiceId]: event.target.value }))
                                        }
                                      >
                                        <option value="">Move to run</option>
                                        {availableTargetRuns.map((run) => (
                                          <option key={run.id} value={run.id}>
                                            {run.code} · MXN {run.totalAmount.toLocaleString()}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        className="button"
                                        type="button"
                                        disabled={!moveTargets[invoice.invoiceId]}
                                        onClick={() => void handleMoveInvoice(invoice.invoiceId)}
                                      >
                                        Move
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <EmptyState title="Select a run" description="Choose a treasury batch to review invoice composition." />
                    )}
                  </Card>

                  <Card title="Run risks" description="Current blockers on the selected payment run.">
                    {selectedRisks.length > 0 ? (
                      <DataTable
                        rows={selectedRisks}
                        columns={[
                          { key: "risk", label: "Risk", render: (row) => row.title },
                          { key: "category", label: "Category", render: (row) => row.category },
                          { key: "severity", label: "Severity", render: (row) => <Badge tone={row.severity === "critical" ? "danger" : row.severity === "warning" ? "warning" : "info"}>{row.severity}</Badge> }
                        ]}
                      />
                    ) : (
                      <EmptyState title="No mapped risks" description="The selected run currently has no explicit treasury risk." />
                    )}
                  </Card>
                </section>

                <section className="grid cols2">
                  <Card title="Create payment run" description="Select payable invoices and create a treasury batch.">
                <div className="detailGrid">
                  <label className="detailRow"><div className="detailLabel">Bank account</div><input className="field" value={form.bankAccountLabel} onChange={(event) => setForm((current) => ({ ...current, bankAccountLabel: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Scheduled date</div><input className="field" type="date" value={form.scheduledDate} onChange={(event) => setForm((current) => ({ ...current, scheduledDate: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Owner</div><input className="field" value={form.owner} onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))} /></label>
                  <label className="detailRow"><div className="detailLabel">Next action</div><input className="field" value={form.nextAction} onChange={(event) => setForm((current) => ({ ...current, nextAction: event.target.value }))} /></label>
                </div>
                <div className="stack" style={{ marginTop: 12 }}>
                  {eligibleInvoices.length > 0 ? (
                    eligibleInvoices.map((invoice) => (
                      <label key={invoice.id} className="detailRow">
                        <div className="detailLabel">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceIds.includes(invoice.id)}
                            onChange={(event) =>
                              setSelectedInvoiceIds((current) =>
                                event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id)
                              )
                            }
                          />
                        </div>
                        <div>{invoice.code} · {invoice.supplierName} · MXN {invoice.pendingAmount.toLocaleString()}</div>
                      </label>
                    ))
                  ) : (
                    <EmptyState
                      title="No eligible invoices"
                      description="All current invoices are either already assigned, paid, fiscally blocked or missing receiving evidence."
                    />
                  )}
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
                    <div className="tableCellStack">
                      <div className="row gap wrap" style={{ alignItems: "center" }}>
                        <Badge tone={createPaymentRunGate.tone}>{localizeText(createPaymentRunGate.label)}</Badge>
                        <span>{localizeText(createPaymentRunGate.summary)}</span>
                      </div>
                      {createPaymentRunGate.checks.map((check) => (
                        <span key={localizeText(check)} className="tableCellMuted">{localizeText(check)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Next human step</div>
                    <div>{localizeText(createPaymentRunHumanStep)}</div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button className="button" type="button" onClick={() => void handleCreate()}>Create Run</button>
                  <button className="buttonGhost" type="button" onClick={() => setForm(createPaymentRunExample())}>Load demo example</button>
                  <button className="buttonGhost" type="button" onClick={() => { setForm(emptyCreateForm); setSelectedInvoiceIds([]); }}>Reset form</button>
                  <Link className="buttonGhost" href="/accounts-payable">{t("Revisar CXP", "Review AP")}</Link>
                  <Link className="buttonGhost" href="/supplier-master">{t("Revisar proveedores", "Review suppliers")}</Link>
                </div>
                  </Card>

                  <Card title="Release rules" description="Treasury should not execute batches with fake readiness.">
                    <div className="detailGrid">
                      <div className="detailRow"><div className="detailLabel">Ready / executed</div><div>Runs cannot advance if any invoice remains critical, risky or with missing receipt evidence.</div></div>
                      <div className="detailRow"><div className="detailLabel">Executed</div><div>A run must first be `ready` before it can be executed.</div></div>
                      <div className="detailRow"><div className="detailLabel">Scope</div><div>The batch is linked directly to payable invoices already living in CXP.</div></div>
                    </div>
                    <div className="stack" style={{ marginTop: 16 }}>
                      {unavailableInvoices.slice(0, 5).map((invoice) => (
                        <div key={invoice.invoiceId} className="detailRow">
                          <div className="detailLabel">
                            <Badge tone={unavailableTone(invoice.reasonCode)}>{invoice.reasonCode}</Badge>
                          </div>
                          <div>
                            {invoice.invoiceCode} · {invoice.supplierName} · {invoice.reasonLabel}
                            {invoice.blockingRunCodes.length > 0 ? ` (${invoice.blockingRunCodes.join(", ")})` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </section>
              </section>
            ) : null}
          </>
        ) : (
          <EmptyState
            title={t("Corridas de pago de tesorería no disponibles", "Treasury payment runs unavailable")}
            description={error ?? t("No pudimos cargar las corridas de pago de tesorería para esta empresa.", "We could not load treasury payment runs for this company.")}
            primaryAction={{ label: t("Ir a cuentas por pagar", "Go to accounts payable"), href: "/accounts-payable" }}
            secondaryAction={{ label: t("Abrir finanzas", "Open finance"), href: "/finance" }}
          />
        )}
      </ModuleGate>
    </AppShell>
  );
}
