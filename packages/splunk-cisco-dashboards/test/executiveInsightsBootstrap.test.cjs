"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const bootstrapPath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/appserver/static/executive_insights_bootstrap.js",
);
const {
  compareAppVersions,
  localePrefix,
  resolveAppVersions,
} = require(bootstrapPath);
const bootstrapSource = fs.readFileSync(bootstrapPath, "utf8");

assert.match(bootstrapSource, /window\.scdSetupGatePromise/);
assert.match(bootstrapSource, /data-scd-executive-insights-bundle/);
assert.match(bootstrapSource, /pages\/executive_insights\.js/);
assert.doesNotMatch(bootstrapSource, /pages\/overview\.js/);

assert.equal(compareAppVersions("1.0.29", "1.0.28"), 1);
assert.equal(compareAppVersions("1.10.0", "1.9.99"), 1);
assert.equal(compareAppVersions("1.0.29", "1.0.29.0"), 0);
assert.equal(compareAppVersions("1.0.29-rc.2", "1.0.29"), -1);
assert.equal(compareAppVersions("development", "1.0.29"), null);

assert.deepEqual(resolveAppVersions("1.0.28", "1.0.29"), {
  version: "1.0.28",
  updateVersion: "1.0.29",
});
assert.deepEqual(resolveAppVersions("1.0.29", "1.0.29"), {
  version: "1.0.29",
  updateVersion: "",
});
assert.deepEqual(resolveAppVersions("1.0.30", "1.0.29"), {
  version: "1.0.30",
  updateVersion: "",
});
assert.deepEqual(resolveAppVersions("development", "1.0.29"), {
  version: "development",
  updateVersion: "",
});

assert.equal(
  localePrefix(
    "/en-US/app/splunk-cisco-dashboards/executive_briefing_profile",
  ),
  "/en-US",
);
assert.equal(
  localePrefix(
    "/de-DE/app/splunk-cisco-dashboards/executive_briefing_profile",
  ),
  "/de-DE",
);
assert.equal(localePrefix("/manager/appinstall"), "/en-US");

console.log("✓ executive insights bootstrap update badge tests passed");
