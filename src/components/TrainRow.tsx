import type { Train } from '../services/trainApi';
import {
  DAY_LABELS,
  addDays,
  averageSpeed,
  clock,
  dayOffset,
  durationMinutes,
  formatDuration,
  formatISODate,
  formatKm,
  frequencyLabel,
  stationCase,
  tagsFor,
  trainClass,
  trainName,
  type TrainSetStats,
} from '../lib/format';

/** Runs-on strip as letters, which reads faster than boxes at a glance. */
function Days({ runsOn, title }: { runsOn: number[]; title: string }) {
  return (
    <span className="days" title={title} aria-label={`Runs: ${title}`}>
      {DAY_LABELS.map((day, i) => (
        <span key={day} className={`days__d${runsOn[i] === 1 ? ' is-on' : ''}`} aria-hidden="true">
          {day[0]}
        </span>
      ))}
    </span>
  );
}

export default function TrainRow({
  train,
  stats,
  index = 0,
  date = '',
  onOpen,
}: {
  train: Train;
  stats: TrainSetStats;
  index?: number;
  /** Travel date, so each end can show its own calendar day. */
  date?: string;
  onOpen?: (trainNumber: string) => void;
}) {
  const tags = tagsFor(train, stats);
  const plus = dayOffset(train);
  const speed = averageSpeed(train);
  const service = trainClass(train);
  const name = trainName(train.train_name);
  const showService = !name.toLowerCase().includes(service.label.toLowerCase());
  const arriveDate = date ? addDays(date, plus) : '';

  return (
    <article
      className={`jcard${onOpen ? ' is-clickable' : ''}`}
      // Cards stagger in, but only the first handful - past that it is noise.
      style={{ animationDelay: `${Math.min(index, 7) * 45}ms` }}
    >
      {onOpen && (
        // A full-card overlay button keeps the whole card clickable without
        // nesting the heading and badges inside a control.
        <button type="button" className="jcard__open" onClick={() => onOpen(train.train_number)}>
          <span className="sr-only">{`View route and stops for ${name}`}</span>
        </button>
      )}

      <header className="jcard__top">
        <div className="jcard__id">
          <span className="jcard__num num">{train.train_number}</span>
          <h3 className="jcard__name">{name}</h3>
        </div>
        <div className="jcard__badges">
          {showService && <span className={`service service--${service.tone}`}>{service.label}</span>}
          {onOpen && (
            <span className="jcard__routebtn" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" focusable="false">
                <path
                  d="M5 18h6a4 4 0 0 0 4-4V7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="5" cy="18" r="2.6" fill="currentColor" />
                <circle cx="15" cy="6" r="2.6" fill="currentColor" />
              </svg>
            </span>
          )}
        </div>
      </header>

      <div className="jcard__journey">
        <div className="jcard__end">
          <span className="jcard__timeline">
            <time className="jcard__time num">{clock(train.departure_time)}</time>
            {date && <span className="jcard__date">{formatISODate(date)}</span>}
          </span>
          <span className="jcard__place">
            <span className="jcard__code num">{train.from_station_code}</span>
            <span className="jcard__station">{stationCase(train.from_station_name)}</span>
          </span>
        </div>

        <div className="jcard__mid">
          <span className="jcard__dur num">{formatDuration(durationMinutes(train))}</span>
          <span className="jcard__track" aria-hidden="true" />
          <Days runsOn={train.runs_on} title={frequencyLabel(train)} />
          {train.distance_between ? <span className="jcard__dist num">{formatKm(train.distance_between)}</span> : null}
        </div>

        <div className="jcard__end jcard__end--arrive">
          <span className="jcard__timeline">
            <time className="jcard__time num">
              {clock(train.arrival_time)}
              {plus > 0 && <sup className="jcard__plus">+{plus}</sup>}
            </time>
            {arriveDate && <span className="jcard__date">{formatISODate(arriveDate)}</span>}
          </span>
          <span className="jcard__place">
            <span className="jcard__code num">{train.to_station_code}</span>
            <span className="jcard__station">{stationCase(train.to_station_name)}</span>
          </span>
        </div>
      </div>

      <footer className="jcard__meta">
        <span className="jcard__facts">
          {tags.map((tag) => (
            <span key={tag.label} className={`tag tag--${tag.tone}`}>
              {tag.label}
            </span>
          ))}
        </span>
        <span className="jcard__right">
          {speed !== null && <span className="jcard__speed num">{speed} km/h</span>}
        </span>
      </footer>
    </article>
  );
}
