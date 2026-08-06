#!/usr/bin/env python3
"""Match searchbase.conf stanzas to dCloud dashboard queries (splunk-cisco-dashboards local views)."""

from __future__ import annotations

import configparser
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable

from defusedxml import ElementTree as ET
from defusedxml.common import DefusedXmlException

APPS_ROOT = Path("/opt/10/etc/apps")
DCLOUD_VIEWS_DIR = Path(
    "/opt/10/etc/apps/splunk-cisco-dashboards/local/data/ui/views"
)
DCLOUD_APP_NAME = "dCloud"
DCLOUD_SKIP_VIEWS = {"scd_Test1.xml"}
SEARCHBASE_PATH = Path(
    "/Users/akhamis/repo/splunk-cisco-dashboards/"
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
OUTPUT_PATH = Path(
    "/Users/akhamis/repo/splunk-cisco-dashboards/"
    "docs/searchbase-dashboard-matches.csv"
)
UNMATCHED_PATH = Path(
    "/Users/akhamis/repo/splunk-cisco-dashboards/"
    "docs/searchbase-dashboard-unmatched.csv"
)
CONFIDENCE_THRESHOLD = 0.5
MAX_MATCHES_PER_STANZA = 5
MAX_SNIPPET_LEN = 180

# Downstream / derivative apps whose dashboards were built from searchbase.conf,
# not upstream Cisco TA sources we are trying to identify.
EXCLUDED_APP_DIRS = {
    "splunk-cisco-dashboards",
    "splunk_insights",
    "splunk-cisco-app-navigator",
    "splunk-dashboard-studio",
    "splunk_monitoring_console",
    "search",
    "launcher",
    "learned",
}

GENERIC_PATTERNS = [
    r"\|\s*rest\s+",
    r"\|\s*metadata\s+",
    r"\|\s*inputlookup\s+",
    r"\|\s*makeresults\s+",
    r"\|\s*dbinspect\s+",
    r"\|\s*eventcount\s+",
    r"splunk_server=local",
    r"services/apps/local",
]

SKIP_QUERY_PATTERNS = [
    r"^\s*\|\s*rest\s+services/apps/local",
    r"^\s*\|\s*rest\s+/servicesNS",
    r"^\s*\|\s*rest\s+/services/",
    r"^\s*\|\s*rest\s+services/apps/local",
    r"^\s*\|\s*rest\s+.*splunk_server=local.*\|\s*fields\s+version",
]

# Map sourcetype families to Cisco Security Cloud datamodel/dashboard signals.
# Tuple: (sourcetype prefix, dataset substrings, dashboard file substrings, product key)
PRODUCT_FAMILIES: list[tuple[str, list[str], list[str], str]] = [
    ("cisco:xdr", ["xdr_dataset"], ["xdr_dashboard"], "xdr"),
    ("cisco:secure:workload", ["csw_dataset"], ["csw_dashboard"], "secure_workload"),
    ("cisco:ai:defense", ["ai:defense", "ai_defense"], ["aid_dashboard"], "ai_defense"),
    ("cisco:cii", ["cii_dataset"], ["cii_dashboard"], "cloud_security"),
    ("cisco:etd", ["email_threat", "secure_email"], ["etd_dashboard"], "etd"),
    ("cisco:cvi", ["cvm_dataset", "cisco:cvi"], ["cvi_dashboard"], "cvi"),
    ("cisco:sna", ["secure_network_analytics", "cisco:sna"], ["sna"], "sna"),
    ("cisco:multicloud:defense", ["mcd_"], ["mcd_dashboard"], "mcd"),
    ("cisco:cloud_security", ["cii_dataset", "cloud_security"], ["cii_dashboard"], "cloud_security"),
    ("cisco:asa", ["asa_dataset", "cisco:asa"], ["asa_dashboard"], "asa"),
    ("cisco:duo", ["duo_"], ["duo_overview"], "duo"),
    ("cisco:esa", ["email_threat", "secure_email"], ["etd_dashboard"], "esa"),
    ("cisco:sma", ["malware_analytics", "secure_malware"], ["sma"], "sma"),
    ("cisco:sfw", ["secure_firewall"], ["secure_firewall", "advanced_logging"], "secure_firewall"),
    ("cisco:estreamer", ["secure_firewall", "estreamer"], ["secure_firewall", "advanced_logging"], "secure_firewall"),
    ("cisco:ftd", ["secure_firewall"], ["secure_firewall", "advanced_logging"], "secure_firewall"),
    ("cisco:firepower", ["secure_firewall"], ["secure_firewall"], "secure_firewall"),
    ("ms:defender", ["security_endpoint", "endpoint"], ["cse_dashboard"], "secure_endpoint"),
    ("cisco:se", ["security_endpoint"], ["cse_dashboard"], "secure_endpoint"),
    ("cisco:ise:syslog", ["authentication"], [], "ise"),
    ("cisco:wsa", ["wsa"], ["wsa"], "wsa"),
    ("cisco:isovalent", ["isovalent"], ["isovalent"], "isovalent"),
]


@dataclass
class DashboardQuery:
    app_dir: str
    app_name: str
    dashboard_file: str
    dashboard_name: str
    query: str
    sourcetypes: set[str] = field(default_factory=set)
    datamodels: set[str] = field(default_factory=set)
    index_macros: set[str] = field(default_factory=set)
    tokens: set[str] = field(default_factory=set)
    product_keys: set[str] = field(default_factory=set)
    normalized: str = ""


@dataclass
class SearchStanza:
    stanza_id: str
    search_name: str
    search: str
    tags: str
    sourcetypes: set[str] = field(default_factory=set)
    datamodels: set[str] = field(default_factory=set)
    index_macros: set[str] = field(default_factory=set)
    tokens: set[str] = field(default_factory=set)
    product_keys: set[str] = field(default_factory=set)
    normalized: str = ""


def read_app_label(app_dir: Path) -> str:
    app_conf = app_dir / "default" / "app.conf"
    if not app_conf.exists():
        return app_dir.name
    cp = configparser.ConfigParser()
    cp.read(app_conf, encoding="utf-8")
    for section in ("ui", "launcher", "package"):
        if cp.has_section(section):
            for key in ("label", "description", "id"):
                if cp.has_option(section, key):
                    val = cp.get(section, key).strip()
                    if val:
                        return val
    return app_dir.name


def collapse_spl(text: str) -> str:
    text = text.replace("\\\n", " ").replace("\\\r\n", " ")
    text = re.sub(r"\s+", " ", text.strip())
    return text


def normalize_spl(text: str) -> str:
    text = collapse_spl(text).lower()
    text = re.sub(r"\$(\w+)\.[\w.$]+\$", r"$\1$", text)
    text = re.sub(r"`[^`]+`", "`macro`", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_sourcetypes(text: str) -> set[str]:
    found: set[str] = set()
    for m in re.finditer(
        r'sourcetype\s*=\s*["\']?([^"\')\s,]+)["\']?',
        text,
        re.I,
    ):
        val = m.group(1).lower()
        if val not in {"*", "in"}:
            found.add(val)
    for m in re.finditer(
        r'sourcetype\s*IN\s*\(([^)]+)\)',
        text,
        re.I,
    ):
        for part in re.split(r",", m.group(1)):
            val = part.strip().strip("\"'")
            if val and val.lower() not in {"*", "in"}:
                found.add(val.lower())
    return found


def extract_datamodels(text: str) -> set[str]:
    found: set[str] = set()
    for m in re.finditer(
        r"(?:from\s+)?datamodel(?:=|:)\s*([A-Za-z0-9_.:-]+)",
        text,
        re.I,
    ):
        found.add(m.group(1))
    for m in re.finditer(
        r"\|\s*from\s+datamodel:([A-Za-z0-9_.:-]+)",
        text,
        re.I,
    ):
        found.add(m.group(1))
    return found


def extract_index_macros(text: str) -> set[str]:
    return {m.group(1).lower() for m in re.finditer(r"`([^`]+)`", text)}


def extract_tokens(text: str) -> set[str]:
    tokens: set[str] = set()
    tokens |= extract_sourcetypes(text)
    tokens |= {dm.lower() for dm in extract_datamodels(text)}
    tokens |= extract_index_macros(text)
    for m in re.finditer(r"\b([a-zA-Z_][\w.:-]{2,})\b", text):
        tok = m.group(1).lower()
        if tok in {"search", "index", "where", "stats", "eval", "timechart", "table", "sort", "by", "as", "from", "and", "or", "not", "in", "null", "true", "false", "latest", "earliest", "now", "count", "avg", "sum", "values", "dc", "first", "last", "rename", "fields", "head", "tail", "append", "join", "lookup", "output", "fillnull", "coalesce", "case", "match", "isnotnull", "isnull", "if", "round", "tostring", "strftime", "relative_time", "mvindex", "mvjoin", "mvfilter", "mvexpand", "split", "replace", "lower", "upper", "trim", "len", "like", "top", "rare", "dedup", "eventstats", "streamstats", "chart", "xyseries", "tstats", "pivot", "datamodel", "sourcetype", "action", "all_traffic", "authentication", "failed_authentication"}:
            continue
        if re.match(r"^\d", tok):
            continue
        tokens.add(tok)
    return tokens


def sourcetype_matches_prefix(sourcetype: str, prefix: str) -> bool:
    st = sourcetype.lower().rstrip("*")
    pf = prefix.lower().rstrip("*")
    return st == pf or st.startswith(f"{pf}:")


def derive_product_keys_from_sourcetypes(sourcetypes: set[str]) -> set[str]:
    keys: set[str] = set()
    for st in sourcetypes:
        for prefix, _, _, product in PRODUCT_FAMILIES:
            if sourcetype_matches_prefix(st, prefix):
                keys.add(product)
    return keys


def derive_product_keys_from_datamodels(datamodels: set[str]) -> set[str]:
    keys: set[str] = set()
    for dm in datamodels:
        dm_lower = dm.lower()
        for _, datasets, _, product in PRODUCT_FAMILIES:
            if any(ds in dm_lower for ds in datasets):
                keys.add(product)
    return keys


def derive_product_keys_from_dashboard(dashboard_file: str) -> set[str]:
    keys: set[str] = set()
    fname = dashboard_file.lower()
    for _, _, dashboards, product in PRODUCT_FAMILIES:
        if any(dash in fname for dash in dashboards):
            keys.add(product)
    return keys


def enrich_product_keys(
    obj: DashboardQuery | SearchStanza,
    dashboard_file: str | None = None,
) -> None:
    obj.product_keys = set()
    obj.product_keys |= derive_product_keys_from_sourcetypes(obj.sourcetypes)
    obj.product_keys |= derive_product_keys_from_datamodels(obj.datamodels)
    if dashboard_file:
        obj.product_keys |= derive_product_keys_from_dashboard(dashboard_file)


def enrich_query_obj(
    obj: DashboardQuery | SearchStanza,
    dashboard_file: str | None = None,
) -> None:
    text = obj.search if hasattr(obj, "search") else obj.query
    obj.sourcetypes = extract_sourcetypes(text)
    obj.datamodels = extract_datamodels(text)
    obj.index_macros = extract_index_macros(text)
    obj.tokens = extract_tokens(text)
    obj.normalized = normalize_spl(text)
    enrich_product_keys(obj, dashboard_file=dashboard_file)


def should_skip_query(query: str) -> bool:
    q = collapse_spl(query)
    for pat in SKIP_QUERY_PATTERNS:
        if re.search(pat, q, re.I):
            return True
    return len(q) < 12


def is_generic_search(text: str) -> bool:
    norm = normalize_spl(text)
    hits = sum(1 for pat in GENERIC_PATTERNS if re.search(pat, norm, re.I))
    if hits >= 2:
        return True
    if hits == 1 and not extract_sourcetypes(text) and not extract_datamodels(text):
        return True
    return False


def is_data_integrity_boilerplate(query: DashboardQuery) -> bool:
    if query.dashboard_file != "data_integrity_overview.xml":
        return False
    norm = normalize_spl(query.query)
    return bool(
        re.search(r"\|\s*tstats\s+prestats\s*=\s*t\s+count\s+where\s+index\s+in", norm, re.I)
        or re.search(r"\|\s*tstats\s+count\s+where\s+index\s+in", norm, re.I)
    )


def is_metadata_dashboard(query: DashboardQuery) -> bool:
    return query.dashboard_file in {
        "data_integrity_overview.xml",
        "resource_utilization.xml",
    }


def parse_searchbase(path: Path) -> list[SearchStanza]:
    stanzas: list[SearchStanza] = []
    current_id: str | None = None
    current: dict[str, str] = {}
    search_lines: list[str] = []
    in_search = False

    def flush() -> None:
        nonlocal current_id, current, search_lines, in_search
        if not current_id:
            return
        search_text = collapse_spl(" ".join(search_lines))
        stanza = SearchStanza(
            stanza_id=current_id,
            search_name=current.get("search_name", current_id),
            search=search_text,
            tags=current.get("tags", ""),
        )
        enrich_query_obj(stanza)
        stanzas.append(stanza)
        current_id = None
        current = {}
        search_lines = []
        in_search = False

    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.rstrip()
        if line.startswith("[") and line.endswith("]") and not line.startswith("[default]"):
            flush()
            current_id = line[1:-1].strip()
            continue
        if current_id is None:
            continue
        if line.startswith("search ="):
            in_search = True
            search_lines = [line.split("=", 1)[1].strip()]
            continue
        if in_search and line.endswith("\\"):
            search_lines.append(line[:-1].strip())
            continue
        if in_search and (line.startswith("|") or (search_lines and not re.match(r"^[a-zA-Z_][\w ]+\s*=", line))):
            search_lines.append(line.strip())
            continue
        if in_search:
            in_search = False
        if "=" in line and not line.startswith("#"):
            key, val = line.split("=", 1)
            current[key.strip()] = val.strip()
    flush()
    return stanzas


def extract_xml_queries(xml_path: Path) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    try:
        text = xml_path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return results

    dashboard_label = xml_path.stem.replace("_", " ")
    label_match = re.search(r"<label>([^<]+)</label>", text, re.I)
    if label_match:
        dashboard_label = label_match.group(1).strip()

    # Dashboard Studio JSON embedded in <definition><![CDATA[...]]></definition>
    for m in re.finditer(
        r"<definition>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*</definition>",
        text,
        re.I,
    ):
        blob = m.group(1).strip()
        try:
            data = json.loads(blob)
        except json.JSONDecodeError:
            continue
        ds = data.get("dataSources") or {}
        if isinstance(ds, dict):
            for ds_obj in ds.values():
                if not isinstance(ds_obj, dict):
                    continue
                opts = ds_obj.get("options") or {}
                query = opts.get("query") or opts.get("queryParameters", {}).get("query")
                if isinstance(query, str) and query.strip():
                    name = ds_obj.get("name") or dashboard_label
                    results.append((dashboard_label if name == dashboard_label else f"{dashboard_label} / {name}", query))

    # Traditional XML <search><query>...</query></search>
    try:
        root = ET.fromstring(
            text,
            forbid_dtd=True,
            forbid_entities=True,
            forbid_external=True,
        )
    except DefusedXmlException:
        # Reject the entire dashboard rather than falling back to regex parsing
        # when the document contains a DTD, entity, or external reference.
        return []
    except ET.ParseError:
        root = None
    if root is not None:
        for search_el in root.iter("search"):
            query_el = search_el.find("query")
            if query_el is not None and query_el.text and query_el.text.strip():
                results.append((dashboard_label, query_el.text.strip()))

    # Fallback regex for malformed XML
    if not results:
        for m in re.finditer(r"<query>([\s\S]*?)</query>", text, re.I):
            q = m.group(1).strip()
            if q and not should_skip_query(q):
                results.append((dashboard_label, q))

    deduped: list[tuple[str, str]] = []
    seen: set[str] = set()
    for name, q in results:
        key = normalize_spl(q)
        if key in seen or should_skip_query(q):
            continue
        seen.add(key)
        deduped.append((name, q))
    return deduped


def extract_json_dashboard_queries(json_path: Path) -> list[tuple[str, str]]:
    results: list[tuple[str, str]] = []
    try:
        data = json.loads(json_path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError):
        return results
    dashboard_label = json_path.stem.replace("_", " ")
    if isinstance(data, dict):
        dashboard_label = data.get("title") or data.get("label") or dashboard_label
        ds = data.get("dataSources") or {}
        if isinstance(ds, dict):
            for ds_obj in ds.values():
                if not isinstance(ds_obj, dict):
                    continue
                opts = ds_obj.get("options") or {}
                query = opts.get("query")
                if isinstance(query, str) and query.strip() and not should_skip_query(query):
                    name = ds_obj.get("name") or dashboard_label
                    results.append((f"{dashboard_label} / {name}" if name != dashboard_label else dashboard_label, query))
    return results


def collect_dashboard_queries(_apps_root: Path) -> list[DashboardQuery]:
    queries: list[DashboardQuery] = []
    views_dir = DCLOUD_VIEWS_DIR
    if not views_dir.exists():
        print(f"ERROR: dCloud views dir not found: {views_dir}", file=sys.stderr)
        return queries

    dashboard_files: list[str] = []
    for view_file in sorted(views_dir.iterdir()):
        if not view_file.is_file() or view_file.name in DCLOUD_SKIP_VIEWS:
            continue
        if view_file.suffix.lower() not in {".xml", ".json"}:
            continue
        dashboard_files.append(view_file.name)
        if view_file.suffix.lower() == ".xml":
            extracted = extract_xml_queries(view_file)
        else:
            extracted = extract_json_dashboard_queries(view_file)
        for dash_name, query in extracted:
            obj = DashboardQuery(
                app_dir="splunk-cisco-dashboards",
                app_name=DCLOUD_APP_NAME,
                dashboard_file=view_file.name,
                dashboard_name=dash_name,
                query=query,
            )
            enrich_query_obj(obj, dashboard_file=view_file.name)
            queries.append(obj)
    print(
        f"  scanned {len(dashboard_files)} dCloud dashboards under local/data/ui/views",
        file=sys.stderr,
    )
    return queries


def anchor_overlap(a: SearchStanza, b: DashboardQuery) -> tuple[float, list[str]]:
    notes: list[str] = []
    score_parts: list[float] = []

    product_overlap = a.product_keys & b.product_keys
    if product_overlap:
        notes.append(f"matched product={','.join(sorted(product_overlap)[:3])}")
        score_parts.append(0.40)

    st_overlap = a.sourcetypes & b.sourcetypes
    if st_overlap:
        notes.append(f"matched sourcetype={','.join(sorted(st_overlap)[:3])}")
        score_parts.append(0.35)

    dm_overlap = a.datamodels & b.datamodels
    if dm_overlap:
        notes.append(f"matched datamodel={','.join(sorted(dm_overlap)[:2])}")
        score_parts.append(0.35)

    macro_overlap = a.index_macros & b.index_macros
    if macro_overlap:
        notes.append(f"matched macro={','.join(sorted(macro_overlap)[:3])}")
        score_parts.append(min(0.15, 0.05 * len(macro_overlap)))

    if not score_parts:
        if a.sourcetypes and b.sourcetypes:
            return 0.0, ["sourcetype mismatch"]
        if a.datamodels and b.datamodels:
            return 0.0, ["datamodel mismatch"]
        token_overlap = a.tokens & b.tokens
        if len(token_overlap) < 3:
            return 0.0, ["insufficient shared tokens"]
        score_parts.append(0.05)

    return min(0.75, sum(score_parts)), notes


def build_query_index(queries: list[DashboardQuery]) -> dict[str, list[DashboardQuery]]:
    index: dict[str, list[DashboardQuery]] = defaultdict(list)
    for q in queries:
        keys = set()
        for st in q.sourcetypes:
            keys.add(f"st:{st}")
        for dm in q.datamodels:
            keys.add(f"dm:{dm.lower()}")
        for macro in q.index_macros:
            keys.add(f"macro:{macro}")
        for product in q.product_keys:
            keys.add(f"prod:{product}")
        if not keys:
            keys.add("generic")
        for key in keys:
            index[key].append(q)
    return index


def candidate_queries(
    stanza: SearchStanza, index: dict[str, list[DashboardQuery]]
) -> list[DashboardQuery]:
    keys: set[str] = set()
    for st in stanza.sourcetypes:
        keys.add(f"st:{st}")
    for dm in stanza.datamodels:
        keys.add(f"dm:{dm.lower()}")
    for macro in stanza.index_macros:
        keys.add(f"macro:{macro}")
    for product in stanza.product_keys:
        keys.add(f"prod:{product}")

    if keys:
        seen: set[int] = set()
        out: list[DashboardQuery] = []
        for key in keys:
            for q in index.get(key, []):
                qid = id(q)
                if qid not in seen:
                    seen.add(qid)
                    out.append(q)
        return out

    # No sourcetype/datamodel/macro/product anchors: fall back to token overlap prefilter.
    out = []
    for q in index.get("generic", []):
        if len(stanza.tokens & q.tokens) >= 3:
            out.append(q)
    return out


def similarity_score(a: SearchStanza, b: DashboardQuery) -> tuple[float, str]:
    anchor, anchor_notes = anchor_overlap(a, b)
    if anchor <= 0.0:
        return 0.0, anchor_notes[0] if anchor_notes else "no anchor overlap"

    seq = SequenceMatcher(None, a.normalized, b.normalized).ratio()
    token_a, token_b = a.tokens, b.tokens
    if token_a or token_b:
        jaccard = len(token_a & token_b) / max(1, len(token_a | token_b))
    else:
        jaccard = 0.0

    structural = 0.55 * seq + 0.45 * jaccard
    confidence = min(0.99, anchor + 0.55 * structural)

    notes = list(anchor_notes)
    if seq >= 0.85:
        notes.append("high sequence similarity")
    elif seq >= 0.65:
        notes.append("moderate sequence similarity")
    if jaccard >= 0.45:
        notes.append(f"token overlap {jaccard:.0%}")

    if is_generic_search(a.search) or is_generic_search(b.query):
        notes.append("generic/multi-app")
        confidence = min(confidence, 0.62)

    product_overlap = a.product_keys & b.product_keys
    if product_overlap and not (a.datamodels & b.datamodels) and not (a.sourcetypes & b.sourcetypes):
        notes.append("product-family bridge (sourcetype/datamodel)")
        confidence = max(confidence, 0.55 + 0.20 * structural)
        if not is_metadata_dashboard(b):
            confidence = max(confidence, 0.62)

    if is_data_integrity_boilerplate(b):
        notes.append("data integrity boilerplate")
        confidence = min(confidence, 0.52)
    elif b.dashboard_file == "resource_utilization.xml":
        notes.append("resource utilization meta-dashboard")
        confidence = min(confidence, 0.58)

    if a.normalized == b.normalized:
        notes.append("exact normalized match")
        confidence = 0.99

    return round(confidence, 2), "; ".join(notes)


def snippet(text: str) -> str:
    s = collapse_spl(text)
    if len(s) <= MAX_SNIPPET_LEN:
        return s
    return s[: MAX_SNIPPET_LEN - 3] + "..."


def main() -> int:
    print("Parsing searchbase.conf...", file=sys.stderr)
    stanzas = parse_searchbase(SEARCHBASE_PATH)
    print(f"  {len(stanzas)} stanzas", file=sys.stderr)

    print(f"Scanning dCloud dashboards under {DCLOUD_VIEWS_DIR}...", file=sys.stderr)
    dashboard_queries = collect_dashboard_queries(APPS_ROOT)
    print(f"  {len(dashboard_queries)} dashboard queries from dCloud", file=sys.stderr)

    query_index = build_query_index(dashboard_queries)
    matches: list[dict[str, str | float]] = []
    stanza_best: dict[str, float] = defaultdict(float)

    for i, stanza in enumerate(stanzas, 1):
        if i % 100 == 0:
            print(f"  matching stanza {i}/{len(stanzas)}...", file=sys.stderr)
        candidates: list[tuple[float, DashboardQuery, str]] = []
        for dq in candidate_queries(stanza, query_index):
            if not (stanza.product_keys & dq.product_keys):
                if stanza.tokens and dq.tokens:
                    quick = len(stanza.tokens & dq.tokens) / max(1, len(stanza.tokens | dq.tokens))
                    if quick < 0.08 and stanza.normalized[:40] not in dq.normalized:
                        continue
            conf, notes = similarity_score(stanza, dq)
            if conf >= CONFIDENCE_THRESHOLD:
                candidates.append((conf, dq, notes))

        candidates.sort(key=lambda x: (-x[0], x[1].app_name, x[1].dashboard_name))
        candidates = candidates[:MAX_MATCHES_PER_STANZA]

        if not candidates:
            matches.append(
                {
                    "stanza_id": stanza.stanza_id,
                    "app_name": "",
                    "dashboard_name": "",
                    "source_query_snippet": snippet(stanza.search),
                    "confidence": 0.0,
                    "notes": "unmatched",
                }
            )
            continue

        for conf, dq, notes in candidates:
            stanza_best[stanza.stanza_id] = max(stanza_best[stanza.stanza_id], conf)
            matches.append(
                {
                    "stanza_id": stanza.stanza_id,
                    "app_name": dq.app_name,
                    "dashboard_name": dq.dashboard_name,
                    "source_query_snippet": snippet(dq.query),
                    "confidence": conf,
                    "notes": notes,
                }
            )

    matches.sort(key=lambda r: (-float(r["confidence"]), str(r["app_name"]), str(r["stanza_id"])))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "stanza_id",
        "app_name",
        "dashboard_name",
        "source_query_snippet",
        "confidence",
        "notes",
    ]
    matched_rows = [m for m in matches if float(m["confidence"]) >= CONFIDENCE_THRESHOLD]
    unmatched_rows = [m for m in matches if m["notes"] == "unmatched"]

    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=fieldnames,
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(matched_rows)

    with UNMATCHED_PATH.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=["stanza_id", "search_name", "source_query_snippet", "notes"],
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\n",
        )
        writer.writeheader()
        for row in unmatched_rows:
            stanza = next(s for s in stanzas if s.stanza_id == row["stanza_id"])
            writer.writerow(
                {
                    "stanza_id": row["stanza_id"],
                    "search_name": stanza.search_name,
                    "source_query_snippet": row["source_query_snippet"],
                    "notes": row["notes"],
                }
            )

    matched_stanzas = {s for s, best in stanza_best.items() if best >= CONFIDENCE_THRESHOLD}
    unmatched_stanzas = len(stanzas) - len(matched_stanzas)
    unique_apps = len({m["app_name"] for m in matched_rows if m["app_name"]})
    total_matches = len(matched_rows)

    summary_path = OUTPUT_PATH.with_suffix(".summary.txt")
    summary = (
        f"Total potential matches: {total_matches}\n"
        f"Unique apps matched: {unique_apps}\n"
        f"Unmatched stanzas: {unmatched_stanzas}\n"
        f"Total stanzas: {len(stanzas)}\n"
        f"Dashboard queries scanned: {len(dashboard_queries)}\n"
        f"Max matches per stanza: {MAX_MATCHES_PER_STANZA}\n"
        f"Provenance source: {DCLOUD_APP_NAME} ({DCLOUD_VIEWS_DIR})\n"
        f"Skipped dCloud views: {', '.join(sorted(DCLOUD_SKIP_VIEWS)) or '(none)'}\n"
        f"Confidence threshold: {CONFIDENCE_THRESHOLD}\n"
        f"Matches output: {OUTPUT_PATH}\n"
        f"Unmatched output: {UNMATCHED_PATH}\n"
    )
    summary_path.write_text(summary, encoding="utf-8")

    print(summary, file=sys.stderr)
    print(f"Wrote {OUTPUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
