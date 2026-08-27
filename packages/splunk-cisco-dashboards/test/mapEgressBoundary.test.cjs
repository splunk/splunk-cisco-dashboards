"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const packageRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(packageRoot, "src", "main");
const read = (relativePath) =>
  fs.readFileSync(path.join(packageRoot, relativePath), "utf8");

const collectTextFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTextFiles(target);
    return /\.(?:conf|html|js|jsx|md|ts|tsx|xml)$/.test(entry.name)
      ? [target]
      : [];
  });

const shippedSource = collectTextFiles(sourceRoot)
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");

const customerTopology = read(
  "src/main/webapp/common/components/workspace/CustomerTopologyMap.tsx",
);
const secureOperations = read(
  "src/main/webapp/pages/secure_operations_glass/index.tsx",
);
const workplaceSpaces = read(
  "src/main/resources/splunk/default/data/ui/views/workplace_spaces_intelligence.xml",
);
const mapTileStyles = read("src/main/webapp/common/maps/mapTileStyles.ts");
const userGuide = read("src/main/webapp/pages/user_guide/index.tsx");

test("shipped map surfaces never send placement text to public services", () => {
  for (const host of [
    "nominatim.openstreetmap.org",
    "cdnjs.cloudflare.com/ajax/libs/leaflet",
  ]) {
    assert.doesNotMatch(
      shippedSource,
      new RegExp(host.replaceAll(".", "\\."), "i"),
      `${host} must not be reachable from shipped browser code or view definitions`,
    );
  }
});

test("map styles use fixed keyless provider tiles with an offline option", () => {
  assert.match(
    mapTileStyles,
    /\/static\/app\/splunk-cisco-dashboards\/offline-map-tile-light\.png/,
  );
  assert.match(
    mapTileStyles,
    /\/static\/app\/splunk-cisco-dashboards\/offline-map-tile-dark\.png/,
  );
  for (const style of [
    "Street",
    "Satellite",
    "Terrain",
    "Dark Ops",
    "Navigation",
    "Offline Grid",
  ]) {
    assert.match(mapTileStyles, new RegExp(`label: "${style}"`));
  }
  assert.match(mapTileStyles, /server\.arcgisonline\.com/);
  assert.doesNotMatch(mapTileStyles, /carto|api[_-]?key|access[_-]?token|token=/i);
  assert.match(mapTileStyles, /isDark \? "dark-ops" : "terrain"/);
  assert.match(customerTopology, /Switch base map\. Current:/);
  assert.match(customerTopology, /scrollWheelZoom/);
  assert.match(customerTopology, /MAP_TILE_STYLE_PRESETS/);
  assert.match(secureOperations, /scd-glass-map-style-switcher/);
  assert.match(secureOperations, /aria-pressed=\{mapStyle === preset\.id\}/);
  assert.match(
    workplaceSpaces,
    /"baseLayerTileServer": "https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/Canvas\/World_Dark_Gray_Base\/MapServer\/tile\/\{z\}\/\{y\}\/\{x\}"/,
  );
  assert.doesNotMatch(
    workplaceSpaces,
    /carto|api[_-]?key|access[_-]?token|token=/i,
  );

  for (const asset of [
    "src/main/resources/splunk/appserver/static/offline-map-tile-light.png",
    "src/main/resources/splunk/appserver/static/offline-map-tile-dark.png",
  ]) {
    assert.deepEqual(
      fs.readFileSync(path.join(packageRoot, asset)).subarray(0, 8),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
});

test("site placement remains local and documents the offline boundary", () => {
  assert.match(customerTopology, /resolveSitePlacement\(lookupText\)/);
  assert.doesNotMatch(customerTopology, /resolveRemoteSitePlacement|window\.fetch/);
  assert.match(customerTopology, /not in the offline city list/);
  assert.match(
    userGuide,
    /offline city list[\s\S]*?explicit coordinates[\s\S]*?never sent to a public geocoder/,
  );
});
