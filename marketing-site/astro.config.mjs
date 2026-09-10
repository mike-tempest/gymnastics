// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://tumblebase.com',
  srcDir: './site',
  publicDir: './public-tumblebase',
  trailingSlash: 'always',
  outDir: './dist.nosync',
  vite: { plugins: [tailwindcss()] },
});
