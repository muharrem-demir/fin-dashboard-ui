import { Navigate, Route, Routes } from 'react-router-dom';

import { PortfolioDetailPage } from '../features/portfolio-detail/pages/PortfolioDetailPage';
import { PortfoliosPage } from '../features/portfolios/pages/PortfoliosPage';

import { AppLayout } from './AppLayout';
import { NotFoundPage } from './NotFoundPage';

/**
 * The route table.
 *
 * Declared as JSX rather than through `createBrowserRouter` because the router lives outside `App` —
 * in `main.tsx` for the real app and in the test helper for tests — which lets the whole tree be
 * mounted at an arbitrary URL in a `MemoryRouter` without a second route definition to keep in step.
 */
export function App(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<PortfoliosPage />} />
        {/* `/portfolios` alone has nothing of its own to show; the list is the home page. */}
        <Route path="/portfolios" element={<Navigate to="/" replace />} />
        <Route path="/portfolios/:portfolioId" element={<PortfolioDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
