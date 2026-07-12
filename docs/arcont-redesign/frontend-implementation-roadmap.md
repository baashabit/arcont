# ARCONT Frontend Implementation Roadmap

## Objetivo

Convertir el sistema actual en una plataforma moderna sin frenar la operación existente.

## Enfoque recomendado

No hacer una reescritura total inmediata. Mejor:
- mantener el backend actual en una primera fase,
- crear una nueva capa front-end moderna,
- migrar por dominios de negocio,
- y retirar pantallas legacy de forma gradual.

## Orden sugerido

### Wave 1
- `login`
- `layout shell`
- `sidebar por suites`
- `topbar`
- `design system`

### Wave 2
- `dashboard ejecutivo`
- `CRM prospectos`
- `inventario conectado`

### Wave 3
- `blackboard operativo`
- `gestoría`
- `titulación`

### Wave 4
- `requisiciones`
- `materiales`
- `usuarios y permisos`
- `reportes premium`

## Stack sugerido

### Frontend
- `Next.js`
- `TypeScript`
- `Tailwind CSS` o design system propio
- `TanStack Table`
- `TanStack Query`
- `Recharts` o `Nivo`

### Seguridad y sesión
- cookies endurecidas
- CSRF
- manejo centralizado de sesión
- roles y scopes por módulo

### Integración
- consumir el backend actual vía endpoints existentes o capa adaptadora
- desacoplar pantallas nuevas de jQuery y plugins viejos

## Primera entrega realista

Una primera entrega profesional podría incluir:
- login nuevo
- shell nuevo
- dashboard ejecutivo
- CRM prospectos
- inventario conectado

Con eso ya cambia:
- la percepción del producto,
- la claridad para dirección,
- la usabilidad comercial,
- y la base técnica para seguir migrando.
