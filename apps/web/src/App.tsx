import { type ReactNode, useState } from 'react';
import { RecoverPage } from './auth/RecoverPage.js';
import { RecoveryCodesView } from './auth/RecoveryCodesView.js';
import { SetupPage } from './auth/SetupPage.js';
import { SignInPage } from './auth/SignInPage.js';
import { useAuth } from './auth/useAuth.js';
import { Dashboard } from './dashboard/Dashboard.js';
import { InstallHint } from './pwa/InstallHint.js';
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

  let content: ReactNode;

  if (auth.isLoading) {
    content = <p className="auth-page">Loading…</p>;
  } else if (pendingRecoveryCodes !== null) {
    content = (
      <RecoveryCodesView
        codes={pendingRecoveryCodes}
        onConfirm={() => {
          setPendingRecoveryCodes(null);
          window.location.href = '/';
        }}
      />
    );
  } else if (auth.data?.signedIn !== true) {
    if (path === '/setup') {
      content = (
        <SetupPage
          onRecoveryCodes={(codes) => setPendingRecoveryCodes(codes)}
        />
      );
    } else if (path === '/recover') {
      content = <RecoverPage />;
    } else {
      content = <SignInPage />;
    }
  } else {
    content = (
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

  return (
    <>
      {content}
      <InstallHint />
    </>
  );
}
