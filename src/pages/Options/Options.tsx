import React from 'react';
import ReactDOM from 'react-dom/client';
import '../../@/lib/i18n.ts';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from '../../@/components/ThemeProvider.tsx';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('options')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
