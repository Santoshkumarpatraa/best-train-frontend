import { addDays, formatISODate, todayISO } from '../lib/format';

const DAYS_AHEAD = 10;

/** Flip travel day without opening the date picker. */
export default function DateStrip({ date, onPick }: { date: string; onPick: (iso: string) => void }) {
  const today = todayISO();
  const days = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i));
  // A date chosen from the picker may sit outside the rolling window.
  if (date && !days.includes(date)) days.unshift(date);

  return (
    <div className="datestrip" role="group" aria-label="Travel date">
      <button
        type="button"
        className={`datechip${date ? '' : ' is-active'}`}
        aria-pressed={!date}
        onClick={() => onPick('')}
      >
        Any day
      </button>

      {days.map((iso) => (
        <button
          key={iso}
          type="button"
          className={`datechip${iso === date ? ' is-active' : ''}`}
          aria-pressed={iso === date}
          onClick={() => onPick(iso)}
        >
          {iso === today ? 'Today' : formatISODate(iso)}
        </button>
      ))}
    </div>
  );
}
