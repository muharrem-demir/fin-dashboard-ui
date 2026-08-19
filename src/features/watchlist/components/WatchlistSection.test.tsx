import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FakeWebSocket, installFakeWebSocket } from '../../../test/fake-websocket';
import { aQuote, aQuoteTick, aWatchlistEntry } from '../../../test/factories';
import { renderWithProviders } from '../../../test/test-utils';
import * as watchlistApi from '../api/watchlist-api';
import type { WatchlistEntry } from '../api/watchlist-schemas';

import { WatchlistSection } from './WatchlistSection';

/**
 * The watchlist end to end, with the API and the socket faked.
 *
 * These are the tests that hold the realtime requirements honest: that the connection is opened while
 * the section is on screen and closed when it leaves, that the whole watchlist is subscribed whichever
 * of "the entries loaded" and "the socket opened" happens first, that adding and removing a symbol
 * re-sends the subscription, and that a tick moves the price and the change together.
 *
 * Mocked at the API module rather than at `fetch`, because none of this is about URL building.
 */
jest.mock('../api/watchlist-api');

const mockedApi = jest.mocked(watchlistApi);

/** Lets the socket finish opening inside `act`, so React state settles before assertions. */
async function openSocket(): Promise<FakeWebSocket> {
  const socket = await waitFor(() => FakeWebSocket.latest);

  await act(async () => {
    socket.open();
    await Promise.resolve();
  });

  return socket;
}

async function emit(socket: FakeWebSocket, message: unknown): Promise<void> {
  await act(async () => {
    socket.emit(message);
    await Promise.resolve();
  });
}

/** The card for one symbol. Each tile is labelled with its ticker, which is what scopes these queries. */
function card(ticker: string): HTMLElement {
  return screen.getByRole('listitem', { name: ticker });
}

describe('WatchlistSection', () => {
  let restoreWebSocket: () => void;

  beforeEach(() => {
    restoreWebSocket = installFakeWebSocket();
  });

  afterEach(() => {
    restoreWebSocket();
  });

  describe('loading, empty and failed states', () => {
    it('shows a skeleton while the watchlist loads', () => {
      mockedApi.listWatchlist.mockReturnValue(new Promise(() => undefined));

      renderWithProviders(<WatchlistSection />);

      expect(screen.getByRole('status', { name: 'Loading watchlist' })).toBeInTheDocument();
    });

    it('shows the required placeholder when nothing is watched', async () => {
      mockedApi.listWatchlist.mockResolvedValue([]);

      renderWithProviders(<WatchlistSection />);

      expect(await screen.findByText('Nothing to watch')).toBeInTheDocument();
    });

    it('reports a failure to load with a retry', async () => {
      mockedApi.listWatchlist.mockRejectedValue(new Error('boom'));

      renderWithProviders(<WatchlistSection />);

      expect(await screen.findByText('Could not load your watchlist')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('the cards', () => {
    beforeEach(() => {
      mockedApi.listWatchlist.mockResolvedValue([
        aWatchlistEntry({ id: 'a', ticker: 'AAPL' }),
        aWatchlistEntry({ id: 'b', ticker: 'MSFT' }),
      ]);
    });

    it('lists every watched symbol in one row', async () => {
      renderWithProviders(<WatchlistSection />);

      const list = await screen.findByRole('list', { name: 'Watched symbols' });

      expect(within(list).getAllByRole('listitem')).toHaveLength(2);
      expect(within(list).getByText('AAPL')).toBeInTheDocument();
      expect(within(list).getByText('MSFT')).toBeInTheDocument();
    });

    it('says a price is still coming rather than showing a zero', async () => {
      renderWithProviders(<WatchlistSection />);

      expect(await screen.findByRole('list', { name: 'Watched symbols' })).toBeInTheDocument();
      expect(within(card('AAPL')).getByLabelText('Awaiting price')).toBeInTheDocument();
    });

    it('shows price, change and direction from the feed, and updates them on the next tick', async () => {
      renderWithProviders(<WatchlistSection />);
      await screen.findByRole('list', { name: 'Watched symbols' });

      const socket = await openSocket();
      await emit(socket, aQuoteTick({ quotes: [aQuote({ ticker: 'AAPL', price: 150.25, percentChange: 1.18 })] }));

      expect(within(card('AAPL')).getByText('$150.25')).toBeInTheDocument();
      expect(within(card('AAPL')).getByLabelText('Up +1.18%')).toBeInTheDocument();

      await emit(socket, aQuoteTick({ quotes: [aQuote({ ticker: 'AAPL', price: 148.1, percentChange: -0.27 })] }));

      expect(within(card('AAPL')).getByText('$148.10')).toBeInTheDocument();
      expect(within(card('AAPL')).getByLabelText('Down -0.27%')).toBeInTheDocument();
      // The symbol the tick did not mention keeps waiting rather than being blanked to a zero.
      expect(within(card('MSFT')).getByLabelText('Awaiting price')).toBeInTheDocument();
    });

    it('says so when the provider has no data for a symbol', async () => {
      renderWithProviders(<WatchlistSection />);
      await screen.findByRole('list', { name: 'Watched symbols' });

      const socket = await openSocket();
      await emit(socket, aQuoteTick({ quotes: [], unresolved: ['MSFT'] }));

      expect(within(card('MSFT')).getByText('no data')).toBeInTheDocument();
    });
  });

  describe('the connection', () => {
    it('opens while the section is on screen, even with nothing watched yet', async () => {
      mockedApi.listWatchlist.mockResolvedValue([]);

      renderWithProviders(<WatchlistSection />);

      const socket = await openSocket();

      // Nothing to watch is expressed by sending nothing: an empty ticker list is a client error.
      expect(socket.sentCommands).toEqual([]);
    });

    it('subscribes to every watched symbol once the connection is established', async () => {
      mockedApi.listWatchlist.mockResolvedValue([
        aWatchlistEntry({ id: 'a', ticker: 'MSFT' }),
        aWatchlistEntry({ id: 'b', ticker: 'aapl' }),
      ]);

      renderWithProviders(<WatchlistSection />);
      // The entries land first, so the subscription has to survive being recorded before there is a
      // socket to send it on.
      await screen.findByRole('list', { name: 'Watched symbols' });

      const socket = await openSocket();

      expect(socket.sentCommands).toEqual([{ action: 'subscribe', tickers: ['AAPL', 'MSFT'] }]);
    });

    it('subscribes once the entries arrive when the socket opened first', async () => {
      let resolveEntries: (entries: readonly WatchlistEntry[]) => void = () => undefined;

      mockedApi.listWatchlist.mockReturnValue(
        new Promise<readonly WatchlistEntry[]>((resolve) => {
          resolveEntries = resolve;
        }),
      );

      renderWithProviders(<WatchlistSection />);
      const socket = await openSocket();
      expect(socket.sentCommands).toEqual([]);

      await act(async () => {
        resolveEntries([aWatchlistEntry({ id: 'a', ticker: 'AAPL' })]);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(socket.sentCommands).toEqual([{ action: 'subscribe', tickers: ['AAPL'] }]);
      });
    });

    it('closes the connection when the section leaves the screen', async () => {
      mockedApi.listWatchlist.mockResolvedValue([aWatchlistEntry({ id: 'a', ticker: 'AAPL' })]);

      const { unmount } = renderWithProviders(<WatchlistSection />);
      const socket = await openSocket();

      unmount();

      expect(socket.closeCode).toBe(1000);
    });
  });

  describe('adding', () => {
    beforeEach(() => {
      mockedApi.listWatchlist.mockResolvedValue([]);
    });

    it('asks for a symbol, adds it, and subscribes to it', async () => {
      const user = userEvent.setup();
      mockedApi.addWatchlistEntry.mockResolvedValue(aWatchlistEntry({ id: 'a', ticker: 'TSLA' }));

      renderWithProviders(<WatchlistSection />);
      const socket = await openSocket();

      await user.click(screen.getByRole('button', { name: 'Add watch' }));

      // The list is refetched after the write, so it has to answer with the new entry.
      mockedApi.listWatchlist.mockResolvedValue([aWatchlistEntry({ id: 'a', ticker: 'TSLA' })]);

      await user.type(screen.getByLabelText('Ticker symbol'), 'tsla');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add watch' }));

      await waitFor(() => {
        expect(mockedApi.addWatchlistEntry).toHaveBeenCalledWith('TSLA');
      });

      // `subscribe` replaces the whole watchlist, so the new set is re-sent rather than added to.
      await waitFor(() => {
        expect(socket.sentCommands).toContainEqual({ action: 'subscribe', tickers: ['TSLA'] });
      });

      expect(await screen.findByText('Watching TSLA')).toBeInTheDocument();
    });

    it('refuses an empty symbol without calling the API', async () => {
      const user = userEvent.setup();

      renderWithProviders(<WatchlistSection />);

      await user.click(screen.getByRole('button', { name: 'Add watch' }));
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add watch' }));

      expect(await screen.findByText('Enter a ticker symbol.')).toBeInTheDocument();
      expect(mockedApi.addWatchlistEntry).not.toHaveBeenCalled();
    });

    it('keeps the dialog open and explains when the symbol is rejected', async () => {
      const user = userEvent.setup();
      mockedApi.addWatchlistEntry.mockRejectedValue(new Error('Ticker is already watched'));

      renderWithProviders(<WatchlistSection />);

      await user.click(screen.getByRole('button', { name: 'Add watch' }));
      await user.type(screen.getByLabelText('Ticker symbol'), 'AAPL');
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add watch' }));

      expect(await screen.findByText('Could not add the symbol')).toBeInTheDocument();
      // The dialog stays open with what was typed, next to the toast that explains why.
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('removing', () => {
    beforeEach(() => {
      mockedApi.listWatchlist.mockResolvedValue([aWatchlistEntry({ id: 'a', ticker: 'AAPL' })]);
    });

    it('asks for confirmation first, and does nothing if it is refused', async () => {
      const user = userEvent.setup();

      renderWithProviders(<WatchlistSection />);
      await screen.findByRole('list', { name: 'Watched symbols' });

      await user.click(screen.getByRole('button', { name: 'Stop watching AAPL' }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(mockedApi.removeWatchlistEntry).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockedApi.removeWatchlistEntry).not.toHaveBeenCalled();
      expect(screen.getByText('AAPL')).toBeInTheDocument();
    });

    it('removes the entry by its id once confirmed, and stops watching the symbol', async () => {
      const user = userEvent.setup();
      mockedApi.removeWatchlistEntry.mockResolvedValue(undefined);

      renderWithProviders(<WatchlistSection />);
      await screen.findByRole('list', { name: 'Watched symbols' });

      const socket = await openSocket();
      expect(socket.sentCommands).toEqual([{ action: 'subscribe', tickers: ['AAPL'] }]);

      await user.click(screen.getByRole('button', { name: 'Stop watching AAPL' }));

      mockedApi.listWatchlist.mockResolvedValue([]);

      await user.click(screen.getByRole('button', { name: 'Stop watching' }));

      await waitFor(() => {
        expect(mockedApi.removeWatchlistEntry).toHaveBeenCalledWith('a');
      });

      // Watching nothing is `unsubscribe`, because an empty ticker list is a client error.
      await waitFor(() => {
        expect(socket.sentCommands).toContainEqual({ action: 'unsubscribe' });
      });

      expect(await screen.findByText('Nothing to watch')).toBeInTheDocument();
    });
  });
});
