import type { SortKey } from '../lib/format';

const OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'duration', label: 'Fastest' },
  { key: 'departure_time', label: 'Departs' },
  { key: 'arrival_time', label: 'Arrives' },
];

type Props = {
  sort: SortKey;
  desc: boolean;
  onChange: (sort: SortKey, desc: boolean) => void;
};

export default function SortChips({ sort, desc, onChange }: Props) {
  return (
    <div className="chips" role="group" aria-label="Sort results">
      <span className="chips__label">Sort</span>
      {OPTIONS.map((option) => {
        const isActive = option.key === sort;
        return (
          <button
            key={option.key}
            type="button"
            className={`chip${isActive ? ' is-active' : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(option.key, isActive ? !desc : false)}
          >
            {option.label}
            {isActive && (
              <span className="chip__dir" aria-label={desc ? 'descending' : 'ascending'}>
                {desc ? '↓' : '↑'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
