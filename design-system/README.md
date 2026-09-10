# Tumblebase Design System

**Version:** 1.0  
**Last Updated:** 7 March 2026  
**Owner:** Tumblebase Design (swimly-design agent)

## Purpose

This design system ensures consistency across all Tumblebase interfaces: parent portal, coach views, committee dashboards, and admin panels. It exists to make volunteers' lives easier through calm, predictable, accessible design.

## Core Principles

### 1. Volunteer-Proof Simplicity

Every screen answers one question: "What do I need to do here?" No feature should require a manual. If it needs explaining, redesign it.

### 2. Role-Appropriate Views

Different users need different things. Don't show the treasurer coaching rotas. Don't show parents billing admin. Role-based views are fundamental.

### 3. Poolside-Ready

Coaches use this on phones, poolside, often with wet hands. Large tap targets, high contrast, offline capability, one-handed operation.

### 4. Trust Through Transparency

Volunteers are accountable to parents and committees. Every transaction, every change, every compliance record must be visible and auditable.

### 5. British, Not American

UI copy in British English. Date formats DD/MM/YYYY. Currency in £. Distances in metres. Cultural alignment matters for trust.

### 6. Calm, Not Cluttered

Swimming pools are chaotic enough. Tumblebase should feel calm, organised, and in control. Muted colours, clear typography, generous whitespace.

## Design System Structure

- [Typography](./typography.md) - Typefaces, hierarchy, sizes, accessibility
- [Colour System](./colour-system.md) - Canvas, surfaces, brand colours, semantic colours, usage rules
- [Components](./components.md) - Cards, navigation, tables, forms, notifications
- [Layout Patterns](./layout-patterns.md) - Dashboard structures, responsive behaviour, persona-specific layouts
- [Accessibility](./accessibility.md) - WCAG 2.1 AA compliance, keyboard nav, screen readers
- [Voice & Tone](./voice-and-tone.md) - Writing guidelines, error messages, British English standards

## Quick Reference

### Colour Palette (Most Common)

- **Canvas:** `#F0F0EC` (muted sage background)
- **Surface:** `#FAFAF8` (card backgrounds)
- **Dark Primary:** `#121216` (cards, sidebar, nav)
- **Brand Green:** `#00FF90` (interactive: buttons, links, active states)
- **Lime:** `#E8F059` (data accents ONLY: numbers, chart highlights)

### Typography

- **Headings:** DM Serif Display (serif, editorial feel)
- **Body:** Inter (clean sans-serif, 16px minimum on mobile)
- **Data/Numbers:** Tabular (monospaced numerals for tables, times)

### Responsive Breakpoints

- **Mobile (primary for coaches/parents):** 320-767px
- **Tablet (useful poolside):** 768-1023px
- **Desktop (primary for committee admin):** 1024px+

### Minimum Touch Targets

- **Interactive elements:** 44×44px minimum (poolside with wet hands)
- **Critical actions:** 48×48px or larger

## Using This Design System

1. **Check component specs first** - Most common UI patterns already documented
2. **Follow accessibility guidelines** - WCAG 2.1 AA is non-negotiable
3. **Test mobile experience** - Coaches and parents are mobile-first
4. **Use British English** - Dates, currency, terminology must be UK-standard
5. **When in doubt, simplify** - Volunteers don't have time for complexity

## Anti-Patterns (Never Do This)

- Don't show swim parents financial admin data
- Don't require training to use basic features
- Don't use American English or date formats anywhere
- Don't design hover-only interactions (coaches use touchscreens)
- Don't make important actions more than 2 taps away on mobile
- Don't show the full member database to coaches (squad only)
- Don't use swimming jargon in parent-facing UI without explanation
- Don't design for "power users" first — design for volunteers first

## Maintenance

This design system is living documentation. Update it when:

- New components are created
- Design decisions are made
- User research reveals patterns
- Accessibility standards evolve

To propose changes, create a task in Workshop tagged `design-system`.

---

**Next:** Start with [Typography](./typography.md) to understand the foundation of all text in Tumblebase.
