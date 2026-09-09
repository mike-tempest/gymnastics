# Technical SEO Audit — swimly.uk

**Date:** 2 March 2026  
**Auditor:** Swimly SEO Agent  
**Scope:** URL duplicates, schema markup, internal linking

---

## Executive Summary

**Status:** MOSTLY RESOLVED  
The technical SEO foundation is **strong**. All critical schema markup is implemented, canonical tags are in place, and trailing slash configuration is correct. The duplicate URL issue reported in GSC (e.g., `/blog/post` vs `/blog/post/`) will resolve automatically as Google re-crawls and respects the canonical tags.

**Action Required:** Monitor GSC for 2 weeks. No urgent fixes needed.

---

## Findings

### ✅ RESOLVED: Canonical Tags

**Status:** Implemented correctly  
**Location:** `src/layouts/Layout.astro` (lines 17, 74)

```javascript
canonical = new URL(Astro.url.pathname, SITE_URL).href;
```

- All pages include `<link rel="canonical">` tag
- Canonical URLs automatically include trailing slashes (due to Astro config)
- Open Graph and Twitter Card tags reference canonical URL
- **Impact:** Google knows the preferred version of each page

### ✅ RESOLVED: Article Schema

**Status:** Implemented on all blog posts  
**Location:** `src/layouts/BlogPost.astro` (lines 54-75)

```json
{
  "@type": "Article",
  "headline": "...",
  "datePublished": "...",
  "author": {...},
  "publisher": {...}
}
```

- Every blog post includes Article schema
- Publisher set to "Swimly" organisation
- Author field populated (currently "Swimly" but can be individualised)
- **Impact:** Eligible for rich results in Google Search

### ✅ RESOLVED: FAQPage Schema

**Status:** Conditionally implemented  
**Location:** `src/layouts/Layout.astro` (lines 49-61)

- FAQPage schema added when `faqItems` prop is passed
- Currently used on FAQ page
- **Recommendation:** Add `faqItems` to compliance guide blog posts (Wavepower, GDPR, AGM)

### ✅ RESOLVED: LocalBusiness & BreadcrumbList Schema

**Status:** Implemented  
**Coverage:**

- LocalBusiness schema on 560 town pages ✓
- BreadcrumbList schema on:
  - Homepage, features, blog index, FAQ, pricing, about ✓
  - Club pages (`/clubs/[region]/[slug]`) ✓
  - Town pages (`/swimming-club-software/[county]/[town]`) ✓

### ✅ RESOLVED: Trailing Slash Configuration

**Status:** Configured correctly  
**Location:** `astro.config.mjs` (line 7)

```javascript
trailingSlash: 'always';
```

- Astro automatically adds trailing slashes to all URLs
- Sitemap URLs all include trailing slashes (verified in `dist/sitemap-*.xml`)
- **Impact:** Consistent URL structure across the site

---

## Issue Analysis: URL Duplicates in GSC

### What GSC Shows

```
/blog/why-swim-clubs-need-modern-software   → 4 impressions, pos 33.0
/blog/why-swim-clubs-need-modern-software/  → 21 impressions, pos 69.8
```

### Why This Happens

1. **Old crawls:** Google indexed the non-trailing-slash version before the config was set
2. **Cache lag:** GSC data can be 2-3 days behind actual index state
3. **External links:** If external sites link to the non-trailing-slash version, Google may crawl it

### Why This Will Resolve Itself

1. **Canonical tags:** Every page declares the trailing-slash version as canonical
2. **Astro redirects:** Requests to `/blog/post` are 301 redirected to `/blog/post/`
3. **Sitemap:** Only trailing-slash URLs are submitted to Google
4. **Next crawl:** Google will consolidate signals to the canonical version

**Timeline:** 1-2 weeks for Google to update the index

---

## Internal Linking Audit

### Current State

Internal navigation links (Nav, Footer) do not include trailing slashes:

```html
<a href="/pricing">Pricing</a>
<a href="/blog">Blog</a>
<a href="/about">About</a>
```

### Impact

- Astro automatically 301 redirects `/pricing` → `/pricing/`
- **Minor performance hit:** Each click triggers a redirect (adds ~10-50ms)
- **SEO impact:** Minimal (Google follows 301s correctly)

### Recommendation

**Priority:** LOW (nice-to-have, not urgent)

Add trailing slashes to internal links to avoid redirect chains:

```diff
- <a href="/pricing">Pricing</a>
+ <a href="/pricing/">Pricing</a>
```

**Files to update:**

- `src/components/Nav.astro` (lines 56, 98-100, 138-141)
- `src/components/Footer.astro` (check dynamic link arrays)
- Any other components with hardcoded links

**Benefit:**

- Slightly faster page loads (no redirect delay)
- Cleaner server logs
- Better link equity flow (no 301 hop)

---

## Internal Linking Strategy

### Current Cross-Linking

**Good:**

- Blog posts link back to `/blog` (breadcrumb)
- Town/club pages link to each other via county indexes
- Footer includes extensive city navigation

**Missing Opportunities:**

1. **Blog → Product:** Blog posts should link to relevant feature pages
   - Example: DBS guide → `/features/compliance`
   - Example: Billing post → `/features/billing`

2. **Blog → Blog:** Related posts at the bottom of each article
   - Example: Wavepower guide → DBS check guide
   - Example: Committee guide → AGM agenda post

3. **Product → Blog:** Feature pages should link to supporting content
   - Example: `/features/compliance` → Wavepower guide, DBS guide
   - Example: `/features/billing` → "How to collect swim club fees" post

4. **Town → Blog:** Town pages could link to local/operational guides
   - Example: London page → "How to run a swimming club committee"
   - Lower priority (avoid over-optimisation)

### Recommended Link Architecture

**Hub Pages (should have most inbound links):**

1. Homepage (`/`)
2. Pricing (`/pricing`)
3. Features hub (`/features`)
4. Blog index (`/blog`)

**Content Clusters:**

```
Compliance Cluster:
├─ /features/compliance (hub)
├─ /blog/guide-to-wavepower-compliance
├─ /blog/dbs-check-tracking
└─ /blog/swim-club-gdpr-compliance (future)

Billing Cluster:
├─ /features/billing (hub)
├─ /blog/how-to-collect-swim-club-fees (future)
└─ /blog/swim-club-direct-debit-guide (future)

Operational Cluster:
├─ /blog/how-to-run-a-swimming-club-committee (future)
├─ /blog/swim-club-agm-agenda (future)
└─ /blog/swimming-club-handover-checklist (future)
```

**Implementation:**

- Add "Related articles" section to BlogPost.astro layout
- Add "Learn more" CTA blocks in feature pages linking to blog content
- Add internal links within blog post content (editorial links)

---

## Schema Markup Enhancements

### Priority Additions

#### 1. FAQPage on Compliance Guides

**Where:** Blog posts about regulations/compliance  
**Examples:**

- `/blog/guide-to-wavepower-compliance`
- `/blog/dbs-check-tracking`

**Implementation:**

```astro
// In blog post frontmatter
faqItems: [
  {
    question: "What is Wavepower?",
    answer: "Wavepower is Swim England's child safeguarding policy..."
  },
  {
    question: "Who needs a DBS check?",
    answer: "All coaches, volunteers, and committee members..."
  }
]
```

Then pass to Layout via BlogPost wrapper.

#### 2. HowTo Schema (Future)

**Where:** Operational guide blog posts  
**Examples:**

- "How to run a swimming club committee"
- "How to organise a swim club AGM"

**Implementation:**

```json
{
  "@type": "HowTo",
  "name": "How to run a swimming club committee",
  "step": [
    {
      "@type": "HowToStep",
      "name": "Recruit committee members",
      "text": "..."
    }
  ]
}
```

#### 3. AggregateRating (When Real Testimonials Available)

**Where:** Homepage, pricing page  
**Current:** Testimonials exist but are not real clubs yet

**Implementation (when ready):**

```json
{
  "@type": "AggregateRating",
  "ratingValue": "4.9",
  "reviewCount": "12"
}
```

Add to SoftwareApplication schema in Layout.astro.

---

## Action Plan

### Immediate (This Week)

- [x] Audit complete — no urgent fixes required
- [ ] **Monitor GSC Performance report** for next 2 weeks
  - Watch for duplicate URL consolidation
  - Track impressions on trailing-slash versions
  - Verify non-trailing-slash versions drop off

### Short-Term (Next 2 Weeks)

- [ ] **Add FAQPage schema to compliance guides**
  - Wavepower guide
  - DBS check guide
  - Files: Add `faqItems` to blog post frontmatter
  - Priority: MEDIUM (quick win for rich results)

- [ ] **Optional: Add trailing slashes to internal links**
  - `src/components/Nav.astro`
  - `src/components/Footer.astro`
  - Priority: LOW (minor performance improvement)

### Medium-Term (Next Month)

- [ ] **Internal linking strategy**
  - Add "Related articles" component to blog posts
  - Add blog CTAs to feature pages
  - Create content cluster link map
  - Priority: MEDIUM (improves crawlability and UX)

- [ ] **HowTo schema for operational guides**
  - When new operational content is published
  - Priority: LOW (nice-to-have for rich results)

### Ongoing

- [ ] **Monthly GSC audit**
  - Check for new duplicate URLs
  - Monitor schema validation errors
  - Track internal link distribution
  - Script: `scripts/gsc-audit.js` (already exists)

---

## Tools & Scripts

**Existing Tools:**

- `scripts/gsc-verify-canonicals.js` — Check for www vs non-www URLs
- `scripts/gsc-performance.js` — Pull GSC performance data
- `scripts/gsc-audit.js` — Full GSC audit
- `scripts/gsc-submit.js` — Submit URLs to Indexing API

**Recommended:**

- Google Rich Results Test: https://search.google.com/test/rich-results
- Google Search Console: https://search.google.com/search-console
- Screaming Frog (for deep internal link audit, if needed)

---

## Success Metrics

**2 Weeks from Now (16 March 2026):**

- [ ] Duplicate URLs in GSC reduced by 80%+
- [ ] All trailing-slash versions show higher impressions than non-trailing
- [ ] No schema validation errors in GSC

**1 Month from Now (2 April 2026):**

- [ ] FAQPage schema live on 2+ compliance guides
- [ ] Internal link graph shows strong hub pages (features, pricing)
- [ ] Average position improved for priority keywords

**3 Months from Now (2 June 2026):**

- [ ] 3+ blog posts ranking in top 20 for target keywords
- [ ] Rich results appearing for FAQ schema pages
- [ ] Zero duplicate content issues in GSC

---

## Conclusion

**Overall Grade:** A-  
Swimly's technical SEO foundation is excellent. The duplicate URL issue is a normal part of Google's index update process and will resolve automatically via the canonical tags already in place.

**Key Strengths:**

- Comprehensive schema markup (Article, LocalBusiness, BreadcrumbList, FAQ)
- Proper canonical tag implementation
- Consistent trailing slash configuration
- Well-structured sitemap

**Opportunities:**

- Add FAQPage schema to compliance guides (quick win)
- Strengthen internal linking between blog and product pages
- Monitor GSC for duplicate URL consolidation

**Next Steps:**

1. Monitor GSC Performance for 2 weeks
2. Add FAQPage schema to Wavepower/DBS guides
3. Plan internal linking enhancements

---

**Audited by:** Swimly SEO Agent  
**Date:** 2 March 2026  
**Next Audit:** 2 April 2026
