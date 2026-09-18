import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { RawBodyRequest, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import { EmailService } from '../email/email.service';
import { NotificationDeliveriesService } from './notification-deliveries.service';
import { assertDeliveryAccess } from './notification-deliveries.controller';
import { ResendEventsController } from './resend-events.controller';

it.each(['parent', 'treasurer', 'welfare_officer', 'competition_secretary'])(
  'denies delivery details and actions to %s',
  (role) => {
    expect(() => assertDeliveryAccess({ user_id: 'one', role }, 'broadcast')).toThrow();
    expect(() => assertDeliveryAccess({ user_id: 'one', role }, 'session_cancellation')).toThrow();
  },
);
it('only permits squad coaches to manage cancellation delivery', () => {
  expect(() =>
    assertDeliveryAccess({ user_id: 'one', role: 'squad_coach' }, 'broadcast'),
  ).toThrow();
  expect(() =>
    assertDeliveryAccess({ user_id: 'one', role: 'squad_coach' }, 'session_cancellation'),
  ).not.toThrow();
});
it('scopes delivery reads and writes to the authenticated club', async () => {
  const query = jest.fn().mockResolvedValue([]);
  const service = new NotificationDeliveriesService(
    { query } as unknown as DataSource,
    {} as EmailService,
    { getClubId: () => 'club-A' } as TenantContextService,
  );
  await service.list('broadcast', 'source-B');
  expect(query).toHaveBeenCalledWith(expect.stringContaining('club_id=$1'), [
    'club-A',
    'broadcast',
    'source-B',
    0,
  ]);
  await expect(service.retry('delivery-B')).rejects.toThrow('Notification not found');
  await expect(service.followUp('delivery-B', 'Called', 'user-A')).rejects.toThrow(
    'Notification not found',
  );
  expect(query).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.anything());
});
describe('verified delivery evidence', () => {
  const secret = Buffer.from('test-only-webhook-key').toString('base64');
  const recordProviderEvent = jest.fn();
  const config = { get: () => `whsec_${secret}` } as unknown as ConfigService;
  const controller = new ResendEventsController(config, {
    recordProviderEvent,
  } as unknown as NotificationDeliveriesService);
  function request(type = 'email.delivered', timestamp = Math.floor(Date.now() / 1000).toString()) {
    const payload = JSON.stringify({ type, data: { email_id: 'provider-one' } });
    const id = 'event-one';
    const signature = createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(`${id}.${timestamp}.${payload}`)
      .digest('base64');
    return {
      rawBody: Buffer.from(payload),
      headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` },
    } as unknown as RawBodyRequest<Request>;
  }
  beforeEach(() => recordProviderEvent.mockReset());
  it('accepts signed raw bytes and records delivery evidence', async () => {
    await controller.receive(request());
    expect(recordProviderEvent).toHaveBeenCalledWith('provider-one', 'delivered');
  });
  it('rejects altered bodies, invalid signatures and expired signatures', async () => {
    const altered = request();
    altered.rawBody = Buffer.from('{}');
    await expect(controller.receive(altered)).rejects.toThrow(UnauthorizedException);
    await expect(controller.receive(request('email.delivered', '1'))).rejects.toThrow(
      UnauthorizedException,
    );
    expect(recordProviderEvent).not.toHaveBeenCalled();
  });
  it('ignores acceptance events and persists suppression and failures distinctly', async () => {
    await controller.receive(request('email.sent'));
    expect(recordProviderEvent).not.toHaveBeenCalled();
    await controller.receive(request('email.suppressed'));
    expect(recordProviderEvent).toHaveBeenLastCalledWith('provider-one', 'suppressed');
    await controller.receive(request('email.bounced'));
    expect(recordProviderEvent).toHaveBeenLastCalledWith('provider-one', 'failed');
  });
  it('returns a failure if persistence fails so the provider retries', async () => {
    recordProviderEvent.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(controller.receive(request())).rejects.toThrow('database unavailable');
  });
});
