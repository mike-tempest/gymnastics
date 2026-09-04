# Swimly Marketing Site

The marketing site for Swimly, the operating system for British swimming clubs. Static site built with [Astro](https://astro.build) and Tailwind CSS.

## What this site is

One Astro build produces content for two live domains:

- **swimly.uk** is the UK site: homepage, features, pricing, blog, club directory, comparison pages. Everything at the root of `src/pages/` except the regional folders.
- **swimly.club** is the international site, served from subfolders: `src/pages/us/`, `src/pages/ca/` and `src/pages/au/`, plus `src/pages/international/` which becomes the swimly.club hub homepage.
- **swimly.info** exists only to 301 to swimly.club. It carries no content of its own.

The deploy script splits the single build between the two document roots (see below). Region handling, canonical URLs and hreflang clusters live in `src/config/regions.ts` and `src/layouts/Layout.astro`.

## Commands

```bash
npm run dev       # Local dev server on :4321
npm run build     # Build to dist.nosync/
./deploy-ftp.sh   # Build + fix permissions + FTP upload (the ONLY way to deploy)
```

The build directory is `dist.nosync/` (not `dist/`) because this repo lives in an iCloud-synced folder and the `.nosync` suffix stops iCloud evicting files mid-upload.

## Deploying (read this before you touch anything)

**Deploy ONLY via `./deploy-ftp.sh`. Never use raw lftp or FTP commands.** Bypassing the script has caused four full-site outages.

The reasons the script exists, and why every one of its steps matters:

1. **Permission fix.** The local system umask is 0077, so Astro's build output comes out as 600/700. LiteSpeed on the host cannot read those files and the whole site returns 403. The script chmods directories to 755 and files to 644 before upload. This is the step that, when skipped, caused the outages.
2. **`.htaccess` is overwritten on every deploy.** The script writes a slim `.htaccess` from heredocs inside the script itself (Astro would otherwise generate over 1000 redirect rules, which crashes LiteSpeed). Any redirect that is not inside the script's heredocs is silently dropped on the next deploy. If you need a redirect to survive, it goes in the heredoc in `deploy-ftp.sh`, never in a standalone file.
3. **Credentials come from the environment.** `FTP_PASS` must be set in your shell (or as a CI secret) before deploying. Never hardcode a password in the script; a previous hardcoded fallback leaked into git history.
4. **Two targets, one build.** The script mirrors the UK part of the build to the swimly.uk root and the `us/`, `ca/`, `au/` and `international/` parts to the swimly.club document root, incrementally with checksums.

`DRY_RUN=1 ./deploy-ftp.sh` prints the generated lftp scripts without uploading anything, which is the safe way to inspect what a deploy would do.

## The SEO/AEO engine

A scheduled daily agent grows the site's search and answer-engine presence, making **one PR per day**. Its playbook and its append-only work ledger live at:

- `docs/seo-aeo-engine.md` (how it works, what it may and may not touch)
- `docs/seo-aeo-ledger.md` (what has been done, decisions, follow-ups)

Rules when working near it:

- Never create a second scheduled SEO agent or duplicate its daily PR.
- Check the ledger before writing new content so topics are not duplicated, and add a ledger entry when you cover a topic yourself so the agent skips it.

## Copy rules

- **British English** on UK pages (colour, organise, programme, "term" not "semester"). US spelling only under `/us`. Commonwealth spelling under `/ca` and `/au`.
- **No em dashes.** Rewrite the sentence instead.
- **No emojis** in copy or code comments.
- **Never invent facts**: no made-up statistics, testimonials, member counts or "trusted by N clubs" claims.
- **Swim England is a file-based import, not an API.** Describe it carefully; do not imply a live API integration.
- **Never claim UK data hosting.** It is an aspiration, not a fact.
- Tailwind only; no inline styles. Lucide icons via `@lucide/astro`.
- Write for volunteer club administrators, practical and helpful, never salesy.

## Site structure

- `src/pages/` - pages (`.astro`); regional content under `us/`, `ca/`, `au/`, `international/`
- `src/components/` - shared components
- `src/layouts/` - `Layout.astro` (meta, canonical, hreflang, JSON-LD) and `BlogPost.astro`
- `src/content/blog/` - blog posts as Markdown (schema in `src/content.config.ts`)
- `src/data/` - static data (towns, clubs directories)
- `docs/` - SEO engine docs, audits, internationalisation notes

## Verification

Always run `npm run build` and check it completes cleanly before opening a PR. The build currently produces around 5,900 pages; a sudden large change in page count is a signal something broke.
