export interface City {
    id: string;
    name: string;
    lat: number;
    lng: number;
    status: 'critical' | 'warning' | 'stable';
    importance: 'primary' | 'secondary';
    metrics: {
        events: number;
        alerts: number;
        latency: number;
    };
    /**
     * Splunk saved-search stanza that powers the "Active SPL Query"
     * preview card and the "Open in Splunk Search" drilldown for this
     * site. Defined in `default/savedsearches.conf` so executives can
     * tweak the analysis without redeploying the React bundle. The
     * map dispatches it as `| savedsearch "<savedSearch>"`.
     */
    savedSearch: string;
}

export interface SearchResult {
    timestamp: string;
    city: string;
    query: string;
    results: number;
}
