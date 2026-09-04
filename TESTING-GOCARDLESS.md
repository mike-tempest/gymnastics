# Testing GoCardless Integration (Sandbox)

This guide covers how to test the GoCardless Direct Debit integration for Swimly
using the GoCardless sandbox environment.

## 1. Prerequisites

- A GoCardless sandbox account:
  [Sign up here](https://manage-sandbox.gocardless.com/signup)
- Node.js 18+ and pnpm installed
- The Swimly membership service running locally or in Docker
- (Optional) [ngrok](https://ngrok.com/) for webhook testing

## 2. Setting Up Sandbox Credentials

1. Log in to the [GoCardless sandbox dashboard](https://manage-sandbox.gocardless.com).
2. Navigate to **Settings > Developers > Create > Access Token**.
3. Copy the access token (it starts with `sandbox_`).
4. Create a webhook endpoint secret under **Settings > Developers > Webhooks**.

Add these to your `.env` file in the project root:

```env
GOCARDLESS_ACCESS_TOKEN=sandbox_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOCARDLESS_ENVIRONMENT=sandbox
GOCARDLESS_WEBHOOK_SECRET=your_webhook_secret_here
```

These variables are picked up by both the membership service and the test script.

## 3. Running the Test Script

The standalone test script exercises the GoCardless API directly, without going
through NestJS. It is useful for verifying your credentials and understanding
the flow.

```bash
# From the project root
cd services/membership
npx ts-node ../../scripts/test-gocardless-sandbox.ts
```

Or with environment variables inline:

```bash
GOCARDLESS_ACCESS_TOKEN=sandbox_xxx npx ts-node scripts/test-gocardless-sandbox.ts
```

The script will:

1. Create a test customer
2. Create a redirect flow (prints the URL for browser-based mandate setup)
3. Check for existing active mandates
4. Create a test payment if a mandate is available
5. Demonstrate webhook signature verification

## 4. Manual API Testing with curl

### 4.1 Create a Redirect Flow (Mandate Setup)

```bash
curl -X POST http://localhost:3001/api/mandates/redirect-flow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "family_id": "FAMILY_UUID",
    "session_token": "unique-session-token-123",
    "success_redirect_url": "http://localhost:3000/mandate-complete"
  }'
```

This returns a `redirect_url`. Open it in a browser to complete the mandate setup.

### 4.2 Complete a Redirect Flow

After the user completes the mandate authorisation in the browser, call:

```bash
curl -X POST http://localhost:3001/api/mandates/redirect-flow/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "redirect_flow_id": "RE00XXXX",
    "session_token": "unique-session-token-123",
    "family_id": "FAMILY_UUID"
  }'
```

### 4.3 Collect a Payment

```bash
curl -X POST http://localhost:3001/api/payments/collect-direct-debit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "invoice_id": "INVOICE_UUID"
  }'
```

### 4.4 List Mandates for a Family

```bash
curl http://localhost:3001/api/mandates?family_id=FAMILY_UUID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 5. Webhook Testing with ngrok

GoCardless sends webhook events to notify your application about mandate and
payment status changes. In local development, use ngrok to expose your local
server.

### 5.1 Install and Start ngrok

```bash
# Install ngrok (if not already installed)
brew install ngrok   # macOS
# or download from https://ngrok.com/download

# Start a tunnel to your membership service
ngrok http 3001
```

ngrok will give you a public URL like `https://abcd1234.ngrok.io`.

### 5.2 Configure the Webhook in GoCardless

1. Go to the [sandbox dashboard](https://manage-sandbox.gocardless.com).
2. Navigate to **Settings > Developers > Webhooks > Create**.
3. Set the URL to: `https://abcd1234.ngrok.io/api/gocardless/webhooks`
4. Copy the webhook secret and add it to your `.env` as `GOCARDLESS_WEBHOOK_SECRET`.
5. Restart the membership service to pick up the new secret.

### 5.3 Test Webhook Delivery

You can trigger sandbox events from the GoCardless dashboard or by using the
sandbox helper APIs (see section 8).

## 6. Sandbox Flow Step by Step

Here is the full flow from mandate setup to payment collection:

1. **Create redirect flow** - Your app calls the GoCardless API to get a
   redirect URL for the customer.
2. **Customer authorises** - The customer visits the redirect URL, enters their
   bank details, and authorises the Direct Debit mandate.
3. **Complete redirect flow** - Your app completes the flow, which returns the
   mandate and customer IDs. A mandate record is created in the database.
4. **Mandate becomes active** - GoCardless processes the mandate. In sandbox
   this usually takes a few seconds, but may take up to a minute. A webhook
   event (`mandates.active`) is sent.
5. **Create payment** - Your app creates a payment against the active mandate.
6. **Payment is processed** - GoCardless processes the payment. Webhook events
   are sent as the payment moves through statuses: `submitted`, `confirmed`,
   and finally `paid_out`.
7. **Invoice updated** - The webhook handler updates the payment status in the
   database and marks the associated invoice as paid.

## 7. Sandbox-Specific Gotchas

- **Mandate activation delay**: After completing a redirect flow, the mandate
  may take a few seconds to become active. If you try to create a payment
  immediately, it might fail. Add a short delay or poll for the mandate status.

- **Payment charge dates**: Sandbox payments use accelerated timelines, but the
  `charge_date` may still be set to a future date. The payment will be
  processed much faster than in production.

- **Test bank details**: When completing the redirect flow in the browser, use
  the sandbox test bank details provided by GoCardless (sort code `200000`,
  account number `55779911`).

- **Webhook retries**: If your webhook endpoint is down, GoCardless retries
  with exponential backoff. In sandbox, the retry intervals are shorter than
  in production.

- **No real money**: Sandbox never moves real money. All transactions are
  simulated.

- **Rate limits**: The sandbox has lower rate limits than production. Avoid
  rapid-fire API calls in test scripts.

## 8. GoCardless Sandbox Helper APIs

GoCardless provides helper endpoints for simulating events in the sandbox.
These are not available in the live environment.

### Trigger a Payment Event

```bash
curl -X POST https://api-sandbox.gocardless.com/payments/PM_XXXX/actions/confirm \
  -H "Authorization: Bearer sandbox_xxxx" \
  -H "Content-Type: application/json"
```

### Trigger a Mandate Event

```bash
curl -X POST https://api-sandbox.gocardless.com/mandates/MD_XXXX/actions/activate \
  -H "Authorization: Bearer sandbox_xxxx" \
  -H "Content-Type: application/json"
```

### Available Sandbox Actions

| Resource   | Action      | Description                          |
| ---------- | ----------- | ------------------------------------ |
| Mandates   | `activate`  | Moves mandate to active status       |
| Mandates   | `fail`      | Moves mandate to failed status       |
| Payments   | `confirm`   | Confirms a pending payment           |
| Payments   | `fail`      | Fails a pending payment              |
| Payments   | `pay_out`   | Marks a confirmed payment as paid out |

For full details, see the
[GoCardless sandbox documentation](https://developer.gocardless.com/getting-started/developer-tools/testing/).

## 9. Inspecting Webhook Events in the Dashboard

1. Log in to the [sandbox dashboard](https://manage-sandbox.gocardless.com).
2. Navigate to **Settings > Developers > Webhooks**.
3. Click on your webhook endpoint.
4. You will see a list of recent webhook deliveries, including:
   - The event type and action
   - The HTTP status code returned by your endpoint
   - The request and response bodies
   - Whether the delivery was successful or will be retried

This is invaluable for debugging webhook issues. If a delivery failed, you can
click "Retry" to resend it.
