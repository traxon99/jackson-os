import { focusManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachVisibilityFocusListener } from './focus-manager.js';

describe('attachVisibilityFocusListener', () => {
  let detach: (() => void) | undefined;

  afterEach(() => {
    detach?.();
    detach = undefined;
    focusManager.setEventListener((onFocus) => {
      const onFocusIn = () => onFocus(true);
      const onFocusOut = () => onFocus(false);
      window.addEventListener('focus', onFocusIn);
      window.addEventListener('blur', onFocusOut);
      return () => {
        window.removeEventListener('focus', onFocusIn);
        window.removeEventListener('blur', onFocusOut);
      };
    });
  });

  it('runs the focus callback when visibilitychange fires', () => {
    const setFocused = vi.spyOn(focusManager, 'setFocused');
    detach = attachVisibilityFocusListener();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(setFocused).toHaveBeenCalledWith(false);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(setFocused).toHaveBeenCalledWith(true);
  });
});
