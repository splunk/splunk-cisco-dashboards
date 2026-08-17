"use strict";

const assert = require("assert").strict;
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repositoryRoot = path.resolve(__dirname, "../../..");
const webappRoot = path.resolve(__dirname, "../src/main/webapp");
const legacyNamespace = ["Flo", "rida"].join("");
const legacyComponentRoot = path.join(webappRoot, "common/components", legacyNamespace);
const workspaceComponentRoot = path.join(
  webappRoot,
  "common/components/workspace",
);

assert.equal(
  fs.existsSync(legacyComponentRoot),
  false,
  "The retired deployment-specific component namespace must not be restored",
);
assert.equal(
  fs.existsSync(workspaceComponentRoot),
  true,
  "Shared workspace components must remain in the neutral workspace namespace",
);

const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const pending = [webappRoot];
const legacyImports = [];

while (pending.length > 0) {
  const directory = pending.pop();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      pending.push(absolutePath);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    if (fs.readFileSync(absolutePath, "utf8").includes(`components/${legacyNamespace}`)) {
      legacyImports.push(path.relative(webappRoot, absolutePath));
    }
  }
}

assert.deepEqual(
  legacyImports,
  [],
  `Active source must not import from the retired deployment namespace: ${legacyImports.join(", ")}`,
);

const excludedFiles = new Set([
  "yarn.lock",
]);
const deploymentTerms = [
  ["Flo", "rida"].join(""),
  ["FD", "EM"].join(""),
  ["Talla", "hassee"].join(""),
  ["Auburn", "dale"].join(""),
  ["Orlan", "do"].join(""),
  ["My", ["Flo", "rida"].join(""), "Net"].join(""),
  ["Betty ", "Easley"].join(""),
  ["Shumard ", "Oak"].join(""),
  ["Fred ", "Jones"].join(""),
  ["Polk ", "City"].join(""),
  ["Bland", "ing"].join(""),
  ["Ru", "dd"].join(""),
  ["Sadow", "ski"].join(""),
  ["SL", "RC"].join(""),
  ["FA", "CHC"].join(""),
  ["State", "wide"].join(""),
];
const deploymentCodes = [
  ["T", "LH"].join(""),
  ["A", "UB"].join(""),
  ["M", "CO"].join(""),
  ["SE", "OC"].join(""),
  ["OR", "L"].join(""),
  ["MF", "N"].join(""),
];
const operationsOnlyTerm = ["acti", "vation"].join("");
const allowedTechnicalIdentifiers = [
  [["acti", "vation"].join(""), "Constraint"].join(""),
  ["zoom", ["Acti", "vation"].join(""), "KeyCode"].join(""),
];
const retiredDomainPrefixes = [
  ["ds_", "act", "_"].join(""),
  ["viz_", "act", "_"].join(""),
  ["dashboard_spaces_intelligence_v1_", "act", "_"].join(""),
];
const findings = [];
const filesToInspect = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: repositoryRoot },
)
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .filter((relativePath) => !excludedFiles.has(relativePath))
  .map((relativePath) => ({
    absolutePath: path.join(repositoryRoot, relativePath),
    relativePath,
  }))
  .filter(({ absolutePath }) => fs.existsSync(absolutePath));

const deploymentTermPattern = new RegExp(
  deploymentTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
);
const deploymentCodePattern = new RegExp(`\\b(?:${deploymentCodes.join("|")})\\b`, "i");
const operationsOnlyPattern = new RegExp(operationsOnlyTerm, "i");
const retiredDomainPattern = new RegExp(retiredDomainPrefixes.join("|"), "i");

for (const { absolutePath, relativePath } of filesToInspect) {
  if (
    deploymentTermPattern.test(relativePath) ||
    deploymentCodePattern.test(relativePath) ||
    operationsOnlyPattern.test(relativePath) ||
    retiredDomainPattern.test(relativePath)
  ) {
    findings.push(`${relativePath}: deployment-specific path`);
  }

  const buffer = fs.readFileSync(absolutePath);
  if (buffer.includes(0)) continue;
  const rawText = buffer.toString("utf8");
  const dataUriPattern = /data:[^'"\s]*;base64,([A-Za-z0-9+/=]+)/g;
  const encodedPayloads = [...rawText.matchAll(dataUriPattern)].map((match) => match[1]);
  const sourceText = rawText.replace(dataUriPattern, "");
  if (
    deploymentTermPattern.test(sourceText) ||
    deploymentCodePattern.test(sourceText) ||
    retiredDomainPattern.test(sourceText)
  ) {
    findings.push(`${relativePath}: deployment-specific content`);
  }

  const technicalIdentifiersRemoved = allowedTechnicalIdentifiers.reduce(
    (text, identifier) => text.split(identifier).join(""),
    sourceText,
  );
  if (operationsOnlyPattern.test(technicalIdentifiersRemoved)) {
    findings.push(`${relativePath}: deployment-only operations terminology`);
  }

  for (const payload of encodedPayloads) {
    const decoded = Buffer.from(payload, "base64");
    if (decoded.includes(0)) continue;
    const decodedText = decoded
      .toString("utf8")
      .replace(/data:[^'"\s]*;base64,[A-Za-z0-9+/=]+/g, "");
    if (
      deploymentTermPattern.test(decodedText) ||
      operationsOnlyPattern.test(decodedText)
    ) {
      findings.push(`${relativePath}: deployment-specific embedded text`);
      break;
    }
  }
}

assert.deepEqual(
  findings,
  [],
  `Repository contains deployment-specific residue:\n${findings.join("\n")}`,
);

console.log("✓ repository hygiene contracts passed");
