"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type {
  AuditEventContract,
  AuthLoginRequestContract,
  CompanyContract,
  CompanyDetailContract,
  CompanyModuleStateContract,
  ModuleContract,
  PlatformDashboardSummaryContract,
  PlatformSettingsContract,
  RoleContract,
  UpdatePlatformSettingsRequestContract,
  UserContract
} from "@/lib/contracts";
import {
  authSessionToAppSession,
  bootstrapToPartialAppData,
  buildMockData,
  getMockSession,
  type AppData,
  type AppSession
} from "@/lib/app-data";
import {
  fetchAuditEvents,
  fetchBootstrap,
  fetchCompanyDetail,
  fetchCompanyModules,
  fetchDashboardSummary,
  loginWithApi,
  updateCompanyModules,
  updateSettings
} from "@/lib/platform-api";

type SignInResult = {
  ok: boolean;
  source: "api" | "mock";
  error?: string;
};

type AppStateContextValue = AppData & {
  activeCompany: CompanyContract;
  activeSettings: PlatformSettingsContract | undefined;
  activeUsers: UserContract[];
  activeRole: RoleContract | undefined;
  companyDetails: Record<string, CompanyDetailContract>;
  dashboardSummary: PlatformDashboardSummaryContract | null;
  auditEvents: AuditEventContract[];
  isHydratingSession: boolean;
  isRefreshingPlatform: boolean;
  isSavingSettings: boolean;
  isSavingModules: boolean;
  setActiveCompanyId: (companyId: string) => void;
  signIn: (credentials: AuthLoginRequestContract) => Promise<SignInResult>;
  signOut: () => void;
  refreshCompanyDetail: (companyId?: string) => Promise<CompanyDetailContract | null>;
  refreshDashboard: (companyId?: string) => Promise<PlatformDashboardSummaryContract | null>;
  refreshAuditTrail: (companyId?: string, limit?: number) => Promise<AuditEventContract[]>;
  saveSettings: (
    companyId: string,
    input: UpdatePlatformSettingsRequestContract
  ) => Promise<PlatformSettingsContract | null>;
  saveCompanyModules: (
    companyId: string,
    enabledModules: string[]
  ) => Promise<CompanyModuleStateContract[] | null>;
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

function buildCompaniesFromModules(
  companies: CompanyContract[],
  companyId: string,
  companyModules: CompanyModuleStateContract[]
) {
  const enabledModules = companyModules
    .filter((entry) => entry.enabled)
    .map((entry) => entry.module.key);

  return companies.map((company) =>
    company.id === companyId ? { ...company, enabledModules } : company
  );
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
  const [companyDetails, setCompanyDetails] = useState<Record<string, CompanyDetailContract>>({});
  const [dashboardSummary, setDashboardSummary] = useState<PlatformDashboardSummaryContract | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEventContract[]>([]);
  const [isHydratingSession, setHydratingSession] = useState(false);
  const [isRefreshingPlatform, setRefreshingPlatform] = useState(false);
  const [isSavingSettings, setSavingSettings] = useState(false);
  const [isSavingModules, setSavingModules] = useState(false);

  const apiOptions = useMemo(
    () => ({
      apiBaseUrl: data.apiBaseUrl,
      accessToken: session.accessToken
    }),
    [data.apiBaseUrl, session.accessToken]
  );

  const refreshCompanyDetail = useCallback(
    async (companyId = activeCompanyId) => {
      const detail = await fetchCompanyDetail(companyId, apiOptions);
      if (!detail) {
        return null;
      }

      setCompanyDetails((current) => ({
        ...current,
        [companyId]: detail
      }));
      setData((current) => ({
        ...current,
        source: "api",
        companies: mergeUniqueCompanies(current.companies, detail.company),
        users: mergeUsersByCompany(current.users, detail.users, companyId),
        settings: {
          ...current.settings,
          [companyId]: detail.settings
        },
        companyModules: {
          ...current.companyModules,
          [companyId]: detail.companyModules
        }
      }));

      return detail;
    },
    [activeCompanyId, apiOptions]
  );

  const refreshDashboard = useCallback(
    async (companyId = activeCompanyId) => {
      const summary = await fetchDashboardSummary(companyId, apiOptions);
      if (!summary) {
        return null;
      }

      setDashboardSummary(summary);
      return summary;
    },
    [activeCompanyId, apiOptions]
  );

  const refreshAuditTrail = useCallback(
    async (companyId = activeCompanyId, limit = 8) => {
      const items = await fetchAuditEvents(companyId, limit, apiOptions);
      if (!items) {
        return [];
      }

      setAuditEvents(items);
      return items;
    },
    [activeCompanyId, apiOptions]
  );

  const refreshCompanyModulesState = useCallback(
    async (companyId: string) => {
      const items = await fetchCompanyModules(companyId, apiOptions);
      if (!items) {
        return null;
      }

      setData((current) => ({
        ...current,
        source: "api",
        companies: buildCompaniesFromModules(current.companies, companyId, items),
        companyModules: {
          ...current.companyModules,
          [companyId]: items
        }
      }));

      return items;
    },
    [apiOptions]
  );

  const refreshPlatformState = useCallback(
    async (companyId: string) => {
      setRefreshingPlatform(true);

      try {
        await Promise.all([
          refreshCompanyDetail(companyId),
          refreshDashboard(companyId),
          refreshAuditTrail(companyId, 8),
          refreshCompanyModulesState(companyId)
        ]);
      } finally {
        setRefreshingPlatform(false);
      }
    },
    [refreshAuditTrail, refreshCompanyDetail, refreshCompanyModulesState, refreshDashboard]
  );

  const hydrateFromBootstrap = useCallback(
    async (companyId: string, userEmail: string, baseSession?: AppSession) => {
      setHydratingSession(true);

      try {
        const bootstrap = await fetchBootstrap(companyId, userEmail, apiOptions);
        if (!bootstrap) {
          return false;
        }

        const partial = bootstrapToPartialAppData(bootstrap);
        const sessionSeed = baseSession ?? initialData.session;
        const nextSession: AppSession = {
          ...sessionSeed,
          authenticated: sessionSeed.authenticated,
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

        setCompanyDetails((current) => ({
          ...current,
          [partial.company.id]: {
            company: partial.company,
            settings: partial.settings,
            companyModules: partial.companyModules,
            users: partial.users,
            stats: {
              totalUsers: partial.users.length,
              activeUsers: partial.users.filter((user) => user.status === "active").length,
              enabledModuleCount: partial.companyModules.filter((entry) => entry.enabled).length,
              disabledModuleCount: partial.companyModules.filter((entry) => !entry.enabled).length
            }
          }
        }));

        return true;
      } finally {
        setHydratingSession(false);
      }
    },
    [apiOptions, initialData.session]
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
      void (async () => {
        const hydrated = await hydrateFromBootstrap(
          resolvedSession.companyId,
          resolvedSession.user.email,
          resolvedSession
        );

        if (hydrated) {
          await refreshPlatformState(resolvedSession.companyId);
        }
      })();
    } else {
      void refreshPlatformState(resolvedSession.companyId);
    }
  }, [hydrateFromBootstrap, initialData, refreshPlatformState]);

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
    companyDetails,
    dashboardSummary,
    auditEvents,
    isHydratingSession,
    isRefreshingPlatform,
    isSavingSettings,
    isSavingModules,
    session: {
      ...session,
      companyId: activeCompany.id,
      user: activeUser,
      permissions
    },
    setActiveCompanyId(companyId) {
      setActiveCompanyIdState(companyId);
      window.localStorage.setItem(companyStorageKey, companyId);

      if (session.authenticated) {
        void (async () => {
          await hydrateFromBootstrap(companyId, session.user.email, {
            ...session,
            companyId
          });
          await refreshPlatformState(companyId);
        })();
      } else {
        void refreshPlatformState(companyId);
      }
    },
    async signIn(credentials) {
      const apiResponse = await loginWithApi(credentials, apiOptions);

      if (apiResponse) {
        const nextSession = authSessionToAppSession(apiResponse);

        setSession(nextSession);
        setActiveCompanyIdState(nextSession.companyId);
        window.localStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
        window.localStorage.setItem(companyStorageKey, nextSession.companyId);
        await hydrateFromBootstrap(nextSession.companyId, nextSession.user.email, nextSession);
        await refreshPlatformState(nextSession.companyId);

        return {
          ok: true,
          source: "api"
        };
      }

      const mockResponse = getMockSession(
        credentials.email,
        credentials.password,
        credentials.companyId
      );
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
      setCompanyDetails({});
      setDashboardSummary(null);
      setAuditEvents([]);
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
      setCompanyDetails({});
      setDashboardSummary(null);
      setAuditEvents([]);
      setSession(fallback.session);
      setActiveCompanyIdState(fallback.session.companyId);
      window.localStorage.removeItem(sessionStorageKey);
      window.localStorage.setItem(companyStorageKey, fallback.session.companyId);
    },
    async refreshCompanyDetail(companyId) {
      return refreshCompanyDetail(companyId);
    },
    async refreshDashboard(companyId) {
      return refreshDashboard(companyId);
    },
    async refreshAuditTrail(companyId, limit) {
      return refreshAuditTrail(companyId, limit);
    },
    async saveSettings(companyId, input) {
      setSavingSettings(true);

      try {
        const updated = await updateSettings(companyId, input, apiOptions);
        if (!updated) {
          return null;
        }

        setData((current) => ({
          ...current,
          source: "api",
          settings: {
            ...current.settings,
            [companyId]: updated
          }
        }));
        setCompanyDetails((current) => {
          const detail = current[companyId];
          if (!detail) {
            return current;
          }

          return {
            ...current,
            [companyId]: {
              ...detail,
              settings: updated
            }
          };
        });

        return updated;
      } finally {
        setSavingSettings(false);
      }
    },
    async saveCompanyModules(companyId, enabledModules) {
      setSavingModules(true);

      try {
        const updated = await updateCompanyModules(
          companyId,
          {
            enabledModules
          },
          apiOptions
        );

        if (!updated) {
          return null;
        }

        setData((current) => ({
          ...current,
          source: "api",
          companies: buildCompaniesFromModules(current.companies, companyId, updated),
          companyModules: {
            ...current.companyModules,
            [companyId]: updated
          }
        }));
        setCompanyDetails((current) => {
          const detail = current[companyId];
          if (!detail) {
            return current;
          }

          return {
            ...current,
            [companyId]: {
              ...detail,
              company: {
                ...detail.company,
                enabledModules
              },
              companyModules: updated,
              stats: {
                ...detail.stats,
                enabledModuleCount: updated.filter((entry) => entry.enabled).length,
                disabledModuleCount: updated.filter((entry) => !entry.enabled).length
              }
            }
          };
        });

        return updated;
      } finally {
        setSavingModules(false);
      }
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
