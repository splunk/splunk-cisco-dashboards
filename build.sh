#!/usr/bin/env bash
# Package and install the Splunk Cisco Dashboards app into local Splunk.
#
# Default workflow:
#   ./build.sh
#
# Useful options:
#   ./build.sh --restart
#   SPLUNK_AUTH='admin:changeme' ./build.sh
#   SPLUNK_BIN=/opt/splunk/bin/splunk ./build.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${ROOT_DIR}/packages/splunk-cisco-dashboards"
DIST_DIR="${ROOT_DIR}/dist"
APP_NAME="splunk-cisco-dashboards"
SPLUNK_BIN="${SPLUNK_BIN:-/opt/splunk/bin/splunk}"

restart_after_install=0
skip_install=0

usage() {
    cat <<EOF
Usage: ./build.sh [options]

Options:
  --restart       Restart Splunk after installing the app.
  --no-install    Build/package only; do not install into Splunk.
  --splunk-bin P  Use a specific Splunk CLI path.
  -h, --help      Show this help.

Environment:
  SPLUNK_BIN      Splunk CLI path. Defaults to /opt/splunk/bin/splunk.
  SPLUNK_AUTH     Optional auth passed as -auth, for example admin:changeme.
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --restart)
            restart_after_install=1
            shift
            ;;
        --no-install)
            skip_install=1
            shift
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

if [[ "$skip_install" -eq 1 ]]; then
    echo "[build] Skipping Splunk install (--no-install)."
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
    echo "[build] Install complete. Run './build.sh --restart' when you want a full Splunk restart."
fi
