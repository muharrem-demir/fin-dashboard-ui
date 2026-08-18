---
name: add-endpoint
description: Wire a new backend endpoint into this front end, end to end — schema, API function, query key, React Query hook, and tests. Use when asked to call an API endpoint this app does not use yet, or when the backend has grown one.
---

# Adding an endpoint

Six files, in this order. Doing them in order matters: each step's types are what make the next one
checkable rather than guesswork.

## 1. Confirm the contract first

Never write the schema from the endpoint's name. Read the Java DTO record at
`C:\Projects\java\fin-dashboard\src\main\java\com\forinvest\dashboard\infrastructure\web\dto\`, or fetch
`http://localhost:8080/v3/api-docs` if the backend is up.

Note in particular which fields the backend may omit — that decides every `.optional()`, and getting it
wrong is the difference between a loud parse error and a blank cell in production.

## 2. Schema — `src/features/<feature>/api/<feature>-schemas.ts`

```ts
export const thingSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Optional here only because the backend genuinely omits it.
  detail: z.string().optional(),
});

export type Thing = z.infer<typeof thingSchema>;
```

Derive the TypeScript type from the schema with `z.infer`. Do not declare the interface separately — two
declarations drift.

## 3. API function — `src/features/<feature>/api/<feature>-api.ts`

A plain async function, no React:

```ts
export function getThing(id: string, signal?: AbortSignal): Promise<Thing> {
  return request({
    path: `/things/${encodeURIComponent(id)}`,
    schema: thingSchema,
    signal,
  });
}
```

- Always `request` from `shared/api/http-client.ts`; never call `fetch`.
- Always `encodeURIComponent` a path parameter.
- Pass `signal` through on reads so React Query can cancel.
- Omit `schema` entirely for a `204 No Content` endpoint.

## 4. Cache key — `src/shared/api/query-keys.ts`

Add it to the object. Never inline a key array at the call site: invalidation that misses is silent, and a
centralised key makes a typo a compile error.

## 5. Hook — `src/features/<feature>/api/<feature>-queries.ts`

For a read:

```ts
export function useThing(id: string): UseQueryResult<Thing> {
  return useQuery({
    queryKey: queryKeys.things.detail(id),
    queryFn: ({ signal }) => getThing(id, signal),
  });
}
```

For a write, the hook owns three things — the request, the cache update, and the toasts:

```ts
export function useUpdateThing(id: string): UseMutationResult<Thing, Error, UpdateThingInput> {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (input: UpdateThingInput) => updateThing(id, input),
    onSuccess: async (thing) => {
      queryClient.setQueryData(queryKeys.things.detail(id), thing);
      await queryClient.invalidateQueries({ queryKey: queryKeys.things.list() });
      toast.success('Thing updated');
    },
    onError: (error) => {
      toast.error('Could not update the thing', { description: toUserMessage(error) });
    },
  });
}
```

Rules that are not optional:

- **Every** write raises a success toast and an error toast. Put them here, not in the component, so no
  screen can forget.
- Key `setQueryData` by the id the hook was constructed with, not the id in the response.
- Delete with `removeQueries`, not `invalidateQueries` — refetching something just deleted only produces a
  404 and a misleading error toast.
- Skip retries for a 4xx if the endpoint has a not-found case.

## 6. Tests

- Add the endpoint to `src/test/factories.ts` if it introduces a payload shape.
- Test the page or component that uses it with `jest.mock` on the **api module**, not on `fetch`.
- Cover the failure at least once: assert the error toast appears.

## Using it in a component

```tsx
const updateThing = useUpdateThing(id);

<Button loading={updateThing.isPending} onClick={() => { updateThing.mutate(input); }}>
  Save
</Button>
```

`loading` disables the button and shows a spinner. Never manage `disabled` by hand for an in-flight request.

## Finish

Run `npm run verify`. It runs the linter, the type-checker, the tests and the build — and the type-aware
lint rules are what catch a floating promise or an unsafe `any` that slipped in.
