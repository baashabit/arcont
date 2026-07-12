# ARCONT Repo Foundation

## Objective

This repository baseline exists to give parallel contributors a stable context before domain expansion.

## Current Technical Decisions

- Monorepo with npm workspaces
- Next.js for the current web app
- Fastify + TypeScript for the API baseline
- Shared contracts in a dedicated workspace package
- Multi-tenant platform modeled before deep module implementation

## Workspace Responsibilities

- `apps/api`
  - platform domain APIs
  - authentication baseline
  - company, module, user, and settings endpoints

- `frontend/arcont-suite`
  - current web shell
  - future enterprise navigation and domain UX

- `packages/contracts`
  - canonical module catalog
  - shared types and schemas

## Initial API Surface

- `GET /health`
- `POST /auth/login`
- `GET /platform/companies`
- `GET /platform/modules`
- `GET /platform/users`
- `GET /platform/settings/:companyId`

## Why This Matters For PC 2

The frontend workstation can now build on:

- stable module keys
- company and user shapes
- platform versus operations separation
- a concrete API host and route namespace
