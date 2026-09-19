/** Mirrors the loaded card, so a result swaps contents rather than re-laying out the page. */
export default function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section className="section section--list skeleton" aria-hidden="true">
      <div className="section__head">
        <span className="bone bone--head" />
        <span className="bone bone--sub" />
      </div>

      <div className="rows">
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
          </div>
        ))}
      </div>
    </section>
  );
}
