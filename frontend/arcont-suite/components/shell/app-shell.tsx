"use client";

import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("arcont.sidebarCollapsed") === "true");
    hasLoadedSidebarPreference.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedSidebarPreference.current) {
      window.localStorage.setItem("arcont.sidebarCollapsed", String(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed]);

  return (
    <div className={`pageShell ${isSidebarCollapsed ? "pageShellSidebarCollapsed" : ""}`}>
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
