#!/usr/bin/env python3
"""Preview proposed searchbase.conf category / sub_category / tags changes.

READ ONLY. This script never writes searchbase.conf. It prints a before/after
proposal so the taxonomy can be reviewed before anything is applied.

Usage:
  python3 scripts/preview_searchbase_taxonomy.py            # 20-search sample
  python3 scripts/preview_searchbase_taxonomy.py --stats    # whole-catalogue rollup
  python3 scripts/preview_searchbase_taxonomy.py --stanza X # one stanza
"""

from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)

CATEGORIES = (
    "Security",
    "Network",
    "Identity",
    "Data Center",
    "Smart Spaces",
    "Digital Experience",
    "Operations",
)

# Visualization shape, not data. Approved for removal.
VIZ_TAGS = {
    "Table", "Distribution", "Trend", "KPI", "Drilldown", "Leaderboard",
    "Detail", "Map", "Comparison", "Ranking", "Pivot", "Chart",
    "Site Leaderboard",
}

# Provenance, badges, and migration leftovers. No operator meaning.
JUNK_TAGS = {
    "Migrated_From_Searchbase_Bak", "Custom Conference", "Stack Validated",
    "CIM Accelerated", "TA 7404", "TA Stock Dashboard", "Legacy KPI",
    "ISE TA", "TA Health", "Derived Signal", "Composite KPI", "TStats",
    "Data Model", "Base Search", "Awaiting Feed", "Acceleration",
}

# Customer / end-user organisation names must never ship in the catalogue.
CUSTOMER_TAGS = {"FDEM"}

# Single words that carry no discriminating meaning, plus undefined acronyms.
# "Health"/"Score" duplicate "Health Score"; "Critical"/"Major" duplicate
# "Severity"; "KTP" is never expanded anywhere in the catalogue.
GENERIC_TAGS = {
    "Category", "Type", "Status", "Quiet", "Major", "Critical", "Health",
    "Network", "Data Center", "Score", "Activity", "Actions", "Change",
    "Outcomes", "Validation", "KTP",
    # Contentless one-offs that describe no subject.
    "Performance", "Stability", "Components", "Diagnostics", "Optimization",
    "Jobs", "Tasks", "Schedule", "Volume", "Stream", "Drop", "Spike",
    "Hardware",
}

# Product tags whose product must be named in the search's SPL, stanza id, or
# display name. Deliberately empty: a tag can legitimately name a component
# upstream of the data, for example the Endace taps that feed the Zeek
# sourcetypes in the Agentic SOC workspace, and that relationship is invisible
# in the SPL. Entries here must be verified against the architecture first.
TAG_REQUIRES_EVIDENCE: dict[str, str] = {}

# Same product spelled several ways across the catalogue.
TAG_CANON = {
    "Cisco Meraki": "Meraki",
    "Cisco Catalyst Center": "Catalyst Center",
    "DNAC": "Catalyst Center",
    "Cisco Secure Firewall": "Secure Firewall",
    "Cisco FTD": "Secure Firewall",
    "Cisco Firewall": "Secure Firewall",
    "FTD": "Secure Firewall",
    "Firepower": "Secure Firewall",
    "eStreamer": "Secure Firewall",
    "Cisco Webex": "Webex",
    "Cisco Nexus 9000": "Nexus 9000",
    "Cisco Isovalent": "Isovalent",
    "AttackAnalyzer": "Splunk Attack Analyzer",
    "Cisco APIC": "Cisco ACI",
    "Palo Alto Networks": "Palo Alto",
    "Cyber Vision Center": "Cyber Vision",
    "MX Security Appliance": "Meraki",
    # Singular/plural and long/short spellings of the same concept.
    "Interface": "Interfaces",
    "Destination": "Destinations",
    "Source": "Sources",
    "Queue": "Queues",
    "Session": "Sessions",
    "Location": "Locations",
    "Tenant": "Tenants",
    "Flow": "Flows",
    "Intrusion": "Intrusions",
    "IDS": "Intrusion Detection",
    "IPS": "Intrusion Prevention",
    "Anomaly Detection": "Anomaly",
    "Anomaly Records": "Anomaly",
    "CPU Health": "CPU",
    "Power Consumption": "Power",
    "Root Cause": "Root Cause Analysis",
    "Network Address Translation": "NAT",
    "LateralMovement": "Lateral Movement",
    "Network Resolution": "DNS",
    "Locations": "Sites",
    "Policy": "Policies",
    "Admin Activity": "Administration",
    "Regional": "Regions",
    # Bare "Root" reads as root-cause; these searches mean the root account.
    "Root": "Root Account",
}

def _resolve(mapping: dict[str, str]) -> dict[str, str]:
    """Follow chains such as Location -> Locations -> Sites to their end.

    Without this a single pass only rewrites one hop, so the classifier would
    keep changing the file every time it ran.
    """
    out: dict[str, str] = {}
    for key, value in mapping.items():
        seen = {key}
        while value in mapping and value not in seen:
            seen.add(value)
            value = mapping[value]
        out[key] = value
    return out


TAG_CANON = _resolve(TAG_CANON)


# Workspace / pillar tags that drive auto-discovery. Never dropped.
LOAD_BEARING_TAGS = {
    "Secure Networking", "Agentic SOC", "Zero Trust Access",
    "Secure Infrastructure", "Scalable Network Segmentation",
    "Hybrid Mesh Firewalling", "Agentic Ops", "Cisco DC Networking",
    "Building Intelligence", "IT Health", "NetOps Readiness",
    "Network Intelligence", "Workplace SPOG", "Secure Data Center Operations",
}

# Recognized product/source tags. Used to check a search kept its product.
PRODUCT_TAGS = {
    "Catalyst Center", "Cisco ACI", "Cisco Spaces", "ThousandEyes", "ISE",
    "Meraki", "SD-WAN", "Nexus Dashboard", "Nexus 9000", "Secure Firewall",
    "Secure Access", "Cyber Vision", "Zeek", "Endace", "Splunk Attack Analyzer",
    "Webex", "Active Directory", "VMware", "vSphere", "Duo", "XDR",
    "Intersight", "Umbrella", "Multicloud Defense", "ASA", "Secure Client",
    "AI Defense", "AKIPS", "Palo Alto", "Isovalent", "Secure Workload",
    "Secure Network Analytics", "Email Threat Defense", "Secure Endpoint",
    "Email Security", "Cisco IQ", "ServiceNow", "Zscaler", "NetFlow",
    "Cisco IOS-XR", "IOS", "Windows DHCP", "Splunk Platform", "F5",
    "Secure Web Appliance", "Kenna", "Microsoft Defender",
    "Vulnerability Intelligence",
}

# sub_category values that name a product instead of a purpose.
PRODUCT_SUB_REMAP = {
    "ISE": "Authentication",
    "XDR": "Incidents",
    "ThousandEyes": "Network Performance",
    "Catalyst Center": "Device Health",
    "Cisco Catalyst Center": "Device Health",
    "DNAC": "Device Health",
    "Meraki": "Network Health",
    "Cisco Meraki": "Network Health",
    "Firepower": "Intrusion Prevention",
    "Webex": "Collaboration",
    "Cisco Spaces": "Occupancy",
    "Network": "Network Performance",
    "General": "Operations",
}

# sub_category must describe purpose. These embedded a product name, which now
# lives only in tags. Pillar strings below are exempt and never rewritten.
SUB_PRODUCT_STRIP = {
    # Cisco ACI / APIC
    "ACI Fabric Health": "Fabric Health",
    "ACI Tenant & Policy": "Tenant & Policy",
    "ACI ACL Logs": "ACL Logs",
    "ACI Syslog & Events": "Syslog & Events",
    "APIC Controller Statistics": "Controller Statistics",
    # Nexus Dashboard / Nexus 9000 / MSO
    "Nexus 9000 Platform": "Platform Health",
    "Nexus Dashboard Traffic & Flow": "Traffic & Flow",
    "Nexus Dashboard Interfaces": "Interfaces",
    "Nexus Dashboard Syslog": "Syslog & Events",
    "Multi-Site Orchestrator": "Multi-Site Orchestration",
    "Multi-Site Orchestrator Syslog": "Syslog & Events",
    "Network Syslog": "Syslog & Events",
    "Syslog": "Syslog & Events",
    # VMware
    "VMware Integration": "Virtualization",
    # SD-WAN
    "SD-WAN": "WAN Health",
    "WAN / SD-WAN": "WAN Health",
    "SD-WAN Security": "WAN Security",
    "SD-WAN Threat Hunting": "Threat Hunting",
    "SD-WAN UTD": "UTD / IPS",
    # Identity products
    "ISE + Active Directory": "Authentication",
    "ISE and Active Directory": "Authentication",
    "ISE Infrastructure": "Identity Infrastructure",
    # Security products
    "Splunk Attack Analyzer": "Forensics",
    # Collaboration
    "Webex Predictive Analytics": "Predictive Analytics",
    # ThousandEyes ("TE " prefix)
    "TE Web & API Tests": "Web & API Tests",
    "TE Network": "Network Performance",
    "TE Voice": "Voice",
    "TE Internet Insights": "Internet Insights",
    "TE Feed Inventory": "Feed Inventory",
    "TE Activity Logs": "Activity Logs",
    "TE Alerts": "Alerting",
}

# Exact sub_category strings the workspace code maps to sections. Never renamed.
PILLAR_SUBS = {
    "Zero Trust Access", "Secure Infrastructure",
    "Scalable Network Segmentation", "Hybrid Mesh Firewalling",
    "Agentic Ops", "Agentic Operations", "DNS Security",
    "Firewall Threat Defense", "Network Detection & Response",
    "Unified Detection & Investigation",
}

# Synonyms, singular/plural pairs, and one-off fragments folded into the
# sibling that already carries the same meaning. Keys are never values, so
# applying the map twice is a no-op.
SUB_MERGE = {
    # Twelve overlapping "Client *" buckets collapse to five real purposes.
    "Client Health Trends": "Client Health",
    "Client Base": "Client Health",
    "Enterprise Operations": "Client Health",
    "Client Usage": "Client Usage & Onboarding",
    "Client OS": "Client Distribution",
    "Client Distribution Analytics": "Client Distribution",
    "Client Concurrency": "Client Sessions",
    # Three ways of saying occupancy.
    "Space Occupancy": "Occupancy",
    "Occupancy Analytics": "Occupancy",
    "Presence": "Presence & Associations",
    "Device Presence & Associations": "Presence & Associations",
    "Predictive Analytics": "Room Utilization",
    "Site Leaderboard": "Space Optimization",
    # Device, asset, and inventory naming.
    "Device & Network Health": "Device Health",
    "Infrastructure": "Device Health",
    "Operations": "Device Health",
    "Device Inventory": "Inventory",
    "Asset Inventory": "Inventory",
    "Issues": "Issue Tracking",
    "Operational Intelligence": "Issue Tracking",
    "Switches": "Switching",
    "Interfaces": "Interface Telemetry",
    "Interface Utilization": "Interface Telemetry",
    "Layer 2 Stability": "Interface Stability",
    "Routing & BGP": "Routing",
    "BGP": "Routing",
    "Site Health": "Site Connectivity",
    "Site Topology": "Topology",
    "Troubleshooting": "Network Diagnostics",
    "Network Analytics": "Network Intelligence",
    "Lifecycle Risk": "Inventory",
    "DNS": "Network Resolution",
    "Wireless Quality": "Wireless",
    "Access Points": "Wireless",
    "Traffic Analysis": "Traffic & Flow",
    "External Traffic": "Traffic & Flow",
    "Firewall Traffic": "Firewall",
    # Detection naming: three spellings of intrusion detection/prevention.
    "IDS / IPS": "Intrusion Prevention",
    "UTD / IPS": "Intrusion Prevention",
    # "Email Security" is also a Cisco product name; the purpose-only label
    # keeps sub_category free of product names.
    "Email Threat Defense": "Email Threat Protection",
    "Email Security": "Email Threat Protection",
    "Endpoint": "Endpoint Telemetry",
    "Asset Correlation": "Vulnerability Intelligence",
    "OT Network Activity": "OT Event Monitoring",
    "OT Vulnerability Management": "OT Asset Exposure",
    # Identity and audit.
    "Guest Access": "Authentication",
    "Network Authentication": "Authentication",
    "Privileged Access": "Authentication & Audit",
    "Remote Access": "Authentication & Audit",
    "Audit": "Audit Logs",
    "Audit Log Activity": "Audit Logs",
    "Activity Logs": "Audit Logs",
    "Administration": "Audit Logs",
    "Alerts": "Alerting",
    "Change Management": "Configuration Auditing",
    "Macros": "Platform Health",
    # Executive rollups.
    "Executive Score": "Executive Scorecard",
    "Executive KPI Scorecard": "Executive Scorecard",
    "Executive Summary Analytics": "Executive Scorecard",
    "Health Score": "Executive Scorecard",
    "Trend Analysis": "Executive Scorecard",
    "Trend Analytics": "Executive Scorecard",
    "Network Readiness Score": "Readiness Score",
    "Readiness Score Components": "Readiness Score",
    # Collaboration and voice: product and protocol names become purposes.
    "Collaboration Intelligence": "Collaboration",
    "Teams": "Collaboration",
    "Zoom": "Collaboration",
    "RoomOS": "Collaboration",
    "SIP": "Voice",
    "RTP": "Voice",
    # ThousandEyes synthetic test types.
    "HTTP": "Web & API Tests",
    "API": "Web & API Tests",
    "FTP": "Web & API Tests",
    "Page Load": "Web & API Tests",
    "SaaS": "Web & API Tests",
    "Cloud": "Internet Insights",
    "Traces": "Application Performance",
    "Correlation": "Application Performance",
    "Geo": "Network Performance",
    "SASE": "WAN Health",
}

# Every sub_category rolls up to exactly one category. Before this, 22
# sub_categories were spread over two or three categories, so the same
# sub_category meant a different domain depending on the stanza.
SUB_TO_CAT = {
    # --- Security -------------------------------------------------------
    "Secure Infrastructure": "Security",
    "Hybrid Mesh Firewalling": "Security",
    "Network Intelligence": "Security",
    "Firewall": "Security",
    "Firewall Threat Defense": "Security",
    "DNS Security": "Security",
    "Network Detection & Response": "Security",
    "Unified Detection & Investigation": "Security",
    "Forensics": "Security",
    "Threat Hunting": "Security",
    "ESCU Detections": "Security",
    "Intrusion Prevention": "Security",
    "Intrusion Detection": "Security",
    "Cloud Security": "Security",
    "Web Security": "Security",
    "Email Threat Protection": "Security",
    "Email Sandbox": "Security",
    "Incidents": "Security",
    "Wireless Security": "Security",
    "PSIRT": "Security",
    "Vulnerability Intelligence": "Security",
    "Advisories & Anomalies": "Security",
    "Threat Geography": "Security",
    "Suspicious Traffic": "Security",
    "GenAI Protection": "Security",
    "Endpoint Telemetry": "Security",
    "ACL Logs": "Security",
    "Microsegmentation": "Security",
    "WAN Security": "Security",
    "Secure Data Center Operations": "Security",
    "eBPF Observability": "Security",
    "OT Security": "Security",
    "OT Event Monitoring": "Security",
    "OT Asset Intelligence": "Security",
    "OT Asset Exposure": "Security",
    "OT Sensor Health": "Security",
    "OT Syslog": "Security",
    # --- Identity -------------------------------------------------------
    "Zero Trust Access": "Identity",
    "Scalable Network Segmentation": "Identity",
    "Identity": "Identity",
    "Identity Infrastructure": "Identity",
    "Authentication": "Identity",
    "Authentication & Audit": "Identity",
    "Windows Authentication": "Identity",
    "Audit Logs": "Identity",
    "Posture": "Identity",
    # --- Data Center ----------------------------------------------------
    "Fabric Health": "Data Center",
    "Tenant & Policy": "Data Center",
    "Multi-Site Orchestration": "Data Center",
    "Syslog & Events": "Data Center",
    "Syslog Monitoring": "Network",
    "Virtualization": "Data Center",
    "Platform Health": "Data Center",
    "Application Discovery": "Data Center",
    # --- Smart Spaces ---------------------------------------------------
    "Occupancy": "Smart Spaces",
    "Space Optimization": "Smart Spaces",
    "Room Utilization": "Smart Spaces",
    "Camera Intelligence": "Smart Spaces",
    "Safety Sensors": "Smart Spaces",
    "IoT Sensors": "Smart Spaces",
    "Environmental Sensors": "Smart Spaces",
    "Presence & Associations": "Smart Spaces",
    "Sustainability": "Smart Spaces",
    "Collaboration": "Smart Spaces",
    # --- Digital Experience ---------------------------------------------
    "Network Performance": "Digital Experience",
    "Web & API Tests": "Digital Experience",
    "Internet Insights": "Digital Experience",
    "Application Performance": "Digital Experience",
    "Alerting": "Digital Experience",
    # Every voice search in the catalogue is a ThousandEyes SIP/RTP test.
    "Voice": "Digital Experience",
    "Collaboration Performance": "Digital Experience",
    # --- Operations -----------------------------------------------------
    "Agentic Ops": "Operations",
    "Agentic Operations": "Operations",
    "Feed Health": "Operations",
    "Feed Inventory": "Operations",
    "App Administration": "Operations",
    "Platform Activity": "Operations",
    # --- Network --------------------------------------------------------
    "Network Health": "Network",
    "Client Health": "Network",
    "Client Experience": "Network",
    "Client Distribution": "Network",
    "Client Usage & Onboarding": "Network",
    "Client Sessions": "Network",
    "Client Traffic": "Network",
    "Wireless": "Network",
    "SSID Analysis": "Network",
    "Controller Statistics": "Network",
    "Controller & Site Inventory": "Network",
    "Issue Tracking": "Network",
    "Interface Telemetry": "Network",
    "Interface Stability": "Network",
    "Routing": "Network",
    "Routing Stability": "Network",
    "Switching": "Network",
    "Topology": "Network",
    "Site Connectivity": "Network",
    "Inventory": "Network",
    "Device Health": "Network",
    "DHCP Operations": "Network",
    "Network Resolution": "Network",
    "Traffic & Flow": "Network",
    "Capacity Planning": "Network",
    "Compliance": "Network",
    "Configuration Auditing": "Network",
    "Network Diagnostics": "Network",
    "Optical Transport": "Network",
    "MPLS Traffic Engineering": "Network",
    "Streaming Telemetry": "Network",
    "Time Synchronization": "Network",
    "Readiness Score": "Network",
    "Executive Scorecard": "Network",
    "Anomaly Detection": "Network",
    "WAN Health": "Network",
}

# Detect a missing product from the SPL so nothing loses its source.
PRODUCT_FROM_SPL = (
    (r"sourcetype=\"?DhcpSrvLog", "Windows DHCP"),
    (r"`index_windows`|WinEventLog|sourcetype=\"?ActiveDirectory|MSAD:", "Active Directory"),
    (r"^\s*\|\s*rest\s+/servicesNS|^\s*\|\s*rest\s+/services|index=_internal|index=_audit", "Splunk Platform"),
    (r"cisco:ise:", "ISE"),
    (r"cisco:dnac:|cisco:catalyst:|Cisco_Catalyst_App", "Catalyst Center"),
    (r"meraki:", "Meraki"),
    (r"cisco:thousandeyes:|Cisco_ThousandEyes", "ThousandEyes"),
    (r"cisco:spaces:", "Cisco Spaces"),
    (r"cisco:ftd|cisco:sfw:|cisco:firepower|cisco:estreamer", "Secure Firewall"),
    (r"Secure_Firewall_Dataset|DATAMODEL=Cisco_Security", "Secure Firewall"),
    (r"cisco:umbrella|index_dns_umbrella", "Umbrella"),
    (r"cisco:cloud_security:|cisco:secure_access:", "Secure Access"),
    (r"cisco:xdr:", "XDR"),
    (r"zeek:", "Zeek"),
    (r"cisco:wsa:", "Secure Web Appliance"),
    (r"cisco:intersight:", "Intersight"),
    (r"ms:defender:", "Microsoft Defender"),
    (r"cisco:dc:aci", "Cisco ACI"),
    (r"cisco:dc:nd:|cisco:dc:mso", "Nexus Dashboard"),
    (r"cisco:sdwan:", "SD-WAN"),
    (r"cisco:duo:", "Duo"),
    (r"cisco:cybervision:", "Cyber Vision"),
    (r"Cisco-IOS-XR", "Cisco IOS-XR"),
)


def parse_stanzas(text: str) -> list[tuple[str, str]]:
    chunks = re.split(r"(?=^\[[A-Za-z][A-Za-z0-9_-]*\]\s*$)", text, flags=re.M)
    out = []
    for chunk in chunks:
        m = re.match(r"^\[([^\]]+)\]", chunk)
        if m:
            out.append((m.group(1), chunk))
    return out


def field(chunk: str, key: str) -> str:
    m = re.search(rf"^{key} = (.*)$", chunk, re.M)
    return m.group(1).strip() if m else ""


def spl_of(chunk: str) -> str:
    m = re.search(r"^search = (.*?)(?=^[a-z_]+\s*=|\Z)", chunk, re.M | re.S)
    return m.group(1) if m else ""


def new_category(name: str, chunk: str, sub: str) -> str:
    """Category is a strict function of the normalized sub_category.

    Deriving it from the sub_category (rather than from the previous category)
    is what keeps the two levels consistent: one sub_category can no longer
    appear under two different categories, and the result is idempotent.
    """
    if sub not in SUB_TO_CAT:
        raise KeyError(f"sub_category {sub!r} has no category ({name})")
    return SUB_TO_CAT[sub]


def new_subcategory(name: str, chunk: str) -> str:
    raw = field(chunk, "sub_category")
    if raw in PILLAR_SUBS:
        return raw
    # A staleness check on a product is about the feed, not about the product's
    # own subject matter, so the generic product remap must not apply.
    if name.startswith("feed_monitor_"):
        return "Feed Health"
    # Searches that watch Splunk itself describe the app's own operation, not
    # the network it monitors. Pillar stanzas returned above keep their
    # workspace sub_category even when they read the internal indexes.
    if name.startswith("admin_") or re.search(
        r"index=_internal|index=_audit|\|\s*rest\s+/servic", spl_of(chunk)
    ):
        return "App Administration"
    # Attack Analyzer inspects files, processes, and IOCs. That is forensics,
    # not incident management, even though it ships under the XDR umbrella.
    if raw == "XDR" and re.search(r"attack.?analyz|_aa_|forensic", name, re.I):
        return "Forensics"
    if raw in SUB_PRODUCT_STRIP:
        sub = SUB_PRODUCT_STRIP[raw]
    else:
        sub = PRODUCT_SUB_REMAP.get(raw, raw) or "Device Health"
    # "Syslog & Events" is the ACI fabric event stream, so it belongs to the
    # data centre. The same string was also used for plain device syslog on
    # IT Health tiles, which is ordinary network monitoring.
    if sub in ("Syslog & Events", "Syslog & DHCP Events"):
        if "dhcp" in name:
            return "DHCP Operations"
        return "Syslog & Events" if name.startswith("dc_networking") else "Syslog Monitoring"

    sub = SUB_MERGE.get(sub, sub)

    # The rules below split labels the catalogue used for two genuinely
    # different purposes. They run after the merge so that they also see
    # values that only become ambiguous once merged (for example "Zoom"
    # becoming "Collaboration").
    #
    # Capacity planning means floor space in the Spaces dashboards and link
    # headroom everywhere else.
    if sub == "Capacity Planning" and re.match(r"^(dashboard_)?spaces", name):
        return "Space Optimization"
    # Used both for wireless controllers and for Nexus fabric hardware,
    # faults, and resource summaries.
    if sub == "Controller & Site Inventory" and name.startswith("dc_networking"):
        return "Platform Health"
    is_te = name.startswith(("teuc_", "it_health_te_")) or bool(
        re.search(r"cisco:thousandeyes:|Cisco_ThousandEyes", spl_of(chunk))
    )
    # "Collaboration" covered both ThousandEyes meeting-platform tests and
    # Webex people-counting in buildings; only the former is an experience test.
    if sub == "Collaboration" and is_te:
        return "Collaboration Performance"
    # ThousandEyes activity logs audit the monitoring platform itself, so they
    # are not identity audit trails.
    if sub == "Audit Logs" and is_te:
        return "Platform Activity"
    return sub


def new_tags(name: str, chunk: str) -> list[str]:
    raw = [t.strip() for t in field(chunk, "tags").split(",") if t.strip()]
    spl = spl_of(chunk)
    evidence = f"{spl} {name} {field(chunk, 'search_name')}"

    # On most searches "Data Model" and "Acceleration" are badges, but on a
    # coverage search they name the subject, so they survive there.
    about_models = bool(
        re.search(
            r"data model|coverage|acceleration",
            field(chunk, "search_name"),
            re.I,
        )
    )
    subject_tags = {"Data Model", "Acceleration"} if about_models else set()

    kept: list[str] = []
    for tag in raw:
        tag = TAG_CANON.get(tag, tag)
        if tag in subject_tags:
            if tag not in kept:
                kept.append(tag)
            continue
        if tag in VIZ_TAGS or tag in JUNK_TAGS:
            continue
        if tag in CUSTOMER_TAGS or tag in GENERIC_TAGS:
            continue
        # Raw ATT&CK technique IDs are opaque on their own and every search
        # carrying one also carries the "MITRE ATT&CK" tag, so they add
        # nothing. Named CVEs stay: there the CVE is the subject.
        if re.fullmatch(r"T\d{4}(\.\d{3})?", tag):
            continue
        # "cisco:cvi" is Cisco Vulnerability Intelligence, a different product
        # from Cyber Vision despite the similar short name.
        if tag == "Cyber Vision" and re.search(r"cisco:cvi", spl) and not re.search(
            r"cybervision", spl, re.I
        ):
            tag = "Vulnerability Intelligence"
        if tag in TAG_REQUIRES_EVIDENCE and not re.search(
            TAG_REQUIRES_EVIDENCE[tag], evidence, re.I
        ):
            continue
        # "Health Score" belongs on searches that actually compute a score or
        # health percentage, not on plain fault and object counts.
        if tag == "Health Score" and not re.search(
            r"score|health|pct|percent|ratio|availability", evidence, re.I
        ):
            continue
        if tag not in kept:
            kept.append(tag)

    # Never let a search end up with no product/source tag. Skip searches that
    # span many index macros: picking the first sourcetype match would claim
    # one arbitrary product for what is really a cross-estate coverage search.
    index_macros = len(set(re.findall(r"`(index_[a-z0-9_]+)`", spl, re.I)))
    has_product = any(t in PRODUCT_TAGS for t in kept)
    if not has_product and index_macros < 6:
        for pattern, product in PRODUCT_FROM_SPL:
            if re.search(pattern, spl, re.I):
                kept.insert(0, product)
                break

    # Workspace auto-discovery requires the prefix and the tag to agree. A few
    # stanzas shipped with the prefix and a pillar sub_category but no tag,
    # which silently hid them from their own workspace.
    sub = field(chunk, "sub_category")
    if sub in PILLAR_SUBS:
        if name.startswith("secure_networking_") and "Secure Networking" not in kept:
            kept.append("Secure Networking")
        if name.startswith("agentic_soc_") and "Agentic SOC" not in kept:
            kept.append("Agentic SOC")

    # Some firewall searches run on vendor-neutral CIM but are named for the
    # product they were written against. The name is the only record of that.
    if not any(t in PRODUCT_TAGS for t in kept) and index_macros < 6:
        identity = f"{name} {field(chunk, 'search_name')}"
        if re.search(r"\bftd\b|_ftd_|(?:^|_|\s)fw[_\s]|\bfirewall\b", identity, re.I):
            kept.insert(0, "Secure Firewall")
    return kept


def propose(name: str, chunk: str) -> dict:
    tags = new_tags(name, chunk)
    sub = new_subcategory(name, chunk)
    return {
        "old_cat": field(chunk, "category"),
        "old_sub": field(chunk, "sub_category"),
        "old_tags": field(chunk, "tags"),
        "cat": new_category(name, chunk, sub),
        "sub": sub,
        "tags": tags,
        "search_name": field(chunk, "search_name"),
    }


SAMPLE_B = [
    "asset_inventory_ot_devices_by_vendor",
    "cybervision_assets_top_protocols",
    "identity_duo_tenant_kpis",
    "it_critical_systems_wan_bandwidth_detail",
    "network_dc_nd_active_anomalies_by_fabric",
    "dc_networking_cdp_neighbor",
    "dc_networking_vmware_esx_server_farm",
    "secure_networking_intersight_data_model_coverage",
    "building_resilience_webex_devices",
    "teuc_5_9_30_sase_secure_edge_performance",
    "xdr_aa_forensic_files_high_risk_inventory",
    "security_multicloud_defense_action_breakdown_kpi",
    "security_ai_defense_block_rate_kpi",
    "security_isovalent_alerts_by_severity",
    "network_akips_low_availability_device_count",
    "secure_networking_ip_sgt_bindings_by_group",
    "building_resilience_predict_occupancy_forecast",
    "it_critical_systems_route_flapping",
    "security_resilience_rogue_device_detection",
    "security_resilience_email_security_events",
]

SAMPLE = [
    "building_resilience_co2_level",
    "building_resilience_room_detail",
    "dashboard_spaces_intelligence_v1_operations_annotation",
    "agentic_soc_umbrella_dns_requests",
    "agentic_soc_zeek_traffic_volume",
    "secure_networking_zta_ravpn_failure_reasons",
    "secure_networking_hmf_policy_hits_by_platform",
    "secure_networking_source_health_by_pillar",
    "dc_networking_aci_syslog_recent_configuration_events",
    "dc_networking_acl_logs_acl_l3_drop_pkts",
    "teuc_5_9_1_network_latency_monitoring",
    "catalyst_center_wireless_health",
    "catalyst_center_issue_detail",
    "network_iosxr_cpu_utilization_trend",
    "security_resilience_ise_auth_trend",
    "xdr_incident_status_severity_pressure",
    "it_critical_systems_dhcp_pool_exhaustion",
    "admin_schedule_health_advisor",
    "feed_monitor_thousandeyes_stream_staleness",
    "network_unified_device_inventory_criticality",
]


def show(name: str, chunk: str) -> None:
    p = propose(name, chunk)
    new_tag_str = ", ".join(p["tags"])
    old_tag_str = ", ".join(t.strip() for t in p["old_tags"].split(",") if t.strip())
    changed = (
        p["cat"] != p["old_cat"]
        or p["sub"] != p["old_sub"]
        or new_tag_str != old_tag_str
    )
    print("=" * 78)
    print(f"[{name}]   {p['search_name']}")
    print(f"  category      {p['old_cat']!r}".ljust(46) + f"->  {p['cat']!r}")
    print(f"  sub_category  {p['old_sub']!r}".ljust(46) + f"->  {p['sub']!r}")
    print(f"  tags   before: {old_tag_str}")
    print(f"         after : {new_tag_str}")
    if not changed:
        print("  (unchanged)")
    if not any(t in PRODUCT_TAGS for t in p["tags"]):
        print("  !! WARNING: no product/source tag")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--stanza")
    ap.add_argument("--batch", choices=("a", "b"), default="a")
    args = ap.parse_args()

    stanzas = dict(parse_stanzas(SOURCE.read_text()))

    if args.stanza:
        show(args.stanza, stanzas[args.stanza])
        return 0

    if args.stats:
        cats, subs, tags = Counter(), Counter(), Counter()
        no_product = []
        sizes = Counter()
        for name, chunk in stanzas.items():
            p = propose(name, chunk)
            cats[p["cat"]] += 1
            subs[p["sub"]] += 1
            sizes[len(p["tags"])] += 1
            for t in p["tags"]:
                tags[t] += 1
            if not any(t in PRODUCT_TAGS for t in p["tags"]):
                no_product.append(name)
        print(f"stanzas: {len(stanzas)}")
        print("\ncategories:")
        for c in CATEGORIES:
            print(f"  {cats[c]:5d}  {c}")
        for c in set(cats) - set(CATEGORIES):
            print(f"  {cats[c]:5d}  !! UNEXPECTED {c}")
        print(f"\nunique sub_categories: {len(subs)}")
        print(f"unique tags: {len(tags)}  (was 433)")
        total = sum(n * c for n, c in sizes.items())
        print(f"avg tags/search: {total / len(stanzas):.2f}  (was 5.62)")
        print("tag-count histogram:", dict(sorted(sizes.items())))
        print(f"\nsearches with NO product/source tag: {len(no_product)}")
        for n in no_product[:25]:
            print(f"  {n}")
        return 0

    for name in (SAMPLE if args.batch == "a" else SAMPLE_B):
        if name in stanzas:
            show(name, stanzas[name])
        else:
            print(f"!! missing stanza {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
