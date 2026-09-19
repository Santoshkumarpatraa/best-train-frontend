import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import InstallBanner from '../components/InstallBanner';
import DateStrip from '../components/DateStrip';
import HeroTrain from '../components/HeroTrain';
import Masthead from '../components/Masthead';
import NearbyGateways from '../components/NearbyGateways';
import ResolvedBar from '../components/ResolvedBar';
import SearchRail from '../components/SearchRail';
import Skeleton from '../components/Skeleton';
import SortChips from '../components/SortChips';
import TrainDetail from '../components/TrainDetail';
import TrainRow from '../components/TrainRow';
import {
  getSuggestions,
  searchTrains,
  getTrainsBetweenPlaces,
  getTrainsBetweenStations,
  type NearbyTrain,
  type ResolvedSide,
  type Train,
  type TrainMatch,
} from '../services/trainApi';
import { pushRecent, readRecent, type RecentRoute } from '../lib/recent';
import { usePublishedHeight, useStuck } from '../lib/useStuck';
import {
  approxCount,
  formatISODate,
  setStats,
  sortTrains,
  stationCase,
  trainName,
  type SortKey,
} from '../lib/format';
import { endpointLabel, endpointParam, endpointQuery, parseEndpointParam, sameEndpoint, type Endpoint } from '../lib/endpoint';
import { readQuery, writeQuery, type Query } from '../lib/urlState';

type Problem = 'from' | 'to' | 'same' | string | null;

type SearchResult = {
  mode: 'stations' | 'places';
  from: ResolvedSide;
  to: ResolvedSide;
  date: string;
  trains: Train[];
  otherDays: Train[];
  nearby: NearbyTrain[];
};

/** The station endpoint returns no resolution block, so build one to match. */
function stationSide(endpoint: Endpoint, name: string): ResolvedSide {
  const code = endpoint.code ?? endpoint.query;
  return { input: code, type: 'station', label: stationCase(name), stations: [{ code, name }] };
}

export default function BestTrain({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  // Seeded from the address bar so a shared link is right on the first paint.
  const [query, setQuery] = useState<Query>(readQuery);
  const [from, setFrom] = useState<Endpoint | null>(() => parseEndpointParam(readQuery().from));
  const [to, setTo] = useState<Endpoint | null>(() => parseEndpointParam(readQuery().to));
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [recent, setRecent] = useState<RecentRoute[]>(readRecent);
  const [showOtherDays, setShowOtherDays] = useState(false);
  const [totals, setTotals] = useState<{ stations: number; trains: number; destinations: number } | null>(null);
  const [trainLookup, setTrainLookup] = useState('');
  const [trainMatches, setTrainMatches] = useState<TrainMatch[]>([]);
  const [headStuck, sentinelRef] = useStuck('--nav-h');
  // Section headings stack under the bar, so they need to know how tall it is.
  const barRef = usePublishedHeight('--results-bar-h');
  const inFlight = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (origin: Endpoint, destination: Endpoint, date: string, sort: SortKey) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    setProblem(null);
    setShowOtherDays(false);

    // Only a station pair reaches the endpoint that returns gateways and other-day services.
    const bothStations = origin.kind === 'station' && destination.kind === 'station';

    try {
      let next: SearchResult;
      if (bothStations) {
        const res = await getTrainsBetweenStations({
          from: endpointQuery(origin),
          to: endpointQuery(destination),
          date: date || undefined,
          limit: 60,
          sort,
          order: 'asc',
          signal: controller.signal,
        });
        const sample = res.data.trains[0] ?? res.data.alternate_days?.trains[0];
        next = {
          mode: 'stations',
          from: stationSide(origin, sample?.from_station_name ?? endpointLabel(origin)),
          to: stationSide(destination, sample?.to_station_name ?? endpointLabel(destination)),
          date,
          trains: res.data.trains,
          otherDays: res.data.alternate_days?.trains ?? [],
          nearby: res.data.nearby_trains ?? [],
        };
      } else {
        const res = await getTrainsBetweenPlaces({
          from: endpointQuery(origin),
          to: endpointQuery(destination),
          fromKind: origin.kind,
          toKind: destination.kind,
          date: date || undefined,
          limit: 60,
          sort,
          order: 'asc',
          signal: controller.signal,
        });
        next = {
          mode: 'places',
          from: res.data.from,
          to: res.data.to,
          date,
          trains: res.data.trains,
          otherDays: res.data.alternate_days?.trains ?? [],
          nearby: [],
        };
      }

      if (controller.signal.aborted) return;
      setResult(next);
      pushRecent({ from: origin, to: destination });
      setRecent(readRecent());
    } catch (err) {
      if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return;
      setResult(null);
      setProblem(err instanceof Error ? err.message : 'Could not reach the train service.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const applyQuery = useCallback(
    (next: Query) => {
      const previous = queryRef.current;
      setQuery(next);
      const origin = parseEndpointParam(next.from);
      const destination = parseEndpointParam(next.to);
      setFrom(origin);
      setTo(destination);
      // The route panel is its own history step; the list behind it must not refetch.
      const sameSearch = next.from === previous.from && next.to === previous.to && next.date === previous.date;
      if (origin && destination && !sameSearch) void run(origin, destination, next.date, next.sort);
    },
    [run],
  );

  // One small request seeds the counts; nothing large downloads before the page is usable.
  useEffect(() => {
    let cancelled = false;
    getSuggestions({ q: '', limit: 1 })
      .then((res) => {
        if (!cancelled) {
          setTotals({ stations: res.totalStations, trains: res.totalTrains, destinations: res.totalDestinations });
        }
      })
      .catch(() => undefined);

    const initial = readQuery();
    const origin = parseEndpointParam(initial.from);
    const destination = parseEndpointParam(initial.to);
    if (origin && destination) {
      // Deferred a tick so the first search does not re-render mid-mount.
      queueMicrotask(() => {
        if (!cancelled) void run(origin, destination, initial.date, initial.sort);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [run]);

  // Two digits narrows 6,000-odd trains to a readable list without recalling the whole number.
  useEffect(() => {
    const q = trainLookup.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchTrains({ q, limit: 8, signal: controller.signal })
        .then((trains) => {
          if (!controller.signal.aborted) setTrainMatches(trains);
        })
        .catch(() => undefined);
    }, 160);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trainLookup]);

  // Back/forward should restore the search, not just the address bar.
  useEffect(() => {
    const onPop = () => applyQuery(readQuery());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [applyQuery]);

  const search = (origin: Endpoint, destination: Endpoint, date = query.date) => {
    const next: Query = { ...query, date, from: endpointParam(origin), to: endpointParam(destination) };
    setQuery(next);
    writeQuery(next);
    void run(origin, destination, next.date, next.sort);
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pickDate = (iso: string) => {
    const next = { ...query, date: iso };
    setQuery(next);
    writeQuery(next);
    if (from && to) void run(from, to, iso, next.sort);
  };

  const clearAll = () => {
    setFrom(null);
    setTo(null);
    setResult(null);
    setProblem(null);
    const next: Query = { ...query, from: '', to: '', date: '', train: '' };
    setQuery(next);
    writeQuery(next);
  };

  const submit = () => {
    if (!from) return setProblem('from');
    if (!to) return setProblem('to');
    if (sameEndpoint(from, to)) return setProblem('same');
    search(from, to);
  };

  const openTrain = (trainNumber: string) => {
    const next = { ...query, train: trainNumber };
    setQuery(next);
    writeQuery(next);
  };

  // Same sheet the result rows open, reached straight from the number.
  const openLookupTrain = (trainNumber: string) => {
    openTrain(trainNumber);
    setTrainLookup('');
    setTrainMatches([]);
  };

  const lookupTrain = (event: React.FormEvent) => {
    event.preventDefault();
    const number = trainLookup.trim();
    if (!/^\d{1,5}$/.test(number)) return;
    openLookupTrain(number);
  };

  const closeTrain = () => {
    const next = { ...query, train: '' };
    setQuery(next);
    // Back is the natural way out, but the close button must work too.
    if (readQuery().train) window.history.back();
    else writeQuery(next, true);
  };

  // Sorting is pure presentation - the rows are already here, so never refetch.
  const onSort = (sort: SortKey, desc: boolean) => {
    const next = { ...query, sort, desc };
    setQuery(next);
    writeQuery(next, true);
  };

  const direct = useMemo(
    () => (result ? sortTrains(result.trains, query.sort, query.desc) : []),
    [result, query.sort, query.desc],
  );
  const otherDays = useMemo(
    () => (result ? sortTrains(result.otherDays, query.sort, query.desc) : []),
    [result, query.sort, query.desc],
  );
  const stats = useMemo(() => setStats(direct), [direct]);
  const otherStats = useMemo(() => setStats(otherDays), [otherDays]);

  const gateways = result?.nearby ?? [];
  const isArea = result?.mode === 'places';
  // The date strip shows the day and each card its distance, so only an area search is left to say.
  const routeDetail = result && isArea ? 'area search' : '';
  /** One end of the title: a station shows its code, an area its name. */
  const resolvedHead = (side: ResolvedSide) => ({
    text: side.type === 'station' && side.stations[0] ? side.stations[0].code : side.label || side.input,
    mono: side.type === 'station',
  });

  const searchedHead = (endpoint: Endpoint) => ({
    text: endpoint.kind === 'station' ? (endpoint.code ?? endpoint.query) : endpoint.label,
    mono: endpoint.kind === 'station',
  });

  // A request in flight has not replaced the result, so the title follows what is being searched.
  const headFrom = loading && from ? searchedHead(from) : result ? resolvedHead(result.from) : null;
  const headTo = loading && to ? searchedHead(to) : result ? resolvedHead(result.to) : null;

  return (
    <>
      <Masthead theme={theme} onToggleTheme={onToggleTheme} />

      {!result && (
        <div className="hero">
          <HeroTrain />
          <div className="hero__inner">
            <h1 className="hero__title">
              Every train between <span className="hero__accent">any two places</span> in India.
            </h1>
            <p className="hero__lede">
              Search by station, city, district or state - the whole timetable, sorted by journey time, with nearby
              departure points when nothing runs straight through.
            </p>
            <ul className="hero__stats">
              <li className="hero__stat">
                <b>{approxCount(totals?.stations ?? 8489)}</b>
                <span>Stations</span>
              </li>
              <li className="hero__stat">
                <b>{approxCount(totals?.trains ?? 6347)}</b>
                <span>Trains</span>
              </li>
              <li className="hero__stat">
                <b>{approxCount(totals?.destinations ?? 112)}</b>
                <span>Cities &amp; landmarks</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      <SearchRail
        from={from}
        to={to}
        date={query.date}
        loading={loading}
        problem={problem}
        onFrom={(endpoint) => {
          setFrom(endpoint);
          setProblem(null);
        }}
        onTo={(endpoint) => {
          setTo(endpoint);
          setProblem(null);
        }}
        onDate={(date) => setQuery((q) => ({ ...q, date }))}
        onSwap={() => {
          setFrom(to);
          setTo(from);
        }}
        onClear={clearAll}
        canClear={Boolean(from || to || query.date)}
        onSubmit={submit}
      />

      <main className="page" ref={resultsRef} aria-busy={loading}>
        {loading && !result && <Skeleton />}

        {!loading && !result && (
          <section className="intro">
            <div className="intro__block">
              <h2 className="intro__title">Know the train number?</h2>
              <form className="lookup" onSubmit={lookupTrain}>
                <input
                  className="lookup__input num"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={5}
                  placeholder="12841"
                  aria-label="Train number"
                  value={trainLookup}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, '');
                    setTrainLookup(next);
                    // Cleared here, not in the effect, to avoid a synchronous setState in its body.
                    if (next.trim().length < 2) setTrainMatches([]);
                  }}
                />
                <button type="submit" className="lookup__go" disabled={!/^\d{1,5}$/.test(trainLookup)}>
                  View route
                </button>
              </form>
              {trainMatches.length > 0 && (
                <ul className="lookup__list">
                  {trainMatches.map((match) => (
                    <li key={match.train_number}>
                      <button
                        type="button"
                        className="lookup__option"
                        onClick={() => openLookupTrain(match.train_number)}
                      >
                        <span className="lookup__option-num num">{match.train_number}</span>
                        <span className="lookup__option-name">{trainName(match.train_name)}</span>
                        {match.station_from && match.station_to && (
                          <span className="lookup__option-route">
                            <span className="num">{match.station_from}</span>
                            <span className="lookup__option-arrow" aria-hidden="true">
                              →
                            </span>
                            <span className="num">{match.station_to}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="lookup__hint">Opens the full stop list and route map, the same as tapping a result.</p>
            </div>

            {recent.length > 0 && (
              <div className="intro__block">
                <h2 className="intro__title">Pick up where you left off</h2>
                <div className="intro__routes">
                  {recent.map((route) => (
                    <button
                      key={`${endpointParam(route.from)}-${endpointParam(route.to)}`}
                      type="button"
                      className="route-chip"
                      onClick={() => {
                        setFrom(route.from);
                        setTo(route.to);
                        search(route.from, route.to);
                      }}
                    >
                      <span>{endpointLabel(route.from)}</span>
                      <span aria-hidden="true">→</span>
                      <span>{endpointLabel(route.to)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="intro__block">
              <h2 className="intro__title">How this differs from a booking site</h2>
              <dl className="intro__grid">
                <div>
                  <dt>Whole-network view</dt>
                  <dd>Every train that stops at both stations in the right order, not just the ones with seats left.</dd>
                </div>
                <div>
                  <dt>Search by area</dt>
                  <dd>
                    Type a city, district or state instead of a station and it searches every major stop inside it.
                  </dd>
                </div>
                <div>
                  <dt>Nearby gateways</dt>
                  <dd>No direct service? It looks 100 km around both ends and shows what runs from there.</dd>
                </div>
              </dl>
            </div>
          </section>
        )}

        {result && (
          <>
            <div className="results-head__sentinel" ref={sentinelRef} aria-hidden="true" />
            <div className={`resultsbar${headStuck ? ' is-stuck' : ''}`} ref={barRef}>
              <div className="results-head">
                <div className="results-head__route">
                  <h2 className="results-head__title">
                    <span className={headFrom?.mono ? 'num' : undefined}>{headFrom?.text}</span>
                    <span className="results-head__arrow" aria-hidden="true">
                      →
                    </span>
                    <span className={headTo?.mono ? 'num' : undefined}>{headTo?.text}</span>
                  </h2>
                  {routeDetail && <p className="results-head__detail">{routeDetail}</p>}
                </div>
                {direct.length > 0 && <SortChips sort={query.sort} desc={query.desc} onChange={onSort} />}
              </div>

              <DateStrip date={query.date} onPick={pickDate} />
            </div>

            {loading && <Skeleton />}

            {!loading && isArea && <ResolvedBar from={result.from} to={result.to} />}

            {!loading && (direct.length > 0 ? (
              <section className="section section--list">
                <div className="section__head">
                  <h2 className="section__title">
                    {direct.length} {isArea ? '' : 'direct '}
                    {direct.length === 1 ? 'train' : 'trains'}
                  </h2>
                  <p className="section__sub">
                    {isArea
                      ? 'Each row shows the exact stations this service uses.'
                      : result.date
                        ? `Running on ${formatISODate(result.date)}.`
                        : 'Every service on this route, any day of the week.'}
                  </p>
                </div>
                <div className="rows">
                  {direct.map((train, i) => (
                    <TrainRow
                      key={`${train.train_number}-${train.from_station_code}`}
                      train={train}
                      stats={stats}
                      index={i}
                      date={result.date}
                      onOpen={openTrain}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <div className="notice">
                <h2 className="notice__title">
                  {result.date ? `Nothing found on ${formatISODate(result.date)}` : 'Nothing found'}
                </h2>
                <p className="notice__body">
                  {result.from.type === null || result.to.type === null
                    ? 'One side matched no station, city, district or state. Check the spelling - matching is exact.'
                    : otherDays.length > 0
                      ? 'Services do run on other days of the week - see below.'
                      : gateways.length > 0
                        ? 'Nothing runs straight through, but nearby stations have options.'
                        : 'Nothing in the timetable connects these two directly.'}
                </p>
                {result.date && (
                  <button type="button" className="notice__action" onClick={() => pickDate('')}>
                    Show every day
                  </button>
                )}
              </div>
            ))}

            {!loading && otherDays.length > 0 && (
              <section className={`section section--list${showOtherDays ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="section__head section__head--button"
                  aria-expanded={showOtherDays}
                  onClick={() => setShowOtherDays((v) => !v)}
                >
                  <span>
                    <span className="section__title">{otherDays.length} more on other days</span>
                    <span className="section__sub">
                      {result.date
                        ? `These skip ${formatISODate(result.date)} but run earlier or later in the week.`
                        : 'These run on other days of the week.'}
                    </span>
                  </span>
                  <span className={`section__toggle${showOtherDays ? ' is-open' : ''}`}>
                    <svg className="chev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {showOtherDays && (
                  <div className="rows">
                    {otherDays.map((train, i) => (
                      <TrainRow key={train.train_number} train={train} stats={otherStats} index={i} onOpen={openTrain} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {!loading && gateways.length > 0 && (
              <NearbyGateways
                groups={gateways}
                origin={result.from.stations[0]?.code ?? ''}
                destination={result.to.stations[0]?.code ?? ''}
                onOpen={openTrain}
              />
            )}
          </>
        )}
      </main>

      {query.train && (
        <TrainDetail key={query.train} trainNumber={query.train} theme={theme} onClose={closeTrain} />
      )}

      <InstallBanner />

      <footer className="foot">
        <p>
          Timetable data mirrored from Indian Railways. Times are scheduled, not live - always confirm before you
          travel.
        </p>
      </footer>
    </>
  );
}
