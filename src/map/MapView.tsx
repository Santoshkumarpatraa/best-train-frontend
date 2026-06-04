import 'maplibre-gl/dist/maplibre-gl.css';

import type { FeatureCollection, Point } from 'geojson';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

import { fetchStationsGeoJson, type Station, searchStations } from './api';
import { DEFAULT_STYLE, OPEN_RAILWAY_MAP } from './styles';

type Props = {
  initialCenter?: [number, number]; // [lng, lat]
  initialZoom?: number;
};

const EMPTY_GEOJSON: FeatureCollection<Point> = {
  type: 'FeatureCollection',
  features: [],
};

// India bounds (lng/lat). Used only for initial view + "Reset to India".
const INDIA_BOUNDS: maplibregl.LngLatBoundsLike = [
  // Practical India bounds for a full-country viewport (includes J&K/Ladakh + southern tip)
  [68.0, 6.0], // SW
  [97.8, 38.8], // NE
];

function inIndia(lng: number, lat: number): boolean {
  return lng >= 68.0 && lng <= 97.8 && lat >= 6.0 && lat <= 38.8;
}

function clampBboxToIndiaOrNull(bbox: maplibregl.LngLatBounds, india: maplibregl.LngLatBounds) {
  const west = Math.max(bbox.getWest(), india.getWest());
  const south = Math.max(bbox.getSouth(), india.getSouth());
  const east = Math.min(bbox.getEast(), india.getEast());
  const north = Math.min(bbox.getNorth(), india.getNorth());
  if (west >= east || south >= north) return null;
  return `${west},${south},${east},${north}`;
}

function debounce<T extends (...args: any[]) => void>(fn: T, waitMs: number) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), waitMs);
  };
}

function fitIndia(map: MapLibreMap, opts?: { duration?: number }) {
  // Fit the full India bounds into the current viewport.
  // This is the most reliable way to ensure ALL of the rectangle is visible,
  // regardless of screen aspect ratio.
  map.resize();
  map.fitBounds(INDIA_BOUNDS, {
    // Smaller padding = bigger "India frame". Also keep top padding smaller than bottom
    // so the rectangle sits a bit higher on the screen.
    padding: { top: 56, bottom: 24, left: 16, right: 16 },
    duration: opts?.duration ?? 0,
  });
}

function stationLabel(s: Station) {
  return s.code ? `${s.name} (${s.code})` : s.name;
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function MapView(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const abortStationsRef = useRef<AbortController | null>(null);
  const abortSearchRef = useRef<AbortController | null>(null);
  const lastBboxRef = useRef<string | null>(null);
  const suppressNextSearchRef = useRef(false);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<Station[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [, setStatus] = useState<string | null>(null);

  // Keep initial view stable across re-renders (avoid recreating the map)
  const initialCenterRef = useRef<[number, number]>(
    // India (approx center)
    props.initialCenter ?? [78.9629, 20.5937]
  );
  const initialZoomRef = useRef<number>(props.initialZoom ?? 4.2);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      center: initialCenterRef.current,
      zoom: initialZoomRef.current,
      renderWorldCopies: false,
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    map.on('load', () => {
      const firstSymbolLayerId = map.getStyle().layers?.find((l) => l.type === 'symbol')?.id;

      // Ensure the initial view shows the full allowed area.
      // Use double rAF so this runs after the first layout/paint.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => fitIndia(map));
      });

      // OpenRailwayMap raster overlay
      map.addSource(OPEN_RAILWAY_MAP.id, {
        type: 'raster',
        tiles: OPEN_RAILWAY_MAP.tiles,
        tileSize: OPEN_RAILWAY_MAP.tileSize,
      });
      map.addLayer({
        id: OPEN_RAILWAY_MAP.id,
        type: 'raster',
        source: OPEN_RAILWAY_MAP.id,
        paint: { 'raster-opacity': 1.0 },
      }, firstSymbolLayerId);

      // Stations source (clustered)
      map.addSource('stations', {
        type: 'geojson',
        data: EMPTY_GEOJSON,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 12,
      });

      map.addLayer({
        id: 'stations-clusters',
        type: 'circle',
        source: 'stations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#2563eb',
          'circle-opacity': 0.85,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            16,
            100,
            20,
            750,
            26,
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      map.addLayer({
        id: 'stations-cluster-count',
        type: 'symbol',
        source: 'stations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12,
        },
        paint: { 'text-color': '#ffffff' },
      });

      map.addLayer({
        id: 'stations-points',
        type: 'circle',
        source: 'stations',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': '#f97316',
          'circle-radius': 5,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });

      map.on('click', 'stations-clusters', async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['stations-clusters'],
        });
        const clusterId = features?.[0]?.properties?.cluster_id;
        const source = map.getSource('stations') as any;
        source.getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
          if (err) return;
          const [lng, lat] = (features[0].geometry as any).coordinates;
          map.easeTo({ center: [lng, lat], zoom });
        });
      });

      map.on('click', 'stations-points', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const [lng, lat] = (f.geometry as any).coordinates;
        const name = String(f.properties?.name ?? 'Station');
        const code = f.properties?.code ? ` (${String(f.properties.code)})` : '';
        const district = f.properties?.district ? String(f.properties.district) : '';
        const state = f.properties?.state ? String(f.properties.state) : '';
        const sub = [district, state].filter(Boolean).join(', ');
        const html = `
          <div class="station-popup-card">
            <div class="station-popup-hero"></div>
            <div class="station-popup-body">
              <div class="station-popup-title">${escapeHtml(name)}${escapeHtml(code)}</div>
              ${sub ? `<div class="station-popup-sub">${escapeHtml(sub)}</div>` : ''}
            </div>
          </div>
        `;
        new maplibregl.Popup({ className: 'station-popup' })
          .setLngLat([lng, lat])
          .setHTML(html)
          .addTo(map);
      });

      const refreshStations = async () => {
        const bbox = map.getBounds();
        const india = maplibregl.LngLatBounds.convert(INDIA_BOUNDS);
        const bboxParam = clampBboxToIndiaOrNull(bbox, india);

        // If user is looking outside India, don't render stations.
        if (!bboxParam) {
          const src = map.getSource('stations') as maplibregl.GeoJSONSource;
          src.setData(EMPTY_GEOJSON);
          setStatus(null);
          return;
        }
        // Avoid refetching if bbox hasn't changed (prevents rapid “blink” loops in dev)
        if (lastBboxRef.current === bboxParam) return;
        lastBboxRef.current = bboxParam;

        abortStationsRef.current?.abort();
        abortStationsRef.current = new AbortController();
        setStatus('Loading stations…');
        try {
          const data = await fetchStationsGeoJson({
            bbox: bboxParam,
            limit: 20000,
            signal: abortStationsRef.current.signal,
          });
          // Extra safety: filter out any out-of-india points.
          data.features = data.features.filter((ft) => {
            const coords = ft.geometry?.coordinates;
            if (!coords) return false;
            const [lng, lat] = coords;
            return inIndia(lng, lat);
          });
          const src = map.getSource('stations') as maplibregl.GeoJSONSource;
          src.setData(data);
          setStatus(null);
        } catch (err: any) {
          if (err?.name === 'AbortError') return;
          setStatus('Failed to load stations (is backend running on :8000?)');
        }
      };

      const refreshStationsDebounced = debounce(refreshStations, 250);
      refreshStations();
      map.on('moveend', refreshStationsDebounced);
    });

    return () => {
      abortStationsRef.current?.abort();
      abortSearchRef.current?.abort();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const query = q.trim();
    if (!query) {
      setResults([]);
      setIsSearching(false);
      abortSearchRef.current?.abort();
      return;
    }

    // Only search when we have enough characters
    if (query.length < 3) {
      setResults([]);
      setIsSearching(false);
      abortSearchRef.current?.abort();
      return;
    }

    // If the user just selected a station from dropdown, we update the input text,
    // but we don't want to immediately re-run search and re-open the dropdown.
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    const run = debounce(async () => {
      abortSearchRef.current?.abort();
      abortSearchRef.current = new AbortController();
      setIsSearching(true);
      try {
        const resp = await searchStations({
          q: query,
          limit: 8,
          mode: 'any',
          signal: abortSearchRef.current.signal,
        });
        setResults(resp.results ?? []);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 1200);

    run();
  }, [q]);

  const onPick = (s: Station) => {
    const map = mapRef.current;
    if (!map) return;
    suppressNextSearchRef.current = true;
    setQ(stationLabel(s));
    setResults([]);
    map.easeTo({ center: [s.lng, s.lat], zoom: Math.max(map.getZoom(), 13.5) });
    const sub = [s.district, s.state].filter(Boolean).join(', ');
    const html = `
      <div class="station-popup-card">
        <div class="station-popup-hero"></div>
        <div class="station-popup-body">
          <div class="station-popup-title">${escapeHtml(stationLabel(s))}</div>
          ${sub ? `<div class="station-popup-sub">${escapeHtml(sub)}</div>` : ''}
        </div>
      </div>
    `;
    new maplibregl.Popup({ className: 'station-popup' })
      .setLngLat([s.lng, s.lat])
      .setHTML(html)
      .addTo(map);
  };

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search stations (name/code)…"
            spellCheck={false}
          />
          {isSearching ? <div className="hint">Searching…</div> : null}
          {results.length ? (
            <div className="results">
              {results.map((r) => (
                <button
                  key={String(r.id)}
                  className="result"
                  onClick={() => onPick(r)}
                  type="button"
                >
                  <div className="result-title">{stationLabel(r)}</div>
                  <div className="result-sub">
                    {[r.district, r.state].filter(Boolean).join(', ')}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div ref={containerRef} className="map" />
    </div>
  );
}

