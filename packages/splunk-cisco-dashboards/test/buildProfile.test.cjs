"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  applyBuildProfile,
  readManifest,
  validateManifest,
} = require("../bin/apply_build_profile.js");

const packageRoot = path.resolve(__dirname, "..");
const sourceAppRoot = path.join(
  packageRoot,
  "src",
  "main",
  "resources",
  "splunk",
);
const sourceViewsDir = path.join(
  sourceAppRoot,
  "default",
  "data",
  "ui",
  "views",
);
const sourceNavPath = path.join(
  sourceAppRoot,
  "default",
  "data",
  "ui",
  "nav",
  "default.xml",
);
const sourceSearchbasePath = path.join(
  sourceAppRoot,
  "default",
  "searchbase.conf",
);
const sourceSavedSearchesPath = path.join(
  sourceAppRoot,
  "default",
  "savedsearches.conf",
);
const retiredSearchbaseBackupPath = path.join(
  sourceAppRoot,
  "default",
  "searchbase.bak",
);
const rootBuildScript = fs.readFileSync(
  path.resolve(packageRoot, "..", "..", "build.sh"),
  "utf8",
);
const packageScript = fs.readFileSync(
  path.join(packageRoot, "bin", "package_app.sh"),
  "utf8",
);

function escapeRegExp(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function parseStanzaIds(source) {
  return [...source.matchAll(/^\[([^\]\r\n]+)\][ \t]*(?:\r?\n|$)/gm)].map(
    (match) => match[1],
  );
}

function assertStanzaPresence(source, ids, expected, label) {
  for (const id of ids) {
    assert.equal(
      new RegExp(`^\\[${escapeRegExp(id)}\\]$`, "m").test(source),
      expected,
      `${label}: ${id}`,
    );
  }
}

function makeStagedApp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "scd-build-profile-"));
  const appRoot = path.join(tempRoot, "splunk-cisco-dashboards");
  fs.cpSync(sourceAppRoot, appRoot, { recursive: true });
  return { appRoot, tempRoot };
}

const sourceNav = fs.readFileSync(sourceNavPath, "utf8");
const sourceSearchbase = fs.readFileSync(sourceSearchbasePath, "utf8");
const sourceSavedSearches = fs.readFileSync(sourceSavedSearchesPath, "utf8");
const sourceViewIds = fs
  .readdirSync(sourceViewsDir)
  .filter((name) => name.endsWith(".xml"))
  .map((name) => path.basename(name, ".xml"));
const sourceSearchbaseIds = parseStanzaIds(sourceSearchbase);
const sourceSavedSearchIds = parseStanzaIds(sourceSavedSearches);

const manifest = validateManifest(readManifest());
assert.match(rootBuildScript, /--developer/);
assert.match(packageScript, /apply_build_profile\.js/);
assert.equal(
  fs.existsSync(retiredSearchbaseBackupPath),
  false,
  "searchbase.bak must not return after migration to the build manifest",
);

const staleManifest = JSON.parse(JSON.stringify(manifest));
staleManifest.developing.searchbaseStanzas.push("search_that_does_not_exist");
assert.throws(
  () => validateManifest(staleManifest),
  /Developing Searchbase stanza manifest is out of sync.*search_that_does_not_exist/,
  "Developing resource IDs must resolve to source resources",
);

const releasedViewId = sourceViewIds.find(
  (id) => !manifest.developing.views.includes(id),
);
const releasedSearchbaseId = sourceSearchbaseIds.find(
  (id) => !manifest.developing.searchbaseStanzas.includes(id),
);
const releasedSavedSearchId = sourceSavedSearchIds.find(
  (id) => !manifest.developing.savedSearches.includes(id),
);

assert.ok(releasedViewId, "At least one released dashboard fixture is required");
assert.ok(
  releasedSearchbaseId,
  "At least one released Searchbase fixture is required",
);
assert.ok(
  releasedSavedSearchId,
  "At least one released saved-search fixture is required",
);

const developerStage = makeStagedApp();
const splunkbaseStage = makeStagedApp();

try {
  const developerResult = applyBuildProfile(
    developerStage.appRoot,
    "developer",
    { manifest },
  );
  assert.deepEqual(developerResult.removedViewIds, []);
  assert.deepEqual(developerResult.removedSearchbaseStanzaIds, []);
  assert.deepEqual(developerResult.removedSavedSearchIds, []);

  for (const viewId of manifest.developing.views) {
    assert.equal(
      fs.existsSync(
        path.join(
          developerStage.appRoot,
          "default",
          "data",
          "ui",
          "views",
          `${viewId}.xml`,
        ),
      ),
      true,
      `Developer profile must include dashboard: ${viewId}`,
    );
  }
  assertStanzaPresence(
    fs.readFileSync(
      path.join(developerStage.appRoot, "default", "searchbase.conf"),
      "utf8",
    ),
    manifest.developing.searchbaseStanzas,
    true,
    "Developer profile must include Searchbase stanza",
  );
  assertStanzaPresence(
    fs.readFileSync(
      path.join(developerStage.appRoot, "default", "savedsearches.conf"),
      "utf8",
    ),
    manifest.developing.savedSearches,
    true,
    "Developer profile must include saved search",
  );

  const splunkbaseResult = applyBuildProfile(
    splunkbaseStage.appRoot,
    "splunkbase",
    { manifest },
  );
  assert.deepEqual(
    splunkbaseResult.removedViewIds,
    [...manifest.developing.views].sort(),
  );
  assert.deepEqual(
    splunkbaseResult.removedSearchbaseStanzaIds,
    [...manifest.developing.searchbaseStanzas].sort(),
  );
  assert.deepEqual(
    splunkbaseResult.removedSavedSearchIds,
    [...manifest.developing.savedSearches].sort(),
  );

  const splunkbaseNav = fs.readFileSync(
    path.join(splunkbaseStage.appRoot, "default/data/ui/nav/default.xml"),
    "utf8",
  );
  for (const viewId of manifest.developing.views) {
    assert.equal(
      fs.existsSync(
        path.join(
          splunkbaseStage.appRoot,
          "default",
          "data",
          "ui",
          "views",
          `${viewId}.xml`,
        ),
      ),
      false,
      `Splunkbase profile must exclude dashboard: ${viewId}`,
    );
    assert.doesNotMatch(
      splunkbaseNav,
      new RegExp(escapeRegExp(viewId)),
      `Splunkbase navigation must exclude dashboard: ${viewId}`,
    );
  }

  const splunkbaseSearchbase = fs.readFileSync(
    path.join(splunkbaseStage.appRoot, "default/searchbase.conf"),
    "utf8",
  );
  assertStanzaPresence(
    splunkbaseSearchbase,
    manifest.developing.searchbaseStanzas,
    false,
    "Splunkbase profile must exclude Searchbase stanza",
  );
  assertStanzaPresence(
    splunkbaseSearchbase,
    [releasedSearchbaseId],
    true,
    "Splunkbase profile must retain released Searchbase stanza",
  );

  const splunkbaseSavedSearches = fs.readFileSync(
    path.join(splunkbaseStage.appRoot, "default/savedsearches.conf"),
    "utf8",
  );
  assertStanzaPresence(
    splunkbaseSavedSearches,
    manifest.developing.savedSearches,
    false,
    "Splunkbase profile must exclude saved search",
  );
  assertStanzaPresence(
    splunkbaseSavedSearches,
    [releasedSavedSearchId],
    true,
    "Splunkbase profile must retain released saved search",
  );
  assert.equal(
    fs.existsSync(
      path.join(
        splunkbaseStage.appRoot,
        "default",
        "data",
        "ui",
        "views",
        `${releasedViewId}.xml`,
      ),
    ),
    true,
    "Splunkbase profile must retain released dashboards",
  );

  assert.equal(fs.readFileSync(sourceNavPath, "utf8"), sourceNav);
  assert.equal(fs.readFileSync(sourceSearchbasePath, "utf8"), sourceSearchbase);
  assert.equal(
    fs.readFileSync(sourceSavedSearchesPath, "utf8"),
    sourceSavedSearches,
  );
} finally {
  fs.rmSync(developerStage.tempRoot, { recursive: true, force: true });
  fs.rmSync(splunkbaseStage.tempRoot, { recursive: true, force: true });
}

console.log("✓ app build profile contracts passed");
