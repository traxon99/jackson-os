import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { registerServiceWorker } from './pwa/register.js';
import { applyStandaloneClass } from './pwa/standalone.js';
import './app.css';
import './styles/app.css';
<<<<<<< HEAD
import './styles/base.css';

applyStandaloneClass();
if (import.meta.env.PROD) {
  void registerServiceWorker();
}
=======
import { attachVisibilityFocusListener } from './pwa/focus-manager.js';
>>>>>>> c5dafed (S76: refetch on resume via visibilitychange (#91))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

attachVisibilityFocusListener();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}
