# Component Audit: Q2 2026 Feature Gap Analysis

**Date:** 10 March 2026  
**Purpose:** Identify missing or incomplete components needed for Q2 features before sprint planning on 1 April  
**Scope:** Module 5 Competition, Multi-club Branding, Committee Handover, Parent Mobile, Coach Poolside  
**Goal:** Prevent mid-sprint discovery of missing components that would delay development

---

## Audit Summary

| Category | Components Audited | Exists | Partial | Missing | Blockers |
|----------|-------------------|--------|---------|---------|----------|
| Competition Module | 6 | 0 | 0 | 6 | 4 |
| Multi-club Branding | 4 | 0 | 1 | 3 | 2 |
| Committee Handover | 4 | 0 | 1 | 3 | 3 |
| Parent Mobile | 4 | 2 | 1 | 1 | 0 |
| Coach Poolside | 4 | 3 | 0 | 1 | 1 |
| **Total** | **22** | **5** | **3** | **14** | **10** |

**Risk Level:** HIGH — 10 blocker components missing with Q2 sprint starting 1 April

---

## 1. Competition Module (Module 5)

### 1.1 Meet Card
**Component Name:** `MeetCard.tsx`  
**Current Status:** Missing  
**Used In:** Gala management dashboard, upcoming meets list  
**Design Complete?** Yes (design-system/module-5-visual-specs.md)  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `meetName`: string
- `meetDate`: Date
- `meetVenue`: string
- `entriesCount`: number
- `entriesDeadline`: Date
- `status`: 'upcoming' | 'entries-open' | 'entries-closed' | 'completed'
- `onViewDetails`: () => void
- `onEnterSwimmers`: () => void

**Missing Features:**
- Status badge with colour coding
- Entry deadline countdown
- Quick action buttons (view, enter, export)
- Mobile-optimised card layout

---

### 1.2 Entry Form
**Component Name:** `GalaEntryForm.tsx`  
**Current Status:** Missing  
**Used In:** Swimmer gala entry flow, coach bulk entry  
**Design Complete?** Yes (design-system/module-5-visual-specs.md)  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `swimmer`: SwimmerProfile
- `events`: GalaEvent[]
- `qualifyingTimes`: QualifyingTime[]
- `onSubmit`: (entries: SelectedEvents[]) => void
- `onCancel`: () => void

**Missing Features:**
- Event selection with qualifying time validation
- Auto-filter events by swimmer age/category
- Entry time input with format validation (MM:SS.ss)
- Fee calculation display
- Multi-event selection UI
- Mobile-friendly event list (long)

---

### 1.3 Qualifying Time Display
**Component Name:** `QualifyingTimeIndicator.tsx`  
**Current Status:** Missing  
**Used In:** Event selection, swimmer profile, entry validation  
**Design Complete?** Yes (design-system/module-5-visual-specs.md)  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `swimmerPB`: string (MM:SS.ss format)
- `qualifyingTime`: string (MM:SS.ss format)
- `event`: string
- `showDifference`: boolean

**Missing Features:**
- Visual comparison (PB vs QT)
- Colour coding (qualified green, close amber, far red)
- Time difference calculation display
- Tooltip with last achieved date

---

### 1.4 Results Table
**Component Name:** `GalaResultsTable.tsx`  
**Current Status:** Missing  
**Used In:** Post-gala results display, swimmer profile history  
**Design Complete?** Partial (table structure exists, gala-specific missing)  
**Implementation Complete?** No  
**Gap Severity:** Nice-to-have (post-event feature)

**Required Props:**
- `results`: GalaResult[]
- `sortBy`: 'time' | 'place' | 'swimmer'
- `groupBy`: 'event' | 'swimmer'
- `showComparison`: boolean (PB comparison)

**Missing Features:**
- Gala-specific columns (heat, lane, place)
- PB indicator (new PB highlighted)
- Sortable by multiple columns
- Mobile: stack into result cards
- Export to CSV

---

### 1.5 File Upload/Download
**Component Name:** `GalaFileManager.tsx`  
**Current Status:** Missing  
**Used In:** Entry file export (Hy-Tek), results file import  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `fileType`: 'entry' | 'results'
- `format`: 'hytek' | 'sportsystems' | 'csv'
- `onUpload`: (file: File) => void
- `onDownload`: (format: string) => void
- `uploadProgress?`: number

**Missing Features:**
- Drag-and-drop upload area
- File format validation
- Download format selector
- Upload progress indicator
- Error handling for invalid files
- File preview before import

---

### 1.6 Gala Fee Breakdown
**Component Name:** `GalaFeeBreakdown.tsx`  
**Current Status:** Missing  
**Used In:** Entry confirmation, parent payment flow  
**Design Complete?** Yes (design-system/module-5-visual-specs.md)  
**Implementation Complete?** No  
**Gap Severity:** Nice-to-have (can use generic invoice initially)

**Required Props:**
- `events`: SelectedEvent[]
- `eventFee`: number
- `convenienceFee`: number
- `total`: number
- `showBreakdown`: boolean

**Missing Features:**
- Per-event cost line items
- Convenience fee explanation tooltip
- Total calculation
- Itemised receipt view

---

## 2. Multi-club Branding

### 2.1 Club Logo Upload
**Component Name:** `ClubLogoUpload.tsx`  
**Current Status:** Missing  
**Used In:** Club settings, multi-club setup wizard  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `currentLogo?`: string (URL)
- `onUpload`: (file: File) => void
- `onRemove`: () => void
- `maxSize`: number (bytes)
- `acceptedFormats`: string[]

**Missing Features:**
- Image preview before upload
- Crop/resize tool (simple)
- Format validation (PNG, SVG, JPG)
- Size validation (max 2MB)
- Drag-and-drop support
- Fallback to initials if no logo

---

### 2.2 Colour Picker
**Component Name:** `BrandColourPicker.tsx`  
**Current Status:** Partial (generic colour input exists, no brand presets)  
**Used In:** Club branding settings  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** Nice-to-have (can use text input initially)

**Required Props:**
- `value`: string (hex)
- `onChange`: (colour: string) => void
- `presets?`: string[] (common club colours)
- `label`: string

**Missing Features:**
- Visual colour swatch picker
- Preset colour palette (aquatic blues, greens)
- Hex input with validation
- Contrast checker (against canvas background)
- Live preview of selected colour

**Workaround:** Use `<input type="color">` initially, enhance later

---

### 2.3 Brand Preview
**Component Name:** `BrandPreview.tsx`  
**Current Status:** Missing  
**Used In:** Club settings, before saving branding changes  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `logo`: string (URL)
- `primaryColour`: string
- `clubName`: string
- `previewMode`: 'sidebar' | 'card' | 'full'

**Missing Features:**
- Live preview of logo + colour in UI context
- Multiple preview modes (sidebar, member card, invoice)
- Before/after comparison
- Mobile preview

---

### 2.4 Theme Switcher
**Component Name:** `ClubThemeSwitcher.tsx`  
**Current Status:** Missing  
**Used In:** User preferences (if multi-club volunteer), club selector  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** Nice-to-have (single-club MVP doesn't need this)

**Required Props:**
- `clubs`: Club[]
- `activeClub`: Club
- `onSwitch`: (clubId: string) => void

**Missing Features:**
- Club selector dropdown with logo + name
- Active club indicator
- Quick-switch between clubs
- Persist preference in session

---

## 3. Committee Handover

### 3.1 Role Assignment Wizard
**Component Name:** `RoleAssignmentWizard.tsx`  
**Current Status:** Missing  
**Used In:** Annual handover flow, committee onboarding  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `currentRoles`: CommitteeRole[]
- `availableMembers`: Member[]
- `onAssign`: (roleId: string, memberId: string) => void
- `onComplete`: () => void

**Missing Features:**
- Step-by-step wizard (5-7 steps for key roles)
- Current vs new role comparison
- Member search and selection
- Role description tooltips
- Progress indicator
- Confirmation step before finalising

---

### 3.2 Permission Matrix
**Component Name:** `PermissionMatrix.tsx`  
**Current Status:** Partial (role data exists, no visual matrix UI)  
**Used In:** Role management, security audit  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `roles`: Role[]
- `permissions`: Permission[]
- `matrix`: RolePermissionMap
- `editable`: boolean
- `onChange?`: (roleId: string, permissionId: string, value: boolean) => void

**Missing Features:**
- 2D matrix grid (roles × permissions)
- Visual checkboxes (read/write/none)
- Tooltips explaining permissions
- Highlight changes before saving
- Mobile: accordion per role

**Workaround:** Use existing role selector + text list initially

---

### 3.3 Handover Confirmation
**Component Name:** `HandoverConfirmation.tsx`  
**Current Status:** Missing  
**Used In:** Final step of handover wizard  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** BLOCKER

**Required Props:**
- `outgoingRoles`: RoleChange[]
- `incomingRoles`: RoleChange[]
- `effectiveDate`: Date
- `onConfirm`: () => void
- `onCancel`: () => void

**Missing Features:**
- Summary of all role changes
- Outgoing members confirmation
- Incoming members notification preview
- Digital signature (optional)
- Audit trail recording

---

### 3.4 Audit Log Viewer
**Component Name:** `AuditLogViewer.tsx`  
**Current Status:** Missing  
**Used In:** Governance dashboard, security review  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** Nice-to-have (governance feature, not MVP)

**Required Props:**
- `logs`: AuditLogEntry[]
- `filters`: LogFilter
- `onFilter`: (filter: LogFilter) => void

**Missing Features:**
- Filterable table (date, user, action, resource)
- Search by user or action type
- Export to CSV for compliance
- Pagination for long logs
- Mobile: timeline view instead of table

---

## 4. Parent Mobile

### 4.1 Session Card
**Component Name:** `SessionCard.tsx` (exists in `/components/sessions/`)  
**Current Status:** Exists  
**Used In:** Parent dashboard, today's sessions view  
**Design Complete?** Yes  
**Implementation Complete?** Yes  
**Gap Severity:** N/A

**Existing Props:**
- `session`: Session
- `onViewDetails`: () => void

**Enhancements Needed:**
- Add "Add to Calendar" button
- Show coach name
- Swimming pool address with map link

---

### 4.2 Swimmer Profile
**Component Name:** `SwimmerProfileCard.tsx`  
**Current Status:** Partial (data exists, parent-view card missing)  
**Used In:** Parent dashboard (per child)  
**Design Complete?** Yes (design-system/components.md)  
**Implementation Complete?** Partial  
**Gap Severity:** Nice-to-have (data accessible via other routes)

**Required Props:**
- `swimmer`: Swimmer
- `squad`: Squad
- `nextSession`: Session
- `recentPBs`: PersonalBest[]

**Missing Features:**
- Avatar/initials circle
- Next session display
- Recent PBs section (last 3)
- Quick access to full profile

**Workaround:** Use generic swimmer details page initially

---

### 4.3 Payment History
**Component Name:** `PaymentHistoryList.tsx`  
**Current Status:** Exists (in `/components/invoices/InvoiceTable.tsx`)  
**Used In:** Parent billing view  
**Design Complete?** Yes  
**Implementation Complete?** Yes  
**Gap Severity:** N/A

**Existing Props:**
- `invoices`: Invoice[]
- `onViewInvoice`: (id: string) => void

**Enhancements Needed:**
- Parent-friendly mobile view (cards not table)
- Download receipt link per payment
- Filter by date range

---

### 4.4 Notification Centre
**Component Name:** `NotificationCentre.tsx`  
**Current Status:** Missing  
**Used In:** Parent mobile app, notification history  
**Design Complete?** No  
**Implementation Complete?** No  
**Gap Severity:** Nice-to-have (email notifications sufficient for MVP)

**Required Props:**
- `notifications`: Notification[]
- `onMarkRead`: (id: string) => void
- `onMarkAllRead`: () => void
- `onClear`: (id: string) => void

**Missing Features:**
- Notification list (unread highlighted)
- Mark as read/unread
- Clear individual notifications
- Filter by type (payment, session, gala)
- Badge count on bell icon

---

## 5. Coach Poolside

### 5.1 Session Register
**Component Name:** `AttendanceRoster.tsx` (exists in `/components/attendance/`)  
**Current Status:** Exists  
**Used In:** Coach poolside attendance tracking  
**Design Complete?** Yes  
**Implementation Complete?** Yes  
**Gap Severity:** N/A

**Existing Props:**
- `session`: Session
- `swimmers`: Swimmer[]
- `onMarkAttendance`: (swimmerId: string, status: AttendanceStatus) => void

**Enhancements Needed:**
- Larger touch targets for mobile (current: 40px, need: 48px)
- One-tap toggle (present/absent)
- Offline mode with sync indicator

---

### 5.2 Attendance Toggle
**Component Name:** `StatusSelector.tsx` (exists in `/components/attendance/`)  
**Current Status:** Exists  
**Used In:** Poolside register, individual swimmer check-in  
**Design Complete?** Yes  
**Implementation Complete?** Yes  
**Gap Severity:** N/A

**Existing Props:**
- `status`: AttendanceStatus
- `onChange`: (status: AttendanceStatus) => void

**Enhancements Needed:**
- Ensure 48px minimum touch target (currently borderline)
- Haptic feedback on toggle (if supported)

---

### 5.3 Medical Flag Display
**Component Name:** `MedicalAlertBadge.tsx`  
**Current Status:** Exists (in `/components/swimmers/`, used in roster)  
**Used In:** Attendance roster, swimmer profile  
**Design Complete?** Yes  
**Implementation Complete?** Yes  
**Gap Severity:** N/A

**Existing Props:**
- `swimmer`: Swimmer
- `showDetails`: boolean

**Enhancements Needed:**
- Expandable details on tap
- Clear visual warning (colour + icon)
- Accessibility (screen reader announces alert)

---

### 5.4 Offline Sync Indicator
**Component Name:** `ConnectivityBanner.tsx` (exists in `/components/ui/`)  
**Current Status:** Exists  
**Used In:** All pages when offline  
**Design Complete?** Yes  
**Implementation Complete?** Yes  
**Gap Severity:** N/A (but needs testing for attendance sync)

**Existing Props:**
- `isOnline`: boolean
- `syncStatus`: 'synced' | 'pending' | 'error'

**Enhancements Needed:**
- Coach-specific messaging ("Attendance will sync when online")
- Manual sync button
- Pending changes count indicator

**Testing Gap:** BLOCKER — Offline attendance sync not tested on actual devices

---

## Priority Actions (Before 1 April Sprint Planning)

### Must Complete (Blockers)
1. **Competition Module** (4 blockers):
   - `MeetCard.tsx` — Sprint 1, Week 1
   - `GalaEntryForm.tsx` — Sprint 1, Week 1-2
   - `QualifyingTimeIndicator.tsx` — Sprint 1, Week 1
   - `GalaFileManager.tsx` — Sprint 2, Week 1

2. **Multi-club Branding** (2 blockers):
   - `ClubLogoUpload.tsx` — Sprint 1, Week 2
   - `BrandPreview.tsx` — Sprint 1, Week 2

3. **Committee Handover** (3 blockers):
   - `RoleAssignmentWizard.tsx` — Sprint 2, Week 1-2
   - `PermissionMatrix.tsx` — Sprint 2, Week 2
   - `HandoverConfirmation.tsx` — Sprint 2, Week 2

4. **Coach Poolside** (1 blocker):
   - Test offline attendance sync on iOS/Android — Sprint 1, Week 1

### Can Defer (Nice-to-Have)
- `GalaResultsTable.tsx` — Post-event feature, defer to Sprint 3
- `GalaFeeBreakdown.tsx` — Use generic invoice initially
- `ClubThemeSwitcher.tsx` — Single-club MVP doesn't need this
- `AuditLogViewer.tsx` — Governance feature, defer to Q3
- `NotificationCentre.tsx` — Email notifications sufficient for MVP

### Enhancement Backlog (Existing Components)
- `SessionCard.tsx` — Add calendar integration
- `SwimmerProfileCard.tsx` — Build parent-view variant
- `PaymentHistoryList.tsx` — Mobile card view
- `AttendanceRoster.tsx` — Increase touch targets to 48px
- `StatusSelector.tsx` — Add haptic feedback
- `ConnectivityBanner.tsx` — Coach-specific messaging

---

## Sprint Planning Recommendations

**Sprint 1 (1-14 April):**
- Focus: Competition Module + Multi-club Branding blockers
- Capacity: 10 development days
- Components: 6 blockers
- Risk: Tight timeline, may slip to Sprint 2

**Sprint 2 (15-28 April):**
- Focus: Committee Handover + remaining Competition features
- Capacity: 10 development days
- Components: 4 blockers + 2 enhancements
- Risk: Handover wizard complex, needs thorough testing

**Sprint 3 (29 April - 12 May):**
- Focus: Nice-to-haves + polish
- Components: Results table, fee breakdown, notification centre
- Risk: Low, these are enhancements not blockers

---

## Design Debt Identified

1. **Module 5 Competition:** Design complete, implementation 0%. High risk.
2. **Multi-club Branding:** No design for colour picker, preview, theme switcher.
3. **Committee Handover:** No design for any components. Needs design sprint before development.
4. **Mobile Touch Targets:** Existing components need 44px → 48px audit.
5. **Offline Sync:** Not tested on real devices. Must test before RTW pilot scaling.

---

## Next Steps

1. **Design Team:**
   - Complete Committee Handover component designs (3 components) — by 18 March
   - Design Multi-club Branding components (3 components) — by 18 March
   - Review and refine Module 5 designs for development handoff — by 15 March

2. **Development Team:**
   - Size blocker components (story points) — by 20 March
   - Identify shared patterns (file upload, wizards) for reusability — by 22 March
   - Set up component Storybook for isolated development — by 25 March

3. **QA/Testing:**
   - Test offline attendance sync on iOS/Android — by 18 March
   - Audit touch targets on existing components — by 20 March
   - Create mobile testing plan for Q2 components — by 25 March

4. **Product:**
   - Confirm Sprint 1 priority (Competition vs Branding vs Handover) — by 15 March
   - Define MVP scope for each module (can we defer nice-to-haves?) — by 18 March
   - Schedule design review with founding clubs (Kassidy's feedback) — by 22 March

---

**Prepared by:** Swimly Design Agent  
**Last Updated:** 10 March 2026, 22:11 GMT  
**Next Review:** 20 March 2026 (post-design sprint)
