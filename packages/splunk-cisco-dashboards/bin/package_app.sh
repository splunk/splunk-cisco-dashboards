#!/usr/bin/env bash
# Create a .tar.gz package from stage/. Run from package root (e.g. yarn run package:app).
# Ensures stage exists (runs clean:build if not), then creates a tar.gz with the
# correct top-level directory name for Splunk installation.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="${SCRIPT_DIR}/.."
STAGE_DIR="${PKG_ROOT}/stage"
APP_NAME="splunk-cisco-dashboards"
FROM_STAGE=0

usage() {
  cat <<EOF
Usage: bin/package_app.sh [--from-stage]

Default behavior: clean stage/, run production webpack, then package stage/.

Options:
  --from-stage, --stage   Package the current stage/ directory without running
                          clean_build.sh or webpack. Useful when webpack --watch
                          is already maintaining stage/ and you still want to
                          create a tarball for splunkd install.
  -h, --help              Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-stage|--stage)
      FROM_STAGE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

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

if [[ "$FROM_STAGE" -eq 1 ]]; then
  if [[ ! -d "$STAGE_DIR" ]]; then
    echo "ERROR: --from-stage requested but stage/ does not exist." >&2
    echo "       Run 'yarn run package:app' once, or keep 'yarn start' running until webpack has compiled." >&2
    exit 1
  fi
  echo "[package] using existing stage/ (--from-stage); skipping clean build and webpack"
else
  if [[ ! -d "$STAGE_DIR" ]]; then
    echo "stage/ not found; running clean:build first..."
  fi

  # Always run clean build (preserving local) to ensure package is fresh
  bash "${SCRIPT_DIR}/clean_build.sh"
  node "${PKG_ROOT}/bin/build.js" build
fi

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

# Bump [install] build in the packaged app.conf only. Source app.conf is
# never modified. Counter climbs across runs: new = max(source_build, highest
# build stamped in any existing dist/ tarball) + 1. The .tar.gz files in
# dist/ act as the persistent counter — no state file needed.
PKG_APP_CONF="${TMP_DIR}/${APP_NAME}/default/app.conf"
source_build=$(grep -E '^\s*build\s*=' "$APP_CONF" | head -1 | sed -E 's/.*=\s*//' | tr -d '[:space:]')
highest_prev=0
for prev_tar in "${DIST_DIR}"/${APP_NAME}-*.tar.gz; do
  [[ -f "$prev_tar" ]] || continue
  b=$(tar -xzOf "$prev_tar" "${APP_NAME}/default/app.conf" 2>/dev/null \
      | grep -E '^\s*build\s*=' | head -1 | sed -E 's/.*=\s*//' | tr -d '[:space:]')
  if [[ "$b" =~ ^[0-9]+$ ]] && (( b > highest_prev )); then
    highest_prev=$b
  fi
done
base=$source_build
(( highest_prev > base )) && base=$highest_prev
new_build=$((base + 1))
# sed -i has different syntax on macOS (BSD) vs Linux (GNU). Detect once
# so this script keeps working in CI containers as well as on developer macs.
if sed --version >/dev/null 2>&1; then
  sed_i=( sed -i )
else
  sed_i=( sed -i '' )
fi
"${sed_i[@]}" -E "s/^([[:space:]]*build[[:space:]]*=[[:space:]]*)[0-9]+/\\1${new_build}/" "$PKG_APP_CONF"
echo "[package] app.conf: bumped build ${base} -> ${new_build} (package only, source unchanged)"

# Provenance comment block above [install]. Helps debug "which commit
# produced this tarball" without untarring + diffing the whole tree.
# Git lookups are best-effort so the build still works in a tarball
# extracted outside a git checkout. Matches the convention used by
# ta_cisco_common/build.sh and field-solutions-demo-data-gen/package_app.sh.
BUILD_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
GIT_SHA=$(cd "$PKG_ROOT" && git rev-parse --short=12 HEAD 2>/dev/null || echo "unknown")
GIT_DIRTY=$(cd "$PKG_ROOT" && git diff --quiet 2>/dev/null && echo "" || echo "-dirty")
GIT_BRANCH=$(cd "$PKG_ROOT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
BUILD_USER="${USER:-unknown}@$(hostname -s 2>/dev/null || echo unknown)"
PROVENANCE="# Built: ${BUILD_TS} commit ${GIT_SHA}${GIT_DIRTY} branch ${GIT_BRANCH} by ${BUILD_USER}"
# Insert the provenance line immediately before the first occurrence of
# [install]. awk is portable across BSD/GNU and avoids sed escaping headaches.
awk -v line="$PROVENANCE" '
  !inserted && /^\[install\]/ { print line; inserted=1 }
  { print }
' "$PKG_APP_CONF" > "${PKG_APP_CONF}.tmp" && mv "${PKG_APP_CONF}.tmp" "$PKG_APP_CONF"

# Strip macOS extended attributes to keep archive clean
xattr -cr "${TMP_DIR}/${APP_NAME}" 2>/dev/null || true

cd "$TMP_DIR"
# COPYFILE_DISABLE prevents macOS tar from embedding AppleDouble resource forks
COPYFILE_DISABLE=1 tar czf "$PKG_PATH" "$APP_NAME"
SIZE=$(du -h "$PKG_PATH" | cut -f1 | xargs)
echo "Created ${PKG_PATH} (${SIZE})"
