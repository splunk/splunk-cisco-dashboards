"use strict";

const assert = require("assert/strict");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CLEAN_BUILD_SOURCE = path.join(PACKAGE_ROOT, "bin", "clean_build.sh");

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

test("clean build restores only linked-stage runtime state", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "scd-clean-state-"));
  try {
    const packageRoot = path.join(root, "package");
    const script = path.join(packageRoot, "bin", "clean_build.sh");
    const stage = path.join(packageRoot, "stage");
    const sourceLookups = path.join(
      packageRoot,
      "src",
      "main",
      "resources",
      "splunk",
      "lookups",
    );
    const liveApp = path.join(root, "splunk", "etc", "apps", "splunk-cisco-dashboards");
    const tempDir = path.join(root, "tmp");

    fs.mkdirSync(path.dirname(script), { recursive: true });
    fs.copyFileSync(CLEAN_BUILD_SOURCE, script);
    fs.chmodSync(script, 0o755);
    fs.mkdirSync(tempDir, { recursive: true });

    writeFile(path.join(sourceLookups, "source-owned.csv"), "source=1\n");
    writeFile(path.join(sourceLookups, "runtime-seed.csv.default"), "seed=1\n");
    writeFile(path.join(stage, "local", "runtime.conf"), "keep=1\n");
    writeFile(
      path.join(stage, "metadata", "local.meta"),
      "[]\naccess = read : [ * ], write : [ admin ]\n",
    );
    writeFile(path.join(stage, "lookups", "runtime-state.csv"), "state=keep\n");
    writeFile(path.join(stage, "lookups", "source-owned.csv"), "source=stale-stage-copy\n");
    writeFile(
      path.join(stage, "lookups", "runtime-seed.csv.default"),
      "seed=stale-stage-copy\n",
    );
    writeFile(path.join(stage, "default", "app.conf"), "[install]\nbuild = 1\n");

    fs.mkdirSync(path.dirname(liveApp), { recursive: true });
    fs.symlinkSync(stage, liveApp, "dir");

    execFileSync("bash", [script], {
      cwd: packageRoot,
      env: { ...process.env, TMPDIR: tempDir },
      stdio: "pipe",
    });

    assert.equal(
      fs.readFileSync(path.join(liveApp, "local", "runtime.conf"), "utf8"),
      "keep=1\n",
      "A linked app retains local configuration after a normal clean",
    );
    assert.equal(
      fs.readFileSync(path.join(liveApp, "metadata", "local.meta"), "utf8"),
      "[]\naccess = read : [ * ], write : [ admin ]\n",
      "A linked app retains mutable metadata after a normal clean",
    );
    assert.equal(
      fs.readFileSync(path.join(liveApp, "lookups", "runtime-state.csv"), "utf8"),
      "state=keep\n",
      "A linked app retains generated runtime lookup CSVs after a normal clean",
    );
    assert.equal(
      fs.existsSync(path.join(stage, "lookups", "source-owned.csv")),
      false,
      "Source-owned lookup CSVs are rebuilt from source instead of preserved from stage",
    );
    assert.equal(
      fs.existsSync(path.join(stage, "lookups", "runtime-seed.csv.default")),
      false,
      "Source *.csv.default seeds are rebuilt from source instead of preserved from stage",
    );
    assert.equal(
      fs.existsSync(path.join(stage, "default", "app.conf")),
      false,
      "A normal clean still removes generated stage content",
    );
    assert.deepEqual(
      fs.readdirSync(tempDir),
      [],
      "The private runtime-state backup is removed after successful restoration",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
