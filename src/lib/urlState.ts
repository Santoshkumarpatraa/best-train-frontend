import type { SortKey } from './format';

export type Query = {
  from: string;
  to: string;
  date: string;
  sort: SortKey;
  desc: boolean;
  /** Train number whose route panel is open, if any. */
  train: string;
};

const SORTS: SortKey[] = ['duration', 'departure_time', 'arrival_time'];

const AREA_KINDS = ['city', 'place', 'district', 'state'];

/**
 * No `on` param means any day, which is the default. `on=any` is still accepted
 * so links shared before this change keep working.
 */
function readDate(raw: string | null): string {
  if (!raw || raw === 'any') return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

/**
 * A bare value is a station code and is upper-cased; a `kind:` prefixed value
 * is an area and keeps its case, because the resolver treats "PUNE" (station)
 * and "Pune" (city) as different things.
 */
function readEnd(raw: string | null): string {
  const value = (raw ?? '').trim();
  if (!value) return '';
  const at = value.indexOf(':');
  if (at > 0) {
    const kind = value.slice(0, at).toLowerCase();
    const text = value.slice(at + 1).trim().slice(0, 100);
    if (AREA_KINDS.includes(kind)) return text ? `${kind}:${text}` : '';
    if (kind === 'station') return text.toUpperCase().slice(0, 10);
  }
  return value.toUpperCase().slice(0, 10);
}

export function readQuery(search = window.location.search): Query {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  return {
    from: readEnd(params.get('from')),
    to: readEnd(params.get('to')),
    date: readDate(params.get('on')),
    sort: SORTS.includes(sort as SortKey) ? (sort as SortKey) : 'duration',
    desc: params.get('dir') === 'desc',
    train: /^\d{1,5}$/.test(params.get('train') ?? '') ? (params.get('train') as string) : '',
  };
}

/** Keeps the address bar in step with the search so results stay shareable. */
export function writeQuery(query: Query, replace = false) {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.date) params.set('on', query.date);
  if (query.sort !== 'duration') params.set('sort', query.sort);
  if (query.desc) params.set('dir', 'desc');
  if (query.train) params.set('train', query.train);

  const next = params.toString();
  const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
  if (url === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
}
