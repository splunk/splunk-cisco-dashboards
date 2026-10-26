#!/usr/bin/env node
"use strict";

// Generates read-only SPL for manual execution in Splunk Search. No requests,
// credentials, saved searches, or indexed data are created by this helper.
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const casesPath = path.join(root,"packages/splunk-cisco-dashboards/test/fixtures/searchLibraryBatch1Cases.json");
const confPath = path.join(root,"packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf");
const expression = value => value === null ? "null()"
  : Array.isArray(value) ? `mvappend(${value.map(item=>`tostring(${expression(item)})`).join(",")})`
  : typeof value === "object" ? value.expr : JSON.stringify(value);
const source = fixture => {
  const fields = [...new Set(fixture.rows.flatMap(row=>Object.keys(row)))];
  // SPL eval assignment names are unquoted; quoted targets create literal quote
  // characters in the field name. Dotted vendor names are valid targets.
  return `| makeresults count=${fixture.rows.length}\n| streamstats count as n\n| eval `
    + fields.map(field=>`${field}=case(${fixture.rows.map((row,index)=>`n=${index+1},${expression(row[field]??null)}`).join(",")})`).join(", ");
};
function generateFixtures(conf, cases) {
  const blocks=new Map([...conf.matchAll(/^\[([^\]]+)\]\n([\s\S]*?)(?=^\[|(?![\s\S]))/gm)].map(match=>[match[1],match[2]]));
  return cases.flatMap(fixture=>{
    const block=blocks.get(fixture.id);
    if(!block)throw new Error(`Missing stanza: ${fixture.id}`);
    const spl=block.match(/^search = ([\s\S]*)/m)[1].trim().replace(/\\\n/g,"\n");
    const transformation=spl.split("\n").slice(1).join("\n");
    const earliest=fixture.picker?"-1h@h":"-24h@h", latest=fixture.picker?"@h":"now";
    return [{id:fixture.id,kind:"populated",earliest,latest,
      query:source(fixture)+"\n"+transformation+"\n"+(fixture.post??"")+`\n| eval CaseId="${fixture.id}", TestPassed=if(${fixture.assertion},1,0) | table CaseId TestPassed *`},
    {id:fixture.id,kind:"empty",earliest:"-24h@h",latest:"now",
      query:"| makeresults | where 1=0\n"+transformation+`\n| stats count as Rows count(eval(isnotnull(message))) as MessageRows | eval CaseId="${fixture.id}-empty", TestPassed=if(Rows=1 AND MessageRows=1,1,0) | table CaseId TestPassed Rows MessageRows`}];
  });
}
module.exports={generateFixtures,source,expression};
if(require.main===module)process.stdout.write(JSON.stringify(generateFixtures(fs.readFileSync(confPath,"utf8"),JSON.parse(fs.readFileSync(casesPath,"utf8"))),null,2)+"\n");
