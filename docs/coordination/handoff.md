# PC 2 Handoff

Update this file from PC 1 before Antonio starts the next task.

## Branch

`feat/web-live-platform-integration`

## Objective

Implement the live user management UI in `frontend/arcont-suite` using the backend endpoints that already exist.

## Available Backend Endpoints

- `GET /platform/users?companyId=...`
- `GET /platform/users/:userId`
- `POST /platform/users`
- `PATCH /platform/users/:userId/role`
- `PATCH /platform/users/:userId/status`

## Scope

- complete `/platform/users`
- consume real API responses
- support create user, role change, status change, and detail view
- show backend error code and message when actions fail

## Out Of Scope

- backend changes
- contract changes
- auth redesign
- platform provisioning changes

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
