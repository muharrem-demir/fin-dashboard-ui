import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';

import * as portfolioApi from '../../portfolios/api/portfolio-api';
import * as quoteApi from '../../quotes/api/quote-api';
import { FakeWebSocket, installFakeWebSocket } from '../../../test/fake-websocket';
import { aPortfolio, aQuote, aQuotesResponse, aStock } from '../../../test/factories';
import { renderWithProviders } from '../../../test/test-utils';

import { PortfolioDetailPage } from './PortfolioDetailPage';

/**
 * The detail page end to end, with the API and the socket faked.
 *
 * These are the tests that hold the realtime requirements honest: that quotes are fetched immediately
 * when holdings exist, that the socket subscribes to exactly the held symbols, that a tick updates price,
 * change and total value together, and that leaving the page closes the connection.
 */
jest.mock('../../portfolios/api/portfolio-api');
jest.mock('../../quotes/api/quote-api');

const mockedPortfolios = jest.mocked(portfolioApi);
const mockedQuotes = jest.mocked(quoteApi);

function renderPage(portfolioId = 'p1'): ReturnType<typeof renderWithProviders> {
  return renderWithProviders(
    <Routes>
      <Route path="/portfolios/:portfolioId" element={<PortfolioDetailPage />} />
    </Routes>,
    { route: `/portfolios/${portfolioId}` },
  );
}

/** Lets the socket finish opening inside `act`, so React state settles before assertions. */
async function openSocket(): Promise<FakeWebSocket> {
  const socket = await waitFor(() => FakeWebSocket.latest);

  await act(async () => {
    socket.open();
    await Promise.resolve();
  });

  return socket;
}

describe('PortfolioDetailPage', () => {
  let restoreWebSocket: () => void;

  beforeEach(() => {
    restoreWebSocket = installFakeWebSocket();
  });

  afterEach(() => {
    restoreWebSocket();
  });

  describe('loading and empty states', () => {
    it('shows skeleton rows while the portfolio loads', () => {
      mockedPortfolios.getPortfolio.mockReturnValue(new Promise(() => undefined));

      renderPage();

      expect(screen.getByRole('status', { name: 'Loading holdings' })).toBeInTheDocument();
    });

    it('shows the required empty placeholder when the portfolio holds nothing', async () => {
      mockedPortfolios.getPortfolio.mockResolvedValue(aPortfolio({ id: 'p1', stocks: [] }));

      renderPage();

      expect(await screen.findByText('No stocks available')).toBeInTheDocument();
      // No holdings means nothing to quote and nothing to watch.
      expect(mockedQuotes.listQuotes).not.toHaveBeenCalled();
      expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('offers a way back when the portfolio does not exist', async () => {
      mockedPortfolios.getPortfolio.mockRejectedValue(
        Object.assign(new Error('Portfolio was not found'), { name: 'ApiError' }),
      );

      renderPage();

      expect(await screen.findByText(/could not load this portfolio/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /back to portfolios/i })).toBeInTheDocument();
    });
  });

  describe('quotes', () => {
    beforeEach(() => {
      mockedPortfolios.getPortfolio.mockResolvedValue(
        aPortfolio({
          id: 'p1',
          stocks: [aStock({ ticker: 'AAPL', shares: 15 }), aStock({ ticker: 'MSFT', shares: 20 })],
        }),
      );
    });

    it('fetches quotes for every held ticker as soon as the holdings arrive', async () => {
      mockedQuotes.listQuotes.mockResolvedValue(aQuotesResponse({ quotes: [] }));

      renderPage();

      await waitFor(() => {
        expect(mockedQuotes.listQuotes).toHaveBeenCalledWith(['AAPL', 'MSFT'], expect.anything());
      });
    });

    it('renders ticker, shares, price, percent change and total value', async () => {
      mockedQuotes.listQuotes.mockResolvedValue(
        aQuotesResponse({
          quotes: [
            aQuote({ ticker: 'AAPL', price: 150.25, percentChange: 1.18 }),
            aQuote({ ticker: 'MSFT', price: 198, percentChange: -1 }),
          ],
        }),
      );

      renderPage();

      // The row appears with the holdings; the price follows when the batch request resolves.
      const aapl = await screen.findByRole('row', { name: /AAPL/ });
      await waitFor(() => {
        expect(within(aapl).getByText('$150.25')).toBeInTheDocument();
      });

      expect(within(aapl).getByText('15')).toBeInTheDocument();
      expect(within(aapl).getByLabelText('Up +1.18%')).toBeInTheDocument();
      // 15 × 150.25
      expect(within(aapl).getByText('$2,253.75')).toBeInTheDocument();
    });

    it('shows a partial market value when only some positions are priced', async () => {
      mockedQuotes.listQuotes.mockResolvedValue(
        aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100 })], unresolved: ['MSFT'] }),
      );

      renderPage();

      expect(await screen.findByText(/partial — 1 of 2 priced/i)).toBeInTheDocument();
    });

    it('keeps the table usable and offers a retry when the batch request fails', async () => {
      mockedQuotes.listQuotes.mockRejectedValue(new Error('Market data is temporarily unavailable.'));

      renderPage();

      expect(await screen.findByText(/prices could not be loaded/i)).toBeInTheDocument();
      // Shares still come from REST, so the row is there even with no price.
      expect(screen.getByRole('row', { name: /AAPL/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry prices/i })).toBeInTheDocument();
    });
  });

  describe('filtering the holdings', () => {
    beforeEach(() => {
      mockedPortfolios.getPortfolio.mockResolvedValue(
        aPortfolio({
          id: 'p1',
          stocks: [
            aStock({ ticker: 'AAPL', shares: 15 }),
            aStock({ ticker: 'MSFT', shares: 20 }),
            aStock({ ticker: 'AMZN', shares: 5 }),
          ],
        }),
      );
      mockedQuotes.listQuotes.mockResolvedValue(aQuotesResponse({ quotes: [] }));
    });

    /** The rows the table is currently showing, in order. */
    function visibleTickers(): readonly string[] {
      return screen
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent ?? '')
        .filter((text) => text !== '');
    }

    async function search(): Promise<HTMLElement> {
      return screen.findByRole('searchbox', { name: /filter by ticker/i });
    }

    it('hides every row whose ticker does not contain what was typed', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(await search(), 'MS');

      expect(visibleTickers()).toEqual(['MSFT']);
      expect(screen.queryByRole('row', { name: /AAPL/ })).not.toBeInTheDocument();
    });

    it('filters on each keystroke, with no button to press', async () => {
      const user = userEvent.setup();
      renderPage();

      const field = await search();

      await user.type(field, 'A');
      expect(visibleTickers()).toEqual(['AAPL', 'AMZN']);

      await user.type(field, 'M');
      expect(visibleTickers()).toEqual(['AMZN']);
    });

    it('matches case-insensitively and ignores spaces around the query', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(await search(), '  aapl  ');

      expect(visibleTickers()).toEqual(['AAPL']);
    });

    it('says so when nothing matches, rather than showing an empty table', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(await search(), 'TSLA');

      expect(await screen.findByText('No matching stocks')).toBeInTheDocument();
      expect(screen.queryByRole('rowheader')).not.toBeInTheDocument();
    });

    it('restores every row when the clear button empties the field', async () => {
      const user = userEvent.setup();
      renderPage();

      const field = await search();
      await user.type(field, 'MS');
      expect(visibleTickers()).toEqual(['MSFT']);

      await user.click(screen.getByRole('button', { name: /clear search/i }));

      expect(field).toHaveValue('');
      expect(visibleTickers()).toEqual(['AAPL', 'MSFT', 'AMZN']);
      // Focus comes back so the next search can just be typed.
      expect(field).toHaveFocus();
    });

    it('offers no clear button until there is something to clear', async () => {
      const user = userEvent.setup();
      renderPage();

      const field = await search();
      expect(screen.queryByRole('button', { name: /clear search/i })).not.toBeInTheDocument();

      await user.type(field, 'A');

      expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
    });

    it('reports how many rows survive the filter', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.type(await search(), 'A');

      expect(screen.getByText('2 of 3 holdings shown')).toBeInTheDocument();
    });

    it('leaves the subscription and the totals alone — it only hides rows', async () => {
      const user = userEvent.setup();
      renderPage();

      const socket = await openSocket();
      await user.type(await search(), 'MSFT');

      // Still watching all three: a hidden row is still a holding.
      expect(socket.sentCommands.at(-1)).toEqual({ action: 'subscribe', tickers: ['AAPL', 'AMZN', 'MSFT'] });
      expect(mockedQuotes.listQuotes).toHaveBeenCalledWith(['AAPL', 'AMZN', 'MSFT'], expect.anything());
      expect(screen.getByText('40')).toBeInTheDocument();
    });
  });

  describe('the live feed', () => {
    beforeEach(() => {
      mockedPortfolios.getPortfolio.mockResolvedValue(
        aPortfolio({ id: 'p1', stocks: [aStock({ ticker: 'AAPL', shares: 10 })] }),
      );
      mockedQuotes.listQuotes.mockResolvedValue(aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100 })] }));
    });

    it('subscribes to the portfolio tickers once the connection is open', async () => {
      renderPage();
      await screen.findByRole('row', { name: /AAPL/ });

      const socket = await openSocket();

      await waitFor(() => {
        expect(socket.sentCommands).toEqual([{ action: 'subscribe', tickers: ['AAPL'] }]);
      });
    });

    it('updates price, percent change and total value from a tick', async () => {
      renderPage();
      const socket = await openSocket();
      // Scoped to the row: the market-value stat shows the same figure for a single-holding portfolio.
      await waitFor(() => {
        expect(within(screen.getByRole('row', { name: /AAPL/ })).getByText('$1,000.00')).toBeInTheDocument();
      });

      await act(async () => {
        socket.emit({
          type: 'quotes',
          timestamp: '2026-08-18T09:14:05.000Z',
          quotes: [{ ticker: 'AAPL', price: 120, previousClose: 100, percentChange: 20 }],
          unresolved: [],
          quoteCount: 1,
        });
        await Promise.resolve();
      });

      const row = screen.getByRole('row', { name: /AAPL/ });
      expect(within(row).getByText('$120.00')).toBeInTheDocument();
      expect(within(row).getByLabelText('Up +20.00%')).toBeInTheDocument();
      // Total value recomputed from the new price: 10 × 120.
      expect(within(row).getByText('$1,200.00')).toBeInTheDocument();
    });

    it('updates shares, and the total value with them, when a tick carries shares', async () => {
      renderPage();
      const socket = await openSocket();
      await waitFor(() => {
        expect(within(screen.getByRole('row', { name: /AAPL/ })).getByText('$1,000.00')).toBeInTheDocument();
      });

      await act(async () => {
        socket.emit({
          type: 'quotes',
          timestamp: '2026-08-18T09:14:05.000Z',
          quotes: [{ ticker: 'AAPL', price: 100, percentChange: 0, shares: 25 }],
          unresolved: [],
          quoteCount: 1,
        });
        await Promise.resolve();
      });

      const row = screen.getByRole('row', { name: /AAPL/ });
      expect(within(row).getByText('25')).toBeInTheDocument();
      expect(within(row).getByText('$2,500.00')).toBeInTheDocument();
    });

    it('shows the connection as live', async () => {
      renderPage();
      await openSocket();

      expect(await screen.findByText('Live')).toBeInTheDocument();
    });

    it('closes the connection when the page unmounts', async () => {
      const { unmount } = renderPage();
      const socket = await openSocket();

      expect(socket.readyState).toBe(FakeWebSocket.OPEN);

      unmount();

      expect(socket.readyState).toBe(FakeWebSocket.CLOSED);
      expect(socket.closeCode).toBe(1000);
    });
  });

  describe('adding a stock', () => {
    beforeEach(() => {
      mockedPortfolios.getPortfolio.mockResolvedValue(
        aPortfolio({ id: 'p1', stocks: [aStock({ ticker: 'AAPL', shares: 10 })] }),
      );
      mockedQuotes.listQuotes.mockResolvedValue(aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100 })] }));
    });

    it('sends the ticker upper-cased with its share count', async () => {
      const user = userEvent.setup();
      mockedPortfolios.addStock.mockResolvedValue(
        aPortfolio({
          id: 'p1',
          stocks: [aStock({ ticker: 'AAPL', shares: 10 }), aStock({ ticker: 'TSLA', shares: 5 })],
        }),
      );

      renderPage();
      await screen.findByRole('row', { name: /AAPL/ });

      await user.type(screen.getByLabelText('Ticker'), 'tsla');
      await user.type(screen.getByLabelText('Shares'), '5');
      await user.click(screen.getByRole('button', { name: 'Add stock' }));

      await waitFor(() => {
        expect(mockedPortfolios.addStock).toHaveBeenCalledWith('p1', 'TSLA', 5);
      });
      expect(await screen.findByText('Added 5 shares of TSLA')).toBeInTheDocument();
    });

    it('subscribes to the new ticker once it is added', async () => {
      const user = userEvent.setup();
      mockedPortfolios.addStock.mockResolvedValue(
        aPortfolio({
          id: 'p1',
          stocks: [aStock({ ticker: 'AAPL', shares: 10 }), aStock({ ticker: 'TSLA', shares: 5 })],
        }),
      );

      renderPage();
      const socket = await openSocket();
      await waitFor(() => {
        expect(socket.sentCommands).toContainEqual({ action: 'subscribe', tickers: ['AAPL'] });
      });

      await user.type(screen.getByLabelText('Ticker'), 'TSLA');
      await user.type(screen.getByLabelText('Shares'), '5');
      await user.click(screen.getByRole('button', { name: 'Add stock' }));

      // The backend's `subscribe` replaces the watchlist, so the whole new set is re-sent.
      await waitFor(() => {
        expect(socket.sentCommands).toContainEqual({ action: 'subscribe', tickers: ['AAPL', 'TSLA'] });
      });
    });

    it.each([
      ['no ticker', '', '5', /enter a ticker symbol/i],
      ['a fractional share count', 'TSLA', '2.5', /whole number of shares/i],
      ['zero shares', 'TSLA', '0', /greater than zero/i],
      ['no share count', 'TSLA', '', /enter a number of shares/i],
    ])('rejects %s without calling the API', async (_label, ticker, shares, expected) => {
      const user = userEvent.setup();

      renderPage();
      await screen.findByRole('row', { name: /AAPL/ });

      if (ticker !== '') {
        await user.type(screen.getByLabelText('Ticker'), ticker);
      }
      if (shares !== '') {
        await user.type(screen.getByLabelText('Shares'), shares);
      }
      await user.click(screen.getByRole('button', { name: 'Add stock' }));

      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(mockedPortfolios.addStock).not.toHaveBeenCalled();
    });
  });

  describe('removing a stock', () => {
    beforeEach(() => {
      mockedPortfolios.getPortfolio.mockResolvedValue(
        aPortfolio({ id: 'p1', stocks: [aStock({ ticker: 'AAPL', shares: 10 })] }),
      );
      mockedQuotes.listQuotes.mockResolvedValue(aQuotesResponse({ quotes: [aQuote({ ticker: 'AAPL', price: 100 })] }));
    });

    it('confirms before removing a ticker the portfolio holds', async () => {
      const user = userEvent.setup();
      mockedPortfolios.removeStock.mockResolvedValue(undefined);

      renderPage();
      await screen.findByRole('row', { name: /AAPL/ });

      await user.type(screen.getByLabelText('Ticker to remove'), 'aapl');
      await user.click(screen.getByRole('button', { name: 'Remove stock' }));

      expect(mockedPortfolios.removeStock).not.toHaveBeenCalled();

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText('Remove AAPL?')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Remove stock' }));

      await waitFor(() => {
        expect(mockedPortfolios.removeStock).toHaveBeenCalledWith('p1', 'AAPL');
      });
      expect(await screen.findByText('Removed AAPL')).toBeInTheDocument();
    });

    it('raises an error toast for a ticker the portfolio does not hold, without calling the API', async () => {
      const user = userEvent.setup();

      renderPage();
      await screen.findByRole('row', { name: /AAPL/ });

      await user.type(screen.getByLabelText('Ticker to remove'), 'NOSUCH');
      await user.click(screen.getByRole('button', { name: 'Remove stock' }));

      expect(await screen.findByText('NOSUCH is not in this portfolio')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(mockedPortfolios.removeStock).not.toHaveBeenCalled();
    });

    it('removes from the row action too, with the same confirmation', async () => {
      const user = userEvent.setup();
      mockedPortfolios.removeStock.mockResolvedValue(undefined);

      renderPage();
      await screen.findByRole('row', { name: /AAPL/ });

      await user.click(screen.getByRole('button', { name: 'Remove AAPL' }));

      const dialog = screen.getByRole('dialog');
      // The confirmation names the position and its value, so it is obvious what is being removed.
      expect(within(dialog).getByText(/10 shares of AAPL/)).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Remove stock' }));

      await waitFor(() => {
        expect(mockedPortfolios.removeStock).toHaveBeenCalledWith('p1', 'AAPL');
      });
    });

    it('reports a failed removal with a toast', async () => {
      const user = userEvent.setup();
      mockedPortfolios.removeStock.mockRejectedValue(new Error('Could not remove'));

      renderPage();
      await screen.findByRole('row', { name: /AAPL/ });

      await user.click(screen.getByRole('button', { name: 'Remove AAPL' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove stock' }));

      expect(await screen.findByText('Could not remove the stock')).toBeInTheDocument();
    });
  });

  describe('renaming', () => {
    it('sends the new name and confirms it', async () => {
      const user = userEvent.setup();
      mockedPortfolios.getPortfolio.mockResolvedValue(aPortfolio({ id: 'p1', name: 'Growth', stocks: [] }));
      mockedPortfolios.renamePortfolio.mockResolvedValue(aPortfolio({ id: 'p1', name: 'Income', stocks: [] }));

      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Rename' }));

      const field = screen.getByLabelText('Portfolio name');
      expect(field).toHaveValue('Growth');

      await user.clear(field);
      await user.type(field, 'Income');
      await user.click(screen.getByRole('button', { name: 'Save name' }));

      await waitFor(() => {
        expect(mockedPortfolios.renamePortfolio).toHaveBeenCalledWith('p1', 'Income');
      });
      expect(await screen.findByText('Portfolio renamed')).toBeInTheDocument();
    });

    it('will not submit an unchanged name', async () => {
      const user = userEvent.setup();
      mockedPortfolios.getPortfolio.mockResolvedValue(aPortfolio({ id: 'p1', name: 'Growth', stocks: [] }));

      renderPage();

      await user.click(await screen.findByRole('button', { name: 'Rename' }));

      expect(screen.getByRole('button', { name: 'Save name' })).toBeDisabled();
    });
  });
});
