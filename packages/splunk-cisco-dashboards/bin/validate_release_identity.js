#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const appConfPath = path.join(
  packageRoot,
  "src",
  "main",
  "resources",
  "splunk",
  "default",
  "app.conf",
);
const versionPath = path.join(repositoryRoot, "VERSION");
const ledgerPath = path.join(repositoryRoot, "releases", "splunkbase-9257.json");
const validStates = new Set([
  "observed_archive",
  "published",
  "retired_candidate",
  "current",
]);
const validVersion = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

function fail(message) {
  throw new Error(`[release identity] ${message}`);
}

function stanza(appConf, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = `${appConf}\n[__release_identity_end__]\n`.match(
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
  const ledger = loadJson(ledgerPath);
  const id = stanza(appConf, "id");
  const launcher = stanza(appConf, "launcher");
  const install = stanza(appConf, "install");
  const pkg = stanza(appConf, "package");
  const sourceBuildText = setting(install, "build");
  const sourceBuild = Number(sourceBuildText);

  if (!validVersion.test(version)) fail(`VERSION has unsupported characters: ${version}`);
  if (!/^[1-9][0-9]*$/.test(sourceBuildText) || !Number.isSafeInteger(sourceBuild)) {
    fail("[install] build must be a positive safe integer.");
  }
  if (setting(id, "name") !== ledger.app?.package_id) {
    fail("[id] name must match the release ledger package_id.");
  }
  if (setting(id, "version") !== version || setting(launcher, "version") !== version) {
    fail("VERSION, [id] version, and [launcher] version must match.");
  }
  if (setting(pkg, "check_for_updates") !== "true") {
    fail("[package] check_for_updates must remain true for Splunkbase update discovery.");
  }
  if (setting(pkg, "show_upgrade_notification") !== "true") {
    fail("[package] show_upgrade_notification must remain true for Splunk Web notifications.");
  }

  const allocations = ledger.build_allocations;
  if (!Array.isArray(allocations) || allocations.length === 0) {
    fail("release ledger must contain build_allocations.");
  }
  let priorBuild = 0;
  let currentCount = 0;
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
    if (allocation.state === "current") {
      currentCount += 1;
      if (index !== allocations.length - 1) {
        fail("the current allocation must be the final ledger entry.");
      }
    }
    priorBuild = allocation.build;
  });
  if (currentCount !== 1) fail("release ledger must contain exactly one current allocation.");

  const current = allocations[allocations.length - 1];
  if (current.version !== version || current.build !== sourceBuild) {
    fail("source VERSION and [install] build must match the final current ledger allocation.");
  }
  if (allocations.length > 1 && sourceBuild <= allocations[allocations.length - 2].build) {
    fail("the current build must be greater than every preceding allocation.");
  }
  const latestPublished = [...allocations]
    .reverse()
    .find((allocation) => allocation.state === "published");
  if (latestPublished && current.version === latestPublished.version) {
    fail("the current version must differ from the latest published release version.");
  }

  console.log(
    `Release identity validated: ${ledger.app.package_id} v${version} build ${sourceBuild}.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
