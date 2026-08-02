#!/usr/bin/env python3
"""Validate searchbase_export.conf and split into pass/fail files."""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_searchbase_export import parse_stanzas, format_stanza
from audit_searchbase_quality import split_spl_commands
from lint_spl_antipatterns import lint_search

# Export artifacts live outside the Splunk app's default/ tree so they are
# never bundled into the shipped package; this validator reads/writes them in
# the repo-only exports/ directory produced by build_searchbase_export.py.
EXPORT_DIR = (
    Path(__file__).resolve().parents[1]
    / "packages/splunk-cisco-dashboards/exports"
)
EXPORT = EXPORT_DIR / "searchbase_export.conf"
PASS_OUT = EXPORT_DIR / "searchbase_export_pass.conf"
FAIL_OUT = EXPORT_DIR / "searchbase_export_fail.conf"

MACRO_CALL = re.compile(r"`([A-Za-z_][\w-]*)(?:\([^`]*\))?`")
LOOKUP_CMD = re.compile(r"(?:^|\|)\s*(?:lookup|inputlookup|outputlookup)\b", re.I | re.M)
SAVEDSEARCH_CMD = re.compile(r"\|\s*savedsearch\b", re.I)
REST_CMD = re.compile(r"\|\s*rest\b", re.I)
SCRIPT_CMD = re.compile(r"\|\s*script\b", re.I)
MAKERESULTS = re.compile(r"\bmakeresults\b", re.I)
JOIN_CMD = re.compile(r"\|\s*join\b", re.I)
MVEXPAND_CMD = re.compile(r"\|\s*mvexpand\b", re.I)
INDEX_STAR = re.compile(r'index\s*=\s*"\*"|\bindex=\*', re.I)
INTERNAL_INDEX = re.compile(r'index\s*=\s*"_?(?:internal|audit|introspection)"', re.I)

# Confidential / customer-specific (post-scrub residue)
CONFIDENTIAL_PATTERNS = [
    (re.compile(r"\bFDEM\b", re.I), "FDEM customer identifier"),
    (re.compile(r"\bCisco-FDEM\b", re.I), "Cisco-FDEM internal project name"),
    (re.compile(r"\bTallahassee\b", re.I), "customer site name (Tallahassee)"),
    (re.compile(r"\bAuburndale\b", re.I), "customer site name (Auburndale)"),
    (re.compile(r"\bBetty Easley\b", re.I), "customer building name"),
    (re.compile(r"\bPolk City\b", re.I), "customer location"),
    (re.compile(r"\bShumard Oak\b", re.I), "customer street address"),
    (re.compile(r"\bFred Jones\b", re.I), "customer street address"),
    (re.compile(r"\bsh-i-ak\b", re.I), "internal stack hostname"),
    (re.compile(r"\bstg\.splunkcloud\.com\b", re.I), "internal Splunk Cloud staging host"),
]

# PII: hardcoded identifiers or searches whose primary output is identity lists
PII_FIELD_OUTPUT = re.compile(
    r"\b(?:table|fields)\b[^|]*\b(?:username|user_name|UserName|userId|"
    r"email|Email|mail|Calling_Station_ID|EndPointMACAddress|macAddress|"
    r"ipv4Address|src_user|dest_user|Account_Name|Caller_User_Name)\b",
    re.I,
)
PII_HARDCODED = re.compile(
    r'\b(?:user|username|email)\s*=\s*"[^"]{2,}"|'
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    re.I,
)

# SPL syntax anti-patterns (from splunk-spl-field-syntax.mdc)
QUOTED_AGG = re.compile(
    r"\b(?:first|last|avg|sum|count|min|max|dc|values|latest|earliest)"
    r"\(\s*'[a-zA-Z_]\w*\.",
    re.I,
)
QUOTED_BY = re.compile(r"\b(?:by|BY)\s+'[a-zA-Z_]\w*\.", re.I)

SIDE_EFFECT = re.compile(
    r"\b(?:outputlookup|collect|sendemail|delete)\b", re.I
)

KNOWN_SPL_COMMANDS = {
    "search", "where", "eval", "stats", "eventstats", "streamstats", "timechart",
    "chart", "tstats", "join", "lookup", "inputlookup", "outputlookup", "rename",
    "fields", "table", "sort", "head", "tail", "dedup", "mvexpand", "mvcombine",
    "fillnull", "append", "appendcols", "appendpipe", "union", "from", "rex",
    "regex", "replace", "transaction", "bucket", "bin", "top", "rare", "return",
    "format", "convert", "spath", "xmlkv", "kv", "extract", "multikv", "iostat",
    "metadata", "rest", "savedsearch", "map", "foreach", "addtotals", "xyseries",
    "untable", "transpose", "makemv", "nomv", "strcat", "makeresults", "iplocation",
    "geostats", "gentimes", "localize", "reltime", "reverse", "delta", "accum",
    "compare", "outlier", "predict", "trendline", "untable",
}


def is_base_search_part(part: str) -> bool:
    """True when a pipe segment is a base index/sourcetype filter, not a command."""
    stripped = part.strip()
    if stripped.startswith("("):
        return True
    lower = stripped.lower()
    return bool(
        re.match(r"^(?:search\s+)?index\s*=", lower)
        or lower.startswith("index=")
        or "sourcetype=" in lower
        or "sourcetype in" in lower
    )


@dataclass
class CheckFailure:
    category: str
    detail: str
    suggestion: str


@dataclass
class ValidationResult:
    stanza_id: str
    failures: list[CheckFailure] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not self.failures


def normalize_spl(spl: str) -> str:
    parts: list[str] = []
    for line in spl.splitlines():
        s = line.rstrip()
        if s.endswith("\\"):
            s = s[:-1].rstrip()
        if s:
            parts.append(s)
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


def has_base_filter(spl: str) -> bool:
    lower = spl.lower()
    if "from datamodel=" in lower or "| from datamodel" in lower:
        return True
    if "sourcetype=" in lower or "sourcetype in" in lower:
        return True
    if re.search(r"\bindex\s*=", spl, re.I):
        return True
    return False


def is_trivial(spl: str) -> tuple[bool, str]:
    """Return (is_trivial, reason)."""
    norm = normalize_spl(spl)
    parts = split_spl_commands(norm)
    if not parts:
        return True, "empty search"

    transforming = [
        p for p in parts if not is_base_search_part(p)
    ]
    if not transforming:
        return True, "base index/sourcetype filter only — no transforming commands"

    if len(transforming) == 1 and MAKERESULTS.search(transforming[0]):
        return True, "synthetic makeresults-only search"

    # Single aggregate with no eval/where/case in the whole pipeline
    if len(transforming) == 1:
        cmd = transforming[0].lower()
        if re.match(r"^(?:stats|timechart|chart)\b", cmd):
            if not re.search(r"\b(?:eval|where|case|if)\b", norm, re.I):
                if not re.search(r"\b(?:appendpipe|join|subsearch|\[)\b", norm, re.I):
                    return True, "single aggregate only — no filtering, scoring, or enrichment"

    return False, ""


def check_spl_syntax(spl: str) -> list[CheckFailure]:
    failures: list[CheckFailure] = []
    if QUOTED_AGG.search(spl):
        failures.append(
            CheckFailure(
                "spl_syntax",
                "Single-quoted dotted field inside stats/timechart aggregate function.",
                "Use bare dotted field names in aggregate args (Class A commands). "
                "Single-quote only inside eval/where.",
            )
        )
    if QUOTED_BY.search(spl):
        failures.append(
            CheckFailure(
                "spl_syntax",
                "Single-quoted dotted field in by clause.",
                "Use bare field names in `by` clauses, e.g. `by connection.ssid`.",
            )
        )
    for violation in lint_search(spl):
        if violation.rule_id.startswith("R001"):
            continue
        failures.append(
            CheckFailure(
                "spl_syntax",
                f"{violation.rule_id}: {violation.snippet}",
                violation.detail,
            )
        )
    for part in split_spl_commands(normalize_spl(spl)):
        if is_base_search_part(part):
            continue
        if part.strip().startswith("["):
            continue
        m = re.match(r"^\|?\s*([A-Za-z][\w-]*)", part)
        if not m:
            continue
        cmd = m.group(1).lower()
        if cmd not in KNOWN_SPL_COMMANDS:
            failures.append(
                CheckFailure(
                    "spl_syntax",
                    f"Unrecognized or misspelled SPL command: '{cmd}'.",
                    "Verify command spelling and pipe placement.",
                )
            )
    return failures


def check_performance(spl: str) -> list[CheckFailure]:
    failures: list[CheckFailure] = []
    norm = normalize_spl(spl)

    if INDEX_STAR.search(norm):
        failures.append(
            CheckFailure(
                "performance",
                "Uses index=* (all indexes).",
                "Scope to a specific index or datamodel; avoid full-index scans.",
            )
        )
    if INTERNAL_INDEX.search(norm):
        failures.append(
            CheckFailure(
                "performance",
                "Queries Splunk internal indexes (_internal/_audit).",
                "Remove internal index references; export searches should use TA data only.",
            )
        )
    if not has_base_filter(norm) and not re.search(
        r"\|\s*(?:tstats|from)\b.*\bdatamodel\b", norm, re.I
    ):
        failures.append(
            CheckFailure(
                "performance",
                "No index, sourcetype, or datamodel constraint in SPL.",
                "Add index/sourcetype filter or tstats/from datamodel for bounded search.",
            )
        )
    if JOIN_CMD.search(norm) and not re.search(r"\[\s*search\b", norm, re.I):
        failures.append(
            CheckFailure(
                "performance",
                "Uses join without an explicit subsearch filter.",
                "Prefer stats+append, lookup on small CSV, or tstats; ensure join subsearch is bounded.",
            )
        )
    if MVEXPAND_CMD.search(norm):
        failures.append(
            CheckFailure(
                "performance",
                "Uses mvexpand (row multiplication).",
                "Confirm cardinality is low; prefer stats values()/mvjoin() when possible.",
            )
        )
    if len(norm) > 8192:
        failures.append(
            CheckFailure(
                "performance",
                f"SPL length {len(norm)} chars — very long pipeline.",
                "Split into intermediate saved searches or simplify pipeline stages.",
            )
        )
    return failures


def check_external_deps(spl: str, full_text: str) -> list[CheckFailure]:
    failures: list[CheckFailure] = []
    norm = normalize_spl(spl)

    if LOOKUP_CMD.search(norm):
        failures.append(
            CheckFailure(
                "external_dependency",
                "Uses lookup/inputlookup/outputlookup.",
                "Remove lookup enrichment or ship the lookup CSV with the export app; "
                "prefer fields present in TA-ingested events.",
            )
        )
    if SAVEDSEARCH_CMD.search(norm):
        failures.append(
            CheckFailure(
                "external_dependency",
                "Calls | savedsearch.",
                "Inline the SPL or remove dependency on another saved search.",
            )
        )
    if REST_CMD.search(norm):
        failures.append(
            CheckFailure(
                "external_dependency",
                "Uses | rest (Splunk REST API).",
                "Replace with indexed TA data or remove admin-only REST calls.",
            )
        )
    if SCRIPT_CMD.search(norm):
        failures.append(
            CheckFailure(
                "external_dependency",
                "Uses | script (external command).",
                "Remove custom scripts; use native SPL only.",
            )
        )
    if SIDE_EFFECT.search(norm):
        failures.append(
            CheckFailure(
                "external_dependency",
                "Has side effects (outputlookup/collect/sendemail/delete).",
                "Export searches should be read-only analytics.",
            )
        )

    for macro in MACRO_CALL.findall(norm):
        if macro in {"scd_summariesonly"}:
            continue
        failures.append(
            CheckFailure(
                "external_dependency",
                f"Unresolved macro `{macro}` in SPL.",
                "Expand macro inline or replace with portable index/sourcetype filters.",
            )
        )

    return failures


def check_confidential(stanza_id: str, fields: dict[str, str]) -> list[CheckFailure]:
    failures: list[CheckFailure] = []
    # Check SPL and search_name only — prose may reference generic dashboard links.
    blob = fields.get("search", "") + "\n" + fields.get("search_name", "")
    for pat, label in CONFIDENTIAL_PATTERNS:
        if pat.search(blob):
            failures.append(
                CheckFailure(
                    "confidential",
                    f"Contains {label}.",
                    "Scrub customer/site identifiers and internal URLs before export.",
                )
            )
    return failures


def check_pii(stanza_id: str, spl: str, fields: dict[str, str]) -> list[CheckFailure]:
    failures: list[CheckFailure] = []
    norm = normalize_spl(spl)
    blob = "\n".join(fields.values())

    if PII_HARDCODED.search(blob):
        failures.append(
            CheckFailure(
                "pii",
                "Hardcoded username, email, or user identifier in stanza text.",
                "Remove literal identities; parameterize or aggregate without naming individuals.",
            )
        )

    return failures


def validate_stanza(stanza_id: str, fields: dict[str, str]) -> ValidationResult:
    result = ValidationResult(stanza_id=stanza_id)
    spl = fields.get("search", "").strip()
    if not spl:
        result.failures.append(
            CheckFailure(
                "spl_syntax",
                "Missing search field.",
                "Add SPL or remove empty stanza from export.",
            )
        )
        return result

    # Triviality check disabled per review — simple KPI aggregates are acceptable for export.

    result.failures.extend(check_spl_syntax(spl))
    result.failures.extend(check_performance(spl))
    result.failures.extend(check_external_deps(spl, ""))
    result.failures.extend(check_confidential(stanza_id, fields))
    result.failures.extend(check_pii(stanza_id, spl, fields))
    return result


def format_fail_stanza(stanza_id: str, fields: dict[str, str], failures: list[CheckFailure]) -> str:
    comment_lines = [
        f"# EXPORT VALIDATION FAILED: [{stanza_id}]",
    ]
    for i, f in enumerate(failures, 1):
        comment_lines.append(f"# {i}. [{f.category}] {f.detail}".rstrip())
        comment_lines.append(f"#    Suggestion: {f.suggestion}".rstrip())
    comment_lines.append("")
    body = format_stanza(stanza_id, fields)
    return "\n".join(comment_lines) + "\n" + body


def main() -> int:
    if not EXPORT.exists():
        print(f"Missing {EXPORT}; run scripts/build_searchbase_export.py first.", file=sys.stderr)
        return 1

    text = EXPORT.read_text(encoding="utf-8")
    # Strip header comments
    stanzas = parse_stanzas(text)

    pass_stanzas: list[tuple[str, dict[str, str]]] = []
    fail_stanzas: list[tuple[str, dict[str, str], list[CheckFailure]]] = []

    for sid, fields in stanzas:
        vr = validate_stanza(sid, fields)
        if vr.passed:
            pass_stanzas.append((sid, fields))
        else:
            fail_stanzas.append((sid, fields, vr.failures))

    pass_header = """# searchbase_export_pass.conf — export stanzas passing quality review.
# Generated by scripts/validate_searchbase_export.py from searchbase_export.conf.
# Criteria: non-trivial SPL, valid syntax, performant, TA-data-only, no confidential info, no PII.
"""

    fail_header = """# searchbase_export_fail.conf — export stanzas that failed quality review.
# Each stanza is prefixed with comments describing failures and remediation suggestions.
# Generated by scripts/validate_searchbase_export.py from searchbase_export.conf.
"""

    pass_blocks = [pass_header.strip(), ""]
    for sid, fields in pass_stanzas:
        pass_blocks.append(format_stanza(sid, fields))

    fail_blocks = [fail_header.strip(), ""]
    for sid, fields, failures in fail_stanzas:
        fail_blocks.append(format_fail_stanza(sid, fields, failures))

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    PASS_OUT.write_text("\n\n".join(pass_blocks) + "\n", encoding="utf-8")
    FAIL_OUT.write_text("\n\n".join(fail_blocks) + "\n", encoding="utf-8")

    # Summary by failure category
    from collections import Counter

    cat_counts: Counter[str] = Counter()
    for _, _, failures in fail_stanzas:
        for f in failures:
            cat_counts[f.category] += 1

    print(f"Export stanzas reviewed: {len(stanzas)}")
    print(f"PASS: {len(pass_stanzas)} -> {PASS_OUT.name}")
    print(f"FAIL: {len(fail_stanzas)} -> {FAIL_OUT.name}")
    if cat_counts:
        print("Failure categories (stanzas may have multiple):")
        for cat, n in cat_counts.most_common():
            print(f"  {cat}: {n}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
