import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "draft" | "submitted" | "approved" | "sourcing" | "blocked",
  Array<"draft" | "submitted" | "approved" | "sourcing" | "blocked">
> = {
  draft: ["submitted", "blocked"],
  submitted: ["approved", "blocked"],
  approved: ["sourcing", "blocked"],
  sourcing: [],
  blocked: ["submitted", "approved"]
};

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

export function createProcurementRequisitionsService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("PROCUREMENT_REQUISITIONS_COMPANY_NOT_FOUND", "Company not found", { companyId });
      }

      const [requisitions, risks] = await Promise.all([
        repository.listProcurementRequisitions(companyId),
        repository.listProcurementRequisitionRisks(companyId)
      ]);
      const fieldMaterialRequests = await repository.listFieldMaterialRequests(companyId);

      const openRequisitions = requisitions.filter((item) => item.status !== "sourcing");
      const focusRequisition =
        openRequisitions
          .slice()
          .sort((left, right) => {
            if (left.status === "blocked" && right.status !== "blocked") {
              return -1;
            }
            if (left.status !== "blocked" && right.status === "blocked") {
              return 1;
            }
            if (left.urgency === "critical" && right.urgency !== "critical") {
              return -1;
            }
            if (left.urgency !== "critical" && right.urgency === "critical") {
              return 1;
            }
            return right.budgetAmount - left.budgetAmount;
          })[0] ?? null;

      return {
        summary: {
          openRequisitions: openRequisitions.length,
          pendingApproval: requisitions.filter((item) => item.status === "submitted").length,
          criticalUrgency: requisitions.filter((item) => item.urgency === "critical").length,
          averageApprovalHours:
            openRequisitions.length > 0
              ? roundMetric(openRequisitions.reduce((sum, item) => sum + item.approvalHours, 0) / openRequisitions.length)
              : 0,
          supplierCoverage:
            requisitions.length > 0
              ? roundMetric(requisitions.reduce((sum, item) => sum + item.supplierCoverage, 0) / requisitions.length)
              : 0
        },
        requisitions,
        risks,
        origins: fieldMaterialRequests
          .filter((item) => item.requisitionId)
          .map((item) => ({
            requisitionId: item.requisitionId!,
            fieldRequestId: item.id,
            projectName: item.projectName,
            frontName: item.frontName,
            requestedBy: item.requestedBy,
            summary: item.summary,
            detail: item.detail,
            requestedVolume: item.requestedVolume,
            urgency: item.urgency,
            status: item.status,
            nextAction: item.nextAction,
            createdAt: item.createdAt
          })),
        focusRequisition
      };
    },
    async createRequisition(input: {
      companyId: string;
      projectName: string;
      frontName: string;
      requestedBy: string;
      category: string;
      status: "draft" | "submitted" | "approved" | "sourcing" | "blocked";
      requestedItems: number;
      budgetAmount: number;
      urgency: "planned" | "watch" | "critical";
      approvalHours: number;
      supplierCoverage: number;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PROCUREMENT_REQUISITIONS_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const createdRequisition = await repository.createProcurementRequisition(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "procurement_requisition",
        aggregateId: createdRequisition.id,
        action: "procurement.requisition.created",
        metadata: {
          code: createdRequisition.code,
          status: createdRequisition.status,
          urgency: createdRequisition.urgency
        }
      });

      return createdRequisition;
    },
    async updateRequisition(input: {
      companyId: string;
      requisitionId: string;
      status: "draft" | "submitted" | "approved" | "sourcing" | "blocked";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PROCUREMENT_REQUISITIONS_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const requisitions = await repository.listProcurementRequisitions(input.companyId);
      const requisition = requisitions.find((item) => item.id === input.requisitionId);
      if (!requisition) {
        throw notFound("PROCUREMENT_REQUISITION_NOT_FOUND", "Requisition not found", {
          companyId: input.companyId,
          requisitionId: input.requisitionId
        });
      }

      if (requisition.status === input.status && requisition.nextAction === input.nextAction) {
        return requisition;
      }

      if (requisition.status !== input.status) {
        const allowed = allowedStatusTransitions[requisition.status];
        if (!allowed.includes(input.status)) {
          throw validationError("PROCUREMENT_REQUISITION_INVALID_TRANSITION", "Requisition status transition is not allowed", {
            requisitionId: requisition.id,
            currentStatus: requisition.status,
            nextStatus: input.status
          });
        }
      }

      if (input.status === "approved" && requisition.supplierCoverage < 1) {
        throw validationError("PROCUREMENT_REQUISITION_SUPPLIER_GAP", "Requisition needs at least one supplier path before approval", {
          requisitionId: requisition.id,
          supplierCoverage: requisition.supplierCoverage
        });
      }

      if (input.status === "sourcing" && requisition.status !== "approved") {
        throw validationError("PROCUREMENT_REQUISITION_REQUIRES_APPROVAL", "Requisition must be approved before moving into sourcing", {
          requisitionId: requisition.id,
          currentStatus: requisition.status
        });
      }

      if (input.status === "sourcing" && requisition.urgency === "critical" && requisition.supplierCoverage < 2) {
        throw validationError(
          "PROCUREMENT_REQUISITION_COVERAGE_LOW",
          "Critical requisition needs stronger supplier coverage before sourcing handoff",
          {
            requisitionId: requisition.id,
            supplierCoverage: requisition.supplierCoverage
          }
        );
      }

      const updatedRequisition = await repository.updateProcurementRequisition({
        requisitionId: input.requisitionId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "procurement_requisition",
        aggregateId: updatedRequisition.id,
        action: "procurement.requisition.updated",
        metadata: {
          status: updatedRequisition.status,
          nextAction: updatedRequisition.nextAction
        }
      });

      return updatedRequisition;
    }
  };
}
