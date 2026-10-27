#!/usr/bin/env python3
"""Authoring-only source contracts for eighty optional Searchbase investigations.

No network, authentication, Splunk mutations, schedules or collectors. --write
appends a managed block or updates it only if it matches the committed baseline;
--check requires byte-exact generated content. Runtime SPL is self-contained.
"""
import argparse, collections, html, json, pathlib, re, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
CONF = ROOT/'packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf'
MARK = '[mv_traffic_application_bytes]'
SCOPE = '(`index_network` OR `index_firewall` OR `index_security` OR `index_f5` OR `index_windows`)'
REF = {
 'traffic':'https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/network-traffic',
 'auth':'https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/authentication',
 'dns':'https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/network-resolution-dns',
 'web':'https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/web',
 'ids':'https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/intrusion-detection',
 'change':'https://help.splunk.com/en/data-management/common-information-model/6.2/data-models/change',
 'Palo Alto':'https://splunk.github.io/splunk-add-on-for-palo-alto-networks/Cimmapping/',
 'Fortinet':'https://splunk.github.io/splunk-connect-for-syslog/main/sources/vendor/Fortinet/fortios/',
 'Juniper / Aruba':'https://splunk.github.io/splunk-connect-for-syslog/main/sources/vendor/Juniper/junos/',
 'Arista':'https://splunk.github.io/splunk-connect-for-syslog/main/sources/vendor/Arista/',
 'Check Point':'https://splunk.github.io/splunk-connect-for-syslog/main/sources/vendor/Checkpoint/logexporter_5424/',
 'F5':'https://splunk.github.io/splunk-add-on-for-f5-big-ip/Sourcetypes/',
 'Zscaler':'https://help.zscaler.com/zscaler-technology-partners/zscaler-and-splunk-deployment-guide',
 'Infoblox':'https://splunk.github.io/splunk-connect-for-syslog/main/sources/vendor/InfoBlox/',
 'CrowdStrike':'https://www.crowdstrike.com/wp-content/uploads/2021/06/CrowdStrike-Falcon-Data-Replicator-Technical-Add-On-Guide.pdf',
 'Microsoft':'https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-devicenetworkevents-table',
}
ENTRIES=[]
def event(**kw): return {'host':'device-a','_time':{'expr':'now()-60'},**kw}
def norm(mapping, defaults=(), ip_targets=(), family_field=None):
    raw=list(dict.fromkeys(a for aliases in mapping.values() for a in aliases.split()))
    line="| foreach "+' '.join(raw)+" [ eval <<FIELD>>=if(coalesce(mvcount(mvdedup('<<FIELD>>')),0)=1,nullif(trim(mvindex(mvdedup('<<FIELD>>'),0)),\"\"),null()) ]"
    assigns=[]
    for target,aliases in mapping.items():
        args=["'"+x+"'" for x in aliases.split()]
        if target in ip_targets:
            # Validate each candidate before coalescing. An unrelated family or
            # placeholder in an earlier alias must not hide a usable address.
            def candidates(cidr):
                values=[f'if(cidrmatch("{cidr}",{a}),{a},null())' for a in args]
                return 'coalesce('+','.join(values)+')' if len(values)>1 else values[0]
            ipv4,ipv6=candidates('0.0.0.0/0'),candidates('::/0')
            value=f'coalesce({ipv4},{ipv6})'
            if family_field:
                value=f'case(match(\'{family_field}\',"IP6"),{ipv6},match(\'{family_field}\',"IP4"),{ipv4},true(),{value})'
            assigns.append(target+'='+value)
            continue
        if target in defaults:args.append('"Not reported"')
        assigns.append(target+'='+(('coalesce('+','.join(args)+')') if len(args)>1 else args[0]))
    return line+'\n| eval '+', '.join(assigns)
def src(*types): return SCOPE+' sourcetype IN ('+','.join(json.dumps(t) for t in types)+')'
def add(group,slug,name,source,mapping,body,cols,desc,limits,rows,records,groups=1,extra='',assertion='',ref=None,defaults=(),order='- Records',ip_targets=(),family_field=None,version='1.0.0'):
    assert not any(x['id']=='mv_'+slug for x in ENTRIES),slug
    normal=norm(mapping,defaults,ip_targets,family_field) if mapping else ''
    bounded='''| eventstats count as TotalGroups
| eval RowsTruncated=if(TotalGroups>1000,1,0)
| sort 1000 '''+order+'''
| table '''+cols+''' TotalGroups RowsTruncated
| appendpipe [ stats count as _empty | where _empty=0 | eval message="No qualifying observations. Check source fields, tags, index routing, permissions, thresholds and the finite time window; this is not a health verdict." | fields message ]'''
    q='\n'.join(x.strip() for x in [source,normal,body,bounded] if x)
    ENTRIES.append(dict(id='mv_'+slug,group=group,name=name,source=source,fields=mapping,query=q,description=desc,
        limits=limits,version=version,ref=ref or REF[group],fixture={'id':'mv_'+slug,'rows':rows,
        'post':'| stats count as Groups count(eval(isnotnull(message))) as MessageRows sum(Records) as Records '+extra,
        'assertion':f'Groups={groups} AND MessageRows=0 AND Records={records}'+(' AND '+assertion if assertion else '')}))
DEVICE={'Device':'dvc host'}
TRAFFIC={**DEVICE,'Source':'src src_ip','Destination':'dest dest_ip','Port':'dest_port','Application':'app','Action':'action','Transport':'transport','ByteValue':'bytes','DurationValue':'duration'}
DECISION='| eval Decision=case(lower(Action) IN ("allow","allowed","accept","permit","permitted"),"Allowed",lower(Action) IN ("deny","denied","drop","dropped","block","blocked","reject"),"Denied",true(),"Unknown")'
IP='| eval SourceValid=if(cidrmatch("0.0.0.0/0",Source) OR cidrmatch("::/0",Source),1,0), DestinationValid=if(cidrmatch("0.0.0.0/0",Destination) OR cidrmatch("::/0",Destination),1,0)'
CT=SCOPE+' tag=network tag=communicate'
AUTH={**DEVICE,'User':'user','Application':'app','Source':'src src_ip','Action':'action','Method':'authentication_method'}
CA=SCOPE+' tag=authentication'
DNS={**DEVICE,'Client':'src src_ip','Resolver':'dest dest_ip','Query':'query','QueryType':'query_type','Reply':'reply_code','ReplyId':'reply_code_id','Latency':'response_time','MessageType':'message_type'}
CD=SCOPE+' tag=network tag=resolution tag=dns'
DNSCODE='| eval Code=case(lower(Reply) IN ("nxdomain","non-existent domain","3"),"NXDOMAIN",lower(Reply) IN ("servfail","server failure","2"),"SERVFAIL",lower(Reply) IN ("noerror","no error","0"),"NOERROR",isnotnull(Reply),upper(Reply),tonumber(ReplyId)=3,"NXDOMAIN",tonumber(ReplyId)=2,"SERVFAIL",tonumber(ReplyId)=0,"NOERROR",true(),"Unknown")'
COMMON='Equal repeated scalar values collapse; conflicting scalars and blank aliases become unknown. Counts are observations, not unique sessions or incidents. '
# Twenty different vendor-neutral operational questions. CIM tags constrain scope;
# no Cisco fields, source types or companion data models are required.
def neutral(slug,name,source,mapping,body,cols,desc,limits,rows,records,groups=1,extra='',assertion='',ref='traffic',defaults=(),order='- Records'):
    add('Vendor neutral',slug,'Network Essentials - '+name,source,mapping,body,cols,desc,limits,rows,records,groups,extra,assertion,REF[ref],defaults,order)
neutral('traffic_application_bytes','Application Transfer Observations',CT,TRAFFIC,
 '| eval ByteValue=tonumber(ByteValue)\n| where ByteValue>=0 AND isnotnull(Application)\n| stats count as Records sum(ByteValue) as ObservedBytes max(_time) as LastSeen by Device Application',
 'Device Application Records ObservedBytes LastSeen','Ranks reported traffic bytes by device and application.',
 'Requires nonnegative per-record CIM bytes, not cumulative device counters. Start/end updates can repeat session totals; select a terminal-event feed before interpreting totals as traffic volume.',
 [event(app='https',bytes=100),event(app='https',bytes=['200','200']),event(app='https',bytes=-1)],2,extra='sum(ObservedBytes) as Bytes',assertion='Bytes=300',defaults=('Device',))
neutral('traffic_decision_rates','Explicit Policy Decision Rates',CT,TRAFFIC,DECISION+'''
| stats count as Records count(eval(Decision="Denied")) as Denied count(eval(Decision="Allowed")) as Allowed count(eval(Decision="Unknown")) as Unknown by Device
| eval DeniedPct=round(100*Denied/Records,2)''','Device Records Allowed Denied Unknown DeniedPct','Compares explicit denied, allowed and unknown traffic decisions per reporting device.',
 'Unknown and teardown/reset-only actions remain in the denominator. This is a record share, not firewall effectiveness or unique session failure rate.',
 [event(action='allow'),event(action='deny'),event(action='teardown')],3,extra='sum(Denied) as Denied sum(Unknown) as Unknown',assertion='Denied=1 AND Unknown=1',defaults=('Device',))
neutral('traffic_destination_fanout','Source Destination Fan-out Candidates',CT,TRAFFIC,IP+'''
| where SourceValid=1 AND DestinationValid=1
| bin _time span=15m
| stats count as Records dc(Destination) as Destinations by Device Source _time
| where Destinations>=20''','_time Device Source Records Destinations','Finds sources contacting at least twenty distinct valid destinations in fifteen minutes.',
 'Twenty is an editable investigation threshold. Shared proxies, monitoring and service discovery can be legitimate; no scan or compromise verdict is inferred.',
 [event(src='192.0.2.1',dest=f'198.51.100.{i}') for i in range(1,21)]+[event(src='192.0.2.2',dest='invalid')],20,extra='max(Destinations) as N',assertion='N=20',defaults=('Device',))
neutral('traffic_port_fanout','Destination Port Fan-out Candidates',CT,TRAFFIC,IP+'''
| eval Port=tonumber(Port)
| where SourceValid=1 AND DestinationValid=1 AND Port>=0 AND Port<=65535
| bin _time span=15m
| stats count as Records dc(Port) as Ports by Device Source Destination _time
| where Ports>=10''','_time Device Source Destination Records Ports','Finds a source/destination pair with ten or more observed destination ports in fifteen minutes.',
 'Port diversity is a candidate for review, not proof of scanning. Logging duplicates increase record counts but not distinct port counts.',
 [event(src='192.0.2.1',dest='198.51.100.1',dest_port=i) for i in range(10)]+[event(src='192.0.2.1',dest='198.51.100.1',dest_port=-1)],10,extra='max(Ports) as N',assertion='N=10',defaults=('Device',))
neutral('traffic_remote_administration','Allowed Remote Administration Port Observations',CT,TRAFFIC,DECISION+'\n'+IP+'''
| eval Port=tonumber(Port)
| where Decision="Allowed" AND SourceValid=1 AND DestinationValid=1 AND Port IN (22,3389,445,5985,5986)
| stats count as Records max(_time) as LastSeen by Device Source Destination Port''','Device Source Destination Port Records LastSeen','Inventories allowed records on common remote-administration ports.',
 'Port selection does not prove application identity, remote reachability, exposure or unauthorized use. Interpret with segmentation and ownership context.',
 [event(action='allowed',src='192.0.2.1',dest='198.51.100.1',dest_port=3389),event(action='deny',src='192.0.2.1',dest='198.51.100.1',dest_port=3389)],1,defaults=('Device',))
neutral('traffic_application_port_inventory','Application and Transport Port Inventory',CT,TRAFFIC,
 '| eval Port=tonumber(Port)\n| where isnotnull(Application) AND Port>=0 AND Port<=65535\n| stats count as Records dc(Source) as Sources max(_time) as LastSeen by Device Application Transport Port',
 'Device Application Transport Port Records Sources LastSeen','Shows reported application/transport/port combinations for service inventory.',
 'A non-default port can be legitimate. Application names depend on source classification; this does not verify the listening service or configured inventory.',
 [event(app='ssh',transport='tcp',dest_port=2222,src='192.0.2.1'),event(app='ssh',transport='tcp',dest_port=70000)],1,defaults=('Device','Transport'))
neutral('traffic_long_duration','Long-Duration Connection Records',CT,TRAFFIC,
 '| eval Seconds=tonumber(DurationValue)\n| where Seconds>=3600 AND isnotnull(Destination)\n| stats count as Records max(Seconds) as MaxDurationSeconds max(_time) as LastSeen by Device Source Destination Application',
 'Device Source Destination Application Records MaxDurationSeconds LastSeen','Finds reported connection durations of an hour or more.',
 'Requires CIM duration in seconds. This is reported duration, not current connection state, outage duration or an abnormality verdict.',
 [event(src='192.0.2.1',dest='198.51.100.1',app='https',duration=3600),event(src='192.0.2.1',dest='198.51.100.1',duration=-1)],1,extra='max(MaxDurationSeconds) as Seconds',assertion='Seconds=3600',defaults=('Device','Source','Application'))
neutral('authentication_application_outcomes','Authentication Outcomes by Application',CA,AUTH,
 '| eval Outcome=if(lower(Action) IN ("success","failure","pending","error"),lower(Action),"unknown")\n| stats count as Records count(eval(Outcome="failure")) as Failures count(eval(Outcome="unknown")) as Unknown by Application\n| eval FailurePct=round(100*Failures/Records,2)',
 'Application Records Failures FailurePct Unknown','Compares reported authentication outcomes and failure shares by application.',
 'Unknown outcomes remain in the denominator. Repeated attempts count repeatedly, and failure is not automatically an attack.',
 [event(app='vpn',action='success'),event(app='vpn',action='failure'),event(app='vpn')],3,extra='sum(Failures) as Failures sum(Unknown) as Unknown',assertion='Failures=1 AND Unknown=1',ref='auth',defaults=('Application',))
neutral('authentication_source_changes','Successful Authentication Source Diversity',CA,AUTH,
 '| where lower(Action)="success" AND isnotnull(User) AND isnotnull(Source)\n| bin _time span=15m\n| stats count as Records dc(Source) as Sources by User Application _time\n| where Sources>=3',
 '_time User Application Records Sources','Finds users with successful authentication records from at least three sources within fifteen minutes.',
 'Sources can be IPs or hostnames. This is not impossible travel or concurrent sessions; roaming, proxies and shared identities require review.',
 [event(user='alice',app='vpn',action='success',src=f'192.0.2.{i}') for i in range(1,4)]+[event(user='bob',action='failure',src='192.0.2.4')],3,extra='max(Sources) as N',assertion='N=3',ref='auth',defaults=('Application',))
neutral('authentication_method_visibility','Authentication Method Visibility',CA,AUTH,
 '| eval Reported=if(isnotnull(Method),1,0)\n| stats count as Records sum(Reported) as WithMethod by Application\n| eval WithoutMethod=Records-WithMethod, MethodReportedPct=round(100*WithMethod/Records,2)',
 'Application Records WithMethod WithoutMethod MethodReportedPct','Measures whether observed authentication records report a method.',
 'Method presence does not prove MFA, authentication strength or compliance. A source absent for the entire window is outside this denominator.',
 [event(app='vpn',authentication_method='certificate'),event(app='vpn')],2,extra='sum(WithMethod) as N',assertion='N=1',ref='auth',defaults=('Application',))
for slug,name,code,field in [('dns_nxdomain_clients','NXDOMAIN Client Hotspots','NXDOMAIN','Client'),('dns_servfail_resolvers','SERVFAIL Resolver Hotspots','SERVFAIL','Resolver')]:
    neutral(slug,name,CD,DNS,DNSCODE+f'\n| where Code="{code}" AND isnotnull({field})\n| stats count as Records dc(Query) as Queries max(_time) as LastSeen by Device {field}',
      f'Device {field} Records Queries LastSeen',f'Ranks observed {code} responses by {field.lower()}.',
      'Requires response data; query-only logging cannot establish response outcomes. Retries are separate records and no service-wide failure rate is inferred.',
      [event(src='192.0.2.1',dest='192.0.2.53',query='example.test',reply_code=code),event(src='192.0.2.1',dest='192.0.2.53',query='example.test',reply_code='NOERROR')],1,ref='dns',defaults=('Device',))
neutral('dns_unusual_query_types','TXT and NULL Query Observations',CD,DNS,
 '| where upper(QueryType) IN ("TXT","NULL","16","10") AND isnotnull(Client)\n| stats count as Records dc(Query) as DistinctQueries by Device Client QueryType',
 'Device Client QueryType Records DistinctQueries','Inventories observed TXT/NULL query-type records by client.',
 'TXT is common for legitimate verification and mail security. No tunneling verdict is inferred, and query/response pairs may both be present.',
 [event(src='192.0.2.1',query_type='TXT',query='example.test'),event(src='192.0.2.1',query_type='A',query='example.test')],1,ref='dns',defaults=('Device',))
neutral('dns_response_latency','DNS Response-Time Observations',CD,DNS,
 '| eval Seconds=tonumber(Latency)\n| where Seconds>=0 AND isnotnull(Resolver)\n| stats count as Records median(Seconds) as MedianSeconds perc95(Seconds) as P95Seconds max(Seconds) as MaxSeconds by Device Resolver',
 'Device Resolver Records MedianSeconds P95Seconds MaxSeconds','Summarizes valid observed DNS response times by resolver.',
 'CIM response_time must be in seconds consistently for these sources. Missing latency is excluded, not zero; query-only logs cannot establish response time.',
 [event(dest='192.0.2.53',response_time=0),event(dest='192.0.2.53',response_time=0.2),event(dest='192.0.2.53',response_time=-1)],2,extra='max(MaxSeconds) as Max',assertion='Max=0.2',ref='dns',defaults=('Device',))
WEB={**DEVICE,'Destination':'dest dest_ip','URL':'url','Status':'status','Method':'http_method','Client':'src src_ip'}
neutral('web_server_errors','HTTP Server-Error Observations',SCOPE+' tag=web',WEB,
 '| eval Status=tonumber(Status)\n| where Status>=500 AND Status<=599 AND isnotnull(Destination)\n| stats count as Records dc(Client) as Clients max(_time) as LastSeen by Device Destination Status',
 'Device Destination Status Records Clients LastSeen','Ranks reported HTTP 5xx responses by destination and status.',
 'A proxy-generated 5xx may differ from an origin application failure. Record counts are not unique requests when multiple logging layers are combined.',
 [event(dest='app-a',status=503),event(dest='app-a',status=200)],1,ref='web',defaults=('Device',))
neutral('web_cleartext_destinations','Observed Cleartext HTTP Destinations',SCOPE+' tag=web',WEB,
 '| where match(URL,"(?i)^http://") AND isnotnull(Destination)\n| stats count as Records dc(Client) as Clients max(_time) as LastSeen by Device Destination',
 'Device Destination Records Clients LastSeen','Shows destinations appearing in explicitly HTTP URL records.',
 'URL scheme alone does not establish end-to-end encryption, sensitive data transfer or policy noncompliance. Proxy visibility and URL redaction affect coverage.',
 [event(dest='app-a',url='http://app-a/'),event(dest='app-a',url='https://app-a/')],1,ref='web',defaults=('Device',))
IDS={**DEVICE,'Signature':'signature signature_id','Severity':'severity','Action':'action','Destination':'dest dest_ip','Source':'src src_ip'}
neutral('intrusion_alert_actions','Intrusion Alert-Only Action Evidence',SCOPE+' tag=ids tag=attack',IDS,
 '| where lower(Action) IN ("alert","alerted","detected") AND isnotnull(Signature)\n| stats count as Records dc(Destination) as Destinations by Device Signature Severity Action',
 'Device Signature Severity Action Records Destinations','Finds intrusion records whose reported action is alert/detected.',
 'These labels do not prove packets passed all controls or that an exploit succeeded. Inspect source action semantics and other enforcement layers.',
 [event(signature='sig-1',action='detected',severity='high'),event(signature='sig-1',action='blocked',severity='high')],1,ref='ids',defaults=('Device','Severity'))

CH={**DEVICE,'Actor':'src_user user','Object':'object object_path object_id','Category':'object_category','Status':'status','Action':'action'}
neutral('change_failure_records','Recorded Change Failures',SCOPE+' tag=change',CH,
 '| where lower(Status)="failure"\n| stats count as Records max(_time) as LastSeen by Device Actor Category Object Action',
 'Device Actor Category Object Action Records LastSeen','Summarizes explicitly failed change records for operational review.',
 'Review object category to identify network-related changes. This includes only reported failures and cannot establish rollback, current configuration or change impact.',
 [event(src_user='operator',object='config',status='failure'),event(src_user='operator',object='config',status='success')],1,ref='change',defaults=('Device','Actor','Category','Object','Action'))
neutral('ipv6_decision_visibility','IPv6 Traffic Decision Visibility',CT,TRAFFIC,DECISION+'''
| where cidrmatch("::/0",Source) OR cidrmatch("::/0",Destination)
| stats count as Records count(eval(Decision="Unknown")) as UnknownDecisions count(eval(Decision!="Unknown")) as ExplicitDecisions by Device
| eval DecisionReportedPct=round(100*ExplicitDecisions/Records,2)''',
 'Device Records ExplicitDecisions UnknownDecisions DecisionReportedPct','Measures explicit policy-decision visibility in IPv6-involved CIM traffic observations.',
 'Only syntactically valid IPv6 endpoint values establish IPv6 involvement; MAC-like strings do not. Unknown actions remain in the denominator. These observed records do not establish complete IPv6 coverage, reachability or protection.',
 [event(src='2001:db8::1',dest='2001:db8::2',action='allowed'),event(src='2001:db8::1',dest='192.0.2.1',action='teardown'),event(src='aa:bb:cc:dd:ee:ff',dest='192.0.2.1',action='allowed')],2,extra='sum(UnknownDecisions) as Unknown',assertion='Unknown=1',defaults=('Device',))
# Palo Alto: independent PAN feeds; no Cisco SGT/ISE correlation dependency.
PA=src('pan:traffic')
PAM={**TRAFFIC,'Rule':'rule rule_name','SourceZone':'src_zone','DestinationZone':'dest_zone','EndReason':'session_end_reason','Subtype':'subtype log_subtype'}
add('Palo Alto','pan_application_transfer','Palo Alto - Terminal Traffic Bytes by Application',PA,PAM,
 '| where lower(Subtype)="end" AND isnotnull(Application)\n| eval ByteValue=tonumber(ByteValue)\n| where ByteValue>=0\n| stats count as Records sum(ByteValue) as ObservedBytes by Device Application',
 'Device Application Records ObservedBytes','Ranks application transfer bytes using PAN terminal traffic records.',
 'Requires subtype=end and per-session terminal bytes; forwarded duplicates can still inflate totals. No total device throughput or available capacity is inferred.',
 [event(subtype='end',app='ssl',bytes=100),event(subtype='start',app='ssl',bytes=100)],1,extra='sum(ObservedBytes) as Bytes',assertion='Bytes=100',defaults=('Device',))
add('Palo Alto','pan_denied_zone_boundaries','Palo Alto - Denied Zone and Rule Boundaries',PA,PAM,DECISION+'''
| where Decision="Denied"
| stats count as Records dc(Source) as Sources by Device SourceZone DestinationZone Rule''',
 'Device SourceZone DestinationZone Rule Records Sources','Finds reported denied traffic at zone/rule boundaries.',
 'Unknown zone/rule context remains visible. Counts are records, not denied sessions or a rule-effectiveness score.',
 [event(action='deny',src_zone='trust',dest_zone='untrust',rule='rule-1'),event(action='allow',src_zone='trust',dest_zone='untrust',rule='rule-1')],1,defaults=('Device','SourceZone','DestinationZone','Rule'))
add('Palo Alto','pan_globalprotect_failures','Palo Alto - GlobalProtect Failure Reasons',src('pan:globalprotect','pan:globalprotect:cloud'),
 {**DEVICE,'User':'user src_user','Outcome':'status action','Reason':'error reason description','Gateway':'gateway dest'},
 '| where lower(Outcome) IN ("failure","failed","fail","error")\n| stats count as Records dc(User) as Users by Device Gateway Reason',
 'Device Gateway Reason Records Users','Ranks explicitly failed GlobalProtect records by gateway and reason.',
 'Requires parsed status/action and error context. Status values vary by PAN version; unrecognized outcomes are excluded, not treated as success.',
 [event(user='alice',status='failure',error='certificate rejected',gateway='gw-1'),event(status='success')],1,defaults=('Device','Gateway','Reason'))
add('Palo Alto','pan_threat_enforcement','Palo Alto - Threat Action and Severity Evidence',src('pan:threat'),IDS,
 '| where isnotnull(Signature)\n| stats count as Records dc(Destination) as Destinations by Device Signature Severity Action',
 'Device Signature Severity Action Records Destinations','Summarizes PAN threat signatures with their reported action and severity.',
 'Threat actions remain verbatim; alert/reset/drop semantics differ and do not establish exploitation success. Missing severity/action is explicit.',
 [event(signature='sig-1',severity='high',action='reset-both'),event(signature=['a','b'],severity='high',action='alert')],1,defaults=('Device','Severity','Action'))
add('Palo Alto','pan_session_end_reasons','Palo Alto - Terminal Session End Reasons',PA,PAM,
 '| where lower(Subtype)="end" AND isnotnull(EndReason)\n| stats count as Records dc(Destination) as Destinations by Device EndReason Application',
 'Device EndReason Application Records Destinations','Separates reported PAN terminal session reasons by application.',
 'Timeouts and TCP resets are not automatically policy blocks or application outages. Start records and missing reasons are excluded.',
 [event(subtype='end',session_end_reason='tcp-rst-from-server',app='ssl'),event(subtype='start',session_end_reason='tcp-rst-from-server')],1,defaults=('Device','Application'))
add('Palo Alto','pan_ha_messages','Palo Alto - High-Availability System Messages',src('pan:system'),
 {**DEVICE,'Subtype':'subtype','Event':'event_id eventid','Severity':'severity'},
 '| where lower(Subtype)="ha"\n| stats count as Records max(_time) as LastSeen by Device Event Severity',
 'Device Event Severity Records LastSeen','Groups HA-related PAN system messages for failover investigation.',
 'Includes informational HA activity as well as errors. Message counts do not prove a failover, outage duration or current active/passive state.',
 [event(subtype='ha',event_id='state-change',severity='informational'),event(subtype='general',event_id='state-change')],1,defaults=('Device','Event','Severity'))
# Fortinet supports fgt_*, fortinet_* and fortigate_* ingestion generations.
FGT=src('fgt_traffic','fortinet_traffic','fortigate_traffic')
FGE=src('fgt_event','fortinet_event','fortigate_event')
FGU=src('fgt_utm','fortinet_utm','fortigate_utm')
FGMAP={**DEVICE,'Action':'action','Source':'srcip src_ip src','Destination':'dstip dest_ip dest','Policy':'policyid policy_id','VDOM':'vd vdom','Application':'app','Risk':'apprisk'}
add('Fortinet','fortinet_policy_denials','Fortinet - Policy Denials by VDOM',FGT,FGMAP,DECISION+'''
| where Decision="Denied"
| stats count as Records dc(Source) as Sources by Device VDOM Policy''',
 'Device VDOM Policy Records Sources','Ranks explicit FortiGate denied traffic decisions by VDOM and policy.',
 'VDOM and policy identifiers are retained as reported. Duplicates affect records, and policy ID presence is not configuration inventory.',
 [event(action='deny',vd='root',policyid=7,srcip='192.0.2.1'),event(action='accept',vd='root',policyid=7)],1,defaults=('Device','VDOM','Policy'))
add('Fortinet','fortinet_vpn_transitions','Fortinet - Reported VPN Tunnel Transitions',FGE,
 {**DEVICE,'Tunnel':'vpntunnel tunnelname','Action':'action','VDOM':'vd vdom','Remote':'remip remote_ip'},
 '| where lower(Action) IN ("tunnel-up","tunnel-down")\n| stats count as Records count(eval(lower(Action)="tunnel-down")) as DownMessages max(_time) as LastSeen by Device VDOM Tunnel Remote',
 'Device VDOM Tunnel Remote Records DownMessages LastSeen','Counts explicit FortiGate tunnel-up/down messages.',
 'Records can repeat or be missing. This does not calculate outage duration, distinct failovers or current tunnel state.',
 [event(action='tunnel-down',vpntunnel='vpn-a',remip='192.0.2.1',vd='root'),event(action='login')],1,defaults=('Device','VDOM','Tunnel','Remote'))
add('Fortinet','fortinet_sdwan_probe_quality','Fortinet - SD-WAN Probe Quality Observations',FGE,
 {**DEVICE,'Subtype':'subtype','Check':'healthcheck','Interface':'interface','Loss':'packetloss','Latency':'latency','Jitter':'jitter','VDOM':'vd vdom'},
 '''| where lower(Subtype)="sdwan" AND isnotnull(Check) AND isnotnull(Interface)
| eval Loss=tonumber(replace(Loss,"%$","")), Latency=tonumber(Latency), Jitter=tonumber(Jitter)
| eval Loss=if(Loss>=0 AND Loss<=100,Loss,null()), Latency=if(Latency>=0,Latency,null()), Jitter=if(Jitter>=0,Jitter,null())
| where isnotnull(Loss) OR isnotnull(Latency) OR isnotnull(Jitter)
| stats count as Records count(Loss) as LossSamples max(Loss) as MaxLossPct perc95(Latency) as P95LatencyReported perc95(Jitter) as P95JitterReported by Device VDOM Check Interface''',
 'Device VDOM Check Interface Records LossSamples MaxLossPct P95LatencyReported P95JitterReported','Summarizes reported SD-WAN SLA probes with validated loss percentages.',
 'Loss is probe loss, not production traffic packet loss. Latency/jitter retain source units; verify the deployed FortiOS feed before comparing sources. Missing measurements stay unknown.',
 [event(subtype='sdwan',healthcheck='probe-a',interface='wan1',packetloss='5%',latency='12',vd='root'),event(subtype='sdwan',healthcheck='probe-a',interface='wan1',packetloss='200%',latency=-1,vd='root')],1,extra='max(MaxLossPct) as Loss',assertion='Loss=5',defaults=('Device','VDOM'))
add('Fortinet','fortinet_ips_actions','Fortinet - IPS Signature Actions',FGU,
 {**DEVICE,'Subtype':'subtype','Signature':'attack signature','Action':'action','Severity':'severity','VDOM':'vd vdom'},
 '| where lower(Subtype)="ips" AND isnotnull(Signature)\n| stats count as Records max(_time) as LastSeen by Device VDOM Signature Action Severity',
 'Device VDOM Signature Action Severity Records LastSeen','Summarizes FortiGate IPS signatures and their native actions.',
 'A detected/reset action is retained verbatim and does not prove a successful exploit or a blocked session across all layers.',
 [event(subtype='ips',attack='sig-1',action='detected',severity='high',vd='root'),event(subtype='webfilter',attack='sig-1')],1,defaults=('Device','VDOM','Action','Severity'))
add('Fortinet','fortinet_configuration_audit','Fortinet - Configuration Path Audit Activity',FGE,
 {**DEVICE,'Actor':'user','Path':'cfgpath','Object':'cfgobj','Action':'action','VDOM':'vd vdom'},
 '| where isnotnull(Path) AND isnotnull(Actor)\n| stats count as Records max(_time) as LastSeen by Device VDOM Actor Path Object Action',
 'Device VDOM Actor Path Object Action Records LastSeen','Lists parsed configuration audit activity by administrator and configuration path.',
 'Requires cfgpath audit records and enabled audit logging. Presence does not prove commit success, rollback or downstream impact.',
 [event(user='operator',cfgpath='firewall.policy',cfgobj='7',action='edit',vd='root'),event(user='operator',action='login')],1,defaults=('Device','VDOM','Object','Action'))
add('Fortinet','fortinet_application_risk','Fortinet - Reported High-Risk Application Activity',FGT,FGMAP,
 '| where lower(Risk) IN ("high","critical","elevated") AND isnotnull(Application)\n| stats count as Records dc(Source) as Sources by Device VDOM Application Risk',
 'Device VDOM Application Risk Records Sources','Ranks application records explicitly labeled high, critical or elevated risk.',
 'Risk is the vendor application classification, not a compromise verdict. Requires application-control enrichment; absent risk is not low risk.',
 [event(app='app-a',apprisk='high',vd='root',srcip='192.0.2.1'),event(app='app-a',apprisk='low',vd='root')],1,defaults=('Device','VDOM'))
# Juniper and Aruba: four Junos/SRX questions and two access-network questions.
JUN=src('juniper:junos:*','junos:*')
add('Juniper / Aruba','junos_srx_denials','Juniper - SRX Denied Flow Evidence',JUN,
 {**DEVICE,'Source':'src src_ip','Destination':'dest dest_ip','Rule':'rule rule_name','Reason':'reason'},
 '| where match(_raw,"\\bRT_FLOW_SESSION_DENY\\b")\n| stats count as Records max(_time) as LastSeen by Device Source Destination Rule Reason',
 'Device Source Destination Rule Reason Records LastSeen','Summarizes explicit SRX session-deny message evidence.',
 'Requires Junos RT_FLOW_SESSION_DENY and parsed CIM source/destination/rule fields for detailed context. Missing fields remain explicit; records are not unique denied sessions.',
 [event(_raw='RT_FLOW_SESSION_DENY: denied',src='192.0.2.1',dest='198.51.100.1',rule='rule-a'),event(_raw='RT_FLOW_SESSION_CREATE: created')],1,defaults=('Device','Source','Destination','Rule','Reason'))
add('Juniper / Aruba','junos_srx_close_reasons','Juniper - SRX Session Closure Reasons',JUN,
 {**DEVICE,'Reason':'reason session_end_reason','Application':'app application','Source':'src src_ip','Destination':'dest dest_ip'},
 '| where match(_raw,"\\bRT_FLOW_SESSION_CLOSE\\b")\n| stats count as Records dc(Source) as Sources dc(Destination) as Destinations by Device Reason Application',
 'Device Reason Application Records Sources Destinations','Separates reported SRX session-close reasons and application labels.',
 'A closed session is not automatically denied or failed. Reason/application fields need the selected Junos parser; unknown context is retained.',
 [event(_raw='RT_FLOW_SESSION_CLOSE: TCP FIN',reason='TCP FIN',app='https'),event(_raw='RT_FLOW_SESSION_DENY: denied')],1,defaults=('Device','Reason','Application'))
add('Juniper / Aruba','junos_bgp_state_messages','Juniper - BGP Neighbor State Messages',JUN,
 {**DEVICE,'Peer':'peer neighbor','RoutingInstance':'routing_instance'},
 '| where match(_raw,"\\bRPD_BGP_NEIGHBOR_STATE_CHANGED\\b")\n| stats count as Records max(_time) as LastSeen by Device RoutingInstance Peer',
 'Device RoutingInstance Peer Records LastSeen','Counts explicit Junos BGP neighbor-state messages.',
 'Requires enabled BGP state logging and extracted peer context. This is message recurrence, not an adjacency uptime or failover count.',
 [event(_raw='RPD_BGP_NEIGHBOR_STATE_CHANGED: neighbor 192.0.2.1 changed',peer='192.0.2.1'),event(_raw='BGP informational keepalive')],1,defaults=('Device','Peer','RoutingInstance'))
add('Juniper / Aruba','junos_commit_audit','Juniper - Configuration Commit Message Activity',JUN,
 {**DEVICE,'Actor':'user src_user'},
 '| rex field=_raw "(?<CommitMessage>UI_COMMIT_(?:COMPLETED|REQUESTED|PROGRESS|ERROR))\\b"\n| where isnotnull(CommitMessage)\n| stats count as Records max(_time) as LastSeen by Device Actor CommitMessage',
 'Device Actor CommitMessage Records LastSeen','Separates Junos commit request, progress, completion and error message families.',
 'Multiple messages can describe one operation. A request or progress message does not prove successful commit; no unique deployment count or impact is inferred.',
 [event(_raw='UI_COMMIT_COMPLETED: commit complete',user='operator'),event(_raw='UI_LOGIN_EVENT: login',user='operator')],1,defaults=('Device','Actor'))
add('Juniper / Aruba','aruba_authentication_failures','Aruba - Access Authentication Failure Evidence',src('aruba:syslog','aruba:clearpass*','aruba:central:*'),
 {**DEVICE,'Action':'action','Client':'src src_ip client_mac','AccessDevice':'dest nas_ip ap_name','Reason':'reason'},
 '| where lower(Action) IN ("failure","failed","reject","rejected")\n| stats count as Records dc(Client) as Clients by Device AccessDevice Reason',
 'Device AccessDevice Reason Records Clients','Ranks explicitly reported Aruba access-authentication failures.',
 'Requires authentication field normalization from the selected Aruba/ClearPass/Central feed. Not every Aruba syslog event exposes these fields, and rejection does not establish a wireless RF problem.',
 [event(action='failure',src='192.0.2.1',dest='ap-a',reason='credentials'),event(action='success',dest='ap-a')],1,defaults=('Device','AccessDevice','Reason'))
add('Juniper / Aruba','aruba_client_snr','Aruba - Client Signal-to-Noise Observations',src('aruba:central:*','aruba:client:*'),
 {**DEVICE,'Client':'macaddr client_mac mac','AP':'ap_name ap_mac','SNR':'snr'},
 '| eval SNR=tonumber(SNR)\n| where isnotnull(Client) AND SNR>=-30 AND SNR<=100\n| stats count as Records median(SNR) as MedianSNRdB min(SNR) as MinSNRdB max(_time) as LastSeen by Device AP Client',
 'Device AP Client Records MedianSNRdB MinSNRdB LastSeen','Summarizes client SNR samples from an exported Aruba client-metric feed.',
 'Requires flattened client metric records with snr in dB and a stable client MAC. Syslog alone is insufficient. Plausibility bounds -30..100 are editable; no RF health verdict or observed-client estate completeness is implied.',
 [event(macaddr='00:11:22:33:44:55',ap_name='ap-a',snr=20),event(macaddr='00:11:22:33:44:55',ap_name='ap-a',snr=200)],1,extra='min(MinSNRdB) as SNR',assertion='SNR=20',defaults=('Device','AP'),ref='https://arubanetworking.hpe.com/techdocs/new-central-review/content/extns/splunk/splunk-intro.htm')
# Counter deltas always retain invalid snapshots as markers. Otherwise last()
# skips NULL and can accidentally pair an old counter with a newer timestamp.
def counter_pipeline(in_alias,out_alias,multiplier,label):
    mapping={**DEVICE,'Interface':'interface intf_name ifName','In':in_alias,'Out':out_alias,'Discontinuity':'ifCounterDiscontinuityTime','Uptime':'sysUpTime'}
    body='''| where isnotnull(Interface) AND isnotnull(Device) AND Device!="Not reported"
| eval In=tonumber(In), Out=tonumber(Out)
| eval In=if(In>=0 AND In<=9007199254740991,In,null()), Out=if(Out>=0 AND Out<=9007199254740991,Out,null())
| eval InMarker=coalesce(tostring(In),"Unknown"), OutMarker=coalesce(tostring(Out),"Unknown"), DiscMarker=coalesce(Discontinuity,"Unknown"), UptimeMarker=coalesce(Uptime,"Unknown")
| stats values(InMarker) as Ins values(OutMarker) as Outs values(DiscMarker) as Discs values(UptimeMarker) as Uptimes by Device Interface _time
| eval InMarker=if(mvcount(Ins)=1,mvindex(Ins,0),"Unknown"), OutMarker=if(mvcount(Outs)=1,mvindex(Outs,0),"Unknown"), DiscMarker=if(mvcount(Discs)=1,mvindex(Discs,0),"Unknown"), UptimeMarker=if(mvcount(Uptimes)=1,mvindex(Uptimes,0),"Unknown")
| sort 0 _time Device Interface
| streamstats current=f last(InMarker) as PreviousIn last(OutMarker) as PreviousOut last(_time) as PreviousTime last(DiscMarker) as PreviousDisc last(UptimeMarker) as PreviousUptime by Device Interface
| eval Elapsed=_time-PreviousTime, In=tonumber(InMarker), Out=tonumber(OutMarker), PreviousIn=tonumber(PreviousIn), PreviousOut=tonumber(PreviousOut)
| eval ContinuitySafe=if(DiscMarker=PreviousDisc AND (UptimeMarker="Unknown" OR PreviousUptime="Unknown" OR tonumber(UptimeMarker)>=tonumber(PreviousUptime)),1,0), ContinuityUnverified=if(DiscMarker="Unknown" OR PreviousDisc="Unknown" OR UptimeMarker="Unknown" OR PreviousUptime="Unknown",1,0)
| eval InRate=if(Elapsed>0 AND Elapsed<=3600 AND In>=PreviousIn AND ContinuitySafe=1,(In-PreviousIn)*'''+str(multiplier)+'''/Elapsed,null()), OutRate=if(Elapsed>0 AND Elapsed<=3600 AND Out>=PreviousOut AND ContinuitySafe=1,(Out-PreviousOut)*'''+str(multiplier)+'''/Elapsed,null())
| where isnotnull(InRate) OR isnotnull(OutRate)
| stats count as Records sum(ContinuityUnverified) as ContinuityUnverifiedIntervals max(InRate) as PeakIn'''+label+''' max(OutRate) as PeakOut'''+label+''' max(_time) as LastSeen by Device Interface'''
    return mapping,body
# Standard IF-MIB counters provide a vendor-neutral interface investigation in
# addition to tagged CIM records; flattened data is an explicit prerequisite.
_if_mapping,_if_body=counter_pipeline('ifInErrors','ifOutErrors',1,'PerSecond')
neutral('interface_error_counter_rates','IF-MIB Interface Error Counter Rates',src('snmp','snmp:*'),_if_mapping,_if_body,
 'Device Interface Records ContinuityUnverifiedIntervals PeakInPerSecond PeakOutPerSecond LastSeen','Derives interface error rates from consecutive valid IF-MIB samples for any vendor.',
 'Requires flattened device/interface snapshots with ifInErrors and ifOutErrors counters plus stable dvc/host and ifName/interface. Raw numeric OID tables require mapping first. Missing/conflicting snapshots, resets, intervals over one hour and counters above exact double-integer range are excluded. No utilization or packet-loss percentage is inferred. Records counts valid intervals.',
 [event(ifName='Ethernet1',ifInErrors=100,ifOutErrors=200,_time={'expr':'now()-120'}),event(ifName='Ethernet1',ifInErrors=160,ifOutErrors=320,_time={'expr':'now()-60'}),event(ifName='Ethernet1',ifInErrors=10,ifOutErrors=20,_time={'expr':'now()-30'})],1,extra='max(PeakInPerSecond) as InRate max(PeakOutPerSecond) as OutRate',assertion='InRate=1 AND OutRate=2',defaults=('Device',),ref='traffic')
ENTRIES[-1]['ref']='https://datatracker.ietf.org/doc/html/rfc2863'

for slug,name,ia,oa,label,mul in [
 ('arista_interface_error_rates','Interface Error Counter Rates','ifInErrors inErrors','ifOutErrors outErrors','PerSecond',1),
 ('arista_interface_discard_rates','Interface Discard Counter Rates','ifInDiscards inDiscards','ifOutDiscards outDiscards','PerSecond',1),
 ('arista_interface_transfer_rates','Interface Octet Counter Rates','ifHCInOctets inOctets','ifHCOutOctets outOctets','Mbps',0.000008)]:
    mapping,body=counter_pipeline(ia,oa,mul,label)
    a,b=ia.split()[0],oa.split()[0]
    rows=[event(interface='Ethernet1',_time={'expr':'now()-180'},**{a:100,b:200}),event(interface='Ethernet1',_time={'expr':'now()-120'},**{a:160,b:320}),event(interface='Ethernet1',_time={'expr':'now()-60'},**{a:10,b:20})]
    add('Arista',slug,'Arista - '+name,src('arista:*'),mapping,body,
      'Device Interface Records ContinuityUnverifiedIntervals PeakIn'+label+' PeakOut'+label+' LastSeen','Derives '+name.lower()+' from successive same-interface samples.',
      'Requires flattened EOS/API or IF-MIB counters, not syslog. Equal timestamps collapse; conflicting/missing snapshots, counter decreases, reported discontinuities/uptime decreases, counter values above exact double-integer range and intervals over one hour are excluded per direction. No link utilization or capacity percentage is inferred. ContinuityUnverifiedIntervals flags missing discontinuity/uptime context, so unseen resets cannot be ruled out. Records counts valid intervals, not raw samples.',
      rows,1,extra='max(PeakIn'+label+') as InRate max(PeakOut'+label+') as OutRate',assertion=f'abs(InRate-{mul})<0.000000001 AND abs(OutRate-{2*mul})<0.000000001',defaults=('Device',))
add('Arista','arista_latest_interface_state','Arista - Latest Observed Interface State',src('arista:*'),
 {**DEVICE,'Interface':'interface ifName intf_name','State':'ifOperStatus linkStatus'},
 '''| where isnotnull(Interface) AND isnotnull(Device) AND Device!="Not reported"
| eventstats max(_time) as LatestObservation by Device Interface
| where _time=LatestObservation
| eval StateMarker=coalesce(State,"Not reported")
| stats count as Records values(StateMarker) as States max(_time) as LastSeen by Device Interface
| eval ObservedState=if(mvcount(States)=1,mvindex(States,0),"Conflicting states")''',
 'Device Interface ObservedState Records LastSeen','Keeps the latest selected-window interface-state observation, including missing and conflicting values.',
 'Requires a parsed interface/state metric feed. A historical latest observation is not a current reachability check; raw numeric IF-MIB codes remain source values.',
 [event(interface='Ethernet1',ifOperStatus='up',_time={'expr':'now()-120'}),event(interface='Ethernet1',_time={'expr':'now()-60'})],1,extra='values(ObservedState) as State',assertion='State="Not reported"',defaults=('Device',))
add('Arista','arista_bgp_adjacency_messages','Arista - BGP Adjacency Message Recurrence',src('arista:eos:*'),DEVICE,
 '| where match(_raw,"%(?:BGP|BGPAGENT)-[0-7]-(?:ADJCHANGE|STATECHANGE)\\b")\n| stats count as Records max(_time) as LastSeen by Device',
 'Device Records LastSeen','Counts matching EOS BGP adjacency/state syslog message families.',
 'Requires the matching message family and enabled logging. Message recurrence does not measure adjacency downtime or identify current neighbor state.',
 [event(_raw='%BGP-5-ADJCHANGE: neighbor 192.0.2.1 Down'),event(_raw='%SYS-5-INFO: normal message')],1,defaults=('Device',))
add('Arista','arista_lanz_queue_observations','Arista - LANZ Queue-Length Observations',src('arista:lanz*','arista:queue*'),
 {**DEVICE,'Interface':'intf_name interface','Queue':'queue_size queueSize'},
 '| eval Queue=tonumber(Queue)\n| where isnotnull(Interface) AND Queue>=0\n| stats count as Records max(Queue) as PeakReportedQueue median(Queue) as MedianReportedQueue max(_time) as LastSeen by Device Interface',
 'Device Interface Records PeakReportedQueue MedianReportedQueue LastSeen','Summarizes reported queue-length measurements from flattened LANZ exports.',
 'Requires a LANZ-to-event exporter exposing intf_name and queue_size. Raw protobuf is not decoded here. Queue units remain source units; do not reinterpret them as bytes, latency or percent utilization without exporter documentation.',
 [event(intf_name='Ethernet1',queue_size=0),event(intf_name='Ethernet1',queue_size=100),event(intf_name='Ethernet1',queue_size=-1)],2,extra='max(PeakReportedQueue) as Peak',assertion='Peak=100',defaults=('Device',),ref='https://www.arista.com/en/um-eos/eos-latency-analyzer-lanz?searchword=eos+section+10+1+overview')
# Check Point: current Log Exporter/syslog plus legacy cp_log, with format-specific
# extraction required. No dependency on the archived TA is installed or implied.
CP=src('cp_log','cp_log:syslog','checkpoint:*','cp:*')
CPMAP={**DEVICE,'Action':'action','Source':'src src_ip','Destination':'dst dest dest_ip','Rule':'rule_name rule rule_uid','Blade':'product product_family','Severity':'severity','Signature':'attack attack_name signature','Reason':'reason message','Operation':'operation','Actor':'administrator src_user user','TranslatedSource':'xlatesrc','TranslatedDestination':'xlatedst'}
add('Check Point','checkpoint_denied_services','Check Point - Denied Service Destinations',CP,{**CPMAP,'Service':'service dest_port'},DECISION+'''
| where Decision="Denied" AND isnotnull(Destination)
| stats count as Records dc(Source) as Sources by Device Destination Service Rule''',
 'Device Destination Service Rule Records Sources','Ranks explicit Check Point drop/reject/deny destinations and services.',
 'Requires normalized Log Exporter fields. Native actions remain explicit; duplicate log updates can inflate counts and no unique-session or exposure verdict is inferred.',
 [event(action='Drop',dst='198.51.100.1',service='https',rule_name='rule-a'),event(action='Accept',dst='198.51.100.1')],1,defaults=('Device','Service','Rule'))
add('Check Point','checkpoint_vpn_failure_evidence','Check Point - VPN Failure Evidence',CP,CPMAP,
 '| where match(Blade,"(?i)vpn") AND lower(Action) IN ("reject","failed","failure","drop")\n| stats count as Records max(_time) as LastSeen by Device Source Destination Reason',
 'Device Source Destination Reason Records LastSeen','Summarizes explicitly failed/rejected VPN-blade records.',
 'Requires VPN product/blade and parsed action; unrecognized labels are not classified. Records do not establish tunnel outage duration or current state.',
 [event(product='VPN-1',action='Reject',reason='authentication',src='192.0.2.1'),event(product='Firewall',action='Drop')],1,defaults=('Device','Source','Destination','Reason'))
add('Check Point','checkpoint_ips_signature_evidence','Check Point - IPS Signature Evidence',CP,CPMAP,
 '| where match(Blade,"(?i)(^|[^a-z])ips([^a-z]|$)|intrusion") AND isnotnull(Signature)\n| stats count as Records max(_time) as LastSeen by Device Signature Action Severity',
 'Device Signature Action Severity Records LastSeen','Groups Check Point IPS signatures with their native action and severity.',
 'Requires an IPS blade label and signature extraction. Prevent/detect actions are retained verbatim rather than treated as proof of exploit outcome.',
 [event(product='IPS',attack='sig-1',action='Prevent',severity='high'),event(product='Firewall',attack='sig-1')],1,defaults=('Device','Action','Severity'))
add('Check Point','checkpoint_policy_audit','Check Point - Policy Installation Audit Messages',CP,CPMAP,
 '| where match(Operation,"(?i)install.*policy|policy.*install")\n| stats count as Records max(_time) as LastSeen by Device Actor Operation Action',
 'Device Actor Operation Action Records LastSeen','Lists policy-installation audit operation records.',
 'Requires management audit logs and operation/administrator extraction, not only traffic logs. Operation presence is not confirmation of successful policy installation or impact.',
 [event(operation='Install Policy',administrator='operator',action='started'),event(operation='Login',administrator='operator')],1,defaults=('Device','Actor','Action'))
add('Check Point','checkpoint_nat_observed_addresses','Check Point - Observed NAT Address Pairs',CP,CPMAP,
 '''| eval SourceTranslated=if(cidrmatch("0.0.0.0/0",TranslatedSource) OR cidrmatch("::/0",TranslatedSource),TranslatedSource,null()), DestinationTranslated=if(cidrmatch("0.0.0.0/0",TranslatedDestination) OR cidrmatch("::/0",TranslatedDestination),TranslatedDestination,null())
| where (isnotnull(SourceTranslated) AND NOT SourceTranslated IN ("0.0.0.0","::")) OR (isnotnull(DestinationTranslated) AND NOT DestinationTranslated IN ("0.0.0.0","::"))
| eval SourceTranslated=coalesce(SourceTranslated,"Not reported"), DestinationTranslated=coalesce(DestinationTranslated,"Not reported")
| stats count as Records max(_time) as LastSeen by Device Source Destination SourceTranslated DestinationTranslated''',
 'Device Source Destination SourceTranslated DestinationTranslated Records LastSeen','Inventories explicitly reported translated source/destination address pairs.',
 'Requires xlatesrc/xlatedst exports. Original and translated columns follow vendor fields; this is not active translation count, available ports or capacity headroom.',
 [event(src='192.0.2.1',dst='198.51.100.1',xlatesrc='203.0.113.1'),event(src='192.0.2.1',xlatesrc='0.0.0.0')],1,defaults=('Device','Source','Destination'))
add('Check Point','checkpoint_rule_action_inventory','Check Point - Observed Rule Action Inventory',CP,CPMAP,
 '| where isnotnull(Rule)\n| stats count as Records dc(Source) as Sources dc(Destination) as Destinations max(_time) as LastSeen by Device Blade Rule Action',
 'Device Blade Rule Action Records Sources Destinations LastSeen','Shows observed native actions and endpoint diversity for identified Check Point rules.',
 'Only observed rules appear. Without configuration inventory and counters this cannot identify never-used or shadowed rules, or justify removal.',
 [event(rule_name='rule-a',action='Accept',product='Firewall',src='192.0.2.1'),event(action='Drop')],1,defaults=('Device','Blade','Action'))
# F5 covers delivery, policy, access and availability evidence using documented
# syslog/iRule source families. It does not require a proprietary pool lookup.
add('F5','f5_pool_member_health_messages','F5 - Pool Member Health Message Evidence',src('f5:bigip:syslog'),DEVICE,
 '| rex field=_raw "(?i)Pool (?<Pool>\\S+) member (?<Member>\\S+) monitor status (?<ReportedState>up|down)\\b"\n| where isnotnull(ReportedState)\n| stats count as Records max(_time) as LastSeen by Device Pool Member ReportedState',
 'Device Pool Member ReportedState Records LastSeen','Finds explicit pool-member monitor up/down syslog messages.',
 'Messages can repeat or be missing. This is monitor-state evidence, not application availability, current pool inventory or outage duration.',
 [event(_raw='Pool /Common/app member /Common/192.0.2.1:443 monitor status down.'),event(_raw='Pool /Common/app ordinary status message')],1,defaults=('Device',))
add('F5','f5_http_response_errors','F5 - HTTP Error Response Destinations',src('f5:bigip:ltm:http:irule'),
 {**DEVICE,'Status':'status http_status response_code','VirtualServer':'dest dest_ip virtual_server','Client':'src src_ip'},
 '| eval Status=tonumber(Status)\n| where Status>=400 AND Status<=599\n| stats count as Records dc(Client) as Clients by Device VirtualServer Status',
 'Device VirtualServer Status Records Clients','Separates 4xx and 5xx response evidence from BIG-IP HTTP iRule records.',
 'Requires the HTTP response iRule format and parsed status. 4xx is not necessarily a server fault, and proxy responses may not be origin responses.',
 [event(status=503,dest='192.0.2.10',src='192.0.2.1'),event(status=200,dest='192.0.2.10')],1,defaults=('Device','VirtualServer'))
add('F5','f5_waf_blocked_violations','F5 - WAF Blocked Violation Evidence',src('f5:bigip:asm:syslog'),
 {**DEVICE,'RequestStatus':'req_status request_status action','Policy':'policy_name','Violations':'violations','Client':'ip_client src_ip src'},
 '| where lower(RequestStatus) IN ("blocked","block")\n| stats count as Records dc(Client) as Clients by Device Policy Violations',
 'Device Policy Violations Records Clients','Groups ASM request records explicitly reporting a blocked result.',
 'Requires an ASM logging profile containing request status, policy and violations. A combined violation label stays one record; it is not expanded into artificial attack counts.',
 [event(req_status='blocked',policy_name='policy-a',violations='Illegal method',ip_client='192.0.2.1'),event(req_status='passed',policy_name='policy-a')],1,defaults=('Device','Policy','Violations'),ref='https://splunk.github.io/splunk-add-on-for-f5-big-ip/Storage_Format_Reference/')
add('F5','f5_apm_access_denials','F5 - APM Access Policy Denials',src('f5:bigip:apm:syslog'),
 {**DEVICE,'Result':'result action','Policy':'policy policy_name','User':'user username'},
 '| rex field=_raw "(?i)Access policy result:\\s*(?<NativeResult>\\w+)"\n| eval Outcome=lower(coalesce(Result,NativeResult))\n| where Outcome IN ("deny","denied","reject","rejected")\n| stats count as Records dc(User) as Users by Device Policy Outcome',
 'Device Policy Outcome Records Users','Finds explicitly denied APM access-policy results.',
 'Requires APM policy-result events. A denied policy result is not proof of a failed tunnel or application outage; one session may generate multiple records.',
 [event(_raw='Access policy result: Deny',policy='policy-a',user='alice'),event(_raw='Access policy result: Allow',policy='policy-a')],1,defaults=('Device','Policy'))
add('F5','f5_tls_handshake_failures','F5 - TLS Handshake Failure Evidence',src('f5:bigip:ltm:ssl:error','f5:bigip:syslog'),
 {**DEVICE,'Client':'src src_ip','VirtualServer':'dest dest_ip'},
 '| where sourcetype="f5:bigip:ltm:ssl:error" OR match(_raw,"(?i)(?:ssl|tls).*handshake.*fail")\n| stats count as Records max(_time) as LastSeen by Device Client VirtualServer',
 'Device Client VirtualServer Records LastSeen','Summarizes dedicated TLS error records or explicit handshake-failure messages.',
 'Requires SSL/TLS failure logging. Scanners, unsupported protocols and certificate problems can all produce failures; no cause or service-wide failure rate is inferred.',
 [event(sourcetype='f5:bigip:ltm:ssl:error',src='192.0.2.1',dest='192.0.2.10'),event(sourcetype='f5:bigip:syslog',_raw='normal traffic')],1,defaults=('Device','Client','VirtualServer'))
add('F5','f5_ha_role_messages','F5 - High-Availability Role Message Evidence',src('f5:bigip:syslog'),DEVICE,
 '| rex field=_raw "(?i)(?:failover|redundancy).*?\\b(?<RoleKeyword>active|standby|offline)\\b"\n| where isnotnull(RoleKeyword)\n| eval RoleKeyword=lower(RoleKeyword)\n| stats count as Records max(_time) as LastSeen by Device RoleKeyword',
 'Device RoleKeyword Records LastSeen','Finds HA/failover messages containing an explicit role keyword.',
 'The keyword is message context, not verified current role or a counted failover. Planned maintenance and informational messages require interpretation.',
 [event(_raw='Failover state active'),event(_raw='Ordinary active application connection')],1,defaults=('Device',))
# Six Zscaler investigations beyond existing app-access, blocked-reason and
# connection-status workspace searches. Native status never implies policy allow.
ZWEB=src('zscalernss-web','zscaler:zia:web','zscaler:zia:web:*')
ZPA=src('zscalerlss-zpa-app','zscaler:zpa:user_activity','zscaler:zpa:app')
add('Zscaler','zscaler_zia_http_errors','Zscaler - ZIA HTTP Response Error Evidence',ZWEB,
 {**DEVICE,'Status':'status respcode responsecode','Destination':'dest_host dest host_name','Client':'src_ip src cip'},
 '| eval Status=tonumber(Status)\n| where Status>=400 AND Status<=599\n| stats count as Records dc(Client) as Clients by Device Destination Status',
 'Device Destination Status Records Clients','Separates reported ZIA 4xx/5xx response codes by destination.',
 'Requires response-code fields in the NSS feed. These may be proxy-generated responses; no origin-outage or policy-effectiveness conclusion is inferred.',
 [event(respcode=503,dest_host='app.example.test',cip='192.0.2.1'),event(respcode=200,dest_host='app.example.test')],1,defaults=('Device','Destination'))
add('Zscaler','zscaler_zia_transfer_sizes','Zscaler - ZIA Reported Request and Response Sizes',ZWEB,
 {**DEVICE,'User':'user login','Application':'app appname','RequestBytes':'reqsize bytes_out','ResponseBytes':'respsize bytes_in'},
 '''| eval RequestBytes=tonumber(RequestBytes), ResponseBytes=tonumber(ResponseBytes)
| eval RequestBytes=if(RequestBytes>=0,RequestBytes,null()), ResponseBytes=if(ResponseBytes>=0,ResponseBytes,null())
| where isnotnull(RequestBytes) OR isnotnull(ResponseBytes)
| stats count as Records count(RequestBytes) as RequestMeasurements count(ResponseBytes) as ResponseMeasurements sum(RequestBytes) as RequestBytes sum(ResponseBytes) as ResponseBytes by Device User Application
| eval RequestBytes=if(RequestMeasurements>0,RequestBytes,null()), ResponseBytes=if(ResponseMeasurements>0,ResponseBytes,null())''',
 'Device User Application Records RequestMeasurements ResponseMeasurements RequestBytes ResponseBytes','Aggregates valid reported HTTP request/response byte measurements.',
 'Requires request/response sizes from the chosen NSS format. Missing directions remain unknown, not zero. Proxy record volumes are not unique sessions or endpoint exfiltration proof.',
 [event(login='alice',appname='app-a',reqsize=0,respsize=500),event(login='alice',appname='app-a',reqsize=-1,respsize=-1)],1,extra='sum(ResponseBytes) as Bytes',assertion='Bytes=500',defaults=('Device','User','Application'))
add('Zscaler','zscaler_zpa_server_setup','Zscaler - ZPA Server Setup Measurement Summary',ZPA,
 {**DEVICE,'Application':'Application application','Connector':'Connector connector','Setup':'ServerSetupTime'},
 '| eval Setup=tonumber(Setup)\n| where Setup>=0 AND isnotnull(Application)\n| stats count as Records median(Setup) as MedianSetupReported perc95(Setup) as P95SetupReported max(Setup) as MaxSetupReported by Device Application Connector',
 'Device Application Connector Records MedianSetupReported P95SetupReported MaxSetupReported','Summarizes valid ZPA server-setup measurements per application and connector.',
 'Requires ServerSetupTime in exported user-activity records. Values stay in source units; verify deployed-format units before SLO comparison. Missing/negative values are excluded and no outage or response-time decomposition is inferred.',
 [event(Application='app-a',Connector='connector-a',ServerSetupTime=20),event(Application='app-a',Connector='connector-a',ServerSetupTime=-1)],1,extra='max(MaxSetupReported) as Setup',assertion='Setup=20',defaults=('Device','Connector'))
add('Zscaler','zscaler_zpa_public_ip_changes','Zscaler - ZPA User Public-IP Diversity',ZPA,
 {**DEVICE,'User':'Username user','PublicIP':'ClientPublicIP','Application':'Application application'},
 '''| where isnotnull(User) AND (cidrmatch("0.0.0.0/0",PublicIP) OR cidrmatch("::/0",PublicIP))
| bin _time span=15m
| stats count as Records dc(PublicIP) as PublicIPs by User Application _time
| where PublicIPs>=3''',
 '_time User Application Records PublicIPs','Finds users whose ZPA activity reports three or more ClientPublicIP values in fifteen minutes.',
 'Public is the vendor field name, not an independent routability verdict. Roaming, NAT and proxies can cause diversity; no impossible-travel or compromise verdict is inferred.',
 [event(Username='alice',Application='app-a',ClientPublicIP=f'192.0.2.{i}') for i in range(1,4)]+[event(Username='alice',Application='app-a',ClientPublicIP='invalid')],3,extra='max(PublicIPs) as N',assertion='N=3',defaults=('Application',))
add('Zscaler','zscaler_zpa_private_ip_visibility','Zscaler - ZPA Private-IP Field Visibility',ZPA,
 {**DEVICE,'Connector':'Connector connector','PrivateIP':'ClientPrivateIP'},
 '''| eval KnownPrivateIP=if(cidrmatch("0.0.0.0/0",PrivateIP) OR cidrmatch("::/0",PrivateIP),1,0)
| stats count as Records sum(KnownPrivateIP) as ValidAddressRecords by Device Connector
| eval UnknownAddressRecords=Records-ValidAddressRecords, AddressReportedPct=round(100*ValidAddressRecords/Records,2)''',
 'Device Connector Records ValidAddressRecords UnknownAddressRecords AddressReportedPct','Measures valid ClientPrivateIP reporting in observed ZPA activity records.',
 'A syntactically valid ClientPrivateIP is not necessarily RFC1918/private. Missing values may be normal for a deployment; this is field visibility, not protected-user coverage.',
 [event(Connector='connector-a',ClientPrivateIP='10.0.0.1'),event(Connector='connector-a',ClientPrivateIP='')],2,extra='sum(ValidAddressRecords) as N',assertion='N=1',defaults=('Device','Connector'))
add('Zscaler','zscaler_zpa_encryption_labels','Zscaler - ZPA Double-Encryption Label Mix',ZPA,
 {**DEVICE,'Application':'Application application','Encryption':'DoubleEncryption'},
 '| eval ReportedLabel=if(Encryption IN ("0","1"),Encryption,"Unknown")\n| stats count as Records by Device Application ReportedLabel',
 'Device Application ReportedLabel Records','Shows the distribution of exported DoubleEncryption labels without inventing missing state.',
 'The native 0/1 label is not a TLS validation, policy compliance or end-to-end encryption verdict. Consult the deployed ZPA field definition before interpretation.',
 [event(Application='app-a',DoubleEncryption=1),event(Application='app-a',DoubleEncryption=7)],2,groups=2,extra='count(eval(ReportedLabel="Unknown")) as UnknownGroups',assertion='UnknownGroups=1',defaults=('Device','Application'))
# Infoblox uses explicit source predicates and CIM-compatible field contracts.
# Historical NIOS query-only mappings must not synthesize response evidence.
IBDNS=src('infoblox:dns','ib:dns')
for slug,name,code,key in [('infoblox_nxdomain_clients','NXDOMAIN Client Evidence','NXDOMAIN','Client'),('infoblox_servfail_resolvers','SERVFAIL Resolver Evidence','SERVFAIL','Resolver')]:
    add('Infoblox',slug,'Infoblox - '+name,IBDNS,DNS,DNSCODE+f'\n| where Code="{code}" AND isnotnull({key})\n| stats count as Records dc(Query) as Queries max(_time) as LastSeen by Device {key}',
      f'Device {key} Records Queries LastSeen',f'Ranks explicit Infoblox {code} response observations.',
      'Requires parsed client/resolver/query and reply_code or reply_code_id from response data. Historical query-only NIOS mappings cannot establish response outcomes; no silent response inference is made.',
      [event(src='192.0.2.1',dest='192.0.2.53',query='example.test',reply_code=code),event(src='192.0.2.1',dest='192.0.2.53',query='example.test')],1,defaults=('Device',))
add('Infoblox','infoblox_threat_actions','Infoblox - Threat-Protection Action Evidence',src('infoblox:threatprotect','infoblox:threat*'),
 {**DEVICE,'Action':'action','Client':'src src_ip','Signature':'signature threat_type rule_name'},
 '| where isnotnull(Action)\n| stats count as Records dc(Client) as Clients by Device Signature Action',
 'Device Signature Action Records Clients','Groups native threat-protection action records and signature context.',
 'Requires parsed action fields in threat-protection exports. Actions remain verbatim; an alert does not prove a blocked DNS response or confirmed compromise.',
 [event(action='DROP',signature='rule-a',src='192.0.2.1'),event(signature='rule-a')],1,defaults=('Device','Signature'))
add('Infoblox','infoblox_query_name_diversity','Infoblox - Client Query-Name Diversity Candidates',IBDNS,DNS,
 '| where isnotnull(Client) AND isnotnull(Query)\n| eval Query=lower(replace(Query,"\\.$",""))\n| bin _time span=15m\n| stats count as Records dc(Query) as QueryNames by Device Client _time\n| where QueryNames>=50',
 '_time Device Client Records QueryNames','Finds clients with fifty or more distinct observed query names in fifteen minutes.',
 'Names are case-normalized and one trailing dot is removed. Resolver aggregation, browsers and service discovery can be legitimate; this is not DGA or tunneling proof.',
 [event(src='192.0.2.1',query=f'name{i}.example.test.') for i in range(50)]+[event(src='192.0.2.2')],50,extra='max(QueryNames) as N',assertion='N=50',defaults=('Device',))
add('Infoblox','infoblox_txt_null_queries','Infoblox - TXT and NULL Query Activity',IBDNS,DNS,
 '| where upper(QueryType) IN ("TXT","NULL","16","10") AND isnotnull(Client)\n| stats count as Records dc(Query) as QueryNames by Device Client QueryType',
 'Device Client QueryType Records QueryNames','Inventories observed Infoblox TXT/NULL query-type activity.',
 'TXT is widely used legitimately. Query type and volume alone do not establish tunneling; query/response duplicates affect record counts.',
 [event(src='192.0.2.1',query_type='TXT',query='example.test'),event(src='192.0.2.1',query_type='A',query='example.test')],1,defaults=('Device',))
add('Infoblox','infoblox_dhcp_nak_messages','Infoblox - DHCPv4 NAK Message Evidence',src('infoblox:dhcp'),DEVICE,
 '| where match(_raw,"\\bDHCPNAK\\b")\n| rex field=_raw "(?i)DHCPNAK on (?<LeaseAddress>[0-9.]+) to (?<ClientMAC>[0-9a-f:]+)"\n| eval LeaseAddress=coalesce(LeaseAddress,"Not reported"), ClientMAC=coalesce(lower(ClientMAC),"Not reported")\n| stats count as Records max(_time) as LastSeen by Device ClientMAC LeaseAddress',
 'Device ClientMAC LeaseAddress Records LastSeen','Counts explicit DHCPv4 NAK message evidence with available lease/client context.',
 'A NAK can follow a client moving between networks. Message counts do not prove address-pool exhaustion, allocation failure rate or a DHCP outage.',
 [event(_raw='DHCPNAK on 192.0.2.1 to aa:bb:cc:dd:ee:ff via eth0'),event(_raw='DHCPACK on 192.0.2.2 to aa:bb:cc:dd:ee:ff')],1,defaults=('Device',))
# CrowdStrike FDR requires sensor events, not detection-only Event Streams.
CS=src('crowdstrike:events:sensor','crowdstrike:events:sensor:*')
CSMAP={'Agent':'aid','Kind':'event_simpleName','Remote':'dest_ip dest RemoteAddressIP4 RemoteAddressIP6','Port':'dest_port RemotePort RemotePort_decimal','Local':'src_ip src LocalAddressIP4 LocalAddressIP6','LocalPort':'LocalPort LocalPort_decimal','Context':'ContextProcessId ContextProcessId_decimal','Target':'TargetProcessId TargetProcessId_decimal','ProcessFile':'FileName','Domain':'DomainName'}
CSIP='| where cidrmatch("0.0.0.0/0",Remote) OR cidrmatch("::/0",Remote)'
add('CrowdStrike','crowdstrike_process_destinations','CrowdStrike - Process and Destination Evidence',CS,CSMAP,
 '''| eval IsNetwork=if(Kind IN ("NetworkConnectIP4","NetworkConnectIP6"),1,0), IsProcess=if(Kind="ProcessRollup2",1,0)
| eval ProcessKey=if(IsProcess=1,Target,Context)
| where isnotnull(Agent) AND isnotnull(ProcessKey) AND (IsNetwork=1 OR IsProcess=1)
| eventstats values(eval(if(IsProcess=1,ProcessFile,null()))) as ProcessNames by Agent ProcessKey
| where IsNetwork=1 AND (cidrmatch("0.0.0.0/0",Remote) OR cidrmatch("::/0",Remote))
| eval ProcessName=case(mvcount(ProcessNames)=1,mvindex(ProcessNames,0),mvcount(ProcessNames)>1,"Conflicting process context",true(),"Process record not observed"), Port=coalesce(Port,"Not reported")
| stats count as Records max(_time) as LastSeen by Agent ProcessKey ProcessName Remote Port''',
 'Agent ProcessKey ProcessName Remote Port Records LastSeen','Correlates FDR network-connect records with observed process-rollup context using agent and process identifiers.',
 'Requires FDR NetworkConnectIP4/6 and ProcessRollup2 with aid and stable ContextProcessId/TargetProcessId. These are sensor process identifiers, not an OS PID-only join. Conflicting/missing context remains explicit; rollup availability is limited to the selected window. Address aliases must be valid textual IPs matching the event family; invalid or wrong-family aliases cannot mask a valid later address. Raw integer-encoded IPs require add-on normalization. No destination reputation or successful application request is inferred.',
 [event(aid='agent-a',event_simpleName='ProcessRollup2',TargetProcessId='100',FileName='curl'),event(aid='agent-a',event_simpleName='NetworkConnectIP4',ContextProcessId='100',RemoteAddressIP4='198.51.100.1',RemotePort=443),event(aid='agent-b',event_simpleName='ProcessRollup2',TargetProcessId='100',FileName='other')],1,extra='values(ProcessName) as ProcessName',assertion='ProcessName="curl"',ip_targets=('Remote',),family_field='event_simpleName',version='1.0.1')
add('CrowdStrike','crowdstrike_blocked_network_events','CrowdStrike - Blocked Network Event Evidence',CS,CSMAP,
 '| where Kind IN ("NetworkConnectIP4Blocked","NetworkConnectIP6Blocked") AND isnotnull(Agent)\n| eval Remote=coalesce(Remote,"Not reported"), Port=coalesce(Port,"Not reported")\n| stats count as Records max(_time) as LastSeen by Agent Remote Port Kind',
 'Agent Remote Port Kind Records LastSeen','Summarizes explicit FDR blocked-network event families.',
 'Requires the relevant sensor event exports. Address aliases are validated against the event IP family; unavailable addresses remain Not reported. Blocked records do not represent every prevented connection or establish compromise; absent exports are not a successful-protection verdict.',
 [event(aid='agent-a',event_simpleName='NetworkConnectIP4Blocked',RemoteAddressIP4='198.51.100.1',RemotePort=443),event(aid='agent-a',event_simpleName='NetworkConnectIP4',RemoteAddressIP4='198.51.100.1')],1,ip_targets=('Remote',),family_field='event_simpleName',version='1.0.1')
add('CrowdStrike','crowdstrike_dns_process_context','CrowdStrike - DNS Names by Sensor Process Context',CS,CSMAP,
 '| where Kind="DnsRequest" AND isnotnull(Agent) AND isnotnull(Domain)\n| eval Domain=lower(replace(Domain,"\\.$","")), Context=coalesce(Context,"Not reported")\n| stats count as Records dc(Domain) as QueryNames max(_time) as LastSeen by Agent Context',
 'Agent Context Records QueryNames LastSeen','Measures observed DNS-name diversity by agent and sensor process context.',
 'Requires FDR DnsRequest and DomainName fields. A request is not a response or successful resolution; process context without rollup is an identifier, not a process-name attribution.',
 [event(aid='agent-a',event_simpleName='DnsRequest',DomainName='Example.test.',ContextProcessId='100'),event(aid='agent-a',event_simpleName='NetworkConnectIP4')],1,extra='max(QueryNames) as N',assertion='N=1')
add('CrowdStrike','crowdstrike_ipv6_destinations','CrowdStrike - Observed IPv6 Destinations',CS,CSMAP,
 '| where Kind="NetworkConnectIP6" AND isnotnull(Agent) AND cidrmatch("::/0",Remote)\n| eval Port=coalesce(Port,"Not reported")\n| stats count as Records dc(Agent) as Agents max(_time) as LastSeen by Remote Port',
 'Remote Port Records Agents LastSeen','Inventories valid IPv6 destinations observed in FDR IPv6 connect events.',
 'Requires normalized textual IPv6 addresses. Invalid and wrong-family aliases are skipped before choosing the first valid IPv6 address. Event presence is not proof of policy allowance, complete IPv6 monitoring or successful application access.',
 [event(aid='agent-a',event_simpleName='NetworkConnectIP6',RemoteAddressIP6='2001:db8::1',RemotePort=443),event(aid='agent-a',event_simpleName='NetworkConnectIP6',RemoteAddressIP6='aa:bb:cc:dd:ee:ff')],1,ip_targets=('Remote',),family_field='event_simpleName',version='1.0.1')
add('CrowdStrike','crowdstrike_network_listeners','CrowdStrike - Reported Network Listener Ports',CS,CSMAP,
 '| eval LocalPort=tonumber(LocalPort)\n| where Kind IN ("NetworkListenIP4","NetworkListenIP6") AND isnotnull(Agent) AND LocalPort>=0 AND LocalPort<=65535\n| eval Local=coalesce(Local,"Not reported"), Context=coalesce(Context,"Not reported")\n| stats count as Records max(_time) as LastSeen by Agent Local LocalPort Context',
 'Agent Local LocalPort Context Records LastSeen','Lists observed FDR listener events by agent, address, port and process context.',
 'Address aliases are validated against the event IP family; unspecified bind addresses remain valid. Listener events do not establish current listeners, remote reachability or firewall exposure. Requires the relevant sensor event families; port zero remains a reported value.',
 [event(aid='agent-a',event_simpleName='NetworkListenIP4',LocalAddressIP4='0.0.0.0',LocalPort=443),event(aid='agent-a',event_simpleName='NetworkListenIP4',LocalPort=70000)],1,ip_targets=('Local',),family_field='event_simpleName',version='1.0.1')
add('CrowdStrike','crowdstrike_containment_activity','CrowdStrike - Network Containment Completion Activity',CS,CSMAP,
 '| where Kind IN ("NetworkContainmentCompleted","NetworkUncontainmentCompleted") AND isnotnull(Agent)\n| stats count as Records max(_time) as LastSeen by Agent Kind',
 'Agent Kind Records LastSeen','Separates reported network containment and uncontainment completion events.',
 'Completion messages are historical observations, not a verified current containment state or proof that every interface was isolated. Missing events remain outside the observed window.',
 [event(aid='agent-a',event_simpleName='NetworkContainmentCompleted'),event(aid='agent-a',event_simpleName='SensorHeartbeat')],1)
# Microsoft accepts direct advanced-hunting rows and the exported properties
# envelope. It does not run KQL or collect data from a Microsoft API.
MS=src('ms365:defender:incident:advanced_hunting','m365:defender:advancedhunting','ms:defender:advancedhunting')
MSMAP={'Device':'properties.DeviceId DeviceId','DeviceName':'properties.DeviceName DeviceName','Kind':'properties.ActionType ActionType','Category':'category','Remote':'properties.RemoteIP RemoteIP','Port':'properties.RemotePort RemotePort','RemoteType':'properties.RemoteIPType RemoteIPType','Process':'properties.InitiatingProcessFileName InitiatingProcessFileName','RemoteSession':'properties.IsInitiatingProcessRemoteSession IsInitiatingProcessRemoteSession','SessionSource':'properties.InitiatingProcessRemoteSessionIP InitiatingProcessRemoteSessionIP'}
MSNETWORK='| where (isnull(Category) OR Category="AdvancedHunting-DeviceNetworkEvents") AND isnotnull(Device)'
MSVALID='| where cidrmatch("0.0.0.0/0",Remote) OR cidrmatch("::/0",Remote)'
add('Microsoft','defender_process_connections','Microsoft Defender - Process Network Event Inventory',MS,MSMAP,
 MSNETWORK+'\n'+MSVALID+'\n| eval Port=coalesce(Port,"Not reported")\n| stats count as Records max(_time) as LastSeen by Device Process Remote Port Kind',
 'Device Process Remote Port Kind Records LastSeen','Inventories exported DeviceNetworkEvents by initiating process and destination.',
 'Requires the advanced-hunting network-event export, not incident alerts alone. Process context is reported by Defender; connection-related events are not necessarily successful application requests.',
 [event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP='198.51.100.1',RemotePort=443,InitiatingProcessFileName='curl'),event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP='invalid')],1,defaults=('Process','Kind'))
add('Microsoft','defender_connection_failures','Microsoft Defender - Connection Failure Destinations',MS,MSMAP,
 MSNETWORK+'\n| where Kind="ConnectionFailed"\n| eval Remote=coalesce(Remote,"Not reported"), Port=coalesce(Port,"Not reported")\n| stats count as Records max(_time) as LastSeen by Device Process Remote Port',
 'Device Process Remote Port Records LastSeen','Ranks explicitly exported ConnectionFailed events by process and destination.',
 'A failed connection can have many causes; this is not a firewall-denial, service outage or packet-loss measurement. Requires network-event exports with the selected ActionType.',
 [event(DeviceId='device-a',ActionType='ConnectionFailed',RemoteIP='198.51.100.1',RemotePort=443,InitiatingProcessFileName='curl'),event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP='198.51.100.1')],1,defaults=('Process',))
add('Microsoft','defender_network_protection_blocks','Microsoft Defender - Network Protection Block Evidence',MS,MSMAP,
 '| where isnotnull(Device) AND Kind="ExploitGuardNetworkProtectionBlocked"\n| eval Remote=coalesce(Remote,"Not reported")\n| stats count as Records max(_time) as LastSeen by Device Process Remote',
 'Device Process Remote Records LastSeen','Summarizes explicit Network Protection blocked-action records.',
 'This ActionType can arrive through DeviceEvents rather than DeviceNetworkEvents. The correct export must be enabled; a block record is not proof of compromise or complete protection coverage.',
 [event(**{'properties.DeviceId':'device-a','properties.ActionType':'ExploitGuardNetworkProtectionBlocked','properties.RemoteIP':'198.51.100.1','properties.InitiatingProcessFileName':'browser'},category='AdvancedHunting-DeviceEvents'),event(DeviceId='device-a',ActionType='ConnectionSuccess')],1,defaults=('Process',))
add('Microsoft','defender_remote_administration','Microsoft Defender - Remote Administration Connection Events',MS,MSMAP,
 MSNETWORK+'\n'+MSVALID+'\n| eval Port=tonumber(Port)\n| where Port IN (22,3389,445,5985,5986)\n| stats count as Records max(_time) as LastSeen by Device Process Remote Port Kind',
 'Device Process Remote Port Kind Records LastSeen','Inventories endpoint network events targeting common remote-administration ports.',
 'Port number is not application identity, policy allowance, unauthorized access or a successful interactive session. ActionType remains explicit.',
 [event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP='198.51.100.1',RemotePort=3389,InitiatingProcessFileName='mstsc'),event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP='198.51.100.1',RemotePort=443)],1,defaults=('Process','Kind'))
add('Microsoft','defender_public_destination_fanout','Microsoft Defender - Reported Public-Destination Fan-out',MS,MSMAP,
 MSNETWORK+'\n'+MSVALID+'''
| where RemoteType="Public"
| bin _time span=15m
| stats count as Records dc(Remote) as Destinations by Device Process _time
| where Destinations>=20''',
 '_time Device Process Records Destinations','Finds process records involving twenty or more destinations labeled Public by Defender in fifteen minutes.',
 'Public is Defender source classification, not an independently maintained address/routability inventory. Browsers, proxies and updates can be legitimate; this is a review threshold, not a scan verdict.',
 [event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP=f'198.51.100.{i}',RemoteIPType='Public',InitiatingProcessFileName='browser') for i in range(1,21)]+[event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP='10.0.0.1',RemoteIPType='Private',InitiatingProcessFileName='browser')],20,extra='max(Destinations) as N',assertion='N=20',defaults=('Process',))
add('Microsoft','defender_remote_session_networking','Microsoft Defender - Network Activity from Remote-Session Processes',MS,MSMAP,
 MSNETWORK+'\n| where lower(RemoteSession) IN ("true","1")\n| eval Remote=coalesce(Remote,"Not reported"), SessionSource=coalesce(SessionSource,"Not reported")\n| stats count as Records max(_time) as LastSeen by Device Process SessionSource Remote Kind',
 'Device Process SessionSource Remote Kind Records LastSeen','Shows network events whose initiating process is explicitly reported as running in a remote session.',
 'Requires IsInitiatingProcessRemoteSession and optional remote-session IP fields. This is process-session context, not proof of malicious RDP, current login sessions or lateral movement.',
 [event(DeviceId='device-a',ActionType='ConnectionSuccess',RemoteIP='198.51.100.1',IsInitiatingProcessRemoteSession='true',InitiatingProcessRemoteSessionIP='192.0.2.1',InitiatingProcessFileName='curl'),event(DeviceId='device-a',ActionType='ConnectionSuccess',IsInitiatingProcessRemoteSession='false')],1,defaults=('Process','Kind'))

def render():
    assert len(ENTRIES)==80,len(ENTRIES)
    counts=collections.Counter(e['group'] for e in ENTRIES)
    assert counts.pop('Vendor neutral')==20 and len(counts)==10 and set(counts.values())=={6},counts
    chunks=[]
    for e in ENTRIES:
        category='Network' if e['group']=='Vendor neutral' else 'Security'
        if e['group'] in ('Arista','Juniper / Aruba','F5','Infoblox'):category='Network'
        metadata=[('search_name',e['name']),('search_author','akhamis'),('updated_author','akhamis'),('version',e['version']),('date_created','2026-10-27'),('date_updated','2026-10-27'),('category',category),('sub_category','Multivendor Networking'),('tags',e['group']+',Multivendor,Networking'),('dispatch_context','splunk-cisco-dashboards'),('dispatch_context_force','1'),('search_hidden','0'),('default_viz','splunk.table'),('viz_options','{"showRowNumbers":true}')]
        metadata.extend((k,'<p>'+html.escape(v,quote=False)+'</p>') for k,v in [
            ('description',e['description']),('explanation',COMMON+e['limits']),
            ('solution','Use a finite time window and confirm source fields and configured index routing before interpreting results. These optional catalogue searches create no scheduled jobs or collectors. Output is limited to 1,000 groups; TotalGroups and RowsTruncated disclose omitted groups.'),
            ('related_info','Source contract: '+e['source']+'. Input aliases: '+json.dumps(e['fields'],sort_keys=True)+'. Source reference: '+e['ref']+'. Synthetic SPL tests are separate from deployed-vendor qualification.')])
        chunks.append('['+e['id']+']\n'+'\n'.join(k+' = '+v for k,v in metadata)+'\nsearch = '+e['query'].replace('\n','\\\n'))
    return '\n\n'.join(chunks)+'\n'

def render_docs():
    lines=['# Multivendor networking search library','',
      'This catalogue adds 80 optional investigations: 20 vendor-neutral searches and six for each of ten vendor ecosystems. The definitions are independent SPL searches in `searchbase.conf`; the authoring generator is not a runtime dependency. Existing workspace layouts, macros, collectors and schedules are preserved.','',
      'In the workspace picker choose Entire catalogue and enable Show table searches and Show drill-down searches. Search by the human names below. Each Searchbase entry includes the exact source predicate, input aliases, primary reference and interpretation limits.','',
      'Input fields must already be extracted by the deployed add-on or exporter. Source availability, parsing, synthetic SPL tests, installed catalogue visibility and real-vendor qualification are separate checks. Missing feeds are not repaired or silently replaced by a different population. All searches use existing index macros and permissions, finite picker windows, and a 1,000-group output cap with TotalGroups and RowsTruncated.','',
      'The 1,000-group limit bounds returned rows, not scanned events or grouping memory. Raw scan cost grows with matching records; ordered counter calculations also sort them, and endpoint process correlation retains state per agent/process key. Start short on busy feeds, use selective source scopes, and qualify production load separately. No new background jobs or per-row search fan-out are created.','',
      'Counter measurements require stable device/interface keys and successive valid samples. Missing/conflicting snapshots, counter decreases, reported discontinuities/uptime decreases, intervals over one hour and counters beyond exact integer precision are excluded. ContinuityUnverifiedIntervals identifies intervals without full reset context; an unobserved reset can still affect rates. No traffic-only capacity, never-used-rule, confirmed-attack or outage verdict is inferred.','']
    for group in dict.fromkeys(e['group'] for e in ENTRIES):
        rows=[e for e in ENTRIES if e['group']==group]
        lines.extend(['## '+group+' ('+str(len(rows))+')','', '| Search | Stanza | Input requirements and interpretation |','| --- | --- | --- |'])
        for e in rows:
            limit=e['limits'].replace('|','\\|')
            lines.append('| '+e['name']+' | `'+e['id']+'` | '+limit+' [Source reference]('+e['ref']+') |')
        lines.append('')
    lines.extend(['## Reproduce the catalogue and tests','',
      'From the repository root, run `python3 scripts/generate_multivendor_search_library.py --check` to compare generated definitions with the catalogue, `node scripts/generate_multivendor_fixtures.cjs --extended` to emit 171 read-only native-SPL cases, and `yarn test` for repository contracts. Submit fixture queries in Splunk Search and require TestPassed=1. The helper never contacts Splunk, creates saved searches, writes indexed data or reads credentials.','',
      'The generator owns the final block beginning with `[mv_traffic_application_bytes]`. Review edits in the generator, regenerate using `--write`, and regenerate this reference using `--docs`. Keep source and reference together. Do not replace generated entries with manual changes or assume real-vendor execution from the fixture results.',''])
    return '\n'.join(lines)

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--manifest',action='store_true');ap.add_argument('--write',action='store_true');ap.add_argument('--check',action='store_true');ap.add_argument('--docs',action='store_true');args=ap.parse_args()
    generated=render()
    if args.manifest:print(json.dumps(ENTRIES,indent=2));return
    if args.docs:print(render_docs(),end='');return
    current=CONF.read_text()
    if MARK in current:
        prefix,existing=current.split(MARK,1)
        assert re.findall(r'^\[([^\]]+)\]$',MARK+existing,re.M)==[e['id'] for e in ENTRIES], 'Unexpected stanzas in managed block; preserve unknown edits'
        if args.write and MARK+existing!=generated:
            baseline=subprocess.check_output(['git','show','HEAD:'+str(CONF.relative_to(ROOT))],cwd=ROOT,text=True)
            if MARK in baseline:assert MARK+existing==MARK+baseline.split(MARK,1)[1],'Refusing to overwrite manual/uncommitted managed-block changes'
        wanted=prefix+generated
    else:
        assert all('['+e['id']+']' not in current for e in ENTRIES),'Duplicate ID outside managed block'
        wanted=current.rstrip()+'\n\n'+generated
    if args.write:CONF.write_text(wanted);print('Wrote 80 standalone optional searches')
    elif args.check:assert current==wanted,'Catalogue differs from generator';print('80 catalogue definitions match source contracts')
    else:ap.print_help()
if __name__=='__main__':main()
