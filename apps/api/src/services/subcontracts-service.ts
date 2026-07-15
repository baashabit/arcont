import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundCurrency(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createSubcontractsService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("SUBCONTRACTS_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [workforces, risks, projects, dailyLogs, qualityInspections] = await Promise.all([
      repository.listHrWorkforces(companyId),
      repository.listHrRisks(companyId),
      repository.listProjects(companyId),
      repository.listDailyLogEntries(companyId),
      repository.listQualityInspections(companyId)
    ]);

    const lines = workforces.map((item) => {
      const project =
        projects.find((candidate) => candidate.name.includes(item.frontName) || item.frontName.includes(candidate.name)) ??
        projects.find((candidate) => candidate.companyId === item.companyId) ??
        null;
      const latestDailyLog =
        dailyLogs
          .filter((entry) => entry.frontName === item.frontName || entry.projectName === project?.name)
          .slice()
          .sort((left, right) => right.logDate.localeCompare(left.logDate) || right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
      const relatedInspections = qualityInspections.filter((inspection) =>
        inspection.contractorName === item.contractorName ||
        inspection.areaName === item.frontName ||
        inspection.areaName.includes(item.frontName)
      );
      const qualityReleaseReadiness =
        relatedInspections.length > 0
          ? Number(
              (relatedInspections.reduce((sum, inspection) => sum + inspection.releaseReadiness, 0) / relatedInspections.length).toFixed(1)
            )
          : 100;
      const projectProgress = project?.progress ?? clamp(item.productivityRate + item.attendanceRate * 0.2, 25, 100);
      const contractAmount = roundCurrency(
        item.activeHeadcount * 185000 +
          item.productivityRate * 12000 +
          (project?.activeFronts ?? 1) * 210000
      );
      const earnedRatio = clamp(projectProgress / 100 - item.complianceExpirations * 0.02, 0.15, 1);
      const earnedAmount = roundCurrency(contractAmount * earnedRatio);
      const invoicedAmount = roundCurrency(
        earnedAmount * clamp(item.attendanceRate / 100 + item.productivityRate / 250, 0.35, 0.96)
      );
      const paidAmount = roundCurrency(
        invoicedAmount * clamp(1 - item.incidentCount * 0.08 - item.complianceExpirations * 0.05, 0.42, 0.95)
      );
      const retentionAmount = roundCurrency(invoicedAmount * 0.1);
      const pendingDestajo = Math.max(invoicedAmount - paidAmount, 0);
      const progressGap = Number((projectProgress - item.productivityRate).toFixed(1));

      const subcontractHealth =
        item.safetyStatus === "critical" || pendingDestajo > contractAmount * 0.18 || progressGap > 12
          ? "critical"
          : item.safetyStatus === "watch" || pendingDestajo > contractAmount * 0.08 || progressGap > 6
            ? "watch"
            : "controlled";

      return {
        id: `sub_${item.id}`,
        workforceId: item.id,
        companyId: item.companyId,
        projectId: project?.id ?? null,
        code: item.code,
        contractorName: item.contractorName,
        frontName: item.frontName,
        projectName: project?.name ?? item.frontName,
        projectStatus: project?.status ?? null,
        subcontractHealth,
        latestDailyLogStatus: latestDailyLog?.status ?? "unknown",
        qualityReleaseReadiness,
        contractAmount,
        earnedAmount,
        invoicedAmount,
        paidAmount,
        retentionAmount,
        pendingDestajo,
        productivityRate: item.productivityRate,
        attendanceRate: item.attendanceRate,
        complianceExpirations: item.complianceExpirations,
        incidentCount: item.incidentCount,
        activeHeadcount: item.activeHeadcount,
        progressPercent: projectProgress,
        progressGap,
        nextAction: item.nextAction,
        updatedAt: item.updatedAt
      };
    });

    const mappedRisks = risks
      .map((risk) => {
        const line = lines.find((item) => item.workforceId === risk.workforceId);
        if (!line) {
          return null;
        }

        return {
          id: risk.id,
          lineId: line.id,
          title: risk.title,
          category: risk.category,
          severity: risk.severity,
          owner: risk.owner,
          status: risk.status
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const focusLine =
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
        })[0] ?? null;

    return {
      summary: {
        activeSubcontracts: lines.length,
        contractedAmount: roundCurrency(lines.reduce((sum, item) => sum + item.contractAmount, 0)),
        earnedAmount: roundCurrency(lines.reduce((sum, item) => sum + item.earnedAmount, 0)),
        paidAmount: roundCurrency(lines.reduce((sum, item) => sum + item.paidAmount, 0)),
        pendingDestajo: roundCurrency(lines.reduce((sum, item) => sum + item.pendingDestajo, 0)),
        criticalSubcontracts: lines.filter((item) => item.subcontractHealth === "critical").length,
        executionRiskSubcontracts: lines.filter(
          (item) => item.latestDailyLogStatus === "flagged" || item.qualityReleaseReadiness < 75 || item.subcontractHealth === "critical"
        ).length
      },
      lines,
      risks: mappedRisks,
      focusLine
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
    },
    async createLine(input: {
      companyId: string;
      code: string;
      contractorName: string;
      projectName: string;
      frontName: string;
      activeHeadcount: number;
      attendanceRate: number;
      productivityRate: number;
      complianceExpirations: number;
      incidentCount: number;
      subcontractHealth: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const normalizedCode = input.code.trim().toUpperCase();
      if (overview.lines.some((item) => item.code.trim().toUpperCase() === normalizedCode)) {
        throw validationError("SUBCONTRACTS_DUPLICATE_CODE", "Subcontract code already exists", {
          companyId: input.companyId,
          code: normalizedCode
        });
      }

      if (
        input.subcontractHealth === "controlled" &&
        (input.complianceExpirations > 0 || input.incidentCount > 0)
      ) {
        throw validationError(
          "SUBCONTRACTS_CONTROLLED_WITH_OPEN_ISSUES",
          "Controlled subcontract cannot be created while compliance expirations or incidents remain open",
          {
            companyId: input.companyId,
            complianceExpirations: input.complianceExpirations,
            incidentCount: input.incidentCount
          }
        );
      }

      if (input.subcontractHealth === "controlled" && input.attendanceRate < 85) {
        throw validationError(
          "SUBCONTRACTS_CONTROLLED_WITH_LOW_ATTENDANCE",
          "Controlled subcontract cannot be created while attendance remains too low",
          {
            companyId: input.companyId,
            attendanceRate: input.attendanceRate
          }
        );
      }

      const projectName = input.projectName.trim();
      const frontName = input.frontName.trim();
      const persistedFrontName = frontName.toLowerCase().includes(projectName.toLowerCase())
        ? frontName
        : `${projectName} · ${frontName}`;
      const createdWorkforce = await repository.createHrWorkforceItem({
        companyId: input.companyId,
        code: normalizedCode,
        contractorName: input.contractorName.trim(),
        frontName: persistedFrontName,
        activeHeadcount: input.activeHeadcount,
        attendanceRate: input.attendanceRate,
        productivityRate: input.productivityRate,
        complianceExpirations: input.complianceExpirations,
        incidentCount: input.incidentCount,
        safetyStatus: input.subcontractHealth,
        nextAction: input.nextAction.trim()
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "subcontract_line",
        aggregateId: `sub_${createdWorkforce.id}`,
        action: "subcontracts.line.created",
        metadata: {
          workforceId: createdWorkforce.id,
          code: createdWorkforce.code,
          contractorName: createdWorkforce.contractorName,
          subcontractHealth: createdWorkforce.safetyStatus
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const createdLine = refreshed.lines.find((item) => item.workforceId === createdWorkforce.id);
      if (!createdLine) {
        throw notFound("SUBCONTRACTS_CREATE_LINE_NOT_FOUND", "Subcontract line not found after creation", {
          companyId: input.companyId,
          workforceId: createdWorkforce.id
        });
      }

      return createdLine;
    },
    async updateLine(input: {
      companyId: string;
      lineId: string;
      subcontractHealth: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const line = overview.lines.find((item) => item.id === input.lineId);
      if (!line) {
        throw notFound("SUBCONTRACTS_LINE_NOT_FOUND", "Subcontract line not found", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      const nextAction = input.nextAction.trim();
      if (nextAction.length < 8) {
        throw validationError("SUBCONTRACTS_INVALID_NEXT_ACTION", "Next action must be specific", {
          lineId: line.id,
          nextActionLength: nextAction.length
        });
      }

      if (input.subcontractHealth === line.subcontractHealth && nextAction === line.nextAction) {
        return line;
      }

      if (input.subcontractHealth === "controlled") {
        if (line.pendingDestajo > line.contractAmount * 0.1) {
          throw validationError(
            "SUBCONTRACTS_PENDING_DESTAJO_HIGH",
            "Subcontract cannot be marked controlled while pending destajo remains too high",
            {
              lineId: line.id,
              pendingDestajo: line.pendingDestajo
            }
          );
        }

        if (line.complianceExpirations > 0 || line.incidentCount > 0) {
          throw validationError(
            "SUBCONTRACTS_OPEN_FIELD_ISSUES",
            "Subcontract cannot be marked controlled while compliance expirations or incidents remain open",
            {
              lineId: line.id,
              complianceExpirations: line.complianceExpirations,
              incidentCount: line.incidentCount
            }
          );
        }

        if (line.qualityReleaseReadiness < 85) {
          throw validationError(
            "SUBCONTRACTS_QUALITY_NOT_READY",
            "Subcontract cannot be marked controlled while quality readiness remains too low",
            {
              lineId: line.id,
              qualityReleaseReadiness: line.qualityReleaseReadiness
            }
          );
        }
      }

      if (input.subcontractHealth === "watch" && line.attendanceRate < 85) {
        throw validationError(
          "SUBCONTRACTS_ATTENDANCE_TOO_LOW",
          "Attendance is too low for watch status and should remain critical",
          {
            lineId: line.id,
            attendanceRate: line.attendanceRate
          }
        );
      }

      if (input.subcontractHealth === "watch" && line.latestDailyLogStatus === "flagged") {
        throw validationError(
          "SUBCONTRACTS_FLAGGED_DAILY_LOG",
          "Subcontract should remain critical while the latest daily log is still flagged",
          {
            lineId: line.id,
            latestDailyLogStatus: line.latestDailyLogStatus
          }
        );
      }

      const updatedWorkforce = await repository.updateHrWorkforceItem({
        workforceId: line.workforceId,
        safetyStatus: input.subcontractHealth,
        nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "subcontract_line",
        aggregateId: line.id,
        action: "subcontracts.line.updated",
        metadata: {
          subcontractHealth: updatedWorkforce.safetyStatus,
          nextAction: updatedWorkforce.nextAction
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedLine = refreshed.lines.find((item) => item.id === input.lineId);
      if (!refreshedLine) {
        throw notFound("SUBCONTRACTS_LINE_NOT_FOUND", "Subcontract line not found after update", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      return refreshedLine;
    }
  };
}
