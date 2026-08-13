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
const sourceCatalystView = path.join(
  sourceAppRoot,
  "default",
  "data",
  "ui",
  "views",
  "netops_catalyst_health.xml",
);
const rootBuildScript = fs.readFileSync(
  path.resolve(packageRoot, "..", "..", "build.sh"),
  "utf8",
);
const packageScript = fs.readFileSync(
  path.join(packageRoot, "bin", "package_app.sh"),
  "utf8",
);

const manifest = validateManifest(readManifest());
assert.equal(
  manifest.developing.views.includes("netops_catalyst_health"),
  true,
  "Catalyst Health must remain developer-only until it is explicitly promoted",
);
assert.match(rootBuildScript, /--developer/);
assert.match(packageScript, /apply_build_profile\.js/);

const staleManifest = JSON.parse(JSON.stringify(manifest));
staleManifest.developing.searchbaseStanzas.push("search_that_does_not_exist");
assert.throws(
  () => validateManifest(staleManifest),
  /Developing Searchbase stanza manifest is out of sync.*search_that_does_not_exist/,
  "Developing resource IDs must resolve to source resources",
);

const testManifest = JSON.parse(JSON.stringify(manifest));
testManifest.developing.searchbaseStanzas.push(
  "building_resilience_co2_level",
);

function makeStagedApp() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "scd-build-profile-"));
  const appRoot = path.join(tempRoot, "splunk-cisco-dashboards");
  fs.cpSync(sourceAppRoot, appRoot, { recursive: true });
  return { appRoot, tempRoot };
}

const developerStage = makeStagedApp();
const splunkbaseStage = makeStagedApp();

try {
  const developerResult = applyBuildProfile(
    developerStage.appRoot,
    "developer",
    { manifest: testManifest },
  );
  assert.deepEqual(developerResult.removedViewIds, []);
  assert.deepEqual(developerResult.removedSearchbaseStanzaIds, []);
  assert.equal(
    fs.existsSync(
      path.join(
        developerStage.appRoot,
        "default/data/ui/views/netops_catalyst_health.xml",
      ),
    ),
    true,
    "Developer profile must include Catalyst Health",
  );
  assert.match(
    fs.readFileSync(
      path.join(developerStage.appRoot, "default/data/ui/nav/default.xml"),
      "utf8",
    ),
    /href="netops_catalyst_health"/,
    "Developer profile must retain the Catalyst Health navigation entry",
  );
  assert.match(
    fs.readFileSync(
      path.join(developerStage.appRoot, "default/searchbase.conf"),
      "utf8",
    ),
    /^\[building_resilience_co2_level\]$/m,
    "Developer profile must retain developing Searchbase stanzas",
  );

  const splunkbaseResult = applyBuildProfile(
    splunkbaseStage.appRoot,
    "splunkbase",
    { manifest: testManifest },
  );
  assert.deepEqual(splunkbaseResult.removedViewIds, [
    "netops_catalyst_health",
  ]);
  assert.deepEqual(splunkbaseResult.removedSearchbaseStanzaIds, [
    "building_resilience_co2_level",
  ]);
  assert.equal(splunkbaseResult.removedNavReferences, 1);
  assert.equal(
    fs.existsSync(
      path.join(
        splunkbaseStage.appRoot,
        "default/data/ui/views/netops_catalyst_health.xml",
      ),
    ),
    false,
    "Splunkbase profile must exclude Catalyst Health",
  );
  assert.doesNotMatch(
    fs.readFileSync(
      path.join(splunkbaseStage.appRoot, "default/data/ui/nav/default.xml"),
      "utf8",
    ),
    /netops_catalyst_health/,
    "Splunkbase profile must exclude the Catalyst Health navigation entry",
  );
  assert.equal(
    fs.existsSync(
      path.join(
        splunkbaseStage.appRoot,
        "default/data/ui/views/netops_catalyst_operations.xml",
      ),
    ),
    true,
    "Released dashboards must remain in the Splunkbase profile",
  );
  const splunkbaseSearchbase = fs.readFileSync(
    path.join(splunkbaseStage.appRoot, "default/searchbase.conf"),
    "utf8",
  );
  assert.doesNotMatch(
    splunkbaseSearchbase,
    /^\[building_resilience_co2_level\]$/m,
    "Splunkbase profile must exclude developing Searchbase stanzas",
  );
  assert.match(
    splunkbaseSearchbase,
    /^\[building_resilience_compliance_detail\]$/m,
    "Splunkbase profile must retain released Searchbase stanzas",
  );
  assert.equal(
    fs.existsSync(sourceCatalystView),
    true,
    "Profile filtering must never remove dashboard source XML",
  );
} finally {
  fs.rmSync(developerStage.tempRoot, { recursive: true, force: true });
  fs.rmSync(splunkbaseStage.tempRoot, { recursive: true, force: true });
}

console.log("✓ app build profile contracts passed");
