import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import * as portfolioApi from '../api/portfolio-api';
import * as watchlistApi from '../../watchlist/api/watchlist-api';
import { aPortfolio, aPortfolioSummary } from '../../../test/factories';
import { renderWithProviders } from '../../../test/test-utils';

import { PortfoliosPage } from './PortfoliosPage';

/**
 * The landing page, mocked at the API boundary.
 *
 * `portfolio-api` is the seam rather than `fetch`, because these tests are about the page's behaviour —
 * empty state, confirmation before deleting, navigating after creating — and not about URL building,
 * which `http-client.test.ts` already covers.
 */
jest.mock('../api/portfolio-api');
// The page also mounts the watchlist, which fetches and opens a socket of its own. Its behaviour is
// covered by `WatchlistSection.test.tsx`; here it is stubbed to an empty list so these tests are about
// the portfolio list and nothing else.
jest.mock('../../watchlist/api/watchlist-api');

const mockedApi = jest.mocked(portfolioApi);
const mockedWatchlist = jest.mocked(watchlistApi);

// react-router's useNavigate is replaced so "creating navigates to the new portfolio" can be asserted
// without mounting a second route.
const navigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual<object>('react-router-dom'),
  useNavigate: () => navigate,
}));

describe('PortfoliosPage', () => {
  beforeEach(() => {
    navigate.mockClear();
    mockedWatchlist.listWatchlist.mockResolvedValue([]);
  });

  it('shows a skeleton while the list is loading', () => {
    mockedApi.listPortfolios.mockReturnValue(new Promise(() => undefined));

    renderWithProviders(<PortfoliosPage />);

    expect(screen.getByRole('status', { name: 'Loading portfolios' })).toBeInTheDocument();
  });

  it('shows the required empty placeholder when the API returns no portfolios', async () => {
    mockedApi.listPortfolios.mockResolvedValue([]);

    renderWithProviders(<PortfoliosPage />);

    expect(await screen.findByText('No portfolios available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create a portfolio' })).toBeInTheDocument();
  });

  it('lists portfolios with their stock and share counts', async () => {
    mockedApi.listPortfolios.mockResolvedValue([
      aPortfolioSummary({ id: 'a', name: 'Growth', stockCount: 2, totalShares: 35 }),
      aPortfolioSummary({ id: 'b', name: 'Income', stockCount: 0, totalShares: 0 }),
    ]);

    renderWithProviders(<PortfoliosPage />);

    expect(await screen.findByRole('link', { name: 'Open Growth' })).toHaveAttribute('href', '/portfolios/a');
    expect(screen.getByRole('link', { name: 'Open Income' })).toBeInTheDocument();

    const growth = screen.getByRole('link', { name: 'Open Growth' });
    expect(within(growth).getByText('35')).toBeInTheDocument();
  });

  it('reports a failure to load with a retry', async () => {
    mockedApi.listPortfolios.mockRejectedValue(new Error('boom'));

    renderWithProviders(<PortfoliosPage />);

    expect(await screen.findByText('Could not load your portfolios')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  describe('creating', () => {
    it('asks for a name, then opens the new portfolio', async () => {
      const user = userEvent.setup();
      mockedApi.listPortfolios.mockResolvedValue([]);
      mockedApi.createPortfolio.mockResolvedValue(aPortfolio({ id: 'new-id', name: 'Growth', stocks: [] }));

      renderWithProviders(<PortfoliosPage />);

      await user.click(await screen.findByRole('button', { name: 'New portfolio' }));
      await user.type(screen.getByLabelText('Portfolio name'), 'Growth');
      await user.click(screen.getByRole('button', { name: 'Create portfolio' }));

      await waitFor(() => {
        expect(mockedApi.createPortfolio).toHaveBeenCalledWith('Growth');
      });

      // The requirement: after creating, open the detail page.
      expect(navigate).toHaveBeenCalledWith('/portfolios/new-id');
    });

    it('rejects an empty name without calling the API', async () => {
      const user = userEvent.setup();
      mockedApi.listPortfolios.mockResolvedValue([]);

      renderWithProviders(<PortfoliosPage />);

      await user.click(await screen.findByRole('button', { name: 'New portfolio' }));
      await user.click(screen.getByRole('button', { name: 'Create portfolio' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Give the portfolio a name.');
      expect(mockedApi.createPortfolio).not.toHaveBeenCalled();
    });

    it('announces success with a toast', async () => {
      const user = userEvent.setup();
      mockedApi.listPortfolios.mockResolvedValue([]);
      mockedApi.createPortfolio.mockResolvedValue(aPortfolio({ id: 'new-id', name: 'Growth', stocks: [] }));

      renderWithProviders(<PortfoliosPage />);

      await user.click(await screen.findByRole('button', { name: 'New portfolio' }));
      await user.type(screen.getByLabelText('Portfolio name'), 'Growth');
      await user.click(screen.getByRole('button', { name: 'Create portfolio' }));

      expect(await screen.findByText('Portfolio created')).toBeInTheDocument();
    });

    it('reports a failure with a toast and keeps the dialog open', async () => {
      const user = userEvent.setup();
      mockedApi.listPortfolios.mockResolvedValue([]);
      mockedApi.createPortfolio.mockRejectedValue(new Error('Name already taken'));

      renderWithProviders(<PortfoliosPage />);

      await user.click(await screen.findByRole('button', { name: 'New portfolio' }));
      await user.type(screen.getByLabelText('Portfolio name'), 'Growth');
      await user.click(screen.getByRole('button', { name: 'Create portfolio' }));

      expect(await screen.findByText('Could not create the portfolio')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    beforeEach(() => {
      mockedApi.listPortfolios.mockResolvedValue([aPortfolioSummary({ id: 'a', name: 'Growth', stockCount: 2 })]);
    });

    it('asks for confirmation before deleting', async () => {
      const user = userEvent.setup();
      mockedApi.deletePortfolio.mockResolvedValue(undefined);

      renderWithProviders(<PortfoliosPage />);

      await user.click(await screen.findByRole('button', { name: 'Delete Growth' }));

      // Nothing is sent until the confirmation is accepted.
      expect(mockedApi.deletePortfolio).not.toHaveBeenCalled();

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Delete this portfolio?')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Delete portfolio' }));

      await waitFor(() => {
        expect(mockedApi.deletePortfolio).toHaveBeenCalledWith('a');
      });
      expect(await screen.findByText('Portfolio deleted')).toBeInTheDocument();
    });

    it('sends nothing when the confirmation is cancelled', async () => {
      const user = userEvent.setup();

      renderWithProviders(<PortfoliosPage />);

      await user.click(await screen.findByRole('button', { name: 'Delete Growth' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

      expect(mockedApi.deletePortfolio).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('reports a failed delete with a toast', async () => {
      const user = userEvent.setup();
      mockedApi.deletePortfolio.mockRejectedValue(new Error('Still in use'));

      renderWithProviders(<PortfoliosPage />);

      await user.click(await screen.findByRole('button', { name: 'Delete Growth' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete portfolio' }));

      expect(await screen.findByText('Could not delete the portfolio')).toBeInTheDocument();
    });
  });
});
