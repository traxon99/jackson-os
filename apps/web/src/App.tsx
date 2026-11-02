import { useEffect, useState } from 'react';
import { RecoverPage } from './auth/RecoverPage.js';
import { RecoveryCodesView } from './auth/RecoveryCodesView.js';
import { SetupPage } from './auth/SetupPage.js';
import { SignInPage } from './auth/SignInPage.js';
import { useAuth } from './auth/useAuth.js';
import { PasskeysPage } from './settings/PasskeysPage.js';

function pathName(): string {
  return window.location.pathname;
}

function HomePage() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error('health check failed');
        }
        return res.json() as Promise<{ ok?: boolean }>;
      })
      .then((data) => {
        setMessage(data.ok ? 'Server OK' : 'Server down');
      })
      .catch(() => {
        setMessage('Server down');
      });
  }, []);

  return (
    <main className="home-page">
      <p>{message ?? '…'}</p>
    </main>
  );
}

export function App() {
  const auth = useAuth();
  const path = pathName();
  const [pendingRecoveryCodes, setPendingRecoveryCodes] = useState<
    string[] | null
  >(null);

  if (auth.isLoading) {
    return <p className="auth-page">Loading…</p>;
  }

  if (pendingRecoveryCodes !== null) {
    return (
      <RecoveryCodesView
        codes={pendingRecoveryCodes}
        onConfirm={() => {
          setPendingRecoveryCodes(null);
          window.location.href = '/';
        }}
      />
    );
  }

  if (auth.data?.signedIn !== true) {
    if (path === '/setup') {
      return (
        <SetupPage onRecoveryCodes={(codes) => setPendingRecoveryCodes(codes)} />
      );
    }
    if (path === '/recover') {
      return <RecoverPage />;
    }
    return <SignInPage />;
  }

  return (
    <>
      <nav className="app-nav">
        <a href="/">Home</a>
        <a href="/settings/passkeys">Passkeys</a>
      </nav>
      {path === '/settings/passkeys' ? <PasskeysPage /> : <HomePage />}
    </>
  );
}
