# Backend Platform Roadmap

## Current Baseline

- npm workspace monorepo
- Fastify API in `apps/api`
- shared contracts in `packages/contracts`
- repository and service layers with selectable `memory` / `postgres` driver
- JWT-based auth baseline
- provisioning endpoint for new companies
- migration script and PostgreSQL foundation
- domain validation and normalized error responses

## What PC 1 Owns

- platform domain
- auth strategy
- multi-tenant rules
- contracts consumed by web and mobile
- future database and integrations

## What PC 2 Can Depend On Now

- `packages/contracts/src/index.ts` for shared shapes
- `/platform/bootstrap/:companyId` for initial app context
- `/platform/companies`
- `/platform/modules`
- `/platform/users`
- `/platform/settings/:companyId`
- `/platform/provision-company`
- normalized error payloads with `error.code`, `error.message`, and `error.details`

## Next Backend Priorities

1. Execute and verify PostgreSQL driver end-to-end once the Docker daemon is available.
2. Persist refresh tokens with stronger rotation and revocation lifecycle endpoints.
3. Add audit event writes for more actions and change history queries.
4. Add company provisioning approvals and module activation workflows.
5. Add SAT and accounting catalog seeds for Mexico.
6. Add domain repositories for CRM, projects, procurement, and finance.
