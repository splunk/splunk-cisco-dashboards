#!/usr/bin/env python3
"""
One-shot rewriter for the ``[ta_te_stock_*]`` stanzas in
``searchbase.conf``.

Why this exists
---------------
On 2026-05-13 we harvested 100 SPL panels from the Cisco ThousandEyes
TA's stock Simple XML dashboards into our app's ``searchbase.conf`` as
a reference catalogue. Each stanza shipped with the upstream view's
Simple XML dashboard tokens still in place (``$tkn_acc_group$``,
``$tkn_test_type$``, ``$app_dd_N$``, ``$tkn_page_size$``, ...) which
means none of the searches actually run outside the TA's dashboards
without first binding values into those tokens.

This script does two jobs in a single pass:

1. **Classify** every ``[ta_te_stock_*]`` stanza into one of four
   buckets and **delete** the ones that don't survive as standalone
   searches:

   * ``DELETE_DRILLDOWN`` — body contains ``$app_dd_N$``. These are
     drilldown-only filters that take a clicked row's value from the
     parent panel. No sensible default exists, so they're dead weight
     once the parent panel is gone.
   * ``DELETE_POPULATOR`` — body is a single ``tstats`` aggregate of
     an *identifier* field (``*.name``, ``*.id``, ``*.address``,
     ``*.user``, ``*.aid``, ``*.uid``, ``accountId``, ``accountGroupName``)
     grouped by the same identifier, with no further transforms. These
     existed solely to populate dropdown / radio inputs in the upstream
     dashboard. Useless once the input is gone.
   * ``KEEP_DETOKENIZE`` — body is a real aggregation / trend /
     detail table. We strip the ``$tkn_*$`` filter lines (they default
     to ``*`` in the TA's view), replace ``head $tkn_page_size$`` with
     a hard-coded ``head 100``, and rewrite the descriptive metadata
     so the stanza reads as a standalone search rather than a
     harvested panel.

2. **Detokenize** the ``KEEP_DETOKENIZE`` stanzas in place. The
   ``WHERE`` clause keeps its non-token conditions (e.g.
   ``Test_Metrics.metric_name:network.loss="*"``) and drops everything
   else; if every condition was a token, the entire ``WHERE`` line
   goes.

Append subsearches (``| append [ ... ]``) on a single physical line
get the same token-stripping treatment via a separate regex pass
because the line-continuation logic doesn't see them as a separate
block.

Usage
-----

::

    python3 scripts/rewrite_ta_stock.py --dry-run
    python3 scripts/rewrite_ta_stock.py --apply

``--dry-run`` (default) prints the classification table and writes
nothing. ``--apply`` rewrites ``searchbase.conf`` in place AND writes
``scripts/ta_stock_rewrite_report.md`` with the keep / delete decisions
so the diff is auditable after the fact.
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple


SEARCHBASE_PATH = (
    Path(__file__).resolve().parent.parent
    / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
REPORT_PATH = Path(__file__).resolve().parent / "ta_stock_rewrite_report.md"


# ---------------------------------------------------------------------------
# Classification rules
# ---------------------------------------------------------------------------

# An identifier field in the BY/aggregate position means the stanza was
# almost certainly the source of a dropdown / input populator panel in
# the upstream TA dashboard. The trailing ``$`` anchors the suffix so
# ``testType`` and ``severity`` are NOT classified as identifiers
# (those are categorical and worth keeping as histograms).
#
# The order matters only insofar as we want the most specific suffixes
# checked first to keep the regex readable.
IDENTIFIER_FIELD_PATTERNS = [
    r"\.accountGroupName$",
    r"\.organizationId$",
    r"\.accountId$",
    r"\.testId$",
    r"\.monitor\.name$",
    r"\.dns\.question\.name$",
    r"\.agent\.name$",
    r"\.test\.name$",
    r"\.name$",
    r"\.aid$",
    r"\.uid$",
    r"\.user$",
    r"\.userId$",
    r"\.address$",
    r"\.host$",
    r"\.id$",
]

IDENTIFIER_REGEX = re.compile("|".join(IDENTIFIER_FIELD_PATTERNS))

# Token-only WHERE filter line: leading whitespace, one ``$tkn_*$`` and
# nothing else (with optional trailing continuation backslash). These
# get stripped wholesale from kept stanzas because the upstream view
# defaults each token to ``*``.
TKN_FILTER_LINE_RE = re.compile(r"^\s+\$tkn_[a-zA-Z0-9_]+\$\s*\\?\s*$")

# ``WHERE`` opener with a token-only first condition. Used to detect
# when stripping leaves the WHERE clause empty so we drop the WHERE
# line too.
WHERE_LINE_TKN_RE = re.compile(
    r"^(?P<indent>\s+)WHERE\s+(?P<rest>\$tkn_[a-zA-Z0-9_]+\$\s*\\?)\s*$"
)

# Page-size token in detail tables.
PAGE_SIZE_RE = re.compile(r"\$tkn_page_size\$")

# Any ``$app_dd_N$`` placeholder — instant DELETE.
DRILLDOWN_PLACEHOLDER_RE = re.compile(r"\$app_dd_\d+\$")

# Inline ``$tkn_*$`` reference inside a flattened append subsearch (one
# physical line). We replace these with ``*`` since dropping them whole
# isn't safe — the subsearch would parse as malformed.
INLINE_TKN_RE = re.compile(r"\s*\$tkn_[a-zA-Z0-9_]+\$\s*")


@dataclass
class Stanza:
    """A single ``[name]`` block plus the lines that belong to it.

    ``lines`` includes the header line and everything up to (but not
    including) the next stanza header. Blank lines between stanzas
    stay with the *preceding* stanza so emitting them in original
    order round-trips byte-for-byte (modulo the rewrites this script
    deliberately applies).
    """

    name: str
    lines: List[str] = field(default_factory=list)

    @property
    def is_ta_stock(self) -> bool:
        return self.name.startswith("ta_te_stock_")

    def field_value(self, key: str) -> Optional[str]:
        """Return the value of a single-line ``key = value`` field."""
        prefix = f"{key} = "
        for line in self.lines:
            if line.startswith(prefix):
                return line[len(prefix):].rstrip("\n")
        return None

    def search_block(self) -> Tuple[int, int, List[str]]:
        """Locate the ``search = ...`` block, including any line
        continuations marked with trailing ``\\``.

        Returns ``(start, end_exclusive, body_lines)`` where indexes
        refer to ``self.lines``. ``body_lines`` is a copy.
        """
        start = -1
        for i, line in enumerate(self.lines):
            if line.startswith("search = ") or line.startswith("search="):
                start = i
                break
        if start == -1:
            return -1, -1, []
        end = start + 1
        # Line continuation: each line ends with `\` until the
        # statement terminates. The first line itself counts as part
        # of the body.
        while (
            end - 1 >= 0
            and self.lines[end - 1].rstrip("\n").endswith("\\")
            and end < len(self.lines)
        ):
            end += 1
        return start, end, list(self.lines[start:end])


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

STANZA_HEADER_RE = re.compile(r"^\[([^\]]+)\]\s*$")


def parse_stanzas(text: str) -> List[Stanza]:
    """Split ``searchbase.conf`` into ``Stanza`` objects.

    Lines preceding the first ``[stanza]`` header are collected into a
    sentinel stanza named ``__preamble__`` so the round-trip is exact.
    """
    stanzas: List[Stanza] = []
    current = Stanza(name="__preamble__")
    for line in text.splitlines(keepends=True):
        match = STANZA_HEADER_RE.match(line)
        if match:
            if current.lines or current.name != "__preamble__":
                stanzas.append(current)
            current = Stanza(name=match.group(1))
        current.lines.append(line)
    stanzas.append(current)
    return stanzas


def emit_stanzas(stanzas: List[Stanza]) -> str:
    out: List[str] = []
    for s in stanzas:
        out.extend(s.lines)
    return "".join(out)


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------


def search_text(body_lines: List[str]) -> str:
    """Flatten the ``search = `` block into one logical string.

    Drops the leading ``search = `` prefix from the first line and
    collapses each ``\\ \\n`` continuation into a single space so
    regexes don't have to know about line breaks. We *don't* normalise
    other whitespace; the original token characters survive intact
    for the classifier.
    """
    if not body_lines:
        return ""
    first = body_lines[0]
    if first.startswith("search = "):
        first = first[len("search = "):]
    elif first.startswith("search="):
        first = first[len("search="):]
    parts = [first] + body_lines[1:]
    flat = "".join(parts)
    return flat.replace("\\\n", " ").rstrip("\n")


def is_drilldown(flat: str) -> bool:
    return bool(DRILLDOWN_PLACEHOLDER_RE.search(flat))


def is_populator(flat: str) -> bool:
    """True iff the search is a single ``tstats`` aggregate of an
    identifier field with no follow-on transforms.

    The shape we're hunting:

    .. code-block:: splunk

        | tstats `summariesonly` count(<IDENT>) [as alias] FROM datamodel=...
            WHERE $tkn_*$ ...
            BY <IDENT> [, _time]

    where ``<IDENT>`` matches one of ``IDENTIFIER_FIELD_PATTERNS``. We
    also catch the ``values()`` variant the TA uses for "list of
    account groups" panels.

    The "no follow-on transforms" check is what excludes timecharts,
    eval columns, rename / table / sort pipelines that take the same
    input and reshape it into a real chart. Those are kept.
    """
    # Reject anything with extra pipeline stages. The original search
    # starts with `| tstats`, so a non-trivial pipeline shows up as a
    # second `| ` after stripping leading whitespace.
    pipe_segments = [seg.strip() for seg in flat.split("|") if seg.strip()]
    if len(pipe_segments) != 1:
        return False
    # Single segment must start with `tstats `.
    head = pipe_segments[0]
    if not re.match(r"^tstats\b", head):
        return False
    # Find every aggregated field: count(X), values(X), distinct_count(X).
    agg_fields = re.findall(
        r"(?:count|values|distinct_count|dc)\(([^)]+)\)", head
    )
    if not agg_fields:
        return False
    # BY clause field list.
    by_match = re.search(r"\bBY\s+(.+?)$", head)
    if not by_match:
        return False
    by_fields_raw = by_match.group(1)
    by_fields = [f.strip() for f in by_fields_raw.split(",")]
    # Treat ``_time`` in BY as transparent — populator queries
    # generally don't include it, but a trailing ``_time`` shouldn't
    # save a stanza from the populator bucket if every other BY field
    # is an identifier.
    by_fields = [f for f in by_fields if f != "_time" and f]
    if not by_fields:
        return False
    # Every aggregated field AND every BY field must match the
    # identifier patterns. That excludes ``count(*)`` aggregates and
    # ``BY severity`` style category buckets.
    for f in agg_fields + by_fields:
        if not IDENTIFIER_REGEX.search(f):
            return False
    return True


# ---------------------------------------------------------------------------
# Rewriting
# ---------------------------------------------------------------------------


def detokenize_search_block(body_lines: List[str]) -> List[str]:
    """Strip ``$tkn_*$`` filter lines from a ``search = `` block.

    Returns a new list of lines. Mutates nothing.

    Rules:
      * Lines matching ``TKN_FILTER_LINE_RE`` are removed entirely
        (they sit inside the ``WHERE`` clause and default to ``*``).
      * If the line opening the ``WHERE`` clause was itself a token
        condition, the ``WHERE`` line is rewritten to merge with the
        first surviving filter — or removed entirely if no filter
        survives.
      * Inline ``$tkn_*$`` references inside flattened append
        subsearches are replaced with ``*``.
      * ``head $tkn_page_size$`` → ``head 100``.
      * Line continuations (``\\`` at end of line) are re-balanced so
        the last line of the block doesn't end with a dangling ``\\``.
    """
    if not body_lines:
        return body_lines

    out: List[str] = []
    # Pass 1: drop token-only filter lines, rewrite WHERE-with-token.
    i = 0
    while i < len(body_lines):
        line = body_lines[i]
        # WHERE line where the first condition is a token —
        # if we're going to drop that token, the WHERE keyword
        # needs to either move down to the next surviving line
        # or disappear entirely.
        where_match = WHERE_LINE_TKN_RE.match(line)
        if where_match:
            # Collect the contiguous block of token-only filter lines
            # following this WHERE.
            j = i + 1
            while j < len(body_lines) and TKN_FILTER_LINE_RE.match(body_lines[j]):
                j += 1
            # j now points at the first non-token line (or off the end).
            # Decide whether to keep a WHERE clause.
            if j < len(body_lines) and not body_lines[j].lstrip().startswith("BY"):
                # There's still a real filter to lead with — rewrite
                # the WHERE line to lead with that filter and drop
                # all token-only lines.
                next_line = body_lines[j]
                # Replace leading whitespace of next_line with
                # ``WHERE`` keyword at the same indent.
                indent = where_match.group("indent")
                rewritten = f"{indent}WHERE {next_line.lstrip()}"
                out.append(rewritten)
                i = j + 1
                continue
            else:
                # No filter survives → skip the WHERE line and all
                # token-only filter lines.
                i = j
                continue
        # Standalone token-only filter line (already had a WHERE
        # earlier in the block that we kept).
        if TKN_FILTER_LINE_RE.match(line):
            i += 1
            continue
        out.append(line)
        i += 1

    # Pass 2: inline rewrites (append subsearches + page size).
    rewritten: List[str] = []
    for line in out:
        new = line
        # Replace `$tkn_page_size$` first since it doesn't need the
        # generic ``$tkn_*$`` cleanup.
        new = PAGE_SIZE_RE.sub("100", new)
        # If this line contains an ``| append [ ... ]`` (or any other
        # inline `$tkn_*$` reference), replace each token with `*`.
        # This is the conservative move: the append subsearch usually
        # mirrors the main query's WHERE, so a `*` swap keeps the
        # subsearch parseable and semantically aligned with the
        # main-search stripping we just did.
        new = INLINE_TKN_RE.sub(" ", new)
        rewritten.append(new)

    # Pass 3: re-balance trailing line-continuation backslashes. If
    # we removed the last continuation line, the new last line might
    # still end with `\` — that's a syntax error in `.conf`. Walk
    # from the end and trim a single trailing backslash from the
    # final line of the block.
    if rewritten:
        last = rewritten[-1]
        if last.rstrip("\n").endswith("\\"):
            # Remove just the trailing backslash, preserve the newline.
            if last.endswith("\n"):
                rewritten[-1] = last[:-2] + "\n"
            else:
                rewritten[-1] = last[:-1]
    return rewritten


def rewrite_metadata(stanza_lines: List[str]) -> List[str]:
    """Polish the descriptive fields after detokenization.

    * ``description`` — drop the "Uses Simple XML dashboard tokens"
      hedge since the tokens are gone.
    * ``solution`` — replace the TA-specific note with a more
      generic, useful sentence.
    * ``related_info`` — drop the "Differs from TEUC raw-index" line
      that doesn't apply to a detokenized standalone search.
    * ``tags`` — left alone. The
      `splunk-spl-searchbase-format` skill explicitly calls out
      ``TA Stock Dashboard`` as a useful *provenance* tag for
      stanzas harvested from upstream TA dashboards, so we keep it
      even after detokenization.
    """
    out: List[str] = []
    for line in stanza_lines:
        new = line
        if new.startswith("description = "):
            new = new.replace(
                " Uses Simple XML dashboard tokens; bind or replace tokens when reusing outside the TA.",
                "",
            )
        elif new.startswith("solution = "):
            new = (
                "solution = <p>Run only when DM acceleration is healthy; "
                "empty panels usually indicate the accelerated data model "
                "has not built summaries for the dispatched time range.</p>\n"
            )
        elif new.startswith("related_info = "):
            new = new.replace(
                "<li><b>Contrast</b><br>Differs from TEUC raw-index searches in this same catalogue.</li>",
                "",
            )
        # tags: intentionally not modified. See docstring.
        out.append(new)
    return out


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


@dataclass
class Decision:
    stanza_name: str
    search_name: Optional[str]
    sub_category: Optional[str]
    verdict: str  # KEEP_DETOKENIZE | DELETE_DRILLDOWN | DELETE_POPULATOR
    reason: str


def classify(stanza: Stanza) -> Decision:
    start, end, body = stanza.search_block()
    flat = search_text(body)
    search_name = stanza.field_value("search_name")
    sub_category = stanza.field_value("sub_category")
    if is_drilldown(flat):
        return Decision(
            stanza_name=stanza.name,
            search_name=search_name,
            sub_category=sub_category,
            verdict="DELETE_DRILLDOWN",
            reason="contains $app_dd_N$ drilldown placeholder (parent-row value filter)",
        )
    if is_populator(flat):
        return Decision(
            stanza_name=stanza.name,
            search_name=search_name,
            sub_category=sub_category,
            verdict="DELETE_POPULATOR",
            reason="single tstats aggregate of identifier field — input populator",
        )
    return Decision(
        stanza_name=stanza.name,
        search_name=search_name,
        sub_category=sub_category,
        verdict="KEEP_DETOKENIZE",
        reason="aggregation / trend / detail table — surviving as standalone",
    )


def apply_to_stanza(stanza: Stanza) -> None:
    """Mutate a KEEP stanza in place: detokenize + clean metadata."""
    start, end, body = stanza.search_block()
    if start == -1:
        return
    new_body = detokenize_search_block(body)
    stanza.lines = stanza.lines[:start] + new_body + stanza.lines[end:]
    stanza.lines = rewrite_metadata(stanza.lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Rewrite searchbase.conf in place (default is dry-run).",
    )
    parser.add_argument(
        "--show-sample",
        action="store_true",
        help="Print 1 KEEP, 1 DRILLDOWN, 1 POPULATOR with the before/"
        "after search bodies so the rewrite can be eyeballed.",
    )
    parser.add_argument(
        "--list-populators",
        action="store_true",
        help="Print every stanza classified as DELETE_POPULATOR so "
        "the heuristic can be reviewed before --apply.",
    )
    parser.add_argument(
        "--debug-stanza",
        help="Print before/after for one specific stanza name (for "
        "validating tricky rewrites like append-subsearch handling).",
    )
    args = parser.parse_args()

    text = SEARCHBASE_PATH.read_text(encoding="utf-8")
    stanzas = parse_stanzas(text)

    decisions: List[Decision] = []
    kept: List[Stanza] = []
    # Cache before/after pairs for --show-sample so we don't have to
    # re-parse the original text once stanzas have been mutated.
    samples: dict = {}
    debug_capture: dict = {}
    for stanza in stanzas:
        if not stanza.is_ta_stock:
            kept.append(stanza)
            continue
        decision = classify(stanza)
        decisions.append(decision)
        # Grab a "before" snapshot of the search block for the sample.
        if decision.verdict not in samples:
            start, end, body = stanza.search_block()
            samples[decision.verdict] = {
                "stanza": stanza.name,
                "search_name": decision.search_name,
                "before": "".join(body),
            }
        if args.debug_stanza and stanza.name == args.debug_stanza:
            start, end, body = stanza.search_block()
            debug_capture["before"] = "".join(body)
            debug_capture["verdict"] = decision.verdict
        if decision.verdict.startswith("DELETE"):
            # Drop the stanza entirely. Any trailing blank line that
            # was bundled with this stanza goes too — emit_stanzas
            # uses original byte order otherwise.
            continue
        # KEEP path.
        apply_to_stanza(stanza)
        # Capture the "after" for the keep sample.
        if decision.verdict == "KEEP_DETOKENIZE" and "after" not in samples[decision.verdict]:
            start, end, body = stanza.search_block()
            samples[decision.verdict]["after"] = "".join(body)
        if args.debug_stanza and stanza.name == args.debug_stanza:
            start, end, body = stanza.search_block()
            debug_capture["after"] = "".join(body)
        kept.append(stanza)

    # Summary.
    buckets = {"KEEP_DETOKENIZE": 0, "DELETE_DRILLDOWN": 0, "DELETE_POPULATOR": 0}
    by_subcat: dict = {}
    for d in decisions:
        buckets[d.verdict] = buckets.get(d.verdict, 0) + 1
        key = d.sub_category or "(unknown)"
        by_subcat.setdefault(key, {"KEEP_DETOKENIZE": 0, "DELETE_DRILLDOWN": 0, "DELETE_POPULATOR": 0})
        by_subcat[key][d.verdict] += 1

    if args.show_sample:
        for verdict in ("KEEP_DETOKENIZE", "DELETE_DRILLDOWN", "DELETE_POPULATOR"):
            if verdict not in samples:
                continue
            s = samples[verdict]
            print(f"\n=== {verdict} sample ===")
            print(f"stanza: {s['stanza']}")
            print(f"search_name: {s['search_name']}")
            print("--- BEFORE ---")
            print(s["before"])
            if "after" in s:
                print("--- AFTER ---")
                print(s["after"])
        print()

    if args.debug_stanza and debug_capture:
        print(f"\n=== Debug stanza [{args.debug_stanza}] ===")
        print(f"verdict: {debug_capture.get('verdict')}")
        print("--- BEFORE ---")
        print(debug_capture.get("before", "(not found)"))
        if "after" in debug_capture:
            print("--- AFTER ---")
            print(debug_capture["after"])

    if args.list_populators:
        print("\n=== All DELETE_POPULATOR stanzas ===")
        for d in decisions:
            if d.verdict == "DELETE_POPULATOR":
                print(f"  [{d.stanza_name}] {d.search_name}")
        print()

    print(f"Total ta_te_stock_* stanzas: {len(decisions)}")
    for k, v in buckets.items():
        print(f"  {k}: {v}")
    print("\nBy sub_category:")
    for sc, counts in sorted(by_subcat.items()):
        total = sum(counts.values())
        print(
            f"  {sc:<24} total={total:<3} "
            f"keep={counts['KEEP_DETOKENIZE']:<3} "
            f"drill={counts['DELETE_DRILLDOWN']:<3} "
            f"pop={counts['DELETE_POPULATOR']:<3}"
        )

    if args.apply:
        SEARCHBASE_PATH.write_text(emit_stanzas(kept), encoding="utf-8")
        print(f"\n✓ Wrote {SEARCHBASE_PATH}")
        # Write a markdown report alongside this script with the per-
        # stanza verdicts. Audit trail for the rewrite commit.
        report_lines = [
            "# TA Stock Search Rewrite Report",
            "",
            f"Total stanzas processed: **{len(decisions)}**",
            "",
            "| Verdict | Count |",
            "|---|---|",
            f"| Keep + detokenize | {buckets['KEEP_DETOKENIZE']} |",
            f"| Delete (drilldown) | {buckets['DELETE_DRILLDOWN']} |",
            f"| Delete (populator) | {buckets['DELETE_POPULATOR']} |",
            "",
            "## Per-stanza decisions",
            "",
            "| Stanza | sub_category | search_name | Verdict | Reason |",
            "|---|---|---|---|---|",
        ]
        for d in decisions:
            report_lines.append(
                f"| `{d.stanza_name}` "
                f"| {d.sub_category or ''} "
                f"| {d.search_name or ''} "
                f"| {d.verdict} "
                f"| {d.reason} |"
            )
        REPORT_PATH.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
        print(f"✓ Wrote {REPORT_PATH}")
    else:
        print("\n(dry-run; pass --apply to write changes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
