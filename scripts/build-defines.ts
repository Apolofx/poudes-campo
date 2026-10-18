import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function readJson(path: string, fallback: unknown) {
  try { return JSON.parse(readFileSync(resolve(root, path), 'utf-8')); }
  catch { return fallback; }
}

function gitShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf-8' }).trim();
  } catch {
    return 'sin-commit';
  }
}

const pkg = readJson('package.json', { version: '0.0.0' });

export const buildDefines: Record<string, string> = {
  __APP_VERSION__: JSON.stringify(pkg.version),
  __GIT_SHA__: JSON.stringify(gitShortSha()),
  __CHANGELOG__: JSON.stringify(readJson('src/changelog.json', { version: pkg.version, entries: [] })),
};
