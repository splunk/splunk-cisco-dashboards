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
    query: string;
}

export interface SearchResult {
    timestamp: string;
    city: string;
    query: string;
    results: number;
}
