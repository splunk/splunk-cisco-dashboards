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
const comparableVersion = /^(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

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

function compareNumericText(left, right) {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");
  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  }
  if (normalizedLeft === normalizedRight) return 0;
  return normalizedLeft < normalizedRight ? -1 : 1;
}

function parseComparableVersion(version) {
  const match = version.match(comparableVersion);
  if (!match) return null;
  const numericParts = match[1].split(".");
  const prereleaseParts = match[2] ? match[2].split(".") : [];
  if (prereleaseParts.some((part) => part.length === 0)) return null;
  return { numericParts, prereleaseParts };
}

function compareReleaseVersions(leftVersion, rightVersion) {
  const left = parseComparableVersion(leftVersion);
  const right = parseComparableVersion(rightVersion);
  if (!left || !right) return null;

  const numericLength = Math.max(left.numericParts.length, right.numericParts.length);
  for (let index = 0; index < numericLength; index += 1) {
    const comparison = compareNumericText(
      left.numericParts[index] || "0",
      right.numericParts[index] || "0",
    );
    if (comparison !== 0) return comparison;
  }

  if (left.prereleaseParts.length === 0 && right.prereleaseParts.length === 0) return 0;
  if (left.prereleaseParts.length === 0) return 1;
  if (right.prereleaseParts.length === 0) return -1;

  const prereleaseLength = Math.max(left.prereleaseParts.length, right.prereleaseParts.length);
  for (let index = 0; index < prereleaseLength; index += 1) {
    const leftPart = left.prereleaseParts[index];
    const rightPart = right.prereleaseParts[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftIsNumeric = /^\d+$/.test(leftPart);
    const rightIsNumeric = /^\d+$/.test(rightPart);
    if (leftIsNumeric && rightIsNumeric) return compareNumericText(leftPart, rightPart);
    if (leftIsNumeric !== rightIsNumeric) return leftIsNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
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
  if (setting(pkg, "id") !== ledger.app?.package_id) {
    fail("[package] id must match the release ledger package_id.");
  }
  if (
    !Number.isSafeInteger(ledger.app?.splunkbase_app_id) ||
    ledger.app.splunkbase_app_id < 1
  ) {
    fail("release ledger must contain a positive numeric app.splunkbase_app_id.");
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
  if (latestPublished) {
    const versionComparison = compareReleaseVersions(current.version, latestPublished.version);
    if (versionComparison === null) {
      fail("current and latest published versions must use comparable numeric release versions.");
    }
    if (versionComparison <= 0) {
      fail("the current version must be greater than the latest published release version.");
    }
  }

  console.log(
    `Release identity validated: ${ledger.app.package_id} (Splunkbase ${ledger.app.splunkbase_app_id}) v${version} build ${sourceBuild}.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
