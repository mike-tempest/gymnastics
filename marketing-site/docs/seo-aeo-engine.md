# Swimly SEO/AEO Engine - Operating Playbook

This is the operating manual for the daily scheduled agent that grows Swimly's
organic search (SEO) and answer-engine (AEO) presence across all of its regional
sites. It is the brain of the job: the scheduled routine simply reads this file
and the ledger, then executes ONE focused unit of work to the standard described
here.

## Regions (this engine is region-aware)

Swimly now runs four regional sites from one Astro build, and a task may target
any of them, not just the UK:

- **United Kingdom** on swimly.uk (root). The established site with the deepest
  coverage; still the default and the highest-equity property.
- **United States** on swimly.club under `/us`.
- **Canada** on swimly.club under `/ca`.
- **Australia** on swimly.club under `/au`.

The single source of truth for each region (host, currency, governing body,
spelling, contact email) is `src/config/regions.ts`. Read it before working on a
regional page, and see `docs/internationalisation.md` for the domain strategy,
URL model, and hreflang and canonical rules. The UK still has by far the most
content, so most days remain UK work; the US, Canada and Australia are newer and
thinner, so a genuine gap there is often the highest-value task available. When
you target a non-UK region, write to that region's spelling and governing body
(see hard rule 3 and the spelling table below).

## Mission

Compound, do not churn. Each run makes one small, genuinely useful, fully reviewed
improvement to one of the marketing sites. Over weeks this builds a deep,
authoritative, answer-ready presence for swimming-club management queries in each
market Swimly serves. Quality always beats volume. A polished refresh or a fixed
technical issue is worth more than a thin new post.

## How this runs

- A scheduled cloud agent triggers this playbook once per day.
- The agent reads this file plus `seo-aeo-ledger.md`, picks the day's task (UK or
  an international region), does the work, verifies the build, opens a pull
  request, and logs the run.
- Output is always a pull request for human review, on every region. Nothing this
  job does goes live automatically, ever. The engine never deploys; a human
  reviews and runs `deploy-ftp.sh` after merge.
- Every Git and GitHub call uses the `mike-tempest` token (hard rule 9). This is
  unchanged for international work: the repository is the same private repo
  regardless of which region a page targets.

## Hard rules (never violate)

1. **Never deploy.** Do not run `deploy-ftp.sh`, `lftp`, or any FTP or deploy
   command. The site goes live only when a human runs `deploy-ftp.sh` after merging.
   Bypassing the deploy script has caused four 403 outages.
2. **Stay inside `marketing-site/`.** Never touch the database, the app, or backend
   services. The only file you may edit outside `marketing-site/` is nothing; the
   ledger lives at `marketing-site/docs/seo-aeo-ledger.md`.
3. **House style, always, in the region's spelling.** No em dashes, rewrite the
   sentence. No emojis. Tailwind only for any `.astro` change, never inline
   styles. Spelling follows the page's region:
   - **United States (`/us`): American spelling** (color, organize, center,
     program, traveling) and US terminology (team, season, fees).
   - **United Kingdom (root), Canada (`/ca`), Australia (`/au`):
     Commonwealth/British spelling** (colour, organise, centre, programme).
   Match the region's governing body and terminology too (Swim England and
   "gala" for the UK; USA Swimming for the US; Swimming Canada for Canada;
   Swimming Australia for Australia). The `spelling` field on each region in
   `src/config/regions.ts` (`'us'` for the US, `'gb'` for the rest) is the
   source of truth; do not mix spellings within a page.
4. **Never invent facts, in any region.** Swimly is an early-stage product. Do
   not fabricate statistics, member counts, testimonials, case studies, client
   names, awards, or "trusted by N clubs" claims, for the UK or for the US,
   Canada or Australia. Use real geography only (real towns, states, provinces,
   regions) and never invent specific clubs, leagues, or venues in any market.
   State only what is verifiable. When you cite an external fact (a governing
   body's rules, official statistics, governance dates), link the source.
5. **Governance accuracy is non-negotiable, per region.** Facts about each
   region's governing body and compliance regime must be correct: Swim England,
   Wavepower, the Club Health Tracker, county associations, DBS and UK GDPR for
   the UK; USA Swimming (and its Safe Sport requirements) for the US; Swimming
   Canada for Canada; Swimming Australia for Australia. Do not transplant UK
   specifics (Wavepower, DBS, Swim England) onto an international page, and do not
   assert a foreign regime you have not verified. If you are not certain, verify
   with a primary source or do not assert it.
6. **One focused change per run.** Keep the pull request small and reviewable. Never
   mass-edit or run site-wide find-and-replace.
7. **Do not regenerate programmatic pages.** Leave the clubs and towns generators
   (`src/data/`, the `clubs`/`towns` page routes, their sitemaps) alone unless a run
   is explicitly scoped to them. They produce thousands of pages. One scoped
   exception: an international directory-growth run (see "The international club
   finder" below) may APPEND verified entries to `src/data/us-clubs.json`,
   `ca-clubs.json` or `au-clubs.json`. It must never edit the directory page
   templates themselves, rename an existing slug, or touch the UK `clubs.json`.
8. **Match what exists.** Before writing, read one or two existing posts so voice,
   structure, and frontmatter match the house pattern.
9. **Use the `mike-tempest` token for every Git and GitHub call.** This repository's
   remote is private under the personal account `mike-tempest`; the work account
   cannot access it, and the active `gh` account drifts back to the work account
   unpredictably, even between calls in one command. Do not rely on `gh auth switch`.
   Pin the token once at the start of the run and use it for every Git and GitHub
   operation (pull, push, PR):

   ```bash
   TKN=$(gh auth token -u mike-tempest)
   # GitHub CLI:
   GH_TOKEN="$TKN" gh pr create ...
   # Git over HTTPS (pull and push) via the token, not the active account:
   git pull --ff-only "https://x-access-token:$TKN@github.com/mike-tempest/swim-team.git" main
   git push "https://x-access-token:$TKN@github.com/mike-tempest/swim-team.git" HEAD:<branch>
   ```

   Never print the token. If `gh auth token -u mike-tempest` returns nothing, do not
   push as another account: commit locally only and say so in the run report.

## Brand and audience (keep every word on-brand)

- Tagline: "The operating system for British swimming clubs."
- Audience: volunteer committee members. Treasurers, membership secretaries, coaches,
  head coaches. Write for a busy non-technical volunteer, not for developers.
- Tone: practical, empathetic, confident, never salesy. Acknowledge volunteer
  workload and committee handover reality.
- Positioning pillars: built for Swim England affiliation and Wavepower compliance,
  Direct Debit by default (GoCardless), transparent flat pricing, UK data hosting,
  built by people who run clubs.
- Author: use `Swimly Team` for neutral guides. Use `Mike Tempest` only for genuine
  first-person or opinion pieces.

## The daily rotation (rotating mix)

Pick the day's focus from the weekday below (UK time). If the slot has no worthwhile
work today, fall back to the next most valuable item from the ledger backlog. Never
manufacture filler. A small genuine improvement beats a padded new post.

Each slot can target the UK or an international region. The rotation describes the
type of work; the region is whichever has the highest-value genuine gap that day.
The international backlog lives in `seo-aeo-ledger.md` under "International
(US/CA/AU)". The UK is deepest, so it will dominate, but a real US, Canada or
Australia gap (for example a region's governing-body answer page that does not yet
exist) often outranks a marginal UK refresh. When you pick a non-UK task, apply
that region's spelling and governing body (hard rules 3 and 5).

- **Monday - New content (operator focus).** A new guide for committee admin: a
  genuine keyword or question gap aimed at treasurers, secretaries, chairs, coaches.
- **Tuesday - Refresh and expand.** Pick one older or thinner post. Update facts and
  dates, deepen weak sections, add `faqItems`, add internal links, set `updatedDate`.
- **Wednesday - New content (parent focus) or AEO answer page.** A parent-facing
  guide, or a crisp question-led answer page built for answer engines.
- **Thursday - Internal linking.** Strengthen links among recent posts and to money
  pages (features, pricing, compare). Find and fix orphan posts (no inbound links).
- **Friday - Technical SEO.** Audit for missing or overlong meta descriptions,
  duplicate titles, missing alt text, broken internal links, canonical issues. Fix
  what is safe and small. Log anything larger to the backlog.
- **Saturday - AEO upkeep.** Keep `public/llms.txt` in sync with current features and
  pricing. Add or sharpen `faqItems` and definitional answers on high-value pages.
  Add comparison tables where a "X vs Y" or "best X for Y" intent exists.
- **Sunday - Research and backlog grooming.** No publishing required. Mine real
  search and answer-engine questions swim-club volunteers ask, validate them
  against existing coverage, and log fresh target queries to the ledger backlog.
  Cover the international markets too: keep the "International (US/CA/AU)" backlog
  stocked with validated US, Canada and Australia queries (governing-body answer
  pages, region pricing and comparison intent, regional blog ideas), each checked
  against existing coverage in that region.

## The international club finder (US/CA/AU directory growth)

The swimly.club regions each have a club-finder directory, mirroring the UK
`/clubs/` model: `/us/clubs/`, `/ca/clubs/` and `/au/clubs/`, backed by
`src/data/us-clubs.json`, `ca-clubs.json` and `au-clubs.json`. Every entry
creates a state/province page and a club page through existing templates, so
growing the data grows the site's long-tail reach in that market. The two
segments are first-class: `type: "competitive"` (competitive teams/clubs) and
`type: "academy"` (swim schools and learn-to-swim academies).

A **directory-growth run** may replace any weekday slot when it is the
highest-value genuine gap. Rules:

- **Add 10 to 20 verified entries for ONE state, province, or metro area per
  run.** Small, reviewable batches; never a mass import.
- **Real clubs only, verified this run.** Source from the governing body's own
  directory (USA Swimming's club search and LSC sites for the US; Swimming
  Canada's provincial sections for Canada; Swimming Australia's state
  associations for Australia) or the organisation's own website. Confirm each
  club's website resolves before adding it. Never invent a club, venue, or fact
  (hard rule 4); if unsure, leave it out.
- **Cover both segments.** Keep a rough balance of competitive clubs and swim
  academies over time. For academies, at most 2 to 3 locations per franchise
  brand; prefer a mix of brands and independents.
- **Match the data shape exactly** (see an existing entry): name, unique slug,
  city, citySlug (from that region's cities file, or null), state/province name
  and slug (from that region's states/provinces file), type, website, a one
  sentence factual description in the region's spelling, and `lat`/`lng` set to
  the club's CITY-CENTROID coordinates (real geography; they drive the
  `/clubs/map/` view, which states that markers sit at city level, so never
  guess a precise venue position).
- **Descriptions state only what the source confirms.** No member counts,
  rankings, or superlatives unless they come from the club's own site.
- Prefer states/provinces that already have city pages (internal linking), and
  then states with no coverage at all, over deepening an already-deep state.
- Log per-state coverage in the ledger's "International club finder" section
  after each run.

## Run procedure (follow in order)

0. **Orient.** Work in `marketing-site/`. Pull the latest default branch. Read this
   playbook and `seo-aeo-ledger.md`. List `src/content/blog/` to see every existing
   slug. Note today's weekday and date.
1. **Choose the task.** Use the rotation, then the backlog. For new content, confirm
   it is a genuine gap (no existing slug or post already covers it) and that it clears
   the new-content bar below. If not, switch to a refresh, technical, or AEO task.
2. **Do the work** to the quality bar.
3. **Self-review** against the quality checklist.
4. **Verify the build.** Run `npm install` if dependencies are missing, then
   `npm run build`. Confirm it builds with no errors and the page count is sensible.
   Do not open a pull request on a broken build.
5. **Hand off.** Pin the `mike-tempest` token first (hard rule 9): `TKN=$(gh auth
   token -u mike-tempest)`, and use it for the push and PR. Create a branch
   `seo/YYYY-MM-DD-short-slug`. Stage only the files you changed (explicit paths,
   never `git add -A`; the working tree has unrelated changes). Commit with a clear
   message. Push and open a pull request using the token (see hard rule 9) and the
   template below. If the push or pull-request creation fails on auth, still commit
   locally and say so in the run report so the work is not lost.
6. **Log the run.** Append an entry to `seo-aeo-ledger.md` and commit it on the same
   branch. Move any completed backlog item to done; add any new follow-ups.
7. **Report.** Summarise what you did, the target query, the pull request link, build
   result, and any follow-ups added to the backlog.

## Quality checklist (gate before opening the pull request)

- [ ] Correct spelling for the page's region (American for `/us`; British/
      Commonwealth for UK, `/ca`, `/au`), no em dashes, no emojis.
- [ ] Correct governing body and terminology for the region; no UK-only specifics
      (Wavepower, DBS, Swim England) on an international page.
- [ ] On-brand voice: practical, empathetic, non-salesy, for volunteer admins.
- [ ] No fabricated facts, stats, or testimonials, in any region. Real geography
      only; no invented clubs, leagues, or venues. External facts are linked.
- [ ] Governance facts verified against a primary source for that region.
- [ ] Frontmatter complete and valid against `src/content.config.ts`.
- [ ] `description` is compelling and 155 characters or fewer.
- [ ] Primary target query appears in the title, the first 100 words, and one H2.
- [ ] At least three internal links to relevant pages. New posts are linked from at
      least one existing related post.
- [ ] FAQ section plus `faqItems` frontmatter where the topic suits it (AEO).
- [ ] The answer to the page's core question is stated plainly near the top.
- [ ] `npm run build` passes.

## New-content bar (anti-thin-content)

A new post must clear all of these, or do a refresh or maintenance task instead:

- Genuine gap. Not already covered by an existing slug or post (check the full list
  for the relevant region).
- At least 1,000 words of specific, region-grounded, genuinely useful help (UK
  facts for UK pages; the relevant country's facts and governing body for US,
  Canada or Australia pages).
- An original angle and structure, not a reword of an existing post, and not a UK
  post with the spelling swapped.
- A real query behind it that a volunteer or parent in that market would actually
  type or ask.

## Blog frontmatter schema

Source of truth is `src/content.config.ts`. Re-read it each run in case it changed.
As of this writing:

```yaml
---
title: "Keyword-led, specific, under 60 characters where possible"
description: "Compelling summary, 155 characters or fewer, used as the meta description"
pubDate: "YYYY-MM-DD"            # required
updatedDate: "YYYY-MM-DD"        # optional, set when refreshing
author: "Swimly Team"            # or "Mike Tempest" for first-person pieces
tags: ["swim clubs", "compliance", "Swim England"]   # reuse the existing vocabulary
seoTitle: "Optional override if a better search title than the H1 exists"
seoDescription: "Optional meta-description override"
faqItems:                        # optional, drives FAQPage schema (AEO)
  - question: "A real question a user would ask"
    answer: "A concise, factual, self-contained answer"
canonical: "https://swimly.uk/..."   # optional; use the region's host (swimly.uk for UK, swimly.club for /us, /ca, /au) and only when pointing elsewhere
noindex: false                   # optional, true for drafts you do not want indexed
---
```

Body conventions: open with a relatable hook that matches search intent, use `##` and
`###` headings (the title is the H1, do not repeat it), short paragraphs, numbered or
bulleted steps, bold for key terms. Close with a soft, honest call to action that
links to a relevant Swimly page. British spelling throughout.

## SEO conventions

- Slugs: kebab-case, keyword-led, stable. Never rename an existing slug (it breaks
  links and loses ranking). 
- Internal links: every post should link to relevant siblings and to at least one
  money page (`/features/`, `/pricing/`, a relevant `/compare/` page) where natural.
- Tags: reuse the existing tag vocabulary rather than inventing near-duplicates.
- Trailing slashes: the site uses `trailingSlash: 'always'`. Write internal links
  with a trailing slash.
- Region-aware links and canonicals: on an international page, link to that
  region's money pages (`/us/pricing/`, `/us/features/`, and so on), not the UK
  ones. Canonical and hreflang derive from `src/config/regions.ts` through the
  shared layout; do not hard-code a host, and never canonicalise an
  international page to its UK equivalent. The layout wiring is being built (see
  `docs/internationalisation.md`); until it lands, check the built HTML of any
  international page you touch to confirm its canonical points at the swimly.club
  host and not swimly.uk, rather than assuming it is emitted automatically.
- Images are optional. If you reference one, make sure it exists in `public/` and has
  descriptive alt text.

## AEO conventions (answer-engine optimisation)

- Lead with the answer. State the direct, factual answer to the page's core question
  in the first paragraph so it is easy to extract and quote.
- Use question-shaped H2s and H3s that mirror how people actually ask.
- Add a visible "Frequently asked questions" section to the page body AND matching
  `faqItems` frontmatter, using the same answer text in both. The FAQPage schema is
  emitted only from `faqItems` (it is not auto-rendered), and Google requires the FAQ
  content to be visible on the page, so schema without a visible Q&A section is
  non-compliant. Keep each answer concise, factual, and self-contained.
- Use comparison tables for "X vs Y" and "best X for Y" intent.
- Define entities clearly: what Swimly is, who it serves, and the key facts, so
  answer engines attribute it correctly. On UK pages, that Swimly is built for UK
  swimming clubs (Swim England, UK data hosting). On a `/us`, `/ca` or `/au` page,
  frame it for that market and its governing body rather than claiming it is
  UK-specific.
- Keep `public/llms.txt` accurate. When features or pricing change, update it.

## Pull request template

```
Title: SEO/AEO: <one-line description of the change>

## What
<one or two sentences>

## Why / target query
<the search query or answer-engine question this serves>

## SEO/AEO elements
- Internal links added: <list>
- FAQ schema: <yes/no>
- Other: <meta, comparison table, llms.txt, etc.>

## Build
npm run build: <pass, page count before -> after>

## Reviewer notes
Reviewed by a human, then deploy with `./deploy-ftp.sh`. Do not deploy from git.
```

## Backlog

Maintained in `seo-aeo-ledger.md`. The Sunday research run keeps it stocked. Always
prefer the highest-value validated item.
