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
const serverConfPath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/server.conf",
);
const customerTopologySpecPath = path.join(
  packageRoot,
  "src/main/resources/splunk/README/customer_topology.conf.spec",
);
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
const serverConf = fs.readFileSync(serverConfPath, "utf8");
const customerTopologySpec = fs.readFileSync(customerTopologySpecPath, "utf8");
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
assert.equal(
  setting(stanza("package"), "id"),
  releaseLedger.app.package_id,
  "the update-discovery package id must remain tied to the Splunkbase release identity ledger",
);
assert.equal(
  Number.isSafeInteger(releaseLedger.app.splunkbase_app_id) &&
    releaseLedger.app.splunkbase_app_id > 0,
  true,
  "the release ledger must retain the positive numeric Splunkbase application id",
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

for (const confName of [
  "searchbase",
  "searchbase_canvases",
  "network_diagrams",
  "customer_topology",
  "insights_workspaces",
  "insights_workspace_preferences",
  "templates",
  "setup",
]) {
  assert.match(
    appConf,
    new RegExp(`^reload\\.${confName} = simple$`, "m"),
    `${confName}.conf must have a simple-reload trigger for runtime REST changes`,
  );
  assert.match(
    serverConf,
    new RegExp(`^conf_replication_include\\.${confName} = true$`, "m"),
    `${confName}.conf must replicate runtime changes across search-head-cluster members`,
  );
}
assert.match(
  customerTopologySpec,
  /app UI writes them[\s\S]*?scd_customer_topology[\s\S]*?configs\/conf-customer_topology is the merged read endpoint/,
  "Topology documentation must describe the capability-protected mutation route actually used by the app",
);
assert.match(
  customerTopologySpec,
  /128 KiB,[\s\S]*?250 sites, 500 links, and 16 aliases per site/,
  "Topology documentation must describe the enforced rendering-cardinality limits",
);

assert.match(
  webpackConfig,
  /from:\s*splunkRoot,[\s\S]*?to:\s*stageRoot,/,
  "webpack must copy the version-aligned source app.conf into stage/",
);
assert.match(
  webpackConfig,
  /ignore:\s*\[[\s\S]*?'\*\*\/\.env'[\s\S]*?'\*\*\/\.env\.\*'/,
  "webpack must keep common local-secret files out of every staged app",
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
  packageScript,
  /assert_no_ignored_release_inputs\(\)[\s\S]*?git -C "\$ROOT_DIR" check-ignore --quiet --no-index[\s\S]*?find "\$SPLUNK_RESOURCES_DIR" \\\( -type f -o -type l \\\) -print0/,
  "Splunkbase packaging must reject ignored files that would otherwise evade Git status",
);
assert.match(
  packageScript,
  /resolve_splunkbase_app_id\(\)[\s\S]*?splunkbase_app_id[\s\S]*?"splunkbase_app_id": %s/,
  "Splunkbase archives must bind their provenance to the numeric listing identity",
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
