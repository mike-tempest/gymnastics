# Tumblebase colour system

Mike approved the five-colour palette in TEM-114 on 21 September 2026. Teal gives the interface structure, raspberry draws attention to actions, plum adds depth, and aqua and gold bring energy to highlights. Keep reading surfaces neutral and use generous whitespace.

The approved values and app roles live in `apps/web/src/lib/brand-colours.ts`, consumed by Tailwind. Semantic shadcn variables in `apps/web/src/app/globals.css` mirror the roles for light and dark themes. The active marketing site mirrors the palette in `marketing-site/site/styles/global.css`.

| Colour    | Value     | Role                                            | App token                      | Marketing token             |
| --------- | --------- | ----------------------------------------------- | ------------------------------ | --------------------------- |
| Gold      | `#FFBC42` | Milestones, data accents, warning highlights    | `gold`, `lime`, `warning`      | `gold`                      |
| Raspberry | `#D81159` | Primary actions on light surfaces               | `coral`, light-theme `primary` | `raspberry`, legacy `clay`  |
| Plum      | `#8F2D56` | Action hover, feature panels, deeper accents    | `plum`, `coral-hover`          | `plum`, legacy `clay-hover` |
| Teal      | `#218380` | Brand structure, large display text, charts     | `teal`                         | `teal`                      |
| Aqua      | `#73D2DE` | Dark-surface links, selected states, highlights | `brand`, dark-theme `primary`  | `aqua`, legacy `sage`       |

## Supporting shades

| Role                        | Value     | App token                     | Marketing token |
| --------------------------- | --------- | ----------------------------- | --------------- |
| Deep teal                   | `#122F35` | `dark-primary`                | `forest`        |
| Dark surface                | `#194148` | `dark-secondary`              | Not used        |
| Raised dark surface         | `#20515A` | `dark-card`, `dark-tertiary`  | Not used        |
| Teal text on light surfaces | `#176562` | `teal-dark`, light focus ring | `forest-soft`   |
| Aqua hover                  | `#55B8C5` | `brand-dark`                  | Not used        |
| Pale aqua                   | `#BAE8EE` | `brand-light`                 | Not used        |
| Aqua surface tint           | `#E3F5F7` | Not used                      | `sage-light`    |
| Chalk canvas                | `#F4F2EC` | `canvas`                      | `chalk`         |
| Raised light surface        | `#FAF9F5` | `surface`                     | `paper`         |

Existing token names are retained to avoid unrelated component rewrites. The app's `sage` alias still names neutral surfaces; its `lime` alias now names gold data accents. Use the documented role rather than assuming a legacy name describes its current hue. Error red remains separate from the brand palette, and status labels must remain visible.

## Contrast and usage

[WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) requires at least 4.5:1 for normal text and 3:1 for large text. Ratios below are calculated from the specified colours, rounded only for display.

| Foreground          | Background          | Contrast | Use                                    |
| ------------------- | ------------------- | -------- | -------------------------------------- |
| White `#FFFFFF`     | Raspberry `#D81159` | 5.07:1   | App action labels                      |
| Paper `#FAF9F5`     | Raspberry `#D81159` | 4.81:1   | Marketing action labels                |
| Paper `#FAF9F5`     | Plum `#8F2D56`      | 7.44:1   | Feature panels and hovered actions     |
| Deep teal `#122F35` | Aqua `#73D2DE`      | 8.09:1   | Highlight and secondary action labels  |
| Deep teal `#122F35` | Gold `#FFBC42`      | 8.44:1   | Milestone labels and highlights        |
| Aqua `#73D2DE`      | Dark card `#20515A` | 5.03:1   | Dark-surface links and selected states |

Do not use aqua or gold as normal text on pale backgrounds, or white text on aqua or gold. Teal `#218380` on chalk is 4.06:1, so reserve that pairing for large text and use `#176562` for smaller links and labels. Do not put aqua text on plum; use paper or gold there. Brand colours are not a substitute for labelled statuses or distinguishable chart shapes.

Light-page focus rings use deep teal in the app. Dark-theme rings and dark inputs use aqua. Marketing uses a two-colour focus indicator so it remains visible on both pale and dark sections. Use Tailwind tokens rather than raw colours or inline styles in React components. Interactive targets should be at least 48 by 48 pixels.

## Icons

The Tumblebase mark keeps its balanced T, base and raised circle: aqua strokes and a gold circle on deep teal. SVG sources and the web manifest must stay in sync with the palette. Run `node scripts/generate-icons.mjs` after editing the app favicon SVG to regenerate the app PNG/ICO sizes and marketing favicon/touch icon. The wordmark lives in `apps/web/public/tumblebase-logo.svg`.

Product wording comes from the web/service brand configurations; Gymnast/Gymnasts come from the display-noun constants.
