#!/usr/bin/env python3
"""Snapshot each stanza's ``dispatch_context`` into ``dispatch_context_origin``.

``dispatch_context`` currently serves two conflicting purposes. It is the
catalogue's source-app facet -- the record of which upstream app a search
was harvested from (``TA_cisco_catalyst``, ``ta_cisco_thousandeyes``, ...)
-- and it is also the value Splunk uses to decide which app a dispatched
search runs in. Retargeting it for the second purpose destroys the first,
because the harvest origin is not recoverable from the SPL alone for every
stanza (see ``CATALYST_RAW_SOURCE_STANZAS`` in
``scripts/searchbase_dispatch_context.py``, where provenance had to be
recovered from pre-normalization history).

This migration copies the current value into a dedicated provenance field
*before* that retargeting happens, so the origin survives it. Once every
stanza carries ``dispatch_context_origin``, ``dispatch_context`` can be
changed per search -- manually, one decision at a time -- and the original
harvest app is still there to restore or audit against.

``dispatch_context_origin`` is inert: nothing reads it at dispatch time and
it is declared in ``searchbase.conf.spec`` purely as documentation. It is
deliberately *not* added to ``REQUIRED_FOR_GAP_REPORT`` in the formatter,
since a stanza authored locally has no harvest origin to record.

The rewrite is line-oriented and block-scoped rather than a parse-and-emit
round trip: only the metadata region of each stanza is touched, so multi-line
``search`` values are byte-preserved. This mirrors the ``re.subn`` approach in
``scripts/searchbase_dispatch_context.py``.

Usage::

    python3 scripts/add_dispatch_context_origin.py --check
    python3 scripts/add_dispatch_context_origin.py --apply
"""

from __future__ import annotations

import argparse
import collections
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

HEADER = re.compile(r"(?m)^\[([a-z0-9_]+)\]\n")

# Captures indentation and the exact ``key = value`` separator spacing so the
# inserted line is written in the same style as the line it follows.
DISPATCH_CONTEXT = re.compile(r"(?m)^([ \t]*)dispatch_context([ \t]*=[ \t]*)(\S.*?)[ \t]*$")
ORIGIN_PRESENT = re.compile(r"(?m)^[ \t]*dispatch_context_origin[ \t]*=")

# The metadata region ends at the ``search`` field. Everything from there on is
# SPL, which may legitimately contain a line that looks like a conf key.
SEARCH_FIELD = re.compile(r"(?m)^[ \t]*search[ \t]*=[ \t]*")


def split_metadata(block: str) -> tuple[str, str]:
    """Split a stanza block into (metadata region, search region)."""
    match = SEARCH_FIELD.search(block)
    if not match:
        return block, ""
    return block[: match.start()], block[match.start() :]


def add_origin(text: str) -> tuple[str, collections.Counter[str], dict[str, int]]:
    """Insert ``dispatch_context_origin`` after each ``dispatch_context`` line."""
    matches = list(HEADER.finditer(text))
    if not matches:
        raise ValueError("no Searchbase stanzas found")
    names = [m.group(1) for m in matches]
    if len(set(names)) != len(names):
        raise ValueError("duplicate stanza IDs prevent safe insertion")

    values: collections.Counter[str] = collections.Counter()
    stats = {"stanzas": len(matches), "added": 0, "already_present": 0, "no_dispatch_context": 0}
    missing: list[str] = []

    output = [text[: matches[0].start()]]
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[match.start() : end]
        meta, search = split_metadata(block)

        if ORIGIN_PRESENT.search(meta):
            stats["already_present"] += 1
            output.append(block)
            continue

        found = DISPATCH_CONTEXT.search(meta)
        if not found:
            stats["no_dispatch_context"] += 1
            missing.append(match.group(1))
            output.append(block)
            continue

        value = found.group(3)
        meta, count = DISPATCH_CONTEXT.subn(
            lambda m: (
                f"{m.group(0)}\n"
                f"{m.group(1)}dispatch_context_origin{m.group(2)}{m.group(3)}"
            ),
            meta,
            count=1,
        )
        if count != 1:
            raise ValueError(f"failed to insert origin in stanza: {match.group(1)}")
        stats["added"] += 1
        values[value] += 1
        output.append(meta + search)

    if missing:
        stats["missing_ids"] = missing  # type: ignore[assignment]
    return "".join(output), values, stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=str(SEARCHBASE), help="Path to searchbase.conf")
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report changes without writing (default)",
    )
    parser.add_argument("--apply", action="store_true", help="Write changes to disk")
    args = parser.parse_args()

    path = Path(args.source)
    text = path.read_text(encoding="utf-8")
    new_text, values, stats = add_origin(text)

    missing = stats.pop("missing_ids", [])
    print(f"stanzas processed        : {stats['stanzas']}")
    print(f"dispatch_context_origin added : {stats['added']}")
    print(f"already present (skipped)     : {stats['already_present']}")
    print(f"no dispatch_context to copy   : {stats['no_dispatch_context']}")
    if missing:
        for name in missing[:20]:
            print(f"    {name}")
        if len(missing) > 20:
            print(f"    ... and {len(missing) - 20} more")

    print("\ndispatch_context_origin values:")
    for value, count in values.most_common():
        print(f"  {count:5d}  {value}")
    print(f"  distinct: {len(values)}  total: {sum(values.values())}")

    if args.apply:
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            print(f"\nwrote {path}")
        else:
            print("\nno changes needed")
    else:
        print("\n(dry run -- pass --apply to write)")

    return 1 if stats["no_dispatch_context"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
