# ARCONT API

Backend foundation for the ARCONT platform domain.

## Purpose

This API currently exposes the first platform capabilities that the web app can consume while the persistence layer is still being formalized.

## Current Architecture

- `src/repositories`
  - data access boundary, currently in-memory and ready to be swapped by PostgreSQL
- `src/services`
  - auth and platform orchestration
- `src/routes`
  - transport layer only
- `src/domain`
  - internal backend entities for repository and service layers

## Available Routes

- `GET /health`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /platform/companies`
- `GET /platform/modules`
- `GET /platform/roles`
- `GET /platform/users`
- `GET /platform/users/:userId`
- `POST /platform/users`
- `PATCH /platform/users/:userId/role`
- `PATCH /platform/users/:userId/status`
- `GET /platform/settings/:companyId`
- `PUT /platform/settings/:companyId`
- `GET /platform/companies/:companyId`
- `GET /platform/companies/:companyId/modules`
- `PUT /platform/companies/:companyId/modules`
- `GET /platform/dashboard/summary?companyId=...`
- `GET /platform/audit-events?companyId=...&limit=...`
- `GET /platform/bootstrap/:companyId?userEmail=...`
- `POST /platform/provision-company`

## Local Run

```bash
npm install
npm run dev:api
```

Run with PostgreSQL:

```bash
docker compose up -d postgres
npm run db:migrate -w @arcont/api
ARCONT_DATA_DRIVER=postgres npm run dev:api
```

## Auth Baseline

- signed JWT access token via `ARCONT_AUTH_JWT_SECRET`
- tenant-aware login through `companyId`
- refresh tokens are now persisted through the repository layer
- previous refresh tokens for the same user and company are revoked on new login
- refresh tokens are rotated on `POST /auth/refresh`
- `GET /auth/me` resolves the active session from the bearer token
- `POST /auth/logout` revokes active refresh tokens for the session user
- login failures are written to audit events with failure reason

## Data Model Seed

The API currently serves in-memory demo data through `src/repositories/platform-repository.ts`.

## Database Direction

The PostgreSQL foundation is documented in:

- `apps/api/db/schema.sql`
- `apps/api/db/migrations/001_platform_foundation.sql`

`ARCONT_DATA_DRIVER` can be switched between:

- `memory`
- `postgres`

That schema separates:

- platform companies, users, roles, permissions, settings, and module activation
- auth refresh tokens and audit events
- future operations workspaces that will own business modules like CRM, projects, procurement, finance, and HR

## Validation Rules

- provisioning rejects duplicated `taxId`
- provisioning rejects duplicated `adminEmail`
- provisioning rejects unknown module keys
- provisioning always enforces `platform.companies` and `platform.identity`
- Mexico-first provisioning currently requires:
  - `currency = MXN`
  - `locale` starting with `es-MX`
  - `fiscalRegime` as a 3-digit SAT code
  - `countryCode` and `fiscalCountry` to match
- login rejects user/company mismatches explicitly
- user creation rejects duplicated email addresses
- user role assignment rejects unknown role keys
- platform roles are reserved for the platform tenant in this phase
- disabling the last active user in a company is rejected

## Error Shape

Business and validation errors return:

```json
{
  "error": {
    "code": "SOME_ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

## Example Provisioning Payload

```json
{
  "legalName": "Constructora Peninsular del Sureste, S.A. de C.V.",
  "tradeName": "Peninsular Sureste",
  "taxId": "CPS240101AAA",
  "adminFullName": "Maria Perez",
  "adminEmail": "maria@peninsular.local",
  "enabledModules": [
    "platform.companies",
    "platform.identity",
    "projects.control",
    "procurement.purchasing"
  ]
}
```
