"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/webapp/pages/macro_index_tuning/index.tsx",
  ),
  "utf8",
);
const start = source.indexOf("function FieldPills(");
const end = source.indexOf("function MacroInfoBox(", start);

assert.notEqual(start, -1, "FieldPills must remain present");
assert.notEqual(end, -1, "FieldPills must have a bounded source contract");

const fieldPills = source.slice(start, end);
assert.match(source, /import Chip from ['"]@splunk\/react-ui\/Chip['"]/);
assert.match(fieldPills, /const chipAppearance = tone === "sky" \? "info" : "outline"/);
assert.match(fieldPills, /<Chip[\s\S]*?appearance=\{chipAppearance\}/);
assert.match(fieldPills, /title=\{value\}/);
assert.match(fieldPills, /<Button[\s\S]*?appearance="subtle"/);
assert.match(fieldPills, /onClick=\{\(\) => setExpanded\(\(current\) => !current\)\}/);
assert.match(
  fieldPills,
  /expanded[\s\S]*?\? `Show fewer \$\{valueLabel\}`[\s\S]*?: `Show \$\{extra\} more \$\{valueLabel\}`/,
);
assert.match(fieldPills, /aria-controls=\{valuesId\}/);
assert.match(fieldPills, /aria-expanded=\{expanded\}/);
assert.doesNotMatch(fieldPills, /<button\b|<\/button>/);

console.log("Macro routing values use SUI Chip and Button controls.");
