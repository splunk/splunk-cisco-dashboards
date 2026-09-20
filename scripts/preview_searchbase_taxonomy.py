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
    # The upstream TA dashboard a search was lifted from, same class as
    # "TA Stock Dashboard". Describes where the SPL came from, not its subject.
    "Events And Incident Viewer",
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
    # Restates the stanza's own sub_category, so it narrows nothing. There is
    # no more specific tag to fold it into.
    "Network Health",
    # Contentless one-offs that describe no subject.
    "Performance", "Stability", "Components", "Diagnostics", "Optimization",
    "Jobs", "Tasks", "Schedule", "Volume", "Stream", "Drop", "Spike",
    "Hardware", "Assurance", "Disaster Readiness", "Evidence", "Failover",
    "Geo", "Impairment", "Internet", "Packets", "Rx", "Tx",
    # A homonym, not a concept: on the Intersight search it means a UCS
    # server profile, on the ZTA search a RaVPN connection profile. There is
    # no parent the two share, and each stanza already carries the tag that
    # distinguishes them (Inventory, VPN), so there is nothing to fold into.
    "Profiles",
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
    "Asset Inventory": "Inventory",
    "Alerting": "Alerts",
    "BGP Neighbors": "BGP",
    "Event Types": "Events",
    "IdentityStore": "Identity",
    "Logins": "Authentication",
    "Multi-Tenancy": "Tenants",
    "Security Activity": "Security",
    "Splunk Internal": "Splunk Platform",
    "Traffic Logs": "Traffic",
    # Two spellings each of one concept. Folding "Intrusion Detection" also
    # redirects "IDS" above, which resolves through it.
    "Intrusion Detection": "Intrusions",
    "Denied Traffic": "Denials",
}

# One tag per metric is too fine a grain to browse by. A descriptor carried by
# a single search cannot group anything: picking it in the tag filter returns
# the one search you would have found by typing its name, and it costs every
# other operator a chip to scroll past. These fold each leaf descriptor into
# the parent its whole family already shares, so the search stays findable by
# something other operators also use.
#
# Rolled up rather than deleted wherever a parent exists. On most of these
# stanzas the parent tag is already present, so the fold is a removal; where
# it is absent the fold adds it, which is why this is safe to state as one
# map. Product, vendor, and standardized-technology names are deliberately
# absent: a product with one search still keeps its name, because the name is
# the only accurate way to find it.
TAG_ROLLUP = {
    # --- Cisco IOS-XR optical transport -------------------------------
    # Every one of these is a lane- or transceiver-level measurement on a
    # stanza that already says Optical.
    "SNR": "Optical",
    "Coherent Optics": "Optical",
    "FEC": "Transceiver Health",
    "BER": "Transceiver Health",
    "Transmit Power": "Transceiver Health",
    # --- Cisco IOS-XR IS-IS -------------------------------------------
    "LSP": "IS-IS",
    "SPF": "IS-IS",
    "Adjacency Health": "IS-IS",
    "Hello Protocol": "IS-IS",
    # --- Cisco IOS-XR BGP ---------------------------------------------
    # Nine one-off names for "something about a BGP session".
    "Peer Health": "BGP",
    "Session State": "BGP",
    "FSM": "BGP",
    "Neighbor Sessions": "BGP",
    "Neighbor Throttling": "BGP",
    "Update Messages": "BGP",
    "NOTIFICATION Messages": "BGP",
    "Process Restart": "BGP",
    "Flap Detection": "BGP",
    "IPv4/IPv6": "BGP",
    # --- Cisco IOS-XR RIB, MPLS-TE, interfaces, MLTK -------------------
    "Route Age": "RIB",
    "Routing Stability": "RIB",
    # Convergence is measured on both a BGP and an MPLS-TE search, so it
    # cannot fold into either protocol; Routing is what they share.
    "Convergence": "Routing",
    "Tunnel Stability": "Tunnels",
    "Tunnel Availability": "Tunnels",
    # An SD-WAN circuit is the TLOC tunnel these two searches already tag.
    "Circuits": "Tunnels",
    "Packet Drops": "Packet Loss",
    "Interface Errors": "Errors",
    "Explainability": "Machine Learning",
    # --- SD-WAN threat hunt -------------------------------------------
    # Technique and tactic names. MITRE ATT&CK is the vocabulary they come
    # from and is already on most of these stanzas.
    "Path Traversal": "MITRE ATT&CK",
    "Persistence": "MITRE ATT&CK",
    "Privilege Escalation": "MITRE ATT&CK",
    "Software Downgrade": "MITRE ATT&CK",
    "Rogue Peer": "MITRE ATT&CK",
    "Lateral Movement": "MITRE ATT&CK",
    # Six names for logging in, spread over three hunt searches.
    "Interactive Login": "Authentication",
    "SSH": "Authentication",
    "Public Key": "Authentication",
    "AAA": "Authentication",
    "Root Account": "Authentication",
    "Local Account": "Authentication",
    "Credentials": "Authentication",
    "Failed Logins": "Authentication",
    "Certificate": "Encryption",
    "Access Logs": "ACL",
    "SGACL": "ACL",
    "Contracts": "ACL",
    "Signatures": "Intrusions",
    "Advanced Logging": "Coverage",
    # --- Intersight hardware lifecycle ---------------------------------
    "EOL": "Lifecycle",
    "Provisioning": "Lifecycle",
    "HCL": "Compliance",
    "Hardware Health": "Device Health",
    "Predictive Failure": "Device Health",
    "Fabric Interconnect": "Device Health",
    "Port Health": "Interfaces",
    # --- Catalyst Center interface telemetry ---------------------------
    "Congestion": "Capacity",
    "Headroom": "Capacity",
    "Discards": "Errors",
    "Asymmetry": "Traffic",
    "Freshness": "Feed Health",
    "PoE": "Power",
    "Power Budget": "Power",
    "WAN": "Interfaces",
    "Roaming": "Wireless",
    # --- Cyber Vision, Zeek, Umbrella ----------------------------------
    "External Communications": "Traffic",
    "Event Class": "Events",
    "Inactive": "Availability",
    "Transport": "Protocols",
    "Conversations": "Flows",
    "Ports": "Destinations",
    "Egress": "Destinations",
    "Record Types": "DNS",
    "Packet Investigation": "Investigation",
    "Correlation": "Investigation",
    "Root Cause Analysis": "Investigation",
    "Security Intelligence": "Threat Intelligence",
    "Blocklist Triage": "Threat Intelligence",
    "Failures": "Errors",
    # --- Zero Trust Access and SSE -------------------------------------
    "Connections": "Sessions",
    "Detections": "Threats",
    # ARQ is literally the initialism of these three components and is
    # already on all four assurance searches.
    "Attainability": "ARQ",
    "Retainability": "ARQ",
    "Quality": "ARQ",
    "Bindings": "SGT",
    "MAC OUI": "Endpoints",
    "NAC": "Posture",
    "VLAN": "VRF",
    "Shadow IT": "Risk",
    "Web Security": "Web Filtering",
    "Denials": "Policies",
    "Runtime Security": "Cloud Security",
    # --- Webex ----------------------------------------------------------
    "Calling": "Voice",
    "Service Level": "Contact Center",
    "Join Time": "Latency",
    # --- operations and feed plumbing -----------------------------------
    "ITSM": "Incidents",
    "Ticket Management": "Incidents",
    "API": "Feed Health",
    "Device Connectivity": "Feed Health",
    "Modular Input": "Feed Health",
    "Acceleration": "Data Model",
    "Cross-Domain": "Executive",
    "Cache": "Administration",
    # --- ThousandEyes ----------------------------------------------------
    "Path Visualization": "Topology",
    "Spans": "APM",
    # IPFIX is the IETF standardization of NetFlow and both sit on the one
    # search that reads either.
    "IPFIX": "NetFlow",
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


# Resolved together so a chain that starts in one map and ends in the other
# collapses in a single hop: "Root" -> "Root Account" -> "Authentication",
# "Denied Traffic" -> "Denials" -> "Policies".
TAG_CANON = _resolve({**TAG_CANON, **TAG_ROLLUP})


# Tags that name a workspace or a journey. "Secure Networking" and "Agentic
# SOC" are the two auto-discovery requiredTag values and are never dropped.
# The five pillar names below are section labels, not discovery inputs, and
# are governed by the strict rule in new_tags instead.
LOAD_BEARING_TAGS = {
    "Secure Networking", "Agentic SOC", "Zero Trust Access",
    "Secure Infrastructure", "Scalable Network Segmentation",
    "Hybrid Mesh Firewalling", "Agentic Ops", "Cisco DC Networking",
    "Building Intelligence", "IT Health", "NetOps Readiness",
    "Network Intelligence", "Workplace SPOG", "Secure Data Center Operations",
}

# The five Secure Networking section names, which double as tags.
SECURE_NETWORKING_PILLAR_TAGS = {
    "Zero Trust Access", "Secure Infrastructure",
    "Scalable Network Segmentation", "Hybrid Mesh Firewalling", "Agentic Ops",
}

# Machine identifiers that name one record in some external system. They are
# opaque to an operator browsing the catalogue and match only themselves, so
# they filter nothing. The subject they stand for is always carried by a real
# tag on the same search ("MITRE ATT&CK", "Vulnerability Intelligence").
# Matched with fullmatch and applied after LOAD_BEARING_TAGS is exempted.
#
# There is deliberately no generic [A-Z]{2,10}-\d{1,6} rule: it would eat
# "SHA-256", "AES-256" and "P-256", which name algorithms, not records.
IDENTIFIER_TAG_RE = re.compile(
    "|".join(
        (
            r"CVE-\d{4}-\d{4,7}",              # CVE-2022-20775
            r"T\d{4}(?:\.\d{3})?",             # ATT&CK T1021.002
            r"(?:CWE|CAPEC)-\d{1,5}",          # CWE-79
            r"CSC[a-z]{2}\d{5}",               # Cisco bug id CSCvz12345
            r"cisco-sa-[\w.-]+",               # Cisco PSIRT advisory id
            r"(?:sid|gid):?\s?\d+",            # Snort/ES rule id
            r"\d{1,5}:\d{1,7}(?::\d{1,3})?",   # Snort gid:sid:rev
            r"(?:TA|ES)[ _-]?\d{3,6}",         # TA/ES build id
            r"[0-9a-fA-F]{32}",                # md5
            r"[0-9a-fA-F]{40}",                # sha1
            r"[0-9a-fA-F]{64}",                # sha256
            r"[vV]\d+(?:\.\d+)+",              # v2.1
            r"\d+(?:\.\d+){2,}",               # 1.2.3
            r"\d+",                            # bare numeric id
        )
    ),
    re.I,
)

# Tags that are simply wrong on one named stanza, each checked by hand. This
# is not absence-of-evidence stripping and TAG_REQUIRES_EVIDENCE stays empty:
# a missing tag can name a component upstream of the data, as the Endace taps
# do for the Zeek sourcetypes. These entries have no such reading. The search
# below counts Secure Workload scopes by alert and touches nothing DHCP.
TAG_TYPOS = {
    "security_microseg_tetration_top_scopes_by_alert": {"DHCP"},
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

# Which Secure Networking pillar a tile belongs in, where the shipped value
# disagreed with what the search actually reads. Keyed by stanza so the result
# never depends on the current value, which is what keeps this idempotent.
PILLAR_REASSIGN = {
    # Duo MFA decisions and Duo endpoint-posture denials are access control.
    # The three sibling searches on cisco:duo:authentication already sit in
    # Zero Trust Access; these two were the only ones filed elsewhere.
    "secure_networking_infra_duo_application_access": "Zero Trust Access",
    "secure_networking_infra_duo_blocked_posture_identity": "Zero Trust Access",
    # meraki:organizationsecurity is the MX security appliance allow/block
    # stream. Two searches on that sourcetype are Hybrid Mesh Firewalling and
    # the same feed drives hmf_unified_blocks_trend; these three were split off.
    "secure_networking_meraki_security_allowed_blocked_trend": "Hybrid Mesh Firewalling",
    "secure_networking_meraki_top_blocked_destinations": "Hybrid Mesh Firewalling",
    "secure_networking_meraki_top_offending_clients": "Hybrid Mesh Firewalling",
    # Webex call success/failure is service assurance, like the Webex meeting
    # quality and contact-centre searches that are already in Agentic Ops. A
    # refused call is not an infrastructure security signal.
    "secure_networking_webex_call_outcome_trend": "Agentic Ops",
    "secure_networking_webex_failed_calls": "Agentic Ops",
    # Compares model datasets against indexed events: a feed-coverage check,
    # the same purpose as source_health_by_pillar and the TA error monitor.
    "secure_networking_intersight_data_model_coverage": "Agentic Ops",
    # Carried the prefix and the workspace tag but a generic sub_category, so
    # they were invisible in their own workspace. Both read Catalyst Center
    # device health, which is what secure_infra_status_rollup already covers.
    "secure_networking_fleet_device_health_summary": "Secure Infrastructure",
    "secure_networking_site_connectivity_summary": "Secure Infrastructure",
    # Counts events by provider and sourcetype with first- and last-seen
    # times. No finding, severity, or account is reported, so this is a feed
    # inventory like source_health_by_pillar, not firewall enforcement.
    "secure_networking_cloud_native_security_activity": "Agentic Ops",
    # Groups by ISEPolicySetName and NetworkDeviceName with no SGT, VRF, or
    # VLAN field anywhere. Its Zero Trust Access counterpart
    # zta_ise_enforcement_by_domain does read security_group_tag, so the two
    # were the wrong way round.
    "secure_networking_ise_policy_hits_by_device": "Zero Trust Access",
    # XDR incident severity and global risk over time, reading the same
    # cisco:xdr:incidents scores.global field as the two Agentic Ops
    # contextual-risk tiles. Neither reports an access decision.
    "secure_networking_zta_xdr_incident_status_severity_trend": "Agentic Ops",
    "secure_networking_zta_xdr_risk_pressure_trend": "Agentic Ops",
}

# A pillar string is a workspace section name. On a stanza outside that
# workspace it has to earn its place as a plain purpose name, and these did
# not: each one is listed with the sibling group it was separated from.
# identity_duo_* is deliberately absent: all ten of those searches are MFA and
# device-trust decisions, so "Zero Trust Access" is an accurate purpose there.
PILLAR_SUB_OUTSIDE_WORKSPACE = {
    # TLOC circuit and site availability from sitehealth/tunnelhealth. No
    # firewall, policy, or enforcement anywhere in the SPL, and the other 14
    # monitoring_sdwan_* searches already use WAN Health.
    "monitoring_sdwan_circuit_availability_table": "WAN Health",
    "monitoring_sdwan_circuit_state_summary": "WAN Health",
    "monitoring_sdwan_site_health_map": "WAN Health",
    "monitoring_sdwan_site_health_table": "WAN Health",
    "monitoring_sdwan_site_state_summary": "WAN Health",
    # Blocked/allowed decisions off the Network_Traffic model, exactly what the
    # sibling network_intelligence_top_blocked_ports calls Firewall.
    "network_intelligence_blocked_flow_detail": "Firewall",
    "network_intelligence_blocked_vs_allowed": "Firewall",
    # Gateway CPU, memory, uptime, and status. The other six Multicloud
    # Defense searches, including this one's own display name, say Cloud
    # Security.
    "security_multicloud_defense_gateway_health_table": "Cloud Security",
    # Attack Analyzer sandbox artefacts. Seventeen sibling xdr_aa_* searches
    # are Forensics; these three were the only ones under a pillar name.
    "xdr_aa_forensic_files_network_source_hotspots": "Forensics",
    "xdr_aa_forensic_network_external_egress_watch": "Forensics",
    "xdr_aa_forensic_network_internal_service_pressure": "Forensics",
    # Counts events per source across eighteen index macros and labels each
    # one Connected. That is feed health, not infrastructure security.
    "executive_dashboard_data_source_status": "Feed Health",
    # cisco:sdwan:access:logs permit/deny records with source and destination
    # SGTs, which is the same subject as the dc_networking ACL Logs searches.
    "security_resilience_sdwan_access_action_summary": "ACL Logs",
    "security_resilience_sdwan_access_log_table": "ACL Logs",
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
    # Both corrections are keyed by stanza and run before anything reads the
    # shipped value, so they are unaffected by what that value currently is.
    if name in PILLAR_REASSIGN:
        return PILLAR_REASSIGN[name]
    if name in PILLAR_SUB_OUTSIDE_WORKSPACE:
        return PILLAR_SUB_OUTSIDE_WORKSPACE[name]
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


def own_pillar_tag(name: str, chunk: str) -> str | None:
    """The one Secure Networking pillar a stanza is allowed to claim as a tag.

    A pillar tag asserts "this search IS that pillar", so the only defensible
    value is the stanza's own sub_category. Reading the corrected
    sub_category rather than the shipped one means a retagged search claims
    the section it was just moved to, and makes the result a fixed point.
    """
    sub = new_subcategory(name, chunk)
    if sub == "Agentic Operations":
        sub = "Agentic Ops"
    return sub if sub in SECURE_NETWORKING_PILLAR_TAGS else None


def restates_own_taxonomy(tag: str, cat: str, sub: str) -> bool:
    """True when a tag only repeats the stanza's own category or sub_category.

    Such a tag cannot narrow anything: every search it selects is already
    reachable by picking that category or sub_category in the UI, so it costs
    a chip in the filter bar and returns the same set. Exact equality only --
    "Health Score" against a sub_category of "Device Health" is a different
    claim and is left alone (see the Health Score guard below).

    Three exemptions, none of them stylistic:
      * LOAD_BEARING_TAGS -- the five Secure Networking pillar names are
        deliberately re-added by new_tags to the stanzas whose sub_category
        they match, so that operators can filter a workspace section by tag.
        Stripping them here would fight that rule inside the same function.
        Post-batch every surviving pillar tag is a self-restatement by
        construction, so this exemption is what keeps all 242 tiles tagged.
      * PRODUCT_TAGS -- a product name is provenance. It answers "which feed
        is this?", which stays a real question even when the sub_category
        happens to carry the same words. All three uses of
        "Vulnerability Intelligence" are restatements and would vanish.
      * "Threat Hunting" -- the only tag this rule would erase from the
        vocabulary outright, because all seven uses sit on stanzas already
        filed under that sub_category. Kept deliberately as a browsable
        entry point, so do not "fix" the inconsistency with the tags above.
    """
    if tag in LOAD_BEARING_TAGS or tag in PRODUCT_TAGS or tag == "Threat Hunting":
        return False
    return tag == cat or tag == sub


def new_tags(name: str, chunk: str) -> list[str]:
    raw = [t.strip() for t in field(chunk, "tags").split(",") if t.strip()]
    spl = spl_of(chunk)
    evidence = f"{spl} {name} {field(chunk, 'search_name')}"
    own_pillar = own_pillar_tag(name, chunk)
    # Compare against the CORRECTED taxonomy, not the shipped fields. Both
    # are recomputed here for the same reason own_pillar_tag does it: reading
    # the shipped sub_category would compare against a value this run is about
    # to overwrite, and pass two would then reach a different answer.
    own_sub = new_subcategory(name, chunk)
    own_cat = new_category(name, chunk, own_sub)

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
        if tag in TAG_TYPOS.get(name, ()):
            continue
        if tag not in LOAD_BEARING_TAGS and IDENTIFIER_TAG_RE.fullmatch(tag):
            continue
        # "cisco:cvi" is Cisco Vulnerability Intelligence, a different product
        # from Cyber Vision despite the similar short name.
        if tag == "Cyber Vision" and re.search(r"cisco:cvi", spl) and not re.search(
            r"cybervision", spl, re.I
        ):
            tag = "Vulnerability Intelligence"
        # "cisco:se" is Secure Endpoint. Secure Access is the SSE product and
        # reads cisco:cloud_security / cisco:secure_access, so on a search that
        # touches neither the tag names the wrong product.
        if tag == "Secure Access" and re.search(
            r'sourcetype\s*=\s*"?cisco:se"?(?!\w)', spl
        ) and not re.search(r"cloud_security|secure_access", spl, re.I):
            tag = "Secure Endpoint"
        # A pillar name is a section label. Carrying one that disagrees with
        # the stanza's own sub_category claims a section the search is not
        # in, so it is dropped wherever it appears. Safe to drop: nothing
        # reads pillar tags. Auto-discovery matches only the requiredTag
        # values ("Secure Networking", "Agentic SOC") plus sub_category.
        if tag in SECURE_NETWORKING_PILLAR_TAGS and tag != own_pillar:
            continue
        if restates_own_taxonomy(tag, own_cat, own_sub):
            continue
        if tag in TAG_REQUIRES_EVIDENCE and not re.search(
            TAG_REQUIRES_EVIDENCE[tag], evidence, re.I
        ):
            continue
        # "Health Score" belongs on searches that present a score, not on
        # anything with "health" in its name. The previous test was
        #     r"score|health|pct|percent|ratio|availability" against evidence
        # which kept all 150 uses: it accepted the bare word "health", and
        # `evidence` includes the stanza id and display name, so any search
        # called *_device_health_* qualified on the strength of its own title.
        # This one reads the SPL only, and wants either a computed score (an
        # explicit percentage, or an assignment to / rename into a score, pct,
        # percent or ratio field) or a vendor-supplied one the search merely
        # reads, such as Catalyst Center's health.overallScore or ACI's
        # latest(health) AS "Health Score" -- surfacing Cisco's own score is
        # still presenting a health score.
        if tag == "Health Score" and not re.search(
            r"round\s*\(\s*100\s*\*|"
            r"\b\w*(?:score|pct|percent|ratio)\w*\s*=|"
            r"\bas\s+\"?\w*(?:score|pct|percent|ratio)\w*|"
            r"health_score|healthscore|"
            r"\b\w*(?:Score|Percentage)\b",
            spl,
            re.I,
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
    # which silently hid them from their own workspace. Read the corrected
    # sub_category, not the shipped one, so a retagged tile lands in the
    # section it was just moved to.
    sub = new_subcategory(name, chunk)
    if sub in PILLAR_SUBS:
        if name.startswith("secure_networking_") and "Secure Networking" not in kept:
            kept.append("Secure Networking")
        if name.startswith("agentic_soc_") and "Agentic SOC" not in kept:
            kept.append("Agentic SOC")
        # A tile's section is set by its sub_category, but operators filter on
        # tags, so a tile missing its own pillar tag is invisible to that
        # filter. Only the workspace's own stanzas get one: elsewhere the same
        # string is a purpose name and carries no section meaning. Any pillar
        # tag other than this one was already dropped above.
        if name.startswith("secure_networking_") and own_pillar and own_pillar not in kept:
            kept.append(own_pillar)

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
