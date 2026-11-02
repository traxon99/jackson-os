import { useState } from 'react';
import { RecoverPage } from './auth/RecoverPage.js';
import { RecoveryCodesView } from './auth/RecoveryCodesView.js';
import { SetupPage } from './auth/SetupPage.js';
import { SignInPage } from './auth/SignInPage.js';
import { useAuth } from './auth/useAuth.js';
import { Dashboard } from './dashboard/Dashboard.js';
import { PasskeysPage } from './settings/PasskeysPage.js';

function pathName(): string {
  return window.location.pathname;
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
        <SetupPage
          onRecoveryCodes={(codes) => setPendingRecoveryCodes(codes)}
        />
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
      {path === '/settings/passkeys' ? (
        <PasskeysPage />
      ) : (
        <main className="app-shell scroll">
          <Dashboard />
        </main>
      )}
    </>
  );
}
