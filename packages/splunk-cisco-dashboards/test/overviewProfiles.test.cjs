"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const profilesPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/config/overviewProfiles.ts",
);
const profilesSource = fs.readFileSync(profilesPath, "utf8");
const profilesOutput = ts.transpileModule(profilesSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: profilesPath,
}).outputText;
const profilesModule = { exports: {} };
const loadProfiles = new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  profilesOutput,
);
loadProfiles(
  profilesModule.exports,
  profilesModule,
  require,
  profilesPath,
  path.dirname(profilesPath),
);

const {
  OVERVIEW_PROFILE_IDS,
  getOverviewProfile,
  getOverviewProfileForViewName,
  getOverviewProfileFromLocation,
  getOverviewProfileViewName,
} = profilesModule.exports;

assert.deepEqual(OVERVIEW_PROFILE_IDS, ["secure_networking", "executive"]);
assert.equal(getOverviewProfile("executive").label, "Executive Briefing");
assert.equal(
  getOverviewProfile("secure_networking").label,
  "Secure Networking",
);
assert.equal(
  getOverviewProfile("secure_networking").hideDefaultLogo,
  true,
);
assert.deepEqual(
  getOverviewProfile("secure_networking").sections.map(
    ({ id, iconSrc }) => [id, iconSrc],
  ),
  [
    [
      "zta",
      "/static/app/splunk-cisco-dashboards/images/overview/secure-networking/zero-trust-access.svg",
    ],
    [
      "secure_infrastructure",
      "/static/app/splunk-cisco-dashboards/images/overview/secure-networking/secure-infrastructure.svg",
    ],
    [
      "scalable_network_segmentation",
      "/static/app/splunk-cisco-dashboards/images/overview/secure-networking/segmentation.svg",
    ],
    [
      "hybrid_mesh_firewalling",
      "/static/app/splunk-cisco-dashboards/images/overview/secure-networking/hybrid-mesh-firewalling.svg",
    ],
    [
      "agentic_ops",
      "/static/app/splunk-cisco-dashboards/images/overview/secure-networking/agentic-ops.svg",
    ],
  ],
);
assert.equal(getOverviewProfileViewName("executive"), "overview");
assert.equal(
  getOverviewProfileViewName("secure_networking"),
  "secure_networking_overview",
);
assert.equal(getOverviewProfileForViewName("overview").id, "executive");
assert.equal(
  getOverviewProfileForViewName("secure_networking_overview").id,
  "secure_networking",
);
assert.equal(
  getOverviewProfileForViewName(undefined).id,
  "secure_networking",
);

const originalWindow = global.window;
try {
  global.window = {
    location: {
      pathname:
        "/en-US/app/splunk-cisco-dashboards/secure_networking_overview",
      search: "?overview_profile=executive",
    },
  };
  assert.equal(getOverviewProfileFromLocation().id, "executive");

  global.window.location.search = "";
  assert.equal(getOverviewProfileFromLocation().id, "secure_networking");
} finally {
  if (originalWindow === undefined) {
    delete global.window;
  } else {
    global.window = originalWindow;
  }
}

console.log("✓ overview profile tests passed");
