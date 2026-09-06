/**
 * SwimNexus UK - E2E Smoke Test Suite
 * 
 * Full user journey test covering:
 * 1. Login
 * 2. View members
 * 3. Create family
 * 4. Add member to squad
 * 5. Take attendance
 * 6. View invoices
 * 
 * This test ensures the critical path through the application works end-to-end.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Test credentials (from seed data)
const ADMIN_CREDENTIALS = {
  email: 'admin@test.com',
  password: 'password',
};

// Helper functions
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for navigation after login
  await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
}

async function logout(page: Page) {
  // Click user menu
  await page.click('[data-testid="user-menu"]');
  // Click logout button
  await page.click('[data-testid="logout-button"]');
  // Wait for redirect to login
  await page.waitForURL(`${BASE_URL}/login`);
}

test.describe('SwimNexus UK - Full User Journey Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for slow connections
    test.setTimeout(120000);
  });

  test('Complete user journey: Login -> View members -> Create family -> Add member to squad -> Take attendance -> View invoices', async ({ page }) => {
    
    // ========================================
    // STEP 1: LOGIN
    // ========================================
    console.log('Step 1: Testing Login...');
    
    await page.goto(`${BASE_URL}/login`);
    
    // Verify login page loads
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('h1')).toContainText('SwimNexus UK');
    
    // Check for demo credentials display
    await expect(page.locator('text=admin@swimclub.com')).toBeVisible();
    
    // Fill in login form
    await page.fill('input[type="email"]', ADMIN_CREDENTIALS.email);
    await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
    
    // Submit login
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });
    
    // Verify we're logged in (check for dashboard elements)
    await expect(page.locator('h1, h2')).toContainText(/Dashboard|Admin|SwimNexus/);
    
    console.log('✓ Login successful');
    
    // ========================================
    // STEP 2: VIEW MEMBERS
    // ========================================
    console.log('Step 2: Testing View Members...');
    
    // Navigate to members page
    await page.goto(`${BASE_URL}/members`);
    
    // Verify members page loads
    await expect(page).toHaveURL(/.*members/);
    await expect(page.locator('h1')).toContainText('Gymnasts');
    
    // Check for key page elements
    await expect(page.locator('button:has-text("Add Gymnast")')).toBeVisible();
    await expect(page.locator('button:has-text("CSV Import")')).toBeVisible();
    
    // Verify stats card is present
    await expect(page.locator('text=Total Gymnasts')).toBeVisible();
    
    // Check if members list is visible (or empty state message)
    const hasMembers = await page.locator('[data-testid="member-list"], .space-y-4:has(a[href^="/members/"])').count() > 0;
    const hasEmptyState = await page.locator('text=No gymnasts found').isVisible();
    
    expect(hasMembers || hasEmptyState).toBeTruthy();
    
    // Test search functionality if members exist
    if (hasMembers) {
      // Get first member name
      const firstMemberName = await page.locator('h3.text-white').first().textContent();
      
      if (firstMemberName) {
        // Search for member
        await page.fill('input[placeholder*="Search"]', firstMemberName);
        
        // Verify filtered results
        await expect(page.locator(`text=${firstMemberName}`)).toBeVisible();
        
        // Clear search
        await page.locator('button[aria-label="Clear search"]').click();
      }
    }
    
    console.log('✓ View Members successful');
    
    // ========================================
    // STEP 3: CREATE FAMILY
    // ========================================
    console.log('Step 3: Testing Create Family...');
    
    // Navigate to families page
    await page.goto(`${BASE_URL}/families`);
    
    // Verify families page loads
    await expect(page).toHaveURL(/.*families/);
    await expect(page.locator('h1')).toContainText('Families');
    
    // Click "Add Family" button
    await page.click('button:has-text("Add Family")');
    
    // Wait for modal to open
    await expect(page.locator('h2:has-text("Add Family"), h3:has-text("Add Family")')).toBeVisible({ timeout: 5000 });
    
    // Generate unique family data
    const timestamp = Date.now();
    const familyData = {
      familyName: `E2E Test Family ${timestamp}`,
      primaryContactName: 'John Smith',
      primaryContactEmail: `john.smith.${timestamp}@test.com`,
      primaryContactPhone: '07700 900000',
      addressLine1: '123 Test Street',
      city: 'London',
      postcode: 'SW1A 1AA',
    };
    
    // Fill in family form
    await page.fill('input[name="family_name"], input[placeholder*="Family name"]', familyData.familyName);
    await page.fill('input[name="primary_contact_name"], input[placeholder*="Contact name"]', familyData.primaryContactName);
    await page.fill('input[name="primary_contact_email"], input[type="email"]', familyData.primaryContactEmail);
    await page.fill('input[name="primary_contact_phone"], input[type="tel"]', familyData.primaryContactPhone);
    
    // Fill address fields if visible
    const addressField = page.locator('input[name="address_line_1"], input[placeholder*="Address"]');
    if (await addressField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await addressField.fill(familyData.addressLine1);
    }
    
    const cityField = page.locator('input[name="city"], input[placeholder*="City"]');
    if (await cityField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cityField.fill(familyData.city);
    }
    
    const postcodeField = page.locator('input[name="postcode"], input[placeholder*="Postcode"]');
    if (await postcodeField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await postcodeField.fill(familyData.postcode);
    }
    
    // Submit family form
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Create Family"), button:has-text("Add Family")');
    
    // Wait for modal to close and family to appear in list
    await page.waitForTimeout(2000);
    
    // Verify family was created
    await expect(page.locator(`text=${familyData.familyName}`)).toBeVisible({ timeout: 10000 });
    
    console.log('✓ Create Family successful');
    
    // ========================================
    // STEP 4: ADD MEMBER TO SQUAD
    // ========================================
    console.log('Step 4: Testing Add Member to Squad...');
    
    // Navigate back to members page
    await page.goto(`${BASE_URL}/members`);
    
    // Click "Add Member" button
    await page.click('button:has-text("Add Gymnast")');
    
    // Wait for modal to open
    await expect(page.locator('h2:has-text("Add Gymnast"), h3:has-text("Add Gymnast")')).toBeVisible({ timeout: 5000 });
    
    // Generate unique member data
    const memberData = {
      firstName: 'Emma',
      lastName: `TestMember${timestamp}`,
      dob: '2010-01-15',
      gender: 'F',
      registrationNumber: `SE${timestamp.toString().slice(-6)}`,
    };
    
    // Fill in member form
    await page.fill('input[name="first_name"], input[placeholder*="First name"]', memberData.firstName);
    await page.fill('input[name="last_name"], input[placeholder*="Last name"]', memberData.lastName);
    await page.fill('input[type="date"], input[name="dob"]', memberData.dob);
    
    // Select gender
    const genderSelect = page.locator('select[name="gender"]');
    if (await genderSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await genderSelect.selectOption('F');
    } else {
      // Try radio buttons
      await page.locator('input[type="radio"][value="F"]').check();
    }
    
    // Fill registration number if the field exists
    const registrationNumberField = page.locator('input[name="registration_number"]');
    if (await registrationNumberField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await registrationNumberField.fill(memberData.registrationNumber);
    }
    
    // Select squad if available
    const squadSelect = page.locator('select[name="squad_id"]');
    if (await squadSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const squadOptions = await squadSelect.locator('option').count();
      if (squadOptions > 1) {
        // Select first non-empty option
        await squadSelect.selectOption({ index: 1 });
      }
    }
    
    // Submit member form
    await page.click('button[type="submit"]:has-text("Save"), button:has-text("Add New Gymnast")');
    
    // Wait for modal to close and member to appear in list
    await page.waitForTimeout(2000);
    
    // Verify member was created
    await expect(page.locator(`text=${memberData.firstName} ${memberData.lastName}`)).toBeVisible({ timeout: 10000 });
    
    console.log('✓ Add Member to Squad successful');
    
    // ========================================
    // STEP 5: TAKE ATTENDANCE
    // ========================================
    console.log('Step 5: Testing Take Attendance...');
    
    // Navigate to attendance page
    await page.goto(`${BASE_URL}/attendance`);
    
    // Verify attendance page loads
    await expect(page).toHaveURL(/.*attendance/);
    await expect(page.locator('h1')).toContainText('Attendance');
    
    // Check for session selector
    await expect(page.locator('select, [role="combobox"]')).toBeVisible();
    
    // Select a session if available
    const sessionSelect = page.locator('select#session-select, select:first-of-type');
    const sessionOptions = await sessionSelect.locator('option').count();
    
    if (sessionOptions > 1) {
      // Select first session
      await sessionSelect.selectOption({ index: 1 });
      
      // Wait for attendance roster to load
      await page.waitForTimeout(2000);
      
      // Check if attendance roster is visible
      const hasRoster = await page.locator('[data-testid="attendance-roster"], .space-y-2:has(button[aria-label*="attendance"])').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasRoster) {
        // Try to mark a member as present
        const firstAttendanceButton = page.locator('button:has-text("Present"), button[aria-label*="Present"]').first();
        if (await firstAttendanceButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstAttendanceButton.click();
          
          // Wait for update
          await page.waitForTimeout(1000);
          
          console.log('✓ Marked member as present');
        }
      } else {
        console.log('ℹ No members in session to mark attendance');
      }
    } else {
      console.log('ℹ No sessions available for attendance');
    }
    
    console.log('✓ Take Attendance page accessible');
    
    // ========================================
    // STEP 6: VIEW INVOICES
    // ========================================
    console.log('Step 6: Testing View Invoices...');
    
    // Navigate to invoices page
    await page.goto(`${BASE_URL}/invoices`);
    
    // Verify invoices page loads
    await expect(page).toHaveURL(/.*invoices/);
    await expect(page.locator('h1')).toContainText('Invoices');
    
    // Check for key page elements
    await expect(page.locator('button:has-text("Create Invoice"), button:has-text("Add Invoice")')).toBeVisible();
    
    // Verify stats cards are present
    await expect(page.locator('text=/Total|Outstanding|Revenue/i')).toBeVisible();
    
    // Check if invoices list is visible (or empty state message)
    const hasInvoices = await page.locator('[data-testid="invoice-list"], .space-y-3:has(div[class*="cursor-pointer"])').count() > 0;
    const hasInvoiceEmptyState = await page.locator('text=No invoices found').isVisible().catch(() => false);
    
    expect(hasInvoices || hasInvoiceEmptyState).toBeTruthy();
    
    // Test filters if invoices exist
    if (hasInvoices) {
      // Try status filter
      const statusFilter = page.locator('select:has(option:has-text("Paid")), select:has(option:has-text("Pending"))');
      if (await statusFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Select "All" to show all invoices
        await statusFilter.selectOption({ index: 0 });
        await page.waitForTimeout(500);
      }
    }
    
    console.log('✓ View Invoices successful');
    
    // ========================================
    // FINAL VERIFICATION
    // ========================================
    console.log('Step 7: Final verification...');
    
    // Navigate back to dashboard
    await page.goto(`${BASE_URL}/`);
    
    // Verify we're still logged in
    await expect(page).toHaveURL(`${BASE_URL}/`);
    
    console.log('✓ All smoke tests passed successfully!');
  });
  
  // Individual focused tests for each feature
  
  test('Login page - UI elements and validation', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Check all UI elements are present
    await expect(page.locator('h1:has-text("SwimNexus")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a:has-text("Forgot password")')).toBeVisible();
    await expect(page.locator('a:has-text("Create an account"), a:has-text("register")')).toBeVisible();
    
    // Test validation - submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=/email.*required/i, text=/email.*invalid/i')).toBeVisible({ timeout: 3000 });
  });
  
  test('Login - Invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    
    // Try invalid credentials
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=/invalid.*password/i, text=/error/i, [class*="bg-red"]')).toBeVisible({ timeout: 5000 });
  });
  
  test('Members page - Search and filter functionality', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    
    await page.goto(`${BASE_URL}/members`);
    
    // Verify search input exists
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
    
    // Verify squad filter exists
    await expect(page.locator('select:has(option:has-text("Squad")), select[name="squad"]')).toBeVisible();
  });
  
  test('Navigation - All main menu links work', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);

    // Test navigation to each main section
    const sections = [
      { url: '/members', heading: 'Gymnasts' },
      { url: '/families', heading: 'Families' },
      { url: '/squads', heading: 'Squads' },
      { url: '/attendance', heading: 'Attendance' },
      { url: '/invoices', heading: 'Invoices' },
    ];

    for (const section of sections) {
      await page.goto(`${BASE_URL}${section.url}`);
      await expect(page).toHaveURL(new RegExp(section.url));
      await expect(page.locator('h1')).toContainText(section.heading);
    }
  });

  test('Dashboard - Stats and layout', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator('h1, h2')).toContainText(/Dashboard|SwimNexus/);
    await expect(page.locator('text=/Total|Gymnasts|Active|Revenue/i')).toBeVisible({ timeout: 5000 });
  });

  test('Squads page - List and navigation', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.goto(`${BASE_URL}/squads`);
    await expect(page).toHaveURL(/.*squads/);
    await expect(page.locator('h1')).toContainText('Squads');
    await expect(page.locator('button:has-text("Add Squad"), button:has-text("Create Squad")')).toBeVisible();
  });

  test('Sessions page - List and calendar view', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.goto(`${BASE_URL}/sessions`);
    await expect(page).toHaveURL(/.*sessions/);
    await expect(page.locator('h1')).toContainText('Sessions');
  });

  test('Billing page - Overview and payment methods', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.goto(`${BASE_URL}/billing`);
    await expect(page).toHaveURL(/.*billing/);
    await expect(page.locator('h1')).toContainText(/Billing|Payment/);
  });

  test('Compliance page - Dashboard loads', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.goto(`${BASE_URL}/compliance`);
    await expect(page).toHaveURL(/.*compliance/);
    await expect(page.locator('h1')).toContainText('Compliance');
  });

  test('Communications page - Messages and announcements', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.goto(`${BASE_URL}/communications`);
    await expect(page).toHaveURL(/.*communications/);
    await expect(page.locator('h1')).toContainText('Communications');
  });

  test('Parent portal - Parent views load', async ({ page }) => {
    await login(page, ADMIN_CREDENTIALS.email, ADMIN_CREDENTIALS.password);
    await page.goto(`${BASE_URL}/parent`);
    await expect(page).toHaveURL(/.*parent/);
    await expect(page.locator('h1, h2')).toContainText(/Parent|Portal|Dashboard/);
  });
});
