"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const workspacesPath = path.join(
  packageRoot,
  "src/main/webapp/common/config/insightsWorkspaces.ts",
);
const workspacesSource = fs.readFileSync(workspacesPath, "utf8");
const workspacesOutput = ts.transpileModule(workspacesSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: workspacesPath,
}).outputText;
const workspacesModule = { exports: {} };
const loadWorkspaces = new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  workspacesOutput,
);
loadWorkspaces(
  workspacesModule.exports,
  workspacesModule,
  require,
  workspacesPath,
  path.dirname(workspacesPath),
);

const {
  DEFAULT_WORKSPACE_ID,
  PACKAGED_WORKSPACE_FALLBACKS,
  getWorkspaceFromLocation,
} = workspacesModule.exports;

const expectedWorkspaceIds = [
  "secure_networking",
  "zero_trust_access_demo",
  "network_resilience_demo",
  "security_operations_demo",
  "executive",
];

assert.equal(DEFAULT_WORKSPACE_ID, "secure_networking");
assert.deepEqual(
  PACKAGED_WORKSPACE_FALLBACKS.map(({ id }) => id),
  expectedWorkspaceIds,
);
assert.equal(PACKAGED_WORKSPACE_FALLBACKS[0].label, "Secure Networking");
assert.equal(
  PACKAGED_WORKSPACE_FALLBACKS.find(({ id }) => id === "executive").label,
  "Executive Briefing",
);
assert.equal(
  PACKAGED_WORKSPACE_FALLBACKS.find(
    ({ id }) => id === "zero_trust_access_demo",
  ).sourceWorkspace,
  "secure_networking",
);

const originalWindow = global.window;
try {
  global.window = {
    location: {
      pathname: "/en-US/app/splunk-cisco-dashboards/insights_workspace",
      search: "?workspace=network_resilience_demo",
    },
  };
  assert.equal(
    getWorkspaceFromLocation(PACKAGED_WORKSPACE_FALLBACKS).id,
    "network_resilience_demo",
  );

  global.window.location.pathname =
    "/en-US/app/splunk-cisco-dashboards/executive_briefing_profile";
  global.window.location.search = "";
  assert.equal(
    getWorkspaceFromLocation(PACKAGED_WORKSPACE_FALLBACKS).id,
    "executive",
  );

  global.window.location.pathname =
    "/en-US/app/splunk-cisco-dashboards/secure_networking_profile";
  assert.equal(
    getWorkspaceFromLocation(PACKAGED_WORKSPACE_FALLBACKS).id,
    "secure_networking",
  );
} finally {
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
}

const confPath = path.join(
  packageRoot,
  "src/main/resources/splunk/default/insights_workspaces.conf",
);
const conf = fs.readFileSync(confPath, "utf8");
const stanzaNames = [...conf.matchAll(/^\[([^\]]+)\]$/gm)].map((match) => match[1]);
const workspaceStanzas = stanzaNames
  .filter((name) => name.startsWith("workspace."))
  .map((name) => name.slice("workspace.".length));
assert.deepEqual(workspaceStanzas, expectedWorkspaceIds);
for (const workspaceId of expectedWorkspaceIds) {
  assert.ok(
    stanzaNames.some((name) => name.startsWith(`layout.${workspaceId}.`)),
    `expected at least one layout stanza for ${workspaceId}`,
  );
}
assert.match(conf, /^source_workspace = /m);
assert.match(conf, /^default_visible_sections = /m);
assert.doesNotMatch(conf, /^profile\s*=/m);

const searchbaseConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/searchbase.conf"),
  "utf8",
);
assert.match(searchbaseConf, /"workspace":"secure_networking"/);
assert.doesNotMatch(searchbaseConf, /"profile":"secure_networking"/);

const appConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/app.conf"),
  "utf8",
);
const serverConf = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/server.conf"),
  "utf8",
);
const defaultMeta = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/metadata/default.meta"),
  "utf8",
);
assert.match(appConf, /^reload\.insights_workspaces = simple$/m);
assert.match(
  serverConf,
  /^conf_replication_include\.insights_workspaces = true$/m,
);
assert.match(defaultMeta, /^\[insights_workspaces\]$/m);
assert.doesNotMatch(`${appConf}\n${serverConf}\n${defaultMeta}`, /overview_factory_tiles/);

console.log("✓ Insights workspace tests passed");
