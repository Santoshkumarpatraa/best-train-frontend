import type { ResolvedSide } from '../services/trainApi';
import { stationCase } from '../lib/format';

/**
 * An area search silently expands to a handful of stations. Showing which ones
 * is the difference between a trustworthy result and a mystery.
 */
function Side({ side, caption }: { side: ResolvedSide; caption: string }) {
  return (
    <div className="resolved__side">
      <span className="resolved__caption">{caption}</span>
      <span className="resolved__label">
        {side.label || side.input}
        <span className={`resolved__type resolved__type--${side.type ?? 'none'}`}>{side.type ?? 'no match'}</span>
      </span>
      <span className="resolved__stations">
        {side.stations.length === 0 && <span className="resolved__empty">no stations matched</span>}
        {side.stations.map((s) => (
          <span key={s.code} className="resolved__chip num" title={stationCase(s.name)}>
            {s.code}
          </span>
        ))}
      </span>
    </div>
  );
}

export default function ResolvedBar({ from, to }: { from: ResolvedSide; to: ResolvedSide }) {
  const pairs = Math.max(from.stations.length, 1) * Math.max(to.stations.length, 1);
  return (
    <div className="resolved">
      <Side side={from} caption="From" />
      <Side side={to} caption="To" />
      <span className="resolved__pairs num" title="Station pairs the API had to query">
        {pairs} pair{pairs === 1 ? '' : 's'}
      </span>
    </div>
  );
}
