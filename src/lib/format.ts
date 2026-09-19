import type { Train } from '../services/trainApi';

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MINUTES_PER_DAY = 1440;

/** "14:05" / "14:05:00" -> 845. Returns null for "--" and other junk the source API emits. */
export function toMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 47 || m > 59) return null;
  return h * 60 + m;
}

/** Clock time, always HH:MM - the API is inconsistent about seconds. */
export function clock(value: string | null | undefined): string {
  const mins = toMinutes(value);
  if (mins === null) return '--:--';
  const h = Math.floor(mins / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** "25:50" -> 1550. A duration is not a clock time and may exceed 24 hours. */
function parseDuration(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,3}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[2]);
  if (minutes > 59) return null;
  return Number(match[1]) * 60 + minutes;
}

export function durationMinutes(train: Train): number | null {
  // Derived from day_count upstream: subtracting clock times turns 25h50m into 1h50m.
  const stated = parseDuration(train.duration);
  if (stated !== null) return stated;

  const dep = toMinutes(train.departure_time);
  const arr = toMinutes(train.arrival_time);
  if (dep === null || arr === null) return null;
  const raw = arr - dep;
  return raw >= 0 ? raw : raw + MINUTES_PER_DAY;
}

export function formatDuration(mins: number | null): string {
  if (mins === null) return '--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}m`;
}

/** Calendar days crossed between departure and arrival: 0 = same day, 1 = "+1". */
export function dayOffset(train: Train): number {
  const dep = toMinutes(train.departure_time);
  const mins = durationMinutes(train);
  if (dep === null || mins === null) return 0;
  return Math.floor((dep + mins) / MINUTES_PER_DAY);
}

export function averageSpeed(train: Train): number | null {
  const mins = durationMinutes(train);
  if (!train.distance_between || mins === null || mins <= 0) return null;
  return Math.round((train.distance_between / mins) * 60);
}

export function runsEveryDay(train: Train): boolean {
  return train.runs_on.length === 7 && train.runs_on.every((d) => d === 1);
}

/** "Daily", "Weekends", or the short day list - whichever is shortest to read. */
export function frequencyLabel(train: Train): string {
  const active = train.runs_on.reduce((n, d) => n + (d === 1 ? 1 : 0), 0);
  if (active === 7) return 'Daily';
  if (active === 0) return 'No schedule';
  if (active === 1) return `${DAY_LABELS[train.runs_on.indexOf(1)]} only`;
  if (active >= 5) {
    const off = train.runs_on.flatMap((d, i) => (d === 1 ? [] : [DAY_LABELS[i]]));
    return `Not ${off.join(', ')}`;
  }
  return train.runs_on.flatMap((d, i) => (d === 1 ? [DAY_LABELS[i]] : [])).join(', ');
}

export type TrainTag = { label: string; tone: 'go' | 'halt' | 'plain' };

/** Relative to the result set: "Fastest" means fastest of what is on screen. */
export function tagsFor(train: Train, set: TrainSetStats): TrainTag[] {
  const tags: TrainTag[] = [];
  const mins = durationMinutes(train);
  if (mins !== null && mins === set.fastestMinutes && set.size > 1) {
    tags.push({ label: 'Fastest', tone: 'go' });
  }
  if (dayOffset(train) > 0) tags.push({ label: 'Overnight', tone: 'plain' });
  if (runsEveryDay(train)) tags.push({ label: 'Daily', tone: 'plain' });
  return tags;
}

export type TrainSetStats = { fastestMinutes: number | null; size: number };

export function setStats(trains: Train[]): TrainSetStats {
  let fastest: number | null = null;
  for (const train of trains) {
    const mins = durationMinutes(train);
    if (mins !== null && (fastest === null || mins < fastest)) fastest = mins;
  }
  return { fastestMinutes: fastest, size: trains.length };
}

export type SortKey = 'duration' | 'departure_time' | 'arrival_time';

/** Sorting happens on data already in hand - changing sort must never hit the network. */
export function sortTrains(trains: Train[], key: SortKey, desc: boolean): Train[] {
  const value = (train: Train): number => {
    if (key === 'duration') return durationMinutes(train) ?? Number.MAX_SAFE_INTEGER;
    const raw = toMinutes(key === 'departure_time' ? train.departure_time : train.arrival_time);
    return raw ?? Number.MAX_SAFE_INTEGER;
  };
  return [...trains].sort((a, b) => {
    const diff = value(a) - value(b);
    if (diff !== 0) return desc ? -diff : diff;
    return a.train_number.localeCompare(b.train_number);
  });
}

const DATE_FMT = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function formatISODate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return DATE_FMT.format(new Date(y, m - 1, d));
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '';
  return `${km.toLocaleString('en-IN')} km`;
}

/** Title-cases the shouty station names the source data ships ("HOWRAH JN"). */
export function stationCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bJn\b/g, 'Jn')
    .trim();
}

/** The feed clips names at 15 characters; only unambiguous "EXPRESS" tails are restored. */
const CLIPPED_SUFFIX = /\b(EXPRES{1,2}|EXPRE|EXPR|EXP|EX)$/;

export function trainName(raw: string): string {
  const restored = raw.trim().replace(CLIPPED_SUFFIX, 'EXPRESS').replace(/\bSPL$/, 'SPECIAL');
  // Station codes embedded in names (NDLS, BKN, CSMT) must not be title-cased.
  return stationCase(restored)
    .split(' ')
    .map((word, i) => {
      const source = restored.split(' ')[i] ?? '';
      const isCode = source.length >= 2 && source.length <= 4 && !/[AEIOU]/.test(source) && /^[A-Z]+$/.test(source);
      return isCode ? source : word;
    })
    .join(' ');
}

export type TrainClass = { label: string; tone: 'premium' | 'fast' | 'express' | 'local' };

const NAMED_CLASSES: Array<[RegExp, TrainClass]> = [
  [/VANDE\s?BHARAT/i, { label: 'Vande Bharat', tone: 'premium' }],
  [/RAJDHANI/i, { label: 'Rajdhani', tone: 'premium' }],
  [/SHATABDI/i, { label: 'Shatabdi', tone: 'premium' }],
  [/DURONTO/i, { label: 'Duronto', tone: 'premium' }],
  [/TEJAS/i, { label: 'Tejas', tone: 'premium' }],
  [/HUMSAFAR/i, { label: 'Humsafar', tone: 'fast' }],
  [/GARIB\s?RATH/i, { label: 'Garib Rath', tone: 'fast' }],
  [/SAMPARK\s?KRANTI/i, { label: 'Sampark Kranti', tone: 'fast' }],
  [/ANTYODAYA/i, { label: 'Antyodaya', tone: 'fast' }],
  [/JAN\s?SHATABDI/i, { label: 'Jan Shatabdi', tone: 'fast' }],
  [/DOUBLE\s?DECKER/i, { label: 'Double Decker', tone: 'fast' }],
  [/INTERCITY/i, { label: 'Intercity', tone: 'express' }],
  [/PASSENGER|\bPASS\b|MEMU|DEMU/i, { label: 'Passenger', tone: 'local' }],
  [/SPECIAL|\bSPL\b/i, { label: 'Special', tone: 'express' }],
];

/** The number series is more reliable than clipped names, but a named service wins. */
export function trainClass(train: Train): TrainClass {
  for (const [pattern, result] of NAMED_CLASSES) {
    if (pattern.test(train.train_name)) return result;
  }
  const series = train.train_number.slice(0, 2);
  if (series === '12' || series === '22' || series === '20') return { label: 'Superfast', tone: 'fast' };
  if (series === '11' || series === '13' || series === '14' || series === '15' || series === '16' || series === '19') {
    return { label: 'Express', tone: 'express' };
  }
  if (series === '05' || series === '06' || series === '07' || series === '08' || series === '09') {
    return { label: 'Special', tone: 'express' };
  }
  if (train.train_number.startsWith('5')) return { label: 'Passenger', tone: 'local' };
  return { label: 'Express', tone: 'express' };
}

/** 8,489 becomes "8,000+", rounding down so the claim is always true. */
export function approxCount(value: number): string {
  if (value < 10) return String(value);
  const step = value >= 1000 ? 1000 : value >= 100 ? 100 : 10;
  return `${(Math.floor(value / step) * step).toLocaleString('en-IN')}+`;
}

/** Shift an ISO date by whole days, staying in local time. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const shifted = new Date(y, m - 1, d + days);
  return [
    shifted.getFullYear(),
    String(shifted.getMonth() + 1).padStart(2, '0'),
    String(shifted.getDate()).padStart(2, '0'),
  ].join('-');
}

