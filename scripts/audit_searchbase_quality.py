#!/usr/bin/env python3
"""
Read-only quality audit for searchbase.conf.

This script is intentionally static: it does not contact Splunk and it
does not write files. It gives us a repeatable inventory of every
searchbase stanza. `searchbase.conf` is the app's search catalogue;
`savedsearches.conf` is only for scheduled, materialized, or explicit
compatibility dependency searches.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
CONF_DIR = REPO_ROOT / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default"
SEARCHBASE = CONF_DIR / "searchbase.conf"
SAVEDSEARCHES = CONF_DIR / "savedsearches.conf"
MACROS = CONF_DIR / "macros.conf"
NAV = CONF_DIR / "data/ui/nav/default.xml"
VIEWS = CONF_DIR / "data/ui/views"

ALLOWED_AFTER_TIMECHART = {
    "addtotals",
    "append",
    "appendcols",
    "appendpipe",
    "fillnull",
    "fields",
    "sort",
    "head",
    "tail",
    "rename",
    "table",
}

CUMULATIVE_FIELDS = (
    "userPresence.activeUsersCount.totalUsers",
    "userPresence.inActiveUsersCount.totalUsers",
    "devicePresence.activeDevicesCount",
    "devicePresence.inActiveDevicesCount",
)


@dataclass
class Stanza:
    name: str
    file: str
    line_start: int
    fields: dict[str, str] = field(default_factory=dict)

    @property
    def search(self) -> str:
        return self.fields.get("search", "")

    @property
    def search_name(self) -> str:
        return self.fields.get("search_name", self.name)


@dataclass
class Finding:
    stanza: str
    search_name: str
    file: str
    line: int
    concern: str
    detail: str
    severity: str


_STANZA_RE = re.compile(r"^\[([^\]]+)\]\s*$")
_KV_RE = re.compile(r"^([A-Za-z_][\w.]*)\s*=\s*(.*)$")
_MACRO_RE = re.compile(r"`([A-Za-z_][\w-]*)(?:\([^`]*\))?`")
_SAVEDSEARCH_RE = re.compile(r"\|\s*savedsearch\s+\"([^\"]+)\"", re.I)

KNOWN_ALLOWED_AFTER_TIMECHART = {
    # Threshold/reference-line decorators intentionally live after timechart.
    "User Experience - Client Count Trend": {"eval"},
    # Gap filter is the point of this negative-control health search.
    "TEUC-5.9.49 — Data Collection Health Monitoring": {"where"},
}


def parse_conf(path: Path) -> list[Stanza]:
    stanzas: list[Stanza] = []
    current: Stanza | None = None
    current_key: str | None = None
    pending: list[str] = []

    def in_continuation() -> bool:
        return bool(pending) and pending[-1].endswith("\\")

    def flush() -> None:
        nonlocal current_key, pending
        if current is not None and current_key is not None:
            current.fields[current_key] = "\n".join(pending).rstrip()
        current_key = None
        pending = []

    with path.open("r", encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            line = raw.rstrip("\n")
            stripped = line.lstrip()

            if stripped.startswith("#") or not stripped:
                if current_key is not None and not in_continuation():
                    flush()
                continue

            header = _STANZA_RE.match(line)
            if header:
                flush()
                if current is not None:
                    stanzas.append(current)
                current = Stanza(header.group(1), str(path), lineno)
                continue

            if current is None:
                continue

            if in_continuation():
                pending[-1] = pending[-1].rstrip("\\").rstrip()
                pending.append(stripped)
                continue

            kv = _KV_RE.match(line)
            if kv:
                flush()
                current_key = kv.group(1)
                pending = [kv.group(2)]

    flush()
    if current is not None:
        stanzas.append(current)
    return stanzas


def parse_macros(path: Path) -> set[str]:
    return {s.name.split("(", 1)[0] for s in parse_conf(path)}


def parse_nav_dashboards() -> list[str]:
    text = NAV.read_text(encoding="utf-8")
    text = re.sub(r"<!--[\s\S]*?-->", "", text)
    names: list[str] = []
    for match in re.finditer(r"<(view|a)\b([^>]*)>", text):
        attrs = match.group(2)
        name = re.search(r'\bname="([^"]+)"', attrs)
        href = re.search(r'\bhref="([^"]+)"', attrs)
        value = name.group(1) if name else href.group(1) if href else ""
        if value and value not in {"reports", "dashboards"}:
            names.append(value)
    return list(dict.fromkeys(names))


def studio_datasources(view_name: str) -> tuple[list[str], list[str]]:
    path = VIEWS / f"{view_name}.xml"
    if not path.exists():
        return [], []
    text = path.read_text(encoding="utf-8")
    match = re.search(r"<definition><!\[CDATA\[([\s\S]*?)\]\]></definition>", text)
    if not match:
        return [], []
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return [], []
    saved_refs: list[str] = []
    inline_queries: list[str] = []
    for cfg in data.get("dataSources", {}).values():
        options = cfg.get("options", {})
        if cfg.get("type") == "ds.savedSearch" or options.get("ref"):
            ref = options.get("ref") or options.get("savedSearch")
            if ref:
                saved_refs.append(ref)
        if options.get("query"):
            inline_queries.append(options["query"])
    return saved_refs, inline_queries


def split_spl_commands(spl: str) -> list[str]:
    parts: list[str] = []
    current: list[str] = []
    quote: str | None = None
    escaped = False

    for char in spl:
        if escaped:
            current.append(char)
            escaped = False
            continue

        if char == "\\":
            current.append(char)
            escaped = True
            continue

        if quote:
            current.append(char)
            if char == quote:
                quote = None
            continue

        if char in {"'", '"'}:
            current.append(char)
            quote = char
            continue

        if char == "|":
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            continue

        current.append(char)

    part = "".join(current).strip()
    if part:
        parts.append(part)
    return parts


def command_after_last_timechart(spl: str) -> str | None:
    parts = split_spl_commands(spl)
    last_timechart = None
    for idx, part in enumerate(parts):
        if re.match(r"^timechart\b", part, re.I):
            last_timechart = idx
    if last_timechart is None or last_timechart == len(parts) - 1:
        return None
    next_part = parts[last_timechart + 1]
    match = re.match(r"^([A-Za-z][\w-]*)\b", next_part)
    return match.group(1).lower() if match else next_part


def add_finding(
    findings: list[Finding],
    stanza: Stanza,
    concern: str,
    detail: str,
    severity: str = "warn",
) -> None:
    findings.append(
        Finding(
            stanza=stanza.name,
            search_name=stanza.search_name,
            file=stanza.file,
            line=stanza.line_start,
            concern=concern,
            detail=detail,
            severity=severity,
        )
    )


def audit_stanza(
    stanza: Stanza,
    macros: set[str],
    saved_names: set[str],
    include_style: bool = False,
) -> list[Finding]:
    findings: list[Finding] = []
    spl = stanza.search.strip()
    if not spl:
        add_finding(findings, stanza, "missing_search", "No search field.", "error")
        return findings

    lower = spl.lower()
    used_macros = set(_MACRO_RE.findall(spl))
    missing = sorted(m for m in used_macros if m not in macros)
    if missing:
        add_finding(
            findings,
            stanza,
            "missing_macro",
            "Undefined macro(s): " + ", ".join(missing),
            "error",
        )

    if len(spl) > 4096:
        add_finding(
            findings,
            stanza,
            "spl_too_long_for_react_runtime",
            f"SPL length {len(spl)} exceeds runSearch 4096-character guard.",
            "warn",
        )

    if re.search(r"\bmakeresults\b", lower) or re.search(r"\brandom\s*\(", lower):
        add_finding(
            findings,
            stanza,
            "synthetic_or_placeholder_data",
            "Uses makeresults/random; keep only if it is an admin helper, not a product KPI.",
            "warn",
        )

    if re.search(r"\b(outputlookup|collect|sendemail|script|delete)\b", lower):
        add_finding(
            findings,
            stanza,
            "side_effecting_search",
            "Search has side effects and should remain explicit/scheduled, not ad-hoc UI dispatch.",
            "info",
        )

    if "sourcetype=\"cisco:dnac:issue\"" in spl or "sourcetype='cisco:dnac:issue'" in spl:
        uses_event_count = re.search(r"\b(timechart|stats|chart)\s+[^|]*\bcount\b", spl, re.I)
        uses_issue_dc = re.search(r"\bdc\s*\(\s*(?:eval\s*\([^)]*)?IssueID", spl, re.I)
        if uses_event_count and not uses_issue_dc:
            add_finding(
                findings,
                stanza,
                "issue_event_count_instead_of_issue_id_count",
                "Catalyst issue search counts events instead of dc(IssueID).",
                "error",
            )

    for field_name in CUMULATIVE_FIELDS:
        bad = re.search(rf"\b(sum|avg)\s*\(\s*{re.escape(field_name)}\s*\)", spl, re.I)
        if bad:
            add_finding(
                findings,
                stanza,
                "cumulative_total_bad_aggregation",
                f"{bad.group(1)}({field_name}) should usually be max/latest.",
                "error",
            )

    savedsearch_refs = sorted(set(_SAVEDSEARCH_RE.findall(spl)))
    missing_savedsearches = [name for name in savedsearch_refs if name not in saved_names]
    if missing_savedsearches:
        add_finding(
            findings,
            stanza,
            "missing_savedsearch_dependency",
            "Search calls missing saved search(es): " + ", ".join(missing_savedsearches),
            "error",
        )

    after_timechart = command_after_last_timechart(spl)
    allowed_after = set(ALLOWED_AFTER_TIMECHART)
    allowed_after.update(KNOWN_ALLOWED_AFTER_TIMECHART.get(stanza.search_name, set()))
    if after_timechart and after_timechart not in allowed_after:
        add_finding(
            findings,
            stanza,
            "transform_after_timechart",
            f"Command after timechart is '{after_timechart}'.",
            "warn",
        )

    if re.search(r"\|\s*timechart\b[\s\S]*\|\s*eval\s+[^|]*round\s*\(", spl, re.I):
        add_finding(
            findings,
            stanza,
            "round_after_timechart",
            "Rounding happens after timechart; prefer eval(round(agg(...))) in timechart.",
            "warn",
        )

    if re.search(r"\|\s*timechart\b[^|]*\beval\s*\(\s*round\s*\(", spl, re.I):
        add_finding(
            findings,
            stanza,
            "unsupported_timechart_eval_round",
            "Splunk 10.2 rejects timechart eval(round(...)) in this app; round before timechart instead.",
            "error",
        )

    if include_style:
        if re.search(r"\|\s*sort\b", spl, re.I):
            add_finding(
                findings,
                stanza,
                "presentation_sort_in_search",
                "Search sorts results; prefer dashboard/table presentation order unless the sort is required for SPL semantics.",
                "info",
            )
        if re.search(r"\|\s*head\b", spl, re.I):
            add_finding(
                findings,
                stanza,
                "row_cap_head_in_search",
                "Search caps rows with head; avoid arbitrary row limits unless the downstream workflow requires one.",
                "info",
            )
        if re.search(r"\|\s*spath\b", spl, re.I):
            add_finding(
                findings,
                stanza,
                "explicit_spath_in_search",
                "Search uses spath; prefer Splunk automatic JSON field extraction when fields are already indexed/extracted.",
                "info",
            )

    return findings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Emit JSON.")
    parser.add_argument("--markdown", action="store_true", help="Emit markdown.")
    parser.add_argument(
        "--style",
        action="store_true",
        help="Also report presentation/style issues such as sort, head, and spath.",
    )
    args = parser.parse_args()

    searchbase = parse_conf(SEARCHBASE)
    savedsearches = parse_conf(SAVEDSEARCHES)
    saved_names = {s.name for s in savedsearches}
    scheduled = {
        s.name
        for s in savedsearches
        if s.fields.get("enableSched", "0").strip() == "1"
        or s.fields.get("is_scheduled", "0").strip() == "1"
    }
    macros = parse_macros(MACROS)

    nav = parse_nav_dashboards()
    nav_saved_refs: list[str] = []
    nav_inline_queries: list[str] = []
    for view in nav:
        saved_refs, inline_queries = studio_datasources(view)
        nav_saved_refs.extend(saved_refs)
        nav_inline_queries.extend(inline_queries)

    findings = []
    for stanza in searchbase:
        findings.extend(audit_stanza(stanza, macros, saved_names, include_style=args.style))

    by_concern = Counter(f.concern for f in findings)
    by_severity = Counter(f.severity for f in findings)
    nav_ref_counts = Counter(nav_saved_refs)

    payload = {
        "searchbase_entries": len(searchbase),
        "savedsearches_entries": len(savedsearches),
        "scheduled_savedsearches": sorted(scheduled),
        "nav_dashboards": nav,
        "nav_saved_search_refs": len(nav_saved_refs),
        "nav_unique_saved_search_refs": len(nav_ref_counts),
        "nav_inline_queries": len(nav_inline_queries),
        "nav_inline_makeresults": sum(
            1 for q in nav_inline_queries if re.search(r"^\s*\|?\s*makeresults\b", q, re.I)
        ),
        "findings_by_concern": dict(sorted(by_concern.items())),
        "findings_by_severity": dict(sorted(by_severity.items())),
        "findings": [asdict(f) for f in findings],
    }

    if args.json:
        print(json.dumps(payload, indent=2))
        return 0

    if args.markdown:
        print("# Searchbase Quality Audit")
        print()
        print(f"- searchbase entries: {payload['searchbase_entries']}")
        print(f"- savedsearches entries: {payload['savedsearches_entries']}")
        print(f"- scheduled saved searches: {len(scheduled)}")
        print(f"- nav saved-search refs: {payload['nav_saved_search_refs']}")
        print(f"- nav inline queries: {payload['nav_inline_queries']}")
        print(f"- nav inline makeresults queries: {payload['nav_inline_makeresults']}")
        print()
        print("## Findings By Concern")
        for concern, count in sorted(by_concern.items()):
            print(f"- {concern}: {count}")
        print()
        print("## Error Findings")
        for finding in findings:
            if finding.severity == "error":
                print(
                    f"- {finding.concern}: {finding.search_name} "
                    f"({Path(finding.file).name}:{finding.line}) "
                    f"- {finding.detail}"
                )
        return 0

    print(f"searchbase entries: {len(searchbase)}")
    print(f"savedsearches entries: {len(savedsearches)}")
    print(f"scheduled saved searches: {len(scheduled)}")
    print(f"nav dashboards: {len(nav)}")
    print(f"nav saved-search refs: {len(nav_saved_refs)} ({len(nav_ref_counts)} unique)")
    print(f"nav inline queries: {len(nav_inline_queries)}")
    print(f"nav inline makeresults queries: {payload['nav_inline_makeresults']}")
    print()
    print("findings by concern:")
    for concern, count in sorted(by_concern.items()):
        print(f"  {concern}: {count}")
    print()
    print("top error findings:")
    for finding in [f for f in findings if f.severity == "error"][:50]:
        print(f"  {finding.line}: {finding.search_name} [{finding.concern}] {finding.detail}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
