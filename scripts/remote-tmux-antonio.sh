#!/usr/bin/env bash
set -euo pipefail

: "${ARCONT_REMOTE_HOST:?Set ARCONT_REMOTE_HOST, for example antonio@100.x.y.z}"
: "${ARCONT_REMOTE_REPO:=~/arcont}"
: "${ARCONT_REMOTE_TMUX_SESSION:=arcont}"

ssh -t "$ARCONT_REMOTE_HOST" "mkdir -p \"$ARCONT_REMOTE_REPO\" && tmux new -A -s \"$ARCONT_REMOTE_TMUX_SESSION\" -c \"$ARCONT_REMOTE_REPO\""
