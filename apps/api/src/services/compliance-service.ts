import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

const allowedStatusTransitions: Record<
  "monitoring" | "in_progress" | "at_risk" | "blocked" | "closed",
  Array<"monitoring" | "in_progress" | "at_risk" | "blocked" | "closed">
> = {
  monitoring: ["in_progress", "at_risk", "blocked"],
  in_progress: ["at_risk", "blocked", "closed"],
  at_risk: ["in_progress", "blocked", "closed"],
  blocked: ["in_progress", "at_risk"],
  closed: []
};

export function createComplianceService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("COMPLIANCE_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const cases = await repository.listComplianceCases(companyId);
      const risks = await repository.listComplianceRisks(companyId);
      const activeCases = cases.filter((item) => item.status !== "closed").length;
      const atRiskCases = cases.filter((item) => item.health !== "healthy").length;
      const averageDocumentCompletion =
        cases.length > 0
          ? Number((cases.reduce((sum, item) => sum + item.documentCompletion, 0) / cases.length).toFixed(1))
          : 0;
      const openFindings = cases.reduce((sum, item) => sum + item.openFindings, 0);
      const focusCase =
        cases
          .slice()
          .sort((left, right) => {
            if (left.health === "critical" && right.health !== "critical") {
              return -1;
            }

            if (left.health !== "critical" && right.health === "critical") {
              return 1;
            }

            return left.slaHoursRemaining - right.slaHoursRemaining;
          })[0] ?? null;

      return {
        summary: {
          activeCases,
          atRiskCases,
          averageDocumentCompletion,
          openFindings
        },
        cases,
        risks,
        focusCase
      };
    },
    async updateCase(input: {
      companyId: string;
      caseId: string;
      status: "monitoring" | "in_progress" | "at_risk" | "blocked" | "closed";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("COMPLIANCE_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const cases = await repository.listComplianceCases(input.companyId);
      const complianceCase = cases.find((item) => item.id === input.caseId);
      if (!complianceCase) {
        throw notFound("COMPLIANCE_CASE_NOT_FOUND", "Compliance case not found", {
          companyId: input.companyId,
          caseId: input.caseId
        });
      }

      const nextAction = input.nextAction.trim();
      if (nextAction.length < 8) {
        throw validationError("COMPLIANCE_INVALID_NEXT_ACTION", "Next action must be specific", {
          caseId: complianceCase.id,
          nextActionLength: nextAction.length
        });
      }

      if (complianceCase.status === input.status && complianceCase.nextAction === nextAction) {
        return complianceCase;
      }

      if (complianceCase.status !== input.status) {
        const allowedTransitions = allowedStatusTransitions[complianceCase.status];
        if (!allowedTransitions.includes(input.status)) {
          throw validationError("COMPLIANCE_INVALID_STATUS_TRANSITION", "Compliance case status transition is not allowed", {
            caseId: complianceCase.id,
            currentStatus: complianceCase.status,
            nextStatus: input.status
          });
        }
      }

      if (input.status === "closed") {
        if (complianceCase.openFindings > 0) {
          throw validationError("COMPLIANCE_OPEN_FINDINGS", "Compliance case cannot be closed while findings remain open", {
            caseId: complianceCase.id,
            openFindings: complianceCase.openFindings
          });
        }

        if (complianceCase.documentCompletion < 95) {
          throw validationError("COMPLIANCE_DOCUMENTS_INCOMPLETE", "Compliance case requires at least 95% document completion before closure", {
            caseId: complianceCase.id,
            documentCompletion: complianceCase.documentCompletion
          });
        }

        if (complianceCase.slaHoursRemaining < 0) {
          throw validationError("COMPLIANCE_SLA_BREACHED", "Compliance case must be revalidated before closure after SLA breach", {
            caseId: complianceCase.id,
            slaHoursRemaining: complianceCase.slaHoursRemaining
          });
        }
      }

      if (input.status === "in_progress" && complianceCase.documentCompletion < 40) {
        throw validationError(
          "COMPLIANCE_DOCUMENT_BASELINE_TOO_LOW",
          "Compliance case should not move to in-progress without minimum document baseline",
          {
            caseId: complianceCase.id,
            documentCompletion: complianceCase.documentCompletion
          }
        );
      }

      if (input.status === "at_risk" && complianceCase.health === "healthy" && complianceCase.openFindings === 0) {
        throw validationError(
          "COMPLIANCE_RISK_ESCALATION_TOO_WEAK",
          "Compliance case should not move to at-risk without findings or risk posture supporting it",
          {
            caseId: complianceCase.id,
            health: complianceCase.health,
            openFindings: complianceCase.openFindings
          }
        );
      }

      const updatedCase = await repository.updateComplianceCase({
        caseId: input.caseId,
        status: input.status,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "compliance_case",
        aggregateId: updatedCase.id,
        action: "compliance.case.updated",
        metadata: {
          status: updatedCase.status,
          nextAction: updatedCase.nextAction
        }
      });

      return updatedCase;
    }
  };
}
