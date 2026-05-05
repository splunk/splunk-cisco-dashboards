#!/usr/bin/env python3
"""
inventory_spaces_searches.py
============================

Read-only inventory + classifier for every Cisco Spaces firehose
search across the four layers we care about:

    1. packages/.../default/searchbase.conf       (browseable catalogue)
    2. packages/.../default/savedsearches.conf    (scheduled/materialized subset)
    3. packages/.../default/data/ui/views/**/*.xml
    4. packages/.../webapp/pages/**/*.tsx

Why
---
Phase 1 of the search-quality sweep targets `cisco:spaces:firehose`
sourcetype because Spaces emits *cumulative totals* at every event,
which makes any `stats sum(...)` over time double-count. We need a
single audited list of every Spaces query in every layer before we
can propose rewrites.

Output
------
- prints a per-stanza classification table to stdout
- groups by class (A_double_stats / D_wrong_agg / G_stats_latest_kpi /
  Q1_per_location / C_clean_trend / E_table / F_composite)
- flags inline SPL copies that need to move with any conf-side fix

Usage
-----
    python3 scripts/inventory_spaces_searches.py
    python3 scripts/inventory_spaces_searches.py --json     # machine-readable
    python3 scripts/inventory_spaces_searches.py --markdown # for the diff plan

Read-only: never writes a file. Idempotent. Stdlib only.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parent.parent
PKG_ROOT = REPO_ROOT / "packages" / "splunk-cisco-dashboards" / "src" / "main"
SEARCHBASE = PKG_ROOT / "resources" / "splunk" / "default" / "searchbase.conf"
SAVEDSEARCHES = PKG_ROOT / "resources" / "splunk" / "default" / "savedsearches.conf"
VIEWS_DIR = PKG_ROOT / "resources" / "splunk" / "default" / "data" / "ui" / "views"
WEBAPP_DIR = PKG_ROOT / "webapp"

SPACES_TOKENS = ("cisco:spaces:firehose", "cisco_spaces_firehose")


# ---------------------------------------------------------------------------
# Conf parsing — minimal, line-continuation aware
# ---------------------------------------------------------------------------

@dataclass
class Stanza:
    name: str
    file: str
    line_start: int
    fields: dict[str, str] = field(default_factory=dict)

    @property
    def search(self) -> str:
        return self.fields.get("search", "")

    @property
    def description(self) -> str:
        return self.fields.get("description", "")


_STANZA_RE = re.compile(r"^\[([^\]]+)\]\s*$")
_KV_RE = re.compile(r"^([A-Za-z_][\w.]*)\s*=\s*(.*)$")


def parse_conf(path: Path) -> list[Stanza]:
    """Minimal Splunk conf parser — handles `\\` line continuations.

    Key invariant: a value continuation only spans lines whose previous
    line ends with a literal `\\`. Comment lines (`#…`) and blank lines
    end any non-continuing value and are otherwise ignored. This is the
    same convention `splunk btool` uses, and the only correct way to
    avoid commented-out stanzas leaking into the preceding stanza's
    fields when the writer used `# search = …` to disable a search.
    """
    if not path.exists():
        return []
    stanzas: list[Stanza] = []
    current: Stanza | None = None
    current_key: str | None = None
    pending: list[str] = []

    def in_continuation() -> bool:
        return bool(pending) and pending[-1].endswith("\\")

    def flush() -> None:
        nonlocal current_key, pending
        if current is not None and current_key is not None:
            current.fields[current_key] = "\n".join(pending).rstrip()
        current_key = None
        pending = []

    with path.open("r", encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            line = raw.rstrip("\n")
            stripped = line.lstrip()

            # Comment line — never part of a value, even if the line
            # before it ended in `\`. Ends any non-continuing pending.
            if stripped.startswith("#"):
                if current_key is not None and not in_continuation():
                    flush()
                continue

            # Blank line — same rule.
            if not stripped:
                if current_key is not None and not in_continuation():
                    flush()
                continue

            # Stanza header.
            m = _STANZA_RE.match(line)
            if m:
                flush()
                if current is not None:
                    stanzas.append(current)
                current = Stanza(name=m.group(1), file=str(path), line_start=lineno)
                continue

            if current is None:
                continue

            # Mid-continuation: previous line ended with `\`.
            if in_continuation():
                pending[-1] = pending[-1].rstrip("\\").rstrip()
                pending.append(stripped)
                continue

            # New `key = value` line.
            kv = _KV_RE.match(line)
            if kv:
                flush()
                current_key = kv.group(1)
                pending = [kv.group(2)]

        flush()
        if current is not None:
            stanzas.append(current)
    return stanzas


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

# These fields are cumulative-totals — Spaces emits them as a running
# total at every event. Aggregating them with sum/avg over time double-
# counts. Acceptable aggregators: max, latest.
CUMULATIVE_FIELDS = (
    "userPresence.activeUsersCount.totalUsers",
    "userPresence.activeUsersCount.activeUsers",
    "userPresence.activeUsersCount.inactiveUsers",
    "devicePresence.activeDevicesCount",
    "webexTelemetryUpdate.telemetries{}.peopleCount",
    "peopleCount",
    "occupancy.peopleCount",
    "occupancy.peakPeopleCount",
)


@dataclass
class Classification:
    klass: str
    rationale: str


_DOUBLE_STATS_RE = re.compile(
    r"\|\s*stats\s+\w+\([^)]+\)\s+as\s+\w+\s+by\s+[\w.]+\s*\|\s*stats\s+\w+\(",
    re.IGNORECASE,
)


def classify(spl: str) -> Classification:
    """Bucket a Spaces SPL into one of the rule classes."""
    s = spl
    s_lower = s.lower()
    has_timechart = bool(re.search(r"\|\s*timechart\b", s_lower))
    has_stats = bool(re.search(r"\|\s*stats\b", s_lower))
    has_double_stats = bool(_DOUBLE_STATS_RE.search(s))
    has_table_or_top = bool(re.search(r"\|\s*(table|top|fields)\b", s_lower))
    has_eval_score = bool(
        re.search(r"\|\s*eval\s+\w*(score|index|pct|percentage)\w*\s*=", s_lower)
    )

    # Detect aggregator on a known cumulative-totals field. Captures:
    #   timechart sum(<field>) ...
    #   stats avg(<field>) ...
    cum_field_pattern = "|".join(re.escape(f) for f in CUMULATIVE_FIELDS)
    bad_agg = re.search(
        rf"(sum|avg|count)\(\s*({cum_field_pattern})\s*\)",
        s,
        re.IGNORECASE,
    )

    # A — double-stats with `by location` then aggregate-over-rows on a
    # cumulative-totals field. Your flagged smell.
    if has_double_stats and re.search(rf"({cum_field_pattern})", s):
        return Classification(
            "A_double_stats",
            "stats latest(cumulative_field) by location | stats agg(...) — "
            "spatial+temporal collapse on a cumulative field",
        )

    # D — already uses timechart but with sum/avg on a cumulative-totals field.
    if has_timechart and bad_agg:
        return Classification(
            "D_wrong_agg",
            f"timechart {bad_agg.group(1)}({bad_agg.group(2)}) — "
            f"cumulative-totals field needs max/latest, not {bad_agg.group(1)}",
        )

    # G — single-value KPI using `stats latest(score)` or similar
    if has_stats and not has_timechart and re.search(
        r"\|\s*stats\s+latest\([^)]+\)\s+as\s+\w*(score|value|count|pct)",
        s,
        re.IGNORECASE,
    ):
        return Classification(
            "G_stats_latest_kpi",
            "single-value KPI via stats latest — could be timechart max for "
            "a real spark plus the same headline (last bucket)",
        )

    # F — composite eval-driven score (e.g. domain scores, e-score pipelines)
    if has_eval_score and has_stats:
        return Classification(
            "F_composite_score",
            "eval-driven composite score; nuanced, defer to manual review",
        )

    # Q1 — per-location aggregation (latest by location.name then a row-agg
    # across locations). Not the same as A because the cumulative field rule
    # might not apply (some fields are intrinsically per-location snapshots).
    if re.search(
        r"\|\s*stats\s+latest\(([\w.{}]+)\)\s+as\s+\w+\s+by\s+\w*location",
        s,
        re.IGNORECASE,
    ):
        return Classification(
            "Q1_per_location",
            "stats latest(x) by location.name then aggregate across — "
            "needs case-by-case decision (see Q1)",
        )

    # E — table / detail / top / fields — display, not metric
    if has_table_or_top and not has_timechart:
        return Classification(
            "E_table_or_detail",
            "table/top/fields output for a detail panel — not a metric, "
            "leave alone unless renames touch it",
        )

    # C — already-clean trend
    if has_timechart and not bad_agg:
        return Classification(
            "C_clean_trend",
            "timechart with non-cumulative aggregator — already conforms",
        )

    # Fallback
    return Classification("Z_unclassified", "did not match any heuristic")


# ---------------------------------------------------------------------------
# Inline SPL sweep
# ---------------------------------------------------------------------------

def find_inline_copies(roots: Iterable[Path]) -> list[tuple[Path, int, str]]:
    """Find files outside the confs that contain Spaces firehose tokens."""
    hits: list[tuple[Path, int, str]] = []
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if path.suffix not in {".xml", ".tsx", ".ts", ".jsx", ".js"}:
                continue
            try:
                with path.open("r", encoding="utf-8") as fh:
                    for lineno, raw in enumerate(fh, 1):
                        if any(tok in raw for tok in SPACES_TOKENS):
                            hits.append((path, lineno, raw.rstrip()))
            except (OSError, UnicodeDecodeError):
                continue
    return hits


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def select_spaces_stanzas(stanzas: list[Stanza]) -> list[Stanza]:
    return [
        s
        for s in stanzas
        if any(tok in s.search for tok in SPACES_TOKENS)
    ]


def report_text(
    sb: list[Stanza],
    ss: list[Stanza],
    inline: list[tuple[Path, int, str]],
) -> str:
    lines: list[str] = []
    lines.append("=" * 80)
    lines.append("Cisco Spaces firehose — search quality inventory")
    lines.append("=" * 80)
    lines.append("")

    # Group searchbase by class
    classes: dict[str, list[tuple[Stanza, Classification]]] = {}
    for s in sb:
        c = classify(s.search)
        classes.setdefault(c.klass, []).append((s, c))

    klass_order = [
        "A_double_stats",
        "D_wrong_agg",
        "G_stats_latest_kpi",
        "Q1_per_location",
        "F_composite_score",
        "C_clean_trend",
        "E_table_or_detail",
        "Z_unclassified",
    ]

    lines.append(f"searchbase.conf:    {len(sb)} Spaces stanzas")
    lines.append(f"savedsearches.conf: {len(ss)} Spaces stanzas")
    lines.append(f"inline SPL hits:    {len(inline)} (across XML + .tsx/.ts/.jsx/.js)")
    lines.append("")

    lines.append("Class breakdown (searchbase.conf):")
    for k in klass_order:
        n = len(classes.get(k, []))
        if n:
            lines.append(f"  {k:<24} {n:>3}")
    lines.append("")

    for k in klass_order:
        entries = classes.get(k, [])
        if not entries:
            continue
        lines.append("-" * 80)
        lines.append(f"CLASS {k}  ({len(entries)} stanzas)")
        lines.append("-" * 80)
        for s, c in entries:
            lines.append("")
            lines.append(f"[{s.name}]   ({Path(s.file).name}:{s.line_start})")
            lines.append(f"  rationale: {c.rationale}")
            spl_oneline = re.sub(r"\s+", " ", s.search.strip())
            if len(spl_oneline) > 220:
                spl_oneline = spl_oneline[:217] + "..."
            lines.append(f"  spl: {spl_oneline}")
        lines.append("")

    # Cross-reference savedsearches.conf — match by stripped name
    lines.append("=" * 80)
    lines.append("Cross-reference: searchbase ↔ savedsearches")
    lines.append("=" * 80)
    sb_names = {s.name for s in sb}
    ss_names = {s.name for s in ss}
    only_sb = sorted(sb_names - ss_names)
    only_ss = sorted(ss_names - sb_names)
    in_both = sorted(sb_names & ss_names)
    lines.append(f"  in both confs (exact stanza name match): {len(in_both)}")
    lines.append(f"  only in searchbase.conf:                 {len(only_sb)}")
    lines.append(f"  only in savedsearches.conf:              {len(only_ss)}")
    lines.append("")
    if in_both:
        lines.append("  Stanzas present in both files (any rewrite must touch both):")
        for n in in_both:
            lines.append(f"    {n}")
        lines.append("")

    # Inline copies
    if inline:
        lines.append("=" * 80)
        lines.append("Inline SPL copies (XML / React)")
        lines.append("=" * 80)
        for path, lineno, content in inline:
            rel = path.relative_to(REPO_ROOT)
            lines.append(f"  {rel}:{lineno}: {content.strip()[:200]}")
        lines.append("")

    return "\n".join(lines)


def report_json(
    sb: list[Stanza],
    ss: list[Stanza],
    inline: list[tuple[Path, int, str]],
) -> str:
    payload = {
        "searchbase": [
            {
                "name": s.name,
                "file": str(Path(s.file).relative_to(REPO_ROOT)),
                "line": s.line_start,
                "search": s.search,
                "classification": asdict(classify(s.search)),
            }
            for s in sb
        ],
        "savedsearches": [
            {
                "name": s.name,
                "file": str(Path(s.file).relative_to(REPO_ROOT)),
                "line": s.line_start,
                "search": s.search,
            }
            for s in ss
        ],
        "inline_copies": [
            {"file": str(p.relative_to(REPO_ROOT)), "line": ln, "snippet": txt[:300]}
            for p, ln, txt in inline
        ],
    }
    return json.dumps(payload, indent=2)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = ap.parse_args(argv)

    sb_all = parse_conf(SEARCHBASE)
    ss_all = parse_conf(SAVEDSEARCHES)
    sb_spaces = select_spaces_stanzas(sb_all)
    ss_spaces = select_spaces_stanzas(ss_all)
    inline = find_inline_copies([VIEWS_DIR, WEBAPP_DIR])

    if args.json:
        sys.stdout.write(report_json(sb_spaces, ss_spaces, inline))
    else:
        sys.stdout.write(report_text(sb_spaces, ss_spaces, inline))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
