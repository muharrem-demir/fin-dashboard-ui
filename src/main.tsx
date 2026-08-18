import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './index.css';

import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { QueryProvider } from './app/providers/QueryProvider';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { ToastProvider } from './shared/ui/toast/ToastProvider';

const container = document.getElementById('root');

if (container === null) {
  // Nothing useful can be rendered without a mount point, and a blank page with a clear console
  // error beats React's own opaque failure.
  throw new Error('Could not find the #root element to mount the application into.');
}

createRoot(container).render(
  <StrictMode>
    {/* Outermost: it must still render if a provider below it throws while initialising. */}
    <ErrorBoundary>
      <ThemeProvider>
        {/* Above QueryProvider, because the mutation hooks raise toasts from their callbacks. */}
        <ToastProvider>
          <QueryProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </QueryProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
