# ARCONT

ARCONT is the foundation of a modular construction and real-estate operating system.

The repository is being prepared as a multi-tenant platform for:

- small, medium, and large companies
- developers, contractors, government housing programs, and operators
- modular activation of domains such as sales, projects, procurement, inventory, finance, HR, and compliance

## Repository Structure

```text
apps/
  api/                    Backend API and platform services
frontend/
  arcont-suite/           Current Next.js web application
packages/
  contracts/              Shared contracts and module catalog
docs/                     Product, architecture, and startup material
infra/                    Reserved for infrastructure assets
```

## Domain Model

ARCONT is split into two macro domains:

1. Platform domain
   - companies / tenants
   - subscriptions and enabled modules
   - users, roles, permissions
   - company settings and branding

2. Customer operations domain
   - CRM and sales
   - projects and site control
   - procurement and warehouse
   - finance and accounting
   - HR and workforce
   - post-sale, compliance, integrations, and future telemetry / BIM / AI services

## Local Setup

Requirements:

- Node.js 22+
- npm 10+
- Docker / Docker Compose for PostgreSQL when running the persistent backend

Install all workspaces:

```bash
npm install
```

Run the API:

```bash
npm run dev:api
```

Run PostgreSQL locally:

```bash
docker compose up -d postgres
npm run db:migrate -w @arcont/api
```

Run the web app:

```bash
npm run dev:web
```

Validation:

```bash
npm run lint
npm run build
```

## Current Foundation

- `frontend/arcont-suite` remains the active web shell
- `apps/api` provides the first platform API baseline
- `packages/contracts` defines shared contracts and module catalog

## Multi-PC Coordination

This repo now includes a simple remote coordination workflow in `docs/coordination`.

- `docs/coordination/handoff.md`
  - the current task for PC 2
- `scripts/remote-status-antonio.sh`
  - fetch and inspect Antonio's remote repo state
- `scripts/remote-sync-antonio.sh`
  - pull latest repo on Antonio's machine
- `scripts/remote-handoff-antonio.sh`
  - copy the latest handoff file to Antonio's repo
- `scripts/remote-tmux-antonio.sh`
  - attach to a persistent remote `tmux` session

Expected environment variables on PC 1:

```bash
export ARCONT_REMOTE_HOST=antonio@100.x.y.z
export ARCONT_REMOTE_REPO=~/arcont
export ARCONT_REMOTE_TMUX_SESSION=arcont
```

## Next Recommended Step

Use this baseline as the integration point for a second workstation focused on frontend shell, navigation, and enterprise UI over stable platform contracts.
