import { Global, Injectable, Logger, Module } from '@nestjs/common';

/** Called when a squad may have gained a free place. */
export type SquadCapacityHandler = (squadId: string) => Promise<void>;

/**
 * A one-signal, in-process bus: "this squad may now have a free place".
 *
 * The waiting list needs to know when a place opens, and the places open in
 * the squads and members modules. Wiring those modules to the waiting list
 * directly would be circular, because enrolment reaches back into both of
 * them. This tiny bus breaks the cycle without pulling in an event library:
 * publishers depend on it, the waiting list subscribes to it, and neither
 * knows about the other.
 *
 * The signal is advisory and idempotent. It says a place *may* have opened,
 * never that one definitely has, so a subscriber always re-checks capacity
 * for itself. A handler that throws is logged and swallowed: freeing a place
 * must never fail the operation that freed it.
 *
 * Handlers run inside the caller's request and therefore inside its CLS tenant
 * scope, which is what keeps the subscriber's club-scoped queries correct.
 */
@Injectable()
export class SquadCapacityEvents {
  private readonly logger = new Logger(SquadCapacityEvents.name);
  private readonly handlers: SquadCapacityHandler[] = [];

  onPlaceMayHaveOpened(handler: SquadCapacityHandler): void {
    this.handlers.push(handler);
  }

  async emitPlaceMayHaveOpened(squadId: string | null | undefined): Promise<void> {
    if (!squadId) return;
    for (const handler of this.handlers) {
      try {
        await handler(squadId);
      } catch (error) {
        this.logger.error(
          `A squad capacity handler failed for squad ${squadId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}

/**
 * Global so publishers can inject the bus without every module having to
 * import a capacity module, exactly as TenantModule provides the tenant
 * context.
 */
@Global()
@Module({
  providers: [SquadCapacityEvents],
  exports: [SquadCapacityEvents],
})
export class SquadCapacityModule {}
