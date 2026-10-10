'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../src/main/resources/splunk');
const conf = fs.readFileSync(path.join(root, 'default/searchbase.conf'), 'utf8');
const all = [...conf.matchAll(/^\[([^\]]+)\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/gm)];
const blocks = new Map(all.map(m => [m[1], m[2]]));
const ids = ['coverage', 'zpa_application_access', 'zpa_policy_activity', 'zpa_unreachable_applications', 'zpa_connection_status_trend', 'zia_policy_outcomes', 'zia_blocked_web_reasons', 'zia_web_threats'];
const body = id => blocks.get('secure_networking_zscaler_' + id);
const spl = id => body(id).split(/^search = /m)[1].trim().replace(/\\\n/g, '\n');
test('Setup discovers Zscaler outside existing scopes and routes it to security', () => {
  const setup = blocks.get('admin_macro_index_tuning');
  const query = setup.split(/^search = /m)[1].replace(/\\\n/g, '\n');
  const preamble = query.split('\n')[0];
  assert.match(preamble, /\)\) OR sourcetype="pan:\*" OR sourcetype="zscaler\*" by index, sourcetype$/);
  assert.doesNotMatch(query, /zscaler_demo/, 'Discovery must work with customer index names');
  const routing = query.split('\n').find(line => line.startsWith('| eval scd_macro=case('));
  const rules = [...routing.matchAll(/match\(sourcetype,"([^"]+)"\), "([^"]+)"/g)];
  const classify = sourcetype => rules.find(([, pattern]) => {
    const insensitive = pattern.startsWith('(?i)');
    return new RegExp(pattern.replace(/^\(\?i\)/, ''), insensitive ? 'i' : '').test(sourcetype);
  })?.[2] || 'unknown';
  for (const feed of ['zscalerlss-zpa-app', 'zscalerlss-zpa-auth', 'zscalernss-web', 'zscalernss-fw', 'zscalernss-dns', 'zscalerapi-zia-audit', 'zscaler:zpa:syslog', 'zscalernss-workload-fw']) {
    assert.equal(classify(feed), 'index_security', feed);
  }
  assert.equal(classify('ZSCALERNSS-WEB'), 'index_security');
  assert.equal(classify('cisco:ise:syslog'), 'index_identity');
  assert.equal(classify('pan:traffic'), 'index_firewall');
  assert.equal(classify('unrelated:feed'), 'unknown');
});
test('Zscaler entries resolve in the app with configurable scope and bounded output', () => {
  for (const id of ids) {
    const key = 'secure_networking_zscaler_' + id;
    assert.equal(all.filter(m => m[1] === key).length, 1, key);
    assert.match(body(id), /^category = Security$/m);
    assert.match(body(id), /^sub_category = Zero Trust Access$/m);
    assert.match(body(id), /^dispatch_context = splunk-cisco-dashboards$/m);
    assert.match(spl(id), /`index_security`/);
    assert.doesNotMatch(spl(id), /index=|earliest=|latest=|\| join |\| head /);
    assert.match(spl(id), /\| sort 1000 |bins=60/);
    for (const field of ['description', 'explanation', 'solution', 'related_info']) assert.match(body(id), new RegExp('^' + field + ' = .+', 'm'));
    JSON.parse(body(id).match(/^viz_options = (.+)/m)[1]);
  }
  for (const target of body('zpa_connection_status_trend').match(/^drilldown_stanza_ids = (.+)/m)[1].split(',')) assert.ok(blocks.has(target), target);
});
test('ZPA counts IDs separately from records and failure selection uses an explicit reason', () => {
  for (const id of ['zpa_application_access', 'zpa_policy_activity', 'zpa_unreachable_applications']) {
    assert.match(spl(id), /connection_key=if\(isnotnull\(ConnectionID\).*tenant\."\|"\.ConnectionID,null\(\)\)/);
    assert.match(spl(id), /count as Records dc\(connection_key\) as Connections/);
  }
  assert.match(spl('zpa_unreachable_applications'), /where upper\(trim\(reason\)\)="APP_NOT_REACHABLE"/);
  assert.doesNotMatch(spl('zpa_unreachable_applications'), /where .*status/);
  assert.match(body('zpa_connection_status_trend'), /not concurrent sessions or unique connections/);
});
test('ZIA unknown actions and placeholder threats are not treated as successful enforcement', () => {
  assert.match(spl('zia_policy_outcomes'), /1=1,"Other"/);
  assert.match(spl('zia_policy_outcomes'), /sum\(other_record\) as Other/);
  assert.match(spl('zia_policy_outcomes'), /100\*Blocked\/Records/);
  assert.match(spl('zia_blocked_web_reasons'), /where outcome="Blocked"/);
  assert.match(spl('zia_blocked_web_reasons'), /coalesce\(reason,"Unknown"\)/);
  assert.match(spl('zia_web_threats'), /len\(threat\)>0 AND NOT lower\(threat\) IN \("none","unknown","n\/a","-"\)/);
  assert.doesNotMatch(spl('zia_web_threats'), /where outcome="Blocked"/);
  assert.match(spl('coverage'), /^\| tstats /);
});
