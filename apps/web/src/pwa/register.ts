export const SW_UPDATE_INTERVAL_MS = 30 * 60 * 1000;

export function nextSwUpdateCheck(
  nowMs: number,
  lastCheckMs: number,
): { lastCheckMs: number; shouldUpdate: boolean } {
  if (lastCheckMs > 0 && nowMs - lastCheckMs < SW_UPDATE_INTERVAL_MS) {
    return { lastCheckMs: lastCheckMs, shouldUpdate: false };
  }
  return { lastCheckMs: nowMs, shouldUpdate: true };
}

export function purgeServiceWorkerCaches(): void {
  navigator.serviceWorker.controller?.postMessage({ type: 'purge' });
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) {
      return;
    }
    reloading = true;
    window.location.reload();
  });

  const registration = await navigator.serviceWorker.register('/sw.js');
  let lastUpdateAt = 0;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      return;
    }
    const now = Date.now();
    const check = nextSwUpdateCheck(now, lastUpdateAt);
    lastUpdateAt = check.lastCheckMs;
    if (check.shouldUpdate) {
      void registration.update();
    }
  });
}
