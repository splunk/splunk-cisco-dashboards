const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const guidePath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/user_guide/index.tsx",
);
const cssPath = path.resolve(
  __dirname,
  "../src/main/webapp/pages/user_guide/user-guide.css",
);
const guide = fs.readFileSync(guidePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

test("documents the complete shared workspace creation and publishing flow", () => {
  assert.match(
    guide,
    /Create a workspace[\s\S]*?Edit workspaces[\s\S]*?<strong>New<\/strong>[\s\S]*?Start from a template[\s\S]*?Save workspace[\s\S]*?Publish workspace layout[\s\S]*?Configure Signal Rail/,
  );
});

test("documents each workspace persistence scope and backing store", () => {
  assert.match(
    guide,
    /Where workspace settings are saved[\s\S]*?local\/insights_workspaces\.conf[\s\S]*?local\/customer_topology\.conf[\s\S]*?insights_workspace_preferences\.conf[\s\S]*?browser local storage[\s\S]*?first-party cookie fallback/,
  );
});

test("documents workspace management permissions and separate data access", () => {
  assert.match(
    guide,
    /ssne_manage_insights_workspaces[\s\S]*?admin[\s\S]*?sc_admin[\s\S]*?user[\s\S]*?power[\s\S]*?admin_all_objects/,
  );
  assert.match(
    guide,
    /Workspace permission does not grant access to indexed data[\s\S]*?<InlineCode>search<\/InlineCode>[\s\S]*?index permissions[\s\S]*?knowledge object permissions/,
  );
});

test("uses accessible collapsible release panels with global controls", () => {
  assert.match(
    guide,
    /function ReleasePanel[\s\S]*?<details[\s\S]*?<summary[\s\S]*?Expand all[\s\S]*?Collapse all[\s\S]*?Current release at a glance[\s\S]*?Published package record/,
  );
  assert.match(
    css,
    /\.scd-guide-release-summary:focus-visible[\s\S]*?outline:/,
  );
});

test("does not link customers to the intentionally excluded Searchbase Canvas", () => {
  assert.doesNotMatch(
    guide,
    /appUrl\("searchbase_canvas"\)/,
    "The customer user guide must not link to the intentionally excluded Searchbase Canvas",
  );
});
