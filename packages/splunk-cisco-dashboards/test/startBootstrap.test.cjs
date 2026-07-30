"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const bootstrapPath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/appserver/static/start_bootstrap.js",
);
const { csrfToken, endpoint, homeUrl, isConfigured, localePrefix } = require(
  bootstrapPath,
);

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
  "/de-DE/app/splunk-cisco-dashboards/secure_networking_overview",
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
  return { redirects, requests };
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

  const configured = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/secure_networking_overview",
    { entry: [{ content: { is_configured: "1" } }] },
  );
  assert.deepEqual(configured.redirects, []);

  const setupView = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/start",
    { entry: [{ content: { is_configured: "0" } }] },
  );
  assert.equal(setupView.requests.length, 0);

  const failedRead = await runSetupGate(
    "/en-US/app/splunk-cisco-dashboards/secure_networking_overview",
    null,
    false,
  );
  assert.deepEqual(failedRead.redirects, []);

  console.log("✓ setup bootstrap tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
