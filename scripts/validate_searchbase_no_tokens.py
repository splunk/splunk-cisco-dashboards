#!/usr/bin/env python3
"""Fail if searchbase.conf search fields contain dashboard token placeholders."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

# $identifier$ but not escaped \$ in regex strings
TOKEN = re.compile(r"(?<!\\)\$[A-Za-z_][A-Za-z0-9_]*\$")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = p.parse_args()

    text = args.source.read_text()
    failures: list[tuple[str, list[str]]] = []
    for block in re.split(r"\n(?=\[)", text):
        m = re.match(r"\[([^\]]+)\]", block)
        if not m:
            continue
        name = m.group(1)
        sm = re.search(r"^search\s*=\s*(.*)", block, re.S | re.M)
        if not sm:
            continue
        toks = TOKEN.findall(sm.group(1))
        if toks:
            failures.append((name, toks))

    if failures:
        print(f"TOKEN CHECK FAILED: {len(failures)} stanzas", file=sys.stderr)
        for name, toks in failures:
            print(f"  {name}: {toks}", file=sys.stderr)
        return 1

    print("TOKEN CHECK OK: no dashboard tokens in search fields")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
