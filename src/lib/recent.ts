import type { Endpoint } from './endpoint';

const KEY = 'bt.recent.v2';
const MAX = 6;

export type RecentRoute = { from: Endpoint; to: Endpoint };

const key = (r: RecentRoute) => `${r.from.kind}:${r.from.query}>${r.to.kind}:${r.to.query}`.toLowerCase();

export function readRecent(): RecentRoute[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [];
    return (parsed as RecentRoute[]).filter((r) => r?.from?.query && r?.to?.query).slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecent(route: RecentRoute) {
  try {
    const next = [route, ...readRecent().filter((r) => key(r) !== key(route))];
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX)));
  } catch {
    // Non-essential convenience - failing to persist must never break search.
  }
}
