import { env } from "../config/env.js";
import { authError, forbiddenError } from "../lib/domain-error.js";
import { signJwt, verifyJwt } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

function buildSessionPayload(
  user: {
    id: string;
    companyId: string;
    fullName: string;
    email: string;
    roleKey: string;
    status: "invited" | "active" | "disabled";
  },
  company: {
    id: string;
    legalName: string;
    tradeName: string;
    countryCode: string;
    taxId: string;
    status: "draft" | "active" | "suspended";
    enabledModules: string[];
  },
  permissions: string[]
) {
  return {
    company,
    user: {
      id: user.id,
      companyId: user.companyId,
      fullName: user.fullName,
      email: user.email,
      roleKey: user.roleKey,
      status: user.status
    },
    permissions
  };
}

function createRefreshToken(userId: string) {
  return `refresh-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function matchesPermission(grantedPermission: string, requiredPermission: string) {
  if (grantedPermission === "platform:*") {
    return true;
  }

  if (grantedPermission === requiredPermission) {
    return true;
  }

  if (grantedPermission.endsWith("*")) {
    const prefix = grantedPermission.slice(0, -1);
    return requiredPermission.startsWith(prefix);
  }

  return false;
}

export function createAuthService(repository: PlatformRepository) {
  return {
    async login(email: string, password: string, companyId?: string) {
      const user = await repository.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        await repository.recordAuthFailure(email, "invalid_credentials", companyId);
        throw authError("AUTH_INVALID_CREDENTIALS", "Invalid credentials");
      }

      if (user.status !== "active") {
        await repository.recordAuthFailure(email, "user_disabled", companyId ?? user.companyId);
        throw authError("AUTH_USER_DISABLED", "User is not active");
      }

      if (companyId && companyId !== user.companyId) {
        await repository.recordAuthFailure(email, "company_user_mismatch", companyId);
        throw authError("AUTH_COMPANY_USER_MISMATCH", "User does not belong to the requested company");
      }

      const company = await repository.getCompanyById(companyId ?? user.companyId);

      if (!company) {
        await repository.recordAuthFailure(email, "company_not_found", companyId ?? user.companyId);
        throw authError("AUTH_COMPANY_NOT_FOUND", "Company not found for user");
      }

      const role = (await repository.listRoles()).find((item) => item.key === user.roleKey);
      const permissions = role?.permissions ?? [];
      const expiresInSeconds = env.ARCONT_AUTH_ACCESS_TTL_SECONDS;
      const refreshToken = createRefreshToken(user.id);

      await repository.revokeRefreshTokens(user.id, company.id);
      await repository.saveRefreshToken({
        userId: user.id,
        companyId: company.id,
        tokenHash: hashPassword(refreshToken),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000 * 24).toISOString(),
        revokedAt: undefined
      });

      await repository.addAuditEvent({
        companyId: company.id,
        actorUserId: user.id,
        aggregateType: "session",
        aggregateId: user.id,
        action: "auth.login.succeeded",
        metadata: {
          email: user.email
        }
      });

      return {
        accessToken: signJwt(
          {
            sub: user.id,
            email: user.email,
            companyId: company.id,
            roleKey: user.roleKey,
            permissions
          },
          env.ARCONT_AUTH_JWT_SECRET,
          expiresInSeconds
        ),
        refreshToken,
        tokenType: "Bearer" as const,
        expiresInSeconds,
        ...buildSessionPayload(user, company, permissions)
      };
    },
    async refresh(refreshToken: string) {
      const tokenHash = hashPassword(refreshToken);
      const storedToken = await repository.getRefreshTokenByHash(tokenHash);

      if (!storedToken || storedToken.revokedAt) {
        throw authError("AUTH_REFRESH_INVALID", "Refresh token is invalid");
      }

      if (new Date(storedToken.expiresAt).getTime() <= Date.now()) {
        await repository.revokeRefreshToken(tokenHash);
        throw authError("AUTH_REFRESH_EXPIRED", "Refresh token expired");
      }

      const user = await repository.getUserById(storedToken.userId);
      if (!user || user.status !== "active") {
        await repository.revokeRefreshToken(tokenHash);
        throw authError("AUTH_USER_DISABLED", "User is not active");
      }

      const company = await repository.getCompanyById(storedToken.companyId);
      if (!company) {
        await repository.revokeRefreshToken(tokenHash);
        throw authError("AUTH_COMPANY_NOT_FOUND", "Company not found for user");
      }

      const role = (await repository.listRoles()).find((item) => item.key === user.roleKey);
      const permissions = role?.permissions ?? [];
      const expiresInSeconds = env.ARCONT_AUTH_ACCESS_TTL_SECONDS;
      const nextRefreshToken = createRefreshToken(user.id);

      await repository.revokeRefreshToken(tokenHash);
      await repository.saveRefreshToken({
        userId: user.id,
        companyId: company.id,
        tokenHash: hashPassword(nextRefreshToken),
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000 * 24).toISOString(),
        revokedAt: undefined
      });

      await repository.addAuditEvent({
        companyId: company.id,
        actorUserId: user.id,
        aggregateType: "session",
        aggregateId: user.id,
        action: "auth.refresh.succeeded",
        metadata: {
          email: user.email
        }
      });

      return {
        accessToken: signJwt(
          {
            sub: user.id,
            email: user.email,
            companyId: company.id,
            roleKey: user.roleKey,
            permissions
          },
          env.ARCONT_AUTH_JWT_SECRET,
          expiresInSeconds
        ),
        refreshToken: nextRefreshToken,
        tokenType: "Bearer" as const,
        expiresInSeconds,
        ...buildSessionPayload(user, company, permissions)
      };
    },
    async getCurrentSession(accessToken: string) {
      const payload = verifyJwt(accessToken, env.ARCONT_AUTH_JWT_SECRET);
      const userId = typeof payload.sub === "string" ? payload.sub : "";
      const companyId = typeof payload.companyId === "string" ? payload.companyId : "";

      if (!userId || !companyId) {
        throw authError("AUTH_INVALID_TOKEN", "Invalid access token");
      }

      const user = await repository.getUserById(userId);
      if (!user || user.status !== "active") {
        throw authError("AUTH_USER_DISABLED", "User is not active");
      }

      const company = await repository.getCompanyById(companyId);
      if (!company) {
        throw authError("AUTH_COMPANY_NOT_FOUND", "Company not found for user");
      }

      const role = (await repository.listRoles()).find((item) => item.key === user.roleKey);
      if (!role) {
        throw authError("AUTH_ROLE_NOT_FOUND", "Role not found for user");
      }

      return {
        ...buildSessionPayload(user, company, role.permissions),
        role
      };
    },
    async authorize(
      accessToken: string,
      input?: {
        requiredPermissions?: string[];
        companyId?: string;
        platformOnly?: boolean;
      }
    ) {
      const session = await this.getCurrentSession(accessToken);
      const requiredPermissions = input?.requiredPermissions ?? [];

      if (input?.platformOnly && session.role.scope !== "platform") {
        throw forbiddenError("AUTH_PLATFORM_SCOPE_REQUIRED", "Platform scope is required", {
          companyId: session.company.id,
          roleKey: session.role.key
        });
      }

      if (input?.companyId && session.role.scope !== "platform" && session.company.id !== input.companyId) {
        throw forbiddenError("AUTH_COMPANY_SCOPE_FORBIDDEN", "Session cannot access the requested company", {
          sessionCompanyId: session.company.id,
          requestedCompanyId: input.companyId
        });
      }

      if (
        requiredPermissions.length > 0 &&
        !requiredPermissions.some((requiredPermission) =>
          session.permissions.some((grantedPermission) =>
            matchesPermission(grantedPermission, requiredPermission)
          )
        )
      ) {
        throw forbiddenError("AUTH_PERMISSION_DENIED", "Session lacks required permission", {
          requiredPermissions,
          grantedPermissions: session.permissions
        });
      }

      return session;
    },
    async logout(accessToken?: string, refreshToken?: string) {
      if (!accessToken && !refreshToken) {
        throw authError("AUTH_LOGOUT_CONTEXT_REQUIRED", "Access token or refresh token is required");
      }

      if (accessToken) {
        const payload = verifyJwt(accessToken, env.ARCONT_AUTH_JWT_SECRET);
        const userId = typeof payload.sub === "string" ? payload.sub : "";
        const companyId = typeof payload.companyId === "string" ? payload.companyId : "";

        if (!userId || !companyId) {
          throw authError("AUTH_INVALID_TOKEN", "Invalid access token");
        }

        const revokedTokens = await repository.revokeRefreshTokens(userId, companyId);

        await repository.addAuditEvent({
          companyId,
          actorUserId: userId,
          aggregateType: "session",
          aggregateId: userId,
          action: "auth.logout.succeeded",
          metadata: {
            revokedTokens
          }
        });

        return {
          revokedTokens
        };
      }

      const tokenHash = hashPassword(refreshToken!);
      const storedToken = await repository.getRefreshTokenByHash(tokenHash);
      if (!storedToken) {
        return {
          revokedTokens: 0
        };
      }

      const revoked = await repository.revokeRefreshToken(tokenHash);

      await repository.addAuditEvent({
        companyId: storedToken.companyId,
        actorUserId: storedToken.userId,
        aggregateType: "session",
        aggregateId: storedToken.userId,
        action: "auth.logout.succeeded",
        metadata: {
          revokedTokens: revoked ? 1 : 0
        }
      });

      return {
        revokedTokens: revoked ? 1 : 0
      };
    },
    async listSessions(accessToken: string, currentRefreshToken?: string) {
      const session = await this.getCurrentSession(accessToken);
      const currentRefreshHash = currentRefreshToken ? hashPassword(currentRefreshToken) : null;
      const items = await repository.listRefreshTokensByUser(session.user.id, session.company.id);

      return {
        items: items.map((item) => ({
          id: item.id,
          companyId: item.companyId,
          createdAt: item.createdAt,
          expiresAt: item.expiresAt,
          revokedAt: item.revokedAt ?? null,
          current: currentRefreshHash ? item.tokenHash === currentRefreshHash : false
        }))
      };
    },
    async revokeSession(accessToken: string, sessionId: string) {
      const session = await this.getCurrentSession(accessToken);
      const revoked = await repository.revokeRefreshTokenById(
        sessionId,
        session.user.id,
        session.company.id
      );

      await repository.addAuditEvent({
        companyId: session.company.id,
        actorUserId: session.user.id,
        aggregateType: "session",
        aggregateId: sessionId,
        action: "auth.session.revoked",
        metadata: {
          revoked
        }
      });

      return {
        revokedTokens: revoked ? 1 : 0
      };
    }
  };
}
