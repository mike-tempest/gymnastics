import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL || 'https://web-app-production-7a4c.up.railway.app';
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login page
  await page.goto(baseURL + '/login');
  
  // Login with test credentials
  await page.fill('input[type="email"]', process.env.TEST_EMAIL!);
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD!);
  await page.click('button:has-text("Sign In")');
  
  // Wait for navigation to complete
  await page.waitForURL('**/dashboard');
  
  // Save authentication state
  await context.storageState({ path: 'playwright/.auth/user.json' });
  
  await browser.close();
}

export default globalSetup;
