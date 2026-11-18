export const EXAMPLE_TABS = [
    {id: 'overview', label: 'Overview', sections: [
        {id: 'client_health', title: 'Client health observations', description: 'Latest reported counts by client type and health category.',
            spl: '`index_catalyst` sourcetype="cisco:dnac:clienthealth" | stats latest(clientCount) as Clients by clientType scoreType | sort 20 clientType scoreType'},
        {id: 'device_families', title: 'Device inventory by family', description: 'Observed devices by their latest reported family.',
            spl: '`index_catalyst` sourcetype="cisco:dnac:devicehealth" | stats latest(DeviceFamily) as Family by DeviceID | stats count as Devices by Family | sort 20 - Devices'},
    ]},
    {id: 'executive', label: 'Executive Summary', sections: [
        {id: 'issue_priorities', title: 'Reported active issues by priority', description: 'Distinct issue IDs observed as active during the selected window; not a current-state lifecycle reconciliation.',
            spl: '`index_catalyst` sourcetype="cisco:dnac:issue" IssueStatus="active" | stats dc(IssueID) as Issues by IssueSpecificPriority | rename IssueSpecificPriority as Priority | sort 20 Priority'},
        {id: 'device_reachability', title: 'Device reachability', description: 'Latest reported reachability per observed device.',
            spl: '`index_catalyst` sourcetype="cisco:dnac:devicehealth" | stats latest(Reachability) as Reachability by DeviceID | stats count as Devices by Reachability | sort 20 - Devices'},
    ]},
    {id: 'client', label: 'Client Summary', sections: [
        {id: 'wireless_bands', title: 'Wireless clients by band', description: 'Distinct client MAC addresses observed in each radio band.',
            spl: '`index_catalyst` sourcetype="cisco:dnac:client" type="Wireless" | stats dc(macAddress) as Clients by connection.band | rename connection.band as Band | sort 20 - Clients'},
        {id: 'wireless_protocols', title: 'Wireless clients by protocol', description: 'Distinct client MAC addresses observed using each wireless protocol.',
            spl: '`index_catalyst` sourcetype="cisco:dnac:client" type="Wireless" | stats dc(macAddress) as Clients by connection.protocol | rename connection.protocol as Protocol | sort 20 - Clients'},
    ]},
];
export type ExampleSection = typeof EXAMPLE_TABS[number]['sections'][number];
