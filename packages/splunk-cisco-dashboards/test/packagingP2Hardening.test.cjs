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

    const firstArchiveName = listArchives(distDir).find((name) =>
      new RegExp(`^${APP_NAME}-1\\.2\\.3-sha256-[0-9a-f]{64}\\.tar\\.gz$`).test(name),
    );
    assert.ok(firstArchiveName, "Splunkbase packaging must write a hash-qualified archive name");
    const firstArchive = path.join(distDir, firstArchiveName);
    const firstDigestPath = `${firstArchive}.sha256`;
    const firstDigest = sha256(firstArchive);
    assert.equal(
      fs.readFileSync(firstDigestPath, "utf8"),
      `${firstDigest}  ${firstArchiveName}\n`,
      "The immutable checksum sidecar must describe the exact archive bytes",
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
      "Hash-qualified packaging must not overwrite legacy version-only artifacts",
    );

    writeFile(
      path.join(fixture.stage, "appserver", "static", "pages", "fixture.js"),
      'const appBuild = "__SCD_PACKAGE_BUILD__"; const changed = true;\n',
    );
    run("bash", [fixture.packageScript], { cwd: fixture.packageRoot });
    const releaseArchives = listArchives(distDir).filter((name) =>
      name.includes("-sha256-") && !name.endsWith("-developer.tar.gz"),
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
    const developerArchiveName = listArchives(distDir).find((name) =>
      new RegExp(
        `^${APP_NAME}-1\\.2\\.3-sha256-[0-9a-f]{64}-developer\\.tar\\.gz$`,
      ).test(name),
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
      'FLOOR="${SCD_PACKAGE_BUILD_FLOOR:-0}"',
      'mkdir -p "${ROOT_DIR}/dist"',
      'for PRIOR in "${ROOT_DIR}/dist"/${APP_NAME}-*.tar.gz; do',
      '  [[ -f "${PRIOR}" ]] || continue',
      '  PRIOR_BUILD="$(tar -xzOf "${PRIOR}" "${APP_NAME}/default/app.conf" 2>/dev/null | awk -F= \'/^[[:space:]]*build[[:space:]]*=/{gsub(/[[:space:]]/, "", $2); print $2; exit}\' || true)"',
      '  if [[ "${PRIOR_BUILD}" =~ ^[0-9]+$ ]] && (( PRIOR_BUILD > FLOOR )); then FLOOR="${PRIOR_BUILD}"; fi',
      'done',
      'BUILD=$((FLOOR + 1))',
      'SUFFIX=""',
      '[[ "${1:-}" == "--developer" ]] && SUFFIX="-developer"',
      'WORK_DIR="$(mktemp -d)"',
      "trap 'rm -rf \"${WORK_DIR}\"' EXIT",
      'mkdir -p "${WORK_DIR}/${APP_NAME}/default"',
      'printf "[install]\\nbuild = %s\\n\\n[id]\\nname = splunk-cisco-dashboards\\nversion = %s\\n" "${BUILD}" "${VERSION}" > "${WORK_DIR}/${APP_NAME}/default/app.conf"',
      'ARCHIVE_TMP="${ROOT_DIR}/dist/.fixture-archive.tar.gz"',
      '(cd "${WORK_DIR}" && tar czf "${ARCHIVE_TMP}" "${APP_NAME}")',
      'SHA256="$(shasum -a 256 "${ARCHIVE_TMP}" | awk \'{print $1}\')"',
      'ARCHIVE="${ROOT_DIR}/dist/${APP_NAME}-${VERSION}-sha256-${SHA256}${SUFFIX}.tar.gz"',
      'mv "${ARCHIVE_TMP}" "${ARCHIVE}"',
      'printf "%s  %s\\n" "${SHA256}" "$(basename "${ARCHIVE}")" > "${ARCHIVE}.sha256"',
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
      /Tarball: .*splunk-cisco-dashboards-1\.2\.3-sha256-[0-9a-f]{64}\.tar\.gz/,
      "A fresh root build must resolve the newly created hash-addressed Splunkbase archive",
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
      /SHA-256 mismatch/,
      "The root wrapper must reject a changed immutable archive before any install action",
    );

    const developerOutput = run("bash", [fixture.buildPath, "--developer"], {
      cwd: fixture.root,
    });
    assert.match(
      developerOutput,
      /Tarball: .*splunk-cisco-dashboards-1\.2\.3-sha256-[0-9a-f]{64}-developer\.tar\.gz/,
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
      /SHA-256 mismatch|splunk.*install app/,
      "The no-archive path must stop before checksum or Splunk installation work",
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

    const developerOutput = run(
      "bash",
      [fixture.buildPath, "--install", "--minify", "--auth", "fixture:password"],
      { cwd: fixture.root, env },
    );
    assert.match(
      developerOutput,
      /Profile:\s+developer \(released \+ developing resources\)/,
      "A fresh local install must default to the developer profile",
    );
    assert.match(
      developerOutput,
      /Tarball: .*-[0-9a-f]{64}-developer\.tar\.gz/,
      "An implicit local developer install must use the developer artifact namespace",
    );
    assert.match(
      developerOutput,
      /v1\.2\.3 \(build 21\)/,
      "A local install must allocate above the target's installed build",
    );

    const splunkbaseOutput = run(
      "bash",
      [
        fixture.buildPath,
        "--splunkbase",
        "--install",
        "--minify",
        "--auth",
        "fixture:password",
      ],
      { cwd: fixture.root, env },
    );
    assert.match(
      splunkbaseOutput,
      /Profile:\s+Splunkbase \(released resources only\)/,
      "--splunkbase must preserve explicit local release-profile validation",
    );
    assert.match(
      splunkbaseOutput,
      /Tarball: .*-[0-9a-f]{64}\.tar\.gz/,
      "An explicit SplunkBase install must use the release artifact namespace",
    );
    assert.doesNotMatch(
      splunkbaseOutput.match(/Tarball: .*$/m)?.[0] || "",
      /-developer\.tar\.gz/,
      "An explicit SplunkBase install must not resolve a developer archive",
    );
    assert.match(
      splunkbaseOutput,
      /v1\.2\.3 \(build 22\)/,
      "The explicit SplunkBase build must continue above prior generated artifacts",
    );
    assert.equal(
      fs.readFileSync(splunkLog, "utf8").trim().split("\n").length,
      2,
      "Both profile selections must reach the local Splunk installer",
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
  /PKG_PATH=.*-sha256-\$\{PACKAGE_SHA256\}/,
  "Artifact names must remain content-addressed",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /history_build="\$\(resolve_release_history_build_floor\)"[\s\S]*?dist_build=0[\s\S]*?target_build[\s\S]*?new_build=\$\(\(build_floor \+ 1\)\)/,
  "Packaging must allocate the next build from history, dist, and target floors",
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
  /resolve_clean_release_commit\(\)[\s\S]*?git -C "\$ROOT_DIR" status --porcelain --untracked-files=all[\s\S]*?post_build_commit="\$\(resolve_clean_release_commit\)"/,
  "Splunkbase packaging must require a clean, committed source state",
);
assert.match(
  fs.readFileSync(PACKAGE_SCRIPT_SOURCE, "utf8"),
  /release-provenance\.json[\s\S]*?"git_commit"[\s\S]*?"source_tree_clean": true/,
  "Splunkbase packaging must emit a standalone source-provenance manifest",
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
  /no_build.*?do_install.*?do_deploy[\s\S]*?developer_profile=1/,
  "Fresh local install and deploy workflows must default to the developer profile",
);
assert.match(
  buildScript,
  /--splunkbase cannot be used with --fast\/--from-stage/,
  "An explicit SplunkBase profile must reject watcher-built stage reuse",
);
assert.match(
  buildScript,
  /archive_modified_epoch\(\)[\s\S]*?expected_profile.*?developer[\s\S]*?newest_mtime/s,
  "The root build wrapper must choose the newest matching developer archive",
);
assert.match(
  buildScript,
  /find_release_archive\(\)[\s\S]*?expected_package_id[\s\S]*?expected_version[\s\S]*?expected_profile[\s\S]*?highest_build[\s\S]*?-sha256-\*\.tar\.gz/,
  "The root build wrapper must resolve the highest hash-addressed build by package, VERSION, and profile",
);
assert.match(
  buildScript,
  /package_path="\$\(find_release_archive "\$source_package_id" "\$build_version" "\$package_profile"\)"/,
  "A fresh root build must select the highest archive produced for VERSION and profile",
);
assert.match(
  buildScript,
  /app_conf_build\(\)[\s\S]*?installed_app_conf=[\s\S]*?app_conf_build[\s\S]*?SCD_PACKAGE_BUILD_FLOOR="\$package_build_floor"/,
  "Local build/install must pass the installed app build as an allocation floor",
);
assert.doesNotMatch(
  buildScript,
  /package_path="\$\{DIST_DIR\}\/\$\{APP_NAME\}-\$\{build_version\}(?:-developer)?\.tar\.gz"/,
  "The root build wrapper must not expect the retired version-only archive name",
);
assert.match(
  buildScript,
  /verify_release_archive\(\)[\s\S]*?checksum sidecar[\s\S]*?SHA-256 mismatch[\s\S]*?verify_release_archive "\$package_path"/,
  "The root build wrapper must verify the immutable filename, sidecar, and bytes before use",
);

exerciseCleanBuild();
exerciseReleaseIdentityValidation();
exerciseFromStageDefaultsToDeveloperProfile();
exercisePackagingProfiles();
exercisePostBuildSourceVerification();
exerciseProductionVerifierCacheRejection();
exerciseRootBuildArchiveResolution();
exerciseLocalInstallProfileDefaults();

console.log("Packaging P2 hardening contracts passed.");
