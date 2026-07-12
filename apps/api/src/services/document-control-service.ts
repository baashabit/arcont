import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "issued" | "in_review" | "awaiting_response" | "approved" | "blocked",
  Array<"issued" | "in_review" | "awaiting_response" | "approved" | "blocked">
> = {
  issued: ["in_review", "blocked"],
  in_review: ["awaiting_response", "approved", "blocked"],
  awaiting_response: ["in_review", "approved", "blocked"],
  approved: [],
  blocked: ["in_review", "awaiting_response"]
};

export function createDocumentControlService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("DOCUMENT_CONTROL_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const items = await repository.listDocumentControlItems(companyId);
      const risks = await repository.listDocumentControlRisks(companyId);
      const openRfis = items.filter((item) => item.documentType === "RFI" && item.status !== "approved").length;
      const activeSubmittals = items.filter((item) => item.documentType === "Submittal" && item.status !== "approved").length;
      const controlledVersions = items.reduce((sum, item) => sum + item.revisionCount, 0);
      const averageTurnaroundDays =
        items.length > 0
          ? Number((items.reduce((sum, item) => sum + item.turnaroundDays, 0) / items.length).toFixed(1))
          : 0;
      const focusItem =
        items
          .slice()
          .sort((left, right) => {
            if (left.health === "critical" && right.health !== "critical") {
              return -1;
            }

            if (left.health !== "critical" && right.health === "critical") {
              return 1;
            }

            return right.openComments - left.openComments;
          })[0] ?? null;

      return {
        summary: {
          openRfis,
          activeSubmittals,
          controlledVersions,
          averageTurnaroundDays
        },
        items,
        risks,
        focusItem
      };
    },
    async updateItem(input: {
      companyId: string;
      itemId: string;
      status: "issued" | "in_review" | "awaiting_response" | "approved" | "blocked";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("DOCUMENT_CONTROL_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const items = await repository.listDocumentControlItems(input.companyId);
      const item = items.find((candidate) => candidate.id === input.itemId);
      if (!item) {
        throw notFound("DOCUMENT_CONTROL_ITEM_NOT_FOUND", "Document control item not found", {
          companyId: input.companyId,
          itemId: input.itemId
        });
      }

      if (item.status === input.status && item.nextAction === input.nextAction) {
        return item;
      }

      if (item.status !== input.status) {
        const allowedTransitions = allowedStatusTransitions[item.status];
        if (!allowedTransitions.includes(input.status)) {
          throw validationError("DOCUMENT_CONTROL_INVALID_STATUS_TRANSITION", "Document status transition is not allowed", {
            itemId: item.id,
            currentStatus: item.status,
            nextStatus: input.status
          });
        }
      }

      if (input.status === "approved" && item.openComments > 0) {
        throw validationError("DOCUMENT_CONTROL_OPEN_COMMENTS", "Document cannot be approved while comments remain open", {
          itemId: item.id,
          openComments: item.openComments
        });
      }

      if (input.status === "approved" && item.turnaroundDays > 10) {
        throw validationError("DOCUMENT_CONTROL_STALE_APPROVAL", "Document turnaround is stale and requires revalidation before approval", {
          itemId: item.id,
          turnaroundDays: item.turnaroundDays
        });
      }

      const updatedItem = await repository.updateDocumentControlItem({
        itemId: input.itemId,
        status: input.status,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "document_control_item",
        aggregateId: updatedItem.id,
        action: "document_control.item.updated",
        metadata: {
          status: updatedItem.status,
          nextAction: updatedItem.nextAction
        }
      });

      return updatedItem;
    }
  };
}
