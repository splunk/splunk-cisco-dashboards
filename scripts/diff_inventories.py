#!/usr/bin/env python3
"""Diff two ``sourcetype_field_inventory*.json`` files field-by-field.

Surfaces three buckets per sourcetype so we can spot:

* **Added in B** -- fields the live TA emits that the previous (oneshot)
  inventory didn't surface.  Usually safe to add to dashboards.
* **Removed in B** -- fields the previous inventory had but the live TA
  doesn't emit.  These are the actionable cases: any SPL referencing
  one of these is now broken on the live data shape.
* **Common** -- the stable intersection.

Usage::

    python3 scripts/diff_inventories.py \\
        scripts/sourcetype_field_inventory.json \\
        scripts/sourcetype_field_inventory_live_dnac.json

The output is markdown + a non-zero exit when there are removed fields,
so this is safe to wire into CI / pre-commit later.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load(path: Path) -> dict[str, dict]:
    return json.loads(path.read_text()).get("sourcetypes", {})


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("a", type=Path, help="Baseline inventory JSON")
    parser.add_argument("b", type=Path, help="Comparison inventory JSON")
    parser.add_argument(
        "--only-dnac",
        action="store_true",
        help="Restrict diff to `cisco:dnac:*` sourcetypes.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("scripts/sourcetype_field_inventory_diff.md"),
        help="Markdown report path.",
    )
    args = parser.parse_args()

    a = load(args.a)
    b = load(args.b)

    # Use the intersection (sourcetypes present in both files) so we
    # don't false-flag sourcetypes that simply weren't sampled in one
    # of the runs.
    common_st = sorted(set(a) & set(b))
    if args.only_dnac:
        common_st = [s for s in common_st if s.startswith("cisco:dnac:")]

    out: list[str] = []
    out.append("# Field Inventory Diff")
    out.append("")
    out.append(f"- **Baseline (A):** `{args.a}`")
    out.append(f"- **Comparison (B):** `{args.b}`")
    out.append(f"- **Sourcetypes compared:** {len(common_st)}")
    out.append("")
    out.append("## Summary")
    out.append("")
    out.append("| Sourcetype | A fields | B fields | Added in B | Removed in B |")
    out.append("|---|---:|---:|---:|---:|")

    total_removed = 0
    detail: list[tuple[str, set[str], set[str]]] = []

    for st in common_st:
        fa = set(a[st].get("fields", []))
        fb = set(b[st].get("fields", []))
        added = fb - fa
        removed = fa - fb
        total_removed += len(removed)
        detail.append((st, added, removed))
        out.append(
            f"| `{st}` | {len(fa)} | {len(fb)} | "
            f"{len(added)} | {len(removed)} |"
        )

    out.append("")
    out.append(
        "**Removed in B** is the actionable column - any SPL that "
        "references one of those field names is broken on the B "
        "data shape and needs to be rewritten or removed."
    )
    out.append("")

    out.append("## Per-sourcetype detail")
    out.append("")
    for st, added, removed in detail:
        if not added and not removed:
            continue
        out.append(f"### `{st}`")
        out.append("")
        if added:
            out.append(f"**Added in B ({len(added)}):**")
            out.append("")
            for f in sorted(added):
                out.append(f"- `{f}`")
            out.append("")
        if removed:
            out.append(f"**Removed in B ({len(removed)}):**")
            out.append("")
            for f in sorted(removed):
                out.append(f"- `{f}`")
            out.append("")

    args.out.write_text("\n".join(out) + "\n")
    print(f"Wrote {args.out}")
    print(f"Total fields removed across {len(common_st)} sourcetypes: {total_removed}")
    return 1 if total_removed else 0


if __name__ == "__main__":
    sys.exit(main())
