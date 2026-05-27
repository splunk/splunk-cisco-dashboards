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
    "dispatch_context_force",
]

VIZ_FIELDS = ("default_viz", "viz_options")
EXTRA_AFTER_VIZ = ("drilldown_search_name", "drilldown_button_title")
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
            if (
                line.startswith(" ")
                or line.startswith("|")
                or line.endswith("\\")
            ):
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


def format_search(search: str) -> tuple[str, bool]:
    """Reformat a search field per the rules. Returns (new_search, changed)."""
    original = search
    text = search.replace("\t", " ")

    raw_lines = [_strip_trailing_backslash(ln) for ln in text.split("\n")]
    while raw_lines and not raw_lines[-1].strip():
        raw_lines.pop()
    if not raw_lines:
        return original, False

    glued = "\n".join(raw_lines)
    spans = _scan_top_level_pipes(glued)
    if not spans:
        return original, False

    out_lines: list[str] = []
    for idx, (_s, _e, stage_text) in enumerate(spans):
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


def metadata_needs_reorder(fields: dict[str, str]) -> bool:
    desired: list[str] = list(FIELD_ORDER_BEFORE_VIZ)
    for vf in VIZ_FIELDS:
        if vf in fields:
            desired.append(vf)
    for ef in EXTRA_AFTER_VIZ:
        if ef in fields:
            desired.append(ef)
    desired.extend(PROSE_FIELDS)
    desired.append("search")

    actual = [k for k in fields if k != "search"]
    target = [k for k in desired if k in fields]
    extras = [k for k in actual if k not in target]
    target_full = target + extras
    return actual != target_full


def format_stanza(stanza_id: str, fields: dict[str, str]) -> tuple[str, bool, bool]:
    search_changed = False

    if "search" in fields:
        new_search, search_changed = format_search(fields["search"])
        fields = {**fields, "search": new_search}

    ordered_keys: list[str] = list(FIELD_ORDER_BEFORE_VIZ)
    for vf in VIZ_FIELDS:
        if vf in fields:
            ordered_keys.append(vf)
    for ef in EXTRA_AFTER_VIZ:
        if ef in fields:
            ordered_keys.append(ef)
    ordered_keys.extend(PROSE_FIELDS)
    if "search" in fields:
        ordered_keys.append("search")

    extras = [k for k in fields if k not in ordered_keys]
    full_order = ordered_keys + extras

    old_keys = list(fields.keys())
    target_keys = [k for k in full_order if k in fields]
    meta_changed = old_keys != target_keys

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

    if args.check:
        return 0

    args.source.write_text(out_text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
