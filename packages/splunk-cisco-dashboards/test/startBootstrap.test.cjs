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
  appsEndpoint,
  compareVersions,
  csrfToken,
  discoveryEndpoint,
  endpoint,
  homeUrl,
  isConfigured,
  isOnDemand,
  localePrefix,
  parseExportRows,
  resolvePrerequisites,
  shouldRender,
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
  appsEndpoint("/en-US/app/splunk-cisco-dashboards/start"),
  "/en-US/splunkd/__raw/services/apps/local?count=0&output_mode=json",
);
assert.equal(
  discoveryEndpoint("/en-US/app/splunk-cisco-dashboards/start"),
  "/en-US/splunkd/__raw/servicesNS/nobody/splunk-cisco-dashboards/search/jobs/export",
);
assert.equal(localePrefix("/manager/apps/local"), "/en-US");

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
    "catalyst-ta",
    "spaces-ta",
    "thousandeyes-ta",
  ],
);
assert.equal(prerequisites.length, 11);
assert.equal(prerequisites[0].status, "update");
assert.equal(prerequisites[1].status, "installed");
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
assert.match(bootstrapSource, /Splunk_SA_Scientific_Python_<os>/);
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
assert.match(macroTuningSource, /Review only what needs attention/);
assert.match(macroTuningSource, /Balanced \(recommended\)/);
assert.match(macroTuningSource, /Tune app-owned index macros/);
assert.match(macroTuningSource, /setupExternalRowsToSave/);
assert.match(macroTuningSource, /row\.targetApp/);
assert.match(macroTuningSource, /Advanced tuning/);
assert.match(macroTuningSource, /Save and finish setup/);
assert.match(macroTuningSource, /DATA_MODEL_ACCELERATION_SEARCH/);
assert.match(macroTuningSource, /Accelerate recommended data models/);
assert.match(macroTuningSource, /Recommended data model acceleration status/);
assert.match(macroTuningSource, /openAccelerationSearchUrl/);
assert.match(macroTuningSource, /Open acceleration check in Search/);
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
for (const appOwnedIndexMacro of [
  "cisco_catalyst_app_index",
  "cisco_catalyst_sdwan_index",
  "cisco_dc_aci_index",
  "cisco_dc_nd_index",
  "cisco_dc_n9k_index",
]) {
  assert.match(macroTuningSource, new RegExp(appOwnedIndexMacro));
  assert.match(searchbaseSource, new RegExp(appOwnedIndexMacro));
}

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
    /script="application\.js,executive_insights_bootstrap\.js"/,
  );
  assert.match(viewSource, /id="scan-root"/);
  assert.doesNotMatch(viewSource, /\btemplate=/);
}
assert.match(navSource, /name="secure_networking_profile"\s+default="true"/);
assert.match(navSource, /name="executive_briefing_profile"/);
assert.match(navSource, /<a href="start\?setup=1">Setup<\/a>/);
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
