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
    }
  };
}
