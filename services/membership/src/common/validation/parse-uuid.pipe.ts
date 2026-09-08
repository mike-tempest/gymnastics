import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  ParseUUIDPipe,
  PipeTransform,
} from '@nestjs/common';

/**
 * Shared format check. ParseUUIDPipe holds the pattern, so borrowing it keeps
 * one definition of what counts as a UUID.
 */
const uuidFormat = new ParseUUIDPipe();

async function isUuid(value: unknown, metadata: ArgumentMetadata): Promise<boolean> {
  try {
    await uuidFormat.transform(value as string, metadata);
    return true;
  } catch {
    return false;
  }
}

/** The rejected value is deliberately not echoed back to the caller. */
function rejected(metadata: ArgumentMetadata): BadRequestException {
  return new BadRequestException(`Invalid ${metadata.data ?? 'identifier'}: expected a UUID`);
}

/**
 * Rejects a route or query parameter that is not a UUID.
 *
 * Every id in this schema is a Postgres `uuid` column, so a malformed id has
 * no matching row and cannot be looked up. Left unchecked it reaches the
 * driver, which fails the statement with `invalid input syntax for type uuid`;
 * that surfaces as a 500 and writes the column type into the server log,
 * turning a caller's typo into a server fault. A bad id belongs in a 400.
 *
 * Differs from Nest's ParseUUIDPipe, which it delegates to, in two ways:
 *  - the message names the parameter, so a caller sending several ids in one
 *    request can tell which one was rejected
 *  - an empty query string counts as absent rather than malformed. `?squad_id=`
 *    is how the web app says "no squad filter" and the controllers already
 *    read it that way, so it must not start returning 400.
 */
@Injectable()
export class ParseUuidPipe implements PipeTransform<unknown, Promise<string | undefined>> {
  constructor(private readonly options: { optional?: boolean } = {}) {}

  async transform(value: unknown, metadata: ArgumentMetadata): Promise<string | undefined> {
    if (this.options.optional && (value === undefined || value === null || value === '')) {
      return undefined;
    }

    if (!(await isUuid(value, metadata))) {
      throw rejected(metadata);
    }

    return value as string;
  }
}

/**
 * Parses a comma-separated list of UUIDs, such as `?member_ids=<id>,<id>`,
 * and rejects the request if any entry is malformed.
 *
 * An absent or empty parameter yields an empty list, which is what the
 * handlers already treat as "nothing asked for". Blank entries from a trailing
 * comma are dropped rather than rejected.
 */
@Injectable()
export class ParseUuidListPipe implements PipeTransform<unknown, Promise<string[]>> {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<string[]> {
    if (value === undefined || value === null || value === '') {
      return [];
    }

    if (typeof value !== 'string') {
      throw rejected(metadata);
    }

    const ids = value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    for (const id of ids) {
      if (!(await isUuid(id, metadata))) {
        throw rejected(metadata);
      }
    }

    return ids;
  }
}

/** A required UUID path parameter. */
export const UuidParam = new ParseUuidPipe();

/** A UUID parameter that may be omitted, typically a `?filter=` query value. */
export const OptionalUuidParam = new ParseUuidPipe({ optional: true });

/** A comma-separated list of UUIDs, empty when the parameter is absent. */
export const UuidListParam = new ParseUuidListPipe();
