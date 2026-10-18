#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hooksDir = resolve(root, '.git', 'hooks');
const script = resolve(root, 'scripts', 'release-check.mjs');

if (!existsSync(hooksDir)) {
  console.log('No .git/hooks — hooks no instalados (¿repo sin .git?).');
  process.exit(0);
}

const hooks = {
  'pre-push': `node "${script}" pre-push`,
  'post-merge': `node "${script}" post-merge`,
};

mkdirSync(hooksDir, { recursive: true });

for (const [name, command] of Object.entries(hooks)) {
  const path = resolve(hooksDir, name);
  const contents = `#!/usr/bin/env bash\n# Recordatorio de release (ver AGENTS.md → Release). No bloquea.\nexec ${command}\n`;
  if (existsSync(path) && readFileSync(path, 'utf-8') === contents) {
    console.log(`hook ${name}: ya estaba instalado`);
    continue;
  }
  writeFileSync(path, contents);
  chmodSync(path, 0o755);
  console.log(`hook ${name}: instalado en .git/hooks/${name}`);
}
