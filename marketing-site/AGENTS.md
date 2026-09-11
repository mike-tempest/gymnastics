# Tumblebase marketing site

Astro 7 + Tailwind, built from `site/` with `public-tumblebase/` assets. The inherited `src/` and `public/` trees are dormant reference material and are explicitly excluded by Astro's source/public configuration. Do not ship them, run their outreach/SEO scripts, or connect to inherited resources.

Product name and display nouns are imported from the app's brand module. Marketing colour tokens live in `site/styles/global.css` and follow TEM-12. Use British English, Tailwind, no inline styles, no em dashes and no emojis.

## Commands

- `npm ci --ignore-scripts`
- `npm run dev`
- `npm run build`
- `npm run verify:site`
- `./deploy-ftp.sh --dry-run`
- `./deploy-ftp.sh` for publishing, with dedicated Tumblebase hosting variables

Railway is the intended primary host, authorised by Mike on 11 September 2026. Use `marketing-site/Dockerfile` with the repository root as build context and port 8080. The final image serves only verified static output with Caddy; assets deploy with the site. Keep A2 DNS and mail records intact. Before moving the apex, verify the Railway service and confirm the DNS provider supports apex ALIAS/ANAME or CNAME flattening. For the A2 fallback, only deploy through `deploy-ftp.sh`. It builds, verifies the output, fixes local permissions, uploads via certificate-verified FTPS and sets readable remote permissions. It has no inherited targets or shared credential fallback and never deletes remote files.

## Launch inputs

`PUBLIC_APP_URL` stays unset until the application is verified live. The enquiry address defaults to `mike@tumblebase.com`, which Mike confirmed he created. Contact uses an explicit mailto link, not a form claiming to have submitted an application. `PUBLIC_MONTHLY_PRICE_GBP` stays unset until Mike confirms pricing. Do not invent discounts, testimonials, customer counts, service guarantees or legal terms.

TEM-25 owns the core site. TEM-26 owns the final founding-club offer, working application capture and authorised outreach. Neither issue is done until its required live acceptance checks pass.

The current build has five HTML pages: home, features, pricing, founding clubs and 404. It also generates a sitemap and robots file. Verify the exact inventory and all local links before publishing.

## Build runtime

Use Node 22.12 or newer (CI uses Node 22 LTS). The active site only needs Astro and Tailwind. Puppeteer, Playwright, Sharp as a direct dependency, tsx and Lucide were removed from this package because the active static build does not use them. Dormant inherited scripts are unsupported and must not be run as part of the Tumblebase workflow.
