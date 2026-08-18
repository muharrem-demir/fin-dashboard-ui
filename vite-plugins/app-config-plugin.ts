import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import yaml from 'js-yaml';
import type { Plugin } from 'vite';

/**
 * Serves the environment's YAML configuration to the app as `virtual:app-config`.
 *
 * Three layers, each overriding the one before it:
 *
 *   1. `config/config.default.yaml`
 *   2. `config/config.<mode>.yaml`
 *   3. a small set of environment variables, for CI and container builds
 *
 * A fourth layer exists at runtime rather than build time: `public/config.js` may assign
 * `window.__APP_CONFIG__`, which {@link ../src/config/app-config.ts} merges last. That is what lets
 * one built image be pointed at a different API without a rebuild.
 *
 * The merged object is only shaped here — it is validated against a Zod schema on the app side, so
 * a typo in a YAML key fails loudly at startup instead of surfacing as `undefined` three screens in.
 */

const VIRTUAL_ID = 'virtual:app-config';
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = Record<string, JsonValue>;

/** Environment variables that may override a YAML value, keyed by their path in the config tree. */
const ENV_OVERRIDES: readonly (readonly [envVar: string, path: readonly string[]])[] = [
  ['APP_NAME', ['app', 'name']],
  ['APP_ENVIRONMENT_LABEL', ['app', 'environmentLabel']],
  ['APP_API_BASE_URL', ['api', 'baseUrl']],
  ['APP_API_TIMEOUT_MS', ['api', 'timeoutMs']],
  ['APP_WS_URL', ['websocket', 'url']],
  ['APP_LOG_LEVEL', ['logging', 'level']],
];

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Recursive merge; arrays and scalars are replaced wholesale rather than concatenated. */
export function deepMerge(base: JsonObject, override: JsonObject): JsonObject {
  const result: JsonObject = { ...base };

  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    result[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }

  return result;
}

function readYaml(path: string): JsonObject {
  if (!existsSync(path)) {
    return {};
  }

  const parsed: unknown = yaml.load(readFileSync(path, 'utf8'));

  if (parsed === null || parsed === undefined) {
    return {};
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`Configuration file ${path} must contain a YAML mapping at its root.`);
  }

  return parsed;
}

function setPath(target: JsonObject, path: readonly string[], value: JsonValue): void {
  const [head, ...rest] = path;

  if (head === undefined) {
    return;
  }

  if (rest.length === 0) {
    target[head] = value;
    return;
  }

  const next = target[head];
  const container: JsonObject = isPlainObject(next) ? next : {};
  target[head] = container;
  setPath(container, rest, value);
}

/**
 * Environment variables arrive as strings, but `timeoutMs: "15000"` would fail schema validation.
 * A value that is entirely numeric is therefore passed through as a number.
 */
function coerce(raw: string): JsonValue {
  if (raw.trim() !== '' && Number.isFinite(Number(raw))) {
    return Number(raw);
  }

  return raw;
}

function applyEnvOverrides(config: JsonObject, env: NodeJS.ProcessEnv): JsonObject {
  const result: JsonObject = { ...config };

  for (const [envVar, path] of ENV_OVERRIDES) {
    const raw = env[envVar];

    if (raw !== undefined) {
      setPath(result, path, coerce(raw));
    }
  }

  return result;
}

export interface LoadAppConfigOptions {
  /** Directory holding the YAML files. Defaults to `<cwd>/config`. */
  readonly configDir?: string;
  /** Vite mode: `development`, `production`, or anything a custom `--mode` supplies. */
  readonly mode: string;
  readonly env?: NodeJS.ProcessEnv;
}

/** Resolves the configuration for one mode. Exported so the build can be tested without Vite. */
export function loadAppConfig({
  configDir = resolve(process.cwd(), 'config'),
  mode,
  env = process.env,
}: LoadAppConfigOptions): JsonObject {
  const defaults = readYaml(resolve(configDir, 'config.default.yaml'));
  const forMode = readYaml(resolve(configDir, `config.${mode}.yaml`));

  return applyEnvOverrides(deepMerge(defaults, forMode), env);
}

export function appConfigPlugin(options: { readonly configDir?: string } = {}): Plugin {
  let mode = 'development';

  return {
    name: 'app-config',

    configResolved(resolved) {
      mode = resolved.mode;
    },

    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_ID) {
        return null;
      }

      const config = loadAppConfig({ configDir: options.configDir, mode });

      return `export default Object.freeze(${JSON.stringify(config)});`;
    },

    /** Editing a YAML file should reload the page, not require restarting the dev server. */
    configureServer(server) {
      const dir = options.configDir ?? resolve(process.cwd(), 'config');
      server.watcher.add(dir);

      server.watcher.on('change', (path) => {
        if (path.startsWith(dir) && path.endsWith('.yaml')) {
          const virtualModule = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_ID);

          if (virtualModule) {
            server.moduleGraph.invalidateModule(virtualModule);
          }

          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}
