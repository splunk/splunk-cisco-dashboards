# Repository scripts

The scripts in this directory build, audit, migrate, and validate repository
content. Generated outputs belong in `artifacts`; product documentation belongs
in `docs`; packaged app resources remain under
`packages/splunk-cisco-dashboards/src/main/resources/splunk`.

## Common Searchbase workflows

Build and validate the standalone Searchbase export:

```bash
python3 scripts/build_searchbase_export.py
python3 scripts/validate_searchbase_export.py
```

Build the machine-readable Searchbase review report and its documentation
summary:

```bash
python3 scripts/build_searchbase_review_report.py
```

Audit CIM migration coverage and refresh the status document:

```bash
python3 scripts/audit_cim_migration_status.py
```

Format and verify the canonical Searchbase configuration:

```bash
python3 scripts/format_searchbase_conf.py --check
python3 scripts/verify_searchbase_format.py
```

## Organization rules

- Keep reusable executable code in `scripts`.
- Keep generated configuration, CSV, JSON, and large audit outputs in
  `artifacts`.
- Keep operator and developer guidance in `docs`.
- Keep one-off scratch files in the ignored `tmp` directory.
