import type { FeatureCollection, Point } from 'geojson';

export type Station = {
  id: string | number;
  name: string;
  code?: string | null;
  name_hi?: string | null;
  name_gu?: string | null;
  district?: string | null;
  state?: string | null;
  address?: string | null;
  trainCount?: number | null;
  utterances?: unknown;
  lng: number;
  lat: number;
};

export type StationSearchResponse = {
  query: string;
  results: Station[];
};

export async function fetchStationsGeoJson(params: {
  bbox: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<FeatureCollection<Point>> {
  const url = new URL('/stations', window.location.origin);
  url.searchParams.set('bbox', params.bbox);
  if (params.limit) url.searchParams.set('limit', String(params.limit));

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) throw new Error(`Stations fetch failed: ${res.status}`);
  return (await res.json()) as FeatureCollection<Point>;
}

export async function searchStations(params: {
  q: string;
  limit?: number;
  mode?: 'any' | 'name' | 'code';
  signal?: AbortSignal;
}): Promise<StationSearchResponse> {
  const url = new URL('/stations/search', window.location.origin);
  url.searchParams.set('q', params.q);
  url.searchParams.set('limit', String(params.limit ?? 20));
  if (params.mode) url.searchParams.set('mode', params.mode);

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) throw new Error(`Station search failed: ${res.status}`);
  return (await res.json()) as StationSearchResponse;
}

