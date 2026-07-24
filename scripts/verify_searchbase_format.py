#!/usr/bin/env python3
"""Verify searchbase.conf SPL matches a git baseline (modulo whitespace/continuations)."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE = REPO_ROOT / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/"
    "searchbase.conf"
)
DEFAULT_BASELINE = "9c7a684^"
BARE_WHERE_RE = re.compile(r"\\\n[ \t]*where\b", re.IGNORECASE)

# Stanzas allowed to differ outside search (metadata/related_info alignment fixes).
ALIGNMENT_STANZAS = frozenset(
    {
        "user_experience_client_onboarding_failures",
        "it_health_sites_below_threshold_drilldown",
    }
)

def _import_parser():
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from format_searchbase_conf import parse_stanzas

    return parse_stanzas


def normalize_search(search: str) -> str:
    """Collapse continuations and whitespace for SPL equality checks.

    Splunk treats whitespace inside function call parens as insignificant
    (``case( arg1`` and ``case(arg1`` are equivalent), so we strip
    spaces immediately following ``(`` and immediately preceding ``)``
    when comparing SPL across formatting changes.
    """
    parts: list[str] = []
    for line in search.splitlines():
        stripped = line.rstrip()
        if stripped.endswith("\\"):
            stripped = stripped[:-1].rstrip()
        if stripped:
            parts.append(stripped)
    joined = " ".join(parts)
    joined = re.sub(r"\s+", " ", joined).strip()
    joined = re.sub(r"\(\s+", "(", joined)
    joined = re.sub(r"\s+\)", ")", joined)
    return joined


def git_show_conf(ref: str) -> str:
    path = (
        "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/"
        "searchbase.conf"
    )
    return subprocess.check_output(
        ["git", "show", f"{ref}:{path}"],
        text=True,
        cwd=REPO_ROOT,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=SOURCE,
        help="Formatted searchbase.conf to verify",
    )
    parser.add_argument(
        "--baseline-ref",
        default=DEFAULT_BASELINE,
        help=f"Git ref for SPL baseline (default: {DEFAULT_BASELINE})",
    )
    args = parser.parse_args()

    parse_stanzas = _import_parser()
    baseline_text = git_show_conf(args.baseline_ref)
    current_text = args.source.read_text(encoding="utf-8")

    baseline = {sid: fields for sid, fields in parse_stanzas(baseline_text)}
    current = {sid: fields for sid, fields in parse_stanzas(current_text)}

    passed = 0
    failed: list[str] = []
    missing_search: list[str] = []

    all_ids = sorted(set(baseline) | set(current))
    for sid in all_ids:
        if sid not in baseline or sid not in current:
            failed.append(f"{sid}: stanza only in one side")
            continue
        b_fields = baseline[sid]
        c_fields = current[sid]
        if "search" not in b_fields or "search" not in c_fields:
            missing_search.append(sid)
            continue
        b_norm = normalize_search(b_fields["search"])
        c_norm = normalize_search(c_fields["search"])
        if b_norm == c_norm:
            passed += 1
        else:
            failed.append(sid)

    bare_where_hits = list(BARE_WHERE_RE.finditer(current_text))
    stanza_count = len(current)

    print(f"Baseline ref: {args.baseline_ref}")
    print(f"Stanzas in source: {stanza_count}")
    print(f"Search SPL matches: {passed}")
    print(f"Search SPL mismatches: {len(failed)}")
    if missing_search:
        print(f"Stanzas missing search field: {len(missing_search)}")

    if failed:
        print("\nMismatched stanzas:")
        for sid in failed[:50]:
            if sid not in baseline or sid not in current:
                print(f"  {sid}")
                continue
            b = normalize_search(baseline[sid]["search"])
            c = normalize_search(current[sid]["search"])
            print(f"  {sid}")
            if len(b) < 200 and len(c) < 200:
                print(f"    baseline: {b}")
                print(f"    current:  {c}")
            else:
                # Short diff hint
                for i, (bc, cc) in enumerate(zip(b, c)):
                    if bc != cc:
                        print(f"    first diff at char {i}: ...{b[max(0,i-30):i+30]!r}...")
                        print(f"                         vs ...{c[max(0,i-30):i+30]!r}...")
                        break
        if len(failed) > 50:
            print(f"  ... and {len(failed) - 50} more")

    print(f"\nBare ' where' pipe-swallow pattern matches: {len(bare_where_hits)}")
    if bare_where_hits:
        for m in bare_where_hits[:10]:
            line_no = current_text[: m.start()].count("\n") + 1
            print(f"  line {line_no}: {m.group(0)!r}")

    ok = len(failed) == 0 and len(bare_where_hits) == 0
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
