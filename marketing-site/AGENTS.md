# Tumblebase marketing site

Astro + Tailwind, built from `site/` with `public-tumblebase/` assets. The inherited `src/` and `public/` trees are dormant reference material and are explicitly excluded by Astro's source/public configuration. Do not ship them, run their outreach/SEO scripts, or connect to inherited resources.

Product name and display nouns are imported from the app's brand module. Marketing colour tokens live in `site/styles/global.css` and follow TEM-12. Use British English, Tailwind, no inline styles, no em dashes and no emojis.

## Commands

- `npm ci --ignore-scripts`
- `npm run dev`
- `npm run build`
- `npm run verify:site`
- `./deploy-ftp.sh --dry-run`
- `./deploy-ftp.sh` for publishing, with dedicated Tumblebase hosting variables

Only deploy through `deploy-ftp.sh`. It builds, verifies the output, fixes local permissions, uploads via certificate-verified FTPS and sets readable remote permissions. It has no inherited targets or shared credential fallback and never deletes remote files.

## Launch inputs

`PUBLIC_APP_URL` stays unset until the application is verified live. The enquiry address defaults to `mike@tumblebase.com`, which Mike confirmed he created. Contact uses an explicit mailto link, not a form claiming to have submitted an application. `PUBLIC_MONTHLY_PRICE_GBP` stays unset until Mike confirms pricing. Do not invent discounts, testimonials, customer counts, service guarantees or legal terms.

TEM-25 owns the core site. TEM-26 owns the final founding-club offer, working application capture and authorised outreach. Neither issue is done until its required live acceptance checks pass.

The current build has five HTML pages: home, features, pricing, founding clubs and 404. It also generates a sitemap and robots file. Verify the exact inventory and all local links before publishing.
