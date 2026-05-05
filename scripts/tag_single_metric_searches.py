#!/usr/bin/env python3
"""
tag_single_metric_searches.py
=============================

Adds the tag ``Cisco`` to every stanza in ``searchbase.conf`` whose SPL
emits a **single metric** through ``stats`` or ``timechart``. Idempotent:
re-running won't re-tag stanzas that already carry the marker.

What "single metric" means
--------------------------
The SPL pipeline ends with a ``stats`` or ``timechart`` stage that
produces exactly one output column, with no per-group splitting:

  * ``| stats count``                                     -> single metric
  * ``| stats avg(latency_ms) as latency``                -> single metric
  * ``| stats latest(score) as score``                    -> single metric
  * ``| timechart dc(macAddress) as clients``              -> single metric (1 series over time)
  * ``| timechart count``                                 -> single metric
  * ``| stats count by host``                             -> NOT single (multi-row)
  * ``| stats avg(rssi), avg(snr)``                       -> NOT single (multi-metric)
  * ``| timechart count by sourcetype``                   -> NOT single (multi-series)

Post-aggregation commands (``eval``, ``rename``, ``fields``, ``sort``,
``head``, ``where``, ``fillnull``) are tolerated; commands that change
shape (``appendcols``, ``join``, ``xyseries``, another ``stats`` /
``timechart``, etc.) disqualify the stanza.

Operation
---------
1. Parse ``searchbase.conf`` into stanzas with the existing parser
   (``parse_conf``); resolve backslash line continuations in ``search``
   to a single flat string.
2. Apply the single-metric heuristic to each stanza's ``search`` value.
3. For matching stanzas whose ``tags`` line does not already contain
   ``Cisco`` as a whole token, rewrite the line in-place to append
   ``, Cisco``.
4. Write the file back; on first run, also write ``searchbase.conf.bak``.

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
BACKUP = SEARCHBASE.with_suffix(".conf.bak")

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
# Single-metric heuristic
# ---------------------------------------------------------------------------


# Pipeline stages that change row/column shape after the last aggregation.
# If any of these appear AFTER the last stats/timechart, the search is no
# longer "single metric" by the time it reaches output.
_SHAPE_CHANGING_AFTER = {
    "appendcols",
    "appendpipe",
    "join",
    "union",
    "multikv",
    "xyseries",
    "mvexpand",
    "untable",
    "transpose",
    "stats",
    "timechart",
    "streamstats",
    "eventstats",
    "top",
    "rare",
    "chart",
    "geostats",
    "tstats",
    "metasearch",
}


def _split_pipes(spl: str) -> List[str]:
    """Split SPL on top-level ``|`` characters, ignoring quotes/backticks."""
    parts: List[str] = []
    buf: List[str] = []
    in_single = False
    in_double = False
    in_backtick = False
    for ch in spl:
        if ch == "'" and not in_double and not in_backtick:
            in_single = not in_single
        elif ch == '"' and not in_single and not in_backtick:
            in_double = not in_double
        elif ch == "`" and not in_single and not in_double:
            in_backtick = not in_backtick
        if ch == "|" and not in_single and not in_double and not in_backtick:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


def _count_top_level(s: str, target: str) -> int:
    """Count `target` chars at paren depth 0, outside quotes."""
    depth = 0
    in_q = False
    q_ch: Optional[str] = None
    n = 0
    for ch in s:
        if in_q:
            if ch == q_ch:
                in_q = False
            continue
        if ch in ('"', "'", "`"):
            in_q = True
            q_ch = ch
            continue
        # Count BEFORE the depth bookkeeping so `target == '('` counts the
        # paren that opens depth-1 (it is itself at depth 0). Same logic
        # for `target == ')'`: that paren closes depth-1 → also at depth 0.
        if ch == target and depth == 0:
            n += 1
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
    return n


def _has_top_level_by_clause(s: str) -> bool:
    """Return True if a `by` keyword appears at paren depth 0."""
    depth = 0
    in_q = False
    q_ch: Optional[str] = None
    i = 0
    while i < len(s):
        ch = s[i]
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
        if ch == ")":
            depth -= 1
            i += 1
            continue
        if depth == 0 and (i == 0 or not (s[i - 1].isalnum() or s[i - 1] == "_")):
            # Match a whole-word `by` (case-insensitive).
            if s[i : i + 2].lower() == "by" and (
                i + 2 >= len(s) or not (s[i + 2].isalnum() or s[i + 2] == "_")
            ):
                return True
        i += 1
    return False


def _is_single_agg_no_by(stage: str) -> bool:
    """Inspect a single ``stats`` or ``timechart`` stage for single-metric shape."""
    m = re.match(r"^(stats|timechart)\b\s*(.*)$", stage, flags=re.IGNORECASE | re.DOTALL)
    if not m:
        return False
    is_timechart = m.group(1).lower() == "timechart"
    body = m.group(2).strip()
    if not body:
        return False

    # Strip leading `key=value` options on timechart, e.g. `fixedrange=false`.
    # These only attach to timechart at the start of the body.
    if is_timechart:
        body = re.sub(
            r"^\s*((?:[\w.-]+\s*=\s*\S+\s*)+)",
            "",
            body,
        ).strip()
        if not body:
            return False

    # `by` clause -> grouping -> not single.
    if _has_top_level_by_clause(body):
        return False

    # Top-level commas separate multiple aggregations.
    if _count_top_level(body, ",") > 0:
        return False

    # Count top-level open parens. Each parenthesised expression at depth 0
    # is one aggregation's argument list.
    open_parens = _count_top_level(body, "(")
    if open_parens > 1:
        return False
    if open_parens == 1:
        # Exactly one `fn(...)` aggregation — single metric.
        return True

    # Zero parens at the top level: must be the bare `count` form,
    # optionally with `as <alias>`.
    if re.match(r"^(count|c)(\s+as\s+\S+)?$", body, flags=re.IGNORECASE):
        return True

    return False


def is_single_metric(spl: str) -> bool:
    """True if the SPL's last stats/timechart yields a single-metric output."""
    if not spl:
        return False
    flat = re.sub(r"\s+", " ", spl).strip()
    pipes = _split_pipes(flat)
    if not pipes:
        return False

    last_idx = -1
    for i, stage in enumerate(pipes):
        first_word = (stage.split(maxsplit=1) or [""])[0].lower()
        if first_word in ("stats", "timechart"):
            last_idx = i

    if last_idx < 0:
        return False

    # Anything shape-changing after the last aggregation disqualifies.
    for stage in pipes[last_idx + 1 :]:
        first = (stage.split(maxsplit=1) or [""])[0].lower()
        if first in _SHAPE_CHANGING_AFTER:
            return False

    return _is_single_agg_no_by(pipes[last_idx])


# ---------------------------------------------------------------------------
# Tag rewriter (in-place, line-aware)
# ---------------------------------------------------------------------------


_TAGS_LINE_RE = re.compile(r"^(\s*tags\s*=\s*)(.*?)(\s*)$")


def _has_cisco_token(tags_value: str) -> bool:
    """Word-boundary check: does the existing tags value already contain Cisco?"""
    return any(t.strip() == NEW_TAG for t in tags_value.split(","))


def rewrite_tags_inplace(text: str, tagged_stanza_names: set) -> tuple[str, int]:
    """
    Walk the file line-by-line. For each line that opens a stanza, track
    whether that stanza is in our "to-tag" set. When inside such a
    stanza, find the (possibly multi-line) ``tags`` value and rewrite
    it to append ``Cisco`` (idempotently).

    Returns (new_text, num_actually_tagged).
    """
    out_lines: List[str] = []
    lines = text.splitlines(keepends=True)
    in_target_stanza = False
    tagged_count = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            stanza_name = stripped[1:-1]
            in_target_stanza = stanza_name in tagged_stanza_names
            out_lines.append(line)
            i += 1
            continue

        if in_target_stanza and re.match(r"\s*tags\s*=", line):
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

            if _has_cisco_token(full_value):
                # Already tagged; preserve the original block verbatim.
                out_lines.extend(lines[i : j + 1])
                i = j + 1
                continue

            # Append `, Cisco`. Collapse to a single line — far simpler
            # than reproducing multi-line continuations, and tags lines
            # are short enough that one line is conventional anyway.
            new_value = full_value + (", " + NEW_TAG if full_value else NEW_TAG)
            # Preserve trailing newline style of the original first line.
            ending = "\n" if line.endswith("\n") else ""
            out_lines.append(f"{prefix}{new_value}{ending}")
            tagged_count += 1
            i = j + 1
            continue

        out_lines.append(line)
        i += 1

    return "".join(out_lines), tagged_count


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
    already_tagged: List[Stanza] = []
    for st in stanzas:
        spl = st.fields.get("search", "")
        if not is_single_metric(spl):
            continue
        existing_tags = st.fields.get("tags", "")
        if _has_cisco_token(existing_tags):
            already_tagged.append(st)
        else:
            targets.append(st)

    print(f"single-metric matches:        {len(targets) + len(already_tagged)}")
    print(f"  already tagged Cisco:       {len(already_tagged)}")
    print(f"  pending tag application:    {len(targets)}")

    if args.dry_run:
        print("\n=== dry-run preview (first 10 stanzas to be tagged) ===")
        for st in targets[:10]:
            spl = re.sub(r"\s+", " ", st.fields.get("search", "")).strip()
            tags = st.fields.get("tags", "")
            print(f"\n[{st.name}]")
            print(f"  current tags: {tags}")
            print(f"  spl tail:     ...{spl[-120:] if len(spl) > 120 else spl}")
        if len(targets) > 10:
            print(f"\n... and {len(targets) - 10} more")
        print("\n=== end preview ===")
        return 0

    if not targets:
        print("Nothing to do — every single-metric stanza already carries Cisco.")
        return 0

    if not BACKUP.exists():
        shutil.copy2(SEARCHBASE, BACKUP)
        print(f"backup written: {BACKUP}")

    target_names = {st.name for st in targets}
    original_text = SEARCHBASE.read_text(encoding="utf-8")
    new_text, n_tagged = rewrite_tags_inplace(original_text, target_names)

    if n_tagged != len(targets):
        # Sanity check: every targeted stanza should have been touched.
        missed = len(targets) - n_tagged
        print(
            f"WARNING: rewriter touched {n_tagged} stanzas but planned {len(targets)} "
            f"({missed} missed). Investigate before relying on the file.",
            file=sys.stderr,
        )

    SEARCHBASE.write_text(new_text, encoding="utf-8")
    print(f"tagged {n_tagged} stanzas with `{NEW_TAG}`")
    return 0


if __name__ == "__main__":
    sys.exit(main())
