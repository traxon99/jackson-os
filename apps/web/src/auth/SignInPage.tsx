import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { invalidateAuth } from './useAuth.js';
import { signInWithPasskey } from './webauthn.js';

export function SignInPage() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPasskey();
      await invalidateAuth(queryClient);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>Sign in</h1>
      <button type="button" disabled={busy} onClick={onSignIn}>
        Sign in with passkey
      </button>
      {error !== null ? <p className="error">{error}</p> : null}
      <nav className="auth-links">
        <a href="/setup">First-time setup</a>
        <a href="/recover">Recover with a code</a>
      </nav>
    </main>
  );
}
