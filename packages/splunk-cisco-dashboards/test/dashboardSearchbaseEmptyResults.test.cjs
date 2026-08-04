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
const dataSource = fs.readFileSync(dataSourcePath, "utf8");
const editor = fs.readFileSync(editorPath, "utf8");
const secureNetworkingViews = fs
    .readdirSync(viewsRoot)
    .filter((name) => /^secure_networking_.*\.xml$/.test(name));

assert.ok(secureNetworkingViews.length > 0, "Secure Networking dashboards must exist");

const searchbaseRefs = new Set();
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
});

assert.ok(searchbaseRefs.size > 0, "Secure Networking dashboards must use Searchbase searches");
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
    `✓ Reviewed ${secureNetworkingViews.length} Secure Networking dashboards and ${searchbaseRefs.size} Searchbase searches for contextual empty-result handling`,
);
