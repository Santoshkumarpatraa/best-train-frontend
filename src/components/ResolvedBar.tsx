import type { ResolvedSide } from '../services/trainApi';
import { stationCase } from '../lib/format';

/** An area search silently expands to several stations; this says which. */
function Side({ side, caption }: { side: ResolvedSide; caption: string }) {
  return (
    <div className="resolved__side">
      <span className="resolved__caption">{caption}</span>
      <span className="resolved__label">
        {side.label || side.input}
        <span className={`resolved__type resolved__type--${side.type ?? 'none'}`}>{side.type ?? 'no match'}</span>
      </span>
      {/* A plain station side is already named by the label above - only an area
          expands to a list worth spelling out. */}
      {(side.type !== 'station' || side.stations.length === 0) && (
        <span className="resolved__stations">
          {side.stations.length === 0 && <span className="resolved__empty">no stations matched</span>}
          {side.stations.map((s) => (
            <span key={s.code} className="resolved__chip">
              <span className="num">{s.code}</span> {stationCase(s.name)}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

export default function ResolvedBar({ from, to }: { from: ResolvedSide; to: ResolvedSide }) {
  const searched = Math.max(from.stations.length, 1) * Math.max(to.stations.length, 1);
  return (
    <div className="resolved">
      <Side side={from} caption="From" />
      <Side side={to} caption="To" />
      <span className="resolved__pairs">
        Searched <b className="num">{searched}</b> station {searched === 1 ? 'pairing' : 'pairings'}
      </span>
    </div>
  );
}
