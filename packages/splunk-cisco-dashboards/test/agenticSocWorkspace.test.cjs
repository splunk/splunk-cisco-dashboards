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
  "unified_investigation",
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
assert.equal(workspace.fallbackTileCount, 9);
assert.equal(workspace.maxVisibleSections, 4);
assert.deepEqual(
  workspace.sections.map((section) => section.id),
  [
    "dns_security",
    "firewall_security",
    "network_detection",
    "unified_investigation",
  ],
);
assert.deepEqual(workspace.defaultVisibleSections, [
  "dns_security",
  "firewall_security",
  "network_detection",
  "unified_investigation",
]);

assert.match(workspaceManager, /Agentic Security Operations Center/);
assert.match(workspaceManager, /Umbrella DNS, firewall threat, Endace\/Zeek/);
assert.match(workspaceManager, /unified XDR and Splunk investigation/);

const workspaceBody = stanza(
  workspacesConf,
  "workspace.agentic_security_operations_center",
);
assert.equal(field(workspaceBody, "source_workspace"), "agentic_soc");
assert.equal(field(workspaceBody, "map_visible"), "0");
assert.equal(field(workspaceBody, "max_visible_sections"), "4");
assert.equal(
  field(workspaceBody, "default_visible_sections"),
  "dns_security,firewall_security,network_detection,unified_investigation",
);

const expectedTiles = {
  dns_security: [
    "agentic_soc_umbrella_dns_requests",
    "agentic_soc_umbrella_unique_domains",
    "agentic_soc_umbrella_blocked_requests",
    "agentic_soc_umbrella_top_categories",
    "agentic_soc_umbrella_top_applications",
    "agentic_soc_umbrella_top_domains",
    "agentic_soc_umbrella_top_clients",
    "agentic_soc_umbrella_response_codes",
    "agentic_soc_umbrella_application_inventory",
  ],
  firewall_security: [
    "agentic_soc_firewall_connection_volume",
    "agentic_soc_firewall_blocked_connections",
    "agentic_soc_firewall_intrusion_threats",
    "agentic_soc_firewall_security_intelligence",
    "agentic_soc_firewall_destinations_by_country",
    "agentic_soc_firewall_top_rules",
    "agentic_soc_firewall_top_applications",
    "agentic_soc_firewall_top_destination_ports",
    "agentic_soc_firewall_top_conversations",
  ],
  network_detection: [
    "agentic_soc_zeek_traffic_volume",
    "agentic_soc_zeek_protocols",
    "agentic_soc_zeek_top_conversations",
    "agentic_soc_zeek_dns_queries",
    "agentic_soc_zeek_dns_response_codes",
    "agentic_soc_zeek_http_hosts",
    "agentic_soc_zeek_tls_posture",
    "agentic_soc_zeek_notices",
    "agentic_soc_zeek_file_types",
  ],
  unified_investigation: [
    "agentic_soc_unified_threat_activity",
    "agentic_soc_unified_xdr_severity",
    "agentic_soc_unified_xdr_status",
    "agentic_soc_unified_xdr_top_detections",
    "agentic_soc_unified_es_action_activity",
    "agentic_soc_unified_es_top_rules",
    "agentic_soc_unified_attack_analyzer_job_scores",
    "agentic_soc_unified_attack_analyzer_detections",
    "agentic_soc_unified_investigation_queue",
  ],
};

for (const [sectionId, tileIds] of Object.entries(expectedTiles)) {
  assert.equal(tileIds.length, 9, `${sectionId} must ship exactly nine searches`);
  const layout = stanza(
    workspacesConf,
    `layout.agentic_security_operations_center.${sectionId}`,
  );
  assert.deepEqual(field(layout, "tiles").split(","), tileIds);
  assert.equal(
    field(layout, "visible_count"),
    "3",
  );

  for (const tileId of tileIds) {
    const search = stanza(searchbase, tileId);
    assert.ok(
      field(search, "search_name"),
      `${tileId} must expose the catalogue join key search_name`,
    );
    const vizOptions = JSON.parse(field(search, "viz_options"));
    assert.equal(vizOptions.overview[0].workspace, "agentic_soc");
    assert.equal(vizOptions.overview[0].section, sectionId);
    assert.equal(vizOptions.overview[0].tileId, tileId);
    assert.match(field(search, "tags"), /Agentic SOC/);
    assert.match(field(search, "tags"), /Custom Conference/);
    assert.doesNotMatch(search, /\|\s*makeresults|random\s*\(/i);
  }
}

for (const tileId of expectedTiles.dns_security) {
  assert.match(stanza(searchbase, tileId), /`index_agentic_soc_dns`/);
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
  stanza(searchbase, "agentic_soc_umbrella_top_applications"),
  /stats latest\(application_requests\)/,
);
assert.doesNotMatch(
  stanza(searchbase, "agentic_soc_umbrella_top_applications"),
  /stats sum\(application_requests\)/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_top_categories"),
  /split\(dns_categories,","\)/,
);
for (const tileId of expectedTiles.firewall_security) {
  const search = stanza(searchbase, tileId);
  assert.match(search, /`index_agentic_soc_firewall`/);
  assert.match(field(search, "tags"), /TA 7404/);
  assert.match(field(search, "tags"), /Awaiting Feed/);
}
for (const tileId of expectedTiles.network_detection) {
  const search = stanza(searchbase, tileId);
  assert.match(search, /`index_agentic_soc_zeek`/);
  assert.match(search, /sourcetype="zeek:/);
  assert.match(field(search, "tags"), /Stack Validated/);
}
for (const tileId of expectedTiles.unified_investigation) {
  const search = stanza(searchbase, tileId);
  assert.match(search, /`index_agentic_soc_investigation`/);
  assert.match(field(search, "tags"), /Live First/);
  assert.match(field(search, "tags"), /Synthetic Fallback/);
  assert.match(search, /DataSource="Live"/);
  assert.match(search, /DataSource="Synthetic Demo"/);
  assert.match(
    search,
    /appendpipe \[ stats count as _rows \| where _rows=0/,
  );
  const vizOptions = JSON.parse(field(search, "viz_options"));
  assert.match(vizOptions.overview[0].subLabel, /labeled synthetic fallback/);
}
assert.match(
  stanza(searchbase, "agentic_soc_unified_investigation_queue"),
  /\.example/,
);
assert.match(
  stanza(searchbase, "agentic_soc_unified_xdr_top_detections"),
  /\| table Title Detections Product DataSource/,
);

assert.ok(stanza(macros, "index_dns_umbrella"));
assert.ok(stanza(macros, "index_network_ftd"));
assert.match(
  stanza(macros, "index_agentic_soc_dns"),
  /se_dns_csa.*se_dns_umbrella/s,
);
assert.match(stanza(macros, "index_agentic_soc_firewall"), /se_network_ftd/);
assert.match(stanza(macros, "index_agentic_soc_zeek"), /se_network_endace/);
assert.match(
  stanza(macros, "index_agentic_soc_investigation"),
  /se_incident_xdr_new.*cim_modactions.*se_malware_saa/s,
);

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

for (const searchId of [
  "agentic_soc_umbrella_dns_requests",
  "agentic_soc_umbrella_blocked_requests",
  "agentic_soc_firewall_intrusion_threats",
  "agentic_soc_firewall_security_intelligence",
  "agentic_soc_zeek_traffic_volume",
]) {
  assert.match(
    stanza(searchbase, searchId),
    /appendpipe \[ stats count as _rows \| where _rows=0/,
    `${searchId} must emit an explicit zero row for the Signal Rail`,
  );
}

assert.deepEqual(
  signalConfig
    .getDefaultSignalTickerConfig("agentic_security_operations_center")
    .items.map((item) => item.id),
  railIds,
);

console.log("Agentic Security Operations Center workspace contract passed.");
