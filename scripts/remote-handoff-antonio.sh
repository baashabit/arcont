#!/usr/bin/env bash
set -euo pipefail

: "${ARCONT_REMOTE_HOST:?Set ARCONT_REMOTE_HOST, for example antonio@100.x.y.z}"
: "${ARCONT_REMOTE_REPO:=~/arcont}"

local_file="docs/coordination/handoff.md"

if [[ ! -f "$local_file" ]]; then
  echo "Missing $local_file" >&2
  exit 1
fi

scp "$local_file" "$ARCONT_REMOTE_HOST:/tmp/arcont-handoff.md" >/dev/null
ssh "$ARCONT_REMOTE_HOST" "mkdir -p \"$ARCONT_REMOTE_REPO/docs/coordination\" && cp /tmp/arcont-handoff.md \"$ARCONT_REMOTE_REPO/docs/coordination/handoff.md\" && cd \"$ARCONT_REMOTE_REPO\" && sed -n '1,240p' docs/coordination/handoff.md"
