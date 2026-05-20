/**
 * FloridaMap — regional health overlay with executive chrome.
 *
 * Restores the original UI surface (search overlay, SITE NODES legend,
 * basemap/layer buttons, zoom control) and layers the dashboard
 * improvements on top:
 *
 *   1. Auto-rotating spotlight — every `spotlightIntervalMs` (default
 *      11 s) we mark the worst-status site as "spotlighted". The
 *      marker gets a sky ring + a tiny status pill in the top-left,
 *      but the camera never pans (so the well-composed Florida frame
 *      is preserved). Hovering the map pauses rotation; clicking a
 *      marker pins it.
 *   2. Animated dashed flow polyline between primary sites — CSS
 *      stroke-dashoffset shimmer suggests live data flow.
 *   3. Pulsing heat halo around the spotlighted non-stable site —
 *      thin ring, no fill, so it accents rather than drowning labels.
 *   4. Theme-aware tile layer — CARTO Voyager (light) /
 *      Dark Matter (dark).
 *
 * The popup card is Splunk-search-styled (mono font, dark surface)
 * regardless of theme so it visually mirrors the Search app.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    MapContainer,
    TileLayer,
    Marker,
    Polyline,
    Circle,
    ZoomControl,
    useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'motion/react';
import {
    Activity,
    Code2,
    ExternalLink,
    Layers,
    Terminal,
    X,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type { City } from '@/common/types';
import {
    getSearchbaseCatalogue,
    type SearchbaseRecord,
} from '@/common/services/searchbaseCatalogue';
import 'leaflet/dist/leaflet.css';

// ----------------------------------------------------------------------------
// Default Leaflet marker shim (CDN-hosted assets)
// ----------------------------------------------------------------------------
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ----------------------------------------------------------------------------
// Catalogue
// ----------------------------------------------------------------------------

// Site catalogue. Intentionally restricted to the 3 strategic locations
// the dashboard cares about (matches the SITE NODES legend below). Add
// more here only if they get a corresponding row in the legend + table.
//
// `savedSearch` is the searchbase.conf `search_name` for the site SPL.
// The popup card pulls the resolved SPL from the searchbase catalogue,
// so what you see is exactly what the app dispatches.
const cities: City[] = [
    {
        id: 'tlh',
        name: 'Tallahassee (State EOC)',
        lat: 30.4383,
        lng: -84.2807,
        status: 'stable',
        importance: 'primary',
        metrics: { events: 1240, alerts: 0, latency: 28 },
        savedSearch: 'Overview - site_tlh',
    },
    {
        id: 'mco',
        name: 'Orlando (Regional Hub)',
        lat: 28.5383,
        lng: -81.3792,
        status: 'warning',
        importance: 'primary',
        metrics: { events: 4100, alerts: 12, latency: 145 },
        savedSearch: 'Overview - site_mco',
    },
    {
        id: 'aub',
        name: 'Auburndale (Logistics)',
        lat: 28.0653,
        lng: -81.7876,
        status: 'critical',
        importance: 'primary',
        metrics: { events: 8200, alerts: 42, latency: 310 },
        savedSearch: 'Overview - site_aub',
    },
];

/**
 * Builds the SPL string we hand to the search bar when the user clicks
 * "Open in Splunk Search". `| savedsearch "..."` dispatches the stanza
 * inside the current app context, so any conf-side change to the
 * stanza is what actually runs.
 */
const buildSiteDispatchSpl = (savedSearch: string): string =>
    `| savedsearch "${savedSearch.replace(/"/g, '\\"')}"`;

const STATUS_RANK: Record<City['status'], number> = {
    critical: 3,
    warning: 2,
    stable: 1,
};

// HTML-escape so divIcon contents can never inject markup if the city
// catalogue ever becomes dynamic.
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

// ----------------------------------------------------------------------------
// Custom marker
// ----------------------------------------------------------------------------

const createCustomIcon = (
    city: City,
    isSelected: boolean,
    isSpotlight: boolean,
    isDark: boolean
) => {
    const safeName = escapeHtml(city.name);
    const ring = isSelected
        ? 'ring-4 ring-sky-300/60 scale-125'
        : isSpotlight
        ? 'ring-4 ring-sky-400/40 scale-110'
        : '';
    const surface = isDark ? 'bg-slate-900 border' : 'bg-white border-2';
    const labelChrome = isDark
        ? 'bg-slate-900/90 backdrop-blur-sm border-slate-700'
        : 'bg-white/90 backdrop-blur-sm border-slate-200';
    const labelType =
        city.importance === 'primary'
            ? isDark
                ? 'text-[11px] text-slate-100'
                : 'text-[11px] text-slate-800'
            : isDark
            ? 'text-[9px] text-slate-400'
            : 'text-[9px] text-slate-500';
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
      <div class="relative flex flex-col items-center group">
        <div class="flex items-center justify-center rounded-full transition-all p-1 shadow-lg ${surface}
          ${city.importance === 'primary' ? 'w-8 h-8' : 'w-5 h-5'}
          ${
              city.status === 'critical'
                  ? 'border-red-500 text-red-500'
                  : city.status === 'warning'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-sky-500 text-sky-500'
          }
          ${ring}">
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
        <div class="mt-1 whitespace-nowrap font-black px-2 py-0.5 rounded shadow-sm border ${labelChrome} ${labelType}">
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

// ----------------------------------------------------------------------------
// Animated CSS
// ----------------------------------------------------------------------------

// Animated dashed-line marching ants + heat halo pulse. Class-scoped so
// they don't bleed onto Splunk's own SVG paths.
const flowAnimationCss = `
    @keyframes florida-map-flow {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: -32; }
    }
    @keyframes florida-map-heat-pulse {
        0%, 100% { stroke-opacity: 0.55; }
        50% { stroke-opacity: 0.85; }
    }
    .florida-map-flow-line {
        animation: florida-map-flow 2.4s linear infinite;
    }
    .florida-map-heat-ring {
        animation: florida-map-heat-pulse 2.6s ease-in-out infinite;
    }
`;

// ----------------------------------------------------------------------------
// Tile layer presets — toggled by the Layers button.
// ----------------------------------------------------------------------------

interface TileLayerPreset {
    id: 'positron' | 'satellite';
    label: string;
    light: string;
    dark: string;
    attribution: string;
}

// Two basemaps only:
//   • Positron (street map, badge "P") — the clean default the user
//     selected in screenshot 1.
//   • Satellite (aerial imagery, badge "S") — screenshot 2.
const TILE_LAYER_PRESETS: TileLayerPreset[] = [
    {
        id: 'positron',
        label: 'Default',
        light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    {
        id: 'satellite',
        label: 'Satellite',
        light:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        dark:
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution:
            'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
    },
];

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

interface FloridaMapProps {
    /** When true, switches to the dark tile + dark marker chrome. */
    isDark?: boolean;
    /** Auto-rotation interval. Set to 0 to disable. */
    spotlightIntervalMs?: number;
    /** How long to pause auto-rotation after a user click. */
    spotlightPauseMs?: number;
    /**
     * Drilldown handler — invoked with a SPL string when the user
     * clicks "Open in Splunk Search" or the SPL preview block on the
     * pinned site card. The container is expected to open the SPL in
     * Splunk's Search & Reporting view under this app's namespace (so
     * saved-search references resolve). When omitted, those
     * affordances are rendered as no-ops.
     */
    onOpenInSearch?: (spl: string) => void;
}

// Default framing for the executive view. Driven by an explicit
// center+zoom (not fitBounds) so the framing is identical regardless
// of container aspect ratio — fitBounds was producing wildly
// different views on portrait vs. landscape panels (sometimes showing
// Atlanta and Cuba on tall-narrow layouts). Tuned to match the
// executive sign-off screenshot: Tallahassee sits at the upper-left,
// Key West at the bottom, and Freeport / Bahamas peeks in on the
// right.
const FLORIDA_DEFAULT_CENTER: [number, number] = [28.0, -83.5];
const FLORIDA_DEFAULT_ZOOM = 6.5;

// Pannable / draggable extent — generous enough that the user can
// scoot east/west by a degree or two to hunt for sites without
// drifting off into the Caribbean or southern Georgia.
const FLORIDA_MAX_BOUNDS: [[number, number], [number, number]] = [
    [22.5, -90.0], // SW — keeps the Gulf and Cuba clipped
    [32.5, -77.0], // NE — keeps southern Georgia and the Bahamas just inside
];

const FLORIDA_LATLNG_MAX_BOUNDS = L.latLngBounds(
    FLORIDA_MAX_BOUNDS[0],
    FLORIDA_MAX_BOUNDS[1]
);

/**
 * Forces Leaflet to (a) re-measure its container after the dashboard
 * grid has finished laying out, and (b) snap back to the executive
 * default center+zoom on every resize.
 *
 * Without `invalidateSize` the map often boots before the parent flex
 * column has a height, so Leaflet pegs zoom to the world (no tiles
 * render — only the slate container background shows through) and
 * the markers float over emptiness.
 *
 * We deliberately do NOT re-`setView` on every resize after mount —
 * that would yank the map back from any spotlight pan/zoom the user
 * has done. Only the initial layout commit and viewport size changes
 * (e.g. window resize) re-apply the default framing.
 */
const MapFitter: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        let firstApply = true;
        const apply = () => {
            map.invalidateSize();
            if (firstApply) {
                map.setView(FLORIDA_DEFAULT_CENTER, FLORIDA_DEFAULT_ZOOM, {
                    animate: false,
                });
                firstApply = false;
            }
        };
        apply();
        const container = map.getContainer();
        const observer = new ResizeObserver(() => apply());
        observer.observe(container);
        return () => observer.disconnect();
    }, [map]);
    return null;
};

export const FloridaMap: React.FC<FloridaMapProps> = ({
    isDark = false,
    spotlightIntervalMs = 11000,
    spotlightPauseMs = 25000,
    onOpenInSearch,
}) => {
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [spotlightCity, setSpotlightCity] = useState<City | null>(null);
    const [paused, setPaused] = useState(false);
    const [tilePresetId, setTilePresetId] = useState<TileLayerPreset['id']>(
        TILE_LAYER_PRESETS[0].id
    );
    const pauseUntilRef = useRef<number>(0);

    // Map of search_name → searchbase entry. Drives both the popup
    // SPL preview and the "Open in Splunk Search" drilldown so the
    // executive sees-and-clicks the literal SPL straight from
    // searchbase.conf — no `| savedsearch "..."` indirection.
    //
    // State is `null` while the first fetch is in flight; we render
    // a "Loading SPL…" placeholder instead of a stale invocation
    // string. On fetch failure we fall back to an empty map and the
    // dispatch form (so the popup still works, just with the
    // saved-search reference).
    const [catalogueByName, setCatalogueByName] = useState<Record<
        string,
        SearchbaseRecord
    > | null>(null);
    useEffect(() => {
        let cancelled = false;
        getSearchbaseCatalogue()
            .then((list) => {
                if (cancelled) return;
                const byName: Record<string, SearchbaseRecord> = {};
                for (const r of list) {
                    if (r.searchName) byName[r.searchName] = r;
                }
                setCatalogueByName(byName);
            })
            .catch(() => {
                if (cancelled) return;
                setCatalogueByName({});
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const selectedRecord = useMemo(() => {
        if (!selectedCity || !catalogueByName) return null;
        return catalogueByName[selectedCity.savedSearch] ?? null;
    }, [selectedCity, catalogueByName]);

    // SPL the popup card renders AND the "Open in Splunk Search"
    // button dispatches — the literal `search` field from
    // searchbase.conf when available, falling back to the
    // `| savedsearch` invocation only if the stanza isn't in
    // searchbase yet. Both consumers share the same string so what
    // the executive reads is exactly what runs.
    const selectedDisplaySpl = selectedCity
        ? selectedRecord?.search?.trim() ||
          buildSiteDispatchSpl(selectedCity.savedSearch)
        : '';

    // Sites ordered worst-first so spotlight starts on the most urgent one.
    const rotationOrder = useMemo(
        () =>
            [...cities].sort(
                (a, b) =>
                    STATUS_RANK[b.status] - STATUS_RANK[a.status] ||
                    b.metrics.alerts - a.metrics.alerts
            ),
        []
    );

    // Auto-rotation: bump spotlight every `spotlightIntervalMs`, but
    // skip if the user is actively interacting (selectedCity set or
    // we're inside the post-click pause window).
    useEffect(() => {
        if (spotlightIntervalMs <= 0 || rotationOrder.length === 0) return undefined;
        let idx = 0;
        const tick = () => {
            const now = Date.now();
            if (paused || pauseUntilRef.current > now || selectedCity) return;
            const next = rotationOrder[idx % rotationOrder.length];
            idx += 1;
            setSpotlightCity(next);
        };
        tick();
        const id = window.setInterval(tick, spotlightIntervalMs);
        return () => window.clearInterval(id);
    }, [rotationOrder, spotlightIntervalMs, paused, selectedCity]);

    // ESC closes the pinned popup.
    useEffect(() => {
        if (!selectedCity) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSelectedCity(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [selectedCity]);

    const handleMarkerClick = (city: City) => {
        // Bump the pause window and toggle selection.
        pauseUntilRef.current = Date.now() + spotlightPauseMs;
        setSelectedCity((current) => (current?.id === city.id ? null : city));
    };

    const handleOpenSelectedInSearch = () => {
        // Drilldown sends the *literal* SPL (same string the popup
        // is showing) so what the executive reads is exactly what
        // runs in Splunk Search.
        if (selectedCity && onOpenInSearch && selectedDisplaySpl) {
            onOpenInSearch(selectedDisplaySpl);
        }
    };

    const cycleTilePreset = () => {
        const i = TILE_LAYER_PRESETS.findIndex((p) => p.id === tilePresetId);
        const next = TILE_LAYER_PRESETS[(i + 1) % TILE_LAYER_PRESETS.length];
        setTilePresetId(next.id);
    };

    const tilePreset =
        TILE_LAYER_PRESETS.find((p) => p.id === tilePresetId) ?? TILE_LAYER_PRESETS[0];
    const tileUrl = isDark ? tilePreset.dark : tilePreset.light;
    const flowColor = isDark ? '#38bdf8' : '#0ea5e9';
    const containerBg = isDark
        ? 'bg-slate-900 border-slate-800'
        : 'bg-slate-100 border-slate-200';
    const overlayChrome = isDark
        ? 'bg-slate-900/90 border-slate-700 text-slate-200 backdrop-blur-md'
        : 'bg-white/95 border-slate-200 text-slate-700 backdrop-blur-md';
    const buttonChrome = isDark
        ? 'bg-slate-900/90 border-slate-700 hover:bg-slate-800 text-slate-200'
        : 'bg-white/95 border-slate-200 hover:bg-slate-50 text-slate-600';

    return (
        <div
            className={cn(
                'relative w-full h-full min-h-[320px] overflow-hidden border rounded-xl shadow-inner group',
                containerBg
            )}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <style>{flowAnimationCss}</style>

            {/* Spotlight pill — hidden when the user has pinned a site. */}
            {!selectedCity && spotlightCity && (
                <div
                    className={cn(
                        'absolute top-3 left-3 z-[999] px-2 py-1 rounded-md border text-[9px] font-bold uppercase tracking-widest pointer-events-none',
                        isDark
                            ? 'bg-slate-900/70 border-slate-700 text-slate-300 backdrop-blur'
                            : 'bg-white/85 border-slate-200 text-slate-500 backdrop-blur'
                    )}
                >
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className={cn(
                                'w-1.5 h-1.5 rounded-full',
                                paused
                                    ? 'bg-slate-400'
                                    : 'bg-emerald-500 animate-pulse'
                            )}
                        />
                        {paused
                            ? 'Spotlight paused'
                            : `Spotlight · ${spotlightCity.id}`}
                    </span>
                </div>
            )}

            <MapContainer
                center={FLORIDA_DEFAULT_CENTER}
                zoom={FLORIDA_DEFAULT_ZOOM}
                maxBounds={FLORIDA_LATLNG_MAX_BOUNDS}
                maxBoundsViscosity={1.0}
                minZoom={5}
                maxZoom={11}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
                // Hide the built-in "Leaflet | © OpenStreetMap …" credit.
                // The CARTO/OSM tile licenses still apply — we keep
                // attribution in the project's NOTICE file rather than
                // burning real-estate in the executive view.
                attributionControl={false}
                className="z-10"
            >
                <MapFitter />

                <TileLayer key={tileUrl} attribution="" url={tileUrl} />

                <ZoomControl position="bottomright" />

                {/* Animated flow lines between primary sites. */}
                <Polyline
                    positions={cities
                        .filter((c) => c.importance === 'primary')
                        .map((c) => [c.lat, c.lng])}
                    pathOptions={{
                        color: flowColor,
                        weight: 1.8,
                        dashArray: '6 10',
                        opacity: 0.55,
                        className: 'florida-map-flow-line',
                    }}
                />

                {/* Heat halo — only on the currently-spotlighted
                    non-stable site so we never have multiple
                    overlapping rings competing for the centre of the
                    state. Subtle ring only (no fill) so it doesn't
                    obscure city labels. */}
                {spotlightCity &&
                    spotlightCity.status !== 'stable' &&
                    !selectedCity && (
                        <Circle
                            key={`heat-${spotlightCity.id}`}
                            center={[spotlightCity.lat, spotlightCity.lng]}
                            radius={28000}
                            pathOptions={{
                                color:
                                    spotlightCity.status === 'critical'
                                        ? '#ef4444'
                                        : '#f59e0b',
                                fillOpacity: 0,
                                weight: 1.2,
                                opacity: 0.55,
                                dashArray: '4 5',
                                className: 'florida-map-heat-ring',
                            }}
                        />
                    )}

                {cities.map((city) => (
                    <Marker
                        key={city.id}
                        position={[city.lat, city.lng]}
                        icon={createCustomIcon(
                            city,
                            selectedCity?.id === city.id,
                            spotlightCity?.id === city.id && !selectedCity,
                            isDark
                        )}
                        eventHandlers={{
                            click: () => handleMarkerClick(city),
                        }}
                    />
                ))}
            </MapContainer>

            {/* Pinned site card — Splunk Search styled, kept dark in
                both themes because it visually mirrors the Search app. */}
            <AnimatePresence>
                {selectedCity && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        className="absolute top-3 right-3 z-[2000] w-72 bg-[#1a1c1e] text-slate-300 rounded-lg border border-slate-700 shadow-2xl overflow-hidden"
                    >
                        <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                                <span className="text-[10px] font-mono font-bold tracking-tight text-slate-400 uppercase">
                                    Site analysis: {selectedCity.id}
                                </span>
                                <div
                                    className={cn(
                                        'w-2 h-2 rounded-full',
                                        selectedCity.status === 'critical'
                                            ? 'bg-red-500'
                                            : selectedCity.status === 'warning'
                                            ? 'bg-amber-500'
                                            : 'bg-sky-500'
                                    )}
                                />
                            </div>
                            <button
                                type="button"
                                aria-label="Close site details"
                                onClick={() => setSelectedCity(null)}
                                className="text-slate-500 hover:text-white transition-colors p-0.5 rounded hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="p-3 space-y-3">
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                        Active SPL query
                                    </span>
                                    <Activity className="w-3 h-3 text-slate-600" />
                                </div>
                                {onOpenInSearch ? (
                                    <button
                                        type="button"
                                        onClick={handleOpenSelectedInSearch}
                                        title="Open this query in Search"
                                        className="w-full text-left bg-black/60 hover:bg-black/80 rounded p-2 border border-slate-800 hover:border-sky-700 font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500"
                                    >
                                        {catalogueByName === null ? (
                                            <p className="text-[10px] text-slate-500 italic leading-relaxed">
                                                Loading saved-search SPL…
                                            </p>
                                        ) : (
                                            <p className="text-[10px] text-sky-200 leading-relaxed whitespace-pre-wrap break-all">
                                                {selectedDisplaySpl}
                                            </p>
                                        )}
                                    </button>
                                ) : (
                                    <div className="bg-black/60 rounded p-2 border border-slate-800 font-mono">
                                        <p className="text-[10px] text-sky-200 leading-relaxed whitespace-pre-wrap break-all">
                                            {selectedDisplaySpl}
                                        </p>
                                    </div>
                                )}
                                <p
                                    className="text-[9px] font-mono text-slate-500 truncate"
                                    title={`Source: searchbase.conf · search_name "${selectedCity.savedSearch}"`}
                                >
                                    via searchbase &quot;{selectedCity.savedSearch}&quot;
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col bg-white/5 p-2 rounded border border-white/5">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        Total ingest (EPS)
                                    </span>
                                    <span className="text-lg font-black font-mono text-white leading-none">
                                        {selectedCity.metrics.events.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col bg-white/5 p-2 rounded border border-white/5">
                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                        Triggered alerts
                                    </span>
                                    <span
                                        className={cn(
                                            'text-lg font-black font-mono leading-none',
                                            selectedCity.metrics.alerts > 0
                                                ? 'text-red-500'
                                                : 'text-white'
                                        )}
                                    >
                                        {selectedCity.metrics.alerts}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1 pt-1">
                                <div className="flex items-center gap-1.5">
                                    <Code2 className="w-3 h-3" />
                                    <span>
                                        Latency: {selectedCity.metrics.latency} ms
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleOpenSelectedInSearch}
                                    disabled={!onOpenInSearch}
                                    className={cn(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500',
                                        onOpenInSearch
                                            ? 'text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer'
                                            : 'text-slate-500 bg-slate-700/30 cursor-not-allowed'
                                    )}
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Open in Search
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom-left: SITE NODES legend + map/layers buttons. */}
            <div className="absolute bottom-6 left-4 z-[1000] space-y-3 pointer-events-auto">
                <div
                    className={cn(
                        'border p-3 rounded-lg shadow-lg max-w-[150px]',
                        overlayChrome
                    )}
                >
                    <h5
                        className={cn(
                            'text-[10px] font-black uppercase tracking-[0.2em] mb-3',
                            isDark ? 'text-slate-400' : 'text-slate-400'
                        )}
                    >
                        Site Nodes
                    </h5>
                    <div className="space-y-2">
                        <LegendRow
                            color="bg-sky-500"
                            label="STATE HQ"
                            id="TLH"
                            isDark={isDark}
                        />
                        <LegendRow
                            color="bg-amber-500"
                            label="REGIONAL"
                            id="MCO"
                            isDark={isDark}
                        />
                        <LegendRow
                            color="bg-red-500"
                            label="LOGISTICS"
                            id="AUB"
                            isDark={isDark}
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={cycleTilePreset}
                    title={`Tiles · ${tilePreset.label}. Click to cycle.`}
                    aria-label={`Switch base map (current: ${tilePreset.label})`}
                    className={cn(
                        'border p-2 rounded-lg shadow-md transition-colors focus:outline-none focus:ring-1 focus:ring-sky-400 relative',
                        buttonChrome
                    )}
                >
                    <Layers className="w-4 h-4" />
                    <span className="absolute -bottom-1 -right-1 px-1 py-0.5 rounded text-[7px] font-bold uppercase tracking-widest bg-sky-500 text-white shadow-sm">
                        {tilePreset.id.charAt(0)}
                    </span>
                </button>
            </div>
        </div>
    );
};

interface LegendRowProps {
    color: string;
    label: string;
    id: string;
    isDark: boolean;
}

const LegendRow: React.FC<LegendRowProps> = ({ color, label, id, isDark }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', color)} />
            <span
                className={cn(
                    'text-[10px] font-bold',
                    isDark ? 'text-slate-300' : 'text-slate-600'
                )}
            >
                {label}
            </span>
        </div>
        <span
            className={cn(
                'text-[10px] font-mono',
                isDark ? 'text-slate-500' : 'text-slate-400'
            )}
        >
            {id}
        </span>
    </div>
);
