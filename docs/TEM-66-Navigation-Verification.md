# TEM-66: Navigation and copy verification

## Changes

- Mobile navigation uses a Radix dialog: focus stays inside while open, Escape closes it and focus returns to the menu button. Closed navigation and collapsed sections are removed from keyboard and accessibility navigation.
- Account actions use the Radix dropdown menu. Navigation and account controls have 48px minimum touch targets and visible focus indicators. Current-page links have `aria-current`.
- Removed the placeholder notification control, inactive global search input (implementation remains TEM-65), and the standalone Mandates link to a callback-only page.
- Head coaches can reach the existing waiting-list page; squad coaches no longer see its unsupported link. Awards routes now use the existing role gate. Treasurer routing agrees with the existing web role model. API permissions remain authoritative.
- Parent and Welfare Officer logo links use their permitted home pages. The gymnast list hides import, create and delete controls from roles without the corresponding API permissions.
- Corrected swimming references in club setup, squad examples, billing and email copy. New club settings use the actual club name. Product examples and fallback names use the central brand modules. Removed the unrelated swimming health claim from cycle-tracking copy.
- Error and offline states have accessible announcements, 48px controls and contrasting colours.

## Verification

- All unit tests, including the database-backed GoCardless tenant-isolation suite, run against a dedicated disposable PostgreSQL container. No shared application database used.
- Browser checks cover administrator, head coach, parent and Welfare Officer at 390px, 768px and 1280px widths. Checks cover mobile focus containment, Escape and focus return, account-menu keyboard access, navigation target sizes and horizontal overflow.
- Browser sessions and API errors are controlled fixtures. These checks establish local UI behaviour, not deployed-service or live-payment acceptance.
- Visual inspection covers the mobile drawer and desktop error state. Calculated contrast ratios: sidebar secondary text 6.03:1; error heading 9.16:1; error detail 7.6:1; focus outline 9.13:1; offline-banner text 9.16:1. Values are verified from the configured colours; see the final task record for gate results.
- No schema change. Historical migrations, excluded parsers and the flagged-off competition module are unchanged. Regional governing-body names and import aliases retain their legitimate names.

This is a focused navigation audit, not a claim that every inherited screen has passed a full WCAG audit. VoiceOver/NVDA testing and live-service acceptance were not performed.
