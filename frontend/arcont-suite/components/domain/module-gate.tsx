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
  const { activeCompany, canAccess, isModuleEnabled, localizeText } = useAppState();
  const moduleEnabled = isModuleEnabled(moduleKeys);
  const hasAccess = canAccess(requiredPermissions);

  if (moduleEnabled && hasAccess) {
    return <>{children}</>;
  }

  const isMissingModule = !moduleEnabled;

  return (
    <EmptyState
      title={isMissingModule
        ? localizeText({
            es: `${title} no está habilitado para ${activeCompany.tradeName}`,
            en: `${title} is not enabled for ${activeCompany.tradeName}`
          })
        : localizeText({
            es: `${title}: acceso restringido`,
            en: `${title}: access restricted`
          })}
      description={isMissingModule
        ? localizeText({
            es: "Esta empresa no tiene contratado este módulo. Actívalo desde la administración de empresa o cambia a un tenant que ya lo incluya.",
            en: "This company does not have this module enabled. Activate it from company administration or switch to a tenant that already includes it."
          })
        : localizeText({
            es: "Tu rol no tiene los permisos necesarios para operar esta área. Solicita el acceso correspondiente a un administrador de la empresa.",
            en: "Your role does not have the permissions required to operate this area. Request the appropriate access from a company administrator."
          })}
      primaryAction={isMissingModule
        ? { label: localizeText({ es: "Revisar módulos de empresa", en: "Review company modules" }), href: "/platform/modules" }
        : { label: localizeText({ es: "Volver al tablero", en: "Go back to dashboard" }), href: "/dashboard" }}
      secondaryAction={isMissingModule
        ? { label: localizeText({ es: "Volver al tablero", en: "Go back to dashboard" }), href: "/dashboard" }
        : { label: localizeText({ es: "Cambiar de empresa", en: "Switch company" }), href: "/dashboard" }}
    />
  );
}
