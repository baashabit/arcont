#!/usr/bin/env bash
set -euo pipefail

: "${ARCONT_REMOTE_HOST:=redcrack@192.168.8.105}"
: "${ARCONT_REMOTE_REPO:=\$HOME/projects/arcont}"
: "${ARCONT_REMOTE_TMUX_SESSION:=arcont}"

ssh -t "$ARCONT_REMOTE_HOST" "mkdir -p \"$ARCONT_REMOTE_REPO\" && tmux new -A -s \"$ARCONT_REMOTE_TMUX_SESSION\" -c \"$ARCONT_REMOTE_REPO\""
