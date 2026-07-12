# ARCONT Detailed Permissions Matrix

## 1. Objetivo

Definir un modelo de permisos enterprise para ARCONT por módulo y rol, cuidando:
- segregación de funciones,
- control multinivel,
- operación multiempresa / multiobra,
- acceso restringido por proyecto, etapa, torre, unidad, frente o activo.

## 2. Leyenda de niveles

| Código | Significado |
| --- | --- |
| `N` | Sin acceso |
| `V` | Vista y exportación dentro de su alcance |
| `O` | Operación: crear, editar y cerrar registros dentro de su alcance |
| `A` | Aprobación: puede autorizar hitos, cambios o cierres |
| `X` | Administración: parametrización, plantillas, catálogos, integraciones y reasignaciones |
| `P` | Portal externo acotado a sus propios registros |

## 3. Roles considerados

### Plataforma y gobierno
- `platform_admin`
- `tenant_admin`
- `security_admin`
- `gerente_ti`

### Dirección
- `director_general`
- `director_desarrollo`
- `director_comercial`
- `director_financiero`
- `director_operaciones`

### Gestión y ejecución
- `bim_manager`
- `project_controls_manager`
- `gerente_construccion`
- `supervisor_residente`
- `coordinador_calidad`
- `gerente_compras`
- `almacenista`
- `contabilidad_tesoreria`
- `control_costos`
- `legal_compliance`
- `postventa_manager`
- `facility_manager`
- `auxiliar_operativo`

### Externos
- `contratista_subcontratista`
- `proveedor`
- `cliente_portal`

## 4. Reglas base de alcance

- Todo acceso operativo queda acotado por `tenant`, `empresa`, `proyecto` y, cuando aplique, por `etapa`, `torre`, `frente`, `unidad` o `activo`.
- Los roles externos nunca ven información transversal del portafolio.
- Los directores ven consolidado y exportable, pero no necesariamente pueden editar.
- Los flujos con efecto financiero o legal deben pasar por aprobación explícita.
- La evidencia de auditoría es obligatoria para cambios críticos en compras, contratos, cierres, entregas y liberaciones.

## 5. Matriz por módulo

## 5.1 Development Planning

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin` |
| `A` | `director_desarrollo`, `director_general` |
| `O` | `bim_manager`, `control_costos` |
| `V` | `director_comercial`, `director_financiero`, `director_operaciones`, `project_controls_manager`, `gerente_construccion` |
| `N` | `almacenista`, `contabilidad_tesoreria`, `contratista_subcontratista`, `proveedor`, `cliente_portal` |

Notas:
- Solo `director_desarrollo` puede aprobar cambios mayores en sembrados, mezcla de producto y masterplan.
- Los escenarios cerrados se congelan y quedan auditables.

## 5.2 Commercial Intelligence

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `director_comercial` |
| `A` | `director_comercial`, `director_general` |
| `O` | `postventa_manager`, `auxiliar_operativo` |
| `V` | `director_desarrollo`, `director_financiero`, `director_operaciones`, `legal_compliance` |
| `P` | `cliente_portal` |
| `N` | `almacenista`, `contratista_subcontratista`, `proveedor` |

Notas:
- El rol comercial operativo puede gestionar leads, oportunidades, reservas y cierres dentro del proyecto asignado.
- La disponibilidad comprometida de unidades requiere reglas anti-colisión.

## 5.3 Customer Journey and Post-Sales

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `postventa_manager` |
| `A` | `director_comercial`, `director_operaciones` |
| `O` | `postventa_manager`, `auxiliar_operativo`, `facility_manager` |
| `V` | `legal_compliance`, `director_general`, `director_financiero` |
| `P` | `cliente_portal` |
| `N` | `almacenista`, `proveedor` |

Notas:
- El cliente solo ve su expediente, unidad, citas, documentos, entregas y tickets.
- Las garantías ligadas a contratistas requieren trazabilidad de responsable y vencimiento.

## 5.4 Omnichannel Service Cloud

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `gerente_ti`, `postventa_manager` |
| `A` | `director_comercial`, `director_operaciones` |
| `O` | `postventa_manager`, `facility_manager`, `auxiliar_operativo` |
| `V` | `director_general`, `legal_compliance` |
| `P` | `cliente_portal`, `proveedor` |
| `N` | `almacenista` |

Notas:
- La configuración de `IVR`, números, colas y bots es exclusiva de TI o tenant admin.
- Las grabaciones de llamadas y transcripciones siguen políticas de retención.

## 5.5 ERP Core

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `gerente_ti` |
| `A` | `director_financiero`, `gerente_compras`, `control_costos` |
| `O` | `almacenista`, `contabilidad_tesoreria`, `auxiliar_operativo`, `gerente_compras`, `control_costos` |
| `V` | `director_general`, `director_operaciones`, `gerente_construccion`, `legal_compliance` |
| `P` | `proveedor` |
| `N` | `cliente_portal` |

Notas:
- `proveedor` solo ve órdenes, recepciones, facturas y documentación propia.
- `almacenista` no puede aprobar órdenes de compra ni pagos.
- `contabilidad_tesoreria` no debe crear proveedores sin control adicional.

## 5.6 Field App

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin` |
| `A` | `gerente_construccion`, `director_operaciones` |
| `O` | `supervisor_residente`, `coordinador_calidad`, `almacenista`, `auxiliar_operativo`, `contratista_subcontratista` |
| `V` | `project_controls_manager`, `facility_manager`, `director_general` |
| `N` | `proveedor`, `cliente_portal` |

Notas:
- `contratista_subcontratista` solo puede ver y cargar en actividades asignadas.
- `almacenista` solo opera movimientos materiales y recepciones vinculadas a obra.

## 5.7 Lean Construction OS

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin` |
| `A` | `project_controls_manager`, `director_operaciones`, `gerente_construccion` |
| `O` | `supervisor_residente`, `contratista_subcontratista`, `auxiliar_operativo` |
| `V` | `director_general`, `director_desarrollo`, `coordinador_calidad`, `control_costos` |
| `N` | `proveedor`, `cliente_portal` |

Notas:
- La aprobación de baseline Lean y takt debe recaer en controls o construcción.
- Los contratistas responden restricciones, compromisos y causas de no cumplimiento, pero no parametrizan el sistema.

## 5.8 Handover and Commissioning

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `bim_manager` |
| `A` | `director_operaciones`, `gerente_construccion`, `coordinador_calidad` |
| `O` | `supervisor_residente`, `facility_manager`, `contratista_subcontratista`, `auxiliar_operativo` |
| `V` | `director_general`, `legal_compliance`, `postventa_manager` |
| `P` | `cliente_portal` |
| `N` | `proveedor` |

Notas:
- El cliente puede ver únicamente documentos, citas y checklist de su entrega.
- La liberación final requiere evidencia, responsable, fecha y firma digital o registro equivalente.

## 5.9 Property Operations

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `facility_manager` |
| `A` | `director_operaciones`, `postventa_manager` |
| `O` | `facility_manager`, `postventa_manager`, `auxiliar_operativo`, `contratista_subcontratista` |
| `V` | `director_general`, `director_financiero`, `legal_compliance` |
| `P` | `cliente_portal`, `proveedor` |
| `N` | `almacenista` |

Notas:
- Las órdenes de trabajo externas quedan acotadas por activo y SLA.
- Postventa opera incidencias iniciales; facility opera mantenimiento y continuidad.

## 5.10 BIM Hub

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `bim_manager` |
| `A` | `director_desarrollo`, `director_operaciones` |
| `O` | `bim_manager`, `project_controls_manager`, `facility_manager` |
| `V` | `director_general`, `director_comercial`, `supervisor_residente`, `coordinador_calidad`, `postventa_manager` |
| `N` | `cliente_portal`, `proveedor` |

Notas:
- Solo BIM puede versionar, mapear entidades y publicar modelos operativos.
- Comercial ve vistas controladas y atributos comerciales, no todo el modelo técnico.

## 5.11 Hardware Integration Layer

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `gerente_ti` |
| `A` | `director_operaciones`, `facility_manager` |
| `O` | `facility_manager`, `auxiliar_operativo` |
| `V` | `director_general`, `director_financiero`, `postventa_manager` |
| `N` | `contratista_subcontratista`, `proveedor`, `cliente_portal` |

Notas:
- Altas de dispositivos, credenciales, gateways y reglas de automatización son funciones restringidas.
- Toda telemetría sensible queda bajo auditoría y retención.

## 5.12 AI Copilot

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `gerente_ti`, `security_admin` |
| `A` | `director_general`, `director_operaciones`, `director_comercial` |
| `O` | `postventa_manager`, `facility_manager`, `project_controls_manager`, `control_costos`, `legal_compliance` |
| `V` | `supervisor_residente`, `coordinador_calidad`, `contabilidad_tesoreria`, `director_financiero` |
| `P` | `cliente_portal`, `proveedor` |

Notas:
- Los bots externos solo responden sobre información permitida por el scope del canal.
- Las acciones sugeridas por IA no sustituyen aprobaciones humanas en finanzas, legal y liberaciones.

## 5.13 Legal and Compliance

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `legal_compliance` |
| `A` | `legal_compliance`, `director_general` |
| `O` | `auxiliar_operativo`, `postventa_manager`, `gerente_compras` |
| `V` | `director_financiero`, `director_comercial`, `director_desarrollo`, `director_operaciones` |
| `P` | `cliente_portal`, `proveedor` |
| `N` | `contratista_subcontratista` |

Notas:
- Solo legal puede cerrar expedientes críticos, contratos y permisos regulatorios.
- Clientes y proveedores solo acceden a documentos propios publicados para ellos.

## 5.14 Reporting and BI

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `gerente_ti` |
| `A` | `director_general`, `director_financiero`, `director_operaciones`, `director_comercial`, `director_desarrollo` |
| `O` | `control_costos`, `project_controls_manager`, `postventa_manager`, `facility_manager`, `legal_compliance` |
| `V` | `supervisor_residente`, `coordinador_calidad`, `gerente_compras`, `contabilidad_tesoreria`, `bim_manager` |
| `N` | `cliente_portal`, `proveedor` |

Notas:
- Los tableros se filtran automáticamente por alcance organizacional.
- La exportación masiva puede requerir política adicional para datos sensibles.

## 5.15 Executive Dashboard

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin` |
| `A` | `director_general` |
| `O` | `director_financiero`, `director_operaciones`, `director_comercial`, `director_desarrollo` |
| `V` | `gerente_ti`, `control_costos`, `project_controls_manager`, `facility_manager`, `legal_compliance` |
| `N` | `contratista_subcontratista`, `proveedor`, `cliente_portal` |

Notas:
- Los directores pueden configurar vistas, metas y alertas dentro de su dominio.
- Solo dirección general puede ver portafolio consolidado total y comparativos interempresa cuando aplique.

## 5.16 Sustainability and CapEx Intelligence

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `gerente_ti` |
| `A` | `director_general`, `director_financiero`, `director_operaciones` |
| `O` | `facility_manager`, `control_costos` |
| `V` | `director_desarrollo`, `postventa_manager`, `legal_compliance` |
| `N` | `contratista_subcontratista`, `proveedor`, `cliente_portal` |

Notas:
- Los escenarios de CapEx son visibles para finanzas y operaciones, pero solo se formalizan vía workflow.
- Las métricas ESG pueden requerir pistas de auditoría separadas.

## 5.17 Configuración e identidad

| Nivel | Roles |
| --- | --- |
| `X` | `platform_admin`, `tenant_admin`, `security_admin`, `gerente_ti` |
| `A` | `security_admin` |
| `O` | `gerente_ti` |
| `V` | `director_general` |
| `N` | Todos los demás |

Notas:
- Aquí viven `SSO`, `SAML/OIDC`, políticas de MFA, integraciones, catálogos, entornos y plantillas.
- Ningún usuario operativo debe poder escalar su propio privilegio.

## 6. Segregación mínima obligatoria

- Crear proveedor y aprobar pago no puede recaer en la misma persona.
- Emitir requisición y aprobar orden de compra no puede recaer en la misma persona.
- Registrar recepción de material y conciliar factura no puede recaer en la misma persona.
- Capturar avance y aprobar estimación financiera no puede recaer en la misma persona.
- Cerrar punch list y liberar entrega final no puede recaer en la misma persona sin control de calidad.
- Crear contrato y aprobar versión legal final no puede recaer en la misma persona.

## 7. Recomendación de implementación

- Implementar `RBAC + scoping` desde el primer release.
- Añadir `approval policies` configurables por monto, proyecto, tipo de contrato y criticidad.
- Activar `audit trail` inmutable para legal, finanzas, entregas y cambios de permisos.
- Hacer revisiones trimestrales de acceso y recertificación para roles sensibles.
