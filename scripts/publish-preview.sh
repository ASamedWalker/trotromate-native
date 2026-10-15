#!/usr/bin/env bash
# Publish a PREVIEW update the safe way (see memory: eas-deployment-gotchas).
#  - layout: wallet (full) app by default (owner choice 2026-10-15, to test the wallet
#    redesign on phones). PREVIEW_LAYOUT=store publishes the store layout instead.
#  - --clear-cache: without it Metro reuses old compiled modules and silently DROPS the
#    env switch (2026-10-12: a day of "store layout" updates were really the wallet build)
#  - both runtimes: owner phones may still run 1.1.4 preview builds
#  - iOS then Android, never --platform all (web export crash)
# Usage: scripts/publish-preview.sh "message"   (PREVIEW_LAYOUT=store … for store layout)
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:-$(git log --oneline -1)}"
case "${PREVIEW_LAYOUT:-full}" in
  full) RM=0 ;;
  store) RM=1 ;;
  *) echo "PREVIEW_LAYOUT must be full or store" >&2; exit 1 ;;
esac
MSG="$MSG [${PREVIEW_LAYOUT:-full} layout]"
CFG=app.config.js
CUR=$(grep -oE 'version: "[0-9.]+"' "$CFG" | head -1 | grep -oE '[0-9.]+')
restore() { sed -i '' "s/    version: \"[0-9.]*\",/    version: \"$CUR\",/" "$CFG"; }
trap restore EXIT
pub() { for p in ios android; do EXPO_PUBLIC_RELEASE_MODE=$RM CI=1 npx eas-cli update --branch preview --platform "$p" --clear-cache --message "$1" --non-interactive; done; }
pub "$MSG"
if [ "$CUR" != "1.1.4" ]; then
  sed -i '' "s/    version: \"$CUR\",/    version: \"1.1.4\",/" "$CFG"
  pub "$MSG (1.1.4)"
fi
