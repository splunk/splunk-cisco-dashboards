#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const {generateFixtures} = require("./generate_search_library_batch1_fixtures.cjs");
const root = path.resolve(__dirname,"..");
const manifest = JSON.parse(execFileSync("python3",[path.join(__dirname,"generate_multivendor_search_library.py"),"--manifest"],{encoding:"utf8",maxBuffer:8*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:"1"}}));
const conf = fs.readFileSync(path.join(root,"packages/splunk-cisco-dashboards/src/main/resources/splunk/default/searchbase.conf"),"utf8");
const fixtures = generateFixtures(conf,manifest.map(e=>e.fixture));
const at = seconds => ({expr:`now()-${seconds}`});
const extraCases=[];
for(const [id,inField,outField,multiplier] of [
  ['arista_interface_error_rates','ifInErrors','ifOutErrors',1],
  ['arista_interface_discard_rates','ifInDiscards','ifOutDiscards',1],
  ['arista_interface_transfer_rates','ifHCInOctets','ifHCOutOctets',0.000008],
]){
  const entry=manifest.find(e=>e.id==='mv_'+id);
  const row=(seconds,value,host='switch-a')=>({host,interface:'Ethernet1',_time:at(seconds),[inField]:value,[outField]:value});
  const label=id.endsWith('transfer_rates')?'Mbps':'PerSecond';
  extraCases.push({id:entry.id,rows:[row(600,100),row(540,null),row(480,160),row(420,220),row(360,260),row(360,270),row(300,300),row(240,10),row(180,1000,'other-switch')],
    post:`| stats count as Groups sum(Records) as Records max(PeakIn${label}) as InRate`,
    assertion:`Groups=1 AND Records=1 AND abs(InRate-${multiplier})<0.000000001`});
}
extraCases.push({id:'mv_arista_latest_interface_state',rows:[{host:'switch-a',interface:'Ethernet1',ifOperStatus:'up',_time:at(60)},{host:'switch-a',interface:'Ethernet1',ifOperStatus:'down',_time:at(60)}],
  post:'| stats count as Groups sum(Records) as Records values(ObservedState) as State',assertion:'Groups=1 AND Records=2 AND State="Conflicting states"'});
extraCases.push({id:'mv_crowdstrike_process_destinations',rows:[
  {aid:'a',event_simpleName:'ProcessRollup2',TargetProcessId:'100',FileName:'curl'},
  {aid:'a',event_simpleName:'ProcessRollup2',TargetProcessId:'100',FileName:'other'},
  {aid:'a',event_simpleName:'NetworkConnectIP4',ContextProcessId:'100',RemoteAddressIP4:'198.51.100.1',RemotePort:443},
  {aid:'b',event_simpleName:'NetworkConnectIP4',ContextProcessId:'100',RemoteAddressIP4:'198.51.100.1',RemotePort:443}],
  post:'| stats count as Groups count(eval(ProcessName="Conflicting process context")) as Conflicts count(eval(ProcessName="Process record not observed")) as Missing',assertion:'Groups=2 AND Conflicts=1 AND Missing=1'});
const extraFixtures=generateFixtures(conf,extraCases).filter(f=>f.kind==='populated').map(f=>({...f,kind:'adversarial'}));
// Invalid aliases and valid addresses of the wrong family must not mask a
// later valid candidate. Repeated conflicting values remain unusable.
const addressCases=[
  {id:'mv_crowdstrike_ipv6_destinations',rows:[
    {aid:'a',event_simpleName:'NetworkConnectIP6',dest:'unknown',RemoteAddressIP4:'0.0.0.0',RemoteAddressIP6:'2001:db8::1',RemotePort:443},
    {aid:'b',event_simpleName:'NetworkConnectIP6',dest_ip:['2001:db8::2','2001:db8::3'],RemoteAddressIP6:'2001:db8::1',RemotePort:443},
    {aid:'c',event_simpleName:'NetworkConnectIP6',RemoteAddressIP4:'198.51.100.1',RemoteAddressIP6:'invalid',RemotePort:443}],
    post:'| stats count as Groups sum(Records) as Records values(Remote) as Remote',assertion:'Groups=1 AND Records=2 AND Remote="2001:db8::1"'},
  {id:'mv_crowdstrike_process_destinations',rows:[
    {aid:'a',event_simpleName:'NetworkConnectIP4',ContextProcessId:'100',dest_ip:'invalid',dest:'2001:db8::1',RemoteAddressIP4:'198.51.100.1',RemotePort:443},
    {aid:'a',event_simpleName:'NetworkConnectIP4',ContextProcessId:'100',dest_ip:'198.51.100.1',RemoteAddressIP4:'198.51.100.2',RemotePort:443},
    {aid:'a',event_simpleName:'NetworkConnectIP4',ContextProcessId:'100',dest_ip:'invalid',RemoteAddressIP6:'2001:db8::1',RemotePort:443}],
    post:'| stats count as Groups sum(Records) as Records values(Remote) as Remote',assertion:'Groups=1 AND Records=2 AND Remote="198.51.100.1"'},
  {id:'mv_crowdstrike_network_listeners',rows:[
    {aid:'a',event_simpleName:'NetworkListenIP6',src:'unknown',LocalAddressIP4:'0.0.0.0',LocalAddressIP6:'::',LocalPort:443},
    {aid:'a',event_simpleName:'NetworkListenIP4',src_ip:'invalid',LocalAddressIP4:'0.0.0.0',LocalPort:443}],
    post:'| stats count as Groups sum(Records) as Records values(Local) as Addresses',assertion:'Groups=2 AND Records=2 AND mvfind(Addresses,"^::$")>=0 AND mvfind(Addresses,"^0[.]0[.]0[.]0$")>=0'},
  {id:'mv_crowdstrike_blocked_network_events',rows:[
    {aid:'a',event_simpleName:'NetworkConnectIP6Blocked',dest:'unknown',RemoteAddressIP4:'0.0.0.0',RemoteAddressIP6:'2001:db8::1',RemotePort:443},
    {aid:'a',event_simpleName:'NetworkConnectIP6Blocked',dest:'unknown',RemoteAddressIP4:'0.0.0.0',RemoteAddressIP6:'invalid',RemotePort:443}],
    post:'| stats count as Groups sum(Records) as Records count(eval(Remote="Not reported")) as Missing count(eval(Remote="2001:db8::1")) as Valid',assertion:'Groups=2 AND Records=2 AND Missing=1 AND Valid=1'},
];
extraFixtures.push(...generateFixtures(conf,addressCases).filter(f=>f.kind==='populated').map(f=>({...f,kind:'address-fallback'})));
const discontinuityCase={id:'mv_interface_error_counter_rates',rows:[
  {host:'switch-a',ifName:'Ethernet1',ifInErrors:100,ifOutErrors:100,ifCounterDiscontinuityTime:0,sysUpTime:10000,_time:at(600)},
  {host:'switch-a',ifName:'Ethernet1',ifInErrors:160,ifOutErrors:160,ifCounterDiscontinuityTime:1,sysUpTime:10060,_time:at(540)},
  {host:'switch-a',ifName:'Ethernet1',ifInErrors:220,ifOutErrors:220,ifCounterDiscontinuityTime:1,sysUpTime:10120,_time:at(480)},
  {host:'switch-a',ifName:'Ethernet1',ifInErrors:280,ifOutErrors:280,ifCounterDiscontinuityTime:1,sysUpTime:10,_time:at(420)},
  {host:'switch-a',ifName:'Ethernet1',ifInErrors:340,ifOutErrors:340,ifCounterDiscontinuityTime:1,sysUpTime:70,_time:at(360)}],
  post:'| stats count as Groups sum(Records) as Records sum(ContinuityUnverifiedIntervals) as Unverified max(PeakInPerSecond) as InRate',
  assertion:'Groups=1 AND Records=2 AND Unverified=0 AND InRate=1'};
extraFixtures.push({...generateFixtures(conf,[discontinuityCase])[0],kind:'discontinuity'});
const capEntry=manifest.find(e=>e.id==='mv_traffic_application_bytes');
extraFixtures.push({id:capEntry.id,kind:'truncation',earliest:'-24h@h',latest:'now',query:'| makeresults count=1001 | streamstats count as n | eval host="switch-a",app="app-".n,bytes=1\n'+capEntry.query.split('\n').slice(1).join('\n')+'\n| stats count as Rows min(TotalGroups) as Total min(RowsTruncated) as Truncated | eval CaseId="'+capEntry.id+'", TestPassed=if(Rows=1000 AND Total=1001 AND Truncated=1,1,0) | table CaseId TestPassed Rows Total Truncated'});
module.exports = {manifest,fixtures,extraFixtures};
if(require.main===module) process.stdout.write(JSON.stringify(process.argv.includes('--extended')?[...fixtures,...extraFixtures]:fixtures,null,2)+"\n");
