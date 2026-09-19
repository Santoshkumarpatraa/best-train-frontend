import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { getSuggestions, type Suggestion } from '../services/trainApi';
import { endpointLabel, fromSuggestion, type Endpoint } from '../lib/endpoint';
import { stationCase } from '../lib/format';

type Props = {
  label: string;
  value: Endpoint | null;
  onChange: (endpoint: Endpoint | null) => void;
  placeholder?: string;
  invalid?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
};

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  station: 'Station',
  city: 'City',
  place: 'Landmark',
  district: 'District',
  state: 'State',
};

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
  );
}

export default function StationCombobox({ label, value, onChange, placeholder, invalid, inputRef }: Props) {
  const listId = useId();
  const [draft, setDraft] = useState(() => (value ? endpointLabel(value) : ''));
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // A highlight means "Enter picks this", so nothing is highlighted until typed or arrowed to.
  const [navigated, setNavigated] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Re-sync the text when the selection changes from outside (swap, URL, history).
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setDraft(value ? endpointLabel(value) : '');
  }

  const typed = value && draft === endpointLabel(value) ? '' : draft;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      getSuggestions({ q: typed, limit: 8, signal: controller.signal })
        .then((res) => {
          if (!controller.signal.aborted) setOptions(res.suggestions);
        })
        .catch(() => undefined);
    }, typed ? 160 : 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [typed, open]);

  const [lastTyped, setLastTyped] = useState(typed);
  if (lastTyped !== typed) {
    setLastTyped(typed);
    setActive(0);
    setNavigated(false);
  }

  const showActive = Boolean(typed) || navigated;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const commit = (suggestion: Suggestion) => {
    const endpoint = fromSuggestion(suggestion);
    setLastValue(endpoint);
    setDraft(endpointLabel(endpoint));
    setOpen(false);
    setNavigated(false);
    onChange(endpoint);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      // The first arrow press lands on the top option rather than skipping it.
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      if (!showActive) {
        setNavigated(true);
        setActive(event.key === 'ArrowDown' ? 0 : Math.max(options.length - 1, 0));
        return;
      }
      setActive((i) => (options.length === 0 ? 0 : (i + delta + options.length) % options.length));
      return;
    }
    // With nothing highlighted, Enter belongs to the form, not to this list.
    if (event.key === 'Enter' && open && showActive && options[active]) {
      event.preventDefault();
      commit(options[active]);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setNavigated(false);
      setDraft(value ? endpointLabel(value) : '');
    }
  };

  const optionId = (s: Suggestion, i: number) => `${listId}-${s.kind}-${s.code ?? i}`;
  const badge = useMemo(() => {
    if (!value) return null;
    const text = value.kind === 'station' ? value.code : KIND_LABEL[value.kind];
    // A link-restored station's label is its code, so badging it prints the same letters twice.
    if (!text || text.toLowerCase() === endpointLabel(value).toLowerCase()) return null;
    return text;
  }, [value]);

  return (
    <div className={`combo${invalid ? ' is-invalid' : ''}`} ref={boxRef}>
      <label className="combo__label" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <div className="combo__field">
        <input
          id={`${listId}-input`}
          ref={inputRef}
          className="combo__input"
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && showActive && options[active] ? optionId(options[active], active) : undefined}
          placeholder={placeholder}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            if (value) {
              setLastValue(null);
              onChange(null);
            }
          }}
          onFocus={(event) => {
            setOpen(true);
            event.target.select();
          }}
          onKeyDown={onKeyDown}
        />
        {badge && (
          <span className={`combo__code${value?.kind === 'station' ? ' num' : ' combo__code--area'}`}>{badge}</span>
        )}
      </div>

      {open && options.length > 0 && (
        <ul className="combo__list" id={listId} role="listbox" aria-label={label}>
          {!typed && <li className="combo__caption">Popular destinations</li>}
          {options.map((option, index) => (
            <li
              key={optionId(option, index)}
              id={optionId(option, index)}
              role="option"
              aria-selected={showActive && index === active}
              className={`combo__option${showActive && index === active ? ' is-active' : ''}`}
              onMouseEnter={() => {
                setActive(index);
                setNavigated(true);
              }}
              // Keeps focus on the input so the caret survives the click.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => commit(option)}
            >
              <span className="combo__option-name">
                <Highlight
                  text={option.kind === 'station' ? stationCase(option.label) : option.label}
                  query={typed}
                />
              </span>
              <span className="combo__option-meta">
                {option.code ? (
                  <span className="combo__option-code num">
                    <Highlight text={option.code} query={typed} />
                  </span>
                ) : (
                  <span className="combo__option-count num">{option.stationCount} stn</span>
                )}
                <span className={`combo__option-kind combo__option-kind--${option.kind}`}>
                  {KIND_LABEL[option.kind]}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
