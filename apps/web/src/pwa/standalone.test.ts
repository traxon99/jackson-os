import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyStandaloneClass, isStandaloneMode } from './standalone.js';

describe('applyStandaloneClass', () => {
  afterEach(() => {
    document.body.classList.remove('pwa');
    vi.restoreAllMocks();
  });

  it('adds pwa class when display-mode is standalone', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    applyStandaloneClass();
    expect(document.body.classList.contains('pwa')).toBe(true);
  });

  it('adds pwa class when navigator.standalone is true (iOS)', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    Object.defineProperty(navigator, 'standalone', {
      configurable: true,
      value: true,
    });

    expect(isStandaloneMode()).toBe(true);
    applyStandaloneClass();
    expect(document.body.classList.contains('pwa')).toBe(true);
  });
});
