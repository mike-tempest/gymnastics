# Swimly Design System

**Version:** 1.0  
**Last updated:** 2 March 2026  
**Status:** Active (pilot-ready)

This document codifies Swimly's design language — the colours, typography, components, and patterns that make Swimly look and feel like Swimly. It's written for designers, developers, and anyone who needs to understand how Swimly should present itself to users.

---

## Design Principles

### 1. Volunteer-Proof Simplicity

Every screen answers one question: "What do I need to do here?" No feature should require a manual. If it needs explaining, redesign it. Our users are unpaid volunteers fitting club admin around jobs and family.

### 2. Role-Appropriate Views

Different users need different things. Don't show the treasurer coaching rotas. Don't show parents billing admin. Role-based views are fundamental, not a nice-to-have.

### 3. Poolside-Ready

Coaches use this on phones, poolside, often with wet hands. Large tap targets, high contrast, offline capability, one-handed operation. No tiny buttons. No hover states that don't work on mobile.

### 4. Trust Through Transparency

Volunteers are accountable to parents and committees. Every financial transaction, every data change, every compliance record must be visible and auditable.

### 5. British, Not American

UI copy in British English. Date formats DD/MM/YYYY. Currency in £. Distances in metres. No "Fall semester" — it's "Autumn term."

### 6. Calm, Not Cluttered

Swimming pools are chaotic enough. Swimly should feel calm, organised, and in control. Muted colours, clear typography, generous whitespace.

---

## Colour Palette

The authoritative source of truth is `apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css`. Always use Tailwind tokens. Never hard-code raw hex values in components, and never use foreign greys (`gray-`, `slate-`, `zinc-`, `neutral-`, `stone-`); use `grey-*` or `text-text-*` instead.

### Brand: Mint

**Brand Mint (Interactive)**  
`#85FFC7`. The primary interactive colour. Used for primary call-to-action buttons, active navigation states, focus indicators, and highlights on dark surfaces.  
Tailwind: `bg-brand` / `text-brand` / `border-brand`  
CSS Variable: `--brand`

**Brand Mint Dark**  
`#5CEFAA`. Darker mint for hover states on primary actions.  
Tailwind: `bg-brand-dark`  
CSS Variable: `--brand-dark`

**Brand Mint Light**  
`#B2FFE0`. Lighter mint for subtle fills and hover tints.  
Tailwind: `bg-brand-light`

### Dark Surfaces: Deep Teal

The sidebar, top bar, and dark cards use a deep teal family rather than near-black.

| Token                         | Hex       | Usage                                     |
| ----------------------------- | --------- | ----------------------------------------- |
| `dark-primary`                | `#0F2D2D` | Deepest teal. Sidebar, dark page surfaces |
| `dark-secondary`              | `#163F3F` | Raised dark panels                        |
| `dark-tertiary` / `dark-card` | `#1E5555` | Dark cards on teal                        |
| `teal`                        | `#297373` | Mid teal accent                           |

Tailwind: `bg-dark-primary`, `bg-dark-secondary`, `bg-dark-tertiary`, `bg-teal`.

### Accent: Coral

**Coral (Accent CTA, attention)**  
`#FF8552`. Secondary call-to-action and attention accent.  
Tailwind: `bg-coral` / `text-coral`

**Coral Hover**  
`#FF6B33`. Hover state for coral actions.  
Tailwind: `bg-coral-hover`

### Canvas and Surfaces

**Canvas (Background)**  
`#E6E6E6`. Light grey. The main page background.  
Tailwind: `bg-canvas`  
CSS Variable: `--bg-primary`

**Surface (Cards)**  
`#F0F0F0`. Slightly lighter grey for card and elevated surface backgrounds.  
Tailwind: `bg-surface`  
CSS Variable: `--bg-secondary`

**Lime (Data Visualisation ONLY)**  
`#E8F059`. Reserved for data visualisation accents (chart highlights) only. Never for navigation, buttons, or primary UI.  
Tailwind: `text-lime` / `bg-lime`

> **Note:** Mint on deep teal is the signature Swimly look. It is deliberately not aquatic blue.

### Grey Scale

| Shade      | Hex       | Usage                          |
| ---------- | --------- | ------------------------------ |
| `grey-50`  | `#F0F0F0` | Lightest backgrounds           |
| `grey-100` | `#E6E6E6` | Canvas background              |
| `grey-200` | `#CCCCCC` | Borders, dividers              |
| `grey-300` | `#B3B3B3` | Disabled states                |
| `grey-400` | `#999999` | Placeholder text               |
| `grey-500` | `#808080` | Muted text                     |
| `grey-600` | `#666666` | Secondary text                 |
| `grey-700` | `#4D4D4D` | Body text on light backgrounds |
| `grey-800` | `#39393A` | Graphite. Primary text         |
| `grey-900` | `#2A2A2B` | Darkest grey                   |

### Semantic Colours

**Success / Active / Paid / Present**  
`#85FFC7` (Brand Mint)  
Tailwind: `text-success` / `bg-success`

**Warning / Expiring Soon / Partial**  
`#FFB020` (Amber)  
Tailwind: `text-warning` / `bg-warning`

**Danger / Overdue / Expired / Absent**  
`#FF4D4D` (Red)  
Tailwind: `text-danger` / `bg-danger`

**Info / Neutral**  
`#4D9FFF` (Blue)  
Tailwind: `text-info` / `bg-info`

**Inactive / Archived**  
`grey-400` / `grey-500`

### Text Colours

| Token                 | Hex       | Usage                                 |
| --------------------- | --------- | ------------------------------------- |
| `text-text-primary`   | `#39393A` | Graphite. Headings, primary body text |
| `text-text-secondary` | `#666666` | Secondary text, labels                |
| `text-text-tertiary`  | `#999999` | Placeholder, disabled text            |

---

## Typography

### Font Families

**Headings: DM Serif Display**  
Serif, elegant, editorial feel. Weight: 400 (regular only).

```tsx
className = 'font-serif';
```

**Body: Inter**  
Clean sans-serif. Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold).

```tsx
className = 'font-sans';
```

**Data: Tabular Numerals**  
Monospaced numerals for financial tables, times, statistics. Use Inter with `tabular-nums` variant.

```tsx
className = 'font-mono tabular-nums';
```

### Font Loading

**Inter**: Variable font loaded via `next/font/google`, assigned to `--font-inter`  
**DM Serif Display**: Loaded with `display: 'swap'` to prevent FOUT, assigned to `--font-serif`

### Type Scale

| Token       | Size | Line Height | Usage                         |
| ----------- | ---- | ----------- | ----------------------------- |
| `text-xs`   | 12px | 16px        | Small labels, metadata        |
| `text-sm`   | 14px | 20px        | Helper text, secondary info   |
| `text-base` | 16px | 24px        | Body text (minimum on mobile) |
| `text-lg`   | 18px | 28px        | Emphasized body text          |
| `text-xl`   | 20px | 28px        | Small headings                |
| `text-2xl`  | 24px | 32px        | Section headings              |
| `text-3xl`  | 30px | 36px        | Page headings                 |
| `text-4xl`  | 36px | 40px        | Hero headings                 |

### Swim Time Format

All swim times displayed in standard format: **MM:SS.ss**  
Example: `1:05.23`

---

## Spacing & Layout

### Spacing Scale

Tailwind's default spacing scale (0.25rem increments):

- `1` = 4px
- `2` = 8px
- `3` = 12px
- `4` = 16px
- `6` = 24px
- `8` = 32px
- `12` = 48px
- `16` = 64px

### Container Widths

Desktop layouts use max-width constraints to prevent content spreading too wide on large screens:

- `max-w-7xl` (1280px) for dashboard layouts
- `max-w-5xl` (1024px) for content pages
- `max-w-3xl` (768px) for forms, reading content

### Responsive Breakpoints

| Breakpoint | Min Width | Primary Use Case          |
| ---------- | --------- | ------------------------- |
| Mobile     | 320px     | Coaches/parents on phones |
| Tablet     | 768px     | Poolside tablets          |
| Desktop    | 1024px    | Committee admin           |

**Design approach:** Mobile-first. Enhance for desktop.

---

## Border Radius

| Token            | Value | Usage                               |
| ---------------- | ----- | ----------------------------------- |
| `rounded-button` | 12px  | Buttons, small interactive elements |
| `rounded-card`   | 20px  | Cards, panels, modals               |
| `rounded-lg`     | 16px  | Large interactive areas             |
| `rounded-xl`     | 20px  | Feature cards                       |

---

## Shadows

### Card Shadows

**Default Card**

```css
box-shadow:
  0 1px 3px rgba(0, 0, 0, 0.08),
  0 1px 2px rgba(0, 0, 0, 0.06);
```

Tailwind: `shadow-card`

**Hover State**

```css
box-shadow:
  0 4px 12px rgba(0, 0, 0, 0.12),
  0 2px 4px rgba(0, 0, 0, 0.08);
```

Tailwind: `shadow-card-hover`

### Brand Glow (Interactive Elements)

**Default Glow**

```css
box-shadow: 0 0 30px rgba(133, 255, 199, 0.2);
```

Tailwind: `shadow-glow`

**Small Glow**

```css
box-shadow: 0 0 15px rgba(133, 255, 199, 0.15);
```

Tailwind: `shadow-glow-sm`

---

## Component Patterns

### Navigation

**Desktop:** Sidebar navigation with role-based sections  
**Mobile:** Bottom tab bar (max 5 tabs)  
**Admin areas:** Breadcrumbs for hierarchy

### Cards

#### Member Card

- Name (heading)
- Squad badge
- SE number
- Status indicator (colour-coded)

#### Swimmer Card (Parent View)

- Name
- Squad
- Next session time/location
- Recent PB

#### Payment Card

- Amount (large, tabular numerals)
- Date (DD/MM/YYYY)
- Status badge
- Receipt link

#### Session Card

- Time
- Pool location
- Squad name
- Coach name
- Attendance count (e.g., "18/22 present")

### Tables

- Sortable columns
- Filterable data
- Row actions via kebab menu (⋮)
- Bulk selection with floating action bar
- **Responsive:** Stack into cards on mobile

### Forms

- Progressive disclosure (don't show everything at once)
- Inline validation (not just on submit)
- Smart defaults: UK country, DD/MM/YYYY date format
- Multi-step wizards for complex flows (registration, billing setup)
- **Minimum tap target on mobile:** 44x44px

### Buttons

Use the `Button` primitive (`apps/web/src/components/ui/button.tsx`) and pick a variant rather than hand-rolling classes. The canonical primary call to action is mint (`variant="brand"`); coral (`variant="coral"`) is the accent call to action.

**Primary (Brand Mint)** -- `variant="brand"`

```tsx
<Button variant="brand">Action</Button>
// resolves to: bg-brand text-dark-primary hover:bg-brand-dark rounded-button
```

**Accent (Coral)** -- `variant="coral"`

```tsx
<Button variant="coral">Highlight</Button>
// resolves to: bg-coral text-white hover:bg-coral-hover rounded-button
```

**Secondary (Outline)**

```tsx
<button className="border-2 border-brand text-brand hover:bg-brand hover:text-dark-primary font-medium px-6 py-3 rounded-button">
  Secondary
</button>
```

**Danger (Red)** -- `variant="destructive"`

```tsx
<Button variant="destructive">Delete</Button>
```

### Notifications & Alerts

- **Toast notifications:** For completed actions (saved, sent, deleted)  
  Tailwind: Using `sonner` library, positioned `top-right`

- **Badge counts:** On nav items (e.g., "3 pending approvals")

- **Alert banners:** For urgent items (expiring DBS, failed payment)  
  Styled with semantic colours (warning/danger/info)

- **Push notifications:** Mobile only, opt-in, never spammy

---

## Accessibility Standards

### WCAG 2.1 Level AA Requirements

**Colour Contrast**

- Text: Minimum 4.5:1 against background
- Large text (18pt+): Minimum 3:1
- Interactive elements: Minimum 3:1 for borders/icons

**Focus Indicators**  
All interactive elements must have visible focus indicators.  
**Implementation** (matches `globals.css`):

```css
:focus-visible {
  outline: 2px solid #85ffc7; /* Brand Mint */
  outline-offset: 2px;
}
```

**Keyboard Navigation**

- Tab order must be logical
- All interactive elements keyboard-accessible
- No keyboard traps

**Screen Readers**

- Semantic HTML (`<nav>`, `<main>`, `<article>`, etc.)
- ARIA labels on icons and icon-only buttons
- Form labels always visible (not placeholder-only)
- Error messages descriptive and linked to fields

**Alt Text**  
All images and icons must have meaningful alt text or `aria-label`.

**No Flashing Content**  
Nothing flashes more than 3 times per second.

---

## Voice & Tone

### Language Rules

- **British English always**
- **Date format:** DD/MM/YYYY
- **Currency:** £ (pounds, never dollars)
- **Distances:** Metres (not yards)
- **Seasons:** Autumn (not Fall), Spring, Summer, Winter

### Tone Guidelines

**Clear, warm, volunteer-friendly**

- Write like you're talking to a busy parent or volunteer
- No jargon without explanation
- Short sentences
- Active voice
- Positive framing ("Complete registration" not "Missing information")

### Copy Examples

❌ **Don't:**

> "Your payment mandate requires configuration to facilitate Direct Debit processing."

✅ **Do:**

> "Set up Direct Debit to collect payments automatically."

❌ **Don't:**

> "Fall session registration now open."

✅ **Do:**

> "Autumn term registration now open."

---

## File References

### Configuration Files

**Tailwind Config:**  
`/apps/web/tailwind.config.ts`

**Global Styles:**  
`/apps/web/src/app/globals.css`

**Root Layout (Fonts):**  
`/apps/web/src/app/layout.tsx`

### Component Library

**UI Components:**  
`/apps/web/src/components/ui/`

Key components:

- `button.tsx` — Button variants
- `card.tsx` — Card layouts
- `badge.tsx` — Status badges
- `LoadingSpinner.tsx` — Loading states
- `EmptyState.tsx` — Empty states
- `ErrorState.tsx` — Error states

---

## Implementation Notes

### Print Styles

A4 portrait layout with 15mm/12mm margins. Hides sidebar and navigation. Shows content in natural flow.

**Print-specific utilities:**

- `.no-print` — Hide element when printing
- `.print-only` — Show only when printing

### Dark Mode

Swimly includes dark mode support via `darkMode: ['class']` in Tailwind config. Dark mode uses:

- Background: `dark-primary` (#0F2D2D)
- Cards: `dark-secondary` (#163F3F) / `dark-tertiary` (#1E5555)
- Text: `grey-50` with appropriate opacity

---

## Anti-Patterns (Never Do This)

- Don't show swim parents financial admin data
- Don't require training to use basic features
- Don't use American English or date formats anywhere
- Don't design hover-only interactions (coaches use touchscreens)
- Don't make important actions more than 2 taps away on mobile
- Don't show the full member database to coaches (they see their squad only)
- Don't use swimming jargon in parent-facing UI without explanation
- Don't design for "power users" first; design for volunteers first
- **Don't use Lime (#E8F059) for navigation or structural UI.** It is for data visualisation accents only

---

## Rationale for Key Decisions

### Why Mint on Teal, Not Aquatic Blue?

**Decision:** Deep teal dark surfaces with mint interactive accents and a coral CTA accent, on a calm light grey canvas.

**Why:** Differentiation. Every swim club app uses aquatic blue. Mint on deep teal feels calmer, more sophisticated and more memorable. The grey canvas is neutral enough for long admin sessions, while mint provides energy without being garish and coral draws the eye to key actions.

### Why DM Serif Display for Headings?

**Decision:** Serif headings, sans-serif body.

**Why:** Creates visual hierarchy and personality. Pure sans-serif systems feel generic. The serif adds warmth and trustworthiness, which matters when asking volunteers to trust us with their club's data and finances.

### Why 16px Minimum on Mobile?

**Decision:** Body text never smaller than 16px on mobile.

**Why:** Prevents iOS Safari from auto-zooming on form inputs. Better readability poolside. Accessibility best practice for users with visual impairments.

### Why Tabular Numerals for Data?

**Decision:** Monospaced numbers in tables and financial displays.

**Why:** Alignment. Proportional numerals (default) make columns of numbers hard to scan. Tabular numerals align vertically, critical for financial tables and swim times.

---

## Version History

**1.0** (2 March 2026) — Initial documentation of pilot-ready design system

---

**Questions? Updates?**  
This document should evolve as Swimly grows. If you're adding a new component or pattern, document it here. If you're changing a fundamental decision (e.g., colour palette), update this document and note the rationale.
