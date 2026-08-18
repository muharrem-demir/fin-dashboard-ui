# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

The front end for **fin-dashboard**: list and edit stock portfolios, and watch their holdings reprice in
real time. React 19 + TypeScript + Vite, talking to a Spring Boot API at `../../java/fin-dashboard`.

There is no authentication. Every endpoint is open by design.

## Commands

```bash
npm run dev            # Vite dev server on :5173, proxying /api and /ws to :8080
npm run verify         # lint + typecheck + test + build — run this before saying you are done
npm run lint           # ESLint, --max-warnings=0
npm run lint:fix
npm run typecheck      # tsc --build (both project references)
npm run test           # Jest
npm run test:watch
npm run test:coverage  # enforces the thresholds in jest.config.mjs
npm run format         # Prettier
npm run build          # lint + typecheck + vite build
npm run build:only     # vite build alone, for when the gates already ran
```

`npm run build` runs the linter and the type-checker first, on purpose: a bundle that would fail CI
cannot be produced by accident. Use `build:only` inside a pipeline that has already linted.

The backend must be running for the app to do anything:

```bash
cd ../../java/fin-dashboard && docker compose up -d
```

Or bring up the whole stack, UI included, from this directory with `docker compose up -d --build`
(<http://localhost:3000>).

## Architecture

```
src/
  app/          the shell: routing, layout, providers, error boundary
  config/       app configuration, validated at startup
  features/
    portfolios/       the portfolio list and its endpoints
    portfolio-detail/ one portfolio's holdings, priced live
    quotes/           market quotes: the REST batch and the WebSocket feed
  shared/       api client, formatting, and the UI primitives
  test/         setup, the custom jsdom environment, factories, fakes
```

Feature-first, not layer-first. A feature owns its `api/`, `components/`, `hooks/`, `lib/` and `pages/`;
`shared/` holds only what more than one feature genuinely needs. When adding a feature, add a directory —
do not add a file to a global `components/`.

### Dependency direction

`app` → `features` → `shared` → `config`. Features may depend on `shared` and on each other's `api`
modules (`portfolio-detail` reads `quotes/api`), but `shared` must never import from `features`. If a
shared component needs a feature's type, the design is wrong.

### The pieces worth knowing before changing anything

| Concern       | Where                                        | Note                                                                                |
| ------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| HTTP          | `shared/api/http-client.ts`                  | The only place `fetch` is called. Everything else goes through it.                  |
| Errors        | `shared/api/api-error.ts`                    | Every failure becomes an `ApiError`. Never throw a bare `Error` from an API module. |
| Cache keys    | `shared/api/query-keys.ts`                   | All of them, in one object. Never inline a key array.                               |
| Live feed     | `features/quotes/ws/quote-stream-client.ts`  | A plain class, no React. Tested against a fake socket.                              |
| Price merge   | `features/portfolio-detail/lib/holdings.ts`  | Pure. The most important file in the repo to get right.                             |
| Configuration | `config/*.yaml` + `src/config/app-config.ts` | Zod-validated at startup; fails loudly.                                             |

## Conventions

### TypeScript

- **`any` is banned** and the ban is enforced (`@typescript-eslint/no-explicit-any`, plus the whole
  `no-unsafe-*` family). Use `unknown` and narrow it.
- `strict` plus `noUncheckedIndexedAccess`. A record lookup is `T | undefined`; handle it rather than
  asserting. Non-null assertions (`!`) are a lint error.
- `strict-boolean-expressions` is on. Write `if (name !== '')`, not `if (name)`; `if (count > 0)`, not
  `if (count)`. This is deliberate — the app is full of optional numbers where `0` is a real value.
- Import types with `import type`.

### Validating what comes over the wire

Every API response is parsed through a Zod schema in the feature's `api/*-schemas.ts`, and so is every
WebSocket frame. Do not cast a response to a type. A contract that drifts must fail as a named parse
error, not as `undefined` in a table cell.

### React

- Function components; hooks for logic. `React.JSX.Element` as the return type.
- **No `setState` inside an effect** to mirror other state. It is a lint error, and it is usually a sign
  that the value should be derived during render or that the state should live where the event happens.
  Existing examples of the alternatives: mount a dialog only while it is open (`CreatePortfolioDialog`),
  derive from the query cache (`useLiveHoldings`), or write to the DOM (`usePriceFlash`).
- Effects are for real external systems: the socket, `document`, timers.
- Refs are written in effects, never during render.

### Server state

React Query owns everything that came from the server. There is no Redux and no global store, and the
app does not need one — the only client state is the theme, the toast stack, and the live quote layer.

Every mutation lives in `features/*/api/*-queries.ts` and owns three things: the request, the cache
invalidation, and the toast. Keep them together so no screen can forget one.

### Toasts and loading

Two requirements the reviewer will check, so they are worth stating plainly:

- Every successful create, update or delete raises a success toast; every failure raises an error toast.
  Both belong in the mutation hook, not the component.
- Every button that triggers a request passes the mutation's `isPending` to `loading`, which disables it
  and shows a spinner. Never manage `disabled` by hand for this.

### Styling

Tailwind v4, configured in `src/index.css` — there is no `tailwind.config.js`.

Use the semantic tokens (`bg-surface-raised`, `text-content-secondary`, `border-border-subtle`), not raw
palette colours, so both themes follow automatically. `gain`/`loss` are for market direction only.
Compose classes with `cn()` from `shared/lib/cn.ts`.

Mobile-first: unprefixed styles are the phone layout, `sm:`/`lg:` widen it. Wide content scrolls inside
its own `overflow-x-auto`; the page body must never scroll sideways.

### Accessibility

Not optional here. Icon-only buttons take a `label`. Colour never carries meaning alone — the percent
change badge repeats direction as an arrow and a sign. Skeletons are `aria-hidden` with one `role="status"`
on the region. Dialogs trap focus and restore it on close.

## Testing

Jest with Testing Library, transformed by SWC. `npm run test:coverage` enforces the thresholds.

- **Test behaviour, not implementation.** Query by role and label, as a user would.
- Mock at the API module boundary (`jest.mock('../api/portfolio-api')`), not `fetch`, except in
  `http-client.test.ts` where the client itself is the subject.
- Use `renderWithProviders` from `src/test/test-utils.tsx` so the tree has the real providers.
- Build payloads with the factories in `src/test/factories.ts`.
- For the socket, use `installFakeWebSocket()` and drive it explicitly — `open()`, `emit()`,
  `serverClose()`. Never wait on real time.
- Pure logic (`holdings.ts`, the validators, `format.ts`) is tested directly, as a table of cases. That is
  where the density should be.

`src/test/jsdom-environment.ts` adds the web APIs jsdom lacks. If a test fails with "X is not defined",
that list is the place to look — but check first whether the app should be using X at all.

## Configuration

Four layers, each overriding the one before:

1. `config/config.default.yaml`
2. `config/config.<mode>.yaml`
3. `APP_*` environment variables at build time
4. `window.__APP_CONFIG__` from `/config.js`, written by `docker/entrypoint.sh` at container start

Adding a setting means: add it to `config.default.yaml`, add it to the Zod schema in
`src/config/app-config.ts`, and — if a deployment should be able to override it — add it to `ENV_OVERRIDES`
in `vite-plugins/app-config-plugin.ts` and to `docker/entrypoint.sh`. The schema is not optional; an
unvalidated setting will eventually be `undefined` in production.

API and WebSocket URLs are **relative** (`/api/v1`, `/ws/quotes`). The dev server and the nginx image both
proxy them to the backend, which keeps the browser on one origin and means the backend needs no CORS
configuration. Do not "fix" this by hard-coding `http://localhost:8080`.

No source file reads `import.meta.env`. Configuration comes from `virtual:app-config` via
`src/config/app-config.ts`, which is also what lets the Jest suite load `config.test.yaml`.

## The backend contract

Base path `/api/v1`. Full detail in `../../java/fin-dashboard/README.md`; the parts that shape this client:

- `POST /portfolios/{id}/stocks` **accumulates** — adding a ticker already held increases the position
  rather than replacing it, and it returns the whole updated portfolio.
- Tickers are matched case-insensitively and normalised to upper case. The client upper-cases too, so
  lookups never miss.
- `percentChange` is **omitted** when the previous close is unknown or zero, rather than sent as `0.00`.
  Render an em dash for that, never a flat zero. `formatPercentChange` already does.
- Quote requests and stream subscriptions are capped at **50 symbols**.
- `GET /stocks/quotes` can legitimately return **502**: Yahoo rejects unauthenticated callers. This is
  expected, not a bug in this app. Shares stay correct and the table stays usable.
- Errors are RFC 9457 problem documents; validation failures add `errors: [{field, message}]`.
- `DELETE /portfolios/{id}/stocks/{ticker}` returns 404 when the ticker is not held.

### The WebSocket

`ws://host/ws/quotes`, pushing every three seconds.

- `{"action":"subscribe","tickers":[...]}` **replaces** the whole watchlist. There is no incremental add,
  so adding or removing a holding re-sends the full list.
- An empty ticker list is a client error; "watch nothing" is `{"action":"unsubscribe"}`.
- `error` and `unavailable` frames do **not** close the connection and do not discard the subscription.
  Do not treat them as transport failures.
- The connection is closed when the detail page unmounts.

## Things that will bite you

- **Do not put the batch quote response into component state.** It lives in the React Query cache; the
  live layer is merged over it at render time. Copying it creates two copies of every price.
- **Do not subscribe to the socket from a component.** `useQuoteStream` owns the lifecycle, and it is
  keyed on the _contents_ of the ticker list, not its identity — `stocks.map(...)` is a new array every
  render.
- **Total value is `shares × price`,** always recomputed, never stored. It must be `undefined` when the
  price is unknown, not `0`.
- **`npm run dev` needs the backend on :8080.** Without it, every request fails with a network error and
  the UI is behaving correctly by saying so.
