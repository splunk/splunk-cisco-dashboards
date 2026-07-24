#!/usr/bin/env bash
# Create a .tar.gz package from stage/. Run from package root (e.g. yarn run package:app).
# Ensures stage exists (runs clean:build if not), then creates a tar.gz with the
# correct top-level directory name for Splunk installation.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="${SCRIPT_DIR}/.."
STAGE_DIR="${PKG_ROOT}/stage"
SPLUNK_RESOURCES_DIR="${PKG_ROOT}/src/main/resources/splunk"
APP_NAME="splunk-cisco-dashboards"
FROM_STAGE=0
MINIFY=0
ROOT_DIR="${PKG_ROOT}/../.."
VERSION_FILE="${ROOT_DIR}/VERSION"

usage() {
  cat <<EOF
Usage: bin/package_app.sh [--from-stage] [--minify]

Default behavior: clean stage/, run production webpack, then package stage/.

Options:
  --from-stage, --stage   Package the current stage/ directory without running
                          clean_build.sh or webpack. Current non-JavaScript
                          Splunk resources are overlaid from src/ first; React
                          bundles still come from the webpack --watch output.
  --minify                Enable JavaScript minification for a slower, smaller
                          release build. Not valid with --from-stage.
  -h, --help              Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-stage|--stage)
      FROM_STAGE=1
      shift
      ;;
    --minify)
      MINIFY=1
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

if [[ "$FROM_STAGE" -eq 1 && "$MINIFY" -eq 1 ]]; then
  echo "ERROR: --minify and --from-stage are mutually exclusive." >&2
  echo "       Minification requires a clean webpack build." >&2
  exit 2
fi

# Read version from repo-root VERSION (source of truth)
APP_CONF="${PKG_ROOT}/src/main/resources/splunk/default/app.conf"
if [[ ! -f "$VERSION_FILE" ]]; then
  echo "ERROR: VERSION file not found: ${VERSION_FILE}" >&2
  exit 1
fi
VERSION=$(tr -d '[:space:]' < "$VERSION_FILE")
if [[ -z "$VERSION" ]]; then
  echo "ERROR: VERSION file is empty: ${VERSION_FILE}" >&2
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
  if [[ ! -f "${STAGE_DIR}/default/app.conf" ]]; then
    echo "ERROR: --from-stage requested but stage/default/app.conf is missing." >&2
    echo "       stage/ is incomplete. Wait for webpack --watch to finish or run 'yarn run build'." >&2
    exit 1
  fi
  if [[ ! -d "${STAGE_DIR}/appserver/static/pages" ]] || ! compgen -G "${STAGE_DIR}/appserver/static/pages/*.js" >/dev/null; then
    echo "ERROR: --from-stage requested but stage/appserver/static/pages/*.js is missing." >&2
    echo "       stage/ is incomplete. Wait for webpack --watch to finish or run 'yarn run build'." >&2
    exit 1
  fi
  if [[ ! -d "$SPLUNK_RESOURCES_DIR" ]]; then
    echo "ERROR: Splunk resource source directory is missing: ${SPLUNK_RESOURCES_DIR}" >&2
    exit 1
  fi

  # CopyWebpackPlugin emits these files during the initial webpack compile,
  # but changes below src/main/resources/splunk are not reliably invalidating
  # the long-running watcher. Overlay them here so --from-stage always packages
  # current conf/XML/static resources while still reusing the watcher's React
  # bundles and avoiding a full webpack build.
  cp -R "${SPLUNK_RESOURCES_DIR}/." "${STAGE_DIR}/"
  cp "${ROOT_DIR}/LICENSE" "${STAGE_DIR}/LICENSE"
  cp "${ROOT_DIR}/NOTICE" "${STAGE_DIR}/NOTICE"
  echo "[package] refreshed Splunk resources from src/; reusing watcher-built React bundles"
else
  if [[ ! -d "$STAGE_DIR" ]]; then
    echo "stage/ not found; running clean:build first..."
  fi

  # Always run clean build (preserving local) to ensure package is fresh
  bash "${SCRIPT_DIR}/clean_build.sh"
  build_args=(build)
  if [[ "$MINIFY" -eq 1 ]]; then
    build_args+=(--minify)
  fi
  node "${PKG_ROOT}/bin/build.js" "${build_args[@]}"
fi

bash "${SCRIPT_DIR}/stamp_version.sh" "$STAGE_DIR"

# Remove Splunk-generated runtime artifacts from stage itself before copying.
# When developers symlink SPLUNK_HOME/etc/apps/splunk-cisco-dashboards to
# stage/, splunkd may create these files inside the repo. They are runtime
# state and should never remain in the project or ship in a package.
rm -rf "${STAGE_DIR}/local"
rm -f  "${STAGE_DIR}/metadata/local.meta"

# Stage into a temp directory with the correct app directory name
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
cp -R "$STAGE_DIR" "${TMP_DIR}/${APP_NAME}"
find "${TMP_DIR}" -name ".DS_Store" -delete
find "${TMP_DIR}" -name "* copy.*" -delete
find "${TMP_DIR}" -name "* copy" -delete
# Remove Splunk-generated runtime artifacts — they should never ship in the package.
# Because /opt/splunk/etc/apps/splunk-cisco-dashboards symlinks to stage/,
# Splunk creates local.meta and local/ at runtime inside our build output.
rm -rf "${TMP_DIR}/${APP_NAME}/local"
rm -f  "${TMP_DIR}/${APP_NAME}/metadata/local.meta"

# Revert app-wide export = system → export = none for Splunkbase packaging.
# Preserve stanza-specific exports such as macros/dnac_site_normalize%281%29,
# which must remain system-visible so callers outside this app can use them.
META_FILE="${TMP_DIR}/${APP_NAME}/metadata/default.meta"
if [[ -f "$META_FILE" ]]; then
  awk '
    /^\[[^]]*\]/ { stanza=$0 }
    stanza == "[]" && /^export[[:space:]]*=[[:space:]]*system[[:space:]]*$/ {
      sub(/system[[:space:]]*$/, "none")
    }
    { print }
  ' "$META_FILE" > "${META_FILE}.tmp" && mv "${META_FILE}.tmp" "$META_FILE"
  echo "[package] default.meta: ensured app-wide export is 'none'"
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

# Validate the exact directory that will be archived. This deliberately runs
# after copying out of stage/ so a concurrent webpack --watch process cannot
# replace the checked JavaScript between verification and packaging.
node "${PKG_ROOT}/bin/verify_production_assets.js" "${TMP_DIR}/${APP_NAME}"

cd "$TMP_DIR"
# COPYFILE_DISABLE prevents macOS tar from embedding AppleDouble resource forks
COPYFILE_DISABLE=1 tar czf "$PKG_PATH" "$APP_NAME"
SIZE=$(du -h "$PKG_PATH" | cut -f1 | xargs)
echo "Created ${PKG_PATH} (${SIZE})"
