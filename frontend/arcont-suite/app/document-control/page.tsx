"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

function buildDocumentBridge(item: DocumentControlItemContract | null, bridge: DocumentBridgeContext) {
  if (!item) {
    return null;
  }

  const relatedCompliance =
    bridge?.compliance.cases.find(
      (candidate) =>
        candidate.subject.includes(item.projectName) ||
        candidate.unitOrContract.includes(item.projectName) ||
        item.subject.includes(candidate.queueName)
    ) ??
    bridge?.compliance.focusCase ??
    null;
  const relatedPostSale =
    bridge?.postSale.items.find((candidate) => candidate.projectName === item.projectName) ?? bridge?.postSale.focusItem ?? null;

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
    return "Document type, subject, project and owner must be specific before creating the item.";
  }

  if ([input.revisionCount, input.turnaroundDays, input.openComments].some((value) => !Number.isFinite(value) || value < 0)) {
    return "Revisions, turnaround days and open comments must be zero or greater.";
  }

  if (input.nextAction.trim().length < 8) {
    return "Next action must be more specific before creating the item.";
  }

  if (input.status === "approved") {
    return "Document items cannot start as approved.";
  }

  if (input.openComments > 0 && input.health === "healthy") {
    return "Healthy status is blocked while open comments remain active.";
  }

  if (input.status === "awaiting_response" && input.openComments === 0) {
    return "Awaiting response requires at least one open comment.";
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

function buildDocumentOperationalLinks(item: DocumentControlItemContract | null) {
  if (!item) {
    return [
      { label: "Open quality", href: "/quality" },
      { label: "Open compliance", href: "/compliance" },
      { label: "Open projects", href: "/projects" }
    ];
  }

  if (item.status === "blocked" || item.health === "critical") {
    return [
      { label: "Open quality", href: "/quality" },
      { label: "Open projects", href: "/projects" },
      { label: "Open compliance", href: "/compliance" }
    ];
  }

  if (item.openComments > 0 || item.status === "awaiting_response") {
    return [
      { label: "Open compliance", href: "/compliance" },
      { label: "Open quality", href: "/quality" },
      { label: "Open post-sale", href: "/post-sale" }
    ];
  }

  return [
    { label: "Open compliance", href: "/compliance" },
    { label: "Open post-sale", href: "/post-sale" },
    { label: "Open projects", href: "/projects" }
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
  const { activeCompany, apiBaseUrl, session, source } = useAppState();
  const isDemoMode = !session.authenticated || source === "mock" || !session.accessToken;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const documentOperationalLinks = useMemo(() => buildDocumentOperationalLinks(selectedItem), [selectedItem]);
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
      setActionError("Next action must be more specific before updating the item.");
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
      setActionError(response.error?.message ?? "Document item update failed.");
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
    setActionMessage(`Item moved to ${response.data.status}.`);
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
      setActionError(response.error?.message ?? "Document-control item creation failed.");
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
    setCreateMessage(`${created.code} added to document control.`);
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
      title="Document control and RFI"
      eyebrow="Project coordination"
      description="Versions, RFIs, submittals and approvals tied to live field coordination and document traceability."
    >
      <ModuleGate moduleKeys={["projects.control"]} requiredPermissions={["projects:*"]} title="Document Control">
        {overview ? (
          <>
            <section className="grid cols4">
              <KpiCard
                label="Open RFIs"
                value={String(filteredSummary.openRfis)}
                footnote="RFIs still awaiting resolution or formal response."
              />
              <KpiCard
                label="Active submittals"
                value={String(filteredSummary.activeSubmittals)}
                footnote="Technical submittals currently moving through review."
              />
              <KpiCard
                label="Controlled versions"
                value={String(filteredSummary.controlledVersions)}
                footnote="Revision count representing active document control flow."
              />
              <KpiCard
                label="Turnaround"
                value={`${filteredSummary.averageTurnaroundDays} d`}
                footnote="Average current response time across document-control items."
              />
            </section>

            {isDemoMode ? (
              <Card
                title="Operable demo mode"
                description="Document-control items can be created and moved locally so coordination walkthroughs no longer depend on production auth."
                aside={<Badge tone="warning">browser-persisted</Badge>}
              >
                <div className="detailGrid">
                  <div className="detailRow">
                    <div className="detailLabel">What works</div>
                    <div>Create RFIs or submittals, move them through review states, and validate comment-driven coordination behavior.</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Recommended test</div>
                    <div>Create a new RFI for an active project, send it to review, then inspect its impact from Dashboard or Operations.</div>
                  </div>
                </div>
              </Card>
            ) : null}

            <section className="grid cols1">
              <Card
                title="Technical coordination workflow"
                description="This route should already let a coordinator raise, review and route a technical document issue into the right downstream lane."
              >
                <p className="sectionText">
                  Create an RFI or submittal, move it through review and response states, then continue into `projects`,
                  `quality`, `compliance` or `post-sale` depending on whether the unresolved issue is delaying execution,
                  release or handover.
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Document board" description="Live RFIs, submittals, transmittals and meeting-note control.">
                <FilterBar summary={`${filteredItems.length} document-control items match the current operating filters`}>
                  <Badge tone={isDemoMode ? "warning" : "success"}>
                    {isDemoMode ? "demo operable" : "live backend"}
                  </Badge>
                  <Badge tone={isLoading ? "info" : "gold"}>{isLoading ? "refreshing" : "docs ready"}</Badge>
                  <select className="selectField" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                    <option value="all">All projects</option>
                    {projectOptions.map((project) => (
                      <option key={project} value={project}>
                        {project}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value)}>
                    <option value="all">All types</option>
                    {documentTypeOptions.map((documentType) => (
                      <option key={documentType} value={documentType}>
                        {documentType}
                      </option>
                    ))}
                  </select>
                  <select className="selectField" value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                    <option value="all">All health</option>
                    <option value="critical">Critical</option>
                    <option value="watch">Watch</option>
                    <option value="healthy">Healthy</option>
                  </select>
                  <input
                    className="field"
                    type="search"
                    value={searchFilter}
                    onChange={(event) => setSearchFilter(event.target.value)}
                    placeholder="Subject, code, owner or next action"
                    style={{ minWidth: 220 }}
                  />
                  <Badge tone={filteredItems.some((item) => item.health === "critical") ? "danger" : filteredItems.some((item) => item.health === "watch") ? "warning" : "success"}>
                    {filteredItems.some((item) => item.health === "critical")
                      ? "critical items visible"
                      : filteredItems.some((item) => item.health === "watch")
                        ? "watch items visible"
                        : "visible subset controlled"}
                  </Badge>
                </FilterBar>
                <DataTable
                  rows={filteredItems}
                  columns={[
                    {
                      key: "item",
                      label: "Item",
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
                      label: "Project",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.projectName}</strong>
                          <span className="tableCellMuted">{row.owner}</span>
                        </div>
                      )
                    },
                    {
                      key: "flow",
                      label: "Flow",
                      render: (row) => (
                        <div className="tableCellStack">
                          <strong>{row.revisionCount} revisions</strong>
                          <span className="tableCellMuted">{row.openComments} comments</span>
                        </div>
                      )
                    },
                    {
                      key: "health",
                      label: "Health",
                      render: (row) => <Badge tone={healthTone(row.health)}>{row.health}</Badge>
                    }
                  ]}
                />
              </Card>

              <Card
                title="Selected item"
                description="Focused traceability for the active RFI, submittal or controlled issue."
                aside={selectedItem ? <Badge tone={healthTone(selectedItem.health)}>{selectedItem.health}</Badge> : null}
              >
                {selectedItem ? (
                  <div className="detailGrid">
                    <div className="detailRow">
                      <div className="detailLabel">Project</div>
                      <div>{selectedItem.projectName}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Status</div>
                      <div>{selectedItem.status}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Turnaround</div>
                      <div>{selectedItem.turnaroundDays} days</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Open comments</div>
                      <div>{selectedItem.openComments}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Continuity gate</div>
                      <div className="tableCellStack">
                        <Badge tone={documentContinuityGate.tone}>{documentContinuityGate.label}</Badge>
                        <span className="tableCellMuted">{documentContinuityGate.summary}</span>
                        {documentContinuityGate.checks.map((check) => (
                          <span key={check} className="tableCellMuted">{check}</span>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next human step</div>
                      <div>{documentHumanStep}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Why now</div>
                      <div>{documentWhyNow}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Downstream effect</div>
                      <div>{documentDownstreamEffect}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Route summary</div>
                      <div>{documentRouteSummary}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Report back</div>
                      <div>{documentReportBack}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Next action</div>
                      <div>
                        <input
                          className="field"
                          value={nextActionDraft}
                          onChange={(event) => setNextActionDraft(event.target.value)}
                          placeholder="Describe the next coordination or response action"
                        />
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Updated</div>
                      <div>{new Date(selectedItem.updatedAt).toLocaleString()}</div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Business rules</div>
                      <div className="tableCellStack">
                        <span className="tableCellMuted">Approval requires zero open comments.</span>
                        <span className="tableCellMuted">Approval is blocked if turnaround exceeds 10 days without revalidation.</span>
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Operational links</div>
                      <div className="row gap wrap">
                        {documentOperationalLinks.map((link, index) => (
                          <Link key={link.href + link.label} className={index === 0 ? "button secondary" : "buttonGhost"} href={link.href}>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="detailRow">
                      <div className="detailLabel">Actions</div>
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
                              {isSaving ? "Saving..." : option.label}
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
                    title="No document-control item selected"
                    description="Choose an item to inspect the current coordination trace and blockers."
                    primaryAction={{ label: "Stay on document control", href: "/document-control" }}
                  />
                )}
              </Card>
            </section>

            <section className="grid cols3">
              <Card title="Coordination signal" description="Why the selected document still matters operationally.">
                <p className="sectionText">
                  {selectedStory?.coordinationSignal ?? "Choose an item to inspect coordination signal."}
                </p>
              </Card>
              <Card title="Compliance dependency" description="Folder or evidence posture still tied to this document.">
                <p className="sectionText">
                  {selectedStory?.complianceSignal ?? "Choose an item to inspect compliance dependency."}
                </p>
              </Card>
              <Card title="Delivery impact" description="Customer handover or warranty implication of the selected document.">
                <p className="sectionText">
                  {selectedStory?.deliverySignal ?? "Choose an item to inspect delivery impact."}
                </p>
              </Card>
            </section>

            <section className="grid cols2">
              <Card title="Register document item" description="Create a live RFI, submittal or controlled issue directly in the tenant backend.">
                <div className="row gap wrap" style={{ marginBottom: 16 }}>
                  <button type="button" className="buttonGhost" onClick={() => setCreateForm(createDocumentExample())}>
                    Load demo example
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
                    Reset form
                  </button>
                  <Link className="buttonGhost" href="/projects">Open projects</Link>
                  <Link className="buttonGhost" href="/quality">Open quality</Link>
                </div>
                <div className="detailGrid">
                  <label className="detailRow">
                    <div className="detailLabel">Type</div>
                    <input className="field" value={createForm.documentType} onChange={(event) => setCreateForm((current) => ({ ...current, documentType: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Subject</div>
                    <input className="field" value={createForm.subject} onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Project</div>
                    <input className="field" value={createForm.projectName} onChange={(event) => setCreateForm((current) => ({ ...current, projectName: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Owner</div>
                    <input className="field" value={createForm.owner} onChange={(event) => setCreateForm((current) => ({ ...current, owner: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Status</div>
                    <select className="selectField" value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as DocumentControlItemContract["status"] }))}>
                      <option value="issued">issued</option>
                      <option value="in_review">in_review</option>
                      <option value="awaiting_response">awaiting_response</option>
                      <option value="blocked">blocked</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Health</div>
                    <select className="selectField" value={createForm.health} onChange={(event) => setCreateForm((current) => ({ ...current, health: event.target.value as DocumentControlItemContract["health"] }))}>
                      <option value="healthy">healthy</option>
                      <option value="watch">watch</option>
                      <option value="critical">critical</option>
                    </select>
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Revisions</div>
                    <input className="field" type="number" min="0" value={createForm.revisionCount} onChange={(event) => setCreateForm((current) => ({ ...current, revisionCount: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Turnaround days</div>
                    <input className="field" type="number" min="0" value={createForm.turnaroundDays} onChange={(event) => setCreateForm((current) => ({ ...current, turnaroundDays: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Open comments</div>
                    <input className="field" type="number" min="0" value={createForm.openComments} onChange={(event) => setCreateForm((current) => ({ ...current, openComments: event.target.value }))} />
                  </label>
                  <label className="detailRow">
                    <div className="detailLabel">Next action</div>
                    <input className="field" value={createForm.nextAction} onChange={(event) => setCreateForm((current) => ({ ...current, nextAction: event.target.value }))} placeholder="Describe the next coordination or response action" />
                  </label>
                </div>
                <div className="detailGrid" style={{ marginTop: 16 }}>
                  <div className="detailRow">
                    <div className="detailLabel">Creation gate</div>
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
                    <div className="detailLabel">Next human step</div>
                    <div>{createDocumentHumanStep}</div>
                  </div>
                  <div className="detailRow">
                    <div className="detailLabel">Immediate downstream</div>
                    <div>
                      {createForm.status === "blocked"
                        ? "This item should go back into technical coordination before any downstream team assumes continuity."
                        : createForm.status === "awaiting_response"
                          ? "This item should continue into the response owner path, not stay parked in document control."
                          : createForm.health === "critical" || Number(createForm.openComments) > 0
                            ? "This item should continue into projects, quality or compliance with explicit comment ownership."
                            : "This item can continue into the next coordination lane with a clean enough technical story."}
                    </div>
                  </div>
                </div>
                <div className="row gap wrap" style={{ marginTop: 16 }}>
                  <button type="button" className="button" disabled={isCreating} onClick={() => void handleCreateItem()}>
                    {isCreating ? "Saving..." : "Add document item"}
                  </button>
                  {createMessage ? <Badge tone="success">{createMessage}</Badge> : null}
                </div>
              </Card>

              <Card title="Document risks and blockers" description="Coordination, versioning and response issues affecting active work.">
                <div className="detailGrid">
                  <div className="detailRow"><div className="detailLabel">Capture gate</div><div>Items cannot start approved, and `awaiting_response` requires live comments.</div></div>
                  <div className="detailRow"><div className="detailLabel">Healthy gate</div><div>Healthy posture is blocked while comments or review debt remain open.</div></div>
                  <div className="detailRow"><div className="detailLabel">Cross-domain flow</div><div>Use this lane when quality release, compliance folders or customer handover still depend on missing controlled documents.</div></div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <DataTable
                    rows={selectedRisks.length > 0 ? selectedRisks : filteredRisks}
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
                </div>
              </Card>
            </section>
          </>
        ) : error ? (
          <EmptyState
            title="Document control overview unavailable"
            description={error}
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
            secondaryAction={{ label: "Open projects", href: "/projects" }}
          />
        ) : (
          <EmptyState
            title={isLoading ? "Loading document control overview" : "Document control overview not loaded yet"}
            description={
              isDemoMode
                ? "This route should load demo or live document-control signals so technical coordination can be tested end to end."
                : "This route is still waiting for enough document-control signals for the active tenant."
            }
            primaryAction={{ label: "Go to dashboard", href: "/dashboard" }}
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
