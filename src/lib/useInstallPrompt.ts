import { useCallback, useEffect, useState } from 'react';

/** Chrome's install event, which TypeScript's DOM lib does not declare. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'bt.install.dismissed';
const DISMISS_DAYS = 30;

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
  // Chromium exposes this and can prompt for real, so it never needs the
  // manual route - and this keeps device emulation on a Mac from faking iOS.
  if ('onbeforeinstallprompt' in window) return false;

  const ua = window.navigator.userAgent;
  const touchMac = ua.includes('Macintosh') && navigator.maxTouchPoints > 1;
  const ios = /iPad|iPhone|iPod/.test(ua) || touchMac;
  // Chrome, Firefox and Edge on iOS cannot install either, so they get nothing.
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export type InstallState = {
  /** Show the banner. */
  available: boolean;
  /** iOS cannot prompt programmatically, so it needs instructions instead. */
  manual: boolean;
  install: () => void;
  dismiss: () => void;
};

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [manual, setManual] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || dismissedRecently()) return;

    const onPrompt = (event: Event) => {
      // Suppress Chrome's own mini-infobar; the app shows its own banner.
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
      setHidden(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS never fires beforeinstallprompt, so offer the manual route instead.
    let timer = 0;
    if (isIosSafari()) {
      timer = window.setTimeout(() => {
        setManual(true);
        setHidden(false);
      }, 2500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Dismissal just will not persist; the banner is not worth failing over.
    }
  }, []);

  const install = useCallback(() => {
    if (!deferred) return;
    void deferred.prompt();
    void deferred.userChoice.finally(() => {
      setDeferred(null);
      setHidden(true);
    });
  }, [deferred]);

  return { available: !hidden && (Boolean(deferred) || manual), manual, install, dismiss };
}
