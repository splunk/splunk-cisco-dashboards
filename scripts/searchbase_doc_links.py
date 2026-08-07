#!/usr/bin/env python3
"""Verified vendor documentation links and per-stanza product detection.

Every URL below returned HTTP 200 from a live fetch on 2026-08-07. The catalog
is customer-facing, so a dead link is worse than no link: keep this the single
place URLs are defined, re-verify with ``--verify`` before shipping a release,
and never add an entry that has not been fetched.

Product detection deliberately prefers ``sourcetype`` over the index macro.
Macros are domain-scoped rather than product-scoped -- ``index_dc`` covers both
ACI and Nexus Dashboard, and ``index_security`` spans half a dozen products --
so the macro is only consulted when no sourcetype resolves.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))


@dataclass(frozen=True)
class Doc:
    title: str
    url: str
    blurb: str


# --------------------------------------------------------------------------
# Verified 2026-08-07. Each entry is the vendor's canonical landing page for
# the product, chosen over deep links because section URLs churn between
# releases while these series//docs roots do not.
# --------------------------------------------------------------------------
PRODUCT_DOCS: dict[str, Doc] = {
    "catalyst_center": Doc(
        "Cisco Catalyst Center support documentation",
        "https://www.cisco.com/c/en/us/support/cloud-systems-management/dna-center/series.html",
        "Configuration and API guides for the assurance, inventory, and compliance data this search reads.",
    ),
    "spaces": Doc(
        "Cisco Spaces Configuration Guide",
        "https://www.cisco.com/c/en/us/td/docs/wireless/spaces/config-guide/ciscospaces-configuration-guide.html",
        "Covers the location hierarchy and firehose event types behind Cisco Spaces telemetry.",
    ),
    "meraki": Doc(
        "Cisco Meraki documentation",
        "https://documentation.meraki.com/",
        "Reference for the Meraki dashboard, API, and device telemetry consumed here.",
    ),
    "ise": Doc(
        "Cisco Identity Services Engine support documentation",
        "https://www.cisco.com/c/en/us/support/security/identity-services-engine/series.html",
        "Administration guides covering the authentication, authorization, and profiling records this search reads.",
    ),
    "ftd": Doc(
        "Cisco Secure Firewall support documentation",
        "https://www.cisco.com/c/en/us/support/security/firepower-ngfw/series.html",
        "Configuration guides for the firewall policy, connection, and intrusion events used here.",
    ),
    "asa": Doc(
        "Cisco Secure Firewall ASA support documentation",
        "https://www.cisco.com/c/en/us/support/security/adaptive-security-appliance-asa-software/series.html",
        "Syslog message reference and configuration guides for ASA-sourced events.",
    ),
    "sdwan": Doc(
        "Cisco Catalyst SD-WAN support documentation",
        "https://www.cisco.com/c/en/us/support/routers/sd-wan/series.html",
        "Configuration and monitoring guides for the SD-WAN fabric, tunnels, and application-aware routing.",
    ),
    "thousandeyes": Doc(
        "Cisco ThousandEyes documentation",
        "https://docs.thousandeyes.com/",
        "Reference for test types, metrics, and alerting semantics behind ThousandEyes data.",
    ),
    "duo": Doc(
        "Cisco Duo documentation",
        "https://duo.com/docs",
        "Administration and log reference for Duo authentication and device trust events.",
    ),
    "aci": Doc(
        "Cisco APIC and ACI support documentation",
        "https://www.cisco.com/c/en/us/support/cloud-systems-management/application-policy-infrastructure-controller-apic/series.html",
        "Object model and fault reference for the APIC managed objects this search queries.",
    ),
    "nexus_dashboard": Doc(
        "Cisco Nexus Dashboard support documentation",
        "https://www.cisco.com/c/en/us/support/data-center-analytics/nexus-dashboard/series.html",
        "Operations guides for the Nexus Dashboard anomalies and advisories reported here.",
    ),
    "nexus9k": Doc(
        "Cisco Nexus 9000 Series support documentation",
        "https://www.cisco.com/c/en/us/support/switches/nexus-9000-series-switches/series.html",
        "Platform and NX-OS references for the switch telemetry consumed here.",
    ),
    "cybervision": Doc(
        "Cisco Cyber Vision support documentation",
        "https://www.cisco.com/c/en/us/support/security/cyber-vision/series.html",
        "Reference for OT asset discovery, baselines, and the vulnerability records used here.",
    ),
    "secure_client": Doc(
        "Cisco Secure Client support documentation",
        "https://www.cisco.com/c/en/us/support/security/anyconnect-secure-mobility-client/series.html",
        "Deployment guides covering Network Visibility Module flow records and VPN session data.",
    ),
    "xdr": Doc(
        "Cisco XDR documentation",
        "https://docs.xdr.security.cisco.com/",
        "Reference for XDR incidents, detections, and the response actions suggested here.",
    ),
    "umbrella": Doc(
        "Cisco Umbrella documentation",
        "https://docs.umbrella.com/",
        "Log formats and policy reference for DNS, web, and firewall activity from Umbrella.",
    ),
    "secure_access": Doc(
        "Cisco Secure Access documentation",
        "https://docs.sse.cisco.com/",
        "Reference for the Secure Access (SSE) policy and activity records this search reads.",
    ),
    "multicloud": Doc(
        "Cisco Multicloud Defense",
        "https://www.cisco.com/c/en/us/products/security/multicloud-defense/index.html",
        "Product reference for the multicloud gateway policy and traffic decisions reported here.",
    ),
    "ai_defense": Doc(
        "Cisco AI Defense",
        "https://www.cisco.com/site/us/en/products/security/ai-defense/index.html",
        "Product reference for AI application visibility, guardrails, and the verdicts used here.",
    ),
    "ios_xe": Doc(
        "Cisco IOS XE 17 support documentation",
        "https://www.cisco.com/c/en/us/support/ios-nx-os-software/ios-xe-17/series.html",
        "Command and system message references for the IOS XE syslog and telemetry read here.",
    ),
    "catalyst_switching": Doc(
        "Cisco Catalyst 9300 Series support documentation",
        "https://www.cisco.com/c/en/us/support/switches/catalyst-9300-series-switches/series.html",
        "Platform guides for the access-layer switching telemetry consumed here.",
    ),
    "ucs": Doc(
        "Cisco UCS Manager support documentation",
        "https://www.cisco.com/c/en/us/support/servers-unified-computing/ucs-manager/series.html",
        "Fault and inventory reference for the UCS compute data this search reads.",
    ),
    "intersight": Doc(
        "Cisco Intersight help",
        "https://intersight.com/help/saas",
        "Reference for Intersight inventory, advisories, and alarm semantics.",
    ),
    "attack_analyzer": Doc(
        "Splunk Attack Analyzer",
        "https://www.splunk.com/en_us/products/attack-analyzer.html",
        "Product reference for the automated threat analysis verdicts consumed here.",
    ),
    "webex": Doc(
        "Webex device people counting",
        "https://help.webex.com/en-us/article/n0dm2eab/Webex-Room-and-Desk-devices-people-count",
        "Explains how Webex room devices derive the occupancy counts used here.",
    ),
    "mso": Doc(
        "Cisco Multi-Site Orchestrator support documentation",
        "https://www.cisco.com/c/en/us/support/cloud-systems-management/multi-site-orchestrator/series.html",
        "Reference for the multi-site fabric policy and health records read here.",
    ),
    "secure_workload": Doc(
        "Cisco Secure Workload support documentation",
        "https://www.cisco.com/c/en/us/support/security/tetration/series.html",
        "Reference for workload telemetry, segmentation policy, and the flow records used here.",
    ),
    "etd": Doc(
        "Cisco Email Threat Defense support documentation",
        "https://www.cisco.com/c/en/us/support/security/cloud-mailbox-defense/series.html",
        "Reference for the mailbox threat verdicts and remediation actions reported here.",
    ),
    "esa": Doc(
        "Cisco Secure Email Gateway support documentation",
        "https://www.cisco.com/c/en/us/support/security/email-security-appliance/series.html",
        "Message tracking and log reference for the email security events consumed here.",
    ),
    "wsa": Doc(
        "Cisco Secure Web Appliance support documentation",
        "https://www.cisco.com/c/en/us/support/security/web-security-appliance/series.html",
        "Access-log reference for the proxied web transactions read here.",
    ),
    "sma": Doc(
        "Cisco Secure Email and Web Manager support documentation",
        "https://www.cisco.com/c/en/us/support/security/content-security-management-appliance/series.html",
        "Reference for centralised reporting and quarantine records used here.",
    ),
}

# Longest-prefix match wins, so `cisco:dc:nd` resolves before `cisco:dc`.
SOURCETYPE_PREFIXES: dict[str, str] = {
    "cisco:dnac": "catalyst_center",
    "cisco:catalyst": "catalyst_center",
    "cisco:spaces": "spaces",
    "meraki": "meraki",
    "cisco:meraki": "meraki",
    "cisco:ise": "ise",
    "cisco:dc:nd": "nexus_dashboard",
    "cisco:dc:aci": "aci",
    "cisco:dc:nexus": "nexus9k",
    "cisco:ftd": "ftd",
    "cisco:fmc": "ftd",
    "cisco:sfw": "ftd",
    "cisco:asa": "asa",
    "cisco:sdwan": "sdwan",
    "cisco:thousandeyes": "thousandeyes",
    "cisco:duo": "duo",
    "cisco:xdr": "xdr",
    "cisco:cloud_security": "umbrella",
    "cisco:sse": "secure_access",
    "cisco:multicloud": "multicloud",
    "cisco:ai": "ai_defense",
    "cisco:ios": "ios_xe",
    "cisco:cybervision": "cybervision",
    "cisco:nvm": "secure_client",
    "cisco:secureclient": "secure_client",
    "cisco:anyconnect": "secure_client",
    "cisco:ucs": "ucs",
    "cisco:intersight": "intersight",
    "splunk:aa": "attack_analyzer",
    "cisco:webex": "webex",
    "cisco:dc:mso": "mso",
    "cisco:secure:workload": "secure_workload",
    "cisco:etd": "etd",
    "cisco:esa": "esa",
    "cisco:wsa": "wsa",
    "cisco:sma": "sma",
}

# Only unambiguous macros appear here. `index_dc` (ACI plus Nexus Dashboard) and
# `index_security` (many products) are intentionally absent: guessing a product
# for them would attach a confidently wrong link.
MACRO_PRODUCTS: dict[str, str] = {
    "index_catalyst": "catalyst_center",
    "index_spaces": "spaces",
    "index_meraki": "meraki",
    "index_identity": "ise",
    "index_firewall": "ftd",
    "index_sdwan": "sdwan",
    "index_thousandeyes": "thousandeyes",
    "index_duo": "duo",
    "index_cybervision": "cybervision",
    "index_nvm": "secure_client",
    "index_ucs": "ucs",
    "index_intersight": "intersight",
    "index_network": "ios_xe",
}

DATAMODEL_PRODUCTS: dict[str, str] = {
    "Cisco_ThousandEyes": "thousandeyes",
    "Cisco_Catalyst_App": "catalyst_center",
    # Named for the product it models. The other Cisco_DCN_* models
    # (Fault, Auth, Statistics) span both ACI and Nexus Dashboard sources, so
    # they are left unresolved rather than mapped to a guess.
    "Cisco_DCN_nexus_dashboard": "nexus_dashboard",
}

# APIC is the ACI controller, so any `apic-*` structural macro is ACI by
# definition regardless of which index the search reads.
MACRO_PREFIX_PRODUCTS: dict[str, str] = {"apic-": "aci"}

_SOURCETYPE_RE = re.compile(r'sourcetype\s*(?:=|IN\s*\()\s*"?([a-zA-Z0-9:_*.\-]+)"?')
_MACRO_RE = re.compile(r"`(index_[a-z0-9_]+)`")
_ANY_MACRO_RE = re.compile(r"`([a-zA-Z][\w-]*)")
_DATAMODEL_RE = re.compile(r"datamodel\s*=\s*([A-Za-z0-9_]+)")


def detect_product(spl: str) -> tuple[str | None, str]:
    """Return ``(product_key, evidence)`` for a search, or ``(None, reason)``."""
    sourcetypes = _SOURCETYPE_RE.findall(spl)
    for sourcetype in sourcetypes:
        matches = [p for p in SOURCETYPE_PREFIXES if sourcetype.startswith(p)]
        if matches:
            best = max(matches, key=len)
            return SOURCETYPE_PREFIXES[best], f'sourcetype "{sourcetype}"'

    for datamodel in _DATAMODEL_RE.findall(spl):
        if datamodel in DATAMODEL_PRODUCTS:
            return DATAMODEL_PRODUCTS[datamodel], f"datamodel {datamodel}"

    for macro in _MACRO_RE.findall(spl):
        if macro in MACRO_PRODUCTS:
            return MACRO_PRODUCTS[macro], f"macro `{macro}`"

    for macro in _ANY_MACRO_RE.findall(spl):
        for prefix, product in MACRO_PREFIX_PRODUCTS.items():
            if macro.startswith(prefix):
                return product, f"macro `{macro}`"

    if sourcetypes:
        return None, f'unmapped sourcetype "{sourcetypes[0]}"'
    return None, "no sourcetype, datamodel, or mapped macro"


def verify() -> int:
    """Fetch every URL and report non-200 responses."""
    failures = 0
    for key, doc in PRODUCT_DOCS.items():
        result = subprocess.run(
            ["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
             "-L", "--max-time", "25", doc.url],
            capture_output=True, text=True,
        )
        code = result.stdout.strip()
        status = "ok" if code == "200" else "FAIL"
        if code != "200":
            failures += 1
        print(f"{status:<5}{code:<5}{key:<20}{doc.url}")
    print(f"\n{len(PRODUCT_DOCS)} URLs checked, {failures} failing")
    return 1 if failures else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--verify", action="store_true", help="Live-fetch every URL")
    args = ap.parse_args()
    raise SystemExit(verify() if args.verify else 0)
