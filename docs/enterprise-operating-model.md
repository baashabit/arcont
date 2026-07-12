# ARCONT Enterprise Operating Model

## 1. Objetivo

Definir como opera ARCONT a nivel enterprise dentro de una desarrolladora, constructora u operador inmobiliario, incluyendo:
- estructura de suites,
- roles clave,
- matriz RACI,
- permisos por tipo de usuario,
- y ownership por proceso.

## 2. Estructura General de la Suite

### Office Suite
- ERP Core
- Development Planning
- Commercial Intelligence
- Legal and Compliance
- Reporting and BI
- Executive Dashboard

### Field Suite
- Field App
- Lean Construction OS
- Property Operations
- Handover and Commissioning

### Customer and Service Suite
- Customer Journey and Post-Sales
- Omnichannel Service Cloud

### Connected Asset and Intelligence Suite
- BIM Hub
- AI Copilot
- Hardware Integration Layer
- Sustainability and CapEx Intelligence

## 3. Roles Enterprise

### Direccion
- Director general
- Director de operaciones
- Director financiero
- Director comercial
- Director de desarrollo inmobiliario

### Gerencial y corporativo
- BIM manager
- Lean / project controls manager
- Gerente de construccion
- Gerente de administracion
- Gerente de compras
- Gerente de postventa
- Gerente legal
- Gerente de TI / sistemas

### Operacion y campo
- Supervisor / residente
- Coordinador de calidad
- Coordinador de seguridad
- Almacenista
- Auxiliar administrativo
- Auxiliar de obra
- Facility manager
- Coordinador de mantenimiento

### Externos / terceros
- Contratista
- Subcontratista
- Proveedor
- Cliente / comprador

## 4. Matriz de Modulos por Rol

| Rol | Modulos principales |
| --- | --- |
| Director general | Executive Dashboard, Reporting and BI |
| Director financiero | ERP Core, Reporting and BI, Executive Dashboard |
| Director comercial | Commercial Intelligence, Customer Journey and Post-Sales, Reporting and BI |
| Director de desarrollo inmobiliario | Development Planning, Commercial Intelligence, Reporting and BI |
| Director de operaciones | Lean Construction OS, Property Operations, Executive Dashboard |
| BIM manager | BIM Hub, Handover and Commissioning |
| Lean / project controls | Lean Construction OS, Field App, Reporting and BI |
| Supervisor / residente | Field App, Lean Construction OS, Handover and Commissioning |
| Calidad | Field App, Handover and Commissioning, Reporting and BI |
| Compras | ERP Core, Reporting and BI |
| Almacenista | ERP Core, Field App |
| Contabilidad / tesoreria | ERP Core, Reporting and BI |
| Legal / compliance | Legal and Compliance, Reporting and BI |
| Postventa | Customer Journey and Post-Sales, Omnichannel Service Cloud, Property Operations |
| Facility manager | Property Operations, Hardware Integration Layer, AI Copilot |
| Contratista / subcontratista | Field App, Lean Construction OS, Handover and Commissioning |
| Cliente / comprador | Customer Journey and Post-Sales, portal cliente |

## 5. Matriz RACI de Procesos Clave

Leyenda:
- `R`: Responsible
- `A`: Accountable
- `C`: Consulted
- `I`: Informed

### 5.1 Sembrados y desarrollo de producto

| Proceso | Dir. desarrollo | Comercial | Costos | BIM | Direccion |
| --- | --- | --- | --- | --- | --- |
| Definir sembrados | A | C | C | R | I |
| Cambiar mezcla de producto | A | R | C | C | I |
| Aprobar version masterplan | R | C | C | C | A |

### 5.2 Presupuesto, compras y almacen

| Proceso | Costos | Compras | Almacen | Contabilidad | Direccion ops |
| --- | --- | --- | --- | --- | --- |
| Crear presupuesto base | A | I | I | C | R |
| Emitir requisicion | C | A | R | I | C |
| Aprobar orden de compra | C | R | I | C | A |
| Recibir material | I | C | A | I | R |
| Conciliar recepcion vs factura | I | I | C | A | C |

### 5.3 Avance, calidad y Lean

| Proceso | Supervisor | Lean / controls | Calidad | Contratista | Gerente construccion |
| --- | --- | --- | --- | --- | --- |
| Capturar avance diario | A | C | I | R | I |
| Gestionar restricciones | R | A | I | C | C |
| Medir PPC | C | A | I | R | I |
| Liberar calidad | C | I | A | R | I |
| Cerrar punch list | R | I | A | C | I |

### 5.4 Comercial, cierre y postventa

| Proceso | Ventas | Postventa | Legal | Comercial dir. | Cliente |
| --- | --- | --- | --- | --- | --- |
| Gestionar lead | R | I | I | A | C |
| Reservar unidad | R | I | I | A | C |
| Preparar expediente de cierre | C | I | A | R | C |
| Entrega al cliente | I | A | C | R | C |
| Atender garantia | I | A | C | I | R |

### 5.5 Operacion del activo

| Proceso | Facility | Mantenimiento | Postventa | Operaciones dir. | Cliente/residente |
| --- | --- | --- | --- | --- | --- |
| Recibir ticket | C | R | A | I | C |
| Priorizar ticket | A | R | C | I | I |
| Ejecutar orden de trabajo | C | A | I | I | I |
| Cerrar incidencia | A | R | C | I | C |

## 6. Modelo de Permisos Recomendado

### Nivel 1: Plataforma
- `platform_admin`
- `tenant_admin`
- `security_admin`

### Nivel 2: Corporativo
- `executive_viewer`
- `corporate_manager`
- `compliance_manager`
- `finance_manager`

### Nivel 3: Proyecto / activo
- `project_manager`
- `commercial_manager`
- `construction_manager`
- `operations_manager`
- `postsales_manager`

### Nivel 4: Operativo
- `site_supervisor`
- `quality_operator`
- `warehouse_operator`
- `buyer_operator`
- `accounting_operator`
- `field_auxiliar`

### Nivel 5: Externo
- `contractor_user`
- `supplier_user`
- `customer_portal_user`

## 7. Segregacion de Funciones Minima

Estas combinaciones no deberian recaer en una sola persona sin control adicional:
- crear proveedor y aprobar pago
- emitir requisicion y aprobar orden de compra
- registrar recepcion y conciliar factura
- crear contrato y autoaprobar cambios legales
- capturar avance y autoaprobar estimacion financiera
- cerrar punch list y aprobar liberacion final sin control de calidad

## 8. Flujos de Aprobacion Recomendados

### Compras
1. Requisicion
2. Validacion presupuesto
3. Aprobacion jefe directo
4. Aprobacion por monto
5. Orden de compra
6. Recepcion
7. Cuenta por pagar

### Legal
1. Solicitud contractual
2. Version preliminar
3. Revision legal
4. Ajustes
5. Aprobacion negocio
6. Firma
7. Resguardo documental

### Postventa
1. Entrada ticket
2. Clasificacion
3. Validacion garantia
4. Asignacion responsable
5. Resolucion
6. Confirmacion cliente
7. Cierre

## 9. KPIs por Area

### Desarrollo
- absorcion por sembrado
- velocidad de colocacion por etapa
- margen por mezcla de producto

### Construccion
- PPC
- restricciones abiertas
- retrabajo
- avance fisico vs programado

### Compras y almacen
- tiempo requisicion a orden
- fill rate de almacen
- rotacion de inventario

### Finanzas y costos
- desviacion costo vs presupuesto
- costo comprometido vs ejercido
- flujo comprometido

### Comercial
- conversion lead a reserva
- conversion reserva a cierre
- tiempo medio de cierre

### Postventa y servicio
- SLA cumplido
- first contact resolution
- satisfaccion cliente

### Operacion
- MTTR
- disponibilidad de equipos
- consumo anomalo detectado

## 10. Recomendacion de Implantacion

### Wave 1
- CRM
- ERP core basico
- Field app basica
- BIM hub

### Wave 2
- Lean
- costos
- handover
- postventa

### Wave 3
- omnicanalidad
- hardware
- reporting enterprise
- legal/compliance

### Wave 4
- IA avanzada
- forecasting
- portfolio intelligence

