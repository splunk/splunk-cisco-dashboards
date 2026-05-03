import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Activity, Terminal, Code2, Map as MapIcon, Layers } from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type { City } from '@/common/types';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet under bundlers (Vite/Webpack).
// We point Leaflet at the CDN-hosted marker assets so it doesn't try to
// resolve them through bundler-specific URL resolution.
//
// NOTE: This loads three small images from a public CDN at runtime.
// If your environment forbids third-party asset loading, replace these
// URLs with assets shipped in your Splunk app's appserver/static/ folder.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const cities: City[] = [
    {
        id: 'tlh',
        name: 'Tallahassee (State EOC)',
        lat: 30.4383,
        lng: -84.2807,
        status: 'stable',
        importance: 'primary',
        metrics: { events: 1240, alerts: 0, latency: 28 },
        query: 'index=network_logs host="TLH-EOC-*" | stats count by status | where status="error"',
    },
    {
        id: 'mco',
        name: 'Orlando (Regional Hub)',
        lat: 28.5383,
        lng: -81.3792,
        status: 'warning',
        importance: 'primary',
        metrics: { events: 4100, alerts: 12, latency: 145 },
        query: 'index=ops_metrics sourcetype=cisco_spaces location="ORL-HUB" | timechart span=1m avg(client_count)',
    },
    {
        id: 'aub',
        name: 'Auburndale (Logistics)',
        lat: 28.0653,
        lng: -81.7876,
        status: 'critical',
        importance: 'primary',
        metrics: { events: 8200, alerts: 42, latency: 310 },
        query: 'index=security action=blocked src_ip="*" dest_ip="AUB-LOG-01" | top limit=10 src_ip',
    },
    {
        id: 'jax',
        name: 'Jacksonville',
        lat: 30.3322,
        lng: -81.6557,
        status: 'stable',
        importance: 'secondary',
        metrics: { events: 450, alerts: 0, latency: 32 },
        query: 'index=cloud_ops region="US-EAST-1" status=active',
    },
    {
        id: 'tpa',
        name: 'Tampa',
        lat: 27.9506,
        lng: -82.4572,
        status: 'stable',
        importance: 'secondary',
        metrics: { events: 920, alerts: 1, latency: 45 },
        query: 'index=app_logs city="Tampa" | stats avg(response_time)',
    },
    {
        id: 'mia',
        name: 'Miami',
        lat: 25.7617,
        lng: -80.1918,
        status: 'stable',
        importance: 'secondary',
        metrics: { events: 1540, alerts: 2, latency: 52 },
        query: 'index=iot_sensors type=occupancy building="MIA-STRAT"',
    },
];

// Simple HTML escape so city names rendered into Leaflet's divIcon HTML
// can never inject markup. The catalogue is hard-coded today, but
// guarding the boundary keeps us safe if `cities` ever becomes dynamic.
const escapeHtml = (value: string): string =>
    value.replace(/[&<>"']/g, (ch) => {
        switch (ch) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#39;';
            default:
                return ch;
        }
    });

const createCustomIcon = (city: City, isHovered: boolean) => {
    const safeName = escapeHtml(city.name);
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
      <div class="relative flex flex-col items-center group">
        <div class="flex items-center justify-center rounded-full border-2 transition-all p-1 shadow-lg bg-white
          ${city.importance === 'primary' ? 'w-8 h-8' : 'w-5 h-5'}
          ${
              city.status === 'critical'
                  ? 'border-red-500 text-red-600'
                  : city.status === 'warning'
                  ? 'border-amber-500 text-amber-600'
                  : 'border-sky-500 text-sky-600'
          }
          ${isHovered ? 'scale-125 ring-4 ring-sky-100' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${
              city.importance === 'primary' ? 'w-5 h-5' : 'w-3 h-3'
          }">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          ${
              city.status !== 'stable'
                  ? `
            <span class="absolute -top-1 -right-1 flex h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  city.status === 'critical' ? 'bg-red-400' : 'bg-amber-400'
              }"></span>
              <span class="relative inline-flex rounded-full h-3 w-3 ${
                  city.status === 'critical' ? 'bg-red-500' : 'bg-amber-500'
              }"></span>
            </span>
          `
                  : ''
          }
        </div>
        <div class="mt-1 whitespace-nowrap font-black bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded shadow-sm border border-slate-200
          ${
              city.importance === 'primary'
                  ? 'text-[11px] text-slate-800'
                  : 'text-[9px] text-slate-500'
          }">
          ${safeName}
        </div>
      </div>
    `,
        iconSize: city.importance === 'primary' ? [40, 40] : [30, 30],
        iconAnchor: [
            city.importance === 'primary' ? 20 : 15,
            city.importance === 'primary' ? 40 : 30,
        ],
    });
};

export const FloridaMap: React.FC = () => {
    const [hoveredCity, setHoveredCity] = React.useState<City | null>(null);
    const floridaCenter: [number, number] = [27.964157, -81.764832]; // Geocenter of Florida

    return (
        <div className="relative w-full aspect-[4/5] bg-slate-100 overflow-hidden border border-slate-200 rounded-xl shadow-inner group">
            {/* Search Header Overlay */}
            <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200 px-3 py-2 rounded-lg shadow-xl">
                <Search className="w-4 h-4 text-sky-600" />
                <input
                    type="text"
                    placeholder="Run Regional Search..."
                    className="bg-transparent border-none text-xs font-mono focus:outline-none w-40 text-slate-700"
                />
            </div>

            <MapContainer
                center={floridaCenter}
                zoom={7}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
                className="z-10"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />

                <ZoomControl position="bottomright" />

                {/* Primary Network Lines */}
                <Polyline
                    positions={cities
                        .filter((c) => c.importance === 'primary')
                        .map((c) => [c.lat, c.lng])}
                    pathOptions={{
                        color: '#0ea5e9',
                        weight: 2,
                        dashArray: '5, 10',
                        opacity: 0.4,
                    }}
                />

                {cities.map((city) => (
                    <Marker
                        key={city.id}
                        position={[city.lat, city.lng]}
                        icon={createCustomIcon(city, hoveredCity?.id === city.id)}
                        eventHandlers={{
                            mouseover: () => setHoveredCity(city),
                            mouseout: () => setHoveredCity(null),
                        }}
                    />
                ))}
            </MapContainer>

            {/* Tooltip Card - Splunk Search Style */}
            <AnimatePresence>
                {hoveredCity && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        className="absolute top-20 right-6 z-[2000] w-80 bg-[#1a1c1e] text-slate-300 rounded-lg border border-slate-700 shadow-2xl p-0 overflow-hidden"
                    >
                        <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                                <span className="text-[10px] font-mono font-bold tracking-tight text-slate-400 uppercase">
                                    District Analysis: {hoveredCity.id}
                                </span>
                            </div>
                            <div
                                className={cn(
                                    'w-2 h-2 rounded-full',
                                    hoveredCity.status === 'critical'
                                        ? 'bg-red-500'
                                        : hoveredCity.status === 'warning'
                                        ? 'bg-amber-500'
                                        : 'bg-sky-500'
                                )}
                            />
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                        Active SPL Query
                                    </span>
                                    <Activity className="w-3 h-3 text-slate-600" />
                                </div>
                                <div className="bg-black/60 rounded p-2.5 border border-slate-800 font-mono">
                                    <p className="text-[10px] text-sky-200 leading-relaxed break-all">
                                        {hoveredCity.query}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col bg-white/5 p-2 rounded border border-white/5">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        Total Ingest (EPS)
                                    </span>
                                    <span className="text-xl font-black font-mono text-white leading-none">
                                        {hoveredCity.metrics.events.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col bg-white/5 p-2 rounded border border-white/5">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        Triggered Alerts
                                    </span>
                                    <span
                                        className={cn(
                                            'text-xl font-black font-mono leading-none',
                                            hoveredCity.metrics.alerts > 0
                                                ? 'text-red-500'
                                                : 'text-white'
                                        )}
                                    >
                                        {hoveredCity.metrics.alerts}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1 pt-2">
                                <div className="flex items-center gap-2">
                                    <Code2 className="w-3 h-3" />
                                    <span>LATENCY: {hoveredCity.metrics.latency}ms</span>
                                </div>
                                <button className="text-sky-500 hover:text-sky-400 transition-colors bg-sky-500/10 px-2 py-0.5 rounded cursor-pointer">
                                    FULL REPORT
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Map Control Shortcuts Overlay */}
            <div className="absolute bottom-6 left-6 z-[1000] space-y-3">
                <div className="bg-white/90 backdrop-blur-sm border border-slate-200 p-3 rounded-lg shadow-lg max-w-[150px]">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        FDEM Nodes
                    </h5>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-sky-500" />
                                <span className="text-[10px] font-bold text-slate-600">STATE HQ</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">TLH</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="text-[10px] font-bold text-slate-600">REGIONAL</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">MCO</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-[10px] font-bold text-slate-600">LOGISTICS</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">AUB</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button className="bg-white/95 border border-slate-200 p-2 rounded-lg shadow-md hover:bg-slate-50 transition-colors">
                        <MapIcon className="w-4 h-4 text-slate-600" />
                    </button>
                    <button className="bg-white/95 border border-slate-200 p-2 rounded-lg shadow-md hover:bg-slate-50 transition-colors">
                        <Layers className="w-4 h-4 text-slate-600" />
                    </button>
                </div>
            </div>
        </div>
    );
};
