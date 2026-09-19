import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { RouteStop } from '../services/trainApi';
import RoutePreview from './RoutePreview';

/** Lazily mounted so maplibre (~285 KB gz) never lands in the main bundle. */
type Props = { stops: RouteStop[]; activeCode: string | null; theme: 'light' | 'dark' };

/* OpenFreeMap is keyless; CARTO now stamps "API KEY REQUIRED" across every tile. */
const BASEMAP = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`;

/** Phones get the map pared back to what a route overview actually needs. */
const isSmallScreen = () => window.matchMedia('(max-width: 900px)').matches;

/** Place names orient the route; everything else labelled does not. */
const KEPT_LABELS = 'place';

/** Drops road, water and airport labels on phones; keyed on source-layer, as light and dark name layers differently. */
async function leanStyle(url: string, signal: AbortSignal): Promise<StyleSpecification | string> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return url;
    const style = (await res.json()) as StyleSpecification;
    style.layers = style.layers.filter(
      (layer) => layer.type !== 'symbol' || layer['source-layer'] === KEPT_LABELS,
    );
    return style;
  } catch {
    // Not worth failing the map over - maplibre can fetch the full style.
    return url;
  }
}

/** maplibre needs WebGL; some devices and locked-down browsers have none. */
function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

export default function RouteMap({ stops, activeCode, theme }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [failed, setFailed] = useState(() => !hasWebGL());
  // The SVG route covers the empty canvas until the map's first paint.
  const [painted, setPainted] = useState(false);
  const mapped = stops.filter((s) => s.lat !== null && s.lng !== null);

  useEffect(() => {
    if (!holder.current || mapped.length === 0 || failed) return;

    let cancelled = false;
    let instance: MapLibreMap | null = null;
    const styleFetch = new AbortController();
    let revealBackstop = 0;
    const reveal = () => {
      if (!cancelled) setPainted(true);
    };
    setPainted(false);
    const coords = mapped.map((s) => [s.lng as number, s.lat as number] as [number, number]);
    const dark = theme === 'dark';

    const bounds = coords.reduce<[number, number, number, number]>(
      (b, c) => [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])],
      [coords[0][0], coords[0][1], coords[0][0], coords[0][1]],
    );

    const small = isSmallScreen();

    void (async () => {
      try {
        const [maplibre, style] = await Promise.all([
          import('maplibre-gl'),
          small ? leanStyle(BASEMAP(dark), styleFetch.signal) : Promise.resolve(BASEMAP(dark)),
        ]);
        if (cancelled || !holder.current) return;

        instance = new maplibre.Map({
          container: holder.current,
          attributionControl: { compact: true },
          style,
          bounds,
          fitBoundsOptions: { padding: small ? 24 : 48, maxZoom: 9 },
          // Nothing pitches or rotates, and the cross-fade only costs frames.
          fadeDuration: 0,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          refreshExpiredTiles: false,
        });

        map.current = instance;
        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

        instance.on('load', () => {
          if (cancelled || !instance || instance.getLayer('route-line')) return;

          instance.addSource('route', {
            type: 'geojson',
            data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } },
          });
          instance.addLayer({
            id: 'route-casing',
            type: 'line',
            source: 'route',
            paint: { 'line-color': dark ? '#0d0f12' : '#ffffff', 'line-width': 7, 'line-opacity': 0.9 },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          });
          instance.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            paint: { 'line-color': dark ? '#ff7a45' : '#c9400c', 'line-width': 3 },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          });

          instance.addSource('stops', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: mapped.map((s, i) => ({
                type: 'Feature' as const,
                properties: { code: s.code, terminus: i === 0 || i === mapped.length - 1 ? 1 : 0 },
                geometry: { type: 'Point' as const, coordinates: [s.lng as number, s.lat as number] },
              })),
            },
          });
          instance.addLayer({
            id: 'stop-dots',
            type: 'circle',
            source: 'stops',
            paint: {
              'circle-radius': ['case', ['==', ['get', 'terminus'], 1], 7, 4.5],
              'circle-color': [
                'case',
                ['==', ['get', 'terminus'], 1],
                dark ? '#ff7a45' : '#c9400c',
                dark ? '#16191e' : '#ffffff',
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': dark ? '#ff7a45' : '#c9400c',
            },
          });
        });

        /* `load` is the first complete render; `idle` waits for every tile and hid a readable map for seconds. */
        instance.once('load', reveal);
        revealBackstop = window.setTimeout(reveal, 2500);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      styleFetch.abort();
      window.clearTimeout(revealBackstop);
      instance?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mapped derives from stops
  }, [stops, theme, failed]);

  // Fly to whichever stop the list has highlighted.
  useEffect(() => {
    const target = mapped.find((s) => s.code === activeCode);
    if (!map.current || !target) return;
    map.current.flyTo({ center: [target.lng as number, target.lat as number], zoom: 8, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCode]);

  if (mapped.length === 0) {
    return <div className="routemap routemap--empty">No coordinates for this route&apos;s stops.</div>;
  }

  if (failed) {
    return (
      <div className="routemap routemap--empty">
        This browser cannot display the map. The stop list has the full route.
      </div>
    );
  }

  return (
    <>
      <div className="routemap" ref={holder} role="img" aria-label="Route map" />
      {!painted && <RoutePreview stops={stops} />}
    </>
  );
}
