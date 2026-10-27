#!/usr/bin/env python3
"""Author the networking investigation surfaces; no runtime or Splunk access."""

import argparse
from copy import deepcopy
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, quote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / 'packages/splunk-cisco-dashboards/src/main/resources/splunk'
VIEWS = RESOURCES / 'default/data/ui/views'
VIEW = 'sn_network_service_investigations'

# Preserve the original targets and overview sources. Added targets are separate
# investigations, not a merged population or an explanation of the card value.
CARD_TARGETS = {
    'sn_zta_posture': {
        '02': ['mv_authentication_application_outcomes', 'mv_authentication_method_visibility', 'identity_cim_password_spray_candidates'],
        '03': ['mv_zscaler_zpa_server_setup', 'mv_zscaler_zpa_public_ip_changes', 'mv_zscaler_zpa_private_ip_visibility', 'mv_zscaler_zpa_encryption_labels'],
        '04': ['mv_pan_globalprotect_failures', 'mv_fortinet_vpn_transitions', 'mv_checkpoint_vpn_failure_evidence', 'mv_f5_apm_access_denials'],
        '05': ['identity_duo_denials_before_success', 'identity_duo_push_denial_bursts', 'mv_authentication_source_changes'],
    },
    'sn_zta_authentication_policy_enforcement': {
        '01': ['mv_authentication_application_outcomes', 'mv_authentication_method_visibility', 'mv_aruba_authentication_failures'],
        '05': ['identity_duo_denials_before_success', 'identity_duo_push_denial_bursts', 'mv_authentication_source_changes'],
    },
    'sn_hmf_threat_detection_enforcement': {
        '01': ['security_firewall_nat_resource_failure_evidence', 'network_firewall_nat_tuple_concentration', 'security_firewall_low_activity_observed_rules', 'mv_pan_denied_zone_boundaries', 'mv_fortinet_policy_denials', 'mv_junos_srx_denials', 'mv_checkpoint_denied_services', 'mv_checkpoint_rule_action_inventory', 'mv_checkpoint_nat_observed_addresses', 'mv_ipv6_decision_visibility', 'network_cross_vendor_decision_field_coverage'],
        '05': ['mv_pan_threat_enforcement', 'mv_fortinet_ips_actions', 'mv_checkpoint_ips_signature_evidence', 'mv_f5_waf_blocked_violations', 'mv_intrusion_alert_actions'],
    },
    'sn_hmf_sdwan_network_health': {
        '01': ['network_catalyst_issues_after_device_audit', 'mv_aruba_client_snr'],
        '04': ['mv_fortinet_sdwan_probe_quality', 'mv_f5_pool_member_health_messages', 'mv_f5_tls_handshake_failures'],
        '05': ['network_ios_link_events_after_config', 'mv_interface_error_counter_rates', 'mv_arista_interface_error_rates', 'mv_arista_interface_discard_rates', 'mv_arista_interface_transfer_rates', 'mv_arista_latest_interface_state', 'mv_arista_lanz_queue_observations'],
        '06': ['network_ios_routing_events_after_config', 'mv_junos_bgp_state_messages', 'mv_junos_commit_audit', 'mv_arista_bgp_adjacency_messages', 'mv_fortinet_configuration_audit', 'mv_change_failure_records'],
    },
}

# Action-only sections add no data sources and therefore no automatic jobs.
SECTIONS = {
    'sn_data_center_operations': ('SAN and fabric investigations', [
        ('SAN congestion evidence', 'Observed MDS transmit wait and recurring congestion. Missing CPU or memory measurements stay unavailable.', ['network_dc_mds_transmit_wait_trend', 'network_dc_mds_repeated_congestion', 'network_dc_mds_switch_resource_trend']),
        ('Hyperfabric port evidence', 'Observed port rates, directional imbalance and measurement coverage. These are not link-capacity or headroom estimates.', ['network_dc_hyperfabric_port_rate_trend', 'network_dc_hyperfabric_directional_imbalance', 'network_dc_hyperfabric_measurement_coverage']),
    ]),
    'sn_secure_infrastructure_posture': ('Certificate investigations', [
        ('Certificate lifecycle', 'Inspect observed Zeek certificate expiry bands and individual validity dates. Observed certificates are not a complete estate inventory.', ['security_zeek_certificate_expiry_summary', 'security_zeek_certificate_expiry_inventory']),
        ('Certificate rotation candidates', 'Compare fingerprints observed for the same subject. Multiple certificates can be legitimate and do not establish a failed rotation.', ['security_zeek_certificate_rotation_candidates']),
    ]),
    'sn_agentic_ops_operational_intelligence': ('Telemetry investigations', [
        ('Ingestion delay and feed observations', 'Compare reporting delay and occupied time buckets for observed sources. Missing sources do not prove a collection outage.', ['operations_cisco_ingestion_delay_by_source', 'operations_cisco_feed_bucket_coverage']),
        ('ISE scalar-field quality', 'Inspect repeated and conflicting policy fields before interpreting policy activity. Requires the policy snapshot feeds.', ['operations_ise_multivalue_field_quality']),
    ]),
}

PANELS = [
    ('Application transfer observations', 'Reported bytes by device and application; overlapping feeds can repeat session totals.', 'mv_traffic_application_bytes', ['mv_traffic_application_port_inventory', 'mv_traffic_destination_fanout', 'mv_traffic_port_fanout', 'mv_traffic_long_duration', 'mv_pan_application_transfer', 'mv_pan_session_end_reasons', 'mv_zscaler_zia_transfer_sizes']),
    ('Explicit policy decisions', 'Allowed, denied and unknown record shares by device; these are not unique session failure rates.', 'mv_traffic_decision_rates', ['mv_pan_denied_zone_boundaries', 'mv_fortinet_policy_denials', 'mv_junos_srx_denials', 'mv_checkpoint_denied_services', 'mv_checkpoint_rule_action_inventory']),
    ('DNS failure observations', 'Explicit NXDOMAIN responses by client. Query-only feeds cannot establish response outcomes.', 'mv_dns_nxdomain_clients', ['mv_dns_servfail_resolvers', 'mv_dns_unusual_query_types', 'mv_infoblox_nxdomain_clients', 'mv_infoblox_servfail_resolvers', 'mv_infoblox_query_name_diversity', 'mv_infoblox_txt_null_queries', 'mv_infoblox_threat_actions', 'mv_infoblox_dhcp_nak_messages']),
    ('DNS response time', 'Reported CIM response times in seconds by resolver; missing measurements are excluded.', 'mv_dns_response_latency', ['mv_dns_servfail_resolvers', 'mv_dns_nxdomain_clients']),
    ('HTTP server-error observations', 'Reported 5xx responses by destination. Proxy responses can differ from origin application failures.', 'mv_web_server_errors', ['mv_web_cleartext_destinations', 'mv_f5_http_response_errors', 'mv_zscaler_zia_http_errors', 'mv_f5_tls_handshake_failures', 'mv_f5_pool_member_health_messages']),
    ('Remote administration observations', 'Allowed records on selected ports; port numbers alone do not establish application identity or unauthorized access.', 'mv_traffic_remote_administration', ['mv_traffic_application_port_inventory', 'mv_traffic_destination_fanout', 'mv_traffic_port_fanout']),
]


def read_view(name):
    text = (VIEWS / f'{name}.xml').read_text()
    match = re.search(r'<!\[CDATA\[([\s\S]*?)\]\]>', text)
    return text, match, json.loads(match[1])


def url(origin, targets, path='/drilldown'):
    return f'{path}?origin={quote(origin, safe="")}&target=' + ','.join(quote(t, safe='') for t in targets)


def action(origin, targets, info=False):
    return {
        'type': 'splunk.cisco_drilldown_action',
        'options': {'label': f'{"About" if info else "Investigate"} {origin}', **({'action': 'metric-info'} if info else {})},
        'eventHandlers': [{'type': 'drilldown.customUrl', 'options': {'url': url(origin, targets, '/metric-info' if info else '/drilldown')}}],
    }


def markdown(template, text, size=18):
    result = deepcopy(template)
    result['options'].update(markdown=text, fontSize='custom', customFontSize=size)
    return result


def block(item, x, y, w, h, kind='block'):
    return {'item': item, 'position': {'x': x, 'y': y, 'w': w, 'h': h}, 'type': kind}


def add_section(definition, label, cards):
    visualizations = definition['visualizations']
    base = next(iter(definition['layout']['layoutDefinitions'].values()))
    layout = {'type': 'absolute', 'options': deepcopy(base['options']), 'structure': []}
    layout['options'].update(width=1920, height=1024)
    template = visualizations['viz_header']
    title_id = 'viz_library_header'
    visualizations[title_id] = markdown(template, '# ' + label + '\nOpen an investigation to run it for the selected time range. Related feeds are separate evidence, not components of the overview metric.', 20)
    layout['structure'] = [block('viz_header_bg', 20, 0, 1880, 110), block(title_id, 44, 10, 1400, 96), block('input_time_range', 1514, 8, 370, 80, 'input')]
    background = deepcopy(visualizations.get('viz_card_01_background', visualizations['viz_header_bg']))
    for i, (title, text, targets) in enumerate(cards):
        prefix = f'viz_library_{i+1}'
        x, y = 20, 140 + i*310
        visualizations[prefix+'_background'] = deepcopy(background)
        visualizations[prefix+'_text'] = markdown(template, f'## {title}\n{text}\n\nUse the investigation button to open the available searches.', 20)
        visualizations[prefix+'_action'] = action(title, targets)
        layout['structure'] += [block(prefix+'_background', x, y, 1880, 270), block(prefix+'_text', x+24, y+20, 1730, 230), block(prefix+'_action', 1796, y+24, 64, 64)]
    definition['layout']['layoutDefinitions']['layout_catalogue_investigations'] = layout
    tabs = definition['layout']['tabs']['items']
    if not any(t['layoutId']=='layout_catalogue_investigations' for t in tabs):
        tabs.append({'label': label, 'layoutId': 'layout_catalogue_investigations'})


def new_dashboard(template):
    d = {k: deepcopy(v) for k, v in template.items() if k not in ['visualizations', 'dataSources', 'layout']}
    d.update(title='Network Service Investigations', description='Investigate applications, policy decisions, DNS and web observations across compatible networking sources.')
    d['visualizations'] = {k: deepcopy(v) for k,v in template['visualizations'].items() if k in ['viz_header_bg', 'viz_header', 'viz_header_icon']}
    v = d['visualizations']
    v['viz_header']['options']['markdown'] = '# Network Service Investigations\nApplications, policy decisions, DNS and web evidence across compatible sources.'
    v['viz_header_icon']['title'] = d['title']
    v['viz_header_icon']['options']['src'] = '/static/app/splunk-cisco-dashboards/images/nav-icons/ServerBrackets.svg'
    title_template = template['visualizations']['viz_card_01_title']
    description_template = template['visualizations']['viz_card_01_description']
    v['viz_scope'] = markdown(description_template, 'Counts describe observed records, not unique sessions or confirmed incidents. Empty panels can reflect missing feeds, fields or matching activity. Related investigations retain this time range and run one at a time.', 16)
    layout = {'type': 'absolute', 'options': deepcopy(template['layout']['layoutDefinitions']['layout_overview']['options']), 'structure': []}
    layout['options'].update(width=1440, height=1550, showTitleAndDescription=False)
    layout['structure'] = [block('viz_header_bg', 16, 0, 1408, 102), block('viz_header_icon', 28, 20, 56, 56), block('viz_header', 96, 8, 960, 86), block('input_time_range', 1080, 8, 330, 80, 'input'), block('viz_scope', 24, 112, 1392, 64)]
    d['dataSources'] = {}
    for i, (title, description, ref, targets) in enumerate(PANELS):
        prefix = f'viz_evidence_{i+1}'
        source = f'ds_evidence_{i+1}'
        x, y = 16 + (i%2)*712, 188 + (i//2)*404
        v[prefix+'_background'] = deepcopy(template['visualizations']['viz_card_01_background'])
        v[prefix+'_title'] = markdown(title_template, '### '+title, 20)
        v[prefix+'_description'] = markdown(description_template, description, 16)
        v[prefix+'_table'] = {'type':'splunk.table', 'title': '', 'showProgressBar': True, 'showLastUpdated': True, 'options': {'backgroundColor': template['visualizations']['viz_card_01_background']['options']['fillColor'], 'count':5, 'showRowNumbers':False, 'showInternalFields':False, 'fontSize':'large', 'tableFormat':{'textOverflow':'ellipsis'}}, 'dataSources': {'primary':source}}
        v[prefix+'_action'] = action(title, [ref]+targets)
        v[prefix+'_info'] = action(title, [ref], info=True)
        layout['structure'] += [block(prefix+'_background', x,y,696,388), block(prefix+'_title', x+16,y+12,548,36), block(prefix+'_description',x+16,y+52,664,64),block(prefix+'_table',x+16,y+124,664,248), block(prefix+'_info',x+592,y+8,42,42),block(prefix+'_action',x+636,y+8,42,42)]
        d['dataSources'][source] = {'type':'ds.searchbase', 'name':title, 'options':{'ref':ref, 'queryParameters':{'earliest':'$time_tok.earliest$','latest':'$time_tok.latest$','span':'$time_tok.span$'}}}
    v['viz_interface_text'] = markdown(title_template, '### IPv6 and interface investigations\nOpen IP-family visibility, denied-destination and interface measurement evidence separately.', 18)
    v['viz_interface_action'] = action('IPv6 and interface evidence', ['network_cross_vendor_ip_family_mix', 'mv_ipv6_decision_visibility', 'network_cross_vendor_ipv6_denied_destinations', 'network_cross_vendor_decision_field_coverage', 'mv_interface_error_counter_rates', 'mv_arista_latest_interface_state', 'mv_arista_interface_error_rates', 'mv_arista_interface_discard_rates', 'mv_arista_interface_transfer_rates', 'mv_arista_bgp_adjacency_messages', 'mv_arista_lanz_queue_observations'])
    layout['structure'] += [block('viz_interface_text', 32, 1420, 1250, 114), block('viz_interface_action', 1340, 1440, 56, 56)]
    d['layout'] = {'options':{'showTitleAndDescription':False}, 'globalInputs':[], 'layoutDefinitions':{'layout_overview':layout}, 'tabs':{'items':[{'label':'Service investigations','layoutId':'layout_overview'}]}}
    return d


def serialize(definition):
    # Retain the existing Studio resources' decimal spelling for tiny thresholds.
    return json.dumps(definition, indent=4, ensure_ascii=False).replace(': -1e-06', ': -0.000001').replace(': 1e-06', ': 0.000001')


def render(text, match, definition):
    return text[:match.start(1)] + '\n' + serialize(definition) + '\n    ' + text[match.end(1):]


def outputs():
    result = {}
    for view in sorted(CARD_TARGETS.keys() | SECTIONS.keys()):
        text, match, definition = read_view(view)
        for card, additions in CARD_TARGETS.get(view, {}).items():
            trigger = definition['visualizations'][f'viz_card_{card}_drilldown_trigger']
            options = trigger['eventHandlers'][0]['options']
            parsed = parse_qs(urlsplit(options['url']).query)
            original = parsed['target'][0].split(',')
            targets = list(dict.fromkeys(original + additions))
            if len(targets)>24:
                raise ValueError(f'{view}:{card}: target limit exceeded')
            options['url'] = url(parsed.get('origin',['Investigate drivers'])[0], targets)
        if view in SECTIONS:
            add_section(definition, *SECTIONS[view])
        result[VIEWS / f'{view}.xml'] = render(text, match, definition)
    # The React preview shares the Zero Trust story and must offer the same
    # investigations; its existing source bindings and card semantics stay intact.
    preview_path = ROOT / 'packages/splunk-cisco-dashboards/src/main/webapp/pages/secure_networking_pillars/config.ts'
    preview = preview_path.read_text()
    for card, preview_id in [('02', 'authentication-friction'), ('03', 'private-access-status'), ('04', 'remote-access-health'), ('05', 'risky-mfa-outcomes')]:
        pattern = re.compile(r"(id: '" + preview_id + r"'[\s\S]*?drilldownIds: )\[([^\]]*)\]")
        match = pattern.search(preview)
        if not match:
            raise ValueError(f'Missing React preview card {preview_id}')
        current = re.findall(r"'([^']+)'", match[2])
        targets = list(dict.fromkeys(current + CARD_TARGETS['sn_zta_posture'][card]))
        replacement = match[1] + '[\n' + ''.join(f"            '{target}',\n" for target in targets) + '        ]'
        preview = preview[:match.start()] + replacement + preview[match.end():]
    result[preview_path] = preview
    _, _, template = read_view('sn_zta_posture')
    definition = new_dashboard(template)
    result[VIEWS / f'{VIEW}.xml'] = '<dashboard version="2" theme="dark" stylesheet="application.css" isVisible="false">\n    <label>Secure Infrastructure - Network Service Investigations</label>\n    <description>' + definition['description'] + '</description>\n    <definition><![CDATA[\n' + serialize(definition) + '\n    ]]></definition>\n</dashboard>\n'
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--write', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    changed = []
    for path, content in outputs().items():
        if not path.exists() or path.read_text()!=content:
            changed.append(str(path.relative_to(ROOT)))
            if args.write:
                path.write_text(content)
    print(json.dumps({'changed':changed,'written':args.write}))
    if args.check and changed:
        raise SystemExit(1)


if __name__=='__main__':
    main()
