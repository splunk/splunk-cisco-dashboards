#!/usr/bin/env python3
"""
Rewrite searchbase.conf description fields to plain, non-technical language.

Rules:
  - Descriptions must be readable by anyone, including non-coders.
  - No SPL commands, sourcetype names, field paths, or internal codes.
  - The explanation field retains all technical depth.
  - makeresults (synthetic/demo) stanzas are left unchanged.
"""

import re
import sys
from pathlib import Path

CONF_PATH = Path("packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf")


# ---------------------------------------------------------------------------
# Phase 1: Strip technical <code> blocks
# ---------------------------------------------------------------------------
def strip_technical_code_blocks(html: str) -> str:
    def replace_code(m):
        inner = m.group(1)
        # Sourcetype pattern: word:word[:word...]
        if re.search(r'^[a-z_]+(?::[a-z_*]+)+$', inner.strip()):
            return ""
        # Dotted field path: lower.case.path or camelCase.dotted
        if re.search(r'^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z_${}][a-zA-Z0-9_${}]*)+$', inner.strip()):
            return ""
        # Backtick macro
        if inner.strip().startswith("`") or inner.strip().endswith("`"):
            return ""
        # SPL command names and function calls
        spl = (
            r'^(?:tstats|timechart|stats|eval|appendpipe|dedup|eventstats|'
            r'where|join type|lookup|rex|rename|fillnull|sort|head|tail|fields|'
            r'table|bin\b|inputlookup|outputlookup|datamodel|summariesonly|'
            r'makeresults|dc\(|latest\(|earliest\(|max\(|min\(|avg\(|sum\(|'
            r'values\(|round\(|coalesce\(|if\(|case\(|match\(|isnotnull\(|'
            r'isnull\(|strftime\(|strptime\(|bins=\d|span=|_time|'
            r'index=[a-z_*]+|sourcetype|DATAMODEL=|nodename=|'
            r'All_Traffic|Network_Traffic|Authentication|Cisco_Security|'
            r'Cisco_ThousandEyes|splunk_resource_usage)'
        )
        if re.match(spl, inner.strip(), flags=re.IGNORECASE):
            return ""
        # Looks like a Splunk search fragment
        if "|" in inner or inner.strip().startswith("search "):
            return ""
        return m.group(0)

    return re.sub(r'<code>(.*?)</code>', replace_code, html)


# ---------------------------------------------------------------------------
# Phase 2: Strip technical phrases from plain text
# ---------------------------------------------------------------------------
# Patterns: (regex, replacement)
TECH_TEXT_RULES = [
    # Bucket / span language
    (r'[Bb]ucket width (?:is chosen by|tracks) the dashboard time picker[^.]*\.?', ""),
    (r'[Nn]o hardcoded <code>[^<]*</code>[^.]*\.?', ""),
    (r'(?:via|using|through) <code>[^<]+</code>\s*(?:macro|command)?[.,]?', ""),
    (r'\(<code>[^<]+</code>\)', ""),
    (r'<code>[^<]+</code> macro', ""),
    (r'\bbin _time bins=\d+\b', ""),
    (r'\bbins=\d+\b', ""),
    (r'\bspan=\w+\b', ""),
    (r'\b200 evenly.sized buckets\b', ""),
    # Technical adjectives
    (r'\btime-selector-adaptive\b\s*', ""),
    (r'\bauto-spanned\b\s*', ""),
    (r'\bper-MAC deduplication\b', "deduplication"),
    (r'\bper-MAC\b', "per device"),
    (r'\bper-SSID\b', "per network"),
    (r'\bper-event\b', ""),
    (r'\bmulti-level\b', ""),
    (r'\btime-series\b', "trend"),
    (r'\btimechart\b', ""),
    (r'\btstats\b', ""),
    (r'\bstats\b\s+(?:dc|avg|sum|latest|max|min|values)\b', ""),
    (r'\bstats\b', ""),
    (r'\beval\b', ""),
    (r'\bappendpipe\b', ""),
    (r'\bdedup\b', ""),
    (r'\beventstats\b', ""),
    (r'\bjoin type=\w+\b', ""),
    # Sourcetype references in plain text (outside code blocks)
    (r'\bcisco:[a-z:_*]+\b', ""),
    (r'\bmeraki:[a-z:_*]+\b', ""),
    (r'\bzeek:[a-z_*]+\b', ""),
    (r'\bsplunk:[a-z:_*]+\b', ""),
    (r'\bdhcpd\b', "DHCP"),
    (r'\bendace_weird\b', "Endace"),
    (r'\bXmlWinEventLog\b', "Windows Event Log"),
    (r'\bDhcpSrvLog\b', "DHCP log"),
    # ALL_CAPS event types → plain English
    (r'\bDEVICE_PRESENCE\b', "device presence data"),
    (r'\bDEVICE_LOCATION_UPDATE\b', "location updates"),
    (r'\bDEVICE_ASSOCIATION\b', "Wi-Fi association data"),
    (r'\bSPACE_OCCUPANCY\b', "room occupancy data"),
    (r'\bUSER_PRESENCE\b', "user presence data"),
    (r'\bWEBEX_TELEMETRY\b', "Webex device telemetry"),
    (r'\bCAMERA_COUNT\b', "camera count data"),
    (r'\bDEVICE_COUNT\b', "device count data"),
    (r'\bDEVICE_SENSOR\b', "sensor data"),
    (r'\bCAMERA_ANALYTICS\b', "camera analytics"),
    (r'\bSPACE_SENSOR\b', "space sensor data"),
    (r'\bFIT_DEVICE_PRESENCE\b', "device presence"),
    (r'\bCISE_Passed_Authentications\b', "passed authentications"),
    (r'\bCISE_Failed_Attempts\b', "failed authentication attempts"),
    # Message/event codes → remove bare numeric codes
    (r'\s*\(?\b(?:5200|5400|4624|4625|4740|4672|111008|111010)\b(?:/\d{4,5})?\)?', ""),
    # Data model node paths in plain text
    (r'\bAll_Traffic\.[A-Za-z_.]+\b', "network traffic"),
    (r'\bAuthentication\.[A-Za-z_.]+\b', "authentication data"),
    (r'\bCisco_Security\.[A-Za-z_.]+\b', "security event data"),
    (r'\bCisco_ThousandEyes\.[A-Za-z_.]+\b', "ThousandEyes data"),
    (r'\bNetwork_Traffic\.[A-Za-z_.]+\b', "network traffic data"),
    # camelCase.field.paths that sneaked through
    (r'\b[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9]*){2,}\b', ""),
    # Priority codes P1/P2 etc. → plain labels
    (r'\bP1\b', "critical priority"),
    (r'\bP2\b', "high priority"),
    (r'\bP3\b', "medium priority"),
    # "KPI" is fine, but "tstats KPI" isn't — already caught above
    # Phrases that describe Splunk mechanics, not business value
    (r'via <code>[^<]+</code>[^.]*\.?', ""),
    (r'through the <code>[^<]+</code> macro[^.]*\.?', ""),
    (r'using <code>[^<]+</code>[^.]*\.?', ""),
    (r'emitting <code>[^<]+</code>[^.]*\.?', ""),
    (r'with <code>[^<]+</code>[^.]*(?:pattern|idiom|output)[^.]*\.?', ""),
    (r'\bkv_store\b', "key-value store"),
    (r'\bsummariesonly\b', ""),
    (r'\bindex=[a-z_*]+\b', ""),
]


def strip_technical_phrases(html: str) -> str:
    for pattern, replacement in TECH_TEXT_RULES:
        html = re.sub(pattern, replacement, html, flags=re.IGNORECASE)
    return html


# ---------------------------------------------------------------------------
# Phase 3: HTML cleanup
# ---------------------------------------------------------------------------
def cleanup_html(html: str) -> str:
    # Remove empty bold/italic
    html = re.sub(r'<b>\s*</b>', '', html)
    html = re.sub(r'<i>\s*</i>', '', html)
    html = re.sub(r'<strong>\s*</strong>', '', html)
    # Fix orphaned parentheses that became empty
    html = re.sub(r'\(\s*\)', '', html)
    html = re.sub(r'\(\s*,', '(', html)
    html = re.sub(r',\s*\)', ')', html)
    html = re.sub(r'\(\s*\.\)', '.', html)
    # Fix double punctuation
    html = re.sub(r'([.,;])\s*([.,;])', r'\1', html)
    # Fix spaces before punctuation
    html = re.sub(r'\s+([.,;])', r'\1', html)
    # Fix multiple spaces
    html = re.sub(r'[ \t]{2,}', ' ', html)
    # Fix spaces after opening and before closing paragraph tags
    html = re.sub(r'<p>\s+', '<p>', html)
    html = re.sub(r'\s+</p>', '</p>', html)
    # Remove empty paragraphs
    html = re.sub(r'<p>\s*</p>', '', html)
    # Remove paragraph that is only whitespace or punctuation
    html = re.sub(r'<p>[.,\s]*</p>', '', html)
    return html.strip()


# ---------------------------------------------------------------------------
# Phase 4: Text content extraction (to check if enough substance remains)
# ---------------------------------------------------------------------------
def extract_text(html: str) -> str:
    return re.sub(r'<[^>]+>', '', html).strip()


# ---------------------------------------------------------------------------
# Phase 5: Fallback generator when description becomes too thin
# ---------------------------------------------------------------------------
def detect_source(search: str) -> str:
    s = search.lower()
    parts = []
    if "index_catalyst" in s or "cisco:dnac" in s or "cisco:catalyst" in s:
        parts.append("Catalyst Center")
    if "index_spaces" in s or "cisco:spaces" in s:
        parts.append("Cisco Spaces")
    if "index_sdwan" in s or "cisco:sdwan" in s:
        parts.append("SD-WAN")
    if "index_firewall" in s:
        if "cisco:ftd" in s or "cisco_security" in s or "estreamer" in s:
            parts.append("Cisco Firepower")
        elif "cisco:asa" in s:
            parts.append("ASA firewall")
        else:
            parts.append("firewall logs")
    if "index_network" in s:
        if "zeek:" in s:
            parts.append("Zeek network sensor")
        elif "cisco:ios" in s:
            parts.append("Cisco IOS syslog")
        elif "endace" in s:
            parts.append("Endace")
        else:
            parts.append("network telemetry")
    if "index_identity" in s or "cisco:ise" in s:
        parts.append("Cisco ISE")
    if "index_thousandeyes" in s or "thousandeyes" in s:
        parts.append("ThousandEyes")
    if "index_windows" in s or "xmlwineventlog" in s or "activedirectory" in s:
        parts.append("Windows / Active Directory")
    if "index_meraki" in s or "meraki:" in s:
        parts.append("Meraki")
    if "index_dhcp" in s or "dhcpd" in s:
        parts.append("DHCP")
    if "index_security" in s:
        if "splunk:aa:" in s:
            parts.append("Splunk Attack Analyzer")
        elif "cisco:xdr" in s:
            parts.append("Cisco XDR")
        else:
            parts.append("security telemetry")
    if "datamodel=authentication" in s:
        parts.append("authentication logs")
    if not parts:
        parts.append("your Cisco environment")
    return " and ".join(parts[:2]) + ("" if len(parts) <= 2 else ", and more")


def detect_output_verb(viz: str, search: str) -> str:
    s = search.lower()
    if "singlevalue" in viz:
        if "avg(" in s or "score" in s:
            return "Shows"
        return "Counts"
    if "table" in viz or (not viz and "| table " in s):
        if "| sort" in s:
            return "Lists"
        return "Shows a table of"
    if "line" in viz or "area" in viz:
        return "Tracks"
    if "bar" in viz or "column" in viz:
        return "Breaks down"
    if "pie" in viz:
        return "Shows the distribution of"
    if "timechart" in s:
        return "Tracks"
    if "| stats count" in s or "dc(" in s:
        return "Counts"
    return "Shows"


def detect_time_suffix(viz: str, search: str) -> str:
    s = search.lower()
    if "line" in viz or "area" in viz or "timechart" in s:
        return " over time"
    return ""


def generate_fallback(search_name: str, viz: str, search: str) -> str:
    # Extract the subject part after the category prefix
    parts = search_name.split(" - ", 1)
    subject = parts[1].strip() if len(parts) > 1 else search_name.strip()

    # Lower-case the subject for use mid-sentence, keep capitalised for start
    verb = detect_output_verb(viz, search)
    source = detect_source(search)
    suffix = detect_time_suffix(viz, search)

    # Build a subject phrase — turn "AP Health by Site" → "AP health by site"
    subject_lower = subject[0].lower() + subject[1:] if subject else subject

    return f"<p>{verb} {subject_lower}{suffix} from {source}.</p>"


# ---------------------------------------------------------------------------
# Main: parse → transform → write
# ---------------------------------------------------------------------------
def main():
    conf_text = CONF_PATH.read_text(encoding="utf-8")
    lines = conf_text.splitlines(keepends=True)

    # --- Parse all stanzas ---
    stanzas = []  # list of dicts
    current = {}
    for i, line in enumerate(lines):
        m = re.match(r'^\[(.+?)\]\s*$', line)
        if m:
            if current.get("name"):
                stanzas.append(current)
            current = {
                "name": m.group(1),
                "desc_line": None,      # 0-indexed
                "description": "",
                "search_name": "",
                "default_viz": "",
                "search_preview": "",
                "is_makeresults": False,
            }
            continue
        if not current.get("name"):
            continue
        if line.startswith("description = "):
            current["desc_line"] = i
            current["description"] = line[len("description = "):].rstrip("\n")
        elif line.startswith("search_name = "):
            current["search_name"] = line[len("search_name = "):].strip()
        elif line.startswith("default_viz = "):
            current["default_viz"] = line[len("default_viz = "):].strip()
        elif line.startswith("search = "):
            preview = line[len("search = "):].strip()
            current["is_makeresults"] = "makeresults" in preview.lower()
            current["search_preview"] = preview[:600]

    if current.get("name"):
        stanzas.append(current)

    print(f"Parsed {len(stanzas)} stanzas")

    # --- Transform ---
    changes = 0
    new_lines = list(lines)

    for s in stanzas:
        if s["desc_line"] is None:
            continue
        if s["is_makeresults"]:
            continue  # Skip synthetic/demo stanzas

        original = s["description"]
        transformed = original

        # Apply the three cleaning phases
        transformed = strip_technical_code_blocks(transformed)
        transformed = strip_technical_phrases(transformed)
        transformed = cleanup_html(transformed)

        # Ensure we still have a <p> wrapper
        text_content = extract_text(transformed)

        if len(text_content) < 60:
            # Too little substance left — generate from name
            transformed = generate_fallback(
                s["search_name"], s["default_viz"], s["search_preview"]
            )

        # Ensure single paragraph wrapper
        if transformed and not transformed.startswith("<p>"):
            transformed = "<p>" + transformed + "</p>"

        # Only write if something actually changed
        if transformed != original:
            new_lines[s["desc_line"]] = f"description = {transformed}\n"
            changes += 1

    # --- Write back ---
    CONF_PATH.write_text("".join(new_lines), encoding="utf-8")
    print(f"Updated {changes} descriptions ({len(stanzas) - changes} unchanged)")
    return changes


if __name__ == "__main__":
    n = main()
    sys.exit(0 if n >= 0 else 1)
