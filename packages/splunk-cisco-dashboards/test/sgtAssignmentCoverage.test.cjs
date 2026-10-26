"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const conf = fs.readFileSync(path.resolve(__dirname,
  "../src/main/resources/splunk/default/searchbase.conf"), "utf8");
const ids = ["secure_networking_sgt_assignment_coverage_trend",
  "secure_networking_sgt_assignment_coverage_by_site_device"];
const blocks = ids.map(id => {
  const matches = [...conf.matchAll(new RegExp(`^\\[${id}\\]\\n([\\s\\S]*?)(?=^\\[|(?![\\s\\S]))`, "gm"))];
  assert.equal(matches.length, 1, `${id} must be unique`);
  return matches[0][1];
});
const queries = blocks.map(block => block.match(/^search = ([\s\S]*)/m)[1].trim().replace(/\\\n/g, "\n"));

test("SGT trend and detail share classification and link without replacing default tiles", () => {
  assert.equal(queries[0].split("\n").slice(0, 5).join("\n"), queries[1].split("\n").slice(0, 5).join("\n"));
  assert.match(queries[0], /^`index_identity` sourcetype="cisco:ise:syslog" log_type="Passed_Authentications"/);
  assert.match(blocks[0], new RegExp(`^drilldown_stanza_id = ${ids[1]}$`, "m"));
  const trendViz = JSON.parse(blocks[0].match(/^viz_options = (.+)/m)[1]);
  assert.equal(trendViz.overview[0].valueField, "WindowCoveragePct");
  assert.equal(trendViz.overview[0].sparkDataField, "CoveragePct");
  assert.equal(JSON.parse(blocks[1].match(/^viz_options = (.+)/m)[1]).showRowNumbers, true);
  const workspace = fs.readFileSync(path.resolve(__dirname,
    "../src/main/resources/splunk/default/insights_workspaces.conf"), "utf8");
  for (const id of ids) assert.ok(!workspace.includes(id), "creation must not change the shipped layout");
});

test("duplicate tags collapse after trimming while conflicting and default tags stay in denominator", () => {
  for (const spl of queries) {
    assert.match(spl, /mvdedup\(mvmap\(security_group_tag,trim\(security_group_tag\)\)\)/);
    assert.match(spl, /ambiguous=if\(coalesce\(mvcount\(tag_values\),0\)>1,1,0\)/);
    assert.match(spl, /tagged=if\(ambiguous=0 AND tag!="" AND NOT match/);
    assert.match(spl, /unknown\|default/);
    assert.match(spl, /untagged=if\(tagged=0 AND ambiguous=0,1,0\)/);
    assert.doesNotMatch(spl, /\|\s*(mvexpand|join|collect|outputlookup)\b/);
  }
});

test("coverage headline is event weighted and empty input does not fabricate zero percent", () => {
  assert.match(queries[0], /bins=60 count as SuccessfulAuthEvents/);
  assert.match(queries[0], /eventstats sum\(SuccessfulAuthEvents\) as WindowSuccessfulAuthEvents/);
  assert.match(queries[0], /WindowCoveragePct=if\(WindowSuccessfulAuthEvents>0,round\(WindowTaggedAuthEvents\/WindowSuccessfulAuthEvents\*100,2\),null\(\)\)/);
  assert.doesNotMatch(queries[0], /avg\(CoveragePct\)/);
  assert.match(queries[0], /CoveragePct=null\(\), WindowCoveragePct=null\(\)/);
  for (const spl of queries) assert.match(spl, /where _empty=0.*No successful ISE authentication events/);
});

test("detail retains unknown context and reports bounded output truncation before limiting", () => {
  const spl = queries[1];
  for (const value of ["Ambiguous location", "Unattributed", "Ambiguous device", "Not reported", "Ambiguous ISE host"]) {
    assert.ok(spl.includes(`"${value}"`));
  }
  assert.match(spl, /stats count as SuccessfulAuthEvents.*by site network_device ise_host/);
  assert.ok(spl.indexOf("eventstats count as TotalGroups") < spl.indexOf("| sort 1000"));
  assert.ok(spl.indexOf("DetailRowsTruncated=if(TotalGroups>1000,1,0)") < spl.indexOf("| sort 1000"));
  assert.match(spl, /table Site.*TotalGroups DetailRowsTruncated/);
});
