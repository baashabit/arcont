#!/usr/bin/env bash
set -euo pipefail

: "${ARCONT_REMOTE_HOST:=redcrack@192.168.8.105}"
: "${ARCONT_REMOTE_REPO:=\$HOME/projects/arcont}"

local_file="docs/coordination/handoff.md"

if [[ ! -f "$local_file" ]]; then
  echo "Missing $local_file" >&2
  exit 1
fi

scp "$local_file" "$ARCONT_REMOTE_HOST:/tmp/arcont-handoff.md" >/dev/null
ssh "$ARCONT_REMOTE_HOST" "mkdir -p \"$ARCONT_REMOTE_REPO/docs/coordination\" && cp /tmp/arcont-handoff.md \"$ARCONT_REMOTE_REPO/docs/coordination/handoff.md\" && cd \"$ARCONT_REMOTE_REPO\" && sed -n '1,240p' docs/coordination/handoff.md"
