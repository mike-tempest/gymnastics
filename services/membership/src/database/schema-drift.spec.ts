import * as fs from 'fs';
import * as path from 'path';
import { DefaultNamingStrategy, getMetadataArgsStorage } from 'typeorm';

/**
 * Static guard against entity/migration schema drift.
 *
 * TypeORM selects every column an entity declares, so a column that exists on
 * the entity but in no migration turns every read of that table into a
 * Postgres 42703 at runtime. Nothing else catches it: the code compiles, the
 * types are right, and unit tests mock the repository. That is exactly how
 * dbs_checks.uploaded_document_id and dbs_checks.created_by_user_id reached a
 * live 500 on the compliance dashboard (TEM-28).
 *
 * This spec reads the entity metadata TypeORM itself would use, replays every
 * migration's up() body off disk into a model of the schema, and asserts that
 * every declared column has a migration that creates it.
 *
 * The migration reader understands the shapes this repository actually uses:
 * new Table({ columns: [...] }), queryRunner.addColumn / addColumns,
 * queryRunner.dropColumn / dropColumns / dropTable, and raw ALTER TABLE
 * statements including the table and column renames in
 * RenameSwimmerToMember1744203800000. Several migrations add columns by
 * looping over an array of table names or TableColumn instances, so single
 * level for-of loops are unrolled against their array literal. Anything the
 * reader cannot resolve is reported rather than ignored: an unresolved
 * construct would otherwise show up as a phantom drift somewhere else. If a
 * new migration uses a shape that is not modelled here, teach this file about
 * it rather than loosening the assertion.
 */

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SRC_DIR = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Source scanning helpers
// ---------------------------------------------------------------------------

/**
 * Blank out comments, preserving length and newlines so that every offset
 * computed afterwards still points at the original source.
 */
function stripComments(source: string): string {
  const out = source.split('');
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') {
        out[i] = ' ';
        i += 1;
      }
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] !== '\n') out[i] = ' ';
        i += 1;
      }
      out[i] = ' ';
      if (i + 1 < source.length) out[i + 1] = ' ';
      i += 2;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

const CLOSERS: Record<string, string> = { '(': ')', '{': '}', '[': ']' };

/** Index of the delimiter closing the one at `open`, ignoring string bodies. */
function matchDelimiter(source: string, open: number): number {
  const opener = source[open];
  const closer = CLOSERS[opener];
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === opener) depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unbalanced ${opener} at offset ${open}`);
}

/** Split an argument or array body on its top level commas. */
function splitTopLevel(source: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(source.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(source.slice(start));
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/** The body of the migration's up() method, offsets relative to the file. */
function upBodyRange(source: string): { start: number; end: number } {
  const signature = /\basync\s+up\s*\(/.exec(source);
  if (!signature) throw new Error('no up() method found');
  const parenStart = source.indexOf('(', signature.index);
  const parenEnd = matchDelimiter(source, parenStart);
  const braceStart = source.indexOf('{', parenEnd);
  return { start: braceStart, end: matchDelimiter(source, braceStart) };
}

// ---------------------------------------------------------------------------
// Schema operations read out of a migration
// ---------------------------------------------------------------------------

type Operation =
  | { at: number; kind: 'createTable'; table: string; columns: string[]; keepExisting?: boolean }
  | { at: number; kind: 'dropTable'; table: string }
  | { at: number; kind: 'addColumn'; table: string; column: string }
  | { at: number; kind: 'dropColumn'; table: string; column: string }
  | { at: number; kind: 'renameTable'; table: string; to: string }
  | { at: number; kind: 'renameColumn'; table: string; column: string; to: string };

interface MigrationRead {
  file: string;
  operations: Operation[];
  unresolved: string[];
}

const NAME_LITERAL = /\bname:\s*'([^']+)'/;

/** Column names declared by an object literal passed to `new Table`. */
function tableColumnNames(objectBody: string): string[] {
  const columnsKey = /\bcolumns:\s*\[/.exec(objectBody);
  if (!columnsKey) return [];
  const arrayStart = objectBody.indexOf('[', columnsKey.index);
  const arrayEnd = matchDelimiter(objectBody, arrayStart);
  const body = objectBody.slice(arrayStart + 1, arrayEnd);
  return splitTopLevel(body)
    .map((entry) => NAME_LITERAL.exec(entry)?.[1])
    .filter((name): name is string => Boolean(name));
}

/**
 * Array literals bound to a name, so that a for-of over one can be unrolled.
 * Covers `const NAMES = [...]` at any scope and class properties such as
 * `private static readonly CLUB_ID_TABLES = [...]`. Declarations inside up()
 * win over the rest, which keeps a `const columns` in down() from shadowing
 * the one being read.
 */
const ARRAY_DECLARATIONS = [
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=\s*\[/g,
  /^[ \t]*(?:(?:private|protected|public)\s+)?(?:static\s+)?(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(?::[^=;]*)?=\s*\[/gm,
];

function arrayDeclarations(
  source: string,
  up: { start: number; end: number },
): Map<string, string[]> {
  const inner = new Map<string, string[]>();
  const outer = new Map<string, string[]>();
  for (const declaration of ARRAY_DECLARATIONS) {
    declaration.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = declaration.exec(source)) !== null) {
      const arrayStart = match.index + match[0].length - 1;
      const arrayEnd = matchDelimiter(source, arrayStart);
      const elements = splitTopLevel(source.slice(arrayStart + 1, arrayEnd));
      const target = match.index > up.start && match.index < up.end ? inner : outer;
      target.set(match[1], elements);
      declaration.lastIndex = arrayEnd;
    }
  }
  return new Map([...outer, ...inner]);
}

/** `this.squadColumns` and `SomeMigration1744.NEW_VALUES` name a declaration. */
function declarationKey(expression: string): string {
  return expression.trim().replace(/^(?:this|[A-Za-z_$][\w$]*)\./, '');
}

interface Loop {
  variable: string;
  values: string[];
  start: number;
  end: number;
}

/** Single level for-of loops inside up(), with their iterable resolved. */
function loops(
  source: string,
  up: { start: number; end: number },
  arrays: Map<string, string[]>,
  unresolved: string[],
): Loop[] {
  const found: Loop[] = [];
  const header = /\bfor\s*\(\s*const\s+([A-Za-z_$][\w$]*)\s+of\s+/g;
  header.lastIndex = up.start;
  let match: RegExpExecArray | null;
  while ((match = header.exec(source)) !== null && match.index < up.end) {
    const parenStart = source.lastIndexOf('(', match.index + match[0].length);
    const parenEnd = matchDelimiter(source, parenStart);
    const iterable = source.slice(match.index + match[0].length, parenEnd).trim();
    const braceStart = source.indexOf('{', parenEnd);
    const braceEnd = matchDelimiter(source, braceStart);

    let values: string[] | undefined;
    if (iterable.startsWith('[') && iterable.endsWith(']')) {
      values = splitTopLevel(iterable.slice(1, -1));
    } else if (/^(?:[A-Za-z_$][\w$]*\.)?[A-Za-z_$][\w$]*$/.test(iterable)) {
      values = arrays.get(declarationKey(iterable));
    }
    if (!values) {
      unresolved.push(`for-of over an iterable this reader cannot evaluate: ${iterable}`);
    } else {
      found.push({ variable: match[1], values, start: braceStart, end: braceEnd });
    }
    header.lastIndex = braceEnd;
  }
  return found;
}

function bindingsAt(offset: number, all: Loop[]): Map<string, string[]> {
  const env = new Map<string, string[]>();
  for (const loop of all) {
    if (offset > loop.start && offset < loop.end) env.set(loop.variable, loop.values);
  }
  return env;
}

function stringLiteral(expression: string): string | undefined {
  return /^'([^']*)'$/.exec(expression.trim())?.[1];
}

function resolveTables(expression: string, env: Map<string, string[]>): string[] | undefined {
  const literal = stringLiteral(expression);
  if (literal) return [literal];
  const bound = env.get(expression.trim());
  if (!bound) return undefined;
  const names = bound.map((value) => stringLiteral(value));
  return names.every((name): name is string => Boolean(name)) ? names : undefined;
}

/**
 * One column expression can name more than one column: `new TableColumn({
 * name: column, ... })` inside a for-of over three literal names is three
 * columns, so the loop binding is substituted for the identifier.
 */
function columnNamesOf(expression: string, env: Map<string, string[]>): string[] | undefined {
  const trimmed = expression.trim();
  const literal = stringLiteral(trimmed);
  if (literal) return [literal];
  if (!trimmed.startsWith('new TableColumn')) return undefined;
  const named = NAME_LITERAL.exec(trimmed)?.[1];
  if (named) return [named];
  const identifier = /\bname:\s*([A-Za-z_$][\w$]*)/.exec(trimmed)?.[1];
  const bound = identifier ? env.get(identifier) : undefined;
  if (!bound) return undefined;
  const names = bound.map((value) => stringLiteral(value));
  return names.every((name): name is string => Boolean(name)) ? names : undefined;
}

function resolveColumns(expression: string, env: Map<string, string[]>): string[] | undefined {
  const trimmed = expression.trim();
  const bound = env.get(trimmed);
  const candidates = bound
    ? bound
    : trimmed.startsWith('[')
      ? splitTopLevel(trimmed.slice(1, matchDelimiter(trimmed, 0)))
      : [trimmed];
  const names = candidates.map((candidate) => columnNamesOf(candidate, env));
  if (!names.every((name): name is string[] => Boolean(name))) return undefined;
  return names.flat();
}

function readMigration(file: string): MigrationRead {
  const source = stripComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  const up = upBodyRange(source);
  const unresolved: string[] = [];
  const operations: Operation[] = [];
  const arrays = arrayDeclarations(source, up);
  const allLoops = loops(source, up, arrays, unresolved);
  const inUp = (offset: number) => offset > up.start && offset < up.end;

  // new Table({ name, columns: [...] })
  const tableConstructor = /\bnew Table\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = tableConstructor.exec(source)) !== null) {
    if (!inUp(match.index)) continue;
    const parenStart = source.indexOf('(', match.index);
    const objectStart = source.indexOf('{', parenStart);
    const objectEnd = matchDelimiter(source, objectStart);
    const body = source.slice(objectStart, objectEnd + 1);
    const name = NAME_LITERAL.exec(body)?.[1];
    if (!name) {
      unresolved.push('new Table({ ... }) without a literal name');
      continue;
    }
    operations.push({
      at: match.index,
      kind: 'createTable',
      table: name,
      columns: tableColumnNames(body),
    });
    tableConstructor.lastIndex = objectEnd;
  }

  // queryRunner.addColumn / addColumns / dropColumn / dropColumns / dropTable
  const call = /queryRunner\.(addColumns?|dropColumns?|dropTable)\s*\(/g;
  while ((match = call.exec(source)) !== null) {
    if (!inUp(match.index)) continue;
    const parenStart = source.indexOf('(', match.index);
    const parenEnd = matchDelimiter(source, parenStart);
    const args = splitTopLevel(source.slice(parenStart + 1, parenEnd));
    call.lastIndex = parenEnd;
    const env = bindingsAt(match.index, allLoops);
    const tables = resolveTables(args[0] ?? '', env);
    if (!tables) {
      unresolved.push(`${match[1]} with a table argument this reader cannot evaluate: ${args[0]}`);
      continue;
    }
    if (match[1] === 'dropTable') {
      for (const table of tables) operations.push({ at: match.index, kind: 'dropTable', table });
      continue;
    }
    const columns = resolveColumns(args[1] ?? '', env);
    if (!columns) {
      unresolved.push(`${match[1]} with a column argument this reader cannot evaluate: ${args[1]}`);
      continue;
    }
    const kind = match[1].startsWith('add') ? 'addColumn' : 'dropColumn';
    for (const table of tables) {
      for (const column of columns) {
        operations.push({ at: match.index, kind, table, column });
      }
    }
  }

  // Raw SQL. Only the statement shapes this repository uses are recognised.
  const upSource = source.slice(up.start, up.end);
  const rawOffset = up.start;
  const raw: Array<{ pattern: RegExp; build: (m: RegExpExecArray, at: number) => Operation }> = [
    {
      pattern: /ALTER\s+TABLE\s+"?(\w+)"?\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi,
      build: (m, at) => ({ at, kind: 'addColumn', table: m[1], column: m[2] }),
    },
    {
      pattern: /ALTER\s+TABLE\s+"?(\w+)"?\s+DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi,
      build: (m, at) => ({ at, kind: 'dropColumn', table: m[1], column: m[2] }),
    },
    {
      pattern: /ALTER\s+TABLE\s+"?(\w+)"?\s+RENAME\s+COLUMN\s+"?(\w+)"?\s+TO\s+"?(\w+)"?/gi,
      build: (m, at) => ({ at, kind: 'renameColumn', table: m[1], column: m[2], to: m[3] }),
    },
    {
      pattern: /ALTER\s+TABLE\s+"?(\w+)"?\s+RENAME\s+TO\s+"?(\w+)"?/gi,
      build: (m, at) => ({ at, kind: 'renameTable', table: m[1], to: m[2] }),
    },
    {
      // The column list of a raw CREATE TABLE is not parsed, so it only
      // registers the table: it must never blank out a table that a
      // new Table({ ... }) already described.
      pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s*\(/gi,
      build: (m, at) => ({ at, kind: 'createTable', table: m[1], columns: [], keepExisting: true }),
    },
    {
      pattern: /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi,
      build: (m, at) => ({ at, kind: 'dropTable', table: m[1] }),
    },
  ];
  const rawCounts = new Map<string, number>();
  for (const { pattern, build } of raw) {
    let rawMatch: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((rawMatch = pattern.exec(upSource)) !== null) {
      const operation = build(rawMatch, rawOffset + rawMatch.index);
      operations.push(operation);
      rawCounts.set(operation.kind, (rawCounts.get(operation.kind) ?? 0) + 1);
    }
  }

  // A raw statement the patterns above cannot read would quietly leave the
  // column it creates out of the model, which is the failure this whole spec
  // exists to prevent. Every keyword that changes the shape of a table must
  // therefore have produced an operation. An interpolated table name
  // (`ALTER TABLE "${table}" ADD COLUMN ...`, an idiom already used in this
  // directory for constraints and RLS) matches the keyword but not the
  // pattern, so it is reported rather than lost. Statements that leave the
  // columns alone, such as ADD CONSTRAINT or ENABLE ROW LEVEL SECURITY, carry
  // none of these keywords and are ignored whether or not they interpolate.
  const keywords: Array<[RegExp, Operation['kind'], string]> = [
    [/\bADD\s+COLUMN\b/gi, 'addColumn', 'ADD COLUMN'],
    [/\bDROP\s+COLUMN\b/gi, 'dropColumn', 'DROP COLUMN'],
    [/\bRENAME\s+COLUMN\b/gi, 'renameColumn', 'RENAME COLUMN'],
    [/ALTER\s+TABLE\s+[^;`\n]*?\bRENAME\s+TO\b/gi, 'renameTable', 'ALTER TABLE ... RENAME TO'],
  ];
  for (const [pattern, kind, label] of keywords) {
    const written = upSource.match(pattern)?.length ?? 0;
    const read = rawCounts.get(kind) ?? 0;
    if (written > read) {
      unresolved.push(`${written - read} raw ${label} statement(s) this reader cannot evaluate`);
    }
  }

  operations.sort((a, b) => a.at - b.at);
  return { file, operations, unresolved };
}

/** Replay every migration in filename (timestamp) order. */
function buildSchema(files: string[]): {
  schema: Map<string, Set<string>>;
  unresolved: string[];
} {
  const schema = new Map<string, Set<string>>();
  const unresolved: string[] = [];
  for (const file of files) {
    const read = readMigration(file);
    unresolved.push(...read.unresolved.map((issue) => `${file}: ${issue}`));
    for (const operation of read.operations) {
      switch (operation.kind) {
        case 'createTable':
          if (operation.keepExisting && schema.has(operation.table)) break;
          schema.set(operation.table, new Set(operation.columns));
          break;
        case 'dropTable':
          schema.delete(operation.table);
          break;
        case 'addColumn':
          if (!schema.has(operation.table)) schema.set(operation.table, new Set());
          schema.get(operation.table)!.add(operation.column);
          break;
        case 'dropColumn':
          schema.get(operation.table)?.delete(operation.column);
          break;
        case 'renameTable': {
          const columns = schema.get(operation.table);
          if (columns) {
            schema.delete(operation.table);
            schema.set(operation.to, columns);
          }
          break;
        }
        case 'renameColumn': {
          const columns = schema.get(operation.table);
          if (columns?.delete(operation.column)) columns.add(operation.to);
          break;
        }
      }
    }
  }
  return { schema, unresolved };
}

// ---------------------------------------------------------------------------
// Entity metadata
// ---------------------------------------------------------------------------

function entityFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entityFiles(full);
    return entry.isFile() && entry.name.endsWith('.entity.ts') ? [full] : [];
  });
}

function declaredSchema(): { declared: Map<string, string[]>; unresolved: string[] } {
  for (const file of entityFiles(SRC_DIR)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require(file);
  }
  const storage = getMetadataArgsStorage();
  const naming = new DefaultNamingStrategy();
  const persisted = new Set(['regular', 'createDate', 'updateDate', 'deleteDate', 'version']);
  const declared = new Map<string, string[]>();
  const unresolved: string[] = [];
  for (const table of storage.tables) {
    if (table.type !== 'regular') continue;
    const entity = (table.target as { name?: string }).name ?? String(table.target);
    if (!table.name) {
      // Every entity here names its table. One that does not would take its
      // name from the naming strategy, which this reader does not model, so
      // it would silently escape the check below.
      unresolved.push(`@Entity ${entity} does not name its table`);
      continue;
    }
    const columns = storage.columns
      .filter((column) => column.target === table.target && persisted.has(column.mode))
      .map((column) => naming.columnName(column.propertyName, column.options.name ?? '', []));
    // A @JoinColumn on an owning relation is a real selected column even when
    // no @Column declares it.
    const joins = storage.joinColumns
      .filter((join) => join.target === table.target && join.name)
      .map((join) => join.name as string);
    declared.set(table.name, [...new Set([...columns, ...joins])]);
  }
  return { declared, unresolved };
}

// ---------------------------------------------------------------------------

describe('entity columns match the migrations that create them', () => {
  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts'))
    .sort();
  const { schema, unresolved } = buildSchema(migrationFiles);
  const { declared, unresolved: undeclared } = declaredSchema();

  it('reads every migration in the directory', () => {
    expect(migrationFiles.length).toBeGreaterThan(40);
    expect(schema.size).toBeGreaterThan(30);
  });

  it('understands every schema statement in every up() body', () => {
    // A construct this reader cannot evaluate would silently hide the columns
    // it creates, so it fails here instead of as phantom drift below.
    expect(unresolved).toEqual([]);
  });

  it('understands every entity it is asked to check', () => {
    expect(undeclared).toEqual([]);
  });

  it('creates a table for every entity', () => {
    const missing = [...declared.keys()].filter((table) => !schema.has(table));
    expect(missing).toEqual([]);
  });

  it('creates a column for every column an entity declares', () => {
    // The half of TEM-28 that broke production: TypeORM selects the column,
    // Postgres has never heard of it, every read of the table 500s.
    const drift: string[] = [];
    for (const [table, columns] of declared) {
      const created = schema.get(table);
      if (!created) continue;
      for (const column of columns) {
        if (!created.has(column)) drift.push(`${table}.${column}`);
      }
    }
    expect(drift).toEqual([]);
  });

  it('declares an entity column for every column the migrations create', () => {
    // The other half: dbs_checks.document_url and dbs_checks.metadata existed
    // in the schema with nothing declaring them, which is what made the shape
    // of the table ambiguous enough for the drift to survive review. Tables
    // with no entity at all, such as join tables, are not the subject here.
    const orphans: string[] = [];
    for (const [table, columns] of declared) {
      const created = schema.get(table);
      if (!created) continue;
      for (const column of created) {
        if (!columns.includes(column)) orphans.push(`${table}.${column}`);
      }
    }
    expect(orphans).toEqual([]);
  });
});
