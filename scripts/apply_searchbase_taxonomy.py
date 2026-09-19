#!/usr/bin/env python3
"""Apply the reviewed taxonomy to searchbase.conf.

Classification lives in preview_searchbase_taxonomy.py and is imported here so
the preview and the write can never disagree. This script rewrites only the
category, sub_category, and tags lines; every other byte of each stanza,
including the SPL, is passed through untouched and verified afterwards.

Usage:
  python3 scripts/apply_searchbase_taxonomy.py --check   # verify, write nothing
  python3 scripts/apply_searchbase_taxonomy.py --apply
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location(
    "preview_searchbase_taxonomy", HERE / "preview_searchbase_taxonomy.py"
)
preview = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(preview)

SOURCE = preview.SOURCE
EDITED_KEYS = ("category", "sub_category", "tags")


def rewrite_stanza(chunk: str, category: str, sub: str, tags: list[str]) -> str:
    """Replace exactly the three managed lines, leaving everything else alone."""
    replacements = {
        "category": category,
        "sub_category": sub,
        "tags": ",".join(tags),
    }
    for key, value in replacements.items():
        pattern = rf"^{key} = .*$"
        if not re.search(pattern, chunk, re.M):
            raise SystemExit(f"stanza is missing '{key} =' line; refusing to write")
        # A literal replacement avoids backslash escapes in SPL-derived values.
        chunk = re.sub(pattern, lambda _m, v=value: f"{key} = {v}", chunk, count=1, flags=re.M)
    return chunk


def strip_managed(text: str) -> str:
    """Everything except the three managed lines, for an equality check."""
    return "\n".join(
        line
        for line in text.splitlines()
        if not any(line.startswith(f"{k} = ") for k in EDITED_KEYS)
    )


def build(original: str) -> tuple[str, int]:
    chunks = re.split(r"(?=^\[[A-Za-z][A-Za-z0-9_-]*\]\s*$)", original, flags=re.M)
    out: list[str] = []
    changed = 0
    for chunk in chunks:
        m = re.match(r"^\[([^\]]+)\]", chunk)
        if not m:
            out.append(chunk)
            continue
        name = m.group(1)
        p = preview.propose(name, chunk)
        new_chunk = rewrite_stanza(chunk, p["cat"], p["sub"], p["tags"])
        if new_chunk != chunk:
            changed += 1
        out.append(new_chunk)
    return "".join(out), changed


def verify(original: str, updated: str) -> list[str]:
    """Structural guarantees that must hold no matter what the classifier did."""
    errors: list[str] = []

    old_names = re.findall(r"^\[([A-Za-z][A-Za-z0-9_-]*)\]\s*$", original, re.M)
    new_names = re.findall(r"^\[([A-Za-z][A-Za-z0-9_-]*)\]\s*$", updated, re.M)
    if old_names != new_names:
        errors.append(
            f"stanza list changed: {len(old_names)} -> {len(new_names)}"
        )

    # The single most important check: nothing outside the 3 managed lines moved.
    if strip_managed(original) != strip_managed(updated):
        errors.append("content outside category/sub_category/tags was modified")

    # Every SPL body must be byte-identical.
    def searches(text: str) -> list[str]:
        return re.findall(r"^search = (.*?)(?=^[a-z_]+\s*=|\Z)", text, re.M | re.S)

    if searches(original) != searches(updated):
        errors.append("at least one 'search =' body changed")

    for name in new_names:
        chunk = re.search(
            rf"^\[{re.escape(name)}\]\n(.*?)(?=^\[|\Z)", updated, re.M | re.S
        )
        body = chunk.group(1) if chunk else ""
        for key in EDITED_KEYS:
            if len(re.findall(rf"^{key} = ", body, re.M)) != 1:
                errors.append(f"[{name}] has a duplicate or missing '{key}'")
        cat = re.search(r"^category = (.*)$", body, re.M)
        if cat and cat.group(1).strip() not in preview.CATEGORIES:
            errors.append(f"[{name}] unexpected category {cat.group(1)!r}")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    if not (args.apply or args.check):
        ap.error("pass --check or --apply")

    original = SOURCE.read_text()
    updated, changed = build(original)
    errors = verify(original, updated)

    # The classifier reads the existing category/sub_category/tags as input, so
    # it must treat its own output as a fixed point. If it does not, a second
    # run silently reclassifies already-normalized values.
    twice, _ = build(updated)
    if twice != updated:
        errors.append("classifier is not idempotent: re-running would change the file again")

    print(f"stanzas rewritten: {changed}")
    if errors:
        print(f"\nVERIFY FAILED ({len(errors)} problems):")
        for e in errors[:20]:
            print(f"  - {e}")
        return 1
    print("verify: PASS (stanza list, SPL bodies, and all other keys unchanged)")

    if args.apply:
        SOURCE.write_text(updated)
        print(f"\nwrote {SOURCE}")
    else:
        print("\n--check only, nothing written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
