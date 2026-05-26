#!/usr/bin/env python3
"""Format searchbase.conf per .cursor/skills/splunk-spl-searchbase-format/SKILL.md."""

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
    "search",
)

CONTINUE_INDENT = 4
WHERE_CONT_INDENT = 10
EVAL_CONT_INDENT = 7

TSTATS_KW = ("FROM", "WHERE", "BY", "from", "where", "by")


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


def _scan_top_level(s: str) -> list[tuple[int, int, str]]:
    """Return [(start, end, text)] spans at top level (not inside quotes/parens/brackets)."""
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
            part = s[start:i].strip()
            if part:
                spans.append((start, i, part))
            start = i + 1
        i += 1
    part = s[start:n].strip()
    if part:
        spans.append((start, n, part))
    return spans


def join_search_lines(search: str) -> str:
    raw_lines: list[str] = []
    for line in search.split("\n"):
        stripped = line.rstrip()
        if stripped.endswith("\\"):
            stripped = stripped[:-1].rstrip()
        raw_lines.append(stripped)

    merged: list[str] = []
    for part in raw_lines:
        if not part:
            continue
        if merged and re.match(r"^\|\s*(FROM|WHERE|BY)\b", part, re.I):
            merged[-1] = merged[-1] + " " + part.lstrip("| ").lstrip()
            continue
        if merged and re.match(r"^\s+(FROM|WHERE|BY)\b", part, re.I):
            merged[-1] = merged[-1] + " " + part.strip()
            continue
        if (
            merged
            and part.startswith(" ")
            and not re.match(r"^\s*\|", part)
        ):
            prev = merged[-1]
            if re.match(r"^\|?\s*(eval|eventstats)\b", prev, re.I):
                merged[-1] = prev.rstrip(", ") + ", " + part.strip()
            else:
                merged[-1] = prev + " " + part.strip()
            continue
        merged.append(part)
    return " ".join(merged)


def collapse_whitespace(s: str) -> str:
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
        out.append(c)
        i += 1
    return "".join(out).strip()


def _find_keyword(stage: str, keywords: tuple[str, ...]) -> tuple[str, int, int] | None:
    """Find first keyword at top level; return (keyword, start, end)."""
    i = 0
    n = len(stage)
    depth_paren = depth_bracket = 0
    in_quote: str | None = None
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
        elif c == "[":
            depth_bracket += 1
        elif c == "]":
            depth_bracket = max(0, depth_bracket - 1)
        elif depth_paren == 0 and depth_bracket == 0:
            for kw in keywords:
                end = i + len(kw)
                if stage[i:end].upper() == kw.upper():
                    before_ok = i == 0 or not stage[i - 1].isalnum()
                    after_ok = end >= n or not stage[end].isalnum()
                    if before_ok and after_ok:
                        return kw, i, end
        i += 1
    return None


def _split_where_conditions(where_body: str) -> list[str]:
    body = collapse_whitespace(where_body)
    if not body:
        return []
    parts = re.split(r"\s+AND\s+", body, flags=re.I)
    if len(parts) > 1:
        return [collapse_whitespace(p) for p in parts if p.strip()]
    return [body]


def format_tstats_stage(stage: str) -> str:
    stage = collapse_whitespace(stage)
    if not re.match(r"^\|?\s*tstats\b", stage, re.I):
        return stage

    has_leading_pipe = stage.lstrip().startswith("|")
    work = stage.lstrip()
    if work.startswith("|"):
        work = work[1:].lstrip()

    hits = [
        h
        for h in (
            _find_keyword(work, ("FROM", "from")),
            _find_keyword(work, ("WHERE", "where")),
            _find_keyword(work, ("BY", "by")),
        )
        if h
    ]
    if not hits:
        return stage

    order = sorted([(kw, start, end) for kw, start, end in hits], key=lambda x: x[1])
    final: dict[str, str] = {}
    final["AGG"] = work[: order[0][1]].strip()
    clauses: list[tuple[str, str]] = []
    for idx, (kw, _start, end) in enumerate(order):
        next_start = order[idx + 1][1] if idx + 1 < len(order) else len(work)
        clauses.append((kw, work[end:next_start].strip()))

    lines: list[str] = []
    agg = collapse_whitespace(final["AGG"])
    lines.append(_ensure_leading_pipe(agg))

    for kw, body in clauses:
        if not body:
            continue
        if kw.upper() == "WHERE":
            conds = _split_where_conditions(body)
            if not conds:
                lines.append(f"{' ' * CONTINUE_INDENT}WHERE")
            elif len(conds) == 1:
                lines.append(f"{' ' * CONTINUE_INDENT}WHERE {conds[0]}")
            else:
                lines.append(f"{' ' * CONTINUE_INDENT}WHERE {conds[0]}")
                for cond in conds[1:]:
                    lines.append(f"{' ' * WHERE_CONT_INDENT}{cond}")
        else:
            lines.append(f"{' ' * CONTINUE_INDENT}{kw} {body}")

    return "\n".join(lines)


def _split_top_level_commas(expr: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    depth_paren = depth_bracket = 0
    in_quote: str | None = None
    i = 0
    n = len(expr)
    while i < n:
        c = expr[i]
        if in_quote:
            if c == "\\" and i + 1 < n:
                current.append(c)
                current.append(expr[i + 1])
                i += 2
                continue
            if c == in_quote:
                in_quote = None
            current.append(c)
            i += 1
            continue
        if c in '"\'`':
            in_quote = c
            current.append(c)
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
        elif c == "," and depth_paren == 0 and depth_bracket == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            i += 1
            continue
        current.append(c)
        i += 1
    part = "".join(current).strip()
    if part:
        parts.append(part)
    return parts


def format_eval_like_stage(stage: str) -> str:
    stage = collapse_whitespace(stage)
    m = re.match(r"^(\|?\s*)(eval|eventstats)\s+(.*)$", stage, re.I | re.S)
    if not m:
        return stage
    lead, cmd, rest = m.group(1), m.group(2).lower(), m.group(3)
    clauses = _split_top_level_commas(rest)
    if len(clauses) <= 1:
        return stage
    pipe_prefix = "| " if lead.strip().startswith("|") else ""
    cont_lines = [f"{pipe_prefix}{cmd} {clauses[0]},"]
    for clause in clauses[1:-1]:
        cont_lines.append(f"{' ' * EVAL_CONT_INDENT}{clause},")
    cont_lines.append(f"{' ' * EVAL_CONT_INDENT}{clauses[-1]}")
    return "\n".join(cont_lines)


def spl_logical_form(search: str) -> str:
    """Normalize SPL for equality checks (whitespace + continuations only)."""
    joined = join_search_lines(search.replace("\t", " "))
    stages = [collapse_whitespace(t) for _, _, t in _scan_top_level(joined)]
    return " | ".join(stages)


def _ensure_leading_pipe(line: str) -> str:
    st = line.strip()
    if st.startswith("|"):
        return st
    if re.match(r"^(tstats|makeresults|inputlookup|datamodel)\b", st, re.I):
        return "| " + st
    return st


def _stage_to_lines(stage: str, *, is_first: bool) -> list[str]:
    """Expand one pipe stage; internal newlines are continuations, not new pipes."""
    if "\n" not in stage:
        st = stage.strip()
        if is_first:
            st = _ensure_leading_pipe(st)
        elif not st.startswith("|"):
            st = "| " + st.lstrip("| ")
        return [st]

    out: list[str] = []
    for j, raw in enumerate(line for line in stage.split("\n") if line.strip()):
        if j == 0:
            line = raw.strip()
            if is_first:
                line = _ensure_leading_pipe(line)
            elif not line.startswith("|"):
                line = "| " + line.lstrip("| ")
            out.append(line)
        else:
            out.append(raw.rstrip())
    return out


def format_search(search: str) -> tuple[str, bool]:
    original = search
    if "\t" in search:
        search = search.replace("\t", " ")

    joined = join_search_lines(search)
    spans = _scan_top_level(joined)
    if not spans:
        return original, False

    flat_lines: list[str] = []
    for idx, (_start, _end, stage_text) in enumerate(spans):
        st = collapse_whitespace(stage_text)
        if re.match(r"^\|?\s*tstats\b", st, re.I):
            st = format_tstats_stage(st)
        elif re.match(r"^\|?\s*(eval|eventstats)\b", st, re.I):
            st = format_eval_like_stage(st)
        flat_lines.extend(_stage_to_lines(st, is_first=idx == 0))

    if len(flat_lines) == 1 and len(flat_lines[0]) < 120:
        out = flat_lines[0]
    else:
        out = "\n".join(flat_lines)

    norm_orig = original.replace("\t", " ")
    changed = spl_logical_form(norm_orig) != spl_logical_form(out) or _search_layout(
        norm_orig
    ) != _search_layout(out)
    return out, changed


def _search_layout(search: str) -> str:
    """Normalize layout (continuations, trailing slashes) for idempotency checks."""
    lines = []
    for line in search.splitlines():
        s = line.rstrip()
        if s.endswith("\\"):
            s = s[:-1].rstrip()
        lines.append(s)
    return "\n".join(lines)


def emit_search_field(search: str) -> list[str]:
    """Emit search = line(s) with trailing backslashes on non-final lines."""
    if "\n" in search:
        parts = search.split("\n")
    else:
        parts = [search]

    lines: list[str] = []
    for i, part in enumerate(parts):
        part = part.rstrip()
        is_last = i == len(parts) - 1
        if i == 0:
            prefix = "search = "
        else:
            prefix = ""
        if not is_last:
            if not part.endswith("\\"):
                part = part + " \\"
        else:
            part = part.rstrip("\\").rstrip()
        lines.append(prefix + part)
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

    seen_keys = [k for k in fields if k != "search"]
    # Build actual order from file - we only know dict order is insertion order from parser
    # Parser reads in file order - good
    actual = [k for k in fields if k != "search"]
    target = [k for k in desired if k in fields]
    extras = [k for k in actual if k not in target]
    target_full = target + extras
    return actual != target_full


def format_stanza(stanza_id: str, fields: dict[str, str]) -> tuple[str, bool, bool]:
    search_changed = False
    meta_changed = False

    if "search" in fields:
        new_search, search_changed = format_search(fields["search"])
        fields = {**fields, "search": new_search}

    lines = [f"[{stanza_id}]"]

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

    old_keys = [k for k in fields]
    meta_changed = old_keys != [k for k in full_order if k in fields]

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
