#!/usr/bin/env python3
"""
Discover the real field set for every sourcetype referenced in
``searchbase.conf`` and (optionally) audit our SPL against that ground
truth so imagined / typo'd fields surface as actionable findings.

Two phases, controlled by CLI flags:

1. **Discovery** (default): for each unique sourcetype in
   ``searchbase.conf``, dispatch the field-discovery search below
   and write the results to ``sourcetype_field_inventory.{json,md}``.

   .. code-block:: text

       search index=* sourcetype="<st>" earliest=-7d latest=now
           | head <sample_rows>
           | `field_list`

   The ``field_list`` macro (defined in ``macros.conf``) returns a
   single row with a ``Fields_List`` column - a sorted, comma-separated
   list of discovered field names.

2. **Audit** (``--audit`` or ``--audit-only``): re-parse
   ``searchbase.conf``, walk every stanza's SPL, and flag field
   references that are not present in the discovered field set for
   the stanza's sourcetype(s). Heuristic but conservative: only the
   highest-signal SPL anchors are inspected (``stats <fn>(<f>)``,
   ``... by <f>, <f>``, ``rename <f> as ...``, ``dedup <f>...``),
   and Splunk built-ins, ``field_list``-suppressed fields, and
   pipeline-synthesized fields (``eval``, ``rename ... as``, ``stats
   ... as``) are filtered out before reporting.

Output files:

* ``scripts/sourcetype_field_inventory.json`` - machine-readable
  inventory; produced by phase 1.
* ``scripts/sourcetype_field_inventory.md`` - human-readable inventory.
* ``scripts/sourcetype_audit_findings.md`` - actionable per-stanza
  audit findings; produced by phase 2.

Environment variables (same as the existing ``validate_searchbase_*``
scripts):

* ``SPLUNK_BASE_URL`` (default ``https://localhost:8089``)
* ``SPLUNK_USERNAME`` (required for discovery; ignored in ``--audit-only``)
* ``SPLUNK_PASSWORD`` (required for discovery; ignored in ``--audit-only``)
* ``SPLUNK_OWNER`` (default ``admin``)
* ``SPLUNK_APP`` (default ``splunk-cisco-dashboards``)
* ``SPLUNK_VERIFY_SSL`` (default ``false``)

Common usage::

    # 1. Discover fields and audit SPL in one run (most common):
    SPLUNK_USERNAME=codex SPLUNK_PASSWORD=changeme \\
    python3 scripts/audit_sourcetype_fields.py --audit

    # 2. Re-audit using cached inventory (no Splunk required):
    python3 scripts/audit_sourcetype_fields.py --audit-only

    # 3. Discover only (legacy default behavior):
    SPLUNK_USERNAME=codex SPLUNK_PASSWORD=changeme \\
    python3 scripts/audit_sourcetype_fields.py
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from threading import Lock
from typing import Optional
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

# Reuse the parsing + REST helpers from the existing validate scripts so
# we have one source of truth for searchbase parsing and oneshot dispatch.
from audit_searchbase_quality import SEARCHBASE, parse_conf  # noqa: E402
from validate_searchbase_live import (  # noqa: E402
    describe_http_error,
    post_oneshot,
)

# Output paths
INVENTORY_JSON = SCRIPTS_DIR / "sourcetype_field_inventory.json"
INVENTORY_MD = SCRIPTS_DIR / "sourcetype_field_inventory.md"

# Sourcetype extraction patterns - matches both ``sourcetype="cisco:..."``
# and bare ``sourcetype=cisco:...`` (no quotes).  Wildcards are filtered
# out at use-time since ``cisco:*`` etc. cannot be queried directly.
RE_SOURCETYPE_QUOTED = re.compile(r'sourcetype\s*=\s*"([^"*][^"]*)"')
RE_SOURCETYPE_BARE = re.compile(r"sourcetype\s*=\s*([A-Za-z][\w:.\-]+)")


@dataclass
class StanzaRef:
    """A reference of a sourcetype to the stanza using it (for the leaderboard)."""

    stanza: str
    line_no: int


@dataclass
class DiscoveryResult:
    """One sourcetype's discovery outcome."""

    sourcetype: str
    fields: list[str] = field(default_factory=list)
    row_count: int = 0
    elapsed_ms: int = 0
    status: str = "pending"  # pass | empty | fail | skipped
    note: str = ""


# ---------------------------------------------------------------------------
# Step 1: enumerate sourcetypes from searchbase.conf
# ---------------------------------------------------------------------------

def collect_sourcetypes() -> tuple[dict[str, list[StanzaRef]], list]:
    """Return ``(sourcetype -> [stanza_refs], all_stanzas)``.

    Wildcard sourcetypes (``cisco:*``) are skipped: ``oneshot`` can't
    expand them, and they're typically just constraint filters.
    """
    stanzas = parse_conf(SEARCHBASE)
    refs: dict[str, list[StanzaRef]] = {}
    for st_obj in stanzas:
        spl = (st_obj.search or "").strip()
        if not spl:
            continue
        sts = set(RE_SOURCETYPE_QUOTED.findall(spl))
        # Bare matches that overlap with quoted matches need filtering
        # so we don't double-count.  We only add bare matches that
        # don't appear inside any quoted region.
        for m in RE_SOURCETYPE_BARE.finditer(spl):
            value = m.group(1)
            # Skip wildcards and anything that already came in via the
            # quoted regex.
            if "*" in value or value in sts:
                continue
            sts.add(value)
        for st in sts:
            if "*" in st:
                continue
            refs.setdefault(st, []).append(
                StanzaRef(stanza=st_obj.name, line_no=st_obj.line_start)
            )
    return refs, stanzas


# ---------------------------------------------------------------------------
# Step 2: discover fields per sourcetype via Splunk oneshot
# ---------------------------------------------------------------------------

def build_discovery_spl(
    sourcetype: str, sample_rows: int, index: str = "*"
) -> str:
    """Build the field-discovery SPL for one sourcetype.

    We pin the leading ``search`` keyword explicitly because some
    parsers reject SPL that starts with ``index=`` without it; the
    oneshot endpoint normalizes either form but explicit is safer.

    ``index`` defaults to ``*`` (search every index) which is the
    safe / portable choice. Pass a concrete index (e.g. ``dnac``)
    when you want to validate field structure on a specific index
    without picking up shape drift from oneshot imports / other
    feeds.
    """
    return (
        f'search index={index} sourcetype="{sourcetype}" '
        f"| head {sample_rows} | `field_list`"
    )


def parse_field_list_result(rows: list[dict]) -> list[str]:
    """Pull the comma-separated field list out of a ``field_list`` result.

    ``field_list`` macro returns one row with a ``Fields_List`` column.
    Older / customised installs may use a different column name, so we
    fall back to the longest string-valued column when the obvious key
    isn't present.
    """
    if not rows:
        return []
    first = rows[0] or {}
    raw = first.get("Fields_List") or first.get("fields") or first.get("Fields")
    if raw is None:
        # Fallback: pick the longest string column.  field_list is
        # idempotent enough that any column it emits will be a
        # comma-joined list, but defensive parsing avoids silent empties.
        candidates = [
            (k, v)
            for k, v in first.items()
            if isinstance(v, str) and "," in v
        ]
        if not candidates:
            return []
        candidates.sort(key=lambda pair: -len(pair[1]))
        raw = candidates[0][1]
    if not isinstance(raw, str):
        return []
    return sorted({p.strip() for p in raw.split(",") if p.strip()})


def discover_one(
    sourcetype: str,
    env: dict,
    earliest: str,
    latest: str,
    sample_rows: int,
    timeout: int,
    index: str = "*",
) -> DiscoveryResult:
    spl = build_discovery_spl(sourcetype, sample_rows, index=index)
    started = time.monotonic()
    try:
        messages, rows = post_oneshot(
            env["base_url"],
            env["owner"],
            env["app"],
            env["username"],
            env["password"],
            spl,
            earliest,
            latest,
            timeout,
            env["verify_ssl"],
        )
        elapsed_ms = int((time.monotonic() - started) * 1000)
        bad = [m for m in messages if m.get("type") in {"ERROR", "FATAL"}]
        if bad:
            return DiscoveryResult(
                sourcetype=sourcetype,
                elapsed_ms=elapsed_ms,
                status="fail",
                note="; ".join(m.get("text", "") for m in bad)[:400],
            )
        if not rows:
            return DiscoveryResult(
                sourcetype=sourcetype,
                elapsed_ms=elapsed_ms,
                status="empty",
                note=f"no events in {earliest}..{latest}",
            )
        fields = parse_field_list_result(rows)
        # ``field_list`` always returns 1 row (the summary row); the
        # underlying event count we sampled is bounded by the ``head``
        # value and isn't returned to us.  We surface the macro row
        # count so the human reader can spot pathological cases.
        return DiscoveryResult(
            sourcetype=sourcetype,
            fields=fields,
            row_count=len(rows),
            elapsed_ms=elapsed_ms,
            status="pass" if fields else "empty",
            note="" if fields else "field_list returned no field names",
        )
    except HTTPError as exc:
        return DiscoveryResult(
            sourcetype=sourcetype,
            elapsed_ms=int((time.monotonic() - started) * 1000),
            status="fail",
            note=describe_http_error(exc)[:400],
        )
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        return DiscoveryResult(
            sourcetype=sourcetype,
            elapsed_ms=int((time.monotonic() - started) * 1000),
            status="fail",
            note=str(exc)[:400],
        )


# ---------------------------------------------------------------------------
# Step 3: write JSON + Markdown reports
# ---------------------------------------------------------------------------

def write_json(
    results: dict[str, DiscoveryResult],
    refs: dict[str, list[StanzaRef]],
    earliest: str,
    latest: str,
    sample_rows: int,
    index: str = "*",
) -> None:
    payload = {
        "discovery": {
            "earliest": earliest,
            "latest": latest,
            "sample_rows": sample_rows,
            "index": index,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        },
        "sourcetypes": {},
    }
    for st in sorted(results):
        r = results[st]
        payload["sourcetypes"][st] = {
            "status": r.status,
            "fields": r.fields,
            "row_count": r.row_count,
            "elapsed_ms": r.elapsed_ms,
            "note": r.note,
            "stanza_count": len(refs.get(st, [])),
            "stanzas": [
                {"name": ref.stanza, "line_no": ref.line_no}
                for ref in refs.get(st, [])
            ],
        }
    INVENTORY_JSON.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")


def write_markdown(
    results: dict[str, DiscoveryResult],
    refs: dict[str, list[StanzaRef]],
    earliest: str,
    latest: str,
    sample_rows: int,
) -> None:
    out: list[str] = []
    out.append("# Sourcetype Field Inventory")
    out.append("")
    out.append(
        f"**Generated:** `{time.strftime('%Y-%m-%dT%H:%M:%S%z')}`  "
        f"**Window:** `{earliest}` → `{latest}`  "
        f"**Sample:** `head {sample_rows}` per sourcetype"
    )
    out.append("")
    out.append(
        "Authoritative field set for every sourcetype referenced in "
        "`searchbase.conf`, discovered live via Splunk's `field_list` "
        "macro. Use this as ground truth when reviewing SPL — any "
        "field referenced by a stanza that isn't in the matching "
        "sourcetype's table below is suspect."
    )
    out.append("")

    # ---- Summary table ----
    by_status: dict[str, int] = {}
    for r in results.values():
        by_status[r.status] = by_status.get(r.status, 0) + 1
    out.append("## Summary")
    out.append("")
    out.append("| Status | Count | Meaning |")
    out.append("|---|---:|---|")
    out.append(
        f"| `pass`    | {by_status.get('pass', 0):>3} | Returned at least one field. |"
    )
    out.append(
        f"| `empty`   | {by_status.get('empty', 0):>3} | Sourcetype has no events in the time window. |"
    )
    out.append(
        f"| `fail`    | {by_status.get('fail', 0):>3} | Search errored — see note. |"
    )
    out.append(
        f"| `skipped` | {by_status.get('skipped', 0):>3} | Excluded by filter. |"
    )
    out.append("")

    # ---- Leaderboard: sourcetypes most referenced ----
    out.append("## Sourcetypes by Stanza Count")
    out.append("")
    out.append("| Sourcetype | Stanzas | Status | Field Count |")
    out.append("|---|---:|---|---:|")
    leaderboard = sorted(
        results.items(),
        key=lambda kv: (-len(refs.get(kv[0], [])), kv[0]),
    )
    for st, r in leaderboard:
        n_stanzas = len(refs.get(st, []))
        out.append(
            f"| `{st}` | {n_stanzas} | `{r.status}` | {len(r.fields)} |"
        )
    out.append("")

    # ---- Per-sourcetype detail ----
    out.append("## Per-Sourcetype Field Lists")
    out.append("")
    for st in sorted(results):
        r = results[st]
        n_stanzas = len(refs.get(st, []))
        out.append(f"### `{st}`")
        out.append("")
        out.append(
            f"- **Status:** `{r.status}`  "
            f"**Field count:** {len(r.fields)}  "
            f"**Stanzas referencing:** {n_stanzas}  "
            f"**Latency:** {r.elapsed_ms} ms"
        )
        if r.note:
            out.append(f"- **Note:** {r.note}")
        if r.fields:
            out.append("")
            out.append("**Discovered fields**")
            out.append("")
            # Render as a single fenced block so wide field names don't
            # break Markdown table rendering.
            out.append("```")
            # Group fields three-per-line for readability when there
            # are dozens.
            chunks = [r.fields[i : i + 3] for i in range(0, len(r.fields), 3)]
            for chunk in chunks:
                out.append(", ".join(chunk))
            out.append("```")
        if n_stanzas:
            out.append("")
            out.append("**Stanzas using this sourcetype**")
            out.append("")
            for ref in sorted(refs[st], key=lambda x: x.stanza):
                out.append(f"- `[{ref.stanza}]` (line {ref.line_no})")
        out.append("")

    INVENTORY_MD.write_text("\n".join(out) + "\n")


# ---------------------------------------------------------------------------
# Step 3.5: SPL audit against the discovered inventory
# ---------------------------------------------------------------------------
#
# Heuristics for surfacing real field bugs without drowning in noise.
# We deliberately only look at the highest-signal SPL anchors:
#
#   * ``stats|eventstats|streamstats <fn>(<field>) [as <alias>]``
#   * ``... by <field>, <field>, ...`` (after a stats / chart command)
#   * ``rename <oldfield> as <newfield>``
#   * ``dedup <field> <field> ...``
#
# Inside ``eval`` and ``where`` expressions we do not attempt to extract
# field references - the grammar is rich enough that a regex either
# overshoots (catches function names, eval target names, literals) or
# undershoots (misses dotted JSON paths). Skipping them keeps the
# false-positive rate low; we still catch the highest-impact bugs because
# the authoring patterns above are how the vast majority of stanzas
# reference fields.
#
# Synthesized fields (added by the SPL itself: eval target, rename target,
# ``stats ... as alias``) are tracked across the whole stanza and removed
# from the suspect set so we do not flag them as missing.
#
# Sourcetypes that came back empty / errored in the inventory are skipped
# entirely - we cannot know what fields they emit, so we cannot judge.

INVENTORY_FILTERED_FIELDS = {
    # Fields removed by the ``field_list`` macro itself - they are real,
    # they are just hidden from the discovery output, so SPL referencing
    # them is fine.
    "host",
    "source",
    "sourcetype",
    "index",
    "eventtype",
    "linecount",
    "punct",
    "splunk_server",
    "timestartpos",
    "timeendpos",
}

SPLUNK_BUILTINS = {
    # Always-present internal fields plus the date_* family stripped by
    # the field_list macro.
    "_time",
    "_raw",
    "_indextime",
    "_subsecond",
    "_serial",
    "_cd",
    "_eventtype_color",
    "_kv",
    "_meta",
    "_sourcetype",
    "tag",
    "tag::eventtype",
    "tag::host",
    "tag::source",
    "tag::sourcetype",
    "date_hour",
    "date_mday",
    "date_minute",
    "date_month",
    "date_second",
    "date_wday",
    "date_year",
    "date_zone",
    # ``count`` (and ``c``) is sometimes both an aggregate and a synthetic
    # alias; treating it as built-in avoids false positives where stats
    # produces a column named ``count`` and a later ``where count > 0``
    # passes through the heuristic.
    "count",
}

# CIM data models surface in SPL as ``<Model>.<field>`` references.
# Validating those needs a data-model acceleration query, which is out
# of scope here, so we recognize the prefix and skip the reference.
CIM_DATA_MODELS = {
    "All_Traffic",
    "Authentication",
    "Web",
    "Email",
    "Endpoint",
    "Network_Resolution",
    "Network_Sessions",
    "Vulnerabilities",
    "Intrusion_Detection",
    "Malware",
    "Updates",
    "DLP",
    "Performance",
    "Inventory",
    "Change_Analysis",
    "Change",
    "Alerts",
    "Certificates",
    "Compute_Inventory",
}

# Standard CIM field aliases populated at search-time by TA
# ``props.conf`` field aliases. The discovery search sees the raw event
# fields (the ones that get aliased *from*) but not these aliases, so
# every dashboard that consumes them shows up as a false positive
# unless we explicitly allow-list them.
CIM_ALIASES = {
    # Network_Traffic
    "src",
    "dest",
    "src_ip",
    "dest_ip",
    "src_port",
    "dest_port",
    "src_translated_ip",
    "dest_translated_ip",
    "src_translated_port",
    "dest_translated_port",
    "bytes",
    "bytes_in",
    "bytes_out",
    "packets",
    "packets_in",
    "packets_out",
    "protocol",
    "transport",
    "duration",
    "rule",
    "vendor_product",
    "vendor_action",
    # Authentication
    "user",
    "user_id",
    "src_user",
    "dest_user",
    # Web
    "url",
    "uri",
    "uri_path",
    "uri_query",
    "http_method",
    "status",
    "site",
    "http_user_agent",
    "category",
    "action",
    # Endpoint / IDS / Malware
    "signature",
    "signature_id",
    "severity",
    "severity_id",
    "process",
    "process_name",
    "file_name",
    "file_path",
    # Geo (added by iplocation or geo-aliasing TAs)
    "Country",
    "City",
    "Region",
    "lat",
    "lon",
    "Continent",
}


def _is_cim_data_model_field(name: str) -> bool:
    """Detect ``<DataModel>.<rest>`` references."""
    if "." not in name:
        return False
    prefix = name.split(".", 1)[0]
    return prefix in CIM_DATA_MODELS

# Tokens that look like field names in `by`/`fields`/`table` lists but are
# actually SPL keywords or operators. Filter them out.
SPL_KEYWORD_NOISE = {
    "as",
    "by",
    "and",
    "or",
    "not",
    "in",
    "case",
    "if",
    "where",
    "true",
    "false",
    "null",
    "asc",
    "desc",
    "limit",
}

# A field token must look like one of these to be considered a candidate
# for the audit. Allows dotted JSON paths (``foo.bar``) and ``{}`` array
# notation (``categories{}``) plus standard identifiers.
RE_FIELD_TOKEN = re.compile(r"^[A-Za-z_][\w.]*(?:\{\})?$")

# ``stats|eventstats|streamstats|chart|timechart`` follow the pattern
#   <cmd> [<options>] <fn>(<field>) [as <alias>], <fn>(<field>) ...
#   [by <field>, <field>, ...]
# and we want both halves. The regex below tolerates inline newline
# escapes (``\\\n``) by running on the entire SPL string with all
# continuations flattened.
RE_STATS_FN_CALL = re.compile(
    r"\b(?:stats|eventstats|streamstats|chart|timechart|tstats)\b[^|]*",
    re.I,
)
RE_FN_FIELD = re.compile(
    r"\b(?:dc|distinct_count|estdc|count|c|sum|avg|mean|median|min|max|"
    r"range|stdev|stdevp|var|varp|latest|earliest|first|last|values|list|"
    r"perc\d+|exactperc\d+|upperperc\d+|p\d+)\s*\(\s*([A-Za-z_][\w.]*(?:\{\})?)\s*\)",
    re.I,
)
RE_BY_LIST = re.compile(
    r"\bby\s+((?:[A-Za-z_][\w.]*(?:\{\})?)(?:\s*,\s*[A-Za-z_][\w.]*(?:\{\})?)*)\s*(?:\||$)",
    re.I,
)
RE_RENAME = re.compile(
    r"\brename\s+([A-Za-z_][\w.]*(?:\{\})?)\s+as\s+([A-Za-z_][\w.]*)",
    re.I,
)
# Multi-rename with chained ``a as b, c as d`` and/or quoted source
# fields like ``"network.siteId" as siteId``. Captures every (old, new)
# pair within a single rename clause.
RE_RENAME_PAIR = re.compile(
    r'(?:"([^"]+)"|([A-Za-z_][\w.]*(?:\{\})?))\s+as\s+([A-Za-z_][\w.]*(?:\{\})?)',
    re.I,
)
RE_DEDUP = re.compile(
    r"\bdedup\s+(?:\d+\s+)?((?:[A-Za-z_][\w.]*(?:\{\})?)(?:\s+[A-Za-z_][\w.]*(?:\{\})?)*)",
    re.I,
)
RE_STATS_AS = re.compile(
    r"\)\s+as\s+([A-Za-z_][\w.]*)",
    re.I,
)
RE_EVAL_LHS = re.compile(
    r"\beval\s+([A-Za-z_][\w.]*(?:\{\})?)\s*=",
    re.I,
)
# An ``eval`` clause can chain assignments with commas:
#   eval foo=expr, bar=expr2, baz=expr3
# The simple LHS regex only catches the first one. To catch the rest we
# walk each eval clause character-by-character, ignoring commas inside
# parens or string literals, and pull every top-level ``<id>=`` LHS.
#
# Note: we intentionally don't use a regex to find the eval clause
# *boundary* either - SPL embeds regex strings like ``match(x,"(?i)a|b|c")``
# whose literal ``|`` characters would prematurely terminate a regex
# search. Instead, ``_iter_eval_clauses`` does a string-literal-aware
# character walk to find each real pipe boundary.
RE_EVAL_TOKEN = re.compile(r"\beval\b", re.I)
RE_EVAL_LHS_TOP = re.compile(r"\s*([A-Za-z_][\w.]*(?:\{\})?)\s*=(?!=)")
# ``lookup <table> [<in> AS <local_in>] [OUTPUT|OUTPUTNEW <out>[ AS <local_out>], ...]``
# We capture every identifier *after* an ``OUTPUT[NEW]`` keyword as a
# synthesized name (worst case it adds a noise allow but never a false
# negative). Simple split-on-comma + split-on-AS afterwards.
RE_LOOKUP_OUTPUT = re.compile(
    r"\b(?:OUTPUT|OUTPUTNEW)\b(.*?)(?=\||\bOUTPUT\b|\bOUTPUTNEW\b|$)",
    re.I | re.S,
)
# ``rex field=foo "(?<bar>...)"`` and similar named-capture patterns
# produce field ``bar``. Same idea for ``extract``: any ``(?<name>`` is
# a new field. We also capture the explicit ``field=foo`` so the source
# field is treated as a reference (caught by other regexes already).
RE_REX_NAMED = re.compile(r"\(\?P?<([A-Za-z_][\w]*)>")
# ``rename foo.* as bar.*`` style wildcard rename - just allow-list both
# halves so we never falsely flag them.
RE_RENAME_WILD = re.compile(
    r"\brename\s+([A-Za-z_][\w.*]*)\s+as\s+([A-Za-z_][\w.*]*)",
    re.I,
)


@dataclass
class AuditFinding:
    """One stanza's audit verdict (only built when there is something to flag)."""

    stanza: str
    line_no: int
    sourcetypes: list[str]
    suspicious_fields: list[str]
    referenced: list[str]
    synthesized: list[str]
    confidence: str = "high"  # high | partial
    missing_inventory: list[str] = field(default_factory=list)


def _flatten_spl(spl: str) -> str:
    """Collapse line continuations (``\\\\\\n`` and ``\\\\``) so regexes can run flat."""
    return re.sub(r"\\\s*\n\s*", " ", spl).replace("\\", " ")


def _iter_eval_clauses(spl: str) -> list[str]:
    """Find each ``eval`` clause's body in ``spl`` and return the substrings.

    Splunk SPL command boundaries are pipe characters, but a literal
    ``|`` may appear inside a string literal (e.g. ``match(x,"a|b|c")``)
    which a naive regex would mistake for a boundary. This walker tracks
    paren depth and string-literal state so the captured clause body is
    the *whole* eval expression up to the real next pipe.
    """
    out: list[str] = []
    n = len(spl)
    for token in RE_EVAL_TOKEN.finditer(spl):
        # Body starts immediately after the matched ``eval`` keyword.
        i = token.end()
        # Walk until we hit a real top-level pipe, end-of-string, or the
        # start of another command keyword that signals the eval clause
        # is over.
        depth = 0
        in_str: str | None = None
        start = i
        while i < n:
            c = spl[i]
            if in_str is not None:
                if c == "\\" and i + 1 < n:
                    i += 2
                    continue
                if c == in_str:
                    in_str = None
                i += 1
                continue
            if c in "\"'":
                in_str = c
                i += 1
                continue
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
            elif c == "|" and depth == 0:
                break
            i += 1
        out.append(spl[start:i])
    return out


def _eval_clause_lhs(clause: str) -> list[str]:
    """Extract every top-level ``<id>=`` LHS from a single eval clause.

    Walks the clause character-by-character, tracking paren depth and
    string-literal depth so that commas inside ``if(a,b,c)`` or string
    literals don't fool us. Catches chained assignments like
    ``eval foo=expr, bar=expr2, baz=expr3`` which the simple
    one-shot regex misses.
    """
    out: list[str] = []
    depth = 0
    in_str: str | None = None
    i = 0
    n = len(clause)
    # The clause naturally starts at the first char after ``eval``;
    # consume whitespace then try the first LHS, then walk forward
    # looking for top-level commas to start the next LHS.
    expecting_lhs = True
    while i < n:
        if expecting_lhs and depth == 0 and in_str is None:
            m = RE_EVAL_LHS_TOP.match(clause, i)
            if m:
                out.append(m.group(1))
                i = m.end()
                expecting_lhs = False
                continue
        c = clause[i]
        if in_str is not None:
            if c == "\\" and i + 1 < n:
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in "\"'":
            in_str = c
            i += 1
            continue
        if c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
        elif c == "," and depth == 0:
            expecting_lhs = True
        i += 1
    return out


RE_RENAME_CLAUSE = re.compile(r"\brename\b(.+?)(?=\||$)", re.I | re.S)


def _extract_synthesized(spl: str) -> set[str]:
    """Fields the SPL itself creates (eval target, rename-as, stats-as,
    lookup OUTPUT, rex named captures).

    Heuristic and intentionally over-inclusive on ``lookup`` to avoid
    flagging joined fields - the cost is letting through a real typo
    inside a ``lookup`` clause, which is rare. Worth it.
    """
    out: set[str] = set()
    # Use the string-aware clause walker so we catch chained
    # ``a=..,b=..,c=..`` *and* don't get tripped by a literal ``|`` that
    # appears inside a regex argument like ``match(x,"a|b|c")``.
    for clause in _iter_eval_clauses(spl):
        for name in _eval_clause_lhs(clause):
            out.add(name)
    for m in RE_STATS_AS.finditer(spl):
        out.add(m.group(1))
    # Rename clauses can chain: ``rename a as b, "c.d" as e, f as g``.
    # The single-pair regex misses the second/third pair and the quoted
    # source variant. We walk each clause and pull every ``... as <new>``
    # target.
    for cm in RE_RENAME_CLAUSE.finditer(spl):
        for pm in RE_RENAME_PAIR.finditer(cm.group(1)):
            out.add(pm.group(3))
    for m in RE_REX_NAMED.finditer(spl):
        out.add(m.group(1))
    # Any token after ``OUTPUT`` / ``OUTPUTNEW`` and inside the lookup
    # clause is treated as synthesized. We split on commas, then on ``AS``
    # to keep the local alias.
    for m in RE_LOOKUP_OUTPUT.finditer(spl):
        clause = m.group(1)
        # Pause at the first pipe so we don't run into the next command.
        clause = clause.split("|", 1)[0]
        for part in clause.split(","):
            part = part.strip()
            if not part:
                continue
            # Each part is "out_field" or "out_field AS local_field".
            tokens = re.split(r"\bAS\b", part, flags=re.I)
            for t in tokens:
                t = t.strip()
                if t and RE_FIELD_TOKEN.match(t):
                    out.add(t)
    return out


def _extract_referenced(spl: str) -> set[str]:
    """Fields the SPL clearly references in high-signal positions."""
    out: set[str] = set()
    for m in RE_FN_FIELD.finditer(spl):
        out.add(m.group(1))
    for m in RE_BY_LIST.finditer(spl):
        for tok in re.split(r"\s*,\s*", m.group(1)):
            tok = tok.strip()
            if tok:
                out.add(tok)
    # Walk every rename clause and capture the source side (group 1 is
    # the quoted variant, group 2 is the bare variant - whichever is
    # populated). Multi-pair and quoted-dotted-name forms both work.
    for cm in RE_RENAME_CLAUSE.finditer(spl):
        for pm in RE_RENAME_PAIR.finditer(cm.group(1)):
            old = pm.group(1) or pm.group(2)
            if old:
                out.add(old)
    for m in RE_DEDUP.finditer(spl):
        for tok in m.group(1).split():
            tok = tok.strip()
            if tok and RE_FIELD_TOKEN.match(tok):
                out.add(tok)
    return out


def audit_stanzas_against_inventory(
    stanzas: list,
    inventory: dict,
    extra_allow: set[str] | None = None,
) -> tuple[list[AuditFinding], dict[str, int]]:
    """Audit every stanza against the discovered field inventory.

    Returns ``(findings, stats)`` where ``stats`` summarizes how many
    stanzas were inspected, skipped, and flagged.
    """
    extra = set(extra_allow or set())
    sourcetypes_meta = inventory.get("sourcetypes", {})
    findings: list[AuditFinding] = []
    skipped_no_st = 0
    skipped_no_inventory = 0
    skipped_makeresults = 0
    inspected = 0

    # Pre-compile a per-sourcetype field set lookup
    fields_for: dict[str, set[str]] = {
        st: set(meta.get("fields", []))
        for st, meta in sourcetypes_meta.items()
        if meta.get("status") == "pass"
    }

    for stanza in stanzas:
        spl_raw = (stanza.search or "").strip()
        if not spl_raw:
            continue
        spl_flat = _flatten_spl(spl_raw)
        # Skip pure synthetic stanzas (``| makeresults`` based) - they
        # don't query a sourcetype, so the audit cannot say anything.
        if re.search(r"\|\s*makeresults\b", spl_flat[:200], re.I) and not re.search(
            r"\bsourcetype\s*=", spl_flat, re.I
        ):
            skipped_makeresults += 1
            continue
        # Sourcetypes referenced by this stanza (dropping wildcards).
        sts: set[str] = set()
        sts.update(RE_SOURCETYPE_QUOTED.findall(spl_flat))
        for m in RE_SOURCETYPE_BARE.finditer(spl_flat):
            v = m.group(1)
            if "*" not in v:
                sts.add(v)
        sts = {s for s in sts if "*" not in s}
        if not sts:
            skipped_no_st += 1
            continue
        # Union of discovered fields across all referenced sourcetypes.
        # If none of the sourcetypes have inventory data, we have nothing
        # to compare against - skip rather than flag everything.
        usable = [s for s in sts if s in fields_for]
        if not usable:
            skipped_no_inventory += 1
            continue
        union: set[str] = set()
        for s in usable:
            union.update(fields_for[s])
        union.update(INVENTORY_FILTERED_FIELDS)
        union.update(SPLUNK_BUILTINS)
        union.update(CIM_ALIASES)
        union.update(extra)
        # Note: synthesized fields can shadow real fields, but for the
        # audit we treat any synthesized name as valid (otherwise an
        # ``eval site = ...`` followed by ``stats by site`` would flag
        # ``site`` even though the eval is the source). This is the right
        # call - if the SPL builds the field itself, it doesn't matter
        # whether the sourcetype provides one.
        synthesized = _extract_synthesized(spl_flat)
        union.update(synthesized)
        referenced = _extract_referenced(spl_flat)
        # Drop noise: SPL keywords that snuck through, single-letter
        # variables, any reference identical to a sourcetype name
        # (a quoted sourcetype filter can sometimes leak through), and
        # CIM data model field references like ``All_Traffic.dvc`` that
        # we cannot validate without an acceleration query.
        referenced = {
            f
            for f in referenced
            if f.lower() not in SPL_KEYWORD_NOISE
            and len(f) > 1
            and not _is_cim_data_model_field(f)
        }
        suspect = sorted(referenced - union)
        inspected += 1
        # If any of the stanza's sourcetypes returned empty/fail in
        # the inventory, the comparison set is partial - one of those
        # missing sourcetypes might emit the flagged field. Tag the
        # finding accordingly so the markdown can split high-confidence
        # findings (real bugs to fix) from partial-confidence ones
        # (need a stack with the missing data to verify).
        missing_inv = sorted(s for s in sts if s not in fields_for)
        if suspect:
            findings.append(
                AuditFinding(
                    stanza=stanza.name,
                    line_no=stanza.line_start,
                    sourcetypes=sorted(sts),
                    suspicious_fields=suspect,
                    referenced=sorted(referenced),
                    synthesized=sorted(synthesized),
                    confidence="partial" if missing_inv else "high",
                    missing_inventory=missing_inv,
                )
            )

    stats = {
        "inspected": inspected,
        "skipped_no_sourcetype": skipped_no_st,
        "skipped_makeresults": skipped_makeresults,
        "skipped_no_inventory_data": skipped_no_inventory,
        "flagged": len(findings),
    }
    return findings, stats


AUDIT_FINDINGS_MD = SCRIPTS_DIR / "sourcetype_audit_findings.md"


def write_audit_findings(
    findings: list[AuditFinding],
    stats: dict[str, int],
    inventory: dict,
    extra_allow: set[str],
) -> None:
    out: list[str] = []
    out.append("# Sourcetype SPL Audit")
    out.append("")
    out.append(
        f"**Generated:** `{time.strftime('%Y-%m-%dT%H:%M:%S%z')}`  "
        f"**Inventory window:** `{inventory.get('discovery', {}).get('earliest', '?')}` "
        f"&rarr; `{inventory.get('discovery', {}).get('latest', '?')}`  "
        f"**Inventory generated:** `{inventory.get('discovery', {}).get('generated_at', '?')}`"
    )
    out.append("")
    out.append(
        "Per-stanza audit of `searchbase.conf` against the discovered "
        "field inventory in `sourcetype_field_inventory.json`. A finding "
        "means the stanza references a field that is **not** in the "
        "discovered field set for any of its sourcetypes, **and** is "
        "not a Splunk built-in, a `field_list`-suppressed field, a "
        "well-known CIM alias, or synthesized earlier in the same SPL "
        "(`eval`, `rename ... as`, `stats ... as`, `lookup ... OUTPUT`, "
        "`rex (?<name>...)`)."
    )
    out.append("")
    out.append("**Heuristic scope (intentionally narrow):**")
    out.append("")
    out.append(
        "- Only fields referenced via `stats|eventstats|streamstats|"
        "chart|timechart|tstats <fn>(<field>)`, `... by <field>`, "
        "`rename <field> as ...`, or `dedup <field>...` are inspected. "
        "Field references inside `eval` / `where` expressions are "
        "skipped (parsing them reliably needs a real SPL grammar)."
    )
    out.append(
        "- Stanzas whose sourcetypes returned `empty` / `fail` in the "
        "inventory are skipped - we have no ground truth to compare to."
    )
    out.append(
        "- Pure `| makeresults` stanzas (no sourcetype query) are "
        "skipped - they invent their fields by definition."
    )
    out.append(
        "- CIM data model references (`All_Traffic.dvc`, "
        "`Authentication.action`, etc.) are auto-suppressed. They can "
        "only be validated against an accelerated data model, not "
        "against raw event fields."
    )
    out.append(
        "- Standard CIM field aliases (`dest_port`, `src_ip`, "
        "`Country`, etc.) are auto-suppressed. They are populated by "
        "TA `props.conf` field aliases at search-time, so the discovery "
        "search does not see them in raw events."
    )
    out.append("")

    # Summary
    out.append("## Summary")
    out.append("")
    out.append("| Metric | Count |")
    out.append("|---|---:|")
    out.append(f"| Stanzas inspected | {stats['inspected']:>4} |")
    out.append(
        f"| Stanzas skipped (no sourcetype) | {stats['skipped_no_sourcetype']:>4} |"
    )
    out.append(
        f"| Stanzas skipped (makeresults / synthetic) | {stats['skipped_makeresults']:>4} |"
    )
    out.append(
        f"| Stanzas skipped (no inventory data) | {stats['skipped_no_inventory_data']:>4} |"
    )
    out.append(f"| **Stanzas flagged** | **{stats['flagged']:>4}** |")
    out.append("")
    if extra_allow:
        out.append(
            f"**Extra allow-list:** {', '.join(f'`{f}`' for f in sorted(extra_allow))}"
        )
        out.append("")

    if not findings:
        out.append("## Findings")
        out.append("")
        out.append("No suspicious field references found. Audit clean.")
        out.append("")
        AUDIT_FINDINGS_MD.write_text("\n".join(out) + "\n")
        return

    high = [f for f in findings if f.confidence == "high"]
    partial = [f for f in findings if f.confidence == "partial"]
    sourcetypes_meta = inventory.get("sourcetypes", {})

    def _render_section(title: str, group: list[AuditFinding], note: str) -> None:
        out.append(f"## {title}")
        out.append("")
        if note:
            out.append(note)
            out.append("")
        if not group:
            out.append("_No findings in this category._")
            out.append("")
            return
        out.append("| # | Stanza | Sourcetype(s) | Suspicious fields |")
        out.append("|---:|---|---|---|")
        for i, f in enumerate(sorted(group, key=lambda x: x.stanza), start=1):
            sts = ", ".join(f"`{s}`" for s in f.sourcetypes)
            sus = ", ".join(f"`{s}`" for s in f.suspicious_fields)
            out.append(f"| {i} | `[{f.stanza}]` (line {f.line_no}) | {sts} | {sus} |")
        out.append("")

    _render_section(
        "High-confidence findings",
        high,
        "All of this stanza's sourcetypes returned data in the inventory, "
        "so we have a complete comparison set. Treat these as actionable "
        "candidates for a typo / wrong-field bug.",
    )
    _render_section(
        "Partial-confidence findings",
        partial,
        "At least one of this stanza's sourcetypes had **no data** in the "
        "inventory (status `empty` or `fail`), so the comparison set is "
        "incomplete - the flagged field might legitimately come from one "
        "of the empty/missing sourcetypes. Re-run the audit on a stack "
        "that has data for all of them before treating these as bugs.",
    )

    # Per-finding detail
    out.append("## Per-stanza detail")
    out.append("")
    for f in sorted(findings, key=lambda x: (x.confidence != "high", x.stanza)):
        out.append(
            f"### `[{f.stanza}]` (line {f.line_no}) "
            f"&mdash; *{f.confidence} confidence*"
        )
        out.append("")
        out.append(f"- **Sourcetypes:** {', '.join(f'`{s}`' for s in f.sourcetypes)}")
        if f.missing_inventory:
            out.append(
                f"- **No inventory data for:** {', '.join(f'`{s}`' for s in f.missing_inventory)} &mdash; "
                f"the flagged field may be supplied by one of these."
            )
        out.append(
            f"- **References (high-signal positions only):** {', '.join(f'`{r}`' for r in f.referenced)}"
        )
        if f.synthesized:
            out.append(
                f"- **Pipeline-synthesized:** {', '.join(f'`{r}`' for r in f.synthesized)}"
            )
        out.append("")
        out.append("**Suspicious fields:**")
        out.append("")
        for sus in f.suspicious_fields:
            present_in = []
            for st in f.sourcetypes:
                meta = sourcetypes_meta.get(st, {})
                if meta.get("status") != "pass":
                    continue
                fields = set(meta.get("fields", []))
                if sus in fields:
                    present_in.append(st)
            if present_in:
                out.append(
                    f"- `{sus}` &mdash; *(present in {', '.join(f'`{s}`' for s in present_in)} but flagged because of a separate sourcetype)*"
                )
            else:
                out.append(
                    f"- `{sus}` &mdash; not present in any of this stanza's sourcetypes."
                )
        out.append("")

    AUDIT_FINDINGS_MD.write_text("\n".join(out) + "\n")


# ---------------------------------------------------------------------------
# Step 4: main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workers",
        type=int,
        default=6,
        help="Concurrent oneshot dispatches (Splunk handles ~8 fine).",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=60,
        help="Per-search timeout in seconds.",
    )
    parser.add_argument(
        "--earliest",
        default="-7d",
        help="Earliest time for the discovery search (Splunk relative time).",
    )
    parser.add_argument(
        "--latest",
        default="now",
        help="Latest time for the discovery search.",
    )
    parser.add_argument(
        "--sample-rows",
        type=int,
        default=10000,
        help="`| head N` ceiling before `field_list` runs. Bigger = slower but more thorough.",
    )
    parser.add_argument(
        "--only",
        action="append",
        help="Only discover this sourcetype (can repeat). Useful for re-running a few.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Stop after N sourcetypes (debug aid).",
    )
    parser.add_argument(
        "--audit",
        action="store_true",
        help="After discovery, audit every stanza's SPL against the discovered field set.",
    )
    parser.add_argument(
        "--audit-only",
        action="store_true",
        help=(
            "Skip discovery entirely and audit using the existing "
            "`sourcetype_field_inventory.json`. Splunk credentials are "
            "not required."
        ),
    )
    parser.add_argument(
        "--allow-field",
        action="append",
        default=[],
        help=(
            "Add a field name to the audit allow-list (suppresses it from "
            "findings even if not in the discovered set). Repeatable."
        ),
    )
    parser.add_argument(
        "--index",
        default="*",
        help=(
            "Restrict discovery to one index (default `*`, every index). "
            "Useful for validating that a TA-onboarded index has the same "
            "field shape as a previously-imported / oneshot dataset; pair "
            "with `--output-suffix` to write a parallel inventory file "
            "instead of overwriting the canonical one."
        ),
    )
    parser.add_argument(
        "--output-suffix",
        default="",
        help=(
            "Append `_<suffix>` to the inventory output filenames so "
            "`scripts/sourcetype_field_inventory.json` becomes "
            "`scripts/sourcetype_field_inventory_<suffix>.json` (and "
            "the markdown / audit outputs likewise). Use this when "
            "you want side-by-side inventories for diffing rather "
            "than overwriting the canonical inventory."
        ),
    )
    args = parser.parse_args()

    # Honor `--output-suffix` by rewriting the module-level paths
    # that all the writers reference; everything downstream picks up
    # the new paths transparently.  Empty suffix is the default
    # (canonical filenames).
    if args.output_suffix:
        global INVENTORY_JSON, INVENTORY_MD, AUDIT_FINDINGS_MD
        suffix = args.output_suffix.strip().lstrip("_")
        INVENTORY_JSON = SCRIPTS_DIR / f"sourcetype_field_inventory_{suffix}.json"
        INVENTORY_MD = SCRIPTS_DIR / f"sourcetype_field_inventory_{suffix}.md"
        AUDIT_FINDINGS_MD = SCRIPTS_DIR / f"sourcetype_audit_findings_{suffix}.md"

    extra_allow: set[str] = set(args.allow_field or [])

    # ---- Audit-only fast path: don't touch Splunk, just read JSON ----
    if args.audit_only:
        if not INVENTORY_JSON.exists():
            print(
                f"ERROR: --audit-only needs an existing inventory at "
                f"{INVENTORY_JSON}. Run discovery first.",
                file=sys.stderr,
            )
            return 2
        print(f"Loading inventory from {INVENTORY_JSON.relative_to(ROOT)} ...")
        inventory = json.loads(INVENTORY_JSON.read_text())
        print(f"Parsing {SEARCHBASE.relative_to(ROOT)} ...")
        stanzas = parse_conf(SEARCHBASE)
        print(f"  Stanzas: {len(stanzas)}")
        findings, stats = audit_stanzas_against_inventory(
            stanzas, inventory, extra_allow=extra_allow
        )
        print()
        print(f"Audit complete:")
        for k, v in stats.items():
            print(f"  {k:<32} {v:>4}")
        print(f"\nWriting {AUDIT_FINDINGS_MD.relative_to(ROOT)} ...")
        write_audit_findings(findings, stats, inventory, extra_allow)
        print(f"  Findings: {AUDIT_FINDINGS_MD}")
        # Only fail on high-confidence findings - partial-confidence
        # ones are flagged because of missing inventory data, not
        # because the SPL is provably wrong, so they shouldn't gate
        # CI / scripted invocations.
        high_conf = sum(1 for f in findings if f.confidence == "high")
        return 1 if high_conf else 0

    env: dict = {
        "base_url": os.environ.get("SPLUNK_BASE_URL", "https://localhost:8089"),
        "username": os.environ.get("SPLUNK_USERNAME"),
        "password": os.environ.get("SPLUNK_PASSWORD"),
        "owner": os.environ.get("SPLUNK_OWNER", "admin"),
        "app": os.environ.get("SPLUNK_APP", "splunk-cisco-dashboards"),
        "verify_ssl": os.environ.get("SPLUNK_VERIFY_SSL", "false").lower()
        in {"1", "true", "yes"},
    }
    if not env["username"] or not env["password"]:
        print(
            "ERROR: SPLUNK_USERNAME and SPLUNK_PASSWORD must be set in the environment.",
            file=sys.stderr,
        )
        return 2

    print(f"Parsing {SEARCHBASE.relative_to(ROOT)} ...")
    refs, stanzas = collect_sourcetypes()
    if args.only:
        only = set(args.only)
        refs = {st: lst for st, lst in refs.items() if st in only}
    if args.limit:
        sourcetypes = sorted(refs)[: args.limit]
        refs = {st: refs[st] for st in sourcetypes}
    sourcetypes = sorted(refs)
    print(
        f"  Stanzas:      {len(stanzas)}\n"
        f"  Sourcetypes:  {len(sourcetypes)} (concrete; wildcards excluded)"
    )
    if not sourcetypes:
        print("Nothing to discover. Exiting.")
        return 0
    print(
        f"Dispatching {len(sourcetypes)} oneshot searches against "
        f"the configured Splunk endpoint with {args.workers} workers ..."
    )
    print()

    results: dict[str, DiscoveryResult] = {}
    print_lock = Lock()
    t0 = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {
            ex.submit(
                discover_one,
                st,
                env,
                args.earliest,
                args.latest,
                args.sample_rows,
                args.timeout,
                args.index,
            ): st
            for st in sourcetypes
        }
        for fut in as_completed(futures):
            r = fut.result()
            results[r.sourcetype] = r
            with print_lock:
                pad = max(len(s) for s in sourcetypes)
                print(
                    f"  [{len(results):>3}/{len(sourcetypes)}] "
                    f"{r.sourcetype:<{pad}}  "
                    f"{r.status:<7}  "
                    f"fields={len(r.fields):>3}  "
                    f"{r.elapsed_ms:>5} ms  "
                    f"{r.note}",
                    flush=True,
                )

    elapsed = time.monotonic() - t0
    print()
    print(f"Discovery complete in {elapsed:.1f}s.")
    print(f"Writing {INVENTORY_JSON.relative_to(ROOT)} ...")
    write_json(results, refs, args.earliest, args.latest, args.sample_rows, args.index)
    print(f"Writing {INVENTORY_MD.relative_to(ROOT)} ...")
    write_markdown(results, refs, args.earliest, args.latest, args.sample_rows)
    print()
    print(f"  JSON:     {INVENTORY_JSON}")
    print(f"  Markdown: {INVENTORY_MD}")
    print()

    by_status: dict[str, int] = {}
    for r in results.values():
        by_status[r.status] = by_status.get(r.status, 0) + 1
    print(
        "Status:  "
        + "  ".join(f"{k}={v}" for k, v in sorted(by_status.items()))
    )

    audit_exit = 0
    if args.audit:
        # Reload the JSON we just wrote so the audit sees the canonical
        # on-disk shape (rather than reconstructing it from in-memory
        # ``DiscoveryResult`` objects, which would diverge if the JSON
        # writer ever changes).
        inventory = json.loads(INVENTORY_JSON.read_text())
        findings, stats = audit_stanzas_against_inventory(
            stanzas, inventory, extra_allow=extra_allow
        )
        print()
        print("Audit complete:")
        for k, v in stats.items():
            print(f"  {k:<32} {v:>4}")
        print(f"\nWriting {AUDIT_FINDINGS_MD.relative_to(ROOT)} ...")
        write_audit_findings(findings, stats, inventory, extra_allow)
        print(f"  Findings: {AUDIT_FINDINGS_MD}")
        # Only high-confidence findings gate the exit code (see
        # ``audit-only`` path for rationale).
        high_conf = sum(1 for f in findings if f.confidence == "high")
        audit_exit = 1 if high_conf else 0

    return 1 if by_status.get("fail", 0) else audit_exit


if __name__ == "__main__":
    raise SystemExit(main())
