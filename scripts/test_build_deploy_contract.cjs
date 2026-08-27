#!/usr/bin/env node
/* eslint-disable no-console */

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const buildPath = path.resolve(__dirname, "..", "build.sh");
const source = fs.readFileSync(buildPath, "utf8");
const start = source.indexOf("# --deploy path: stage a complete replacement");
const end = source.indexOf(
  '\nif [[ "$do_install" -eq 1 || "$do_deploy" -eq 1 ]];',
  start,
);

assert.notStrictEqual(start, -1, "deploy implementation marker is missing");
assert.notStrictEqual(end, -1, "deploy implementation boundary is missing");

const deployBlock = source.slice(start, end);
const position = (needle) => {
  const index = deployBlock.indexOf(needle);
  assert.notStrictEqual(index, -1, `missing deploy safeguard: ${needle}`);
  return index;
};

assert.doesNotMatch(
  deployBlock,
  /rm -rf "\$TARGET"/,
  "deploy must never delete the live app before the replacement is ready",
);

const candidateCreated = position(
  'CANDIDATE_DIR="$(mktemp -d "${APPS_DIR}/.${APP_NAME}.deploy.XXXXXX")"',
);
const candidateCopied = position('cp -R "${UNPACK_DIR}/${APP_NAME}/." "$CANDIDATE_DIR/"');
const localRestored = position('cp -R "${STATE_BACKUP}/local" "${CANDIDATE_DIR}/local"');
const lookupsRestored = position('cp -p "$lookup_path" "${CANDIDATE_DIR}/lookups/"');
const liveMovedAside = position('mv "$TARGET" "$PREVIOUS_TARGET"');
const candidatePromoted = position('mv "$CANDIDATE_DIR" "$TARGET"');

assert(
  candidateCreated < candidateCopied &&
    candidateCopied < localRestored &&
    candidateCopied < lookupsRestored &&
    localRestored < liveMovedAside &&
    lookupsRestored < liveMovedAside &&
    liveMovedAside < candidatePromoted,
  "candidate assembly and mutable-state restoration must finish before promotion",
);

assert.match(
  deployBlock,
  /PREVIOUS_TARGET="\$\(mktemp -d "\$\{APPS_DIR\}\/.\$\{APP_NAME\}\.previous\.XXXXXX"\)"[\s\S]*?rmdir "\$PREVIOUS_TARGET"/,
  "the old app must move to a unique, nonexistent sibling path",
);
assert.match(
  deployBlock,
  /candidate promotion failed; restoring the previous app[\s\S]*?mv "\$PREVIOUS_TARGET" "\$TARGET"/,
  "failed promotion must roll the old app back into place",
);

const archiveIdentityStart = source.indexOf("archive_identity() {");
const releaseArchiveFinderStart = source.indexOf("find_release_archive() {");
const releaseArchiveFinderEnd = source.indexOf("sha256_file() {");

assert.notStrictEqual(archiveIdentityStart, -1, "archive identity reader is missing");
assert.notStrictEqual(releaseArchiveFinderStart, -1, "release archive finder is missing");
assert.notStrictEqual(releaseArchiveFinderEnd, -1, "release archive finder boundary is missing");

const archiveIdentityBlock = source.slice(archiveIdentityStart, releaseArchiveFinderStart);
const releaseArchiveFinderBlock = source.slice(
  releaseArchiveFinderStart,
  releaseArchiveFinderEnd,
);

assert.ok(
  archiveIdentityBlock.includes(
    'section == "[id]" && /^[[:space:]]*name[[:space:]]*=',
  ),
  "archive identity must include the packaged [id] name",
);
assert.match(
  archiveIdentityBlock,
  /print package_id "\\t" version "\\t" build/,
  "archive identity must return package ID, version, and build together",
);
assert.match(
  releaseArchiveFinderBlock,
  /local expected_package_id="\$1"[\s\S]*?local expected_version="\$2"[\s\S]*?local expected_profile="\$3"/,
  "release archive lookup must accept package ID, VERSION, and profile",
);
assert.match(
  releaseArchiveFinderBlock,
  /archive_package_id" == "\$expected_package_id"[\s\S]*?archive_version" == "\$expected_version"[\s\S]*?archive_build" =~ \^\[1-9\]/,
  "release archive lookup must require the package, VERSION, and a positive packaged build",
);
assert.match(
  releaseArchiveFinderBlock,
  /archive_build > highest_build[\s\S]*?highest_build="\$archive_build"/,
  "release archive lookup must select the highest packaged build",
);
assert.doesNotMatch(
  source,
  /-exec ls -t \{\} \+/,
  "--no-build must not select an artifact merely because it is newest",
);
assert.match(
  source,
  /build_version="\$\(tr[\s\S]*?source_package_id="\$\(awk '/,
  "VERSION and source package ID must be read before artifact selection",
);
assert.doesNotMatch(
  source,
  /source_app_version=|release_build=/,
  "source app.conf version/build must not drive release artifact selection",
);
assert.match(
  source,
  /find_release_archive "\$source_package_id" "\$build_version" "\$package_profile"/,
  "fresh-build and --no-build paths must resolve the highest matching immutable artifact",
);

console.log("Build deploy and VERSION-only artifact-selection contracts passed.");
