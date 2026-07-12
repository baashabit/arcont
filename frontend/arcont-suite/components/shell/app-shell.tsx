"use client";

import { useState } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export function AppShell({
  title,
  description,
  eyebrow,
  actions,
  children
}: {
  title: string;
  description: string;
  eyebrow: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="pageShell">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="mainWrap">
        <main className="mainPanel">
          <Topbar
            title={title}
            description={description}
            eyebrow={eyebrow}
            actions={actions}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
          <div className="contentStack">{children}</div>
        </main>
      </div>
    </div>
  );
}
