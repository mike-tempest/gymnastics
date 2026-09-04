# Components

## Overview

Swimly components are built for volunteers who don't have time for complexity. Each component should be self-explanatory and work reliably across desktop, tablet, and mobile (especially mobile for coaches and parents).

---

## Cards

Cards are the primary content container in Swimly. Every entity (member, swimmer, payment, session) gets represented as a card.

### Base Card Anatomy
```
┌─────────────────────────────────────┐
│ [Icon/Badge]    [Title]     [Action]│
│                                      │
│ [Primary content / details]          │
│                                      │
│ [Metadata: dates, counts, status]   │
└─────────────────────────────────────┘
```

### Card Variants

#### Member Card (Committee View)
**Purpose:** Display club member summary for committee dashboards

**Structure:**
- **Header:** Name (H4), Squad badge, SE number
- **Body:** Contact info, parent names, membership status
- **Footer:** Payment status, last attendance, actions menu (⋮)

**States:**
- Default: White/surface background, subtle shadow
- Hover: Slight elevation increase, cursor pointer
- Selected: Brand green border, 2px
- Disabled: 50% opacity, no hover

**Code Example:**
```tsx
<div className="card p-4 hover:shadow-md transition-shadow">
  <div className="flex items-start justify-between mb-3">
    <div>
      <h4 className="font-semibold text-lg">Kassidy Tempest</h4>
      <span className="badge badge-primary">Development Squad</span>
    </div>
    <button className="btn-icon">⋮</button>
  </div>
  
  <div className="space-y-2 text-sm text-neutral-600">
    <p>SE: 1234567</p>
    <p>Parent: Mike Tempest</p>
  </div>
  
  <div className="flex items-center justify-between mt-3 pt-3 border-t">
    <span className="badge badge-success">Paid</span>
    <span className="text-xs text-neutral-500">Last session: 5 Mar</span>
  </div>
</div>
```

#### Swimmer Card (Parent View)
**Purpose:** Display swimmer summary for parents with multiple children

**Structure:**
- **Header:** Child name, age, squad
- **Body:** Next session time, upcoming galas
- **Footer:** Recent PBs, payment status

**Mobile Optimised:** Full-width on mobile, stacks on small screens

**Code Example:**
```tsx
<div className="card p-4 bg-surface">
  <div className="flex items-center gap-3 mb-3">
    <div className="w-12 h-12 rounded-full bg-brand-green flex items-center justify-center text-dark-primary font-bold">
      KT
    </div>
    <div>
      <h3 className="font-semibold">Kassidy Tempest</h3>
      <p className="text-sm text-neutral-600">Development Squad, Age 13</p>
    </div>
  </div>
  
  <div className="space-y-2 text-sm">
    <p><strong>Next session:</strong> Tue 18:00, Lane 3-6</p>
    <p><strong>Recent PB:</strong> 100m Free: 1:05.23 (↓ 2.1s)</p>
  </div>
</div>
```

#### Payment Card
**Purpose:** Display payment transaction for treasurers and parents

**Structure:**
- **Header:** Amount (tabular), date
- **Body:** Description, payer name
- **Footer:** Status badge, receipt link

**States:**
- Paid: Success green badge
- Pending: Info blue badge
- Overdue: Error red badge
- Failed: Error red badge + retry button

**Code Example:**
```tsx
<div className="card p-4">
  <div className="flex items-start justify-between mb-2">
    <div>
      <p className="text-2xl font-bold tabular-nums">£24.50</p>
      <p className="text-sm text-neutral-600">Monthly subscription</p>
    </div>
    <span className="badge badge-success">Paid</span>
  </div>
  
  <div className="text-sm space-y-1">
    <p className="text-neutral-600">Date: 15/03/2026</p>
    <p className="text-neutral-600">Payer: Mike Tempest</p>
  </div>
  
  <button className="btn-link mt-3 text-sm">Download receipt</button>
</div>
```

#### Session Card (Coach View)
**Purpose:** Display session details for poolside attendance

**Optimised for:** Mobile, one-handed use, large touch targets

**Structure:**
- **Header:** Session time, pool location, lane assignment
- **Body:** Squad name, swimmer count, attendance button
- **Footer:** Medical alerts count, session notes link

**Mobile:** Minimum 48px touch targets, works in portrait

**Code Example:**
```tsx
<div className="card p-6 bg-dark-primary text-surface">
  <div className="mb-4">
    <h3 className="text-xl font-semibold mb-1">Development Squad</h3>
    <p className="text-neutral-300">18:00 - 19:30, Lanes 3-6</p>
  </div>
  
  <div className="flex items-center justify-between mb-4">
    <p className="text-3xl font-bold tabular-nums text-lime">18 <span className="text-neutral-400">/ 22</span></p>
    <p className="text-sm text-neutral-400">Present</p>
  </div>
  
  <button className="btn-primary w-full h-12">Take Register</button>
  
  <div className="mt-4 pt-4 border-t border-neutral-700">
    <p className="text-sm text-warning">⚠️ 3 swimmers with medical alerts</p>
  </div>
</div>
```

---

## Navigation

### Sidebar (Desktop, 1024px+)
**Purpose:** Primary navigation for committee members on desktop

**Structure:**
- **Logo/Brand** at top
- **Role-specific sections** (grouped)
- **Active state** with brand green indicator
- **User profile** at bottom

**Width:** 240px fixed, collapses to 64px icon-only

**Code Example:**
```tsx
<aside className="sidebar w-60 bg-dark-primary text-surface h-screen">
  <div className="p-4 border-b border-neutral-700">
    <h1 className="text-xl font-serif">Swimly</h1>
  </div>
  
  <nav className="p-4 space-y-1">
    <a href="/dashboard" className="nav-item active">
      Dashboard
    </a>
    <a href="/members" className="nav-item">
      Members
    </a>
    <a href="/billing" className="nav-item">
      Billing
    </a>
  </nav>
</aside>

<style>
.nav-item {
  @apply block px-4 py-2 rounded-md text-neutral-300 hover:bg-neutral-800;
}

.nav-item.active {
  @apply bg-brand-green text-dark-primary font-semibold;
}
</style>
```

### Bottom Tab Bar (Mobile, < 768px)
**Purpose:** Primary navigation for coaches and parents on mobile

**Structure:**
- **Maximum 5 tabs** (ideal: 4)
- **Icons + labels** (icon 24px, label 10-12px)
- **Active state:** Brand green icon + label
- **Badge counts** for notifications

**Touch targets:** 56px minimum height

**Code Example:**
```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-neutral-200 safe-area-pb">
  <div className="flex items-center justify-around h-16">
    <button className="tab-item active">
      <HomeIcon className="w-6 h-6" />
      <span className="text-xs">Home</span>
    </button>
    
    <button className="tab-item">
      <CalendarIcon className="w-6 h-6" />
      <span className="text-xs">Schedule</span>
    </button>
    
    <button className="tab-item relative">
      <BellIcon className="w-6 h-6" />
      <span className="text-xs">Alerts</span>
      <span className="badge-count">3</span>
    </button>
    
    <button className="tab-item">
      <UserIcon className="w-6 h-6" />
      <span className="text-xs">Profile</span>
    </button>
  </div>
</nav>

<style>
.tab-item {
  @apply flex flex-col items-center gap-1 text-neutral-600 min-w-[56px] py-2;
}

.tab-item.active {
  @apply text-brand-green;
}

.badge-count {
  @apply absolute top-0 right-0 bg-error text-white text-xs rounded-full w-5 h-5 flex items-center justify-center;
}
</style>
```

### Breadcrumbs (Desktop, Admin Areas)
**Purpose:** Show navigation hierarchy in deep admin sections

**Usage:** Only when 3+ levels deep (e.g., Members > Development Squad > Kassidy Tempest)

**Code Example:**
```tsx
<nav className="breadcrumbs text-sm text-neutral-600 mb-4">
  <a href="/members" className="hover:text-brand-green">Members</a>
  <span className="mx-2">/</span>
  <a href="/members/squads/development" className="hover:text-brand-green">Development Squad</a>
  <span className="mx-2">/</span>
  <span className="text-neutral-900 font-medium">Kassidy Tempest</span>
</nav>
```

---

## Tables

### Data Table (Desktop)
**Purpose:** Display large datasets (members, payments, sessions) with sorting and filtering

**Features:**
- Sortable columns (click header)
- Filterable rows (search/filter UI above table)
- Bulk actions (checkbox per row, floating action bar)
- Responsive: stacks into cards on mobile

**Code Example:**
```tsx
<div className="table-container">
  <div className="table-toolbar flex items-center justify-between mb-4">
    <input type="search" placeholder="Search members..." className="input w-64" />
    <div className="flex gap-2">
      <button className="btn-secondary">Filter</button>
      <button className="btn-secondary">Export</button>
    </div>
  </div>
  
  <table className="table">
    <thead>
      <tr>
        <th><input type="checkbox" /></th>
        <th className="sortable">Name</th>
        <th className="sortable">Squad</th>
        <th className="sortable">Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><input type="checkbox" /></td>
        <td>Kassidy Tempest</td>
        <td><span className="badge">Development</span></td>
        <td><span className="badge badge-success">Active</span></td>
        <td><button className="btn-icon">⋮</button></td>
      </tr>
    </tbody>
  </table>
</div>

<style>
.table {
  @apply w-full border-collapse;
}

.table th {
  @apply text-left px-4 py-3 bg-neutral-100 border-b-2 border-neutral-300 font-semibold text-sm;
}

.table td {
  @apply px-4 py-3 border-b border-neutral-200;
}

.sortable {
  @apply cursor-pointer hover:bg-neutral-200 select-none;
}
</style>
```

### Mobile Table (< 768px)
**Purpose:** Display table data as stacked cards on mobile

**Pattern:** Convert each row into a card with label:value pairs

**Code Example:**
```tsx
<div className="mobile-table-cards space-y-4 md:hidden">
  {members.map(member => (
    <div key={member.id} className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <h4 className="font-semibold">{member.name}</h4>
        <button className="btn-icon">⋮</button>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-600">Squad:</span>
          <span className="badge">{member.squad}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-600">Status:</span>
          <span className="badge badge-success">{member.status}</span>
        </div>
      </div>
    </div>
  ))}
</div>
```

---

## Forms

### Form Input
**Purpose:** Standard text input for all forms

**States:** Default, Focus, Disabled, Error

**Code Example:**
```tsx
<div className="form-group">
  <label htmlFor="email" className="form-label">
    Email address
  </label>
  <input 
    type="email" 
    id="email" 
    className="form-input" 
    placeholder="you@example.com"
  />
  <p className="form-help">We will never share your email.</p>
</div>

<style>
.form-group {
  @apply mb-6;
}

.form-label {
  @apply block text-sm font-medium text-neutral-700 mb-2;
}

.form-input {
  @apply w-full px-4 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent;
}

.form-input:disabled {
  @apply bg-neutral-100 cursor-not-allowed opacity-50;
}

.form-input.error {
  @apply border-error focus:ring-error;
}

.form-help {
  @apply mt-2 text-sm text-neutral-600;
}
</style>
```

### Form Error State
**Purpose:** Show validation errors inline

**Requirements:**
- Error message descriptive and actionable
- Linked to input (aria-describedby)
- Error colour meets contrast requirements

**Code Example:**
```tsx
<div className="form-group">
  <label htmlFor="email" className="form-label">
    Email address
  </label>
  <input 
    type="email" 
    id="email" 
    className="form-input error" 
    aria-invalid="true"
    aria-describedby="email-error"
  />
  <p id="email-error" className="form-error">
    Please enter a valid email address.
  </p>
</div>

<style>
.form-error {
  @apply mt-2 text-sm text-error flex items-center gap-1;
}

.form-error::before {
  content: '⚠️';
}
</style>
```

---

## Notifications

### Toast Notification
**Purpose:** Temporary feedback for user actions (saved, deleted, sent)

**Position:** Top-right on desktop, top-center on mobile  
**Duration:** 3-5 seconds, dismissible  
**Types:** Success, Error, Warning, Info

**Code Example:**
```tsx
<div className="toast toast-success">
  <div className="flex items-center gap-3">
    <CheckCircleIcon className="w-5 h-5" />
    <p>Payment processed successfully.</p>
  </div>
  <button className="btn-icon-sm">×</button>
</div>

<style>
.toast {
  @apply fixed top-4 right-4 px-4 py-3 rounded-md shadow-lg flex items-center justify-between gap-4 min-w-[320px] max-w-md;
}

.toast-success {
  @apply bg-success-light text-success-dark border border-success;
}

.toast-error {
  @apply bg-error-light text-error-dark border border-error;
}
</style>
```

### Alert Banner
**Purpose:** Persistent important messages (expiring DBS, failed payment)

**Position:** Top of page, below header  
**Dismissible:** Only if not critical

**Code Example:**
```tsx
<div className="alert alert-warning">
  <div className="flex items-start gap-3">
    <WarningIcon className="w-5 h-5 flex-shrink-0" />
    <div>
      <p className="font-semibold">3 DBS checks expiring in the next 30 days</p>
      <p className="text-sm mt-1">Review and renew before they expire to maintain compliance.</p>
    </div>
  </div>
  <button className="btn-secondary btn-sm">View details</button>
</div>

<style>
.alert {
  @apply px-6 py-4 border-l-4 flex items-center justify-between gap-4;
}

.alert-warning {
  @apply bg-warning-light border-warning text-warning-dark;
}
</style>
```

---

## Testing Checklist

When implementing components:

- [ ] Does the component work on mobile (touch targets ≥ 44px)?
- [ ] Are all interactive states defined (default, hover, focus, disabled)?
- [ ] Does text meet contrast requirements (4.5:1 or 3:1)?
- [ ] Are form labels always visible (not placeholder-only)?
- [ ] Are error messages descriptive and linked to inputs?
- [ ] Do cards have proper contrast with their background?
- [ ] Is navigation limited to 5 items on mobile?
- [ ] Do tables stack into cards on mobile?

---

**Next:** [Layout Patterns](./layout-patterns.md) for dashboard and persona-specific layouts.
