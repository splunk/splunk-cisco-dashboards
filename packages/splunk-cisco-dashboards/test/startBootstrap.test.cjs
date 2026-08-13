"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const bootstrapPath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/appserver/static/start_bootstrap.js",
);
const {
  appInstallUrl,
  appsEndpoint,
  compareVersions,
  csrfToken,
  discoveryEndpoint,
  endpoint,
  homeUrl,
  isConfigured,
  isOnDemand,
  isTuningHash,
  localePrefix,
  manageAppsUrl,
  openManageApps,
  parseExportRows,
  resolveCapabilities,
  resolvePrerequisites,
  resolveSkippedPackages,
  shouldRender,
  tuningUrl,
} = require(bootstrapPath);

assert.equal(
  endpoint("/en-US/app/splunk-cisco-dashboards/setup"),
  "/en-US/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-setup/install?output_mode=json",
);
assert.equal(
  endpoint("/fr-FR/app/splunk-cisco-dashboards/setup"),
  "/fr-FR/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-setup/install?output_mode=json",
);
assert.equal(
  homeUrl("/de-DE/app/splunk-cisco-dashboards/setup"),
  "/de-DE/app/splunk-cisco-dashboards/workspace_insights",
);
assert.equal(
  tuningUrl("/de-DE/app/splunk-cisco-dashboards/setup"),
  "/de-DE/app/splunk-cisco-dashboards/setup?setup=1#tune-indexes",
);
assert.equal(isTuningHash("#tune-indexes"), true);
assert.equal(isTuningHash("tune-indexes"), true);
assert.equal(isTuningHash("#review-packages"), false);
assert.equal(
  appsEndpoint("/en-US/app/splunk-cisco-dashboards/setup"),
  "/en-US/splunkd/__raw/services/apps/local?count=0&output_mode=json",
);
assert.equal(
  discoveryEndpoint("/en-US/app/splunk-cisco-dashboards/setup"),
  "/en-US/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/search/jobs/export",
);
assert.equal(localePrefix("/manager/apps/local"), "/en-US");
assert.equal(
  appInstallUrl(
    "/en-US/app/splunk-cisco-dashboards/setup",
    "Splunk_ML_Toolkit",
  ),
  "/en-US/manager/appinstall/Splunk_ML_Toolkit",
);
assert.equal(
  manageAppsUrl("/en-US/app/splunk-cisco-dashboards/setup"),
  "/en-US/manager/system/apps/local",
);
assert.equal(
  manageAppsUrl(
    "/fr-FR/app/splunk-cisco-dashboards/setup",
    "Splunk_ML_Toolkit",
  ),
  "/fr-FR/manager/system/apps/local?search=Splunk_ML_Toolkit",
);

let manageAppsIntervalCallback;
let manageAppsClearedTimer;
let manageAppsOpenedUrl;
let manageAppsPreventedDefault = false;
const manageAppsFilterEvents = [];
const manageAppsFilter = {
  dispatchEvent(event) {
    manageAppsFilterEvents.push([event.type, event.key || ""]);
  },
  focus() {
    this.focused = true;
  },
};
function ManageAppsEvent(type) {
  this.type = type;
}
function ManageAppsInput() {}
function ManageAppsKeyboardEvent(type, options) {
  this.type = type;
  this.key = options.key;
}
const manageAppsWindow = {
  closed: false,
  document: {
    querySelector() {
      return manageAppsFilter;
    },
  },
  Event: ManageAppsEvent,
  HTMLInputElement: ManageAppsInput,
  KeyboardEvent: ManageAppsKeyboardEvent,
  opener: {},
};
Object.defineProperty(manageAppsWindow.HTMLInputElement.prototype, "value", {
  set(value) {
    this.value = value;
  },
});
global.window = {
  clearInterval(timer) {
    manageAppsClearedTimer = timer;
  },
  location: {
    assign() {},
    pathname: "/en-US/app/splunk-cisco-dashboards/setup",
  },
  open(url) {
    manageAppsOpenedUrl = url;
    return manageAppsWindow;
  },
  setInterval(callback) {
    manageAppsIntervalCallback = callback;
    return 42;
  },
};
openManageApps(
  {
    altKey: false,
    button: 0,
    ctrlKey: false,
    metaKey: false,
    preventDefault() {
      manageAppsPreventedDefault = true;
    },
    shiftKey: false,
  },
  "Splunk_ML_Toolkit",
);
manageAppsIntervalCallback();
assert.equal(manageAppsPreventedDefault, true);
assert.equal(
  manageAppsOpenedUrl,
  "/en-US/manager/system/apps/local?search=Splunk_ML_Toolkit",
);
assert.equal(manageAppsFilter.value, "Splunk_ML_Toolkit");
assert.deepEqual(manageAppsFilterEvents, [
  ["input", ""],
  ["change", ""],
  ["keydown", "Enter"],
]);
assert.equal(manageAppsFilter.focused, true);
assert.equal(manageAppsWindow.opener, null);
assert.equal(manageAppsClearedTimer, 42);
delete global.window;
assert.equal(
  appInstallUrl(
    "/fr-FR/app/splunk-cisco-dashboards/setup",
    "app id/with spaces",
  ),
  "/fr-FR/manager/appinstall/app%20id%2Fwith%20spaces",
);

assert.equal(
  isConfigured({ entry: [{ content: { is_configured: "1" } }] }),
  true,
);
assert.equal(
  isConfigured({ entry: [{ content: { is_configured: 1 } }] }),
  true,
);
assert.equal(
  isConfigured({ entry: [{ content: { is_configured: "0" } }] }),
  false,
);
assert.equal(isConfigured({ entry: [] }), false);
assert.equal(isConfigured(null), false);

assert.equal(isOnDemand("?setup=1"), true);
assert.equal(isOnDemand("?setup=1&source=nav"), true);
assert.equal(isOnDemand("?setup=0"), false);
assert.equal(isOnDemand(""), false);

assert.equal(
  shouldRender({ entry: [{ content: { is_configured: "1" } }] }, "?setup=1"),
  true,
);
assert.equal(
  shouldRender({ entry: [{ content: { is_configured: "1" } }] }, ""),
  false,
);
assert.equal(
  shouldRender({ entry: [{ content: { is_configured: "0" } }] }, ""),
  true,
);

assert.equal(compareVersions("2.1.0", "2.0.9"), 1);
assert.equal(compareVersions("2.0", "2.0.0"), 0);
assert.equal(compareVersions("2.0.0-rc.1", "2.0.0"), -1);
assert.equal(compareVersions("unknown", "2.0.0"), null);

const exportRows = parseExportRows(
  [
    JSON.stringify({
      result: {
        index: "netops",
        sourcetype: "cisco:dnac:devicehealth",
        count: "1,250",
        latest: "1753800000",
      },
    }),
    JSON.stringify({
      result: {
        index: "security",
        sourcetype: "cisco:ftd",
        count: "42",
        latest: "1753900000",
      },
    }),
  ].join("\n"),
);
assert.deepEqual(exportRows, [
  {
    index: "netops",
    sourcetype: "cisco:dnac:devicehealth",
    count: 1250,
    latest: 1753800000,
  },
  {
    index: "security",
    sourcetype: "cisco:ftd",
    count: 42,
    latest: 1753900000,
  },
]);

const prerequisites = resolvePrerequisites(
  [
    {
      index: "netops",
      sourcetype: "cisco:dnac:devicehealth",
      count: 10,
      latest: 0,
    },
    {
      index: "identity",
      sourcetype: "cisco:ise:syslog",
      count: 5,
      latest: 0,
    },
    {
      index: "aci",
      sourcetype: "cisco:dc:aci:class",
      count: 25,
      latest: 0,
    },
    {
      index: "meraki",
      sourcetype: "meraki:devices",
      count: 12,
      latest: 0,
    },
  ],
  [
    {
      name: "cisco_dc_networking_app_for_splunk",
      content: { version: "1.2.2", "update.version": "1.3.0" },
    },
    {
      name: "cisco-catalyst-app",
      content: { version: "3.2.10", disabled: false },
    },
    {
      name: "Splunk_SA_Scientific_Python_darwin_arm64",
      content: { version: "4.3.4", disabled: false },
    },
    {
      name: "Splunk_TA_nix",
      content: { version: "10.3.1", disabled: false },
    },
  ],
);
assert.deepEqual(
  prerequisites.map((item) => item.id),
  [
    "searchbase",
    "cim",
    "ai-toolkit",
    "scientific-python",
    "dc-networking",
    "catalyst-app",
    "catalyst-ta",
    "security-cloud",
    "meraki-ta",
  ],
);
assert.equal(prerequisites.length, 9);
assert.equal(prerequisites.find((item) => item.id === "cim").status, "missing");
assert.equal(
  prerequisites.find((item) => item.id === "searchbase").importance,
  "mandatory",
);
assert.equal(
  prerequisites.find((item) => item.id === "catalyst-app").status,
  "installed",
);
const scientificPython = prerequisites.find(
  (item) => item.id === "scientific-python",
);
assert.equal(scientificPython.status, "installed");
assert.equal(
  scientificPython.installedId,
  "Splunk_SA_Scientific_Python_darwin_arm64",
);
assert.equal(
  scientificPython.displayId,
  "Splunk_SA_Scientific_Python_<os>",
);
assert.equal(
  prerequisites.find((item) => item.id === "dc-networking")
    .latestKnownVersion,
  "1.3.0",
);

const capabilityCoverage = resolveCapabilities([
  {
    index: "identity",
    sourcetype: "cisco:ise:syslog",
    count: 300,
    latest: 0,
  },
  {
    index: "network",
    sourcetype: "cisco:dnac:devicehealth",
    count: 200,
    latest: 0,
  },
  {
    index: "aci",
    sourcetype: "cisco:dc:nexus9k:syslog",
    count: 150,
    latest: 0,
  },
  {
    index: "meraki",
    sourcetype: "meraki:devices",
    count: 100,
    latest: 0,
  },
]);
assert.equal(
  capabilityCoverage.find((item) => item.id === "identity").detected,
  true,
);
assert.equal(
  capabilityCoverage.find((item) => item.id === "enterprise-networking")
    .detected,
  true,
);
assert.equal(
  capabilityCoverage.find((item) => item.id === "data-center").detected,
  true,
);
assert.equal(
  capabilityCoverage.find((item) => item.id === "meraki").detected,
  true,
);
assert.equal(
  capabilityCoverage.find((item) => item.id === "thousandeyes").detected,
  false,
);
assert.equal(
  resolveSkippedPackages([]).some((item) => item.id === "thousandeyes-ta"),
  true,
);

const securityCloudPrerequisites = resolvePrerequisites(
  [
    {
      index: "identity",
      sourcetype: "cisco:duo:user",
      count: 5,
      latest: 0,
    },
    {
      index: "firewall",
      sourcetype: "cisco:sfw:estreamer",
      count: 8,
      latest: 0,
    },
  ],
  [
    {
      name: "CiscoSecurityCloud",
      content: { version: "4.0.1", disabled: false },
    },
  ],
);
const securityCloud = securityCloudPrerequisites.find(
  (item) => item.id === "security-cloud",
);
assert.equal(securityCloud.status, "installed");
assert.equal(securityCloud.splunkbase, "https://splunkbase.splunk.com/app/7404");
assert.deepEqual(securityCloud.sourcetypes, [
  "cisco:duo:user",
  "cisco:sfw:estreamer",
]);

global.window = {
  location: { port: "8000" },
  $C: { FORM_KEY: "runtime-token" },
};
global.document = { cookie: "" };
assert.equal(csrfToken(), "runtime-token");
global.window = { location: { port: "8000" }, $C: {} };
global.document = {
  cookie:
    "splunkweb_csrf_token_8003=wrong%2Dinstance; splunkweb_csrf_token_8000=cookie%2Dtoken",
};
assert.equal(csrfToken(), "cookie-token");
global.window = {
  location: { port: "8000" },
  $C: { FORM_KEY: "stale-runtime-token" },
};
assert.equal(csrfToken(), "cookie-token");
delete global.window;
delete global.document;

const applicationPath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/appserver/static/application.js",
);
const applicationSource = fs.readFileSync(applicationPath, "utf8");
const bootstrapSource = fs.readFileSync(bootstrapPath, "utf8");
assert.match(bootstrapSource, /Splunk Cisco App Navigator/);
assert.match(bootstrapSource, /https:\/\/splunkbase\.splunk\.com\/app\/8566/);
assert.match(bootstrapSource, /scd-setup__disclosure/);
assert.match(bootstrapSource, /Discover your Cisco environment/);
assert.match(bootstrapSource, /sourcetype="meraki:\*"/);
assert.match(bootstrapSource, /Next: review recommendations/);
assert.match(bootstrapSource, /Next: tune index macros/);
assert.match(bootstrapSource, /Packages skipped because data is absent/);
assert.match(bootstrapSource, /scdSetupShowTuningStep/);
assert.match(bootstrapSource, /pages\/macro_index_tuning\.js/);
assert.doesNotMatch(bootstrapSource, /Open the full index macro tuner/);
assert.match(bootstrapSource, /aria-current/);
assert.match(bootstrapSource, /Splunk_SA_Scientific_Python_<os>/);
assert.match(bootstrapSource, /AI analytics runtime/);
assert.match(bootstrapSource, /scd-setup__package-table/);
assert.match(bootstrapSource, /Installed package status/);
assert.match(bootstrapSource, /Latest known/);
assert.match(bootstrapSource, /This live table checks the Splunk Web node/);
assert.match(bootstrapSource, /scd-setup__requirement-role/);
assert.match(bootstrapSource, /Refresh installed package status/);
assert.match(bootstrapSource, /scdSetupOpenManageApps/);
assert.match(bootstrapSource, /button\.disabled = Boolean\(buttonConfig\.disabled\)/);
assert.match(
  bootstrapSource,
  /must be installed and enabled before index tuning/,
);
assert.match(bootstrapSource, /Open Manage Apps filtered to/);
const legacyOverviewTemplatePath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/appserver/templates/overview.html",
);
const viewsRoot = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);
const navSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/resources/splunk/default/data/ui/nav/default.xml",
  ),
  "utf8",
);
const activeNavSource = navSource.replace(/<!--[\s\S]*?-->/g, "");
const dashboardBuilderTemplateSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/resources/splunk/appserver/templates/dashboardbuilder.html",
  ),
  "utf8",
);
const macroTuningSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/webapp/pages/macro_index_tuning/index.tsx",
  ),
  "utf8",
);
const searchbaseSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/resources/splunk/default/searchbase.conf",
  ),
  "utf8",
);
const setupViewSource = fs.readFileSync(
  path.join(viewsRoot, "setup.xml"),
  "utf8",
);
const macroTuningViewSource = fs.readFileSync(
  path.join(viewsRoot, "admin_macro_index_tuning.xml"),
  "utf8",
);
const macroTuningRenderSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/webapp/pages/macro_index_tuning/render.tsx",
  ),
  "utf8",
);
const setupStyleSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/resources/splunk/appserver/static/start.css",
  ),
  "utf8",
);
const macroTuningBootstrapSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/resources/splunk/appserver/static/macro_index_tuning_bootstrap.js",
  ),
  "utf8",
);
assert.match(setupViewSource, /<dashboard\b[^>]*\btheme="dark"/);
assert.match(setupViewSource, /id="scan-root" hidden="hidden"/);
assert.match(macroTuningViewSource, /<dashboard\b[^>]*\btheme="dark"/);
assert.match(macroTuningSource, /scd-admin-dark scd-c3-atmosphere dark/);
assert.doesNotMatch(macroTuningSource, /setTheme\("dark"\)/);
assert.match(macroTuningRenderSource, /mountPageRaw\(MacroIndexTuningPage\)/);
assert.doesNotMatch(macroTuningRenderSource, /fixedColorScheme/);
assert.match(macroTuningSource, /Back to recommendations/);
assert.match(macroTuningSource, /scd:setup-step/);
assert.doesNotMatch(macroTuningSource, /Open full tuner/);
assert.match(macroTuningBootstrapSource, /setup.*setup=1#tune-indexes/s);
assert.match(setupStyleSource, /c3-atmosphere\.svg/);
assert.match(setupStyleSource, /\.scd-setup__package-table\s*\{/);
assert.match(setupStyleSource, /content: attr\(data-label\)/);
assert.match(macroTuningSource, /scd-macro-group-toggle/);
assert.match(
  macroTuningSource,
  /scd-macro-group-toggle[^"]*sui-color-default[^"]*sui-hover-bg-overlay/,
);
assert.match(setupStyleSource, /@container setup-content \(max-width: 880px\)/);
assert.match(macroTuningSource, /Review only what needs attention/);
assert.match(macroTuningSource, /Balanced \(recommended\)/);
assert.match(macroTuningSource, /Tune app-owned routing macros/);
assert.match(macroTuningSource, /setupExternalRowsToSave/);
assert.match(macroTuningSource, /loadInstalledAppIds/);
assert.match(macroTuningSource, /installedTargetApps/);
assert.match(
  macroTuningSource,
  /Companion apps could not be verified, so their macro definitions are hidden/,
);
assert.match(macroTuningSource, /Nothing was marked complete/);
assert.match(macroTuningSource, /row\.targetApp/);
assert.match(macroTuningSource, /Cisco app macro coverage/);
assert.match(macroTuningSource, /Dashboard index macros/);
assert.match(macroTuningSource, /Cisco app macros/);
assert.match(macroTuningSource, /external-app-macro-definitions/);
assert.match(macroTuningSource, /externalAppMacroSummaries/);
assert.match(macroTuningSource, /Open CIM macros/);
assert.match(macroTuningSource, /Advanced tuning/);
assert.match(macroTuningSource, /Save and finish setup/);
assert.match(macroTuningSource, /Setup was not completed/);
assert.match(macroTuningSource, /setupCimRowsToSave/);
assert.match(macroTuningSource, /Tune detected CIM data-model macros/);
assert.doesNotMatch(macroTuningSource, /properties\/macros/);
assert.doesNotMatch(macroTuningSource, /could not remove its local/);
assert.match(
  macroTuningSource,
  /\.\.\.setupExternalRowsToSave,[\s\S]*\.\.\.setupCimRowsToSave/,
);
assert.match(
  macroTuningSource,
  /Expand a product only when you need its model-level actions/,
);
assert.match(
  macroTuningSource,
  /Finish setup now and retry macro tuning later/,
);
assert.doesNotMatch(
  macroTuningSource,
  /const finishInitialSetup[\s\S]*?if \(scanState !== "ready"\) return;/,
);
assert.match(macroTuningSource, /DATA_MODEL_ACCELERATION_SEARCH/);
assert.match(macroTuningSource, /Accelerate recommended data models/);
assert.match(macroTuningSource, /Recommended data model acceleration status/);
assert.match(macroTuningSource, /openAccelerationSearchUrl/);
assert.match(macroTuningSource, /Open acceleration check in Search/);
assert.match(macroTuningSource, /DATA_MODEL_ACCELERATION_DOCS_URL/);
assert.match(macroTuningSource, /SPLUNK_DOCS_VERSION/);
assert.match(macroTuningSource, /Splunk acceleration guide/);
assert.match(
  macroTuningSource,
  /use-data-summaries-to-accelerate-searches\/accelerate-data-models/,
);
assert.match(macroTuningSource, /appSearch: app/);
assert.match(macroTuningSource, /nameFilter: model/);
for (const recommendedDataModelApp of [
  "Splunk_SA_CIM",
  "CiscoSecurityCloud",
  "ta_cisco_thousandeyes",
  "cisco-catalyst-app",
  "cisco_dc_networking_app_for_splunk",
]) {
  assert.match(macroTuningSource, new RegExp(recommendedDataModelApp));
}
for (const appOwnedRoutingMacro of [
  "cisco_catalyst_app_index",
  "cisco_catalyst_app_sourcetypes",
  "cisco_catalyst_sdwan_index",
  "cisco_dc_aci_index",
  "cisco_dc_nd_index",
  "cisco_dc_n9k_index",
  "meraki_index",
  "cisco_intersight_index",
  "spaces_index",
]) {
  assert.match(macroTuningSource, new RegExp(appOwnedRoutingMacro));
  assert.match(searchbaseSource, new RegExp(appOwnedRoutingMacro));
}
for (const cimIndexMacro of [
  "cim_Alerts_indexes",
  "cim_Application_State_indexes",
  "cim_Authentication_indexes",
  "cim_Certificates_indexes",
  "cim_Change_Analysis_indexes",
  "cim_Change_indexes",
  "cim_Compute_Inventory_indexes",
  "cim_DLP_indexes",
  "cim_Databases_indexes",
  "cim_Data_Access_indexes",
  "cim_Email_indexes",
  "cim_Endpoint_indexes",
  "cim_Event_Signatures_indexes",
  "cim_Interprocess_Messaging_indexes",
  "cim_Intrusion_Detection_indexes",
  "cim_JVM_indexes",
  "cim_Malware_indexes",
  "cim_Network_Resolution_indexes",
  "cim_Network_Sessions_indexes",
  "cim_Network_Traffic_indexes",
  "cim_Performance_indexes",
  "cim_Ticket_Management_indexes",
  "cim_Updates_indexes",
  "cim_Vulnerabilities_indexes",
  "cim_Web_indexes",
]) {
  assert.match(macroTuningSource, new RegExp(cimIndexMacro));
}
assert.match(macroTuningSource, /Run all CIM discovery/);
assert.match(macroTuningSource, /cimHasTag\("filesystem"\)/);
assert.match(macroTuningSource, /cimHasTag\("performance"\)/);
assert.match(macroTuningSource, /tags outputfield=cim_tags/);
assert.match(macroTuningSource, /mvexpand macro/);
for (const supportedCompanionApp of [
  "Splunk_TA_cisco_meraki",
  "Splunk_TA_Cisco_Intersight",
  "ta_cisco_spaces",
]) {
  assert.match(macroTuningSource, new RegExp(supportedCompanionApp));
  assert.match(searchbaseSource, new RegExp(supportedCompanionApp));
}
assert.match(macroTuningSource, /sourcetypeIn/);
assert.match(macroTuningSource, /Cisco Enterprise Networking for Splunk Platform/);
assert.match(macroTuningSource, /Cisco Meraki Add-on for Splunk/);
assert.match(macroTuningSource, /Cisco Intersight Add-On for Splunk/);
assert.match(macroTuningSource, /Cisco Spaces Add-on for Splunk/);
assert.match(searchbaseSource, /definition_format=="sourcetypeIn"/);
assert.match(searchbaseSource, /sourcetype IN \(\\"/);

// Executive Insights deliberately uses Simple XML rather than a custom Mako
// template. Splunk Web can reload these profile views on first install;
// appserver/templates otherwise remains cached until a web restart.
assert.equal(fs.existsSync(legacyOverviewTemplatePath), false);
assert.equal(fs.existsSync(path.join(viewsRoot, "overview.xml")), false);
assert.equal(
  fs.existsSync(path.join(viewsRoot, "secure_networking_overview.xml")),
  false,
);
for (const removedWorkspaceAlias of [
  "workspace_executive_briefing",
  "workspace_secure_networking",
]) {
  assert.equal(
    fs.existsSync(path.join(viewsRoot, `${removedWorkspaceAlias}.xml`)),
    false,
    `${removedWorkspaceAlias} must not remain as a second workspace shell`,
  );
}
for (const viewName of ["workspace_insights"]) {
  const viewSource = fs.readFileSync(
    path.join(viewsRoot, `${viewName}.xml`),
    "utf8",
  );
  assert.match(viewSource, /<dashboard\b/);
  assert.match(
    viewSource,
    /<dashboard\b[^>]*\btheme="dark"/,
    `${viewName} must keep the Splunk page shell aligned with the shipped dark workspace theme`,
  );
  assert.match(
    viewSource,
    /script="application\.js,executive_insights_bootstrap\.js"/,
  );
  assert.match(viewSource, /id="scan-root"/);
  assert.doesNotMatch(viewSource, /\btemplate=/);
}
assert.match(navSource, /name="workspace_insights"\s+default="true"/);
assert.doesNotMatch(
  navSource,
  /workspace_(?:secure_networking|executive_briefing)/,
);
assert.match(navSource, /<a href="setup\?setup=1">Setup<\/a>/);
assert.doesNotMatch(
  navSource,
  /<a href="macro_index_tuning">Macro Index Tuning<\/a>/,
  "Macro Index Tuning should remain accessible from Setup instead of duplicating the navigation entry",
);
for (const dashboardGroup of [
  "More",
  "Network &amp; IT Operations",
  "Security Operations",
  "Workplace Intelligence",
  "Catalyst Operations",
  "Visual Labs (Beta)",
  "Help &amp; Resources",
  "Administration",
]) {
  assert.match(
    navSource,
    new RegExp(`label="${dashboardGroup.replace(/[()]/g, "\\$&")}"`),
    `Navigation must include the ${dashboardGroup} group`,
  );
}
for (const legacyDashboardGroup of [
  "Other",
  "Dashboards",
  "More Dashboards",
  "Core Dashboards",
  "Operations",
  "Workplace &amp; Collaboration",
  "Event Ops",
  "Concepts (Beta)",
  "Admin &amp; Tools",
]) {
  assert.doesNotMatch(
    navSource,
    new RegExp(`label="${legacyDashboardGroup.replace(/[()]/g, "\\$&")}"`),
    `Navigation must not retain the legacy ${legacyDashboardGroup} group`,
  );
}
for (const betaDashboardLabel of [
  "Health Monitoring (Beta)",
  "Security Operations Overview (Beta)",
  "Catalyst Operations (Beta)",
]) {
  assert.match(
    navSource,
    new RegExp(`>${betaDashboardLabel.replace(/[()]/g, "\\$&")}<`),
    `${betaDashboardLabel} must remain visibly identified as beta`,
  );
}
assert.match(
  navSource,
  /href="dashboard_manager#\/workplace_spaces_intelligence">Cisco Spaces — Intelligence<\/a>/,
);
assert.match(
  navSource,
  /href="dashboard_manager#\/workplace_operations_overview">Workplace — Single Pane of Glass<\/a>/,
);
assert.match(
  activeNavSource,
  /<collection label="More" icon="layout">\s*<a href="dashboard_manager">Dashboard Manager<\/a>\s*<divider\s*\/>/,
  "Dashboard Manager must remain the first emphasized destination under More",
);
assert.equal(
  (activeNavSource.match(/href="dashboard_manager"/g) ?? []).length,
  1,
  "Dashboard Manager must have one canonical navigation entry",
);
assert.doesNotMatch(
  activeNavSource,
  /<collection label="Dashboard Library">/,
  "The optional native Dashboard Library must remain outside active navigation",
);
for (const [utilityGroup, destinations] of Object.entries({
  "Help &amp; Resources": ["user_guide", "search"],
})) {
  const groupStart = activeNavSource.indexOf(`<collection label="${utilityGroup}">`);
  const groupEnd = activeNavSource.indexOf("</collection>", groupStart);
  assert.notEqual(groupStart, -1, `${utilityGroup} group must exist`);
  assert.notEqual(groupEnd, -1, `${utilityGroup} group must be closed`);
  const groupSource = activeNavSource.slice(groupStart, groupEnd);
  for (const destination of destinations) {
    assert.match(
      groupSource,
      new RegExp(`(?:href|name)="${destination}"`),
      `${destination} must remain in ${utilityGroup}`,
    );
  }
}
const organizedDashboardGroups = {
  "Network &amp; IT Operations": [
    "netops_critical_systems_health",
    "netops_readiness",
    "netops_health_monitoring",
  ],
  "Security Operations": ["secops_resilience", "secops_overview"],
  "Workplace Intelligence": [
    "workplace_building_intelligence",
    "workplace_spaces_intelligence",
    "workplace_operations_overview",
  ],
  "Catalyst Operations": [
    "netops_catalyst_health",
    "netops_catalyst_operations",
  ],
  "Visual Labs (Beta)": [
    "searchbase_canvas",
    "network_diagram",
    "sn_topology_canvas",
  ],
  Administration: ["admin_asset_inventory", "setup"],
};
for (const [dashboardGroup, destinations] of Object.entries(
  organizedDashboardGroups,
)) {
  const groupStart = navSource.indexOf(`<collection label="${dashboardGroup}">`);
  const groupEnd = navSource.indexOf("</collection>", groupStart);
  assert.notEqual(groupStart, -1, `${dashboardGroup} group must exist`);
  assert.notEqual(groupEnd, -1, `${dashboardGroup} group must be closed`);
  const groupSource = navSource.slice(groupStart, groupEnd);
  for (const destination of destinations) {
    assert.match(
      groupSource,
      new RegExp(
        `(?:href|name)="(?:dashboard_manager#/)?${destination}(?:\\?setup=1)?"`,
      ),
      `${destination} must remain in ${dashboardGroup}`,
    );
    assert.equal(
      fs.existsSync(path.join(viewsRoot, `${destination}.xml`)),
      true,
      `${destination} must resolve to a shipped Splunk view`,
    );
  }
}
const nativeStudioViews = fs
  .readdirSync(viewsRoot)
  .filter((fileName) => fileName.endsWith(".xml"))
  .filter((fileName) =>
    /<dashboard\s+version="2"/.test(
      fs.readFileSync(path.join(viewsRoot, fileName), "utf8"),
    ),
  )
  .map((fileName) => fileName.replace(/\.xml$/, ""))
  .sort();
const dashboardManagerNavViews = [
  ...activeNavSource.matchAll(/href="dashboard_manager#\/([^"]+)"/g),
]
  .map(([, viewName]) => viewName)
  .sort();
assert.deepEqual(
  dashboardManagerNavViews,
  nativeStudioViews,
  "Every native Studio navigation link must preserve the app shell through Dashboard Manager",
);
assert.doesNotMatch(navSource, /name="secure_networking_overview"/);
assert.doesNotMatch(navSource, /name="overview"/);

assert.match(dashboardBuilderTemplateSource, /application\.js/);
assert.match(dashboardBuilderTemplateSource, /scdSetupGatePromise/);

async function runSetupGate(pathname, payload, responseOk = true) {
  const redirects = [];
  const requests = [];
  const context = {
    fetch: (url) => {
      requests.push(url);
      return Promise.resolve({
        ok: responseOk,
        status: responseOk ? 200 : 403,
        json: () => Promise.resolve(payload),
      });
    },
    window: {
      location: {
        pathname,
        replace: (url) => redirects.push(url),
      },
    },
  };

  vm.runInNewContext(applicationSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  return {
    gateResult: await context.window.scdSetupGatePromise,
    redirects,
    requests,
  };
}

(async () => {
  const unconfigured = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/secops_resilience",
    { entry: [{ content: { is_configured: "0" } }] },
  );
  assert.deepEqual(unconfigured.redirects, [
    "/en-US/app/splunk-cisco-dashboards/setup",
  ]);
  assert.equal(unconfigured.requests.length, 1);
  assert.equal(
    unconfigured.requests[0],
    "/en-US/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-setup/install?output_mode=json",
  );
  assert.equal(unconfigured.gateResult, false);

  const configured = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/workspace_insights",
    { entry: [{ content: { is_configured: "1" } }] },
  );
  assert.deepEqual(configured.redirects, []);
  assert.equal(configured.gateResult, true);

  const setupView = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/setup",
    { entry: [{ content: { is_configured: "0" } }] },
  );
  assert.equal(setupView.requests.length, 0);

  const tuningView = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/admin_macro_index_tuning",
    { entry: [{ content: { is_configured: "0" } }] },
  );
  assert.equal(tuningView.requests.length, 0);

  const failedRead = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/workspace_insights",
    null,
    false,
  );
  assert.deepEqual(failedRead.redirects, []);
  assert.equal(failedRead.gateResult, true);

  console.log("✓ setup bootstrap tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
