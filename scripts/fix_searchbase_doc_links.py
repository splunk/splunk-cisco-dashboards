#!/usr/bin/env python3
"""Append verified vendor documentation links to ``related_info``.

1062 of the 1082 catalog stanzas carry a ``related_info`` list with no outbound
link, so a user who wants the authoritative product reference has to go find it.
This script resolves each stanza's product from its own SPL -- sourcetype first,
then data model, then index macro -- and appends one link entry drawn from the
verified library in ``searchbase_doc_links.py``.

Only stanzas whose product is unambiguous are touched. ``index_dc`` spans ACI
and Nexus Dashboard and ``index_security`` spans most of the security
portfolio, so neither resolves on its own; those stanzas keep their existing
``related_info`` untouched and are reported as unresolved. A missing link is a
gap, but a confidently wrong link is a defect.

This adds a link; it does not rewrite the surrounding prose. Stanzas whose
``related_info`` bullets are generated boilerplate still need the hand pass.

Usage::

    python3 scripts/fix_searchbase_doc_links.py --check
    python3 scripts/fix_searchbase_doc_links.py --sample 3
    python3 scripts/fix_searchbase_doc_links.py --apply
"""

from __future__ import annotations

import argparse
import collections
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from audit_searchbase_metadata_claims import SEARCHBASE  # noqa: E402
from searchbase_doc_links import PRODUCT_DOCS, detect_product  # noqa: E402


def link_item(product: str) -> str:
    doc = PRODUCT_DOCS[product]
    return f'<li><b><a href="{doc.url}">{doc.title}</a></b><br>{doc.blurb}</li>'


def append_link(related_info: str, product: str) -> str | None:
    """Return ``related_info`` with the product link appended, or None."""
    value = related_info.strip()
    item = link_item(product)

    if value.endswith("</ul>"):
        return value[: -len("</ul>")] + item + "</ul>"
    if value.startswith("<li>"):
        # A handful of stanzas hold a bare <li> run with no wrapping list.
        # Wrapping them here also repairs that malformed markup.
        return f"<ul>{value}{item}</ul>"
    return None


def iter_prose_lines(text: str):
    """Yield ``(index, stanza, key, value)`` for non-continued ``key = value`` lines."""
    lines = text.splitlines(keepends=True)
    stanza = ""
    in_continuation = False

    for index, raw in enumerate(lines):
        line = raw.rstrip("\n")
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
        if line.endswith("\\"):
            in_continuation = True
            continue
        yield index, stanza, match.group(1), match.group(2)

    return lines


def process(text: str) -> tuple[str, collections.Counter, list[tuple[str, str]], int]:
    lines = text.splitlines(keepends=True)
    # The `search` field always precedes prose keys within a stanza, so collect
    # each stanza's SPL first, then decide on its related_info.
    spl_by_stanza: dict[str, str] = {}
    stanza = ""
    in_continuation = False
    pending_key = None
    buffer: list[str] = []

    for raw in lines:
        line = raw.rstrip("\n")
        if in_continuation:
            buffer.append(line.rstrip("\\"))
            in_continuation = line.endswith("\\")
            if not in_continuation and pending_key == "search":
                spl_by_stanza[stanza] = "\n".join(buffer)
                pending_key, buffer = None, []
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
            in_continuation, pending_key, buffer = True, key, [value.rstrip("\\")]
            continue
        if key == "search":
            spl_by_stanza[stanza] = value

    stats: collections.Counter = collections.Counter()
    samples: list[tuple[str, str]] = []
    unresolved = 0
    stanza = ""
    in_continuation = False

    for index, raw in enumerate(lines):
        line = raw.rstrip("\n")
        newline = raw[len(line) :]
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
        if line.endswith("\\"):
            in_continuation = True
            continue
        key, value = match.group(1), match.group(2)
        if key != "related_info" or not value.strip() or "href=" in value:
            continue

        product, _ = detect_product(spl_by_stanza.get(stanza, ""))
        if not product:
            unresolved += 1
            continue

        updated = append_link(value, product)
        if updated is None:
            stats["skipped: unrecognised markup"] += 1
            continue

        lines[index] = f"{key} = {updated}{newline}"
        stats[product] += 1
        if len(samples) < 12:
            samples.append((stanza, updated))

    return "".join(lines), stats, samples, unresolved


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", default=str(SEARCHBASE))
    ap.add_argument("--apply", action="store_true", help="Write changes to disk")
    ap.add_argument("--sample", type=int, default=0, help="Print N rendered results")
    args = ap.parse_args()

    path = Path(args.source)
    text = path.read_text()
    new_text, stats, samples, unresolved = process(text)

    total = sum(v for k, v in stats.items() if not k.startswith("skipped"))
    print(f"stanzas linked   : {total}")
    print(f"unresolved       : {unresolved}\n")
    for product, count in stats.most_common():
        print(f"  {count:5d}  {product}")

    for stanza, value in samples[: args.sample]:
        print(f"\n--- [{stanza}] ---\n{value}")

    if args.apply:
        path.write_text(new_text)
        print(f"\nwrote {path}")
    else:
        print("\n(dry run -- pass --apply to write)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
