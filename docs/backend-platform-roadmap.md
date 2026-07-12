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
- `/platform/companies/:companyId`
- `/platform/modules`
- `/platform/users`
- `/platform/users/:userId`
- `POST /platform/users`
- `PATCH /platform/users/:userId/role`
- `PATCH /platform/users/:userId/status`
- `/platform/settings/:companyId`
- `/platform/companies/:companyId/modules`
- `/platform/dashboard/summary`
- `/platform/audit-events`
- `/platform/provision-company`
- normalized error payloads with `error.code`, `error.message`, and `error.details`

## New Backend Rules Added On PC 1

- company user creation now returns temporary password plus resolved role permissions
- role updates are audited and validated against the shared role catalog
- status updates are audited and cannot disable the last active user in a company
- platform-scoped roles are blocked for non-platform tenants in this phase

## Next Backend Priorities

1. Execute and verify PostgreSQL driver end-to-end once the Docker daemon is available.
2. Persist refresh tokens with stronger rotation and revocation lifecycle endpoints.
3. Add audit event writes for more actions and change history queries.
4. Add company provisioning approvals and module activation workflows.
5. Add SAT and accounting catalog seeds for Mexico.
6. Add domain repositories for CRM, projects, procurement, and finance.
