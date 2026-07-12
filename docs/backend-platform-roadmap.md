# Backend Platform Roadmap

## Current Baseline

- npm workspace monorepo
- Fastify API in `apps/api`
- shared contracts in `packages/contracts`
- in-memory platform data to accelerate frontend integration
- SQL foundation draft in `apps/api/db/schema.sql`

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

## Next Backend Priorities

1. Replace in-memory platform store with PostgreSQL persistence.
2. Add tenant-aware auth and JWT signing.
3. Introduce repository and service layers per domain.
4. Add audit event writes and change history.
5. Add company provisioning flow and module activation APIs.
6. Add SAT and accounting catalog seeds for Mexico.
