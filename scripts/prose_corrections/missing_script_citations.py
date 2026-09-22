"""R12: prose crediting a verification script that is not in the repo.

Six stanzas credit their field corrections to
"scripts/audit_sourcetype_fields.py". No such file has ever been committed.

The corrections themselves are right and the SPL proves them -- these
searches really do read `id` and not `incident_id` -- so only the false
citation goes. A pointer a reader cannot follow is worse than none: it
asserts evidence exists.
"""

from __future__ import annotations

CORRECTIONS = [
    (
        "executive_dashboard_xdr_incident_count",
        "related_info",
        " Verified via the field audit script (<code>scripts/audit_sourcetype_fields.py</code>).",
        "",
        "cited script does not exist in the repo",
    ),
    (
        "it_critical_systems_inventory_reachability_summary",
        "related_info",
        " Verified via the field-discovery audit (<code>scripts/audit_sourcetype_fields.py</code> against <code>cisco:dnac:*</code> sourcetypes).",
        "",
        "cited script does not exist in the repo",
    ),
    (
        "security_resilience_xdr_by_severity",
        "related_info",
        " Verified via <code>scripts/audit_sourcetype_fields.py</code>.",
        "",
        "cited script does not exist in the repo",
    ),
    (
        "building_resilience_ds_spaces_kpi_devices",
        "related_info",
        " Verified via <code>scripts/audit_sourcetype_fields.py</code>.",
        "",
        "cited script does not exist in the repo",
    ),
    (
        "overview_xdr_critical_incidents",
        "explanation",
        " &mdash; verified via <code>scripts/audit_sourcetype_fields.py</code>",
        "",
        "cited script does not exist in the repo",
    ),
    (
        "overview_top_incident_volume",
        "related_info",
        " Verified with <code>scripts/audit_sourcetype_fields.py</code>.",
        "",
        "cited script does not exist in the repo",
    ),
]
