---
name: add-ui-component
description: Build a component that matches this app's conventions — theming tokens, responsive layout, accessibility, loading and empty states. Use when adding any component, or when a component needs to look and behave like the rest of the app.
---

# Adding a component

## Where it goes

- Used by one feature → `src/features/<feature>/components/`
- A generic primitive with no domain knowledge → `src/shared/ui/`

`shared/ui` must never import from `features`. If a "shared" component needs a `Portfolio`, it is a feature
component.

## Shape

```tsx
import { cn } from '../../shared/lib/cn';

export interface ThingCardProps {
  readonly thing: Thing;
  readonly onSelect: (thing: Thing) => void;
  readonly className?: string;
}

export function ThingCard({ thing, onSelect, className }: ThingCardProps): React.JSX.Element {
  return <div className={cn('rounded-card border border-border-subtle bg-surface-raised', className)}>…</div>;
}
```

- `readonly` props, an exported `Props` interface, `React.JSX.Element` as the return type.
- Accept `className` and merge it last with `cn()`, so a caller can override.

## Colour

Use the semantic tokens, never raw palette values — that is what makes both themes work without a second
code path:

| Purpose | Token |
| --- | --- |
| Page background | `bg-surface-base` |
| Card | `bg-surface-raised` |
| Inset / muted panel | `bg-surface-sunken` |
| Hover | `bg-surface-hover` |
| Borders | `border-border-subtle`, `border-border-strong` |
| Text | `text-content-primary`, `text-content-secondary`, `text-content-muted` |
| Accent | `brand-*` |
| Market direction | `gain-*`, `loss-*` — only ever for gains and losses |

Add a `dark:` variant only for something the tokens cannot express. If a component needs many of them,
the token set is probably missing one — add it in `src/index.css` rather than hard-coding a colour.

## Responsive

Mobile-first: write the phone layout unprefixed, then widen with `sm:` and `lg:`.

- Stack on small screens, go horizontal at `sm:` — `flex flex-col sm:flex-row`.
- Touch targets at least 36–40px (`size-9`, `h-10`).
- Wide content — tables, code, diagrams — scrolls inside its own `overflow-x-auto` container. The page
  body must never scroll sideways.
- Reverse stacked dialog actions (`flex-col-reverse sm:flex-row`) so the primary action sits at the bottom
  on a phone, where the thumb is.

## Accessibility

- An icon-only button uses `IconButton` and its required `label`; a bare `<button>` with only an SVG has no
  accessible name.
- Decorative icons get `aria-hidden="true"`.
- Colour never carries meaning alone. Follow `ChangeBadge`: colour, plus an arrow, plus an explicit sign.
- Inputs use `TextField`, which wires up its own label, hint and error ids.
- Real semantics: `<table>` for tabular data, `<ul>` for lists, `<dl>` for label/value pairs.

## The four states

Every component that shows server data needs all four, and the repo has an example of each:

| State | Use |
| --- | --- |
| Loading | A skeleton shaped like the real content — `PortfolioListSkeleton`, `HoldingsTableSkeleton` |
| Empty | `EmptyState` with an icon, a message and, where possible, the action that fills it |
| Error | `ErrorState`, which offers retry only when retrying could work |
| Loaded | The content |

Skeletons must match the loaded layout, or the page jumps when data arrives.

## Buttons that trigger requests

```tsx
<Button loading={mutation.isPending} onClick={() => { mutation.mutate(input); }}>Save</Button>
```

`loading` handles both the disabled state and the spinner.

## Fast Refresh

A module that exports a component must export *only* components. Put a helper, a constant or a context in
its own file — `lib/portfolio-validation.ts` and `toast-context.ts` exist for exactly this reason, and the
linter enforces it.

## Testing

Query by role and accessible name, the way a user finds things:

```tsx
renderWithProviders(<ThingCard thing={aThing()} onSelect={jest.fn()} />);
expect(screen.getByRole('button', { name: 'Delete Growth' })).toBeInTheDocument();
```

Never assert on a class name or a test id when a role and name will do — the former passes while the
component is unusable.

## Finish

`npm run verify`.
