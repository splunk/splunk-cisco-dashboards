#!/usr/bin/env bash
# Create a .tar.gz package from stage/. Run from package root (e.g. yarn run package:app).
# Ensures stage exists (runs clean:build if not), then creates a tar.gz with the
# correct top-level directory name for Splunk installation.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="${SCRIPT_DIR}/.."
STAGE_DIR="${PKG_ROOT}/stage"
SPLUNK_RESOURCES_DIR="${PKG_ROOT}/src/main/resources/splunk"
APP_NAME="splunk-cisco-dashboards"
FROM_STAGE=0
MINIFY=0
DEVELOPER_PROFILE=0
ROOT_DIR="${PKG_ROOT}/../.."
VERSION_FILE="${ROOT_DIR}/VERSION"

usage() {
  cat <<EOF
Usage: bin/package_app.sh [--from-stage] [--minify] [--developer]

Default behavior: clean stage/, run minified production webpack, then create
the Splunkbase profile without resources listed as developing in the app
manifest.

Options:
  --from-stage, --stage   Package the current stage/ directory without running
                          clean_build.sh or webpack. Stage reuse implies the
                          developer profile. Current non-JavaScript Splunk
                          resources are overlaid from src/ first; React bundles
                          still come from the webpack --watch output.
  --minify                Enable JavaScript minification for a slower, smaller
                          developer clean build. Splunkbase packages are always
                          minified. Not valid with --from-stage.
  --developer             Include all resources listed as developing and write
                          a clearly labeled developer tarball. Intended for
                          local use.
  -h, --help              Show this help.
EOF
}

archive_identity() {
  local archive="$1"
  tar -xzOf "$archive" "${APP_NAME}/default/app.conf" 2>/dev/null | awk '
    /^\[/ { section=$0 }
    section == "[id]" && /^[[:space:]]*version[[:space:]]*=/ {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      version=$0
    }
    section == "[install]" && /^[[:space:]]*build[[:space:]]*=/ {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      build=$0
    }
    END {
      if (version != "" && build != "") print version "\t" build
    }
  '
}

read_app_conf_build() {
  local file="$1"
  awk '
    /^\[/ { section=$0 }
    section == "[install]" && /^[[:space:]]*build[[:space:]]*=/ {
      sub(/^[^=]*=/, "")
      gsub(/^[[:space:]]+|[[:space:]]+$/, "")
      print
      exit
    }
  ' "$file"
}

resolve_release_history_build_floor() {
  node -e '
    const fs = require("fs");
    const ledger = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const builds = Array.isArray(ledger.build_allocations)
      ? ledger.build_allocations.map((entry) => entry.build)
      : [];
    const validBuilds = builds.filter((build) => Number.isSafeInteger(build) && build > 0);
    process.stdout.write(String(validBuilds.length ? Math.max(...validBuilds) : 0));
  ' "${ROOT_DIR}/releases/splunkbase-9257.json"
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
    --developer)
      DEVELOPER_PROFILE=1
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

# A watcher-built stage can contain developing resources and is not a clean
# production build. Preserve the historical --from-stage behavior by making
# stage reuse imply the developer profile for direct package-script callers.
if [[ "$FROM_STAGE" -eq 1 ]]; then
  DEVELOPER_PROFILE=1
fi

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
if [[ ! "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._+-]*$ ]]; then
  echo "ERROR: VERSION contains unsupported artifact-name characters: ${VERSION}" >&2
  exit 1
fi
node "${PKG_ROOT}/bin/validate_release_identity.js"

DIST_DIR="${PKG_ROOT}/../../dist"
mkdir -p "$DIST_DIR"
if [[ "$DEVELOPER_PROFILE" -eq 1 ]]; then
  APP_PROFILE="developer"
  ARTIFACT_PROFILE_SUFFIX="-developer"
else
  APP_PROFILE="splunkbase"
  ARTIFACT_PROFILE_SUFFIX=""
fi

# A Splunkbase artifact must be attributable to one exact, committed source
# state. A watcher-linked stage can retain stale bundles, so reserve it for
# explicitly labeled developer packages only. The clean-worktree gate also
# prevents a release archive from silently containing uncommitted source
# changes that cannot be reconstructed later. Git status deliberately omits
# ignored files, though CopyWebpackPlugin can otherwise copy them from the
# resource tree, so reject ignored release inputs explicitly as well. Python
# bytecode and __pycache__ entries are the one disposable exception: they can
# be created by local handler tests or a live Splunk process, and are removed
# from the temporary archive copy below before final verification.
assert_no_ignored_release_inputs() {
  local candidate
  local relative_path
  local -a ignored_paths=()

  while IFS= read -r -d '' candidate; do
    if git -C "$ROOT_DIR" check-ignore --quiet --no-index -- "$candidate"; then
      case "$candidate" in
        */__pycache__/*|*.pyc|*.pyo)
          continue
          ;;
      esac
      relative_path="${candidate#"${ROOT_DIR}"/}"
      ignored_paths+=("$relative_path")
    fi
  done < <(find "$SPLUNK_RESOURCES_DIR" \( -type f -o -type l \) -print0)

  if [[ "${#ignored_paths[@]}" -gt 0 ]]; then
    echo "ERROR: Splunkbase packaging refuses ignored files under release inputs." >&2
    echo "       Commit approved resources or remove these ignored files before packaging:" >&2
    printf '       %s\n' "${ignored_paths[@]}" >&2
    return 1
  fi
}

resolve_release_commit() {
  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "ERROR: Splunkbase packaging requires a Git worktree at ${ROOT_DIR}." >&2
    return 1
  fi
  if ! assert_no_ignored_release_inputs; then
    return 1
  fi
  local commit
  commit="$(git -C "$ROOT_DIR" rev-parse --verify HEAD)"
  if [[ ! "$commit" =~ ^[0-9a-f]{40}$ ]]; then
    echo "ERROR: could not resolve a full Git commit for Splunkbase provenance." >&2
    return 1
  fi
  printf '%s\n' "$commit"
}

resolve_clean_release_commit() {
  if [[ -n "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=all)" ]]; then
    echo "ERROR: publishable Splunkbase packaging requires a clean Git worktree." >&2
    echo "       Commit the release source, or use --developer/--from-stage for local testing." >&2
    return 1
  fi
  resolve_release_commit
}

resolve_splunkbase_app_id() {
  node -e '
    const fs = require("fs");
    const ledger = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const appId = ledger?.app?.splunkbase_app_id;
    if (!Number.isSafeInteger(appId) || appId < 1) {
      console.error("ERROR: release ledger must contain a positive numeric app.splunkbase_app_id.");
      process.exit(1);
    }
    process.stdout.write(String(appId));
  ' "${ROOT_DIR}/releases/splunkbase-9257.json"
}

RELEASE_COMMIT=""
SPLUNKBASE_APP_ID=""
SOURCE_TREE_CLEAN=true
RELEASE_ELIGIBLE=true
if [[ "$APP_PROFILE" == "splunkbase" ]]; then
  RELEASE_COMMIT="$(resolve_clean_release_commit)"
  SPLUNKBASE_APP_ID="$(resolve_splunkbase_app_id)"
  # Published bundles are an operator-facing release surface. Keep fast,
  # unminified output for explicit developer packages, but make the default
  # SplunkBase profile consistently minified regardless of its caller.
  MINIFY=1
fi

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

# Building must not introduce an uncommitted source change or advance HEAD
# between the first gate and archive staging. Check again before copying the
# files that will become the release candidate.
if [[ "$APP_PROFILE" == "splunkbase" ]]; then
  post_build_commit="$(resolve_clean_release_commit)"
  if [[ "$post_build_commit" != "$RELEASE_COMMIT" ]]; then
    echo "ERROR: Git HEAD changed while the Splunkbase package was building." >&2
    echo "       Re-run packaging from one stable committed source state." >&2
    exit 1
  fi
fi

# Stage into a temp directory with the correct app directory name
TMP_DIR="$(mktemp -d)"
ARCHIVE_TMP=""
IDENTITY_LOCK=""
cleanup_package_temp() {
  rm -rf "$TMP_DIR"
  [[ -z "$ARCHIVE_TMP" ]] || rm -f "$ARCHIVE_TMP"
  [[ -z "$IDENTITY_LOCK" ]] || rmdir "$IDENTITY_LOCK" 2>/dev/null || true
}
trap cleanup_package_temp EXIT
cp -R "$STAGE_DIR" "${TMP_DIR}/${APP_NAME}"
find "${TMP_DIR}" -name ".DS_Store" -delete
find "${TMP_DIR}" -name "* copy.*" -delete
find "${TMP_DIR}" -name "* copy" -delete
# Remove runtime artifacts from the temporary archive copy only. stage/ can
# be linked to a live Splunk app, so packaging must not delete its local
# configuration or metadata.
rm -rf "${TMP_DIR}/${APP_NAME}/local"
rm -f  "${TMP_DIR}/${APP_NAME}/metadata/local.meta"

# Splunk can compile Python files in a watcher-linked stage/. Keep those
# runtime caches out of the package while leaving the live stage untouched so
# --from-stage remains safe and fast.
removed_python_runtime_artifacts=0
while IFS= read -r -d '' bytecode_path; do
  rm -f "$bytecode_path"
  removed_python_runtime_artifacts=$((removed_python_runtime_artifacts + 1))
done < <(find "${TMP_DIR}/${APP_NAME}" -type f \( -name '*.pyc' -o -name '*.pyo' \) -print0)
while IFS= read -r -d '' pycache_dir; do
  rm -rf "$pycache_dir"
  removed_python_runtime_artifacts=$((removed_python_runtime_artifacts + 1))
done < <(find "${TMP_DIR}/${APP_NAME}" -type d -name '__pycache__' -print0)
if [[ "$removed_python_runtime_artifacts" -gt 0 ]]; then
  echo "[package] removed ${removed_python_runtime_artifacts} Python bytecode/cache artifact(s) from package staging"
fi

# A watch-linked Splunk instance can also write mutable lookup CSVs into
# stage/lookups. Package only lookup files that exist in the source resource
# tree; generated live CSVs must remain instance state and must not leak into
# release tarballs beside their packaged *.csv.default seeds.
PACKAGED_LOOKUPS="${TMP_DIR}/${APP_NAME}/lookups"
removed_runtime_lookups=0
if [[ -d "$PACKAGED_LOOKUPS" ]]; then
  while IFS= read -r -d '' lookup_path; do
    lookup_name="$(basename "$lookup_path")"
    if [[ ! -f "${SPLUNK_RESOURCES_DIR}/lookups/${lookup_name}" ]]; then
      rm -f "$lookup_path"
      removed_runtime_lookups=$((removed_runtime_lookups + 1))
    fi
  done < <(find "$PACKAGED_LOOKUPS" -maxdepth 1 -type f -name '*.csv' -print0)
fi
if [[ "$removed_runtime_lookups" -gt 0 ]]; then
  echo "[package] removed ${removed_runtime_lookups} runtime lookup CSV(s) from package staging"
fi

# Keep the source tree and stage/ complete for local development. The selected
# app profile is applied only to the temporary app copy that is about to be
# archived, so a Splunkbase package cannot leak developing resources and a
# developer package can still install the full staged experience.
node "${PKG_ROOT}/bin/apply_build_profile.js" \
  "${TMP_DIR}/${APP_NAME}" "$APP_PROFILE"

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

# Allocate the next build into the package output only. VERSION is the sole
# operator-maintained release value; source app.conf deliberately stays at the
# build-zero template used by the sibling TA. Historical release records keep a
# clean checkout above published builds, while dist/ preserves normal local
# progress. The installation target never influences package construction.
PKG_APP_CONF="${TMP_DIR}/${APP_NAME}/default/app.conf"
source_build="$(read_app_conf_build "$APP_CONF")"
if [[ ! "$source_build" =~ ^[0-9]+$ ]]; then
  echo "ERROR: source app.conf must contain a non-negative numeric [install] build template." >&2
  exit 1
fi
history_build="$(resolve_release_history_build_floor)"
if [[ ! "$history_build" =~ ^[0-9]+$ ]]; then
  echo "ERROR: could not resolve a numeric build floor from the release ledger." >&2
  exit 1
fi
dist_build=0
for prev_tar in "${DIST_DIR}"/${APP_NAME}-*.tar.gz; do
  [[ -f "$prev_tar" ]] || continue
  previous_identity="$(archive_identity "$prev_tar" || true)"
  [[ -n "$previous_identity" ]] || continue
  IFS=$'\t' read -r previous_version previous_build <<< "$previous_identity"
  if [[ "$previous_build" =~ ^[0-9]+$ ]] && (( previous_build > dist_build )); then
    dist_build="$previous_build"
  fi
done
build_floor="$source_build"
(( history_build > build_floor )) && build_floor="$history_build"
(( dist_build > build_floor )) && build_floor="$dist_build"
new_build=$((build_floor + 1))

# Reserve the version/build identity atomically until this command exits. A
# stale reservation is intentionally fail-closed and must be inspected
# explicitly.
IDENTITY_LOCK="${DIST_DIR}/.${APP_NAME}-build${new_build}.lock"
if ! mkdir "$IDENTITY_LOCK"; then
  echo "ERROR: build ${new_build} is currently being packaged." >&2
  echo "       Inspect ${IDENTITY_LOCK}; remove it only after confirming no package command is active." >&2
  IDENTITY_LOCK=""
  exit 1
fi
# sed -i has different syntax on macOS (BSD) vs Linux (GNU). Detect once
# so this script keeps working in CI containers as well as on developer macs.
if sed --version >/dev/null 2>&1; then
  sed_i=( sed -i )
else
  sed_i=( sed -i '' )
fi
"${sed_i[@]}" -E "s/^([[:space:]]*build[[:space:]]*=[[:space:]]*)[0-9]+/\\1${new_build}/" "$PKG_APP_CONF"
echo "[package] app.conf: stamped build ${new_build} into package output (source=${source_build}, history=${history_build}, dist=${dist_build})"

# Keep source provenance in a standalone package manifest rather than
# app.conf. This records the source commit and release eligibility without
# exposing a workstation, branch name, timestamp, or dirty file details.
if [[ "$APP_PROFILE" == "splunkbase" ]]; then
  provenance_file="${TMP_DIR}/${APP_NAME}/release-provenance.json"
  printf '{\n  "schema_version": 1,\n  "splunkbase_app_id": %s,\n  "package_id": "%s",\n  "version": "%s",\n  "build": %s,\n  "git_commit": "%s",\n  "source_tree_clean": %s,\n  "release_eligible": %s\n}\n' \
    "$SPLUNKBASE_APP_ID" "$APP_NAME" "$VERSION" "$new_build" "$RELEASE_COMMIT" \
    "$SOURCE_TREE_CLEAN" "$RELEASE_ELIGIBLE" > "$provenance_file"
  echo "[package] source provenance: commit ${RELEASE_COMMIT}; release_eligible=${RELEASE_ELIGIBLE}"
fi

# Webpack emits a unique marker rather than reading app.conf at compile time.
# Replace it in the archive copy with the allocated package build so a
# --from-stage package and its UI badge carry the same release identity.
bundle_build_markers=0
while IFS= read -r -d '' bundle_path; do
  if grep -q '__SCD_PACKAGE_BUILD__' "$bundle_path"; then
    "${sed_i[@]}" "s/__SCD_PACKAGE_BUILD__/${new_build}/g" "$bundle_path"
    bundle_build_markers=$((bundle_build_markers + 1))
  fi
done < <(find "${TMP_DIR}/${APP_NAME}/appserver/static/pages" -type f -name '*.js' -print0)

# A long-running webpack watcher keeps the config values loaded when it starts.
# If that watcher predates the package-marker configuration, its unminified
# entry bundles contain the old literal APP_BUILD/APP_VERSION assignment. Fast
# developer packaging repairs that stable generated assignment in the archive
# copy, so users do not have to restart yarn start just to package current
# resources. Clean Splunkbase builds must still contain the canonical marker.
if [[ "$FROM_STAGE" -eq 1 && "$APP_PROFILE" == "developer" ]]; then
  legacy_bundle_stamps="$(node -e '
    const fs = require("fs");
    const path = require("path");
    const [pagesRoot, build, version] = process.argv.slice(1);
    const assignment = /var APP_BUILD="[^"]*"\|\|0;var APP_VERSION="[^"]*"\|\|0;/g;
    let count = 0;
    for (const name of fs.readdirSync(pagesRoot)) {
      if (!name.endsWith(".js")) continue;
      const file = path.join(pagesRoot, name);
      const source = fs.readFileSync(file, "utf8");
      const matches = source.match(assignment);
      if (!matches) continue;
      const updated = source.replace(
        assignment,
        `var APP_BUILD="${build}"||0;var APP_VERSION="${version}"||0;`,
      );
      fs.writeFileSync(file, updated, "utf8");
      count += matches.length;
    }
    process.stdout.write(String(count));
  ' "${TMP_DIR}/${APP_NAME}/appserver/static/pages" "$new_build" "$VERSION")"
  if [[ "$legacy_bundle_stamps" =~ ^[0-9]+$ ]] && (( legacy_bundle_stamps > 0 )); then
    bundle_build_markers=$((bundle_build_markers + legacy_bundle_stamps))
    echo "[package] repaired ${legacy_bundle_stamps} stale watcher bundle identity assignment(s) in package staging"
  fi

  stripped_source_map_directives="$(node -e '
    const fs = require("fs");
    const path = require("path");
    const pagesRoot = process.argv[1];
    const directive = /^[ \t]*(?:\/\/|\/\*)[#@]\s*sourceMappingURL\s*=[^\r\n]*(?:\*\/)?(?:\r?\n|$)/gm;
    let count = 0;
    for (const name of fs.readdirSync(pagesRoot)) {
      if (!name.endsWith(".js")) continue;
      const file = path.join(pagesRoot, name);
      const source = fs.readFileSync(file, "utf8");
      const matches = source.match(directive);
      if (!matches) continue;
      fs.writeFileSync(file, source.replace(directive, ""), "utf8");
      count += matches.length;
    }
    process.stdout.write(String(count));
  ' "${TMP_DIR}/${APP_NAME}/appserver/static/pages")"
  if [[ "$stripped_source_map_directives" =~ ^[0-9]+$ ]] && (( stripped_source_map_directives > 0 )); then
    echo "[package] stripped ${stripped_source_map_directives} stale watcher source-map directive(s) from package staging"
  fi
fi
if [[ "$bundle_build_markers" -eq 0 ]]; then
  echo "ERROR: no React bundle build marker was found; refusing a mismatched package." >&2
  echo "       Restart yarn start once so webpack reloads the package-marker configuration." >&2
  exit 1
fi
echo "[package] React bundles: stamped build ${new_build} in ${bundle_build_markers} bundle(s)"

# Strip macOS extended attributes to keep archive clean
xattr -cr "${TMP_DIR}/${APP_NAME}" 2>/dev/null || true

# Validate the exact directory that will be archived. This deliberately runs
# after copying out of stage/ so a concurrent webpack --watch process cannot
# replace the checked JavaScript between verification and packaging.
node "${PKG_ROOT}/bin/verify_production_assets.js" "${TMP_DIR}/${APP_NAME}"

# Re-extract and verify the completed archive before publishing it. This catches
# a future tar/file-list regression that the directory preflight cannot see,
# while keeping the audit inside this command's private temporary workspace.
verify_final_archive() {
  local archive_path="$1"
  local archive_audit_dir="${TMP_DIR}/archive-audit"
  mkdir -p "$archive_audit_dir"
  if ! tar -xzf "$archive_path" -C "$archive_audit_dir"; then
    echo "ERROR: could not re-extract the release archive for final verification." >&2
    return 1
  fi
  if [[ ! -d "${archive_audit_dir}/${APP_NAME}" ]]; then
    echo "ERROR: release archive did not contain the expected ${APP_NAME} directory." >&2
    return 1
  fi
  node "${PKG_ROOT}/bin/verify_production_assets.js" "${archive_audit_dir}/${APP_NAME}"
}

# Build the archive in dist/ so the final hard-link promotion is atomic on
# that filesystem. Archive files and symlinks only: supplying both a directory
# and its descendants to tar makes tar recurse into the directory and write
# duplicate members. The sorted file list makes member ordering stable without
# reintroducing mutable developer/host provenance into app.conf.
ARCHIVE_FILELIST="${TMP_DIR}/archive-files.txt"
(
  cd "$TMP_DIR"
  LC_ALL=C find "$APP_NAME" \( -type f -o -type l \) -print | LC_ALL=C sort > "$ARCHIVE_FILELIST"
)
ARCHIVE_TMP="$(mktemp "${DIST_DIR}/.${APP_NAME}.${VERSION}.archive.XXXXXX")"
(
  cd "$TMP_DIR"
  # COPYFILE_DISABLE prevents macOS tar from embedding AppleDouble resource forks
  COPYFILE_DISABLE=1 tar czf "$ARCHIVE_TMP" -T "$ARCHIVE_FILELIST"
)
verify_final_archive "$ARCHIVE_TMP"
PKG_PATH="${DIST_DIR}/${APP_NAME}-${VERSION}-${new_build}${ARTIFACT_PROFILE_SUFFIX}.tar.gz"
if [[ -e "$PKG_PATH" ]]; then
  echo "ERROR: immutable package path already exists: ${PKG_PATH}" >&2
  echo "       Refusing to overwrite a prior archive." >&2
  exit 1
fi

# ln(2) fails if the destination already exists, unlike tar's normal
# truncating create path. This leaves an existing release artifact untouched
# if two package invocations race for the same release identity.
if ! ln "$ARCHIVE_TMP" "$PKG_PATH"; then
  echo "ERROR: immutable package path was created concurrently: ${PKG_PATH}" >&2
  echo "       Refusing to overwrite the existing archive." >&2
  exit 1
fi
rm -f "$ARCHIVE_TMP"
ARCHIVE_TMP=""
SIZE=$(du -h "$PKG_PATH" | cut -f1 | xargs)
echo "Created ${PKG_PATH} (${SIZE})"
