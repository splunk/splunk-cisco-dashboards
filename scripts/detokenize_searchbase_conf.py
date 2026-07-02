#!/usr/bin/env python3
"""Remove Simple XML / Dashboard Studio token placeholders from searchbase.conf.

Only modifies stanzas whose ``search`` field contains ``$token$`` placeholders.
Search text is edited in place (no unfold/refold) so subsearch layout is preserved.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
FORMAT_SCRIPT = REPO / "scripts/format_searchbase_conf.py"

TOKEN = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*\$")
TOKEN_SEARCH_STAGE = re.compile(
    r"^\|\s*search\s+[^|\\\n]*\$[A-Za-z_][A-Za-z0-9_]*\$.*(?:\\)?\s*$",
    re.I | re.M,
)
TOKEN_FIELD_PRED = re.compile(
    r'\s*[A-Za-z0-9_.]+\s*=\s*"\$[A-Za-z_][A-Za-z0-9_]*\$"',
)


def load_formatter():
    spec = importlib.util.spec_from_file_location("format_searchbase_conf", FORMAT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def detokenize_search(search: str) -> str:
    if not TOKEN.search(search):
        return search

    lines = search.split("\n")
    kept: list[str] = []
    for line in lines:
        if TOKEN_SEARCH_STAGE.match(line.rstrip()):
            continue
        line = TOKEN_FIELD_PRED.sub("", line)
        line = TOKEN.sub("*", line)
        if line.strip():
            kept.append(line)

    out = "\n".join(kept)
    # Drop dangling continuation on last line if we removed a following stage.
    out = re.sub(r"\\(\s*)$", "", out, flags=re.M)
    return out


def detokenize_prose(text: str) -> str:
    if not TOKEN.search(text):
        return text
    return TOKEN.sub("all values", text)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    fmt = load_formatter()
    stanzas = fmt.parse_stanzas(args.source.read_text())
    changed = []
    new_stanzas = []
    for name, fields in stanzas:
        fields = dict(fields)
        orig_search = fields.get("search", "")
        had_token = TOKEN.search(orig_search)
        new_search = detokenize_search(orig_search) if had_token else orig_search
        touched = new_search != orig_search
        if had_token:
            for key in ("description", "explanation", "solution", "related_info"):
                if key not in fields:
                    continue
                new_val = detokenize_prose(fields[key])
                if new_val != fields[key]:
                    touched = True
                    fields[key] = new_val
        if new_search != orig_search:
            fields["search"] = new_search
            fields["date_updated"] = "2026-07-02"
            fields["updated_author"] = "akhamis"
            ver = fields.get("version", "1.0.0")
            parts = ver.split(".")
            if len(parts) == 3 and parts[2].isdigit():
                parts[2] = str(int(parts[2]) + 1)
                fields["version"] = ".".join(parts)
        if touched:
            changed.append(name)
        new_stanzas.append((name, fields))

    if args.dry_run:
        print(f"would detokenize {len(changed)} stanzas")
        for n in changed:
            print(f"  {n}")
        return 0

    if not changed:
        print("detokenize: no changes")
        return 0

    parts = [fmt.format_stanza(n, f)[0] for n, f in new_stanzas]
    args.source.write_text("\n\n".join(parts).rstrip() + "\n")
    print(f"detokenized={len(changed)}")
    for n in changed:
        print(f"  {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
