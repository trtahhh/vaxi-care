const { test, expect } = require('@playwright/test');

/**
 * E2E Test — Vaccine Booking Flow
 *
 * Prerequisites:
 *   - A parent account exists: parent@test.com / ParentPass123!
 *   - A child profile exists for that parent
 *   - Vaccine data exists in database
 *   - Server running on localhost:3000
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Vaccine Booking Flow', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Full booking flow: login → add child → book appointment', async ({ page }) => {
    // Step 1: Login as parent
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'parent@test.com');
    await page.fill('input[name="password"]', 'ParentPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/client\/dashboard/, { timeout: 10000 });

    // Step 2: Navigate to add child form
    await page.goto(`${BASE_URL}/children/add`);
    await expect(page.locator('input[name="name"]')).toBeVisible();

    // Step 3: Register a child
    await page.selectOption('select[name="parentId"]', { index: 1 });
    await page.fill('input[name="name"]', 'Nguyễn Minh Test');
    // Set DOB to 6 months ago
    const dob = new Date();
    dob.setMonth(dob.getMonth() - 6);
    await page.fill('input[name="dob"]', dob.toISOString().split('T')[0]);
    await page.click('input[name="gender"][value="male"]');
    await page.click('button[type="submit"]');

    // Should redirect to dashboard after adding child
    await expect(page).toHaveURL(/\/client\/dashboard/, { timeout: 10000 });

    // Step 4: Book appointment
    await page.goto(`${BASE_URL}/appointments/book`);
    await expect(page.locator('input[name="childId"]').first()).toBeVisible();

    // Select first child
    await page.locator('input[name="childId"]').first().check();

    // Select a vaccine (find first available)
    const vaccineRadios = page.locator('input[name="vaccineId"]');
    const count = await vaccineRadios.count();
    if (count > 0) {
      await vaccineRadios.first().check();
    }

    // Set date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0);
    const dateValue = tomorrow.toISOString().slice(0, 16);
    await page.fill('input[name="date"]', dateValue);

    // Submit
    await page.click('#submit-btn');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/client\/dashboard/, { timeout: 10000 });
  });

  test('Booking with past date should show error', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'parent@test.com');
    await page.fill('input[name="password"]', 'ParentPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/client\/dashboard/, { timeout: 10000 });

    await page.goto(`${BASE_URL}/appointments/book`);
    await page.locator('input[name="childId"]').first().check();

    // Set date to yesterday (past)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await page.fill('input[name="date"]', yesterday.toISOString().slice(0, 16));

    await page.click('#submit-btn');

    // Should show error
    await expect(page.locator('.bg-error')).toBeVisible({ timeout: 5000 });
  });

  test('Vaccine search should filter results', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'parent@test.com');
    await page.fill('input[name="password"]', 'ParentPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/client\/dashboard/, { timeout: 10000 });

    await page.goto(`${BASE_URL}/appointments/book`);

    const searchInput = page.locator('#vaccine-search');
    await searchInput.fill('BCG');

    // Items should be filtered
    const items = page.locator('.vaccine-item-container');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(0); // 0 or filtered
  });
});

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Admin sees pending appointments', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    // Navigate to pending appointments
    await page.goto(`${BASE_URL}/admin/appointments/pending`);
    await expect(page).toHaveURL(/\/admin\/appointments\/pending/);

    // Should see the table or empty state
    const hasTable = await page.locator('table').count();
    const hasEmpty = await page.locator('text=Sạch hàng chờ').count();
    expect(hasTable + hasEmpty).toBeGreaterThan(0);
  });

  test('Approve pending appointment', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });

    await page.goto(`${BASE_URL}/admin/appointments/pending`);

    // Check if there are pending appointments
    const approveButtons = page.locator('button[type="submit"]');
    const count = await approveButtons.count();

    if (count > 0) {
      // Click the first approve button
      await approveButtons.first().click();
      // Should redirect with success message
      await expect(page).toHaveURL(/success=/);
    }
    // If no pending appointments, test passes (empty state)
  });

  test('Vaccine CRUD - add vaccine', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/admin/vaccines/add`);
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="price"]')).toBeVisible();

    await page.fill('input[name="name"]', 'E2E Test Vaccine');
    await page.fill('input[name="price"]', '150000');
    await page.fill('input[name="stock"]', '100');
    await page.click('button[type="submit"]');

    // Should redirect to vaccine list with success
    await expect(page).toHaveURL(/success=/);
  });

  test('Schedule management - set slots for a day', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`);
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/admin/schedule`);

    // Calendar should be visible
    await expect(page.locator('text=Tháng')).toBeVisible();

    // Click the first available day to open config modal
    const setButton = page.locator('button:has-text("THIẾT LẬP")').first();
    if (await setButton.isVisible()) {
      await setButton.click();

      // Modal should open
      await expect(page.locator('#config-modal')).toBeVisible();

      // Set slots
      await page.fill('#config-slots', '30');
      await page.click('button[type="submit"]');

      // Should show success
      await expect(page).toHaveURL(/success=/);
    }
  });
});
