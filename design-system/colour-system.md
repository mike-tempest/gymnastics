# Tumblebase colour system

Tumblebase uses sage highlights, forest navigation and warm chalk surfaces, with terracotta actions. The palette lives in `apps/web/src/lib/brand-colours.ts` and is consumed by Tailwind. Semantic shadcn variables in `apps/web/src/app/globals.css` mirror these colours for light and dark themes. Static icons and the web manifest must stay in sync with the palette.

| Role                   | Colour    | Tailwind token |
| ---------------------- | --------- | -------------- |
| Sage highlight         | `#B9D8CB` | `brand`        |
| Sage hover             | `#A5CABB` | `brand-dark`   |
| Forest navigation      | `#1C302A` | `dark-primary` |
| Forest links and focus | `#365E54` | `teal`         |
| Terracotta action      | `#A44932` | `coral`        |
| Terracotta hover       | `#893B2A` | `coral-hover`  |
| Chalk canvas           | `#F4F2EC` | `canvas`       |
| Raised surface         | `#FAF9F5` | `surface`      |

Existing token names are retained to avoid unrelated component rewrites. Use sage with forest text, or as a highlight on forest surfaces. Use white text on terracotta actions. Sage is not body text on a light background. Light-page focus outlines use forest; dark inputs use sage rings.

Use Tailwind tokens rather than raw colours or inline styles in React components. Preserve textual status labels so colour is never the only indicator. Interactive targets should be at least 48 by 48 pixels.

The Tumblebase mark combines a balanced T, a base and a small raised circle. The wordmark and icons live in `apps/web/public/`. Product wording comes from the web/service brand configurations; Gymnast/Gymnasts come from the display-noun constants.
