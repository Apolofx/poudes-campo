import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'));
const version = pkg.version || '0.0.0';

let log;
try {
  const tag = execSync('git describe --tags --abbrev=0 2>/dev/null', { cwd: root, encoding: 'utf-8' }).trim();
  log = execSync(`git log --oneline ${tag}..HEAD`, { cwd: root, encoding: 'utf-8' });
} catch {
  log = execSync('git log --oneline -20', { cwd: root, encoding: 'utf-8' });
}

const entries = log
  .split('\n')
  .filter(Boolean)
  .map((line) => line.replace(/^^[a-f0-9]+\s+/, ''))
  .filter((msg) => /^(feat|fix)\(/.test(msg));

const changelog = { version, entries };

const outPath = resolve(root, 'src/changelog.json');
writeFileSync(outPath, JSON.stringify(changelog, null, 2) + '\n');
console.log(`changelog.json → v${version} (${entries.length} entries)`);
