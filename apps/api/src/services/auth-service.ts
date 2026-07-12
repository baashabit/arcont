import { env } from "../config/env.js";
import { authError } from "../lib/domain-error.js";
import { signJwt } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

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
      const refreshToken = `refresh-${user.id}-${Date.now()}`;

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
  };
}
