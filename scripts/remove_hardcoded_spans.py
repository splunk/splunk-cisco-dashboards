#!/usr/bin/env python3
"""
Strip hardcoded ``span=`` arguments from ``searchbase.conf`` so the
dashboard time selector can drive bucketing.

Why
---
Dashboard panels powered by these stanzas should adapt to whatever
range the user picks in the time selector. ``timechart`` already
auto-spans based on the dispatched time range — but only if you don't
override it. Three patterns slipped in over time that pin the bucket
size and break that behaviour:

1. ``| timechart span=Xh ...`` — the most common offender. Drop the
   ``span=Xh`` and let ``timechart`` choose ~250 buckets across the
   range like Splunk does by default.
2. ``| tstats ... BY _time span=Xh, ...`` — same problem at the
   accelerated-DM layer. The DM summary still buckets ``_time`` at
   the granularity it was built with; dropping ``span`` lets that
   bucketing flow through.
3. ``| bin _time span=Xh`` — used as a pre-stage for two-step
   aggregations (``bin → stats by _time, X → stats by _time``) where
   we can't trivially substitute a ``timechart``. We replace with
   ``bin _time bins=N`` so the bucket count is fixed and the bucket
   *width* adapts to the time range (the inverse of hardcoding span).

Exception case
~~~~~~~~~~~~~~
``[user_experience_concurrent_wireless_clients]`` (the capacity_pct
stanza) couples ``bin _time span=30m`` with a downstream ``head 48``
to mean "last 24 hours, half-hour buckets". With the rewrite we use
``bin _time bins=48`` so the panel always shows 48 buckets covering
whatever range the picker is set to — same shape, but time-selector
aware.

Usage
-----

::

    python3 scripts/remove_hardcoded_spans.py            # dry-run
    python3 scripts/remove_hardcoded_spans.py --apply    # rewrite in place
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List


SEARCHBASE_PATH = (
    Path(__file__).resolve().parent.parent
    / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

# ``bins=N`` target for adaptive bucketing. 200 mirrors the default
# ``timechart`` data-point count and keeps multi-pipeline joins
# aligned because both sides of a ``join _time`` see the same time
# range and produce identically-aligned buckets.
DEFAULT_BINS = 200


# ---------------------------------------------------------------------------
# Transformations
# ---------------------------------------------------------------------------


@dataclass
class Change:
    """A single rewrite, tagged for the audit log."""

    line_no: int
    before: str
    after: str
    rule: str  # which transformation produced it


@dataclass
class Rewriter:
    text: str
    bins: int = DEFAULT_BINS
    changes: List[Change] = field(default_factory=list)

    # --- Rule 1: ``timechart span=Xh`` → ``timechart``  ------------------
    # Only matches when ``span=`` immediately follows ``timechart``. We
    # capture the value so the audit log records what we removed; the
    # value itself is discarded. We don't touch ``timechart`` calls
    # that already lack a ``span=``.
    TIMECHART_SPAN = re.compile(
        r"(?P<head>\|\s*timechart)\s+span=(?P<span>[0-9]+[a-zA-Z]+)(?P<tail>\b)"
    )

    # --- Rule 2: ``BY _time span=Xh, ...`` → ``BY _time, ...``  ----------
    # tstats puts ``span=Xh`` immediately after ``_time`` in the BY
    # clause. We handle two physical forms:
    #
    #   BY _time span=1h, Test_Metrics.server.address
    #   BY Alerts.severity, _time span=1h
    #   BY Alerts.severity _time span=1h        (missing comma — preserve as-is)
    #
    # The regex anchors on ``_time`` so we don't accidentally strip a
    # ``span=`` from some other field's name.
    TSTATS_BY_TIME_SPAN = re.compile(
        r"(?P<head>\b_time)\s+span=(?P<span>[0-9]+[a-zA-Z]+)\b"
    )

    # --- Rule 3: ``bin _time span=Xh`` → ``bin _time bins=N``  -----------
    # The replacement count varies per call site so we use a callable.
    BIN_TIME_SPAN = re.compile(
        r"(?P<head>\|\s*bin\s+_time)\s+span=(?P<span>[0-9]+[a-zA-Z]+)\b"
    )

    # --- Rule 4: trailing ``span=Xh`` at end of a tstats BY clause  -------
    # ``tstats`` allows ``span=`` to appear *anywhere* in the BY list and
    # the value applies to ``_time`` bucketing. So we also need to catch
    # patterns like::
    #
    #     by _time, Test_Metrics.thousandeyes.test.name span=5m \
    #
    # where the ``span=`` token is at the end of the line rather than
    # adjacent to ``_time``. We run this rule LAST, after the bin and
    # timechart rules have already consumed their own span values, so
    # any remaining ``span=Xh\s*(\\|$)`` in the search body must be a
    # tstats trailing-span.
    TSTATS_BY_TRAILING_SPAN = re.compile(
        r"\s+span=(?P<span>[0-9]+[a-zA-Z]+)(?=\s*\\?\s*$)",
        re.MULTILINE,
    )

    # Stanzas that need a non-default ``bins=``. Keyed by stanza name;
    # value is the bucket count to use. Anything not in this map uses
    # ``DEFAULT_BINS``.
    SPECIAL_BINS = {
        # Guest client surge stanza couples ``bin _time span=30m`` with a
        # downstream ``sort -_time | head 48`` to mean "the latest 48
        # half-hour buckets". With ``bins=48`` the panel always shows
        # 48 buckets covering whatever time range the picker is set to
        # (and the ``head 48`` becomes a safe upper bound rather than
        # the bucket selector).
        "user_experience_guest_client_surge": 48,
    }

    def run(self) -> str:
        # We process stanza-by-stanza so we can vary ``bins=N`` for the
        # one capacity_pct exception. Splitting on ``^[`` keeps each
        # stanza intact.
        chunks = re.split(r"(?m)(?=^\[[^\]]+\]\s*$)", self.text)
        out_chunks: List[str] = []
        for chunk in chunks:
            stanza_match = re.match(r"^\[([^\]]+)\]", chunk)
            stanza_name = stanza_match.group(1) if stanza_match else ""
            bins_for_stanza = self.SPECIAL_BINS.get(stanza_name, self.bins)
            out_chunks.append(self._rewrite_chunk(chunk, bins_for_stanza))
        return "".join(out_chunks)

    def _rewrite_chunk(self, chunk: str, bins_n: int) -> str:
        """Apply all three rules to a single stanza body.

        Only the ``search = ...`` block is rewritten; description /
        explanation / related_info prose can quote the same SPL
        fragments verbatim (e.g. ``<code>bin _time span=30m</code>``)
        and we don't want those touched here — that's handled by a
        separate prose-update pass after the SPL transforms.

        We track per-line ``Change`` records so the audit log shows
        exactly which line in the file we touched.
        """
        # Locate the chunk's start line in the original file so the
        # per-line audit output references file-level line numbers.
        chunk_idx = self.text.find(chunk)
        chunk_line_no = self.text.count("\n", 0, chunk_idx) + 1

        # Carve the chunk into (head, search_block, tail) where
        # ``search_block`` is everything from ``search = `` through
        # the last ``\``-continued line. Only ``search_block`` gets
        # rewritten.
        lines = chunk.splitlines(keepends=True)
        search_start = None
        for i, line in enumerate(lines):
            if line.startswith("search = ") or line.startswith("search="):
                search_start = i
                break
        if search_start is None:
            return chunk
        search_end = search_start + 1
        while (
            search_end - 1 < len(lines)
            and lines[search_end - 1].rstrip("\n").endswith("\\")
            and search_end < len(lines)
        ):
            search_end += 1
        head = "".join(lines[:search_start])
        body = "".join(lines[search_start:search_end])
        tail = "".join(lines[search_end:])

        # Compute the file-level line number for the start of body
        # so the substitution callback can convert local offsets.
        body_line_no = chunk_line_no + chunk[: chunk.find(body)].count("\n")

        def line_for(m: re.Match, src: str) -> int:
            return body_line_no + src.count("\n", 0, m.start())

        # Rule ordering matters: ``bin _time span=`` must run BEFORE
        # ``BY _time span=`` so the latter doesn't swallow the bin
        # cases — both regexes share the ``_time span=`` suffix.
        def sub_bin(m: re.Match) -> str:
            self.changes.append(
                Change(
                    line_no=line_for(m, body),
                    before=m.group(0),
                    after=f"{m.group('head')} bins={bins_n}",
                    rule="bin_time_span",
                )
            )
            return f"{m.group('head')} bins={bins_n}"

        body = self.BIN_TIME_SPAN.sub(sub_bin, body)

        def sub_timechart(m: re.Match) -> str:
            self.changes.append(
                Change(
                    line_no=line_for(m, body),
                    before=m.group(0),
                    after=f"{m.group('head')}{m.group('tail')}",
                    rule="timechart_span",
                )
            )
            return f"{m.group('head')}{m.group('tail')}"

        body = self.TIMECHART_SPAN.sub(sub_timechart, body)

        def sub_tstats_by(m: re.Match) -> str:
            self.changes.append(
                Change(
                    line_no=line_for(m, body),
                    before=m.group(0),
                    after=m.group("head"),
                    rule="tstats_by_time_span",
                )
            )
            return m.group("head")

        body = self.TSTATS_BY_TIME_SPAN.sub(sub_tstats_by, body)

        def sub_tstats_trailing(m: re.Match) -> str:
            self.changes.append(
                Change(
                    line_no=line_for(m, body),
                    before=m.group(0),
                    after="",
                    rule="tstats_by_trailing_span",
                )
            )
            return ""

        body = self.TSTATS_BY_TRAILING_SPAN.sub(sub_tstats_trailing, body)

        return head + body + tail


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Rewrite searchbase.conf in place (default is dry-run).",
    )
    args = parser.parse_args()

    text = SEARCHBASE_PATH.read_text(encoding="utf-8")
    r = Rewriter(text=text)
    new_text = r.run()

    print(f"Total span= rewrites: {len(r.changes)}")
    by_rule: dict = {}
    for c in r.changes:
        by_rule[c.rule] = by_rule.get(c.rule, 0) + 1
    for rule, count in sorted(by_rule.items()):
        print(f"  {rule}: {count}")

    # Print every change so the diff is reviewable before --apply.
    print("\n--- per-line changes ---")
    for c in r.changes:
        print(f"line {c.line_no:>6}  [{c.rule}]")
        print(f"  - {c.before!r}")
        print(f"  + {c.after!r}")

    if args.apply:
        SEARCHBASE_PATH.write_text(new_text, encoding="utf-8")
        print(f"\n✓ Wrote {SEARCHBASE_PATH}")
    else:
        print("\n(dry-run; pass --apply to write changes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
