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
const compiledFrame = babel.transformSync(fs.readFileSync(path.join(pageRoot, "VisualizationFrame.jsx"), "utf8"), {
  presets: ["@babel/preset-react"],
  plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;

function loadFrame(react = React, ResizeObserver) {
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) {${compiledFrame}\n})`, { ResizeObserver })((id) => {
    if (id === "react") return react;
    if (id === "./sparseVisualizationOptions") return { sparseVisualizationOptions: (_type, props) => props.options, chartDataSources: (_type, sources) => sources };
    throw new Error(`Unexpected import ${id}`);
  }, module, module.exports);
  return module.exports;
}

function loadPreset(optionsSchema = networkGraphOptionsSchema) {
  const NetworkGraph = (props) => React.createElement("div", props);
  NetworkGraph.config = { key: "splunk.networkGraph", optionsSchema, editorConfig: { marker: true } };
  NetworkGraph.defaultProps = { testDefault: true };
  const upstream = { visualizations: { "splunk.networkGraph": NetworkGraph, other: () => null }, inputs: {} };
  const module = { exports: {} };
  vm.runInNewContext(`(function(require, module, exports) {${compiled}\n})`)((id) => {
    if (id === "react") return React;
    if (id === "./VisualizationFrame") return loadFrame();
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
  const { withNetworkGraphSchemaTypes, upstream } = loadPreset();
  const preset = withNetworkGraphSchemaTypes(upstream);
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

test("sizes each renderer to its panel without losing its configuration or event callbacks", () => {
  const { default: preset, upstream } = loadPreset();
  for (const [name, Original] of Object.entries(upstream.visualizations)) {
    const Wrapped = preset.visualizations[name];
    const options = { test: true };
    const onEventTrigger = () => {};
    const rendered = Wrapped({ width: 634, height: 212, options, onEventTrigger });
    assert.equal(rendered.props.width, 634);
    assert.equal(rendered.props.options, options);
    assert.equal(rendered.props.onEventTrigger, onEventTrigger);
    assert.equal(Wrapped.defaultProps, Original.defaultProps);
    if (name !== "splunk.networkGraph") {
      assert.equal(Wrapped.config, Original.config);
      assert.equal(rendered.props.component, Original);
    }
  }
});

test("wrapped headers reduce renderer height and resizing uses unscaled dimensions", () => {
  let size = null;
  let effect;
  let resize;
  let disconnected = false;
  const frame = { clientWidth: 634, clientHeight: 188 };
  const react = {
    ...React,
    useRef: () => ({ current: frame }),
    useState: () => [size, (update) => { size = update(size); }],
    useLayoutEffect: (callback) => { effect = callback; },
  };
  class Observer {
    constructor(callback) { resize = callback; }
    observe(element) { assert.equal(element, frame); }
    disconnect() { disconnected = true; }
  }
  const { default: Frame } = loadFrame(react, Observer);
  const component = () => null;
  const onEventTrigger = () => {};
  const onRequestHeight = () => {};
  const props = { component, width: 634, height: 212, onEventTrigger, onRequestHeight };
  Frame(props);
  const cleanup = effect();
  let rendered = Frame(props).props.children;
  assert.equal(rendered.type, component);
  assert.equal(rendered.props.width, 634);
  assert.equal(rendered.props.height, 188, "Wrapped description must not consume the 24px row gap");
  assert.equal(rendered.props.onEventTrigger, onEventTrigger);
  assert.equal(rendered.props.onRequestHeight, onRequestHeight);
  resize([{ contentRect: { width: 560.5, height: 168.25 } }]);
  rendered = Frame(props).props.children;
  assert.equal(rendered.props.width, 560.5);
  assert.equal(rendered.props.height, 168.25);
  const prior = size;
  resize([{ contentRect: { width: 560.5, height: 168.25 } }]);
  assert.equal(size, prior, "Unchanged observations must not trigger render loops");
  resize([{ contentRect: { width: 0, height: 0 } }]);
  assert.equal(size, prior, "Hidden tabs should keep their last valid render size");
  cleanup();
  assert.equal(disconnected, true);
});

const sparseModule = { exports: {} };
const sparseCode = babel.transformSync(fs.readFileSync(path.join(pageRoot, 'sparseVisualizationOptions.js'), 'utf8'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
vm.runInThisContext(`(function(require,module,exports){${sparseCode}\n})`)(require, sparseModule, sparseModule.exports);
const sparseVisualizationOptions = (type, props) => sparseModule.exports.sparseVisualizationOptions(type, props, require('@splunk/visualization-schemas').singleValueOptionsSchema);
const sparseProps = (values, extra = {}) => ({
  options: { sparklineValues: '> primary | seriesByName("value")', trendValue: '> sparklineValues | delta(-2)',
    trendColor: '> trendValue | rangeValue(colors)', y: '> primary | seriesByName("value")', ...extra },
  context: { colors: [{ from: 0, value: 'green' }] },
  dataSources: { primary: { data: { fields: [{ name: 'value' }], columns: [values] } } },
});
test('sparse trends are unavailable before color evaluation, preserving headline and input', () => {
  for (const values of [[], [0], [null], [1, null], [NaN, 2]]) {
    const props = sparseProps(values, { majorValue: 42 });
    const result = sparseVisualizationOptions('splunk.singlevalue', props);
    assert.equal(result.trendDisplay, 'off');
    assert.equal(result.showTrendIndicator, false);
    assert.equal(result.trendValue, '');
    assert.equal(result.trendColor, null);
    assert.equal(result.majorValue, 42);
    assert.equal(props.options.trendValue, '> sparklineValues | delta(-2)');
  }
  for (const values of [[0, 0], [-2, 3], [4, 1]]) {
    const props = sparseProps(values);
    assert.equal(sparseVisualizationOptions('splunk.singlevalue', props), props.options);
  }
});
test('constant chart series get finite nondegenerate axes without changing data or explicit bounds', () => {
  for (const values of [[0], [0, 0], [-4], [100, 100]]) {
    const props = sparseProps(values);
    const result = sparseVisualizationOptions('splunk.line', props);
    assert.ok(Number.isFinite(result.yAxisMin) && Number.isFinite(result.yAxisMax));
    assert.ok(result.yAxisMin < result.yAxisMax);
    assert.ok(result.yAxisMin <= values[0] && result.yAxisMax >= values[0]);
    assert.equal(props.dataSources.primary.data.columns[0], values);
  }
  for (const values of [[1, 3]]) {
    const props = sparseProps(values);
    assert.equal(sparseVisualizationOptions('splunk.line', props), props.options);
  }
  const explicit = sparseProps([0], { yAxisMin: -10, yAxisMax: 10 });
  assert.equal(sparseVisualizationOptions('splunk.line', explicit), explicit.options);
});
test('preserves logarithmic axes, dependent option aliases and overflow domains', () => {
  for (const options of [{ yAxisScale: 'log' }, { y: '> customY' }]) {
    const props = sparseProps([0.1], options);
    assert.equal(sparseVisualizationOptions('splunk.line', props), props.options);
  }
  const alias = sparseProps([1], { sparklineValues: '> customSeries' });
  assert.equal(sparseVisualizationOptions('splunk.singlevalue', alias), alias.options);
  const extreme = sparseProps([Number.MAX_VALUE]);
  assert.equal(sparseVisualizationOptions('splunk.line', extreme), extreme.options);
});
test('guards inherited trends on timestamp-only and null results without changing headline semantics', () => {
  for (const [type, values] of [['time', [1, 2]], ['null', [null]], ['number', [4]]]) {
    const props = { options: {}, dataSources: { primary: { data: {fields:[{name:type === 'time' ? '_time' : 'value',type}],columns:[values]} } } };
    const result = sparseVisualizationOptions('splunk.singlevalue', props);
    assert.equal(result.trendDisplay, 'off');
    assert.equal(result.majorValue, undefined);
  }
  const props = { options: {}, dataSources:{primary:{data:{fields:[{name:'value',type:'number'}],columns:[[1,2]]}}} };
  assert.equal(sparseVisualizationOptions('splunk.singlevalue', props),props.options);
});
test('removes only rows with invalid time coordinates for charts and preserves table records', () => {
  const sources={primary:{data:{fields:[{name:'_time'},{name:'value'}],columns:[[null,0,123,'2026-10-22T12:00:00Z','bad'],[9,0,4,7,8]]}}};
  const {chartDataSources}=sparseModule.exports;
  assert.equal(chartDataSources('splunk.table',sources),sources);
  assert.equal(chartDataSources('splunk.bar',sources,{x:'> primary | seriesByName("value")'}),sources);
  const result=chartDataSources('splunk.line',sources,{x:'> primary | seriesByName("_time")'});
  assert.deepEqual(result.primary.data.columns[0],[0,123,'2026-10-22T12:00:00Z']);
  assert.deepEqual(result.primary.data.columns[1],[0,4,7]);
  assert.equal(sources.primary.data.columns[0].length,5);
});
test('default Y selectors and empty numeric domains get finite axes without fabricating points', () => {
  const schema=require('@splunk/visualization-schemas').lineOptionsSchema;
  for(const values of [[],[null],[0],[0,0]]) {
    const props=sparseProps(values);delete props.options.y;
    const result=sparseModule.exports.sparseVisualizationOptions('splunk.line',props,schema);
    assert.equal(result.yAxisMin,0);assert.equal(result.yAxisMax,1);
    assert.equal(props.dataSources.primary.data.columns[0],values);
  }
});
