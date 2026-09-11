"use strict";

const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");

const pickerPath = path.resolve(
  __dirname,
  "../src/main/webapp/common/components/workspace/KpiPickerPanel.tsx",
);
const picker = fs.readFileSync(pickerPath, "utf8");

const optionKeys = [
  "dataMapping",
  "drilldown",
  "chartStyle",
  "display",
  "thresholds",
];

for (const optionKey of optionKeys) {
  assert.match(
    picker,
    new RegExp(
      `<OptionPanelActions[\\s\\S]*?help=\\{OPTION_HELP\\.${optionKey}\\}`,
    ),
    `${optionKey} must expose its help action in the panel header`,
  );
}

assert.equal(
  (picker.match(/<OptionPanelActions\s/g) || []).length,
  optionKeys.length,
  "Each option row must retain its current-value summary beside the help action",
);
assert.match(
  picker,
  /<OptionSummary>\{summary\}<\/OptionSummary>/,
  "Panel actions must render the existing current-value summary",
);

assert.equal(
  (picker.match(/docsUrl:\s*\n?\s*"https:\/\/help\.splunk\.com\//g) || [])
    .length,
  optionKeys.length,
  "Every option help action must link to official Splunk documentation",
);
assert.match(
  picker,
  /aria-label=\{`Learn about \$\{title\} in Splunk documentation`\}/,
  "Each icon-only documentation link must have a descriptive accessible name",
);
assert.match(
  picker,
  /<Tooltip[\s\S]*?content=\{description\}[\s\S]*?aria-describedby=\{describedBy\}/,
  "The concise explanation must be available on hover and keyboard focus",
);
assert.match(
  picker,
  /openInNewContext[\s\S]*?to=\{docsUrl\}/,
  "Documentation links must announce and use a new browsing context",
);
