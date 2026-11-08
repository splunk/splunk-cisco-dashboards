"""Chart-first DC catalogue. Tables remain the full-fidelity drilldown searches."""


def add_charts(searches, base):
    for record in searches.values():
        record['section'] = None

    def register(key, title, section, query, detail, viz='splunk.line', unit='', note=''):
        searches[key] = dict(title=title, section=section, question=title,
                            query=query, related=tuple(detail), reuse='', viz=viz,
                            value_field='Metric', unit=unit,
                            note=note or 'Latest observation per entity in each 15-minute bucket. Missing measurements stay unknown; this is observed history, not a complete snapshot.')

    def history(key, title, section, selector, identity, value, aggregate, detail, unit=''):
        query = base(selector) + '''
| eval Bucket=floor(_time/900)*900
| eventstats max(_time) as LastObserved by ''' + identity + ''' Bucket
| where _time=LastObserved
| dedup ''' + identity + ''' Bucket
| eval Metric=''' + value + '''
| where isnotnull(Metric)
| stats ''' + aggregate + ''' as Metric by Bucket
| eval _time=Bucket
| sort 0 _time
| table _time Metric'''
        register(key, title, section, query, detail, unit=unit)

    def snapshot(key, title, section, source, transform, details, unit=''):
        query = searches[source]['query'].rsplit('\n| table ', 1)[0] + '\n' + transform
        register(key, title, section, query, details, 'splunk.bar', unit,
                 'Latest observed entities in the selected scope/time, not a historical series. Missing values are not zero.')

    nd = 'sourcetype="cisco:dc:nd:anomalies"'
    aci = 'sourcetype IN ("cisco:dc:aci:class","cisco:dc:aci:health") (component=faultInst OR fault_class=faultInst)'
    nd_id = 'Account Controller anomalyId'
    active = 'if(lower(cleared)="false" AND lower(expired)="false",1,if(lower(cleared)="true" OR lower(expired)="true",0,null()))'
    aci_active = 'case(severity IN ("critical","major","minor","warning") AND NOT lc IN ("retaining","soaking-clearing"),1,severity="cleared" OR lc IN ("retaining","soaking-clearing"),0,true(),null())'

    # A combined timeline uses the same lifecycle logic as the two product views.
    history('attention_history', 'Observed active faults and anomalies', 'dc_attention',
            '(' + nd + ' OR (' + aci + '))',
            'Product Account Controller SignalKey',
            'if(Product="Nexus Dashboard",' + active + ',' + aci_active + ')',
            'sum(Metric)', ['attention', 'nd_anomalies', 'aci_faults', 'events'])
    # Derive the identity before bucketing (anomaly IDs and APIC DNs are distinct).
    q = searches['attention_history']['query']
    searches['attention_history']['query'] = q.replace('| eval Bucket=', '| eval SignalKey=coalesce(anomalyId,compositeKey,dn)\n| eval Bucket=', 1)
    snapshot('attention_products', 'Reported items to review by product', 'dc_attention', 'attention',
             '| stats count as Metric by Product | sort 10 - Metric', ['attention', 'events'])
    snapshot('coverage_age', 'How old is each product’s latest observation?', 'dc_attention', 'coverage',
             '| rename AgeMinutes as Metric | table Product Metric', ['coverage', 'hf_measurements', 'san_analytics'], 'min')
    snapshot('inventory_products', 'Shared inventory: products reporting each switch', 'dc_attention', 'inventory_matches',
             '| rename ProductCount as Metric | table Serial Metric', ['inventory_matches', 'reported_links'])

    history('nd_active_history', 'Nexus Dashboard active-anomaly history', 'dc_nd', nd, nd_id,
            active, 'sum(Metric)', ['nd_anomalies', 'events'])
    history('nd_reachability_history', 'Reported fabric reachability', 'dc_nd',
            'sourcetype="cisco:dc:nd:fabrics"', 'Account Controller Fabric',
            'case(lower(connectivityStatus)="up",100,lower(connectivityStatus)="down",0,true(),null())',
            'avg(Metric)', ['nd_fabrics', 'events'], '%')
    snapshot('nd_severity', 'Open anomalies by reported severity', 'dc_nd', 'nd_anomalies',
             '| stats count as Metric by Severity', ['nd_anomalies'])
    snapshot('nd_fabric_anomalies', 'Which fabrics have the most open anomalies?', 'dc_nd', 'nd_anomalies',
             '| stats count as Metric by Account Fabric | eval Scope=Account." / ".Fabric | sort 20 - Metric | table Scope Metric', ['nd_anomalies', 'inventory_matches'])

    for key, label, component in [('aci_tenant_health_history', 'ACI observed tenant health', 'fvTenant'),
                                  ('aci_fabric_health_history', 'ACI reported fabric health', 'fabricHealthTotal')]:
        history(key, label, 'dc_aci', 'sourcetype="cisco:dc:aci:health" component=' + component,
                'Account Controller dn', 'if(tonumber(cur)>=0 AND tonumber(cur)<=100,tonumber(cur),null())',
                'avg(Metric)', ['aci_health', 'aci_faults'], '%')
    history('aci_fault_history', 'ACI active-fault history', 'dc_aci', aci,
            'Account Controller dn', aci_active, 'sum(Metric)', ['aci_faults', 'events'])
    snapshot('aci_fault_severity', 'ACI active faults by severity', 'dc_aci', 'aci_faults',
             '| stats count as Metric by Severity', ['aci_faults'])

    for key, label, agg in [('nexus_cpu_history', 'Nexus 9000 mean CPU busy', 'avg(Metric)'),
                             ('nexus_cpu_peak_history', 'Nexus 9000 busiest CPU', 'max(Metric)')]:
        history(key, label, 'dc_nexus', 'sourcetype="cisco:dc:nexus9k" component=nxresource',
                'Controller DeviceAddress CpuKey',
                'if(tonumber(\'Row_info.idle\')>=0 AND tonumber(\'Row_info.idle\')<=100,100-tonumber(\'Row_info.idle\'),null())',
                agg, ['nexus_resources', 'events'], '%')
        searches[key]['query'] = searches[key]['query'].replace('| eval Bucket=', "| eval CpuKey='Row_info.cpuid'\n| where isnotnull(CpuKey)\n| eval Bucket=", 1)
    history('nexus_temperature_history', 'Nexus 9000 peak reported temperature (Celsius)', 'dc_nexus',
            'sourcetype="cisco:dc:nexus9k:dme" component=eqptSensor', 'Controller DeviceAddress SensorKey',
            'if(lower(\'Row_info.unit\') IN ("c","celsius","degrees c"),tonumber(\'Row_info.tempValue\'),null())',
            'max(Metric)', ['nexus_sensors'], '°C')
    searches['nexus_temperature_history']['query'] = searches['nexus_temperature_history']['query'].replace('| eval Bucket=', "| eval SensorKey='Row_info.dn'\n| eval Bucket=", 1)
    snapshot('nexus_cpu_comparison', 'Which CPU has the least current headroom?', 'dc_nexus', 'nexus_resources',
             '| eval CpuLabel=DeviceAddress." CPU ".Cpu | rename BusyPct as Metric | table CpuLabel Metric', ['nexus_resources'], '%')

    for key, label, value in [('san_health_history', 'MDS observed switch health', 'tonumber(replace(\'vendor.healthStr\',"%",""))'),
                              ('san_cpu_history', 'MDS CPU pressure', 'tonumber(\'vendor.cpuUsage\')'),
                              ('san_memory_history', 'MDS memory pressure', 'tonumber(\'vendor.memoryUsage\')')]:
        history(key, label, 'dc_san', 'sourcetype="cisco:dc:mds:inventory" resource_type=mds_switch',
                'Account resource_id', value, 'avg(Metric)', ['san_health', 'san_congestion'], '%')
    for key, label, value in [('san_wait_history', 'SAN highest reported transmit wait', "tonumber('vendor.pTxWait')"),
                              ('san_util_history', 'SAN highest reported transmit utilization', "tonumber('vendor.pTxUtil')")]:
        history(key, label, 'dc_san', 'sourcetype="cisco:dc:mds:congestion" resource_type IN (congested_device,congested_isl)',
                'Account resource_type resource_id', value, 'max(Metric)', ['san_congestion', 'san_analytics'], '%')
    snapshot('san_switch_health', 'Which SAN switches report the lowest health?', 'dc_san', 'san_health',
             '| rename HealthPct as Metric | table Device Metric | sort 20 Metric', ['san_health', 'san_analytics'], '%')

    for key, label, selector, identity, value in [
        ('hf_nodes_history', 'Hyperfabric observed nodes', 'sourcetype="cisco:dc:hyperfabric:inventory" resource_type=node', 'Account FabricId vendor.nodeId', '1'),
        ('hf_ports_history', 'Hyperfabric observed ports', 'sourcetype="cisco:dc:hyperfabric:inventory" resource_type=port', 'Account FabricId node_id vendor.id', '1'),
        ('hf_enabled_history', 'Hyperfabric administratively enabled ports', 'sourcetype="cisco:dc:hyperfabric:inventory" resource_type=port', 'Account FabricId node_id vendor.id', 'case(lower(\'vendor.enabled\')="true",1,lower(\'vendor.enabled\')="false",0,true(),null())'),
        ('hf_connections_history', 'Hyperfabric reported physical connections', 'sourcetype="cisco:dc:hyperfabric:inventory" resource_type=connection', 'Account FabricId vendor.id', 'if(isnotnull(\'vendor.local.portName\') AND isnotnull(\'vendor.remote.portName\'),1,null())'),
    ]:
        history(key, label, 'dc_hyperfabric', selector, identity, value, 'sum(Metric)', ['hf_inventory', 'reported_links', 'hf_measurements'])
    history('hf_rate_history', 'Hyperfabric measured port egress rate', 'dc_hyperfabric',
            'sourcetype="cisco:dc:hyperfabric:performance" resource_type=port_counter',
            'Account FabricId node_id vendor.portIndex', "tonumber('vendor.outBitsps')/1000000",
            'max(Metric)', ['hf_rates', 'hf_measurements'], 'Mbps')

    return searches
