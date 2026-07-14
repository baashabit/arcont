import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function normalizeComparableText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

export function createFieldMaterialRequestsService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("FIELD_MATERIAL_REQUEST_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [requests, requisitions] = await Promise.all([
        repository.listFieldMaterialRequests(companyId),
        repository.listProcurementRequisitions(companyId)
      ]);

      const linkedRequisitionIds = new Set(requests.flatMap((item) => (item.requisitionId ? [item.requisitionId] : [])));
      const linkedRequisitions = requisitions.filter((item) => linkedRequisitionIds.has(item.id));
      const openRequests = requests.filter((item) => item.status !== "cancelled");
      const focusRequest =
        openRequests
          .slice()
          .sort((left, right) => {
            if (left.urgency === "critical" && right.urgency !== "critical") {
              return -1;
            }
            if (left.urgency !== "critical" && right.urgency === "critical") {
              return 1;
            }
            if (left.status === "requested" && right.status !== "requested") {
              return -1;
            }
            if (left.status !== "requested" && right.status === "requested") {
              return 1;
            }
            return right.createdAt.localeCompare(left.createdAt);
          })[0] ?? null;

      return {
        summary: {
          openRequests: openRequests.length,
          convertedRequests: requests.filter((item) => item.status === "converted").length,
          criticalRequests: requests.filter((item) => item.urgency === "critical" && item.status !== "cancelled").length,
          linkedRequisitions: linkedRequisitions.length,
          averageSupplierCoverage:
            linkedRequisitions.length > 0
              ? roundMetric(
                  linkedRequisitions.reduce((sum, item) => sum + item.supplierCoverage, 0) / linkedRequisitions.length
                )
              : 0
        },
        requests,
        focusRequest
      };
    },
    async createMaterialRequest(input: {
      companyId: string;
      projectName: string;
      frontName: string;
      requestedBy: string;
      summary: string;
      detail: string;
      requestedVolume: string;
      category: string;
      requestedItems: number;
      budgetAmount: number;
      approvalHours: number;
      supplierCoverage: number;
      urgency: "planned" | "watch" | "critical";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("FIELD_MATERIAL_REQUEST_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const projectName = input.projectName.trim();
      const frontName = input.frontName.trim();
      const requestedBy = input.requestedBy.trim();
      const summary = input.summary.trim();
      const detail = input.detail.trim();
      const requestedVolume = input.requestedVolume.trim();
      const category = input.category.trim();
      const nextAction = input.nextAction.trim();

      if (
        projectName.length < 3 ||
        frontName.length < 3 ||
        requestedBy.length < 3 ||
        summary.length < 5 ||
        detail.length < 12 ||
        requestedVolume.length < 2 ||
        category.length < 3
      ) {
        throw validationError(
          "FIELD_MATERIAL_REQUEST_INVALID_INPUT",
          "Project, front, requester, summary, detail, requested volume and category must be specific",
          {
            projectNameLength: projectName.length,
            frontNameLength: frontName.length,
            requestedByLength: requestedBy.length,
            summaryLength: summary.length,
            detailLength: detail.length,
            requestedVolumeLength: requestedVolume.length,
            categoryLength: category.length
          }
        );
      }

      if (input.requestedItems <= 0 || !Number.isFinite(input.requestedItems)) {
        throw validationError(
          "FIELD_MATERIAL_REQUEST_INVALID_ITEMS",
          "Requested items must be greater than zero",
          {
            requestedItems: input.requestedItems
          }
        );
      }

      if (!Number.isFinite(input.budgetAmount) || input.budgetAmount < 0) {
        throw validationError(
          "FIELD_MATERIAL_REQUEST_INVALID_BUDGET",
          "Budget amount must be zero or greater",
          {
            budgetAmount: input.budgetAmount
          }
        );
      }

      if (!Number.isFinite(input.approvalHours) || input.approvalHours < 0) {
        throw validationError(
          "FIELD_MATERIAL_REQUEST_INVALID_APPROVAL_HOURS",
          "Approval hours must be zero or greater",
          {
            approvalHours: input.approvalHours
          }
        );
      }

      if (!Number.isFinite(input.supplierCoverage) || input.supplierCoverage < 0) {
        throw validationError(
          "FIELD_MATERIAL_REQUEST_INVALID_SUPPLIER_COVERAGE",
          "Supplier coverage must be zero or greater",
          {
            supplierCoverage: input.supplierCoverage
          }
        );
      }

      if (nextAction.length < 8) {
        throw validationError(
          "FIELD_MATERIAL_REQUEST_INVALID_NEXT_ACTION",
          "Next action must be specific before creating a material request",
          {
            nextActionLength: nextAction.length
          }
        );
      }

      const existingRequests = await repository.listFieldMaterialRequests(input.companyId);
      const duplicateRequest = existingRequests.find(
        (request) =>
          request.status !== "cancelled" &&
          normalizeComparableText(request.projectName) === normalizeComparableText(projectName) &&
          normalizeComparableText(request.frontName) === normalizeComparableText(frontName) &&
          normalizeComparableText(request.summary) === normalizeComparableText(summary)
      );
      if (duplicateRequest) {
        throw validationError(
          "FIELD_MATERIAL_REQUEST_DUPLICATE_OPEN_REQUEST",
          "A similar field material request already exists for this project front",
          {
            companyId: input.companyId,
            fieldRequestId: duplicateRequest.id,
            requisitionId: duplicateRequest.requisitionId,
            projectName,
            frontName,
            summary
          }
        );
      }

      const created = await repository.createFieldMaterialRequestAndRequisition({
        ...input,
        projectName,
        frontName,
        requestedBy,
        summary,
        detail,
        requestedVolume,
        category,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "field_material_request",
        aggregateId: created.fieldRequest.id,
        action: "field.material-request.created",
        metadata: {
          requisitionId: created.requisition.id,
          urgency: created.fieldRequest.urgency,
          requestedVolume: created.fieldRequest.requestedVolume
        }
      });

      return created;
    }
  };
}
