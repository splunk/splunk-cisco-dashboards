"use strict";

const assert = require("assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const APP_NAME = "splunk-cisco-dashboards";
const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CLEAN_BUILD_SOURCE = path.join(PACKAGE_ROOT, "bin", "clean_build.sh");
const PACKAGE_SCRIPT_SOURCE = path.join(PACKAGE_ROOT, "bin", "package_app.sh");
const VERIFY_SCRIPT_SOURCE = path.join(
  PACKAGE_ROOT,
  "bin",
  "verify_production_assets.js",
);
const RELEASE_IDENTITY_VALIDATOR_SOURCE = path.join(
  PACKAGE_ROOT,
  "bin",
  "validate_release_identity.js",
);
const STAMP_VERSION_SOURCE = path.join(PACKAGE_ROOT, "bin", "stamp_version.sh");
const BUILD_SCRIPT_SOURCE = path.resolve(PACKAGE_ROOT, "..", "..", "build.sh");
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, "..", "..");
const PRODUCTION_ENTRY_NAMES = [
  "executive_insights",
  "health_monitoring",
  "topology_canvas_v1",
  "network_diagram",
  "searchbase_canvas",
  "m365_activity_monitoring",
  "macro_index_tuning",
  "user_guide",
  "secure_operations_glass",
  "secure_networking_pillars",
  "dashboardbuilder",
];
const APP_CONF_SOURCE = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "resources",
  "splunk",
  "default",
  "app.conf",
);
const APP_MANIFEST_SOURCE = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "resources",
  "splunk",
  "app.manifest",
);
const BUILD_PROFILE_MANIFEST_SOURCE = path.join(
  PACKAGE_ROOT,
  "config",
  "build-profile-manifest.json",
);
const SEARCHBASE_SOURCE = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "resources",
  "splunk",
  "default",
  "searchbase.conf",
);
const INSIGHTS_WORKSPACES_SOURCE = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "webapp",
  "common",
  "config",
  "insightsWorkspaces.ts",
);
const USER_GUIDE_SOURCE = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "webapp",
  "pages",
  "user_guide",
  "index.tsx",
);
const {
  applyBuildProfile,
  readManifest,
} = require("../bin/apply_build_profile.js");

function makeTempRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `scd-${label}-`));
}

function removeTempRoot(root) {
  assert.match(path.basename(root), /^scd-[a-z-]+-/);
  fs.rmSync(root, { recursive: true, force: true });
}

function writeFile(filePath, contents, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  if (mode) fs.chmodSync(filePath, mode);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function exerciseExcludedViewLinkSafety() {
  const manifest = JSON.parse(fs.readFileSync(BUILD_PROFILE_MANIFEST_SOURCE, "utf8"));
  assert.ok(
    manifest.developing.views.includes("searchbase_canvas"),
    "Searchbase Canvas must remain excluded from the Splunkbase profile",
  );
  assert.deepEqual(
    [...manifest.developing.staticAssets].sort(),
    [
      "appserver/static/pages/searchbase_canvas.js",
      "appserver/static/pages/searchbase_canvas.js.LICENSE.txt",
      "appserver/static/searchbase_canvas_bootstrap.js",
    ],
    "The Splunkbase profile must exclude the complete Searchbase Canvas web surface",
  );
  assert.deepEqual(
    [...manifest.developing.configFiles].sort(),
    [
      "README/searchbase_canvases.conf.spec",
      "default/searchbase_canvases.conf",
    ],
    "The Splunkbase profile must exclude Canvas-only config files",
  );
  assert.deepEqual(
    manifest.developing.confSettings,
    [
      {
        file: "default/app.conf",
        stanza: "triggers",
        key: "reload.searchbase_canvases",
      },
      {
        file: "default/server.conf",
        stanza: "shclustering",
        key: "conf_replication_include.searchbase_canvases",
      },
    ],
    "The Splunkbase profile must exclude Canvas-only config declarations",
  );

  for (const sourcePath of [INSIGHTS_WORKSPACES_SOURCE, USER_GUIDE_SOURCE]) {
    const source = fs.readFileSync(sourcePath, "utf8");
    assert.doesNotMatch(
      source,
      /(?:href:\s*|appUrl\()\s*["']searchbase_canvas(?:[?"'])/,
      `${path.relative(PACKAGE_ROOT, sourcePath)} must not link customers to the excluded Searchbase Canvas`,
    );
  }
}

function exercisePromotedSearchbaseCatalogue() {
  const manifest = JSON.parse(fs.readFileSync(BUILD_PROFILE_MANIFEST_SOURCE, "utf8"));
  const searchbase = fs.readFileSync(SEARCHBASE_SOURCE, "utf8");
  const promotedStanzas = [
    "security_resilience_zeek_ssh_auth_pressure",
    "secure_networking_vendor_mac_on_nac_port",
    "security_resilience_sdwan_hunt_application_downgrade_reversion",
    "security_resilience_sdwan_hunt_peer_certificate_validation_failure",
    "security_resilience_sdwan_hunt_cve_2022_20775_path_traversal",
    "security_resilience_sdwan_hunt_root_ssh_public_key",
    "security_resilience_sdwan_hunt_root_or_rogue_sessions",
    "security_resilience_sdwan_hunt_suspicious_local_user_aaa",
    "security_resilience_sdwan_hunt_correlated_compromise_timeline",
    "security_resilience_sdwan_utd_amp_disposition_trend",
    "network_intelligence_firewall_nat_translation_hits",
    "secure_networking_meraki_top_blocked_destinations",
    "cybervision_assets_top_protocols",
    "cybervision_assets_device_inventory",
    "cybervision_assets_flow_top_talkers",
    "cybervision_assets_risk_distribution",
    "cybervision_assets_activity_recency",
    "cybervision_assets_external_communications_by_center",
    "cybervision_assets_top_risk_devices",
    "cybervision_assets_count_by_center",
    "cybervision_assets_vulnerable_by_center",
    "cybervision_events_severity_trend",
    "cybervision_events_severity_distribution",
    "cybervision_events_type_distribution",
    "cybervision_events_center_distribution",
    "cybervision_events_category_distribution",
    "cybervision_events_detail",
    "cybervision_syslog_severity_trend",
    "cybervision_syslog_severity_distribution",
    "cybervision_syslog_event_class_distribution",
    "cybervision_syslog_event_detail",
  ];

  for (const stanzaId of promotedStanzas) {
    assert.ok(
      !manifest.developing.searchbaseStanzas.includes(stanzaId),
      `${stanzaId} must ship in the Splunkbase profile`,
    );
    assert.match(
      searchbase,
      new RegExp(`^\\[${stanzaId}\\]$`, "m"),
      `${stanzaId} must remain present in the Searchbase catalogue`,
    );
  }
}

function exerciseDevelopingStaticAssetExclusion() {
  const appRoot = makeTempRoot("developing-static-assets");
  const manifest = readManifest(BUILD_PROFILE_MANIFEST_SOURCE);
  try {
    for (const viewId of manifest.developing.views) {
      writeFile(
        path.join(appRoot, "default", "data", "ui", "views", `${viewId}.xml`),
        `<view id="${viewId}" />\n`,
      );
    }
    writeFile(path.join(appRoot, "default", "data", "ui", "nav", "default.xml"), "<nav />\n");
    writeFile(path.join(appRoot, "default", "searchbase.conf"), "");
    writeFile(path.join(appRoot, "default", "savedsearches.conf"), "");
    writeFile(
      path.join(appRoot, "default", "app.conf"),
      "[triggers]\nreload.searchbase = simple\nreload.searchbase_canvases = simple\n",
    );
    writeFile(
      path.join(appRoot, "default", "server.conf"),
      "[shclustering]\nconf_replication_include.searchbase = true\nconf_replication_include.searchbase_canvases = true\n",
    );
    for (const assetPath of manifest.developing.staticAssets) {
      writeFile(path.join(appRoot, ...assetPath.split("/")), "development-only\n");
    }
    for (const configPath of manifest.developing.configFiles) {
      writeFile(path.join(appRoot, ...configPath.split("/")), "development-only\n");
    }

    const developerResult = applyBuildProfile(appRoot, "developer", {
      manifest,
    });
    assert.deepEqual(developerResult.removedStaticAssets, []);
    for (const assetPath of manifest.developing.staticAssets) {
      assert.ok(
        fs.existsSync(path.join(appRoot, ...assetPath.split("/"))),
        `${assetPath} must remain in the developer profile`,
      );
    }
    for (const configPath of manifest.developing.configFiles) {
      assert.ok(
        fs.existsSync(path.join(appRoot, ...configPath.split("/"))),
        `${configPath} must remain in the developer profile`,
      );
    }
    assert.match(
      fs.readFileSync(path.join(appRoot, "default", "app.conf"), "utf8"),
      /reload\.searchbase_canvases\s*=\s*simple/,
    );
    assert.match(
      fs.readFileSync(path.join(appRoot, "default", "server.conf"), "utf8"),
      /conf_replication_include\.searchbase_canvases\s*=\s*true/,
    );

    const splunkbaseResult = applyBuildProfile(appRoot, "splunkbase", {
      manifest,
    });
    assert.deepEqual(
      splunkbaseResult.removedStaticAssets,
      [...manifest.developing.staticAssets].sort(),
    );
    for (const assetPath of manifest.developing.staticAssets) {
      assert.ok(
        !fs.existsSync(path.join(appRoot, ...assetPath.split("/"))),
        `${assetPath} must not ship in the Splunkbase profile`,
      );
    }
    assert.deepEqual(
      splunkbaseResult.removedConfigFiles,
      [...manifest.developing.configFiles].sort(),
    );
    assert.equal(
      splunkbaseResult.removedConfSettings.length,
      manifest.developing.confSettings.length,
    );
    for (const configPath of manifest.developing.configFiles) {
      assert.ok(
        !fs.existsSync(path.join(appRoot, ...configPath.split("/"))),
        `${configPath} must not ship in the Splunkbase profile`,
      );
    }
    const releaseAppConf = fs.readFileSync(
      path.join(appRoot, "default", "app.conf"),
      "utf8",
    );
    assert.match(releaseAppConf, /reload\.searchbase\s*=\s*simple/);
    assert.doesNotMatch(releaseAppConf, /reload\.searchbase_canvases/);
    const releaseServerConf = fs.readFileSync(
      path.join(appRoot, "default", "server.conf"),
      "utf8",
    );
    assert.match(
      releaseServerConf,
      /conf_replication_include\.searchbase\s*=\s*true/,
    );
    assert.doesNotMatch(
      releaseServerConf,
      /conf_replication_include\.searchbase_canvases/,
    );
  } finally {
    removeTempRoot(appRoot);
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function runExpectFailure(command, args, options = {}) {
  try {
    run(command, args, options);
  } catch (error) {
    return `${error.stdout || ""}${error.stderr || ""}`;
  }
  assert.fail(`Expected ${command} ${args.join(" ")} to fail`);
}

function exerciseCleanBuild() {
  const root = makeTempRoot("clean-build");
  try {
    const script = path.join(root, "package", "bin", "clean_build.sh");
    const stage = path.join(root, "package", "stage");
    const tempDir = path.join(root, "tmp");
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(CLEAN_BUILD_SOURCE, script);
    fs.chmodSync(script, 0o755);
    writeFile(path.join(stage, "local", "runtime.conf"), "keep=1\n");
    writeFile(path.join(stage, "default", "app.conf"), "[install]\nbuild = 1\n");

    run("bash", [script], { env: { ...process.env, TMPDIR: tempDir } });

    assert.equal(
      fs.readFileSync(path.join(stage, "local", "runtime.conf"), "utf8"),
      "keep=1\n",
      "A normal clean must restore local configuration from its private backup",
    );
    assert.equal(
      fs.existsSync(path.join(stage, "default", "app.conf")),
      false,
      "A normal clean must still remove the generated stage contents",
    );
    assert.deepEqual(
      fs.readdirSync(tempDir),
      [],
      "The unique local backup must be removed after a successful restore",
    );

    run("bash", [script, "--wipe-local"], {
      env: { ...process.env, TMPDIR: tempDir },
    });
    assert.equal(
      fs.existsSync(stage),
      false,
      "--wipe-local remains an explicit full stage removal",
    );
  } finally {
    removeTempRoot(root);
  }
}

function makePackageFixture() {
  const root = makeTempRoot("package");
  const packageRoot = path.join(root, "packages", APP_NAME);
  const stage = path.join(packageRoot, "stage");
  const sourceRoot = path.join(packageRoot, "src", "main", "resources", "splunk");
  const packageScript = path.join(packageRoot, "bin", "package_app.sh");

  fs.mkdirSync(path.dirname(packageScript), { recursive: true });
  fs.copyFileSync(PACKAGE_SCRIPT_SOURCE, packageScript);
  fs.chmodSync(packageScript, 0o755);
  fs.copyFileSync(
    RELEASE_IDENTITY_VALIDATOR_SOURCE,
    path.join(packageRoot, "bin", "validate_release_identity.js"),
  );
  writeFile(path.join(packageRoot, "bin", "clean_build.sh"), "#!/usr/bin/env bash\nexit 0\n", 0o755);
  writeFile(
    path.join(packageRoot, "bin", "build.js"),
    [
      "if (!process.argv.includes('--minify')) {",
      "  console.error('SplunkBase fixture build must be minified');",
      "  process.exit(1);",
      "}",
      "",
    ].join("\n"),
  );
  fs.copyFileSync(STAMP_VERSION_SOURCE, path.join(packageRoot, "bin", "stamp_version.sh"));
  fs.chmodSync(path.join(packageRoot, "bin", "stamp_version.sh"), 0o755);
  writeFile(path.join(packageRoot, "bin", "apply_build_profile.js"), "process.exit(0);\n");
  writeFile(
    path.join(packageRoot, "bin", "verify_production_assets.js"),
    [
      "const fs = require('fs');",
      "if (process.env.SCD_FIXTURE_VERIFY_LOG) {",
      "  fs.appendFileSync(process.env.SCD_FIXTURE_VERIFY_LOG, String(process.argv[2] || '') + '\\n');",
      "}",
      "",
    ].join("\n"),
  );
  writeFile(path.join(root, "VERSION"), "1.2.3\n");
  writeFile(
    path.join(root, "releases", "splunkbase-9257.json"),
    `${JSON.stringify(
      {
        schema_version: 1,
        app: { splunkbase_app_id: 9257, package_id: APP_NAME },
        build_allocations: [
          { version: "1.2.2", build: 6, state: "published" },
          { version: "1.2.3", build: 7, state: "retired_candidate" },
        ],
      },
      null,
      2,
    )}\n`,
  );
  writeFile(path.join(root, "LICENSE"), "fixture license\n");
  writeFile(path.join(root, "NOTICE"), "fixture notice\n");

  const appConf = [
    "[install]",
    "build = 0",
    "",
    "[id]",
    `name = ${APP_NAME}`,
    "version = 0.0.0",
    "[launcher]",
    "version = 0.0.0",
    "[package]",
    `id = ${APP_NAME}`,
    "check_for_updates = true",
    "show_upgrade_notification = true",
    "",
  ].join("\n");
  writeFile(path.join(sourceRoot, "default", "app.conf"), appConf);
  writeFile(path.join(stage, "default", "app.conf"), appConf);
  const appManifest = {
    schemaVersion: "2.0.0",
    info: {
      id: { name: APP_NAME, version: "0.0.0" },
      releaseDate: "1970-01-01",
      releaseNotes: { name: "Version 0.0.0 Release Notes" },
    },
  };
  writeFile(path.join(sourceRoot, "app.manifest"), `${JSON.stringify(appManifest, null, 2)}\n`);
  writeFile(path.join(stage, "app.manifest"), `${JSON.stringify(appManifest, null, 2)}\n`);
  writeFile(
    path.join(stage, "appserver", "static", "pages", "fixture.js"),
    'const appBuild = "__SCD_PACKAGE_BUILD__";\n',
  );
  writeFile(path.join(stage, "local", "runtime.conf"), "preserve=1\n");
  writeFile(path.join(stage, "bin", "runtime.pyc"), "bytecode");
  writeFile(path.join(stage, "bin", "legacy.pyo"), "bytecode");
  writeFile(path.join(stage, "bin", "__pycache__", "module.pyc"), "bytecode");
  const sourceBytecodePath = path.join(
    sourceRoot,
    "bin",
    "__pycache__",
    "source-handler.pyc",
  );
  writeFile(sourceBytecodePath, "generated bytecode");
  writeFile(
    path.join(root, ".gitignore"),
    ["/dist/", "/packages/splunk-cisco-dashboards/stage/", ".env", "*.pyc", "__pycache__/", ""].join("\n"),
  );
  run("git", ["init"], { cwd: root });
  run("git", ["config", "user.email", "fixture@example.invalid"], { cwd: root });
  run("git", ["config", "user.name", "Package Fixture"], { cwd: root });
  run("git", ["add", "."], { cwd: root });
  run("git", ["commit", "-m", "Fixture source"], { cwd: root });

  return {
    root,
    packageRoot,
    packageScript,
    sourceBytecodePath,
    stage,
  };
}

function exerciseReleaseIdentityValidation() {
  const fixture = makePackageFixture();
  const validator = path.join(
    fixture.packageRoot,
    "bin",
    "validate_release_identity.js",
  );
  try {
    assert.match(
      run("node", [validator], { cwd: fixture.packageRoot }),
      /Release template validated: splunk-cisco-dashboards \(Splunkbase 9257\) v1\.2\.3; build allocated automatically/,
      "The VERSION-only release template must validate before packaging",
    );
    const appConfPath = path.join(
      fixture.packageRoot,
      "src",
      "main",
      "resources",
      "splunk",
      "default",
      "app.conf",
    );
    fs.writeFileSync(
      appConfPath,
      fs.readFileSync(appConfPath, "utf8").replace("build = 0", "build = 7"),
    );
    const fixedBuildFailure = runExpectFailure("node", [validator], {
      cwd: fixture.packageRoot,
    });
    assert.match(
      fixedBuildFailure,
      /build must remain the placeholder 0/,
      "Release template validation must reject a manually maintained source build",
    );
    fs.writeFileSync(
      appConfPath,
      fs.readFileSync(appConfPath, "utf8").replace("build = 7", "build = 0"),
    );
    fs.writeFileSync(
      appConfPath,
      fs.readFileSync(appConfPath, "utf8").replace(`id = ${APP_NAME}`, "id = wrong-package-id"),
    );
    const packageIdFailure = runExpectFailure("node", [validator], {
      cwd: fixture.packageRoot,
    });
    assert.match(
      packageIdFailure,
      /\[package\] id must match the release ledger package_id/,
      "Release identity validation must reject update-discovery package ID drift",
    );
    fs.writeFileSync(
      appConfPath,
      fs.readFileSync(appConfPath, "utf8").replace("id = wrong-package-id", `id = ${APP_NAME}`),
    );
    const appManifestPath = path.join(
      fixture.packageRoot,
      "src",
      "main",
      "resources",
      "splunk",
      "app.manifest",
    );
    const manifest = JSON.parse(fs.readFileSync(appManifestPath, "utf8"));
    manifest.info.id.version = "1.2.3";
    fs.writeFileSync(appManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const fixedManifestVersionFailure = runExpectFailure("node", [validator], {
      cwd: fixture.packageRoot,
    });
    assert.match(
      fixedManifestVersionFailure,
      /app\.manifest info\.id\.version must remain the 0\.0\.0 placeholder/,
      "Release template validation must reject a manually maintained manifest version",
    );
  } finally {
    removeTempRoot(fixture.root);
  }
}

function exerciseProductionVerifierCacheRejection() {
  const root = makeTempRoot("production-verifier");
  const stage = path.join(root, "stage");
  try {
    fs.mkdirSync(stage, { recursive: true });
    fs.copyFileSync(path.join(REPOSITORY_ROOT, "LICENSE"), path.join(stage, "LICENSE"));
    fs.copyFileSync(path.join(REPOSITORY_ROOT, "NOTICE"), path.join(stage, "NOTICE"));
    PRODUCTION_ENTRY_NAMES.forEach((entryName) => {
      writeFile(
        path.join(stage, "appserver", "static", "pages", `${entryName}.js`),
        "void 0;\n",
      );
    });
    writeFile(path.join(stage, "bin", "__pycache__", "runtime.pyc"), "bytecode");
    const cacheFailure = runExpectFailure("node", [VERIFY_SCRIPT_SOURCE, stage], {
      cwd: root,
    });
    assert.match(
      cacheFailure,
      /Production stage contains Python bytecode or cache files/,
      "The production verifier must reject runtime Python caches directly",
    );
    fs.rmSync(path.join(stage, "bin", "__pycache__"), {
      recursive: true,
      force: true,
    });
    writeFile(
      path.join(stage, "appserver", "static", "pages", "executive_insights.js"),
      "void 0;\n//# sourceMappingURL=data:application/json;base64,e30=\n",
    );
    const sourceMapDirectiveFailure = runExpectFailure(
      "node",
      [VERIFY_SCRIPT_SOURCE, stage],
      { cwd: root },
    );
    assert.match(
      sourceMapDirectiveFailure,
      /Production entry bundles contain source-map directives/,
      "The production verifier must reject inline or external source-map directives",
    );
    writeFile(
      path.join(stage, "appserver", "static", "pages", "executive_insights.js"),
      "void 0;\n",
    );
    fs.rmSync(
      path.join(stage, "appserver", "static", "pages", "searchbase_canvas.js"),
    );
    const developerMissingCanvasFailure = runExpectFailure(
      "node",
      [VERIFY_SCRIPT_SOURCE, stage, "developer"],
      { cwd: root },
    );
    assert.match(
      developerMissingCanvasFailure,
      /searchbase_canvas\.js/,
      "The developer verifier must still require the internal Canvas bundle",
    );
    const splunkbaseOutput = run(
      "node",
      [VERIFY_SCRIPT_SOURCE, stage, "splunkbase"],
      { cwd: root },
    );
    assert.match(
      splunkbaseOutput,
      /Verified 10 splunkbase production bundles/,
      "The Splunkbase verifier must accept the profile-filtered entry set",
    );
    writeFile(
      path.join(stage, "appserver", "static", "pages", "searchbase_canvas.js"),
      "void 0;\n",
    );
    const splunkbaseCanvasLeakFailure = runExpectFailure(
      "node",
      [VERIFY_SCRIPT_SOURCE, stage, "splunkbase"],
      { cwd: root },
    );
    assert.match(
      splunkbaseCanvasLeakFailure,
      /Splunkbase stage contains developing entry bundles/,
      "The Splunkbase verifier must reject a leaked Canvas bundle",
    );
  } finally {
    removeTempRoot(root);
  }
}

function listArchives(distDir) {
  return fs
    .readdirSync(distDir)
    .filter((name) => name.endsWith(".tar.gz"))
    .sort();
}

function readArchiveBuild(archivePath) {
  const appConf = run("tar", ["-xzOf", archivePath, `${APP_NAME}/default/app.conf`]);
  const match = appConf.match(/^build\s*=\s*([0-9]+)$/m);
  assert.ok(match, `Packaged build is missing from ${archivePath}`);
  return Number(match[1]);
}

function exerciseFromStageDefaultsToDeveloperProfile() {
  const fixture = makePackageFixture();
  try {
    writeFile(
      path.join(fixture.stage, "appserver", "static", "pages", "fixture.js"),
      'var APP_BUILD="6"||0;var APP_VERSION="1.2.2"||0;\n//# sourceMappingURL=fixture.js.map\n',
    );
    const output = run("bash", [fixture.packageScript, "--from-stage"], {
      cwd: fixture.packageRoot,
    });
    assert.match(
      output,
      /-developer\.tar\.gz/,
      "Stage reuse without an explicit profile must select the developer profile",
    );
    assert.ok(
      listArchives(path.join(fixture.root, "dist")).some((name) =>
        name.endsWith("-developer.tar.gz"),
      ),
      "Stage reuse without --developer must create a developer archive",
    );
    assert.match(
      output,
      /repaired 1 stale watcher bundle identity assignment/,
      "Fast packaging must repair a watcher started with old identity literals",
    );
    assert.match(
      output,
      /stripped 1 stale watcher source-map directive/,
      "Fast packaging must remove directives emitted by an old watcher configuration",
    );
    const developerArchive = listArchives(path.join(fixture.root, "dist")).find((name) =>
      name.endsWith("-developer.tar.gz"),
    );
    assert.ok(developerArchive);
    assert.equal(
      run("tar", [
        "-xzOf",
        path.join(fixture.root, "dist", developerArchive),
        `${APP_NAME}/appserver/static/pages/fixture.js`,
      ]),
      'var APP_BUILD="8"||0;var APP_VERSION="1.2.3"||0;\n',
      "Fast packaging must stamp the allocated build and VERSION into stale watcher bundles",
    );
  } finally {
    removeTempRoot(fixture.root);
  }
}

function exercisePackagingProfiles() {
  const fixture = makePackageFixture();
  const distDir = path.join(fixture.root, "dist");
  const archiveAuditRoot = makeTempRoot("archive-audit");
  const verifyLog = path.join(archiveAuditRoot, "verifier-paths.log");
  try {
    const legacyArchive = path.join(distDir, `${APP_NAME}-1.2.3.tar.gz`);
    fs.mkdirSync(distDir, { recursive: true });
    writeFile(legacyArchive, "legacy archive must remain untouched\n");
    const legacyDigest = sha256(legacyArchive);

    const ignoredResourcePath = path.join(
      fixture.packageRoot,
      "src",
      "main",
      "resources",
      "splunk",
      ".env",
    );
    writeFile(ignoredResourcePath, "SPLUNKBASE_RELEASE_SECRET=must-not-package\n");
    const ignoredInputFailure = runExpectFailure(
      "bash",
      [fixture.packageScript],
      { cwd: fixture.packageRoot },
    );
    assert.match(
      ignoredInputFailure,
      /Splunkbase packaging refuses ignored files under release inputs/,
      "A clean Git worktree must still reject ignored resource inputs",
    );
    fs.rmSync(ignoredResourcePath);

    const reservedIdentity = path.join(
      distDir,
      `.${APP_NAME}-build8.lock`,
    );
    fs.mkdirSync(reservedIdentity);
    const reservationFailure = runExpectFailure(
      "bash",
      [fixture.packageScript, "--from-stage", "--developer"],
      { cwd: fixture.packageRoot },
    );
    assert.match(
      reservationFailure,
      /build 8 is currently being packaged/,
      "An active build reservation must prevent a concurrent duplicate package",
    );
    fs.rmdirSync(reservedIdentity);

    run("bash", [fixture.packageScript], {
      cwd: fixture.packageRoot,
      env: { ...process.env, SCD_FIXTURE_VERIFY_LOG: verifyLog },
    });
    assert.match(
      fs.readFileSync(verifyLog, "utf8"),
      /archive-audit[\\/]splunk-cisco-dashboards/,
      "Splunkbase packaging must re-extract and verify the final archive before publication",
    );

    const firstArchiveName = listArchives(distDir).find(
      (name) => name === `${APP_NAME}-1.2.3-8.tar.gz`,
    );
    assert.ok(firstArchiveName, "Splunkbase packaging must expose version and build in the archive name");
    const firstArchive = path.join(distDir, firstArchiveName);
    const firstDigest = sha256(firstArchive);
    assert.equal(
      fs.existsSync(`${firstArchive}.sha256`),
      false,
      "Packaging must emit only the tarball without a checksum sidecar",
    );
    const firstContents = run("tar", ["tzf", firstArchive]);
    const firstMembers = firstContents.trim().split("\n").filter(Boolean);
    assert.equal(
      new Set(firstMembers).size,
      firstMembers.length,
      "The deterministic archive list must not write duplicate tar members",
    );
    assert.doesNotMatch(firstContents, /(?:\.py[co]|__pycache__)/);
    assert.match(
      run("tar", ["-xzOf", firstArchive, `${APP_NAME}/default/app.conf`]),
      /^build = 8$/m,
      "The package must allocate the next build above release history",
    );
    const packagedManifest = JSON.parse(
      run("tar", ["-xzOf", firstArchive, `${APP_NAME}/app.manifest`]),
    );
    assert.equal(packagedManifest.info.id.version, "1.2.3");
    assert.equal(packagedManifest.info.releaseNotes.name, "Version 1.2.3 Release Notes");
    assert.match(packagedManifest.info.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
    const releaseProvenance = JSON.parse(
      run("tar", ["-xzOf", firstArchive, `${APP_NAME}/release-provenance.json`]),
    );
    assert.deepEqual(
      releaseProvenance,
      {
        schema_version: 1,
        splunkbase_app_id: 9257,
        package_id: APP_NAME,
        version: "1.2.3",
        build: 8,
        git_commit: run("git", ["rev-parse", "HEAD"], { cwd: fixture.root }).trim(),
        source_tree_clean: true,
        release_eligible: true,
      },
      "Splunkbase archives must carry only the exact clean source commit provenance",
    );
    assert.equal(
      fs.existsSync(path.join(fixture.stage, "bin", "runtime.pyc")),
      true,
      "Fast packaging must not delete bytecode from the watcher-linked stage",
    );
    assert.equal(
      fs.existsSync(path.join(fixture.stage, "bin", "__pycache__", "module.pyc")),
      true,
      "Fast packaging must leave the live cache directory untouched",
    );
    assert.equal(
      fs.existsSync(path.join(fixture.stage, "local", "runtime.conf")),
      true,
      "Fast packaging must leave local runtime configuration untouched",
    );
    assert.equal(
      fs.existsSync(fixture.sourceBytecodePath),
      true,
      "Packaging must not delete generated bytecode from source resources",
    );
    assert.equal(
      sha256(legacyArchive),
      legacyDigest,
      "Version-build packaging must not overwrite legacy version-only artifacts",
    );

    writeFile(
      path.join(fixture.stage, "appserver", "static", "pages", "fixture.js"),
      'const appBuild = "__SCD_PACKAGE_BUILD__"; const changed = true;\n',
    );
    run("bash", [fixture.packageScript], { cwd: fixture.packageRoot });
    const releaseArchives = listArchives(distDir).filter((name) =>
      new RegExp(`^${APP_NAME}-1\\.2\\.3-[0-9]+\\.tar\\.gz$`).test(name),
    );
    assert.equal(
      releaseArchives.length,
      2,
      "Repeated same-version release builds must receive distinct immutable archives",
    );
    assert.deepEqual(
      releaseArchives.map((name) => readArchiveBuild(path.join(distDir, name))).sort((a, b) => a - b),
      [8, 9],
      "Repeated same-version release builds must increment automatically",
    );
    assert.equal(
      sha256(firstArchive),
      firstDigest,
      "A later package must not mutate the retained artifact",
    );

    run("bash", [fixture.packageScript, "--from-stage", "--developer"], {
      cwd: fixture.packageRoot,
    });
    const developerArchiveName = listArchives(distDir).find(
      (name) => name === `${APP_NAME}-1.2.3-10-developer.tar.gz`,
    );
    assert.ok(
      developerArchiveName,
      "Developer artifacts must remain distinct from Splunkbase-profile archives",
    );
    assert.match(
      run("tar", [
        "-xzOf",
        path.join(distDir, developerArchiveName),
        `${APP_NAME}/default/app.conf`,
      ]),
      /^build = 10$/m,
      "Developer packaging must continue the shared automatic build sequence",
    );
    assert.doesNotMatch(
      run("tar", ["tzf", path.join(distDir, developerArchiveName)]),
      /release-provenance\.json/,
      "Watcher-linked developer packages must not claim Splunkbase source provenance",
    );

    writeFile(
      path.join(fixture.stage, "appserver", "static", "pages", "fixture.js"),
      'const appBuild = "__SCD_PACKAGE_BUILD__"; const developerChange = true;\n',
    );
    run("bash", [fixture.packageScript, "--from-stage", "--developer"], {
      cwd: fixture.packageRoot,
    });
    const developerArchives = listArchives(distDir).filter((name) =>
      name.endsWith("-developer.tar.gz"),
    );
    assert.equal(
      developerArchives.length,
      2,
      "Developer stage packaging must permit repeated auto-incremented iterations",
    );
    assert.deepEqual(
      developerArchives
        .map((name) => readArchiveBuild(path.join(distDir, name)))
        .sort((a, b) => a - b),
      [10, 11],
      "Developer iterations must receive distinct increasing builds",
    );
    assert.match(
      fs.readFileSync(
        path.join(fixture.packageRoot, "src", "main", "resources", "splunk", "default", "app.conf"),
        "utf8",
      ),
      /^build = 0$/m,
      "Packaging must never modify the source app.conf build placeholder",
    );
    assert.equal(
      JSON.parse(
        fs.readFileSync(
          path.join(fixture.packageRoot, "src", "main", "resources", "splunk", "app.manifest"),
          "utf8",
        ),
      ).info.id.version,
      "0.0.0",
      "Packaging must never modify the source app.manifest version placeholder",
    );

    writeFile(path.join(fixture.root, "uncommitted-release-input.txt"), "dirty\n");
    const retiredLocalValidationFailure = runExpectFailure(
      "bash",
      [fixture.packageScript, "--local-validation"],
      { cwd: fixture.packageRoot },
    );
    assert.match(
      retiredLocalValidationFailure,
      /Unknown option: --local-validation/,
      "Splunkbase packaging must not expose a non-release-eligible local-validation mode",
    );

    const dirtyWorktreeFailure = runExpectFailure(
      "bash",
      [fixture.packageScript],
      { cwd: fixture.packageRoot },
    );
    assert.match(
      dirtyWorktreeFailure,
      /Splunkbase packaging requires a clean Git worktree/,
      "Splunkbase packaging must reject source that cannot be reproduced from a commit",
    );
    assert.equal(
      fs.existsSync(path.join(distDir, `${APP_NAME}-1.2.3-12.tar.gz`)),
      false,
      "Dirty Splunkbase packaging must not emit an upload-looking archive",
    );
  } finally {
    removeTempRoot(fixture.root);
    removeTempRoot(archiveAuditRoot);
  }
}

function exercisePostBuildSourceVerification() {
  const fixture = makePackageFixture();
  try {
    writeFile(
      path.join(fixture.packageRoot, "bin", "clean_build.sh"),
      "#!/usr/bin/env bash\nprintf 'dirty\\n' > ../../build-generated-source.txt\n",
      0o755,
    );
    const failure = runExpectFailure("bash", [fixture.packageScript], {
      cwd: fixture.packageRoot,
    });
    assert.match(
      failure,
      /Splunkbase packaging requires a clean Git worktree/,
      "Splunkbase packaging must recheck source cleanliness after its build steps",
    );
    assert.equal(
      listArchives(path.join(fixture.root, "dist")).length,
      0,
      "A post-build source mutation must stop before a release archive is created",
    );
  } finally {
    removeTempRoot(fixture.root);
  }
}

function makeRootBuildFixture() {
  const root = makeTempRoot("root-build");
  const packageRoot = path.join(root, "packages", APP_NAME);
  const appConfPath = path.join(
    packageRoot,
    "src",
    "main",
    "resources",
    "splunk",
    "default",
    "app.conf",
  );
  const packageScriptPath = path.join(packageRoot, "bin", "package_app.sh");
  const buildPath = path.join(root, "build.sh");
  const appConf = [
    "[install]",
    "build = 0",
    "",
    "[id]",
    `name = ${APP_NAME}`,
    "version = 0.0.0",
    "",
  ].join("\n");

  fs.copyFileSync(BUILD_SCRIPT_SOURCE, buildPath);
  fs.chmodSync(buildPath, 0o755);
  writeFile(path.join(root, "VERSION"), "1.2.3\n");
  writeFile(appConfPath, appConf);
  writeFile(
    packageScriptPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'PKG_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"',
      'ROOT_DIR="$(cd "${PKG_ROOT}/../.." && pwd)"',
      'APP_NAME="splunk-cisco-dashboards"',
      'VERSION="$(tr -d "[:space:]" < "${ROOT_DIR}/VERSION")"',
      'FLOOR=0',
      'DEVELOPER=0',
      'for ARG in "$@"; do',
      '  case "${ARG}" in',
      '    --developer) DEVELOPER=1 ;;',
      '    --minify) ;;',
      '    *) echo "unsupported fixture package option: ${ARG}" >&2; exit 2 ;;',
      '  esac',
      'done',
      'mkdir -p "${ROOT_DIR}/dist"',
      'for PRIOR in "${ROOT_DIR}/dist"/${APP_NAME}-*.tar.gz; do',
      '  [[ -f "${PRIOR}" ]] || continue',
      '  PRIOR_BUILD="$(tar -xzOf "${PRIOR}" "${APP_NAME}/default/app.conf" 2>/dev/null | awk -F= \'/^[[:space:]]*build[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2; exit}\' || true)"',
      '  if [[ "${PRIOR_BUILD}" =~ ^[0-9]+$ ]] && (( PRIOR_BUILD > FLOOR )); then FLOOR="${PRIOR_BUILD}"; fi',
      'done',
      'BUILD=$((FLOOR + 1))',
      'SUFFIX=""',
      '[[ "${DEVELOPER}" -eq 1 ]] && SUFFIX="-developer"',
      'WORK_DIR="$(mktemp -d)"',
      "trap 'rm -rf \"${WORK_DIR}\"' EXIT",
      'mkdir -p "${WORK_DIR}/${APP_NAME}/default"',
      'printf "[install]\\nbuild = %s\\n\\n[id]\\nname = splunk-cisco-dashboards\\nversion = %s\\n" "${BUILD}" "${VERSION}" > "${WORK_DIR}/${APP_NAME}/default/app.conf"',
      'if [[ "${DEVELOPER}" -eq 0 ]]; then',
      '  ELIGIBLE="${SCD_FIXTURE_RELEASE_ELIGIBLE:-true}"',
      '  CLEAN="${SCD_FIXTURE_SOURCE_TREE_CLEAN:-true}"',
      '  printf "{\\\"package_id\\\":\\\"%s\\\",\\\"version\\\":\\\"%s\\\",\\\"build\\\":%s,\\\"git_commit\\\":\\\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\\\",\\\"source_tree_clean\\\":%s,\\\"release_eligible\\\":%s}\\n" "${APP_NAME}" "${VERSION}" "${BUILD}" "${CLEAN}" "${ELIGIBLE}" > "${WORK_DIR}/${APP_NAME}/release-provenance.json"',
      'fi',
      'ARCHIVE_TMP="${ROOT_DIR}/dist/.fixture-archive.tar.gz"',
      '(cd "${WORK_DIR}" && tar czf "${ARCHIVE_TMP}" "${APP_NAME}")',
      'ARCHIVE="${ROOT_DIR}/dist/${APP_NAME}-${VERSION}-${BUILD}${SUFFIX}.tar.gz"',
      'mv "${ARCHIVE_TMP}" "${ARCHIVE}"',
      "",
    ].join("\n"),
    0o755,
  );
  return { root, buildPath };
}

function exerciseRootBuildArchiveResolution() {
  const fixture = makeRootBuildFixture();
  try {
    const standardOutput = run("bash", [fixture.buildPath], {
      cwd: fixture.root,
    });
    assert.match(
      standardOutput,
      /Tarball: .*splunk-cisco-dashboards-1\.2\.3-1\.tar\.gz/,
      "A fresh root build must resolve the newly created version-build Splunkbase archive",
    );

    const standardArchive = fs
      .readdirSync(path.join(fixture.root, "dist"))
      .find((name) => name.endsWith(".tar.gz") && !name.endsWith("-developer.tar.gz"));
    assert.ok(standardArchive, "The fixture must create a standard immutable archive");
    fs.appendFileSync(path.join(fixture.root, "dist", standardArchive), "tampered");
    const tamperFailure = runExpectFailure(
      "bash",
      [fixture.buildPath, "--no-build", "--install", "--auth", "fixture:password"],
      { cwd: fixture.root },
    );
    assert.match(
      tamperFailure,
      /failed gzip integrity validation/,
      "The root wrapper must reject a corrupt archive before any install action",
    );

    const developerOutput = run("bash", [fixture.buildPath, "--developer"], {
      cwd: fixture.root,
    });
    assert.match(
      developerOutput,
      /Tarball: .*splunk-cisco-dashboards-1\.2\.3-2-developer\.tar\.gz/,
      "A fresh developer build must resolve its profile-specific immutable archive",
    );
  } finally {
    removeTempRoot(fixture.root);
  }

  const emptyFixture = makeRootBuildFixture();
  try {
    fs.mkdirSync(path.join(emptyFixture.root, "dist"));
    const missingArchiveFailure = runExpectFailure(
      "bash",
      [emptyFixture.buildPath, "--no-build", "--install", "--auth", "fixture:password"],
      { cwd: emptyFixture.root },
    );
    assert.match(
      missingArchiveFailure,
      /no immutable splunkbase archive was found for package splunk-cisco-dashboards, version 1\.2\.3/,
      "An empty dist directory must fail with the intended no-archive diagnostic",
    );
    assert.doesNotMatch(
      missingArchiveFailure,
      /gzip integrity validation|splunk.*install app/,
      "The no-archive path must stop before archive validation or Splunk installation work",
    );
  } finally {
    removeTempRoot(emptyFixture.root);
  }
}

function exerciseLocalInstallProfileDefaults() {
  const fixture = makeRootBuildFixture();
  try {
    const splunkHome = path.join(fixture.root, "splunk");
    const splunkLog = path.join(fixture.root, "splunk-install.log");
    writeFile(
      path.join(splunkHome, "bin", "splunk"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "%s\\n" "$*" >> "${SCD_FIXTURE_SPLUNK_LOG}"',
        "",
      ].join("\n"),
      0o755,
    );
    writeFile(
      path.join(splunkHome, "etc", "apps", APP_NAME, "default", "app.conf"),
      "[install]\nbuild = 20\n",
    );
    const env = {
      ...process.env,
      SPLUNK_HOME: splunkHome,
      SCD_FIXTURE_SPLUNK_LOG: splunkLog,
    };

    const splunkbaseOutput = run(
      "bash",
      [fixture.buildPath, "--install", "--splunkbase", "--auth", "fixture:password"],
      { cwd: fixture.root, env },
    );
    assert.match(
      splunkbaseOutput,
      /Profile:\s+Splunkbase \(released resources only\)/,
      "A fresh local install must default to the SplunkBase profile",
    );
    assert.match(
      splunkbaseOutput,
      /Tarball: .*splunk-cisco-dashboards-1\.2\.3-1\.tar\.gz/,
      "An explicit local Splunkbase install must use the release artifact namespace",
    );
    assert.doesNotMatch(
      splunkbaseOutput.match(/Tarball: .*$/m)?.[0] || "",
      /-developer\.tar\.gz/,
      "A default local install must not resolve a developer archive",
    );
    assert.match(
      splunkbaseOutput,
      /v1\.2\.3 \(build 1\)/,
      "A Splunkbase install must allocate independently of the target's installed build",
    );
    assert.match(
      splunkbaseOutput,
      /Upload:\s+ready for Splunkbase submission/,
      "A successful Splunkbase install must identify its archive as upload-ready",
    );
    const splunkbaseArchive = splunkbaseOutput.match(/^\s*Tarball:\s+(.+\.tar\.gz)$/m)?.[1];
    assert.ok(splunkbaseArchive, "The Splunkbase install must report its exact archive path");
    assert.ok(
      fs.readFileSync(splunkLog, "utf8").includes(splunkbaseArchive),
      "The local installer must receive the exact upload-ready archive reported by packaging",
    );

    const developerOutput = run(
      "bash",
      [
        fixture.buildPath,
        "--developer",
        "--install",
        "--minify",
        "--auth",
        "fixture:password",
      ],
      { cwd: fixture.root, env },
    );
    assert.match(
      developerOutput,
      /Profile:\s+developer \(released \+ developing resources\)/,
      "--developer must explicitly select the local developer profile",
    );
    assert.match(
      developerOutput,
      /Tarball: .*splunk-cisco-dashboards-1\.2\.3-2-developer\.tar\.gz/,
      "An explicit developer install must use the developer artifact namespace",
    );
    assert.match(
      developerOutput,
      /v1\.2\.3 \(build 2\)/,
      "The explicit developer build must continue above prior generated artifacts",
    );
    const nonEligibleFailure = runExpectFailure(
      "bash",
      [fixture.buildPath, "--install", "--splunkbase", "--auth", "fixture:password"],
      {
        cwd: fixture.root,
        env: { ...env, SCD_FIXTURE_RELEASE_ELIGIBLE: "false" },
      },
    );
    assert.match(
      nonEligibleFailure,
      /Splunkbase archive is not release-eligible/,
      "A non-release-eligible Splunkbase archive must be rejected before installation",
    );
    assert.equal(
      fs.readFileSync(splunkLog, "utf8").trim().split("\n").length,
      2,
      "Only the release-eligible and developer artifacts must reach the local installer",
    );
  } finally {
    removeTempRoot(fixture.root);
  }
}

function exerciseDirtyDefaultInstallSelectsDeveloper() {
  const fixture = makeRootBuildFixture();
  try {
    const splunkHome = path.join(fixture.root, "splunk");
    const splunkLog = path.join(fixture.root, "splunk-install.log");
    writeFile(
      path.join(splunkHome, "bin", "splunk"),
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        'printf "%s\\n" "$*" >> "${SCD_FIXTURE_SPLUNK_LOG}"',
        "",
      ].join("\n"),
      0o755,
    );
    const env = {
      ...process.env,
      SPLUNK_HOME: splunkHome,
      SCD_FIXTURE_SPLUNK_LOG: splunkLog,
    };
    writeFile(path.join(fixture.root, ".gitignore"), "dist/\n");
    run("git", ["init"], { cwd: fixture.root });
    run("git", ["config", "user.email", "fixture@example.invalid"], { cwd: fixture.root });
    run("git", ["config", "user.name", "Package Fixture"], { cwd: fixture.root });
    run("git", ["add", "."], { cwd: fixture.root });
    run("git", ["commit", "-m", "Fixture source"], { cwd: fixture.root });

    const cleanOutput = run(
      "bash",
      [fixture.buildPath, "--install", "--auth", "fixture:password"],
      { cwd: fixture.root, env },
    );
    assert.match(
      cleanOutput,
      /Profile:\s+Splunkbase \(released resources only\)/,
      "A clean default install must still use the Splunkbase profile",
    );
    assert.doesNotMatch(
      cleanOutput,
      /Uncommitted changes detected/,
      "A clean worktree must not switch to the developer profile",
    );

    writeFile(path.join(fixture.root, "uncommitted.txt"), "dirty\n");
    const dirtyOutput = run(
      "bash",
      [fixture.buildPath, "--install", "--auth", "fixture:password"],
      { cwd: fixture.root, env },
    );
    assert.match(
      dirtyOutput,
      /Uncommitted changes detected; using the developer profile so the build can proceed/,
      "A dirty default install must explain the developer-profile fallback",
    );
    assert.match(
      dirtyOutput,
      /Profile:\s+developer \(released \+ developing resources\)/,
      "Uncommitted ./build.sh --install must use the developer profile",
    );
    assert.match(
      dirtyOutput,
      /splunk-cisco-dashboards-1\.2\.3-2-developer\.tar\.gz/,
      "A dirty default install must write a developer archive instead of a Splunkbase archive",
    );
  } finally {
    removeTempRoot(fixture.root);
  }
}

assert.doesNotMatch(
  fs.readFileSync(CLEAN_BUILD_SOURCE, "utf8"),
  /_scd_local_backup/,
  "Clean build must not use a shared fixed /tmp backup path",
);
assert.match(
  fs.readFileSync(CLEAN_BUILD_SOURCE, "utf8"),
  /mktemp -d "\$\{TMPDIR:-\/tmp\}\/scd-clean-build\.XXXXXX"[\s\S]*?trap restore_local EXIT/,
  "Clean build must use a per-run backup and restore it through an EXIT trap",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /removed_python_runtime_artifacts[\s\S]*?\.pyc[\s\S]*?\.pyo/,
  "The package script must remove Python bytecode only from the archive copy",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /ln "\$ARCHIVE_TMP" "\$PKG_PATH"/,
  "The final archive promotion must reject an existing destination instead of truncating it",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /PKG_PATH=.*\$\{VERSION\}-\$\{new_build\}\$\{ARTIFACT_PROFILE_SUFFIX\}\.tar\.gz/,
  "Artifact names must expose the package version and allocated build",
);
assert.doesNotMatch(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /PKG_PATH=.*sha256/,
  "Artifact filenames must never contain the SHA-256 digest",
);
assert.doesNotMatch(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /\.sha256|PKG_SHA256_PATH|DIGEST_TMP/,
  "Packaging must not create a checksum sidecar",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /history_build="\$\(resolve_release_history_build_floor\)"[\s\S]*?dist_build=0[\s\S]*?new_build=\$\(\(build_floor \+ 1\)\)/,
  "Packaging must allocate the next build from release history and dist artifacts",
);
assert.doesNotMatch(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /SCD_PACKAGE_BUILD_FLOOR|target_build|--local-validation|LOCAL_VALIDATION/,
  "Package construction must not depend on an installation target or local-validation mode",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /IDENTITY_LOCK="\$\{DIST_DIR\}\/\.\$\{APP_NAME\}-build\$\{new_build\}\.lock"[\s\S]*?mkdir "\$IDENTITY_LOCK"/,
  "Packaging must reserve the globally allocated build atomically during creation",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /node "\$\{PKG_ROOT\}\/bin\/validate_release_identity\.js"/,
  "Packaging must validate the VERSION-only source template before building an archive",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /FROM_STAGE.*?DEVELOPER_PROFILE=1/s,
  "Stage reuse must imply the developer profile for direct package callers",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /resolve_clean_release_commit\(\)[\s\S]*?git -C "\$ROOT_DIR" status --porcelain --untracked-files=all[\s\S]*?RELEASE_COMMIT="\$\(resolve_clean_release_commit\)"[\s\S]*?post_build_commit="\$\(resolve_clean_release_commit\)"/,
  "Every Splunkbase packaging caller must pass the clean, committed source gate",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /Git HEAD changed while the Splunkbase package was building\.[\s\S]*?Started at \$\{RELEASE_COMMIT\}[\s\S]*?Now at\s+\$\{post_build_commit\}/,
  "A HEAD change during webpack must report both the starting and current commits",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /release-provenance\.json[\s\S]*?"git_commit"[\s\S]*?"source_tree_clean": %s[\s\S]*?"release_eligible": %s/,
  "Splunkbase packaging must emit source cleanliness and release eligibility provenance",
);
assert.doesNotMatch(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /# Built:/,
  "Packaging must not inject mutable build provenance into app.conf",
);
assert.match(
  fs.readFileSync(APP_CONF_SOURCE, "utf8"),
  /^build = 0$/m,
  "The committed app source must keep a build-zero placeholder",
);
assert.equal(
  (fs.readFileSync(APP_CONF_SOURCE, "utf8").match(/^version = 0\.0\.0$/gm) || []).length,
  2,
  "The source app.conf must keep both version fields at the placeholder",
);
const sourceManifest = JSON.parse(fs.readFileSync(APP_MANIFEST_SOURCE, "utf8"));
assert.equal(sourceManifest.info.id.version, "0.0.0");
assert.equal(sourceManifest.info.releaseDate, "1970-01-01");
assert.equal(sourceManifest.info.releaseNotes.name, "Version 0.0.0 Release Notes");
assert.match(
  fs.readFileSync(VERIFY_SCRIPT_SOURCE, "utf8"),
  /FORBIDDEN_RUNTIME_FILE_EXTENSIONS[\s\S]*?findDirectoriesNamed[\s\S]*?__pycache__/,
  "Final production verification must reject bytecode and cache directories",
);
assert.match(
  fs.readFileSync(VERIFY_SCRIPT_SOURCE, "utf8"),
  /SOURCE_MAP_DIRECTIVE_PATTERN[\s\S]*?source-map directives/,
  "Final production verification must reject source maps embedded in JavaScript bundles",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /verify_final_archive\(\)[\s\S]*?tar -xzf "\$archive_path"[\s\S]*?verify_production_assets\.js[\s\S]*?verify_final_archive "\$ARCHIVE_TMP"/,
  "Packaging must re-extract and validate the completed archive before publication",
);
const buildScript = fs.readFileSync(BUILD_SCRIPT_SOURCE, "utf8");
assert.match(
  buildScript,
  /from_stage.*?developer_profile=1/s,
  "The root build wrapper must make --fast imply the developer profile",
);
assert.match(
  buildScript,
  /worktree_has_uncommitted_changes\(\)[\s\S]*?developer_profile=1[\s\S]*?Uncommitted changes detected/,
  "Uncommitted local packaging must select the developer profile unless --splunkbase is explicit",
);
assert.match(
  buildScript,
  /no_build" -eq 0 && "\$splunkbase_profile_explicit" -eq 0 && "\$developer_profile" -eq 0/,
  "Dirty-tree developer selection must not apply to --no-build reuse or explicit Splunkbase requests",
);
assert.doesNotMatch(
  buildScript,
  /local_splunkbase_validation|--local-validation|SCD_PACKAGE_BUILD_FLOOR|package_build_floor|installed_app_conf/,
  "Install and deploy targets must not alter Splunkbase package construction",
);
assert.match(
  buildScript,
  /--splunkbase cannot be used with --fast\/--from-stage/,
  "An explicit SplunkBase profile must reject watcher-built stage reuse",
);
assert.match(
  buildScript,
  /find_release_archive\(\)[\s\S]*?expected_package_id[\s\S]*?expected_version[\s\S]*?expected_profile[\s\S]*?expected_name="\$\{APP_NAME\}-\$\{archive_version\}-\$\{archive_build\}\$\{profile_suffix\}\.tar\.gz"/,
  "The root build wrapper must resolve version-build archives by package identity and profile",
);
assert.match(
  buildScript,
  /package_path="\$\(find_release_archive "\$source_package_id" "\$build_version" "\$package_profile"\)"/,
  "A fresh root build must select the highest archive produced for VERSION and profile",
);
assert.doesNotMatch(
  buildScript,
  /app_conf_build\(\)|installed_build=/,
  "The target's installed build must not influence package allocation",
);
assert.doesNotMatch(buildScript, /-sha256-/, "The root build wrapper must not require hash-qualified filenames");
assert.match(
  buildScript,
  /verify_release_archive\(\)[\s\S]*?gzip -t[\s\S]*?filename must contain its version and build[\s\S]*?release_eligible[\s\S]*?verify_release_archive "\$package_path" "\$package_profile"/,
  "The root wrapper must verify archive integrity, identity, and release eligibility before use",
);
assert.doesNotMatch(
  buildScript,
  /\.sha256|sha256_file|checksum sidecar/,
  "The root build wrapper must not require a checksum sidecar",
);

exerciseCleanBuild();
exerciseReleaseIdentityValidation();
exerciseFromStageDefaultsToDeveloperProfile();
exercisePackagingProfiles();
exercisePostBuildSourceVerification();
exerciseProductionVerifierCacheRejection();
exerciseRootBuildArchiveResolution();
exerciseLocalInstallProfileDefaults();
exerciseDirtyDefaultInstallSelectsDeveloper();
exerciseExcludedViewLinkSafety();
exerciseDevelopingStaticAssetExclusion();
exercisePromotedSearchbaseCatalogue();

console.log("Packaging P2 hardening contracts passed.");
