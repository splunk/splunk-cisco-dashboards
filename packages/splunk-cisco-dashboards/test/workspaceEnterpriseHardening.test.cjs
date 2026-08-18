"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const loadTypescriptModule = (relativePath) => {
  const sourcePath = path.join(packageRoot, relativePath);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: sourcePath,
  }).outputText;
  const module = { exports: {} };
  new Function(
    "exports",
    "module",
    "require",
    "__filename",
    "__dirname",
    output,
  )(
    module.exports,
    module,
    require,
    sourcePath,
    path.dirname(sourcePath),
  );
  return module.exports;
};

const permissions = loadTypescriptModule(
  "src/main/webapp/common/auth/insightsWorkspacePermissions.ts",
);
const resolve = permissions.resolveInsightsWorkspacePermissions;

assert.deepEqual(
  resolve({ roles: ["user"], capabilities: ["search"] }),
  {
    username: null,
    roles: ["user"],
    capabilities: ["search"],
    canManageWorkspaces: false,
    canManageSharedTopology: false,
    canManageFactoryTileConfig: false,
  },
  "The regular user role must fail closed for every shared authoring surface",
);

const power = resolve({ roles: ["user", "power"], capabilities: ["search"] });
assert.equal(power.canManageWorkspaces, true);
assert.equal(power.canManageSharedTopology, true);
assert.equal(power.canManageFactoryTileConfig, false);

const admin = resolve({
  username: "admin-user",
  roles: ["admin"],
  capabilities: ["search"],
});
assert.equal(admin.username, "admin-user");
assert.equal(admin.canManageWorkspaces, true);
assert.equal(admin.canManageSharedTopology, true);
assert.equal(admin.canManageFactoryTileConfig, true);

const delegatedAdmin = resolve({
  roles: ["workspace_curator"],
  capabilities: ["admin_all_objects"],
});
assert.equal(delegatedAdmin.canManageWorkspaces, true);
assert.equal(delegatedAdmin.canManageFactoryTileConfig, true);

const workspaceConfig = loadTypescriptModule(
  "src/main/webapp/common/config/insightsWorkspaces.ts",
);
const values = new Map();
const localStorage = {
  getItem: (key) => (values.has(key) ? values.get(key) : null),
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const originalWindow = global.window;
try {
  global.window = {
    $C: { USERNAME: "alice@example.com" },
    localStorage,
  };
  const legacyKey = workspaceConfig.legacyWorkspaceStorageKey(
    "splunk-cisco-dashboards.sectionTileOrder.v1",
    "secure_networking",
  );
  values.set(legacyKey, '{"v":1,"order":{}}');
  const aliceKey = workspaceConfig.workspaceStorageKey(
    "splunk-cisco-dashboards.sectionTileOrder.v1",
    "secure_networking",
  );
  assert.match(aliceKey, /\.user\.alice%40example\.com$/);
  assert.equal(
    workspaceConfig.readUserScopedStorageItem(aliceKey),
    '{"v":1,"order":{}}',
  );
  assert.equal(values.has(legacyKey), false, "Legacy state must be consumed once");
  assert.equal(values.has(aliceKey), true, "Migrated state must belong to Alice");

  global.window.$C.USERNAME = "bob@example.com";
  const bobKey = workspaceConfig.workspaceStorageKey(
    "splunk-cisco-dashboards.sectionTileOrder.v1",
    "secure_networking",
  );
  assert.notEqual(bobKey, aliceKey);
  assert.equal(
    workspaceConfig.readUserScopedStorageItem(bobKey),
    null,
    "Bob must not inherit Alice's browser customizations",
  );
} finally {
  if (originalWindow === undefined) delete global.window;
  else global.window = originalWindow;
}

const profile = read("src/main/webapp/pages/executive_insights/index.tsx");
const topology = read(
  "src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx",
);
const picker = read(
  "src/main/webapp/common/components/workspace/KpiPickerPanel.tsx",
);
const workspaceService = read(
  "src/main/webapp/common/services/insightsWorkspaceService.ts",
);
const tileConfigService = read(
  "src/main/webapp/common/services/searchbaseTileConfigService.ts",
);
const defaultMeta = read("src/main/resources/splunk/metadata/default.meta");

assert.match(profile, /useInsightsWorkspacePermissions\(\)/);
assert.match(profile, /canManageTopology=\{canManageSharedTopology\}/);
assert.match(
  profile,
  /onEditTitle=\{[\s\S]*?canManageSharedTopology[\s\S]*?: undefined/,
);
assert.match(profile, /workspaceAddedSearchbaseIds/);
assert.match(profile, /label="Remove default"/);
assert.match(
  profile,
  /<Modal\.Header title="Remove workspace default tile\?"/,
);
assert.match(
  profile,
  /aria-label=\{`Remove default: \$\{record\.searchName\} from \$\{sectionTitle\}`\}/,
  "The shared-removal accessible name must contain its visible label",
);
assert.match(profile, /aria-live="polite" role="status"/);
assert.match(profile, /previousAction\?\.isConnected/);
assert.match(
  profile,
  /canManageWorkspace \? \([\s\S]*?<RadioBar[\s\S]*?: \([\s\S]*?<StaticContent>This browser<\/StaticContent>/,
  "Regular users must see a static personal destination rather than a one-option selector",
);
assert.match(topology, /\{canManageTopology && \([\s\S]*?label="Edit topology"/);
assert.match(
  picker,
  /Search replacement is organization-wide and requires an[\s\S]*?administrator/,
);
assert.match(
  picker,
  /Drilldown targets are organization-wide and require[\s\S]*?administrator/,
);
assert.match(workspaceService, /class InsightsWorkspaceConflictError/);
assert.match(workspaceService, /assertLayoutIsCurrent/);
assert.match(tileConfigService, /restores the target if the source update fails/);
assert.match(
  defaultMeta,
  /\[insights_workspaces\][\s\S]*?write : \[ admin, power, sc_admin \]/,
  "Shared workspace writes must be enforced for power and administrator roles",
);
assert.match(
  defaultMeta,
  /\[searchbase\][\s\S]*?write : \[ admin, sc_admin \]/,
  "Factory tile configuration must remain administrator-only on the server",
);

for (const hook of [
  "useBrandingOverride.ts",
  "usePersistedMetricOverrides.ts",
  "usePersistedSearchbaseDrilldowns.ts",
  "usePersistedSectionHeights.ts",
  "usePersistedSectionHiddenTiles.ts",
  "usePersistedSectionLayout.ts",
  "usePersistedSectionPresentation.ts",
  "usePersistedSectionTileAdditions.ts",
  "usePersistedSectionTileCounts.ts",
  "usePersistedSectionTileOrder.ts",
]) {
  assert.match(
    read(`src/main/webapp/common/hooks/${hook}`),
    /readUserScopedStorageItem/,
    `${hook} must read account-scoped browser state`,
  );
}

console.log("Insights Workspace enterprise hardening contract passed.");
