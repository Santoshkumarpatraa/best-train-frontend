import type { RouteStop } from '../services/trainApi';

/** The route from stop coordinates alone, painting on the first frame while maplibre downloads. */
export default function RoutePreview({ stops }: { stops: RouteStop[] }) {
  const points = stops.filter((s) => s.lat !== null && s.lng !== null);
  if (points.length < 2) return <div className="routemap routemap--empty">Loading map…</div>;

  const lngs = points.map((s) => s.lng as number);
  const lats = points.map((s) => s.lat as number);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  // Keep the shape's aspect ratio rather than stretching it to the viewBox.
  const spanLng = Math.max(maxLng - minLng, 0.01);
  const spanLat = Math.max(maxLat - minLat, 0.01);
  const span = Math.max(spanLng, spanLat);
  const offsetX = (span - spanLng) / 2;
  const offsetY = (span - spanLat) / 2;

  const coords = points.map((s) => ({
    x: ((s.lng as number) - minLng + offsetX) / span * 100,
    // SVG y grows downward; latitude grows north.
    y: (1 - ((s.lat as number) - minLat + offsetY) / span) * 100,
  }));

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ');
  const last = coords.length - 1;

  return (
    <div className="routemap routepreview" role="img" aria-label="Route outline, map still loading">
      <svg viewBox="-6 -6 112 112" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <path d={path} className="routepreview__line" />
        {coords.map((c, i) => (
          <circle
            key={`${points[i].code}-${points[i].serial}`}
            cx={c.x}
            cy={c.y}
            r={i === 0 || i === last ? 2.6 : 1.2}
            className={i === 0 || i === last ? 'routepreview__end' : 'routepreview__stop'}
          />
        ))}
      </svg>
      <span className="routepreview__note">Loading map…</span>
    </div>
  );
}
