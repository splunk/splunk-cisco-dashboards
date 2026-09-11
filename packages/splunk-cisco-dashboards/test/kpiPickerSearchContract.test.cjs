"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const pickerPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/workspace/KpiPickerPanel.tsx",
);
const picker = fs.readFileSync(pickerPath, "utf8");

assert.match(
  picker,
  /const currentBoundEntryId = currentBoundEntry\?\.id;[\s\S]*?\}, \[open, currentBoundEntryId\]\);/,
  "Visibility refetches must not replay the one-time bound-search scroll",
);
assert.doesNotMatch(
  picker,
  /\[open, currentBoundEntry, catalogue\.length\]/,
  "The bound-search scroll must not depend on refetched record identities",
);

assert.equal(
  (picker.match(/placeholder="All tags"/g) || []).length,
  2,
  "Search and drilldown tag filters must not present tag totals as result counts",
);
assert.doesNotMatch(
  picker,
  /placeholder=\{`All tags \(\$\{/,
  "Tag-filter placeholders must not contain catalogue vocabulary counts",
);
assert.equal(
  (picker.match(/description=\{formatSearchCount\(count\)\}/g) || []).length,
  2,
  "Per-tag search counts must use singular and plural wording correctly",
);
assert.match(
  picker,
  /<SearchResultSummary[\s\S]*?aria-atomic="true"[\s\S]*?aria-live="polite"[\s\S]*?role="status"[\s\S]*?<strong>\{availableSearchCountText\}<\/strong>/,
  "The visible filtered-search count must also be announced as one polite status update",
);
assert.match(
  picker,
  /availableSearchCount === 1 \? "matches" : "match"/,
  "The filtered-search summary must use the correct singular or plural verb",
);
