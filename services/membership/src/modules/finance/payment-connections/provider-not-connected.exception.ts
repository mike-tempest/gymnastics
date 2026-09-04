import { BadRequestException } from '@nestjs/common';
import { PaymentConnectionStatus } from './entities/club-payment-connection.entity';

/** Why a club has no usable connection. 'none' means no row at all. */
export type NotConnectedReason = PaymentConnectionStatus | 'none';

/**
 * Raised when a club has no usable payment provider connection.
 *
 * Under connected accounts a club collects on its own provider account, so "not
 * connected" is a real, expected state (every club starts there) rather than a
 * misconfiguration. It is an exception rather than a null return so that no
 * caller can mistake it for "charge it somehow" and fall back to Swimly's own
 * credentials.
 *
 * A 400 rather than a 404: the club exists, the request is simply not valid
 * until an account is connected.
 */
export class ProviderNotConnectedException extends BadRequestException {
  constructor(
    readonly clubId: string,
    readonly reason: NotConnectedReason = 'none',
  ) {
    super(ProviderNotConnectedException.messageFor(reason));
  }

  private static messageFor(reason: NotConnectedReason): string {
    switch (reason) {
      case PaymentConnectionStatus.PENDING:
        return 'Your club has started connecting a payment provider but has not finished. Complete the setup in Settings before collecting payments.';
      case PaymentConnectionStatus.RESTRICTED:
        return "Your club's payment provider account is currently restricted and cannot collect payments. Check for outstanding requirements with your provider.";
      case PaymentConnectionStatus.DISCONNECTED:
        return "Your club's payment provider account has been disconnected. Reconnect it in Settings before collecting payments.";
      default:
        // Covers 'none' and, defensively, ACTIVE: an active row means the
        // caller looked one up and did not find it, so treat it as unconnected
        // rather than claiming a state we cannot explain.
        return 'Your club has not connected a payment provider yet. Connect one in Settings before collecting payments.';
    }
  }
}
