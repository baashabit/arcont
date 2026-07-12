"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/logo-mark";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { navigationGroups, navigationItems } from "@/lib/navigation";

export function Sidebar({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { activeCompany, companies, setActiveCompanyId, source, isRouteVisible } = useAppState();

  return (
    <div className={`sidebarWrap ${isOpen ? "sidebarWrapOpen" : ""}`}>
      <aside className="sidebar">
        <div className="brandBlock">
          <div className="brandCard">
            <LogoMark />
            <div className="brandMeta">
              <strong>ARCONT SUITE</strong>
              <small>Enterprise operating system</small>
            </div>
          </div>

          <div className="tenantCard">
            <div className="tenantCardHeader">
              <div>
                <div className="tenantLabel">Active company</div>
                <div className="tenantName">{activeCompany.tradeName}</div>
              </div>
              <Badge tone={source === "api" ? "success" : "warning"}>{source}</Badge>
            </div>
            <p className="tenantHint">
              Multi-tenant visibility, module controls and shared platform patterns live here.
            </p>
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
          </div>
        </div>

        {navigationGroups.map((group) => (
          <div className="navGroup" key={group.key}>
            <h2 className="navHeading">{group.label}</h2>
            <div className="navStack">
              {navigationItems
                .filter((item) => item.domain === group.key)
                .map((item) => {
                  const enabled = isRouteVisible({
                    moduleKeys: item.moduleKeys,
                    requiredPermissions: item.requiredPermissions
                  });
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`navLink ${active ? "navLinkActive" : ""} ${enabled ? "" : "navLinkDisabled"}`}
                    >
                      <span className="navLabel">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                      {enabled ? <Badge tone="info">on</Badge> : <Badge>off</Badge>}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </aside>
    </div>
  );
}
