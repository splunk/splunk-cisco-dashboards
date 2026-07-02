#!/usr/bin/env python3
"""Harvest Cisco Catalyst App dashboard SPL into searchbase.conf.

Keeps upstream SPL byte-identical (modulo whitespace). Token-bearing
queries are skipped — run detokenize_searchbase_conf.py separately for
Dashboard Studio reconciliation stanzas.

Usage:
  python3 scripts/harvest_catalyst_app_to_searchbase.py --pilot
  python3 scripts/harvest_catalyst_app_to_searchbase.py --wave2
  python3 scripts/harvest_catalyst_app_to_searchbase.py --all
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = REPO / (
    "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
)
DEFAULT_MANIFEST = REPO / "docs/catalyst_app_harvest_manifest.json"
FORMAT_SCRIPT = REPO / "scripts/format_searchbase_conf.py"

CV = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Cyber_Vision_Syslog_Events"
SGACL = "Cisco_Catalyst_Dataset.Cisco_Catalyst_SGACL_Events"
VULN = "Cisco_Catalyst_Dataset.Cisco_Catalyst_Vulnerabilities_Events"

TOKEN = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*\$")

PILOT_STANZAS: list[tuple[str, dict[str, str]]] = [
    (
        "catalyst_harvest_cv_syslog_events_by_host",
        {
            "search_name": "Cyber Vision - Events - Syslog Volume by Host",
            "category": "Security",
            "sub_category": "Cyber Vision OT",
            "tags": "Cyber Vision,Events,Hosts,Leaderboard,Catalyst App Harvest",
            "default_viz": "splunk.table",
            "description": (
                '<p>Counts Cisco Cyber Vision syslog events per OT host using the '
                "<code>Cisco_Catalyst_Cyber_Vision_Syslog_Events</code> dataset.</p>"
            ),
            "explanation": (
                "<p>Harvested from <code>events_and_incident_viewer.xml</code>. "
                f"<code>tstats</code> with <code>nodename={CV}</code> groups by "
                f"<code>{CV}.syslog_events_host</code>.</p>"
            ),
            "solution": (
                "<p>Use to spot noisy sensors or hosts dominating OT security syslog. "
                "Pair with category-filtered variants for security vs operations traffic.</p>"
            ),
            "related_info": (
                "<ul><li><b>Source dashboard</b><br>"
                "<code>events_and_incident_viewer</code> in cisco-catalyst-app.</li>"
                "<li><b>Dispatch</b><br>Requires <code>cisco-catalyst-app</code> namespace "
                "for <code>Cisco_Catalyst_App</code> acceleration.</li></ul>"
            ),
            "search": (
                f'| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App '
                f"where nodename={CV} by {CV}.syslog_events_host"
            ),
        },
    ),
    (
        "catalyst_harvest_cv_security_events_by_host",
        {
            "search_name": "Cyber Vision - Events - Security Events by Host",
            "category": "Security",
            "sub_category": "Cyber Vision OT",
            "tags": "Cyber Vision,Events,Security,Hosts,Leaderboard,Catalyst App Harvest",
            "default_viz": "splunk.table",
            "description": (
                "<p>Security-category Cyber Vision syslog events per host — OT incidents "
                "and detections only.</p>"
            ),
            "explanation": (
                "<p>Harvested from <code>events_and_incident_viewer.xml</code>. Filters "
                f'<code>{CV}.syslog_events_category = "Security Events"</code> before '
                "grouping by host.</p>"
            ),
            "solution": (
                "<p>Prioritize hosts with rising security-event counts for analyst review "
                "in Cyber Vision console.</p>"
            ),
            "related_info": (
                "<ul><li><b>Category filter</b><br>Matches upstream "
                '<code>Security Events</code> category.</li></ul>'
            ),
            "search": (
                f'| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App '
                f"where nodename={CV} {CV}.syslog_events_category = \"Security Events\" "
                f"by {CV}.syslog_events_host"
            ),
        },
    ),
    (
        "catalyst_harvest_cv_operations_events_by_host",
        {
            "search_name": "Cyber Vision - Events - Operations Events by Host",
            "category": "Security",
            "sub_category": "Cyber Vision OT",
            "tags": "Cyber Vision,Events,Hosts,Leaderboard,Catalyst App Harvest",
            "default_viz": "splunk.table",
            "description": (
                "<p>Operations-category Cyber Vision syslog volume per host — health, "
                "inventory, and platform telemetry.</p>"
            ),
            "explanation": (
                "<p>Harvested from <code>events_and_incident_viewer.xml</code>. Filters "
                f'<code>{CV}.syslog_events_category = "Cisco Cyber Vision Operations"</code>.</p>'
            ),
            "solution": (
                "<p>Separate operational noise from security-category events when triaging "
                "OT visibility gaps.</p>"
            ),
            "related_info": (
                "<ul><li><b>Sibling</b><br>Compare with "
                "<code>catalyst_harvest_cv_security_events_by_host</code>.</li></ul>"
            ),
            "search": (
                f'| tstats `summariesonly` count as "Count" from datamodel=Cisco_Catalyst_App '
                f"where nodename={CV} {CV}.syslog_events_category = \"Cisco Cyber Vision Operations\" "
                f"by {CV}.syslog_events_host"
            ),
        },
    ),
    (
        "catalyst_harvest_sgacl_top_source_ips",
        {
            "search_name": "ISE - SGACL - Top Source IPs",
            "category": "Security",
            "sub_category": "ISE",
            "tags": "ISE,SGACL,Leaderboard,Catalyst App Harvest",
            "default_viz": "splunk.table",
            "description": (
                "<p>Top ten source IPs hitting Cisco TrustSec SGACL policy events.</p>"
            ),
            "explanation": (
                "<p>Harvested from <code>security_insights.xml</code>. "
                f"<code>tstats</code> on <code>{SGACL}</code> groups by "
                f"<code>sgacl_src_ip</code>.</p>"
            ),
            "solution": (
                "<p>Investigate unexpected top talkers for mis-segmentation or overly "
                "permissive SGACL hits.</p>"
            ),
            "related_info": (
                "<ul><li><b>Dataset</b><br>"
                "<code>Cisco_Catalyst_SGACL_Events</code> in Cisco_Catalyst_App.</li></ul>"
            ),
            "search": (
                f"| tstats `summariesonly` fillnull_value=\"N/A\" count as Count "
                f"from datamodel=Cisco_Catalyst_App where nodename={SGACL} "
                f"by {SGACL}.sgacl_src_ip "
                f"| rename {SGACL}.sgacl_src_ip as \"Source IP\" "
                f"| table \"Source IP\" Count "
                f"| sort 0 -Count "
                f"| head 10"
            ),
        },
    ),
    (
        "catalyst_harvest_sgacl_by_action",
        {
            "search_name": "ISE - SGACL - Events by Action",
            "category": "Security",
            "sub_category": "ISE",
            "tags": "ISE,SGACL,Distribution,Bar,Catalyst App Harvest",
            "default_viz": "splunk.bar",
            "description": (
                "<p>SGACL policy event distribution by permit/deny (or upstream action label).</p>"
            ),
            "explanation": (
                "<p>Harvested from <code>security_insights.xml</code>. Groups "
                f"<code>{SGACL}.sgacl_action</code> and sorts by volume.</p>"
            ),
            "solution": (
                "<p>A deny-heavy spike may indicate segmentation policy changes or "
                "misconfigured SGT assignments.</p>"
            ),
            "related_info": (
                "<ul><li><b>Upstream panel</b><br>security_insights SGACL action chart.</li></ul>"
            ),
            "search": (
                f"| tstats `summariesonly` fillnull_value=\"N/A\" count as Count "
                f"from datamodel=Cisco_Catalyst_App where nodename={SGACL} "
                f"by {SGACL}.sgacl_action "
                f"| rename {SGACL}.sgacl_action as Action "
                f"| table Action Count "
                f"| sort 0 -Count"
            ),
        },
    ),
    (
        "catalyst_harvest_vulnerabilities_by_host",
        {
            "search_name": "Catalyst Center - Vulnerabilities - Events by Host",
            "category": "Security",
            "sub_category": "Vulnerability Management",
            "tags": "Catalyst Center,Vulnerabilities,Hosts,Leaderboard,Catalyst App Harvest",
            "default_viz": "splunk.table",
            "description": (
                "<p>Vulnerability telemetry event counts per host from Catalyst Center "
                "reporting.</p>"
            ),
            "explanation": (
                "<p>Harvested from <code>overview.xml</code>. Uses "
                f"<code>{VULN}</code> grouped by <code>vulnerabilities_host</code>.</p>"
            ),
            "solution": (
                "<p>Identify hosts with the highest vulnerability event volume for "
                "patching prioritization.</p>"
            ),
            "related_info": (
                "<ul><li><b>Raw CVI panels</b><br>Existing <code>security_cvi_*</code> "
                "stanzas use Cyber Vision product fields; this DM view is Catalyst Center "
                "vulnerability report data.</li></ul>"
            ),
            "search": (
                f"| tstats fillnull_value=\"N/A\" `summariesonly` count "
                f"from datamodel=Cisco_Catalyst_App where nodename={VULN} "
                f"by {VULN}.vulnerabilities_host"
            ),
        },
    ),
]

LEAF_CATEGORY: dict[str, tuple[str, str, str]] = {
    "cisco_catalyst_cyber_vision_syslog_events": (
        "Security",
        "Cyber Vision OT",
        "Cyber Vision,Events",
    ),
    "cisco_catalyst_cyber_vision_severity_events": (
        "Security",
        "Cyber Vision OT",
        "Cyber Vision,Events",
    ),
    "cisco_catalyst_cyber_vision_device_events": (
        "Security",
        "Cyber Vision OT",
        "Cyber Vision,Devices",
    ),
    "cisco_catalyst_sgacl_events": ("Security", "ISE", "ISE,SGACL"),
    "cisco_catalyst_acl_events": ("Security", "Firewall", "ACL,Events"),
    "cisco_catalyst_authentication_events": ("Identity", "ISE", "ISE,Authentication"),
    "cisco_catalyst_ise_syslog_events": ("Identity", "ISE Infrastructure", "ISE,Events"),
    "ise_syslog_system_health": ("Identity", "ISE Infrastructure", "ISE,Events"),
    "ise_syslog_meraki_policy_sync": ("Identity", "ISE Infrastructure", "ISE,Meraki"),
    "cisco_catalyst_active_issue_events": ("IT Health", "Catalyst Center", "Issues,Catalyst Center"),
    "cisco_catalyst_network_health_events": ("IT Health", "Catalyst Center", "Catalyst Center,Network"),
    "cisco_catalyst_client_inventory_and_health_score_events": (
        "Customer Experience",
        "User Experience",
        "Clients,Catalyst Center",
    ),
    "cisco_catalyst_device_events": ("IT Health", "Catalyst Center", "Devices,Catalyst Center"),
    "cisco_catalyst_vulnerabilities_events": (
        "Security",
        "Vulnerability Management",
        "Vulnerabilities,Catalyst Center",
    ),
    "cisco_catalyst_policy_events": ("Security", "ISE", "ISE,Policy"),
    "cisco_catalyst_network_performance_events": (
        "Monitoring",
        "ThousandEyes",
        "ThousandEyes,Performance",
    ),
    "cisco_catalyst_bandwidth_utilization": ("Network", "NetFlow", "NetFlow,Bandwidth"),
    "cisco_catalyst_application_usage": ("Network", "SD-WAN", "SD-WAN,Applications"),
    "cisco_catalyst_meraki_audit_events": ("Monitoring", "Meraki", "Meraki,Audit"),
    "cisco_catalyst_meraki_clients_events": ("Monitoring", "Meraki", "Meraki,Clients"),
    "cisco_catalyst_camera_events": ("Building", "Meraki", "Meraki,Cameras"),
    "cisco_catalyst_rogue_events": ("Security", "Wireless", "Meraki,Rogue"),
    "cisco_catalyst_security_events": ("Security", "Meraki", "Meraki,Security"),
    "cisco_catalyst_offline_devices": ("Monitoring", "Meraki", "Meraki,Devices"),
    "cisco_catalyst_packet_loss_details": ("Monitoring", "Meraki", "Meraki,Network"),
    "cisco_catalyst_sdwan_sig_tunnel_state": ("Monitoring", "SD-WAN", "SD-WAN,Tunnels"),
    "cisco_catalyst_sdwan_utd_health": ("Security", "SD-WAN", "SD-WAN,UTD"),
    "cisco_catalyst_protocol_events": ("Network", "NetFlow", "NetFlow,Protocols"),
    "cisco_catalyst_user_events": ("Identity", "ISE", "ISE,Users"),
    "cisco_catalyst_ip_sgt_bindings": ("Security", "ISE", "ISE,TrustSec"),
    "cisco_catalyst_center_compliance_report": (
        "IT Health",
        "Catalyst Center",
        "Compliance,Catalyst Center",
    ),
    "cisco_catalyst_center_inventory_reports": (
        "IT Health",
        "Catalyst Center",
        "Devices,Catalyst Center",
    ),
}


def load_formatter():
    spec = importlib.util.spec_from_file_location("format_searchbase_conf", FORMAT_SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def normalize_spl(spl: str) -> str:
    return re.sub(r"\s+", " ", spl).strip()


def spl_in_searchbase(spl: str, sb_text: str) -> bool:
    return normalize_spl(spl) in re.sub(r"\s+", " ", sb_text)


def fold_search(stages: list[str]) -> str:
    out = []
    for i, stage in enumerate(stages):
        stage = stage.strip()
        if not stage:
            continue
        if i == 0 and (stage.startswith("`") or not stage.startswith("|")):
            out.append(stage + ("\\" if i < len(stages) - 1 else ""))
            continue
        if not stage.startswith("|"):
            stage = "| " + stage
        out.append(stage + ("\\" if i < len(stages) - 1 else ""))
    return "\n".join(out)


def unfold_search(search: str) -> list[str]:
    stages, buf = [], ""
    for line in search.split("\n"):
        line = line.strip()
        if not line:
            continue
        cont = line.endswith("\\")
        if cont:
            line = line[:-1].strip()
        if buf and line.startswith("|"):
            stages.append(buf.strip())
            buf = line
        else:
            buf = (buf + " " + line).strip() if buf else line
        if not cont:
            stages.append(buf.strip())
            buf = ""
    if buf.strip():
        stages.append(buf.strip())
    return stages


def infer_viz(spl: str) -> str | None:
    s = spl.lower()
    if "timechart" in s:
        return "splunk.area"
    if re.search(r"\bchart\b", s):
        return "splunk.pie"
    if "singlevalue" in s or re.search(r"\bstats\s+count\s*$", s):
        return "splunk.singlevalue"
    if "table" in s or "sort" in s or "head" in s:
        return "splunk.table"
    if "dedup" in s:
        return "splunk.table"
    return "splunk.table"


def by_dimension(spl: str) -> str:
    m = re.search(r"\bby\s+([^|\\\n]+)", spl, re.I)
    if not m:
        return "count"
    field = m.group(1).strip().split(",")[0].strip()
    leaf = field.split(".")[-1]
    return re.sub(r"[^a-z0-9]+", "_", leaf.lower()).strip("_")[:28] or "count"


def stanza_name(dashboard: str, leaf: str, spl: str, existing: set[str]) -> str:
    dim = by_dimension(spl)
    digest = hashlib.sha256(normalize_spl(spl).encode()).hexdigest()[:6]
    dash = re.sub(r"[^a-z0-9]+", "_", dashboard.lower()).strip("_")[:20]
    leaf_s = re.sub(r"[^a-z0-9]+", "_", leaf.lower()).strip("_")[:24]
    base = f"catalyst_harvest_{dash}_{leaf_s}_{dim}_{digest}"
    name = base[:90]
    n = 2
    while name in existing:
        name = f"{base[:84]}_{n}"
        n += 1
    existing.add(name)
    return name


def titleize(leaf: str, dim: str, dashboard: str) -> str:
    leaf_title = leaf.replace("cisco_catalyst_", "").replace("_", " ").title()
    dim_title = dim.replace("_", " ").title()
    dash_title = dashboard.replace("_", " ").title()
    return f"Catalyst App - {dash_title} - {leaf_title} by {dim_title}"


def build_stanza_fields(meta: dict[str, str]) -> dict[str, str]:
    fields = {
        "search_name": meta["search_name"],
        "search_author": "akhamis",
        "updated_author": "akhamis",
        "version": "1.0.0",
        "date_created": "2026-07-02",
        "date_updated": "2026-07-02",
        "category": meta["category"],
        "sub_category": meta["sub_category"],
        "tags": meta["tags"],
        "dispatch_context": "cisco-catalyst-app",
        "dispatch_context_force": "1",
        "description": meta["description"],
        "explanation": meta["explanation"],
        "solution": meta["solution"],
        "related_info": meta["related_info"],
        "search": fold_search(unfold_search(meta["search"])),
    }
    if meta.get("default_viz"):
        fields["default_viz"] = meta["default_viz"]
    return fields


def meta_from_manifest(entry: dict) -> dict[str, str]:
    spl = entry["spl"].strip()
    leaf = entry["nodename_leaf"]
    dash = entry["dashboard"]
    cat, sub, tag_base = LEAF_CATEGORY.get(
        leaf, ("Network", "Catalyst Center", "Catalyst Center")
    )
    dim = by_dimension(spl)
    title = titleize(leaf, dim, dash)
    tags = f"{tag_base},Catalyst App Harvest"
    if "trend" in spl.lower() or "timechart" in spl.lower():
        tags += ",Trend"
    if "leaderboard" in spl.lower() or "head 10" in spl.lower() or "sort 10" in spl.lower():
        tags += ",Leaderboard"
    return {
        "search_name": title,
        "category": cat,
        "sub_category": sub,
        "tags": tags,
        "default_viz": infer_viz(spl),
        "description": (
            f"<p>Harvested from <code>{dash}.xml</code> in cisco-catalyst-app "
            f"(<code>{leaf}</code> dataset).</p>"
        ),
        "explanation": (
            f"<p>Upstream Catalyst Enterprise Networking dashboard SPL using "
            f"<code>Cisco_Catalyst_App</code> and <code>summariesonly</code>. "
            f"Grouped by <code>{dim}</code>.</p>"
        ),
        "solution": (
            "<p>Validate <code>Cisco_Catalyst_App</code> acceleration and "
            "<code>cisco_catalyst_app_index</code> macro tuning before troubleshooting "
            "empty results.</p>"
        ),
        "related_info": (
            f"<ul><li><b>Provenance</b><br>Harvested from cisco-catalyst-app "
            f"<code>{dash}</code> dashboard.</li>"
            "<li><b>Dispatch</b><br>Runs in <code>cisco-catalyst-app</code> app context.</li></ul>"
        ),
        "search": spl,
    }


def wave2_entries(manifest_path: Path) -> list[dict]:
    data = json.loads(manifest_path.read_text())
    return [
        c
        for c in data["candidates"]
        if c["complexity"] == 0 and not TOKEN.search(c["spl"])
    ]


def add_stanzas(
    stanzas: list[tuple[str, dict[str, str]]],
    to_add: list[tuple[str, dict[str, str]]],
    sb_text: str,
) -> tuple[list[tuple[str, dict[str, str]]], list[str]]:
    existing = {name for name, _ in stanzas}
    added: list[str] = []
    for stanza_name, meta in to_add:
        if spl_in_searchbase(meta["search"], sb_text):
            continue
        if stanza_name in existing:
            continue
        fields = build_stanza_fields(meta)
        stanzas.append((stanza_name, fields))
        existing.add(stanza_name)
        sb_text = sb_text + "\n" + fields["search"]
        added.append(stanza_name)
    return stanzas, added


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    p.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    p.add_argument("--pilot", action="store_true", help="Add fixed pilot stanzas")
    p.add_argument("--wave2", action="store_true", help="Add complexity-0 token-free manifest entries")
    p.add_argument("--all", action="store_true", help="Pilot + wave2")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()

    if not (args.pilot or args.wave2 or args.all):
        args.all = True

    fmt = load_formatter()
    sb_text = args.source.read_text()
    stanzas = fmt.parse_stanzas(sb_text)
    existing_names = {name for name, _ in stanzas}
    batch: list[tuple[str, dict[str, str]]] = []

    if args.pilot or args.all:
        batch.extend(PILOT_STANZAS)

    if args.wave2 or args.all:
        for entry in wave2_entries(args.manifest):
            if spl_in_searchbase(entry["spl"], sb_text):
                continue
            name = stanza_name(
                entry["dashboard"], entry["nodename_leaf"], entry["spl"], existing_names
            )
            batch.append((name, meta_from_manifest(entry)))

    stanzas, added = add_stanzas(stanzas, batch, sb_text)

    if not added:
        print("harvest: nothing to add")
        return 0
    if args.dry_run:
        print(f"would add {len(added)} stanzas")
        for n in added:
            print(f"  {n}")
        return 0

    parts = [fmt.format_stanza(n, f)[0] for n, f in stanzas]
    args.source.write_text("\n\n".join(parts).rstrip() + "\n")
    print(f"harvest added={len(added)}")
    for n in added:
        print(f"  {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
