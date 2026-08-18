import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { deepMerge, loadAppConfig } from './app-config-plugin';

/**
 * The build-time half of the configuration system.
 *
 * Tested against real files in a temporary directory rather than a mocked `fs`: the thing being verified
 * is the layering of default over mode over environment variable, and a mocked file system would only
 * prove the mock was set up as expected.
 */
describe('deepMerge', () => {
  it('merges nested objects rather than replacing them', () => {
    expect(deepMerge({ api: { baseUrl: '/api', timeoutMs: 100 } }, { api: { timeoutMs: 200 } })).toEqual({
      api: { baseUrl: '/api', timeoutMs: 200 },
    });
  });

  it('replaces arrays wholesale, so an override list is the whole list', () => {
    expect(deepMerge({ hosts: ['a', 'b'] }, { hosts: ['c'] })).toEqual({ hosts: ['c'] });
  });

  it('leaves the inputs untouched', () => {
    const base = { api: { timeoutMs: 100 } };
    deepMerge(base, { api: { timeoutMs: 200 } });

    expect(base.api.timeoutMs).toBe(100);
  });
});

describe('loadAppConfig', () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), 'app-config-'));

    writeFileSync(
      join(configDir, 'config.default.yaml'),
      ['app:', '  name: Fin Dashboard', 'api:', '  baseUrl: /api/v1', '  timeoutMs: 15000', ''].join('\n'),
    );

    writeFileSync(join(configDir, 'config.production.yaml'), ['api:', '  timeoutMs: 30000', ''].join('\n'));
  });

  it('layers the mode file over the defaults', () => {
    expect(loadAppConfig({ configDir, mode: 'production', env: {} })).toEqual({
      app: { name: 'Fin Dashboard' },
      api: { baseUrl: '/api/v1', timeoutMs: 30000 },
    });
  });

  it('falls back to the defaults when no file exists for the mode', () => {
    const config = loadAppConfig({ configDir, mode: 'staging', env: {} });

    expect(config).toEqual({ app: { name: 'Fin Dashboard' }, api: { baseUrl: '/api/v1', timeoutMs: 15000 } });
  });

  it('lets an environment variable override the YAML, for container builds', () => {
    const config = loadAppConfig({
      configDir,
      mode: 'production',
      env: { APP_API_BASE_URL: 'https://api.example.com/api/v1' },
    });

    expect(config).toMatchObject({ api: { baseUrl: 'https://api.example.com/api/v1', timeoutMs: 30000 } });
  });

  it('coerces a numeric environment variable to a number, so schema validation passes', () => {
    // Environment variables are strings; `timeoutMs: "5000"` would be rejected by the Zod schema.
    const config = loadAppConfig({ configDir, mode: 'production', env: { APP_API_TIMEOUT_MS: '5000' } });

    expect(config).toMatchObject({ api: { timeoutMs: 5000 } });
  });

  it('creates the intermediate objects an override path needs', () => {
    const config = loadAppConfig({ configDir, mode: 'production', env: { APP_WS_URL: '/live' } });

    expect(config).toMatchObject({ websocket: { url: '/live' } });
  });

  it('treats an empty YAML file as an empty layer rather than failing', () => {
    writeFileSync(join(configDir, 'config.empty.yaml'), '');

    expect(loadAppConfig({ configDir, mode: 'empty', env: {} })).toMatchObject({ api: { timeoutMs: 15000 } });
  });

  it('rejects a YAML file whose root is not a mapping', () => {
    writeFileSync(join(configDir, 'config.broken.yaml'), '- just\n- a\n- list\n');

    expect(() => loadAppConfig({ configDir, mode: 'broken', env: {} })).toThrow(/must contain a YAML mapping/);
  });
});
