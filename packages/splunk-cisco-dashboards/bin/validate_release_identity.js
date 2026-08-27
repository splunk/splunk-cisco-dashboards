#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const resourcesRoot = path.join(packageRoot, "src", "main", "resources", "splunk");
const appConfPath = path.join(resourcesRoot, "default", "app.conf");
const appManifestPath = path.join(resourcesRoot, "app.manifest");
const versionPath = path.join(repositoryRoot, "VERSION");
const ledgerPath = path.join(repositoryRoot, "releases", "splunkbase-9257.json");
const validStates = new Set(["observed_archive", "published", "retired_candidate"]);
const validVersion = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

function fail(message) {
  throw new Error(`[release template] ${message}`);
}

function stanza(appConf, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = `${appConf}\n[__release_template_end__]\n`.match(
    new RegExp(`^\\[${escapedName}\\]\\n([\\s\\S]*?)(?=^\\[)`, "m"),
  );
  if (!match) fail(`app.conf is missing [${name}].`);
  return match[1];
}

function setting(body, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = body.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*(.*?)\\s*$`, "m"));
  if (!match) fail(`app.conf is missing ${key}.`);
  return match[1];
}

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`could not read ${path.relative(repositoryRoot, filePath)}: ${error.message}`);
  }
}

try {
  const version = fs.readFileSync(versionPath, "utf8").trim();
  const appConf = fs.readFileSync(appConfPath, "utf8");
  const manifest = loadJson(appManifestPath);
  const ledger = loadJson(ledgerPath);
  const id = stanza(appConf, "id");
  const launcher = stanza(appConf, "launcher");
  const install = stanza(appConf, "install");
  const pkg = stanza(appConf, "package");
  const packageId = ledger.app?.package_id;

  if (!validVersion.test(version)) fail(`VERSION has unsupported characters: ${version}`);
  if (setting(install, "build") !== "0") {
    fail("source app.conf [install] build must remain the placeholder 0.");
  }
  if (setting(id, "name") !== packageId) {
    fail("[id] name must match the release ledger package_id.");
  }
  if (setting(pkg, "id") !== packageId) {
    fail("[package] id must match the release ledger package_id.");
  }
  if (!Number.isSafeInteger(ledger.app?.splunkbase_app_id) || ledger.app.splunkbase_app_id < 1) {
    fail("release ledger must contain a positive numeric app.splunkbase_app_id.");
  }
  if (setting(id, "version") !== "0.0.0" || setting(launcher, "version") !== "0.0.0") {
    fail("source app.conf [id] and [launcher] versions must remain 0.0.0 placeholders.");
  }
  if (setting(pkg, "check_for_updates") !== "true") {
    fail("[package] check_for_updates must remain true for Splunkbase update discovery.");
  }
  if (setting(pkg, "show_upgrade_notification") !== "true") {
    fail("[package] show_upgrade_notification must remain true for Splunk Web notifications.");
  }

  if (manifest.info?.id?.name !== packageId) {
    fail("app.manifest info.id.name must match the release ledger package_id.");
  }
  if (manifest.info?.id?.version !== "0.0.0") {
    fail("source app.manifest info.id.version must remain the 0.0.0 placeholder.");
  }
  if (manifest.info?.releaseDate !== "1970-01-01") {
    fail("source app.manifest info.releaseDate must remain the 1970-01-01 placeholder.");
  }
  if (manifest.info?.releaseNotes?.name !== "Version 0.0.0 Release Notes") {
    fail("source app.manifest releaseNotes.name must remain the version placeholder.");
  }

  const allocations = ledger.build_allocations;
  if (!Array.isArray(allocations)) {
    fail("release ledger build_allocations must be an array.");
  }
  let priorBuild = 0;
  allocations.forEach((allocation, index) => {
    if (!validVersion.test(allocation.version || "")) {
      fail(`allocation ${index + 1} has an invalid version.`);
    }
    if (!Number.isSafeInteger(allocation.build) || allocation.build < 1) {
      fail(`allocation ${index + 1} must have a positive safe integer build.`);
    }
    if (allocation.build <= priorBuild) {
      fail("build_allocations must be strictly increasing by build number.");
    }
    if (!validStates.has(allocation.state)) {
      fail(`allocation ${index + 1} has an unsupported state.`);
    }
    priorBuild = allocation.build;
  });

  console.log(
    `Release template validated: ${packageId} (Splunkbase ${ledger.app.splunkbase_app_id}) v${version}; build allocated automatically.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
