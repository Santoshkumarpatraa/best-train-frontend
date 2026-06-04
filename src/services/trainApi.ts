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
