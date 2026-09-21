"""R8: prose asserting a verified state of the customer's environment.

A stanza that says "the confirmed accelerated field contract" or "zeek:dns is
a confirmed member of Network_Resolution.DNS" is describing something this app
cannot see. Whether a CIM model is accelerated, and which sourcetypes are
mapped into it, is decided by the add-ons the customer installed and the
acceleration they enabled. The same goes for "validated on live /opt/10 data":
that was true of one lab, and the reader is not in it.

The information around the qualifier is almost always worth keeping -- the
field really is the one the search groups by, the sourcetype really is the one
it filters on. So the fix is to drop the unearned word, not the sentence. Where
the claim is really a dependency the customer has to satisfy, it reads better
as a prerequisite ("requires zeek:dns to be mapped into Network_Resolution.DNS")
than as a finding, because that is the form a reader can act on.

Four R8 findings are deliberately absent. "Validated" in the Intersight stanza
is a value the HCL status field returns; "verified scalability" is Cisco's own
term for the APIC limits document; the Meraki stanza's "confirmed on-network
rogues" describes what its own wired-MAC filter establishes; and the cloud
native stanza's "before ... normalization is confirmed" is a hedge, not a
claim. None of them assert anything about the reader's deployment.
"""

from __future__ import annotations

CORRECTIONS = [
    (
        "secure_networking_ise_policy_hits_by_device",
        "explanation",
        "&mdash; validated on live <code>/opt/10</code> data, device names clearly encode "
        "site/location (e.g. <code>site-hyd04-a-wlc01</code>, <code>SiteLdnSw01</code>, "
        "<code>Building_SJCM1_Wireless</code> policy sets).",
        "&mdash; where a naming convention encodes site or location in device names "
        "(e.g. <code>site-hyd04-a-wlc01</code>, <code>SiteLdnSw01</code>) or policy-set "
        "names (e.g. <code>Building_SJCM1_Wireless</code>), that grouping reads as a "
        "per-site breakdown.",
        "cites a lab path as proof of a naming convention the customer may not use",
    ),
    (
        "secure_networking_casb_shadow_it_app_discovery_by_risk",
        "related_info",
        "Field names verified against <code>TA-cisco-cloud-security-addon</code> "
        "sourcetype <code>cisco:cloud_security:appdiscovery</code>.",
        "Field names come from <code>TA-cisco-cloud-security-addon</code>, so this "
        "search requires that add-on to be installed and producing the "
        "<code>cisco:cloud_security:appdiscovery</code> sourcetype.",
        "the add-on is a prerequisite the reader supplies, not a verified fact",
    ),
    (
        "agentic_soc_umbrella_blocked_requests",
        "related_info",
        "Policy action is not part of the confirmed accelerated field contract",
        "Policy action is not part of the accelerated field contract",
        "the absent field is the point; 'confirmed' claims a check we did not run",
    ),
    (
        "agentic_soc_firewall_security_intelligence",
        "solution",
        "that are not present in the confirmed accelerated contract",
        "that are not present in the accelerated contract",
        "the absent field is the point; 'confirmed' claims a check we did not run",
    ),
    (
        "agentic_soc_zeek_top_conversations",
        "related_info",
        "<b>Confirmed fields</b><br><code>All_Traffic.src</code>, <code>dest</code>, "
        "<code>app</code>, <code>transport</code>, and <code>bytes</code> are populated "
        "for the validated Zeek model.",
        "<b>Required fields</b><br>This search needs <code>All_Traffic.src</code>, "
        "<code>dest</code>, <code>app</code>, <code>transport</code>, and "
        "<code>bytes</code> populated for <code>zeek:conn</code> in "
        "<code>Network_Traffic.All_Traffic</code>; fields the add-on does not map come "
        "back blank.",
        "field population depends on the customer's add-on mapping, not on validation",
    ),
    (
        "agentic_soc_umbrella_top_domains",
        "explanation",
        "Groups the confirmed accelerated <code>DNS.reply_code</code> field.",
        "Groups the accelerated <code>DNS.reply_code</code> field.",
        "the field is still the subject; only the unearned qualifier goes",
    ),
    (
        "agentic_soc_firewall_top_applications",
        "explanation",
        "Groups the confirmed <code>All_Traffic.app</code> field from accelerated Zeek "
        "summaries.",
        "Groups the <code>All_Traffic.app</code> field from accelerated Zeek summaries.",
        "the field is still the subject; only the unearned qualifier goes",
    ),
    (
        "agentic_soc_firewall_top_destination_ports",
        "explanation",
        "groups the confirmed FTD members in <code>Network_Traffic.All_Traffic</code>",
        "groups the FTD sourcetypes mapped into <code>Network_Traffic.All_Traffic</code>",
        "membership of the model is a mapping the customer provides",
    ),
    (
        "agentic_soc_firewall_top_conversations",
        "description",
        "distributed across the confirmed sourcetypes",
        "distributed across the FTD sourcetypes that feed the model",
        "names the sourcetypes the SPL filters on instead of asserting a check",
    ),
    (
        "agentic_soc_zeek_dns_queries",
        "related_info",
        "<code>zeek:dns</code> is a confirmed member of "
        "<code>Network_Resolution.DNS</code>.",
        "This search requires <code>zeek:dns</code> to be mapped into "
        "<code>Network_Resolution.DNS</code>; without that mapping the accelerated "
        "summaries return nothing.",
        "model membership is a prerequisite the customer satisfies, not a finding",
    ),
]
