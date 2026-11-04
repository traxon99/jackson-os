import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiPost } from '../lib/api.js';
import { PasskeyRegistrationHelp } from './PasskeyRegistrationHelp.js';
import { RecoveryCodesView } from './RecoveryCodesView.js';
import { invalidateAuth } from './useAuth.js';
import { registerPasskey } from './webauthn.js';

export function RecoverPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'code' | 'register' | 'codes'>('code');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmitCode() {
    setBusy(true);
    setError(null);
    try {
      await apiPost('/api/auth/recover', { code: code.trim() });
      setStep('register');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid recovery code');
    } finally {
      setBusy(false);
    }
  }

  async function onCreatePasskey() {
    setBusy(true);
    setError(null);
    try {
      const codes = await registerPasskey();
      await invalidateAuth(queryClient);
      if (codes.length > 0) {
        setRecoveryCodes(codes);
        setStep('codes');
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'codes') {
    return (
      <RecoveryCodesView
        codes={recoveryCodes}
        onConfirm={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  if (step === 'register') {
    return (
      <main className="auth-page">
        <h1>Create a new passkey</h1>
        <p>
          Your recovery code was accepted. Register a passkey on your phone by
          scanning the QR code your browser shows.
        </p>
        <button type="button" disabled={busy} onClick={onCreatePasskey}>
          Create passkey
        </button>
        {busy ? <PasskeyRegistrationHelp /> : null}
        {error !== null ? <p className="error">{error}</p> : null}
      </main>
    );
  }

  return (
    <main className="auth-page">
      <h1>Recover access</h1>
      <label className="field">
        Recovery code
        <input
          type="text"
          autoComplete="off"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          style={{ fontSize: '16px' }}
        />
      </label>
      <button
        type="button"
        disabled={busy || code.trim().length === 0}
        onClick={onSubmitCode}
      >
        Continue
      </button>
      {error !== null ? <p className="error">{error}</p> : null}
      <nav className="auth-links">
        <a href="/">Back to sign in</a>
      </nav>
    </main>
  );
}
