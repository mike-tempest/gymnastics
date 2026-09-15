# Club directory maintenance (TEM-52)

The directory contains 1,175 public-source-checked listings: 945 England, 113 Scotland, 69 Wales and 48 Northern Ireland. This is a growing selection, not a comprehensive national register. The front page describes the sources and keeps the growing-coverage qualification.

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

## Map locations

Mike requested an interactive map during implementation. Leaflet 1.9.4 is bundled with the site; OpenStreetMap standard tiles load only after selecting Map view. Nearby pins group at each zoom level, and filters apply equally to map and list. Automated browser tests intercept tile requests rather than generating traffic on the public tile service.

The initial map has 98 of 100 clubs. Ninety-three GB locations are postcode centroids retrieved from Postcodes.io on 14 September 2026 and cached in the dataset. Five Northern Irish listings use four OpenStreetMap town-centre locations, retrieved from Nominatim sequentially with an identified client and over one second between requests. NI postcode coordinates were not used because their commercial use requires a separate licence. Source URLs, precision and check dates are retained for each point.

City of Bristol's conflicting postcode and Isle of Lewis's unrecognised published postcode are left unmapped. Multiple-venue clubs have one pin for the first listed venue. The UI states these limitations, labels all points approximate and retains the full listing when no point is available. Attribution appears beneath the map and on the tile layer. Do not label these coordinates as venue entrances or use them for turn-by-turn directions.

Tile service: https://tile.openstreetmap.org/{z}/{x}/{y}.png, governed by https://operations.osmfoundation.org/policies/tiles/. Honour browser caching, retain Referer and visible attribution, and do not add tile prefetch or offline downloads. GB postcode licensing: https://postcodes.io/docs/licences/.

## Expansion checked on 15 September 2026 (TEM-53)

Added 50 clubs: 40 Wales, seven England and three Northern Ireland. Welsh venues come from the public finder pagination. Duplicate Cardiff Olympic/COGC entries and ambiguous shared Newport records were excluded. Delyn and Pembrokeshire Academy venues are combined under one club; incomplete records and ambiguous provider branches were left out. Programmes are left unknown where the source only provides a venue. English additions use current club website venue pages; Salto and Pro-Star use their own contact pages, and Flight uses Gymnastics Ireland's public venue record.

All 50 additions have approximate map points: 47 GB postcode centroids and three OpenStreetMap town centres for Northern Ireland, checked on 15 September. The directory now maps 148 of 150 clubs; the two previously unmapped records remain unchanged. Existing published slugs and source-check dates are preserved.

## National expansion checked on 15 September 2026 (TEM-54)

British Gymnastics' public venue finder returned its complete unfiltered response of 1,507 venue rows across 1,129 club identifiers. The import uses only the public names, venue addresses and programme tags. Multiple venues are grouped by the source club identifier, with duplicate address lines removed. The public finder does not cover Welsh Gymnastics' separate register, so the remaining Welsh finder pages were checked separately.

The expansion adds 1,025 listings: 922 England, 44 Scotland, 19 Wales and 40 Northern Ireland. Ninety-seven national source identifiers were matched to existing listings by normalised name and nation, with manual checks for renamed clubs and shared venues. All 150 previously published records and slugs remain unchanged. South Staffs and Loughborough umbrella/section records were consolidated; unrelated clubs sharing a leisure centre remain separate. Valleys Gymnastics Academy's seven Welsh venues share one page.

The national additions retain a direct link to the public club-detail page. The link format was checked in a browser against the displayed venue, contacts and programmes. No descriptions, logos, reviews, personal contact details or source map coordinates were copied. Websites remain unset where only a finder record was checked; the source link provides the published contact details. Tags are sourced, with Preschool normalised to Pre-school.

GB postcodes were checked in batches against Postcodes.io, providing nation, English region and cached postcode-centroid points. Northern Irish additions use cached OpenStreetMap town-centre points, with sequential identified requests spaced by at least 1.3 seconds. The directory now has 1,173 mapped listings; the original two unresolved map locations remain unchanged.

This is broad coverage, not a guarantee of every operating UK club. Non-UK venues, unresolved postcode records and ambiguous Welsh duplicates were held back. `coverage-review.json` records the national source records excluded from this import for follow-up. Existing listings can remain even if absent from the national finder. A checked date means the public source was read, not that the club confirmed current opening, availability, affiliation or safety.
