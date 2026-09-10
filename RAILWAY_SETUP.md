# Tumblebase Railway setup status

Use [DEPLOY.md](DEPLOY.md) for deployment instructions and resource inventory.

The separate Gymnastics project has membership/web, PostgreSQL and Redis services. GitHub main connections and EU West configuration are applied. The API is live on its Railway domain and its database health check passes. The web health check uses `/login`, because `/` returns a sign-in redirect; web rollout verification is in progress.

Mike has registered tumblebase.com and confirmed mail.tumblebase.com is verified in Resend. The corrected sending-only key and `Tumblebase <noreply@mail.tumblebase.com>` sender are configured in Railway. Resend accepted the authorised test to mike@tumblebase.com on 10 September; inbox receipt remains unconfirmed. Mailbox passwords are not used by this integration.

Custom app/API DNS, a backup decision, separate payment accounts and deployed hero-flow checks remain tracked in TEM-16 and TEM-17. No production demo accounts have been seeded.
