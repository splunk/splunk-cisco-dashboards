"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const webapp = path.join(root, "src/main/webapp");

function load(relative, dependencies = {}, globals = {}) {
    const source = fs.readFileSync(path.join(webapp, relative), "utf8");
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    const module = { exports: {} };
    new Function("module", "exports", "require", ...Object.keys(globals), outputText)(
        module, module.exports, (name) => {
            assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
            return dependencies[name];
        }, ...Object.values(globals)
    );
    return module.exports;
}

const workspaceConfig = load("common/config/insightsWorkspaces.ts");
const signalConfig = load("common/config/signalTicker.ts");
const workspaces = workspaceConfig.PACKAGED_WORKSPACE_FALLBACKS;
const app = "splunk-cisco-dashboards";
const fetchUtils = { createFetchInit: (init) => init };
const runtime = { __SPLUNK_RUNTIME__: true, $C: { USERNAME: "fixture-user" } };

function buildSearchbaseFixture() {
    const body = fs.readFileSync(
        path.join(root, "src/main/resources/splunk/default/searchbase.conf"), "utf8"
    );
    const packaged = {};
    const entries = body.split(/^\[([^\]]+)\]$/m).slice(1).reduce((rows, value, index, parts) => {
        if (index % 2) return rows;
        const raw = parts[index + 1].match(/^viz_options\s*=\s*(.+)$/m)?.[1];
        if (!raw?.includes('"overview"')) return rows;
        const options = JSON.parse(raw);
        packaged[value] = options.overview;
        rows.set(value, { name: value, acl: { app }, content: { viz_options: raw } });
        return rows;
    }, new Map());
    return { packaged, entries };
}

for (const workspace of workspaces) {
    test(`factory reset restores moved tiles in ${workspace.id} and preserves unrelated settings`, async () => {
        const { packaged, entries } = buildSearchbaseFixture();
        const sections = new Set(workspace.sections.map(({ id }) => id));
        const [owner, definitions] = Object.entries(packaged).find(([, raw]) =>
            [raw].flat().some((definition) =>
                (definition.workspace ?? definition.profile ?? "executive") === workspace.sourceWorkspace &&
                sections.has(definition.section)
            )
        );
        const shipped = [definitions].flat();
        const moved = shipped.find((definition) =>
            (definition.workspace ?? definition.profile ?? "executive") === workspace.sourceWorkspace &&
            sections.has(definition.section)
        );
        const ownerOptions = JSON.parse(entries.get(owner).content.viz_options);
        ownerOptions.overview = shipped.filter((definition) => definition !== moved);
        ownerOptions.mapFooter = { label: "Keep map settings" };
        entries.get(owner).content.viz_options = JSON.stringify(ownerOptions);
        const otherWorkspace = { workspace: "another", section: "unrelated", tileId: "keep_other" };
        entries.set("rebind_target", { name: "rebind_target", acl: { app }, content: {
            viz_options: JSON.stringify({
                overview: [{ ...moved, label: "Changed mapping" }, otherWorkspace],
                seriesColors: ["#ffffff"],
            }),
            search: "| makeresults",
            drilldown_searches: "shared_drilldown",
        } });
        const writes = [];
        const cleanups = [];
        const service = load("common/services/searchbaseTileConfigService.ts", {
            "@splunk/splunk-utils/fetch": fetchUtils,
            "./splunkSearchService": { getSearchAppContext: () => app },
            "./searchbaseCatalogue": { clearSearchbaseCache: () => {} },
            "@/common/config/insightsWorkspaces": workspaceConfig,
        }, {
            window: runtime,
            __PACKAGED_OVERVIEW_DEFINITIONS__: packaged,
            fetch: async (url, init) => {
                if (init.method === "GET") return Response.json({ entry: [...entries.values()] });
                assert.equal(init.method, "POST");
                const name = url.split("/").at(-1);
                const fields = new URLSearchParams(init.body);
                if (name === "searchbase_viz_cleanup") {
                    cleanups.push(JSON.parse(fields.get("stanzas")));
                    return new Response(null, { status: 200 });
                }
                assert.deepEqual([...fields.keys()].sort(), ["output_mode", "viz_options"]);
                writes.push(name);
                entries.get(name).content.viz_options = fields.get("viz_options");
                return new Response(null, { status: 200 });
            },
        });

        await service.resetInsightsWorkspaceTileConfig(workspace);
        assert.deepEqual(writes, [owner, "rebind_target"]);
        assert.ok(cleanups[0].includes(owner));
        assert.ok(cleanups[0].includes("rebind_target"));
        const restored = JSON.parse(entries.get(owner).content.viz_options);
        assert.ok(restored.overview.some((definition) => definition.tileId === moved.tileId));
        assert.deepEqual(restored.mapFooter, ownerOptions.mapFooter);
        const rebound = entries.get("rebind_target").content;
        assert.deepEqual(JSON.parse(rebound.viz_options), {
            overview: [otherWorkspace], seriesColors: ["#ffffff"],
        });
        assert.equal(rebound.drilldown_searches, "shared_drilldown");
        assert.equal(rebound.search, "| makeresults");

        await service.resetInsightsWorkspaceTileConfig(workspace);
        assert.equal(writes.length, 2, "a repeated reset does not rewrite Searchbase");
        assert.ok(cleanups[1].includes(owner), "a repeat can remove older redundant local copies");
        entries.delete(owner);
        await assert.rejects(
            service.resetInsightsWorkspaceTileConfig(workspace),
            /Packaged Searchbase stanza .* is unavailable/
        );
        assert.equal(writes.length, 2, "a failed preflight sends no writes");
    });
}

test("workspace reset removes removed sections and retains Signal Rail items referenced elsewhere", async () => {
    const workspace = workspaces.find(({ id }) => id === "agentic_security_operations_center");
    const [shared, exclusive] = signalConfig.getDefaultSignalTickerConfig(workspace.id).items;
    const entries = [
        { name: `layout.${workspace.id}.former_section` },
        { name: "layout.executive.it_health" },
        { name: "signal_rail.custom_workspace", content: { items: shared.id } },
    ];
    const deletes = [];
    const { resetBuiltInInsightsWorkspace } = load("common/services/insightsWorkspaceService.ts", {
        "@/common/config/workspaceVisualizations": {},
        "@splunk/splunk-utils/fetch": fetchUtils,
        "@/common/config/insightsWorkspaces": workspaceConfig,
        "@/common/config/signalTicker": signalConfig,
        "@/common/lib/imageSource": {},
    }, {
        window: runtime,
        fetch: async (url, init) => {
            if (init.method === "GET") return Response.json({ entry: entries });
            assert.equal(init.method, "DELETE");
            deletes.push(url.split("/").at(-1).split("?")[0]);
            return new Response(null, { status: 404 });
        },
    });
    await resetBuiltInInsightsWorkspace(workspace);
    for (const { id } of workspace.sections) {
        assert.ok(deletes.includes(`layout.${workspace.id}.${id}`));
    }
    assert.ok(deletes.includes(`layout.${workspace.id}.former_section`));
    assert.ok(deletes.includes(`signal_rail.${workspace.id}`));
    assert.ok(deletes.includes(`signal_item.${exclusive.id}`));
    assert.ok(deletes.includes(`workspace.${workspace.id}`));
    assert.ok(!deletes.includes(`signal_item.${shared.id}`));
    assert.ok(!deletes.includes("layout.executive.it_health"));
    assert.ok(!deletes.includes("signal_rail.custom_workspace"));
    await assert.rejects(resetBuiltInInsightsWorkspace({ id: "custom_workspace" }), /Only built-in/);
});
