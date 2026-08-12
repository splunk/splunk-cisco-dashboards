"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const webappRoot = path.resolve(__dirname, "../src/main/webapp");
const legacyComponentRoot = path.join(
  webappRoot,
  "common/components/florida",
);
const workspaceComponentRoot = path.join(
  webappRoot,
  "common/components/workspace",
);

assert.equal(
  fs.existsSync(legacyComponentRoot),
  false,
  "The legacy Florida-specific component namespace must not be restored",
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
    if (/components\/florida/i.test(fs.readFileSync(absolutePath, "utf8"))) {
      legacyImports.push(path.relative(webappRoot, absolutePath));
    }
  }
}

assert.deepEqual(
  legacyImports,
  [],
  `Active source must not import from the retired Florida namespace: ${legacyImports.join(", ")}`,
);

console.log("✓ repository hygiene contracts passed");
