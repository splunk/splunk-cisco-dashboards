"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const viewsRoot = path.join(
    packageRoot,
    "src/main/resources/splunk/default/data/ui/views",
);
const dataSourcePath = path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/SearchBaseDataSource.jsx",
);
const editorPath = path.join(
    packageRoot,
    "src/main/webapp/pages/dashboardbuilder/DashboardStudioEditor.jsx",
);
const searchbasePath = path.join(
    packageRoot,
    "src/main/resources/splunk/default/searchbase.conf",
);
const dataSource = fs.readFileSync(dataSourcePath, "utf8");
const editor = fs.readFileSync(editorPath, "utf8");
const searchbase = fs.readFileSync(searchbasePath, "utf8");
const intentionalDataGapRefs = new Set([
    "secure_networking_assurance_score_trend",
    "secure_networking_assurance_attainability_trend",
    "secure_networking_assurance_retainability_trend",
    "secure_networking_assurance_quality_trend",
    "secure_networking_assurance_contextual_risk_trend",
]);
const secureNetworkingViews = fs
    .readdirSync(viewsRoot)
    .filter((name) => /^sn_.*\.xml$/.test(name));

assert.ok(secureNetworkingViews.length > 0, "Secure Networking dashboards must exist");

const searchbaseRefs = new Set();
const singleValueBindings = new Map();
secureNetworkingViews.forEach((name) => {
    const xml = fs.readFileSync(path.join(viewsRoot, name), "utf8");
    const definition = xml.match(/<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/);

    if (!definition) {
        return;
    }

    const dashboard = JSON.parse(definition[1]);
    Object.values(dashboard.dataSources || {}).forEach((dataSourceDefinition) => {
        if (dataSourceDefinition?.type === "ds.searchbase") {
            assert.ok(
                dataSourceDefinition.options?.ref,
                `${name} must name every Searchbase data source`,
            );
            searchbaseRefs.add(dataSourceDefinition.options.ref);
        }
    });
    Object.values(dashboard.visualizations || {}).forEach((visualization) => {
        if (!String(visualization?.type || "").startsWith("splunk.singlevalue")) {
            return;
        }
        const dataSourceId = Object.values(visualization.dataSources || {})[0];
        const ref = dashboard.dataSources?.[dataSourceId]?.options?.ref;
        if (!ref) {
            return;
        }
        const optionText = JSON.stringify(visualization.options || {});
        const bindings = optionText.matchAll(/seriesByName\('([^']+)'\)/g);
        if (!singleValueBindings.has(ref)) {
            singleValueBindings.set(ref, new Set());
        }
        Array.from(bindings).forEach((match) => singleValueBindings.get(ref).add(match[1]));
    });
});

assert.ok(searchbaseRefs.size > 0, "Secure Networking dashboards must use Searchbase searches");
searchbaseRefs.forEach((ref) => {
    const marker = `[${ref}]`;
    const start = searchbase.indexOf(marker);
    assert.notEqual(start, -1, `${ref} must exist in searchbase.conf`);
    const next = searchbase.indexOf("\n[", start + marker.length);
    const stanza = searchbase.slice(start, next === -1 ? searchbase.length : next);
    if (intentionalDataGapRefs.has(ref)) {
        assert.doesNotMatch(
            stanza,
            /\|\s*appendpipe\b|^search\s*=\s*\|\s*makeresults\b/m,
            `${ref} must expose missing required telemetry as a data gap`,
        );
        return;
    }
    assert.match(
        stanza,
        /\|\s*appendpipe\b|^search\s*=\s*\|\s*makeresults\b/m,
        `${ref} must return a typed fallback row when its primary search is empty`,
    );
    const fallback = stanza.match(/\|\s*appendpipe\b[\s\S]*$/)?.[0] || stanza;
    (singleValueBindings.get(ref) || []).forEach((field) => {
        assert.ok(
            fallback.includes(field),
            `${ref} must preserve the Studio single-value binding ${field} in its fallback`,
        );
    });
});
assert.match(
    dataSource,
    /const getEmptyResultMessage = \(content = \{\}, ref = ''\)/,
    "Searchbase data sources must derive a contextual empty-result message",
);
assert.match(
    dataSource,
    /emptyResultMessage \|\| _\('Search ran successfully, but no results were returned'\)/,
    "Empty result messages must replace the generic empty-result status",
);
assert.match(
    dataSource,
    /this\.emptyResultMessage = getEmptyResultMessage\(content, this\.options\.ref\)/,
    "Each Searchbase stanza must supply context for its empty-result message",
);
assert.match(
    editor,
    /No matching telemetry was found in the selected time range/,
    "Dashboard Studio must replace its generic empty-result copy with actionable guidance",
);

console.log(
    `✓ Reviewed ${secureNetworkingViews.length} Secure Networking dashboards and ${searchbaseRefs.size} Searchbase searches for query-level and renderer-level empty-result handling`,
);
