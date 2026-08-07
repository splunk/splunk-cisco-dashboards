#!/usr/bin/env python3
"""Repair mechanical prose artifacts in ``searchbase.conf``.

``audit_searchbase_metadata_claims.py`` separates metadata defects into those
that need a human to read the SPL and those that are pure text damage. This
script fixes only the second group:

``ARTIFACT_PUNCTUATION``
    Earlier automated passes deleted clauses such as ", sorted by count"
    without repairing the surrounding sentence, leaving ``per site..`` and
    ``interface .`` behind.

``ARTIFACT_SENTENCE_CASE``
    The same passes removed a leading clause and left the sentence starting on
    a lowercase word.

``NO_HTML``
    A handful of fields are bare text. Every consumer renders these as HTML, so
    an unwrapped value loses its paragraph break.

Everything else the auditor reports -- stale sort promises, output-shape
contradictions, generated boilerplate, missing documentation links -- requires
reading the SPL and is deliberately out of scope here.

Two rules keep this safe. The parser is continuation-aware, so a key-shaped
line inside a multiline ``search`` is never treated as a metadata key. And no
substitution touches an ellipsis, because SPL prose uses ``round(...,1)`` and
``stats latest(...) by host`` as legitimate elisions.

Usage::

    python3 scripts/fix_searchbase_metadata_artifacts.py --check
    python3 scripts/fix_searchbase_metadata_artifacts.py --apply
"""

from __future__ import annotations

import argparse
import collections
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from audit_searchbase_metadata_claims import (  # noqa: E402
    OPENS_WITH_CODE,
    SEARCHBASE,
    opens_with_identifier,
    plain_text,
)

PROSE_KEYS = ("description", "explanation", "solution", "related_info")
HTML_TAG = re.compile(r"<[a-zA-Z/][^>]*>")

# Each pattern is anchored so that an ellipsis can never match.
PUNCTUATION_FIXES: tuple[tuple[re.Pattern, str, str], ...] = (
    (re.compile(r"(?<!\.)\.\.(?!\.)"), ".", "double period"),
    (re.compile(r",,+"), ",", "double comma"),
    (re.compile(r"(?<=\S)\s+,"), ",", "space before comma"),
    (re.compile(r'(?<=[A-Za-z0-9)\]"\u2019])\s+\.(?!\.)'), ".", "space before period"),
)


def fix_punctuation(value: str) -> tuple[str, list[str]]:
    applied: list[str] = []
    for pattern, replacement, label in PUNCTUATION_FIXES:
        value, count = pattern.subn(replacement, value)
        if count:
            applied.append(f"{label} x{count}")
    return value, applied


def fix_sentence_case(key: str, value: str) -> tuple[str, list[str]]:
    """Capitalise the first visible word when it is ordinary prose."""
    if key == "related_info":
        return value, []
    text = plain_text(value)
    if not text[:1].islower():
        return value, []
    if OPENS_WITH_CODE.match(value) or opens_with_identifier(text):
        return value, []

    # Uppercase the first alphabetic character that sits outside a tag.
    out = []
    changed = False
    in_tag = False
    for char in value:
        if not changed and not in_tag:
            if char == "<":
                in_tag = True
            elif char.isalpha():
                char = char.upper()
                changed = True
        elif in_tag and char == ">":
            in_tag = False
        out.append(char)
    return "".join(out), (["sentence case"] if changed else [])


def fix_missing_html(key: str, value: str) -> tuple[str, list[str]]:
    if key == "related_info" or not value.strip() or HTML_TAG.search(value):
        return value, []
    return f"<p>{value.strip()}</p>", ["wrapped in <p>"]


def process(text: str) -> tuple[str, collections.Counter, set[str]]:
    stats: collections.Counter = collections.Counter()
    touched: set[str] = set()
    lines = text.splitlines(keepends=True)
    stanza = ""
    in_continuation = False

    for index, raw in enumerate(lines):
        line = raw.rstrip("\n")
        newline = raw[len(line) :]

        # A continued line belongs to the previous key (almost always `search`),
        # so it must never be parsed as `key = value`.
        if in_continuation:
            in_continuation = line.endswith("\\")
            continue

        header = re.match(r"^\[([^\]]+)\]\s*$", line)
        if header:
            stanza = header.group(1)
            continue

        match = re.match(r"^([a-z_]+) = (.*)$", line)
        if not match:
            continue
        key, value = match.group(1), match.group(2)
        if line.endswith("\\"):
            in_continuation = True
            continue
        if key not in PROSE_KEYS:
            continue

        original = value
        notes: list[str] = []
        for fixer in (
            lambda v: fix_punctuation(v),
            lambda v: fix_sentence_case(key, v),
            lambda v: fix_missing_html(key, v),
        ):
            value, applied = fixer(value)
            notes.extend(applied)

        if value != original:
            lines[index] = f"{key} = {value}{newline}"
            touched.add(stanza)
            for note in notes:
                stats[note.split(" x")[0]] += (
                    int(note.split(" x")[1]) if " x" in note else 1
                )

    return "".join(lines), stats, touched


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", default=str(SEARCHBASE))
    ap.add_argument("--apply", action="store_true", help="Write changes to disk")
    args = ap.parse_args()

    path = Path(args.source)
    text = path.read_text()
    new_text, stats, touched = process(text)

    print(f"stanzas modified : {len(touched)}")
    print(f"total repairs    : {sum(stats.values())}\n")
    for label, count in stats.most_common():
        print(f"  {count:4d}  {label}")

    if args.apply:
        path.write_text(new_text)
        print(f"\nwrote {path}")
    else:
        print("\n(dry run -- pass --apply to write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
