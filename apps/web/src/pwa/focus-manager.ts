import { focusManager } from '@tanstack/react-query';

export function attachVisibilityFocusListener(): () => void {
  let removeVisibility: (() => void) | undefined;

  focusManager.setEventListener((onFocus) => {
    const handler = () => {
      onFocus(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handler);
    handler();
    removeVisibility = () => {
      document.removeEventListener('visibilitychange', handler);
    };
    return removeVisibility;
  });

  return () => {
    removeVisibility?.();
    focusManager.setEventListener((onFocus) => {
      if (typeof window === 'undefined') {
        return () => {};
      }
      const onFocusIn = () => onFocus(true);
      const onFocusOut = () => onFocus(false);
      window.addEventListener('focus', onFocusIn);
      window.addEventListener('blur', onFocusOut);
      return () => {
        window.removeEventListener('focus', onFocusIn);
        window.removeEventListener('blur', onFocusOut);
      };
    });
  };
}
