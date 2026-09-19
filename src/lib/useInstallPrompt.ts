import { useCallback, useEffect, useState } from 'react';

/** Chrome's install event, which TypeScript's DOM lib does not declare. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'bt.install.dismissed';
const DISMISS_DAYS = 30;

/** Where the document head parks the event it caught before React mounted. */
type InstallWindow = Window & { __btInstallEvent?: InstallPromptEvent | null };

function stashedPrompt(): InstallPromptEvent | null {
  return (window as InstallWindow).__btInstallEvent ?? null;
}

/** Both hook instances keep their own state, so a change has to be announced. */
function clearStashedPrompt() {
  (window as InstallWindow).__btInstallEvent = null;
  window.dispatchEvent(new Event('bt:install-ready'));
}

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY));
    if (!at) return false;
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari reports installed apps here rather than through display-mode.
  return 'standalone' in window.navigator && Boolean((window.navigator as { standalone?: boolean }).standalone);
}

function isIosSafari(): boolean {
  // Chromium can prompt for real, so this also stops Mac device emulation faking iOS.
  if ('onbeforeinstallprompt' in window) return false;

  const ua = window.navigator.userAgent;
  const touchMac = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
  const ios = /iPad|iPhone|iPod/.test(ua) || touchMac;
  // Chrome, Firefox and Edge on iOS cannot install either, so they get nothing.
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export type InstallState = {
  /** Show the one-time banner. False once dismissed or installed. */
  available: boolean;
  /** Ignores dismissal, so a permanent control survives waving the banner away. */
  ready: boolean;
  /** iOS cannot prompt programmatically, so it needs instructions instead. */
  manual: boolean;
  install: () => void;
  dismiss: () => void;
};

export function useInstallPrompt(): InstallState {
  // Chrome fires it once, usually before this mounts, so the head script's catch is the live one.
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(stashedPrompt);
  const [manual, setManual] = useState(false);
  // Synchronous reads of browser state, so an effect would render once with the wrong value.
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(dismissedRecently);

  useEffect(() => {
    if (installed) return;

    const onPrompt = (event: Event) => {
      // Suppress Chrome's own mini-infobar; the app shows its own banner.
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };
    // Relayed by the head script, so a later hook and a second instance both get it.
    const onRelay = () => setDeferred(stashedPrompt());
    const onInstalled = () => {
      clearStashedPrompt();
      setDeferred(null);
      setInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('bt:install-ready', onRelay);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt, so offer the manual route instead.
    let timer = 0;
    if (isIosSafari()) {
      timer = window.setTimeout(() => setManual(true), 1200);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('bt:install-ready', onRelay);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, [installed]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Dismissal just will not persist; the banner is not worth failing over.
    }
  }, []);

  const install = useCallback(() => {
    if (!deferred) return;
    void deferred.prompt();
    // Single-use, so clear the stash or the other instance offers a dead prompt.
    void deferred.userChoice.finally(() => {
      clearStashedPrompt();
      setDeferred(null);
    });
  }, [deferred]);

  const ready = !installed && (Boolean(deferred) || manual);
  return { available: ready && !dismissed, ready, manual, install, dismiss };
}
