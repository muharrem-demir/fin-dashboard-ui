import { appConfig, type LogLevel } from '../../config/app-config';

/**
 * A level-filtered console wrapper.
 *
 * Small, but it earns its place: production runs at `warn`, so the per-request `debug` lines that
 * make the WebSocket lifecycle readable in development cost nothing in a deployed bundle, and every
 * call site can log freely without deciding whether it is being noisy.
 */

const SEVERITY: Readonly<Record<LogLevel, number>> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export interface Logger {
  error(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  debug(message: string, context?: unknown): void;
}

function createLogger(level: LogLevel): Logger {
  const threshold = SEVERITY[level];

  const write =
    (at: LogLevel, sink: (message?: unknown, ...rest: unknown[]) => void) =>
    (message: string, context?: unknown): void => {
      if (SEVERITY[at] > threshold) {
        return;
      }

      if (context === undefined) {
        sink(`[fin-dashboard] ${message}`);
      } else {
        sink(`[fin-dashboard] ${message}`, context);
      }
    };

  /* eslint-disable no-console -- this module is the one place console access belongs. */
  return {
    error: write('error', console.error),
    warn: write('warn', console.warn),
    info: write('info', console.info),
    debug: write('debug', console.debug),
  };
  /* eslint-enable no-console */
}

export const logger: Logger = createLogger(appConfig.logging.level);
