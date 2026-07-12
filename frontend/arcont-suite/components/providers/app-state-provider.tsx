"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  AuthSessionSchema,
  PlatformBootstrapSchema,
  type AuthLoginRequestContract,
  type AuthSessionContract,
  type CompanyContract,
  type CompanyModuleStateContract,
  type ModuleContract,
  type RoleContract,
  type UserContract
} from "@/lib/contracts";
import {
  authSessionToAppSession,
  bootstrapToPartialAppData,
  buildMockData,
  getMockSession,
  type AppData,
  type AppSession
} from "@/lib/app-data";

type SignInResult = {
  ok: boolean;
  source: "api" | "mock";
  error?: string;
};

type AppStateContextValue = AppData & {
  activeCompany: CompanyContract;
  activeSettings: AppData["settings"][string] | undefined;
  activeUsers: UserContract[];
  activeRole: RoleContract | undefined;
  isHydratingSession: boolean;
  setActiveCompanyId: (companyId: string) => void;
  signIn: (credentials: AuthLoginRequestContract) => Promise<SignInResult>;
  signOut: () => void;
  isModuleEnabled: (moduleKeys?: string[]) => boolean;
  canAccess: (requiredPermissions?: string[]) => boolean;
  isRouteVisible: (input?: { moduleKeys?: string[]; requiredPermissions?: string[] }) => boolean;
  getModuleByKey: (key: string) => ModuleContract | undefined;
  getCompanyModules: (companyId?: string) => CompanyModuleStateContract[];
};

const AppStateContext = createContext<AppStateContextValue | null>(null);
const companyStorageKey = "arcont.activeCompanyId";
const sessionStorageKey = "arcont.session";

function mergeUniqueCompanies(current: CompanyContract[], next: CompanyContract) {
  return [...current.filter((company) => company.id !== next.id), next];
}

function mergeUsersByCompany(current: UserContract[], next: UserContract[], companyId: string) {
  return [...current.filter((user) => user.companyId !== companyId), ...next];
}

function matchesPermission(grantedPermission: string, requiredPermission: string) {
  if (grantedPermission === requiredPermission) {
    return true;
  }

  if (grantedPermission.endsWith("*")) {
    const prefix = grantedPermission.slice(0, -1);
    return requiredPermission.startsWith(prefix);
  }

  return false;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function AppStateProvider({
  children,
  initialData
}: {
  children: React.ReactNode;
  initialData: AppData;
}) {
  const [data, setData] = useState(initialData);
  const [session, setSession] = useState<AppSession>(initialData.session);
  const [activeCompanyId, setActiveCompanyIdState] = useState(initialData.session.companyId);
  const [isHydratingSession, setHydratingSession] = useState(false);

  const hydrateFromBootstrap = useCallback(
    async (companyId: string, userEmail: string, baseSession?: AppSession) => {
      setHydratingSession(true);

      try {
        const response = await requestJson(
          `${data.apiBaseUrl}/platform/bootstrap/${companyId}?userEmail=${encodeURIComponent(userEmail)}`
        );

        if (!response) {
          return false;
        }

        const bootstrap = PlatformBootstrapSchema.parse(response);
        const partial = bootstrapToPartialAppData(bootstrap);
        const nextSession: AppSession = {
          ...(baseSession ?? session),
          authenticated: (baseSession ?? session).authenticated,
          companyId: partial.session.companyId,
          user: partial.session.user,
          permissions: partial.session.permissions
        };

        setData((current) => ({
          ...current,
          source: "api",
          companies: mergeUniqueCompanies(current.companies, partial.company),
          modules: partial.modules,
          roles: partial.roles,
          users: mergeUsersByCompany(current.users, partial.users, partial.company.id),
          settings: {
            ...current.settings,
            [partial.company.id]: partial.settings
          },
          companyModules: {
            ...current.companyModules,
            [partial.company.id]: partial.companyModules
          },
          session: nextSession
        }));
        setSession(nextSession);
        setActiveCompanyIdState(partial.company.id);
        window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
        window.localStorage.setItem(companyStorageKey, partial.company.id);

        return true;
      } finally {
        setHydratingSession(false);
      }
    },
    [data.apiBaseUrl, session]
  );

  useEffect(() => {
    const storedCompanyId = window.localStorage.getItem(companyStorageKey);
    const storedSession = window.localStorage.getItem(sessionStorageKey);
    let resolvedSession = initialData.session;

    if (storedSession) {
      try {
        resolvedSession = JSON.parse(storedSession) as AppSession;
        setSession(resolvedSession);
      } catch {
        window.localStorage.removeItem(sessionStorageKey);
      }
    }

    if (storedCompanyId && initialData.companies.some((company) => company.id === storedCompanyId)) {
      setActiveCompanyIdState(storedCompanyId);
    } else {
      setActiveCompanyIdState(resolvedSession.companyId);
    }

    if (resolvedSession.authenticated) {
      void hydrateFromBootstrap(resolvedSession.companyId, resolvedSession.user.email, resolvedSession);
    }
  }, [hydrateFromBootstrap, initialData]);

  useEffect(() => {
    window.localStorage.setItem(companyStorageKey, activeCompanyId);
  }, [activeCompanyId]);

  const activeCompany =
    data.companies.find((company) => company.id === activeCompanyId) ?? data.companies[0];
  const activeUsers = data.users.filter((user) => user.companyId === activeCompany.id);
  const activeUser =
    activeUsers.find((user) => user.id === session.user.id) ??
    activeUsers.find((user) => user.email === session.user.email) ??
    activeUsers[0] ??
    session.user;
  const activeRole = data.roles.find((role) => role.key === activeUser.roleKey);

  const permissions = activeRole?.permissions ?? session.permissions;

  const helpers = useMemo(
    () => ({
      isModuleEnabled(moduleKeys?: string[]) {
        if (!moduleKeys || moduleKeys.length === 0) {
          return true;
        }

        const companyModules = data.companyModules[activeCompany.id];
        if (companyModules?.length) {
          return moduleKeys.every((key) =>
            companyModules.some((state) => state.module.key === key && state.enabled)
          );
        }

        return moduleKeys.every((key) => activeCompany.enabledModules.includes(key));
      },
      canAccess(requiredPermissions?: string[]) {
        if (!requiredPermissions || requiredPermissions.length === 0) {
          return true;
        }

        return requiredPermissions.some((requiredPermission) =>
          permissions.some((grantedPermission) => matchesPermission(grantedPermission, requiredPermission))
        );
      }
    }),
    [activeCompany, data.companyModules, permissions]
  );

  const value: AppStateContextValue = {
    ...data,
    activeCompany,
    activeSettings: data.settings[activeCompany.id],
    activeUsers,
    activeRole,
    isHydratingSession,
    session: {
      ...session,
      companyId: activeCompany.id,
      user: activeUser,
      permissions
    },
    setActiveCompanyId(companyId) {
      setActiveCompanyIdState(companyId);
      if (session.authenticated) {
        void hydrateFromBootstrap(companyId, session.user.email, {
          ...session,
          companyId
        });
      }
    },
    async signIn(credentials) {
      const payload = {
        email: credentials.email,
        password: credentials.password,
        companyId: credentials.companyId
      };

      const apiResponse = await requestJson<AuthSessionContract>(`${data.apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (apiResponse) {
        const authSession = AuthSessionSchema.parse(apiResponse);
        const nextSession = authSessionToAppSession(authSession);

        setSession(nextSession);
        setActiveCompanyIdState(nextSession.companyId);
        window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
        window.localStorage.setItem(companyStorageKey, nextSession.companyId);
        await hydrateFromBootstrap(nextSession.companyId, nextSession.user.email, nextSession);

        return {
          ok: true,
          source: "api"
        };
      }

      const mockResponse = getMockSession(credentials.email, credentials.password, credentials.companyId);
      if (!mockResponse) {
        return {
          ok: false,
          source: data.source,
          error: "Invalid credentials or API unavailable."
        };
      }

      const nextSession = authSessionToAppSession(mockResponse);
      const mockData = buildMockData();

      setData({
        ...mockData,
        session: nextSession
      });
      setSession(nextSession);
      setActiveCompanyIdState(nextSession.companyId);
      window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
      window.localStorage.setItem(companyStorageKey, nextSession.companyId);

      return {
        ok: true,
        source: "mock"
      };
    },
    signOut() {
      const fallback = buildMockData();

      setData({
        ...fallback,
        source: data.source === "api" ? "api" : "mock"
      });
      setSession(fallback.session);
      setActiveCompanyIdState(fallback.session.companyId);
      window.localStorage.removeItem(sessionStorageKey);
      window.localStorage.setItem(companyStorageKey, fallback.session.companyId);
    },
    isModuleEnabled: helpers.isModuleEnabled,
    canAccess: helpers.canAccess,
    isRouteVisible(input) {
      return helpers.isModuleEnabled(input?.moduleKeys) && helpers.canAccess(input?.requiredPermissions);
    },
    getModuleByKey(key) {
      return data.modules.find((module) => module.key === key);
    },
    getCompanyModules(companyId) {
      return data.companyModules[companyId ?? activeCompany.id] ?? [];
    }
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}
