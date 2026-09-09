# Swimly Layout Patterns

**Last Updated:** 10 March 2026  
**Owner:** Swimly Design  
**Purpose:** Standard layout structures for all Swimly interfaces

---

## Core Layout Principles

### 1. Role-Based Dashboard Structure

Every user role sees a different layout optimised for their primary tasks:

- **Treasurer** = Financial overview dashboard
- **Membership Secretary** = Member directory and processing queue
- **Chair/Secretary** = Governance and compliance overview
- **Coach** = Session-focused mobile view
- **Parent** = Family dashboard with child cards

### 2. Mobile-First, Desktop-Enhanced

- Design for mobile (coaches, parents)
- Enhance for desktop (committee admin work)
- Never hide critical features from mobile users

### 3. Information Hierarchy

1. **Primary action** = top-right on desktop, bottom navigation on mobile
2. **Status/alerts** = prominent at top
3. **Main content** = centre, scrollable
4. **Secondary actions** = sidebar/menu
5. **Navigation** = left sidebar (desktop), bottom tabs (mobile)

---

## Dashboard Layouts by Persona

### Treasurer Dashboard

**Desktop Layout:**

```
┌─────────────────────────────────────────────────┐
│  Header: Club Name + Treasurer Name + Actions   │
├──────────┬──────────────────────────────────────┤
│          │  Financial Summary Cards (3-column)  │
│ Sidebar  │  ┌─────┐ ┌─────┐ ┌─────┐            │
│ Nav      │  │Inc  │ │Exp  │ │Rate │            │
│          │  └─────┘ └─────┘ └─────┘            │
│ • Dash   │                                       │
│ • Pay    │  Outstanding Payments Table          │
│ • Report │  (sortable, filterable, bulk action) │
│ • Export │                                       │
│          │  Monthly Trends Chart                 │
│          │  (bar chart: income vs expenses)     │
└──────────┴──────────────────────────────────────┘
```

**Mobile Layout (Stacked):**

```
┌──────────────────────┐
│   Financial Summary  │
│   ┌───────────────┐  │
│   │ Income: £4.2K │  │
│   └───────────────┘  │
│   ┌───────────────┐  │
│   │ Expenses: £1K │  │
│   └───────────────┘  │
│   ┌───────────────┐  │
│   │ Collection 95%│  │
│   └───────────────┘  │
│                      │
│   Outstanding (12)   │
│   [List View]        │
│   • Emma D - £45     │
│   • Tom R  - £90     │
│                      │
├──────────────────────┤
│  Bottom Nav:         │
│ [Dash][Pay][Report]  │
└──────────────────────┘
```

**Key Features:**

- At-a-glance financial health (3 KPI cards)
- One-tap access to outstanding payments
- Export button prominent (committee reports)
- Monthly comparison chart (simple bar chart)
- Red/amber/green status indicators

---

### Membership Secretary Dashboard

**Desktop Layout:**

```
┌─────────────────────────────────────────────────┐
│  Header: Club Name + Search Bar + Add Member    │
├──────────┬──────────────────────────────────────┤
│          │  Status Overview (4 cards)            │
│ Sidebar  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐│
│ Nav      │  │Active│ │Pend  │ │Lapsed│ │New   ││
│          │  └──────┘ └──────┘ └──────┘ └──────┘│
│ • Dash   │                                       │
│ • Members│  Member Directory Table                │
│ • Renewal│  (search, filter, sort, bulk actions) │
│ • SE Sync│                                       │
│ • Import │  Filters: Squad / Status / SE Cat    │
│          │                                       │
└──────────┴──────────────────────────────────────┘
```

**Mobile Layout:**

```
┌──────────────────────┐
│  Search Bar          │
│  [Filter ▼] [+ New]  │
├──────────────────────┤
│  Member Cards        │
│  ┌────────────────┐  │
│  │ Emma Davies    │  │
│  │ Dev Squad      │  │
│  │ 🟢 Active      │  │
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │ Tom Richards   │  │
│  │ Perf Squad     │  │
│  │ 🟠 Renewal Due │  │
│  └────────────────┘  │
│                      │
├──────────────────────┤
│  Bottom Nav:         │
│ [Members][Renew][SE] │
└──────────────────────┘
```

**Key Features:**

- Searchable, filterable member list
- Status badges (active, pending, lapsed, new)
- Bulk actions (select multiple, bulk email, bulk status change)
- Import wizard for spreadsheet migration
- SE category indicators (Cat 1/2/3 colour-coded)

---

### Chair/Secretary Dashboard

**Desktop Layout:**

```
┌─────────────────────────────────────────────────┐
│  Header: Club Name + Committee + Quick Actions  │
├──────────┬──────────────────────────────────────┤
│          │  Club Overview (6 cards)              │
│ Sidebar  │  ┌──────┐ ┌──────┐ ┌──────┐          │
│ Nav      │  │Member│ │Finance│ │Comply│          │
│          │  └──────┘ └──────┘ └──────┘          │
│ • Dash   │  ┌──────┐ ┌──────┐ ┌──────┐          │
│ • Comply │  │Session│ │DBS   │ │Docs  │          │
│ • Access │  └──────┘ └──────┘ └──────┘          │
│ • Audit  │                                       │
│ • Docs   │  Compliance Alerts                    │
│          │  ⚠️ 3 DBS checks expiring this month  │
│          │  ✅ Safeguarding: All current         │
│          │                                       │
│          │  Activity Log (Recent Actions)        │
│          │  • Mike added Emma Davies (2h ago)   │
│          │  • Sarah updated squad fees (5h ago)  │
└──────────┴──────────────────────────────────────┘
```

**Mobile Layout:**

```
┌──────────────────────┐
│   Club Overview      │
│   ┌───────────────┐  │
│   │ 142 Members   │  │
│   └───────────────┘  │
│   ┌───────────────┐  │
│   │ 95% Paid      │  │
│   └───────────────┘  │
│   ┌───────────────┐  │
│   │ ⚠️ 3 DBS Due  │  │
│   └───────────────┘  │
│                      │
│   Recent Activity    │
│   • Mike added Emma  │
│   • Sarah updated    │
│                      │
├──────────────────────┤
│  Bottom Nav:         │
│ [Dash][Comply][Audit]│
└──────────────────────┘
```

**Key Features:**

- Bird's-eye view: members, finances, compliance, sessions at a glance
- Compliance traffic lights (DBS, safeguarding, qualifications)
- Role management: add/remove committee access with clear permission descriptions
- Activity log: who did what, when (for accountability)
- Document storage: minutes, constitution, policies

---

### Coach Dashboard (Mobile-Optimised)

**Mobile Layout (Primary Interface):**

```
┌──────────────────────┐
│  Today's Session     │
│  ┌────────────────┐  │
│  │ Development    │  │
│  │ 18:00-19:30    │  │
│  │ Lanes 3-6      │  │
│  │                │  │
│  │ [Take Register]│  │
│  └────────────────┘  │
│                      │
│  Next: Tuesday 18:00 │
│                      │
│  Squad Roster (18)   │
│  • Emma Davies       │
│  • Tom Richards      │
│  • Katie Wilson  ⚠️  │
│  (medical flag)      │
│                      │
├──────────────────────┤
│  Bottom Nav:         │
│ [Session][Roster][+] │
└──────────────────────┘
```

**Register View (Session Active):**

```
┌──────────────────────┐
│  Dev Squad Register  │
│  18:00-19:30         │
│  Present: 15/18      │
├──────────────────────┤
│  ✅ Emma Davies      │
│  ✅ Tom Richards     │
│  ✅ Katie Wilson ⚠️  │
│  ❌ Sarah Brown      │
│  ❌ Luke Mitchell    │
│  ⬜ Pending (3)      │
│                      │
│  [Mark All Present]  │
│  [View Absences]     │
│                      │
│  Session Notes:      │
│  [Brief notes...]    │
│                      │
│  [End Session]       │
└──────────────────────┘
```

**Key Features:**

- **Optimised for mobile phone, portrait orientation**
- Today's session front and centre on login
- Attendance: large checkboxes/toggle per swimmer name (44px minimum)
- Swimmer count visible ("18/22 present")
- Quick access to swimmer medical info (allergies, conditions)
- Session notes field (brief, not essay)
- Works offline — syncs when back in reception

**Touch Target Requirements:**

- Attendance checkbox: 48×48px
- Swimmer name tap area: 44px height minimum
- Medical flag icon: 32×32px (but within 44px tap zone)
- One-handed thumb-friendly zones (bottom 2/3 of screen)

---

### Parent Dashboard (Mobile-Optimised)

**Mobile Layout (Primary Interface):**

```
┌──────────────────────┐
│  My Swimmers         │
├──────────────────────┤
│  ┌────────────────┐  │
│  │ Kassidy        │  │
│  │ Development    │  │
│  │ Next: Tue 18:00│  │
│  │ Recent PB:     │  │
│  │ 50m Free 35.2s │  │
│  └────────────────┘  │
│  ┌────────────────┐  │
│  │ Liam           │  │
│  │ Performance    │  │
│  │ Next: Tue 19:30│  │
│  │ Payment Due    │  │
│  └────────────────┘  │
│                      │
│  Notifications (1)   │
│  🔔 Gala entry open  │
│                      │
├──────────────────────┤
│  Bottom Nav:         │
│ [Home][Schedule][💷] │
└──────────────────────┘
```

**Child Detail View:**

```
┌──────────────────────┐
│  ← Kassidy Davies    │
├──────────────────────┤
│  Squad: Development  │
│  Coach: Mike Tempest │
│                      │
│  This Week           │
│  • Tue 18:00 ✅      │
│  • Thu 18:00         │
│  • Sat 09:00         │
│                      │
│  Recent PBs          │
│  • 50 Free 35.2s     │
│  • 100 Free 1:18.5   │
│                      │
│  Payment Status      │
│  ✅ Up to date       │
│                      │
│  [View Full Schedule]│
│  [Payment History]   │
└──────────────────────┘
```

**Key Features:**

- Card-based layout per child (multi-child families)
- Each card shows: next session, squad, recent results
- Payment status clear and simple
- Schedule view: this week's sessions with times and pool location
- Notification preferences easily accessible
- No admin clutter — parents should not see committee tools

---

## Responsive Breakpoints

### Mobile (320-767px)

- **Primary for:** Coaches (poolside), Parents (on the go)
- **Layout:** Single column, stacked cards
- **Navigation:** Bottom tab bar (max 5 tabs)
- **Touch targets:** 44×44px minimum, 48×48px for critical actions
- **Font size:** 16px minimum body text
- **Whitespace:** Generous (16-24px between sections)

### Tablet (768-1023px)

- **Primary for:** Committee members (meetings, poolside admin)
- **Layout:** 2-column where appropriate, sidebar navigation available
- **Navigation:** Top bar + sidebar (collapsible)
- **Touch targets:** 40×40px minimum
- **Font size:** 16px body text
- **Whitespace:** Moderate (12-16px between sections)

### Desktop (1024px+)

- **Primary for:** Committee admin (treasurer reports, member management)
- **Layout:** Multi-column dashboards, data tables, sidebar navigation
- **Navigation:** Persistent left sidebar
- **Interaction:** Mouse/keyboard optimised
- **Font size:** 14-16px body text
- **Whitespace:** Balanced (content density higher than mobile)

---

## Whitespace Standards

### Spacing Scale

Based on 4px grid:

- **4px** = tight (between related labels and values)
- **8px** = close (between form fields)
- **12px** = comfortable (between paragraphs)
- **16px** = section separator (between cards on mobile)
- **24px** = major section (between dashboard panels)
- **32px** = page section (between major content areas)
- **48px** = page padding (top/bottom of major layouts)

### Component-Specific Spacing

**Cards:**

- Internal padding: 16px (mobile), 20px (desktop)
- Margin between cards: 16px (mobile), 20px (desktop)

**Tables:**

- Row height: 48px minimum (tap targets)
- Cell padding: 12px horizontal, 16px vertical
- Header padding: 12px all sides

**Forms:**

- Label-to-field gap: 8px
- Field-to-field gap: 16px (mobile), 12px (desktop)
- Field height: 44px minimum (mobile touch targets)

**Navigation:**

- Sidebar width: 240px (desktop)
- Nav item height: 44px (tap targets)
- Nav item padding: 12px horizontal, 12px vertical

---

## Poolside Touch Target Guidelines

Coaches use Swimly poolside with:

- Wet hands (reduced touch precision)
- Bright sunlight (reduced screen visibility)
- One hand (holding clipboard, whistle, etc.)
- Distractions (swimmers, other coaches, noise)

**Touch Target Requirements:**

- **Minimum:** 44×44px (WCAG 2.5.5 Level AAA)
- **Recommended for critical actions:** 48×48px
- **Spacing between targets:** 8px minimum gap

**Critical Actions (48×48px):**

- Attendance checkboxes
- Session start/end buttons
- Medical info icons
- Emergency contact access

**Standard Actions (44×44px):**

- Swimmer names (full row tappable)
- Navigation tabs
- Filter/sort buttons
- Menu icons

**Thumb-Friendly Zones (One-Handed Operation):**

- **Easy reach:** Bottom 1/3 of screen (primary actions)
- **Comfortable reach:** Middle 1/3 of screen (content)
- **Difficult reach:** Top 1/3 of screen (secondary nav, status only)

---

## Layout Anti-Patterns

### Never Do This:

1. **Don't hide critical features behind hamburger menus on mobile**  
   ❌ Coach register behind menu  
   ✅ Coach register on home screen

2. **Don't make tap targets smaller than 44×44px**  
   ❌ Tiny checkboxes (24×24px)  
   ✅ Large checkboxes (48×48px)

3. **Don't show admin clutter to parents**  
   ❌ Parent sees member database  
   ✅ Parent sees only their children

4. **Don't design hover-only interactions**  
   ❌ Hover to reveal actions  
   ✅ Tap to reveal actions (kebab menu)

5. **Don't stack data tables on mobile**  
   ❌ 6-column table crammed into 320px  
   ✅ Card-based layout with key data

6. **Don't use fixed headers that steal screen space**  
   ❌ 120px fixed header on 667px screen (18% wasted)  
   ✅ Collapsing header or minimal 48px header

---

## Testing Layouts

### Mobile Testing Checklist

- [ ] Test on iPhone SE (smallest screen: 375×667px)
- [ ] Test on Android (various: 360px, 412px width)
- [ ] Test with wet screen simulator (reduced touch precision)
- [ ] Test in bright sunlight (contrast visibility)
- [ ] Test one-handed (thumb reach zones)
- [ ] Test with thick gloves (winter poolside)

### Desktop Testing Checklist

- [ ] Test on 1024px (smallest desktop)
- [ ] Test on 1920px (common desktop)
- [ ] Test on ultrawide (3440px if available)
- [ ] Test keyboard navigation (tab, arrows, enter)
- [ ] Test screen reader (VoiceOver, NVDA)
- [ ] Test browser zoom (125%, 150%, 200%)

### Multi-Device Testing Checklist

- [ ] Responsive breakpoint transitions smooth
- [ ] Data tables transform to cards on mobile
- [ ] Navigation adapts (sidebar → bottom tabs)
- [ ] Touch targets meet 44×44px on all devices
- [ ] Critical features accessible on all screen sizes

---

## Layout Maintenance

Update these layout patterns when:

- New persona dashboards are created
- User research reveals navigation pain points
- Accessibility standards evolve
- Responsive behaviour needs refinement

To propose layout changes, create a task in Workshop tagged `design-system` + `layout`.

---

**Related:**

- [Components](./components.md) - Component-level specifications
- [Accessibility](./accessibility.md) - WCAG 2.1 AA compliance
- [Typography](./typography.md) - Text hierarchy and sizing
- [Colour System](./colour-system.md) - Colour usage and semantic meaning
