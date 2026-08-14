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

const collectSourceFiles = (relativeRoot) => {
  const absoluteRoot = path.resolve(__dirname, "../src/main/webapp", relativeRoot);
  return fs.readdirSync(absoluteRoot, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
};

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
assert.match(
  semanticStyles,
  /\.sui-bg-notification-info[\s\S]*?variables\.notificationColorInfoWeak/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-notification-positive[\s\S]*?variables\.notificationColorPositiveWeak/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-notification-warning[\s\S]*?variables\.notificationColorCautionWeak/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-notification-negative[\s\S]*?variables\.notificationColorNegativeWeak/,
);
assert.match(
  semanticStyles,
  /\.sui-border-notification-info[\s\S]*?variables\.notificationColorInfoStrong/,
);
assert.match(
  semanticStyles,
  /\.sui-border-notification-negative[\s\S]*?variables\.notificationColorNegativeStrong/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-status-info[\s\S]*?variables\.severityColorInfo/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-status-positive[\s\S]*?variables\.severityColorNormal/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-status-warning[\s\S]*?variables\.severityColorWarning/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-status-negative[\s\S]*?variables\.severityColorCritical/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-status-unknown[\s\S]*?variables\.severityColorUnknown/,
);
assert.match(
  semanticStyles,
  /\.sui-bg-progress-track[\s\S]*?variables\.neutral100/,
);
assert.doesNotMatch(semanticStyles, /useSplunkTheme<Record|string-index|token\(/);

const migratedSemanticRoots = [
  "pages/searchbase_canvas",
  "pages/health_monitoring",
  "pages/m365_activity_monitoring",
  "pages/macro_index_tuning",
  "pages/network_diagram",
  "pages/secure_operations_glass",
  "pages/topology_canvas_v1",
  "pages/user_guide",
  "common/components/diagram",
  "common/components/topology",
];
for (const relativePath of migratedSemanticRoots.flatMap(collectSourceFiles)) {
  assert.doesNotMatch(
    source(relativePath),
    /sui-bg-(?:info|positive|warning|negative|floating)(?![\w-])/,
    `${relativePath} must use explicit notification, status, or neutral semantic background roles`,
  );
}

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
