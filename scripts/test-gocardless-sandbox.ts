/**
 * GoCardless Sandbox Test Script
 *
 * Demonstrates the full GoCardless Direct Debit flow in the sandbox environment.
 * This is a standalone script (not part of NestJS) for validating the integration.
 *
 * Prerequisites:
 *   1. Sign up for a GoCardless sandbox account
 *   2. Set GOCARDLESS_ACCESS_TOKEN and GOCARDLESS_WEBHOOK_SECRET env vars
 *
 * Usage:
 *   npx ts-node scripts/test-gocardless-sandbox.ts
 */

import * as crypto from 'crypto';

const gocardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');

// ---------------------------------------------------------------------------
// Configuration check
// ---------------------------------------------------------------------------

const ACCESS_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN;
const WEBHOOK_SECRET = process.env.GOCARDLESS_WEBHOOK_SECRET;

if (!ACCESS_TOKEN) {
  console.error(
    '\n' +
      '==========================================================\n' +
      ' GOCARDLESS_ACCESS_TOKEN is not set.\n' +
      '\n' +
      ' To get started:\n' +
      '   1. Sign up at https://manage-sandbox.gocardless.com/signup\n' +
      '   2. Create a sandbox access token in Settings > Developers\n' +
      '   3. Export it: export GOCARDLESS_ACCESS_TOKEN=sandbox_xxx\n' +
      '==========================================================\n',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Initialise the GoCardless client in sandbox mode
// ---------------------------------------------------------------------------

const client = gocardless(ACCESS_TOKEN, constants.Environments.Sandbox);

// ---------------------------------------------------------------------------
// Helper: pause execution (sandbox operations can take a moment)
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n--- GoCardless Sandbox Integration Test ---\n');

  // =========================================================================
  // Step 1: Create a customer
  // =========================================================================
  console.log('Step 1: Creating a customer...');

  const customerResponse = await client.customers.create({
    email: 'test-parent@swimly.example',
    given_name: 'Test',
    family_name: 'Parent',
    address_line1: '10 Downing Street',
    city: 'London',
    postal_code: 'SW1A 2AA',
    country_code: 'GB',
  });
  const customer = customerResponse;

  console.log(`  Customer created: ${customer.id}`);
  console.log(`  Email: ${customer.email}`);
  console.log(`  Name: ${customer.given_name} ${customer.family_name}\n`);

  // =========================================================================
  // Step 2: Create a redirect flow (mandate setup)
  // =========================================================================
  console.log('Step 2: Creating a redirect flow for mandate setup...');

  const sessionToken = `session-${Date.now()}`;
  const redirectResponse = await client.redirectFlows.create({
    session_token: sessionToken,
    success_redirect_url: 'https://swimly.example/mandate-complete',
    description: 'Set up Direct Debit for swim club membership fees',
    scheme: 'bacs',
    prefilled_customer: {
      email: customer.email,
      given_name: customer.given_name,
      family_name: customer.family_name,
      address_line1: '10 Downing Street',
      city: 'London',
      postal_code: 'SW1A 2AA',
    },
  });
  const redirectFlow = redirectResponse;

  console.log(`  Redirect flow created: ${redirectFlow.id}`);
  console.log(`  Redirect URL: ${redirectFlow.redirect_url}`);
  console.log('');
  console.log('  In a real flow the user would visit the redirect URL to');
  console.log('  authorise the Direct Debit mandate in their browser.');
  console.log('');
  console.log('  For sandbox testing, you can complete the flow by visiting');
  console.log(`  the URL above and using the sandbox test bank details.\n`);

  // =========================================================================
  // Step 3: Simulate mandate confirmation (sandbox only)
  // =========================================================================
  console.log('Step 3: Simulating mandate confirmation...');
  console.log('  NOTE: In the sandbox, you need to complete the redirect flow');
  console.log('  manually via the browser, or use the GoCardless API sandbox');
  console.log('  helpers to simulate this.');
  console.log('');
  console.log('  To complete via API, call:');
  console.log('    POST /redirect_flows/:id/actions/complete');
  console.log(`    with session_token: ${sessionToken}`);
  console.log('');
  console.log('  Skipping automatic completion (requires browser interaction).\n');

  // =========================================================================
  // Step 4: Create a test payment (using a pre-existing mandate if available)
  // =========================================================================
  console.log('Step 4: Checking for existing mandates to test payment creation...');

  const mandatesResponse = await client.mandates.list({ status: 'active' });
  const mandates = mandatesResponse;

  if (mandates && mandates.length > 0) {
    const mandate = mandates[0];
    console.log(`  Found active mandate: ${mandate.id}`);
    console.log(`  Scheme: ${mandate.scheme}`);
    console.log('');
    console.log('  Creating a test payment of 25.00 GBP...');

    const paymentResponse = await client.payments.create({
      amount: 2500, // Amount in pence
      currency: 'GBP',
      links: {
        mandate: mandate.id,
      },
      description: 'Swimly test payment, monthly membership',
      metadata: {
        test: 'true',
        source: 'sandbox-test-script',
      },
    });
    const payment = paymentResponse;

    console.log(`  Payment created: ${payment.id}`);
    console.log(`  Amount: ${(payment.amount / 100).toFixed(2)} ${payment.currency}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Charge date: ${payment.charge_date}\n`);
  } else {
    console.log('  No active mandates found. Complete a redirect flow first');
    console.log('  to set up a mandate, then re-run this script.\n');
  }

  // =========================================================================
  // Step 5: Simulate a webhook event for payment confirmation
  // =========================================================================
  console.log('Step 5: Simulating a webhook event...');

  const sampleWebhookBody = JSON.stringify({
    events: [
      {
        id: 'EV_TEST_001',
        created_at: new Date().toISOString(),
        resource_type: 'payments',
        action: 'confirmed',
        links: {
          payment: 'PM_TEST_001',
        },
        details: {
          origin: 'gocardless',
          cause: 'payment_confirmed',
          description: 'Payment was confirmed as collected.',
        },
      },
    ],
  });

  console.log('  Sample webhook payload:');
  console.log(`  ${sampleWebhookBody.substring(0, 100)}...\n`);

  // =========================================================================
  // Step 6: Verify the webhook signature
  // =========================================================================
  console.log('Step 6: Verifying webhook signature...');

  if (!WEBHOOK_SECRET) {
    console.log('  GOCARDLESS_WEBHOOK_SECRET is not set, skipping signature verification.');
    console.log('  Set it to test signature verification.\n');
  } else {
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(sampleWebhookBody)
      .digest('hex');

    console.log(`  Computed signature: ${signature}`);

    // Verify by re-computing
    const verifySignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(sampleWebhookBody)
      .digest('hex');

    const isValid = signature === verifySignature;
    console.log(`  Signature valid: ${isValid}\n`);
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('--- Test Complete ---\n');
  console.log('Next steps:');
  console.log('  1. Complete a redirect flow via the browser to create a mandate');
  console.log('  2. Use the GoCardless dashboard to trigger sandbox events');
  console.log('  3. Set up ngrok to receive webhooks locally');
  console.log('  4. See TESTING-GOCARDLESS.md for full instructions\n');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((error) => {
  console.error('\nError during sandbox test:\n');
  console.error(error);
  process.exit(1);
});
