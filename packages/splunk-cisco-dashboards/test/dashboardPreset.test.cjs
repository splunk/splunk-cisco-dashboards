"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const babel = require("@babel/core");
const React = require("react");
const Ajv = require("ajv");
const { createSchemaBasedOnPresets } = require("@splunk/dashboard-definition/DashboardSchema");
const { networkGraphOptionsSchema } = require("@splunk/visualization-schemas");

const pageRoot = path.resolve(__dirname, "../src/main/webapp/pages/dashboardbuilder");
const compiled = babel.transformSync(fs.readFileSync(path.join(pageRoot, "dashboardPreset.js"), "utf8"), {
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;

function loadPreset(optionsSchema = networkGraphOptionsSchema) {
  const NetworkGraph = (props) => React.createElement("div", props);
  NetworkGraph.config = { key: "splunk.networkGraph", optionsSchema, editorConfig: { marker: true } };
  NetworkGraph.defaultProps = { testDefault: true };
  const upstream = { visualizations: { "splunk.networkGraph": NetworkGraph, other: () => null }, inputs: {} };
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) {${compiled}\n})`)((id) => {
    if (id === "react") return React;
    if (id === "@splunk/dashboard-presets/EnterprisePreset") return { __esModule: true, default: upstream };
    throw new Error(`Unexpected import ${id}`);
  }, module, module.exports);
  return { ...module.exports, upstream };
}

function compile(preset, { allowTokenCoercion = false, serialized = false } = {}) {
  const warnings = [];
  let schema = createSchemaBasedOnPresets(preset, { allowTokenCoercion });
  // The worker receives a serialized schema rather than component functions.
  if (serialized) schema = JSON.parse(JSON.stringify(schema));
  const ajv = new Ajv({
    strictTypes: true,
    allowUnionTypes: true,
    allowMatchingProperties: true,
    keywords: [{ keyword: "skipTokenSupport", schemaType: "boolean" }],
    logger: { log() {}, warn(message) { warnings.push(message); }, error(message) { warnings.push(message); } },
  });
  const validate = ajv.compile(schema);
  assert.deepEqual(warnings, []);
  return validate;
}

const definition = (options) => ({
  visualizations: { graph: { type: "splunk.networkGraph", options } },
  defaults: { visualizations: { "splunk.networkGraph": { options } } },
});

test("repairs vendor literal types without changing the shared schema, renderer, or other preset entries", () => {
  const before = JSON.stringify(networkGraphOptionsSchema);
  const { default: preset, upstream } = loadPreset();
  const graph = preset.visualizations["splunk.networkGraph"];
  const original = upstream.visualizations["splunk.networkGraph"];
  const schema = graph.config.optionsSchema;
  assert.equal(schema.hierarchyDirection.anyOf[0].type, "string");
  assert.equal(schema.linkStrength.anyOf[0].type, "number");
  assert.equal(schema.hierarchyDirection.anyOf[1], networkGraphOptionsSchema.hierarchyDirection.anyOf[1]);
  assert.equal(schema.linkStrength.anyOf[1], networkGraphOptionsSchema.linkStrength.anyOf[1]);
  assert.equal(graph.config.editorConfig, original.config.editorConfig);
  assert.equal(graph.defaultProps, original.defaultProps);
  assert.equal(preset.visualizations.other, upstream.visualizations.other);
  assert.equal(preset.inputs, upstream.inputs);
  const rendered = graph({ label: "graph" });
  assert.equal(rendered.type, original);
  assert.equal(rendered.props.label, "graph");
  assert.equal(JSON.stringify(networkGraphOptionsSchema), before);
});

test("compiles editor and serialized worker schemas with strict types and accepts supported values", () => {
  const { default: preset } = loadPreset();
  for (const serialized of [false, true]) {
    const validate = compile(preset, { serialized });
    for (const hierarchyDirection of ["topBottom", "bottomTop", "leftRight", "rightLeft", "$direction$", "> primary | seriesByName('direction')"]) {
      for (const linkStrength of [0, 0.5, 1, "> primary | seriesByName('strength')"]) {
        assert.equal(validate(definition({ hierarchyDirection, linkStrength })), true, JSON.stringify(validate.errors));
      }
    }
    assert.equal(validate(definition({})), true);
  }
});

test("continues rejecting invalid directions, invalid types, and out-of-range strengths", () => {
  const { default: preset } = loadPreset();
  const validate = compile(preset);
  for (const options of [
    { hierarchyDirection: "diagonal" }, { hierarchyDirection: 1 }, { hierarchyDirection: false },
    { linkStrength: -0.01 }, { linkStrength: 1.01 }, { linkStrength: true }, { linkStrength: "invalid" },
  ]) assert.equal(validate(definition(options)), false, JSON.stringify(options));
});

test("retains numeric token support when Studio enables token coercion", () => {
  const { default: preset } = loadPreset();
  const validate = compile(preset, { allowTokenCoercion: true, serialized: true });
  assert.equal(validate(definition({ hierarchyDirection: "$direction$", linkStrength: "$strength$" })), true, JSON.stringify(validate.errors));
});

test("leaves absent and already corrected vendor schemas unchanged", () => {
  const { default: preset, withNetworkGraphSchemaTypes, normalizeNetworkGraphSchema } = loadPreset();
  assert.equal(withNetworkGraphSchemaTypes(preset), preset);
  const empty = { visualizations: {} };
  assert.equal(withNetworkGraphSchemaTypes(empty), empty);
  assert.equal(normalizeNetworkGraphSchema(undefined), undefined);
});

test("library previews and direct editor routes both use the corrected preset", () => {
  for (const name of ["index.jsx", "DBHomePage.jsx"]) {
    const source = fs.readFileSync(path.join(pageRoot, name), "utf8");
    assert.match(source, /import EnterprisePreset from ["']\.\/dashboardPreset["']/);
    assert.doesNotMatch(source, /from ["']@splunk\/dashboard-presets\/EnterprisePreset["']/);
  }
});
