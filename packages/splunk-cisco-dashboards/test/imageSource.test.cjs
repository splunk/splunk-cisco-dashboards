"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const { test } = require("node:test");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const modulePath = path.join(
  packageRoot,
  "src/main/webapp/common/lib/imageSource.ts",
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

const { MAX_SHARED_IMAGE_SOURCE_BYTES, normalizeSharedImageSource } = loadedModule.exports;

for (const safeSource of [
  "data:image/svg+xml;utf8,%3Csvg%2F%3E",
  "data:image/png;base64,iVBORw0KGgo=",
  "/static/app/splunk-cisco-dashboards/icn_view.svg",
]) {
  assert.equal(
    normalizeSharedImageSource(`  ${safeSource}  `),
    safeSource,
    `Supported image source remains available: ${safeSource}`,
  );
}

for (const unsafeSource of [
  "https://example.test/pixel.png",
  "http://127.0.0.1:8080/pixel.png",
  "//example.test/pixel.png",
  "javascript:alert(document.domain)",
  "file:///etc/passwd",
  "data:text/html,<script>alert(1)</script>",
  "/static/app/splunk-cisco-dashboards/../other-app/logo.svg",
  `data:image/png;base64,${"a".repeat(MAX_SHARED_IMAGE_SOURCE_BYTES)}`,
]) {
  assert.equal(
    normalizeSharedImageSource(unsafeSource),
    undefined,
    `Unsafe shared image source must not reach an image sink: ${unsafeSource.slice(0, 80)}`,
  );
}

for (const relativePath of [
  "src/main/webapp/common/services/insightsWorkspaceService.ts",
  "src/main/webapp/common/services/diagramPersistenceService.ts",
  "src/main/webapp/common/components/topology/shapes.tsx",
  "src/main/webapp/common/components/diagram/ShapesTab.tsx",
  "src/main/webapp/pages/executive_insights/index.tsx",
]) {
  const source = fs.readFileSync(path.join(packageRoot, relativePath), "utf8");
  assert.match(
    source,
    /normalizeSharedImageSource/,
    `${relativePath} must apply the shared image-source boundary`,
  );
}

test("diagram persistence removes an unsafe nested custom stencil", async () => {
  const diagramSourcePath = path.join(
    packageRoot,
    "src/main/webapp/common/services/diagramPersistenceService.ts",
  );
  const diagramOutput = ts.transpileModule(
    fs.readFileSync(diagramSourcePath, "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: diagramSourcePath,
    },
  ).outputText;
  const diagramModule = { exports: {} };
  const diagramRequire = (specifier) => {
    if (specifier === "../lib/imageSource") return loadedModule.exports;
    if (specifier === "./splunkSearchService") {
      return { getSearchAppContext: () => "splunk-cisco-dashboards" };
    }
    return require(specifier);
  };
  new Function(
    "exports",
    "module",
    "require",
    "__filename",
    "__dirname",
    diagramOutput,
  )(
    diagramModule.exports,
    diagramModule,
    diagramRequire,
    diagramSourcePath,
    path.dirname(diagramSourcePath),
  );

  const { loadDiagram, saveDiagram } = diagramModule.exports;
  await saveDiagram("Unsafe stencil", {
    version: 1,
    nodes: [
      {
        id: "unsafe-stencil-node",
        type: "device:custom_stencil",
        x: 0,
        y: 0,
        customStencil: {
          id: "unsafe-stencil",
          label: "Unsafe stencil",
          src: "https://example.test/tracker.png",
          mediaType: "image/png",
        },
      },
    ],
    edges: [],
    groups: [],
  });
  const saved = await loadDiagram("Unsafe stencil");
  assert.equal(
    saved.nodes[0].customStencil,
    undefined,
    "Persisted diagram nodes must not retain a network-backed stencil source",
  );
});
