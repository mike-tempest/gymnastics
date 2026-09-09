# CLAUDE.md - Swimly Marketing Site

## Project Overview

Marketing site for Swimly (swimly.uk). Static site built with Astro, styled with Tailwind CSS.

## Tech Stack

- **Framework:** Astro (static site generator)
- **Styling:** Tailwind CSS (via @tailwindcss/vite plugin)
- **Icons:** @lucide/astro
- **Images:** sharp for optimisation
- **Testing:** Playwright

## Commands

```bash
# Development
npm run dev           # Local dev server

# Build
npm run build         # Build to dist/

# Deploy (CRITICAL - read below)
./deploy-ftp.sh       # Build + fix permissions + FTP upload
```

## Deployment -- HARD RULE

**ONLY deploy via `./deploy-ftp.sh`.** Never use raw lftp or FTP commands.

The system umask is 0077, which means Astro's build output gets 600/700 permissions. LiteSpeed cannot read these files, causing 403 Forbidden across the entire site. The deploy script runs `chmod 755` on directories and `chmod 644` on files before uploading. This has caused four outages when bypassed.

## Site Structure

- `src/pages/` -- Astro pages (.astro files)
- `src/components/` -- Reusable components
- `src/layouts/` -- Page layouts
- `src/content/` -- Content collections (blog posts as .md)
- `src/data/` -- Static data files (towns, clubs, etc.)
- `src/styles/` -- Global styles

## Key Pages

- `/` -- Homepage
- `/features/` -- Feature pages (membership, billing, attendance)
- `/pricing/` -- Pricing
- `/pilot/` -- Pilot programme landing page
- `/founding-clubs/` -- Founding club application
- `/blog/` -- Blog posts
- `/clubs/` -- Club directory (programmatic SEO, towns + counties)
- `/compare/` -- Competitor comparison pages
- `/swim-club-management-software/` -- Primary SEO landing page

## SEO

- Sitemaps auto-generated: `sitemap-core.xml.ts`, `sitemap-blog.xml.ts`, `sitemap-clubs.xml.ts`, `sitemap-towns.xml.ts`
- Sitemap index at `sitemap-index.xml.ts`
- Site config: `site: 'https://swimly.uk'`, `trailingSlash: 'always'`
- All pages need proper meta titles, descriptions, and canonical URLs
- Schema markup (JSON-LD) on key pages: SoftwareApplication, FAQPage, Organization

### IndexNow (Bing, Yandex, Seznam, Naver)

- Key file lives in `public/` as `<key>.txt` and must contain exactly the key. It deploys
  with the site, so the key is live at `https://swimly.uk/<key>.txt`. Keep exactly one.
- Submit with `node scripts/indexnow-submit.mjs`. It verifies the key file is live before
  posting, so a submission cannot silently fail with a 403.
- Default run submits only URLs whose sitemap `lastmod` is on or after the last recorded
  run (`scripts/indexnow-state.json`). Use `--all` for the first submission only.
- Submit when pages are added, updated or removed. Resubmitting the whole site on a
  schedule is what the protocol asks you not to do.
- Google does not use IndexNow. Keep using `scripts/gsc-submit.js` for Google.

## Code Style

- **British English** in all copy -- colour, organise, centre, programme
- **UK terminology** -- "term" not "semester", "club" not "team", "swimming" not "swim" where natural
- **No em dashes** -- rewrite instead
- **No emojis**
- **No inline styles** -- Tailwind only
- Lucide icons via `@lucide/astro`

## Content Guidelines

- Write for volunteer club administrators (not tech people)
- Practical, helpful tone -- not salesy
- All pricing in GBP
- Reference UK swimming governance (Swim England, county associations)

## Build Verification

- Always run a full build (`npm run build`) and verify page count before deploying
- Current page count: ~2,255 pages
- Check that new pages return 200 after deploy

## Git

- Commit and push all changes when work is complete
