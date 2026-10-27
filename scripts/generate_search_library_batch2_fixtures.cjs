#!/usr/bin/env node
"use strict";
// Read-only, native-SPL fixtures. Submit these in Splunk Search; no credentials,
// saved jobs, indexed records, or network requests are created by this helper.
const fs = require("node:fs");
const path = require("node:path");
const {generateFixtures} = require("./generate_search_library_batch1_fixtures.cjs");
const root = path.resolve(__dirname,"..");
const conf = fs.readFileSync(path.join(root,"packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"),"utf8");
const cases = JSON.parse(fs.readFileSync(path.join(root,"packages/splunk-cisco-dashboards/test/fixtures/searchLibraryBatch2Cases.json"),"utf8"));
if(require.main === module) process.stdout.write(JSON.stringify(generateFixtures(conf,cases),null,2)+"\n");
module.exports = {cases};
