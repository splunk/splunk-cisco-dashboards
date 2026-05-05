#!/usr/bin/env bash
# Remove stage directory entirely for a clean build.
# Always preserves stage/local/ (Splunk runtime conf overrides like custom_dashboard,
# user-edited macros, hand-authored Studio views) unless --wipe-local is passed.
#
# Mirrors splunk-cisco-app-navigator/packages/splunk-cisco-app-navigator/bin/clean_build.sh.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE_DIR="${SCRIPT_DIR}/../stage"

if [[ -d "$STAGE_DIR" ]]; then
  # Preserve stage/local/ unless --wipe-local was explicitly passed. We
  # move it to /tmp first so the rm -rf below can be brutal, then put
  # it back. This matches what the navigator does.
  if [[ "$1" != "--wipe-local" && -d "$STAGE_DIR/local" ]]; then
    mv "$STAGE_DIR/local" /tmp/_scd_local_backup
  fi

  rm -rf "$STAGE_DIR"
  echo "Removed $STAGE_DIR"

  if [[ -d /tmp/_scd_local_backup ]]; then
    mkdir -p "$STAGE_DIR"
    mv /tmp/_scd_local_backup "$STAGE_DIR/local"
    echo "Restored $STAGE_DIR/local"
  fi
fi
