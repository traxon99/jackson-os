import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { invalidateAuth } from './useAuth.js';
import { registerPasskey } from './webauthn.js';

type SetupPageProps = {
  onRecoveryCodes: (codes: string[]) => void;
};

export function SetupPage({ onRecoveryCodes }: SetupPageProps) {
  const queryClient = useQueryClient();
  const [setupToken, setSetupToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreatePasskey() {
    setBusy(true);
    setError(null);
    try {
      const codes = await registerPasskey(setupToken.trim());
      await invalidateAuth(queryClient);
      if (codes.length > 0) {
        onRecoveryCodes(codes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>Set up Jackson OS</h1>
      <p>Enter your one-time setup token, then create a passkey.</p>
      <label className="field">
        Setup token
        <input
          type="password"
          autoComplete="off"
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          style={{ fontSize: '16px' }}
        />
      </label>
      <button
        type="button"
        disabled={busy || setupToken.length === 0}
        onClick={onCreatePasskey}
      >
        Create passkey
      </button>
      {error !== null ? <p className="error">{error}</p> : null}
    </main>
  );
}
