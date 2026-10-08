#!/usr/bin/env bash
# Build, stage, and upload macOS release assets to GitHub Releases tag desktop-latest.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

REPO="${FLEXHUBS_GITHUB_REPO:-rutuja0711/flexhubs}"
TAG="${FLEXHUBS_RELEASE_TAG:-desktop-latest}"
VERSION="$(node -p "require('./package.json').version")"

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: gh is not authenticated. Run: gh auth login"
  exit 1
fi

bash scripts/ci/stage-desktop-mac-release.sh

NOTES="FlexHubs Desktop v${VERSION} (macOS)

- **Install:** \`FlexHubs-Desktop.dmg\`
- **Auto-update:** \`FlexHubs-Desktop-mac.zip\` + \`latest-mac.yml\`

Installed apps compare this release's \`version\` in latest-mac.yml to their built-in version."

if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release create "$TAG" \
    --repo "$REPO" \
    --title "FlexHubs Desktop (latest build)" \
    --notes "$NOTES" \
    --prerelease
else
  gh release edit "$TAG" --repo "$REPO" --notes "$NOTES"
fi

gh release upload "$TAG" \
  out/release/FlexHubs-Desktop.dmg \
  out/release/FlexHubs-Desktop-mac.zip \
  out/release/latest-mac.yml \
  --repo "$REPO" \
  --clobber

echo ""
echo "Verifying public update feed..."
node scripts/ci/verify-update-feed.mjs

echo ""
echo "Published v${VERSION} to https://github.com/${REPO}/releases/tag/${TAG}"
echo "Installed builds on an older version should notify within ~5s of launch (or hourly)."
