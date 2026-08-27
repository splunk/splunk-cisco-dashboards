export type MapTileStyleId =
  | "street"
  | "satellite"
  | "terrain"
  | "dark-ops"
  | "navigation"
  | "offline";

export interface MapTileStylePreset {
  id: MapTileStyleId;
  label: string;
  lightUrl: string;
  darkUrl: string;
  attribution: string;
}

const OFFLINE_MAP_TILE_LIGHT_URL =
  "/static/app/splunk-cisco-dashboards/offline-map-tile-light.png";

const OFFLINE_MAP_TILE_DARK_URL =
  "/static/app/splunk-cisco-dashboards/offline-map-tile-dark.png";

export const MAP_TILE_STYLE_PRESETS: readonly MapTileStylePreset[] = [
  {
    id: "street",
    label: "Street",
    lightUrl:
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    darkUrl:
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
  },
  {
    id: "satellite",
    label: "Satellite",
    lightUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    darkUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "terrain",
    label: "Terrain",
    lightUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    darkUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "dark-ops",
    label: "Dark Ops",
    lightUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    darkUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "navigation",
    label: "Navigation",
    lightUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    darkUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  {
    id: "offline",
    label: "Offline Grid",
    lightUrl: OFFLINE_MAP_TILE_LIGHT_URL,
    darkUrl: OFFLINE_MAP_TILE_DARK_URL,
    attribution: "Bundled offline coordinate grid",
  },
];

export const defaultMapTileStyleId = (isDark: boolean): MapTileStyleId =>
  isDark ? "street" : "terrain";
