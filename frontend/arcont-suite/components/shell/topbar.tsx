"use client";

import { usePathname } from "next/navigation";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";

export function Topbar({
  title,
  description,
  eyebrow,
  actions,
  onOpenSidebar
}: {
  title: string;
  description: string;
  eyebrow: string;
  actions?: React.ReactNode;
  onOpenSidebar: () => void;
}) {
  const pathname = usePathname();
  const { session, activeCompany, activeRole } = useAppState();

  return (
    <header className="topbar">
      <div className="topbarMeta">
        <button className="mobileToggle" onClick={onOpenSidebar} type="button" aria-label="Open navigation">
          <span>||</span>
        </button>
        <span className="eyebrow">
          {eyebrow}
          <span className="mono">{pathname}</span>
        </span>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>

      <div className="topbarAside">
        <div className="topbarActions">
          <Badge tone="gold">{activeCompany.countryCode}</Badge>
          <Badge tone="neutral">{activeRole?.name ?? "Role pending"}</Badge>
          <Badge tone="info">{session.user.fullName}</Badge>
        </div>
        {actions}
      </div>
    </header>
  );
}
