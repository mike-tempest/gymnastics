# Tumblebase Railway setup status

Use [DEPLOY.md](DEPLOY.md) for deployment instructions and resource inventory.

The separate Gymnastics project has membership/web, PostgreSQL and Redis services. GitHub main connections and EU West configuration are staged. Mike has registered tumblebase.com. Domain DNS, verified Resend sending, a backup decision, payment accounts and deployed checks remain tracked in TEM-16 and TEM-17.

Email uses Resend HTTPS. A dedicated `RESEND_API_KEY` and verified `EMAIL_FROM` replace the obsolete SMTP setup requirement. The incorrect key briefly supplied on 10 September was cleared from Railway, and the unverified domain added in that account was removed. No email was sent. The correct key is still pending.
