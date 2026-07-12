# ARCONT API

Backend foundation for the ARCONT platform domain.

## Purpose

This API currently exposes the first platform capabilities that the web app can consume while the persistence layer is still being formalized.

## Available Routes

- `GET /health`
- `POST /auth/login`
- `GET /platform/companies`
- `GET /platform/modules`
- `GET /platform/roles`
- `GET /platform/users`
- `GET /platform/settings/:companyId`
- `GET /platform/bootstrap/:companyId?userEmail=...`

## Local Run

```bash
npm install
npm run dev:api
```

## Data Model Seed

The API currently serves in-memory demo data from `src/platform/store.ts`.

## Database Direction

The first SQL foundation is documented in:

- `apps/api/db/schema.sql`

That schema separates:

- platform companies, users, roles, permissions, settings, and module activation
- future operations workspaces that will own business modules like CRM, projects, procurement, finance, and HR
