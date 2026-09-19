import { useState } from 'react';
import type { NearbyTrain } from '../services/trainApi';
import { clock, durationMinutes, formatDuration, setStats, stationCase } from '../lib/format';
import { usePublishedHeight } from '../lib/useStuck';
import TrainRow from './TrainRow';

function summarise(group: NearbyTrain) {
  let fastest: number | null = null;
  let earliest: string | null = null;
  for (const train of group.trains) {
    const mins = durationMinutes(train);
    if (mins !== null && (fastest === null || mins < fastest)) fastest = mins;
    const dep = clock(train.departure_time);
    if (dep !== '--:--' && (earliest === null || dep < earliest)) earliest = dep;
  }
  return { fastest, earliest };
}

export default function NearbyGateways({
  groups,
  origin,
  destination,
  onOpen,
}: {
  groups: NearbyTrain[];
  origin: string;
  destination: string;
  onOpen?: (trainNumber: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(groups.length === 1 ? 0 : null);
  // Each gateway header pins under this one, whose height changes as the subtitle wraps.
  const headRef = usePublishedHeight('--gateway-head-h');

  return (
    <section className="section section--list">
      <div className="section__head" ref={headRef}>
        <h2 className="section__title">Nearby gateways</h2>
        <p className="section__sub">
          Stations close to your route with their own services. Handy when the direct list is thin.
        </p>
      </div>

      <div className="gateways">
        {groups.map((group, index) => {
          const { fastest, earliest } = summarise(group);
          const isOpen = open === index;
          const fromShifted = group.from_station.code !== origin;
          const toShifted = group.to_station.code !== destination;

          return (
            <div key={`${group.from_station.code}-${group.to_station.code}`} className={`gateway${isOpen ? ' is-open' : ''}`}>
              <button
                type="button"
                className="gateway__head"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span className="gateway__route">
                  <span className="gateway__stop">
                    <span className="num gateway__code">{group.from_station.code}</span>
                    <span className="gateway__name">{stationCase(group.from_station.name)}</span>
                    {fromShifted && group.from_station.distance_km > 0 && (
                      <span className="gateway__shift num">+{group.from_station.distance_km} km</span>
                    )}
                  </span>
                  <span className="gateway__arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="gateway__stop">
                    <span className="num gateway__code">{group.to_station.code}</span>
                    <span className="gateway__name">{stationCase(group.to_station.name)}</span>
                    {toShifted && group.to_station.distance_km > 0 && (
                      <span className="gateway__shift num">+{group.to_station.distance_km} km</span>
                    )}
                  </span>
                </span>

                <span className="gateway__facts num">
                  <span>{group.trains.length} train{group.trains.length === 1 ? '' : 's'}</span>
                  {fastest !== null && <span>{formatDuration(fastest)}</span>}
                  {earliest && <span>from {earliest}</span>}
                </span>

                <span className={`gateway__toggle${isOpen ? ' is-open' : ''}`}>
                  <svg className="chev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>

              {isOpen && (
                <div className="gateway__body">
                  {group.trains.map((train, i) => (
                    <TrainRow key={train.train_number} train={train} stats={setStats(group.trains)} index={i} onOpen={onOpen} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
