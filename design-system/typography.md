# Typography

## Overview

Swimly uses a two-typeface system: **DM Serif Display** for headings (editorial, distinctive) and **Inter** for body text (clean, readable). This creates a magazine-like aesthetic that feels professional but approachable.

The authoritative source of truth is `apps/web/src/app/layout.tsx` (font loading) and `apps/web/tailwind.config.ts` (`font-serif`, `font-sans`). Both fonts load via `next/font/google` and expose CSS variables. Use the Tailwind tokens `font-serif` and `font-sans` rather than naming the fonts directly.

## Typeface Specifications

### DM Serif Display (Headings)
- **Purpose:** Headings, section titles, distinctive UI elements
- **Why:** Editorial feel, stands out without being aggressive, readable at large sizes
- **Loading:** `next/font/google`, `weight: '400'`, `display: 'swap'`, exposed as `--font-serif`
- **Tailwind:** `font-serif`
- **Usage:** H1-H3 only, never body text
- **Weights:** Regular (400) only. For stronger headings, increase size rather than weight.

### Inter (Body Text)
- **Purpose:** Body copy, UI text, form labels, buttons, navigation
- **Why:** Highly readable, professional, works at all sizes, excellent web font
- **Loading:** `next/font/google`, exposed as `--font-inter`
- **Tailwind:** `font-sans`
- **Weights:** Regular (400) body, Medium (500) labels, Semi-Bold (600) buttons/nav, Bold (700) emphasis

### Tabular (Data & Numbers)
- **Purpose:** Swim times, financial tables, member counts, session attendance
- **Why:** Monospaced numerals for vertical alignment in tables
- **Usage:** Anywhere numbers need to align (times, currency, counts)
- **CSS:** `font-variant-numeric: tabular-nums;`

## Type Scale

### Desktop (1024px+)
- **H1:** 48px (3rem), DM Serif Display Regular, line-height 1.1
- **H2:** 36px (2.25rem), DM Serif Display Regular, line-height 1.2
- **H3:** 28px (1.75rem), DM Serif Display Regular, line-height 1.3
- **H4:** 20px (1.25rem), Inter Semi-Bold, line-height 1.4
- **Body Large:** 18px (1.125rem), Inter Regular, line-height 1.6
- **Body:** 16px (1rem), Inter Regular, line-height 1.6
- **Body Small:** 14px (0.875rem), Inter Regular, line-height 1.5
- **Caption:** 12px (0.75rem), Inter Regular, line-height 1.4

### Mobile (320-767px)
- **H1:** 36px (2.25rem), DM Serif Display Regular, line-height 1.1
- **H2:** 28px (1.75rem), DM Serif Display Regular, line-height 1.2
- **H3:** 22px (1.375rem), DM Serif Display Regular, line-height 1.3
- **H4:** 18px (1.125rem), Inter Semi-Bold, line-height 1.4
- **Body Large:** 18px (1.125rem), Inter Regular, line-height 1.6
- **Body:** 16px (1rem), Inter Regular, line-height 1.6 **(minimum)**
- **Body Small:** 14px (0.875rem), Inter Regular, line-height 1.5
- **Caption:** 12px (0.75rem), Inter Regular, line-height 1.4

**Note:** Never go below 16px for body text on mobile. WCAG AA requires readable text sizes.

## Usage Guidelines

### When to Use DM Serif Display
✅ **DO:**
- Page titles (Dashboard, Members, Billing)
- Section headings (Upcoming Sessions, Payment History)
- Card titles (when large and prominent)
- Hero text on marketing pages

❌ **DON'T:**
- Body paragraphs (use Inter)
- Form labels (use Inter)
- Small text (below 20px, switch to Inter)
- Navigation items (use Inter)
- Buttons (use Inter)

### When to Use Tabular Numbers
✅ **DO:**
- Swim times: `1:05.23` (minutes:seconds.hundredths)
- Currency: `£24.50` (pounds and pence)
- Member counts: `22 / 25` (present/total)
- Financial tables (all columns align)
- Session attendance numbers

❌ **DON'T:**
- Running text (use proportional Inter)
- Headings (unless explicitly data-focused)
- Labels that aren't numeric

### Swim Time Format
- **Standard:** MM:SS.ss (e.g., `1:05.23`)
- **Font:** Tabular numerals (always)
- **Size:** Minimum 16px on mobile, 18px preferred
- **Weight:** Inter Semi-Bold (600) for prominence

## Accessibility Requirements

### Minimum Sizes
- **Body text:** 16px minimum on mobile, 14px absolute minimum on desktop
- **Buttons/CTAs:** 16px minimum
- **Form labels:** 14px minimum, 16px preferred
- **Legal/terms:** 12px minimum, must pass contrast checks

### Contrast Ratios (WCAG 2.1 AA)
- **Normal text (< 18px):** 4.5:1 minimum
- **Large text (≥ 18px):** 3:1 minimum
- **Bold text (≥ 14px semi-bold):** 3:1 minimum
- **UI components:** 3:1 minimum

### Line Height
- **Body text:** 1.5 minimum (WCAG AAA recommends 1.5)
- **Headings:** 1.2-1.3 (tighter for visual impact)
- **Cramped UI (badges, pills):** 1.4 minimum

### Line Length
- **Optimal:** 50-75 characters per line
- **Maximum:** 80 characters (readability drops beyond this)
- **Mobile:** Let natural wrapping occur, don't force narrow columns

## Code Examples

### CSS Variables
```css
:root {
  /* Typefaces */
  --font-serif: 'DM Serif Display', Georgia, serif;
  --font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  
  /* Type scale (desktop) */
  --text-h1: 3rem;     /* 48px */
  --text-h2: 2.25rem;  /* 36px */
  --text-h3: 1.75rem;  /* 28px */
  --text-h4: 1.25rem;  /* 20px */
  --text-body-lg: 1.125rem; /* 18px */
  --text-body: 1rem;   /* 16px */
  --text-body-sm: 0.875rem; /* 14px */
  --text-caption: 0.75rem;  /* 12px */
  
  /* Line heights */
  --leading-tight: 1.1;
  --leading-snug: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.6;
}
```

### Component Classes
```css
/* Heading */
.heading-1 {
  font-family: var(--font-serif);
  font-size: var(--text-h1);
  line-height: var(--leading-tight);
  font-weight: 400;
}

/* Body text */
.body {
  font-family: var(--font-sans);
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
  font-weight: 400;
}

/* Tabular numbers (times, currency) */
.tabular {
  font-variant-numeric: tabular-nums;
}

/* Swim time */
.swim-time {
  font-family: var(--font-sans);
  font-size: var(--text-body-lg);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
```

### React/TypeScript Example
```tsx
// Heading component
<h1 className="text-5xl font-serif font-normal leading-tight">
  Dashboard
</h1>

// Swim time display
<span className="text-lg font-semibold tabular-nums">
  1:05.23
</span>

// Financial amount
<span className="text-base font-medium tabular-nums">
  £24.50
</span>
```

## Common Mistakes

### ❌ Wrong
```html
<!-- Using serif for body text -->
<p class="font-serif text-base">
  Your subscription payment of £24.50 is due on 15/03/2026.
</p>

<!-- Button text too small -->
<button class="text-sm">Submit Payment</button>

<!-- Swim time without tabular -->
<div class="text-base">1:05.23</div>
```

### ✅ Correct
```html
<!-- Inter for body text -->
<p class="font-sans text-base leading-relaxed">
  Your subscription payment of <span class="font-semibold tabular-nums">£24.50</span> 
  is due on <span class="tabular-nums">15/03/2026</span>.
</p>

<!-- Button text readable -->
<button class="text-base font-semibold">Submit Payment</button>

<!-- Swim time with tabular -->
<div class="text-lg font-semibold tabular-nums">1:05.23</div>
```

## Testing Checklist

When reviewing text in Swimly:

- [ ] Is body text at least 16px on mobile?
- [ ] Are headings using DM Serif Display appropriately?
- [ ] Do numeric tables use tabular numerals?
- [ ] Does all text meet 4.5:1 contrast ratio (or 3:1 for large text)?
- [ ] Is line height at least 1.5 for body text?
- [ ] Are swim times formatted MM:SS.ss with tabular numerals?
- [ ] Are dates formatted DD/MM/YYYY (British standard)?
- [ ] Is currency displayed as £ with pence (£24.50 not £24.5)?

---

**Next:** [Colour System](./colour-system.md) for the Swimly colour palette and usage rules.
