import { useRef } from 'react';
import DateField from './DateField';
import StationCombobox from './StationCombobox';
import type { Endpoint } from '../lib/endpoint';

type Props = {
  from: Endpoint | null;
  to: Endpoint | null;
  date: string;
  loading: boolean;
  problem: string | null;
  onFrom: (endpoint: Endpoint | null) => void;
  onTo: (endpoint: Endpoint | null) => void;
  onDate: (date: string) => void;
  onSwap: () => void;
  onClear: () => void;
  canClear: boolean;
  onSubmit: () => void;
};

export default function SearchRail({
  from,
  to,
  date,
  loading,
  problem,
  onFrom,
  onTo,
  onDate,
  onSwap,
  onClear,
  canClear,
  onSubmit,
}: Props) {
  const fromRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="rail"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="rail__grid">
        <StationCombobox
          label="From"
          value={from}
          onChange={onFrom}
          placeholder="Where from? Station, city or area"
          invalid={problem === 'from'}
          inputRef={fromRef}
        />

        <button type="button" className="swap" onClick={onSwap} aria-label="Swap origin and destination">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M7 4 3 8l4 4" />
            <path d="M3 8h13" />
            <path d="m17 20 4-4-4-4" />
            <path d="M21 16H8" />
          </svg>
        </button>

        <StationCombobox
          label="To"
          value={to}
          onChange={onTo}
          placeholder="Where to? Station, city or area"
          invalid={problem === 'to'}
        />

        <DateField value={date} onChange={onDate} />

        <button
          type="submit"
          className={`go${loading ? ' is-loading' : ''}`}
          disabled={loading || !from || !to}
        >
          {loading ? 'Searching' : 'Find trains'}
        </button>

        <button type="button" className="clear" onClick={onClear} disabled={!canClear}>
          Clear
        </button>
      </div>

      {problem && (
        <p className="rail__problem" role="alert">
          {problem === 'from' && 'Pick a departure point from the list.'}
          {problem === 'to' && 'Pick an arrival point from the list.'}
          {problem === 'same' && 'Origin and destination need to be different.'}
          {problem !== 'from' && problem !== 'to' && problem !== 'same' && problem}
        </p>
      )}
    </form>
  );
}
