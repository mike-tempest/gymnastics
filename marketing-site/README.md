# Tumblebase marketing

The Tumblebase site is an Astro static build with Tailwind styling. Run all commands from this directory.

```sh
npm ci --ignore-scripts
npm run dev
npm run build
npm run verify:site
./deploy-ftp.sh --dry-run
```

The live source is `site/`, with public files in `public-tumblebase/`. `astro.config.mjs` excludes the inherited swimming site in `src/` and `public/`. The verification command checks the exact page inventory and prevents inherited swimming content from entering the built output.

## Launch configuration

Copy `.env.example` to a local environment file and set only verified values. Sign-in stays hidden until the application URL is configured. Enquiries use `mike@tumblebase.com`, which Mike confirmed he created. Without an approved monthly price, the pricing page says launch pricing is being finalised. These are explicit launch blockers, not an approved commercial offer.

The current site collects no form data and loads no analytics or third-party fonts. A working founding-club application flow and the associated privacy information belong to TEM-26. Do not enable that flow without those prerequisites.

Publish only with `deploy-ftp.sh` and a dedicated Tumblebase hosting account. It reads `TUMBLEBASE_FTP_HOST`, `TUMBLEBASE_FTP_USER`, `TUMBLEBASE_FTP_PASS` and `TUMBLEBASE_FTP_ROOT` from the environment. It requires explicit FTPS with a valid server certificate and support for `SITE CHMOD`. It does not delete files, so the first target must be a clean document root. Domain DNS and hosting access remain required.

## Content evidence

Checked on 10 September 2026:

- [British Gymnastics on My BG and JustGo for Clubs](https://www.british-gymnastics.org/articles/british-gymnastics-to-provide-clubs-with-free-use-of-new-justgo-for-clubs-class-management-system): supports keeping governing-body membership administration in My BG. No sync, affiliation or endorsement is claimed for Tumblebase.
- [British Gymnastics on purchasing Rise](https://www.british-gymnastics.org/articles/how-to-purchase-rise-gymnastics): Rise and Rise Hub remain British Gymnastics services. Tumblebase supplies configurable records and a CSV bridge, not licensed Rise content or a replacement portal.

Product features are based on completed Linear issues TEM-18 through TEM-24 and TEM-29 through TEM-32. Live deployment acceptance remains TEM-16/TEM-17. No competitor prices or compliance guarantees are published.
