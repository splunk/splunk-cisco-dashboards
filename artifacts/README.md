# Repository artifacts

This directory contains generated or historical analysis outputs that support
development but do not ship in the Splunk App for Secure Networking package.
Keep executable tooling in `scripts` and user-facing documentation in `docs`.

## Searchbase artifacts

- `searchbase/exports` contains the standalone Searchbase configuration export,
  its validation splits, and the export report.
- `searchbase/reports` contains machine-readable audit and review reports.
- `searchbase/cim` contains Common Information Model (CIM) audit inventories
  and disposition records.

Regenerate the exports and their validation splits from the repository root:

```bash
python3 scripts/build_searchbase_export.py
python3 scripts/validate_searchbase_export.py
```

Regenerate the Searchbase review report and its documentation summary:

```bash
python3 scripts/build_searchbase_review_report.py
```

Regenerate the CIM migration status document:

```bash
python3 scripts/audit_cim_migration_status.py
```

`searchbase/exports/temp_searchbase.conf` is a retained historical
intermediate. No current generator writes that file.
