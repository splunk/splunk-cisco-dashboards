#!/usr/bin/env bash
# Package Splunk Secure Networking Essentials into a Splunk .tar.gz.
# By default this script ONLY builds the package -- it does not touch
# any Splunk instance. Pass --install or --deploy (and optionally
# --restart) to push the build into a local Splunk.
#
# Version is read from the repo-root VERSION file and stamped into the
# staged/package app.conf at package time.
#
# Default workflow:
#   ./build.sh                                                # Splunkbase profile: minified released resources only
#   ./build.sh --developer                                    # developer profile: includes developing resources
#
# Install workflows (splunkd-managed; goes through REST mgmt port 8089):
#   ./build.sh --install --auth admin:********                # build + `splunk install app` against the default Splunk
#   SPLUNK_HOME=/opt/10 ./build.sh --install --auth admin:pw  # build + install against a non-default Splunk
#   ./build.sh --install --auth admin:pw --restart            # build + install + restart Splunk
#   ./build.sh --remote-install splunk@host --ssh-port 10000
#   ./build.sh --no-build --remote-install splunk@host --ssh-port 10000 --remote-auth-user admin
#
# Deploy workflow (filesystem swap; fast for dev iteration):
#   ./build.sh --deploy                                       # filesystem swap (preserves local/ + live lookup CSVs)
#   SPLUNK_HOME=/opt/10 ./build.sh --deploy --restart         # same against /opt/10, then `splunk restart`
#
# Install/deploy WITHOUT rebuilding (re-use the immutable dist artifact whose
# package ID, version, and build match the current source release identity).
# Handy when you've built once and want to fan that same artifact out to
# multiple local Splunk instances that each have their own admin password:
#   ./build.sh                                                                # build once
#   ./build.sh --no-build --install --auth admin:pw1                          # -> default Splunk
#   SPLUNK_HOME=/opt/10 ./build.sh --no-build --install --auth admin:pw2      # -> /opt/10
#   SPLUNK_HOME=/opt/9  ./build.sh --no-build --deploy --restart --auth a:b   # -> /opt/9 (filesystem) + restart
#
# Watch-mode workflow (keeps splunkd install, skips full webpack rebuild):
#   cd packages/splunk-cisco-dashboards && yarn start     # terminal 1; maintains stage/
#   SPLUNK_HOME=/opt/10 ./build.sh --developer --fast --install --auth admin:pw
#
# --install vs --deploy (mutually exclusive; mirrors ta_cisco_common/build.sh
# and field-solutions-demo-data-gen/build.sh):
#   --install: splunkd handles extraction. Auth required. Slower but
#              identical to a real Splunkbase install. local/ preserved
#              by the -update 1 contract.
#   --deploy:  filesystem swap (cp -R). NO auth required, NO mgmt port
#              touched. Restart still needed for Python/conf to take
#              effect. local/ and live lookup CSVs are explicitly preserved.
#
# Auth can also be supplied via the splunk-CLI-native short form (`-auth`)
# or the single-arg form (`--auth=user:pass`). The legacy `SPLUNK_AUTH`
# env var is still honored for back-compat.
#
# Useful options:
#   ./build.sh --splunk-bin /some/custom/path/splunk          # override the Splunk CLI path directly
#   ./build.sh --developer --minify                           # slower, smaller developer package
#   ./build.sh --lint-spl-antipatterns                        # opt in to the experimental SPL policy gate
#
# Environment:
#   SPLUNK_HOME   Splunk install root. Defaults to /Applications/Splunk on
#                 macOS, /opt/splunk on Linux. The CLI is derived as
#                 $SPLUNK_HOME/bin/splunk. Examples: /opt/splunk, /opt/10.
#   SPLUNK_BIN    Full path to the Splunk CLI. Overrides the path derived
#                 from SPLUNK_HOME. Kept for back-compat.
#   SPLUNK_AUTH   Fallback auth in user:pass form, used only when --auth
#                 / -auth is not on the command line.

set -euo pipefail

# Repository Python helpers and tests must not write runtime bytecode into
# release inputs or other source directories. The packaging path also
# sanitizes known Python cache artifacts from its temporary archive copy.
export PYTHONDONTWRITEBYTECODE=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="splunk-cisco-dashboards"
APP_DIR="${ROOT_DIR}/packages/${APP_NAME}"
DIST_DIR="${ROOT_DIR}/dist"
VERSION_FILE="${ROOT_DIR}/VERSION"

do_install=0
do_deploy=0
no_build=0
from_stage=0
minify=0
developer_profile=0
lint_spl_antipatterns=0
restart_after_install=0
verbose=0
splunk_bin_override=""
auth_override=""
auth_explicit=0
splunk_bin_explicit=0
remote_install=0
remote_target=""
remote_options_set=0
ssh_port="22"
remote_splunk_user="splunk"
remote_splunk_home="/opt/splunk"
remote_auth_user=""
remote_management_port="8089"
remote_auth_options_set=0

# ---------------------------------------------------------------------
# Output helpers. By default the script is QUIET: only headlines,
# errors, and the final summary banner reach the terminal. The chatty
# internal progress (yarn webpack noise, tar extract spam, the dozen
# "[build] Doing X" lines, etc.) is suppressed unless --verbose is set.
# On any captured-command failure we ALWAYS dump the captured log to
# stderr -- silencing successful runs must never silence failures.
# Mirrors field-solutions-demo-data-gen/build.sh and ta_cisco_common/build.sh.
# ---------------------------------------------------------------------
say() {
    [[ "$verbose" -eq 1 ]] && echo "$@" || true
}
hdr() {
    echo "$@"
}
err() {
    echo "$@" >&2
}
# Lines we always strip from command output. See FSDG build.sh for the
# rationale on the cliVerifyServerName warning.
_NOISE_LINES=(
    'Server Certificate Hostname Validation is disabled'
)
_noise_filter() {
    if [[ ${#_NOISE_LINES[@]} -eq 0 ]]; then
        cat
        return
    fi
    local args=()
    local p
    for p in "${_NOISE_LINES[@]}"; do
        args+=(-e "$p")
    done
    grep -v -F "${args[@]}" || true
}

run_quietly() {
    # See FSDG build.sh for the full rationale on:
    #  * `|| rc=$?` / PIPESTATUS to capture the real rc under set -e
    #  * pipe (not process substitution) for synchronous filter delivery
    # Verbose mode deliberately bypasses filtering so progress renderers keep
    # their terminal semantics and the caller sees the command's exact output.
    local logfile rc=0
    if [[ "$verbose" -eq 1 ]]; then
        set +e
        "$@"
        rc=$?
        set -e
        return "$rc"
    fi
    logfile="$(mktemp -t scd-build-XXXXXX.log)"
    "$@" >"$logfile" 2>&1 || rc=$?
    if [[ "$rc" -eq 0 ]]; then
        rm -f "$logfile"
        return 0
    fi
    err "ERROR: command failed: $*"
    err "---- captured output ----"
    _noise_filter <"$logfile" >&2
    err "---- end captured output ----"
    rm -f "$logfile"
    return "$rc"
}

archive_identity() {
    local archive="$1"
    tar -xzOf "$archive" "${APP_NAME}/default/app.conf" 2>/dev/null | awk '
        /^\[/ { section=$0 }
        section == "[id]" && /^[[:space:]]*name[[:space:]]*=/ {
            sub(/^[^=]*=/, "")
            gsub(/^[[:space:]]+|[[:space:]]+$/, "")
            package_id=$0
        }
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
            if (package_id != "" && version != "" && build != "") {
                print package_id "\t" version "\t" build
            }
        }
    '
}

archive_modified_epoch() {
    local archive="$1"
    if [[ "$(uname -s)" == "Darwin" ]]; then
        stat -f '%m' "$archive"
    else
        stat -c '%Y' "$archive"
    fi
}

find_release_archive() {
    local expected_package_id="$1"
    local expected_version="$2"
    local expected_build="$3"
    local expected_profile="$4"
    local archive archive_profile identity archive_package_id archive_version archive_build archive_mtime newest_mtime=""
    local match=""
    local match_count=0

    while IFS= read -r -d '' archive; do
        archive_profile="splunkbase"
        [[ "$archive" == *-developer.tar.gz ]] && archive_profile="developer"
        [[ "$archive_profile" == "$expected_profile" ]] || continue

        identity="$(archive_identity "$archive")"
        [[ -n "$identity" ]] || continue
        IFS=$'\t' read -r archive_package_id archive_version archive_build <<< "$identity"
        if [[ "$archive_package_id" == "$expected_package_id" \
            && "$archive_version" == "$expected_version" \
            && "$archive_build" == "$expected_build" ]]; then
            if [[ "$expected_profile" == "developer" ]]; then
                archive_mtime="$(archive_modified_epoch "$archive")" || return 1
                if [[ -z "$newest_mtime" || "$archive_mtime" -gt "$newest_mtime" \
                    || ("$archive_mtime" -eq "$newest_mtime" && "$archive" > "$match") ]]; then
                    match="$archive"
                    newest_mtime="$archive_mtime"
                fi
                match_count=$((match_count + 1))
            else
                match="$archive"
                match_count=$((match_count + 1))
            fi
        fi
    done < <(find "$DIST_DIR" -maxdepth 1 -type f -name "${APP_NAME}-*-sha256-*.tar.gz" -print0)

    if [[ "$match_count" -eq 0 ]]; then
        err "ERROR: no immutable ${expected_profile} archive was found for package ${expected_package_id}, version ${expected_version}, build ${expected_build}."
        return 1
    fi
    if [[ "$expected_profile" != "developer" && "$match_count" -gt 1 ]]; then
        err "ERROR: found ${match_count} immutable ${expected_profile} archives for package ${expected_package_id}, version ${expected_version}, build ${expected_build}; refusing an ambiguous install target."
        return 1
    fi

    printf '%s\n' "$match"
}

sha256_file() {
    local file="$1"
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{print $1}'
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | awk '{print $1}'
    else
        err "ERROR: neither shasum nor sha256sum is available to verify the release archive."
        return 1
    fi
}

verify_release_archive() {
    local archive="$1"
    local archive_name expected_sha actual_sha checksum_path checksum_record

    if [[ ! -f "$archive" ]]; then
        err "ERROR: release archive is missing: ${archive}"
        return 1
    fi
    archive_name="$(basename "$archive")"
    if [[ ! "$archive_name" =~ ^${APP_NAME}-[A-Za-z0-9][A-Za-z0-9._+-]*-sha256-([0-9a-f]{64})(-developer)?\.tar\.gz$ ]]; then
        err "ERROR: release archive does not use the required immutable SHA-256 filename: ${archive_name}"
        return 1
    fi
    expected_sha="${BASH_REMATCH[1]}"
    checksum_path="${archive}.sha256"
    if [[ ! -f "$checksum_path" ]]; then
        err "ERROR: release archive checksum sidecar is missing: ${checksum_path}"
        return 1
    fi
    checksum_record="$(cat "$checksum_path")"
    if [[ "$checksum_record" != "${expected_sha}  ${archive_name}" ]]; then
        err "ERROR: checksum sidecar does not exactly describe ${archive_name}."
        return 1
    fi
    actual_sha="$(sha256_file "$archive")" || return 1
    actual_sha="$(printf '%s' "$actual_sha" | tr '[:upper:]' '[:lower:]')"
    if [[ "$actual_sha" != "$expected_sha" ]]; then
        err "ERROR: SHA-256 mismatch for ${archive_name}; expected ${expected_sha}, got ${actual_sha}."
        return 1
    fi
}

write_remote_rest_helper() {
    local helper_path="$1"

    (
        umask 077
        cat >"$helper_path" <<'REMOTE_REST_HELPER'
#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
    echo "ERROR: expected archive, Splunk user, management port, and SPLUNK_HOME." >&2
    exit 2
fi

archive="$1"
splunk_user="$2"
management_port="$3"
splunk_home="$4"
ca_cert="${splunk_home%/}/etc/auth/cacert.pem"

if [[ ! "$archive" =~ ^/[A-Za-z0-9._/+:-]+$ ]] || [[ ! -f "$archive" ]]; then
    echo "ERROR: remote app archive is missing or unsafe." >&2
    exit 2
fi
if [[ ! "$splunk_user" =~ ^[A-Za-z0-9][A-Za-z0-9@._+-]{0,127}$ ]]; then
    echo "ERROR: Splunk username contains unsupported characters." >&2
    exit 2
fi
if [[ ! "$management_port" =~ ^[0-9]+$ ]] || (( management_port < 1 || management_port > 65535 )); then
    echo "ERROR: Splunk management port must be from 1 through 65535." >&2
    exit 2
fi
if [[ ! -r "$ca_cert" ]]; then
    echo "ERROR: Splunk CA certificate is not readable: $ca_cert" >&2
    exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
    echo "ERROR: curl is required for password-prompted remote installation." >&2
    exit 1
fi

curl_config_escape() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//$'\t'/\\t}"
    value="${value//$'\r'/\\r}"
    value="${value//$'\n'/\\n}"
    printf '%s' "$value"
}

printf "Splunk password for user '%s': " "$splunk_user" >&2
if ! IFS= read -r -s splunk_password </dev/tty; then
    printf '\nERROR: could not read the Splunk password from the terminal.\n' >&2
    exit 1
fi
printf '\n' >&2

set +e
{
    printf 'user = "'
    curl_config_escape "$splunk_user"
    printf ':'
    curl_config_escape "$splunk_password"
    printf '"\n'
} | curl --config - \
    --fail \
    --silent \
    --show-error \
    --output /dev/null \
    --cacert "$ca_cert" \
    --resolve "SplunkServerDefaultCert:${management_port}:127.0.0.1" \
    "https://SplunkServerDefaultCert:${management_port}/services/apps/local" \
    --data 'filename=true' \
    --data-urlencode "name=${archive}" \
    --data 'update=true'
curl_status=$?
set -e

unset splunk_password
exit "$curl_status"
REMOTE_REST_HELPER
        chmod 0600 "$helper_path"
    )
}

close_remote_ssh_master() {
    local control_path="$1"
    local control_dir="$2"

    ssh -p "$ssh_port" -o BatchMode=yes -o "ControlPath=$control_path" \
        -O exit "$remote_target" >/dev/null 2>&1 || true
    rm -f "$control_path" 2>/dev/null || true
    rmdir "$control_dir" 2>/dev/null || true
}

remote_install_archive() {
    local archive="$1"
    local archive_name remote_archive remote_bundle_tmp remote_command remote_helper_local="" remote_helper_upload remote_ssh_user remote_splunk_cli remote_upload
    local control_dir control_path
    local scp_args
    local ssh_args

    if ! command -v scp >/dev/null 2>&1; then
        err "ERROR: scp is required for --remote-install."
        return 1
    fi
    if ! command -v ssh >/dev/null 2>&1; then
        err "ERROR: ssh is required for --remote-install."
        return 1
    fi

    archive_name="$(basename "$archive")"
    if [[ ! "$archive_name" =~ ^[A-Za-z0-9._+-]+$ ]]; then
        err "ERROR: archive name contains unsupported characters: $archive_name"
        return 1
    fi
    remote_ssh_user="${remote_target%%@*}"
    remote_upload="/tmp/${remote_ssh_user}-${archive_name}"
    remote_archive="${remote_splunk_home%/}/var/run/splunk/${remote_ssh_user}-${archive_name}"
    remote_bundle_tmp="${remote_splunk_home%/}/var/run/splunk/bundle_tmp"
    remote_helper_upload="/tmp/${remote_ssh_user}-${APP_NAME}-remote-install.sh"
    remote_splunk_cli="${remote_splunk_home%/}/bin/splunk"

    if [[ -n "$remote_auth_user" ]]; then
        remote_helper_local="$(mktemp "${TMPDIR:-/tmp}/${APP_NAME}-remote-install.XXXXXX")"
        write_remote_rest_helper "$remote_helper_local"
        if [[ "$remote_ssh_user" == "$remote_splunk_user" ]]; then
            remote_command="set -e; mkdir -p '$remote_bundle_tmp'; mv '$remote_upload' '$remote_archive'; chmod 0600 '$remote_archive'; bash '$remote_helper_upload' '$remote_archive' '$remote_auth_user' '$remote_management_port' '$remote_splunk_home'; rm -f '$remote_archive' '$remote_helper_upload' || true"
        else
            remote_command="set -e; chmod 0644 '$remote_upload' '$remote_helper_upload'; sudo -iu '$remote_splunk_user' mkdir -p '$remote_bundle_tmp'; sudo -iu '$remote_splunk_user' cp '$remote_upload' '$remote_archive'; sudo -iu '$remote_splunk_user' chmod 0600 '$remote_archive'; sudo -iu '$remote_splunk_user' bash '$remote_helper_upload' '$remote_archive' '$remote_auth_user' '$remote_management_port' '$remote_splunk_home'; sudo -iu '$remote_splunk_user' rm -f '$remote_archive'; rm -f '$remote_upload' '$remote_helper_upload' || true"
        fi
    elif [[ "$remote_ssh_user" == "$remote_splunk_user" ]]; then
        remote_command="set -e; mkdir -p '$remote_bundle_tmp'; mv '$remote_upload' '$remote_archive'; chmod 0600 '$remote_archive'; '$remote_splunk_cli' install app '$remote_archive' -update 1; rm -f '$remote_archive' || true"
    else
        remote_command="set -e; chmod 0644 '$remote_upload'; sudo -iu '$remote_splunk_user' mkdir -p '$remote_bundle_tmp'; sudo -iu '$remote_splunk_user' cp '$remote_upload' '$remote_archive'; sudo -iu '$remote_splunk_user' chmod 0600 '$remote_archive'; sudo -iu '$remote_splunk_user' '$remote_splunk_cli' install app '$remote_archive' -update 1; sudo -iu '$remote_splunk_user' rm -f '$remote_archive'; rm -f '$remote_upload' || true"
    fi

    control_dir="$(mktemp -d "${TMPDIR:-/tmp}/${APP_NAME}-ssh.XXXXXX")"
    control_path="$control_dir/cm"
    scp_args=(-P "$ssh_port" -o ControlMaster=auto -o ControlPersist=60 -o "ControlPath=$control_path")
    ssh_args=(-tt -p "$ssh_port" -o ControlMaster=auto -o ControlPersist=60 -o "ControlPath=$control_path")
    if [[ "$verbose" -ne 1 ]]; then
        scp_args+=(-q)
        ssh_args+=(-q)
    fi

    hdr "Uploading $archive_name to $remote_target:$remote_upload ..."
    if ! scp "${scp_args[@]}" "$archive" "${remote_target}:${remote_upload}"; then
        rm -f "$remote_helper_local"
        close_remote_ssh_master "$control_path" "$control_dir"
        err "ERROR: archive upload failed; the local archive is unchanged."
        return 1
    fi
    if [[ -n "$remote_auth_user" ]] && ! scp "${scp_args[@]}" "$remote_helper_local" "${remote_target}:${remote_helper_upload}"; then
        rm -f "$remote_helper_local"
        close_remote_ssh_master "$control_path" "$control_dir"
        err "ERROR: remote password helper upload failed; the local archive is unchanged."
        return 1
    fi
    rm -f "$remote_helper_local"

    if [[ "$remote_ssh_user" == "$remote_splunk_user" ]]; then
        hdr "Installing remotely as $remote_splunk_user directly (sudo not required) ..."
    else
        hdr "Installing remotely as $remote_splunk_user via sudo ..."
    fi
    if [[ -n "$remote_auth_user" ]]; then
        hdr "Authenticating to Splunk as $remote_auth_user; enter the Splunk password when prompted."
        hdr "The password is not cached or passed on the command line."
    else
        hdr "Splunk CLI authentication is separate from the remote OS account."
        hdr "At 'Splunk username:', enter a Splunk administrator (usually admin), not '$remote_splunk_user'."
    fi
    if ! ssh "${ssh_args[@]}" "$remote_target" "$remote_command"; then
        close_remote_ssh_master "$control_path" "$control_dir"
        err "ERROR: remote Splunk app installation failed."
        err "       The uploaded archive may remain on $remote_target."
        return 1
    fi
    close_remote_ssh_master "$control_path" "$control_dir"
}

# Splunk Web translates JavaScript bundles into locale-specific files under
# var/run/splunk/appserver/i18n. During an in-place app update, a browser can
# request a large bundle while splunkd is still replacing it; Splunk then
# persists that partial response in the i18n cache and keeps serving the
# truncated JavaScript even after the installed file is complete. Remove only
# the generated cache entries whose basenames belong to this app's page
# bundles. Splunk regenerates them from the fully installed files on demand.
clear_appserver_i18n_cache() {
    local pages_dir="${SPLUNK_HOME}/etc/apps/${APP_NAME}/appserver/static/pages"
    local cache_dir="${SPLUNK_HOME}/var/run/splunk/appserver/i18n"
    local page_path page_name cache_path
    local cleared=0

    if [[ ! -d "$pages_dir" || ! -d "$cache_dir" ]]; then
        return 0
    fi

    while IFS= read -r -d '' page_path; do
        page_name="$(basename "$page_path")"
        while IFS= read -r -d '' cache_path; do
            if rm -f -- "$cache_path"; then
                cleared=$((cleared + 1))
            else
                err "WARNING: Could not clear generated appserver cache: ${cache_path}"
            fi
        done < <(
            find "$cache_dir" -maxdepth 1 -type f \
                -name "${page_name}-*.cache" -print0
        )
    done < <(
        find "$pages_dir" -maxdepth 1 -type f -name '*.js' -print0
    )

    say "[build] Cleared ${cleared} generated appserver JavaScript cache file(s)."
}

# Resolve a default SPLUNK_HOME if the caller didn't set one. Matches the
# convention used by ta_cisco_common/build.sh and FSDG/build.sh so users
# only have to remember one env var across our Splunk repos.
if [[ -z "${SPLUNK_HOME:-}" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
        SPLUNK_HOME="/Applications/Splunk"
    else
        SPLUNK_HOME="/opt/splunk"
    fi
fi

usage() {
    cat <<EOF
Usage: ./build.sh [options]

Default behavior: build the .tar.gz only. No Splunk install, no restart.
Version is read from ./VERSION and stamped at package time.

Push-to-Splunk options (mutually exclusive):
  --install              splunkd-managed install via REST mgmt port. Calls
                         \`splunk install app dist/<app>-<version>-sha256-<digest>.tar.gz -update 1
                          -auth user:pass\`. Requires --auth.
  --deploy               Filesystem swap into \$SPLUNK_HOME/etc/apps/<app>
                         through a prepared sibling replacement (preserves
                         local/ and runtime lookup CSVs). Faster than
                         --install for dev iteration. No auth required.
  --remote-install USER@HOST
                         Upload and install on a remote Splunk host over SSH.
                         Direct OS login as splunk avoids sudo; other OS users
                         run the install as --remote-splunk-user via sudo.

Other options:
  --no-build             Skip the yarn package step and reuse the immutable
                         dist/<app>-*.tar.gz whose package ID, version, and
                         build match current source. Requires --install or
                         --deploy. Lets you fan one build out to multiple
                         Splunk instances without rebuilding each time.
  --fast, --from-stage   Package the current packages/<app>/stage directory
                         without running clean_build.sh or webpack. Designed
                         for use with a long-running 'yarn start' watcher.
                         Refreshes non-JavaScript Splunk resources from src/
                         before packaging; React bundles come from the watcher.
                         Stage reuse automatically selects the developer
                         profile; --developer may also be supplied explicitly.
                         Still creates a fresh tarball and can still use
                         --install, so splunkd remains the installer.
  --minify               Enable JavaScript minification for a clean developer
                         build. SplunkBase packages are always minified.
                         Not valid with --fast or --no-build.
  --developer            Include resources listed in the app's
                         config/build-profile-manifest.json. Writes a
                         SHA-256-addressed *-developer.tar.gz intended only
                         for local testing.
                         Without this flag, packaging is Splunkbase-safe.
  --lint-spl-antipatterns
                         Run the experimental Searchbase SPL anti-pattern
                         policy gate before packaging. Disabled by default
                         because some valid searches intentionally use sort,
                         dedup, or fillnull semantics that require review.
  --auth user:pass       Splunk CLI credentials. Passed through as
                         '-auth user:pass'. Aliases: -auth, --auth=user:pass.
  --ssh-port PORT        Remote SSH port (default: 22).
  --remote-splunk-user USER
                         Remote Splunk OS account (default: splunk).
  --remote-splunk-home PATH
                         Remote Splunk root (default: /opt/splunk).
  --remote-auth-user USER
                         Prompt for this Splunk administrator password without
                         caching it or placing it on a command line.
  --remote-management-port PORT
                         Remote splunkd management port (default: 8089).
  --restart              Restart Splunk after install/deploy.
  --splunk-bin PATH      Use a specific Splunk CLI path. Overrides the
                         path derived from \$SPLUNK_HOME.
  -v, --verbose          Show full command output (yarn webpack noise,
                         tar/cp chatter, splunk CLI messages, etc.).
                         Default is quiet -- only phase headlines,
                         errors, and the final summary banner.
  -h, --help             Show this help.

Examples:
  ./build.sh                                                  # Splunkbase package (released resources only)
  ./build.sh --developer                                      # local developer package
  ./build.sh --install --auth admin:********                  # build + splunkd install
  SPLUNK_HOME=/opt/10 ./build.sh --developer --fast --install --auth admin:********
  SPLUNK_HOME=/opt/10 ./build.sh --install --auth admin:******** --restart
  ./build.sh --deploy                                         # build + filesystem swap
  SPLUNK_HOME=/opt/10 ./build.sh --deploy --restart           # ... against /opt/10 + restart
  ./build.sh                                                   # minified SplunkBase release package
  ./build.sh --developer --minify                              # minified developer package

  # Build once, install to multiple instances:
  ./build.sh
  ./build.sh --no-build --install --auth admin:pw1
  SPLUNK_HOME=/opt/10 ./build.sh --no-build --install --auth admin:pw2
  ./build.sh --no-build --remote-install splunk@host --ssh-port 10000 --remote-auth-user admin

  # Keep webpack watch running, then package current stage/ and install via splunkd:
  cd packages/splunk-cisco-dashboards && yarn start
  SPLUNK_HOME=/opt/10 ./build.sh --developer --fast --install --auth admin:pw
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --install)
            do_install=1
            shift
            ;;
        --deploy)
            do_deploy=1
            shift
            ;;
        --remote-install)
            if [[ $# -lt 2 ]]; then echo "ERROR: --remote-install requires user@host." >&2; exit 2; fi
            remote_install=1; remote_target="$2"; shift 2
            ;;
        --remote-install=*) remote_install=1; remote_target="${1#--remote-install=}"; shift ;;
        --ssh-port)
            if [[ $# -lt 2 ]]; then echo "ERROR: --ssh-port requires a port." >&2; exit 2; fi
            remote_options_set=1; ssh_port="$2"; shift 2
            ;;
        --ssh-port=*) remote_options_set=1; ssh_port="${1#--ssh-port=}"; shift ;;
        --remote-splunk-user)
            if [[ $# -lt 2 ]]; then echo "ERROR: --remote-splunk-user requires an OS user." >&2; exit 2; fi
            remote_options_set=1; remote_splunk_user="$2"; shift 2
            ;;
        --remote-splunk-user=*) remote_options_set=1; remote_splunk_user="${1#--remote-splunk-user=}"; shift ;;
        --remote-splunk-home)
            if [[ $# -lt 2 ]]; then echo "ERROR: --remote-splunk-home requires an absolute path." >&2; exit 2; fi
            remote_options_set=1; remote_splunk_home="$2"; shift 2
            ;;
        --remote-splunk-home=*) remote_options_set=1; remote_splunk_home="${1#--remote-splunk-home=}"; shift ;;
        --remote-auth-user)
            if [[ $# -lt 2 ]]; then echo "ERROR: --remote-auth-user requires a Splunk username." >&2; exit 2; fi
            remote_options_set=1; remote_auth_options_set=1; remote_auth_user="$2"; shift 2
            ;;
        --remote-auth-user=*) remote_options_set=1; remote_auth_options_set=1; remote_auth_user="${1#--remote-auth-user=}"; shift ;;
        --remote-management-port)
            if [[ $# -lt 2 ]]; then echo "ERROR: --remote-management-port requires a port." >&2; exit 2; fi
            remote_options_set=1; remote_auth_options_set=1; remote_management_port="$2"; shift 2
            ;;
        --remote-management-port=*) remote_options_set=1; remote_auth_options_set=1; remote_management_port="${1#--remote-management-port=}"; shift ;;
        --no-build|--skip-build)
            # --skip-build is an alias for muscle memory; both do the same
            # thing: reuse the identity-matched dist archive instead of
            # running the yarn pipeline.
            no_build=1
            shift
            ;;
        --fast|--from-stage|--stage)
            from_stage=1
            shift
            ;;
        --minify)
            minify=1
            shift
            ;;
        --developer)
            developer_profile=1
            shift
            ;;
        --lint-spl-antipatterns)
            lint_spl_antipatterns=1
            shift
            ;;
        -v|--verbose)
            verbose=1
            shift
            ;;
        --restart)
            # --restart on its own defaults to --install (see validation
            # block below). Matches FSDG behaviour.
            restart_after_install=1
            shift
            ;;
        --auth|-auth)
            if [[ $# -lt 2 ]]; then
                echo "ERROR: $1 requires a value (user:pass)" >&2
                exit 2
            fi
            auth_override="$2"
            auth_explicit=1
            shift 2
            ;;
        --auth=*)
            auth_override="${1#--auth=}"
            auth_explicit=1
            shift
            ;;
        --splunk-bin)
            if [[ $# -lt 2 ]]; then
                echo "ERROR: --splunk-bin requires a path." >&2
                exit 2
            fi
            splunk_bin_override="$2"
            splunk_bin_explicit=1
            shift 2
            ;;
        --splunk-bin=*)
            splunk_bin_override="${1#--splunk-bin=}"
            splunk_bin_explicit=1
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

# Ask webpack for live phase/percentage updates only in verbose mode. Quiet
# builds still capture output and print it in full if the command fails.
if [[ "$verbose" -eq 1 ]]; then
    export SCD_WEBPACK_PROGRESS=1
fi

# Resolution order for the auth value:
#   1. --auth / -auth / --auth= on the command line (preferred, matches
#      splunk CLI conventions; what `ta_cisco_common/build.sh` does)
#   2. SPLUNK_AUTH env var (legacy fallback)
auth_value="${auth_override:-${SPLUNK_AUTH:-}}"

# Resolution order for the Splunk CLI path:
#   1. --splunk-bin on the command line
#   2. SPLUNK_BIN env var
#   3. derived from SPLUNK_HOME
if [[ -n "$splunk_bin_override" ]]; then
    SPLUNK_BIN="$splunk_bin_override"
else
    SPLUNK_BIN="${SPLUNK_BIN:-${SPLUNK_HOME}/bin/splunk}"
fi

# --install and --deploy are mutually exclusive: they're two different
# ways to push the same package into Splunk, and combining them just
# slows things down (and would deploy then immediately overwrite via
# splunkd).
action_count=$((do_install + do_deploy + remote_install))
if (( action_count > 1 )); then
    echo "ERROR: --install, --deploy, and --remote-install are mutually exclusive." >&2
    echo "       --install pushes via splunkd REST (slower, mgmt-port auth)." >&2
    echo "       --deploy  swaps the filesystem under \$SPLUNK_HOME/etc/apps/ (fast)." >&2
    exit 2
fi

if [[ "$remote_install" -eq 1 && "$auth_explicit" -eq 1 ]]; then
    echo "ERROR: --auth is not accepted with --remote-install." >&2
    echo "       Use --remote-auth-user for a password prompt without a cached CLI session." >&2
    exit 2
fi
if [[ "$remote_install" -eq 1 && "$splunk_bin_explicit" -eq 1 ]]; then
    echo "ERROR: --splunk-bin is local-only; use --remote-splunk-home." >&2
    exit 2
fi
if [[ "$remote_install" -eq 0 && "$remote_options_set" -eq 1 ]]; then
    echo "ERROR: remote SSH options require --remote-install user@host." >&2
    exit 2
fi
if [[ "$remote_install" -eq 1 && "$remote_auth_options_set" -eq 1 && -z "$remote_auth_user" ]]; then
    echo "ERROR: --remote-management-port requires --remote-auth-user." >&2
    exit 2
fi
if [[ "$remote_install" -eq 1 ]]; then
    if [[ ! "$remote_target" =~ ^[A-Za-z_][A-Za-z0-9_-]*@([A-Za-z0-9._-]+|\[[0-9A-Fa-f:]+\])$ ]]; then
        echo "ERROR: --remote-install target must use a safe user@host form; got '$remote_target'." >&2
        exit 2
    fi
    if [[ ! "$ssh_port" =~ ^[0-9]+$ ]] || (( ssh_port < 1 || ssh_port > 65535 )); then echo "ERROR: --ssh-port must be from 1 through 65535." >&2; exit 2; fi
    if [[ -n "$remote_auth_user" && ! "$remote_auth_user" =~ ^[A-Za-z0-9][A-Za-z0-9@._+-]{0,127}$ ]]; then echo "ERROR: --remote-auth-user contains unsupported characters." >&2; exit 2; fi
    if [[ ! "$remote_management_port" =~ ^[0-9]+$ ]] || (( remote_management_port < 1 || remote_management_port > 65535 )); then echo "ERROR: --remote-management-port must be from 1 through 65535." >&2; exit 2; fi
    if [[ ! "$remote_splunk_user" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]]; then echo "ERROR: --remote-splunk-user must be a valid OS user name." >&2; exit 2; fi
    if [[ ! "$remote_splunk_home" =~ ^/[A-Za-z0-9._/-]+$ ]] || [[ "$remote_splunk_home" == "/" ]] || [[ "/$remote_splunk_home/" == *"/../"* ]]; then echo "ERROR: --remote-splunk-home must be a safe absolute path." >&2; exit 2; fi
fi

# If the user passed --restart on its own (no --install, no --deploy),
# default to --install. Matches FSDG.
if [[ "$restart_after_install" -eq 1 && "$do_install" -eq 0 && "$do_deploy" -eq 0 && "$remote_install" -eq 0 ]]; then
    do_install=1
fi

if [[ "$restart_after_install" -eq 1 && "$remote_install" -eq 1 ]]; then
    echo "ERROR: --restart is not supported with --remote-install." >&2
    exit 2
fi

# --no-build only makes sense when paired with --install or --deploy.
# On its own it would be a noop (build is already the default, and
# we'd have nothing to push) -- catch that here rather than producing
# a confusing "Build complete" exit message.
if [[ "$no_build" -eq 1 && "$do_install" -eq 0 && "$do_deploy" -eq 0 && "$remote_install" -eq 0 ]]; then
    echo "ERROR: --no-build requires --install, --deploy, or --remote-install." >&2
    echo "       Use it to reuse an existing dist/<app>-*.tar.gz on another" >&2
    echo "       Splunk instance, e.g.:" >&2
    echo "         SPLUNK_HOME=/opt/10 ./build.sh --no-build --install --auth admin:pw" >&2
    exit 2
fi

if [[ "$from_stage" -eq 1 && "$no_build" -eq 1 ]]; then
    echo "ERROR: --from-stage and --no-build are mutually exclusive." >&2
    echo "       --from-stage creates a fresh tarball from stage/." >&2
    echo "       --no-build reuses an identity-matched tarball already in dist/." >&2
    exit 2
fi

# A watcher-built stage can contain developing resources and is not a clean
# production build. Preserve the historical --fast behavior by making stage
# reuse imply the developer profile unless the caller already selected it.
if [[ "$from_stage" -eq 1 ]]; then
    developer_profile=1
fi

# Minification changes webpack output, so it cannot be applied to a stage/
# directory or tarball that was already built.
if [[ "$minify" -eq 1 && "$from_stage" -eq 1 ]]; then
    echo "ERROR: --minify and --from-stage are mutually exclusive." >&2
    echo "       --minify requires a clean webpack build; --from-stage reuses existing output." >&2
    exit 2
fi
if [[ "$minify" -eq 1 && "$no_build" -eq 1 ]]; then
    echo "ERROR: --minify and --no-build are mutually exclusive." >&2
    echo "       --minify requires a clean webpack build; --no-build reuses an existing tarball." >&2
    exit 2
fi

# Validate install-mode prerequisites BEFORE the (potentially slow) build
# step so users get the error in milliseconds, not minutes.
if [[ "$do_install" -eq 1 ]]; then
    if [[ -z "$auth_value" ]]; then
        echo "ERROR: --install requires --auth user:pass" >&2
        echo "       Example: ./build.sh --install --auth admin:********" >&2
        echo "       (or set SPLUNK_AUTH=admin:******** in the environment)" >&2
        exit 2
    fi
    if [[ "$auth_value" != *:* ]]; then
        echo "ERROR: auth value must be in 'user:pass' format (no colon found)" >&2
        exit 2
    fi
fi

# --deploy needs a writable etc/apps in SPLUNK_HOME. Catch that up front
# too -- a multi-minute build only to discover the target dir doesn't
# exist would be needlessly painful.
if [[ "$do_deploy" -eq 1 ]]; then
    if [[ ! -d "${SPLUNK_HOME}/etc/apps" ]]; then
        echo "ERROR: --deploy needs \$SPLUNK_HOME/etc/apps to exist." >&2
        echo "       SPLUNK_HOME is currently '${SPLUNK_HOME}'." >&2
        echo "       Examples:" >&2
        echo "         SPLUNK_HOME=/opt/splunk ./build.sh --deploy" >&2
        echo "         SPLUNK_HOME=/opt/10     ./build.sh --deploy" >&2
        exit 1
    fi
    # Restart needs the CLI even in --deploy mode.
    if [[ "$restart_after_install" -eq 1 && -z "$auth_value" ]]; then
        echo "ERROR: --deploy --restart requires --auth user:pass (Splunk CLI restart)." >&2
        exit 2
    fi
fi

build_version=""
release_build=""
source_package_id=""
source_app_version=""
source_app_conf="${APP_DIR}/src/main/resources/splunk/default/app.conf"
if [[ ! -f "$VERSION_FILE" ]]; then
    err "ERROR: VERSION file not found: ${VERSION_FILE}"
    exit 1
fi
if [[ ! -f "$source_app_conf" ]]; then
    err "ERROR: source app.conf not found: ${source_app_conf}"
    exit 1
fi
build_version="$(tr -d '[:space:]' < "$VERSION_FILE")"
if [[ -z "$build_version" ]]; then
    err "ERROR: VERSION file is empty: ${VERSION_FILE}"
    exit 1
fi
source_package_id="$(awk '
    /^\[/ { in_id = ($0 == "[id]") }
    in_id && /^[[:space:]]*name[[:space:]]*=/ {
        sub(/^[^=]*=/, "")
        gsub(/^[[:space:]]+|[[:space:]]+$/, "")
        print
        exit
    }
' "$source_app_conf")"
source_app_version="$(awk '
    /^\[/ { in_id = ($0 == "[id]") }
    in_id && /^[[:space:]]*version[[:space:]]*=/ {
        sub(/^[^=]*=/, "")
        gsub(/^[[:space:]]+|[[:space:]]+$/, "")
        print
        exit
    }
' "$source_app_conf")"
release_build="$(awk '
    /^\[/ { in_install = ($0 == "[install]") }
    in_install && /^[[:space:]]*build[[:space:]]*=/ {
        sub(/^[^=]*=/, "")
        gsub(/^[[:space:]]+|[[:space:]]+$/, "")
        print
        exit
    }
' "$source_app_conf")"
if [[ -z "$source_package_id" || "$source_package_id" != "$APP_NAME" ]]; then
    err "ERROR: source app.conf [id] name must match package ID ${APP_NAME}."
    exit 1
fi
if [[ "$source_app_version" != "$build_version" ]]; then
    err "ERROR: source app.conf [id] version must match VERSION (${build_version})."
    exit 1
fi
if [[ ! "$release_build" =~ ^[1-9][0-9]*$ ]]; then
    err "ERROR: source app.conf must contain a positive numeric [install] build value."
    exit 1
fi

if [[ "$no_build" -eq 0 ]]; then

    # This policy linter is intentionally opt-in. Its broad rules are useful
    # during a focused catalogue audit, but are not accurate enough to block
    # every package build: valid SPL can depend on explicit row ordering or
    # carefully scoped dedup/fillnull semantics. Keep the implementation
    # available for deliberate review without making it a release gate.
    if [[ "$lint_spl_antipatterns" -eq 1 ]]; then
        hdr "Validating canonical Searchbase SPL (experimental policy gate)..."
        run_quietly python3 "${ROOT_DIR}/scripts/lint_spl_antipatterns.py"
    else
        say "[build] Experimental Searchbase SPL anti-pattern gate disabled."
    fi
fi

if [[ "$no_build" -eq 1 ]]; then
    hdr "Reusing existing tarball (--no-build)..."
elif [[ "$from_stage" -eq 1 ]]; then
    package_args=(--from-stage)
    if [[ "$developer_profile" -eq 1 ]]; then
        package_args+=(--developer)
        hdr "Packaging current stage/ v${build_version} (--from-stage, developer profile)..."
    else
        hdr "Packaging current stage/ v${build_version} (--from-stage, Splunkbase profile)..."
    fi
    run_quietly bash "${APP_DIR}/bin/package_app.sh" "${package_args[@]}"
else
    package_args=()
    if [[ "$developer_profile" -eq 1 ]]; then
        package_args+=(--developer)
    fi
    if [[ "$minify" -eq 1 ]]; then
        package_args+=(--minify)
        if [[ "$developer_profile" -eq 1 ]]; then
            hdr "Packaging ${APP_NAME} v${build_version} (minified developer profile; may take 10+ minutes)..."
        else
            hdr "Packaging ${APP_NAME} v${build_version} (minified Splunkbase profile; may take 10+ minutes)..."
        fi
    else
        if [[ "$developer_profile" -eq 1 ]]; then
            hdr "Packaging ${APP_NAME} v${build_version} (developer profile)..."
        else
            hdr "Packaging ${APP_NAME} v${build_version} (minified Splunkbase profile; required for release)..."
        fi
    fi
    # macOS ships Bash 3.2, where expanding an empty array under `set -u`
    # raises "unbound variable" instead of passing zero arguments.
    if [[ "$developer_profile" -eq 1 || "$minify" -eq 1 ]]; then
        run_quietly bash "${APP_DIR}/bin/package_app.sh" "${package_args[@]}"
    else
        run_quietly bash "${APP_DIR}/bin/package_app.sh"
    fi
fi

if [[ "$developer_profile" -eq 1 ]]; then
    package_profile="developer"
else
    package_profile="splunkbase"
fi
if ! package_path="$(find_release_archive "$source_package_id" "$build_version" "$release_build" "$package_profile")"; then
    exit 1
fi

if [[ -z "$package_path" ]]; then
    if [[ "$no_build" -eq 1 ]]; then
        err "ERROR: --no-build requested but no immutable archive matches the current source package identity."
        err "       Run ./build.sh once (without --no-build) after committing the current release identity."
    else
        err "ERROR: Could not find the immutable ${APP_NAME} archive produced by packaging."
    fi
    exit 1
fi

if ! verify_release_archive "$package_path"; then
    exit 1
fi

# Read the [install] build value stamped into the packaged app.conf so
# we can show it at the end of the run for visibility (and so --no-build
# clearly shows which build is being pushed). The final summary banner
# re-reads this independently, so we only echo it here in --verbose.
package_build="$(
    tar -xzOf "$package_path" "${APP_NAME}/default/app.conf" 2>/dev/null \
        | grep -E '^[[:space:]]*build[[:space:]]*=' \
        | head -1 \
        | sed -E 's/.*=[[:space:]]*//' \
        | tr -d '[:space:]'
)"

if [[ "$no_build" -eq 1 ]]; then
    say "[build] Reusing: ${package_path} ([install] build = ${package_build:-unknown})"
else
    say "[build] Package ready: ${package_path}"
fi

# Build-only path: nothing more to do before the summary. Don't pre-print
# a "do --install next" tip -- it just clutters quiet mode and the summary
# already shows the mode. Fall through.

# --install path: hand the tarball to splunkd via the CLI.
if [[ "$do_install" -eq 1 ]]; then
    if [[ ! -x "$SPLUNK_BIN" ]]; then
        err "ERROR: Splunk CLI not found or not executable: ${SPLUNK_BIN}"
        err "       Either SPLUNK_HOME is wrong (currently: ${SPLUNK_HOME}) or"
        err "       Splunk isn't installed there. The tarball at"
        err "       ${package_path} is unaffected; install it manually if needed."
        err ""
        err "       Examples:"
        err "         SPLUNK_HOME=/opt/splunk ./build.sh --install --auth user:pass"
        err "         SPLUNK_HOME=/opt/10     ./build.sh --install --auth user:pass"
        exit 1
    fi

    hdr "Installing into ${SPLUNK_HOME} ..."
    run_quietly "$SPLUNK_BIN" install app "$package_path" -update 1 -auth "$auth_value"
fi

if [[ "$remote_install" -eq 1 ]]; then
    remote_install_archive "$package_path"
fi

# --deploy path: stage a complete replacement alongside the live app, then
# promote it with same-filesystem renames. This avoids the old delete-then-copy
# window, where a failed or slow copy left Splunk with no app at all. We
# preserve $TARGET/local/ across the swap because that's where operator-edited
# stanzas live. We also preserve live lookups/*.csv files: saved searches and
# editors update those at runtime, while the package intentionally carries
# *.csv.default seed files. Dropping the live files during a dev deploy makes
# otherwise-valid lookup-backed searches fail until their generators run.
if [[ "$do_deploy" -eq 1 ]]; then
    APPS_DIR="${SPLUNK_HOME}/etc/apps"
    TARGET="${APPS_DIR}/${APP_NAME}"
    STATE_BACKUP="$(mktemp -d)"
    UNPACK_DIR="$(mktemp -d)"
    CANDIDATE_DIR=""
    PREVIOUS_TARGET=""
    target_moved_to_previous=0
    candidate_promoted=0

    deploy_cleanup() {
        local status=$?
        trap - EXIT

        # A failed promotion must leave the previous app in place. Both
        # renames occur inside APPS_DIR, so each individual move is atomic on
        # normal POSIX/macOS filesystems. POSIX cannot atomically replace a
        # non-empty directory in one rename, hence the guarded rollback.
        if [[ "$target_moved_to_previous" -eq 1 && "$candidate_promoted" -eq 0 ]] \
            && [[ -n "$PREVIOUS_TARGET" ]] \
            && { [[ -e "$PREVIOUS_TARGET" ]] || [[ -L "$PREVIOUS_TARGET" ]]; } \
            && [[ ! -e "$TARGET" && ! -L "$TARGET" ]]; then
            err "WARNING: candidate promotion failed; restoring the previous app at ${TARGET} ..."
            if ! mv "$PREVIOUS_TARGET" "$TARGET"; then
                err "ERROR: automatic rollback failed; previous app remains at ${PREVIOUS_TARGET}"
            fi
        fi

        if [[ -n "$CANDIDATE_DIR" ]] && { [[ -d "$CANDIDATE_DIR" ]] || [[ -L "$CANDIDATE_DIR" ]]; }; then
            rm -rf "$CANDIDATE_DIR"
        fi
        if [[ -d "$UNPACK_DIR" ]]; then
            rm -rf "$UNPACK_DIR"
        fi
        if [[ -d "$STATE_BACKUP" ]]; then
            rm -rf "$STATE_BACKUP"
        fi
        exit "$status"
    }
    trap 'deploy_cleanup' EXIT

    preserved_lookup_count=0
    hdr "Deploying to ${TARGET} ..."
    if [[ -d "${TARGET}/local" ]]; then
        say "[build] Preserving ${TARGET}/local during swap..."
        cp -R "${TARGET}/local" "${STATE_BACKUP}/local"
    fi
    if [[ -d "${TARGET}/lookups" ]]; then
        mkdir -p "${STATE_BACKUP}/lookups"
        while IFS= read -r -d '' lookup_path; do
            cp -p "$lookup_path" "${STATE_BACKUP}/lookups/"
            preserved_lookup_count=$((preserved_lookup_count + 1))
        done < <(find "${TARGET}/lookups" -maxdepth 1 -type f -name '*.csv' -print0)
        if [[ "$preserved_lookup_count" -gt 0 ]]; then
            say "[build] Preserving ${preserved_lookup_count} live lookup CSV(s) during swap..."
        fi
    fi

    say "[build] Extracting ${package_path} -> ${UNPACK_DIR} ..."
    run_quietly tar xzf "$package_path" -C "$UNPACK_DIR"
    if [[ ! -d "${UNPACK_DIR}/${APP_NAME}" ]]; then
        err "ERROR: tarball did not contain expected top-level dir '${APP_NAME}'."
        exit 1
    fi

    # Keep the candidate under etc/apps so its promotion is a same-filesystem
    # rename. The dot prefix keeps the temporary sibling distinct from the
    # live app name while its contents are assembled and validated.
    CANDIDATE_DIR="$(mktemp -d "${APPS_DIR}/.${APP_NAME}.deploy.XXXXXX")"
    say "[build] Preparing replacement alongside ${TARGET} ..."
    cp -R "${UNPACK_DIR}/${APP_NAME}/." "$CANDIDATE_DIR/"

    # Restore mutable state into the candidate before changing the live path.
    # A copy failure here leaves TARGET untouched.
    if [[ -d "${STATE_BACKUP}/local" ]]; then
        if [[ -e "${CANDIDATE_DIR}/local" || -L "${CANDIDATE_DIR}/local" ]]; then
            err "ERROR: replacement archive unexpectedly contains local/; refusing to merge mutable state."
            exit 1
        fi
        say "[build] Restoring local/ into replacement ..."
        cp -R "${STATE_BACKUP}/local" "${CANDIDATE_DIR}/local"
    fi
    if [[ "$preserved_lookup_count" -gt 0 ]]; then
        say "[build] Restoring ${preserved_lookup_count} live lookup CSV(s) into replacement ..."
        mkdir -p "${CANDIDATE_DIR}/lookups"
        while IFS= read -r -d '' lookup_path; do
            cp -p "$lookup_path" "${CANDIDATE_DIR}/lookups/"
        done < <(find "${STATE_BACKUP}/lookups" -maxdepth 1 -type f -name '*.csv' -print0)
    fi

    # Reserve a unique sibling path for the current app. `mv` needs a path
    # that does not exist, so release the empty mktemp directory immediately.
    PREVIOUS_TARGET="$(mktemp -d "${APPS_DIR}/.${APP_NAME}.previous.XXXXXX")"
    rmdir "$PREVIOUS_TARGET"
    if [[ -e "$TARGET" || -L "$TARGET" ]]; then
        say "[build] Promoting replacement for ${TARGET} ..."
        if ! mv "$TARGET" "$PREVIOUS_TARGET"; then
            err "ERROR: could not move the existing app aside; live app was left unchanged."
            exit 1
        fi
        target_moved_to_previous=1
    fi
    if ! mv "$CANDIDATE_DIR" "$TARGET"; then
        err "ERROR: could not promote the prepared replacement."
        exit 1
    fi
    candidate_promoted=1
    CANDIDATE_DIR=""

    # The replacement is live and has all mutable state. Remove the prior
    # directory only now; if cleanup fails it remains as a recoverable sibling.
    if [[ "$target_moved_to_previous" -eq 1 ]] && { [[ -e "$PREVIOUS_TARGET" ]] || [[ -L "$PREVIOUS_TARGET" ]]; }; then
        if rm -rf "$PREVIOUS_TARGET"; then
            PREVIOUS_TARGET=""
        else
            err "WARNING: deployed successfully, but the prior app remains at ${PREVIOUS_TARGET}"
        fi
    fi
fi

if [[ "$do_install" -eq 1 || "$do_deploy" -eq 1 ]]; then
    clear_appserver_i18n_cache
fi

if [[ "$restart_after_install" -eq 1 ]]; then
    if [[ ! -x "$SPLUNK_BIN" ]]; then
        err "ERROR: Splunk CLI not found, cannot --restart: ${SPLUNK_BIN}"
        exit 1
    fi
    hdr "Restarting Splunk..."
    run_quietly "$SPLUNK_BIN" restart -auth "$auth_value"
fi

# ---------------------------------------------------------------------
# Final summary banner. Every code path through this script ends here
# (build-only, --install, --deploy, --no-build + either), so the
# operator always sees the app name, the version (from [id]), and the
# stamped [install] build at a glance. The 3 sibling repos
# (ta_cisco_common, field-solutions-demo-data-gen) print the same shape.
# ---------------------------------------------------------------------
pkg_app_conf="$(tar -xzOf "$package_path" "${APP_NAME}/default/app.conf" 2>/dev/null || true)"
PKG_VERSION="$(printf '%s\n' "$pkg_app_conf" | awk -F= '
    /^\[/ { in_id = ($0 == "[id]") ? 1 : 0; next }
    in_id && /^[[:space:]]*version[[:space:]]*=/ {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2; exit
    }
')"
PKG_BUILD="$(printf '%s\n' "$pkg_app_conf" | awk -F= '
    /^\[/ { in_install = ($0 == "[install]") ? 1 : 0; next }
    in_install && /^[[:space:]]*build[[:space:]]*=/ {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2; exit
    }
')"

if [[ "$remote_install" -eq 1 ]]; then
    if [[ "${remote_target%%@*}" == "$remote_splunk_user" ]]; then
        mode_label="installed remotely as ${remote_splunk_user} -> ${remote_target}:${remote_splunk_home%/}/etc/apps/${APP_NAME}"
    else
        mode_label="installed remotely via sudo -iu ${remote_splunk_user} -> ${remote_target}:${remote_splunk_home%/}/etc/apps/${APP_NAME}"
    fi
elif [[ "$do_install" -eq 1 ]]; then
    mode_label="installed via splunkd -> ${SPLUNK_HOME}/etc/apps/${APP_NAME}"
elif [[ "$do_deploy" -eq 1 ]]; then
    mode_label="deployed (filesystem swap) -> ${SPLUNK_HOME}/etc/apps/${APP_NAME}"
else
    mode_label="build only (no install / no deploy)"
fi
if [[ "$no_build" -eq 1 ]]; then
    mode_label="--no-build (reused dist/) + ${mode_label}"
fi
if [[ "$from_stage" -eq 1 ]]; then
    mode_label="--from-stage (packaged existing stage/) + ${mode_label}"
fi
if [[ "$minify" -eq 1 ]]; then
    mode_label="minified build + ${mode_label}"
fi
if [[ "$developer_profile" -eq 1 ]]; then
    app_profile_label="developer (released + developing resources)"
else
    app_profile_label="Splunkbase (released resources only)"
fi

echo ""
echo "================================================================"
COMPLETED_AT="$(date '+%Y-%m-%d %I:%M:%S %p %Z (%z)')"
echo "  Done: ${APP_NAME} v${PKG_VERSION:-unknown} (build ${PKG_BUILD:-unknown}) at ${COMPLETED_AT}"
echo "================================================================"
echo "  Mode:    ${mode_label}"
echo "  Profile: ${app_profile_label}"
echo "  Tarball: ${package_path}"
