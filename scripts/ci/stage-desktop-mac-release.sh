#!/usr/bin/env bash
# Builds macOS DMG + auto-update zip and writes latest-mac.yml (matches GitHub Actions staging).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
echo "==> FlexHubs Desktop macOS release staging (package.json version: ${VERSION})"

node scripts/ci/verify-desktop-build-env.mjs

npm run make:mac

DMG="$(find out/make -name 'FlexHubs-Desktop.dmg' -print -quit)"
ZIP="$(find out/make -path '*/zip/darwin/*/*.zip' -print -quit)"

if [[ -z "${DMG}" ]]; then
  echo "ERROR: FlexHubs-Desktop.dmg not found under out/make"
  find out/make -name '*.dmg' 2>/dev/null || true
  exit 1
fi

if [[ -z "${ZIP}" ]]; then
  echo "ERROR: Mac update zip not found (MakerZIP for darwin). Expected under out/make/zip/darwin/"
  find out/make -name '*.zip' 2>/dev/null || true
  exit 1
fi

mkdir -p out/release
cp "$DMG" out/release/FlexHubs-Desktop.dmg
cp "$ZIP" out/release/FlexHubs-Desktop-mac.zip

node scripts/ci/generate-updater-metadata.mjs \
  --platform mac \
  --artifact out/release/FlexHubs-Desktop-mac.zip \
  --publish-name FlexHubs-Desktop-mac.zip \
  --out-dir out/release

echo ""
echo "Staged in out/release/:"
echo "  FlexHubs-Desktop.dmg          (manual install)"
echo "  FlexHubs-Desktop-mac.zip      (in-app auto-update)"
echo "  latest-mac.yml                (update metadata)"
echo ""
echo "Bump version in package.json before publishing if you want installed apps to detect an update."
