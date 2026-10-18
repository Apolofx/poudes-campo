#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function git(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function lastTag() {
  return git('describe --tags --abbrev=0');
}

export function versionAt(sha) {
  try {
    const raw = git(`show ${sha}:package.json`);
    return JSON.parse(raw).version;
  } catch {
    return undefined;
  }
}

export function hasBumpSinceTag(sha, tag) {
  const range = tag ? `${tag}..${sha}` : sha;
  return /chore: bump /.test(git(`log --format=%s ${range}`));
}

export function tagAt(sha) {
  const out = git(`tag --points-at ${sha}`);
  return out ? out.split('\n')[0] : '';
}

export function bumpReminder() {
  return [
    '[release] Esta rama no tiene bump de versión desde el último tag.',
    'Antes de mergear, cerrá el versionado del PR:',
    '  npm version patch --no-git-tag-version    # o minor/major según el cambio',
    '  git add package.json package-lock.json',
    '  git commit -m "chore: bump X.Y.Z"',
  ].join('\n');
}

export function tagReminder(version) {
  return [
    `[release] main avanzó a v${version} y no tiene tag. Cerrá la ventana del changelog:`,
    `  git tag -a v${version} -m "v${version}"`,
    `  git push origin v${version}`,
    '(el tag no dispara deploy ni banner)',
  ].join('\n');
}

function main() {
  const mode = process.argv[2];

  if (mode === 'pre-push') {
    if (process.stdin.isTTY) return;
    const input = readFileSync(0, 'utf-8');
    for (const line of input.split('\n')) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;
      const [, localSha, remoteRef] = parts;
      if (remoteRef.startsWith('refs/tags/')) continue;
      if (!remoteRef.startsWith('refs/heads/')) continue;
      if (/^0+$/.test(localSha)) continue;
      if (remoteRef === 'refs/heads/main') {
        if (!tagAt(localSha)) {
          const version = versionAt(localSha);
          if (version) console.error(`\n${tagReminder(version)}\n`);
        }
      } else if (!hasBumpSinceTag(localSha, lastTag())) {
        console.error(`\n${bumpReminder()}\n`);
      }
    }
    return;
  }

  if (mode === 'post-merge') {
    const branch = git('rev-parse --abbrev-ref HEAD');
    if (branch === 'HEAD' || branch !== 'main') return;
    const sha = git('rev-parse HEAD');
    if (!tagAt(sha)) {
      const version = versionAt(sha);
      if (version) console.error(`\n${tagReminder(version)}\n`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
