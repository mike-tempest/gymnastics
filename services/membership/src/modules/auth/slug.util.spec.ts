import { slugify, generateUniqueSlug } from './slug.util';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Whitby Seals')).toBe('whitby-seals');
    expect(slugify('City of Leeds SC')).toBe('city-of-leeds-sc');
  });

  it('strips accents and punctuation', () => {
    expect(slugify("St. Hélen's Swimming & Diving")).toBe('st-helen-s-swimming-diving');
  });

  it('trims leading/trailing hyphens and collapses runs', () => {
    expect(slugify('  --Hello   World--  ')).toBe('hello-world');
  });

  it('falls back to "club" for empty/punctuation-only input', () => {
    expect(slugify('!!!')).toBe('club');
    expect(slugify('')).toBe('club');
  });
});

describe('generateUniqueSlug', () => {
  it('returns the base slug when free', async () => {
    const result = await generateUniqueSlug('Whitby Seals', async () => false);
    expect(result).toBe('whitby-seals');
  });

  it('suffixes when the base slug is taken', async () => {
    const taken = new Set(['whitby-seals', 'whitby-seals-2']);
    const result = await generateUniqueSlug('Whitby Seals', async (s) => taken.has(s));
    expect(result).toBe('whitby-seals-3');
  });
});
