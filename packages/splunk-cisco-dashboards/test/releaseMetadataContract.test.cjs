"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const packageRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const appConfPath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/app.conf",
);
const webpackConfigPath = path.join(packageRoot, "webpack.config.js");
const packageScriptPath = path.join(packageRoot, "bin/package_app.sh");
const stampScriptPath = path.join(packageRoot, "bin/stamp_version.sh");
const releaseIdentityValidatorPath = path.join(
  packageRoot,
  "bin/validate_release_identity.js",
);
const releaseLedgerPath = path.join(repositoryRoot, "releases/splunkbase-9257.json");

const version = fs.readFileSync(path.join(repositoryRoot, "VERSION"), "utf8").trim();
const appConf = fs.readFileSync(appConfPath, "utf8");
const webpackConfig = fs.readFileSync(webpackConfigPath, "utf8");
const packageScript = fs.readFileSync(packageScriptPath, "utf8");
const stampScript = fs.readFileSync(stampScriptPath, "utf8");
const releaseLedger = JSON.parse(fs.readFileSync(releaseLedgerPath, "utf8"));

const stanza = (name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = `${appConf}\n[__test_end__]\n`.match(
    new RegExp(`^\\[${escapedName}\\]\\n([\\s\\S]*?)(?=^\\[)`, "m"),
  );
  assert.ok(match, `app.conf must contain [${name}]`);
  return match[1];
};

const setting = (body, key) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*(.*?)\\s*$`, "m"));
  assert.ok(match, `setting ${key} must be configured`);
  return match[1];
};

assert.notEqual(version, "", "repo-root VERSION must not be empty");
assert.equal(
  setting(stanza("id"), "version"),
  version,
  "the source app.conf copied into stage/ must match the canonical release version",
);
assert.equal(
  setting(stanza("launcher"), "version"),
  version,
  "the launcher version must match the app identity version",
);
assert.equal(
  setting(stanza("id"), "name"),
  releaseLedger.app.package_id,
  "the source app id must remain tied to the Splunkbase release identity ledger",
);
assert.match(
  setting(stanza("install"), "build"),
  /^[1-9][0-9]*$/,
  "the source build must be a positive decimal integer",
);
assert.equal(
  setting(stanza("package"), "check_for_updates"),
  "true",
  "Splunkbase update discovery must remain enabled",
);
assert.equal(
  setting(stanza("package"), "show_upgrade_notification"),
  "true",
  "upgrade notifications must be explicitly enabled for update-aware releases",
);

assert.match(
  webpackConfig,
  /from:\s*splunkRoot,[\s\S]*?to:\s*stageRoot,/,
  "webpack must copy the version-aligned source app.conf into stage/",
);
assert.match(
  stampScript,
  /VERSION_FILE="\$\{ROOT_DIR\}\/VERSION"[\s\S]*?\(in_id \|\| in_launcher\)[\s\S]*?version/,
  "the package stamp must continue to read VERSION and stamp both app version fields",
);
assert.match(
  packageScript,
  /bash "\$\{SCRIPT_DIR\}\/stamp_version\.sh" "\$STAGE_DIR"/,
  "canonical packaging must stamp the staged copy before archive creation",
);
assert.match(
  packageScript,
  /node "\$\{PKG_ROOT\}\/bin\/validate_release_identity\.js"/,
  "canonical packaging must enforce the committed release identity ledger",
);
assert.match(
  packageScript,
  /Splunkbase packaging requires a clean Git worktree[\s\S]*?release-provenance\.json/,
  "canonical Splunkbase packaging must bind the archive to a clean committed source state",
);
assert.match(
  execFileSync(process.execPath, [releaseIdentityValidatorPath], {
    cwd: packageRoot,
    encoding: "utf8",
  }),
  /Release identity validated:/,
  "the current source metadata and release ledger must validate together",
);

console.log("Release metadata follows VERSION, validates build identity, and enables update discovery/notifications.");
