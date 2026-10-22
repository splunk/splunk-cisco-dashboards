"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const bundle = fs.readFileSync(require.resolve("@splunk/charting-bundle"), "utf8");
// Exercise both independent logger modules shipped inside the vendor bundle.
const loggers = [...bundle.matchAll(/var n = window\.console;[\s\S]*?e\.default = \{[\s\S]*?\n\s*\};/g)];

test("chart debug output requires explicit diagnostics; other log levels stay visible", () => {
  assert.equal(loggers.length, 2);
  for (const [source] of loggers) {
    const calls = [];
    const console = Object.fromEntries(["debug", "info", "warn", "error", "log", "trace"].map((level) => [level, function(...args) {
      assert.equal(this, console);
      calls.push([level, ...args]);
    }]));
    const window = { console, location: { search: "" } };
    const e = {};
    vm.runInNewContext(source, { window, e, URLSearchParams });
    for (const search of ["", "?canvasDebug=0", "?canvasDebug=true", "?other=1"]) {
      window.location.search = search;
      e.debug("chart data");
    }
    assert.deepEqual(calls, []);
    for (const level of ["warn", "error", "info", "log", "trace"]) e[level]("retained");
    assert.deepEqual(calls, ["warn", "error", "info", "log", "trace"].map((level) => [level, "retained"]));
    window.location.search = "?other=1&canvasDebug=1";
    const payload = { series: [1, 2] };
    e.debug("chart data", payload);
    assert.deepEqual(calls.at(-1), ["debug", "chart data", payload]);
    window.location.search = "";
    e.debug("quiet again");
    assert.equal(calls.length, 6);
    // A consumer-provided logging console retains the same diagnostic gate.
    const custom = [];
    e.setLoggingConsole({ debug: (...args) => custom.push(args) });
    e.debug("quiet");
    window.location.search = "?canvasDebug=1";
    e.debug("enabled");
    assert.deepEqual(custom, [["enabled"]]);
    assert.equal(window.console, console);
  }
});
