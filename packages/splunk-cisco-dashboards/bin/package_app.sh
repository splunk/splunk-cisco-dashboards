#!/usr/bin/env bash
# Create a .tar.gz package from stage/. Run from package root (e.g. yarn run package:app).
# Ensures stage exists (runs clean:build if not), then creates a tar.gz with the
# correct top-level directory name for Splunk installation.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="${SCRIPT_DIR}/.."
STAGE_DIR="${PKG_ROOT}/stage"
APP_NAME="splunk-cisco-dashboards"

# Read version from app.conf (source of truth)
APP_CONF="${PKG_ROOT}/src/main/resources/splunk/default/app.conf"
VERSION=$(grep -E '^\s*version\s*=' "$APP_CONF" | head -1 | sed 's/.*=\s*//' | xargs)
if [[ -z "$VERSION" ]]; then
  echo "ERROR: Could not read version from app.conf" >&2
  exit 1
fi

DIST_DIR="${PKG_ROOT}/../../dist"
mkdir -p "$DIST_DIR"
PKG_PATH="${DIST_DIR}/${APP_NAME}-${VERSION}.tar.gz"

if [[ ! -d "$STAGE_DIR" ]]; then
  echo "stage/ not found; running clean:build first..."
fi

# Always run clean build (preserving local) to ensure package is fresh
bash "${SCRIPT_DIR}/clean_build.sh"
node "${PKG_ROOT}/bin/build.js" build

# Stage into a temp directory with the correct app directory name
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cp -R "$STAGE_DIR" "${TMP_DIR}/${APP_NAME}"
find "${TMP_DIR}" -name ".DS_Store" -delete
# Remove Splunk-generated runtime artifacts — they should never ship in the package.
# Because /opt/splunk/etc/apps/splunk-cisco-dashboards symlinks to stage/,
# Splunk creates local.meta and local/ at runtime inside our build output.
rm -rf "${TMP_DIR}/${APP_NAME}/local"
rm -f  "${TMP_DIR}/${APP_NAME}/metadata/local.meta"

# Revert export = system → export = none for Splunkbase packaging
# (We use export = system in dev for REST conf-products refresh, but apps
#  should never export system-wide on customer instances)
META_FILE="${TMP_DIR}/${APP_NAME}/metadata/default.meta"
if [[ -f "$META_FILE" ]]; then
  sed -i '' 's/^export = system$/export = none/' "$META_FILE"
  echo "[package] default.meta: reverted export to 'none' for Splunkbase"
fi

# Strip macOS extended attributes to keep archive clean
xattr -cr "${TMP_DIR}/${APP_NAME}" 2>/dev/null || true

cd "$TMP_DIR"
# COPYFILE_DISABLE prevents macOS tar from embedding AppleDouble resource forks
COPYFILE_DISABLE=1 tar czf "$PKG_PATH" "$APP_NAME"
SIZE=$(du -h "$PKG_PATH" | cut -f1 | xargs)
echo "Created ${PKG_PATH} (${SIZE})"
