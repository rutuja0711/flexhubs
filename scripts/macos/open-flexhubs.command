#!/bin/bash
# FlexHubs Desktop — Mac test install helper (unsigned builds).
# Double-click this file after unzipping the download.

set -e

echo ""
echo "FlexHubs Desktop — Mac install helper"
echo "======================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP=""

for candidate in \
  "$SCRIPT_DIR/FlexHubs Desktop.app" \
  "$SCRIPT_DIR/../FlexHubs Desktop.app" \
  "$HOME/Downloads/FlexHubs Desktop.app" \
  "$HOME/Desktop/FlexHubs Desktop.app" \
  "/Applications/FlexHubs Desktop.app"
do
  if [ -d "$candidate" ]; then
    APP="$candidate"
    break
  fi
done

if [ -z "$APP" ]; then
  echo "Could not find FlexHubs Desktop.app automatically."
  echo ""
  echo "1. Unzip the download completely (do not run from inside the zip)."
  echo "2. Drag FlexHubs Desktop.app into this Terminal window, then press Enter."
  echo ""
  read -r -p "App path: " APP
  APP="${APP//\'/}"
  APP="$(echo "$APP" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
fi

if [ ! -d "$APP" ]; then
  echo ""
  echo "Error: Not a valid app folder: $APP"
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
fi

echo "Found: $APP"
echo "Removing macOS quarantine flag..."
xattr -cr "$APP" 2>/dev/null || true

echo "Opening FlexHubs Desktop..."
open "$APP"

echo ""
echo "If macOS still blocks the app:"
echo "  System Settings → Privacy & Security → scroll down → Open Anyway"
echo ""
read -r -p "Press Enter to close..."
