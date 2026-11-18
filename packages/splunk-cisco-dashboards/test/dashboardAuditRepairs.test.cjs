const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const babel = require('@babel/core');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/main/webapp/common/lib/dashboardDrilldown.js'), 'utf8');
const compiled = babel.transformSync(source, {plugins: ['@babel/plugin-transform-modules-commonjs']}).code;
const record = {exports: {}};
vm.runInNewContext(`(function(module,exports){${compiled}\n})`)(record, record.exports);
const {buildDashboardDrilldownDefinition, buildWorkspaceDrilldownDefinition} = record.exports;
const conf = fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/searchbase.conf'), 'utf8');
const stanzas = Object.fromEntries([...conf.matchAll(/^\[([^\]]+)\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/gm)].map(m => [m[1], m[2]]));
for (const alias of ['unstacked', 'default']) {
    test(`existing catalogue ${alias} options work in both modal entry points without mutation`, () => {
        const options = {stackMode: alias, seriesColors: ['#38BDF8']};
        const workspace = buildWorkspaceDrilldownDefinition({defaultViz: 'splunk.column', vizOptions: options});
        const dashboard = buildDashboardDrilldownDefinition({name: 'metric', content: {default_viz: 'splunk.column', viz_options: JSON.stringify(options)}});
        for (const d of [workspace, dashboard]) assert.equal(d.visualizations.viz_drilldown_result.options.stackMode, 'auto');
        assert.equal(options.stackMode, alias);
    });
}
test('valid stacking and token expressions retain their meaning', () => {
    for (const stackMode of ['auto', 'stacked', 'stacked100', '$stack_mode$']) {
        const d = buildWorkspaceDrilldownDefinition({defaultViz: 'splunk.column', vizOptions: {stackMode}});
        assert.equal(d.visualizations.viz_drilldown_result.options.stackMode, stackMode);
    }
});
test('bundled chart options use supported stacking literals', () => {
    for (const [id, block] of Object.entries(stanzas)) {
        const raw = block.match(/^viz_options = (.+)$/m)?.[1];
        if (!raw) continue;
        const options = JSON.parse(raw);
        if (options.stackMode) assert.ok(['auto', 'stacked', 'stacked100'].includes(options.stackMode), id);
    }
});
test('Active alerts navigates to an existing alert detail search', () => {
    const block = stanzas.overview_active_critical_alerts;
    const id = block.match(/^drilldown_stanza_id = (.+)$/m)[1];
    assert.equal(id, 'it_health_te_alerts_recent_detail');
    assert.match(stanzas[id], /DATAMODEL=Cisco_ThousandEyes.Alerts/);
    assert.match(stanzas[id], /"Alert ID"/);
});
test('syslog investigation retains the overview source and preserves unknown severity', () => {
    const overview = stanzas.it_critical_systems_syslog_severity_distribution;
    const target = overview.match(/^drilldown_stanza_id = (.+)$/m)[1];
    assert.equal(target, 'it_critical_systems_syslog_event_detail');
    const detail = stanzas[target].split('search = ')[1];
    assert.match(detail, /`index_network` sourcetype="cisco:ios"/);
    // The modal intentionally hides internal fields other than _time. Expose the
    // original event as a display field so investigations retain their evidence.
    assert.match(detail, /rename _raw as Message/);
    assert.match(detail, /table _time host severity facility mnemonic Message TotalEvents RowsTruncated/);
    assert.match(detail, /sort 1000 - _time/);
    assert.equal(detail.match(/\| eval severity=(.+)/)[1], overview.match(/\| eval severity=(.+)/)[1]);
    assert.match(detail, /1==1,"Unknown"/);
    assert.match(stanzas.it_critical_systems_inventory_unreachable_detail, /drilldown_stanza_id = it_critical_systems_ds_base_devicehealth/);
});
test('DNS category investigations retain blocked DNS scope before the result cap', () => {
    const target = stanzas.secure_networking_sse_dns_blocked_categories.match(/^drilldown_stanza_id = (.+)$/m)[1];
    const detail = stanzas[target].split('search = ')[1];
    const headline = stanzas.secure_networking_sse_dns_blocked_categories.split('search = ')[1];
    assert.equal(detail.split('\\\n')[0], headline.split('\\\n')[0]);
    assert.match(detail, /^`index_security` sourcetype="cisco:cloud_security:dns" action="Blocked"/);
    assert.ok(detail.indexOf('action="Blocked"') < detail.indexOf('sort 500'));
    assert.match(detail, /table "Last Seen", Layer, Identity, Action, Destination, Category/);
    // Other callers still need the broader companion; narrow only the DNS binding.
    assert.match(stanzas.secure_networking_sse_security_event_detail, /sourcetype="cisco:cloud_security:firewall" OR/);
});
test('routing discovery finds both Infoblox DNS names outside the configured index scope', () => {
    const query = stanzas.admin_macro_index_tuning.split('search = ')[1];
    const metadataClause = query.split('\\\n')[0];
    assert.match(metadataClause, /OR sourcetype IN \("infoblox:dns","ib:dns"\) by index, sourcetype$/);
    assert.match(query, /match\(sourcetype,"\^\(infoblox\|ib\):dns\$"\), "index_network"/);
    const routing = query.split('\\\n').find(line => line.startsWith('| eval scd_macro='));
    const rules = [...routing.matchAll(/match\(sourcetype,"([^"]+)"\), "([^"]+)"/g)];
    const classify = type => rules.find(([, pattern]) => new RegExp(pattern.replace(/^\(\?i\)/, ''), pattern.startsWith('(?i)') ? 'i' : '').test(type))?.[2];
    for (const type of ['infoblox:dns', 'ib:dns']) assert.equal(classify(type), 'index_network');
    for (const type of ['infoblox:dhcp', 'infoblox:threatprotect', 'unrelated:infoblox:dns']) assert.notEqual(classify(type), 'index_network');
});
test('FMC policy investigations accept syslog policy names before excluding unavailable policies', () => {
    const query = stanzas.secure_networking_fmc_top_policies_by_action.split('search = ')[1];
    assert.doesNotMatch(query.split('\\\n')[0], /FirewallPolicy/);
    assert.match(query, /FirewallPolicy=coalesce\(FirewallPolicy,ACPolicy,fw_policy\)/);
    assert.ok(query.indexOf('FirewallPolicy=coalesce') < query.indexOf('where isnotnull(FirewallPolicy)'));
    assert.match(query, /coalesce\(AC_RuleAction,AccessControlRuleAction,"Unknown"\)/);
    const detail = stanzas.secure_networking_fmc_blocked_connection_detail.split('search = ')[1];
    assert.match(detail, /Policy=coalesce\(FirewallPolicy,ACPolicy,fw_policy,"Unknown"\)/);
    assert.match(detail, /Rule=coalesce\(FirewallRule,AccessControlRuleName,"Unknown"\)/);
    assert.ok(detail.indexOf('sort 500') < detail.indexOf('foreach FirewallPolicy'));
});
test('all Palo Alto SGT consumers normalize identical addresses and reject ambiguous assignment values before correlation', () => {
    const queries = Object.entries(stanzas).filter(([, block]) => block.includes('source_ip=coalesce(src,src_ip)') && block.includes('ise_sgt_candidate'));
    assert.equal(queries.length, 4);
    for (const [id, block] of queries) {
        const query = block.split('search = ')[1];
        assert.match(query, /foreach source_ip ise_sgt_candidate ise_sgt_name_candidate/, id);
        assert.match(query, /if\(mvcount\(mvdedup\('<<FIELD>>'\)\)=1,mvindex\(mvdedup\('<<FIELD>>'\),0\),null\(\)\)/, id);
        assert.ok(query.indexOf('foreach source_ip') < query.indexOf('| where is_pan=1'), id);
    }
});
test('remote-access health requires observed attempts and never fabricates a healthy denominator', () => {
    const query = stanzas.secure_networking_zta_ravpn_connection_attempts_trend.split('search = ')[1];
    assert.ok(query.indexOf('where outcome IN ("Connected","Failed")') < query.indexOf('| timechart'));
    assert.match(query, /WindowFailureRatePct=if\(WindowAttempts>0,round\(WindowFailures\/WindowAttempts\*100,1\),null\(\)\)/);
    assert.doesNotMatch(query, /appendpipe|WindowAttempts=0|WindowFailureRatePct=0/);
});
test('Catalyst site consumers collapse identical location values before string operations', () => {
    const xml = fs.readFileSync(path.join(root, 'src/main/resources/splunk/default/data/ui/views/netops_catalyst_operations.xml'), 'utf8');
    const definition = JSON.parse(xml.match(/<definition><!\[CDATA\[([\s\S]*?)\]\]><\/definition>/)[1]);
    const queries = [
        ...Object.values(stanzas).map(block => block.split('search = ')[1] || ''),
        ...Object.values(definition.dataSources).map(ds => ds.options?.query || ''),
    ].filter(query => query.includes('leafSiteId=mvindex(split(rtrim(siteHierarchyId'));
    assert.equal(queries.length, 9);
    for (const query of queries) {
        assert.match(query, /foreach siteHierarchy siteHierarchyId/);
        assert.match(query, /if\(mvcount\(mvdedup\('<<FIELD>>'\)\)=1,mvindex\(mvdedup\('<<FIELD>>'\),0\),null\(\)\)/);
        assert.ok(query.indexOf('foreach siteHierarchy') < query.indexOf('rtrim(siteHierarchyId'));
    }
});
test('wireless traffic totals normalize duplicate multivalue counters before arithmetic', () => {
    for (const id of ['client_summary_ds_client_traffic_by_band', 'client_summary_ds_top_ssids_by_traffic']) {
        const query = stanzas[id].split('search = ')[1];
        assert.match(query, /tonumber\(mvindex\(mvdedup\('traffic.txBytes'\),0\)\)/);
        assert.match(query, /tonumber\(mvindex\(mvdedup\('traffic.rxBytes'\),0\)\)/);
        assert.match(query, /isnotnull\(tx_bytes\) OR isnotnull\(rx_bytes\)/);
        assert.match(query, /stats sum\(total_bytes\) as traffic_bytes/);
    }
});
