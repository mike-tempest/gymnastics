import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
  testDir: './',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: process.env.BASE_URL || 'https://web-app-production-7a4c.up.railway.app',
    headless: true,
    screenshot: 'only-on-failure',
    actionTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  reporter: [['list']],
});
