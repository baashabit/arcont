"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo-mark";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { nextLanguage } from "@/lib/i18n";
import { navigationGroups, navigationItems, type NavigationItem } from "@/lib/navigation";

const quickLaunchHrefs = ["/", "/projects", "/field", "/procurement/requisitions", "/accounts-payable"];
const setupLaunchHrefs = ["/platform/companies", "/platform/settings", "/platform/users", "/copilot"];

type SidebarIconName =
  | "home"
  | "dashboard"
  | "projects"
  | "procurement"
  | "inventory"
  | "finance"
  | "platform"
  | "sales"
  | "people"
  | "shield"
  | "integrations"
  | "document";

function domainIcon(domain: NavigationItem["domain"]): SidebarIconName {
  switch (domain) {
    case "sales":
      return "sales";
    case "projects":
      return "projects";
    case "procurement":
      return "procurement";
    case "inventory":
      return "inventory";
    case "finance":
      return "finance";
    case "hr":
      return "people";
    case "post_sales":
    case "compliance":
      return "shield";
    case "integrations":
      return "integrations";
    default:
      return "platform";
  }
}

function itemIcon(item: NavigationItem): SidebarIconName {
  switch (item.href) {
    case "/":
      return "home";
    case "/dashboard":
    case "/operations":
    case "/platform/modules":
      return "dashboard";
    case "/field":
    case "/equipment":
    case "/platform/companies":
      return "projects";
    case "/document-control":
    case "/daily-log":
    case "/procurement/requisitions":
    case "/budget-book":
    case "/inventory/receiving":
    case "/accounts-payable":
    case "/estimations":
    case "/subcontracts":
    case "/post-sale":
      return "document";
    case "/quality":
    case "/supplier-control":
    case "/close-control":
      return "shield";
    case "/supplier-master":
    case "/platform/users":
      return "people";
    case "/procurement/purchase-orders":
    case "/cost-control":
    case "/treasury/payment-runs":
      return "finance";
    case "/inventory/movements":
    case "/copilot":
      return "integrations";
    case "/cash-flow":
      return "sales";
  }

  return domainIcon(item.domain);
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const paths = (() => {
    switch (name) {
      case "home":
        return <><path d="m4 11 8-7 8 7" /><path d="M6.5 10.5V20h11v-9.5M10 20v-5h4v5" /></>;
      case "dashboard":
        return <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>;
      case "projects":
        return <><path d="M4 20V7l8-3 8 3v13" /><path d="M8 20v-5h8v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01" /></>;
      case "procurement":
        return <><path d="M4 5h2l2 10h9l2-7H7" /><circle cx="10" cy="19" r="1" /><circle cx="17" cy="19" r="1" /></>;
      case "inventory":
        return <><path d="m4 8 8-4 8 4-8 4-8-4Z" /><path d="M4 8v8l8 4 8-4V8M12 12v8" /></>;
      case "finance":
        return <><rect x="3.5" y="6" width="17" height="13" rx="2" /><path d="M3.5 10h17M15.5 15h2" /></>;
      case "platform":
        return <><path d="M5 6h14M5 12h14M5 18h14" /><circle cx="9" cy="6" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="18" r="2" /></>;
      case "sales":
        return <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>;
      case "people":
        return <><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6M4 10c.2-1.5 1-2.6 2.5-3.2M20 10c-.2-1.5-1-2.6-2.5-3.2" /></>;
      case "shield":
        return <><path d="M12 3 19 6v5c0 4.4-2.8 7.5-7 10-4.2-2.5-7-5.6-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>;
      case "integrations":
        return <><circle cx="6" cy="6" r="2" /><circle cx="18" cy="7" r="2" /><circle cx="12" cy="18" r="2" /><path d="m7.8 7.2 2.8 8.1M16.2 8.2l-2.8 8.1M8 6.3l8-.1" /></>;
      default:
        return <><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h4M9 13h6M9 17h6" /></>;
    }
  })();

  return <svg className="navIconGraphic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>;
}

const quickLaunchHrefs = ["/", "/projects", "/operations", "/field", "/procurement/requisitions", "/accounts-payable"];
const setupLaunchHrefs = ["/platform/companies", "/platform/settings", "/platform/users", "/copilot"];

export function Sidebar({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse
}: {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const {
    activeCompany,
    companies,
    setActiveCompanyId,
    source,
    isRouteVisible,
    uiLanguage,
    setUiLanguage,
    localizeText
  } = useAppState();
  const quickLaunchItems = quickLaunchHrefs
    .map((href) => navigationItems.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) =>
      isRouteVisible({ moduleKeys: item.moduleKeys, requiredPermissions: item.requiredPermissions })
    );
  const setupLaunchItems = setupLaunchHrefs
    .map((href) => navigationItems.find((item) => item.href === href))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter((item) =>
      isRouteVisible({ moduleKeys: item.moduleKeys, requiredPermissions: item.requiredPermissions })
    );
  const activeDomain = navigationItems.find((item) => item.href === pathname)?.domain ?? null;
  const [expandedDomain, setExpandedDomain] = useState<string | null>(activeDomain);

  useEffect(() => {
    setExpandedDomain(activeDomain);
  }, [activeDomain]);

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: navigationItems.filter(
        (item) =>
          item.domain === group.key &&
          !quickLaunchHrefs.includes(item.href) &&
          !setupLaunchHrefs.includes(item.href) &&
          isRouteVisible({ moduleKeys: item.moduleKeys, requiredPermissions: item.requiredPermissions })
      )
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className={`sidebarWrap ${isOpen ? "sidebarWrapOpen" : ""} ${isCollapsed ? "sidebarWrapCollapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="sidebarBrandRow">
            <div className="brandCard">
              <LogoMark />
              <div className="brandMeta">
                <strong>ARCONT SUITE</strong>
                <small>{localizeText("Enterprise operating system")}</small>
              </div>
            </div>
            <button
              className={`sidebarCollapseButton ${isCollapsed ? "sidebarCollapseButtonCollapsed" : ""}`}
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? localizeText({ es: "Expandir navegación", en: "Expand navigation" }) : localizeText({ es: "Colapsar navegación", en: "Collapse navigation" })}
              title={isCollapsed ? localizeText({ es: "Expandir navegación", en: "Expand navigation" }) : localizeText({ es: "Colapsar navegación", en: "Collapse navigation" })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 7-5 5 5 5" /></svg>
            </button>
            <button
              className="mobileSidebarCloseButton"
              type="button"
              onClick={onClose}
              aria-label={localizeText({ es: "Cerrar navegación", en: "Close navigation" })}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
            </button>
          </div>

          <div className="tenantCard">
            <div className="tenantCardHeader">
              <div>
                <div className="tenantLabel">{localizeText("Active company")}</div>
                <div className="tenantName">{activeCompany.tradeName}</div>
              </div>
              <Badge tone={source === "api" ? "success" : "warning"}>{source}</Badge>
            </div>
            <div className="tenantStats">
              <span>{activeCompany.countryCode}</span>
              <span>{activeCompany.enabledModules.length} {localizeText({ es: "modulos", en: "modules" })}</span>
            </div>
            <div className="tenantControls">
              <select
                className="tenantSelect"
                value={activeCompany.id}
                onChange={(event) => setActiveCompanyId(event.target.value)}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.tradeName}
                  </option>
                ))}
              </select>
              <button className="buttonGhost tenantLanguageButton" type="button" onClick={() => setUiLanguage(nextLanguage(uiLanguage))}>
                {localizeText("Language")}: {uiLanguage.toUpperCase()}
              </button>
            </div>
          </div>
        </div>

        <div className="navGroup">
          <h2 className="navHeading">{localizeText("Start here")}</h2>
          <div className="navStack">
            {quickLaunchItems.map((item) => {
              const active = pathname === item.href;
              const label = localizeText(item.label);
              const description = localizeText(item.description);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`navLink ${active ? "navLinkActive" : ""}`}
                  aria-label={label}
                  title={isCollapsed ? `${label} · ${description}` : undefined}
                >
                  <span className="navIcon"><SidebarIcon name={itemIcon(item)} /></span>
                  <span className="navLabel">
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </span>
                  <Badge tone={item.href === "/" ? "gold" : "info"}>
                    {item.href === "/" ? localizeText("home") : localizeText("open")}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="navGroup">
          <h2 className="navHeading">{localizeText("Setup and AI")}</h2>
          <div className="navStack">
            {setupLaunchItems.map((item) => {
              const active = pathname === item.href;
              const label = localizeText(item.label);
              const description = localizeText(item.description);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`navLink ${active ? "navLinkActive" : ""}`}
                  aria-label={label}
                  title={isCollapsed ? `${label} · ${description}` : undefined}
                >
                  <span className="navIcon"><SidebarIcon name={itemIcon(item)} /></span>
                  <span className="navLabel">
                    <strong>{label}</strong>
                    <span>{description}</span>
                  </span>
                  <Badge tone={item.href === "/copilot" ? "info" : "gold"}>
                    {item.href === "/copilot" ? localizeText("ai") : localizeText("setup")}
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>

        {visibleGroups.map((group) => (
          <div className="navGroup" key={group.key}>
            <button
              type="button"
              className={`navGroupToggle ${expandedDomain === group.key ? "navGroupToggleOpen" : ""}`}
              aria-expanded={expandedDomain === group.key}
              aria-label={localizeText(group.label)}
              title={isCollapsed ? localizeText(group.label) : undefined}
              onClick={() => setExpandedDomain((current) => (current === group.key ? null : group.key))}
            >
              <span className="navGroupLabel">
                <span className="navIcon"><SidebarIcon name={domainIcon(group.key)} /></span>
                <span className="navGroupText">{localizeText(group.label)}</span>
              </span>
              <span className="navGroupMeta">
                {group.items.length}
                <span aria-hidden="true">{expandedDomain === group.key ? "−" : "+"}</span>
              </span>
            </button>
            {expandedDomain === group.key ? (
              <div className="navStack navStackCompact">
                {group.items.map((item) => {
                    const active = pathname === item.href;
                    const label = localizeText(item.label);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`navLink navLinkCompact ${active ? "navLinkActive" : ""}`}
                        aria-label={label}
                        title={isCollapsed ? label : undefined}
                      >
                        <span className="navIcon"><SidebarIcon name={itemIcon(item)} /></span>
                        <span className="navLabel">
                          <strong>{label}</strong>
                        </span>
                      </Link>
                    );
                  })}
              </div>
            ) : null}
          </div>
        ))}
      </aside>
    </div>
  );
}
