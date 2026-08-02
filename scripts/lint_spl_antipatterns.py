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

R002  dedup-command
    ``dedup`` hides the entity selection rule and can silently retain an
    arbitrary event. Reduce to an explicit grain with ``stats`` or ``tstats``.

R003  unjustified-fillnull
    ``fillnull`` is allowed only for named fields that must survive as explicit
    categories in a later stats/chart/timechart ``BY`` or split clause.

R004  wildcard-aggregation
    Wildcard reducers hide the output contract and can combine values from
    different events. Name every aggregated field explicitly.

R005  duplicate-stanza-key
    Duplicate keys have last-value-wins behavior and hide dead or incorrect
    metadata. Detection must respect multiline continuation lines.

R006  literal-edit-instruction
    Metadata must contain the intended value, never an unapplied edit note.

R007  pre-aggregation-limit
    ``head`` or ``tail`` before a later aggregation truncates the measured
    population and produces incomplete metrics.

R008  pre-stats-projection-or-sort
    ``table``, ``fields``, and ``sort`` before a later ``stats`` are redundant;
    let ``stats`` perform the field reduction and aggregation.

R009  terminal-post-stats-projection-or-sort
    Remove a trailing suffix made only of ``fields`` and ``sort`` after the
    final ``stats`` command.

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

_DEDUP_RE = re.compile(r"\|\s*dedup\b", re.IGNORECASE)
_FILLNULL_RE = re.compile(
    r"\|\s*fillnull\b(?P<args>[^|\]\n]*)",
    re.IGNORECASE,
)
_VALUE_ARG_RE = re.compile(r"\bvalue\s*=\s*(?:\"[^\"]*\"|'[^']*'|\S+)", re.IGNORECASE)
_FIELD_TOKEN_RE = re.compile(r'"[^"]+"|\b[A-Za-z_][\w.{}-]*\b')
_GROUPING_STAGE_RE = re.compile(
    r"\|\s*(?:stats|chart|timechart|eventstats|streamstats|geostats|sichart|sitimechart|sistats)\b[^|\]]*\bby\b(?P<fields>[^|\]]+)",
    re.IGNORECASE,
)
_WILDCARD_AGG_RE = re.compile(
    r"\b(?:latest|earliest|first|last|values|list)\s*\(\s*\*\s*\)",
    re.IGNORECASE,
)
_EDIT_INSTRUCTION_RE = re.compile(
    r"(?:^\s*(?:TODO|FIXME)\b|^\s*Remove\s+(?:both|this)\b|"
    r"^\s*Replace\s+with\s+something\b|\(\s*remove\b[^)]*\bno\s+target\s+exists\b)",
    re.IGNORECASE,
)
_CONF_KEY_RE = re.compile(r"^([A-Za-z_][\w.-]*)\s*=")
_STANZA_RE = re.compile(r"^\[([^\]]+)\]\s*$")
_AGGREGATION_COMMANDS = {
    "chart",
    "eventstats",
    "geostats",
    "mstats",
    "sichart",
    "sistats",
    "sitimechart",
    "stats",
    "streamstats",
    "timechart",
    "tstats",
}


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


def _rule_r002_dedup(search: str) -> Iterator[tuple[str, str]]:
    for match in _DEDUP_RE.finditer(search):
        yield match.group(0), "replace with an explicit stats/tstats entity grain"


def _normalized_field_tokens(text: str) -> set[str]:
    return {token.strip('"').lower() for token in _FIELD_TOKEN_RE.findall(text)}


def _rule_r003_unjustified_fillnull(search: str) -> Iterator[tuple[str, str]]:
    for match in _FILLNULL_RE.finditer(search):
        args = _VALUE_ARG_RE.sub("", match.group("args"))
        fields = _normalized_field_tokens(args)
        fields -= {"fillnull", "value"}
        if not fields:
            yield match.group(0), "fillnull must name fields required by a later grouping"
            continue

        downstream = search[match.end() :]
        grouped_fields: set[str] = set()
        for grouping in _GROUPING_STAGE_RE.finditer(downstream):
            grouped_fields.update(_normalized_field_tokens(grouping.group("fields")))
        if not fields & grouped_fields:
            yield match.group(0), "named fields are not used by a later BY/split grouping"


def _rule_r004_wildcard_aggregation(search: str) -> Iterator[tuple[str, str]]:
    for match in _WILDCARD_AGG_RE.finditer(search):
        yield match.group(0), "name each aggregated field and its entity grain explicitly"


def _split_spl_commands(search: str) -> list[str]:
    commands: list[str] = []
    current: list[str] = []
    quote: str | None = None
    escaped = False
    bracket_depth = 0
    paren_depth = 0
    for char in search:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\":
            current.append(char)
            escaped = True
        elif quote:
            current.append(char)
            if char == quote:
                quote = None
        elif char in {"'", '"'}:
            current.append(char)
            quote = char
        elif char == "[":
            current.append(char)
            bracket_depth += 1
        elif char == "]":
            current.append(char)
            bracket_depth = max(0, bracket_depth - 1)
        elif char == "(":
            current.append(char)
            paren_depth += 1
        elif char == ")":
            current.append(char)
            paren_depth = max(0, paren_depth - 1)
        elif char == "|" and bracket_depth == 0 and paren_depth == 0:
            command = "".join(current).strip()
            if command:
                commands.append(command)
            current = []
        else:
            current.append(char)
    command = "".join(current).strip()
    if command:
        commands.append(command)
    return commands


def _rule_r007_pre_aggregation_limit(search: str) -> Iterator[tuple[str, str]]:
    commands = _split_spl_commands(search)
    names = [command.split(maxsplit=1)[0].lower() for command in commands]
    first_aggregation = next(
        (index for index, name in enumerate(names) if name in _AGGREGATION_COMMANDS),
        None,
    )
    if first_aggregation is None:
        return
    for index, name in enumerate(names[:first_aggregation]):
        if name in {"head", "tail"}:
            yield commands[index], "remove the limit or move deterministic ranking after aggregation"


def _rule_r008_pre_stats_projection_or_sort(search: str) -> Iterator[tuple[str, str]]:
    commands = _split_spl_commands(search)
    names = [command.split(maxsplit=1)[0].lower() for command in commands]
    stats_indexes = [index for index, name in enumerate(names) if name == "stats"]
    for index, name in enumerate(names):
        if name in {"table", "fields", "sort"} and any(
            stats_index > index for stats_index in stats_indexes
        ):
            yield commands[index], "remove this stage and let the later stats command reduce fields"


def _rule_r009_terminal_post_stats_projection_or_sort(
    search: str,
) -> Iterator[tuple[str, str]]:
    commands = _split_spl_commands(search)
    names = [command.split(maxsplit=1)[0].lower() for command in commands]
    stats_indexes = [index for index, name in enumerate(names) if name == "stats"]
    if not stats_indexes:
        return
    suffix_start = stats_indexes[-1] + 1
    suffix = names[suffix_start:]
    if suffix and all(name in {"fields", "sort"} for name in suffix):
        for command in commands[suffix_start:]:
            yield command, "remove the terminal fields/sort suffix after final stats"


_RULES: list[tuple[str, str, Callable[[str], Iterator[tuple[str, str]]]]] = [
    (
        "R001",
        "quoted-dotted-field-in-stats",
        _rule_r001_quoted_dotted_in_stats,
    ),
    (
        "R002",
        "dedup-command",
        _rule_r002_dedup,
    ),
    (
        "R003",
        "unjustified-fillnull",
        _rule_r003_unjustified_fillnull,
    ),
    (
        "R004",
        "wildcard-aggregation",
        _rule_r004_wildcard_aggregation,
    ),
    (
        "R007",
        "pre-aggregation-limit",
        _rule_r007_pre_aggregation_limit,
    ),
    (
        "R008",
        "pre-stats-projection-or-sort",
        _rule_r008_pre_stats_projection_or_sort,
    ),
    (
        "R009",
        "terminal-post-stats-projection-or-sort",
        _rule_r009_terminal_post_stats_projection_or_sort,
    ),
]


def lint_search(search: str, stanza: str = "<search>") -> list[Violation]:
    out: list[Violation] = []
    for rule_id, rule_name, fn in _RULES:
        for snippet, detail in fn(search):
            out.append(
                Violation(
                    stanza=stanza,
                    rule_id=f"{rule_id} {rule_name}",
                    snippet=snippet,
                    detail=detail,
                )
            )
    return out


def lint_text(text: str) -> list[Violation]:
    parse_stanzas = _import_parser()
    out: list[Violation] = []
    for sid, fields in parse_stanzas(text):
        search = fields.get("search", "")
        if not search:
            continue
        out.extend(lint_search(search, sid))
        for key, value in fields.items():
            if key != "search" and _EDIT_INSTRUCTION_RE.search(value):
                out.append(
                    Violation(
                        stanza=sid,
                        rule_id="R006 literal-edit-instruction",
                        snippet=f"{key} = {value[:120]}",
                        detail="replace the instruction with the intended metadata value",
                    )
                )

    stanza = "<preamble>"
    seen: set[str] = set()
    continued = False
    for line in text.splitlines():
        if continued:
            continued = line.rstrip().endswith("\\")
            continue
        header = _STANZA_RE.match(line.strip())
        if header:
            stanza = header.group(1)
            seen = set()
            continue
        key_match = _CONF_KEY_RE.match(line)
        if key_match:
            key = key_match.group(1)
            if key in seen:
                out.append(
                    Violation(
                        stanza=stanza,
                        rule_id="R005 duplicate-stanza-key",
                        snippet=line[:120],
                        detail=f"verify and retain exactly one effective {key} value",
                    )
                )
            seen.add(key)
        continued = line.rstrip().endswith("\\")
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
            "\nFix the reported SPL anti-patterns before catalog release. "
            "Use explicit stats/tstats entity grains instead of dedup, and "
            "retain fillnull only for named downstream grouping fields.",
            file=sys.stderr,
        )
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
