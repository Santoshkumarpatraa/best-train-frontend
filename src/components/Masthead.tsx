type Props = { theme: 'light' | 'dark'; onToggleTheme: () => void };

/**
 * The mark is the route line the app draws everywhere else: two stops joined
 * by a track, rather than a literal train.
 */
function Logo() {
  return (
    <span className="mark__glyph" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" focusable="false">
        <path
          d="M7 25h9a9 9 0 0 0 9-9V7"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7" cy="25" r="4.2" fill="currentColor" />
        <circle cx="25" cy="7" r="4.2" fill="currentColor" />
      </svg>
    </span>
  );
}

function ThemeToggle({ theme, onToggleTheme }: Props) {
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="toggle"
      role="switch"
      aria-checked={dark}
      onClick={onToggleTheme}
      title={`Switch to ${dark ? 'day' : 'night'} theme`}
    >
      <span className="sr-only">Night theme</span>
      <span className="toggle__track" aria-hidden="true">
        <svg className="toggle__icon toggle__icon--sun" viewBox="0 0 24 24" focusable="false">
          <circle cx="12" cy="12" r="4.4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
          </g>
        </svg>
        <svg className="toggle__icon toggle__icon--moon" viewBox="0 0 24 24" focusable="false">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            fill="currentColor"
          />
        </svg>
        <span className="toggle__knob" />
      </span>
    </button>
  );
}

export default function Masthead({ theme, onToggleTheme }: Props) {
  return (
    <header className="nav">
      <div className="nav__inner">
        <a className="mark" href="/">
          <Logo />
          <span className="mark__text">
            Best<span className="mark__thin">Train</span>
          </span>
        </a>

        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
      </div>
    </header>
  );
}
