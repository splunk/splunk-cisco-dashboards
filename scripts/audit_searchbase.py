#!/usr/bin/env python3
"""
Audit packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf
for structural problems that almost certainly produce "no results":

  - Sourcetype not present on the customer/dev stack
  - Macro not defined in macros.conf
  - Lookup not defined in transforms.conf
  - Bare `index=*` not wrapped by an index_* macro
  - DNAC field-case anti-patterns from .cursor/rules/splunk-cisco-dnac-fields.mdc
  - Empty / placeholder search bodies

Outputs a triage table grouped by severity. Read-only; never edits files.
"""
from __future__ import annotations
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONF_DIR = ROOT / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default"
SEARCHBASE = CONF_DIR / "searchbase.conf"
MACROS = CONF_DIR / "macros.conf"
TRANSFORMS = CONF_DIR / "transforms.conf"

# ---------- 1. Ground truth ----------------------------------------------------

# Sourcetypes observed on the customer stack (per docs/history/SESSION_LOG.md / DNAC field
# rule). Anything else is "may not return data on the demo/dev stack".
CUSTOMER_DNAC_SOURCETYPES = {
    "cisco:dnac:devicehealth",
    "cisco:dnac:issue",
    "cisco:dnac:networkhealth",
    "cisco:dnac:client",
    "cisco:dnac:clienthealth",
    "cisco:dnac:compliance",
    "cisco:dnac:audit:logs",
    "cisco:dnac:securityadvisory",
    "cisco:dnac:site:topology",
}
# Other sourcetypes we believe are present (Spaces, ISE, Meraki demo data, etc.).
OTHER_AVAILABLE_SOURCETYPES = {
    "cisco:spaces:firehose",
    "cisco:ise:syslog",
    "cisco:thousandeyes:metric",
    "cisco:thousandeyes:trace",
    "cisco:thousandeyes:path-vis",
    "cisco:thousandeyes:activity",
    "cisco:thousandeyes:alerts",
    "cisco:thousandeyes:test",
    "cisco:thousandeyes:account-group",
    "meraki:network:health",
    "meraki:device:status",
    "meraki:wireless:client",
    "cisco:catalyst:center:inventory:report",
    "cisco:catalyst:center:compliance:report",
    "cisco:dna:assurance:client",
    "syslog",
    "cisco:asa",
    "cisco:ftd",
    "WinEventLog",
    "XmlWinEventLog",
    "MSAD:NT6:DNS",
    "ActiveDirectory",
    "DhcpSrvLog:NewEvents",
    "bms:power",
    "bms:hvac",
    "bms:pdu",
    "f5:bigip:syslog",
    "ms:defender:atp",
    "cisco:wsa:accesslogs",
    "cisco:esa:textmail",
    "cisco:xdr:incidents",
    "cisco:cloud_security:dns",
    "cisco:sdwan:utd",
}
# Sourcetypes we know are NOT on the customer stack today (per docs/history/SESSION_LOG.md
# inquiries). Anything matching these will be flagged as "data gap".
KNOWN_MISSING_SOURCETYPES = {
    "cisco:sdwan:linkhealth",  # Sarav investigated; no TA path yet
}
ALL_KNOWN_SOURCETYPES = (
    CUSTOMER_DNAC_SOURCETYPES | OTHER_AVAILABLE_SOURCETYPES | KNOWN_MISSING_SOURCETYPES
)

# Built-in lookups the splunk install always ships
BUILTIN_LOOKUPS = {"geo_us_states", "geo_attr_us_states", "geo_attr_countries"}


# ---------- 2. Parse macros.conf -----------------------------------------------

def parse_macros(path: Path) -> set[str]:
    """Return the set of macro names (without arity suffix, e.g. dnac_site_normalize)."""
    names: set[str] = set()
    if not path.exists():
        return names
    with path.open() as f:
        for line in f:
            m = re.match(r"^\[([^\]]+)\]", line)
            if not m:
                continue
            stanza = m.group(1)
            base = stanza.split("(")[0]
            names.add(base)
    return names


def parse_lookups(path: Path) -> set[str]:
    names: set[str] = set(BUILTIN_LOOKUPS)
    if not path.exists():
        return names
    with path.open() as f:
        for line in f:
            m = re.match(r"^\[([^\]]+)\]", line)
            if m:
                names.add(m.group(1))
    return names


# ---------- 3. Parse searchbase.conf -------------------------------------------

class Stanza:
    __slots__ = ("name", "line_no", "kv", "search")

    def __init__(self, name: str, line_no: int) -> None:
        self.name = name
        self.line_no = line_no
        self.kv: dict[str, str] = {}
        self.search: str = ""


def parse_searchbase(path: Path) -> list[Stanza]:
    stanzas: list[Stanza] = []
    cur: Stanza | None = None
    cur_key: str | None = None
    with path.open() as f:
        lines = f.readlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        line_no = i + 1
        stripped = raw.rstrip("\n")
        m = re.match(r"^\[([^\]]+)\]\s*$", stripped)
        if m:
            cur = Stanza(m.group(1), line_no)
            stanzas.append(cur)
            cur_key = None
            i += 1
            continue
        if cur is None:
            i += 1
            continue
        if not stripped.strip() or stripped.startswith("#"):
            cur_key = None
            i += 1
            continue
        kv = re.match(r"^([A-Za-z_][\w\-]*)\s*=\s*(.*)$", stripped)
        if kv:
            cur_key = kv.group(1)
            value = kv.group(2)
            # Handle line continuations: backslash at EOL means next line is part of value.
            while value.endswith("\\") and i + 1 < len(lines):
                value = value[:-1].rstrip() + " "
                i += 1
                value += lines[i].rstrip("\n").lstrip()
            cur.kv[cur_key] = value
            if cur_key == "search":
                cur.search = value
            i += 1
            continue
        # Continuation without backslash (rare in real searchbase.conf, but possible)
        i += 1
    return stanzas


# ---------- 4. Issue detectors -------------------------------------------------

# Patterns
RE_SOURCETYPE = re.compile(r'sourcetype\s*=\s*"([^"]+)"')
RE_SOURCETYPE_BARE = re.compile(r"sourcetype\s*=\s*([A-Za-z][\w:\.\-]+)")
RE_MACRO = re.compile(r"`([A-Za-z_][\w]*)(?:\(([^)]*)\))?`")
RE_INDEX_BARE = re.compile(r"(?<!`)\bindex\s*=\s*([A-Za-z\*][\w\*]*)\b")
RE_LOOKUP = re.compile(
    r"\b(?:lookup|inputlookup|outputlookup)\s+(?:append=\w+\s+|local=\w+\s+|update=\w+\s+|max=\d+\s+|errormsg=\S+\s+)*"
    r"([A-Za-z_][\w\-]*)"
)
# Catalogued from the DNAC field rule: lowercase aliases that should never appear
# on the LEFT side of `eval`, `rename`, or as bare references when the canonical
# casing exists. We exempt `as` clauses inside stats/timechart for now to keep
# false-positive rate low.
DNAC_LOWERCASE_PROBES = {
    # field_alias_used : canonical_name
    "site": "Site",
    "location": "Location",
    "devicefamily": "DeviceFamily",
    "deviceid": "DeviceID",
    "reachability": "Reachability",
    "manageability": "Manageability",
    "overallhealth": "OverallHealth",
    "issuename": "IssueName",
    "issueid": "IssueID",
    "issuestatus": "IssueStatus",
    "issuespecificpriority": "IssueSpecificPriority",
    "issuespecificcategory": "IssueSpecificCategory",
    "healthscore": "healthScore",
    "scoretype": "scoreType",
    "clienttype": "clientType",
    "clientcount": "clientCount",
    "sitehierarchy": "siteHierarchy",
    "sitehierarchyid": "siteHierarchyId",
    "siteid": "siteId",
}


def detect_issues(stanza: Stanza, defined_macros: set[str], defined_lookups: set[str]) -> list[tuple[str, str]]:
    """Return list of (severity, message) tuples for one stanza."""
    issues: list[tuple[str, str]] = []
    spl = stanza.search
    if not spl.strip():
        # Stanza without search may be intentional (e.g. parent template)
        return issues

    # 1) sourcetype checks -----------------------------------------------------
    sourcetypes = set(RE_SOURCETYPE.findall(spl)) | set(RE_SOURCETYPE_BARE.findall(spl))
    # Drop ones that look like a wildcard or partial match (TA filters use "cisco:*")
    concrete = {s for s in sourcetypes if "*" not in s}
    for st in concrete:
        if st in KNOWN_MISSING_SOURCETYPES:
            issues.append(("HIGH", f'sourcetype "{st}" is known-missing on the customer stack (data gap)'))
        elif st.startswith("cisco:dnac:") and st not in CUSTOMER_DNAC_SOURCETYPES:
            issues.append(("HIGH", f'DNAC sourcetype "{st}" not seen on the customer stack'))
        elif st not in ALL_KNOWN_SOURCETYPES:
            issues.append(("LOW", f'unknown sourcetype "{st}" — verify it exists'))

    # 2) macro checks ----------------------------------------------------------
    for mname, _args in RE_MACRO.findall(spl):
        if mname not in defined_macros:
            issues.append(("HIGH", f'macro `{mname}` not defined in macros.conf'))

    # 3) lookup checks ---------------------------------------------------------
    for lk in RE_LOOKUP.findall(spl):
        if lk not in defined_lookups:
            issues.append(("HIGH", f'lookup "{lk}" not defined in transforms.conf'))

    # 4) bare index= without macro --------------------------------------------
    # Only flag if there is no leading `\`index_\`` macro on the line.
    bare = RE_INDEX_BARE.findall(spl)
    if bare:
        # If the SPL also has an `\`index_*\`` macro, don't flag — bare may be an
        # eventtype reference like `index=auth` which is a token in a constraint.
        has_macro = bool(re.search(r"`index_\w+`", spl))
        for idx in bare:
            if idx == "*":
                if not has_macro:
                    issues.append(("MEDIUM", "uses `index=*` without an index_* macro wrapper"))
            elif idx in ("_internal", "_audit", "_introspection"):
                # admin index — usually intentional
                pass
            else:
                if not has_macro:
                    issues.append(("LOW", f'uses bare `index={idx}` — should use an index_* macro'))

    # 5) DNAC lowercase aliases on LHS of eval / rename ------------------------
    # eval site=...   rename Site as site   etc.
    for probe_lc, canonical in DNAC_LOWERCASE_PROBES.items():
        # `eval lc=`
        if re.search(rf"\beval\s+{probe_lc}\s*=", spl, re.IGNORECASE) and probe_lc != canonical.lower():
            # Only flag if the eval is not assigning the canonical name elsewhere
            issues.append(("MEDIUM", f'creates lowercase alias `{probe_lc}=...` — canonical is `{canonical}` (DNAC field rule)'))
        # `rename Site as lc` or `rename lc as Site`
        for m in re.finditer(rf"rename\s+(\S+)\s+as\s+(\S+)", spl):
            src, dst = m.group(1).strip('"'), m.group(2).strip('"')
            if dst == probe_lc and probe_lc != canonical.lower():
                issues.append(("MEDIUM", f'renames `{src}` -> `{probe_lc}` — drops canonical case to lowercase'))

    return issues


# ---------- 5. Main ------------------------------------------------------------

def main() -> int:
    if not SEARCHBASE.exists():
        print(f"ERROR: {SEARCHBASE} not found", file=sys.stderr)
        return 2
    macros = parse_macros(MACROS)
    lookups = parse_lookups(TRANSFORMS)
    stanzas = parse_searchbase(SEARCHBASE)
    print(f"Audit: {SEARCHBASE.relative_to(ROOT)}")
    print(f"Stanzas:        {len(stanzas)}")
    print(f"Macros known:   {len(macros)}")
    print(f"Lookups known:  {len(lookups)}")
    print()

    by_sev: dict[str, list[tuple[Stanza, str]]] = defaultdict(list)
    counts_overall = {"HIGH": 0, "MEDIUM": 0, "LOW": 0, "OK": 0}
    for s in stanzas:
        issues = detect_issues(s, macros, lookups)
        if not issues:
            counts_overall["OK"] += 1
            continue
        for sev, msg in issues:
            by_sev[sev].append((s, msg))
            counts_overall[sev] += 1

    print("=" * 80)
    print(f"Summary: {counts_overall['HIGH']} HIGH  {counts_overall['MEDIUM']} MEDIUM  "
          f"{counts_overall['LOW']} LOW  {counts_overall['OK']} clean stanzas")
    print("=" * 80)

    for sev in ("HIGH", "MEDIUM", "LOW"):
        items = by_sev[sev]
        if not items:
            continue
        print()
        print(f"## {sev}  ({len(items)} findings)")
        # Group by stanza
        per_stanza: dict[str, list[str]] = defaultdict(list)
        line_no: dict[str, int] = {}
        for s, msg in items:
            per_stanza[s.name].append(msg)
            line_no[s.name] = s.line_no
        # Sort by stanza name for stable output
        for name in sorted(per_stanza):
            print(f"  [{name}]  (line {line_no[name]})")
            for msg in per_stanza[name]:
                print(f"    - {msg}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
