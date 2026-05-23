#!/usr/bin/env bash
# Package the Splunk Cisco Dashboards app. Optionally install into local Splunk.
#
# Default workflow (package only, no install):
#   ./build.sh
#
# Useful options:
#   ./build.sh --install
#   ./build.sh --install --restart
#   ./build.sh --install --auth admin:changeme
#   SPLUNK_AUTH='admin:changeme' ./build.sh --install
#   SPLUNK_BIN=/opt/splunk/bin/splunk ./build.sh --install

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${ROOT_DIR}/packages/splunk-cisco-dashboards"
DIST_DIR="${ROOT_DIR}/dist"
APP_NAME="splunk-cisco-dashboards"
APP_CONF="${APP_DIR}/src/main/resources/splunk/default/app.conf"
SPLUNK_BIN="${SPLUNK_BIN:-/opt/splunk/bin/splunk}"

do_install=0
restart_after_install=0

usage() {
    cat <<EOF
Usage: ./build.sh [options]

By default this script only packages the app into ./dist and exits.
Pass --install to also install the package into local Splunk.

Options:
  --install       Install the packaged app into local Splunk.
  --restart       Restart Splunk after installing (requires --install).
  --auth U:P      Splunk auth (user:password) passed to install/restart.
                  Overrides the SPLUNK_AUTH environment variable.
  --splunk-bin P  Use a specific Splunk CLI path.
  -h, --help      Show this help.

Environment:
  SPLUNK_BIN      Splunk CLI path. Defaults to /opt/splunk/bin/splunk.
  SPLUNK_AUTH     Optional auth passed as -auth, for example admin:changeme.
                  --auth (if provided) takes precedence over this.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --install)
            do_install=1
            shift
            ;;
        --restart)
            restart_after_install=1
            shift
            ;;
        --auth)
            if [[ $# -lt 2 ]]; then
                echo "ERROR: --auth requires user:password." >&2
                exit 2
            fi
            if [[ "$2" != *:* ]]; then
                echo "ERROR: --auth value must be in user:password form." >&2
                exit 2
            fi
            SPLUNK_AUTH="$2"
            shift 2
            ;;
        --splunk-bin)
            if [[ $# -lt 2 ]]; then
                echo "ERROR: --splunk-bin requires a path." >&2
                exit 2
            fi
            SPLUNK_BIN="$2"
            shift 2
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

# Bump [install] build in app.conf so every package gets a unique build
# number. Splunk uses this value to invalidate the UI bundle cache after
# install, so a fresh number per package guarantees customers see new
# CSS/JS the moment they reload. Bump runs before packaging so the value
# baked into the .tar.gz is the new one. A failed build still leaves
# app.conf dirty — that's expected; the next run picks up from the new
# number and the user can `git checkout` the file if they want to undo.
if [[ ! -f "$APP_CONF" ]]; then
    echo "ERROR: app.conf not found at ${APP_CONF}" >&2
    exit 1
fi
current_build="$(
    grep -E '^[[:space:]]*build[[:space:]]*=' "$APP_CONF" \
        | head -1 \
        | sed -E 's/.*=[[:space:]]*//' \
        | tr -d '[:space:]'
)"
if [[ ! "$current_build" =~ ^[0-9]+$ ]]; then
    echo "ERROR: Could not read numeric '[install] build' from app.conf (got '${current_build}')." >&2
    exit 1
fi
new_build=$((current_build + 1))
# Portable in-place edit (works on both macOS BSD sed and GNU sed). The
# regex anchors on '^[[:space:]]*build[[:space:]]*=' and requires digits
# after the '=' so 'version = 1.0.10' is never matched.
tmp_app_conf="$(mktemp)"
sed -E "s/^([[:space:]]*build[[:space:]]*=[[:space:]]*)[0-9]+/\1${new_build}/" \
    "$APP_CONF" > "$tmp_app_conf" && mv "$tmp_app_conf" "$APP_CONF"
echo "[build] Bumped [install] build: ${current_build} -> ${new_build}"

echo "[build] Packaging ${APP_NAME}..."
(cd "$APP_DIR" && yarn run package:app)

package_path="$(
    find "$DIST_DIR" -maxdepth 1 -type f -name "${APP_NAME}-*.tar.gz" \
        -print0 \
        | xargs -0 ls -t 2>/dev/null \
        | head -n 1
)"

if [[ -z "$package_path" ]]; then
    echo "ERROR: Could not find ${APP_NAME}-*.tar.gz under ${DIST_DIR}." >&2
    exit 1
fi

echo "[build] Package ready: ${package_path}"

if [[ "$do_install" -eq 0 ]]; then
    if [[ "$restart_after_install" -eq 1 ]]; then
        echo "[build] --restart has no effect without --install; skipping." >&2
    fi
    if [[ -n "${SPLUNK_AUTH:-}" ]]; then
        echo "[build] --auth/SPLUNK_AUTH has no effect without --install; skipping." >&2
    fi
    echo "[build] Package only. Pass --install to install into Splunk."
    exit 0
fi

if [[ ! -x "$SPLUNK_BIN" ]]; then
    echo "ERROR: Splunk CLI not found or not executable: ${SPLUNK_BIN}" >&2
    echo "Set SPLUNK_BIN or pass --splunk-bin." >&2
    exit 1
fi

install_cmd=("$SPLUNK_BIN" install app "$package_path" -update 1)
if [[ -n "${SPLUNK_AUTH:-}" ]]; then
    install_cmd+=(-auth "$SPLUNK_AUTH")
fi

echo "[build] Installing into Splunk..."
"${install_cmd[@]}"

if [[ "$restart_after_install" -eq 1 ]]; then
    restart_cmd=("$SPLUNK_BIN" restart)
    if [[ -n "${SPLUNK_AUTH:-}" ]]; then
        restart_cmd+=(-auth "$SPLUNK_AUTH")
    fi
    echo "[build] Restarting Splunk..."
    "${restart_cmd[@]}"
else
    echo "[build] Install complete. Run './build.sh --install --restart' when you want a full Splunk restart."
fi
