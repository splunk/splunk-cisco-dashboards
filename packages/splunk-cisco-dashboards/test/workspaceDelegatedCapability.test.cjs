"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const authorize = read("src/main/resources/splunk/default/authorize.conf");
const restmap = read("src/main/resources/splunk/default/restmap.conf");
const web = read("src/main/resources/splunk/default/web.conf");
const defaultMeta = read("src/main/resources/splunk/metadata/default.meta");
const permissions = read(
  "src/main/webapp/common/auth/insightsWorkspacePermissions.ts",
);
const workspaceService = read(
  "src/main/webapp/common/services/insightsWorkspaceService.ts",
);
const topologyService = read(
  "src/main/webapp/common/services/customerTopologyPersistenceService.ts",
);
const tileConfigService = read(
  "src/main/webapp/common/services/searchbaseTileConfigService.ts",
);
const handler = read("src/main/resources/splunk/bin/scd_workspace_rest.py");

const capability = "scd_manage_insights_workspaces";
assert.match(authorize, new RegExp(`\\[capability::${capability}\\]`));
for (const role of ["admin", "power", "sc_admin"]) {
  assert.match(
    authorize,
    new RegExp(`\\[role_${role}\\][\\s\\S]*?${capability} = enabled`),
    `${role} must retain shared workspace management`,
  );
}

for (const endpoint of [
  "scd_insights_workspaces",
  "scd_customer_topology",
  "scd_dashboard_backgrounds",
]) {
  assert.match(restmap, new RegExp(`\\[script:${endpoint}\\]`));
  assert.match(
    restmap,
    new RegExp(`\\[script:${endpoint}\\][\\s\\S]*?capability = ${capability}`),
  );
  assert.match(
    restmap,
    new RegExp(`\\[script:${endpoint}\\][\\s\\S]*?passSystemAuth = true`),
  );
  assert.match(web, new RegExp(`pattern = ${endpoint}\\nmethods = POST, GET`));
  assert.match(
    web,
    new RegExp(`pattern = ${endpoint}/\\*\\nmethods = POST, GET, DELETE`),
  );
}

assert.match(
  permissions,
  /INSIGHTS_WORKSPACE_MANAGEMENT_CAPABILITY[\s\S]*?scd_manage_insights_workspaces/,
);
assert.match(
  permissions,
  /canManageSharedConfiguration =[\s\S]*?hasDelegatedWorkspaceCapability/,
);
assert.match(
  permissions,
  /canManageFactoryTileConfig:[\s\S]*?canManageAllObjects \|\| hasFactoryTileManagerRole/,
  "The delegated capability must not grant factory Searchbase changes",
);

assert.match(
  workspaceService,
  /buildReadBaseUrl[\s\S]*?configs\/conf-\$\{INSIGHTS_WORKSPACES_CONF_BASENAME\}/,
);
assert.match(workspaceService, /buildMutationBaseUrl[\s\S]*?scd_insights_workspaces/);
assert.doesNotMatch(
  workspaceService,
  /servicesNS\/\$\{owner\}[\s\S]*?configs\/conf-\$\{INSIGHTS_WORKSPACES_CONF_BASENAME\}/,
);
assert.match(topologyService, /buildBaseUrl[\s\S]*?configs\/conf-\$\{CONF_BASENAME\}/);
assert.match(topologyService, /buildMutationBaseUrl[\s\S]*?scd_customer_topology/);

assert.match(
  defaultMeta,
  /\[searchbase\][\s\S]*?write : \[ admin, sc_admin \]/,
);
assert.match(
  defaultMeta,
  /\[templates\][\s\S]*?write : \[ admin, sc_admin \]/,
  "Raw shared template writes must stay restricted while the delegated handler retains UI access",
);
assert.match(tileConfigService, /configs\/conf-\$\{CONF_BASENAME\}/);
assert.doesNotMatch(tileConfigService, /scd_insights_workspaces|scd_customer_topology/);

for (const prefix of ["workspace", "layout", "signal_item", "signal_rail"]) {
  assert.match(handler, new RegExp(`${prefix}\\\\\\.`));
}
assert.match(handler, /MAX_TOPOLOGY_PAYLOAD_BYTES = 128 \* 1024/);
assert.match(handler, /Field .* is not valid for stanza/);
assert.match(handler, /must contain valid JSON/);
assert.match(handler, /class WorkspaceMutationHandler/);
assert.match(handler, /system_authtoken/);
assert.match(handler, /configs\/conf-\{\}/);

console.log("Delegated workspace capability contract passed.");
