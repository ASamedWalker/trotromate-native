#!/usr/bin/env bash
# Publish a PREVIEW update the safe way (see memory: eas-deployment-gotchas).
#  - store layout on preview: EXPO_PUBLIC_RELEASE_MODE=1 (owner choice 2026-10-09)
#  - --clear-cache: without it Metro reuses old compiled modules and silently DROPS the
#    env switch (2026-10-12: a day of "store layout" updates were really the wallet build)
#  - both runtimes: owner phones may still run 1.1.4 preview builds
#  - iOS then Android, never --platform all (web export crash)
# Usage: scripts/publish-preview.sh "message"
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:-$(git log --oneline -1)}"
CFG=app.config.js
CUR=$(grep -oE 'version: "[0-9.]+"' "$CFG" | head -1 | grep -oE '[0-9.]+')
restore() { sed -i '' "s/    version: \"[0-9.]*\",/    version: \"$CUR\",/" "$CFG"; }
trap restore EXIT
pub() { for p in ios android; do EXPO_PUBLIC_RELEASE_MODE=1 CI=1 npx eas-cli update --branch preview --platform "$p" --clear-cache --message "$1" --non-interactive; done; }
pub "$MSG"
if [ "$CUR" != "1.1.4" ]; then
  sed -i '' "s/    version: \"$CUR\",/    version: \"1.1.4\",/" "$CFG"
  pub "$MSG (1.1.4)"
fi
