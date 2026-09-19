import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyEvent } from 'react';
import { addDays, formatISODate, todayISO } from '../lib/format';

const WEEKDAYS = [
  { short: 'M', long: 'Monday' },
  { short: 'T', long: 'Tuesday' },
  { short: 'W', long: 'Wednesday' },
  { short: 'T', long: 'Thursday' },
  { short: 'F', long: 'Friday' },
  { short: 'S', long: 'Saturday' },
  { short: 'S', long: 'Sunday' },
];
const MONTH_FMT = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const FULL_FMT = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

type Cell = { iso: string; day: number; muted: boolean; disabled: boolean };

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday-first weekday index: 0 = Monday. */
function weekdayIndex(iso: string): number {
  return (isoToDate(iso).getDay() + 6) % 7;
}

function shiftMonthISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const moved = new Date(y, m - 1 + delta, 1);
  // Clamp rather than roll over: 31 Jan + one month is 28/29 Feb, not 2 March.
  const lastDay = new Date(moved.getFullYear(), moved.getMonth() + 1, 0).getDate();
  const shifted = new Date(moved.getFullYear(), moved.getMonth(), Math.min(d, lastDay));
  return [
    shifted.getFullYear(),
    String(shifted.getMonth() + 1).padStart(2, '0'),
    String(shifted.getDate()).padStart(2, '0'),
  ].join('-');
}

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
  const grid = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  // Reopening on a different date should land on that date's month.
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setMonth((value || today).slice(0, 8) + '01');
  }

  const cells = useMemo(() => monthGrid(month, today), [month, today]);
  const weeks = useMemo(() => Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7)), [cells]);
  const label = useMemo(() => (value ? formatISODate(value) : 'Any day'), [value]);

  // One cell is tabbable and arrows move between them; 42 tab stops is not navigation.
  const [focusISO, setFocusISO] = useState(() => value || today);

  useEffect(() => {
    if (!open) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusISO}"]`)?.focus();
  }, [open, focusISO]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Opening lands on the chosen day, or today when the search is for any day. */
  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const landing = value || today;
    setFocusISO(landing);
    setMonth(landing.slice(0, 8) + '01');
    setOpen(true);
  };

  const pick = (iso: string) => {
    onChange(iso);
    setOpen(false);
    trigger.current?.focus();
  };

  const onGridKey = (event: ReactKeyEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: string | null = null;

    if (event.key in steps) next = addDays(focusISO, steps[event.key]);
    else if (event.key === 'Home') next = addDays(focusISO, -weekdayIndex(focusISO));
    else if (event.key === 'End') next = addDays(focusISO, 6 - weekdayIndex(focusISO));
    else if (event.key === 'PageUp') next = shiftMonthISO(focusISO, -1);
    else if (event.key === 'PageDown') next = shiftMonthISO(focusISO, 1);
    if (!next) return;

    event.preventDefault();
    // Yesterday is not bookable, so walking backwards stops at today.
    if (next < today) next = today;
    setFocusISO(next);
    setMonth(next.slice(0, 8) + '01');
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
        Date
      </span>

      <button
        type="button"
        ref={trigger}
        className={`datefield${open ? ' is-open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby="date-label"
        onClick={toggle}
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

          <div className="cal__grid" role="grid" aria-label="Calendar" ref={grid} onKeyDown={onGridKey}>
            <div className="cal__row" role="row">
              {WEEKDAYS.map((day, i) => (
                <span key={`${day.short}-${i}`} className="cal__wd" role="columnheader" aria-label={day.long}>
                  {day.short}
                </span>
              ))}
            </div>

            {weeks.map((week) => (
              <div className="cal__row" role="row" key={week[0].iso}>
                {week.map((cell) => (
                  <span role="gridcell" key={cell.iso} aria-selected={cell.iso === value}>
                    <button
                      type="button"
                      data-iso={cell.iso}
                      className={`cal__day${cell.muted ? ' is-muted' : ''}${cell.iso === value ? ' is-selected' : ''}${
                        cell.iso === today ? ' is-today' : ''
                      }`}
                      disabled={cell.disabled}
                      tabIndex={cell.iso === focusISO ? 0 : -1}
                      aria-current={cell.iso === today ? 'date' : undefined}
                      aria-label={FULL_FMT.format(isoToDate(cell.iso))}
                      onClick={() => pick(cell.iso)}
                    >
                      {cell.day}
                    </button>
                  </span>
                ))}
              </div>
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
