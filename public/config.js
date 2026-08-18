/*
 * Runtime configuration overrides.
 *
 * Empty by default: in development and in a plain `vite build`, configuration comes from the YAML
 * files in `config/`. The Docker entrypoint replaces this file at container start with whatever
 * APP_* environment variables were set, which is what lets one built image be pointed at a
 * different API without rebuilding. See docker/entrypoint.sh.
 *
 * Values here are deep-merged over the build-time config, so a partial object is fine:
 *
 *   window.__APP_CONFIG__ = { api: { baseUrl: 'https://api.example.com/api/v1' } };
 */
window.__APP_CONFIG__ = {};
