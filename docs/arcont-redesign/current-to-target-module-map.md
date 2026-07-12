# ARCONT Current to Target Module Map

## Objetivo

Mapear los módulos visibles del sistema actual hacia la nueva arquitectura propuesta para que la migración tenga una lógica clara.

## 1. Comercial

| Módulo actual | Suite destino | Vista objetivo |
| --- | --- | --- |
| `prospectos` | Commercial Suite | `CRM Prospectos` |
| `proyectos` | Commercial Suite | `Inventario de Vivienda` |
| `alta_venta` | Commercial Suite | `Cliente 360` / cierre comercial |
| `contado` | Commercial Suite | flujo de cierre contado |
| `validacion_venta` | Commercial Suite | pre-cierre / validación |

## 2. Cierre y legal

| Módulo actual | Suite destino | Vista objetivo |
| --- | --- | --- |
| `gestoria` | Gestoria Suite | `Gestoría y Titulación` |
| `notaria` | Gestoria Suite | catálogos y relación notarial |
| `avaluos` | Gestoria Suite | expediente / checklist documental |
| `unidad_valuadora` | Gestoria Suite | catálogo de terceros |

## 3. Operación

| Módulo actual | Suite destino | Vista objetivo |
| --- | --- | --- |
| `blackboard` | Operations Suite | `Blackboard Operativo` |
| `blackboard/nuevo` | Operations Suite | alta de tarea |
| `blackboard/multiple` | Operations Suite | carga masiva y planeación |

## 4. Backoffice

| Módulo actual | Suite destino | Vista objetivo |
| --- | --- | --- |
| `requisicion` | Backoffice Suite | `Backoffice y Requisiciones` |
| `pmat` | Backoffice Suite | materiales / abastecimiento |
| `usuarios` | Governance Suite | `Usuarios y Permisos` |
| `lineascredito` | Backoffice Suite | catálogos financieros |
| `lugares_prospeccion` | Backoffice Suite | catálogos comerciales |

## 5. Dirección

| Fuente actual | Suite destino | Vista objetivo |
| --- | --- | --- |
| ventas + prospectos + gestoría + blackboard + requisiciones | Executive Suite | `Executive Dashboard` |

## 6. Vistas nuevas críticas

Estas vistas no aparecen explícitas como módulo aislado en el sistema actual, pero son las que más valor agregan al rediseño:

- `Cliente 360`
- `Expediente de Gestoría`
- `Inventario vivo`
- `Usuarios y Permisos` con governance real

## 7. Prioridad de migración sugerida

1. `login`
2. `shell + navegación`
3. `dashboard ejecutivo`
4. `CRM Prospectos`
5. `Inventario`
6. `Cliente 360`
7. `Gestoría`
8. `Expediente`
9. `Blackboard`
10. `Backoffice`
11. `Usuarios y permisos`
