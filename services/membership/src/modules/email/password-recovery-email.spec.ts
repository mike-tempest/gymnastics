import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { BRAND } from '../../common/brand';

const send = jest.fn();
jest.mock('resend', () => ({
  Resend: jest
    .fn()
    .mockImplementation(() => ({ emails: { send: (...args: unknown[]) => send(...args) } })),
}));

describe('Password recovery email delivery', () => {
  beforeEach(() => send.mockReset());
  it('fails explicitly when email is not configured', async () => {
    const service = new EmailService(new ConfigService());
    await expect(
      service.sendPasswordRecovery(
        'parent@example.com',
        'https://tumblebase.example/reset-password#token',
      ),
    ).rejects.toThrow('not configured');
    expect(send).not.toHaveBeenCalled();
  });
  it('sends a transactional message with expiry and ignore instructions', async () => {
    send.mockResolvedValue({ data: { id: 'sent' }, error: null });
    const service = new EmailService(
      new ConfigService({ RESEND_API_KEY: 're_test', EMAIL_FROM: 'Tumblebase <test@example.com>' }),
    );
    await service.sendPasswordRecovery(
      'parent@example.com',
      'https://tumblebase.example/reset-password#token',
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'parent@example.com',
        subject: `Reset your ${BRAND.name} password`,
        text: expect.stringContaining('within 30 minutes'),
      }),
    );
    expect(send.mock.calls[0][0].text).toContain('If you did not request this');
  });
  it('reports provider failure without including a potentially sensitive provider response', async () => {
    send.mockResolvedValue({ error: { message: 'secret recovery payload' } });
    const service = new EmailService(new ConfigService({ RESEND_API_KEY: 're_test' }));
    await expect(
      service.sendPasswordRecovery(
        'parent@example.com',
        'https://tumblebase.example/reset-password#token',
      ),
    ).rejects.toThrow('Password recovery email delivery failed');
  });
});
