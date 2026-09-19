import { useInstallPrompt } from '../lib/useInstallPrompt';

/**
 * Mobile-only prompt to add the app to the home screen. Hidden on desktop by
 * CSS, and never shown once installed or dismissed.
 */
export default function InstallBanner() {
  const { available, manual, install, dismiss } = useInstallPrompt();
  if (!available) return null;

  return (
    <div className="install" role="dialog" aria-label="Add Best Train to your home screen">
      <span className="install__icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path d="M7 25h9a9 9 0 0 0 9-9V7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="7" cy="25" r="4.2" fill="currentColor" />
          <circle cx="25" cy="7" r="4.2" fill="currentColor" />
        </svg>
      </span>

      <div className="install__copy">
        <strong className="install__title">BestTrain</strong>
        <span className="install__sub">
          {manual ? 'Tap Share, then Add to Home Screen' : 'Add to home screen in seconds'}
        </span>
        <span className="install__tags">
          <span className="install__free">FREE</span>
          <span>No app store needed</span>
        </span>
      </div>

      {!manual && (
        <button type="button" className="install__add" onClick={install}>
          Add
        </button>
      )}

      <button type="button" className="install__close" onClick={dismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
