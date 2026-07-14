import { notFound, validationError } from "../lib/domain-error.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

export function createSupplierMasterService(repository: PlatformRepository) {
  return {
    async getOverview(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("SUPPLIER_MASTER_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [items, risks] = await Promise.all([
        repository.listSupplierMasterProfiles(companyId),
        repository.listSupplierMasterRisks(companyId)
      ]);

      const focusItem =
        items
          .slice()
          .sort((left, right) => {
            if (left.satStatus === "critical" && right.satStatus !== "critical") {
              return -1;
            }
            if (left.satStatus !== "critical" && right.satStatus === "critical") {
              return 1;
            }
            return right.fiscalPacketCompletion - left.fiscalPacketCompletion;
          })[0] ?? null;

      return {
        summary: {
          totalSuppliers: items.length,
          criticalSuppliers: items.filter((item) => item.satStatus === "critical" || item.complianceStatus === "blocked").length,
          incompletePackets: items.filter((item) => item.fiscalPacketCompletion < 100).length,
          averageFiscalPacketCompletion:
            items.length > 0 ? roundMetric(items.reduce((sum, item) => sum + item.fiscalPacketCompletion, 0) / items.length) : 0
        },
        items,
        risks,
        focusItem
      };
    },
    async createProfile(input: {
      companyId: string;
      supplierName: string;
      tradeName: string;
      rfc: string;
      fiscalRegime: string;
      cfdiUse: string;
      paymentMethod: string;
      paymentTermsDays: number;
      bankAccountMasked: string;
      contactName: string;
      contactEmail: string;
      contactPhone: string;
      complianceStatus: "complete" | "watch" | "blocked";
      satStatus: "controlled" | "watch" | "critical";
      fiscalPacketCompletion: number;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("SUPPLIER_MASTER_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const existing = await repository.listSupplierMasterProfiles(input.companyId);
      const normalizedRfc = input.rfc.trim().toUpperCase();
      const normalizedName = input.supplierName.trim().toLowerCase();
      const normalizedTradeName = input.tradeName.trim();
      const normalizedContactName = input.contactName.trim();
      const normalizedPhone = input.contactPhone.trim();

      if (!/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(normalizedRfc)) {
        throw validationError(
          "SUPPLIER_MASTER_RFC_INVALID",
          "Supplier RFC must match a valid Mexican RFC structure",
          {
            companyId: input.companyId,
            rfc: normalizedRfc
          }
        );
      }

      if (input.satStatus === "controlled" && input.fiscalPacketCompletion < 100) {
        throw validationError(
          "SUPPLIER_MASTER_PACKET_INCOMPLETE",
          "Supplier cannot start as controlled while fiscal packet is incomplete",
          {
            companyId: input.companyId,
            rfc: normalizedRfc,
            fiscalPacketCompletion: input.fiscalPacketCompletion
          }
        );
      }

      if (input.complianceStatus === "complete" && input.satStatus === "critical") {
        throw validationError(
          "SUPPLIER_MASTER_STATUS_CONFLICT",
          "Compliance cannot be complete while SAT posture remains critical",
          {
            companyId: input.companyId,
            rfc: normalizedRfc
          }
        );
      }

      if (existing.some((item) => item.rfc === normalizedRfc || item.supplierName.trim().toLowerCase() === normalizedName)) {
        throw validationError(
          "SUPPLIER_MASTER_DUPLICATE",
          "Supplier master profile already exists for this RFC or supplier name",
          {
            companyId: input.companyId,
            rfc: normalizedRfc,
            supplierName: input.supplierName
          }
        );
      }

      const profile = await repository.createSupplierMasterProfile({
        ...input,
        rfc: normalizedRfc,
        tradeName: normalizedTradeName,
        contactName: normalizedContactName,
        contactPhone: normalizedPhone
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "supplier_master_profile",
        aggregateId: profile.id,
        action: "supplier-master.profile.created",
        metadata: {
          supplierId: profile.supplierId,
          rfc: profile.rfc,
          satStatus: profile.satStatus
        }
      });

      return profile;
    },
    async updateProfile(input: {
      companyId: string;
      profileId: string;
      complianceStatus: "complete" | "watch" | "blocked";
      satStatus: "controlled" | "watch" | "critical";
      fiscalPacketCompletion: number;
      nextAction: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("SUPPLIER_MASTER_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const items = await repository.listSupplierMasterProfiles(input.companyId);
      const item = items.find((candidate) => candidate.id === input.profileId);
      if (!item) {
        throw notFound("SUPPLIER_MASTER_PROFILE_NOT_FOUND", "Supplier master profile not found", {
          companyId: input.companyId,
          profileId: input.profileId
        });
      }

      if (input.satStatus === "controlled" && input.fiscalPacketCompletion < 100) {
        throw validationError(
          "SUPPLIER_MASTER_PACKET_INCOMPLETE",
          "Supplier cannot move to controlled while fiscal packet is incomplete",
          {
            profileId: item.id,
            fiscalPacketCompletion: input.fiscalPacketCompletion
          }
        );
      }

      if (input.complianceStatus === "complete" && input.satStatus === "critical") {
        throw validationError(
          "SUPPLIER_MASTER_STATUS_CONFLICT",
          "Compliance cannot be complete while SAT posture remains critical",
          {
            profileId: item.id,
            satStatus: input.satStatus,
            complianceStatus: input.complianceStatus
          }
        );
      }

      const updated = await repository.updateSupplierMasterProfile(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: undefined,
        aggregateType: "supplier_master_profile",
        aggregateId: updated.id,
        action: "supplier-master.profile.updated",
        metadata: {
          satStatus: updated.satStatus,
          complianceStatus: updated.complianceStatus,
          fiscalPacketCompletion: updated.fiscalPacketCompletion
        }
      });

      return updated;
    }
  };
}
