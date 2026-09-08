import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Response } from 'express';

/**
 * Postgres `invalid_text_representation`: a value could not be parsed as the
 * column's type. In this schema that is nearly always a non-UUID id reaching
 * a `uuid` column.
 */
const INVALID_TEXT_REPRESENTATION = '22P02';

/**
 * Last line of defence for database errors that escape a controller.
 *
 * ParseUuidPipe rejects a malformed id at the edge, which is where a bad id
 * should be caught. This filter covers the cases a pipe cannot see: an id
 * that arrives inside a request body, one built up in a service, or a route
 * added later without a pipe. It maps a failed parse to 400 and replaces the
 * driver's message with our own, so a client mistake is never reported as a
 * server fault and no response describes the schema.
 *
 * Everything else stays a 500. The full error, driver text included, goes to
 * the server log where it belongs.
 */
@Catch(QueryFailedError)
export class QueryFailedErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(QueryFailedErrorFilter.name);

  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const code = (exception as QueryFailedError & { code?: string }).code;

    if (code === INVALID_TEXT_REPRESENTATION) {
      this.logger.warn(`Malformed identifier reached the database: ${exception.message}`);
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid identifier format',
        error: 'Bad Request',
      });
      return;
    }

    this.logger.error(`Database query failed: ${exception.message}`, exception.stack);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  }
}
