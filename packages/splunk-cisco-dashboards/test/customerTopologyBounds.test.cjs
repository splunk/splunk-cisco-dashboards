"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const packageRoot = path.resolve(__dirname, "..");
const mapSource = fs.readFileSync(path.join(packageRoot,
  "src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx"), "utf8");
assert.match(mapSource, /customer-topology-site-marker > div\s*\{\s*pointer-events: none/);
assert.match(mapSource, /customer-topology-site-marker \.customer-topology-site-label\s*\{\s*pointer-events: auto/);
assert.match(mapSource, /ref=\{hitboxRef\}[\s\S]*?weight: 32/);
assert.match(mapSource, /ref=\{hitboxRef\}\s*className="customer-topology-link-hitbox"/);
assert.match(mapSource, /element\.setAttribute\("tabindex", "0"\)/);
assert.match(mapSource, /element\.setAttribute\("role", "button"\)/);
assert.match(mapSource, /event\.key !== "Enter" && event\.key !== " "/);
assert.match(mapSource, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*onSelect\(link\)/);
assert.match(mapSource, /attachedElement\?\.removeEventListener\("keydown", activate\)/);
assert.match(mapSource, /customer-topology-link-hitbox:focus-visible\s*\{\s*stroke-opacity: 0\.6/);
const modulePath = path.join(
  packageRoot,
  "src/main/webapp/common/lib/customerTopologyBounds.ts",
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
  MAX_CUSTOMER_TOPOLOGY_LINKS,
  MAX_CUSTOMER_TOPOLOGY_SITE_ALIASES,
  MAX_CUSTOMER_TOPOLOGY_SITES,
  hasBoundedCustomerTopology,
} = loadedModule.exports;

assert.equal(
  hasBoundedCustomerTopology({ sites: [], links: [] }),
  true,
  "An empty topology remains a valid bounded configuration",
);
assert.equal(
  hasBoundedCustomerTopology({
    sites: [{}],
    links: [{}],
  }),
  true,
  "Object entries within the configured bounds remain valid",
);
assert.equal(
  hasBoundedCustomerTopology({
    sites: Array.from({ length: MAX_CUSTOMER_TOPOLOGY_SITES + 1 }, () => ({})),
    links: [],
  }),
  false,
  "Oversized site collections must fail before the map starts rendering them",
);
assert.equal(
  hasBoundedCustomerTopology({
    sites: [],
    links: Array.from({ length: MAX_CUSTOMER_TOPOLOGY_LINKS + 1 }, () => ({})),
  }),
  false,
  "Oversized link collections must fail before the map starts rendering them",
);
assert.equal(
  hasBoundedCustomerTopology({
    sites: [{ aliases: Array(MAX_CUSTOMER_TOPOLOGY_SITE_ALIASES + 1).fill("site") }],
    links: [],
  }),
  false,
  "Each site has a bounded alias collection as well",
);
assert.equal(
  hasBoundedCustomerTopology({ sites: [null], links: [] }),
  false,
  "Malformed entries must not reach the renderer",
);
