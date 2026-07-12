# ARCONT Information Architecture and Navigation

## 1. Objetivo

Definir la arquitectura de información de ARCONT para que el producto se entienda como una suite enterprise coherente y usable por roles de oficina, campo, dirección y servicio.

## 2. Principios de Navegación

- Navegación por dominios de negocio, no por tecnología
- Menús diferentes según rol, pero con un modelo mental común
- Global search como punto central
- El usuario siempre debe saber:
  - en qué proyecto está
  - en qué etapa/torre/unidad está
  - qué acciones puede ejecutar

## 3. Navegación Principal Recomendada

### Home
- resumen por rol
- tareas pendientes
- alertas
- indicadores rápidos

### Desarrollo
- sembrados
- masterplan
- mezcla de producto
- etapas

### Comercial
- leads
- pipeline
- reservas
- unidades
- cierres
- clientes

### ERP
- presupuesto
- costos
- compras
- almacén
- contratos
- cuentas por pagar
- cuentas por cobrar

### Campo
- avance
- calidad
- seguridad
- incidencias
- evidencias

### Lean
- lookahead
- restricciones
- PPC
- takt
- compromisos

### Entrega
- punch list
- commissioning
- readiness
- handover

### Postventa
- tickets
- garantías
- clientes
- SLA
- satisfacción

### Activo
- BIM / digital twin
- espacios
- equipos
- hardware
- mantenimiento

### Legal
- expedientes
- permisos
- obligaciones
- contratos
- alertas legales

### Reportes
- dashboards
- reportes operativos
- reportes financieros
- reportes comerciales
- reportes legales

### Configuración
- empresas
- proyectos
- usuarios
- roles
- flujos
- integraciones

## 4. Navegación por Perfil

## 4.1 Dirección

### Menú ideal
- Home
- Reportes
- Desarrollo
- Comercial
- ERP
- Activo

### Necesidades
- lectura ejecutiva
- comparativos
- aprobaciones críticas

## 4.2 Desarrollo Inmobiliario

### Menú ideal
- Home
- Desarrollo
- Comercial
- Reportes
- Legal

### Necesidades
- sembrados
- etapas
- mezcla de producto
- absorción

## 4.3 Comercial / Ventas

### Menú ideal
- Home
- Comercial
- Clientes
- Reportes
- Postventa

### Necesidades
- velocidad
- claridad de inventario
- trazabilidad de lead a cierre

## 4.4 Compras / Costos / Finanzas

### Menú ideal
- Home
- ERP
- Reportes
- Legal

### Necesidades
- control
- aprobaciones
- comparativos
- trazabilidad documental

## 4.5 Supervisor / Residente / Calidad

### Menú ideal
- Home
- Campo
- Lean
- Entrega
- Activo

### Necesidades
- captura rápida
- poco texto
- evidencias
- tareas del día

## 4.6 Contratista

### Menú ideal
- Home
- Campo
- Lean
- Entrega

### Necesidades
- ver solo lo asignado
- responder restricciones
- cargar evidencias

## 4.7 Facility / Operación

### Menú ideal
- Home
- Activo
- Postventa
- Reportes

### Necesidades
- tickets
- equipos
- mantenimiento
- sensores

## 4.8 Cliente / Comprador

### Menú ideal
- Home portal
- Mi unidad
- Documentos
- Entrega
- Postventa

### Necesidades
- simplicidad extrema
- visibilidad de estatus
- comunicación

## 5. Objetos Principales del Sistema

### Estructura organizacional
- tenant
- empresa
- proyecto
- etapa
- torre
- piso

### Producto inmobiliario
- sembrado
- unidad
- lote
- prototipo
- tipología

### Construcción
- frente
- actividad
- restricción
- compromiso
- avance
- no conformidad
- punch item

### Administrativos
- presupuesto
- requisición
- orden de compra
- entrada almacén
- salida almacén
- factura
- contrato

### Cliente
- lead
- oportunidad
- reserva
- cierre
- expediente
- ticket postventa

### Activo
- espacio
- equipo
- sistema
- sensor
- alerta
- orden de trabajo

## 6. Pantallas Clave

## 6.1 Home por rol
- KPIs
- pendientes
- alertas
- accesos rápidos

## 6.2 Vista de proyecto
- resumen general
- avance
- costos
- comercial
- riesgos

## 6.3 Vista de unidad
- atributos
- estado comercial
- estado constructivo
- expediente
- postventa

## 6.4 Vista de frente / campo
- tareas
- evidencias
- calidad
- restricciones

## 6.5 Vista de activo / equipo
- ubicación BIM
- historial
- telemetría
- tickets

## 6.6 Bandeja unificada
- tickets
- chats
- llamadas
- alertas
- aprobaciones

## 7. Search and Command Center

### Global search
Debe encontrar:
- unidades
- clientes
- contratos
- tickets
- proveedores
- equipos
- documentos
- requisiciones

### Quick actions
- crear requisición
- capturar avance
- abrir ticket
- registrar evidencia
- aprobar documento
- buscar unidad

## 8. Notificaciones

### Tipos
- operativas
- comerciales
- financieras
- legales
- técnicas

### Canales
- in-app
- correo
- WhatsApp
- push móvil

## 9. Recomendación UX

- Web para office/dirección
- Móvil para campo
- Portal simplificado para cliente
- IA como capa transversal, no como navegación principal

## 10. Menú Inicial Recomendado para V1

### Web
- Home
- Comercial
- ERP
- Campo
- Lean
- Entrega
- Activo
- Reportes
- Configuración

### App de campo
- Inicio
- Mis tareas
- Avance
- Calidad
- Evidencias
- Restricciones
- Entrega

### Portal cliente
- Mi unidad
- Estatus
- Documentos
- Entrega
- Postventa

