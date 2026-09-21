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
    # Every search in a log platform returns events, so this selects nothing
    # and excludes nothing. Where the event stream itself is the subject the
    # stanza already carries the feed that produces it (Syslog, Feed Health)
    # or the product name.
    "Events",
    # An attribute of a finding, not a subject. Picking it returns whatever
    # happens to report a severity column across every domain in the
    # catalogue, which is not a set anyone is looking for.
    "Severity",
    # Applied to 111 searches, of which only 11 emit a score, percentage, or
    # ratio column; 66 sit under a sub_category that already says Health
    # (Client Health, Device Health, Network Health, Fabric Health). The
    # SPL-evidence guard that used to police it is gone with it -- a tag that
    # needs a guard to stay honest is not a tag operators can trust.
    "Health Score",
    # Every search in the catalogue reads telemetry. The four uses mean "this
    # feed is being collected", which Feed Health, Collection, and Coverage
    # already say on the same stanzas. Deliberately NOT folded into
    # "Streaming Telemetry": that names model-driven IOS-XR telemetry, and
    # none of these four read it.
    "Telemetry",
    # Duplicates a top-level category name one level up, and twelve of its
    # thirteen uses sit on ACI hardware-detail searches where it means
    # nothing more than "this is a dashboard panel".
    "Operations",
    # vManage, spelled as a bare noun. SD-WAN and Control Plane are on all
    # three uses and say the same thing in words an operator would search for.
    "Manager",
}

# Tags whose whole extent sits inside one sub_category that already names
# them, so the tag chip and the sub_category facet return the same set. The
# five Secure Networking section names and "Secure Data Center Operations"
# are the same defect and are handled by restates_own_taxonomy below, which
# catches them because the strings are exactly equal.
SUBCATEGORY_ECHO_TAGS = {
    # All 8 uses are inside sub_category "ESCU Detections".
    "ESCU",
    # 15 of 16 uses are inside "Presence & Associations"; the sixteenth is an
    # Occupancy search that already carries Rooms.
    "Presence",
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
    # vSphere is VMware's product name for the same eleven ESX host, CPU,
    # datastore, and host-network searches, and all eleven already carry
    # VMware. Two spellings of one product narrow nothing.
    "vSphere": "VMware",
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
    # --- three vendors' words for "the platform raised a problem record" ---
    # "Issues" is what Catalyst Center calls them (all 40 uses read it),
    # "Faults" is what APIC calls them (19 of 20 read Cisco ACI), and
    # "Alerts" is what ThousandEyes, Meraki, Secure Workload and Defender
    # call them. None of the three ever co-occur, which is the signature of
    # three authors naming one idea rather than of a real distinction. An
    # operator asking "what has the estate raised?" would pick one chip, not
    # guess which vendor's noun applies; the vendor is still on every stanza
    # as a product tag. "Alerts" is the vendor-neutral word and is already
    # the target of "Alerting" above.
    "Issues": "Alerts",
    "Faults": "Alerts",
    # A host is a device identified by name or address. Never co-occurs with
    # Devices, which is the catalogue's unit-of-analysis axis.
    "Hosts": "Devices",
    # An asset is a device too. Folded into Devices rather than Inventory
    # (which names the act of enumerating the estate) because eleven of the
    # twenty-one uses are Cyber Vision searches about OT device risk,
    # protocols, and recency -- none of which is an inventory listing.
    "Assets": "Devices",
    # All three uses already carry Utilization on the same stanza: link
    # capacity is what the utilization percentage measures.
    "Capacity": "Utilization",
    # Segmentation adoption, zero-coverage sites, and interface-statistics
    # readiness all ask "how much of the estate is covered". Deliberately NOT
    # folded into "Posture", which in this catalogue means endpoint security
    # posture (Duo device trust, ISE NAC) and is a different question.
    "Readiness": "Coverage",
    # "Can I reach it" and "is it up" are the same question asked twice:
    # unreachable inventory, BGP prefix reachability, site link state, and
    # WAN-edge reachable/unreachable counts are all availability.
    "Reachability": "Availability",
    # All three uses already carry Energy and Power. Sustainability is the
    # motivation; Energy is the measurement the search returns.
    "Sustainability": "Energy",
    # Eight Forensics searches and nine Investigation searches, and no stanza
    # ever carries both -- the split is two authors naming one activity, not
    # two activities. Attack Analyzer file-source tracing and the Agentic SOC
    # packet and DNS lead queues are the same job. Investigation wins because
    # it is already the catalogue's word for it, in the sub_category
    # "Unified Detection & Investigation".
    "Forensics": "Investigation",
    # All four uses are z-score and MLTK searches that already carry Anomaly.
    # The baseline is how the anomaly is computed, not a separate subject.
    "Statistical Baseline": "Anomaly",
}

# Umbrella children too thin to stand as their own filter. Each has three
# uses, so picking one returns a set the operator could have reached by name,
# and each is a measurement of its parent rather than a distinct subject: a
# byte count and a throughput rate are both traffic, and a queue is a
# property of a port. Unlike GENERIC_TAGS these still prove their umbrella,
# so new_tags credits the parent from TAG_IMPLIES before dropping the child.
FOLDED_CHILD_TAGS = {"Bytes", "Throughput", "Queues"}

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


# The only two tags the application itself reads. Both are
# autoDiscovery.requiredTag values in common/config/insightsWorkspaces.ts and
# are matched in pages/executive_insights/index.tsx; dropping either would
# empty a workspace. Everything else in record.tags is user-facing filtering
# only -- section routing goes through autoDiscovery.subCategoryToSection and
# never looks at a tag.
LOAD_BEARING_TAGS = {"Secure Networking", "Agentic SOC"}

# Workspace section names that are also sub_category values. A tag here
# selects exactly the stanzas its identically-named sub_category selects, so
# it costs a chip in the filter bar and returns the set the operator already
# had. They were previously exempted from restates_own_taxonomy and re-added
# by new_tags on the theory that the workspace read them; it does not.
SECTION_NAME_TAGS = {
    "Zero Trust Access", "Secure Infrastructure",
    "Scalable Network Segmentation", "Hybrid Mesh Firewalling", "Agentic Ops",
    "Secure Data Center Operations",
}

# Umbrella tags are DERIVED, never trusted from the stanza.
#
# These are the broad subjects an operator browses by first -- "show me the
# firewall searches", "show me the routing searches". Applied by hand they
# were a trap: "Firewall" sat on 56 of the 88 searches that read a firewall
# product, "Routing" on 5 of 41, "Threats" on 2 of 31. A filter that returns
# a seventh of the truth is worse than no filter, because it looks like it
# worked. Deriving each umbrella from tags that are themselves specific and
# verifiable means every qualifying search gets it and no future edit can
# make the umbrella partial again.
#
# Each child either IS an instance of the umbrella (ASA is a firewall,
# IS-IS is a routing protocol) or is a component of one (a transceiver is
# part of an interface). Product and vendor names that only sometimes belong
# are deliberately absent: Meraki sells firewalls, switches, and access
# points, so "Meraki" cannot imply any of the three.
TAG_IMPLIES = {
    # --- Firewall ------------------------------------------------------
    "ASA": "Firewall",
    "Secure Firewall": "Firewall",
    "Palo Alto": "Firewall",
    "Multicloud Defense": "Firewall",
    # --- Routing -------------------------------------------------------
    # "Tunnels" and "Control Plane" are deliberately not children: both are
    # dominated by SD-WAN TLOC and vManage searches, which are WAN health,
    # not routing. The MPLS-TE tunnels that are routing already carry MPLS-TE.
    "BGP": "Routing",
    "IS-IS": "Routing",
    "RIB": "Routing",
    "MPLS-TE": "Routing",
    "Fast Reroute": "Routing",
    # --- Wireless ------------------------------------------------------
    "Access Points": "Wireless",
    "SSID": "Wireless",
    "Rogue AP": "Wireless",
    # --- Threats -------------------------------------------------------
    "Malware": "Threats",
    "Intrusions": "Threats",
    "Intrusion Prevention": "Threats",
    "MITRE ATT&CK": "Threats",
    "Threat Intelligence": "Threats",
    "Threat Hunting": "Threats",
    "UTD": "Threats",
    "AMP": "Threats",
    # --- Traffic -------------------------------------------------------
    # A flow record, a NetFlow record, a byte count, and a throughput rate
    # are all measurements of traffic.
    "Flows": "Traffic",
    "NetFlow": "Traffic",
    "Bytes": "Traffic",
    "Throughput": "Traffic",
    "Network Traffic": "Traffic",
    # --- Interfaces ----------------------------------------------------
    # Optics, transceivers, and queues are all properties of a port.
    "Optical": "Interfaces",
    "Transceiver Health": "Interfaces",
    "Queues": "Interfaces",
    # --- Sensors -------------------------------------------------------
    "Environmental": "Sensors",
}

# Umbrellas whose membership cannot be read off another tag.
#
# "Authentication" is the case that forced this: the obvious children (ISE,
# Duo, Active Directory) do not work, because ISE's authentication log is
# also the source of SGT group assignment and of ISE node health, and Duo's
# administrator log is an audit trail. Product presence is therefore not
# evidence; an authentication outcome in the SPL is. Matched against the SPL
# plus the stanza id and display name.
UMBRELLA_EVIDENCE = {
    "Authentication": re.compile(
        r"\bauthenticat|"
        r"DATAMODEL\s*=\s*Authentication|datamodel\s+Authentication|"
        r"Passed[-_]Authentications?|Failed[-_]Attempts?|"
        r"\bRADIUS\b|\bTACACS\b|\bMFA\b|\b802\.1x\b|"
        r"EventCode\s*=\s*\"?4(?:624|625|634|740|768|771)|"
        r"\blog[_ ]?ons?\b|\blog[_ ]?ins?\b|\bsign[_ -]?ins?\b|"
        r"\blogged[_ ]?in\b|"
        r"cisco:duo:(?:authentication|telephony|trust_monitor)|"
        r"account[_ ]?lock|locked[_ ]?account|\block[_ ]?outs?\b|"
        r"\bguest[_ ]?auth|"
        # ISE reports authentication outcomes by message id, not by word:
        # 5200 is Passed-Authentication and 5400 Failed-Attempt, and
        # FailureReason only ever appears on an authentication record.
        r"\bFailureReason\b|\"5[24]00\"|\bAAA\b",
        re.I,
    ),
    # "Threats" was on 2 of the 31 searches carrying a threat-specific tag.
    # Child tags fix those; this catches the searches that name no child --
    # the eleven SD-WAN UTD searches in particular, which shipped with SD-WAN
    # as their only tag. Matched on product-neutral evidence only: the bare
    # word "threat" is deliberately absent because three Cisco product names
    # contain it (Email Threat Defense, Firewall Threat Defense, Multicloud
    # Defense threat feeds) and would tag their admin and audit searches.
    "Threats": re.compile(
        r"\bmalware\b|\bransomware\b|\bintrusions?\b|\bsnort\b|\bbotnet\b|"
        r"\bphishing\b|\bmitre\b|command[- _]and[- _]control|\bexploit|"
        r"cisco:sdwan:utd|cisco:ftd:intrusion|cisco:ftd:malware|"
        r"threat[_ ]?(?:hunt|intel|detect|type|name|score|actor|vector|categ)",
        re.I,
    ),
}

# Feed-coverage searches enumerate every sourcetype in the estate, so their
# SPL mentions authentication and intrusion without being about either.
EVIDENCE_EXEMPT_SUBS = {"Feed Health", "Feed Inventory"}

# Every derived umbrella, for the restatement exemption below.
UMBRELLA_TAGS = set(TAG_IMPLIES.values()) | set(UMBRELLA_EVIDENCE)

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
    # These three carry "IPS", which TAG_CANON resolves to Intrusion
    # Prevention and TAG_IMPLIES would then resolve to Threats, so a single
    # mistyped tag would spread. None of the three reads an IPS: the two
    # ThousandEyes searches read Cisco_ThousandEyes.Alerts, where
    # "Alerts.signature" is the alert rule name, and the IOS one counts
    # process crash tracebacks, where "SIG" is a Unix signal.
    "teuc_5_9_46_alert_severity_distribution": {"Intrusion Prevention"},
    "teuc_5_9_54_mttr_reduction_via_network_vs_application_isolation": {
        "Intrusion Prevention"
    },
    "network_ios_traceback_by_device": {"Intrusion Prevention"},
}

# Recognized product/source tags. Used to check a search kept its product.
PRODUCT_TAGS = {
    "Catalyst Center", "Cisco ACI", "Cisco Spaces", "ThousandEyes", "ISE",
    "Meraki", "SD-WAN", "Nexus Dashboard", "Nexus 9000", "Secure Firewall",
    "Secure Access", "Cyber Vision", "Zeek", "Endace", "Splunk Attack Analyzer",
    "Webex", "Active Directory", "VMware", "Duo", "XDR",
    "Intersight", "Umbrella", "Multicloud Defense", "ASA", "Secure Client",
    "AI Defense", "AKIPS", "Palo Alto", "Isovalent", "Secure Workload",
    "Secure Network Analytics", "Email Threat Defense", "Secure Endpoint",
    "Email Security", "Cisco IQ", "ServiceNow", "Zscaler", "NetFlow",
    "Cisco IOS-XR", "IOS", "Windows DHCP", "ISC DHCP", "Splunk Platform", "F5",
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
    # index_dhcp carries two different DHCP servers, and until now only the
    # Windows one had a product tag, so the tag filter could not separate
    # them. "dhcpd" is the ISC DHCP daemon: the two DHCP - Operations
    # searches that read it parse ISC lease text ("No Lease offered",
    # DHCPDISCOVER, DHCPv6 INFORMATION-REQUEST) and cite isc.org in their
    # related_info, none of which appears in the comma-separated numeric
    # event IDs that Windows DHCP writes. Keyed on the source type rather
    # than the stanza id so the tag follows the SPL if the feed is
    # re-onboarded under a different name.
    (r"sourcetype=\"?dhcpd", "ISC DHCP"),
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


def restates_own_taxonomy(tag: str, cat: str, sub: str) -> bool:
    """True when a tag only repeats the stanza's own category or sub_category.

    Such a tag cannot narrow anything: every search it selects is already
    reachable by picking that category or sub_category in the UI, so it costs
    a chip in the filter bar and returns the same set. Exact equality only --
    "Client Health" against a sub_category of "Client Sessions" is a
    different claim and is left alone.

    Three exemptions, none of them stylistic:
      * LOAD_BEARING_TAGS -- the two requiredTag values the workspace code
        matches on. Neither is a sub_category today, so this exemption never
        fires; it is here so that renaming a sub_category to "Secure
        Networking" cannot silently empty a workspace.
      * UMBRELLA_TAGS -- the whole point of a derived umbrella is that it
        returns every qualifying search. Suppressing "Firewall" on the seven
        searches filed under sub_category "Firewall" would make the chip
        return 81 of 88 again, which is the defect the derivation exists to
        fix. The duplication is accepted knowingly and costs nothing: the
        chip already exists in the vocabulary.
      * PRODUCT_TAGS -- a product name is provenance. It answers "which feed
        is this?", which stays a real question even when the sub_category
        happens to carry the same words. All three uses of
        "Vulnerability Intelligence" are restatements and would vanish.

    "Threat Hunting" is deliberately NOT exempt even though the rule erases it
    from the vocabulary outright: all seven uses sit under that sub_category,
    so the chip would return exactly what the facet already returns. It still
    feeds the Threats umbrella, because implication runs on the raw tags before
    this filter.
    """
    if tag in LOAD_BEARING_TAGS or tag in UMBRELLA_TAGS or tag in PRODUCT_TAGS:
        return False
    return tag == cat or tag == sub


def new_tags(name: str, chunk: str) -> list[str]:
    raw = [t.strip() for t in field(chunk, "tags").split(",") if t.strip()]
    spl = spl_of(chunk)
    evidence = f"{spl} {name} {field(chunk, 'search_name')}"
    # Compare against the CORRECTED taxonomy, not the shipped fields: reading
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
    # Umbrella parents proved by a child tag. Collected before the
    # restatement and section-name drops below, because a child that is
    # dropped as a restatement still proves the umbrella: an intrusion search
    # filed under sub_category "Intrusion Prevention" loses the child tag but
    # is no less about threats, and dropping the parent with it would put the
    # partial-coverage defect straight back.
    implied: list[str] = []
    for tag in raw:
        tag = TAG_CANON.get(tag, tag)
        if tag in FOLDED_CHILD_TAGS:
            parent = TAG_IMPLIES.get(tag)
            if parent and parent not in implied:
                implied.append(parent)
            continue
        if tag in subject_tags:
            if tag not in kept:
                kept.append(tag)
            continue
        if tag in VIZ_TAGS or tag in JUNK_TAGS:
            continue
        if tag in CUSTOMER_TAGS or tag in GENERIC_TAGS:
            continue
        if tag in SUBCATEGORY_ECHO_TAGS:
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
        parent = TAG_IMPLIES.get(tag)
        if parent and parent not in implied:
            implied.append(parent)
        # A section name is a label for a slice of one workspace, and the
        # workspace decides that slice from sub_category alone. On its own
        # stanzas the tag is a restatement; anywhere else it claims a section
        # the search is not in. Neither is worth a chip, so it goes in both
        # cases. Safe to drop: nothing reads these. Auto-discovery matches
        # only the requiredTag values plus subCategoryToSection.
        if tag in SECTION_NAME_TAGS:
            continue
        if restates_own_taxonomy(tag, own_cat, own_sub):
            continue
        if tag in TAG_REQUIRES_EVIDENCE and not re.search(
            TAG_REQUIRES_EVIDENCE[tag], evidence, re.I
        ):
            continue
        if tag not in kept:
            kept.append(tag)

    for parent in implied:
        if parent not in kept:
            kept.append(parent)

    # A search that reads every index in the estate mentions everything, so
    # its SPL is not evidence of a subject. Same threshold, and the same
    # reason, as the product net below.
    index_macros = len(set(re.findall(r"`(index_[a-z0-9_]+)`", spl, re.I)))
    if own_sub not in EVIDENCE_EXEMPT_SUBS and index_macros < 6:
        for parent, pattern in UMBRELLA_EVIDENCE.items():
            if parent not in kept and pattern.search(evidence):
                kept.append(parent)

    # Never let a search end up with no product/source tag. Skip searches that
    # span many index macros: picking the first sourcetype match would claim
    # one arbitrary product for what is really a cross-estate coverage search.
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

    # Some firewall searches run on vendor-neutral CIM but are named for the
    # product they were written against. The name is the only record of that.
    if not any(t in PRODUCT_TAGS for t in kept) and index_macros < 6:
        identity = f"{name} {field(chunk, 'search_name')}"
        if re.search(r"\bftd\b|_ftd_|(?:^|_|\s)fw[_\s]|\bfirewall\b", identity, re.I):
            kept.insert(0, "Secure Firewall")

    # The two nets above can add a product that is itself an umbrella child,
    # so the implication has to run once more over what they added.
    for tag in list(kept):
        parent = TAG_IMPLIES.get(tag)
        if parent and parent not in kept:
            kept.append(parent)

    # Structural floor: nothing ships tagless. Exactly one search reaches
    # this point, the all-feeds health matrix: its only shipped tag was
    # "Events", and its eighteen index macros stop both product nets from
    # claiming a single product for it. What it reports is how much of the
    # estate is still sending data, which is what Coverage says elsewhere.
    # apply_searchbase_taxonomy.py fails the run if this floor is ever
    # reached by a stanza it cannot describe.
    if not kept:
        kept.append("Coverage")
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
