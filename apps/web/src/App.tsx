import { useEffect, useState } from 'react';
import { SetupPage } from './auth/SetupPage.js';
import { SignInPage } from './auth/SignInPage.js';
import { useAuth } from './auth/useAuth.js';

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

  if (auth.isLoading) {
    return <p className="auth-page">Loading…</p>;
  }

  if (auth.data?.signedIn !== true) {
    if (path === '/setup') {
      return <SetupPage onRecoveryCodes={() => {}} />;
    }
    return <SignInPage />;
  }

  return (
    <>
      <nav className="app-nav">
        <a href="/">Home</a>
      </nav>
      <HomePage />
    </>
  );
}
