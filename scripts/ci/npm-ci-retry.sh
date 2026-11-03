#!/usr/bin/env bash
# Retry npm ci when Electron or registry downloads fail with transient HTTP errors.
set -euo pipefail

max_attempts="${NPM_CI_MAX_ATTEMPTS:-4}"
attempt=1

while [[ "$attempt" -le "$max_attempts" ]]; do
  echo "[FlexHubs CI] npm ci (attempt ${attempt}/${max_attempts})"
  if npm ci; then
    echo "[FlexHubs CI] npm ci succeeded"
    exit 0
  fi

  if [[ "$attempt" -ge "$max_attempts" ]]; then
    echo "[FlexHubs CI] npm ci failed after ${max_attempts} attempts"
    exit 1
  fi

  wait_seconds=$((20 * attempt))
  echo "[FlexHubs CI] npm ci failed — retrying in ${wait_seconds}s (503/timeouts are often transient)"
  sleep "$wait_seconds"
  attempt=$((attempt + 1))
done
