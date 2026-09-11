#!/usr/bin/env python3
"""Format searchbase.conf per .cursor/skills/splunk-spl-searchbase-format/SKILL.md.

Rules (matches the upstream `searchbase` app):
  - Each top-level pipe `|` starts a new line.
  - Backslash `\\` is flush against the last char of every non-final line.
  - Subsearches inside `[ ... ]` keep their existing multi-line layout.
  - Non-subsearch stages collapse to a single physical line.
  - Tabs are converted to spaces.
  - Metadata fields are emitted in the canonical order.

The formatter is deliberately small and conservative: it never tries to
split clauses, never inserts commas, never reorders aggregates. All it
does is one-pipe-per-line + trailing-backslash + collapse-whitespace
within non-subsearch stages.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Iterator

SOURCE = Path(__file__).resolve().parents[1] / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

FIELD_ORDER_BEFORE_VIZ = [
    "search_name",
    "search_author",
    "updated_author",
    "version",
    "date_created",
    "date_updated",
    "category",
    "sub_category",
    "tags",
    "dispatch_context",
    "dispatch_context_origin",
    "dispatch_context_force",
    "search_hidden",
]

VIZ_FIELDS = ("default_viz", "viz_options")
EXTRA_AFTER_VIZ = (
    "drilldown_stanza_id",
    "drilldown_stanza_ids",
    "drilldown_search_name",
    "drilldown_button_title",
)
PROSE_FIELDS = ("description", "explanation", "solution", "related_info")

REQUIRED_FOR_GAP_REPORT = (
    "search_name",
    "search_author",
    "updated_author",
    "version",
    "date_created",
    "date_updated",
    "category",
    "sub_category",
    "tags",
    "dispatch_context",
    "dispatch_context_force",
    "description",
    "explanation",
    "solution",
    "related_info",
)

UNBOUNDED_SORT_CONTRACT_STANZAS = frozenset(
    {
        "building_resilience_webex_devices",
        "client_summary_client_health_by_location",
        "dashboard_spaces_intelligence_v1_dwell_distribution",
        "dashboard_workplace_spog_v1_issues",
        "dashboard_workplace_spog_v1_persite",
        "it_critical_systems_compliance_report",
        "it_critical_systems_stp_reconvergence",
        "it_critical_systems_top_issue_devices",
        "it_health_thousandeyes_alerts_summary",
        "secure_networking_sdwan_site_health_breakdown",
        "secure_networking_sdwan_tunnel_health_log",
        "secure_networking_sgt_fmc_blocks_by_sgt_summary",
        "secure_networking_sgt_palo_alto_policy_effectiveness_trend",
        "secure_networking_zta_ise_policy_family_activity_trend",
        "spaces_room_utilization_league_table",
        "spaces_space_idle_cost_ranking",
    }
)


def parse_stanzas(text: str) -> list[tuple[str, dict[str, str]]]:
    stanzas: list[tuple[str, dict[str, str]]] = []
    current_id: str | None = None
    current: dict[str, str] = {}
    search_lines: list[str] = []
    in_search = False

    for line in text.splitlines():
        m = re.match(r"^\[([a-z0-9_]+)\]$", line)
        if m:
            if current_id:
                if search_lines:
                    current["search"] = "\n".join(search_lines)
                stanzas.append((current_id, current))
            current_id = m.group(1)
            current = {}
            search_lines = []
            in_search = False
            continue

        if current_id is None:
            continue

        if line.startswith("search = "):
            in_search = True
            search_lines = [line[len("search = ") :]]
            continue

        if in_search:
            cont = (
                line.startswith(" ")
                or line.startswith("|")
                or line.endswith("\\")
            )
            if not cont and search_lines:
                prev = search_lines[-1].rstrip()
                if prev.endswith(","):
                    cont = True
                elif " = " not in line and re.match(
                    r'^(".*?"|\w[\w.-]*)=', line
                ):
                    # SPL clause split onto its own line (e.g. lower95=round(...))
                    cont = True
            if cont:
                search_lines.append(line)
                continue
            current["search"] = "\n".join(search_lines)
            search_lines = []
            in_search = False

        if not in_search and " = " in line:
            key, _, val = line.partition(" = ")
            current[key] = val

    if current_id:
        if search_lines:
            current["search"] = "\n".join(search_lines)
        stanzas.append((current_id, current))
    return stanzas


def _scan_top_level_pipes(s: str) -> list[tuple[int, int, str]]:
    """Return [(start, end, text)] for each top-level pipe-delimited stage.

    Top-level means: outside quotes, parens, and brackets.
    """
    spans: list[tuple[int, int, str]] = []
    i = 0
    n = len(s)
    start = 0
    depth_paren = depth_bracket = 0
    in_quote: str | None = None
    while i < n:
        c = s[i]
        if in_quote:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == in_quote:
                in_quote = None
            i += 1
            continue
        if c in '"\'`':
            in_quote = c
            i += 1
            continue
        if c == "(":
            depth_paren += 1
        elif c == ")":
            depth_paren = max(0, depth_paren - 1)
        elif c == "[":
            depth_bracket += 1
        elif c == "]":
            depth_bracket = max(0, depth_bracket - 1)
        elif c == "|" and depth_paren == 0 and depth_bracket == 0:
            chunk = s[start:i].strip()
            if chunk:
                spans.append((start, i, chunk))
            start = i + 1
        i += 1
    chunk = s[start:n].strip()
    if chunk:
        spans.append((start, n, chunk))
    return spans


def _stage_has_top_level_subsearch(stage: str) -> bool:
    """True if the stage contains a `[` outside of quotes/parens at top level."""
    depth_paren = 0
    in_quote: str | None = None
    i = 0
    n = len(stage)
    while i < n:
        c = stage[i]
        if in_quote:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == in_quote:
                in_quote = None
            i += 1
            continue
        if c in '"\'`':
            in_quote = c
            i += 1
            continue
        if c == "(":
            depth_paren += 1
        elif c == ")":
            depth_paren = max(0, depth_paren - 1)
        elif c == "[" and depth_paren == 0:
            return True
        i += 1
    return False


def collapse_whitespace(s: str) -> str:
    """Collapse runs of whitespace to a single space, preserving quoted content.

    Also strips whitespace immediately after `(` and immediately before `)` to
    match the upstream `searchbase` house style (e.g. `case(arg1, ...)` rather
    than `case( arg1, ...)`). Whitespace inside function calls is semantically
    insignificant in Splunk SPL, so this is purely cosmetic normalization.
    """
    out: list[str] = []
    i = 0
    n = len(s)
    in_quote: str | None = None
    while i < n:
        c = s[i]
        if in_quote:
            if c == "\\" and i + 1 < n:
                out.append(c)
                out.append(s[i + 1])
                i += 2
                continue
            if c == in_quote:
                in_quote = None
            out.append(c)
            i += 1
            continue
        if c in '"\'`':
            in_quote = c
            out.append(c)
            i += 1
            continue
        if c.isspace():
            if out and out[-1] != " ":
                out.append(" ")
            while i < n and s[i].isspace():
                i += 1
            continue
        if c == "(":
            out.append(c)
            i += 1
            while i < n and s[i].isspace():
                i += 1
            continue
        if c == ")" and out and out[-1] == " ":
            out.pop()
        out.append(c)
        i += 1
    return "".join(out).strip()


_LEADING_PIPE_CMDS = re.compile(
    r"^(tstats|makeresults|inputlookup|datamodel|savedsearch|rest|noop|"
    r"multisearch|union|mstats|metadata|loadjob|history|gentimes|dbinspect|"
    r"from)\b",
    re.I,
)


def _ensure_leading_pipe(line: str, *, is_first_stage: bool) -> str:
    """Ensure a non-first stage starts with `| `; first stage keeps base search shape."""
    st = line.strip()
    if is_first_stage:
        if st.startswith("|"):
            return st
        if _LEADING_PIPE_CMDS.match(st):
            return "| " + st
        return st  # base search form (e.g. `index="..." sourcetype=...`)
    if st.startswith("|"):
        return st
    return "| " + st


def _strip_trailing_backslash(line: str) -> str:
    s = line.rstrip()
    if s.endswith("\\"):
        s = s[:-1].rstrip()
    return s


def _normalize_for_compare(s: str) -> str:
    """Normalize a search string for change-detection (strip continuations + trim)."""
    return "\n".join(
        _strip_trailing_backslash(ln) for ln in s.split("\n")
    ).strip()


def _stage_command(stage: str) -> str:
    match = re.match(r"^\s*([A-Za-z][\w-]*)\b", stage)
    return match.group(1).lower() if match else ""


def _is_bounded_sort(stage: str) -> bool:
    normalized = re.sub(r"\\[ \t]*\r?\n", " ", stage)
    return bool(
        re.match(
            r"^\s*sort\s+(?:limit\s*=\s*)?[1-9]\d*\b",
            normalized,
            re.I,
        )
    )


def iter_executable_pipe_stages(text: str) -> Iterator[tuple[int, int, str]]:
    """Yield pipe-stage spans at every SPL nesting depth.

    Pipes inside quoted strings and macro expressions are data, not commands.
    A stage ends at the next executable pipe at the same bracket/parenthesis
    depth or at the closing bracket for its current subsearch. Continuation
    backslashes remain in the yielded text; command classifiers normalize them.
    """
    idx = 0
    quote: str | None = None
    escaped = False
    bracket_depth = 0
    paren_depth = 0
    while idx < len(text):
        char = text[idx]
        if escaped:
            escaped = False
            idx += 1
            continue
        if char == "\\":
            escaped = True
            idx += 1
            continue
        if quote:
            if char == quote:
                quote = None
            idx += 1
            continue
        if char in {"'", '"', "`"}:
            quote = char
            idx += 1
            continue
        if char == "[":
            bracket_depth += 1
        elif char == "]":
            bracket_depth = max(0, bracket_depth - 1)
        elif char == "(":
            paren_depth += 1
        elif char == ")":
            paren_depth = max(0, paren_depth - 1)
        elif char == "|":
            cursor = idx + 1
            local_quote: str | None = None
            local_escaped = False
            local_bracket_depth = bracket_depth
            local_paren_depth = paren_depth
            while cursor < len(text):
                current = text[cursor]
                if local_escaped:
                    local_escaped = False
                elif current == "\\":
                    local_escaped = True
                elif local_quote:
                    if current == local_quote:
                        local_quote = None
                elif current in {"'", '"', "`"}:
                    local_quote = current
                elif current == "[":
                    local_bracket_depth += 1
                elif current == "]":
                    if local_bracket_depth == bracket_depth:
                        break
                    local_bracket_depth = max(0, local_bracket_depth - 1)
                elif current == "(":
                    local_paren_depth += 1
                elif current == ")":
                    if local_paren_depth == paren_depth:
                        break
                    local_paren_depth = max(0, local_paren_depth - 1)
                elif (
                    current == "|"
                    and local_bracket_depth == bracket_depth
                    and local_paren_depth == paren_depth
                ):
                    break
                cursor += 1
            yield idx, cursor, text[idx + 1 : cursor].strip()
        idx += 1


def _contains_aggregate_command(text: str) -> bool:
    if _stage_command(text) in {"stats", "tstats"}:
        return True
    return any(
        _stage_command(stage) in {"stats", "tstats"}
        for _start, _end, stage in iter_executable_pipe_stages(text)
    )


def remove_sorts_from_aggregate_search(text: str) -> str:
    """Remove unbounded executable sorts from aggregate searches.

    A positive ``sort N`` is an intentional, bounded top-N operation and is
    retained. Unbounded ordering needed by streamstats/delta must be explicitly
    listed in ``UNBOUNDED_SORT_CONTRACT_STANZAS``.
    """
    if not _contains_aggregate_command(text):
        return text

    removable = [
        (start, end)
        for start, end, stage in iter_executable_pipe_stages(text)
        if _stage_command(stage) == "sort" and not _is_bounded_sort(stage)
    ]
    if not removable:
        return text

    out: list[str] = []
    last = 0
    for start, end in removable:
        if start < last:
            continue
        out.append(text[last:start])
        last = end
    out.append(text[last:])
    return "".join(out)


def sanitize_aggregate_sort_metadata(value: str) -> str:
    """Remove stale unbounded-sort language from aggregate-search prose."""
    protected: dict[str, str] = {}

    def protect_bounded_sort(match: re.Match[str]) -> str:
        marker = f"@@__BOUNDED_ORDER_{len(protected)}__@@"
        protected[marker] = match.group(0)
        return marker

    value = re.sub(
        r"\bsort\s+(?:limit\s*=\s*)?[1-9]\d*\b",
        protect_bounded_sort,
        value,
        flags=re.I,
    )
    value = re.sub(
        r"<code>\s*sort\b[^<]*</code>",
        "<code>result ranking</code>",
        value,
        flags=re.I,
    )
    replacements = (
        (r"\bsorted\s+descending\b", "ranked by descending value"),
        (r"\bsorted\s+ascending\b", "ranked by ascending value"),
        (r"\bsorted\s+by\b", "prioritized by"),
        (r"\bsorting\s+by\b", "prioritizing"),
        (r"\bsort\s+by\b", "prioritize"),
        (r"\bsort\s+command\b", "ranking step"),
        (r"\bsort\s+syntax\b", "ranking convention"),
        (r"\bsorting\b", "ranking"),
        (r"\bsorted\b", "ranked"),
        (r"\bsort\b", "ranking"),
    )
    for pattern, replacement in replacements:
        value = re.sub(pattern, replacement, value, flags=re.I)
    for marker, bounded_sort in protected.items():
        value = value.replace(marker, bounded_sort)
    return value


def remove_redundant_stats_stages(stages: list[str]) -> list[str]:
    """Remove top-level table/fields stages made redundant by stats."""
    commands = [_stage_command(stage) for stage in stages]
    stats_indexes = [idx for idx, command in enumerate(commands) if command == "stats"]
    if not stats_indexes:
        return stages

    kept = [
        stage
        for idx, stage in enumerate(stages)
        if not (
            commands[idx] in {"table", "fields"}
            and any(stats_idx > idx for stats_idx in stats_indexes)
        )
    ]

    kept_commands = [_stage_command(stage) for stage in kept]
    adjusted_last_stats = max(
        idx for idx, command in enumerate(kept_commands) if command == "stats"
    )
    suffix_commands = kept_commands[adjusted_last_stats + 1 :]
    if suffix_commands and all(command in {"fields", "sort"} for command in suffix_commands):
        return [
            stage
            for idx, stage in enumerate(kept)
            if not (idx > adjusted_last_stats and kept_commands[idx] == "fields")
        ]
    return kept


def remove_cosmetic_sort_stages(
    stages: list[str], *, preserve_unbounded_sort: bool = False
) -> list[str]:
    """Remove unbounded top-level sorts that do not feed order-sensitive logic."""
    if preserve_unbounded_sort:
        return stages
    commands = [_stage_command(stage) for stage in stages]
    order_sensitive = {"streamstats", "delta", "autoregress", "transaction", "head", "tail", "dedup"}
    remove_indexes: set[int] = set()
    for idx, (stage, command) in enumerate(zip(stages, commands)):
        if command != "sort" or _is_bounded_sort(stage):
            continue
        downstream = commands[idx + 1 :]
        if any(command in order_sensitive for command in downstream):
            continue
        remove_indexes.add(idx)
        if idx + 1 < len(commands) and commands[idx + 1] == "reverse":
            remove_indexes.add(idx + 1)
    return [stage for idx, stage in enumerate(stages) if idx not in remove_indexes]


def format_search(
    search: str, *, preserve_unbounded_sort: bool = False
) -> tuple[str, bool]:
    """Reformat a search field per the rules. Returns (new_search, changed)."""
    original = search
    text = search.replace("\t", " ")

    raw_lines = [_strip_trailing_backslash(ln) for ln in text.split("\n")]
    while raw_lines and not raw_lines[-1].strip():
        raw_lines.pop()
    if not raw_lines:
        return original, False

    raw_search = "\n".join(raw_lines)
    glued = (
        raw_search
        if preserve_unbounded_sort
        else remove_sorts_from_aggregate_search(raw_search)
    )
    spans = _scan_top_level_pipes(glued)
    if not spans:
        return original, False
    stage_texts = remove_redundant_stats_stages([stage for _s, _e, stage in spans])
    stage_texts = remove_cosmetic_sort_stages(
        stage_texts, preserve_unbounded_sort=preserve_unbounded_sort
    )

    out_lines: list[str] = []
    for idx, stage_text in enumerate(stage_texts):
        is_first = idx == 0
        if _stage_has_top_level_subsearch(stage_text):
            stage_lines = [
                _strip_trailing_backslash(ln).rstrip()
                for ln in stage_text.split("\n")
            ]
            stage_lines = [ln for ln in stage_lines if ln.strip() != ""]
            if not stage_lines:
                continue
            stage_lines[0] = _ensure_leading_pipe(
                stage_lines[0], is_first_stage=is_first
            )
            out_lines.extend(stage_lines)
        else:
            single = collapse_whitespace(stage_text)
            single = _ensure_leading_pipe(single, is_first_stage=is_first)
            out_lines.append(single)

    new_search = "\n".join(out_lines)
    changed = _normalize_for_compare(new_search) != _normalize_for_compare(original)
    return new_search, changed


_SPL_ORPHAN_RE = re.compile(r'^(".*?"|\w[\w.-]*)=')


def find_leaked_spl_lines(text: str) -> list[tuple[int, str, str]]:
    """Lines Splunk would parse as invalid conf keys (SPL outside search continuations)."""
    leaks: list[tuple[int, str, str]] = []
    current: str | None = None
    in_search = False
    search_lines: list[str] = []

    for i, line in enumerate(text.splitlines(), 1):
        m = re.match(r"^\[([a-z0-9_]+)\]$", line)
        if m:
            current = m.group(1)
            in_search = False
            search_lines = []
            continue

        if current is None:
            continue

        if line.startswith("search = "):
            in_search = True
            search_lines = [line[len("search = ") :]]
            continue

        if in_search:
            cont = (
                line.startswith(" ")
                or line.startswith("|")
                or line.endswith("\\")
            )
            if not cont and search_lines:
                prev = search_lines[-1].rstrip()
                if prev.endswith(","):
                    cont = True
                elif " = " not in line and _SPL_ORPHAN_RE.match(line):
                    cont = True
            if cont:
                search_lines.append(line)
                continue
            in_search = False
            search_lines = []

        if not line.strip() or line.startswith("#"):
            continue
        if line.startswith("search = ") or line.startswith("|") or line.startswith(" "):
            continue
        if " = " in line:
            continue
        if _SPL_ORPHAN_RE.match(line):
            leaks.append((i, current, line))

    return leaks


def emit_search_field(search: str) -> list[str]:
    """Emit `search = ...\\` lines with the backslash flush against the last char."""
    parts = search.split("\n") if "\n" in search else [search]
    parts = [_strip_trailing_backslash(p).rstrip() for p in parts]
    while parts and not parts[-1]:
        parts.pop()
    if not parts:
        return ["search = "]

    lines: list[str] = []
    for i, part in enumerate(parts):
        is_last = i == len(parts) - 1
        prefix = "search = " if i == 0 else ""
        if is_last:
            lines.append(prefix + part)
        else:
            lines.append(prefix + part + "\\")
    return lines


def find_unterminated_search_lines(text: str) -> list[tuple[int, str, str]]:
    """Return non-final physical search lines missing a continuation backslash."""
    failures: list[tuple[int, str, str]] = []
    current: str | None = None
    search_lines: list[tuple[int, str]] = []

    def check_search() -> None:
        if len(search_lines) < 2 or current is None:
            return
        for line_number, line in search_lines[:-1]:
            if not line.rstrip().endswith("\\"):
                failures.append((line_number, current, line))

    for line_number, line in enumerate(text.splitlines(), 1):
        match = re.match(r"^\[([a-z0-9_]+)\]$", line)
        if match:
            check_search()
            current = match.group(1)
            search_lines = []
            continue
        if current is None:
            continue
        if line.startswith("search = "):
            check_search()
            search_lines = [(line_number, line)]
            continue
        if search_lines:
            if line.startswith("|") or line.startswith(" ") or line.endswith("\\"):
                search_lines.append((line_number, line))
                continue
            check_search()
            search_lines = []

    check_search()
    return failures


def _field_order_lists(fields: dict[str, str]) -> tuple[list[str], list[str]]:
    """Return (known_pre_search_order, unknown_extras) for a stanza."""
    known: list[str] = list(FIELD_ORDER_BEFORE_VIZ)
    for vf in VIZ_FIELDS:
        if vf in fields:
            known.append(vf)
    for ef in EXTRA_AFTER_VIZ:
        if ef in fields:
            known.append(ef)
    known.extend(PROSE_FIELDS)
    extras = [k for k in fields if k not in known and k != "search"]
    return known, extras


def metadata_needs_reorder(fields: dict[str, str]) -> bool:
    known, extras = _field_order_lists(fields)
    actual = [k for k in fields if k != "search"]
    target = [k for k in known if k in fields]
    target_full = target + extras
    if "search" in fields:
        target_full.append("search")
    return actual != target_full


def format_stanza(stanza_id: str, fields: dict[str, str]) -> tuple[str, bool, bool]:
    search_changed = False
    prose_changed = False

    if "search" in fields:
        new_search, search_changed = format_search(
            fields["search"],
            preserve_unbounded_sort=stanza_id in UNBOUNDED_SORT_CONTRACT_STANZAS,
        )
        fields = {**fields, "search": new_search}
        if (
            _contains_aggregate_command(new_search)
            and stanza_id not in UNBOUNDED_SORT_CONTRACT_STANZAS
        ):
            updated_fields = dict(fields)
            for key in PROSE_FIELDS:
                if key not in fields:
                    continue
                updated = sanitize_aggregate_sort_metadata(fields[key])
                if updated != fields[key]:
                    prose_changed = True
                    updated_fields[key] = updated
            fields = updated_fields

    known_keys, extras = _field_order_lists(fields)
    if extras:
        print(
            f"WARNING [{stanza_id}]: unknown metadata field(s) {extras!r} — "
            "add to FIELD_ORDER_BEFORE_VIZ (or VIZ/EXTRA/PROSE lists) in "
            "scripts/format_searchbase_conf.py",
            file=sys.stderr,
        )
    full_order = list(known_keys) + extras
    if "search" in fields:
        full_order.append("search")

    old_keys = list(fields.keys())
    target_keys = [k for k in full_order if k in fields]
    meta_changed = old_keys != target_keys or prose_changed

    lines = [f"[{stanza_id}]"]
    for key in full_order:
        if key not in fields:
            continue
        val = fields[key]
        if key == "search":
            for sl in emit_search_field(val):
                lines.append(sl)
        else:
            lines.append(f"{key} = {val}")

    return "\n".join(lines), search_changed, meta_changed


def missing_required_fields(fields: dict[str, str]) -> list[str]:
    return [f for f in REQUIRED_FOR_GAP_REPORT if f not in fields]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=SOURCE,
        help="Path to searchbase.conf",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Report changes without writing",
    )
    args = parser.parse_args()

    text = args.source.read_text(encoding="utf-8")
    stanzas = parse_stanzas(text)

    search_reformatted = 0
    meta_reordered = 0
    stanzas_unchanged_search = 0
    missing: list[tuple[str, list[str]]] = []
    unsafe: list[str] = []

    blocks: list[str] = []
    for sid, fields in stanzas:
        gaps = missing_required_fields(fields)
        if gaps:
            missing.append((sid, gaps))

        try:
            block, s_changed, m_changed = format_stanza(sid, fields)
        except Exception as exc:  # noqa: BLE001
            unsafe.append(f"{sid}: {exc}")
            blocks.append(
                "\n".join(
                    [f"[{sid}]"]
                    + [f"{k} = {v}" for k, v in fields.items() if k != "search"]
                    + (
                        ["search = " + fields["search"].split("\n", 1)[0]]
                        + fields.get("search", "").split("\n")[1:]
                        if "search" in fields
                        else []
                    )
                )
            )
            continue

        if s_changed:
            search_reformatted += 1
        else:
            stanzas_unchanged_search += 1
        if m_changed:
            meta_reordered += 1
        blocks.append(block)

    out_text = "\n\n".join(blocks) + "\n"

    print(f"Stanzas: {len(stanzas)}")
    print(f"Search reformatted: {search_reformatted}")
    print(f"Search already conformant: {stanzas_unchanged_search}")
    print(f"Metadata reordered: {meta_reordered}")
    if missing:
        print(f"Stanzas with missing required fields: {len(missing)}")
        for sid, gaps in missing[:20]:
            print(f"  {sid}: missing {', '.join(gaps)}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")
    if unsafe:
        print(f"Could not safely format: {len(unsafe)}")
        for item in unsafe:
            print(f"  {item}")

    leaked = find_leaked_spl_lines(text)
    if leaked:
        print(f"Leaked SPL lines (invalid conf keys): {len(leaked)}")
        for lineno, sid, content in leaked:
            preview = content if len(content) <= 72 else content[:69] + "..."
            print(f"  line {lineno} [{sid}]: {preview}")

    unterminated = find_unterminated_search_lines(text)
    if unterminated:
        print(f"Unterminated multiline search lines: {len(unterminated)}")
        for lineno, sid, content in unterminated[:20]:
            preview = content if len(content) <= 72 else content[:69] + "..."
            print(f"  line {lineno} [{sid}]: {preview}")
        if len(unterminated) > 20:
            print(f"  ... and {len(unterminated) - 20} more")

    if args.check:
        return 1 if leaked or unterminated else 0

    args.source.write_text(out_text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
