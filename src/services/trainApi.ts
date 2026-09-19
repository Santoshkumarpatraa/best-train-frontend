import { API_BASE_URL } from '../config/env';

export type Train = {
  train_number: string;
  train_name: string;
  duration: string;
  runs_on: number[];
  from_station_code: string;
  from_station_name: string;
  departure_time: string | null;
  to_station_code: string;
  to_station_name: string;
  arrival_time: string | null;
  distance_between: number | null;
};

export type NearbyTrain = {
  from_station: {
    code: string;
    name: string;
    distance_km: number;
  };
  to_station: {
    code: string;
    name: string;
    distance_km: number;
  };
  trains: Train[];
};

export type TrainBetweenStationsResponse = {
  message: string;
  data: {
    totalCount: number;
    trains: Train[];
    nearby_trains: NearbyTrain[];
    date?: string | null;
    dayOfWeek?: number;
    alternate_days?: {
      totalCount: number;
      trains: Train[];
    };
  };
};

export type Station = {
  name: string;
  code: string;
};

export type StationListResponse = {
  message: string;
  data: {
    totalStationCount: number;
    stationList: Station[];
  };
};

export async function getTrainsBetweenStations(params: {
  from: string;
  to: string;
  date?: string;
  skip?: number;
  limit?: number;
  day?: number;
  sort?: 'duration' | 'departure_time' | 'arrival_time';
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}): Promise<TrainBetweenStationsResponse> {
  const baseUrl = API_BASE_URL || '';
  const endpoint = '/train/between/stations';
  const url = baseUrl ? new URL(endpoint, baseUrl) : new URL(endpoint, window.location.origin);
  
  url.searchParams.set('from', params.from);
  url.searchParams.set('to', params.to);
  if (params.date) url.searchParams.set('date', params.date);
  if (params.skip !== undefined) url.searchParams.set('skip', String(params.skip));
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));
  if (params.day !== undefined) url.searchParams.set('day', String(params.day));
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.order) url.searchParams.set('order', params.order);

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch trains' }));
    throw new Error(error.message || `Train fetch failed: ${res.status}`);
  }
  return res.json();
}

export async function getStationList(params: {
  search?: string;
  skip?: number;
  limit?: number;
  popular?: boolean;
  order?: Array<{ columnName: string; direction: boolean }>;
  signal?: AbortSignal;
}): Promise<StationListResponse> {
  const baseUrl = API_BASE_URL || '';
  const endpoint = '/station/list';
  const url = baseUrl ? new URL(endpoint, baseUrl) : new URL(endpoint, window.location.origin);
  
  const body = {
    search: params.search || '',
    skip: params.skip || 0,
    limit: params.limit || 100,
    popular: params.popular,
    order: params.order || [],
  };

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch stations' }));
    throw new Error(error.message || `Station list fetch failed: ${res.status}`);
  }
  return res.json();
}

export type ResolvedType = 'station' | 'city' | 'place' | 'district' | 'state' | null;

export type ResolvedSide = {
  input: string;
  type: ResolvedType;
  label: string | null;
  parent?: string | null;
  stations: Array<{ code: string; name: string }>;
};

export type Suggestion = {
  kind: 'station' | 'city' | 'place' | 'district' | 'state';
  label: string;
  code: string | null;
  stationCount: number;
  /** What to send as `from`/`to` - a station code, or the area's name. */
  query: string;
};

export type TrainBetweenPlacesResponse = {
  message: string;
  data: {
    from: ResolvedSide;
    to: ResolvedSide;
    totalCount: number;
    trains: Train[];
    date?: string | null;
    dayOfWeek?: number;
    alternate_days?: { totalCount: number; trains: Train[] };
  };
};

export async function getSuggestions(params: {
  q: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ suggestions: Suggestion[]; totalStations: number; totalTrains: number; totalDestinations: number }> {
  const endpoint = '/place/suggest';
  const url = API_BASE_URL ? new URL(endpoint, API_BASE_URL) : new URL(endpoint, window.location.origin);
  url.searchParams.set('q', params.q);
  url.searchParams.set('limit', String(params.limit ?? 10));

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) throw new Error(`Suggest failed: ${res.status}`);
  const body: {
    data: { suggestions: Suggestion[]; totalStations: number; totalTrains: number; totalDestinations: number };
  } = await res.json();
  return body.data;
}

/** Either side may be a station code, place, district or state; the API reports what it matched. */
export async function getTrainsBetweenPlaces(params: {
  from: string;
  to: string;
  /** What the user actually picked, so "Delhi" the state is not resolved as the city. */
  fromKind?: string;
  toKind?: string;
  date?: string;
  limit?: number;
  sort?: 'duration' | 'departure_time' | 'arrival_time';
  order?: 'asc' | 'desc';
  signal?: AbortSignal;
}): Promise<TrainBetweenPlacesResponse> {
  const endpoint = '/train/between/places';
  const url = API_BASE_URL ? new URL(endpoint, API_BASE_URL) : new URL(endpoint, window.location.origin);

  url.searchParams.set('from', params.from);
  url.searchParams.set('to', params.to);
  if (params.fromKind) url.searchParams.set('from_kind', params.fromKind);
  if (params.toKind) url.searchParams.set('to_kind', params.toKind);
  if (params.date) url.searchParams.set('date', params.date);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));
  if (params.sort) url.searchParams.set('sort', params.sort);
  if (params.order) url.searchParams.set('order', params.order);

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch trains' }));
    throw new Error(error.message || `Train fetch failed: ${res.status}`);
  }
  return res.json();
}

export type RouteStop = {
  serial: number;
  code: string;
  name: string;
  state: string | null;
  district: string | null;
  arrival: string | null;
  departure: string | null;
  halt: string | null;
  distance: number | null;
  day: number | null;
  routeNumber: string | null;
  boardingDisabled: boolean;
  lat: number | null;
  lng: number | null;
};

export type TrainRouteResponse = {
  message: string;
  data: {
    train: {
      train_number: string;
      train_name: string;
      train_owner: string | null;
      duration: string | null;
      station_from: string | null;
      station_to: string | null;
      runs_on: number[];
    };
    totalStops: number;
    totalDistance: number | null;
    mappedStops: number;
    stops: RouteStop[];
  };
};

export type TrainMatch = {
  train_number: string;
  train_name: string;
  station_from: string | null;
  station_to: string | null;
  duration: string | null;
};

export type TrainSearchResponse = {
  message: string;
  data: { query: string; trains: TrainMatch[] };
};

/** Trains whose number starts with what has been typed. Needs at least 2 digits. */
export async function searchTrains(params: {
  q: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TrainMatch[]> {
  const endpoint = '/train/search';
  const url = API_BASE_URL ? new URL(endpoint, API_BASE_URL) : new URL(endpoint, window.location.origin);
  url.searchParams.set('q', params.q);
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit));

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) throw new Error(`Train search failed: ${res.status}`);
  const body: TrainSearchResponse = await res.json();
  return body.data.trains;
}

export async function getTrainRoute(params: {
  number: string;
  signal?: AbortSignal;
}): Promise<TrainRouteResponse['data']> {
  const endpoint = `/train/${encodeURIComponent(params.number)}/route`;
  const url = API_BASE_URL ? new URL(endpoint, API_BASE_URL) : new URL(endpoint, window.location.origin);

  const res = await fetch(url.toString(), { signal: params.signal });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to load route' }));
    throw new Error(error.message || `Route fetch failed: ${res.status}`);
  }
  const body: TrainRouteResponse = await res.json();
  return body.data;
}
