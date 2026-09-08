import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ParseUuidListPipe, ParseUuidPipe } from './parse-uuid.pipe';

const pathParam = (name: string): ArgumentMetadata => ({
  type: 'param',
  data: name,
  metatype: String,
});

const queryParam = (name: string): ArgumentMetadata => ({
  type: 'query',
  data: name,
  metatype: String,
});

const VALID = '6b1a5f1e-6c2a-4b1f-9a4a-1f2e3d4c5b6a';

describe('ParseUuidPipe', () => {
  const pipe = new ParseUuidPipe();
  const optional = new ParseUuidPipe({ optional: true });

  it('passes a well formed UUID through unchanged', async () => {
    await expect(pipe.transform(VALID, pathParam('id'))).resolves.toBe(VALID);
  });

  it.each([
    'not-a-uuid',
    'invalid-uuid-123',
    "1' OR '1'='1",
    '../../../etc/passwd',
    `${VALID}x`,
    '',
  ])('rejects %p', async (value) => {
    await expect(pipe.transform(value, pathParam('id'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('names the parameter it rejected', async () => {
    await expect(pipe.transform('nope', pathParam('memberId'))).rejects.toThrow(
      'Invalid memberId: expected a UUID',
    );
  });

  it('does not echo the rejected value back to the caller', async () => {
    await expect(pipe.transform('<script>alert(1)</script>', pathParam('id'))).rejects.toThrow(
      /^Invalid id: expected a UUID$/,
    );
  });

  it('rejects a value that is not a string', async () => {
    await expect(pipe.transform({ toString: () => VALID }, pathParam('id'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  describe('optional', () => {
    // `?squad_id=` is how the web app says "no filter". It must stay a
    // no-op rather than becoming a 400.
    it.each([undefined, null, ''])('treats %p as absent', async (value) => {
      await expect(optional.transform(value, queryParam('squad_id'))).resolves.toBeUndefined();
    });

    it('still rejects a present but malformed value', async () => {
      await expect(optional.transform('1 OR 1=1', queryParam('squad_id'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('passes a well formed UUID through', async () => {
      await expect(optional.transform(VALID, queryParam('squad_id'))).resolves.toBe(VALID);
    });
  });
});

describe('ParseUuidListPipe', () => {
  const pipe = new ParseUuidListPipe();
  const other = '7c2b6a2f-7d3b-4c2a-8b5b-2a3f4e5d6c7b';

  it('splits a comma separated list', async () => {
    await expect(pipe.transform(`${VALID},${other}`, queryParam('member_ids'))).resolves.toEqual([
      VALID,
      other,
    ]);
  });

  it('trims surrounding whitespace and drops blank entries', async () => {
    await expect(
      pipe.transform(` ${VALID} , ,${other},`, queryParam('member_ids')),
    ).resolves.toEqual([VALID, other]);
  });

  it.each([undefined, null, ''])('yields an empty list for %p', async (value) => {
    await expect(pipe.transform(value, queryParam('member_ids'))).resolves.toEqual([]);
  });

  it('rejects the request when any entry is malformed', async () => {
    await expect(
      pipe.transform(`${VALID},not-a-uuid`, queryParam('member_ids')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
