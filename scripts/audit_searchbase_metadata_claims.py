#!/usr/bin/env python3
"""Detect metadata claims that the stanza's own SPL proves false.

``searchbase.conf`` prose was largely generated during dashboard harvesting and
then drifted as the SPL was optimised. Two catalog-wide edits in particular
invalidated prose without touching it:

* the sort audit removed every ``sort`` from searches containing ``stats`` or
  ``tstats``, leaving ``solution`` text that still promises ranked output; and
* several waves converted single-value panels to ``timechart``, leaving
  ``description`` text that still promises "a single value".

Both classes are *provable* from the SPL alone -- no product knowledge or live
Splunk access is required to know the prose is wrong. This script inventories
them, plus the mechanical hygiene classes (missing documentation links, leaked
edit instructions, inverted dates, prose with no HTML markup), so the rewrite
effort can be aimed at evidence rather than at a page-order walk.

The script is read-only. It classifies and reports; it never edits. Fixes are
applied by ``fix_searchbase_metadata_claims.py`` for the subset that can be
remediated mechanically, and by hand for everything else.

Usage::

    python3 scripts/audit_searchbase_metadata_claims.py
    python3 scripts/audit_searchbase_metadata_claims.py --defect STALE_SORT --samples 5
    python3 scripts/audit_searchbase_metadata_claims.py --json report.json
"""

from __future__ import annotations

import argparse
import collections
import html
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from audit_searchbase_quality import Stanza, command_name, parse_conf  # noqa: E402
from format_searchbase_conf import _scan_top_level_pipes  # noqa: E402

SEARCHBASE = (
    ROOT
    / "packages"
    / "splunk-cisco-dashboards"
    / "src"
    / "main"
    / "resources"
    / "splunk"
    / "default"
    / "searchbase.conf"
)

PROSE_FIELDS = ("description", "explanation", "solution", "related_info")

# Commands that establish the shape of the final result set.
_TRANSFORMS = {"stats", "tstats", "chart", "timechart", "top", "rare"}


# ---------------------------------------------------------------------------
# Ground truth derived from the SPL
# ---------------------------------------------------------------------------


def stages(spl: str) -> list[str]:
    """Top-level pipeline stages, ignoring pipes inside quotes/parens/brackets."""
    flat = re.sub(r"\s+", " ", spl.replace("\\\n", " ")).strip()
    return [text.strip() for _, _, text in _scan_top_level_pipes(flat) if text.strip()]


def _strip_subsearches(spl: str) -> str:
    """Remove bracketed subsearches so top-level structure can be inspected.

    Brackets are only subsearch delimiters outside quotes. SPL regexes are full
    of character classes -- ``rex field=dn "epg-(?<Epg>[^\\/]+)"`` -- and a
    naive depth counter both deletes the class and desynchronises on the
    unbalanced ``\\[`` in patterns like ``"rspathAtt-\\[topology"``, silently
    truncating the pipeline.
    """
    out: list[str] = []
    depth = 0
    quote: str | None = None
    escaped = False

    for char in spl:
        if escaped:
            if depth == 0:
                out.append(char)
            escaped = False
            continue

        if char == "\\":
            if depth == 0:
                out.append(char)
            escaped = True
            continue

        if quote:
            if depth == 0:
                out.append(char)
            if char == quote:
                quote = None
            continue

        if char in {"'", '"'}:
            quote = char
            if depth == 0:
                out.append(char)
            continue

        if char == "[":
            depth += 1
            continue
        if char == "]":
            depth = max(0, depth - 1)
            continue
        if depth == 0:
            out.append(char)

    return "".join(out)


def has_command_anywhere(spl: str, name: str) -> bool:
    """True when ``name`` runs as a command at any nesting depth.

    The sort gate in the audit skill is explicitly nesting-insensitive: a sort
    inside a subsearch still violates the no-sort contract, so this deliberately
    does not strip subsearches.
    """
    flat = re.sub(r"\s+", " ", spl)
    # A command always follows a pipe or opens a subsearch/search string.
    return bool(re.search(rf"[|\[]\s*{name}\b", flat, re.I))


@dataclass
class Shape:
    """What the search actually returns."""

    kind: str  # timeseries | single_row | table | events
    evidence: str

    @property
    def is_single_row(self) -> bool:
        return self.kind == "single_row"


_ROW_COMBINERS = {"append", "appendpipe", "appendcols", "union", "multisearch"}


def derive_shape(spl: str) -> Shape:
    top = stages(_strip_subsearches(spl))
    if not top:
        return Shape("events", "no top-level stages parsed")

    # Appended branches add rows the final transform never sees, so several
    # single-row `stats` legs can still produce a multi-row table.
    combiners = {command_name(stage) for stage in top} & _ROW_COMBINERS
    if combiners:
        return Shape("unknown", f"row count set by {'/'.join(sorted(combiners))}")

    # Walk backwards to the last shape-defining transform.
    for stage in reversed(top):
        cmd = command_name(stage)
        if cmd not in _TRANSFORMS:
            continue
        if cmd == "timechart":
            return Shape("timeseries", f"final transform: {stage[:70]}")
        if cmd in {"top", "rare", "chart"}:
            return Shape("table", f"final transform: {stage[:70]}")
        # stats / tstats: a `by` clause makes it multi-row.
        body = stage
        if re.search(r"\bby\b", body, re.I):
            if re.search(r"\bby\b[^|]*\b_time\b", body, re.I):
                return Shape("timeseries", f"final transform: {stage[:70]}")
            return Shape("table", f"final transform: {stage[:70]}")
        return Shape("single_row", f"final transform: {stage[:70]}")

    # No transform ran, so the row count is whatever the generating command
    # produced. A trailing `table`/`fields` only projects columns -- it says
    # nothing about cardinality, and `makeresults`-based stanzas legitimately
    # return exactly one row. Refuse to guess.
    return Shape("unknown", f"no transform; final command: {top[-1][:70]}")


# ---------------------------------------------------------------------------
# Claim detection in prose
# ---------------------------------------------------------------------------


def plain_text(value: str) -> str:
    """Strip HTML tags and unescape entities so prose can be pattern-matched."""
    without_tags = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(without_tags)).strip()


def tight_text(value: str) -> str:
    """Strip HTML tags without inserting whitespace.

    Punctuation checks must run on this variant: replacing ``</b>`` with a
    space would turn the perfectly valid ``<b>Total</b>.`` into ``Total .`` and
    report a defect this script itself created.
    """
    return html.unescape(re.sub(r"<[^>]+>", "", value)).strip()


# "a single row usually means local routing" describes how to read one row of a
# multi-row table, so `row` only counts as a shape claim in an explicit
# "returns a single row" construction.
SINGLE_VALUE_CLAIM = re.compile(
    r"\b(?:"
    r"a single (?:value|number|count|integer|metric|figure|percentage)|"
    r"one (?:single )?(?:value|number|count|integer)|"
    r"single-value|single value|"
    r"returns? (?:a|the) single (?:row|value|number)|"
    r"returns? (?:the )?(?:total|count) as a single"
    r")\b",
    re.I,
)

TIMESERIES_CLAIM = re.compile(
    r"\b(?:"
    r"time series|timeseries|"
    r"(?:trend|trended|trending|plotted|charted) over time|"
    r"one point per (?:time )?(?:bucket|bin|interval)|"
    r"over the selected time range as a (?:trend|series)"
    r")\b",
    re.I,
)

# "One row per time bucket" is the correct description of a timechart, so the
# per-entity phrasings must not match a time grain.
# Up to two qualifiers may sit between "per" and the grain noun, covering
# "acceleration time bucket", "hour-bucket", and "5-minute interval".
_TIME_GRAIN = (
    r"\(?(?:[\w-]+\s+){0,2}"
    r"(?:hour|day|minute|time)?[-\s]?"
    r"(?:bucket|bin|interval|point|span|slice|period|_time)"
)
TABLE_CLAIM = re.compile(
    r"\b(?:"
    r"(?:multi-row|multi row) table|"
    rf"one row per (?!{_TIME_GRAIN})|a row (?:for|per) each (?!{_TIME_GRAIN})|"
    r"returns? a table"
    r")",
    re.I,
)

# The sort audit removed every sort from aggregate searches. Any surviving
# promise of ordered output in those stanzas is stale by construction.
SORT_CLAIM = re.compile(
    r"\b(?:"
    r"sorted|sort(?:s|ing)? (?:by|in|the)|"
    r"(?:in )?(?:descending|ascending)(?: order)?|"
    r"ordered (?:by|from)|ranked (?:by|from)|"
    r"highest (?:first|to lowest)|lowest (?:first|to highest)|"
    r"in order of|"
    r"top \d+ (?:results|rows|entries)"
    r")\b",
    re.I,
)

# The sort-removal pass substituted "Sort by X descending" with
# "prioritize X descending", which is not grammatical English and still implies
# an ordering the search no longer produces.
SORT_SUBSTITUTION = re.compile(
    r"\bprioriti[sz]e[d]?\s+[A-Z][\w\s-]{0,40}?\s+(?:descending|ascending)\b"
    r"|\bprioriti[sz]ed by\b",
    re.I,
)

# Sentence punctuation damaged by mechanical clause deletion, e.g. removing
# ", sorted by count" from "...per site, sorted by count." leaves "...per site..".
# The negative lookarounds keep deliberate ellipses ("round(...,1)", "stats
# latest(...) by host") out of the results.
# The trailing lookaheads require sentence-final punctuation. Without them,
# stripping tags from "See <code>.cursor/rules/x.mdc</code>" yields "See ." and
# every dot-leading path or field fragment is reported as damage.
DOUBLE_PUNCT = re.compile(r"(?<!\.)\.\.(?!\.)|,,|\s+[.,](?=\s|$)")

# Prose legitimately opens with a lowercase SPL command name when that command
# is marked up as code, e.g. "<p><code>tstats</code> reads the accelerated...".
OPENS_WITH_CODE = re.compile(r"^\s*(?:<p>\s*)?<code>", re.I)

# Field paths and SPL command names are lowercase by nature; opening a sentence
# with one is correct even without code markup.
_SPL_COMMANDS = {
    "tstats", "stats", "timechart", "chart", "eval", "where", "search", "rex",
    "lookup", "inputlookup", "makeresults", "bin", "fields", "table", "top",
    "rare", "streamstats", "eventstats", "append", "appendpipe", "union",
    "coalesce", "fillnull", "predict", "transaction", "mvexpand", "spath",
}


def opens_with_identifier(text: str) -> bool:
    first = re.match(r"[^\s]+", text)
    if not first:
        return False
    token = first.group(0).strip("`\"'(),;:")
    return (
        token.lower() in _SPL_COMMANDS
        or "." in token
        or "_" in token
        or bool(re.search(r"[a-z][A-Z]", token))  # camelCase field name
    )

# Fields that promise what *this* search returns. Shape claims are only checked
# here: `explanation` describes pipeline logic and `related_info` cross-references
# sibling stanzas, so both legitimately name shapes other than their own
# ("...the companion stanza returns a time series instead of a single count").
SHAPE_CLAIM_FIELDS = ("description", "solution")

# Generated harvest prose. These phrasings say nothing search-specific.
BOILERPLATE = (
    # Provenance boilerplate, not the legitimate "derives the bucket width from
    # the dashboard time picker".
    re.compile(r"\b(?:reports?|displays?|shows?|visualis?z?es?)\b[^.]{0,60}\bfrom the [\w\s]*dashboard\b", re.I),
    re.compile(r"\bthis search (?:provides|reports|displays) (?:visibility|information)\b", re.I),
    re.compile(r"\breview the results and take appropriate action\b", re.I),
    re.compile(r"\binvestigate (?:any )?(?:anomalies|issues) (?:as )?(?:needed|appropriate)\b", re.I),
    re.compile(r"\brefer to (?:the )?(?:relevant|appropriate) documentation\b", re.I),
)

EDIT_INSTRUCTION = re.compile(
    r"\b(?:TODO|FIXME|XXX)\b|\(remove\b[^)]*\)|\breplace with\b|\bremove both bullets\b",
    re.I,
)

HTML_TAG = re.compile(r"<[a-zA-Z/][^>]*>")

# Splunk's single-value visualizations render a timechart as one big number plus
# a sparkline, so "single value" prose on those stanzas describes the tile, not
# the row count, and is not a defect.
SINGLE_VALUE_VIZ = {"splunk.singlevalue", "splunk.singlevalueradial", "splunk.fillergauge"}

# A shape word inside one of these sentences refers to something other than this
# search's own output.
NEGATION = re.compile(r"\b(?:rather than|instead of|not (?:a|the)|no longer|as opposed to)\b", re.I)
CROSS_REFERENCE = re.compile(
    r"\b(?:companion|sibling|compare(?:d)?\b[\w\s]{0,30}?\b(?:against|with|to)|see also|"
    r"counterpart|drilldown|paired with|pair with)\b|\b[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}\b",
    re.I,
)


def sentence_around(text: str, index: int) -> str:
    """Return the sentence containing ``index`` so context guards can inspect it."""
    start = text.rfind(".", 0, index) + 1
    end = text.find(".", index)
    return text[start : end if end != -1 else len(text)]


def claim_is_about_this_search(text: str, match: re.Match) -> bool:
    """False when the matched shape word belongs to a negation or cross-reference."""
    sentence = sentence_around(text, match.start())
    if CROSS_REFERENCE.search(sentence):
        return False
    before = sentence[: match.start() - max(0, text.rfind(".", 0, match.start()) + 1)]
    return not NEGATION.search(before)


@dataclass
class Defect:
    stanza: str
    category: str
    defect: str
    field_name: str
    detail: str


@dataclass
class Report:
    defects: list[Defect] = field(default_factory=list)
    total: int = 0

    def add(self, stanza: Stanza, defect: str, field_name: str, detail: str) -> None:
        self.defects.append(
            Defect(
                stanza=stanza.name,
                category=stanza.fields.get("category", "(none)"),
                defect=defect,
                field_name=field_name,
                detail=detail,
            )
        )


def audit(stanzas: list[Stanza]) -> Report:
    report = Report(total=len(stanzas))

    for stanza in stanzas:
        spl = stanza.search
        if not spl.strip():
            report.add(stanza, "NO_SPL", "search", "stanza has no search field")
            continue

        shape = derive_shape(spl)
        aggregate = has_command_anywhere(spl, "stats") or has_command_anywhere(
            spl, "tstats"
        )
        sorted_ = has_command_anywhere(spl, "sort")
        single_value_viz = stanza.fields.get("default_viz", "").strip() in SINGLE_VALUE_VIZ

        prose = {name: plain_text(stanza.fields.get(name, "")) for name in PROSE_FIELDS}
        tight = {name: tight_text(stanza.fields.get(name, "")) for name in PROSE_FIELDS}

        for name, text in prose.items():
            if not text:
                continue

            # An undetermined shape cannot contradict anything.
            shape_field = name in SHAPE_CLAIM_FIELDS and shape.kind != "unknown"

            def shape_defect(pattern: re.Pattern, claimed: str, wrong_when: set[str]) -> None:
                if not shape_field or shape.kind not in wrong_when:
                    return
                match = pattern.search(text)
                if not match or not claim_is_about_this_search(text, match):
                    return
                report.add(
                    stanza,
                    f"SHAPE_{claimed}_VS_{shape.kind.upper()}",
                    name,
                    f'claims "{match.group(0).strip()}" but {shape.evidence}',
                )

            if single_value_viz:
                # The tile, not the row count, is what "single value" describes.
                pass
            else:
                shape_defect(
                    SINGLE_VALUE_CLAIM, "SINGLE", {"timeseries", "table", "events"}
                )

            shape_defect(TIMESERIES_CLAIM, "TIMESERIES", {"single_row", "table", "events"})
            shape_defect(TABLE_CLAIM, "TABLE", {"single_row", "timeseries"})

            if aggregate and not sorted_ and SORT_CLAIM.search(text):
                match = SORT_CLAIM.search(text)
                report.add(
                    stanza,
                    "STALE_SORT",
                    name,
                    f'claims "{match.group(0)}" but search has no sort',
                )

            match = SORT_SUBSTITUTION.search(text)
            if match:
                report.add(
                    stanza,
                    "ARTIFACT_SORT_SUBSTITUTION",
                    name,
                    f'mechanical sort rewrite: "{match.group(0)}"',
                )

            match = DOUBLE_PUNCT.search(tight[name])
            if match:
                snippet = tight[name][max(0, match.start() - 40) : match.end() + 25]
                report.add(
                    stanza,
                    "ARTIFACT_PUNCTUATION",
                    name,
                    f'damaged punctuation: "...{snippet}..."',
                )

            if (
                name != "related_info"
                and text[:1].islower()
                and not OPENS_WITH_CODE.match(stanza.fields.get(name, ""))
                and not opens_with_identifier(text)
            ):
                report.add(
                    stanza,
                    "ARTIFACT_SENTENCE_CASE",
                    name,
                    f'prose starts lowercase: "{text[:60]}..."',
                )

            for pattern in BOILERPLATE:
                match = pattern.search(text)
                if match:
                    report.add(
                        stanza, "BOILERPLATE", name, f'generated prose: "{match.group(0)}"'
                    )
                    break

            if EDIT_INSTRUCTION.search(text):
                match = EDIT_INSTRUCTION.search(text)
                report.add(
                    stanza, "EDIT_INSTRUCTION", name, f'leaked instruction: "{match.group(0)}"'
                )

        raw_related = stanza.fields.get("related_info", "")
        if raw_related.strip() and "href=" not in raw_related:
            report.add(
                stanza, "NO_DOC_LINKS", "related_info", "no <a href> documentation link"
            )

        for name in ("description", "explanation", "solution"):
            raw = stanza.fields.get(name, "")
            if raw.strip() and not HTML_TAG.search(raw):
                report.add(stanza, "NO_HTML", name, "prose has no HTML markup")

        created = stanza.fields.get("date_created", "")
        updated = stanza.fields.get("date_updated", "")
        if created and updated and updated < created:
            report.add(
                stanza,
                "DATE_INVERSION",
                "date_updated",
                f"date_updated {updated} precedes date_created {created}",
            )

    return report


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--source", default=str(SEARCHBASE))
    ap.add_argument("--defect", help="Show samples for one defect class")
    ap.add_argument("--samples", type=int, default=0, help="Sample rows to print")
    ap.add_argument("--json", help="Write the full finding list to this path")
    args = ap.parse_args()

    stanzas = parse_conf(Path(args.source))
    report = audit(stanzas)

    by_defect = collections.Counter(d.defect for d in report.defects)
    affected = collections.defaultdict(set)
    for d in report.defects:
        affected[d.defect].add(d.stanza)

    print(f"stanzas parsed: {report.total}")
    print(f"findings:       {len(report.defects)}\n")
    print(f"{'defect':<34}{'findings':>9}{'stanzas':>9}")
    print("-" * 52)
    for defect, count in by_defect.most_common():
        print(f"{defect:<34}{count:>9}{len(affected[defect]):>9}")

    clean = {s.name for s in stanzas} - {d.stanza for d in report.defects}
    print(f"\nstanzas with zero findings: {len(clean)} / {report.total}")

    if args.defect:
        rows = [d for d in report.defects if d.defect == args.defect]
        print(f"\n--- {args.defect}: {len(rows)} findings ---")
        for d in rows[: args.samples or 10]:
            print(f"  [{d.stanza}] {d.field_name}\n      {d.detail}")

    if args.json:
        Path(args.json).write_text(
            json.dumps([d.__dict__ for d in report.defects], indent=2)
        )
        print(f"\nwrote {args.json}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
