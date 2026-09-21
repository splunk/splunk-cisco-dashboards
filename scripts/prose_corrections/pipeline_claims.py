"""R3/R4/R5/R6/R9: prose describing a pipeline the SPL does not run.

All of these stanzas were rewritten onto CIM or vendor data models at some
point and the prose stayed behind. The prose still reads well, which is the
problem: it names indexes, sourcetypes, and commands with enough confidence
that a reader will believe it and go looking for a scan that is not there.

Three flavours, treated differently.

SERIOUS -- the explanation narrates a different search end to end. Three
    stanzas qualify: the executive firewall counter still describes an
    `index_firewall` sweep over cisco:asa / cisco:ftd / cisco:sfw:estreamer
    with a hand-rolled OR over deny spellings, the failed-logon table still
    describes `index_windows` EventCode=4625 with a `head 10`, and the
    client-health trend still describes cisco:dnac:clienthealth on
    `index_catalyst` with a `bin _time`. Each is now a `tstats` search
    against Network_Traffic, Authentication, and Cisco_Catalyst_App
    respectively. The rewrite keeps the interpretation guidance that survives
    the change -- tuple grouping really does collapse repeated log lines,
    `latest()` per bucket really does absorb API refreshes -- because that
    guidance is what readers use.

    The ISE failure counter and the two Catalyst device-health stanzas are
    the same defect one notch smaller: the wrong source plus a grouping key
    or a zero-fill step that no longer exists. Those clauses go together
    because leaving a false `appendpipe` or `dc(DeviceID)` next to a
    corrected source line is worse than either alone -- it reads as though
    someone checked.

    Where sourcetype_claims.py already corrects the opening sentence of one
    of these explanations, the entry here starts after it and covers only the
    rest of the narrative. Splitting a paragraph between two modules is ugly,
    but it beats two modules fighting over the same substring: a replacement
    that swallowed a neighbour's FROM text would make the other module's
    correction silently stop applying.

MILD -- a related_info glossary bullet explaining an `index_thousandeyes`
    macro on a search that reads Cisco_ThousandEyes instead. The bullets say
    nothing untrue about the macro, but their presence on these stanzas
    implies the search expands it. Where the bullet carried no other fact it
    is deleted; where it also explained the sourcetype it is retargeted to
    the data model the search really reads.

SOUND -- seven findings needed no change and got none:
    network_intelligence_zeek_conn_blocked_ratio_trend_dm names
    `index_network` and `index_zeek` to describe its raw-event twin, not
    itself. secure_networking_intersight_advisory_exposure names `index_ucs`
    to say what its macro deliberately excludes.
    security_resilience_ds_xdr_detail "accelerates handoffs between tiers" is
    English, not acceleration. overview_link_te_a2a_inventory names
    acceleration to explain why it avoids it.
    executive_dashboard_firewall_blocked_count tells drill-downs to preserve
    raw events, which is advice about the drill-down.
    dc_networking_policy_policy_subtype_breakdown offers `timechart` as a
    next step. Naming a mechanism is not claiming it.

The one R4 finding that is real inverts the rule's own assumption:
executive_dashboard_threat_sources claims `scd_summariesonly` fails closed
and returns zero off summaries. macros.conf defines it as
summariesonly=false, so it does the opposite and falls back to raw.
"""

from __future__ import annotations

CORRECTIONS = [
    # -- SERIOUS: explanation narrates an entirely different search --------
    (
        "executive_dashboard_firewall_blocked_count",
        "explanation",
        "The pipeline then runs <code>stats count by src, dest, dest_port</code>, which <b>deduplicates repeated log lines</b> for the same flow, and finishes with <code>stats count as blocked</code> so the tile shows <b>unique blocked connection attempts</b>.",
        "The <code>tstats</code> pass groups by <code>All_Traffic.src</code>, <code>All_Traffic.dest</code>, and <code>All_Traffic.dest_port</code> and drops rows whose endpoints are empty, a dash, or a placeholder such as <code>unknown</code>, which <b>deduplicates repeated log lines</b> for the same flow. A closing <code>stats count as blocked</code> collapses those tuples so the tile shows <b>unique blocked connection attempts</b>, and an <code>appendpipe</code> substitutes a zero and a <code>data_status</code> note when nothing matched so the tile never renders blank.",
        "the grouping is a tstats BY clause, not a later stats, and the zero fill was unmentioned",
    ),
    (
        "security_resilience_failed_logon_users",
        "explanation",
        "<p>Directly queries <code>`index_windows`</code> for <code>XmlWinEventLog</code> with <code>EventCode=4625</code>, then <code>stats count by TargetUserName</code>. ranking and <code>head 10</code> surface the noisiest accounts; <code>rename</code> maps to <code>User</code> and <code>Failures</code>.</p>",
        "<p>Runs <code>tstats</code> with the <code>scd_summariesonly</code> macro against the <code>Authentication</code> data model, keeping rows where <code>Authentication.action=&quot;failure&quot;</code> and the contributing <code>sourcetype</code> matches <code>*WinEventLog</code>, and counts them by <code>Authentication.user</code>. A closing <code>rename</code> maps the model fields to <code>User</code> and <code>Failures</code>. No ranking or row cap is applied, so every account with a failure in the window is returned rather than only the noisiest few.</p>",
        "explanation described an index_windows EventCode=4625 search with head 10; the SPL is a CIM tstats search with no row cap",
    ),
    (
        "security_resilience_failed_logon_users",
        "related_info",
        "<li><b>index_windows macro</b><br>Centralizes which indexes hold domain controller security events.</li>",
        "<li><b>Windows scoping</b><br>The <code>sourcetype=&quot;*WinEventLog&quot;</code> constraint narrows the Authentication model to Windows security events instead of every authentication source in the estate.</li>",
        "glossed a macro the search never expands; retargeted to the filter it does use",
    ),
    (
        "user_experience_client_health_trend",
        "explanation",
        "<code>bin _time</code> aligns buckets, then the first <code>stats</code> takes <code>latest(clientCount) as cc by _time, clientType, scoreType</code> to deduplicate API refreshes. A second <code>stats sum(cc) as cc by _time, scoreType</code> merges access technologies so each timestamp shows total clients per health band.",
        "The <code>BY _time span=auto</code> clause aligns buckets to the selected range, and <code>latest(client_health_client_count) as cc</code> per bucket, client type, and score type deduplicates API refreshes. A <code>rename</code> shortens the model paths to <code>clientType</code> and <code>scoreType</code>, a following <code>stats sum(cc) as cc by _time, scoreType</code> merges access technologies so each timestamp shows total clients per health band, and <code>timechart</code> emits the <code>good</code>, <code>fair</code>, and <code>poor</code> series the stacked area renders.",
        "there is no bin and no clientCount field; bucketing and the first aggregation both happen inside the tstats BY clause",
    ),

    # -- same defect, smaller: wrong source plus a step that is gone -------
    (
        "security_resilience_ds_ise_fail_count",
        "explanation",
        "<p>Focused on syslog lines containing <code>5400</code> within <code>index_identity</code>, summarizing final ISE authentication failures into <code>score</code> (the count) for compact tiles.</p>",
        "<p>Runs <code>tstats</code> with the <code>scd_summariesonly</code> macro against the <code>Authentication</code> data model, scoped to <code>sourcetype=&quot;cisco:ise:syslog&quot;</code> with <code>Authentication.action=&quot;failure&quot;</code>, summarizing ISE authentication failures into <code>score</code> (the count) for compact tiles.</p>",
        "no index_identity scan and no 5400 filter; the verdict comes from the CIM action field",
    ),
    (
        "security_resilience_ds_ise_fail_count",
        "explanation",
        "<p><code>appendpipe</code> ensures zero when Splunk finds no failure lines, avoiding blank KPI widgets.</p><p>Reinforces message-code slicing for executive dashboards without regex complexity.</p><p><b>Pipeline:</b> 5400 events &rarr; stats count renamed score &rarr; zero fill.</p>",
        "<p>Leaning on the normalized <code>action</code> verdict rather than message-code matching keeps the tile working across ISE parser versions.</p><p><b>Pipeline:</b> <code>Authentication</code> rows where <code>action=&quot;failure&quot;</code> and <code>sourcetype=&quot;cisco:ise:syslog&quot;</code> &rarr; <code>count as score</code>.</p>",
        "the SPL has no appendpipe, no zero fill, and no message-code slicing",
    ),
    (
        "it_critical_systems_ds_ap_by_location",
        "explanation",
        "It deduplicates each AP with <code>stats latest(DeviceID) ... by DeviceName, Site</code>, drops blank sites, then counts distinct <code>DeviceID</code> per site via <code>dc</code>, labeling the column <code>APs</code>.",
        "Grouping by device IP address collapses repeated health polls into one row per AP carrying the latest device name and site; the search drops blank sites, counts those rows per site to label the column <code>APs</code>, and renames the grouping field to <code>Location</code>.",
        "the dedup key is the device IP address, not DeviceID by DeviceName, and the tally is a plain count rather than dc()",
    ),
    (
        "it_critical_systems_ds_base_devicehealth",
        "explanation",
        "No time bucketing: a single <code>stats</code> over <code>DeviceName</code> and <code>DeviceID</code> applies",
        "No time bucketing: a single grouping over the device IP address applies",
        "one row per device comes from grouping on the health event IP address, not on DeviceName and DeviceID",
    ),
    (
        "it_critical_systems_ds_site_health",
        "explanation",
        "Pulls cisco:dnac:devicehealth via index_catalyst and normalizes",
        "Reads Catalyst Center device health from the Cisco_Catalyst_App data model, taking the latest site and health score for each device IP address, and normalizes",
        "no index_catalyst scan; rows come from the Catalyst data model one per device IP",
    ),
    (
        "escu_alert_fw_compromised_host_indicators",
        "explanation",
        "spans <b>ASA and FTD</b> flows in <code>index_firewall</code>, normalizes <b>src</b> and <b>dest</b> via coalesce",
        "spans CIM-mapped firewall flows in the <code>Network_Traffic</code> data model, renames the <b>src</b> and <b>dest</b> model paths to bare fields",
        "no index_firewall scan and no coalesce; normalization happens in the CIM model, not the search",
    ),

    # -- MILD: stale index-macro glossary on a data-model search -----------
    (
        "teuc_5_9_1_network_latency_monitoring",
        "related_info",
        "<li><b>`index_thousandeyes` macro</b><br>Abstracts the Splunk index that holds ThousandEyes OpenTelemetry stream metrics for simpler maintenance.</li>",
        "",
        "the search reads the Cisco_ThousandEyes data model and never expands this macro",
    ),
    (
        "teuc_5_9_3_network_jitter_monitoring",
        "related_info",
        "<li><b>index_thousandeyes macro</b><br>Keeps index names portable across dev, staging, and production Splunk deployments.</li>",
        "",
        "the search reads the Cisco_ThousandEyes data model and never expands this macro",
    ),
    (
        "teuc_5_9_4_agent_to_agent_latency_and_throughput",
        "related_info",
        "<li><b>index_thousandeyes macro</b><br>Keeps Splunk index names portable as you move OTel data between dev and prod.</li>",
        "",
        "the search reads the Cisco_ThousandEyes data model and never expands this macro",
    ),
    (
        "teuc_5_9_52_trace_span_analysis",
        "related_info",
        "Traces route through <code>index_thousandeyes</code> in typical Splunk TA deployments.",
        "Traces route through <code>index_thousandeyes</code> in typical Splunk TA deployments; this search reads them through the <code>Cisco_ThousandEyes.Test_Traces</code> data model rather than scanning the index directly.",
        "the bullet implied an index scan; the search reads the trace data model",
    ),

    # -- R4: the macro does the opposite of what the bullet claims ---------
    (
        "executive_dashboard_threat_sources",
        "related_info",
        "<li><b>scd_summariesonly</b><br>Performance guard that fails closed (returns zero) on non-accelerated stores rather than scanning raw data.</li>",
        "<li><b>scd_summariesonly</b><br>Acceleration switch for the <code>tstats</code> pass. It ships as <code>summariesonly=false</code>, so a window the data model has not summarized still resolves from raw data instead of returning zero.</li>",
        "macros.conf defines scd_summariesonly as summariesonly=false, which falls back to raw rather than failing closed",
    ),

    # -- R9: cross-reference to a name the catalogue does not carry --------
    (
        "executive_dashboard_firewall_blocked_with_baseline",
        "description",
        "<i>Executive Dashboard - Firewall Blocked Connections</i>",
        "<i>Executive - Firewall Blocked Count</i>",
        "no catalogue entry carries the old name; the stanza's own related_info points at executive_dashboard_firewall_blocked_count",
    ),
]
