import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { getTrainRoute, type RouteStop, type TrainRouteResponse } from '../services/trainApi';
import { DAY_LABELS, clock, formatKm, stationCase, toMinutes, trainName } from '../lib/format';

const RouteMap = lazy(() => import('./RouteMap'));

type Detail = TrainRouteResponse['data'];

/**
 * How long the train actually waits. The clock difference is authoritative;
 * the feed's `halt_time` is MM:SS (a 1-minute stop reads "01:00"), so it is
 * only a fallback for the rare stop with no usable arrival/departure pair.
 */
function haltLabel(stop: RouteStop): string | null {
  const arrive = toMinutes(stop.arrival);
  const depart = toMinutes(stop.departure);

  let mins: number | null = null;
  if (arrive !== null && depart !== null) {
    mins = depart - arrive;
    if (mins < 0) mins += 1440;
  } else if (stop.halt) {
    const match = /^(\d{1,3}):(\d{2})$/.exec(stop.halt.trim());
    if (match) mins = Number(match[1]);
  }

  if (mins === null || mins <= 0) return null;
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m halt` : `${mins} min halt`;
}

export default function TrainDetail({
  trainNumber,
  theme,
  onClose,
}: {
  trainNumber: string;
  theme: 'light' | 'dark';
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const panel = useRef<HTMLDivElement>(null);

  // Keyed by trainNumber upstream, so a different train remounts this and the
  // state starts clean - no reset needed here.
  useEffect(() => {
    const controller = new AbortController();
    getTrainRoute({ number: trainNumber, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setDetail(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Could not load this route.');
      });
    return () => controller.abort();
  }, [trainNumber]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const train = detail?.train;
  const stops = detail?.stops ?? [];

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Train route">
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label="Close route" />

      <div className="sheet__panel" ref={panel} tabIndex={-1}>
        <button type="button" className="sheet__handle" onClick={onClose} aria-label="Close route">
          <span aria-hidden="true" />
        </button>

        <header className="sheet__head">
          <div className="sheet__title">
            <h2>{train ? trainName(train.train_name) : `Train ${trainNumber}`}</h2>
            <span className="sheet__num num">{train?.train_number ?? trainNumber}</span>
          </div>

          <div className="sheet__actions">
            <div className="segmented" role="group" aria-label="View">
              <button
                type="button"
                className={`segmented__btn${view === 'list' ? ' is-active' : ''}`}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
              >
                Stops
              </button>
              <button
                type="button"
                className={`segmented__btn${view === 'map' ? ' is-active' : ''}`}
                aria-pressed={view === 'map'}
                onClick={() => setView('map')}
              >
                Map
              </button>
            </div>
            <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>

        {detail && (
          <p className="sheet__summary">
            <span>
              <b className="num">{detail.totalStops}</b> stops
            </span>
            {detail.totalDistance ? (
              <span>
                <b className="num">{formatKm(detail.totalDistance)}</b>
              </span>
            ) : null}
            {train?.duration ? (
              <span>
                <b className="num">{train.duration.replace(':', 'h ')}m</b>
              </span>
            ) : null}
            <span className="sheet__days">
              {DAY_LABELS.map((day, i) => (
                <span key={day} className={`week__day${train?.runs_on[i] === 1 ? ' is-on' : ''}`}>
                  {day[0]}
                </span>
              ))}
            </span>
          </p>
        )}

        {error && <p className="sheet__error">{error}</p>}
        {!detail && !error && <p className="sheet__loading">Loading route…</p>}

        {detail && (
          <div className={`sheet__body sheet__body--${view}`}>
            <ol className="stops">
              {stops.map((stop, i) => (
                <StopRow
                  key={`${stop.code}-${stop.serial}`}
                  stop={stop}
                  first={i === 0}
                  last={i === stops.length - 1}
                  active={stop.code === active}
                  onSelect={() => {
                    setActive(stop.code);
                    setView('map');
                  }}
                />
              ))}
            </ol>

            <div className="sheet__map">
              <Suspense fallback={<div className="routemap routemap--empty">Loading map…</div>}>
                <RouteMap stops={stops} activeCode={active} theme={theme} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StopRow({
  stop,
  first,
  last,
  active,
  onSelect,
}: {
  stop: RouteStop;
  first: boolean;
  last: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const halt = haltLabel(stop);
  return (
    <li className={`stop${first || last ? ' is-terminus' : ''}${active ? ' is-active' : ''}`}>
      <button type="button" className="stop__btn" onClick={onSelect} disabled={stop.lat === null}>
        <span className="stop__rail" aria-hidden="true">
          <i className="stop__dot" />
        </span>

        <span className="stop__times num">
          <span className="stop__arr">{first ? '-' : clock(stop.arrival)}</span>
          <span className="stop__dep">{last ? '-' : clock(stop.departure)}</span>
        </span>

        <span className="stop__where">
          <span className="stop__name">{stationCase(stop.name)}</span>
          <span className="stop__meta">
            <span className="num">{stop.code}</span>
            {stop.state ? <span>· {stop.state}</span> : null}
            {halt ? <span className="stop__halt">· {halt}</span> : null}
            {stop.boardingDisabled ? <span className="stop__no-board">· no boarding</span> : null}
          </span>
        </span>

        <span className="stop__dist num">
          {stop.distance !== null ? `${stop.distance.toLocaleString('en-IN')} km` : ''}
          {stop.day && stop.day > 1 ? <em className="stop__day">day {stop.day}</em> : null}
        </span>
      </button>
    </li>
  );
}
