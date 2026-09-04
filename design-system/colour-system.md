# Colour System

## Overview

Swimly uses a mint and deep teal palette with a coral accent, on a calm light grey canvas. This is deliberately not a swimming pool blue aesthetic. The system prioritises a calm, professional feel suitable for volunteer committee members.

The authoritative source of truth is `apps/web/tailwind.config.ts` and `apps/web/src/app/globals.css`. Always use Tailwind tokens. Never hard-code raw hex values in components (no `bg-[#...]`), and never use foreign greys (`gray-`, `slate-`, `zinc-`, `neutral-`, `stone-`). Use `grey-*` or `text-text-*` instead.

## Brand Palette

### Brand Mint

- **Hex:** `#85FFC7` (dark `#5CEFAA`, light `#B2FFE0`)
- **Tailwind:** `bg-brand`, `text-brand`, `border-brand`, `bg-brand-dark`, `bg-brand-light`
- **Usage:** The primary interactive colour. Primary call-to-action buttons, active navigation states, focus indicators, selected states, and highlights on dark surfaces.
- **Why:** A fresh, high-energy accent that reads clearly on the deep teal surfaces.
- **Never use for:** Large light backgrounds (too intense), or as body text on light surfaces (insufficient contrast).

### Deep Teal (Dark Surfaces)

The sidebar, top bar, and dark cards use a deep teal family rather than near-black.

| Token | Hex | Usage |
|-------|-----|-------|
| `dark-primary` | `#0F2D2D` | Deepest teal. Sidebar, dark page surfaces |
| `dark-secondary` | `#163F3F` | Raised dark panels |
| `dark-tertiary` / `dark-card` | `#1E5555` | Dark cards on teal |
| `teal` | `#297373` | Mid teal accent (`teal-light` `#3A9E9E`) |

### Coral (Accent)

- **Hex:** `#FF8552` (hover `#FF6B33`, light `#FFB899`, dark `#E66A35`)
- **Tailwind:** `bg-coral`, `text-coral`, `bg-coral-hover`
- **Usage:** The accent call to action and attention colour. Highlights, secondary CTAs, and items needing attention.
- **Never use for:** Body text, or large background fills.

### Canvas and Surface

- **Canvas:** `#E6E6E6`. Tailwind `bg-canvas`. The main page background.
- **Surface:** `#F0F0F0`. Tailwind `bg-surface`. Card and elevated surface backgrounds.

### Lime (Data Visualisation Accent)

- **Hex:** `#E8F059`
- **Tailwind:** `text-lime`, `bg-lime`
- **Usage:** Data visualisation accents (chart highlights) ONLY.
- **Never use for:** Navigation, buttons, links, or any interactive element. Mint is the interactive colour.

### Critical Rule: Mint vs Coral vs Lime

- **Mint (#85FFC7):** The primary interactive colour (click/tap, active, focus).
- **Coral (#FF8552):** The accent CTA and attention colour.
- **Lime (#E8F059):** Data visualisation only, never interactive.

## Semantic Colours

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Success | `success` | `#85FFC7` | Payment confirmed, mandate approved, attendance marked, compliant |
| Warning | `warning` | `#FFB020` | Expiring soon, partial payment, pending approval, action needed |
| Danger | `danger` | `#FF4D4D` | Payment failed, mandate cancelled, non-compliant, error state |
| Info | `info` | `#4D9FFF` | Informational notices, tips, neutral updates |
| Inactive | `grey-400` / `grey-500` | `#999999` / `#808080` | Archived, disabled |

Tailwind: `text-success` / `bg-success`, `text-warning` / `bg-warning`, `text-danger` / `bg-danger`, `text-info` / `bg-info`.

## Grey Scale

| Token | Hex | Usage |
|-------|-----|-------|
| `grey-50` | `#F0F0F0` | Lightest backgrounds |
| `grey-100` | `#E6E6E6` | Canvas background |
| `grey-200` | `#CCCCCC` | Borders, dividers |
| `grey-300` | `#B3B3B3` | Disabled states |
| `grey-400` | `#999999` | Placeholder text |
| `grey-500` | `#808080` | Muted text |
| `grey-600` | `#666666` | Secondary text |
| `grey-700` | `#4D4D4D` | Body text on light backgrounds |
| `grey-800` | `#39393A` | Graphite. Primary text |
| `grey-900` | `#2A2A2B` | Darkest grey |

### Text Colours

| Token | Hex | Usage |
|-------|-----|-------|
| `text-text-primary` | `#39393A` | Graphite. Headings, primary body text |
| `text-text-secondary` | `#666666` | Secondary text, labels |
| `text-text-tertiary` | `#999999` | Placeholder, disabled text |

## Status Colour Mapping (Committee Context)

### Membership Status
- **Active:** Success
- **Pending renewal:** Warning
- **Lapsed:** Danger
- **Inactive/archived:** Grey

### Payment Status
- **Paid:** Success
- **Pending:** Info
- **Overdue:** Danger
- **Partial:** Warning

### Compliance Status
- **Compliant (DBS valid, safeguarding current):** Success
- **Expiring soon (under 30 days):** Warning
- **Expired:** Danger
- **Not required:** Grey

### Session Attendance
- **Present:** Success
- **Absent (notified):** Grey
- **Absent (no notice):** Warning

## Usage Guidelines

### Do

- **Canvas (`bg-canvas`):** main app background, behind all cards and content.
- **Surface (`bg-surface`):** card, modal and dropdown backgrounds.
- **Deep teal (`bg-dark-primary`):** sidebar, top bar, dark cards.
- **Mint (`bg-brand`):** primary buttons, active nav, focus indicators, form input focus borders, selected checkboxes.
- **Coral (`bg-coral`):** accent CTAs and attention highlights.
- **Lime (`text-lime`):** chart accent highlights only.

### Don't

- **Mint:** never for headings, never as body text on light surfaces, never for large light backgrounds.
- **Coral:** never for body text, never for large fills.
- **Lime:** never for buttons, navigation, links or form inputs.
- **Canvas + Surface:** don't use the same colour for card and background; keep a contrast step.
- Never use raw hex (`bg-[#...]`) or foreign greys in components.

## Accessibility Contrast Requirements

### WCAG 2.1 AA Minimums
- **Normal text (under 18px):** 4.5:1 contrast ratio
- **Large text (18px or larger, or 14px bold):** 3:1 contrast ratio
- **UI components:** 3:1 contrast ratio

### Guidance
- Graphite text (`#39393A`) on canvas (`#E6E6E6`) and on surface (`#F0F0F0`) passes AA comfortably for body text.
- Mint (`#85FFC7`) reads well on deep teal (`#0F2D2D`); use mint on dark surfaces, not as text on light surfaces.
- Lime (`#E8F059`) has very low contrast on the light canvas. Use it for chart accents only, never for text.

## Code Examples

### React/TypeScript

```tsx
// Payment status badge (semantic tokens)
<span className={cn(
  'px-3 py-1 rounded-full text-sm font-medium',
  status === 'paid' && 'bg-success/15 text-text-primary',
  status === 'pending' && 'bg-info/15 text-info',
  status === 'overdue' && 'bg-danger/15 text-danger'
)}>
  {status}
</span>

// Primary call to action: use the Button primitive
<Button variant="brand">View all members</Button>

// Accent call to action
<Button variant="coral">Send reminder</Button>

// Dashboard stat (tabular numerals, graphite text)
<div className="text-5xl font-bold text-text-primary tabular-nums">
  £2,450
</div>
```

## Common Mistakes

### Wrong
```html
<!-- Raw hex and a foreign grey -->
<button class="bg-[#85FFC7] text-gray-900">Click Me</button>

<!-- Lime used for an interactive element -->
<a class="text-lime" href="/members">View all members</a>
```

### Correct
```html
<!-- Tokens only; mint is interactive -->
<button class="bg-brand text-dark-primary font-semibold rounded-button">Click Me</button>

<!-- Mint for links/interaction -->
<a class="text-brand hover:underline" href="/members">View all members</a>
```

## Testing Checklist

When reviewing colours in Swimly:

- [ ] Is mint used only for interactive elements?
- [ ] Is coral used for accent CTAs and attention, not body text?
- [ ] Is lime used only for data visualisation accents?
- [ ] Do all text colours pass WCAG AA contrast (4.5:1 or 3:1)?
- [ ] Are semantic colours (success/warning/danger/info) used consistently?
- [ ] Do cards contrast with their background (canvas vs surface)?
- [ ] Are there any raw hex values or foreign greys (`gray-`, `slate-`, `zinc-`, `neutral-`, `stone-`)?

---

**Next:** [Components](./components.md) for detailed UI component specifications.
