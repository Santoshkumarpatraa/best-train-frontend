import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { RouteStop } from '../services/trainApi';

/**
 * Lazily mounted so maplibre (~285 KB gz) never lands in the main bundle - it
 * only downloads when someone actually opens a train's route.
 */
type Props = { stops: RouteStop[]; activeCode: string | null; theme: 'light' | 'dark' };

/*
 * OpenFreeMap serves keyless vector styles with their own glyphs and sprites.
 * CARTO's basemaps now stamp "API KEY REQUIRED" across every tile.
 */
const BASEMAP = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`;

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
  const mapped = stops.filter((s) => s.lat !== null && s.lng !== null);

  useEffect(() => {
    if (!holder.current || mapped.length === 0 || failed) return;

    let cancelled = false;
    let instance: MapLibreMap | null = null;
    const coords = mapped.map((s) => [s.lng as number, s.lat as number] as [number, number]);
    const dark = theme === 'dark';

    const bounds = coords.reduce<[number, number, number, number]>(
      (b, c) => [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])],
      [coords[0][0], coords[0][1], coords[0][0], coords[0][1]],
    );

    void (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled || !holder.current) return;

        instance = new maplibre.Map({
          container: holder.current,
          attributionControl: { compact: true },
          style: BASEMAP(dark),
          bounds,
          fitBoundsOptions: { padding: 48, maxZoom: 9 },
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
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
    };
    // `mapped` is derived from stops, so stops is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return <div className="routemap" ref={holder} role="img" aria-label="Route map" />;
}
