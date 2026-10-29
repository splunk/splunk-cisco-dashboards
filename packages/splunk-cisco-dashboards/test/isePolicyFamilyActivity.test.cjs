"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const conf = fs.readFileSync(path.resolve(__dirname,
  "../src/main/resources/splunk/default/searchbase.conf"), "utf8");
const block = conf.match(/^\[secure_networking_zta_ise_policy_family_activity_trend\]\n([\s\S]*?)(?=^\[)/m)[1];
const spl = block.match(/^search = ([\s\S]*)/m)[1].trim().replace(/\\\n/g, "\n");

test("policy identity and counter duplicates are normalized before family/grouping/calculation", () => {
  const fields = spl.match(/\| foreach (.*?) \[/)[1].split(" ");
  assert.deepEqual(fields, ["id", "policySetId", "policy_set_id", "name", "policySetName",
    "policy_set_name", "host", "policy_protocol", "policy_record_type", "hitCounts"]);
  assert.match(spl, /<<FIELD>>=mvindex\(mvdedup\('<<FIELD>>'\),0\)/);
  assert.ok(spl.indexOf("| foreach") < spl.indexOf("| eval policy_family="));
  assert.ok(spl.indexOf("| foreach") < spl.indexOf("| eval policy_key="));
  assert.ok(spl.indexOf("| foreach") < spl.indexOf("hit_count=tonumber(hitCounts)"));
});

test("ambiguous or invalid policy observations cannot reset a valid counter baseline", () => {
  assert.match(spl, /_policy_scalar_conflict=_policy_scalar_conflict\+if\(coalesce\(mvcount\(mvdedup\('<<FIELD>>'\)\),0\)>1,1,0\)/);
  assert.ok(spl.indexOf("| where _policy_scalar_conflict=0") < spl.indexOf("| eval policy_key="));
  assert.match(spl, /\| where isnotnull\(hit_count\) AND hit_count>=0/);
  assert.ok(spl.indexOf("| where isnotnull(hit_count)") < spl.indexOf("| streamstats"));
  assert.doesNotMatch(spl, /tonumber\(coalesce\(hitCounts,0\)\)/);
});

test("policy families, host isolation, reset increments and workspace output remain compatible", () => {
  assert.match(spl, /coalesce\(host,"unknown"\)\."\|"\.policy_family/);
  assert.match(spl, /\| sort 0 policy_key _time/);
  assert.match(spl, /streamstats current=f last\(hit_count\) as previous_hit_count by policy_key/);
  assert.match(spl, /isnull\(previous_hit_count\),0,hit_count>=previous_hit_count,hit_count-previous_hit_count,hit_count<previous_hit_count,hit_count/);
  assert.match(spl, /timechart fixedrange=false cont=false bins=60 sum\(policy_hits\) by policy_family/);
  assert.match(spl, /eventstats sum\(BucketTotal\) as WindowTotal/);
  const viz = JSON.parse(block.match(/^viz_options = (.+)/m)[1]);
  assert.equal(viz.overview[0].valueField, "WindowTotal");
  assert.equal(viz.overview[0].sparkDataField, "RADIUS (Network Access)");
  assert.doesNotMatch(spl, /mvexpand|join\s|collect\s|outputlookup\s/);
});
