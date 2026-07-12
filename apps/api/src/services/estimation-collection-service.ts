import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundCurrency(value: number) {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function healthWeight(status: "controlled" | "watch" | "critical") {
  switch (status) {
    case "controlled":
      return 0.9;
    case "watch":
      return 0.72;
    default:
      return 0.48;
  }
}

export function createEstimationCollectionService(repository: PlatformRepository) {
  async function buildOverview(companyId: string) {
    const company = await repository.getCompanyById(companyId);
    if (!company) {
      throw notFound("ESTIMATIONS_COMPANY_NOT_FOUND", "Company not found", {
        companyId
      });
    }

    const [projects, projectRisks, procurementPackages, financeItems, financeRisks] = await Promise.all([
      repository.listProjects(companyId),
      repository.listProjectRisks(companyId),
      repository.listProcurementPackages(companyId),
      repository.listFinanceItems(companyId),
      repository.listFinanceRisks(companyId)
    ]);

    const sortedFinanceItems = financeItems.slice().sort((left, right) => left.id.localeCompare(right.id));

    const lines = projects.map((project, index) => {
      const anchorItem = sortedFinanceItems[index % Math.max(sortedFinanceItems.length, 1)];
      if (!anchorItem) {
        throw notFound("ESTIMATIONS_FINANCE_SIGNAL_NOT_FOUND", "Finance signal not found", {
          companyId,
          projectId: project.id
        });
      }

      const matchingPackages = procurementPackages.filter((pkg) => pkg.projectName === project.name);
      const baseContractValue =
        matchingPackages.length > 0
          ? matchingPackages.reduce((sum, pkg) => sum + pkg.budgetAmount, 0) * 1.22
          : project.activeFronts * 1250000;
      const evidenceProgress = clamp(
        project.progress - project.qualityHolds * 1.3 - Math.max(project.scheduleVarianceDays, 0) * 1.1,
        0,
        100
      );
      const executedAmount = roundCurrency(baseContractValue * (evidenceProgress / 100));
      const submittedAmount = roundCurrency(executedAmount * healthWeight(anchorItem.satStatus));
      const collectionFactor = clamp(anchorItem.closeReadiness / 100 - anchorItem.urgentItems * 0.03, 0.18, 1);
      const collectedAmount = roundCurrency(submittedAmount * collectionFactor);
      const pendingToBill = Math.max(executedAmount - submittedAmount, 0);
      const pendingCollection = Math.max(submittedAmount - collectedAmount, 0);
      const progressGap = Number((project.progress - evidenceProgress).toFixed(1));

      return {
        id: `est_${project.id}`,
        companyId: project.companyId,
        projectId: project.id,
        financeLedgerId: anchorItem.id,
        code: project.code,
        projectName: project.name,
        client: project.client,
        segment: project.segment,
        projectStatus: project.status,
        collectionHealth:
          pendingCollection > baseContractValue * 0.22 || progressGap > 10
            ? "critical"
            : pendingCollection > baseContractValue * 0.1 || anchorItem.satStatus === "watch"
              ? "watch"
              : anchorItem.satStatus,
        estimatedAmount: roundCurrency(baseContractValue),
        executedAmount,
        submittedAmount,
        collectedAmount,
        pendingToBill,
        pendingCollection,
        evidenceProgress,
        projectProgress: project.progress,
        progressGap,
        scheduleVarianceDays: project.scheduleVarianceDays,
        closeReadiness: anchorItem.closeReadiness,
        nextAction: anchorItem.note,
        updatedAt: [project.updatedAt, anchorItem.updatedAt].sort().reverse()[0]
      };
    });

    const lineIds = new Map(lines.map((line) => [line.projectId, line.id]));

    const exceptions = [
      ...projectRisks
        .map((risk) => {
          const lineId = lineIds.get(risk.projectId);
          if (!lineId) {
            return null;
          }

          return {
            id: risk.id,
            lineId,
            title: risk.title,
            category: risk.category,
            severity: risk.severity,
            owner: risk.owner,
            status: risk.status
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
      ...financeRisks
        .map((risk) => {
          const line = lines.find((item) => item.financeLedgerId === risk.ledgerId);
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
        .filter((item): item is NonNullable<typeof item> => item !== null)
    ];

    const focusLine =
      lines
        .slice()
        .sort((left, right) => {
          if (left.collectionHealth === "critical" && right.collectionHealth !== "critical") {
            return -1;
          }

          if (left.collectionHealth !== "critical" && right.collectionHealth === "critical") {
            return 1;
          }

          return right.pendingCollection - left.pendingCollection;
        })[0] ?? null;

    return {
      summary: {
        trackedProjects: lines.length,
        estimatedPortfolio: roundCurrency(lines.reduce((sum, item) => sum + item.estimatedAmount, 0)),
        submittedPortfolio: roundCurrency(lines.reduce((sum, item) => sum + item.submittedAmount, 0)),
        collectedPortfolio: roundCurrency(lines.reduce((sum, item) => sum + item.collectedAmount, 0)),
        pendingCollection: roundCurrency(lines.reduce((sum, item) => sum + item.pendingCollection, 0)),
        criticalCollections: lines.filter((item) => item.collectionHealth === "critical").length
      },
      lines,
      exceptions,
      focusLine
    };
  }

  return {
    async getOverview(companyId: string) {
      return buildOverview(companyId);
    },
    async updateLine(input: {
      companyId: string;
      lineId: string;
      collectionHealth: "controlled" | "watch" | "critical";
      nextAction: string;
    }) {
      const overview = await buildOverview(input.companyId);
      const line = overview.lines.find((item) => item.id === input.lineId);
      if (!line) {
        throw notFound("ESTIMATIONS_LINE_NOT_FOUND", "Estimation line not found", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      if (input.collectionHealth === "controlled") {
        if (line.pendingCollection > line.estimatedAmount * 0.15) {
          throw validationError(
            "ESTIMATIONS_PENDING_COLLECTION_HIGH",
            "Collection health cannot move to controlled while pending collection remains too high",
            {
              lineId: line.id,
              pendingCollection: line.pendingCollection
            }
          );
        }

        if (line.progressGap > 8) {
          throw validationError(
            "ESTIMATIONS_EVIDENCE_GAP_OPEN",
            "Collection health cannot move to controlled while executed evidence lags field progress",
            {
              lineId: line.id,
              progressGap: line.progressGap
            }
          );
        }
      }

      if (input.collectionHealth === "watch" && line.pendingCollection > line.estimatedAmount * 0.35) {
        throw validationError(
          "ESTIMATIONS_ESCALATE_TO_CRITICAL",
          "High pending collection should remain critical instead of watch",
          {
            lineId: line.id,
            pendingCollection: line.pendingCollection
          }
        );
      }

      const updatedItem = await repository.updateFinanceLedgerItem({
        ledgerId: line.financeLedgerId,
        satStatus: input.collectionHealth,
        note: input.nextAction
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "estimation_collection_line",
        aggregateId: line.id,
        action: "estimations.collection_line.updated",
        metadata: {
          collectionHealth: updatedItem.satStatus,
          nextAction: updatedItem.note
        }
      });

      const refreshed = await buildOverview(input.companyId);
      const refreshedLine = refreshed.lines.find((item) => item.id === input.lineId);
      if (!refreshedLine) {
        throw notFound("ESTIMATIONS_LINE_NOT_FOUND", "Estimation line not found after update", {
          companyId: input.companyId,
          lineId: input.lineId
        });
      }

      return refreshedLine;
    }
  };
}
