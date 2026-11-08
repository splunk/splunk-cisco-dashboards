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
        query = searches[source]['query'].rsplit('\n| table ', 1)[0] + '\n' + transform + '\n| where isnotnull(Metric)'
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

    # Keep the optional rate query available, but do not spend a factory tile on
    # a measurement this lab does not report.
    searches['hf_rate_history']['section'] = None

    def current(key, title, section, source, transform, details, viz='splunk.bar', unit=''):
        snapshot(key, title, section, source, transform, details, unit)
        searches[key]['viz'] = viz

    def percent(key, title, section, source, expression, details, viz='splunk.singlevalueradial'):
        current(key, title, section, source,
                '| eval Reading=' + expression + '\n| where Reading>=0 AND Reading<=100\n| stats avg(Reading) as Metric | where isnotnull(Metric)',
                details, viz, '%')

    current('attention_severity', 'Items to review by reported severity', 'dc_attention', 'attention',
            '| stats count as Metric by Severity', ['attention'])
    current('attention_fabrics', 'Where are the reported attention items?', 'dc_attention', 'attention',
            '| stats count as Metric by Product Account Fabric | eval Scope=Product." / ".Account." / ".Fabric | table Scope Metric', ['attention', 'events'])
    current('attention_devices', 'Which devices have the most attention items?', 'dc_attention', 'attention',
            '| stats count as Metric by Product Account Device | eval Scope=Product." / ".Account." / ".Device | sort 20 - Metric | table Scope Metric', ['attention', 'inventory_matches'])
    register('attention_critical_history', 'Observed active critical faults and anomalies', 'dc_attention',
             searches['attention_history']['query'].replace('| stats sum(Metric)',
                 '| eval Metric=if(Metric=1,if(lower(severity)="critical",1,0),Metric)\n| stats sum(Metric)'),
             ['attention', 'nd_anomalies', 'aci_faults', 'events'], 'splunk.column')
    percent('attention_critical_share', 'Critical share of classified attention items', 'dc_attention', 'attention',
            'case(Severity="critical",100,Severity IN ("major","minor","warning","info","information"),0,true(),null())', ['attention'])

    current('nd_types', 'Which anomaly types need investigation?', 'dc_nd', 'nd_anomalies',
            '| stats count as Metric by Signal | sort 20 - Metric', ['nd_anomalies'])
    current('nd_scores', 'Highest reported anomaly score by fabric', 'dc_nd', 'nd_anomalies',
            '| stats max(Score) as Metric by Account Fabric | eval Scope=Account." / ".Fabric | table Scope Metric', ['nd_anomalies'])
    current('nd_fabric_types', 'Observed fabrics by management type', 'dc_nd', 'nd_fabrics',
            '| stats count as Metric by FabricType', ['nd_fabrics'])
    percent('nd_reachable_now', 'Latest observed fabric reachability', 'dc_nd', 'nd_fabrics',
            'case(lower(Connectivity)="up",100,lower(Connectivity)="down",0,true(),null())', ['nd_fabrics'])
    history('nd_critical_history', 'Nexus Dashboard active critical anomalies', 'dc_nd', nd, nd_id,
            'if((' + active + ')=1,if(lower(severity)="critical",1,0),' + active + ')',
            'sum(Metric)', ['nd_anomalies', 'events'])

    current('aci_fault_tenants', 'Which ACI tenants have active faults?', 'dc_aci', 'aci_faults',
            '| rex field=Entity "uni/tn-(?<Tenant>[^/]+)" | eval Tenant=coalesce(Tenant,"Tenant not reported") | stats count as Metric by Account Tenant | eval Scope=Account." / ".Tenant | table Scope Metric', ['aci_faults'])
    current('aci_health_bands', 'Observed tenant health score distribution', 'dc_aci', 'aci_health',
            '| where component="fvTenant" AND HealthPct>=0 AND HealthPct<=100 | eval ScoreBand=case(HealthPct<25,"0–24",HealthPct<50,"25–49",HealthPct<75,"50–74",true(),"75–100") | stats count as Metric by ScoreBand', ['aci_health'])
    percent('aci_tenant_health_now', 'Latest observed mean tenant health', 'dc_aci', 'aci_health',
            'if(component="fvTenant",HealthPct,null())', ['aci_health', 'aci_faults'], 'splunk.fillergauge')
    percent('aci_fabric_health_now', 'Latest observed mean fabric health', 'dc_aci', 'aci_health',
            'if(component="fabricHealthTotal",HealthPct,null())', ['aci_health', 'aci_faults'])
    history('aci_critical_history', 'ACI active critical-fault history', 'dc_aci', aci, 'Account Controller dn',
            'if((' + aci_active + ')=1,if(severity="critical",1,0),' + aci_active + ')',
            'sum(Metric)', ['aci_faults', 'events'])

    current('nexus_temperature_comparison', 'Which Celsius sensors are warmest?', 'dc_nexus', 'nexus_sensors',
            '| where lower(Unit) IN ("c","celsius","degrees c") | eval Scope=Account." / ".Device." / ".Sensor | rename Temperature as Metric | sort 20 - Metric | table Scope Metric', ['nexus_sensors'], unit='°C')
    current('nexus_sensor_states', 'Sensors relative to their reported thresholds', 'dc_nexus', 'nexus_sensors',
            '| stats count as Metric by State', ['nexus_sensors'])
    percent('nexus_cpu_now', 'Latest observed mean CPU busy', 'dc_nexus', 'nexus_resources', 'BusyPct', ['nexus_resources'])
    percent('nexus_headroom_now', 'Latest observed mean CPU headroom', 'dc_nexus', 'nexus_resources', 'if(isnotnull(BusyPct),IdlePct,null())', ['nexus_resources'], 'splunk.fillergauge')
    history('nexus_hot_sensor_history', 'Sensors at or above their reported major threshold', 'dc_nexus',
            'sourcetype="cisco:dc:nexus9k:dme" component=eqptSensor', 'Controller DeviceAddress SensorKey',
            "if(isnotnull(tonumber('Row_info.tempValue')) AND isnotnull(tonumber('Row_info.majorThresh')),if(tonumber('Row_info.tempValue')>=tonumber('Row_info.majorThresh'),1,0),null())",
            'sum(Metric)', ['nexus_sensors'])
    searches['nexus_hot_sensor_history']['query'] = searches['nexus_hot_sensor_history']['query'].replace('| eval Bucket=', "| eval SensorKey='Row_info.dn'\n| eval Bucket=", 1)

    current('san_status', 'MDS switches by reported status', 'dc_san', 'san_health',
            '| stats count as Metric by Status', ['san_health', 'san_analytics'])
    percent('san_health_now', 'Latest observed mean MDS switch health', 'dc_san', 'san_health', 'HealthPct', ['san_health', 'san_analytics'])
    current('san_interface_wait', 'Which SAN interfaces report the most transmit wait?', 'dc_san', 'san_congestion',
            '| eval Scope=Account." / ".coalesce(Entity,"Unreported")." / ".coalesce(Interface,"Unreported") | stats max(TxWaitPct) as Metric by Scope | sort 20 - Metric', ['san_congestion', 'san_analytics'], unit='%')

    hf_port = base('sourcetype="cisco:dc:hyperfabric:inventory" resource_type=port') + "\n| eventstats max(_time) as LastObserved by Account FabricId node_id vendor.id | where _time=LastObserved | dedup Account FabricId node_id vendor.id"
    hf_node = base('sourcetype="cisco:dc:hyperfabric:inventory" resource_type=node') + "\n| eventstats max(_time) as LastObserved by Account FabricId vendor.nodeId | where _time=LastObserved | dedup Account FabricId vendor.nodeId"
    for key, title, query in [
        ('hf_port_states', 'Hyperfabric port administrative states', hf_port + "\n| eval State=case(lower('vendor.enabled')=\"true\",\"Enabled\",lower('vendor.enabled')=\"false\",\"Disabled\",true(),\"Unreported\") | stats count as Metric by State"),
        ('hf_ports_by_fabric', 'Observed Hyperfabric ports by fabric', hf_port + '\n| stats count as Metric by Account Fabric | eval Scope=Account." / ".Fabric | table Scope Metric'),
        ('hf_node_roles', 'Observed Hyperfabric node role combinations', hf_node + "\n| eval Roles=coalesce(mvjoin('vendor.roles{}',\", \"),\"Unreported\") | stats count as Metric by Roles"),
        ('hf_node_enabled_now', 'Hyperfabric nodes administratively enabled', hf_node + "\n| eval Reading=case(lower('vendor.enabled')=\"true\",100,lower('vendor.enabled')=\"false\",0,true(),null()) | stats avg(Reading) as Metric"),
        ('hf_connections_by_fabric', 'Reported Hyperfabric physical connections by fabric', base('sourcetype="cisco:dc:hyperfabric:inventory" resource_type=connection') + "\n| eventstats max(_time) as LastObserved by Account FabricId vendor.id | where _time=LastObserved | dedup Account FabricId vendor.id | where len('vendor.local.portName')>0 AND len('vendor.remote.portName')>0 | stats count as Metric by Account Fabric | eval Scope=Account.\" / \".Fabric | table Scope Metric"),
    ]:
        register(key, title, 'dc_hyperfabric', query + '\n| where isnotnull(Metric)',
                 ['hf_nodes' if key in ('hf_node_roles', 'hf_node_enabled_now') else 'hf_ports' if key in ('hf_port_states', 'hf_ports_by_fabric') else 'reported_links', 'hf_inventory', 'hf_measurements', 'events'],
                 'splunk.singlevalueradial' if key == 'hf_node_enabled_now' else 'splunk.bar',
                 '%' if key == 'hf_node_enabled_now' else '',
                 'Latest observed inventory, not a traffic path or operational availability. Administrative state is not link health. Missing measurements stay unknown.')

    # Match the visual grammar to the question: filled history for volume,
    # columns for discrete bucket counts, lines for continuous measurements,
    # ranked bars for entities, and bounded gauges only for measured percentages.
    for key in ['attention_history', 'nd_active_history', 'aci_fabric_health_history',
                'nexus_cpu_history', 'san_health_history', 'san_memory_history', 'hf_ports_history']:
        searches[key]['viz'] = 'splunk.area'
    for key in ['nd_critical_history', 'aci_fault_history', 'aci_critical_history',
                'nexus_hot_sensor_history', 'san_wait_history', 'hf_enabled_history']:
        searches[key]['viz'] = 'splunk.column'
    return searches
