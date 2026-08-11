const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const searchbase = fs.readFileSync(
  path.join(packageRoot, 'src/main/resources/splunk/default/searchbase.conf'),
  'utf8',
);
const macros = fs.readFileSync(
  path.join(packageRoot, 'src/main/resources/splunk/default/macros.conf'),
  'utf8',
);
const macroTuningSource = fs.readFileSync(
  path.join(packageRoot, 'src/main/webapp/pages/macro_index_tuning/index.tsx'),
  'utf8',
);

const expectedPairs = new Map([
  [
    'secure_networking_webex_login_outcome_trend',
    'secure_networking_webex_failed_logins',
  ],
  [
    'secure_networking_webex_admin_change_trend',
    'secure_networking_webex_admin_change_detail',
  ],
  [
    'secure_networking_webex_call_outcome_trend',
    'secure_networking_webex_failed_calls',
  ],
  [
    'secure_networking_webex_media_health_trend',
    'secure_networking_webex_media_quality_detail',
  ],
  [
    'secure_networking_webex_join_time_trend',
    'secure_networking_webex_join_time_outliers',
  ],
  [
    'secure_networking_webex_contact_center_service_level_trend',
    'secure_networking_webex_contact_center_queue_detail',
  ],
]);

const blocks = searchbase
  .split(/(?=^\[)/m)
  .filter((block) => block.startsWith('[secure_networking_webex_'));
const blockById = new Map(
  blocks.map((block) => [block.match(/^\[([^\]]+)\]/)?.[1], block]),
);
const expectedIds = new Set(
  [...expectedPairs].flatMap(([trendId, detailId]) => [trendId, detailId]),
);

assert.equal(blocks.length, 12, 'expected exactly twelve direct Webex searches');
assert.deepEqual(new Set(blockById.keys()), expectedIds);
assert.match(
  macros,
  /^\[index_webex\]\ndefinition = index IN \(\*\)\niseval = 0$/m,
  'expected a deployment-tunable index_webex macro',
);

const macroTuningBlock = searchbase
  .split(/(?=^\[)/m)
  .find((block) => block.startsWith('[admin_macro_index_tuning]'));
assert.ok(macroTuningBlock, 'expected the Setup macro-tuning search');
assert.match(
  macroTuningSource,
  /FALLBACK_SCD_INDEX_MACRO_NAMES\s*=\s*\[[\s\S]*?"index_webex"[\s\S]*?\]\s*as const/,
  'Setup must retain index_webex when the runtime macro catalogue is unavailable',
);
assert.match(
  macroTuningBlock,
  /sourcetype="cisco:webex:\*"/,
  'Setup fast discovery must scan direct Webex sourcetypes',
);
assert.match(
  macroTuningBlock,
  /match\(sourcetype,"\^cisco:webex:"\), "index_webex"/,
  'Setup fast discovery must map direct Webex events to index_webex',
);

for (const [id, block] of blockById) {
  assert.match(block, /^search = `index_webex` /m, `${id} must use index_webex`);
  assert.doesNotMatch(block, /index=app_msg/, `${id} must not hardcode the demo index`);
  assert.match(
    block,
    /sourcetype="cisco:webex:(?:security:audit:events|admin:audit:events|call:detailed_history|meeting:qualities|contact:center:CSR)"/,
    `${id} must use one of the validated direct Webex sourcetypes`,
  );
  assert.match(block, /^dispatch_context = splunk-cisco-dashboards$/m);
  assert.match(block, /^dispatch_context_force = 1$/m);
}

for (const [trendId, detailId] of expectedPairs) {
  const trend = blockById.get(trendId);
  const detail = blockById.get(detailId);
  assert.ok(trend, `missing trend stanza ${trendId}`);
  assert.ok(detail, `missing detail stanza ${detailId}`);
  assert.match(trend, new RegExp(`^drilldown_stanza_id = ${detailId}$`, 'm'));
  assert.match(trend, /"workspace":"secure_networking"/);
  assert.match(trend, /\bbins=60\b/, `${trendId} must keep trend output bounded`);
  assert.match(detail, /\| head (?:100|200)\b/, `${detailId} must cap table rows`);
}

assert.doesNotMatch(
  blockById.get('secure_networking_webex_media_health_trend'),
  /\| mvexpand\b/,
  'media classification must not multiply one event into per-sample rows',
);

console.log('12/12 direct Webex Searchbase definitions passed');
