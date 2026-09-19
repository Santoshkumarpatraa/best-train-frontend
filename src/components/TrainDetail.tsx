import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { getTrainRoute, type RouteStop, type TrainRouteResponse } from '../services/trainApi';
import { DAY_LABELS, clock, formatKm, stationCase, toMinutes, trainName } from '../lib/format';
import RoutePreview from './RoutePreview';

const RouteMap = lazy(() => import('./RouteMap'));

/** Above this both panes show, so the toggle is hidden and the map must mount unasked. */
const BOTH_PANES = '(min-width: 901px)';

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

type Detail = TrainRouteResponse['data'];

/** Clock difference is authoritative; the feed's MM:SS `halt_time` is only a fallback. */
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
  // maplibre is ~285 KB gz, so it mounts only when asked - a wide screen counts as asking.
  const [mapWanted, setMapWanted] = useState(() => window.matchMedia(BOTH_PANES).matches);
  const panel = useRef<HTMLDivElement>(null);

  // Widening the window reveals the map pane, so it has to mount then too.
  useEffect(() => {
    const query = window.matchMedia(BOTH_PANES);
    const sync = () => {
      if (query.matches) setMapWanted(true);
    };
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    // Both chunks: RouteMap's maplibre import is nested, so fetching it alone is not enough.
    const warm = () => {
      void import('./RouteMap');
      void import('maplibre-gl');
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 1200 })
      : window.setTimeout(warm, 1200);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  // Keyed by trainNumber upstream, so a different train remounts this with clean state.
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

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Traps Tab inside the sheet and hands focus back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;

      const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;

      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    panel.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, []);

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
                onPointerEnter={() => setMapWanted(true)}
                onClick={() => {
                  setView('map');
                  setMapWanted(true);
                }}
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
                    setMapWanted(true);
                  }}
                />
              ))}
            </ol>

            <div className="sheet__map">
              {mapWanted ? (
                <Suspense fallback={<RoutePreview stops={stops} />}>
                  <RouteMap stops={stops} activeCode={active} theme={theme} />
                </Suspense>
              ) : (
                <RoutePreview stops={stops} />
              )}
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
  // Stations without coordinates say so, rather than leaving a dead control.
  const mapped = stop.lat !== null;
  const Row = mapped ? 'button' : 'div';

  return (
    <li className={`stop${first || last ? ' is-terminus' : ''}${active ? ' is-active' : ''}`}>
      <Row
        {...(mapped ? { type: 'button' as const, onClick: onSelect } : {})}
        className={`stop__btn${mapped ? '' : ' stop__btn--static'}`}
      >
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
            {mapped ? null : <span>· not on the map</span>}
          </span>
        </span>

        <span className="stop__dist num">
          {stop.distance !== null ? `${stop.distance.toLocaleString('en-IN')} km` : ''}
          {stop.day && stop.day > 1 ? <em className="stop__day">day {stop.day}</em> : null}
        </span>
      </Row>
    </li>
  );
}
