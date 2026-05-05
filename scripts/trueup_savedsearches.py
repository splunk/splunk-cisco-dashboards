#!/usr/bin/env python3
"""
Deprecated.

`searchbase.conf` is now the source of truth for ad-hoc dashboard SPL.
`savedsearches.conf` is intentionally limited to scheduled,
materialized, and explicit compatibility dependency searches. Do not
run this script to mirror searchbase into savedsearches; it remains only
as historical reference for the old design.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import sys
from dataclasses import dataclass, field
from html import unescape
from pathlib import Path
from typing import Dict, List


REPO_ROOT = Path(__file__).resolve().parent.parent
CONF_DIR = REPO_ROOT / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default"
SEARCHBASE = CONF_DIR / "searchbase.conf"
SAVEDSEARCHES = CONF_DIR / "savedsearches.conf"
BACKUP = SAVEDSEARCHES.with_suffix(".conf.bak")

TRUEUP_BANNER = (
    "\n# ======================================================================\n"
    "# Deprecated picker mirror — do not use with the current searchbase model.\n"
    "# Dashboard ad-hoc SPL belongs in searchbase.conf and inline ds.search.\n"
    "# ======================================================================\n"
)
TRUEUP_MARKER = "# Deprecated picker mirror"


@dataclass
class Stanza:
    """A single conf stanza (case-sensitive section name + key/values)."""

    name: str
    fields: Dict[str, str] = field(default_factory=dict)


def parse_conf(path: Path) -> List[Stanza]:
    """
    Parse a Splunk-style conf file. Handles:

    - Section headers `[stanza]`
    - `key = value` lines
    - Backslash line continuations: `value \\` continues on next line
    - Comments (`#` at line start) and blank lines

    Returns stanzas in document order. Does NOT support deeply nested
    or quoted backslashes — none of our confs use those.
    """
    stanzas: List[Stanza] = []
    current: Stanza | None = None
    pending_key: str | None = None
    pending_value_parts: List[str] = []
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        i += 1
        # Mid-continuation: keep appending until a line doesn't end with `\`.
        if pending_key is not None:
            stripped_end = raw.rstrip()
            if stripped_end.endswith("\\"):
                pending_value_parts.append(stripped_end[:-1].rstrip() + " ")
                continue
            pending_value_parts.append(stripped_end)
            assert current is not None
            current.fields[pending_key] = "".join(pending_value_parts).strip()
            pending_key = None
            pending_value_parts = []
            continue

        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = Stanza(name=line[1:-1])
            stanzas.append(current)
            continue
        if "=" not in line:
            # malformed; ignore.
            continue
        if current is None:
            # global key/value before first stanza; skip.
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val_stripped_end = raw.rstrip()
        if val_stripped_end.endswith("\\"):
            # multi-line value
            pending_key = key
            pending_value_parts = [val.strip().rstrip("\\").rstrip() + " "]
            continue
        current.fields[key] = val.strip()
    return stanzas


_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def html_to_plain(html: str, max_len: int = 600) -> str:
    """Strip HTML tags and collapse whitespace for `description` text."""
    if not html:
        return ""
    text = unescape(_TAG_RE.sub(" ", html))
    text = _WS_RE.sub(" ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 1].rstrip() + "…"
    return text


def split_search_for_conf(spl: str) -> str:
    """
    Format SPL back into Splunk's `\\` line-continuation style for
    readability in the conf. Splits on the `|` pipe operator,
    preserving inline pipes inside quoted strings.
    """
    if not spl:
        return ""
    spl = spl.strip()
    parts: List[str] = []
    buf: List[str] = []
    in_single = False
    in_double = False
    for ch in spl:
        if ch == "'" and not in_double:
            in_single = not in_single
        elif ch == '"' and not in_single:
            in_double = not in_double
        if ch == "|" and not in_single and not in_double:
            chunk = "".join(buf).strip()
            if chunk:
                parts.append(chunk)
            buf = []
            continue
        buf.append(ch)
    last = "".join(buf).strip()
    if last:
        parts.append(last)
    if len(parts) == 1:
        return parts[0]
    head, *rest = parts
    return head + " \\\n| " + " \\\n| ".join(rest)


def render_stanza(name: str, search_text: str, description: str) -> str:
    """Build the saved-search conf block for an orphaned searchbase entry."""
    lines: List[str] = []
    lines.append(f"[{name}]")
    if description:
        lines.append(f"description = {description}")
    lines.append("dispatch.earliest_time = -4h")
    lines.append("dispatch.latest_time = now")
    lines.append(f"search = {split_search_for_conf(search_text)}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be added without modifying files.",
    )
    args = parser.parse_args()
    _ = args

    print(
        "Deprecated: searchbase.conf is the source of truth. "
        "Do not mirror all searches into savedsearches.conf."
    )
    print("Use scripts/migrate_nav_savedsearches_to_searchbase.py for the limited migration path.")
    return 2

    sb_stanzas = parse_conf(SEARCHBASE)
    ss_stanzas = parse_conf(SAVEDSEARCHES)
    existing_names = {s.name for s in ss_stanzas}

    missing: List[Stanza] = []
    for sb in sb_stanzas:
        search_name = sb.fields.get("search_name", "").strip()
        if not search_name:
            continue
        if search_name in existing_names:
            continue
        spl = sb.fields.get("search", "").strip()
        if not spl:
            # No SPL we can use for dispatch — skip, no point creating
            # an empty stanza.
            continue
        missing.append(sb)

    print(f"searchbase entries: {len(sb_stanzas)}")
    print(f"savedsearches stanzas: {len(ss_stanzas)}")
    print(f"missing dispatch targets: {len(missing)}")

    if not missing:
        print("Nothing to do — savedsearches.conf is already in sync.")
        return 0

    if args.dry_run:
        print("\n=== dry-run preview (first 5 stanzas) ===")
        for sb in missing[:5]:
            search_name = sb.fields["search_name"].strip()
            description = html_to_plain(sb.fields.get("description", ""))
            spl = sb.fields["search"]
            print()
            print(render_stanza(search_name, spl, description))
        print("=== end preview ===")
        return 0

    # Backup once if we don't already have one.
    if not BACKUP.exists():
        shutil.copy2(SAVEDSEARCHES, BACKUP)
        print(f"backup written: {BACKUP}")

    existing_text = SAVEDSEARCHES.read_text(encoding="utf-8")
    if not existing_text.endswith("\n"):
        existing_text += "\n"

    # If the banner is already present, append below it; otherwise add
    # a banner. We never rewrite previously appended content — that
    # could clobber hand-tuned overrides.
    appended_blocks: List[str] = []
    for sb in missing:
        search_name = sb.fields["search_name"].strip()
        description = html_to_plain(sb.fields.get("description", ""))
        spl = sb.fields["search"]
        appended_blocks.append(render_stanza(search_name, spl, description))

    new_text = existing_text
    if TRUEUP_MARKER not in existing_text:
        new_text += TRUEUP_BANNER + "\n"
    new_text += "\n" + "\n".join(appended_blocks)
    SAVEDSEARCHES.write_text(new_text, encoding="utf-8")
    print(f"appended {len(appended_blocks)} stanzas to {SAVEDSEARCHES}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
