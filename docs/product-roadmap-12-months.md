# ARCONT Product Roadmap 12 Months

## 1. Objetivo

Traducir la visión de `ARCONT Real Estate OS` en un roadmap realista de 12 meses, con entregables por trimestre, dependencias y objetivos de negocio.

## 2. Principios del Roadmap

- Empezar con un `pilot-first approach`
- Priorizar flujos que generen ROI visible
- Construir primero la base de datos y procesos antes que la automatización compleja
- Evitar demasiados módulos simultáneos sin adopción real
- Diseñar para escalabilidad enterprise desde el inicio, pero desplegar por olas

## 3. Metas de Año 1

- Lanzar un piloto funcional con una desarrolladora o constructora
- Validar el wedge `BIM + Lean + ERP básico + Field App`
- Demostrar valor en al menos 3 frentes:
  - control operativo
  - control comercial
  - control administrativo
- Dejar preparada la plataforma para expansión a postventa, hardware y operación

## 4. Roadmap Trimestral

## Q1: Foundation and Pilot Setup

### Objetivo
Montar la base técnica, el modelo de datos y el primer piloto controlado.

### Entregables
- Gestión de tenant, proyectos y usuarios
- Roles y permisos base
- BIM Hub v1
- Estructura de activos: proyecto > etapa > torre > piso > unidad > espacio > activo
- CRM básico
- ERP básico:
  - requisiciones
  - compras
  - almacén básico
  - presupuesto básico
- Field App v1:
  - avance diario
  - evidencia fotográfica
  - incidencias
- Reporting básico
- Dashboard ejecutivo inicial

### KPIs del trimestre
- 1 piloto activo
- 80% de estructura BIM mapeada
- 70% de usuarios clave onboarded
- 1 flujo de compra completo funcionando
- 1 flujo de avance diario funcionando

### Riesgos
- sobrecarga de alcance
- datos BIM incompletos
- baja adopción en campo

## Q2: Construction and Cost Control

### Objetivo
Convertir el producto en una herramienta de obra y control real.

### Entregables
- Lean Construction OS v1
  - lookahead
  - constraints log
  - PPC
- Quality module v1
  - checklists
  - punch list
  - evidencias
- Cost control v1
  - costo comprometido
  - costo real
  - variaciones
- Contratistas y subcontratistas
- Flujo de aprobaciones básico
- Almacén y trazabilidad de materiales
- Reportes de obra y costos

### KPIs del trimestre
- 60% de supervisores usando la Field App semanalmente
- PPC visible por frente o etapa
- 90% de requisiciones trazables a compra
- reporte de costo comprometido vs real disponible
- reducción del tiempo de captura de avance

### Riesgos
- resistencia de contratistas
- procesos de costos no estandarizados
- dependencia de trabajo manual previo del cliente

## Q3: Commercial, Delivery and Post-Sales

### Objetivo
Expandir hacia desarrolladora e inmobiliaria con ciclo de cliente más completo.

### Entregables
- Development Planning v1
  - sembrados
  - mezcla de producto
  - versión de masterplan
- Commercial Intelligence v1
  - pipeline
  - reservas
  - disponibilidad
  - fichas de unidad
- Customer Journey and Post-Sales v1
  - entrega
  - garantías
  - portal cliente
- Omnichannel Service Cloud v1
  - WhatsApp
  - chatbot básico
  - bandeja unificada
- Handover and Commissioning v1
- Legal and Compliance v1

### KPIs del trimestre
- trazabilidad de lead a unidad
- trazabilidad de unidad a entrega/postventa
- reducción de tiempos de respuesta postventa
- visibilidad del sembrado y absorción por etapa
- expedientes de entrega estructurados

### Riesgos
- demasiada complejidad comercial en un solo release
- integración lenta con CRM existente
- cambios frecuentes de proceso comercial del cliente

## Q4: Enterprise Expansion and Intelligence

### Objetivo
Llevar el producto a nivel multiobra/multiempresa y reforzar capacidades enterprise.

### Entregables
- Enterprise readiness completo
  - SSO
  - SAML/OIDC
  - auditoría
  - segregación de funciones
  - workflows multinivel
- Reporting and BI enterprise
  - programaciones
  - exportaciones
  - tableros por rol
- Hardware Integration Layer v1
  - 2-3 conectores productivos
- AI Copilot enterprise
  - copiloto interno
  - clasificación de tickets
  - consultas sobre BIM/docs
- Forecasting inicial
  - costos
  - absorción
  - riesgos operativos

### KPIs del trimestre
- 2+ proyectos o activos conectados
- 1 cuenta en expansión
- 70% de reportes recurrentes automatizados
- primer conector hardware en producción
- adopción ejecutiva del dashboard

### Riesgos
- complejidad de integraciones
- deuda técnica acumulada
- priorización contradictoria entre clientes piloto

## 5. Workstreams Permanentes

### Producto
- discovery continuo
- refinamiento de workflows
- gobierno de backlog

### Diseño
- sistema de diseño
- experiencia por rol
- optimización mobile-first

### Ingeniería
- performance
- seguridad
- observabilidad
- deuda técnica

### Data / IA
- calidad de documentos
- taxonomía de entidades
- estrategias de retrieval
- evaluación de copiloto

### Customer Success / Implementación
- onboarding
- playbooks
- entrenamiento por rol
- adopción

## 6. Dependencias Críticas

- calidad del BIM del cliente
- disponibilidad de catálogos maestros
- voluntad del cliente de operar procesos en plataforma
- acceso a sistemas existentes
- definición clara de ownership interno del piloto

## 7. Criterios de Priorización

Una iniciativa entra si cumple al menos 2 de estas 4:
- mejora ingreso
- reduce costo
- mejora adopción
- aumenta defensibilidad

## 8. Entregables por Ola

### Ola 1
- plataforma base
- BIM
- CRM básico
- ERP básico
- Field App básica

### Ola 2
- Lean
- calidad
- costos
- compras/almacén robusto

### Ola 3
- sembrados
- comercial avanzado
- entrega/postventa
- legal

### Ola 4
- enterprise hardening
- hardware
- IA avanzada
- forecasting

## 9. Recomendación Operativa

No construir el roadmap como 12 meses de un solo equipo plano. Separarlo al menos en 4 células:
- Core platform
- Office / ERP / Commercial
- Field / Lean / Quality
- Data / AI / Integrations

