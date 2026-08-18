import buildTimeConfig from 'virtual:app-config';
import { z } from 'zod';

/**
 * The application's configuration, resolved once at module load.
 *
 * Two sources: the YAML baked in by the Vite plugin, and an optional `window.__APP_CONFIG__` that a
 * container writes into `/config.js` at startup. The runtime layer wins, which is what allows the
 * same image to be promoted between environments.
 *
 * Validation is deliberately strict and eager. A missing or misspelled key is a deployment mistake,
 * and it is far cheaper to fail on the first paint with the offending path named than to discover it
 * as a request to `undefined/portfolios`.
 */

const logLevelSchema = z.enum(['error', 'warn', 'info', 'debug']);

const appConfigSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    environmentLabel: z.string(),
  }),
  api: z.object({
    baseUrl: z.string().min(1),
    timeoutMs: z.number().int().positive(),
  }),
  websocket: z.object({
    url: z.string().min(1),
    reconnect: z.object({
      enabled: z.boolean(),
      initialDelayMs: z.number().int().positive(),
      maxDelayMs: z.number().int().positive(),
      maxAttempts: z.number().int().nonnegative(),
    }),
  }),
  logging: z.object({
    level: logLevelSchema,
  }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

declare global {
  interface Window {
    /** Runtime overrides injected by `/config.js`. Absent in development. */
    __APP_CONFIG__?: unknown;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }

  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    result[key] = key in result ? deepMerge(result[key], value) : value;
  }

  return result;
}

function runtimeOverrides(): unknown {
  return typeof window === 'undefined' ? {} : (window.__APP_CONFIG__ ?? {});
}

/** Exported for tests, which need to resolve a config without touching `window`. */
export function resolveAppConfig(buildTime: unknown, runtime: unknown = {}): AppConfig {
  const merged = deepMerge(buildTime, runtime);
  const result = appConfigSchema.safeParse(merged);

  if (!result.success) {
    const problems = result.error.issues
      // An issue at the very root has an empty path; naming it "(root)" beats printing a bare colon.
      .map((issue) => {
        const path = issue.path.join('.');
        return `  - ${path === '' ? '(root)' : path}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(`Invalid application configuration:\n${problems}`);
  }

  return result.data;
}

export const appConfig: AppConfig = resolveAppConfig(buildTimeConfig, runtimeOverrides());
