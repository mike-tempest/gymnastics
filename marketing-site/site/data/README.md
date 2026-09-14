# Club directory maintenance (TEM-52)

The initial release contains 100 public-source-checked listings: 69 Scotland, 16 England, 10 Wales and 5 Northern Ireland. This is a growing selection, not a comprehensive national register. The front page states the coverage bias explicitly.

`clubs.json` is the publishing source. Each club requires a stable slug, nation, area, town, at least one published venue, sources and a genuine source-check date. A website and discipline list are optional. Missing programmes must remain unknown, not inferred from a club name. No club has claimed or approved its listing. Do not add ratings, current availability, affiliation badges or safeguarding claims without appropriate evidence.

## Sources checked on 14 September 2026

- Scottish Gymnastics' public club finder and 69 individual club records. Individual source URLs are retained per club. Venue records were deduplicated case-insensitively; town casing was normalised. Arbroath's town was extracted from its address rather than its county. Multiple training locations remain on a single club page.
- Welsh Gymnastics' public finder, first ten published records. These records give locations but do not establish programme details or a club website, so those fields remain empty.
- Sixteen English club websites, plus the Portsmouth City Council venue record. City of Bristol's source showed conflicting postcodes, so its postcode is omitted pending clarification.
- Five Northern Irish club websites; Active Living's public club records also support Rathgael and LX venue addresses.

Direct fetches succeeded for all Scottish records and 21 of the 24 other source URLs. Richmond and Portsmouth club sites returned automated-client 403 responses, and South Essex returned 429; their page content was available through web search. These are source-content checks, not guarantees that each site responds to every client. Do not imply direct club verification.

Only factual names, locations and published programme labels are recorded. Descriptions, reviews, logos and photographs from the sources are not copied. Never import private membership, parent or child information.

## Updating a listing

1. Read the existing source and the club's current website. Confirm that the address is a training venue, not a private registered office.
2. Update only supported facts and add a source URL for any new detail. Preserve slugs after publication; a changed slug requires a redirect.
3. Advance `checkedAt` only when the source has actually been checked. Requests received through the correction email require source review before publishing.
4. Build the marketing container and run its verifier. It checks the exact generated page and sitemap inventory, required fields, duplicate slugs, source URLs, canonicals and local links.
5. Run `node marketing-site/scripts/test-directory.mjs` against the container on localhost:4180. It uses the web app's existing Playwright dependency. Override `DIRECTORY_TEST_URL` for another preview.

The directory is static and requires no membership API, new database or paid map service. Search is a progressive enhancement: all listing links remain available without JavaScript. Area pages are generated only when they contain listings. The sitemap includes every public listing and area page and excludes the 404 page and filter combinations.
