import { describe, it, expect } from 'vitest';
import {
  lastTag,
  versionAt,
  hasBumpSinceTag,
  tagAt,
  bumpReminder,
  tagReminder,
} from '../../scripts/release-check.mjs';

describe('release-check', () => {
  it('encuentra el último tag del repo', () => {
    expect(lastTag()).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('lee la versión de package.json en un commit', () => {
    const main = tagAt(lastTag()) ? lastTag().replace(/^v/, '') : null;
    if (main) expect(versionAt('HEAD')).toBe(main);
  });

  it('detecta un bump entre dos tags', () => {
    // v0.1.0..c59eb69 contiene "chore: bump 0.1.1"
    expect(hasBumpSinceTag('c59eb69', 'v0.1.0')).toBe(true);
    // v0.1.1..HEAD solo tiene el commit de docs (AGENTS.md), sin bump
    expect(hasBumpSinceTag('HEAD', 'v0.1.1')).toBe(false);
  });

  it('tagAt devuelve el tag que apunta a un commit', () => {
    expect(tagAt('c59eb69')).toBe('v0.1.1');
    expect(tagAt('33149aa')).toBe('v0.1.0');
    expect(tagAt('41ca7c7')).toBe('');
  });

  it('el recordatorio de bump menciona npm version', () => {
    expect(bumpReminder()).toContain('npm version patch --no-git-tag-version');
    expect(bumpReminder()).toContain('chore: bump');
  });

  it('el recordatorio de tag incluye la versión y el comando', () => {
    const msg = tagReminder('0.1.2');
    expect(msg).toContain('v0.1.2');
    expect(msg).toContain('git tag -a v0.1.2');
    expect(msg).toContain('git push origin v0.1.2');
  });
});
