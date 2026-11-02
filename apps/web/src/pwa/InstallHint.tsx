import { type ReactElement, useEffect, useState } from 'react';

const STORAGE_KEY = 'jos.install-hint.dismissed';

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

export function InstallHint(): null | ReactElement {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay() || readDismissed() || !isIosSafari()) {
      return;
    }
    setVisible(true);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        background: '#1e1e1e',
        color: '#f0f0f0',
        fontSize: '14px',
        zIndex: 50,
        boxShadow: '0 -2px 8px rgba(0,0,0,0.35)',
      }}
    >
      <span>Add to Home Screen: tap Share → Add to Home Screen</span>
      <button
        type="button"
        aria-label="Dismiss install hint"
        onClick={() => {
          persistDismissed();
          setVisible(false);
        }}
        style={{
          marginLeft: '12px',
          background: 'transparent',
          border: '1px solid #888',
          color: 'inherit',
          borderRadius: '4px',
          padding: '2px 8px',
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

export {
  isIosSafari,
  isStandaloneDisplay,
  persistDismissed,
  readDismissed,
  STORAGE_KEY,
};
