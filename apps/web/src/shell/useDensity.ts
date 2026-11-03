import { useCallback, useEffect, useState } from 'react';

export type Density = 'compact' | 'comfortable';

const STORAGE_KEY = 'jos.density';

function readDensity(): Density {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'comfortable'
      ? 'comfortable'
      : 'compact';
  } catch {
    return 'compact';
  }
}

/** Density lives on <html data-density> so every token in tokens.css follows it. */
export function useDensity(): [Density, () => void] {
  const [density, setDensity] = useState<Density>(readDensity);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try {
      localStorage.setItem(STORAGE_KEY, density);
    } catch {
      // private mode: the choice just won't persist
    }
  }, [density]);

  const toggle = useCallback(() => {
    setDensity((current) =>
      current === 'compact' ? 'comfortable' : 'compact',
    );
  }, []);

  return [density, toggle];
}
