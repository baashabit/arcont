export type CompanyRecord = {
  id: string;
  legalName: string;
  tradeName: string;
  countryCode: string;
  taxId: string;
  status: "draft" | "active" | "suspended";
  enabledModules: string[];
};

export type UserRecord = {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  roleKey: string;
  status: "invited" | "active" | "disabled";
  passwordHash: string;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  companyId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
};

export type AuditEventRecord = {
  id: string;
  companyId: string | null;
  actorUserId: string | null;
  aggregateType: string;
  aggregateId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type SettingsRecord = {
  companyId: string;
  timezone: string;
  locale: string;
  currency: string;
  fiscalCountry: string;
  satEnabled: boolean;
  fiscalRegime: string;
};

export type ProvisionCompanyInput = {
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
};

export type AuditEventInput = {
  companyId?: string;
  actorUserId?: string;
  aggregateType: string;
  aggregateId: string;
  action: string;
  metadata: Record<string, unknown>;
};

export type UpdatePlatformSettingsInput = {
  companyId: string;
  timezone: string;
  locale: string;
  currency: string;
  fiscalCountry: string;
  satEnabled: boolean;
  fiscalRegime: string;
};

export type UpdateCompanyModulesInput = {
  companyId: string;
  enabledModules: string[];
  actorUserId?: string;
};

export type CreatePlatformUserInput = {
  companyId: string;
  fullName: string;
  email: string;
  roleKey: string;
  status: UserRecord["status"];
};

export type UpdatePlatformUserRoleInput = {
  userId: string;
  roleKey: string;
};

export type UpdatePlatformUserStatusInput = {
  userId: string;
  status: UserRecord["status"];
};

export type AuthFailureReason =
  | "invalid_credentials"
  | "company_not_found"
  | "company_user_mismatch"
  | "user_disabled";
