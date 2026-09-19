/** Mirrors the real card geometry so results land without shifting the page. */
export default function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton__row">
          <div className="skeleton__id">
            <span className="bone bone--md" />
            <span className="bone bone--sm" />
          </div>
          <div className="skeleton__leg">
            <span className="bone bone--time" />
            <span className="bone bone--line" />
            <span className="bone bone--time" />
          </div>
          <div className="skeleton__meta">
            <span className="bone bone--sm" />
            <span className="bone bone--sm" />
          </div>
        </div>
      ))}
    </div>
  );
}
