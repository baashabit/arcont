import type { Pool, PoolClient } from "pg";
import {
  defaultRoles,
  moduleCatalog
} from "../../../../packages/contracts/dist/index.js";
import type {
  AuditEventInput,
  AuditEventRecord,
  AuthFailureReason,
  CompanyRecord,
  CreatePlatformUserInput,
  ProvisionCompanyInput,
  RefreshTokenRecord,
  SettingsRecord,
  UpdateCompanyModulesInput,
  UpdatePlatformSettingsInput,
  UpdatePlatformUserRoleInput,
  UpdatePlatformUserStatusInput,
  UserRecord
} from "../domain/platform/entities.js";
import { createPrefixedId } from "../lib/ids.js";
import { generateTemporaryPassword, hashPassword } from "../lib/passwords.js";

export type PlatformRepository = {
  listCompanies(): Promise<CompanyRecord[]>;
  listModules(): Promise<typeof moduleCatalog>;
  listRoles(): Promise<typeof defaultRoles>;
  listUsers(companyId?: string): Promise<UserRecord[]>;
  getCompanyById(companyId: string): Promise<CompanyRecord | undefined>;
  getUserById(userId: string): Promise<UserRecord | undefined>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  getRefreshTokenByHash(tokenHash: string): Promise<RefreshTokenRecord | undefined>;
  listRefreshTokensByUser(userId: string, companyId: string): Promise<RefreshTokenRecord[]>;
  companyTaxIdExists(taxId: string): Promise<boolean>;
  userEmailExists(email: string): Promise<boolean>;
  getSettings(companyId: string): Promise<SettingsRecord | undefined>;
  saveProvisionedCompany(input: ProvisionCompanyInput): Promise<{
    company: CompanyRecord;
    adminUser: UserRecord;
    settings: SettingsRecord;
    temporaryPassword: string;
  }>;
  saveRefreshToken(input: Omit<RefreshTokenRecord, "id" | "createdAt">): Promise<RefreshTokenRecord>;
  revokeRefreshToken(tokenHash: string): Promise<boolean>;
  revokeRefreshTokenById(tokenId: string, userId: string, companyId: string): Promise<boolean>;
  revokeRefreshTokens(userId: string, companyId: string): Promise<number>;
  recordAuthFailure(email: string, reason: AuthFailureReason, companyId?: string): Promise<void>;
  addAuditEvent(event: AuditEventInput): Promise<void>;
  updateSettings(input: UpdatePlatformSettingsInput): Promise<SettingsRecord>;
  replaceCompanyModules(input: UpdateCompanyModulesInput): Promise<CompanyRecord>;
  createUser(input: CreatePlatformUserInput): Promise<{
    user: UserRecord;
    temporaryPassword: string;
  }>;
  updateUserRole(input: UpdatePlatformUserRoleInput): Promise<UserRecord>;
  updateUserStatus(input: UpdatePlatformUserStatusInput): Promise<UserRecord>;
  listAuditEvents(companyId?: string, limit?: number): Promise<AuditEventRecord[]>;
};

function createSeedState() {
  const companies: CompanyRecord[] = [
    {
      id: "cmp_arcont_demo",
      legalName: "ARCONT Demo Constructora, S.A. de C.V.",
      tradeName: "ARCONT Demo",
      countryCode: "MX",
      taxId: "ADC240101AAA",
      status: "active",
      enabledModules: [
        "platform.companies",
        "platform.identity",
        "sales.crm",
        "projects.control",
        "procurement.purchasing",
        "inventory.warehouse",
        "finance.accounting"
      ]
    },
    {
      id: "cmp_bienestar_gov",
      legalName: "Infraestructura Bienestar del Sureste, S.A.P.I. de C.V.",
      tradeName: "Bienestar Sureste",
      countryCode: "MX",
      taxId: "IBS240101BBB",
      status: "active",
      enabledModules: [
        "platform.companies",
        "platform.identity",
        "projects.control",
        "procurement.purchasing",
        "inventory.warehouse",
        "hr.workforce",
        "integrations.field-data"
      ]
    }
  ];

  const users: UserRecord[] = [
    {
      id: "usr_platform_owner",
      companyId: "cmp_arcont_demo",
      fullName: "Angel Platform Owner",
      email: "admin@arcont.local",
      roleKey: "platform-owner",
      status: "active",
      passwordHash: hashPassword("password123")
    },
    {
      id: "usr_ops_manager",
      companyId: "cmp_bienestar_gov",
      fullName: "Daniel Obra",
      email: "obra@arcont.local",
      roleKey: "operations-manager",
      status: "active",
      passwordHash: hashPassword("password123")
    }
  ];

  const settings: SettingsRecord[] = [
    {
      companyId: "cmp_arcont_demo",
      timezone: "America/Merida",
      locale: "es-MX",
      currency: "MXN",
      fiscalCountry: "MX",
      satEnabled: true,
      fiscalRegime: "601"
    },
    {
      companyId: "cmp_bienestar_gov",
      timezone: "America/Mexico_City",
      locale: "es-MX",
      currency: "MXN",
      fiscalCountry: "MX",
      satEnabled: true,
      fiscalRegime: "603"
    }
  ];

  const refreshTokens: RefreshTokenRecord[] = [];
  const auditEvents: AuditEventRecord[] = [];

  return {
    companies,
    users,
    settings,
    refreshTokens,
    auditEvents
  };
}

export function createInMemoryPlatformRepository(): PlatformRepository {
  const state = createSeedState();

  return {
    async listCompanies() {
      return state.companies;
    },
    async listModules() {
      return moduleCatalog;
    },
    async listRoles() {
      return defaultRoles;
    },
    async listUsers(companyId?: string) {
      if (!companyId) {
        return state.users;
      }

      return state.users.filter((user) => user.companyId === companyId);
    },
    async getCompanyById(companyId: string) {
      return state.companies.find((company) => company.id === companyId);
    },
    async getUserByEmail(email: string) {
      return state.users.find((user) => user.email === email);
    },
    async getUserById(userId: string) {
      return state.users.find((user) => user.id === userId);
    },
    async getRefreshTokenByHash(tokenHash: string) {
      return state.refreshTokens.find((token) => token.tokenHash === tokenHash);
    },
    async listRefreshTokensByUser(userId: string, companyId: string) {
      return state.refreshTokens
        .filter((token) => token.userId === userId && token.companyId === companyId)
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async companyTaxIdExists(taxId: string) {
      return state.companies.some((company) => company.taxId.toLowerCase() === taxId.toLowerCase());
    },
    async userEmailExists(email: string) {
      return state.users.some((user) => user.email.toLowerCase() === email.toLowerCase());
    },
    async getSettings(companyId: string) {
      return state.settings.find((item) => item.companyId === companyId);
    },
    async saveProvisionedCompany(input: ProvisionCompanyInput) {
      const company: CompanyRecord = {
        id: createPrefixedId("cmp"),
        legalName: input.legalName,
        tradeName: input.tradeName,
        countryCode: input.countryCode,
        taxId: input.taxId,
        status: "active",
        enabledModules: Array.from(new Set(input.enabledModules))
      };

      const temporaryPassword = generateTemporaryPassword();
      const adminUser: UserRecord = {
        id: createPrefixedId("usr"),
        companyId: company.id,
        fullName: input.adminFullName,
        email: input.adminEmail,
        roleKey: "company-admin",
        status: "active",
        passwordHash: hashPassword(temporaryPassword)
      };

      const settings: SettingsRecord = {
        companyId: company.id,
        timezone: input.timezone,
        locale: input.locale,
        currency: input.currency,
        fiscalCountry: input.fiscalCountry,
        satEnabled: input.fiscalCountry === "MX",
        fiscalRegime: input.fiscalRegime
      };

      state.companies.push(company);
      state.users.push(adminUser);
      state.settings.push(settings);

      await this.addAuditEvent({
        companyId: company.id,
        actorUserId: adminUser.id,
        aggregateType: "company",
        aggregateId: company.id,
        action: "platform.company.provisioned",
        metadata: {
          enabledModules: company.enabledModules
        }
      });

      return {
        company,
        adminUser,
        settings,
        temporaryPassword
      };
    },
    async saveRefreshToken(input) {
      const record: RefreshTokenRecord = {
        id: createPrefixedId("rtk"),
        createdAt: new Date().toISOString(),
        ...input
      };

      state.refreshTokens.push(record);
      return record;
    },
    async revokeRefreshToken(tokenHash: string) {
      const token = state.refreshTokens.find((item) => item.tokenHash === tokenHash && !item.revokedAt);
      if (!token) {
        return false;
      }

      token.revokedAt = new Date().toISOString();
      return true;
    },
    async revokeRefreshTokenById(tokenId: string, userId: string, companyId: string) {
      const token = state.refreshTokens.find(
        (item) =>
          item.id === tokenId &&
          item.userId === userId &&
          item.companyId === companyId &&
          !item.revokedAt
      );

      if (!token) {
        return false;
      }

      token.revokedAt = new Date().toISOString();
      return true;
    },
    async revokeRefreshTokens(userId: string, companyId: string) {
      let revoked = 0;

      for (const token of state.refreshTokens) {
        if (token.userId === userId && token.companyId === companyId && !token.revokedAt) {
          token.revokedAt = new Date().toISOString();
          revoked += 1;
        }
      }

      return revoked;
    },
    async recordAuthFailure(email: string, reason: AuthFailureReason, companyId?: string) {
      await this.addAuditEvent({
        companyId,
        aggregateType: "session",
        aggregateId: email,
        action: "auth.login.failed",
        metadata: {
          email,
          reason
        }
      });
    },
    async addAuditEvent(event) {
      state.auditEvents.push({
        id: createPrefixedId("aud"),
        companyId: event.companyId ?? null,
        actorUserId: event.actorUserId ?? null,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        action: event.action,
        metadata: event.metadata,
        createdAt: new Date().toISOString()
      });
    },
    async updateSettings(input) {
      const current = state.settings.find((item) => item.companyId === input.companyId);
      if (!current) {
        throw new Error("Settings not found in repository");
      }

      current.timezone = input.timezone;
      current.locale = input.locale;
      current.currency = input.currency;
      current.fiscalCountry = input.fiscalCountry;
      current.satEnabled = input.satEnabled;
      current.fiscalRegime = input.fiscalRegime;

      return current;
    },
    async replaceCompanyModules(input) {
      const company = state.companies.find((item) => item.id === input.companyId);
      if (!company) {
        throw new Error("Company not found in repository");
      }

      company.enabledModules = Array.from(new Set(input.enabledModules));
      return company;
    },
    async createUser(input) {
      const temporaryPassword = generateTemporaryPassword();
      const user: UserRecord = {
        id: createPrefixedId("usr"),
        companyId: input.companyId,
        fullName: input.fullName,
        email: input.email,
        roleKey: input.roleKey,
        status: input.status,
        passwordHash: hashPassword(temporaryPassword)
      };

      state.users.push(user);

      return {
        user,
        temporaryPassword
      };
    },
    async updateUserRole(input) {
      const user = state.users.find((item) => item.id === input.userId);
      if (!user) {
        throw new Error("User not found in repository");
      }

      user.roleKey = input.roleKey;
      return user;
    },
    async updateUserStatus(input) {
      const user = state.users.find((item) => item.id === input.userId);
      if (!user) {
        throw new Error("User not found in repository");
      }

      user.status = input.status;
      return user;
    },
    async listAuditEvents(companyId?: string, limit = 50) {
      const items = companyId
        ? state.auditEvents.filter((event) => event.companyId === companyId)
        : state.auditEvents;

      return items.slice().reverse().slice(0, limit);
    }
  };
}

function mapCompanyRow(row: Record<string, string | string[]>) {
  return {
    id: String(row.id),
    legalName: String(row.legal_name),
    tradeName: String(row.trade_name),
    countryCode: String(row.country_code),
    taxId: String(row.tax_id),
    status: row.status as CompanyRecord["status"],
    enabledModules: (row.enabled_modules as string[]) ?? []
  };
}

function mapUserRow(row: Record<string, string>) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    fullName: String(row.full_name),
    email: String(row.email),
    roleKey: String(row.role_key),
    status: row.status as UserRecord["status"],
    passwordHash: String(row.password_hash)
  };
}

function mapSettingsRow(row: Record<string, string | boolean>) {
  return {
    companyId: String(row.company_id),
    timezone: String(row.timezone),
    locale: String(row.locale),
    currency: String(row.currency),
    fiscalCountry: String(row.fiscal_country),
    satEnabled: Boolean(row.sat_enabled),
    fiscalRegime: String(row.fiscal_regime)
  };
}

function mapAuditEventRow(row: Record<string, unknown>): AuditEventRecord {
  return {
    id: String(row.id),
    companyId: row.company_id ? String(row.company_id) : null,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    aggregateType: String(row.aggregate_type),
    aggregateId: String(row.aggregate_id),
    action: String(row.action),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at)
  };
}

async function seedCatalogs(client: PoolClient) {
  for (const module of moduleCatalog) {
    await client.query(
      `
        insert into platform_modules (module_key, name, area, scope, description, enabled_by_default)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (module_key) do update
          set name = excluded.name,
              area = excluded.area,
              scope = excluded.scope,
              description = excluded.description,
              enabled_by_default = excluded.enabled_by_default
      `,
      [module.key, module.name, module.area, module.scope, module.description, module.enabledByDefault]
    );
  }

  for (const role of defaultRoles) {
    await client.query(
      `
        insert into platform_roles (role_key, name, scope)
        values ($1, $2, $3)
        on conflict (role_key) do update
          set name = excluded.name,
              scope = excluded.scope
      `,
      [role.key, role.name, role.scope]
    );

    await client.query("delete from platform_role_permissions where role_key = $1", [role.key]);

    for (const permission of role.permissions) {
      await client.query(
        `
          insert into platform_role_permissions (role_key, permission_key)
          values ($1, $2)
          on conflict do nothing
        `,
        [role.key, permission]
      );
    }
  }
}

export function createPostgresPlatformRepository(pool: Pool): PlatformRepository {
  return {
    async listCompanies() {
      const result = await pool.query(
        `
          select
            c.id,
            c.legal_name,
            c.trade_name,
            c.country_code,
            c.tax_id,
            c.status,
            coalesce(array_agg(cm.module_key order by cm.module_key) filter (where cm.enabled), '{}') as enabled_modules
          from platform_companies c
          left join platform_company_modules cm on cm.company_id = c.id
          where c.deleted_at is null
          group by c.id, c.legal_name, c.trade_name, c.country_code, c.tax_id, c.status
          order by c.trade_name
        `
      );

      return result.rows.map(mapCompanyRow);
    },
    async listModules() {
      return moduleCatalog;
    },
    async listRoles() {
      return defaultRoles;
    },
    async listUsers(companyId?: string) {
      const result = companyId
        ? await pool.query(
            `
              select id, company_id, full_name, email, role_key, status, password_hash
              from platform_users
              where deleted_at is null and company_id = $1
              order by full_name
            `,
            [companyId]
          )
        : await pool.query(
            `
              select id, company_id, full_name, email, role_key, status, password_hash
              from platform_users
              where deleted_at is null
              order by full_name
            `
          );

      return result.rows.map(mapUserRow);
    },
    async getCompanyById(companyId: string) {
      const result = await pool.query(
        `
          select
            c.id,
            c.legal_name,
            c.trade_name,
            c.country_code,
            c.tax_id,
            c.status,
            coalesce(array_agg(cm.module_key order by cm.module_key) filter (where cm.enabled), '{}') as enabled_modules
          from platform_companies c
          left join platform_company_modules cm on cm.company_id = c.id
          where c.id = $1 and c.deleted_at is null
          group by c.id, c.legal_name, c.trade_name, c.country_code, c.tax_id, c.status
        `,
        [companyId]
      );

      return result.rows[0] ? mapCompanyRow(result.rows[0]) : undefined;
    },
    async getUserByEmail(email: string) {
      const result = await pool.query(
        `
          select id, company_id, full_name, email, role_key, status, password_hash
          from platform_users
          where email = $1 and deleted_at is null
          limit 1
        `,
        [email]
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : undefined;
    },
    async getUserById(userId: string) {
      const result = await pool.query(
        `
          select id, company_id, full_name, email, role_key, status, password_hash
          from platform_users
          where id = $1 and deleted_at is null
          limit 1
        `,
        [userId]
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : undefined;
    },
    async getRefreshTokenByHash(tokenHash: string) {
      const result = await pool.query(
        `
          select id, user_id, company_id, token_hash, expires_at, created_at, revoked_at
          from auth_refresh_tokens
          where token_hash = $1
          limit 1
        `,
        [tokenHash]
      );

      const row = result.rows[0];
      if (!row) {
        return undefined;
      }

      return {
        id: String(row.id),
        userId: String(row.user_id),
        companyId: String(row.company_id),
        tokenHash: String(row.token_hash),
        expiresAt: String(row.expires_at),
        createdAt: String(row.created_at),
        revokedAt: row.revoked_at ? String(row.revoked_at) : undefined
      };
    },
    async listRefreshTokensByUser(userId: string, companyId: string) {
      const result = await pool.query(
        `
          select id, user_id, company_id, token_hash, expires_at, created_at, revoked_at
          from auth_refresh_tokens
          where user_id = $1 and company_id = $2
          order by created_at desc
        `,
        [userId, companyId]
      );

      return result.rows.map((row) => ({
        id: String(row.id),
        userId: String(row.user_id),
        companyId: String(row.company_id),
        tokenHash: String(row.token_hash),
        expiresAt: String(row.expires_at),
        createdAt: String(row.created_at),
        revokedAt: row.revoked_at ? String(row.revoked_at) : undefined
      }));
    },
    async companyTaxIdExists(taxId: string) {
      const result = await pool.query(
        `
          select 1
          from platform_companies
          where lower(tax_id) = lower($1) and deleted_at is null
          limit 1
        `,
        [taxId]
      );

      return Boolean(result.rowCount);
    },
    async userEmailExists(email: string) {
      const result = await pool.query(
        `
          select 1
          from platform_users
          where lower(email) = lower($1) and deleted_at is null
          limit 1
        `,
        [email]
      );

      return Boolean(result.rowCount);
    },
    async getSettings(companyId: string) {
      const result = await pool.query(
        `
          select company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime
          from platform_company_settings
          where company_id = $1
          limit 1
        `,
        [companyId]
      );

      return result.rows[0] ? mapSettingsRow(result.rows[0]) : undefined;
    },
    async saveProvisionedCompany(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        await seedCatalogs(client);

        const company: CompanyRecord = {
          id: createPrefixedId("cmp"),
          legalName: input.legalName,
          tradeName: input.tradeName,
          countryCode: input.countryCode,
          taxId: input.taxId,
          status: "active",
          enabledModules: Array.from(new Set(input.enabledModules))
        };

        const temporaryPassword = generateTemporaryPassword();
        const adminUser: UserRecord = {
          id: createPrefixedId("usr"),
          companyId: company.id,
          fullName: input.adminFullName,
          email: input.adminEmail,
          roleKey: "company-admin",
          status: "active",
          passwordHash: hashPassword(temporaryPassword)
        };

        const settings: SettingsRecord = {
          companyId: company.id,
          timezone: input.timezone,
          locale: input.locale,
          currency: input.currency,
          fiscalCountry: input.fiscalCountry,
          satEnabled: input.fiscalCountry === "MX",
          fiscalRegime: input.fiscalRegime
        };

        await client.query(
          `
            insert into platform_companies
              (id, external_key, legal_name, trade_name, country_code, tax_id, status)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [company.id, company.id, company.legalName, company.tradeName, company.countryCode, company.taxId, company.status]
        );

        await client.query(
          `
            insert into platform_users
              (id, company_id, full_name, email, role_key, status, password_hash)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            adminUser.id,
            adminUser.companyId,
            adminUser.fullName,
            adminUser.email,
            adminUser.roleKey,
            adminUser.status,
            adminUser.passwordHash
          ]
        );

        await client.query(
          `
            insert into platform_company_settings
              (company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            settings.companyId,
            settings.timezone,
            settings.locale,
            settings.currency,
            settings.fiscalCountry,
            settings.satEnabled,
            settings.fiscalRegime
          ]
        );

        for (const moduleKey of company.enabledModules) {
          await client.query(
            `
              insert into platform_company_modules
                (company_id, module_key, enabled, activated_by)
              values ($1, $2, true, $3)
              on conflict (company_id, module_key) do update
                set enabled = excluded.enabled,
                    activated_by = excluded.activated_by
            `,
            [company.id, moduleKey, adminUser.id]
          );
        }

        await client.query(
          `
            insert into audit_events
              (id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata)
            values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
          [
            createPrefixedId("aud"),
            company.id,
            adminUser.id,
            "company",
            company.id,
            "platform.company.provisioned",
            JSON.stringify({ enabledModules: company.enabledModules })
          ]
        );

        await client.query("commit");

        return {
          company,
          adminUser,
          settings,
          temporaryPassword
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async saveRefreshToken(input) {
      const record: RefreshTokenRecord = {
        id: createPrefixedId("rtk"),
        createdAt: new Date().toISOString(),
        ...input
      };

      await pool.query(
        `
          insert into auth_refresh_tokens
            (id, user_id, company_id, token_hash, expires_at, created_at, revoked_at)
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          record.id,
          record.userId,
          record.companyId,
          record.tokenHash,
          record.expiresAt,
          record.createdAt,
          record.revokedAt ?? null
        ]
      );

      return record;
    },
    async revokeRefreshToken(tokenHash: string) {
      const result = await pool.query(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where token_hash = $1 and revoked_at is null
        `,
        [tokenHash]
      );

      return (result.rowCount ?? 0) > 0;
    },
    async revokeRefreshTokenById(tokenId: string, userId: string, companyId: string) {
      const result = await pool.query(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where id = $1 and user_id = $2 and company_id = $3 and revoked_at is null
        `,
        [tokenId, userId, companyId]
      );

      return (result.rowCount ?? 0) > 0;
    },
    async revokeRefreshTokens(userId: string, companyId: string) {
      const result = await pool.query(
        `
          update auth_refresh_tokens
          set revoked_at = now()
          where user_id = $1 and company_id = $2 and revoked_at is null
        `,
        [userId, companyId]
      );

      return result.rowCount ?? 0;
    },
    async recordAuthFailure(email: string, reason: AuthFailureReason, companyId?: string) {
      await this.addAuditEvent({
        companyId,
        aggregateType: "session",
        aggregateId: email,
        action: "auth.login.failed",
        metadata: {
          email,
          reason
        }
      });
    },
    async addAuditEvent(event) {
      await pool.query(
        `
          insert into audit_events
            (id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          createPrefixedId("aud"),
          event.companyId ?? null,
          event.actorUserId ?? null,
          event.aggregateType,
          event.aggregateId,
          event.action,
          JSON.stringify(event.metadata)
        ]
      );
    },
    async updateSettings(input) {
      const result = await pool.query(
        `
          update platform_company_settings
          set timezone = $2,
              locale = $3,
              currency = $4,
              fiscal_country = $5,
              sat_enabled = $6,
              fiscal_regime = $7,
              updated_at = now()
          where company_id = $1
          returning company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime
        `,
        [
          input.companyId,
          input.timezone,
          input.locale,
          input.currency,
          input.fiscalCountry,
          input.satEnabled,
          input.fiscalRegime
        ]
      );

      if (!result.rows[0]) {
        throw new Error("Settings not found in repository");
      }

      return mapSettingsRow(result.rows[0]);
    },
    async replaceCompanyModules(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        await seedCatalogs(client);

        const company = await this.getCompanyById(input.companyId);
        if (!company) {
          throw new Error("Company not found in repository");
        }

        await client.query("delete from platform_company_modules where company_id = $1", [input.companyId]);

        for (const moduleKey of input.enabledModules) {
          await client.query(
            `
              insert into platform_company_modules
                (company_id, module_key, enabled, activated_by)
              values ($1, $2, true, $3)
            `,
            [input.companyId, moduleKey, input.actorUserId ?? null]
          );
        }

        await client.query("commit");

        return {
          ...company,
          enabledModules: Array.from(new Set(input.enabledModules))
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async createUser(input) {
      const temporaryPassword = generateTemporaryPassword();
      const user: UserRecord = {
        id: createPrefixedId("usr"),
        companyId: input.companyId,
        fullName: input.fullName,
        email: input.email,
        roleKey: input.roleKey,
        status: input.status,
        passwordHash: hashPassword(temporaryPassword)
      };

      await pool.query(
        `
          insert into platform_users
            (id, company_id, full_name, email, role_key, status, password_hash)
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          user.id,
          user.companyId,
          user.fullName,
          user.email,
          user.roleKey,
          user.status,
          user.passwordHash
        ]
      );

      return {
        user,
        temporaryPassword
      };
    },
    async updateUserRole(input) {
      const result = await pool.query(
        `
          update platform_users
          set role_key = $2,
              updated_at = now()
          where id = $1 and deleted_at is null
          returning id, company_id, full_name, email, role_key, status, password_hash
        `,
        [input.userId, input.roleKey]
      );

      if (!result.rows[0]) {
        throw new Error("User not found in repository");
      }

      return mapUserRow(result.rows[0]);
    },
    async updateUserStatus(input) {
      const result = await pool.query(
        `
          update platform_users
          set status = $2,
              updated_at = now()
          where id = $1 and deleted_at is null
          returning id, company_id, full_name, email, role_key, status, password_hash
        `,
        [input.userId, input.status]
      );

      if (!result.rows[0]) {
        throw new Error("User not found in repository");
      }

      return mapUserRow(result.rows[0]);
    },
    async listAuditEvents(companyId?: string, limit = 50) {
      const result = companyId
        ? await pool.query(
            `
              select id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata, created_at
              from audit_events
              where company_id = $1
              order by created_at desc
              limit $2
            `,
            [companyId, limit]
          )
        : await pool.query(
            `
              select id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata, created_at
              from audit_events
              order by created_at desc
              limit $1
            `,
            [limit]
          );

      return result.rows.map(mapAuditEventRow);
    }
  };
}
