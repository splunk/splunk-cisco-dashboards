"""Findings reviewed and judged sound prose.

An audit nobody can run to zero stops being used. Everything here was read
against its SPL and found correct; the detector cannot distinguish these
cases without heuristics loose enough to start hiding real defects.

Keyed on (stanza_id, rule, substring of the finding detail). The reason is
the point of the entry -- an allowlist without one is just a mute button.

If prose changes and a finding no longer matches, the audit reports the
entry as stale so these do not silently outlive the text they excuse.
"""

from __future__ import annotations

ALLOWED: list[tuple[str, str, str, str]] = [
    # -- correct prose that names a mechanism in order to reject it ---------
    (
        "executive_dashboard_firewall_blocked_count", "R4", "raw events",
        "Advice about what the drill-down should preserve, not a claim that "
        "this tile reads raw events.",
    ),
    (
        "security_resilience_ds_xdr_detail", "R3", "acceleration",
        "'Tabular views accelerate handoffs between tiers' is English. No "
        "data-model acceleration is claimed.",
    ),
    (
        "overview_link_te_a2a_inventory", "R3", "acceleration",
        "Names acceleration to explain why this search deliberately reads "
        "raw metric events instead.",
    ),
    (
        "secure_networking_intersight_advisory_exposure", "R5", "index_ucs",
        "Names the macro to state what this stanza's scoping excludes.",
    ),
    (
        "dc_networking_policy_policy_subtype_breakdown", "R6", "timechart",
        "Offers timechart as a next step for trending, which this "
        "single-window count correctly does not do.",
    ),
    (
        "secure_networking_intersight_audit_trail_by_user", "R1",
        "cisco:intersight:advisories",
        "Names the advisories sourcetype to say other stanzas cover it, and "
        "that this one is the first to surface auditrecords.",
    ),

    # -- prose describing a sibling stanza rather than itself ---------------
    (
        "network_intelligence_zeek_conn_blocked_ratio_trend_dm", "R5",
        "index_network",
        "Bullet describes the raw-event twin "
        "network_intelligence_zeek_conn_action_ratio_trend, not this "
        "data-model variant.",
    ),
    (
        "network_intelligence_zeek_conn_blocked_ratio_trend_dm", "R5",
        "index_zeek",
        "Same bullet, describing the raw-event twin.",
    ),

    # -- monospaced tokens that are values, not fields ----------------------
    (
        "monitoring_sdwan_site_state_summary", "R11", "no_data",
        "A value of site_health, listed beside good/fair/poor.",
    ),
    (
        "security_etd_recent_admin_activity", "R11", "getDownloadLinks",
        "An action value, cited as the kind of polling this search hides.",
    ),
    (
        "network_intelligence_zeek_weird_anomaly_hotspots", "R11",
        "data_before_established",
        "A Zeek weird-event name, i.e. a value of the name field.",
    ),
    (
        "network_intelligence_zeek_weird_anomaly_hotspots", "R11",
        "SYN_seq_jump",
        "A Zeek weird-event name, i.e. a value of the name field.",
    ),
    (
        "secure_networking_ise_policy_hits_by_device", "R11", "SiteLdnSw01",
        "An example device name illustrating a naming convention.",
    ),
    (
        "secure_networking_ise_policy_hits_by_device", "R11",
        "Building_SJCM1_Wireless",
        "An example policy-set name illustrating a naming convention.",
    ),
    (
        "catalyst_center_interface_rx_tx_rate_trend", "R11", "InterfaceName",
        "Advice to add a filter on this field. It is real and used by "
        "sibling stanzas on the same sourcetype; this search just does not "
        "filter on it.",
    ),
    (
        "cybervision_assets_risk_distribution", "R11", "riskScore",
        "Lineage: the subject is the add-on, which derives the "
        "risk_score_severity field this search does read.",
    ),

    # -- 'confirmed'/'validated' used about something knowable -------------
    (
        "secure_networking_intersight_hcl_validation_status", "R8",
        "validated",
        "'Validated' is a literal value the Intersight HCL status field "
        "returns, beside Not-Listed and Not-Evaluated.",
    ),
    (
        "secure_networking_cloud_native_security_activity", "R8", "confirmed",
        "A hedge that disclaims verification ('valid before provider-specific "
        "normalization is confirmed') rather than asserting it.",
    ),
    (
        "dc_networking_change_tenant_threshold_current_tenant_threshold_statistics",
        "R8", "verified",
        "'verified-scalability limits' names Cisco's APIC Verified "
        "Scalability Guide, which the stanza's related_info treats as a "
        "document title.",
    ),
    (
        "secure_networking_meraki_rogue_containment_effectiveness", "R8",
        "confirmed",
        "'confirmed on-network rogues' describes what this search's own "
        "wired-MAC filter establishes: internal logic, not environment state.",
    ),
]


def is_allowed(stanza: str, rule: str, detail: str) -> bool:
    return any(
        stanza == s and rule == r and probe in detail
        for s, r, probe, _ in ALLOWED
    )
