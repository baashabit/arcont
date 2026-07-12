#!/usr/bin/env bash
set -euo pipefail

: "${ARCONT_REMOTE_HOST:?Set ARCONT_REMOTE_HOST, for example antonio@100.x.y.z}"
: "${ARCONT_REMOTE_REPO:=~/arcont}"

ssh "$ARCONT_REMOTE_HOST" "cd \"$ARCONT_REMOTE_REPO\" && git fetch --all --prune && git status -sb && echo && git branch -vv | sed -n '1,40p'"
