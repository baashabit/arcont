# PC 2 Handoff

Update this file from PC 1 before Antonio starts the next task.

## Branch

`feat/web-procurement-live-portfolio`

## Objective

Refine and elevate the live `Procurement` portfolio in `frontend/arcont-suite` on top of the backend procurement endpoint that PC 1 already left working.

## Available Backend Endpoints

- `GET /procurement/overview?companyId=...`
- bearer token is still required

## Important Backend Behavior

- response will represent real construction portfolio data, not route mocks
- active tenant scope still applies
- keep the page compatible with the current shell and permission model

## Scope

- take the existing live `/procurement` baseline and improve the interface quality
- keep consuming backend data instead of `route-mocks`
- show:
  - portfolio KPIs
  - package / sourcing table
  - risk / blocker panel
  - selected package detail or highlights
- preserve current visual language of the shell
- improve scanability, hierarchy and action clarity for directors / procurement / operations
- avoid giant refactors outside the procurement route and the minimum shared helpers it needs

## Out Of Scope

- backend changes
- contract changes
- auth redesign
- redesign of platform users page
- module governance rewrites
- company provisioning changes

## Validation

```bash
npm run lint:web
npm run build:web
```

## Delivery

- commit on your branch
- short summary of files changed
- what works
- what remains pending
