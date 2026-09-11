#!/usr/bin/env bash
set -euo pipefail

APP="$(find out -path '*FlexHubs Desktop.app' -type d -print -quit)"

if [ -z "$APP" ]; then
  echo "FlexHubs Desktop.app not found under out/"
  exit 1
fi

echo "Checking signature for: $APP"
codesign -dv --verbose=4 "$APP" 2>&1 || true

if ! codesign --verify --deep --strict --verbose=2 "$APP"; then
  echo "::error::Mac app is unsigned or signature is invalid. Add signing secrets from SIGNING.md."
  exit 1
fi

if ! spctl -a -t exec -vv "$APP" 2>&1; then
  echo "::error::Mac app failed Gatekeeper assessment (notarization may be missing)."
  exit 1
fi

echo "Mac app is signed and passes Gatekeeper."
