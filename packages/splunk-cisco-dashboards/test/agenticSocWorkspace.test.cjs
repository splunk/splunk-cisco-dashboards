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
  )(module.exports, module, require, sourcePath, path.dirname(sourcePath));
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

const stanzaEntries = (source) => {
  const headers = Array.from(source.matchAll(/^\[([^\]]+)\]$/gm));
  return headers.map((header, index) => ({
    id: header[1],
    body: source.slice(
      header.index + header[0].length + 1,
      headers[index + 1]?.index ?? source.length,
    ),
  }));
};

const workspaceConfig = loadTypescriptModule(
  "src/main/webapp/common/config/insightsWorkspaces.ts",
);
const signalConfig = loadTypescriptModule(
  "src/main/webapp/common/config/signalTicker.ts",
);
const metricValueFormat = loadTypescriptModule(
  "src/main/webapp/common/lib/metricValueFormat.ts",
);
const workspacesConf = read(
  "src/main/resources/splunk/default/insights_workspaces.conf",
);
const searchbase = read("src/main/resources/splunk/default/searchbase.conf");
const macros = read("src/main/resources/splunk/default/macros.conf");
const workspaceManager = read(
  "src/main/webapp/common/components/workspace/WorkspaceManager.tsx",
);
const searchbaseTileConfigService = read(
  "src/main/webapp/common/services/searchbaseTileConfigService.ts",
);
const insightsWorkspaceService = read(
  "src/main/webapp/common/services/insightsWorkspaceService.ts",
);
const executiveInsights = read(
  "src/main/webapp/pages/executive_insights/index.tsx",
);

const secureNetworkingIcons = workspaceConfig.WORKSPACE_SOURCES.secure_networking.sections
  .filter((section) =>
    [
      "zta",
      "secure_infrastructure",
      "scalable_network_segmentation",
      "hybrid_mesh_firewalling",
      "agentic_ops",
    ].includes(section.id),
  )
  .map((section) => section.icon);
assert.deepEqual(secureNetworkingIcons, [
  "fingerprint-nodes",
  "server-brackets",
  "globe-division",
  "column-arrows-left-right",
  "robot-face-sparkle",
]);
for (const iconName of [
  "FingerprintNodes",
  "ServerBrackets",
  "GlobeDivision",
  "ColumnArrowsLeftRight",
  "RobotFaceSparkle",
]) {
  assert.match(executiveInsights, new RegExp(`\\b${iconName}\\b`));
}
for (const expectedTimeRange of [
  "Last 4 hours",
  "Last 24 hours",
  "Last 48 hours",
  "Last 7 days",
  "Last 30 days",
]) {
  assert.match(executiveInsights, new RegExp(expectedTimeRange));
}
assert.doesNotMatch(
  executiveInsights,
  /label: "Last 90 days"/,
  "The quick selector must reserve its compact layout for the approved ranges",
);
assert.match(executiveInsights, /@splunk\/react-time-range\/Dropdown/);
assert.match(executiveInsights, /<TimeRangeDropdown/);
assert.match(executiveInsights, /Today/);
assert.match(executiveInsights, /presets=\{\[\.\.\.TIME_RANGE_PRESETS\]\}/);
assert.doesNotMatch(
  executiveInsights,
  /scd-time-range-quick|Custom time range mode|type="datetime-local"/,
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
assert.equal(workspace.minTileCount, 1);
assert.equal(workspace.maxTileCount, 3);
assert.equal(workspace.fallbackTileCount, 3);
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
assert.match(
  workspaceManager,
  /Umbrella DNS, Cisco Secure Firewall, Endace\/Zeek/,
);
assert.match(workspaceManager, /Splunk-led investigation/);

const workspaceBody = stanza(
  workspacesConf,
  "workspace.agentic_security_operations_center",
);
assert.equal(field(workspaceBody, "source_workspace"), "agentic_soc");
assert.equal(field(workspaceBody, "map_visible"), "0");
assert.equal(field(workspaceBody, "max_visible_sections"), "4");
assert.equal(field(workspaceBody, "min_tile_count"), "1");
assert.equal(field(workspaceBody, "max_tile_count"), "3");
assert.equal(field(workspaceBody, "default_tile_count"), "3");
assert.equal(
  field(workspaceBody, "default_visible_sections"),
  "dns_security,firewall_security,network_detection,unified_investigation",
);

const executiveBody = stanza(workspacesConf, "workspace.executive");
const executiveFallback = workspaceConfig.PACKAGED_WORKSPACE_FALLBACKS.find(
  (candidate) => candidate.id === "executive",
);
assert.ok(executiveFallback, "Expected the packaged Executive fallback");
assert.deepEqual(
  executiveFallback.sections.map((section) => section.id),
  ["it_health", "security", "building"],
);
assert.deepEqual(executiveFallback.defaultVisibleSections, [
  "it_health",
  "security",
  "building",
]);
assert.equal(executiveFallback.maxVisibleSections, 3);
assert.equal(executiveFallback.fallbackTileCount, 9);
assert.equal(field(executiveBody, "sections"), "it_health,security,building");
assert.equal(
  field(executiveBody, "default_visible_sections"),
  "it_health,security,building",
);
assert.equal(field(executiveBody, "max_visible_sections"), "3");
assert.equal(field(executiveBody, "default_tile_count"), "9");
assert.equal(field(executiveBody, "map_visible"), "1");
assert.equal(field(executiveBody, "map_position"), "right");
assert.equal(field(executiveBody, "regional_view"), "map");

const legacyExecutiveSections = {
  it_health: [
    ["critical_website_availability", "Critical sites available"],
    ["network_health", "Network health"],
    ["device_health", "Device health"],
    ["open_issues", "Open issues"],
    ["device_inventory_by_type", "Inventory mix"],
    ["syslog_severity", "Syslog severity"],
    ["it_domain_score", "IT domain score"],
    ["config_changes", "Config changes"],
    ["compliance_rate", "Compliance rate"],
  ],
  security: [
    ["fw_blocked", "FW blocked"],
    ["threat_sources", "Threat sources"],
    ["failed_auth", "Failed auth"],
    ["rogue_devices", "Rogue devices"],
    ["sec_score", "Security score"],
    ["xdr_critical", "XDR critical"],
    ["dns_blocked_queries", "DNS blocks"],
    ["web_threats", "Web threats"],
    ["email_threat_count", "Email threats"],
  ],
  building: [
    ["active_devices", "Active devices"],
    ["wifi_clients", "Wi-Fi clients"],
    ["occupancy", "Occupancy"],
    ["devices_to_review", "Devices to review"],
    ["collab_devices", "Webex devices"],
    ["ap_health", "AP health"],
    ["environmental_health", "Environmental health"],
    ["rooms_occupied", "Rooms occupied"],
    ["water_leaks", "Water leaks"],
  ],
};

const searchbaseEntries = stanzaEntries(searchbase);
const executiveOverviewTiles = searchbaseEntries.flatMap(({ id, body }) => {
  const rawVizOptions = field(body, "viz_options");
  if (!rawVizOptions) return [];
  const overview = JSON.parse(rawVizOptions).overview;
  if (!Array.isArray(overview)) return [];
  return overview.map((tile) => ({
    ...tile,
    stanzaId: id,
    searchName: field(body, "search_name"),
  }));
});

for (const [sectionId, expectedSectionTiles] of Object.entries(
  legacyExecutiveSections,
)) {
  const layoutId = `layout.executive.${sectionId}`;
  const layout = stanza(workspacesConf, layoutId);
  assert.equal(
    field(layout, "tiles"),
    expectedSectionTiles.map(([tileId]) => tileId).join(","),
    `${layoutId} must preserve the legacy tile order`,
  );
  assert.equal(
    field(layout, "visible_count"),
    "9",
    `${layoutId} must expose all nine legacy tiles by default`,
  );

  for (const [tileId, label] of expectedSectionTiles) {
    const matches = executiveOverviewTiles.filter(
      (tile) =>
        tile.tileId === tileId &&
        tile.section === sectionId &&
        (tile.workspace === undefined || tile.workspace === "executive"),
    );
    assert.equal(
      matches.length,
      1,
      `${tileId} must resolve to exactly one current Executive Searchbase tile`,
    );
    assert.equal(matches[0].label, label, `${tileId} must keep its legacy label`);
    assert.ok(matches[0].searchName, `${tileId} must resolve to a saved search`);
  }
}

assert.doesNotMatch(
  workspacesConf,
  /^\[layout\.executive\.custom\]$/m,
  "Executive Briefing must not retain an unreferenced fourth section layout",
);

const legacyExecutiveSignals = [
  ["thousandeyes_stream_age", "TE stream age"],
  ["ftd_firewall_age", "FTD feed age"],
  ["fmc_estreamer_age", "FMC IPS age"],
  ["ise_syslog_age", "ISE syslog age"],
  ["catalyst_center_age", "Catalyst API age"],
  ["spaces_firehose_age", "Spaces feed age"],
];
assert.equal(
  field(stanza(workspacesConf, "signal_rail.executive"), "items"),
  legacyExecutiveSignals.map(([itemId]) => itemId).join(","),
);
assert.deepEqual(
  signalConfig
    .getDefaultSignalTickerConfig("executive")
    .items.map((item) => item.id),
  legacyExecutiveSignals.map(([itemId]) => itemId),
  "Executive factory reset must preserve the legacy feed-freshness rail",
);
for (const [itemId, label] of legacyExecutiveSignals) {
  const signalItem = stanza(workspacesConf, `signal_item.${itemId}`);
  assert.equal(field(signalItem, "label"), label);
  const searchName = field(signalItem, "search_name");
  assert.ok(searchName, `${itemId} must declare search_name`);
  assert.ok(
    searchbaseEntries.some(({ body }) => field(body, "search_name") === searchName),
    `${itemId} must resolve to a current Searchbase saved search`,
  );
}

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
    "agentic_soc_firewall_security_intelligence",
    "agentic_soc_firewall_top_destination_ports",
    "agentic_soc_firewall_top_conversations",
    "agentic_soc_firewall_intrusion_threats",
    "agentic_soc_firewall_blocked_connections",
    "agentic_soc_firewall_destinations_by_country",
    "agentic_soc_firewall_top_rules",
    "agentic_soc_firewall_top_applications",
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

assert.equal(
  workspaceConfig.AGENTIC_SOC_WORKSPACE_ID,
  "agentic_security_operations_center",
);
assert.deepEqual(
  workspaceConfig.PACKAGED_AGENTIC_SOC_LAYOUT_TILE_IDS,
  expectedTiles,
  "Factory reset inventory must mirror all four packaged Agentic layouts",
);
assert.deepEqual(
  workspaceConfig.PACKAGED_AGENTIC_SOC_SEARCHBASE_STANZA_IDS,
  Object.values(expectedTiles).flat(),
  "Factory reset must retain all 36 packaged Agentic searchbase stanza IDs",
);
assert.equal(
  new Set(workspaceConfig.PACKAGED_AGENTIC_SOC_SEARCHBASE_STANZA_IDS).size,
  36,
);

const demoTiles = Object.fromEntries(
  Object.entries(expectedTiles).map(([sectionId, tileIds]) => [
    sectionId,
    tileIds.slice(0, 3),
  ]),
);

assert.deepEqual(demoTiles, {
  dns_security: [
    "agentic_soc_umbrella_dns_requests",
    "agentic_soc_umbrella_unique_domains",
    "agentic_soc_umbrella_blocked_requests",
  ],
  firewall_security: [
    "agentic_soc_firewall_connection_volume",
    "agentic_soc_firewall_security_intelligence",
    "agentic_soc_firewall_top_destination_ports",
  ],
  network_detection: [
    "agentic_soc_zeek_traffic_volume",
    "agentic_soc_zeek_protocols",
    "agentic_soc_zeek_top_conversations",
  ],
  unified_investigation: [
    "agentic_soc_unified_threat_activity",
    "agentic_soc_unified_xdr_severity",
    "agentic_soc_unified_xdr_status",
  ],
});

const expectedDrilldownTargets = {
  agentic_soc_umbrella_dns_requests: [
    "agentic_soc_umbrella_top_categories",
    "agentic_soc_umbrella_top_clients",
  ],
  agentic_soc_umbrella_unique_domains: [
    "agentic_soc_umbrella_top_categories",
    "agentic_soc_umbrella_top_clients",
  ],
  agentic_soc_umbrella_blocked_requests: [
    "agentic_soc_umbrella_response_codes",
  ],
  agentic_soc_firewall_connection_volume: [
    "agentic_soc_firewall_top_rules",
    "agentic_soc_firewall_top_conversations",
  ],
  agentic_soc_firewall_security_intelligence: [
    "agentic_soc_firewall_top_rules",
    "agentic_soc_firewall_top_conversations",
  ],
  agentic_soc_firewall_top_destination_ports: [
    "agentic_soc_firewall_top_rules",
    "agentic_soc_firewall_top_conversations",
  ],
  agentic_soc_zeek_traffic_volume: [
    "agentic_soc_zeek_top_conversations",
    "agentic_soc_zeek_file_types",
  ],
  agentic_soc_zeek_protocols: [
    "agentic_soc_zeek_top_conversations",
    "agentic_soc_zeek_file_types",
  ],
  agentic_soc_zeek_top_conversations: [
    "agentic_soc_zeek_file_types",
    "agentic_soc_unified_attack_analyzer_detections",
  ],
  agentic_soc_unified_threat_activity: [
    "agentic_soc_unified_xdr_status",
    "agentic_soc_unified_investigation_queue",
  ],
  agentic_soc_unified_xdr_severity: [
    "agentic_soc_unified_investigation_queue",
  ],
  agentic_soc_unified_xdr_status: [
    "agentic_soc_unified_investigation_queue",
  ],
};

for (const tileId of Object.values(demoTiles).flat()) {
  const search = stanza(searchbase, tileId);
  assert.ok(
    field(search, "search_name"),
    `${tileId} needs an Open in Search target`,
  );
  assert.match(field(search, "search"), /^\| tstats /);
  assert.ok(
    field(search, "default_viz"),
    `${tileId} needs an explicit visualization`,
  );
  assert.deepEqual(
    field(search, "drilldown_stanza_ids").split(","),
    expectedDrilldownTargets[tileId],
    `${tileId} needs the audited detail-search targets`,
  );
  assert.ok(
    field(search, "drilldown_button_title"),
    `${tileId} needs an operator-facing drilldown title`,
  );
  for (const metadataField of [
    "description",
    "explanation",
    "solution",
    "related_info",
  ]) {
    assert.ok(
      field(search, metadataField),
      `${tileId} needs ${metadataField} metadata`,
    );
  }
  const overview = JSON.parse(field(search, "viz_options")).overview[0];
  assert.ok(
    overview.thresholdNote,
    `${tileId} needs operator threshold guidance`,
  );
  assert.doesNotMatch(
    overview.thresholdNote,
    /^Counts are scoped to the selected dashboard time range/i,
    `${tileId} needs actionable, metric-specific threshold guidance`,
  );
}

for (const [tileId, targets] of Object.entries(expectedDrilldownTargets)) {
  for (const targetId of targets) {
    assert.notEqual(targetId, tileId, `${tileId} cannot drill into itself`);
    assert.ok(stanza(searchbase, targetId), `${targetId} must exist`);
  }
}

const visitedDrilldowns = new Set();
const activeDrilldowns = new Set();
const visitDrilldowns = (tileId) => {
  if (visitedDrilldowns.has(tileId)) return;
  assert.ok(
    !activeDrilldowns.has(tileId),
    `Visible-tile drilldown graph must not cycle through ${tileId}`,
  );
  activeDrilldowns.add(tileId);
  for (const targetId of expectedDrilldownTargets[tileId] ?? []) {
    if (expectedDrilldownTargets[targetId]) visitDrilldowns(targetId);
  }
  activeDrilldowns.delete(tileId);
  visitedDrilldowns.add(tileId);
};
for (const tileId of Object.keys(expectedDrilldownTargets)) {
  visitDrilldowns(tileId);
}

const dnsFailureOverview = JSON.parse(
  field(
    stanza(searchbase, "agentic_soc_umbrella_blocked_requests"),
    "viz_options",
  ),
).overview[0];
assert.equal(dnsFailureOverview.valueField, "WindowFailureRatePct");
assert.equal(dnsFailureOverview.unit, "%");
assert.deepEqual(dnsFailureOverview.thresholds, {
  warning: 5,
  critical: 15,
  direction: "lower_is_better",
  enabled: true,
});
for (const coverageTile of [
  "agentic_soc_umbrella_dns_requests",
  "agentic_soc_umbrella_unique_domains",
  "agentic_soc_firewall_connection_volume",
  "agentic_soc_firewall_top_destination_ports",
  "agentic_soc_zeek_traffic_volume",
  "agentic_soc_unified_threat_activity",
  "agentic_soc_unified_xdr_severity",
]) {
  const overview = JSON.parse(
    field(stanza(searchbase, coverageTile), "viz_options"),
  ).overview[0];
  assert.deepEqual(overview.thresholds, {
    critical: 1,
    direction: "higher_is_better",
    enabled: true,
  });
}

const trendContracts = {
  agentic_soc_umbrella_unique_domains: {
    valueField: "PeakBucketUniqueDomains",
    sparkDataField: "UniqueDomains",
    peakExpression: /eventstats max\(UniqueDomains\) as PeakBucketUniqueDomains/,
  },
  agentic_soc_firewall_top_destination_ports: {
    valueField: "PeakBucketReportingDevices",
    sparkDataField: "ReportingDevices",
    peakExpression:
      /eventstats max\(ReportingDevices\) as PeakBucketReportingDevices/,
  },
  agentic_soc_unified_xdr_severity: {
    valueField: "PeakBucketObservedDevices",
    sparkDataField: "ObservedDevices",
    peakExpression:
      /eventstats max\(ObservedDevices\) as PeakBucketObservedDevices/,
  },
};
for (const [tileId, contract] of Object.entries(trendContracts)) {
  const search = stanza(searchbase, tileId);
  const overview = JSON.parse(field(search, "viz_options")).overview[0];
  assert.equal(field(search, "default_viz"), "splunk.line");
  assert.equal(overview.valueField, contract.valueField);
  assert.equal(overview.sparkDataField, contract.sparkDataField);
  assert.match(overview.subLabel, /peak/i);
  assert.match(overview.subLabel, /automatic/i);
  assert.match(search, /BY _time span=auto/);
  assert.match(search, contract.peakExpression);
}

const visibleModelContracts = {
  dns_security: /Network_Resolution\.DNS/,
  firewall_security: /Network_Traffic\.All_Traffic/,
  network_detection: /Network_Traffic\.All_Traffic/,
  unified_investigation: /Network_Sessions\.All_Sessions/,
};
for (const [sectionId, tileIds] of Object.entries(demoTiles)) {
  for (const tileId of tileIds) {
    const search = stanza(searchbase, tileId);
    const operatorMetadata = [
      field(search, "description"),
      field(search, "explanation"),
      field(search, "solution"),
      field(search, "related_info"),
    ].join(" ");
    assert.match(
      operatorMetadata,
      visibleModelContracts[sectionId],
      `${tileId} metadata must name its accelerated data model`,
    );
  }
}

const acceleratedNetworkResolutionTiles = [
  "agentic_soc_umbrella_unique_domains",
  "agentic_soc_umbrella_dns_requests",
  "agentic_soc_umbrella_blocked_requests",
  "agentic_soc_umbrella_top_categories",
  "agentic_soc_umbrella_top_applications",
  "agentic_soc_umbrella_top_domains",
  "agentic_soc_umbrella_top_clients",
  "agentic_soc_umbrella_response_codes",
  "agentic_soc_umbrella_application_inventory",
  "agentic_soc_zeek_dns_queries",
  "agentic_soc_zeek_dns_response_codes",
  "agentic_soc_unified_xdr_top_detections",
];

const acceleratedNetworkTrafficTiles = [
  "agentic_soc_firewall_security_intelligence",
  "agentic_soc_firewall_connection_volume",
  "agentic_soc_firewall_intrusion_threats",
  "agentic_soc_firewall_destinations_by_country",
  "agentic_soc_firewall_blocked_connections",
  "agentic_soc_firewall_top_rules",
  "agentic_soc_firewall_top_applications",
  "agentic_soc_firewall_top_destination_ports",
  "agentic_soc_firewall_top_conversations",
  "agentic_soc_zeek_protocols",
  "agentic_soc_zeek_traffic_volume",
  "agentic_soc_zeek_top_conversations",
  "agentic_soc_zeek_http_hosts",
  "agentic_soc_zeek_tls_posture",
  "agentic_soc_zeek_notices",
  "agentic_soc_zeek_file_types",
  "agentic_soc_unified_es_action_activity",
  "agentic_soc_unified_es_top_rules",
  "agentic_soc_unified_attack_analyzer_job_scores",
  "agentic_soc_unified_attack_analyzer_detections",
  "agentic_soc_unified_investigation_queue",
];

const acceleratedNetworkSessionsTiles = [
  "agentic_soc_unified_threat_activity",
  "agentic_soc_unified_xdr_severity",
  "agentic_soc_unified_xdr_status",
];

const acceleratedTiles = new Set([
  ...acceleratedNetworkResolutionTiles,
  ...acceleratedNetworkTrafficTiles,
  ...acceleratedNetworkSessionsTiles,
]);
assert.equal(acceleratedTiles.size, 36);

for (const [sectionId, tileIds] of Object.entries(expectedTiles)) {
  assert.equal(
    tileIds.length,
    9,
    `${sectionId} must ship exactly nine searches`,
  );
  const layout = stanza(
    workspacesConf,
    `layout.agentic_security_operations_center.${sectionId}`,
  );
  assert.deepEqual(field(layout, "tiles").split(","), tileIds);
  assert.equal(field(layout, "visible_count"), "3");

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
    assert.ok(
      /CIM Accelerated/.test(field(search, "tags")),
      `${tileId} must declare accelerated execution`,
    );
    assert.match(field(search, "search"), /^\| tstats /);
    assert.doesNotMatch(search, /\|\s*makeresults|random\s*\(/i);
  }
}

for (const tileId of acceleratedNetworkResolutionTiles) {
  const search = stanza(searchbase, tileId);
  assert.match(field(search, "tags"), /CIM Accelerated/);
  assert.match(field(search, "tags"), /Network Resolution/);
  assert.match(
    search,
    /\| tstats summariesonly=true allow_old_summaries=false/,
  );
  assert.doesNotMatch(search, /`scd_summariesonly`/);
  assert.match(search, /FROM datamodel=Network_Resolution\.DNS/i);
}

for (const tileId of acceleratedNetworkTrafficTiles) {
  const search = stanza(searchbase, tileId);
  assert.match(field(search, "tags"), /CIM Accelerated/);
  assert.match(field(search, "tags"), /Network Traffic/);
  assert.match(
    search,
    /\| tstats summariesonly=true allow_old_summaries=false/,
  );
  assert.doesNotMatch(search, /`scd_summariesonly`/);
  assert.match(search, /FROM datamodel=Network_Traffic\.All_Traffic/i);
}

for (const tileId of acceleratedNetworkSessionsTiles) {
  const search = stanza(searchbase, tileId);
  assert.match(field(search, "tags"), /CIM Accelerated/);
  assert.match(field(search, "tags"), /Network Sessions/);
  assert.match(
    search,
    /\| tstats summariesonly=true allow_old_summaries=false/,
  );
  assert.match(search, /FROM datamodel=Network_Sessions\.All_Sessions/i);
  assert.match(search, /`index_dhcp`/);
  assert.match(search, /sourcetype="dhcp"/);
}

const dhcpActivity = stanza(searchbase, "agentic_soc_unified_threat_activity");
const dhcpActivityOverview = JSON.parse(field(dhcpActivity, "viz_options"))
  .overview[0];
assert.equal(dhcpActivityOverview.valueField, "WindowSessions");
assert.equal(dhcpActivityOverview.sparkDataField, "Sessions");
assert.match(dhcpActivity, /eventstats sum\(Sessions\) as WindowSessions/);

for (const tileId of expectedTiles.dns_security) {
  assert.match(stanza(searchbase, tileId), /`index_dns_umbrella`/);
}
const sharedDnsRailSearch = stanza(
  searchbase,
  "agentic_soc_umbrella_dns_requests",
);
for (const fieldName of [
  "Requests",
  "Failures",
  "FailureRatePct",
  "WindowRequests",
  "WindowFailures",
  "WindowFailureRatePct",
]) {
  assert.match(
    sharedDnsRailSearch,
    new RegExp(`\\b${fieldName}\\b`),
    `Shared DNS Signal Rail job must emit ${fieldName}`,
  );
}
assert.match(
  sharedDnsRailSearch,
  /FailureRatePct=if\(Requests>0,round\(100\*Failures\/Requests,2\),0\)/,
);
assert.match(
  sharedDnsRailSearch,
  /WindowFailureRatePct=if\(WindowRequests>0,round\(100\*WindowFailures\/WindowRequests,2\),0\)/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_blocked_requests"),
  /Failures=if\(coalesce\('DNS\.reply_code_id',0\)>0,Requests,0\)/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_blocked_requests"),
  /WindowFailureRatePct/,
);
assert.doesNotMatch(
  stanza(searchbase, "agentic_soc_umbrella_blocked_requests"),
  /action=blocked|Blocked DNS requests/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_top_applications"),
  /BY DNS\.src/,
);
assert.doesNotMatch(
  stanza(searchbase, "agentic_soc_umbrella_top_applications"),
  /appdiscovery|Synthetic Demo/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_top_categories"),
  /BY DNS\.query/,
);
assert.match(
  stanza(searchbase, "agentic_soc_umbrella_application_inventory"),
  /avg\(DNS\.response_time\)/,
);
for (const tileId of expectedTiles.firewall_security) {
  const search = stanza(searchbase, tileId);
  if (
    tileId === "agentic_soc_firewall_destinations_by_country" ||
    tileId === "agentic_soc_firewall_top_applications"
  ) {
    assert.match(search, /`index_zeek`/);
    assert.match(field(search, "tags"), /Endace/);
  } else {
    assert.match(search, /`index_network_ftd`/);
    assert.match(field(search, "tags"), /TA 7404/);
  }
  assert.doesNotMatch(field(search, "tags"), /Awaiting Feed/);
}
const agenticFtdDeviceSplTiles = Object.values(expectedTiles)
  .flat()
  .filter((tileId) =>
    stanza(searchbase, tileId).includes("All_Traffic.dvc"),
  );
assert.deepEqual(agenticFtdDeviceSplTiles, [
  "agentic_soc_firewall_connection_volume",
  "agentic_soc_firewall_top_destination_ports",
]);
for (const tileId of agenticFtdDeviceSplTiles) {
  const spl = stanza(searchbase, tileId);
  assert.match(
    spl,
    /NormalizedDevice=lower\(trim\(coalesce\('All_Traffic\.dvc',""\)\)\)/,
    `${tileId} must normalize blank and unknown device values`,
  );
  assert.match(
    spl,
    /ReportingDevice=if\(NormalizedDevice="" OR NormalizedDevice="unknown",host,'All_Traffic\.dvc'\)/,
    `${tileId} must fall back from literal unknown dvc to host`,
  );
  assert.doesNotMatch(spl, /ReportingDevice=coalesce\('All_Traffic\.dvc',host\)/);
}
assert.match(
  stanza(searchbase, "agentic_soc_firewall_top_rules"),
  /BY source sourcetype/,
);
assert.match(
  field(stanza(searchbase, "agentic_soc_firewall_top_rules"), "search_name"),
  /Collection Sources/,
);
assert.match(
  stanza(searchbase, "agentic_soc_firewall_top_applications"),
  /All_Traffic\.app/,
);
assert.match(
  field(
    stanza(searchbase, "agentic_soc_firewall_top_applications"),
    "search_name",
  ),
  /Top Applications/,
);
for (const tileId of expectedTiles.network_detection) {
  const search = stanza(searchbase, tileId);
  assert.match(search, /`index_zeek`/);
  assert.match(search, /sourcetype="zeek:/);
  assert.match(field(search, "tags"), /Stack Validated/);
}
for (const tileId of expectedTiles.unified_investigation.slice(3)) {
  const search = stanza(searchbase, tileId);
  assert.match(field(search, "tags"), /CIM Accelerated/);
  assert.match(field(search, "tags"), /Derived Signal/);
  assert.match(field(search, "search"), /^\| tstats /);
  assert.doesNotMatch(search, /Synthetic Demo|makeresults/);
  const vizOptions = JSON.parse(field(search, "viz_options"));
  assert.doesNotMatch(vizOptions.overview[0].subLabel, /synthetic/i);
}
assert.doesNotMatch(
  stanza(searchbase, "agentic_soc_unified_investigation_queue"),
  /\.example/,
);
assert.match(
  stanza(searchbase, "agentic_soc_unified_xdr_top_detections"),
  /\| table Domain Response Failures Clients/,
);

assert.ok(stanza(macros, "index_dns_umbrella"));
assert.ok(stanza(macros, "index_network_ftd"));
assert.ok(stanza(macros, "index_zeek"));
assert.ok(stanza(macros, "index_security"));
assert.doesNotMatch(macros, /^\[index_agentic_soc_/m);
assert.doesNotMatch(searchbase, /`index_agentic_soc_/);

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
assert.deepEqual(
  signalConfig.PACKAGED_AGENTIC_SOC_SIGNAL_ITEM_IDS,
  railIds,
  "Factory reset must retain all six packaged Agentic Signal Rail item IDs",
);
for (const itemId of railIds) {
  assert.ok(stanza(workspacesConf, `signal_item.${itemId}`));
}
const dnsFailureRailItem = stanza(
  workspacesConf,
  "signal_item.soc_dns_blocks",
);
assert.equal(field(dnsFailureRailItem, "label"), "DNS failure rate");
assert.equal(
  field(dnsFailureRailItem, "value_field"),
  "WindowFailureRatePct",
);
assert.equal(field(dnsFailureRailItem, "threshold_warning"), "5");
assert.equal(field(dnsFailureRailItem, "threshold_critical"), "15");
assert.equal(
  field(dnsFailureRailItem, "threshold_direction"),
  "lower_is_better",
);
assert.equal(field(dnsFailureRailItem, "threshold_unit"), "%");

for (const searchId of [
  "agentic_soc_umbrella_dns_requests",
  "agentic_soc_firewall_connection_volume",
  "agentic_soc_zeek_traffic_volume",
]) {
  assert.match(
    stanza(searchbase, searchId),
    /appendpipe \[ stats count as _rows \| where _rows=0/,
    `${searchId} must emit an explicit zero row for the Signal Rail`,
  );
}

const railSearchNames = railIds.map((itemId) =>
  field(stanza(workspacesConf, `signal_item.${itemId}`), "search_name"),
);
assert.deepEqual(railSearchNames, [
  "Agentic SOC - Umbrella DNS Request Trend",
  "Agentic SOC - Umbrella DNS Request Trend",
  "Agentic SOC - Firewall Event Volume Trend",
  "Agentic SOC - Firewall Event Volume Trend",
  "Agentic SOC - Zeek Traffic Volume Trend",
  "Agentic SOC - Zeek Traffic Volume Trend",
]);
assert.equal(
  new Set(railSearchNames).size,
  3,
  "Six Signal Rail values must share three accelerated jobs",
);
for (const searchName of railSearchNames) {
  const matchingId = Object.values(expectedTiles)
    .flat()
    .find(
      (tileId) =>
        field(stanza(searchbase, tileId), "search_name") === searchName,
    );
  assert.ok(matchingId, `Expected Signal Rail search ${searchName}`);
  assert.match(stanza(searchbase, matchingId), /\| tstats summariesonly=true/);
}

const fallbackRail = signalConfig.getDefaultSignalTickerConfig(
  "agentic_security_operations_center",
);
assert.deepEqual(
  fallbackRail.items.map((item) => item.id),
  railIds,
);
for (const fallbackItem of fallbackRail.items) {
  const configured = stanza(workspacesConf, `signal_item.${fallbackItem.id}`);
  assert.equal(
    fallbackItem.searchName,
    field(configured, "search_name"),
    `${fallbackItem.id} fallback search must match insights_workspaces.conf`,
  );
  assert.equal(fallbackItem.valueField, field(configured, "value_field"));
}
assert.equal(
  field(stanza(workspacesConf, "signal_item.soc_zeek_bytes"), "threshold_unit"),
  "B",
);
assert.equal(
  fallbackRail.items.find((item) => item.id === "soc_zeek_bytes").thresholdUnit,
  "B",
);

assert.match(
  searchbaseTileConfigService,
  /workspaceId === AGENTIC_SOC_WORKSPACE_SOURCE_ID[\s\S]*PACKAGED_AGENTIC_SOC_SEARCHBASE_STANZA_IDS/,
  "Agentic reset must seed packaged stanza IDs before adding effective runtime IDs",
);
assert.match(
  insightsWorkspaceService,
  /PACKAGED_WORKSPACE_FALLBACKS\.find\([\s\S]*candidate\.id === workspace\.id/,
  "Workspace reset must resolve the packaged workspace rather than trust the effective runtime definition",
);
assert.match(
  insightsWorkspaceService,
  /packagedWorkspace\.sections\.map/,
  "Workspace reset must delete every packaged layout section override",
);
assert.match(
  insightsWorkspaceService,
  /getDefaultSignalTickerConfig\(\s*packagedWorkspace\.id/,
  "Workspace reset must derive Signal Rail items from packaged defaults",
);
assert.doesNotMatch(
  insightsWorkspaceService,
  /resetBuiltInInsightsWorkspace[\s\S]{0,160}signalItemIds:/,
  "Workspace reset must not depend on a runtime-visible Signal Rail subset",
);
assert.match(
  executiveInsights,
  /resetBuiltInInsightsWorkspace\(insightsWorkspace\)/,
  "Factory reset caller must not pass the effective Signal Rail subset",
);
assert.match(
  executiveInsights,
  /resetInsightsWorkspaceTileConfig\([\s\S]*?packagedWorkspace\.sourceWorkspace[\s\S]*?resetBuiltInInsightsWorkspace/,
  "Factory reset caller must use the packaged source instead of an effective workspace override",
);

{
  const base = signalConfig.getDefaultSignalTickerConfig("executive");
  const personalSpeed = { ...base, speed: Math.max(base.speed - 5, 1) };
  const extraItem = {
    ...base,
    items: [
      ...base.items,
      {
        id: "shared_extra_kpi",
        searchName: "extra_search",
        label: "Extra",
      },
    ],
  };
  assert.equal(
    signalConfig.sharedSignalTickerConfigsEqual(base, personalSpeed),
    true,
    "Personal speed must not count as a shared Signal Rail change",
  );
  assert.equal(
    signalConfig.sharedSignalTickerConfigsEqual(base, extraItem),
    false,
    "Adding a KPI must count as a shared Signal Rail change",
  );
  assert.deepEqual(
    signalConfig.createSignalTickerDisplayPreferencePatch(base, personalSpeed),
    { speed: personalSpeed.speed },
    "Personal Signal Rail prefs must persist only display fields",
  );
  assert.equal(
    signalConfig.createSignalTickerDisplayPreferencePatch(base, extraItem),
    null,
    "Shared KPI membership must not be stored as a personal preference",
  );
}

assert.equal(metricValueFormat.formatCompactMetricNumber(999), "999");
assert.equal(metricValueFormat.formatCompactMetricNumber(1_000), "1K");
assert.equal(metricValueFormat.formatCompactMetricNumber(1_000_000), "1M");
assert.equal(metricValueFormat.formatCompactMetricNumber(1_000_000_000), "1B");
assert.equal(
  metricValueFormat.formatCompactMetricNumber(1_000_000_000_000),
  "1T",
);
assert.equal(metricValueFormat.formatCompactMetricNumber(-1_250), "-1.3K");
assert.equal(
  metricValueFormat.formatMetricNumber(1_210_000_000_000, "B"),
  "1.2 TB",
);
assert.equal(metricValueFormat.formatMetricNumber(1_250, "%"), "1,250%");

console.log(
  "Agentic SOC and legacy Executive Briefing workspace contracts passed.",
);
