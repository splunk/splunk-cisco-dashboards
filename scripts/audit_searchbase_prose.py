#!/usr/bin/env python3
"""Find searchbase.conf prose that contradicts its own SPL.

Read-only. Every rule looks for an objective disagreement between what a
stanza says and what its search does -- a named sourcetype the SPL never
reads, a claimed data model it never queries, a cited field that does not
appear. Whether the prose is *useful* is a judgement call this script does
not make; whether it is *false* is not.

Two design notes matter for anyone extending this:

Macro expansion. Most searches enter through an `index_*` macro, so the
literal SPL rarely names an index. Macros defined in this repo are inlined
before the rules run. When a search depends on a macro from an add-on we do
not ship, claims about its internals are unprovable either way, so affected
findings are moved to the U bucket instead of being reported as defects.

Contrast detection. Good prose names a mechanism precisely to say the
search avoids it: "uses mvfilter() without mvexpand", "rather than tstats --
do not convert it", "falls back to raw events". A naive keyword match reads
every one of those as a false claim. CONTRAST_RE and SUGGESTION_RE keep the
rules off them, which is why the rules below check the surrounding sentence
rather than the whole field.

Usage:
    python3 scripts/audit_searchbase_prose.py
    python3 scripts/audit_searchbase_prose.py --rule=R5 --limit=30
    python3 scripts/audit_searchbase_prose.py --stanza=overview_xdr_critical_incidents
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path
from typing import TypedDict

sys.path.insert(0, str(Path(__file__).resolve().parent))
from prose_audit_allowlist import ALLOWED, is_allowed  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
DEFAULT = REPO / "packages/splunk-cisco-dashboards/src/main/resources/splunk/default"
SOURCE = DEFAULT / "searchbase.conf"
MACROS_CONF = DEFAULT / "macros.conf"

PROSE_KEYS = ("description", "explanation", "solution", "related_info")

# Prose cites views and configs relative to a few well-known roots.
FILE_BASES = (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default",
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views",
    "packages/splunk-cisco-dashboards/src/main/webapp",
    "packages/splunk-cisco-dashboards",
)
# Files owned by an add-on or by Splunk itself, not by this repository.
FILE_WHITELIST = {"props.conf", "transforms.conf", "eventtypes.conf", "tags.conf"}

# CIM and vendor models whose names are a single word, so R2 can tell
# "datamodel Authentication" from a sentence that happens to start "datamodel
# Defines the...".
KNOWN_MODELS = {
    "alerts", "authentication", "certificates", "change", "compute",
    "databases", "datasets", "email", "endpoint", "inventory", "malware",
    "performance", "ticketing", "updates", "vulnerabilities",
}

# Commands distinctive enough that naming one is a claim about the pipeline.
# "stats" and "eval" are too common in English-adjacent prose to test.
SPL_COMMANDS = (
    "timechart", "chart", "geostats", "iplocation", "transaction",
    "eventstats", "streamstats", "rare", "mvexpand", "xyseries", "predict",
    "anomalydetection", "cluster", "map", "tstats",
)

# <code> is used for anything monospace, so R11 needs to know what is not a
# field. Commands, eval functions and command options are the largest group.
NOT_FIELDS = {
    # commands
    "stats", "tstats", "eval", "where", "search", "fields", "table", "rename",
    "sort", "head", "tail", "dedup", "top", "rare", "chart", "timechart",
    "bin", "bucket", "appendpipe", "append", "join", "lookup", "inputlookup",
    "outputlookup", "eventstats", "streamstats", "transpose", "xyseries",
    "untable", "mvexpand", "makeresults", "predict", "fillnull", "spath",
    "xmlkv", "kv", "rex", "erex", "geostats", "iplocation", "transaction",
    "addtotals", "convert", "foreach", "map", "multisearch", "tojson",
    # eval and stats functions
    "coalesce", "if", "case", "match", "round", "tostring", "tonumber",
    "strftime", "strptime", "mvindex", "mvappend", "mvfilter", "mvcount",
    "mvjoin", "split", "substr", "replace", "len", "lower", "upper", "trim",
    "isnotnull", "isnull", "nullif", "now", "relative_time", "count", "sum",
    "avg", "min", "max", "dc", "values", "latest", "earliest", "first",
    "last", "median", "perc95", "stdev", "range", "mode", "exact",
    # command options
    "span", "holdback", "limit", "usenull", "useother", "fillnull_value",
    "summariesonly", "allow_old_summaries", "nodename", "output", "outputnew",
    "as", "by", "over", "window", "current", "global", "cont",
}

# Prose that names a mechanism in order to reject, defer, or historicise it.
CONTRAST_RE = re.compile(
    r"\b(?:not|non-existent|nonexistent|doesn|does not|do not|don|never|"
    r"instead|rather than|unlike|absent|missing|no longer|avoid|without|"
    r"sibling|companion|separate|other|different|would|if you|deprecated|"
    r"legacy|renamed|replaced|formerly|was\b|used to|mistak|wrong|incorrect|"
    r"empty|null|unmapped|unavailable|elsewhere|counterpart|paired|"
    r"fall(?:s|back)?|fallback|prefer|convert|rework|version|original|"
    r"upstream|stock|intentional|why\b|in case|you.d rather|defaults to|"
    # lineage and rename phrasing: "the endpoints that feed X", "distinct
    # from the Y stream", "replaces the demo-only Z".
    r"feed|feeds|distinct from|replaces|supplied by|populated by|"
    r"sourced from|comes from|upstream of)\b",
    re.I,
)
# Prose offering the reader a next step, not describing this search.
SUGGESTION_RE = re.compile(
    r"\b(?:for deeper|for further|for more|diagnostic|drill|next step|"
    r"consider|you can also|also available|extend|pivot to|follow up|"
    r"related field|other field|additional field|follow-on|correlate|"
    r"cross-reference|suggested)\b",
    re.I,
)
# Prose explaining where the SPL came from rather than what it reads.
PROVENANCE_RE = re.compile(
    r"\b(?:provenance|harvested|data source|dashboard studio|shipped view|"
    r"appears on|stock dashboard|canonical spl|reconciliation|"
    r"effective dashboard)\b",
    re.I,
)
# Verbs that turn a field mention into an assertion the SPL touches it.
CLAIM_RE = re.compile(
    r"\b(?:reads?|returns?|emits?|computes?|counts?|groups? by|aggregat\w+|"
    r"filters? on|surfaces?|reports?|extracts?|parses?|sums?|averages?|"
    r"buckets?|splits? by|keyed on|based on|derived from|populated)\b",
    re.I,
)

# Rules whose verdict depends on SPL internals a macro may hide.
OPAQUE_RULES = {"R1", "R2", "R3", "R4", "R6", "R11"}

RULES = {
    "R1": "prose names a source type the SPL never reads",
    "R2": "prose names a data model the SPL never queries",
    "R3": "prose claims tstats/acceleration the SPL does not use",
    "R4": "prose says raw events but SPL is a data-model search",
    "R5": "prose names an index macro the SPL never expands",
    "R6": "prose names an SPL command the search does not use",
    "R7": "prose 'top N' disagrees with the SPL limit",
    "R8": "asserts confirmed/validated environment state",
    "R9": "cross-references a search name that does not exist",
    "R10": "prose span= disagrees with the SPL span",
    "R11": "prose cites a field absent from the SPL",
    "R12": "prose cites a repo file that does not exist",
    "R13": "prose cross-references a stanza id not in the catalogue",
    "U": "UNVERIFIABLE: claim depends on a macro defined outside this repo",
}


class Finding(TypedDict):
    stanza: str
    name: str
    rule: str
    detail: str


MACROS: dict[str, str] = {}
ALL_NAMES: set[str] = set()
ALL_STANZA_IDS: set[str] = set()
# Leading two tokens of every real stanza id, e.g. "secure_networking".
STANZA_PREFIXES: set[str] = set()
# PascalCase React component names, so R11 can tell a component from a field.
WEBAPP_COMPONENTS: set[str] = set()


def chunks_of(text: str) -> list[str]:
    parts = re.split(r"(?=^\[[A-Za-z][A-Za-z0-9_-]*\]\s*$)", text, flags=re.M)
    return [c for c in parts if re.match(r"^\[", c)]


def field(chunk: str, key: str) -> str:
    """Value of one key, joining the continuation lines conf files allow.

    The trailing backslash is a conf-file line joiner, not part of the value.
    Leaving it in was silently corrupting SPL token extraction: a sourcetype
    at end of line came out as 'cisco:asa"\\' and matched nothing.
    """
    m = re.search(rf"^{key} = (.*?)(?=^[a-z_]+\s*=|\Z)", chunk, re.M | re.S)
    if not m:
        return ""
    return re.sub(r"\\\s*\n\s*", " ", m.group(1)).strip()


def detag(value: str) -> str:
    """Prose without markup, so sentence matching is not fooled by tags."""
    return html.unescape(re.sub(r"<[^>]+>", " ", value))


def code_spans(value: str) -> list[str]:
    return re.findall(r"<code>(.*?)</code>", value, re.S)


def load_macros() -> dict[str, str]:
    if not MACROS_CONF.exists():
        return {}
    out: dict[str, str] = {}
    for chunk in re.split(r"(?=^\[)", MACROS_CONF.read_text(), flags=re.M):
        m = re.match(r"^\[([^\]]+)\]", chunk)
        if not m:
            continue
        # Drop the "(n)" argument-count suffix conf files use.
        name = re.sub(r"\(\d+\)$", "", m.group(1))
        definition = field(chunk, "definition")
        if definition:
            out[name] = definition
    return out


def expand_macros(spl: str) -> tuple[str, set[str]]:
    """Inline repo-defined macros; report the ones we cannot resolve.

    Bounded iteration because macros nest. Anything still wrapped in
    backticks afterwards belongs to an add-on and makes the search partly
    opaque to the rules.
    """
    text = spl
    for _ in range(6):
        names = re.findall(r"`([a-zA-Z][\w:-]*)`", text)
        if not names:
            break
        progressed = False
        for name in names:
            if name in MACROS:
                text = text.replace(f"`{name}`", f" {MACROS[name]} ")
                progressed = True
        if not progressed:
            break
    unresolved = {n for n in re.findall(r"`([a-zA-Z][\w:-]*)`", text) if n not in MACROS}
    return text, unresolved


def _absent_codes(codes: list[str], spl_lower: str) -> list[str]:
    """Monospaced tokens the SPL does not contain, used to spot enumerations."""
    return [
        c.strip() for c in codes
        if re.fullmatch(r"[A-Za-z_][\w.]{2,60}", c.strip())
        and c.strip().lower() not in spl_lower
    ]


def _context(text: str, needle: str, width: int = 150) -> str:
    """The sentence around a match, for the contrast and suggestion tests."""
    i = text.lower().find(needle.lower())
    if i < 0:
        return ""
    return text[max(0, i - width): i + len(needle) + width]


def glob(pattern: str) -> re.Pattern[str]:
    """A sourcetype wildcard as a regex; values contain regex metacharacters."""
    return re.compile("".join(
        ".*" if ch == "*" else re.escape(ch) for ch in pattern
    ), re.I)


def audit(chunk: str) -> list[Finding]:
    sid = re.match(r"^\[([^\]]+)\]", chunk).group(1)
    name = field(chunk, "search_name")
    raw_spl = field(chunk, "search")
    spl, unresolved = expand_macros(raw_spl)

    prose = {k: field(chunk, k) for k in PROSE_KEYS}
    blob = detag(" ".join(prose.values()))
    blob = re.sub(r"\s+", " ", blob)
    codes = [c for v in prose.values() for c in code_spans(v)]

    out: list[Finding] = []

    def add(rule: str, detail: str) -> None:
        # A claim we cannot check is not a defect. Say so separately.
        if rule in OPAQUE_RULES and unresolved:
            out.append(Finding(
                stanza=sid, name=name, rule="U",
                detail=f"{detail} -- unverifiable: "
                       f"{', '.join(sorted(unresolved))} defined outside this repo",
            ))
            return
        out.append(Finding(stanza=sid, name=name, rule=rule, detail=detail))

    # -- R1: prose names a sourcetype the SPL never reads -------------------
    spl_sourcetypes: set[str] = set()
    # A tstats WHERE subsearch ends ...sourcetype="zeek:dns")], so the closing
    # bracket and paren have to come off or nothing ever matches the prose.
    for group in re.findall(r"sourcetype\s*(?:=|IN)\s*([^\s]+(?:\s*,\s*[^\s]+)*)", spl):
        for token in group.split(","):
            spl_sourcetypes.add(token.strip("()[],\"' "))
    for group in re.findall(r"sourcetype\s+IN\s*\(([^)]*)\)", spl, re.I):
        for token in group.split(","):
            spl_sourcetypes.add(token.strip("()[],\"' "))
    spl_sourcetypes = {s for s in spl_sourcetypes if s}

    claimed_sts = {
        c.strip() for c in codes
        if re.fullmatch(r"[a-z][\w\-]*(?::[\w*\-]+)+", c.strip(), re.I)
    }
    for st in claimed_sts:
        if any(glob(cand).fullmatch(st) or glob(st).fullmatch(cand)
               for cand in spl_sourcetypes):
            continue
        # The colon shape also fits things that are not sourcetypes at all:
        # CVSS vectors (AV:N, AC:L) and YANG metric namespaces that mstats
        # reads by name. If the SPL contains the literal string anywhere,
        # the prose is not claiming a source the search never touches.
        if st.lower() in spl.lower():
            continue
        if re.fullmatch(r"[A-Z]{2}:[A-Z]", st):
            continue
        if CONTRAST_RE.search(_context(blob, st)) or PROVENANCE_RE.search(_context(blob, st)):
            continue
        add("R1", f'prose says sourcetype="{st}"; SPL reads '
                  f'{sorted(spl_sourcetypes) or "none"}')

    # -- R2: prose names a data model the SPL never queries -----------------
    # SPL writes both "datamodel=" and "FROM DATAMODEL=".
    spl_models = {
        m.lower() for m in re.findall(r"datamodel[=:\s]+([A-Za-z_][\w.]*)", spl, re.I)
    }
    spl_model_roots = {m.split(".")[0] for m in spl_models}
    for claimed in set(re.findall(r"datamodel[=\s]+([A-Z][\w.]*)", blob)):
        root = claimed.split(".")[0]
        # A bare capitalised word after "datamodel" is usually a sentence,
        # not a model name. Real model names are compound or well known.
        if "_" not in root and root.lower() not in KNOWN_MODELS:
            continue
        if root.lower() in spl_model_roots:
            continue
        # "why raw events instead of the data model" names a model to reject it.
        if CONTRAST_RE.search(_context(blob, claimed)):
            continue
        add("R2", f"prose names datamodel {claimed}; "
                  f"SPL queries {sorted(spl_model_roots) or 'none'}")

    # -- R3/R4: acceleration claims vs the actual pipeline ------------------
    uses_tstats = bool(re.search(r"\|\s*tstats\b", spl, re.I))
    claims_tstats = bool(re.search(r"\btstats\b", blob, re.I))
    claims_accel = bool(re.search(
        r"\baccelerat\w+\b|\bsummaries\s?only\b|summariesonly", blob, re.I))

    if (claims_tstats or claims_accel) and not uses_tstats:
        why = "tstats" if claims_tstats else "acceleration"
        probe = "tstats" if claims_tstats else "accelerat"
        # Several stanzas explain at length that they deliberately avoid
        # tstats, or that the upstream panel they came from used it.
        if not CONTRAST_RE.search(_context(blob, probe)):
            add("R3", f"prose claims {why}; SPL has no tstats command")

    if uses_tstats and re.search(r"\braw events?\b|\bnon-accelerated\b", blob, re.I):
        # `scd_summariesonly` really does fall back to raw events, and saying
        # so is correct even on a tstats search.
        if not CONTRAST_RE.search(_context(blob, "raw event")):
            add("R4", "prose says raw events; SPL is a tstats/datamodel search")

    # -- R5: prose names an index macro the SPL never expands ---------------
    spl_macros = set(re.findall(r"`(index_[a-z0-9_]+)`", raw_spl))
    for claimed in set(re.findall(r"\b(index_[a-z0-9_]+)\b", blob)):
        if claimed in spl_macros:
            continue
        if CONTRAST_RE.search(_context(blob, claimed)):
            continue
        add("R5", f"prose names `{claimed}`; SPL uses {sorted(spl_macros) or 'none'}")

    # -- R6: prose presents a command the search does not run ---------------
    for cmd in SPL_COMMANDS:
        as_command = (
            cmd in [c.strip() for c in codes]
            or re.search(rf"\|\s*{cmd}\b", blob, re.I)
            or re.search(rf"\b{cmd}\s+command\b", blob, re.I)
        )
        if not as_command or re.search(rf"\|\s*{cmd}\b", spl, re.I):
            continue
        # Most hits are advice ("wrap the counters in streamstats"), contrast
        # ("without mvexpand"), or a note about the upstream panel.
        near = _context(blob, cmd)
        if CONTRAST_RE.search(near) or SUGGESTION_RE.search(near):
            continue
        add("R6", f"prose presents <code>{cmd}</code> as the command; "
                  f"SPL does not use it")

    # -- R7: a numeric "top N" that the SPL does not impose -----------------
    limits = {int(n) for n in re.findall(r"\|\s*head\s+(\d+)", spl, re.I)}
    limits |= {int(n) for n in re.findall(r"\|\s*sort\s+(\d+)", spl, re.I)}
    for claimed in {int(n) for n in re.findall(r"\btop\s+(\d{1,3})\b", blob, re.I)}:
        if limits and claimed not in limits:
            add("R7", f"prose says top {claimed}; SPL limits are {sorted(limits)}")

    # -- R8: asserts a verified state of someone else's environment ---------
    for m in re.finditer(r"\b(confirmed|validated|verified)\b", blob, re.I):
        near = blob[max(0, m.start() - 80): m.end() + 80]
        if not re.search(
            r"datamodel|data model|accelerat|source ?type|model\b|member\b",
            near, re.I,
        ):
            continue
        add("R8", f"asserts {m.group(1).lower()} environment state: ...{near.strip()}...")

    # -- R9: cross-references a search name that does not exist -------------
    for ref in set(re.findall(r"<i>([^<]{6,90})</i>", " ".join(prose.values()))):
        ref = html.unescape(ref).strip()
        if not re.fullmatch(r"^[A-Z][\w\s\-:&.,'/()]+$", ref):
            continue
        if any(ref.lower() in n.lower() for n in ALL_NAMES):
            continue
        # <i> also marks column values ("Degraded"), UI affordances ("Open in
        # Search"), and panel titles in other apps. Every catalogue name has
        # the "Area - Detail" shape, so require it before calling something a
        # broken cross-reference.
        if " - " not in ref:
            continue
        add("R9", f"references search name {ref!r}, which matches no catalogue name")

    # -- R10: a span the SPL does not use -----------------------------------
    is_span = lambda v: bool(re.fullmatch(r"auto|\d+[smhdw]", v, re.I))
    spl_spans = {v for v in re.findall(r"span\s*=\s*([\w]+)", spl) if is_span(v)}
    for claimed in set(re.findall(r"span\s*=\s*([\w]+)", blob)):
        # "span=bucketing" is prose, not a span value.
        if spl_spans and is_span(claimed) and claimed not in spl_spans:
            add("R10", f"prose says span={claimed}; SPL uses span={sorted(spl_spans)}")

    # -- R11: prose claims the search reads a field it never touches --------
    spl_lower = (raw_spl + " " + spl).lower()
    for c in codes:
        c = c.strip()
        if not re.fullmatch(r"[A-Za-z_][\w.]{2,60}", c):
            continue
        low = c.lower()
        if low in spl_lower:
            continue
        # <code> also marks dashboard ids, add-on names, stanza ids, macros,
        # filenames, and SPL keywords -- none of them field claims.
        if (
            c.startswith(("ds_", "ta_", "Splunk_TA", "TA_", "_"))
            or c.endswith(("_app", "_for_splunk", "_demo", "_lookup"))
            or low.startswith("index_")
            or "_ds_" in low
            or low in ALL_STANZA_IDS
            or low in MACROS
            or re.search(r"\.(conf|xml|csv|json|md|spec|py|tsx?)$", low)
            or re.fullmatch(r"(?:true|false|null|and|or|not|as|by|where|in)", low)
            or low in NOT_FIELDS
        ):
            continue
        # <code> also wraps field *values* -- "action indicates Deny",
        # "scoreType is WIRELESS", "status Unreachable". A value is not a
        # claim about the schema. Real field names in this catalogue are
        # snake_case, dotted CIM paths, or camelCase; require one of those
        # shapes so an ALL-CAPS or Capitalised bare word cannot qualify.
        field_shaped = (
            "_" in c or "." in c or re.search(r"[a-z][A-Z]", c)
        )
        if not field_shaped:
            continue
        # A dotted path whose root is a model the SPL queries is the node
        # address, which SPL spells as DATAMODEL=root + nodename=rest.
        if "." in c and c.split(".")[0].lower() in spl_model_roots:
            continue
        # A UI component, not a field. Cheap and general: a PascalCase token
        # with a matching source file in the webapp is code, not schema.
        if re.fullmatch(r"[A-Z][A-Za-z0-9]+", c) and WEBAPP_COMPONENTS and c in WEBAPP_COMPONENTS:
            continue
        # Enumerations list example values, not fields: "HttpOperation on
        # PortPolicies, ServerRoles, ApiKeys". A field claim names one or two
        # fields; three or more unknown tokens in one sentence is a list of
        # values or of examples from the source system.
        if len([o for o in _absent_codes(codes, spl_lower)
                if o in _context(blob, c, 120)]) >= 3:
            continue
        near = _context(blob, c)
        # Only a sentence that asserts the search uses the field is a claim.
        if not CLAIM_RE.search(near):
            continue
        if CONTRAST_RE.search(near) or SUGGESTION_RE.search(near) or PROVENANCE_RE.search(near):
            continue
        add("R11", f"prose claims this search reads <code>{c}</code>; absent from SPL")

    # -- R12: prose cites a repository file that does not exist -------------
    # Provenance is only worth printing if a reader can go look. A citation
    # of a script or view that was never committed, or has since been
    # deleted, is worse than no citation: it asserts evidence exists.
    for cited in set(re.findall(r"[\w/.-]+\.(?:py|xml|csv|conf|json)", blob)):
        cited = cited.strip(".,;() ")
        if cited in FILE_WHITELIST or "/" not in cited:
            continue
        # Cross-app references are legitimate: cisco-catalyst-app views and
        # another app's data models are not supposed to be in this tree.
        # Only a path claiming to be OURS can be a broken citation.
        if not cited.startswith(("scripts/", "test/", "packages/")):
            continue
        if not (REPO / cited).exists() and not any(
            (REPO / base / cited).exists() for base in FILE_BASES
        ):
            add("R12", f"cites {cited}, which does not exist in the repo")

    # -- R13: a stanza cross-reference that is not in the catalogue ---------
    # R9 only sees <i>-wrapped display names. Stanza ids are written in
    # <code>, and a wrong one is worse than a wrong display name: it looks
    # authoritative and returns nothing from a catalogue lookup.
    for cited in {c.strip() for c in codes}:
        low = cited.lower()
        if low == sid.lower() or low in ALL_STANZA_IDS:
            continue
        # Long snake_case alone is not distinctive: CIM-ish field names like
        # device_health_ip_address have the same shape. A stanza id also
        # shares its leading namespace with real stanzas ("overview_",
        # "secure_networking_"), so require that. Derived from the catalogue
        # rather than hardcoded, so new workspaces need no maintenance here.
        if cited != low or not re.fullmatch(r"[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}", low):
            continue
        if "_".join(low.split("_")[:2]) not in STANZA_PREFIXES:
            continue
        if low in MACROS or re.search(r"\.(conf|xml|csv|json|py)$", low):
            continue
        # A token the SPL itself contains is a lookup or field this search
        # uses -- site_topology_lookup, not a pointer to another stanza.
        if low in spl_lower:
            continue
        add("R13", f"cross-references stanza <code>{cited}</code>, "
                   f"which is not in the catalogue")

    return out


def main() -> int:
    global MACROS, ALL_NAMES, ALL_STANZA_IDS, STANZA_PREFIXES, WEBAPP_COMPONENTS

    ap = argparse.ArgumentParser()
    ap.add_argument("--rule", help="show findings for one rule, e.g. R5")
    ap.add_argument("--stanza", help="show findings for one stanza id")
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("--show-allowed", action="store_true",
                    help="include findings reviewed as sound prose")
    args = ap.parse_args()

    text = SOURCE.read_text()
    chunks = chunks_of(text)
    MACROS = load_macros()
    ALL_NAMES = {field(c, "search_name") for c in chunks}
    ALL_STANZA_IDS = {re.match(r"^\[([^\]]+)\]", c).group(1).lower() for c in chunks}
    STANZA_PREFIXES = {"_".join(s.split("_")[:2]) for s in ALL_STANZA_IDS}
    webapp = REPO / "packages/splunk-cisco-dashboards/src/main/webapp"
    WEBAPP_COMPONENTS = {f.stem for f in webapp.rglob("*.tsx")} if webapp.exists() else set()

    findings = [f for c in chunks for f in audit(c)]

    # Reviewed-and-sound findings move aside so the report can reach zero,
    # but stale entries are surfaced: an allowlist that outlives the prose it
    # excuses would hide the next real defect in that stanza.
    suppressed = [f for f in findings if is_allowed(f["stanza"], f["rule"], f["detail"])]
    if not args.show_allowed:
        findings = [f for f in findings if f not in suppressed]
    stale = [
        (s, r, p) for s, r, p, _ in ALLOWED
        if not any(f["stanza"] == s and f["rule"] == r and p in f["detail"]
                   for f in suppressed)
    ]

    if args.stanza:
        findings = [f for f in findings if f["stanza"] == args.stanza]
    if args.rule:
        findings = [f for f in findings if f["rule"] == args.rule]

    affected = {f["stanza"] for f in findings}
    print(f"{len(chunks)} stanzas audited, {len(findings)} findings, "
          f"{len(affected)} stanzas affected")
    print(f"{len(suppressed)} findings allowlisted as sound prose "
          f"(--show-allowed to see them)\n")
    if stale:
        print(f"WARNING: {len(stale)} allowlist entries no longer match any "
              f"finding; the prose changed and the entry should go:")
        for s_, r_, p_ in stale:
            print(f"  - {s_} {r_} {p_!r}")
        print()

    if args.rule or args.stanza:
        for f in findings[: args.limit]:
            print(f"  {f['name'][:60]:<60} {f['detail']}")
        if len(findings) > args.limit:
            print(f"  ... {len(findings) - args.limit} more")
        return 0

    for rule, blurb in RULES.items():
        hits = [f for f in findings if f["rule"] == rule]
        print(f"  {rule:<4} {len(hits):>4} findings   "
              f"{len({f['stanza'] for f in hits}):>4} stanzas   {blurb}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
