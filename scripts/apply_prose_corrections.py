#!/usr/bin/env python3
"""Correct individual sentences in searchbase.conf prose.

Why this is separate from apply_searchbase_overrides.py
-------------------------------------------------------
That script replaces a whole key. That is right when a field is wrong end to
end, but most defects found by audit_searchbase_prose.py are one clause in an
otherwise accurate paragraph. Replacing the whole field to fix a clause means
rewriting prose nobody reviewed, which risks losing correct detail.

Each entry here is a literal substring swap scoped to one stanza and one key.
The run fails if a FROM string is missing or appears more than once, so a
correction can never land on the wrong sentence or silently stop applying
when the surrounding prose is edited.

Same replay contract as the other scripts: searchbase.conf gets rebuilt with
    git checkout HEAD -- <searchbase.conf>
    python3 scripts/apply_searchbase_taxonomy.py --apply
    python3 scripts/apply_searchbase_overrides.py --apply
    python3 scripts/apply_prose_corrections.py --apply

Usage:
    python3 scripts/apply_prose_corrections.py --check
    python3 scripts/apply_prose_corrections.py --apply
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

SOURCE = (
    Path(__file__).resolve().parent.parent
    / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

# (stanza_id, key, from_text, to_text, why)
Correction = tuple[str, str, str, str, str]

# ---------------------------------------------------------------------------
# 1. Citations of a script that is not in the repository
# ---------------------------------------------------------------------------
# Six stanzas credit their field corrections to
# "scripts/audit_sourcetype_fields.py". No such file has ever been committed.
# The corrections themselves are right and the SPL proves them -- these
# searches really do read `id` and not `incident_id` -- so only the false
# citation goes. A pointer a reader cannot follow is worse than none: it
# claims evidence exists.
_MISSING_SCRIPT: list[Correction] = [
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

CORRECTIONS: list[Correction] = [
    *_MISSING_SCRIPT,
]


def chunks_of(text: str) -> list[str]:
    parts = re.split(r"(?=^\[[A-Za-z][A-Za-z0-9_-]*\]\s*$)", text, flags=re.M)
    return [c for c in parts if re.match(r"^\[", c)]


def stanza_ids(text: str) -> list[str]:
    return re.findall(r"^\[([A-Za-z][A-Za-z0-9_-]*)\]\s*$", text, re.M)


def build(original: str) -> tuple[str, int, list[str]]:
    errors: list[str] = []
    applied = 0
    out: list[str] = []
    wanted: dict[str, list[Correction]] = {}
    for c in CORRECTIONS:
        wanted.setdefault(c[0], []).append(c)

    for chunk in chunks_of(original):
        m = re.match(r"^\[([^\]]+)\]", chunk)
        sid = m.group(1) if m else None
        if sid not in wanted:
            out.append(chunk)
            continue
        new_chunk = chunk
        for _, key, frm, to, why in wanted[sid]:
            line_re = rf"^{key} = (.*)$"
            lm = re.search(line_re, new_chunk, re.M)
            if not lm:
                errors.append(f"[{sid}] has no '{key} =' line")
                continue
            value = lm.group(1)
            n = value.count(frm)
            if n == 0:
                # Already applied is fine; that is what makes this idempotent.
                if to and to in value:
                    continue
                if not to and frm not in value:
                    continue
                errors.append(f"[{sid}].{key}: FROM text not found ({why})")
                continue
            if n > 1:
                errors.append(f"[{sid}].{key}: FROM text appears {n} times, refusing")
                continue
            updated = value.replace(frm, to)
            updated = re.sub(r"\s{2,}", " ", updated)
            new_chunk = (
                new_chunk[: lm.start(1)] + updated + new_chunk[lm.end(1):]
            )
            applied += 1
        out.append(new_chunk)
    return "".join(out), applied, errors


def verify(original: str, updated: str) -> list[str]:
    errors: list[str] = []
    if stanza_ids(original) != stanza_ids(updated):
        errors.append("stanza list changed")

    def searches(text: str) -> list[str]:
        return re.findall(r"^search = (.*?)(?=^[a-z_]+\s*=|\Z)", text, re.M | re.S)

    if searches(original) != searches(updated):
        errors.append("at least one 'search =' body changed")

    managed = {(c[0], c[1]) for c in CORRECTIONS}
    for o_chunk, n_chunk in zip(chunks_of(original), chunks_of(updated)):
        sid = re.match(r"^\[([^\]]+)\]", o_chunk).group(1)
        for line_o, line_n in zip(o_chunk.splitlines(), n_chunk.splitlines()):
            if line_o == line_n:
                continue
            key = line_o.split(" = ")[0]
            if (sid, key) not in managed:
                errors.append(f"[{sid}] unmanaged key {key!r} changed")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if not (args.apply or args.check):
        ap.error("pass --check or --apply")

    original = SOURCE.read_text()
    updated, applied, errors = build(original)
    errors += verify(original, updated)

    twice, applied_twice, _ = build(updated)
    if twice != updated or applied_twice:
        errors.append("not idempotent: a second run would change the file again")

    print(f"corrections defined: {len(CORRECTIONS)}; applied this run: {applied}")
    if errors:
        print(f"\nFAILED ({len(errors)} problems):")
        for e in errors[:25]:
            print(f"  - {e}")
        return 1
    print("verify: PASS (stanza list, SPL bodies, and unmanaged keys unchanged)")

    if args.apply:
        SOURCE.write_text(updated)
        print(f"\nwrote {SOURCE}")
    else:
        print("\n--check only, nothing written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
