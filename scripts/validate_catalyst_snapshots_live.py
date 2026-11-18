"""Validate native Catalyst snapshot counts with transient SPL fixtures.

Read-only against the verified local Forge session. No fixture events are indexed;
the existing LabClient bounds searches and deletes task-owned jobs in finally.
"""
import argparse,json,time,xml.etree.ElementTree as E
from pathlib import Path
from validate_dc_networking_live import LabClient,ephemeral_fixture
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args()
p=Path(__file__).resolve().parents[1]/'packages/splunk-cisco-dashboards/src/main/resources/splunk/default/data/ui/views/netops_catalyst_operations.xml'
d=json.loads(E.parse(p).getroot().findtext('definition'));q=d['dataSources']['ds_client_count_snapshots']['options']['query'];c=LabClient();now=int(time.time())-60

def event(score,count,window=1,controller='a',kind='WIRELESS',scope='global',observed=None):
 return dict(sourcetype='cisco:dnac:clienthealth',host=controller,clientType=kind,siteId=scope,scoreType=score,clientCount=count,event_time=observed or now,starttime=(now-600+window*60)*1000,endtime=(now-600+window*60)*1000)

def run(name,events,expected):
 prefix,rest=q.split('\n',1);filtered='| search '+prefix.replace('`index_catalyst` ','')+'\n'+rest
 fixture=ephemeral_fixture(q,events).split('\n',1)[0]+'\n'+filtered
 rows,m=c.search(fixture);assert not m,(name,m)
 by={r['clientType']:r for r in rows}
 for kind,total,healthy in expected:
  row=by[kind]
  for field,value in [('Total',total),('Healthy',healthy)]:
   actual=row.get(field);actual=None if actual in (None,'') else float(actual)
   assert actual==value,(name,field,value,rows)
 print('PASS',name,flush=True)
 return {'case':name,'rows':rows}
results=[]
results.append(run('matched snapshot',[event('ALL',159),event('GOOD',140)],[('WIRELESS',159,140)]))
results.append(run('conflicting same-window counts',[event('ALL',159),event('GOOD',264)],[('WIRELESS',159,None)]))
results.append(run('missing healthy is unknown',[event('ALL',159)],[('WIRELESS',159,None)]))
results.append(run('do not borrow healthy from older window',[event('ALL',500,1),event('GOOD',400,1),event('ALL',159,2)],[('WIRELESS',159,None)]))
results.append(run('late old ingestion does not replace source snapshot',[event('ALL',500,1,observed=now+10),event('GOOD',400,1,observed=now+11),event('ALL',159,2),event('GOOD',140,2)],[('WIRELESS',159,140)]))
results.append(run('zero is measured',[event('ALL',0),event('GOOD',0)],[('WIRELESS',0,0)]))
results.append(run('invalid latest total does not fall back',[event('ALL',100,1),event('GOOD',80,1),event('ALL','unknown',2),event('GOOD',3,2)],[('WIRELESS',None,None)]))
results.append(run('controller sums use matched snapshots',[event('ALL',100),event('GOOD',80),event('ALL',50,controller='b'),event('GOOD',30,controller='b')],[('WIRELESS',150,110)]))
results.append(run('missing controller component stays unknown',[event('ALL',100),event('GOOD',80),event('ALL',50,controller='b')],[('WIRELESS',150,None)]))
results.append(run('site records do not double-count global',[event('ALL',100),event('GOOD',80),event('ALL',50,scope='site-a'),event('GOOD',30,scope='site-a')],[('WIRELESS',100,80)]))
results.append(run('wired and wireless remain separate',[event('ALL',100,kind='WIRED'),event('GOOD',80,kind='WIRED'),event('ALL',50),event('GOOD',30)],[('WIRED',100,80),('WIRELESS',50,30)]))
rows,m=c.search(q,earliest='-24h');assert not m,m;print('LIVE',json.dumps(rows),flush=True)
args.output.write_text(json.dumps({'fixtures':results,'live':rows},indent=2))
