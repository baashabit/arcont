"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { type NavigationItem, navigationGroups, navigationItems } from "@/lib/navigation";

const primaryWorkflowHrefs = [
  "/projects",
  "/operations",
  "/field",
  "/daily-log",
  "/procurement/requisitions",
  "/supplier-master",
  "/accounts-payable",
  "/treasury/payment-runs"
];

const commercialWorkflowHrefs = ["/crm", "/estimations", "/cash-flow", "/post-sale"];
const governanceWorkflowHrefs = ["/platform/companies", "/platform/settings", "/platform/users", "/platform/modules"];

export default function WorkspaceHomePage() {
  const {
    activeCompany,
    isHydratingSession,
    isRefreshingPlatform,
    session,
    source,
    isRouteVisible,
    localizeText
  } = useAppState();

  const visibleNavigation = useMemo(
    () =>
      navigationItems.filter((item) =>
        isRouteVisible({ moduleKeys: item.moduleKeys, requiredPermissions: item.requiredPermissions })
      ),
    [isRouteVisible]
  );

  const visiblePrimaryWorkflows = useMemo(
    () =>
      primaryWorkflowHrefs
        .map((href) => navigationItems.find((item) => item.href === href))
        .filter((item): item is NavigationItem => Boolean(item)),
    []
  );

  const launchpadItems = useMemo(
    () =>
      visiblePrimaryWorkflows.filter((item) =>
        item
          ? isRouteVisible({ moduleKeys: item.moduleKeys, requiredPermissions: item.requiredPermissions })
          : false
      ),
    [isRouteVisible, visiblePrimaryWorkflows]
  );
  const commercialLaunchpad = useMemo(
    () =>
      commercialWorkflowHrefs
        .map((href) => navigationItems.find((item) => item.href === href))
        .filter((item): item is NavigationItem => Boolean(item))
        .filter((item) =>
          isRouteVisible({ moduleKeys: item.moduleKeys, requiredPermissions: item.requiredPermissions })
        ),
    [isRouteVisible]
  );
  const governanceLaunchpad = useMemo(
    () =>
      governanceWorkflowHrefs
        .map((href) => navigationItems.find((item) => item.href === href))
        .filter((item): item is NavigationItem => Boolean(item))
        .filter((item) =>
          isRouteVisible({ moduleKeys: item.moduleKeys, requiredPermissions: item.requiredPermissions })
        ),
    [isRouteVisible]
  );

  const domainReadiness = useMemo(
    () =>
      navigationGroups
        .map((group) => {
          const total = navigationItems.filter((item) => item.domain === group.key).length;
          const visible = visibleNavigation.filter((item) => item.domain === group.key).length;
          return { ...group, total, visible };
        })
        .filter((group) => group.total > 0),
    [visibleNavigation]
  );

  const startupChecklist = useMemo(
    () => [
      {
        label: { es: "Confirma la empresa activa y el país operativo", en: "Confirm the active company and operating country" },
        detail: {
          es: `${activeCompany.tradeName} está activa bajo ${activeCompany.countryCode}.`,
          en: `${activeCompany.tradeName} is active under ${activeCompany.countryCode}.`
        }
      },
      {
        label: { es: "Abre un flujo y crea el primer registro", en: "Open one workflow and create the first record" },
        detail: {
          es: "Field, requisitions, supplier master y daily log son las rutas más rápidas para validar uso real.",
          en: "Field, requisitions, supplier master and daily log are the fastest routes to validate real usage."
        }
      },
      {
        label: {
          es: "Usa dashboard solo como orientación, no como punto inicial",
          en: "Use dashboard only as orientation, not as the first work surface"
        },
        detail: {
          es: "Los usuarios necesitan primero una entrada operable y después analítica.",
          en: "Human users need a launchpad first and directional analytics second."
        }
      }
    ],
    [activeCompany.countryCode, activeCompany.tradeName]
  );
  const roleStartAdvice = useMemo(
    () => [
      {
        title: { es: "Operador de proyecto / obra", en: "Project / site operator" },
        detail: {
          es: "Empieza en projects, field o daily log y captura primero un movimiento real.",
          en: "Start in projects, field or daily log and create or update a live execution record first."
        },
        links: ["/projects", "/field", "/daily-log"]
      },
      {
        title: { es: "Operador de compras / proveedores", en: "Procurement / supplier operator" },
        detail: {
          es: "Empieza en requisitions o supplier master antes de pasar a aprobaciones, recepciones o pagos.",
          en: "Start in requisitions or supplier master before jumping into approvals, receiving or payables."
        },
        links: ["/procurement/requisitions", "/supplier-master", "/procurement/purchase-orders"]
      },
      {
        title: { es: "Operador financiero / plataforma", en: "Finance / platform operator" },
        detail: {
          es: "Empieza en estimations, accounts payable o company settings según si pruebas operación o configuración.",
          en: "Start in estimations, accounts payable or company settings depending on whether you are testing operations or tenant configuration."
        },
        links: ["/estimations", "/accounts-payable", "/platform/settings"]
      }
    ],
    []
  );

  const enabledModules = activeCompany.enabledModules.length;

  return (
    <AppShell
      title={{ es: "Inicio operativo", en: "Operational home" }}
      eyebrow={{ es: "Empezar", en: "Start here" }}
      description={{
        es: "Entrada práctica para iniciar flujos reales, validar módulos y operar la suite sin adivinar a dónde ir.",
        en: "A practical entry point to launch real workflows, validate modules and start operating the suite without guessing where to go first."
      }}
      actions={
        <Badge tone={session.authenticated ? "success" : "warning"}>
          {isHydratingSession || isRefreshingPlatform
            ? localizeText({ es: "actualizando", en: "refreshing" })
            : session.authenticated
              ? localizeText({ es: "sesion activa", en: "live session" })
              : localizeText({ es: "modo respaldo", en: "fallback mode" })}
        </Badge>
      }
    >
      <section className="heroPanel">
        <div>
          <h2>{localizeText({ es: "Empieza operando, no explorando.", en: "Start by operating, not by exploring." })}</h2>
          <p>{localizeText({
            es: "Selecciona la empresa, entra al flujo correcto y captura una primera acción real. El sistema debe sentirse útil desde el primer clic.",
            en: "Select the company, enter the right workflow and capture a first real action. The system should feel useful from the first click."
          })}</p>
          <div className="heroMetrics">
            <div className="heroMetric">
              <strong>{activeCompany.tradeName}</strong>
              <span>{localizeText({ es: "Empresa activa para pruebas y operación", en: "Current tenant selected for testing and operation" })}</span>
            </div>
            <div className="heroMetric">
              <strong>{launchpadItems.length}</strong>
              <span>{localizeText({ es: "Flujos principales listos para probar", en: "Core workflows ready to test immediately" })}</span>
            </div>
            <div className="heroMetric">
              <strong>{enabledModules}</strong>
              <span>{localizeText({ es: "Módulos habilitados para esta empresa", en: "Modules enabled for this tenant footprint" })}</span>
            </div>
          </div>
        </div>

        <Card
          title={localizeText({ es: "Secuencia rápida", en: "Quick sequence" })}
          description={localizeText({ es: "Tres pasos para validar si la suite ya se siente operable.", en: "Three steps to validate whether the suite already feels operable." })}
          aside={<Badge tone={source === "api" ? "success" : "warning"}>{source}</Badge>}
        >
          <div className="list compactList">
            {startupChecklist.map((step) => (
              <div className="listItem" key={localizeText(step.label)}>
                <div>
                  <strong>{localizeText(step.label)}</strong>
                  <p>{localizeText(step.detail)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid cols4">
        <KpiCard
          label={localizeText({ es: "Flujos listos", en: "Launch workflows" })}
          value={String(launchpadItems.length)}
          footnote={localizeText({ es: "Rutas priorizadas para validar uso real.", en: "Routes prioritized for first-use validation instead of passive review." })}
        />
        <KpiCard
          label={localizeText({ es: "Rutas visibles", en: "Visible routes" })}
          value={String(visibleNavigation.length)}
          footnote={localizeText({ es: "Rutas accesibles para el rol activo.", en: "Routes accessible for the current tenant and role." })}
        />
        <KpiCard
          label={localizeText({ es: "Módulos activos", en: "Enabled modules" })}
          value={String(enabledModules)}
          footnote={localizeText({ es: "Cobertura activa de la suite en esta empresa.", en: "Suite footprint currently enabled on the active company." })}
        />
        <KpiCard
          label={localizeText({ es: "Estado de sesión", en: "Session posture" })}
          value={session.authenticated ? localizeText({ es: "Activa", en: "Live" }) : localizeText({ es: "Respaldo", en: "Fallback" })}
          footnote={localizeText({ es: "Indica si ya opera contra backend real.", en: "Shows whether the user is already operating against a live backend." })}
        />
      </section>

      <section className="grid cols2">
        <Card
          title={localizeText({ es: "Acceso rápido operativo", en: "Operational launchpad" })}
          description={localizeText({ es: "Destinos recomendados para pruebas humanas y trabajo diario.", en: "Recommended first destinations for real human testing and daily use." })}
        >
          <div className="workspaceLaunchGrid">
            {launchpadItems.map((item) => (
              <Link key={item.href} className="workspaceLaunchCard" href={item.href}>
                <div className="workspaceLaunchMeta">
                  <strong>{localizeText(item.label)}</strong>
                  <p>{localizeText(item.description)}</p>
                </div>
                <Badge tone="info">{localizeText("open")}</Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card
          title={localizeText({ es: "Mapa rápido de áreas", en: "Area quick map" })}
          description={localizeText({ es: "Qué partes están listas para operar con el rol actual.", en: "What parts are ready to operate with the active role." })}
        >
          <div className="list compactList">
            {domainReadiness.map((group) => (
              <div className="listItem" key={group.key}>
                <div>
                  <strong>{localizeText(group.label)}</strong>
                  <p>
                    {localizeText({
                      es: `${group.visible} de ${group.total} rutas visibles para el rol actual.`,
                      en: `${group.visible} of ${group.total} routes visible for the active tenant and role.`
                    })}
                  </p>
                </div>
                <Badge tone={group.visible > 0 ? "success" : "warning"}>
                  {group.visible > 0 ? localizeText({ es: "listo", en: "ready" }) : localizeText({ es: "limitado", en: "limited" })}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid cols3">
        <Card
          title={localizeText({ es: "Comercial a cobro", en: "Commercial to cash" })}
          description={localizeText({ es: "Usa esta ruta si la prueba es comercial o de cobranza.", en: "Start from selling, billing and collection if the test is revenue-driven." })}
        >
          <div className="workspaceLaunchGrid">
            {commercialLaunchpad.map((item) => (
              <Link key={item.href} className="workspaceLaunchCard" href={item.href}>
                <div className="workspaceLaunchMeta">
                  <strong>{localizeText(item.label)}</strong>
                  <p>{localizeText(item.description)}</p>
                </div>
                <Badge tone="info">{localizeText("open")}</Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card
          title={localizeText({ es: "Gobierno del tenant", en: "Tenant governance" })}
          description={localizeText({ es: "Usa estas rutas para configuración, usuarios y despliegue modular.", en: "Use these routes when the test is about modular rollout, users or company settings." })}
        >
          <div className="workspaceLaunchGrid">
            {governanceLaunchpad.map((item) => (
              <Link key={item.href} className="workspaceLaunchCard" href={item.href}>
                <div className="workspaceLaunchMeta">
                  <strong>{localizeText(item.label)}</strong>
                  <p>{localizeText(item.description)}</p>
                </div>
                <Badge tone="gold">{localizeText("setup")}</Badge>
              </Link>
            ))}
          </div>
        </Card>

        <Card
          title={localizeText({ es: "Primer paso por rol", en: "Role-based first move" })}
          description={localizeText({ es: "Guía simple para que el usuario no se pierda.", en: "Simple guidance so a human tester does not wander through the suite." })}
        >
          <div className="list compactList">
            {roleStartAdvice.map((item) => (
              <div className="listItem" key={localizeText(item.title)}>
                <div>
                  <strong>{localizeText(item.title)}</strong>
                  <p>{localizeText(item.detail)}</p>
                  <div className="row gap wrap" style={{ marginTop: 12 }}>
                    {item.links
                      .map((href) => navigationItems.find((entry) => entry.href === href))
                      .filter((entry): entry is NavigationItem => Boolean(entry))
                      .filter((entry) =>
                        isRouteVisible({
                          moduleKeys: entry.moduleKeys,
                          requiredPermissions: entry.requiredPermissions
                        })
                      )
                      .map((entry) => (
                        <Link key={entry.href} className="buttonGhost" href={entry.href}>
                          {localizeText(entry.label)}
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid cols3">
        <Card
          title={localizeText({ es: "Ejecución de obra", en: "Project execution" })}
          description={localizeText({ es: "Empieza la operación real desde planeación hasta cierre de campo.", en: "Start the real site journey from planning to field closure." })}
        >
          <div className="row gap wrap">
            <Link className="button" href="/projects">{localizeText({ es: "Abrir proyectos", en: "Open projects" })}</Link>
            <Link className="buttonGhost" href="/field">{localizeText({ es: "Abrir campo", en: "Open field" })}</Link>
            <Link className="buttonGhost" href="/daily-log">{localizeText({ es: "Abrir bitácora", en: "Open daily log" })}</Link>
            <Link className="buttonGhost" href="/quality">{localizeText({ es: "Abrir calidad", en: "Open quality" })}</Link>
          </div>
        </Card>

        <Card
          title={localizeText({ es: "Compras y proveedores", en: "Supply and suppliers" })}
          description={localizeText({ es: "Valida requisiciones, órdenes, expedientes y recepciones.", en: "Validate intake, approvals, vendor packet control and receiving." })}
        >
          <div className="row gap wrap">
            <Link className="button" href="/procurement/requisitions">{localizeText({ es: "Abrir requisiciones", en: "Open requisitions" })}</Link>
            <Link className="buttonGhost" href="/procurement/purchase-orders">{localizeText({ es: "Abrir órdenes", en: "Open purchase orders" })}</Link>
            <Link className="buttonGhost" href="/supplier-control">{localizeText({ es: "Abrir control de proveedor", en: "Open supplier control" })}</Link>
            <Link className="buttonGhost" href="/supplier-master">{localizeText({ es: "Abrir catálogo de proveedores", en: "Open supplier master" })}</Link>
          </div>
        </Card>

        <Card
          title={localizeText({ es: "Finanzas y liberación", en: "Finance and release" })}
          description={localizeText({ es: "Pasa a cuentas por pagar, tesorería y cierre después de validar la captura operativa.", en: "Move into AP, treasury and close only after validating upstream operational capture." })}
        >
          <div className="row gap wrap">
            <Link className="button" href="/accounts-payable">{localizeText({ es: "Abrir cuentas por pagar", en: "Open accounts payable" })}</Link>
            <Link className="buttonGhost" href="/treasury/payment-runs">{localizeText({ es: "Abrir tesorería", en: "Open treasury" })}</Link>
            <Link className="buttonGhost" href="/cash-flow">{localizeText({ es: "Abrir flujo de efectivo", en: "Open cash flow" })}</Link>
            <Link className="buttonGhost" href="/close-control">{localizeText({ es: "Abrir control de cierre", en: "Open close control" })}</Link>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
