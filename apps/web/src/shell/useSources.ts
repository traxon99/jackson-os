import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../lib/api.js';

export type SourceStatus = {
  id: string;
  displayName: string;
  status: 'ok' | 'error' | 'disabled';
  lastFetchAt: string | null;
  nextFetchAt: string | null;
};

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => apiGet<SourceStatus[]>('/api/sources'),
    refetchInterval: 60_000,
  });
}

export function countByStatus(sources: readonly SourceStatus[]) {
  const counts = { ok: 0, error: 0, disabled: 0 };
  for (const source of sources) {
    counts[source.status] += 1;
  }
  return counts;
}
