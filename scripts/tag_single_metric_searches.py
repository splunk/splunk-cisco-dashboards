#!/usr/bin/env python3
"""
tag_single_metric_searches.py
=============================

Synchronizes the tag ``Cisco`` on every stanza in ``searchbase.conf`` whose
SPL is tile-ready trend output. For the picker, ``Cisco`` now has a strict
meaning: the search must end with a real ``timechart`` command that produces
one or more aggregate metric columns. Idempotent: re-running won't duplicate
tags, and stale ``Cisco`` tags are removed from non-trend stanzas.

What "tile-ready trend output" means
------------------------------------
The SPL pipeline's final command is ``timechart`` and that command produces at
least one aggregate metric column:

  * ``| timechart dc(macAddress) as clients``        -> tile-ready trend
  * ``| timechart count``                            -> tile-ready trend
  * ``| timechart avg(rssi) as rssi, avg(snr) as snr`` -> tile-ready trend
  * ``| timechart count by sourcetype``              -> tile-ready trend
  * ``| stats count``                                -> NOT tile-ready trend
  * ``| timechart count | fields _time count``       -> NOT tile-ready trend
  * ``| timechart count | rename count as total``    -> NOT tile-ready trend
  * ``| table host status``                          -> NOT tile-ready trend

Synthetic/demo searches and side-effecting searches are not tagged even if
they happen to contain a final ``timechart``.

Operation
---------
1. Parse ``searchbase.conf`` into stanzas with the existing parser
   (``parse_conf``); resolve backslash line continuations in ``search``
   to a single flat string.
2. Apply the final-timechart heuristic to each stanza's ``search`` value.
3. Ensure matching stanzas contain ``Cisco`` as a whole-token tag, and
   non-matching stanzas do not.
4. Write the file back; on first run, also write a backup under
   repo-root ``backups/`` so Splunk packaging does not pick it up.

Usage
-----
    python3 scripts/tag_single_metric_searches.py [--dry-run]
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


REPO_ROOT = Path(__file__).resolve().parent.parent
SEARCHBASE = REPO_ROOT / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
BACKUP_DIR = REPO_ROOT / "backups"
BACKUP = BACKUP_DIR / "searchbase.conf.pre-cisco-tag-sync.bak"

NEW_TAG = "Cisco"


# ---------------------------------------------------------------------------
# Conf parser (mirrors trueup_savedsearches.py)
# ---------------------------------------------------------------------------


@dataclass
class Stanza:
    name: str
    fields: Dict[str, str] = field(default_factory=dict)


def parse_conf(path: Path) -> List[Stanza]:
    """Splunk-style INI parse with backslash line continuations."""
    stanzas: List[Stanza] = []
    current: Optional[Stanza] = None
    pending_key: Optional[str] = None
    pending_value_parts: List[str] = []
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        i += 1
        if pending_key is not None:
            stripped_end = raw.rstrip()
            if stripped_end.endswith("\\"):
                pending_value_parts.append(stripped_end[:-1].rstrip() + " ")
                continue
            pending_value_parts.append(stripped_end)
            assert current is not None
            current.fields[pending_key] = "".join(pending_value_parts).strip()
            pending_key = None
            pending_value_parts = []
            continue
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = Stanza(name=line[1:-1])
            stanzas.append(current)
            continue
        if "=" not in line:
            continue
        if current is None:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val_stripped_end = raw.rstrip()
        if val_stripped_end.endswith("\\"):
            pending_key = key
            pending_value_parts = [val.strip().rstrip("\\").rstrip() + " "]
            continue
        current.fields[key] = val.strip()
    return stanzas


# ---------------------------------------------------------------------------
# Tile-ready trend heuristic
# ---------------------------------------------------------------------------


_AGG_FUNCTION_RE = re.compile(
    r"\b(?:"
    r"count|c|dc|distinct_count|estdc|sum|avg|mean|min|max|median|mode|"
    r"range|stdev|stdevp|var|varp|latest|earliest|first|last|values|list|"
    r"perc\d*|exactperc\d*|upperperc\d*|p\d+"
    r")\s*\(",
    flags=re.IGNORECASE,
)
_NUMERIC_AGG_RE = re.compile(
    r"\b(?:"
    r"count|c|dc|distinct_count|estdc|sum|avg|mean|min|max|median|mode|"
    r"range|stdev|stdevp|var|varp|perc\d*|exactperc\d*|upperperc\d*|p\d+"
    r")\s*\(",
    flags=re.IGNORECASE,
)
_SNAPSHOT_AGG_RE = re.compile(
    r"\b(?:latest|earliest|first|last|values|list)\s*\(([^)]*)\)",
    flags=re.IGNORECASE,
)
_BARE_COUNT_RE = re.compile(r"(^|[\s,])(?:count|c)(?=$|[\s,])", flags=re.IGNORECASE)
_ALIAS_RE = re.compile(
    r"\bas\s+(`[^`]+`|\"[^\"]+\"|'[^']+'|[A-Za-z_][\w.:/-]*)",
    flags=re.IGNORECASE,
)
_RENAME_RE = re.compile(
    r"(`[^`]+`|\"[^\"]+\"|'[^']+'|[A-Za-z_][\w.:/-]*)\s+as\s+"
    r"(`[^`]+`|\"[^\"]+\"|'[^']+'|[A-Za-z_][\w.:/-]*)",
    flags=re.IGNORECASE,
)
_METRIC_NAME_RE = re.compile(
    r"("
    r"count|total|score|health|pct|percent|rate|ratio|latency|duration|response|"
    r"ms|bytes|bits|bps|bandwidth|usage|util|active|inactive|reachable|"
    r"unreachable|managed|unmanaged|connected|disconnected|alert|issue|"
    r"incident|threat|blocked|allowed|temperature|temp|humidity|power|"
    r"watt|volt|amps|amperage|kw|capacity|occupancy|availability|uptime|down|error|fail|"
    r"success|risk|severity|priority|volume|traffic|auth|logon|"
    r"message_type|reliability|manageability"
    r")",
    flags=re.IGNORECASE,
)


def _split_pipes(spl: str) -> List[str]:
    """Split SPL on top-level ``|`` characters, ignoring quotes/subsearches."""
    parts: List[str] = []
    buf: List[str] = []
    in_single = False
    in_double = False
    in_backtick = False
    bracket_depth = 0
    for ch in spl:
        if ch == "'" and not in_double and not in_backtick:
            in_single = not in_single
        elif ch == '"' and not in_single and not in_backtick:
            in_double = not in_double
        elif ch == "`" and not in_single and not in_double:
            in_backtick = not in_backtick
        elif ch == "[" and not in_single and not in_double and not in_backtick:
            bracket_depth += 1
        elif ch == "]" and not in_single and not in_double and not in_backtick:
            bracket_depth = max(0, bracket_depth - 1)
        if (
            ch == "|"
            and bracket_depth == 0
            and not in_single
            and not in_double
            and not in_backtick
        ):
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def _strip_leading_options(stage_name: str, body: str) -> str:
    """Drop leading command options such as ``span=`` or ``fixedrange=``."""
    if stage_name == "timechart":
        return re.sub(r"^\s*((?:[\w.-]+\s*=\s*\S+\s*)+)", "", body).strip()
    return body.strip()


def _strip_by_clause(body: str) -> str:
    """Return the stats/timechart body before a top-level BY clause."""
    depth = 0
    in_q = False
    q_ch: Optional[str] = None
    i = 0
    while i < len(body):
        ch = body[i]
        if in_q:
            if ch == q_ch:
                in_q = False
            i += 1
            continue
        if ch in ('"', "'", "`"):
            in_q = True
            q_ch = ch
            i += 1
            continue
        if ch == "(":
            depth += 1
            i += 1
            continue
        elif ch == ")":
            depth = max(0, depth - 1)
            i += 1
            continue
        if depth == 0 and (i == 0 or not (body[i - 1].isalnum() or body[i - 1] == "_")):
            # Match a whole-word `by` (case-insensitive).
            if body[i : i + 2].lower() == "by" and (
                i + 2 >= len(body) or not (body[i + 2].isalnum() or body[i + 2] == "_")
            ):
                return body[:i].strip()
        i += 1
    return body.strip()


def _normalize_field_name(name: str) -> str:
    return name.strip().strip("`\"'")


def _split_top_level_commas(s: str) -> List[str]:
    parts: List[str] = []
    buf: List[str] = []
    depth = 0
    in_q = False
    q_ch: Optional[str] = None
    for ch in s:
        if in_q:
            buf.append(ch)
            if ch == q_ch:
                in_q = False
            continue
        if ch in ('"', "'", "`"):
            in_q = True
            q_ch = ch
            buf.append(ch)
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            part = "".join(buf).strip()
            if part:
                parts.append(part)
            buf = []
            continue
        buf.append(ch)
    part = "".join(buf).strip()
    if part:
        parts.append(part)
    return parts


def _is_metric_name(name: str) -> bool:
    return bool(_METRIC_NAME_RE.search(_normalize_field_name(name)))


def _segment_has_metric_aggregate(segment: str) -> bool:
    if _NUMERIC_AGG_RE.search(segment) or _BARE_COUNT_RE.search(segment):
        return True
    for snapshot_match in _SNAPSHOT_AGG_RE.finditer(segment):
        if _is_metric_name(snapshot_match.group(1)):
            return True
    return any(_is_metric_name(m.group(1)) for m in _ALIAS_RE.finditer(segment))


def _aggregate_aliases(stage: str) -> set[str]:
    """Return aggregate output aliases from one stats/timechart stage.

    ``*`` is used as an unknown/wildcard aggregate marker when SPL creates
    series names dynamically, for example ``timechart count by status``.
    """
    m = re.match(r"^(stats|timechart)\b\s*(.*)$", stage, flags=re.IGNORECASE | re.DOTALL)
    if not m:
        return set()
    stage_name = m.group(1).lower()
    body = _strip_leading_options(stage_name, m.group(2))
    if not body:
        return set()

    aggregate_part = _strip_by_clause(body)
    if not (_AGG_FUNCTION_RE.search(aggregate_part) or _BARE_COUNT_RE.search(aggregate_part)):
        return set()

    aliases: set[str] = set()
    segments = _split_top_level_commas(aggregate_part)
    if not segments:
        segments = [aggregate_part]
    for segment in segments:
        if not _segment_has_metric_aggregate(segment):
            continue
        segment_aliases = {_normalize_field_name(m.group(1)) for m in _ALIAS_RE.finditer(segment)}
        if _BARE_COUNT_RE.search(segment) and not re.search(
            r"\b(?:count|c)\s+as\s+", segment, flags=re.IGNORECASE
        ):
            segment_aliases.add("count")
        if segment_aliases:
            aliases.update(segment_aliases)
        else:
            aliases.add("*")

    if not aliases:
        return set()

    if stage_name == "timechart":
        aliases.add("_time")
        if re.search(r"\bby\b", body, flags=re.IGNORECASE):
            aliases.add("*")

    return aliases


def _eval_metric_aliases(stage: str, aliases: set[str]) -> set[str]:
    if "*" in aliases:
        return aliases
    body = stage.split(maxsplit=1)[1] if len(stage.split(maxsplit=1)) > 1 else ""
    new_aliases = set(aliases)
    for assignment in _split_top_level_commas(body):
        lhs, sep, rhs = assignment.partition("=")
        if not sep:
            continue
        lhs_name = _normalize_field_name(lhs)
        rhs_names = {_normalize_field_name(alias) for alias in aliases}
        references_metric = any(re.search(rf"(?<![\w.]){re.escape(alias)}(?![\w.])", rhs) for alias in rhs_names)
        looks_numeric = bool(re.search(r"[+\-*/]|\bround\s*\(|\bif\s*\(|\bcase\s*\(|\d", rhs, flags=re.IGNORECASE))
        if references_metric or (_is_metric_name(lhs_name) and looks_numeric):
            new_aliases.add(lhs_name)
    return new_aliases


def _rename_metric_aliases(stage: str, aliases: set[str]) -> set[str]:
    if "*" in aliases:
        return aliases
    next_aliases = set(aliases)
    for match in _RENAME_RE.finditer(stage):
        old = _normalize_field_name(match.group(1))
        new = _normalize_field_name(match.group(2))
        if old in next_aliases:
            next_aliases.add(new)
    return next_aliases


def _fields_keep_metric(stage: str, aliases: set[str]) -> bool:
    """Best-effort check that table/fields did not remove all metrics."""
    if "*" in aliases:
        return True
    parts = stage.split(maxsplit=1)
    body = parts[1] if len(parts) > 1 else ""
    if not body:
        return True
    lowered = body.lower()
    if "*" in body:
        return True
    if lowered.strip().startswith("-"):
        removed = {_normalize_field_name(token) for token in re.split(r"[\s,]+", body) if token and token != "-"}
        return not aliases.issubset(removed)
    selected = {_normalize_field_name(token) for token in re.split(r"[\s,]+", body) if token}
    return bool(aliases & selected)


_SYNTHETIC_RE = re.compile(r"\bmakeresults\b|\brandom\s*\(", flags=re.IGNORECASE)
_SIDE_EFFECT_RE = re.compile(
    r"\b(?:outputlookup|collect|sendemail|script|delete)\b", flags=re.IGNORECASE
)


def is_tile_ready_trend_output(spl: str) -> bool:
    """True if SPL ends with a metric-producing timechart."""
    if not spl:
        return False
    flat = re.sub(r"\s+", " ", spl).strip()
    if _SYNTHETIC_RE.search(flat) or _SIDE_EFFECT_RE.search(flat):
        return False
    pipes = _split_pipes(flat)
    if not pipes:
        return False

    final_stage = pipes[-1]
    first_word = (final_stage.split(maxsplit=1) or [""])[0].lower()
    if first_word != "timechart":
        return False

    aliases = _aggregate_aliases(final_stage)
    return bool(aliases and "_time" in aliases)


# ---------------------------------------------------------------------------
# Tag rewriter (in-place, line-aware)
# ---------------------------------------------------------------------------


_TAGS_LINE_RE = re.compile(r"^(\s*tags\s*=\s*)(.*?)(\s*)$")


def _has_cisco_token(tags_value: str) -> bool:
    """Word-boundary check: does the existing tags value already contain Cisco?"""
    return any(t.strip() == NEW_TAG for t in tags_value.split(","))


def rewrite_tags_inplace(text: str, tagged_stanza_names: set) -> tuple[str, int, int]:
    """
    Walk the file line-by-line. For each line that opens a stanza, track
    whether that stanza is in our metric-output set. When inside a
    stanza, find the (possibly multi-line) ``tags`` value and synchronize
    the exact ``Cisco`` token.

    Returns (new_text, num_added, num_removed).
    """
    out_lines: List[str] = []
    lines = text.splitlines(keepends=True)
    current_stanza: Optional[str] = None
    in_target_stanza = False
    saw_tags_in_stanza = False
    added_count = 0
    removed_count = 0
    i = 0

    def maybe_add_missing_tags_line() -> None:
        nonlocal added_count
        if current_stanza and in_target_stanza and not saw_tags_in_stanza:
            out_lines.append(f"tags = {NEW_TAG}\n")
            added_count += 1

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            maybe_add_missing_tags_line()
            stanza_name = stripped[1:-1]
            current_stanza = stanza_name
            in_target_stanza = stanza_name in tagged_stanza_names
            saw_tags_in_stanza = False
            out_lines.append(line)
            i += 1
            continue

        if current_stanza and re.match(r"\s*tags\s*=", line):
            saw_tags_in_stanza = True
            # Capture the (possibly multi-line) tags value. Continuations
            # are signalled by a trailing `\`.
            value_parts: List[str] = []
            first_match = _TAGS_LINE_RE.match(line.rstrip("\n"))
            if first_match is None:
                # Defensive: shouldn't happen given the prefix match above.
                out_lines.append(line)
                i += 1
                continue
            prefix = first_match.group(1)
            current_value = first_match.group(2)
            j = i
            while current_value.rstrip().endswith("\\"):
                value_parts.append(current_value.rstrip()[:-1].rstrip() + " ")
                j += 1
                if j >= len(lines):
                    break
                current_value = lines[j].rstrip("\n")
            value_parts.append(current_value)
            full_value = "".join(value_parts).strip()

            original_tokens = [token.strip() for token in full_value.split(",") if token.strip()]
            next_tokens = [token for token in original_tokens if token != NEW_TAG]
            if in_target_stanza and NEW_TAG not in next_tokens:
                next_tokens.append(NEW_TAG)
            next_value = ", ".join(next_tokens)

            if next_tokens == original_tokens:
                # Already tagged; preserve the original block verbatim.
                out_lines.extend(lines[i : j + 1])
                i = j + 1
                continue

            if in_target_stanza:
                added_count += 1
            else:
                removed_count += 1

            # Collapse to a single line. Tags lines are short enough that
            # one line is conventional, and it keeps exact-token removal
            # deterministic.
            # Preserve trailing newline style of the original first line.
            ending = "\n" if line.endswith("\n") else ""
            out_lines.append(f"{prefix}{next_value}{ending}")
            i = j + 1
            continue

        out_lines.append(line)
        i += 1

    maybe_add_missing_tags_line()
    return "".join(out_lines), added_count, removed_count


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Report what would change without writing.",
    )
    args = parser.parse_args()

    if not SEARCHBASE.exists():
        print(f"FATAL: {SEARCHBASE} not found", file=sys.stderr)
        return 2

    stanzas = parse_conf(SEARCHBASE)
    print(f"searchbase entries:           {len(stanzas)}")

    targets: List[Stanza] = []
    missing_tag: List[Stanza] = []
    stale_tag: List[Stanza] = []
    for st in stanzas:
        spl = st.fields.get("search", "")
        existing_tags = st.fields.get("tags", "")
        is_trend = is_tile_ready_trend_output(spl)
        if is_trend:
            targets.append(st)
            if not _has_cisco_token(existing_tags):
                missing_tag.append(st)
        elif _has_cisco_token(existing_tags):
            stale_tag.append(st)

    print(f"tile-ready trend matches:     {len(targets)}")
    print(f"  missing Cisco tag:          {len(missing_tag)}")
    print(f"  stale Cisco tag:            {len(stale_tag)}")

    if args.dry_run:
        print("\n=== dry-run preview (first 10 stanzas to be tagged) ===")
        for st in missing_tag[:10]:
            spl = re.sub(r"\s+", " ", st.fields.get("search", "")).strip()
            tags = st.fields.get("tags", "")
            print(f"\n[{st.name}]")
            print(f"  current tags: {tags}")
            print(f"  spl tail:     ...{spl[-120:] if len(spl) > 120 else spl}")
        if len(missing_tag) > 10:
            print(f"\n... and {len(missing_tag) - 10} more to tag")
        print("\n=== dry-run preview (first 10 stale tags to remove) ===")
        for st in stale_tag[:10]:
            spl = re.sub(r"\s+", " ", st.fields.get("search", "")).strip()
            tags = st.fields.get("tags", "")
            print(f"\n[{st.name}]")
            print(f"  current tags: {tags}")
            print(f"  spl tail:     ...{spl[-120:] if len(spl) > 120 else spl}")
        if len(stale_tag) > 10:
            print(f"\n... and {len(stale_tag) - 10} more to remove")
        print("\n=== end preview ===")
        return 0

    if not missing_tag and not stale_tag:
        print("Nothing to do — Cisco tags already match tile-ready trend searches.")
        return 0

    if not BACKUP.exists():
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SEARCHBASE, BACKUP)
        print(f"backup written: {BACKUP}")

    target_names = {st.name for st in targets}
    original_text = SEARCHBASE.read_text(encoding="utf-8")
    new_text, n_added, n_removed = rewrite_tags_inplace(original_text, target_names)

    if n_added != len(missing_tag) or n_removed != len(stale_tag):
        # Sanity check: every targeted stanza should have been touched.
        print(
            f"WARNING: rewriter added {n_added}/{len(missing_tag)} and removed "
            f"{n_removed}/{len(stale_tag)}. Investigate before relying on the file.",
            file=sys.stderr,
        )

    SEARCHBASE.write_text(new_text, encoding="utf-8")
    print(f"added `{NEW_TAG}` to {n_added} stanzas")
    print(f"removed stale `{NEW_TAG}` from {n_removed} stanzas")
    return 0


if __name__ == "__main__":
    sys.exit(main())
