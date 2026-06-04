import type { StyleSpecification } from 'maplibre-gl';

// Lightweight raster basemap (fast to load; labels are baked into tiles).
export const DEFAULT_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    base: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#0b1220' } },
    { id: 'base', type: 'raster', source: 'base' },
  ],
};

export const OPEN_RAILWAY_MAP = {
  id: 'openrailwaymap-standard',
  tiles: [
    'https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    'https://b.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
    'https://c.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
  ],
  tileSize: 256 as const,
  attribution:
    '© OpenRailwayMap contributors · © OpenStreetMap contributors',
};

