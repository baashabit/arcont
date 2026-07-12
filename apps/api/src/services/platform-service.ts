import type { PlatformRepository } from "../repositories/platform-repository.js";

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
      return (await repository.listUsers(companyId)).map(({ passwordHash: _passwordHash, ...user }) => user);
    },
    async getSettings(companyId: string) {
      return repository.getSettings(companyId);
    },
    async listCompanyModules(companyId: string) {
      const company = await repository.getCompanyById(companyId);
      if (!company) {
        return [];
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
        return undefined;
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
      const result = await repository.saveProvisionedCompany(input);

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
    }
  };
}
