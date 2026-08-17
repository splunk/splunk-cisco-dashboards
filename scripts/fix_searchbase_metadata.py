#!/usr/bin/env python3
"""Apply targeted, conservative metadata fixes to ``searchbase.conf``.

What this does:

1. **Adds the picker-gate tag ``Cisco``** to the 6 ``cisco:dnac:issue``
   stanzas rewritten in the 2026-05-09 live-DNAC remediation that were
   inadvertently left without it.
2. **Normalises a small set of clearly-redundant tag spellings** so the
   picker's tag dropdown stops listing the same logical tag twice
   (e.g. ``ActiveDirectory`` vs ``Active_Directory``,
   ``Executive Summary`` vs ``Executive_Summary``, ``SDWAN`` vs
   ``SD-WAN``, ``Network Operations`` &rarr; ``Network_Operations``).
3. **Normalises one sub-category casing variant** (``IDS/IPS`` &rarr;
   ``IDS / IPS``).
4. **Bumps version + date_updated + updated_author** on every stanza
   the script actually touches, so the catalogue records the change.

The script is intentionally minimal -- prose body fields
(``description`` / ``explanation`` / ``solution`` / ``related_info``)
are not modified here, since rewriting a few hundred prose blocks
would be high-risk and is better done in targeted manual passes.

Run::

    python3 scripts/fix_searchbase_metadata.py

The script is idempotent (re-running on an already-fixed file yields
no changes).
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEARCHBASE = (
    ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "src"
    / "main"
    / "resources"
    / "splunk"
    / "default"
    / "searchbase.conf"
)

# Stanzas that need the picker-gate ``Cisco`` tag added. These are the
# 6 ``cisco:dnac:issue`` stanzas rewritten today (Group B): site
# enrichment via devicehealth join means they're now validated against
# live data and should be visible in the picker. The 7th sibling
# (``executive_dashboard_issue_summary_kpis``) already has the tag.
STANZAS_NEEDING_CISCO_TAG = {
    "executive_summary_issue_details",
    "it_critical_systems_aaa_server_issues",
    "it_critical_systems_ap_disconnect_issues",
    "it_critical_systems_bgp_neighbor_issues",
    "it_critical_systems_interface_utilization_issues",
    "it_critical_systems_issues_by_site",
}

# Tag normalisation table. Key = legacy spelling that exists in the
# conf, value = canonical spelling we're consolidating to. Every entry
# below either fixes a casing/punct typo or merges into a more popular
# variant of the same logical tag.
TAG_RENAMES = {
    "ActiveDirectory": "Active_Directory",
    "Executive Summary": "Executive_Summary",
    "Network Operations": "Network_Operations",
    "Cisco Cloud Security": "Cisco_Cloud_Security",
    "Secure Access": "Secure_Access",
    "Cloud Firewall": "Cloud_Firewall",
    "SDWAN": "SD-WAN",
}

# Sub-category normalisation (spelled-out forms of the same concept).
SUBCATEGORY_RENAMES = {
    "IDS/IPS": "IDS / IPS",
}

DATE_NEW = "2026-05-09"
AUTHOR_NEW = "codex"


def split_into_stanzas(text: str) -> list[tuple[str | None, str]]:
    """Return [(stanza_name_or_None, body)] preserving file order.

    The first chunk (anything before the first ``[stanza]`` header)
    is yielded with name=None so we can round-trip the leading
    comments cleanly.
    """
    chunks: list[tuple[str | None, str]] = []
    current_name: str | None = None
    current_body: list[str] = []
    for line in text.splitlines(keepends=True):
        m = re.match(r"^\[([^\]]+)\]\s*\n?$", line)
        if m:
            chunks.append((current_name, "".join(current_body)))
            current_name = m.group(1)
            current_body = [line]
        else:
            current_body.append(line)
    chunks.append((current_name, "".join(current_body)))
    return chunks


def get_prop(body: str, key: str) -> str | None:
    m = re.search(rf"^{re.escape(key)}\s*=\s*(.*)$", body, flags=re.M)
    return m.group(1).rstrip() if m else None


def set_prop(body: str, key: str, value: str) -> str:
    pattern = rf"^({re.escape(key)}\s*=\s*).*$"
    if re.search(pattern, body, flags=re.M):
        return re.sub(pattern, lambda m: f"{m.group(1)}{value}", body, count=1, flags=re.M)
    # Insert before the ``search = ...`` line if not present.
    insertion = f"{key} = {value}\n"
    search_match = re.search(r"^search\s*=", body, flags=re.M)
    if search_match:
        idx = search_match.start()
        return body[:idx] + insertion + body[idx:]
    return body + insertion


def bump_version(version: str | None) -> str:
    if not version:
        return "1.0.1"
    parts = version.strip().split(".")
    if not parts or not parts[-1].isdigit():
        return f"{version}.1"
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)


def normalise_tags_value(raw: str) -> str:
    """Apply TAG_RENAMES and de-duplicate while preserving order."""
    parts = [t.strip() for t in raw.split(",") if t.strip()]
    out: list[str] = []
    seen: set[str] = set()
    for t in parts:
        canonical = TAG_RENAMES.get(t, t)
        if canonical not in seen:
            out.append(canonical)
            seen.add(canonical)
    return ",".join(out)


def maybe_add_cisco(tags_raw: str) -> str:
    parts = [t.strip() for t in tags_raw.split(",") if t.strip()]
    if "Cisco" in parts:
        return tags_raw
    parts.append("Cisco")
    return ",".join(parts)


def main() -> int:
    text = SEARCHBASE.read_text()
    chunks = split_into_stanzas(text)

    touched_stanzas: list[str] = []

    for i, (name, body) in enumerate(chunks):
        if name is None:
            continue
        original_body = body

        # 1) Tag normalisation + Cisco-gate addition.
        tags_raw = get_prop(body, "tags")
        if tags_raw is not None:
            new_tags = normalise_tags_value(tags_raw)
            if name in STANZAS_NEEDING_CISCO_TAG:
                new_tags = maybe_add_cisco(new_tags)
            if new_tags != tags_raw:
                body = set_prop(body, "tags", new_tags)

        # 2) Sub-category normalisation.
        sub_raw = get_prop(body, "sub_category")
        if sub_raw is not None and sub_raw in SUBCATEGORY_RENAMES:
            body = set_prop(body, "sub_category", SUBCATEGORY_RENAMES[sub_raw])

        if body != original_body:
            # 3) Bump version + date_updated + updated_author.
            current_version = get_prop(body, "version")
            body = set_prop(body, "version", bump_version(current_version))
            body = set_prop(body, "date_updated", DATE_NEW)
            body = set_prop(body, "updated_author", AUTHOR_NEW)
            touched_stanzas.append(name)
            chunks[i] = (name, body)

    new_text = "".join(b for _, b in chunks)
    if new_text != text:
        SEARCHBASE.write_text(new_text)
        print(f"Wrote {SEARCHBASE.relative_to(ROOT)}")
        print(f"Touched {len(touched_stanzas)} stanzas:")
        for s in touched_stanzas:
            print(f"  - [{s}]")
    else:
        print("No changes (already normalised).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
