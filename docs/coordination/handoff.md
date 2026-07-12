# PC 2 Handoff

Update this file from PC 1 before Antonio starts the next task.

## Branch

`feat/web-session-shell-hardening`

## Objective

Implement the real session lifecycle and protected shell in `frontend/arcont-suite` using the backend auth endpoints that already exist.

## Available Backend Endpoints

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`
- all `/platform/*` routes now require bearer token

## Important Backend Behavior

- missing token returns `401`
- invalid or expired token returns `401`
- missing permission returns `403 AUTH_PERMISSION_DENIED`
- cross-company access returns `403 AUTH_COMPANY_SCOPE_FORBIDDEN`
- platform management writes still require the same permissions as before
- live user administration already exists on your branch; do not redo it

## Scope

- make login/session state rely on real backend session endpoints first
- restore session on reload using `GET /auth/me`
- if access token is stale but refresh token exists, try `POST /auth/refresh`
- on sign out, call `POST /auth/logout`
- protect shell routes when session is not valid
- show clear UI state when session expires or auth fails
- keep a dev fallback only if backend is unreachable, not when backend explicitly rejects auth
- keep the interface coherent with the current premium shell

## Out Of Scope

- contract changes
- backend changes
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
