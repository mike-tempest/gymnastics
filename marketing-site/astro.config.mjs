// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// Single-build, deploy-split internationalisation model
// -----------------------------------------------------
// One `npm run build` produces the entire static output for every region.
// The deploy step (owned by a separate unit) then splits that output across
// two domains:
//
//   - UK lives at the root of the output and ships to swimly.uk
//       e.g. /pricing/        -> https://swimly.uk/pricing/
//   - US, CA, AU and the international hub ship to swimly.club
//       e.g. us/pricing/      -> https://swimly.club/us/pricing/
//            ca/...           -> https://swimly.club/ca/...
//            au/...           -> https://swimly.club/au/...
//            international/    -> https://swimly.club/international/
//
// There is deliberately no /intl/ prefix anywhere. The site stays fully
// static, so no SSR adapter is configured. `site` below is only Astro's
// default base; per-page canonical and host values are driven by the region
// config rather than by Astro.site, which is why it remains swimly.uk even
// though the build also produces swimly.club pages.
//
// https://astro.build/config
export default defineConfig({
  site: 'https://swimly.uk',
  trailingSlash: 'always',
  // .nosync keeps iCloud Drive from evicting build output mid-deploy.
  // This repo lives under the iCloud-synced Documents folder, and eviction
  // during the FTP upload caused missing-file deploy failures (June 2026).
  outDir: './dist.nosync',
  vite: {
    plugins: [tailwindcss()]
  }
});