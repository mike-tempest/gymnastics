# Design QA Checklist: Pre-Launch Validation

**Purpose:** Ensure every Swimly feature launch meets design, accessibility, and UX standards before reaching founding clubs. Use this checklist in PR reviews and pre-release validation.

**Target:** WCAG 2.1 AA compliance, mobile-first UX, role-appropriate views, performance budget.

---

## 1. Accessibility (WCAG 2.1 AA)

### Keyboard Navigation

- [ ] All interactive elements reachable via Tab
- [ ] Tab order follows logical visual flow
- [ ] Shift+Tab navigates backward correctly
- [ ] Enter/Space activates buttons and links
- [ ] Escape closes modals and dropdowns
- [ ] Arrow keys navigate within lists and menus
- [ ] No keyboard traps (user can always escape)

### Screen Reader Support

- [ ] All images have meaningful alt text (or `alt=""` if decorative)
- [ ] Form inputs have associated labels (not placeholder-only)
- [ ] Buttons describe their action clearly
- [ ] Error messages programmatically linked to fields (`aria-describedby`)
- [ ] Live regions announce dynamic content (`aria-live`)
- [ ] Headings use semantic HTML (`<h1>` to `<h6>`)
- [ ] Lists use `<ul>`/`<ol>` markup
- [ ] Tables have `<caption>` and `<th scope>` where appropriate

### Colour Contrast

- [ ] Body text: minimum 4.5:1 contrast ratio
- [ ] Large text (≥18pt regular or ≥14pt bold): minimum 3:1
- [ ] Interactive elements (buttons, links): minimum 4.5:1
- [ ] Focus indicators: minimum 3:1 against adjacent colours
- [ ] Test with browser DevTools or WebAIM Contrast Checker
- [ ] Check both light and dark themes (if applicable)

### Focus Indicators

- [ ] All focusable elements have visible focus state
- [ ] Focus outline minimum 2px solid, high-contrast colour
- [ ] Focus visible on keyboard navigation (not just mouse click)
- [ ] Custom focus styles meet contrast requirements
- [ ] Focus order does not skip over hidden content unexpectedly

### Accessible Labels & Instructions

- [ ] Form labels visible at all times (not hidden when filled)
- [ ] Required fields marked with text, not just asterisk
- [ ] Error messages specific ("Email required" not "Error")
- [ ] Success messages confirm action clearly
- [ ] Instructions provided before form, not after submission fails

---

## 2. Mobile UX

### Touch Targets

- [ ] All interactive elements minimum 44x44px (iOS guideline)
- [ ] Spacing between targets ≥8px to prevent mis-taps
- [ ] Primary actions (CTAs) larger and prominent
- [ ] Tested on actual devices (not just browser DevTools)

### One-Handed Operation

- [ ] Primary actions within thumb reach (bottom half of screen)
- [ ] Navigation accessible without hand repositioning
- [ ] No essential content in top corners (hardest to reach)
- [ ] Bottom navigation or floating action buttons preferred

### Portrait Orientation

- [ ] All screens usable in portrait (primary mobile orientation)
- [ ] Landscape mode supported but not required
- [ ] Content does not require horizontal scrolling
- [ ] Forms fit on-screen without excessive scrolling

### Platform Support

- [ ] iOS Safari tested (version N and N-1)
- [ ] Android Chrome tested (version N and N-1)
- [ ] Native input types used (tel, email, date) for better keyboards
- [ ] Date pickers work on both platforms
- [ ] Haptic feedback appropriate (not excessive)

### Offline Capability

- [ ] Essential read actions work offline (cached data)
- [ ] Write actions queue when offline, sync when online
- [ ] User notified clearly when offline
- [ ] No confusing error messages if network unavailable
- [ ] Service worker registered and tested

---

## 3. Design System Compliance

### Colour Palette

- [ ] Canvas: `#F0F0EC` (muted sage green background)
- [ ] Surface: `#FAFAF8` (card backgrounds)
- [ ] Dark Primary: `#121216` (cards, sidebar, nav)
- [ ] Brand Green: `#00FF90` (buttons, links, active nav states)
- [ ] Lime: `#E8F059` (data accents ONLY: stat numbers, chart highlights. NOT navigation.)
- [ ] Semantic colours: Green (active/paid), Amber (warning), Red (overdue/error), Grey (inactive)
- [ ] No aquatic blue (common anti-pattern)

### Typography

- [ ] Headings: DM Serif Display (serif, editorial feel)
- [ ] Body: Inter, 16px minimum on mobile
- [ ] Numbers/Data: Tabular (monospaced numerals) for financial tables and swim times
- [ ] Swim times format: MM:SS.ss (e.g., 1:05.23)
- [ ] Font loading: `display:'swap'` for DM Serif Display
- [ ] Line height: 1.5 for body text, 1.2 for headings

### Component Library

- [ ] Uses existing components from library (not one-off custom)
- [ ] New components added to library with documentation
- [ ] Props follow naming conventions
- [ ] Variants defined clearly (size, state, theme)
- [ ] Component accessible (see Accessibility section)

### British English & Formats

- [ ] All UI copy in British English ("colour" not "color")
- [ ] Dates: DD/MM/YYYY format throughout
- [ ] Currency: £ symbol, format £1,234.56
- [ ] Distances: metres (not yards)
- [ ] Terms: "Autumn term" not "Fall semester"
- [ ] No American swimming jargon without explanation

---

## 4. Role Views (Data Isolation)

### Parent View

- [ ] Sees ONLY their own children's data
- [ ] No access to other members' financial info
- [ ] No admin controls visible
- [ ] No committee-level data (full member lists, reports)
- [ ] Clear indication of role ("Parent Portal")

### Coach View

- [ ] Sees ONLY their assigned squad(s)
- [ ] No financial data visible
- [ ] No access to member directory outside their squad
- [ ] Session register works offline
- [ ] Medical flags visible for their swimmers only

### Committee View

- [ ] Full admin access as appropriate to role
- [ ] Treasurer sees financial dashboard
- [ ] Chair sees governance and compliance
- [ ] Membership Secretary sees full member directory
- [ ] Role-based permissions enforced server-side (not just UI)

### Cross-Role Checks

- [ ] URL manipulation does not reveal restricted data
- [ ] API endpoints enforce role permissions
- [ ] Navigation shows only permitted sections
- [ ] Audit log records who accessed what

---

## 5. Performance (<3s Load on 3G)

### Load Time

- [ ] Initial page load <3s on throttled 3G (DevTools Network)
- [ ] Time to Interactive (TTI) <5s on 3G
- [ ] First Contentful Paint (FCP) <1.5s
- [ ] No blocking scripts in `<head>` (defer or async)
- [ ] Fonts load with `display:swap` (no FOIT/FOUT)

### Asset Optimisation

- [ ] Images compressed (WebP with PNG/JPG fallback)
- [ ] Image dimensions specified in HTML
- [ ] Lazy loading for below-the-fold images
- [ ] SVGs optimised (cleaned with SVGO)
- [ ] No unused CSS or JS in bundle

### Runtime Performance

- [ ] No jank when scrolling long lists
- [ ] Tables with >50 rows virtualised or paginated
- [ ] Debounced search inputs (300ms delay)
- [ ] Smooth animations (60fps, use `transform` not `top/left`)
- [ ] No memory leaks (test with DevTools Performance)

### Bundle Size

- [ ] Main JS bundle <200KB gzipped
- [ ] Code-split routes (not one monolithic bundle)
- [ ] Dependencies audited (no bloated libraries)
- [ ] Tree-shaking enabled in build config

---

## 6. Content (Microcopy & Errors)

### Clear Microcopy

- [ ] Button labels describe action ("Save changes" not "Submit")
- [ ] Headings tell user where they are
- [ ] Empty states explain what to do ("No sessions yet. Create your first one")
- [ ] Loading states describe what's happening ("Loading your swimmers...")
- [ ] No jargon without explanation

### Helpful Errors

- [ ] Error messages specific ("Email required" not "Error in form")
- [ ] Error messages suggest fix ("Password must be 8+ characters")
- [ ] Field-level errors inline, not just at form top
- [ ] Network errors: "Can't connect. Check your internet and try again."
- [ ] Validation errors before submission (not after user waits)

### Confirmation & Success

- [ ] Actions confirmed before execution ("Delete this swimmer? This cannot be undone.")
- [ ] Success messages clear ("Payment recorded. Receipt sent to parent.")
- [ ] Toast notifications auto-dismiss after 5s (unless error)
- [ ] No silent failures (user always knows what happened)

### Tone

- [ ] Warm but professional (this is volunteer software, not enterprise)
- [ ] Encouraging for parents ("Great! Your child is registered.")
- [ ] Clear and direct for admins ("3 DBS checks expire this month.")
- [ ] Calm under pressure ("This session is offline. Data will sync when connected.")

---

## Pre-Launch Sign-Off

**Before merging to main:**

- [ ] All checklist items verified
- [ ] Tested on real devices (iOS + Android)
- [ ] Screen reader tested (VoiceOver or TalkBack)
- [ ] Keyboard navigation verified
- [ ] Performance measured on 3G throttling
- [ ] Design review with Swimly Design agent completed
- [ ] Changelog entry written
- [ ] Founding clubs notified if user-facing change

**Responsible:** Feature developer + peer reviewer + Swimly Design agent

**Cadence:** Every feature, every PR, every time.

---

## Notes

**Why this matters:** Founding clubs (RTW 1 March, Clubs 2-10 March-June) form first impressions. Shipping with accessibility gaps, mobile UX issues, or design inconsistencies creates debt we can't afford. This checklist prevents that.

**Who uses this:** Developers during implementation, reviewers during PR review, QA before release.

**Evolution:** This is v1. Refine based on what catches real issues.
