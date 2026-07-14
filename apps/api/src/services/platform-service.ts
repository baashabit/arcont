import type { PlatformRepository } from "../repositories/platform-repository.js";
import { conflictError, notFound, validationError } from "../lib/domain-error.js";

const REQUIRED_PLATFORM_MODULES = ["platform.companies", "platform.identity"];

function normalizeModuleList(enabledModules: string[]) {
  return Array.from(new Set([...REQUIRED_PLATFORM_MODULES, ...enabledModules]));
}

function validateFiscalInput(input: {
  countryCode: string;
  locale: string;
  currency: string;
  fiscalCountry: string;
  fiscalRegime: string;
}) {
  if (input.fiscalCountry === "MX") {
    if (input.currency !== "MXN") {
      throw validationError("PROVISION_INVALID_CURRENCY", "Mexican companies must use MXN", {
        expectedCurrency: "MXN"
      });
    }

    if (!input.locale.startsWith("es-MX")) {
      throw validationError("PROVISION_INVALID_LOCALE", "Mexican companies must use es-MX locale", {
        expectedLocale: "es-MX"
      });
    }

    if (!/^\d{3}$/.test(input.fiscalRegime)) {
      throw validationError("PROVISION_INVALID_FISCAL_REGIME", "Fiscal regime must be a SAT 3-digit code", {
        fiscalCountry: input.fiscalCountry
      });
    }
  }

  if (input.countryCode !== input.fiscalCountry) {
    throw validationError("PROVISION_COUNTRY_MISMATCH", "Country and fiscal country must match in this phase", {
      countryCode: input.countryCode,
      fiscalCountry: input.fiscalCountry
    });
  }
}

function validateSettingsInput(input: {
  timezone: string;
  locale: string;
  currency: string;
  fiscalCountry: string;
  satEnabled: boolean;
  fiscalRegime: string;
}) {
  if (!input.timezone.includes("/")) {
    throw validationError("SETTINGS_INVALID_TIMEZONE", "Timezone must be an IANA timezone", {
      timezone: input.timezone
    });
  }

  if (input.fiscalCountry === "MX") {
    if (input.currency !== "MXN") {
      throw validationError("SETTINGS_INVALID_CURRENCY", "Mexican companies must use MXN", {
        expectedCurrency: "MXN"
      });
    }

    if (!input.locale.startsWith("es-MX")) {
      throw validationError("SETTINGS_INVALID_LOCALE", "Mexican companies must use es-MX locale", {
        expectedLocale: "es-MX"
      });
    }

    if (input.satEnabled && !/^\d{3}$/.test(input.fiscalRegime)) {
      throw validationError("SETTINGS_INVALID_FISCAL_REGIME", "Fiscal regime must be a SAT 3-digit code", {
        fiscalCountry: input.fiscalCountry
      });
    }
  }
}

function sanitizeUser<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function readinessStatusFromCount(count: number, readyMinimum: number, warningMinimum = 1) {
  if (count >= readyMinimum) {
    return "ready" as const;
  }

  if (count >= warningMinimum) {
    return "warning" as const;
  }

  return "blocked" as const;
}

export function createPlatformService(repository: PlatformRepository) {
  return {
    async listCompanies() {
      return repository.listCompanies();
    },
    async listModules() {
      return repository.listModules();
    },
    async listRoles() {
      return repository.listRoles();
    },
    async listUsers(companyId?: string) {
      return (await repository.listUsers(companyId)).map(sanitizeUser);
    },
    async getUserDetail(userId: string) {
      const user = await repository.getUserById(userId);
      if (!user) {
        throw notFound("PLATFORM_USER_NOT_FOUND", "User not found", {
          userId
        });
      }

      const company = await repository.getCompanyById(user.companyId);
      if (!company) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId: user.companyId
        });
      }

      const role = (await repository.listRoles()).find((item) => item.key === user.roleKey);
      if (!role) {
        throw notFound("PLATFORM_ROLE_NOT_FOUND", "Role not found", {
          roleKey: user.roleKey
        });
      }

      return {
        user: sanitizeUser(user),
        company,
        role,
        permissions: role.permissions
      };
    },
    async getSettings(companyId: string) {
      const settings = await repository.getSettings(companyId);
      if (!settings) {
        throw notFound("PLATFORM_SETTINGS_NOT_FOUND", "Settings not found", {
          companyId
        });
      }

      return settings;
    },
    async listCompanyModules(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      return (await repository.listModules()).map((module) => ({
        companyId,
        module,
        enabled: company.enabledModules.includes(module.key)
      }));
    },
    async getPlatformBootstrap(companyId: string, userEmail?: string) {
      const company = await repository.getCompanyById(companyId);
      const settings = await repository.getSettings(companyId);
      const companyUsers = await this.listUsers(companyId);

      if (!company || !settings || companyUsers.length === 0) {
        throw notFound("PLATFORM_BOOTSTRAP_NOT_FOUND", "Platform bootstrap not found", {
          companyId
        });
      }

      const user =
        companyUsers.find((item) => item.email === userEmail) ??
        companyUsers.find((item) => item.roleKey === "platform-owner") ??
        companyUsers[0];

      const roles = await repository.listRoles();
      const permissions = roles.find((item) => item.key === user.roleKey)?.permissions ?? [];

      return {
        company,
        settings,
        user,
        roles,
        companyUsers,
        availableModules: await repository.listModules(),
        companyModules: await this.listCompanyModules(companyId),
        permissions
      };
    },
    async getCompanyDetail(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      const settings = await repository.getSettings(companyId);
      const users = await this.listUsers(companyId);

      if (!company || !settings) {
        throw notFound("PLATFORM_COMPANY_DETAIL_NOT_FOUND", "Company detail not found", {
          companyId
        });
      }

      const companyModules = await this.listCompanyModules(companyId);
      const enabledModuleCount = companyModules.filter((item) => item.enabled).length;

      return {
        company,
        settings,
        companyModules,
        users,
        stats: {
          totalUsers: users.length,
          activeUsers: users.filter((user) => user.status === "active").length,
          enabledModuleCount,
          disabledModuleCount: companyModules.length - enabledModuleCount
        }
      };
    },
    async provisionCompany(input: {
      legalName: string;
      tradeName: string;
      taxId: string;
      countryCode: string;
      timezone: string;
      locale: string;
      currency: string;
      fiscalCountry: string;
      fiscalRegime: string;
      adminFullName: string;
      adminEmail: string;
      enabledModules: string[];
    }) {
      validateFiscalInput(input);

      if (await repository.companyTaxIdExists(input.taxId)) {
        throw conflictError("PROVISION_DUPLICATE_TAX_ID", "A company with this tax ID already exists", {
          taxId: input.taxId
        });
      }

      if (await repository.userEmailExists(input.adminEmail)) {
        throw conflictError("PROVISION_DUPLICATE_ADMIN_EMAIL", "A user with this admin email already exists", {
          adminEmail: input.adminEmail
        });
      }

      const availableModules = await repository.listModules();
      const allowedModuleKeys = new Set(availableModules.map((module) => module.key));
      const normalizedModules = normalizeModuleList(input.enabledModules);
      const unknownModules = normalizedModules.filter((moduleKey) => !allowedModuleKeys.has(moduleKey));

      if (unknownModules.length > 0) {
        throw validationError("PROVISION_UNKNOWN_MODULES", "One or more requested modules are not recognized", {
          unknownModules
        });
      }

      const result = await repository.saveProvisionedCompany({
        ...input,
        enabledModules: normalizedModules
      });

      return {
        company: result.company,
        adminUser: {
          id: result.adminUser.id,
          companyId: result.adminUser.companyId,
          fullName: result.adminUser.fullName,
          email: result.adminUser.email,
          roleKey: result.adminUser.roleKey,
          status: result.adminUser.status
        },
        settings: result.settings,
        companyModules: await this.listCompanyModules(result.company.id),
        temporaryPassword: result.temporaryPassword
      };
    },
    async updateSettings(input: {
      companyId: string;
      timezone: string;
      locale: string;
      currency: string;
      fiscalCountry: string;
      satEnabled: boolean;
      fiscalRegime: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      validateSettingsInput(input);

      const settings = await repository.updateSettings(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        aggregateType: "settings",
        aggregateId: input.companyId,
        action: "platform.settings.updated",
        metadata: {
          locale: settings.locale,
          currency: settings.currency,
          fiscalCountry: settings.fiscalCountry
        }
      });

      return settings;
    },
    async replaceCompanyModules(input: {
      companyId: string;
      enabledModules: string[];
      actorUserId?: string;
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      const availableModules = await repository.listModules();
      const allowedModuleKeys = new Set(availableModules.map((module) => module.key));
      const normalizedModules = normalizeModuleList(input.enabledModules);
      const unknownModules = normalizedModules.filter((moduleKey) => !allowedModuleKeys.has(moduleKey));

      if (unknownModules.length > 0) {
        throw validationError("COMPANY_MODULES_UNKNOWN", "One or more requested modules are not recognized", {
          unknownModules
        });
      }

      const updatedCompany = await repository.replaceCompanyModules({
        ...input,
        enabledModules: normalizedModules
      });

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        aggregateType: "company_modules",
        aggregateId: input.companyId,
        action: "platform.company_modules.updated",
        metadata: {
          enabledModules: updatedCompany.enabledModules
        }
      });

      return this.listCompanyModules(updatedCompany.id);
    },
    async createUser(input: {
      companyId: string;
      fullName: string;
      email: string;
      roleKey: string;
      status: "invited" | "active" | "disabled";
    }) {
      const company = await repository.getCompanyById(input.companyId);
      if (!company) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId: input.companyId
        });
      }

      if (await repository.userEmailExists(input.email)) {
        throw conflictError("PLATFORM_USER_EMAIL_EXISTS", "A user with this email already exists", {
          email: input.email
        });
      }

      const role = (await repository.listRoles()).find((item) => item.key === input.roleKey);
      if (!role) {
        throw validationError("PLATFORM_ROLE_UNKNOWN", "The selected role is not recognized", {
          roleKey: input.roleKey
        });
      }

      if (role.scope === "platform" && company.id !== "cmp_arcont_demo") {
        throw validationError("PLATFORM_ROLE_SCOPE_INVALID", "Platform roles are reserved for platform tenants", {
          roleKey: input.roleKey,
          companyId: input.companyId
        });
      }

      const result = await repository.createUser(input);

      await repository.addAuditEvent({
        companyId: input.companyId,
        actorUserId: result.user.id,
        aggregateType: "user",
        aggregateId: result.user.id,
        action: "platform.user.created",
        metadata: {
          roleKey: result.user.roleKey,
          status: result.user.status
        }
      });

      return {
        user: sanitizeUser(result.user),
        temporaryPassword: result.temporaryPassword,
        role,
        permissions: role.permissions
      };
    },
    async updateUserRole(input: {
      userId: string;
      roleKey: string;
    }) {
      const existingUser = await repository.getUserById(input.userId);
      if (!existingUser) {
        throw notFound("PLATFORM_USER_NOT_FOUND", "User not found", {
          userId: input.userId
        });
      }

      const role = (await repository.listRoles()).find((item) => item.key === input.roleKey);
      if (!role) {
        throw validationError("PLATFORM_ROLE_UNKNOWN", "The selected role is not recognized", {
          roleKey: input.roleKey
        });
      }

      const company = await repository.getCompanyById(existingUser.companyId);
      if (!company) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId: existingUser.companyId
        });
      }

      if (role.scope === "platform" && company.id !== "cmp_arcont_demo") {
        throw validationError("PLATFORM_ROLE_SCOPE_INVALID", "Platform roles are reserved for platform tenants", {
          roleKey: input.roleKey,
          companyId: existingUser.companyId
        });
      }

      const user = await repository.updateUserRole(input);

      await repository.addAuditEvent({
        companyId: user.companyId,
        actorUserId: user.id,
        aggregateType: "user",
        aggregateId: user.id,
        action: "platform.user.role_updated",
        metadata: {
          roleKey: user.roleKey
        }
      });

      return {
        user: sanitizeUser(user),
        role,
        permissions: role.permissions
      };
    },
    async updateUserStatus(input: {
      userId: string;
      status: "invited" | "active" | "disabled";
    }) {
      const existingUser = await repository.getUserById(input.userId);
      if (!existingUser) {
        throw notFound("PLATFORM_USER_NOT_FOUND", "User not found", {
          userId: input.userId
        });
      }

      if (input.status === "disabled") {
        const companyUsers = await repository.listUsers(existingUser.companyId);
        const activeUsers = companyUsers.filter((user) => user.status === "active");

        if (
          existingUser.status === "active" &&
          activeUsers.length === 1 &&
          activeUsers[0]?.id === existingUser.id
        ) {
          throw validationError("PLATFORM_LAST_ACTIVE_USER", "Cannot disable the last active user of a company", {
            companyId: existingUser.companyId,
            userId: existingUser.id
          });
        }
      }

      const user = await repository.updateUserStatus(input);
      const role = (await repository.listRoles()).find((item) => item.key === user.roleKey);

      if (!role) {
        throw notFound("PLATFORM_ROLE_NOT_FOUND", "Role not found", {
          roleKey: user.roleKey
        });
      }

      await repository.addAuditEvent({
        companyId: user.companyId,
        actorUserId: user.id,
        aggregateType: "user",
        aggregateId: user.id,
        action: "platform.user.status_updated",
        metadata: {
          status: user.status
        }
      });

      return {
        user: sanitizeUser(user),
        role,
        permissions: role.permissions
      };
    },
    async listAuditEvents(companyId?: string, limit = 50) {
      return repository.listAuditEvents(companyId, limit);
    },
    async getDashboardSummary(companyId?: string) {
      const focusCompany = companyId ? await repository.getCompanyById(companyId) : null;
      if (companyId && !focusCompany) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const scopedCompanies = focusCompany ? [focusCompany] : await repository.listCompanies();
      const allUsers = (
        await Promise.all(scopedCompanies.map((company) => repository.listUsers(company.id)))
      ).flat();
      const latestAuditEvents = await repository.listAuditEvents(companyId, 10);
      const allModules = await repository.listModules();

      const byArea = allModules
        .filter((module) => module.scope === "operations")
        .reduce<Array<{ area: (typeof allModules)[number]["area"]; enabledCompanies: number }>>((acc, module) => {
          const current = acc.find((item) => item.area === module.area);
          const enabledCompanies = scopedCompanies.filter((company) =>
            company.enabledModules.includes(module.key)
          ).length;

          if (current) {
            current.enabledCompanies += enabledCompanies;
          } else {
            acc.push({
              area: module.area,
              enabledCompanies
            });
          }

          return acc;
        }, []);

      const enabledModules = scopedCompanies.reduce(
        (total, company) => total + company.enabledModules.length,
        0
      );

      return {
        totals: {
          companies: scopedCompanies.length,
          activeCompanies: scopedCompanies.filter((company) => company.status === "active").length,
          users: allUsers.length,
          activeUsers: allUsers.filter((user) => user.status === "active").length,
          enabledModules,
          auditEvents: latestAuditEvents.length
        },
        byArea,
        latestAuditEvents,
        focusCompany
      };
    },
    async getSystemReadiness(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      const settings = await repository.getSettings(companyId);

      if (!company || !settings) {
        throw notFound("PLATFORM_COMPANY_NOT_FOUND", "Company not found", {
          companyId
        });
      }

      const [
        users,
        modules,
        auditEvents,
        projects,
        fieldRequests,
        requisitions,
        machines,
        qualityInspections,
        documentItems
      ] = await Promise.all([
        repository.listUsers(companyId),
        repository.listModules(),
        repository.listAuditEvents(companyId, 20),
        repository.listProjects(companyId),
        repository.listFieldMaterialRequests(companyId),
        repository.listProcurementRequisitions(companyId),
        repository.listMachines(companyId),
        repository.listQualityInspections(companyId),
        repository.listDocumentControlItems(companyId)
      ]);

      const enabledOperationsModules = modules.filter(
        (module: (typeof modules)[number]) =>
          module.scope === "operations" && company.enabledModules.includes(module.key)
      );
      const activeUsers = users.filter((user: (typeof users)[number]) => user.status === "active");
      const satReady =
        settings.satEnabled &&
        settings.currency === "MXN" &&
        settings.locale.startsWith("es-MX") &&
        /^\d{3}$/.test(settings.fiscalRegime);
      const operationalDatasets = [
        projects.length,
        fieldRequests.length,
        requisitions.length,
        machines.length,
        qualityInspections.length,
        documentItems.length
      ];
      const populatedOperationalDatasets = operationalDatasets.filter((count) => count > 0).length;

      const checks = [
        {
          key: "identity",
          label: "Identity and access baseline",
          status: readinessStatusFromCount(activeUsers.length, 2),
          detail: `${activeUsers.length} active users and ${users.length} total users are configured for ${company.tradeName}.`,
          action:
            activeUsers.length >= 2
              ? "Identity baseline is covered for the current tenant."
              : "Add at least one more active user to avoid single-owner operational dependency."
        },
        {
          key: "fiscal",
          label: "Mexico fiscal and SAT posture",
          status: satReady ? "ready" : settings.satEnabled ? "warning" : "blocked",
          detail: satReady
            ? `SAT is enabled with ${settings.currency}, ${settings.locale} and fiscal regime ${settings.fiscalRegime}.`
            : `SAT posture is incomplete for ${settings.fiscalCountry}; current settings are ${settings.currency}, ${settings.locale} and regime ${settings.fiscalRegime}.`,
          action: satReady
            ? "Fiscal baseline is aligned for Mexico-first rollout."
            : "Complete SAT settings, confirm MXN and validate the 3-digit fiscal regime before finance rollout."
        },
        {
          key: "modules",
          label: "Operational modules activated",
          status: readinessStatusFromCount(enabledOperationsModules.length, 6, 3),
          detail: `${enabledOperationsModules.length} operations modules are enabled for this tenant.`,
          action:
            enabledOperationsModules.length >= 6
              ? "Module footprint is broad enough for a realistic end-to-end demo."
              : "Enable more operations modules so the tenant covers project, field, procurement, inventory and finance flows."
        },
        {
          key: "operations-data",
          label: "Operational data flows seeded",
          status: readinessStatusFromCount(populatedOperationalDatasets, 5, 2),
          detail: `${populatedOperationalDatasets} of 6 core operational datasets already contain live rows.`,
          action:
            populatedOperationalDatasets >= 5
              ? "Operational data coverage is strong enough for cross-domain walkthroughs."
              : "Seed or create more live operational records before running a full commercial demo."
        },
        {
          key: "audit",
          label: "Audit and activity trace",
          status: readinessStatusFromCount(auditEvents.length, 5, 1),
          detail: `${auditEvents.length} recent audit events are available for tenant traceability.`,
          action:
            auditEvents.length >= 5
              ? "Audit trail is already useful for admin and compliance walkthroughs."
              : "Generate more platform and operations activity so the audit trail reflects real tenant usage."
        }
      ];

      const readyChecks = checks.filter((check) => check.status === "ready").length;
      const warningChecks = checks.filter((check) => check.status === "warning").length;
      const blockedChecks = checks.filter((check) => check.status === "blocked").length;
      const score = Math.round(
        checks.reduce((sum, check) => sum + (check.status === "ready" ? 100 : check.status === "warning" ? 60 : 20), 0) /
          checks.length
      );

      return {
        companyId,
        summary: {
          score,
          readyChecks,
          warningChecks,
          blockedChecks
        },
        checks,
        recommendedActions: checks.filter((check) => check.status !== "ready").map((check) => check.action)
      };
    }
  };
}
