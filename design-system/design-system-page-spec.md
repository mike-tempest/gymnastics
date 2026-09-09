# Swimly Design System Documentation Page

**Route:** `/design-system`  
**Purpose:** Developer reference, design QA, consistency enforcement, onboarding  
**Access:** Internal only (committee/admin users)

---

## Page Structure

### Header

```
Swimly Design System
Last updated: March 2026
```

---

## 1. Colour Palette

### Primary Colours

**Canvas** `#F0F0EC`  
Muted sage green background. Main app background colour.  
Usage: Page backgrounds, container backgrounds.

**Surface** `#FAFAF8`  
Card and panel backgrounds.  
Usage: Cards, modals, elevated surfaces, form containers.

**Dark Primary** `#121216`  
Near-black for cards, sidebar, navigation.  
Usage: Navigation bars, sidebars, dark cards, headers.

**Brand Green** `#00FF90`  
Interactive elements colour.  
Usage: Buttons, links, active states, navigation highlights, focus states.  
✅ DO: Use for all interactive elements  
❌ DO NOT: Use for non-interactive decorations

**Lime** `#E8F059`  
Data accent colour ONLY.  
Usage: Statistical numbers, chart highlights, data visualisations.  
✅ DO: Use for numerical data emphasis  
❌ DO NOT: Use for navigation or interactive elements

### Semantic Colours

**Success/Active Green**  
Usage: Active members, paid invoices, compliant status, present attendance.

**Warning Amber**  
Usage: Expiring soon, partial payment, pending approval.

**Error/Alert Red**  
Usage: Overdue payments, expired credentials, non-compliant, absent swimmers.

**Inactive Grey**  
Usage: Archived records, disabled states, placeholder text.

### Contrast Requirements

All text must meet WCAG 2.1 AA minimum:

- Normal text: ≥ 4.5:1 contrast ratio
- Large text (18pt+): ≥ 3:1 contrast ratio
- Interactive elements: ≥ 3:1 against background

---

## 2. Typography

### Typefaces

**Headings: DM Serif Display**  
Serif typeface for editorial feel.  
Font loading: `display: swap`  
Usage: Page titles, section headings, card titles.

**Body: Inter**  
Clean sans-serif for readability.  
Variable: `var(--font-inter)`  
Usage: All body text, form labels, navigation, UI copy.

**Data/Numbers: Tabular numerals**  
Monospaced numerals for alignment.  
Usage: Financial tables, swim times, data grids.

### Scale

```
H1: 32px / 2rem (DM Serif Display, semibold)
H2: 24px / 1.5rem (DM Serif Display, semibold)
H3: 20px / 1.25rem (DM Serif Display, medium)
Body: 16px / 1rem (Inter, regular)
Small: 14px / 0.875rem (Inter, regular)
Caption: 12px / 0.75rem (Inter, regular)
```

### Mobile Minimum

Body text must be **16px minimum** on mobile to prevent iOS zoom on focus.

### Special Formats

**Swim Times:** MM:SS.ss format (e.g., 1:05.23)  
**Dates:** DD/MM/YYYY (British format)  
**Currency:** £ symbol, 2 decimal places  
**Distances:** Metres (m), not yards

---

## 3. Component Library

### Navigation

**Desktop Sidebar**

- Vertical navigation
- Role-based sections
- Active state: Brand Green highlight
- Hover state: Subtle background change

**Mobile Bottom Tab Bar**

- Maximum 5 tabs
- Large tap targets (44px minimum)
- Active state: Brand Green icon + label
- Icons with labels (no icon-only)

**Breadcrumbs** (Admin areas only)

- Shows page hierarchy
- Separator: `/`
- Current page: not a link

### Cards

**Member Card**

```
┌─────────────────────────┐
│ John Smith             │
│ Development Squad      │
│ SE: 1234567           │
│ [Active badge]        │
└─────────────────────────┘
```

Fields: Name, squad badge, SE number, status indicator.

**Swimmer Card** (Parent view)

```
┌─────────────────────────┐
│ Kassidy Smith          │
│ Development Squad      │
│ Next: Tue 18:00        │
│ Recent PB: 1:05.23     │
└─────────────────────────┘
```

Fields: Name, squad, next session, recent PB.

**Payment Card**

```
┌─────────────────────────┐
│ £45.00                 │
│ 15/03/2026             │
│ [Paid badge]           │
│ [Receipt link]         │
└─────────────────────────┘
```

Fields: Amount, date, status badge, receipt link.

**Session Card**

```
┌─────────────────────────┐
│ 18:00 - 19:30          │
│ Kent Weald Pool        │
│ Development Squad      │
│ Coach: Sarah Jones     │
│ 18/22 present          │
└─────────────────────────┘
```

Fields: Time, pool, squad, coach, attendance count.

### Tables

**Features:**

- Sortable columns (arrow indicators)
- Filterable (search/filter UI above table)
- Row actions: Kebab menu (⋮) visible, not hidden
- Bulk selection: Checkbox column + floating action bar
- Responsive: Stacks into cards on mobile (<768px)

**Header Row:**

- Bold text
- Sortable indicator (↑↓)
- Background: Surface colour

**Data Rows:**

- Zebra striping (optional, subtle)
- Hover state: Slight background change
- Selected state: Brand Green tint

### Forms

**Principles:**

- Progressive disclosure (show fields as needed)
- Inline validation (real-time, not just on submit)
- Smart defaults (UK country, DD/MM/YYYY dates)
- Multi-step wizards for complex flows

**Input Fields:**

- Always visible labels (not placeholder-only)
- Focus state: Brand Green border
- Error state: Red border + error message below
- Helper text: Grey, below input

**Buttons:**

- Primary: Brand Green background, white text
- Secondary: Outline style, Brand Green border
- Danger: Red background, white text
- Disabled: Grey, not interactive

**Form Layout:**

- Single column on mobile
- Two columns on desktop (related fields grouped)
- Required fields: Asterisk (\*) on label
- Optional fields: "(optional)" in grey

### Notifications & Alerts

**Toast Notifications** (Temporary)

- Success: Green background
- Error: Red background
- Info: Brand Green background
- Position: Top-right on desktop, top-centre on mobile
- Auto-dismiss after 5 seconds

**Alert Banners** (Persistent)

- Warning: Amber background
- Critical: Red background
- Info: Brand Green background
- Position: Top of page, full-width
- Dismissible: X button on right

**Badge Counts**

- Position: Top-right of nav item
- Background: Red (urgent) or Brand Green (info)
- Text: White, bold
- Minimum size: 20px circle

---

## 4. Spacing & Layout

### Spacing Scale

```
xs: 4px / 0.25rem
sm: 8px / 0.5rem
md: 16px / 1rem
lg: 24px / 1.5rem
xl: 32px / 2rem
2xl: 48px / 3rem
```

### Container Widths

- **Mobile:** 100% (with 16px padding)
- **Tablet:** 720px max-width
- **Desktop:** 1200px max-width

### Grid System

- 12-column grid on desktop
- 4-column grid on tablet
- Single column on mobile
- Gutter: 16px (sm) on mobile, 24px (lg) on desktop

### Whitespace Philosophy

"Let the content breathe." Generous whitespace reduces cognitive load. Swimming pools are chaotic — Swimly should feel calm.

---

## 5. Accessibility Standards

### WCAG 2.1 AA Compliance

**Colour Contrast:**

- Normal text: ≥ 4.5:1 ratio
- Large text (18pt+): ≥ 3:1 ratio
- Interactive elements: ≥ 3:1 against background
- **Test all colour combinations** before shipping

**Keyboard Navigation:**

- All interactive elements must be keyboard accessible
- Logical tab order (top to bottom, left to right)
- Visible focus indicators (Brand Green outline)
- Skip links for navigation bypass

**Screen Readers:**

- Semantic HTML (headings, lists, landmarks)
- Alt text on all images
- ARIA labels where semantic HTML insufficient
- Form labels always associated with inputs
- Error messages linked to fields (aria-describedby)

**Touch Targets:**

- Minimum 44px × 44px on mobile
- Especially critical for coach poolside use (wet hands)
- Spacing between targets to prevent mis-taps

**Focus Indicators:**

- Always visible (no `outline: none` without replacement)
- Brand Green colour for consistency
- 2px solid outline minimum
- Offset from element for clarity

**Form Accessibility:**

- Labels always visible (not placeholder-only)
- Error messages descriptive and specific
- Required fields indicated (asterisk + aria-required)
- Field validation announced to screen readers
- Multi-step forms: current step announced

---

## 6. Responsive Breakpoints

```
Mobile:   320px - 767px  (primary for coaches/parents)
Tablet:   768px - 1023px (useful poolside)
Desktop:  1024px+        (primary for committee admin)
```

### Design Mobile-First

Start with mobile layout, enhance for larger screens.  
Most parents and coaches use phones primarily.

### Critical Mobile Considerations

- **Coach poolside:** Bright sunlight, wet hands, one-handed use
- **Parent between tasks:** Quick checks during school run
- Touch targets minimum 44px
- High contrast for outdoor visibility
- Offline capability for poolside sessions

---

## 7. Voice & Tone

### Writing Principles

**British English:**

- Colour (not color)
- Organise (not organize)
- Metres (not meters/yards)
- Dates: DD/MM/YYYY
- Terms: Autumn (not Fall), swimming pool (not natatorium)

**Calm & Clear:**

- Short sentences
- Active voice
- No jargon without explanation
- Helpful errors (not "Error 500")
- Example: "We could not process your payment. Please check your card details and try again."

**Volunteer-Friendly:**

- Assume zero training
- Explain swimming-specific terms
- Be encouraging, not condescending
- Example: "SE membership number (you can find this on your Swim England member card)"

**Persona-Appropriate:**

- Treasurer: Professional, precise, data-focused
- Coach: Quick, actionable, poolside-ready
- Parent: Warm, reassuring, simple
- Committee: Governance-focused, audit-ready

---

## 8. DO NOT Rules

### ❌ Colour Usage

- DO NOT use Lime (#E8F059) for navigation or interactive elements (data accents only)
- DO NOT use bright accent colours on Canvas background (breaks calm aesthetic)
- DO NOT use pure black (#000000) — use Dark Primary (#121216) instead

### ❌ Layout

- DO NOT show swim parents financial admin data
- DO NOT show coaches the full member database (squad only)
- DO NOT make important actions more than 2 taps away on mobile
- DO NOT design hover-only interactions (coaches use touchscreens)

### ❌ Typography

- DO NOT use font sizes below 14px (12px minimum for captions only)
- DO NOT use American English or date formats
- DO NOT use swimming jargon without explanation in parent-facing UI

### ❌ Accessibility

- DO NOT remove focus indicators without replacement
- DO NOT use colour alone to convey information (add icons/text)
- DO NOT use placeholder text as the only label
- DO NOT create tap targets smaller than 44px on mobile

### ❌ Forms

- DO NOT require training to use basic features
- DO NOT show all fields at once (use progressive disclosure)
- DO NOT validate only on submit (inline validation required)

---

## 9. Component States

### Interactive Elements

All buttons, links, and interactive components must have:

1. **Default state** — Normal appearance
2. **Hover state** — Subtle background/colour change (desktop only)
3. **Active/Pressed state** — Darker version of hover
4. **Focus state** — Brand Green outline (keyboard navigation)
5. **Disabled state** — Grey, reduced opacity, not clickable

### Data States

All data displays must handle:

1. **Loading state** — Skeleton screens or spinner
2. **Empty state** — Helpful message + action (not just blank)
3. **Error state** — Clear error message + recovery action
4. **Success state** — Confirmation message

Example empty state:

```
No swimmers in this squad yet.
[Add your first swimmer]
```

---

## 10. Testing Checklist

Before shipping any UI:

- [ ] Colour contrast meets WCAG 2.1 AA (test with tool)
- [ ] Works on mobile (iPhone SE size minimum: 320px)
- [ ] Works with keyboard navigation only
- [ ] Works with screen reader (VoiceOver/NVDA)
- [ ] All interactive elements have focus indicators
- [ ] Form validation is inline and accessible
- [ ] Error messages are descriptive and actionable
- [ ] British English throughout (spell check)
- [ ] Tap targets ≥ 44px on mobile
- [ ] Tested in bright light (poolside simulation)
- [ ] Works offline (if applicable)
- [ ] Loading/empty/error states designed

---

## Implementation Notes

### CSS Variables

Define design tokens as CSS custom properties:

```css
:root {
  /* Colours */
  --canvas: #f0f0ec;
  --surface: #fafaf8;
  --dark-primary: #121216;
  --brand-green: #00ff90;
  --lime: #e8f059;

  /* Typography */
  --font-heading: 'DM Serif Display', serif;
  --font-body: 'Inter', sans-serif;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
}
```

### Component Library

Create reusable React components for all patterns:

- `<Button variant="primary|secondary|danger" />`
- `<Card type="member|swimmer|payment|session" />`
- `<Badge status="active|warning|error|inactive" />`
- `<Table sortable filterable />`
- `<FormInput label error helper />`

### Accessibility Utilities

- Focus trap for modals
- Skip links component
- Screen reader only text utility class
- Aria live regions for dynamic content

---

## Version History

**1.0 — March 2026**  
Initial design system documentation.  
Based on February 2026 design audits and production implementation.

---

## Questions?

This design system is a living document. If you encounter:

- A component not documented here
- A use case not covered
- Conflicting guidance
- Accessibility concerns

Contact: Mike Tempest (Product/Design Lead)
