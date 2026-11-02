interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export function isStandaloneMode(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  return Boolean((navigator as NavigatorWithStandalone).standalone);
}

export function applyStandaloneClass(): void {
  if (isStandaloneMode()) {
    document.body.classList.add('pwa');
  }
}
