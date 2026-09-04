# Swimly Accessibility Standards

**Last Updated:** 10 March 2026  
**Owner:** Swimly Design  
**Target:** WCAG 2.1 AA Compliance (minimum)  
**Why:** Swim clubs include swimmers and parents with disabilities. Accessibility is not optional.

---

## Accessibility Principles

### 1. Perceivable
Users must be able to perceive all information and UI components.
- Text alternatives for non-text content
- Captions and alternatives for multimedia
- Adaptable content that can be presented in different ways
- Distinguishable content (colour contrast, text size, visual clarity)

### 2. Operable
Users must be able to operate the interface.
- Keyboard accessible (all functionality available via keyboard)
- Enough time to read and use content (no time limits on critical tasks)
- Seizure prevention (no flashing content)
- Navigable (clear headings, landmarks, focus indicators)

### 3. Understandable
Users must be able to understand the information and operation of the UI.
- Readable text (plain language, British English)
- Predictable operation (consistent navigation, consistent identification)
- Input assistance (error identification, labels, error prevention)

### 4. Robust
Content must be robust enough to be interpreted by a wide variety of user agents, including assistive technologies.
- Compatible with current and future assistive technologies
- Valid HTML, proper semantic markup
- ARIA labels where needed (but prefer semantic HTML first)

---

## Colour Contrast Requirements

### WCAG 2.1 Level AA Standards

**Normal Text (< 24px / < 19px bold):**
- Minimum contrast ratio: **4.5:1**

**Large Text (≥ 24px / ≥ 19px bold):**
- Minimum contrast ratio: **3:1**

**UI Components and Graphics:**
- Minimum contrast ratio: **3:1**

### Swimly Colour Compliance

**Tested Combinations (Pass):**

| Foreground | Background | Contrast | Use Case | Pass |
|------------|------------|----------|----------|------|
| `#121216` (Dark Primary) | `#FAFAF8` (Surface) | 15.8:1 | Body text on cards | ✅ AAA |
| `#121216` (Dark Primary) | `#F0F0EC` (Canvas) | 14.2:1 | Body text on canvas | ✅ AAA |
| `#00FF90` (Brand Green) | `#121216` (Dark Primary) | 8.2:1 | Links/buttons on dark | ✅ AAA |
| `#E8F059` (Lime) | `#121216` (Dark Primary) | 12.1:1 | Data highlights on dark | ✅ AAA |
| White `#FFFFFF` | `#00FF90` (Brand Green) | 2.9:1 | Button text on green | ⚠️ AA large text only |

**Problem Combinations (Avoid):**

| Foreground | Background | Contrast | Issue | Fix |
|------------|------------|----------|-------|-----|
| `#00FF90` (Brand Green) | `#F0F0EC` (Canvas) | 1.8:1 | Too low | Use Dark Primary for text |
| `#E8F059` (Lime) | `#FAFAF8` (Surface) | 1.5:1 | Too low | Use Dark Primary for text |

**Rule:** Never use Brand Green or Lime for body text on light backgrounds. Use Dark Primary (`#121216`) for all body text.

### Testing Tools
- **Browser DevTools:** Chrome Lighthouse, Firefox Accessibility Inspector
- **Online:** WebAIM Contrast Checker, Colour Contrast Analyser
- **Design:** Figma A11y plugin, Stark plugin

---

## Keyboard Navigation

### Requirements
All interactive elements must be keyboard accessible:
- **Tab:** Move forward through interactive elements
- **Shift + Tab:** Move backward through interactive elements
- **Enter / Space:** Activate buttons, links, checkboxes
- **Arrow keys:** Navigate within groups (radio buttons, dropdowns, tabs)
- **Escape:** Close modals, cancel actions

### Focus Indicators

**Visible Focus:**
- Focus indicator must have **minimum 3:1 contrast** against background
- Focus indicator must be **visible around entire element**
- Default browser outline acceptable if meets contrast requirement
- Custom focus styles must be at least 2px solid outline

**Swimly Focus Style:**
```css
:focus-visible {
  outline: 2px solid #00FF90; /* Brand Green */
  outline-offset: 2px;
  border-radius: 4px;
}
```

**Never Remove Focus Outlines:**
❌ `outline: none;` on `:focus` is banned  
✅ Use `:focus-visible` to hide on mouse click but show on keyboard

### Tab Order
- Tab order follows visual order (top to bottom, left to right)
- Skip links provided for navigation ("Skip to main content")
- No keyboard traps (user can always tab out)

### Skip Links
Every page must have a skip link to main content:
```html
<a href="#main-content" class="skip-link">
  Skip to main content
</a>
```

Style: Hidden until focused:
```css
.skip-link {
  position: absolute;
  left: -9999px;
  z-index: 999;
}

.skip-link:focus {
  left: 0;
  top: 0;
  padding: 1rem;
  background: #121216;
  color: #00FF90;
}
```

---

## Screen Reader Compatibility

### Semantic HTML First
Use semantic HTML before reaching for ARIA:
- `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`
- `<button>` not `<div onclick>`
- `<a href>` for links, `<button>` for actions
- `<label>` for form fields
- `<table>`, `<th>`, `<td>` for data tables

### ARIA Labels (When Needed)

**Use ARIA when:**
- Semantic HTML is insufficient (e.g., custom widgets)
- Dynamic content updates (live regions)
- Complex interactions (tabs, accordions, modals)

**Common ARIA Patterns in Swimly:**

**Loading States:**
```html
<div role="status" aria-live="polite" aria-label="Loading">
  <Spinner />
  <span class="sr-only">Loading members...</span>
</div>
```

**Form Validation Errors:**
```html
<label for="swimmer-name">Swimmer Name</label>
<input 
  id="swimmer-name" 
  type="text" 
  aria-invalid="true" 
  aria-describedby="name-error"
/>
<span id="name-error" role="alert" class="error">
  Name is required
</span>
```

**Modal Dialogs:**
```html
<div 
  role="dialog" 
  aria-labelledby="modal-title" 
  aria-describedby="modal-description"
  aria-modal="true"
>
  <h2 id="modal-title">Delete Member</h2>
  <p id="modal-description">
    Are you sure you want to delete Emma Davies?
  </p>
  <button>Cancel</button>
  <button>Delete</button>
</div>
```

**Icon Buttons:**
```html
<button aria-label="Close">
  <CloseIcon aria-hidden="true" />
</button>
```

**Data Tables:**
```html
<table>
  <caption>Member Payment Status</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Amount</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Emma Davies</th>
      <td>£45.00</td>
      <td>Paid</td>
    </tr>
  </tbody>
</table>
```

### Screen Reader Testing
Test with:
- **macOS:** VoiceOver (Safari + Chrome)
- **Windows:** NVDA (Firefox + Chrome)
- **iOS:** VoiceOver (Safari)
- **Android:** TalkBack (Chrome)

---

## Form Accessibility

### Labels
Every form field must have a visible, programmatically associated label:

**Good:**
```html
<label for="email">Email address</label>
<input id="email" type="email" name="email" />
```

**Bad:**
```html
<!-- ❌ No label -->
<input type="email" placeholder="Email address" />

<!-- ❌ Label not associated -->
<div>Email address</div>
<input type="email" name="email" />
```

### Placeholders Are Not Labels
Placeholders disappear on focus/input. Always use a visible `<label>`.

**Acceptable use of placeholders:**
- As examples: `placeholder="e.g., emma.davies@example.com"`
- As format hints: `placeholder="DD/MM/YYYY"`

### Required Fields
Indicate required fields clearly:

**Visual:**
- Asterisk: `Email address *`
- Text: `Email address (required)`

**Programmatic:**
```html
<label for="email">
  Email address <abbr title="required">*</abbr>
</label>
<input id="email" type="email" required aria-required="true" />
```

### Error Messages

**Requirements:**
1. Errors linked to fields via `aria-describedby`
2. Errors announced via `role="alert"` or `aria-live="polite"`
3. Error text descriptive, not just "Invalid"
4. Error styling uses more than colour (icon + text)

**Good Error Handling:**
```html
<label for="dob">Date of Birth</label>
<input 
  id="dob" 
  type="text" 
  aria-invalid="true" 
  aria-describedby="dob-error"
/>
<span id="dob-error" role="alert" class="error">
  ⚠️ Date of birth must be in DD/MM/YYYY format
</span>
```

**Error Summary (Top of Form):**
```html
<div role="alert" class="error-summary" tabindex="-1">
  <h2>There are 2 errors in this form</h2>
  <ul>
    <li><a href="#email">Email address is required</a></li>
    <li><a href="#dob">Date of birth is invalid</a></li>
  </ul>
</div>
```

### Autocomplete
Use `autocomplete` attributes for common fields:

```html
<input type="email" name="email" autocomplete="email" />
<input type="text" name="name" autocomplete="name" />
<input type="tel" name="phone" autocomplete="tel" />
<input type="text" name="postcode" autocomplete="postal-code" />
```

Benefits:
- Faster form completion (browser autofill)
- Reduced errors (no typos)
- Better for users with cognitive disabilities

---

## Mobile Accessibility

### Touch Targets
Minimum touch target size: **44×44px** (WCAG 2.5.5 Level AAA)

**Critical actions (poolside, wet hands):** 48×48px

**Spacing between targets:** 8px minimum gap

### Viewport and Zoom
Allow users to zoom up to 200% without loss of content or functionality:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
```

❌ Never use `maximum-scale=1.0` or `user-scalable=no`

### Orientation
Support both portrait and landscape orientations.  
Don't lock orientation unless essential (e.g., video playback).

### Motion
Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Typography Accessibility

### Font Size
- **Minimum body text:** 16px on mobile, 14px on desktop
- **Allow user zoom:** Don't disable browser zoom
- **Relative units:** Use `rem` or `em`, not `px` for font sizes

### Line Height
- **Minimum line height:** 1.5× font size
- **Paragraph spacing:** 2× font size (1.5rem if body is 1rem)

### Text Spacing
- **Letter spacing:** At least 0.12× font size
- **Word spacing:** At least 0.16× font size
- **Paragraph spacing:** At least 2× font size

**Example:**
```css
p {
  font-size: 1rem; /* 16px */
  line-height: 1.5; /* 24px */
  letter-spacing: 0.02em;
  word-spacing: 0.16em;
  margin-bottom: 1.5rem; /* 24px */
}
```

### Text Alignment
- **Left-aligned** for body text (British reading direction)
- Avoid full justification (creates awkward spacing)
- Centre-align sparingly (headings, calls-to-action only)

### Text Over Images
Ensure sufficient contrast:
- Dark overlay on images behind light text
- Light overlay on images behind dark text
- Minimum contrast: 4.5:1

---

## Interactive Elements

### Buttons

**Requirements:**
- Minimum size: 44×44px (mobile), 32×32px (desktop)
- Clear hover/focus/active states
- Descriptive text (not just icons)
- Keyboard accessible (Enter/Space)

**Icon Buttons:**
Always include accessible label:
```html
<button aria-label="Delete member">
  <TrashIcon aria-hidden="true" />
</button>
```

### Links

**Requirements:**
- Underlined or clearly distinguishable from body text
- Descriptive link text (not "click here")
- External links indicated (icon or text)

**Good:**
```html
<a href="/members/123">View Emma Davies' profile</a>
```

**Bad:**
```html
<a href="/members/123">Click here</a>
```

### Modals

**Requirements:**
- Focus trapped within modal when open
- Escape key closes modal
- Focus returned to trigger element on close
- `aria-modal="true"` and `role="dialog"`

**Focus Management:**
```jsx
function Modal({ isOpen, onClose, children }) {
  const firstFocusableRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      firstFocusableRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button ref={firstFocusableRef} onClick={onClose} aria-label="Close">
        ×
      </button>
      <h2 id="modal-title">Modal Title</h2>
      {children}
    </div>
  );
}
```

---

## Tables

### Data Tables

**Requirements:**
- `<caption>` describing the table
- `<th scope="col">` for column headers
- `<th scope="row">` for row headers
- No merged cells (confusing for screen readers)

**Example:**
```html
<table>
  <caption>Member Payment Status — March 2026</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Amount Due</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Emma Davies</th>
      <td>£45.00</td>
      <td>Paid</td>
    </tr>
    <tr>
      <th scope="row">Tom Richards</th>
      <td>£90.00</td>
      <td>Overdue</td>
    </tr>
  </tbody>
</table>
```

### Responsive Tables

On mobile, transform to card layout:
```html
<div class="member-card" role="article">
  <h3>Emma Davies</h3>
  <dl>
    <dt>Amount Due:</dt>
    <dd>£45.00</dd>
    <dt>Status:</dt>
    <dd>Paid</dd>
  </dl>
</div>
```

---

## Images and Icons

### Decorative Images
If image is purely decorative:
```html
<img src="decoration.png" alt="" role="presentation" />
```

Empty `alt=""` tells screen readers to skip the image.

### Informative Images
If image conveys information:
```html
<img src="club-logo.png" alt="Tonbridge Swimming Club logo" />
```

### Complex Images (Charts, Diagrams)
Provide long description:
```html
<figure>
  <img src="chart.png" alt="Payment collection rate over time" />
  <figcaption>
    Payment collection rate increased from 75% in January to 95% in March 2026.
    <a href="#chart-data">View full data table</a>
  </figcaption>
</figure>

<table id="chart-data">
  <!-- Data table version of chart -->
</table>
```

### Icons
Icons must have accessible labels:

**Icon with Text:**
```html
<button>
  <PlusIcon aria-hidden="true" />
  <span>Add Member</span>
</button>
```

**Icon Only:**
```html
<button aria-label="Add member">
  <PlusIcon aria-hidden="true" />
</button>
```

---

## Notifications and Alerts

### Live Regions

**Polite (Non-Urgent):**
```html
<div role="status" aria-live="polite">
  Member saved successfully
</div>
```

**Assertive (Urgent):**
```html
<div role="alert" aria-live="assertive">
  Payment failed — please try again
</div>
```

### Toast Notifications

**Requirements:**
- Auto-dismiss after 5-10 seconds OR
- Provide dismiss button
- Announced to screen readers via `role="status"` or `role="alert"`
- Sufficient contrast (4.5:1)
- Keyboard accessible dismiss button

**Example:**
```html
<div role="alert" class="toast success">
  <p>Member added successfully</p>
  <button aria-label="Dismiss notification">×</button>
</div>
```

---

## Accessibility Testing Checklist

### Automated Testing
- [ ] Lighthouse accessibility audit (90+ score)
- [ ] axe DevTools browser extension (0 violations)
- [ ] WAVE browser extension (0 errors)
- [ ] Pa11y CI in build pipeline

### Manual Testing
- [ ] Keyboard navigation (Tab, Enter, Escape, Arrow keys)
- [ ] Screen reader (VoiceOver, NVDA)
- [ ] Colour contrast (WebAIM Contrast Checker)
- [ ] Text zoom to 200% (no content loss)
- [ ] Mobile touch targets (44×44px)
- [ ] Forms (labels, errors, validation)
- [ ] Focus indicators visible
- [ ] Alt text for images

### User Testing
- [ ] Test with users who use screen readers
- [ ] Test with users who use keyboard only
- [ ] Test with users with low vision
- [ ] Test with users with motor disabilities
- [ ] Test with users with cognitive disabilities

---

## Common Accessibility Mistakes

### Never Do This:

1. **Remove focus outlines**  
   ❌ `outline: none;` on `:focus`  
   ✅ Use `:focus-visible` with visible custom outline

2. **Use colour alone to convey meaning**  
   ❌ Red text = error (colour-blind users can't tell)  
   ✅ Red text + icon + descriptive message

3. **Use placeholder as label**  
   ❌ `<input placeholder="Email" />`  
   ✅ `<label>Email</label><input placeholder="e.g., you@example.com" />`

4. **Disable zoom**  
   ❌ `<meta name="viewport" content="maximum-scale=1.0">`  
   ✅ `<meta name="viewport" content="maximum-scale=5.0">`

5. **Use `<div>` as button**  
   ❌ `<div onclick="submit()">Submit</div>`  
   ✅ `<button onClick={submit}>Submit</button>`

6. **Unhelpful link text**  
   ❌ `<a href="/profile">Click here</a>`  
   ✅ `<a href="/profile">View Emma Davies' profile</a>`

7. **Time limits without warning**  
   ❌ Session expires in 5 minutes with no warning  
   ✅ "Your session will expire in 5 minutes. Extend?"

8. **Auto-playing media**  
   ❌ Background video auto-plays with sound  
   ✅ Video paused by default, user controls provided

---

## Accessibility Resources

### Guidelines and Standards
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/) — Official spec
- [WebAIM](https://webaim.org/) — Practical guidance
- [A11y Project](https://www.a11yproject.com/) — Beginner-friendly checklist

### Testing Tools
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) — Chrome DevTools
- [axe DevTools](https://www.deque.com/axe/devtools/) — Browser extension
- [WAVE](https://wave.webaim.org/) — Browser extension
- [Pa11y](https://pa11y.org/) — CI accessibility testing

### Screen Readers
- [VoiceOver](https://www.apple.com/accessibility/voiceover/) — macOS/iOS (free)
- [NVDA](https://www.nvaccess.org/) — Windows (free)
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) — Windows (paid)
- [TalkBack](https://support.google.com/accessibility/android/answer/6283677) — Android (free)

---

## Accessibility Maintenance

Update these standards when:
- WCAG guidelines evolve (currently 2.1, watch for 2.2)
- New UI patterns introduced (test for compliance)
- User feedback reveals accessibility barriers
- Assistive technology changes (new screen reader versions)

To propose accessibility improvements, create a task in Workshop tagged `design-system` + `accessibility`.

---

**Related:**
- [Layout Patterns](./layout-patterns.md) — Responsive layouts and touch targets
- [Components](./components.md) — Component-level accessibility specs
- [Typography](./typography.md) — Readable text, line height, font sizing
- [Colour System](./colour-system.md) — Contrast ratios and colour usage
