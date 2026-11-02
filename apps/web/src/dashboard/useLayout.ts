import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '../lib/api.js';

export type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type LayoutResponse = {
  id: string;
  items: LayoutItem[];
};

export function useLayout() {
  const queryClient = useQueryClient();
  const layoutQuery = useQuery({
    queryKey: ['layout'],
    queryFn: () => apiGet<LayoutResponse>('/api/layout'),
  });

  const saveMutation = useMutation({
    mutationFn: (items: LayoutItem[]) =>
      apiPut<LayoutResponse>('/api/layout', { items }),
    onSuccess: (data) => {
      queryClient.setQueryData(['layout'], data);
    },
  });

  return {
    layoutQuery,
    saveLayout: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}

export function sortLayoutItems(items: LayoutItem[]): LayoutItem[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}
