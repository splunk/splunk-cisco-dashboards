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
  fullTuningUrl,
  homeUrl,
  isConfigured,
  isOnDemand,
  localePrefix,
  parseExportRows,
  resolvePrerequisites,
  shouldRender,
  tuningAction,
  tuningUrl,
} = require(bootstrapPath);

assert.equal(
  endpoint("/en-US/app/splunk-cisco-dashboards/start"),
  "/en-US/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-setup/install?output_mode=json",
);
assert.equal(
  endpoint("/fr-FR/app/splunk-cisco-dashboards/start"),
  "/fr-FR/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-setup/install?output_mode=json",
);
assert.equal(
  homeUrl("/de-DE/app/splunk-cisco-dashboards/start"),
  "/de-DE/app/splunk-cisco-dashboards/secure_networking_profile",
);
assert.equal(
  tuningUrl("/de-DE/app/splunk-cisco-dashboards/start"),
  "/de-DE/app/splunk-cisco-dashboards/macro_index_tuning?setup=1",
);
assert.equal(
  fullTuningUrl("/de-DE/app/splunk-cisco-dashboards/start"),
  "/de-DE/app/splunk-cisco-dashboards/macro_index_tuning",
);
assert.deepEqual(
  tuningAction("/en-US/app/splunk-cisco-dashboards/start", true),
  {
    ariaLabel: "Open the full index macro tuner",
    description:
      "Open the full tuner whenever indexes or sourcetypes change. Setup checks stay available here without forcing you through onboarding again.",
    footerLabel: "Tune index macros",
    heading: "Keep dashboard macros current",
    href: "/en-US/app/splunk-cisco-dashboards/macro_index_tuning",
    label: "Tune index macros",
    readyNote:
      "Setup is complete. Reopen the tuner whenever indexes, sourcetypes, or routing requirements change.",
  },
);
assert.equal(
  tuningAction("/en-US/app/splunk-cisco-dashboards/start", false).href,
  "/en-US/app/splunk-cisco-dashboards/macro_index_tuning?setup=1",
);
assert.equal(
  tuningAction("/en-US/app/splunk-cisco-dashboards/start", false).label,
  "Continue guided setup",
);
assert.equal(
  appsEndpoint("/en-US/app/splunk-cisco-dashboards/start"),
  "/en-US/splunkd/__raw/services/apps/local?count=0&output_mode=json",
);
assert.equal(
  discoveryEndpoint("/en-US/app/splunk-cisco-dashboards/start"),
  "/en-US/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/search/jobs/export",
);
assert.equal(localePrefix("/manager/apps/local"), "/en-US");
assert.equal(
  appInstallUrl(
    "/en-US/app/splunk-cisco-dashboards/start",
    "Splunk_ML_Toolkit",
  ),
  "/en-US/manager/appinstall/Splunk_ML_Toolkit",
);
assert.equal(
  appInstallUrl(
    "/fr-FR/app/splunk-cisco-dashboards/start",
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
    "dc-networking",
    "catalyst-app",
    "security-cloud",
    "searchbase",
    "ai-toolkit",
    "scientific-python",
    "meraki-ta",
    "windows-ta",
    "nix-ta",
    "catalyst-ta",
    "spaces-ta",
    "thousandeyes-ta",
  ],
);
assert.equal(prerequisites.length, 12);
assert.equal(prerequisites[0].status, "update");
assert.equal(prerequisites[1].status, "installed");
const nix = prerequisites.find((item) => item.id === "nix-ta");
assert.equal(nix.status, "installed");
assert.equal(nix.installedId, "Splunk_TA_nix");
assert.equal(nix.splunkbase, "https://splunkbase.splunk.com/app/833");
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
assert.deepEqual(securityCloud.sourcetypes, []);

global.window = { $C: { FORM_KEY: "runtime-token" } };
global.document = { cookie: "" };
assert.equal(csrfToken(), "runtime-token");
global.window = { $C: {} };
global.document = { cookie: "splunkweb_csrf_token_8000=cookie%2Dtoken" };
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
assert.match(bootstrapSource, /Setup and data readiness/);
assert.match(bootstrapSource, /Keep dashboard macros current/);
assert.match(bootstrapSource, /Continue guided setup/);
assert.match(bootstrapSource, /Open the full index macro tuner/);
assert.match(bootstrapSource, /Setup progress: complete/);
assert.match(bootstrapSource, /aria-current/);
assert.match(bootstrapSource, /configured \? 4 : 2/);
assert.match(bootstrapSource, /Splunk_SA_Scientific_Python_<os>/);
assert.match(bootstrapSource, /Update \$\{prerequisite\.name\} in Manage Apps/);
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
  path.join(viewsRoot, "start.xml"),
  "utf8",
);
const macroTuningViewSource = fs.readFileSync(
  path.join(viewsRoot, "macro_index_tuning.xml"),
  "utf8",
);
const macroTuningStyleSource = fs.readFileSync(
  path.resolve(
    __dirname,
    "../src/main/webapp/pages/macro_index_tuning/macro-index-tuning.css",
  ),
  "utf8",
);
assert.match(setupViewSource, /<dashboard\b[^>]*\btheme="dark"/);
assert.match(macroTuningViewSource, /<dashboard\b[^>]*\btheme="dark"/);
assert.match(macroTuningSource, /scd-admin-dark dark/);
assert.match(macroTuningSource, /setTheme\("dark"\)/);
assert.match(macroTuningStyleSource, /scd-admin-dark/);
assert.match(macroTuningStyleSource, /radial-gradient/);
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
assert.match(macroTuningSource, /Macro tuning is optional during setup/);
assert.match(macroTuningSource, /row\.targetApp/);
assert.match(macroTuningSource, /Cisco app macro coverage/);
assert.match(macroTuningSource, /Dashboard index macros/);
assert.match(macroTuningSource, /Cisco app macros/);
assert.match(macroTuningSource, /external-app-macro-definitions/);
assert.match(macroTuningSource, /externalAppMacroSummaries/);
assert.match(macroTuningSource, /Open CIM macros/);
assert.match(macroTuningSource, /Advanced tuning/);
assert.match(macroTuningSource, /Save and finish setup/);
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
for (const viewName of [
  "executive_briefing_profile",
  "insights_workspace",
  "secure_networking_profile",
]) {
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
assert.match(navSource, /name="secure_networking_profile"\s+default="true"/);
assert.match(navSource, /name="executive_briefing_profile"/);
assert.match(navSource, /<a href="start\?setup=1">Setup<\/a>/);
assert.doesNotMatch(
  navSource,
  /<a href="macro_index_tuning">Macro Index Tuning<\/a>/,
  "Macro Index Tuning should remain accessible from Setup instead of duplicating the navigation entry",
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
    "/en-US/app/splunk-cisco-dashboards/security_v1",
    { entry: [{ content: { is_configured: "0" } }] },
  );
  assert.deepEqual(unconfigured.redirects, [
    "/en-US/app/splunk-cisco-dashboards/start",
  ]);
  assert.equal(unconfigured.requests.length, 1);
  assert.equal(
    unconfigured.requests[0],
    "/en-US/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/configs/conf-setup/install?output_mode=json",
  );
  assert.equal(unconfigured.gateResult, false);

  const configured = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/secure_networking_profile",
    { entry: [{ content: { is_configured: "1" } }] },
  );
  assert.deepEqual(configured.redirects, []);
  assert.equal(configured.gateResult, true);

  const setupView = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/start",
    { entry: [{ content: { is_configured: "0" } }] },
  );
  assert.equal(setupView.requests.length, 0);

  const tuningView = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/macro_index_tuning",
    { entry: [{ content: { is_configured: "0" } }] },
  );
  assert.equal(tuningView.requests.length, 0);

  const failedRead = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/secure_networking_profile",
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
