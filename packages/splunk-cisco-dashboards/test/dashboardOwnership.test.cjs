"use strict";

const assert = require("assert").strict;
const babel = require("@babel/core");
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const readSource = (...segments) =>
  fs.readFileSync(path.join(packageRoot, ...segments), "utf8");

const splunkSource = readSource(
  "src/main/webapp/common/lib/splunk.js",
);
const homeSource = readSource(
  "src/main/webapp/pages/dashboardbuilder/DBHomePage.jsx",
);
const editorSource = readSource(
  "src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
);
const defaultMeta = readSource(
  "src/main/resources/splunk/metadata/default.meta",
);

const dashboardUrlBlock = splunkSource.slice(
  splunkSource.indexOf("const dashboardUrl"),
  splunkSource.indexOf("export const normalizeDashboardTheme"),
);
assert.match(dashboardUrlBlock, /const dashboardUrl = \(owner,/);
assert.match(
  dashboardUrlBlock,
  /servicesNS\/\$\{encodeURIComponent\(owner\)\}/,
  "dashboard REST paths must use the resolved namespace owner",
);
assert.doesNotMatch(
  dashboardUrlBlock,
  /servicesNS\/nobody/,
  "dashboard REST paths must not force every create into the shared namespace",
);

assert.match(
  splunkSource,
  /services\/authentication\/current-context\?output_mode=json/,
  "dashboard ownership must fall back to Splunk's authenticated user context",
);
assert.match(splunkSource, /const namespaceOwner = await resolveDashboardOwner\(owner\);/);
assert.match(
  splunkSource,
  /dashboardUrl\(namespaceOwner\).*method: 'POST'/s,
  "dashboard creates must post in the authenticated user's namespace",
);
assert.match(
  splunkSource,
  /const responseText = await response\.text\(\);[\s\S]*JSON\.parse\(responseText\)/,
  "Splunk REST errors must remain displayable when the response is not JSON",
);

assert.match(
  homeSource,
  /addDash\([\s\S]*?"dark",\s*currentSplunkUser,\s*\)\.then/,
  "Dashboard Manager must pass the authenticated user to its create flow",
);
assert.match(
  editorSource,
  /currentDashboard\.owner \|\| currentDashboard\.author/,
  "dashboard saves must preserve the ACL owner returned by Splunk",
);

assert.match(
  defaultMeta,
  /^access = read : \[ \* \], write : \[ admin, sc_admin, power \]$/m,
  "the fix must not broaden the app-wide shared-object write ACL",
);

const runRuntimeContract = async () => {
  const compiledSplunkSource = babel.transformSync(splunkSource, {
    babelrc: false,
    configFile: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const requests = [];
  let nextResponse = {
    status: 201,
    body: JSON.stringify({ entry: [{ name: "scd_private_probe" }] }),
  };
  const mockFetch = async (url, init = {}) => {
    requests.push({ url, init });
    const response = nextResponse;
    return {
      status: response.status,
      text: async () => response.body,
    };
  };
  const mockRequire = (moduleName) => {
    if (moduleName === "@splunk/splunk-utils/fetch") {
      return { getDefaultFetchInit: () => ({ headers: {} }) };
    }
    if (moduleName === "./constants") {
      return { INSIGHTS_APP_ID: "splunk-cisco-dashboards" };
    }
    throw new Error(`Unexpected module ${moduleName}`);
  };
  const splunkModule = { exports: {} };
  new Function(
    "exports",
    "module",
    "require",
    "window",
    "fetch",
    "URLSearchParams",
    compiledSplunkSource,
  )(
    splunkModule.exports,
    splunkModule,
    mockRequire,
    { $C: { USERNAME: "sec_ops_user@example.com" } },
    mockFetch,
    URLSearchParams,
  );

  const createResult = await splunkModule.exports.addDash(
    "scd_private_probe",
    "{}",
    "Private probe",
    "",
    "",
    "dark",
  );
  assert.equal(createResult.status, 201);
  assert.match(
    requests[0].url,
    /servicesNS\/sec_ops_user%40example\.com\/splunk-cisco-dashboards\/data\/ui\/views\?output_mode=json$/,
    "runtime create must target the authenticated user's private namespace",
  );
  assert.doesNotMatch(requests[0].url, /servicesNS\/nobody/);

  nextResponse = { status: 403, body: "Forbidden by role policy" };
  const errorResult = await splunkModule.exports.getDashboards();
  assert.equal(errorResult.status, 403);
  assert.equal(errorResult.messages[0].text, "Forbidden by role policy");
};

runRuntimeContract()
  .then(() => {
    console.log("✓ Dashboard Manager authenticated ownership contract passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
