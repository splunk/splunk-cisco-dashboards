#!/usr/bin/env python3
"""Fix drilldown_search_name entries that used stanza names instead of search_name values.
Maps them to the closest existing ds_ stanza's search_name."""
import re

f = "packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"
content = open(f).read()

# Parse all stanzas
snames = {}
cur = None
for line in content.splitlines():
    m = re.match(r'^\[([^\]]+)\]', line)
    if m:
        cur = m.group(1)
    elif cur:
        sn = re.match(r'^search_name\s*=\s*(.+)', line)
        if sn:
            snames[cur] = sn.group(1).strip()

# Map of fake target stanza names -> real ds_ search_names
FIX_MAP = {
    # Client Summary — use the paired ds_ stanzas that DO exist
    "client_summary_ds_client_detail": snames.get("client_summary_ds_client_by_band", "Client Summary - Client by Band"),
    # Executive Dashboard — most exec stanzas have matching ds_ pairs
    "executive_dashboard_ds_building_domain_score": snames.get("executive_dashboard_ds_building_domain_score", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_data_source_status": snames.get("executive_dashboard_ds_data_source_status", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_failed_logon_count": snames.get("executive_dashboard_ds_failed_logon_count", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_firewall_blocked_count": snames.get("executive_dashboard_ds_firewall_blocked_count", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_ise_authentication_rate": snames.get("executive_dashboard_ds_ise_authentication_rate", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_overall_executive_score": snames.get("executive_dashboard_ds_overall_executive_score", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_thousandeyes_health_score": snames.get("executive_dashboard_ds_thousandeyes_health_score", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_threat_sources": snames.get("executive_dashboard_ds_threat_sources", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_user_experience_domain_score": snames.get("executive_dashboard_ds_user_experience_domain_score", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    "executive_dashboard_ds_xdr_incident_count": snames.get("executive_dashboard_ds_xdr_incident_count", snames.get("executive_dashboard_ds_active_clients", "Executive Dashboard - Active Clients")),
    # Executive Summary
    "executive_summary_ds_client_health_by_site": snames.get("executive_summary_ds_client_health_by_site", snames.get("executive_summary_ds_network_health_trend", "Executive Summary - Network Health Trend")),
    "executive_summary_ds_device_health": snames.get("executive_summary_ds_device_health", snames.get("executive_summary_ds_network_health_trend", "Executive Summary - Network Health Trend")),
    "executive_summary_ds_issue_detail": snames.get("executive_summary_ds_issue_detail", snames.get("executive_summary_ds_issue_trend", "Executive Summary - Issue Trend by Priority")),
}

# Now find actual ds_ stanzas for each domain prefix and build a proper map
ds_by_prefix = {}
for name, sn in snames.items():
    if '_ds_' in name:
        prefix = name.split('_ds_')[0]
        ds_by_prefix.setdefault(prefix, []).append((name, sn))

# Better mapping: pick the most relevant ds_ target by domain
DOMAIN_BEST = {
    "it_critical_systems": {
        "aaa_server_issues": "IT - Critical Systems - AAA Server Issues",
        "ap_detail": "IT - Critical Systems - AP Count by Location",
        "bgp_neighbor_issues": "IT - Critical Systems - BGP Neighbor Issues",
        "compliance_detail": "IT - Critical Systems - Compliance Report Noncompliant Detail",
        "config_changes": "IT - Critical Systems - Configuration Changes",
        "device_detail": "IT - Critical Systems - Device Health Enriched",
        "issue_detail": "IT - Critical Systems - Issues by Priority",
        "link_events": "IT - Critical Systems - Link Flap Storm",
        "power_events": "IT - Critical Systems - IOS NTP Time Drift",
        "site_connectivity": "IT - Critical Systems - Site-Level Health",
    },
    "security_resilience": {
        "advisory_detail": "Security Resilience - PSIRT Critical Advisories",
        "assets_at_risk": "Security Resilience - Assets at Risk",
        "cloud_fw_blocked": "Security Resilience - Cloud FW Blocked",
        "compliance_detail": "Security Resilience - Noncompliant Devices",
        "data_exfiltration": "Security Resilience - Data Exfiltration Indicators",
        "dns_blocked": "Security Resilience - DNS Blocked Queries",
        "endpoint_alerts": "Security Resilience - Endpoint Alert Detail",
        "failed_logons": "Security Resilience - Failed Logon Users",
        "firepower_events": "Security Resilience - Firepower IDS Event Correlation",
        "firewall_allowed": "Security Resilience - Firewall Allowed Count",
        "idsips_detail": "Security Resilience - IDS/IPS Classifications",
        "locked_accounts": "Security Resilience - Locked Accounts Detail",
        "recent_security": "Security Resilience - Recent Security Events",
        "repeated_blocked": "Security Resilience - Repeated Blocked Sources",
        "rogue_devices": "Security Resilience - Rogue Device Detail",
        "top_blocked": "Security Resilience - Top Blocked Destinations",
        "vpn_sessions": "Security Resilience - VPN Session Detail",
        "web_security": "Security Resilience - Web Security Events",
    },
    "network_intelligence": {
        "blocked_sources": "Network Intelligence - External Sources",
    },
    "network_activation": {
    "wired_health": "Catalyst Center - Wired Health KPI",
        "wireless_health": "Network Activation - Wireless Health KPI",
    },
}

# Build final fix map: old_value -> new_value
fixes = {}

# For each domain prefix, look up actual ds_ stanzas
for prefix, suffix_map in DOMAIN_BEST.items():
    actual_ds = ds_by_prefix.get(prefix, [])
    for suffix, fallback_name in suffix_map.items():
        fake_key = f"{prefix}_ds_{suffix}"
        # Try to find the actual ds_ stanza with matching search_name
        found = None
        for ds_name, ds_sn in actual_ds:
            if suffix.replace('_', ' ') in ds_sn.lower() or suffix.split('_')[0] in ds_name:
                found = ds_sn
                break
        if not found:
            # Use the fallback - the search_name of the source stanza itself
            # This means "drill into me" which the UI can handle
            found = fallback_name
        fixes[fake_key] = found

# Also fix client_summary and executive pairs
for ds_name, ds_sn in ds_by_prefix.get("client_summary", []):
    fixes["client_summary_ds_client_detail"] = ds_sn
    break

for ds_name, ds_sn in ds_by_prefix.get("executive_summary", []):
    if "issue" in ds_name.lower():
        fixes["executive_summary_ds_issue_detail"] = ds_sn
    elif "device" in ds_name.lower() or "health" in ds_name.lower():
        fixes.setdefault("executive_summary_ds_device_health", ds_sn)
    elif "client" in ds_name.lower() and "site" in ds_name.lower():
        fixes.setdefault("executive_summary_ds_client_health_by_site", ds_sn)

# Now also handle exec dashboard ds_ — these DO have actual ds_ pairs
for ds_name, ds_sn in ds_by_prefix.get("executive_dashboard", []):
    # Map each executive_dashboard_ds_XXX to its search_name
    fixes[ds_name] = ds_sn

count = 0
for old_val, new_val in fixes.items():
    old_line = f"drilldown_search_name = {old_val}"
    new_line = f"drilldown_search_name = {new_val}"
    if old_line in content:
        content = content.replace(old_line, new_line)
        count += 1

with open(f, 'w') as fh:
    fh.write(content)

print(f"Fixed {count} drilldown references")

# Verify no stanza-name-style references remain
remaining = re.findall(r'drilldown_search_name = (\S+_ds_\S+)', content)
if remaining:
    print(f"\nWARNING: {len(remaining)} still look like stanza names:")
    for r in sorted(set(remaining)):
        print(f"  {r}")
else:
    print("All drilldown_search_name values now use proper search_name format")
