"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const appRoot = path.resolve(__dirname, "..");

test("application controls and embedded dashboards share the same theme and styling contexts", () => {
  // A direct UI upgrade can leave older transitive theme providers installed.
  // Identical version strings alone do not guarantee shared React contexts.
  for (const context of ["@splunk/themes", "styled-components"]) {
    const application = require.resolve(context, { paths: [appRoot] });
    for (const consumer of [
      "@splunk/react-ui",
      "@splunk/dashboard-core",
      "@splunk/visualizations",
    ]) {
      const manifest = require.resolve(`${consumer}/package.json`, { paths: [appRoot] });
      const embedded = require.resolve(context, { paths: [path.dirname(manifest)] });
      assert.equal(embedded, application, `${consumer} must share the app's ${context}`);
    }
  }
});
