import { appConfig, resolveAppConfig } from './app-config';

/**
 * Configuration resolution.
 *
 * The behaviour worth protecting is that a broken config fails loudly on startup and names the offending
 * path, rather than producing requests to `undefined/portfolios` three screens later.
 */
describe('resolveAppConfig', () => {
  const valid = {
    app: { name: 'Fin Dashboard', environmentLabel: '' },
    api: { baseUrl: '/api/v1', timeoutMs: 15000 },
    websocket: {
      url: '/ws/quotes',
      reconnect: { enabled: true, initialDelayMs: 1000, maxDelayMs: 15000, maxAttempts: 8 },
    },
    logging: { level: 'info' },
  };

  it('accepts a complete configuration', () => {
    expect(resolveAppConfig(valid).api.baseUrl).toBe('/api/v1');
  });

  it('lets a runtime override replace one nested value without restating the rest', () => {
    // This is what the Docker entrypoint writes into /config.js.
    const resolved = resolveAppConfig(valid, { api: { baseUrl: 'https://api.example.com/api/v1' } });

    expect(resolved.api.baseUrl).toBe('https://api.example.com/api/v1');
    expect(resolved.api.timeoutMs).toBe(15000);
    expect(resolved.websocket.url).toBe('/ws/quotes');
  });

  it('names the offending path when a value is missing', () => {
    const { api: _omitted, ...withoutApi } = valid;

    expect(() => resolveAppConfig(withoutApi)).toThrow(/api/);
  });

  it('rejects a value of the wrong type rather than coercing it', () => {
    expect(() => resolveAppConfig({ ...valid, api: { baseUrl: '/api/v1', timeoutMs: '15000' } })).toThrow(
      /api\.timeoutMs/,
    );
  });

  it('rejects an unknown log level', () => {
    expect(() => resolveAppConfig({ ...valid, logging: { level: 'chatty' } })).toThrow(/logging\.level/);
  });

  it('rejects an empty API base URL, which would silently produce relative requests', () => {
    expect(() => resolveAppConfig({ ...valid, api: { baseUrl: '', timeoutMs: 15000 } })).toThrow(/api\.baseUrl/);
  });
});

describe('appConfig', () => {
  it('is loaded from config/config.test.yaml under Jest', () => {
    // Proves the fixture wiring works: if `virtual:app-config` were not mapped, importing this module
    // would fail outright.
    expect(appConfig.app.environmentLabel).toBe('TEST');
    expect(appConfig.api.baseUrl).toBe('http://api.test/api/v1');
    expect(appConfig.websocket.reconnect.enabled).toBe(false);
  });
});
