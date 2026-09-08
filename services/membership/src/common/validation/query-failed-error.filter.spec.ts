import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { QueryFailedErrorFilter } from './query-failed-error.filter';

function hostWithResponse() {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

function queryFailed(message: string, code?: string): QueryFailedError {
  const error = new QueryFailedError('SELECT 1', [], new Error(message));
  if (code) {
    (error as QueryFailedError & { code?: string }).code = code;
  }
  return error;
}

describe('QueryFailedErrorFilter', () => {
  let filter: QueryFailedErrorFilter;

  beforeEach(() => {
    filter = new QueryFailedErrorFilter();
    jest.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  });

  const RAW = 'invalid input syntax for type uuid: "not-a-uuid"';

  it('turns a failed value parse into a 400', () => {
    const { host, response } = hostWithResponse();

    filter.catch(queryFailed(RAW, '22P02'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Invalid identifier format',
      error: 'Bad Request',
    });
  });

  it('keeps the driver text out of the 400 body', () => {
    const { host, response } = hostWithResponse();

    filter.catch(queryFailed(RAW, '22P02'), host);

    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('uuid');
  });

  it('leaves any other database error a 500 with a generic body', () => {
    const { host, response } = hostWithResponse();

    filter.catch(queryFailed('relation "members" does not exist', '42P01'), host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(response.json.mock.calls[0][0])).not.toContain('members');
  });

  it('logs the full error so it is not lost', () => {
    const { host } = hostWithResponse();

    filter.catch(queryFailed(RAW, '22P02'), host);

    expect(filter['logger'].warn).toHaveBeenCalledWith(expect.stringContaining(RAW));
  });
});
