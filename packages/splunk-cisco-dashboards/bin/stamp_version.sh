#!/usr/bin/env bash
# Stamp the repo-root VERSION into staged Splunk app resources.
set -euo pipefail

APP_ROOT="${1:?usage: stamp_version.sh <staged-app-directory>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="${SCRIPT_DIR}/.."
ROOT_DIR="${PKG_ROOT}/../.."
VERSION_FILE="${ROOT_DIR}/VERSION"

if [[ ! -d "$APP_ROOT" ]]; then
  echo "ERROR: app directory not found: ${APP_ROOT}" >&2
  exit 1
fi

if [[ ! -f "$VERSION_FILE" ]]; then
  echo "ERROR: VERSION file not found: ${VERSION_FILE}" >&2
  exit 1
fi

APP_VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
if [[ -z "$APP_VERSION" ]]; then
  echo "ERROR: VERSION file is empty: ${VERSION_FILE}" >&2
  exit 1
fi

stamp_app_conf() {
  local file="${APP_ROOT}/default/app.conf"
  local tmp
  [[ -f "$file" ]] || return 0

  tmp="$(mktemp)"
  awk -v version="$APP_VERSION" '
    /^\[/ {
      in_id = ($0 == "[id]")
      in_launcher = ($0 == "[launcher]")
    }
    (in_id || in_launcher) && /^[[:space:]]*version[[:space:]]*=/ {
      sub(/=.*/, "= " version)
    }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

stamp_app_conf

echo "[stamp] VERSION ${APP_VERSION} stamped into ${APP_ROOT}"
