# Maintainer contract: dashboard time selectors

Shared Dashboard Manager time pickers use `scripts/dashboard_time_range.json`:
4h, 24h, 48h, 7d, 30d, Advanced enabled, 24h initial range, and `time_tok` with
earliest/latest/span. The DC generator reads this definition rather than
inventing its own shortcut list. Explicit URL/handoff time ranges still win.

Use the standard layoutDefinitions/tabs schema, disable the submit button, and
enable submission on load. Position shared pickers in each layout's header, with at least 360×60 canvas
units and enough room for Advanced and the Manager toolbar. Reserve separate
space for header text. Do not place this component in `globalInputs`.

`python3 scripts/validate_dashboard_time_inputs.py` checks every shipped Studio
view. Canonical packaging runs it before reserving a shared build number or
compiling. It rejects shared-picker drift, missing/undersized placements and
unbound time-token references. Existing native `input.timerange` dashboards
retain their historical lookbacks and tokens; their two-part value format is
validated. Native and custom time-input formats must not be mixed.

When adding or changing a generator, update its source and regenerate its view.
Run the audit and dashboardTimeInputs tests. Check the installed UI, including
Advanced, URL/handoff ranges and search token propagation. App-wrapper Simple
XML pages and React workspaces do not contain Studio time definitions and are
outside this validator's scope.
