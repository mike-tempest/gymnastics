import { getMetadataArgsStorage } from 'typeorm';

import { EXPORT_FILES } from './export.manifest';

/**
 * Guards on the manifest itself.
 *
 * The redaction list is the only thing standing between a password hash and
 * users.csv, and it is matched by name. A silently unmatched name would be a
 * no-op that no other test would notice, so this reads TypeORM's own decorator
 * metadata (available without a database connection) and insists that every
 * omitted name is a real column on the entity it is written against.
 */

/** A class constructor, which is what every manifest entity is. */
type EntityClass = new (...args: never[]) => unknown;

/** Column property names declared on an entity class or anything it extends. */
function declaredColumns(entity: unknown): string[] {
  const storage = getMetadataArgsStorage();
  const names: string[] = [];
  for (
    let target = entity as EntityClass | null;
    target;
    target = Object.getPrototypeOf(target) as EntityClass | null
  ) {
    for (const column of storage.columns) {
      if (column.target === target) names.push(column.propertyName);
    }
  }
  return names;
}

describe('export manifest', () => {
  it('names every file exactly once', () => {
    const filenames = EXPORT_FILES.map((spec) => spec.filename);
    expect(new Set(filenames).size).toBe(filenames.length);
  });

  it('writes every file as a .csv', () => {
    for (const spec of EXPORT_FILES) {
      expect(spec.filename).toMatch(/^[a-z0-9-]+\.csv$/);
    }
  });

  it('describes every file, because the README is built from those lines', () => {
    for (const spec of EXPORT_FILES) {
      expect(spec.description.length).toBeGreaterThan(20);
      expect(spec.description.endsWith('.')).toBe(true);
    }
  });

  it('omits only columns that actually exist on the entity', () => {
    for (const spec of EXPORT_FILES) {
      if (!spec.omit?.length) continue;
      const columns = declaredColumns(spec.entity);
      for (const omitted of spec.omit) {
        // A miss here means the column was renamed and the redaction has
        // quietly stopped redacting.
        expect({ file: spec.filename, omitted, columns }).toEqual({
          file: spec.filename,
          omitted,
          columns: expect.arrayContaining([omitted]),
        });
      }
    }
  });

  it('redacts the credentials and single-use secrets it is meant to', () => {
    const omitted = new Map(EXPORT_FILES.map((spec) => [spec.filename, spec.omit ?? []]));

    expect(omitted.get('users.csv')).toContain('password_hash');
    expect(omitted.get('families.csv')).toContain('invite_token');
    expect(omitted.get('family-invites.csv')).toContain('token');
    expect(omitted.get('waiting-list-offers.csv')).toContain('accept_token');
  });

  it('leaves the wellbeing tables out entirely', () => {
    const filenames = EXPORT_FILES.map((spec) => spec.filename);
    expect(filenames).not.toContain('wellbeing-logs.csv');
    expect(filenames).not.toContain('cycle-logs.csv');
  });
});
