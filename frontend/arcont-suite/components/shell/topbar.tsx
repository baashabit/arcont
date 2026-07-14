"use client";

import { usePathname } from "next/navigation";
import type { LocalizedText } from "@/lib/i18n";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { navigationItems } from "@/lib/navigation";

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
  const routeLabel = activeNavItem ? localizeText(activeNavItem.label) : pathname;
  const sessionLabel = session.authenticated ? localizeText("authenticated") : localizeText("fallback");

  return (
    <header className="topbar">
      <div className="topbarMeta">
        <div className="topbarRail">
          <button
            className={`desktopSidebarToggle ${isSidebarCollapsed ? "desktopSidebarToggleCollapsed" : ""}`}
            onClick={onToggleSidebar}
            type="button"
            aria-label={isSidebarCollapsed ? localizeText({ es: "Expandir navegación", en: "Expand navigation" }) : localizeText({ es: "Colapsar navegación", en: "Collapse navigation" })}
            title={isSidebarCollapsed ? localizeText({ es: "Expandir navegación", en: "Expand navigation" }) : localizeText({ es: "Colapsar navegación", en: "Collapse navigation" })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 5v14M14 7l-4 5 4 5M19 5v14" />
            </svg>
            <span>{isSidebarCollapsed ? localizeText({ es: "Expandir", en: "Expand" }) : localizeText({ es: "Compactar", en: "Compact" })}</span>
          </button>
          <button className="mobileToggle" onClick={onOpenSidebar} type="button" aria-label={localizeText("Open navigation")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          </button>
          <span className="eyebrow">
            {localizeText(eyebrow)}
            <span className="mono">{routeLabel}</span>
          </span>
        </div>
        <div>
          <h1>{localizeText(title)}</h1>
          <p>{localizeText(description)}</p>
        </div>
      </div>

      <div className="topbarAside">
        <div className="topbarSummary">
          <strong>{activeCompany.tradeName}</strong>
          <span>
            {activeRole?.name ?? localizeText("Role pending")} · {session.user.fullName}
          </span>
        </div>
        <div className="topbarActions">
          <Badge tone={session.authenticated ? "success" : "warning"}>{sessionLabel}</Badge>
          <Badge tone="gold">{activeCompany.countryCode}</Badge>
          {actions}
          <button className="buttonGhost" type="button" onClick={() => setUiLanguage(uiLanguage === "es" ? "en" : "es")}>
            {uiLanguage.toUpperCase()}
          </button>
          <button className="buttonGhost" type="button" onClick={signOut}>
            {localizeText("Sign out")}
          </button>
        </div>
      </div>
    </header>
  );
}
