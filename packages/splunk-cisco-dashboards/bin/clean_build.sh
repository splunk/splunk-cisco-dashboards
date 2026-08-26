#!/usr/bin/env bash
# Remove stage directory entirely for a clean build.
# Always preserves stage/local/ (Splunk runtime conf overrides like custom_dashboard,
# user-edited macros, hand-authored Studio views) unless --wipe-local is passed.
#
# The local backup is deliberately unique to this invocation. stage/ can be
# linked into a running development instance, so a failed/interrupted cleanup
# must never collide with another build or discard that instance's local state.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE_DIR="${SCRIPT_DIR}/../stage"
BACKUP_DIR=""
LOCAL_BACKUP=""

restore_local() {
  local exit_status=$?

  if [[ -n "$LOCAL_BACKUP" && -d "$LOCAL_BACKUP" ]]; then
    if [[ -e "${STAGE_DIR}/local" ]]; then
      # A concurrent process recreated local/. Keep the original data in its
      # unique backup rather than overwriting either copy. The printed path is
      # an explicit recovery location for the operator.
      echo "ERROR: ${STAGE_DIR}/local was recreated before it could be restored." >&2
      echo "       Preserved original local state at ${LOCAL_BACKUP}" >&2
      BACKUP_DIR=""
      exit_status=1
    elif mkdir -p "$STAGE_DIR" && mv "$LOCAL_BACKUP" "${STAGE_DIR}/local"; then
      echo "Restored ${STAGE_DIR}/local"
    else
      echo "ERROR: could not restore ${STAGE_DIR}/local; preserved it at ${LOCAL_BACKUP}" >&2
      BACKUP_DIR=""
      exit_status=1
    fi
  fi

  if [[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
    rm -rf "$BACKUP_DIR"
  fi

  return "$exit_status"
}

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--wipe-local" ) ]]; then
  echo "Usage: bin/clean_build.sh [--wipe-local]" >&2
  exit 2
fi

if [[ -d "$STAGE_DIR" ]]; then
  # Preserve stage/local/ unless --wipe-local was explicitly passed. The
  # private temporary directory and EXIT trap avoid a shared /tmp collision
  # and make an interrupted clean recover the local configuration.
  if [[ "${1:-}" != "--wipe-local" && -d "$STAGE_DIR/local" ]]; then
    BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/scd-clean-build.XXXXXX")"
    LOCAL_BACKUP="${BACKUP_DIR}/local"
    trap restore_local EXIT
    mv "$STAGE_DIR/local" "$LOCAL_BACKUP"
  fi

  rm -rf "$STAGE_DIR"
  echo "Removed $STAGE_DIR"
fi
