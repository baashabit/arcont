"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AppData } from "@/lib/app-data";
import type { CompanyContract, ModuleContract, RoleContract, UserContract } from "@/lib/contracts";

type AppStateContextValue = AppData & {
  activeCompany: CompanyContract;
  activeSettings: AppData["settings"][string] | undefined;
  activeUsers: UserContract[];
  activeRole: RoleContract | undefined;
  setActiveCompanyId: (companyId: string) => void;
  isModuleEnabled: (moduleKeys?: string[]) => boolean;
  getModuleByKey: (key: string) => ModuleContract | undefined;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);
const storageKey = "arcont.activeCompanyId";

export function AppStateProvider({
  children,
  initialData
}: {
  children: React.ReactNode;
  initialData: AppData;
}) {
  const [activeCompanyId, setActiveCompanyId] = useState(initialData.session.companyId);

  useEffect(() => {
    const storedCompanyId = window.localStorage.getItem(storageKey);
    if (storedCompanyId && initialData.companies.some((company) => company.id === storedCompanyId)) {
      setActiveCompanyId(storedCompanyId);
    }
  }, [initialData.companies]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, activeCompanyId);
  }, [activeCompanyId]);

  const activeCompany =
    initialData.companies.find((company) => company.id === activeCompanyId) ?? initialData.companies[0];
  const activeUsers = initialData.users.filter((user) => user.companyId === activeCompany.id);
  const activeUser =
    activeUsers.find((user) => user.id === initialData.session.user.id) ?? activeUsers[0] ?? initialData.session.user;
  const activeRole = initialData.roles.find((role) => role.key === activeUser.roleKey);

  const value: AppStateContextValue = {
    ...initialData,
    activeCompany,
    activeSettings: initialData.settings[activeCompany.id],
    activeUsers,
    activeRole,
    session: {
      ...initialData.session,
      companyId: activeCompany.id,
      user: activeUser,
      permissions: activeRole?.permissions ?? initialData.session.permissions
    },
    setActiveCompanyId,
    isModuleEnabled(moduleKeys) {
      if (!moduleKeys || moduleKeys.length === 0) {
        return true;
      }

      return moduleKeys.every((key) => activeCompany.enabledModules.includes(key));
    },
    getModuleByKey(key) {
      return initialData.modules.find((module) => module.key === key);
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
