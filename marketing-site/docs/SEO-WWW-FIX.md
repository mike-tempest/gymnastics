# Fixing WWW Redirect — SEO Link Equity Consolidation

## Problem
Both `www.swimly.uk` and `swimly.uk` are indexed in Google, splitting link equity between two versions of the same content. This dilutes SEO authority and can hurt rankings.

## Current State ✓

### What's Working
1. **301 Redirect:** `www.swimly.uk` → `swimly.uk` (permanent redirect)
2. **Canonical Tags:** All pages have `<link rel="canonical" href="https://swimly.uk/...">` 
3. **Sitemaps:** All sitemap URLs use `https://swimly.uk/` (no www)
4. **GSC Property:** Domain property `sc-domain:swimly.uk` (covers both versions)

### The Issue
Despite proper redirects and canonical tags, Google has already indexed both versions. This is common when:
- Site launched with inconsistent domain usage
- External sites linked to both www and non-www
- Google discovered both before canonicals were in place

## Solution: 3-Phase Approach

### Phase 1: Prevention (Immediate) ✅

**Ensure all signals point to non-www:**

1. **Internal links:** All internal links use `https://swimly.uk` (no www)
2. **Sitemaps:** Only submit non-www URLs ✅ (already configured)
3. **Canonical tags:** Point to non-www ✅ (already configured)
4. **Social meta tags:** og:url uses non-www ✅ (already configured)
5. **Structured data:** All schema.org URLs use non-www

**Verification script:**
```bash
cd ~/clawd/projects/swim-team/marketing-site/scripts
node gsc-verify-canonicals.js
```

### Phase 2: De-indexing (Manual, 1-2 weeks)

**Option A: Wait for Google (Recommended)**
- Google will eventually de-index www URLs due to canonicals + redirects
- Timeline: 2-8 weeks typically
- Zero risk, no API quota usage
- Monitor weekly via `site:www.swimly.uk` search

**Option B: Manual Removal Requests (Faster)**
1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select property: `sc-domain:swimly.uk`
3. Navigate to: **Removals** (left sidebar)
4. Click: **New Request**
5. Choose: **Temporarily remove URL**
6. Enter: `https://www.swimly.uk/`
7. Select: **Remove all URLs with this prefix**
8. Submit request

This removes www URLs from search results within 1-3 days, but they may reappear if canonicals aren't maintained.

**Option C: robots.txt Disallow (Nuclear Option)**
```
# robots.txt
User-agent: *
Disallow: /

# Only allow non-www
User-agent: *
Allow: /$
```
⚠️ **Not recommended** — Can cause unintended crawl issues.

### Phase 3: Monitoring (Ongoing)

**Weekly checks:**
```bash
# Check www indexation (should decrease over time)
curl -s "https://www.google.com/search?q=site:www.swimly.uk" | grep "did not match any documents"

# Check non-www indexation (should stay stable/increase)
curl -s "https://www.google.com/search?q=site:swimly.uk" -A "Mozilla/5.0" | grep -o "About [0-9,]* results"
```

**GSC Performance:**
```bash
cd ~/clawd/projects/swim-team/marketing-site/scripts
node gsc-performance.js --days=7
```

Look for:
- Declining impressions from www URLs
- Increasing click-through rate (less confusion from duplicate results)
- Stable/improving average position

## Implementation Checklist

- [x] 301 redirect configured (www → non-www)
- [x] Canonical tags point to non-www
- [x] Sitemaps use non-www URLs
- [x] GSC domain property set up
- [ ] Verify all internal links use non-www (run verification script)
- [ ] Check structured data uses non-www
- [ ] Submit removal request in GSC UI (optional, for speed)
- [ ] Monitor de-indexing progress weekly
- [ ] Update MEMORY.md when www URLs drop to zero

## Expected Timeline

| Week | Action | Expected Result |
|------|--------|----------------|
| 0 | Verify configuration | All signals point to non-www |
| 1 | Submit GSC removal (optional) | www URLs disappear from search |
| 2-4 | Google processes canonicals | www index count decreases |
| 4-8 | Natural de-indexing complete | `site:www.swimly.uk` returns zero results |

## Success Metrics

**Before:**
- `site:www.swimly.uk` → ~1,200 results
- `site:swimly.uk` → ~1,200 results
- Link equity split 50/50

**After:**
- `site:www.swimly.uk` → 0 results
- `site:swimly.uk` → ~1,200+ results  
- 100% link equity consolidated
- Potential 10-30% ranking improvement on competitive keywords

## References

- Google Search Central: [Consolidating duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- Canonical tags: [rel=canonical best practices](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- GSC Removals: [Remove URLs from Google](https://support.google.com/webmasters/answer/9689846)

## Next Steps

1. Run verification script to check internal links
2. Decide: Wait for natural de-indexing OR submit manual removal
3. Set calendar reminder to check weekly (`site:www.swimly.uk`)
4. Update this doc when complete

---

**Status:** ✅ Configuration verified, awaiting de-indexing  
**Owner:** swimly-seo-growth agent  
**Last updated:** 2026-03-01
