# Deploying the Swimly marketing site

The marketing site is a static Astro build deployed over FTP. One build now feeds
two live domains:

- **swimly.uk** (UK): the United Kingdom site, served from the FTP root.
- **swimly.club** (US/CA/AU): the international site, served from a separate
  document root (an addon domain on the same FTP account) under `/us/`, `/ca/`,
  and `/au/`, with the international hub at its root.

A third domain, **swimly.info**, simply redirects (301) to swimly.club.

There are two ways the site goes live, and both run the same script so the
permission fix and slim `.htaccess` files are always applied.

## Build and split model

`npm run build` produces a single `dist.nosync/` tree. `deploy-ftp.sh` then
splits that one build across the two document roots. There is no separate build
per domain.

```
dist.nosync/                 UK pages at the root (index.html, blog/, clubs/, ...)
dist.nosync/us/              US pages
dist.nosync/ca/              Canada pages
dist.nosync/au/              Australia pages
dist.nosync/international/    swimly.club hub: index.html, robots.txt, sitemap-*.xml
```

The split maps as follows:

| Source in the build                                     | Goes to                                                                                                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Everything EXCEPT `us/`, `ca/`, `au/`, `international/` | swimly.uk document root (the FTP root)                                                                                                                                                                      |
| `dist.nosync/us/`                                       | swimly.club `/us/`                                                                                                                                                                                          |
| `dist.nosync/ca/`                                       | swimly.club `/ca/`                                                                                                                                                                                          |
| `dist.nosync/au/`                                       | swimly.club `/au/`                                                                                                                                                                                          |
| The CONTENTS of `dist.nosync/international/`            | swimly.club root (so `international/index.html` becomes `swimly.club/index.html`, `international/robots.txt` becomes `swimly.club/robots.txt`, and the international sitemaps land at the swimly.club root) |

The swimly.club upload is assembled into a staging tree (`dist-club.nosync/`),
given the same `chmod` permission fix, and given its own slim `.htaccess`
(www to non-www, force HTTPS). It is **skipped** without failing the run when
either of the following is true, so the UK deploy is never blocked:

- the build contains no international content (no `us/`, `ca/`, `au/`,
  `international/` directories), or
- `FTP_REMOTE_CLUB` is not set.

To preview the split without uploading anything, run with `DRY_RUN=1`. The
script prints the exact `lftp` command for each target (with the password masked)
instead of executing it.

```bash
DRY_RUN=1 ./deploy-ftp.sh --no-build
```

## How deploys happen

1. **Automatically on merge to main (preferred).** The
   `.github/workflows/deploy-marketing.yml` workflow builds and deploys whenever a
   change under `marketing-site/**` lands on `main`. Merging a pull request is
   therefore the deploy. You can also trigger it by hand from the Actions tab
   (Run workflow), which uses the `workflow_dispatch` trigger.
2. **Locally, from a correctly configured machine.** Run `./deploy-ftp.sh` from
   `marketing-site/`. Use this only when CI is unavailable.

Both paths call `deploy-ftp.sh`, which handles both swimly.uk and swimly.club
from the one build. Never deploy with raw `lftp` or FTP. The system umask on a
local Mac is `0077`, which makes Astro output unreadable (600/700) and returns
403 across the site. The script chmods directories to 755 and files to 644 before
upload, for both targets. Bypassing it has caused four outages. CI runners use
umask `022`, so the problem does not arise there, but the script still applies
the fix as a safeguard.

## Required GitHub secrets

Set these on the repository (Settings, Secrets and variables, Actions), or with
the CLI:

```bash
printf '%s' 'VALUE' | gh secret set FTP_HOST --repo mike-tempest/swim-team
printf '%s' 'VALUE' | gh secret set FTP_USER --repo mike-tempest/swim-team
printf '%s' 'VALUE' | gh secret set FTP_PASS --repo mike-tempest/swim-team
printf '%s' 'VALUE' | gh secret set FTP_REMOTE_CLUB --repo mike-tempest/swim-team
# If swimly.club is its OWN FTP account (separate login), set these instead of
# relying on the shared FTP_* above; FTP_REMOTE_CLUB then becomes optional and
# defaults to "/" on that account:
printf '%s' 'VALUE' | gh secret set FTP_CLUB_HOST --repo mike-tempest/swim-team
printf '%s' 'VALUE' | gh secret set FTP_CLUB_USER --repo mike-tempest/swim-team
printf '%s' 'VALUE' | gh secret set FTP_CLUB_PASS --repo mike-tempest/swim-team
# Optional:
printf '%s' 'VALUE' | gh secret set FTP_REMOTE_INFO --repo mike-tempest/swim-team
```

| Secret                 | Required                                      | Purpose                                                                                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FTP_HOST`             | Yes                                           | FTP host (shared by all domains on this account)                                                                                                                                                                                                                  |
| `FTP_USER`             | Yes                                           | FTP username                                                                                                                                                                                                                                                      |
| `FTP_PASS`             | Yes                                           | FTP password                                                                                                                                                                                                                                                      |
| `FTP_CLUB_HOST`        | If swimly.club is a separate FTP account      | swimly.club's own FTP host. When set (with USER and PASS), swimly.club deploys with these credentials instead of the shared account.                                                                                                                              |
| `FTP_CLUB_USER`        | If separate account                           | swimly.club FTP username.                                                                                                                                                                                                                                         |
| `FTP_CLUB_PASS`        | If separate account                           | swimly.club FTP password.                                                                                                                                                                                                                                         |
| `FTP_REMOTE_CLUB`      | Shared account: required; dedicated: optional | swimly.club document root. On a dedicated account it defaults to `/` (a dedicated login is usually jailed to its own doc root). On the shared account it must be a non-root absolute path, otherwise the swimly.club upload is skipped (swimly.uk still deploys). |
| `FTP_REMOTE_INFO`      | No                                            | The swimly.info document root. When set, a one-file redirect `.htaccess` (swimly.info to swimly.club) is deployed there. Prefer a host/DNS-level 301 and leave this unset.                                                                                        |
| `SLACK_DEPLOY_WEBHOOK` | No                                            | Slack incoming webhook URL. When set, a failed deploy posts an alert. When unset, the notify step is skipped.                                                                                                                                                     |

### Finding the swimly.club document root

`FTP_REMOTE_CLUB` is the absolute path to the directory that the swimly.club
addon domain serves from, as shown in the hosting control panel (Addon Domains or
Domains). It is something like `/home/USER/swimly.club` or
`public_html/swimly.club`, but the exact value depends on the account, so read it
from the panel rather than guessing. Set `FTP_REMOTE_INFO` the same way if you
choose to deploy the swimly.info redirect over FTP instead of at the DNS level.

If swimly.club has its OWN FTP login (a separate account, not an addon folder on
the swimly.uk account), set `FTP_CLUB_HOST`, `FTP_CLUB_USER` and `FTP_CLUB_PASS`.
The swimly.club deploy then connects with those, and `FTP_REMOTE_CLUB` becomes the
path on that account (default `/`; set it only if that account's doc root is a
subfolder). A `mirror --delete` on a dedicated account only ever touches
swimly.club, so `/` is safe there.

`deploy-ftp.sh` reads `FTP_HOST`, `FTP_USER`, and `FTP_PASS` from the environment
first and falls back to literals in the script, so local deploys keep working
without any setup. `FTP_REMOTE_CLUB` and `FTP_REMOTE_INFO` have no fallback: leave
them empty to skip that domain. To deploy locally with your own credentials
instead of the fallback, export them before running:

```bash
export FTP_HOST=... FTP_USER=... FTP_PASS=...
export FTP_REMOTE_CLUB=...     # shared-account swimly.club doc root (non-root path)
# or, for a dedicated swimly.club account:
export FTP_CLUB_HOST=... FTP_CLUB_USER=... FTP_CLUB_PASS=...
export FTP_REMOTE_INFO=...     # optional swimly.info redirect
./deploy-ftp.sh
```

## swimly.info redirect

swimly.info should issue a permanent (301) redirect to swimly.club. The cleanest
place for this is the host or DNS layer (a domain-level redirect in the control
panel, or a redirect record). If that is not available and swimly.info is an
addon domain on the same FTP account, set `FTP_REMOTE_INFO` to its document root
and the script will upload a single redirect `.htaccess` that 301s every
swimly.info request (including `www`) to the same path on swimly.club. Nothing
else is written to that root, and the step is skipped when `FTP_REMOTE_INFO` is
unset.

## Rotating the FTP password

The password currently has a fallback literal committed in `deploy-ftp.sh`, which
means it is in git history. Rotate it:

1. Change the FTP password in the hosting control panel.
2. Update the secret: `printf '%s' 'NEW_PASSWORD' | gh secret set FTP_PASS --repo mike-tempest/swim-team`.
3. Update your local shell environment (or your `.env`, kept out of git) to match.
4. Remove the literal fallback for `FTP_PASS` from `deploy-ftp.sh`, so the script
   relies on the environment only.
5. Run a deploy (push a small marketing-site change, or use Run workflow) to
   confirm the new credentials work.

## Rolling back

There is no separate rollback button: a deploy reflects whatever is on `main`.
To revert the live site, revert the offending commit on `main`
(`git revert <sha>`) and merge. That push redeploys the previous content.

## The incremental manifest

`deploy-ftp.sh` keeps a checksum manifest (`.deploy-manifest`) for the
**swimly.uk** target so it only uploads changed and removed files. The manifest
covers the UK slice of the build only: the `us/`, `ca/`, `au/`, and
`international/` directories are excluded from it, exactly as they are excluded
from the swimly.uk upload, so the two stay in sync. In CI the manifest is
persisted between runs with `actions/cache`. On a cache miss the script uploads
the whole UK site, which is the correct behaviour for a first run. The manifest
is gitignored and is not the source of truth; it is only an optimisation.

The **swimly.club** target is not incremental. It is small, and it lives in its
own document root, so on each run the script assembles a clean staging tree and
mirrors it with `--delete`, which keeps the swimly.club root exactly matching the
build. This `--delete` is safe precisely because that root is separate from
swimly.uk; the swimly.uk mirror never uses `--delete` and only removes files via
the conservative manifest comparison.

## Notification on failure

If `SLACK_DEPLOY_WEBHOOK` is set, a failed deploy posts a message naming the
branch, the short commit SHA, and a link to the run. GitHub also emails the
person whose push triggered the run. To switch from Slack to email, replace the
`Notify Slack on failure` step with a call to your email provider (the platform
sends transactional email through the Resend HTTPS API).
