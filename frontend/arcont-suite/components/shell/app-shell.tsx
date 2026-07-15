"use client";

import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/components/providers/app-state-provider";
import type { LocalizedText } from "@/lib/i18n";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export function AppShell({
  title,
  description,
  eyebrow,
  actions,
  children
}: {
  title: LocalizedText;
  description: LocalizedText;
  eyebrow: LocalizedText;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const hasLoadedSidebarPreference = useRef(false);
  const { localizeText } = useAppState();

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("arcont.sidebarCollapsed") === "true");
    hasLoadedSidebarPreference.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedSidebarPreference.current) {
      window.localStorage.setItem("arcont.sidebarCollapsed", String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1181px)");
    const syncSidebarViewport = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setSidebarOpen(false);
      }
    };

    syncSidebarViewport(mediaQuery);
    mediaQuery.addEventListener("change", syncSidebarViewport);
    return () => mediaQuery.removeEventListener("change", syncSidebarViewport);
  }, []);

  return (
    <div className={`pageShell ${isSidebarCollapsed ? "pageShellSidebarCollapsed" : ""}`}>
      <button
        className={`sidebarBackdrop ${isSidebarOpen ? "sidebarBackdropVisible" : ""}`}
        type="button"
        onClick={() => setSidebarOpen(false)}
        aria-label={localizeText({ es: "Cerrar navegación", en: "Close navigation" })}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
      />
      <div className="mainWrap">
        <main className="mainPanel">
          <Topbar
            title={title}
            description={description}
            eyebrow={eyebrow}
            actions={actions}
            onOpenSidebar={() => setSidebarOpen(true)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />
          <div className="contentStack">{children}</div>
        </main>
      </div>
    </div>
  );
}
