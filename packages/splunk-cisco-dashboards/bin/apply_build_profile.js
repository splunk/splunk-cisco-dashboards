#!/usr/bin/env node
/* eslint-disable no-console */

"use strict";

const fs = require("fs");
const path = require("path");
const { XMLBuilder, XMLParser } = require("fast-xml-parser");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(
  PACKAGE_ROOT,
  "config",
  "build-profile-manifest.json",
);
const SOURCE_VIEWS_DIR = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "resources",
  "splunk",
  "default",
  "data",
  "ui",
  "views",
);
const SOURCE_NAV_PATH = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "resources",
  "splunk",
  "default",
  "data",
  "ui",
  "nav",
  "default.xml",
);
const SOURCE_SEARCHBASE_PATH = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "resources",
  "splunk",
  "default",
  "searchbase.conf",
);
const SOURCE_SAVEDSEARCHES_PATH = path.join(
  PACKAGE_ROOT,
  "src",
  "main",
  "resources",
  "splunk",
  "default",
  "savedsearches.conf",
);
const ALLOWED_PROFILES = new Set(["developer", "splunkbase"]);
const XML_OPTIONS = {
  ignoreAttributes: false,
  preserveOrder: true,
  commentPropName: "#comment",
  trimValues: false,
  processEntities: false,
};

function readManifest(manifestPath = MANIFEST_PATH) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read app build manifest: ${error.message}`);
  }

  if (
    manifest.schemaVersion !== 1 ||
    !Array.isArray(manifest.developing?.views) ||
    !Array.isArray(manifest.developing?.searchbaseStanzas) ||
    !Array.isArray(manifest.developing?.savedSearches)
  ) {
    throw new Error(
      "build-profile-manifest.json must declare schemaVersion 1 and developing resource arrays",
    );
  }
  return manifest;
}

function listSourceViewIds(sourceViewsDir = SOURCE_VIEWS_DIR) {
  return fs
    .readdirSync(sourceViewsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".xml"))
    .map((entry) => path.basename(entry.name, ".xml"))
    .sort();
}

function parseConfStanzas(source) {
  const headerPattern = /^\[([^\]\r\n]+)\][ \t]*(?:\r?\n|$)/gm;
  const matches = [...source.matchAll(headerPattern)];
  const stanzas = matches.map((match, index) => ({
    id: match[1],
    text: source.slice(
      match.index,
      index + 1 < matches.length ? matches[index + 1].index : source.length,
    ),
  }));
  return {
    preamble: matches.length > 0 ? source.slice(0, matches[0].index) : source,
    stanzas,
  };
}

function listSourceSearchbaseStanzaIds(
  sourceSearchbasePath = SOURCE_SEARCHBASE_PATH,
) {
  return parseConfStanzas(fs.readFileSync(sourceSearchbasePath, "utf8"))
    .stanzas.map(({ id }) => id)
    .sort();
}

function listSourceSavedSearchIds(
  sourceSavedSearchesPath = SOURCE_SAVEDSEARCHES_PATH,
) {
  return parseConfStanzas(fs.readFileSync(sourceSavedSearchesPath, "utf8"))
    .stanzas.map(({ id }) => id)
    .sort();
}

function validateDevelopingResourceIds(developingIds, sourceIds, label) {
  const sourceSet = new Set(sourceIds);
  const duplicates = developingIds.filter(
    (id, index) => developingIds.indexOf(id) !== index,
  );
  const stale = developingIds.filter((id) => !sourceSet.has(id));
  const invalid = developingIds.filter(
    (id) => typeof id !== "string" || id.trim().length === 0,
  );

  if (invalid.length > 0) {
    throw new Error(`Invalid developing ${label} ID in manifest`);
  }

  if (duplicates.length > 0 || stale.length > 0) {
    const details = [];
    if (duplicates.length > 0) {
      details.push(`duplicates: ${[...new Set(duplicates)].join(", ")}`);
    }
    if (stale.length > 0) {
      details.push(`missing from source: ${stale.join(", ")}`);
    }
    throw new Error(
      `Developing ${label} manifest is out of sync (${details.join("; ")})`,
    );
  }
}

function listFivePillarViewIds(sourceNavPath = SOURCE_NAV_PATH) {
  const navXml = fs.readFileSync(sourceNavPath, "utf8");
  const collections = [
    ...navXml.matchAll(/<collection label="([^"]+)"[^>]*>([\s\S]*?)<\/collection>/g),
  ].slice(0, 5);

  return collections.flatMap((collection) =>
    [...collection[2].matchAll(/dashboard_manager#\/([^"?]+)/g)].map(
      (match) => match[1],
    ),
  );
}

function validateManifest(
  manifest = readManifest(),
  sourceViewsDir = SOURCE_VIEWS_DIR,
  sourceSearchbasePath = SOURCE_SEARCHBASE_PATH,
  sourceSavedSearchesPath = SOURCE_SAVEDSEARCHES_PATH,
) {
  validateDevelopingResourceIds(
    manifest.developing.views,
    listSourceViewIds(sourceViewsDir),
    "view",
  );
  validateDevelopingResourceIds(
    manifest.developing.searchbaseStanzas,
    listSourceSearchbaseStanzaIds(sourceSearchbasePath),
    "Searchbase stanza",
  );
  validateDevelopingResourceIds(
    manifest.developing.savedSearches,
    listSourceSavedSearchIds(sourceSavedSearchesPath),
    "saved search",
  );

  const fivePillarViewIds = new Set(listFivePillarViewIds());
  const excludedPillarViews = manifest.developing.views.filter((viewId) =>
    fivePillarViewIds.has(viewId),
  );
  if (excludedPillarViews.length > 0) {
    throw new Error(
      `Five-pillar menu views cannot be developing-only: ${excludedPillarViews.join(", ")}`,
    );
  }

  return manifest;
}

function hrefTargetsView(href, viewId) {
  if (typeof href !== "string") return false;
  if (href === viewId || href.startsWith(`${viewId}?`)) return true;

  const hashRoute = href.match(/#\/([^?&#/]+)/);
  return Boolean(hashRoute && hashRoute[1] === viewId);
}

function nodeTargetsExcludedView(node, excludedIds) {
  if (!node || typeof node !== "object") return false;
  const attributes = node[":@"] || {};

  if (Object.prototype.hasOwnProperty.call(node, "view")) {
    return excludedIds.has(attributes["@_name"]);
  }
  if (Object.prototype.hasOwnProperty.call(node, "a")) {
    for (const viewId of excludedIds) {
      if (hrefTargetsView(attributes["@_href"], viewId)) return true;
    }
  }
  return false;
}

function filterNavigationNodes(nodes, excludedIds) {
  return nodes.flatMap((node) => {
    if (nodeTargetsExcludedView(node, excludedIds)) return [];

    const filteredNode = { ...node };
    for (const [key, value] of Object.entries(filteredNode)) {
      if (Array.isArray(value) && key !== "#text") {
        filteredNode[key] = filterNavigationNodes(value, excludedIds);
      }
    }
    return [filteredNode];
  });
}

function countNavigationReferences(nodes, viewId) {
  let count = 0;
  for (const node of nodes) {
    if (nodeTargetsExcludedView(node, new Set([viewId]))) count += 1;
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value) && key !== "#text") {
        count += countNavigationReferences(value, viewId);
      }
    }
  }
  return count;
}

function filterConfStanzas(source, excludedIds) {
  const { preamble, stanzas } = parseConfStanzas(source);
  return (
    preamble +
    stanzas
      .filter(({ id }) => !excludedIds.has(id))
      .map(({ text }) => text)
      .join("")
  );
}

function applyBuildProfile(appRoot, profile, options = {}) {
  if (!ALLOWED_PROFILES.has(profile)) {
    throw new Error(
      `Unknown app profile "${profile}"; expected developer or splunkbase`,
    );
  }

  const manifest = validateManifest(
    options.manifest || readManifest(options.manifestPath),
    options.sourceViewsDir || SOURCE_VIEWS_DIR,
    options.sourceSearchbasePath || SOURCE_SEARCHBASE_PATH,
    options.sourceSavedSearchesPath || SOURCE_SAVEDSEARCHES_PATH,
  );
  const appViewsDir = path.join(appRoot, "default", "data", "ui", "views");
  const appNavPath = path.join(
    appRoot,
    "default",
    "data",
    "ui",
    "nav",
    "default.xml",
  );
  const appSearchbasePath = path.join(appRoot, "default", "searchbase.conf");
  const appSavedSearchesPath = path.join(
    appRoot,
    "default",
    "savedsearches.conf",
  );
  const developingViewIds = [...manifest.developing.views].sort();
  const developingSearchbaseStanzaIds = [
    ...manifest.developing.searchbaseStanzas,
  ].sort();
  const developingSavedSearchIds = [
    ...manifest.developing.savedSearches,
  ].sort();

  if (
    !fs.existsSync(appViewsDir) ||
    !fs.existsSync(appNavPath) ||
    !fs.existsSync(appSearchbasePath) ||
    !fs.existsSync(appSavedSearchesPath)
  ) {
    throw new Error(`Target is not a staged Splunk app: ${appRoot}`);
  }

  for (const viewId of developingViewIds) {
    const viewPath = path.join(appViewsDir, `${viewId}.xml`);
    if (!fs.existsSync(viewPath)) {
      throw new Error(`Staged app is missing manifest view: ${viewPath}`);
    }
  }

  if (profile === "developer") {
    return {
      profile,
      developingViewIds,
      developingSearchbaseStanzaIds,
      developingSavedSearchIds,
      removedViewIds: [],
      removedSearchbaseStanzaIds: [],
      removedSavedSearchIds: [],
      removedNavReferences: 0,
    };
  }

  const navXml = fs.readFileSync(appNavPath, "utf8");
  const parser = new XMLParser(XML_OPTIONS);
  const parsedNav = parser.parse(navXml);
  let removedNavReferences = 0;
  for (const viewId of developingViewIds) {
    removedNavReferences += countNavigationReferences(parsedNav, viewId);
  }

  const filteredNav = filterNavigationNodes(
    parsedNav,
    new Set(developingViewIds),
  );
  const builder = new XMLBuilder({
    ...XML_OPTIONS,
    format: false,
    suppressEmptyNode: true,
  });
  fs.writeFileSync(appNavPath, `${builder.build(filteredNav).trimEnd()}\n`);

  for (const viewId of developingViewIds) {
    fs.unlinkSync(path.join(appViewsDir, `${viewId}.xml`));
  }

  const searchbaseSource = fs.readFileSync(appSearchbasePath, "utf8");
  fs.writeFileSync(
    appSearchbasePath,
    filterConfStanzas(
      searchbaseSource,
      new Set(developingSearchbaseStanzaIds),
    ),
  );

  const savedSearchesSource = fs.readFileSync(appSavedSearchesPath, "utf8");
  fs.writeFileSync(
    appSavedSearchesPath,
    filterConfStanzas(savedSearchesSource, new Set(developingSavedSearchIds)),
  );

  return {
    profile,
    developingViewIds,
    developingSearchbaseStanzaIds,
    developingSavedSearchIds,
    removedViewIds: developingViewIds,
    removedSearchbaseStanzaIds: developingSearchbaseStanzaIds,
    removedSavedSearchIds: developingSavedSearchIds,
    removedNavReferences,
  };
}

function main() {
  const appRoot = process.argv[2];
  const profile = process.argv[3] || "splunkbase";
  if (!appRoot) {
    console.error(
      "Usage: node bin/apply_build_profile.js <staged-app-root> [splunkbase|developer]",
    );
    process.exit(2);
  }

  try {
    const result = applyBuildProfile(path.resolve(appRoot), profile);
    if (profile === "developer") {
      console.log(
        `[build-profile] developer: included ${result.developingViewIds.length} ` +
          `developing view(s), ${result.developingSearchbaseStanzaIds.length} ` +
          `developing Searchbase stanza(s), and ` +
          `${result.developingSavedSearchIds.length} developing saved search(es)`,
      );
    } else {
      console.log(
        `[build-profile] splunkbase: excluded ${result.removedViewIds.length} ` +
          `developing view(s), ${result.removedNavReferences} navigation ` +
          `reference(s), ${result.removedSearchbaseStanzaIds.length} ` +
          `developing Searchbase stanza(s), and ` +
          `${result.removedSavedSearchIds.length} developing saved search(es)`,
      );
    }
  } catch (error) {
    console.error(`[build-profile] ERROR: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  applyBuildProfile,
  countNavigationReferences,
  filterConfStanzas,
  filterNavigationNodes,
  hrefTargetsView,
  listSourceSearchbaseStanzaIds,
  listSourceSavedSearchIds,
  listSourceViewIds,
  parseConfStanzas,
  readManifest,
  validateManifest,
  validateDevelopingResourceIds,
};
