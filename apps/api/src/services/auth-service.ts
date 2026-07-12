import { env } from "../config/env.js";
import { signJwt } from "../lib/jwt.js";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import type { PlatformRepository } from "../repositories/platform-repository.js";

export function createAuthService(repository: PlatformRepository) {
  return {
    async login(email: string, password: string, companyId?: string) {
      const user = await repository.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return undefined;
      }

      const company =
        (companyId ? await repository.getCompanyById(companyId) : undefined) ??
        (await repository.getCompanyById(user.companyId));

      if (!company) {
        return undefined;
      }

      const role = (await repository.listRoles()).find((item) => item.key === user.roleKey);
      const permissions = role?.permissions ?? [];
      const expiresInSeconds = env.ARCONT_AUTH_ACCESS_TTL_SECONDS;
      const refreshToken = `refresh-${user.id}-${Date.now()}`;

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
