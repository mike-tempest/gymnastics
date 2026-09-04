# Module 5 Visual Design Specifications
## Competition Entry & Results Management

**Created:** 9 March 2026  
**Designer:** Swimly Design Agent  
**Purpose:** Production-ready visual specifications for Q2 development handoff  
**Deadline:** 20 March 2026

---

## Design System Reference

### Colour Palette
- **Canvas:** `#F0F0EC` (muted sage background)
- **Surface:** `#FAFAF8` (card backgrounds)
- **Dark Primary:** `#121216` (headers, nav, sidebar)
- **Brand Green:** `#00FF90` (CTAs, links, active states)
- **Lime Accent:** `#E8F059` (data highlights ONLY: numbers, chart markers)
- **Semantic Colours:**
  - Success/Eligible: `#00C853` (green)
  - Warning/Close: `#FFB300` (amber)
  - Error/Ineligible: `#D32F2F` (red)
  - Inactive: `#9E9E9E` (grey)

### Typography
- **Headings:** DM Serif Display, 28px/32px/20px
- **Body:** Inter Regular, 16px (18px mobile minimum for readability)
- **Labels:** Inter Medium, 14px
- **Data/Times:** Inter Mono, tabular numerals, 16px
- **Swim Time Format:** MM:SS.ss (e.g., 1:05.23)

### Spacing Scale
- `xs`: 4px
- `sm`: 8px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `2xl`: 48px

---

## Screen 1: Gala Setup (Competition Secretary — Desktop)

### Layout
```
+----------------------------------------------------------+
|  [Sidebar Nav]  |  CREATE GALA ENTRY                      |
|                 |                                         |
|  Dashboard      |  Step 1 of 3: Meet Details             |
|  Members        |                                         |
|  Squads         |  +----------------------------------+   |
|  Sessions       |  | Meet Name                        |   |
|  Billing        |  | [Kent County Championships 2026] |   |
|> Competitions   |  +----------------------------------+   |
|                 |                                         |
|                 |  +----------------------------------+   |
|                 |  | Date                             |   |
|                 |  | [14] [April] [2026] 📅           |   |
|                 |  +----------------------------------+   |
|                 |                                         |
|                 |  +----------------------------------+   |
|                 |  | Venue                            |   |
|                 |  | [Tonbridge Pool, TN9 1SF]        |   |
|                 |  +----------------------------------+   |
|                 |                                         |
|                 |  +----------------------------------+   |
|                 |  | Entry Deadline                   |   |
|                 |  | [7] [April] [2026] 📅            |   |
|                 |  +----------------------------------+   |
|                 |                                         |
|                 |  Entry Fee Structure                    |
|                 |  +----------------------------------+   |
|                 |  | Per Event         [£12.00]       |   |
|                 |  | Relay Entry       [£20.00]       |   |
|                 |  | Sibling Discount  [10%]          |   |
|                 |  +----------------------------------+   |
|                 |                                         |
|                 |  [Cancel] [Save Draft] [Next: Events→] |
+----------------------------------------------------------+
```

### Visual Specifications

**Page Header**
- Title: "CREATE GALA ENTRY" — DM Serif Display, 32px, #121216
- Breadcrumb: Dashboard > Competitions > Create — Inter Regular, 14px, #757575
- Progress indicator: "Step 1 of 3" — Inter Medium, 14px, #00FF90

**Form Fields**
- Label: Inter Medium, 14px, #121216
- Input: Inter Regular, 16px, #121216, bg: #FFFFFF, border: 1px #E0E0E0
- Focus state: border #00FF90, 2px
- Error state: border #D32F2F, helper text below in red
- Date picker icon: 20px, #757575

**Entry Fee Section**
- Section header: "Entry Fee Structure" — DM Serif Display, 20px, #121216
- Fee inputs: Right-aligned, tabular numerals
- Currency symbol: £ prefix, non-editable, #757575

**Action Buttons**
- Cancel: Ghost button, #757575 text, hover underline
- Save Draft: Outline button, #00FF90 border, #00FF90 text
- Next: Solid button, #00FF90 bg, #121216 text, 44px height, 16px padding
- Hover: lighten 10%
- Active: darken 10%

**Accessibility**
- All form fields: associated `<label>` elements
- Date pickers: keyboard navigable
- Focus indicators: 2px #00FF90 outline
- Error messages: linked to fields via `aria-describedby`

---

## Screen 2: Event Selection (Coach — Mobile Portrait)

### Layout (375px width)
```
+-------------------------------+
|  KENT COUNTY CHAMPS           |
|  Tonbridge Pool • 14 Apr 2026 |
|  Entry deadline: 7 days       |
+-------------------------------+
|                               |
|  Development Squad (18)       |
|  [v]                          |
|                               |
|  +-------------------------+  |
|  | ✓ ALFIE TEMPEST         |  |
|  |   Year: 2015 • PB: 50FR:|  |
|  |   38.45 (Eligible ✓)    |  |
|  |                         |  |
|  |   100m Freestyle  ✓     |  |
|  |   Qualifying: 1:25.00   |  |
|  |   Alfie PB: 1:18.34 ✓   |  |
|  |   Entry time: [1:18.34] |  |
|  |                         |  |
|  |   50m Freestyle   ✓     |  |
|  |   Qualifying: 38.50     |  |
|  |   Alfie PB: 38.45 ✓     |  |
|  |   Entry time: [38.45]   |  |
|  |                         |  |
|  |   200m IM        ✗      |  |
|  |   Qualifying: 3:15.00   |  |
|  |   Alfie PB: 3:22.11 ⚠   |  |
|  |   (7.11 seconds off)    |  |
|  +-------------------------+  |
|                               |
|  +-------------------------+  |
|  | ✓ KASSIDY THOMPSON      |  |
|  |   Year: 2014 • Events: 3|  |
|  |   [Tap to expand]        |  |
|  +-------------------------+  |
|                               |
|  [Select All Eligible]        |
|  [Save Draft] [Submit (2)]    |
+-------------------------------+
```

### Visual Specifications

**Page Header (Fixed)**
- Meet name: DM Serif Display, 20px, #121216
- Venue + date: Inter Regular, 14px, #757575
- Entry deadline badge: #FFB300 bg, #121216 text, "7 days" — countdown
- Background: #FAFAF8, 16px padding, border-bottom 1px #E0E0E0

**Squad Selector**
- Dropdown: 44px height (large tap target)
- Label: "Development Squad (18)" — Inter Medium, 16px
- Chevron icon: 20px, rotates on expand

**Swimmer Card (Collapsed)**
- Checkbox: 32px tap target, left-aligned
- Name: Inter SemiBold, 18px, #121216
- Meta row: "Year: 2015 • PB: 50FR: 38.45 (Eligible ✓)"
  - Inter Regular, 14px, #757575
  - Eligible badge: #00C853 text + icon
- Tap anywhere to expand

**Swimmer Card (Expanded)**
- Background: #FFFFFF, 16px padding, 8px border-radius
- Box shadow: 0 2px 8px rgba(0,0,0,0.08)

**Event Selection (Per Event)**
- Checkbox: 32px, left of event name
- Event name: Inter Medium, 16px, #121216
- Qualifying time: Inter Mono, 14px, #757575, "Qualifying: 1:25.00"
- Swimmer PB:
  - **If eligible:** #00C853, "Alfie PB: 1:18.34 ✓"
  - **If close (within 5%):** #FFB300, "Alfie PB: 3:22.11 ⚠ (7.11 off)"
  - **If ineligible:** #D32F2F, "No qualifying time"
- Entry time input:
  - Prefilled with PB if eligible
  - Editable (coach can enter estimated time)
  - Format: MM:SS.ss, tabular mono font
  - Validation: highlights if slower than qualifying

**Eligibility Badge**
- ✓ Green: 20px icon, #00C853
- ⚠ Amber: 20px icon, #FFB300
- ✗ Red (crossed circle): 20px icon, #D32F2F

**Bottom Actions (Fixed)**
- [Select All Eligible]: Outline button, #00FF90, full width minus 16px margin
- [Save Draft]: Ghost button, #757575
- [Submit (2)]: Primary button, #00FF90 bg, #121216 text, badge shows count
- Buttons: 48px height minimum (WCAG touch target)
- Margin: 16px from screen edges

**Offline Indicator**
- If offline: Yellow banner top of screen, "Working offline — will sync"
- Icon: WiFi with slash, 16px

**Accessibility**
- Colour not sole indicator: use icons (✓ ⚠ ✗) with colour
- Tap targets: 44px minimum (WCAG 2.5.5)
- Focus order: top to bottom, natural reading flow
- Screen reader: "Alfie Tempest, 100 metre Freestyle, eligible, personal best 1 minute 18.34"

---

## Screen 3: Parent Confirmation (Parent Portal — Mobile)

### Layout (375px width)
```
+-------------------------------+
|  GALA ENTRY CONFIRMATION      |
+-------------------------------+
|                               |
|  Kassidy has been entered     |
|  by Coach Emma                |
|                               |
|  Kent County Championships    |
|  Tonbridge Pool • 14 Apr 2026 |
|                               |
|  Confirm by: 7 April (5 days) |
+-------------------------------+
|                               |
|  +-------------------------+  |
|  | 100m Freestyle          |  |
|  | Entry time: 1:05.23     |  |
|  | Fee: £12.00             |  |
|  | [Confirm] [Withdraw]    |  |
|  +-------------------------+  |
|                               |
|  +-------------------------+  |
|  | 50m Backstroke          |  |
|  | Entry time: 38.12       |  |
|  | Fee: £12.00             |  |
|  | [Confirm] [Withdraw]    |  |
|  +-------------------------+  |
|                               |
|  +-------------------------+  |
|  | 200m IM                 |  |
|  | Entry time: 2:45.67     |  |
|  | Fee: £12.00             |  |
|  | [Confirm] [Withdraw]    |  |
|  +-------------------------+  |
|                               |
|  Total: £36.00                |
|  (3 events confirmed)         |
|                               |
|  Payment will be collected    |
|  via Direct Debit on 8 April  |
|                               |
|  [Confirm All Entries]        |
+-------------------------------+
```

### Visual Specifications

**Header**
- Title: "GALA ENTRY CONFIRMATION" — DM Serif Display, 24px, #121216
- Intro text: "Kassidy has been entered by Coach Emma"
  - Inter Regular, 16px, #757575
  - Coach name: Inter Medium (emphasise trust)
- Meet details: Inter Regular, 14px, #757575
- Deadline badge: #FFB300 bg if <7 days, #00C853 if >7 days
  - "Confirm by: 7 April (5 days)" — countdown

**Event Card**
- Background: #FFFFFF
- Padding: 16px
- Border-radius: 8px
- Margin-bottom: 12px
- Box-shadow: 0 1px 4px rgba(0,0,0,0.06)

**Event Details (Per Card)**
- Event name: Inter SemiBold, 18px, #121216
- Entry time: Inter Mono, 16px, #757575, "Entry time: 1:05.23"
- Fee: Inter Regular, 14px, #121216, "Fee: £12.00"

**Action Buttons (Per Event)**
- [Confirm]: #00FF90 bg, #121216 text, 40px height, 50% width minus 4px gap
- [Withdraw]: Outline, #D32F2F border, #D32F2F text, 40px height, 50% width
- Confirmed state: button changes to "✓ Confirmed", disabled, #E0E0E0 bg
- Withdrawn state: card greys out, "Withdrawn" badge

**Total Summary**
- Background: #F0F0EC (canvas colour)
- Padding: 16px
- Border-top: 1px #E0E0E0
- Total amount: DM Serif Display, 28px, #121216, "£36.00"
- Event count: Inter Regular, 14px, #757575, "(3 events confirmed)"

**Payment Notice**
- Inter Regular, 14px, #757575
- Icon: GoCardless logo, 16px, left of text
- Text: "Payment via Direct Debit on 8 April"

**Primary CTA**
- [Confirm All Entries]: #00FF90 bg, #121216 text, full width, 48px height
- Position: Fixed bottom or after summary
- Disabled until at least 1 event confirmed
- Loading state: spinner, "Processing..."

**States**
- **All confirmed:** Button text "Proceed to Payment", #00C853 bg
- **Some withdrawn:** Shows remaining total
- **All withdrawn:** Button text "No entries", disabled

**Accessibility**
- Each event card: `role="article"`, labelled region
- Confirm/Withdraw: Clear labels, "Confirm entry for 100m Freestyle"
- Total announced: Screen reader "Total cost 36 pounds"
- Focus visible on all buttons

---

## Screen 4: File Generation (Competition Secretary — Desktop)

### Layout
```
+------------------------------------------------------------+
|  [Sidebar] | GENERATE ENTRY FILE: Kent County Champs      |
|            |                                               |
|            | Export Format                                 |
|            | +------------------------------------------+  |
|            | | ⦿ Hy-Tek HY3 (recommended for UK)       |  |
|            | | ○ SportSystems TXT                       |  |
|            | | ○ SDIF SD3                               |  |
|            | | ○ Lenex XML                              |  |
|            | +------------------------------------------+  |
|            |                                               |
|            | Entry Summary (23 swimmers, 67 events)       |
|            | +------------------------------------------+  |
|            | | Swimmer       | Events | Status  | Fee   |  |
|            | |---------------|--------|---------|-------|  |
|            | | Alfie Tempest | 3      | ✓ Paid  | £36   |  |
|            | | Kassidy T     | 4      | ⚠ Pend  | £48   |  |
|            | | Jamie Smith   | 2      | ✓ Paid  | £24   |  |
|            | | ...           |        |         |       |  |
|            | +------------------------------------------+  |
|            |                                               |
|            | Validation Warnings                           |
|            | +------------------------------------------+  |
|            | | ⚠ 2 unpaid entries (Kassidy T, Alex D)   |  |
|            | | ⚠ 1 missing entry time (Jamie Smith 200IM)|  |
|            | +------------------------------------------+  |
|            |                                               |
|            | [Fix Issues] [Download File (.hy3)]          |
+------------------------------------------------------------+
```

### Visual Specifications

**Page Header**
- Title: "GENERATE ENTRY FILE: Kent County Champs"
  - DM Serif Display, 28px, #121216
- Subtitle: Meet date, entry deadline — Inter Regular, 14px, #757575

**Format Selector**
- Radio button group: 24px radio buttons, 16px vertical gap
- Labels: Inter Regular, 16px, #121216
- Recommended badge: "(recommended for UK)" — #00FF90 text, 12px
- Icons: Format-specific (Hy-Tek logo, etc.), 20px, left of label
- Selection: Radio border #00FF90, filled dot

**Entry Summary Stats**
- "23 swimmers, 67 events" — Inter Medium, 18px, #121216
- Background: #F0F0EC, 12px padding, 8px border-radius

**Summary Table**
- Headers: Inter SemiBold, 14px, #757575, uppercase
- Rows: Inter Regular, 14px, #121216, 48px height
- Zebra striping: odd rows #FAFAF8
- Hover: #F0F0EC background
- Status badges:
  - ✓ Paid: #00C853 text + icon
  - ⚠ Pending: #FFB300 text + icon
  - ✗ Unpaid: #D32F2F text + icon
- Fee column: Tabular numerals, right-aligned

**Validation Warnings**
- Section: Background #FFF3CD (light amber)
- Border-left: 4px #FFB300
- Padding: 16px
- Icon: ⚠ 20px, #FFB300
- Text: Inter Regular, 14px, #121216
- Links: "Kassidy T" — underlined, #00FF90, opens member record

**Action Buttons**
- [Fix Issues]: Secondary, #FFB300 bg if warnings exist, disabled if none
- [Download File (.hy3)]: Primary, #00FF90 bg, #121216 text
  - Icon: Download arrow, 16px, left of text
  - Disabled if validation errors (not warnings)
  - Loading state: spinner + "Generating file..."

**Success State (After Download)**
- Toast notification: "File downloaded: kent-county-2026.hy3"
- Background: #00C853
- Icon: Checkmark, 20px
- Duration: 5 seconds, dismissible

**Accessibility**
- Table: Proper `<thead>`, `<tbody>`, scope attributes
- Radio group: `fieldset` + `legend`
- Warnings: `role="alert"`, announced on load if present
- Download button: Disabled state clearly communicated

---

## Screen 5: Results Import (Competition Secretary — Desktop)

### Layout
```
+------------------------------------------------------------+
|  [Sidebar] | IMPORT RESULTS: Kent County Champs            |
|            |                                               |
|            | Upload Result File                            |
|            | +------------------------------------------+  |
|            | |  📁 Drag file here or click to browse   |  |
|            | |     Supported: .hy3, .sd3, .lef, .xml   |  |
|            | +------------------------------------------+  |
|            |                                               |
|            | Preview Results (67 entries)                  |
|            | +------------------------------------------+  |
|            | | Event         | Swimmer   | Time   | Place||
|            | |---------------|-----------|--------|------||
|            | | 100 Free Boys | Alfie T   | 1:15.2 | 3rd ⭐||
|            | | 50 Back Girls | Kassidy T | 36.89  | 1st ⭐||
|            | | 200 IM Boys   | Jamie S   | DQ     | -   ||
|            | +------------------------------------------+  |
|            |                                               |
|            | Personal Bests Detected (12)                  |
|            | +------------------------------------------+  |
|            | | ⭐ Alfie Tempest: 100 Free (was 1:18.34)  |  |
|            | | ⭐ Kassidy T: 50 Back (was 37.12)         |  |
|            | | ...                                       |  |
|            | +------------------------------------------+  |
|            |                                               |
|            | [Cancel] [Approve & Publish to Parents]       |
+------------------------------------------------------------+
```

### Visual Specifications

**File Upload Zone**
- Border: 2px dashed #E0E0E0
- Background: #FAFAF8
- Height: 120px
- Icon: Folder, 48px, #757575, centred
- Text: Inter Regular, 16px, #121216
- Supported formats: Inter Regular, 12px, #757575
- Drag-over state: border #00FF90, background lighten 5%
- Uploaded state: Shows filename, file size, [Remove] link

**Preview Table**
- Same styling as Entry Summary table
- Additional columns: Time (tabular mono), Place (ordinal: 1st, 2nd, DQ)
- PB indicator: ⭐ icon, 16px, #E8F059 (lime accent), right of time
- DQ row: text #D32F2F, italic

**Personal Bests Section**
- Background: #F0F0EC (canvas)
- Border-left: 4px #E8F059 (lime)
- Padding: 16px
- Header: "Personal Bests Detected (12)" — DM Serif Display, 20px
- List items:
  - Icon: ⭐ 16px, #E8F059
  - Swimmer: Inter SemiBold, 16px, #121216
  - Event: Inter Regular, 14px, #757575
  - Old PB: "(was 1:18.34)" — Inter Mono, 12px, #9E9E9E, strikethrough
  - New PB: Bold, #00C853

**Action Buttons**
- [Cancel]: Ghost, #757575
- [Approve & Publish to Parents]: Primary, #00FF90 bg
  - Icon: Checkmark + send, 16px
  - Loading: "Publishing..." + spinner
  - Success: Redirect to results page + toast "Results published!"

**Accessibility**
- File input: Hidden, triggered by button/drop zone
- Table: Proper headers, zebra striping for readability
- PB section: `role="region"`, labelled "Personal bests detected"

---

## Screen 6: Swimmer PB Dashboard (Parent View — Mobile)

### Layout (375px width)
```
+-------------------------------+
|  KASSIDY'S PROGRESS           |
+-------------------------------+
|                               |
|  50m Freestyle                |
|  [Line chart: Jan-Mar 2026]   |
|  📈 Trending -2.3s (3 months) |
|                               |
|  Current PB: 36.89            |
|  Kent Counties • 14 Apr 2026  |
|  ⭐ New Personal Best!         |
|                               |
|  Qualifying Times             |
|  County:    38.50  ✓          |
|  Regional:  36.00  ⚠ (0.89s)  |
|  National:  34.50  ✗          |
|                               |
+-------------------------------+
|  Recent Results               |
+-------------------------------+
|  +-------------------------+  |
|  | Kent Counties           |  |
|  | 14 Apr • 50 Free • 36.89|  |
|  | 1st place ⭐            |  |
|  +-------------------------+  |
|                               |
|  +-------------------------+  |
|  | Tonbridge Open          |  |
|  | 2 Mar • 50 Free • 38.12 |  |
|  | 3rd place               |  |
|  +-------------------------+  |
|                               |
|  +-------------------------+  |
|  | Club Champs             |  |
|  | 1 Feb • 50 Free • 39.23 |  |
|  | 2nd place               |  |
|  +-------------------------+  |
+-------------------------------+
```

### Visual Specifications

**Page Header**
- Title: "KASSIDY'S PROGRESS" — DM Serif Display, 24px, #121216
- Background: #FAFAF8, full width

**Event Selector**
- Dropdown: "50m Freestyle" — Inter Medium, 18px
- All events with PBs shown in list
- Icon: Chevron, 20px

**PB Chart**
- Type: Line chart, stroke #00FF90, 2px
- Points: Circles, 6px diameter, #00FF90 fill
- Grid: Light grey, 1px, horizontal only
- X-axis: Month labels (Jan, Feb, Mar)
- Y-axis: Time in seconds (36.0, 37.0, 38.0, 39.0)
- Tooltip on tap: "2 Mar 2026: 38.12 (Tonbridge Open)"

**Trend Badge**
- "📈 Trending -2.3s (3 months)"
- Background: #00C853 (green if improving), #D32F2F (red if slower)
- Icon: Up arrow (improving), down arrow (slower)
- Text: Inter Medium, 14px, white

**Current PB Card**
- Background: #FFFFFF
- Border: 2px #00FF90 (highlight as primary stat)
- Padding: 16px
- Time: DM Serif Display, 36px, #121216
- Meet name: Inter Regular, 14px, #757575
- Date: Inter Regular, 12px, #757575
- PB badge: "⭐ New Personal Best!" — #E8F059 bg, #121216 text

**Qualifying Times**
- Section header: "Qualifying Times" — Inter SemiBold, 16px, #121216
- List: 3 rows (County, Regional, National)
- Format per row:
  - Level: Inter Medium, 14px, #121216
  - Time: Inter Mono, 14px, #757575, right-aligned
  - Status icon:
    - ✓ Met: #00C853
    - ⚠ Close: #FFB300, "(0.89s)" distance shown
    - ✗ Not met: #D32F2F

**Recent Results Cards**
- Background: #FFFFFF
- Border-radius: 8px
- Box-shadow: 0 1px 4px rgba(0,0,0,0.06)
- Padding: 12px
- Meet name: Inter SemiBold, 16px, #121216
- Details row: Inter Regular, 12px, #757575, "14 Apr • 50 Free • 36.89"
- Place: Inter Medium, 14px, #121216
- PB star: ⭐ if new PB, 16px, right-aligned

**Accessibility**
- Chart: Data table alternative provided
- Trend: Announced as "Improving by 2.3 seconds over 3 months"
- Qualifying status: "Met county standard, 0.89 seconds from regional"

---

## Component Specifications

### 1. Eligibility Badge Component

**Props:**
- `status`: "eligible" | "close" | "ineligible"
- `timeDifference?`: number (seconds off qualifying)

**Variants:**

**Eligible (Green)**
```html
<span class="eligibility-badge eligible">
  <svg class="icon-checkmark">...</svg>
  <span>Eligible</span>
</span>
```
- Background: #E8F5E9 (light green)
- Border: 1px #00C853
- Text: #00C853, Inter Medium, 12px
- Icon: Checkmark, 14px

**Close (Amber)**
```html
<span class="eligibility-badge close">
  <svg class="icon-warning">...</svg>
  <span>Close (2.3s off)</span>
</span>
```
- Background: #FFF8E1 (light amber)
- Border: 1px #FFB300
- Text: #FFB300, Inter Medium, 12px
- Icon: Warning triangle, 14px
- Shows time difference in parentheses

**Ineligible (Red)**
```html
<span class="eligibility-badge ineligible">
  <svg class="icon-x">...</svg>
  <span>Ineligible</span>
</span>
```
- Background: #FFEBEE (light red)
- Border: 1px #D32F2F
- Text: #D32F2F, Inter Medium, 12px
- Icon: X in circle, 14px

---

### 2. PB Badge Component

**Props:**
- `isNewPB`: boolean

**Rendered (if true):**
```html
<span class="pb-badge">
  <svg class="icon-star">⭐</svg>
  <span>New PB!</span>
</span>
```
- Background: #E8F059 (lime)
- Text: #121216, Inter SemiBold, 12px
- Icon: Star, 16px
- Padding: 4px 8px
- Border-radius: 12px (pill shape)

---

### 3. File Format Selector Component

**Props:**
- `formats`: Array<{ id: string, name: string, recommended?: boolean }>
- `selected`: string
- `onChange`: (id: string) => void

**Rendered:**
```html
<fieldset class="format-selector">
  <legend>Export Format</legend>
  <div class="format-option">
    <input type="radio" id="hytek" name="format" checked>
    <label for="hytek">
      <span class="format-name">Hy-Tek HY3</span>
      <span class="badge-recommended">recommended for UK</span>
    </label>
  </div>
  <!-- More options -->
</fieldset>
```

**Styles:**
- Radio button: 20px, #00FF90 when selected
- Label: Inter Regular, 16px, #121216
- Recommended badge: #00FF90 text, 12px, Inter Medium
- Hover: Background #F0F0EC
- Spacing: 12px between options

---

### 4. Entry Fee Summary Component

**Props:**
- `events`: number
- `feePerEvent`: number
- `siblingDiscount?`: number
- `total`: number

**Rendered:**
```html
<div class="fee-summary">
  <div class="fee-row">
    <span class="label">3 events × £12.00</span>
    <span class="amount">£36.00</span>
  </div>
  <div class="fee-row discount">
    <span class="label">Sibling discount (10%)</span>
    <span class="amount">-£3.60</span>
  </div>
  <div class="fee-row total">
    <span class="label">Total</span>
    <span class="amount">£32.40</span>
  </div>
</div>
```

**Styles:**
- Background: #F0F0EC
- Padding: 12px
- Border-radius: 8px
- Rows: Flex, space-between
- Label: Inter Regular, 14px, #757575
- Amount: Inter Mono, 14px, #121216, right-aligned
- Total row: Border-top 1px #E0E0E0, amount bold, 18px

---

## Interaction States

### Loading States
- Buttons: Replace text with spinner (16px) + "Processing..."
- Tables: Skeleton rows, animated pulse
- File upload: Progress bar, 0-100%
- Charts: Loading spinner centred

### Error States
- Form validation: Red border + icon + helper text below
- File upload: "Invalid file format" banner, #D32F2F bg
- Network error: Toast notification, "Connection lost — retry?"

### Empty States
- No PBs: "No times recorded yet. Results will appear here after galas."
  - Illustration: Stopwatch icon, 64px, #E0E0E0
  - Text: Inter Regular, 16px, #757575, centred
- No entries: "No swimmers entered yet. Coaches can add entries."

### Success States
- File downloaded: Toast, #00C853 bg, checkmark icon
- Entry confirmed: Button changes to "✓ Confirmed", disabled
- Results published: Banner, "Results sent to 23 parents"

---

## Developer Handoff Notes

### Asset Exports
- Icons: SVG, 16px/20px/24px variants
- Logos: Hy-Tek, SportSystems (if available)
- Illustrations: Empty states, error states
- Colour palette: CSS custom properties
- Typography: Inter + DM Serif Display WOFF2 files

### Component Library
- All components built in React + TypeScript
- Tailwind CSS for utility classes
- shadcn/ui base components where applicable
- Storybook documentation for each component

### Accessibility Checklist
- [ ] WCAG 2.1 AA compliant
- [ ] Keyboard navigation tested
- [ ] Screen reader tested (NVDA/JAWS)
- [ ] Focus indicators visible
- [ ] Colour contrast ratios verified
- [ ] ARIA labels on all interactive elements
- [ ] Error messages linked to fields
- [ ] Mobile touch targets ≥44px

### Responsive Behaviour
- Gala Setup: Desktop-only (complex form)
- Entry Selection: Mobile-first (coach poolside)
- Parent Confirmation: Mobile-first (parents on phones)
- File Generation: Desktop-only (admin task)
- Results Import: Desktop-only (admin task)
- PB Dashboard: Mobile-first (parent engagement)

---

## Timeline & Priorities

**By 15 March:**
- [ ] Component specifications approved
- [ ] Colour/typography tokens defined
- [ ] Icon set finalised

**By 18 March:**
- [ ] Desktop screens (Gala Setup, File Generation, Results Import)
- [ ] Component library scaffolding

**By 20 March (DEADLINE):**
- [ ] Mobile screens (Entry Selection, Parent Confirmation, PB Dashboard)
- [ ] All accessibility annotations complete
- [ ] Developer handoff package ready

**Priority Order:**
1. Entry Selection (Coach Mobile) — highest usage, Q2 blocker
2. Parent Confirmation — critical user trust moment
3. Gala Setup — needed for Q2 sprint planning
4. File Generation — table-stakes feature
5. Results Import — post-gala workflow
6. PB Dashboard — engagement feature, lower priority

---

**Specification Version:** 1.0  
**Last Updated:** 9 March 2026  
**Status:** Ready for Engineering Review
