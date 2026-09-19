import { useEffect, useRef, useState } from 'react';
import { useInstallPrompt } from '../lib/useInstallPrompt';

/** Permanent way back to installing: the banner stays dismissed a month, and iOS never prompts. */
export default function InstallButton() {
  const { ready, manual, install } = useInstallPrompt();
  const [showHelp, setShowHelp] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showHelp) return;
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setShowHelp(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowHelp(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showHelp]);

  if (!ready) return null;

  return (
    <div className="installbtn" ref={box}>
      <button
        type="button"
        className="installbtn__btn"
        onClick={() => (manual ? setShowHelp((v) => !v) : install())}
        aria-expanded={manual ? showHelp : undefined}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3.5v11m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 16.5v1.8a2.2 2.2 0 0 0 2.2 2.2h10.6a2.2 2.2 0 0 0 2.2-2.2v-1.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span>Install</span>
      </button>

      {manual && showHelp && (
        <div className="installbtn__help" role="dialog" aria-label="How to install">
          <p>
            <strong>Add to Home Screen</strong>
          </p>
          <ol>
            <li>
              Tap the Share button
              <span className="installbtn__share" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 3.5v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="m8.5 7 3.5-3.5L15.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 12v7a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              at the bottom of Safari.
            </li>
            <li>Scroll down and choose &ldquo;Add to Home Screen&rdquo;.</li>
            <li>Tap Add.</li>
          </ol>
          <p className="installbtn__note">iOS has no one-tap install; Safari only offers it through this menu.</p>
        </div>
      )}
    </div>
  );
}
