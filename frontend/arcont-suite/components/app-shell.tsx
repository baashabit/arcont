"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./logo-mark";

const links = [
  { href: "/", label: "Overview", pill: "Core" },
  { href: "/login", label: "Login", pill: "Auth" },
  { href: "/dashboard", label: "Executive Dashboard", pill: "CEO" },
  { href: "/crm", label: "CRM Prospectos", pill: "Sales" },
  { href: "/customer-360", label: "Cliente 360", pill: "CX" },
  { href: "/inventory", label: "Inventario", pill: "Stock" },
  { href: "/gestoria", label: "Gestoria", pill: "Legal" },
  { href: "/expediente", label: "Expediente", pill: "Case" },
  { href: "/backoffice", label: "Backoffice", pill: "ERP" }
];

export function AppShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <div className="brand">
          <LogoMark />
          <div>
            <strong>ARCONT SUITE</strong>
            <small>Real Estate Operating System</small>
          </div>
        </div>

        <div className="navSection">
          <h4>Frontend Real</h4>
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`navLink ${isActive ? "navLinkActive" : ""}`}
              >
                <span>{link.label}</span>
                <span className="pill">{link.pill}</span>
              </Link>
            );
          })}
        </div>

        <div className="sidebarNote">
          <p>{subtitle}</p>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="headline">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="actions">
            <span className="chip">Frontend base</span>
            <span className="chip">Marca ARCONT</span>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
