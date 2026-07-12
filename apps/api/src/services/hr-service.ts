import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createHrService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("HR_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const workforces = await repository.listHrWorkforces(companyId);
      const risks = await repository.listHrRisks(companyId);
      const activeHeadcount = workforces.reduce((sum, item) => sum + item.activeHeadcount, 0);
      const attendanceRate =
        workforces.length > 0
          ? Number((workforces.reduce((sum, item) => sum + item.attendanceRate, 0) / workforces.length).toFixed(1))
          : 0;
      const openIncidents = workforces.reduce((sum, item) => sum + item.incidentCount, 0);
      const focusWorkforce =
        workforces
          .slice()
          .sort((left, right) => {
            if (left.safetyStatus === "critical" && right.safetyStatus !== "critical") {
              return -1;
            }

            if (left.safetyStatus !== "critical" && right.safetyStatus === "critical") {
              return 1;
            }

            return right.complianceExpirations - left.complianceExpirations;
          })[0] ?? null;

      return {
        summary: {
          activeHeadcount,
          activeContractors: workforces.length,
          attendanceRate,
          openIncidents
        },
        workforces,
        risks,
        focusWorkforce
      };
    },
    async updateWorkforceItem(input: {
      companyId: string;
      workforceId: string;
      safetyStatus: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("HR_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const workforces = await repository.listHrWorkforces(input.companyId);
      const item = workforces.find((candidate) => candidate.id === input.workforceId);
      if (!item) {
        throw notFound("HR_WORKFORCE_NOT_FOUND", "Workforce item not found", {
          companyId: input.companyId,
          workforceId: input.workforceId
        });
      }

      if (item.safetyStatus === input.safetyStatus && item.nextAction === input.nextAction) {
        return item;
      }

      if (input.safetyStatus === "controlled") {
        if (item.incidentCount > 0) {
          throw validationError("HR_OPEN_INCIDENTS", "Workforce cannot be marked controlled while incidents remain open", {
            workforceId: item.id,
            incidentCount: item.incidentCount
          });
        }

        if (item.complianceExpirations > 0) {
          throw validationError("HR_COMPLIANCE_EXPIRATIONS", "Workforce cannot be marked controlled while compliance expirations remain", {
            workforceId: item.id,
            complianceExpirations: item.complianceExpirations
          });
        }
      }

      if (input.safetyStatus === "watch" && item.attendanceRate < 85) {
        throw validationError("HR_ATTENDANCE_TOO_LOW", "Attendance is too low for watch status and should remain critical", {
          workforceId: item.id,
          attendanceRate: item.attendanceRate
        });
      }

      const updatedItem = await repository.updateHrWorkforceItem({
        workforceId: input.workforceId,
        safetyStatus: input.safetyStatus,
        nextAction: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "hr_workforce_item",
        aggregateId: updatedItem.id,
        action: "hr.workforce_item.updated",
        metadata: {
          safetyStatus: updatedItem.safetyStatus,
          nextAction: updatedItem.nextAction
        }
      });

      return updatedItem;
    }
  };
}
