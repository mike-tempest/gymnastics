import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Purges payment provider credentials from club_settings.billing_config.
 *
 * An earlier admin settings form let a club paste its GoCardless API key and
 * Stripe publishable/secret keys into billing_config. They were stored
 * unencrypted in JSONB and returned to the browser on every settings read, and
 * no backend code ever read them. Clubs now connect their own provider account
 * instead, so Swimly never holds a club's credentials at all.
 *
 * ClubSettingsService also strips these keys on write, so this only has to
 * clear what is already stored.
 *
 * Irreversible by design: down() is a no-op because restoring leaked
 * credentials is not a desirable rollback. Any club that had pasted a key
 * should rotate it at the provider.
 */
export class StripBillingConfigKeys1744202600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const result: { count: string }[] = await queryRunner.query(`
      SELECT count(*)::text AS count
      FROM club_settings
      WHERE billing_config ?| array['goCardlessKey', 'stripePublishableKey', 'stripeSecretKey']
    `);
    const affected = Number(result?.[0]?.count ?? 0);

    await queryRunner.query(`
      UPDATE club_settings
      SET billing_config = billing_config - 'goCardlessKey'
                                          - 'stripePublishableKey'
                                          - 'stripeSecretKey'
      WHERE billing_config ?| array['goCardlessKey', 'stripePublishableKey', 'stripeSecretKey']
    `);

    if (affected > 0) {
      // Surfaced loudly: these credentials were stored in plaintext, so the
      // clubs concerned should rotate them at the provider.
      console.warn(
        `[StripBillingConfigKeys] Purged provider credentials from ${affected} club_settings row(s). ` +
          `Those clubs should rotate the affected keys at their provider.`,
      );
    }
  }

  public async down(): Promise<void> {
    // Intentionally empty. The purged values were plaintext credentials that
    // should never have been stored; recreating them is not a valid rollback.
  }
}
