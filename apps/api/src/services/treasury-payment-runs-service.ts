import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundCurrency(value: number) {
  return Math.round(value);
}

function buildExecutedInvoiceNote(runCode: string, nextAction: string) {
  const normalizedAction = nextAction.trim();
  return normalizedAction.length > 0
    ? `Pago ejecutado en corrida ${runCode}. ${normalizedAction}`
    : `Pago ejecutado en corrida ${runCode}.`;
}

function buildUnavailableInvoice(input: {
  invoiceId: string;
  invoiceCode: string;
  supplierName: string;
  pendingAmount: number;
  status: "received" | "matched" | "scheduled" | "blocked" | "paid";
  reasonCode: "already_paid" | "already_assigned" | "fiscal_blocked" | "evidence_missing" | "invoice_blocked";
  blockingRunCodes?: string[];
}) {
  const reasonLabelByCode = {
    already_paid: "Already paid",
    already_assigned: "Already assigned to another active run",
    fiscal_blocked: "Fiscal packet or complement still blocked",
    evidence_missing: "Receiving evidence still incomplete",
    invoice_blocked: "Invoice remains blocked in accounts payable"
  } as const;

  return {
    invoiceId: input.invoiceId,
    invoiceCode: input.invoiceCode,
    supplierName: input.supplierName,
    pendingAmount: input.pendingAmount,
    status: input.status,
    reasonCode: input.reasonCode,
    reasonLabel: reasonLabelByCode[input.reasonCode],
    blockingRunCodes: input.blockingRunCodes ?? []
  };
}

function normalizeDateInput(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().slice(0, 10);
}

function isTreasuryEligibleInvoice(invoice: {
  status: "received" | "matched" | "scheduled" | "blocked" | "paid";
  satStatus: "controlled" | "watch" | "critical";
  complementStatus: "pending" | "complete" | "not_required" | "risk";
  receiptEvidenceStatus: "complete" | "partial" | "missing";
}) {
  if (invoice.status === "paid" || invoice.status === "blocked") {
    return false;
  }

  if (invoice.satStatus === "critical" || invoice.complementStatus === "risk") {
    return false;
  }

  if (invoice.receiptEvidenceStatus === "missing") {
    return false;
  }

  return true;
}

function treasuryBlockReason(invoice: {
  status: "received" | "matched" | "scheduled" | "blocked" | "paid";
  satStatus: "controlled" | "watch" | "critical";
  complementStatus: "pending" | "complete" | "not_required" | "risk";
  receiptEvidenceStatus: "complete" | "partial" | "missing";
}) {
  if (invoice.status === "paid") {
    return "already_paid" as const;
  }

  if (invoice.status === "blocked") {
    return "invoice_blocked" as const;
  }

  if (invoice.satStatus === "critical" || invoice.complementStatus === "risk") {
    return "fiscal_blocked" as const;
  }

  return "evidence_missing" as const;
}

export function createTreasuryPaymentRunsService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("TREASURY_PAYMENT_RUNS_COMPANY_NOT_FOUND", "Company not found", { companyId });
      }

      const [runs, risks, payableInvoices] = await Promise.all([
        repository.listTreasuryPaymentRuns(companyId),
        repository.listTreasuryPaymentRunRisks(companyId),
        repository.listAccountsPayableInvoices(companyId)
      ]);

      const activeRunCodesByInvoiceId = new Map<string, string[]>();
      for (const run of runs.filter((candidate) => candidate.status !== "executed")) {
        for (const invoice of run.invoices) {
          const current = activeRunCodesByInvoiceId.get(invoice.invoiceId) ?? [];
          current.push(run.code);
          activeRunCodesByInvoiceId.set(invoice.invoiceId, current);
        }
      }

      const eligibleInvoices = payableInvoices.filter((invoice) => {
        if (activeRunCodesByInvoiceId.has(invoice.id)) {
          return false;
        }
        return isTreasuryEligibleInvoice(invoice);
      });

      const unavailableInvoices = payableInvoices
        .filter((invoice) => !eligibleInvoices.some((candidate) => candidate.id === invoice.id))
        .map((invoice) => {
          if (invoice.status === "paid") {
            return buildUnavailableInvoice({
              invoiceId: invoice.id,
              invoiceCode: invoice.code,
              supplierName: invoice.supplierName,
              pendingAmount: invoice.pendingAmount,
              status: invoice.status,
              reasonCode: "already_paid"
            });
          }

          const blockingRunCodes = activeRunCodesByInvoiceId.get(invoice.id);
          if (blockingRunCodes && blockingRunCodes.length > 0) {
            return buildUnavailableInvoice({
              invoiceId: invoice.id,
              invoiceCode: invoice.code,
              supplierName: invoice.supplierName,
              pendingAmount: invoice.pendingAmount,
              status: invoice.status,
              reasonCode: "already_assigned",
              blockingRunCodes
            });
          }

          if (invoice.status === "blocked") {
            return buildUnavailableInvoice({
              invoiceId: invoice.id,
              invoiceCode: invoice.code,
              supplierName: invoice.supplierName,
              pendingAmount: invoice.pendingAmount,
              status: invoice.status,
              reasonCode: "invoice_blocked"
            });
          }

          if (invoice.satStatus === "critical" || invoice.complementStatus === "risk") {
            return buildUnavailableInvoice({
              invoiceId: invoice.id,
              invoiceCode: invoice.code,
              supplierName: invoice.supplierName,
              pendingAmount: invoice.pendingAmount,
              status: invoice.status,
              reasonCode: "fiscal_blocked"
            });
          }

          return buildUnavailableInvoice({
            invoiceId: invoice.id,
            invoiceCode: invoice.code,
            supplierName: invoice.supplierName,
            pendingAmount: invoice.pendingAmount,
            status: invoice.status,
            reasonCode: "evidence_missing"
          });
        });

      const runById = new Map(runs.map((run) => [run.id, run]));
      const derivedDuplicateRisks = runs.flatMap((run) =>
        run.invoices
          .filter((invoice) => (activeRunCodesByInvoiceId.get(invoice.invoiceId)?.length ?? 0) > 1)
          .map((invoice) => ({
            id: `dup-${run.id}-${invoice.invoiceId}`,
            paymentRunId: run.id,
            title: `${invoice.invoiceCode} is assigned to more than one active treasury run`,
            category: "Duplicate assignment",
            severity: "critical" as const,
            owner: "Treasury lead",
            status: (activeRunCodesByInvoiceId.get(invoice.invoiceId) ?? []).join(", ")
          }))
      );

      const filteredRisks = [
        ...risks.filter((risk) => {
        const run = runById.get(risk.paymentRunId);
        if (!run) {
          return false;
        }

        return run.invoices.some(
          (invoice) =>
            invoice.satStatus === "critical" ||
            invoice.complementStatus === "risk" ||
            invoice.receiptEvidenceStatus === "missing"
        );
      }),
        ...derivedDuplicateRisks
      ];

      const duplicateAssignments = Array.from(activeRunCodesByInvoiceId.values()).filter((runCodes) => runCodes.length > 1).length;

      const focusRun =
        runs
          .slice()
          .sort((left, right) => {
            if (left.status === "blocked" && right.status !== "blocked") {
              return -1;
            }
            if (left.status !== "blocked" && right.status === "blocked") {
              return 1;
            }
            return right.totalAmount - left.totalAmount;
          })[0] ?? null;

      return {
        summary: {
          activeRuns: runs.filter((run) => run.status !== "executed").length,
          scheduledAmount: roundCurrency(runs.filter((run) => run.status !== "executed").reduce((sum, run) => sum + run.totalAmount, 0)),
          blockedRuns: runs.filter((run) => run.status === "blocked").length,
          executedRuns: runs.filter((run) => run.status === "executed").length,
          criticalInvoices: runs.reduce((sum, run) => sum + run.criticalInvoices, 0),
          readyRuns: runs.filter((run) => run.status === "ready").length,
          duplicateAssignments
        },
        runs,
        risks: filteredRisks,
        focusRun,
        eligibleInvoices,
        unavailableInvoices
      };
    },
    async createRun(input: {
      companyId: string;
      bankAccountLabel: string;
      scheduledDate: string;
      owner: string;
      nextAction: string;
      invoiceIds: string[];
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("TREASURY_PAYMENT_RUNS_COMPANY_NOT_FOUND", "Company not found", { companyId: input.companyId });
      }

      const invoices = await repository.listAccountsPayableInvoices(input.companyId);
      const selectedInvoices = invoices.filter((invoice) => input.invoiceIds.includes(invoice.id));
      if (selectedInvoices.length !== input.invoiceIds.length) {
        throw validationError("TREASURY_PAYMENT_RUNS_INVOICE_NOT_FOUND", "One or more selected invoices do not exist", {
          companyId: input.companyId,
          invoiceIds: input.invoiceIds
        });
      }

      if (selectedInvoices.some((invoice) => invoice.status === "paid")) {
        throw validationError("TREASURY_PAYMENT_RUNS_PAID_INVOICE", "Paid invoices cannot be added to a treasury run", {
          invoiceIds: selectedInvoices.filter((invoice) => invoice.status === "paid").map((invoice) => invoice.id)
        });
      }

      const ineligibleInvoice = selectedInvoices.find((invoice) => !isTreasuryEligibleInvoice(invoice));
      if (ineligibleInvoice) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_INVOICE_NOT_ELIGIBLE",
          "One or more invoices are not eligible for treasury assignment",
          {
            invoiceId: ineligibleInvoice.id,
            invoiceCode: ineligibleInvoice.code,
            reasonCode: treasuryBlockReason(ineligibleInvoice)
          }
        );
      }

      const runs = await repository.listTreasuryPaymentRuns(input.companyId);
      const activeRunConflict = runs.find(
        (run) =>
          run.status !== "executed" &&
          run.invoices.some((invoice) => input.invoiceIds.includes(invoice.invoiceId))
      );
      if (activeRunConflict) {
        throw validationError(
          "TREASURY_PAYMENT_RUNS_DUPLICATE_ACTIVE_INVOICE",
          "Invoice already belongs to another active treasury payment run",
          {
            paymentRunId: activeRunConflict.id,
            paymentRunCode: activeRunConflict.code,
            invoiceIds: activeRunConflict.invoices
              .filter((invoice) => input.invoiceIds.includes(invoice.invoiceId))
              .map((invoice) => invoice.invoiceId)
          }
        );
      }

      const created = await repository.createTreasuryPaymentRun(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "treasury_payment_run",
        aggregateId: created.id,
        action: "treasury.payment-run.created",
        metadata: {
          code: created.code,
          totalInvoices: created.totalInvoices,
          totalAmount: created.totalAmount
        }
      });

      return created;
    },
    async updateRun(input: {
      companyId: string;
      paymentRunId: string;
      status: "draft" | "ready" | "blocked" | "executed";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("TREASURY_PAYMENT_RUNS_COMPANY_NOT_FOUND", "Company not found", { companyId: input.companyId });
      }

      const runs = await repository.listTreasuryPaymentRuns(input.companyId);
      const run = runs.find((candidate) => candidate.id === input.paymentRunId);
      if (!run) {
        throw notFound("TREASURY_PAYMENT_RUN_NOT_FOUND", "Treasury payment run not found", {
          companyId: input.companyId,
          paymentRunId: input.paymentRunId
        });
      }

      if (input.status === "ready" || input.status === "executed") {
        const duplicateInvoice = run.invoices.find(
          (invoice) =>
            runs.some(
              (candidate) =>
                candidate.id !== run.id &&
                candidate.status !== "executed" &&
                candidate.invoices.some((linked) => linked.invoiceId === invoice.invoiceId)
            )
        );
        if (duplicateInvoice) {
          throw validationError(
            "TREASURY_PAYMENT_RUN_DUPLICATE_ASSIGNMENT",
            "Payment run cannot advance while one of its invoices is duplicated in another active treasury run",
            {
              paymentRunId: run.id,
              invoiceId: duplicateInvoice.invoiceId,
              invoiceCode: duplicateInvoice.invoiceCode
            }
          );
        }

        const blockingInvoice = run.invoices.find(
          (invoice) =>
            invoice.satStatus === "critical" ||
            invoice.complementStatus === "risk" ||
            invoice.receiptEvidenceStatus === "missing"
        );
        if (blockingInvoice) {
          throw validationError(
            "TREASURY_PAYMENT_RUN_BLOCKED_INVOICE",
            "Payment run cannot advance while one of its invoices is fiscally or operationally blocked",
            {
              paymentRunId: run.id,
              invoiceId: blockingInvoice.invoiceId,
              invoiceCode: blockingInvoice.invoiceCode
            }
          );
        }
      }

      if (input.status === "executed" && run.status !== "ready") {
        throw validationError(
          "TREASURY_PAYMENT_RUN_NOT_READY",
          "Payment run must be ready before it can be executed",
          { paymentRunId: run.id, currentStatus: run.status }
        );
      }

      if (input.status === "executed") {
        const invoices = await repository.listAccountsPayableInvoices(input.companyId);
        const relatedInvoices = invoices.filter((invoice) => run.invoices.some((candidate) => candidate.invoiceId === invoice.id));
        const complementPendingInvoice = relatedInvoices.find(
          (invoice) => !["complete", "not_required"].includes(invoice.complementStatus)
        );
        if (complementPendingInvoice) {
          throw validationError(
            "TREASURY_PAYMENT_RUN_COMPLEMENT_PENDING",
            "Payment run cannot be executed while one of its invoices still requires payment complement completion",
            {
              paymentRunId: run.id,
              invoiceId: complementPendingInvoice.id,
              invoiceCode: complementPendingInvoice.code,
              complementStatus: complementPendingInvoice.complementStatus
            }
          );
        }

        for (const invoice of relatedInvoices) {
          await repository.updateAccountsPayableInvoice({
            invoiceId: invoice.id,
            status: "paid",
            satStatus: invoice.satStatus,
            complementStatus: invoice.complementStatus,
            scheduledPaymentDate: normalizeDateInput(invoice.scheduledPaymentDate ?? run.scheduledDate),
            nextAction: buildExecutedInvoiceNote(run.code, input.nextAction)
          });
        }
      }

      const updated = await repository.updateTreasuryPaymentRun(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "treasury_payment_run",
        aggregateId: updated.id,
        action: "treasury.payment-run.updated",
        metadata: {
          status: updated.status,
          nextAction: updated.nextAction,
          settledInvoices: input.status === "executed" ? updated.totalInvoices : 0,
          settledAmount: input.status === "executed" ? updated.totalAmount : 0
        }
      });

      return updated;
    },
    async removeInvoice(input: {
      companyId: string;
      paymentRunId: string;
      invoiceId: string;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("TREASURY_PAYMENT_RUNS_COMPANY_NOT_FOUND", "Company not found", { companyId: input.companyId });
      }

      const runs = await repository.listTreasuryPaymentRuns(input.companyId);
      const run = runs.find((candidate) => candidate.id === input.paymentRunId);
      if (!run) {
        throw notFound("TREASURY_PAYMENT_RUN_NOT_FOUND", "Treasury payment run not found", {
          companyId: input.companyId,
          paymentRunId: input.paymentRunId
        });
      }

      if (run.status === "executed") {
        throw validationError(
          "TREASURY_PAYMENT_RUN_EXECUTED_LOCKED",
          "Executed payment runs cannot remove invoices",
          { paymentRunId: run.id, status: run.status }
        );
      }

      const linkedInvoice = run.invoices.find((invoice) => invoice.invoiceId === input.invoiceId);
      if (!linkedInvoice) {
        throw notFound("TREASURY_PAYMENT_RUN_INVOICE_NOT_FOUND", "Invoice is not linked to the selected treasury payment run", {
          companyId: input.companyId,
          paymentRunId: input.paymentRunId,
          invoiceId: input.invoiceId
        });
      }

      if (run.invoices.length <= 1) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_LAST_INVOICE",
          "Treasury payment run must keep at least one invoice linked",
          { paymentRunId: run.id, invoiceId: input.invoiceId }
        );
      }

      const updated = await repository.removeTreasuryPaymentRunInvoice(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "treasury_payment_run",
        aggregateId: updated.id,
        action: "treasury.payment-run.invoice-removed",
        metadata: {
          removedInvoiceId: linkedInvoice.invoiceId,
          removedInvoiceCode: linkedInvoice.invoiceCode,
          status: updated.status,
          remainingInvoices: updated.totalInvoices,
          nextAction: updated.nextAction
        }
      });

      return updated;
    },
    async addInvoice(input: {
      companyId: string;
      paymentRunId: string;
      invoiceId: string;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("TREASURY_PAYMENT_RUNS_COMPANY_NOT_FOUND", "Company not found", { companyId: input.companyId });
      }

      const runs = await repository.listTreasuryPaymentRuns(input.companyId);
      const run = runs.find((candidate) => candidate.id === input.paymentRunId);
      if (!run) {
        throw notFound("TREASURY_PAYMENT_RUN_NOT_FOUND", "Treasury payment run not found", {
          companyId: input.companyId,
          paymentRunId: input.paymentRunId
        });
      }

      if (run.status === "executed") {
        throw validationError(
          "TREASURY_PAYMENT_RUN_EXECUTED_LOCKED",
          "Executed payment runs cannot add invoices",
          { paymentRunId: run.id, status: run.status }
        );
      }

      if (run.invoices.some((invoice) => invoice.invoiceId === input.invoiceId)) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_INVOICE_ALREADY_LINKED",
          "Invoice is already linked to the selected treasury payment run",
          { paymentRunId: run.id, invoiceId: input.invoiceId }
        );
      }

      const invoices = await repository.listAccountsPayableInvoices(input.companyId);
      const invoice = invoices.find((candidate) => candidate.id === input.invoiceId);
      if (!invoice) {
        throw notFound("TREASURY_PAYMENT_RUN_INVOICE_NOT_FOUND", "Accounts payable invoice not found", {
          companyId: input.companyId,
          invoiceId: input.invoiceId
        });
      }

      if (invoice.status === "paid") {
        throw validationError("TREASURY_PAYMENT_RUNS_PAID_INVOICE", "Paid invoices cannot be added to a treasury run", {
          invoiceId: invoice.id
        });
      }

      const activeRunConflict = runs.find(
        (candidate) => candidate.status !== "executed" && candidate.invoices.some((linked) => linked.invoiceId === input.invoiceId)
      );
      if (activeRunConflict) {
        throw validationError(
          "TREASURY_PAYMENT_RUNS_DUPLICATE_ACTIVE_INVOICE",
          "Invoice already belongs to another active treasury payment run",
          {
            paymentRunId: activeRunConflict.id,
            paymentRunCode: activeRunConflict.code,
            invoiceId: input.invoiceId
          }
        );
      }

      if (!isTreasuryEligibleInvoice(invoice)) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_INVOICE_NOT_ELIGIBLE",
          "Invoice is not eligible for assignment into an active treasury payment run",
          {
            invoiceId: invoice.id,
            invoiceCode: invoice.code,
            reasonCode: treasuryBlockReason(invoice)
          }
        );
      }

      const updated = await repository.addTreasuryPaymentRunInvoice(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "treasury_payment_run",
        aggregateId: updated.id,
        action: "treasury.payment-run.invoice-added",
        metadata: {
          addedInvoiceId: invoice.id,
          addedInvoiceCode: invoice.code,
          status: updated.status,
          totalInvoices: updated.totalInvoices,
          totalAmount: updated.totalAmount,
          nextAction: updated.nextAction
        }
      });

      return updated;
    },
    async moveInvoice(input: {
      companyId: string;
      sourcePaymentRunId: string;
      targetPaymentRunId: string;
      invoiceId: string;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("TREASURY_PAYMENT_RUNS_COMPANY_NOT_FOUND", "Company not found", { companyId: input.companyId });
      }

      if (input.sourcePaymentRunId === input.targetPaymentRunId) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_SAME_TARGET",
          "Source and target treasury payment runs must be different",
          {
            sourcePaymentRunId: input.sourcePaymentRunId,
            targetPaymentRunId: input.targetPaymentRunId
          }
        );
      }

      const runs = await repository.listTreasuryPaymentRuns(input.companyId);
      const sourceRun = runs.find((candidate) => candidate.id === input.sourcePaymentRunId);
      const targetRun = runs.find((candidate) => candidate.id === input.targetPaymentRunId);
      if (!sourceRun || !targetRun) {
        throw notFound("TREASURY_PAYMENT_RUN_NOT_FOUND", "Treasury payment run not found", {
          companyId: input.companyId,
          sourcePaymentRunId: input.sourcePaymentRunId,
          targetPaymentRunId: input.targetPaymentRunId
        });
      }

      if (sourceRun.status === "executed" || targetRun.status === "executed") {
        throw validationError(
          "TREASURY_PAYMENT_RUN_EXECUTED_LOCKED",
          "Executed payment runs cannot move invoices",
          {
            sourceStatus: sourceRun.status,
            targetStatus: targetRun.status
          }
        );
      }

      const linkedInvoice = sourceRun.invoices.find((invoice) => invoice.invoiceId === input.invoiceId);
      if (!linkedInvoice) {
        throw notFound("TREASURY_PAYMENT_RUN_INVOICE_NOT_FOUND", "Invoice is not linked to the source treasury payment run", {
          companyId: input.companyId,
          sourcePaymentRunId: input.sourcePaymentRunId,
          invoiceId: input.invoiceId
        });
      }

      if (sourceRun.invoices.length <= 1) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_LAST_INVOICE",
          "Source treasury payment run must keep at least one invoice linked",
          { paymentRunId: sourceRun.id, invoiceId: input.invoiceId }
        );
      }

      if (targetRun.invoices.some((invoice) => invoice.invoiceId === input.invoiceId)) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_INVOICE_ALREADY_LINKED",
          "Invoice is already linked to the target treasury payment run",
          {
            targetPaymentRunId: targetRun.id,
            invoiceId: input.invoiceId
          }
        );
      }

      const invoices = await repository.listAccountsPayableInvoices(input.companyId);
      const sourceInvoice = invoices.find((invoice) => invoice.id === input.invoiceId);
      if (!sourceInvoice) {
        throw notFound("TREASURY_PAYMENT_RUN_INVOICE_NOT_FOUND", "Accounts payable invoice not found", {
          companyId: input.companyId,
          invoiceId: input.invoiceId
        });
      }

      if (!isTreasuryEligibleInvoice(sourceInvoice)) {
        throw validationError(
          "TREASURY_PAYMENT_RUN_INVOICE_NOT_ELIGIBLE",
          "Invoice is not eligible for move into another active treasury payment run",
          {
            invoiceId: sourceInvoice.id,
            invoiceCode: sourceInvoice.code,
            reasonCode: treasuryBlockReason(sourceInvoice)
          }
        );
      }

      const updated = await repository.moveTreasuryPaymentRunInvoice(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "treasury_payment_run",
        aggregateId: updated.id,
        action: "treasury.payment-run.invoice-moved",
        metadata: {
          movedInvoiceId: linkedInvoice.invoiceId,
          movedInvoiceCode: linkedInvoice.invoiceCode,
          sourcePaymentRunId: sourceRun.id,
          sourcePaymentRunCode: sourceRun.code,
          targetPaymentRunId: targetRun.id,
          targetPaymentRunCode: targetRun.code,
          nextAction: input.nextAction
        }
      });

      return updated;
    }
  };
}
