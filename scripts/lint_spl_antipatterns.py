#!/usr/bin/env python3
"""Lint Splunk SPL in searchbase.conf (and similar files) for known anti-patterns.

Why this exists
---------------
Splunk's SPL quoting rules are context-dependent and easy to get wrong.
This linter encodes the gotchas the team has hit in production so they
never sneak back in.

Rules implemented
-----------------
R001  quoted-dotted-field-in-stats
    Single-quoted dotted field names are correct inside ``eval`` and
    ``where`` expressions (e.g. ``eval x = 'a.b.c'``), but inside a
    ``stats``/``chart``/``timechart``-class aggregation function they
    are treated as literal strings, not field references, so the
    aggregation silently returns no data.

    Bad   : ``| stats latest('a.b.c') as x by mac``
    Good  : ``| stats latest(a.b.c) as x by mac``
    Better: ``| eval x = 'a.b.c' | stats latest(x) by mac``

Adding a rule
-------------
Append an entry to ``_RULES`` with a scan function that takes the SPL
search string and yields (snippet, detail) tuples for each violation.

Run locally
-----------
    python3 scripts/lint_spl_antipatterns.py
    python3 scripts/lint_spl_antipatterns.py path/to/other.conf

Exit codes
----------
    0  clean
    1  one or more violations found
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Iterator

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = REPO_ROOT / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/"
    "searchbase.conf"
)

# Splunk aggregation functions that take a field-name argument inside
# stats/chart/timechart-class commands.
_AGG_FNS = (
    r"latest|earliest|values|first|last|count|dc|distinct_count|sum|avg|mean|"
    r"min|max|median|mode|stdev|stdevp|var|varp|range|list|estdc|sparkline|"
    r"rate|p\d+|perc\d+|exactperc\d+|upperperc\d+|"
    r"per_day|per_hour|per_minute|per_second"
)

# Commands whose argument list parses raw field names (not eval expressions).
_STATS_CMD_RE = re.compile(
    r"\|\s*(?:stats|tstats|chart|timechart|eventstats|streamstats|geostats|"
    r"mstats|sichart|sitimechart|sistats)\b",
    re.IGNORECASE,
)

# Pattern: agg_function('dotted.field.path')
_R001_RE = re.compile(
    rf"\b(?:{_AGG_FNS})\s*\(\s*'([^']+\.[^']+)'\s*\)",
    re.IGNORECASE,
)


@dataclass
class Violation:
    stanza: str
    rule_id: str
    snippet: str
    detail: str


def _import_parser():
    sys.path.insert(0, str(REPO_ROOT / "scripts"))
    from format_searchbase_conf import parse_stanzas  # type: ignore

    return parse_stanzas


def _iter_stats_stages(search: str) -> Iterator[str]:
    """Yield each substring that begins with a stats-class command and runs
    until the next pipe (or end of search). Allows R001-style rules to scan
    only inside the relevant stages without false positives from eval/where.
    """
    stage_starts = [m.start() for m in _STATS_CMD_RE.finditer(search)]
    if not stage_starts:
        return
    pipe_positions = [m.start() for m in re.finditer(r"\|", search)]
    pipe_positions.append(len(search))
    for start in stage_starts:
        # Skip the leading "|" that defined the stage so the next-pipe
        # lookup finds the *following* pipe, not this one.
        end = next((p for p in pipe_positions if p > start + 1), len(search))
        yield search[start:end]


def _rule_r001_quoted_dotted_in_stats(search: str) -> Iterator[tuple[str, str]]:
    for stage in _iter_stats_stages(search):
        for m in _R001_RE.finditer(stage):
            yield m.group(0), m.group(1)


_RULES: list[tuple[str, str, Callable[[str], Iterator[tuple[str, str]]]]] = [
    (
        "R001",
        "quoted-dotted-field-in-stats",
        _rule_r001_quoted_dotted_in_stats,
    ),
]


def lint_text(text: str) -> list[Violation]:
    parse_stanzas = _import_parser()
    out: list[Violation] = []
    for sid, fields in parse_stanzas(text):
        search = fields.get("search", "")
        if not search:
            continue
        for rule_id, rule_name, fn in _RULES:
            for snippet, detail in fn(search):
                out.append(
                    Violation(
                        stanza=sid,
                        rule_id=f"{rule_id} {rule_name}",
                        snippet=snippet,
                        detail=detail,
                    )
                )
    return out


def lint_file(path: Path) -> list[Violation]:
    text = path.read_text(encoding="utf-8")
    return lint_text(text)


def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help=f"One or more .conf files to lint (default: {_rel(DEFAULT_PATH)})",
    )
    args = parser.parse_args(list(argv) if argv is not None else None)
    paths: list[Path] = args.paths or [DEFAULT_PATH]

    total = 0
    for path in paths:
        if not path.exists():
            print(f"{_rel(path)}: not found, skipping", file=sys.stderr)
            continue
        violations = lint_file(path)
        if not violations:
            print(f"{_rel(path)}: OK")
            continue
        print(f"{_rel(path)}: {len(violations)} violation(s)")
        for v in violations:
            print(f"  [{v.stanza}] {v.rule_id}: {v.snippet}")
        total += len(violations)

    if total:
        print(
            "\nFix R001: drop the single quotes around the dotted field "
            "inside the stats/chart/timechart aggregation, e.g.\n"
            "  | stats latest('a.b.c') as x     ← wrong\n"
            "  | stats latest(a.b.c) as x       ← right\n"
            "Or eval the dotted field into a flat name first:\n"
            "  | eval x = 'a.b.c' | stats latest(x) as x",
            file=sys.stderr,
        )
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
