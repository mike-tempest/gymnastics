# International Launch Checklist

The concrete go-live runbook for putting the United States, Canada and Australia
sites onto swimly.club, with swimly.info redirecting in. Work top to bottom;
each item is a real action with a clear "done when". For the architecture behind
these steps, read `internationalisation.md` first.

Golden rule, unchanged: the site goes live only through `deploy-ftp.sh`. Never
raw lftp or FTP. The umask 0077 permission fix in that script is what stops 403
outages.

## 1. DNS and hosting

- [ ] **Point swimly.club at the hosting account.** Add or update the DNS
      records for swimly.club so the apex (and `www`, if used) resolve to the
      same host that already serves swimly.uk.
      Done when swimly.club resolves to the host and a placeholder or holding
      page loads over HTTP.
- [ ] **Point swimly.info at the hosting account too.** It needs to resolve so
      it can issue the 301 to swimly.club (step 6).
      Done when swimly.info resolves to the host.
- [ ] **Create the swimly.club document root.** Add swimly.club as its own site
      or add-on domain in the hosting control panel so it has a separate doc
      root from swimly.uk. This is the target for the deploy-split: `us/`,
      `ca/`, `au/` and `international/` land here.
      Done when the swimly.club doc root exists and is the directory the domain
      serves from.
- [ ] **Provision TLS for both new domains.** Issue or confirm certificates for
      swimly.club and swimly.info (Let's Encrypt or the host's equivalent) so
      both serve over HTTPS.
      Done when `https://swimly.club/` and `https://swimly.info/` both load
      without certificate warnings.

## 2. Deploy configuration (secrets, no plaintext)

Prerequisite: the deploy-split itself (teaching `deploy-ftp.sh` to send the
swimly.club content to a second doc root) is a code change delivered by the
deploy part of the intl work. Today `deploy-ftp.sh` has a single swimly.uk
target. The secrets below feed that split once it exists; if the split is not in
the script yet, land it first or these secrets have nothing to drive.

- [ ] **Add the swimly.club FTP secrets.** swimly.club has its OWN FTP login, so
      set `FTP_CLUB_HOST`, `FTP_CLUB_USER` and `FTP_CLUB_PASS` as repository secrets
      (and in the local shell for manual deploys). `FTP_REMOTE_CLUB` is optional in
      this mode and defaults to `/`; set it only if that account's document root is
      a subfolder. (If swimly.club were instead an addon folder on the shared
      account, you would set only `FTP_REMOTE_CLUB` to a non-root path.) Never paste
      a password into a tracked file or chat; use the GitHub UI or `gh secret set`.
      Done when `deploy-ftp.sh` connects with the swimly.club account and uploads
      the intl folders + hub to its doc root.
- [ ] **Add the optional `FTP_REMOTE_INFO` secret** if swimly.info is served
      from this hosting account rather than by a registrar redirect. It only
      needs to carry the small redirect configuration (see step 6), not site
      content.
      Done when the swimly.info redirect host is reachable by the deploy, or
      this item is consciously skipped in favour of a registrar-level redirect.
- [ ] **Do not put any new credential in a tracked file.** Secrets live in the
      environment and CI secret store only. See step 8 for moving the existing
      FTP password out of `deploy-ftp.sh` as well.

## 3. Email

- [ ] **Create the `hello@swimly.club` mailbox** (or alias) on the swimly.club
      domain. This is the contact address used in the intl regions'
      `contactEmail` in `src/config/regions.ts` and in the Organization JSON-LD
      on swimly.club pages.
      Done when mail sent to `hello@swimly.club` is received, and replies send
      from that address.
- [ ] **Confirm sending works for the new domain.** Outbound club email goes via
      the Resend HTTPS API (Railway blocks SMTP), and `EMAIL_FROM` must be on a
      verified domain. If swimly.club will ever send mail, verify it in Resend
      (SPF, DKIM, DMARC) before relying on it.
      Done when swimly.club is a verified sending domain, or it is confirmed
      receive-only for now.

## 4. Google Search Console

- [ ] **Add and verify the swimly.club property.** Prefer a Domain property
      (DNS TXT verification) so it covers every protocol and subpath in one go.
      Done when swimly.club shows as verified in Search Console.
- [ ] **Submit the swimly.club sitemap index.** In the swimly.club property,
      submit `https://swimly.club/sitemap-index.xml`.
      Done when the sitemap shows as read with discovered URLs for `/us`, `/ca`,
      `/au` and the hub.
- [ ] **Set per-folder international targeting.** Because swimly.club is a gTLD,
      set the country target for each regional folder: - `/us/` -> United States - `/ca/` -> Canada - `/au/` -> Australia
      Use the per-directory targeting mechanism available at the time (the
      legacy International Targeting report, or folder-level settings if that is
      what Search Console exposes). Leave the `international/` hub untargeted.
      Done when each folder is targeted to the correct country and the hub is
      left global.
- [ ] **Leave swimly.uk targeting alone.** The `.uk` ccTLD is geo-locked to the
      UK and must not be changed. Do not add swimly.uk URLs to the swimly.club
      property.
      Done when no UK setting was touched.

## 5. Confirm real price points

- [ ] **Replace the provisional prices in `src/config/regions.ts`.** The
      `pricePrimary` and `pricePerformance` values for `us`, `ca` and `au` are
      marked PROVISIONAL. Confirm the real, signed-off regional price points and
      currencies, then update the config and rebuild.
      Done when every region's prices are real (not placeholders) and the built
      `/us/pricing/`, `/ca/pricing/` and `/au/pricing/` pages show them in the
      correct currency.

## 6. Redirect swimly.info to swimly.club

- [ ] **Set up the swimly.info -> swimly.club 301.** A permanent (301) redirect
      from every swimly.info URL to swimly.club, ideally preserving the path so
      `swimly.info/anything` lands on `swimly.club/anything`. Use a host-level
      redirect (or registrar forwarding) rather than serving duplicate content.
      Done when `curl -sI https://swimly.info/` returns `301` with `Location:`
      pointing at `https://swimly.club/`, and a couple of deeper paths redirect
      the same way.
- [ ] **Confirm swimly.info is not indexable as content.** It should only ever
      301; it must not appear in any canonical or hreflang tag and should not
      serve a `200` page of its own.
      Done when swimly.info returns redirects only.

## 7. Validate hreflang and canonicals

- [ ] **Crawl the global routes and check reciprocity.** Run a crawler (for
      example Screaming Frog, Sitebulb, or an hreflang-aware checker) over `/`,
      `/pricing/` and `/features/` on swimly.uk and on each swimly.club region.
      Confirm: - each global route lists all four regional alternates plus `x-default`, - every alternate is reciprocated (A points to B and B points back to A), - `x-default` points at the swimly.uk host, - all hreflang and canonical URLs end in a trailing slash.
      Done when the crawler reports no hreflang errors or missing-return-tag
      warnings on the global routes.
- [ ] **Check canonicals are self-referential per host.** UK pages canonicalise
      to swimly.uk; `/us`, `/ca`, `/au` pages canonicalise to swimly.club on
      their own path; region-only pages self-canonicalise and emit no hreflang.
      Done when spot checks of one page per region show the expected canonical
      and (for global routes only) the hreflang cluster.

## 8. Security

- [ ] **Move the FTP password out of `deploy-ftp.sh` into a secret.** The script
      currently falls back to a hard-coded `FTP_PASS` literal, and its own
      comment notes the password is already in git history. Rotate the FTP
      password, set the new value as the `FTP_PASS` repository secret and in the
      local deploy shell, then delete the literal from the script so it reads the
      password only from the environment.
      Done when `deploy-ftp.sh` contains no plaintext password, the rotated
      password is stored only as a secret, and a deploy still succeeds reading
      `FTP_PASS` from the environment.
- [ ] **Apply the same no-plaintext rule to the new targets.** `FTP_REMOTE_CLUB`
      and any `FTP_REMOTE_INFO` credentials live only in secrets, never in a
      tracked file.
      Done when no intl deploy credential appears in the repository.

## Final go-live gate

- [ ] `npm run build` is green and the page count is sensible.
- [ ] swimly.club serves `/us`, `/ca`, `/au` and the hub; swimly.uk is
      unchanged.
- [ ] swimly.info 301s to swimly.club.
- [ ] Search Console: swimly.club verified, sitemap submitted, per-folder
      targeting set, swimly.uk untouched.
- [ ] Real prices live in every region.
- [ ] hreflang reciprocity validated by a crawler.
- [ ] No plaintext credentials anywhere in the repository.
- [ ] The only thing that pushed files live was `deploy-ftp.sh`.
