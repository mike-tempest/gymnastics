/**
 * Generate a url-safe slug from arbitrary text.
 *
 * Lowercases, strips accents, replaces any run of non-alphanumeric characters
 * with a single hyphen, and trims leading/trailing hyphens. Falls back to
 * 'club' when the input reduces to an empty string (e.g. all punctuation).
 */
export function slugify(input: string): string {
  const base = (input ?? '')
    .normalize('NFKD')
    // Strip combining diacritical marks left behind by NFKD decomposition.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return base.length > 0 ? base : 'club';
}

/**
 * Produce a unique slug given a base name and a predicate that reports whether
 * a candidate slug is already taken. If the base slug is taken, suffixes -2,
 * -3, ... until a free one is found.
 */
export async function generateUniqueSlug(
  name: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(name);

  if (!(await exists(base))) {
    return base;
  }

  let suffix = 2;
  // Bounded loop guards against a pathological infinite loop.
  while (suffix < 10000) {
    const candidate = `${base}-${suffix}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
    suffix += 1;
  }

  throw new Error(`Unable to generate a unique slug for "${name}"`);
}
