"use client";

import { usePathname } from "next/navigation";
import type { LocalizedText } from "@/lib/i18n";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { navigationGroups, navigationItems } from "@/lib/navigation";

function initials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }

  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
}

export function Topbar({
  title,
  description,
  eyebrow,
  actions,
  onOpenSidebar,
  isSidebarCollapsed,
  onToggleSidebar
}: {
  title: LocalizedText;
  description: LocalizedText;
  eyebrow: LocalizedText;
  actions?: React.ReactNode;
  onOpenSidebar: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const { session, activeCompany, activeRole, signOut, uiLanguage, setUiLanguage, localizeText } = useAppState();
  const activeNavItem = navigationItems.find((item) => item.href === pathname);
  const activeNavGroup = activeNavItem ? navigationGroups.find((group) => group.key === activeNavItem.domain) : null;
  const routeLabel = activeNavItem ? localizeText(activeNavItem.label) : pathname;
  const routeDescription = activeNavItem ? localizeText(activeNavItem.description) : pathname;
  const domainLabel = activeNavGroup ? localizeText(activeNavGroup.label) : localizeText({ es: "General", en: "General" });
  const sessionLabel = session.authenticated ? localizeText("authenticated") : localizeText("fallback");
  const expandLabel = localizeText({ es: "Expandir navegación", en: "Expand navigation" });
  const collapseLabel = localizeText({ es: "Colapsar navegación", en: "Collapse navigation" });
  const openLabel = localizeText("Open navigation");
  const languageLabel = localizeText("Language");
  const activeRoleLabel = activeRole?.name ?? localizeText("Role pending");
  const sidebarToggleLabel = isSidebarCollapsed ? expandLabel : collapseLabel;
  const userInitials = initials(session.user.fullName);

  return (
    <header className="topbar">
      <div className="topbarMeta">
        <div className="topbarRail">
          <button
            className={`desktopSidebarToggle ${isSidebarCollapsed ? "desktopSidebarToggleCollapsed" : ""}`}
            onClick={onToggleSidebar}
            type="button"
            aria-label={sidebarToggleLabel}
            title={sidebarToggleLabel}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5v14M14 7l-4 5 4 5M19 5v14" />
            </svg>
            <span>{isSidebarCollapsed ? localizeText({ es: "Expandir", en: "Expand" }) : localizeText({ es: "Colapsar", en: "Collapse" })}</span>
          </button>
          <button className="mobileToggle" onClick={onOpenSidebar} type="button" aria-label={openLabel} title={openLabel}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          </button>
          <span className="eyebrow">
            {localizeText(eyebrow)}
            <span className="mono">{routeLabel}</span>
          </span>
          <span className="topbarRouteBadge">
            <span>{domainLabel}</span>
            <strong>{activeCompany.countryCode}</strong>
          </span>
        </div>
        <div>
          <h1>{localizeText(title)}</h1>
          <p>{localizeText(description)}</p>
        </div>
        <div className="topbarContextStrip" role="group" aria-label={localizeText({ es: "Resumen del contexto", en: "Context summary" })}>
          <div className="topbarContextCard">
            <span>{localizeText({ es: "Vista actual", en: "Current view" })}</span>
            <strong>{routeLabel}</strong>
            <small>{routeDescription}</small>
          </div>
          <div className="topbarContextCard">
            <span>{localizeText({ es: "Rol activo", en: "Active role" })}</span>
            <strong>{activeRoleLabel}</strong>
            <small>{session.user.fullName}</small>
          </div>
        </div>
      </div>

      <div className="topbarAside">
        <div className="topbarSummary">
          <div className="topbarSummaryHeader">
            <span className="topbarAvatar" aria-hidden="true">{userInitials}</span>
            <div className="topbarSummaryIdentity">
              <span className="topbarSummaryLabel">{localizeText("Active company")}</span>
              <strong>{activeCompany.tradeName}</strong>
              <span>
                {activeRoleLabel} · {session.user.fullName}
              </span>
            </div>
          </div>
          <div className="topbarSummaryFacts">
            <span>
              <strong>{activeCompany.enabledModules.length}</strong>
              <small>{localizeText({ es: "modulos", en: "modules" })}</small>
            </span>
            <span>
              <strong>{domainLabel}</strong>
              <small>{localizeText({ es: "area", en: "area" })}</small>
            </span>
            <span>
              <strong>{sessionLabel}</strong>
              <small>{localizeText({ es: "sesion", en: "session" })}</small>
            </span>
          </div>
        </div>
        <div className="topbarActionGroups">
          {actions ? <div className="topbarPrimaryActions">{actions}</div> : null}
          <div className="topbarActions">
            <div className="topbarStatusRail" role="group" aria-label={localizeText({ es: "Estado de sesión", en: "Session status" })}>
              <Badge tone={session.authenticated ? "success" : "warning"}>{sessionLabel}</Badge>
              <Badge tone="gold">{activeCompany.countryCode}</Badge>
            </div>
            <div className="topbarUtilityRail">
              <button className="buttonGhost topbarUtilityButton" type="button" onClick={() => setUiLanguage(uiLanguage === "es" ? "en" : "es")} aria-label={`${languageLabel}: ${uiLanguage.toUpperCase()}`}>
                {uiLanguage.toUpperCase()}
              </button>
              <button className="buttonGhost topbarUtilityButton" type="button" onClick={signOut}>
                {localizeText("Sign out")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
