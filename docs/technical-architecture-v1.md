# ARCONT Technical Architecture V1

## 1. Objetivo

Definir una arquitectura tecnica v1 para una plataforma enterprise de `CRM + ERP + Field App + Lean + BIM + IA + Hardware`.

## 2. Principios

- Multi-tenant desde el inicio
- API-first
- Event-driven para procesos criticos
- Seguridad y auditoria por defecto
- Modularidad funcional con modelo de datos compartido
- Integraciones enterprise sin acoplamiento fuerte
- Mobile-first en campo

## 3. Macroarquitectura

### Clientes
- Web app corporativa
- Field app movil
- Portal cliente
- Consola admin

### Backend
- API Gateway
- Identity / Access
- Core business services
- Integration services
- AI orchestration
- Workflow engine

### Datos
- Relational DB
- Time-series DB
- Search index
- Object storage
- Audit store

## 4. Dominios / Servicios

### Identity and Governance
- auth
- SSO
- roles and permissions
- audit trail

### CRM / Customer
- leads
- pipeline
- reservations
- closing
- customer portal
- post-sales

### ERP / Backoffice
- budgets
- requisitions
- purchase orders
- warehouse
- AP / AR
- contracts
- cost control

### Construction / Field
- daily progress
- quality
- safety
- punch list
- field evidence

### Lean Planning
- pull planning
- lookahead
- constraints
- PPC
- takt

### Development Planning
- masterplan
- sembrados
- product mix
- stage planning

### BIM / Digital Twin
- model ingestion
- entity mapping
- spatial graph
- versioning

### Asset Operations
- tickets
- maintenance
- work orders
- SLAs

### Omnichannel Service
- chatbot
- web chat
- WhatsApp
- PBX / call logs
- inbox routing

### Legal and Compliance
- legal files
- approvals
- permit tracking
- retention policies

### Reporting and BI
- scheduled reports
- dashboards
- exports
- data marts

### AI Platform
- RAG
- copilots
- classification
- recommendation
- forecasting

### IoT / Hardware Integration
- telemetry ingestion
- protocol adapters
- alerting
- automation rules

## 5. Arquitectura de Datos

### Core relational model
- tenants
- companies
- projects
- phases
- towers
- floors
- units
- spaces
- assets
- users
- roles
- contractors
- suppliers
- customers
- contracts
- documents
- tickets
- work_orders
- budgets
- cost_items
- purchase_orders
- inventory_movements
- legal_records

### Time-series model
- telemetry_events
- meter_readings
- occupancy_signals
- hvac_signals
- alerts

### Search / knowledge model
- documents_index
- tickets_index
- contracts_index
- BIM entity index
- AI retrieval chunks

### Spatial / graph model
- BIM elements
- equipment to space mapping
- unit to tower mapping
- asset dependency graph

## 6. Sugerencia de Stack

### Frontend
- `Next.js` para web corporativa
- `React Native` o `Expo` para app movil
- `Tailwind CSS` o design system propio

### Backend
- `Node.js` con `NestJS` o `TypeScript` service layer
- Alternativa: `Python` para AI services y ETL

### Data
- `PostgreSQL`
- `TimescaleDB` o `InfluxDB`
- `OpenSearch` o `Elasticsearch`
- `S3-compatible object storage`
- `Redis` para colas ligeras y cache

### Integracion y eventos
- `Kafka`, `Redpanda` o `RabbitMQ`
- webhooks
- workers asincronos

### IAM
- `Auth0`, `Keycloak` o provider enterprise con `SAML/OIDC`

### Workflow / BPM
- motor de workflows configurable
- alternativa: `Temporal` para procesos complejos

### Observabilidad
- `OpenTelemetry`
- `Prometheus`
- `Grafana`
- `Loki` o stack de logs equivalente

### AI
- embeddings
- RAG store
- orchestration layer
- policy guardrails

## 7. Integracion Enterprise

### Patrón recomendado
- cada integracion debe entrar por un `adapter` desacoplado
- publicar eventos normalizados al event bus
- persistir raw payloads cuando aplique
- transformar a entidades del dominio

### Integraciones objetivo
- ERP legacy
- CRM legacy
- PBX
- WhatsApp Business API
- BI
- BMS
- document control
- firma electronica
- bancos o pasarelas cuando aplique

## 8. Seguridad

### Controles base
- SSO
- MFA
- RBAC + scoping por tenant/proyecto/activo
- audit logs
- encryption at rest / in transit
- signed URLs para documentos
- secret management

### Enterprise controls
- segregation of duties
- retention policies
- access reviews
- anomaly detection on critical actions
- immutable audit trail for legal/financial events

## 9. Ambientes

- `dev`
- `qa`
- `staging`
- `prod`

Separaciones recomendadas:
- datos anonimizados fuera de prod
- pipelines CI/CD con controles
- feature flags

## 10. SLA y Operacion

### Objetivos iniciales
- disponibilidad objetivo: 99.9% para web core
- RPO / RTO definidos por criticidad
- monitoreo de latencia de APIs
- alertamiento sobre colas, integraciones y hardware ingestion

### Soporte
- L1: operacion funcional
- L2: integraciones / workflows
- L3: producto / ingenieria

## 11. Roadmap tecnico sugerido

### Fase 1
- monolito modular o modular monolith
- Postgres
- object storage
- auth base
- web app
- mobile basic

### Fase 2
- event bus
- time-series
- search
- AI retrieval
- hardware adapters

### Fase 3
- separar servicios de alto crecimiento:
  - AI
  - telemetry
  - omnichannel
  - reporting

### Fase 4
- multi-region si el negocio lo requiere
- data platform para benchmarking y forecasting

## 12. Recomendacion tecnica pragmatica

Para v1 no conviene arrancar con demasiados microservicios. Lo mas sano es:

1. `modular monolith` con boundaries claros
2. `event bus` desde temprano
3. separar solo lo que realmente escala distinto:
   - AI
   - telemetry
   - bots/omnichannel
   - reporting

Eso acelera salida al mercado sin sacrificar una evolución enterprise.

