#!/usr/bin/env bash
set -euo pipefail

if [ -z "${MACOS_CERTIFICATE:-}" ]; then
  echo "MACOS_CERTIFICATE secret is not set — Mac build will be unsigned."
  exit 0
fi

if [ -z "${MACOS_CERTIFICATE_PASSWORD:-}" ]; then
  echo "MACOS_CERTIFICATE_PASSWORD secret is not set."
  exit 1
fi

KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-actions}"

echo "$MACOS_CERTIFICATE" | base64 --decode > certificate.p12

security create-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
security default-keychain -s build.keychain
security unlock-keychain -p "$KEYCHAIN_PASSWORD" build.keychain
security set-keychain-settings -t 3600 -u build.keychain
security import certificate.p12 \
  -k build.keychain \
  -P "$MACOS_CERTIFICATE_PASSWORD" \
  -T /usr/bin/codesign \
  -T /usr/bin/productsign \
  -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" build.keychain

echo "Available signing identities:"
security find-identity -v -p codesigning build.keychain

if [ -n "${APPLE_API_KEY_BASE64:-}" ] && [ -n "${APPLE_KEY_ID:-}" ] && [ -n "${APPLE_ISSUER_ID:-}" ]; then
  echo "$APPLE_API_KEY_BASE64" | base64 --decode > AuthKey.p8
  echo "APPLE_API_KEY=$PWD/AuthKey.p8" >> "$GITHUB_ENV"
  echo "APPLE_KEY_ID=$APPLE_KEY_ID" >> "$GITHUB_ENV"
  echo "APPLE_ISSUER_ID=$APPLE_ISSUER_ID" >> "$GITHUB_ENV"
fi
