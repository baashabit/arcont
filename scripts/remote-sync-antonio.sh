#!/usr/bin/env bash
set -euo pipefail

: "${ARCONT_REMOTE_HOST:=redcrack@192.168.8.105}"
: "${ARCONT_REMOTE_REPO:=\$HOME/projects/arcont}"

ssh "$ARCONT_REMOTE_HOST" "cd \"$ARCONT_REMOTE_REPO\" && git fetch --all --prune && git pull --ff-only"
