import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, formatISODate, todayISO } from '../lib/format';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_FMT = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

type Cell = { iso: string; day: number; muted: boolean; disabled: boolean };

/** Six Monday-first weeks covering the given month. */
function monthGrid(anchor: string, min: string): Cell[] {
  const [y, m] = anchor.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(y, m - 1, 1 - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    return { iso, day: d.getDate(), muted: d.getMonth() !== m - 1, disabled: iso < min };
  });
}

export default function DateField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const today = todayISO();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => (value || today).slice(0, 8) + '01');
  const box = useRef<HTMLDivElement>(null);

  // Reopening on a different date should land on that date's month.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setMonth((value || today).slice(0, 8) + '01');
  }

  const cells = useMemo(() => monthGrid(month, today), [month, today]);
  const label = useMemo(() => (value ? formatISODate(value) : 'Any day'), [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const next = new Date(y, m - 1 + delta, 1);
    setMonth([next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0'), '01'].join('-'));
  };

  const [my, mm] = month.split('-').map(Number);
  const atMinMonth = month <= today.slice(0, 8) + '01';

  return (
    <div className="field" ref={box}>
      <span className="field__label" id="date-label">
        Date {!value && <span className="field__hint">any day</span>}
      </span>

      <button
        type="button"
        className={`datefield${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby="date-label"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? '' : 'datefield--empty'}>{label}</span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="cal" role="dialog" aria-label="Choose a date">
          <div className="cal__head">
            <button
              type="button"
              className="cal__nav"
              onClick={() => shiftMonth(-1)}
              disabled={atMinMonth}
              aria-label="Previous month"
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m14 6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <strong className="cal__month">{MONTH_FMT.format(new Date(my, mm - 1, 1))}</strong>
            <button type="button" className="cal__nav" onClick={() => shiftMonth(1)} aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m10 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="cal__grid" role="grid">
            {WEEKDAYS.map((d, i) => (
              <span key={`${d}-${i}`} className="cal__wd">
                {d}
              </span>
            ))}
            {cells.map((cell) => (
              <button
                key={cell.iso}
                type="button"
                className={`cal__day${cell.muted ? ' is-muted' : ''}${cell.iso === value ? ' is-selected' : ''}${
                  cell.iso === today ? ' is-today' : ''
                }`}
                disabled={cell.disabled}
                aria-current={cell.iso === today ? 'date' : undefined}
                onClick={() => pick(cell.iso)}
              >
                {cell.day}
              </button>
            ))}
          </div>

          <div className="cal__foot">
            <button type="button" className="cal__quick" onClick={() => pick(today)}>
              Today
            </button>
            <button type="button" className="cal__quick" onClick={() => pick(addDays(today, 1))}>
              Tomorrow
            </button>
            <button type="button" className="cal__quick cal__quick--clear" onClick={() => pick('')}>
              Any day
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
