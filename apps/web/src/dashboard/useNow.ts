import { useEffect, useState } from 'react';

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const intervalId = window.setInterval(refresh, 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return now;
}
