# PC 2 Handoff

Update this file from PC 1 before Antonio starts the next task.

## Branch

`feat/web-projects-live-portfolio`

## Objective

Refine and elevate the live `Projects` portfolio in `frontend/arcont-suite` on top of the backend portfolio endpoint that PC 1 already left working.

## Available Backend Endpoints

- `GET /projects/overview?companyId=...`
- bearer token is still required

## Important Backend Behavior

- response will represent real construction portfolio data, not route mocks
- active tenant scope still applies
- keep the page compatible with the current shell and permission model

## Scope

- take the existing live `/projects` portfolio baseline and improve the interface quality
- keep consuming backend data instead of `route-mocks`
- show:
  - portfolio KPIs
  - project table
  - risk / blocker panel
  - selected project detail or highlights
- preserve current visual language of the shell
- improve scanability, hierarchy and action clarity for directors / PMO / supervision
- avoid giant refactors outside the projects route and the minimum shared helpers it needs

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
