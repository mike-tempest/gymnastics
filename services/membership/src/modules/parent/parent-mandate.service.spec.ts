import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MandatesService } from '../finance/mandates/mandates.service';
import { ParentMandateService } from './parent-mandate.service';

/**
 * Parent-scoped Direct Debit setup (TEM-22).
 *
 * The session token used to be minted in the browser and kept in
 * sessionStorage, which meant the server accepted whatever came back. These
 * tests pin the replacement: the server mints it, signs the family it belongs
 * to, and refuses a token that was issued for someone else or has expired.
 */
describe('ParentMandateService', () => {
  let service: ParentMandateService;
  let mandates: { createRedirectFlow: jest.Mock; completeRedirectFlow: jest.Mock };

  const FAMILY = 'family-1';
  const OTHER_FAMILY = 'family-2';

  beforeEach(async () => {
    mandates = {
      createRedirectFlow: jest.fn().mockImplementation((familyId, sessionToken) =>
        Promise.resolve({
          redirect_flow_id: 'RE123',
          redirect_url: 'https://pay.example/RE123',
          session_token: sessionToken,
        }),
      ),
      completeRedirectFlow: jest.fn().mockResolvedValue({ mandate_id: 'mandate-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentMandateService,
        { provide: MandatesService, useValue: mandates },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined) },
        },
      ],
    }).compile();

    service = module.get(ParentMandateService);
  });

  async function startAndTakeToken(familyId = FAMILY): Promise<string> {
    const started = await service.startSetup(familyId, 'http://localhost:3000/parent/billing');
    return started.session_token;
  }

  it('mints the session token server-side and passes it to the mandates service', async () => {
    const result = await service.startSetup(FAMILY, 'http://localhost:3000/parent/billing');

    expect(mandates.createRedirectFlow).toHaveBeenCalledWith(
      FAMILY,
      expect.stringMatching(/^v1\./),
      'http://localhost:3000/parent/billing',
    );
    expect(result.session_token).toMatch(/^v1\./);
  });

  it('gives every setup attempt a different token', async () => {
    expect(await startAndTakeToken()).not.toEqual(await startAndTakeToken());
  });

  it('does not carry the family id in the token, only a signature over it', async () => {
    expect(await startAndTakeToken()).not.toContain(FAMILY);
  });

  it('completes a flow whose token it minted for this family', async () => {
    const token = await startAndTakeToken();

    await service.completeSetup(FAMILY, 'RE123', token);

    expect(mandates.completeRedirectFlow).toHaveBeenCalledWith('RE123', token, FAMILY);
  });

  it('refuses a token minted for another family', async () => {
    const token = await startAndTakeToken(OTHER_FAMILY);

    await expect(service.completeSetup(FAMILY, 'RE123', token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mandates.completeRedirectFlow).not.toHaveBeenCalled();
  });

  it('refuses a token the client made up', async () => {
    await expect(
      service.completeSetup(FAMILY, 'RE123', 'session_1699999999_abc123'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a token whose signature has been tampered with', async () => {
    const token = await startAndTakeToken();
    const parts = token.split('.');
    const tampered = [parts[0], parts[1], parts[2], `${parts[3].slice(0, -1)}X`].join('.');

    await expect(service.completeSetup(FAMILY, 'RE123', tampered)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses a token whose expiry has been pushed out', async () => {
    const token = await startAndTakeToken();
    const parts = token.split('.');
    const extended = [parts[0], String(Number(parts[1]) + 86_400_000), parts[2], parts[3]].join(
      '.',
    );

    await expect(service.completeSetup(FAMILY, 'RE123', extended)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses an expired token', async () => {
    const token = await startAndTakeToken();
    jest.useFakeTimers().setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
    try {
      await expect(service.completeSetup(FAMILY, 'RE123', token)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('refuses a completion with no redirect flow reference', async () => {
    const token = await startAndTakeToken();

    await expect(service.completeSetup(FAMILY, '', token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
