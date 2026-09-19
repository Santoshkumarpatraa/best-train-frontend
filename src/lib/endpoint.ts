import type { Suggestion } from '../services/trainApi';
import { stationCase } from './format';

/**
 * Either end of a search: a station, or an area (city, landmark, district,
 * state) that the API expands to a ranked list of stations.
 */
export type Endpoint = {
  kind: Suggestion['kind'];
  label: string;
  code: string | null;
  query: string;
  stationCount: number;
};

export function fromSuggestion(s: Suggestion): Endpoint {
  return {
    kind: s.kind,
    label: s.kind === 'station' ? stationCase(s.label) : s.label,
    code: s.code,
    query: s.query,
    stationCount: s.stationCount,
  };
}

export const endpointLabel = (e: Endpoint) => e.label;
export const endpointQuery = (e: Endpoint) => e.query;

/** Station codes round-trip bare; areas carry their kind so "PUNE" and "Pune" stay distinct. */
export function endpointParam(endpoint: Endpoint): string {
  return endpoint.kind === 'station' && endpoint.code ? endpoint.code : `${endpoint.kind}:${endpoint.query}`;
}

const KINDS = new Set(['station', 'city', 'place', 'district', 'state']);

export function parseEndpointParam(raw: string): Endpoint | null {
  if (!raw) return null;
  const at = raw.indexOf(':');
  if (at > 0 && KINDS.has(raw.slice(0, at))) {
    const kind = raw.slice(0, at) as Endpoint['kind'];
    const query = raw.slice(at + 1).trim();
    if (!query) return null;
    return { kind, label: query, code: null, query, stationCount: 0 };
  }
  const code = raw.trim().toUpperCase();
  return { kind: 'station', label: code, code, query: code, stationCount: 1 };
}

export function sameEndpoint(a: Endpoint | null, b: Endpoint | null): boolean {
  if (!a || !b) return false;
  return endpointParam(a).toLowerCase() === endpointParam(b).toLowerCase();
}
