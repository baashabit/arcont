import type { ReactNode } from "react";
import { useAppState } from "@/components/providers/app-state-provider";
import { EmptyState } from "@/components/ui/empty-state";

export function ModuleGate({
  moduleKeys,
  requiredPermissions,
  title,
  children
}: {
  moduleKeys: string[];
  requiredPermissions?: string[];
  title: string;
  children: ReactNode;
}) {
  const { activeCompany, isRouteVisible } = useAppState();

  if (isRouteVisible({ moduleKeys, requiredPermissions })) {
    return <>{children}</>;
  }

  return (
    <EmptyState
      title={`${title} is not enabled for ${activeCompany.tradeName}`}
      description="This shell already understands module entitlements per company. Enable the module from platform governance or switch to another tenant to explore the route."
      primaryAction={{ label: "Review company modules", href: "/platform/modules" }}
      secondaryAction={{ label: "Go back to dashboard", href: "/dashboard" }}
    />
  );
}
