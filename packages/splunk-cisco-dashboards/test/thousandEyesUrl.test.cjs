"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const modulePath = path.join(
  packageRoot,
  "src/main/webapp/common/lib/thousandEyesUrl.ts",
);
const output = ts.transpileModule(fs.readFileSync(modulePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: modulePath,
}).outputText;
const loadedModule = { exports: {} };
new Function(
  "exports",
  "module",
  "require",
  "__filename",
  "__dirname",
  output,
)(
  loadedModule.exports,
  loadedModule,
  require,
  modulePath,
  path.dirname(modulePath),
);

const {
  buildThousandEyesTestLink,
  normalizeThousandEyesLink,
} = loadedModule.exports;

assert.equal(
  normalizeThousandEyesLink(
    "https://app.thousandeyes.com/network-app-synthetics/views/?testId=42",
  ),
  "https://app.thousandeyes.com/network-app-synthetics/views/?testId=42",
  "A canonical ThousandEyes permalink remains available",
);
assert.equal(
  normalizeThousandEyesLink("https://app.thousandeyes.com"),
  "https://app.thousandeyes.com/",
  "The app origin is normalized before it reaches an href sink",
);

for (const unsafeUrl of [
  "javascript:alert(document.domain)",
  "data:text/html,<script>alert(1)</script>",
  "http://app.thousandeyes.com/",
  "https://app.thousandeyes.com.attacker.example/",
  "/network-app-synthetics/views/?testId=42",
]) {
  assert.equal(
    normalizeThousandEyesLink(unsafeUrl),
    undefined,
    `Unsafe telemetry URL must not reach an external-link sink: ${unsafeUrl}`,
  );
}

assert.equal(
  buildThousandEyesTestLink("test id&other=1"),
  "https://app.thousandeyes.com/network-app-synthetics/views/?testId=test%20id%26other%3D1",
  "Generated ThousandEyes links encode the dynamic test ID",
);

const topologySource = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx",
  ),
  "utf8",
);
assert.match(
  topologySource,
  /normalizeThousandEyesLink\(\s*boundTeMatch\?\.candidate\.teLink \?\? link\.teLink,?\s*\)/,
  "The editor's telemetry-derived href is protected at the rendering boundary",
);
assert.match(
  topologySource,
  /normalizeThousandEyesLink\(link\.teLink\)/,
  "Persisted topology links are protected at the details rendering boundary",
);
