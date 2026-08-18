# fin-dashboard-ui

Front end for the [fin-dashboard](../../java/fin-dashboard) API. List and edit stock portfolios, add and
remove holdings, and watch prices move as they are pushed over a WebSocket.

**React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS 4 · TanStack Query 5 · Jest**

No authentication — the API is open by design, so the UI has no login.

## Quick start

The backend has to be running first.

After running the backend API, execute:

```bash
npm run dev
```

<http://localhost:5173>. The dev server proxies `/api` and `/ws` to `localhost:8080`, so the browser stays
on one origin and no CORS configuration is needed anywhere.

Or bring up UI — from this directory:

```bash
docker compose up -d --build   # http://localhost:3000
```

## Commands

| Command                 | What it does                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `npm run dev`           | Dev server on :5173 with the API proxy                         |
| `npm run verify`        | lint + typecheck + test + build. The one to run before pushing |
| `npm run lint`          | ESLint, `--max-warnings=0`                                     |
| `npm run typecheck`     | `tsc --build` across both project references                   |
| `npm run test`          | Jest                                                           |
| `npm run test:coverage` | Jest with the coverage thresholds enforced                     |
| `npm run format`        | Prettier                                                       |
| `npm run build`         | **Lints and type-checks, then builds**                         |
| `npm run build:only`    | Just the build, for a pipeline that already ran the gates      |
| `npm run preview`       | Serve `dist/` locally, proxy included                          |

`npm run build` runs the linter and type-checker first on purpose: a bundle that would fail CI cannot be
produced by accident.

## What it does

### Portfolios

The landing page lists every portfolio with its holding and share counts. Create one — it asks for a name
and opens the new portfolio straight away — or delete one, which asks for confirmation first and names what
will be lost. An account with no portfolios gets a placeholder rather than an empty page.

### Holdings, priced live

Opening a portfolio shows its positions: ticker, shares, price, percent change and total value, with the
portfolio's market value and a value-weighted day change above the table.

Prices arrive in two stages. The moment the holdings come back, every ticker is quoted in a single batch
request — a table of em dashes waiting three seconds for the first tick looks broken. A WebSocket then keeps
those numbers moving: rows flash green or red as prices change, and total value is recomputed on every tick.
A badge in the header says whether the feed is live and how old the last tick is, because "is the market
quiet or is my connection dead?" is the first question a stalled dashboard has to answer.

Holdings can be added by ticker and share count — adding one already held increases that position rather
than replacing it, which is what the API does and what the toast says. Removal works from the row, or by
typing a ticker: a symbol the portfolio does not hold produces an error toast rather than a pointless
confirmation dialog, and one it does hold is confirmed before anything is sent.

### Throughout

Dark, light and system themes, applied before first paint so there is no flash on load. Every successful
write and every failure raises a toast. Every button that triggers a request disables itself and shows a
spinner until the request settles. Responsive from phone to desktop.

## Architecture

```
src/
  app/                     shell: routing, layout, providers, error boundary
  config/                  configuration, Zod-validated at startup
  features/
    portfolios/            the list, and the portfolio endpoints
    portfolio-detail/      one portfolio's holdings, priced live
    quotes/                market data: the REST batch and the WebSocket feed
  shared/
    api/                   HTTP client, error model, cache keys
    lib/                   formatting, class merging, logging
    ui/                    the primitives: buttons, fields, dialogs, toasts, skeletons
  test/                    setup, custom jsdom environment, factories, fakes
```

Feature-first. A feature owns its `api/`, `components/`, `hooks/`, `lib/` and `pages/`; `shared/` holds only
what more than one feature needs, and never imports from `features/`.

### Decisions worth explaining

**Everything from the wire is parsed, not cast.** Each response goes through a Zod schema mirroring the
backend's Java records, and so does each WebSocket frame. A `Portfolio` that TypeScript merely _believes_
has a `stocks` array is the kind of lie that surfaces as a blank screen; a parse error names the field that
moved.

**One error type.** `shared/api/http-client.ts` is the only place `fetch` is called, and every failure —
timeout, offline, RFC 9457 problem document, a 2xx whose shape drifted — becomes an `ApiError` carrying a
message that is safe to show and enough structure to decide whether retrying is worth offering.

**Prices live in two layers, merged at render time.** The batch response stays in React Query's cache; only
what the socket has pushed is component state. Copying the batch into state would mean two copies of every
price, and every bug in that shape is the two disagreeing.

**The WebSocket client is a plain class.** `features/quotes/ws/quote-stream-client.ts` has no React in it.
The connection lifecycle is genuinely imperative and reads better as a small state machine than as a chain
of effects — and being plain TypeScript, it is tested against a fake socket driven step by step, with no
renderer and no real time involved.

**The watchlist is client state, not connection state.** Callers say what they want to watch; the client
sends it if the socket is open and re-sends it after a reconnect. Nothing has to sequence "wait for open,
then subscribe".

**Total value is always derived.** `shares × price`, recomputed, never stored — and `undefined` rather than
`0` when the price is unknown, because an understated total that looks authoritative is worse on a financial
dashboard than an obviously incomplete one. The portfolio's market value is marked _partial_ when some
positions have no price yet.

## Configuration

Environment-based YAML, in `config/`:

```
config.default.yaml        shared by every environment
config.development.yaml    npm run dev
config.production.yaml     npm run build
config.test.yaml           the Jest suite
```

Four layers, each overriding the one before:

1. `config.default.yaml`
2. `config.<mode>.yaml`
3. `APP_*` environment variables, at build time
4. `window.__APP_CONFIG__` from `/config.js`, written by the container entrypoint at **start-up**

The fourth layer is what makes the image environment-agnostic — one build can be promoted between
environments and pointed at a different API without being rebuilt:

```bash
docker run -e APP_API_BASE_URL=https://api.example.com/api/v1 fin-dashboard-ui
```

The merged result is validated against a Zod schema on first load. A missing or misspelled key fails on the
first paint with the offending path named, rather than surfacing later as a request to `undefined/portfolios`.

`config/` is committed. It holds no secrets — everything in it ends up in the browser bundle. Machine-specific
settings (proxy target, ports) live in `.env`; copy `.env.example`.

### Why the URLs are relative

`api.baseUrl` is `/api/v1` and `websocket.url` is `/ws/quotes`. The dev server and the production nginx image
both proxy those prefixes to the backend, so the browser only ever talks to its own origin. That means the
backend needs no CORS configuration, and an HTTPS deployment works without a config change — the WebSocket
URL is resolved against the page origin, upgrading `http`→`ws` and `https`→`wss`.

## Testing

```bash
npm run test
npm run test:coverage
```

193 tests. The density is deliberately where the risk is: the price merge, the WebSocket client, the HTTP
error model, and the input validators are tested directly as tables of cases; the pages are tested through
the DOM by role and accessible name, with the API mocked at its module boundary.

The socket is driven explicitly rather than waited on:

```ts
const socket = FakeWebSocket.latest;
socket.open();
socket.emit(aQuoteTick());
socket.serverClose();
```

so the reconnect and subscription tests are deterministic. `src/test/jsdom-environment.ts` lends jsdom the
web APIs it lacks — `fetch`, `Response`, `TextEncoder`, `WebSocket` — from Node's own spec-compliant
implementations rather than hand-rolled stubs.

## Docker

A two-stage build: Node compiles the bundle, nginx serves it. The runtime image has no Node, no npm and no
source — just static files, running as a non-root user.

```bash
docker build -t fin-dashboard-ui .
docker run -p 3000:8080 -e API_UPSTREAM=http://host.docker.internal:8080 fin-dashboard-ui
```

| Variable                | Default           | Meaning                                   |
| ----------------------- | ----------------- | ----------------------------------------- |
| `API_UPSTREAM`          | `http://api:8080` | Where nginx forwards `/api` and `/ws`     |
| `SERVER_PORT`           | `8080`            | Port nginx listens on                     |
| `APP_API_BASE_URL`      | —                 | Overrides the API base URL in the browser |
| `APP_WS_URL`            | —                 | Overrides the WebSocket URL               |
| `APP_ENVIRONMENT_LABEL` | —                 | Badge in the header                       |
| `APP_LOG_LEVEL`         | —                 | `error` \| `warn` \| `info` \| `debug`    |

nginx keeps the WebSocket location's read timeout at an hour: the feed pushes every three seconds, so the
default 60s would close healthy sockets and cause needless reconnects.

## CI

`.github/workflows/ci.yml` runs lint, format check, type-check, tests with coverage, and the build on every
push and pull request, then builds the Docker image and smoke-tests it — that the entrypoint renders a valid
nginx config, that the bundle is served, and that an unknown path falls back to `index.html` so a hard
refresh on a client-side route works.

## Notes on the backend

Two behaviours shape this UI and are worth knowing before reading the code:

- **`GET /stocks/quotes` can legitimately return 502.** Quotes come from Yahoo Finance, whose public endpoint
  rejects unauthenticated callers. The UI treats this as "prices unavailable" rather than as a failure of the
  app: shares stay correct, the table stays usable, and the notice offers a retry.
- **`percentChange` is omitted, not zeroed,** when the previous close is unknown. The UI renders an em dash
  for that rather than a misleading `0.00%`, and distinguishes "no data for this symbol" from "no price yet".

Full API detail is in the [backend README](../../java/fin-dashboard/README.md).
