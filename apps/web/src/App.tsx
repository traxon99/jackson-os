import { useEffect, useState } from 'react';

export function App() {
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
    <main className="scroll">
      <p>{message ?? '…'}</p>
    </main>
  );
}
