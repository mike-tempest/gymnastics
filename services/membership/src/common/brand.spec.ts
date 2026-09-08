import * as fs from 'fs';
import * as path from 'path';
import {
  BRAND,
  MEMBER_NOUN,
  MEMBER_NOUN_PLURAL,
  MEMBER_NOUN_LOWER,
  MEMBER_NOUN_PLURAL_LOWER,
} from './brand';

/**
 * The brand strings live in three places that cannot import one another: this
 * service, the web app, and a static JSON manifest. They carry "keep in sync"
 * comments and nothing else, so they drift silently.
 *
 * The other two files are read as text rather than imported: the web app is a
 * separate tsconfig, and path-mapping it into this jest project would make the
 * test pass through a compiler that the real app never uses.
 */
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const WEB_BRAND = path.join(REPO_ROOT, 'apps/web/src/lib/brand.ts');
const WEB_MANIFEST = path.join(REPO_ROOT, 'apps/web/public/site.webmanifest');

/** Comments are dropped so that an example in a doc block cannot be read as
 * the value. */
function readConst(source: string, name: string): string | undefined {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`).exec(code)?.[1];
}

describe('brand strings stay in sync across the service, the web app and the manifest', () => {
  const webSource = fs.readFileSync(WEB_BRAND, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(WEB_MANIFEST, 'utf8')) as Record<string, string>;

  it('uses one product name everywhere', () => {
    expect(readConst(webSource, 'PRODUCT_NAME')).toBe(BRAND.name);
    expect(manifest.name).toBe(BRAND.name);
    // short_name exists to be shortened for a home-screen label, so it only
    // has to stay an opening of the product name rather than equal it.
    expect(manifest.short_name).not.toBe('');
    expect(BRAND.name.startsWith(manifest.short_name)).toBe(true);
  });

  it('uses one display noun for the Member entity', () => {
    expect(readConst(webSource, 'MEMBER_NOUN')).toBe(MEMBER_NOUN);
    expect(readConst(webSource, 'MEMBER_NOUN_PLURAL')).toBe(MEMBER_NOUN_PLURAL);
  });

  it('derives the lowercase forms rather than hard-coding them', () => {
    expect(MEMBER_NOUN_LOWER).toBe(MEMBER_NOUN.toLowerCase());
    expect(MEMBER_NOUN_PLURAL_LOWER).toBe(MEMBER_NOUN_PLURAL.toLowerCase());
    expect(webSource).toContain('MEMBER_NOUN_LOWER = MEMBER_NOUN.toLowerCase()');
    expect(webSource).toContain('MEMBER_NOUN_PLURAL_LOWER = MEMBER_NOUN_PLURAL.toLowerCase()');
  });
});
