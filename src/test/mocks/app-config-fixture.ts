import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import yaml from 'js-yaml';

/**
 * Stands in for the `virtual:app-config` module that the Vite plugin provides during a real build.
 *
 * Reads the same `config/config.test.yaml` a `--mode test` build would, rather than hard-coding an
 * object here. That keeps one class of bug out of the suite entirely: a config key renamed in YAML but
 * not in the schema fails a test instead of passing against a stale literal.
 */
const configPath = resolve(process.cwd(), 'config', 'config.test.yaml');
const parsed: unknown = yaml.load(readFileSync(configPath, 'utf8'));

export default parsed;
