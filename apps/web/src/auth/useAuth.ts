import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiGet } from '../lib/api.js';

type AuthMe = { signedIn: boolean };

export function useAuth() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onSignedOut = () => {
      queryClient.setQueryData(['auth', 'me'], { signedIn: false });
    };
    window.addEventListener('jos:signed-out', onSignedOut);
    return () => window.removeEventListener('jos:signed-out', onSignedOut);
  }, [queryClient]);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiGet<AuthMe>('/api/auth/me'),
  });
}

export function invalidateAuth(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
}
