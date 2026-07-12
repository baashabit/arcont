## ARCONT web foundation

This frontend is the enterprise base for the ARCONT web suite inside `frontend/arcont-suite`.

### Structure

- `app/`
  - domain routes such as `dashboard`, `platform/*`, `crm`, `projects`, `procurement`, `inventory`, `finance`, `hr`, `compliance`, `integrations`
- `components/providers`
  - tenant-aware frontend state and module visibility
- `components/shell`
  - reusable app shell, sidebar and topbar
- `components/ui`
  - cards, KPI cards, tables, badges, filters and empty states
- `lib/app-data.ts`
  - API-first data loading with local fallback for development
- `lib/navigation.ts`
  - domain navigation model
- `lib/contracts.ts`
  - shared contracts re-exported from `packages/contracts/src/index.ts`

### Data model

- Shared contracts are the source of truth for companies, modules, roles, users and settings.
- The frontend tries to read from the platform API first.
- If the API is not available locally, the app falls back to typed mocks aligned with those contracts.

### Current behavior

- Tenant switcher changes visible modules and route posture at the frontend level.
- Login uses `POST /auth/login` first and falls back to local mock credentials when the backend is unavailable.
- Platform routes prefer API-backed bootstrap data for tenant context, permissions, modules, users and settings.
- Operational routes demonstrate useful domain views instead of empty placeholders.

### API-backed routes today

- `POST /auth/login`
  - consumed by `/login`
- `GET /platform/bootstrap/:companyId?userEmail=...`
  - consumed after login and when switching tenant for `/dashboard`, `/platform/modules`, `/platform/users`, `/platform/settings`
- `GET /platform/companies`
- `GET /platform/modules`
- `GET /platform/roles`
- `GET /platform/users`
- `GET /platform/settings/:companyId`
  - consumed during initial app load, with fallback to local typed mocks

### Still mock-first

- `crm`
- `projects`
- `procurement`
- `inventory`
- `finance`
- `hr`
- `compliance`
- `integrations`
