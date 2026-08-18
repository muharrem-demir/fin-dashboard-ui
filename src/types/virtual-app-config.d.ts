/**
 * The build-time half of the configuration, supplied by `vite-plugins/app-config-plugin.ts`.
 *
 * Typed as `unknown` on purpose: the plugin emits whatever the YAML contained, and the only thing
 * allowed to assert its shape is the Zod schema in `src/config/app-config.ts`. Declaring it as
 * `AppConfig` here would hand out a guarantee the file system cannot make.
 */
declare module 'virtual:app-config' {
  const config: unknown;
  export default config;
}
