const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("src/main/webapp/pages/user_guide/index.tsx");
const markdown = read("src/main/webapp/pages/user_guide/userGuide.md");
const parser = read("src/main/webapp/pages/user_guide/markdownGuide.ts");
const webpack = read("webpack.config.js");
const css = read("src/main/webapp/pages/user_guide/user-guide.css");

test("uses Markdown as the customer-guide source of truth", () => {
  assert.match(page, /import guideMarkdown from "\.\/userGuide\.md"/);
  assert.match(page, /parseGuideMarkdown\(guideMarkdown\)/);
  assert.match(page, /dangerouslySetInnerHTML=\{\{ __html: PARSED_GUIDE\.html \}\}/);
  assert.match(webpack, /test: \/\\\.md\$\/,[\s\S]*?type: 'asset\/source'/);
  assert.match(parser, /escapeHtml[\s\S]*?releasePanel/);
  assert.doesNotMatch(page, /Initial Alpha release|Where workspace settings are saved/);
});

test("documents complete workspace creation, publishing, and persistence", () => {
  assert.match(markdown, /Create a workspace[\s\S]*?Edit workspaces[\s\S]*?New[\s\S]*?Start from a template[\s\S]*?Save workspace/);
  assert.match(markdown, /Publish workspace layout[\s\S]*?Configure Signal Rail/);
  assert.match(markdown, /Where workspace settings are saved[\s\S]*?local\/insights_workspaces\.conf[\s\S]*?local\/customer_topology\.conf[\s\S]*?insights_workspace_preferences\.conf[\s\S]*?browser local storage[\s\S]*?first-party cookie fallback/);
});

test("documents workspace permissions separately from data access", () => {
  assert.match(markdown, /ssne_manage_insights_workspaces[\s\S]*?admin[\s\S]*?sc_admin[\s\S]*?user[\s\S]*?power[\s\S]*?admin_all_objects/);
  assert.match(markdown, /Workspace permission does not grant access to indexed data[\s\S]*?search[\s\S]*?index permissions[\s\S]*?knowledge object permissions/);
});

test("keeps accessible release history in Markdown", () => {
  assert.match(parser, /<details class="scd-guide-release-panel"[\s\S]*?<summary class="scd-guide-release-summary">/);
  assert.match(parser, /scd-guide-release-indicator[\s\S]*?aria-hidden="true"/);
  assert.match(parser, /data-release-action="expand"[\s\S]*?data-release-action="collapse"/);
  assert.match(page, /handleReleaseControl[\s\S]*?querySelectorAll<HTMLDetailsElement>/);
  assert.match(page, /openedForPrint[\s\S]*?panel\.setAttribute\("open", ""\)/);
  assert.match(css, /\.scd-guide-release-summary:focus-visible[\s\S]*?outline:/);
  for (const version of [
    "1.0.35",
    "1.0.44",
    "1.0.45",
    "1.0.46",
    "1.0.49",
    "1.0.50",
    "1.0.51",
    "1.0.52",
  ]) {
    assert.match(markdown, new RegExp(`Version ${version.replaceAll(".", "\\.")}`));
  }
  assert.match(markdown, /Initial Alpha release[\s\S]*?Alpha release considerations/);
  assert.match(markdown, /Initial beta release[\s\S]*?Beta considerations/i);
  assert.match(markdown, /Version 1\.0\.49[\s\S]*?Secure Data Center Operations[\s\S]*?Upgrade notes/);
  assert.match(markdown, /Version 1\.0\.50[\s\S]*?Property operations and inventory[\s\S]*?customer-neutral/);
  assert.match(markdown, /Version 1\.0\.50[\s\S]*?Packaging and release safety[\s\S]*?build-2089 release floor/);
  assert.match(markdown, /Version 1\.0\.51[\s\S]*?Add for everyone[\s\S]*?No data migration or Splunk restart is required/);
  assert.match(markdown, /Version 1\.0\.52[\s\S]*?10,000-row limit[\s\S]*?build 2096 or later/);
});

test("documents the full setup, dashboard, and workspace operating model", () => {
  assert.match(markdown, /Setup contains six stages[\s\S]*?Welcome[\s\S]*?Verify readiness[\s\S]*?Review packages[\s\S]*?Configure data[\s\S]*?Tune CIM models[\s\S]*?Review & finish/);
  assert.match(markdown, /Secure-networking journeys[\s\S]*?Secure Data Center Operations[\s\S]*?Executive Assurance/);
  assert.match(markdown, /Duplicate, edit, and delete a workspace[\s\S]*?Configure the Signal Rail[\s\S]*?Reset behavior/);
  assert.match(markdown, /User-scoped browser local storage[\s\S]*?Memory only/);
});

test("does not link customers to the intentionally excluded Searchbase Canvas", () => {
  assert.doesNotMatch(markdown, /searchbase_canvas/);
});
