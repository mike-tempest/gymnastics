# Swimly Design System — Component Library

Last updated: 15 March 2026

## Overview

This component library maintains visual and interaction consistency as Swimly scales from 1 to 10 clubs during Q2 2026. Every component follows the volunteer-proof simplicity principle: if a 65-year-old treasurer cannot use it in 5 minutes, it is too complex.

## Core Principles

1. **Mobile-First**: 70%+ usage on mobile devices (parents between school pickup and dinner, coaches poolside with wet hands)
2. **Touch-Friendly**: Minimum 44px tap targets (WCAG 2.5.5)
3. **High Contrast**: Readable in bright poolside sunlight
4. **Offline-Ready**: Progressive enhancement, works without connection
5. **One-Handed Operation**: Key actions within thumb reach zone
6. **Accessible**: WCAG 2.1 AA minimum for all components

## Design Tokens

### Colour Palette (Actual Implementation)

```css
/* Canvas & Surfaces */
--canvas: #F0F0EC;        /* Muted sage green background */
--surface: #FAFAF8;       /* Card backgrounds */
--dark-primary: #121216;  /* Near-black for cards, sidebar, nav */

/* Brand Colours */
--brand-green: #00FF90;   /* Interactive: buttons, links, active states, nav */
--lime: #E8F059;          /* Data accents ONLY: stat numbers, chart highlights */

/* Semantic Colours */
--green-status: #22C55E;  /* Active, paid, compliant, present */
--amber-status: #F59E0B;  /* Warning, expiring soon, partial */
--red-status: #EF4444;    /* Overdue, expired, non-compliant, absent */
--grey-status: #9CA3AF;   /* Inactive, archived, placeholder */
```

**Usage Rules:**
- Brand green for all interactive elements (buttons, nav, links, active states)
- Lime ONLY for data visualisation (stat numbers, chart highlights) — never for navigation
- This is an editorial sage/lime aesthetic, NOT aquatic blue
- Inspired by Dribbble magazine layouts

### Typography

```css
/* Headings */
--font-heading: 'DM Serif Display', serif; /* Elegant, editorial feel */

/* Body */
--font-body: 'Inter', sans-serif;          /* Clean, 16px minimum on mobile */

/* Data/Numbers */
--font-data: 'Inter', tabular-nums;        /* Monospaced numerals for tables */
```

**Loading Strategy:**
- DM Serif Display: `display: 'swap'`
- Body uses `var(--font-inter)`
- Swim times format: MM:SS.ss (e.g., 1:05.23)

### Spacing Scale

```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */
```

### Responsive Breakpoints

```css
--mobile: 320px - 767px;    /* Primary for coaches/parents */
--tablet: 768px - 1023px;   /* Useful poolside */
--desktop: 1024px+;         /* Primary for committee admin */
```

**Design approach**: Mobile-first, enhance for desktop.

## Component Specifications

### 1. Navigation

#### Sidebar Navigation (Desktop)

**Usage**: Desktop committee admin navigation  
**Location**: Left side, persistent  
**Width**: 240px collapsed, 280px expanded

**States:**
- Default
- Hover (brand-green background)
- Active (brand-green background, darker text)
- Disabled (grey-status)

**Accessibility:**
- Keyboard navigable (Tab, Enter)
- Screen reader labels
- Skip to content link
- Focus indicators visible

**Props:**
```typescript
interface SidebarNavProps {
  items: NavItem[];
  activeRoute: string;
  collapsed?: boolean;
  role: 'admin' | 'coach' | 'parent';
}
```

#### Bottom Tab Bar (Mobile)

**Usage**: Mobile parent/coach navigation  
**Location**: Fixed bottom  
**Height**: 64px (56px + safe area)  
**Max tabs**: 5

**Touch Targets:**
- Minimum 44px × 44px per WCAG 2.5.5
- Thumb-friendly spacing (12px between targets)

**States:**
- Default (grey-status icon + label)
- Active (brand-green icon + label)
- Badge notification (red-status dot, 8px diameter)

**Accessibility:**
- Aria-label for each tab
- Role="navigation"
- Active state announced

**Props:**
```typescript
interface BottomTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  role: 'parent' | 'coach';
}
```

### 2. Cards

#### Member Card

**Usage**: Display individual member in lists  
**Variants**: Compact (list view), Expanded (detail view)

**Anatomy:**
- Avatar (40px × 40px, fallback initials)
- Primary text (member name, 16px, font-body)
- Secondary text (squad, SE number, 14px, grey)
- Status badge (right-aligned)
- Action menu (kebab icon, 44px tap target)

**States:**
- Default
- Hover (subtle surface lift)
- Selected (brand-green border)
- Disabled (grey overlay)

**Accessibility:**
- Semantic HTML (article or li)
- Keyboard navigable
- Screen reader announces: name, squad, status

**Props:**
```typescript
interface MemberCardProps {
  member: Member;
  variant: 'compact' | 'expanded';
  selected?: boolean;
  onSelect?: (id: string) => void;
  actions?: Action[];
}
```

#### Swimmer Card (Parent View)

**Usage**: Parent dashboard — one card per child  
**Priority**: High (primary parent interaction)

**Anatomy:**
- Swimmer photo (80px × 80px circle, fallback initials)
- Name (18px, font-heading)
- Squad badge (brand-green pill)
- Next session (time + pool, 14px)
- Recent PB (if exists, lime accent)
- Quick actions (attendance, payments, messages)

**Mobile Optimisation:**
- Card stacks vertically (320px min width)
- Touch targets ≥ 44px
- One-handed thumb reach for actions

**Accessibility:**
- Heading hierarchy (h2 for name)
- Action buttons have aria-labels
- PB change announced to screen readers

**Props:**
```typescript
interface SwimmerCardProps {
  swimmer: Swimmer;
  nextSession?: Session;
  recentPB?: PersonalBest;
  actions: Action[];
}
```

#### Payment Card

**Usage**: Financial transaction display  
**Contexts**: Treasurer dashboard, parent payment history

**Anatomy:**
- Amount (24px, font-data, tabular-nums)
- Date (14px, grey-status)
- Status badge (paid/pending/overdue)
- Receipt link (if paid)
- Action (pay now / view details)

**Status Colours:**
- Paid: green-status
- Pending: amber-status
- Overdue: red-status

**Accessibility:**
- Amount announced as currency (£49.00)
- Status semantically marked
- Receipt download keyboard accessible

**Props:**
```typescript
interface PaymentCardProps {
  payment: Payment;
  showActions?: boolean;
  onPayNow?: (id: string) => void;
  onViewReceipt?: (id: string) => void;
}
```

### 3. Forms

#### Text Input

**Touch Targets**: ≥ 44px height on mobile  
**Labels**: Always visible (never placeholder-only)  
**Validation**: Inline, not just on submit

**States:**
- Default
- Focus (brand-green border, 2px)
- Error (red-status border + message)
- Success (green-status border + checkmark)
- Disabled (grey overlay, not editable)

**Mobile Optimisation:**
- Correct keyboard types (`inputMode="email"`, `inputMode="numeric"`)
- Autocomplete attributes
- Touch-friendly spacing (16px between fields)

**Accessibility:**
- Label → input association
- Error linked via aria-describedby
- Error message id matches describedby
- Required fields marked visually + semantically

**Props:**
```typescript
interface TextInputProps {
  label: string;
  type?: 'text' | 'email' | 'tel' | 'number';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  helpText?: string;
}
```

#### Checkbox

**Touch Target**: 44px × 44px minimum  
**Visual Size**: 20px × 20px checkbox  
**Padding**: 12px around visual for touch area

**States:**
- Unchecked
- Checked (brand-green fill, white checkmark)
- Indeterminate (for "select all" scenarios)
- Disabled

**Large Variant (Poolside Register):**
- 32px × 32px visual
- 56px × 56px touch target
- High contrast for outdoor use

**Accessibility:**
- Native checkbox input
- Label wraps checkbox + text
- Keyboard toggle (Space)
- Screen reader announces checked state

**Props:**
```typescript
interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  variant?: 'default' | 'large'; // large for coach poolside
}
```

### 4. Tables

#### Data Table

**Usage**: Member lists, payment history, attendance records  
**Mobile Strategy**: Stack into cards below 768px

**Anatomy (Desktop):**
- Header row (font-heading, 14px, grey-status)
- Data rows (font-body, 16px)
- Sortable columns (click header, icon indicates direction)
- Row actions (kebab menu, right-aligned)
- Bulk selection (checkbox in header + rows)

**Sorting:**
- Click header to sort ascending
- Click again to sort descending
- Icon indicates current sort (↑ or ↓)

**Mobile Stacking:**
- Each row becomes a card
- Key data promoted (name, status, amount)
- Secondary data collapsible
- Actions remain accessible

**Accessibility:**
- Semantic table markup (`<table>`, `<thead>`, `<tbody>`)
- Sortable headers announce sort direction
- Row actions keyboard accessible
- Screen reader announces row count

**Props:**
```typescript
interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  sortable?: boolean;
  selectable?: boolean;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  onSelect?: (ids: string[]) => void;
  rowActions?: (row: any) => Action[];
}
```

### 5. Buttons

#### Primary Button

**Usage**: Main actions (Save, Submit, Pay Now)  
**Colour**: brand-green background, dark-primary text

**Sizes:**
- Small: 32px height, 12px padding
- Medium: 40px height, 16px padding (default)
- Large: 48px height, 20px padding (mobile primary actions)

**Touch Targets**: Minimum 44px height on mobile

**States:**
- Default
- Hover (darker green)
- Active (pressed state, even darker)
- Loading (spinner replaces text)
- Disabled (grey-status background, no interaction)

**Accessibility:**
- Clear action text (not "Click here")
- Disabled state announced
- Loading state announced

**Props:**
```typescript
interface ButtonProps {
  children: React.ReactNode;
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}
```

#### Secondary Button

**Usage**: Alternative actions (Cancel, Back, View Details)  
**Style**: brand-green border, transparent background, brand-green text

#### Ghost Button

**Usage**: Tertiary actions, inline links  
**Style**: No border, no background, brand-green text, underline on hover

#### Danger Button

**Usage**: Destructive actions (Delete, Remove, Cancel Subscription)  
**Colour**: red-status background, white text  
**Confirmation**: Always require confirmation modal

### 6. Badges

#### Status Badge

**Usage**: Payment status, membership status, compliance status  
**Size**: 24px height, 8px horizontal padding  
**Typography**: 12px, font-body, uppercase

**Variants:**
- Success (green-status background)
- Warning (amber-status background)
- Error (red-status background)
- Neutral (grey-status background)

**Accessibility:**
- Semantic status communicated to screen readers
- Not colour-only (text + icon when critical)

**Props:**
```typescript
interface StatusBadgeProps {
  label: string;
  variant: 'success' | 'warning' | 'error' | 'neutral';
  icon?: React.ReactNode;
}
```

#### Squad Badge

**Usage**: Display swimmer squad membership  
**Style**: brand-green background, dark-primary text  
**Shape**: Pill (fully rounded ends)

### 7. Alerts & Notifications

#### Alert Banner

**Usage**: System messages, errors, warnings, success confirmations  
**Placement**: Top of page, fixed or inline

**Variants:**
- Info (brand-green background, dark-primary text)
- Success (green-status background)
- Warning (amber-status background)
- Error (red-status background)

**Anatomy:**
- Icon (left, 20px)
- Message (font-body, 14px)
- Dismiss button (right, 44px touch target)

**Dismissal:**
- Auto-dismiss after 5 seconds (success/info)
- Persist until dismissed (warning/error)

**Accessibility:**
- role="alert" for screen readers
- Focus management on critical errors
- Keyboard dismissal (Escape key)

**Props:**
```typescript
interface AlertBannerProps {
  message: string;
  variant: 'info' | 'success' | 'warning' | 'error';
  dismissible?: boolean;
  autoDismiss?: boolean;
  onDismiss?: () => void;
}
```

#### Toast Notification

**Usage**: Action confirmations (Saved, Sent, Deleted)  
**Placement**: Bottom-right on desktop, bottom-center on mobile  
**Duration**: 3 seconds default

**Accessibility:**
- Announced to screen readers
- Does not block content
- Keyboard dismissal

### 8. Modals

#### Modal Dialog

**Usage**: Confirmations, detail views, forms  
**Size**: Small (400px), Medium (600px), Large (800px)

**Anatomy:**
- Header (title + close button)
- Content (scrollable if needed)
- Footer (actions, right-aligned)

**Behaviour:**
- Backdrop click to dismiss (optional)
- Escape key to close
- Focus trap (keyboard stays inside modal)
- Return focus to trigger on close

**Mobile Adaptation:**
- Full-screen on mobile (< 768px)
- Slide up from bottom
- Close button top-right

**Accessibility:**
- role="dialog"
- aria-labelledby points to title
- Focus management on open/close
- Inert background content

**Props:**
```typescript
interface ModalProps {
  title: string;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
  size?: 'small' | 'medium' | 'large';
  actions?: Action[];
}
```

### 9. Loading States

#### Skeleton Screen

**Usage**: Content loading placeholders  
**Style**: Animated gradient (grey-status to lighter grey)

**Patterns:**
- Text lines: 16px height, varying widths
- Cards: Full card outline with pulsing background
- Tables: Row outlines with column shimmer

**Accessibility:**
- aria-busy="true" on loading container
- Screen reader announcement: "Loading content"

#### Spinner

**Usage**: Button loading, async actions  
**Size**: 16px (small), 24px (medium), 32px (large)  
**Colour**: Inherits from context (brand-green in primary button, grey in neutral)

### 10. Offline State Indicators

#### Offline Banner

**Usage**: Notify user of offline status  
**Placement**: Top of screen, persistent  
**Style**: Amber-status background

**Message:**
> "You are offline. Changes will sync when reconnected."

**Sync Status:**
- "Last synced: 2 minutes ago"
- "Syncing..." (when reconnected)
- "Synced" (confirmation, auto-dismiss after 2 seconds)

**Accessibility:**
- Persistent role="status"
- Announced when offline status changes

## Responsive Behaviour

### Mobile-First Grid

```css
/* Mobile: Stack vertically */
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
}

/* Tablet: 2 columns */
@media (min-width: 768px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop: 3 columns */
@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Touch-Friendly Spacing

- Minimum 44px touch targets
- 12px spacing between interactive elements
- Bottom navigation 64px height (accounts for iOS safe area)

### One-Handed Thumb Zones

**Priority Actions (Mobile):**
- Bottom third of screen (natural thumb rest)
- Avoid top-left corner (requires two hands)

## Accessibility Checklist

### Every Component Must:

- [ ] Support keyboard navigation
- [ ] Have visible focus indicators
- [ ] Use semantic HTML
- [ ] Include ARIA labels where needed
- [ ] Meet WCAG 2.1 AA contrast ratios (4.5:1 text, 3:1 UI components)
- [ ] Work with screen readers (VoiceOver, NVDA, JAWS)
- [ ] Handle errors accessibly (linked to fields, announced)
- [ ] Provide text alternatives for icons
- [ ] Respect prefers-reduced-motion
- [ ] Support zoom up to 200%

### Form-Specific:

- [ ] Labels always visible (never placeholder-only)
- [ ] Required fields marked visually + semantically
- [ ] Errors linked to fields via aria-describedby
- [ ] Error messages descriptive ("Email address required", not "Invalid field")
- [ ] Autocomplete attributes for known fields
- [ ] Correct input types (tel, email, number)

### Interactive Components:

- [ ] Touch targets ≥ 44px × 44px
- [ ] Sufficient spacing between targets (12px minimum)
- [ ] States communicated beyond colour (text, icons, patterns)
- [ ] Loading states announced to screen readers
- [ ] Disabled states not keyboard-focusable

## Code Examples

### Button Component (React + TypeScript)

```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'medium', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${styles[size]}`}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
        <span className={loading ? styles.loadingText : ''}>{children}</span>
      </button>
    );
  }
);
```

### Text Input Component

```typescript
import { InputHTMLAttributes, forwardRef, useId } from 'react';
import styles from './TextInput.module.css';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helpText?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, helpText, required, ...props }, ref) => {
    const inputId = useId();
    const errorId = useId();
    const helpId = useId();

    return (
      <div className={styles.field}>
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-label="required">*</span>}
        </label>
        
        {helpText && <p id={helpId} className={styles.help}>{helpText}</p>}
        
        <input
          ref={ref}
          id={inputId}
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helpText ? helpId : undefined}
          required={required}
          {...props}
        />
        
        {error && (
          <p id={errorId} className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
```

## Do's and Don'ts

### Do:

✓ Design for wet hands poolside  
✓ Test in bright sunlight  
✓ Prioritise one-handed operation on mobile  
✓ Use large touch targets (≥ 44px)  
✓ Provide clear loading states  
✓ Support offline mode gracefully  
✓ Use semantic HTML  
✓ Test with screen readers  
✓ Respect British English (colour not color, favour not favor)  

### Don't:

✗ Use small touch targets (< 44px)  
✗ Rely on hover states for mobile  
✗ Hide important actions in nested menus  
✗ Use colour alone to convey status  
✗ Make volunteers read documentation to understand UI  
✗ Use swimming jargon without explanation (parent-facing)  
✗ Force two-handed operation on mobile  
✗ Design for "power users" first — design for volunteers  

## Next Steps

1. **Audit Existing Components**: Compare current implementation against this spec
2. **Close Gaps**: Prioritise accessibility and mobile touch target fixes
3. **Storybook Setup**: Create interactive component playground
4. **Designer Handoff**: Figma component library aligned with code
5. **Testing**: Real-device testing (iPhone, Android, iPad poolside)

---

**Questions or suggestions?** Update this file via pull request or raise in #design Slack channel.
