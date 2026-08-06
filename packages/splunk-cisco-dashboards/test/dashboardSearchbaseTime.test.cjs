"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const helperPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/dashboardbuilder/dashboardTimeUtils.js",
);
const helperSource = fs
  .readFileSync(helperPath, "utf8")
  .replaceAll("export const ", "const ");
const helperModule = { exports: {} };

new Function(
  "module",
  `${helperSource}\nmodule.exports = { getDashboardTimeQueryParameters, repairSearchbaseTimeQueryParameters };`,
)(helperModule);

const { getDashboardTimeQueryParameters, repairSearchbaseTimeQueryParameters } =
  helperModule.exports;

const timeTokDefinition = {
  inputs: {
    input_time_range: {
      type: "input.timerange",
      options: { token: "time_tok" },
    },
  },
  layout: { globalInputs: ["input_time_range"] },
  dataSources: {
    searchbase: {
      type: "ds.searchbase",
      options: {
        queryParameters: {
          earliest: "$global_time.earliest$",
          latest: "$global_time.latest$",
        },
      },
    },
  },
};

assert.deepEqual(getDashboardTimeQueryParameters(timeTokDefinition), {
  earliest: "$time_tok.earliest$",
  latest: "$time_tok.latest$",
});

const repaired = repairSearchbaseTimeQueryParameters(timeTokDefinition);
assert.notEqual(repaired, timeTokDefinition);
assert.deepEqual(repaired.dataSources.searchbase.options.queryParameters, {
  earliest: "$time_tok.earliest$",
  latest: "$time_tok.latest$",
});

const defaultDefinition = {
  inputs: {
    input_global_trp: {
      type: "input.timerange",
      options: { token: "global_time" },
    },
  },
};

assert.deepEqual(getDashboardTimeQueryParameters(defaultDefinition), {
  earliest: "$global_time.earliest$",
  latest: "$global_time.latest$",
});

console.log("✓ Searchbase dashboard time-token regression test passed");
