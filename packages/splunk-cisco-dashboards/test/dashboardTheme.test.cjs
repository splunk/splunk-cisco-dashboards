"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const source = (relativePath) =>
  fs.readFileSync(path.resolve(__dirname, "../src/main/webapp", relativePath), "utf8");

const provider = source("common/theme/AppThemeProvider.tsx");
const semanticStyles = source("common/theme/SemanticThemeStyles.tsx");
const render = source("common/render.jsx");
const rawRender = source("common/render-raw.tsx");
const editor = source("pages/dashboardbuilder/DashboardStudioEditor.jsx");
const dashboardBuilderEntry = source("pages/dashboardbuilder/index.jsx");

assert.match(provider, /<SplunkThemeProvider[\s\S]*?family="prisma"/);
assert.match(provider, /colorScheme="dark"/);
assert.match(provider, /density="comfortable"/);
assert.match(provider, /unstable_splunk1cdThemeCustomizer/);
assert.match(provider, /<SemanticThemeStyles \/>/);
assert.doesNotMatch(provider, /localStorage|storage|useState|useEffect|getUserTheme/);

assert.match(render, /theme: 'dark'/);
assert.match(render, /themeFamily: 'prisma'/);
assert.match(render, /themeDensity: 'comfortable'/);
assert.match(render, /<AppThemeProvider>/);
assert.match(rawRender, /<AppThemeProvider>/);
assert.doesNotMatch(rawRender, /fixedColorScheme/);

assert.match(semanticStyles, /variables\.backgroundColorPage/);
assert.match(semanticStyles, /variables\.contentColorDefault/);
assert.match(semanticStyles, /variables\.borderColorWeak/);
assert.match(semanticStyles, /variables\.focusShadow/);
assert.doesNotMatch(semanticStyles, /useSplunkTheme<Record|string-index|token\(/);

assert.match(editor, /const dashboardColorScheme = 'dark'/);
assert.match(editor, /const editorTheme = useSplunkTheme\(\)/);
assert.doesNotMatch(editor, /SplunkThemeProvider/);
assert.doesNotMatch(editor, /syncSplunkShellTheme/);
assert.doesNotMatch(dashboardBuilderEntry, /splunkShellTheme\.css/);

for (const removedPath of [
  "common/hooks/useTheme.ts",
  "common/theme/themePreference.ts",
  "common/theme/splunkShellTheme.ts",
  "common/styles/splunkShellTheme.css",
  "common/components/florida/ThemeToggle.tsx",
]) {
  assert.equal(
    fs.existsSync(path.resolve(__dirname, "../src/main/webapp", removedPath)),
    false,
    `${removedPath} must remain removed`,
  );
}

const viewsPath = path.resolve(
  __dirname,
  "../src/main/resources/splunk/default/data/ui/views",
);
for (const viewFile of fs.readdirSync(viewsPath).filter((name) => name.endsWith(".xml"))) {
  const viewSource = fs.readFileSync(path.join(viewsPath, viewFile), "utf8");
  if (!/<dashboard\b[^>]*\bversion="2"/.test(viewSource)) continue;
  assert.match(viewSource, /<dashboard\b[^>]*\btheme="dark"/);
}

console.log("✓ Fixed dark SUI theme regression test passed");
