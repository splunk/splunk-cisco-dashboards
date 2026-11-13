#!/usr/bin/env python3
"""Author the connected DC workspace and Searchbase-backed Manager dashboard.

Run with --check to verify generated defaults without writing. This script only
touches its marked config blocks and its own dashboard; it never contacts Splunk.
"""
import argparse
import json
from dc_networking_charts import add_charts
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT = ROOT / 'packages/splunk-cisco-dashboards/src/main/resources/splunk/default'
BEGIN = '# BEGIN DC NETWORKING WORKSPACE (generate_dc_networking_content.py)'
END = '# END DC NETWORKING WORKSPACE'
PRODUCTS = ['Nexus Dashboard', 'ACI', 'Nexus 9000', 'MDS / NDFC', 'Nexus Hyperfabric']

# Keep this normalization before the scope marker and before all aggregation.
# Controller identities are intentionally independent from a reporting host.
CONTEXT = '''| eval Product=case(match(sourcetype,"^cisco:dc:nd:"),"Nexus Dashboard",match(sourcetype,"^cisco:dc:aci:"),"ACI",match(sourcetype,"^cisco:dc:nexus9k"),"Nexus 9000",match(sourcetype,"^cisco:dc:mds:"),"MDS / NDFC",match(sourcetype,"^cisco:dc:hyperfabric:"),"Nexus Hyperfabric"), Account=coalesce(nd_account,account,apic_host,device,"Unreported"), Controller=coalesce(nd_host,apic_host,account,device,"Unreported"), Fabric=coalesce(fabricName,fabric_name,'vendor.fabricName','vendor.fabric',if(sourcetype="cisco:dc:nd:fabrics",name,null()),apic_host,"Unreported"), FabricId=coalesce(fabric_id,fabricId,'vendor.fabricId',"Unreported"), Device=coalesce(entityName,hostname,node_name,parent_node_name,source_name,if(component="fabricNode",name,null()),'vendor.swName',if(resource_type="mds_switch",mvindex('vendor.displayValues{}',0),null()),if(match(sourcetype,"^cisco:dc:mds:congestion"),mvindex(split('vendor.swIfName'," "),0),null()),'vendor.local.nodeName','vendor.name','Row_info.host_name','Row_info{}.host_name',device,"Unreported"), DeviceId=coalesce(node_id,switchId,parent_node_id,source_id,device,"Unreported"), DevicePeer=coalesce(destination_name,'vendor.remote.nodeName',"Unreported"), DevicePeerId=coalesce(destination_id,'vendor.remote.nodeId',"Unreported"), DeviceAddress=coalesce(device,'vendor.ipAddress',fabricManagementIp,"Unreported"), AgeMinutes=round((now()-_time)/60,1), Observed=strftime(_time,"%Y-%m-%d %H:%M:%S %Z")
| eval DCWorkspaceScope=1'''


def base(selector):
    return '`index_dc` ' + selector + '\n' + CONTEXT


def latest(keys):
    return f'\n| eventstats max(_time) as LastObserved by {keys}\n| where _time=LastObserved\n| dedup {keys}'


OVERVIEW_COLUMNS = {
    'attention': ['Product', 'Device', 'Severity', 'AgeMinutes'],
    'coverage': ['Product', 'Coverage', 'AgeMinutes'],
    'relationships': ['Products', 'Devices', 'Serial'],
    'nd_anomalies': ['Fabric', 'Device', 'Severity'],
    'nd_fabrics': ['Fabric', 'Connectivity', 'TelemetryCollection'],
    'aci_health': ['Entity', 'HealthPct', 'AgeMinutes'],
    'aci_faults': ['Device', 'Severity', 'Signal'],
    'nexus_resources': ['DeviceAddress', 'Cpu', 'BusyPct'],
    'nexus_sensors': ['Sensor', 'Temperature', 'State'],
    'san_health': ['Device', 'Status', 'HealthPct'],
    'san_congestion': ['Interface', 'TxWaitPct', 'TxUtilPct'],
    'san_analytics': ['Entity', 'Measurement', 'AgeMinutes'],
    'hf_inventory': ['Fabric', 'Nodes', 'Ports'],
    'hf_measurements': ['Fabric', 'RateEvidence', 'AgeMinutes'],
}
SEARCHES = {}


def add(key, title, section, question, query, related=(), reuse=''):
    SEARCHES[key] = dict(title=title, section=section, question=question, query=query,
                         related=related, reuse=reuse)


add('nd_anomalies', 'Open Nexus Dashboard anomalies', 'dc_nd',
    'Which reported anomalies still need investigation?',
    base('sourcetype="cisco:dc:nd:anomalies"') + '''
| eval SignalId=coalesce(anomalyId,compositeKey)
| where isnotnull(SignalId)''' + latest('Account Controller SignalId') + '''
| where lower(cleared)="false" AND lower(expired)="false"
| eval Severity=lower(severity), Evidence=coalesce(anomalyString,anomalyStr,anomalyReason,anomalyType), Signal=anomalyType, Score=tonumber(anomalyScore)
| eval Rank=case(Severity="critical",1,Severity="major",2,Severity="warning" OR Severity="minor",3,true(),4)
| sort 1000 Rank - Score
| table Product Account Fabric Device Severity Signal Score Evidence AgeMinutes Observed SignalId''',
    ('events', 'inventory_matches', 'reported_links'), 'network_dc_nd_top_active_anomaly_types')

add('nd_fabrics', 'Fabric availability reported by Nexus Dashboard', 'dc_nd',
    'Which fabrics are reachable and is telemetry enabled?',
    base('sourcetype="cisco:dc:nd:fabrics"') + latest('Account Controller Fabric') + '''
| eval Connectivity=coalesce(connectivityStatus,"Unreported"), TelemetryCollection=coalesce(telemetryCollection,"Unreported"), FabricType=coalesce('management.displayFabricType','management.type',"Unreported"), Attention=if(lower(Connectivity)="up",2,1)
| sort 1000 Attention Fabric
| table Account Controller Fabric Connectivity TelemetryCollection FabricType AgeMinutes Observed''',
    ('nd_anomalies', 'events'))

add('aci_health', 'ACI fabric and tenant health', 'dc_aci',
    'Which APIC fabric or tenant reports degraded health?',
    base('sourcetype="cisco:dc:aci:health" component IN (fabricHealthTotal,fvTenant)') + latest('Account Controller component dn') + '''
| eval HealthPct=tonumber(cur), Entity=coalesce(name,dn), State=case(isnull(HealthPct),"Unreported",HealthPct<70,"Review",true(),"Reported health")
| sort 1000 HealthPct
| table Account Fabric Entity HealthPct State AgeMinutes Observed''',
    ('aci_faults', 'inventory_matches', 'events'), 'dc_networking_aci_fabric_health_trend')

add('aci_faults', 'ACI latest active faults', 'dc_aci',
    'Which fault, object and APIC need attention?',
    base('sourcetype IN ("cisco:dc:aci:class","cisco:dc:aci:health") (component=faultInst OR fault_class=faultInst)') + latest('Account Controller dn') + '''
| where severity IN ("critical","major","minor","warning") AND NOT lc IN ("retaining","soaking-clearing")
| eval Severity=severity, Signal=code, Evidence=descr, Entity=dn, Rank=case(severity="critical",1,severity="major",2,true(),3)
| sort 1000 Rank - _time
| table Product Account Fabric Device Severity Signal Evidence Entity AgeMinutes Observed''',
    ('events', 'inventory_matches'), 'secure_data_center_aci_critical_fault_count')

add('nexus_resources', 'Nexus 9000 CPU headroom', 'dc_nexus',
    'Which device and CPU have the least remaining headroom?',
    base('sourcetype="cisco:dc:nexus9k" component=nxresource') + '''
| eval Cpu=coalesce('Row_info.cpuid',cpuid), IdlePct=tonumber(coalesce('Row_info.idle',cpu_state_idle))
| where isnotnull(Cpu)''' + latest('Controller DeviceAddress Cpu') + '''
| eval BusyPct=if(IdlePct>=0 AND IdlePct<=100,round(100-IdlePct,2),null()), State=case(isnull(BusyPct),"Unreported",BusyPct>=90,"Review",true(),"Measured")
| sort 1000 - BusyPct
| table Account Device DeviceAddress Cpu BusyPct IdlePct State AgeMinutes Observed''',
    ('nexus_sensors', 'events'), 'dc_networking_resource_summary')

add('nexus_sensors', 'Nexus 9000 reported sensor thresholds', 'dc_nexus',
    'Are any sensors at or above a reported major threshold?',
    base('sourcetype="cisco:dc:nexus9k:dme" component=eqptSensor') + '''
| eval Sensor='Row_info.dn'
| where isnotnull(Sensor)''' + latest('Controller DeviceAddress Sensor') + '''
| eval Temperature=tonumber('Row_info.tempValue'), MajorThreshold=tonumber('Row_info.majorThresh'), Unit='Row_info.unit', State=case(isnull(Temperature) OR isnull(MajorThreshold),"Unreported",Temperature>=MajorThreshold,"At or above major",true(),"Below reported major")
| sort 1000 - Temperature
| table Account Device Sensor Temperature Unit MajorThreshold State AgeMinutes Observed''',
    ('events',), 'network_dc_nexus_dme_sensors')

add('san_health', 'MDS switch health through NDFC', 'dc_san',
    'Which SAN switches report warnings or resource pressure?',
    base('sourcetype="cisco:dc:mds:inventory" resource_type=mds_switch') + latest('Account resource_id') + '''
| eval Device=coalesce(mvindex('vendor.displayValues{}',0),'vendor.switchName',resource_id), HealthPct=tonumber(replace('vendor.healthStr',"%","")), CpuPct=tonumber('vendor.cpuUsage'), MemoryPct=tonumber('vendor.memoryUsage'), Status=coalesce(status,"Unreported")
| sort 1000 HealthPct - CpuPct
| table Account Fabric Device Status HealthPct CpuPct MemoryPct AgeMinutes Observed''',
    ('san_congestion', 'san_analytics', 'events'), 'network_dc_mds_switch_health')

add('san_congestion', 'MDS SAN transmit wait and utilization', 'dc_san',
    'Where is transmit wait reported and which interface is affected?',
    base('sourcetype="cisco:dc:mds:congestion" resource_type IN (congested_device,congested_isl)') + latest('Account resource_type resource_id') + '''
| eval Entity='vendor.entityName', Interface='vendor.swIfName', TxWaitPct=tonumber('vendor.pTxWait'), TxUtilPct=tonumber('vendor.pTxUtil'), RxUtilPct=tonumber('vendor.pRxUtil')
| sort 1000 - TxWaitPct
| table Account Fabric Entity Interface TxWaitPct TxUtilPct RxUtilPct AgeMinutes Observed''',
    ('san_health', 'san_analytics', 'events'), 'network_dc_mds_congestion')

add('san_analytics', 'SAN Analytics evidence and measurement gaps', 'dc_san',
    'What analytics evidence did NDFC actually return?',
    base('sourcetype="cisco:dc:mds:san_analytics"') + latest('Account resource_type resource_id') + '''
| eval Entity=coalesce('vendor.name',resource_id), Licensed=coalesce('vendor.base.licensed',"Unreported"), VendorAggregate=tonumber('vendor.sum'), Measurement=case(resource_type="analytics_capable_switch","Capability inventory only",resource_type="san_top_n_sample","Vendor aggregate; units and flow identity unreported",true(),"Inspect vendor payload")
| sort 1000 Account resource_type
| table Account resource_type Entity Licensed VendorAggregate Measurement AgeMinutes Observed''',
    ('san_congestion', 'events'))

add('hf_inventory', 'Nexus Hyperfabric observed ports', 'dc_hyperfabric',
    'Which fabrics and nodes have observed ports and administrative state?',
    base('sourcetype="cisco:dc:hyperfabric:inventory" resource_type=port') + '''
| eval PortId='vendor.id'
| where isnotnull(PortId)''' + latest('Account FabricId node_id PortId') + '''
| stats count as Ports dc(node_id) as Nodes count(eval(lower('vendor.enabled')="true")) as AdminEnabled count(eval(lower('vendor.enabled')="false")) as AdminDisabled count(eval(isnull('vendor.enabled') OR NOT lower('vendor.enabled') IN ("true","false"))) as AdminUnknown max(_time) as LastObserved by Account Fabric FabricId
| eval AgeMinutes=round((now()-LastObserved)/60,1), Observed=strftime(LastObserved,"%Y-%m-%d %H:%M:%S %Z")
| sort 1000 Account Fabric
| table Account Fabric Nodes Ports AdminEnabled AdminDisabled AdminUnknown AgeMinutes Observed''',
    ('hf_measurements', 'reported_links', 'events'), 'network_dc_hyperfabric_port_inventory')

add('hf_measurements', 'Nexus Hyperfabric measurement availability', 'dc_hyperfabric',
    'Do the reported counters contain usable rates?',
    base('sourcetype="cisco:dc:hyperfabric:performance"') + '''
| eval HasRate=if(isnotnull(tonumber('vendor.inBitsps')) OR isnotnull(tonumber('vendor.outBitsps')),1,0), InMbps=tonumber('vendor.inBitsps')/1000000, OutMbps=tonumber('vendor.outBitsps')/1000000
| stats count as Observations sum(HasRate) as RateObservations max(InMbps) as PeakInMbps max(OutMbps) as PeakOutMbps max(_time) as LastObserved by Account Fabric FabricId resource_type
| eval RateEvidence=if(RateObservations>0,"Measured port rates","Rates not reported; throughput unknown"), AgeMinutes=round((now()-LastObserved)/60,1), Observed=strftime(LastObserved,"%Y-%m-%d %H:%M:%S %Z")
| sort 1000 Account Fabric
| table Account Fabric resource_type RateEvidence PeakInMbps PeakOutMbps AgeMinutes Observed''',
    ('hf_rates', 'reported_links', 'events'), 'network_dc_hyperfabric_measurement_coverage')

add('hf_rates', 'Nexus Hyperfabric measured port rates', None,
    'Which ports have actual reported rate measurements?',
    base('sourcetype="cisco:dc:hyperfabric:performance" resource_type=port_counter') + '''
| eval Port='vendor.portIndex', InMbps=tonumber('vendor.inBitsps')/1000000, OutMbps=tonumber('vendor.outBitsps')/1000000
| where isnotnull(InMbps) OR isnotnull(OutMbps)''' + latest('Account FabricId node_id Port') + '''
| sort 1000 - OutMbps - InMbps
| table Account Fabric Device Port InMbps OutMbps AgeMinutes Observed''',
    ('events',), 'network_dc_hyperfabric_port_rates')

add('inventory_matches', 'Shared switch inventory by exact serial', None,
    'Which switches are reported by more than one product?',
    base('(sourcetype="cisco:dc:nd:switches" OR (sourcetype IN ("cisco:dc:aci:class","cisco:dc:aci:health") component=fabricNode) OR (sourcetype="cisco:dc:nexus9k" component=nxversion))') + '''
| eval Serial=upper(trim(coalesce(serialNumber,parent_node_serial,serial,'Row_info.proc_board_id','Row_info{}.proc_board_id')))
| where isnotnull(Serial) AND NOT Serial IN ("","UNKNOWN","NULL","N/A")''' + latest('Product Account Controller Serial') + '''
| stats dc(Product) as ProductCount values(Product) as Products values(Account) as Accounts values(Controller) as Controllers values(Fabric) as Fabrics values(Device) as Devices max(_time) as LastObserved by Serial
| where ProductCount>1
| eval Relationship="Inventory match: exact serial; no physical or traffic path implied", AgeMinutes=round((now()-LastObserved)/60,1)
| sort 1000 - ProductCount Serial
| table Serial Products Accounts Fabrics Devices Relationship AgeMinutes''',
    ('reported_links', 'events'))

add('reported_links', 'Reported topology and physical connection evidence', None,
    'Which relationships include ports, and which are logical topology?',
    base('((sourcetype="cisco:dc:hyperfabric:inventory" resource_type=connection) OR (sourcetype="cisco:dc:nd:operational" dataset=topology topology_kind=link))') + '''
| eval LinkId=coalesce(topology_id,'vendor.id'), Local=coalesce(source_name,'vendor.local.nodeName'), LocalPort=coalesce(source_port,'vendor.local.portName'), Remote=coalesce(destination_name,'vendor.remote.nodeName'), RemotePort=coalesce(destination_port,'vendor.remote.portName')
| where isnotnull(LinkId)''' + latest('Product Account Controller Fabric LinkId') + '''
| eval EvidenceType=case(Product="Nexus Hyperfabric" AND len(LocalPort)>0 AND len(RemotePort)>0,"Reported physical connection",true(),"Reported topology; not classified as a physical connection"), TrafficPath="Not established by this record"
| sort 1000 Product Fabric Local
| table Product Account Fabric Local LocalPort Remote RemotePort EvidenceType TrafficPath AgeMinutes''',
    ('events',))

add('events', 'Related DC observations in the selected scope', None,
    'What did the selected sources report in this time window?',
    base('sourcetype="cisco:dc:*" (sourcetype="*:syslog" OR sourcetype="cisco:dc:nd:anomalies" OR component=faultInst OR fault_class=faultInst OR dataset=platform_audit)') + '''
| eval Severity=coalesce(severity,level,"Unreported"), Evidence=coalesce(anomalyString,anomalyStr,descr,message,'vendor.message',"Inspect raw event in Search")
| sort 500 - _time
| table Observed Product Account Fabric Device Severity Evidence source sourcetype''')

# A single union keeps the queue comparable without joining unrelated products.
add('attention', 'What needs my attention?', 'dc_attention',
    'Which explicit faults or measured pressures should I investigate first?',
    base('(sourcetype="cisco:dc:nd:anomalies" OR (sourcetype IN ("cisco:dc:aci:class","cisco:dc:aci:health") (component=faultInst OR fault_class=faultInst)) OR (sourcetype="cisco:dc:mds:congestion" resource_type IN (congested_device,congested_isl)) OR (sourcetype="cisco:dc:mds:inventory" resource_type=mds_switch) OR (sourcetype="cisco:dc:nexus9k:dme" component=eqptSensor))') + '''
| eval SignalId=case(Product="Nexus Dashboard",coalesce(anomalyId,compositeKey),Product="ACI",dn,Product="Nexus 9000",'Row_info.dn',true(),resource_id), SignalKind=coalesce(resource_type,component,sourcetype)
| where isnotnull(SignalId)''' + latest('Product Account Controller SignalKind SignalId') + '''
| eval TxWaitPct=tonumber('vendor.pTxWait'), Temperature=tonumber('Row_info.tempValue'), MajorThreshold=tonumber('Row_info.majorThresh')
| eval NeedsAttention=case(Product="Nexus Dashboard" AND lower(cleared)="false" AND lower(expired)="false",1,Product="ACI" AND severity IN ("critical","major","minor","warning") AND NOT lc IN ("retaining","soaking-clearing"),1,resource_type="mds_switch" AND isnotnull(status) AND NOT lower(status) IN ("ok","healthy","normal","null","unknown"),1,Product="MDS / NDFC" AND TxWaitPct>0,1,Product="Nexus 9000" AND isnotnull(Temperature) AND isnotnull(MajorThreshold) AND Temperature>=MajorThreshold,1,true(),0)
| where NeedsAttention=1
| eval Severity=coalesce(severity,if(resource_type="mds_switch",status,null()),"Review"), Signal=coalesce(anomalyType,code,resource_type,component), Evidence=coalesce(anomalyString,anomalyStr,descr,if(isnotnull(TxWaitPct),"Reported transmit wait ".TxWaitPct."%",null()),status,"Reported sensor threshold reached"), Device=if(Product="MDS / NDFC",coalesce('vendor.entityName','vendor.swIfName',mvindex('vendor.displayValues{}',0),Device),Device), Rank=case(Severity="critical",1,Severity="major",2,TxWaitPct>=50,2,true(),3)
| sort 1000 Rank - _time
| table Product Account Fabric Device Severity Signal Evidence AgeMinutes Observed''',
    ('nd_anomalies', 'aci_faults', 'san_congestion', 'nexus_sensors', 'events'))

add('coverage', 'Five-product data coverage and freshness', 'dc_attention',
    'What data was observed, how old is it, and what is missing?',
    base('sourcetype="cisco:dc:*"') + '''
| stats count as Observations max(_time) as LastObserved values(index) as Indexes dc(Account) as Accounts values(sourcetype) as Feeds by Product
| append [| makeresults | eval Product=split("Nexus Dashboard|ACI|Nexus 9000|MDS / NDFC|Nexus Hyperfabric","|") | mvexpand Product | fields Product]
| stats max(Observations) as Observations max(LastObserved) as LastObserved values(Indexes) as Indexes max(Accounts) as Accounts values(Feeds) as Feeds by Product
| eval AgeMinutes=round((now()-LastObserved)/60,1), Coverage=case(isnull(LastObserved),"No observations in selected scope / time",AgeMinutes>60,"Observed; over 60 minutes old",true(),"Observed; review product measurements"), Observed=if(isnotnull(LastObserved),strftime(LastObserved,"%Y-%m-%d %H:%M:%S %Z"),"Unreported")
| sort 5 Product
| table Product Coverage Accounts Indexes AgeMinutes Observed''',
    ('hf_measurements', 'san_analytics', 'events'))

add('relationships', 'What relationships can I verify?', 'dc_attention',
    'Which relationships are supported by inventory or connection records?',
    SEARCHES['inventory_matches']['query'], ('inventory_matches', 'reported_links', 'events'))


add('hf_nodes', 'Hyperfabric node inventory and administrative state', None,
    'Which node, role and administrative setting support the summary?',
    base('sourcetype="cisco:dc:hyperfabric:inventory" resource_type=node') + "\n| eval NodeId='vendor.nodeId' | where isnotnull(NodeId)" + latest('Account FabricId NodeId') + """
| eval Node=coalesce('vendor.name',NodeId), Roles=coalesce(mvjoin('vendor.roles{}',", "),"Unreported"), AdminEnabled=coalesce('vendor.enabled',"Unreported"), Model=coalesce('vendor.modelName',"Unreported")
| table Account Fabric Node NodeId Roles AdminEnabled Model AgeMinutes Observed""",
    ('reported_links', 'hf_measurements', 'events'))
add('hf_ports', 'Hyperfabric port inventory and administrative state', None,
    'Which reported port has this administrative setting?',
    base('sourcetype="cisco:dc:hyperfabric:inventory" resource_type=port') + "\n| eval PortId='vendor.id' | where isnotnull(PortId)" + latest('Account FabricId node_id PortId') + """
| eval Port=coalesce('vendor.name',PortId), AdminEnabled=coalesce('vendor.enabled',"Unreported"), ReportedMaxSpeed='vendor.maxSpeed'
| table Account Fabric node_id Port PortId AdminEnabled ReportedMaxSpeed AgeMinutes Observed""",
    ('reported_links', 'hf_measurements', 'events'))

add('fabric_inventory', 'Observed DC fabrics and device inventory', None,
    'Which reported fabrics and controller domains contain observed inventory?',
    base('((sourcetype="cisco:dc:nd:fabrics") OR (sourcetype="cisco:dc:nd:switches") OR (sourcetype IN ("cisco:dc:aci:class","cisco:dc:aci:health") component=fabricNode) OR (sourcetype="cisco:dc:nexus9k" component=nxversion) OR (sourcetype="cisco:dc:mds:inventory" resource_type=mds_switch) OR (sourcetype="cisco:dc:hyperfabric:inventory" resource_type=node))') + """
| eval FabricId=if(Product="Nexus Hyperfabric",FabricId,"Unreported")
| eval InventoryId=coalesce('vendor.nodeId',serialNumber,serial,'Row_info.proc_board_id',dn,resource_id,id,DeviceId), DeviceKey=if(sourcetype="cisco:dc:nd:fabrics",null(),if(Device!="Unreported",Device,if(InventoryId!="Unreported",InventoryId,null())))
| stats dc(DeviceKey) as Devices count as Records max(_time) as LastObserved by Product Account Controller Fabric FabricId
| eval Devices=if(Devices>0,Devices,null()), AgeMinutes=round((now()-LastObserved)/60,2), Observed=strftime(LastObserved,"%Y-%m-%d %H:%M:%S %Z"), Relationship="Reported inventory grouping; no physical or traffic path implied"
| sort 1000 Product Account Controller Fabric FabricId
| table Product Account Controller Fabric FabricId Devices AgeMinutes Observed Relationship""",
    ('nd_fabrics', 'aci_health', 'nexus_resources', 'san_health', 'hf_nodes', 'coverage'))
add('fabric_links', 'DC fabric endpoint and port evidence', None,
    'Which reported links have actual endpoint and port evidence?',
    SEARCHES['reported_links']['query'].rsplit('\n| table ',1)[0] + """
| table Product Account Controller Fabric FabricId LinkId Local LocalPort Remote RemotePort EvidenceType TrafficPath AgeMinutes""",
    ('reported_links', 'inventory_matches', 'events'))

add('fabric_map', 'DC fabrics for the standard map', None,
    'Up to three named fabrics reported by Nexus Dashboard, ranked by active critical anomalies then other active anomalies. Matching requires a reported account, controller and fabric. Inter-fabric links and overall health are unreported.',
    base('sourcetype IN ("cisco:dc:nd:fabrics","cisco:dc:nd:anomalies")') + """
| eval Account=trim(Account), Controller=trim(nd_host), Fabric=trim(Fabric)
| where len(Account)>0 AND NOT lower(Account) IN ("unreported","null","unknown") AND len(Controller)>0 AND NOT lower(Controller) IN ("unreported","null","unknown") AND len(Fabric)>0 AND NOT lower(Fabric) IN ("unreported","null","unknown")
| eval IsFabric=if(sourcetype="cisco:dc:nd:fabrics",1,0), EntityKey=if(IsFabric=1,"fabric:".Fabric,coalesce(anomalyId,compositeKey))
| where len(trim(EntityKey))>0""" + latest('Account Controller sourcetype EntityKey') + """
| eval Active=if(IsFabric=0 AND lower(cleared)="false" AND lower(expired)="false",1,0), Critical=if(Active=1 AND lower(severity)="critical",1,0), InventoryTime=if(IsFabric=1,_time,null()), Connectivity=if(IsFabric=1,coalesce(connectivityStatus,"Unreported"),null())
| stats max(IsFabric) as HasInventory sum(Active) as ActiveAnomalies sum(Critical) as CriticalAnomalies max(InventoryTime) as InventoryTime max(_time) as LastObserved values(Connectivity) as Connectivity by Account Controller Fabric
| where HasInventory=1
| sort 0 - CriticalAnomalies - ActiveAnomalies Fabric Account Controller
| eventstats count as ObservedFabrics
| head 3
| streamstats count as MapRank
| eval itemType="site", siteId="dc-".sha256(Account."|".Controller."|".Fabric), siteName=Fabric, role="fabric", shortName=tostring(MapRank), status=case(CriticalAnomalies>0,"critical",ActiveAnomalies>0,"warning",true(),"unknown"), alerts=if(ActiveAnomalies>0,ActiveAnomalies,null()), lastUpdated=strftime(LastObserved,"%Y-%m-%d %H:%M:%S %Z"), telemetrySource="Nexus Dashboard lab data · ".Account." · ".Controller." · ".ActiveAnomalies." observed active anomalies (".CriticalAnomalies." critical). Connectivity: ".Connectivity.". Showing up to 3 of ".ObservedFabrics." named fabrics. Overall health and inter-fabric links unreported."
| table itemType siteId siteName role shortName status alerts lastUpdated telemetrySource Account Controller Fabric ActiveAnomalies CriticalAnomalies ObservedFabrics Connectivity""",
    ('nd_anomalies', 'nd_fabrics', 'fabric_inventory', 'fabric_links'))

add_charts(SEARCHES, base)

def block_file(name, body):
    path = DEFAULT / name
    existing = path.read_text() if path.exists() else ''
    if name == 'searchbase.conf':
        # The existing multivendor generator owns the complete file suffix.
        # Keep this independent block ahead of that suffix, byte-for-byte.
        if BEGIN in existing:
            start = existing.index(BEGIN)
            end = existing.index(END, start) + len(END)
            existing = existing[:start].rstrip() + '\n' + existing[end:].lstrip('\n')
        anchor = existing.index('[mv_traffic_application_bytes]')
        return path, existing[:anchor].rstrip() + '\n\n' + BEGIN + '\n' + body.strip() + '\n' + END + '\n\n' + existing[anchor:]
    if BEGIN in existing:
        start = existing.index(BEGIN)
        end = existing.index(END, start) + len(END)
        return path, existing[:start] + BEGIN + '\n' + body.strip() + '\n' + END + existing[end:]
    return path, existing.rstrip() + '\n\n' + BEGIN + '\n' + body.strip() + '\n' + END + '\n'


def generate():
    stanzas = []
    for key, record in SEARCHES.items():
        viz = dict(showRowNumbers=False, emptyMessage='No qualifying observations in this scope and time. Check coverage; absence does not establish health.')
        chart = record.get('viz', 'splunk.table')
        if chart != 'splunk.table':
            viz.update(seriesColors=[record.get('color', '#649ef5'), '#4cbf7f', '#f0c243'], legendDisplay='off', showTotal=False)
        if chart in ('splunk.singlevalueradial', 'splunk.fillergauge'):
            viz.update(valueField='Metric', min=0, max=100, showDelta=False, valueSuffix='%', decimals=2)
        if record['section']:
            if key in OVERVIEW_COLUMNS:
                viz['overviewColumns'] = OVERVIEW_COLUMNS[key]
            viz['overview'] = [dict(workspace='dc_networking', section=record['section'], tileId='dc_workspace_' + key,
                                    label=record['title'], subLabel=record['question'], valueField=record.get('value_field', 'Observations'), unit=record.get('unit', ''), comparePeriod=False,
                                    color=record.get('color', '#649ef5'), thresholdNote=record.get('note', 'Latest observed evidence in the selected window; missing measurements remain unknown.'))]
        metadata = dict(search_name='DC Networking Workspace - ' + record['title'], search_author='akhamis',
                        updated_author='akhamis', version='1.0.0', date_created='2026-11-07', date_updated='2026-11-07',
                        category='Data Center', sub_category='DC Networking Workspace', search_type='display',
                        tags='DC Networking Workspace,' + ','.join(PRODUCTS), dispatch_context='splunk-cisco-dashboards',
                        dispatch_context_force='1', search_hidden='0', default_viz=chart,
                        viz_options=json.dumps(viz, separators=(',', ':')),
                        description='<p>' + record['question'] + '</p>',
                        explanation='<p>Uses lab observations, controller-scoped identities and the selected time and exact scope. Latest observed state is not a complete current snapshot. Repeated polls are not distinct faults. Missing fields remain unknown.</p>',
                        solution='<p>Review product, fabric/site, device and observation age. Open the related product detail, then related observations or Search. Shared timing is context, not proof of cause.</p>',
                        related_info='<p>' + ('Reuses the field and state semantics of shipped Searchbase stanza <code>' + record['reuse'] + '</code>. ' if record['reuse'] else '') + 'Inventory serial matches do not imply adjacency. Physical connections require reported endpoint/port evidence. A traffic path requires traffic/path observations.</p>')
        related = ([key] if record['section'] and chart == 'splunk.table' else []) + list(record['related'])
        if related:
            metadata['drilldown_stanza_ids'] = ','.join('dc_workspace_' + ref for ref in dict.fromkeys(related))
            metadata['drilldown_button_title'] = 'Investigate related evidence'
        stanza = '[dc_workspace_' + key + ']\n' + '\n'.join(k + ' = ' + v for k, v in metadata.items())
        stanza += '\nsearch = ' + record['query'].replace('\n', '\\\n')
        stanzas.append(stanza)
    outputs = [block_file('searchbase.conf', '\n\n'.join(stanzas))]
    sections = ['dc_attention', 'dc_nd', 'dc_aci', 'dc_nexus', 'dc_san', 'dc_hyperfabric']
    layout = '''[workspace.dc_networking]
label = DC Networking
source_workspace = dc_networking
sections = ''' + ','.join(sections) + '\ndefault_visible_sections = ' + ','.join(sections) + '''
max_visible_sections = 6
min_tile_count = 1
max_tile_count = 9
default_tile_count = 9
header_title = DC Networking
header_subtitle = What needs my attention? · Lab observations across five products
hide_default_logo = 0
is_builtin = 1
enabled = 1
sort_order = 30
map_visible = 1
map_position = right
regional_view = map
'''
    for section in sections:
        ids = ['dc_workspace_' + key for key, r in SEARCHES.items() if r['section'] == section]
        preferred = {
            'dc_nexus': ['dc_workspace_nexus_cpu_history', 'dc_workspace_nexus_temperature_history', 'dc_workspace_nexus_cpu_comparison'],
            'dc_san': ['dc_workspace_san_health_history', 'dc_workspace_san_wait_history', 'dc_workspace_san_cpu_history'],
            'dc_hyperfabric': ['dc_workspace_hf_nodes_history', 'dc_workspace_hf_ports_history', 'dc_workspace_hf_connections_history'],
        }.get(section, [])
        assert len(ids) == 9, (section, len(ids))
        ids = preferred + [tile for tile in ids if tile not in preferred]
        layout += f'\n[layout.dc_networking.{section}]\ntiles = ' + ','.join(ids) + f'\nvisible_count = {len(ids)}\n'
    rail = [('nd_critical_history', 'ND critical anomalies', ''), ('aci_critical_history', 'ACI critical faults', ''), ('nexus_cpu_peak_history', 'Nexus busiest CPU', '%'), ('san_wait_history', 'SAN transmit wait', '%'), ('hf_node_enabled_now', 'HF nodes admin enabled', '%')]
    for key, label, unit in rail:
        layout += '\n[signal_item.dc_' + key + ']\nsearch_name = DC Networking Workspace - ' + SEARCHES[key]['title'] + '\nlabel = ' + label + '\nvalue_field = Metric\n'
        if unit:
            layout += 'threshold_unit = ' + unit + '\n'
    layout += '\n[signal_rail.dc_networking]\nenabled = 1\nshow_priority_drilldown = 0\nrows = 1\nspeed = 0\ndensity = comfortable\nfont_size = standard\nitems = ' + ','.join('dc_' + key for key, _, _ in rail) + '\n'
    outputs.append(block_file('insights_workspaces.conf', layout))
    definition = dict(title='DC Networking Operations', description='Lab observations · Five products, one investigation. Missing data is unknown.',
                      inputs={}, dataSources={}, visualizations={},
                      defaults={'visualizations': {'global': {'showLastUpdated': True, 'showProgressBar': True}}},
                      layout={'type': 'absolute', 'options': {'width': 1440, 'height': 2920, 'display': 'auto-scale', 'backgroundColor': '#0b1018'}, 'structure': [], 'globalInputs': []})
    definition['inputs']['input_time_range'] = json.loads((ROOT / 'scripts/dashboard_time_range.json').read_text())
    definition['layout']['structure'].append({'item': 'input_time_range', 'type': 'input', 'position': {'x': 940, 'y': 20, 'w': 400, 'h': 80}})

    def viz(key, value, x, y, w, h):
        definition['visualizations'][key] = value
        definition['layout']['structure'].append({'item': key, 'type': 'block', 'position': {'x': x, 'y': y, 'w': w, 'h': h}})

    viz('header', {'type': 'splunk.markdown', 'options': {'markdown': '# DC Networking Operations\nLab observations · Start with attention, confirm coverage, then follow product evidence.\n\nThe configured DC index macro and selected time window define this overview. Administrative enablement is not availability. Blank measurements are unknown. Shared timing does not prove cause.', 'backgroundColor': '#1c2738', 'fontColor': '#ecf0f5'}}, 20, 20, 900, 150)
    rows = [('attention_history', 'attention_products'), ('coverage_age', 'inventory_products'),
            ('nd_active_history', 'nd_reachability_history'), ('aci_tenant_health_history', 'aci_fault_history'),
            ('nexus_cpu_history', 'nexus_temperature_history'), ('san_health_history', 'san_wait_history'),
            ('hf_nodes_history', 'hf_ports_history')]
    for row, keys in enumerate(rows):
        for column, key in enumerate(keys):
            ds = 'ds_' + key
            definition['dataSources'][ds] = {'type': 'ds.searchbase', 'name': SEARCHES[key]['title'],
                'options': {'ref': 'dc_workspace_' + key, 'ownerApp': 'splunk-cisco-dashboards',
                            'queryParameters': {'earliest': '$time_tok.earliest$', 'latest': '$time_tok.latest$', 'span': '$time_tok.span$'}}}
            # Search opens the resolved, scoped Searchbase query through Manager's
            # standard visualization toolbar. Avoid an unrelated global URL pivot.
            viz('viz_' + key, {'type': SEARCHES[key].get('viz', 'splunk.table'), 'title': SEARCHES[key]['title'],
                              'description': SEARCHES[key]['question'], 'dataSources': {'primary': ds},
                              'options': {'backgroundColor': '#131a23', 'seriesColors': ['#649ef5', '#4cbf7f'], 'legendDisplay': 'off', 'yAxisTitleText': SEARCHES[key].get('unit') or 'Observed entities'}},
                20 + column * 710, 190 + row * 330, 690, 310)
            targets = ",".join("dc_workspace_" + ref for ref in SEARCHES[key]["related"])
            viz("detail_" + key, {"type": "splunk.cisco_drilldown_action", "options": {"label": "Investigate " + SEARCHES[key]["title"]}, "eventHandlers": [{"type": "drilldown.customUrl", "options": {"url": "/drilldown?origin=" + key + "&target=" + targets}}]}, 658 + column * 710, 200 + row * 330, 42, 42)
    viz('notes', {'type': 'splunk.markdown', 'options': {'markdown': '### Continue the investigation\nUse the panel menu to open its resolved query in Search. Review **Shared switch inventory** for exact serial matches and **Reported topology** for endpoint/port evidence. Neither establishes a traffic path.\n\n**Optional expansion:** Search the library for ISE, Secure Firewall, SD-WAN, Meraki or ThousandEyes. Only link records when exact device, IP, session or test identities agree; review address reuse and scope first.', 'backgroundColor': '#1c2738', 'fontColor': '#ecf0f5'}}, 20, 2520, 1400, 180)
    definition['layout']['options']['height'] = 2720
    canvas = definition['layout']
    canvas.pop('globalInputs', None)
    definition['layout'] = {'options': {'showTitleAndDescription': False, 'submitButton': False, 'submitOnDashboardLoad': True}, 'globalInputs': [], 'layoutDefinitions': {'layout_1': canvas}, 'tabs': {'items': [{'label': 'Overview', 'layoutId': 'layout_1'}]}}
    xml = '<dashboard version="2" theme="dark" isVisible="false">\n<label>DC Networking Operations</label>\n<description>Five-product lab investigation built from the SSNE search library.</description>\n<definition><![CDATA[\n' + json.dumps(definition, indent=2) + '\n]]></definition>\n</dashboard>\n'
    outputs.append((DEFAULT / 'data/ui/views/dc_networking_operations.xml', xml))
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    stale = []
    for path, value in generate():
        if args.check:
            if not path.exists() or path.read_text() != value:
                stale.append(str(path.relative_to(ROOT)))
        else:
            path.write_text(value)
    if stale:
        raise SystemExit('Generated DC defaults differ: ' + ', '.join(stale))
    print(('Verified' if args.check else 'Generated') + f' DC workspace, {len(SEARCHES)} searches and Manager dashboard.')


if __name__ == '__main__':
    main()
