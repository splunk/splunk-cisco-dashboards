const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const packageRoot = path.resolve(__dirname, "..");
const bootstrap = fs.readFileSync(
  path.join(
    packageRoot,
    "src/main/resources/splunk/appserver/static/start_bootstrap.js",
  ),
  "utf8",
);
const styles = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/appserver/static/start.css"),
  "utf8",
);
const commonStyles = fs.readFileSync(
  path.join(packageRoot, "src/main/webapp/common/styles/commonstyles.css"),
  "utf8",
);
const tuner = fs.readFileSync(
  path.join(packageRoot, "src/main/webapp/pages/macro_index_tuning/index.tsx"),
  "utf8",
);
const tunerRender = fs.readFileSync(
  path.join(packageRoot, "src/main/webapp/pages/macro_index_tuning/render.tsx"),
  "utf8",
);
const searchbase = fs.readFileSync(
  path.join(packageRoot, "src/main/resources/splunk/default/searchbase.conf"),
  "utf8",
);
const userGuide = fs.readFileSync(
  path.join(packageRoot, "src/main/webapp/pages/user_guide/userGuide.md"),
  "utf8",
);
const readme = fs.readFileSync(path.join(packageRoot, "README.md"), "utf8");
const { browseAppsUrl } = require(path.join(
  packageRoot,
  "src/main/resources/splunk/appserver/static/start_bootstrap.js",
));

const searchbaseStanza = (name) => {
  const header = `[${name}]\n`;
  const start = searchbase.indexOf(header);
  assert.notEqual(start, -1, `Expected Searchbase stanza ${name}`);
  const bodyStart = start + header.length;
  const nextStanza = searchbase.indexOf("\n[", bodyStart);
  return searchbase.slice(
    bodyStart,
    nextStanza === -1 ? searchbase.length : nextStanza,
  );
};

const searchbaseSearch = (name) => {
  const body = searchbaseStanza(name);
  const searchStart = body.indexOf("search = ");
  assert.notEqual(searchStart, -1, `Expected ${name} to define a search`);
  return body.slice(searchStart + "search = ".length).trimEnd().replace(/\\\n/g, "\n");
};

const expectedSteps = [
  "Welcome",
  "Verify readiness",
  "Review packages",
  "Configure data",
  "Tune CIM models",
  "Review & finish",
];

test("setup journey keeps the same six named stages across both runtimes", () => {
  expectedSteps.forEach((label) => {
    assert.match(bootstrap, new RegExp(`"${label}"`));
    assert.match(tuner, new RegExp(`"${label}"`));
  });
  assert.match(bootstrap, /function scdSetupStepItem\(/);
  assert.match(tuner, /<StepBar activeStepId=\{activeStepId\} orientation="vertical">/);
  assert.match(tuner, /<StepBar\.Step key=\{label\} stepId=\{index\}>/);
  assert.match(tuner, /function SetupEndpoint\(/);
  assert.match(bootstrap, /"START"/);
  assert.match(bootstrap, /"FINISH"/);
});

test("setup uses the full Splunk Secure Networking Essentials product name", () => {
  assert.match(bootstrap, /Welcome to Splunk Secure Networking Essentials/);
  assert.match(bootstrap, /Splunk Secure Networking Essentials setup progress/);
  assert.match(
    bootstrap,
    /scdSetupElement\(\s*"div",\s*"scd-setup__sidebar-brand",\s*"Splunk Secure Networking Essentials"/s,
  );
  assert.match(tuner, /Splunk Secure Networking Essentials setup progress/);
  assert.match(
    tuner,
    /<SetupProgressBrand className="scd-setup__sidebar-brand">\s*Splunk Secure Networking Essentials/s,
  );
  assert.doesNotMatch(bootstrap, /Cisco Setup/);
  assert.doesNotMatch(tuner, /Cisco Setup/);
});

test("missing packages open Browse More Apps with a useful search", () => {
  assert.equal(
    browseAppsUrl(
      "/en-US/app/splunk-cisco-dashboards/setup",
      "Spaces",
      "addon",
    ),
    "/en-US/manager/launcher/appsremote?order=relevance&query=Spaces&offset=0&type=addon",
  );
  assert.match(bootstrap, /browseQuery: "Spaces"/);
  assert.match(bootstrap, /browseType: "addon"/);
  assert.match(bootstrap, /"Find and install"/);
  assert.match(bootstrap, /Find and install \$\{prerequisite\.name\} in Browse More Apps/);
});

test("CIM is a staged step and only the final review saves setup", () => {
  const routingStart = tuner.indexOf(
    'if (setupMode && setupRoute === "tune-indexes") {',
  );
  const cimStart = tuner.indexOf('if (isOptionalCimSetupPage) {', routingStart);
  const reviewStart = tuner.indexOf(
    'if (setupMode && setupRoute === "review") {',
    cimStart,
  );
  assert.ok(cimStart > -1 && reviewStart > cimStart);
  const cimSetupBranch = tuner.slice(cimStart, reviewStart);
  assert.doesNotMatch(cimSetupBranch, /Save allowlists/);
  assert.match(
    cimSetupBranch,
    /let cimContinueActionLabel = "Skip CIM tuning";[\s\S]*?"Continue to review"[\s\S]*?setupCimRowsToSave\.length[\s\S]*?"Review changes"[\s\S]*?"Continue to review"/,
  );
  assert.match(
    cimSetupBranch,
    /disabled=\{isCimLoading \|\| isSavingCim \? "dimmed" : false\}[\s\S]*?label=\{cimContinueActionLabel\}/,
  );
  assert.match(cimSetupBranch, /const setupCimReviewTitle =/);
  assert.match(cimSetupBranch, /setupCimReviewRows\.map\(renderSetupCimRow\)/);

  const finishStart = tuner.indexOf(
    "const finishInitialSetup = useCallback(async () => {",
  );
  const finishEnd = tuner.indexOf(
    "const returnToSetupPackages = useCallback",
    finishStart,
  );
  const finishFlow = tuner.slice(finishStart, finishEnd);
  assert.match(finishFlow, /for \(const row of setupRowsToSave\)/);
  assert.match(finishFlow, /for \(const row of setupCimRowsToSave\)/);
  assert.match(finishFlow, /await completeInitialSetup\(\)/);
  assert.match(finishFlow, /setSetupComplete\(true\)/);
  assert.doesNotMatch(finishFlow, /window\.location\.assign/);
});

test("setup definition previews remain theme-neutral", () => {
  assert.match(
    commonStyles,
    /\.diag-modal-content code\s*\{/,
  );
  assert.doesNotMatch(commonStyles, /(?:^|\n)code\s*\{/);
  assert.match(
    tuner,
    /<SetupDefinitionPreview[^>]*>[\s\S]*?\{row\.draftDefinition \|\| "—"\}[\s\S]*?<\/SetupDefinitionPreview>/,
  );
  assert.match(
    tuner,
    /<SetupTruncatedDefinitionPreview[\s\S]*?title=\{row\.draftDefinition \|\| "Not set"\}[\s\S]*?\{row\.draftDefinition \|\| "Not set"\}[\s\S]*?<\/SetupTruncatedDefinitionPreview>/,
  );
  assert.match(
    tuner,
    /<SetupDefinitionPreview[^>]*>[\s\S]*?\{change\.currentValue\}[\s\S]*?<\/SetupDefinitionPreview>[\s\S]*?<SetupDefinitionPreview[^>]*>[\s\S]*?\{change\.proposedValue\}[\s\S]*?<\/SetupDefinitionPreview>/,
  );
});

test("setup can be abandoned safely from static and React steps", () => {
  assert.match(bootstrap, /function scdSetupConfirmAbandon\(root, returnFocus\)/);
  assert.match(bootstrap, /label: "Cancel setup"/);
  assert.match(bootstrap, /dialog\.showModal\(\)/);
  assert.match(styles, /\.scd-setup__confirm-dialog/);
  assert.match(bootstrap, /window\.location\.assign\(scdSetupHomeUrl/);
  assert.match(tuner, /title="Abandon setup\?"/);
  assert.match(tuner, /label="Cancel setup"/);
  assert.match(tuner, /label="Abandon setup"/);
});

test("final review shows exact before and after values and requires confirmation", () => {
  assert.match(tuner, /interface SetupChange/);
  assert.match(tuner, /currentValue: row\.definition \|\| "Not set"/);
  assert.match(tuner, /proposedValue: row\.draftDefinition/);
  assert.match(tuner, />Current value</);
  assert.match(tuner, />Proposed value</);
  assert.match(tuner, /Setup status:/);
  assert.match(tuner, /title="Save changes and finish setup\?"/);
  assert.match(tuner, /label="Save changes and finish"/);
  assert.match(tuner, /finishInitialSetup\(\)/);
  const finishConfirmationStart = tuner.indexOf(
    'open={showFinishConfirmation}',
  );
  const finishConfirmationEnd = tuner.indexOf(
    "</Modal>",
    finishConfirmationStart,
  );
  assert.ok(
    finishConfirmationStart > -1 &&
      finishConfirmationEnd > finishConfirmationStart,
  );
  const finishConfirmation = tuner.slice(
    finishConfirmationStart,
    finishConfirmationEnd,
  );
  assert.equal(
    (finishConfirmation.match(/<Paragraph(?:\s|>)/g) || []).length,
    3,
  );
  assert.doesNotMatch(finishConfirmation, /<p(?:\s|>)/);
  assert.match(
    tuner,
    /<Table\.Cell>\s*<div className="min-w-0 max-w-full">[\s\S]*?\{change\.setting\}[\s\S]*?<\/div>\s*<\/Table\.Cell>/,
  );
});

test("setup editors keep changes as drafts until final confirmation", () => {
  assert.match(tuner, /setupMode \? \(/);
  assert.match(tuner, /Will change/);
  assert.match(tuner, /Unchanged/);
  assert.match(tuner, /const setupRoutingChangesToSave = useMemo/);
  assert.match(tuner, /const setupCimChangesToSave = useMemo/);
  assert.match(tuner, /for \(const row of setupRowsToSave\)/);
  assert.match(tuner, /for \(const row of setupCimRowsToSave\)/);
  assert.doesNotMatch(tuner, /for \(const row of setupRoutingChangesToSave\)/);
  assert.doesNotMatch(tuner, /for \(const row of setupCimChangesToSave\)/);
});

test("rerunning discovery protects scope-specific draft changes", () => {
  assert.match(tuner, /const requestRoutingScan = useCallback/);
  assert.match(tuner, /setupRoutingChangesToSave\.length > 0/);
  assert.match(tuner, /const requestCimDiscovery = useCallback/);
  assert.match(tuner, /setupCimChangesToSave\.length > 0/);
  assert.match(tuner, /open=\{Boolean\(setupRerunScope\)\}/);
  assert.match(tuner, /label="Keep draft changes"/);
  assert.match(tuner, /label="Discard changes and rerun"/);
  assert.match(tuner, /returnFocus=\{setupRerunReturnFocusRef\}/);
  assert.match(tuner, /window\.addEventListener\("beforeunload"/);
});

test("the journey has explicit completion, sequential navigation, and compact progress", () => {
  assert.match(tuner, /if \(setupMode && setupComplete\)/);
  assert.match(tuner, /const APP_HOME_VIEW = "workspace_insights";/);
  assert.match(tuner, /label="Open home dashboard"/);
  assert.match(tuner, /<StepBar activeStepId=\{activeStepId\}/);
  assert.doesNotMatch(tuner, /onStepSelect/);
  assert.doesNotMatch(tuner, /SetupHorizontalStepBar/);
  assert.match(tuner, /className="scd-setup__compact-current"/);
  assert.match(tuner, /className="scd-setup__stepbar-compact"/);
  assert.match(
    tuner,
    /Step \{activeStepId \+ 1\} of \{SETUP_FLOW_STEPS\.length\}/,
  );
  assert.match(tuner, /\{SETUP_FLOW_STEPS\[activeStepId\]\}/);
  assert.doesNotMatch(tuner, /role="progressbar"/);
  assert.match(bootstrap, /Back to Welcome/);
  assert.match(bootstrap, /Back to Verify readiness/);
  assert.match(tuner, /Back to Review packages/);
  assert.match(tuner, /Back to Configure data/);
  assert.match(tuner, /Back to CIM/);
  assert.match(styles, /@container setup-root \(max-width: 1280px\)/);
  assert.match(styles, /#scd-setup-root button\.scd-setup__step-control:focus-visible/);
});

test("setup appearance persists across the static and React steps", () => {
  const storageKey = "splunk-cisco-dashboards:setup-color-scheme";
  assert.match(bootstrap, new RegExp(storageKey));
  assert.match(tuner, new RegExp(storageKey));
  assert.match(bootstrap, /Light mode/);
  assert.match(tuner, /Light mode/);
  assert.match(tunerRender, /allowColorSchemeChoice: true/);
  assert.match(styles, /\.scd-setup-theme-light/);
  assert.match(styles, /html\.scd-setup-light-page/);
});

test("setup shell is constrained by the Splunk content area, not the viewport", () => {
  assert.doesNotMatch(styles, /\.scd-setup__shell\s*{[^}]*100vw/s);
  assert.match(
    styles,
    /\.scd-setup__shell\s*{[^}]*width:\s*100%;[^}]*max-width:\s*1920px;/s,
  );
  assert.match(
    styles,
    /\.scd-setup\s*{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;/s,
  );
  assert.match(
    tuner,
    /scd-setup__stage grid min-h-0 min-w-0 grid-rows-\[auto_minmax\(0,1fr\)_auto\]/,
  );
  assert.match(
    tuner,
    /scd-setup__content min-h-0 min-w-0 overflow-auto/,
  );
  assert.match(
    styles,
    /\.scd-setup__shell--react\s*{[^}]*height:\s*calc\(100dvh - 72px\);[^}]*min-height:\s*0;[^}]*max-height:\s*none;/s,
  );
  assert.match(
    styles,
    /#scd-setup-root,\s*#scan-root\s*{[^}]*container-name:\s*setup-root;[^}]*container-type:\s*inline-size;/s,
  );
  assert.match(
    styles,
    /@container setup-root \(max-width:\s*1280px\)\s*{[\s\S]*?\.scd-setup__shell--react\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    styles,
    /@container setup-root \(max-width:\s*1280px\)\s*{[\s\S]*?#scd-setup-root \.scd-setup__shell,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    styles,
    /@container setup-root \(max-width:\s*1280px\)\s*{[\s\S]*?#scd-setup-root \.scd-setup__sidebar:not\(\.scd-setup__sidebar--react\)[\s\S]*?grid-template-columns:\s*minmax\(120px, auto\) minmax\(0, 1fr\);/,
  );
  assert.match(
    styles,
    /#scan-root \.scd-setup__stage \.scd-setup__header\s*{[^}]*display:\s*block;/s,
  );
  assert.match(
    styles,
    /#scan-root \.scd-setup__stage \.scd-setup__brand\s*{[^}]*display:\s*flex;[^}]*min-width:\s*0;/s,
  );
  assert.match(
    styles,
    /#scan-root \.scd-setup__progress-desktop\s*{\s*display:\s*none;/,
  );
  assert.match(
    styles,
    /#scan-root \.scd-setup__progress-compact\s*{[^}]*display:\s*grid;/s,
  );
});

test("guided setup colors are isolated from legacy progress and vivid SUI status tokens", () => {
  assert.doesNotMatch(styles, /\.scd-setup__steps \.is-complete span/);
  assert.match(
    styles,
    /\.scd-setup__steps \.is-complete > span:first-child/,
  );
  assert.match(styles, /--scd-setup-accent:\s*var\(--sui-interactive-accent\)/);
  const reactShellStart = styles.indexOf(".scd-setup__shell--react {");
  const reactShellEnd = styles.indexOf("\n}", reactShellStart);
  const reactShellStyles = styles.slice(reactShellStart, reactShellEnd);
  assert.doesNotMatch(reactShellStyles, /--sui-[\w-]+\s*:/);
  assert.doesNotMatch(styles, /\.scd-setup__notice\s*{/);

  const routingStart = tuner.indexOf(
    'if (setupMode && setupRoute === "tune-indexes") {',
  );
  const cimStart = tuner.indexOf('if (isOptionalCimSetupPage) {', routingStart);
  const reviewStart = tuner.indexOf(
    'if (setupMode && setupRoute === "review") {',
    cimStart,
  );
  const cimSetupBranch = tuner.slice(cimStart, reviewStart);
  assert.match(
    cimSetupBranch,
    /<Message type=\{cimDiscoveryMessageType\}>/,
  );
  assert.doesNotMatch(cimSetupBranch, /sui-bg-notification-info/);
  assert.doesNotMatch(
    styles,
    /\n\.scd-setup__stage \.scd-setup__(?:header|content|actions)/,
  );
  assert.doesNotMatch(styles, /\n\.scd-setup__theme-control\s*{/);
  assert.match(tuner, /const SetupThemeControl = styled\.div/);
  assert.match(tuner, /<Message\s+appearance="fill"/s);
});

test("guided setup progress stays fully inset inside the sidebar", () => {
  assert.match(
    styles,
    /\.scd-setup__sidebar \.scd-setup__steps\s*{[^}]*margin:\s*0;[^}]*padding:\s*0;[^}]*border-left:\s*0;/s,
  );
  assert.match(
    styles,
    /\.scd-setup__sidebar \.scd-setup__steps::before\s*{[^}]*left:\s*14px;/s,
  );
  assert.doesNotMatch(
    styles,
    /\.scd-setup__endpoint,\s*\.scd-setup__step-item\s*{[^}]*margin-left:\s*-[^;]+;/s,
  );
  assert.match(tuner, /orientation="vertical"/);
  assert.doesNotMatch(tuner, /function SetupStepItem\(/);
});

test("setup uses the current Enterprise Networking package names", () => {
  assert.match(bootstrap, /Cisco Enterprise Networking App for Splunk/);
  assert.match(bootstrap, /Cisco Enterprise Networking Add-on for Splunk/);
  assert.doesNotMatch(bootstrap, /Cisco Enterprise Networking for Splunk Platform/);
  assert.doesNotMatch(bootstrap, /Cisco Catalyst Add-on for Splunk/);
});

test("required data models use the current Enterprise Networking display name", () => {
  assert.match(
    tuner,
    /label: "Cisco Enterprise Networking",\s*app: CATALYST_APP_NAME,\s*model: "Cisco_Catalyst_App"/s,
  );
  assert.match(
    tuner,
    /\[CATALYST_APP_NAME\]: "Cisco Enterprise Networking"/,
  );
});

test("static progress markers and copy share one aligned grid", () => {
  assert.match(
    styles,
    /\.scd-setup__endpoint\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*30px minmax\(0, 1fr\);/s,
  );
  assert.match(
    styles,
    /\.scd-setup__step-control\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*30px minmax\(0, 1fr\);/s,
  );
  assert.match(styles, /\.scd-setup__step-copy\s*{[^}]*text-align:\s*left;/s);
});

test("search performance radio indicators keep their circular SUI geometry", () => {
  assert.match(tuner, /scd-setup__search-performance/);
  assert.match(
    styles,
    /#scan-root \.scd-setup__search-performance \[role="radiogroup"\] input\[type="radio"\]\s*{[^}]*min-inline-size:\s*20px;/s,
  );
});

test("routing macros use index multiselects that generate definitions", () => {
  assert.match(tuner, /const usesIndexPicker =/);
  assert.match(tuner, /label=\{editActionLabel\}/);
  assert.match(tuner, /Select indexes for \$\{row\.macro\}/);
  assert.match(
    tuner,
    /usesRoutingIndexPicker\s*\?\s*"Select indexes"\s*:\s*"Edit definition"/,
  );
  assert.match(tuner, /onClick=\{openEditor\}/);
  assert.match(tuner, /appearance="standalone"/);
  assert.match(tuner, /inputId=\{indexInputId\}/);
  assert.match(tuner, /allowNewValues/);
  assert.match(tuner, /values=\{draftIndexes\}/);
  assert.match(
    tuner,
    /formatMacroDefinition\(\s*nextIndexes,\s*row\.definitionFormat,\s*row\.definitionSuffix,/s,
  );
  assert.match(tuner, /Generated definition:/);
  assert.match(tuner, /return `index IN \(\$\{tokens\.join\(", "\)\}\)\$\{suffix\}`/);
});

test("TA-owned Cisco routing macros remain outside user-driven tuning", () => {
  assert.doesNotMatch(tuner, /DATA_CENTER_NETWORKING_INDEX_MACRO_NAMES/);
  assert.doesNotMatch(tuner, /DATA_CENTER_NETWORKING_INDEX_MACRO_CONFIGS/);
  assert.doesNotMatch(tuner, /cisco_catalyst_app_sourcetypes/);
  assert.match(
    tuner,
    /const setupExternalRowsToSave = useMemo\([\s\S]*?fastTuningMacroNameSet\.has\(row\.macro\)/,
  );
  assert.match(tuner, /const externalAppMacroRows = modelMacroRows;/);
});

test("routing review table fits its panel without forced horizontal scrolling", () => {
  const routingStart = tuner.indexOf(
    'if (setupMode && setupRoute === "tune-indexes") {',
  );
  const cimStart = tuner.indexOf('if (isOptionalCimSetupPage) {', routingStart);
  const routingSetupBranch = tuner.slice(routingStart, cimStart);
  assert.match(routingSetupBranch, /horizontalOverflow="auto"/);
  assert.match(
    routingSetupBranch,
    /tableStyle=\{\{ tableLayout: "fixed", width: "100%" \}\}/,
  );
  assert.match(
    routingSetupBranch,
    /<Table\.HeadCell width="auto">Sourcetypes<\/Table\.HeadCell>/,
  );
  assert.doesNotMatch(routingSetupBranch, /pinnedColumns=/);
  assert.match(
    tuner,
    /className="flex min-w-0 max-w-full flex-wrap gap-1\.5 overflow-hidden"/,
  );
  assert.match(tuner, /style=\{\{ maxWidth: "min\(220px, 100%\)" \}\}/);
  assert.doesNotMatch(routingSetupBranch, /horizontalOverflow="scroll"/);
  assert.doesNotMatch(routingSetupBranch, /tableStyle=\{\{ minWidth:/);
  assert.match(
    routingSetupBranch,
    /<Progress\s+appearance="accent"\s+aria-label="Scanning routing data"\s+indeterminate/s,
  );
  assert.match(routingSetupBranch, /Searching Cisco events and rebuilding routing proposals…/);
  assert.ok(
    routingSetupBranch.indexOf('label={setupScanInProgress ? "Scanning" : "Run scan"}') <
      routingSetupBranch.indexOf('className="scd-setup__routing-summary'),
    "routing scan controls should appear before the summary and review table",
  );
});

test("CIM review rows keep model metadata inside one table cell block", () => {
  assert.match(
    tuner,
    /<Table\.Cell>\s*<div className="min-w-0">\s*<div className="break-words text-sm font-bold sui-color-active">\s*\{getCimModelLabel\(row\.macro\)\}/s,
  );
  assert.match(
    tuner,
    /className="mt-1 break-words whitespace-normal font-mono text-xs sui-color-muted"/,
  );
  assert.match(
    tuner,
    /className="mt-1 break-words whitespace-normal text-xs sui-color-muted"/,
  );
});

test("routing review rows keep macro metadata inside one table cell block", () => {
  assert.match(
    tuner,
    /const renderSetupRoutingRow[\s\S]*?<Table\.Cell>\s*<div className="min-w-0">[\s\S]*?\{row\.macro\}[\s\S]*?getTargetAppLabel\(row\.targetApp\)[\s\S]*?\{row\.targetApp\}\/local\/macros\.conf[\s\S]*?<\/div>\s*<\/Table\.Cell>/,
  );
  assert.match(
    tuner,
    /\{row\.macro\}[\s\S]*?className="mt-1 break-words whitespace-normal font-mono text-xs sui-color-muted"/,
  );
});

test("CIM allowlists expose an index browser and generate index IN definitions", () => {
  assert.match(
    tuner,
    /const CIM_MACRO_CONFIGS:[\s\S]*?definitionFormat: "indexIn",[\s\S]*?family: "cim"/,
  );
  assert.match(
    tuner,
    /definition_format="indexIn"/,
  );
  assert.match(
    tuner,
    /eval definition="index IN \("\.mvjoin\(indexes, ", "\)\."\)"/,
  );
  assert.match(
    tuner,
    /label=\{selected \? "Browse indexes" : "Select indexes"\}/,
  );
  assert.match(tuner, /appearance="standalone"/);
  assert.match(tuner, /<ScreenReaderContent>Actions<\/ScreenReaderContent>/);
  assert.match(tuner, /<span className="shrink-0">Generated:<\/span>/);
  assert.match(
    tuner,
    /grid-cols-\[auto_minmax\(0,1fr\)\][^"\n]*overflow-hidden/,
  );
  assert.match(tuner, /\{row\.draftDefinition \|\| "Not set"\}/);
  assert.doesNotMatch(tuner, /index IN \(\.\.\.\)/);
  assert.match(
    tuner,
    /const proposedDefinition = usesIndexPicker[\s\S]*?formatMacroDefinition\(\s*selectedIndexes,\s*setupEditorRow\.definitionFormat,\s*setupEditorRow\.definitionSuffix,/,
  );
  assert.match(tuner, /updateDraftDefinition\(setupEditor\.rowKey, proposedDefinition\)/);
  assert.match(tuner, /returnFocus=\{returnSetupEditorFocus\}/);
  assert.match(tuner, /setupEditButtonRefs\.current\.get\(buttonKey\)/);
  assert.match(tuner, /elementRef=\{\(element\) =>/);
  assert.match(
    tuner,
    /setSetupEditor\(null\);\s*if \(restoreFocus\) \{\s*returnSetupEditorFocus\(\);/,
  );
  assert.match(tuner, /onRequestClose=\{\(\) => closeSetupEditor\(true, false\)\}/);
});

test("CIM setup reviews only the approved data model inventory", () => {
  const configStart = tuner.indexOf("const CIM_DATA_MODEL_DISCOVERY_CONFIGS = [");
  const configEnd = tuner.indexOf("] as const;", configStart);
  const config = tuner.slice(configStart, configEnd);
  const models = [...config.matchAll(/model: "([^"]+)"/g)].map((match) => match[1]);
  const dataModels = [...config.matchAll(/dataModel: "([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.deepEqual(models, [
    "Alerts",
    "Authentication",
    "Certificates",
    "Change",
    "Data Access",
    "Data Loss Prevention",
    "Databases",
    "Email",
    "Endpoint",
    "Interprocess Messaging",
    "Intrusion Detection",
    "Inventory",
    "JVM",
    "Malware",
    "Network Resolution (DNS)",
    "Network Sessions",
    "Network Traffic",
    "Performance",
    "Ticket Management",
    "Updates",
    "Vulnerabilities",
    "Web",
  ]);
  assert.match(
    config,
    /macro: "cim_Compute_Inventory_indexes",\s*model: "Inventory"/,
  );
  assert.equal(dataModels.length, 22);
  assert.match(
    config,
    /dataModel: "Endpoint",\s*rootNodes: \["Ports", "Processes", "Services", "Filesystem", "Registry"\]/,
  );
  assert.match(
    config,
    /dataModel: "Malware",\s*rootNodes: \["Malware_Attacks", "Malware_Operations"\]/,
  );
  assert.match(
    config,
    /dataModel: "Updates",\s*rootNodes: \["Updates", "Update_Errors"\]/,
  );
  assert.doesNotMatch(config, /Change Analysis|Event Signatures/);
});

test("CIM discovery is bounded per model and reports progressive read-only matches", () => {
  assert.match(
    tuner,
    /const DEFAULT_CIM_TIME_RANGE: SearchTimeRange = \{\s*earliest: "-15m",\s*latest: "now",\s*\};/s,
  );
  assert.match(tuner, /const CIM_DISCOVERY_CONCURRENCY = 2;/);
  assert.match(tuner, /const CIM_DISCOVERY_JOB_MAX_SECONDS = 60;/);
  assert.match(tuner, /const CIM_DISCOVERY_GLOBAL_MAX_MS = 120_000;/);
  assert.match(tuner, /runManagedSearch\(\{/);
  assert.match(tuner, /buildCimDataModelDiscoverySearch\(config, discoveryIndexes\)/);
  assert.match(tuner, /cimDiscoveryActionLabel = "Cancel discovery"/);
  assert.match(tuner, /completed results were preserved/);
  assert.match(tuner, /Discovery is read-only\./);
  assert.match(
    tuner,
    /selectMatchedCimMacroNames\(CIM_MACRO_NAMES, discoveredRows\)/,
  );
  assert.match(tuner, /Matching models enter the draft plan automatically\./);
  assert.match(tuner, /import Progress from '@splunk\/react-ui\/Progress'/);
  assert.match(
    tuner,
    /<Progress\s+appearance="accent"[\s\S]*?percentage=\{cimDiscoveryPercent\}/,
  );
  assert.doesNotMatch(tuner, /const CIM_DISCOVERY_SEARCH =/);
});

test("setup can finish when only an optional companion-app macro cannot save", () => {
  assert.match(
    tuner,
    /if \(row\.targetApp === APP_NAME\) requiredFailures\.push\(detail\);\s*else optionalFailures\.push\(detail\);/,
  );
  assert.match(tuner, /await completeInitialSetup\(\);/);
  assert.match(tuner, /Optional companion settings were not saved/);
  assert.match(tuner, /savedRow\(row, false\);/);
  assert.match(tuner, /retry only the remaining highlighted changes/);
  assert.match(tuner, /Save failed: \{changeStatus\.message/);
});

test("CIM review table fits its panel without forced horizontal scrolling", () => {
  const routingStart = tuner.indexOf(
    'if (setupMode && setupRoute === "tune-indexes") {',
  );
  const cimStart = tuner.indexOf('if (isOptionalCimSetupPage) {', routingStart);
  const reviewStart = tuner.indexOf(
    'if (setupMode && setupRoute === "review") {',
    cimStart,
  );
  const cimSetupBranch = tuner.slice(cimStart, reviewStart);
  assert.match(cimSetupBranch, /horizontalOverflow="auto"/);
  assert.match(cimSetupBranch, /tableStyle=\{\{ tableLayout: "fixed", width: "100%" \}\}/);
  assert.match(cimSetupBranch, /<Table\.HeadCell width="auto">Proposed allowlist<\/Table\.HeadCell>/);
  assert.doesNotMatch(cimSetupBranch, /pinnedColumns=/);
  assert.doesNotMatch(cimSetupBranch, /horizontalOverflow="scroll"/);
});

test("the supported acceleration catalog keeps all fourteen dashboard data models", () => {
  const requirementsStart = tuner.indexOf(
    "const CORE_DATA_MODEL_REQUIREMENTS:",
  );
  const requirementsEnd = tuner.indexOf("] as const;", requirementsStart);
  const requirements = tuner.slice(requirementsStart, requirementsEnd);
  assert.equal((requirements.match(/priority: "required"/g) || []).length, 14);
  assert.match(
    requirements,
    /model: "Cisco_Intersight",\s*priority: "required",\s*applicableCapabilities: \["intersight"\]/s,
  );
  assert.match(
    requirements,
    /model: "Authentication",\s*priority: "required"/s,
  );
  assert.match(
    requirements,
    /model: "Network_Traffic",\s*priority: "required"/s,
  );
  assert.match(
    tuner,
    /selectApplicableDataModelRequirements\([\s\S]*?readDetectedSetupCapabilityIds\(\)/,
  );
});

test("Cisco Security model searches use exact populated datasets and fields", () => {
  assert.match(
    searchbaseSearch("secure_networking_fmc_total_events_count"),
    /FROM datamodel=Cisco_Security WHERE nodename=Secure_Firewall_Dataset sourcetype="cisco:ftd:\*"/,
  );
  assert.doesNotMatch(
    searchbaseSearch("secure_networking_fmc_total_events_count"),
    /`index_firewall`/,
  );

  const applications = searchbaseSearch(
    "secure_networking_fmc_connection_application_inventory_dm",
  );
  assert.match(
    applications,
    /nodename=Secure_Firewall_Dataset\.Connection_Events/,
  );
  for (const field of ["client_application", "initiator_ip", "responder_ip"]) {
    assert.match(applications, new RegExp(`Secure_Firewall_Dataset\\.${field}`));
  }

  const fileMalware = searchbaseSearch(
    "secure_networking_fmc_file_malware_volume_dm",
  );
  assert.match(fileMalware, /nodename=Secure_Firewall_Dataset\.File_Events/);
  assert.match(fileMalware, /nodename=Secure_Firewall_Dataset\.Malware_Events/);
  assert.match(
    searchbaseSearch("network_intelligence_ftd_advanced_logging_coverage_dm"),
    /nodename=Secure_Firewall_Dataset\.Advanced_Logging BY sourcetype/,
  );

  const dnsQueryTypes = searchbaseSearch(
    "network_intelligence_ftd_dns_query_type_volume_dm",
  );
  assert.match(
    dnsQueryTypes,
    /nodename=Secure_Firewall_Dataset\.DNS_Events[\s\S]*Secure_Firewall_Dataset\.qtype_name/,
  );
  assert.doesNotMatch(dnsQueryTypes, /initiator_ip|responder_ip/);
});

test("CIM is used only where it preserves the existing search semantics", () => {
  const blockedCount = searchbaseSearch("secure_networking_fmc_blocked_count");
  assert.match(blockedCount, /AC_RuleAction="Block"/);
  assert.doesNotMatch(blockedCount, /datamodel=Network_Traffic/);

  assert.match(
    userGuide,
    /use an[\s\S]*accelerated CIM model when it preserves the required meaning and[\s\S]*fields[\s\S]*use a Cisco app or add-on model for vendor-specific[\s\S]*coverage[\s\S]*use raw indexed events only when neither model can[\s\S]*represent the search faithfully/,
  );
  assert.match(
    readme,
    /use CIM when it preserves the[\s\S]*required semantics[\s\S]*use Cisco app or add-on models for vendor-specific fields[\s\S]*retain raw searches/,
  );
});

test("Intersight setup and diagnostics expose the model without hiding child coverage gaps", () => {
  assert.match(
    tuner,
    /app IN \(CiscoSecurityCloud, Splunk_TA_Cisco_Intersight, ta_cisco_thousandeyes/,
  );
  assert.match(
    tuner,
    /model: "Cisco_Intersight",\s*priority: "required",\s*applicableCapabilities: \["intersight"\]/s,
  );
  assert.match(
    bootstrap,
    /id: "intersight-ta",[\s\S]*appIds: \["Splunk_TA_Cisco_Intersight"\][\s\S]*Cisco_Intersight data model/,
  );
  assert.match(
    bootstrap,
    /id: "intersight",\s*name: "Cisco Intersight",\s*pattern: \/\^cisco:intersight/s,
  );

  const coverage = searchbaseSearch(
    "secure_networking_intersight_data_model_coverage",
  );
  for (const node of [
    "cisco_intersight",
    "cisco_intersight.cisco_intersight_serverProfiles",
    "cisco_intersight.cisco_intersight_condAlarms",
    "cisco_intersight.cisco_intersight_network",
    "cisco_intersight.cisco_intersight_memory",
    "cisco_intersight.cisco_intersight_cpu_utilization",
  ]) {
    assert.match(coverage, new RegExp(`nodename=${node.replaceAll(".", "\\.")}`));
  }
  assert.match(coverage, /No events match this model child/);
  assert.match(
    userGuide,
    /Cisco Intersight Add-On[\s\S]*Splunk_TA_Cisco_Intersight[\s\S]*Cisco_Intersight/,
  );
});

test("field-dependent Intersight searches stay raw until model children are populated", () => {
  const existingIntersightSearches = [
    "secure_networking_intersight_advisory_exposure",
    "secure_networking_intersight_eol_field_notice_milestones",
    "secure_networking_intersight_hcl_validation_status",
    "secure_networking_intersight_server_physical_health",
    "secure_networking_intersight_fabric_interconnect_health",
    "secure_networking_intersight_network_port_health",
    "secure_networking_intersight_memory_ecc_errors",
    "secure_networking_intersight_fan_temperature_health",
    "secure_networking_intersight_target_connection_health",
    "secure_networking_intersight_audit_trail_by_user",
    "secure_networking_intersight_profile_deployment_state",
  ];

  for (const name of existingIntersightSearches) {
    const search = searchbaseSearch(name);
    assert.match(search, /`index_intersight`/);
    assert.doesNotMatch(search, /datamodel=Cisco_Intersight/);
  }
});
