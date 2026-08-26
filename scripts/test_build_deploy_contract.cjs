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

console.log("Build deploy sibling-promotion contract passed.");
