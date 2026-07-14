import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

function isSupplierReadyForPayment(profile: {
  complianceStatus: "complete" | "watch" | "blocked";
  satStatus: "controlled" | "watch" | "critical";
}) {
  return profile.complianceStatus === "complete" && profile.satStatus === "controlled";
}

export function createAccountsPayableService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("ACCOUNTS_PAYABLE_COMPANY_NOT_FOUND", "Company not found", { companyId });
      }

      const [invoices, risks] = await Promise.all([
        repository.listAccountsPayableInvoices(companyId),
        repository.listAccountsPayableRisks(companyId)
      ]);

      const now = Date.now();
      const openInvoices = invoices.filter((item) => item.status !== "paid");
      const focusInvoice =
        openInvoices
          .slice()
          .sort((left, right) => {
            if (left.status === "blocked" && right.status !== "blocked") {
              return -1;
            }
            if (left.status !== "blocked" && right.status === "blocked") {
              return 1;
            }
            if (left.satStatus === "critical" && right.satStatus !== "critical") {
              return -1;
            }
            if (left.satStatus !== "critical" && right.satStatus === "critical") {
              return 1;
            }
            return right.pendingAmount - left.pendingAmount;
          })[0] ?? null;

      return {
        summary: {
          trackedInvoices: invoices.length,
          openAmount: roundMetric(openInvoices.reduce((sum, item) => sum + item.pendingAmount, 0)),
          scheduledAmount: roundMetric(
            invoices
              .filter((item) => item.status === "scheduled")
              .reduce((sum, item) => sum + item.pendingAmount, 0)
          ),
          blockedInvoices: invoices.filter((item) => item.status === "blocked").length,
          criticalInvoices: invoices.filter((item) => item.satStatus === "critical" || item.complementStatus === "risk").length,
          overdueInvoices: invoices.filter((item) => item.status !== "paid" && Date.parse(item.dueDate) < now).length
        },
        invoices,
        risks,
        focusInvoice
      };
    },
    async createInvoice(input: {
      companyId: string;
      supplierProfileId?: string | null;
      supplierName: string;
      invoiceNumber: string;
      invoiceUuid: string;
      projectName: string;
      purchaseOrderCode?: string | null;
      receiptCode?: string | null;
      status: "received" | "matched" | "scheduled" | "blocked" | "paid";
      satStatus: "controlled" | "watch" | "critical";
      complementStatus: "pending" | "complete" | "not_required" | "risk";
      receiptEvidenceStatus: "complete" | "partial" | "missing";
      paymentMethod: string;
      dueDate: string;
      scheduledPaymentDate?: string | null;
      subtotal: number;
      tax: number;
      total: number;
      packetCompletion: number;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("ACCOUNTS_PAYABLE_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const invoices = await repository.listAccountsPayableInvoices(input.companyId);
      const normalizedUuid = input.invoiceUuid.trim().toUpperCase();
      const normalizedNumber = input.invoiceNumber.trim().toUpperCase();
      const duplicate = invoices.find(
        (item) =>
          item.invoiceUuid.trim().toUpperCase() === normalizedUuid ||
          (item.invoiceNumber.trim().toUpperCase() === normalizedNumber &&
            item.supplierName.trim().toLowerCase() === input.supplierName.trim().toLowerCase())
      );
      if (duplicate) {
        throw validationError("ACCOUNTS_PAYABLE_DUPLICATE_INVOICE", "Invoice UUID or supplier invoice number already exists", {
          companyId: input.companyId,
          invoiceUuid: normalizedUuid,
          invoiceNumber: normalizedNumber
        });
      }

      const supplierProfiles = await repository.listSupplierMasterProfiles(input.companyId);
      const matchedSupplierProfile =
        supplierProfiles.find((profile) => profile.id === input.supplierProfileId) ??
        supplierProfiles.find(
          (profile) => profile.supplierName.trim().toLowerCase() === input.supplierName.trim().toLowerCase()
        ) ??
        null;

      if (input.supplierProfileId && !matchedSupplierProfile) {
        throw validationError(
          "ACCOUNTS_PAYABLE_SUPPLIER_PROFILE_NOT_FOUND",
          "Supplier fiscal profile was not found for this invoice",
          {
            companyId: input.companyId,
            supplierProfileId: input.supplierProfileId
          }
        );
      }

      if (
        matchedSupplierProfile &&
        (matchedSupplierProfile.complianceStatus === "blocked" || matchedSupplierProfile.satStatus === "critical")
      ) {
        throw validationError(
          "ACCOUNTS_PAYABLE_SUPPLIER_BLOCKED",
          "Invoice cannot be registered while the supplier fiscal profile is blocked",
          {
            supplierProfileId: matchedSupplierProfile.id,
            complianceStatus: matchedSupplierProfile.complianceStatus,
            satStatus: matchedSupplierProfile.satStatus
          }
        );
      }

      if (
        ["scheduled", "paid"].includes(input.status) &&
        (!matchedSupplierProfile ||
          matchedSupplierProfile.complianceStatus !== "complete" ||
          matchedSupplierProfile.satStatus !== "controlled")
      ) {
        throw validationError(
          "ACCOUNTS_PAYABLE_SUPPLIER_NOT_READY_FOR_PAYMENT",
          "Scheduled or paid invoices require a complete and controlled supplier fiscal profile",
          {
            supplierProfileId: matchedSupplierProfile?.id ?? null,
            supplierName: input.supplierName
          }
        );
      }

      this.validateInvoiceState(input);

      const created = await repository.createAccountsPayableInvoice({
        ...input,
        supplierProfileId: matchedSupplierProfile?.id ?? input.supplierProfileId ?? null,
        supplierName: matchedSupplierProfile?.supplierName ?? input.supplierName,
        invoiceNumber: normalizedNumber,
        invoiceUuid: normalizedUuid
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "accounts_payable_invoice",
        aggregateId: created.id,
        action: "accounts-payable.invoice.created",
        metadata: {
          code: created.code,
          status: created.status,
          satStatus: created.satStatus
        }
      });

      return created;
    },
    async updateInvoice(input: {
      companyId: string;
      invoiceId: string;
      status: "received" | "matched" | "scheduled" | "blocked" | "paid";
      satStatus: "controlled" | "watch" | "critical";
      complementStatus: "pending" | "complete" | "not_required" | "risk";
      scheduledPaymentDate: string | null;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("ACCOUNTS_PAYABLE_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const invoices = await repository.listAccountsPayableInvoices(input.companyId);
      const invoice = invoices.find((candidate) => candidate.id === input.invoiceId);
      if (!invoice) {
        throw notFound("ACCOUNTS_PAYABLE_INVOICE_NOT_FOUND", "Accounts payable invoice not found", {
          companyId: input.companyId,
          invoiceId: input.invoiceId
        });
      }

      const supplierProfiles = await repository.listSupplierMasterProfiles(input.companyId);
      const matchedSupplierProfile =
        supplierProfiles.find((profile) => profile.id === invoice.supplierProfileId) ??
        supplierProfiles.find(
          (profile) => profile.supplierName.trim().toLowerCase() === invoice.supplierName.trim().toLowerCase()
        ) ??
        null;

      if (
        ["scheduled", "paid"].includes(input.status) &&
        (!matchedSupplierProfile || !isSupplierReadyForPayment(matchedSupplierProfile))
      ) {
        throw validationError(
          "ACCOUNTS_PAYABLE_SUPPLIER_NOT_READY_FOR_PAYMENT",
          "Scheduled or paid invoices require a complete and controlled supplier fiscal profile",
          {
            supplierProfileId: matchedSupplierProfile?.id ?? invoice.supplierProfileId ?? null,
            supplierName: invoice.supplierName
          }
        );
      }

      this.validateInvoiceState({
        ...invoice,
        ...input,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        packetCompletion: invoice.packetCompletion,
        receiptEvidenceStatus: invoice.receiptEvidenceStatus
      });

      const updated = await repository.updateAccountsPayableInvoice(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "accounts_payable_invoice",
        aggregateId: updated.id,
        action: "accounts-payable.invoice.updated",
        metadata: {
          status: updated.status,
          satStatus: updated.satStatus,
          complementStatus: updated.complementStatus
        }
      });

      return updated;
    },
    validateInvoiceState(input: {
      status: "received" | "matched" | "scheduled" | "blocked" | "paid";
      satStatus: "controlled" | "watch" | "critical";
      complementStatus: "pending" | "complete" | "not_required" | "risk";
      scheduledPaymentDate?: string | null;
      packetCompletion: number;
      receiptEvidenceStatus: "complete" | "partial" | "missing";
      subtotal: number;
      tax: number;
      total: number;
    }) {
      const expectedTotal = roundMetric(input.subtotal + input.tax);
      if (Math.abs(expectedTotal - input.total) > 0.01) {
        throw validationError("ACCOUNTS_PAYABLE_TOTAL_MISMATCH", "Invoice total must equal subtotal plus tax", {
          expectedTotal,
          total: input.total
        });
      }

      if (input.satStatus === "controlled" && input.packetCompletion < 100) {
        throw validationError(
          "ACCOUNTS_PAYABLE_PACKET_INCOMPLETE",
          "Controlled SAT status requires a complete fiscal packet",
          { packetCompletion: input.packetCompletion }
        );
      }

      if ((input.status === "scheduled" || input.status === "paid") && !input.scheduledPaymentDate) {
        throw validationError(
          "ACCOUNTS_PAYABLE_PAYMENT_DATE_REQUIRED",
          "Scheduled or paid invoices require a scheduled payment date",
          { status: input.status }
        );
      }

      if ((input.status === "scheduled" || input.status === "paid") && input.receiptEvidenceStatus === "missing") {
        throw validationError(
          "ACCOUNTS_PAYABLE_RECEIPT_EVIDENCE_MISSING",
          "Invoices cannot be scheduled or paid while receipt evidence is missing",
          { status: input.status, receiptEvidenceStatus: input.receiptEvidenceStatus }
        );
      }

      if (input.status === "paid" && !["complete", "not_required"].includes(input.complementStatus)) {
        throw validationError(
          "ACCOUNTS_PAYABLE_COMPLEMENT_PENDING",
          "Paid invoices require a complete or not-required complement status",
          { complementStatus: input.complementStatus }
        );
      }
    }
  };
}
