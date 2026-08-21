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

const stanza = (source, id) => {
  const marker = `[${id}]\n`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Expected stanza [${id}]`);
  const tail = source.slice(start + marker.length);
  const next = tail.search(/\n\[/);
  return next === -1 ? tail : tail.slice(0, next);
};

const field = (body, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`^${escaped}\\s*=\\s*(.*)$`, "m"));
  return match?.[1]?.trim();
};

const workspaceConfig = loadTypescriptModule(
  "src/main/webapp/common/config/insightsWorkspaces.ts",
);
const signalConfig = loadTypescriptModule(
  "src/main/webapp/common/config/signalTicker.ts",
);
const workspacesConf = read(
  "src/main/resources/splunk/default/insights_workspaces.conf",
);
const searchbase = read("src/main/resources/splunk/default/searchbase.conf");
const macros = read("src/main/resources/splunk/default/macros.conf");
const workspaceManager = read(
  "src/main/webapp/common/components/workspace/WorkspaceManager.tsx",
);

assert.ok(workspaceConfig.WORKSPACE_SOURCE_IDS.includes("agentic_soc"));
for (const sectionId of [
  "dns_security",
  "firewall_security",
  "network_detection",
]) {
  assert.ok(
    workspaceConfig.ALL_WORKSPACE_SECTION_IDS.includes(sectionId),
    `Expected ${sectionId} to be a supported workspace section`,
  );
}

const workspace = workspaceConfig.PACKAGED_WORKSPACE_FALLBACKS.find(
  (candidate) => candidate.id === "agentic_security_operations_center",
);
assert.ok(workspace, "Expected a packaged Agentic SOC workspace fallback");
assert.equal(workspace.label, "Agentic Security Operations Center");
assert.equal(workspace.sourceWorkspace, "agentic_soc");
assert.equal(workspace.mapVisible, false);
assert.deepEqual(
  workspace.sections.map((section) => section.id),
  ["dns_security", "firewall_security", "network_detection"],
);
assert.deepEqual(workspace.defaultVisibleSections, [
  "dns_security",
  "firewall_security",
  "network_detection",
]);

assert.match(workspaceManager, /Agentic Security Operations Center/);
assert.match(workspaceManager, /Umbrella DNS, firewall threat, and Endace\/Zeek/);

const workspaceBody = stanza(
  workspacesConf,
  "workspace.agentic_security_operations_center",
);
assert.equal(field(workspaceBody, "source_workspace"), "agentic_soc");
assert.equal(field(workspaceBody, "map_visible"), "0");
assert.equal(
  field(workspaceBody, "default_visible_sections"),
  "dns_security,firewall_security,network_detection",
);

const expectedTiles = {
  dns_security: [
    "agentic_soc_umbrella_unique_domains",
    "agentic_soc_umbrella_dns_requests",
    "agentic_soc_umbrella_blocked_requests",
    "agentic_soc_umbrella_top_categories",
    "agentic_soc_umbrella_top_applications",
  ],
  firewall_security: [
    "agentic_soc_firewall_intrusion_threats",
    "agentic_soc_firewall_security_intelligence",
    "agentic_soc_firewall_destinations_by_country",
  ],
  network_detection: [
    "agentic_soc_zeek_protocols",
    "agentic_soc_zeek_traffic_volume",
    "agentic_soc_zeek_top_conversations",
  ],
};

for (const [sectionId, tileIds] of Object.entries(expectedTiles)) {
  const layout = stanza(
    workspacesConf,
    `layout.agentic_security_operations_center.${sectionId}`,
  );
  assert.deepEqual(field(layout, "tiles").split(","), tileIds);
  assert.equal(
    field(layout, "visible_count"),
    sectionId === "dns_security" ? "5" : "3",
  );

  for (const tileId of tileIds) {
    const search = stanza(searchbase, tileId);
    const vizOptions = JSON.parse(field(search, "viz_options"));
    assert.equal(vizOptions.overview[0].workspace, "agentic_soc");
    assert.equal(vizOptions.overview[0].section, sectionId);
    assert.equal(vizOptions.overview[0].tileId, tileId);
    assert.match(field(search, "tags"), /Agentic SOC/);
    assert.doesNotMatch(search, /\|\s*makeresults|random\s*\(/i);
  }
}

for (const tileId of expectedTiles.dns_security) {
  assert.match(stanza(searchbase, tileId), /`index_dns_umbrella`/);
}
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_top_applications"),
  /cisco:cloud_security:appdiscovery/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_top_applications"),
  /dns_Events/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_top_categories"),
  /split\(dns_categories,","\)/,
);
for (const tileId of expectedTiles.firewall_security) {
  assert.match(stanza(searchbase, tileId), /`index_network_ftd`/);
}
for (const tileId of expectedTiles.network_detection) {
  assert.match(stanza(searchbase, tileId), /`index_zeek`/);
  assert.match(stanza(searchbase, tileId), /sourcetype="zeek:conn"/);
}

assert.ok(stanza(macros, "index_dns_umbrella"));
assert.ok(stanza(macros, "index_network_ftd"));

const railBody = stanza(
  workspacesConf,
  "signal_rail.agentic_security_operations_center",
);
const railIds = field(railBody, "items").split(",");
assert.deepEqual(railIds, [
  "soc_dns_requests",
  "soc_dns_blocks",
  "soc_intrusion_threats",
  "soc_security_intelligence",
  "soc_zeek_sessions",
  "soc_zeek_bytes",
]);
for (const itemId of railIds) {
  assert.ok(stanza(workspacesConf, `signal_item.${itemId}`));
}

assert.deepEqual(
  signalConfig
    .getDefaultSignalTickerConfig("agentic_security_operations_center")
    .items.map((item) => item.id),
  railIds,
);

console.log("Agentic Security Operations Center workspace contract passed.");
