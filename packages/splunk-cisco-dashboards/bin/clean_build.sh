#!/usr/bin/env bash
# Remove stage directory entirely for a clean build.
# Always preserves runtime state from a linked stage/ unless --wipe-local is
# passed: local/ configuration, metadata/local.meta, and generated lookup CSVs.
# Source-owned lookup CSVs and all *.csv.default seeds are rebuilt from source.
#
# The runtime backup is deliberately unique to this invocation. stage/ can be
# linked into a running development instance, so a failed/interrupted cleanup
# must never collide with another build or discard that instance's state.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE_DIR="${SCRIPT_DIR}/../stage"
SPLUNK_RESOURCES_DIR="${SCRIPT_DIR}/../src/main/resources/splunk"
BACKUP_DIR=""
LOCAL_BACKUP=""
METADATA_LOCAL_BACKUP=""
RUNTIME_LOOKUPS_BACKUP=""

path_exists() {
  [[ -e "$1" || -L "$1" ]]
}

prepare_backup_dir() {
  if [[ -z "$BACKUP_DIR" ]]; then
    BACKUP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/scd-clean-build.XXXXXX")"
    trap restore_local EXIT
  fi
}

restore_local() {
  local exit_status=$?
  local keep_backup=0
  local lookup_backup lookup_name lookup_destination

  if [[ -n "$LOCAL_BACKUP" ]] && path_exists "$LOCAL_BACKUP"; then
    if path_exists "${STAGE_DIR}/local"; then
      # A concurrent process recreated local/. Keep the original data in its
      # unique backup rather than overwriting either copy. The printed path is
      # an explicit recovery location for the operator.
      echo "ERROR: ${STAGE_DIR}/local was recreated before it could be restored." >&2
      echo "       Preserved original local state at ${LOCAL_BACKUP}" >&2
      keep_backup=1
      exit_status=1
    elif mkdir -p "$STAGE_DIR" && mv "$LOCAL_BACKUP" "${STAGE_DIR}/local"; then
      echo "Restored ${STAGE_DIR}/local"
    else
      echo "ERROR: could not restore ${STAGE_DIR}/local; preserved it at ${LOCAL_BACKUP}" >&2
      keep_backup=1
      exit_status=1
    fi
  fi

  if [[ -n "$METADATA_LOCAL_BACKUP" ]] && path_exists "$METADATA_LOCAL_BACKUP"; then
    if path_exists "${STAGE_DIR}/metadata/local.meta"; then
      echo "ERROR: ${STAGE_DIR}/metadata/local.meta was recreated before it could be restored." >&2
      echo "       Preserved original metadata state at ${METADATA_LOCAL_BACKUP}" >&2
      keep_backup=1
      exit_status=1
    elif mkdir -p "${STAGE_DIR}/metadata" && mv "$METADATA_LOCAL_BACKUP" "${STAGE_DIR}/metadata/local.meta"; then
      echo "Restored ${STAGE_DIR}/metadata/local.meta"
    else
      echo "ERROR: could not restore ${STAGE_DIR}/metadata/local.meta; preserved it at ${METADATA_LOCAL_BACKUP}" >&2
      keep_backup=1
      exit_status=1
    fi
  fi

  if [[ -n "$RUNTIME_LOOKUPS_BACKUP" && -d "$RUNTIME_LOOKUPS_BACKUP" ]]; then
    while IFS= read -r -d '' lookup_backup; do
      lookup_name="$(basename "$lookup_backup")"
      lookup_destination="${STAGE_DIR}/lookups/${lookup_name}"
      if path_exists "$lookup_destination"; then
        echo "ERROR: ${lookup_destination} was recreated before it could be restored." >&2
        echo "       Preserved original lookup state at ${lookup_backup}" >&2
        keep_backup=1
        exit_status=1
      elif mkdir -p "${STAGE_DIR}/lookups" && mv "$lookup_backup" "$lookup_destination"; then
        echo "Restored ${lookup_destination}"
      else
        echo "ERROR: could not restore ${lookup_destination}; preserved it at ${lookup_backup}" >&2
        keep_backup=1
        exit_status=1
      fi
    done < <(find "$RUNTIME_LOOKUPS_BACKUP" -maxdepth 1 -type f -name '*.csv' -print0)
  fi

  if [[ "$keep_backup" -eq 0 && -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]]; then
    rm -rf "$BACKUP_DIR"
  fi

  return "$exit_status"
}

if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--wipe-local" ) ]]; then
  echo "Usage: bin/clean_build.sh [--wipe-local]" >&2
  exit 2
fi

if [[ -d "$STAGE_DIR" ]]; then
  # Preserve runtime state unless --wipe-local was explicitly passed. The
  # private temporary directory and EXIT trap avoid a shared /tmp collision
  # and make an interrupted clean recover the linked app's mutable state.
  if [[ "${1:-}" != "--wipe-local" ]]; then
    if [[ -d "$STAGE_DIR/local" ]]; then
      prepare_backup_dir
      LOCAL_BACKUP="${BACKUP_DIR}/local"
      mv "$STAGE_DIR/local" "$LOCAL_BACKUP"
    fi

    if path_exists "${STAGE_DIR}/metadata/local.meta"; then
      prepare_backup_dir
      METADATA_LOCAL_BACKUP="${BACKUP_DIR}/metadata.local.meta"
      mv "${STAGE_DIR}/metadata/local.meta" "$METADATA_LOCAL_BACKUP"
    fi

    # Runtime writers materialize .csv files beside immutable source-owned
    # CSVs and *.csv.default seeds. Preserve only files not present in source;
    # the source-owned files will be supplied again by the subsequent build.
    if [[ -d "${STAGE_DIR}/lookups" ]]; then
      while IFS= read -r -d '' lookup_path; do
        lookup_name="$(basename "$lookup_path")"
        if [[ ! -f "${SPLUNK_RESOURCES_DIR}/lookups/${lookup_name}" ]]; then
          prepare_backup_dir
          RUNTIME_LOOKUPS_BACKUP="${BACKUP_DIR}/lookups"
          mkdir -p "$RUNTIME_LOOKUPS_BACKUP"
          mv "$lookup_path" "${RUNTIME_LOOKUPS_BACKUP}/${lookup_name}"
        fi
      done < <(find "${STAGE_DIR}/lookups" -maxdepth 1 -type f -name '*.csv' -print0)
    fi
  fi

  rm -rf "$STAGE_DIR"
  echo "Removed $STAGE_DIR"
fi
