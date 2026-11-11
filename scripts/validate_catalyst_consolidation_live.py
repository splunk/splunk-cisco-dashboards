#!/usr/bin/env python3
"""Read-only Forge fixtures and bounded live validation for the consolidated view.

Export production queries with CATALYST_QUERY_EXPORT=/private/tmp/queries.json
node --test packages/splunk-cisco-dashboards/test/catalystConsolidation.test.cjs,
then pass that file with --queries. Transient fixtures are never indexed.
"""
import sys,json,time,argparse
from pathlib import Path
sys.path.insert(0,'scripts');from validate_dc_networking_live import LabClient,ephemeral_fixture
from validate_operational_search_surfaces import UNSAFE_RE
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--queries',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
records=json.loads(args.queries.read_text());queries={q['id']:q['spl'] for q in records}
assert all(not UNSAFE_RE.search(q['spl']) for q in records),'Unsafe query'
c=LabClient();stamp=(int(time.time())//900)*900+1
source=json.loads(Path('packages/splunk-cisco-dashboards/src/main/webapp/pages/catalyst_operations/sourceDefinitions.json').read_text())
summary=source['health']['dataSources']['ds_exec_issue_summary']['options']['query']
issue=dict(event_time=stamp,sourcetype='cisco:dnac:issue',IssueID='fixture-issue',IssueName='Clock issue',IssueStatus='active',IssueSpecificPriority='P1')
r,m=c.search(ephemeral_fixture(summary,[issue,dict(issue,event_time=stamp+1,IssueStatus='resolved')]));assert len(r)==1 and float(r[0]['Open'])==0 and float(r[0]['Resolved'])==1 and float(r[0]['Total'])==1,r
print('Issue lifecycle: latest resolved excludes earlier active state (passed)',flush=True)
r,m=c.search(ephemeral_fixture(queries['operations_viz_ex_issue_detail_modal'],[issue]));assert len(r)==1 and r[0]['Issue']=='Clock issue',r
print('Issue detail predicate: populated known issue (passed)',flush=True)
client=dict(event_time=stamp,macAddress='a',**{'connection.band':'5 GHz','connection.protocol':'ax','connection.sessionDuration':3600,'traffic.usage':1073741824})
rows=[client,client,dict(client,event_time=stamp+1,**{'connection.sessionDuration':7200,'traffic.usage':2147483648}),dict(client,macAddress='b')]
r,m=c.search(ephemeral_fixture(queries['health_viz_cs_session_band'],rows));assert float(r[0]['Reported session-hours'])==3,r
r,m=c.search(ephemeral_fixture(queries['health_viz_cs_traffic_proto'],rows));assert len(r)==1 and float(r[0]['ax'])==3,r
print('Session/traffic snapshots: repeated polls do not inflate 3 hours / 3 GiB (passed)',flush=True)
r,m=c.search(ephemeral_fixture(queries['operations_viz_ex_ap_health'],[dict(event_time=stamp,DeviceID='ap',DeviceFamily='Unified AP',Reachability='Unknown',Manageability='Unknown')]));assert not r or 'health_pct' not in r[0],r
print('Unknown device health remains blank (passed)',flush=True)
weekrows=[dict(issue,event_time=int(time.time())-8*86400),dict(issue,event_time=int(time.time())-100,IssueStatus='resolved')]
r,m=c.search(ephemeral_fixture(queries['health_viz_ex_wow_table'],weekrows));found=next(row for row in r if row['Metric']=='Open Issues');assert float(found['This Week'])==0 and float(found['Last Week'])==1,found
print('Weekly comparison: latest states within each period and missing feeds unknown (passed)',flush=True)
for row in r:
 if row['Metric']!='Open Issues':assert 'This Week' not in row and 'Last Week' not in row,row

site=source['health']['dataSources']['ds_cs_health_by_location']['options']['query']
a=dict(event_time=stamp,macAddress='fixture-a',type='Wired',siteHierarchy='Global/Fixture Site',**{'health.overallScore':0})
rows=[a,dict(a,event_time=stamp+1,**{'health.overallScore':10}),dict(a,event_time=stamp+2,**{'health.overallScore':10}),dict(a,macAddress='fixture-b')]
r,m=c.search(ephemeral_fixture(site,rows));assert len(r)==1 and float(r[0]['health'])==50 and float(r[0]['clients'])==2,r
print('Site client health: latest per client avoids poll-weighted averages (passed)',flush=True)
onboarding=source['health']['dataSources']['ds_cs_onboarding']['options']['query']
a=dict(event_time=stamp,macAddress='a',**{'onboarding.avgAuthDuration':100,'onboarding.avgDhcpDuration':50,'onboarding.avgAssocDuration':20})
rows=[a,dict(a,event_time=stamp+1,**{'onboarding.avgAuthDuration':200}),dict(a,event_time=stamp+2,**{'onboarding.avgAuthDuration':200}),dict(a,macAddress='b',**{'onboarding.avgAuthDuration':300})]
r,m=c.search(ephemeral_fixture(onboarding,rows));assert float(r[0]['avg_onboard'])==320,r
r,m=c.search(ephemeral_fixture(onboarding,[dict(a,**{'onboarding.avgAuthDuration':None})]));assert not r or 'avg_onboard' not in r[0],r
print('Onboarding: latest clients and complete measurements yield320ms, missing component stays unknown (passed)',flush=True)
seen=set();report=[]
for q in records:
    key=(q['spl'],q['earliest'],q['latest'])
    if key in seen:continue
    seen.add(key);start=time.monotonic();entry={'id':q['id']}
    try:
        rows,messages=c.search(q['spl'],q['earliest'],q['latest'])
        entry.update(status='pass',rows=len(rows),messages=messages,seconds=round(time.monotonic()-start,2))
        if any(m.get('type') in ('WARN','ERROR','FATAL') for m in messages):entry['status']='review'
    except Exception as error:entry.update(status='failed',error=str(error))
    report.append(entry);args.output.write_text(json.dumps(report,indent=2));print(json.dumps(entry),flush=True)
assert all(e['status']=='pass' for e in report),'Live queries require correction'
