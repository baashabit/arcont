# Remote Coordination

This folder standardizes how PC 1 and PC 2 coordinate work without copying prompts manually into chat windows.

## Roles

- `luis.md`
  - PC 1 owner
  - integration branch, backend, reconciliation, validation, releases
- `antonio.md`
  - PC 2 owner
  - frontend execution against backend contracts and stable API endpoints
- `handoff.md`
  - current instructions that PC 2 should read before starting the next task

## Recommended Flow

1. PC 1 updates `handoff.md`.
2. PC 1 pushes the repo.
3. PC 2 pulls the repo.
4. PC 2 reads `docs/coordination/handoff.md`.
5. PC 2 executes only that task on its own branch.
6. PC 2 commits and pushes.
7. PC 1 reconciles and validates.

## Rules

- one active task per workstation
- one branch per task line
- no backend changes from PC 2 unless explicitly assigned
- no contract changes from PC 2 unless explicitly assigned
- every handoff must include:
  - branch
  - exact objective
  - out of scope
  - validation commands
  - delivery expectations

## Remote Operation

The scripts in `scripts/` use SSH and `tmux` so PC 1 can inspect or prepare PC 2 remotely.

Required environment variables on PC 1:

```bash
export ARCONT_REMOTE_HOST=antonio@100.x.y.z
export ARCONT_REMOTE_REPO=~/arcont
export ARCONT_REMOTE_TMUX_SESSION=arcont
```

If you stay on a local LAN instead of Tailscale, replace the host with the Ubuntu LAN IP.
